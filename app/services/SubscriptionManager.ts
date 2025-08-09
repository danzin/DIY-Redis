import * as net from "net";

export class SubscriptionManager {
	// Key: channelName, Value: Set of sockets subscribed to that channel
	private channelSubscriptions = new Map<string, Set<net.Socket>>();

	public subscribe(channel: string, connection: net.Socket): void {
		let subscribers = this.channelSubscriptions.get(channel);
		if (!subscribers) {
			subscribers = new Set();
			this.channelSubscriptions.set(channel, subscribers);
		}
		subscribers.add(connection);
		console.log(`Connection subscribed to channel: ${channel}`);
	}

	public unsubscribe(channel: string, connection: net.Socket): void {
		const subscribers = this.channelSubscriptions.get(channel);
		if (subscribers) {
			subscribers.delete(connection);
			// If nno subscribers, clean channel
			if (subscribers.size === 0) {
				this.channelSubscriptions.delete(channel);
			}
			console.log(`Connection unsubscribed from channel: ${channel}`);
		}
	}

	public getSubscribers(channel: string): Set<net.Socket> {
		return this.channelSubscriptions.get(channel) || new Set();
	}
}
