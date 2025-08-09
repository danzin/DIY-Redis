import { ISimpleCommand } from "../ICommand";
import { RedisStore } from "../../store/RedisStore";
import { simpleErrorResponse, bulkStringResponse, toRESPArray } from "../../utilities";

export class LPopCommand implements ISimpleCommand {
	public readonly type = "simple";

	constructor(private redisStore: RedisStore) {}

	public async execute(args: string[]): Promise<string> {
		if (args.length < 1 || args.length > 2) {
			return simpleErrorResponse("wrong number of arguments for 'lpop' command");
		}

		const key = args[0];
		const countStr = args[1];
		let count: number | undefined = undefined;

		if (countStr) {
			count = parseInt(countStr, 10);
			if (isNaN(count) || count < 0) {
				return simpleErrorResponse("value is not an integer or out of range");
			}
		}

		const existing = this.redisStore.get(key);

		if (!existing) {
			// If no count, return nil. If count, return empty array.
			return count !== undefined ? toRESPArray([]) : bulkStringResponse();
		}
		if (existing.type !== "list") {
			return simpleErrorResponse("WRONGTYPE Operation against a key holding the wrong kind of value");
		}

		let list: string[] = [];
		try {
			list = JSON.parse(existing.value);
		} catch (e) {
			return simpleErrorResponse("internal error - invalid list format");
		}

		if (list.length === 0) {
			return count !== undefined ? toRESPArray([]) : bulkStringResponse();
		}

		if (count === undefined) {
			// Logic for a single pop without count arg
			const poppedElement = list.shift()!;
			this.updateStore(key, list, existing.expiration);
			return bulkStringResponse(poppedElement);
		} else {
			// Logic for multiple pops with count arg
			// `splice` removes elements from the array and returns the removed elements.
			const poppedElements = list.splice(0, count);
			this.updateStore(key, list, existing.expiration);
			return toRESPArray(poppedElements);
		}
	}

	// Helper method to keep the store update logic DRY
	private updateStore(key: string, list: string[], expiration: Date | undefined): void {
		if (list.length === 0) {
			this.redisStore.delete(key);
		} else {
			this.redisStore.set(key, JSON.stringify(list), "list", expiration);
		}
	}
}
