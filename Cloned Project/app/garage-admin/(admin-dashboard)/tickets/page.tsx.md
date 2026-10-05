# `app/garage-admin/(admin-dashboard)/tickets/page.tsx`

> Next.js page rendered at `/garage-admin/tickets`.

**Kind:** Next.js page · **Lines:** 1285 · **Directive:** `"use client"` · **Route:** `/garage-admin/tickets` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `UserPlus`×2 (lucide-react), `Icon`×2 (local), `Plus`×2 (lucide-react), `Section`×2 (local), `AssigneeChip`×2 (local), `ArrowLeft`×2 (lucide-react), `MessageBubble`×2 (local), `RoleChip` (components/garage-admin/assign-agent.tsx), `CheckCircle2` (lucide-react), `DetailView` (local), `NewTicketDialog` (local), `KanbanBoard` (local), `BoardCard` (local), `Row` (local), `AlertCircle` (lucide-react), `Mail` (lucide-react), `AssigneePicker` (local), `Send` (lucide-react), `Sparkles` (lucide-react)

**Hooks used:** `useState`×26, `useEffect`×5, `useAdminAccess`×2 (components/garage-admin/use-admin-access.ts), `useAdminSearch` (components/garage-admin/admin-search.tsx), `useMemo`, `useAssignableAgents` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GarageAdminTicketsPage)` | component | `GarageAdminTicketsPage()` | 256 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/assignable-agents` (L76)
  - `` GET /garage-admin/tickets${query ? `?${query}` : ""} `` (L286)
- **Timers / queues:** `setTimeout` at L275; `setInterval` at L302, L960

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `components/garage-admin/assign-agent.tsx` — `AdminOption`, `RoleChip`
  - `lib/admin-api/tickets.ts` — `adminTicketsApi`, `AdminTicket`, `AdminTicketStatus`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `date-fns` — `format`
  - `lucide-react` — `AlertCircle`, `ArrowLeft`, `CheckCircle2`, `Circle`, `Clock`, `LayoutGrid`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/tickets` (page).
