import * as net from "net";
import { IStatefulCommand, ICommand, ISimpleCommand, RESPONSE_WRITTEN /* all other interfaces */ } from "../ICommand";
import { ConnectionState } from "../../types";
import { ReplicationManager } from "../../replication/ReplicationManager";
import { simpleErrorResponse, formatArrayOfResponsesWithErrors } from "../../utilities";

// Define the set of write commands here, as EXEC is the one who cares about propagation.
const WRITE_COMMANDS = new Set(["set", "del", "incr", "expire", "xadd", "rpush", "lpush"]);

export class ExecCommand implements IStatefulCommand {
	public readonly type = "stateful";

	constructor(private commandMap: Map<string, ICommand>, private replicationManager: ReplicationManager) {}

	public async execute(args: string[], connection: net.Socket | null, state: ConnectionState): Promise<string> {
		if (args.length > 0) return simpleErrorResponse("wrong number of arguments for 'exec' command");
		if (!state.inTransaction) return simpleErrorResponse("EXEC without MULTI");

		const queuedCommands = state.commandQueue;
		const transactionFailed = state.transactionFailed;

		// Reset state immediately.
		state.inTransaction = false;
		state.commandQueue = [];
		state.transactionFailed = false;

		if (transactionFailed) {
			return simpleErrorResponse("EXECABORT Transaction discarded because of previous errors.");
		}

		const responses: (string | number | null)[] = [];

		// Execute commands one by one.
		for (const payload of queuedCommands) {
			const [commandName, ...commandArgs] = payload;
			const commandLower = commandName.toLowerCase();
			const command = this.commandMap.get(commandLower);
			const tempState: ConnectionState = {
				inTransaction: false,
				transactionFailed: false,
				commandQueue: [],
				dataBuffer: Buffer.alloc(0),
				subscribedChannels: new Set<string>(),
			};

			try {
				if (!command) {
					throw new Error(`unknown command '${commandName}' during EXEC`);
				}

				let rawResponse: string | undefined | typeof RESPONSE_WRITTEN;
				switch (command.type) {
					case "simple":
						rawResponse = await (command as ISimpleCommand).execute(commandArgs);
						break;
					case "stateful":
						// Pass a temporary, non-transactional state.
						rawResponse = await (command as IStatefulCommand).execute(commandArgs, connection, tempState);
						break;
					default:
						throw new Error(`Command type '${command.type}' not supported inside EXEC.`);
				}

				// If the command executed successfully, we propagate it if it's a write command.
				if (WRITE_COMMANDS.has(commandLower)) {
					this.replicationManager.propagate(payload);
				}

				if (!rawResponse) {
					responses.push(null);
				} else if (rawResponse.startsWith("-")) {
					// THIS IS THE NEW PART
					// If the response is an error, push the raw, trimmed error string.
					responses.push(rawResponse.trim());
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
			} catch (e: any) {
				responses.push(`-ERR ${e.message || "internal error during transaction"}`);
			}
		}

		return formatArrayOfResponsesWithErrors(responses);
	}
}
