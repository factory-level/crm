import { describe, expect, test } from "bun:test";
import { createMockInferops, type MockFetcher } from "../mock/app";
import { jobsForCustomer } from "../mock/jobs";
import {
	jobList,
	operationsSummary,
	sessionUser,
} from "../src/inferops-contract";

const NOW = new Date("2026-11-14T12:00:00.000Z");
const ORIGIN = "http://mock.test";

type CrmCall = {
	url: string;
	method: string;
	key: string | null;
	body: string;
};

function crmStub(calls: CrmCall[]): MockFetcher {
	return async (url, init) => {
		calls.push({
			url,
			method: init.method ?? "GET",
			key: new Headers(init.headers).get("x-api-key"),
			body: String(init.body ?? ""),
		});
		if (url.endsWith("/companies/search")) {
			return Response.json({
				rows: [
					{ id: "c1", name: "Acme" },
					{ id: "c2", name: "Globex" },
				],
				total: 2,
			});
		}
		if (url.endsWith("/search")) return Response.json({ rows: [], total: 7 });
		if (url.endsWith("/companies/missing")) {
			return Response.json(
				{ message: "Not found.", data: { stack: "secret stack" } },
				{ status: 404 },
			);
		}
		return Response.json({ id: "c1", name: "Acme" });
	};
}

function mockWith(crmApiKey: string | undefined) {
	const calls: CrmCall[] = [];
	const app = createMockInferops({
		crmUrl: "http://crm.test",
		crmApiKey,
		fetcher: crmStub(calls),
		now: () => NOW,
	});
	return { app, calls };
}

async function signIn(app: (request: Request) => Promise<Response>) {
	const response = await app(
		new Request(`${ORIGIN}/inferops/auth/login`, {
			method: "POST",
			body: JSON.stringify({ email: "demo@inferops.test", password: "demo" }),
		}),
	);
	const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
	return { response, cookie };
}

function get(path: string, cookie: string) {
	return new Request(`${ORIGIN}${path}`, { headers: { cookie } });
}

describe("mock InferOps auth", () => {
	test("every route but login refuses a request with no session", async () => {
		const { app, calls } = mockWith("key");

		for (const path of [
			"/inferops/auth/me",
			"/inferops/jobs?customerId=c1",
			"/inferops/operations/summary",
			"/inferops/crm/companies/c1",
		]) {
			expect((await app(get(path, ""))).status).toBe(401);
		}
		expect(calls).toEqual([]);
	});

	test("the dummy login accepts any credentials and names the tenant", async () => {
		const { app } = mockWith("key");

		const { response, cookie } = await signIn(app);
		const me = await app(get("/inferops/auth/me", cookie));

		expect(response.status).toBe(200);
		expect(response.headers.get("set-cookie")).toContain("HttpOnly");
		expect(sessionUser.parse(await me.json())).toMatchObject({
			email: "demo@inferops.test",
			tenantId: "tenant-demo",
		});
	});

	test("the login refuses an empty password", async () => {
		const { app } = mockWith("key");

		const response = await app(
			new Request(`${ORIGIN}/inferops/auth/login`, {
				method: "POST",
				body: JSON.stringify({ email: "demo@inferops.test", password: "" }),
			}),
		);

		expect(response.status).toBe(400);
	});

	test("logout clears the session cookie", async () => {
		const { app } = mockWith("key");
		const { cookie } = await signIn(app);

		const response = await app(
			new Request(`${ORIGIN}/inferops/auth/logout`, {
				method: "POST",
				headers: { cookie },
			}),
		);

		expect(response.headers.get("set-cookie")).toContain(
			"inferops_mock_session=;",
		);
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
	});

	test("a session survives a restart of the mock", async () => {
		const { cookie } = await signIn(mockWith("key").app);

		const me = await mockWith("key").app(get("/inferops/auth/me", cookie));

		expect(sessionUser.parse(await me.json()).email).toBe("demo@inferops.test");
	});
});

describe("mock InferOps CRM bridge", () => {
	test("a CRM call carries the service key, which the browser never sends", async () => {
		const { app, calls } = mockWith("service-key");
		const { cookie } = await signIn(app);

		const response = await app(get("/inferops/crm/companies/c1", cookie));

		expect(await response.json()).toEqual({ id: "c1", name: "Acme" });
		expect(calls).toEqual([
			{
				url: "http://crm.test/rest/companies/c1",
				method: "GET",
				key: "service-key",
				body: "",
			},
		]);
	});

	test("DELETE is refused before it reaches the CRM, because DELETE is purge", async () => {
		const { app, calls } = mockWith("key");
		const { cookie } = await signIn(app);

		const response = await app(
			new Request(`${ORIGIN}/inferops/crm/companies/c1`, {
				method: "DELETE",
				headers: { cookie },
			}),
		);

		expect(response.status).toBe(405);
		expect(calls).toEqual([]);
	});

	test("a CRM error keeps its status and message and drops the stack", async () => {
		const { app } = mockWith("key");
		const { cookie } = await signIn(app);

		const response = await app(get("/inferops/crm/companies/missing", cookie));

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: "Not found." });
	});

	test("a missing service key is a 503, not an empty answer", async () => {
		const { app, calls } = mockWith(undefined);
		const { cookie } = await signIn(app);

		const response = await app(get("/inferops/crm/companies/c1", cookie));

		expect(response.status).toBe(503);
		expect(calls).toEqual([]);
	});
});

describe("mock InferOps operations", () => {
	test("jobs for one customer are stable, paged and tied to that customer", async () => {
		const { app } = mockWith("key");
		const { cookie } = await signIn(app);

		const first = jobList.parse(
			await (
				await app(get("/inferops/jobs?customerId=c1&pageSize=2", cookie))
			).json(),
		);
		const again = jobList.parse(
			await (
				await app(get("/inferops/jobs?customerId=c1&pageSize=2", cookie))
			).json(),
		);

		expect(first).toEqual(again);
		expect(first.rows).toHaveLength(2);
		expect(first.total).toBe(jobsForCustomer("c1", NOW).length);
		expect(first.rows.every((job) => job.customerId === "c1")).toBe(true);
	});

	test("the jobs list needs a customer", async () => {
		const { app } = mockWith("key");
		const { cookie } = await signIn(app);

		expect((await app(get("/inferops/jobs", cookie))).status).toBe(400);
	});

	test("the summary joins CRM counts with jobs for the CRM's customers", async () => {
		const { app } = mockWith("key");
		const { cookie } = await signIn(app);

		const summary = operationsSummary.parse(
			await (await app(get("/inferops/operations/summary", cookie))).json(),
		);
		const jobs = [...jobsForCustomer("c1", NOW), ...jobsForCustomer("c2", NOW)];

		expect(summary.crm).toEqual({
			connected: true,
			customers: 2,
			contacts: 7,
			deals: 7,
		});
		expect(summary.jobs.overdue).toBe(
			jobs.filter((job) => job.status === "overdue").length,
		);
		expect(
			summary.recentJobs.every((job) =>
				["Acme", "Globex"].includes(job.customerName),
			),
		).toBe(true);
	});

	test("the summary says the CRM is not connected when the key is missing", async () => {
		const { app } = mockWith(undefined);
		const { cookie } = await signIn(app);

		const summary = operationsSummary.parse(
			await (await app(get("/inferops/operations/summary", cookie))).json(),
		);

		expect(summary.crm.connected).toBe(false);
		expect(summary.recentJobs).toEqual([]);
	});
});
