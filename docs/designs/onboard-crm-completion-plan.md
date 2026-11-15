# Onboard CRM: completion plan

* **Author:** Calvin Edwards
* **Date:** 2026-11-14
* **Scope:** the eight open issues of the Linear project "Onboard CRM". The inferCRM project is out of scope.
* **Branch:** `feat/work-refine-core`, pull request 1 in `factory-level/crm`.
* **Background:** `docs/designs/work-refine-app.md` and `docs/work.md`.
* **Review:** `docs/designs/onboard-crm-readiness-report.md` holds the Stage 9 findings. This version closes them.

Each step gives the files, the literal change, the check and the result. The steps run in this order.

Run every command in a shell that has bun 1.4.0 first on `PATH`:

```sh
export PATH="$HOME/.local/share/bun-1.4.0/node_modules/.bin:$PATH"
```

## Step 1 — FAC-255: type-check `work/vite.config.ts`

**Problem.** `@vitejs/plugin-react` and `@tailwindcss/vite` take their `Plugin` type from the package `vite`. `defineConfig` comes from `vite-plus`, which takes its types from `@voidzero-dev/vite-plus-core`. The two types do not match, so `tsc` fails on `vite.config.ts`.

**Change.**

- `work/package.json`: add the dev dependency `"vite": "npm:@voidzero-dev/vite-plus-core@1.3.0"`.
- `work/tsconfig.json`: add `"vite.config.ts"` to `include`.
- `bun.lock`: `bun install` writes one line for the alias.
- `docs/work.md`, section "Where things are": add a bullet that names the alias and states that it pins the `vite-plus` version.

**Check.** `bun run --filter=@crm/work check-types` and `bun run --filter=@crm/work build`.

**Result.** Both pass. knip does not report `vite` as unused.

**Risk.** A new `vite-plus` catalog version makes the alias version wrong. Change the alias in `work/package.json` to the new version in the same commit.

## Step 2 — FAC-256: make `bun run lint:dead` pass

**Problem.** knip reports nine findings. Eight are symbols and one is a pair of names with one value. The same nine are on `main` at `ee56599`.

**Change in code.** Remove the `export` keyword. Each symbol is still used in its own file.

| File | Line before | Line after |
| --- | --- | --- |
| `apps/api/src/activities/task-due-date.ts` | `export function taskDueDay(` | `function taskDueDay(` |
| `apps/app/components/crm/record-sheet/record-stack.ts` | `export function RecordStackProvider(` | `function RecordStackProvider(` |
| `apps/app/lib/recent-records.ts` | `export const recentRecord =` | `const recentRecord =` |
| `apps/app/app/(app)/[slug]/companies/import/csv-import.ts` | `export type CompanyImportResult =` | `type CompanyImportResult =` |
| `apps/app/lib/connection-result.ts` | `export type ProviderCardItem =` | `type ProviderCardItem =` |
| `apps/app/components/dashboard-charts.tsx` | `export type { DonutSlice, SeriesConfig } from …` | `export type { SeriesConfig } from …` |

**Change in `knip.json`.** knip 6.42.1 does not apply `ignoreIssues` inside a workspace block. The entry for `dictionary-types.ts` was in the `"."` workspace, and knip reported its two symbols. Move it to the top level and add the pair of names:

```json
{
	"ignoreIssues": {
		"tools/oxlint/anti-slop/shared/dictionary-types.ts": ["exports", "types"],
		"packages/ui/src/lib/row-accent.ts": ["duplicates"]
	},
	"workspaces": {
		".": { "project": ["tools/**/*.ts"] }
	}
}
```

`ROW_ACCENT` and `ROW_ACCENT_EXPANDABLE` keep one value. `simple-table.tsx` and `data-table.tsx` import both names.

**Check.** `bun run lint:dead`, `bun run check-types`, `bun run lint`.

**Result.** `lint:dead` exits 0.

**Risk.** Six upstream files change by one keyword each. `CONTRIBUTING.md` lists them.

## Step 3 — FAC-248: record the decision on CORS for `/rest`

**Problem.** The `/rest` bridge sends no CORS header. A browser on another origin cannot call it.

**Decision.** The bridge stays same-origin. No code changes. The reasons:

- The work app reaches the CRM through a server, the mock InferOps API. InferOps does the same in the inferCRM design.
- The bridge accepts a session cookie or a service key. A CORS header lets browser code call the bridge, and a key in browser code is not secret.
- A change to `apps/api/src/create-app.ts` adds a conflict on each upstream merge.

**Change.** `docs/api.md`, section "The OpenAPI document is built at runtime, not committed": add one paragraph before "Two rules follow for the serverless build". It starts with "**The bridge sends no CORS header, by decision.**"

**Check.** With the dev servers up, and `API_URL` from the root `.env`:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$API_URL/rest/companies/search" \
  -H 'Origin: http://127.0.0.1:3002' -H 'Access-Control-Request-Method: POST'
```

**Result.** 404, which agrees with the paragraph.

## Step 4 — FAC-249: document the bun 1.4.0 toolchain

**Problem.** The fork needs bun 1.4.0. An older bun stops at `bun install` with `Unknown lockfile version`.

**Change.** `docs/setup.md`: add the section "bun 1.4.0 beside another bun" before "First run". It holds the `npm install --prefix` command, the `export PATH` line, and two rules: run the `export` line in each shell, and run it before `git push`.

**Check.** In a new shell with only the `export` line, `bun --version` prints `1.4.0`.

**Result.** `1.4.0`.

## Step 5 — FAC-250: start Postgres with `docker compose`

**Problem.** The author started the `crm-postgres` container with `docker run`, because Docker had no free network address pool. The author then removed 25 unused networks.

**Guard.** A second CRM checkout runs on this machine, at `eve-foundation/crm`. Its database container is `eve-foundation-local-postgres-1` on port 55432. No command in this step names it. Before the first command, confirm that `crm-postgres` belongs to this checkout:

```sh
docker inspect crm-postgres --format '{{range .Mounts}}{{.Name}}{{end}} {{.HostConfig.PortBindings}}'
```

It must print the volume `crm_crm-postgres` and the host port 5433.

**Commands.**

```sh
docker exec crm-postgres psql -U postgres -d crm -Atc 'select count(*) from company'   # record the number
tmux kill-session -t crm-dev
docker rm -f crm-postgres
docker compose up -d
tmux new-session -d -s crm-dev -c "$HOME/Projects/crm" \
  "PATH=$HOME/.local/share/bun-1.4.0/node_modules/.bin:\$PATH bun run dev"
```

`docker compose` reads `CRM_POSTGRES_PORT=5433` from `.env`, names the project `crm` after the directory, and attaches the volume `crm_crm-postgres`.

**Change.** `docker-compose.yml`: publish the port on loopback only, `"127.0.0.1:${CRM_POSTGRES_PORT:-5432}:5432"`. The database uses the default password, so it must not listen on the network.

**Check.** The project label is `crm`, and the company count equals the recorded number:

```sh
docker inspect crm-postgres --format '{{ index .Config.Labels "com.docker.compose.project" }}'
docker exec crm-postgres psql -U postgres -d crm -Atc 'select count(*) from company'
```

**Result.** `crm`. 17 companies before and 17 after. The port is `127.0.0.1:5433`.

**Rollback.** Use it only after `docker compose up -d` fails. The volume is unchanged.

```sh
docker run -d --name crm-postgres --restart unless-stopped \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=crm \
  -p 127.0.0.1:5433:5432 -v crm_crm-postgres:/var/lib/postgresql/data postgres:17-alpine
```

## Step 6 — FAC-257: write the fork policy

**Problem.** Nothing says how the fork takes upstream changes, or which rules of `CONTRIBUTING.md` hold on the fork.

**Facts.**

- `gh workflow list -R factory-level/crm --all` returns nothing. No workflow is active on the fork.
- `gh api repos/factory-level/crm/branches/main/protection` returns 404. `main` has no protection.
- A push opened no pull request and started no run.

**Change.** `CONTRIBUTING.md`: add the section "This fork" at the end. It states that it wins over "Shipping a change" on the fork. It holds five parts: how to open, title, check and merge a pull request with no workflow; the upstream merge commands; the fork-only paths; where a custom integration goes; and a table of each upstream file the fork changes, with the reason.

**Check.** Each file in the table is in the output of `git diff --name-only origin/main...HEAD`. Each file in that output is in the table or under a fork-only path.

**Result.** Both hold.

## Step 7 — FAC-260: publish the concepts brief

**Change.**

- `mv concepts_brief.md docs/designs/work-refine-app.md`, then `git add docs/designs/`. The file was untracked, so `git mv` does not apply.
- `docs/work.md`, section "Where things are": add a bullet that points at `docs/designs/work-refine-app.md`.
- This plan and the readiness report are committed in the same folder.

**Check.** `concepts_brief.md` is not at the repo root. `git ls-files docs/designs` lists three files.

## Step 8 — FAC-247: merge pull request 1

**Preconditions.**

- Postgres is up, and `bun run db:test` has created the test database.
- One commit holds steps 1 to 7. Its message is a Conventional Commit with no `Co-Authored-By` trailer.
- These pass: `bun run audit`, `check-types`, `lint`, `lint:slop`, `lint:dead` and `test`. The pre-push hook does not run `lint:dead`, so run it yourself.
- The test run has these two variables in the shell:

```sh
export GOOGLE_CLIENT_ID=test-google-client-id GOOGLE_CLIENT_SECRET=test-google-client-secret
```

Without them, `Auth (e2e) > lets the sign-in page read what it may offer` fails in the full run. An earlier spec loads the auth module before `auth.e2e.spec.ts` sets its own fallback values.

**Commands.**

```sh
git push
gh pr merge 1 -R factory-level/crm --squash --body ""
```

**Check.**

```sh
git fetch origin && git log origin/main -1 --oneline
gh pr view 1 -R factory-level/crm --json state -q .state
```

The log shows the squash commit and the state is `MERGED`.

**Effect.** `main` of the fork gains `work/`, the local development mode and the port changes. No release starts, because no workflow is active on the fork.

## After the plan

In Linear, set FAC-247, 248, 249, 250, 255, 256, 257 and 260 to Done. Then set the project "Onboard CRM" to Completed.
