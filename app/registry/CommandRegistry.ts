import { StreamEventManager } from "../commands/StreamEventManager";
import { ReplicationManager } from "../replication/ReplicationManager";
import { RedisStore } from "../store/RedisStore";

import { ICommand } from "../commands/ICommand";
import { EchoCommand } from "../commands/simpleCommands/EchoCommand";
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
import { PsyncCommand } from "../commands/replicationCommands/PsyncCommand";
import { WaitCommand } from "../commands/orchestrationCommands/WaitCommand";
import { DiscardCommand } from "../commands/statefulCommands.ts/DiscardCommand";
import { LRangeCommand } from "../commands/simpleCommands/LRangeCommand";
import { LLenCommand } from "../commands/simpleCommands/LLenCommand";
import { LPopCommand } from "../commands/simpleCommands/LPopCommand";
import { BlockingManager } from "../services/BlockingManager";
import { BLPopCommand } from "../commands/statefulCommands.ts/BLPopCommand";
import { SubscriptionManager } from "../services/SubscriptionManager";
import { SubscribeCommand } from "../commands/replicationCommands/SubscribeCommand";
import { PingCommand } from "../commands/statefulCommands.ts/PingCommand";
import { RPushCommand } from "../commands/simpleCommands/RPushCommand";
import { LPushCommand } from "../commands/simpleCommands/LPushCommand";
import { PublishCommand } from "../commands/simpleCommands/PublisCommand";

export function createCommandRegistry(
	redisStore: RedisStore,
	replicationManager: ReplicationManager,
	streamEventManager: StreamEventManager,
	blockingManager: BlockingManager,
	subscriptionManager: SubscriptionManager
): Map<string, ICommand> {
	const commands = new Map<string, ICommand>();

	// Simple commands (only need basic dependencies)
	commands.set("echo", new EchoCommand());
	commands.set("info", new InfoCommand());
	commands.set("replconf", new ReplconfCommand());
	commands.set("config", new ConfigCommand());

	// Commands that need redisStore
	commands.set("get", new GetCommand(redisStore));
	commands.set("set", new SetCommand(redisStore));
	commands.set("rpush", new RPushCommand(redisStore, blockingManager));
	commands.set("lrange", new LRangeCommand(redisStore));
	commands.set("lpush", new LPushCommand(redisStore, blockingManager));
	commands.set("llen", new LLenCommand(redisStore));
	commands.set("lpop", new LPopCommand(redisStore));
	commands.set("expire", new ExpireCommand(redisStore));
	commands.set("exists", new ExistsCommand(redisStore));
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
	commands.set("publish", new PublishCommand(subscriptionManager));

	commands.set("blpop", new BLPopCommand(blockingManager));
	commands.set("ping", new PingCommand());

	// Replication commands
	commands.set("psync", new PsyncCommand());
	commands.set("subscribe", new SubscribeCommand(subscriptionManager));

	// Orchestration commands
	commands.set("wait", new WaitCommand(replicationManager));

	return commands;
}
