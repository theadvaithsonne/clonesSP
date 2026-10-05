# `server/models/workshopSessionOverride.model.ts`

> Mongoose model holding the events (trash, restore, manual start/end), live-room state and per-session edits for one session of a workshop, keyed by `(workshopId, sessionDate)`.

**Kind:** Mongoose model · **Lines:** 180

## Purpose
Sessions of a recurring workshop are never stored: they are computed on the fly from `Workshop.recurrencePattern` (via `utils/recurrence.ts`). A `WorkshopSessionOverride` document exists only once a founder (or a delegated `live_streams` admin) has acted on a specific session - trashed, restored, started, ended or edited it - or once the live room needed to persist state for it. An absent document means "no events, no edits: follow the Workshop template and the clock". It is upserted on demand and never backfilled, which is why series created before per-session editing existed keep working unchanged.

## How it works
### Session identity
`sessionDate` is the canonical slot id: UTC midnight of the day the recurrence rule produced. Registrations, orders, access checks and webinar room routing all key off it, so it is never rewritten. Moving a session to another day sets `rescheduledDate` (display/delivery only) and leaves `sessionDate` alone. A unique index on `{ workshopId: 1, sessionDate: 1 }` guarantees one override per slot.

### Events
`deletedAt` (indexed) / `restoredAt` / `manualStartedAt` / `manualEndedAt`. `utils/workshopStatus.ts` turns these plus the current time into the four session states (yet-to-happen, live, completed, deleted); `restoredAt > deletedAt` means restored. `meta` records who did each: `deletedBy`, `restoredBy`, `startedBy`, `endedBy`, `updatedBy` (all refs to `User`). `meta.startedBy` is an audit stamp that is overwritten freely.

### Live-room fields
- `hostUserId` - the single host seat for the session, first claimer wins. Because both the creator and anyone delegated `live_streams` may ask to host, exactly one gets the seat and later arrivals (founder included) join as attendees. Cleared when the session ends.
- `garageTvViewerIds` - unique LiveKit `audience-*` identities who watched from a Garage TV reel or preview card, appended by the LiveKit `participant_joined` webhook; its length is the viewer count. No default, so absent until the first viewer.
- `liveState` (Mixed) - room state that must survive a process restart (in-session promotions, pinned item, removed users). Its shape is owned by `services/webinarLiveState.ts`, not by this schema.

### Per-session customisation
Each of these overrides the parent Workshop's value; unset means inherit. They have **no defaults** on purpose, so the overlay can tell "not overridden" from "overridden to empty/zero/false". Read them through `utils/sessionOverlay.ts`, which owns the fallback rules.
- `title` (max 200), `description`, `thumbnail`
- `rescheduledDate`, `startTime` / `endTime` (`HH:mm`, validated by regex, interpreted in `timezone`), `timezone`
- `isFree`, `price` (min 0) - honoured by order creation and payment verification in `per_session` enrolment mode
- `speakerName`, `speakerBio`, `speakerAvatar` - the displayed speaker identity, independent of who holds `hostUserId`
- `agenda` - array of `{ title, duration, topics[] }` (no `_id`)
- `isEdited` - cached "this session differs from the series" flag, kept in sync on every write (derivable via `hasSessionEdits` in `utils/sessionOverlay.ts`) so list queries can flag edited sessions cheaply. `routes/workshop.ts` maintains it.

`timestamps: true` adds `createdAt` / `updatedAt`.

## Exports
- `WorkshopSessionOverride` - the Mongoose model.
- `IWorkshopSessionOverride` - document interface.

## Interfaces
- **Database:** `WorkshopSessionOverride` (collection `workshopsessionoverrides`) - defines the schema; references `Workshop` and `User`.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
`server/realtime/mediasoupHandlers.ts`, `server/realtime/webinarEnd.ts`, `server/routes/livekitRecording.ts`, `server/routes/publicWebinar.ts`, `server/routes/webinarRoutes.ts`, `server/routes/workshop.ts`, `server/routes/workshopCheckout.ts`, `server/services/downlineMemberLiveStreams.ts`, `server/services/founderStreamTable.ts`, `server/services/sellables.ts`, `server/services/webinarHost.ts`, `server/services/webinarLiveState.ts`, `server/services/workshop.ts`, `server/utils/sessionOverlay.ts`, `server/utils/workshopStatus.ts`.

## Notes
- Never change `sessionDate` on an existing document: money and access records point at it. Use `rescheduledDate` to move a session.
- Adding a default to any customisation field would silently make every existing override "edited" from the overlay's point of view.
