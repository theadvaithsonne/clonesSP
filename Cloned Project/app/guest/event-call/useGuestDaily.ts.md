# `app/guest/event-call/useGuestDaily.ts`

> React hook `useGuestDaily`.

**Kind:** React hook · **Lines:** 478 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×13, `useCallback`×10, `useRef`×3, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RemoteUserTracks` | interface |  | 13 |
| `useGuestDaily` | hook | `useGuestDaily(config: GuestDailyConfig \| null)` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `@daily-co/daily-js` — `DailyCall`, `DailyParticipant`, `DailyEventObjectParticipant`, `DailyEventObjectParticipantLeft`, `DailyEventObjectFatalError`
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
