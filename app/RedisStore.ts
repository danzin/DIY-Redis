import {  StoreValue } from "./types";

export class RedisStore {
  private store: Map<string, StoreValue>;

  constructor(initStore?: [string, StoreValue][]) {
    this.store = new Map(initStore);
  }

  set(key: string, value: any, type: 'string' | 'hash' | 'list' | 'set' | 'none'| 'stream'): void {
    this.store.set(key, { value, type });
  }

  get(key: string): StoreValue | undefined {
    return this.store.get(key);
  }
  getType(key: string): string | undefined {
    const entry = this.store.get(key);
    return entry ? entry.type : undefined;
  }

  getKeys() {
    return Array.from(this.store.keys());
  }

  getEntries() {
    return Array.from(this.store.entries());
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }
}