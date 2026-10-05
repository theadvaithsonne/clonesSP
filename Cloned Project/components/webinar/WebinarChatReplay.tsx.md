# `components/webinar/WebinarChatReplay.tsx`

> Chat replay for a recorded webinar — YouTube-style: messages appear as the video reaches the moment they were sent.

**Kind:** React component · **Lines:** 196 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Chat replay for a recorded webinar — YouTube-style: messages appear as the
video reaches the moment they were sent.

The recording itself has no chat in it. LiveKit's composite egress records
the participant grid and nothing else, so the messages are re-synced here
at playback time instead of being burned into the video. That keeps them
searchable and selectable, and means every past recording gets chat too —
the data was always being stored.

Sync anchor is the recording's `startedAt` (backend derives it from the S3
key, which encodes the egress start; `createdAt` is upload time and can be
hours later). A message belongs at `timestamp - startedAt` seconds in.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MessageSquare` (lucide-react), `Loader2` (lucide-react), `GifBubble` (components/webinar/GifBubble.tsx)

### Props

- **`WebinarChatReplay`**: `workshopId: string`, `startedAt?: string | null`, `currentTime: number`, `className?: string`

**Hooks used:** `useState`×3, `useEffect`×2, `useMemo`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WebinarChatReplay)` | component | `WebinarChatReplay({ workshopId, startedAt, currentTime, className, }: Props)` | 46 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET webinar/${workshopId}/messages` (L62)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/chat-markers.ts` — `parseMarker`
  - `components/webinar/GifBubble.tsx` — `GifBubble`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `MessageSquare`, `Loader2`

## Used by

- `components/dashboard/RightPanel.tsx`
