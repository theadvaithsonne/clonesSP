# `components/discover/globe/GlobeTicker.tsx`

> React component `GlobeTicker`.

**Kind:** React component · **Lines:** 81 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Image` (next/image), `Building2` (lucide-react)

### Props

- **`GlobeTicker`**: `messages: TickerMessage[]`, `activeTab: TabType`, `onMessageClick: (message: TickerMessage) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GlobeTicker` | component | `GlobeTicker({ messages, activeTab, onMessageClick, }: GlobeTickerProps)` | 13 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/discover/globe/types.ts` — `TickerMessage`, `TabType`, `(types only)`
- **Packages:**
  - `next`
  - `lucide-react` — `Building2`

## Used by

- `components/discover/globe/GlobeView.tsx`
