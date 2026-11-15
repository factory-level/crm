import { createHmac, randomBytes } from "node:crypto";
import { SESSION_COOKIE_NAME } from "@crm/auth/cookies";
import { ensureWorkspaceMembership } from "@crm/auth/organization";
import { db } from "@crm/db";
import { NextResponse } from "next/server";
import { isLocalDev, LOCAL_DEV, localOrigin } from "@/lib/local-dev";

export async function POST(request: Request) {
	if (!isLocalDev()) return new Response(null, { status: 404 });
	const origin = localOrigin(request);
	if (!origin) return new Response(null, { status: 403 });

	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		return new Response("BETTER_AUTH_SECRET is not set.", { status: 503 });
	}

	const user = await db.user.upsert({
		where: { email: LOCAL_DEV.user.email },
		create: {
			id: crypto.randomUUID(),
			email: LOCAL_DEV.user.email,
			name: LOCAL_DEV.user.name,
			emailVerified: true,
			updatedAt: new Date(),
		},
		update: {},
	});

	const workspaceId = await ensureWorkspaceMembership(user.id);
	if (!workspaceId) {
		return new Response("The workspace is unavailable.", { status: 503 });
	}

	const token = randomBytes(32).toString("hex");
	const expiresAt = new Date(Date.now() + LOCAL_DEV.session.lifetimeMs);
	await db.session.create({
		data: {
			id: crypto.randomUUID(),
			token,
			userId: user.id,
			activeOrganizationId: workspaceId,
			expiresAt,
			updatedAt: new Date(),
		},
	});

	const signature = createHmac("sha256", secret).update(token).digest("base64");
	const response = NextResponse.redirect(new URL("/", origin), 303);
	response.cookies.set(SESSION_COOKIE_NAME, `${token}.${signature}`, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		expires: expiresAt,
	});
	return response;
}
