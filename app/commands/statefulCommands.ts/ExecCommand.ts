import { RedisStore } from "../../store/RedisStore";
import { ConnectionState } from "../../types";
import { formatArrayOfResponses, formatArrayOfResponsesWithErrors, simpleErrorResponse } from "../../utilities";
import { IStatefulCommand } from "../ICommand";
import * as net from "net";

export class ExecCommand implements IStatefulCommand {
	readonly type = "stateful";

	constructor(
		private redisStore: RedisStore,
		private dispatchCallback: (
			conn: net.Socket | null,
			payload: string[],
			st: ConnectionState,
			isExec: boolean
		) => Promise<string | undefined>
	) {}

	async execute(args: string[], connection: net.Socket | null, state: ConnectionState): Promise<string> {
		if (args.length > 0) {
			return simpleErrorResponse("wrong number of arguments for 'exec' command");
		}
		if (!state.inTransaction) {
			return simpleErrorResponse("EXEC without MULTI");
		}

		const queuedCommands = state.commandQueue;
		const transactionFailed = state.transactionFailed;

		// Reset state immediately
		state.inTransaction = false;
		state.commandQueue = [];
		state.transactionFailed = false;

		//Check for queue-time errors and abort the whole transaction
		if (transactionFailed) {
			return simpleErrorResponse("EXECABORT Transaction discarded because of previous errors.");
		}

		const responses: (string | number | null)[] = [];

		for (const payload of queuedCommands) {
			// Correctly create the temporary state object with all required properties.
			const tempState: ConnectionState = {
				inTransaction: false,
				commandQueue: [],
				transactionFailed: false,
				dataBuffer: Buffer.alloc(0),
			};
			try {
				// Use the callback to dispatch the command
				const rawResponse = await this.dispatchCallback(connection, payload, tempState, true);

				// Check if the response itself is a RESP error
				if (rawResponse && rawResponse.startsWith("-")) {
					// Add the raw error string to our results
					responses.push(rawResponse.trim());
					continue; // Continue to the next command
				}

				// --- Convert successful raw RESP to clean data ---
				if (!rawResponse) {
					responses.push(null);
				} else if (rawResponse.startsWith(":")) {
					responses.push(parseInt(rawResponse.substring(1), 10));
				} else if (rawResponse.startsWith("+")) {
					responses.push(rawResponse.substring(1).trim());
				} else if (rawResponse.startsWith("$-1")) {
					responses.push(null);
				} else if (rawResponse.startsWith("$")) {
					const lines = rawResponse.trim().split("\r\n");
					responses.push(lines.length > 1 ? lines[1] : null);
				}
			} catch {
				// This catch is for unexpected crashes in the dispatcher itself
				responses.push("-ERR internal error during transaction");
			}
		}

		// Use a modified formatter that can handle raw error strings
		return formatArrayOfResponsesWithErrors(responses);
	}
}
