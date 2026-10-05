import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { refreshTypeFlags } from "../services/downlineTree";
import { requireAuth, requireInternalKey } from "../middleware/auth";
import {
  createUnilevelPlusPlan,
  getUnilevelPlusPlan,
  getActiveUnilevelPlusPlan,
  getUnilevelPlusPlansByOrg,
  updateUnilevelPlusPlan,
  deleteUnilevelPlusPlan,
  getUserPurchase,
  distributeUnilevelPlusCommission,
  getUPCommissionHistory,
  getUPCommissionStats,
} from "../services/unilevelPlusCommission";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { UnilevelPlusDistribution } from "../models/unilevelPlusDistribution.model";
import { User } from "../models/user.model";
import {
  createOrder as createRazorpayOrder,
  verifyPaymentSignature,
} from "../services/razorpay";
import { createInvoice } from "../services/invoice";
import { Invoice, couponProductTypeForItem } from "../models/invoice.model";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";
import { activateComboFreeFirstMonth } from "../services/comboActivation";
import { comboWindowFor } from "../services/comboWindow";
import { createThirdPartyInvoice } from "../services/thirdPartyInvoice";
import {
  resolveTermPlan,
  listActiveTermPlans,
  defaultTermMonths,
} from "../services/thirdPartyTerms";
import { calculateTaxAmounts, GST_CONFIG, applyGstToLine } from "../utils/gstTax";
import {
  resolveBuyerGstRegion,
  gstSkippedMetadata,
} from "../utils/gstBuyerRegion";

const PLATFORM_USER_EMAIL = "shorupan@gmail.com";

const router = Router();

// ============= Plan CRUD =============

/**
 * POST /unilevel-plus/plans
 * Create a new Unilevel Plus plan
 */
router.post("/plans", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      productPrice: z.number().min(0.01),
      currency: z.string().max(10).optional(),
      companyPercentage: z.number().min(0).max(100),
      directBonusPercentage: z.number().min(0).max(100),
      levelBonusPercentage: z.number().min(0).max(100),
      infinityTier1Percentage: z.number().min(0).max(100).optional(),
      infinityTier2Percentage: z.number().min(0).max(100).optional(),
      managerBonusPercentage: z.number().min(0).max(100).optional(),
      maxLevels: z.number().int().min(1).max(20).optional(),
      pointValue: z.number().min(0.001).optional(),
      legMultipliers: z.array(z.number().min(0.01)).min(1).optional(),
    });

    const data = schema.parse(req.body);

    const plan = await createUnilevelPlusPlan({
      ...data,
      orgId: me.orgId,
      createdBy: me.userId,
    });

    res.status(201).json({ success: true, plan });
  } catch (error) {
    console.error("Error creating unilevel plus plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create plan",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /unilevel-plus/plans
 * List plans for the organization
 */
router.get("/plans", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    const schema = z.object({
      isActive: z
        .string()
        .optional()
        .transform((v) =>
          v === "true" ? true : v === "false" ? false : undefined
        ),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 50)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });

    const options = schema.parse(req.query);
    const result = await getUnilevelPlusPlansByOrg(me.orgId, options);

    res.json({
      success: true,
      plans: result.plans,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error) {
    console.error("Error listing unilevel plus plans:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list plans",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /unilevel-plus/plans/:id
 * Get a specific plan
 */
router.get("/plans/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const plan = await getUnilevelPlusPlan(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }
    res.json({ success: true, plan });
  } catch (error) {
    console.error("Error getting unilevel plus plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get plan",
      details: (error as Error).message,
    });
  }
});

/**
 * PUT /unilevel-plus/plans/:id
 * Update a plan
 */
router.put("/plans/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      productPrice: z.number().min(0.01).optional(),
      currency: z.string().max(10).optional(),
      companyPercentage: z.number().min(0).max(100).optional(),
      directBonusPercentage: z.number().min(0).max(100).optional(),
      levelBonusPercentage: z.number().min(0).max(100).optional(),
      infinityTier1Percentage: z.number().min(0).max(100).optional(),
      infinityTier2Percentage: z.number().min(0).max(100).optional(),
      managerBonusPercentage: z.number().min(0).max(100).optional(),
      maxLevels: z.number().int().min(1).max(20).optional(),
      pointValue: z.number().min(0.001).optional(),
      legMultipliers: z.array(z.number().min(0.01)).min(1).optional(),
      isActive: z.boolean().optional(),
    });

    const updates = schema.parse(req.body);
    const plan = await updateUnilevelPlusPlan(req.params.id, updates);

    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    res.json({ success: true, plan });
  } catch (error) {
    console.error("Error updating unilevel plus plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update plan",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /unilevel-plus/plans/:id
 * Delete a plan (soft delete if distributions exist)
 */
router.delete(
  "/plans/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      await deleteUnilevelPlusPlan(req.params.id);
      res.json({ success: true, message: "Plan deleted" });
    } catch (error) {
      console.error("Error deleting unilevel plus plan:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete plan",
        details: (error as Error).message,
      });
    }
  }
);

// ============= Product & Checkout =============

/**
 * GET /unilevel-plus/product
 * Get the Unilevel Plus product details + purchase status for current user
 */
router.get("/product", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    // Platform user (Shorupan) is treated as always activated but can still buy reserve licenses
    // `offerExpiresAtOverride` is NOT optional here: comboWindowFor reads it to
    // honour an admin extension, and a projection that drops it silently makes
    // every admin-extended offer look expired at checkout.
    const currentUser = await User.findById(me.userId)
      .select("email profileCompletedAt offerExpiresAtOverride")
      .lean();
    const isPlatformUser = currentUser?.email === PLATFORM_USER_EMAIL;

    // The 24-hour free-first-month offer window. Drives both eligibility and
    // the prices quoted below — past it, month 1 is charged like any other.
    const offerWindow = comboWindowFor(currentUser);

    const plan = await getActiveUnilevelPlusPlan();
    if (!plan) {
      return res.json({
        success: true,
        plan: null,
        purchased: false,
        purchase: null,
      });
    }

    const purchase = await getUserPurchase(me.userId);

    // If activated via reserve assignment, include assigner info
    let assignedBy: { _id: string; name: string; email: string; profilePicture?: string } | null = null;
    if (purchase?.metadata?.source === "reserve_assignment" && purchase?.metadata?.assignedBy) {
      const assigner = await User.findById(purchase.metadata.assignedBy)
        .select("name email profilePicture")
        .lean();
      if (assigner) {
        assignedBy = {
          _id: assigner._id.toString(),
          name: assigner.name || "Unknown",
          email: assigner.email || "",
          profilePicture: assigner.profilePicture || undefined,
        };
      }
    }

    // Combo eligibility ($25 first-month combo). The ONLY gate is whether the
    // user has ever redeemed the free-first-month combo (same predicate the
    // create-combo-invoice route uses as gate #2). UP ownership does NOT
    // disqualify — existing-UP users get the $25 combo too (fulfillInvoice
    // handles them: skips duplicate UP, parks a reserve license, still
    // activates the NC subscription).
    const purchased = !!purchase || isPlatformUser;
    const comboUsed = !!(await Invoice.findOne({
      userId: new Types.ObjectId(me.userId),
      "metadata.kind": "combo_free_first_month",
    })
      .select({ _id: 1 })
      .lean());
    // Eligible for the FREE month only while the window is open. The combo
    // checkout itself still works either way — past the window it just charges
    // for month 1 instead of giving it away.
    const comboEligible = !comboUsed && offerWindow.open;

    // Terms the buyer can pick for their ongoing subscription at UP checkout.
    // Best-effort: a catalog lookup must never break the product page.
    let comboTerms: any[] = [];
    try {
      const comboClients = await ThirdPartyClient.find({
        isActive: true,
        "productConfig.productCode": { $exists: true },
      }).lean();
      // The licence price is the same $25 that gates bundle eligibility.
      const licenceUsd = plan.productPrice;
      comboTerms = comboClients
        .filter((c) => c.productConfig)
        .map((c) => {
          // Inside the window the licence still grants a free month, so the
          // monthly option costs $25 alone and multi-month terms get bundle
          // pricing. Outside it, month 1 is charged like any other — so the
          // monthly option reappears in the list at its own price and nothing
          // gets a free month on top.
          const priced = offerWindow.open
            ? listActiveTermPlans(c.productConfig!, "bundle")
            : listActiveTermPlans(c.productConfig!);
          return {
            thirdPartyClientId: c._id.toString(),
            clientName: c.name,
            productCode: c.productConfig!.productCode,
            // Always 1 — a multi-month term is only ever an explicit selection.
            defaultTermMonths: defaultTermMonths(),
            // Whether these prices include the free first month.
            freeFirstMonth: offerWindow.open,
            // Prices available RIGHT NOW. `cartTotal` is the single payment;
            // the licence is always $25 of it and any discount sits on the
            // subscription portion.
            terms: priced.map((t) => ({
              termMonths: t.termMonths,
              label:
                t.label || `${t.termMonths} month${t.termMonths > 1 ? "s" : ""}`,
              // sellAmount is the subscription portion; the cart adds the licence.
              cartTotal: Math.round((licenceUsd + t.sellAmount) * 100) / 100,
              cartTotalCents: Math.round((licenceUsd + t.sellAmount) * 100),
              subscriptionUsd: t.sellAmount,
              standaloneUsd: t.standaloneAmount,
              savingUsd:
                Math.round((t.standaloneAmount - t.sellAmount) * 100) / 100,
              // Inside the window: a free month, then the paid term. Outside:
              // exactly what was paid for.
              monthsOfAccess: offerWindow.open ? t.termMonths + 1 : t.termMonths,
            })),
            // What each term costs if bought/changed later.
            standaloneTerms: listActiveTermPlans(c.productConfig!).map((t) => ({
              termMonths: t.termMonths,
              totalAmount: t.totalAmount,
              totalAmountCents: Math.round(t.totalAmount * 100),
              monthlyEquivalent:
                Math.round((t.totalAmount / t.termMonths) * 100) / 100,
            })),
          };
        });
    } catch (termErr) {
      console.error("[UnilevelPlus] combo term catalog failed:", termErr);
    }

    res.json({
      success: true,
      plan: {
        _id: plan._id,
        name: plan.name,
        description: plan.description,
        productPrice: plan.productPrice,
        currency: plan.currency,
        maxLevels: plan.maxLevels,
        pointValue: plan.pointValue,
        legMultipliers: plan.legMultipliers,
        directBonusPercentage: plan.directBonusPercentage,
        levelBonusPercentage: plan.levelBonusPercentage,
      },
      purchased,
      comboUsed,
      comboEligible,
      comboTerms,
      /**
       * The 24-hour free-first-month offer window.
       *
       * `open` is the whole story for pricing; `expiresAt` is there so a client
       * can render a countdown without re-deriving it. Once closed, the prices
       * in `comboTerms` already reflect a charged first month — the client does
       * not need to adjust anything itself.
       *
       * A user with no `profileCompletedAt` (everyone who finished their
       * profile before this offer existed) reads as permanently closed.
       */
      freeMonthWindow: offerWindow,
      purchase,
      assignedBy,
    });
  } catch (error) {
    console.error("Error getting unilevel plus product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get product",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /unilevel-plus/my-invoices
 * The current user's PAID Unilevel Plus invoices — the $25 activation/combo and
 * any reserve-license purchases. Read-only. Surfaced on the License page because
 * the NetworkChains "Payment History" (a third-party-scoped feed) never lists
 * these regular Garage invoices.
 */
router.get("/my-invoices", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const invoices = await Invoice.find({
      userId: new Types.ObjectId(me.userId),
      "lineItems.itemType": "unilevel_plus",
      status: "paid",
    })
      .select("invoiceNumber totalAmount itemCurrency status paidAt createdAt metadata")
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      invoices: (invoices as any[]).map((i) => ({
        _id: i._id.toString(),
        invoiceNumber: i.invoiceNumber,
        totalAmount: i.totalAmount ?? 0, // cents
        itemCurrency: i.itemCurrency || "USD",
        status: i.status,
        paidAt: i.paidAt || i.createdAt || null,
        // A combo invoice bundles the free NC first month; flag it so the UI can
        // label it (e.g. "Unilevel Plus + free NetworkChains month").
        isCombo: !!i.metadata?.combo,
      })),
    });
  } catch (error) {
    console.error("Error listing Unilevel Plus invoices:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list Unilevel Plus invoices",
    });
  }
});

/**
 * POST /unilevel-plus/checkout/create-order
 * Create a Razorpay order for the Unilevel Plus product
 */
router.post(
  "/checkout/create-order",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };

      const orderUser = await User.findById(me.userId).select("email").lean();
      const isPlatformUser = orderUser?.email === PLATFORM_USER_EMAIL;

      const { quantity: rawQty, couponCode, source } = req.body as {
        quantity?: number;
        couponCode?: string;
        source?: string;
      };
      const quantity = Math.max(1, Math.min(50, parseInt(rawQty as any) || 1));
      // The BAT246 office sells the standalone $25 licence regardless of the
      // 24h combo window — this page has no combo checkout of its own, so
      // the guard below (which exists to redirect elsewhere to the combo
      // endpoint) does not apply to it.
      const isBat246Office = source === "bat246_office";

      /**
       * POST-WINDOW GUARD — the licence is not sold alone once the 24h offer
       * has closed.
       *
       * This route predates the combo and prices purely off
       * `plan.productPrice`, with no notion of the offer window. That is
       * correct INSIDE the window ($25 licence, first partner cycle free) and
       * wrong outside it, where the canonical `quoteComboCheckout` answer is
       * $25 licence + $36 first cycle = $61. Between April and August 2026, 38
       * single-seat buyers came through here after their window had closed,
       * paid $25, and received no subscription at all — the offer they were
       * shown didn't exist any more.
       *
       * Rejected rather than silently repriced: the caller has already
       * rendered a price to the buyer, and charging $61 against a button that
       * said $29.50 would be worse than refusing. The client is told to use
       * the combo endpoint, which quotes the real number.
       *
       * Three deliberate exemptions:
       *   - quantity > 1 — bulk/reserve seats are a different product (seats
       *     to gift, no subscription implied) and stay at flat $25 forever.
       *   - window still open — unchanged, this is the offer working.
       *   - no single active third-party client — then no combo product
       *     exists to redirect to, and licence-only is legitimately the only
       *     thing we can sell. Mirrors the same rule in `comboFallback`, so
       *     we never block a purchase we have no alternative for.
       */
      if (quantity === 1 && !isBat246Office) {
        try {
          const { comboWindowFor } = await import("../services/comboWindow");
          const buyerDoc = await User.findById(me.userId)
            .select("profileCompletedAt offerExpiresAtOverride")
            .lean();
          if (!comboWindowFor(buyerDoc as any, new Date()).open) {
            const { ThirdPartyClient: TPC } = await import(
              "../models/thirdPartyClient.model"
            );
            const activeClients = await TPC.find({ isActive: true })
              .select("_id")
              .limit(2)
              .lean();
            if (activeClients.length === 1) {
              return res.status(409).json({
                success: false,
                error: "combo_required",
                message:
                  "The 24-hour offer has ended. The Unilevel Plus licence is now sold together with the first subscription cycle — use /unilevel-plus/checkout/create-combo-invoice for current pricing.",
              });
            }
          }
        } catch (guardErr: any) {
          // Fail OPEN. This route is the only way some buyers can activate,
          // and a transient lookup failure must not block a legitimate
          // in-window purchase. The mispricing it guards against is a revenue
          // leak, not a safety issue.
          console.error(
            `[UP] post-window guard check failed for ${me.userId}, allowing purchase:`,
            guardErr?.message ?? guardErr,
          );
        }
      }

      // Get active plan
      const plan = await getActiveUnilevelPlusPlan();
      if (!plan) {
        return res.status(404).json({
          success: false,
          error: "No active Unilevel Plus plan found",
        });
      }

      const unitAmountInSmallestUnit = Math.round(plan.productPrice * 100);
      const rawSubtotal = unitAmountInSmallestUnit * quantity;

      // If a platform coupon is present, preview its discount so GST is
      // computed on the POST-discount amount — otherwise a 100%-off coupon
      // still leaves the buyer owing tax on the original, un-discounted
      // price (e.g. a $0 order still charging 18% of the pre-discount $25).
      // This is a read-only preview (validatePlatformCoupon does not touch
      // usage counters — only redeemPlatformCoupon does), and createInvoice
      // below still independently re-validates + applies the coupon for
      // real, so this can't double-consume or bypass any coupon checks.
      let taxableAmount = rawSubtotal;
      if (couponCode) {
        try {
          const { validatePlatformCoupon } = await import("../services/platformCoupon");
          const preview = await validatePlatformCoupon({
            code: couponCode,
            productType: couponProductTypeForItem("unilevel_plus"),
            userId: me.userId,
            amountCents: rawSubtotal,
            orgId: me.orgId,
            itemId: plan._id.toString(),
            invoiceCurrency: plan.currency || "USD",
          });
          if (preview.valid && preview.finalAmount != null) {
            taxableAmount = preview.finalAmount;
          }
        } catch {
          // Non-fatal preview — createInvoice re-validates the coupon for
          // real below and will surface any actual error to the user.
        }
      }

      // 18% GST on top of the (possibly discounted) base price — UP is a
      // platform fee, so it is always exclusive, never "included in the
      // price". Applicability is gated on the BUYER's country: an Indian
      // buyer pays $29.50, a buyer outside India pays $25.00. Populates
      // `invoice.tax` so fulfillInvoice's platform-ledger auto-credit
      // picks it up (and correctly skips it for foreign buyers).
      //
      // `paymentCurrency` here is the PLAN's currency (always USD for UP),
      // NOT what the buyer will actually pay in — Razorpay converts to
      // INR at the modal. It's only a last-resort fallback signal for
      // buyers with no country-implying profile fields at all. The pincode
      // / state fallbacks inside resolveBuyerGstRegion cover the common
      // NC-created case where `country` is null but the profile still
      // clearly points at India.
      const upGstRegion = await resolveBuyerGstRegion({
        buyerUserId: me.userId,
        paymentCurrency: plan.currency || "USD",
      });
      const upGstLine = applyGstToLine({
        listedAmountMinor: taxableAmount,
        gstInclusive: false,
        buyerInIndia: upGstRegion.inIndia,
      });
      const upTaxAmount = upGstLine.taxTotal;

      // Create invoice FIRST (so platform coupon discount is reflected before Razorpay)
      let invoiceId: string | undefined;
      let invoiceTotalAmount = unitAmountInSmallestUnit * quantity + upTaxAmount;
      let invoiceAlreadyPaid = false;
      try {
        const invoice = await createInvoice({
          organizationId: me.orgId,
          sellerId: me.userId,
          userId: me.userId,
          customerEmail: orderUser?.email || "",
          lineItems: [{
            itemType: "unilevel_plus",
            itemId: plan._id.toString(),
            itemName: quantity > 1 ? `${plan.name} × ${quantity}` : plan.name,
            itemDescription: plan.description,
            quantity,
            unitPrice: unitAmountInSmallestUnit,
            originalCurrency: plan.currency || "USD",
          }],
          itemCurrency: plan.currency || "USD",
          tax: upTaxAmount,
          metadata: {
            type: "unilevel_plus_activation",
            quantity,
            ...(upGstLine.gstMetadata
              ? {
                  gst: {
                    ...upGstLine.gstMetadata,
                    buyerCountry: upGstRegion.country,
                    buyerRegion: "IN" as const,
                    regionSource: upGstRegion.source,
                  },
                }
              : { gstSkipped: gstSkippedMetadata(upGstRegion, "buyer_outside_india") }),
          },
          platformCouponCode: couponCode,
        });
        invoiceId = invoice._id.toString();
        invoiceTotalAmount = invoice.totalAmount;
        invoiceAlreadyPaid = invoice.status === "paid";
      } catch (invoiceError: any) {
        // Coupon errors should be returned to user
        if (invoiceError?.message?.toLowerCase().includes("coupon")) {
          return res.status(400).json({
            success: false,
            error: invoiceError.message,
          });
        }
        console.error("[UnilevelPlus] Invoice creation error (non-blocking):", invoiceError);
      }

      // If zero-pay coupon took the total to 0, skip Razorpay — invoice is already fulfilled
      if (invoiceAlreadyPaid || invoiceTotalAmount === 0) {
        return res.json({
          success: true,
          alreadyPaid: true,
          invoiceId,
          plan: {
            name: plan.name,
            productPrice: plan.productPrice,
            currency: plan.currency,
          },
        });
      }

      // Create Razorpay order for the DISCOUNTED total
      const shortTs = Date.now().toString().slice(-12);
      const order = await createRazorpayOrder({
        amount: invoiceTotalAmount,
        currency: plan.currency || "USD",
        receipt: `up_${shortTs}`,
        notes: {
          userId: me.userId,
          orgId: me.orgId,
          planId: plan._id.toString(),
          type: "unilevel_plus_activation",
          quantity: String(quantity),
          invoiceId: invoiceId || "",
          couponCode: couponCode || "",
        },
      });

      res.json({
        success: true,
        razorpayOrder: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        invoiceId,
        plan: {
          name: plan.name,
          productPrice: plan.productPrice,
          currency: plan.currency,
        },
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error("Error creating unilevel plus order:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create order",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * POST /unilevel-plus/checkout/create-combo-invoice
 *
 * Combo offer: pay for Unilevel Plus ($25) AND get the FIRST cycle of a
 * third-party subscription (e.g. NetworkChain $36/mo) FREE. This endpoint
 * ONLY creates the UP invoice with the combo intent stamped — it does NOT
 * lock the user into Razorpay. The FE then uses the standard invoice
 * payment flow (any method — Razorpay, Stripe, store wallet, affiliate
 * wallet, crypto) to actually pay the $25:
 *
 *   GET  /api/invoices/payment-options
 *   POST /api/invoices/:invoiceId/select-payment  (razorpay/stripe/crypto)
 *   POST /api/invoices/:invoiceId/pay-with-wallet (wallet)
 *
 * Whatever path clears the invoice eventually calls fulfillInvoice, which
 * lands in case "unilevel_plus" → activateComboFreeFirstMonth fires there
 * regardless of payment method. Cycle 2 onwards bills at full price via the
 * existing generateDueRecurringInvoices cron.
 *
 * Eligibility (all enforced before any invoice is created):
 *  1. User does NOT already have active UP.
 *  2. User has NEVER used this combo before (one-time globally).
 *  3. ThirdPartyClient exists, is active, has productConfig + recurringPeriod.
 */
router.post(
  "/checkout/create-combo-invoice",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };

      const schema = z.object({
        thirdPartyClientId: z.string().min(1),
        productCode: z.string().min(1).optional(),
        // Term for the ONGOING subscription (cycle 2 onward). The combo's own
        // first cycle is always 1 free month regardless of what's chosen here.
        termMonths: z.number().int().min(1).max(60).optional(),
      });
      const { thirdPartyClientId, productCode, termMonths } = schema.parse(
        req.body
      );

      if (!Types.ObjectId.isValid(thirdPartyClientId)) {
        return res.status(400).json({
          success: false,
          error: "invalid_third_party_client_id",
        });
      }

      // (1) NOTE: we intentionally DO NOT block users who already own UP.
      // The combo at $25 is offered to them too. fulfillInvoice's
      // case "unilevel_plus" already handles this implicitly:
      //   - Step A (self-activation) is skipped when getUserPurchase() exists,
      //     so no duplicate UnilevelPlusPurchase / unique-index conflict and no
      //     duplicate Bat246/affiliate-flag updates.
      //   - The redundant seat is parked as a reserve license (Step B) with the
      //     normal $25 commission — a giftable license, by design.
      //   - The combo block still fires activateComboFreeFirstMonth, so the NC
      //     subscription activates identically to a new user.
      // The true one-time gate is (2) combo_already_used below.

      // (2) Combo not already used (one-time globally per user — matches the
      // externalId stamped by activateComboFreeFirstMonth).
      const priorCombo = await Invoice.findOne({
        userId: new Types.ObjectId(me.userId),
        "metadata.kind": "combo_free_first_month",
      }).lean();
      if (priorCombo) {
        return res.status(409).json({
          success: false,
          error: "combo_already_used",
          message: "You have already used the free-first-month offer.",
        });
      }

      // (2b) Is the 24-hour free-first-month window still open?
      //
      // NOT a rejection. Past the window the purchase still goes through — the
      // buyer just pays for their first cycle instead of getting it free, and
      // coverage starts immediately rather than after a free month.
      const comboBuyer = await User.findById(me.userId)
        .select({ profileCompletedAt: 1, offerExpiresAtOverride: 1 })
        .lean();
      const offerWindow = comboWindowFor(comboBuyer);
      const grantFreeMonth = offerWindow.open;

      // (3) Partner is eligible
      const client = await ThirdPartyClient.findById(thirdPartyClientId);
      if (!client || !client.isActive || !client.productConfig?.recurringPeriod) {
        return res.status(404).json({
          success: false,
          error: "client_not_eligible",
          message: "Third-party client is missing, inactive, or not subscription-enabled.",
        });
      }
      if (productCode && productCode !== client.productConfig.productCode) {
        return res.status(400).json({
          success: false,
          error: "product_code_mismatch",
          message: `productCode "${productCode}" does not match this client's configured product "${client.productConfig.productCode}".`,
        });
      }

      // Resolve the term at BUNDLE pricing — buying it in the same cart as the
      // $25 licence is cheaper than buying it standalone later. Validate now
      // rather than letting it fail silently at renewal time.
      // termMonths=1 has no bundled tier, so it stays a plain combo.
      let bundlePlan: ReturnType<typeof resolveTermPlan> | null = null;
      if (termMonths && termMonths > 1) {
        try {
          bundlePlan = resolveTermPlan(client.productConfig, termMonths, {
            pricing: "bundle",
          });
        } catch (termErr: any) {
          return res.status(400).json({
            success: false,
            error: "invalid_term",
            message: termErr?.message || "Unsupported subscription term",
          });
        }
      } else if (!grantFreeMonth) {
        // Past the window a MONTHLY buyer has to pay for month 1 too, so the
        // cart needs a subscription portion it never carried before: $25 + $36.
        // Standalone pricing, because there is no bundled monthly rate — the
        // bundle discount only ever existed on multi-month terms.
        try {
          bundlePlan = resolveTermPlan(client.productConfig, 1);
        } catch (termErr: any) {
          return res.status(400).json({
            success: false,
            error: "invalid_term",
            message: termErr?.message || "Unsupported subscription term",
          });
        }
      } else if (termMonths) {
        try {
          resolveTermPlan(client.productConfig, termMonths);
        } catch (termErr: any) {
          return res.status(400).json({
            success: false,
            error: "invalid_term",
            message: termErr?.message || "Unsupported subscription term",
          });
        }
      }

      // Get active UP plan
      const plan = await getActiveUnilevelPlusPlan();
      if (!plan) {
        return res.status(404).json({
          success: false,
          error: "No active Unilevel Plus plan found",
        });
      }

      const orderUser = await User.findById(me.userId).select("email").lean();

      // Cart total. A bundle is charged as ONE unilevel_plus-primary invoice
      // covering licence + term — fulfillInvoice dispatches on lineItems[0] and
      // cannot fulfil a mixed-line invoice, so the subscription rides along and
      // is spawned as a prepaid cycle at fulfilment time.
      //
      // The licence is ALWAYS attributed at its full $25 list; the bundle's
      // discount lands entirely on the subscription portion. `metadata.bundle`
      // below is what pins UP commission to $25 instead of the cart total.
      // `sellAmount` in bundle mode is the SUBSCRIPTION PORTION; the cart the
      // buyer pays is licence + that.
      const licenceUsd = plan.productPrice;
      const bundleSubUsd = bundlePlan ? bundlePlan.sellAmount : 0;
      const cartUsd = bundlePlan
        ? Math.round((licenceUsd + bundleSubUsd) * 100) / 100
        : licenceUsd;
      const unitAmountInSmallestUnit = Math.round(cartUsd * 100);

      if (bundlePlan && bundleSubUsd <= 0) {
        return res.status(400).json({
          success: false,
          error: "invalid_bundle_price",
          message: `Bundled ${termMonths}-month subscription portion must be greater than $0`,
        });
      }

      // 18% GST on top of the whole cart — same buyer-location gate as the
      // standalone $25 flow. The spawned subscription cycle carries tax: 0
      // precisely because the GST for its portion is collected here.
      const comboGstRegion = await resolveBuyerGstRegion({
        buyerUserId: me.userId,
        paymentCurrency: plan.currency || "USD",
      });
      const comboGstLine = applyGstToLine({
        listedAmountMinor: unitAmountInSmallestUnit,
        gstInclusive: false,
        buyerInIndia: comboGstRegion.inIndia,
      });
      const comboUpTaxAmount = comboGstLine.taxTotal;

      // Build UP invoice with the combo intent stamped in metadata so that
      // when fulfillInvoice runs (after ANY payment method clears it), the
      // case "unilevel_plus" branch triggers activateComboFreeFirstMonth.
      let invoice;
      try {
        invoice = await createInvoice({
          organizationId: me.orgId,
          sellerId: me.userId,
          userId: me.userId,
          customerEmail: orderUser?.email || "",
          lineItems: [{
            itemType: "unilevel_plus",
            itemId: plan._id.toString(),
            // Use bundlePlan.termMonths / bundlePlan.label — the raw
            // `termMonths` request param is undefined on the past-window
            // monthly branch (line ~750 above), which used to render as
            // "undefined months of NetworkChain".
            itemName: bundlePlan
              ? `${plan.name} + ${bundlePlan.label || `${bundlePlan.termMonths} month${bundlePlan.termMonths > 1 ? "s" : ""}`} of ${client.name}`
              : plan.name,
            itemDescription: bundlePlan
              ? `$${licenceUsd} Unilevel Plus licence + ${bundlePlan.label || `${bundlePlan.termMonths}-month`} ${client.productConfig.productCode} subscription ($${bundleSubUsd})${grantFreeMonth ? ", with the first month free" : ""}`
              : plan.description,
            quantity: 1,
            unitPrice: unitAmountInSmallestUnit,
            originalCurrency: plan.currency || "USD",
          }],
          itemCurrency: plan.currency || "USD",
          tax: comboUpTaxAmount,
          metadata: {
            type: "unilevel_plus_activation",
            quantity: 1,
            combo: {
              thirdPartyClientId,
              productCode: client.productConfig.productCode,
              clientName: client.name,
              // Carried through fulfillInvoice into activateComboFreeFirstMonth,
              // which queues it as pendingTermMonths on the $0 parent so cycle 2
              // bills at the chosen term.
              ...(termMonths ? { termMonths } : {}),
              // Decided HERE, at checkout, and carried through fulfilment.
              // Re-evaluating the window at fulfilment time would let a payment
              // that took longer than the remaining window silently lose the
              // free month the buyer was quoted.
              freeFirstCycle: grantFreeMonth,
              offerWindowExpiresAt: offerWindow.expiresAt?.toISOString(),
            },
            // BUNDLE SPLIT — load-bearing in two places:
            //   1. fulfillInvoice's `unilevel_plus` case reads `licenceUsd` to
            //      pin UP commission to $25 rather than the cart total.
            //   2. comboActivation reads `subUsd` to mint the prepaid cycle and
            //      to tell the distributor what revenue to split.
            ...(bundlePlan
              ? {
                  bundle: {
                    licenceUsd,
                    subUsd: bundleSubUsd,
                    termMonths: bundlePlan.termMonths,
                    thirdPartyClientId,
                    standaloneUsd: bundlePlan.standaloneAmount,
                  },
                }
              : {}),
            ...(comboGstLine.gstMetadata
              ? {
                  gst: {
                    ...comboGstLine.gstMetadata,
                    buyerCountry: comboGstRegion.country,
                    buyerRegion: "IN" as const,
                    regionSource: comboGstRegion.source,
                  },
                }
              : {
                  gstSkipped: gstSkippedMetadata(
                    comboGstRegion,
                    "buyer_outside_india"
                  ),
                }),
          },
        });
      } catch (invoiceError: any) {
        console.error("[UnilevelPlus/Combo] Invoice creation error:", invoiceError);
        return res.status(500).json({
          success: false,
          error: "invoice_creation_failed",
          details: invoiceError?.message || String(invoiceError),
        });
      }

      res.json({
        success: true,
        invoice: {
          _id: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          itemCurrency: invoice.itemCurrency,
          status: invoice.status,
        },
        plan: {
          name: plan.name,
          productPrice: plan.productPrice,
          currency: plan.currency,
        },
        combo: {
          clientName: client.name,
          productCode: client.productConfig.productCode,
          recurringPeriod: client.productConfig.recurringPeriod,
          // Must mirror what was actually stamped on the invoice
          // (metadata.combo.freeFirstCycle = grantFreeMonth). This was
          // hardcoded true, so a buyer past the 24h window — who is being
          // charged for month 1 — got a success payload telling them the month
          // was free. Billing was always correct; only this response lied, and
          // anything rendering a confirmation from it repeated the lie.
          freeFirstCycle: grantFreeMonth,
          fullPriceFromCycle2: client.productConfig.totalAmount,
          selectedTermMonths: termMonths || 1,
          // What the cart actually covers, when a term was bundled in.
          bundle: bundlePlan
            ? {
                licenceUsd,
                subscriptionUsd: bundleSubUsd,
                cartUsd,
                termMonths: bundlePlan.termMonths,
                standaloneUsd: bundlePlan.standaloneAmount,
                savingUsd:
                  Math.round(
                    (bundlePlan.standaloneAmount - bundleSubUsd) * 100
                  ) / 100,
                // Free month first, then the paid term — but only when the
                // free month was actually granted. Past the window the buyer
                // pays for every month in the term, so the +1 does not apply.
                monthsOfAccess: grantFreeMonth
                  ? bundlePlan.termMonths + 1
                  : bundlePlan.termMonths,
                renewsAtUsd: bundlePlan.standaloneAmount,
              }
            : null,
          // Catalog for the picker — the prices available RIGHT NOW.
          //
          // Must follow the same window branch the pricing above used, or the
          // response contradicts itself: bundle mode drops the 1-month row
          // (thirdPartyTerms.ts:190), so a past-window monthly buyer who was
          // just charged $61 got back a catalog that didn't contain the plan
          // they bought. Standalone mode past the window includes it.
          terms: listActiveTermPlans(
            client.productConfig,
            grantFreeMonth ? "bundle" : "standalone",
          ).map((t) => ({
            termMonths: t.termMonths,
            label:
              t.label || `${t.termMonths} month${t.termMonths > 1 ? "s" : ""}`,
            // sellAmount is the subscription portion; the cart adds the licence.
            cartTotal: Math.round((licenceUsd + t.sellAmount) * 100) / 100,
            cartTotalCents: Math.round((licenceUsd + t.sellAmount) * 100),
            subscriptionUsd: t.sellAmount,
            standaloneUsd: t.standaloneAmount,
            savingUsd:
              Math.round((t.standaloneAmount - t.sellAmount) * 100) / 100,
          })),
        },
        nextSteps: {
          paymentOptions: "GET /api/invoices/payment-options",
          payWithCardOrCrypto: `POST /api/invoices/${invoice._id}/select-payment`,
          payWithWallet: `POST /api/invoices/${invoice._id}/pay-with-wallet`,
        },
      });
    } catch (error) {
      console.error("Error creating UP combo invoice:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create combo invoice",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * POST /unilevel-plus/checkout/claim-free-month
 *
 * For users who ALREADY own Unilevel Plus but have never redeemed the combo.
 * They must not be re-charged $25 for UP just to claim the free NC month — the
 * $25 combo (create-combo-invoice) is only sensible for users who still need
 * UP. This grants the $0 free first cycle directly by calling
 * activateComboFreeFirstMonth standalone (no UP invoice, no payment). Same
 * one-time gate (metadata.kind="combo_free_first_month") and idempotency
 * (thirdPartyExternalId="combo_free_first_month_<userId>") as the paid combo.
 */
router.post(
  "/checkout/claim-free-month",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };

      const schema = z.object({
        thirdPartyClientId: z.string().min(1),
        productCode: z.string().min(1).optional(),
        // Term for the ONGOING subscription (cycle 2 onward). The combo's own
        // first cycle is always 1 free month regardless of what's chosen here.
        termMonths: z.number().int().min(1).max(60).optional(),
      });
      const { thirdPartyClientId, productCode, termMonths } = schema.parse(
        req.body
      );

      if (!Types.ObjectId.isValid(thirdPartyClientId)) {
        return res.status(400).json({
          success: false,
          error: "invalid_third_party_client_id",
        });
      }

      // (1) Must ALREADY own UP. Users without UP should buy the $25 combo
      // (create-combo-invoice), which grants UP + the free month together.
      const purchase = await getUserPurchase(me.userId);
      if (!purchase) {
        return res.status(400).json({
          success: false,
          error: "no_unilevel_plus",
          message:
            "You don't own Unilevel Plus yet. Use the $25 combo to get Unilevel Plus and your free NetworkChains month together.",
        });
      }

      // (2) Combo not already used (one-time globally per user — matches the
      // externalId/kind stamped by activateComboFreeFirstMonth).
      const priorCombo = await Invoice.findOne({
        userId: new Types.ObjectId(me.userId),
        "metadata.kind": "combo_free_first_month",
      }).lean();
      if (priorCombo) {
        return res.status(409).json({
          success: false,
          error: "combo_already_used",
          message: "You have already used the free-first-month offer.",
        });
      }

      // (2b) The 24-hour offer window must still be open.
      //
      // Unlike create-combo-invoice this IS a hard rejection: this route grants
      // a free month and collects nothing, so there is no paid variant of it to
      // fall through to. The buyer subscribes at full price instead, via
      // POST /unilevel-plus/checkout/subscribe.
      const claimBuyer = await User.findById(me.userId)
        .select({ profileCompletedAt: 1, offerExpiresAtOverride: 1 })
        .lean();
      const claimWindow = comboWindowFor(claimBuyer);
      if (!claimWindow.open) {
        return res.status(409).json({
          success: false,
          error: "combo_window_expired",
          message:
            "The free-first-month offer expired 24 hours after you completed your profile. You can still subscribe at the standard price.",
          window: claimWindow,
        });
      }

      // (3) Partner is eligible
      const client = await ThirdPartyClient.findById(thirdPartyClientId);
      if (!client || !client.isActive || !client.productConfig?.recurringPeriod) {
        return res.status(404).json({
          success: false,
          error: "client_not_eligible",
          message: "Third-party client is missing, inactive, or not subscription-enabled.",
        });
      }
      if (productCode && productCode !== client.productConfig.productCode) {
        return res.status(400).json({
          success: false,
          error: "product_code_mismatch",
          message: `productCode "${productCode}" does not match this client's configured product "${client.productConfig.productCode}".`,
        });
      }

      // triggerInvoiceId is metadata-only (traceability). Reference the user's
      // existing paid UP invoice when we can find one; otherwise a synthetic
      // marker so the field is never empty (e.g. UP granted via reserve
      // assignment, which has no paid invoice of the buyer's own).
      const upInvoice = await Invoice.findOne({
        userId: new Types.ObjectId(me.userId),
        "lineItems.itemType": "unilevel_plus",
        status: "paid",
      })
        .sort({ paidAt: -1 })
        .select({ _id: 1 })
        .lean();
      const triggerInvoiceId = upInvoice
        ? upInvoice._id.toString()
        : `existing_up_${me.userId}`;

      const result = await activateComboFreeFirstMonth({
        buyerId: me.userId,
        clientId: thirdPartyClientId,
        productCode: client.productConfig.productCode,
        triggerInvoiceId,
        nextTermMonths: termMonths,
      });

      res.json({
        success: true,
        subscriptionActivated: true,
        alreadyExisted: result.alreadyExisted,
        invoice: {
          _id: result.invoice._id.toString(),
          invoiceNumber: result.invoice.invoiceNumber,
          status: result.invoice.status,
        },
        combo: {
          clientName: client.name,
          productCode: client.productConfig.productCode,
          recurringPeriod: client.productConfig.recurringPeriod,
          freeFirstCycle: true,
          fullPriceFromCycle2: client.productConfig.totalAmount,
          // Term selected for the ongoing subscription (cycle 2 onward), plus
          // the catalog so the UI can render the picker.
          //
          // STANDALONE prices only. Bundle pricing requires a live $25 payment
          // in the cart; this route is for buyers who already own the licence
          // and are claiming their free month without paying again.
          selectedTermMonths: termMonths || 1,
          bundleEligible: false,
          terms: listActiveTermPlans(client.productConfig).map((t) => ({
            termMonths: t.termMonths,
            label:
              t.label || `${t.termMonths} month${t.termMonths > 1 ? "s" : ""}`,
            totalAmount: t.totalAmount,
            totalAmountCents: Math.round(t.totalAmount * 100),
            monthlyEquivalent:
              Math.round((t.totalAmount / t.termMonths) * 100) / 100,
          })),
        },
      });
    } catch (error: any) {
      // ThirdPartyError carries a statusCode; surface it when present.
      const status = typeof error?.statusCode === "number" ? error.statusCode : 500;
      console.error("Error claiming free NetworkChains month:", error);
      res.status(status).json({
        success: false,
        error: error?.code || "claim_free_month_failed",
        message: error?.message || "Failed to claim your free month.",
      });
    }
  }
);

/**
 * POST /unilevel-plus/checkout/subscribe
 *
 * The paid counterpart to claim-free-month: for users who already own Unilevel
 * Plus but are PAST the 24-hour free-first-month window (or have already used
 * it). No licence is charged — just the subscription, at standalone price.
 *
 * Unlike the combo paths this mints an ordinary third-party subscription
 * invoice with a real `totalAmount`. The buyer pays it through the normal
 * invoice flow, and fulfilment distributes commission the ordinary way because
 * there is nothing $0 about it — no `freeFirstCycle`, no `prepaidViaBundle`.
 */
router.post(
  "/checkout/subscribe",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };

      const schema = z.object({
        thirdPartyClientId: z.string().min(1),
        productCode: z.string().min(1).optional(),
        termMonths: z.number().int().positive().optional(),
      });
      const { thirdPartyClientId, productCode, termMonths } = schema.parse(
        req.body
      );

      const client = await ThirdPartyClient.findById(thirdPartyClientId);
      if (!client || !client.isActive || !client.productConfig?.recurringPeriod) {
        return res.status(404).json({
          success: false,
          error: "client_not_eligible",
          message:
            "Third-party client is missing, inactive, or not subscription-enabled.",
        });
      }
      if (productCode && productCode !== client.productConfig.productCode) {
        return res.status(400).json({
          success: false,
          error: "product_code_mismatch",
          message: `productCode "${productCode}" does not match this client's configured product "${client.productConfig.productCode}".`,
        });
      }

      // Standalone pricing: bundle rates require the $25 licence in the same
      // cart, and this route deliberately doesn't charge for one.
      let termPlan: ReturnType<typeof resolveTermPlan>;
      try {
        termPlan = resolveTermPlan(client.productConfig, termMonths || 1);
      } catch (termErr: any) {
        return res.status(400).json({
          success: false,
          error: "invalid_term",
          message: termErr?.message || "Unsupported subscription term",
        });
      }

      // Already covered? Re-subscribing on top of a live chain would create a
      // second billing root for the same product.
      const liveRoot = await Invoice.findOne({
        userId: new Types.ObjectId(me.userId),
        thirdPartyClientId: client._id,
        parentInvoiceId: { $exists: false },
        cancelledAt: null,
        nextDueDate: { $gt: new Date() },
      })
        .select({ _id: 1, invoiceNumber: 1, nextDueDate: 1 })
        .lean();
      if (liveRoot) {
        return res.status(409).json({
          success: false,
          error: "already_subscribed",
          message: `You already have an active ${client.name} subscription until ${liveRoot.nextDueDate?.toISOString()}.`,
          invoiceNumber: liveRoot.invoiceNumber,
        });
      }

      // Reuse an unpaid invoice rather than minting a second one on a
      // double-submit. Only ever one open subscription invoice per user+client.
      const pending = await Invoice.findOne({
        userId: new Types.ObjectId(me.userId),
        thirdPartyClientId: client._id,
        parentInvoiceId: { $exists: false },
        status: { $in: ["draft", "pending", "sent"] },
      })
        .sort({ createdAt: -1 })
        .lean();

      const buyer = await User.findById(me.userId).select("email").lean();
      if (!buyer?.email) {
        return res.status(404).json({
          success: false,
          error: "buyer_not_found",
          message: "Your account has no email address.",
        });
      }

      const invoice = pending
        ? await Invoice.findById(pending._id)
        : await createThirdPartyInvoice({
            client,
            customerEmail: buyer.email,
            productCode: client.productConfig.productCode,
            termMonths: termPlan.termMonths,
            externalId: `nc_standalone_${me.userId}_${Date.now()}`,
            metadata: {
              userId: me.userId,
              source: "unilevel_plus_standalone_subscribe",
            },
          });

      return res.json({
        success: true,
        reusedPendingInvoice: !!pending,
        invoice: {
          _id: invoice!._id.toString(),
          invoiceNumber: invoice!.invoiceNumber,
          status: invoice!.status,
          totalAmount: invoice!.totalAmount,
          currency: invoice!.itemCurrency,
        },
        subscription: {
          clientName: client.name,
          productCode: client.productConfig.productCode,
          termMonths: termPlan.termMonths,
          priceUsd: termPlan.totalAmount,
          freeFirstCycle: false,
        },
        next: {
          payWithWallet: `POST /api/invoices/${invoice!._id}/pay-with-wallet`,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, error: "validation_error", details: error.issues });
      }
      const status =
        typeof error?.statusCode === "number" ? error.statusCode : 500;
      console.error("Error creating standalone NetworkChain subscription:", error);
      res.status(status).json({
        success: false,
        error: error?.code || "subscribe_failed",
        message: error?.message || "Failed to create your subscription.",
      });
    }
  }
);

/**
 * POST /unilevel-plus/checkout/verify-payment
 * Verify Razorpay payment, activate user, distribute commissions
 */
router.post(
  "/checkout/verify-payment",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };

      const schema = z.object({
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      });

      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
        schema.parse(req.body);

      // Verify signature
      const isValid = verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      if (!isValid) {
        return res
          .status(400)
          .json({ success: false, error: "Payment verification failed" });
      }

      // If the user already has Unilevel Plus, this verify-payment call is
      // either a duplicate (frontend defensive re-call) or the user is
      // buying additional reserve licenses through the invoice flow. Either
      // way the activation step is a no-op — the invoice/webhook
      // fulfillment is the source of truth for any reserve licenses tied
      // to this Razorpay payment. Return success so the frontend doesn't
      // mistakenly alarm a buyer whose payment actually completed cleanly.
      const existingPurchase = await getUserPurchase(me.userId);
      if (existingPurchase) {
        return res.json({
          success: true,
          message:
            "Plan already activated. Any additional licenses from this payment are issued by the invoice flow.",
          activated: true,
          alreadyActivated: true,
        });
      }

      // Get active plan
      const plan = await getActiveUnilevelPlusPlan();
      if (!plan) {
        return res.status(404).json({
          success: false,
          error: "No active plan found",
        });
      }

      // Create purchase record
      await UnilevelPlusPurchase.create({
        userId: new Types.ObjectId(me.userId),
        planId: plan._id,
        paymentId: razorpayPaymentId,
        amount: plan.productPrice,
        currency: plan.currency,
        status: "active",
        purchasedAt: new Date(),
        metadata: {
          razorpayOrderId,
          orgId: me.orgId,
        },
      });

      // Downline-table Type column: this activates "1Network Activated". Fire-and-forget.
      void refreshTypeFlags(me.userId);

      // Distribute commissions
      try {
        await distributeUnilevelPlusCommission({
          buyerId: me.userId,
          planId: plan._id.toString(),
          saleAmount: plan.productPrice,
          currency: plan.currency,
          paymentId: razorpayPaymentId,
          metadata: {
            razorpayOrderId,
            source: "unilevel_plus_checkout",
          },
        });
      } catch (commissionError) {
        console.error(
          "Error distributing unilevel plus commissions:",
          commissionError
        );
      }

      // Set isGarageAffiliate on Bat246Distributor so the progress bar updates immediately
      try {
        const { Bat246Distributor } = await import("../bat246/models/bat246Distributor.model");
        const distDoc = await Bat246Distributor.findOneAndUpdate(
          { userId: new Types.ObjectId(me.userId) },
          { $setOnInsert: { isOfficeMember: false, hasBat246Membership: false, hasPurchasedProduct: false, isQualified: false } },
          { upsert: true, new: true, lean: true, setDefaultsOnInsert: false }
        ) as any;
        if (distDoc) {
          const isNowQualified = !!(distDoc.isOfficeMember && distDoc.hasBat246Membership && distDoc.hasPurchasedProduct);
          const upd: any = { isGarageAffiliate: true };
          if (!distDoc.isQualified && isNowQualified) { upd.isQualified = true; upd.qualifiedAt = new Date(); }
          await Bat246Distributor.updateOne({ userId: new Types.ObjectId(me.userId) }, upd);
          if (!distDoc.isQualified && isNowQualified) {
            try {
              const { maybeCreatePlacementNotification } = await import("../bat246/services/bat246.service");
              const { assignDistributorId } = await import("../bat246/services/bat246DistributorId.util");
              await assignDistributorId(me.userId).catch((err: any) => console.error("[bat246] assignDistributorId failed:", err.message));
              await maybeCreatePlacementNotification(me.userId);
            } catch { /* non-fatal */ }
          }
          // Notify upline that this user purchased Unilevel Plus ($25)
          if (distDoc.bat246RefUserId) {
            try {
              const { Bat246PlacementNotification: BPN } = await import("../bat246/models/bat246PlacementNotifications.model");
              const buyerUser = await User.findById(me.userId).select("name email").lean() as any;
              await BPN.create({ notificationType: "affiliate", qualifiedUserId: new Types.ObjectId(me.userId), qualifiedUserEmail: buyerUser?.email || "", qualifiedUserName: buyerUser?.name || "", uplineUserId: distDoc.bat246RefUserId });
            } catch { /* non-fatal */ }
          }
        }
      } catch { /* non-fatal */ }

      // Combo offer: if the originating invoice has metadata.combo set, issue
      // the $0 first-cycle third-party invoice. Failure is non-fatal — UP is
      // already activated; we log + stamp the UP invoice with the failure
      // reason so the admin retry endpoint can replay it.
      try {
        const upInvoice = await Invoice.findOne({ razorpayOrderId });
        const combo = (upInvoice?.metadata as any)?.combo as
          | { thirdPartyClientId: string; productCode?: string }
          | undefined;
        if (upInvoice && combo?.thirdPartyClientId) {
          try {
            const result = await activateComboFreeFirstMonth({
              buyerId: me.userId,
              clientId: combo.thirdPartyClientId,
              productCode: combo.productCode,
              triggerInvoiceId: upInvoice._id.toString(),
              nextTermMonths: (combo as any).termMonths,
              bundle: (upInvoice.metadata as any)?.bundle,
            });
            await Invoice.updateOne(
              { _id: upInvoice._id },
              {
                $set: {
                  "metadata.comboCompletedAt": new Date(),
                  "metadata.comboInvoiceId": result.invoice._id.toString(),
                  "metadata.comboAlreadyExisted": result.alreadyExisted,
                },
                $unset: { "metadata.comboFailureReason": "" },
              }
            );
          } catch (comboErr: any) {
            console.error(
              "[UnilevelPlus/Combo] activateComboFreeFirstMonth failed (verify-payment path):",
              comboErr
            );
            await Invoice.updateOne(
              { _id: upInvoice._id },
              {
                $set: {
                  "metadata.comboFailureReason":
                    comboErr?.message || String(comboErr),
                  "metadata.comboFailedAt": new Date(),
                },
              }
            );
          }
        }
      } catch (lookupErr) {
        // Invoice lookup itself failed — log only, don't surface to user.
        console.error(
          "[UnilevelPlus/Combo] Invoice lookup by razorpayOrderId failed:",
          lookupErr
        );
      }

      res.json({
        success: true,
        message: "Plan activated successfully",
        activated: true,
      });
    } catch (error) {
      console.error("Error verifying unilevel plus payment:", error);
      res.status(500).json({
        success: false,
        error: "Failed to verify payment",
        details: (error as Error).message,
      });
    }
  }
);

// ============= Commission History =============

/**
 * GET /unilevel-plus/commissions/my-history
 * Get current user's commission history
 */
router.get(
  "/commissions/my-history",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };

      const schema = z.object({
        limit: z
          .string()
          .optional()
          .transform((v) => (v ? parseInt(v, 10) : 50)),
        offset: z
          .string()
          .optional()
          .transform((v) => (v ? parseInt(v, 10) : 0)),
      });

      const options = schema.parse(req.query);
      const result = await getUPCommissionHistory(me.userId, options);

      res.json({
        success: true,
        distributions: result.distributions,
        total: result.total,
        limit: options.limit,
        offset: options.offset,
      });
    } catch (error) {
      console.error("Error getting UP commission history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get commission history",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * GET /unilevel-plus/commissions/stats
 * Get current user's aggregate commission stats
 */
router.get(
  "/commissions/stats",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };
      const stats = await getUPCommissionStats(me.userId);
      res.json({ success: true, stats });
    } catch (error) {
      console.error("Error getting UP commission stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get commission stats",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * GET /unilevel-plus/commissions/distribution/:id
 * Get a single distribution detail
 */
router.get(
  "/commissions/distribution/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const distribution = await UnilevelPlusDistribution.findById(
        req.params.id
      )
        .populate("buyerId", "name email profilePicture")
        .populate("directBonusRecipientId", "name email profilePicture")
        .populate("levelBonusRecipients.userId", "name email profilePicture")
        .populate(
          "infinityTier1Recipients.userId",
          "name email profilePicture"
        )
        .populate(
          "infinityTier2Recipients.userId",
          "name email profilePicture"
        )
        .lean();

      if (!distribution) {
        return res
          .status(404)
          .json({ success: false, error: "Distribution not found" });
      }

      res.json({ success: true, distribution });
    } catch (error) {
      console.error("Error getting UP distribution:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get distribution",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * GET /unilevel-plus/network/legs
 * Get user's legs overview (direct referrals with leg info)
 */
router.get(
  "/network/legs",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };

      // Get direct referrals ordered by createdAt (= leg order)
      const directReferrals = await User.find({
        referredBy: new Types.ObjectId(me.userId),
      })
        .sort({ createdAt: 1 })
        .select("_id name email profilePicture createdAt")
        .lean();

      // For each leg, count the total downline size
      const legs = await Promise.all(
        directReferrals.map(async (ref, index) => {
          // Count all users in this leg's subtree (BFS)
          let downlineCount = 0;
          const queue = [ref._id.toString()];
          const visited = new Set<string>();

          while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const children = await User.find({
              referredBy: new Types.ObjectId(currentId),
            })
              .select("_id")
              .lean();

            downlineCount += children.length;
            for (const child of children) {
              queue.push(child._id.toString());
            }
          }

          return {
            legNumber: index + 1,
            user: {
              _id: ref._id,
              name: ref.name,
              email: ref.email,
              profilePicture: ref.profilePicture,
              joinedAt: ref.createdAt,
            },
            downlineCount,
          };
        })
      );

      res.json({
        success: true,
        totalLegs: legs.length,
        legs,
      });
    } catch (error) {
      console.error("Error getting UP network legs:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get network legs",
        details: (error as Error).message,
      });
    }
  }
);

// ============= Reserve Licenses =============

/**
 * GET /unilevel-plus/reserve
 * List user's reserve licenses
 */
router.get(
  "/reserve",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { getReserveLicenses } = await import("../services/reserveLicense");

      const status = req.query.status as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await getReserveLicenses(me.userId, { status, limit, offset });

      res.json({
        success: true,
        licenses: result.licenses,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      console.error("Error fetching reserve licenses:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch reserve licenses",
      });
    }
  }
);

/**
 * GET /unilevel-plus/reserve/stats
 * Quick stats for the reserve tab
 */
router.get(
  "/reserve/stats",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { getReserveStats } = await import("../services/reserveLicense");

      const stats = await getReserveStats(me.userId);
      res.json({ success: true, ...stats });
    } catch (error) {
      console.error("Error fetching reserve stats:", error);
      res.status(500).json({ success: false, error: "Failed to fetch stats" });
    }
  }
);

/**
 * POST /unilevel-plus/reserve/:licenseId/assign
 * Assign a reserve license to a target user
 */
router.post(
  "/reserve/:licenseId/assign",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { licenseId } = req.params;
      const { userId: targetUserId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          error: "userId is required",
        });
      }

      // Verify target user exists
      const targetUser = await User.findById(targetUserId)
        .select("name email")
        .lean();
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: "Target user not found",
        });
      }

      const { assignReserveLicense } = await import("../services/reserveLicense");
      const result = await assignReserveLicense(licenseId, me.userId, targetUserId);

      res.json({
        success: true,
        license: result.license,
        purchase: {
          _id: result.purchase._id,
          userId: targetUserId,
          status: result.purchase.status,
        },
        assignedTo: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
        },
      });
    } catch (error: any) {
      console.error("Error assigning reserve license:", error);

      const statusCode =
        error.message?.includes("not found") || error.message?.includes("doesn't belong")
          ? 404
          : error.message?.includes("already")
          ? 409
          : 400;

      res.status(statusCode).json({
        success: false,
        error: error.message || "Failed to assign license",
      });
    }
  }
);

/**
 * GET /unilevel-plus/users/search
 * Search users for license assignment (shows if they already have UP)
 */
router.get(
  "/users/search",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string" || q.length < 2) {
        return res.json({ success: true, users: [] });
      }

      const regex = new RegExp(q, "i");
      const users = await User.find({
        $or: [{ name: regex }, { email: regex }, { phone: regex }],
      })
        .select("_id name email profilePicture")
        .limit(20)
        .lean();

      // Check UP status for each user
      const userIds = users.map((u) => u._id);
      const purchases = await UnilevelPlusPurchase.find({
        userId: { $in: userIds },
        status: "active",
      })
        .select("userId")
        .lean();

      const purchasedUserIds = new Set(
        purchases.map((p) => p.userId.toString())
      );

      const results = users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        profilePicture: u.profilePicture,
        hasUnilevelPlus: purchasedUserIds.has(u._id.toString()),
      }));

      res.json({ success: true, users: results });
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search users",
      });
    }
  }
);

/**
 * GET /unilevel-plus/checkout/combo-status/:upInvoiceId
 *
 * Poll-after-payment endpoint. Returns the activation status of BOTH pieces
 * of the combo offer (Unilevel Plus + free-first-cycle third-party sub) so
 * the FE can confirm success or surface a useful error.
 *
 * The buyer must own the invoice. Safe to poll — read-only.
 */
router.get(
  "/checkout/combo-status/:upInvoiceId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { upInvoiceId } = req.params;

      if (!Types.ObjectId.isValid(upInvoiceId)) {
        return res.status(400).json({ success: false, error: "invalid_invoice_id" });
      }

      const upInvoice = await Invoice.findById(upInvoiceId).lean();
      if (!upInvoice) {
        return res.status(404).json({ success: false, error: "invoice_not_found" });
      }
      if (upInvoice.userId.toString() !== me.userId) {
        return res.status(403).json({ success: false, error: "not_your_invoice" });
      }

      const md = (upInvoice.metadata || {}) as any;
      const combo = md.combo as
        | { thirdPartyClientId?: string; productCode?: string; clientName?: string }
        | undefined;
      if (!combo?.thirdPartyClientId) {
        return res.status(400).json({
          success: false,
          error: "not_a_combo_invoice",
          message: "This invoice was not created via the combo flow.",
        });
      }

      // UP activation status — source of truth is UnilevelPlusPurchase
      const upPurchase = await getUserPurchase(me.userId);

      // Combo invoice — lookup by the deterministic externalId stamped during
      // activation (matches one-time-global eligibility gate).
      const comboInvoice = await Invoice.findOne({
        thirdPartyClientId: new Types.ObjectId(combo.thirdPartyClientId),
        thirdPartyExternalId: `combo_free_first_month_${me.userId}`,
      }).lean();

      // Overall state — used by FE to decide whether to keep polling, show
      // success, or surface an error
      let overall: "pending_payment" | "pending_combo" | "success" | "failed";
      if (upInvoice.status !== "paid") {
        overall = "pending_payment";
      } else if (!upPurchase) {
        // Paid but UP record missing — fulfillment hasn't run yet (race
        // window between mark-paid and fulfillInvoice). Keep polling.
        overall = "pending_combo";
      } else if (comboInvoice && comboInvoice.status === "paid") {
        overall = "success";
      } else if (md.comboFailureReason) {
        overall = "failed";
      } else {
        // UP active but combo invoice not yet created — fulfillInvoice may
        // still be running, or it ran and failed silently. Keep polling.
        overall = "pending_combo";
      }

      res.json({
        success: true,
        overall,
        upInvoice: {
          _id: upInvoice._id.toString(),
          invoiceNumber: upInvoice.invoiceNumber,
          status: upInvoice.status,
          totalAmount: upInvoice.totalAmount,
          itemCurrency: upInvoice.itemCurrency,
          paidAt: upInvoice.paidAt || null,
          paymentMethodCategory: upInvoice.paymentMethodCategory || null,
          paymentPlatform: upInvoice.paymentPlatform || null,
        },
        unilevelPlus: upPurchase
          ? {
              activated: true,
              purchaseId: upPurchase._id.toString(),
              activatedAt: upPurchase.purchasedAt,
              status: upPurchase.status,
            }
          : { activated: false },
        thirdParty: {
          clientName: combo.clientName,
          productCode: combo.productCode,
          activated: !!(comboInvoice && comboInvoice.status === "paid"),
          comboInvoice: comboInvoice
            ? {
                _id: comboInvoice._id.toString(),
                invoiceNumber: comboInvoice.invoiceNumber,
                status: comboInvoice.status,
                totalAmount: comboInvoice.totalAmount,
                isRecurring: comboInvoice.isRecurring,
                recurringPeriod: comboInvoice.recurringPeriod || null,
                nextDueDate: comboInvoice.nextDueDate || null,
                paidAt: comboInvoice.paidAt || null,
              }
            : null,
          completedAt: md.comboCompletedAt || null,
          failureReason: md.comboFailureReason || null,
          failedAt: md.comboFailedAt || null,
        },
      });
    } catch (error: any) {
      console.error("[UnilevelPlus/Combo] combo-status failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch combo status",
        details: error?.message || String(error),
      });
    }
  }
);

/**
 * POST /unilevel-plus/checkout/retry-combo/:upInvoiceId
 *
 * Internal admin endpoint to retry the combo free-first-month activation when
 * the auto-trigger (in verify-payment + fulfillInvoice) failed for a UP
 * invoice. Reads the combo intent from invoice.metadata.combo and re-runs
 * activateComboFreeFirstMonth — which is idempotent on (clientId, externalId)
 * so re-runs are safe even if the combo invoice already exists.
 */
router.post(
  "/checkout/retry-combo/:upInvoiceId",
  requireInternalKey,
  async (req: Request, res: Response) => {
    try {
      const { upInvoiceId } = req.params;
      if (!Types.ObjectId.isValid(upInvoiceId)) {
        return res.status(400).json({ success: false, error: "invalid_invoice_id" });
      }

      const upInvoice = await Invoice.findById(upInvoiceId);
      if (!upInvoice) {
        return res.status(404).json({ success: false, error: "invoice_not_found" });
      }

      const combo = (upInvoice.metadata as any)?.combo as
        | { thirdPartyClientId?: string; productCode?: string }
        | undefined;
      if (!combo?.thirdPartyClientId) {
        return res.status(400).json({
          success: false,
          error: "not_a_combo_invoice",
          message: "This UP invoice was not created via the combo flow.",
        });
      }

      if ((upInvoice.metadata as any)?.comboCompletedAt) {
        return res.status(409).json({
          success: false,
          error: "combo_already_completed",
          message: "The combo activation has already completed for this invoice.",
          comboInvoiceId: (upInvoice.metadata as any)?.comboInvoiceId,
        });
      }

      const result = await activateComboFreeFirstMonth({
        buyerId: upInvoice.userId.toString(),
        clientId: combo.thirdPartyClientId,
        productCode: combo.productCode,
        triggerInvoiceId: upInvoice._id.toString(),
        nextTermMonths: (combo as any).termMonths,
        bundle: (upInvoice.metadata as any)?.bundle,
      });

      await Invoice.updateOne(
        { _id: upInvoice._id },
        {
          $set: {
            "metadata.comboCompletedAt": new Date(),
            "metadata.comboInvoiceId": result.invoice._id.toString(),
            "metadata.comboAlreadyExisted": result.alreadyExisted,
          },
          $unset: { "metadata.comboFailureReason": "" },
        }
      );

      res.json({
        success: true,
        comboInvoiceId: result.invoice._id.toString(),
        alreadyExisted: result.alreadyExisted,
      });
    } catch (error: any) {
      console.error("[UnilevelPlus/Combo] retry-combo failed:", error);
      res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.code || "retry_failed",
        details: error?.message || String(error),
      });
    }
  }
);

export default router;
