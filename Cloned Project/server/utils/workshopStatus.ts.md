# `server/utils/workshopStatus.ts`

> Module exporting `isSessionDeleted`, `isWorkshopDeleted`, `deriveSessionStatus`, `deriveClockStatus` and 6 more.

**Kind:** backend utility · **Lines:** 414

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sessionDayKey` | export |  | 17 |
| `SessionStatus` | type |  | 19 |
| `WorkshopStatus` | type |  | 24 |
| `isSessionDeleted` | function | `isSessionDeleted(o?: OverrideLite \| null): boolean` — A session is "in Trash" when deletedAt is set and either no restoredAt exists or restoredAt is older than deletedAt (i.e. | 41 |
| `isWorkshopDeleted` | function | `isWorkshopDeleted(w: WorkshopLite): boolean` | 47 |
| `deriveSessionStatus` | function | `deriveSessionStatus(session: SessionWindow, override?: OverrideLite \| null, now: Date = new Date()): SessionStatus` — Pure derivation — no I/O, no globals besides `now`. | 68 |
| `deriveClockStatus` | function | `deriveClockStatus(session: SessionWindow, override?: OverrideLite \| null, now: Date = new Date()): Exclude<SessionStatus, "deleted">` — Ignores the trash flag — always returns yet-to-happen / live / completed based on the clock and manual events. | 98 |
| `deriveWorkshopStatus` | function | `deriveWorkshopStatus(workshop: WorkshopLite, enrichedSessions: Array<{ status: SessionStatus }>, _now: Date = new Date()): WorkshopStatus` | 132 |
| `EnrichedSession` | interface |  | 144 |
| `computeSessionWindow` | function | `computeSessionWindow(workshop: Pick< IWorkshop, \| "isRecurring" \| "recurrencePat…, targetDate: Date, override?: SessionOverlayFields \| null): { startDateTime: Date; endDateTime: Date } \| nu…` — Compute [startDateTime, endDateTime] for a single session, given its calendar date (UTC midnight). | 166 |
| `sameSessionDay` | function | `sameSessionDay(a: Date, b: Date): boolean` — Anchor two dates on the same UTC calendar day (ignores hours/mins). | 224 |
| `resolveLiveSessionKey` | function | `async resolveLiveSessionKey(workshop: { date?: Date; isRecurring?: boolean; currentSess…, now: Date = new Date()): Promise<Date>` — Which session is this live-room event about? | 252 |
| `findSessionOverride` | function | `async findSessionOverride(workshopId: Types.ObjectId \| string, sessionDate: Date): Promise<IWorkshopSessionOverride \| null>` — Look up an override by (workshopId, sessionDate). | 309 |
| `enrichSessionsWithStatus` | function | `async enrichSessionsWithStatus(workshop: Pick< IWorkshop, \| "_id" \| "isRecurring" \| "recur…, opts: { fromDate?: Date; limit?: number; includePast?: bool…): Promise<EnrichedSession[]>` — Enrich a set of computed sessions with their override + derived status. | 324 |

## Interfaces

- **Database (Mongoose models used):**
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `findOne`, `find`

## Dependencies

- **Internal:**
  - `server/models/workshop.model.ts` — `IWorkshop`
  - `server/models/workshopSessionOverride.model.ts` — `IWorkshopSessionOverride`, `WorkshopSessionOverride`
  - `server/utils/recurrence.ts` — `calculateSessions`, `WorkshopSession`
  - `server/utils/sessionOverlay.ts` — `resolveSessionSchedule`, `sessionDayKey`, `SessionOverlayFields`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/routes/livekitRecording.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/webinarRoutes.ts`
- `server/routes/workshop.ts`
- `server/routes/workshopCheckout.ts`
- `server/services/downlineMemberLiveStreams.ts`
- `server/services/founderStreamTable.ts`
- `server/services/sellables.ts`
- `server/services/webinarHost.ts`
- `server/services/workshop.ts`
