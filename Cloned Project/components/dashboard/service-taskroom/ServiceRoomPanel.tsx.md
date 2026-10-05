# `components/dashboard/service-taskroom/ServiceRoomPanel.tsx`

> The "Service" tab shown inside a Taskroom room that belongs to a service engagement.

**Kind:** React component · **Lines:** 198 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The "Service" tab shown inside a Taskroom room that belongs to a service
engagement.

Purely additive: it renders only when `useLinkedService` resolves the room to
an engagement, so ordinary taskrooms never see this tab and nothing about
their behaviour changes. It reads from Garage's own API — not Taskroom's —
so it adds no load to the board's own fetch chain.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `UserIcon` (lucide-react), `CheckCircle2` (lucide-react), `CircleDashed` (lucide-react), `CreditCard` (lucide-react)

### Props

- **`ServiceRoomPanel`**: `linked: TaskroomLinkedService | null`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ServiceRoomPanel` | component | `ServiceRoomPanel({ linked, }: { linked: TaskroomLinkedService \| null; })` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `TaskroomLinkedService`, `(types only)`
- **Packages:**
  - `react` — `Fragment`
  - `lucide-react` — `CheckCircle2`, `CircleDashed`, `CreditCard`, `Loader2`, `User as UserIcon`

## Used by

- `components/athena/ProjectMangement.tsx`
