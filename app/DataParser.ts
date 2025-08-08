export class DataParser {
	private readonly arr: string[];
	parsedData: any;

	constructor(data: Buffer) {
		this.arr = this.parseBuffer(data);
		// this.parsedData = this.getPayload();
	}

	private parseBuffer = (data: Buffer): string[] => {
		return data.toString().split("\r\n");
	};

	getReceivedData() {
		return this.arr.filter((string) => string);
	}

	getPayload() {
		const isRespMetadata = (item: string): boolean => {
			if (item.length < 2) return false;

			const prefix = item[0];
			if (prefix !== "*" && prefix !== "$") {
				return false;
			}
			return !isNaN(parseInt(item.substring(1), 10));
		};

		// Filter the raw data array, keeping only items that are NOT metadata.
		return this.arr.filter((item) => item && !isRespMetadata(item));
	}

	/**
	 * Parses the first complete RESP command from a given buffer.
	 * This is a static utility method, it does not use the instance's buffer.
	 * @param buffer The buffer to parse from.
	 * @returns The command payload and the number of bytes consumed, or null if incomplete.
	 */
	public static parseNextCommand(buffer: Buffer): { payload: string[]; bytesConsumed: number } | null {
		if (buffer.length === 0 || buffer[0] !== 42) {
			// '*'
			return null;
		}

		const endOfFirstLine = buffer.indexOf("\r\n");
		if (endOfFirstLine === -1) return null;

		const arrayLengthStr = buffer.slice(1, endOfFirstLine).toString();
		const arrayLength = parseInt(arrayLengthStr, 10);
		if (isNaN(arrayLength)) {
			return null;
		}

		let currentIndex = endOfFirstLine + 2;
		for (let i = 0; i < arrayLength; i++) {
			if (currentIndex >= buffer.length || buffer[currentIndex] !== 36) return null; // '$'
			const endOfBulkStringHeader = buffer.indexOf("\r\n", currentIndex);
			if (endOfBulkStringHeader === -1) return null;
			const bulkStringLength = parseInt(buffer.slice(currentIndex + 1, endOfBulkStringHeader).toString(), 10);
			if (isNaN(bulkStringLength)) return null;
			const endOfBulkString = endOfBulkStringHeader + 2 + bulkStringLength + 2;
			if (buffer.length < endOfBulkString) return null;
			currentIndex = endOfBulkString;
		}

		const commandBytes = buffer.slice(0, currentIndex);
		const tempParser = new DataParser(commandBytes);
		const payload = tempParser.getPayload();

		return { payload, bytesConsumed: currentIndex };
	}
}
