# `server/services/otpRateLimit.ts`

> Per-caller throttle for outbound OTP sends.

**Kind:** backend service · **Lines:** 145

<!-- docgen:auto -->

## Purpose
Per-caller throttle for outbound OTP sends.

The existing cooldown in /auth/request-otp is keyed on the PHONE NUMBER: one
OtpCode row per (key, purpose), 60s between codes. That stops someone
hammering their own number, and does nothing at all about the attack we
actually see — a script walking through a list of numbers, one send each.
Every number is new, so every number gets a free SMS/WhatsApp, and each one
costs money and lands on a stranger's phone.

So this throttles the CALLER instead of the destination. In-memory on
purpose: the backend runs as a single pm2 fork process, there is no Redis in
this service, and a limiter that resets on deploy is worth far more than one
that never ships. If this ever runs multi-process, move the window to Mongo
or Redis — a per-process limit is N× looser than it reads.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `callerKey` | function | `callerKey(req: any): string` — The caller's address as seen through nginx. | 71 |
| `OtpThrottleResult` | interface |  | 77 |
| `checkOtpSendAllowed` | function | `checkOtpSendAllowed(req: any, destination: string): OtpThrottleResult` — Check-and-record. Call once per intended send, and only for the phone branch: email OTPs cost nothing and are deliberately left alone. | 88 |
| `resetOtpThrottle` | function | `resetOtpThrottle()` — Test/ops hook — drops all windows. | 139 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/auth.ts`
- `server/routes/public.ts`
