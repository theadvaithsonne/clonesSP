# `components/dashboard/PostDetailView.tsx`

> React component `PostDetailView`.

**Kind:** React component · **Lines:** 1000 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `ArrowLeft`×2 (lucide-react), `Button` (local), `Clock` (lucide-react), `MoreHorizontal` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `FileText` (lucide-react), `PollDisplay` (components/feed/PollDisplay.tsx), `LinkPreview` (components/ui/link-preview.tsx), `ImageGrid` (components/dashboard/FeedComponents.tsx), `ReactionPicker` (components/feed/ReactionPicker.tsx), `Heart` (lucide-react), `MessageCircle` (lucide-react), `Repeat2` (lucide-react), `Bookmark` (lucide-react), `Check` (lucide-react), `Send` (lucide-react), `CommentThread` (components/feed/CommentThread.tsx), `CommentInput` (components/feed/CommentInput.tsx), `ReactionsModal` (components/feed/ReactionsModal.tsx)

### Props

- **`PostDetailView`**: `postId: string`, `orgId: string`, `currentUserId?: string`, `currentUserName?: string`, `currentUserAvatar?: string`, `onBack: () => void`, `onPostUpdate?: (post: Post) => void`, `onTagClick?: (tag: string) => void`, `onMentionClick?: (mention: string) => void`, `onEdit?: (post: Post) => void`, `onDelete?: (postId: string) => void`

**Hooks used:** `useState`×13, `useRef`×2, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PostDetailView` | component | `PostDetailView({ postId, orgId, currentUserId, currentUserName, currentUse…)` | 210 |

## Interfaces

- **Timers / queues:** `setTimeout` at L434, L896
- **External hosts mentioned in the code:** `www.youtube.com`

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getPost`, `getComments`, `addComment`, `deleteComment`, `updateComment`, `toggleCommentReaction`, `toggleReaction`, `toggleRepost`, … +7
  - `components/feed/ReactionPicker.tsx` — `ReactionPicker`
  - `components/feed/ReactionDisplay.tsx` — `ReactionDisplay`
  - `components/feed/ReactionsModal.tsx` — `ReactionsModal`
  - `components/ui/link-preview.tsx` — `LinkPreview`
  - `components/feed/PollDisplay.tsx` — `PollDisplay`
  - `components/feed/CommentInput.tsx` — `CommentInput`, `CommentAttachment`
  - `components/feed/CommentThread.tsx` — `CommentThread`, `groupCommentsIntoThreads`
  - `lib/feed-api.ts` — `getPostShareLink`
  - `components/feed/article-editor.css` (side effect)
  - `components/dashboard/FeedComponents.tsx` — `ImageGrid`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`
  - `lucide-react` — `Heart`, `MessageCircle`, `Repeat2`, `Bookmark`, `Share`, `Send`, …
  - `sonner` — `toast`
  - `dompurify`

## Used by

- `components/dashboard/FeedPageRedesigned.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L720).
