import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { allowlist, judge, type Report, report, staleLimit } from "./judge";

const root = join(import.meta.dir, "../..");
const list = allowlist.parse(
	JSON.parse(readFileSync(join(root, "audit-allowlist.json"), "utf8")),
);

/** The report bun would give for exactly the listed entries. */
function reportOf(entries = list.advisories): Report {
	const out: Report = {};
	for (const a of entries) {
		const forPackage = out[a.package] ?? [];
		forPackage.push({
			id: a.advisory,
			url: `https://github.com/advisories/${a.id}`,
			title: a.title,
			severity: a.severity,
		});
		out[a.package] = forPackage;
	}
	return out;
}

describe("the audit gate's judgement", () => {
	it("passes the report the list was reviewed against", () => {
		expect(judge(list, reportOf(), 1, true).problems).toEqual([]);
	});

	it("fails an empty report while the list names entries, locally and in CI", () => {
		for (const ci of [false, true]) {
			const verdict = judge(list, {}, 0, ci);
			expect(verdict.problems.join()).toMatch(
				/reported no advisories while the list names 51/,
			);
		}
	});

	it("passes an empty report only when the list is empty too", () => {
		expect(judge({ ...list, advisories: [] }, {}, 0, false).problems).toEqual(
			[],
		);
	});

	it("fails a report that contradicts bun's exit status", () => {
		expect(judge(list, reportOf(), 0, false).problems.join()).toMatch(
			/exited 0; the report isn't trusted/,
		);
		expect(
			judge({ ...list, advisories: [] }, {}, 1, false).problems.join(),
		).toMatch(/reported nothing but exited 1/);
	});

	it("fails when more than a few entries go unreported at once, even locally", () => {
		const most = list.advisories.slice(
			0,
			list.advisories.length - staleLimit(list.advisories.length) - 1,
		);
		expect(judge(list, reportOf(most), 1, false).problems.join()).toMatch(
			/went unreported at once/,
		);
	});

	it("keeps a single stale entry a warning locally and a failure in CI", () => {
		const allButOne = list.advisories.slice(1);
		const local = judge(list, reportOf(allButOne), 1, false);
		expect(local.problems).toEqual([]);
		expect(local.warnings.join()).toMatch(/no longer reported/);
		expect(judge(list, reportOf(allButOne), 1, true).problems.join()).toMatch(
			/^stale:/,
		);
	});

	it("fails a new advisory, an old id in a new package, and a severity unlike bun's", () => {
		const base = reportOf();
		const withNew: Report = {
			...base,
			"left-pad": [
				{
					id: 9,
					url: "https://github.com/advisories/GHSA-xxxx-xxxx-xxxx",
					title: "t",
					severity: "low",
				},
			],
		};
		expect(judge(list, withNew, 1, false).problems.join()).toMatch(
			/new: low left-pad/,
		);
		const first = list.advisories[0];
		if (!first) throw new Error("the list is empty");
		const moved = reportOf([
			...list.advisories,
			{ ...first, package: "other-package" },
		]);
		expect(judge(list, moved, 1, false).problems.join()).toMatch(
			/new: .* other-package/,
		);
		const wrong = reportOf(
			list.advisories.map((a, i) =>
				i === 0 ? { ...a, severity: "low" as const } : a,
			),
		);
		expect(judge(list, wrong, 1, false).problems.join()).toMatch(/^severity:/);
	});

	it("takes only a plain object of packages as a report", () => {
		for (const bad of [[], null, "x", 1, { pkg: "x" }])
			expect(report.safeParse(bad).success).toBe(false);
	});
});

/** Runs the real audit with bun pointed at `registry` (asynchronously, so a stub in this process can answer). */
async function auditAgainst(registry: string) {
	const child = Bun.spawn(
		[process.execPath, join(import.meta.dir, "audit.ts")],
		{
			cwd: root,
			env: { ...process.env, BUN_CONFIG_REGISTRY: registry, CI: "" },
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [code, stderr] = await Promise.all([
		child.exited,
		new Response(child.stderr).text(),
	]);
	return { code, stderr };
}

describe("the audit, end to end against a registry that serves no audit data", () => {
	it("fails closed when the registry answers {}", async () => {
		const server = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			fetch: () => Response.json({}),
		});
		try {
			const { code, stderr } = await auditAgainst(
				`http://127.0.0.1:${server.port}`,
			);
			expect(code).toBe(1);
			expect(stderr).toMatch(/reported no advisories while the list names/);
		} finally {
			server.stop(true);
		}
	}, 60_000);

	it("fails closed when the registry doesn't answer at all", async () => {
		// A port that was free a moment ago: nothing listens on it.
		const port = await new Promise<number>((done) => {
			const s = createServer().listen(0, "127.0.0.1", () => {
				const { port: p } = s.address() as { port: number };
				s.close(() => done(p));
			});
		});
		const { code } = await auditAgainst(`http://127.0.0.1:${port}`);
		expect(code).toBe(1);
	}, 60_000);
});
