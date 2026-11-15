import { z } from "zod";

const JOB_STATUSES = ["scheduled", "overdue", "completed", "invoiced"] as const;

export const sessionUser = z.object({
	id: z.string(),
	email: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	fullName: z.string(),
	tenantId: z.string(),
	tenantName: z.string(),
});

export type SessionUser = z.infer<typeof sessionUser>;

export const loginInput = z.object({
	email: z.string().trim().min(1, "Enter an email."),
	password: z.string().min(1, "Enter a password."),
});

const job = z.object({
	id: z.string(),
	tenantId: z.string(),
	customerId: z.string(),
	title: z.string(),
	status: z.enum(JOB_STATUSES),
	technician: z.string(),
	scheduledAt: z.string(),
	completedAt: z.string().nullable(),
	amountCents: z.number(),
});

export type Job = z.infer<typeof job>;

export const jobList = z.object({ rows: z.array(job), total: z.number() });

const recentJob = job.extend({ customerName: z.string() });

export type RecentJob = z.infer<typeof recentJob>;

export const operationsSummary = z.object({
	crm: z.discriminatedUnion("connected", [
		z.object({
			connected: z.literal(true),
			customers: z.number(),
			contacts: z.number(),
			deals: z.number(),
		}),
		z.object({ connected: z.literal(false), reason: z.string() }),
	]),
	jobs: z.object({
		open: z.number(),
		overdue: z.number(),
		completedLast30Days: z.number(),
		revenueCentsLast30Days: z.number(),
	}),
	recentJobs: z.array(recentJob),
});

export type OperationsSummary = z.infer<typeof operationsSummary>;
