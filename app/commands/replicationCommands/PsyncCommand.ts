import { IReplicationCommand, RESPONSE_WRITTEN } from "../ICommand";
import * as net from "net";
import { serverInfo } from "../../config";

export class PsyncCommand implements IReplicationCommand {
  public readonly type = 'replication';
  constructor() {}

  public async execute(_args: string[], connection: net.Socket): Promise<typeof RESPONSE_WRITTEN> {
    const fullResyncResponse = `+FULLRESYNC ${serverInfo.master_replid} 0\r\n`;
		connection.write(fullResyncResponse);

		//empty RDB file from its hex representation
		// This is a placeholder for the actual RDB file content
		const emptyRdbHex =
			"524544495330303131fa0972656469732d76657205372e322e30fa0a72656469732d62697473c040fa056374696d65c26d08bc65fa08757365642d6d656dc2b0c41000fa08616f662d62617365c000fffe00f09f42777b";
		const rdbFileBuffer = Buffer.from(emptyRdbHex, "hex");

		const rdbHeader = `$${rdbFileBuffer.length}\r\n`;

		connection.write(Buffer.concat([Buffer.from(rdbHeader), rdbFileBuffer]));

		console.log("Sent FULLRESYNC and empty RDB file to replica.");

		// Take the exact socket object from the handshake and save it to the replicas array
		serverInfo.replicas.push(connection);
    
    return RESPONSE_WRITTEN
  }
}