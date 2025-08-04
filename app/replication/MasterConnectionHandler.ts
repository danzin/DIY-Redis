import * as net from "net";
import { toRESPArray } from "../utilities";

export class MasterConnectionHandler {
	private masterConnection: net.Socket;
	private handshakeStep = 0;

	constructor(private masterHost: string, private masterPort: number, private replicaPort: number) {
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
		console.log("Successfully connected to master. Sending PING.");
		this.sendPing();
		this.handshakeStep = 1;
	}

	private onData(data: Buffer) {
		const responses = data
			.toString()
			.split("\r\n")
			.filter((s) => s.length > 0);

		for (const response of responses) {
			console.log(`Received from master: ${response}`);

			if (response === "+PONG" && this.handshakeStep === 1) {
				this.sendReplconfPort();
				this.handshakeStep = 2;
			} else if (response === "+OK" && this.handshakeStep === 2) {
				this.sendReplconfCapa();
				this.handshakeStep = 3;
			} else if (response === "+OK" && this.handshakeStep === 3) {
				this.sendPsync();
				this.handshakeStep = 4;
			} else if (response.startsWith("+FULLRESYNC") && this.handshakeStep === 4) {
				console.log("Full resync requested by master. Handshake complete.");
			}
		}
	}

	private onError(err: Error) {
		console.error(`Error connecting to master: ${err.message}`);
	}

	private onEnd() {
		console.log("Disconnected from master.");
	}

	// --- Command Sending Methods ---

	private sendPing() {
		this.masterConnection.write(toRESPArray(["PING"]));
	}

	private sendReplconfPort() {
		console.log("Master is alive. Sending first REPLCONF.");
		const command = ["REPLCONF", "listening-port", this.replicaPort.toString()];
		this.masterConnection.write(toRESPArray(command));
	}

	private sendReplconfCapa() {
		console.log("First REPLCONF accepted. Sending capabilities.");
		const command = ["REPLCONF", "capa", "psync2"];
		this.masterConnection.write(toRESPArray(command));
	}

	private sendPsync() {
		console.log("Capabilities accepted. Sending PSYNC.");
		const command = ["PSYNC", "?", "-1"];
		this.masterConnection.write(toRESPArray(command));
	}
}
