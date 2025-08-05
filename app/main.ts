import * as net from "net";
import { DataParser } from "./DataParser";
import { RedisStore } from "./Redis/RedisStore";
import { GlobalDispatcher } from "./GlobalDispatcher";
import { EventEmitter } from "stream";
import { CommandHandler } from "./Redis/CommandHandler";
import { serverInfo } from "./config";
import { MasterConnectionHandler } from "./replication/MasterConnectionHandler";
import { detectServerRole } from "./replication/serverSetup";

export const redisStore = new RedisStore();
export const streamEvents = new EventEmitter();
export const commandHandler = new CommandHandler(redisStore, streamEvents); // Initialize the command handler
export const dispatcher = new GlobalDispatcher(commandHandler); // Initialize the dispatcher
commandHandler.startExpirationCheckTask(1); // Start the expiration check task with a 1 second interval

const { port, role, masterHost, masterPort } = detectServerRole(process.argv);
serverInfo.role = role as any;
serverInfo.masterHost = masterHost;
serverInfo.masterPort = masterPort;

const server: net.Server = net.createServer((connection: net.Socket) => {
	console.log("New connection established");

	connection.on("data", async (data: Buffer) => {
		try {
			const parser = new DataParser(data);
			redisStore.cleanExpiredKeys();
			const payload = parser.getPayload();

			const response = await dispatcher.dispatch(connection, payload);

			if (!response) return; // becayse the PSYNC case now returns undefined, this will be true and the program won't write
			// anything further to the socket

			console.log("globalCommandHandler response: ", response);
			connection.write(response);
		} catch (error) {
			console.error("Error while processing:", error);
			connection.write("-ERR internal server error\r\n");
		}
	});

	connection.on("error", (err) => {
		console.error("Connection error:", err);
	});

	connection.on("end", () => {
		console.log("Client disconnected");
	});
});

server.listen(port, "127.0.0.1", () => {
	console.log(`Server is listening on 127.0.0.1:${port}`);

	if (role === "slave" && masterHost && masterPort) {
		const masterConnectionHandler = new MasterConnectionHandler(masterHost, masterPort, port);

		masterConnectionHandler.on("command", (payload: string[]) => {
			console.log("Received propagated command from master via event.");
			// Execute the command, but don't send a response back to the master
			dispatcher.dispatch(null, payload);
		});
		masterConnectionHandler.connect();
	}
});

server.on("error", (err) => {
	console.error("Server error:", err);
});

export { server };
