import net from "net";
import { CommandHandler } from "./Redis/CommandHandler";

export class GlobalDispatcher {
	constructor(private commandHandler: CommandHandler) {}

	async dispatch(connection: net.Socket | null, payload: string[]): Promise<string | undefined> {
		const [command, ...args] = payload;
		let response: string | undefined;

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
			case "PSYNC":
				this.commandHandler.psync(args, connection as net.Socket);
				return;
			default:
				return "-ERR unknown command\r\n";
		}

		const writeCommands = ["SET", "DEL", "XADD"];
		if (writeCommands.includes(command.toUpperCase())) {
			this.commandHandler.propagate(payload);
		}

		return response;
	}
}
