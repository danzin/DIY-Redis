import net from 'net';
import { StreamEntry } from "./types";


export const simpleErrorResponse = (reply: string) => `-ERR ${reply}\r\n`;
export const bulkStringResponse = (reply?:string) => reply ? `$${reply.length}\r\n${reply}\r\n` : `$-1\r\n`;
export const simpleStringResponse = (reply:string) => `+${reply}\r\n`;

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
