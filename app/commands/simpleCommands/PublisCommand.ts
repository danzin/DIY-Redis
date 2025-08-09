import { ISimpleCommand } from "../ICommand";
import { SubscriptionManager } from "../../services/SubscriptionManager";
import { simpleErrorResponse, toRESPArray } from "../../utilities";

export class PublishCommand implements ISimpleCommand {
	public readonly type = "simple";

	constructor(private subscriptionManager: SubscriptionManager) {}

	public async execute(args: string[]): Promise<string> {
		if (args.length !== 2) {
			return simpleErrorResponse("wrong number of arguments for 'publish' command");
		}

		const [channel, message] = args;

		// Ask the subscription manager for all current subscribers to this channel.
		const subscribers = this.subscriptionManager.getSubscribers(channel);
		const messagePayload = ["message", channel, message];
		const formattedMessage = toRESPArray(messagePayload);

		for (const subscriberSocket of subscribers) {
			//Check if socket is still writable
			if (subscriberSocket.writable) {
				subscriberSocket.write(formattedMessage);
			}
		}
		const subscriberCount = subscribers.size;
		// Return the number of clients subscribed to the channel as a RESP integer.
		return `:${subscriberCount}\r\n`;
	}
}
