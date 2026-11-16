import { createHash } from "node:crypto";
import type { Db } from "@crm/db";
import { workspaceSlug } from "@crm/db/workspace";
import * as z from "zod";
import { API_KEY_EXPIRATION, DAY_SECONDS } from "./api-keys";
import { DEFAULT_WORKSPACE_NAME, WORKSPACE_ID } from "./organization";

/**
 * The service account an outside platform (InferOps, FAC-263) calls this instance as, and its API
 * key. Nobody signs in as it. Everything here runs server-side inside the instance, with no request
 * and so no key, so the key-route guard never sees it.
 *
 * The account is a workspace `member`, never `owner` or `admin`, and its member row is written in
 * the same transaction as the user, before any key exists: otherwise the first sign-in to a
 * workspace with no members would enrol every existing user and make the oldest one owner
 * (`ensureWorkspaceMembership`).
 */
export class ServiceAccountError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ServiceAccountError";
	}
}

/** The service user's id for `email`: stable, so provisioning twice finds the same user. */
export function serviceUserId(email: string): string {
	const digest = createHash("sha256")
		.update(email.trim().toLowerCase())
		.digest("hex");
	return `svc-${digest.slice(0, 24)}`;
}

/** A service key's lifetime in days: a whole number from 1 to 365. There is no "never". */
export const serviceKeyDays = z
	.number()
	.int()
	.min(API_KEY_EXPIRATION.minDays)
	.max(API_KEY_EXPIRATION.maxDays);

/** A key's lifetime in seconds, from `days` parsed by {@link serviceKeyDays}; anything else is refused. */
export function keyLifetimeSeconds(days: number | null): number {
	const parsed = serviceKeyDays.safeParse(days);
	if (!parsed.success) {
		throw new ServiceAccountError(
			`a service key needs an expiry of ${API_KEY_EXPIRATION.minDays} to ${API_KEY_EXPIRATION.maxDays} whole days (got ${String(days)})`,
		);
	}
	return parsed.data * DAY_SECONDS;
}

/**
 * Creates the service user and its `member` row in one transaction, or finds them. Refuses an
 * instance where anyone else is a member, and a service user whose role isn't `member`; either
 * refusal rolls the transaction back, so nothing is left half-written.
 */
export async function provisionServiceAccount(
	db: Db,
	email: string,
	now: Date = new Date(),
): Promise<{ userId: string; created: boolean }> {
	const address = email.trim().toLowerCase();
	return db.$transaction(
		async (tx) => {
			await tx.organization.upsert({
				where: { id: WORKSPACE_ID },
				create: {
					id: WORKSPACE_ID,
					name: DEFAULT_WORKSPACE_NAME,
					slug: workspaceSlug(DEFAULT_WORKSPACE_NAME),
					createdAt: now,
				},
				update: {},
			});
			const members = await tx.member.findMany({
				where: { organizationId: WORKSPACE_ID },
				select: { userId: true, role: true },
			});
			const user = await tx.user.upsert({
				where: { email: address },
				create: {
					id: serviceUserId(address),
					email: address,
					name: "InferOps service",
					emailVerified: true,
					createdAt: now,
					updatedAt: now,
				},
				update: {},
				select: { id: true },
			});
			const others = members.filter((m) => m.userId !== user.id);
			if (others.length > 0) {
				throw new ServiceAccountError(
					`the workspace already has ${others.length} other member(s); a service account is provisioned only into an instance nobody else has joined`,
				);
			}
			const own = members.find((m) => m.userId === user.id);
			if (own && own.role !== "member") {
				throw new ServiceAccountError(
					`the service account is ${own.role} here, not member; refusing to issue it a key`,
				);
			}
			if (!own) {
				await tx.member.create({
					data: {
						id: crypto.randomUUID(),
						organizationId: WORKSPACE_ID,
						userId: user.id,
						role: "member",
						createdAt: now,
					},
				});
			}
			return { userId: user.id, created: !own };
		},
		{ isolationLevel: "Serializable" },
	);
}

/** Better Auth's server-side `auth.api.createApiKey`, as this module calls it. */
export type CreateApiKey = (input: {
	body: { userId: string; name: string; expiresIn: number };
}) => Promise<{ id: string; key: string; expiresAt: Date | string | null }>;

export interface IssuedKey {
	keyId: string;
	/** The secret. Hand it to the step that stores it; never print or log it. */
	key: string;
	expiresAt: string;
}

/** Issues the service user a new key that expires in `days`. A key issued with no expiry is deleted and refused. */
export async function issueServiceKey(
	db: Db,
	createApiKey: CreateApiKey,
	input: { userId: string; name: string; days: number },
): Promise<IssuedKey> {
	const expiresIn = keyLifetimeSeconds(input.days);
	const issued = await createApiKey({
		body: { userId: input.userId, name: input.name, expiresIn },
	});
	if (!issued.expiresAt) {
		await db.apikey.deleteMany({ where: { id: issued.id } });
		throw new ServiceAccountError(
			"the CRM issued a key with no expiry; it was deleted",
		);
	}
	return {
		keyId: issued.id,
		key: issued.key,
		expiresAt: new Date(issued.expiresAt).toISOString(),
	};
}

export interface ServiceStatus {
	members: number;
	serviceRole: string | null;
	keys: { keyId: string; expiresAt: string | null; enabled: boolean }[];
	/** Keys held by any other user: an instance a service account owns has none. */
	otherKeys: number;
}

/** The workspace's member count, the service user's role, its keys (ids and expiries, never a secret) and anyone else's key count. */
export async function serviceAccountStatus(
	db: Db,
	email: string,
): Promise<ServiceStatus> {
	const userId = serviceUserId(email);
	const [members, keys, otherKeys] = await Promise.all([
		db.member.findMany({
			where: { organizationId: WORKSPACE_ID },
			select: { userId: true, role: true },
		}),
		db.apikey.findMany({
			where: { referenceId: userId },
			select: { id: true, expiresAt: true, enabled: true },
			orderBy: { createdAt: "asc" },
		}),
		db.apikey.count({ where: { referenceId: { not: userId } } }),
	]);
	return {
		members: members.length,
		serviceRole: members.find((m) => m.userId === userId)?.role ?? null,
		keys: keys.map((k) => ({
			keyId: k.id,
			expiresAt: k.expiresAt?.toISOString() ?? null,
			enabled: k.enabled !== false,
		})),
		otherKeys,
	};
}
