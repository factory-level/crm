import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { WORKSPACE_ID } from "@crm/db/workspace";
import type { ConfigService } from "@nestjs/config";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import type { EnvironmentVariables } from "../src/config/env.validation";
import { WorkspaceService } from "../src/workspace/workspace.service";

// GET /rest/workspace/identity (FAC-263): the instance's tenant and environment, and the calling
// key's standing, which InferOps checks before it uses a key.
const suffix = process.env.TEST_RUN_ID ?? "instance-identity-spec";
const userId = `identity-${suffix}`;
const otherId = `identity-other-${suffix}`;
const keyId = `identity-key-${suffix}`;
const expiresAt = new Date(Date.now() + 30 * 86_400_000);

type Member = {
	id: string;
	organizationId: string;
	userId: string;
	role: string;
	createdAt: Date;
};
let saved: Member[] = [];

const serviceWith = (
	vars: Partial<Record<keyof EnvironmentVariables, string>>,
) =>
	new WorkspaceService(
		db,
		{} as AgentTriggerService,
		{ get: (key: keyof EnvironmentVariables) => vars[key] } as ConfigService<
			EnvironmentVariables,
			true
		>,
	);

beforeAll(async () => {
	saved = await db.member.findMany({ where: { organizationId: WORKSPACE_ID } });
	await db.member.deleteMany({ where: { organizationId: WORKSPACE_ID } });
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
	for (const id of [userId, otherId])
		await db.user.create({
			data: {
				id,
				email: `${id}@example.test`,
				name: id,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});
	await db.member.create({
		data: {
			id: `${userId}-m`,
			organizationId: WORKSPACE_ID,
			userId,
			role: "member",
			createdAt: new Date(),
		},
	});
	await db.apikey.create({
		data: {
			id: keyId,
			referenceId: userId,
			key: "hashed",
			name: "n",
			expiresAt,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
});

afterAll(async () => {
	await db.apikey.deleteMany({ where: { id: keyId } });
	await db.member.deleteMany({ where: { userId: { in: [userId, otherId] } } });
	await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
	await db.member.deleteMany({ where: { organizationId: WORKSPACE_ID } });
	if (saved.length)
		await db.member.createMany({ data: saved, skipDuplicates: true });
});

describe("the instance's identity (FAC-263)", () => {
	it("names its tenant and environment, and the calling key's role, sole membership and expiry", async () => {
		const identity = await serviceWith({
			INFERLAB_TENANT_ID: "tenant-1",
			INFERLAB_ENVIRONMENT_ID: "stable",
		}).identity(userId, keyId);
		expect(identity).toEqual({
			tenantId: "tenant-1",
			environmentId: "stable",
			caller: {
				role: "member",
				onlyMember: true,
				apiKeyExpiresAt: expiresAt.toISOString(),
			},
		});
	});

	it("reports null ids when the instance wasn't given them, and no expiry for a session that isn't a key", async () => {
		const identity = await serviceWith({}).identity(userId, "not-a-key");
		expect(identity.tenantId).toBeNull();
		expect(identity.environmentId).toBeNull();
		expect(identity.caller.apiKeyExpiresAt).toBeNull();
	});

	it("says when the caller isn't the only member, and gives another user's key no expiry", async () => {
		await db.member.create({
			data: {
				id: `${otherId}-m`,
				organizationId: WORKSPACE_ID,
				userId: otherId,
				role: "owner",
				createdAt: new Date(),
			},
		});
		try {
			const mine = await serviceWith({}).identity(userId, keyId);
			expect(mine.caller.onlyMember).toBe(false);
			const theirs = await serviceWith({}).identity(otherId, keyId);
			expect(theirs.caller).toEqual({
				role: "owner",
				onlyMember: false,
				apiKeyExpiresAt: null,
			});
		} finally {
			await db.member.deleteMany({ where: { userId: otherId } });
		}
	});
});
