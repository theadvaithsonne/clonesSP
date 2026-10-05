# `server/services/downlineMemberMonthly.ts`

> ─────────────────────────────────────────────────────────────────────── Downline member profile — the monthly activity chart behind the header.

**Kind:** backend service · **Lines:** 166

<!-- docgen:auto -->

## Purpose
───────────────────────────────────────────────────────────────────────
Downline member profile — the monthly activity chart behind the header.

Two series for one member, bucketed into the 12 months of a year:

  · spent  → "Total Money Spent By <member>". Every PAID invoice line the
             member bought, across ALL orgs and item types (the profile
             TABS filter by category; this chart deliberately does not).
  · earned → "Your Earnings From <member>". The VIEWER's commission on that
             member's purchases — the same relationship the profile table's
             "You Earned" column shows, just bucketed by month.

Both are returned in **cents**, so the frontend has one unit to format.
───────────────────────────────────────────────────────────────────────

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `INR_PER_USD` | const | `= 88` — INR → USD. Invoice line items are stored in their ORIGINAL currency's minor unit (paise for INR, cents for USD) and carry no USD equivalent — only 65 paid invoices have a `currencyConversion`, so a per-invoice historical rate isn't availab… | 29 |
| `MemberMonthlyPoint` | interface | One month's totals. `month` is 1-12. | 32 |
| `MemberMonthlyResult` | interface |  | 38 |
| `getMemberMonthlyActivity` | function | `async getMemberMonthlyActivity(memberId: Types.ObjectId, viewerId: Types.ObjectId \| undefined, year: number): Promise<MemberMonthlyResult>` — Monthly spend + viewer earnings for one downline member. | 79 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `aggregate`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/downlineProfile.ts`
