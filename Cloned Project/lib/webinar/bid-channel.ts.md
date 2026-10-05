# `lib/webinar/bid-channel.ts`

> Auction fan-out for a webinar room — how "this lot changed" reaches everyone.

**Kind:** frontend library · **Lines:** 89

<!-- docgen:auto -->

## Purpose
Auction fan-out for a webinar room — how "this lot changed" reaches everyone.

Wire-identical to the store app's `nc:bid` topic (garage-store-app
lib/nc-bid-channel.ts) on purpose: a bid placed from the phone app moves the
price in this room, and vice versa.

The packet carries NO auction state. The Garage Store backend is the arbiter
— it orders bids atomically, applies anti-snipe in the same write, and settles
on a cron — so every number comes from REST and this channel only ever says
"lot X changed, go read it". Same REST-is-truth / channel-is-notify split the
chat and pin flows use.

Three transports carry that one sentence, because each covers the others'
blind spot:
  - LiveKit data channel — sub-100ms, but only reaches participants whose
    media transport is up at publish time […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NC_BID_TOPIC` | const | `= "nc:bid"` — LiveKit data-channel topic. | 28 |
| `AUCTION_PING_EVENT` | const | `= "webinar:auction-ping"` — Window event every transport funnels into — what useLiveLot listens on. | 31 |
| `AUCTION_PING_SOCKET_EVENT` | const | `= "webinar:auctionPing"` — Socket event, relayed by the room server to everyone but the sender. | 34 |
| `publishBidPing` | function | `async publishBidPing(room: Room \| null \| undefined, productId: string \| null): Promise<void>` — Announce over the LiveKit data channel. | 41 |
| `dispatchLocalPing` | function | `dispatchLocalPing(productId: string \| null): void` — Refetch now, on this client. | 61 |
| `announceLotChange` | function | `announceLotChange({ productId, room, socket, webinarId, }: { productId: strin…): void` — Tell the whole room a lot changed — after a bid, after a round opens, after a cancel. | 72 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `livekit-client` — `Room`
  - `socket.io-client` — `Socket`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/webinar/ControlBar.tsx`
- `hooks/useWebinarLiveKit.ts`
- `hooks/webinar/useLiveLot.ts`
