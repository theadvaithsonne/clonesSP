# `components/dashboard/PostDetailModal.tsx`

> React component `PostDetailModal`.

**Kind:** React component · **Lines:** 660 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `Send`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `X` (lucide-react), `MoreHorizontal` (lucide-react), `PollDisplay` (components/feed/PollDisplay.tsx), `LinkPreview` (components/ui/link-preview.tsx), `ImageGrid` (components/dashboard/FeedComponents.tsx), `ReactionPicker` (components/feed/ReactionPicker.tsx), `Heart` (lucide-react), `MessageCircle` (lucide-react), `Repeat2` (lucide-react), `Bookmark` (lucide-react), `Check` (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx), `ReactionsModal` (components/feed/ReactionsModal.tsx)

### Props

- **`PostDetailModal`**: `isOpen: boolean`, `onClose: () => void`, `postId: string | null`, `orgId: string`, `currentUserId?: string`, `currentUserName?: string`, `currentUserAvatar?: string`, `onPostUpdate?: (post: Post) => void`, `onTagClick?: (tag: string) => void`, `onMentionClick?: (mention: string) => void`

**Hooks used:** `useState`×13, `useRef`, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PostDetailModal` | component | `PostDetailModal({ isOpen, onClose, postId, orgId, currentUserId, currentUse…)` | 112 |

## Interfaces

- **Timers / queues:** `setTimeout` at L296, L517

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getPost`, `getComments`, `addComment`, `toggleReaction`, `toggleRepost`, `toggleBookmark`, `Post`, `Comment`, … +3
  - `components/ui/link-preview.tsx` — `LinkPreview`
  - `components/feed/PollDisplay.tsx` — `PollDisplay`
  - `components/feed/ReactionPicker.tsx` — `ReactionPicker`
  - `components/feed/ReactionDisplay.tsx` — `ReactionDisplay`
  - `components/feed/ReactionsModal.tsx` — `ReactionsModal`
  - `lib/feed-api.ts` — `getPostShareLink`
  - `components/dashboard/FeedComponents.tsx` — `ImageGrid`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`
  - `lucide-react` — `Heart`, `MessageCircle`, `Repeat2`, `Bookmark`, `Share`, `ArrowLeft`, …
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
