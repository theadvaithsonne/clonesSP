# `server/models/workshopRegistration.model.ts`

> Mongoose model for a user's registration (free or paid) to a workshop / live stream / webinar, including per-session enrolments for recurring series.

**Kind:** Mongoose model · **Lines:** 128

## Purpose
A `Workshop` (see `workshop.model.ts`) is the product a founder sells or gives away; a `WorkshopRegistration` is one person's ticket to it. Registrations decide who may join the webinar room, appear in the founder's attendee lists and analytics, and carry the payment reference for paid enrolments. For recurring workshops the same user can hold several rows, one per session, depending on the workshop's enrolment mode.

## How it works
- **Keys:** `workshopId` (ref `Workshop`), `userId` (ref `User`), `orgId` (ref `Organization`) - all required and individually indexed.
- **Status:** `registered` (default), `attended` or `cancelled`. `cancelledAt` stamps when a row was cancelled; for a `full` enrolment that ends the whole series, for a `session` row only that session (same meaning as `ChannelMembership.cancelledAt`). `attendedAt` stores when attendance was recorded.
- **Payment:** `hasPaid` (default false), `paymentId`, `orderId`, `invoiceShortUrl` (public Razorpay invoice URL), `amountPaid` (min 0), `currency` (default `"INR"`).
- **Recurring workshops:**
  - `enrollmentType`: `full` (enrolled once for the series, default) or `session` (one row per session). Note the values differ from `Workshop.enrollmentType`, which uses `once` / `per_session`.
  - `sessionDate` - for per-session rows, the session's canonical date (the same UTC-midnight slot id used by `WorkshopSessionOverride`); indexed.
  - `enrolledAt` - when the user enrolled, used for access-date checks.
  - `grandfathered` - keeps full access if the workshop later switches enrolment type.
- `registeredAt` defaults to now; `timestamps: true` adds `createdAt` / `updatedAt`.

### Indexes
`{workshopId, userId, sessionDate}`, `{userId, status}`, `{workshopId, status}`, `{workshopId, userId, enrollmentType}`, `{workshopId, sessionDate, status}`, `{workshopId, grandfathered}`. None is unique: the comment explains that the old unique `(workshopId, userId)` index was removed because per-session rows need several per user, so uniqueness of `full` / non-recurring registrations is enforced in application code.

## Exports
- `WorkshopRegistration` - the Mongoose model.
- `IWorkshopRegistration` - document interface.

## Interfaces
- **Database:** `WorkshopRegistration` (collection `workshopregistrations`) - defines the schema.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
`server/routes/learnInit.ts`, `server/routes/public.ts`, `server/routes/publicMeet.ts`, `server/routes/publicWebinar.ts`, `server/routes/unifiedOrders.ts`, `server/routes/workshop.ts`, `server/services/downlineMemberLiveStreams.ts`, `server/services/founderStreamTable.ts`, `server/services/indiaWebinarAutoEnrol.ts`, `server/services/itemReserveLicense.ts`, `server/services/review.ts`, `server/services/workshop.ts`, and the manual script `server/scripts/backfill-india-freedom-webinar.ts`.

## Notes
- **`status === "attended"` is not live-room attendance.** The project CLAUDE.md says no backend code writes it; in this tree `server/services/workshop.ts` (around L3107) does set `status: "attended"` / `attendedAt` when syncing participants from a meeting, but that path is limited. Real "who was in the room" data comes from the webinar session analytics, and `services/founderStreamTable.ts` explicitly avoids this field. Do not treat a 0 count of `attended` as "nobody came".
- No unique index means a buggy caller can create duplicate `full` registrations; always look up before inserting.
