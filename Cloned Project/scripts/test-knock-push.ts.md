# `scripts/test-knock-push.ts`

> Diagnostic script that sends a test "knock" to a user's phones over both transports the backend uses — iOS VoIP push via APNs and Expo push (FCM) — and reports which ones are accepted.

**Kind:** backend helper/test script (reads the configured DB) · **Lines:** 245

## Purpose
A "knock" is the request to start a one-to-one call in the workspace. On mobile it must arrive as a ringing call (iOS VoIP push into CallKit) or a high-priority notification (Android via Expo/FCM). When knocks do not arrive, this script tests delivery without needing another person or a new app build. Its key trick is sending each VoIP token to **both** the sandbox and production APNs gateways: whichever accepts the token reveals how the installed build is registered, which is the most common cause of missing iOS knocks. It is exposed as `npm run test:knock`.

## How it works
**Flags:** `--user <email|userId>` (24-hex = `_id`, else lower-cased email), `--type voip|push|both` (default `both`), `--voip-token <raw APNs token>` (skip the DB and test that token only), `--name` (knocker display name, default "Test Knock"). The knocker id is a placeholder of 24 zeros.

**`loadApnsKey()`** returns `env.APNS_KEY_CONTENT` if set; otherwise reads the `.p8` file at `env.APNS_KEY_PATH`, resolved first against the working directory and then against the parent of `scripts/` (the repo root). Logs where it looked if not found.

**`sendVoipToToken(token, production)`** builds an `@parse/node-apn` `Provider` with token auth (`APNS_KEY_ID`, `APNS_TEAM_ID`) for the chosen gateway, and a notification with topic `<APNS_BUNDLE_ID>.voip`, `pushType: "voip"`, priority 10, 60-second expiry and payload `{ callerId, callerName, callerProfilePicture: "", hasVideo: false }`. Returns `{ ok, reason }` from APNs' response, shutting the provider down each time.

**`testVoip(tokens)`** explains the case of no tokens, warns if `APNS_TEAM_ID` is empty, then tries each token on sandbox and production and prints a recommendation such as "Set APNS_PRODUCTION=false on the server to reach it."

**`testPush(tokens)`** skips non-Expo tokens, sends Expo messages (title "Incoming Knock", `data.type: "knock"`, `channelId: "knocks"`, high priority) with `expo-server-sdk`, prints each ticket, then waits 4 seconds and fetches delivery receipts — a ticket "ok" only means Expo queued it, the receipt shows whether FCM accepted it.

**`run()`** connects to `env.MONGODB_URI` (production here). With `--voip-token` it tests that token and stops. Otherwise it resolves the user and loads active `VoIPToken` and/or `DeviceToken` values depending on `--type`, then runs the tests.

Usage:
```
npx tsx scripts/test-knock-push.ts --user me@x.com
npx tsx scripts/test-knock-push.ts --user me@x.com --type voip
npx tsx scripts/test-knock-push.ts --voip-token <rawApnsToken>
npm run test:knock -- --user me@x.com
```

## Exports
None.

## Interfaces
- **Database (production):** `User`, `VoIPToken`, `DeviceToken` - read only. Unlike the production push service, this script does not deactivate failing tokens.
- **External services:** Apple Push Notification service (sandbox and production gateways); Expo push service (tickets and receipts), which forwards to FCM/APNs.
- **Environment variables (via `server/config/env.ts`):** `MONGODB_URI`; `APNS_KEY_CONTENT` or `APNS_KEY_PATH` (APNs auth key, a secret); `APNS_KEY_ID`; `APNS_TEAM_ID`; `APNS_BUNDLE_ID` (defaults to `com.garageapp.hq`). `APNS_PRODUCTION` is not read here; the script tells you what to set it to.

## Dependencies
- **Internal:** `server/config/env.ts` - APNs and Mongo settings; `server/models/user.model.ts`, `server/models/voipToken.model.ts`, `server/models/deviceToken.model.ts` - recipient and token lookups.
- **Packages:** `@parse/node-apn` - APNs HTTP/2 client; `expo-server-sdk` - Expo push and receipts; `mongoose`; `dotenv`; `fs`, `path` - read the `.p8` key file.

## Used by
Nothing imports it. Run via `npm run test:knock` (`tsx scripts/test-knock-push.ts`) or `npx tsx` directly.

## Notes
- Sends real call notifications to a real person's devices; a valid VoIP push will make an iPhone ring.
- It only tests the Garage app bundle id; NetworkChain's separate bundle id (`NETWORKCHAIN_APNS_BUNDLE_ID` in env) is not covered.
- It mirrors, rather than calls, the backend's knock senders, so it can drift from them.
