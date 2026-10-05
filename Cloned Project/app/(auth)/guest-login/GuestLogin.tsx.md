# `app/(auth)/guest-login/GuestLogin.tsx`

> Client form for guest access: collects an email, asks the backend to email a one-time code, then sends the visitor to `/guest-verify`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 143

## Purpose
Guest access lets someone without a full Garage account browse organisations (HQs) and request to join them. This component is step one of that flow, rendered by `app/(auth)/guest-login/page.tsx` at `/guest-login`. It is separate from the main login (`/login`, `components/welcome/Welcome.tsx`), which it links to for people who already have an account.

## How it works
- **State:** `email` (controlled input) and `loading` (disables the button and shows "Sending…").
- **`requestOtp(e?)`** (form `onSubmit`):
  1. Prevents default form submission; if the email is empty, shows a `sonner` error toast and stops.
  2. Calls `api("/guest-auth/request-otp", { method: "POST", body: { email } })`. Note the email is sent exactly as typed here (not trimmed/lowercased).
  3. On success: toast "OTP sent to your email!" and `router.push("/guest-verify?email=<trimmed, lowercased, URL-encoded email>")`.
  4. On failure: logs to the console and shows a generic "Failed to send OTP" toast. The backend's error message is not surfaced.
- **UI:** a centred translucent `Card` over a radial-gradient background tinted with the `--brand` CSS variable (so whitelabel brand colours apply), a "Guest Access" pill, the title "Browse & Join Organizations", an email input with a mail icon, the submit button ("Continue as Guest"), a terms line, and a "Sign in here" link to `/login`.
- A block describing what guest access allows (browse orgs, request to join, track status, become a member after founder approval) is present but commented out (L114-L137).

No referral code is captured on this page; `GuestVerify` reads `referCode` from its own query string only if a caller supplies it.

## Exports
- `default GuestLogin()` - the client component.

## Interfaces
- **Backend endpoints called:** `POST /backend/guest-auth/request-otp` - body `{ email }`. Public endpoint in `server/routes/guestAuth.ts` (mounted at `/guest-auth` in `server/app.ts`); validates the email with zod, creates an OTP of purpose `"guest-login"` (valid 10 minutes) and emails it, responding `{ ok: true }`.

## Dependencies
- **Internal:**
  - `lib/api.ts` - `api()` fetch wrapper; prefixes `NEXT_PUBLIC_API_URL` (the `/backend` base), sets JSON headers and attaches a bearer token if one is stored.
  - `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx` - shadcn UI primitives.
- **Packages:** `react` (`useState`), `next` (`useRouter` from `next/navigation`, `Link`), `lucide-react` (`Mail`, `ArrowRight` icons), `sonner` (toasts).

## Used by
- `app/(auth)/guest-login/page.tsx` - the `/guest-login` route.
