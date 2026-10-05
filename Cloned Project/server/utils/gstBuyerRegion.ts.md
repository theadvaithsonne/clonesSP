# `server/utils/gstBuyerRegion.ts`

> Resolves WHERE the buyer is, for GST purposes.

**Kind:** backend utility · **Lines:** 241

<!-- docgen:auto -->

## Purpose
Resolves WHERE the buyer is, for GST purposes.

GST on founder-sold items is owed based on the buyer's location, not the
item's currency (see utils/gstTax.ts `applyGstToLine`). This module is the
only place that decision reads the database; gstTax.ts stays pure.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GstRegionSource` | type |  | 10 |
| `BuyerGstRegion` | interface |  | 48 |
| `resolveBuyerGstRegion` | function | `async resolveBuyerGstRegion(opts: { buyerUser?: any; buyerUserId?: string; shippingAddr…): Promise<BuyerGstRegion>` — Resolve the buyer's GST region. | 74 |
| `resolveOrgGstRegion` | function | `async resolveOrgGstRegion(opts: { orgId?: string \| null; subscriberUserId?: string \| …): Promise<BuyerGstRegion>` — Resolve the GST region for an ORG-level purchase — office plans, office add-ons, conference rooms. | 179 |
| `isBuyerInIndia` | function | `async isBuyerInIndia(userId: string, fallbackCurrency?: string \| null): Promise<boolean>` — Convenience for commission sites, which run at payment-verification time and only have a userId + the item's currency. | 215 |
| `gstSkippedMetadata` | function | `gstSkippedMetadata(region: BuyerGstRegion, reason: "buyer_outside_india" \| "item_exempt")` — Build the `metadata.gstSkipped` marker stamped on invoices where no GST was charged. | 231 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/utils/gstTax.ts` — `isIndiaCountry`
  - `server/utils/buyerAddress.ts` — `resolveBuyerAddress`
- **Packages:** none

## Used by

- `server/routes/channelCheckout.ts`
- `server/routes/course.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/feed.ts`
- `server/routes/gstQuote.ts`
- `server/routes/invoice.ts`
- `server/routes/officeAddonCheckout.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/product.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicEventManagement.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/unilevel-plus.ts`
- `server/routes/workshop.ts`
- `server/routes/workshopCheckout.ts`
- `server/scripts/backfill-india-freedom-webinar.ts`
- `server/services/adminPlatformBilling.ts`
- `server/services/auctionSettlement.ts`
- `server/services/comboCheckout.ts`
- `server/services/course.ts`
- `server/services/cryptobrandOfficeBootstrap.ts`
- `server/services/cryptosubAddonPurchase.ts`
- `server/services/ecommerceInvoice.ts`
- `server/services/indiaWebinarAutoEnrol.ts`
- `server/services/product.ts`
- _…and 4 more_
