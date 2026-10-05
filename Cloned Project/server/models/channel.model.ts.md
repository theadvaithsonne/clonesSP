# `server/models/channel.model.ts`

> Mongoose model `Channel` (collection `channels`) with 34 top-level fields.

**Kind:** Mongoose model · **Lines:** 168

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `Channel`

- **Collection:** `channels` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `title` | `String` | required |
| `description` | `String` | — |
| `price` | `Number` | required, default 0 |
| `currency` | `String` | default "USD" |
| `coverImage` | `String` | — |
| `galleryImages` | `[String]` | default undefined |
| `videoUrl` | `String` | trim |
| `videoFile` | `String` | trim |
| `shareLink` | `String` | — |
| `whoCanPost` | `String` | default "everyone", enum ["everyone", "admins_only"] |
| `gstInclusive` | `Boolean` | default true |
| `requireIosPayment` | `Boolean` | default false |
| `appleFeeInclusive` | `Boolean` | default false |
| `isActive` | `Boolean` | default true |
| `isFree` | `Boolean` | default true |
| `isSubscription` | `Boolean` | default false |
| `subscriptionPeriod` | `String` | enum ["weekly", "monthly", "quarterly", "yearly"] |
| `subscriptionInterval` | `Number` | — |
| `allowPayWhatYouWant` | `Boolean` | default false |
| `isDefault` | `Boolean` | default false |
| `mandatoryOnJoin` | `Boolean` | index, default false |
| `combPlanId` | `Schema.Types.ObjectId` | — |
| `storeId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `createdBy` | `Schema.Types.ObjectId` | required, ref "User" |
| `emailAlerts` | `emailAlertsSchemaField` | — |
| `founderAlerts` | `founderAlertsSchemaField` | — |
| `thankYouPage` | `ThankYouPageSchema` | default undefined |
| `rating` | `Number` | — |
| `ratingCount` | `Number` | default 0 |
| `aboutText` | `String` | trim |
| `whatsIncluded` | `[String]` | default undefined |
| `benefits` | `[ChannelBenefitSchema]` | default undefined |
| `reviews` | `[ChannelReviewSchema]` | default undefined |
| `faqs` | `[ChannelFaqSchema]` | default undefined |

### Indexes

- `{ storeId: 1, title: 1 }` (L157)
- `{ storeId: 1, isActive: 1 }` (L158)
- `{ storeId: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } }` (L160)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IChannelBenefit` | interface |  | 8 |
| `IChannelReview` | interface |  | 14 |
| `IChannelFaq` | interface |  | 25 |
| `Channel` | model | `model("Channel", ChannelSchema)` | 167 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/_catalogHooks.ts` — `installCatalogHooks`
  - `server/models/emailAlerts.schema.ts` — `emailAlertsSchemaField`
  - `server/models/founderAlerts.schema.ts` — `founderAlertsSchemaField`
  - `server/models/thankYouPage.schema.ts` — `ThankYouPageSchema`
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/affiliate.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/feed.ts`
- `server/routes/founderCouponItems.ts`
- `server/routes/founderCouponRules.ts`
- `server/routes/founderPlatformCoupons.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/routes/gstQuote.ts`
- `server/routes/guestAuth.ts`
- `server/routes/internal-catalog.ts`
- `server/routes/invoice.ts`
- `server/routes/productCheckout.ts`
- `server/routes/public.ts`
- `server/routes/publicMeet.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/subscriptions.ts`
- `server/routes/unifiedOrders.ts`
- `server/routes/workshopCheckout.ts`
- `server/routes/workshopPreview.ts`
- `server/scripts/add-catalog-sync-indexes.ts`
- `server/scripts/backfill-catalog-outbox.ts`
- `server/scripts/backfill-channel-members.ts`
- _…and 17 more_
