# `server/services/ecommerceInvoice.ts`

> Module exporting `resolveSellersForOrgs`, `previewEcommerceCart`, `createEcommerceInvoice`.

**Kind:** backend service · **Lines:** 1041

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `resolveSellersForOrgs` | function | `async resolveSellersForOrgs(orgIds: string[]): Promise<Map<string, string>>` — Resolve the User who should receive the seller's share when a storeproduct from `orgId` is sold. | 23 |
| `CartItemInput` | interface |  | 62 |
| `CustomLineInput` | interface | A line that is not a catalogue product. | 100 |
| `PreviewedLineItem` | interface |  | 113 |
| `CartPreviewResult` | interface |  | 159 |
| `EcommerceError` | class | `extends Error` | 182 |
| `previewEcommerceCart` | function | `async previewEcommerceCart(opts: { items: CartItemInput[]; displayCurrency: "USD" \| "I…): Promise<CartPreviewResult>` | 247 |
| `createEcommerceInvoice` | function | `async createEcommerceInvoice(opts: { userId: string; customerEmail: string; customerName…): Promise<{ invoice: IInvoice; payUrl: string; /** …` | 759 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `aggregate`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `find`
  - `ProductVariant` (server/models/productVariant.model.ts) — reads: `find`
  - `Store` (server/models/store.model.ts) — reads: `find`
  - `Invoice` (server/models/invoice.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`, `IInvoice`, `IShippingAddress`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/models/productVariant.model.ts` — `ProductVariant`
  - `server/models/store.model.ts` — `Store`
  - `server/models/user.model.ts` — `User`
  - `server/utils/exchangeRate.ts` — `convertUsdToInr`, `convertInrToUsd`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/counterBills.ts`
- `server/routes/ecommerceInvoice.ts`
- `server/services/__tests__/counterBill.pricing.test.ts`
- `server/services/auctionSettlement.ts`
- `server/services/counterBill.ts`
