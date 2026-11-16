/**
 * The audit gate's judgement, kept apart from the process work so it can be tested (FAC-259).
 * `judge` compares bun's report with the reviewed list and returns the problems; an empty list
 * of problems passes.
 */
import * as z from "zod";

export const severity = z.enum(["low", "moderate", "high", "critical"]);

export const entry = z.object({
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

export const allowlist = z.object({
	reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	base: z.string().regex(/^[0-9a-f]{40}$/),
	advisories: z.array(entry),
});

/** What `bun audit --json` reports: a plain object of packages, each with its advisories. */
export const report = z.record(
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

export type Allowlist = z.infer<typeof allowlist>;
export type Report = z.infer<typeof report>;

/**
 * At most this many listed entries may go unreported at once before the report itself is doubted:
 * upgrades retire a few at a time, while a registry that serves no audit data retires all of them.
 */
export function staleLimit(listed: number): number {
	return Math.max(3, Math.floor(listed / 10));
}

export interface Verdict {
	problems: string[];
	warnings: string[];
	reported: number;
}

/**
 * The problems with bun's `report` (exit `status`) against the reviewed `list`. In CI any stale
 * entry fails; elsewhere up to {@link staleLimit} are only warnings.
 */
export function judge(
	list: Allowlist,
	parsed: Report,
	status: number | null,
	ci: boolean,
): Verdict {
	const problems: string[] = [];
	const warnings: string[] = [];
	const keyOf = (advisory: number, pkg: string) => `${advisory} ${pkg}`;
	const known = new Map(
		list.advisories.map((a) => [keyOf(a.advisory, a.package), a]),
	);
	if (known.size !== list.advisories.length)
		problems.push("the list names an entry twice");

	const seen = new Set<string>();
	for (const [pkg, advisories] of Object.entries(parsed)) {
		for (const reported of advisories) {
			const key = keyOf(reported.id, pkg);
			seen.add(key);
			const listed = known.get(key);
			if (!listed) {
				problems.push(
					`new: ${reported.severity} ${pkg}: ${reported.title} (${reported.url})`,
				);
			} else if (listed.severity !== reported.severity) {
				problems.push(
					`severity: ${pkg} ${listed.id} is ${reported.severity} in bun's report, ${listed.severity} in the list`,
				);
			}
		}
	}

	// bun audit exits 1 when it reports anything and 0 when it reports nothing; a report that
	// contradicts its own exit status isn't trusted.
	if (seen.size > 0 && status !== 1)
		problems.push(
			`bun reported ${seen.size} advisories but exited ${status}; the report isn't trusted`,
		);
	if (seen.size === 0 && status !== 0)
		problems.push(
			`bun reported nothing but exited ${status}; the report isn't trusted`,
		);

	const stale = [...known.entries()]
		.filter(([key]) => !seen.has(key))
		.map(([, a]) => `${a.package} ${a.id} (${a.vulnerable})`);
	if (known.size > 0 && seen.size === 0) {
		problems.push(
			`bun reported no advisories while the list names ${known.size}: a registry that serves no audit data looks like this, so the audit fails closed (if every package really was upgraded, empty the list)`,
		);
	} else if (stale.length > staleLimit(known.size)) {
		problems.push(
			`${stale.length} listed entries went unreported at once (more than ${staleLimit(known.size)}); the report is doubted, so the audit fails closed: ${stale.join(", ")}`,
		);
	} else if (stale.length > 0) {
		const line = `no longer reported, so remove from audit-allowlist.json: ${stale.join(", ")}`;
		if (ci) problems.push(`stale: ${line}`);
		else warnings.push(line);
	}
	return { problems, warnings, reported: seen.size };
}
