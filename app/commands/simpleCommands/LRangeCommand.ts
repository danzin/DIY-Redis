import { ISimpleCommand } from "../ICommand";
import { RedisStore } from "../../store/RedisStore";
import { simpleErrorResponse, toRESPArray } from "../../utilities";

export class LRangeCommand implements ISimpleCommand {
	public readonly type = "simple";

	constructor(private redisStore: RedisStore) {}

	public async execute(args: string[]): Promise<string> {
		if (args.length !== 3) {
			return simpleErrorResponse("wrong number of arguments for 'lrange' command");
		}

		const [key, startStr, endStr] = args;
		const start = parseInt(startStr, 10);
		const end = parseInt(endStr, 10);

		if (isNaN(start) || isNaN(end)) {
			return simpleErrorResponse("value is not an integer or out of range");
		}

		const existing = this.redisStore.get(key);

		// If the key doesn't exist, return an empty array.
		if (!existing) {
			return toRESPArray([]);
		}

		// If the key exists, but isn't a list, return a WRONGTYPE error.
		if (existing.type !== "list") {
			return simpleErrorResponse("WRONGTYPE Operation against a key holding the wrong kind of value");
		}

		let list: string[] = [];
		try {
			list = JSON.parse(existing.value);
		} catch (e) {
			return simpleErrorResponse("internal error - invalid list format");
		}

		// Redis LRANGE treats negative indices relative to the end of the list.
		// The JavaScript `slice` method also does this
		// Redis LRANGE `end` is inclusive, while JS `slice` `end` is exclusive, that's why we add
		// +1 to the end
		const effectiveEnd = end >= 0 ? end + 1 : list.length + end + 1;

		// Use slice to get the sub-array
		const subList = list.slice(start, effectiveEnd);

		// Return the result as a RESP Array
		return toRESPArray(subList);
	}
}
