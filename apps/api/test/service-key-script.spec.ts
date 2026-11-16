import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serviceUserId } from "@crm/auth/service-account";
import { db } from "@crm/db";
import { WORKSPACE_ID } from "@crm/db/workspace";

// `service-key provision` opens its output before it mints (FAC-259), so an output it can't create
// leaves no key behind. Runs the real script against the test database.
const suffix = process.env.TEST_RUN_ID ?? "service-key-script-spec";
const SERVICE = `inferops.${suffix}@service.example.test`;
const SCRIPT = join(import.meta.dir, "../scripts/service-key.ts");

type Member = {
	id: string;
	organizationId: string;
	userId: string;
	role: string;
	createdAt: Date;
};
let saved: Member[] = [];

const clear = async () => {
	const id = serviceUserId(SERVICE);
	await db.apikey.deleteMany({ where: { referenceId: id } });
	await db.member.deleteMany({ where: { userId: id } });
	await db.user.deleteMany({ where: { id } });
};

beforeAll(async () => {
	saved = await db.member.findMany({ where: { organizationId: WORKSPACE_ID } });
	await db.member.deleteMany({ where: { organizationId: WORKSPACE_ID } });
	await clear();
});

afterAll(async () => {
	await clear();
	await db.member.deleteMany({ where: { organizationId: WORKSPACE_ID } });
	if (saved.length)
		await db.member.createMany({ data: saved, skipDuplicates: true });
});

describe("service-key provision", () => {
	it("fails before minting when it can't create its output, so no key is left behind", async () => {
		const run = Bun.spawnSync(
			[
				process.execPath,
				SCRIPT,
				"provision",
				"--email",
				SERVICE,
				"--days",
				"30",
				"--name",
				"spec",
				"--out",
				"/nonexistent-dir/key.json",
			],
			{
				cwd: join(import.meta.dir, ".."),
				env: {
					...process.env,
					DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
					ALLOWED_SIGN_IN: SERVICE,
					BETTER_AUTH_SECRET: "service-key-script-spec-secret-0123456789",
				},
			},
		);
		expect(run.exitCode).toBe(1);
		expect(run.stdout.toString()).not.toContain("crm_");
		expect(
			await db.apikey.count({ where: { referenceId: serviceUserId(SERVICE) } }),
		).toBe(0);
	});

	it("rotates: a new key beside the old, then revoke --keep leaves only the new one (FAC-263)", async () => {
		const dir = mkdtempSync(join(tmpdir(), "service-key-spec-"));
		const script = (...args: string[]) =>
			Bun.spawnSync([process.execPath, SCRIPT, ...args], {
				cwd: join(import.meta.dir, ".."),
				env: {
					...process.env,
					DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
					ALLOWED_SIGN_IN: SERVICE,
					BETTER_AUTH_SECRET: "service-key-script-spec-secret-0123456789",
				},
			});
		const keyIdOf = (file: string) =>
			(JSON.parse(readFileSync(join(dir, file), "utf8")) as { keyId: string })
				.keyId;
		try {
			const first = script(
				"provision",
				"--email",
				SERVICE,
				"--days",
				"30",
				"--name",
				"spec",
				"--out",
				join(dir, "a.json"),
			);
			expect(first.exitCode).toBe(0);
			const rotated = script(
				"rotate",
				"--email",
				SERVICE,
				"--days",
				"30",
				"--name",
				"spec",
				"--out",
				join(dir, "b.json"),
			);
			expect(rotated.exitCode).toBe(0);
			expect(rotated.stdout.toString()).not.toContain("crm_");
			const [oldId, newId] = [keyIdOf("a.json"), keyIdOf("b.json")];
			const keys = () =>
				db.apikey.findMany({
					where: { referenceId: serviceUserId(SERVICE) },
					select: { id: true },
				});
			expect((await keys()).map((k) => k.id).sort()).toEqual(
				[oldId, newId].sort(),
			);
			// A kept key that isn't live revokes nothing: expire the new key, and keeping it is refused.
			const expired = new Date(Date.now() - 1000);
			const realExpiry = (
				await db.apikey.findUniqueOrThrow({
					where: { id: newId },
					select: { expiresAt: true },
				})
			).expiresAt;
			await db.apikey.update({
				where: { id: newId },
				data: { expiresAt: expired },
			});
			const dead = script("revoke", "--email", SERVICE, "--keep", newId);
			expect(dead.exitCode).toBe(2);
			expect(dead.stdout.toString()).toContain("isn't live");
			expect(await keys()).toHaveLength(2);
			await db.apikey.update({
				where: { id: newId },
				data: { enabled: false, expiresAt: realExpiry },
			});
			expect(
				script("revoke", "--email", SERVICE, "--keep", newId).exitCode,
			).toBe(2);
			expect(await keys()).toHaveLength(2);
			await db.apikey.update({ where: { id: newId }, data: { enabled: true } });
			// A key id that isn't the service account's revokes nothing.
			expect(
				script("revoke", "--email", SERVICE, "--keep", "someone-elses-key")
					.exitCode,
			).toBe(2);
			expect(await keys()).toHaveLength(2);
			const revoked = script("revoke", "--email", SERVICE, "--keep", newId);
			expect(revoked.exitCode).toBe(0);
			expect(JSON.parse(revoked.stdout.toString().trim())).toEqual({
				revoked: 1,
				kept: newId,
			});
			expect((await keys()).map((k) => k.id)).toEqual([newId]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
