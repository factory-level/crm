import { WORKSPACE_ROLES } from "@crm/auth/organization";
import { MAX_SLUG } from "@crm/db/workspace";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

export const memberListInput = listInput.extend({
	role: z.array(z.string()).default([]),
});

export type MemberListInput = z.infer<typeof memberListInput>;

export const updateWorkspaceInput = z.object({
	name: z.string().trim().min(1).max(120),
	website: z.string().trim().min(1).max(255),
	slug: z
		.string()
		.trim()
		.min(1)
		.max(MAX_SLUG)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
		.optional(),
});

export const setMemberRoleInput = z.object({
	memberId: z.string().min(1),
	role: z.enum(WORKSPACE_ROLES),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInput>;
export type SetMemberRoleInput = z.infer<typeof setMemberRoleInput>;

export const workspaceOutput = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	website: z.string().nullable(),
	onboarded: z.boolean(),
	viewerRole: z.enum(WORKSPACE_ROLES).nullable(),
	canRename: z.boolean(),
	canChangeRoles: z.boolean(),
});

export type Workspace = z.infer<typeof workspaceOutput>;

export const workspaceMemberOutput = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	role: z.enum(WORKSPACE_ROLES),
	joinedAt: z.string(),
	isViewer: z.boolean(),
});

export type WorkspaceMember = z.infer<typeof workspaceMemberOutput>;

export const memberListOutput = z.object({
	rows: z.array(workspaceMemberOutput),
	total: z.number(),
	facetCounts: z.record(z.string(), z.record(z.string(), z.number())),
});

/**
 * Who this instance is, and what the calling key may do (FAC-263). InferOps reads it before it uses
 * a key: the tenant and environment must be the caller's, the key's owner the only member, with role
 * `member`, and the key must expire. Identity only: the CRM never authorizes a call by these ids.
 */
export const instanceIdentityOutput = z.object({
	/** `INFERLAB_TENANT_ID`, or null when the instance wasn't given one. */
	tenantId: z.string().nullable(),
	/** `INFERLAB_ENVIRONMENT_ID`, or null when the instance wasn't given one. */
	environmentId: z.string().nullable(),
	caller: z.object({
		/** The calling user's workspace role, or null when not a member. */
		role: z.enum(WORKSPACE_ROLES).nullable(),
		/** Whether the caller is the workspace's only member. */
		onlyMember: z.boolean(),
		/** The calling API key's expiry, or null for a key with none or a call without a key. */
		apiKeyExpiresAt: z.string().nullable(),
	}),
});

export type InstanceIdentity = z.infer<typeof instanceIdentityOutput>;
