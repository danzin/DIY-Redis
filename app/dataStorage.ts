export class DataStorage {
  private dataMap: Map<string, any>;
  private streams: Map<string, Map<number, Map<number, any>>>;

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

    return this.dataMap.get(key);
  }

  private getLastSequenceNumber(stream: Map<number, Map<number, any>>, millisecondsTime: number): number {
    const sequenceMap = stream.get(millisecondsTime);
    if (!sequenceMap || sequenceMap.size === 0) {
      return millisecondsTime === 0 ? 0 : -1;
    }
    const lastSequenceNumber = Array.from(sequenceMap.keys()).pop();
    return lastSequenceNumber!;
  }

  private generateNextId(stream: Map<number, Map<number, any>>, millisecondsTime: number): string {
    const lastSequenceNumber = this.getLastSequenceNumber(stream, millisecondsTime);
      return `${millisecondsTime}-${lastSequenceNumber + 1}`;
  }

  xadd(streamKey: string, id: string, ...fields: string[]) {
    console.log(`xadd called with streamKey: ${streamKey}, id: ${id}, fields: ${fields}`);
    
    let stream = this.streams.get(streamKey);
    if (!stream) {
      stream = new Map();
      this.streams.set(streamKey, stream);
    }
  
    let newId: string;
    let millisecondsTime: number;
  
    if (id === "*") {
      millisecondsTime = Date.now();
      newId = this.generateNextId(stream, millisecondsTime);
    } else {
      const [millisecondsTimeStr, sequenceNumberStr] = id.split('-');
      millisecondsTime = Number(millisecondsTimeStr);
  
      if (isNaN(millisecondsTime)) {
        throw new Error('Invalid ID format');
      }
  
      if (sequenceNumberStr === '*') {
        newId = this.generateNextId(stream, millisecondsTime);
      } else {
        const sequenceNumber = Number(sequenceNumberStr);
        if (isNaN(sequenceNumber)) {
          throw new Error("Invalid ID format");
        }
        newId = `${millisecondsTime}-${sequenceNumber}`;
      }
    }
  
    const newSequenceNumber = Number(newId.split('-')[1]);
    const newMsTime = Number(newId.split('-')[0]);

    const sequenceMap = stream.get(millisecondsTime);

    if(newSequenceNumber == 0 && millisecondsTime == 0){
      throw new Error('The ID specified in XADD must be greater than 0-0')
    }
    if (!sequenceMap) {
      if((newMsTime == 0 && newSequenceNumber > 1 ) || (newMsTime >=1 && newSequenceNumber > 1)){
        throw new Error(`The ID specified in XADD is equal or smaller than the target stream top item`)
      }
    }else{
      for (let seq = millisecondsTime === 0 ? 1 : 1; seq < newSequenceNumber; seq++) {
        console.log(millisecondsTime,seq)

        if (!sequenceMap.has(seq)) {
          throw new Error(`Missing sequence number: ${seq} for millisecondsTime: ${millisecondsTime}`);
        }
      }
    }

    if ((stream.has(millisecondsTime) && stream.get(millisecondsTime)!.has(newSequenceNumber)) ) {
      throw new Error(`The ID specified in XADD is equal or smaller than the target stream top item`);
    }
    
    const entry: { [key: string]: any } = {};
    for (let i = 0; i < fields.length; i += 2) {
      entry[fields[i]] = fields[i + 1];
    }
  
    if (!stream.has(millisecondsTime)) {
      stream.set(millisecondsTime, new Map());
    }
    stream.get(millisecondsTime)!.set(newSequenceNumber, entry);

    console.log(`Added entry with id: ${newId} to stream: ${streamKey}`);
    return newId.split('');
  }

  xrange(streamKey: string, start: string, end: string) {

    const stream = this.streams.get(streamKey);
    if (!stream) {
      return [];
    }
    let startMsTime: number;
    let startSeqNum: number;
  
    if (start === '-') {
      startMsTime = 0;
      startSeqNum = 0;
    } else {
      startMsTime = Number(start.split('-')[0]);
      startSeqNum = Number(start.split('-')[1]);
    }
    const endMsTime = Number(end.split('-')[0]);
    const endSeqNum = Number(end.split('-')[1]);
  
    const result: Array<[string, any]> = [];

    for (const [msTime, sequenceMap] of stream) {
      if (msTime < startMsTime || msTime > endMsTime) {
        continue;
      }

      for (const [seqNum, entry] of sequenceMap) {
        if (
          (msTime === startMsTime && seqNum < startSeqNum) ||
          (msTime === endMsTime && seqNum > endSeqNum)
        ) {
          continue;
        }

        const entryId = `${msTime}-${seqNum}`;
        result.push([entryId, entry]);

        if (msTime === endMsTime && seqNum === endSeqNum) {
          break;
        }
      }
  }
    return result;
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
