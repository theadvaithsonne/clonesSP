# `server/models/eventTicketTier.model.ts`

> Mongoose model for one purchasable tier of an Event Program (for example "Early bird" or "VIP pass"), or an add-on bought alongside a ticket, including its inventory counter.

**Kind:** Mongoose model · **Lines:** 79

## Purpose
This model defines what attendees can buy for an event. Admission tickets (`kind: "ticket"`) and add-ons (`kind: "addon"`, such as a workshop seat, a t-shirt or an airport transfer) share this collection because their inventory, sales-window, pricing and checkout rules are the same. Only where they appear in the UI differs. `soldCount` is the authoritative inventory counter.

## How it works
Fields (`IEventTicketTier`), stored in collection **`event_ticket_tiers`**:
- `eventId` (ref `EventProgram`, required, indexed).
- `kind`: `ticket | addon` (default `ticket`, indexed).
- `name` (required, max 120), `description` (max 500), and `perks[]` (bullet points on the public ticket card).
- `price` (required, at least 0, default 0) and `currency` (default `"USD"`, uppercased).
- `quantity` (required, at least 1) is total stock. `soldCount` (at least 0) is seats taken.
- `salesStart` and `salesEnd` define the sales window.
- `isVisible`. `isPaused` lets the founder freeze sales without hiding the tier: the card still renders but its buy button is disabled.
- `sortOrder`.
- `archivedAt` (default `null`): tiers are archived instead of deleted, because registrations reference sold tiers.
- Timestamps are on.

Index: `{ eventId, sortOrder }`.

Concurrency rule (from the file header): `soldCount` is only ever changed with `$inc` inside a conditional update, so two buyers cannot both take the last seat. The header points at `routes/publicEventManagement.ts`; `server/services/eventManagement.ts` also exports `claimTierSeats` and `releaseTierSeats` for this.

## Exports
- `IEventTicketTier` - interface.
- `EventTicketTier` - the model.

## Interfaces
- **Database:** `EventTicketTier` (collection `event_ticket_tiers`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/eventManagement.ts` (mounted at `/event-management`): `GET`/`POST /backend/event-management/:id/tickets`, plus `PUT` and `DELETE` routes and sales stats.
- `server/routes/publicEventManagement.ts` - quote, register and checkout claim seats.
- `server/services/eventManagement.ts` - seat claim and release, hold sweep, sales stats.
- `server/services/invoice.ts` - invoice line items.

## Notes
- Never write `soldCount` with a plain `$set` or read-modify-write. That would break the oversell protection.
