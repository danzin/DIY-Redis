import { ISimpleCommand } from "../ICommand";
import { RedisStore } from "../../store/RedisStore";
import { simpleErrorResponse } from "../../utilities";

export class LLenCommand implements ISimpleCommand {
	public readonly type = "simple";

	constructor(private redisStore: RedisStore) {}

	public async execute(args: string[]): Promise<string> {
		if (args.length !== 1) {
			return simpleErrorResponse("wrong number of arguments for 'llen' command");
		}

		const key = args[0];
		const existing = this.redisStore.get(key);

		// If the key doesn't exist, Redis returns 0.
		if (!existing) {
			return ":0\r\n";
		}

		// If the key exists but holds the wrong type, return an error.
		if (existing.type !== "list") {
			return simpleErrorResponse("WRONGTYPE Operation against a key holding the wrong kind of value");
		}

		// If the key is a list, parse it and return its length.
		try {
			const list: string[] = JSON.parse(existing.value);
			return `:${list.length}\r\n`;
		} catch (e) {
			return simpleErrorResponse("internal error - invalid list format");
		}
	}
}
