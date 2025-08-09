import * as net from "net";
import { IReplicationCommand, RESPONSE_WRITTEN } from "../ICommand";
import { ConnectionState } from "../../types";
import { SubscriptionManager } from "../../services/SubscriptionManager";
import { bulkStringResponse, simpleErrorResponse, toRESPArray } from "../../utilities";

export class UnsubscribeCommand implements IReplicationCommand {
	public readonly type = "replication";

	constructor(private subscriptionManager: SubscriptionManager) {}

	public async execute(
		args: string[],
		connection: net.Socket | null,
		state: ConnectionState
	): Promise<typeof RESPONSE_WRITTEN> {
		if (args.length < 1) {
			// A real Redis unsubscribes from all channels if none are given,
			// but for this challenge, we can require at least one.
			connection?.write(simpleErrorResponse("wrong number of arguments for 'unsubscribe' command"));
			return RESPONSE_WRITTEN;
		}

		if (!connection) {
			return RESPONSE_WRITTEN;
		}

		const channelsToUnsubscribe = args.length > 0 ? args : [...state.subscribedChannels];
		// Loop through each channel the client wants to unsubscribe from.
		for (const channel of channelsToUnsubscribe) {
			if (state.subscribedChannels.has(channel)) {
				this.subscriptionManager.unsubscribe(channel, connection);
				state.subscribedChannels.delete(channel);
			}

			// Build the response manually to control the types of each element
			let response = `*3\r\n`;
			// Element 1: "unsubscribe" as a bulk string
			response += bulkStringResponse("unsubscribe");
			// Element 2: The channel name as a bulk string
			response += bulkStringResponse(channel);
			// Element 3: The remaining subscription count as an INTEGER
			response += `:${state.subscribedChannels.size}\r\n`;

			connection.write(response);
		}

		// Signal to the dispatcher that we have handled our own response
		return RESPONSE_WRITTEN;
	}
}
