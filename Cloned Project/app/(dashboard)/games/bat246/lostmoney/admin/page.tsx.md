# `app/(dashboard)/games/bat246/lostmoney/admin/page.tsx`

> Client admin console for the YourMoneyBack ("Lost Money") site: review pending loss claims and approve them onto the Paid List, moderate testimonials, manage live testimonials, and curate the homepage photo gallery.

**Kind:** Next.js page · **Lines:** 789 · **Route:** `/games/bat246/lostmoney/admin`

## Purpose
The YourMoneyBack public site (served from the lost-money domains and from `/games/bat246/lostmoney/index`) collects claims from people who lost money in other schemes, plus testimonials from people who were repaid. This page is the back-office for that content. It is restricted to the BAT 246 owner account and anyone granted the "lostmoney" card on the BAT 246 Permissions page. The detailed Paid List grid lives on its own page (`/games/bat246/lostmoney/paidlist`); approving a claim here only creates or tops up that list's row.

## How it works

### Access (L59, L299-L306)
`useBat246CardAccess("lostmoney")` returns `{ isAdmin, loading }`. While loading the page renders nothing; non-admins see "Admin only." The backend enforces the same rule via the `requireAlanK` middleware in `server/bat246/routes/bat246LostMoney.routes.ts`, which calls `isBat246CardAdmin(email, userId, "lostmoney")`.

### Initial load (L78-L98)
Once `isAdmin` is true, four requests run in parallel:
- `GET /backend/bat246/lostmoney/claims` (oldest first); the client keeps only `status === "pending"`.
- `GET /backend/bat246/lostmoney/testimonials/pending` (unapproved).
- `GET /backend/bat246/lostmoney/testimonials/approved` (approved, including hidden ones).
- `GET /backend/bat246/lostmoney/gallery` (public, no auth header).
Each failure falls back to an empty list.

### Tabs
**Pending Claims (L356-L472).** Numbered cards (submission order) showing name, company, mobile, city/country and a status chip. Clicking a card expands it to show every non-empty field of the claim, labelled by `humanizeKey()` (camelCase to "Title Case"), skipping `_id`, `__v`, `userId`, `status`, `createdAt`, `updatedAt`; the `teamsCopyImages` array renders as linked thumbnails.
- **Reject** (X) calls `setClaimStatus(id, "rejected")` immediately, no confirmation: `POST /backend/bat246/lostmoney/claims/:id/status` with `{ status }`; the card leaves the list.
- **Approve** (tick) opens the "Approve Claim" modal (L697-L784) showing mobile, location and loss description, with an editable **Reported Loss ($)** (prefilled from `totalLoss`) and a required **Amount to Approve ($)**. `confirmApprove()` validates the amount (> 0), calls `addPayment()` -> `POST /backend/bat246/lostmoney/paid/add` with `{ name, userId, reportedLoss, amount, claimId }`, and on success marks the claim approved. The toast distinguishes a newly created Paid List row from a top-up of an existing person's approved amount.

**Pending Testimonials (L474-L531).** Message, image thumbnails (with captions as titles) and author. Approve -> `POST /backend/bat246/lostmoney/testimonials/:id/approve` and the item is moved to the Live list locally; Reject -> `POST .../testimonials/:id/reject`.

**Live Testimonials (L533-L617).** Approved testimonials; messages over 260 characters are clamped to 4 lines with a Read more / Show less toggle (`expandedLive` set). Hidden ones are dimmed with a "Hidden from live site" badge.
- Eye / EyeOff toggles visibility: `POST .../testimonials/:id/hide` or `/unhide` (keeps the record, approval preserved).
- Trash, after a `confirm()`, calls `POST .../testimonials/:id/delete`.

**Gallery (L619-L695).** Photos shown beside the opening message on the YourMoneyBack homepage, in order.
- "Upload Photos" opens a hidden multi-file `<input accept="image/*">`; `uploadGalleryImages()` posts each file one at a time as `multipart/form-data` field `file` to `POST /backend/bat246/lostmoney/gallery` and appends the returned image. The backend accepts JPEG/PNG/GIF/WebP/HEIC/HEIF up to 10 MB and stores them in S3 under `bat246-lostmoney-gallery/`.
- Left/right arrows call `moveGalleryImage()`, which swaps neighbours optimistically and sends the full order to `POST .../gallery/reorder` as `{ orderedIds }`, reverting on failure.
- Trash, after `confirm()`, calls `POST .../gallery/:id/delete` (also deletes the S3 object server side).

## Exports
- `default LostMoneyAdminPage()` - the page component.

## Interfaces
- **Backend endpoints called** (all under `/backend/bat246/lostmoney`, bearer token from `garage_tok`, admin-only unless noted):
  - `GET /claims`, `POST /claims/:id/status`
  - `GET /testimonials/pending`, `GET /testimonials/approved`
  - `POST /testimonials/:id/approve`, `/reject`, `/hide`, `/unhide`, `/delete`
  - `POST /paid/add`
  - `GET /gallery` (public), `POST /gallery` (multipart upload), `POST /gallery/reorder`, `POST /gallery/:id/delete`
- **Database (via those endpoints):** `Bat246LostMoneyClaim` (collection `bat246lostmoneyclaims`), `Bat246LostMoneyTestimonial` (`bat246lostmoneytestimonials`), `Bat246LostMoneyPaid` (`bat246lostmoneypaids`), `Bat246LostMoneyGalleryImage` (`bat246lostmoneygalleryimages`).
- **External services:** AWS S3 (through the backend) for gallery images.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage["garage_tok"]`.

## Dependencies
- **Internal:** `lib/hooks/useBat246CardAccess.ts` - admin check for the "lostmoney" card.
- **Packages:** `react` (`useState`, `useEffect`, `useRef`), `next/link`, `lucide-react` (icons), `sonner` (toasts).

## Used by
Not imported by any file; reached as the Next.js route `/games/bat246/lostmoney/admin`, linked from the Lost Money hub `/games/bat246/lostmoney`.

## Notes
- **Approval is not payment.** `/paid/add` only records an approved ceiling; `totalPaid` moves only through the automatic 3%-of-sale drip on the backend. Because this page does not send a `lineup` field, a new row lands in the backend's default "90 Days Waiting Period" grid and must be moved to the lineup on the Paid List page before it can be paid.
- Rejecting a **testimonial** deletes it permanently server side (the reject route calls `deleteOne`), unlike rejecting a claim, which only sets its status. Neither reject action asks for confirmation.
- If `/paid/add` succeeds but the following status update fails, the person is on the Paid List while the claim still shows as pending.
- The empty-claims text says "No claims submitted yet." even when claims exist but have all been decided, because decided claims are filtered out client side.
- Claims contain personal data (phone numbers, ID numbers, sponsor details); the expanded view shows every stored field.
