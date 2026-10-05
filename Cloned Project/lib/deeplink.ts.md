# `lib/deeplink.ts`

> Helpers for storefront-to-app deep links: which query params a "join this office, then go here" link carries, how they survive the `/login` -> `/verify` hop, and how the final `redirect` is kept on-site.

**Kind:** frontend library · **Lines:** 145

## Purpose
`garage.app` (the storefront) and `my.garage.app` (this app) are separate origins with separate `localStorage`, so a session created on the storefront is invisible here. Any storefront CTA that needs a member (join an office, open a community, enrol in a course, buy a digital product) therefore hands the whole flow to this app via a `/login?intent=...` URL. The storefront builds those URLs in its own `lib/api/sellableItems.ts` (`officeJoinLoginUrl`, `buildUniversalItemDeeplinkUrl`); this module is the app-side contract that `/login` and `/verify` consume, plus an in-app builder for guest pages.

## How it works
- **Intents.** `DEEPLINK_INTENTS = ["join-office", "item-deeplink"]` - both mean "join `orgId`, then go to `redirect`". `isDeeplinkIntent()` is a type guard over that list.
- **Forwarded params.** `DEEPLINK_PARAMS` lists `intent, orgId, orgSlug, itemType, itemId, isPaid, referCode, redirect`. `forwardDeeplinkParams(from, to)` copies each one that is present and non-empty, skipping absent ones so a plain login keeps a short URL. `/login` adds `email` itself; the rest must survive into `/verify` or the destination is lost.
- **Guest-page Join CTA.** `buildOfficeJoinLoginUrl({ orgId, orgSlug, referCode?, redirect })` returns `/login?intent=join-office&orgId=...&orgSlug=...[&referCode=...]&flow=login&redirect=...`. It is the in-app twin of the storefront's `officeJoinLoginUrl`: shared post/article guest pages use it instead of running their own email -> OTP -> phone modal. `flow=login` makes the login form appear first rather than the marketing card. After `public-join` succeeds (see `POST /backend/guest-auth/public-join`), the user lands on `redirect`.
- **Open-redirect protection.** `safeRedirect(raw, fallback)`:
  - empty -> `fallback`;
  - starts with `/` but not `//` (protocol-relative) -> returned unchanged;
  - otherwise (client only) parsed against `window.location.origin`; accepted only if same-origin, and reduced to `pathname + search + hash`;
  - anything else, parse errors, or server-side evaluation -> `fallback`.
- **Profile completion.** `withCompleteProfile(destination, needsProfile)` appends `completeProfile=true` to the destination (parsed against a throwaway base `https://my.garage.app`, returning only the path part) when the join response says the user has no profile. The buyer still lands on the item they came for, with the dashboard layout's `completeProfile` effect showing the prompt on top. If URL parsing throws, it falls back to string concatenation with `?` or `&`.

## Exports
- `DEEPLINK_INTENTS` - readonly tuple `["join-office", "item-deeplink"]`.
- `type DeeplinkIntent` - union of those strings.
- `isDeeplinkIntent(intent: string | null | undefined): intent is DeeplinkIntent` - type guard.
- `DEEPLINK_PARAMS` - readonly tuple of the forwarded query-param names.
- `forwardDeeplinkParams(from: URLSearchParams, to: URLSearchParams): URLSearchParams` - copy present deep-link params; returns `to`.
- `buildOfficeJoinLoginUrl(opts: { orgId; orgSlug; referCode?; redirect }): string` - build the `/login` join URL.
- `safeRedirect(raw: string | null | undefined, fallback: string): string` - constrain a redirect to this origin.
- `withCompleteProfile(destination: string, needsProfile: boolean): string` - add `completeProfile=true` when needed.

## Dependencies
- **Internal:** none.
- **Packages:** none (uses the built-in `URL` / `URLSearchParams`).

## Used by
- `app/(auth)/verify/page.tsx` (route `/verify`)
- `app/guest/[slug]/article/[postId]/ArticlePageClient.tsx` (route `/guest/[slug]/article/[postId]`)
- `app/guest/[slug]/post/[postId]/PostPageClient.tsx` (route `/guest/[slug]/post/[postId]`)
- `components/welcome/Welcome.tsx`

## Notes
- **Security-sensitive:** `redirect` is attacker-controllable and is handed to `router.push` immediately after a successful login. Always pass it through `safeRedirect` before navigating; otherwise a crafted `/login?intent=join-office&...&redirect=https://evil.example` turns a genuine Garage login into a phishing hand-off.
- `flow` is set by `buildOfficeJoinLoginUrl` but is not in `DEEPLINK_PARAMS`, so it is not forwarded to `/verify`.
