# `components/feed/PollDisplay.tsx`

> React component `PollDisplay`.

**Kind:** React component · **Lines:** 229 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×2 (lucide-react), `Users` (lucide-react), `Clock` (lucide-react)

### Props

- **`PollDisplay`**: `poll: Poll`, `onVote?: (updatedPoll: Poll) => void`

**Hooks used:** `useState`×5, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PollDisplay` | component | `PollDisplay({ poll: initialPoll, onVote }: PollDisplayProps)` | 14 |

## Interfaces

- **Timers / queues:** `setInterval` at L42

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `voteOnPoll`, `Poll`, `PollOption`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `Check`, `Clock`, `Users`

## Used by

- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/PostDetailModal.tsx`
- `components/dashboard/PostDetailView.tsx`
