import { StreamEventManager } from "../commands/StreamEventManager";
import { ReplicationManager } from "../replication/ReplicationManager";
import { RedisStore } from "../store/RedisStore";
import * as net from "net";
import { ConnectionState } from "../types";
import { ICommand } from "../commands/ICommand";
import { EchoCommand } from "../commands/simpleCommands/EchoCommand";
import { PingCommand } from "../commands/simpleCommands/PingCommand";
import { InfoCommand } from "../commands/simpleCommands/InfoCommand";
import { ReplconfCommand } from "../commands/simpleCommands/ReplconfCommand";
import { ConfigCommand } from "../commands/simpleCommands/ConfigCommand";
import { GetCommand } from "../commands/simpleCommands/GetCommand";
import { SetCommand } from "../commands/simpleCommands/SetCommand";
import { ExpireCommand } from "../commands/simpleCommands/ExpireCommand";
import { ExistsCommand } from "../commands/simpleCommands/ExistsCommand";
import { DelCommand } from "../commands/simpleCommands/DelCommand";
import { TypeCommand } from "../commands/simpleCommands/TypeCommand";
import { IncrCommand } from "../commands/simpleCommands/IncrCommand";
import { KeysCommand } from "../commands/simpleCommands/KeysCommand";
import { SaveCommand } from "../commands/simpleCommands/SaveCommand";
import { XrangeCommand } from "../commands/streamCommands/XrangeCommand";
import { XrevrangeCommand } from "../commands/streamCommands/XrevrangeCommand";
import { XaddCommand } from "../commands/streamCommands/XaddCommand";
import { XreadCommand } from "../commands/streamCommands/XreadCommand";
import { MultiCommand } from "../commands/statefulCommands.ts/MultiCommand";
import { ExecCommand } from "../commands/statefulCommands.ts/ExecCommand";
import { PsyncCommand } from "../commands/replicationCommands/PsyncCommand";
import { WaitCommand } from "../commands/orchestrationCommands/WaitCommand";
import { DiscardCommand } from "../commands/statefulCommands.ts/DiscardCommand";
import { RPushCommand } from "../commands/simpleCommands/RpushCommand";
import { LRangeCommand } from "../commands/simpleCommands/LRangeCommand";
import { LPushCommand } from "../commands/simpleCommands/LPushCommand";

export function createCommandRegistry(
	redisStore: RedisStore,
	replicationManager: ReplicationManager,
	streamEventManager: StreamEventManager,
	dispatchCallback?: (
		conn: net.Socket | null,
		payload: string[],
		st: ConnectionState,
		isExec: boolean
	) => Promise<string | undefined>
): Map<string, ICommand> {
	const commands = new Map<string, ICommand>();

	// Simple commands (only need basic dependencies)
	commands.set("echo", new EchoCommand());
	commands.set("ping", new PingCommand());
	commands.set("info", new InfoCommand());
	commands.set("replconf", new ReplconfCommand());
	commands.set("config", new ConfigCommand());

	// Commands that need redisStore
	commands.set("get", new GetCommand(redisStore));
	commands.set("set", new SetCommand(redisStore));
	commands.set("expire", new ExpireCommand(redisStore));
	commands.set("exists", new ExistsCommand(redisStore));
	commands.set("rpush", new RPushCommand(redisStore));
	commands.set("lrange", new LRangeCommand(redisStore));
	commands.set("lpush", new LPushCommand(redisStore));
	commands.set("del", new DelCommand(redisStore));
	commands.set("type", new TypeCommand(redisStore));
	commands.set("incr", new IncrCommand(redisStore));
	commands.set("keys", new KeysCommand(redisStore));
	commands.set("save", new SaveCommand(redisStore));
	commands.set("xrange", new XrangeCommand(redisStore));
	commands.set("xrevrange", new XrevrangeCommand(redisStore));

	// Commands that need stream events
	commands.set("xadd", new XaddCommand(redisStore, streamEventManager));
	commands.set("xread", new XreadCommand(redisStore, streamEventManager));

	// Stateful commands
	commands.set("multi", new MultiCommand());
	commands.set("discard", new DiscardCommand());
	if (dispatchCallback) {
		commands.set("exec", new ExecCommand(redisStore, dispatchCallback));
	}

	// Replication commands
	commands.set("psync", new PsyncCommand());

	// Orchestration commands
	commands.set("wait", new WaitCommand(replicationManager));

	return commands;
}
