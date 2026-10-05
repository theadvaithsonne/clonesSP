import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { SubscriptionPlan } from "../models/subscriptionPlan.model";
import { Subscription } from "../models/subscription.model";
import { SubscriptionPayment } from "../models/subscriptionPayment.model";
import {
  cancelUserSubscription,
  syncSubscriptionStatus,
} from "../services/subscription";
import { User } from "../models/user.model";

const router = Router();

// Helper to check if user is founder/admin in the org
async function isUserAdmin(userId: string, orgId: string): Promise<boolean> {
  const user = await User.findById(userId)
    .select("role organization organizations")
    .lean();

  if (!user) return false;

  // Legacy check
  if (
    user.organization?.toString() === orgId &&
    ["admin", "founder"].includes(user.role || "")
  ) {
    return true;
  }

  // New multiple org check
  if (user.organizations) {
    const membership = user.organizations.find(
      (m: any) => m.organization.toString() === orgId
    );
    if (membership && hasFounderAccess(membership)) {
      return true;
    }
  }

  return false;
}

// ============= Plan Management =============

/**
 * GET /subscription-admin/plans
 * Get all subscription plans for the organization
 */
router.get("/plans", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    // Verify admin access
    const isAdmin = await isUserAdmin(me.userId, me.orgId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const schema = z.object({
      itemType: z.enum(["channel", "course", "workshop", "product"]).optional(),
      isActive: z
        .string()
        .optional()
        .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 50)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });

    const { itemType, isActive, limit, offset } = schema.parse(req.query);

    const query: any = { orgId: new Types.ObjectId(me.orgId) };
    if (itemType) query.itemType = itemType;
    if (isActive !== undefined) query.isActive = isActive;

    const [plans, total] = await Promise.all([
      SubscriptionPlan.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("sellerId", "name email profilePicture")
        .lean(),
      SubscriptionPlan.countDocuments(query),
    ]);

    res.json({
      success: true,
      plans: plans.map((plan) => ({
        id: plan._id,
        razorpayPlanId: plan.razorpayPlanId,
        itemType: plan.itemType,
        itemId: plan.itemId,
        name: plan.name,
        description: plan.description,
        amount: plan.amount,
        currency: plan.currency,
        period: plan.period,
        isActive: plan.isActive,
        seller: plan.sellerId,
        createdAt: plan.createdAt,
      })),
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + plans.length < total,
      },
    });
  } catch (error) {
    console.error("Error getting plans:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get plans",
      details: (error as Error).message,
    });
  }
});

// ============= Subscription Management =============

/**
 * GET /subscription-admin/subscriptions
 * Get all subscriptions for the organization
 */
router.get("/subscriptions", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    // Verify admin access
    const isAdmin = await isUserAdmin(me.userId, me.orgId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const schema = z.object({
      status: z.string().optional(),
      itemType: z.enum(["channel", "course", "workshop", "product"]).optional(),
      sellerId: z.string().optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 50)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });

    const { status, itemType, sellerId, limit, offset } = schema.parse(
      req.query
    );

    const query: any = { orgId: new Types.ObjectId(me.orgId) };
    if (status) query.status = status;
    if (itemType) query.itemType = itemType;
    if (sellerId) query.sellerId = new Types.ObjectId(sellerId);

    const [subscriptions, total] = await Promise.all([
      Subscription.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("userId", "name email profilePicture")
        .populate("sellerId", "name email profilePicture")
        .populate("planId", "name amount period")
        .lean(),
      Subscription.countDocuments(query),
    ]);

    res.json({
      success: true,
      subscriptions: subscriptions.map((sub) => ({
        id: sub._id,
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
        status: sub.status,
        itemType: sub.itemType,
        itemId: sub.itemId,
        user: sub.userId,
        seller: sub.sellerId,
        plan: sub.planId,
        currentStart: sub.currentStart,
        currentEnd: sub.currentEnd,
        chargeAt: sub.chargeAt,
        paidCount: sub.paidCount,
        totalCount: sub.totalCount,
        startedAt: sub.startedAt,
        cancelledAt: sub.cancelledAt,
        createdAt: sub.createdAt,
      })),
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + subscriptions.length < total,
      },
    });
  } catch (error) {
    console.error("Error getting subscriptions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get subscriptions",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /subscription-admin/subscriptions/:subscriptionId
 * Get detailed subscription info
 */
router.get("/subscriptions/:subscriptionId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    const { subscriptionId } = req.params;

    // Verify admin access
    const isAdmin = await isUserAdmin(me.userId, me.orgId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const subscription = await Subscription.findOne({
      _id: new Types.ObjectId(subscriptionId),
      orgId: new Types.ObjectId(me.orgId),
    })
      .populate("userId", "name email profilePicture phone")
      .populate("sellerId", "name email profilePicture")
      .populate("planId")
      .lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    // Get payment history
    const payments = await SubscriptionPayment.find({
      subscriptionId: new Types.ObjectId(subscriptionId),
    })
      .sort({ paymentNumber: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        status: subscription.status,
        itemType: subscription.itemType,
        itemId: subscription.itemId,
        user: subscription.userId,
        seller: subscription.sellerId,
        plan: subscription.planId,
        currentStart: subscription.currentStart,
        currentEnd: subscription.currentEnd,
        chargeAt: subscription.chargeAt,
        paidCount: subscription.paidCount,
        totalCount: subscription.totalCount,
        remainingCount: subscription.remainingCount,
        paymentMethod: subscription.paymentMethod,
        startedAt: subscription.startedAt,
        cancelledAt: subscription.cancelledAt,
        pausedAt: subscription.pausedAt,
        endedAt: subscription.endedAt,
        shortUrl: subscription.shortUrl,
        createdAt: subscription.createdAt,
      },
      recentPayments: payments.map((p) => ({
        id: p._id,
        razorpayPaymentId: p.razorpayPaymentId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentNumber: p.paymentNumber,
        method: p.method,
        paidAt: p.paidAt,
        commissionDistributed: p.commissionDistributed,
      })),
    });
  } catch (error) {
    console.error("Error getting subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get subscription",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /subscription-admin/subscriptions/:subscriptionId/cancel
 * Cancel a subscription (admin override)
 */
router.post(
  "/subscriptions/:subscriptionId/cancel",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };
      const { subscriptionId } = req.params;

      // Verify admin access
      const isAdmin = await isUserAdmin(me.userId, me.orgId);
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const schema = z.object({
        cancelAtCycleEnd: z.boolean().default(true),
        reason: z.string().optional(),
      });

      const { cancelAtCycleEnd, reason } = schema.parse(req.body);

      // Verify subscription belongs to org
      const subscription = await Subscription.findOne({
        _id: new Types.ObjectId(subscriptionId),
        orgId: new Types.ObjectId(me.orgId),
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: "Subscription not found",
        });
      }

      const updatedSubscription = await cancelUserSubscription(
        subscriptionId,
        cancelAtCycleEnd
      );

      // Log admin action
      console.log(
        `[Admin] Subscription ${subscriptionId} cancelled by admin ${me.userId}. Reason: ${reason || "Not provided"}`
      );

      res.json({
        success: true,
        message: cancelAtCycleEnd
          ? `Subscription will be cancelled at end of billing cycle`
          : "Subscription cancelled immediately",
        subscription: {
          id: updatedSubscription._id,
          status: updatedSubscription.status,
          currentEnd: updatedSubscription.currentEnd,
          cancelledAt: updatedSubscription.cancelledAt,
        },
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({
        success: false,
        error: "Failed to cancel subscription",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * POST /subscription-admin/subscriptions/:subscriptionId/sync
 * Sync subscription with Razorpay
 */
router.post(
  "/subscriptions/:subscriptionId/sync",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };
      const { subscriptionId } = req.params;

      // Verify admin access
      const isAdmin = await isUserAdmin(me.userId, me.orgId);
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      // Verify subscription belongs to org
      const subscription = await Subscription.findOne({
        _id: new Types.ObjectId(subscriptionId),
        orgId: new Types.ObjectId(me.orgId),
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: "Subscription not found",
        });
      }

      const syncedSubscription = await syncSubscriptionStatus(subscriptionId);

      res.json({
        success: true,
        message: "Subscription synced with Razorpay",
        subscription: {
          id: syncedSubscription?._id,
          status: syncedSubscription?.status,
          currentEnd: syncedSubscription?.currentEnd,
          paidCount: syncedSubscription?.paidCount,
        },
      });
    } catch (error) {
      console.error("Error syncing subscription:", error);
      res.status(500).json({
        success: false,
        error: "Failed to sync subscription",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * POST /subscription-admin/subscriptions/:subscriptionId/extend
 * Manually extend subscription end date (admin override)
 */
router.post(
  "/subscriptions/:subscriptionId/extend",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string; orgId: string };
      const { subscriptionId } = req.params;

      // Verify admin access
      const isAdmin = await isUserAdmin(me.userId, me.orgId);
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const schema = z.object({
        days: z.number().min(1).max(365),
        reason: z.string().min(1),
      });

      const { days, reason } = schema.parse(req.body);

      // Verify subscription belongs to org
      const subscription = await Subscription.findOne({
        _id: new Types.ObjectId(subscriptionId),
        orgId: new Types.ObjectId(me.orgId),
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: "Subscription not found",
        });
      }

      // Extend the end date
      const currentEnd = subscription.currentEnd || new Date();
      const newEnd = new Date(currentEnd);
      newEnd.setDate(newEnd.getDate() + days);

      subscription.currentEnd = newEnd;
      subscription.metadata = {
        ...subscription.metadata,
        manualExtension: {
          extendedBy: me.userId,
          extendedAt: new Date(),
          days,
          reason,
          previousEnd: currentEnd,
        },
      };
      await subscription.save();

      // Log admin action
      console.log(
        `[Admin] Subscription ${subscriptionId} extended by ${days} days by admin ${me.userId}. Reason: ${reason}`
      );

      res.json({
        success: true,
        message: `Subscription extended by ${days} days`,
        subscription: {
          id: subscription._id,
          previousEnd: currentEnd,
          newEnd,
        },
      });
    } catch (error) {
      console.error("Error extending subscription:", error);
      res.status(500).json({
        success: false,
        error: "Failed to extend subscription",
        details: (error as Error).message,
      });
    }
  }
);

// ============= Analytics =============

/**
 * GET /subscription-admin/analytics
 * Get subscription analytics for the organization
 */
router.get("/analytics", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    // Verify admin access
    const isAdmin = await isUserAdmin(me.userId, me.orgId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const orgId = new Types.ObjectId(me.orgId);

    // Get subscription counts by status
    const statusCounts = await Subscription.aggregate([
      { $match: { orgId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Get subscription counts by item type
    const itemTypeCounts = await Subscription.aggregate([
      { $match: { orgId, status: "active" } },
      { $group: { _id: "$itemType", count: { $sum: 1 } } },
    ]);

    // Get total revenue
    const revenueStats = await SubscriptionPayment.aggregate([
      { $match: { orgId, status: "captured" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          paymentCount: { $sum: 1 },
        },
      },
    ]);

    // Get monthly revenue (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await SubscriptionPayment.aggregate([
      {
        $match: {
          orgId,
          status: "captured",
          paidAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$paidAt" },
            month: { $month: "$paidAt" },
          },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Get recent subscriptions
    const recentSubscriptions = await Subscription.find({ orgId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "name email")
      .populate("planId", "name amount")
      .lean();

    res.json({
      success: true,
      analytics: {
        byStatus: statusCounts.reduce(
          (acc, s) => {
            acc[s._id] = s.count;
            return acc;
          },
          {} as Record<string, number>
        ),
        byItemType: itemTypeCounts.reduce(
          (acc, s) => {
            acc[s._id] = s.count;
            return acc;
          },
          {} as Record<string, number>
        ),
        revenue: {
          total: revenueStats[0]?.totalRevenue || 0,
          paymentCount: revenueStats[0]?.paymentCount || 0,
        },
        monthlyRevenue: monthlyRevenue.map((m) => ({
          year: m._id.year,
          month: m._id.month,
          revenue: m.revenue,
          count: m.count,
        })),
        recentSubscriptions: recentSubscriptions.map((sub) => ({
          id: sub._id,
          status: sub.status,
          user: sub.userId,
          plan: sub.planId,
          createdAt: sub.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get analytics",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /subscription-admin/payments
 * Get all subscription payments for the organization
 */
router.get("/payments", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    // Verify admin access
    const isAdmin = await isUserAdmin(me.userId, me.orgId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const schema = z.object({
      status: z.enum(["created", "authorized", "captured", "failed", "refunded"]).optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 50)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });

    const { status, limit, offset } = schema.parse(req.query);

    const query: any = { orgId: new Types.ObjectId(me.orgId) };
    if (status) query.status = status;

    const [payments, total] = await Promise.all([
      SubscriptionPayment.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("userId", "name email")
        .populate("subscriptionId", "itemType itemId")
        .lean(),
      SubscriptionPayment.countDocuments(query),
    ]);

    res.json({
      success: true,
      payments: payments.map((p) => ({
        id: p._id,
        razorpayPaymentId: p.razorpayPaymentId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentNumber: p.paymentNumber,
        method: p.method,
        user: p.userId,
        subscription: p.subscriptionId,
        commissionDistributed: p.commissionDistributed,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + payments.length < total,
      },
    });
  } catch (error) {
    console.error("Error getting payments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get payments",
      details: (error as Error).message,
    });
  }
});

export default router;
