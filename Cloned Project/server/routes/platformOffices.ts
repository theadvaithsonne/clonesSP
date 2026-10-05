// src/routes/platformOffices.ts
//
// The 30-day office grace programme, for integrating platforms.
//
// Normally an office needs an active $25 Unilevel Plus licence
// (services/officeEligibility.ts). These endpoints let a platform create a
// STARTER office for a founder who has none, and give them 30 days to buy it,
// with a countdown and the live combo pricing to buy from.
//
// AUTH: every route takes BOTH
//   Authorization: Bearer <user JWT>   — who the office is for
//   X-Garage-Platform: <key>           — which platform is vouching
// The platform key must hold the `offices:grace` scope. The main web and
// mobile apps never send one, so their licence gate is untouched; nothing
// about GARAGE HQ or any office created elsewhere changes.
//
// ENFORCEMENT IS ADVISORY. `status: "locked"` is reported here and is expected
// to be honoured by the integrating platform's UI. The Garage API itself does
// not refuse a locked office — see the note in services/officeGrace.ts.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { requirePlatformKey, PlatformRequest } from "../middleware/platformKey";
import { createFirstTimeOfficeHandler } from "./org";
import {
  checkGraceEligibility,
  graceStatusFor,
  newGraceWindow,
  OFFICE_GRACE_DAYS,
} from "../services/officeGrace";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";
import { MagicLink, generateMagicLinkToken } from "../models/magicLink.model";
import { comboWindowFor } from "../services/comboWindow";
import { quoteAllPlans } from "../services/comboCheckout";
import { getUserPurchase } from "../services/unilevelPlusCommission";
import { env } from "../config/env";

const router = Router();

// Order matters: identify the user first, then the platform. A bad JWT should
// read as 401 unauthenticated rather than leaking whether a key is valid.
router.use(requireAuth, requirePlatformKey);

const userIdOf = (req: Request) => (req as any).user.userId as string;

/** The one subscription-enabled partner whose plans the combo sells. */
async function comboClient() {
  return ThirdPartyClient.findOne({
    isActive: true,
    "productConfig.recurringPeriod": { $exists: true },
    "productConfig.productCode": { $exists: true },
  });
}

/**
 * The user's catalog magic link, minted on demand.
 *
 * Same row `sendSignupOffer` uses (one per user per partner, no termMonths =
 * catalog), so a user who was emailed one at sign-up gets that same link back
 * rather than a second one. Nothing is emailed from here — the platform owns
 * its own messaging.
 */
async function catalogMagicLink(userId: string, clientId: Types.ObjectId) {
  const existing = await MagicLink.findOne({
    userId: new Types.ObjectId(userId),
    thirdPartyClientId: clientId,
    termMonths: { $exists: false },
  });
  const link =
    existing ||
    (await MagicLink.create({
      token: generateMagicLinkToken(),
      userId: new Types.ObjectId(userId),
      thirdPartyClientId: clientId,
      createdByUserId: new Types.ObjectId(userId),
    }));
  const base = (env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  return { token: link.token, url: `${base}/magic-link/${link.token}` };
}

/**
 * GET /platform/offices/eligibility
 *
 * Ask before showing a "create office" button:
 *   licence         — they hold one; create normally, no grace consumed
 *   grace_available — allowed, and creating starts the 30-day clock
 *   grace_active    — they already have a running grace office
 *   grace_used      — their grace lapsed; they must buy to create anything
 */
router.get("/offices/eligibility", async (req: Request, res: Response) => {
  try {
    const e = await checkGraceEligibility(userIdOf(req));
    return res.json({ success: true, ...e });
  } catch (err: any) {
    console.error("[platformOffices] eligibility failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

/**
 * POST /platform/offices
 *
 * Create the office. Body is the same shape as POST /org/create-first-time —
 * this mounts that exact handler, so floors, membership, the welcome bonus,
 * the default conference room and the welcome emails all happen identically.
 *
 * The only difference: when the founder has no licence we pre-authorise the
 * gate here and stamp a 30-day window on the new org.
 */
router.post(
  "/offices",
  async (req: Request, res: Response, next) => {
    try {
      const userId = userIdOf(req);
      const e = await checkGraceEligibility(userId);

      // Holds a licence: nothing to bypass. Fall through with no grace flag so
      // the normal gate passes them and no clock is stamped.
      if (e.reason === "licence") return next();

      if (!e.canCreate) {
        return res.status(409).json({
          success: false,
          error: e.reason, // grace_active | grace_used
          message:
            e.reason === "grace_active"
              ? "This user already has an office on the grace programme."
              : "This user's grace period has ended. A Unilevel Plus licence is required to create another office.",
          existing: e.existing,
        });
      }

      const platform = (req as PlatformRequest).platformClient;
      const win = newGraceWindow();
      (req as any).graceProgram = {
        platformId: platform._id,
        platformName: platform.name,
        startedAt: win.startedAt,
        expiresAt: win.expiresAt,
        createdByUserId: new Types.ObjectId(userId),
      };
      return next();
    } catch (err: any) {
      console.error("[platformOffices] create pre-check failed:", err);
      return res.status(500).json({ success: false, error: "internal", message: err?.message });
    }
  },
  createFirstTimeOfficeHandler
);

/**
 * GET /platform/offices/:orgId/status
 *
 * The countdown, and whether the office should be treated as locked. Derived
 * live, so buying the licence flips it on the very next call with no webhook,
 * cron or write involved.
 */
router.get("/offices/:orgId/status", async (req: Request, res: Response) => {
  try {
    const userId = userIdOf(req);
    if (!Types.ObjectId.isValid(req.params.orgId)) {
      return res.status(400).json({ success: false, error: "invalid_org_id" });
    }
    const org: any = await Organization.findById(req.params.orgId)
      .select("_id name graceProgram")
      .lean();
    if (!org) {
      return res.status(404).json({ success: false, error: "office_not_found" });
    }

    // Only the founder the grace belongs to, or a member, may read it.
    const user = await User.findById(userId).select("organizations").lean();
    const isMember = (user?.organizations || []).some(
      (m: any) => String(m.organization) === String(org._id)
    );
    if (!isMember) {
      return res.status(403).json({ success: false, error: "not_your_office" });
    }

    // The licence that matters is the grace FOUNDER's, not the caller's — a
    // stakeholder reading the status must see the office's real state.
    const founderId = org.graceProgram?.createdByUserId
      ? String(org.graceProgram.createdByUserId)
      : userId;
    const licence = await getUserPurchase(founderId);
    const state = graceStatusFor(org.graceProgram, !!licence);

    return res.json({
      success: true,
      office: { id: String(org._id), name: org.name },
      ...state,
      onGraceProgramme: !!org.graceProgram?.expiresAt,
      platform: org.graceProgram?.platformName ?? null,
    });
  } catch (err: any) {
    console.error("[platformOffices] status failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

/** GET /platform/offices — this user's grace offices and their status. */
router.get("/offices", async (req: Request, res: Response) => {
  try {
    const userId = userIdOf(req);
    const [orgs, licence] = await Promise.all([
      Organization.find({
        "graceProgram.createdByUserId": new Types.ObjectId(userId),
      })
        .select("_id name graceProgram")
        .lean(),
      getUserPurchase(userId),
    ]);
    return res.json({
      success: true,
      licenceActive: !!licence,
      offices: orgs.map((o: any) => ({
        id: String(o._id),
        name: o.name,
        platform: o.graceProgram?.platformName ?? null,
        ...graceStatusFor(o.graceProgram, !!licence),
      })),
    });
  } catch (err: any) {
    console.error("[platformOffices] list failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

/**
 * GET /platform/offer
 *
 * What the founder can buy, priced for THIS user right now, plus their magic
 * link. Inside the 24-hour sign-up window the monthly option is the $25
 * licence with the first NetworkChain month free; after it, the same call
 * returns the $25 + $36 combo with `freeMonth: false`. That rule lives in
 * comboWindow/comboCheckout and is not re-implemented here, so this can never
 * quote a different price from the wallet page or the magic-link page.
 */
router.get("/offer", async (req: Request, res: Response) => {
  try {
    const userId = userIdOf(req);
    const user = await User.findById(userId)
      .select("email name profileCompletedAt offerExpiresAtOverride")
      .lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "user_not_found" });
    }

    const licence = await getUserPurchase(userId);
    const window = comboWindowFor(user as any);
    const client = await comboClient();
    if (!client) {
      return res.json({
        success: true,
        licenceActive: !!licence,
        window,
        magicLink: null,
        plans: [],
        headline: null,
        reason: "no_active_partner",
      });
    }

    const [plans, magicLink] = await Promise.all([
      quoteAllPlans({ userId, client }),
      catalogMagicLink(userId, client._id as Types.ObjectId),
    ]);
    // Cheapest entry point is the headline — "from $25", not an arbitrary term.
    const headline = plans.length
      ? plans.reduce((a, b) => (b.cartUsd < a.cartUsd ? b : a))
      : null;

    return res.json({
      success: true,
      licenceActive: !!licence,
      window,
      magicLink,
      headline,
      plans,
      graceDays: OFFICE_GRACE_DAYS,
    });
  } catch (err: any) {
    console.error("[platformOffices] offer failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

/**
 * POST /platform/offer/checkout  { termMonths }
 *
 * Mint the combo invoice and hand back a payment URL. Same service the wallet
 * page and the magic-link page use, so the licence, the free month and the
 * commission distribution all behave identically to any other purchase.
 */
router.post("/offer/checkout", async (req: Request, res: Response) => {
  try {
    const userId = userIdOf(req);
    const body = z
      .object({ termMonths: z.number().int().min(1).max(60).default(1) })
      .parse(req.body ?? {});

    const licence = await getUserPurchase(userId);
    if (licence) {
      return res.status(409).json({
        success: false,
        error: "already_licensed",
        message: "This user already holds an active Unilevel Plus licence.",
      });
    }

    const client = await comboClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        error: "no_active_partner",
        message: "No subscription-enabled partner is configured.",
      });
    }

    const { createComboCheckoutInvoice } = await import("../services/comboCheckout");
    const result = await createComboCheckoutInvoice({
      userId,
      client,
      termMonths: body.termMonths,
    });

    // `free_claim` is the shape where nothing is owed — it is activated
    // directly rather than invoiced. Unreachable here (it requires an existing
    // licence, and we refused those above), but returning a $0 invoice URL if
    // the rule ever changes would strand the buyer on a page with no button.
    if (result.quote.kind === "free_claim") {
      return res.status(409).json({
        success: false,
        error: "nothing_to_pay",
        message:
          "This user's purchase costs nothing — claim the free month through the standard flow rather than an invoice.",
      });
    }

    const invoice: any = result.invoice;
    const base = (env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
    return res.status(201).json({
      success: true,
      reused: result.reused,
      quote: {
        termMonths: result.quote.termMonths,
        licenceUsd: result.quote.licenceUsd,
        subUsd: result.quote.subUsd,
        cartUsd: result.quote.cartUsd,
        freeMonth: result.quote.freeMonth,
        monthsOfAccess: result.quote.monthsOfAccess,
      },
      invoice: {
        id: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency || "USD",
        paymentUrl: `${base}/invoice/${String(invoice._id)}`,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "invalid_input", details: err.issues });
    }
    console.error("[platformOffices] checkout failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

export default router;
