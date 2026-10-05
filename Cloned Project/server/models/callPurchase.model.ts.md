# `server/models/callPurchase.model.ts`

> Mongoose model for a buyer's purchase of one or more calls from a `CallOffering`, tracking how many are used, scheduled and left, plus intake answers and payment state.

**Kind:** Mongoose model · **Lines:** 134

## Purpose
Sits between `CallOffering` (what the founder sells) and `CallBooking` (an individual scheduled slot). One purchase can cover several calls; each booking draws on it. Unlike course enrolments, a user may buy the same offering many times, so there is no unique constraint on `(callOfferingId, userId)`.

## How it works
Fields (`ICallPurchase`, with `timestamps`):
- **References:** `callOfferingId` (`CallOffering`), `userId` (buyer, `User`), `organizationId` (`Organization`), all required and indexed.
- **Quantities:** `quantityPurchased` (required, min 1), `quantityUsed`, `quantityScheduled`, `quantityRemaining` (all default 0, min 0).
- **Intake:** `intakeAnswers` - array of `{ questionId, question, answerType: "text"|"file", textAnswer?, fileUrl?, fileName? }`. The question text is copied in so history survives later edits to the offering.
- **Payment:** `isPaid` (default false), `totalAmount` (required), `currency` (default `INR`), `paymentId` (Razorpay payment id per the comment), `paymentStatus` (`pending` default, `completed`, `failed`, `refunded`), `invoiceShortUrl` (public Razorpay invoice URL).
- `purchasedAt` (default now).

Indexes:
- `{ callOfferingId, userId }` - explicitly **not unique** (repeat purchases allowed).
- `{ userId, organizationId, purchasedAt: -1 }` - a user's purchases in an org.
- `{ callOfferingId, paymentStatus }` - offering stats.
- `{ organizationId, createdAt: -1 }` - admin orders view.

`pre("save")` recomputes `quantityRemaining = quantityPurchased - quantityUsed`.

Collection: Mongoose default, `callpurchases`.

## Exports
- `CallPurchase` - the model.
- `interface ICallPurchase` - document type.
- `interface IIntakeAnswer` - intake answer sub-document type.

## Interfaces
- **Database:** `CallPurchase` (collection `callpurchases`) - created in `server/services/call.ts` (initialises `quantityRemaining` to the purchased quantity); counters changed by `server/services/call.ts` and `server/routes/callBooking.ts`; read by `server/routes/call.ts`, `server/routes/public.ts`, `server/routes/unifiedOrders.ts`, `server/services/review.ts` (purchase gate for reviews) and `server/services/wallet.ts`.

## Dependencies
- **Packages:** `mongoose` - schema, model, types.

## Used by
`server/routes/call.ts`, `server/routes/callBooking.ts`, `server/routes/public.ts`, `server/routes/unifiedOrders.ts`, `server/services/call.ts`, `server/services/review.ts`, `server/services/wallet.ts`.

## Notes
- `quantityRemaining` is only recomputed on `save()`. Completing a booking or marking a no-show uses `findByIdAndUpdate` with `$inc: { quantityUsed: 1, quantityScheduled: -1 }` (in `services/call.ts` and `routes/callBooking.ts`), which skips the hook, so the stored `quantityRemaining` can lag behind `quantityUsed` until the document is next saved. `services/call.ts` checks `quantityRemaining <= 0` when booking, so treat the stored value with care.
- The formula ignores `quantityScheduled`; calls that are booked but not yet held still count as remaining.
