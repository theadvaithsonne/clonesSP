// src/routes/invoice.ts
// Invoice API routes — public + authenticated endpoints
import { Router, Request, Response } from "express";
import { z } from "zod";
import { SUPPORTED_FIAT_CURRENCIES } from "../utils/exchangeRate";
import { Types } from "mongoose";
import {
  getInvoice,
  selectPaymentMethod,
  verifyAndCompletePayment,
  cancelInvoice,
  CryptoPaymentInFlightError,
  cancelSubscription,
  renewSubscription,
  getPaymentOptions,
  listUserInvoices,
  getUpcomingInvoices,
  fulfillInvoice,
  generateDueRecurringInvoices,
  autoChargeRecurringInvoices,
  expireStaleInvoices,
  createInvoice,
} from "../services/invoice";
import { refuseIfNotPayable } from "../services/invoicePayable";
import { markUsageApplied, markUsageFailed } from "../services/coupon";
import { expireFranchiseSubscriptions } from "../services/franchiseSubscriptions";
import { expireStalePendingOffers } from "../services/franchiseOffer";
import { expireStaleGlobalPendingOffers } from "../services/franchiseGlobalOffer";
import { requireAuth, softAuth } from "../middleware/auth";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { Product } from "../models/product.model";
import { getReferrerInfo } from "../services/affiliate";
import {
  getSellable,
  listOrgSellables,
  toInvoiceItemType,
  type SellableItemType,
} from "../services/sellables";
import { createOtp, verifyOtp } from "../services/otp";
import { sendMail, EMAIL_FROM_OTP, senderForHost} from "../services/mailer";
import {
  createBoardFromPurchase,
  addAtBatFromPurchase,
  addFromUpperBaseInvite,
  addToDugoutFromPurchase,
  addFromGenericInvite,
} from "../bat246/services/bat246Entry.service";
import { Bat246PendingPlacement } from "../bat246/models/bat246PendingPlacement.model";
import { Bat246PlacementNotification } from "../bat246/models/bat246PlacementNotifications.model";
import { Bat246PositionReservation } from "../bat246/models/bat246PositionReservations.model";

async function createPendingPlacement(userId: string, userName: string, userEmail: string, boardId: string, position: string, bat246Ref: string) {
  const { Bat246Distributor } = await import("../bat246/models/bat246Distributor.model");
  const { Bat246Player } = await import("../bat246/models/bat246Player.model");
  const { createBat246Player } = await import("../bat246/services/bat246PlayerId.util");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Ensure player record exists
  let player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) });
  if (!player) {
    player = await createBat246Player({ userId: new Types.ObjectId(userId), nickname: userName || userEmail, email: userEmail, memberSince: new Date() });
  }

  // Mark product purchased on distributor + store the inviting upline ref
  await Bat246Distributor.updateOne(
    { userId: new Types.ObjectId(userId) },
    { $set: { playerId: player._id, hasPurchasedProduct: true, isOfficeMember: true, bat246RefUserId: new Types.ObjectId(bat246Ref) }, $setOnInsert: { isGarageAffiliate: false, hasBat246Membership: false, isQualified: false } },
    { upsert: true }
  );

  // Recompute isQualified now that hasPurchasedProduct + isOfficeMember are
  // set. isGarageAffiliate ($25 Garage Affiliate) dropped from the check
  // on request.
  const freshDist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(userId) })
    .select("isOfficeMember hasBat246Membership hasPurchasedProduct isGarageAffiliate isQualified").lean() as any;
  if (freshDist && !freshDist.isQualified && freshDist.isOfficeMember && freshDist.hasBat246Membership && freshDist.hasPurchasedProduct) {
    await Bat246Distributor.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { isQualified: true, qualifiedAt: new Date() } });
    const { assignDistributorId } = await import("../bat246/services/bat246DistributorId.util");
    await assignDistributorId(userId).catch((err: any) => console.error("[bat246] assignDistributorId failed:", err.message));
  }

  // Create pending placement (idempotent)
  await Bat246PendingPlacement.updateOne(
    { userId: new Types.ObjectId(userId), boardId: new Types.ObjectId(boardId), position, isPlaced: false },
    { $setOnInsert: { userId: new Types.ObjectId(userId), userName, userEmail, boardId: new Types.ObjectId(boardId), position, refUserId: new Types.ObjectId(bat246Ref), purchasedAt: new Date(), expiresAt } },
    { upsert: true }
  );
  // Position reservation — required by placeUserFromReservation during admin approval
  await Bat246PositionReservation.updateOne(
    { reservedByUserId: new Types.ObjectId(userId), status: "active" },
    { $setOnInsert: { reservedByUserId: new Types.ObjectId(userId), reservedByEmail: userEmail, boardId: new Types.ObjectId(boardId), position, status: "active", reservedAt: new Date(), expiresAt } },
    { upsert: true }
  );
  // Placement notification for upline/admin (idempotent)
  const existingNotif = await Bat246PlacementNotification.exists({ qualifiedUserId: new Types.ObjectId(userId), isActioned: false });
  if (!existingNotif) {
    await Bat246PlacementNotification.create({ notificationType: "placement", boardId: new Types.ObjectId(boardId), position, qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: userEmail, qualifiedUserName: userName, uplineUserId: new Types.ObjectId(bat246Ref) });
  }
  // Retroactive membership notification — if user already had $20 membership before buying entry
  if (freshDist?.hasBat246Membership) {
    await Bat246PlacementNotification.create({ notificationType: "membership", qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: userEmail, qualifiedUserName: userName, uplineUserId: new Types.ObjectId(bat246Ref) }).catch(() => {});
  }
}
import { signJwt, verifyJwt } from "../services/jwt";
import { env } from "../config/env";

// Mask email for UI display: abhay@gmail.com → a***@gmail.com
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const maskedLocal = local.length <= 2
    ? local[0] + "*"
    : local[0] + "*".repeat(Math.min(local.length - 1, 3));
  return `${maskedLocal}@${domain}`;
}

// Resolve the "From" organization for an invoice based on item type
async function resolveFromOrganization(invoice: any): Promise<any> {
  const primaryItemType = invoice.lineItems?.[0]?.itemType;
  const selectFields = "name icon coverPhoto billingDetails city state country postalCode location slug";

  if (
    primaryItemType === "office_plan" ||
    primaryItemType === "unilevel_plus" ||
    primaryItemType === "third_party_subscription"
  ) {
    return Organization.findOne({ parent: true }).select(selectFields).lean();
  }
  return Organization.findById(invoice.organizationId).select(selectFields).lean();
}

// Validate invoice ID — accepts either MongoDB ObjectId or invoice number (INV-XXXX-XXXX)
function isValidInvoiceIdentifier(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  if (Types.ObjectId.isValid(id)) return true;
  // Invoice number format: INV-{base36 timestamp}-{4 random}
  return /^INV-[A-Z0-9]+-[A-Z0-9]+$/i.test(id);
}

const router = Router();

// ============ Public Endpoints ============

/**
 * GET /api/invoices/payment-options
 * Get available payment methods based on country and item currency
 */
router.get("/payment-options", async (req: Request, res: Response) => {
  try {
    const { country, invoiceId } = req.query;

    // India detection MUST match the GST rule (regulatory / tax
    // consistency). When the caller passes an invoiceId — which the
    // invoice pay page always does — resolve the buyer's region via
    // `resolveBuyerGstRegion` (same 5-tier precedence: shipping →
    // billing → profile country → profile pincode/state → INR-currency
    // fallback). The FE-passed `?country=` is used only as a legacy
    // fallback for callers that don't know an invoice yet — it's a
    // client hint, so never trust it for anything security-relevant.
    //
    // Resolve by EITHER identifier form. This used to gate on
    // `Types.ObjectId.isValid`, but the standalone invoice page is routed by
    // invoice NUMBER (`/invoice/INV-…`, built in OrdersPage from
    // `inv.invoiceNumber || inv._id`) and threads that same string down as
    // `?invoiceId=`. A number therefore failed the ObjectId check, fell through
    // to the `?country=` hint — which no caller actually sends — and left
    // `isIndia = false`. The response was still a valid 200, just silently
    // missing UPI, so every Indian buyer on that page saw card-only checkout.
    // `getInvoice` accepts both forms and is what every other invoice route
    // uses; the guard mirrors it.
    let isIndia = false;
    if (invoiceId && isValidInvoiceIdentifier(String(invoiceId))) {
      const inv: any = await getInvoice(String(invoiceId));
      if (inv) {
        const { resolveBuyerGstRegion } = await import("../utils/gstBuyerRegion");
        const region = await resolveBuyerGstRegion({
          buyerUserId: String(inv.userId),
          shippingAddress: inv.shippingAddress,
          billingAddress: inv.billingAddress,
          paymentCurrency: inv.itemCurrency,
        });
        isIndia = region.inIndia;
      }
    } else if (country) {
      const c = String(country).toUpperCase();
      isIndia = c === "IN" || c === "INDIA";
    }

    const options = getPaymentOptions({ isIndia });

    res.json({ success: true, ...options });
  } catch (error: any) {
    console.error("[Invoice] Error fetching payment options:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/invoices/my/pending-count
 * Get count of pending/draft invoices for the authenticated user.
 * Lightweight endpoint for sidebar badge polling.
 */
router.get("/my/pending-count", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string };
    const { Invoice } = require("../models/invoice.model");

    // Scope to the user's CURRENT org so the badge matches the visible
    // Pending section (which uses /my/upcoming → getUpcomingInvoices, also
    // org-scoped). Without this filter the badge counted draft invoices
    // across every org the user has signed up to — including auto-generated
    // subscription drafts for offices the user isn't actively viewing —
    // which surfaced as "7 pending" when the Orders page only showed 1.
    const query: any = {
      userId: user.userId,
      status: { $in: ["draft", "pending"] },
    };
    if (user.orgId) {
      query.organizationId = user.orgId;
    }

    const count = await Invoice.countDocuments(query);

    res.json({ success: true, count });
  } catch (error: any) {
    console.error("[Invoice] Error fetching pending count:", error);
    res.status(500).json({ success: false, count: 0 });
  }
});

/**
 * POST /api/invoices/cron/generate-recurring
 * Generate draft invoices for recurring subscriptions due within 5 days.
 * Called by external cron service (daily).
 */
router.post("/cron/generate-recurring", async (req: Request, res: Response) => {
  try {
    const secret = req.headers["x-webhook-secret"] || req.headers["x-cron-secret"];
    if (secret !== process.env.CRON_WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const generated = await generateDueRecurringInvoices();
    // Attempt off-session charges on saved default cards for children that
    // have crossed their period-start date. Runs BEFORE expireStaleInvoices
    // so a successful auto-charge on the last day of grace still flips the
    // invoice to `paid` instead of being expired first.
    let autoCharge: any = null;
    try {
      autoCharge = await autoChargeRecurringInvoices();
    } catch (autoErr) {
      console.error("[Cron] auto-charge pass failed:", autoErr);
    }
    const expired = await expireStaleInvoices();
    const franchise = await expireFranchiseSubscriptions();
    const franchiseOffers = await expireStalePendingOffers();
    const franchiseGlobalOffers = await expireStaleGlobalPendingOffers();

    // Replay any third-party commission that failed partway through. Multi-month
    // terms run N distributions per invoice, so a partial failure is far more
    // likely than it used to be; both the UP distributions and the platform
    // credit are idempotent, so this only fills in what's missing.
    let thirdPartyCommissions: any = null;
    try {
      const { reconcileThirdPartyCommissions } = await import(
        "../services/commission"
      );
      thirdPartyCommissions = await reconcileThirdPartyCommissions();
    } catch (reconcileErr) {
      console.error(
        "[Cron] third-party commission reconciliation failed:",
        reconcileErr
      );
    }

    // Piggyback on the same daily wake-up for two office-plan jobs:
    //  1. Scheduled Pro→Starter downgrades whose effective date has hit.
    //  2. Grace-lapsed Pro subs (unpaid initial or renewal) that ran out
    //     the OFFICE_GRACE_PERIOD_DAYS window without payment — those
    //     auto-downgrade to Starter so their office stays live at $0.
    let officeDowngrades = 0;
    let officeGraceLapsed = 0;
    try {
      const {
        processScheduledOfficeDowngrades,
        processExpiredOfficeGrace,
      } = await import("../services/officeSubscription");
      officeDowngrades = await processScheduledOfficeDowngrades();
      officeGraceLapsed = await processExpiredOfficeGrace();
    } catch (downErr) {
      console.error(
        "[Cron] office subscription downgrade/grace processing failed:",
        downErr
      );
    }

    res.json({
      success: true,
      generated,
      autoCharge,
      expired,
      franchise,
      franchiseOffers,
      franchiseGlobalOffers,
      thirdPartyCommissions,
      officeDowngrades,
      officeGraceLapsed,
    });
  } catch (error: any) {
    console.error("[Invoice] Cron error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/invoices/sellables
 * List all sellable items (product/channel/course/service/workshop) for the
 * authenticated user's org. Used by the in-webinar "pin a product" picker.
 *
 * NOTE: Must be declared BEFORE the `/:invoiceId` dynamic route below,
 * otherwise Express routes it there and it fails with "Invalid invoice ID".
 */
router.get("/sellables", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string };

    // Explicit ?orgId=X keeps the original single-org behavior for
    // callers that really want a specific org. Without it, we fan out
    // across every org the user is a member of — the JWT only carries
    // one orgId (whichever they were on at sign-in), so a host pinning
    // products in a webinar would otherwise miss every store they own
    // under a different membership. This matches the Seller Dashboard,
    // which lets users switch between their orgs.
    const explicitOrgId = req.query.orgId as string | undefined;
    if (explicitOrgId) {
      if (!Types.ObjectId.isValid(explicitOrgId)) {
        return res.status(400).json({ success: false, error: "Invalid orgId" });
      }
      const sellables = await listOrgSellables(explicitOrgId);
      return res.json({ success: true, sellables });
    }

    const { User } = await import("../models/user.model");
    const me = await User.findById(user.userId)
      .select("organizations")
      .lean();
    const memberOrgIds = new Set<string>();
    if (user.orgId) memberOrgIds.add(String(user.orgId));
    for (const m of ((me as any)?.organizations as any[]) || []) {
      const oid = m?.organization;
      if (oid) memberOrgIds.add(String(oid));
    }
    const orgIdsArr = Array.from(memberOrgIds).filter((id) =>
      Types.ObjectId.isValid(id),
    );
    if (orgIdsArr.length === 0) {
      return res.json({ success: true, sellables: [] });
    }

    // Fan out per org, then dedupe by (itemType, itemId) so a product
    // referenced in multiple orgs (rare) only shows once.
    const buckets = await Promise.all(
      orgIdsArr.map((oid) =>
        listOrgSellables(oid).catch((err) => {
          console.warn(`[Invoice] sellables for org ${oid} failed:`, err);
          return [] as Awaited<ReturnType<typeof listOrgSellables>>;
        }),
      ),
    );
    const merged: Awaited<ReturnType<typeof listOrgSellables>> = [];
    const seen = new Set<string>();
    for (const bucket of buckets) {
      for (const s of bucket) {
        const k = `${s.itemType}:${s.itemId}`;
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(s);
      }
    }
    res.json({ success: true, sellables: merged });
  } catch (error: any) {
    console.error("[Invoice] Error listing sellables:", error);
    res
      .status(500)
      .json({ success: false, error: error.message || "Failed to list sellables" });
  }
});

/**
 * GET /api/invoices/:invoiceId
 * Fetch invoice details (for showing invoice preview before payment)
 */
router.get("/:invoiceId", async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    // Resolve "From" organization based on item type
    const fromOrganization = await resolveFromOrganization(invoice);

    // Founder-configured post-payment page — DIGITAL product line items ONLY.
    // Physical goods have their own shipping/receipt story; the thank-you
    // page (with "start your course" style CTAs, auto-redirect to onboarding,
    // etc.) is a digital-delivery concept. Gate on the product's
    // `isDigital` flag OR `deliveryMethod: "digital"|"both"` so a mixed
    // catalog doesn't accidentally flash a redirect for a physical order.
    // Fetched lazily so non-product invoices (channels/courses/workshops/
    // office/etc.) pay zero cost. Returned at the response root so the FE
    // can render it on the invoice `success` step without a second request.
    // Item-agnostic post-purchase page. Currently sourced from either
    // Product.thankYouPage (gated on digital delivery so a physical order
    // can't accidentally flash a redirect) OR Course.thankYouPage (all
    // courses are digital by definition — no gate needed). Same shape
    // for both; the FE renderer is item-agnostic.
    // Fetched lazily so non-thank-you invoices (channels/workshops/office/
    // etc.) pay zero cost. Returned at the response root under both a
    // generic `thankYouPage` key AND the legacy `productThankYouPage`
    // alias so cached FE bundles that haven't refreshed still work.
    let thankYouPage: any = null;
    try {
      const primary = invoice.lineItems?.[0];
      if (primary?.itemType === "product" && primary?.itemId) {
        const { Product } = await import("../models/product.model");
        const p = await Product.findById(primary.itemId)
          .select("thankYouPage isDigital deliveryMethod")
          .lean<{
            thankYouPage?: any;
            isDigital?: boolean;
            deliveryMethod?: string;
          }>();
        const isDigitalProduct =
          !!p?.isDigital ||
          p?.deliveryMethod === "digital" ||
          p?.deliveryMethod === "both";
        if (p?.thankYouPage && isDigitalProduct) {
          thankYouPage = p.thankYouPage;
        }
      } else if (primary?.itemType === "course" && primary?.itemId) {
        const { Course } = await import("../models/course.model");
        const c = await Course.findById(primary.itemId)
          .select("thankYouPage")
          .lean<{ thankYouPage?: any }>();
        if (c?.thankYouPage) {
          thankYouPage = c.thankYouPage;
        }
      } else if (primary?.itemType === "channel" && primary?.itemId) {
        // Community subscription (paid or free). No digital gate — every
        // community membership is digital. Fires on the invoice success
        // step for both the first join AND every recurring renewal
        // invoice if founder configured a page (matches how emailAlerts
        // fires on every cycle).
        const { Channel } = await import("../models/channel.model");
        const ch = await Channel.findById(primary.itemId)
          .select("thankYouPage")
          .lean<{ thankYouPage?: any }>();
        if (ch?.thankYouPage) {
          thankYouPage = ch.thankYouPage;
        }
      }
    } catch (e) {
      console.warn(
        `[Invoice] Failed to load thankYouPage for ${invoice.invoiceNumber}:`,
        e,
      );
    }

    // UPI autopay disclosure. Null unless paying THIS invoice by UPI would
    // establish a mandate — the FE renders it verbatim rather than computing
    // prices of its own, so the amount disclosed and the amount debited can't
    // diverge. Never fatal: a failure here just drops the enriched copy.
    let upiAutopayNotice: any = null;
    try {
      const { getUpiAutopayNotice } = await import("../services/upiAutopay");
      upiAutopayNotice = await getUpiAutopayNotice(invoice);
    } catch (e: any) {
      console.warn(
        `[Invoice] autopay notice failed for ${invoice.invoiceNumber}:`,
        e?.message ?? e,
      );
    }

    res.json({
      success: true,
      upiAutopayNotice,
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        status: invoice.status,
        organizationId: invoice.organizationId,
        sellerId: invoice.sellerId,
        userId: invoice.userId,
        lineItems: invoice.lineItems,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        shippingCost: invoice.shippingCost,
        totalAmount: invoice.totalAmount,
        itemCurrency: invoice.itemCurrency,
        paymentCurrency: invoice.paymentCurrency,
        currencyConversion: invoice.currencyConversion,
        paymentMethodCategory: invoice.paymentMethodCategory ?? null,
        paymentPlatform: invoice.paymentPlatform ?? null,
        metadata: invoice.metadata ?? null,
        isRecurring: invoice.isRecurring,
        recurringPeriod: invoice.recurringPeriod,
        recurringPaymentNumber: invoice.recurringPaymentNumber,
        couponCode: invoice.couponCode,
        shippingAddress: invoice.shippingAddress ?? null,
        billingAddress: invoice.billingAddress ?? null,
        paymentMode: invoice.paymentMode ?? null,
        gstin: invoice.gstin ?? null,
        companyName: invoice.companyName ?? null,
        customerNote: invoice.customerNote ?? null,
        customerEmail: invoice.customerEmail,
        customerName: invoice.customerName,
        paidAt: invoice.paidAt,
        nextDueDate: invoice.nextDueDate,
        invoiceShortUrl: invoice.invoiceShortUrl,
        createdAt: invoice.createdAt,
        expiresAt: invoice.expiresAt,
      },
      fromOrganization,
      // Generic field — new FE code reads this.
      thankYouPage,
      // Legacy alias — kept for one release so cached FE bundles that
      // still read `productThankYouPage` don't break for product invoices.
      // Drop after the next FE deploy.
      productThankYouPage: thankYouPage,
    });
  } catch (error: any) {
    console.error("[Invoice] Error fetching invoice:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invoices/:invoiceId/customer   (PUBLIC)
 * Attach the paying customer's email/name to a not-yet-paid invoice so the
 * receipt is theirs. Used by GaragePay's scan-to-pay: a seller creates a
 * counter invoice (whose customerEmail defaults to the seller), then the
 * scanning buyer claims it as theirs before paying. No-op once paid.
 *
 * Also re-points `invoice.userId` at the buyer (looked up by email, or by
 * the optional `userId` in the body when the FE already knows it). This is
 * NOT cosmetic — every downstream distributor (`distributeCommissions`,
 * comb-plan chain, territory attribution, receipts, "My purchases" queries)
 * keys off `invoice.userId`. Without the re-point, all commission money on
 * a scan-to-pay counter invoice climbs the SELLER's referral chain instead
 * of the buyer's, and territory attribution uses the seller's postalCode.
 *
 * When the email doesn't match a User (walk-in / non-Garage buyer) we leave
 * `userId` untouched and return `userMapped: false` so the caller knows the
 * downstream distribution will still misfire for that payer — surface a
 * "sign in to attach purchase" prompt in that case.
 */
router.post("/:invoiceId/customer", async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const schema = z.object({
      customerEmail: z.string().email(),
      customerName: z.string().min(1).max(120).optional(),
      // Optional short-circuit: FE that already knows the paying user's id
      // can pass it explicitly and skip the email→User lookup.
      userId: z.string().optional(),
    });
    const { customerEmail, customerName, userId: bodyUserId } = schema.parse(req.body);

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }
    if (["paid", "completed", "fulfilled"].includes(String(invoice.status))) {
      return res.status(409).json({ success: false, error: "Invoice already paid" });
    }

    const normalizedEmail = customerEmail.trim().toLowerCase();

    // Resolve the buyer's User doc so downstream distributions walk their
    // chain (not the seller's). Prefer the explicit body.userId when the
    // FE already resolved it — fall back to email lookup otherwise.
    const { User } = await import("../models/user.model");
    let buyer: { _id: any } | null = null;
    if (bodyUserId && Types.ObjectId.isValid(bodyUserId)) {
      buyer = await User.findById(bodyUserId).select("_id").lean<{ _id: any }>();
    }
    if (!buyer) {
      buyer = await User.findOne({
        email: new RegExp(
          `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i",
        ),
      })
        .select("_id")
        .lean<{ _id: any }>();
    }

    const { Invoice } = await import("../models/invoice.model");
    const setFields: Record<string, any> = { customerEmail: normalizedEmail };
    if (customerName) setFields.customerName = customerName;
    if (buyer) setFields.userId = buyer._id;

    await Invoice.updateOne({ _id: invoice._id }, { $set: setFields });

    if (!buyer) {
      console.warn(
        `[Invoice] /customer: no User for ${normalizedEmail} on invoice ${invoice.invoiceNumber} — commission distribution will still key on seller.userId`,
      );
    }

    return res.json({
      success: true,
      userMapped: !!buyer,
      userId: buyer ? String(buyer._id) : null,
    });
  } catch (error: any) {
    if (error?.issues?.length) {
      return res
        .status(400)
        .json({ success: false, error: error.issues[0].message || "Invalid request" });
    }
    console.error("[Invoice] set-customer error:", error);
    return res.status(500).json({ success: false, error: "Failed to set customer" });
  }
});

/**
 * POST /api/invoices/:invoiceId/select-payment
 * User selects currency + payment method. Creates Razorpay order and returns gateway details.
 */
router.post("/:invoiceId/select-payment", async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    /**
     * Refuse a stale invoice BEFORE any payment intent exists.
     *
     * `expiresAt` was written on every invoice and never checked, so an
     * invoice minted in May was still payable in September at its May price —
     * a quote for an offer window that had closed months earlier. Enforced
     * here rather than at fulfilment because rejecting after the charge means
     * refunding someone for something we then refuse to deliver.
     */
    {
      const existing: any = await getInvoice(invoiceId);
      if (existing) {
        const refusal = await refuseIfNotPayable(existing);
        if (refusal) return res.status(409).json(refusal);
      }
    }

    const schema = z.object({
      // CAD/EUR/GBP are card-only (Stripe) payment currencies — the
      // service rejects any other method for them. Keep in lockstep with
      // Invoice.paymentCurrency and getPaymentOptions().
      paymentCurrency: z.enum(SUPPORTED_FIAT_CURRENCIES),
      paymentMethodCategory: z.enum(["card", "upi", "crypto"]),
      paymentPlatform: z.enum([
        "razorpay",
        "stripe",
        "openmoney",
        "square",
        "phonepe",
        "paytm",
        "crypto_wallet",
      ]),
      // Where to send the payer back after a crypto (legacy NowPayments)
      // payment. Validated against FRONTEND_URL in selectPaymentMethod.
      // Unused in the in-house crypto flow (FE renders the panel inline).
      returnUrl: z.string().url().optional(),
      // In-house crypto flow — required when paymentPlatform === "crypto_wallet".
      // FE picks these from the coin-picker step (USDT-Tron / USDC-Polygon).
      // Full set of supported (chain, coin) combinations lives in
      // `src/config/cryptoWallets.ts::SUPPORTED_CHAINS`. Keep this
      // enum in lockstep — every new chain/coin added there must also
      // be added here or the FE picker sees the option but the API
      // rejects the selection with a 400 zod error.
      chain: z
        .enum(["tron", "polygon", "bsc", "ethereum", "bitcoin"])
        .optional(),
      coin: z.enum(["USDT", "USDC", "ETH", "BTC", "POL"]).optional(),
      // ─── Save-card additions (phase 1 Stripe + phase 2 Razorpay) ───
      // Zod strips unknown fields on parse, so these MUST be declared
      // here for the service to see them. Without this, the FE checkbox
      // and saved-card row selections silently no-op — the PI/order gets
      // created without customer / setup_future_usage / customer_id.
      savedPaymentMethodId: z.string().optional(),
      savePaymentMethodForFuture: z.boolean().optional(),
      savedRazorpayTokenId: z.string().optional(),
      saveRazorpayCardForFuture: z.boolean().optional(),
    });

    const options = schema.parse(req.body);

    // India crypto gate — belt-and-braces beside the payment-options
    // hide. Even if the FE cache is stale or a caller crafts the API
    // request by hand, an Indian buyer cannot spawn a fresh
    // CryptoPaymentRequest on any of our chains. Uses the same
    // resolveBuyerGstRegion helper GST uses (5-tier fallback:
    // shipping → billing → profile country → profile pincode/state →
    // INR-currency fallback). Already-in-flight requests are NOT
    // retroactively blocked here — the poller settles them normally.
    if (options.paymentMethodCategory === "crypto") {
      try {
        // Must accept an invoice number too: routed by number, findById
        // returned null here, which silently SKIPPED the India crypto gate
        // this block exists to enforce.
        const invForRegion: any = await getInvoice(invoiceId);
        if (invForRegion) {
          const { resolveBuyerGstRegion } = await import(
            "../utils/gstBuyerRegion"
          );
          const region = await resolveBuyerGstRegion({
            buyerUserId: String(invForRegion.userId),
            shippingAddress: invForRegion.shippingAddress,
            billingAddress: invForRegion.billingAddress,
            paymentCurrency: invForRegion.itemCurrency,
          });
          if (region.inIndia) {
            return res.status(403).json({
              success: false,
              error:
                "Crypto payments are not available for Indian buyers. Please use card, UPI, or wallet.",
            });
          }
        }
      } catch (regionErr) {
        // Region resolution failed — DON'T fail-open. Treat as Indian
        // (safer default). Log so ops can catch it.
        console.error(
          "[select-payment] region resolution failed for crypto gate — defaulting to blocked:",
          regionErr,
        );
        return res.status(403).json({
          success: false,
          error:
            "Crypto payment is temporarily unavailable. Please use card, UPI, or wallet.",
        });
      }
    }

    const result = await selectPaymentMethod(invoiceId, options);

    // Zero-amount coupon path: invoice marked paid above — run bat246 placement now
    if ((result as any).alreadyPaid) {
      try {
        const invoice = await getInvoice(invoiceId);
        // Defensive: getInvoice can return null if the row vanished between
        // selectPaymentMethod and this fetch. Skip placement rather than
        // crashing the response — the user already saw "paid".
        if (!invoice) {
          console.warn(`[invoice] zero-amount path: invoice ${invoiceId} not found post-select; skipping bat246 placement`);
        } else {
          // Bat246 POD invite — 100%-off coupon (e.g. "FREEPOD") on the POD
          // product. This zero-amount path never calls fulfillInvoice(), so
          // it needs its own copy of the hook. Non-fatal.
          const zeroPayProductId = invoice.lineItems?.[0]?.itemId?.toString();
          if (zeroPayProductId === "6a7236f5e76fd9817e7238d9" && invoice.userId) {
            try {
              const { markPodPurchaseCompleted } = await import("../bat246/services/bat246PodInvite.service");
              await markPodPurchaseCompleted(invoice.userId.toString());
            } catch (err) {
              console.error("[bat246-pod] markPodPurchaseCompleted (zero-pay coupon path) failed:", err);
            }
          }
        }
        if (invoice && invoice.metadata?.type === "product_checkout") {
          const invoiceProductId = invoice.lineItems?.[0]?.itemId?.toString();
          if (invoiceProductId) {
            const invoiceProduct = await Product.findById(invoiceProductId).select("tags").lean() as any;
            if ((invoiceProduct?.tags ?? []).includes("bat246_entry")) {
              const bat246BoardId: string | undefined = invoice.metadata?.bat246BoardId;
              const bat246Pos: string | undefined = invoice.metadata?.bat246Pos;
              const bat246UpperRef: string | undefined = invoice.metadata?.bat246UpperRef;
              const bat246UpperRefPlayerId: string | undefined = invoice.metadata?.bat246UpperRefPlayerId;
              const bat246DugoutRef: string | undefined = invoice.metadata?.bat246DugoutRef;
              const bat246GenRef: string | undefined = invoice.metadata?.bat246GenRef;
              const bat246Ref: string | undefined = invoice.metadata?.bat246Ref;
              const userId = invoice.userId.toString();
              const invoiceUser = await User.findById(userId).select("name email country").lean() as any;
              const saleAmt = (invoice.totalAmount ?? 0) / 100;
              if (bat246BoardId && bat246Pos && bat246Ref) {
                await createPendingPlacement(userId, invoiceUser?.name || "", invoiceUser?.email || "", bat246BoardId, bat246Pos, bat246Ref);
              } else if (bat246BoardId && bat246Pos) {
                await addAtBatFromPurchase({ boardId: bat246BoardId, pos1stBase: bat246Pos, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
              } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
                await addFromUpperBaseInvite({ boardId: bat246BoardId, referrerPosition: bat246UpperRef as "2ndBaseA" | "2ndBaseB" | "3rdBase", referrerPlayerId: bat246UpperRefPlayerId, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
              } else if (bat246BoardId && bat246GenRef) {
                await addFromGenericInvite({ boardId: bat246BoardId, referrerPlayerId: bat246GenRef, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
              } else if (bat246BoardId && bat246DugoutRef) {
                await addToDugoutFromPurchase({ boardId: bat246BoardId, referredByPlayerId: bat246DugoutRef, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
              } else if (bat246Ref && Types.ObjectId.isValid(bat246Ref)) {
                // No board/position — admin assigns later; still qualify the user
                const { Bat246Distributor: BD } = await import("../bat246/models/bat246Distributor.model");
                const { Bat246Player: BP } = await import("../bat246/models/bat246Player.model");
                const { createBat246Player } = await import("../bat246/services/bat246PlayerId.util");
                let player2 = await BP.findOne({ userId: new Types.ObjectId(userId) });
                if (!player2) { player2 = await createBat246Player({ userId: new Types.ObjectId(userId), nickname: invoiceUser?.name || invoiceUser?.email || "", email: invoiceUser?.email || "", memberSince: new Date() }); }
                await BD.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { playerId: player2._id, hasPurchasedProduct: true, isOfficeMember: true }, $setOnInsert: { bat246RefUserId: new Types.ObjectId(bat246Ref), isGarageAffiliate: false, hasBat246Membership: false, isQualified: false } }, { upsert: true });
                await BD.updateOne({ userId: new Types.ObjectId(userId), bat246RefUserId: null }, { $set: { bat246RefUserId: new Types.ObjectId(bat246Ref) } });
                // isGarageAffiliate ($25 Garage Affiliate) dropped from
                // qualification on request.
                const fd = await BD.findOne({ userId: new Types.ObjectId(userId) }).select("isOfficeMember hasBat246Membership hasPurchasedProduct isGarageAffiliate isQualified").lean() as any;
                if (fd && !fd.isQualified && fd.isOfficeMember && fd.hasBat246Membership && fd.hasPurchasedProduct) {
                  await BD.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { isQualified: true, qualifiedAt: new Date() } });
                  const { maybeCreatePlacementNotification } = await import("../bat246/services/bat246.service");
                  const { assignDistributorId } = await import("../bat246/services/bat246DistributorId.util");
                  await assignDistributorId(userId).catch((err: any) => console.error("[bat246] assignDistributorId failed:", err.message));
                  await maybeCreatePlacementNotification(userId).catch(() => {});
                }
                const en2 = await Bat246PlacementNotification.exists({ qualifiedUserId: new Types.ObjectId(userId), isActioned: false });
                if (!en2) {
                  await Bat246PlacementNotification.create({ notificationType: "placement", boardId: null, position: null, qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: invoiceUser?.email || "", qualifiedUserName: invoiceUser?.name || "", uplineUserId: new Types.ObjectId(bat246Ref) });
                }
              } else {
                console.log(`[bat246] no board context for user ${userId}, skipping board creation`);
              }
            }
          }
        }
      } catch (bat246Err: any) {
        console.error("[bat246] zero-amount coupon placement failed:", bat246Err.message);
      }
    }

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[Invoice] Error selecting payment method:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invoices/:invoiceId/verify-payment
 * Verify Razorpay payment signature, mark invoice as paid, trigger downstream fulfillment.
 */
router.post("/:invoiceId/verify-payment", async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
    });

    const paymentData = schema.parse(req.body);

    // Verify and mark paid
    const invoice = await verifyAndCompletePayment(invoiceId, paymentData);

    // Trigger downstream fulfillment based on item type
    const primaryItem = invoice.lineItems[0];
    let fulfillmentResult: any = null;

    if (primaryItem && !(invoice as any).__alreadyFulfilled) {
      try {
        fulfillmentResult = await fulfillInvoice(invoice, paymentData.razorpayPaymentId);
      } catch (fulfillmentError: any) {
        console.error(
          `[Invoice] Fulfillment error for ${invoice.invoiceNumber}:`,
          fulfillmentError
        );
        // Payment succeeded even if fulfillment fails — don't return error to user
        fulfillmentResult = { error: fulfillmentError.message };
      }
    }

    // ── Bat246 board placement (only for bat246_entry tagged products) ────────
    if (invoice.metadata?.type === "product_checkout") {
      try {
        const invoiceProductId = invoice.lineItems?.[0]?.itemId?.toString();
        if (invoiceProductId) {
          const invoiceProduct = await Product.findById(invoiceProductId).select("tags").lean() as any;
          const productTags: string[] = invoiceProduct?.tags ?? [];
          if (productTags.includes("bat246_entry")) {
            const bat246BoardId: string | undefined = invoice.metadata?.bat246BoardId;
            const bat246Pos: string | undefined = invoice.metadata?.bat246Pos;
            const bat246UpperRef: string | undefined = invoice.metadata?.bat246UpperRef;
            const bat246UpperRefPlayerId: string | undefined = invoice.metadata?.bat246UpperRefPlayerId;
            const bat246DugoutRef: string | undefined = invoice.metadata?.bat246DugoutRef;
            const bat246GenRef: string | undefined = invoice.metadata?.bat246GenRef;
            const userId = invoice.userId.toString();
            const invoiceUser = await User.findById(userId).select("name email country").lean() as any;
            const saleAmt = (invoice.totalAmount ?? 0) / 100;
            if (bat246BoardId && bat246Pos) {
              await addAtBatFromPurchase({
                boardId: bat246BoardId,
                pos1stBase: bat246Pos,
                userId,
                userName: invoiceUser?.name || "",
                userEmail: invoiceUser?.email || "",
                productId: invoiceProductId,
                saleAmount: saleAmt,
                countryResidence: invoiceUser?.country ?? undefined,
              });
            } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
              await addFromUpperBaseInvite({
                boardId: bat246BoardId,
                referrerPosition: bat246UpperRef as "2ndBaseA" | "2ndBaseB" | "3rdBase",
                referrerPlayerId: bat246UpperRefPlayerId,
                userId,
                userName: invoiceUser?.name || "",
                userEmail: invoiceUser?.email || "",
                productId: invoiceProductId,
                saleAmount: saleAmt,
                countryResidence: invoiceUser?.country ?? undefined,
              });
            } else if (bat246BoardId && bat246GenRef) {
              await addFromGenericInvite({
                boardId: bat246BoardId,
                referrerPlayerId: bat246GenRef,
                userId,
                userName: invoiceUser?.name || "",
                userEmail: invoiceUser?.email || "",
                productId: invoiceProductId,
                saleAmount: saleAmt,
                countryResidence: invoiceUser?.country ?? undefined,
              });
            } else if (bat246BoardId && bat246DugoutRef) {
              await addToDugoutFromPurchase({
                boardId: bat246BoardId,
                referredByPlayerId: bat246DugoutRef,
                userId,
                userName: invoiceUser?.name || "",
                userEmail: invoiceUser?.email || "",
                productId: invoiceProductId,
                saleAmount: saleAmt,
                countryResidence: invoiceUser?.country ?? undefined,
              });
            } else {
              console.log(`[bat246] no board context for user ${userId}, skipping board creation`);
            }
          }
        }
      } catch (bat246Err: any) {
        console.error("[bat246] invoice post-payment placement failed:", bat246Err.message);
      }
    }

    // Mark coupon usage as applied
    if (invoice.couponUsageId) {
      await markUsageApplied(invoice.couponUsageId.toString()).catch(console.error);
    }

    res.json({
      success: true,
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        paidAt: invoice.paidAt,
      },
      fulfillment: fulfillmentResult,
    });
  } catch (error: any) {
    console.error("[Invoice] Error verifying payment:", error);

    // Mark coupon usage as failed
    const invoice = await getInvoice(req.params.invoiceId);
    if (invoice?.couponUsageId) {
      await markUsageFailed(invoice.couponUsageId.toString()).catch(console.error);
    }

    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invoices/:invoiceId/confirm-stripe-payment
 * Synchronously confirm a Stripe PaymentIntent: verifies status with Stripe,
 * marks invoice as paid, and runs downstream fulfillment. The Stripe webhook
 * is the backstop if this call doesn't reach the server (e.g. tab closed).
 */
router.post(
  "/:invoiceId/confirm-stripe-payment",
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params;

      if (!isValidInvoiceIdentifier(invoiceId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid invoice ID" });
      }

      const schema = z.object({ paymentIntentId: z.string() });
      const { paymentIntentId } = schema.parse(req.body);

      const invoice = await getInvoice(invoiceId);
      if (!invoice) {
        return res
          .status(404)
          .json({ success: false, error: "Invoice not found" });
      }

      // Idempotency — if webhook beat us here, return success without re-running fulfillment
      if (invoice.status === "paid") {
        return res.json({
          success: true,
          alreadyPaid: true,
          invoice: {
            _id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            paidAt: invoice.paidAt,
          },
        });
      }

      const { retrievePaymentIntent } = await import("../services/stripe");
      const pi = await retrievePaymentIntent(paymentIntentId);

      if (pi.metadata?.invoiceId !== invoice._id.toString()) {
        return res.status(400).json({
          success: false,
          error: "Payment intent does not match this invoice",
        });
      }

      if (pi.status !== "succeeded") {
        return res.status(400).json({
          success: false,
          error: `Payment intent status is ${pi.status}`,
        });
      }

      const chargeId =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : pi.latest_charge?.id || null;

      invoice.status = "paid";
      invoice.paidAt = new Date();
      invoice.paymentPlatform = "stripe";
      invoice.paymentMethodCategory = "card";
      invoice.paymentCurrency = (pi.currency || "usd").toUpperCase();
      invoice.metadata = {
        ...(invoice.metadata || {}),
        stripePaymentIntentId: pi.id,
        stripeChargeId: chargeId,
      };
      await invoice.save();

      let fulfillmentResult: any = null;
      try {
        fulfillmentResult = await fulfillInvoice(invoice, `stripe_${pi.id}`);
      } catch (fulfillmentError: any) {
        console.error(
          `[Invoice] Stripe fulfillment error for ${invoice.invoiceNumber}:`,
          fulfillmentError
        );
        fulfillmentResult = { error: fulfillmentError.message };
      }

      // ── Bat246 board placement (only for bat246_entry tagged products) ────────
      if (invoice.metadata?.type === "product_checkout") {
        try {
          const invoiceProductId = invoice.lineItems?.[0]?.itemId?.toString();
          if (invoiceProductId) {
            const invoiceProduct = await Product.findById(invoiceProductId).select("tags").lean() as any;
            const productTags: string[] = invoiceProduct?.tags ?? [];
            if (productTags.includes("bat246_entry")) {
              const bat246BoardId: string | undefined = invoice.metadata?.bat246BoardId;
              const bat246Pos: string | undefined = invoice.metadata?.bat246Pos;
              const bat246UpperRef: string | undefined = invoice.metadata?.bat246UpperRef;
              const bat246UpperRefPlayerId: string | undefined = invoice.metadata?.bat246UpperRefPlayerId;
              const bat246DugoutRef: string | undefined = invoice.metadata?.bat246DugoutRef;
              const bat246GenRef: string | undefined = invoice.metadata?.bat246GenRef;
              const bat246Ref: string | undefined = invoice.metadata?.bat246Ref;
              const userId = invoice.userId.toString();
              const invoiceUser = await User.findById(userId).select("name email country").lean() as any;
              const saleAmt = (invoice.totalAmount ?? 0) / 100;
              if (bat246BoardId && bat246Pos && bat246Ref) {
                await createPendingPlacement(userId, invoiceUser?.name || "", invoiceUser?.email || "", bat246BoardId, bat246Pos, bat246Ref);
              } else if (bat246BoardId && bat246Pos) {
                await addAtBatFromPurchase({ boardId: bat246BoardId, pos1stBase: bat246Pos, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
              } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
                await addFromUpperBaseInvite({ boardId: bat246BoardId, referrerPosition: bat246UpperRef as "2ndBaseA" | "2ndBaseB" | "3rdBase", referrerPlayerId: bat246UpperRefPlayerId, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
              } else if (bat246BoardId && bat246GenRef) {
                await addFromGenericInvite({ boardId: bat246BoardId, referrerPlayerId: bat246GenRef, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
              } else if (bat246BoardId && bat246DugoutRef) {
                await addToDugoutFromPurchase({ boardId: bat246BoardId, referredByPlayerId: bat246DugoutRef, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
              } else {
                console.log(`[bat246] no board context for user ${userId}, skipping board creation`);
              }
            }
          }
        } catch (bat246Err: any) {
          console.error("[bat246] stripe-payment placement failed:", bat246Err.message);
        }
      }

      if (invoice.couponUsageId) {
        await markUsageApplied(invoice.couponUsageId.toString()).catch(
          console.error
        );
      }

      res.json({
        success: true,
        invoice: {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          paidAt: invoice.paidAt,
        },
        fulfillment: fulfillmentResult,
      });
    } catch (error: any) {
      console.error("[Invoice] Error confirming Stripe payment:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/invoices/:invoiceId/cancel
 * Cancel an unpaid invoice
 */
router.post("/:invoiceId/cancel", async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const force = req.query.force === "true" || req.body?.force === true;
    const invoice = await cancelInvoice(invoiceId, { force });

    res.json({
      success: true,
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
      },
    });
  } catch (error: any) {
    if (error instanceof CryptoPaymentInFlightError) {
      // 409 Conflict — caller should warn the user and retry with force=true.
      return res.status(409).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }
    console.error("[Invoice] Error cancelling invoice:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invoices/:parentId/cancel-subscription
 * Cancel a recurring subscription at end of current billing period.
 * Current paid period continues; no future invoices will be generated.
 */
router.post("/:parentId/cancel-subscription", requireAuth, async (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;
    const user = (req as any).user as { userId: string };

    if (!isValidInvoiceIdentifier(parentId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const parent = await cancelSubscription(parentId, user.userId);

    res.json({
      success: true,
      invoice: {
        _id: parent._id,
        invoiceNumber: parent.invoiceNumber,
        cancelledAt: parent.cancelledAt,
        nextDueDate: parent.nextDueDate,
      },
    });
  } catch (error: any) {
    console.error("[Invoice] Error cancelling subscription:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invoices/:parentId/renew-subscription
 * Renew (reactivate) a cancelled/expired recurring subscription IN PLACE — reuses
 * the same parent invoice (no new subscription). Clears cancelledAt and ensures a
 * single payable next-cycle child. `covered` = the current paid period still
 * covers today (child due at period end, no charge now); when false the returned
 * invoice is payable immediately to reactivate.
 */
router.post("/:parentId/renew-subscription", requireAuth, async (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;
    const user = (req as any).user as { userId: string };

    if (!isValidInvoiceIdentifier(parentId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const { parent, child, covered } = await renewSubscription(parentId, user.userId);

    res.json({
      success: true,
      covered,
      subscription: {
        _id: parent._id,
        invoiceNumber: parent.invoiceNumber,
        nextDueDate: parent.nextDueDate,
      },
      invoice: child
        ? {
            _id: child._id,
            invoiceNumber: child.invoiceNumber,
            amount: child.totalAmount,
            currency: child.itemCurrency,
            status: child.status,
            nextDueDate: child.nextDueDate,
            invoiceShortUrl: child.invoiceShortUrl,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[Invoice] Error renewing subscription:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/invoices/autopay/status
 * Current UPI Autopay state for the signed-in buyer.
 *
 * Deliberately account-level, not per-subscription: one mandate funds every
 * subscription the payer has, so a per-subscription answer would be a lie.
 */
router.get("/autopay/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const { getAutopayState } = await import("../services/upiAutopay");
    res.json({ success: true, autopay: await getAutopayState(user.userId) });
  } catch (error: any) {
    console.error("[Invoice] Error reading autopay status:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invoices/autopay/disable
 * Stop automatic debiting. The SUBSCRIPTION IS NOT CANCELLED.
 *
 * Invoices continue to be issued on the same schedule and are paid manually,
 * exactly as they were before autopay existed. This is the "stop taking money
 * from my account" action, and is distinct from cancel-subscription, which
 * ends the subscription and the access with it.
 */
router.post("/autopay/disable", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const { disableAutopay } = await import("../services/upiAutopay");
    const result = await disableAutopay(user.userId);
    res.json({
      success: true,
      disabled: result.disabled,
      alreadyOff: result.alreadyOff,
      // Keyed `autopay` to match GET /autopay/status and the enable route —
      // one shape for the state on all three, so callers don't special-case.
      autopay: result.state,
      message: result.alreadyOff
        ? "Autopay was already off."
        : "Autopay is off. Your subscription continues — you'll pay each invoice manually.",
    });
  } catch (error: any) {
    console.error("[Invoice] Error disabling autopay:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invoices/:parentId/autopay/enable
 * Re-establish autopay for a subscription — the "resubscribe" path after a
 * deliberate disable, a payer-side revoke, or a mandate that died when
 * Razorpay stopped retrying.
 *
 * Returns the invoice to pay rather than a mandate: Razorpay only mints one as
 * a side effect of a real payment. Paying it by UPI attaches the mandate and
 * the cron resumes from the next cycle. The subscription is never modified.
 */
router.post(
  "/:parentId/autopay/enable",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { parentId } = req.params;
      const user = (req as any).user as { userId: string };

      if (!isValidInvoiceIdentifier(parentId)) {
        return res.status(400).json({ success: false, error: "Invalid invoice ID" });
      }

      const { enableAutopay } = await import("../services/upiAutopay");
      const result = await enableAutopay(parentId, user.userId);

      res.json({
        success: true,
        alreadyOn: result.alreadyOn,
        autopay: result.state,
        message: result.message,
        invoice: result.payable
          ? {
              _id: result.payable._id,
              invoiceNumber: result.payable.invoiceNumber,
              amount: result.payable.totalAmount,
              currency: result.payable.itemCurrency,
              status: result.payable.status,
            }
          : null,
      });
    } catch (error: any) {
      console.error("[Invoice] Error enabling autopay:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

/**
 * POST /api/invoices/:invoiceId/apply-platform-coupon
 * Apply a platform coupon to a draft invoice (cycle 1 of a subscription or a one-time).
 * Recomputes discount + totalAmount, creates PlatformCouponRedemption, and if the
 * discount takes total to 0, auto-pays and fulfills.
 */
router.post("/:invoiceId/apply-platform-coupon", softAuth, async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    // Apply-coupon requires a verified identity. The JWT may come from a
    // normal login (in-app flow) OR from the OTP verify-otp route (public
    // invoice link). softAuth gives us the payload without doing a
    // User.findById (which has been the source of past 401s for valid OTP
    // tokens); we identify-check by comparing the JWT's email claim to the
    // invoice's customerEmail below.
    const authedUser = (req as any).user as
      | { userId: string; email?: string; orgId?: string }
      | undefined;
    const { code } = req.body as { code?: string };

    if (!code) {
      return res.status(400).json({ success: false, error: "code is required" });
    }
    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }
    if (!authedUser) {
      return res.status(401).json({
        success: false,
        error: "Verify your email to apply a coupon",
      });
    }

    // Accept EITHER identifier form. The invoice pay page is routed by
    // invoice NUMBER, so findById() here threw a CastError
    // ("Cast to ObjectId failed for value \"INV-…\"") and the request 400'd.
    // `getInvoice` resolves an ObjectId or an invoice number.
    const invoice = await getInvoice(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, error: "Invoice not found" });

    // Identity check: the verified email on the token must match the invoice's
    // recipient. Covers both authenticated users paying their own invoices and
    // OTP'd public-link customers (the OTP route signs invoice.customerEmail
    // into the token). Blocks unverified link openers and stale-token cross-users.
    // Match on userId first: an account that signed up by phone has NO email,
    // so an email-only comparison denies the invoice's actual owner. The email
    // check stays as the fallback, because OTP'd public-link customers are
    // identified by `invoice.customerEmail` and may have no userId on the
    // invoice at all.
    const tokenEmail = (authedUser.email || "").toLowerCase().trim();
    const invoiceEmail = (invoice.customerEmail || "").toLowerCase().trim();
    const ownsByUserId =
      !!invoice.userId &&
      !!authedUser.userId &&
      String(invoice.userId) === String(authedUser.userId);
    const ownsByEmail = !!tokenEmail && !!invoiceEmail && tokenEmail === invoiceEmail;
    if (!ownsByUserId && !ownsByEmail) {
      return res.status(403).json({
        success: false,
        error: "Coupon can only be applied by the invoice's recipient",
      });
    }

    // Coupon can be applied when the invoice is unpaid AND no payment
    // attempt has been initiated. `draft` is the classic pre-payment state;
    // `pending` also qualifies as long as no Razorpay order has been
    // created (a live Razorpay order carries the pre-coupon total and would
    // go stale on mutation). Terminal states — paid / refunded / cancelled
    // / expired — are always rejected.
    if (!["draft", "pending"].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        error: `Invoice is ${invoice.status} and cannot be modified`,
      });
    }
    //
    // A live Razorpay order carries the PRE-coupon total, so it cannot simply
    // be left in place — the buyer would be charged the undiscounted amount.
    // This used to refuse outright, which was a dead end: the checkout offers
    // the coupon box on the Pay step, by which time an order already exists,
    // so applying one silently failed and the totals never moved (confirmed in
    // production — the Razorpay sheet still showed the full amount).
    //
    // Instead, void the stale order so the next Pay mints a fresh one at the
    // discounted total. Only safe while nothing has actually been paid against
    // it, so ask Razorpay first: if any payment exists on that order, refuse —
    // discounting an invoice someone is mid-way through paying would leave
    // them overpaid.
    if ((invoice as any).razorpayOrderId) {
      const staleOrderId = (invoice as any).razorpayOrderId as string;
      try {
        const { listOrderPayments } = await import("../services/razorpay");
        const attempts = await listOrderPayments(staleOrderId);
        const live = attempts.filter((p: any) =>
          ["authorized", "captured", "refunded"].includes(p?.status),
        );
        if (live.length > 0) {
          return res.status(400).json({
            success: false,
            error:
              "A payment is already in progress for this invoice — cannot apply a coupon now.",
          });
        }
      } catch (err: any) {
        // Can't confirm the order is unpaid → don't touch it. Failing closed
        // costs the buyer a coupon; failing open could cost them money.
        console.error(
          `[Invoice] coupon: could not check payments on ${staleOrderId}:`,
          err?.message ?? err,
        );
        return res.status(400).json({
          success: false,
          error:
            "Could not verify the pending payment for this invoice. Please try again.",
        });
      }

      console.log(
        `[Invoice] coupon on ${invoice.invoiceNumber}: voiding unpaid order ${staleOrderId} so a new one is minted at the discounted total`,
      );
      (invoice as any).razorpayOrderId = undefined;
      // Back to draft so selectPaymentMethod treats the next Pay as a fresh
      // selection rather than a resumed one.
      invoice.status = "draft";
    }
    // Renewal cycles CAN take a coupon. This used to be first-cycle-only,
    // which meant a subscriber looking at a due renewal had no way to redeem
    // anything — the input was hidden and the API refused it.
    //
    // A coupon applied to a renewal discounts THAT cycle only; see the
    // redemption keying below. Children that already inherited a chain-level
    // coupon are still blocked by the "already applied" guard immediately
    // after this, and the `razorpayOrderId` / status guards above still stop a
    // coupon landing on an invoice that's mid-payment.
    if (invoice.couponId || invoice.couponCode) {
      return res.status(400).json({
        success: false,
        error: "A coupon is already applied to this invoice",
      });
    }

    const { validatePlatformCoupon, redeemPlatformCoupon, redemptionScopeFor } = await import(
      "../services/platformCoupon"
    );
    const { couponProductTypeForItem } = await import(
      "../models/invoice.model"
    );
    const { couponBaseCents } = await import("../services/invoice");
    const primaryType = invoice.lineItems[0]?.itemType;
    const couponProductType = primaryType
      ? couponProductTypeForItem(primaryType)
      : undefined;
    // For validation + redemption tracking, attribute the redemption to the
    // invoice's customer (invoice.userId) when no token is attached. The
    // invoice's customer is the one who benefits from the discount, so this
    // is the correct identity for per-user limit checks.
    const redeemingUserId =
      authedUser?.userId || invoice.userId.toString();
    const validation = await validatePlatformCoupon({
      code,
      productType: couponProductType as any,
      userId: redeemingUserId,
      // Territory coupons discount only the $650 floor; the resulting discount
      // is still subtracted from the full subtotal below.
      amountCents: couponBaseCents(primaryType, invoice.subtotal),
      orgId: invoice.organizationId?.toString(),
      itemId: invoice.lineItems[0]?.itemId?.toString(),
      invoiceCurrency: invoice.itemCurrency,
    });
    if (!validation.valid || !validation.coupon) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    invoice.couponId = validation.coupon._id;
    invoice.couponCode = validation.coupon.code;
    invoice.discount = validation.discount || 0;

    // Rescale tax to the discounted base — `invoice.tax` was stamped at
    // invoice-creation time (before any coupon was known), so left as-is a
    // 100%-off coupon would still leave the buyer owing the full,
    // pre-discount tax amount. Scaling proportionally (rather than
    // recomputing from a hardcoded rate) keeps this correct for every
    // product type this shared route serves, whatever tax rule each one used.
    const preDiscountTax = invoice.tax || 0;
    const finalBeforeTax = Math.max(0, invoice.subtotal - invoice.discount);
    invoice.tax =
      invoice.subtotal > 0
        ? Math.round((preDiscountTax * finalBeforeTax) / invoice.subtotal)
        : 0;
    invoice.totalAmount =
      finalBeforeTax + invoice.tax + (invoice.shippingCost || 0);

    // NOTE: do NOT auto-mark paid / auto-fulfill here even if totalAmount===0.
    // Finalization happens when the user clicks Confirm, which routes through
    // selectPaymentMethod's zero-amount short-circuit (see services/invoice.ts).
    // This keeps activation side-effects (subscriptions, board placement,
    // commissions, etc.) bound to an explicit user action.
    await invoice.save();

    await redeemPlatformCoupon({
      coupon: validation.coupon,
      userId: redeemingUserId,
      productType: couponProductType as any,
      // Scope decided centrally — a multi-cycle coupon has to land on the
      // chain ROOT even when it is redeemed partway through a subscription,
      // or the generator never sees it. See redemptionScopeFor.
      ...redemptionScopeFor(validation.coupon!, invoice),
    });

    res.json({
      success: true,
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        totalAmount: invoice.totalAmount,
        couponCode: invoice.couponCode,
        willBeFree: invoice.totalAmount === 0,
      },
    });
  } catch (error: any) {
    console.error("[Invoice] apply-platform-coupon error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invoices/:invoiceId/gstin
 * Buyer-side GSTIN capture for GST-applicable invoices. Optional — buyer can
 * skip. Only allowed on unpaid invoices (draft / pending); terminal states
 * reject.
 *
 * Auth pattern mirrors apply-platform-coupon: softAuth + email identity
 * check against invoice.customerEmail (supports both in-app logins and
 * OTP-verified public-link buyers).
 *
 * Body: { gstin: string, companyName?: string }
 * GSTIN normalized to uppercase + trimmed and validated against the standard
 * 15-char format. Passing an empty gstin clears both fields.
 */
router.post("/:invoiceId/gstin", softAuth, async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const authedUser = (req as any).user as
      | { userId: string; email?: string; orgId?: string }
      | undefined;
    const { gstin, companyName } = req.body as {
      gstin?: string;
      companyName?: string;
    };

    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }
    if (!authedUser) {
      return res.status(401).json({
        success: false,
        error: "Verify your email to save a GSTIN",
      });
    }

    // Accept EITHER identifier form. The invoice pay page is routed by
    // invoice NUMBER, so findById() here threw a CastError
    // ("Cast to ObjectId failed for value \"INV-…\"") and the request 400'd.
    // `getInvoice` resolves an ObjectId or an invoice number.
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    // Identity check — same as apply-platform-coupon.
    // Match on userId first: an account that signed up by phone has NO email,
    // so an email-only comparison denies the invoice's actual owner. The email
    // check stays as the fallback, because OTP'd public-link customers are
    // identified by `invoice.customerEmail` and may have no userId on the
    // invoice at all.
    const tokenEmail = (authedUser.email || "").toLowerCase().trim();
    const invoiceEmail = (invoice.customerEmail || "").toLowerCase().trim();
    const ownsByUserId =
      !!invoice.userId &&
      !!authedUser.userId &&
      String(invoice.userId) === String(authedUser.userId);
    const ownsByEmail = !!tokenEmail && !!invoiceEmail && tokenEmail === invoiceEmail;
    if (!ownsByUserId && !ownsByEmail) {
      return res.status(403).json({
        success: false,
        error: "GSTIN can only be saved by the invoice's recipient",
      });
    }

    // Only unpaid invoices are editable — matches apply-platform-coupon rule.
    if (!["draft", "pending"].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        error: `Invoice is ${invoice.status} and cannot be modified`,
      });
    }

    const raw = String(gstin || "").trim().toUpperCase();
    // Empty string → clear both fields (buyer changed their mind).
    if (raw === "") {
      invoice.gstin = undefined as any;
      invoice.companyName = undefined as any;
      await invoice.save();
      return res.json({
        success: true,
        gstin: null,
        companyName: null,
      });
    }

    // Standard Indian GSTIN — 15 chars: 2 digits state + 10 chars PAN +
    // 1 entity code + Z + 1 checksum.
    const GSTIN_RX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!GSTIN_RX.test(raw)) {
      return res.status(400).json({
        success: false,
        error: "Invalid GSTIN format",
      });
    }

    invoice.gstin = raw;
    if (typeof companyName === "string") {
      const normName = companyName.trim();
      if (normName) invoice.companyName = normName;
      else invoice.companyName = undefined as any;
    }
    await invoice.save();

    return res.json({
      success: true,
      gstin: invoice.gstin,
      companyName: invoice.companyName || null,
    });
  } catch (error: any) {
    console.error("[Invoice] save gstin error:", error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/invoices/:invoiceId/pay-with-wallet
 * Pay an invoice using the user's affiliate or store wallet balance.
 * Requires authentication (the authenticated user must own the invoice).
 */
router.post("/:invoiceId/pay-with-wallet", requireAuth, async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string };

    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const schema = z.object({
      walletType: z.enum(["store", "affiliate"]),
      orgId: z.string().optional(), // Required when walletType === "store"
      // Sibling currency selector — only meaningful for store wallets on
      // cryptobrand orgs (USD/INR/ETH/BTC). Legacy USD-only flow omits it
      // and gets USD by default; invoices whose
      // `metadata.allowedWalletCurrencies` is set validate against that
      // list. Amount is credited/debited in the wallet's own currency,
      // NOT converted to USD.
      currency: z.string().trim().toUpperCase().optional(),
      // Optional idempotency key — same 1-200 char string convention as
      // convert / transfer-multi. If a completed debit for this key
      // already exists, we short-circuit with 409 DUPLICATE_DEDUPE_KEY
      // and echo back the original success payload. Closes the double-
      // pay window that the invoice-status guard alone cannot cover
      // (a network retry after a completed pay whose response was
      // dropped).
      dedupeKey: z.string().min(1).max(200).optional(),
    });
    const { walletType, orgId, currency, dedupeKey } = schema.parse(req.body);

    // The Affiliate Vault is no longer a way to PAY (founder's call, 19 Sep
    // 2026). Earnings still move to the Store Vault via
    // /wallet/affiliate/transfer-to-store, and the Store Vault still pays.
    // "affiliate" stays in the schema so a stale client gets this message
    // instead of a generic validation error; the option is gone from
    // getPaymentOptions and the checkout, so nothing current sends it.
    if (walletType === "affiliate") {
      return res.status(400).json({
        success: false,
        code: "AFFILIATE_WALLET_NOT_PAYABLE",
        error:
          "Purchases can't be paid from the Affiliate Vault. Move your earnings to your Store Vault from the Wallet page, then pay from there.",
      });
    }

    if (walletType === "store" && !orgId) {
      return res.status(400).json({ success: false, error: "orgId is required for store wallet payment" });
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    // Same staleness rule as the card/UPI path — a wallet balance must not be
    // able to settle a quote that expired months ago either.
    {
      const refusal = await refuseIfNotPayable(invoice);
      if (refusal) return res.status(409).json(refusal);
    }

    // Verify invoice belongs to the authenticated user
    if (invoice.userId.toString() !== user.userId) {
      return res.status(403).json({ success: false, error: "This invoice belongs to another user" });
    }

    // Idempotency short-circuit — checked BEFORE the invoice-status guard
    // so a retry after a completed pay (whose response never reached the
    // client) reads as "already applied" instead of the misleading
    // "invoice cannot be paid (paid)" 400. We only trust a match when the
    // debit is owned by the SAME userId — dedupeKey values are
    // caller-generated, so treat them as scoped to the caller.
    if (dedupeKey) {
      const { WalletTransaction: WT } = await import("../models/walletTransaction.model");
      const prior = await WT.findOne({
        "metadata.dedupeKey": dedupeKey,
        userId: user.userId,
        type: "debit",
        status: "completed",
      })
        .select("_id amount currency balanceAfter metadata createdAt")
        .lean();
      if (prior) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_DEDUPE_KEY",
          error: "This payment has already been applied.",
          transaction: {
            _id: String((prior as any)._id),
            amount: (prior as any).amount,
            currency: (prior as any).currency,
            balanceAfter: (prior as any).balanceAfter,
            invoiceId: (prior as any).metadata?.invoiceId || String(invoice._id),
            appliedAt: (prior as any).createdAt,
          },
        });
      }
    }

    if (!["draft", "pending"].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        error: `Invoice cannot be paid (current status: ${invoice.status})`,
      });
    }

    // Multi-currency invoice? Constrained by metadata.allowedWalletCurrencies.
    // When present, the invoice was minted in a specific currency and pays
    // out at parity from that currency's wallet — no USD conversion.
    const allowedWalletCurrencies: string[] | undefined = Array.isArray(
      (invoice.metadata as any)?.allowedWalletCurrencies,
    )
      ? (invoice.metadata as any).allowedWalletCurrencies.map((c: string) =>
          String(c).toUpperCase(),
        )
      : undefined;

    let debitCurrency = "USD";
    let debitAmount: number;

    if (allowedWalletCurrencies && walletType === "store") {
      if (!currency) {
        return res.status(400).json({
          success: false,
          error: `currency is required for this invoice (accepts ${allowedWalletCurrencies.join(", ")})`,
        });
      }
      if (!allowedWalletCurrencies.includes(currency)) {
        return res.status(400).json({
          success: false,
          error: `currency "${currency}" is not accepted by this invoice`,
        });
      }
      debitCurrency = currency;
      // At-parity — invoice totalAmount is the smallest unit in that
      // currency, matches the wallet balance unit.
      debitAmount = Math.round((invoice.totalAmount / 100) * 1e8) / 1e8;
    } else {
      // Legacy USD-only path — invoice totalAmount is in smallest currency
      // unit; convert to USD if needed.
      let usdAmount = invoice.totalAmount / 100;
      if (invoice.itemCurrency !== "USD") {
        const { convertToUsd } = await import("../utils/exchangeRate");
        const conversion = await convertToUsd(usdAmount, invoice.itemCurrency);
        usdAmount = conversion.usdAmount;
      }
      debitAmount = Math.round(usdAmount * 100) / 100;
    }

    // Stamp `metadata.kind` on the debit for known itemTypes so
    // downstream ledgers (e.g. HiFi transactions page) can filter cleanly.
    // Historically debits carried NO metadata; add only when we have a
    // known category so we don't muddy the ledger for other paths.
    const primaryItemType = invoice.lineItems?.[0]?.itemType;
    let debitMetadata: Record<string, any> | undefined;
    if (primaryItemType === "hifi_investment") {
      debitMetadata = {
        kind: "hifi_investment_payment",
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        hifiApplicationId: (invoice.metadata as any)?.hifiApplicationId,
        hifiProductId: (invoice.metadata as any)?.hifiProductId,
      };
    }
    // Weave the caller's dedupeKey (if any) into the debit's metadata
    // so the partial-unique index on `metadata.dedupeKey` catches a
    // race that slipped past the pre-check above (two concurrent
    // requests, same key). The E11000 lands in the catch block below.
    if (dedupeKey) {
      debitMetadata = {
        ...(debitMetadata || {}),
        dedupeKey,
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
      };
    }

    // Debit the store wallet (the only wallet that pays — see the
    // AFFILIATE_WALLET_NOT_PAYABLE guard above).
    const { debitStoreWallet } = await import("../services/wallet");
    let walletResult;
    try {
      walletResult = await debitStoreWallet(
        user.userId,
        orgId!,
        debitAmount,
        `Payment for invoice ${invoice.invoiceNumber}`,
        undefined,
        undefined,
        debitCurrency,
        debitMetadata,
      );
    } catch (debitErr: any) {
      // Concurrent-request race on the dedupeKey — the pre-check
      // above didn't see the prior write, but the DB's partial-
      // unique index caught it here. Surface as the same 409 the
      // convert / transfer-multi paths use so clients treat it
      // uniformly.
      if (dedupeKey && debitErr?.code === 11000) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_DEDUPE_KEY",
          error: "This payment has already been applied.",
        });
      }
      return res.status(400).json({ success: false, error: debitErr.message || "Failed to debit wallet" });
    }

    // Mark invoice paid
    invoice.status = "paid";
    invoice.paidAt = new Date();
    invoice.paymentMethodCategory = "wallet";
    invoice.paymentPlatform = "store_wallet";
    invoice.paymentCurrency = debitCurrency;
    invoice.metadata = {
      ...(invoice.metadata || {}),
      walletTransactionId: walletResult.transaction._id.toString(),
      walletType,
      walletOrgId: orgId,
      walletCurrency: debitCurrency,
      paidFromUsd: debitCurrency === "USD" ? debitAmount : undefined,
      paidFromAmount: debitAmount,
    };
    await invoice.save();

    // Fulfill downstream (create order, enroll in course, etc.)
    const fulfillmentPaymentId = `wallet_${walletResult.transaction._id}`;
    try {
      await fulfillInvoice(invoice, fulfillmentPaymentId);
    } catch (fulfillErr: any) {
      console.error(
        `[Invoice] Wallet-pay fulfillment error for ${invoice.invoiceNumber}:`,
        fulfillErr
      );
      // Payment succeeded even if fulfillment fails — don't return error to user
    }

    // ── Bat246 board placement (wallet payment path) ─────────────────────────
    if (invoice.metadata?.type === "product_checkout") {
      try {
        const invoiceProductId = invoice.lineItems?.[0]?.itemId?.toString();
        if (invoiceProductId) {
          const invoiceProduct = await Product.findById(invoiceProductId).select("tags").lean() as any;
          const productTags: string[] = invoiceProduct?.tags ?? [];
          if (productTags.includes("bat246_entry")) {
            const bat246BoardId: string | undefined = invoice.metadata?.bat246BoardId;
            const bat246Pos: string | undefined = invoice.metadata?.bat246Pos;
            const bat246UpperRef: string | undefined = invoice.metadata?.bat246UpperRef;
            const bat246UpperRefPlayerId: string | undefined = invoice.metadata?.bat246UpperRefPlayerId;
            const bat246DugoutRef: string | undefined = invoice.metadata?.bat246DugoutRef;
            const bat246GenRef: string | undefined = invoice.metadata?.bat246GenRef;
            const walletUserId = invoice.userId.toString();
            const walletInvoiceUser = await User.findById(walletUserId).select("name email country").lean() as any;
            const saleAmt = (invoice.totalAmount ?? 0) / 100;
            if (bat246BoardId && bat246Pos) {
              await addAtBatFromPurchase({ boardId: bat246BoardId, pos1stBase: bat246Pos, userId: walletUserId, userName: walletInvoiceUser?.name || "", userEmail: walletInvoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: walletInvoiceUser?.country ?? undefined });
            } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
              await addFromUpperBaseInvite({ boardId: bat246BoardId, referrerPosition: bat246UpperRef as "2ndBaseA" | "2ndBaseB" | "3rdBase", referrerPlayerId: bat246UpperRefPlayerId, userId: walletUserId, userName: walletInvoiceUser?.name || "", userEmail: walletInvoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: walletInvoiceUser?.country ?? undefined });
            } else if (bat246BoardId && bat246GenRef) {
              await addFromGenericInvite({ boardId: bat246BoardId, referrerPlayerId: bat246GenRef, userId: walletUserId, userName: walletInvoiceUser?.name || "", userEmail: walletInvoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: walletInvoiceUser?.country ?? undefined });
            } else if (bat246BoardId && bat246DugoutRef) {
              await addToDugoutFromPurchase({ boardId: bat246BoardId, referredByPlayerId: bat246DugoutRef, userId: walletUserId, userName: walletInvoiceUser?.name || "", userEmail: walletInvoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: walletInvoiceUser?.country ?? undefined });
            } else {
              console.log(`[bat246] no board context for user ${walletUserId}, skipping board creation`);
            }
          }
        }
      } catch (bat246Err: any) {
        console.error("[bat246] wallet-pay placement failed:", bat246Err.message);
      }
    }

    // Mark coupon usage as applied if present
    if (invoice.couponUsageId) {
      await markUsageApplied(invoice.couponUsageId.toString()).catch(console.error);
    }

    res.json({
      success: true,
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        paidAt: invoice.paidAt,
      },
      walletTransaction: {
        _id: walletResult.transaction._id,
        amount: debitAmount,
        currency: debitCurrency,
        balanceAfter: walletResult.wallet.balance,
        walletType,
      },
    });
  } catch (error: any) {
    console.error("[Invoice] pay-with-wallet error:", error);
    res.status(400).json({ success: false, error: error.message || "Payment failed" });
  }
});

/**
 * POST /api/invoices/:invoiceId/request-otp
 * Send OTP to the invoice's customerEmail for verification before payment.
 * Returns masked email for UI display.
 */
router.post("/:invoiceId/request-otp", async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    const email = invoice.customerEmail.toLowerCase().trim();
    const code = await createOtp(email, "guest-login");

    await sendMail(
      email,
      "Your Invoice Payment Verification Code",
      `<p>Your verification code for invoice <b>${invoice.invoiceNumber}</b> is <b>${code}</b> (valid 10 minutes).</p>`,
      `Your verification code is ${code}`,
      await senderForHost(req, EMAIL_FROM_OTP)
    );

    res.json({
      success: true,
      maskedEmail: maskEmail(email),
    });
  } catch (error: any) {
    console.error("[Invoice] Error sending OTP:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to send OTP" });
  }
});

/**
 * POST /api/invoices/:invoiceId/verify-otp
 * Verify OTP against invoice's customerEmail. On success, returns JWT token + orgId
 * so the user can proceed to payment without a full login.
 */
router.post("/:invoiceId/verify-otp", async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const schema = z.object({ code: z.string().length(6) });
    const { code } = schema.parse(req.body);

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    const email = invoice.customerEmail.toLowerCase().trim();
    const verified = await verifyOtp(email, code, "guest-login");

    if (verified === false) {
      return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    }

    // Look up the invoice owner and generate a token
    const user = await User.findById(invoice.userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const token = signJwt({
      userId: user._id.toString(),
      orgId: invoice.organizationId.toString(),
      name: user.name || "",
      email: user.email,
    });

    res.json({
      success: true,
      token,
      orgId: invoice.organizationId.toString(),
      userId: user._id.toString(),
      // Surface phone here so the FE can pass it into Razorpay's `prefill.contact`
      // on the in-page checkout. Without this, the popup asks the user to
      // re-enter their number every time on the guest invoice-pay flow.
      phone: (user as any).phone || "",
    });
  } catch (error: any) {
    console.error("[Invoice] Error verifying OTP:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to verify OTP" });
  }
});

/** How long a handoff token is good for. Long enough to open a browser, short
 *  enough that a leaked URL is worthless by the time anyone reads it. */
const HANDOFF_TTL_SECONDS = 300;

/**
 * POST /api/invoices/:invoiceId/handoff-token
 * Mint a short-lived token that lets an ALREADY-AUTHENTICATED payer open the
 * hosted invoice page without the email OTP (request-otp → verify-otp).
 *
 * The mobile app signed this user in against this same backend, so the OTP
 * would only be asking them to prove they are themselves a second time. The
 * token is scoped to one invoice, carries no session rights of its own, and
 * expires in five minutes — it is exchanged for the session token rather than
 * being one, so a real token never travels in a URL (URLs leak into browser
 * history, referrers and access logs).
 */
router.post("/:invoiceId/handoff-token", requireAuth, async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string };

    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    // Only the payer may hand their own invoice off.
    if (invoice.userId.toString() !== user.userId) {
      return res.status(403).json({ success: false, error: "not_invoice_owner" });
    }

    const token = signJwt(
      {
        purpose: "invoice_handoff",
        // The canonical id, so the exchange is indifferent to whether the page
        // was opened by ObjectId or by invoice number.
        invoiceId: invoice._id.toString(),
        userId: invoice.userId.toString(),
        orgId: invoice.organizationId.toString(),
      },
      { expiresIn: HANDOFF_TTL_SECONDS }
    );

    res.json({
      success: true,
      token,
      expiresInSeconds: HANDOFF_TTL_SECONDS,
    });
  } catch (error: any) {
    console.error("[Invoice] Error creating handoff token:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create handoff token" });
  }
});

/**
 * POST /api/invoices/:invoiceId/handoff-exchange
 * Public counterpart of handoff-token: the hosted invoice page trades the
 * handoff token for a session, and gets back exactly what verify-otp returns
 * so the payment flow downstream cannot tell the two entry paths apart.
 *
 * Public by design — the token IS the credential. It is accepted only if it
 * is unexpired, was minted for a handoff, and names this invoice; anything
 * else is a flat 401 rather than a hint about which part was wrong.
 */
router.post("/:invoiceId/handoff-exchange", async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const schema = z.object({ token: z.string().min(1) });
    const { token: handoffToken } = schema.parse(req.body);

    let payload: { purpose?: string; invoiceId?: string; userId?: string; orgId?: string };
    try {
      payload = verifyJwt(handoffToken);
    } catch {
      return res.status(401).json({ success: false, error: "invalid_handoff" });
    }

    // A session token must not be usable here, and a handoff token must not be
    // spendable on a different invoice than the one it was minted for.
    if (payload.purpose !== "invoice_handoff" || !payload.invoiceId || !payload.userId) {
      return res.status(401).json({ success: false, error: "invalid_handoff" });
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice || invoice._id.toString() !== payload.invoiceId) {
      return res.status(401).json({ success: false, error: "invalid_handoff" });
    }

    const user = await User.findById(payload.userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const token = signJwt({
      userId: user._id.toString(),
      orgId: invoice.organizationId.toString(),
      name: user.name || "",
      email: user.email,
    });

    res.json({
      success: true,
      token,
      orgId: invoice.organizationId.toString(),
      userId: user._id.toString(),
      // Same reason as verify-otp: Razorpay's `prefill.contact` on the in-page
      // checkout, so the popup does not ask for the number again.
      phone: (user as any).phone || "",
    });
  } catch (error: any) {
    console.error("[Invoice] Error exchanging handoff token:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to exchange handoff token" });
  }
});

/**
 * GET /api/invoices/:invoiceId/receipt
 * Get a paid invoice as a receipt
 */
router.get("/:invoiceId/receipt", async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    if (!isValidInvoiceIdentifier(invoiceId)) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    if (invoice.status !== "paid") {
      return res.status(400).json({ success: false, error: "Invoice is not paid" });
    }

    const fromOrganization = await resolveFromOrganization(invoice);

    res.json({
      success: true,
      receipt: {
        invoiceNumber: invoice.invoiceNumber,
        paidAt: invoice.paidAt,
        lineItems: invoice.lineItems,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        shippingCost: invoice.shippingCost,
        totalAmount: invoice.totalAmount,
        itemCurrency: invoice.itemCurrency,
        paymentCurrency: invoice.paymentCurrency,
        currencyConversion: invoice.currencyConversion,
        paymentMethodCategory: invoice.paymentMethodCategory,
        paymentPlatform: invoice.paymentPlatform,
        paymentSource: (invoice as any).paymentSource,
        razorpayPaymentId: invoice.razorpayPaymentId,
        customerEmail: invoice.customerEmail,
        customerName: invoice.customerName,
        invoiceShortUrl: invoice.invoiceShortUrl,
        // Tax/fee breakdown blocks. Present only when the corresponding
        // metadata was stamped at checkout (channels with GST or iOS Apple
        // fee). Receipt UI can hide rows that are absent.
        gst: (invoice.metadata as any)?.gst,
        appleFee: (invoice.metadata as any)?.appleFee,
      },
      fromOrganization,
    });
  } catch (error: any) {
    console.error("[Invoice] Error fetching receipt:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ Authenticated Endpoints ============

/**
 * POST /api/invoices/generate
 * Create a pending invoice for any sellable (product/channel/course/service/workshop)
 * and return a public pay URL. Used for one-click Buy Now flows (e.g. in-webinar pins).
 *
 * Accepts `{ itemType, itemId }` or the legacy `{ productId }` shorthand.
 */
router.post("/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      itemType: z
        .enum(["product", "channel", "course", "service", "workshop"])
        .optional(),
      itemId: z.string().optional(),
      // Legacy: productId is equivalent to itemType="product", itemId=productId
      productId: z.string().optional(),
      quantity: z.number().int().min(1).default(1),
      customer: z.object({
        email: z.string().email(),
        name: z.string().optional(),
        phone: z.string().optional(),
      }),
      couponCode: z.string().optional(),
      notes: z.string().optional(),
    });

    const parsed = schema.parse(req.body);
    const { orgId, quantity, customer, couponCode, notes } = parsed;
    // Normalize to { itemType, itemId }.
    const itemType: SellableItemType =
      parsed.itemType || (parsed.productId ? "product" : ("product" as const));
    const itemId = parsed.itemId || parsed.productId;

    const user = (req as any).user as { userId: string };

    if (!itemId) {
      return res
        .status(400)
        .json({ success: false, error: "itemId (or productId) is required" });
    }
    if (!Types.ObjectId.isValid(orgId) || !Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid orgId or itemId",
      });
    }

    const sellable = await getSellable(orgId, itemType, itemId);
    if (!sellable) {
      return res
        .status(404)
        .json({ success: false, error: "Item not found or not available" });
    }

    // Only products currently track stock. Other types are intangible.
    if (itemType === "product") {
      const product = await Product.findById(itemId).lean();
      if (product && !product.isSubscription && product.trackQuantity) {
        const available = product.quantity ?? 0;
        if (available < quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock. Available: ${available}`,
          });
        }
      }
    }

    const unitPricePaise = Math.round(sellable.price * 100);
    const isRecurring = !!sellable.isSubscription;

    // Resolve the buyer's upline so commissions route to whoever referred them.
    // distributeCommissions() walks User.referredBy at payment time, but we also
    // stamp the referrer's affiliateId on the invoice for audit + UI display.
    const buyer = await User.findById(user.userId)
      .select("referredBy")
      .lean();
    const referrer = buyer?.referredBy
      ? await getReferrerInfo(buyer.referredBy.toString())
      : null;
    const referrerAffiliateId = referrer?.affiliateCode || undefined;

    const invoice = await createInvoice({
      organizationId: orgId,
      sellerId: sellable.sellerId || user.userId,
      userId: user.userId,
      customerEmail: customer.email.trim().toLowerCase(),
      customerName: customer.name,
      lineItems: [
        {
          itemType: toInvoiceItemType(itemType),
          itemId: itemId,
          itemName: sellable.name,
          itemDescription: sellable.description,
          itemImage: sellable.image,
          quantity,
          unitPrice: unitPricePaise,
          originalCurrency: sellable.currency,
        },
      ],
      itemCurrency: sellable.currency,
      isRecurring,
      recurringPeriod: isRecurring
        ? (sellable.subscriptionPeriod as any) || "monthly"
        : undefined,
      couponCode,
      referralId: referrerAffiliateId,
      metadata: {
        type: `${itemType}_generate`,
        itemType,
        customerPhone: customer.phone,
        notes,
        referrerUserId: referrer?.id,
      },
    });

    // Populate the public pay URL on the invoice so the frontend can open it
    // directly. The hosted page at /invoice/:invoiceId handles Razorpay.
    if (!invoice.invoiceShortUrl) {
      const base = env.FRONTEND_URL || "http://localhost:3000";
      invoice.invoiceShortUrl = `${base.replace(/\/$/, "")}/invoice/${invoice._id}`;
      await invoice.save();
    }

    res.json({
      success: true,
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      currency: invoice.itemCurrency,
      invoiceShortUrl: invoice.invoiceShortUrl,
      referrer: referrer
        ? {
            affiliateId: referrer.affiliateCode,
            name: referrer.name,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[Invoice] Error generating invoice:", error);
    res
      .status(400)
      .json({ success: false, error: error.message || "Failed to generate invoice" });
  }
});

/**
 * GET /api/invoices/my/list
 * List invoices for the authenticated user
 */
router.get("/my/list", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string };

    const { status, invoiceType, limit, skip } = req.query;

    const result = await listUserInvoices(user.userId, {
      organizationId: user.orgId,
      status: status as string,
      invoiceType: invoiceType as "one_time" | "recurring" | undefined,
      limit: limit ? Number(limit) : 20,
      skip: skip ? Number(skip) : 0,
    });

    res.json({
      success: true,
      invoices: result.invoices.map((inv) => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        invoiceType: inv.invoiceType,
        status: inv.status,
        lineItems: inv.lineItems,
        subtotal: inv.subtotal,
        discount: inv.discount,
        tax: inv.tax,
        totalAmount: inv.totalAmount,
        itemCurrency: inv.itemCurrency,
        paymentCurrency: inv.paymentCurrency,
        currencyConversion: inv.currencyConversion,
        paymentMethodCategory: inv.paymentMethodCategory,
        paymentPlatform: inv.paymentPlatform,
        isRecurring: inv.isRecurring,
        recurringPeriod: inv.recurringPeriod,
        recurringPaymentNumber: inv.recurringPaymentNumber,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
        cancelledAt: inv.cancelledAt,
        invoiceShortUrl: inv.invoiceShortUrl,
        razorpayPaymentId: inv.razorpayPaymentId,
        // Needed by OrdersPage to route Cancel-Subscription clicks through
        // the channel-aware DELETE /feed/channels/:id/subscribe endpoint
        // instead of the invoice-only cancel path. Also lets FE surfaces
        // scope per-org actions (receipts, HQ jumps).
        organizationId: (inv as any).organizationId,
        // razorpaySubscriptionId gates whether Cancel Subscription button
        // renders at all — Razorpay-managed subs cancel via webhook, not
        // via our invoice-cancel routes.
        razorpaySubscriptionId: (inv as any).razorpaySubscriptionId,
        parentInvoiceId: inv.parentInvoiceId,
        nextDueDate: inv.nextDueDate,
        // Coupon applied to this invoice (FE shows the code, else "No").
        couponCode: (inv as any).couponCode ?? null,
        couponId: (inv as any).couponId ? String((inv as any).couponId) : null,
      })),
      total: result.total,
    });
  } catch (error: any) {
    console.error("[Invoice] Error listing user invoices:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/invoices/subscriptions/:parentId
 * Full detail for ONE recurring subscription: the parent invoice's metadata +
 * the complete child-invoice history + computed rollups (payments count, current
 * cycle, coupon). `:parentId` may be the parent OR any child — we resolve to the
 * recurring parent either way. Scoped to the caller (must own the invoice).
 */
router.get("/subscriptions/:parentId", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string };
    const { parentId } = req.params;
    if (!Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({ success: false, error: "Invalid parentId" });
    }
    const { Invoice } = await import("../models/invoice.model");

    // Accept a child id too — resolve up to the recurring parent.
    let parent = await Invoice.findById(parentId).lean();
    if (parent?.parentInvoiceId) {
      parent = await Invoice.findById(parent.parentInvoiceId).lean();
    }
    if (!parent) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }
    if (String((parent as any).userId) !== String(user.userId)) {
      return res.status(403).json({ success: false, error: "Not your subscription" });
    }

    const children = await Invoice.find({ parentInvoiceId: parent._id })
      .sort({ recurringPaymentNumber: 1, createdAt: 1 })
      .lean();
    // The parent is cycle 1; children are the subsequent cycles.
    const all = [parent, ...children];

    const paymentsCount = all.filter((i) => i.status === "paid").length;
    const currentCycle =
      all.reduce((mx, i) => Math.max(mx, (i as any).recurringPaymentNumber ?? 0), 0) ||
      all.length;

    const lineItemOf = (inv: any) =>
      inv.lineItems?.[0]
        ? {
            itemName: inv.lineItems[0].itemName,
            itemType: inv.lineItems[0].itemType,
            itemImage: inv.lineItems[0].itemImage ?? null,
          }
        : null;
    const serialize = (inv: any) => ({
      id: String(inv._id),
      invoiceNumber: inv.invoiceNumber,
      amount: inv.totalAmount,
      // paymentCurrency is only set once a payment method is chosen; drafts/
      // pending cycles only carry itemCurrency (matches /my/upcoming, /my/list).
      currency: inv.paymentCurrency || inv.itemCurrency || "USD",
      status: inv.status,
      paidAt: inv.paidAt ?? null,
      dueDate: inv.nextDueDate ?? null,
      nextDueDate: inv.nextDueDate ?? null,
      createdAt: inv.createdAt,
      cancelledAt: inv.cancelledAt ?? null,
      recurringPaymentNumber: inv.recurringPaymentNumber ?? null,
      payUrl: inv.invoiceShortUrl ?? null,
      lineItem: lineItemOf(inv),
    });

    res.json({
      success: true,
      subscription: {
        parentInvoiceId: String(parent._id),
        joinedAt: (parent as any).createdAt,
        frequency: (parent as any).recurringPeriod ?? null,
        amount: (parent as any).totalAmount,
        currency:
          (parent as any).paymentCurrency || (parent as any).itemCurrency || "USD",
        coupon: (parent as any).couponCode ?? null,
        paymentsCount,
        currentCycle,
        status: (parent as any).status,
        cancelledAt: (parent as any).cancelledAt ?? null,
        nextDueDate: (parent as any).nextDueDate ?? null,
        razorpaySubscriptionId: (parent as any).razorpaySubscriptionId ?? null,
      },
      invoices: all.map(serialize),
    });
  } catch (error: any) {
    console.error("[Invoice] subscription detail error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/invoices/my/upcoming
 * Get upcoming/pending invoices for the authenticated user.
 * For recurring subscriptions, shows invoices due within the next 5 days.
 */
router.get("/my/upcoming", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string };

    const invoices = await getUpcomingInvoices(user.userId, user.orgId);

    res.json({
      success: true,
      invoices: invoices.map((inv: any) => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        invoiceType: inv.invoiceType,
        status: inv.status,
        lineItems: inv.lineItems,
        subtotal: inv.subtotal,
        discount: inv.discount,
        tax: inv.tax,
        totalAmount: inv.totalAmount,
        itemCurrency: inv.itemCurrency,
        paymentCurrency: inv.paymentCurrency || inv.itemCurrency,
        isRecurring: inv.isRecurring,
        recurringPeriod: inv.recurringPeriod,
        recurringPaymentNumber: inv.recurringPaymentNumber,
        parentInvoiceId: inv.parentInvoiceId || inv._parentInvoiceId,
        // Same reason as in /my/list — needed for channel-aware
        // cancellation routing on the OrdersPage.
        organizationId: inv.organizationId,
        dueDate: inv.dueDate,
        createdAt: inv.createdAt,
        razorpaySubscriptionId: inv.razorpaySubscriptionId,
      })),
      count: invoices.length,
    });
  } catch (error: any) {
    console.error("[Invoice] Error fetching upcoming invoices:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────────────────────────────
// GET /invoices/crypto/chains
//
// Returns the chain/coin combinations we can currently accept crypto
// payments on. Reads from the in-house cryptoWallets config — only
// combos whose PLATFORM_*_ADDRESS env var is set appear here, so
// unsetting an env var takes a coin out of the picker with no code
// change (useful for temporarily disabling a chain during ops).
//
// Public endpoint (no auth) — the FE picker calls this on mount.
router.get("/crypto/chains", (_req: Request, res: Response) => {
  const { getConfiguredChains } = require("../config/cryptoWallets") as typeof import("../config/cryptoWallets");
  const chains = getConfiguredChains().map((c) => ({
    chain: c.chain,
    coin: c.coin,
    label: c.label,
    chainName: c.chainName,
  }));
  res.json({ success: true, chains });
});

export default router;
