import { RedisStore } from "../../store/RedisStore";
import { simpleErrorResponse } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class IncrCommand implements ISimpleCommand {
  readonly type = 'simple';
  
  constructor(private redisStore: RedisStore) {}
  
  async execute(args: string[]): Promise<string> {
    if (args.length !== 1) {
      return simpleErrorResponse("wrong number of arguments for 'incr' command");
    }

    const key = args[0];
    const existing = this.redisStore.get(key);

    if (!existing) {
      // Set the value to 1 and return 1.
      this.redisStore.set(key, '1', 'string');
      return ":1\r\n";
    }

    //Parse the existing string value to an integer.
    const numericValue = parseInt(existing.value, 10);
    
    // Check if the parsing failed - value isn't a valid int
    if (isNaN(numericValue)) {
      return simpleErrorResponse("value is not an integer or out of range");
    }
    
    //Increment the value.
    const newValue = numericValue + 1;

    //Set the new value back into the store, preserving the original expiration.
    this.redisStore.set(key, newValue.toString(), 'string', existing.expiration);

    //Return the new value as a RESP Integer.
    return `:${newValue}\r\n`;
  }
}
