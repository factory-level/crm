import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { apiKey } from "@better-auth/api-key";
import { sso } from "@better-auth/sso";
import { db } from "@crm/db";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { organization } from "better-auth/plugins/organization";
import { API_KEY_HEADER, API_KEY_PREFIX } from "../src/api-keys";
import {
	authBeforeGuards,
	KEY_ALLOWED_PATHS,
	refuseKeyOnAuthRoutes,
} from "../src/key-route-guard";
import { WORKSPACE_ID } from "../src/organization";

const suffix = process.env.TEST_RUN_ID ?? "key-route-guard-spec";
const BASE_URL = "http://localhost:3001";
const userId = `key-route-guard-${suffix}`;
const memberId = `${userId}-member`;

// A route no plugin has today, standing in for one a future Better Auth version or plugin adds.
const future = {
	id: "key-route-guard-future",
	endpoints: {
		future: createAuthEndpoint(
			"/some-future-route",
			{ method: "GET" },
			async (ctx) => ctx.json({ reached: true }),
		),
	},
} satisfies BetterAuthPlugin;

// The CRM's own api-key, organization and SSO setup, behind the same before-hook the CRM uses.
const guarded = betterAuth({
	baseURL: BASE_URL,
	secret: "key-route-guard-spec-secret-0123456789",
	database: prismaAdapter(db, { provider: "postgresql" }),
	emailAndPassword: { enabled: false },
	hooks: { before: authBeforeGuards },
	plugins: [
		organization({
			allowUserToCreateOrganization: false,
			disableOrganizationDeletion: true,
			creatorRole: "owner",
		}),
		sso({ organizationProvisioning: { disabled: true } }),
		apiKey({
			apiKeyHeaders: API_KEY_HEADER,
			defaultPrefix: API_KEY_PREFIX,
			enableSessionForAPIKeys: true,
			requireName: true,
			rateLimit: { enabled: false },
		}),
		future,
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
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		create: {
			id: WORKSPACE_ID,
			name: "CRM",
			slug: "crm",
			createdAt: new Date(),
		},
		update: {},
	});
	await db.member.create({
		data: {
			id: memberId,
			organizationId: WORKSPACE_ID,
			userId,
			role: "member",
			createdAt: new Date(),
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
	await db.member.deleteMany({ where: { id: memberId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("the key guard: no Better Auth route answers an HTTP request carrying a key (FAC-259)", () => {
	it("allows no route, and refuses any path, a future one included, when a key comes over HTTP", () => {
		expect(KEY_ALLOWED_PATHS).toEqual([]);
		const withKey = new Headers({ [API_KEY_HEADER]: "crm_anything" });
		for (const path of [
			"/get-session",
			"/ok",
			"/update-user",
			"/organization/leave",
			"/api-key/list",
			"/sso/register",
			"/some-route-that-does-not-exist-yet",
		])
			expect(() => refuseKeyOnAuthRoutes(path, withKey, true)).toThrow(
				APIError,
			);
		// A server-side call, or a request without a key, is never refused.
		expect(() =>
			refuseKeyOnAuthRoutes("/get-session", withKey, false),
		).not.toThrow();
		expect(() =>
			refuseKeyOnAuthRoutes("/update-user", new Headers(), true),
		).not.toThrow();
	});

	it("still lets a server-side call issue a key (no request, no key)", () => {
		expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
	});

	it("still lets the CRM read the key's session server-side, the way its REST and tRPC layers do", async () => {
		const session = await guarded.api.getSession({
			headers: new Headers({ [API_KEY_HEADER]: key }),
		});
		expect(session?.user.id).toBe(userId);
	});

	it("refuses a key on get-session over HTTP", async () => {
		expect((await call("GET", "/get-session")).status).toBe(403);
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
			expect((await call(method, path, body)).status).toBe(403);
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

	it("refuses a key on the user and organization routes, so it can't rename itself, move its email or leave", async () => {
		for (const [method, path, body] of [
			["POST", "/update-user", { name: "renamed by a key" }],
			["POST", "/change-email", { newEmail: "moved@example.test" }],
			["POST", "/organization/leave", { organizationId: WORKSPACE_ID }],
			[
				"POST",
				"/organization/invite-member",
				{ email: "x@example.test", role: "owner" },
			],
			["GET", "/organization/list-members"],
			["POST", "/revoke-sessions", {}],
		] as const) {
			expect((await call(method, path, body)).status).toBe(403);
		}
		expect(await db.member.count({ where: { id: memberId } })).toBe(1);
		const user = await db.user.findUnique({
			where: { id: userId },
			select: { name: true, email: true },
		});
		expect(user).toEqual({
			name: "guard spec",
			email: `${userId}@example.test`,
		});
	});

	it("refuses a key on a route added later, which no list names", async () => {
		expect((await call("GET", "/some-future-route")).status).toBe(403);
	});

	it("leaves every route as it was for a request without a key", async () => {
		expect(
			(await call("GET", "/some-future-route", undefined, false)).status,
		).toBe(200);
		expect((await call("GET", "/get-session", undefined, false)).status).toBe(
			200,
		);
		expect((await call("GET", "/api-key/list", undefined, false)).status).toBe(
			401,
		);
		expect(
			(await call("POST", "/update-user", { name: "x" }, false)).status,
		).toBe(401);
	});
});
