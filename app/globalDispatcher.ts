import net from 'net';
import { handleEchoCommand, handleGetCommand, handlePingCommand, handleSetCommand, handleTypeCommand, handleXaddCommand } from "./handlers";

export const globalCommandHandler = async(connection: net.Socket, payload: string[]): Promise<string> => {
  const [command, ...args] = payload.join(" ").split(" ");
  switch(command.toUpperCase()){
    case "ECHO":
      return handleEchoCommand(args);
    case "PING":
      return handlePingCommand(args);
    case "SET":
      return handleSetCommand(args);
    case "GET":
      return handleGetCommand(args);
    case "TYPE":
      return handleTypeCommand(args);
    case "XADD":
      return handleXaddCommand(args);

    default:
      return "-ERR unknown command\r\n";

  }


}