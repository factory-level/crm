/**
 * `bun run audit`: bun's own audit report, gated by the reviewed list in audit-allowlist.json.
 *
 * One entry per (bun advisory, package): bun reports one GHSA once per vulnerable range, so a
 * package with several installed versions has several entries. The audit fails when:
 * - bun reports an advisory for a package the list doesn't name, so a new advisory, or an old one
 *   reaching a new package, fails;
 * - an entry's severity differs from bun's;
 * - the list is invalid (every entry needs its ids, package, range, severity, kind and reason);
 * - bun can't produce a report (offline, for example): it fails closed.
 * A listed entry bun no longer reports fails in CI (`CI` set) and is a warning locally, so the list
 * shrinks as packages are upgraded.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as z from "zod";

const severity = z.enum(["low", "moderate", "high", "critical"]);

const entry = z.object({
	id: z.string().regex(/^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/),
	advisory: z.number().int().positive(),
	package: z.string().min(1),
	vulnerable: z.string().min(1),
	severity,
	title: z.string().min(1),
	kind: z.enum(["runtime", "dev-only"]),
	runtimeIn: z.array(z.string()),
	inInferOpsInstance: z.boolean(),
	reason: z.string().min(20),
});

const allowlist = z.object({
	reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	base: z.string().regex(/^[0-9a-f]{40}$/),
	advisories: z.array(entry),
});

/** What `bun audit --json` reports: each package's advisories. */
const report = z.record(
	z.string(),
	z.array(
		z.object({
			id: z.number().int(),
			url: z.string(),
			title: z.string(),
			severity,
		}),
	),
);

const root = join(import.meta.dir, "../..");
const listed = allowlist.safeParse(
	JSON.parse(readFileSync(join(root, "audit-allowlist.json"), "utf8")),
);
if (!listed.success) {
	console.error(
		`audit: audit-allowlist.json is not valid: ${listed.error.message}`,
	);
	process.exit(1);
}

const keyOf = (advisory: number, pkg: string) => `${advisory} ${pkg}`;
const known = new Map(
	listed.data.advisories.map((a) => [keyOf(a.advisory, a.package), a]),
);
if (known.size !== listed.data.advisories.length) {
	console.error("audit: audit-allowlist.json lists an entry twice");
	process.exit(1);
}

const run = spawnSync(process.execPath, ["audit", "--json"], {
	cwd: root,
	encoding: "utf8",
});
const parsed = report.safeParse(
	(() => {
		try {
			return JSON.parse(run.stdout);
		} catch {
			return null;
		}
	})(),
);
if (!parsed.success) {
	console.error(
		`audit: bun audit gave no report (exit ${run.status}); failing closed.\n${run.stderr}`,
	);
	process.exit(1);
}

const problems: string[] = [];
const seen = new Set<string>();
for (const [pkg, advisories] of Object.entries(parsed.data)) {
	for (const reported of advisories) {
		const key = keyOf(reported.id, pkg);
		seen.add(key);
		const listedEntry = known.get(key);
		if (!listedEntry) {
			problems.push(
				`new: ${reported.severity} ${pkg}: ${reported.title} (${reported.url})`,
			);
		} else if (listedEntry.severity !== reported.severity) {
			problems.push(
				`severity: ${pkg} ${listedEntry.id} is ${reported.severity} in bun's report, ${listedEntry.severity} in the list`,
			);
		}
	}
}

const stale = [...known.entries()]
	.filter(([key]) => !seen.has(key))
	.map(([, a]) => `${a.package} ${a.id} (${a.vulnerable})`);
if (stale.length > 0) {
	const line = `no longer reported, so remove from audit-allowlist.json: ${stale.join(", ")}`;
	if (process.env.CI) problems.push(`stale: ${line}`);
	else console.warn(`audit: ${line}`);
}

if (problems.length > 0) {
	console.error(`audit: ${problems.length} problem(s):`);
	for (const problem of problems) console.error(`  ${problem}`);
	process.exit(1);
}
console.log(
	`audit: ${seen.size} reported advisories, each listed and reviewed in audit-allowlist.json; none new.`,
);
