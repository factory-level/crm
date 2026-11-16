import { Logger } from "@nestjs/common";
import { createApp } from "./create-app";

async function bootstrap() {
	const app = await createApp();
	app.enableShutdownHooks();

	const port = process.env.PORT ?? 3001;
	// HOST is optional: unset keeps the default (all interfaces); set it (for example 127.0.0.1) to
	// listen on that address only.
	const host = process.env.HOST || undefined;
	await (host ? app.listen(port, host) : app.listen(port));

	new Logger("Bootstrap").log({
		message: `API listening on http://${host ?? "localhost"}:${port}`,
		port: Number(port),
		host: host ?? "all interfaces",
		environment: process.env.NODE_ENV ?? "development",
	});
}

void bootstrap().catch((cause: unknown) => {
	new Logger("Bootstrap").fatal(
		{ message: "API failed to start" },
		cause instanceof Error ? cause.stack : String(cause),
	);
	process.exit(1);
});
