# `server/services/officeGrace.ts`

> src/services/officeGrace.ts

**Kind:** backend service · **Lines:** 212

<!-- docgen:auto -->

## Purpose
src/services/officeGrace.ts

The 30-day office grace programme.

Normally an office needs an active $25 Unilevel Plus licence before it can
be created (services/officeEligibility.ts). Integrating platforms may skip
that gate for a STARTER office and hand the founder 30 days to buy the
licence instead — see routes/platformOffices.ts.

Two rules make this safe to bolt onto a live system:

  1. Status is DERIVED, never stored. An office is "licensed" the moment its
     founder holds a licence (whenever that happens — day 3 or day 300),
     "grace" while the clock runs, and "locked" after. There is no status
     field to go stale, no cron to miss a day, and buying the licence needs
     no write here at all. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OFFICE_GRACE_DAYS` | const | `= 30` — Length of the grace window. | 34 |
| `GraceStatus` | type |  | 36 |
| `GraceState` | interface |  | 38 |
| `graceStatusFor` | function | `graceStatusFor(grace: \| { startedAt?: Date \| null; expiresAt?: Date \| null…, licenceActive: boolean, now: Date = new Date()): GraceState` — Resolve an office's grace state. | 65 |
| `findUserGraceOrg` | function | `async findUserGraceOrg(userId: string)` — The user's existing grace office, if they have one. | 118 |
| `EligibilityReason` | type |  | 126 |
| `GraceEligibility` | interface |  | 132 |
| `checkGraceEligibility` | function | `async checkGraceEligibility(userId: string, now: Date = new Date()): Promise<GraceEligibility>` — May this user create a starter office through the grace programme? | 153 |
| `newGraceWindow` | function | `newGraceWindow(now: Date = new Date()): { startedAt: Date; expiresAt: Date; }` — The window a grace office created right now would get. | 203 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/unilevelPlusCommission.ts` — `getUserPurchase`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/platformOffices.ts`
- `server/services/__tests__/officeGrace.test.ts`
