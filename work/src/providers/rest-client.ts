import { z } from "zod";

const errorBody = z.object({ message: z.string() });

export class RestError extends Error {
	readonly statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.name = "RestError";
		this.statusCode = statusCode;
	}
}

type RestMethod = "GET" | "POST" | "PATCH";

export type RestRequest = {
	method: RestMethod;
	path: string;
	query?: Record<string, string>;
	body?: object;
};

export type RestClient = (request: RestRequest) => Promise<unknown>;

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export function createRestClient(
	baseUrl: string,
	fetcher: Fetcher,
): RestClient {
	return async ({ method, path, query, body }) => {
		const search = query ? `?${new URLSearchParams(query)}` : "";
		const sent = method === "GET" ? undefined : JSON.stringify(body ?? {});
		const response = await fetcher(`${baseUrl}${path}${search}`, {
			method,
			credentials: "include",
			headers: sent
				? { accept: "application/json", "content-type": "application/json" }
				: { accept: "application/json" },
			body: sent,
		});
		const payload = await response.json().catch(() => undefined);

		if (!response.ok) {
			const parsed = errorBody.safeParse(payload);
			throw new RestError(
				parsed.success
					? parsed.data.message
					: `${method} ${path} answered ${response.status}`,
				response.status,
			);
		}

		return payload;
	};
}
