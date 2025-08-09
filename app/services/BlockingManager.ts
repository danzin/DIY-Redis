import { EventEmitter } from "events";
import { RedisStore } from "../store/RedisStore";
import { ReplicationManager } from "../replication/ReplicationManager";

interface WaitingClient {
	keys: string[];
	resolve: (value: [string, string] | null) => void;
	connectionIdentifier: any;
}

export class BlockingManager {
	//map where the key is the list key (e.g., "list_key") and the value is a queue of waiting clients
	private waitingQueues = new Map<string, WaitingClient[]>();

	constructor(private redisStore: RedisStore, private replicationManager: ReplicationManager) {}

	public async blockOnLists(
		keys: string[],
		timeoutSeconds: number,
		connectionIdentifier: any
	): Promise<[string, string] | null> {
		// Try an immediate, non-blocking pop on all keys.
		for (const key of keys) {
			const popped = this.popAndPropagate(key);
			if (popped) {
				return [key, popped];
			}
		}

		// If still here then all lists were empty. We need to block.
		return new Promise((resolve) => {
			const waiter: WaitingClient = { keys, resolve, connectionIdentifier };

			// Add the client to the waiting queue for each key they are listening on.
			for (const key of keys) {
				const queue = this.waitingQueues.get(key) || [];
				queue.push(waiter);
				this.waitingQueues.set(key, queue);
			}

			// Handle the timeout
			let timeoutId: NodeJS.Timeout | null = null;
			if (timeoutSeconds > 0) {
				timeoutId = setTimeout(() => {
					this.removeWaiter(waiter);
					resolve(null); // Resolve with null on timeout
				}, timeoutSeconds * 1000);
			}

			// We need a way to clean up if the promise is resolved early.
			const onResolve = (result: [string, string] | null) => {
				if (timeoutId) clearTimeout(timeoutId);
				this.removeWaiter(waiter);
				resolve(result);
			};

			// Replace the original resolve with our cleanup-aware version.
			waiter.resolve = onResolve;
		});
	}

	// This method is called by RPUSH/LPUSH
	public notifyListPush(key: string): void {
		const queue = this.waitingQueues.get(key);
		if (queue && queue.length > 0) {
			const waiter = queue.shift()!;
			// and here
			const popped = this.popAndPropagate(key);
			if (popped) {
				waiter.resolve([key, popped]);
			} else {
				queue.unshift(waiter);
			}
		}
	}

	private popAndPropagate(key: string): string | null {
		// This performs the LPOP logic
		const poppedElement = this.tryLPop(key);

		if (poppedElement) {
			// If successful, propagate the effect as an LPOP command
			this.replicationManager.propagate(["LPOP", key]);
		}

		return poppedElement;
	}

	// Helper to perform the actual pop operation
	private tryLPop(key: string): string | null {
		const existing = this.redisStore.get(key);
		if (!existing || existing.type !== "list") return null;

		try {
			const list: string[] = JSON.parse(existing.value);
			if (list.length === 0) return null;

			const poppedElement = list.shift()!;

			if (list.length === 0) {
				this.redisStore.delete(key);
			} else {
				this.redisStore.set(key, JSON.stringify(list), "list", existing.expiration);
			}

			return poppedElement;
		} catch {
			return null;
		}
	}

	// Helper to remove a waiter from all queues it might be in.
	private removeWaiter(waiter: WaitingClient): void {
		for (const key of waiter.keys) {
			const queue = this.waitingQueues.get(key);
			if (queue) {
				const index = queue.findIndex((w) => w.connectionIdentifier === waiter.connectionIdentifier);
				if (index > -1) {
					queue.splice(index, 1);
				}
			}
		}
	}
}
