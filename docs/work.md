# The work app

`work/` is a Refine Core app in its shadcn variant. It proves one development
flow: an app that combines this CRM with an InferOps API. The InferOps API is a
mock that runs beside the app.

## What runs

| Process | Address | Started by |
| --- | --- | --- |
| Work app (Vite) | `http://127.0.0.1:3002` | `work/scripts/dev.ts` |
| Mock InferOps API (Bun) | `http://127.0.0.1:3003` | `work/scripts/dev.ts` |
| CRM API | `API_URL` | `apps/api` |

`bun run dev` at the repo root starts all of them with the web app and the agent.
`bunx turbo run dev --filter=api --filter=@crm/work` starts only what the work
app needs.

## First run

```sh
bun run --filter=@crm/work crm:key   # prints WORK_CRM_API_KEY="crm_…"
```

Paste the printed line into the root `.env`, and set `CRM_LOCAL_DEV="1"` there too.
Restart the dev servers.

- **The work app:** open it and sign in. Any email and password work.
- **The CRM web app:** open `/sign-in` and press "Sign in locally". `CRM_LOCAL_DEV`
  adds that button and passes the Context key gate. See `docs/environment.md`.

## The request path

```
browser → work app origin → /inferops/* → mock InferOps API → CRM /rest/*
```

- **The browser calls one origin.** The Vite dev server proxies `/inferops` to
  the mock. The CRM `/rest` bridge sends no CORS headers, so a direct call from
  the browser fails.
- **The browser holds no CRM credential.** It holds the mock's session cookie.
  The mock calls the CRM with `WORK_CRM_API_KEY` in the `x-api-key` header.
- **Every route but login needs the mock session.** No session is a 401.
- **The mock session is stateless.** The cookie names the user and the mock keeps
  no session store, so a restart of the mock signs nobody out. It is a dummy
  login: it proves the flow and protects nothing.
- **The mock never deletes a CRM record.** `DELETE /rest/<resource>/{id}` is
  purge, so the mock answers 405 to every DELETE before it reaches the CRM.
- **A missing key removes a capability and never throws.** The dashboard says
  the CRM is not connected and every CRM read answers 503.
- **A CRM error keeps its status and message.** The mock drops the stack trace
  that the dev API adds.

## The screens

| Screen | Route | Data |
| --- | --- | --- |
| Login | `/login` | Mock InferOps dummy login |
| Dashboard | `/` | CRM counts and mock job totals, joined by the mock |
| Customers | `/customers` | CRM companies, through the `default` data provider |
| Customer history | `/customers/:id` | CRM activity timeline and mock jobs, merged by date |
| New customer | `/customers/new` | Creates a CRM company |
| Edit customer | `/customers/:id/edit` | Updates or archives a CRM company |

## One database, two apps

The work app and the CRM web app read and write the same CRM records.

- **Work app to CRM:** a customer that the work app creates, edits or archives is a
  CRM company. "Add note" on the history screen writes a `NOTE` activity to the CRM
  timeline. The CRM records the service account as the author.
- **CRM to work app:** the dashboard, the customers table and the history screen
  refetch every `WORK.live.refetchMs`. A change made in the CRM shows without a
  reload.

A mock job carries the CRM company id as `customerId`. The mock derives the jobs
of a customer from that id, so the same customer always has the same jobs.

## Where things are

- `work/mock/` is the mock InferOps API. `app.ts` is a plain
  `Request → Response` function, so `bun test` runs it with no server.
- `work/src/inferops-contract.ts` owns the Zod schema of each mock payload. The
  mock and the app import the same module.
- `work/src/resources.ts` owns the Zod schema of each CRM resource the app reads.
  A response that does not match is an error, not an empty list.
- `work/src/providers/` holds the two Refine data providers and the auth
  provider. `crm-data-provider.ts` maps `deleteOne` to archive.
- `work/src/components/session-gate.tsx` guards the routes. Refine's own
  `Authenticated` unmounts its children on each refetch of the session, which
  drops the first click after the window gets focus.
- `work/src/components/refine-ui/` is vendored from the Refine shadcn registry
  (`https://ui.refine.dev/r/<name>.json`). Its imports point at `@crm/ui`. Lint
  skips it, as it skips `packages/ui/src/components`.
- `work/src/work-config.ts` and `work/mock/mock-config.ts` hold every constant.
- `work/package.json` aliases `vite` to `@voidzero-dev/vite-plus-core`, the package
  that `vite-plus` takes its types from. The Vite plugins then share one `Plugin`
  type with `defineConfig`. The alias pins the `vite-plus` version: change both
  together.
- `docs/designs/work-refine-app.md` is the review record and the decision list.

## Rules

- **UI primitives come from `@crm/ui`.** A primitive that a Refine component
  needs and `@crm/ui` lacks is added there with `bun run ui:add`. `sidebar` and
  `breadcrumb` arrived that way.
- **Import only `@crm/ui` components that do not import `next` or `@crm/db`.**
  The work app is a browser bundle with no Next.js runtime.
- **A new integration is a new resource.** Add its schema to `resources.ts` or
  `inferops-contract.ts`, map it in a data provider, register it in `App.tsx`,
  and add a test in `work/test/`.
- **The mock stands in for InferOps.** Keep its routes under `/inferops` and its
  payloads in `inferops-contract.ts`, so the real API can replace it.
