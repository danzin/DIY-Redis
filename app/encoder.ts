import { CommonRequestCommands } from "./commands";

export function encodeRedisResponse(
  commandType: CommonRequestCommands,
  data: any
): string {
  switch (commandType) {
    case CommonRequestCommands.GET:
    case CommonRequestCommands.SET:
    case CommonRequestCommands.TYPE:
      return simpleStringEncoded(data)
    case CommonRequestCommands.XADD:
      return bulkResponseEncoded(data);
    case CommonRequestCommands.GETSTR:
    case CommonRequestCommands.PING:
      return simpleStringEncoded(data);
    case CommonRequestCommands.ECHO:
      return bulkResponseEncoded(data);
    case CommonRequestCommands.XRANGE:
      return encodeXRangeResponse(data);
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

function encodeXRangeResponse(data: [string, any][]): string {
  let response = `*${data.length}\r\n`;
  data.forEach(([id, entry]) => {
    response += `*2\r\n$${id.length}\r\n${id}\r\n`;

    const entryArray = Object.entries(entry).flat();
    response += `*${entryArray.length}\r\n`;

    entryArray.forEach((item: string) => {
      response += `$${item.length}\r\n${item}\r\n`;
    });
  });
  return response;
}