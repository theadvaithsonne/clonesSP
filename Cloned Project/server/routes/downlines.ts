// src/routes/downlines.ts
//
// "Enroll a Downline" — any logged-in member can pre-register a NEW user
// directly under their referral, into one of the offices they belong to.
//
// Mounted at /downlines. Requires `requireAuth`.
//
// Behavior:
//   - Creates a real User row with `referredBy = me._id`.
//   - Adds them as a stakeholder of the chosen org with the org's first
//     floor (mirrors the addUserToGarageHQ pattern in services/init.ts).
//   - Pre-stashes profile fields the inviter supplied (name, phone, city,
//     country, designation). `profileComplete` is set when both name and
//     phone are filled — the downline skips the onboarding form on first
//     login. Otherwise the onboarding card still appears.
//   - NO emails, NO links, NO temporary password. The downline logs in
//     via the standard OTP-on-email flow whenever they choose to.
//   - Rejects existing emails with 409 USER_EXISTS.

import { Router, Request, Response } from "express";
import { z, ZodError } from "zod";
import { Types } from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { storablePhone } from "../services/twoFactorSms";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Floor } from "../models/floor.model";
import { generateAffiliateId } from "../utils/affiliateId";
import { syncNewEnrollee } from "../services/downlineTree";
import { sendMail, EMAIL_FROM_NOTIFICATION, senderForOrg } from "../services/mailer";
import {
  autoJoinMembersChannel,
  autoJoinDefaultChannel,
} from "../services/channel";
import { addUserToGarageHQ } from "../services/init";
import { env } from "../config/env";
import { extendDownlineOffer } from "../controllers/downlineOffer.controller";

const router = Router();

const enrollSchema = z.object({
  orgId: z
    .string()
    .min(1)
    .refine((v) => Types.ObjectId.isValid(v), "orgId must be a valid ObjectId"),
  email: z.string().email().max(254),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  // Country drives the postal-code resolver on the FE; state + city are
  // typically auto-filled from the resolved postal code, but the user can
  // override them. All four are optional — same as today's name/phone.
  country: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  designation: z.string().trim().max(120).optional(),
});

// ──────────────────────────────────────────────────────────────────────
// GET /downlines/check-email?email=<addr>
// ──────────────────────────────────────────────────────────────────────
// Lightweight pre-flight for the Enroll-a-Downline form. Returns whether
// a Garage user with this email already exists so the FE can block the
// submit button BEFORE the user fills out the rest of the form.
//
// Auth-gated to keep this from being a free email-enumeration oracle —
// only signed-in members can probe.
//
// Response shape (always 200 on a valid email):
//   { success: true, exists: boolean }
// Invalid email format → 400 INVALID_EMAIL (caller's bug, not a yes/no).

router.get("/check-email", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = String(req.query.email || "").trim().toLowerCase();
    // Minimal RFC-ish format check — full RFC parsing is overkill here.
    // We just need to refuse obvious garbage so a 200 result is meaningful.
    if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) || raw.length > 254) {
      return res.status(400).json({
        success: false,
        error: "INVALID_EMAIL",
        message: "Please provide a valid email.",
      });
    }
    const existing = await User.findOne({ email: raw }).select("_id").lean();
    return res.json({ success: true, exists: !!existing });
  } catch (err: any) {
    console.error("[downlines/check-email]", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL",
      message: "Failed to check email availability",
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
// POST /downlines/enroll
// ──────────────────────────────────────────────────────────────────────

router.post("/enroll", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const meId = authReq.user!.userId;

    const body = enrollSchema.parse(req.body);
    const email = body.email.trim().toLowerCase();

    // ── 1) Inviter must be a member of the chosen org ─────────────────
    const me = await User.findById(meId)
      .select("organizations email")
      .lean();
    if (!me) {
      return res
        .status(401)
        .json({ success: false, error: "UNAUTHORIZED", message: "User not found" });
    }
    const isMember = ((me as any).organizations || []).some(
      (m: any) => String(m.organization) === body.orgId
    );
    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: "NOT_A_MEMBER",
        message: "You can only enroll downlines into offices you belong to.",
      });
    }

    // ── 2) Org must exist ─────────────────────────────────────────────
    const org = await Organization.findById(body.orgId).select("name").lean();
    if (!org) {
      return res.status(404).json({
        success: false,
        error: "ORG_NOT_FOUND",
        message: "Office not found",
      });
    }

    // ── 3) Email must not already exist ───────────────────────────────
    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "USER_EXISTS",
        message: "A Garage user with this email already exists.",
      });
    }

    // ── 4) Resolve default floor for the org (first by level) ─────────
    const defaultFloor = await Floor.find({ orgId: new Types.ObjectId(body.orgId) })
      .sort({ level: 1 })
      .limit(1)
      .select("_id")
      .lean();
    const defaultFloorId = (defaultFloor as any[])[0]?._id;

    // ── 5) Mint affiliate id (reuse signup helper) ────────────────────
    const affiliateId = await generateAffiliateId();

    // ── 6) Create the User row ────────────────────────────────────────
    // Name + phone are both required by the regular onboarding card, so
    // `profileComplete` only flips to true when both are pre-stashed.
    const profileComplete = !!(body.name && body.phone);

    const created = await User.create({
      email,
      name: body.name || undefined,
      // Normalized so a later phone login finds THIS row instead of
      // creating a duplicate account (see storablePhone).
      phone: storablePhone(body.phone),
      country: body.country || undefined,
      postalCode: body.postalCode || undefined,
      city: body.city || undefined,
      state: body.state || undefined,
      designation: body.designation || undefined,
      referredBy: new Types.ObjectId(meId),
      affiliateId,
      profileComplete,
      // Opens the 24-hour free-first-month window (services/comboWindow.ts).
      // A pre-enrolled downline's clock therefore starts at enrolment rather
      // than at first login — accepted, since the app prompts for any missing
      // profile fields and completion is a real moment either way.
      ...(profileComplete ? { profileCompletedAt: new Date() } : {}),
      // Mark as guest at both the root level AND on the office membership,
      // matching the existing guest convention. The host org can decide
      // when to promote them to a full member.
      guest: true,
      organizations: [
        {
          organization: new Types.ObjectId(body.orgId),
          role: "stakeholder",
          ...(defaultFloorId ? { floorId: defaultFloorId } : {}),
          joinedAt: new Date(),
          guest: true,
        },
      ],
    });

    console.info(
      `[downlines] enrolled ${email} under ${(me as any).email || meId} → org ${
        (org as any).name
      } (${body.orgId})`
    );

    // Maintain the downline-table denormalized fields (ancestors/depth/legNumber
    // + parent.directsCount + ancestors.downlineCount). Non-blocking: the
    // enrollment is already committed and the nightly backfill self-heals drift.
    void syncNewEnrollee(created._id.toString());

    // Add the new downline to the parent Garage HQ as a stakeholder.
    // Every other signup path (regular affiliate signup, channel/workshop
    // checkout, guest auth) calls addUserToGarageHQ; the enroll-downline
    // flow was the only one that didn't. Without this, the downline only
    // saw the chosen office in their workspace picker (e.g. "Gravitichain")
    // and not the Garage HQ entry.
    //
    // `guest: true` is critical here — an enrolled downline is a guest
    // across ALL their memberships (matches the guest flag already stamped
    // on the chosen-org membership above). Without this, the HQ membership
    // would be a full stakeholder, unlocking founder-only surfaces they
    // shouldn't see. Non-blocking + idempotent.
    try {
      await addUserToGarageHQ(created._id.toString(), { guest: true });
    } catch (hqErr) {
      console.error(
        `[downlines] addUserToGarageHQ failed for ${email} (non-blocking):`,
        hqErr
      );
    }

    // Auto-join the new downline to the org's default community — mirrors
    // what /invites/accept, guestAuth, and addUserToGarageHQ do. Non-blocking:
    // the enrollment is already committed, so a channel join hiccup must not
    // fail the response.
    try {
      await autoJoinMembersChannel(created._id.toString(), body.orgId);
      await autoJoinDefaultChannel(created._id.toString(), body.orgId);
    } catch (channelErr) {
      console.error(
        `[downlines] auto-join to default community failed for ${email} (non-blocking):`,
        channelErr
      );
    }

    // ── 7) Notify the downline. Fire-and-forget so a mailer hiccup
    //       never strands the enrollment (already committed above). The
    //       email's CTA points at the standard /login page — they enter
    //       their email, get an OTP, and land in the workspace via the
    //       existing auth flow. No magic-link, no temporary password.
    const inviterName =
      (me as any).name || (me as any).email || "Someone on Garage";
    const orgName = (org as any).name || "Garage";
    const loginUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/login?email=${encodeURIComponent(email)}`;
    const subject = `${inviterName} added you to ${orgName} on Garage`;
    const html = enrollNotificationHtml({
      inviterName,
      orgName,
      recipientName: body.name || undefined,
      email,
      loginUrl,
    });
    const text = enrollNotificationText({
      inviterName,
      orgName,
      recipientName: body.name || undefined,
      email,
      loginUrl,
    });
    sendMail(email, subject, html, text, await senderForOrg(body.orgId)).catch(
      (mailErr) => {
        console.error(
          `[downlines] notification email failed for ${email} (non-blocking):`,
          mailErr
        );
      }
    );

    return res.json({
      success: true,
      user: {
        _id: String(created._id),
        email: created.email,
        name: (created as any).name || null,
      },
      orgName,
    });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: "INVALID_BODY",
        message: "Invalid request payload",
        details: err.issues,
      });
    }
    console.error("[downlines] /enroll error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: err?.message || "Failed to enroll downline",
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
// POST /downlines/:userId/extend-offer
// ──────────────────────────────────────────────────────────────────────
// Upline-scoped mirror of the garage-admin extend-offer endpoint — lets any
// authenticated user extend a DOWNLINE member's 24h offer window. See
// controllers/downlineOffer.controller.ts for the full write semantics and
// the upline-ownership guard. No other route on this router uses a `/:`
// param, so this can't be shadowed by (or shadow) anything above it.

router.post("/:userId/extend-offer", requireAuth, extendDownlineOffer);

// ──────────────────────────────────────────────────────────────────────
// Email templates
// ──────────────────────────────────────────────────────────────────────

interface EnrollNotificationArgs {
  inviterName: string;
  orgName: string;
  recipientName?: string;
  email: string;
  loginUrl: string;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function enrollNotificationHtml(args: EnrollNotificationArgs): string {
  const greeting = args.recipientName
    ? `Hi ${escapeHtml(args.recipientName)},`
    : `Hi there,`;
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#0e0e12;color:#e7e7ea;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#111116;border:1px solid #2a2a35;border-radius:14px;padding:24px;">
    <div style="font-size:13px;color:#FBD10D;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">You're on Garage</div>
    <h1 style="margin:0 0 14px;font-size:22px;color:#fff;font-weight:800;">
      ${escapeHtml(args.inviterName)} added you to ${escapeHtml(args.orgName)}
    </h1>
    <p style="margin:0 0 18px;font-size:14px;color:#c7c7da;line-height:1.55;">
      ${greeting} <strong style="color:#fff;">${escapeHtml(args.inviterName)}</strong>
      enrolled you on Garage and added you to
      <strong style="color:#fff;">${escapeHtml(args.orgName)}</strong>. Sign in
      with your email
      (<span style="color:#fff;">${escapeHtml(args.email)}</span>) — we'll
      send you a one-time code to verify it's you. No password required.
    </p>
    <div style="margin:22px 0;text-align:center;">
      <a href="${args.loginUrl}" style="display:inline-block;background:#FBD10D;color:#000;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">
        Sign in to Garage →
      </a>
    </div>
    <p style="margin:0 0 6px;font-size:12px;color:#9fa0b8;">If the button doesn't work, copy and paste this link:</p>
    <p style="margin:0 0 18px;font-size:12px;color:#5a5a72;word-break:break-all;">${args.loginUrl}</p>
    <hr style="border:0;border-top:1px solid #2a2a35;margin:18px 0;" />
    <p style="margin:0;font-size:11px;color:#5a5a72;text-align:center;">
      If you didn't expect this email, you can safely ignore it.
    </p>
  </div>
</div>`;
}

function enrollNotificationText(args: EnrollNotificationArgs): string {
  const greeting = args.recipientName
    ? `Hi ${args.recipientName},`
    : `Hi there,`;
  return [
    greeting,
    "",
    `${args.inviterName} enrolled you on Garage and added you to ${args.orgName}.`,
    "",
    `Sign in with your email (${args.email}) — we'll send a one-time code to verify.`,
    args.loginUrl,
    "",
    "If you didn't expect this email, ignore it.",
  ].join("\n");
}

export default router;
