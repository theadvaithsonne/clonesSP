# `server/models/storeProduct.model.ts`

> Mongoose mirror of the `storeproducts` collection owned by the external storefront backend, typed for checkout, invoicing, tax and catalog-sync use.

**Kind:** Mongoose model · **Lines:** 110

## Purpose
Store products (the e-commerce storefront catalogue) are written by a separate storefront service (garage-store-backend) that shares this MongoDB database. This backend reads them for checkout, invoices, affiliate links, coupon rules, auction settlement and similar flows. Only the fields it consumes are declared. `strict: false` passes every other storefront field through.

## How it works
- **Price units:** `price` (and `compareAtPrice`) are stored in **main units** (for example 29.99 USD), not in the smallest-unit (cents/paise) convention the `Invoice` model uses. Code converts to the smallest unit when it builds invoice line items.
- **Tax flags** (owned by the storefront):
  - `gstInclusive: true` means the listed price already includes GST, which has to be extracted.
  - `gstInclusive: false` or absent means the price is pre-tax and GST is added on top. Absent is read as falsy, matching legacy sellable flows.
  - `taxable: false` means the product is never taxed, whatever the buyer's region.
  - Neither flag has a default, on purpose. The storefront's defaults are the source of truth.
- `status` is typed `"active" | "archived" | "draft"` and defaults to `"active"`.
- `images` is an array of `{ url (required), altText?, position? }` subdocuments with no `_id` and `strict: false`.
- `orgId` is required and indexed. `title` and `price` are required. `timestamps: true`.
- **Catalog hooks:** `installCatalogHooks(StoreProductSchema, "storeproduct")` adds post-save, findOneAndUpdate and delete hooks that queue a `CatalogOutbox` entry. The dispatcher (`catalogOutbox.dispatcher.ts`) sends these to NetworkChainApi (the EarnGPT catalog index). The storefront's own writes do not go through Mongoose here. They reach the outbox through `POST /internal/catalog/notify`. These hooks therefore only catch this backend's own writes, such as the inventory decrement on purchase.

### Declared fields
`orgId`, `title`, `slug`, `description`, `vendor`, `productType`, `status`, `tags[]`, `price`, `compareAtPrice`, `sku`, `trackInventory`, `quantity`, `requiresShipping`, `isPhysicalProduct`, `hasVariants`, `images[]`, `featuredImage`, `category` (ObjectId), `publishedAt`, `gstInclusive`, `taxable`, `createdAt`, `updatedAt`.

## Exports
- `StoreProduct` - Mongoose model `"StoreProduct"` bound to collection `storeproducts`.
- `IStoreProduct` - document interface (fields above).
- `IStoreProductImage` - `{ url, altText?, position? }`.

## Interfaces
- **Database:** `StoreProduct` (collection `storeproducts`). Mostly read. Some backend paths write to it, for example inventory changes. Saves and findOneAndUpdate calls trigger catalog outbox inserts.
- **Background work:** indirectly, through `CatalogOutbox` entries drained by the catalog outbox dispatcher.

## Dependencies
- **Internal:** `server/models/_catalogHooks.ts` - `installCatalogHooks` for catalog change events.
- **Packages:** `mongoose`.

## Used by
`server/realtime/mediasoupHandlers.ts`, `server/routes/affiliate.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, `server/routes/founderStoreCommissions.ts`, `server/routes/garageAdminAuctionSettlements.ts`, `server/routes/internal-catalog.ts`, `server/scripts/diagnoseAuctionSettlement.ts`, `server/services/auctionSettlement.ts`, `server/services/auctionWallet.ts`, `server/services/cashbackCode.ts`, `server/services/ecommerceInvoice.ts`, `server/services/invoice.ts`, `server/services/sellables.ts`, `server/services/storeCouponCommission.ts`.

## Notes
- The header comment calls this a "read-only mirror", but backend writes do happen (see catalog hooks). Treat the storefront as the owner and keep local writes minimal.
- `updateOne` / `updateMany` writes are not captured by the catalog hooks (see `_catalogHooks.ts`). The hourly reconciler covers them.
- Mixing up main units and smallest units is the most likely source of pricing bugs with this model.
