import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { db } from "@crm/db";
import { ensureWorkspaceMembership, WORKSPACE_ID } from "../src/organization";
import {
	type CreateApiKey,
	issueServiceKey,
	keyLifetimeSeconds,
	provisionServiceAccount,
	ServiceAccountError,
	serviceAccountStatus,
	serviceUserId,
} from "../src/service-account";

const suffix = process.env.TEST_RUN_ID ?? "service-account-spec";
const SERVICE = `inferops.${suffix}@service.example.test`;
const PERSON = `person-${suffix}`;

type Member = {
	id: string;
	organizationId: string;
	userId: string;
	role: string;
	createdAt: Date;
};
let saved: Member[] = [];

const roleOf = async (userId: string) =>
	(
		await db.member.findUnique({
			where: {
				organizationId_userId: { organizationId: WORKSPACE_ID, userId },
			},
			select: { role: true },
		})
	)?.role ?? null;

const clear = async () => {
	const ids = [serviceUserId(SERVICE), PERSON];
	await db.apikey.deleteMany({ where: { referenceId: { in: ids } } });
	await db.member.deleteMany({ where: { userId: { in: ids } } });
	await db.user.deleteMany({ where: { id: { in: ids } } });
};

beforeAll(async () => {
	// Provisioning needs a workspace nobody has joined: set aside whatever other suites left.
	saved = await db.member.findMany({ where: { organizationId: WORKSPACE_ID } });
	await db.member.deleteMany({ where: { organizationId: WORKSPACE_ID } });
});

beforeEach(clear);

afterAll(async () => {
	await clear();
	await db.member.deleteMany({ where: { organizationId: WORKSPACE_ID } });
	if (saved.length)
		await db.member.createMany({ data: saved, skipDuplicates: true });
});

describe("the service account (FAC-259)", () => {
	it("writes the user and its member row together, as member", async () => {
		const { userId, created } = await provisionServiceAccount(db, SERVICE);
		expect(created).toBe(true);
		expect(userId).toBe(serviceUserId(SERVICE));
		expect(await roleOf(userId)).toBe("member");
		expect(
			await db.member.count({ where: { organizationId: WORKSPACE_ID } }),
		).toBe(1);
		// Twice is the same account, still member.
		expect((await provisionServiceAccount(db, SERVICE)).created).toBe(false);
		expect(await roleOf(userId)).toBe("member");
	});

	it("never lets a later sign-in make anyone owner: the workspace already has its member", async () => {
		const { userId } = await provisionServiceAccount(db, SERVICE);
		await db.user.create({
			data: {
				id: PERSON,
				email: `${PERSON}@example.test`,
				name: "p",
				createdAt: new Date(0),
				updatedAt: new Date(),
			},
		});
		await ensureWorkspaceMembership(PERSON);
		expect(await roleOf(userId)).toBe("member");
		expect(await roleOf(PERSON)).toBe("member");
		expect(
			await db.member.count({
				where: { organizationId: WORKSPACE_ID, role: "owner" },
			}),
		).toBe(0);
	});

	it("refuses an instance someone else joined, and leaves no service user behind", async () => {
		await db.user.create({
			data: {
				id: PERSON,
				email: `${PERSON}@example.test`,
				name: "p",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});
		await db.member.create({
			data: {
				id: crypto.randomUUID(),
				organizationId: WORKSPACE_ID,
				userId: PERSON,
				role: "owner",
				createdAt: new Date(),
			},
		});
		await expect(provisionServiceAccount(db, SERVICE)).rejects.toThrow(
			/1 other member/,
		);
		expect(await db.user.count({ where: { id: serviceUserId(SERVICE) } })).toBe(
			0,
		);
	});

	it("refuses a service user that isn't member", async () => {
		const { userId } = await provisionServiceAccount(db, SERVICE);
		await db.member.update({
			where: {
				organizationId_userId: { organizationId: WORKSPACE_ID, userId },
			},
			data: { role: "owner" },
		});
		await expect(provisionServiceAccount(db, SERVICE)).rejects.toThrow(
			/is owner here, not member/,
		);
	});

	it("needs an expiry of 1 to 365 whole days, never none", () => {
		expect(keyLifetimeSeconds(1)).toBe(86400);
		expect(keyLifetimeSeconds(365)).toBe(365 * 86400);
		for (const bad of [null, 0, 366, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
			expect(() => keyLifetimeSeconds(bad)).toThrow(ServiceAccountError);
	});

	it("refuses and deletes a key issued with no expiry", async () => {
		const { userId } = await provisionServiceAccount(db, SERVICE);
		const fake: CreateApiKey = async () => {
			const row = await db.apikey.create({
				data: {
					id: `k-${suffix}`,
					referenceId: userId,
					key: "hashed",
					name: "n",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});
			return { id: row.id, key: "crm_secret", expiresAt: null };
		};
		await expect(
			issueServiceKey(db, fake, { userId, name: "n", days: 90 }),
		).rejects.toThrow(/no expiry/);
		expect(await db.apikey.count({ where: { referenceId: userId } })).toBe(0);
	});

	it("passes the expiry through, and status names keys without their secret", async () => {
		const { userId } = await provisionServiceAccount(db, SERVICE);
		let asked = 0;
		const fake: CreateApiKey = async ({ body }) => {
			asked = body.expiresIn;
			const expiresAt = new Date(Date.now() + body.expiresIn * 1000);
			await db.apikey.create({
				data: {
					id: `k2-${suffix}`,
					referenceId: userId,
					key: "hashed",
					name: body.name,
					expiresAt,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});
			return { id: `k2-${suffix}`, key: "crm_secret", expiresAt };
		};
		const issued = await issueServiceKey(db, fake, {
			userId,
			name: "n",
			days: 90,
		});
		expect(asked).toBe(90 * 86400);
		expect(Date.parse(issued.expiresAt)).toBeGreaterThan(Date.now());
		const status = await serviceAccountStatus(db, SERVICE);
		expect(status.members).toBe(1);
		expect(status.serviceRole).toBe("member");
		expect(status.keys.map((k) => k.keyId)).toEqual([`k2-${suffix}`]);
		expect(JSON.stringify(status)).not.toContain("crm_secret");
	});

	it("reports a service user that existed before provisioning by its own id", async () => {
		const legacy = `legacy-${suffix}`;
		await db.user.create({
			data: {
				id: legacy,
				email: SERVICE,
				name: "older",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});
		try {
			const { userId } = await provisionServiceAccount(db, SERVICE);
			expect(userId).toBe(legacy);
			const status = await serviceAccountStatus(db, SERVICE);
			expect(status.userId).toBe(legacy);
			expect(status.serviceRole).toBe("member");
			expect(status.members).toBe(1);
		} finally {
			await db.apikey.deleteMany({ where: { referenceId: legacy } });
			await db.member.deleteMany({ where: { userId: legacy } });
			await db.user.deleteMany({ where: { id: legacy } });
		}
	});
});
