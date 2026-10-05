# `server/services/bondView.ts`

> One place that turns a bond holding into the numbers people see.

**Kind:** backend service · **Lines:** 362

<!-- docgen:auto -->

## Purpose
One place that turns a bond holding into the numbers people see.

The public bond page, the owner's view and the purchase-history list
all go through here, so "interest paid" or "net ROI" can never mean
two different things on two screens.

`computeBondSummary` is pure (no DB, no network) and unit-tested.
Everything around it only loads data and decides what each audience
is allowed to see.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Money` | interface |  | 14 |
| `SummaryEvent` | interface |  | 23 |
| `SummaryInput` | interface |  | 32 |
| `BondSummary` | interface |  | 44 |
| `money` | function | `money(atomic: string, currency: BondCurrency, usdPerUnit: number \| null): Money` | 64 |
| `computeBondSummary` | function | `computeBondSummary(i: SummaryInput): BondSummary` | 83 |
| `usdPerUnit` | function | `async usdPerUnit(currency: BondCurrency): Promise<number \| null>` — USD per whole unit, via the 5-minute-cached FX layer. | 147 |
| `ViewSources` | interface |  | 158 |
| `buildPublicBondView` | function | `buildPublicBondView(src: ViewSources, log: { limit: number; offset: number } = { limit: 50, offse…)` — The public bond page. | 171 |
| `buildHoldingListItem` | function | `buildHoldingListItem(src: ViewSources)` — Compact row for the purchase-history list. | 277 |
| `loadViewSources` | function | `async loadViewSources(holdings: any[]): Promise<ViewSources[]>` — Load everything the view builders need for a set of holdings, in a fixed number of queries regardless of how many holdings there are: one for instruments, one for issuer names, one for payout events, plus one cached FX lookup per distinct … | 313 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/config/bondMoney.ts` — `BondCurrency`, `fromAtomic`, `addAtomic`, `mulUnits`
  - `server/services/bondMath.ts` — `PAYOUT_PERIOD_DAYS`, `PayoutFrequency`
- **Packages:** none

## Used by

- `server/routes/bond.ts`
- `server/routes/publicBond.ts`
- `server/services/__tests__/bondView.test.ts`
