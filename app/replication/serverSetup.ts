export function detectServerRole(args: string[]) {
	let port = 6379;
	let role = "master";
	let masterHost: string | null = null;
	let masterPort: number | null = null;
	let dir = process.cwd(); // Default to current working directory
	let dbfilename = "dump.rdb"; // Default filename

	console.log("Detecting server role and configuration from command line arguments...", args);

	const portIndex = args.findIndex((arg) => arg === "--port");
	if (portIndex !== -1 && args[portIndex + 1]) {
		const customPort = parseInt(args[portIndex + 1], 10);
		if (!isNaN(customPort)) {
			port = customPort;
		}
	}

	const dirIndex = args.findIndex((arg) => arg === "--dir");
	if (dirIndex !== -1 && args[dirIndex + 1]) {
		dir = args[dirIndex + 1].trim();
		console.log(`Custom directory detected: ${dir}`);
	}

	const dbfilenameIndex = args.findIndex((arg) => arg === "--dbfilename");
	if (dbfilenameIndex !== -1 && args[dbfilenameIndex + 1]) {
		dbfilename = args[dbfilenameIndex + 1].trim();
		console.log(`Custom dbfilename detected: ${dbfilename}`);
	}

	const replicaOfIndex = args.findIndex((arg) => arg === "--replicaof");
	if (replicaOfIndex !== -1 && args[replicaOfIndex + 1]) {
		const masterArgs = args.slice(replicaOfIndex + 1);
		if (masterArgs.length > 0) {
			const [host, portStr] = masterArgs[0].includes(" ") ? masterArgs[0].split(" ") : [masterArgs[0], masterArgs[1]];

			if (host && portStr) {
				role = "slave";
				masterHost = host.trim();
				masterPort = parseInt(portStr.trim(), 10);
			}
		}
		console.log(`Detected role: ${role}, masterHost: ${masterHost}, masterPort: ${masterPort}`);
	}
	console.log(
		`Final configuration: port=${port}, role=${role}, masterHost=${masterHost}, masterPort=${masterPort}, dir=${dir}, dbfilename=${dbfilename}`
	);

	return { port, role, masterHost, masterPort, dir, dbfilename };
}
