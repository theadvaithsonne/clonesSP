# `app/(dashboard)/taskroom/all-taskrooms/components/taskroom-card.tsx`

> React component `TaskRoomCard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 432 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Users`×2 (lucide-react), `MoreVertical` (lucide-react), `ChevronRight` (lucide-react), `Edit` (lucide-react), `Trash2` (lucide-react), `X` (lucide-react), `Search` (lucide-react), `SkeletonEmployeeItem` (local)

### Props

- **`TaskRoomCard`**: `taskRoom: TaskRoom`, `onEdit?: (taskRoom: TaskRoom) => void`, `onDelete?: (taskRoom: TaskRoom) => void`, `userId: string`

**Hooks used:** `useState`×9, `useEffect`×2, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskRoom` | interface |  | 13 |
| `TaskRoomCard` | component | `TaskRoomCard({ taskRoom, onEdit, onDelete, userId }: TaskRoomCardProps)` | 54 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/organizations/${orgId}/users` (L105)
- **External HTTP calls:**
  - `PUT uatapi.garage.app/v1/rooms/transfer/${taskRoom._id}` (L190)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `garage_org_id` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `ChevronRight`, `Users`, `MoreVertical`, `Edit`, `Trash2`, `Search`, …
  - `next` — `useRouter`
  - `axios`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/components/AllTaskroomDashbaord.tsx`
