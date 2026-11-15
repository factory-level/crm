import type { AuthProvider } from "@refinedev/core";
import { sessionUser } from "../inferops-contract";
import { WORK } from "../work-config";
import { type RestClient, RestError } from "./rest-client";

type Credentials = { email: string; password: string };

export function inferopsAuthProvider(request: RestClient): AuthProvider {
	const currentUser = async () => {
		try {
			const payload = await request({
				method: "GET",
				path: WORK.inferops.mePath,
			});
			return sessionUser.parse(payload);
		} catch (error) {
			if (
				error instanceof RestError &&
				error.statusCode === WORK.status.unauthorized
			) {
				return null;
			}
			throw error;
		}
	};

	return {
		login: async (credentials: Credentials) => {
			try {
				await request({
					method: "POST",
					path: WORK.inferops.loginPath,
					body: credentials,
				});
				return { success: true, redirectTo: WORK.routes.dashboard };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error : new Error("Sign-in failed."),
				};
			}
		},
		logout: async () => {
			await request({ method: "POST", path: WORK.inferops.logoutPath });
			return { success: true, redirectTo: WORK.routes.login };
		},
		check: async () => {
			const user = await currentUser();
			return user
				? { authenticated: true }
				: { authenticated: false, redirectTo: WORK.routes.login };
		},
		getIdentity: currentUser,
		onError: async (error) => {
			const expired =
				error instanceof RestError &&
				error.statusCode === WORK.status.unauthorized;
			return expired ? { logout: true, error } : { error };
		},
	};
}
