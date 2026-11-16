import { describe, expect, it } from "bun:test";
import { join } from "node:path";

// isGoogleConfigured() and isMicrosoftConfigured() decide what the sign-in page offers. @crm/auth/env
// reads the environment once, on first import, so each case runs in a fresh process with exactly
// the variables it names; an empty value is unset (and keeps a root .env from supplying one).
const ENV_MODULE = join(import.meta.dir, "../src/env.ts");

type Providers = { google: boolean; microsoft: boolean };

function providersWith(vars: Record<string, string>): Providers {
	const script = `const m = await import(${JSON.stringify(ENV_MODULE)}); console.log(JSON.stringify({ google: m.isGoogleConfigured(), microsoft: m.isMicrosoftConfigured() }));`;
	const env = {
		PATH: process.env.PATH ?? "",
		HOME: process.env.HOME ?? "",
		GOOGLE_CLIENT_ID: "",
		GOOGLE_CLIENT_SECRET: "",
		MICROSOFT_CLIENT_ID: "",
		MICROSOFT_CLIENT_SECRET: "",
		...vars,
	};
	const run = Bun.spawnSync([process.execPath, "-e", script], { env });
	expect(run.exitCode).toBe(0);
	return JSON.parse(run.stdout.toString().trim().split("\n").at(-1) ?? "");
}

describe("which sign-in providers the environment configures", () => {
	it("none, when no client ids are set", () => {
		expect(providersWith({})).toEqual({ google: false, microsoft: false });
	});

	it("Google, when its id and secret are both set", () => {
		expect(
			providersWith({ GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" }),
		).toEqual({ google: true, microsoft: false });
	});

	it("Microsoft, when its id and secret are both set", () => {
		expect(
			providersWith({ MICROSOFT_CLIENT_ID: "m", MICROSOFT_CLIENT_SECRET: "s" }),
		).toEqual({ google: false, microsoft: true });
	});
});
