# `server/routes/eventManagement.ts`

> src/routes/eventManagement.ts

**Kind:** Express router · **Lines:** 2266 · **Mounted at:** `/event-management` (browser: `/backend/event-management`)

<!-- docgen:auto -->

## Purpose
src/routes/eventManagement.ts

Founder / organizer API for the Event Management module.

Mounted at /event-management. This is deliberately NOT /events — that prefix
belongs to the legacy internal Agora calendar (routes/events.ts) and nothing
here should be reachable from it.

Every route resolves the event first and checks org membership through
`canManageEvents`, so an org id in the query string can never be used to
read another org's event.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (44)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/event-management` | `requireAuth` | inline | 183 |
| GET | `/` | `/backend/event-management` | `requireAuth` | inline | 292 |
| GET | `/:id` | `/backend/event-management/:id` | `requireAuth` | inline | 382 |
| PATCH | `/:id` | `/backend/event-management/:id` | `requireAuth` | inline | 416 |
| POST | `/:id/publish` | `/backend/event-management/:id/publish` | `requireAuth` | inline | 494 |
| POST | `/:id/unpublish` | `/backend/event-management/:id/unpublish` | `requireAuth` | inline | 519 |
| DELETE | `/:id` | `/backend/event-management/:id` | `requireAuth` | inline | 533 |
| POST | `/:id/banner` | `/backend/event-management/:id/banner` | `requireAuth`, `upload.single("file")` | inline | 555 |
| POST | `/:id/image` | `/backend/event-management/:id/image` | `requireAuth`, `upload.single("file")` | inline | 592 |
| POST | `/:id/banner/presign` | `/backend/event-management/:id/banner/presign` | `requireAuth` | inline | 623 |
| GET | `/:id/tickets` | `/backend/event-management/:id/tickets` | `requireAuth` | inline | 662 |
| POST | `/:id/tickets` | `/backend/event-management/:id/tickets` | `requireAuth` | inline | 711 |
| PUT | `/:id/tickets/reorder` | `/backend/event-management/:id/tickets/reorder` | `requireAuth` | inline | 751 |
| PUT | `/:id/tickets/:ticketId` | `/backend/event-management/:id/tickets/:ticketId` | `requireAuth` | inline | 789 |
| DELETE | `/:id/tickets/:ticketId` | `/backend/event-management/:id/tickets/:ticketId` | `requireAuth` | inline | 854 |
| GET | `/:id/registrations` | `/backend/event-management/:id/registrations` | `requireAuth` | inline | 897 |
| POST | `/:id/registrations/:regId/approve` | `/backend/event-management/:id/registrations/:regId/approve` | `requireAuth` | inline | 1050 |
| POST | `/:id/registrations/:regId/reject` | `/backend/event-management/:id/registrations/:regId/reject` | `requireAuth` | inline | 1063 |
| POST | `/:id/registrations/:regId/check-in` | `/backend/event-management/:id/registrations/:regId/check-in` | `requireAuth` | inline | 1077 |
| GET | `/:id/registrations/export` | `/backend/event-management/:id/registrations/export` | `requireAuth` | inline | 1106 |
| GET | `/:id/speakers` | `/backend/event-management/:id/speakers` | `requireAuth` | inline | 1226 |
| POST | `/:id/speakers` | `/backend/event-management/:id/speakers` | `requireAuth` | inline | 1240 |
| PUT | `/:id/speakers/:speakerId` | `/backend/event-management/:id/speakers/:speakerId` | `requireAuth` | inline | 1260 |
| DELETE | `/:id/speakers/:speakerId` | `/backend/event-management/:id/speakers/:speakerId` | `requireAuth` | inline | 1287 |
| GET | `/:id/agenda` | `/backend/event-management/:id/agenda` | `requireAuth` | inline | 1354 |
| POST | `/:id/agenda` | `/backend/event-management/:id/agenda` | `requireAuth` | inline | 1368 |
| PUT | `/:id/agenda/:sessionId` | `/backend/event-management/:id/agenda/:sessionId` | `requireAuth` | inline | 1412 |
| DELETE | `/:id/agenda/:sessionId` | `/backend/event-management/:id/agenda/:sessionId` | `requireAuth` | inline | 1470 |
| GET | `/:id/sponsors` | `/backend/event-management/:id/sponsors` | `requireAuth` | inline | 1502 |
| POST | `/:id/sponsors` | `/backend/event-management/:id/sponsors` | `requireAuth` | inline | 1517 |
| PUT | `/:id/sponsors/:sponsorId` | `/backend/event-management/:id/sponsors/:sponsorId` | `requireAuth` | inline | 1537 |
| DELETE | `/:id/sponsors/:sponsorId` | `/backend/event-management/:id/sponsors/:sponsorId` | `requireAuth` | inline | 1563 |
| GET | `/:id/campaigns/recipients` | `/backend/event-management/:id/campaigns/recipients` | `requireAuth` | inline | 1606 |
| GET | `/:id/campaigns/audience` | `/backend/event-management/:id/campaigns/audience` | `requireAuth` | inline | 1652 |
| GET | `/:id/registration-form` | `/backend/event-management/:id/registration-form` | `requireAuth` | inline | 1711 |
| PUT | `/:id/registration-form` | `/backend/event-management/:id/registration-form` | `requireAuth` | inline | 1745 |
| GET | `/:id/website` | `/backend/event-management/:id/website` | `requireAuth` | inline | 1819 |
| PUT | `/:id/website` | `/backend/event-management/:id/website` | `requireAuth` | inline | 1849 |
| POST | `/:id/website/publish` | `/backend/event-management/:id/website/publish` | `requireAuth` | inline | 1891 |
| PUT | `/:id/website/settings` | `/backend/event-management/:id/website/settings` | `requireAuth` | inline | 1924 |
| POST | `/:id/website/domain` | `/backend/event-management/:id/website/domain` | `requireAuth` | inline | 1996 |
| POST | `/:id/website/domain/verify` | `/backend/event-management/:id/website/domain/verify` | `requireAuth` | inline | 2109 |
| DELETE | `/:id/website/domain` | `/backend/event-management/:id/website/domain` | `requireAuth` | inline | 2173 |
| POST | `/:id/website/reset` | `/backend/event-management/:id/website/reset` | `requireAuth` | inline | 2207 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2265 |

## Interfaces

- **Database (Mongoose models used):**
  - `EventProgram` (server/models/eventProgram.model.ts) — reads: `findOne`, `find`, `countDocuments`; **writes:** `create`
  - `founderAlertsZodSchema` (server/models/founderAlerts.schema.ts) — referenced
  - `EventTicketTier` (server/models/eventTicketTier.model.ts) — reads: `find`, `countDocuments`, `findOne`, `findById`; **writes:** `insertMany`, `create`, `bulkWrite`
  - `EventRegistration` (server/models/eventRegistration.model.ts) — reads: `aggregate`, `find`, `countDocuments`, `findOne`
  - `EventWebsiteConfig` (server/models/eventWebsiteConfig.model.ts) — reads: `findOne`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `EventRegistrationForm` (server/models/eventRegistrationForm.model.ts) — reads: `findOne`; **writes:** `create`, `findOneAndUpdate`
  - `EventSpeaker` (server/models/eventSpeaker.model.ts) — reads: `find`, `countDocuments`; **writes:** `create`, `findOneAndUpdate`, `deleteOne`
  - `EventAgendaSession` (server/models/eventAgendaSession.model.ts) — reads: `find`, `findOne`; **writes:** `updateMany`, `create`, `findOneAndUpdate`, `deleteOne`
  - `EventSponsor` (server/models/eventSponsor.model.ts) — reads: `find`, `countDocuments`; **writes:** `create`, `findOneAndUpdate`, `deleteOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `findOne`
- **Environment variables (`process.env`):** `APP_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/models/eventProgram.model.ts` — `EventProgram`
  - `server/models/founderAlerts.schema.ts` — `founderAlertsZodSchema`, `normalizeFounderAlerts`
  - `server/models/eventTicketTier.model.ts` — `EventTicketTier`
  - `server/models/eventRegistrationForm.model.ts` — `EventRegistrationForm`, `FORM_FIELD_TYPES`, `defaultFormFields`
  - `server/models/eventRegistration.model.ts` — `EventRegistration`
  - `server/models/eventSpeaker.model.ts` — `EventSpeaker`
  - `server/models/eventAgendaSession.model.ts` — `EventAgendaSession`
  - `server/models/eventSponsor.model.ts` — `EventSponsor`
  - `server/models/eventWebsiteConfig.model.ts` — `EventWebsiteConfig`, `EVENT_BLOCK_TYPES`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/services/eventDomain.ts` — `normaliseHost`
  - `server/routes/initialSetup.ts` — `addDomainToVercel`, `getDomainFromVercel`, `removeDomainFromVercel`, `verificationToDnsRecords`
  - `server/services/s3.ts` — `s3Service`
  - `server/services/eventManagement.ts` — `canManageEvents`, `generateUniqueSlug`, `computeEventMetrics`, `ensureWebsiteConfig`, `defaultWebsiteBlocks`, `publishChecklist`, `claimTierSeats`, `releaseTierSeats`, … +2
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`
  - `multer`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/event-management`.

## Notes

- Large file (2266 lines) — read it by section; line numbers above point into it.
