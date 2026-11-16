import type { GenericEndpointContext } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { API_KEY_HEADER } from "./api-keys";
import { checkSlackConnect } from "./slack-connect";

/**
 * The Better Auth routes an HTTP request carrying an API key may reach: none.
 *
 * The api-key plugin turns a valid key into its owner's session on every Better Auth path. Without
 * this, a key could manage keys (one that outlives its own revocation) and SSO providers. It could
 * also act on its own account and the workspace as its user: leave the workspace (which then has no
 * members, so the next sign-in makes the oldest user owner), change members or organizations, change
 * its email or name, link accounts, or revoke sessions. A key is for the CRM's own REST and tRPC
 * routes, so every Better Auth route refuses an HTTP request that carries one, valid or not, and
 * whatever the route (one added later included). A route goes on this list only with a reason.
 *
 * Not refused: server-side `auth.api.*` calls, which have no HTTP request. That is how the REST and
 * tRPC layers read a key's session (`auth.api.getSession({ headers })`, `trpc.context.ts`) and how
 * provisioning issues keys.
 */
export const KEY_ALLOWED_PATHS: readonly string[] = [];

/**
 * Throws FORBIDDEN for an HTTP request to a Better Auth route that carries an API key. A server-side
 * call (`viaHttp` false) is never refused.
 */
export function refuseKeyOnAuthRoutes(
	path: string,
	headers: Headers | undefined,
	viaHttp: boolean,
): void {
	if (
		!viaHttp ||
		!headers?.has(API_KEY_HEADER) ||
		KEY_ALLOWED_PATHS.includes(path)
	)
		return;
	throw new APIError("FORBIDDEN", {
		message:
			"An API key can't be used on the CRM's sign-in routes. Use it on the CRM's REST API; sign in to the CRM to manage keys, SSO, the workspace or your account.",
	});
}

/** Every check that runs before a Better Auth route: the key refusal, then Slack connect. */
export const authBeforeGuards = createAuthMiddleware(async (ctx) => {
	refuseKeyOnAuthRoutes(ctx.path, ctx.headers, Boolean(ctx.request));
	await checkSlackConnect(ctx as GenericEndpointContext);
});
