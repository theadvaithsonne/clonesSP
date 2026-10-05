# `server/services/officeEligibility.ts`

> src/services/officeEligibility.ts

**Kind:** backend service · **Lines:** 98

<!-- docgen:auto -->

## Purpose
src/services/officeEligibility.ts

One rule, one place: you need an active Unilevel Plus licence to create an
office.

Both org-creating endpoints (`POST /org/create-first-time` and
`POST /org/upsert`) call this. Gating only the first would leave the second
as an open bypass — it requires a JWT but carries no business guard and no
frontend caller, so nothing would surface the hole.

The check is deliberately NOT a fifth copy of the
`UnilevelPlusPurchase.findOne({ status: "active" })` query that already
exists in four files. It delegates to `getUserPurchase`, the canonical helper
the product route and comboCheckout both use, so a future change to what
"owns a licence" means lands here too.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficeEligibilityError` | class | `extends Error` | 24 |
| `OfficeEligibility` | interface |  | 36 |
| `checkCanCreateOffice` | function | `async checkCanCreateOffice(userId: string): Promise<OfficeEligibility>` — Non-throwing form, for callers that want to render rather than reject. | 45 |
| `assertCanCreateOffice` | function | `async assertCanCreateOffice(userId: string): Promise<void>` — Throwing form for route handlers. | 70 |
| `eligibilityErrorBody` | function | `eligibilityErrorBody(err: OfficeEligibilityError)` — Shape an OfficeEligibilityError into the JSON body both routes return. | 91 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/services/unilevelPlusCommission.ts` — `getUserPurchase`, `getActiveUnilevelPlusPlan`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`
  - `server/models/user.model.ts` — `User`
- **Packages:** none

## Used by

- `server/routes/org.ts`
