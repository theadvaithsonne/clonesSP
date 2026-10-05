# `components/dashboard/GroupChatPage.tsx`

> React component `GroupPage`.

**Kind:** React component · **Lines:** 3661 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×11 (components/ui/button.tsx), `FileText`×7 (lucide-react), `Avatar`×5 (components/ui/avatar.tsx), `AvatarImage`×5 (components/ui/avatar.tsx), `AvatarFallback`×5 (components/ui/avatar.tsx), `X`×5 (lucide-react), `Image`×3 (lucide-react), `Pin`×3 (lucide-react), `MediaThumbnail`×3 (components/ui/media-thumbnail.tsx), `DeleteConfirmDialog`×2 (components/chat/MessageActions.tsx), `ListChecks`×2 (lucide-react), `Loader2`×2 (lucide-react), `LinkPreview`×2 (components/ui/link-preview.tsx), `Check`×2 (lucide-react), `File` (lucide-react), `SelectionToolbar` (components/chat/MessageActions.tsx), `ForwardDialog` (components/chat/MessageActions.tsx), `ArrowLeft` (lucide-react), `MoreVertical` (lucide-react), `Shield` (lucide-react), `Settings` (lucide-react), `LongPressDiv` (components/chat/MessageActions.tsx), `SelectionCheckOverlay` (components/chat/MessageActions.tsx), `MessageActionMenu` (components/chat/MessageActions.tsx), `Forward` (lucide-react), `VoiceMessagePlayer` (components/ui/voice-message-player.tsx), `Download` (lucide-react), `CheckCheck` (lucide-react), `MessageContent` (components/chat/MessageContent.tsx), `QuickReactionButton` (components/chat/MessageActions.tsx), `Copy` (lucide-react), `MessageSquareText` (lucide-react), `MessageReactions` (components/chat/MessageActions.tsx), `Edit3` (lucide-react), `Megaphone` (lucide-react), `FormatToolbar` (components/chat/FormatToolbar.tsx), `SlashCommandMenu` (components/chat/SlashCommandMenu.tsx), `EmojiPickerComponent` (components/ui/emoji-picker.tsx), `Paperclip` (lucide-react), `FileAttachment` (components/ui/file-attachment.tsx), … +19 more

### Props

- **`GroupPage`**: `id: string`, `onClose?: () => void`, `isMini?: boolean`, `onTypingLabelChange?: (label: string | null) => void`

**Hooks used:** `useState`×42, `useEffect`×19, `useRef`×12, `useMemo`×5, `useChat` (lib/chat-context.tsx), `useTypingIndicator` (lib/hooks/useTypingIndicator.ts), `useSlashCommands` (lib/hooks/useSlashCommands.ts), `useSlashCardSync` (lib/hooks/useSlashCardSync.ts), `usePinnedIds` (lib/messageExtras.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GroupPage)` | component | `GroupPage({ id, onClose, isMini = false, onTypingLabelChange, }: { id…)` | 176 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/groups/${groupId}` (L478)
  - `GET /backend/groups/${groupId}/messages?orgId=${orgId}` (L556)
  - `GET /backend/groups/${groupId}/messages?orgId=${orgId}&cursor=${nextCursor}` (L611)
  - `POST /backend/groups/${groupId}/read?orgId=${orgId}` (L637)
  - `DELETE /backend/user-notifications/group/${groupId}?orgId=${orgId}` (L646)
  - `POST /backend/upload` (L980)
  - `PUT /backend/groups/${groupId}/message/${messageId}?orgId=${orgId}` (L1311)
  - `DELETE /backend/groups/${groupId}/message/${messageId}?orgId=${orgId}` (L1338)
  - `DELETE /backend/groups/${groupId}/message/${messageId}/taskroom` (L1427)
  - `GET /backend/groups?orgId=${orgId}` (L1981)
  - `PUT /backend/groups/${groupId}/taskroom/tasks/${task.taskId}/assign` (L3552)
- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${base}short/urls` (L1489)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L313, L588, L818, L1048, L1146, …
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getOrgId`, `getToken`, `getUserIdFromToken`
  - `lib/socket.ts` — `connectSocket`, `getSocket`
  - `lib/conv.ts` — `groupConvId`
  - `lib/chat-context.tsx` — `useChat`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `lib/utils.ts` — `cn`
  - `components/chat/MessageActions.tsx` — `MessageActionMenu`, `MessageReactions`, `QuickReactionButton`, `SelectionToolbar`, `SelectionCheckOverlay`, `ForwardDialog`, `LongPressDiv`, `DeleteConfirmDialog`, … +1
  - `lib/messageExtras.ts` — `messageExtras`, `usePinnedIds`, `FORWARDED_PREFIX`, `isForwardedText`, `stripForwarded`, `canEditMessage`, `bumpEditCount`
  - `app/(dashboard)/layout.tsx` — `Group`
  - `components/ui/emoji-picker.tsx` — `EmojiPickerComponent`
  - `components/ui/file-attachment.tsx` — `FileAttachment`, `FilePreview`
  - `components/ui/voice-recorder.tsx` — `VoiceRecorder`
  - `components/ui/voice-message-player.tsx` — `VoiceMessagePlayer`
  - `components/ui/screen-recorder.tsx` — `ScreenRecorder`
  - `components/dashboard/EditGroupDialog.tsx` — `EditGroupDialog (default)`
  - `components/chat/ThreadPanel.tsx` — `ThreadPanel (default)`
  - `components/chat/GroupAdminPanel.tsx` — `GroupAdminPanel (default)`, `GroupData as AdminGroupData`, `GroupTaskroom`
  - `components/chat/GroupTasksPanel.tsx` — `GroupTasksPanel (default)`
  - `components/chat/TaskroomLinkPicker.tsx` — `openTaskroomBoard`, `TaskroomBoardRef`
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
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`, `CSSProperties`
  - `next` — `useParams`
  - `sonner` — `toast`
  - `lucide-react` — `MoreHorizontal`, `Send`, `Reply`, `Edit3`, `Trash2`, `Download`, …

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MiniChatWindow.tsx`

## Notes

- Large file (3661 lines) — read it by section; line numbers above point into it.
