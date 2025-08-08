import { serverInfo } from "../../config";
import { bulkStringResponse, simpleStringResponse } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class InfoCommand implements ISimpleCommand {
  readonly type = 'simple';
  constructor (){}

  async execute (args: string[]) : Promise<string> {
    const section = args[0]?.toLowerCase();
      if (!section || section === "replication" || section === "server") {
        const lines = [
          `role:${serverInfo.role}`,
          `master_replid:${serverInfo.master_replid}`,
          `master_repl_offset:${serverInfo.master_repl_offset}`,
        ];
  
        const responseString = lines.join("\r\n");
        return bulkStringResponse(responseString);
      }
      return bulkStringResponse("");
    }
  
    replconf(args: string[]): string {
    return simpleStringResponse("OK");
  }

}