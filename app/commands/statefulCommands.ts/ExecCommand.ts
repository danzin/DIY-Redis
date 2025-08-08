import { RedisStore } from "../../store/RedisStore";
import { ConnectionState } from "../../types";
import { formatArrayOfResponses, simpleErrorResponse } from "../../utilities";
import { IStatefulCommand } from "../ICommand";
import * as net from 'net';

export class ExecCommand implements IStatefulCommand {
  readonly type = 'stateful';
  
  constructor(
    private redisStore: RedisStore,
    private dispatchCallback: (
      conn: net.Socket | null,
      payload: string[],
      st: ConnectionState,
      isExec: boolean
    ) => Promise<string | undefined>
  ) {}
  
  async execute(
    args: string[],
    connection: net.Socket | null,
    state: ConnectionState
  ): Promise<string> {
    if (args.length > 0) {
      return simpleErrorResponse("wrong number of arguments for 'exec' command");
    }
    if (!state.inTransaction) {
      return simpleErrorResponse("EXEC without MULTI");
    }

    const responses: (string | number | null)[] = [];
    const queuedCommands = state.commandQueue;

    // Reset state immediately
    state.inTransaction = false;
    state.commandQueue = [];

    for (const payload of queuedCommands) {
      // Correctly create the temporary state object with all required properties.
      const tempState: ConnectionState = {
        inTransaction: false,
        commandQueue: [],
        dataBuffer: Buffer.alloc(0)
      };

      // Use the provided callback to dispatch the command.
      const rawResponse = await this.dispatchCallback(connection, payload, tempState, true);

      // --- Convert raw RESP to clean data ---
      if (!rawResponse) {
        responses.push(null);
      } else if (rawResponse.startsWith(':')) {
        responses.push(parseInt(rawResponse.substring(1), 10));
      } else if (rawResponse.startsWith('+')) {
        responses.push(rawResponse.substring(1).trim());
      } else if (rawResponse.startsWith('$-1')) {
        responses.push(null);
      } else if (rawResponse.startsWith('$')) {
        const lines = rawResponse.trim().split('\r\n');
        responses.push(lines.length > 1 ? lines[1] : null);
      } else {
        responses.push(rawResponse); // Fallback for simple errors
      }
    }

    return formatArrayOfResponses(responses);
  }
}
