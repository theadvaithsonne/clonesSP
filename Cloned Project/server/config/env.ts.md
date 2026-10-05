# `server/config/env.ts`

> Loads `.env` with dotenv and exposes a typed `env` object holding every backend environment variable, with defaults and light parsing.

**Kind:** backend config · **Lines:** 248

## Purpose
This is the backend's central settings module. Importing it runs `dotenv/config` (so `.env` is loaded into `process.env` before anything reads it) and returns one object, `env`, that the rest of the server reads instead of touching `process.env` directly. Most values default to an empty string, which the consuming feature treats as "disabled" (for example a missing SMS key makes the phone-verify routes answer 503 instead of crashing). It is imported by about 110 files, including the boot path (`server/index.ts`, `server/db/mongo.ts`, `server/instrument.ts`).

## How it works
All values are evaluated once, at first import. Types: numbers via `Number(...)`, booleans via `=== "true"`, lists via comma-split + trim + filter. Grouped by area:

### Core
- `PORT` (default 4000), `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV` (default `development`), `FRONTEND_URL` (default `http://localhost:3000`).

### Admin step-up verification
- `ADMIN_VERIFY_PEPPER` - secret salt mixed into admin verification answers before bcrypt hashing. The answers are low-entropy, so the stored hashes are only meaningful while this stays secret; rotating it invalidates every stored answer.
- `ADMIN_VERIFY_ENFORCE` (default `"on"`) - set to `"off"` to disable the gate without a deploy (recovery path if the only super admin is locked out).

### Observability
- `SENTRY_DSN`, `SENTRY_ENV`, `SENTRY_TRACES_SAMPLE_RATE` (default 0.1). Sentry stays off until a DSN is set.

### Email, SMS, WhatsApp, Google sign-in
- `RESEND_API_KEY`, `RESEND_FROM` - transactional email via Resend.
- `TWO_FACTOR_API_KEY`, `TWO_FACTOR_OTP_TEMPLATE` (default `OTP1`) - 2Factor.in is only the SMS pipe; OTPs are generated and verified locally (`services/otp.ts`).
- `ELEVENZA_AUTH_TOKEN`, `ELEVENZA_ORIGIN_WEBSITE` (default `garage.app`), `ELEVENZA_OTP_TEMPLATE`, `ELEVENZA_OTP_LANGUAGE` (default `en`) - 11za WhatsApp OTP channel; skipped unless token and template are set.
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` - Meta WhatsApp Cloud API webhook (`routes/whatsappWebhook.ts`): empty verify token makes GET verification 503; empty app secret skips signature checks.
- `GOOGLE_OAUTH_CLIENT_IDS` (list) - accepted audiences for `POST /auth/google`; empty disables the route with 503.

### Storage and uploads
- `UPLOADTHING_SECRET`, `EARN_GPT_API_KEY`.
- `AWS_S3_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE` - the general-purpose public bucket.
- `AWS_S3_KYC_BUCKET` - a separate private bucket for office KYC documents; reads only through short-lived presigned URLs from `services/orgKycStorage.ts`.

### Crypto payment requests
The comments state that all crypto watchers, pollers, sweepers and gas-float services moved to the separate garage-crypto-backend (`https://crypto.garage.app`). Only payment-request creation remains here:
- `PLATFORM_USDT_TRC20_ADDRESS`, `PLATFORM_USDT_POLYGON_ADDRESS`, `PLATFORM_USDT_BEP20_ADDRESS`, `PLATFORM_USDC_POLYGON_ADDRESS` - receiving addresses.
- `CRYPTO_HOT_WALLET_ADDRESS_ETHEREUM`, `CRYPTO_HOT_WALLET_ADDRESS_POLYGON` - fall back to `PLATFORM_USDT_POLYGON_ADDRESS` (same 0x address across EVM chains); `CRYPTO_HOT_WALLET_ADDRESS_BITCOIN` has no fallback.
- `CRYPTO_WALLET_MNEMONIC` - BIP39 seed for per-invoice HD deposit addresses (highly sensitive); `CRYPTO_HD_ENABLED_CHAINS` - comma list of chains with HD detection enabled (see `config/cryptoWallets.ts`).

### Mail, documents
- `MAILCOW_API_URL` (default `https://mail.networkmail.com`), `MAILCOW_API_KEY_READ`, `MAILCOW_API_KEY_WRITE` - Mailcow mail-server admin API (read and write keys).
- `MAIL_PROXY_URL`, `MAIL_PROXY_API_KEY` - IMAP/SMTP proxy for when direct connections are blocked.
- `ONLYOFFICE_URL` (default is a hardcoded IP), `ONLYOFFICE_JWT_SECRET` - ONLYOFFICE Document Server.

### Push notifications
- APNs: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_PATH` (path to `.p8`) or `APNS_KEY_CONTENT`, `APNS_BUNDLE_ID` (default `com.garageapp.hq`), `NETWORKCHAIN_APNS_BUNDLE_ID` (default `com.networkchain.app`, for NetworkChains CallKit pushes), `APNS_PRODUCTION`.
- Firebase (Android knock-call FCM): `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` (JSON wins).

### Bulk email
- `ENABLE_BULK_EMAILS` (boolean).
- `FEED_POST_EMAIL_MUTED_AUTHORS` (lower-cased list; `"*"` mutes everyone) - suppresses only new-feed-post email blasts from those authors, so test posts do not mail a whole org.

### Service-to-service keys
- `INTERNAL_API_KEY` - internal calls.
- `ANALYTICS_API_KEY` - `X-API-KEY` for `/public/analytics/*` (XAQI partner), checked by `requireAnalyticsKey`.
- `FRANCHISE_API_KEY` - `X-Franchise-API-Key` for `/franchise-api/*` (roam-admin-prod franchise app).

### Note-taker bot
- `DEEPGRAM_API_KEY` (transcription), `OPENAI_API_KEY` (summaries), `REDIS_URL` (default `redis://localhost:6379/3`, BullMQ queue).

### OpenClaw
- `OPENCLAW_API_URL` - falls back to `OPENCLAW_AGENT_MANAGER_URL`, then a hardcoded default host.
- `OPENCLAW_SERVICE_SECRET` - Bearer secret on every OpenClawApi call.
- `OPENCLAW_GATEWAY_URL` (default is a hardcoded IP:port) - LLM gateway for the shared-agent branch of OpenClaw chat.
- `OPENCLAW_GATEWAY_TOKEN` - **read from `OPENCLAW_AUTH_TOKEN`**.
- `OPENCLAW_DEFAULT_AGENT_ID` - **read from `OPENCLAW_AGENT_ID`** (default `main`).
- `OPENCLAW_USER_AGENT_MAP` - `email:agentId` pairs, comma-separated.

### Catalog mirror (Garage -> NetworkChainApi)
- `OPENCLAW_NC_SERVICE_SECRET`, `OPENCLAW_NC_SERVICE_SECRET_PREVIOUS` - Bearer token NetworkChainApi presents on `/internal/catalog/*` (previous value allows rotation); empty makes the route 503.
- `OPENCLAW_NC_URL` - where catalog-change webhooks go; falls back to `OPENCLAW_API_URL`, then `http://localhost:8000`.
- `OPENCLAW_GARAGE_WEBHOOK_SECRET` - HMAC secret signing those webhooks.
- `CATALOG_OUTBOX_DISPATCH_DISABLED` - `"true"` turns off the outbox dispatcher (CI, scripts).

## Exports
- `env` - the settings object described above.

## Interfaces
- **Environment variables:** all listed above.
- **External services configured here:** Resend, 2Factor.in, 11za, Meta WhatsApp, Google OAuth, UploadThing, AWS S3, Mailcow, ONLYOFFICE, APNs, Firebase, Deepgram, OpenAI, Redis, OpenClaw / NetworkChainApi, garage-crypto-backend, Sentry.

## Dependencies
- **Packages:** `dotenv` - `import "dotenv/config"` loads `.env` from the working directory.

## Used by
`server/index.ts`, `server/instrument.ts`, `server/db/mongo.ts`, `server/realtime/openclawWs.ts`, `server/middleware/garageAdminAuth.ts`, `server/config/cryptoWallets.ts`, controllers (`admin.controller.ts`, `shareableLink.controller.ts`), routes (`auth.ts`, `downlines.ts`, `garageAdminVerify.ts`, `initialSetup.ts`, `internal-catalog.ts`, `invoice.ts`), BAT246 (`bat246.routes.ts`, `bat246BoardInvite.service.ts`), note-taker modules (email sender/template, job queue, summarizer, Deepgram stream), and scripts `scripts/inspect-push-tokens.ts`, `scripts/test-commission-push.ts`, `scripts/test-knock-push.ts`, `scripts/test-transfer-push.ts`, and 85 more.

## Notes
- Several variables are not documented under their own names: `OPENCLAW_GATEWAY_TOKEN` comes from `OPENCLAW_AUTH_TOKEN` and `OPENCLAW_DEFAULT_AGENT_ID` from `OPENCLAW_AGENT_ID`. Set the env names, not the property names.
- Hardcoded fallbacks (L150-L151, L203-L206, L215-L216): `ONLYOFFICE_URL` and `OPENCLAW_GATEWAY_URL` default to raw IP addresses, and `ONLYOFFICE_JWT_SECRET` falls back to a weak, hardcoded placeholder secret when unset. Always set these in production.
- L136-L138 is an orphaned comment about a deposit-address TTL variable that no longer exists; the Mailcow block follows it.
- `JWT_SECRET`, `MONGODB_URI` and `ADMIN_VERIFY_PEPPER` default to empty strings rather than failing fast; the consumers decide how to handle that.
- Not every env var the backend uses goes through here; some modules (e.g. `config/mediasoup.ts`, the monthly-bonus jobs) read `process.env` directly.
