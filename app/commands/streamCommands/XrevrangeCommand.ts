import { RedisStore } from "../../store/RedisStore";
import { StreamEntry } from "../../types";
import { getEntryRange, simpleErrorResponse, toRESPEntryArray } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class XrevrangeCommand implements ISimpleCommand {
	readonly type = "simple";

	constructor(private redisStore: RedisStore) {}

	async execute(args: string[]): Promise<string> {
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

		// If no stream or not a stream, return an empty array
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
}
