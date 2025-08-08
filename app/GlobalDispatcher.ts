import net from "net";
import { CommandHandler } from "./Redis/CommandHandler";
import { EventEmitter } from "events";
import { ConnectionState } from "./types";

export class GlobalDispatcher {
	private waitAckEmitter: EventEmitter;

	constructor(private commandHandler: CommandHandler, waitAckEmitter: EventEmitter) {
		this.waitAckEmitter = waitAckEmitter;
	}

	async dispatch(
		connection: net.Socket | null,
		payload: string[],
		state: ConnectionState
	): Promise<string | undefined> {
		const [command, ...args] = payload;
		let response: string | undefined;
		if (command.toUpperCase() === "REPLCONF" && args[0]?.toUpperCase() === "ACK") {
			const offset = parseInt(args[1], 10);
			// Emit an event that the wait command is listening for
			this.waitAckEmitter.emit("ack", offset);
			// Do not send any response back
			return;
		}

		switch (command.toUpperCase()) {
			case "ECHO":
				return this.commandHandler.echo(args);
			case "PING":
				return this.commandHandler.ping(args);
			case "SET":
				response = await this.commandHandler.set(args);
				break;
			case "DEL":
				response = await this.commandHandler.del(args);
				break;
			case "GET":
				return this.commandHandler.get(args);
			case "INFO":
				return this.commandHandler.info(args);
			case "REPLCONF":
				return this.commandHandler.replconf(args);
			case "TYPE":
				return this.commandHandler.type(args);
			case "XADD":
				response = await this.commandHandler.xadd(args);
				break;
			case "XREAD":
				return await this.commandHandler.xread(args);
			case "XRANGE":
				return this.commandHandler.xrange(args);
			case "XREVRANGE":
				return this.commandHandler.xrevrange(args);
			case "PSYNC":
				this.commandHandler.psync(args, connection as net.Socket);
				return;
			case "WAIT":
				response = await this.commandHandler.wait(args);
				break;
			case "CONFIG":
				return this.commandHandler.config(args);
			case "KEYS":
				return this.commandHandler.keys(args);
			case "SAVE":
				return this.commandHandler.save(args);
			case "EXPIRE":
				response = await this.commandHandler.expire(args);
				break;
			case "INCR":
				response = await this.commandHandler.incr(args);
				break;
			case "MULTI":
				return this.commandHandler.multi(args, state);
			case "EXEC":
				return this.commandHandler.exec(args, state);
			case "EXISTS":
				return this.commandHandler.exists(args);
			default:
				return "-ERR unknown command\r\n";
		}

		// Write commands that propagate
		const writeCommands = ["SET", "DEL", "XADD", "EXPIRE"];
		if (writeCommands.includes(command.toUpperCase())) {
			this.commandHandler.propagate(payload);
		}

		return response;
	}
}
