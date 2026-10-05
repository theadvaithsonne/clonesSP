# `components/garage-admin/SupportChatsConsole.tsx`

> Support Chats console — Admin → Others → Support Chats.

**Kind:** React component · **Lines:** 2001 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Support Chats console — Admin → Others → Support Chats.

Every member has exactly one support chat (a Group of kind "support"); every
active admin is a participant, and a reply here is sent as the admin's own
app user. See garagenew-backend routes/garageAdminSupportChats.ts and the
Support Chats admin API doc.

The console has no socket, so it polls — and only while the tab is visible:
the open conversation every ~5s (latest page, merged by _id) and the list +
counts every ~20s.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×7 (lucide-react), `Avatar`×6 (local), `X`×3 (lucide-react), `Paperclip`×3 (lucide-react), `ListChecks`×2 (lucide-react), `TicketPlus`×2 (lucide-react), `SupportTaskroomBar` (components/garage-admin/SupportTaskroomPicker.tsx), `Search` (lucide-react), `UserPlus` (lucide-react), `Languages` (lucide-react), `RefreshCw` (lucide-react), `ChevronUp` (lucide-react), `DaySeparator` (local), `MessageRow` (local), `Sparkles` (lucide-react), `Upload` (lucide-react), `AtSign` (lucide-react), `CornerUpLeft` (lucide-react), `FormatToolbar` (components/chat/FormatToolbar.tsx), `EmojiPickerComponent` (components/ui/emoji-picker.tsx), `GifPicker` (components/chat/GifPicker.tsx), `LocationShareButton` (components/chat/LocationShareButton.tsx), `ContactShareButton` (components/chat/ContactShareButton.tsx), `VoiceRecorder` (components/ui/voice-recorder.tsx), `VideoMessageRecorder` (components/chat/VideoMessageRecorder.tsx), `Send` (lucide-react), `SupportChatTaskroomPanel` (components/garage-admin/SupportChatTaskroomPanel.tsx), `MessageContent` (components/chat/MessageContent.tsx), `LinkPreview` (components/ui/link-preview.tsx), `VoiceMessagePlayer` (components/ui/voice-message-player.tsx), `CheckCheck` (lucide-react), `Check` (lucide-react), `Copy` (lucide-react), `Trash2` (lucide-react), `Smile` (lucide-react), `Pencil` (lucide-react)

**Hooks used:** `useState`×49, `useEffect`×9, `useRef`×7, `useCallback`×2, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SupportChatsConsole)` | component | `SupportChatsConsole()` | 146 |

## Interfaces

- **Timers / queues:** `setTimeout` at L214, L456; `setInterval` at L304, L493, L543

## Dependencies

- **Internal:**
  - `lib/admin-api/support-chats.ts` — `listSupportChats`, `getSupportChat`, `getSupportMessages`, `sendSupportReply`, `deleteSupportMessage`, `markSupportChatRead`, `getSupportTyping`, `reactToSupportMessage`, … +17
  - `lib/admin-api/users.ts` — `searchUsers`, `AdminUserSuggestion`
  - `components/garage-admin/SupportTaskroomPicker.tsx` — `SupportTaskroomBar`
  - `components/garage-admin/SupportChatTaskroomPanel.tsx` — `SupportChatTaskroomPanel`
  - `components/chat/MessageContent.tsx` — `MessageContent`
  - `components/ui/emoji-picker.tsx` — `EmojiPickerComponent`
  - `components/chat/FormatToolbar.tsx` — `FormatToolbar`
  - `components/chat/GifPicker.tsx` — `GifPicker`
  - `components/chat/LocationShareButton.tsx` — `LocationShareButton`
  - `components/chat/ContactShareButton.tsx` — `ContactShareButton`
  - `components/ui/voice-recorder.tsx` — `VoiceRecorder`
  - `components/ui/voice-message-player.tsx` — `VoiceMessagePlayer`
  - `components/chat/VideoMessageRecorder.tsx` — `VideoMessageRecorder`
  - `components/ui/link-preview.tsx` — `LinkPreview`
  - `lib/url-utils.ts` — `getFirstUrl`
  - `lib/auth.ts` — `getAdminToken`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Search`, `Send`, `Languages`, `Loader2`, `RefreshCw`, `ListChecks`, …
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/support-chats/page.tsx`

## Notes

- Large file (2001 lines) — read it by section; line numbers above point into it.
