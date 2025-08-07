# DIY-Redis

A Redis clone implemented in TypeScript to understand how caching systems work from the inside out.

### Work in progress.

![Redis_Logo](https://github.com/danzin/DIY-Redis/assets/8279984/a74d9d0a-153a-46d9-8b35-d60eaa09ab17)

#### The server listens for commands on the default Redis port 6379. It's compatible with all standard redis clients, tested and working with [redis-cli](https://redis.io/docs/latest/develop/connect/cli/) in Ubuntu and Debian.

## 🛠 Features

- **[Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)**  `XADD`, `XREAD`, `XRANGE`, `XREVRANGE`
- **[Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)**: Support for `--replicaof` flag. After starting the master server with `bun run dev`, replicas can be started with `bun run dev --port 6380 --replicaof "localhost 6379"`
  - Proper Handshake processing
  - Write commands processing
  - Master sending `REPLCONF GETACK *` receives a proper `REPLCONF ACK` response containing the total number of bytes of commands processed *before* receiving the current `REPLCONF GETACK` command
  - Multi-replica command propagation
  - Client blocking with `WAIT` - waits for either all required replicas to process previous commands and ACK, or for the timeout to finish and returns the number of replicas that ACKed
- **[Persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)**: Support for .rdb files. The system can write and read .rdb files utilizing `SAVE` and `KEYS` commands.
  - .rdb files can be saved and used on the server. The parser parses all necessary fields ensuring full compliance with the Redis RDB standard.
- **Basic commands:** `PING`, `SET`, `GET`, `DEL`, `INFO`, `TYPE`, `EXPIRE`, `EXISTS`, `SAVE`, `WAIT`. 
  - **SET** Has full support for all options: `EX`, `PX`, `NX`, `XX`, `KEEPTTL`, `PXAT`, `EXAT`  
- In-memory store with simple eviction logic


After receiving a command through redis-cli, the server parses it and sends a proper [RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/) response. All standard Redis formatting rules apply. 

![image](https://github.com/danzin/DIY-Redis/assets/8279984/b11ca00b-d196-4aa9-a086-5cc6fa4baef4)

The project is built with [Bun](https://bun.sh/) 

![logo-square](https://github.com/danzin/DIY-Redis/assets/8279984/d3372183-e1c0-43f3-a1da-e299aa910e13)

## 🚀 Running It

```bash 
bun install
bun run dev 











