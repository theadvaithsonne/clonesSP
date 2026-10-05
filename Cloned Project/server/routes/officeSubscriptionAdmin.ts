import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { Types } from "mongoose";
import { z } from "zod";
import {
  getOfficePlans,
  getOfficeSubscription,
  getActiveOfficeSubscription,
  hasActiveOfficeSubscription,
  canInviteStakeholders,
  cancelOfficeSubscription,
  syncOfficeSubscriptionStatus,
  initializeOfficePlans,
  getTrialInfo,
  computeOfficeGraceState,
  OFFICE_GRACE_PERIOD_DAYS,
} from "../services/officeSubscription";
import { OfficePlan, IOfficePlan } from "../models/officePlan.model";
import { OfficeSubscription } from "../models/officeSubscription.model";
import { OfficeSubscriptionPayment } from "../models/officeSubscriptionPayment.model";
import { OfficeUpgradeHistory } from "../models/officeUpgradeHistory.model";

const router = Router();

/**
 * GET /office-subscription/status?orgId=xxx
 * Get current organization's subscription status
 */
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    const hasActive = await hasActiveOfficeSubscription(orgId);
    const subscription = await getOfficeSubscription(orgId);
    const canInvite = await canInviteStakeholders(orgId);
    const trialInfo = getTrialInfo(subscription);

    // planId is already populated by getOfficeSubscription, so we can use it directly
    let plan: IOfficePlan | null = null;
    if (subscription?.planId) {
      // Check if planId is already populated (has name property) or is just an ObjectId
      if (typeof subscription.planId === "object" && "name" in subscription.planId) {
        // Already populated
        plan = subscription.planId as unknown as IOfficePlan;
      } else {
        // Need to fetch it
        plan = await OfficePlan.findById(subscription.planId).lean();
      }
    }

    // Surface a scheduled Pro→Starter downgrade so the FE can render the
    // pending-switch state on the sidebar without a second API call.
    const scheduledDowngradeMeta =
      (subscription?.metadata as any)?.scheduledDowngrade;
    const scheduledDowngrade =
      scheduledDowngradeMeta?.toSlug === "starter" &&
      scheduledDowngradeMeta?.effectiveAt
        ? {
            toSlug: "starter" as const,
            effectiveAt: new Date(scheduledDowngradeMeta.effectiveAt),
            requestedAt: scheduledDowngradeMeta.requestedAt
              ? new Date(scheduledDowngradeMeta.requestedAt)
              : null,
          }
        : null;

    // Pro-plan grace state — surfaced so the FE can render "Your Pro
    // payment failed, you have N days to pay before we switch you to
    // Starter". Null for Starter/trial/etc.
    const graceInfo = computeOfficeGraceState(subscription);
    const grace = graceInfo.graceEndsAt
      ? {
          inGrace: graceInfo.inGrace,
          lapsed: graceInfo.lapsed,
          graceEndsAt: graceInfo.graceEndsAt,
          daysRemaining: graceInfo.daysRemaining,
          gracePeriodDays: OFFICE_GRACE_PERIOD_DAYS,
        }
      : null;

    res.json({
      hasActiveSubscription: hasActive,
      canInviteStakeholders: canInvite,
      subscription: subscription
        ? {
            _id: subscription._id,
            status: subscription.status,
            currentStart: subscription.currentStart,
            currentEnd: subscription.currentEnd,
            chargeAt: subscription.chargeAt,
            paidCount: subscription.paidCount,
            startedAt: subscription.startedAt,
            razorpaySubscriptionId: subscription.razorpaySubscriptionId,
            createdAt: subscription.createdAt,
            paymentMethod: subscription.paymentMethod,
            planId: plan
              ? {
                  _id: plan._id,
                  name: plan.name,
                  slug: plan.slug,
                  amount: plan.amount / 100,
                  period: plan.period,
                  features: plan.features,
                  canInviteStakeholders: plan.canInviteStakeholders,
                }
              : null,
            scheduledDowngrade,
            grace,
            // Trial info
            ...trialInfo,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

/**
 * GET /office-subscription/plans
 * Get all available office plans
 */
router.get("/plans", requireAuth, async (req: Request, res: Response) => {
  try {
    const plans = await getOfficePlans();

    const formattedPlans = plans.map((plan) => ({
      _id: plan._id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      amount: plan.amount / 100,
      currency: plan.currency,
      period: plan.period,
      features: plan.features,
      canInviteStakeholders: plan.canInviteStakeholders,
      maxStakeholders: plan.maxStakeholders,
      isDefault: plan.isDefault,
    }));

    res.json({ plans: formattedPlans });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

/**
 * GET /office-subscription/payments?orgId=xxx
 * Get payment history for current organization (founder only)
 * Includes both recurring subscription payments AND upgrade payments
 */
router.get("/payments", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string; role?: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    if (user.role !== "founder") {
      return res.status(403).json({ error: "Only founders can view payment history" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    // Get subscription payments (query by orgId to include payments from previous subscriptions)
    const subscriptionPayments = await OfficeSubscriptionPayment.find({
      orgId: new Types.ObjectId(orgId),
    })
      .sort({ paidAt: -1 })
      .populate("subscriptionId", "planId")
      .lean();

    // Get upgrade payments (completed upgrades only)
    const upgradePayments = await OfficeUpgradeHistory.find({
      orgId: new Types.ObjectId(orgId),
      status: "completed",
    })
      .sort({ completedAt: -1 })
      .lean();

    // Combine and format all transactions
    const allTransactions: any[] = [];

    // Add subscription payments
    for (const p of subscriptionPayments) {
      allTransactions.push({
        _id: p._id,
        type: "subscription",
        description: `Subscription payment #${p.paymentNumber}`,
        paymentNumber: p.paymentNumber,
        amount: p.amount / 100,
        currency: p.currency || "INR",
        status: p.status,
        method: p.method,
        paidAt: p.paidAt,
        razorpayPaymentId: p.razorpayPaymentId,
        razorpayInvoiceId: p.razorpayInvoiceId,
        invoiceShortUrl: (p as any).invoiceShortUrl,
        razorpayOrderId: p.razorpayOrderId,
        fee: p.fee ? p.fee / 100 : null,
        tax: p.tax ? p.tax / 100 : null,
        vpa: p.vpa,
        bank: p.bank,
        wallet: p.wallet,
      });
    }

    // Add upgrade records (now credit to wallet, not payment)
    for (const u of upgradePayments) {
      allTransactions.push({
        _id: u._id,
        type: "upgrade",
        description: `Plan upgrade: ${u.previousPlanSlug} → ${u.newPlanSlug}`,
        // Credit amount added to wallet (base amount, not a payment)
        amount: u.creditCalculation?.creditAmount ? u.creditCalculation.creditAmount / 100 : 0,
        currency: "USD",
        status: u.status,
        method: "wallet_credit",
        paidAt: u.completedAt,
        // Credit calculation details
        creditDetails: {
          daysRemaining: u.creditCalculation?.daysRemaining,
          totalDaysInCycle: u.creditCalculation?.totalDaysInCycle,
          creditAmount: u.creditCalculation?.creditAmount ? u.creditCalculation.creditAmount / 100 : null,
        },
      });
    }

    // Sort all transactions by date (most recent first)
    allTransactions.sort((a, b) => {
      const dateA = new Date(a.paidAt || 0).getTime();
      const dateB = new Date(b.paidAt || 0).getTime();
      return dateB - dateA;
    });

    // Paginate
    const total = allTransactions.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedTransactions = allTransactions.slice(startIndex, startIndex + limit);

    res.json({
      payments: paginatedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

/**
 * POST /office-subscription/cancel?orgId=xxx
 * Cancel the organization's subscription (founder only)
 */
router.post("/cancel", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string; role?: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    if (user.role !== "founder") {
      return res.status(403).json({ error: "Only founders can cancel subscription" });
    }

    const subscription = await getActiveOfficeSubscription(orgId);
    if (!subscription) {
      return res.status(404).json({ error: "No active subscription found" });
    }

    const { cancelAtCycleEnd = true } = req.body;

    const cancelled = await cancelOfficeSubscription(
      subscription._id.toString(),
      cancelAtCycleEnd
    );

    res.json({
      success: true,
      message: cancelAtCycleEnd
        ? `Subscription will be cancelled at the end of the billing cycle (${cancelled.currentEnd?.toLocaleDateString()})`
        : "Subscription cancelled immediately",
      subscription: {
        _id: cancelled._id,
        status: cancelled.status,
        currentEnd: cancelled.currentEnd,
        cancelledAt: cancelled.cancelledAt,
      },
    });
  } catch (error: any) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({ error: error.message || "Failed to cancel subscription" });
  }
});

/**
 * POST /office-subscription/sync?orgId=xxx
 * Sync subscription status with Razorpay (founder only)
 */
router.post("/sync", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string; role?: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    if (user.role !== "founder") {
      return res.status(403).json({ error: "Only founders can sync subscription" });
    }

    const subscription = await getOfficeSubscription(orgId);
    if (!subscription) {
      return res.status(404).json({ error: "No subscription found" });
    }

    const synced = await syncOfficeSubscriptionStatus(subscription._id.toString());

    res.json({
      success: true,
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
    });
  } catch (error: any) {
    console.error("Error syncing subscription:", error);
    res.status(500).json({ error: error.message || "Failed to sync subscription" });
  }
});

/**
 * POST /office-subscription/init-plans
 * Initialize office plans in Razorpay and database (admin only)
 * This should be called once to set up the plans
 */
router.post("/init-plans", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; email?: string };

    // Only allow shorupan@gmail.com to initialize plans
    if (user.email !== "shorupan@gmail.com") {
      return res.status(403).json({ error: "Access denied" });
    }

    const plans = await initializeOfficePlans();

    res.json({
      success: true,
      message: `Initialized ${plans.length} office plans`,
      plans: plans.map((p) => ({
        _id: p._id,
        name: p.name,
        slug: p.slug,
        razorpayPlanId: p.razorpayPlanId,
      })),
    });
  } catch (error: any) {
    console.error("Error initializing plans:", error);
    res.status(500).json({ error: error.message || "Failed to initialize plans" });
  }
});

/**
 * POST /office-subscription/backfill-invoices
 * Backfill invoice short URLs for existing payments (admin only)
 * Handles both office subscription payments and regular subscription payments
 */
router.post("/backfill-invoices", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; email?: string };

    // Only allow shorupan@gmail.com
    if (user.email !== "shorupan@gmail.com") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Import fetchInvoice and SubscriptionPayment
    const { fetchInvoice } = await import("../services/razorpay");
    const { SubscriptionPayment } = await import("../models/subscriptionPayment.model");

    const results: { type: string; paymentId: string; success: boolean; error?: string }[] = [];

    // 1. Backfill Office Subscription Payments
    const officePayments = await OfficeSubscriptionPayment.find({
      razorpayInvoiceId: { $exists: true, $ne: null },
      $or: [
        { invoiceShortUrl: { $exists: false } },
        { invoiceShortUrl: null },
        { invoiceShortUrl: "" },
      ],
    });

    for (const payment of officePayments) {
      try {
        const invoice = await fetchInvoice(payment.razorpayInvoiceId!);
        payment.set("invoiceShortUrl", invoice.short_url);
        await payment.save();
        results.push({ type: "office", paymentId: payment._id.toString(), success: true });
        console.log(`[Backfill] Updated office payment ${payment._id} with invoice URL: ${invoice.short_url}`);
      } catch (error: any) {
        results.push({
          type: "office",
          paymentId: payment._id.toString(),
          success: false,
          error: error.message,
        });
        console.error(`[Backfill] Failed for office payment ${payment._id}:`, error.message);
      }
    }

    // 2. Backfill Regular Subscription Payments (channels, courses, workshops)
    const regularPayments = await SubscriptionPayment.find({
      razorpayInvoiceId: { $exists: true, $ne: null },
      $or: [
        { invoiceShortUrl: { $exists: false } },
        { invoiceShortUrl: null },
        { invoiceShortUrl: "" },
      ],
    });

    for (const payment of regularPayments) {
      try {
        const invoice = await fetchInvoice(payment.razorpayInvoiceId!);
        payment.set("invoiceShortUrl", invoice.short_url);
        await payment.save();
        results.push({ type: "subscription", paymentId: payment._id.toString(), success: true });
        console.log(`[Backfill] Updated subscription payment ${payment._id} with invoice URL: ${invoice.short_url}`);
      } catch (error: any) {
        results.push({
          type: "subscription",
          paymentId: payment._id.toString(),
          success: false,
          error: error.message,
        });
        console.error(`[Backfill] Failed for subscription payment ${payment._id}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Processed ${officePayments.length} office payments and ${regularPayments.length} subscription payments`,
      results,
    });
  } catch (error: any) {
    console.error("Error backfilling invoices:", error);
    res.status(500).json({ error: error.message || "Failed to backfill invoices" });
  }
});

export default router;
