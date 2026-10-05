# `lib/hooks/use-resend-cooldown.ts`

> A small hook that provides the countdown behind a "Resend code" OTP button (60 seconds by default).

**Kind:** frontend library · **Lines:** 38

## Purpose
Every OTP screen needs a seconds-remaining number, a way to start the timer after a send, and a disabled state while it runs. This hook centralises that. The 60-second default matches the backend: the phone branch of `POST /backend/auth/request-otp` (`server/routes/auth.ts`) allows one code per minute and returns 429 inside that window. `POST /backend/auth/phone/request-otp` has **no** server-side throttle, so on those screens this client-side cooldown is the only thing limiting how many paid SMS/WhatsApp messages a user can trigger.

## How it works
`secondsLeft` starts at 0. `start()` sets it to `seconds`; an effect then decrements it once a second with a `setTimeout` until it reaches 0 (each tick schedules the next one, and the cleanup clears the pending timeout).

## Exports
- `useResendCooldown(seconds = 60)` - returns:
  - `secondsLeft: number` - for the button label;
  - `waiting: boolean` - true while pressing Resend would be refused;
  - `start(): void` - call after a code actually goes out, including the first one.

## Dependencies
- **Packages:** `react` - `useState`, `useEffect`.

## Used by
- `components/shared/PhoneVerifyBanner.tsx`
- `components/webinar/PlanPhoneVerifySheet.tsx`

## Notes
- The cooldown lives in component state only; reloading the page or remounting the component resets it, which is why the missing server-side throttle on `/auth/phone/request-otp` matters.
- The header comment cites `routes/auth.ts:135` from the old backend repo; the route is now `server/routes/auth.ts`, and the line number may differ.
