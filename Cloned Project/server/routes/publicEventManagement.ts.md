# `server/routes/publicEventManagement.ts`

> src/routes/publicEventManagement.ts

**Kind:** Express router · **Lines:** 1974 · **Mounted at:** `/public/event-management` (browser: `/backend/public/event-management`)

<!-- docgen:auto -->

## Purpose
src/routes/publicEventManagement.ts

Unauthenticated customer API behind the public event landing page.
Mounted at /public/event-management.

Rules that hold for every route here:
  - only `status: "published"`, non-deleted, non-private events resolve;
  - only tiers with `isVisible` and no `archivedAt` are ever returned;
  - the website blocks served are the PUBLISHED snapshot, never the draft.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (12)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/public/event-management` | — | inline | 155 |
| GET | `/resolve-domain` | `/backend/public/event-management/resolve-domain` | — | inline | 256 |
| GET | `/:slug` | `/backend/public/event-management/:slug` | — | inline | 298 |
| POST | `/:slug/quote` | `/backend/public/event-management/:slug/quote` | — | inline | 464 |
| POST | `/:slug/register` | `/backend/public/event-management/:slug/register` | `softAuth` | inline | 827 |
| POST | `/:slug/checkout` | `/backend/public/event-management/:slug/checkout` | `softAuth` | inline | 1079 |
| POST | `/tickets/lookup` | `/backend/public/event-management/tickets/lookup` | — | inline | 1536 |
| GET | `/ticket/:qrCodeToken` | `/backend/public/event-management/ticket/:qrCodeToken` | — | inline | 1651 |
| GET | `/ticket/:qrCodeToken/calendar.ics` | `/backend/public/event-management/ticket/:qrCodeToken/calendar.ics` | — | inline | 1694 |
| GET | `/me/tickets` | `/backend/public/event-management/me/tickets` | `requireAuth` | inline | 1793 |
| GET | `/me/orders/:invoiceId` | `/backend/public/event-management/me/orders/:invoiceId` | `requireAuth` | inline | 1883 |
| POST | `/orders/:invoiceId/cancel` | `/backend/public/event-management/orders/:invoiceId/cancel` | `requireAuth` | inline | 1942 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1973 |

## Interfaces

- **Database (Mongoose models used):**
  - `EventProgram` (server/models/eventProgram.model.ts) — reads: `findOne`, `find`, `countDocuments`, `findById`
  - `EventTicketTier` (server/models/eventTicketTier.model.ts) — reads: `aggregate`, `find`, `findById`, `findOne`
  - `EventWebsiteConfig` (server/models/eventWebsiteConfig.model.ts) — reads: `findOne`
  - `EventSpeaker` (server/models/eventSpeaker.model.ts) — reads: `find`
  - `EventAgendaSession` (server/models/eventAgendaSession.model.ts) — reads: `find`
  - `EventSponsor` (server/models/eventSponsor.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `EventRegistrationForm` (server/models/eventRegistrationForm.model.ts) — reads: `findOne`
  - `EventRegistration` (server/models/eventRegistration.model.ts) — reads: `aggregate`, `find`, `findOne`, `distinct`; **writes:** `updateOne`, `create`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/eventProgram.model.ts` — `EventProgram`
  - `server/models/eventTicketTier.model.ts` — `EventTicketTier`
  - `server/models/eventRegistration.model.ts` — `EventRegistration`, `IEventRegistration`
  - `server/models/eventSpeaker.model.ts` — `EventSpeaker`
  - `server/models/eventAgendaSession.model.ts` — `EventAgendaSession`
  - `server/models/eventSponsor.model.ts` — `EventSponsor`
  - `server/models/eventWebsiteConfig.model.ts` — `EventWebsiteConfig`
  - `server/models/eventRegistrationForm.model.ts` — `EventRegistrationForm`, `ATTENDEE_FIELD_MAP`, `defaultFormFields`, `IEventFormField`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/middleware/auth.ts` — `softAuth`, `requireAuth`
  - `server/services/eventManagement.ts` — `newQrCodeToken`, `claimTierSeats`, `releaseTierSeats`, `releaseExpiredHolds`, `SEAT_HOLD_MINUTES`, `tierSaleability`, `resolveEventCoupon`, `defaultWebsiteBlocks`, … +3
  - `server/services/invoice.ts` — `createInvoice`, `cancelInvoice`, `getInvoice`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/event-management`.

## Notes

- Large file (1974 lines) — read it by section; line numbers above point into it.
