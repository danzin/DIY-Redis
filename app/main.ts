import * as net from "net";
import { DataParser } from "./DataParser";
import { RedisStore } from "./RedisStore";
import { globalCommandHandler } from "./globalDispatcher";

export const redisStore = new RedisStore();

let port = 6379; // Default port for Redis is 6379

// Check if a custom port is provided via command line arguments
const args = process.argv;
const portIndex = args.findIndex((arg) => arg === "--port");

if (portIndex !== -1 && args[portIndex + 1]) {
	const customPort = parseInt(args[portIndex + 1], 10);
	// Check if the parsed port is a valid number
	if (!isNaN(customPort)) {
		port = customPort;
	}
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
