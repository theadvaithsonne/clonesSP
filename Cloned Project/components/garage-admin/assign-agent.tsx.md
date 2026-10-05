# `components/garage-admin/assign-agent.tsx`

> Support-agent assignment — the "Assigned To" column cell plus its picker dialog, shared by every garage-admin table that lists a USER.

**Kind:** React component · **Lines:** 336 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Support-agent assignment — the "Assigned To" column cell plus its picker
dialog, shared by every garage-admin table that lists a USER.

The assignment is stored on the User (`assignedSupportAgentId`), not on
anything list-specific, so it is the SAME assignment everywhere: assign from
NetworkChain Subs and One Time Affiliates shows it, and vice versa. That is
why this posts to the neutral `/garage-admin/users/:userId/assign-agent`
rather than a per-table endpoint.

Extracted from the NetworkChain Subs page so the two tables cannot drift.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar`×2 (local), `RoleChip`×2 (local), `Loader2`×2 (lucide-react), `X` (lucide-react), `CheckIcon` (lucide-react)

### Props

- **`RoleChip`**: `role?: string | null`
- **`AssignedCell`**: `row: T`, `onAssign: (row: T) => void`, `canAssign: boolean`
- **`AssignAgentDialog`**: `subject: T | null`, `onClose: () => void`, `onAssigned: (userId: string, agent: AssignedAgent | null) => void`, `canAssign: boolean`

**Hooks used:** `useState`×3, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AssignedAgent` | type | The support agent (a GarageAdmin) assigned to a user. | 21 |
| `AdminOption` | type |  | 31 |
| `RoleChip` | component | `RoleChip({ role }: { role?: string \| null })` — Role chip — the named roles are the point, so they get the accent. | 54 |
| `AssignableRow` | type | The minimum a row must expose to be assignable. | 72 |
| `AssignedCell` | component | `AssignedCell({ row, onAssign, canAssign, }: { row: T; onAssign: (row: T)…)` — "Assigned To" cell — an Assign button when empty, the agent + Change when set. | 98 |
| `AssignAgentDialog` | component | `AssignAgentDialog({ subject, onClose, onAssigned, canAssign, }: { subject: T …)` — Support-agent picker. | 158 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/assignable-agents` (L179)
  - `POST /garage-admin/users/${userId}/assign-agent` (L220)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Check as CheckIcon`, `Loader2`, `X`
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchain-subs/page.tsx`
- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
- `app/garage-admin/(admin-dashboard)/tickets/page.tsx`
