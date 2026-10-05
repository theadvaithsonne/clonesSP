# `components/webinar/RecordingBanner.tsx`

> Recording banner — shown to ALL participants while the host has recording active.

**Kind:** React component · **Lines:** 22 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Recording banner — shown to ALL participants while the host has
recording active. The Zustand `isRecording` flag is already kept in
sync via the existing `webinar:recordingStarted/Stopped` socket
broadcast in app/webinar/[id]/page.tsx, so this component just
subscribes and renders.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Circle` (lucide-react)

**Hooks used:** `useWebinarStore` (store/webinarStore.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RecordingBanner)` | component | `RecordingBanner()` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/webinarStore.ts` — `useWebinarStore (default)`
- **Packages:**
  - `lucide-react` — `Circle`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
