import { simpleErrorResponse, simpleStringResponse } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class ReplconfCommand implements ISimpleCommand {
  readonly type = 'simple';
  
  constructor() {}

  public async execute(_args: string[]): Promise<string> {

    return simpleStringResponse("OK");
  }
}