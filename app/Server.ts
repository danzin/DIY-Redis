import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import { DataParser } from "./DataParser";
import { RedisStore } from "./Redis/RedisStore";
import { GlobalDispatcher } from "./GlobalDispatcher";
import { EventEmitter } from "stream";
import { CommandHandler } from "./Redis/CommandHandler";
import { serverInfo } from "./config";
import { MasterConnectionHandler } from "./replication/MasterConnectionHandler";
import { detectServerRole } from "./replication/serverSetup";
import { RDBParser } from "./persistence/RDBParser";

export class Server {
	private server: net.Server;
	private redisStore: RedisStore;
	private commandHandler: CommandHandler;
	private dispatcher: GlobalDispatcher;

	constructor() {
		this.redisStore = new RedisStore();
		const streamEvents = new EventEmitter();
		const waitAckEmitter = new EventEmitter();
		this.commandHandler = new CommandHandler(this.redisStore, streamEvents, waitAckEmitter);
		this.dispatcher = new GlobalDispatcher(this.commandHandler, waitAckEmitter);

		this.server = net.createServer(this.handleConnection.bind(this));
	}

	public start(): void {
		console.log("=== STARTUP DEBUG ===");
		console.log("process.argv:", process.argv);

		const { port, role, masterHost, masterPort, dir, dbfilename } = detectServerRole(process.argv);
		serverInfo.role = role as any;
		serverInfo.masterHost = masterHost;
		serverInfo.masterPort = masterPort;
		serverInfo.dir = dir;
		serverInfo.dbfilename = dbfilename;
		console.log("serverInfo set:", serverInfo);

		this.loadRDB();

		this.commandHandler.startExpirationCheckTask(1);
		console.log("Started expiration check task");

		this.server.listen(port, "127.0.0.1", () => {
			console.log(`Redis server listening on 127.0.0.1:${port}`);

			if (serverInfo.role === "slave" && serverInfo.masterHost && serverInfo.masterPort) {
				this.connectToMaster(serverInfo.masterHost, serverInfo.masterPort, port);
			}
			console.log("Server startup completed successfully");
		});

		this.server.on("error", (err: NodeJS.ErrnoException) => {
			console.error("Server listen error:", err);
			if (err.code === "EADDRINUSE") {
				console.error(`Port ${port} is already in use`);
			}
			process.exit(1);
		});
	}

	private handleConnection(connection: net.Socket): void {
		console.log("New connection established");
		connection.on("data", async (data: Buffer) => {
			try {
				const parser = new DataParser(data);
				this.redisStore.cleanExpiredKeys();
				const payload = parser.getPayload();
				const response = await this.dispatcher.dispatch(connection, payload);
				if (response) {
					connection.write(response);
				}
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
	}

	private loadRDB(): void {
		console.log("Loading RDB file during startup...");
		try {
			// The path from the tester is absolute. No special manipulation is needed.
			const dir = serverInfo.dir;
			const rdbFilePath = path.join(dir, serverInfo.dbfilename);
			console.log("Checking for RDB file at", rdbFilePath);

			if (fs.existsSync(rdbFilePath)) {
				const rdbFileBuffer = fs.readFileSync(rdbFilePath);
				if (rdbFileBuffer.length > 0) {
					const parser = new RDBParser(rdbFileBuffer, this.redisStore);
					parser.parse();
					console.log("RDB parsing completed successfully.");
				}
			} else {
				console.warn(`RDB file not found at ${rdbFilePath}. Starting with an empty database.`);
			}
		} catch (error) {
			console.error("Error reading or parsing RDB file:", error);
		}
	}

	private connectToMaster(masterHost: string, masterPort: number, replicaPort: number): void {
		console.log(`Connecting to master at ${masterHost}:${masterPort}`);
		const masterConnectionHandler = new MasterConnectionHandler(masterHost, masterPort, replicaPort);

		masterConnectionHandler.on("command", (payload: string[]) => {
			this.dispatcher.dispatch(null, payload);
		});

		try {
			masterConnectionHandler.connect();
			console.log("Master connection initiated");
		} catch (error) {
			console.error("Error connecting to master:", error);
		}
	}
}
