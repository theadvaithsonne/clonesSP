# `server/services/conversionFee.ts`

> Conversion fee resolution + math.

**Kind:** backend service · **Lines:** 317

<!-- docgen:auto -->

## Purpose
Conversion fee resolution + math.

Pure functions where possible so the arithmetic is unit-testable
without a database. The one DB-touching function (`resolveFee`) is
a single indexed read.

THE FEE IS CHARGED ON THE SELL SIDE, IN THE CURRENCY BEING SOLD,
BEFORE FX:

  gross  = amount the customer submits   (fromCurrency)
  fee    = round8(gross x feeBps / 10000)
  net    = round8(gross - fee)
  credit = convertBetween(net, from, to)

Charging the sell side makes the fee exact and quotable the moment
the customer types an amount, with no rate involved. Take it out of […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_FEE_BPS` | export |  | 22 |
| `round8` | function | `round8(n: number): number` — Balances are stored at 8dp and transferBetweenWallets rounds to 1e8 at every step. | 27 |
| `ResolvedFee` | interface |  | 31 |
| `FeeSplit` | interface |  | 39 |
| `FeeBreakdown` | interface |  | 46 |
| `isChargeablePair` | function | `isChargeablePair(from: string, to: string): boolean` — Should this pair be charged at all? | 68 |
| `resolveFee` | function | `async resolveFee(orgId: string, fromCurrency: string, toCurrency: string): Promise<ResolvedFee>` — Look up the fee an org charges for a directional pair. | 78 |
| `splitFeeForCompPlan` | function | `splitFeeForCompPlan(feeAmount: number, compPlanPercentage: number): FeeSplit` — Split a collected fee between the founder and the comp-plan tree. | 129 |
| `computeFee` | function | `computeFee(gross: number, feeBps: number): FeeBreakdown` — Split a gross amount into fee + net. | 158 |
| `isFeeExempt` | function | `isFeeExempt(payerUserId: string, beneficiaryUserId: string): boolean` — Whether the payer is exempt. | 202 |
| `settleFeeCompPlan` | function | `async settleFeeCompPlan(params: { transferGroupId: string; payerUserId: string; fou…): Promise<{ compPlanShareUsd: number; unspentUsd: n…` — Pay the comp-plan slice of a collected fee through the Unilevel Plus tree. | 226 |

## Interfaces

- **Database (Mongoose models used):**
  - `OrgConversionFee` (server/models/orgConversionFee.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/orgConversionFee.model.ts` — `OrgConversionFee`, `MAX_FEE_BPS`
- **Packages:** none

## Used by

- `server/routes/wallet.ts`
- `server/services/__tests__/conversionFee.test.ts`
- `server/services/wallet.ts`
