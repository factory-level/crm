# work

A Refine Core app, shadcn variant, that combines this CRM with a mock InferOps
API. Screens: Login, Dashboard, Customers, Customer history, and create and
edit forms for a customer.

```sh
bun run --filter=@crm/work crm:key                    # once: prints WORK_CRM_API_KEY
bunx turbo run dev --filter=api --filter=@crm/work    # CRM API, mock InferOps API, work app
```

Open `http://127.0.0.1:3002`. Any email and password sign in.

The rules and the request path are in `docs/work.md`.
