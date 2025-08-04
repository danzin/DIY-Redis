import { ServerRole } from "./types";

export const serverInfo: {
  role: ServerRole;
  masterHost: string | null;
  masterPort: number | null;
  master_replid: string;
  master_repl_offset: number;
} = {
  role: 'master', // Start as master by default
  masterHost: null,
  masterPort: null,
  master_replid: '8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb',
  master_repl_offset: 0,
};