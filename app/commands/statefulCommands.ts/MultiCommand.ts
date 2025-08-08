import { IStatefulCommand } from "../ICommand";
import { ConnectionState } from "../../types";
import { simpleErrorResponse, simpleStringResponse } from "../../utilities";
import * as net from "net";

export class MultiCommand implements IStatefulCommand {
	readonly type = "stateful";

	async execute(args: string[], _connection: net.Socket | null, state: ConnectionState): Promise<string> {
		if (args.length > 0) {
			return simpleErrorResponse("wrong number of arguments for 'multi' command");
		}

		// Reset all relevant state flags when starting new transaction
		state.inTransaction = true;
		state.commandQueue = [];
		state.transactionFailed = false;
		return simpleStringResponse("OK");
	}
}
