import * as net from "net";
import * as fs from 'fs';
import * as path from 'path';
import { DataParser } from "./DataParser";
import { RedisStore } from './store/RedisStore';
import { serverInfo } from "./config";
import { MasterConnectionHandler } from "./replication/MasterConnectionHandler";
import { detectServerRole } from "./replication/serverSetup";
import { RDBParser } from "./persistence/RDBParser";
import { ConnectionState } from "./types";
import { ReplicationManager } from './replication/ReplicationManager';
import { createCommandRegistry } from './registry/CommandRegistry';
import { StreamEventManager } from "./commands/StreamEventManager";
import { SOLIDDispatcher } from "./SOLIDDispatcher";
import { ExecCommand } from "./commands/statefulCommands.ts/ExecCommand";


export class Server {
private server: net.Server;
  private redisStore: RedisStore;
  private dispatcher: SOLIDDispatcher;
  private replicationManager: ReplicationManager;
  private streamEventManager: StreamEventManager;
  private connectionStates = new Map<net.Socket, ConnectionState>();

  constructor() {
    this.redisStore = new RedisStore();
    this.replicationManager = new ReplicationManager();
    this.streamEventManager = new StreamEventManager();

    const commandMap = createCommandRegistry(
      this.redisStore, 
      this.replicationManager,
      this.streamEventManager
    );
    
    // Create the dispatcher
    this.dispatcher = new SOLIDDispatcher(commandMap, this.replicationManager);
    
    commandMap.set('exec', new ExecCommand(
      this.redisStore, 
      this.dispatcher.dispatch.bind(this.dispatcher)
    ));
    
    this.server = net.createServer(this.handleConnection.bind(this));
  }


  public start(): void {
    console.log("=== STARTUP DEBUG ===");
    console.log("process.argv:", process.argv);

    const { port, role, masterHost, masterPort, dir, dbfilename } = detectServerRole(process.argv);
    serverInfo.role = role as any;
    serverInfo.masterHost = masterHost;
    serverInfo.masterPort = masterPort;
    serverInfo.dir = dir;
    serverInfo.dbfilename = dbfilename;
    console.log("serverInfo set:", serverInfo);

    this.loadRDB();

    console.log("Started expiration check task");

    this.server.listen(port, "127.0.0.1", () => {
      console.log(`Redis server listening on 127.0.0.1:${port}`);
      

      if (serverInfo.role === 'slave' && serverInfo.masterHost && serverInfo.masterPort) {
        this.connectToMaster(serverInfo.masterHost, serverInfo.masterPort, port);
      }
      console.log("Server startup completed successfully");
    });

    this.server.on("error", (err: NodeJS.ErrnoException) => {
      console.error("Server listen error:", err);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      }
      process.exit(1);
    });
  }

  private handleConnection(connection: net.Socket): void {
    console.log("New connection established");

    //When new client connects, initialize iuts connection state in the map
    this.connectionStates.set(connection, {
      inTransaction: false,
      commandQueue: [],
      dataBuffer: Buffer.alloc(0), // Initialize with an empty buffer
    });

    connection.on("data", async (data: Buffer) => {
      const state = this.connectionStates.get(connection)!;
      state.dataBuffer = Buffer.concat([state.dataBuffer, data]);
       while (true) {     
        // Call the static method directly on the class, passing the buffer.
        const result = DataParser.parseNextCommand(state.dataBuffer);

        if (!result) break; // Incomplete command, wait for more data.

        const { payload, bytesConsumed } = result;

        try {
          const response = await this.dispatcher.dispatch(connection, payload, state);
          if (response) {
            connection.write(response);
          }
        } catch (error) {
          console.error("Error while dispatching command:", error);
          connection.write("-ERR internal server error\r\n");
        }
        
        state.dataBuffer = state.dataBuffer.slice(bytesConsumed);
      }
    });

    connection.on("error", (err) => {
      console.error("Connection error:", err);
    });

    connection.on("end", () => {
      console.log("Client disconnected");
    });
  }

  private loadRDB(): void {
    console.log("Loading RDB file during startup...");
    try {
      // The path from the tester is absolute. No special manipulation is needed.
      const dir = serverInfo.dir;
      const rdbFilePath = path.join(dir, serverInfo.dbfilename);
      console.log("Checking for RDB file at", rdbFilePath);

      if (fs.existsSync(rdbFilePath)) {
        const rdbFileBuffer = fs.readFileSync(rdbFilePath);
        if (rdbFileBuffer.length > 0) {
          const parser = new RDBParser(rdbFileBuffer, this.redisStore);
          parser.parse();
          console.log("RDB parsing completed successfully.");
        }
      }else {
        console.warn(`RDB file not found at ${rdbFilePath}. Starting with an empty database.`);
      }
    } catch (error) {
      console.error('Error reading or parsing RDB file:', error);
    }
  }

  private connectToMaster(masterHost: string, masterPort: number, replicaPort: number): void {
    console.log(`Connecting to master at ${masterHost}:${masterPort}`);
    const masterConnectionHandler = new MasterConnectionHandler(masterHost, masterPort, replicaPort);

     const replicaState: ConnectionState = {
        inTransaction: false,
        commandQueue: [],
        dataBuffer: Buffer.alloc(0) // This isn't used here, but completes the type.
      };

    masterConnectionHandler.on('command', (payload: string[]) => {
        this.dispatcher.dispatch(null, payload, replicaState);
    });

    try {
        masterConnectionHandler.connect();
        console.log("Master connection initiated");
    } catch (error) {
        console.error("Error connecting to master:", error);
    }
  }
}
