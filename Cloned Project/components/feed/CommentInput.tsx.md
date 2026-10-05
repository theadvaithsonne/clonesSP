# `components/feed/CommentInput.tsx`

> React component `CommentInput`.

**Kind:** React component · **Lines:** 617 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Button` (components/ui/button.tsx), `Send` (lucide-react), `VoiceMessagePlayer` (components/ui/voice-message-player.tsx), `AudioLines` (lucide-react), `X` (lucide-react), `Smile` (lucide-react), `EmojiPicker` (emoji-picker-react), `ImageIcon` (lucide-react), `GifIcon` (local), `Square` (lucide-react), `Mic` (lucide-react), `GifPickerModal` (components/feed/GifPickerModal.tsx)

### Props

- **`CommentInput`**: `user: { name: string; email?: string; profilePicture?: string; }`, `onSubmit: (content: string, attachments: CommentAttachment[]) => Prom…`, `placeholder?: string`, `disabled?: boolean`, `autoFocus?: boolean`

**Hooks used:** `useState`×8, `useRef`×8, `useEffect`×2, `useUploadThing` (lib/uploadthing.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CommentAttachment` | interface |  | 40 |
| `CommentInput` | component | `CommentInput({ user, onSubmit, placeholder = "Post your reply...", disab…)` | 62 |

## Interfaces

- **Timers / queues:** `setInterval` at L137

## Dependencies

- **Internal:**
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `uploadFile`
  - `lib/uploadthing.ts` — `useUploadThing`
  - `components/feed/GifPickerModal.tsx` — `GifPickerModal`
  - `components/ui/voice-message-player.tsx` — `VoiceMessagePlayer`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`
  - `lucide-react` — `Image as ImageIcon`, `X`, `Loader2`, `Smile`, `Mic`, `Square`, …
  - `emoji-picker-react` — `EmojiClickData`, `Theme`
  - `sonner` — `toast`

## Used by

- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/PostDetailView.tsx`
- `components/feed/CommentThread.tsx`
