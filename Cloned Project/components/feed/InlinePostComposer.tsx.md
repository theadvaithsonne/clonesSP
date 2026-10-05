# `components/feed/InlinePostComposer.tsx`

> React component `InlinePostComposer`.

**Kind:** React component · **Lines:** 2337 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×9 (lucide-react), `Avatar`×4 (components/ui/avatar.tsx), `AvatarImage`×4 (components/ui/avatar.tsx), `AvatarFallback`×4 (components/ui/avatar.tsx), `Button`×3 (components/ui/button.tsx), `Check`×3 (lucide-react), `X`×3 (lucide-react), `ImageIcon`×3 (lucide-react), `FileText`×2 (lucide-react), `Hash`×2 (lucide-react), `Video`×2 (lucide-react), `ChevronDown` (lucide-react), `Type` (lucide-react), `ArticleEditor` (components/feed/ArticleEditor.tsx), `VoiceMessagePlayer` (components/ui/voice-message-player.tsx), `AudioLines` (lucide-react), `CustomVideoPlayer` (components/dashboard/CustomVideoPlayer.tsx), `ExternalLink` (lucide-react), `ImageOff` (lucide-react), `PollCreator` (components/feed/PollCreator.tsx), `Globe` (lucide-react), `Smile` (lucide-react), `EmojiPicker` (emoji-picker-react), `GifIcon` (local), `ScreenRecorder` (components/ui/screen-recorder.tsx), `Paperclip` (lucide-react), `Square` (lucide-react), `Mic` (lucide-react), `BarChart3` (lucide-react), `GifPickerModal` (components/feed/GifPickerModal.tsx)

### Props

- **`InlinePostComposer`**: `channels: Channel[]`, `orgId: string`, `user: { name: string; email?: string; profilePicture?: string; }`, `onPostCreated: () => void`, `teamMembers?: TeamMember[]`, `existingTags?: string[]`, `editPost?: Post | null`, `onCancel?: () => void`, `renderAsPage?: boolean`, `isMuted?: boolean`, `alwaysExpanded?: boolean`, `isFloatingPopover?: boolean`, `initialSelectedChannels?: string[]`

**Hooks used:** `useState`×28, `useRef`×11, `useEffect`×10, `useCallback`×7, `useUploadThing`×3 (lib/uploadthing.ts), `useMemo`×2, `useScreenRecording` (lib/screen-recording-context.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `InlinePostComposer` | component | `InlinePostComposer({ channels, orgId, user, onPostCreated, teamMembers, existi…)` | 175 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/link-preview?url=${encodeURIComponent(url)}` (L557)
- **External HTTP calls:**
  - `GET https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json` (L532)
- **Browser storage / cookies:** `pendingPostScreenRecording` (localStorage: remove/get)
- **Timers / queues:** `setInterval` at L774; `setTimeout` at L1378
- **External hosts mentioned in the code:** `www.youtube.com`, `img.youtube.com`

## Dependencies

- **Internal:**
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `createPost`, `createPollPost`, `updatePost`, `PostAttachment`, `uploadFile`, `Post`, `LinkPreviewData`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/feed/PollCreator.tsx` — `PollCreator`
  - `lib/uploadthing.ts` — `useUploadThing`
  - `components/feed/GifPickerModal.tsx` — `GifPickerModal`
  - `components/ui/screen-recorder.tsx` — `ScreenRecorder`
  - `lib/screen-recording-context.tsx` — `useScreenRecording`
  - `components/ui/voice-message-player.tsx` — `VoiceMessagePlayer`
  - `components/feed/ArticleEditor.tsx` — `ArticleEditor`
  - `components/dashboard/CustomVideoPlayer.tsx` — `CustomVideoPlayer (default)`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`, `useMemo`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Image as ImageIcon`, `X`, `ChevronDown`, `Globe`, `Loader2`, `Check`, …
  - `emoji-picker-react` — `EmojiClickData`, `Theme`
  - `sonner` — `toast`

## Used by

- `components/dashboard/FeedPageRedesigned.tsx`
- `components/feed/MobileCreatePostPage.tsx`

## Notes

- Large file (2337 lines) — read it by section; line numbers above point into it.
