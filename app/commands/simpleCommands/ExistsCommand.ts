import { RedisStore } from "../../store/RedisStore";
import { isExpired, simpleErrorResponse } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class ExistsCommand implements ISimpleCommand {
  readonly type = 'simple';
constructor(private redisStore: RedisStore) {}

  async execute(args: string[]): Promise<string> {
    if (args.length < 1) {
        return simpleErrorResponse("wrong number of arguments for 'exists' command");
      }

      let count = 0;
      for (const key of args) {
        // check for the key and also ensure it's not expired.
        const value = this.redisStore.get(key);
        if (value && !isExpired(value.expiration)) {
          count++;
        }
      }

      return `:${count}\r\n`;
  }
}