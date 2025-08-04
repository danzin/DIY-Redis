import { redisStore } from "./main";
import { StoreValue, StreamEntry } from "./types";
import {
	bulkStringResponse,
	createExpirationDate,
	generateEntryId,
	getEntryRange,
	isExpired,
	parseStreamEntries,
	simpleErrorResponse,
	simpleStringResponse,
	toRESPEntryArray,
	toRESPStreamArray,
} from "./utilities";
import { EventEmitter } from "events";

const streamEvents = new EventEmitter();

export const handleEchoCommand = (args: string[]) => {
	return args.length > 0 ? simpleStringResponse(args[0]) : simpleStringResponse("");
};

export const handlePingCommand = (args: string[]) => {
	return args.length > 0 ? simpleStringResponse(args[0]) : simpleStringResponse("PONG");
};

export const handleSetCommand = async (args: string[]): Promise<string> => {
	if (args.length < 2) return "-ERR Wrong number of arguments for SET\r\n";

	const [key, value, px, time] = args;
	const storeValue: StoreValue = { value, type: "string" };

	if (px?.toLowerCase() === "px" && typeof Number(time) === "number") {
		storeValue.expiration = createExpirationDate(Number(time));
	}

	redisStore.set(key, storeValue.value, storeValue.type, storeValue.expiration);
	return simpleStringResponse("OK");
};

export const handleGetCommand = async (args: string[]): Promise<string> => {
	if (args.length !== 1) return "-ERR Wrong number of arguments for GET\r\n";

	const key = args[0];
	const value = redisStore.get(key);

	if (!value) return bulkStringResponse();
	return bulkStringResponse(value.value);
};

export const handleTypeCommand = async (args: string[]): Promise<string> => {
	if (args.length < 1) return `wrong number of arguments for TYPE`;

	const storeValue = redisStore.get(args[0]);
	if (!storeValue) return simpleStringResponse("none");
	return simpleStringResponse(storeValue.type);
};

export const handleXaddCommand = (args: string[]) => {
	if (args.length < 4) return simpleErrorResponse("wrong number of arguments for 'xadd' command");
	const [streamKey, ...rest] = args;
	const newStreamEntry = parseStreamEntries(rest);
	if (!newStreamEntry) return simpleErrorResponse("The ID specified in XADD must be greater than 0-0");

	const oldStream = redisStore.get(streamKey);
	console.log("oldStream:", oldStream);
	if (oldStream) {
		let oldStreamEntries: StreamEntry[];
		try {
			// Accessing the nested value property that contains the JSON string
			oldStreamEntries = JSON.parse(oldStream.value) as StreamEntry[];
		} catch (e) {
			console.error("Failed to parse oldStream.value:", oldStream.value, e);
			return simpleErrorResponse("Internal error parsing stream data");
		}
		const lastStreamEntry = oldStreamEntries?.at(-1)!;
		const newEntryId = generateEntryId(newStreamEntry[0], lastStreamEntry[0]);
		if (newEntryId === null)
			return simpleErrorResponse("The ID specified in XADD is equal or smaller than the target stream top item");
		newStreamEntry[0] = newEntryId;
		const newStreamValue = [...oldStreamEntries, newStreamEntry];
		redisStore.set(streamKey, JSON.stringify(newStreamValue), "stream", oldStream.expiration);

		// Emit event after adding new entry to the stream
		streamEvents.emit("new-entry", streamKey);

		return bulkStringResponse(newEntryId);
	}
	const newEntryId = generateEntryId(newStreamEntry[0])!;
	newStreamEntry[0] = newEntryId;
	redisStore.set(streamKey, JSON.stringify([newStreamEntry]), "stream");

	// Emit event after adding new entry to the stream
	streamEvents.emit("new-entry", streamKey);

	return bulkStringResponse(newEntryId);
};

export const handleXreadCommand = async (args: string[]): Promise<string> => {
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
			const stream = redisStore.get(key);

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
				const stream = redisStore.get(key);
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
						streamEvents.removeListener("new-entry", onNewEntry);
						resolve(toRESPStreamArray(results));
					}
				}
			};

			streamEvents.on("new-entry", onNewEntry);

			if (timeout > 0) {
				timeoutId = setTimeout(() => {
					streamEvents.removeListener("new-entry", onNewEntry);
					resolve(bulkStringResponse()); // (nil)
				}, timeout);
			}
			// If timeout is 0, wait until the listener eventually resolves it
		});
	}
};

export const handleXrangeCommand = (args: string[]) => {
	if (args.length < 3) {
		return simpleErrorResponse("wrong number of arguments for 'xrange' command");
	}
	const [streamKey, start, end] = args;
	const storedStream = redisStore.get(streamKey)?.value;

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
};

const checkAndDeleteExpiredKeys = (): void => {
	const keys = redisStore.getKeys();
	keys.forEach((key) => {
		const value = redisStore.get(key);
		if (value && isExpired(value.expiration)) {
			redisStore.delete(key);
		}
	});
};

const startExpirationCheckTask = (interval: number): void => {
	setInterval(checkAndDeleteExpiredKeys, interval);
};
startExpirationCheckTask(1);

// Schedule the expiration check task to run every minute
// cron.schedule('*/1 * * * *', () => {
//   console.log('Running expiration check task');
//   checkAndDeleteExpiredKeys();
// });
