import { StoreValue } from "../types";

export class RedisStore {
	private store: Map<string, StoreValue>;

	constructor(initStore?: [string, StoreValue][]) {
		this.store = new Map(initStore);
	}

	set(
		key: string,
		value: any,
		type: "string" | "hash" | "list" | "set" | "none" | "stream" | "zset",
		expiration?: Date
	): void {
		const storeValue: StoreValue = { value, type, expiration };
		this.store.set(key, storeValue);
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

	private isExpired(expiration: Date): boolean {
		const now = Date.now();
		const expTime = expiration.getTime();
		return now > expTime;
	}

	private checkAndDeleteExpiredKeys(): void {
		const keys = this.getKeys();
		keys.forEach((key) => {
			const value = this.get(key);
			if (value && value.expiration) {
				const expired = this.isExpired(value.expiration);
				if (expired) {
					this.delete(key);
				}
			}
		});
	}
	cleanExpiredKeys() {
		this.checkAndDeleteExpiredKeys();
	}
}
