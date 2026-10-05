# `server/services/comboCheckout.ts`

> src/services/comboCheckout.ts

**Kind:** backend service · **Lines:** 483

<!-- docgen:auto -->

## Purpose
src/services/comboCheckout.ts

One implementation of "what does this user pay for a NetworkChain plan right
now, and what invoice does that produce".

Previously this logic lived inline in POST /unilevel-plus/checkout/
create-combo-invoice, keyed off `req.user` behind requireAuth. The magic-link
flow needs exactly the same answers for a user who is NOT logged in (the link
token identifies them instead), and the product page needs the quote half on
its own. Three copies of the pricing rules would drift, so they live here.

The two halves:
  quoteComboCheckout()          — pure read. Safe to call on every page load.
  createComboCheckoutInvoice()  — mints the invoice the buyer pays.

Nothing here is cached. The offer window is re-resolved on every call, which […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CHECKOUT_USER_FIELDS` | const | `= "email name organizations profileCompletedAt offerExpiresAtOverride"` — Fields every window/pricing decision reads. | 51 |
| `ComboCheckoutKind` | type | Which of the three purchase shapes this quote describes. | 55 |
| `ComboQuote` | interface |  | 57 |
| `ComboCheckoutError` | class | `extends Error` | 86 |
| `quoteComboCheckout` | function | `async quoteComboCheckout(input: { userId: string; client: IThirdPartyClient; termMon…): Promise<ComboQuote>` — Price a NetworkChain plan for a specific user, right now. | 121 |
| `quoteAllPlans` | function | `async quoteAllPlans(input: { userId: string; client: IThirdPartyClient; now?: D…): Promise<ComboQuote[]>` — Quote EVERY active term for one user — the catalog a magic link shows when it wasn't created for a specific plan. | 256 |
| `CreateComboInvoiceResult` | interface |  | 288 |
| `createComboCheckoutInvoice` | function | `async createComboCheckoutInvoice(input: { userId: string; orgId?: string; client: IThirdPart…): Promise<CreateComboInvoiceResult>` — Mint the invoice for a NetworkChain purchase. | 301 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`, `IInvoice`
  - `server/models/thirdPartyClient.model.ts` — `IThirdPartyClient`
  - `server/services/unilevelPlusCommission.ts` — `getActiveUnilevelPlusPlan`, `getUserPurchase`
  - `server/services/thirdPartyTerms.ts` — `resolveTermPlan`
  - `server/services/thirdPartyInvoice.ts` — `createThirdPartyInvoice`
  - `server/services/comboWindow.ts` — `comboWindowFor`, `ComboWindow`
  - `server/services/invoice.ts` — `createInvoice`
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`, `gstSkippedMetadata`
  - `server/utils/gstTax.ts` — `applyGstToLine`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/magicLink.ts`
- `server/routes/platformOffices.ts`
- `server/services/magicLinkReminders.ts`
- `server/services/signupOffer.ts`
