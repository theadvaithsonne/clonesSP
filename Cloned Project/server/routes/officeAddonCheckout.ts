import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { Types } from "mongoose";
import {
  getOfficeAddons,
  getOfficeAddonBySlug,
  createOfficeAddonSubscription,
  getOfficeAddonSubscription,
  getOfficeAddonSubscriptions,
  getActiveOfficeAddonSubscription,
  hasActiveAddon,
  syncOfficeAddonSubscriptionStatus,
} from "../services/officeAddonSubscription";
import { hasActiveOfficeSubscription } from "../services/officeSubscription";
import {
  fetchSubscription,
  createPlan as createRazorpayPlan,
  createSubscription as createRazorpaySubscription,
} from "../services/razorpay";
import {
  calculateAddonTaxAmounts,
  ADDON_GST_CONFIG,
} from "../models/officeAddon.model";
import { applyGstToLine } from "../utils/gstTax";
import { resolveOrgGstRegion } from "../utils/gstBuyerRegion";
import { OfficeAddonSubscription } from "../models/officeAddonSubscription.model";
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
 * GET /checkout/office-addon/addons
 * Get all available office add-ons (public)
 * Includes GST breakdown for each add-on
 */
router.get("/addons", async (req: Request, res: Response) => {
  try {
    const addons = await getOfficeAddons();

    // Format add-ons for frontend with GST breakdown.
    //
    // PUBLIC endpoint — no org, no signed-in user, so the buyer's region
    // cannot be resolved. GST now applies only to orgs in India, so we return
    // the base, the rate and BOTH totals rather than asserting one; the
    // authed `/:orgId/status` below is region-aware.
    const formattedAddons = addons.map((addon) => {
      const taxRate = addon.taxRate ?? ADDON_GST_CONFIG.rate;
      const taxInclusive = addon.taxInclusive ?? ADDON_GST_CONFIG.taxInclusive;
      const { baseAmount, taxAmount, totalAmount } = calculateAddonTaxAmounts(
        addon.amount,
        taxRate
      );

      return {
        _id: addon._id,
        name: addon.name,
        slug: addon.slug,
        description: addon.description,
        // Base amount (before GST)
        amount: baseAmount / 100,
        // GST details — applicable to buyers in India only.
        taxRate,
        taxInclusive,
        taxAmount: taxAmount / 100,
        totalAmount: totalAmount / 100,
        // Explicit both-values so no caller has to guess or recompute.
        totalWithGst: totalAmount / 100,
        totalWithoutGst: baseAmount / 100,
        gstAppliesTo: "IN" as const,
        currency: addon.currency,
        period: addon.period,
        features: addon.features,
      };
    });

    res.json({ addons: formattedAddons });
  } catch (error) {
    console.error("Error fetching office add-ons:", error);
    res.status(500).json({ error: "Failed to fetch add-ons" });
  }
});

/**
 * GET /checkout/office-addon/:orgId/status
 * Get organization's add-on subscription status (authenticated)
 */
router.get("/:orgId/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = (req as any).user as { userId: string; orgId: string };

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if org has active office subscription (required for add-ons)
    const hasOfficeSub = await hasActiveOfficeSubscription(orgId);

    // Get all add-on subscriptions for this org
    const subscriptions = await getOfficeAddonSubscriptions(orgId);

    // Get available add-ons
    const addons = await getOfficeAddons();

    // Authed, so the org IS known — report the figures this org will actually
    // be charged. Add-ons are a platform fee: always exclusive, India only.
    const addonGstRegion = await resolveOrgGstRegion({
      orgId,
      subscriberUserId: user.userId,
      paymentCurrency: addons[0]?.currency || "USD",
    });

    // Format add-ons with subscription status
    const addonsWithStatus = addons.map((addon) => {
      const taxRate = addon.taxRate ?? ADDON_GST_CONFIG.rate;
      const line = applyGstToLine({
        listedAmountMinor: addon.amount,
        gstInclusive: false,
        buyerInIndia: addonGstRegion.inIndia,
        taxRate,
      });
      const baseAmount = line.lineUnitPrice;
      const taxAmount = line.taxTotal;
      const totalAmount = line.chargeTotal;

      const subscription = subscriptions.find(
        (sub) => (sub.addonId as any)._id?.toString() === addon._id.toString()
      );

      return {
        _id: addon._id,
        name: addon.name,
        slug: addon.slug,
        description: addon.description,
        amount: baseAmount / 100,
        taxRate,
        taxAmount: taxAmount / 100,
        totalAmount: totalAmount / 100,
        // Both figures so the UI can show "with GST / without GST".
        totalWithGst: (addon.amount + Math.round((addon.amount * taxRate) / 100)) / 100,
        totalWithoutGst: addon.amount / 100,
        currency: addon.currency,
        period: addon.period,
        features: addon.features,
        subscription: subscription
          ? {
              _id: subscription._id,
              status: subscription.status,
              currentStart: subscription.currentStart,
              currentEnd: subscription.currentEnd,
              chargeAt: subscription.chargeAt,
              paidCount: subscription.paidCount,
              shortUrl: subscription.shortUrl,
              razorpaySubscriptionId: subscription.razorpaySubscriptionId,
              createdAt: subscription.createdAt,
            }
          : null,
        isActive: subscription
          ? ["active", "authenticated"].includes(subscription.status)
          : false,
      };
    });

    res.json({
      hasOfficeSubscription: hasOfficeSub,
      addons: addonsWithStatus,
    });
  } catch (error) {
    console.error("Error fetching add-on status:", error);
    res.status(500).json({ error: "Failed to fetch add-on status" });
  }
});

/**
 * POST /checkout/office-addon/:orgId/subscribe
 * Subscribe to an office add-on (authenticated)
 * Requires active office subscription
 *
 * Body params:
 * - addonSlug: "white-label"
 * - gstin?: string (optional 15-char GSTIN for B2B invoicing)
 */
router.post(
  "/:orgId/subscribe",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { addonSlug, gstin, couponCode } = req.body;
      const user = (req as any).user as { userId: string; orgId: string };

      console.log(`[OfficeAddonCheckout] Subscribe request:`, {
        orgId,
        addonSlug,
        couponCode: couponCode || "none",
        userId: user.userId,
      });

      // Validate user owns this org
      if (user.orgId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate add-on slug
      if (!addonSlug) {
        return res.status(400).json({ error: "addonSlug is required" });
      }

      // Close the legacy $299 Razorpay-subscription path for the
      // whitelabel add-on. Founders must now purchase via the new
      // $600/yr invoice flow at POST /whitelabel-addon/purchase (UI
      // entry in Domain Management → App tab). Existing active
      // Razorpay-subscription docs are untouched — those subscribers
      // keep access until their current cycle ends.
      if (addonSlug === "white-label") {
        return res.status(410).json({
          error:
            "The $299 whitelabel plan is closed for new purchases. Please use the new $600/yr plan from Domain Management.",
          replacementUrl: "/dashboard/domain-management#app",
        });
      }

      // Validate GSTIN format if provided
      if (gstin && !GSTIN_REGEX.test(gstin)) {
        return res.status(400).json({
          error:
            "Invalid GSTIN format. Must be 15 characters (e.g., 22AAAAA0000A1Z5)",
        });
      }

      // Check if org has active office subscription
      const hasOfficeSub = await hasActiveOfficeSubscription(orgId);
      if (!hasOfficeSub) {
        return res.status(400).json({
          error:
            "Organization must have an active office plan to purchase add-ons",
        });
      }

      // Check if add-on exists
      const addon = await getOfficeAddonBySlug(addonSlug);
      if (!addon) {
        return res.status(404).json({ error: "Add-on not found" });
      }

      // Check if org already has this add-on (in any active state)
      const existingSubscription = await getOfficeAddonSubscription(
        orgId,
        addonSlug
      );
      if (
        existingSubscription &&
        ["created", "authenticated", "active", "pending"].includes(
          existingSubscription.status
        )
      ) {
        // If user is trying to apply a coupon and existing subscription is in "created" status,
        // we need to cancel the old one and create a new subscription with the offer
        if (existingSubscription.status === "created" && couponCode) {
          // Cancel/expire the old subscription so we can create a new one with the coupon
          const { OfficeAddonSubscription } = await import(
            "../models/officeAddonSubscription.model"
          );
          await OfficeAddonSubscription.findByIdAndUpdate(existingSubscription._id, {
            status: "cancelled",
          });
          console.log(`[OfficeAddonCheckout] Cancelled old subscription ${existingSubscription._id} to apply coupon`);
          // Continue to create new subscription with coupon below
        } else if (existingSubscription.status === "created" && existingSubscription.shortUrl) {
          // Return existing subscription for retry (no coupon case)
          return res.json({
            subscription: {
              _id: existingSubscription._id,
              status: existingSubscription.status,
              shortUrl: existingSubscription.shortUrl,
            },
            message: "Existing subscription found. Please complete payment.",
          });
        } else {
          return res.status(400).json({
            error: "Organization already has this add-on subscription",
            subscriptionStatus: existingSubscription.status,
          });
        }
      }

      // Get founder details
      const founder = await User.findById(user.userId)
        .select("name email phone")
        .lean();

      if (!founder) {
        return res.status(404).json({ error: "User not found" });
      }

      // Validate coupon if provided
      let appliedCoupon: any = null;
      let discountAmount = 0;
      let couponUsageId: string | undefined;

      if (couponCode) {
        const couponValidation = await validateCoupon({
          code: couponCode,
          itemType: "office_addon",
          itemId: addon._id.toString(),
          amount: addon.amount,
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
      const finalAmount = addon.amount - discountAmount;

      let subscription;

      // If coupon applied WITHOUT razorpayOfferId, create a discounted plan
      if (appliedCoupon && !appliedCoupon.razorpayOfferId) {
        console.log(`[OfficeAddonCheckout] Creating discounted plan for coupon ${appliedCoupon.code}`);

        // Calculate total amount with GST for the discounted price
        const taxRate = addon.taxRate ?? ADDON_GST_CONFIG.rate;
        const { totalAmount: discountedTotalAmount } = calculateAddonTaxAmounts(finalAmount, taxRate);

        // Create a new Razorpay plan with the discounted price
        const discountedPlan = await createRazorpayPlan({
          period: addon.period === "yearly" ? "yearly" : "monthly",
          interval: 1,
          item: {
            name: `${addon.name} Add-on (Coupon: ${appliedCoupon.code})`,
            amount: discountedTotalAmount,
            currency: addon.currency || "USD",
            description: `${addon.description} - ${appliedCoupon.discountValue}% discount applied`,
            tax_inclusive: true,
          },
          notes: {
            planType: "office_addon_discounted",
            originalAddonSlug: addonSlug,
            couponCode: appliedCoupon.code,
            discountPercent: String(appliedCoupon.discountValue),
            baseAmount: String(finalAmount),
            taxRate: String(taxRate),
          },
        });

        console.log(`[OfficeAddonCheckout] Created discounted Razorpay plan: ${discountedPlan.id} with amount $${discountedTotalAmount / 100}`);

        // Create subscription directly with the discounted plan
        const razorpaySubscription = await createRazorpaySubscription({
          plan_id: discountedPlan.id,
          total_count: 10, // 10 years for yearly billing
          customer_notify: 1,
          notes: {
            type: "office_addon_subscription",
            orgId,
            founderId: user.userId,
            addonId: addon._id.toString(),
            addonSlug: addon.slug,
            founderEmail: founder.email || "",
            founderName: founder.name || "",
            gstin: gstin || "",
            couponCode: appliedCoupon.code,
            discountPercent: String(appliedCoupon.discountValue),
          },
        });

        // Create subscription record in database
        subscription = await OfficeAddonSubscription.create({
          orgId: new Types.ObjectId(orgId),
          founderId: new Types.ObjectId(user.userId),
          addonId: addon._id,
          razorpaySubscriptionId: razorpaySubscription.id,
          razorpayPlanId: discountedPlan.id, // Use the discounted plan ID
          status: "created",
          totalCount: razorpaySubscription.total_count || 10,
          paidCount: 0,
          remainingCount: razorpaySubscription.remaining_count || 10,
          shortUrl: razorpaySubscription.short_url,
        });

        console.log(`[OfficeAddonCheckout] Created discounted addon subscription for org ${orgId}: ${subscription._id}`);
      } else {
        // Standard flow: use existing plan (with optional razorpayOfferId)
        subscription = await createOfficeAddonSubscription({
          orgId,
          founderId: user.userId,
          addonSlug,
          founderEmail: founder.email || undefined,
          founderName: founder.name || undefined,
          founderPhone: founder.phone || undefined,
          gstin,
          offerId: appliedCoupon?.razorpayOfferId || undefined,
        });
      }

      // Record coupon usage for subscription
      if (appliedCoupon) {
        const usage = await recordCouponUsage({
          couponId: appliedCoupon._id.toString(),
          userId: user.userId,
          orgId,
          transactionType: "subscription",
          transactionId: subscription.razorpaySubscriptionId || String(subscription._id),
          itemType: "office_addon",
          itemId: addon._id.toString(),
          originalAmount: addon.amount,
          discountAmount,
          finalAmount: addon.amount - discountAmount,
        });
        couponUsageId = usage._id.toString();
      }

      res.json({
        subscription: {
          _id: subscription._id,
          status: subscription.status,
          shortUrl: subscription.shortUrl,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        },
        coupon: appliedCoupon ? {
          code: appliedCoupon.code,
          discountValue: appliedCoupon.discountValue,
          discountAmount,
          hasRazorpayOffer: !!appliedCoupon.razorpayOfferId,
        } : null,
        couponUsageId,
        message: "Subscription created. Please complete payment using the shortUrl.",
      });
    } catch (error: any) {
      console.error("Error creating add-on subscription:", error);
      res.status(500).json({
        error: error.message || "Failed to create subscription",
      });
    }
  }
);

/**
 * GET /checkout/office-addon/:orgId/verify
 * Verify add-on subscription status after Razorpay redirect (authenticated)
 * Query params:
 * - razorpay_subscription_id: string
 * - couponUsageId?: string
 */
router.get(
  "/:orgId/verify",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { razorpay_subscription_id, couponUsageId } = req.query;
      const user = (req as any).user as { userId: string; orgId: string };

      // Validate user owns this org
      if (user.orgId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!razorpay_subscription_id) {
        return res
          .status(400)
          .json({ error: "razorpay_subscription_id is required" });
      }

      // Find subscription by Razorpay ID
      const { OfficeAddonSubscription } = await import(
        "../models/officeAddonSubscription.model"
      );
      const subscription = await OfficeAddonSubscription.findOne({
        razorpaySubscriptionId: razorpay_subscription_id as string,
        orgId: new Types.ObjectId(orgId),
      }).populate("addonId");

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Sync with Razorpay to get latest status
      const synced = await syncOfficeAddonSubscriptionStatus(
        subscription._id.toString()
      );

      // Check if subscription is now active/authenticated
      const newStatus = synced?.status || subscription.status;
      const validStatuses = ["authenticated", "active"];
      if (validStatuses.includes(newStatus) && couponUsageId) {
        // Mark coupon usage as applied
        await markUsageApplied(couponUsageId as string);
      }

      res.json({
        subscription: {
          _id: synced?._id || subscription._id,
          status: synced?.status || subscription.status,
          addonId: synced?.addonId || subscription.addonId,
          currentStart: synced?.currentStart || subscription.currentStart,
          currentEnd: synced?.currentEnd || subscription.currentEnd,
          chargeAt: synced?.chargeAt || subscription.chargeAt,
          paidCount: synced?.paidCount || subscription.paidCount,
        },
      });
    } catch (error) {
      console.error("Error verifying add-on subscription:", error);

      // Mark coupon usage as failed if provided
      const { couponUsageId } = req.query;
      if (couponUsageId) {
        await markUsageFailed(couponUsageId as string).catch(console.error);
      }

      res.status(500).json({ error: "Failed to verify subscription" });
    }
  }
);

/**
 * POST /checkout/office-addon/:orgId/sync
 * Manually sync subscription status from Razorpay (for development/recovery)
 * This is useful when webhooks don't fire (e.g., localhost development)
 */
router.post(
  "/:orgId/sync",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const user = (req as any).user as { userId: string; orgId: string };

      // Validate user owns this org
      if (user.orgId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get all subscriptions for this org
      const subscriptions = await getOfficeAddonSubscriptions(orgId);

      if (subscriptions.length === 0) {
        return res.json({ message: "No subscriptions to sync", synced: [] });
      }

      const synced = [];
      for (const sub of subscriptions) {
        if (sub.razorpaySubscriptionId) {
          try {
            // Fetch from Razorpay
            const razorpaySub = await fetchSubscription(sub.razorpaySubscriptionId);

            // Import the model to update directly
            const { OfficeAddonSubscription } = await import(
              "../models/officeAddonSubscription.model"
            );

            // Update subscription status
            const updated = await OfficeAddonSubscription.findByIdAndUpdate(
              sub._id,
              {
                status: razorpaySub.status,
                currentStart: razorpaySub.current_start
                  ? new Date(razorpaySub.current_start * 1000)
                  : undefined,
                currentEnd: razorpaySub.current_end
                  ? new Date(razorpaySub.current_end * 1000)
                  : undefined,
                chargeAt: razorpaySub.charge_at
                  ? new Date(razorpaySub.charge_at * 1000)
                  : undefined,
                paidCount: razorpaySub.paid_count,
                remainingCount: razorpaySub.remaining_count,
                paymentMethod: razorpaySub.payment_method,
                startedAt:
                  razorpaySub.status === "active" && !sub.startedAt
                    ? new Date()
                    : sub.startedAt,
              },
              { new: true }
            ).populate("addonId");

            synced.push({
              _id: updated?._id,
              addonSlug: (updated?.addonId as any)?.slug,
              oldStatus: sub.status,
              newStatus: updated?.status,
              paidCount: updated?.paidCount,
            });
          } catch (err: any) {
            console.error(
              `Failed to sync subscription ${sub.razorpaySubscriptionId}:`,
              err.message
            );
          }
        }
      }

      res.json({
        message: `Synced ${synced.length} subscription(s)`,
        synced,
      });
    } catch (error) {
      console.error("Error syncing add-on subscriptions:", error);
      res.status(500).json({ error: "Failed to sync subscriptions" });
    }
  }
);

/**
 * GET /checkout/office-addon/:orgId/check/:addonSlug
 * Quick check if org has a specific add-on active (authenticated)
 */
router.get(
  "/:orgId/check/:addonSlug",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { orgId, addonSlug } = req.params;
      const user = (req as any).user as { userId: string; orgId: string };

      // Validate user owns this org
      if (user.orgId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const isActive = await hasActiveAddon(orgId, addonSlug);

      res.json({ isActive });
    } catch (error) {
      console.error("Error checking add-on status:", error);
      res.status(500).json({ error: "Failed to check add-on status" });
    }
  }
);

export default router;
