import { ISimpleCommand } from "../ICommand";
import { RedisStore } from "../../store/RedisStore";
import { simpleErrorResponse, bulkStringResponse } from "../../utilities";

export class LPopCommand implements ISimpleCommand {
	public readonly type = "simple";

	constructor(private redisStore: RedisStore) {}

	public async execute(args: string[]): Promise<string> {
		if (args.length !== 1) {
			return simpleErrorResponse("wrong number of arguments for 'lpop' command");
		}

		const key = args[0];
		const existing = this.redisStore.get(key);

		// If the key doesn't exist, return a null bulk string.
		if (!existing) {
			return bulkStringResponse(); // Returns $-1\r\n
		}

		// If the key exists but is not a list, return an error.
		if (existing.type !== "list") {
			return simpleErrorResponse("WRONGTYPE Operation against a key holding the wrong kind of value");
		}

		let list: string[] = [];
		try {
			list = JSON.parse(existing.value);
		} catch (e) {
			return simpleErrorResponse("internal error - invalid list format");
		}

		// If the list is empty, return a null bulk string.
		if (list.length === 0) {
			return bulkStringResponse();
		}

		// The `shift()` method removes the first element and returns it.
		const poppedElement = list.shift();

		// If the list is now empty after popping, we can delete the key entirely.
		if (list.length === 0) {
			this.redisStore.delete(key);
		} else {
			this.redisStore.set(key, JSON.stringify(list), "list", existing.expiration);
		}

		// Return the element that was removed, formatted as a bulk string.
		return bulkStringResponse(poppedElement);
	}
}
