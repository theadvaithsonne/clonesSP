# `server/services/officePlanStatus.ts`

> Per-org office plan status — resolves an org's CURRENT plan (Starter / Pro / etc.) plus its Cryptosub add-on state.

**Kind:** backend service · **Lines:** 125

<!-- docgen:auto -->

## Purpose
Per-org office plan status — resolves an org's CURRENT plan (Starter
/ Pro / etc.) plus its Cryptosub add-on state. Used by:

  POST /org/:orgId/cryptobrand-upgrade — gates on "is Starter?" to
    decide whether to mint Pro + Cryptosub bootstrap invoices.
  GET  /me/offices/plans — lists every founder org with its plan info
    for the "my crypto offices" grid.

Not to be confused with services/cryptobrandCheckoutStatus.ts —
that one gates on "is the bootstrap INVOICE paid?", which is a
different question (an org can be on Starter with a paid Pro
invoice sitting in history, or on Pro with no bootstrap invoice
at all if they came in via the standard office checkout).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficePlanStatus` | interface |  | 22 |
| `getOfficePlanStatusForOrg` | function | `async getOfficePlanStatusForOrg(orgId: string, isCryptobrand: boolean): Promise<OfficePlanStatus>` — Look up the ACTIVE plan for an org. | 58 |

## Interfaces

- **Database (Mongoose models used):**
  - `OfficeSubscription` (server/models/officeSubscription.model.ts) — reads: `findOne`
  - `OfficePlan` (server/models/officePlan.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`
  - `server/models/officePlan.model.ts` — `OfficePlan`
  - `server/services/officeAddonSubscription.ts` — `hasActiveAddon`
  - `server/services/cryptobrandCheckoutStatus.ts` — `isProOfficeSatisfied`
  - `server/config/cryptosubAddon.ts` — `CRYPTOSUB_ADDON`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/cryptobrandCheckout.ts`
- `server/routes/myOfficePlans.ts`
