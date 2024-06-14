export class DataStorage {
  private dataMap: Map<string, any>;
  private streams: Map<string, Map<string, any>>;

  constructor() {
    this.dataMap = new Map();
    this.streams = new Map();
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

    let stream = this.streams.get(streamKey);
    if (!stream) {
      stream = new Map();
      this.streams.set(streamKey, stream);
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
