# `app/(dashboard)/workspace/hooks/useDaily.ts`

> React hook `useDaily`.

**Kind:** React hook · **Lines:** 705 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×13, `useCallback`×10, `useRef`×4, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RemoteUserTracks` | interface |  | 16 |
| `DailyChatMessage` | interface |  | 27 |
| `useDaily` | hook | `useDaily()` | 66 |

## Interfaces

- **Socket.IO events:**
  - emits: `workspace:move-to-space`, `daily:screen-share-state`, `daily:leave-call`
  - listens for: `daily:init-call`, `daily:join-call`, `daily:leave-call`, `daily:participants-update`, `daily:call-answered-elsewhere`, `daily:join-error`

## Dependencies

- **Internal:**
  - `lib/socket.ts` — `connectSocket`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `@daily-co/daily-js` — `DailyCall`, `DailyParticipant`, `DailyEventObjectParticipant`, `DailyEventObjectParticipantLeft`, `DailyEventObjectFatalError`, `DailyEventObjectNonFatalError`
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
