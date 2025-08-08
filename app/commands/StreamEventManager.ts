import { EventEmitter } from "events";

export class StreamEventManager extends EventEmitter {
	constructor() {
		super();
	}

	notifyNewEntry(streamKey: string): void {
		this.emit("new-entry", streamKey);
	}
}
