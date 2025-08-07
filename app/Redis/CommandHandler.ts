import { serverInfo } from "../config";
import { RDBWriter } from "../persistence/RDBWriter";
import { StoreValue, StreamEntry } from "../types";
import {
	bulkStringResponse,
	createExpirationDate,
	generateEntryId,
	getEntryRange,
	isExpired,
	parseStreamEntries,
	simpleErrorResponse,
	simpleStringResponse,
	toRESPArray,
	toRESPEntryArray,
	toRESPStreamArray,
} from "../utilities";
import { EventEmitter } from "events";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";

export class CommandHandler {
	private waitAckEmitter: EventEmitter;

	constructor(private redisStore: any, private streamEvents: EventEmitter, waitAckEmitter: EventEmitter) {
		this.waitAckEmitter = waitAckEmitter;
	}
	echo(args: string[]) {
		return args.length > 0 ? simpleStringResponse(args[0]) : simpleStringResponse("");
	}

	ping(args: string[]) {
		return args.length > 0 ? simpleStringResponse(args[0]) : simpleStringResponse("PONG");
	}

	info(args: string[]): string {
		const section = args[0]?.toLowerCase();

		if (!section || section === "replication" || section === "server") {
			const lines = [
				`role:${serverInfo.role}`,
				`master_replid:${serverInfo.master_replid}`,
				`master_repl_offset:${serverInfo.master_repl_offset}`,
			];

			const responseString = lines.join("\r\n");
			return bulkStringResponse(responseString);
		}
		return bulkStringResponse("");
	}

	replconf(args: string[]): string {
		return simpleStringResponse("OK");
	}

	psync(args: string[], connection: net.Socket): void {
		const fullResyncResponse = `+FULLRESYNC ${serverInfo.master_replid} 0\r\n`;
		connection.write(fullResyncResponse);

		//empty RDB file from its hex representation
		// This is a placeholder for the actual RDB file content
		const emptyRdbHex =
			"524544495330303131fa0972656469732d76657205372e322e30fa0a72656469732d62697473c040fa056374696d65c26d08bc65fa08757365642d6d656dc2b0c41000fa08616f662d62617365c000fffe00f09f42777b";
		const rdbFileBuffer = Buffer.from(emptyRdbHex, "hex");

		const rdbHeader = `$${rdbFileBuffer.length}\r\n`;

		connection.write(Buffer.concat([Buffer.from(rdbHeader), rdbFileBuffer]));

		console.log("Sent FULLRESYNC and empty RDB file to replica.");

		// Take the exact socket object from the handshake and save it to the replicas array
		serverInfo.replicas.push(connection);
	}

	// Method to handle commmand propagation to replicas
	propagate(payload: string[]) {
		if (serverInfo.replicas.length === 0) return; // No replicas to propagate to

		const commandAsRESP = toRESPArray(payload);
		const commandByteLength = Buffer.byteLength(commandAsRESP);
		console.log(
			`Propagating command to ${serverInfo.replicas.length} replica(s):`,
			payload,
			"\r\n",
			`at connection: ${serverInfo.replicas[0].remoteAddress}:${serverInfo.replicas[0].remotePort}`
		);

		// Loop through all registered replica sockets and send the command
		for (const replicaSocket of serverInfo.replicas) {
			replicaSocket.write(commandAsRESP);
		}

		serverInfo.master_repl_offset += commandByteLength; // Increment the master replication offset
	}

	/** The WAIT command expects 2 arguments: numreplicas and timeout.
	 * This command blocks the current client until all the previous write commands are successfully transferred
	 * and acknowledged by at least the number of replicas you specify in the numreplicas argument.
	 * If the value you specify for the timeout argument (in milliseconds) is reached, the command returns
	 * even if the specified number of replicas were not yet reached.
	 * The command will always return the number of replicas that acknowledged the write commands sent by the current
	 * client before the WAIT command, both in the case where the specified number of replicas are reached, or when the timeout is reached. */
	async wait(args: string[]): Promise<string> {
		if (args.length !== 2) {
			return "-ERR wrong number of arguments for 'wait' command\r\n";
		}
		const requiredReplicas = parseInt(args[0], 10);
		const timeout = parseInt(args[1], 10);
		const masterOffset = serverInfo.master_repl_offset;
		const numberOfReplicas = serverInfo.replicas.length;

		// No need to wait if there are no replicas or no writes have happened .
		if (serverInfo.replicas.length === 0 || masterOffset === 0) {
			return `:${serverInfo.replicas.length}\r\n`;
		}

		let ackCount = 0;
		// Send GETACK to all replicas
		const getAckCommand = toRESPArray(["REPLCONF", "GETACK", "*"]);
		serverInfo.replicas.forEach((socket) => socket.write(getAckCommand));

		return new Promise((resolve) => {
			const onAckReceived = (offset: number) => {
				if (offset >= masterOffset) {
					ackCount++;
					if (ackCount >= requiredReplicas) {
						// Cleanup and resolve
						this.waitAckEmitter.removeListener("ack", onAckReceived);
						clearTimeout(timeoutId);
						resolve(`:${ackCount}\r\n`); // resolve if the required number of replicas acknowledged
					}
				}
			};

			this.waitAckEmitter.on("ack", onAckReceived);
			const timeoutId = setTimeout(() => {
				// Cleanup and resolve
				this.waitAckEmitter.removeListener("ack", onAckReceived);
				resolve(`:${ackCount}\r\n`); // resolve with the number of replicas that acknowledged before the timeout
			}, timeout);
		});
	}

	async set(args: string[]): Promise<string> {
		if (args.length < 2) {
			return simpleErrorResponse("wrong number of arguments for 'set' command");
		}

		const key = args.shift()!;
		const value = args.shift()!;

		let expiration: Date | undefined = undefined;
		let mode: "NX" | "XX" | null = null;
		let keepTTL = false;

		while (args.length > 0) {
			const option = args.shift()!.toUpperCase();
			let timeStr: string | undefined;
			let time: number;

			switch (option) {
				case "EX":
					timeStr = args.shift();
					if (!timeStr) return simpleErrorResponse("syntax error");
					time = parseInt(timeStr, 10);
					expiration = createExpirationDate(time * 1000);
					break;
				case "PX":
					timeStr = args.shift();
					if (!timeStr) return simpleErrorResponse("syntax error");
					time = parseInt(timeStr, 10);
					expiration = createExpirationDate(time);
					break;
				case "EXAT":
					timeStr = args.shift();
					if (!timeStr) return simpleErrorResponse("syntax error");
					time = parseInt(timeStr, 10);
					expiration = new Date(time * 1000);
					break;
				case "PXAT":
					timeStr = args.shift();
					if (!timeStr) return simpleErrorResponse("syntax error");
					time = parseInt(timeStr, 10);
					expiration = new Date(time);
					break;
				case "NX":
					mode = "NX";
					break;
				case "XX":
					mode = "XX";
					break;
				case "KEEPTTL":
					keepTTL = true;
					break;
				default:
					return simpleErrorResponse("syntax error");
			}
		}
		const existingValue = this.redisStore.get(key);

		// Check existence conditions (NX and XX)
		if (mode === "NX" && existingValue) {
			return bulkStringResponse(); // (nil) because key already exists
		}
		if (mode === "XX" && !existingValue) {
			return bulkStringResponse(); // (nil) because key does not exist
		}

		// Handle KEEPTTL
		if (keepTTL && existingValue) {
			expiration = existingValue.expiration;
		}

		this.redisStore.set(key, value, "string", expiration);
		return simpleStringResponse("OK");
	}

	async expire(args: string[]): Promise<string> {
		if (args.length !== 2) {
			return simpleErrorResponse("wrong number of arguments for 'expire' command");
		}

		const [key, secondsStr] = args;
		const existing = this.redisStore.get(key);

		if (!existing) {
			return ":0\r\n"; // Key does not exist
		}

		const seconds = parseInt(secondsStr, 10);
		if (isNaN(seconds)) {
			return simpleErrorResponse("value is not an integer or out of range");
		}

		const newExpiration = createExpirationDate(seconds * 1000);
		this.redisStore.set(key, existing.value, existing.type, newExpiration);

		return ":1\r\n"; // Expiration was set
	}

	async exists(args: string[]): Promise<string> {
		if (args.length < 1) {
			return simpleErrorResponse("wrong number of arguments for 'exists' command");
		}

		let count = 0;
		for (const key of args) {
			// check for the key and also ensure it's not expired.
			const value = this.redisStore.get(key);
			if (value && !isExpired(value.expiration)) {
				count++;
			}
		}

		return `:${count}\r\n`;
	}

	async del(args: string[]): Promise<string> {
		if (args.length === 0) {
			return "-ERR wrong number of arguments for 'del' command\r\n";
		}
		let deletedCount = 0;
		for (const key of args) {
			if (this.redisStore.delete(key)) {
				deletedCount++;
			}
		}
		return `:${deletedCount}\r\n`;
	}

	async get(args: string[]): Promise<string> {
		if (args.length !== 1) return "-ERR Wrong number of arguments for GET\r\n";
		const key = args[0];
		const value = this.redisStore.get(key);
		if (!value) return bulkStringResponse();
		return bulkStringResponse(value.value);
	}

	async type(args: string[]): Promise<string> {
		if (args.length < 1) return `wrong number of arguments for TYPE`;
		const storeValue = this.redisStore.get(args[0]);
		if (!storeValue) return simpleStringResponse("none");
		return simpleStringResponse(storeValue.type);
	}

	async xadd(args: string[]): Promise<string> {
		if (args.length < 4) {
			return simpleErrorResponse("wrong number of arguments for 'xadd' command");
		}
		const [streamKey, ...rest] = args;
		const newStreamEntry = parseStreamEntries(rest);
		if (!newStreamEntry) {
			return simpleErrorResponse("The ID specified in XADD must be greater than 0-0");
		}

		const oldStream = this.redisStore.get(streamKey);

		if (oldStream) {
			if (oldStream.type !== "stream") {
				return simpleErrorResponse("WRONGTYPE Operation against a key holding the wrong kind of value");
			}
			let oldStreamEntries: StreamEntry[];
			try {
				oldStreamEntries = JSON.parse(oldStream.value) as StreamEntry[];
			} catch (e) {
				console.error("Failed to parse oldStream.value:", oldStream.value, e);
				return simpleErrorResponse("Internal error parsing stream data");
			}
			const lastStreamEntry = oldStreamEntries?.at(-1)!;
			const newEntryId = generateEntryId(newStreamEntry[0], lastStreamEntry[0]);
			if (newEntryId === null) {
				return simpleErrorResponse("The ID specified in XADD is equal or smaller than the target stream top item");
			}

			newStreamEntry[0] = newEntryId;
			const newStreamValue = [...oldStreamEntries, newStreamEntry];
			this.redisStore.set(streamKey, JSON.stringify(newStreamValue), "stream", oldStream.expiration);

			this.streamEvents.emit("new-entry", streamKey);
			return bulkStringResponse(newEntryId);
		}

		const newEntryId = generateEntryId(newStreamEntry[0])!;
		newStreamEntry[0] = newEntryId;
		this.redisStore.set(streamKey, JSON.stringify([newStreamEntry]), "stream");

		this.streamEvents.emit("new-entry", streamKey);
		return bulkStringResponse(newEntryId);
	}

	async xread(args: string[]): Promise<string> {
		const blockIndex = args.findIndex((arg) => arg.toLowerCase() === "block");
		let timeout = 0;
		let streamsIndex = -1;

		if (blockIndex !== -1) {
			if (args.length < blockIndex + 3) {
				return simpleErrorResponse("wrong number of arguments for 'xread' command with BLOCK");
			}
			const timeoutStr = args[blockIndex + 1];
			if (isNaN(parseInt(timeoutStr, 10)) || parseInt(timeoutStr, 10) < 0) {
				return simpleErrorResponse("ERR timeout is negative");
			}
			timeout = parseInt(timeoutStr, 10);
			streamsIndex = blockIndex + 2;
		} else {
			streamsIndex = args.findIndex((arg) => arg.toLowerCase() === "streams");
		}

		if (streamsIndex === -1 || args[streamsIndex].toLowerCase() !== "streams" || streamsIndex + 1 >= args.length) {
			return simpleErrorResponse("wrong number of arguments for 'xread' command");
		}

		const streamKeysAndIds = args.slice(streamsIndex + 1);
		const numStreams = streamKeysAndIds.length / 2;
		if (streamKeysAndIds.length % 2 !== 0) {
			return simpleErrorResponse("Unbalanced list of streams and IDs in XREAD");
		}

		const streamKeys = streamKeysAndIds.slice(0, numStreams);
		const originalStreamIds = streamKeysAndIds.slice(numStreams);

		const processXRead = (startIds: string[]) => {
			const results: [string, StreamEntry[]][] = [];
			let hasNewData = false;
			for (let i = 0; i < numStreams; i++) {
				const key = streamKeys[i];
				const startId = startIds[i];
				const stream = this.redisStore.get(key);

				if (stream) {
					const streamEntries = JSON.parse(stream.value) as StreamEntry[];
					const entries = getEntryRange(streamEntries, startId);
					if (entries.length > 0) {
						hasNewData = true;
						results.push([key, entries]);
					}
				}
			}
			return { results, hasNewData };
		};

		if (blockIndex === -1) {
			// Non-blocking logic
			if (originalStreamIds.includes("$")) {
				return simpleErrorResponse("ERR The $ ID is only valid in the context of BLOCK");
			}
			const { results } = processXRead(originalStreamIds);
			if (results.length === 0) {
				return bulkStringResponse();
			}
			return toRESPStreamArray(results);
		} else {
			// --- BLOCKING LOGIC ---

			// 1. Resolve all start IDs once before waiting
			const resolvedStreamIds = originalStreamIds.map((id, i) => {
				if (id === "$") {
					const key = streamKeys[i];
					const stream = this.redisStore.get(key);
					if (stream) {
						const streamEntries = JSON.parse(stream.value) as StreamEntry[];
						return streamEntries.length > 0 ? streamEntries[streamEntries.length - 1][0] : "0-0";
					}
					return "0-0"; // If stream doesn't exist, start from the beginning
				}
				return id;
			});

			// 2. Do an initial check with the now-fixed start IDs
			const initialCheck = processXRead(resolvedStreamIds);
			if (initialCheck.hasNewData) {
				return toRESPStreamArray(initialCheck.results);
			}

			// 3. If no data, start the blocking promise
			return new Promise((resolve) => {
				let timeoutId: NodeJS.Timeout | null = null;

				const onNewEntry = (streamKey: string) => {
					if (streamKeys.includes(streamKey)) {
						// Use the same resolved IDs for the check
						const { results, hasNewData } = processXRead(resolvedStreamIds);
						if (hasNewData) {
							if (timeoutId) clearTimeout(timeoutId);
							this.streamEvents.removeListener("new-entry", onNewEntry);
							resolve(toRESPStreamArray(results));
						}
					}
				};

				this.streamEvents.on("new-entry", onNewEntry);

				if (timeout > 0) {
					timeoutId = setTimeout(() => {
						this.streamEvents.removeListener("new-entry", onNewEntry);
						resolve(bulkStringResponse()); // (nil)
					}, timeout);
				}
				// If timeout is 0, wait until the listener eventually resolves it
			});
		}
	}

	async xrange(args: string[]) {
		if (args.length < 3) {
			return simpleErrorResponse("wrong number of arguments for 'xrange' command");
		}
		const [streamKey, start, end] = args;
		const storedStream = this.redisStore.get(streamKey)?.value;

		// If the stream doesn't exist, return an empty array as per standard Redis behavior
		if (!storedStream) {
			return toRESPEntryArray([]);
		}

		const streamEntries = JSON.parse(storedStream) as StreamEntry[];

		// The getEntryRange function is sufficient to handle all cases,
		// including invalid ranges (start > end), which will correctly result
		// in an empty array
		const result = getEntryRange(streamEntries, start, end);

		return toRESPEntryArray(result);
	}

	async xrevrange(args: string[]): Promise<string> {
		if (args.length < 3) {
			return simpleErrorResponse("wrong number of arguments for 'xrevrange' command");
		}

		const [streamKey, endId, startId, ...rest] = args;
		let count: number | undefined = undefined;

		// Parse the optional COUNT argument
		if (rest.length > 0) {
			if (rest[0]?.toUpperCase() === "COUNT" && rest[1]) {
				count = parseInt(rest[1], 10);
				if (isNaN(count) || count < 0) {
					return simpleErrorResponse("value is not an integer or out of range");
				}
			} else {
				return simpleErrorResponse("syntax error");
			}
		}

		const storedStream = this.redisStore.get(streamKey);

		// If no stram or not a stream, return an empty array
		if (!storedStream || storedStream.type !== "stream") {
			return toRESPEntryArray([]);
		}

		const streamEntries = JSON.parse(storedStream.value) as StreamEntry[];

		const filteredEntries = getEntryRange(streamEntries, startId, endId);

		// reverse the array of results.
		const reversedEntries = filteredEntries.reverse();

		// Apply the COUNT limit if it was provided.
		const finalEntries = count !== undefined ? reversedEntries.slice(0, count) : reversedEntries;

		return toRESPEntryArray(finalEntries);
	}

	config(args: string[]): string {
		const subCommand = args[0]?.toLowerCase();
		const parameter = args[1]?.toLowerCase();

		if (subCommand !== "get" || !parameter) {
			return "-ERR Syntax error in CONFIG command\r\n";
		}

		let value: string | null = null;

		switch (parameter) {
			case "dir":
				value = serverInfo.dir;
				break;
			case "dbfilename":
				value = serverInfo.dbfilename;
				break;
			default:
				// For unsupported parameters, Redis returns an empty array
				return "*0\r\n";
		}

		// The response is an array of [parameter, value]
		return toRESPArray([parameter, value]);
	}

	keys(args: string[]): string {
		const pattern = args[0];

		if (pattern === "*") {
			const allKeys = this.redisStore.getKeys();
			return toRESPArray(allKeys);
		}
		return toRESPArray([]); // Return empty array for other patterns
	}

	save(args: string[]): string {
		try {
			console.log("Starting SAVE operation...");

			// Use the RDBWriter to build the file content in memory
			const writer = new RDBWriter(this.redisStore);
			const rdbBuffer = writer.buildRDB();

			// Determine the full file path from config
			const rdbFilePath = path.join(serverInfo.dir, serverInfo.dbfilename);

			// Write the buffer to the file, overwriting it if it exists
			fs.writeFileSync(rdbFilePath, rdbBuffer);

			console.log(`DB saved on disk at ${rdbFilePath}`);
			return simpleStringResponse("OK");
		} catch (error) {
			console.error("Error during SAVE operation:", error);
			return simpleErrorResponse("Failed to save RDB file.");
		}
	}

	checkAndDeleteExpiredKeys(): void {
		const keys = this.redisStore.getKeys();
		keys.forEach((key: string) => {
			const value = this.redisStore.get(key);
			if (value && isExpired(value.expiration)) {
				this.redisStore.delete(key);
			}
		});
	}

	startExpirationCheckTask(interval: number): void {
		setInterval(() => this.checkAndDeleteExpiredKeys(), interval);
	}
}
