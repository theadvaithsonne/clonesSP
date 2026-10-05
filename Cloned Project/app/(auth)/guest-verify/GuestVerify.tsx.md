# `app/(auth)/guest-verify/GuestVerify.tsx`

> Client OTP screen for guest access: verifies the 6-digit code emailed by `/guest-login`, stores the guest identity in localStorage and sends the visitor to `/browse-hqs`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 161

## Purpose
Step two of the guest flow (`/guest-login` -> `/guest-verify` -> `/browse-hqs`). A successful verification creates or finds a `User` marked `guest: true` on the backend, and this component records that user's id and email locally so guest-facing pages (`BrowseHQs`, the `app/guest/[slug]/**` office pages) can recognise the visitor without a full login token.

## How it works
- **Query params:** `email` (trimmed and lowercased) and optional `referCode` (an affiliate id). If `email` is missing, an effect does `router.replace("/guest-login")`.
- **`verifyOtp()`** - runs only when the code has 6 characters and no request is in flight:
  - `POST /guest-auth/verify-otp` with `{ email, code, referralCode: referCode || undefined }`.
  - If the response has `ok` and `guest` true: writes `guest_user_id` and `guest_email` to `localStorage`, toasts "Verified!", and pushes `/browse-hqs`.
  - Otherwise toasts a failure. On a thrown error (the backend answers 400 for a wrong or expired code) it toasts "Something went wrong!" and clears the code input.
- **Enter key:** a window `keydown` listener submits when Enter is pressed with a complete code. It is re-registered whenever `code` changes (the exhaustive-deps lint rule is disabled for it).
- **Resend:** `resend()` calls `POST /guest-auth/request-otp` with `{ email, isResend: true }` (the backend then uses its "resend" sender address), sets a 60-second cooldown in `resendAt` and toasts. The button label shows `Resend in Ns` while `secondsLeft > 0`.
- **UI:** card with "Guest verification" pill, "Check your email" title showing the target email, `OtpInput`, a Continue button, "Use a different email" (back to `/guest-login`) and the resend button. The background uses hardcoded purple radial gradients rather than the `--brand` variable used on `GuestLogin`.

## Exports
- `default GuestVerify()` - the client component.

## Interfaces
- **Backend endpoints called:**
  - `POST /backend/guest-auth/verify-otp` - in `server/routes/guestAuth.ts`. Verifies the `"guest-login"` OTP; if `referralCode` matches a user's `affiliateId`, a new user gets `referredBy`/`referredBySource: "affiliate"` and is synced into the downline tree, while an existing user goes through `setReferredByAffiliateId`. Finds or creates the `User` with `guest: true` (an existing non-guest user is also flagged `guest: true`). Returns `{ ok, userId, email, guest: true, name, phone, profileComplete, hasOrganizations }`; this component uses only the first four.
  - `POST /backend/guest-auth/request-otp` - resend, with `isResend: true`.
- **Browser storage / cookies:** writes `localStorage.guest_user_id` and `localStorage.guest_email`. Nothing is written to the auth store (`store/authStore.tsx`); there is no JWT for guests here.

## Dependencies
- **Internal:**
  - `lib/api.ts` - `api()` fetch wrapper against the `/backend` base.
  - `components/ui/otp-input.tsx` - six-box code input.
  - `components/ui/button.tsx`, `components/ui/card.tsx` - UI primitives.
- **Packages:** `react` (`useState`, `useEffect`, `useMemo`), `next` (`useRouter`, `useSearchParams`), `lucide-react` (`ArrowRight`, `RotateCcw`), `sonner` (toasts).

## Used by
- `app/(auth)/guest-verify/page.tsx` - the `/guest-verify` route.

## Notes
- **Countdown does not tick.** `secondsLeft` is a `useMemo` over `resendAt` only, and the interval effect (L93-L97) runs an empty callback that never sets state, so the label stays at "Resend in 60s" (and the button stays disabled) until some other state change re-renders the component, for example typing in the OTP box.
- `resend()` has no try/catch: a failed request produces an unhandled promise rejection and no toast, and the cooldown is not set.
- Guest identity in localStorage is unauthenticated client state; any backend endpoint that trusts `guest_user_id` from the client should be treated with that in mind.
- On the backend, an existing full user who goes through this flow is permanently flagged `guest: true`.
