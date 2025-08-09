import { ISimpleCommand } from "../ICommand";
import { RedisStore } from "../../store/RedisStore";
import { BlockingManager } from "../../services/BlockingManager";
import { simpleErrorResponse } from "../../utilities";

export class RPushCommand implements ISimpleCommand {
	public readonly type = "simple";

	constructor(private redisStore: RedisStore, private blockingManager: BlockingManager) {}

	public async execute(args: string[]): Promise<string> {
		if (args.length < 2) {
			return simpleErrorResponse("wrong number of arguments for 'rpush' command");
		}

		const [key, ...elements] = args;
		const existing = this.redisStore.get(key);
		let list: string[] = [];

		if (existing) {
			// If the key exists, check if it's a list.
			if (existing.type !== "list") {
				return simpleErrorResponse("WRONGTYPE Operation against a key holding the wrong kind of value");
			}
			// If it is a list, parse it from JSON.
			try {
				list = JSON.parse(existing.value);
			} catch (e) {
				return simpleErrorResponse("internal error - invalid list format");
			}
		}

		// Append all the new elements to the list.
		list.push(...elements);

		// Store the updated list back into the store, preserving expiry.
		this.redisStore.set(key, JSON.stringify(list), "list", existing?.expiration);

		//Notify the blocking manager.
		this.blockingManager.notifyListPush(key);

		// Return the new length of the list as a RESP integer.
		return `:${list.length}\r\n`;
	}
}
