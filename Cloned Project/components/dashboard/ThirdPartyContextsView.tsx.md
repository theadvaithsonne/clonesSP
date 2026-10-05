# `components/dashboard/ThirdPartyContextsView.tsx`

> React component `ThirdPartyContextsView`.

**Kind:** React component · **Lines:** 651 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×5 (lucide-react), `SectionLabel`×4 (local), `ChevronDown`×3 (lucide-react), `Database`×3 (lucide-react), `Trash2`×2 (lucide-react), `Users`×2 (lucide-react), `X`×2 (lucide-react), `Activity`×2 (lucide-react), `StepBadge`×2 (local), `AlertCircle` (lucide-react), `CheckCircle2` (lucide-react), `RefreshCw` (lucide-react), `XCircle` (lucide-react), `Plus` (lucide-react), `Plug` (lucide-react), `SyncTaskRow` (local), `DeleteTaskRow` (local), `ContextCard` (local), `Zap` (lucide-react), `UserMinus` (lucide-react), `UserPlus` (lucide-react), `AgentAssignmentPanel` (local)

### Props

- **`ThirdPartyContextsView`**: `agents: AgentData[]`, `authCurrent: any`

**Hooks used:** `useState`×18, `useOpenClawWs`×2 (components/dashboard/OpenClawAgentTabs.tsx), `useMemo`×2, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ThirdPartyContextsView` | component | `ThirdPartyContextsView({ agents, authCurrent }: { agents: AgentData[]; authCurrent…)` | 283 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `DELETE /api/openclaw/contexts/ram/task/${task.task_id}${qs}` (L149)
  - `GET /api/openclaw/contexts/third-party/completed${qs}` (L302)
  - `GET /api/openclaw/contexts/ram/context/active${qs}` (L303)
  - `GET /api/openclaw/integrations${qs}` (L304)
  - `GET /api/openclaw/contexts/third-party/providers${qs}` (L305)
- **Timers / queues:** `setTimeout` at L93

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`
  - `components/dashboard/OpenClawAgentTabs.tsx` — `useOpenClawWs`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`, `useMemo`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `Plus`, `Zap`, `Users`, `Trash2`, `XCircle`, …

## Used by

- `components/dashboard/OpenClawContextsPage.tsx`
