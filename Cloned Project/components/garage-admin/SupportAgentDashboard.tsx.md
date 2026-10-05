# `components/garage-admin/SupportAgentDashboard.tsx`

> The Support Agent dashboard — the operator's "my work" view, scoped to the signed-in admin.

**Kind:** React component · **Lines:** 324 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The Support Agent dashboard — the operator's "my work" view, scoped to the
signed-in admin. It answers three questions at a glance: who am I supporting,
who still needs an NVC chat, and who has converted to a subscriber. Data
comes from /garage-admin/support/my-assignments (self-scoped); the NVC toggle
reuses the same endpoint the affiliate tables use, gated by the mark-nvc
grant so an agent without it sees the status read-only.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Stat`×4 (local), `Loader2` (lucide-react), `Headset` (lucide-react), `Link` (next/link), `Ticket` (lucide-react), `Avatar` (local), `MessageCircle` (lucide-react), `Icon` (local)

**Hooks used:** `useState`×3, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SupportAgentDashboard)` | component | `SupportAgentDashboard()` | 65 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/support/my-assignments` (L78)
  - `POST /garage-admin/users/${row.userId}/nvc-chat` (L109)
- **External hosts mentioned in the code:** `wa.me`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `next`
  - `sonner` — `toast`
  - `lucide-react` — `Check`, `Headset`, `Loader2`, `MessageCircle`, `Sparkles`, `Ticket`, …

## Used by

- `app/garage-admin/(admin-dashboard)/support/page.tsx`
