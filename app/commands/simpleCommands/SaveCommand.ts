import { RDBWriter } from "../../persistence/RDBWriter";
import * as fs from "fs";
import * as path from "path";
import { ISimpleCommand } from "../ICommand";
import { RedisStore } from "../../store/RedisStore";
import { serverInfo } from "../../config";
import { simpleErrorResponse, simpleStringResponse } from "../../utilities";

export class SaveCommand implements ISimpleCommand {
	readonly type = "simple";

	constructor(private redisStore: RedisStore) {}

	async execute(args: string[]): Promise<string> {
		try {
			console.log("Starting SAVE operation...");

			// Use the RDBWriter to build the file content in memory
			const writer = new RDBWriter(this.redisStore);
			const rdbBuffer = writer.buildRDB();

			// Determine the full file path from config
			const rdbFilePath = path.join(serverInfo.dir, serverInfo.dbfilename);

			// Write the buffer to the file, overwriting it if it exists
			fs.writeFileSync(rdbFilePath, rdbBuffer);

			console.log(`DB saved on disk at ${rdbFilePath}`);
			return simpleStringResponse("OK");
		} catch (error) {
			console.error("Error during SAVE operation:", error);
			return simpleErrorResponse("Failed to save RDB file.");
		}
	}
}
