import * as net from "net";
import { IStatefulCommand } from "../ICommand";
import { ConnectionState } from "../../types";
import { simpleStringResponse, toRESPArray } from "../../utilities";

export class PingCommand implements IStatefulCommand {
	public readonly type = "stateful";

	constructor() {}

	public async execute(args: string[], _connection: net.Socket | null, state: ConnectionState): Promise<string> {
		// Check if the client is in subscribe mode.
		if (state.subscribedChannels.size > 0) {
			// In subscribe mode, PING can take an optional message.
			const message = args[0] || "";
			// The response is an array: ["pong", <message>]
			return toRESPArray(["pong", message]);
		}

		// If not in subscribe mode, behave as normal.
		return args.length > 0 ? simpleStringResponse(args[0]) : simpleStringResponse("PONG");
	}
}
