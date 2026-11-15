import { loadRootEnv } from "@crm/env";

const DEFAULT_APP_URL = "http://localhost:3000";

loadRootEnv();

const origin =
	(process.env.APP_URL ?? "")
		.split(",")
		.map((candidate) => candidate.trim())
		.find(Boolean) ?? DEFAULT_APP_URL;
const url = new URL(origin);
const fallback = new URL(DEFAULT_APP_URL);

const child = Bun.spawn({
	cmd: [
		"next",
		"dev",
		"--hostname",
		url.hostname,
		"--port",
		url.port || fallback.port,
	],
	stdio: ["inherit", "inherit", "inherit"],
});

const stop = () => child.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

process.exit(await child.exited);
