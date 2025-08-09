import * as net from "net";
import { IReplicationCommand, RESPONSE_WRITTEN } from "../ICommand";
import { ConnectionState } from "../../types";
import { SubscriptionManager } from "../../services/SubscriptionManager";
import { simpleErrorResponse } from "../../utilities";

export class SubscribeCommand implements IReplicationCommand {
	public readonly type = "replication";

	constructor(private subscriptionManager: SubscriptionManager) {}

	public async execute(
		args: string[],
		connection: net.Socket | null,
		state: ConnectionState
	): Promise<typeof RESPONSE_WRITTEN> {
		if (args.length < 1) {
			// In real Redis this would return a different formatted error, but this is fine.
			connection?.write(simpleErrorResponse("wrong number of arguments for 'subscribe' command"));
			return RESPONSE_WRITTEN;
		}

		if (!connection) {
			// This command is meaningless without a connection to subscribe.
			return RESPONSE_WRITTEN;
		}

		// A client can subscribe to multiple channels at once.
		for (const channel of args) {
			this.subscriptionManager.subscribe(channel, connection);
			state.subscribedChannels.add(channel);

			// Respond for each successful subscription
			const response = `*3\r\n$9\r\nsubscribe\r\n$${channel.length}\r\n${channel}\r\n:${state.subscribedChannels.size}\r\n`;
			connection.write(response);
		}

		// Signal to the dispatcher that we have handled our own response.
		return RESPONSE_WRITTEN;
	}
}
