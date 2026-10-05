# `components/bat246/InviteNewDistributorModal.tsx`

> A modal that emails a BAT 246 office invite to someone not yet on Garage, offering the $650 Board Entry or the $160 POD Entry product.

**Kind:** React component · **Lines:** 133

## Purpose
This modal is used on the BAT 246 "Invite and place" page so a distributor can recruit a new person by email. The backend records who sent the invite, so the inviter still gets credit if the referral parameter is lost before signup. It then emails the prospect a link to `/games/bat246/office-invite?productId=…&ref=<inviter userId>`. From there they sign in or sign up and land on the "Path to BAT 246 Distributor".

## How it works
- **Product ids.** Two entry products are hard-coded as Mongo ObjectId strings in the `PRODUCTS` constant (line 11 and line 14):
  - `$650 Board Entry` (`PRODUCT_650_ID`)
  - `$160 POD Entry`

  The comment says this follows the same convention as the boards page "Buy" button and the POD-invite link.
- **POD restriction.** On mount it calls `GET /backend/bat246/distributor/progress`. If the response has `inPod: true` (the caller is seated in pod-0/1/2), then:
  - the $650 option is disabled,
  - the selection switches to the $160 product,
  - an explanatory note is shown.

  The backend enforces the same rule.
- **Sending.** `handleSend()` POSTs `{ email, productId }` to `/bat246/office-invite`.
  - On success: a success toast, then the modal closes.
  - On failure: the server's `error` text appears in a toast.
  - Send is disabled while a send is in progress or the email field is empty.

## Exports
- `InviteNewDistributorModal({ onClose })`: the modal.

## Interfaces
- **Backend endpoints called** (`server/bat246/routes/bat246.routes.ts`, mounted at `/bat246`, `requireAuth`):
  - `GET /backend/bat246/distributor/progress`: the caller's progress, including `inPod`.
  - `POST /backend/bat246/office-invite`: validates the request. Then:
    - the product must be tagged `bat246_entry`;
    - POD members cannot invite for the $650 product;
    - upserts a `Bat246OfficeInvite` keyed by email, holding the inviter and product;
    - sends the invite email through `services/mailer`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Packages:**
  - `react`
  - `lucide-react`: icons.
  - `sonner`: toasts.

## Used by
- `app/(dashboard)/games/bat246/Inviteandplace/page.tsx`: shown when `showInviteModal` is true (route `/games/bat246/Inviteandplace`).

## Notes
- The product ids are hard-coded in both this file and the backend route. If the products are recreated, both places must be updated.
- The client-side POD check only affects the UI; the server check is the one that is enforced.
