# `components/feed/CreatePostModal.tsx`

> React component `CreatePostModal`.

**Kind:** React component · **Lines:** 1709 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×7 (lucide-react), `X`×3 (lucide-react), `Check`×3 (lucide-react), `Avatar`×2 (components/ui/avatar.tsx), `AvatarImage`×2 (components/ui/avatar.tsx), `AvatarFallback`×2 (components/ui/avatar.tsx), `Hash`×2 (lucide-react), `Video`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `ChevronDown` (lucide-react), `VoiceMessagePlayer` (components/ui/voice-message-player.tsx), `AudioLines` (lucide-react), `CustomVideoPlayer` (components/dashboard/CustomVideoPlayer.tsx), `FileText` (lucide-react), `LinkIcon` (lucide-react), `PollCreator` (components/feed/PollCreator.tsx), `Globe` (lucide-react), `Smile` (lucide-react), `EmojiPicker` (emoji-picker-react), `ImageIcon` (lucide-react), `GifIcon` (local), `ScreenRecorder` (components/ui/screen-recorder.tsx), `Paperclip` (lucide-react), `Square` (lucide-react), `Mic` (lucide-react), `BarChart3` (lucide-react), `Button` (components/ui/button.tsx)

### Props

- **`CreatePostModal`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `channels: Channel[]`, `orgId: string`, `user: { name: string; email?: string; profilePicture?: string; }`, `onPostCreated: () => void`, `teamMembers?: TeamMember[]`, `existingTags?: string[]`, `editPost?: Post | null`

**Hooks used:** `useState`×26, `useRef`×11, `useEffect`×6, `useCallback`×4, `useUploadThing`×3 (lib/uploadthing.ts), `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreatePostModal` | component | `CreatePostModal({ open, onOpenChange, channels, orgId, user, onPostCreated,…)` | 128 |

## Interfaces

- **External HTTP calls:**
  - `GET https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g` (L259)
  - `GET https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
            query
          )}&limit=20&rating=g` (L287)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_GIPHY_API_KEY`
- **Browser storage / cookies:** `pendingPostScreenRecording` (localStorage: remove/get)
- **Timers / queues:** `setTimeout` at L312; `setInterval` at L517
- **External hosts mentioned in the code:** `api.giphy.com`

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `createPost`, `createPollPost`, `updatePost`, `PostAttachment`, `uploadFile`, `Post`
  - `components/feed/PollCreator.tsx` — `PollCreator`
  - `lib/uploadthing.ts` — `useUploadThing`
  - `components/ui/voice-message-player.tsx` — `VoiceMessagePlayer`
  - `components/ui/screen-recorder.tsx` — `ScreenRecorder`
  - `components/dashboard/CustomVideoPlayer.tsx` — `CustomVideoPlayer (default)`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`, `useMemo`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Image as ImageIcon`, `X`, `ChevronDown`, `Globe`, `Loader2`, `Check`, …
  - `emoji-picker-react` — `EmojiClickData`, `Theme`
  - `sonner` — `toast`

## Used by

- `components/dashboard/FeedPageRedesigned.tsx`

## Notes

- Large file (1709 lines) — read it by section; line numbers above point into it.
