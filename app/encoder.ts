import { CommonRequestCommands } from "./commands";

export function encodeRedisResponse(
  commandType: CommonRequestCommands,
  data: any,
  streamKey?: any,
): string {
  switch (commandType) {
    case CommonRequestCommands.GET:
    case CommonRequestCommands.SET:
    case CommonRequestCommands.TYPE:
      return simpleStringEncoded(data)
    case CommonRequestCommands.XADD:
      return bulkResponseEncoded(data);
    case CommonRequestCommands.PING:
      return simpleStringEncoded(data);
    case CommonRequestCommands.ECHO:
      return bulkResponseEncoded(data);
    case CommonRequestCommands.XRANGE:
      return encodeXRangeResponse(data);
    case CommonRequestCommands.XREAD:
      return encodedXreadResponse(streamKey, data);
  }

  return "$-1\r\n";
}

function simpleStringEncoded(data: string) {
  if (!data) return "$-1\r\n";
  return `+${data}\r\n`;
}

function bulkResponseEncoded(data: string[]) {
  if (!data) return "$-1\r\n";
  
  const bulkString = data.join("");
  return `$${bulkString.length}\r\n${bulkString}\r\n`;
}

function encodeXRangeResponse(data: Array<[string, any]>): string {
  if (!data || !Array.isArray(data)) {
    return "*-1\r\n"; 
  }

  const encodedEntries = data.map(([id, fields]) => {
    const fieldEntries = Object.entries(fields).map(([key, value]) => {
      return `$${key.length}\r\n${key}\r\n$${value.length}\r\n${value}\r\n`;
    }).join('');
    return `*2\r\n$${id.length}\r\n${id}\r\n*${Object.entries(fields).length * 2}\r\n${fieldEntries}`;
  }).join('');

  const result = `*${data.length}\r\n${encodedEntries}`;
    
  return result;
}

function encodedXreadResponse(streamKey: string, data: Array<[string, any]>): string {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return "*-1\r\n";
  }

  const encodedEntries = data.map(([id, fields]) => {
    const fieldEntries = Object.entries(fields).map(([key, value]) => {
      return `$${key.length}\r\n${key}\r\n$${value.length}\r\n${value}\r\n`;
    }).join('');
    return `*2\r\n$${id.length}\r\n${id}\r\n*${Object.entries(fields).length * 2}\r\n${fieldEntries}`;
  }).join('');

  const result = `*1\r\n*2\r\n$${streamKey.length}\r\n${streamKey}\r\n*${data.length}\r\n${encodedEntries}`;

  return result;
}
