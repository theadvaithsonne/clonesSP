# `app/(auth)/login/page.tsx`

> Server page for `/login`. It renders the shared `Welcome` sign-in screen and, when the link carries a referral code, builds Open Graph and Twitter preview tags that name the referrer ("<Name> is inviting you to join Garage").

**Kind:** Next.js page · **Lines:** 152 · **Route:** `/login`

## Purpose
Invite links and affiliate share links point at `/login`. The app's own invite links carry `?referCode=`, and storefront and Grow Your Network links carry `?ref=`. People mostly paste these links into WhatsApp and other chat apps, whose crawlers never run client-side JavaScript. This file is a server component, so it can look up the referrer on the server and put their name and photo in the link preview. That makes the preview read as a personal invitation instead of a bare login link. The page body is the same client `Welcome` component used at `/`.

## How it works
### `generateMetadata({ searchParams })` (L65-L132)
1. Reads `referCode` from the awaited `searchParams`, or `ref` if `referCode` is absent.
2. If there is no code, returns `{}`, so the root layout's default metadata applies unchanged.
3. Fetches `${API_BASE}/affiliate/referrer-info?light=1&affiliateId=<code>` with `next: { revalidate: 300 }`, which caches the result for 5 minutes. `light=1` asks only for the sponsor card (id, name, photo, code) and skips the expensive downline statistics. That matters because crawlers hit these links in bursts.
4. Returns `{}` if the response is not OK, if `success` is false, or if the referrer's trimmed name is empty. The backend returns `""` for users with no name, and a generic card is better than "undefined is inviting you".
5. Builds the title `"<name> is inviting you to join Garage"` and a matching description.
6. Picks the preview image. It uses the referrer's `profilePicture`, passed through `toAbsoluteImageUrl`. If that returns nothing usable, it uses `/icon.png` (`OG_IMAGE`): the 1024x1024 Garage mark on a dark tile. The source prefers this over the white wordmark because the wordmark disappears on the white backgrounds chat apps use.
7. Returns `title`, `description`, `openGraph` and `twitter`. `openGraph` has the canonical URL `${getSiteUrl()}/login?referCode=<code>`, `siteName: "Garage"`, `type: "website"` and the image. `twitter` uses `card: "summary"`, which keeps a square photo square; the large-image card would crop it to a wide banner.
8. If anything throws, returns `{}`. The page still works without the personalised card.

### Helpers
- `getSiteUrl()` (L7-L13): returns the absolute site origin. It tries `NEXT_PUBLIC_APP_URL`, then `https://${VERCEL_PROJECT_PRODUCTION_URL}`, then `https://${VERCEL_URL}`, and finally falls back to `https://my.garage.app`.
- `toAbsoluteImageUrl(src)` (L34-L41): crawlers fetch images with no page context, so only absolute URLs work. A protocol-relative `//host/...` URL gets `https:` in front. A root-relative `/path` gets the site origin in front. An `http(s)://` URL is kept as is. Anything else, including `data:` URIs, returns `null`.

### Page (L134-L151)
`LoginPage` renders `<Welcome />` inside `<Suspense>`, with `WelcomeLoadingFallback` as the fallback. That fallback is a pulsing skeleton identical to the one in `app/(auth)/WelcomeRootClient.tsx`. `Welcome` is a client component and does the real work: OTP login, capturing the referral code from `ref` or `referCode`, and handling deep-link and redirect parameters.

## Exports
- `default LoginPage()`: the page component.
- `generateMetadata({ searchParams }: Props): Promise<Metadata>`: the Next.js per-request metadata hook described above.

## Interfaces
- **Backend endpoints called:** `GET /backend/affiliate/referrer-info?light=1&affiliateId=<code>`, called on the server while metadata is generated. `server/routes/affiliate.ts` serves it (mounted at `/affiliate`). With `light=1` the route calls `getSponsorCardByAffiliateId` in `server/services/affiliate.ts`. That function checks the code's format, looks up the `User` by `affiliateId` and returns `{ id, name, profilePicture, affiliateCode }`; when there is no match, the route answers 404.
- **Environment variables:**
  - `NEXT_PUBLIC_API_URL`: backend base URL for the referrer lookup. Defaults to `http://localhost:4000`.
  - `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`: tried in that order by `getSiteUrl()` to build absolute preview URLs.

## Dependencies
- **Internal:** `components/welcome/index.ts`: re-exports `Welcome`.
- **Packages:** `next`: the `Metadata` type and the `generateMetadata` convention. `react`: `Suspense`.

## Used by
Reached at the URL `/login` and wrapped by `app/(auth)/layout.tsx`. Many places link to it, for example the "Sign in here" link in `app/(auth)/guest-login/GuestLogin.tsx`. It is also where affiliate and invite share links land.

## Notes
- In the combined project, `NEXT_PUBLIC_API_URL` is `<app origin>/backend`. This server-side fetch therefore goes back into the same Node process and reaches the Express app. The `http://localhost:4000` fallback is the port of the old standalone backend. If the variable were unset, every lookup would fail silently and every preview would show the generic card.
- The canonical preview URL always uses `referCode=`, even when the incoming link used `ref=`. `Welcome` accepts both.
