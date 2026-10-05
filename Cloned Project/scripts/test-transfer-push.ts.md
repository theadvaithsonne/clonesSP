# `scripts/test-transfer-push.ts`

> Manual test that sends a "transfer received" push notification to one user's devices via the real production sender, without moving any money.

**Kind:** backend helper/test script (connects to the configured DB) · **Lines:** 119

## Purpose
When a peer store-wallet transfer commits, `services/wallet.ts` notifies the recipient with `sendTransferReceivedPushNotification`. This script fires that same function for a chosen user so the notification (title, whole-unit amount formatting, the Android `earnings` channel, the `transfer_received` tap payload) can be checked on a device. It is a sibling of `scripts/test-commission-push.ts`. It is run by hand and imported by nothing.

## How it works
- Flags: `--user <email|userId>` (required; 24-hex = `_id`, otherwise lower-cased email), `--amount` (WHOLE currency units, default `25`), `--currency` (default `USD`), `--from` (sender display name, default "Test Sender"), `--dest store|content_rewards` (default `store`), `--description` (body; default marks it as a test).
- Loads `.env`, connects to `env.MONGODB_URI` (production here), resolves the `User`, counts active `DeviceToken`s and exits early if there are none.
- Calls `sendTransferReceivedPushNotification(uid, { amount, currency, senderName, description, destination, walletDeepLink: "/wallet" })`, prints `sent`/`failed` and errors, then the title/body to expect.

Usage:
```
npx tsx scripts/test-transfer-push.ts --user me@x.com
npx tsx scripts/test-transfer-push.ts --user me@x.com --amount 25 --from "Alex"
npx tsx scripts/test-transfer-push.ts --user me@x.com --dest content_rewards
```

## Exports
None. Local `getArg(name)`; `run()` executes on load.

## Interfaces
- **Database (production):** `User` - read; `DeviceToken` - counted here, and updated by the push sender (`lastUsedAt`/`failedAttempts`, deactivation of bad tokens).
- **External services:** Expo push service (through `server/services/pushNotification.ts`).
- **Environment variables:** `MONGODB_URI` (via `env`).

## Dependencies
- **Internal:** `server/config/env.ts`; `server/models/user.model.ts`; `server/models/deviceToken.model.ts`; `server/services/pushNotification.ts` - `sendTransferReceivedPushNotification`.
- **Packages:** `mongoose`; `dotenv`.

## Used by
Nothing imports it. Run manually with `npx tsx`.

## Notes
- Amounts are whole units (dollars), unlike the commission push, which takes cents; passing cents would show a 100x amount.
- App builds that do not know the `transfer_received` type still display the notification but do nothing on tap (the script's own hint says so).
- Sends a real notification to a real user.
