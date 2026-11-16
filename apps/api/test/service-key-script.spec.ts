import { afterAll, beforeAll, describe, expect, it } from "bun:test";
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
});
