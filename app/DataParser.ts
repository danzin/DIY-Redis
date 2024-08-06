export class DataParser {
  private readonly arr: string[];
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
    const command = this.arr.slice(1).filter((item) =>!item.startsWith('$')).filter((string) => string);
    // const command = this.arr.filter((item) => !item.startsWith('*') && !item.startsWith('$')).filter((string) => string);
    return command
  }

 
}










