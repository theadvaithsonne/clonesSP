# `server/models/course.model.ts`

> Mongoose model for an organisation's online course: catalogue/pricing data, the section-chapter curriculum (video, link, text, quiz, PDF, JSON lessons), downloadable assets and detail-page content.

**Kind:** Mongoose model · **Lines:** 420

## Purpose
Courses are one of Garage's sellable catalogue items, alongside channels, workshops, products and others. Founders build them in the dashboard, publish them, and sell them one-off or by subscription; buyers enrol (see `CourseEnrollment`) and work through chapters in the learning player. Because courses are part of the shared catalogue, every change is also mirrored to the external NetworkChain catalogue through `installCatalogHooks`. With 31 importers this is one of the most widely used models in the backend.

## How it works
### Curriculum (nested sub-schemas)
- **`SectionSchema`** (own `_id`): `title`, `order`, `chapters[]`.
- **`ChapterSchema`** (own `_id`): `title`, `order`, `contentType` (`video` default, `link`, `text`, `quiz`, `pdf`, `json`) and the matching payload fields: `videoUrl` (YouTube/Vimeo/direct) or `videoS3Key` (uploaded), `linkUrl`, rich-text `content`, `duration` (seconds), `quiz`, `pdfUrl`/`pdfS3Key`, `pdfs[]` and `jsonFiles[]` (both use `ChapterPdfSchema`: `name`, `url`, `s3Key`, `fileSize`).
- **`QuizSchema`** (embedded on quiz chapters, no `_id`): `questions[]`, `passingScore` (percent, default 70), `isRequired` (must pass to complete the chapter), `shuffleQuestions`, `shuffleOptions`.
- **`QuizQuestionSchema`** (own `_id`): `questionText`, `questionType` (`mcq_single` default, `mcq_multi`, `true_false`), `options[]` (`text`, `isCorrect`), `explanation`, `points` (default 1), `relatedChapterId` (the chapter it tests, used for a "go back and review" link).

### Course document (`CourseSchema`)
- **Catalogue:** `title` (required), `description`, `coverImage`, `galleryImages`, promo `videoUrl` / `videoFile`, `status` (`draft` default, `published`, `archived`).
- **Ownership:** `organizationId` (ref `Organization`, required) and `createdBy` (founder, ref `User`, required); optional `channelIds[]` (ref `Channel`) for channel-specific courses.
- **Pricing:** `isPaid` (default false), `isFree` (default true), `price` (default 0), `currency` (`INR` or `USD`, default `USD`).
- **Tax and iOS:** `gstInclusive` (default **true**: listed INR price already includes 18% GST), `requireIosPayment`, `appleFeeInclusive` (Apple fee only applies if checkout sets the payment source to iOS) - same trio as channels and workshops.
- **Subscription:** `isSubscription`, `subscriptionPeriod` (`weekly`, `monthly`, `quarterly`, `yearly`).
- **Alerts:** `emailAlerts` (from `emailAlerts.schema.ts`: `enabled`, Network Mail `templateId`/`templateName`, snapshotted `templateHtml`, `syncedAt`; the post-purchase email sent to the buyer) and `founderAlerts` (from `founderAlerts.schema.ts`: `enabled` and extra `recipients`; the "someone enrolled" email to the founder, sent by `server/services/founderAlertEmail.ts`).
- **Content:** `sections[]`, `digitalAssets[]` (`name`, `url`, `fileType`, `fileSize`).
- **Stats:** `totalDuration` (seconds), `totalChapters`, `enrolledStudents`.
- **Detail page:** `rating` (0-5), `ratingCount`, `whatYouWillLearn[]`, `requirements[]`, `courseIncludes[]` (`icon`, `text`), `reviews[]` (founder-curated `CourseReviewSchema`: `reviewerName`, `reviewerRole`, `reviewerAvatar`, `rating` 1-5, `text`, `helpfulCount`, `createdAt`). These arrays default to `undefined` so they are not stored until set.
- **Thank-you page:** `thankYouPage` (`ThankYouPageSchema`: `autoRedirect` + `redirectUrl`, or a manual `title`, `message` and CTA `sections`), shown to the buyer after payment; the same shape as products, rendered by the item-agnostic frontend card.
- `timestamps: true`.

### Hooks and indexes
- **`pre("save")`** recomputes `totalChapters` (count of all chapters) and `totalDuration` (sum of chapter `duration`s) from `sections`.
- **`installCatalogHooks(CourseSchema, "course")`** (from `_catalogHooks.ts`) adds post hooks on `save`, `findOneAndUpdate`, `findOneAndDelete` and document `deleteOne` that enqueue an upsert/delete on the `CatalogOutbox`; a dispatcher later signs and POSTs those changes to the NetworkChain API.
- Indexes: `{organizationId, status}`, `{createdBy, status}`, `{channelIds}`, plus single-field indexes on `organizationId` and `createdBy`.

## Exports
- `Course` - Mongoose model (`"Course"`, collection `courses`).
- `ICourse` - course document interface.
- `ISection`, `IChapter`, `IChapterPdf`, `IQuiz`, `IQuizQuestion`, `IQuizOption`, `IDigitalAsset`, `ICourseInclude`, `ICourseReview` - sub-document interfaces.

## Interfaces
- **Database:** `Course` (collection `courses`) - read/write; refs `Organization`, `User`, `Channel`. Writes also enqueue `CatalogOutbox` rows via the catalog hooks.
- **External services:** indirectly, the NetworkChain catalogue API (through the outbox dispatcher); chapter files live in AWS S3 (`videoS3Key`, `pdfS3Key`, `s3Key`).

## Dependencies
- **Internal:** `server/models/_catalogHooks.ts` - catalogue mirror hooks; `server/models/emailAlerts.schema.ts`, `server/models/founderAlerts.schema.ts`, `server/models/thankYouPage.schema.ts` - shared sub-schemas reused by other sellable items.
- **Packages:** `mongoose`.

## Used by
`server/routes/course.ts` (mounted at `/courses`, browser `/backend/courses`), `server/routes/courseVideo.ts` (`/courses/video`), `server/routes/courseCheckout.ts` (`/checkout`), `server/routes/learnInit.ts` (`/learn`), `server/routes/public.ts` (`/public`), `server/controllers/garageAdmin.controller.ts`, `server/routes/affiliate.ts`, `server/routes/feed.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, `server/routes/founderPlatformCoupons.ts`, `server/routes/gstQuote.ts`, `server/routes/guestAuth.ts`, `server/routes/internal-catalog.ts`, `server/routes/invoice.ts`, `server/routes/unifiedOrders.ts`, `server/services/affiliateAnalyticsDetail.ts`, `server/services/affiliateTransactionDetail.ts`, `server/services/cashbackCode.ts`, `server/services/coupon.ts`, `server/services/couponRule.ts`, `server/services/course.ts`, `server/services/founderAlertEmail.ts`, and the manual scripts `server/scripts/add-catalog-sync-indexes.ts` and `server/scripts/backfill-catalog-outbox.ts`, and 6 more.

## Notes
- `totalChapters` / `totalDuration` are only recomputed on `document.save()`. Updates through `updateOne` / `findOneAndUpdate` leave them stale unless the caller sets them.
- Catalog hooks do not fire for `updateOne` / `updateMany` / `deleteMany`; per `_catalogHooks.ts`, an hourly reconciler covers those paths.
- `isPaid` and `isFree` are independent booleans that must be kept consistent by callers (defaults: free, price 0).
- Large courses keep the whole curriculum, including quiz answers (`isCorrect`), in one document; routes serving learners must strip answers before sending.
