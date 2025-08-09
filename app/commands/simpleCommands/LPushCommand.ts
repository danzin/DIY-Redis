import { ISimpleCommand } from "../ICommand";
import { RedisStore } from "../../store/RedisStore";
import { simpleErrorResponse } from "../../utilities";

export class LPushCommand implements ISimpleCommand {
	public readonly type = "simple";

	constructor(private redisStore: RedisStore) {}

	public async execute(args: string[]): Promise<string> {
		if (args.length < 2) {
			return simpleErrorResponse("wrong number of arguments for 'lpush' command");
		}

		const [key, ...elements] = args;
		const existing = this.redisStore.get(key);
		let list: string[] = [];

		if (existing) {
			if (existing.type !== "list") {
				return simpleErrorResponse("WRONGTYPE Operation against a key holding the wrong kind of value");
			}
			try {
				list = JSON.parse(existing.value);
			} catch (e) {
				return simpleErrorResponse("internal error - invalid list format");
			}
		}

		// Redis pushes multiple elements from left to right.
		// To simulate this with `unshift`, which adds elements as a block,
		// we must add them to the front of the list individually.
		// The simplest way is to iterate through them.

		// for (const element of elements) {
		//     list.unshift(element);
		// }

		// A more consice one-liner
		list.unshift(...elements.reverse());

		// Store the updated list back into the store.
		this.redisStore.set(key, JSON.stringify(list), "list", existing?.expiration);

		// Return the new length of the list.
		return `:${list.length}\r\n`;
	}
}
