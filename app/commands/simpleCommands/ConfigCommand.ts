import { serverInfo } from "../../config";
import { toRESPArray } from "../../utilities";
import { ISimpleCommand } from "../ICommand";

export class ConfigCommand implements ISimpleCommand {
	readonly type = "simple";

	async execute(args: string[]): Promise<string> {
		const subCommand = args[0]?.toLowerCase();
		const parameter = args[1]?.toLowerCase();

		if (subCommand !== "get" || !parameter) {
			return "-ERR Syntax error in CONFIG command\r\n";
		}

		let value: string | null = null;

		switch (parameter) {
			case "dir":
				value = serverInfo.dir;
				break;
			case "dbfilename":
				value = serverInfo.dbfilename;
				break;
			default:
				// For unsupported parameters, Redis returns an empty array
				return "*0\r\n";
		}

		// The response is an array of [parameter, value]
		return toRESPArray([parameter, value]);
	}
}
