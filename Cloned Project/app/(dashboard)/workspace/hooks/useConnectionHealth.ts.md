# `app/(dashboard)/workspace/hooks/useConnectionHealth.ts`

> React hook `useConnectionHealth`.

**Kind:** React hook · **Lines:** 206 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useRef`×3, `useCallback`×3, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useConnectionHealth` | hook | `useConnectionHealth(options: UseConnectionHealthOptions = {})` | 51 |

## Interfaces

- **Socket.IO events:**
  - emits: `workspace:rejoin`, `workspace:check-presence`, `workspace:request-sync`, `workspace:heartbeat`
  - listens for: `connect`, `workspace:heartbeat-ack`, `workspace:join-confirmed`, `workspace:full-sync`
- **Timers / queues:** `setTimeout` at L77, L152

## Dependencies

- **Internal:**
  - `lib/socket.ts` — `connectSocket`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useCallback`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
