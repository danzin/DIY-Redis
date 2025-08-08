import * as net from 'net';
import { EventEmitter } from 'events';
import { serverInfo } from '../config';
import { toRESPArray } from '../utilities';

export class ReplicationManager {
  // The manager now owns the communication channel for ACKs.
  public readonly waitAckEmitter = new EventEmitter();

  public addReplica(socket: net.Socket): void { /* ... */ }
  public getReplicaCount(): number { return serverInfo.replicas.length; }
  public getMasterOffset(): number { return serverInfo.master_repl_offset; }

  public propagate(payload: string[]): void {
    if (serverInfo.replicas.length === 0) return;
    const commandAsRESP = toRESPArray(payload);
    const commandByteLength = Buffer.byteLength(commandAsRESP);
    for (const replicaSocket of serverInfo.replicas) {
      if (replicaSocket.writable) replicaSocket.write(commandAsRESP);
    }
    serverInfo.master_repl_offset += commandByteLength;
  }
  
  // New method for the WAIT command to use
  public requestAcks(): void {
    const getAckCommand = toRESPArray(['REPLCONF', 'GETACK', '*']);
    console.log(`Requesting ACKs from ${this.getReplicaCount()} replicas.`);
    serverInfo.replicas.forEach((socket) => socket.write(getAckCommand));
  }
  
  // New method for the dispatcher to use
  public receiveAck(offset: number): void {
    console.log(`Received ACK with offset ${offset}`);
    this.waitAckEmitter.emit('ack', offset);
  }
}