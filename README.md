### This is a basic Redis implementation written in ![ts(1)](https://github.com/danzin/DIY-Redis/assets/8279984/e4d39203-9fd5-400d-841c-0cd3b0d61d4e)
### It is a work in progress.

![Redis_Logo](https://github.com/danzin/DIY-Redis/assets/8279984/a74d9d0a-153a-46d9-8b35-d60eaa09ab17)

#### The server listens for commands on the default Redis port 6379. It's compatible with all standard redis clients, tested and working with [redis-cli](https://redis.io/docs/latest/develop/connect/cli/).

After recieving a command through redis-cli, the server parses it and responds with a proper [RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/) response. So far it can handle PING, ECHO, SET, GET as well as [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/) with XADD, XREAD, XRANGE. All standard Redis formatting rules apply. 

![image](https://github.com/danzin/DIY-Redis/assets/8279984/b11ca00b-d196-4aa9-a086-5cc6fa4baef4)

The project is built with [Bun](https://bun.sh/) 

![logo-square](https://github.com/danzin/DIY-Redis/assets/8279984/d3372183-e1c0-43f3-a1da-e299aa910e13)

To start it, first install necessary dependencies with 
```bun install```
and run 
```bun run dev``` 


