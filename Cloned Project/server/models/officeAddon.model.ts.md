# `server/models/officeAddon.model.ts`

> Mongoose model for purchasable office add-ons (White-Label, Cryptosub), together with their seed configuration, GST helpers and commission split.

**Kind:** Mongoose model · **Lines:** 172

## Purpose
An office (organization) can buy add-ons on top of its office plan. This file defines the `OfficeAddon` catalog document, the predefined add-on seeds in `OFFICE_ADDONS_CONFIG`, the GST constants and helpers used to price them, and the four-level referral commission split paid when an add-on sells. `initializeOfficeAddons()` in `server/services/officeAddonSubscription.ts` iterates `OFFICE_ADDONS_CONFIG` to create or refresh the add-on documents. When an add-on's amount changes, it creates a new Razorpay plan priced at the GST-inclusive total (`calculateAddonTaxAmounts`, `tax_inclusive: true`).

## How it works
### Schema (`OfficeAddonSchema`, L23-L92)
- `name` (required), `slug` (required, **unique**, lowercased), `description`.
- `amount` (required) - **base amount before tax**, in the smallest currency unit (`29900` = $299).
- `currency` (default `USD`), `period` (`monthly` | `yearly`, default `yearly`), `interval` (months, default 12).
- `features[]`, `razorpayPlanId` (indexed), `isActive` (default true).
- GST: `taxRate` (default 18), `taxInclusive` (schema default `false`), `sacCode` (default `998314`, the SAC code for IT/SaaS services).
- Timestamps on. Extra index `{ isActive: 1, slug: 1 }`.

### GST helpers (L94-L113)
- `ADDON_GST_CONFIG = { rate: 18, sacCode: "998314", taxInclusive: true }`. `taxInclusive: true` here means the amount passed to Razorpay already includes GST.
- `calculateAddonTaxAmounts(base, taxRate = 18)` returns `{ baseAmount, taxAmount = round(base * rate / 100), totalAmount = base + tax, taxRate }` (tax added on top).
- `extractAddonBaseFromTotal(total, taxRate = 18)` returns `{ baseAmount = round(total / (1 + rate/100)), taxAmount = total - base, totalAmount, taxRate }` (tax split out of a gross amount).
These duplicate `calculateTaxAmounts` / `extractBaseFromTotal` in `server/utils/gstTax.ts`.

### Seeds (`OFFICE_ADDONS_CONFIG`, L115-L162)
| Slug | Base amount | Period | Notes |
|---|---|---|---|
| `white-label` | 29900 ($299) | yearly, interval 12 | Remove Garage branding / custom branding. Example in comment: $299 + $53.82 GST = $352.82. |
| `cryptosub` | 60000 ($600) | yearly, interval 12 | Cryptobrand yearly subscription. Same commission shape as white-label (three-bucket split plus monthly volume bonus) but its own access gate, `hasActiveAddon(orgId, "cryptosub")`. Auto-provisioned alongside the Pro office plan for orgs with `officeCreatedFromCryptobrand === true` (see `server/services/cryptobrandOfficeBootstrap.ts`). |
Both use `ADDON_GST_CONFIG` for their tax fields.

### Commission (`ADDON_COMMISSION_STRUCTURE`, L164-L171)
Level 1: 15%, level 2: 10%, level 3: 2.5%, level 4: 2.5%, platform: 70%, all applied to the base amount. `officeAddonSubscription.ts` uses these percentages when it distributes commission on an add-on payment.

## Exports
- `OfficeAddon` - Mongoose model `"OfficeAddon"`.
- `IOfficeAddon` - interface.
- `ADDON_GST_CONFIG` - GST constants.
- `calculateAddonTaxAmounts(baseAmountPaise, taxRate?)` - add tax on top.
- `extractAddonBaseFromTotal(totalAmountPaise, taxRate?)` - split tax out.
- `OFFICE_ADDONS_CONFIG` - seed definitions keyed by slug.
- `ADDON_COMMISSION_STRUCTURE` - referral split percentages.

## Interfaces
- **Database:** `OfficeAddon` (collection `officeaddons`) - read; seeded/updated by the add-on subscription service.
- **External services:** Razorpay - `razorpayPlanId` points at a Razorpay subscription plan created from these seeds.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/officeAddonCheckout.ts` (mounted at `/checkout/office-addon`) and `server/routes/officeAddonStatus.ts` (mounted at `/office-addon-subscription`) - pricing with `calculateAddonTaxAmounts` and `ADDON_GST_CONFIG`.
- `server/services/officeAddonSubscription.ts`, `server/services/whitelabelAddonPurchase.ts`, `server/services/cryptosubAddonPurchase.ts`, `server/services/coupon.ts`.
- `server/routes/internal-catalog.ts`.
- Maintenance scripts (run by hand against the production database): `activate-whitelabel-manual.ts`, `audit-whitelabel-state.ts`, `deactivate-whitelabel-manual.ts`, `diagnose-whitelabel-commission.ts`, `latest-whitelabel-purchase.ts`, `revert-whitelabel-invoice.ts` under `server/scripts/`.

## Notes
- **Inconsistent `taxInclusive` meaning:** the schema default is `false` ("GST added on top of base amount"), but the seeds set `taxInclusive: true` via `ADDON_GST_CONFIG`, and the comments still say the seed `amount` is GST-exclusive. Callers in practice compute the total with `calculateAddonTaxAmounts` (tax on top). Check how a given caller reads the flag before relying on it.
- Parameter names say "paise" while amounts are USD cents; the arithmetic works the same for either unit.
- The commission split is hardcoded and duplicated in `OFFICE_COMMISSION_STRUCTURE` in `officePlan.model.ts`.
