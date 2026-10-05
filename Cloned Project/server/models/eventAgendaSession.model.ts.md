# `server/models/eventAgendaSession.model.ts`

> Mongoose model for one slot on an Event Program's agenda: a talk or a break, placed on a track/stage column at a start and end time.

**Kind:** Mongoose model · **Lines:** 95

## Purpose
This is part of the Event Management module (founder-run conferences, stored as `EventProgram`). Each document is one row on the schedule grid. Multi-day events are handled by deriving the day from `startTime` rather than storing a day index, so an organiser can move a session to another day without re-keying anything else.

## How it works
Fields (`IEventAgendaSession`), stored in collection **`event_agenda_sessions`**:
- `eventId` (ref `EventProgram`, required, indexed).
- `title` (required, max 300) and `description` (max 3000).
- `stageName`: the track/stage column, default `"Main Stage"`. `room` is the physical room shown under the track name (max 120). `trackColor` is the dot colour; when unset the UI falls back to a palette slot.
- `sessionType`: `"session" | "break"` (indexed). A break (coffee, lunch, registration) belongs to no single track, so the grid renders it as one row spanning every column.
- `format`: `"in_person" | "virtual" | "hybrid"`, independent of the event's own format.
- Seating: `requiresRegistration` (attendees must claim a seat on top of their ticket), `seatsAvailable` (0 means uncapped) and `isLimitedSeats` (drives the LIMITED SEATS badge; written together with `requiresRegistration`, since a session that needs separate sign-up is capped by definition).
- Feature flags: `isRecorded`, `enableQa`, `enablePolls`, `isLivestreamed`.
- `startTime` and `endTime` (required), `speakerIds` (refs `EventSpeaker`), `sortOrder`.
- Timestamps are on.

Index: `{ eventId, startTime }` for loading an event's schedule in time order.

## Exports
- `IEventAgendaSession` - interface.
- `EventAgendaSession` - the model.

## Interfaces
- **Database:** `EventAgendaSession` (collection `event_agenda_sessions`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/eventManagement.ts` (mounted at `/event-management`): organiser CRUD at `GET`/`POST /backend/event-management/:id/agenda`, plus the matching `PUT` and `DELETE` routes.
- `server/routes/publicEventManagement.ts` (mounted at `/public/event-management`) - the public event page reads the agenda.

## Notes
- Nothing in the schema checks that `endTime` is after `startTime`. Validation, if any, happens in the routes.
