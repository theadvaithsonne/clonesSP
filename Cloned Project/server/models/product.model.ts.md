# `server/models/product.model.ts`

> Mongoose model for a founder's sellable product (physical, digital or both), including the digital deliverables, detail-page content, private-offer roster, subscription settings and post-purchase email/thank-you configuration.

**Kind:** Mongoose model · **Lines:** 411

## Purpose
`Product` is one of the core "sellables" in Garage (alongside courses, services, channels/communities, workshops and live streams). Every product belongs to an organisation and is created by a user (the founder). The model backs the product catalogue, the product detail page, product checkout, coupons/affiliate commissions, invoices and the BAT246 game (which sells its board entries as a product). Because it is a catalogue model it also mirrors every change to the external NetworkChainApi through the catalogue outbox.

## How it works

### Sub-schemas (all embedded with `_id: false`)
- **`DigitalAssetSchema`** - an uploaded file delivered after purchase: `name`, `fileUrl`, `fileType` (required) and optional `fileSize`. Has its own `_id` field defaulting to a fresh `ObjectId` even though Mongoose's automatic `_id` is disabled, so assets can be addressed individually.
- **`DigitalLinkSchema`** - a link delivered after purchase: `label`, `url`, optional `description`, and `linkType` (`"static"` | `"dynamic"`, default `"static"`). Also has an explicit `_id`.
- **`KeyFeatureSchema`** (`icon`, `title`, `description`), **`WhatsInsideGroupSchema`** (`icon`, `title`, `items[]`), **`FaqSchema`** (`question`, `answer`) and **`ProductDetailSchema`** (`label`, `value`) - content blocks for the product detail page.
- **`ProductReviewSchema`** - legacy embedded reviews (`reviewerName`, optional role/avatar, `rating` 1-5, `text`, `helpfulCount`, `createdAt`) with an explicit `_id`. Real buyer reviews live in the separate `Review` model (`review.model.ts`).
- The thank-you page sub-schema comes from `thankYouPage.schema.ts` and is shared with courses.

### Main fields (`ProductSchema`, `timestamps: true`)
- **Ownership:** `organizationId` (ref `Organization`, required, indexed), `createdBy` (ref `User`, required).
- **Identity:** `name`, `slug` (lower-cased), `sku` (all required), `description`.
- **Pricing:** `price` (>= 0, required), `currency` (`"INR"` | `"USD"`, default `"USD"`), `gstInclusive` (default `true` - listed price already includes 18% GST for INR), `requireIosPayment` and `appleFeeInclusive` (default `false`; the comments say these stay dormant until iOS payments are wired).
- **Inventory:** `trackQuantity` (default `false`), `quantity`, `lowStockThreshold`.
- **Media/catalogue:** `images[]`, `videos[]`, `youtubeLink`, `categoryName`, `tags[]`.
- **Delivery:** `isDigital` (default `false`), `requiresShipping` (default `true`), `deliveryMethod` (`"physical"` | `"digital"` | `"both"`, default `"physical"`), `digitalAssets[]`, `digitalLinks[]`.
- **Visibility:** `channelIds[]` (ref `Channel`) - which communities show the product; `allowedUserIds[]` (ref `User`) - private one-time offer roster (see Notes); `status` (`"active"` | `"draft"` | `"archived"`, default `"draft"`).
- **Subscription:** `isSubscription` (default `false`), `subscriptionPeriod` (`"weekly"` | `"monthly"` | `"quarterly"` | `"yearly"`).
- **Emails:** `emailAlerts` (buyer order email; field definition from `emailAlerts.schema.ts` - `enabled`, `templateId`, `templateName`, `templateHtml`, `syncedAt`) and `founderAlerts` (seller "someone bought this" alert from `founderAlerts.schema.ts` - `enabled`, `recipients[]`).
- **Detail page:** `rating` (0-5), `ratingCount`, `downloadCount` (default 0), `whatsIncluded[]`, `keyFeatures[]`, `whatsInside[]`, `reviews[]`, `faqs[]`, `productDetails[]`, `thankYouPage`. The array blocks and `thankYouPage` default to `undefined`, so they are absent from the document until a founder fills them in.

### Indexes
- `{ organizationId, slug }` unique - slugs are unique per organisation.
- `{ organizationId, sku }` unique - SKUs are unique per organisation.
- `{ organizationId, status }` - status filtering.
- `{ organizationId, allowedUserIds }` - multikey index for the private-offer visibility filter.

### Catalogue sync
`installCatalogHooks(ProductSchema, "product")` registers post-hooks on `save`, `findOneAndUpdate`, `findOneAndDelete` and document `deleteOne` that enqueue an upsert/delete on the `CatalogOutbox`, which is later drained and POSTed to NetworkChainApi. `updateOne`/`updateMany` are not hooked (the hooks file relies on an hourly reconciler for those).

## Exports
- `Product` - the Mongoose model (`mongoose.model<IProduct>("Product", ProductSchema)`), collection `products`.
- `IProduct` - document interface for the model.
- `IDigitalAsset`, `IDigitalLink`, `IKeyFeature`, `IWhatsInsideGroup`, `IProductReview`, `IFaq`, `IProductDetail` - sub-document interfaces.
- `IThankYouPage`, `IThankYouPageSection` (type re-exports) - kept here so older `import { IThankYouPage } from "../models/product.model"` call sites still work; canonical home is `thankYouPage.schema.ts`.
- `IProductEmailAlerts` - deprecated alias of `IEmailAlerts`.

## Interfaces
- **Database:** `Product` (collection `products`) - defines the schema; writes also enqueue `CatalogOutbox` entries via the catalogue hooks.
- **External services:** NetworkChainApi, indirectly through the catalogue outbox. Network Mail templates are snapshotted into `emailAlerts.templateHtml` by the frontend because that service authenticates with the browser JWT and cannot be called at send time.

## Dependencies
- **Internal:** `server/models/_catalogHooks.ts` - outbox mirroring hooks; `server/models/emailAlerts.schema.ts` - buyer email field; `server/models/founderAlerts.schema.ts` - founder alert field; `server/models/thankYouPage.schema.ts` - thank-you page sub-schema and types.
- **Packages:** `mongoose` - schema and model.

## Used by
`server/routes/product.ts`, `server/routes/productCheckout.ts`, `server/services/product.ts`, `server/routes/public.ts`, `server/routes/feed.ts`, `server/routes/affiliate.ts`, `server/routes/auction.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, `server/controllers/garageAdmin.controller.ts`, the BAT246 services (`bat246Admin`, `bat246BoardInvite`, `bat246Entry`, `bat246Layaway`, `bat246Leaderboard`, `bat246LostMoneyAutoPay`, `bat246MembershipBilling`, `bat246PodInvite`, `bat246Wallet.util`), `server/bat246/routes/bat246.routes.ts`, several BAT246 seed/fix scripts, and 26 more (51 importers in total, including invoice, coupon, review, order-email and catalogue-sync code).

## Notes
- **Private one-time offers:** when `allowedUserIds` is non-empty only those users see the product and each may buy it only once; after payment it disappears from that user's catalogue (filtering happens in `getAvailableProducts` in `server/services/product.ts`). The array is never mutated on purchase - it stays as the founder's original roster. `server/services/product.ts` rejects combining a non-empty roster with `isSubscription`.
- The import graph lists this file as importing itself; there is no such import in the source (the only self-reference is the re-export of thank-you page types).
- `void _ThankYouPageSectionSchema;` exists only to keep the section schema import from being stripped by the linter/compiler.
