export function detectServerRole(args: string[]) {
	let port = 6379;
	let role = "master";
	let masterHost: string | null = null;
	let masterPort: number | null = null;

	const portIndex = args.findIndex((arg) => arg === "--port");
	if (portIndex !== -1 && args[portIndex + 1]) {
		const customPort = parseInt(args[portIndex + 1], 10);
		if (!isNaN(customPort)) port = customPort;
	}

	const replicaOfIndex = args.findIndex((arg) => arg === "--replicaof");
	if (replicaOfIndex !== -1 && args[replicaOfIndex + 1]) {
		const firstArg = args[replicaOfIndex + 1];
		let host: string | undefined;
		let portStr: string | undefined;

		if (firstArg.includes(" ")) {
			[host, portStr] = firstArg.split(" ");
		} else if (args[replicaOfIndex + 2]) {
			host = firstArg;
			portStr = args[replicaOfIndex + 2];
		}

		// If host and port are successfully parsed, update the local variables
		if (host && portStr) {
			role = "slave";
			masterHost = host;
			masterPort = parseInt(portStr, 10);
		}
	}

	return { port, role, masterHost, masterPort };
}
