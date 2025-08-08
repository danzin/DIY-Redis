import { RedisStore } from "../../store/RedisStore";
import { simpleStringResponse } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class TypeCommand implements ISimpleCommand {
	readonly type = "simple";
	constructor(private redisStore: RedisStore) {}

	async execute(args: string[]): Promise<string> {
		if (args.length < 1) return `wrong number of arguments for TYPE`;
		const storeValue = this.redisStore.get(args[0]);
		if (!storeValue) return simpleStringResponse("none");
		return simpleStringResponse(storeValue.type);
	}
}
