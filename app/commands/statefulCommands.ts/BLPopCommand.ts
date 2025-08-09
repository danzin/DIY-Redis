import * as net from "net";
import { IStatefulCommand } from "../ICommand";
import { ConnectionState } from "../../types";
import { simpleErrorResponse, toRESPArray, bulkStringResponse } from "../../utilities";
import { BlockingManager } from "../../services/BlockingManager";

export class BLPopCommand implements IStatefulCommand {
	public readonly type = "stateful";

	constructor(private blockingManager: BlockingManager) {}

	public async execute(args: string[], connection: net.Socket | null, state: ConnectionState): Promise<string> {
		if (args.length < 2) {
			return simpleErrorResponse("wrong number of arguments for 'blpop' command");
		}

		const timeoutStr = args.pop()!;
		const keys = args;
		const timeout = parseInt(timeoutStr, 10);

		if (isNaN(timeout) || timeout < 0) {
			return simpleErrorResponse("timeout is not an integer or out of range");
		}

		const result = await this.blockingManager.blockOnLists(keys, timeout, connection);

		if (result) {
			// Result is [key, value]
			return toRESPArray(result);
		} else {
			// Timeout occurred
			return bulkStringResponse(); // null bulk string
		}
	}
}
