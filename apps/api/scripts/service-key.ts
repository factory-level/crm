/**
 * The service account an outside platform calls this instance as (FAC-259, FAC-263): its user, its
 * `member` row and its API keys, made server-side with no person at a browser and no request, so the
 * key guard is never involved.
 *
 *   bun scripts/service-key.ts provision --email <address> --days <1-365> --name <name> --out <new file>
 *   bun scripts/service-key.ts rotate --email <address> --days <1-365> --name <name> --out <new file>
 *   bun scripts/service-key.ts revoke --email <address> --keep <key id>
 *   bun scripts/service-key.ts status --email <address>
 *
 * `provision` refuses unless ALLOWED_SIGN_IN names only that address. It writes the user and its
 * `member` row in one transaction (refusing an instance anyone else has joined), then issues a key
 * that expires. `rotate` (FAC-263) issues the provisioned account a new key the same way and leaves
 * the old one working; once the caller has switched, `revoke --keep <new key id>` deletes every
 * other key of the account. A key never makes a key. A new key is written once to `--out`, a new
 * file created mode 600 before the key is minted, for the step that stores it; it is never printed.
 * `status` prints counts, the role, key ids and expiries: no secret.
 *
 * Exit 0 on success; 2 on a refusal, which is also printed on stdout as `{"refused": "…"}`; 1 on
 * anything else.
 */
import { closeSync, openSync, unlinkSync, writeSync } from "node:fs";
import { auth } from "@crm/auth/auth";
import {
	type CreateApiKey,
	type IssuedKey,
	issueServiceKey,
	provisionServiceAccount,
	revokeOtherServiceKeys,
	ServiceAccountError,
	serviceAccountStatus,
} from "@crm/auth/service-account";
import { allowsOnly } from "@crm/auth/workspace";
import { db } from "@crm/db";

function flag(name: string): string | undefined {
	const at = process.argv.indexOf(`--${name}`);
	return at > 0 ? process.argv[at + 1] : undefined;
}

function required(name: string): string {
	const value = flag(name);
	if (!value || value.startsWith("--")) {
		throw new ServiceAccountError(`--${name} is required`);
	}
	return value;
}

function onlyThisAddress(email: string): void {
	if (!allowsOnly(email)) {
		throw new ServiceAccountError(
			`ALLOWED_SIGN_IN must name only ${email}: an instance with a service account lets nobody else exist`,
		);
	}
}

/**
 * Issues `userId` a key that expires in `--days` and writes it once to `--out`. The output (a new
 * file, mode 600) is opened first, so a key is never minted with nowhere to go; a failed mint
 * removes the file, and a failed write deletes the key.
 */
async function issueAndWrite(
	userId: string,
	verb: "provisioned" | "rotated",
): Promise<void> {
	// keyLifetimeSeconds parses it: a whole number of days from 1 to 365; "1.5", "0" or "x" is refused.
	const days = Number(required("days"));
	const name = required("name");
	const out = required("out");
	const fd = openSync(out, "wx", 0o600);
	let issued: IssuedKey;
	try {
		const createApiKey: CreateApiKey = (input) =>
			auth.api.createApiKey(input) as ReturnType<CreateApiKey>;
		issued = await issueServiceKey(db, createApiKey, { userId, name, days });
	} catch (error) {
		closeSync(fd);
		unlinkSync(out);
		throw error;
	}
	try {
		writeSync(fd, `${JSON.stringify({ userId, ...issued })}\n`);
	} catch (error) {
		// The key couldn't be handed over: delete it rather than leave a live key nobody holds.
		await db.apikey.deleteMany({ where: { id: issued.keyId } });
		unlinkSync(out);
		throw error;
	} finally {
		closeSync(fd);
	}
	console.log(
		JSON.stringify({
			[verb]: true,
			userId,
			keyId: issued.keyId,
			expiresAt: issued.expiresAt,
		}),
	);
}

async function provision(): Promise<void> {
	const email = required("email");
	onlyThisAddress(email);
	const { userId } = await provisionServiceAccount(db, email);
	const status = await serviceAccountStatus(db, email);
	if (status.otherKeys > 0) {
		throw new ServiceAccountError(
			`${status.otherKeys} key(s) here belong to another user; this instance wasn't made for a service account (recreate its database)`,
		);
	}
	const now = Date.now();
	if (
		status.keys.some(
			(k) => k.enabled && k.expiresAt && Date.parse(k.expiresAt) > now,
		)
	) {
		throw new ServiceAccountError(
			"the service account already holds a live key; replacing it is `rotate`, or recreate this instance's database",
		);
	}
	await issueAndWrite(userId, "provisioned");
}

/** The provisioned service account's user id, checked as `provision` left it: the only member, as member. */
async function provisionedAccount(email: string): Promise<string> {
	onlyThisAddress(email);
	const status = await serviceAccountStatus(db, email);
	if (status.members !== 1 || status.serviceRole !== "member") {
		throw new ServiceAccountError(
			`the service account isn't this instance's only member with role member (${status.members} member(s), role ${status.serviceRole}); provision it first`,
		);
	}
	if (status.otherKeys > 0) {
		throw new ServiceAccountError(
			`${status.otherKeys} key(s) here belong to another user; refusing`,
		);
	}
	return status.userId;
}

async function rotate(): Promise<void> {
	await issueAndWrite(await provisionedAccount(required("email")), "rotated");
}

async function revoke(): Promise<void> {
	const userId = await provisionedAccount(required("email"));
	const keep = required("keep");
	const revoked = await revokeOtherServiceKeys(db, userId, keep);
	console.log(JSON.stringify({ revoked, kept: keep }));
}

async function status(): Promise<void> {
	console.log(
		JSON.stringify(await serviceAccountStatus(db, required("email"))),
	);
}

const commands = new Map([
	["provision", provision],
	["rotate", rotate],
	["revoke", revoke],
	["status", status],
]);

const command = commands.get(process.argv[2] ?? "");
try {
	if (!command) {
		throw new ServiceAccountError(
			"usage: service-key.ts provision|rotate|revoke|status --email <address> …",
		);
	}
	await command();
	await db.$disconnect();
} catch (error) {
	await db.$disconnect();
	if (error instanceof ServiceAccountError) {
		// On stdout too, as JSON, for a caller that captures only stdout. It names no secret.
		console.log(JSON.stringify({ refused: error.message }));
		console.error(`service-key: refused: ${error.message}`);
		process.exit(2);
	}
	console.error(
		`service-key: failed: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exit(1);
}
