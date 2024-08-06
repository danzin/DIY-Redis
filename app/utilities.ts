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

// /**
//  * Turns an array into a RESP array
//  * @param arr - the input array being converted into RESP array
//  * @returns RESP array version of the initial array
//  */
// export const RESPArray = (arr: string[]) => {
//   const length = arr.length;
//   //returns '*0\r\n' if the array is empty
//   return length == 0 ? '*0\r\n' : 
//   //arr.reduce goes over all elements in the array with an accumulator - 'acc' with initial value " `*${len}\r\n` "
//   //every other element of the array (curr) is concatenated to the accumulator through the bulkString function transformation
//   //the operation produces a valid RESP Array
//     arr.reduce((acc: string, curr: string) => {
//       acc += bulkString(curr);
//       return acc;
//     }, `*${length}\r\n`);
// }



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
  startNum: number,
  endNum?: number
) => {
  let result: StreamEntry[] = [];
  if (endNum === undefined) {
    endNum = Infinity;
    let [int, dec] = String(startNum).split(".");
    startNum = +int + +`0.${1 + Number(dec) || 0}`;
  }

  console.log(`fetching entries from ${startNum} to ${endNum}`);
  for (let [entryId, entryData] of entries) {
    const entryIdNum = +entryId.replace("-", ".");

    if (entryIdNum >= startNum && entryIdNum <= endNum)
      result.push([entryId, entryData]);
  }
  return result;
}