import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { createProxyMiddleware } from "http-proxy-middleware";
import * as Sentry from "@sentry/node";
import authRoutes from "./routes/auth";
import ticketsRoutes from "./routes/tickets";
import garageAdminTicketsRoutes from "./routes/garageAdminTickets";
import orgRoutes from "./routes/org";
import orgKycRoutes from "./routes/orgKyc";
import garageAdminOrgKycRoutes from "./routes/garageAdminOrgKyc";
import cryptobrandCheckoutRoutes from "./routes/cryptobrandCheckout";
import myOfficePlansRoutes from "./routes/myOfficePlans";
import inviteRoutes from "./routes/invites";
import teamRoutes from "./routes/team";
import usersLastSeenRoutes from "./routes/usersLastSeen";
import dmRoutes from "./routes/dm";
import groupsRoutes from "./routes/groups";
import chatRoutes from "./routes/chat";
import conversationStateRoutes from "./routes/conversationState";
import appsRoutes from "./routes/apps";
import floorsRoutes from "./routes/floor";
import tasksRoutes from "./routes/tasks";
import slashDealsRoutes from "./routes/slashDeals";
import slashApprovalsRoutes from "./routes/slashApprovals";
import todosRoutes from "./routes/todos";
import profileRoutes from "./routes/profile";
import affiliateRoutes from "./routes/affiliate";
import genealogyRoutes from "./routes/genealogy";
import downlineTableRoutes from "./routes/downlineTable";
import downlineProfileRoutes from "./routes/downlineProfile";
import publicRoutes from "./routes/public";
import publicUnilevelPlusRoutes from "./routes/publicUnilevelPlus";
import publicFounderProductRoutes from "./routes/publicFounderProduct";
import publicFoundersOfficeRoutes from "./routes/publicFoundersOffice";
import publicWhiteLabelRoutes from "./routes/publicWhiteLabel";
import platformOfficeRoutes from "./routes/platformOffices";
import publicRankBonusRoutes from "./routes/publicRankBonus";
import calendarRoutes from "./routes/calendar";
import eventsRoutes from "./routes/events";
// Event Management module. Deliberately a separate prefix from `eventsRoutes`
// above — that one is the internal Agora calendar and must stay untouched.
import eventManagementRoutes from "./routes/eventManagement";
import publicEventManagementRoutes from "./routes/publicEventManagement";
import cabinetRoutes from "./routes/cabinet";
import bettyRoutes from "./routes/betty";
import uploadRoutes from "./routes/upload";
import uploadsPublicRoutes from "./routes/uploadsPublic";
import garageAdminRoutes from "./routes/garageAdmin";
import garageAdminNetworkChainSubsRoutes from "./routes/garageAdminNetworkChainSubs";
import garageAdminDailyReportsRoutes from "./routes/garageAdminDailyReports";
import garageAdminDangerZoneRoutes from "./routes/garageAdminDangerZone";
import adminNotificationRoutes from "./routes/adminNotifications";
import garageAdminOneTimeAffiliatesRoutes from "./routes/garageAdminOneTimeAffiliates";
import garageAdminSupportRoutes from "./routes/garageAdminSupport";
import garageAdminSupportChatsRoutes from "./routes/garageAdminSupportChats";
import garageAdminIgniteCallRoutes from "./routes/garageAdminIgniteCall";
import garageAdminAnalyticsRoutes from "./routes/garageAdminAnalytics";
import garageAdminAffiliateGuestsRoutes from "./routes/garageAdminAffiliateGuests";
import garageAdminStoreWalletsRoutes from "./routes/garageAdminStoreWallets";
import garageAdminWhitelabelMonthlyBonusRoutes from "./routes/garageAdminWhitelabelMonthlyBonus";
import garageAdminFounderSubMonthlyBonusRoutes from "./routes/garageAdminFounderSubMonthlyBonus";
import garageAdminCryptosubMonthlyBonusRoutes from "./routes/garageAdminCryptosubMonthlyBonus";
import garageAdminOrgCategoriesRoutes from "./routes/garageAdminOrgCategories";
import garageAdminAnnouncementsRoutes from "./routes/garageAdminAnnouncements";
import publicAnnouncementsRoutes from "./routes/publicAnnouncements";
// userActivity routes disabled along with the Team Activity FE retirement.
// The UserActivity model + the connect/disconnect writes that feed
// OnlineActivityTab analytics are intentionally kept (see realtime/socket.ts).
// import userActivityRoutes from "./routes/userActivity";
import askCabinetRoutes from "./routes/askCabinet";
import linkPreviewRoutes from "./routes/linkPreview";
import userNotificationsRoutes from "./routes/userNotifications";
import guestAuthRoutes from "./routes/guestAuth";
import joinRequestsRoutes from "./routes/joinRequests";
import publicEventsRoutes from "./routes/publicEvents";
import publicCabinetRoutes from "./routes/publicCabinet";
import initialSetupRoutes from "./routes/initialSetup";
import aiProvidersRoutes from "./routes/aiProviders";
import founderAiProvidersRoutes from "./routes/founderAiProviders";
import meetRoutes from "./routes/meet";
import publicMeetRoutes from "./routes/publicMeet";
import publicWebinarRoutes from "./routes/publicWebinar";
import simulatedAudienceRoutes from "./routes/simulatedAudience";
import publicAnalyticsRoutes from "./routes/publicAnalytics";
import publicFxRoutes from "./routes/publicFx";
import officeRoutes from "./routes/office";
import supportTicketsRoutes from "./routes/supportTickets";
import walletRoutes from "./routes/wallet";
import walletHqRoutes from "./routes/walletHq";
import territoryWalletRoutes from "./routes/territoryWallet";
import ecommerceWalletRoutes from "./routes/ecommerceWallet";
import downlinesRoutes from "./routes/downlines";
import feedRoutes from "./routes/feed";
import dealsRoutes from "./routes/deals";
import workshopRoutes from "./routes/workshop";
import evergreenRoutes from "./routes/evergreen";
import courseRoutes from "./routes/course";
import courseVideoRoutes from "./routes/courseVideo";
import playlistRoutes from "./routes/playlist";
import standaloneVideoRoutes from "./routes/standaloneVideo";
import dropsRoutes from "./routes/drops";
import productRoutes from "./routes/product";
import combPlanRoutes from "./routes/comb-plan";
import globalDmRoutes from "./routes/globalDm";
import userDiscoveryRoutes from "./routes/userDiscovery";
import workshopPreviewRoutes from "./routes/workshopPreview";
import coworkingSpaceRoutes from "./routes/coworkingSpace";
import coworkingSpaceBookingRoutes from "./routes/coworkingSpaceBooking";
import webhookRoutes from "./routes/webhook";
import subscriptionsRoutes from "./routes/subscriptions";
import subscriptionAdminRoutes from "./routes/subscriptionAdmin";
import productCheckoutRoutes from "./routes/productCheckout";
import courseCheckoutRoutes from "./routes/courseCheckout";
import workshopCheckoutRoutes from "./routes/workshopCheckout";
import channelCheckoutRoutes from "./routes/channelCheckout";
import gstQuoteRoutes from "./routes/gstQuote";
import unifiedOrdersRoutes from "./routes/unifiedOrders";
import officeCheckoutRoutes from "./routes/officeCheckout";
import officeAddonCheckoutRoutes from "./routes/officeAddonCheckout";
import officeAddonStatusRoutes from "./routes/officeAddonStatus";
import whitelabelAddonRoutes from "./routes/whitelabelAddon";
import cryptosubAddonRoutes from "./routes/cryptosubAddon";
import hifiInvoiceRoutes from "./routes/hifiInvoice";
import bondRoutes from "./routes/bond";
import publicBondRoutes from "./routes/publicBond";
import officeSubscriptionAdminRoutes from "./routes/officeSubscriptionAdmin";
import discoverRoutes from "./routes/discover";
import garageAdminCouponsRoutes from "./routes/garageAdminCoupons";
import garageAdminWalletsRoutes from "./routes/garageAdminWallets";
import garageAdminSavedCardsRoutes from "./routes/garageAdminSavedCards";
import garageAdminWithdrawalPreferencesRoutes from "./routes/garageAdminWithdrawalPreferences";
import publicSaveCardRoutes from "./routes/publicSaveCard";
import garageAdminAuctionSettlementsRoutes from "./routes/garageAdminAuctionSettlements";
import garageAdminRankBonusRoutes from "./routes/garageAdminRankBonus";
import garageAdminReferralBonusRoutes from "./routes/garageAdminReferralBonus";
import rankBonusRoutes from "./routes/rankBonus";
import magicLinkRoutes from "./routes/magicLink";
import founderCouponsRoutes from "./routes/founderCoupons";
import couponValidationRoutes from "./routes/couponValidation";
import devicesRoutes from "./routes/devices";
import membershipRoutes from "./routes/membership";
import rbacRoutes from "./routes/rbac";
import serviceRoutes from "./routes/service";
import reviewRoutes from "./routes/review";
import serviceCheckoutRoutes from "./routes/serviceCheckout";
import callRoutes from "./routes/call";
import callBookingRoutes from "./routes/callBooking";
import callCheckoutRoutes from "./routes/callCheckout";
import testimonialsRoutes from "./routes/testimonials";
import ssoRoutes from "./routes/sso";
import openclawAgentRoutes from "./routes/openclawAgent";
import openclawMessagesRoutes from "./routes/openclawMessages";
import openclawJobsRoutes from "./routes/openclawJobs";
import openclawTasksRoutes from "./routes/openclawTasks";
import openclawContextsRoutes from "./routes/openclawContexts";
import openclawIntegrationsRoutes from "./routes/openclawIntegrations";
import openclawCronTemplatesRoutes from "./routes/openclawCronTemplates";
import openclawProxyRoutes from "./routes/openclawProxy";
import openclawQaRoutes from "./routes/openclawQa";
import openclawChatRoutes from "./routes/openclawChat";
import openclawActivityRoutes from "./routes/openclawActivity";
import cronWebhookRoutes from "./routes/cronWebhook";
import dailyWebhookRoutes from "./routes/dailyWebhook";
import livekitRecordingRoutes, {
  livekitWebhookRouter,
} from "./routes/livekitRecording";
import webinarRoutes from "./routes/webinarRoutes";
import voiceMemosRoutes from "./routes/voiceMemos";
import noteTakerSessionsRouter from "./note-taker/routes/sessions";
import noteTakerTranscriptsRouter from "./note-taker/routes/transcripts";
import noteTakerSummariesRouter from "./note-taker/routes/summaries";
import internalChatRoutes from "./routes/internalChat";
import internalPushRoutes from "./routes/internalPush";
import unilevelPlusRoutes from "./routes/unilevel-plus";
import careersRoutes from "./routes/careers";
import jobsFounderRoutes from "./routes/jobsFounder";
import jobsCandidateRoutes from "./routes/jobsCandidate";
import settingsRoutes from "./routes/settings";
import garageUniversityRoutes, { garageUniversityErrorHandler } from "./routes/garageUniversity";
import teamforceRoutes from "./routes/teamforce";
import roomBookingRoutes from "./routes/roomBooking";
import conferenceRoomRoutes from "./routes/conferenceRoom";
import missedCallRoutes from "./routes/missedCall";
import invoiceRoutes from "./routes/invoice";
import ecommerceInvoiceRoutes from "./routes/ecommerceInvoice";
import counterBillRoutes from "./routes/counterBills";
import paymentMethodsRoutes from "./routes/paymentMethods";
import nowpaymentsWebhookRoutes from "./routes/nowpaymentsWebhook";
import stripeWebhookRoutes from "./routes/stripeWebhook";
import whatsappWebhookRouter from "./routes/whatsappWebhook";
import studySessionRoutes from "./routes/studySession";
import thirdPartyInvoiceRoutes from "./routes/thirdPartyInvoice";
import thirdPartyWalletRoutes from "./routes/thirdPartyWallet";
import thirdPartySubscriptionRoutes from "./routes/thirdPartySubscription";
import thirdPartyAdminRoutes from "./routes/thirdPartyAdmin";
import learnInitRoutes from "./routes/learnInit";
import platformCouponsRoutes from "./routes/platformCoupons";
import platformCouponValidationRoutes from "./routes/platformCouponValidation";
import founderPlatformCouponsRoutes from "./routes/founderPlatformCoupons";
import founderCouponItemsRoutes from "./routes/founderCouponItems";
import founderCouponRulesRoutes from "./routes/founderCouponRules";
import founderStoreCommissionsRoutes from "./routes/founderStoreCommissions";
import cashbackCodesRoutes from "./routes/cashbackCodes";
import adminCouponRulesRoutes, {
  adminCouponRuleItemsRouter,
} from "./routes/adminCouponRules";
import userRewardsRoutes from "./routes/userRewards";
import {
  adminUserSearchRouter,
  founderUserSearchRouter,
} from "./routes/userSearch";
import rewardsRoutes from "./routes/rewards";
import internalCatalogRoutes from "./routes/internal-catalog";
import contentEngagementRoutes from "./routes/contentEngagement";
import contentCampaignRoutes from "./routes/contentCampaign";
import socialAccountRoutes from "./routes/socialAccount";
import socialOAuthRoutes from "./routes/socialOAuth";
import contentSubmissionRoutes from "./routes/contentSubmission";
import franchiseApiRoutes from "./routes/franchiseApi";
import franchiseProgramRoutes from "./routes/franchiseProgram";
import franchiseGlobalRoutes from "./routes/franchiseGlobal";
import franchiseGlobalPublicRoutes from "./routes/franchiseGlobalPublic";
import franchiseEntityRoutes from "./routes/franchiseEntity";
import franchiseRoutes from "./routes/franchise";
import orgCustomersRoutes from "./routes/orgCustomers";
import itemReservesRoutes from "./routes/itemReserves";
import bat246Routes from "./bat246/routes/bat246.routes";
import bat246LostMoneyRoutes from "./bat246/routes/bat246LostMoney.routes";
import bat246PermissionRoutes from "./bat246/routes/bat246Permission.routes";
import bat246LayawayRoutes from "./bat246/routes/bat246Layaway.routes";
import bat246SnapBackLoanRoutes from "./bat246/routes/bat246SnapBackLoan.routes";
import bat246ProfileRoutes from "./bat246/routes/bat246Profile.routes";
import auctionRoutes from "./routes/auction";
import internalCryptoRoutes from "./routes/internalCrypto";
import {
  garageAdminPageGate,
  requireAdminVerified,
} from "./middleware/garageAdminAuth";
import garageAdminVerifyRoutes from "./routes/garageAdminVerify";
dotenv.config();

const app = express();

app.use(cors());

// ── PostHog reverse proxy ────────────────────────────────────────
// Mounted BEFORE any body parser so the raw request body (incl. large
// session-replay snapshot batches from the RN apps) streams through to
// PostHog untouched. Every garage client — web (my.garage.app) + the RN
// apps (garage-store, garage-chat) — is configured to hit /ingest/* on
// this backend (test.garage.app). That URL doesn't match ad-blockers'
// posthog.com rules and, being a first-party garage domain, is never on
// an on-device DNS/VPN blocklist — so events + replays actually ship.
// Auth / session / org headers are stripped so PostHog never sees secrets.
{
  const POSTHOG_INGEST_HOST = (
    process.env.POSTHOG_HOST || "https://us.i.posthog.com"
  ).replace(/\/$/, "");
  app.use(
    "/ingest",
    createProxyMiddleware({
      target: POSTHOG_INGEST_HOST,
      changeOrigin: true,
      pathRewrite: { "^/ingest": "" },
      // v2 API (CommonJS build — v3+ is ESM-only and can't be require()'d from
      // roam's compiled CJS under Sentry's require-in-the-middle hook).
      onProxyReq: (proxyReq) => {
        proxyReq.removeHeader("authorization");
        proxyReq.removeHeader("cookie");
        proxyReq.removeHeader("x-org-id");
      },
    }),
  );
  // Also proxy the static asset CDN (the web SDK loads optional bundles —
  // surveys, exception autocapture, etc — from a separate host).
  const POSTHOG_ASSETS_HOST = POSTHOG_INGEST_HOST.replace(
    "us.i.posthog.com",
    "us-assets.i.posthog.com",
  );
  app.use(
    "/ingest-static",
    createProxyMiddleware({
      target: POSTHOG_ASSETS_HOST,
      changeOrigin: true,
      pathRewrite: { "^/ingest-static": "/static" },
    }),
  );
}

// ── garage-crypto-backend proxy ────────────────────────────────
// Admin sweeper endpoints live entirely on the sibling
// garage-crypto-backend service — the local route was deleted as
// part of the crypto extraction cleanup. If CRYPTO_BACKEND_URL is
// unset on this host, /garage-admin/sweeper/* will 404 (obvious
// signal to fix the env var). Mounted BEFORE `express.json()` so
// the request body streams through untouched (http-proxy-middleware
// v2 caveat).
if (process.env.CRYPTO_BACKEND_URL) {
  const target = process.env.CRYPTO_BACKEND_URL;
  app.use(
    "/garage-admin/sweeper",
    createProxyMiddleware({
      target,
      changeOrigin: true,
      xfwd: true,
    }),
  );
  console.log(
    `[crypto-proxy] /garage-admin/sweeper → ${target} (local route shadowed)`,
  );
}

// IMPORTANT: Webhook routes must be mounted BEFORE express.json() middleware
// because they need raw body for signature verification.
// NOWPayments webhook is mounted FIRST so the generic /webhooks raw parser doesn't
// catch it — NOWPayments gets its own raw middleware, then parses to JSON internally.
app.use(
  "/webhooks/nowpayments",
  express.raw({ type: "application/json" }),
  nowpaymentsWebhookRoutes,
);
app.use(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookRoutes,
);
app.use(
  "/webhooks/daily",
  express.raw({ type: "application/json" }),
  dailyWebhookRoutes,
);
// LiveKit webhook payloads are signed JWTs — we MUST receive the body
// byte-for-byte to verify the signature. `type: "*/*"` ensures express.raw
// catches the body regardless of the Content-Type LK sends (it sometimes
// uses `application/webhook+json`).
app.use(
  "/webhooks/livekit",
  express.raw({ type: "*/*" }),
  livekitWebhookRouter,
);
// Meta WhatsApp Cloud API. GET verification uses query params (no body);
// POST needs the raw bytes for the X-Hub-Signature-256 HMAC — so, like the
// other signed webhooks, it's mounted with express.raw before express.json.
app.use(
  "/webhooks/whatsapp",
  express.raw({ type: "application/json" }),
  whatsappWebhookRouter,
);
app.use("/webhooks", express.raw({ type: "application/json" }), webhookRoutes);

// 50mb, not the 100kb body-parser default. Community, live stream, course and
// service creation forms post a single JSON document that carries every FAQ,
// benefit, learning outcome, milestone template and the rendered email-alert
// HTML snapshot, which clears 100kb easily and was being rejected with a 413
// before the route was ever reached.
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

app.get("/health", (_, res) => res.json({ ok: true }));

// TEMPORARY DIAGNOSTIC (2026-07-03): dump what the running process
// actually sees for the crypto payment module. FE was hitting
// "createRequest is not a function" from selectPaymentMethod, source
// and origin/main dist both correct — this endpoint proves whether the
// stale piece is (a) the file on disk on this server or (b) an
// in-memory module cache from an older process boot. Delete after
// the crypto flow is confirmed working end-to-end.
app.get("/debug/crypto-module", async (_req, res) => {
  try {
    const resolved = require.resolve("./services/cryptoPaymentRequest");
    const mod: any = await import("./services/cryptoPaymentRequest");
    const fs = await import("fs");
    let firstLines: string | null = null;
    try {
      firstLines = fs
        .readFileSync(resolved, "utf8")
        .split("\n")
        .slice(0, 10)
        .join("\n");
    } catch {
      /* ignore — resolve worked but read didn't */
    }
    res.json({
      resolvedFile: resolved,
      moduleKeys: Object.keys(mod),
      createRequestType: typeof mod.createRequest,
      findPendingByAmountType: typeof mod.findPendingByAmount,
      markMatchedType: typeof mod.markMatched,
      expireStaleRequestsType: typeof mod.expireStaleRequests,
      esModule: mod.__esModule,
      firstLinesOfFileOnDisk: firstLines,
      nodeVersion: process.version,
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch (e: any) {
    res.status(500).json({
      error: e.message,
      code: e.code || null,
      stack: e.stack?.split("\n").slice(0, 5).join("\n"),
    });
  }
});

// ── Garage-admin page RBAC gate ────────────────────────────────────────
// Mounted at the admin prefixes, ahead of every admin router, so access is
// decided in one place instead of route by route. It authenticates, maps
// the path to a page key (config/adminPages.ts) and checks the admin's
// level for that page. Super admins bypass it; an unmapped path under
// /garage-admin requires super admin, so new routes are locked by default.
//
// Each router still calls requireGarageAdminAuth per route — that now
// short-circuits on the context this gate attached, so no router file had
// to change.
// The step-up gate's own endpoints, mounted ahead of everything so they
// stay answerable while the rest of the console is refusing this admin.
app.use("/garage-admin", garageAdminVerifyRoutes);

app.use("/garage-admin", garageAdminPageGate, requireAdminVerified);
// Admin surfaces that live outside the /garage-admin prefix. The addon and
// booking routers also serve members, so only their /admin subtree is
// gated — the purchase/status/price endpoints below them are untouched.
app.use("/ai-providers", garageAdminPageGate, requireAdminVerified);
app.use("/coworking-bookings/admin", garageAdminPageGate, requireAdminVerified);
app.use("/whitelabel-addon/admin", garageAdminPageGate, requireAdminVerified);
app.use("/cryptosub-addon/admin", garageAdminPageGate, requireAdminVerified);

// SSO routes (mix of authenticated and unauthenticated endpoints)
app.use("/sso", ssoRoutes);

// Public routes (no authentication required)
app.use("/public/unilevel-plus", publicUnilevelPlusRoutes); // public earnings calculator
app.use("/public/rank-bonus", publicRankBonusRoutes);       // public rank-bonus calculator
app.use("/public/founder-products", publicFounderProductRoutes); // public founder-product commission calculator
app.use("/public/founders-office", publicFoundersOfficeRoutes);   // public Founders Office referral calculator
app.use("/public/white-label", publicWhiteLabelRoutes);           // public White Label referral calculator
// Public bond page — look up any purchased HiFi bond by its bond hash.
// Mounted BEFORE the catch-all "/public" router below.
app.use("/public/bonds", publicBondRoutes);
// Office grace programme for integrating platforms — user JWT + X-Garage-Platform key.
app.use("/platform", platformOfficeRoutes);
app.use("/public", publicRoutes);
app.use("/public/events", publicEventsRoutes);
app.use("/public/event-management", publicEventManagementRoutes);
app.use("/public/f", publicCabinetRoutes);
app.use("/public/meet", publicMeetRoutes);
app.use("/public/webinar", publicWebinarRoutes);
app.use("/simulated-audience", simulatedAudienceRoutes);
app.use("/public/analytics", publicAnalyticsRoutes);
app.use("/public/fx", publicFxRoutes); // public currency-conversion API
// Alerts & Promotions read side. Unauthenticated because the pre-login
// surface is the login screen — see routes/publicAnnouncements.ts.
app.use("/public/announcements", publicAnnouncementsRoutes);
app.use("/office", officeRoutes);
app.use("/workshop-preview", workshopPreviewRoutes);
app.use("/guest-auth", guestAuthRoutes);
app.use("/discover", discoverRoutes);
app.use("/checkout", productCheckoutRoutes);
app.use("/checkout", courseCheckoutRoutes);
app.use("/checkout", workshopCheckoutRoutes);
app.use("/checkout", channelCheckoutRoutes);
app.use("/checkout", gstQuoteRoutes);
app.use("/checkout", serviceCheckoutRoutes);
app.use("/checkout", callCheckoutRoutes);
app.use("/checkout", couponValidationRoutes);
app.use("/checkout", platformCouponValidationRoutes);
app.use("/checkout", rewardsRoutes);
app.use("/checkout/office", officeCheckoutRoutes);
app.use("/checkout/office-addon", officeAddonCheckoutRoutes);
// Founder self-serve invoice-based whitelabel add-on ($600/yr).
// Separate path from the legacy $299 Razorpay-subscription route above.
app.use("/whitelabel-addon", whitelabelAddonRoutes);
// Cryptosub — sibling of whitelabel, sold with the Pro office plan
// to cryptobrand-flagged orgs. Same commission shape, different gate.
app.use("/cryptosub-addon", cryptosubAddonRoutes);
// HiFi investment — bridge between the hifi seller app's application
// flow and our invoice + multi-currency wallet system. Products,
// applications, KYC, subscriptions, payouts stay in the hifi_*
// collections owned by garage-seller-hifi.
app.use("/hifi", hifiInvoiceRoutes);
// HiFi bonds — crypto-office fixed-income instruments. Founder CRUD +
// one-click wallet purchase + payout schedule. See HIFI_BONDS_PLAN.md.
app.use("/bonds", bondRoutes);
app.use("/careers", careersRoutes);
// Garage Jobs — founder hiring console. Separate from the legacy /careers
// vacancies above and from Teamforce recruitment.
app.use("/jobs/founder", jobsFounderRoutes);
// Candidate + public side (discover, apply, my applications, careers pages).
// Mounted after /jobs/founder so the founder routes always win.
app.use("/jobs", jobsCandidateRoutes);
app.use("/content-engagement", contentEngagementRoutes);
app.use("/content-campaigns", contentCampaignRoutes);
app.use("/social-accounts", socialAccountRoutes);
app.use("/social-oauth", socialOAuthRoutes);
app.use("/content-submissions", contentSubmissionRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/ecommerce", ecommerceInvoiceRoutes);
// Garage IRL counter bills — see services/counterBill.ts.
app.use("/api/counter-bills", counterBillRoutes);
app.use("/payment-methods", paymentMethodsRoutes);

// Third-party invoicing API (API-key auth, dedicated per-client)
app.use("/api/v1/third-party", thirdPartyInvoiceRoutes);
// Partner wallet credits — money OUT, behind its own `wallet:credit` scope.
// Mounted on the same prefix but as a separate router: its guards are attached
// per route, so it cannot intercept paths the invoice router owns.
app.use("/api/v1/third-party", thirdPartyWalletRoutes);
// End-user (session-auth) view + term changes for third-party subscriptions.
// The partner-facing equivalents live under /api/v1/third-party behind an API key.
app.use("/api/third-party", thirdPartySubscriptionRoutes);

// Franchise project (roam-admin-prod) — territory commission wallet read API.
// Auth: X-Franchise-API-Key shared secret. Read-only, no writes.
app.use("/franchise-api", franchiseApiRoutes);
app.use("/franchise-program", franchiseProgramRoutes);
// Public replica must mount BEFORE the authed router so its
// /assignments/all match takes precedence over the authed one.
app.use("/franchise-global-public", franchiseGlobalPublicRoutes);
app.use("/franchise-global", franchiseGlobalRoutes);
app.use("/franchise-entity", franchiseEntityRoutes);
// JWT-authed, browser-facing franchise (territory) vault READ — reads the
// caller's own TerritoryWallet directly (no X-Franchise-API-Key). Distinct from
// the key-gated /franchise-api above. Mounted as a bare /franchise prefix; note
// Express does NOT treat /franchise-api as a child of this (the next char must
// be "/"), so there is no collision.
app.use("/franchise", franchiseRoutes);
app.use("/orgs", orgCustomersRoutes);

// NetworkChainApi catalog mirror (Bearer service-secret auth)
app.use("/internal/catalog", internalCatalogRoutes);

// NetworkChains signal/opportunity pushes from contacts-backend
// (X-Internal-Api-Key). Must sit ahead of the bare `/internal` crypto router,
// whose router-level X-Internal-Token guard would otherwise reject it.
app.use("/internal/push", internalPushRoutes);

// Protected routes
app.use("/dm", dmRoutes);
// Cross-device chat state: mutes, pins, stars, blocks, drafts, search.
// Its own prefix, so nothing here can shadow a /dm or /groups route.
app.use("/chat", chatRoutes);
app.use("/conv-state", conversationStateRoutes);
app.use("/join-requests", joinRequestsRoutes);
app.use("/groups", groupsRoutes);
app.use("/auth", authRoutes);
app.use("/org", orgRoutes);
// Cryptobrand checkout status + upgrade — server-authoritative
// onboarding gate for cryptobrand orgs. Also hosts the "upgrade to Pro
// + Cryptosub" endpoint that mints the bootstrap invoices for orgs
// currently on Starter (or with no active sub). Mounts under /org so
// it lives with other per-org reads.
app.use("/org", cryptobrandCheckoutRoutes);
// Office KYC — founder-facing half (read requirements, upload proofs, submit).
// Own prefix rather than /org so its :orgId leaves can't be shadowed by the
// generic /org/:orgId handlers. Files live in the private KYC bucket.
app.use("/org-kyc", orgKycRoutes);
// Per-user offices + plan status — powers the "my crypto offices"
// grid. Read-only. Mounted under /me alongside /me/rewards etc.
app.use("/me", myOfficePlansRoutes);
app.use("/invites", inviteRoutes);
app.use("/team", teamRoutes);
app.use("/rbac", rbacRoutes);
app.use("/users", usersLastSeenRoutes);
app.use("/apps", appsRoutes);
app.use("/floors", floorsRoutes);
app.use("/tasks", tasksRoutes);
app.use("/slash/deals", slashDealsRoutes);
app.use("/slash/approvals", slashApprovalsRoutes);
app.use("/todos", todosRoutes);
app.use("/profile", profileRoutes);
app.use("/calendar", calendarRoutes);
app.use("/events", eventsRoutes);
app.use("/event-management", eventManagementRoutes);
app.use("/room-bookings", roomBookingRoutes);
app.use("/conference-rooms", conferenceRoomRoutes);
app.use("/missed-calls", missedCallRoutes);
app.use("/rank-bonus", rankBonusRoutes); // member's own NetworkChain rank standing
// Shareable NetworkChain offer links. GET/checkout are public by design —
// same posture as /invoice/:id, where the token buys a price quote and the
// email OTP still gates payment.
app.use("/magic-link", magicLinkRoutes);
app.use("/affiliate/genealogy", genealogyRoutes); // Genealogy page (guarded, see routes/genealogy.ts)
app.use("/affiliate", affiliateRoutes);
app.use("/affiliate", downlineTableRoutes); // GET /affiliate/downline-table (Bigin table)
app.use("/affiliate", downlineProfileRoutes); // GET /affiliate/downline/:userId/purchases
app.use("/cabinet", cabinetRoutes);
app.use("/upload", uploadRoutes);
app.use("/uploads/public", uploadsPublicRoutes);
// NC Subs + One Time Affiliates lists — mount BEFORE the generic
// /garage-admin router so their leaf routes win over any conflicting
// catch-all inside garageAdminRoutes. Own auth is applied on each router.
app.use("/garage-admin", garageAdminNetworkChainSubsRoutes);
app.use("/garage-admin", garageAdminDailyReportsRoutes);
app.use("/garage-admin", garageAdminOneTimeAffiliatesRoutes);
app.use("/garage-admin", garageAdminSupportRoutes);
app.use("/garage-admin", garageAdminSupportChatsRoutes);
app.use("/garage-admin", garageAdminIgniteCallRoutes);
app.use("/garage-admin", garageAdminAnalyticsRoutes);
// Office KYC review console. Mounted with the other leaf routers so its
// /org-kyc/:orgId routes win over anything generic in garageAdminRoutes.
app.use("/garage-admin", garageAdminOrgKycRoutes);
app.use("/garage-admin/notifications", adminNotificationRoutes);
// Guest → full-member graduation surface. Mounted alongside the other
// leaf routers so it wins over any conflicting catch-all in the base
// garageAdminRoutes.
app.use("/garage-admin", garageAdminAffiliateGuestsRoutes);
// Per-user, per-currency store-wallet admin surface (listing + manual
// topup for cryptobrand INR/ETH/BTC + USD).
app.use("/garage-admin", garageAdminStoreWalletsRoutes);
// Whitelabel monthly volume bonus admin — cron backstop, run history,
// dry-run preview, force-execute. See services/whitelabelMonthlyBonus/.
app.use(
  "/garage-admin/whitelabel-monthly-bonus",
  garageAdminWhitelabelMonthlyBonusRoutes,
);
// Cryptosub monthly bonus admin — mirror of whitelabel bonus admin.
app.use(
  "/garage-admin/cryptosub-monthly-bonus",
  garageAdminCryptosubMonthlyBonusRoutes,
);
// Founder Pro-sub monthly volume bonus admin — mirror of whitelabel
// bonus admin, tiered payout ($24/sale for 50-99, $48/sale for 100+
// capped at 100 sales max = $4,800).
app.use(
  "/garage-admin/founder-sub-monthly-bonus",
  garageAdminFounderSubMonthlyBonusRoutes,
);
// Destructive super-admin ops. Mounted ahead of garageAdminRoutes and the
// /garage-admin/users search router so its DELETE leaves aren't shadowed by
// their `/:id` handlers.
app.use("/garage-admin", garageAdminDangerZoneRoutes);
// Alerts & Promotions authoring. Ahead of garageAdminRoutes for the same
// reason as the leaf routers above.
app.use("/garage-admin/announcements", garageAdminAnnouncementsRoutes);
app.use("/garage-admin", garageAdminRoutes);
app.use("/garage-admin/categories", garageAdminOrgCategoriesRoutes);
app.use("/garage-admin/coupons", garageAdminCouponsRoutes);
app.use("/garage-admin/wallets", garageAdminWalletsRoutes);
// /garage-admin/sweeper/* proxied to crypto backend — see the
// CRYPTO_BACKEND_URL block earlier in this file. No local route.

// Service-to-service endpoints called by garage-crypto-backend.
// Guarded by X-Internal-Token; NOT reachable through user auth.
app.use("/internal", internalCryptoRoutes);
// Admin surface for a user's saved Stripe cards + one-time
// charge/refund actions. Mounted at /garage-admin so its routes are
// /garage-admin/users/:userId/saved-cards/... and
// /garage-admin/orgs/:orgId/products.
app.use("/garage-admin", garageAdminSavedCardsRoutes);
app.use("/garage-admin", garageAdminWithdrawalPreferencesRoutes);
// Public save-card exchange (unauthenticated — the JWT in the body IS
// the auth). Backs the admin-initiated "send add-card link" flow.
app.use("/public/save-card", publicSaveCardRoutes);
app.use("/garage-admin/auction-settlements", garageAdminAuctionSettlementsRoutes);
app.use("/garage-admin/rank-bonus", garageAdminRankBonusRoutes);
app.use("/garage-admin/referral-bonus", garageAdminReferralBonusRoutes);
app.use("/garage-admin/platform-coupons", platformCouponsRoutes);
app.use("/garage-admin/coupon-rules", adminCouponRulesRoutes);
app.use("/garage-admin/coupon-rule-items", adminCouponRuleItemsRouter);
app.use("/garage-admin/users", adminUserSearchRouter);
app.use("/me/rewards", userRewardsRoutes);
app.use("/garage-admin/third-party-clients", thirdPartyAdminRoutes);
app.use("/garage-admin/coworking-spaces", coworkingSpaceRoutes);
app.use("/coworking-bookings", coworkingSpaceBookingRoutes);
app.use("/betty", bettyRoutes);
// app.use("/user-activity", userActivityRoutes); // disabled with Team Activity retirement
app.use("/ask-cabinet", askCabinetRoutes);
app.use("/link-preview", linkPreviewRoutes);
app.use("/user-notifications", userNotificationsRoutes);
app.use("/initial-setup", initialSetupRoutes);
app.use("/ai-providers", aiProvidersRoutes);
app.use("/founder-ai-providers", founderAiProvidersRoutes);
app.use("/openclaw-agent", openclawAgentRoutes);
app.use("/openclaw-messages", openclawMessagesRoutes);
app.use("/openclaw-jobs", openclawJobsRoutes);
app.use("/openclaw-tasks", openclawTasksRoutes);
app.use("/openclaw-contexts", openclawContextsRoutes);
app.use("/openclaw-integrations", openclawIntegrationsRoutes);
app.use("/openclaw-templates", openclawCronTemplatesRoutes);
// Per-user activity feed — founders see all, employees see only rows
// whose user_id matches them.
app.use("/openclaw-activity", openclawActivityRoutes);
// Public, unauthenticated Q&A visitor chat + info.
app.use("/openclaw-qa", openclawQaRoutes);
// Chat entry point — dual-mode (personal agent SSE drain / shared gateway),
// JSON and multipart. Replaces the Next.js /api/openclaw/chat route.
app.use("/openclaw-chat", openclawChatRoutes);
// Generic pass-through for OpenClawApi calls not covered by explicit
// routes above. Frontend calls /openclaw-proxy/api/<path> → this handler
// forwards to OpenClawApi with the shared service secret attached.
app.use("/openclaw-proxy", openclawProxyRoutes);
app.use("/api/webhooks", cronWebhookRoutes);
app.use("/internal/chat", internalChatRoutes);
app.use("/meet", meetRoutes);
app.use("/livekit", livekitRecordingRoutes);
// Same router, mobile-app-compatible prefix. The Garage HQ mobile app
// (garage-chat) hits every conference-moderation + recording +
// note-taker + guest-token endpoint under /workspace/conference/*;
// mounting the same router twice avoids duplicating any route logic.
// See routes/livekitRecording.ts near the bottom for the three
// mobile-specific aliases (/end, /recordings, /token/guest).
app.use("/workspace/conference", livekitRecordingRoutes);
app.use("/webinar", webinarRoutes);
// Voice memos — proxied to NC's voice-agent service via service token.
app.use("/voice-memos", voiceMemosRoutes);
// Note-Taker (mediasoup adaptation of contacts-backend's LiveKit bot)
app.use("/note-taker/sessions", noteTakerSessionsRouter);
app.use("/note-taker", noteTakerTranscriptsRouter);
app.use("/note-taker", noteTakerSummariesRouter);
// Legacy support-tickets endpoint, retired in favour of /tickets +
// /garage-admin/tickets. Migration: src/scripts/migrate-support-tickets.ts.
// The route file is kept for rollback; uncomment + redeploy if needed.
// app.use("/support-tickets", supportTicketsRoutes);
app.use("/wallet", walletRoutes);
// Internal-only HQ wallet API — guarded by X-Internal-Api-Key inside each
// handler. Mounted under /wallet/hq.
app.use("/wallet/hq", walletHqRoutes);
// Self-serve territory / franchise wallet: read balance + transfer to own
// StoreWallet. Auth via JWT (same origin as /wallet).
app.use("/territory-wallet", territoryWalletRoutes);
// Buyer-side wallet reads for the external e-commerce storefront. Bearer
// JWT (SSO) — same auth model as the Cashback Codes API.
app.use("/ecommerce", ecommerceWalletRoutes);
// Enroll a Downline — any logged-in member can pre-register a NEW user
// under their referral, into an office they belong to.
app.use("/downlines", downlinesRoutes);
app.use("/feed", feedRoutes);
// Deals — the "who just got paid" timeline (Garage Connect). Reading is
// soft-authed so the feed is identical for everyone; reacting and
// commenting require a user. See routes/deals.ts.
app.use("/deals", dealsRoutes);
app.use("/workshops", workshopRoutes);
// Evergreen (pre-recorded, scheduled) webinar config — founder-guarded.
app.use("/evergreen", evergreenRoutes);
app.use("/courses/video", courseVideoRoutes);
app.use("/courses", courseRoutes);
app.use("/playlists", playlistRoutes);
app.use("/standalone-videos", standaloneVideoRoutes);
app.use("/drops", dropsRoutes);
app.use("/study-sessions", studySessionRoutes);
app.use("/learn", learnInitRoutes);
app.use("/products", productRoutes);
app.use("/services", serviceRoutes);
app.use("/reviews", reviewRoutes);
app.use("/calls", callRoutes);
app.use("/call-bookings", callBookingRoutes);
app.use("/testimonials", testimonialsRoutes);
app.use("/comb-plans", combPlanRoutes);
app.use("/unilevel-plus", unilevelPlusRoutes);
// Generic reserve licenses for course / channel / workshop / call.
// Separate from UP's /unilevel-plus/reserve/* — different model + collection.
app.use("/item-reserves", itemReservesRoutes);
app.use("/global-dm", globalDmRoutes);
app.use("/users", userDiscoveryRoutes);
app.use("/subscriptions", subscriptionsRoutes);
app.use("/subscription-admin", subscriptionAdminRoutes);
app.use("/unified-orders", unifiedOrdersRoutes);
app.use("/office-subscription", officeSubscriptionAdminRoutes);
app.use("/office-addon-subscription", officeAddonStatusRoutes);
app.use("/org", founderCouponsRoutes);
app.use("/org/:orgId/platform-coupons", founderPlatformCouponsRoutes);
app.use("/org/:orgId/coupon-eligible-items", founderCouponItemsRoutes);
app.use("/org/:orgId/coupon-rules", founderCouponRulesRoutes);
app.use("/org/:orgId/store-commissions", founderStoreCommissionsRoutes);
app.use("/cashback-codes", cashbackCodesRoutes);
app.use("/org/:orgId/users", founderUserSearchRouter);
app.use("/devices", devicesRoutes);
app.use("/settings", settingsRoutes);
// Garage University (onboarding profiles). The error handler on the same
// prefix keeps every answer there JSON — bad bodies included — without
// touching error handling anywhere else.
app.use("/garage-university", garageUniversityRoutes);
app.use("/garage-university", garageUniversityErrorHandler);
app.use("/teamforce", teamforceRoutes);

// Bat246 game routes
app.use("/bat246", bat246Routes);
app.use("/bat246/lostmoney", bat246LostMoneyRoutes);
app.use("/bat246/permissions", bat246PermissionRoutes);
app.use("/bat246/layaway", bat246LayawayRoutes);
app.use("/bat246/snapbackloans", bat246SnapBackLoanRoutes);
app.use("/bat246/profile", bat246ProfileRoutes);

// Auction routes (global — all orgs)
app.use("/auctions", auctionRoutes);

// Membership management (kick members, leave org, delete account)
app.use("/", membershipRoutes);

// Support tickets — user-facing + public guest path.
app.use("/tickets", ticketsRoutes);
// Garage-admin support tickets (OTP-gated admin panel).
app.use("/garage-admin/tickets", garageAdminTicketsRoutes);

// Sentry Express error handler — MUST be after all routes. Reports unhandled
// route errors; no-ops when SENTRY_DSN is unset. (Handled errors logged via
// console.error are captured separately by captureConsoleIntegration.)
Sentry.setupExpressErrorHandler(app);

export default app;
