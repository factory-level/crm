import type { DataProvider } from "@refinedev/core";
import { jobList, operationsSummary } from "../inferops-contract";
import { WORK } from "../work-config";
import { filterValue, pageOf } from "./crm-data-provider";
import type { RestClient } from "./rest-client";

export const JOBS_RESOURCE = "jobs";

function refuse(operation: string) {
	return (): never => {
		throw new Error(`The mock InferOps API has no ${operation} operation.`);
	};
}

export function inferopsDataProvider(request: RestClient): DataProvider {
	return {
		getApiUrl: () => WORK.inferops.path,

		getList: async ({ resource, pagination, filters }) => {
			if (resource !== JOBS_RESOURCE) {
				throw new Error(
					`The mock InferOps API has no resource named "${resource}".`,
				);
			}
			const { page, pageSize } = pageOf(pagination);
			const payload = await request({
				method: "GET",
				path: WORK.inferops.jobsPath,
				query: {
					customerId: filterValue(filters, "customerId"),
					page: String(page),
					pageSize: String(pageSize),
				},
			});
			const { rows, total } = jobList.parse(payload);
			return { data: rows, total };
		},

		custom: async ({ url }) => {
			if (url !== WORK.inferops.summaryPath) {
				throw new Error(`The mock InferOps API has no custom route ${url}.`);
			}
			const payload = await request({ method: "GET", path: url });
			return { data: operationsSummary.parse(payload) };
		},

		getOne: refuse("getOne"),
		create: refuse("create"),
		update: refuse("update"),
		deleteOne: refuse("deleteOne"),
	} as DataProvider;
}
