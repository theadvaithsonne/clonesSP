# `app/api/openclaw/integrations/agent/[agentId]/route.ts`

> Next.js route handler for `/api/openclaw/integrations/agent/[agentId]` (GET).

**Kind:** Next.js route handler · **Lines:** 11 · **Route:** `/api/openclaw/integrations/agent/[agentId]` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/openclaw/integrations/agent/[agentId]`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> })` | 4 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/api/openclaw/proxy.ts` — `proxyAM`
- **Packages:**
  - `next` — `NextRequest`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/integrations/agent/[agentId]` (route).
