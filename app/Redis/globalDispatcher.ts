import net from "net";
import { commandHandler } from "../main";

export const globalCommandHandler = async (connection: net.Socket, payload: string[]): Promise<string> => {
	const [command, ...args] = payload.join(" ").split(" ");
	console.log("command and args: ", command, args);
	switch (command.toUpperCase()) {
		case "ECHO":
			return commandHandler.echo(args);
		case "PING":
			return commandHandler.ping(args);
		case "SET":
			return commandHandler.set(args);
		case "GET":
			return commandHandler.get(args);
		case "INFO":
			return commandHandler.info(args);
		case "REPLCONF":
			return commandHandler.replconf(args);
		case "TYPE":
			return commandHandler.type(args);
		case "XADD":
			return commandHandler.xadd(args);
		case "XREAD":
			return await commandHandler.xread(args);
		case "XRANGE":
			return commandHandler.xrange(args);
		case "PSYNC":
			return commandHandler.psync(args);
		default:
			return "-ERR unknown command\r\n";
	}
};
