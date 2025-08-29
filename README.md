# DIY-Redis

DIY-Redis is a lightweight Redis clone written in TypeScript with Bun.
It’s built to learn the inner workings of caching systems — from parsing RESP commands to replication, persistence, and streams.

![Redis_Logo](https://github.com/danzin/DIY-Redis/assets/8279984/a74d9d0a-153a-46d9-8b35-d60eaa09ab17)
#### The server listens for commands on the default Redis port 6379. It's compatible with all standard redis clients, tested and working with [redis-cli](https://redis.io/docs/latest/develop/connect/cli/) in Ubuntu and Debian.

## 📑 Table of Contents
- [Features](#-features)
- [Running It](#-running-it)
- [Usage](#usage)



### 🛠 Features
- [x] **Core commands**: `PING`, `SET`, `GET`, `DEL`, `INFO`, `TYPE`, `EXPIRE`, `EXISTS`, `SAVE`, `WAIT`. SET supports for all options: `EX`, `PX`, `NX`, `XX`, `KEEPTTL`, `PXAT`, `EXAT`
- [x] **Lists**: `RPUSH`, `LPUSH`, `LPOP`, `BLPOP` (with timeouts + replication support)
- [x] **Transactions**: `MULTI`, `EXEC`, `DISCARD`, `INCR` Support for multiple transactions
- [x] **Persistence**: `.rdb` read/write with compliance parser utilizing SAVE and KEYS commands
- [x] **Replication**: `--replicaof` flag, ACK handling, multi-replica propagation
- [x] **Pub/Sub**: `SUBSCRIBE`, `UNSUBSCRIBE`, `PUBLISH`
- [ ] Cluster mode (planned)
    
- In-memory store with simple eviction logic

### 🚀 Running It
  ```bash 
bun install
bun run dev
```

### Usage 
```
$ redis-cli -p 6379
127.0.0.1:6379> PING
PONG

127.0.0.1:6379> SET foo bar
OK

127.0.0.1:6379> GET foo
"bar"
```

After receiving a command through redis-cli, the server parses it and sends a proper [RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/) response. All standard Redis formatting rules apply. 

![image](https://github.com/danzin/DIY-Redis/assets/8279984/b11ca00b-d196-4aa9-a086-5cc6fa4baef4)

The project is built with [Bun](https://bun.sh/) 

![logo-square](https://github.com/danzin/DIY-Redis/assets/8279984/d3372183-e1c0-43f3-a1da-e299aa910e13)


















