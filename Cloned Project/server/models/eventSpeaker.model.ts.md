# `server/models/eventSpeaker.model.ts`

> Mongoose model for a speaker profile attached to an Event Program.

**Kind:** Mongoose model · **Lines:** 55

## Purpose
Organisers in the Event Management module add speakers to an event. Speakers appear in the Speakers block of the public event website, and agenda sessions refer to them through `EventAgendaSession.speakerIds`.

## How it works
Fields (`IEventSpeaker`), stored in collection **`event_speakers`**:
- `eventId` (ref `EventProgram`, required, indexed).
- `name` (required, max 200), `role` and `company` (max 200 each), `bio` (max 2000), `avatarUrl`.
- `socials`: an embedded object with `twitter`, `linkedin`, `website` and `instagram` strings.
- `isKeynote` (default false), used to highlight keynote speakers.
- `sortOrder` (default 0) for manual ordering.
- Timestamps are on.

Index: `{ eventId, sortOrder }` returns an event's speakers in display order.

## Exports
- `IEventSpeaker` - interface.
- `EventSpeaker` - the model.

## Interfaces
- **Database:** `EventSpeaker` (collection `event_speakers`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/eventManagement.ts` (mounted at `/event-management`): `GET`/`POST /backend/event-management/:id/speakers`, plus the matching `PUT` and `DELETE` routes.
- `server/routes/publicEventManagement.ts` (mounted at `/public/event-management`) - the public event page reads speakers.

## Notes
- Deleting a speaker does not remove its id from agenda sessions' `speakerIds` at the schema level. Any cleanup is the route's job.
