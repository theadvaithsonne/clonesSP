# `server/models/eventSponsor.model.ts`

> Mongoose model for a sponsor on an Event Program's sponsor wall, with tier, logo and booth number.

**Kind:** Mongoose model · **Lines:** 55

## Purpose
Organisers list sponsors for their event. The public event website renders them in the Sponsors block, grouped highest tier first.

## How it works
- `EventSponsorTier` is `platinum | gold | silver | community`.
- `SPONSOR_TIER_RANK` maps each tier to its render rank (platinum 0, gold 1, silver 2, community 3), so callers can sort the sponsor wall.
- Fields (`IEventSponsor`), stored in collection **`event_sponsors`**:
  - `eventId` (ref `EventProgram`, required, indexed).
  - `name` (required, max 200) and `tier` (default `community`).
  - `logoUrl`, `boothNumber` (max 40), `websiteUrl`.
  - `sortOrder` (default 0), plus timestamps.
- Index: `{ eventId, tier, sortOrder }`.

## Exports
- `EventSponsorTier` - union type.
- `SPONSOR_TIER_RANK` - tier to sort rank.
- `IEventSponsor` - interface.
- `EventSponsor` - the model.

## Interfaces
- **Database:** `EventSponsor` (collection `event_sponsors`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/eventManagement.ts` (mounted at `/event-management`): `GET`/`POST /backend/event-management/:id/sponsors`, plus the matching `PUT` and `DELETE` routes.
- `server/routes/publicEventManagement.ts` (mounted at `/public/event-management`) - the public page reads sponsors.

## Notes
- The index sorts `tier` as a string, which is alphabetical and does not match the rank order. Code that needs rank order must sort with `SPONSOR_TIER_RANK`.
