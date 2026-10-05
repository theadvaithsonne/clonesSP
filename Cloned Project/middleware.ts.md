# `middleware.ts`

> The Next.js Edge middleware: it looks at the incoming Host header and rewrites requests for special domains (the admin back office, the yourmoneyback.info lost-money site, organisers' custom event domains, and link-preview crawlers on bat246.com) to the app routes that serve them.

**Kind:** project config / root file · **Lines:** 189

## Purpose
One Next.js deployment serves several public domains. Most hosts get the normal app, but some domains should show only one subtree: `admin.garage.app` shows only `app/garage-admin/*`, `yourmoneyback.info` shows only the BAT246 lost-money pages, and an organiser's verified custom domain shows only that event's page. This file does that mapping with `NextResponse.rewrite`, so the browser keeps the short URL while Next renders the internal route. It runs in the Edge runtime, so it imports only small modules with no imports of their own (`lib/admin-domain.ts`, `lib/lostmoney-domains.ts`).

## How it works
The host is read from the `host` header with the port removed and lower-cased. The code says `nextUrl.hostname` is not reliable in `next dev`. The rules are checked in this order:

1. **bat246.com link previews (L101-L117).** The host matches `BAT246_HOST_RE` (bat246.com or any subdomain), the user agent matches `LINK_PREVIEW_BOT_RE` (WhatsApp, facebookexternalhit, Twitterbot, TelegramBot, Slackbot, LinkedInBot, Discordbot and others; search engines are left out on purpose), and the path has no file extension. The request is then rewritten to `/api/link-preview/bat246` with the query string removed. The original path and query go to the handler in an `x-link-preview-path` request header, because query params set on a rewrite target do not reach the route handler. That handler (`app/api/link-preview/bat246/route.ts`) returns a small "BAT 246" preview card. Real visitors never reach it.

2. **Hosts not in `PATH_DOMAIN_MAP`: event-domain lookup (L119-L152).**
   - These pass straight through with `NextResponse.next()`: `localhost`, `127.0.0.1`, the value of `NEXT_PUBLIC_APP_HOST`, any `*.vercel.app` host, and any path with a file extension.
   - For any other host, `resolveEventDomain(host)` calls `GET ${NEXT_PUBLIC_API_URL}/public/event-management/resolve-domain?host=...`. In the combined project that is `GET /backend/public/event-management/resolve-domain`. The call has a 2-second `AbortSignal.timeout`. The backend handler (`server/routes/publicEventManagement.ts`) returns a slug only when an `EventWebsiteConfig` has a **verified** `domain.host` and its `EventProgram` is published, public and not deleted. On any error it returns `slug: null`.
   - Results are cached per isolate in `eventDomainCache` for `EVENT_DOMAIN_TTL_MS` (5 minutes). Misses (`null`) and fetch failures are cached too, so an unmapped host costs one round trip per 5 minutes rather than one per request.
   - When there is no slug, the request passes through. Paths in `EVENT_DOMAIN_PASSTHROUGH` (`/invoice/`, `/_next/`) also pass through. The `/invoice/` exemption exists because checkout opens `/invoice/<number>` to take payment, and rewriting it under the event would 404.
   - Any other path is rewritten to `/events/<slug><path>`, and `/` maps to `/events/<slug>`. These are served by `app/events/[id]/...`, for example `/ticket/<token>`.

3. **Mapped domains (L154-L183).** `PATH_DOMAIN_MAP` maps each host in `LOSTMONEY_CUSTOM_DOMAIN_HOSTS` (`yourmoneyback.info`, `www.yourmoneyback.info`) to `/games/bat246/lostmoney/index`, and `ADMIN_APP_DOMAIN` (`admin.garage.app`) to `/garage-admin`.
   - Paths with a file extension pass through. Without this, `/logo-icon.svg` would become `/garage-admin/logo-icon.svg` and 404.
   - On the lost-money hosts only, `LOSTMONEY_ROUTE_ALIASES` rewrites the site's short nav paths: `/home`, `/aboutus` (to `.../index/about`), `/paidlist` (to `.../index/paid`), `/testimonials` and `/register`. These are limited to those hosts so that, for example, `/register` on the admin host is not hijacked.
   - Any path that does not already start with the target is prefixed with it. So `/login` on the admin host becomes `/garage-admin/login`, while `/garage-admin/login` passes through unchanged. Both URL shapes work, which kept the roughly 290 hardcoded `/garage-admin/...` links in the admin section working.

`config.matcher` runs the middleware on every path except `_next/static`, `_next/image`, `favicon.ico` and `api/...`.

## Exports
- `middleware(request: NextRequest): Promise<NextResponse>` - the Edge middleware described above.
- `config` - `{ matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"] }`.

## Interfaces
- **Backend endpoints called:** `GET /backend/public/event-management/resolve-domain?host=<host>` - maps a custom host to an event slug. Returns `{ success, slug }`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base for the domain lookup (default `http://localhost:4000`). `NEXT_PUBLIC_APP_HOST` - the app's own host, which skips the lookup. This file is the only place in the repo that reads it.
- **Background work:** none. There is only an in-memory, per-isolate `Map` cache with a 5-minute TTL.

## Dependencies
- **Internal:** `lib/lostmoney-domains.ts` - `LOSTMONEY_CUSTOM_DOMAIN_HOSTS`, the yourmoneyback.info host list. `lib/admin-domain.ts` - `ADMIN_APP_DOMAIN` (`admin.garage.app`).
- **Packages:** `next` (`next/server`) - `NextResponse`, `NextRequest`.

## Used by
Nothing imports this file. Next.js picks it up by convention as the root `middleware.ts`, and it runs for every page request handled by Next. In the combined server (`server/main.ts`), requests to `/backend/*`, to `BACKEND_HOSTS` and to `/socket.io/*` are sent to Express or Socket.IO before Next sees them, so this middleware never runs for backend traffic.

## Notes
- `BAT246_HOST_RE` duplicates `isBat246Domain()` in `lib/bat246Office.ts`, which is client-only and cannot be imported here. Keep the two in sync.
- If `NEXT_PUBLIC_APP_HOST` is not set, requests on the main production host (and on any other unmapped domain, such as bat246.com) trigger the event-domain lookup. It is cached, but it is still one backend call per host per isolate every 5 minutes.
- The comment says failures are cached "briefly", but they use the same 5-minute TTL as successes. While the cache entry lives, a domain that was just verified or just failed can take up to 5 minutes per isolate to start resolving.
- The backend only resolves *verified* domains. That check is what stops someone from serving their event on a domain they have not proven they own.
- The admin-domain rewrite is URL routing only. It is not access control; the `garage-admin` layout does the auth.
