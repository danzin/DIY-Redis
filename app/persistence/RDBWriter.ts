import { RedisStore } from "../Redis/RedisStore";

export class RDBWriter {
	private redisStore: RedisStore;
	private bufferChunks: Buffer[] = [];

	constructor(redisStore: RedisStore) {
		this.redisStore = redisStore;
	}

	public buildRDB(): Buffer {
		this.writeHeader();
		this.writeDatabase();
		this.writeEOF();

		return Buffer.concat(this.bufferChunks);
	}

	private writeHeader(): void {
		// Magic string "REDIS" + 4-digit RDB version number
		this.bufferChunks.push(Buffer.from("REDIS0011", "ascii"));
	}

	private writeDatabase(): void {
		// Opcode for database selector
		this.bufferChunks.push(Buffer.from([0xfe]));

		this.bufferChunks.push(this.encodeLength(0));

		// Opcode for hash table size hints
		const keys = this.redisStore.getKeys();
		this.bufferChunks.push(Buffer.from([0xfb]));
		this.bufferChunks.push(this.encodeLength(keys.length));
		this.bufferChunks.push(this.encodeLength(0)); // Expiry hash table size, assuming 0 for now

		for (const key of keys) {
			const storeValue = this.redisStore.get(key);
			if (storeValue && storeValue.type === "string") {
				if (storeValue.expiration && storeValue.expiration.getTime() <= Date.now()) {
					continue; // Skip expired keys
				}

				// Handle expiry
				if (storeValue.expiration) {
					// Opcode for expiry in milliseconds
					this.bufferChunks.push(Buffer.from([0xfc]));
					const expiryMs = Buffer.alloc(8);
					expiryMs.writeBigUInt64LE(BigInt(storeValue.expiration.getTime()));
					this.bufferChunks.push(expiryMs);
				}

				// Value type (string)
				this.bufferChunks.push(Buffer.from([0x00]));

				// Write key and value
				this.writeString(key);
				this.writeString(storeValue.value);
			}
		}
	}

	private writeString(str: string): void {
		const len = Buffer.byteLength(str, "utf8");
		this.bufferChunks.push(this.encodeLength(len));
		this.bufferChunks.push(Buffer.from(str, "utf8"));
	}

	private encodeLength(len: number): Buffer {
		if (len < 64) {
			// 00xxxxxx
			return Buffer.from([len]);
		}
		throw new Error("Length encoding for lengths >= 64 not implemented for SAVE.");
	}

	private writeEOF(): void {
		// Opcode for EOF
		this.bufferChunks.push(Buffer.from([0xff]));
		// Add a final empty buffer to indicate EOF
		this.bufferChunks.push(Buffer.alloc(8));
	}
}
