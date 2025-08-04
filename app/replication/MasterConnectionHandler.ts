import * as net from "net";
import { handleFullResync, sendPing, sendPsync, sendReplconfCapa, sendReplconfPort } from "./handshake";

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
		sendPing(this.masterConnection);
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
				sendReplconfPort(this.masterConnection, this.replicaPort);
				this.handshakeStep = 2;
			} else if (response === "+OK" && this.handshakeStep === 2) {
				sendReplconfCapa(this.masterConnection);
				this.handshakeStep = 3;
			} else if (response === "+OK" && this.handshakeStep === 3) {
				sendPsync(this.masterConnection);
				this.handshakeStep = 4;
			} else if (response.startsWith("+FULLRESYNC") && this.handshakeStep === 4) {
				handleFullResync(response);
			}
		}
	}

	private onError(err: Error) {
		console.error(`Error connecting to master: ${err.message}`);
	}

	private onEnd() {
		console.log("Disconnected from master.");
	}
}
