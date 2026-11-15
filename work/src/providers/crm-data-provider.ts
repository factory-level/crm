import type {
	BaseKey,
	CrudFilter,
	CrudSort,
	DataProvider,
	Pagination,
} from "@refinedev/core";
import {
	isSearchResource,
	listEnvelope,
	SEARCH_RESOURCES,
	savedRecord,
	TIMELINE_RESOURCE,
	timelineEnvelope,
} from "../resources";
import { WORK } from "../work-config";
import type { RestClient } from "./rest-client";

function searchResource(name: string) {
	if (!isSearchResource(name)) {
		throw new Error(`The work app has no CRM resource named "${name}".`);
	}
	return { name, ...SEARCH_RESOURCES[name] };
}

export function filterValue(
	filters: CrudFilter[] | undefined,
	field: string,
): string {
	for (const filter of filters ?? []) {
		if ("field" in filter && filter.field === field) {
			return String(filter.value ?? "");
		}
	}
	return "";
}

export function pageOf(pagination: Pagination | undefined) {
	return {
		page: pagination?.currentPage ?? 1,
		pageSize: Math.min(
			pagination?.pageSize ?? WORK.list.pageSize,
			WORK.list.maxPageSize,
		),
	};
}

function sortOf(sorters: CrudSort[] | undefined) {
	const first = sorters?.[0];
	return first ? { sort: first.field, dir: first.order } : {};
}

function recordPath(name: string, id: BaseKey): string {
	return `${WORK.inferops.crmPath}/${name}/${encodeURIComponent(String(id))}`;
}

export function crmDataProvider(request: RestClient): DataProvider {
	const timeline = async (filters: CrudFilter[] | undefined) => {
		const companyId = filterValue(filters, "companyId");
		if (!companyId) {
			throw new Error("The activity timeline needs a companyId filter.");
		}
		const payload = await request({
			method: "GET",
			path: `${WORK.inferops.crmPath}/${TIMELINE_RESOURCE}`,
			query: { companyId, limit: String(WORK.history.limit) },
		});
		const { entries } = timelineEnvelope.parse(payload);
		return { data: entries, total: entries.length };
	};

	return {
		getApiUrl: () => WORK.inferops.crmPath,

		getList: async ({ resource, pagination, sorters, filters }) => {
			if (resource === TIMELINE_RESOURCE) return timeline(filters);

			const { name, row } = searchResource(resource);
			const payload = await request({
				method: "POST",
				path: `${WORK.inferops.crmPath}/${name}/search`,
				body: {
					q: filterValue(filters, "q"),
					...sortOf(sorters),
					...pageOf(pagination),
				},
			});
			const { rows, total } = listEnvelope(row).parse(payload);
			return { data: rows, total };
		},

		getOne: async ({ resource, id }) => {
			const { name, record } = searchResource(resource);
			const payload = await request({
				method: "GET",
				path: recordPath(name, id),
			});
			return { data: record.parse(payload) };
		},

		create: async ({ resource, variables }) => {
			if (resource === TIMELINE_RESOURCE) {
				const payload = await request({
					method: "POST",
					path: `${WORK.inferops.crmPath}/${TIMELINE_RESOURCE}`,
					body: variables ?? {},
				});
				return { data: savedRecord.parse(payload) };
			}

			const { name } = searchResource(resource);
			const payload = await request({
				method: "POST",
				path: `${WORK.inferops.crmPath}/${name}`,
				body: variables ?? {},
			});
			return { data: savedRecord.parse(payload) };
		},

		update: async ({ resource, id, variables }) => {
			const { name } = searchResource(resource);
			const payload = await request({
				method: "PATCH",
				path: recordPath(name, id),
				body: { data: variables },
			});
			return { data: savedRecord.parse(payload) };
		},

		deleteOne: async ({ resource, id }) => {
			const { name } = searchResource(resource);
			const payload = await request({
				method: "POST",
				path: `${recordPath(name, id)}/archive`,
			});
			return { data: savedRecord.parse(payload) };
		},
	} as DataProvider;
}
