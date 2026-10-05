# `server/models/productVariant.model.ts`

> Mongoose mirror of the `productvariants` collection owned by the separate storefront backend, used so checkout reads a variant's real price and stock.

**Kind:** Mongoose model · **Lines:** 58

## Purpose
The storefront (store products, collection `storeproducts`) is owned by another backend but shares the same MongoDB. Products with variants keep their real price and stock on one `productvariants` document per variant, keyed to the parent store product through `productId`. The parent store product's `price`/`quantity` are **not** kept in sync with its variants (the parent quantity is only the default seeded onto new variant rows), so this backend must read the variant whenever a line item carries a `variantId`.

## How it works
- Fields consumed here: `productId` (required, indexed; points at `storeproducts._id`), `orgId` (indexed), `title`, `sku`, `price` (required), `compareAtPrice`, `trackInventory`, `quantity`, `image`, `isActive`, plus `timestamps`.
- Schema options: `collection: "productvariants"` (explicit, to match the storefront's collection), `strict: false` so any other fields the storefront stores pass through untouched, and `timestamps: true`.
- Prices are in **main currency units** (for example `0.10` USD), the same convention as the store product.
- The model is mostly read-only. The one write is the inventory decrement on purchase during invoice fulfilment (`findOneAndUpdate` in `server/services/invoice.ts`), mirroring how the parent store product is written.

## Exports
- `ProductVariant` - model `"ProductVariant"` bound to collection `productvariants`.
- `IProductVariant` - document interface.

## Interfaces
- **Database:** `ProductVariant` (collection `productvariants`, shared with the storefront backend) - read for pricing/stock, written only to decrement `quantity` on purchase.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
`server/services/ecommerceInvoice.ts` (reads variant price/stock when building e-commerce invoices), `server/services/invoice.ts` (lazy-imported for the stock decrement), `server/services/downlineMemberPurchases.ts` (uses `ProductVariant.collection.name` in an aggregation `$lookup`).

## Notes
- `ProductOrder.items[].variantId` also references `"ProductVariant"`, but that order model is for founder `Product`s; store-product variants are the main consumer of this collection.
- Because `strict: false` is set, writes through this model can add arbitrary fields to a collection owned by another service - keep writes limited to the stock decrement.
