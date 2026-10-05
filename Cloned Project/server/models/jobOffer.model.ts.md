# `server/models/jobOffer.model.ts`

> Mongoose model for a job offer sent to a candidate, which they accept or decline inside Garage.

**Kind:** Mongoose model · **Lines:** 67

## Purpose
In the Garage Jobs module, once a candidate reaches the offer stage the founder sends a `JobOffer` (role, CTC, currency, joining date, optional letter). The candidate responds inside the app. Accepting an offer does **not** mark them hired: the founder confirms the hire, and the joining date that starts any referral-reward guarantee period (see `JobReward`), as a separate step.

## How it works
- `OFFER_STATUSES`: `sent` (default), `accepted`, `declined`, `withdrawn`, `expired`.
- Fields:
  - `orgId`, `jobId`, `applicationId`, `candidateId` - required refs (`Organization`, `JobPosting`, `JobApplication`, `User`).
  - `role` (required, max 160), `ctc` (required, >= 0), `currency` (default `"USD"`).
  - `joiningDate`, `expiresAt` - optional dates.
  - `letter` - optional embedded `{ url (required), name, size }` for an uploaded offer letter, with no `_id`.
  - `message` (max 4000), `status`, `respondedAt`, `declineReason` (max 1000), `createdBy` (required `User`).
- Timestamps are on.
- Indexes: `{ applicationId: 1, createdAt: -1 }` (offer history for an application) and `{ candidateId: 1, status: 1 }` (a candidate's open offers).

## Exports
- `JobOffer` - Mongoose model `"JobOffer"`.
- `IJobOffer` - interface.
- `OFFER_STATUSES`, `OfferStatus` - status enum and type.

## Interfaces
- **Database:** `JobOffer` (collection `joboffers`) - read/write.
- **Background work:** `server/services/jobsSweeper.ts` runs `JobOffer.updateMany({ status: "sent", expiresAt: { $lte: now } }, { $set: { status: "expired" } })` to expire stale offers.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/jobsFounder.ts` (`/jobs/founder`) - create and withdraw offers.
- `server/routes/jobsCandidate.ts` (`/jobs`) - accept or decline.
- `server/services/jobsSweeper.ts` - expiry sweep.
