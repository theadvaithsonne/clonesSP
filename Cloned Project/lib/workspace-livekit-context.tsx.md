# `lib/workspace-livekit-context.tsx`

> React component `WorkspaceLiveKitProvider`.

**Kind:** frontend library · **Lines:** 62 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `WorkspaceLiveKitContext` (local)

### Props

- **`WorkspaceLiveKitProvider`**: `children: ReactNode`

**Hooks used:** `useLiveKit` (app/(dashboard)/workspace/hooks/useLiveKit.ts), `useContext`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkspaceLiveKitProvider` | component | `WorkspaceLiveKitProvider({ children }: { children: ReactNode })` | 32 |
| `useWorkspaceLiveKit` | hook | `useWorkspaceLiveKit(): WorkspaceLiveKitValue` — Read the shared workspace LiveKit state. | 53 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/workspace/hooks/useLiveKit.ts` — `useLiveKit`
- **Packages:**
  - `react` — `createContext`, `useContext`, `ReactNode`

## Used by

- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/workspace/WorkspaceClient.tsx`
- `components/dashboard/ConferenceRoomPage.tsx`
- `components/dashboard/WorkspacePipBridge.tsx`
