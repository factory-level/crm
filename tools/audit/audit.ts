/**
 * `bun run audit`: bun's own audit, with the reviewed allowlist in audit-allowlist.json passed as
 * `--ignore` ids. A new advisory, or any advisory not on the list, still fails it, as before. An
 * entry needs an id, a severity, the packages, a kind and a reason, or the audit fails. An entry
 * bun no longer reports is named, so the list can shrink as packages are upgraded.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as z from "zod";

const entry = z.object({
	id: z.string().regex(/^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/),
	severity: z.enum(["low", "moderate", "high", "critical"]),
	packages: z.array(z.string().min(1)).min(1),
	title: z.string().min(1),
	kind: z.enum(["runtime", "dev-only"]),
	runtimeIn: z.array(z.string()),
	reason: z.string().min(10),
});

const allowlist = z.object({
	reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	base: z.string().regex(/^[0-9a-f]{40}$/),
	advisories: z.array(entry),
});

const root = join(import.meta.dir, "../..");
const parsed = allowlist.safeParse(
	JSON.parse(readFileSync(join(root, "audit-allowlist.json"), "utf8")),
);
if (!parsed.success) {
	console.error(`audit: audit-allowlist.json is not valid: ${parsed.error.message}`);
	process.exit(1);
}
const ids = parsed.data.advisories.map((a) => a.id);
if (new Set(ids).size !== ids.length) {
	console.error("audit: audit-allowlist.json lists an advisory twice");
	process.exit(1);
}

const bun = process.execPath;
const audit = spawnSync(bun, ["audit", ...ids.map((id) => `--ignore=${id}`)], {
	cwd: root,
	stdio: "inherit",
});

const reported = spawnSync(bun, ["audit", "--json"], { cwd: root, encoding: "utf8" });
const seen = new Set(
	[...reported.stdout.matchAll(/advisories\/(GHSA-[\w-]+)/g)].map((m) => m[1]),
);
const stale = ids.filter((id) => !seen.has(id));
if (reported.status !== null && stale.length > 0) {
	console.warn(
		`audit: no longer reported, so remove from audit-allowlist.json: ${stale.join(", ")}`,
	);
}
process.exit(audit.status ?? 1);
