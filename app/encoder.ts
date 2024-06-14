import { CommonRequestCommands } from "./commands";

export function encodeRedisResponse(
  commandType: CommonRequestCommands,
  data: any
): string {
  switch (commandType) {
    case CommonRequestCommands.GET:
    case CommonRequestCommands.SET:
    case CommonRequestCommands.TYPE:
    case CommonRequestCommands.XADD:
    case CommonRequestCommands.GETSTR:

    case CommonRequestCommands.PING:
      return simpleStringEconded(data);
    case CommonRequestCommands.ECHO:
      return bulkResponseEncoded(data);
  }

  return "$-1\r\n";

}

function simpleStringEconded(data: string) {
  if (!data) return "$-1\r\n";

  return `+${data}\r\n`;
}

function bulkResponseEncoded(data: string[]) {
  if (!data) return "$-1\r\n";

  const bulkString = data.join("");

  console.log(`$${bulkString.length}\r\n${bulkString}\r\n`, "bulks");
  return `$${bulkString.length}\r\n${bulkString}\r\n`;

}