import type { GenericEndpointContext } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { API_KEY_HEADER } from "./api-keys";
import { checkSlackConnect } from "./slack-connect";

/**
 * Better Auth's own routes a request carrying an API key must never reach.
 *
 * The api-key plugin turns a valid key into its owner's session on every auth path, so without
 * this a key could list, create, update and delete keys (one that outlives its own revocation) and
 * register an SSO provider. The CRM's tRPC key routes already refuse a key
 * (`SessionOnlyMiddleware`); this is the same rule for Better Auth's router. Server-side
 * `auth.api.*` calls carry no key, so provisioning scripts are unaffected.
 */
export const KEY_REFUSED_PATH_PREFIXES = ["/api-key/", "/sso/"] as const;

/** Whether `path` (Better Auth's, without `/api/auth`) is one a key may not reach. */
export function isKeyRefusedPath(path: string): boolean {
	return KEY_REFUSED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Throws FORBIDDEN when a request carrying an API key asks for a key or SSO route. */
export function refuseKeyOnAuthRoutes(
	path: string,
	headers: Headers | undefined,
): void {
	if (!headers?.has(API_KEY_HEADER) || !isKeyRefusedPath(path)) return;
	throw new APIError("FORBIDDEN", {
		message:
			"An API key can't be used to manage API keys or SSO. Sign in to the CRM to do that.",
	});
}

/** Every check that runs before a Better Auth route: the key-route refusal, then Slack connect. */
export const authBeforeGuards = createAuthMiddleware(async (ctx) => {
	refuseKeyOnAuthRoutes(ctx.path, ctx.headers);
	await checkSlackConnect(ctx as GenericEndpointContext);
});
