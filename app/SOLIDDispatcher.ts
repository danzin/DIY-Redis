import {
	ICommand,
	IOrchestrationCommand,
	IReplicationCommand,
	ISimpleCommand,
	IStatefulCommand,
} from "./commands/ICommand";
import { ReplicationManager } from "./replication/ReplicationManager";
import { ConnectionState } from "./types";
import { simpleErrorResponse, simpleStringResponse } from "./utilities";
import * as net from "net";

export class SOLIDDispatcher {
	private readonly COMMANDS_THAT_PROPAGATE = new Set(["set", "del", "incr", "expire", "xadd"]);
	private readonly IMMEDIATE_TX_COMMANDS = new Set(["EXEC", "DISCARD", "MULTI", "WATCH"]);

	constructor(private commandMap: Map<string, ICommand>, private replicationManager: ReplicationManager) {}

	async dispatch(
		connection: net.Socket | null,
		payload: string[],
		state: ConnectionState,
		isExec: boolean = false
	): Promise<string | undefined> {
		const [commandName, ...args] = payload;
		const commandUpper = commandName.toUpperCase();

		// If in transaction queue the command unless it's a special transaction command
		if (state.inTransaction && !this.IMMEDIATE_TX_COMMANDS.has(commandUpper)) {
			state.commandQueue.push(payload);
			return simpleStringResponse("QUEUED");
		}

		if (commandUpper === "REPLCONF" && args[0]?.toUpperCase() === "ACK") {
			const offset = parseInt(args[1], 10);
			if (!isNaN(offset)) {
				this.replicationManager.receiveAck(offset);
			}
			// ACKs from replicas should receive no response.
			return undefined;
		}

		const command = this.commandMap.get(commandName.toLowerCase());
		if (!command) {
			return simpleErrorResponse(`unknown command '${commandName}'`);
		}

		let response: string | undefined;

		// Execute based on command type
		switch (command.type) {
			case "simple":
				response = await (command as ISimpleCommand).execute(args);
				break;

			case "stateful":
				response = await (command as IStatefulCommand).execute(args, connection, state);
				break;

			case "replication":
				const result = await (command as IReplicationCommand).execute(args, connection, state);
				return undefined; // Replication commands handle their own writing

			case "orchestration":
				response = await (command as IOrchestrationCommand).execute(
					args,
					this.replicationManager,
					this.replicationManager.waitAckEmitter
				);
				break;

			default:
				return simpleErrorResponse("Unknown command type");
		}

		// Auto-propagate write commands (only if not in transaction, not executing, and successful)
		if (
			response &&
			!state.inTransaction &&
			!isExec &&
			this.COMMANDS_THAT_PROPAGATE.has(commandName.toLowerCase()) &&
			!response.startsWith("-")
		) {
			// Not an error
			this.replicationManager.propagate(payload);
		}

		return response;
	}
}
