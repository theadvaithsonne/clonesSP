# `components/bat246/Bat246ReferralInviteButton.tsx`

> An "Invite by your Referral Id" button that opens a popup with the member's personal gotobigwin.com referral link and a Copy button.

**Kind:** React component · **Lines:** 146

## Purpose
This button appears under the title on the BAT 246 dashboards, for both admins and regular members. It gives members a quick way to share their affiliate link. The link points to the same destination as the right panel's "Share Landing Page → Go to Bigwin landing page" option: `https://gotobigwin.com/?ref=<affiliateId>`. The origin is hard-coded on purpose, because the link belongs to this one office only.

## How it works
- **Fetching the id.** On mount it calls `api("/affiliate/my-affiliate-id")` with a bearer token from `getToken()` and stores the `affiliateId`. A `cancelled` flag stops a state update after unmount, and errors are logged to the console.
- **Disabled state.** The button stays disabled until the id arrives, so it never hands out a link without a code.
- **Popup:**
  - A full-screen overlay with `role="dialog"`.
  - Pressing Escape or clicking the backdrop closes it.
  - Body scrolling is locked while the popup is open, and the previous `overflow` value is restored on close.
- **Copy.** `navigator.clipboard.writeText(url)`, then a `sonner` toast. The "Copied" state resets after 2 seconds. If the copy fails, an error toast asks the user to copy the link by hand.
- **Sizing.** Text is 16px or larger with big tap targets, aimed at the office's older audience.

## Exports
- `Bat246ReferralInviteButton()`: the button and its popup; takes no props.

## Interfaces
- **Backend endpoints called:** `GET /backend/affiliate/my-affiliate-id` (served by `server/routes/affiliate.ts`; guard `requireUserOrGarageAdminAsUser`): returns `{ affiliateId }`.
- **External services:** the generated link points to `https://gotobigwin.com`, the BAT 246 public landing domain.

## Dependencies
- **Internal:**
  - `lib/api.ts`: `api()`, the fetch wrapper that prefixes the API URL.
  - `lib/auth.ts`: `getToken()`.
- **Packages:**
  - `react`
  - `lucide-react`: icons.
  - `sonner`: toasts.

## Used by
- `app/(dashboard)/games/bat246/dashboard/page.tsx` (`/games/bat246/dashboard`)
- `app/(dashboard)/games/bat246/page.tsx` (`/games/bat246`)
