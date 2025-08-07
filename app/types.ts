export type keyValueStore = {
	[key: string]: {
		value: string;
		expiration?: Date;
		type?: string | null;
	};
};

export type StoreValue = {
	value: any;
	expiration?: Date;
	type: "string" | "hash" | "list" | "set" | "none" | "stream" | "zset";
};
export type StreamEntry = [string, string[]];
export type EntryData = Record<string, string>;

export type ServerRole = "master" | "slave";
