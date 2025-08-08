import { RedisStore } from "../../store/RedisStore";
import { StreamEntry } from "../../types";
import { bulkStringResponse, generateEntryId, parseStreamEntries, simpleErrorResponse } from "../../utilities";
import { ISimpleCommand } from "../ICommand";
import { StreamEventManager } from "../StreamEventManager";

export class XaddCommand implements ISimpleCommand {
  readonly type = 'simple';
  
  constructor(
    private redisStore: RedisStore,
    private streamEventManager: StreamEventManager
  ) {}
  
  async execute(args: string[]): Promise<string> {
    if (args.length < 4) {
      return simpleErrorResponse("wrong number of arguments for 'xadd' command");
    }
    const [streamKey, ...rest] = args;
    const newStreamEntry = parseStreamEntries(rest);
    if (!newStreamEntry) {
      return simpleErrorResponse("The ID specified in XADD must be greater than 0-0");
    }

    const oldStream = this.redisStore.get(streamKey);

    if (oldStream) {
      if (oldStream.type !== "stream") {
        return simpleErrorResponse("WRONGTYPE Operation against a key holding the wrong kind of value");
      }
      let oldStreamEntries: StreamEntry[];
      try {
        oldStreamEntries = JSON.parse(oldStream.value) as StreamEntry[];
      } catch (e) {
        console.error("Failed to parse oldStream.value:", oldStream.value, e);
        return simpleErrorResponse("Internal error parsing stream data");
      }
      const lastStreamEntry = oldStreamEntries?.at(-1)!;
      const newEntryId = generateEntryId(newStreamEntry[0], lastStreamEntry[0]);
      if (newEntryId === null) {
        return simpleErrorResponse("The ID specified in XADD is equal or smaller than the target stream top item");
      }

      newStreamEntry[0] = newEntryId;
      const newStreamValue = [...oldStreamEntries, newStreamEntry];
      this.redisStore.set(streamKey, JSON.stringify(newStreamValue), "stream", oldStream.expiration);

      this.streamEventManager.notifyNewEntry(streamKey);
      return bulkStringResponse(newEntryId);
    }

    const newEntryId = generateEntryId(newStreamEntry[0])!;
    newStreamEntry[0] = newEntryId;
    this.redisStore.set(streamKey, JSON.stringify([newStreamEntry]), "stream");

    this.streamEventManager.notifyNewEntry(streamKey);
    return bulkStringResponse(newEntryId);
  }
}
