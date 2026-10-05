# `server/routes/testimonials.ts`

> Express router with 12 endpoints, mounted at `/testimonials`.

**Kind:** Express router · **Lines:** 675 · **Mounted at:** `/testimonials` (browser: `/backend/testimonials`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (12)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/testimonials` | `requireAuth` | inline | 44 |
| GET | `/:testimonialId` | `/backend/testimonials/:testimonialId` | `requireAuth` | inline | 130 |
| POST | `/` | `/backend/testimonials` | `requireAuth` | inline | 169 |
| PUT | `/:testimonialId` | `/backend/testimonials/:testimonialId` | `requireAuth` | inline | 267 |
| DELETE | `/:testimonialId` | `/backend/testimonials/:testimonialId` | `requireAuth` | inline | 332 |
| POST | `/:testimonialId/publish` | `/backend/testimonials/:testimonialId/publish` | `requireAuth` | inline | 363 |
| POST | `/:testimonialId/blocks` | `/backend/testimonials/:testimonialId/blocks` | `requireAuth` | inline | 406 |
| PUT | `/:testimonialId/blocks/:blockId` | `/backend/testimonials/:testimonialId/blocks/:blockId` | `requireAuth` | inline | 467 |
| DELETE | `/:testimonialId/blocks/:blockId` | `/backend/testimonials/:testimonialId/blocks/:blockId` | `requireAuth` | inline | 516 |
| POST | `/:testimonialId/blocks/reorder` | `/backend/testimonials/:testimonialId/blocks/reorder` | `requireAuth` | inline | 551 |
| POST | `/reorder` | `/backend/testimonials/reorder` | `requireAuth` | inline | 608 |
| GET | `/meta/categories` | `/backend/testimonials/meta/categories` | `requireAuth` | inline | 651 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 674 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Testimonial` (server/models/testimonial.model.ts) — reads: `find`, `countDocuments`, `distinct`, `findOne`, `findById`; **writes:** `create`, `findOneAndUpdate`, `findOneAndDelete`, `bulkWrite`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/testimonial.model.ts` — `Testimonial`, `ITestimonial`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/testimonials`.
