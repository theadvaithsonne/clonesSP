# `app/meet/join/useMeetDaily.ts`

> React hook `useMeetDaily`.

**Kind:** React hook · **Lines:** 807 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×25, `useCallback`×18, `useRef`×6, `useEffect`×5

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RemoteUserTracks` | interface |  | 13 |
| `useMeetDaily` | hook | `useMeetDaily(config: MeetDailyConfig \| null, isHost: boolean = false)` | 43 |

## Interfaces

- **Timers / queues:** `setTimeout` at L467

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `@daily-co/daily-js` — `DailyCall`, `DailyParticipant`, `DailyEventObjectParticipant`, `DailyEventObjectParticipantLeft`, `DailyEventObjectFatalError`
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
