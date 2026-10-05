# `server/models/counterBill.model.ts`

> Mongoose models for bills raised at a physical store counter in the Garage IRL seller app, plus an atomic per-store bill-number sequence.

**Kind:** Mongoose model · **Lines:** 270

## Purpose
A counter bill is the seller's own record of a sale at a till, table or counter. It is not a payment: sending a bill creates an ordinary ecommerce invoice (`server/services/ecommerceInvoice.ts`), so payment, GST, coupons, commissions, stock and store-order mirroring all run through the normal checkout. The bill covers what exists before and around that invoice: a draft the seller can come back to, table and guest count, a customer attached by scanning the bill's QR code, service charge and packaging, "amount only" bills with no catalogue item, a customer correction request, and splitting the bill across several payers. All money is in **paise** (smallest INR unit), like invoice amounts.

## How it works
### `CounterBill` document
- **Ownership:** `orgId` and `createdBy` (required), optional `storeId`, `branchId` and a `branchName` snapshot for lists.
- **Numbering:** `billNumber` - per-org sequential number from `nextCounterBillNumber`; unique per org.
- **Mode:** `itemised` (default) uses `lines[]`; `amount` uses a single `amount` with an `amountLabel`.
- **Lines** (`LineSchema`, no `_id`): `productId`, optional `variantId`, snapshots of `title`, `variantTitle`, `image`, `diet`, `unitPrice` (paise, repriced on send), `quantity` (1-999) and `addOns[]` (`label`, `price` per unit; prices are resolved from the product, never trusted from the client). The invoice re-reads the product rather than these snapshots.
- **Extras:** `table` (free text such as "Table 14"), `guests` (1-99), `serviceChargePct` (0-30), `packaging` (paise), `couponCode` (uppercased), `note`.
- **Status:** `COUNTER_BILL_STATUSES` - `draft` (default), `sent`, `paid`, `cancelled`, `expired`, `refunded`, plus `sentAt`, `paidAt`, `cancelledAt`.
- **Customer attach:** `attachCode` is the short code carried by the bill's QR. The service generates it on create (retrying on a duplicate-key error) and clears it once the bill can no longer be claimed (cancelled, or any status other than `sent` after a sync). `customer` holds `userId`, `name`, `phone`, `email`, `attachedAt` and `via` (`qr` or `manual`).
- **Invoice link:** `invoiceId`, `invoiceNumber`, `payUrl`, `expiresAt` (copied from the invoice when sent).
- **Totals:** `totals` - `itemTotal`, `serviceCharge`, `packaging`, `tax`, `discount`, `total`.
- **Split:** `split.ways` (2-20) and `split.shares[]` (`index`, `amount`, own `invoiceId`/`payUrl`, `status` pending/paid/cancelled, `paidAt`, `userId`). `shares` defaults to `undefined` so unsplit bills store no empty array.
- **Correction:** `correction` - `status` requested/resolved, `note`, `requestedAt`, `requestedBy`, `resolvedAt`.
- `timestamps: true`.

Status is kept in step with the underlying invoices by `syncBills` in `server/services/counterBill.ts`: a `sent` bill becomes `paid` when its invoice (or every split-share invoice) is paid, `refunded`, `expired` (invoice expired or past `expiresAt`), or `cancelled`.

### Indexes
- `{orgId, createdAt:-1}` and `{orgId, status, createdAt:-1}` - the seller's list and tabs.
- Unique `{orgId, billNumber}`.
- Unique sparse `{attachCode}` - QR lookup; no two live bills share a code.
- `{"customer.userId", createdAt:-1}` - the buyer's "bills for you".
- Sparse `{invoiceId}` and `{"split.shares.invoiceId"}` - map a paid invoice back to its bill.

### `CounterBillSequence` and `nextCounterBillNumber`
One row per org (`orgId` unique, `seq`). `nextCounterBillNumber(orgId)` does a `findOneAndUpdate` with `$inc: {seq: 1}` and `upsert: true`, so two tills raising bills at the same instant still get distinct numbers. The first bill of an org is number 1.

## Exports
- `CounterBill` - Mongoose model (`"CounterBill"`, collection `counterbills`).
- `CounterBillSequence` - Mongoose model (`"CounterBillSequence"`, collection `counterbillsequences`).
- `nextCounterBillNumber(orgId: Types.ObjectId | string): Promise<number>` - atomically allocates the next bill number for an org.
- `COUNTER_BILL_STATUSES` / `CounterBillStatus` - bill status values.
- `ICounterBill`, `ICounterBillLine`, `ICounterBillAddOn`, `ICounterBillCustomer`, `ICounterBillShare`, `ICounterBillCorrection`, `ICounterBillTotals` - TypeScript shapes.

## Interfaces
- **Database:** `CounterBill` (collection `counterbills`) and `CounterBillSequence` (collection `counterbillsequences`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/counterBill.ts` (all bill logic: create, price, send, attach, split, cancel, sync) and `server/routes/counterBills.ts`, mounted at `/api/counter-bills` (browser `/backend/api/counter-bills`). Also mocked in `server/services/__tests__/counterBill.sync.test.ts`.

## Notes
- None of the ObjectId fields declare a `ref`, so `populate()` will not work without passing a model explicitly.
- Line prices are snapshots for display; the authoritative price is recomputed from the product when the bill is sent.
