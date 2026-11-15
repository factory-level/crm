import "@crm/env/load";
import { auth } from "@crm/auth/auth";
import { ensureWorkspaceMembership } from "@crm/auth/organization";
import { db } from "@crm/db";

const SERVICE = {
	email: "work-service@localhost",
	name: "Work service account",
	keyName: "work-mock-inferops",
} as const;

if (process.env.NODE_ENV === "production") {
	throw new Error("create-crm-key is a development helper.");
}

const user = await db.user.upsert({
	where: { email: SERVICE.email },
	create: {
		id: "work-service",
		email: SERVICE.email,
		name: SERVICE.name,
		emailVerified: true,
		updatedAt: new Date(),
	},
	update: {},
});

const workspaceId = await ensureWorkspaceMembership(user.id);
if (!workspaceId) {
	throw new Error("Could not enrol the service account in the workspace.");
}

const created = await auth.api.createApiKey({
	body: { name: SERVICE.keyName, userId: user.id },
});

process.stdout.write(
	`Add this line to the root .env, then restart the dev servers:\nWORK_CRM_API_KEY="${created.key}"\n`,
);

await db.$disconnect();
