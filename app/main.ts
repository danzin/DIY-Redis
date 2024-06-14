import * as net from "net";
import { DataParser } from "./dataParser";
import { CommonRequestCommands } from "./commands";
import { DataStorage } from "./dataStorage";

const encodeRedisResponse = (command: string, payload: string) => {
  return `+${payload}\r\n`;
};
const storage = new DataStorage();


const server: net.Server = net.createServer((connection: net.Socket) => {
  console.log("New connection established");
  
  connection.addListener("data", (data: Buffer) => {

    const parser = new DataParser(data);
    const command = parser.getCommand();
    const payload = parser.getPayload();

    let response: string;

    if(command){
      switch (command) {

        case CommonRequestCommands.SET:
          if (payload && payload.length >= 2) {
            storage.set(payload[0], payload[1], payload[2], payload[3]);
            response = encodeRedisResponse(CommonRequestCommands.SET, "OK");
          } else {
            response = "-ERR wrong number of arguments for 'set' command\r\n";
          }
        break;

        case CommonRequestCommands.GET:
          if (payload && payload.length >= 1) {
            const storedValue = storage.get(payload[0]);
            response = storedValue !== undefined
              ? encodeRedisResponse(CommonRequestCommands.GET, storedValue)
              : "$-1\r\n"; // Null bulk string response if the key doesn't exist
          } else {
            response = "-ERR wrong number of arguments for 'get' command\r\n";
          }
        break;

        case CommonRequestCommands.XADD:
          if (!payload || payload.length < 4) {
            response = "-ERR wrong number of arguments for 'XADD' command\r\n";
          } else { 
              const [streamKey, id, ...fields] = payload;
              storage.xadd(streamKey, id, ...fields);
              response = encodeRedisResponse(CommonRequestCommands.XADD, id);

          }
          
        break;

        case CommonRequestCommands.GETSTR:
          if (payload && payload.length >= 1) {
            const [streamKey] = payload;
            const streamEntries = storage.getStreamEntries(streamKey);
        
            if (streamEntries.size > 0) {
              const entriesArray: { id: string, entry: any }[] = [];
              streamEntries.forEach((entry, id) => {
                entriesArray.push({ id, entry });
              });
              response = encodeRedisResponse(CommonRequestCommands.GETSTR, JSON.stringify(entriesArray));
            } else {
              response = "$-1\r\n"; 
            }
          } else {
            response = "-ERR wrong number of arguments for 'getstr' command\r\n";
          }
        break;

        case CommonRequestCommands.PING:
          response = encodeRedisResponse(CommonRequestCommands.PING, "PONG");

        break;

        case CommonRequestCommands.ECHO:
          if (payload && payload.length >= 1) {
            response = encodeRedisResponse(CommonRequestCommands.ECHO, payload);
          }else {
            response = "-ERR wrong number of arguments for 'get' command\r\n";
          }

        break;
        
        case CommonRequestCommands.TYPE:
          if (payload && payload.length >= 1) {
            const type = storage.getType(payload[0]);
            !type  
              ? response = "+none\r\n"  
              : response = encodeRedisResponse(CommonRequestCommands.TYPE, type)
          }else {
            response = "-ERR wrong number of arguments for 'get' command\r\n";
          }

          break;

        default:
          response = "";
      }
    
    connection.write(response);
    }
  });

});
  

server.listen(6379, "127.0.0.1", () => {
  console.log("Server is listening on 127.0.0.1:6379");
});

server.on("error", (err) => {
  console.error("Server error:", err);
});
