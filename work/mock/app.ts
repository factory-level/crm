import { z } from "zod";
import {
	type Job,
	loginInput,
	type OperationsSummary,
	type RecentJob,
	type SessionUser,
} from "../src/inferops-contract";
import { WORK } from "../src/work-config";
import { jobsForCustomer } from "./jobs";
import { MOCK_INFEROPS } from "./mock-config";

export type MockFetcher = (url: string, init: RequestInit) => Promise<Response>;

export type MockInferopsOptions = {
	crmUrl: string;
	crmApiKey: string | undefined;
	fetcher: MockFetcher;
	now: () => Date;
};

const NOT_CONNECTED =
	"The CRM is not connected. Set WORK_CRM_API_KEY in the root .env.";

const crmError = z.object({ message: z.string() });
const crmCount = z.object({ total: z.number() });
const crmCompanies = z.object({
	rows: z.array(z.object({ id: z.string(), name: z.string() })),
	total: z.number(),
});

class CrmUnavailable extends Error {}

type MockBody =
	| SessionUser
	| OperationsSummary
	| { rows: Job[]; total: number }
	| { message: string }
	| { ok: boolean };

function json(body: MockBody, status = 200, headers: HeadersInit = {}) {
	return Response.json(body, { status, headers });
}

function refusal(status: number, message: string) {
	return json({ message }, status);
}

function cookieValue(request: Request, name: string): string | undefined {
	for (const part of (request.headers.get("cookie") ?? "").split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return rest.join("=");
	}
	return undefined;
}

function sessionCookie(token: string, maxAgeSeconds: number): string {
	return [
		`${MOCK_INFEROPS.session.cookie}=${token}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${maxAgeSeconds}`,
	].join("; ");
}

function userFor(email: string): SessionUser {
	const local = email.split("@")[0] ?? email;
	const firstName = local.charAt(0).toUpperCase() + local.slice(1);
	return {
		id: `user-${local}`,
		email,
		firstName,
		lastName: "",
		fullName: firstName,
		tenantId: MOCK_INFEROPS.tenant.id,
		tenantName: MOCK_INFEROPS.tenant.name,
	};
}

function positive(value: string | null, fallback: number, max: number) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0
		? Math.min(parsed, max)
		: fallback;
}

export function createMockInferops(options: MockInferopsOptions) {
	const userOf = (request: Request) => {
		const token = cookieValue(request, MOCK_INFEROPS.session.cookie);
		const email = token ? Buffer.from(token, "base64url").toString() : "";
		return email ? userFor(email) : undefined;
	};

	const callCrm = async (path: string, init: RequestInit) => {
		if (!options.crmApiKey) throw new CrmUnavailable(NOT_CONNECTED);
		try {
			return await options.fetcher(
				`${options.crmUrl}${MOCK_INFEROPS.crm.restPath}${path}`,
				{
					...init,
					headers: {
						accept: "application/json",
						"content-type": "application/json",
						[MOCK_INFEROPS.crm.apiKeyHeader]: options.crmApiKey,
					},
				},
			);
		} catch {
			throw new CrmUnavailable(
				`The CRM API at ${options.crmUrl} did not answer.`,
			);
		}
	};

	const searchCrm = async (
		resource: string,
		page: number,
		pageSize: number,
	) => {
		const response = await callCrm(`/${resource}/search`, {
			method: "POST",
			body: JSON.stringify({ page, pageSize }),
		});
		if (!response.ok) {
			throw new CrmUnavailable(
				`The CRM refused the ${resource} search with status ${response.status}.`,
			);
		}
		return response.json();
	};

	const allCustomers = async () => {
		const { pageSize } = MOCK_INFEROPS.crm;
		const first = crmCompanies.parse(await searchCrm("companies", 1, pageSize));
		const pages = Math.ceil(first.total / pageSize);
		const rest = await Promise.all(
			Array.from({ length: Math.max(0, pages - 1) }, async (_, index) =>
				crmCompanies.parse(await searchCrm("companies", index + 2, pageSize)),
			),
		);
		return {
			total: first.total,
			rows: [first, ...rest].flatMap((page) => page.rows),
		};
	};

	const jobSummary = (customers: { id: string; name: string }[]) => {
		const now = options.now();
		const windowStart = now.getTime() - MOCK_INFEROPS.summary.windowMs;
		const jobs: RecentJob[] = customers.flatMap((customer) =>
			jobsForCustomer(customer.id, now).map((job) => ({
				...job,
				customerName: customer.name,
			})),
		);
		const recentlyDone = jobs.filter(
			(job) =>
				job.completedAt !== null &&
				new Date(job.completedAt).getTime() >= windowStart,
		);

		return {
			jobs: {
				open: jobs.filter(
					(job) => job.status === "scheduled" || job.status === "overdue",
				).length,
				overdue: jobs.filter((job) => job.status === "overdue").length,
				completedLast30Days: recentlyDone.length,
				revenueCentsLast30Days: recentlyDone.reduce(
					(sum, job) => sum + job.amountCents,
					0,
				),
			},
			recentJobs: jobs
				.filter((job) => new Date(job.scheduledAt).getTime() <= now.getTime())
				.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
				.slice(0, MOCK_INFEROPS.summary.recentJobs),
		};
	};

	const summary = async (): Promise<OperationsSummary> => {
		try {
			const [customers, contacts, deals] = await Promise.all([
				allCustomers(),
				searchCrm("contacts", 1, 1),
				searchCrm("deals", 1, 1),
			]);
			return {
				crm: {
					connected: true,
					customers: customers.total,
					contacts: crmCount.parse(contacts).total,
					deals: crmCount.parse(deals).total,
				},
				...jobSummary(customers.rows),
			};
		} catch (error) {
			if (!(error instanceof CrmUnavailable)) throw error;
			return {
				crm: { connected: false, reason: error.message },
				...jobSummary([]),
			};
		}
	};

	const login = async (request: Request) => {
		const parsed = loginInput.safeParse(await request.json().catch(() => null));
		if (!parsed.success) {
			return refusal(400, parsed.error.issues[0]?.message ?? "Sign-in failed.");
		}
		const user = userFor(parsed.data.email);
		const token = Buffer.from(user.email).toString("base64url");
		return json(user, 200, {
			"set-cookie": sessionCookie(token, MOCK_INFEROPS.session.maxAgeSeconds),
		});
	};

	const logout = () =>
		json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });

	const jobs = (url: URL) => {
		const customerId = url.searchParams.get("customerId");
		if (!customerId) return refusal(400, "The jobs list needs a customerId.");
		const settings = MOCK_INFEROPS.jobs;
		const page = positive(
			url.searchParams.get("page"),
			1,
			Number.MAX_SAFE_INTEGER,
		);
		const pageSize = positive(
			url.searchParams.get("pageSize"),
			settings.defaultPageSize,
			settings.maxPageSize,
		);
		const all = jobsForCustomer(customerId, options.now());
		return json({
			rows: all.slice((page - 1) * pageSize, page * pageSize),
			total: all.length,
		});
	};

	const crmProxy = async (request: Request, url: URL) => {
		if (
			!MOCK_INFEROPS.crm.methods.some((method) => method === request.method)
		) {
			return refusal(405, "The mock InferOps API never deletes a CRM record.");
		}
		const path = url.pathname.slice(WORK.inferops.crmPath.length);
		try {
			const response = await callCrm(`${path}${url.search}`, {
				method: request.method,
				body: request.method === "GET" ? undefined : await request.text(),
			});
			const payload = await response.json().catch(() => null);
			if (response.ok)
				return Response.json(payload, { status: response.status });
			const parsed = crmError.safeParse(payload);
			return refusal(
				response.status,
				parsed.success ? parsed.data.message : "The CRM refused the request.",
			);
		} catch (error) {
			if (!(error instanceof CrmUnavailable)) throw error;
			return refusal(503, error.message);
		}
	};

	return async (request: Request): Promise<Response> => {
		const url = new URL(request.url);
		const { inferops } = WORK;

		if (url.pathname === inferops.loginPath && request.method === "POST") {
			return login(request);
		}
		if (url.pathname === inferops.logoutPath && request.method === "POST") {
			return logout();
		}

		const user = userOf(request);
		if (!user) return refusal(401, "Sign in to InferOps first.");

		if (url.pathname === inferops.mePath) return json(user);
		if (url.pathname === inferops.jobsPath) return jobs(url);
		if (url.pathname === inferops.summaryPath) return json(await summary());
		if (url.pathname.startsWith(`${inferops.crmPath}/`)) {
			return crmProxy(request, url);
		}
		return refusal(404, `The mock InferOps API has no route ${url.pathname}.`);
	};
}
