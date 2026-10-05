# `server/realtime/webinarPresence.ts`

> Room membership that survives a socket.

**Kind:** Socket.IO / realtime · **Lines:** 219

<!-- docgen:auto -->

## Purpose
Room membership that survives a socket.

A webinar peer used to BE a socket: the disconnect handler deleted the peer
the instant the transport closed and broadcast `peerLeft`, and when the map
emptied the room was torn down and the Meet marked ended. Every mobile
network blip, every iOS suspension, every deploy therefore looked like a
deliberate exit — a solo host locking their phone ended the stream for the
whole office, a reconnecting co-host came back an attendee, a pinned product
vanished from every late joiner's ack.

This module holds the one rule that fixes that: a dropped socket puts its
peer into a GRACE window instead of deleting it. Inside the window the peer
is still in the room (nobody is told anything), and a re-join by the same
user takes the old record over — role, hand state and grants intact — with a
`reason: "reconnected"` leave for the dead socket so clients can migrate the
row instead of flashing "left". Only when the window expires is the peer […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DEFAULT_PEER_GRACE_MS` | const | `= 45_000` — Room membership that survives a socket. | 25 |
| `LeaveReason` | type | Why a socket is being announced as gone from the roster. | 28 |
| `PresencePeer` | interface |  | 42 |
| `PresenceRoom` | interface |  | 52 |
| `PresenceHooks` | interface |  | 56 |
| `isConnected` | function | `isConnected(peer: PresencePeer): boolean` | 66 |
| `connectedPeers` | function | `connectedPeers(room: PresenceRoom<P>): Array<[string, P]>` — Peers whose socket is live right now. | 71 |
| `markDisconnected` | function | `markDisconnected(room: PresenceRoom<P>, socketId: string, hooks: PresenceHooks<P>): boolean` — The socket behind `socketId` closed. | 95 |
| `expirePeer` | function | `expirePeer(room: PresenceRoom<P>, socketId: string, hooks: PresenceHooks<P>): boolean` — The grace window closed without a re-join: the peer is gone for real. | 117 |
| `removePeer` | function | `removePeer(room: PresenceRoom<P>, socketId: string, hooks: PresenceHooks<P>, reason: Exclude<LeaveReason, "timeout">): P \| undefined` — Remove a peer now — a deliberate leave or a host's kick. | 135 |
| `DeviceRef` | interface | What a joining client says about the device it is on. | 151 |
| `isSameDevice` | function | `isSameDevice(me: DeviceRef, seat: PresencePeer): boolean` — Is `seat` the same physical device as the joiner `me`? | 165 |
| `seatsOfUser` | function | `seatsOfUser(room: PresenceRoom<P>, userId: string, exceptSocketId?: string): Array<[string, P]>` — Every seat this user holds, connected or in grace, other than `exceptSocketId`. | 171 |
| `pickActiveSeat` | function | `pickActiveSeat(seats: Array<[string, P]>): [string, P] \| undefined` — Of several seats, the one to treat as "where they are": a connected seat before one in grace, then the freshest drop. | 186 |
| `takeSeat` | function | `takeSeat(room: PresenceRoom<P>, socketId: string): P \| undefined` — Pull a seat out of the map, silencing its grace clock, and hand it back so a join can carry its state over onto a new socket. | 203 |
| `clearGraceTimers` | function | `clearGraceTimers(room: PresenceRoom): void` — Drop every pending grace clock — the room is being torn down. | 216 |

## Interfaces

- **Timers / queues:** `setTimeout` at L105

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/realtime/mediasoupHandlers.ts`
