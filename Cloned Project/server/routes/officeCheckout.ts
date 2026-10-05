import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { refreshTypeFlags } from "../services/downlineTree";
import { hasFounderAccess } from "../utils/accessCheck";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { Types } from "mongoose";
import {
  getOfficePlans,
  getOfficePlanBySlug,
  createOfficeSubscription,
  getOfficeSubscription,
  hasActiveOfficeSubscription,
  syncOfficeSubscriptionStatus,
  calculateUpgradePreview,
  initiateOfficeUpgrade,
  calculateDowngradePreview,
  initiateOfficeDowngrade,
  getOfficeUpgradeHistory,
  getTrialInfo,
  getSubscriptionRecoveryInfo,
} from "../services/officeSubscription";
import { getSocketInstance } from "../services/socket";
import {
  fetchSubscription,
  createPlan as createRazorpayPlan,
  createSubscription as createRazorpaySubscription,
  cancelSubscription,
} from "../services/razorpay";
import { calculateTaxAmounts, GST_CONFIG, OfficePlan } from "../models/officePlan.model";
import { applyGstToLine } from "../utils/gstTax";
import {
  resolveOrgGstRegion,
  gstSkippedMetadata,
} from "../utils/gstBuyerRegion";
import { createInvoice, getNextChargeDate } from "../services/invoice";
import { OfficeSubscription } from "../models/officeSubscription.model";
import { Invoice } from "../models/invoice.model";
import { ConferenceRoom } from "../models/conferenceRoom.model";
import { CouponUsage } from "../models/couponUsage.model";

// $5/month per extra conference room. Kept in lockstep with the FE copy
// on /office-payment. When we extract a pricing config module, move this
// constant there and import from both places.
const CONFERENCE_ROOM_PRICE_CENTS = 500;
import {
  validateCoupon,
  recordCouponUsage,
  markUsageApplied,
  markUsageFailed,
} from "../services/coupon";

// GSTIN validation regex: 22AAAAA0000A1Z5 format
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const router = Router();

/**
 * GET /checkout/office/plans
 * Get all available office plans (public)
 * Includes GST breakdown for each plan
 */
router.get("/plans", async (req: Request, res: Response) => {
  try {
    const plans = await getOfficePlans();

    // Format plans for frontend with GST breakdown.
    //
    // This endpoint is PUBLIC — there is no org and no signed-in user, so the
    // buyer's region cannot be resolved here. GST now applies only to orgs in
    // India, so we cannot assert a single "total": we return the base, the
    // rate, and BOTH totals, and let the caller label which one it is showing.
    // The authed `GET /:orgId` below knows the org and is region-aware.
    const formattedPlans = plans.map((plan) => {
      const taxRate = plan.taxRate ?? GST_CONFIG.rate;
      const taxInclusive = plan.taxInclusive ?? GST_CONFIG.taxInclusive;
      const { baseAmount, taxAmount, totalAmount } = calculateTaxAmounts(plan.amount, taxRate);

      return {
        _id: plan._id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        // Base amount (before GST)
        amount: baseAmount / 100,
        // GST details — applicable to buyers in India only.
        taxRate,
        taxInclusive,
        taxAmount: taxAmount / 100, // GST amount
        totalAmount: totalAmount / 100, // Total including GST in INR
        // Explicit both-values so no caller has to guess or recompute.
        totalWithGst: totalAmount / 100,
        totalWithoutGst: baseAmount / 100,
        gstAppliesTo: "IN" as const,
        currency: plan.currency,
        period: plan.period,
        features: plan.features,
        canInviteStakeholders: plan.canInviteStakeholders,
        maxStakeholders: plan.maxStakeholders,
        isDefault: plan.isDefault,
      };
    });

    res.json({ plans: formattedPlans });
  } catch (error) {
    console.error("Error fetching office plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

/**
 * GET /checkout/office/:orgId
 * Get organization info and subscription status (authenticated)
 */
router.get("/:orgId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string };

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get organization
    const org = await Organization.findById(orgId)
      .select("name icon coverPhoto")
      .lean();

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Get current subscription if any
    const subscription = await getOfficeSubscription(orgId);

    // Get plans
    const plans = await getOfficePlans();

    // Authed, so the org IS known — resolve the real GST region and return
    // figures that match what this org will actually be charged.
    const gstRegion = await resolveOrgGstRegion({
      orgId,
      subscriberUserId: user.userId,
      paymentCurrency: plans[0]?.currency || "USD",
    });

    res.json({
      gst: {
        applies: gstRegion.inIndia,
        buyerCountry: gstRegion.country,
        regionSource: gstRegion.source,
      },
      organization: {
        _id: org._id,
        name: org.name,
        icon: org.icon,
        coverPhoto: org.coverPhoto,
      },
      subscription: subscription
        ? {
            _id: subscription._id,
            status: subscription.status,
            planId: subscription.planId,
            currentEnd: subscription.currentEnd,
            shortUrl: subscription.shortUrl,
          }
        : null,
      plans: plans.map((plan) => {
        const taxRate = plan.taxRate ?? GST_CONFIG.rate;
        const taxInclusive = plan.taxInclusive ?? GST_CONFIG.taxInclusive;
        // Region-aware: a non-India org sees taxAmount 0 and total == base,
        // which is exactly what /subscribe will charge it.
        const line = applyGstToLine({
          listedAmountMinor: plan.amount,
          gstInclusive: false,
          buyerInIndia: gstRegion.inIndia,
          taxRate,
        });
        const baseAmount = line.lineUnitPrice;
        const taxAmount = line.taxTotal;
        const totalAmount = line.chargeTotal;

        return {
          _id: plan._id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          amount: baseAmount / 100,
          taxRate,
          taxInclusive,
          taxAmount: taxAmount / 100,
          totalAmount: totalAmount / 100,
          // Both figures so the UI can show "with GST / without GST".
          totalWithGst: (plan.amount + Math.round((plan.amount * taxRate) / 100)) / 100,
          totalWithoutGst: plan.amount / 100,
          currency: plan.currency,
          period: plan.period,
          features: plan.features,
          canInviteStakeholders: plan.canInviteStakeholders,
          maxStakeholders: plan.maxStakeholders,
          isDefault: plan.isDefault,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching office checkout info:", error);
    res.status(500).json({ error: "Failed to fetch checkout info" });
  }
});

/**
 * POST /checkout/office/:orgId/start-trial
 * Bootstrap a Pro-plan subscription for the org — creates the subscription
 * in `status: "created"` (unpaid) plus a recurring Pro invoice the founder
 * must pay to activate. Also mints a separate rooms invoice when the founder
 * picked > 1 conference room. NAME is legacy ("start-trial"); the trial
 * concept was removed — Pro bills from day 1. Response returns both invoice
 * ids so the FE can walk the founder through payment.
 * Only founders can call.
 */
router.post("/:orgId/start-trial", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string; role?: string };
    // Number of conference rooms the founder picked on the checkout page.
    // 1 is included free with the office. Anything above 1 (= extra rooms)
    // creates real ConferenceRoom rows AND a separate recurring invoice for
    // $5/room/month. Defaults to 1 so legacy clients that don't send the
    // field keep working with no surprise charges.
    const rawCount = Number(req.body?.totalRoomCount);
    const totalRoomCount =
      Number.isFinite(rawCount) && rawCount >= 1 ? Math.floor(rawCount) : 1;
    const extraRoomCount = Math.max(0, totalRoomCount - 1);

    // 1. Validate founder access
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if user is founder
    const userDoc = await User.findById(user.userId).lean();
    const orgMembership = userDoc?.organizations?.find(
      (o: any) => o.organization.toString() === orgId
    );
    if (!orgMembership || !hasFounderAccess(orgMembership)) {
      return res.status(403).json({ error: "Only founders can start trial" });
    }

    // 2. Check org is not a parent (already exempt)
    const org = await Organization.findById(orgId).select("parent").lean();
    if (org?.parent === true) {
      return res.status(400).json({ error: "Garage HQs are already unlocked" });
    }

    // 3. Check existing subscriptions
    const existingSubscription = await OfficeSubscription.findOne({
      orgId: new Types.ObjectId(orgId),
    });

    if (existingSubscription) {
      // Block if there's a genuinely active/paid subscription
      if (["authenticated", "active", "pending", "trial"].includes(existingSubscription.status)) {
        return res.status(400).json({
          error: "Organization already has an active subscription or trial"
        });
      }

      // Stale subscription (created, cancelled, halted, completed, paused, expired,
      // trial) — clean it up so we can bootstrap fresh. Trials from the
      // pre-removal era count as stale too now that the trial concept is gone.
      console.log(`[OfficeCheckout] Removing stale subscription ${existingSubscription._id} (status: ${existingSubscription.status}) to allow fresh Pro subscribe`);

      // Try to cancel in Razorpay if it was in "created" status
      if (existingSubscription.status === "created" && existingSubscription.razorpaySubscriptionId) {
        try {
          await cancelSubscription(existingSubscription.razorpaySubscriptionId, false);
          console.log(`[OfficeCheckout] Cancelled Razorpay subscription ${existingSubscription.razorpaySubscriptionId}`);
        } catch (err) {
          console.log(`[OfficeCheckout] Could not cancel Razorpay subscription (continuing anyway): ${err}`);
        }
      }

      // Mark any pending coupon usage as failed
      if (existingSubscription.razorpaySubscriptionId) {
        const updatedUsage = await CouponUsage.updateMany(
          {
            transactionId: existingSubscription.razorpaySubscriptionId,
            status: "pending",
          },
          { status: "failed" }
        );
        if (updatedUsage.modifiedCount > 0) {
          console.log(`[OfficeCheckout] Marked ${updatedUsage.modifiedCount} coupon usage(s) as failed`);
        }
      }

      // Delete stale subscription (required due to unique orgId constraint)
      await OfficeSubscription.findByIdAndDelete(existingSubscription._id);
      console.log(`[OfficeCheckout] Deleted stale subscription ${existingSubscription._id}`);
    }

    // 4. Check if org already used trial (in case trial record was already cleaned up but
    // we want to prevent re-trials - check is already handled above if record still exists)

    // 5. Get plan. Basic ("Distributors Office") is deprecated — every new
    // signup goes to Pro. The Basic branch is gone; we ignore whatever the
    // FE sends and force "pro" so a stale client cache can't accidentally
    // open a Basic trial.
    const plan = await getOfficePlanBySlug("pro");
    if (!plan) {
      return res.status(500).json({ error: "Pro plan not available" });
    }

    // 6. Bootstrap the subscription in "created" (unpaid) state — the office
    // is NOT unlocked until the founder pays the invoice minted below. No
    // trial, no free window: Pro bills from day 1. Kept the OfficeSubscription
    // row up-front so downstream code that expects `subscription.planId` to
    // exist during the payment flow keeps working.
    const now = new Date();

    const pendingSubscription = await OfficeSubscription.create({
      orgId: new Types.ObjectId(orgId),
      founderId: new Types.ObjectId(user.userId),
      planId: plan._id,
      razorpayPlanId: plan.razorpayPlanId,
      status: "created",
      isTrial: false,
      paidCount: 0,
    });

    void refreshTypeFlags(user.userId);

    console.log(`[OfficeCheckout] Pro subscription bootstrapped for org ${orgId} by user ${user.userId} — awaiting invoice payment`);

    // GST applies only when the ORG is in India. Office is a platform fee, so
    // it is always exclusive (added on top) — only applicability varies.
    // Resolved once here because BOTH the office invoice and the extra-rooms
    // invoice below must use the same answer; a foreign org must not end up
    // with a GST-free office line and a taxed rooms line.
    const gstRegion = await resolveOrgGstRegion({
      orgId,
      subscriberUserId: user.userId,
      paymentCurrency: plan.currency || "USD",
    });

    // Real recurring Pro invoice — $96 base + GST, needs payment to activate.
    // Cycle 1 is billed here; the recurring cron mints cycles 2..N on due
    // dates. No trial cycles, no forced discount.
    let officeInvoiceId: string | null = null;
    try {
      const userDoc = await User.findById(user.userId).select("name email").lean();

      const planAmountCents = plan.amount; // base price (GST-exclusive), cents
      const taxRate = plan.taxRate ?? GST_CONFIG.rate;
      const officeGstLine = applyGstToLine({
        listedAmountMinor: planAmountCents,
        gstInclusive: false,
        buyerInIndia: gstRegion.inIndia,
        taxRate,
      });
      const taxAmount = officeGstLine.taxTotal;

      const invoice = await createInvoice({
        organizationId: orgId,
        sellerId: user.userId,
        userId: user.userId,
        customerEmail: userDoc?.email || "",
        customerName: userDoc?.name || undefined,
        lineItems: [{
          itemType: "office_plan",
          itemId: plan._id.toString(),
          itemName: `Office ${plan.name} Plan`,
          itemDescription: plan.description,
          quantity: 1,
          unitPrice: planAmountCents,
          originalCurrency: plan.currency || "USD",
        }],
        itemCurrency: plan.currency || "USD",
        tax: taxAmount,
        isRecurring: true,
        recurringPeriod: "monthly",
        metadata: {
          type: "office_subscription",
          planSlug: "pro",
          ...(officeGstLine.gstMetadata
            ? {
                gst: {
                  ...officeGstLine.gstMetadata,
                  buyerCountry: gstRegion.country,
                  buyerRegion: "IN" as const,
                  regionSource: gstRegion.source,
                },
              }
            : { gstSkipped: gstSkippedMetadata(gstRegion, "buyer_outside_india") }),
        },
      });
      invoice.nextDueDate = getNextChargeDate(now, "monthly");
      invoice.recurringPaymentNumber = 1;
      await invoice.save();
      officeInvoiceId = invoice._id.toString();
      console.log(`[OfficeCheckout] Pro invoice ${invoice.invoiceNumber} created for org ${orgId} — awaiting payment`);
    } catch (invoiceError) {
      console.error("[OfficeCheckout] Pro invoice creation error (non-blocking):", invoiceError);
    }

    // Extra conference rooms (count > 1). Each room above the included one
    // costs $5/month — charged from day 1 alongside the office plan.
    // We materialize the rooms as real `ConferenceRoom` docs so the data
    // model matches the count the founder paid for, then create ONE
    // recurring parent invoice for the monthly $5 × extraCount. The
    // existing `generateDueRecurringInvoices` cron picks up child cycles
    // automatically.
    let roomsInvoiceId: string | null = null;
    if (extraRoomCount > 0) {
      try {
        // Find existing room count for this org (the create-org flow makes
        // 1 default "Conference Room"). We name new ones sequentially so
        // the founder lands on a tidy "Conference Room 1..N" list.
        const existingCount = await ConferenceRoom.countDocuments({
          orgId: new Types.ObjectId(orgId),
          isActive: true,
        });
        for (let i = 1; i <= extraRoomCount; i++) {
          await ConferenceRoom.create({
            orgId: new Types.ObjectId(orgId),
            name: `Conference Room ${existingCount + i}`,
            createdBy: new Types.ObjectId(user.userId),
            isActive: true,
          });
        }

        const userDoc2 = await User.findById(user.userId).select("name email").lean();
        const roomsUnitPriceCents = CONFERENCE_ROOM_PRICE_CENTS;
        const roomsSubtotal = roomsUnitPriceCents * extraRoomCount;
        // GST handled at the invoice layer the same way office_plan does it
        // (taxRate from the plan, always exclusive). Rooms MUST resolve the
        // same region as the office sub above — otherwise a foreign org gets
        // a GST-free office line and a taxed rooms line on related invoices.
        const roomsTaxRate = plan.taxRate ?? GST_CONFIG.rate;
        const roomsGstLine = applyGstToLine({
          listedAmountMinor: roomsUnitPriceCents,
          quantity: extraRoomCount,
          gstInclusive: false,
          buyerInIndia: gstRegion.inIndia,
          taxRate: roomsTaxRate,
        });
        const roomsTaxAmount = roomsGstLine.taxTotal;

        const roomsInvoice = await createInvoice({
          organizationId: orgId,
          sellerId: user.userId,
          userId: user.userId,
          customerEmail: userDoc2?.email || "",
          customerName: userDoc2?.name || undefined,
          lineItems: [{
            itemType: "office_addon",
            // We don't have a per-org "office_addon" subdocument to point
            // at; the orgId IS the item identity for room billing. The
            // invoice's organizationId already captures the relation.
            itemId: orgId,
            itemName: "Conference Room",
            itemDescription: `Extra conference room${extraRoomCount > 1 ? "s" : ""} ($${
              CONFERENCE_ROOM_PRICE_CENTS / 100
            }/room/month)`,
            quantity: extraRoomCount,
            unitPrice: roomsUnitPriceCents,
            originalCurrency: plan.currency || "USD",
          }],
          itemCurrency: plan.currency || "USD",
          isRecurring: true,
          recurringPeriod: "monthly",
          tax: roomsTaxAmount,
          metadata: {
            type: "office_addon_subscription",
            kind: "conference_room",
            orgId,
            ...(roomsGstLine.gstMetadata
              ? {
                  gst: {
                    ...roomsGstLine.gstMetadata,
                    buyerCountry: gstRegion.country,
                    buyerRegion: "IN" as const,
                    regionSource: gstRegion.source,
                  },
                }
              : { gstSkipped: gstSkippedMetadata(gstRegion, "buyer_outside_india") }),
          },
        });
        roomsInvoice.nextDueDate = getNextChargeDate(now, "monthly");
        roomsInvoice.recurringPaymentNumber = 1;
        await roomsInvoice.save();
        roomsInvoiceId = roomsInvoice._id.toString();
        console.log(
          `[OfficeCheckout] Created rooms invoice ${roomsInvoice.invoiceNumber} for org ${orgId} (${extraRoomCount} extra rooms)`
        );
      } catch (roomsErr) {
        console.error(
          "[OfficeCheckout] Failed to create extra rooms + rooms invoice (non-blocking):",
          roomsErr
        );
      }
    }

    res.json({
      success: true,
      // Pro plan invoice — MUST be paid to activate the office. FE redirects
      // to /invoice/<id> for payment. Null only if invoice creation failed
      // (logged above; FE should surface an error in that case).
      officeInvoiceId,
      // Extra rooms invoice — also needs payment when the founder picked
      // > 1 room. Null when they took the included free room only.
      roomsInvoiceId,
      subscription: {
        _id: pendingSubscription._id,
        status: pendingSubscription.status,
        planId: pendingSubscription.planId,
      },
    });
  } catch (error) {
    console.error("Error bootstrapping Pro subscription:", error);
    res.status(500).json({ error: "Failed to start Pro subscription" });
  }
});

/**
 * POST /checkout/office/:orgId/subscribe
 * Create a subscription for the organization (authenticated)
 * If a subscription exists in "created" status, returns the existing shortUrl for retry
 *
 * Body params:
 * - planSlug: "basic" | "pro"
 * - gstin?: string (optional 15-char GSTIN for B2B invoicing)
 * - legalName?: string (optional business name for invoices)
 */
router.post("/:orgId/subscribe", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { planSlug, gstin, legalName, couponCode } = req.body;
    const user = (req as any).user as { userId: string; orgId: string; role?: string };

    // Validate user owns this org and is founder
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (user.role !== "founder") {
      return res.status(403).json({ error: "Only founders can subscribe" });
    }

    // Validate plan slug. Basic is deprecated. We now accept "pro" (paid,
    // Razorpay-cycled) and "starter" (free, cron-cycled with 10% platform
    // fee override on the org). Existing Basic subscribers keep working via
    // the read paths.
    if (planSlug !== "pro" && planSlug !== "starter") {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    // Validate GSTIN format if provided
    if (gstin) {
      const normalizedGstin = gstin.toUpperCase().trim();
      if (!GSTIN_REGEX.test(normalizedGstin)) {
        return res.status(400).json({
          error: "Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5"
        });
      }
    }

    // Check if already has active paid subscription (not trial)
    const hasActive = await hasActiveOfficeSubscription(orgId);

    // Check if any subscription exists for this org
    const existingSubscription = await getOfficeSubscription(orgId);

    // Allow subscription if converting from trial or expired trial
    const isConvertingFromTrial = existingSubscription?.isTrial === true;

    // Plan-switch: an active subscription on a DIFFERENT plan is allowed
    // (Starter ↔ Pro). Same-plan re-subscribes are still blocked to avoid
    // accidental double-charges.
    const existingPlanDoc = existingSubscription?.planId
      ? await OfficePlan.findById(existingSubscription.planId).lean()
      : null;
    const existingPlanSlug = existingPlanDoc?.slug || null;
    const isSwitchingPlans =
      !!existingSubscription &&
      !!existingPlanSlug &&
      existingPlanSlug !== planSlug;

    // hasActive now stays true during the Pro grace window (see
    // computeOfficeGraceState) so the office isn't locked while payment
    // is being sorted. That would otherwise block a founder in grace
    // from calling /subscribe to retry — which is the legitimate
    // recovery path for "created" / "cancelled" / "halted" / "expired"
    // subs (all covered by the canRetry check a few lines below). Only
    // block when the existing sub is TRULY active (paying) — i.e., not
    // in one of those retryable states.
    const isRetryableState = !!existingSubscription &&
      ["created", "cancelled", "halted", "expired", "pending"].includes(
        existingSubscription.status,
      );

    if (
      hasActive &&
      !isConvertingFromTrial &&
      !isSwitchingPlans &&
      !isRetryableState
    ) {
      return res.status(400).json({ error: "Organization already has an active subscription" });
    }

    // Track if this is a trial conversion for later
    let convertedFromTrial = false;

    if (existingSubscription) {
      // Allow: "created", "cancelled", "trial", "expired" (if trial), OR
      // active-but-switching-plans (Starter ↔ Pro).
      const canRetry = ["created", "cancelled"].includes(existingSubscription.status) ||
                       (existingSubscription.isTrial && ["trial", "expired"].includes(existingSubscription.status)) ||
                       isSwitchingPlans;

      if (!canRetry) {
        // Active/authenticated/pending subscriptions cannot be replaced
        return res.status(400).json({
          error: "Organization already has a subscription",
          status: existingSubscription.status
        });
      }

      // Plan switch — cancel any UNPAID recurring office invoices from the
      // outgoing plan so the cron stops minting new children off them, and
      // no stale "you owe $96" invoice sits in the founder's dashboard for
      // a plan they no longer hold. Paid invoices are historical, untouched.
      if (isSwitchingPlans) {
        try {
          const orphanedCancel = await Invoice.updateMany(
            {
              organizationId: new Types.ObjectId(orgId),
              "metadata.type": {
                $in: ["office_subscription", "office_trial", "office_upgrade"],
              },
              isRecurring: true,
              status: { $in: ["draft", "pending", "unpaid"] },
              cancelledAt: { $in: [null, undefined] },
            },
            { $set: { cancelledAt: new Date() } },
          );
          if (orphanedCancel.modifiedCount > 0) {
            console.log(
              `[OfficeCheckout] Cancelled ${orphanedCancel.modifiedCount} unpaid office invoice(s) for org ${orgId} on ${existingPlanSlug}→${planSlug} switch`,
            );
          }
        } catch (cancelErr) {
          console.error(
            "[OfficeCheckout] Failed to cancel unpaid invoices on plan switch (non-blocking):",
            cancelErr,
          );
        }
      }

      // Switching FROM starter: cancel the (paid, $0) free parent invoice
      // too so the cron stops minting $0 children off it. The generic block
      // above only touches UNPAID invoices; the starter parent is paid but
      // still recurring — needs an explicit cancel.
      if (existingPlanSlug === "starter") {
        try {
          const starterCancelResult = await Invoice.updateMany(
            {
              organizationId: new Types.ObjectId(orgId),
              "metadata.kind": "office_free_plan",
              isRecurring: true,
              cancelledAt: { $in: [null, undefined] },
              parentInvoiceId: { $in: [null, undefined] },
            },
            { $set: { cancelledAt: new Date() } },
          );
          if (starterCancelResult.modifiedCount > 0) {
            console.log(
              `[OfficeCheckout] Cancelled ${starterCancelResult.modifiedCount} starter parent invoice(s) for org ${orgId} on plan switch`,
            );
          }
        } catch (starterErr) {
          console.error(
            "[OfficeCheckout] Failed to cancel starter parent invoice on switch (non-blocking):",
            starterErr,
          );
        }

        // Restore the org's pre-starter platform fee % so Pro-plan sales
        // don't keep paying the 10% override. previousPlatformFeePercentage
        // was stashed on OfficeSubscription.metadata at starter activation.
        const restored =
          (existingSubscription.metadata as any)?.previousPlatformFeePercentage;
        await Organization.findByIdAndUpdate(orgId, {
          $set: {
            "paymentConfig.platformFeePercentage": restored ?? null,
            "paymentConfig.platformFeeUpdatedAt": new Date(),
            "paymentConfig.platformFeeUpdatedBy": null,
          },
        });
        console.log(
          `[OfficeCheckout] Restored platformFeePercentage for org ${orgId} to ${restored ?? "null (default 5%)"} on starter→${planSlug} switch`,
        );
      }

      // Check if converting from trial
      if (existingSubscription.isTrial) {
        convertedFromTrial = true;
        console.log(`[OfficeCheckout] Converting trial to paid subscription for org ${orgId}`);
      }

      // Delete the old subscription to allow creating a new one
      console.log(`[OfficeCheckout] Removing old subscription ${existingSubscription._id} (status: ${existingSubscription.status}) to create fresh payment`);

      // Try to cancel in Razorpay if it was in "created" status (may have Razorpay record)
      if (existingSubscription.status === "created" && existingSubscription.razorpaySubscriptionId) {
        try {
          await cancelSubscription(existingSubscription.razorpaySubscriptionId, false);
          console.log(`[OfficeCheckout] Cancelled Razorpay subscription ${existingSubscription.razorpaySubscriptionId}`);
        } catch (err) {
          // Log but continue - subscription may already be cancelled or in uncancellable state
          console.log(`[OfficeCheckout] Could not cancel Razorpay subscription (continuing anyway): ${err}`);
        }
      }

      // Mark any pending coupon usage as failed so user can reuse the coupon
      if (existingSubscription.razorpaySubscriptionId) {
        const updatedUsage = await CouponUsage.updateMany(
          {
            transactionId: existingSubscription.razorpaySubscriptionId,
            status: "pending",
          },
          { status: "failed" }
        );
        if (updatedUsage.modifiedCount > 0) {
          console.log(`[OfficeCheckout] Marked ${updatedUsage.modifiedCount} coupon usage(s) as failed`);
        }
      }

      // Delete from our DB (required due to unique orgId constraint)
      await OfficeSubscription.findByIdAndDelete(existingSubscription._id);
      console.log(`[OfficeCheckout] Deleted old subscription ${existingSubscription._id}`);

      // If we're converting from trial, ALSO cancel the recurring trial
      // invoice created by /start-trial. Without this, the recurring cron
      // would keep spawning child invoices off the old trial parent
      // (either $0 during the trial window OR full-priced after it — both
      // wrong once the founder has upgraded to a real paid subscription).
      // Marking `cancelledAt` is enough — `generateNextChildInvoice`
      // early-returns on any parent with `cancelledAt` set.
      if (convertedFromTrial) {
        try {
          const trialCancelResult = await Invoice.updateMany(
            {
              organizationId: new Types.ObjectId(orgId),
              "metadata.type": "office_trial",
              isRecurring: true,
              cancelledAt: { $in: [null, undefined] },
              parentInvoiceId: { $in: [null, undefined] },
            },
            { $set: { cancelledAt: new Date() } }
          );
          if (trialCancelResult.modifiedCount > 0) {
            console.log(
              `[OfficeCheckout] Cancelled ${trialCancelResult.modifiedCount} recurring trial invoice(s) for org ${orgId} on trial→paid conversion`
            );
          }
        } catch (trialErr) {
          console.error(
            "[OfficeCheckout] Failed to cancel recurring trial invoice on conversion (non-blocking):",
            trialErr
          );
        }
      }
    }

    // Save GSTIN to organization's billing details if provided
    if (gstin) {
      const normalizedGstin = gstin.toUpperCase().trim();
      await Organization.findByIdAndUpdate(orgId, {
        $set: {
          "billingDetails.gstin": normalizedGstin,
          "billingDetails.legalName": legalName?.trim() || undefined,
        },
      });
      console.log(`[OfficeCheckout] Saved GSTIN for org ${orgId}: ${normalizedGstin}`);
    }

    // Get user info
    const userDoc = await User.findById(user.userId).select("name email phone").lean();

    // Get plan to know the amount for coupon validation
    const plan = await getOfficePlanBySlug(planSlug);
    if (!plan) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    // ============ Starter (free) plan fast-path ============
    // Free plan → no Razorpay, no coupon, no GST. Activates immediately,
    // bumps the org's platform-fee % (default 10) so every downstream sale
    // routes commission through distributeCommissions() at the plan's rate,
    // and mints a $0 recurring parent invoice so the monthly cron chains
    // renewals from it.
    if (planSlug === "starter") {
      const feeOverride =
        typeof plan.platformFeeOverride === "number"
          ? plan.platformFeeOverride
          : 10;

      // Snapshot whatever fee was on the org before we overwrite it — if the
      // founder later upgrades to Pro we restore this value so a manual admin
      // override isn't silently lost.
      const orgBefore = await Organization.findById(orgId)
        .select("paymentConfig")
        .lean();
      const previousPlatformFeePercentage =
        orgBefore?.paymentConfig?.platformFeePercentage ?? null;

      await Organization.findByIdAndUpdate(orgId, {
        $set: {
          "paymentConfig.platformFeePercentage": feeOverride,
          "paymentConfig.platformFeeUpdatedAt": new Date(),
          "paymentConfig.platformFeeUpdatedBy": null,
        },
      });

      const now = new Date();
      const nextDue = getNextChargeDate(now, "monthly");

      const subscription = await OfficeSubscription.create({
        orgId: new Types.ObjectId(orgId),
        founderId: new Types.ObjectId(user.userId),
        planId: plan._id,
        status: "active",
        currentStart: now,
        currentEnd: nextDue,
        chargeAt: nextDue,
        startedAt: now,
        paidCount: 1,
        isTrial: false,
        convertedFromTrial,
        metadata: {
          planSlug: "starter",
          platformFeeOverride: feeOverride,
          previousPlatformFeePercentage,
        },
      });

      const invoice = await createInvoice({
        organizationId: orgId,
        sellerId: user.userId,
        userId: user.userId,
        customerEmail: userDoc?.email || "",
        customerName: userDoc?.name || undefined,
        lineItems: [
          {
            itemType: "office_plan",
            itemId: plan._id.toString(),
            itemName: `Office ${plan.name} Plan`,
            itemDescription: plan.description,
            quantity: 1,
            unitPrice: 0,
            originalCurrency: plan.currency || "USD",
          },
        ],
        itemCurrency: plan.currency || "USD",
        isRecurring: true,
        recurringPeriod: "monthly",
        discount: 0,
        tax: 0,
        metadata: {
          type: "office_subscription",
          planSlug: "starter",
          // Marker read by generateNextChildInvoice + fulfillInvoice to
          // (a) force every child to $0 without needing a coupon, and
          // (b) suppress the zero-pay cascade so exactly one child is
          //     minted per month by the scheduled cron.
          kind: "office_free_plan",
          convertedFromTrial,
        },
      });
      invoice.nextDueDate = nextDue;
      invoice.recurringPaymentNumber = 1;
      invoice.status = "paid";
      invoice.paidAt = now;
      await invoice.save();

      console.log(
        `[OfficeCheckout] Starter plan activated for org ${orgId} — ${feeOverride}% platform fee, invoice ${invoice.invoiceNumber}`,
      );

      return res.json({
        success: true,
        requiresPayment: false,
        subscriptionId: subscription._id.toString(),
        invoiceId: invoice._id.toString(),
        plan: {
          name: plan.name,
          slug: plan.slug,
          amount: 0,
          taxAmount: 0,
          platformFeeOverride: feeOverride,
        },
      });
    }

    // Route coupon: check if it's a platform coupon first, else use legacy
    const { routeCoupon } = await import("../utils/couponRouting");
    const routedCoupon = await routeCoupon(couponCode);
    const platformCouponCode = routedCoupon.isPlatform ? couponCode : undefined;

    // Validate legacy coupon if provided and not a platform code
    let appliedCoupon: any = null;
    let discountAmount = 0;
    let couponUsageId: string | undefined;

    if (couponCode && !routedCoupon.isPlatform) {
      const couponValidation = await validateCoupon({
        code: couponCode,
        itemType: "office_plan",
        itemId: plan._id.toString(),
        amount: plan.amount,
        userId: user.userId,
        orgId,
      });

      if (!couponValidation.valid) {
        return res.status(400).json({
          error: couponValidation.error || "Invalid coupon",
        });
      }

      appliedCoupon = couponValidation.coupon;
      discountAmount = couponValidation.discountAmount || 0;
    }

    // Calculate final amount after discount
    const finalAmount = plan.amount - discountAmount;

    // Record coupon usage
    if (appliedCoupon) {
      const usage = await recordCouponUsage({
        couponId: appliedCoupon._id.toString(),
        userId: user.userId,
        orgId,
        transactionType: "subscription",
        transactionId: `invoice_pending_${Date.now()}`,
        itemType: "office_plan",
        itemId: plan._id.toString(),
        originalAmount: plan.amount,
        discountAmount,
        finalAmount,
      });
      couponUsageId = usage._id.toString();
    }

    // Create invoice — we own the billing cycle, no Razorpay subscription
    //
    // GST applies only when the ORG is in India. Office is a platform fee, so
    // it is always exclusive (added on top) — there is no founder "is it
    // included?" question here, only whether it applies at all. Computed on
    // the POST-discount amount so a coupon reduces the tax with it.
    const taxRate = plan.taxRate ?? GST_CONFIG.rate;
    const gstRegion = await resolveOrgGstRegion({
      orgId,
      subscriberUserId: user.userId,
      paymentCurrency: plan.currency || "USD",
    });
    const gstLine = applyGstToLine({
      listedAmountMinor: finalAmount,
      gstInclusive: false,
      buyerInIndia: gstRegion.inIndia,
      taxRate,
    });
    const taxAmount = gstLine.taxTotal;

    const invoice = await createInvoice({
      organizationId: orgId,
      sellerId: user.userId,
      userId: user.userId,
      customerEmail: userDoc?.email || "",
      customerName: userDoc?.name || undefined,
      lineItems: [{
        itemType: "office_plan",
        itemId: plan._id.toString(),
        itemName: `Office ${plan.name} Plan`,
        itemDescription: plan.description,
        quantity: 1,
        unitPrice: finalAmount,
        originalCurrency: plan.currency || "USD",
      }],
      itemCurrency: plan.currency || "USD",
      isRecurring: true,
      recurringPeriod: "monthly",
      discount: discountAmount,
      tax: taxAmount,
      couponId: appliedCoupon?._id?.toString(),
      couponCode: appliedCoupon?.code,
      couponUsageId,
      platformCouponCode,
      metadata: {
        type: "office_subscription",
        planSlug,
        convertedFromTrial,
        gstin: gstin?.toUpperCase().trim() || undefined,
        ...(gstLine.gstMetadata
          ? {
              gst: {
                ...gstLine.gstMetadata,
                buyerCountry: gstRegion.country,
                buyerRegion: "IN" as const,
                regionSource: gstRegion.source,
              },
            }
          : { gstSkipped: gstSkippedMetadata(gstRegion, "buyer_outside_india") }),
      },
    });

    // Set nextDueDate and payment number
    invoice.nextDueDate = getNextChargeDate(new Date(), "monthly");
    invoice.recurringPaymentNumber = 1;
    await invoice.save();

    console.log(`[OfficeCheckout] Created invoice ${invoice.invoiceNumber} for org ${orgId} (${plan.name} plan)`);

    res.json({
      success: true,
      invoiceId: invoice._id.toString(),
      plan: {
        name: plan.name,
        slug: plan.slug,
        amount: finalAmount / 100,
        taxAmount: taxAmount / 100,
      },
      coupon: appliedCoupon ? {
        code: appliedCoupon.code,
        discountValue: appliedCoupon.discountValue,
        discountAmount,
      } : null,
      couponUsageId,
    });
  } catch (error: any) {
    console.error("Error creating office subscription:", error);
    res.status(500).json({ error: error.message || "Failed to create subscription" });
  }
});

/**
 * POST /checkout/office/:orgId/verify
 * Verify subscription status after Razorpay redirect (authenticated)
 */
router.post("/:orgId/verify", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { razorpay_subscription_id, couponUsageId } = req.body;
    const user = (req as any).user as { userId: string; orgId: string };

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get subscription from database
    const subscription = await getOfficeSubscription(orgId);
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    // Trial subscriptions don't need Razorpay verification
    if (!subscription.razorpaySubscriptionId) {
      return res.status(400).json({ error: "Cannot verify trial subscription" });
    }

    // Verify with Razorpay
    if (razorpay_subscription_id) {
      if (subscription.razorpaySubscriptionId !== razorpay_subscription_id) {
        return res.status(400).json({ error: "Subscription ID mismatch" });
      }
    }

    // Fetch latest status from Razorpay
    const razorpaySubscription = await fetchSubscription(
      subscription.razorpaySubscriptionId
    );

    // Check if authenticated or active
    const validStatuses = ["authenticated", "active"];
    if (!validStatuses.includes(razorpaySubscription.status)) {
      return res.status(400).json({
        error: "Payment not completed",
        status: razorpaySubscription.status,
      });
    }

    // Sync status
    await syncOfficeSubscriptionStatus(subscription._id.toString());

    // Mark coupon usage as applied if provided
    if (couponUsageId) {
      await markUsageApplied(couponUsageId);
    }

    res.json({
      success: true,
      status: razorpaySubscription.status,
      message: "Subscription verified successfully",
    });
  } catch (error: any) {
    console.error("Error verifying office subscription:", error);

    // Mark coupon usage as failed if provided
    const { couponUsageId } = req.body;
    if (couponUsageId) {
      await markUsageFailed(couponUsageId).catch(console.error);
    }

    res.status(500).json({ error: error.message || "Failed to verify subscription" });
  }
});

/**
 * GET /checkout/office/:orgId/status
 * Get current subscription status (authenticated)
 * Includes trial info if on trial
 */
router.get("/:orgId/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string };

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const hasActive = await hasActiveOfficeSubscription(orgId);
    const subscription = await getOfficeSubscription(orgId);
    const trialInfo = getTrialInfo(subscription);

    res.json({
      hasActiveSubscription: hasActive,
      subscription: subscription
        ? {
            _id: subscription._id,
            status: subscription.status,
            planId: subscription.planId,
            currentStart: subscription.currentStart,
            currentEnd: subscription.currentEnd,
            chargeAt: subscription.chargeAt,
            paidCount: subscription.paidCount,
            ...trialInfo, // Spread trial info (isTrial, trialStartedAt, trialEndsAt, daysRemaining, trialExpired)
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

// ============ Plan Upgrade Routes ============

/**
 * GET /checkout/office/:orgId/upgrade/preview
 * Get upgrade preview with wallet credit calculation (authenticated)
 * Shows credit that will be added to wallet when upgrading from Basic to Pro
 */
router.get("/:orgId/upgrade/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string };

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const preview = await calculateUpgradePreview(orgId);
    res.json(preview);
  } catch (error: any) {
    console.error("Error fetching upgrade preview:", error);
    res.status(500).json({ error: error.message || "Failed to fetch upgrade preview" });
  }
});

/**
 * POST /checkout/office/:orgId/upgrade/initiate
 * Perform complete upgrade in one call (authenticated)
 * Only founders can initiate upgrades
 *
 * Flow:
 * 1. Credit unused Basic balance to founder's StoreWallet
 * 2. Cancel Basic subscription in Razorpay
 * 3. Create new Pro subscription in Razorpay
 * 4. Return Pro subscription shortUrl for user authorization
 *
 * Response:
 * {
 *   success: true,
 *   creditedAmount: number (INR added to wallet),
 *   walletBalance: number (new wallet balance),
 *   subscription: { _id, status, shortUrl, planName }
 * }
 */
router.post("/:orgId/upgrade/initiate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string; role?: string };

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Only founders can upgrade
    if (user.role !== "founder") {
      return res.status(403).json({ error: "Only founders can upgrade the plan" });
    }

    const result = await initiateOfficeUpgrade(orgId, user.userId);

    // Create invoice for the Pro plan payment
    let invoiceId: string | undefined;
    try {
        const proPlan = await getOfficePlanBySlug("pro");
      const userDoc = await User.findById(user.userId).select("email name").lean();

      if (proPlan) {
        const taxRate = proPlan.taxRate ?? GST_CONFIG.rate;
        // Same org-region rule as /subscribe — a foreign org upgrading must
        // not be charged Indian GST.
        const upgradeGstRegion = await resolveOrgGstRegion({
          orgId,
          subscriberUserId: user.userId,
          paymentCurrency: proPlan.currency || "USD",
        });
        const upgradeGstLine = applyGstToLine({
          listedAmountMinor: proPlan.amount,
          gstInclusive: false,
          buyerInIndia: upgradeGstRegion.inIndia,
          taxRate,
        });
        const taxAmount = upgradeGstLine.taxTotal;

        const invoice = await createInvoice({
          organizationId: orgId,
          sellerId: user.userId,
          userId: user.userId,
          customerEmail: userDoc?.email || "",
          customerName: userDoc?.name || undefined,
          lineItems: [{
            itemType: "office_plan",
            itemId: proPlan._id.toString(),
            itemName: `Office ${proPlan.name} Plan (Upgrade)`,
            itemDescription: `Upgraded from Basic. $${result.creditedAmount} credited to wallet.`,
            quantity: 1,
            unitPrice: proPlan.amount,
            originalCurrency: proPlan.currency || "USD",
          }],
          itemCurrency: proPlan.currency || "USD",
          isRecurring: true,
          recurringPeriod: "monthly",
          tax: taxAmount,
          metadata: {
            type: "office_upgrade",
            upgradedFrom: "basic",
            creditedAmount: result.creditedAmount,
            ...(upgradeGstLine.gstMetadata
              ? {
                  gst: {
                    ...upgradeGstLine.gstMetadata,
                    buyerCountry: upgradeGstRegion.country,
                    buyerRegion: "IN" as const,
                    regionSource: upgradeGstRegion.source,
                  },
                }
              : {
                  gstSkipped: gstSkippedMetadata(
                    upgradeGstRegion,
                    "buyer_outside_india"
                  ),
                }),
          },
        });

        invoice.nextDueDate = getNextChargeDate(new Date(), "monthly");
        invoice.recurringPaymentNumber = 1;
        await invoice.save();
        invoiceId = invoice._id.toString();
      }
    } catch (invoiceError) {
      console.error("[OfficeUpgrade] Invoice creation error (non-blocking):", invoiceError);
    }

    res.json({
      ...result,
      invoiceId,
    });
  } catch (error: any) {
    console.error("Error initiating upgrade:", error);
    res.status(500).json({ error: error.message || "Failed to initiate upgrade" });
  }
});

/**
 * GET /checkout/office/:orgId/upgrade/history
 * Get upgrade history for the organization (authenticated)
 */
router.get("/:orgId/upgrade/history", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string };

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const history = await getOfficeUpgradeHistory(orgId);

    res.json({
      upgrades: history.map((upgrade) => ({
        _id: upgrade._id,
        previousPlan: upgrade.previousPlanSlug,
        newPlan: upgrade.newPlanSlug,
        status: upgrade.status,
        creditedAmount: upgrade.creditCalculation.creditAmount / 100, // INR
        daysRemaining: upgrade.creditCalculation.daysRemaining,
        completedAt: upgrade.completedAt,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching upgrade history:", error);
    res.status(500).json({ error: error.message || "Failed to fetch upgrade history" });
  }
});

// ============ Plan Downgrade Routes (Pro → Starter) ============

/**
 * GET /checkout/office/:orgId/downgrade/preview
 * Preview a Pro → Starter downgrade. Shows unused Pro balance that will
 * be credited to the founder's wallet + the new 10% platform fee override
 * that will apply on the Starter plan.
 */
router.get("/:orgId/downgrade/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string };

    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const preview = await calculateDowngradePreview(orgId);
    res.json(preview);
  } catch (error: any) {
    console.error("Error fetching downgrade preview:", error);
    res.status(500).json({ error: error.message || "Failed to fetch downgrade preview" });
  }
});

/**
 * POST /checkout/office/:orgId/downgrade/initiate
 * Schedule a Pro → Starter downgrade at the current cycle end. Only
 * founders. Pro access + billing continue through `effectiveAt`; on the
 * Razorpay `subscription.cancelled` webhook we then mint the Starter sub
 * and apply its platform-fee override.
 *
 * Flow:
 * 1. Ask Razorpay to cancel the Pro sub at cycle end (no next charge)
 * 2. Stash `scheduledDowngrade` metadata on the OfficeSubscription doc
 * 3. Return `effectiveAt` so the FE can render the countdown
 * Nothing is refunded/credited — the founder consumes the period they
 * paid for. Starter activation happens later in the webhook handler.
 */
router.post("/:orgId/downgrade/initiate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string; role?: string };

    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (user.role !== "founder") {
      return res.status(403).json({ error: "Only founders can downgrade the plan" });
    }

    const result = await initiateOfficeDowngrade(orgId, user.userId);

    res.json({
      success: true,
      effectiveAt: result.effectiveAt,
      subscription: result.subscription,
    });
  } catch (error: any) {
    console.error("Error initiating downgrade:", error);
    res.status(500).json({ error: error.message || "Failed to initiate downgrade" });
  }
});

// ============ Payment Recovery Routes ============

/**
 * GET /checkout/office/:orgId/recovery
 * Get recovery information for halted/pending subscription (authenticated)
 * Returns payment update URL and any unpaid invoices
 * Only founders can access recovery info
 */
router.get("/:orgId/recovery", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string; role?: string };

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Only founders can access recovery info
    if (user.role !== "founder") {
      return res.status(403).json({ error: "Only founders can recover subscription" });
    }

    const recoveryInfo = await getSubscriptionRecoveryInfo(orgId);

    if (!recoveryInfo) {
      return res.status(404).json({
        error: "No halted or pending subscription found",
        hasActiveSubscription: await hasActiveOfficeSubscription(orgId),
      });
    }

    const plan = recoveryInfo.subscription?.planId as any;

    res.json({
      isHalted: recoveryInfo.isHalted,
      isPending: recoveryInfo.isPending,
      subscription: recoveryInfo.subscription
        ? {
            _id: recoveryInfo.subscription._id,
            status: recoveryInfo.subscription.status,
            planName: plan?.name || "Unknown",
            currentEnd: recoveryInfo.subscription.currentEnd,
          }
        : null,
      recoveryUrl: recoveryInfo.recoveryUrl,
      unpaidInvoices: recoveryInfo.unpaidInvoices,
      totalOutstanding: recoveryInfo.totalOutstanding,
      instructions: [
        "1. Click the recovery URL to update your payment method on Razorpay",
        "2. Once updated, your subscription will automatically resume",
        "3. Any unpaid invoices can be paid separately via their individual links",
      ],
    });
  } catch (error: any) {
    console.error("Error fetching recovery info:", error);
    res.status(500).json({ error: error.message || "Failed to fetch recovery info" });
  }
});

/**
 * POST /checkout/office/:orgId/refresh-status
 * Sync subscription status with Razorpay (authenticated)
 * Use after user updates payment method to check if subscription recovered
 */
router.post("/:orgId/refresh-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string };

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const subscription = await getOfficeSubscription(orgId);
    if (!subscription) {
      return res.status(404).json({ error: "No subscription found" });
    }

    // Store previous status for comparison
    const previousStatus = subscription.status;

    // Sync with Razorpay
    const synced = await syncOfficeSubscriptionStatus(subscription._id.toString());

    // Check if subscription recovered
    const wasRecovered =
      ["halted", "pending"].includes(previousStatus) && synced?.status === "active";

    // Send notification if recovered
    if (wasRecovered && synced) {
      const io = getSocketInstance();
      if (io) {
        io.to(`user:${user.userId}`).emit("office:subscription:update", {
          type: "recovered",
          subscriptionId: synced._id,
          orgId: synced.orgId,
          message: "Your subscription has been recovered!",
        });
      }
    }

    res.json({
      success: true,
      previousStatus,
      currentStatus: synced?.status,
      wasRecovered,
      subscription: synced
        ? {
            _id: synced._id,
            status: synced.status,
            currentStart: synced.currentStart,
            currentEnd: synced.currentEnd,
            chargeAt: synced.chargeAt,
            paidCount: synced.paidCount,
          }
        : null,
      hasActiveSubscription: await hasActiveOfficeSubscription(orgId),
    });
  } catch (error: any) {
    console.error("Error refreshing subscription status:", error);
    res.status(500).json({ error: error.message || "Failed to refresh status" });
  }
});

export default router;
