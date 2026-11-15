# Onboard CRM completion plan: Stage 9 readiness report

* **Date:** 2026-11-14
* **Target:** `docs/designs/onboard-crm-completion-plan.md`
* **Stage:** EGM Stage 9, Implementation Readiness Test.
* **Reviewers:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`. Each ran in a fresh context with read-only tools.
* **Verdict on the first version:** not ready. 4 blockers, 9 major findings, 9 nits, and 15 style findings.
* **Verdict after the fixes:** each blocker and major finding is closed in the plan or by a command result.

## Blockers

| # | Finding | Resolution |
| --- | --- | --- |
| B1 | Step 2 did not state the `knip.json` edit for `dictionary-types.ts`. | knip 6.42.1 does not apply `ignoreIssues` inside a workspace block. The plan now holds the literal JSON at the top level. `bun run lint:dead` exits 0. |
| B2 | Step 2 named no place for the `row-accent.ts` entry. | The same top-level block holds `packages/ui/src/lib/row-accent.ts` with `["duplicates"]`. The fallback rule is removed: no symbol needs it. |
| B3 | Step 5 removed a container by a fixed name with no ownership check. A second CRM checkout runs on the machine. | The plan has a guard command and names the other checkout's container and port. That container was not touched. |
| B4 | Step 6 promised a list of upstream files and gave none. | `CONTRIBUTING.md` holds the table, and the plan holds a check in both directions. |

## Major findings

| # | Finding | Resolution |
| --- | --- | --- |
| M1 | No step said which bun the commands use. | The plan starts with the `export PATH` line. |
| M2 | Step 1 named a `docs/work.md` line that was not in the file, and omitted `bun.lock`. | Both are in the Change list, and the line is in `docs/work.md`. |
| M3 | The knip count was for `main`, not for the branch after Step 1. | knip ran on the branch. It reports nothing, and it does not report `vite`. |
| M4 | Step 5 lacked the count command, the tmux command and the rollback command. | All three are in the plan. |
| M5 | Step 5 stated two facts with no check. | The guard command checks the volume name. The count check proves the data. |
| M6 | Step 8 could read the upstream repository or a stale ref. | The commands pass `-R factory-level/crm` and fetch first. |
| M7 | Step 8 gave no commit rule and its check list did not match the hook. | The preconditions state the commit rule, `db:test`, and that `lint:dead` runs by hand. |
| M8 | The Google variables seemed to contradict the spec file. | The plan names the test that fails without them and the cause. |
| M9 | Branch protection could block the merge. | `gh api …/branches/main/protection` returns 404. |
| C7 | The fork rules contradict `AGENTS.md` and `CONTRIBUTING.md` on the pull request title. | The new section states that it wins on the fork, and gives the reason: no workflow is active. |

## Nits

- Literal text and anchors for the `docs/api.md`, `docs/setup.md` and `docs/work.md` edits: the plan now names each section and the first words of each addition.
- `git mv` does not apply to an untracked file: the plan uses `mv` and `git add`.
- The squash body: the merge command passes `--body ""`.
- The volume was created by `docker run`: `docker compose` attached it, and the company count is unchanged.

## Style

The style reviewer found 15 sentences that broke the Simplified Technical English rules: more than 20 words, two ideas in one sentence, passive voice, conditionals, and "step 2" used with two meanings. The plan is rewritten. Two findings are open by decision: `docker compose` output and tool names keep their own spelling.

## Not confirmed by a reviewer

No reviewer had a shell. These came from commands that the author ran: the knip output, the workflow list, the branch protection answer, the `OPTIONS` 404, the company counts and the test failure without the Google values.
