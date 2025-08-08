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
	private readonly IMMEDIATE_TX_COMMANDS = new Set(["exec", "discard", "multi", "watch"]);

	constructor(private commandMap: Map<string, ICommand>, private replicationManager: ReplicationManager) {}

	async dispatch(
		connection: net.Socket | null,
		payload: string[],
		state: ConnectionState,
		isExec: boolean = false
	): Promise<string | undefined> {
		const [commandName, ...args] = payload;
		const commandLower = commandName.toLowerCase();

		if (commandLower === "replconf" && args[0]?.toLowerCase() === "ack") {
			this.replicationManager.receiveAck(parseInt(args[1]));
			return undefined;
		}

		if (state.inTransaction && !this.IMMEDIATE_TX_COMMANDS.has(commandLower)) {
			// Pre-validate the command for syntax errors before queueing.
			const command = this.commandMap.get(commandLower);
			if (!command) {
				state.transactionFailed = true; // Mark transaction as failed
			} else {
				if (commandLower === "SET" && args.length < 2) state.transactionFailed = true;
				if (commandLower === "GET" && args.length !== 1) state.transactionFailed = true;
				if (commandLower === "INCR" && args.length !== 1) state.transactionFailed = true;
			}

			state.commandQueue.push(payload);
			// Even if it fails validation, Redis still replies with QUEUED.
			return simpleStringResponse("QUEUED");
		}

		// If in transaction queue the command unless it's a special transaction command
		if (state.inTransaction && !this.IMMEDIATE_TX_COMMANDS.has(commandLower)) {
			state.commandQueue.push(payload);
			return simpleStringResponse("QUEUED");
		}

		if (commandLower === "REPLCONF" && args[0]?.toUpperCase() === "ACK") {
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
