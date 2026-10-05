# `server/lib/posthog.ts`

> The backend's PostHog analytics client: fire-and-forget event, exception and alias helpers that do nothing when `POSTHOG_KEY` is unset, plus a time-limited flush for shutdown.

**Kind:** backend library · **Lines:** 135

## Purpose
This module gives the Express backend server-side product analytics that match the frontend's PostHog setup. It was ported from the NetworkChains contacts-backend, with the same design goal: an analytics problem must never slow down or crash an API request. With no key configured the module is inert (no network traffic and no delays). With a key, events are sent in batches so hot code paths never wait on an HTTP call.

## How it works
- **On import.** If `POSTHOG_KEY` is set, it creates `new PostHog(key, { host, flushAt: 20, flushInterval: 3000 })`, so events are sent after 20 events or 3 seconds, whichever comes first. The host comes from `POSTHOG_HOST`, defaulting to `https://us.i.posthog.com`. A constructor error is logged and leaves `client = null`. If the key is missing, it logs a warning and stays disabled.
- **`resolveDistinctId`** picks the identity for an event in this order:
  1. the authenticated `userId`;
  2. the `x-posthog-distinct-id` header forwarded by the frontend (the anonymous id it keeps stable in localStorage), taking the first value if the header is an array;
  3. `email:<fallbackEmail>`;
  4. `"anonymous"`.
- **`captureServer`** and **`captureServerException`** do nothing without a client. They add `app: "garage-backend"` to the event properties, and non-`Error` values passed to `captureServerException` are wrapped in an `Error`. Every SDK call is wrapped in try/catch, and both functions return `void`. Callers are not meant to await them.
- **`aliasUser`** calls `client.alias(...)` so anonymous events from before signup merge into the user's profile after they log in.
- **`shutdownPostHog`** races `client.shutdown()` against a 3-second timer, so a slow PostHog cannot block a clean pm2 restart.

## Exports
- `default` - the `PostHog` client instance, or `null` when disabled.
- `resolveDistinctId(opts: { userId?; headerDistinctId?: string | string[]; fallbackEmail? }): string`.
- `captureServer(args: { distinctId; event; properties? }): void`.
- `captureServerException(args: { distinctId; error: unknown; properties? }): void`.
- `aliasUser(args: { distinctId; alias }): void`.
- `shutdownPostHog(): Promise<void>` - flushes queued events, waiting at most 3 seconds.

## Interfaces
- **External services:** PostHog ingestion API (US cloud by default).
- **Environment variables:** `POSTHOG_KEY` - project API key; turns the client on. `POSTHOG_HOST` - ingestion host.
- **Background work:** the SDK's own batched flush timer (every 3 seconds).

## Dependencies
- **Internal:** none.
- **Packages:** `posthog-node` - the server SDK.

## Used by
- `server/index.ts` - imports only `shutdownPostHog`, which its exported `stopBackend()` calls during shutdown.

## Notes
- No backend file currently calls `captureServer`, `captureServerException`, `aliasUser` or `resolveDistinctId`. Apart from initialising the client and flushing it at shutdown, the module is effectively unused. Server-side events will only appear once routes start calling these helpers.
- Importing the module creates the client and logs a message right away (`[posthog] server-side client initialized` or the "missing" warning).
- When the email fallback is used, the raw email address becomes the distinct id. That is personal data being sent to PostHog.
