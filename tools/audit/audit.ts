/**
 * `bun run audit`: bun's own audit report, gated by the reviewed list in audit-allowlist.json.
 *
 * One entry per (bun advisory, package): bun reports one GHSA once per vulnerable range, so a
 * package with several installed versions has several entries. The rules are in judge.ts. The
 * audit fails when:
 * - bun reports an (advisory, package) the list doesn't name, so an old id in a new package fails;
 * - a severity differs from bun's;
 * - the list is invalid;
 * - bun can't produce a report, its report isn't a plain object of packages, or it contradicts
 *   bun's own exit status;
 * - bun reports nothing, or most of the list goes unreported at once, while the list isn't empty:
 *   a registry that serves no audit data must not pass.
 * A few listed entries no longer reported fail in CI (`CI` set) and are warnings locally, so the
 * list shrinks as packages are upgraded.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allowlist, judge, report } from "./judge";

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

const run = spawnSync(process.execPath, ["audit", "--json"], {
	cwd: root,
	encoding: "utf8",
	env: process.env,
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
		`audit: bun audit gave no report of packages (exit ${run.status}); failing closed.\n${run.stderr}`,
	);
	process.exit(1);
}

const verdict = judge(
	listed.data,
	parsed.data,
	run.status,
	Boolean(process.env.CI),
);
for (const warning of verdict.warnings) console.warn(`audit: ${warning}`);
if (verdict.problems.length > 0) {
	console.error(`audit: ${verdict.problems.length} problem(s):`);
	for (const problem of verdict.problems) console.error(`  ${problem}`);
	process.exit(1);
}
console.log(
	`audit: ${verdict.reported} reported advisories, each listed and reviewed in audit-allowlist.json; none new.`,
);
