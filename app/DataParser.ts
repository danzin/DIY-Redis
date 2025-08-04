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

    const isRespMetadata = (item: string): boolean => {
      if (item.length < 2) return false;
      
      const prefix = item[0];
      if (prefix !== '*' && prefix !== '$') {
        return false; 
      }
      return !isNaN(parseInt(item.substring(1), 10));
    };

    // Filter the raw data array, keeping only items that are NOT metadata.
    return this.arr.filter(item => item && !isRespMetadata(item));
  }
}
