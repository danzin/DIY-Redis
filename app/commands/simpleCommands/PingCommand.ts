import { ISimpleCommand } from "../ICommand";
import { simpleStringResponse } from "../../utilities";

export class PingCommand implements ISimpleCommand {
	readonly type = "simple";
	constructor() {}
	public async execute(args: string[]): Promise<string> {
		return args.length > 0 ? simpleStringResponse(args[0]) : simpleStringResponse("PONG");
	}
}
