# Root `work/` Refine consumer of the CRM `/rest` bridge, and the InferOps pairing

* **Author:** Calvin Edwards
* **Date:** 2026-11-14

## Overview

**Status on 2026-11-14: the concept is built, and it changed while it was built.** This brief is the record of the review and of the decisions that came after it.

The feature is a root `work/` project in the factory-level/crm fork: a Refine Core app, in its shadcn variant, that combines this CRM with a mock InferOps API. A person signs in to the mock with a dummy login. The mock calls the CRM `/rest` bridge with a service key, so the browser holds no CRM credential. The app has six screens: login, dashboard, customers, customer history, new customer and edit customer. It is on branch `feat/work-refine-core`, pull request 1 in the fork. `docs/work.md` describes it.

The concept as first stated was different: a development consumer that signed in with the CRM session cookie and called `/rest` from a second origin listed in `APP_URL`. Seven review lenses read that version. All seven completed. These are the problems they found, most serious first, with what happened to each.

1. **The concept held three separate decisions.** A development front end, an auth and origin change, and a pairing model across two products. *Outcome: split. The front end is built. The pairing moved to the Linear project inferCRM.*
2. **The stated access path was not established.** No code in `apps/api/src` enables CORS for `/rest`. *Outcome: confirmed by a live test. `OPTIONS /rest/companies/search` returns 404 and `POST` returns no CORS header. The browser now calls one origin and a server calls the CRM.*
3. **A default Refine delete destroys data.** `DELETE /<resource>/{id}` is `purge`. *Outcome: fixed twice. `deleteOne` calls archive, and the mock answers 405 to every DELETE.*
4. **A root `work/` is outside the workspace globs.** *Outcome: fixed. `work` is a workspace member, so turbo, the type check, lint, the tests and knip see it.*
5. **"Modelled on InferWork" transfers almost no code.** *Outcome: accepted. The app shares the stack and the rules of InferWork, not its code.*
6. **The repo rules collide with a Vite browser bundle.** *Outcome: resolved by a listed set of `@crm/ui` components that import neither `next` nor `@crm/db`, and by narrow Zod schemas that the work app owns.*
7. **Fork automation is unaddressed.** *Outcome: open. The commit is `feat(work): …`, which bumps the fork version when it merges.*

### Reviewer status

| Reviewer | Status |
| --- | --- |
| `egm-design` | completed |
| `egm-codebase-details` | completed |
| `egm-zoom-out` | completed |
| `egm-comprehension` | completed |
| `egm-implementation-readiness` | completed |
| `egm-structural` | completed |
| `egm-inventive-catalyst` | completed |

### Limits that applied to the review

- The reviewers read the `release` checkout, 10 commits behind `main`, with no `node_modules`. Nothing ran during the review.
- The build ran on `main`. It replaced these guesses with facts: the CORS gap, the update body `{ data: … }`, the 415 for a write with no body, and the 403 for a sign-out from an untrusted origin.
- Line numbers in "Analysis" are from `release` and are not re-checked.

## Analysis

### Blockers

**B1. One statement, three decisions.** (`egm-zoom-out`, `egm-structural`, `egm-comprehension`)
The front end reads companies, contacts and deals. It never reads the tenant id. The pairing changes CRM configuration and a store in a second repository. One spec for all three ties a throwaway dev tool to a data-model contract and to a permanent fork difference. Split the work into three documents: access path, project, pairing. The pairing is not a prerequisite of the other two.

**B2. CORS on `/rest` is unproven, and the code order argues against it.** (`egm-design`, `egm-implementation-readiness`, `egm-codebase-details`, `egm-structural`)
- No `enableCors`, `cors` or `Access-Control` string exists in `apps/api/src`. `apps/api/README.md:58-61` is the only source, and the same README is stale in other places.
- The bridge is registered with `app.use(REST_BRIDGE_PATH, ...)` at `apps/api/src/create-app.ts:41-50`, before `app.init()` at line 108. The handler does not call `next()`.
- The only candidate for CORS is `BetterAuthModule.forRoot` at `apps/api/src/app.module.ts:53`. Module middleware registers during init, after the bridge.
- `APP_URL` feeds Better Auth `trustedOrigins` (`packages/auth/src/env.ts:52-66`, `packages/auth/src/auth.ts:119`). That is an origin and `callbackURL` allow-list. It is not a CORS response header.
- The existing web app does not test this path. It calls same-origin `/api/trpc` through a Next proxy (`apps/app/lib/trpc/client.tsx:31`, `apps/app/app/api/[...path]/route.ts`). That proxy does not cover `/rest`.
- Two reviewers recall that the library's CORS method list omits `PATCH`. Every update is `PATCH`. This is from memory and is not confirmed.

One preflight request against a running API settles the question. A same-origin Vite dev proxy for `/rest` and `/api/auth` removes the question.

**B3. `deleteOne` mapped to `DELETE` purges the record.** (all lenses except `egm-comprehension` raised it as a risk; `egm-comprehension` raised it as an undecided mapping)
`DELETE /companies/{id}` is `purge` (`apps/api/src/companies/companies.router.ts:105-112`; the same for contacts and deals). The router path has no `archivedBefore` guard. Purge is irreversible and suppresses a contact's address so the sync never recreates the person (`docs/api.md:245-265`). The reversible delete is `POST /<resource>/{id}/archive`.

**B4. A root `work/` is outside every build and quality gate.** (`egm-implementation-readiness`, `egm-structural`, `egm-design`, `egm-codebase-details`, `egm-zoom-out`)
- Workspaces are `apps/*` and `packages/*` (`package.json:55-58`). CI and the pre-push hook run turbo tasks (`.github/workflows/ci.yml:58-71`, `.githooks/pre-push:32`). Turbo sees workspace members only.
- As a non-member, `work/` gets no type check, no biome lint, no tests and no knip analysis. `workspace:*` imports do not resolve.
- Two root tools still reach it. `biome format` includes `**` (`biome.jsonc:10-11`). `vp lint` applies the anti-slop rules with no ignore for `work/` (`vite.config.ts:22-46`). The project is formatted and slop-linted but never type-checked.
- `pr-title.sh` derives a scope only from `apps/<x>/` and `packages/<x>/` (`.github/scripts/pr-title.sh:73-77`). A `work/`-only diff has no scope and defaults to `feat`.
- The reference records its own root placement as a ticket-directed divergence (reference `CLAUDE.md:5-6`). It is not a pattern.

**B5. No browser-safe schema source exists.** (`egm-implementation-readiness`, `egm-codebase-details`, `egm-structural`, `egm-design`)
- AGENTS.md requires a Zod parse at the boundary. `lint:slop` enforces it. The reference's `JSON.parse(body) as TData` (reference `src/data-provider.ts:52`) fails that gate.
- The record schemas live in `apps/api/src/{companies,contacts,deals}/*.contracts.ts`. They import `@crm/db` runtime enums. `@crm/db` must not reach a browser bundle (`AGENTS.md:94-97`).
- `packages/validation` exports no CRM record shape, and it also depends on `@crm/db`.
- `/openapi.json` is built at runtime and is not committed (`docs/api.md:144-149`). Generation needs a running API with Postgres. Generated types are not parsers.

**B6. The pairing sentence defines no field, no writer and no reader.** (`egm-comprehension`, `egm-design`, `egm-inventive-catalyst`)
- "The CRM ids" has three readings: one instance id, the ids of CRM records, or a base URL plus a credential. The record-id reading is a much larger feature.
- "Owns the pairing" does not say who writes first, which side wins on mismatch, the cardinality, or what an unpaired CRM does. An unset value must never throw (`AGENTS.md:36-38`).
- The workspace id is the literal `workspace` in every install (`docs/api.md:39-45`). It does not identify an instance. The only per-install value is `Install.uuid`, which exists for telemetry (`packages/db/prisma/schema.prisma:1584-1596`).
- No planned CRM code reads the tenant id.

### Major findings

**M1. The reference transfers a contract, not code.** (`egm-codebase-details`, `egm-zoom-out`, `egm-structural`, `egm-comprehension`)
- `getList`, `getOne`, `create`, `update` and `deleteOne` all throw `NotBuiltError` (reference `src/data-provider.ts:18-33`). No Refine `authProvider` exists.
- Rules 2 to 5 depend on `@inferlab/ui`, the node-config cascade, `@inferlab/config/dev-proxy` and central PKCE. None exist here.
- Reference rule 1 says every record goes through InferOps capabilities. Rule 4 says the API has no CORS. A browser provider that calls the CRM with a CRM cookie contradicts both.
- A straight copy fails four gates: comments are forbidden (`AGENTS.md:27`); biome wants tabs and double quotes; `vite-plus/prefer-vite-plus-imports` is an error; the script is `typecheck`, not `check-types`, so turbo skips it without an error.
- Ideas that do transfer: `credentials: "include"`, the injected `fetcher`, a `statusCode` on thrown errors, `disableTelemetry: true`, `strictPort: true`, and rule 6, "Unbuilt is loud".

**M2. Refine's contract is wider than the bridge, and the bridge degrades silently.** (`egm-design`, `egm-codebase-details`, `egm-implementation-readiness`)
- List input is `q`, `sort`, `dir`, `page`, `pageSize` (max 100, default 25) plus named facet arrays and `archived` (`apps/api/src/trpc/list-input.ts:3-9`). One sort column only.
- An unknown `sort` falls back to the service default with no error (`list-input.ts:41-48`). Zod strips unknown keys, so an unmapped filter returns unfiltered rows with no error.
- Update input is `{ id, data }`. The PATCH body nests under `data`. Deal stage has its own route, `PATCH /deals/{id}/stage`.
- `getOne` returns a detail shape that differs from the row shape. `fields` is a `Record` on rows and an array on detail. `getOne` still answers for archived rows.
- `create` and `update` return a three-field summary, not the record.
- No fetch-by-ids route exists. `getMany` becomes N single reads.
- The deals list adds `openValueCents`, `reportingCurrency` and `unconverted`. Refine's `{ data, total }` drops them and `facetCounts`.
- Only `baseAmountCents` is safe to sum (`docs/api.md:286-292`).

**M3. `@crm/ui` is built for Next.** (`egm-design`, `egm-structural`, `egm-codebase-details`, `egm-implementation-readiness`, `egm-zoom-out`)
`packages/ui/package.json` peer-depends on `next ^16` and depends on `@crm/db`, `next-themes` and `nuqs`. `entity-logo.tsx` imports `next/image` and `@crm/db/images`. `data-table.tsx` imports `nuqs`. `sonner.tsx` imports `next-themes`. Exports are per file, so a subset bundles, but one wrong import breaks the build. The "single UI source" rule and a Vite consumer conflict until the brief states a policy. The 10 design-system commits on `main` change this list.

**M4. Cookie sign-in works in dev and does not survive deployment.** (`egm-design`, `egm-zoom-out`, `egm-inventive-catalyst`)
- On `localhost` a cookie ignores the port, and all ports are one site. The session cookie from `localhost:3000` reaches any other localhost port. A `127.0.0.1` hop breaks it.
- A deployed InferWork on another site does not receive a CRM session cookie. `AUTH_COOKIE_DOMAIN` helps only for subdomains of one parent.
- The production caller is the InferOps server with `x-api-key`. The browser cookie provider does not exercise that path.
- A CRM session is a CRM user admitted by `ALLOWED_SIGN_IN`. That is a second identity system beside InferOps PKCE.

**M5. Sign-in for `work/` is undecided.** (`egm-implementation-readiness`, `egm-comprehension`)
Email and password are off (`packages/auth/src/auth.ts:80-82`). `apps/app` sign-in has no return-to parameter. Two paths exist. Path (a): the developer signs in at `localhost:3000`, and `work/` shows a link when signed out. This needs no auth code. Path (b): `work/` starts the social flow with its own `callbackURL`. This needs the work origin in `APP_URL`. Reviewers disagree on one point: `egm-implementation-readiness` and `egm-inventive-catalyst` state that POSTs to `/api/auth/*` through a proxy still carry the work origin and are checked against `trustedOrigins`; `egm-design` and `egm-codebase-details` state that no `APP_URL` change is needed under path (a). Sign-out from `work/` is the case to test.

**M6. `APP_URL` is overloaded and order is load-bearing.** (`egm-structural`, `egm-design`, `egm-codebase-details`, `egm-comprehension`)
The first entry is the canonical `appUrl` (`packages/auth/src/env.ts:57`). It builds tracking snippets and MCP return URLs. Every entry is also a `callbackURL` allow-list entry, a Next `allowedDevOrigins` host and part of a turbo build cache key (`turbo.json:47`). A work origin placed first redirects sign-in and MCP callbacks to the Vite app.

**M7. `/rest` has no origin check of its own.** (`egm-design`)
The bridge only calls `auth.api.getSession` (`apps/api/src/trpc/trpc.context.ts:8-17`). `trustedOrigins` protects `/api/auth/*`, not the bridge. Protection for mutating routes rests on the cookie's SameSite default and on the JSON preflight. A same-site origin is not stopped. With one instance per company, sibling subdomains under a shared `AUTH_COOKIE_DOMAIN` parent is the dangerous layout.

**M8. `x-api-key` is correct for a server and wrong for a browser.** (`egm-design`, `egm-codebase-details`, `egm-inventive-catalyst`)
A key acts as the user who made it, has rate limiting off (`auth.ts:234-246`), and expires in at most 365 days. Key creation refuses API-key callers and needs a browser session (`session-only.middleware.ts:15-17`). So a human signs in to every new instance to mint the InferOps key, every InferOps write is attributed to one CRM user, and the pairing breaks when the key expires or the user is removed.

**M9. Denormalized ids: acceptable at instance level, a problem at record level.** (`egm-design`, `egm-inventive-catalyst`, `egm-zoom-out`) The author asked for pushback.
- Instance level is a 1:1 pair. Name InferOps as the authority. This is not a problem in itself. The CRM-side copy has no reader, and both homes for it cost fork divergence.
- Record level is a problem. Purge is a hard delete with no outbound event. A retention cron purges archived rows after 180 days (`docs/api.md:252-258`). InferOps ids then point at nothing. A purged contact comes back with a new id. No CRM record has an external-id column. Two stores share no transaction.
- `Install.uuid` changes on a database rebuild and is copied by a database clone. It is a hint, not proof of identity. It is not exposed on `/rest`.

**M10. Where the tenant id lives, if it is stored.** (`egm-design`, `egm-codebase-details`, `egm-implementation-readiness`, `egm-inventive-catalyst`)
Reviewers agree on "store nothing now". They disagree on the later home.
- `egm-codebase-details` prefers an `AppSetting` column. It matches the "asked for, not configured" pattern (`docs/environment.md:132-136`).
- `egm-design` prefers a root `.env` variable. It is deployment identity, immutable at runtime, and survives a database reset. A workspace owner cannot re-point the instance.
- `egm-inventive-catalyst` prefers a credential issued by InferOps over an id.
- Costs: an env variable has three homes (`.env.example`, `env.validation.ts`, `turbo.json`). A Prisma column is a fork-only migration, the worst merge surface in this repo.
- In every case the value must stay off CRM records, function parameters, cache keys and request fields (`docs/api.md:34-45`).

**M11. Fork maintenance and release automation.** (`egm-implementation-readiness`, `egm-inventive-catalyst`, `egm-structural`, `egm-zoom-out`)
- release-please has one package, `"."`. Any releasable commit on the fork's `main` bumps the root version and writes `CHANGELOG.md`, whatever path it touches.
- The fork version then diverges from upstream tags. `CHANGELOG.md`, `version` and the manifest conflict at every upstream sync.
- `CONTRIBUTING.md:222-224` warns that a second release package brings back a tagging bug.
- No `upstream` remote is configured.
- Each edit to `package.json`, `bun.lock`, `turbo.json`, `knip.json`, `biome.jsonc`, `.env.example` or `AGENTS.md` is a recurring merge conflict.

**M12. Writes through the bridge spend agent budget.** (`egm-design`)
Creating a company enqueues agent research every time (`apps/api/src/companies/companies.service.ts:314-317`). API-key traffic has no rate limit. A bulk import from InferOps starts one research task per company. Each list call runs a row query, a count and one count per facet. Refine refetches after every mutation and on window focus.

**M13. Terms collide across the two products.** (`egm-comprehension`)
"Company" is a CRM customer record and also the business that receives an instance. "Tenant" already has two meanings in the CRM docs. "Workspace" has three. The docs say "install"; the concept says "instance". "InferWork", "InferOps" and `work/` are not distinguished. A reader maps "InferOps tenant" to the Better Auth organization plugin and adds an `organizationId`, which `docs/api.md` forbids.

**M14. Toolchain and observability gaps.** (`egm-implementation-readiness`, `egm-structural`, `egm-codebase-details`)
- React is pinned to `19.2.4`. The reference uses `^19.2.7`. Two React copies in one install break hooks.
- The dev port is undecided. The CRM uses 3000, 3001 and 2000. The inferops stack uses the 3000 range on the same machine.
- A Vite project reads `.env` from its own directory by default. That invites a `work/.env`, which breaks the one-`.env` rule. `loadRootEnv()` in `vite.config.ts` reads the root file.
- Every auth failure is one bare `UNAUTHORIZED`. A missing cookie, a host mismatch, a CORS rejection and an expired key look the same.
- No acceptance test is defined. Nothing ran in this review.

### Nits

- The bridge has 164 `restMeta` call sites, not 165. Five procedures (four MCP, one users) are tRPC-only. (`egm-codebase-details`)
- `docs/api.md:129` says "REST is auth and health only". The bridge section at `docs/api.md:144-149` contradicts it. Cite the second. (`egm-comprehension`, `egm-structural`)
- `AGENTS.md:27` forbids comments. `CONTRIBUTING.md:255-257` allows "why" comments. AGENTS.md is the rule in force. (`egm-structural`, `egm-codebase-details`)
- The checkout is on `release`. The work branches from `main`. (`egm-comprehension`)
- Onboarding and mailbox-grant gates live in the Next proxy, not the API. `work/` reads data on an instance that has not finished onboarding. (`egm-design`)

## Goals vs. Non-Goals

### Goals

- Run the fork from `main` in the author's development environment, beside a second CRM checkout. **Done.**
- Show an app that connects Refine Core, in its shadcn variant, to this CRM fork. **Done.**
- Prove the development flow of an app that is this CRM combined with a mock InferOps API: a dummy login, an operations dashboard, customers and a history for each customer. **Done.**
- Show a change made in the work app in the CRM, and a change made in the CRM in the work app. **Done.**
- Map `deleteOne` to archive. Never call purge. **Done.**
- Parse every response with Zod. A parse failure throws. **Done.**
- Keep the fork's difference from trycompai/crm small enough that an upstream merge stays cheap. **Partly done: 20 upstream files changed.**

### Non-Goals

- Storing an InferOps tenant id in the CRM.
- A real InferOps API behind the work app. The mock stands in for it.
- A CRM credential in browser code.
- Purge from the work app.
- A production deployment of `work/`.
- A second UI component kit.
- CORS changes in `apps/api/src/create-app.ts`.
- Automated key provisioning for new instances. This is in the inferCRM project.

## Alternatives Weighed

Each status records what the author decided during or after the build. "Open" means no decision exists.

### Where the consumer lives

| Option | Technical reason | Status |
| --- | --- | --- |
| Root `work/`, not a workspace member, own lockfile | Zero edits to upstream files. No `@crm/*` imports, no CI type check or tests. Bun behaviour for a nested non-member project is not tested. | Rejected by author: the app needs `@crm/ui`, `@crm/env` and the repo checks |
| Root `work/` added to `workspaces` | Full CI and shared packages. Edits `package.json`, `bun.lock`, `knip.json`, `biome.jsonc`. No PR-title scope. | Accepted by author |
| `apps/work` | The existing glob covers it. Turbo, CI and `pr-title.sh` work with no structural edit. `bun.lock` and `knip.json` still change. | Rejected by author: the author asked for a root `work/` that matches inferops |
| Provider inside InferWork in the inferops repo | Zero fork difference. `@inferlab/ui`, config, proxy and PKCE already exist there. The fork loses its own harness. | Moved to inferCRM (FAC-265) |
| Separate small repository | Zero fork difference. No shared packages with either repo. | Rejected by author: the app lives in the fork |
| No project; curl or Swagger UI with an API key | Proves the bridge with zero code. Swagger UI is already served (`create-app.ts:63-106`). No regression guard. | Rejected by author: the goal is a visible app |

### How the browser reaches `/rest`

| Option | Technical reason | Status |
| --- | --- | --- |
| Cross-origin call with the dev origin in `APP_URL` (as stated) | Depends on CORS for `/rest`, which no code establishes. Needs the API URL in the bundle. | Rejected by author: a live preflight to `/rest` returns 404 |
| Same-origin Vite dev proxy for `/rest` and `/api/auth` | No CORS dependency and no API change. Matches the reference rule 4 and the CRM's own Next proxy. | Accepted by author, changed: the proxy forwards `/inferops` to the mock, and the mock calls `/rest` |
| Explicit `cors` on the bridge mount | Works cross-origin. Edits an upstream file and widens the browser attack surface. | Open (FAC-248) |
| tRPC client with the committed router type | Exact types at no cost. Bypasses the bridge the concept names. Does not carry to inferops. | Rejected by author: the app proves the REST bridge |

### Credential

| Option | Technical reason | Status |
| --- | --- | --- |
| Session cookie; sign in at `apps/app` first | Zero auth code. Works on `localhost` only. Depends on `apps/app` running. | Rejected by author: replaced by the dummy InferOps login |
| Session cookie; sign-in button in `work/` | Self-contained. Needs the work origin in `APP_URL`, appended and never first. | Rejected by author: replaced by the dummy InferOps login |
| `x-api-key` in the browser | A full-power, unthrottled credential in a public bundle. | Rejected by author: a full-power credential in a public bundle |
| `x-api-key` injected by the dev proxy from root `.env` | Safe in dev. Hides per-user identity. | Rejected by author: the mock InferOps API holds the key |
| `x-api-key` server-to-server from InferOps | The path that survives deployment. Needs a human sign-in per instance to mint the key. | Accepted by author: the mock InferOps API does this today |
| InferOps as the CRM's OIDC provider (an `ssoProvider` row) | One identity across both products. Needs InferOps to serve OIDC discovery; not verified. | Open (FAC-258) |

### Schema source

| Option | Technical reason | Status |
| --- | --- | --- |
| Narrow local Zod schemas plus a contract test against `/openapi.json` | Smallest fork difference. A second copy that the test guards. The test needs a running API. | Accepted by author. The contract test against `/openapi.json` is not built |
| New consumer schema files in `packages/validation/src` | Follows the cross-package rule with new files only. `@crm/validation` depends on `@crm/db`; browser safety needs a check. | Open |
| Move the three contract modules to `packages/validation` | Correct by the rule. Rewrites upstream files; highest merge cost. | Rejected by author: it rewrites upstream files |
| Types generated from `/openapi.json` | No hand-written types. Types are not parsers; needs a live API or a committed snapshot. | Open |
| Type-only import of `AppRouter` | Compile-time only. Does not satisfy the parse rule. | Rejected by author: types are not parsers |

### UI source

| Option | Technical reason | Status |
| --- | --- | --- |
| `@crm/ui`, limited to a listed set with no `next/*` or `@crm/db` import | Honours the single-source rule. Needs workspace membership, Tailwind 4 in Vite and a build check. | Accepted by author, with Refine shadcn registry components vendored on top of `@crm/ui` |
| Unstyled HTML | No dependency. Fits a harness. | Rejected by author: the author asked for the shadcn variant |
| A second component kit | Breaks `AGENTS.md:39-41`. Needs a written exception. | Rejected by author: it breaks the single-source rule |

### Tenant id in the CRM

| Option | Technical reason | Status |
| --- | --- | --- |
| Store nothing; InferOps holds instance URL and credential | Zero CRM change. Matches "InferOps owns the pairing". The CRM cannot display its pairing. | Accepted by author |
| Optional root `.env` variable | Immutable at runtime, survives a database reset. Three upstream files change. | Open (FAC-258) |
| `AppSetting` column | House pattern for admin-set values. A fork-only migration; an owner can re-point the instance. | Open (FAC-258) |
| Workspace `metadata` blob | No migration. The blob's accessors are deliberately narrow. | Open (FAC-258) |
| Credential issued by InferOps, no id | The secret identifies the tenant on the InferOps side. Needed only when the CRM calls InferOps. | Open (FAC-258) |
| InferOps registered as a connection | Fits "the instance carries custom integrations". Needs an InferOps MCP server with OAuth. | Open (FAC-258) |
| Two-sided denormalized ids at instance level (author's stated preference) | A 1:1 pair is workable with InferOps as authority. The CRM copy has no reader and costs fork divergence. | Open (FAC-258). The author prefers it |
| Two-sided denormalized ids at record level | Ids dangle after purge and the 180-day retention cron. No external-id column, no shared transaction. | Accepted by author for the InferOps side, with inferops issue 2691 for purged records |

### `deleteOne`

| Option | Technical reason | Status |
| --- | --- | --- |
| `POST /{id}/archive` | Reversible. Restore and purge go through `custom` or stay unbuilt. | Accepted by author |
| `DELETE /{id}` | Purge. Irreversible; suppresses a contact address. | Rejected by author: purge is irreversible |
| Left unbuilt and loud | No delete in slice one. | Rejected by author: archive is built |

### Fork release policy

| Option | Technical reason | Status |
| --- | --- | --- |
| Hidden commit types (`chore:`, `build:`) for fork-only work | No version bump. Such commits do not reach `release` alone, so the fork runs from `main`. A hand-set title stops the title automation. | Open (FAC-257) |
| Disable the release workflows in the fork | No divergence from upstream tags. The fork needs its own deploy branch. | Open (FAC-257) |
| Leave automation on; accept fork versions | No setup. `CHANGELOG.md` and `version` conflict at every upstream sync. | Open (FAC-257) |

## Key Decisions & Staging for Next Steps

### Decisions made

1. **Location.** A root `work/` that is a workspace member of the fork.
2. **Access path.** The browser calls one origin. The Vite dev server proxies `/inferops` to the mock InferOps API. The mock calls the CRM `/rest` bridge.
3. **Credential.** The mock holds a CRM service key (`WORK_CRM_API_KEY`) and sends it as `x-api-key`. The browser holds only the mock's session cookie.
4. **Sign-in.** A dummy login against the mock. Any email and password work. The mock session is stateless.
5. **Delete is archive.** `deleteOne` calls `POST /<resource>/{id}/archive`. The mock answers 405 to every DELETE.
6. **Schemas.** The work app owns narrow Zod schemas for the CRM resources it reads. The mock and the app share one schema module for the mock payloads.
7. **UI.** `@crm/ui` primitives, with the Refine shadcn registry components vendored into `work/src/components/refine-ui/`. `sidebar` and `breadcrumb` were added to `packages/ui`.
8. **Pairing.** InferOps owns it. The CRM stores no tenant id. A mock job carries the CRM company id as `customerId`.
9. **Local development mode.** `CRM_LOCAL_DEV="1"` adds a local sign-in to the CRM web app, passes the Context key gate and binds the API to loopback. It is ignored in production. It comes from the author's `eve-foundation/crm` checkout.
10. **Ports.** The web app dev server follows the first `APP_URL` entry and Postgres follows `CRM_POSTGRES_PORT`, so two checkouts run on one machine.
11. **Two projects.** Linear project "Onboard CRM" holds the Refine app and the fork. Linear project "inferCRM" holds the integration into InferOps and InferWork.

### Decisions still open

1. **ADR conflict.** ADR 0009 and ADR 0010 in inferops deny a CRM database and any call to a CRM API. The direction here needs a new ADR (FAC-261).
2. **Fork release policy.** Which workflows run on the fork, the commit type for fork-only work, and the upstream sync method (FAC-257).
3. **The real access path in InferOps.** Capabilities that call the CRM with a per-tenant service key, in place of the mock (FAC-262 to FAC-264).
4. **Identity.** A CRM write from the work app is recorded under the service account, not the person (FAC-268).
5. **CORS on `/rest`.** Fix the bridge, or record that it stays same-origin (FAC-248).
6. **A contract test.** Nothing checks the work app's schemas against `/openapi.json`.

### Spikes, with results

| Spike | Result |
| --- | --- |
| Preflight to `/rest` from a trusted origin | 404. The bridge sends no CORS header |
| Update body shape | `PATCH` takes `{ data: { … } }` |
| A write with no body | 415 unless `content-type: application/json` is sent |
| Sign-out through a proxy with no `APP_URL` entry | 403, `INVALID_ORIGIN` |
| `@crm/ui` in Vite under vite-plus with Tailwind 4 | Works for components that import neither `next` nor `@crm/db` |
| The anti-slop rules against Refine's provider types | Pass, with one `as DataProvider` per provider |
| `@refinedev/core` 5.0.12 with React 19.2.4 | Works |
| `@refinedev/core` `Authenticated` | Unmounts its children on every refetch. The app uses its own `SessionGate` |
| `vite.config.ts` type check under vite-plus | Fails on plugin types. Not solved (FAC-255) |

### Staging from here

- **Stage 1, done.** The Refine app, the mock InferOps API and the local development environment.
- **Stage 2, decision.** The ADR for a per-company CRM instance (FAC-261) and the pairing design (FAC-258).
- **Stage 3, InferOps.** Start a CRM instance from the InferOps environment, store one connection per tenant, and add CRM read capabilities (FAC-259, FAC-262 to FAC-264).
- **Stage 4, InferWork.** CRM resources and pages in InferWork, then the isolation tests and the write capabilities (FAC-265 to FAC-268).

### Points where the reviewers disagreed

- Location: three lenses preferred `apps/work`, one preferred a standalone root `work/`, one preferred no project in the fork. The author chose a root `work/` in the workspace.
- Later home of the tenant id: an `AppSetting` column, a root `.env` variable, or an issued credential. This is open in FAC-258.
