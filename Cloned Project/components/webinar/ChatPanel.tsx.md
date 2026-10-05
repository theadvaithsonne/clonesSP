# `components/webinar/ChatPanel.tsx`

> React component `ChatPanel`.

**Kind:** React component · **Lines:** 1100 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `LinkPreview`×2 (components/ui/link-preview.tsx), `X`×2 (lucide-react), `CornerUpLeft`×2 (lucide-react), `PinVideoCardRow` (local), `ChatRow` (local), `Plus` (lucide-react), `Smile` (lucide-react), `Sparkles` (lucide-react), `EmojiPickerComponent` (components/ui/emoji-picker.tsx), `GifPicker` (components/chat/GifPicker.tsx), `Avatar` (local), `GifBubble` (components/webinar/GifBubble.tsx), `SmilePlus` (lucide-react), `Reply` (lucide-react)

### Props

- **`ChatPanel`**: `socket: Socket | null`, `webinarId: string`

**Hooks used:** `useState`×13, `useMemo`×6, `useEffect`×5, `useRef`×4, `useWebinarStore`×3 (store/webinarStore.ts), `useAuthStore` (store/authStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ChatPanel)` | component | `ChatPanel({ socket, webinarId }: ChatPanelProps)` | 122 |

## Interfaces

- **Socket.IO events:**
  - emits: `webinar:sendMessage`, `webinar:reactToMessage`
- **Timers / queues:** `setTimeout` at L261

## Dependencies

- **Internal:**
  - `store/webinarStore.ts` — `useWebinarStore (default)`
  - `store/webinarStore.ts` — `ChatReplyTo`, `(types only)`
  - `store/authStore.tsx` — `useAuthStore`
  - `lib/linkify.tsx` — `linkifyText`
  - `components/ui/emoji-picker.tsx` — `EmojiPickerComponent`
  - `components/ui/link-preview.tsx` — `LinkPreview`
  - `components/chat/GifPicker.tsx` — `GifPicker`
  - `components/webinar/GifBubble.tsx` — `GifBubble`
  - `lib/chat-markers.ts` — `encodeGif`, `parseMarker`, `GifData`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `CornerUpLeft`, `Plus`, `Reply`, `Smile`, `SmilePlus`, `Sparkles`, …
  - `socket.io-client` — `Socket`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
