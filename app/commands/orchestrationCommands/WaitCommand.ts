import { IOrchestrationCommand } from '../ICommand';
import { ReplicationManager } from '../../replication/ReplicationManager';
import { EventEmitter } from 'events';

export class WaitCommand implements IOrchestrationCommand {
  readonly type = 'orchestration';
  
  constructor(private replicationManager: ReplicationManager) {}
  
  async execute(
    args: string[],
    replicationManager: ReplicationManager,
    waitAckEmitter: EventEmitter
  ): Promise<string> {
    if (args.length !== 2) {
      return "-ERR wrong number of arguments for 'wait' command\r\n";
    }
    const requiredReplicas = parseInt(args[0], 10);
    const timeout = parseInt(args[1], 10);
    const masterOffset = this.replicationManager.getMasterOffset();
    const numberOfReplicas = this.replicationManager.getReplicaCount();

    // No need to wait if there are no replicas or no writes have happened .
    if (numberOfReplicas === 0 || masterOffset === 0) {
      return `:${numberOfReplicas}\r\n`;
    }

    let ackCount = 0;
    // Send GETACK to all replicas
    this.replicationManager.requestAcks();

    return new Promise((resolve) => {
      const onAckReceived = (offset: number) => {
        if (offset >= masterOffset) {
          ackCount++;
          if (ackCount >= requiredReplicas) {
            // Cleanup and resolve
            waitAckEmitter.removeListener("ack", onAckReceived);
            clearTimeout(timeoutId);
            resolve(`:${ackCount}\r\n`); // resolve if the required number of replicas acknowledged
          }
        }
      };

      waitAckEmitter.on("ack", onAckReceived);
      const timeoutId = setTimeout(() => {
        // Cleanup and resolve
        waitAckEmitter.removeListener("ack", onAckReceived);
        resolve(`:${ackCount}\r\n`); // resolve with the number of replicas that acknowledged before the timeout
      }, timeout);
    });
  }
}