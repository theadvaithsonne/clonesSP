# `components/ui/voice-message-player.tsx`

> React component `VoiceMessagePlayer`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 160 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Pause` (lucide-react), `Play` (lucide-react)

### Props

- **`VoiceMessagePlayer`**: `src: string`, `isOwnMessage?: boolean`

**Hooks used:** `useState`×4, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `VoiceMessagePlayer` | component | `VoiceMessagePlayer({ src, isOwnMessage = false, }: VoiceMessagePlayerProps)` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Play`, `Pause`

## Used by

- `components/dashboard/DMPage.tsx`
- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
- `components/feed/CommentInput.tsx`
- `components/feed/CommentThread.tsx`
- `components/feed/CreatePostModal.tsx`
- `components/feed/InlinePostComposer.tsx`
- `components/garage-admin/SupportChatsConsole.tsx`
