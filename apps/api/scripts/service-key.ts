/**
 * The service account an outside platform calls this instance as (FAC-259, FAC-263): its user, its
 * `member` row and its API key, made server-side with no person at a browser and no request, so the
 * key-route guard is never involved.
 *
 *   bun scripts/service-key.ts provision --email <address> --days <1-365> --name <name> --out <new file>
 *   bun scripts/service-key.ts status --email <address>
 *
 * `provision` refuses unless ALLOWED_SIGN_IN names only that address. It writes the user and its
 * `member` row in one transaction (refusing an instance anyone else has joined), then issues a key
 * that expires. The key is written once to `--out`, a new file created mode 600, for the step that
 * stores it; it is never printed. `status` prints counts, the role, key ids and expiries: no secret.
 * Exit 0 on success; 2 on a refusal, which is also printed on stdout as `{"refused": "…"}`; 1 on
 * anything else.
 */
import { closeSync, openSync, writeSync } from "node:fs";
import { auth } from "@crm/auth/auth";
import {
	type CreateApiKey,
	issueServiceKey,
	provisionServiceAccount,
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

async function provision(): Promise<void> {
	const email = required("email");
	// keyLifetimeSeconds parses it: a whole number of days from 1 to 365; "1.5", "0" or "x" is refused.
	const days = Number(required("days"));
	const name = required("name");
	const out = required("out");
	if (!allowsOnly(email)) {
		throw new ServiceAccountError(
			`ALLOWED_SIGN_IN must name only ${email}: an instance with a service account lets nobody else exist`,
		);
	}
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
			"the service account already holds a live key; replacing it is rotation (FAC-263), or recreate this instance's database",
		);
	}
	const createApiKey: CreateApiKey = (input) =>
		auth.api.createApiKey(input) as ReturnType<CreateApiKey>;
	const issued = await issueServiceKey(db, createApiKey, {
		userId,
		name,
		days,
	});
	// A new file only, readable by this user alone: the one place the key is written.
	const fd = openSync(out, "wx", 0o600);
	try {
		writeSync(fd, `${JSON.stringify({ userId, ...issued })}\n`);
	} finally {
		closeSync(fd);
	}
	console.log(
		JSON.stringify({
			provisioned: true,
			userId,
			keyId: issued.keyId,
			expiresAt: issued.expiresAt,
		}),
	);
}

async function status(): Promise<void> {
	console.log(
		JSON.stringify(await serviceAccountStatus(db, required("email"))),
	);
}

const command = process.argv[2];
try {
	if (command === "provision") await provision();
	else if (command === "status") await status();
	else
		throw new ServiceAccountError(
			"usage: service-key.ts provision|status --email <address> …",
		);
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
