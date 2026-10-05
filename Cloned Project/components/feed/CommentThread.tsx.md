# `components/feed/CommentThread.tsx`

> React component `CommentThread`.

**Kind:** React component · **Lines:** 487 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence`×2 (framer-motion), `CommentItem`×2 (local), `MoreHorizontal` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `VoiceMessagePlayer` (components/ui/voice-message-player.tsx), `ReactionPicker` (components/feed/ReactionPicker.tsx), `CommentInput` (components/feed/CommentInput.tsx), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react)

### Props

- **`CommentThread`**: `comment: CommentWithReplies`, `onReply: (parentCommentId: string, content: string, attachments: Comm…`, `currentUser: { userId?: string; name: string; email?: string; profile…`, `onEditComment?: (commentId: string, newContent: string) => Promise<vo…`, `onDeleteComment?: (commentId: string) => Promise<void>`, `onReactComment?: (commentId: string, reactionType: ReactionType) => P…`

**Hooks used:** `useState`×7, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CommentWithReplies` | interface |  | 31 |
| `CommentThread` | component | `CommentThread({ comment, onReply, currentUser, onEditComment, onDeleteCom…)` | 442 |
| `groupCommentsIntoThreads` | function | `groupCommentsIntoThreads(comments: Comment[]): CommentWithReplies[]` — Build a nested comment tree of unlimited depth from a flat list, linking each comment to its parent via `parentCommentId`. | 460 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `Comment`, `ReactionType`, `REACTION_EMOJIS`, `REACTION_LABELS`
  - `components/feed/CommentInput.tsx` — `CommentInput`, `CommentAttachment`
  - `components/ui/voice-message-player.tsx` — `VoiceMessagePlayer`
  - `components/feed/ReactionPicker.tsx` — `ReactionPicker`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `lucide-react` — `MessageCircle`, `ChevronDown`, `ChevronUp`, `MoreHorizontal`, `Pencil`, `Trash2`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/PostDetailView.tsx`
