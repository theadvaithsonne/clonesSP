# `app/(dashboard)/workspace/hooks/useKnocking.ts`

> React hook `useKnocking`.

**Kind:** React hook · **Lines:** 59

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×4, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useKnocking` | hook | `useKnocking(me: string, localPeerState: PeerState \| undefined)` | 5 |

## Interfaces

- **Socket.IO events:**
  - emits: `workspace:knock`, `workspace:knock-cancel`, `workspace:knock-accept`, `workspace:knock-decline`

## Dependencies

- **Internal:**
  - `lib/socket.ts` — `connectSocket`
  - `app/(dashboard)/workspace/types.ts` — `PeerState`, `KnockRequest`
- **Packages:**
  - `react` — `useState`, `useCallback`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
