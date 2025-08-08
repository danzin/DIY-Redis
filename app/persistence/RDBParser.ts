import { RedisStore } from "../Redis/RedisStore";

export class RDBParser {
	private buffer: Buffer;
	private cursor = 0;

	constructor(rdbFileBuffer: Buffer, private redisStore: RedisStore) {
		this.buffer = rdbFileBuffer;
	}

	public parse(): void {
		console.log("Starting RDB parsing...");
		this.parseHeader();

		while (this.cursor < this.buffer.length) {
			const opcode = this.buffer[this.cursor];

			if (opcode === 0xfa) {
				// Auxiliary field (metadata)
				this.parseAuxiliaryField();
			} else if (opcode === 0xfe) {
				// Database selector
				this.parseDatabaseSelector();
			} else if (opcode === 0xff) {
				// End of File
				console.log("Reached RDB End of File.");
				break;
			} else {
				throw new Error(`Unknown or misplaced top-level RDB opcode: 0x${opcode.toString(16)} at cursor ${this.cursor}`);
			}
		}
	}

	private parseHeader(): void {
		const header = this.buffer.slice(this.cursor, this.cursor + 9).toString("ascii");
		if (!header.startsWith("REDIS")) {
			throw new Error("Invalid RDB file format: Missing REDIS magic string.");
		}
		this.cursor += 9;
	}

	private parseAuxiliaryField(): void {
		this.cursor++; // Consume the 0xFA opcode
		const key = this.parseStringEncoded();
		const value = this.parseStringEncoded();
		console.log(`Skipping metadata: ${key} = ${value}`);
	}

	private parseDatabaseSelector(): void {
		this.cursor++; // Consume the 0xFE opcode
		const dbNumber = this.parseLengthEncoded();
		console.log(`Selecting database: ${dbNumber}`);

		// Check for resize hints (0xFB) and skip them.
		const nextOpcode = this.buffer[this.cursor];
		if (nextOpcode === 0xfb) {
			this.cursor++; // Consume the 0xFB opcode
			const hashTableSize = this.parseLengthEncoded();
			const expiryHashTableSize = this.parseLengthEncoded();
			console.log(`Skipping DB resize hints: ht_size=${hashTableSize}, exp_ht_size=${expiryHashTableSize}`);
		}

		// Loop through all key-value pairs in this database section.
		while (this.cursor < this.buffer.length) {
			const opcode = this.buffer[this.cursor];
			if (opcode === 0xfe || opcode === 0xff || opcode === 0xfa) {
				break;
			}
			this.parseKeyValuePair();
		}
	}

	private parseKeyValuePair(): void {
		let expiry: Date | undefined = undefined;
		let valueType = this.buffer[this.cursor];

		// Step 1: Check for and parse expiry information first.
		if (valueType === 0xfd) {
			// Expiry in seconds (4-byte LE)
			this.cursor++; // Consume 0xFD
			if (this.cursor + 4 > this.buffer.length) throw new Error("Buffer underflow reading expiry seconds");
			const expirySeconds = this.buffer.readUInt32LE(this.cursor);
			expiry = new Date(expirySeconds * 1000);
			this.cursor += 4;
			valueType = this.buffer[this.cursor]; // Update valueType to the actual type
		} else if (valueType === 0xfc) {
			// Expiry in milliseconds (8-byte LE)
			this.cursor++; // Consume 0xFC
			if (this.cursor + 8 > this.buffer.length) throw new Error("Buffer underflow reading expiry milliseconds");
			const expiryMs = this.buffer.readBigUInt64LE(this.cursor);
			expiry = new Date(Number(expiryMs));
			this.cursor += 8;
			valueType = this.buffer[this.cursor]; // Update valueType to the actual type
		}

		if (valueType !== 0x00) {
			throw new Error(`Unsupported RDB value type: 0x${valueType.toString(16)} at cursor ${this.cursor}`);
		}

		this.cursor++; // Consume the value type opcode (0x00)

		const key = this.parseStringEncoded();
		const value = this.parseStringEncoded();

		// Step 3: If the key is not expired, set it in the store.
		if (!expiry || expiry.getTime() > Date.now()) {
			this.redisStore.set(key, value, "string", expiry);
			console.log(`RDB: Loaded key "${key}" with value "${value}"`);
		} else {
			console.log(`RDB: Skipped expired key "${key}"`);
		}
	}

	private parseLengthEncoded(): number {
		if (this.cursor >= this.buffer.length) {
			throw new Error("Attempted to read past buffer boundary for length encoding.");
		}
		const firstByte = this.buffer[this.cursor];
		const encodingType = (firstByte & 0b11000000) >> 6;

		if (encodingType === 0b00) {
			// 00xxxxxx -> Next 6 bits are the length
			this.cursor++;
			return firstByte & 0b00111111;
		}
		if (encodingType === 0b01) {
			// 01xxxxxx -> Read 1 more byte for a 14-bit length
			if (this.cursor + 2 > this.buffer.length) {
				// Check for 2 bytes
				throw new Error("Buffer too small for 14-bit length.");
			}
			const nextByte = this.buffer[this.cursor + 1];
			this.cursor += 2;
			return ((firstByte & 0b00111111) << 8) | nextByte;
		}
		if (encodingType === 0b10) {
			// 10xxxxxx -> Discard 6 bits, read 4 more bytes for a 32-bit length
			if (this.cursor + 5 > this.buffer.length) {
				// Check for 1 + 4 bytes
				throw new Error("Buffer too small for 32-bit length.");
			}
			this.cursor++; // Move past the first byte
			const length = this.buffer.readUInt32BE(this.cursor); // Redis uses Big Endian for this
			this.cursor += 4;
			return length;
		}
		if (encodingType === 0b11) {
			// 11xxxxxx -> Special encoding
			return -1; // Signal to the caller that this is a special format.
		}
		throw new Error("Should not be reachable");
	}

	private parseStringEncoded(): string {
		const length = this.parseLengthEncoded();
		if (length === -1) {
			// Special format
			const specialFormat = this.buffer[this.cursor] & 0b00111111;
			this.cursor++; // Consume the special format byte
			switch (specialFormat) {
				case 0: // 8-bit integer
					if (this.cursor + 1 > this.buffer.length) throw new Error("Buffer underflow for 8-bit int");
					const int8 = this.buffer.readInt8(this.cursor);
					this.cursor += 1;
					return int8.toString();
				case 1: // 16-bit integer
					if (this.cursor + 2 > this.buffer.length) throw new Error("Buffer underflow for 16-bit int");
					const int16 = this.buffer.readInt16LE(this.cursor);
					this.cursor += 2;
					return int16.toString();
				case 2: // 32-bit integer
					if (this.cursor + 4 > this.buffer.length) throw new Error("Buffer underflow for 32-bit int");
					const int32 = this.buffer.readInt32LE(this.cursor);
					this.cursor += 4;
					return int32.toString();
				default:
					throw new Error(`Unknown special string encoding: ${specialFormat}`);
			}
		}

		if (this.cursor + length > this.buffer.length) {
			throw new Error(
				`Attempted to read string past buffer boundary. Cursor: ${this.cursor}, Length: ${length}, Buffer size: ${this.buffer.length}`
			);
		}
		const value = this.buffer.toString("utf8", this.cursor, this.cursor + length);
		this.cursor += length;
		return value;
	}
}
