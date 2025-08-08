import { ConnectionState } from "../../types";
import { simpleErrorResponse, simpleStringResponse } from "../../utilities";
import * as net from "net";
import { IStatefulCommand } from "../ICommand";

export class DiscardCommand implements IStatefulCommand {
	public readonly type = "stateful";

	constructor() {}

	public async execute(args: string[], _connection: net.Socket | null, state: ConnectionState): Promise<string> {
		if (args.length > 0) {
			return simpleErrorResponse("wrong number of arguments for 'discard' command");
		}

		// Check in in a transaction.
		if (!state.inTransaction) {
			return simpleErrorResponse("DISCARD without MULTI");
		}

		// if in a transaction, abort it by resetting the state.
		state.inTransaction = false;
		state.commandQueue = [];

		return simpleStringResponse("OK");
	}
}
