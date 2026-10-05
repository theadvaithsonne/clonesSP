# `components/dashboard/DMPage.tsx`

> React component `DMPage`.

**Kind:** React component · **Lines:** 2627 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar`×8 (components/ui/avatar.tsx), `AvatarFallback`×8 (components/ui/avatar.tsx), `Button`×8 (components/ui/button.tsx), `AvatarImage`×7 (components/ui/avatar.tsx), `FileText`×5 (lucide-react), `X`×5 (lucide-react), `ImageIcon`×3 (lucide-react), `DropdownMenu`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuItem`×3 (components/ui/dropdown-menu.tsx), `Pin`×3 (lucide-react), `MediaThumbnail`×3 (components/ui/media-thumbnail.tsx), `DeleteConfirmDialog`×2 (components/chat/MessageActions.tsx), `Loader2`×2 (lucide-react), `LinkPreview`×2 (components/ui/link-preview.tsx), `SelectionToolbar` (components/chat/MessageActions.tsx), `ForwardDialog` (components/chat/MessageActions.tsx), `ArrowLeft` (lucide-react), `MoreVertical` (lucide-react), `LongPressDiv` (components/chat/MessageActions.tsx), `SelectionCheckOverlay` (components/chat/MessageActions.tsx), `MessageActionMenu` (components/chat/MessageActions.tsx), `Forward` (lucide-react), `Paperclip` (lucide-react), `VoiceMessagePlayer` (components/ui/voice-message-player.tsx), `Download` (lucide-react), `CheckCheck` (lucide-react), `Check` (lucide-react), `MessageContent` (components/chat/MessageContent.tsx), `QuickReactionButton` (components/chat/MessageActions.tsx), `MessageReactions` (components/chat/MessageActions.tsx), `Edit3` (lucide-react), `FormatToolbar` (components/chat/FormatToolbar.tsx), `SlashCommandMenu` (components/chat/SlashCommandMenu.tsx), `EmojiPickerComponent` (components/ui/emoji-picker.tsx), `FileAttachment` (components/ui/file-attachment.tsx), `Send` (lucide-react), `VoiceRecorder` (components/ui/voice-recorder.tsx), `VideoMessageRecorder` (components/chat/VideoMessageRecorder.tsx), … +7 more

### Props

- **`DMPage`**: `id: string`, `onClose?: () => void`, `isMini?: boolean`, `onTypingLabelChange?: (label: string | null) => void`

**Hooks used:** `useState`×27, `useEffect`×21, `useRef`×9, `useMemo`, `useChat` (lib/chat-context.tsx), `useWebRTC` (lib/webrtc-context.tsx), `useTypingIndicator` (lib/hooks/useTypingIndicator.ts), `useSlashCommands` (lib/hooks/useSlashCommands.ts), `useSlashCardSync` (lib/hooks/useSlashCardSync.ts), `usePinnedIds` (lib/messageExtras.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DMPage)` | component | `DMPage({ id, onClose, isMini = false, onTypingLabelChange, }: { id…)` | 123 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/dm/${otherId}/messages?orgId=${orgId}` (L449)
  - `GET /backend/dm/${otherId}/messages?orgId=${orgId}&cursor=${nextCursor}` (L501)
  - `POST /backend/dm/${otherId}/read?orgId=${orgId}` (L527)
  - `DELETE /backend/user-notifications/dm/${otherId}?orgId=${orgId}` (L532)
  - `POST /backend/upload` (L797)
  - `PUT /backend/dm/message/${messageId}?orgId=${orgId}` (L1160)
  - `DELETE /backend/dm/message/${messageId}?orgId=${orgId}` (L1248)
  - `GET /backend/team/list?orgId=${orgId}` (L1476)
- **Next.js API routes called (same origin):**
  - `POST /api/openclaw/messages` (L933)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L266, L413, L478, L694, L878, …

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`, `getUserDataFromToken`, `getOrgId`
  - `lib/socket.ts` — `connectSocket`, `getSocket`
  - `lib/conv.ts` — `dmConvId`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/chat-context.tsx` — `useChat`
  - `lib/webrtc-context.tsx` — `useWebRTC`
  - `components/chat/MessageActions.tsx` — `MessageActionMenu`, `MessageReactions`, `QuickReactionButton`, `SelectionToolbar`, `SelectionCheckOverlay`, `ForwardDialog`, `LongPressDiv`, `DeleteConfirmDialog`, … +1
  - `lib/messageExtras.ts` — `messageExtras`, `usePinnedIds`, `FORWARDED_PREFIX`, `isForwardedText`, `stripForwarded`, `canEditMessage`, `bumpEditCount`
  - `app/(dashboard)/layout.tsx` — `Member`
  - `components/ui/emoji-picker.tsx` — `EmojiPickerComponent`
  - `components/ui/file-attachment.tsx` — `FileAttachment`, `FilePreview`
  - `components/ui/voice-recorder.tsx` — `VoiceRecorder`
  - `components/ui/voice-message-player.tsx` — `VoiceMessagePlayer`
  - `components/ui/screen-recorder.tsx` — `ScreenRecorder`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `lib/utils.ts` — `cn`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/link-preview.tsx` — `LinkPreview`
  - `components/ui/media-preview-modal.tsx` — `MediaPreviewModal`
  - `components/ui/media-thumbnail.tsx` — `MediaThumbnail`
  - `lib/url-utils.ts` — `getFirstUrl`, `extractUrls`
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
  - `lib/bell-refresh.ts` — `requestBellRefresh`
  - `lib/chat-markers.ts` — `hasMarker`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `next` — `useParams`
  - `lucide-react` — `MoreHorizontal`, `Phone`, `Send`, `Image as ImageIcon`, `FileText`, `Download`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MiniChatWindow.tsx`

## Notes

- Large file (2627 lines) — read it by section; line numbers above point into it.
