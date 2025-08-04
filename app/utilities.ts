import { StreamEntry } from "./types";

export const simpleErrorResponse = (reply: string) => `-ERR ${reply}\r\n`;
export const bulkStringResponse = (reply?:string) => reply ? `$${reply.length}\r\n${reply}\r\n` : `$-1\r\n`;
export const simpleStringResponse = (reply:string) => `+${reply}\r\n`;
export const simpleInt = (reply: number) => `:${reply}\r\n`;

export function generateEntryId(
  newEntryId: string,
  oldEntryId?: string
): string | null {
  if (newEntryId === "*") newEntryId = `${Date.now()}-*`;
  const [new_millisecondsTime, new_sequenceNumber] = newEntryId?.split("-");
  if (!oldEntryId) {
    if (new_sequenceNumber != "*") {
      return newEntryId;
    }
    return [new_millisecondsTime, new_millisecondsTime == "0" ? 1 : 0].join(
      "-"
    );
  }

  const [old_millisecondsTime, old_sequenceNumber] = oldEntryId?.split("-");

  if (old_millisecondsTime === new_millisecondsTime) {
    if (new_sequenceNumber == "*")
      return [new_millisecondsTime, +old_sequenceNumber + 1].join("-");
    return old_sequenceNumber < new_sequenceNumber ? newEntryId : null;
  }

  if (old_millisecondsTime > new_millisecondsTime) return null;
  if (new_sequenceNumber == "*") return [new_millisecondsTime, 0].join("-");
  return newEntryId;
}

export const regxStreamId = new RegExp(/^(?:\d+)-(?:\d+|\*)$|^\*$/);

export function parseStreamEntries(parts: string[]): StreamEntry | null {
  // Extract the entry ID
  const [entryId, ...rest] = parts;
  if (entryId === "0-0") return null;
  if (!regxStreamId.test(entryId)) return null;
  return [entryId, rest];
}

export function createExpirationDate(milliseconds: number): Date {
  const currentDate = new Date();
  if (!milliseconds) return currentDate;
  const expirationTime = currentDate.getTime() + milliseconds;
  const expirationDate = new Date(expirationTime);
  return expirationDate;
}

export const isExpired = (expiration?:Date): boolean => {
  return !expiration ? false : new Date() > expiration;
}

export function toRESPEntryArray(data: StreamEntry[]): string {
  let respArray: string[] = [];
  respArray.push(`*${data.length}\r\n`);
  for (const entry of data) {
    const [id, keyValues] = entry;
    respArray.push(`*2\r\n`);
    respArray.push(`$${id.length}\r\n${id}\r\n`);
    respArray.push(`*${keyValues.length}\r\n`);

    for (let i = 0; i < keyValues.length; i += 2) {
      const key = keyValues[i];
      const value = keyValues[i + 1];
      respArray.push(`$${key.length}\r\n${key}\r\n`);
      respArray.push(`$${value.length}\r\n${value}\r\n`);
    }
  }

  return respArray.join("");
}
export function toRESPStreamArray(streamArr: [string, StreamEntry[]][]) {
  return `*${streamArr.length}\r\n${streamArr.map(([streamKey, streamData]) => {
      return `*2\r\n$${streamKey.length}\r\n${streamKey}\r\n${toRESPEntryArray(streamData)}`;
    }).join("")}`;
}

export const getEntryRange = (
  entries: StreamEntry[],
  startId: string,
  endId?: string
): StreamEntry[] => {
  return entries.filter((entry) => {
    const [entryMs, entrySeq] = entry[0].split("-").map(Number);

    if (endId) {
      // Logic for XRANGE (inclusive start and end)
      let currentStartId = startId === "-" ? "0-0" : startId;
      let currentEndId = endId === "+" ? "9999999999999-9999999" : endId; // Effectively infinity

      const [startMs, startSeq] = currentStartId.split("-").map(Number);
      const [endMs, endSeq] = currentEndId.split("-").map(Number);

      const afterOrOnStart = entryMs > startMs || (entryMs === startMs && entrySeq >= startSeq);
      const beforeOrOnEnd = entryMs < endMs || (entryMs === endMs && entrySeq <= endSeq);

      return afterOrOnStart && beforeOrOnEnd;
    } else {
      // Logic for XREAD (strictly after startId)
      const [startMs, startSeq] = startId.split("-").map(Number);
      const isAfterStart = entryMs > startMs || (entryMs === startMs && entrySeq > startSeq);
      return isAfterStart;
    }
  });
};