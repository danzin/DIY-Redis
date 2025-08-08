import { RedisStore } from "../../store/RedisStore";
import { StreamEntry } from "../../types";
import { bulkStringResponse, getEntryRange, simpleErrorResponse, toRESPStreamArray } from "../../utilities";
import { ISimpleCommand } from "../ICommand";
import { StreamEventManager } from "../StreamEventManager";

export class XreadCommand implements ISimpleCommand {
  readonly type = 'simple';
  
  constructor(
    private redisStore: RedisStore,
    private streamEventManager: StreamEventManager
  ) {}
  
  async execute(args: string[]): Promise<string> {
    const blockIndex = args.findIndex((arg) => arg.toLowerCase() === "block");
    let timeout = 0;
    let streamsIndex = -1;

    if (blockIndex !== -1) {
      if (args.length < blockIndex + 3) {
        return simpleErrorResponse("wrong number of arguments for 'xread' command with BLOCK");
      }
      const timeoutStr = args[blockIndex + 1];
      if (isNaN(parseInt(timeoutStr, 10)) || parseInt(timeoutStr, 10) < 0) {
        return simpleErrorResponse("ERR timeout is negative");
      }
      timeout = parseInt(timeoutStr, 10);
      streamsIndex = blockIndex + 2;
    } else {
      streamsIndex = args.findIndex((arg) => arg.toLowerCase() === "streams");
    }

    if (streamsIndex === -1 || args[streamsIndex].toLowerCase() !== "streams" || streamsIndex + 1 >= args.length) {
      return simpleErrorResponse("wrong number of arguments for 'xread' command");
    }

    const streamKeysAndIds = args.slice(streamsIndex + 1);
    const numStreams = streamKeysAndIds.length / 2;
    if (streamKeysAndIds.length % 2 !== 0) {
      return simpleErrorResponse("Unbalanced list of streams and IDs in XREAD");
    }

    const streamKeys = streamKeysAndIds.slice(0, numStreams);
    const originalStreamIds = streamKeysAndIds.slice(numStreams);

    const processXRead = (startIds: string[]) => {
      const results: [string, StreamEntry[]][] = [];
      let hasNewData = false;
      for (let i = 0; i < numStreams; i++) {
        const key = streamKeys[i];
        const startId = startIds[i];
        const stream = this.redisStore.get(key);

        if (stream) {
          const streamEntries = JSON.parse(stream.value) as StreamEntry[];
          const entries = getEntryRange(streamEntries, startId);
          if (entries.length > 0) {
            hasNewData = true;
            results.push([key, entries]);
          }
        }
      }
      return { results, hasNewData };
    };

    if (blockIndex === -1) {
      // Non-blocking logic
      if (originalStreamIds.includes("$")) {
        return simpleErrorResponse("ERR The $ ID is only valid in the context of BLOCK");
      }
      const { results } = processXRead(originalStreamIds);
      if (results.length === 0) {
        return bulkStringResponse();
      }
      return toRESPStreamArray(results);
    } else {
      // --- BLOCKING LOGIC ---

      const resolvedStreamIds = originalStreamIds.map((id, i) => {
        if (id === "$") {
          const key = streamKeys[i];
          const stream = this.redisStore.get(key);
          if (stream) {
            const streamEntries = JSON.parse(stream.value) as StreamEntry[];
            return streamEntries.length > 0 ? streamEntries[streamEntries.length - 1][0] : "0-0";
          }
          return "0-0"; // If stream doesn't exist, start from the beginning
        }
        return id;
      });

      const initialCheck = processXRead(resolvedStreamIds);
      if (initialCheck.hasNewData) {
        return toRESPStreamArray(initialCheck.results);
      }

      return new Promise((resolve) => {
        let timeoutId: NodeJS.Timeout | null = null;

        const onNewEntry = (streamKey: string) => {
          if (streamKeys.includes(streamKey)) {
            // Use the same resolved IDs for the check
            const { results, hasNewData } = processXRead(resolvedStreamIds);
            if (hasNewData) {
              if (timeoutId) clearTimeout(timeoutId);
              this.streamEventManager.removeListener("new-entry", onNewEntry);
              resolve(toRESPStreamArray(results));
            }
          }
        };

        this.streamEventManager.on("new-entry", onNewEntry);

        if (timeout > 0) {
          timeoutId = setTimeout(() => {
            this.streamEventManager.removeListener("new-entry", onNewEntry);
            resolve(bulkStringResponse()); // (nil)
          }, timeout);
        }
        // If timeout is 0, wait until the listener eventually resolves it
      });
    }
  }
}
