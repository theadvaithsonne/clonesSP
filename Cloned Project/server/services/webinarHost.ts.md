# `server/services/webinarHost.ts`

> Module exporting `isStreamStaff`, `resolveSessionAnchor`, `claimSessionHost`, `getSessionHost` and 1 more.

**Kind:** backend service · **Lines:** 213

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkshopLike` | interface | Shape we need off a Workshop — accepts hydrated docs and `.lean()` results. | 27 |
| `isStreamStaff` | function | `async isStreamStaff(workshop: { createdBy?: unknown; orgId?: unknown } \| null \|…, userId: string \| null \| undefined): Promise<boolean>` — Is this user staff on this stream — its creator, or someone the founder delegated `live_streams` to? | 45 |
| `resolveSessionAnchor` | function | `resolveSessionAnchor(workshop: WorkshopLike): Date` — Which session is in flight, as a normalised day key. | 68 |
| `HostClaim` | interface |  | 94 |
| `claimSessionHost` | function | `async claimSessionHost(workshop: WorkshopLike, userId: string): Promise<HostClaim>` — Take the host seat for the current session, or report who already has it. | 113 |
| `getSessionHost` | function | `async getSessionHost(workshop: WorkshopLike): Promise<string \| null>` — Who holds the seat right now, without taking it. | 185 |
| `releaseSessionHost` | function | `async releaseSessionHost(workshop: WorkshopLike): Promise<void>` — Free the seat. Called when the session ends, so the next start is open to whoever gets there first. | 204 |

## Interfaces

- **Database (Mongoose models used):**
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `findOne`; **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/utils/workshopStatus.ts` — `sessionDayKey`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/realtime/webinarEnd.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/webinarRoutes.ts`
- `server/routes/workshop.ts`
