# `server/services/thirdPartyInvoice.ts`

> Module exporting `createThirdPartyInvoice`, `listThirdPartyInvoices`, `getThirdPartyInvoice`, `cancelThirdPartyInvoice` and 3 more.

**Kind:** backend service · **Lines:** 662

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ThirdPartyError` | export |  | 19 |
| `SUPPORTED_TOPUP_CURRENCIES` | const | `= ["USD", "INR"]` — Currencies a top-up invoice may be raised in. | 40 |
| `CreateThirdPartyInvoiceInput` | interface |  | 46 |
| `createThirdPartyInvoice` | function | `async createThirdPartyInvoice(input: CreateThirdPartyInvoiceInput): Promise<IInvoice>` | 105 |
| `ListThirdPartyInvoicesInput` | interface |  | 476 |
| `listThirdPartyInvoices` | function | `async listThirdPartyInvoices(input: ListThirdPartyInvoicesInput): Promise<{ invoices: IInvoice[]; total: number }>` | 486 |
| `getThirdPartyInvoice` | function | `async getThirdPartyInvoice(clientId: string, invoiceIdOrNumber: string): Promise<IInvoice \| null>` | 511 |
| `cancelThirdPartyInvoice` | function | `async cancelThirdPartyInvoice(clientId: string, invoiceIdOrNumber: string): Promise<IInvoice>` | 524 |
| `getThirdPartyInvoiceReceipt` | function | `async getThirdPartyInvoiceReceipt(clientId: string, invoiceIdOrNumber: string): Promise<{ invoice: IInvoice; receipt: { invoiceNu…` | 545 |
| `listCustomerInvoices` | function | `async listCustomerInvoices(clientId: string, customerEmail: string, options: { status?: InvoiceStatus; limit?: number; offset?:…): Promise<{ invoices: IInvoice[]; total: number }>` | 603 |
| `retryInvoiceWebhook` | function | `async retryInvoiceWebhook(clientId: string, invoiceIdOrNumber: string): Promise<{ invoice: IInvoice; dispatched: boolean …` | 617 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`, `find`, `countDocuments`
  - `User` (server/models/user.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`, `IInvoice`, `InvoiceStatus`
  - `server/models/thirdPartyClient.model.ts` — `IThirdPartyClient`
  - `server/models/user.model.ts` — `User`
  - `server/services/invoice.ts` — `createInvoice`
  - `server/utils/gstTax.ts` — `calculateTaxAmounts`, `GST_CONFIG`, `applyGstToLine`
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`, `gstSkippedMetadata`
  - `server/services/thirdPartyError.ts` — `ThirdPartyError`
  - `server/services/thirdPartyTerms.ts` — `resolveTermPlan`
  - `server/utils/dateMath.ts` — `addMonthsClamped`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminSavedCards.ts`
- `server/routes/thirdPartyInvoice.ts`
- `server/routes/unilevel-plus.ts`
- `server/scripts/grant-networkchain-coupon-hiren.ts`
- `server/services/comboActivation.ts`
- `server/services/comboCheckout.ts`
- `server/services/thirdPartyTerms.ts`
