const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const MOCK_INFEROPS = {
	server: { host: "127.0.0.1", port: 3003 },
	session: { cookie: "inferops_mock_session", maxAgeSeconds: 8 * 60 * 60 },
	tenant: { id: "tenant-demo", name: "Demo Field Services" },
	crm: {
		defaultUrl: "http://localhost:3001",
		restPath: "/rest",
		apiKeyHeader: "x-api-key",
		pageSize: 100,
		methods: ["GET", "POST", "PATCH"],
	},
	jobs: {
		minPerCustomer: 3,
		maxPerCustomer: 8,
		historyMs: 180 * DAY_MS,
		futureMs: 30 * DAY_MS,
		durationMs: 3 * HOUR_MS,
		minAmountCents: 15_000,
		maxAmountCents: 480_000,
		completedShare: 0.6,
		invoicedShare: 0.25,
		defaultPageSize: 10,
		maxPageSize: 100,
	},
	summary: { windowMs: 30 * DAY_MS, recentJobs: 8 },
	titles: [
		"Quarterly maintenance visit",
		"Emergency repair call",
		"New equipment installation",
		"Safety inspection",
		"System calibration",
		"Warranty follow-up",
		"Site survey",
		"Preventive service",
	],
	technicians: ["Ada Okafor", "Marcus Lee", "Priya Nair", "Tomas Alvarez"],
} as const;
