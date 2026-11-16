import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { apiKey } from "@better-auth/api-key";
import { sso } from "@better-auth/sso";
import { db } from "@crm/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { API_KEY_HEADER, API_KEY_PREFIX } from "../src/api-keys";
import {
	authBeforeGuards,
	isKeyRefusedPath,
	KEY_REFUSED_PATH_PREFIXES,
} from "../src/key-route-guard";

const suffix = process.env.TEST_RUN_ID ?? "key-route-guard-spec";
const BASE_URL = "http://localhost:3001";
const userId = `key-route-guard-${suffix}`;

// The CRM's own api-key and SSO setup, behind the same before-hook the CRM uses.
const guarded = betterAuth({
	baseURL: BASE_URL,
	secret: "key-route-guard-spec-secret-0123456789",
	database: prismaAdapter(db, { provider: "postgresql" }),
	emailAndPassword: { enabled: false },
	hooks: { before: authBeforeGuards },
	plugins: [
		sso({ organizationProvisioning: { disabled: true } }),
		apiKey({
			apiKeyHeaders: API_KEY_HEADER,
			defaultPrefix: API_KEY_PREFIX,
			enableSessionForAPIKeys: true,
			requireName: true,
			rateLimit: { enabled: false },
		}),
	],
});

let key: string;

type Body = Record<string, string | number | Record<string, string>>;

const call = (method: string, path: string, body?: Body, withKey = true) => {
	const headers = new Headers({
		"content-type": "application/json",
		origin: BASE_URL,
	});
	if (withKey) headers.set(API_KEY_HEADER, key);
	const init: RequestInit = { method, headers };
	if (body) init.body = JSON.stringify(body);
	return guarded.handler(new Request(`${BASE_URL}/api/auth${path}`, init));
};

beforeAll(async () => {
	await db.user.create({
		data: {
			id: userId,
			email: `${userId}@example.test`,
			name: "guard spec",
			emailVerified: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
	// Server-side, with no request: provisioning's path. The guard must let it through.
	const issued = await guarded.api.createApiKey({
		body: { userId, name: "guard-spec", expiresIn: 24 * 60 * 60 },
	});
	key = issued.key;
});

afterAll(async () => {
	await db.ssoProvider.deleteMany({ where: { userId } });
	await db.apikey.deleteMany({ where: { referenceId: userId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("the key-route guard (FAC-259)", () => {
	it("names /api-key/ and /sso/ and nothing else", () => {
		expect(KEY_REFUSED_PATH_PREFIXES).toEqual(["/api-key/", "/sso/"]);
		for (const path of [
			"/api-key/create",
			"/api-key/list",
			"/api-key/delete",
			"/sso/register",
			"/sso/providers",
		])
			expect(isKeyRefusedPath(path)).toBe(true);
		for (const path of [
			"/get-session",
			"/api-keys",
			"/ssoish",
			"/sign-in/social",
		])
			expect(isKeyRefusedPath(path)).toBe(false);
	});

	it("still lets a server-side call issue a key (no request, no key)", () => {
		expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
	});

	it("refuses a key on every key route, so a key can't mint, list or delete keys", async () => {
		const before = await db.apikey.count({ where: { referenceId: userId } });
		for (const [method, path, body] of [
			["GET", "/api-key/list"],
			[
				"POST",
				"/api-key/create",
				{ name: "minted-by-a-key", expiresIn: 86400 },
			],
			["POST", "/api-key/update", { keyId: "x", name: "y" }],
			["POST", "/api-key/delete", { keyId: "x" }],
		] as const) {
			const res = await call(method, path, body);
			expect(res.status).toBe(403);
		}
		expect(await db.apikey.count({ where: { referenceId: userId } })).toBe(
			before,
		);
	});

	it("refuses a key on SSO registration, and no provider is written", async () => {
		const res = await call("POST", "/sso/register", {
			providerId: "guard-spec",
			issuer: "https://idp.example.test",
			domain: "example.test",
			oidcConfig: { clientId: "c", clientSecret: "s" },
		});
		expect(res.status).toBe(403);
		expect(await db.ssoProvider.count({ where: { userId } })).toBe(0);
	});

	it("leaves the key working elsewhere, and leaves those routes as they were without a key", async () => {
		const session = await call("GET", "/get-session");
		expect(session.status).toBe(200);
		expect(
			((await session.json()) as { user?: { id: string } } | null)?.user?.id,
		).toBe(userId);
		expect((await call("GET", "/api-key/list", undefined, false)).status).toBe(
			401,
		);
	});
});
