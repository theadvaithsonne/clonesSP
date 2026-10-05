# `components/webinar/ControlBar.tsx`

> React component `ControlBar`.

**Kind:** React component · **Lines:** 1100 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Video`×3 (lucide-react), `MediaSplitButton`×2 (components/webinar/MediaSplitButton.tsx), `Mic`×2 (lucide-react), `MicOff`×2 (lucide-react), `VideoOff`×2 (lucide-react), `MicLevelMeter` (local), `SpeakerButton` (components/webinar/SpeakerButton.tsx), `ScreenShareOff` (lucide-react), `ScreenShare` (lucide-react), `Sparkles` (lucide-react), `StickyNote` (lucide-react), `VoiceMemoPanel` (components/voice-memos/VoiceMemoPanel.tsx), `PictureInPicture2` (lucide-react), `ShoppingBag` (lucide-react), `Hand` (lucide-react), `Smile` (lucide-react), `Square` (lucide-react), `Circle` (lucide-react), `PhoneOff` (lucide-react), `ProductPickerDialog` (components/webinar/ProductPickerDialog.tsx), `VirtualBackgroundPicker` (components/webinar/VirtualBackgroundPicker.tsx)

### Props

- **`ControlBar`**: `socket: Socket | null`, `webinarId: string`, `onToggleMic: () => void`, `onToggleCam: () => void`, `onShareScreen: () => Promise<void>`, `onStartMedia: () => Promise<void>`, `mediaStarted: boolean`, `connected?: boolean`, `roomReady?: boolean`, `recordingMode?: "manual" | "automatic"`, `getRoom?: () => Room | null`, `listMediaDevices?: () => Promise<{ videoinput: MediaDeviceInfo[]; aud…`, `setVideoDevice?: (deviceId: string) => Promise<void>`, `setAudioDevice?: (deviceId: string) => Promise<void>`, `setOutputDevice?: (deviceId: string) => Promise<void>`, `onOpenPip?: () => void | Promise<void>`, `isPipSupported?: boolean`, `alwaysVisible?: boolean`, `isGotobigwin?: boolean`

**Hooks used:** `useRef`×10, `useWebinarStore`×8 (store/webinarStore.ts), `useEffect`×7, `useState`×6, `useCallback`×5, `useRouter` (next/navigation), `useVirtualBackground` (hooks/webinar/useVirtualBackground.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ControlBar)` | component | `ControlBar({ socket, webinarId, onToggleMic, onToggleCam, onShareScree…)` | 236 |

## Interfaces

- **Socket.IO events:**
  - emits: `webinar:leaveRoom`, `webinar:endWebinar`, `webinar:raiseHand`, `webinar:sendReaction`, `webinar:pinProduct`, `webinar:startRecording`, `webinar:stopRecording`
- **Timers / queues:** `setTimeout` at L336, L589; `setInterval` at L375

## Dependencies

- **Internal:**
  - `store/webinarStore.ts` — `useWebinarStore (default)`
  - `components/webinar/ProductPickerDialog.tsx` — `ProductPickerDialog (default)`
  - `components/webinar/VirtualBackgroundPicker.tsx` — `VirtualBackgroundPicker (default)`
  - `components/webinar/MediaSplitButton.tsx` — `MediaSplitButton (default)`
  - `components/webinar/SpeakerButton.tsx` — `SpeakerButton (default)`
  - `components/voice-memos/VoiceMemoPanel.tsx` — `VoiceMemoPanel (default)`
  - `hooks/webinar/useVirtualBackground.ts` — `useVirtualBackground`
  - `lib/feed-api.ts` — `Sellable`, `(types only)`
  - `lib/api/auctions.ts` — `startAuctionRound`, `AuctionRoundConfig`
  - `lib/webinar/bid-channel.ts` — `announceLotChange`
  - `components/webinar/glass.ts` — `GLASS_BAR`, `GLASS_BTN_ACTIVE_BLUE`, `GLASS_BTN_ACTIVE_GREEN`, `GLASS_BTN_ACTIVE_RED`, `GLASS_BTN_ACTIVE_YELLOW`, `GLASS_BTN_BASE`, `GLASS_BTN_DANGER`, `GLASS_BTN_DISABLED`, … +5
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `next` — `useRouter`
  - `lucide-react` — `Mic`, `MicOff`, `Video`, `VideoOff`, `ScreenShare`, `ScreenShareOff`, …
  - `livekit-client` — `Room`
  - `sonner` — `toast`
  - `socket.io-client` — `Socket`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
