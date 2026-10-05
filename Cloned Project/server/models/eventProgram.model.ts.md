# `server/models/eventProgram.model.ts`

> Mongoose model for an "Event Program": a founder-run conference, meetup or summit with dates, a venue or stream, a capacity, ticket tiers and a public landing page.

**Kind:** Mongoose model · **Lines:** 194

## Purpose
This is the root document of the Event Management module. Ticket tiers, registrations, the registration form, speakers, sponsors, agenda sessions and the website-builder config all point at it through `eventId`. It is deliberately **not** the legacy `Event` model (`event.model.ts`), which backs the internal calendar. The collection is pinned to `event_programs` so the two can never share a namespace, even if a refactor renames the exported symbol.

## How it works
Exported types: `EventFormat` (`in_person | hybrid | virtual`), `EventStreamType` (`garage_livestream | money_stream | external_link`) and `EventStatus` (`draft | published | ongoing | completed | cancelled`).

Embedded sub-schemas (both `_id: false`, both defaulting to `{}`):
- `VenueSchema` / `IEventVenue`: name, addressLine1, city, state, postcode, country, and `coordinates { lat, lng }`.
- `StreamingSchema` / `IEventStreaming`: `streamType`, `livekitRoomId` and `externalUrl`.

Main fields (`IEventProgram`):
- `orgId` (ref `Organization`) and `creatorId` (ref `User`), both required and indexed.
- `name` (required, max 200). `slug` is required, **unique platform-wide**, lowercased and indexed, because it is the public URL key (`/e/:slug`). It is generated from the name at creation and de-duplicated with a numeric suffix.
- `shortDescription` (max 140) and `description` (max 10,000; long-form About copy edited later in the Web Builder, not in the wizard).
- `startsAt` and `endsAt` (required), `timezone`, `isRepeating`, `repeatRule`, `category`, `language` (default `"English"`), `bannerUrl`, `format`, `venue`, `streaming`.
- `totalCapacity` (required, at least 1), `requireApproval`, `isPrivate`.
- Money: `payoutWalletId` (ref `StoreWallet`), `addGstForIndianBuyers` (decides **whether** the 18% GST applies), and `gstInclusive` (decides **who absorbs it**: inclusive means the organiser pays the tax out of the listed price; exclusive adds it on top at checkout).
- `status` (default `draft`, indexed), `publishedAt`.
- `founderAlerts`: the organiser-side "someone registered" alert, built from `founderAlertsSchemaField`. It fires on both free registration and paid checkout.
- `deletedAt` (default `null`): soft delete. A public slug that returns 404 is preferable to a hard delete that would orphan registrations and their invoices.
- Timestamps are on.

Indexes: `{ orgId, status, startsAt: -1 }` and `{ orgId, deletedAt }`.

## Exports
- `EventFormat`, `EventStreamType`, `EventStatus` - union types.
- `IEventVenue`, `IEventStreaming`, `IEventProgram` - interfaces.
- `EventProgram` - the model (collection `event_programs`).

## Interfaces
- **Database:** `EventProgram` (collection `event_programs`).

## Dependencies
- **Internal:** `server/models/founderAlerts.schema.ts` - `founderAlertsSchemaField` and `IFounderAlerts`.
- **Packages:** `mongoose`.

## Used by
- `server/routes/eventManagement.ts` (mounted at `/event-management`) - organiser create, list, update, publish, unpublish and delete.
- `server/routes/publicEventManagement.ts` (mounted at `/public/event-management`) - public listing, slug page, quote, register and checkout.
- `server/services/eventManagement.ts`, `server/services/coupon.ts`, `server/services/founderAlertEmail.ts`, `server/services/invoice.ts`.

## Notes
- Queries must filter `deletedAt: null` themselves. The schema adds no automatic soft-delete filtering.
