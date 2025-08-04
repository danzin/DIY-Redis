import * as net from "net";
import { DataParser } from "./DataParser";
import { RedisStore } from "./Redis/RedisStore";
import { globalCommandHandler } from "./Redis/globalDispatcher";
import { EventEmitter } from "stream";
import { CommandHandler } from "./Redis/CommandHandler";
import { serverInfo } from "./config";
import { MasterConnectionHandler } from "./replication/MasterConnectionHandler";
import { detectServerRole } from "./replication/handshake";

export const redisStore = new RedisStore();
export const streamEvents = new EventEmitter();
export const commandHandler = new CommandHandler(redisStore, streamEvents); // Initialize the command handler
commandHandler.startExpirationCheckTask(1); // Start the expiration check task with a 1 second interval

const { port, role, masterHost, masterPort } = detectServerRole(process.argv);
serverInfo.role = role as any;
serverInfo.masterHost = masterHost;
serverInfo.masterPort = masterPort;

if (role === "slave" && masterHost && masterPort) {
	const masterConnectionHandler = new MasterConnectionHandler(masterHost, masterPort, port);
	masterConnectionHandler.connect();
}

const server: net.Server = net.createServer((connection: net.Socket) => {
	console.log("New connection established");

	connection.on("data", async (data: Buffer) => {
		try {
			const parser = new DataParser(data);
			redisStore.cleanExpiredKeys();
			const payload = parser.getPayload();

			const response = await globalCommandHandler(connection, payload);

			if (!response) return;
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
});

server.on("error", (err) => {
	console.error("Server error:", err);
});

export { server };
