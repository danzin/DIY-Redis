import { RedisStore } from "../../store/RedisStore";
import { createExpirationDate, simpleErrorResponse } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class ExpireCommand implements ISimpleCommand {
  readonly type = 'simple';
  constructor(private redisStore: RedisStore) {}
  async execute(args: string[]): Promise<string> {
    if (args.length !== 2) {
      return simpleErrorResponse("wrong number of arguments for 'expire' command");
    }
  
    const [key, secondsStr] = args;
    const existing = this.redisStore.get(key);

    if (!existing) {
      return ":0\r\n"; // Key does not exist
    }

    const seconds = parseInt(secondsStr, 10);
    if (isNaN(seconds)) {
      return simpleErrorResponse("value is not an integer or out of range");
    }

    const newExpiration = createExpirationDate(seconds * 1000);
    this.redisStore.set(key, existing.value, existing.type, newExpiration);

    return ":1\r\n"; // Expiration was set
  }
}