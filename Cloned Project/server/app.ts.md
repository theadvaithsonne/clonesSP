# `server/app.ts`

> Builds the single Express application for the backend: global middleware, the PostHog and crypto-backend proxies, raw-body webhook endpoints, the garage-admin RBAC gate, and the mount point of every backend router.

**Kind:** backend module · **Lines:** 804

## Purpose
This file is the backend's routing table. It creates the Express `app` and wires about 230 route modules to their URL prefixes. It does not listen on a port and does no boot work such as connecting to Mongo or starting crons. `server/index.ts` (standalone backend) and `server/main.ts` (the combined Next.js + Express process) import it and run it. In the combined process, `server/main.ts` strips `/backend` before handing a request to this app. So a prefix mounted here as `/floors` is reached by the browser at `/backend/floors/...`, and at `/floors/...` directly on hosts listed in `BACKEND_HOSTS`. Every path in this doc is relative to the app root. Add `/backend` to get the browser URL.

## How it works

Express runs middleware in the order it is registered, so order matters throughout this file. The sections below follow the file from top to bottom.

### 1. Imports and env (L1-L242)
- The file imports every router statically. `supportTicketsRoutes` is imported but never mounted (see Notes). The `userActivity` import is commented out because the Team Activity frontend was retired. The comment says the `UserActivity` writes in `realtime/socket.ts` are kept.
- `dotenv.config()` is called at L242. In the compiled CommonJS output, all the `require`s above it run first. A route module that reads `process.env` at load time therefore depends on env having been loaded earlier, for example by `server/bootstrap-env.ts` or `server/instrument.ts`.
- `app.use(cors())` (L246) uses the default `cors` options. Every origin is allowed.

### 2. PostHog reverse proxy (L257-L290)
- Mounted before any body parser, so large session-replay batches from the web and React Native apps stream through unchanged.
- `/ingest/*` goes to `POSTHOG_HOST` (default `https://us.i.posthog.com`), with the `/ingest` prefix removed. `onProxyReq` strips the `authorization`, `cookie` and `x-org-id` headers so PostHog never receives credentials.
- `/ingest-static/*` goes to the assets host, `/static/*`. The assets host is computed by replacing `us.i.posthog.com` with `us-assets.i.posthog.com`.
- The comment explains why the proxy exists: a first-party URL is not blocked by ad-blockers. It also explains why `http-proxy-middleware` is pinned to v2: v3 is ESM-only and cannot be `require()`d under Sentry's hook.

### 3. Crypto backend proxy (L300-L313)
- Only active when `CRYPTO_BACKEND_URL` is set. It sends `/garage-admin/sweeper/*` to the separate garage-crypto-backend service (`changeOrigin`, `xfwd`) and logs a `[crypto-proxy]` line at startup.
- There is no local sweeper route. Without the env var, these paths return 404.

### 4. Signed webhooks with a raw body (L319-L351)
These routes need the exact request bytes to verify signatures, so they are mounted before `express.json()` and each uses `express.raw`:

| Prefix | Router | Raw type |
|---|---|---|
| `/webhooks/nowpayments` | `nowpaymentsWebhook` | `application/json` |
| `/webhooks/stripe` | `stripeWebhook` | `application/json` |
| `/webhooks/daily` | `dailyWebhook` | `application/json` |
| `/webhooks/livekit` | `livekitWebhookRouter` (named export of `livekitRecording`) | `*/*`, because LiveKit sometimes sends `application/webhook+json` |
| `/webhooks/whatsapp` | `whatsappWebhook` (Meta Cloud API, X-Hub-Signature-256) | `application/json` |
| `/webhooks` | `webhook` (generic, e.g. Razorpay) | `application/json` |

The specific prefixes come before the generic `/webhooks` router so that it does not catch them first.

### 5. Body parsing and basic endpoints (L358-L406)
- `express.json` and `express.urlencoded` with a **50mb** limit. Creation forms for courses, communities and services post large JSON documents, and the 100kb default returned 413. Then `cookieParser()`.
- `GET /health` returns `{ ok: true }`.
- `GET /debug/crypto-module` is marked as a **temporary diagnostic** (2026-07-03). It dynamically imports `./services/cryptoPaymentRequest` and reports:
  - the resolved file path and the module's export keys;
  - the `typeof` of `createRequest`, `findPendingByAmount`, `markMatched` and `expireStaleRequests`;
  - the first 10 lines of the file on disk;
  - the Node version, PID and uptime.

  The comment says to delete it once the crypto payment flow works end to end.

### 6. Garage-admin access gate (L420-L429)
- `garageAdminVerifyRoutes` is mounted at `/garage-admin` first. Its step-up verification endpoints therefore still answer while the rest of the console refuses an admin who has not verified.
- `garageAdminPageGate` then `requireAdminVerified` run for every `/garage-admin/*` request that reaches this point:
  - `garageAdminPageGate` (in `middleware/garageAdminAuth.ts`) builds the full path from `req.baseUrl + req.path`, maps it to an admin page key through `resolveAdminPath`, loads the admin from the token, and checks their level for that page.
  - Super admins bypass the check. A path that maps to no page requires super admin, so new admin routes are locked by default.
  - `requireAdminVerified` returns 403 `ADMIN_VERIFICATION_REQUIRED` for a gated admin who has not verified, except on `/garage-admin/profile` and `/garage-admin/admin-pages`.
- The same gate pair also covers admin surfaces outside `/garage-admin`:
  - all of `/ai-providers`;
  - `/coworking-bookings/admin`;
  - `/whitelabel-addon/admin`;
  - `/cryptosub-addon/admin`.

  For the coworking, whitelabel and cryptosub routers, only the `/admin` subtree is gated. Their member endpoints stay open.
- Individual admin routers still call `requireGarageAdminAuth` per route. The comment says that call short-circuits on the context the gate already attached.

### 7. Public, checkout and partner surfaces (L432-L539)
- **SSO and public pages:**
  - `/sso`.
  - Public calculators: `/public/unilevel-plus`, `/public/rank-bonus`, `/public/founder-products`, `/public/founders-office`, `/public/white-label`.
  - `/public/bonds` is mounted before the catch-all `/public` router.
  - `/platform`: the office grace programme, authenticated by user JWT plus an `X-Garage-Platform` key.
  - `/public`, then `/public/events`, `/public/event-management`, `/public/f` (public cabinet files), `/public/meet`, `/public/webinar`, `/public/analytics`, `/public/fx`, `/public/announcements`.
  - `/simulated-audience`.
- **Pre-login and guest:** `/office`, `/workshop-preview`, `/guest-auth`, `/discover`.
- **Checkout:**
  - Ten routers share `/checkout`: product, course, workshop, channel, GST quote, service, call, coupon validation, platform coupon validation, rewards. Express tries them in this order.
  - `/checkout/office` and `/checkout/office-addon`.
- **Add-ons and finance products:** `/whitelabel-addon` (the $600/yr invoice-based add-on, separate from the legacy $299 Razorpay route), `/cryptosub-addon`, `/hifi`, `/bonds`.
- **Jobs and content:**
  - `/careers` is the legacy vacancies feature.
  - `/jobs/founder` is mounted before `/jobs`, so the founder routes take precedence over the candidate routes.
  - `/content-engagement`, `/content-campaigns`, `/social-accounts`, `/social-oauth`, `/content-submissions`.
- **Invoicing:** `/api/invoices`, `/api/ecommerce`, `/api/counter-bills`, `/payment-methods`.
- **Third-party partner API:**
  - Two routers share `/api/v1/third-party` and use API-key auth: invoices, plus wallet credits behind their own `wallet:credit` scope with guards attached per route.
  - `/api/third-party` is the end-user, session-authenticated view of subscriptions.
- **Franchise:**
  - `/franchise-api` is read-only and requires the `X-Franchise-API-Key` header.
  - `/franchise-program`.
  - `/franchise-global-public` must come before `/franchise-global` so its `/assignments/all` route wins.
  - `/franchise-entity`.
  - `/franchise` is browser-facing and uses JWT. The comment notes that `/franchise-api` does not collide with it.
- **Other:**
  - `/orgs` (org customers).
  - `/internal/catalog` uses a Bearer service secret.
  - `/internal/push` uses `X-Internal-Api-Key`. It must come before the bare `/internal` router, whose `X-Internal-Token` guard would otherwise reject it.

### 8. Authenticated product routers (L541-L591)
- **Chat:** `/dm`, `/chat` (cross-device chat state), `/conv-state`, `/join-requests`, `/groups`.
- **Auth and org:**
  - `/auth`.
  - `/org` is served by `org` and then `cryptobrandCheckout`.
  - `/org-kyc` has its own prefix so the generic `/org/:orgId` handlers cannot shadow it.
  - `/me` (my office plans), `/invites`, `/team`, `/rbac`.
  - `/users` (last seen). A second router, `userDiscovery`, is also mounted on `/users` at L757.
- **Workspace:** `/apps`, `/floors`, `/tasks`, `/slash/deals`, `/slash/approvals`, `/todos`, `/profile`.
- **Scheduling:**
  - `/calendar`.
  - `/events` is the internal Agora calendar.
  - `/event-management` is the separate Event Management module. The comment at L42 says it is deliberately kept apart from `/events`.
  - `/room-bookings`, `/conference-rooms`, `/missed-calls`.
- **Affiliate and growth:**
  - `/rank-bonus`.
  - `/magic-link`: GET and checkout are public by design.
  - `/affiliate/genealogy` comes first, then three routers share `/affiliate`: `affiliate`, `downlineTable`, `downlineProfile`.
- **Files:** `/cabinet`, `/upload`, `/uploads/public`.

### 9. Garage-admin routers (L595-L666)
- **Leaf routers first.** These are mounted before the generic `garageAdminRoutes` (L638) so their specific paths take precedence over its catch-all and `/:id` handlers:
  - NetworkChain subs, daily reports, one-time affiliates;
  - support, support chats, ignite call, analytics;
  - org KYC review, `/notifications`;
  - affiliate guests, store wallets;
  - the whitelabel, cryptosub and founder-sub monthly-bonus routers;
  - danger zone (destructive super-admin operations);
  - `/announcements`.
- **After the generic router:**
  - `/categories`, `/coupons`, `/wallets`.
  - `/internal` (internal crypto routes, guarded by `X-Internal-Token`).
  - Saved cards and withdrawal preferences, both mounted at `/garage-admin`.
  - `/public/save-card`: the JWT in the request body is the authentication.
  - `/auction-settlements`, `/rank-bonus`, `/referral-bonus`, `/platform-coupons`, `/coupon-rules`, `/coupon-rule-items`, `/users` (admin user search), `/third-party-clients`, `/coworking-spaces`.
  - `/me/rewards` is also mounted in this block.

### 10. Remaining feature routers (L667-L796)
- **Coworking and AI:**
  - `/coworking-bookings`, `/betty`, `/ask-cabinet`, `/link-preview`, `/user-notifications`, `/initial-setup`.
  - `/ai-providers`, already gated by the admin gate in section 6, and `/founder-ai-providers`.
- **OpenClaw:**
  - `/openclaw-agent`, `-messages`, `-jobs`, `-tasks`, `-contexts`, `-integrations`, `/openclaw-templates`, `/openclaw-activity`.
  - `/openclaw-qa` is public.
  - `/openclaw-chat` replaces the old Next.js `/api/openclaw/chat` route.
  - `/openclaw-proxy` is a generic pass-through to OpenClawApi.
- **Webhooks and internal:** `/api/webhooks` (cron webhooks), `/internal/chat`.
- **Calls and media:**
  - `/meet`.
  - `livekitRecording` is mounted twice: at `/livekit`, and at `/workspace/conference` for the Garage HQ mobile app.
  - `/webinar`, `/voice-memos` (proxied to NetworkChains' voice-agent service).
  - `/note-taker/sessions`; `/note-taker` is served by the transcripts and summaries routers.
- **Wallets:**
  - `/wallet`.
  - `/wallet/hq` is internal and requires `X-Internal-Api-Key`, checked per handler.
  - `/territory-wallet`, `/ecommerce` (buyer wallet, SSO Bearer JWT).
- **Social and learning:**
  - `/downlines`, `/feed`, `/deals`, `/workshops`, `/evergreen`.
  - `/courses/video` is mounted before `/courses`.
  - `/playlists`, `/standalone-videos`, `/drops`, `/study-sessions`, `/learn`.
- **Commerce:**
  - `/products`, `/services`, `/reviews`, `/calls`, `/call-bookings`, `/testimonials`, `/comb-plans`, `/unilevel-plus`, `/item-reserves`, `/global-dm`, `/users` (discovery).
  - `/subscriptions`, `/subscription-admin`, `/unified-orders`, `/office-subscription`, `/office-addon-subscription`.
- **Founder coupons:**
  - `/org` (founder coupons).
  - `/org/:orgId/platform-coupons`, `/coupon-eligible-items`, `/coupon-rules`, `/store-commissions`, `/users`.
  - `/cashback-codes`.
- **Settings and HR:**
  - `/devices`, `/settings`.
  - `/garage-university`, followed by `garageUniversityErrorHandler` on the same prefix so errors there stay JSON.
  - `/teamforce`.
- **BAT246:** `/bat246`, `/bat246/lostmoney`, `/bat246/permissions`, `/bat246/layaway`, `/bat246/snapbackloans`, `/bat246/profile`.
- **End of the chain:**
  - `/auctions`.
  - `membershipRoutes` is mounted at `/`. It defines full paths such as `POST /org/:orgId/leave`, `DELETE /auth/account` and `GET /auth/account/status`.
  - `/tickets`, then `/garage-admin/tickets`.

### 11. Error handling (L801)
`Sentry.setupExpressErrorHandler(app)` comes after every route and reports unhandled route errors. `server/instrument.ts` initialises Sentry, which is disabled when `SENTRY_DSN` is unset.

## Exports
- `default app`: the configured `express()` application. It is not listening. Callers pass it to `http.createServer` or call it as `app(req, res)`.

## Interfaces
- **Endpoints served:**
  - `GET /health`: no auth, liveness check.
  - `GET /debug/crypto-module`: no auth, temporary diagnostic.
  - `/ingest/*` and `/ingest-static/*`: PostHog proxy.
  - `/garage-admin/sweeper/*`: crypto backend proxy, only when `CRYPTO_BACKEND_URL` is set.
  - Every other prefix is defined by the mounted routers listed above. In the combined server, the browser path is `/backend<prefix>/...`.
- **External services:**
  - PostHog ingest and assets hosts (proxied).
  - garage-crypto-backend (proxied through `CRYPTO_BACKEND_URL`).
  - Sentry.
- **Environment variables:**
  - `POSTHOG_HOST`: PostHog ingest target, default `https://us.i.posthog.com`.
  - `CRYPTO_BACKEND_URL`: enables the sweeper proxy.
  - `SENTRY_DSN`: read indirectly through Sentry.
  - Values from `.env` are loaded by `dotenv.config()`.

## Dependencies
- **Internal:**
  - `server/middleware/garageAdminAuth.ts` provides `garageAdminPageGate` and `requireAdminVerified`.
  - `server/services/cryptoPaymentRequest.ts` is imported dynamically by the debug endpoint only.
  - The route modules under `server/routes/**`, `server/bat246/routes/**` and `server/note-taker/routes/**` supply every mount. Named exports used: `livekitWebhookRouter`, `garageUniversityErrorHandler`, `adminCouponRuleItemsRouter`, `adminUserSearchRouter`, `founderUserSearchRouter`.
- **Packages:**
  - `express`: the app, body parsers, `express.raw`.
  - `cors`: CORS headers.
  - `cookie-parser`: parses cookies.
  - `http-proxy-middleware` (v2): the PostHog and crypto proxies.
  - `@sentry/node`: the error handler.
  - `dotenv`: loads env.
  - `fs`: dynamic import in the debug endpoint.

## Used by
- `server/main.ts`: the combined entry point. It calls `app(req, res)` for `/backend/*`, with the prefix stripped, and for every path on `BACKEND_HOSTS`.
- `server/index.ts`: the standalone backend boot, `http.createServer(app)`.

## Notes
- **Order is part of the contract.** Many comments describe precedence rules: `/public/bonds` before `/public`, the leaf admin routers before `garageAdminRoutes`, `/internal/push` before `/internal`, `/franchise-global-public` before `/franchise-global`, `/jobs/founder` before `/jobs`, `/courses/video` before `/courses`. Webhook routes must stay above `express.json()`. When adding a router, find a neighbour with the same prefix and decide which one should match first.
- **The sweeper proxy is not behind the admin gate.** It is registered at L300, before the gate at L422, so `garageAdminPageGate` never runs for `/garage-admin/sweeper/*`. Authentication there depends on the crypto backend.
- **The debug endpoint is public.** `/debug/crypto-module` has no auth and exposes the server file path, PID, Node version and source lines. Its own comment says to remove it.
- **Prefixes shared by several routers:** `/checkout` (10), `/org` (3 plus `/org/:orgId/*`), `/affiliate` (3), `/users` (2), `/garage-admin` (many), `/note-taker` (2), `/api/v1/third-party` (2). The first router that sends a response for a path wins.
- **Retired routes:** `supportTicketsRoutes` is imported but its mount at L716 is commented out. The legacy `/support-tickets` endpoint is replaced by `/tickets` and `/garage-admin/tickets`, and the file is kept for rollback. The `/user-activity` router is fully disabled.
- `cors()` without options allows every origin.
