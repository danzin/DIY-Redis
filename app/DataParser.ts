import { CommonRequestCommands } from "./commands";

enum RESPDataType {
  Unknown,
  Simple,
  Complex,
}

// Mapping function to convert the 'string' command to CommandRequestCommands
// before passing it to classifyComnmand
// so TypeScrit will stop crying about it
const commandStringToEnum: { [key: string]: CommonRequestCommands } = {
  GET: CommonRequestCommands.GET,
  SET: CommonRequestCommands.SET,
  TYPE: CommonRequestCommands.TYPE,
  ECHO: CommonRequestCommands.ECHO,
  PING: CommonRequestCommands.PING,
  XADD: CommonRequestCommands.XADD,
  XREAD: CommonRequestCommands.XREAD,
  XRANGE: CommonRequestCommands.XRANGE,
};


export class DataParser {
  private readonly arr: string[];
  dataType: RESPDataType = RESPDataType.Unknown;
  parsedData: any;

  constructor(data: Buffer) {
    this.arr = this.parseBuffer(data);
    // this.parsedData = this.getPayload();
  }

  private parseBuffer = (data: Buffer): string[] => {
    return data.toString().split("\r\n");
  }

  getReceivedData() {
    return this.arr.filter((string) => string)
  }
  getPayload() {
    const command = this.arr.filter((item) => !item.startsWith('*') && !item.startsWith('$')).filter((string) => string);;
    return command
  }

 
}











// import { CommonRequestCommands } from "./commands";

// export enum RESPDataType {
//   simpleStringResponse,
//   SimpleErrors,
//   Integers,
//   BulkStrings,
//   Array,
//   Nulls,
//   Booleans,
//   Doubles,
//   BigNumbers,
//   BulkErrors,
//   VerbatimStrings,
//   Maps,
//   Sets,
//   Pushes,
//   Unknown,
// }

// export class DataParser {

//   private readonly arr: string[];
//   dataType: RESPDataType = RESPDataType.Unknown;
//   parsedData: any;

//   constructor(data: Buffer) {
//     this.arr = this.parseBuffer(data);
     
//   }

//   private parseBuffer=(data:Buffer):string[]=>{return data.toString().split("\r\n")}

//   getCommand() {
//     const command = this.arr[2];
//     console.log('command: ', command)
//     return command;
//   }
  
//   getPayload() {

//   }


//   getKey() {
//     const key = this.arr[4];
//     console.log('key: ', key);
//     return key;
//   }

//   getValue() {
//     const value = this.arr[6];
//     console.log('value: ', value);
//     return value;
//   }

//   getPx() {
//     const px = this.arr[8];
//     console.log('px: ', px);
//     return px;
//   }

//   getTime() { 
//     const time = this.arr[10];
//     console.log('time: ', time);
//     return time;
//   }


// }
