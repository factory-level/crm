import { afterEach, describe, expect, it } from "bun:test";
import { POST } from "../app/api/dev/login/route";
import { isLocalDev } from "../lib/local-dev";

const LOGIN_URL = "http://127.0.0.1:3000/api/dev/login";

const saved = {
	NODE_ENV: process.env.NODE_ENV,
	CRM_LOCAL_DEV: process.env.CRM_LOCAL_DEV,
};

afterEach(() => {
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

function mode(nodeEnv: string, localDev: string) {
	Object.assign(process.env, { NODE_ENV: nodeEnv, CRM_LOCAL_DEV: localDev });
}

function login(origin: string | null) {
	return POST(
		new Request(LOGIN_URL, {
			method: "POST",
			headers: origin
				? { origin, host: "127.0.0.1:3000" }
				: { host: "127.0.0.1:3000" },
		}),
	);
}

describe("local dev login", () => {
	it("does not exist in production, whatever the flag says", async () => {
		mode("production", "1");

		expect(isLocalDev()).toBe(false);
		expect((await login("http://127.0.0.1:3000")).status).toBe(404);
	});

	it("does not exist until the flag is the literal 1", async () => {
		mode("development", "true");

		expect(isLocalDev()).toBe(false);
		expect((await login("http://127.0.0.1:3000")).status).toBe(404);
	});

	it("refuses a request from another origin before it reads the database", async () => {
		mode("development", "1");

		expect((await login("https://example.com")).status).toBe(403);
		expect((await login("http://127.0.0.1:9999")).status).toBe(403);
		expect((await login(null)).status).toBe(403);
	});
});
