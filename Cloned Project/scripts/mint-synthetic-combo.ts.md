# `scripts/mint-synthetic-combo.ts`

> Creates a fake but fully-entitled "Unilevel Plus + NetworkChain combo" subscription for one existing user, directly in the **production** database, without any payment or commission flow.

**Kind:** backend helper/test script (writes to the configured DB) · **Lines:** 223

## Purpose
Google's OAuth site verification needed a test account that looks like a paying combo customer (Unilevel Plus active and a NetworkChain subscription active). Running a real checkout would charge money and fire wallet-touching commission distributions, so this script writes the same records the real `/unilevel-plus/checkout/create-combo-invoice` -> fulfilment path would produce, but marked as synthetic. It is run by hand and imported by nothing.

## How it works
Usage: `MONGODB_URI=... npx ts-node scripts/mint-synthetic-combo.ts user@example.com` (tsx works too). Without an email argument it prints usage and exits 1. It loads `.env` and connects to `MONGODB_URI` (production here).

1. **Resolve user** by lower-cased email (`User`). The NC subscription needs an `orgId`; the script uses the user's own id as the org id, mirroring NetworkChain's own webhook fallback (`metadata.orgId || userId`).
2. **Resolve NC client:** the active `ThirdPartyClient` whose name matches /networkchain/i and has `productConfig.recurringPeriod`; also resolves the platform user from `productConfig.platformUserEmail`. Throws if either is missing.
3. **Resolve active Unilevel Plus plan** via `getActiveUnilevelPlusPlan()`; throws if none.
4. **`UnilevelPlusPurchase`** (one per user, unique on `userId`): if it exists, reactivates it when not `active`; otherwise creates one with `paymentId = synthetic_combo_<userId>`, plan price/currency, `status: "active"`, `metadata.source = "synthetic_mint_google_oauth"`.
5. **Combo invoice** (`Invoice`), looked up by `thirdPartyClientId` + `thirdPartyExternalId = combo_free_first_month_<userId>`. If present it is marked `paid`. Otherwise a `recurring`, `paid` invoice is created for the NC platform org/seller with one `third_party_subscription` line item priced at `productConfig.totalAmount` (in cents), GST from `calculateTaxAmounts(unitPriceCents, GST_CONFIG.rate)`, and a discount equal to price + tax so the total is $0. It sets `nextDueDate` 30 days out (`PERIOD_DAYS`), `commissionDistributed: true` (so no commission job picks it up) and metadata `kind: "combo_free_first_month"` plus GST details when tax > 0.
6. **NetworkChain subscription:** upserts into the raw collection `networkchain_subscriptions` (owned by NC's contacts-backend, which shares the same cluster) keyed by `userId`: on insert sets `orgId`, `priceCents: 4248` ($36 + 18% GST), `currentPeriodStart`; always sets `status: "active"`, `currentPeriodEnd` (+30 days); `$addToSet`s a $0 payment entry referencing the combo invoice.
7. Prints a summary of what the account now has.

Re-running for the same email is effectively a no-op apart from refreshing the NC subscription period and status.

## Exports
None. `run()` executes on load.

## Interfaces
- **Database (production):** `User` - read; `ThirdPartyClient` - read; Unilevel Plus plan - read via service; `UnilevelPlusPurchase` - create or update status; `Invoice` - create or mark paid; collection `networkchain_subscriptions` - upsert.
- **Environment variables:** `MONGODB_URI` - target database.

## Dependencies
- **Internal:** `server/models/user.model.ts`, `server/models/invoice.model.ts`, `server/models/thirdPartyClient.model.ts`, `server/models/unilevelPlusPurchase.model.ts` - models written/read; `server/services/unilevelPlusCommission.ts` - `getActiveUnilevelPlusPlan`; `server/utils/gstTax.ts` - `calculateTaxAmounts`, `GST_CONFIG` for the tax line.
- **Packages:** `mongoose` - connection, `Types.ObjectId`, raw collection; `dotenv` - loads `.env`.

## Used by
Nothing imports it. Run manually against the database.

## Notes
- Deliberately not created (per the header): the $25 UP "trigger" invoice, `UnilevelPlusDistribution` rows, and the outbound `invoice.paid` webhook to NC.
- `Invoice.create` bypasses `createInvoice()`, so fields it would compute (such as each line item's `totalPrice`) are set explicitly.
- The hardcoded `priceCents: 4248` and `PERIOD_DAYS = 30` must be kept in step with NC's pricing by hand.
- This produces an entitled account with no payment behind it; anyone using it gets real access.
