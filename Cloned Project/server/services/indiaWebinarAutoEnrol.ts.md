# `server/services/indiaWebinarAutoEnrol.ts`

> Module exporting `autoEnrolIndiaWebinar`.

**Kind:** backend service · **Lines:** 93

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `INDIA_AUTO_ENROL_WORKSHOP_ID` | const | `= "6a8c430abf0ad3c0ff3ef431"` — "Your Freedom Webinar" — free, daily-recurring, Asia/Kolkata. | 37 |
| `autoEnrolIndiaWebinar` | function | `async autoEnrolIndiaWebinar(userOrId: any): Promise<"enrolled" \| "already" \| "not_india" \| "s…` | 39 |

## Interfaces

- **Database (Mongoose models used):**
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `findOne`; **writes:** `create`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/workshop.model.ts` — `Workshop`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/profile.ts`
