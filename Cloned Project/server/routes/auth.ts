import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { createOtp, verifyOtp } from "../services/otp";
import {
  sendOtpSms,
  normalizePhone,
  storablePhone,
  twoFactorConfigured,
} from "../services/twoFactorSms";
import {
  sendOtpWhatsapp,
  elevenZaConfigured,
} from "../services/elevenZaWhatsapp";
import {
  sendMail,
  EMAIL_FROM_OTP,
  EMAIL_FROM_RESEND_OTP,
  senderForHost
} from "../services/mailer";
import { signJwt } from "../services/jwt";
import { env } from "../config/env";
import { normalizePermissions } from "../utils/rbac";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { OtpCode } from "../models/otpcode.model";
import { addUserToGarageHQ, addUserToOrg } from "../services/init";
import { orgIdFromRequest } from "../utils/requestOrg";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import { syncNewEnrollee } from "../services/downlineTree";
import { markPendingInviteUsed, pendingReferralFor } from "../services/pendingInvite";
import { requireAuth } from "../middleware/auth";
import { checkOtpSendAllowed } from "../services/otpRateLimit";
import {
  classifyIdentifier,
  identifierQuery,
  identifierValue,
  identifierError,
  type Identifier,
} from "../services/identifier";
import {
  requireGarageAdminAuth,
  requireAdminPage,
  type GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { GarageAdminModel } from "../models/garageAdmin.model";
import { OtpCodeAccessLog } from "../models/otpCodeAccessLog.model";
import { getSocketInstance } from "../services/socket";
import {
  WorkspacePresenceService,
  isRedisAvailable,
} from "../services/redis-presence";
import { OfficeSubscription } from "../models/officeSubscription.model";

const router = Router();

// Helper function to deduplicate organizations by ID
function deduplicateOrganizations(organizations: any[]): any[] {
  const seen = new Set<string>();
  return organizations.filter((org) => {
    const orgId = String(org.id);
    if (seen.has(orgId)) {
      return false;
    }
    seen.add(orgId);
    return true;
  });
}

/**
 * POST /auth/request-otp  { email, purpose?, isResend? }
 *
 * The `email` field carries EITHER an email address or a phone number — the
 * login screen is a single input and the key keeps its name so no client
 * payload changes. services/identifier.ts decides which it is; delivery
 * follows (Resend for an address, 2Factor + 11za for a number).
 *
 * The OTP is keyed on the canonical identifier itself, not on a resolved
 * user, so this endpoint still needs no account to exist — same as before,
 * and it keeps request and verify agreeing without a lookup on either side.
 *
 * Response is unchanged: `{ ok: true }`.
 */
router.post("/request-otp", async (req, res) => {
  try {
    const schema = z.object({
      // Was `z.string().email()`. Validation now happens in
      // classifyIdentifier so a phone number is not rejected at the door.
      email: z.string().min(1),
      purpose: z.enum(["login", "invite"]).default("login"),
      isResend: z.boolean().optional().default(false),
    });
    const { email: rawIdentifier, purpose, isResend } = schema.parse(req.body);

    const id = classifyIdentifier(rawIdentifier);
    if (id.kind === "invalid") {
      return res.status(400).json({ ok: false, error: identifierError(id) });
    }

    const key = identifierValue(id);

    if (id.kind === "email") {
      const code = await createOtp(key, purpose);
      await sendMail(
        key,
        "Your OTP",
        `<p>Your OTP is <b>${code}</b> (valid 10 minutes)</p>`,
        `Your OTP is ${code}`,
        await senderForHost(req, isResend ? EMAIL_FROM_RESEND_OTP : EMAIL_FROM_OTP),
      );
      return res.json({ ok: true });
    }

    // ── Phone branch ──
    const smsReady = twoFactorConfigured();
    const whatsappReady = elevenZaConfigured();
    if (!smsReady && !whatsappReady) {
      return res
        .status(503)
        .json({ ok: false, error: "OTP delivery is not configured" });
    }

    /**
     * Per-caller throttle, checked BEFORE the per-number cooldown below.
     *
     * The cooldown is keyed on the destination, so a script walking through a
     * list of numbers never trips it: every number is new, so every number
     * gets a free SMS. This caps how many sends — and crucially how many
     * DISTINCT numbers — one caller can drive in a window.
     *
     * The error is deliberately vague about which limit was hit, so it can't
     * be used to map the thresholds.
     */
    const throttle = checkOtpSendAllowed(req, key);
    if (!throttle.allowed) {
      return res.status(429).json({
        ok: false,
        error: `Too many code requests. Please try again in ${Math.ceil(
          throttle.retryAfter / 60
        )} minute(s).`,
      });
    }

    /**
     * Throttle, phone only.
     *
     * Every SMS costs money, so an unthrottled endpoint that sends one to any
     * number on request is an open drain on the 2Factor balance. There is no
     * rate limiting anywhere in services/otp.ts — the only cooldown today is a
     * 60s timer in the browser, which an attacker simply doesn't run.
     *
     * The existing OtpCode row is the throttle state: it has `timestamps` and
     * there is exactly one row per (key, purpose), so its `updatedAt` is when
     * the last code went out. No new model, no new collection.
     *
     * Applied to the phone branch ONLY. Email OTPs are free and are left on
     * exactly the behaviour every existing client already sees.
     */
    const RESEND_COOLDOWN_MS = 60_000;
    const existing: any = await OtpCode.findOne({ email: key, purpose })
      .select("updatedAt")
      .lean();
    if (existing?.updatedAt) {
      const waited = Date.now() - new Date(existing.updatedAt).getTime();
      if (waited < RESEND_COOLDOWN_MS) {
        const secs = Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000);
        return res.status(429).json({
          ok: false,
          error: `Please wait ${secs}s before requesting another code`,
        });
      }
    }

    const code = await createOtp(key, purpose);

    // Both channels attempted independently, mirroring /auth/phone/request-otp:
    // one provider being down must not swallow a code the other delivered.
    const delivered: string[] = [];
    const failures: string[] = [];
    if (smsReady) {
      try {
        await sendOtpSms(id.phone, code);
        delivered.push("sms");
      } catch (err) {
        failures.push(`sms: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (whatsappReady) {
      try {
        await sendOtpWhatsapp(id.phone, code);
        delivered.push("whatsapp");
      } catch (err) {
        failures.push(
          `whatsapp: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (failures.length) {
      console.warn(`[AUTH] login OTP delivery failed — ${failures.join(" | ")}`);
    }
    if (delivered.length === 0) {
      // Drop the throttle row: nothing was sent, so the next attempt must not
      // be told to wait for a code that never arrived.
      await OtpCode.deleteMany({ email: key, purpose }).catch(() => undefined);
      return res.status(502).json({
        ok: false,
        error:
          failures[0]?.split(": ").slice(1).join(": ") || "Failed to send OTP",
      });
    }

    res.json({ ok: true });
  } catch (error) {
    // These handlers had no try/catch: under Express 5 a ZodError escaped to
    // the default finalhandler and became a 500 with an HTML body, which
    // lib/api.ts surfaced as "Server error (500)". A JSON `error` key is what
    // every client already reads.
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ ok: false, error: "Enter your email or phone number" });
    }
    console.error("[AUTH] request-otp failed:", error);
    res.status(500).json({ ok: false, error: "Failed to send OTP" });
  }
});

// Public: is this email already registered? The affiliate register form calls
// this to confirm availability (green check) or warn (already taken) before the
// user proceeds. Lowercases + exact-matches like the request-otp/create path so
// the two always agree.
router.get("/email-available", async (req, res) => {
  // Accepts a phone number too, since either can now identify an account.
  // Response: { ok, available } plus, for an existing account that has one,
  // `profilePicture` — additive, so every older caller reads it unchanged.
  const id = classifyIdentifier(req.query.email);
  if (id.kind === "invalid") {
    return res.status(400).json({ ok: false, error: "Invalid email" });
  }
  // The login screens (Garage Store) show the account's photo in the field as
  // it is recognised, in place of a generic "you have an account" icon. Only
  // the picture is selected: name, email and phone stay out of a public,
  // unauthenticated response.
  const user = await User.findOne(identifierQuery(id))
    .select("profilePicture")
    .lean<{ profilePicture?: string } | null>();
  if (!user) return res.json({ ok: true, available: true });
  res.json({
    ok: true,
    available: false,
    ...(user.profilePicture ? { profilePicture: user.profilePicture } : {}),
  });
});

router.post("/verify-otp", async (req, res) => {
  const schema = z.object({
    // Carries an email address OR a phone number — see /auth/request-otp.
    email: z.string().min(1),
    code: z.string().min(6).max(6),
    referralCode: z.string().optional(), // This is the affiliateId (e.g., "aff_t1qrarx")
  });
  const { email: rawIdentifier, code, referralCode } = schema.parse(req.body);

  const id = classifyIdentifier(rawIdentifier);
  if (id.kind === "invalid") {
    return res.status(400).json({ error: identifierError(id) });
  }
  // Canonical form — must match the key /auth/request-otp stored under, or the
  // code will never be found. This is also the fix for a long-standing bug:
  // the old code looked the USER up with the raw body value while otp.ts
  // lowercased its key, so "A@b.com" verified fine and then missed the
  // account. Both sides now go through the same canonicaliser.
  const identifier = identifierValue(id);

  console.log("=== VERIFY OTP DEBUG ===");
  console.log("Identifier:", identifier, `(${id.kind})`);
  console.log("Referral Code (affiliateId):", referralCode);
  const ok = await verifyOtp(identifier, code, "login");

  console.log("Verifying OTP", ok);

  if (!ok && ok !== "") return res.status(400).json({ error: "Invalid OTP" });

  return finishLogin(req, res, { id, referralCode });
});

/**
 * Shared tail of every sign-in that has already proven ownership of an email
 * (an emailed OTP, or a verified Google ID token): find-or-create the user,
 * apply affiliate attribution, seat them in the right office, and answer with
 * the same shape /verify-otp always has (user + organizations, and a token
 * when there is exactly one org to sign into).
 *
 * `profile` carries what an identity provider told us about the person, used
 * only to fill blanks on a brand-new account — never to overwrite what a user
 * set themselves.
 */
// Every caller filters invalid identifiers before reaching finishLogin
// (verify-otp returns 400 at line 226, google-login rejects at line 516).
// Narrowing to the two valid variants here lets TS see that
// `id.email` / `id.phone` are always accessible on their respective
// branches, without a runtime guard in the hot path.
type ValidIdentifier = Extract<Identifier, { kind: "email" } | { kind: "phone" }>;

async function finishLogin(
  req: Request,
  res: Response,
  input: { id: ValidIdentifier; referralCode?: string; profile?: { name?: string; picture?: string } },
) {
  const { id, referralCode, profile } = input;
  // If referralCode provided, look up the referrer by their affiliateId
  let referrerId: string | undefined;
  if (referralCode) {
    const referrer = await User.findOne({ affiliateId: referralCode });
    if (referrer) {
      referrerId = referrer._id.toString();
      console.log("🎯 Found referrer:", referrer.email, "with ID:", referrerId);
    } else {
      console.log("⚠️ Referrer not found for affiliateId:", referralCode);
    }
  }

  // No usable code from the client: fall back to an invite held against this
  // identifier — the mobile invite page asks for the number/email before the
  // store hop, precisely because a device-side code often doesn't survive the
  // install. This runs only after the identifier has been proven (OTP / Google
  // token), which is what makes an unverified web entry safe to honour.
  let usedInvite: { inviteId: string; affiliateId: string } | null = null;
  if (!referrerId) {
    const pending = await pendingReferralFor(id);
    if (pending) {
      const referrer = await User.findOne({ affiliateId: pending.affiliateId }).select("_id").lean();
      if (referrer) {
        referrerId = referrer._id.toString();
        usedInvite = pending;
        console.log("🎯 Using pending invite:", pending.affiliateId, "→", referrerId);
      }
    }
  }

  let user = await User.findOne(identifierQuery(id)).populate({
    path: "organizations.organization",
    // Hide orgs auto-created by garage-store for NC affiliates — those are
    // storefronts, not offices in the main app's sense. Legacy orgs (no
    // source field) pass through unchanged. Populate turns filtered orgs
    // into null; downstream code already skips m.organization == null.
    match: { source: { $ne: "nc_affiliate_store" } },
  });
  if (!user) {
    // Create new user with referredBy if referrer was found.
    //
    // Signing up by phone stamps `phoneVerified: true` — passing the OTP on
    // that handset IS the proof of possession, and it is the same evidence
    // /auth/phone/verify-otp records. The account has no email at all, which
    // the partial unique index on `email` now permits (see user.model.ts).
    const userData: any =
      id.kind === "phone"
        ? { phone: id.phone, phoneVerified: true }
        : { email: id.email };
    if (referrerId) {
      userData.referredBy = referrerId;
      userData.referredBySource = "affiliate";
      console.log("🎯 Setting referredBy for new user:", referrerId);
    }

    /**
     * Resolve the office BEFORE creating the user.
     *
     * The NetworkChain offer email fires from a post-save hook on User, so it
     * runs the instant the document is saved — before any org join could tell
     * it this is a white-label signup. Knowing the domain first lets us mark
     * the doc and suppress that upsell.
     */
    const whitelabelOrgId = await orgIdFromRequest(req);

    user = new User(userData);
    if (whitelabelOrgId) {
      // Transient, mirroring __wasNew — read and cleared by the post-save hook.
      (user as any).__skipSignupOffer = true;
    }
    await user.save();
    // Slot the new user into the denormalized downline tree
    // (ancestors[]/depth/legNumber + parent.directsCount +
    // ancestors[].downlineCount). Fire-and-forget — the service never
    // throws into the caller. No-op when referredBy isn't set.
    if (referrerId) void syncNewEnrollee(user._id.toString());
    // Add new user to GARAGE HQ as a GUEST stakeholder. Direct my.garage.app
    // signups are customers by default — they don't join the workspace's
    // "Team" roster and don't get access to founder-only surfaces until
    // they're explicitly upgraded (Complete Profile as a founder, or an
    // office membership). Matches the guest treatment that
    // /downlines/enroll and /productCheckout already apply to every new
    // user they mint.
    /**
     * Which office does this signup belong to?
     *
     * Someone registering on a client's white-label domain belongs in THAT
     * office — not Garage HQ. Joining HQ also auto-subscribed them to Garage's
     * own communities, so "Welcome To Garage" followed white-label members
     * around even after switching orgs.
     *
     * The domain is read from Origin/Referer (see utils/requestOrg): the Host
     * header here is always this API, never the site the user was on.
     */
    let joinedOrgId: string | null = null;

    if (whitelabelOrgId) {
      const joined = await addUserToOrg(
        user._id.toString(),
        String(whitelabelOrgId),
        { guest: true },
      );
      if (joined) joinedOrgId = String(whitelabelOrgId);
    }

    // Garage HQ remains the home for direct my.garage.app signups, and is the
    // fallback if the white-label join failed for any reason — a user with no
    // office at all would be stranded.
    if (!joinedOrgId) {
      await addUserToGarageHQ(user._id.toString(), { guest: true });
    }

    // Welcome email from the office they actually joined, so a white-label
    // member is greeted by that brand rather than by Garage.
    sendWelcomeEmail(user._id.toString(), joinedOrgId).catch((err) =>
      console.error("[WelcomeEmail] Failed:", err),
    );
    // Refresh user data to include GARAGE HQ membership
    user = await User.findById(user._id).populate({
      path: "organizations.organization",
      match: { source: { $ne: "nc_affiliate_store" } },
    });
  } else {
    // Existing user — update referredBy if referrer was found. Uses the
    // upgrade-aware attribution service so a founder_default placeholder
    // gets overridden by a real affiliate click, and the affiliate gets
    // an "onboarded X" notification email in the process. If the user
    // already has a real affiliate attribution, this is a no-op.
    if (referrerId) {
      try {
        const { User: U } = await import("../models/user.model");
        const referrer = await U.findById(referrerId)
          .select("affiliateId")
          .lean<any>();
        if (referrer?.affiliateId) {
          const { setReferredByAffiliateId } = await import(
            "../services/affiliate"
          );
          await setReferredByAffiliateId(
            user._id.toString(),
            referrer.affiliateId,
          );
        }
      } catch (attrErr) {
        console.error(
          "🎯 Attribution upgrade failed for existing user:",
          attrErr,
        );
      }
    }
  }

  if (!user) return res.status(500).json({ error: "Failed to create user" });
  if (usedInvite) markPendingInviteUsed(usedInvite.inviteId, user._id.toString());

  user.isVerified = true;
  if (profile) {
    if (!user.name && profile.name) user.name = profile.name;
    if (!(user as any).profilePicture && profile.picture) (user as any).profilePicture = profile.picture;
  }
  // Coverfi: logging in via the main Garage OTP endpoint counts as "graduating"
  // from insurance-only access. Flip insurance_user:false across all memberships
  // so subsequent portal calls return 401. The dedicated portal endpoint on the
  // Coverfi backend does NOT touch this — only main Garage login does.
  if ((user.organizations as any[])?.some((m: any) => m?.insurance_user)) {
    (user.organizations as any[]).forEach((m: any) => {
      if (m?.insurance_user) m.insurance_user = false;
    });
  }
  await user.save();

  // Get organizations with roles for this user (deduplicated to prevent duplicate entries)
  // Filter out memberships where the organization reference is null (deleted orgs)
  const rawOrganizations =
    user.organizations
      ?.filter((membership: any) => membership.organization != null)
      .map((membership: any) => ({
        id: membership.organization._id || membership.organization,
        name: membership.organization.name || "Unknown Organization",
        icon: membership.organization.icon || "",
        role: membership.role,
        joinedAt: membership.joinedAt,
        parent: membership.organization.parent || false,
        guest: membership.guest,
      })) || [];
  const organizations = deduplicateOrganizations(rawOrganizations);

  console.log("Organizations", organizations);

  const response: any = {
    user: {
      id: user.id,
      // `|| null` keeps the KEY present for a phone-only account. Left as
      // bare `user.email` it would be undefined, JSON.stringify would drop
      // the key entirely, and clients reading `data.user.email` would see a
      // differently-shaped object depending on how the user signed up.
      email: user.email || null,
      // Same again: a user who has never set a name would otherwise drop the
      // key entirely. Pre-existing, but a phone signup has no name by
      // definition, so it would have become the common case.
      name: user.name || null,
      role: user.role,
      organizations,
      hasOrganizations: organizations.length > 0,
      // Soft phone-verify gate: the app reads this to decide whether to
      // show the "verify your phone" prompt after login. Purely advisory
      // — no backend route blocks on it.
      phone: (user as any).phone || null,
      phoneVerified: !!(user as any).phoneVerified,
    },
    // Always include userId so frontend can use it for org creation
    userId: user.id,
  };

  // If user has only one organization, auto-select it and create token
  if (organizations.length === 1) {
    const org = organizations[0];
    response.token = signJwt({
      userId: user.id,
      orgId: org.id,
      role: org.role,
      name: user.name,
      // Same reason as above — the claim stays present, valued null, so the
      // token's shape does not depend on which identifier was used.
      email: user.email || null,
    });
    response.user.currentOrg = org;
  } else {
    // ZERO or MANY orgs. Both can reach office creation:
    //   0   -> straight to /organization
    //   2+  -> /select-organization, whose "Create Workspace" also lands there
    // and that route now requires auth (POST /org/create-first-time used to
    // accept a body `userId` with no token at all). Issue a user-scoped token:
    // no `orgId`, because none is selected yet, and requireAuth treats it as
    // optional.
    //
    // `currentOrg` is deliberately left unset. The frontend keys "auto-selected
    // an org, go to workspace" off currentOrg, NOT off the token's presence, so
    // this diverts nobody away from the picker or from org creation. Picking an
    // org later overwrites this with a proper org-scoped token via
    // /auth/select-org.
    response.token = signJwt({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email || null,
    });
  }

  res.json(response);
}

/**
 * Google sign-in. The app hands over the ID token it received from Google
 * Sign-In; we have Google confirm it (signature, expiry) and check it was
 * minted for one of OUR OAuth clients, then finish exactly the way an
 * emailed OTP does — same user record, same offices, same response shape.
 * Google's verified email is the identity, so an existing OTP account and a
 * Google login for the same address are one and the same user.
 */
router.post("/google", async (req, res) => {
  const schema = z.object({
    idToken: z.string().min(20),
    referralCode: z.string().optional(),
  });
  const { idToken, referralCode } = schema.parse(req.body);

  if (!env.GOOGLE_OAUTH_CLIENT_IDS.length) {
    return res.status(503).json({ error: "Google sign-in is not configured" });
  }

  let info: Record<string, unknown>;
  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return res.status(401).json({ error: "Google could not verify that sign-in" });
    info = (await r.json()) as Record<string, unknown>;
  } catch {
    return res.status(502).json({ error: "Could not reach Google to verify the sign-in" });
  }

  const issOk = ["accounts.google.com", "https://accounts.google.com"].includes(String(info.iss));
  const audOk = env.GOOGLE_OAUTH_CLIENT_IDS.includes(String(info.aud));
  const fresh = Number(info.exp) * 1000 > Date.now();
  const verified = info.email_verified === true || info.email_verified === "true";
  const email = String(info.email || "").trim().toLowerCase();
  if (!issOk || !audOk || !fresh || !verified || !email) {
    return res.status(401).json({ error: "That Google account can't be used to sign in" });
  }

  // Google sign-in always yields an email — build an Identifier with
  // that discriminator so finishLogin's phone-branch stays unreachable
  // from this path.
  return finishLogin(req, res, {
    id: { kind: "email", email },
    referralCode,
    profile: {
      name: typeof info.name === "string" ? info.name : undefined,
      picture: typeof info.picture === "string" ? info.picture : undefined,
    },
  });
});

// Route to select an organization after login
router.post("/select-org", async (req, res) => {
  const schema = z.object({
    userId: z.string(),
    orgId: z.string(),
  });
  const { userId, orgId } = schema.parse(req.body);

  const user = await User.findById(userId).populate({
    path: "organizations.organization",
    // Same filter as /login: an NC-store org must not be selectable via
    // garagenew's flow. A user landing here with such an orgId gets 404
    // ("membership not found") — they can still access the storefront
    // through garage-store directly, where the org is on their memberships.
    match: { source: { $ne: "nc_affiliate_store" } },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Find the selected organization membership (filter out null orgs)
  const membership = user.organizations.find(
    (m: any) =>
      m.organization != null && m.organization._id.toString() === orgId,
  );

  if (!membership) {
    return res.status(400).json({ error: "Organization not found for user" });
  }

  const token = signJwt({
    userId: user.id,
    orgId: orgId,
    role: membership.role,
    name: user.name,
    email: user.email,
    guest: user.guest,
  });

  const orgData = membership.organization as any;
  res.json({
    token,
    currentOrg: {
      id: orgId,
      name: orgData?.name || "Unknown Organization",
      role: membership.role,
      joinedAt: membership.joinedAt,
      parent: orgData?.parent || false,
    },
  });
});

// Route to get token after organization creation
router.post("/token-after-org", async (req, res) => {
  const schema = z.object({
    userId: z.string(),
    orgId: z.string(),
  });
  const { userId, orgId } = schema.parse(req.body);

  console.log("=== TOKEN AFTER ORG DEBUG ===");
  console.log("userId:", userId);
  console.log("orgId:", orgId);

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  console.log("User organizations:", user.organizations);

  // Verify user is a member of this organization
  const membership = user.organizations.find(
    (m: any) => m.organization.toString() === orgId,
  );

  console.log("Found membership:", membership);

  if (!membership) {
    return res.status(400).json({ error: "User not member of organization" });
  }

  const token = signJwt({
    userId: user.id,
    orgId: orgId,
    role: membership.role,
    name: user.name,
    email: user.email,
    guest: user.guest,
  });

  console.log("Generated token with:", {
    userId: user.id,
    orgId: orgId,
    role: membership.role,
    name: user.name,
    email: user.email,
  });
  console.log("=== END TOKEN AFTER ORG DEBUG ===");

  res.json({ token });
});

// Get user info by ID
router.get("/get-user", async (req, res) => {
  const schema = z.object({
    userId: z.string(),
  });

  const { userId } = schema.parse(req.query);

  const user = await User.findById(userId);

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
});

// Update user info
router.post("/update-user", async (req, res) => {
  const schema = z.object({
    userId: z.string(),
    name: z.string().optional(),
    phone: z.string().optional(),
  });
  const { userId, name, phone } = schema.parse(req.body);

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (name) user.name = name.trim();
  // trim() strips the OUTER whitespace only — the space after the dial
  // code survives it, and that is exactly what login can't match.
  if (phone) user.phone = storablePhone(phone) ?? phone.trim();
  await user.save();

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    guest: user.guest,
  });
});

// Get current user info with organizations
router.get("/me", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };

  const user = await User.findById(me.userId).populate({
    path: "organizations.organization",
    match: { source: { $ne: "nc_affiliate_store" } },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Get all org IDs to fetch subscriptions (filter out null orgs)
  const orgIds =
    user.organizations
      ?.filter((m: any) => m.organization != null)
      .map((m: any) => m.organization._id || m.organization) || [];

  // Fetch subscriptions for all orgs in one query
  const subscriptions = await OfficeSubscription.find({
    orgId: { $in: orgIds },
    status: { $in: ["authenticated", "active", "created"] },
  }).populate("planId", "name slug");

  // Create a map of orgId -> plan info
  const orgPlanMap = new Map<string, { planSlug: string; planName: string }>();
  for (const sub of subscriptions) {
    const plan = sub.planId as any;
    if (plan) {
      orgPlanMap.set(String(sub.orgId), {
        planSlug: plan.slug || "",
        planName: plan.name || "",
      });
    }
  }

  // Get organizations with roles for this user (deduplicated to prevent duplicate entries)
  // Filter out memberships where the organization reference is null (deleted orgs)
  const rawOrganizations =
    user.organizations
      ?.filter((membership: any) => membership.organization != null)
      .map((membership: any) => {
        const orgId = String(
          membership.organization._id || membership.organization,
        );
        const planInfo = orgPlanMap.get(orgId);
        return {
          id: orgId,
          name: membership.organization.name || "Unknown Organization",
          icon: membership.organization.icon || "",
          role: membership.role,
          fullAccess: membership.fullAccess || false,
          // Module-level RBAC. Always all-keys-present; founders/fullAccess
          // bypass the map, so read `role`/`fullAccess` first when gating.
          modulePermissions: normalizePermissions(membership),
          joinedAt: membership.joinedAt,
          guest: membership.guest,
          planSlug: planInfo?.planSlug || null,
          planName: planInfo?.planName || null,
          parent: membership.organization.parent || false,
        };
      }) || [];
  // Sort organizations: parent org first, then by joinedAt
  const organizations = deduplicateOrganizations(rawOrganizations).sort(
    (a: any, b: any) => {
      // Parent org always comes first
      if (a.parent && !b.parent) return -1;
      if (!a.parent && b.parent) return 1;
      // Otherwise sort by joinedAt (oldest first)
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    },
  );

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profilePicture: user.profilePicture || "",
      organizations,
      // Soft phone-verify gate (advisory) — app shows the verify prompt
      // when phoneVerified is false. No route enforces it.
      phone: (user as any).phone || null,
      phoneVerified: !!(user as any).phoneVerified,
    },
  });
});

// Logout endpoint - instantly removes user from workspace presence
router.post("/logout", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    console.log(`[AUTH] User ${userId} logging out - cleaning up presence`);

    // 1. Force disconnect all user's socket connections FIRST
    // This will trigger the disconnect handler which cleans up workspace presence
    const io = getSocketInstance();
    if (io) {
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      console.log(
        `[AUTH] Found ${sockets.length} socket(s) for user ${userId}, disconnecting...`,
      );

      for (const socket of sockets) {
        socket.disconnect(true); // Force disconnect - this triggers the disconnect handler
      }

      console.log(`[AUTH] Disconnected all sockets for user ${userId}`);
    }

    // 2. Double-check: Remove from Redis/in-memory workspace presence directly as backup
    const presenceService = new WorkspacePresenceService();

    // Wait a moment for disconnect handlers to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Force cleanup in case disconnect handler didn't run
    if (isRedisAvailable()) {
      const stillExists = await presenceService.getUser(userId);
      if (stillExists) {
        await presenceService.removeUser(userId);
        console.log(
          `[AUTH] Force removed user ${userId} from Redis workspace presence after disconnect`,
        );
      }
    }

    res.json({
      ok: true,
      message: "Logged out successfully - presence cleared instantly",
    });
  } catch (error) {
    console.error("[AUTH] Error during logout:", error);
    res.status(500).json({
      error: "Logout failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── Phone verification (post-signup) ─────────────────────────────────────────
//
// The user is already signed in (email OTP). These two routes add an SMS-based
// phone-number verification step. The OTP is generated + verified locally
// (services/otp.ts, Mongo TTL); 2Factor only delivers the SMS. Both are keyed
// on the signed-in user's email so verify reuses the standard email+code lookup.

// POST /auth/phone/request-otp  { phone, channel? }
// Generates a fresh OTP, stores it under purpose "phone-verify", and delivers
// it over SMS (2Factor), WhatsApp (11za), or both. 503 when no channel is
// configured; 400 on a bad number.
router.post("/phone/request-otp", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string().min(6),
      /**
       * Where to send the code. Defaults to "sms" so existing clients keep
       * the behaviour they were written against — WhatsApp costs money per
       * message and shouldn't switch on for callers that never asked.
       */
      channel: z.enum(["sms", "whatsapp", "both"]).optional(),
    });
    const { phone, channel = "sms" } = schema.parse(req.body);

    const wantsSms = channel === "sms" || channel === "both";
    const wantsWhatsapp = channel === "whatsapp" || channel === "both";

    // Refuse only when NOTHING the caller asked for can be delivered. On
    // "both" with one channel configured, the working one still carries it.
    const smsReady = wantsSms && twoFactorConfigured();
    const whatsappReady = wantsWhatsapp && elevenZaConfigured();
    if (!smsReady && !whatsappReady) {
      return res
        .status(503)
        .json({ ok: false, error: "OTP delivery is not configured" });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: "Invalid phone number" });
    }

    const userId = (req as any).user.userId as string;
    const user = await User.findById(userId).select("email name").lean();
    if (!user?.email) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const code = await createOtp(user.email, "phone-verify");

    // Both channels are attempted independently: one provider being down
    // must not swallow a code the other already delivered. The request only
    // fails when every attempted channel failed — otherwise the user has a
    // code in hand and a 502 would tell them to try again for nothing.
    const attempted: string[] = [];
    const delivered: string[] = [];
    const failures: string[] = [];

    if (smsReady) {
      attempted.push("sms");
      try {
        await sendOtpSms(normalized, code);
        delivered.push("sms");
      } catch (err) {
        failures.push(`sms: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (whatsappReady) {
      attempted.push("whatsapp");
      try {
        await sendOtpWhatsapp(normalized, code, user.name);
        delivered.push("whatsapp");
      } catch (err) {
        failures.push(
          `whatsapp: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // One line, not a stack dump — this used to be a 150-line log entry.
    if (failures.length > 0) {
      console.warn(`[AUTH] phone OTP delivery failed — ${failures.join(" | ")}`);
    }

    if (delivered.length === 0) {
      return res.status(502).json({
        ok: false,
        error: failures[0]?.split(": ").slice(1).join(": ") || "Failed to send OTP",
      });
    }

    res.json({ ok: true, phone: normalized, channels: delivered, attempted });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "phone is required" });
    }
    console.error("[AUTH] phone/request-otp failed:", error);
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send OTP",
    });
  }
});

// POST /auth/phone/verify-otp  { phone, code }
// Verifies the code against the stored OTP; on success stamps the number on the
// user and flips phoneVerified = true.
router.post("/phone/verify-otp", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string().min(6),
      code: z.string().min(4).max(8),
      /**
       * Where this verification is happening, for the founder's webinar
       * report. Optional — the profile-setup flow sends nothing. Reported
       * only, never used to authorize anything; see PhoneVerificationEvent.
       */
      context: z
        .object({
          workshopId: z.string().max(64).optional(),
          itemType: z.string().max(40).optional(),
          itemId: z.string().max(80).optional(),
          itemName: z.string().max(200).optional(),
          source: z.string().max(40).optional(),
        })
        .optional(),
    });
    const { phone, code, context } = schema.parse(req.body);

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: "Invalid phone number" });
    }

    const userId = (req as any).user.userId as string;
    // `profileCompletedAt` MUST be projected in. Mongoose returns undefined for
    // unselected paths, so the "already started?" guard below silently passed
    // on every call — letting anyone restart their 24-hour offer window at will
    // by re-verifying their number.
    //
    // `name` rides along for the PhoneVerificationEvent written below, so the
    // founder's webinar report can name the person without a second lookup.
    const user = await User.findById(userId).select(
      "email name profileCompletedAt"
    );
    if (!user?.email) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const result = await verifyOtp(user.email, code, "phone-verify");
    // verifyOtp returns false on a bad/expired code, or a string (orgId or "")
    // on success — mirror the login route's `!ok && ok !== ""` guard.
    if (result === false) {
      return res.status(400).json({ ok: false, error: "Invalid or expired OTP" });
    }

    /**
     * Another account may already hold this number.
     *
     * `phone` is now uniquely indexed, so without this the save throws a raw
     * E11000 and the caller gets a 500 — which is exactly what production hit
     * after the dedupe migration: a user whose number had been reassigned to
     * an older account tried to verify it back and got a stack trace.
     *
     * Proof of possession wins. Passing an OTP on this handset is the
     * strongest claim anyone can make to the number, so an account holding it
     * WITHOUT having verified it loses it here. A holder that did verify is a
     * genuine conflict — two people cannot both be on the same handset — and
     * needs a human, so it returns a clear 409 rather than silently moving it.
     */
    const holder: any = await User.findOne({
      phone: normalized,
      _id: { $ne: user._id },
    })
      .select("email phoneVerified")
      .lean();

    if (holder) {
      if (holder.phoneVerified) {
        return res.status(409).json({
          ok: false,
          error:
            "That number is already verified on another account. Contact support to move it.",
        });
      }
      await User.updateOne(
        { _id: holder._id },
        { $unset: { phone: "" }, $set: { phoneVerified: false } }
      );
      console.log(
        `[AUTH] ${normalized} released from unverified account ${holder.email} → claimed by ${user.email} via OTP`
      );
    }

    user.set("phone", normalized);
    user.set("phoneVerified", true);

    // Verifying a phone completes the basic profile, so start the 24-hour
    // free-first-cycle window here if it has never run. `downlines.ts` already
    // treats name + phone as "profile complete" for exactly this reason; the
    // PUT /profile handler is stricter only because it also collects an
    // address, which this flow deliberately doesn't ask for.
    //
    // Only `profileCompletedAt` is stamped — NOT `profileComplete`. The
    // window keys off the timestamp, while leaving the flag alone keeps the
    // "finish your profile" prompt honest about the missing address.
    // Guarded so re-verifying a number can never restart someone's window.
    const startedComboWindow = !user.get("profileCompletedAt");
    if (startedComboWindow) {
      user.set("profileCompletedAt", new Date());
    }

    try {
      await user.save();
    } catch (err: any) {
      // Belt and braces for the race the check above cannot close: two people
      // verifying the same number within the same instant. Never let a raw
      // E11000 reach the client as a 500.
      if (err?.code === 11000) {
        return res.status(409).json({
          ok: false,
          error: "That number was just claimed by another account.",
        });
      }
      throw err;
    }

    /**
     * Durable record of this verification and what prompted it.
     *
     * Written after the save so a reporting failure can never cost someone
     * their verified number — the OTP is already spent, and making them
     * request another because an analytics insert failed would be absurd.
     */
    (async () => {
      const { PhoneVerificationEvent } = await import(
        "../models/phoneVerificationEvent.model"
      );
      const workshopId =
        context?.workshopId && Types.ObjectId.isValid(context.workshopId)
          ? new Types.ObjectId(context.workshopId)
          : undefined;
      await PhoneVerificationEvent.create({
        userId: new Types.ObjectId(userId),
        phone: normalized,
        email: user.email,
        name: (user as any).name,
        workshopId,
        // Day key only when it belongs to a webinar, so it lines up with
        // WebinarAttendance and WebinarProductPin.
        sessionDate: workshopId
          ? new Date(new Date().toISOString().slice(0, 10))
          : undefined,
        itemType: context?.itemType,
        itemId: context?.itemId,
        itemName: context?.itemName,
        source: context?.source || (workshopId ? "webinar-pin" : "profile"),
        startedComboWindow,
        verifiedAt: new Date(),
      });
    })().catch((err) =>
      console.warn("[phone/verify-otp] verification not recorded:", err?.message)
    );

    res.json({ ok: true, phone: normalized, phoneVerified: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "phone and code are required" });
    }
    console.error("[AUTH] phone/verify-otp failed:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Verification failed",
    });
  }
});

// List all active OTP codes.
//
// Reading a live OTP is log-in-as-anyone. It used to be super-admin only; a
// super admin can now grant it from Roles & Access (otp_codes /
// phone_otp_codes in config/adminPages — view-only, off by default), with
// two guards that apply to everyone who isn't a super admin:
//
//   1. Codes for ADMIN accounts are hidden — the garage-admin login/invite
//      codes, and any code sent to an email that belongs to an admin — so a
//      delegated admin can't use this to log in as another admin.
//   2. Every view is logged (otp_code_access_logs), super admins included,
//      folded into one row per admin, page and 10-minute window.

/** Lowercased emails of every garage admin. */
async function adminEmails(): Promise<Set<string>> {
  const rows: any[] = await GarageAdminModel.find({}).select("email").lean();
  return new Set(rows.map((r) => String(r.email || "").trim().toLowerCase()).filter(Boolean));
}

/** Drop admin-account codes unless the viewer is a super admin. */
async function visibleOtps(req: GarageAdminRequest, otps: any[]): Promise<any[]> {
  if (req.garageAdmin?.isSuperAdmin) return otps;
  const admins = await adminEmails();
  return otps.filter(
    (otp) =>
      !String(otp.purpose || "").startsWith("garage-admin") &&
      !admins.has(String(otp.email || "").trim().toLowerCase())
  );
}

/** Record a view; never fails the request. */
function logOtpView(
  req: GarageAdminRequest,
  page: "otp_codes" | "phone_otp_codes",
  codesShown: number
): void {
  const admin = req.garageAdmin;
  if (!admin?.id) return;
  const windowMs = 10 * 60 * 1000;
  const bucket = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  OtpCodeAccessLog.updateOne(
    { adminId: new Types.ObjectId(admin.id), page, bucket },
    {
      $setOnInsert: { adminEmail: admin.email, isSuperAdmin: !!admin.isSuperAdmin },
      $inc: { views: 1 },
      $set: { codesShown, ip: req.ip || null, lastViewedAt: new Date() },
    },
    { upsert: true }
  ).catch((err) => console.error("[AUTH] OTP view log failed:", err));
}

router.get("/otp-codes", requireGarageAdminAuth, requireAdminPage("otp_codes"), async (req: GarageAdminRequest, res) => {
  try {
    const all = await OtpCode.find({}).sort({ createdAt: -1 }).lean();
    const otps = await visibleOtps(req, all);
    logOtpView(req, "otp_codes", otps.length);

    res.json({
      ok: true,
      otps: otps.map((otp: any) => ({
        id: otp._id,
        email: otp.email,
        code: otp.code,
        purpose: otp.purpose,
        expiresAt: otp.expiresAt,
        createdAt: otp.createdAt,
        isExpired: new Date(otp.expiresAt).getTime() < Date.now(),
      })),
    });
  } catch (error) {
    console.error("[AUTH] Error fetching OTP codes:", error);
    res.status(500).json({
      error: "Failed to fetch OTP codes",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /auth/phone-otp-codes
 *
 * Live SMS verification codes, for the admin console. OTPs are keyed by the
 * user's EMAIL (that's what createOtp stores), so the phone number people
 * actually want to see has to be joined in from the user record.
 *
 * Only unexpired rows exist to read: the collection carries a TTL index on
 * `expiresAt`, so Mongo removes them the moment they lapse.
 *
 * Grantable as phone_otp_codes, with the same two guards as /otp-codes above.
 */
router.get("/phone-otp-codes", requireGarageAdminAuth, requireAdminPage("phone_otp_codes"), async (req: GarageAdminRequest, res) => {
  try {
    const all = await OtpCode.find({ purpose: "phone-verify" })
      .sort({ createdAt: -1 })
      .lean();
    const otps = await visibleOtps(req, all);
    logOtpView(req, "phone_otp_codes", otps.length);

    const emails = [...new Set(otps.map((o: any) => o.email).filter(Boolean))];
    const users = await User.find({ email: { $in: emails } })
      .select("email name phone phoneVerified")
      .lean();
    const byEmail = new Map(users.map((u: any) => [u.email, u]));

    res.json({
      ok: true,
      otps: otps.map((otp: any) => {
        const u = byEmail.get(otp.email);
        return {
          id: otp._id,
          email: otp.email,
          name: u?.name || null,
          phone: u?.phone || null,
          phoneVerified: !!u?.phoneVerified,
          code: otp.code,
          purpose: otp.purpose,
          expiresAt: otp.expiresAt,
          createdAt: otp.createdAt,
          isExpired: new Date(otp.expiresAt).getTime() < Date.now(),
        };
      }),
    });
  } catch (error) {
    console.error("[AUTH] Error fetching phone OTP codes:", error);
    res.status(500).json({
      error: "Failed to fetch phone OTP codes",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});


// ── Associating a phone-signup account with an existing one ──────────────
//
// Logging in by phone MINTS an account when the number matches none, so
// someone whose number was never on file lands in an empty account and
// reasonably thinks their history is gone. These two endpoints let them point
// at their real account by email, prove they own it, and move across.
//
// Both require the caller to already be signed in to the throwaway account,
// so a merge always needs two proofs: the phone OTP that created the session,
// and the email OTP checked below. Either alone is worthless.

// POST /auth/associate/request-otp  { email }
// Sends a code to `email` if an account holds it. Reports whether one does, so
// the UI can offer the merge — no more disclosure than /auth/email-available
// already gives anonymously.
router.post("/associate/request-otp", requireAuth, async (req, res) => {
  try {
    const { email: raw, addIfNew } = z
      .object({
        email: z.string().min(1),
        // Opt-in so clients that predate the add-email flow keep today's
        // behaviour: without it, a new email sends nothing, and an old app
        // can't strand a user with a code it has no screen to enter.
        addIfNew: z.boolean().optional(),
      })
      .parse(req.body);
    const id = classifyIdentifier(raw);
    if (id.kind !== "email") {
      return res
        .status(400)
        .json({ ok: false, error: "Enter the email address of your existing account" });
    }

    const me = (req as any).user.userId as string;
    const target: any = await User.findOne({ email: id.email }).select("_id name").lean();

    // Nothing to merge into, so this is a NEW email for the caller's own
    // account. There was never a profile flow that could save one — PUT
    // /profile takes no email — so a phone signup was stuck without one, and
    // with it the sign-up offer email. Prove the inbox, then /auth/email/verify
    // saves it.
    if (!target) {
      if (!addIfNew) return res.json({ ok: true, exists: false });

      const caller: any = await User.findById(me).select("email phone").lean();
      if (!caller) {
        return res.status(404).json({ ok: false, error: "Session account not found" });
      }
      // Only fills an EMPTY email. Changing an existing one is a different,
      // riskier operation and deliberately not reachable from here.
      if (caller.email) {
        return res.json({ ok: true, exists: false, codeSent: false, hasEmail: true });
      }

      const code = await createOtp(id.email, "email-add");
      // Name the account by its (masked) number, so a code requested by
      // someone else's session is recognisably not the recipient's own.
      const masked = caller.phone
        ? `${caller.phone.slice(0, 3)}••••${caller.phone.slice(-4)}`
        : null;
      const forWhom = masked ? ` to the Garage account for ${masked}` : " to your Garage account";
      await sendMail(
        id.email,
        "Confirm your email",
        `<p>Use <b>${code}</b> to add this email${forWhom} (valid 10 minutes).</p>
         <p>If you didn't ask for this, ignore this email — nothing has changed.</p>`,
        `Use ${code} to add this email${forWhom} (valid 10 minutes). If you didn't ask for this, ignore this email.`,
        await senderForHost(req, EMAIL_FROM_OTP),
      );
      return res.json({ ok: true, exists: false, codeSent: true });
    }

    if (String(target._id) === String(me)) {
      return res.json({ ok: true, exists: false, self: true });
    }

    const code = await createOtp(id.email, "account-associate");
    await sendMail(
      id.email,
      "Confirm it's you",
      `<p>Use <b>${code}</b> to link your phone number to this Garage account (valid 10 minutes).</p>
       <p>If you didn't ask for this, ignore this email — nothing has changed.</p>`,
      `Use ${code} to link your phone number to this Garage account (valid 10 minutes). If you didn't ask for this, ignore this email.`,
      await senderForHost(req, EMAIL_FROM_OTP),
    );
    res.json({ ok: true, exists: true, name: target.name || null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }
    console.error("[AUTH] associate/request-otp failed:", error);
    res.status(500).json({ ok: false, error: "Could not send the code" });
  }
});

// POST /auth/associate/verify  { email, code }
// On success the CALLER'S account is deleted and a session for the target
// account is returned, in the same shape /auth/verify-otp uses so the client
// can reuse its existing handling.
router.post("/associate/verify", requireAuth, async (req, res) => {
  try {
    const { email: raw, code } = z
      .object({ email: z.string().min(1), code: z.string().min(6).max(6) })
      .parse(req.body);

    const id = classifyIdentifier(raw);
    if (id.kind !== "email") {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    const me = (req as any).user.userId as string;
    const throwaway: any = await User.findById(me).select("phone phoneVerified");
    if (!throwaway) {
      return res.status(404).json({ ok: false, error: "Session account not found" });
    }
    // The whole point is moving a PROVEN number. Without one there is nothing
    // to merge and no second factor — refuse rather than delete an account.
    if (!throwaway.phone || !throwaway.phoneVerified) {
      return res.status(400).json({
        ok: false,
        error: "Verify your phone number before linking an account",
      });
    }

    const ok = await verifyOtp(id.email, code, "account-associate");
    if (!ok && ok !== "") {
      return res.status(400).json({ ok: false, error: "Invalid or expired code" });
    }

    const target: any = await User.findOne({ email: id.email }).select("_id");
    if (!target) {
      return res.status(404).json({ ok: false, error: "No account with that email" });
    }

    const { mergePhoneAccountInto } = await import("../services/accountMerge");
    const result = await mergePhoneAccountInto(me, String(target._id));
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    // Sign the caller into the account that survived.
    const user: any = await User.findById(result.targetUserId).populate({
      path: "organizations.organization",
      match: { source: { $ne: "nc_affiliate_store" } },
    });

    const organizations = deduplicateOrganizations(
      (user.organizations || [])
        .filter((m: any) => m.organization)
        .map((m: any) => ({
          id: m.organization._id || m.organization,
          name: m.organization.name || "Unknown Organization",
          icon: m.organization.icon || "",
          role: m.role,
          joinedAt: m.joinedAt,
          parent: m.organization.parent || false,
          guest: m.guest,
        })),
    );

    const response: any = {
      ok: true,
      merged: true,
      movedPhone: result.movedPhone,
      user: {
        id: user.id,
        email: user.email || null,
        name: user.name || null,
        role: user.role,
        organizations,
        hasOrganizations: organizations.length > 0,
        phone: user.phone || null,
        phoneVerified: !!user.phoneVerified,
      },
      userId: user.id,
    };
    if (organizations.length === 1) {
      const org = organizations[0];
      response.token = signJwt({
        userId: user.id,
        orgId: org.id,
        role: org.role,
        name: user.name,
        email: user.email || null,
      });
      response.user.currentOrg = org;
    }

    console.log(
      `[AUTH] merged throwaway ${me} into ${result.targetUserId}` +
        `${result.movedPhone ? ` (phone ${result.movedPhone})` : ""}` +
        `${result.bonusReversed ? " — signup bonus reversed" : ""}`,
    );
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Email and code are required" });
    }
    console.error("[AUTH] associate/verify failed:", error);
    res.status(500).json({ ok: false, error: "Could not link the accounts" });
  }
});

// POST /auth/email/verify  { email, code }
// Saves a NEW email onto the caller's account once they prove the inbox with
// the code from /auth/associate/request-otp ({ addIfNew: true }). Only for an
// account with no email yet — i.e. a phone signup completing their profile.
//
// Returns a fresh token because the JWT carries `email`, and the web client
// reads identity from the token as well as the store.
router.post("/email/verify", requireAuth, async (req, res) => {
  try {
    const { email: raw, code } = z
      .object({ email: z.string().min(1), code: z.string().min(6).max(6) })
      .parse(req.body);

    const id = classifyIdentifier(raw);
    if (id.kind !== "email") {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    const me = (req as any).user.userId as string;
    const caller: any = await User.findById(me).select("email name").lean();
    if (!caller) {
      return res.status(404).json({ ok: false, error: "Session account not found" });
    }
    if (caller.email) {
      return res
        .status(409)
        .json({ ok: false, error: "This account already has an email" });
    }

    const ok = await verifyOtp(id.email, code, "email-add");
    if (!ok && ok !== "") {
      return res.status(400).json({ ok: false, error: "Invalid or expired code" });
    }

    // Someone may have registered the address between the code being sent and
    // entered. Offer the merge instead of failing opaquely.
    const taken = await User.exists({ email: id.email, _id: { $ne: me } });
    if (taken) {
      return res.status(409).json({
        ok: false,
        error: "email_taken",
        message: "That email now belongs to another account — link it instead.",
      });
    }

    // Guarded on the email still being empty, so two tabs can't race a second
    // address in. The unique index is the backstop for the cross-account race.
    let modified = 0;
    try {
      const r = await User.updateOne(
        {
          _id: me,
          $or: [{ email: { $exists: false } }, { email: null }, { email: "" }],
        },
        { $set: { email: id.email } },
      );
      modified = r.modifiedCount;
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({
          ok: false,
          error: "email_taken",
          message: "That email now belongs to another account — link it instead.",
        });
      }
      throw err;
    }
    if (!modified) {
      return res
        .status(409)
        .json({ ok: false, error: "This account already has an email" });
    }

    // The sign-up offer only fires when an account is CREATED with an email,
    // which a phone signup never is — so without this they never get it. The
    // 24h window still runs from sign-up; this just delivers it. White-label
    // domains get no Garage upsell, matching the signup route.
    if (!(await orgIdFromRequest(req))) {
      import("../services/signupOffer")
        .then(({ sendSignupOffer }) =>
          sendSignupOffer({ userId: me, email: id.email, name: caller.name }),
        )
        .catch((err) =>
          console.error("[AUTH] email/verify signup offer failed:", err?.message || err),
        );
    }

    // Re-sign the caller's own token with the new email, preserving every
    // other claim (org scope included) exactly as it was.
    let token: string | undefined;
    const header = req.headers.authorization;
    if (header) {
      try {
        const { verifyJwt } = await import("../services/jwt");
        const { iat, exp, nbf, ...claims } = verifyJwt<any>(header.split(" ")[1]);
        token = signJwt({ ...claims, email: id.email });
      } catch {
        /* requireAuth already validated it; a failure here just skips the refresh */
      }
    }

    console.log(`[AUTH] added email ${id.email} to ${me}`);
    res.json({ ok: true, email: id.email, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Email and code are required" });
    }
    console.error("[AUTH] email/verify failed:", error);
    res.status(500).json({ ok: false, error: "Could not save the email" });
  }
});

export default router;
