# `server/utils/gstTax.ts`

> Tax math + policy helpers shared by every paid-item checkout flow.

**Kind:** backend utility · **Lines:** 238

<!-- docgen:auto -->

## Purpose
Tax math + policy helpers shared by every paid-item checkout flow.

The arithmetic primitives (`extractBaseFromTotal`, `calculateTaxAmounts`,
`GST_CONFIG`) were originally co-located with the OfficePlan model — moved
here so channels, courses, products, etc. can reuse them without importing
from a model file. The original location re-exports these for back-compat.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GST_CONFIG` | const | `= { rate: 18, // 18% GST sacCode: "998314", // SAC code for IT/SaaS services taxInclusive…` | 11 |
| `calculateTaxAmounts` | function | `calculateTaxAmounts(baseAmountPaise: number, taxRate: number = GST_CONFIG.rate)` — Tax is added ON TOP of the base. | 26 |
| `extractBaseFromTotal` | function | `extractBaseFromTotal(totalAmountPaise: number, taxRate: number = GST_CONFIG.rate)` — Tax is split OUT of the listed price. | 41 |
| `APPLE_FEE_RATE` | const | `= 30` | 53 |
| `calculateAppleFeeOnTop` | function | `calculateAppleFeeOnTop(baseAmountPaise: number, rate: number = APPLE_FEE_RATE)` | 55 |
| `extractAppleFeeFromTotal` | function | `extractAppleFeeFromTotal(totalAmountPaise: number, rate: number = APPLE_FEE_RATE)` | 63 |
| `shouldApplyGstForChannel` | function | `shouldApplyGstForChannel(channel: { currency?: string \| null }): boolean` — DEPRECATED as the gate for founder-sold sellable items (channels, courses, workshops, products). | 83 |
| `isIndiaCountry` | function | `isIndiaCountry(value?: string \| null): boolean` — Is this country string India? | 96 |
| `GstLineResult` | interface |  | 103 |
| `applyGstToLine` | function | `applyGstToLine(opts: { listedAmountMinor: number; quantity?: number; gstIn…): GstLineResult` — The single place the GST matrix lives. | 146 |
| `shouldApplyAppleFee` | function | `shouldApplyAppleFee(paymentSource?: string \| null): boolean` — Apple's 30% fee applies whenever the buyer is paying via the iOS app. | 204 |
| `getCommissionBase` | function | `getCommissionBase(listedPrice: number, item: { gstInclusive?: boolean \| null }, buyerInIndia: boolean): number` — Commission base for a sold item, in MAIN units (not paise/cents). | 226 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `scripts/mint-synthetic-combo.ts`
- `server/models/officePlan.model.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/course.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/feed.ts`
- `server/routes/gstQuote.ts`
- `server/routes/officeAddonCheckout.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/product.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicEventManagement.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/unilevel-plus.ts`
- `server/routes/workshop.ts`
- `server/routes/workshopCheckout.ts`
- `server/services/adminPlatformBilling.ts`
- `server/services/auctionSettlement.ts`
- `server/services/comboCheckout.ts`
- `server/services/course.ts`
- `server/services/cryptobrandOfficeBootstrap.ts`
- `server/services/cryptosubAddonPurchase.ts`
- `server/services/ecommerceInvoice.ts`
- `server/services/product.ts`
- `server/services/thirdPartyInvoice.ts`
- _…and 4 more_
