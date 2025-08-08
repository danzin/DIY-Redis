import { ISimpleCommand } from "../ICommand";
import { simpleErrorResponse, simpleStringResponse, bulkStringResponse, createExpirationDate } from "../../utilities";

export class EchoCommand implements ISimpleCommand {
	readonly type = "simple";
	constructor() {}
	public async execute(args: string[]): Promise<string> {
		return args.length > 0 ? simpleStringResponse(args[0]) : simpleStringResponse("");
	}
}
