import * as net from "net";
import { DataParser } from "./DataParser";
import { RedisStore } from './RedisStore';

import { globalCommandHandler } from "./globalDispatcher";

export const redisStore = new RedisStore();

const server: net.Server = net.createServer((connection: net.Socket) => {
  console.log("New connection established");

  connection.on("data", async (data: Buffer) => { 
    try {
      const parser = new DataParser(data);
      console.log("Received: ", parser.getReceivedData());
      
      const payload = parser.getPayload();
      const response = await globalCommandHandler(connection, payload);
      if (!response) return;
      console.log('globalCommandHandler response: ',response)
      connection.write(response);      
    } catch (error) {
      
    } 
  })
})

server.listen(6379, "127.0.0.1", () => {
  console.log("Server is listening on 127.0.0.1:6379");
});

server.on("error", (err) => {
  console.error("Server error:", err);
});

export { server };