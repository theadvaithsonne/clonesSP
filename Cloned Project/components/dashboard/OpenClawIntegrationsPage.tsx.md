# `components/dashboard/OpenClawIntegrationsPage.tsx`

> React component `OpenClawIntegrationsPage`.

**Kind:** React component · **Lines:** 837 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×6 (lucide-react), `Plug`×5 (lucide-react), `Bot`×4 (lucide-react), `Globe`×3 (lucide-react), `Activity`×3 (lucide-react), `RefreshCw`×2 (lucide-react), `Users`×2 (lucide-react), `Check`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `ApiTypePill` (local), `ChevronRight` (lucide-react), `Unplug` (lucide-react), `AlertCircle` (lucide-react), `Clock` (lucide-react), `Input` (components/ui/input.tsx), `OpenClawIntegrationsPageInternal` (local)

**Hooks used:** `useState`×13, `useCallback`×3, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OpenClawIntegrationsPage)` | component | `OpenClawIntegrationsPage()` | 830 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/openclaw/integrations${qs}` (L151)
  - `GET /api/openclaw/integrations/${integName}/logs${qs}` (L176)
  - `GET /api/openclaw/integrations/${encodeURIComponent(integName)}/unconnected-agents${qs}` (L209)
  - `POST /api/openclaw/integrations/${encodeURIComponent(integName)}/test?agent_id=${encodeURIComponent(agentId)}${qs}` (L247)
  - `POST /api/openclaw/integrations${qs}` (L282)
  - `DELETE /api/openclaw/integrations/unassign?agent_id=${encodeURIComponent(agentId)}&integration_name=${encodeURIComponent(integName)}${qs}` (L339)
- **Timers / queues:** `setInterval` at L306; `setTimeout` at L315

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`, `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`, `useRef`
  - `sonner` — `toast`
  - `lucide-react` — `Plug`, `Loader2`, `X`, `ChevronDown`, `Users`, `Bot`, …

## Used by

- `components/dashboard/AIManagementPage.tsx`
