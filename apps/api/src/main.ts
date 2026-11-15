import { Logger } from "@nestjs/common";
import { createApp } from "./create-app";

const LOOPBACK_HOST = "127.0.0.1";
const ANY_HOST = "0.0.0.0";

function localDevHost(): string {
	const localDev =
		process.env.CRM_LOCAL_DEV === "1" && process.env.NODE_ENV !== "production";
	return localDev ? LOOPBACK_HOST : ANY_HOST;
}

async function bootstrap() {
	const app = await createApp();
	app.enableShutdownHooks();

	const port = process.env.PORT ?? 3001;
	const host = localDevHost();
	await app.listen(port, host);

	new Logger("Bootstrap").log({
		message: `API listening on http://${host}:${port}`,
		port: Number(port),
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
