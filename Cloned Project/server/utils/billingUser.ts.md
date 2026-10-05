# `server/utils/billingUser.ts`

> Billing-owner resolution.

**Kind:** backend utility · **Lines:** 133

<!-- docgen:auto -->

## Purpose
Billing-owner resolution.

Employees don't have their own wallets — every cost they incur (chat,
cron, agent usage) is billed to the founder of their org. This helper
translates a "user who triggered the cost" into "user whose wallet
should be charged".

Rules:
  - If the user is a founder of any org they belong to → charge
    themselves (founders pay for their own usage).
  - Otherwise (stakeholder/employee) → find the founder of their
    primary org and charge them.
  - If we can't resolve a founder for any reason (deleted user,
    removed from org, legacy data) → fall back to charging the
    original user so the system keeps functioning. We log a warning
    so the fallback is visible. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `resolveBillingUserIdForAgent` | function | `async resolveBillingUserIdForAgent(userId: string, agentId: string): Promise<string>` — Preferred path: caller knows the agent_id. | 33 |
| `resolveBillingUserId` | function | `async resolveBillingUserId(userId: string): Promise<string>` | 82 |

## Interfaces

- **Database (Mongoose models used):**
  - `OpenClawAgent` (server/models/openclawAgent.model.ts) — reads: `findOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/openclawAgent.model.ts` — `OpenClawAgent`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
