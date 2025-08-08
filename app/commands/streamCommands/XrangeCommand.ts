import { RedisStore } from "../../store/RedisStore";
import { StreamEntry } from "../../types";
import { getEntryRange, simpleErrorResponse, toRESPEntryArray } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class XrangeCommand implements ISimpleCommand {
  readonly type = 'simple';
  
  constructor(private redisStore: RedisStore) {}
  
  async execute(args: string[]): Promise<string> {
    if (args.length < 3) {
      return simpleErrorResponse("wrong number of arguments for 'xrange' command");
    }
    const [streamKey, start, end] = args;
    const storedStream = this.redisStore.get(streamKey)?.value;

    // If the stream doesn't exist, return an empty array as per standard Redis behavior
    if (!storedStream) {
      return toRESPEntryArray([]);
    }

    const streamEntries = JSON.parse(storedStream) as StreamEntry[];

    // The getEntryRange function is sufficient to handle all cases,
    // including invalid ranges (start > end), which will correctly result
    // in an empty array
    const result = getEntryRange(streamEntries, start, end);

    return toRESPEntryArray(result);
  }
}
