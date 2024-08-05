// import { CommonRequestCommands } from "./commands";
// import net from 'net';
// import { arrays, nullBulkString, integer, simpleError, unknownCommand, simpleStringResponse } from './utilities';

// interface EncodeRedisResponseOptions {
//   connection: net.Socket,
//   commandType: CommonRequestCommands;
//   key?: string;
//   value?: any;
//   px?: number;
//   time?: number;
//   streamKey?: any;
// } 

// export function encodeRedisResponse({
//   connection,
//   commandType,
//   key = '',
//   value,
//   px,
//   time,
//   streamKey,
// }: EncodeRedisResponseOptions): void {
//   switch (commandType) {
//     case CommonRequestCommands.GET:
//       bulkString(key);
//     case CommonRequestCommands.SET:
//       simpleStringResponse( 'OK');
//     case CommonRequestCommands.TYPE:
//       simpleStringResponse(connection, key);
//       break;
//     case CommonRequestCommands.XADD:
//       arrays(value);
//       break;
//     case CommonRequestCommands.PING:
//       simpleStringResponse(connection, 'PONG');
//       break;
//     case CommonRequestCommands.ECHO:
//       simpleStringResponse(connection, key)
//       break;
//     case CommonRequestCommands.XRANGE:
//       // Handle XRANGE if needed
//       break;
//     case CommonRequestCommands.XREAD:
//       // Handle XREAD if needed
//       break;
//     case CommonRequestCommands.NULL:
//       nullBulkString()
//     case CommonRequestCommands.UNKNOWN:
//       unknownCommand()
//     case CommonRequestCommands.SERR:
//       simpleError(connection, 'Error')
//   }
// }

// const bulkString=(str:string)=>`$${str.length}\r\n${str}\r\n`; 
// export function arrToRESP(arr: string[]) {
//   const len = arr.length;
//   if (len == 0) return "*0\r\n";
//   return arr.reduce((acc: string, cur: string) => {
//     acc += bulkString(cur);
//     return acc;
//   }, `*${len}\r\n`);
// }



// // export function encodeRedisResponse(
// //   connection: net.Socket,
// //   commandType: CommonRequestCommands,
// //   key?: string,
// //   value?: any,
// //   px?: number,
// //   time?: number,
// //   streamKey?: any,
// // ): string {
// //   switch (commandType) {
// //     case CommonRequestCommands.GET:
// //     case CommonRequestCommands.SET:
// //     case CommonRequestCommands.TYPE:
// //       // return simpleStringResponseEncoded(data)
// //     case CommonRequestCommands.XADD:
// //       // return bulkResponseEncoded(data);
// //     case CommonRequestCommands.PING:
// //        simpleStringResponse(connection, "PONG");
// //     case CommonRequestCommands.ECHO:
// //         bulkString(connection, key)
// //     case CommonRequestCommands.XRANGE:
// //       // return encodeXRangeResponse(data);
// //     case CommonRequestCommands.XREAD:
// //       // return encodedXreadResponse(streamKey, data);
// //   }

// //   return "$-1\r\n";
// // }

// // function simpleStringResponseEncoded(data: string) {
// //   if (!data) return "$-1\r\n";
// //   return `+${data}\r\n`;
// // }
// // function bulkResponseEncoded(data: string[]) {
// //   if (!data) return "$-1\r\n";
  
// //   const bulkString = data.join("");
// //   return `$${bulkString.length}\r\n${bulkString}\r\n`;
// // }

// // function encodeXRangeResponse(data: Array<[string, any]>): string {
// //   if (!data || !Array.isArray(data)) {
// //     return "*-1\r\n"; 
// //   }

// //   const encodedEntries = data.map(([id, fields]) => {
// //     const fieldEntries = Object.entries(fields).map(([key, value]) => {
// //       return `$${key.length}\r\n${key}\r\n$${value.length}\r\n${value}\r\n`;
// //     }).join('');
// //     return `*2\r\n$${id.length}\r\n${id}\r\n*${Object.entries(fields).length * 2}\r\n${fieldEntries}`;
// //   }).join('');

// //   const result = `*${data.length}\r\n${encodedEntries}`;
    
// //   return result;
// // }

// // function encodedXreadResponse(streamKey: string, data: Array<[string, any]>): string {
// //   if (!data || !Array.isArray(data) || data.length === 0) {
// //     return "*-1\r\n";
// //   }

// //   const encodedEntries = data.map(([id, fields]) => {
// //     const fieldEntries = Object.entries(fields).map(([key, value]) => {
// //       return `$${key.length}\r\n${key}\r\n$${value.length}\r\n${value}\r\n`;
// //     }).join('');
// //     return `*2\r\n$${id.length}\r\n${id}\r\n*${Object.entries(fields).length * 2}\r\n${fieldEntries}`;
// //   }).join('');

// //   const result = `*1\r\n*2\r\n$${streamKey.length}\r\n${streamKey}\r\n*${data.length}\r\n${encodedEntries}`;

// //   return result;
// // }
