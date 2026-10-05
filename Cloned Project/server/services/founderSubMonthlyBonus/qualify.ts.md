# `server/services/founderSubMonthlyBonus/qualify.ts`

> Qualify step for the monthly founder Pro-sub volume bonus.

**Kind:** backend service · **Lines:** 144

<!-- docgen:auto -->

## Purpose
Qualify step for the monthly founder Pro-sub volume bonus.

Aggregates NEW office Pro-plan subscriptions activated in the UTC
month window (grouped by the founder's direct referrer), then applies
the tier function.

WHY OfficeSubscription NOT Invoice: a single Pro sub can produce
two paid Invoices with `recurringPaymentNumber = 1` (the parent
created up-front at checkout PLUS a child created by the Razorpay
`subscription.charged` webhook on the first auto-charge). Counting
invoices would double-count the Razorpay-flow sales. OfficeSubscription
is one-per-sub with `startedAt` set exactly once at activation, so
counting subs gives the correct "new activations this month" figure.
Renewals bump `paidCount`/`currentStart`/`currentEnd` but never
change `startedAt`, so they're inherently excluded.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Qualifier` | interface |  | 36 |
| `QualifyResult` | interface |  | 47 |
| `qualifyForPeriod` | function | `async qualifyForPeriod(periodKey: string): Promise<QualifyResult>` | 55 |

## Interfaces

- **Database (Mongoose models used):**
  - `OfficeSubscription` (server/models/officeSubscription.model.ts) — reads: `aggregate`

## Dependencies

- **Internal:**
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`
  - `server/models/officePlan.model.ts` — `OFFICE_PLAN_IDS`
  - `server/config/founderSubBonus.ts` — `FOUNDER_SUB_BONUS`, `computeFounderSubBonusUsd`
  - `server/models/founderSubBonusRun.model.ts` — `periodBoundsFor`, `IFounderSubBonusRunTotals`
  - `server/models/founderSubBonusPayout.model.ts` — `MAX_PERSISTED_INVOICE_IDS`, `FounderSubBonusTier`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/founderSubMonthlyBonus/run.ts`
