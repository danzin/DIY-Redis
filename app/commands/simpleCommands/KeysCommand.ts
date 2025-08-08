import { RedisStore } from "../../store/RedisStore";
import { toRESPArray } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class KeysCommand implements ISimpleCommand {
	readonly type = "simple";

	constructor(private redisStore: RedisStore) {}

	async execute(args: string[]): Promise<string> {
		const pattern = args[0];

		if (pattern === "*") {
			const allKeys = this.redisStore.getKeys();
			return toRESPArray(allKeys);
		}
		return toRESPArray([]); // Return empty array for other patterns
	}
}
