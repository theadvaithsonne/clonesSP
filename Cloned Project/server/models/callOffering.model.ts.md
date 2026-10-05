# `server/models/callOffering.model.ts`

> Mongoose model for a sellable 1:1 call product that a founder publishes (price per call, duration, intake questions and detail-page content).

**Kind:** Mongoose model · **Lines:** 206

## Purpose
"Calls" are one of Garage's sellable item types alongside products, courses, channels, workshops and services. A founder creates a `CallOffering`; buyers purchase one or more calls (`CallPurchase`) and then book slots (`CallBooking`). Because it is a catalog item, every save is mirrored to the external NetworkChain catalog through the outbox hooks installed at the bottom of the file.

## How it works

### Sub-schemas
- `IntakeQuestionSchema` (keeps `_id`): `question`, `answerType` (`text` or `file`; file uploads are jpg/pdf per the comment), `isRequired`, `order`. Buyers answer these at purchase; the answers are stored on `CallPurchase.intakeAnswers` with the question `_id`.
- `CallTopicSchema` (`title`, `description`), `CallHowItWorksSchema` (`icon`, `title`, `description`) and `CallFaqSchema` (`question`, `answer`), all without `_id`, power the public detail page.

### Main fields
- `title` (required), `description`, `coverImage`.
- **Pricing:** `pricePerCall` (default 0, min 0), `currency` (`INR` or `USD`, default `USD`), `isFree` (default `true`).
- **Call:** `duration` in minutes (default 30, min 5).
- **Ownership:** `organizationId` (`Organization`) and `createdBy` (`User`), required and indexed.
- `channelIds` - optional `Channel` associations.
- `intakeQuestions` - array of the sub-schema above.
- `status`: `draft` (default), `published`, `archived`.
- **Stats counters:** `totalPurchased`, `totalUsed`, `totalScheduled`, `purchaseCount`, `averageRating` (1-5), `reviewCount`.
- **Detail page:** `whatsIncluded`, `topicsWeCover`, `howItWorks`, `faqs` (all `default: undefined`, so absent until set).

### Hooks and indexes
- Indexes: `{ organizationId, status }`, `{ createdBy, status }`, `{ channelIds }`.
- `pre("save")` forces `isFree = (pricePerCall === 0)`. Updates through `findByIdAndUpdate` skip this hook; `server/services/call.ts` sets `isFree` itself in those paths.
- `installCatalogHooks(CallOfferingSchema, "call")` adds post-hooks on `save`, `findOneAndUpdate`, `findOneAndDelete` and document `deleteOne` that enqueue a `CatalogOutbox` row (`itemType: "call"`), later POSTed to NetworkChainApi by the dispatcher.

Collection: Mongoose default, `callofferings`.

## Exports
- `CallOffering` - the model.
- `interface ICallOffering` - document type.
- `interface IIntakeQuestion`, `ICallTopic`, `ICallHowItWorks`, `ICallFaq` - sub-document types.

## Interfaces
- **Database:** `CallOffering` (collection `callofferings`) - CRUD in `server/services/call.ts` / `server/routes/call.ts` (mounted at `/calls`); stats updated from `server/routes/callBooking.ts`; read during checkout (`server/routes/callCheckout.ts`), coupons and cashback (`founderCouponItems`, `founderCouponRules`, `services/couponRule.ts`, `services/cashbackCode.ts`), affiliate analytics, reviews, the public storefront (`server/routes/public.ts`), unified orders, the admin back-office (`garageAdmin.controller.ts`) and the internal catalog feed (`server/routes/internal-catalog.ts`). Writes also produce `CatalogOutbox` rows via the hooks.

## Dependencies
- **Internal:** `server/models/_catalogHooks.ts` - `installCatalogHooks` for NetworkChain catalog sync.
- **Packages:** `mongoose` - schema, model, types.

## Used by
`server/controllers/garageAdmin.controller.ts`, `server/routes/affiliate.ts`, `server/routes/call.ts`, `server/routes/callBooking.ts`, `server/routes/callCheckout.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, `server/routes/internal-catalog.ts`, `server/routes/public.ts`, `server/routes/unifiedOrders.ts`, `server/scripts/add-catalog-sync-indexes.ts`, `server/scripts/backfill-catalog-outbox.ts`, `server/services/affiliateAnalyticsDetail.ts`, `server/services/affiliateTransactionDetail.ts`, `server/services/call.ts`, `server/services/cashbackCode.ts`, `server/services/couponRule.ts`, `server/services/itemReserveLicense.ts`, `server/services/review.ts`.

## Notes
- Counter updates such as `$inc: { totalUsed: 1 }` go through `findByIdAndUpdate`, which fires the `findOneAndUpdate` catalog hook, so stats changes also enqueue catalog syncs (they collapse into one pending outbox row per item).
- `CallPurchase.currency` defaults to `INR` while `CallOffering.currency` defaults to `USD`; callers should copy the offering's currency explicitly.
