# `components/bat246/InviteModal.tsx`

> A modal that lets a BAT 246 player pick an entry product and build a shareable join link for a board position, either keeping the position ("Preserve Position") or leaving it unassigned ("Without Position").

**Kind:** React component · **Lines:** 124

## Purpose
Players invite recruits onto their board through the "Invite" button under an empty AT BAT slot. This modal builds the invite URL. The recruit opens the URL at the public join page, buys the selected product, and is then placed, either into the chosen position or as unassigned for the inviter to place later.

## How it works
- **Products.** On mount it loads the active BAT 246 products from `GET /backend/bat246/products`, using the bearer token in `localStorage.garage_tok`. If only one product comes back, it is preselected.
- **Building the link.** `handleGenerate(pos)` builds the URL `<window.location.origin>/games/bat246/join/<boardId>/<pos>?productId=<selectedId>&ref=<myUserId>`. No backend call is made; the link is assembled entirely in the browser.
  - **Generate Link — Preserve Position** uses the given `position`, e.g. `atBat-0`.
    - `hidePreservePosition` hides this button.
    - `disablePreservePosition` disables it, with the tooltip "Make your first sale with 'Without Position' to unlock this".
  - **Generate Link — Without Position** uses `pos = "unassigned"`.
- **Copying.** Copy uses `navigator.clipboard` and shows a `sonner` toast. The "Copied!" state resets after 2 seconds.
- **Resetting.** Changing the product clears any link already generated.
- **Closing.** Clicking the backdrop or the X calls `onClose`.

## Exports
- `InviteModal(props)`: props:
  - `boardId`
  - `position`: e.g. `"atBat-0"`.
  - `posLabel`: e.g. `"AT BAT 1"`.
  - `myUserId`: used as the `ref`.
  - `disablePreservePosition?`
  - `hidePreservePosition?`
  - `onClose`

## Interfaces
- **Backend endpoints called:** `GET /backend/bat246/products` (`requireAuth`; returns active `Product`s of the BAT 246 product organisation as `{ products: [{ _id, name, price, currency }] }`).
- **Environment variables:** `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Packages:**
  - `react`
  - `lucide-react`: icons.
  - `sonner`: toasts.

## Used by
- `components/bat246/BoardLayout.tsx`: the desktop AT BAT invite buttons.
- `components/bat246/BoardMobileSections.tsx`: the mobile AT BAT invite buttons.

The links it produces open `app/games/bat246/join/[boardId]/[position]/page.tsx`.

## Notes
- The Preserve and Without Position rules are decided by the caller (from the viewer's position and sales credits); this modal only applies the flags it receives.
- `ref` is the inviter's user id, not their affiliate id.
