export class DataStorage {
  private dataMap: Map<string, any>;
  private streams: Map<string, Map<string, any>>;

  constructor() {
    this.dataMap = new Map();
    this.streams = new Map();
  }

  private parseId(id: string) {
    const [millisecondsTime, sequenceNumber] = id.split('-').map(Number);
    if (isNaN(millisecondsTime) || isNaN(sequenceNumber)) {
      throw new Error("Invalid ID format");
    }
    return { millisecondsTime, sequenceNumber };
  }

  private getLastEntryId(stream: Map<string, any>) {
    if (stream.size === 0) {
      return { millisecondsTime: 0, sequenceNumber: 0 };
    }

    const lastEntryId = Array.from(stream.keys()).pop();
    return this.parseId(lastEntryId!);
  }



  set(key: string, value: any, command: string, time: string) {
    console.log(`Setting value: ${value} for key: ${key} with ttl of ${Number(time)}`);
    this.dataMap.set(key, value);

    if (!command) return;
    if (command.toUpperCase() !== 'PX') return;

    const timeout = Number(time);
    setTimeout(() => {
      this.dataMap.delete(key);
    }, timeout);
  }

  get(key: string) {
    const value = this.dataMap.get(key);
    console.log(`Getting value: ${value} for key: ${key}`);
    return value;
  }

  xadd(streamKey: string, id: string, ...fields: string[]) {
    if (fields.length % 2 !== 0) {
      throw new Error("Fields should be in key-value pairs");
    }
    
    // const currentDate: Date = new Date();
    // const timestamp: number = currentDate.getTime();
    // const incrementId: number = this.streams.size + 1;
    // const id: string = `${timestamp}-${incrementId}`

    let stream = this.streams.get(streamKey);
    if (!stream) {
      stream = new Map();
      this.streams.set(streamKey, stream);
    }
    const newId = this.parseId(id);
    const lastEntryId = this.getLastEntryId(stream);
    if (newId.millisecondsTime == 0 && newId.sequenceNumber == 0) {  throw new Error("The ID specified in XADD must be greater than 0-0"); }

    if (
      newId.millisecondsTime < lastEntryId.millisecondsTime ||
      (newId.millisecondsTime === lastEntryId.millisecondsTime && newId.sequenceNumber <= lastEntryId.sequenceNumber)
    ) {
      throw new Error("The ID specified in XADD is equal or smaller than the target stream top item");
    }
    const entry: { [key: string]: any } = {};
    for (let i = 0; i < fields.length; i += 2) {
      entry[fields[i]] = fields[i + 1];
    }

    stream.set(id, entry);
    console.log(`Added entry with id: ${id} to stream: ${streamKey}`);
  }

  getStreamEntries(streamKey: string) {
    return this.streams.get(streamKey) || new Map();
  }

  getType(key: string) {
    if (this.dataMap.has(key)) {
      return typeof this.dataMap.get(key);
    }
    if (this.streams.has(key)) {
      return 'stream';
    }
    return 'none';
  }
}
