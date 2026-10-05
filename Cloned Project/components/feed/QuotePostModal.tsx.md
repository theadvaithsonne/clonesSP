# `components/feed/QuotePostModal.tsx`

> React component `QuotePostModal`.

**Kind:** React component · **Lines:** 351 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×3 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `X` (lucide-react), `Button` (components/ui/button.tsx), `Loader2` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Globe` (lucide-react), `ChevronDown` (lucide-react), `QuotedPostPreview` (components/feed/QuotedPostPreview.tsx), `Smile` (lucide-react), `EmojiPicker` (emoji-picker-react)

### Props

- **`QuotePostModal`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `channels: Channel[]`, `orgId: string`, `user: { name: string; email?: string; profilePicture?: string; }`, `quotedPost: Post`, `onPostCreated: () => void`

**Hooks used:** `useState`×5, `useEffect`×3, `useRef`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `QuotePostModal` | component | `QuotePostModal({ open, onOpenChange, channels, orgId, user, quotedPost, on…)` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `createQuotePost`, `Post`, `PostAttachment`
  - `components/feed/QuotedPostPreview.tsx` — `QuotedPostPreview`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `lucide-react` — `X`, `ChevronDown`, `Loader2`, `Check`, `Smile`, `Globe`
  - `emoji-picker-react` — `Theme`
  - `sonner` — `toast`

## Used by

- `components/dashboard/FeedPageRedesigned.tsx`
