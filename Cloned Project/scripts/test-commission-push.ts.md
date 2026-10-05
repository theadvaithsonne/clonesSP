# `scripts/test-commission-push.ts`

> Manual test that sends a "commission earned" push notification to one user's devices through the real production sender, without touching any wallet.

**Kind:** backend helper/test script (connects to the configured DB) · **Lines:** 136

## Purpose
After a wallet credit, `services/wallet.ts` notifies the earner with `sendCommissionEarnedPushNotification`. To confirm that notification reaches a phone end to end (token lookup, amount formatting, the Android `earnings` channel, the `commission_earned` tap payload) without crediting money, this script calls that same function directly for a chosen user. Unlike `scripts/test-knock-push.ts`, which builds Expo messages by hand, it exercises the exact production code path. It is run by hand and imported by nothing.

## How it works
- Parses flags: `--user <email|userId>` (required; 24-hex = `_id`, otherwise lower-cased email), `--amount` (integer in the currency's smallest unit, default `4550`), `--currency` (default `USD`), `--level` (affiliate level shown in the title), `--routed` (routed-to-platform variant that appends "Activate Unilevel Plus to unlock this earning."), `--description` (body; default marks it as a test).
- Loads `.env`, connects to `env.MONGODB_URI` (production here), finds the `User`, and lists their active `DeviceToken`s (platform, token prefix, `lastUsedAt`). If there are none, it explains and exits.
- Calls `sendCommissionEarnedPushNotification(uid, { amount, currency, description, unit: "smallest", level, routedToPlatform, walletDeepLink: "/wallet" })` and prints `sent`/`failed` counts and errors, plus what title/body to expect on the device.

Usage:
```
npx tsx scripts/test-commission-push.ts --user me@x.com
npx tsx scripts/test-commission-push.ts --user me@x.com --amount 4550 --level 2
npx tsx scripts/test-commission-push.ts --user me@x.com --routed
```

## Exports
None. Local helpers `getArg(name)` and `hasFlag(name)`; `run()` executes on load.

## Interfaces
- **Database (production):** `User` - read; `DeviceToken` - read here, and the push sender itself updates token rows (`lastUsedAt`/`failedAttempts` reset on success, increments failures or deactivates tokens on errors).
- **External services:** Expo push service (via `sendPushToUser` inside `server/services/pushNotification.ts`), which forwards to FCM/APNs.
- **Environment variables:** `MONGODB_URI` (via `env`).

## Dependencies
- **Internal:** `server/config/env.ts` - `env.MONGODB_URI`; `server/models/user.model.ts` - `User`; `server/models/deviceToken.model.ts` - `DeviceToken`; `server/services/pushNotification.ts` - `sendCommissionEarnedPushNotification`.
- **Packages:** `mongoose` - DB connection; `dotenv` - loads `.env`.

## Used by
Nothing imports it. Run manually with `npx tsx`.

## Notes
- Sends a real notification to a real person's phone; pick the recipient carefully.
- The expected-title line printed at the end always uses `$` and `/100` formatting, regardless of `--currency`.
- The production sender uses `audience: "all"`, so NetworkChain app installs receive it too.
