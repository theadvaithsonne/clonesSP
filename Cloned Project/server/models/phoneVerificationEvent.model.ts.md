# `server/models/phoneVerificationEvent.model.ts`

> Mongoose model for a durable record of each successful phone verification, including the webinar and pinned item the user was in when it happened.

**Kind:** Mongoose model · **Lines:** 71

## Purpose
`User.phoneVerified` is a bare boolean with no history, and the OTP rows that produced it (`otpcode.model.ts`) carry a TTL index and vanish when they expire. So a question like "who verified their number while trying to buy the product we pinned in this webinar?" had nothing to read. This collection is the durable answer: one row per successful verification, with the context the client reported.

## How it works
- **Fields:**
  - `userId` (ref `User`, required, indexed), `phone` (required), optional `email` and `name` snapshots.
  - `workshopId` (ref `Workshop`, indexed) - the webinar, when the verification happened in one.
  - `sessionDate` - UTC-midnight day key, matching `WebinarAttendance` and `WebinarProductPin`.
  - `itemType`, `itemId`, `itemName` - the pinned item being bought when the phone gate appeared.
  - `source` (default `"profile"`) - where the gate was shown, e.g. `"webinar-pin"` or `"profile"`.
  - `startedComboWindow` (default `false`) - true when this verification opened the user's 24-hour combo window.
  - `verifiedAt` (required), plus `timestamps`.
- **Trust:** `context` values (webinar, item, source) are client-supplied and only reported, never used for authorization. They decide which row of a founder's report a verification is grouped under. A buyer could name the wrong webinar and skew a count, which is why sales figures use the invoice's server-verified `liveWorkshopId` instead.

## Exports
- `IPhoneVerificationEvent` - document interface.
- `PhoneVerificationEvent` - the Mongoose model.

## Interfaces
- **Database:** `PhoneVerificationEvent` (collection `phoneverificationevents`) - written once per verification, read by analytics.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/auth.ts` (mounted at `/auth`) - `POST /backend/auth/phone/verify-otp` creates a row after a successful phone OTP, computing `startedComboWindow` from whether the user had already completed their profile.
- `server/routes/webinarRoutes.ts` (mounted at `/webinar`) - `GET /backend/webinar/:workshopId/analytics` reads rows alongside `WebinarAttendance` for the founder's Live Session analytics.

## Notes
- Records exist only from the day this feature shipped; earlier verifications cannot be backfilled.
