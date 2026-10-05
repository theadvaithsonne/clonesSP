import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { Types } from "mongoose";
import {
  getOfficeAddonSubscriptions,
  getActiveOfficeAddonSubscription,
  getOfficeAddonPayments,
  hasActiveAddon,
} from "../services/officeAddonSubscription";
import { calculateAddonTaxAmounts, ADDON_GST_CONFIG } from "../models/officeAddon.model";

const router = Router();

/**
 * GET /office-addon-subscription/status
 * Get all add-on subscriptions for an organization
 * Query params:
 * - orgId: string (required)
 */
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;
    const user = (req as any).user as { userId: string; orgId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get all add-on subscriptions
    const subscriptions = await getOfficeAddonSubscriptions(orgId);

    // Format for frontend
    const formattedSubscriptions = subscriptions.map((sub) => {
      const addon = sub.addonId as any;
      const taxRate = addon?.taxRate ?? ADDON_GST_CONFIG.rate;
      const { baseAmount, taxAmount, totalAmount } = calculateAddonTaxAmounts(
        addon?.amount || 0,
        taxRate
      );

      return {
        _id: sub._id,
        orgId: sub.orgId,
        founderId: sub.founderId,
        addonId: addon
          ? {
              _id: addon._id,
              name: addon.name,
              slug: addon.slug,
              amount: baseAmount / 100,
              taxAmount: taxAmount / 100,
              totalAmount: totalAmount / 100,
              period: addon.period,
              features: addon.features,
            }
          : null,
        status: sub.status,
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
        currentStart: sub.currentStart,
        currentEnd: sub.currentEnd,
        chargeAt: sub.chargeAt,
        startedAt: sub.startedAt,
        paidCount: sub.paidCount,
        paymentMethod: sub.paymentMethod,
        createdAt: sub.createdAt,
      };
    });

    res.json({ subscriptions: formattedSubscriptions });
  } catch (error) {
    console.error("Error fetching add-on subscriptions:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

/**
 * GET /office-addon-subscription/payments
 * Get all add-on payments for an organization
 * Query params:
 * - orgId: string (required)
 */
router.get("/payments", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;
    const user = (req as any).user as { userId: string; orgId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get all add-on payments
    const payments = await getOfficeAddonPayments(orgId);

    // Format for frontend
    const formattedPayments = payments.map((payment) => {
      const addon = payment.addonId as any;

      return {
        _id: payment._id,
        subscriptionId: payment.subscriptionId,
        addonId: addon
          ? {
              _id: addon._id,
              name: addon.name,
              slug: addon.slug,
            }
          : null,
        paymentNumber: payment.paymentNumber,
        amount: payment.amount, // Keep in paise for consistency
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        paidAt: payment.paidAt,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayInvoiceId: payment.razorpayInvoiceId,
        invoiceShortUrl: payment.invoiceShortUrl,
        fee: payment.fee,
        tax: payment.tax,
        vpa: payment.vpa,
        bank: payment.bank,
        wallet: payment.wallet,
        createdAt: payment.createdAt,
      };
    });

    res.json({ payments: formattedPayments });
  } catch (error) {
    console.error("Error fetching add-on payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

/**
 * GET /office-addon-subscription/check/:addonSlug
 * Quick check if current org has a specific add-on active
 * Params:
 * - addonSlug: string
 */
router.get(
  "/check/:addonSlug",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { addonSlug } = req.params;
      const user = (req as any).user as { userId: string; orgId: string };

      const isActive = await hasActiveAddon(user.orgId, addonSlug);

      res.json({ isActive });
    } catch (error) {
      console.error("Error checking add-on status:", error);
      res.status(500).json({ error: "Failed to check add-on status" });
    }
  }
);

/**
 * GET /office-addon-subscription/active
 * Get the active add-on subscription for a specific addon
 * Query params:
 * - orgId: string (required)
 * - addonSlug: string (optional)
 */
router.get("/active", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId, addonSlug } = req.query;
    const user = (req as any).user as { userId: string; orgId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    // Validate user owns this org
    if (user.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const subscription = await getActiveOfficeAddonSubscription(
      orgId,
      addonSlug as string | undefined
    );

    if (!subscription) {
      return res.json({ subscription: null });
    }

    const addon = subscription.addonId as any;
    const taxRate = addon?.taxRate ?? ADDON_GST_CONFIG.rate;
    const { baseAmount, taxAmount, totalAmount } = calculateAddonTaxAmounts(
      addon?.amount || 0,
      taxRate
    );

    res.json({
      subscription: {
        _id: subscription._id,
        orgId: subscription.orgId,
        founderId: subscription.founderId,
        addonId: addon
          ? {
              _id: addon._id,
              name: addon.name,
              slug: addon.slug,
              amount: baseAmount / 100,
              taxAmount: taxAmount / 100,
              totalAmount: totalAmount / 100,
              period: addon.period,
              features: addon.features,
            }
          : null,
        status: subscription.status,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        currentStart: subscription.currentStart,
        currentEnd: subscription.currentEnd,
        chargeAt: subscription.chargeAt,
        startedAt: subscription.startedAt,
        paidCount: subscription.paidCount,
        paymentMethod: subscription.paymentMethod,
        createdAt: subscription.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching active add-on subscription:", error);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

export default router;
