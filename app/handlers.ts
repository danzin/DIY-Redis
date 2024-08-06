
import { redisStore } from "./main";
import { StoreValue, StreamEntry } from "./types";
import { bulkStringResponse, createExpirationDate, generateEntryId, getEntryRange, isExpired, parseStreamEntries, simpleErrorResponse, simpleStringResponse, toRESPEntryArray, toRESPStreamArray } from "./utilities";
import { EventEmitter } from 'events';

const streamEvents = new EventEmitter();

export const handleEchoCommand = (args: string[]) => {
  return args.length > 0 ? simpleStringResponse(args[0]) : simpleStringResponse('');
};

export const handlePingCommand = (args: string[]) => {
  return args.length > 0 ? simpleStringResponse(args[0]) : simpleStringResponse("PONG");
};

export const handleSetCommand = async (args: string[]): Promise<string> => {
  if(args.length < 2 ) return "-ERR Wrong number of arguments for SET\r\n";

  const [key, value, px, time] = args;
  const storeValue: StoreValue = {value, type: "string"};
  

  if (px?.toLowerCase() === 'px' && typeof Number(time) === "number"){
    storeValue.expiration = createExpirationDate(Number(time));
  };

  redisStore.set(key,storeValue.value, storeValue.type, storeValue.expiration);
  return simpleStringResponse("OK");
};

export const handleGetCommand = async (args: string[]): Promise<string> => {
  if(args.length !== 1 ) return "-ERR Wrong number of arguments for GET\r\n";

  const key = args[0];
  const value = redisStore.get(key);

  if(!value) return bulkStringResponse();
  return bulkStringResponse(value.value);
};

export const handleTypeCommand = async (args: string[]): Promise<string> => {
  if(args.length < 1) return `wrong number of arguments for TYPE`;

  const storeValue = redisStore.get(args[0]);
  if(!storeValue) return simpleStringResponse("none");
  return simpleStringResponse((storeValue.type))
}

export const handleXaddCommand = (args: string[]) => {
  if (args.length < 4)
    return simpleErrorResponse("wrong number of arguments for 'xadd' command");
  const [streamKey, ...rest] = args;
  const newStreamEntry = parseStreamEntries(rest);
  if (!newStreamEntry)
    return simpleErrorResponse("The ID specified in XADD must be greater than 0-0");

  const oldStream = redisStore.get(streamKey);
  console.log('oldStream:', oldStream)
  if (oldStream) {
    let oldStreamEntries: StreamEntry[];
    try {
      // Accessing the nested value property that contains the JSON string
      oldStreamEntries = JSON.parse(oldStream.value) as StreamEntry[];
    } catch (e) {
      console.error('Failed to parse oldStream.value:', oldStream.value, e);
      return simpleErrorResponse("Internal error parsing stream data");
    }
    const lastStreamEntry = oldStreamEntries?.at(-1)!;
    const newEntryId = generateEntryId(newStreamEntry[0], lastStreamEntry[0]);
    if (newEntryId === null)
      return simpleErrorResponse(
        "The ID specified in XADD is equal or smaller than the target stream top item"
      );
    newStreamEntry[0] = newEntryId;
    const newStreamValue = [...oldStreamEntries, newStreamEntry];
    redisStore.set(streamKey, JSON.stringify(newStreamValue),"stream", oldStream.expiration);

    // Emit event after adding new entry to the stream
    streamEvents.emit('new-entry', streamKey);

    return bulkStringResponse(newEntryId);
  }
  const newEntryId = generateEntryId(newStreamEntry[0])!;
  newStreamEntry[0] = newEntryId;
  redisStore.set(streamKey,JSON.stringify([newStreamEntry]), "stream");

  // Emit event after adding new entry to the stream
  streamEvents.emit('new-entry', streamKey);

  return bulkStringResponse(newEntryId);
}


export const handleXreadCommand = async(args: string[]) => {
  const isBlockCommand = args[0].toLowerCase() === "block";
  let timeout = 0;
  let keyValues: string[] = [];

  if (isBlockCommand) {
    const [_, time, _streams, ...rest] = args;
    timeout = Number(time);
    console.log(`Parsed timeout: ${timeout}`); // Debugging line
    keyValues = rest;
  } else {
    const [_, ...rest] = args;
    keyValues = rest;
  }

  if (keyValues.length % 2 !== 0) {
    return simpleErrorResponse("wrong number of arguments for 'xread' command");
  }

  
  if (isBlockCommand) {
    const streamKey = keyValues[0]; // Assuming the first key is the stream key
    console.log('streamKey:', streamKey)
    while (true) {
      console.log(`Timeout check: ${timeout !== 0}`); // Debugging line
      if (timeout !== 0) {
        console.log('we are here :(')
        await new Promise<void>(resolve => setTimeout(resolve, timeout));
      } else {
        // Wait for new entries indefinitely
        console.log('Waiting indefinitely for new entries...'); // Debugging line
        await new Promise<void>(resolve => streamEvents.once('new-entry', (updatedStreamKey: string) => {
          if (updatedStreamKey === streamKey) {
            resolve();
          }
        }));
      }
      const result = xreadHelper(keyValues);
      const [[_streamkey, data]] = result;

      if (timeout !== 0) {
        if (data.length === 0) return bulkStringResponse();
        return toRESPStreamArray(result);
      } else {
        if (data.length !== 0) return toRESPStreamArray(result);
      }
    }
  } else {
    return toRESPStreamArray(xreadHelper(keyValues));
  }
}

function xreadHelper(keyValues: string[]) {
  const halfLen = keyValues.length / 2;
  let result: [string, StreamEntry[]][] = [];

  for (let i = 0; i < halfLen; i++) {
    const streamKey = keyValues[i];
    let start = keyValues[i + halfLen];

    const storedStream = redisStore.get(streamKey)?.value;
    if (!storedStream) continue; 
    const streamEntries = JSON.parse(storedStream) as StreamEntry[];

    if (start === "$") {
      const [lastEntryId] = streamEntries.at(-1) || ["0-0"];
      keyValues[i + halfLen] = lastEntryId;
      start = lastEntryId;
    }
    const startNum = +start.replace("-", ".") || 0;

    result.push([streamKey, getEntryRange(streamEntries, startNum)]);
  }
  return result;
}

export const handleXrangeCommand = (args: string[]) => {
  if (args.length < 3)
    return simpleErrorResponse("wrong number of arguments for 'xrange' command");
  const [streamKey, ...rest] = args;
  const storedStream = redisStore.get(streamKey)?.value;
  if (!storedStream) return simpleErrorResponse("Stream doesn't exist");

  const [start, end] = rest;
  const startNum = +start.replace("-", ".") || 0;
  const endNum = +end.replace("-", ".") || Infinity;

  if (startNum > endNum)
    return simpleErrorResponse("The end ID must be greater than the start ID");

  const streamEntries = JSON.parse(storedStream) as StreamEntry[];
  const result = getEntryRange(streamEntries, startNum, endNum);
  return toRESPEntryArray(result);
}

const checkAndDeleteExpiredKeys = (): void => {
  const keys = redisStore.getKeys();
  keys.forEach((key) => {
    const value = redisStore.get(key);
    if (value && isExpired(value.expiration)) {
      redisStore.delete(key);
    }
  });
};

const startExpirationCheckTask = (interval: number): void => {
  setInterval(checkAndDeleteExpiredKeys, interval);
};
startExpirationCheckTask(1);

// Schedule the expiration check task to run every minute
// cron.schedule('*/1 * * * *', () => {
//   console.log('Running expiration check task');
//   checkAndDeleteExpiredKeys();
// });