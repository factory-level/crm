# Plan — Contact intelligence agent (v2)

The maintained documentation lives in [the canonical InferOps reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

This file is a navigation entrypoint. Original source: `28d23fa52be152243367fe4a217959e540e0d4eb`. The canonical page records provider-specific behavior, historical evidence and current integration limits.

The headings below preserve existing repository links. Read the canonical page for the corresponding section.

## 0. Where we actually are

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Two enrichment stacks, one job

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### The "agent" is a worker with a numbered list

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Confidence is computed, then thrown away

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### There is no provenance store, and no way to see the agent think

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 1. What "better than HubSpot and Salesforce" has to mean

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 2. Decisions that carry the design

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Judgment calls worth your veto

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 3. Data model

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 4. Capabilities: what eve gives us, what we write

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### From the harness (a sandbox is all it takes)

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Authored tools — only where the harness cannot go

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Context control

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### The egress boundary

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 5. The confidence model

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Evidence, weighted

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Bands

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Enforced by the approval policy, not the prompt

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 6. The contact sheet

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### The Background section

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### How confidence reads

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### The live panel

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 7. Not static: how the agent chooses

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### One dispatcher, not two cron prompts

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### The agent writes its own rows

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Events jump the queue

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Depth is a decision, budget is state

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Fan-out for briefs

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 8. What stays deterministic

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 9. Evals, or the confidence number means nothing

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 10. Retiring the API path

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 11. Phases

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 12. Risks

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 13. Open questions

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

## 14. What each phase actually taught us

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Phases 1–4 (2026-08-01)

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).

### Phase 6 (2026-08-01)

[Read the canonical reference](https://github.com/factory-level/inferops/blob/develop/docs/agent/architecture/infercrm/plan/contact-intelligence-agent.md).
