# `app/api/openclaw/proxy.ts`

> Module exporting `proxyAM`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 45

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `proxyAM` | function | `async proxyAM(req: NextRequest, apiPath: string, method: string, body?: string, search: string = ""): Promise<NextResponse>` | 11 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

- `app/api/billing/subscriptions/[agentId]/unlock/route.ts`
- `app/api/billing/subscriptions/route.ts`
- `app/api/billing/transactions/route.ts`
- `app/api/billing/usage/agents/monthly-chart/route.ts`
- `app/api/billing/usage/agents/route.ts`
- `app/api/billing/usage/agents/summary/route.ts`
- `app/api/billing/usage/current-month/route.ts`
- `app/api/billing/usage/daily-7d/route.ts`
- `app/api/billing/usage/models/route.ts`
- `app/api/billing/usage/monthly-12m/route.ts`
- `app/api/billing/usage/users/route.ts`
- `app/api/openclaw/admin/agents/sync-registry/route.ts`
- `app/api/openclaw/agents/[agentId]/heartbeat/route.ts`
- `app/api/openclaw/analytics/agent/[agentId]/route.ts`
- `app/api/openclaw/contexts/[contextId]/route.ts`
- `app/api/openclaw/contexts/assign/route.ts`
- `app/api/openclaw/contexts/ram/context/active/route.ts`
- `app/api/openclaw/contexts/ram/task/[taskId]/route.ts`
- `app/api/openclaw/contexts/route.ts`
- `app/api/openclaw/contexts/third-party/[contextId]/assign/[agentId]/route.ts`
- `app/api/openclaw/contexts/third-party/[contextId]/assign/route.ts`
- `app/api/openclaw/contexts/third-party/[contextId]/available-agents/route.ts`
- `app/api/openclaw/contexts/third-party/[contextId]/route.ts`
- `app/api/openclaw/contexts/third-party/completed/route.ts`
- `app/api/openclaw/contexts/third-party/providers/route.ts`
- _…and 15 more_
