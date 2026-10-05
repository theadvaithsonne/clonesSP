# `server/services/counterBill.ts`

> Module exporting `makeAttachCode`, `normaliseAttachCode`, `attachUrl`, `toInvoiceInputs` and 14 more.

**Kind:** backend service · **Lines:** 807

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CounterBillError` | class | `extends Error` — Counter bills — see models/counterBill.model.ts for what a bill is. | 30 |
| `makeAttachCode` | function | `makeAttachCode(): string` | 47 |
| `normaliseAttachCode` | function | `normaliseAttachCode(raw: string): string \| null` | 56 |
| `attachUrl` | function | `attachUrl(code: string): string` — The URL a bill's QR carries. | 67 |
| `toInvoiceInputs` | function | `toInvoiceInputs(bill: PricingInput): { items: CartItemInput[]; customLines: CustomLine…` — A bill as invoice inputs: catalogue lines plus the non-catalogue ones. | 92 |
| `totalsFromInvoice` | function | `totalsFromInvoice(inv: { lineItems?: Array<{ totalPrice: number; lineKind?: s…): ICounterBillTotals` — The bill's summary card, read back off an (unsaved or saved) invoice. | 145 |
| `priceBill` | function | `async priceBill(bill: PricingInput & Pick<ICounterBill, "customer" \| "coupo…, sellerUserId: string): Promise<{ totals: ICounterBillTotals; inventoryIs…` — Live totals for the New bill screen. | 212 |
| `SellerContext` | interface |  | 268 |
| `createDraft` | function | `async createDraft(ctx: SellerContext, input: Partial<ICounterBill>): Promise<ICounterBill>` | 273 |
| `loadOwnBill` | function | `async loadOwnBill(ctx: SellerContext, id: string): Promise<ICounterBill>` — Loads a bill owned by the seller's current store, or throws 404. | 301 |
| `updateBill` | function | `async updateBill(bill: ICounterBill, patch: Partial<ICounterBill>): Promise<ICounterBill>` — Edit a bill. A sent bill can still be edited (that is how a correction is answered); the next send replaces its invoice. | 314 |
| `sendBill` | function | `async sendBill(ctx: SellerContext, bill: ICounterBill, opts: { shippingAddress?: IShippingAddress } = {}): Promise<ICounterBill>` — Send (or re-send) a bill: create its invoice and tell the customer. | 383 |
| `cancelBill` | function | `async cancelBill(bill: ICounterBill): Promise<ICounterBill>` | 451 |
| `splitBill` | function | `async splitBill(ctx: SellerContext, bill: ICounterBill, ways: number): Promise<ICounterBill>` — Split a sent bill into equal shares, each its own payable invoice. | 485 |
| `attachCustomer` | function | `async attachCustomer(rawCode: string, buyerUserId: string): Promise<ICounterBill>` — A buyer scanned the bill's QR: put them on it. | 557 |
| `requestCorrection` | function | `async requestCorrection(bill: ICounterBill, buyerUserId: string, note: string): Promise<ICounterBill>` | 609 |
| `syncBills` | function | `async syncBills(bills: ICounterBill[]): Promise<void>` — Bring bills in line with their invoices. | 642 |
| `onInvoicePaid` | function | `async onInvoicePaid(invoice: { _id: any; metadata?: any }): Promise<void>` — Hook for fulfillInvoice — runs on every payment path. | 707 |
| `sellerView` | function | `sellerView(bill: ICounterBill)` — What the seller app gets. | 748 |
| `customerView` | function | `customerView(bill: ICounterBill, storeName?: string)` — What the customer gets — no attach code, no seller-internal fields. | 763 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Store` (server/models/store.model.ts) — reads: `findOne`
  - `CounterBill` (server/models/counterBill.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`, `find`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `PAY_APP_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/models/counterBill.model.ts` — `CounterBill`, `ICounterBill`, `ICounterBillShare`, `ICounterBillTotals`, `nextCounterBillNumber`
  - `server/models/invoice.model.ts` — `Invoice`, `IShippingAddress`
  - `server/models/store.model.ts` — `Store`
  - `server/models/user.model.ts` — `User`
  - `server/services/ecommerceInvoice.ts` — `CartItemInput`, `CustomLineInput`, `EcommerceError`, `createEcommerceInvoice`
- **Packages:**
  - `crypto`
  - `mongoose` — `Types`

## Used by

- `server/routes/counterBills.ts`
- `server/services/__tests__/counterBill.pricing.test.ts`
- `server/services/__tests__/counterBill.sync.test.ts`
- `server/services/invoice.ts`
