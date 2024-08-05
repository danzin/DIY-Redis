
import { redisStore } from "./main";
import { StoreValue, StreamEntry } from "./types";
import net from 'net';
import { bulkStringResponse, createExpirationDate, isExpired, parseStreamEntries, simpleErrorResponse, simpleStringResponse } from "./utilities";



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
    storeValue["expiration"] = createExpirationDate(Number(time));
  };

  redisStore.set(key,storeValue.value, storeValue.type);
  return simpleStringResponse("OK");
};

export const handleGetCommand = async (args: string[]): Promise<string> => {
  if(args.length !== 1 ) return "-ERR Wrong number of arguments for GET\r\n";

  const key = args[0];
  const value = redisStore.get(key);

  if(!value) return bulkStringResponse();
  if (isExpired(value?.expiration)) {
    redisStore.delete(key);
    return bulkStringResponse();
  };

  console.log('bulkStringResponse',bulkStringResponse(value.value))
  return bulkStringResponse(value.value);
};

export const handleTypeCommand = async (args: string[]): Promise<string> => {
  if(args.length < 1) return `wrong number of arguments for TYPE`;

  const storeValue = redisStore.get(args[0]);
  if(!storeValue) return simpleStringResponse("none");
    console.log(storeValue);
  return simpleStringResponse((storeValue.type))

}
