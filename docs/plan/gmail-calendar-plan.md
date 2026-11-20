# Plan — Gmail & Calendar

The maintained documentation lives in [the canonical InferOps reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

This file is a navigation entrypoint. Original source: `28d23fa52be152243367fe4a217959e540e0d4eb`. The canonical page records provider-specific behavior, historical evidence and current integration limits.

The headings below preserve existing repository links. Read the canonical page for the corresponding section.

## 1. The decisions that carry the design

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### Choice table

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### Judgment calls worth your veto

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 2. What exists that we build on

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 3. Connecting an account

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 3.1 Scopes at sign-in, and the gate behind them

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 3.2 Reading and refreshing tokens

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 3.3 Google Cloud setup (Phase 0, and it gates everything)

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 3.4 There is no disconnect

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 4. Data model

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 4.1 New models

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 4.2 Why those keys, specifically

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 4.3 Changes to existing models

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 4.4 Why project into `Activity` rather than union three tables

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 5. Matching: from a Google payload to a CRM record

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 6. Auto-creating companies and contacts

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 7. Sync mechanics

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 7.1 Shape

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 7.2 Incremental sync

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 7.3 No backfill — forward-only

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 7.4 Idempotency and ordering

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 7.5 Later: near-real-time

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 8. API surface

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 9. UI

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 9.1 New primitives — in `/packages/ui`, per `design.md`

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 9.2 Timeline

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 9.3 Settings

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

### 9.4 Freshness

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 10. Privacy, security, logging

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 11. Failure modes to design for

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 12. Phases

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 13. Environment

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 14. Testing

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).

## 15. Open questions

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/gmail-calendar-plan.md).
