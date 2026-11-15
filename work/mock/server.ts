import { loadRootEnv } from "@crm/env";
import { createMockInferops } from "./app";
import { MOCK_INFEROPS } from "./mock-config";

loadRootEnv();

const crmUrl = process.env.API_URL ?? MOCK_INFEROPS.crm.defaultUrl;
const crmApiKey = process.env.WORK_CRM_API_KEY || undefined;

const server = Bun.serve({
	hostname: MOCK_INFEROPS.server.host,
	port: MOCK_INFEROPS.server.port,
	fetch: createMockInferops({
		crmUrl,
		crmApiKey,
		fetcher: (url, init) => fetch(url, init),
		now: () => new Date(),
	}),
});

process.stdout.write(
	`Mock InferOps API on http://${server.hostname}:${server.port}, CRM at ${crmUrl}, CRM key ${crmApiKey ? "set" : "missing"}\n`,
);
