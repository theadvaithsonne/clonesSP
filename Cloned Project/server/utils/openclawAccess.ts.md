# `server/utils/openclawAccess.ts`

> RBAC helpers for OpenClaw agent access.

**Kind:** backend utility · **Lines:** 45

<!-- docgen:auto -->

## Purpose
RBAC helpers for OpenClaw agent access.

One source of truth for "which agent_ids can this user see?" so every
list endpoint (tasks, jobs, …) applies the same rule and they can't
drift out of sync.

  Founder of org  →  every active agent in the org
  Employee        →  only agents that include their userId in assignedUserIds

Soft-deleted agents (deletedAt != null) are excluded in both cases.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AgentAccess` | interface |  | 17 |
| `getAccessibleAgentIds` | function | `async getAccessibleAgentIds(user: AuthUser): Promise<AgentAccess>` | 26 |

## Interfaces

- **Database (Mongoose models used):**
  - `OpenClawAgent` (server/models/openclawAgent.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/openclawAgent.model.ts` — `OpenClawAgent`
  - `server/middleware/auth.ts` — `AuthUser`, `(types only)`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/openclawActivity.ts`
- `server/routes/openclawJobs.ts`
- `server/routes/openclawTasks.ts`
