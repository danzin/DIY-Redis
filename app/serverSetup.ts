import * as net from "net";
import { serverInfo } from "./config";
import { toRESPArray } from "./utilities";

export function detectServerRole(args: string[]) {
	let port = 6379;
	let role = "master";
	let masterHost: string | null = null;
	let masterPort: number | null = null;

	const portIndex = args.findIndex((arg) => arg === "--port");
	if (portIndex !== -1 && args[portIndex + 1]) {
		const customPort = parseInt(args[portIndex + 1], 10);
		if (!isNaN(customPort)) port = customPort;
	}

	const replicaOfIndex = args.findIndex((arg) => arg === "--replicaof");
	if (replicaOfIndex !== -1 && args[replicaOfIndex + 1]) {
		const firstArg = args[replicaOfIndex + 1];
		let host: string | undefined;
		let portStr: string | undefined;

		if (firstArg.includes(" ")) {
			[host, portStr] = firstArg.split(" ");
		} else if (args[replicaOfIndex + 2]) {
			host = firstArg;
			portStr = args[replicaOfIndex + 2];
		}

		// If host and port are successfully parsed, update the local variables
		if (host && portStr) {
			role = "slave";
			masterHost = host;
			masterPort = parseInt(portStr, 10);
		}
	}

	return { port, role, masterHost, masterPort };
}

export function setupMasterConnection(masterHost: string, masterPort: number, replicaPort: number) {
	const masterConnection = net.createConnection({ host: masterHost, port: masterPort });

	let handshakeStep = 0;

	masterConnection.on("connect", () => {
		console.log("Successfully connected to master. Sending PING.");
		// Send PING
		masterConnection.write(toRESPArray(["PING"]));
		handshakeStep = 1;
	});

	masterConnection.on("data", (data) => {
		const response = data.toString().trim();
		console.log(`Received from master: ${response}`);

		if (response === "+PONG" && handshakeStep === 1) {
			// Received PONG, send first REPLCONF
			console.log("Master is alive. Sending first REPLCONF.");
			const replconfPortCmd = ["REPLCONF", "listening-port", replicaPort.toString()];
			masterConnection.write(toRESPArray(replconfPortCmd));
			handshakeStep = 2;
		} else if (response === "+OK" && handshakeStep === 2) {
			//Received OK for first REPLCONF, send second REPLCONF
			console.log("First REPLCONF accepted. Sending capabilities.");
			const replconfCapaCmd = ["REPLCONF", "capa", "psync2"];
			masterConnection.write(toRESPArray(replconfCapaCmd));
			handshakeStep = 3;
		} else if (response === "+OK" && handshakeStep === 3) {
			// Received OK for second REPLCONF. Handshake is complete.
			console.log("Capabilities accepted. Ready for PSYNC.");
		}
	});

	masterConnection.on("error", (err) => {
		console.error(`Error connecting to master: ${err.message}`);
	});

	masterConnection.on("end", () => {
		console.log("Disconnected from master.");
	});
}
