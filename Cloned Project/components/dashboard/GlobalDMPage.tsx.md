# `components/dashboard/GlobalDMPage.tsx`

> React component `GlobalDMPage`.

**Kind:** React component · **Lines:** 1846 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×8 (components/ui/button.tsx), `Avatar`×7 (components/ui/avatar.tsx), `AvatarImage`×7 (components/ui/avatar.tsx), `AvatarFallback`×7 (components/ui/avatar.tsx), `X`×5 (lucide-react), `ImageIcon`×3 (lucide-react), `FileText`×3 (lucide-react), `DropdownMenu`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuItem`×3 (components/ui/dropdown-menu.tsx), `Pin`×3 (lucide-react), `MediaThumbnail`×3 (components/ui/media-thumbnail.tsx), `DeleteConfirmDialog`×2 (components/chat/MessageActions.tsx), `Loader2`×2 (lucide-react), `LinkPreview`×2 (components/ui/link-preview.tsx), `SelectionToolbar` (components/chat/MessageActions.tsx), `ForwardDialog` (components/chat/MessageActions.tsx), `ArrowLeft` (lucide-react), `MoreVertical` (lucide-react), `LongPressDiv` (components/chat/MessageActions.tsx), `SelectionCheckOverlay` (components/chat/MessageActions.tsx), `MessageActionMenu` (components/chat/MessageActions.tsx), `Forward` (lucide-react), `VoiceMessagePlayer` (components/ui/voice-message-player.tsx), `Download` (lucide-react), `CheckCheck` (lucide-react), `Check` (lucide-react), `MessageContent` (components/chat/MessageContent.tsx), `QuickReactionButton` (components/chat/MessageActions.tsx), `MessageReactions` (components/chat/MessageActions.tsx), `Edit3` (lucide-react), `FormatToolbar` (components/chat/FormatToolbar.tsx), `SlashCommandMenu` (components/chat/SlashCommandMenu.tsx), `EmojiPickerComponent` (components/ui/emoji-picker.tsx), `FileAttachment` (components/ui/file-attachment.tsx), `Send` (lucide-react), `VoiceRecorder` (components/ui/voice-recorder.tsx), `VideoMessageRecorder` (components/chat/VideoMessageRecorder.tsx), `GifPicker` (components/chat/GifPicker.tsx), … +6 more

### Props

- **`GlobalDMPage`**: `id: string`, `onClose?: () => void`, `otherUserData?: GlobalUser | null`, `isMini?: boolean`, `onTypingLabelChange?: (label: string | null) => void`

**Hooks used:** `useState`×25, `useEffect`×15, `useRef`×5, `useMemo`, `useChat` (lib/chat-context.tsx), `useTypingIndicator` (lib/hooks/useTypingIndicator.ts), `usePinnedIds` (lib/messageExtras.ts), `useSlashCommands` (lib/hooks/useSlashCommands.ts), `useSlashCardSync` (lib/hooks/useSlashCardSync.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GlobalDMPage)` | component | `GlobalDMPage({ id, onClose, otherUserData, isMini = false, onTypingLabel…)` | 116 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/users/discover/${otherId}` (L320)
  - `GET /backend/users/discover/${me}` (L332)
  - `GET /backend/global-dm/${otherId}/messages` (L344)
  - `GET /backend/global-dm/${otherId}/messages?cursor=${nextCursor}` (L368)
  - `POST /backend/global-dm/${otherId}/read` (L391)
  - `DELETE /backend/user-notifications/global-dm/${otherId}` (L397)
  - `POST /backend/upload` (L525)
  - `PUT /backend/global-dm/message/${messageId}` (L702)
  - `DELETE /backend/global-dm/message/${messageId}` (L729)
  - `GET /backend/team/list?orgId=${orgId}` (L903)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L261, L286, L352, L479, L601, …

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `lib/socket.ts` — `connectSocket`, `getSocket`
  - `lib/conv.ts` — `globalDmConvId`
  - `components/ui/button.tsx` — `Button`
  - `lib/chat-context.tsx` — `useChat`
  - `lib/utils.ts` — `cn`
  - `components/ui/emoji-picker.tsx` — `EmojiPickerComponent`
  - `components/ui/file-attachment.tsx` — `FileAttachment`, `FilePreview`
  - `components/ui/voice-recorder.tsx` — `VoiceRecorder`
  - `components/ui/voice-message-player.tsx` — `VoiceMessagePlayer`
  - `components/ui/screen-recorder.tsx` — `ScreenRecorder`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/link-preview.tsx` — `LinkPreview`
  - `components/ui/media-preview-modal.tsx` — `MediaPreviewModal`
  - `components/ui/media-thumbnail.tsx` — `MediaThumbnail`
  - `lib/url-utils.ts` — `extractUrls`
  - `components/chat/MessageContent.tsx` — `MessageContent`
  - `components/chat/FormatToolbar.tsx` — `FormatToolbar`
  - `components/chat/VideoMessageRecorder.tsx` — `VideoMessageRecorder`
  - `components/chat/LocationShareButton.tsx` — `LocationShareButton`
  - `components/chat/ContactShareButton.tsx` — `ContactShareButton`
  - `components/chat/GifPicker.tsx` — `GifPicker`
  - `components/chat/SlashCommandMenu.tsx` — `SlashCommandMenu`
  - `components/chat/SlashCommandForm.tsx` — `SlashCommandForm`
  - `lib/hooks/useSlashCommands.ts` — `useSlashCommands`
  - `lib/hooks/useSlashCardSync.ts` — `useSlashCardSync`
  - `lib/hooks/useTypingIndicator.ts` — `useTypingIndicator`
  - `lib/chat-markers.ts` — `hasMarker`
  - `app/(dashboard)/layout.tsx` — `Member`
  - `components/chat/MessageActions.tsx` — `MessageActionMenu`, `MessageReactions`, `QuickReactionButton`, `SelectionToolbar`, `SelectionCheckOverlay`, `ForwardDialog`, `LongPressDiv`, `DeleteConfirmDialog`, … +1
  - `lib/messageExtras.ts` — `messageExtras`, `usePinnedIds`, `FORWARDED_PREFIX`, `isForwardedText`, `stripForwarded`, `canEditMessage`, `bumpEditCount`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Send`, `Image as ImageIcon`, `FileText`, `Download`, `Trash2`, `Edit3`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MiniChatWindow.tsx`

## Notes

- Large file (1846 lines) — read it by section; line numbers above point into it.
