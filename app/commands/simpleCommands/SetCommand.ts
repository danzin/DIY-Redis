import { ISimpleCommand } from "../ICommand";
import { RedisStore } from "../../store/RedisStore";
import * as net from "net";
import { simpleErrorResponse, simpleStringResponse, bulkStringResponse, createExpirationDate } from "../../utilities";
import { ConnectionState } from "../../types";

export class SetCommand implements ISimpleCommand {
	readonly type = "simple";
	constructor(private redisStore: RedisStore) {}

	public async execute(args: string[]): Promise<string> {
		if (args.length < 2) {
			return simpleErrorResponse("wrong number of arguments for 'set' command");
		}

		const key = args.shift()!;
		const value = args.shift()!;

		let expiration: Date | undefined = undefined;
		let mode: "NX" | "XX" | null = null;
		let keepTTL = false;

		while (args.length > 0) {
			const option = args.shift()!.toUpperCase();
			let timeStr: string | undefined;
			let time: number;

			switch (option) {
				case "EX":
					timeStr = args.shift();
					if (!timeStr) return simpleErrorResponse("syntax error");
					time = parseInt(timeStr, 10);
					expiration = createExpirationDate(time * 1000);
					break;
				case "PX":
					timeStr = args.shift();
					if (!timeStr) return simpleErrorResponse("syntax error");
					time = parseInt(timeStr, 10);
					expiration = createExpirationDate(time);
					break;
				case "EXAT":
					timeStr = args.shift();
					if (!timeStr) return simpleErrorResponse("syntax error");
					time = parseInt(timeStr, 10);
					expiration = new Date(time * 1000);
					break;
				case "PXAT":
					timeStr = args.shift();
					if (!timeStr) return simpleErrorResponse("syntax error");
					time = parseInt(timeStr, 10);
					expiration = new Date(time);
					break;
				case "NX":
					mode = "NX";
					break;
				case "XX":
					mode = "XX";
					break;
				case "KEEPTTL":
					keepTTL = true;
					break;
				default:
					return simpleErrorResponse("syntax error");
			}
		}
		const existingValue = this.redisStore.get(key);

		// Check existence conditions (NX and XX)
		if (mode === "NX" && existingValue) {
			return bulkStringResponse(); // (nil) because key already exists
		}
		if (mode === "XX" && !existingValue) {
			return bulkStringResponse(); // (nil) because key does not exist
		}

		// Handle KEEPTTL
		if (keepTTL && existingValue) {
			expiration = existingValue.expiration;
		}

		this.redisStore.set(key, value, "string", expiration);
		return simpleStringResponse("OK");
	}
}
