# `server/models/workshop.model.ts`

> Mongoose model for a Workshop: the live stream / webinar product (one-off or recurring, free or paid, live or evergreen) that founders create, sell and host.

**Kind:** Mongoose model · **Lines:** 504

## Purpose
"Workshop" is the backend name for what the UI variously calls a live stream, webinar or workshop. A document holds everything about one: schedule and recurrence, pricing and payment options, the sales/detail-page content, recording behaviour, evergreen (pre-recorded) playback, simulated audience settings, alerts, speakers and soft-delete state. Registrations (`workshopRegistration.model.ts`) and per-session edits/events (`workshopSessionOverride.model.ts`) hang off it by `workshopId`. It is one of the catalog models mirrored to the external NetworkChain API through catalog hooks.

## How it works
### Core and scheduling (L219-L333)
- `title` (required, max 200), `description`, `thumbnail`, `galleryImages`, `videoUrl`, `videoFile`.
- `totalViews` - cumulative watch-starts across every live session (previews and joins both count, once per watching session); incremented from `server/realtime/socket.ts`.
- `date` (required, indexed), `startTime` / `endTime` (required `HH:mm`, regex-validated), `timezone` (default `"Asia/Kolkata"`).
- `meetingUrl`, `meetingId`, `meetingPassword`, `maxParticipants` (min 1, default 300).
- `channelIds` (refs `Channel`) - communities the workshop is attached to; `orgId` (required, indexed, ref `Organization`); `createdBy` (required, ref `User`).
- `speakers` (refs `User`) - office members billed as speakers on the webinar page. Display only: being listed grants no seat in the room.
- `isActive` (default true, indexed).

### Pricing and checkout options
`isFree` (default true), `price` (min 0), `currency` (`INR` | `USD`, default `USD`), `gstInclusive` (default true), `requireIosPayment` and `appleFeeInclusive` (default false). `isSubscription` + `subscriptionPeriod` (`weekly | monthly | quarterly | yearly`) support recurring billing for recurring workshops.

### Alerts
- `emailAlerts` - buyer-facing post-registration email config (shape from `emailAlerts.schema.ts`: `enabled`, Network Mail `templateId` / `templateName` / `templateHtml`, `syncedAt`). Sent by `services/orderEmail.ts` on free registration and paid checkout.
- `founderAlerts` - host-facing "notify me when someone registers" (`enabled`, extra `recipients`), from `founderAlerts.schema.ts`.

### Recurrence (L334-L402)
- `isRecurring` (indexed), `recurrencePattern`, `recurrenceStartDate` (indexed), `recurrenceEndDate`, `isRecurrenceActive` (default true).
- `recurrencePattern.type` is `daily`, `weekly` or `monthly`. `excludedDays` (0-6) applies to daily. Weekly/monthly originally used a single `dayOfWeek` (0-6) / `dayOfMonth` (1-31). Multi-day support added `daysOfWeek[]` / `daysOfMonth[]`: when present they **win** over the singular field, and the singular field is still written (as the earliest selected day) so older readers resolve to a real session day. Absent arrays mean the legacy singular fields are read as before, so no migration was needed.
- `recurrenceEndDate` - required for `per_session` series at create/update (enforced in route code, not here); legacy unbounded `per_session` series are capped by the sessions endpoint's 500-session limit.
- `enrollmentType` - `once` (default, one enrolment covers the series) or `per_session` (buy each session). Note registrations use `full` / `session` for the same idea.
- `currentSessionDate` - the recurring session the host most recently started streaming, rotated by the generate-meeting flow; the webinar join gate uses it to deny attendees enrolled for a different session.
- Actual sessions are computed from this pattern (see `utils/recurrence.ts`); per-session changes live in `WorkshopSessionOverride`.

### Recording
`recordingMode` - `manual` (default) or `automatic`. The host is not prompted; the webinar page applies this setting on join.

### Simulated audience (L408-L424)
`simulatedAudience` - fabricated attendees and chat shown alongside real ones, for live and evergreen webinars: `enabled`, `people[]` (`name`, max 80), `chat[]` (`atSec` seconds after the host actually starts, `name`, `message` max 500), and `viewers` (`enabled`, `peak`). Managed via `server/routes/simulatedAudience.ts`.

### Evergreen (L425-L457)
`evergreen` - pre-recorded video played on the workshop's schedule. Purely additive: `enabled` defaults false and every consumer branches on it, so a workshop without it takes the normal live path. The playback clock runs on the server (`/evergreen-state` in `routes/publicWebinar.ts`); nothing here is trusted from the client.
- `source` (`upload` | `recording`), `videoUrl`, `videoS3Key` (kept so the S3 object can be deleted when replaced).
- `durationSec` (min 1) - needed whenever enabled, because without it the clock cannot tell when a session has ended.
- `joinWindowMin` - late-join cutoff in minutes; `null` = joinable for the whole run.
- `loop` (default true) - repeat the video across the whole scheduled slot. The clock reads `loop !== false`, so workshops configured before the field existed loop too.
- `simulatedChat[]` - host-authored lines replayed off the same clock so every viewer sees the same backlog; `simulatedViewers` (`enabled`, `peak`).
Set up through `server/routes/evergreen.ts` (upload or from a recording).

### Detail / sales page content (L467-L482)
`rating`, `ratingCount`, `aboutText`, `learningPoints`, `agenda[]` (`title`, `duration`, `topics[]`), `bonuses[]` (`icon`, `title`, `description`), `reviews[]` (each with its own `_id`, `reviewerName`, optional role/avatar, `rating` 1-5, `text`, `helpfulCount`, `createdAt`), `faqs[]`, `requirements`, `whatsIncluded`, `hostRating`, `hostStudents`, `hostWebinars`, `hostExperience`. Array fields default to `undefined` so they are not stored until set.

### Soft delete
`deletedAt` (indexed) puts the workshop in Trash; `restoredAt > deletedAt` means restored. The derivation lives in `utils/workshopStatus.ts`.

### Indexes and hooks (L489-L501)
Compound indexes: `{orgId, date, isActive}`, `{orgId, channelIds, date}`, `{createdBy, date}`, `{orgId, isRecurring, isRecurrenceActive, isActive}`. `installCatalogHooks(WorkshopSchema, "workshop")` adds post-save / findOneAndUpdate / delete hooks that enqueue a change on the `CatalogOutbox`, which a dispatcher later signs and POSTs to the NetworkChain API. `timestamps: true`.

## Exports
- `Workshop` - the Mongoose model (`model<IWorkshop>("Workshop", ...)`).
- `IWorkshop` - document interface.
- `IWorkshopAgendaItem`, `IWorkshopBonus`, `IWorkshopReview`, `IWorkshopFaq` - sub-document interfaces for the detail page.
- `IRecurrencePattern` - recurrence rule interface.

## Interfaces
- **Database:** `Workshop` (collection `workshops`) - defines the schema; references `Channel`, `Organization`, `User`. Writes to `CatalogOutbox` indirectly via the catalog hooks.
- **External services:** NetworkChain API (catalog mirror, via the outbox dispatcher); AWS S3 holds evergreen videos referenced by `videoS3Key`.

## Dependencies
- **Internal:** `server/models/_catalogHooks.ts` - catalog change hooks; `server/models/emailAlerts.schema.ts` - `emailAlerts` field definition and type; `server/models/founderAlerts.schema.ts` - `founderAlerts` field definition and type.
- **Packages:** `mongoose` - schema and model.

## Used by
`server/controllers/garageAdmin.controller.ts`, `server/realtime/mediasoupHandlers.ts`, `server/realtime/socket.ts`, `server/realtime/webinarEnd.ts`, `server/routes/affiliate.ts`, `server/routes/evergreen.ts`, `server/routes/feed.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, `server/routes/founderPlatformCoupons.ts`, `server/routes/gstQuote.ts`, `server/routes/guestAuth.ts`, `server/routes/internal-catalog.ts`, `server/routes/learnInit.ts`, `server/routes/livekitRecording.ts`, `server/routes/public.ts`, `server/routes/publicMeet.ts`, `server/routes/publicWebinar.ts`, `server/routes/simulatedAudience.ts`, `server/routes/unifiedOrders.ts`, `server/routes/webinarRoutes.ts`, `server/routes/workshop.ts`, `server/routes/workshopCheckout.ts`, `server/routes/workshopPreview.ts`, `server/scripts/add-catalog-sync-indexes.ts`, and 23 more.

## Notes
- The evergreen comment refers to a `validateEvergreen` check that refuses to enable evergreen without `durationSec`; no function by that name exists in `server/` today, so check the evergreen routes for the actual validation.
- `updateOne` / `updateMany` writes are not caught by the catalog hooks (they receive no document); per `_catalogHooks.ts`, an hourly reconciler covers those.
- `meetingPassword` is stored in plain text.
- Several rules (required `recurrenceEndDate` for `per_session`, uniqueness of registrations) are enforced in route/service code, not by this schema.
