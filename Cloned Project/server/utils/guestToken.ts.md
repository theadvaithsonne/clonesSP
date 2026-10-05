# `server/utils/guestToken.ts`

> Module exporting `generatePublicJoinCode`, `verifyPublicJoinCode`, `generateEventGuestToken`, `verifyEventGuestToken` and 2 more.

**Kind:** backend utility · **Lines:** 168

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generatePublicJoinCode` | function | `generatePublicJoinCode(): string` — Generate a unique public join code for an event (like Google Meet) Format: evt_{12-char-alphanumeric} | 9 |
| `verifyPublicJoinCode` | function | `async verifyPublicJoinCode(code: string): Promise<{ eventId: string; event: any; } \| null>` — Verify a public join code and get event details | 20 |
| `generateEventGuestToken` | function | `generateEventGuestToken(eventId: string, email: string): string` — Generate a unique guest token for event access | 71 |
| `verifyEventGuestToken` | function | `async verifyEventGuestToken(token: string): Promise<{ eventId: string; email: string; event: …` — Verify a guest token and check if it's valid for the event | 82 |
| `isGuestTokenValid` | function | `async isGuestTokenValid(token: string): Promise<boolean>` — Check if a guest token is still valid for joining | 143 |
| `markGuestAsJoined` | function | `async markGuestAsJoined(token: string): Promise<void>` — Mark a guest invitation as joined | 152 |

## Interfaces

- **Database (Mongoose models used):**
  - `Event` (server/models/event.model.ts) — reads: `findOne`; **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/models/event.model.ts` — `Event`
- **Packages:**
  - `crypto` — `randomUUID`, `randomBytes`

## Used by

- `server/routes/events.ts`
- `server/routes/publicEvents.ts`
