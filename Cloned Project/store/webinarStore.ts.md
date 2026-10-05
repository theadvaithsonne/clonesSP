# `store/webinarStore.ts`

> Module exporting `detectLocalDeviceType`.

**Kind:** client state store · **Lines:** 822 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WebinarRole` | type |  | 7 |
| `PeerStreams` | interface |  | 9 |
| `detectLocalDeviceType` | function | `detectLocalDeviceType(): "web" \| "mobile"` — What kind of client this browser is, for the join payload and the local user's own row in the participants list. | 21 |
| `WebinarPeer` | interface |  | 28 |
| `ChatReplyTo` | interface | Snapshot of the message being replied to. | 77 |
| `ChatMessage` | interface |  | 84 |
| `QAQuestion` | interface |  | 104 |
| `Poll` | interface |  | 116 |
| `Reaction` | interface | One in-flight floating reaction. | 129 |
| `PinnedItemType` | type |  | 146 |
| `PinnedProduct` | interface |  | 156 |
| `SimulatedPerson` | interface | One fabricated attendee. | 197 |
| `WebinarState` | interface |  | 201 |
| `default (useWebinarStore)` | default |  | 821 |

## Interfaces

- **Timers / queues:** `setTimeout` at L749

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/webinar/ChatPanel.tsx`
- `components/webinar/ControlBar.tsx`
- `components/webinar/ParticipantsList.tsx`
- `components/webinar/PinnedProductCard.tsx`
- `components/webinar/PollPanel.tsx`
- `components/webinar/QAPanel.tsx`
- `components/webinar/RecordingBanner.tsx`
- `components/webinar/SpeakerButton.tsx`
- `components/webinar/StoreCheckoutDialog.tsx`
- `components/webinar/VideoGrid.tsx`
- `components/webinar/WebinarPipContent.tsx`
- `components/webinar/useSimulatedAudience.ts`
- `hooks/useMediasoup.ts`
- `hooks/useWebinarLiveKit.ts`
- `hooks/useWebinarSocket.ts`
- `hooks/webinar/useVirtualBackground.ts`
