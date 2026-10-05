# `app/(dashboard)/workspace/components/PeerAudio.tsx`

> React component `PeerAudio`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 145 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`PeerAudio`**: `peer: PeerState`, `isLocal: boolean`

**Hooks used:** `useRef`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PeerAudio` | component | `memo( ({ peer, isLocal }: { peer: PeerState; isLocal: boolean }) => { const audioRef = us…` | 6 |

## Interfaces

- **Timers / queues:** `setTimeout` at L52

## Dependencies

- **Internal:**
  - `app/(dashboard)/workspace/types.ts` — `PeerState`
- **Packages:**
  - `react` — `memo`, `useRef`, `useEffect`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
