# `components/dashboard/service-taskroom/useLinkedService.ts`

> Resolves whether a Taskroom room is a service engagement room.

**Kind:** React component · **Lines:** 42 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Resolves whether a Taskroom room is a service engagement room.

Deliberately fail-silent and non-blocking: ordinary taskrooms resolve to
`null` (the backend answers 204) and nothing in the board waits on this. That
is what keeps the Service tab from appearing — and the taskroom from
behaving any differently — on rooms that have nothing to do with services.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useLinkedService` | hook | `useLinkedService(roomId?: string \| null)` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getServiceByTaskroom`, `TaskroomLinkedService`
- **Packages:**
  - `react` — `useEffect`, `useState`

## Used by

- `components/athena/ProjectMangement.tsx`
