# `components/meet/PersistentPipRenderer.tsx`

> React component `PipProvider`.

**Kind:** React component · **Lines:** 358 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PipContext` (local), `MeetPipContent` (app/meet/join/MeetPipContent.tsx)

### Props

- **`PipProvider`**: `children: ReactNode`

**Hooks used:** `useEffect`×10, `useRef`×4, `useMemo`×4, `useCallback`×3, `useState`×2, `useContext`, `useMeeting` (lib/meeting-context.tsx), `useRouter` (next/navigation), `usePathname` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `usePip` | hook | `usePip()` | 41 |
| `PipProvider` | component | `PipProvider({ children }: { children: ReactNode })` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/meeting-context.tsx` — `useMeeting`
  - `app/meet/join/MeetPipContent.tsx` — `MeetPipContent (default)`, `PipParticipant`
  - `lib/livekit/pip-window.ts` — `createCanvasMediaStream`, `isDocumentPipSupported as checkPipSupported`, `requestPipWindow`
- **Packages:**
  - `react` — `createContext`, `useCallback`, `useContext`, `useEffect`, `useMemo`, `useRef`, …
  - `react-dom` — `createPortal`
  - `next` — `usePathname`, `useRouter`

## Used by

- `app/layout.tsx`
- `app/meet/join/MeetVideoCall.tsx`
