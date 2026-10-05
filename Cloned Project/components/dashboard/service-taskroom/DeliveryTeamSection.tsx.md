# `components/dashboard/service-taskroom/DeliveryTeamSection.tsx`

> "Delivery team & pay rates" — part of Section 3 for a billable service.

**Kind:** React component · **Lines:** 372 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
"Delivery team & pay rates" — part of Section 3 for a billable service.

Two things live here that nothing else in the wizard covers:

 - what each person is paid per hour. It is per person, not per service,
   because nobody is paid the same; the gap against the client's billed rate
   is the margin, shown per row so a loss-making rate is obvious while it is
   being typed.
 - which tasks are theirs. A task added here lands on the taskroom board in
   Section 6 with them as the assignee, and provisioning adds them to the
   engagement room, so the assignment survives into Taskroom untouched.

Pay rates are internal. The server strips them from every response a
non-founder can reach — this component is the only place they are shown.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `Avatar`×2 (local), `Wallet` (lucide-react), `UserPlus` (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react), `Plus` (lucide-react), `Trash2` (lucide-react), `Check` (lucide-react)

### Props

- **`DeliveryTeamSection`**: `team: ServiceTeamMember[]`, `onChange: (team: ServiceTeamMember[]) => void`, `currency: string`, `hourlyRate: number`, `members: TeamMember[]`, `loadingMembers: boolean`, `assignedTasks: Record<string, string[]>`, `onAssignTask: (member: ServiceTeamMember, title: string) => void`, `onUnassignTask: (userId: string, title: string) => void`, `boardEnabled: boolean`

**Hooks used:** `useState`×3, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DeliveryTeamSection` | component | `DeliveryTeamSection({ team, onChange, currency, hourlyRate, members, loadingMem…)` | 66 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `ServiceTeamMember`, `TeamMember`, `(types only)`
- **Packages:**
  - `react` — `useMemo`, `useState`
  - `lucide-react` — `Check`, `Loader2`, `Plus`, `Search`, `Trash2`, `UserPlus`, …

## Used by

- `components/dashboard/ServiceFormModal.tsx`
