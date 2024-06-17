import { CommonRequestCommands } from "./commands";

export enum RESPDataType {
  SimpleString,
  SimpleErrors,
  Integers,
  BulkStrings,
  Array,
  Nulls,
  Booleans,
  Doubles,
  BigNumbers,
  BulkErrors,
  VerbatimStrings,
  Maps,
  Sets,
  Pushes,
  Unknown,
}

export class DataParser {
  private readonly data: Buffer;
  dataType: RESPDataType = RESPDataType.Unknown;
  parsedData: any;

  constructor(data: Buffer) {
    this.data = data;
    this.defineDataType();
    this.parsedData = this.parseData(); // Assign parsed data here
  }

  private defineDataType() {
    const firstByte = String.fromCharCode(this.data[0]);

    switch (firstByte) {
      case "+":
        this.dataType = RESPDataType.SimpleString;
        break;
      case "-":
        this.dataType = RESPDataType.SimpleErrors;
        break;
      case ":":
        this.dataType = RESPDataType.Integers;
        break;
      case "$":
        this.dataType = RESPDataType.BulkStrings;
        break;
      case "*":
        this.dataType = RESPDataType.Array;
        break;
      case "_":
        this.dataType = RESPDataType.Nulls;
        break;
      case "#":
        this.dataType = RESPDataType.Booleans;
        break;
      case ",":
        this.dataType = RESPDataType.Doubles;
        break;
      case "(":
        this.dataType = RESPDataType.BigNumbers;
        break;
      case "!":
        this.dataType = RESPDataType.BulkErrors;
        break;
      case "=":
        this.dataType = RESPDataType.VerbatimStrings;
        break;
      case "%":
        this.dataType = RESPDataType.Maps;
        break;
      case "~":
        this.dataType = RESPDataType.Sets;
        break;
      case ">":
        this.dataType = RESPDataType.Pushes;
        break;
      default:
        this.dataType = RESPDataType.Unknown;
    }
  }

  private parseData(): any {
    switch (this.dataType) {
      case RESPDataType.SimpleString:
        return this.parseDataAsSimpleString();
      case RESPDataType.BulkStrings:
        return this.bulkStringParser();
      case RESPDataType.Array:
        return this.parseDataAsArray();
      default:
        return null;
    }
  }

  private parseDataAsSimpleString() {
    const result = this.data.slice(1, -2).toString();
    return result;
  }

  private bulkStringParser() {
    const length = parseInt(this.data.slice(1, this.data.indexOf('\r\n')).toString(), 10);
    const content = this.data.slice(this.data.indexOf('\r\n') + 2, this.data.indexOf('\r\n') + 2 + length).toString();
    return [content];
  }

  private parseDataAsArray() {
    const dataAsString = this.data.toString("ascii");
    const pattern = /\$\d+\r\n([^\r\n]+)/g;
    const matches = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(dataAsString)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  getCommand() {
    if (!this.parsedData || !Array.isArray(this.parsedData) || this.parsedData.length === 0) {
      console.error('Parsed data is empty or invalid:', this.parsedData);
      return null;
    }
    const [command] = this.parsedData as string[];
    const trimmedCmd = command.toUpperCase();
    console.log(trimmedCmd)
    return trimmedCmd;
  }

  getPayload() {
    if (!this.parsedData || !Array.isArray(this.parsedData) || this.parsedData.length < 2) {
      return null;
    }
    const [_, ...payload] = this.parsedData;
    return payload
  }
}
