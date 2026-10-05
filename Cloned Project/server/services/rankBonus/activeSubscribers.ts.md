# `server/services/rankBonus/activeSubscribers.ts`

> src/services/rankBonus/activeSubscribers.ts

**Kind:** backend service · **Lines:** 166

<!-- docgen:auto -->

## Purpose
src/services/rankBonus/activeSubscribers.ts

"Who holds an active PAID NetworkChain subscription right now?"

This is the single most dangerous predicate in the rank-bonus system: it
decides who earns money. Three sources were considered and two rejected.

  NcSubscription mirror  — REJECTED. Owned by contacts-backend, not us. One
    document per user, mutated in place. Its `payments.$elemMatch.amountCents
    > 0` test asks "has this user EVER paid", not "is the current period
    paid". And Garage sends `amount: invoice.totalAmount` on the webhook,
    which is 0 for a bundle-prepaid cycle — so a 6-month combo buyer likely
    records `amountCents: 0` there and would be wrongly excluded.

  User.typeFlags.networkChainsSub — REJECTED. A cached boolean with no expiry
    sweeper: nothing recomputes it when a subscription simply lapses, so it […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ActiveSubscriberResult` | interface |  | 39 |
| `getActivePaidSubscribers` | function | `async getActivePaidSubscribers(thirdPartyClientId: Types.ObjectId \| string, asOf: Date = new Date()): Promise<ActiveSubscriberResult>` — Snapshot of active PAID subscribers for one partner. | 56 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/scripts/preview-rank-bonus.ts`
- `server/services/genealogy/data.ts`
- `server/services/rankBonus/detail.ts`
- `server/services/rankBonus/run.ts`
