import { describe, expect, test } from "bun:test";
import { crmDataProvider } from "../src/providers/crm-data-provider";
import {
	createRestClient,
	RestError,
	type RestRequest,
} from "../src/providers/rest-client";

type Payload = NonNullable<RestRequest["body"]>;

function recordingClient(payload: Payload) {
	const requests: RestRequest[] = [];
	const provider = crmDataProvider(async (request) => {
		requests.push(request);
		return payload;
	});
	return { provider, requests };
}

const company = {
	id: "c1",
	name: "Acme",
	domain: "acme.com",
	industry: null,
	contactCount: 2,
	openDealCount: 1,
	lastActivityAt: null,
};

describe("crmDataProvider", () => {
	test("getList posts the search body and returns rows with the total", async () => {
		const { provider, requests } = recordingClient({
			rows: [company],
			total: 41,
			facetCounts: {},
		});

		const result = await provider.getList({
			resource: "companies",
			pagination: { currentPage: 2, pageSize: 10 },
			sorters: [{ field: "name", order: "desc" }],
			filters: [{ field: "q", operator: "contains", value: "ac" }],
		});

		expect(requests).toEqual([
			{
				method: "POST",
				path: "/inferops/crm/companies/search",
				body: { q: "ac", sort: "name", dir: "desc", page: 2, pageSize: 10 },
			},
		]);
		expect(result.total).toBe(41);
		expect(result.data).toEqual([company]);
	});

	test("getList caps the page size at the API maximum", async () => {
		const { provider, requests } = recordingClient({ rows: [], total: 0 });

		await provider.getList({
			resource: "deals",
			pagination: { currentPage: 1, pageSize: 5000 },
		});

		expect(requests[0]?.body).toEqual({ q: "", page: 1, pageSize: 100 });
	});

	test("the activity timeline reads one company and needs its id", async () => {
		const entry = {
			id: "a1",
			type: "NOTE",
			subject: "Called",
			body: null,
			occurredAt: null,
			createdAt: "2026-11-01T00:00:00.000Z",
		};
		const { provider, requests } = recordingClient({
			entries: [entry],
			nextCursor: null,
		});

		const result = await provider.getList({
			resource: "activities",
			filters: [{ field: "companyId", operator: "eq", value: "c1" }],
		});

		expect(requests).toEqual([
			{
				method: "GET",
				path: "/inferops/crm/activities",
				query: { companyId: "c1", limit: "50" },
			},
		]);
		expect(result.data).toEqual([entry]);
		await expect(provider.getList({ resource: "activities" })).rejects.toThrow(
			"companyId",
		);
	});

	test("getList rejects a row that does not match the resource schema", async () => {
		const { provider } = recordingClient({ rows: [{ id: 7 }], total: 1 });

		await expect(provider.getList({ resource: "contacts" })).rejects.toThrow();
	});

	test("an unknown resource is an error, not an empty list", async () => {
		const { provider, requests } = recordingClient({ rows: [], total: 0 });

		await expect(provider.getList({ resource: "invoices" })).rejects.toThrow(
			'no CRM resource named "invoices"',
		);
		expect(requests).toEqual([]);
	});

	test("create on the timeline writes a CRM activity", async () => {
		const { provider, requests } = recordingClient({ id: "a2" });

		await provider.create({
			resource: "activities",
			variables: { type: "NOTE", body: "Visited the site", companyId: "c1" },
		});

		expect(requests).toEqual([
			{
				method: "POST",
				path: "/inferops/crm/activities",
				body: { type: "NOTE", body: "Visited the site", companyId: "c1" },
			},
		]);
	});

	test("getOne reads the record by id", async () => {
		const { provider, requests } = recordingClient(company);

		const result = await provider.getOne({ resource: "companies", id: "c1" });

		expect(requests).toEqual([
			{ method: "GET", path: "/inferops/crm/companies/c1" },
		]);
		expect(result.data.id).toBe("c1");
	});

	test("update wraps the variables in data and accepts the short summary the CRM answers", async () => {
		const { provider, requests } = recordingClient({
			id: "c1",
			name: "Acme Ltd",
			domain: null,
		});

		await provider.update({
			resource: "companies",
			id: "c1",
			variables: { name: "Acme Ltd" },
		});

		expect(requests).toEqual([
			{
				method: "PATCH",
				path: "/inferops/crm/companies/c1",
				body: { data: { name: "Acme Ltd" } },
			},
		]);
	});

	test("deleteOne archives the record and never purges it", async () => {
		const { provider, requests } = recordingClient({ id: "c1", name: "Acme" });

		await provider.deleteOne({ resource: "companies", id: "c1" });

		expect(requests).toEqual([
			{ method: "POST", path: "/inferops/crm/companies/c1/archive" },
		]);
	});
});

describe("createRestClient", () => {
	test("a refused request throws the API message with its status", async () => {
		const request = createRestClient("", async () =>
			Response.json({ message: "Sign in first." }, { status: 401 }),
		);

		const failure = await request({
			method: "GET",
			path: "/inferops/crm/deals/d1",
		})
			.then(() => null)
			.catch((error: Error) => error);

		expect(failure).toBeInstanceOf(RestError);
		expect(failure?.message).toBe("Sign in first.");
		expect((failure as RestError).statusCode).toBe(401);
	});

	test("a write with no body still sends JSON, because the bridge refuses it otherwise", async () => {
		const sent: RequestInit[] = [];
		const request = createRestClient("", async (_input, init) => {
			sent.push(init);
			return Response.json({ id: "c1" });
		});

		await request({
			method: "POST",
			path: "/inferops/crm/companies/c1/archive",
		});

		expect(sent[0]?.body).toBe("{}");
		expect(sent[0]?.headers).toMatchObject({
			"content-type": "application/json",
		});
	});
});
