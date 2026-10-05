import "dotenv/config";

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  MONGODB_URI: process.env.MONGODB_URI ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "",

  // ============ Admin step-up verification ============
  // Secret salt mixed into every admin verification answer before hashing.
  // The answers themselves ("7", "Ferrari") carry almost no entropy, so the
  // stored bcrypt hash is only meaningful while this value stays out of the
  // repo and out of the database. Rotating it invalidates every stored
  // answer — they have to be re-seeded.
  ADMIN_VERIFY_PEPPER: process.env.ADMIN_VERIFY_PEPPER ?? "",
  // Kill switch. Set to "off" to stop enforcing the gate without a deploy —
  // the recovery path if the only super admin locks himself out.
  ADMIN_VERIFY_ENFORCE: process.env.ADMIN_VERIFY_ENFORCE ?? "on",
  NODE_ENV: process.env.NODE_ENV ?? "development",

  // Sentry (server-side error tracking, @sentry/node). Disabled until SENTRY_DSN
  // is set, so it's safe to deploy without any env change.
  SENTRY_DSN: process.env.SENTRY_DSN || "",
  SENTRY_ENV: process.env.SENTRY_ENV || "",
  SENTRY_TRACES_SAMPLE_RATE: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),

  // Resend configuration
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  RESEND_FROM: process.env.RESEND_FROM || "",

  // 2Factor.in SMS OTP delivery. We generate + verify the OTP locally
  // (services/otp.ts, Mongo-backed); 2Factor is only the SMS pipe. Empty
  // API key disables SMS send (the phone-verify routes 503 cleanly), so
  // this is safe to deploy before the key is set.
  TWO_FACTOR_API_KEY: process.env.TWO_FACTOR_API_KEY || "",
  // 2Factor template name. "OTP1" is what actually delivers on the current
  // account — both for Indian and international numbers. Kept in env so it
  // can be swapped without a deploy if the account's templates change.
  TWO_FACTOR_OTP_TEMPLATE: process.env.TWO_FACTOR_OTP_TEMPLATE || "OTP1",
  // 11za WhatsApp OTP — the second delivery channel alongside 2Factor SMS.
  // Without ELEVENZA_AUTH_TOKEN + ELEVENZA_OTP_TEMPLATE the WhatsApp send is
  // skipped and SMS carries the OTP on its own.
  ELEVENZA_AUTH_TOKEN: process.env.ELEVENZA_AUTH_TOKEN || "",
  ELEVENZA_ORIGIN_WEBSITE: process.env.ELEVENZA_ORIGIN_WEBSITE || "garage.app",
  ELEVENZA_OTP_TEMPLATE: process.env.ELEVENZA_OTP_TEMPLATE || "",
  ELEVENZA_OTP_LANGUAGE: process.env.ELEVENZA_OTP_LANGUAGE || "en",

  // Meta WhatsApp Cloud API webhook (routes/whatsappWebhook.ts).
  //   WHATSAPP_VERIFY_TOKEN — must match the "Verify token" typed in the
  //     Meta App Dashboard; empty => GET verification 503s.
  //   WHATSAPP_APP_SECRET — Meta App Secret for POST signature verification;
  //     empty => signature check skipped (ok for the unpublished sandbox).
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || "",
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || "",

  // Google sign-in (POST /auth/google). Comma-separated OAuth client IDs the
  // apps sign in with (the iOS client, the Android client, and the Web client
  // used as `webClientId`); an ID token whose audience isn't one of these is
  // refused. Empty disables the route with a clean 503.
  GOOGLE_OAUTH_CLIENT_IDS: (process.env.GOOGLE_OAUTH_CLIENT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

  // UploadThing configurations
  UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET || "",

  // EarnGPT API configuration
  EARN_GPT_API_KEY: process.env.EARN_GPT_API_KEY || "",

  // AWS S3 configuration
  AWS_S3_REGION: process.env.AWS_S3_REGION || "",
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || "",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT || "",
  AWS_S3_FORCE_PATH_STYLE: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
  /**
   * Separate, PRIVATE bucket for office KYC documents (PAN cards, address
   * proofs, government IDs). "Block all public access" is on for this bucket,
   * so nothing here is ever reachable by URL — every read goes through a
   * short-lived presigned GET minted by services/orgKycStorage.ts.
   *
   * Deliberately its own variable: AWS_S3_BUCKET stays the general-purpose
   * public bucket used by uploads, cabinet, recordings and tickets. Nothing
   * outside the KYC service should read this one.
   */
  AWS_S3_KYC_BUCKET: process.env.AWS_S3_KYC_BUCKET || "",

  // ── Crypto payments ─────────────────────────────────────────────
  //
  // Every crypto watcher / poller / sweeper / gas-float service that
  // used to live on this backend has moved to the sibling
  // garage-crypto-backend (https://crypto.garage.app). What remains
  // on main is the payment REQUEST creation path only — the vars
  // below are the platform receiving addresses that `createRequest`
  // stamps on new CryptoPaymentRequest rows (plus the mnemonic that
  // derives the per-invoice HD address), and the TTL for expiring
  // unfunded requests.
  //
  // If you need the sweeper / watcher env vars back, they now live
  // in garage-crypto-backend's .env — not here.
  PLATFORM_USDT_TRC20_ADDRESS: process.env.PLATFORM_USDT_TRC20_ADDRESS || "",
  PLATFORM_USDT_POLYGON_ADDRESS: process.env.PLATFORM_USDT_POLYGON_ADDRESS || "",
  PLATFORM_USDT_BEP20_ADDRESS: process.env.PLATFORM_USDT_BEP20_ADDRESS || "",
  PLATFORM_USDC_POLYGON_ADDRESS: process.env.PLATFORM_USDC_POLYGON_ADDRESS || "",

  // Native-coin platform addresses. These ARE the platformAddress on
  // the (ethereum, ETH), (polygon, POL) and (bitcoin, BTC) chain configs
  // — they must stay on this backend because createRequest reads them
  // when a buyer picks a native coin as the payment method.
  //
  // Polygon POL uses the SAME 0x address as USDT/USDC on Polygon (one
  // seed → one 0x address across every EVM chain), so
  // `CRYPTO_HOT_WALLET_ADDRESS_POLYGON` falls back to the Polygon USDT
  // address when unset — the same fallback pattern the crypto backend
  // already applies.
  CRYPTO_HOT_WALLET_ADDRESS_ETHEREUM:
    process.env.CRYPTO_HOT_WALLET_ADDRESS_ETHEREUM ||
    process.env.PLATFORM_USDT_POLYGON_ADDRESS ||
    "",
  CRYPTO_HOT_WALLET_ADDRESS_POLYGON:
    process.env.CRYPTO_HOT_WALLET_ADDRESS_POLYGON ||
    process.env.PLATFORM_USDT_POLYGON_ADDRESS ||
    "",
  CRYPTO_HOT_WALLET_ADDRESS_BITCOIN:
    process.env.CRYPTO_HOT_WALLET_ADDRESS_BITCOIN || "",

  // HD wallet — one BIP39 seed derives per-invoice deposit addresses.
  // Both vars stay on main because allocateAddress (called by
  // createRequest) reads them.
  CRYPTO_WALLET_MNEMONIC: process.env.CRYPTO_WALLET_MNEMONIC || "",
  CRYPTO_HD_ENABLED_CHAINS: process.env.CRYPTO_HD_ENABLED_CHAINS || "",

  // How long a per-invoice deposit address stays pending before the
  // TTL cron on garage-crypto-backend marks it expired. Read here so
  // createRequest can stamp `expiresAt` on the row it inserts.
  // Mailcow configuration
  MAILCOW_API_URL:
    process.env.MAILCOW_API_URL || "https://mail.networkmail.com",
  MAILCOW_API_KEY_READ: process.env.MAILCOW_API_KEY_READ || "", // Read-only key for GET endpoints
  MAILCOW_API_KEY_WRITE: process.env.MAILCOW_API_KEY_WRITE || "", // Read-write key for POST/PUT/DELETE

  // Mail Proxy API (for IMAP/SMTP when direct connection is blocked)
  MAIL_PROXY_URL: process.env.MAIL_PROXY_URL || "",
  MAIL_PROXY_API_KEY: process.env.MAIL_PROXY_API_KEY || "",

  // ONLYOFFICE Document Server configuration
  ONLYOFFICE_URL: process.env.ONLYOFFICE_URL || "http://64.227.138.95",
  ONLYOFFICE_JWT_SECRET: process.env.ONLYOFFICE_JWT_SECRET || "secret",

  // APNs (Apple Push Notification Service) configuration for VoIP
  APNS_KEY_ID: process.env.APNS_KEY_ID || "",
  APNS_TEAM_ID: process.env.APNS_TEAM_ID || "",
  APNS_KEY_PATH: process.env.APNS_KEY_PATH || "", // Path to .p8 file
  APNS_KEY_CONTENT: process.env.APNS_KEY_CONTENT || "", // Alternative: key content as string
  APNS_BUNDLE_ID: process.env.APNS_BUNDLE_ID || "com.garageapp.hq",
  // NetworkChains' bundle id, for its CallKit VoIP pushes (same APNs key:
  // one key serves every app in the Apple team).
  NETWORKCHAIN_APNS_BUNDLE_ID:
    process.env.NETWORKCHAIN_APNS_BUNDLE_ID || "com.networkchain.app",
  APNS_PRODUCTION: process.env.APNS_PRODUCTION === "true",

  // Firebase Admin (direct FCM) configuration for Android knock-call delivery.
  // Provide ONE of these — JSON wins if both are set.
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "",
  FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "",

  // Bulk email notifications
  ENABLE_BULK_EMAILS: process.env.ENABLE_BULK_EMAILS === "true",
  // Authors whose NEW-POST blasts are muted, comma-separated, case-insensitive.
  // "*" mutes new-post emails for everyone. Posts only — every other bulk email
  // is unaffected. Exists so test posts don't mail every org member; clearing
  // the value and restarting lifts it, no deploy needed. See
  // notifyNewFeedPostCreated.
  FEED_POST_EMAIL_MUTED_AUTHORS: (process.env.FEED_POST_EMAIL_MUTED_AUTHORS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  // Internal service-to-service API key
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || "",

  // Public analytics endpoints (XAQI partner integration). Sent in
  // X-API-KEY header on /public/analytics/* requests; verified by
  // requireAnalyticsKey middleware. One shared value across all callers.
  ANALYTICS_API_KEY: process.env.ANALYTICS_API_KEY || "",

  // Franchise app (roam-admin-prod) shared secret for /franchise-api/*
  // Sent in X-Franchise-API-Key header. Required for territory wallet reads.
  FRANCHISE_API_KEY: process.env.FRANCHISE_API_KEY || "",

  // Note-Taker bot (webinar transcription + AI summary)
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379/3",

  // OpenClawApi service-to-service
  // Base URL of the OpenClawApi service (without trailing /api).
  // Falls back to the legacy OPENCLAW_AGENT_MANAGER_URL (which was scoped to /agent-manager)
  // so existing deployments keep working during the migration.
  OPENCLAW_API_URL:
    process.env.OPENCLAW_API_URL ||
    process.env.OPENCLAW_AGENT_MANAGER_URL ||
    "https://openclaw.marketsverse.com",
  // Shared secret sent as `Authorization: Bearer <secret>` on every
  // OpenClawApi call. Must match OPENCLAW_SERVICE_SECRET on OpenClawApi.
  // Empty during rollout — the OpenClawApi middleware is a no-op until both
  // sides set this.
  OPENCLAW_SERVICE_SECRET: process.env.OPENCLAW_SERVICE_SECRET || "",

  // OpenClaw LLM gateway — used for the "shared agent" branch of /openclaw-chat
  // where the personal-agent path doesn't apply. Calls /v1/chat/completions SSE.
  OPENCLAW_GATEWAY_URL:
    process.env.OPENCLAW_GATEWAY_URL || "http://139.59.57.131:18789",
  OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_AUTH_TOKEN || "",
  // Default agent id if the user has no personal agent + no email-map hit.
  OPENCLAW_DEFAULT_AGENT_ID: process.env.OPENCLAW_AGENT_ID || "main",
  // Comma-separated email:agentId pairs, e.g. "alice@x.com:ag_abc,bob@x.com:ag_xyz"
  OPENCLAW_USER_AGENT_MAP: process.env.OPENCLAW_USER_AGENT_MAP || "",

  // ── Catalog mirror (Garage → NetworkChainApi) ────────────────────────
  // Bearer token NetworkChainApi sends when calling /internal/catalog/*.
  // Empty string disables the route (returns 503) — flip when both sides
  // have the same value set.
  OPENCLAW_NC_SERVICE_SECRET: process.env.OPENCLAW_NC_SERVICE_SECRET || "",
  OPENCLAW_NC_SERVICE_SECRET_PREVIOUS:
    process.env.OPENCLAW_NC_SERVICE_SECRET_PREVIOUS || "",

  // Where the outbox dispatcher posts catalog change webhooks. Falls back to
  // OPENCLAW_API_URL since they're the same service.
  OPENCLAW_NC_URL:
    process.env.OPENCLAW_NC_URL ||
    process.env.OPENCLAW_API_URL ||
    "http://localhost:8000",

  // HMAC secret used to sign catalog webhooks. Must match
  // GARAGE_CATALOG_WEBHOOK_SECRET on NetworkChainApi.
  OPENCLAW_GARAGE_WEBHOOK_SECRET:
    process.env.OPENCLAW_GARAGE_WEBHOOK_SECRET || "",

  // Disable the outbox dispatcher in environments where it shouldn't run
  // (e.g. CI, scripts). Empty/undefined = enabled.
  CATALOG_OUTBOX_DISPATCH_DISABLED:
    process.env.CATALOG_OUTBOX_DISPATCH_DISABLED === "true",
};
