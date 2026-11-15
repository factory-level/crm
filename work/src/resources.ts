import { z } from "zod";

const companyRow = z.looseObject({
	id: z.string(),
	name: z.string(),
	domain: z.string().nullable(),
	industry: z.string().nullable(),
	contactCount: z.number(),
	openDealCount: z.number(),
	lastActivityAt: z.string().nullable(),
});

const companyRecord = z.looseObject({
	id: z.string(),
	name: z.string(),
	domain: z.string().nullable(),
	industry: z.string().nullable(),
	city: z.string().nullable().optional(),
	country: z.string().nullable().optional(),
});

const contactRow = z.looseObject({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string().nullable(),
	email: z.string().nullable(),
	title: z.string().nullable(),
	company: z.looseObject({ id: z.string(), name: z.string() }).nullable(),
});

const dealRow = z.looseObject({
	id: z.string(),
	name: z.string(),
	stage: z.string(),
	currency: z.string(),
});

const activityEntry = z.looseObject({
	id: z.string(),
	type: z.string(),
	subject: z.string().nullable(),
	body: z.string().nullable(),
	occurredAt: z.string().nullable(),
	createdAt: z.string(),
});

export const savedRecord = z.looseObject({ id: z.string() });

const record = savedRecord;

export const customerInput = z.object({
	name: z.string().trim().min(1, "A customer needs a name."),
	domain: z.string().trim(),
});

export type CustomerInput = z.infer<typeof customerInput>;

export const noteInput = z.object({
	body: z.string().trim().min(1, "Write the note first."),
});

export const SEARCH_RESOURCES = {
	companies: { row: companyRow, record: companyRecord },
	contacts: { row: contactRow, record },
	deals: { row: dealRow, record },
} as const;

export const TIMELINE_RESOURCE = "activities";

export const timelineEnvelope = z.object({ entries: z.array(activityEntry) });

export type SearchResourceName = keyof typeof SEARCH_RESOURCES;

export type CompanyRow = z.infer<typeof companyRow>;
export type CompanyRecord = z.infer<typeof companyRecord>;
export type ActivityEntry = z.infer<typeof activityEntry>;

export function isSearchResource(name: string): name is SearchResourceName {
	return name in SEARCH_RESOURCES;
}

export function listEnvelope<TRow extends z.ZodType>(row: TRow) {
	return z.object({ rows: z.array(row), total: z.number() });
}
