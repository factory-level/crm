const DAY_MS = 24 * 60 * 60 * 1000;

export const LOCAL_DEV = {
	loginPath: "/api/dev/login",
	hosts: ["localhost", "127.0.0.1"],
	user: { email: "dev@localhost", name: "Local Developer" },
	session: { lifetimeMs: 7 * DAY_MS },
} as const;

export function isLocalDev(): boolean {
	return (
		process.env.CRM_LOCAL_DEV === "1" && process.env.NODE_ENV !== "production"
	);
}

export function localOrigin(request: Request): URL | null {
	const origin = request.headers.get("origin");
	if (!origin || !URL.canParse(origin)) return null;

	const url = new URL(origin);
	const sameHost = url.host === request.headers.get("host");
	const loopback = LOCAL_DEV.hosts.some((host) => host === url.hostname);

	return sameHost && loopback ? url : null;
}
