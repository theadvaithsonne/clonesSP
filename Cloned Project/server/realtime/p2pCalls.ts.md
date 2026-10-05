# `server/realtime/p2pCalls.ts`

> Module exporting `registerP2PCall`, `peerOf`, `noteCallSocket`, `newCallId` and 2 more.

**Kind:** Socket.IO / realtime · **Lines:** 169

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `P2P_PROTOCOL` | const | `= 1` — Bump when the client/server P2P signalling contract changes. | 20 |
| `P2PCall` | interface |  | 22 |
| `p2pCalls` | const | `= new Map<string, P2PCall>()` | 39 |
| `registerP2PCall` | function | `registerP2PCall(call: Omit<P2PCall, "fellBack" \| "createdAt">): P2PCall` | 41 |
| `peerOf` | function | `peerOf(call: P2PCall, userId: string): string \| null` — The other participant, or null when `userId` isn't in the call. | 49 |
| `noteCallSocket` | function | `noteCallSocket(call: P2PCall, userId: string, socketId: string): void` — A participant's socket id changes whenever it reconnects (a network switch mid-call does exactly that). | 62 |
| `newCallId` | function | `newCallId(): string` | 67 |
| `IceServer` | interface |  | 85 |
| `getIceServers` | function | `async getIceServers(userId: string): Promise<IceServer[]>` | 154 |
| `hasTurnRelay` | function | `hasTurnRelay(): boolean` — True when a TURN relay is configured, so clients needn't fall back early. | 163 |

## Interfaces

- **External HTTP calls:**
  - `POST https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate` (L114)
- **Environment variables (`process.env`):** `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN`, `TURN_URLS`, `TURN_SECRET`, `TURN_USERNAME`, `TURN_CREDENTIAL`, `STUN_URLS`
- **Timers / queues:** `setTimeout` at L44
- **External hosts mentioned in the code:** `rtc.live.cloudflare.com`

## Dependencies

- **Internal:** none
- **Packages:**
  - `crypto`

## Used by

- `server/realtime/socket.ts`
