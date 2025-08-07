import { toRESPArray } from "../utilities";
import * as net from "net";

export const sendPing = (connection: net.Socket) => {
	console.log("Successfully connected to master. Sending PING.");
	connection.write(toRESPArray(["PING"]));
};

export const sendReplconfPort = (connection: net.Socket, replicaPort: number) => {
	console.log("Master is alive. Sending first REPLCONF.");
	const cmd = ["REPLCONF", "listening-port", replicaPort.toString()];
	connection.write(toRESPArray(cmd));
};

export const sendReplconfCapa = (connection: net.Socket) => {
	console.log("First REPLCONF accepted. Sending capabilities.");
	const cmd = ["REPLCONF", "capa", "psync2"];
	connection.write(toRESPArray(cmd));
};

export const sendPsync = (connection: net.Socket) => {
	console.log("Capabilities accepted. Sending PSYNC.");
	const cmd = ["PSYNC", "?", "-1"];
	connection.write(toRESPArray(cmd));
};

export const handleFullResync = (response: string) => {
	console.log("Full resync requested by master. Handshake complete.");
};
