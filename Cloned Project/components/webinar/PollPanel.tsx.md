# `components/webinar/PollPanel.tsx`

> React component `PollPanel`.

**Kind:** React component · **Lines:** 202 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `Plus` (lucide-react)

### Props

- **`PollPanel`**: `socket: Socket | null`, `webinarId: string`

**Hooks used:** `useState`×4, `useWebinarStore`×2 (store/webinarStore.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PollPanel)` | component | `PollPanel({ socket, webinarId }: PollPanelProps)` | 13 |

## Interfaces

- **Socket.IO events:**
  - emits: `webinar:createPoll`, `webinar:submitVote`

## Dependencies

- **Internal:**
  - `store/webinarStore.ts` — `useWebinarStore (default)`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Plus`, `X`
  - `socket.io-client` — `Socket`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
