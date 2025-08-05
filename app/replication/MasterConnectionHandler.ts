import * as net from "net";
import { EventEmitter } from "events";
import { handleFullResync, sendPing, sendPsync, sendReplconfCapa, sendReplconfPort } from "./handshake";

export class MasterConnectionHandler extends EventEmitter {
	private masterConnection: net.Socket;
	private handshakeStep = 0;
	private rdbFileExpected = false;
	private receivedDataBuffer = Buffer.alloc(0);

	constructor(private masterHost: string, private masterPort: number, private replicaPort: number) {
		super();
		this.masterConnection = net.createConnection({
			host: this.masterHost,
			port: this.masterPort,
		});
	}

	public connect() {
		console.log(`This server is a replica, attempting to connect to master at ${this.masterHost}:${this.masterPort}`);
		this.masterConnection.on("connect", () => this.onConnect());
		this.masterConnection.on("data", (data) => this.onData(data));
		this.masterConnection.on("error", (err) => this.onError(err));
		this.masterConnection.on("end", () => this.onEnd());
	}

	private onConnect() {
		this.handshakeStep = 0;
		sendPing(this.masterConnection);
	}

	private onData(data: Buffer) {
		// Always append new data to the internal buffer
		this.receivedDataBuffer = Buffer.concat([this.receivedDataBuffer, data]);

		// Loop until all messages in the buffer are processed
		while (true) {
			let bytesConsumed = 0;
			if (this.handshakeStep < 4) {
				bytesConsumed = this.processHandshakeMessage();
			} else if (this.rdbFileExpected) {
				bytesConsumed = this.processRdbFile();
			} else {
				bytesConsumed = this.processPropagatedCommand();
			}

			// If if there's no full message, wait for more data.
			if (bytesConsumed === 0) break;

			// Slice the buffer to remove the message
			this.receivedDataBuffer = this.receivedDataBuffer.slice(bytesConsumed);
		}
	}

	private processHandshakeMessage(): number {
		const endOfLine = this.receivedDataBuffer.indexOf("\r\n");
		if (endOfLine === -1) return 0; // Incomplete message

		const response = this.receivedDataBuffer.slice(0, endOfLine).toString();
		console.log(`Received from master (handshake): ${response}`);

		if (response === "+PONG" && this.handshakeStep === 0) {
			this.handshakeStep = 1;
			sendReplconfPort(this.masterConnection, this.replicaPort);
		} else if (response === "+OK" && this.handshakeStep === 1) {
			this.handshakeStep = 2;
			sendReplconfCapa(this.masterConnection);
		} else if (response === "+OK" && this.handshakeStep === 2) {
			this.handshakeStep = 3;
			sendPsync(this.masterConnection);
		} else if (response.startsWith("+FULLRESYNC") && this.handshakeStep === 3) {
			this.handshakeStep = 4;
			this.rdbFileExpected = true;
			handleFullResync(response);
		}

		return endOfLine + 2; // Return bytes consumed (message + \r\n)
	}

	private processRdbFile(): number {
		console.log("Attempting to process RDB file from stream...");
		// RDB files are sent as length-prefixed bulk strings: $<length>\r\n<contents>
		const endOfHeader = this.receivedDataBuffer.indexOf("\r\n");
		if (endOfHeader === -1) return 0; // Incomplete header

		const header = this.receivedDataBuffer.slice(0, endOfHeader).toString();
		if (!header.startsWith("$")) {
			console.error("Invalid RDB file format, expected $<length>");
			// Clear the buffer to prevent an infinite loop on invalid data
			return this.receivedDataBuffer.length;
		}

		const length = parseInt(header.substring(1), 10);
		const totalMessageLength = endOfHeader + 2 + length;

		if (this.receivedDataBuffer.length < totalMessageLength) {
			return 0; // Incomplete RDB file content, wait for more data
		}

		console.log("RDB file fully received and skipped.");
		this.rdbFileExpected = false;
		return totalMessageLength; // Return total bytes consumed for the RDB file
	}

	private processPropagatedCommand(): number {
		// Apparently this requires a parser that understands the RESP protocol's structure to calculate the
		// exact length of a command. It's a minimal implementation

		// Check for array prefix '*'
		if (this.receivedDataBuffer[0] !== 42) return 0;

		const endOfFirstLine = this.receivedDataBuffer.indexOf("\r\n");
		if (endOfFirstLine === -1) return 0;

		const arrayLengthStr = this.receivedDataBuffer.slice(1, endOfFirstLine).toString();
		const arrayLength = parseInt(arrayLengthStr, 10);

		let currentIndex = endOfFirstLine + 2;
		// Each command part is a bulk string ($<len>\r\n<data>\r\n)
		for (let i = 0; i < arrayLength; i++) {
			// Find start of bulk string
			if (this.receivedDataBuffer[currentIndex] !== 36) return 0;

			// Find end of bulk string header
			const endOfBulkStringHeader = this.receivedDataBuffer.indexOf("\r\n", currentIndex);
			if (endOfBulkStringHeader === -1) return 0;

			// Extract bulk string length
			const bulkStringLength = parseInt(
				this.receivedDataBuffer.slice(currentIndex + 1, endOfBulkStringHeader).toString(),
				10
			);

			const endOfBulkString = endOfBulkStringHeader + 2 + bulkStringLength + 2;
			if (this.receivedDataBuffer.length < endOfBulkString) return 0;
			currentIndex = endOfBulkString;
		}

		// Full command in the buffer
		const commandBytes = this.receivedDataBuffer.slice(0, currentIndex);
		console.log(`Emitting complete command from buffer: ${commandBytes.toString().replace(/\r\n/g, "\\r\\n")}`);
		this.emit("command", commandBytes);

		// Return the total length of the command
		return currentIndex;
	}

	private onError(err: Error) {
		console.error(`Error connecting to master: ${err.message}`);
	}
	private onEnd() {
		console.log("Disconnected from master.");
	}
}
