# `server/services/cryptobrandOfficeBootstrap.ts`

> Cryptobrand office bootstrap — mints the two initial invoices that every cryptobrand-flagged org needs on creation:

**Kind:** backend service · **Lines:** 236

<!-- docgen:auto -->

## Purpose
Cryptobrand office bootstrap — mints the two initial invoices that
every cryptobrand-flagged org needs on creation:

  Invoice A: Pro office plan ($96/month, monthly recurring)
  Invoice B: Cryptosub ($600/year, yearly recurring)

Both are minted together and both returned in the org-create
response. Cryptobrand's FE opens them as a "checkout summary" and
the founder pays each via the standard `/invoice/<id>` pay page
(Razorpay hosted, Stripe, crypto, wallet — anything). Fulfillment
happens per-invoice via the existing `fulfillInvoice`:
  - office_plan invoice → activates Pro + chains monthly cycles
  - cryptosub invoice → activates cryptosub gate + fires the 3-bucket
    commission split + chains yearly cycles

Kept as a SIBLING service to avoid coupling with office.subscription […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BootstrapInput` | interface |  | 29 |
| `BootstrapInvoiceRef` | interface |  | 34 |
| `BootstrapResult` | interface |  | 43 |
| `bootstrapCryptobrandOfficeInvoices` | function | `async bootstrapCryptobrandOfficeInvoices(input: BootstrapInput): Promise<BootstrapResult>` — Mint the Pro-office-plan invoice AND the Cryptosub invoice for a cryptobrand-flagged org. | 62 |
| `mintProOfficeInvoice` | function | `async mintProOfficeInvoice(input: BootstrapInput): Promise<BootstrapInvoiceRef>` — Mint (or reuse via createInvoice dedup) the Pro office_plan invoice for a cryptobrand org. | 76 |
| `mintCryptosubInvoice` | function | `async mintCryptosubInvoice(input: BootstrapInput): Promise<BootstrapInvoiceRef>` — Mint (or reuse) the Cryptosub yearly invoice for a cryptobrand org. | 164 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `OfficePlan` (server/models/officePlan.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/officePlan.model.ts` — `OfficePlan`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/utils/gstBuyerRegion.ts` — `resolveOrgGstRegion`
  - `server/utils/gstTax.ts` — `applyGstToLine`, `GST_CONFIG`
  - `server/config/cryptosubAddon.ts` — `CRYPTOSUB_ADDON`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/cryptobrandCheckout.ts`
- `server/routes/org.ts`
- `server/services/cryptobrandCheckoutStatus.ts`
