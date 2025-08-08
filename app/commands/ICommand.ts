import * as net from "net";
import { ConnectionState } from "../types";
import { ReplicationManager } from "../replication/ReplicationManager";
import { EventEmitter } from "events";

// Special symbol for commands that handle their own socket writing (like PSYNC)
export const RESPONSE_WRITTEN = Symbol("RESPONSE_WRITTEN");

// The base that all commands share
interface ICommandBase {
	// A property to help the dispatcher distinguish command types
	readonly type: "simple" | "stateful" | "replication" | "orchestration";
}

// For simple commands like PING, GET, ECHO that only need args
export interface ISimpleCommand extends ICommandBase {
	readonly type: "simple";
	execute(args: string[]): Promise<string | undefined>;
}

// For commands that need connection state, like MULTI, EXEC
export interface IStatefulCommand extends ICommandBase {
	readonly type: "stateful";
	execute(args: string[], connection: net.Socket | null, state: ConnectionState): Promise<string | undefined>;
}

// For commands that perform their own I/O, like PSYNC
export interface IReplicationCommand extends ICommandBase {
	readonly type: "replication";
	execute(args: string[], connection: net.Socket | null, state: ConnectionState): Promise<typeof RESPONSE_WRITTEN>;
}

export interface IOrchestrationCommand extends ICommandBase {
	readonly type: "orchestration";
	execute(
		args: string[],
		replicationManager: ReplicationManager,
		waitAckEmitter: EventEmitter
	): Promise<string | undefined>;
}

// A union of all possible command types for the map
export type ICommand = ISimpleCommand | IStatefulCommand | IReplicationCommand | IOrchestrationCommand;
