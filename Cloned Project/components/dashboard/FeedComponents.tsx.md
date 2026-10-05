# `components/dashboard/FeedComponents.tsx`

> React components `CreatePostCard`, `ImageGrid`, `PostCard`, `ChannelAccessGate`.

**Kind:** React component · **Lines:** 2009 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SkeletonImage`×6 (local), `Button`×3 (components/ui/button.tsx), `Pin`×3 (lucide-react), `X`×2 (lucide-react), `Maximize`×2 (lucide-react), `Play`×2 (lucide-react), `Youtube`×2 (lucide-react), `AnimatePresence`×2 (framer-motion), `FileText`×2 (lucide-react), `Textarea` (components/ui/textarea.tsx), `Input` (components/ui/input.tsx), `Tag` (lucide-react), `Send` (lucide-react), `Minimize` (lucide-react), `YouTubePlayer` (local), `CustomVideoPlayer` (components/dashboard/CustomVideoPlayer.tsx), `MoreHorizontal` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `Clock` (lucide-react), `ExpandablePostContent` (local), `PollDisplay` (components/feed/PollDisplay.tsx), `ExternalLink` (lucide-react), `LinkPreview` (components/ui/link-preview.tsx), `QuotedPostPreview` (components/feed/QuotedPostPreview.tsx), `ImageGrid` (local), `VideoPlayer` (local), `VoiceMessagePlayer` (components/ui/voice-message-player.tsx), `Trash` (lucide-react), `ReactionPicker` (components/feed/ReactionPicker.tsx), `Loader2` (lucide-react), `Check` (lucide-react), `Share2` (lucide-react), `CommentThread` (components/feed/CommentThread.tsx), `CommentInput` (components/feed/CommentInput.tsx), `ReactionsModal` (components/feed/ReactionsModal.tsx), `Lock` (lucide-react)

### Props

- **`CreatePostCard`**: `channels: Array<{ _id: string; title: string }>`, `selectedChannelId: string | null`, `onCreatePost: (data: { content: string; channelIds: string[]; tags: s…`
- **`ImageGrid`**: `images: { url: string; name: string }[]`, `onImageClick?: (index: number) => void`
- **`PostCard`**: `post: Post`, `onLike: (postId: string) => void`, `onReact?: ( postId: string, reactionType: ReactionType, result: { rea…`, `onComment: ( postId: string, content: string, attachments?: CommentAt…`, `onRepost?: (postId: string) => void`, `onQuote?: (postId: string) => void`, `onBookmark?: (postId: string) => void`, `onPin?: (postId: string) => void`, `onUnpin?: (postId: string) => void`, `onClick?: (postId: string) => void`, `onImageClick?: (post: Post, imageIndex: number) => void`, `onEdit?: (post: Post) => void`, `onDelete?: (postId: string) => void`, `onTagClick?: (tag: string) => void`, `onMentionClick?: (mention: string) => void`, `currentUserId?: string`, `currentUserEmail?: string`, `currentUserName?: string`, `currentUserAvatar?: string`, `newComment?: Comment`, `orgId?: string | null`, `isHighlighted?: boolean`
- **`ChannelAccessGate`**: `channel: { _id: string; title: string; description?: string; price: n…`, `onSubscribe: () => void`

**Hooks used:** `useState`×25, `useEffect`×5, `useRef`×2, `useCallback`×2, `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Post` | interface |  | 105 |
| `CreatePostCard` | component | `CreatePostCard({ channels, selectedChannelId, onCreatePost, }: { channels:…)` | 154 |
| `ImageGrid` | component | `ImageGrid({ images, onImageClick, }: { images: { url: string; name: s…)` | 503 |
| `PostCard` | component | `PostCard({ post, onLike, onReact, onComment, onRepost, onQuote, onBo…)` | 814 |
| `ChannelAccessGate` | component | `ChannelAccessGate({ channel, onSubscribe, }: { channel: { _id: string; title:…)` | 1970 |

## Interfaces

- **Browser storage / cookies:** `garage_org_slug` (localStorage: get)
- **Timers / queues:** `setTimeout` at L415, L1220, L1233, L1867
- **External hosts mentioned in the code:** `img.youtube.com`, `www.google.com`, `www.youtube.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/input.tsx` — `Input`
  - `components/dashboard/CustomVideoPlayer.tsx` — `CustomVideoPlayer (default)`
  - `lib/utils.ts` — `cn`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `lib/feed-api.ts` — `getComments`, `addComment`, `deleteComment`, `updateComment`, `toggleCommentReaction`, `toggleReaction`, `Comment`, `QuotedPost`, … +7
  - `components/feed/ReactionPicker.tsx` — `ReactionPicker`
  - `components/feed/ReactionDisplay.tsx` — `ReactionDisplay`
  - `components/feed/ReactionsModal.tsx` — `ReactionsModal`
  - `components/ui/link-preview.tsx` — `LinkPreview`
  - `components/feed/RepostMenu.tsx` — `RepostMenu`
  - `components/feed/QuotedPostPreview.tsx` — `QuotedPostPreview`
  - `components/feed/PollDisplay.tsx` — `PollDisplay`
  - `components/ui/voice-message-player.tsx` — `VoiceMessagePlayer`
  - `components/feed/CommentInput.tsx` — `CommentInput`, `CommentAttachment`
  - `lib/feed-api.ts` — `getPostShareLink`
  - `components/feed/CommentThread.tsx` — `CommentThread`, `groupCommentsIntoThreads`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `lucide-react` — `Heart`, `MessageCircle`, `Send`, `X`, `Tag`, `Lock`, …
  - `framer-motion` — `motion`, `AnimatePresence`
  - `sonner` — `toast`

## Used by

- `components/dashboard/FeedPageRedesigned.tsx`
- `components/dashboard/PostDetailModal.tsx`
- `components/dashboard/PostDetailView.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L1992).
- Large file (2009 lines) — read it by section; line numbers above point into it.
