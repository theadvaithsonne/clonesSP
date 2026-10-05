# `server/bat246/routes/bat246LostMoney.routes.ts`

> Express router for the BAT246 "Lost Money" programme. It covers the public site (claims form, testimonials, paid list, gallery) and the admin back office (claim review, testimonial moderation, the paid-list lineup, gallery management and the auto-pay on/off switch).

**Kind:** BAT246 game module (backend) — Express router · **Lines:** 807 · **Mounted at:** `/bat246/lostmoney` (browser: `/backend/bat246/lostmoney`)

## Purpose
Lost Money is a BAT246 side programme for people who lost money in earlier schemes:
- They submit a claim.
- An admin approves an amount.
- Approved people are then repaid gradually by an automatic drip of 3% of each real BAT246 sale, which lives in `bat246LostMoneyAutoPay.service.ts`.

The public pages are served under `/games/bat246/lostmoney/index` and on the lost-money domains rewritten by `middleware.ts`. The admin pages are under `/games/bat246/lostmoney/admin` and `/paidlist`. This router holds the data for both.

## How it works

### Access control (L16-L27)
`requireAlanK` passes when `isBat246CardAdmin(email, userId, "lostmoney")` does: either the hardcoded admin email or an explicit "lostmoney" card grant from the Permissions page. It always runs after `requireAuth`. Public write endpoints use `softAuth`, which attaches a user if a token is present but never rejects the request.

### Claims (L29-L132)
- `POST /claims` (`softAuth`, public):
  - Requires `companyName`, `firstName`, `lastName` and `mobileNumber`.
  - Copies about 45 free-text questionnaire fields, each `String(...).trim()`: loss amounts, sponsor details, product bought, timeline, ages, ID number at the time of loss, and so on.
  - `teamsCopyImages` is limited to 5 non-empty URL strings. The images were already uploaded by the client through the public upload endpoint.
  - It links `userId` when the caller is signed in, and returns `{ ok, id }`.
- `GET /claims` (admin): every claim, **oldest first**, so the admin list's numbering (#1 = oldest) stays stable.
- `POST /claims/:id/status` (admin): sets `status` to `pending`, `approved` or `rejected`.

### Testimonials (L134-L259)
- `GET /testimonials` (public): rows that are approved and not hidden, newest approval first. Only `name`, `message`, `images` and `approvedAt` are returned.
- `POST /testimonials` (`softAuth`, public): `name` and `message` are required. Accepts up to 10 images, each `{url, caption}` (caption limited to 200 characters) or a bare URL string kept for older clients. Saved unapproved.
- Admin routes:
  - `GET /testimonials/pending` and `/approved`
  - `POST /testimonials/:id/approve`: sets `approved` and `approvedAt`.
  - `/reject`: hard delete.
  - `/hide` and `/unhide`: toggle `hidden`. A hidden testimonial stays approved, so unhiding needs no new approval.
  - `/delete`: hard delete.

### Paid list and lineup (L261-L627)
There is one row per person, not per payout. Rows are split into two grids by `movedToLineupAt`:
- `ACTIVE_LINEUP_FILTER` ("No Wait Lineup"): the field is missing (legacy rows) or not null.
- `WAITING_LINEUP_FILTER` ("90 Days Waiting Period"): the field exists and is `null`.

The auto-pay service uses the same active filter, so rows in the waiting grid are never paid. `order` sets the queue position, and admins control it independently of payment dates.

Routes:
- `GET /paid?page=&limit=` (public): only rows with `totalPaid > 0`, sorted by `order`. It keeps the old response shape `{ _id, name, amount: lastPaymentAmount, totalPaid, paidAt, testimonial }`. `testimonial` is the message of an approved testimonial whose name matches exactly, ignoring case. Admin-only fields such as `reportedLoss` and `approvedAmount` are never exposed. Pagination only applies when `page` is given; `limit` is capped at 100.
- `GET /paid/admin?lineup=active|waiting&page=&limit=` (admin):
  - Returns the page of rows for the chosen grid.
  - `stats` covers the whole collection: `totalRepaid` is the sum of `totalPaid`, and `totalMembers` counts rows with `totalPaid > 0`.
  - For the waiting grid, each row gets `eligibleOn` / `eligibleNow` from `computeEligibleInfo`.
  - Every row gets `alreadyBat246Member`: whether the linked `userId` belongs to the BAT246 organisation (`BAT246_ORG_ID`, via `User.organizations`).
- `POST /paid/add` `{name, amount, userId?, email?, claimId?, reportedLoss?, lineup?}` (admin). This records an **approval, not a payment**:
  - If a row already matches (by `userId`, otherwise by exact case-insensitive name with regex escaping), it only adds to `approvedAmount`.
  - Otherwise it creates a row with `totalPaid: 0`.
  - The new row goes to the active grid only when `lineup === "active"`, at the back (`nextActiveOrder()` = highest `order` + 1), with `movedToLineupAt = now`. Otherwise it is parked in the waiting grid (`movedToLineupAt: null`).
  - Returns the number of rows in the target grid, so the UI can jump to its last page.
- `POST /paid/:id/edit-amount`: sets `approvedAmount` directly. It cannot go below `totalPaid`, because the drip calculates each round as `min(300, approved - paid)`.
- `POST /paid/:id/edit-name`: changes the display name only.
- `POST /paid/:id/move-to-lineup`: waiting → active, joining at the back of the queue. Rejected if the row is already in the lineup.
- `POST /paid/:id/move-to-waiting`: active → waiting (`movedToLineupAt = null`). This pauses future rounds; nothing already paid is reversed.
- `POST /paid/:id/delete`: hard delete.
- `POST /paid/swap-order {idA, idB}`: swaps two rows' `order`. Swapping pairs, rather than renumbering everything, keeps pagination correct.
- `GET /people/search?q=` (admin): up to 10 verified users anywhere in Garage, matched by name, email or phone (regex escaped). Used to link a paid row to an account.

### Home-page gallery (L629-L710)
- Upload goes through multer in memory: 10 MB limit, JPEG/PNG/GIF/WebP/HEIC/HEIF only. Other types are silently filtered out, which produces a 400.
- `GET /gallery` (public): `url` and `order`, sorted by `order` then `createdAt`.
- `POST /gallery` (admin, multipart field `file`): uploads to S3 under key `bat246-lostmoney-gallery/<timestamp>_<random>_<safeName>` with `s3Service.uploadFile`, saves `{url, key, order: count}` and appends it at the end.
- `POST /gallery/reorder {orderedIds}`: sets each image's `order` to its index in the array.
- `POST /gallery/:id/delete`: deletes the document, then tries to delete the S3 object. A failure there is only logged as a warning.

### Payment switch and the 90-day countdown (L712-L804)
- `getHealedPaymentSettings()` loads the singleton `Bat246LostMoneyPaymentSettings`, creating it with payments enabled if it is missing. If payments are paused but `pauseHistory` has no open interval (legacy data), it backfills one starting at `updatedAt`.
- `computeEligibleInfo(createdAt, pauseHistory)` measures the 90-day wait while ignoring paused time:
  - active elapsed time = (now − created) − (how much each pause interval overlaps [created, now]).
  - `eligibleOn = now + remaining`, and `eligibleNow` is true once 90 days have passed.
  - While a pause is still open, the countdown stays frozen.
- `GET /payments/status` (admin): `{paymentsEnabled, updatedByEmail, updatedAt}`.
- `POST /payments/toggle {enabled}` (admin):
  - Turning payments off opens a new pause interval.
  - Turning them on closes the open interval.
  - It records `updatedByEmail` from `req.user.email`.
  - The auto-pay service reads this switch on every sale; while paused it pays nothing.

## Exports
- `default` — the Express `Router`.

## Interfaces
- **Endpoints served:** all paths above under `/backend/bat246/lostmoney`.
  - Public, no auth: `GET /testimonials`, `GET /paid`, `GET /gallery`.
  - Public with optional auth (`softAuth`): `POST /claims`, `POST /testimonials`.
  - Every other route: `requireAuth` plus `requireAlanK`.
- **Database:**
  - `Bat246LostMoneyClaim` (`bat246lostmoneyclaims`): create, read, update status.
  - `Bat246LostMoneyTestimonial` (`bat246lostmoneytestimonials`): create, read, update, delete.
  - `Bat246LostMoneyPaid` (`bat246lostmoneypaids`): create, read, update, delete, aggregate.
  - `Bat246LostMoneyGalleryImage` (`bat246lostmoneygalleryimages`): create, read, update, delete.
  - `Bat246LostMoneyPaymentSettings` (`bat246lostmoneypaymentsettings`): a singleton, read and write.
  - `User`: read only.
- **External services:** AWS S3 through `server/services/s3.ts` (`uploadFile`, `getPublicUrl`, `deleteFile`).

## Dependencies
- **Internal:**
  - The five `server/bat246/models/bat246LostMoney*.model.ts` models.
  - `server/bat246/services/bat246Permission.service.ts` (`isBat246CardAdmin`).
  - `server/middleware/auth.ts` (`requireAuth`, `softAuth`).
  - `server/models/user.model.ts`, `server/services/s3.ts`.
- **Packages:** `express` (Router), `mongoose` (`Types`), `multer` (in-memory image upload).

## Used by
- Mounted in `server/app.ts` with `app.use("/bat246/lostmoney", bat246LostMoneyRoutes)`.
- Frontend:
  - `app/games/bat246/lostmoney/index/*` and `app/(dashboard)/games/bat246/lostmoney/website/*`: the public site (Register, Testimonials, Paid, the HomeGallery component).
  - `app/(dashboard)/games/bat246/lostmoney/admin/page.tsx`: claims and testimonials.
  - `app/(dashboard)/games/bat246/lostmoney/paidlist/page.tsx`: lineup and payment switch.

## Notes
- **Public endpoints that write data.** `POST /claims` and `POST /testimonials` accept anonymous submissions with no rate limiting or captcha in this file. Claims can contain personal data such as phone numbers and ID numbers.
- `requireAlanK` is misleadingly named: it also accepts anyone granted the "lostmoney" card.
- The organisation ID and the admin email are hardcoded here and repeated in other BAT246 route files.
- `POST /paid/add` matches existing rows by name when no `userId` is given. Two different people with the same name would be merged into one row.
- Testimonials are linked to paid rows by exact name only, so a spelling difference breaks the link.
- Reject and delete for testimonials, and delete for paid rows, are hard deletes with no undo.
