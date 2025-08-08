import { RedisStore } from "../../store/RedisStore";
import { ISimpleCommand } from "../ICommand";

export class DelCommand implements ISimpleCommand {
  readonly type = 'simple';
  constructor(private redisStore: RedisStore){}

  async execute(args: string[]): Promise<string> {
		if (args.length === 0) {
			return "-ERR wrong number of arguments for 'del' command\r\n";
		}
		let deletedCount = 0;
		for (const key of args) {
			if (this.redisStore.delete(key)) {
				deletedCount++;
			}
		}
		return `:${deletedCount}\r\n`;

  }

}