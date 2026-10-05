# `server/utils/sessionOverlay.ts`

> Merging one session's overrides over its parent Workshop.

**Kind:** backend utility · **Lines:** 348

<!-- docgen:auto -->

## Purpose
Merging one session's overrides over its parent Workshop.

Sessions of a recurring workshop are computed, not stored: utils/recurrence.ts
walks the recurrence rule and produces occurrences. A founder editing ONE of
them writes a WorkshopSessionOverride keyed by (workshopId, sessionDate), and
every read path then has to answer the same question — "what does this
session actually say?" This module is that answer, and the only place the
fallback rules live.

Three invariants hold the design together:

  1. NO OVERRIDE ⇒ THE SERIES, VERBATIM. Every resolver below returns exactly
     the parent Workshop's values when handed a null override, so a series
     created before per-session editing existed behaves identically. Override
     documents are upserted on demand; nothing is backfilled.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sessionDayKey` | function | `sessionDayKey(d: Date): Date` — UTC day-anchor for a Date (midnight UTC of the same day). | 42 |
| `WorkshopTemplate` | type | The subset of a Workshop the overlay reads. | 49 |
| `SessionOverlayFields` | type | The overridable half of a session override document. | 64 |
| `SessionOverlaySource` | type | What resolvers accept: a (possibly lean) override doc, or nothing. | 85 |
| `SESSION_EDITABLE_FIELDS` | const | `= [ "title", "description", "thumbnail", "rescheduledDate", "startTime", "endTime", "time…` — Every field a per-session edit may write. | 95 |
| `SessionEditableField` | type |  | 111 |
| `hasSessionEdits` | function | `hasSessionEdits(override: SessionOverlaySource): boolean` — Does this override actually differ from its series? | 115 |
| `SessionSchedule` | interface |  | 127 |
| `windowFromDayAndTimes` | function | `windowFromDayAndTimes(day: Date, startTime: string \| undefined, endTime: string \| undefined, timezone?: string): { startDateTime: Date; endDateTime: Date }` — Turn a calendar day + "HH:mm" wall-clock times + an IANA zone into the two UTC instants the session runs between. | 149 |
| `resolveSessionSchedule` | function | `resolveSessionSchedule(workshop: WorkshopTemplate, canonicalDate: Date, override: SessionOverlaySource, fallbackWindow?: { startDateTime: Date; endDateTime: Date }…): SessionSchedule` — When and for how long this specific session runs. | 185 |
| `SessionPricing` | interface |  | 234 |
| `resolveSessionPricing` | function | `resolveSessionPricing(workshop: Pick<WorkshopTemplate, "isFree" \| "price" \| "curr…, override: SessionOverlaySource): SessionPricing` — What this session costs. | 256 |
| `EffectiveSession` | interface |  | 287 |
| `resolveEffectiveSession` | function | `resolveEffectiveSession(workshop: WorkshopTemplate, canonicalDate: Date, override: SessionOverlaySource, fallbackWindow?: { startDateTime: Date; endDateTime: Date }…): EffectiveSession` — Everything one session says, after its overrides are applied. | 303 |
| `indexOverridesByDay` | function | `indexOverridesByDay(docs: T[]): Map<string, T>` — Index a workshop's override docs by their UTC day key, for row builders that load the whole set in one query and then walk the occurrences. | 338 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/workshop.model.ts` — `IWorkshop`
  - `server/models/workshopSessionOverride.model.ts` — `IWorkshopSessionOverride`
  - `server/utils/recurrence.ts` — `getTimezoneOffsetMinutes`
- **Packages:** none

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/workshop.ts`
- `server/routes/workshopCheckout.ts`
- `server/services/founderStreamTable.ts`
- `server/services/workshop.ts`
- `server/utils/workshopStatus.ts`
