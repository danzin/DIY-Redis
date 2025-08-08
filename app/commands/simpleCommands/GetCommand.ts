import { RedisStore } from "../../store/RedisStore";
import { bulkStringResponse } from "../../utilities";
import { ISimpleCommand } from "../ICommand";
import { isExpired } from "../../utilities";

export class GetCommand implements ISimpleCommand {
	public readonly type = "simple";

	constructor(private redisStore: RedisStore) {}

	public async execute(args: string[]): Promise<string> {
		if (args.length !== 1) return "-ERR Wrong number of arguments for GET\r\n";

		const key = args[0];
		const value = this.redisStore.get(key);

		// If no value is found in the store, return nil immediately.
		if (!value) {
			return bulkStringResponse();
		}

		if (isExpired(value.expiration)) {
			this.redisStore.delete(key);
			return bulkStringResponse();
		}
		return bulkStringResponse(value.value);
	}
}
