This is a basic DYI Redis server written in TypeScript. It currently supports SET,GET,PING,ECHO.

It parses incomming commands with the DataParser class following the official Redis Serialization Protocol(RESP). SET/GET/XADD Operations are implemented with a map.

The project is in progress.

TODO: data persistance, data streaming, replication.
