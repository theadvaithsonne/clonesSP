# `server/utils/affiliateId.ts`

> Module exporting `generateAffiliateId`, `isValidAffiliateId`.

**Kind:** backend utility · **Lines:** 39

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateAffiliateId` | function | `async generateAffiliateId(): Promise<string>` — Generate a unique affiliate ID in format: aff_xxxxxxxx Example: aff_ti6de6kr | 8 |
| `isValidAffiliateId` | function | `isValidAffiliateId(id: string): boolean` — Validate affiliate ID format Valid format: aff_xxxxxxxx (aff_ prefix + 8 alphanumeric chars) | 36 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `crypto`

## Used by

- `server/bat246/services/bat246.service.ts`
- `server/routes/affiliate.ts`
- `server/routes/downlines.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/org.ts`
- `server/routes/profile.ts`
- `server/scripts/migrate-affiliate.ts`
- `server/services/affiliate.ts`
- `server/services/init.ts`
