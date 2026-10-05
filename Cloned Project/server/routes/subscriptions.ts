import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import {
  createSubscriptionPlan,
  getSubscriptionPlanForItem,
  deactivateSubscriptionPlan,
  createUserSubscription,
  getUserSubscription,
  getUserActiveSubscription,
  getUserSubscriptions,
  cancelUserSubscription,
  pauseUserSubscription,
  resumeUserSubscription,
  hasSubscriptionAccess,
  syncSubscriptionStatus,
} from "../services/subscription";
import { SubscriptionPlan } from "../models/subscriptionPlan.model";
import { Subscription } from "../models/subscription.model";
import { SubscriptionPayment } from "../models/subscriptionPayment.model";
import { Channel } from "../models/channel.model";
import { User } from "../models/user.model";

const router = Router();

// ============= Plan Management (Seller/Creator) =============

/**
 * POST /subscriptions/plans
 * Create a subscription plan for a content item
 * Only the content owner/seller can create plans
 */
router.post("/plans", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    const schema = z.object({
      itemType: z.enum(["channel", "course", "workshop", "product"]),
      itemId: z.string(),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      amount: z.number().min(100), // Minimum 1 INR (100 paise)
      period: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
      trialDays: z.number().min(0).max(30).optional(),
    });

    const data = schema.parse(req.body);

    // TODO: Verify user is the owner/seller of the item
    // This should be customized based on itemType

    const plan = await createSubscriptionPlan({
      itemType: data.itemType,
      itemId: data.itemId,
      orgId: me.orgId,
      sellerId: me.userId,
      name: data.name,
      description: data.description,
      amount: data.amount,
      period: data.period,
      trialDays: data.trialDays,
    });

    res.status(201).json({
      success: true,
      plan: {
        id: plan._id,
        razorpayPlanId: plan.razorpayPlanId,
        itemType: plan.itemType,
        itemId: plan.itemId,
        name: plan.name,
        amount: plan.amount,
        period: plan.period,
        isActive: plan.isActive,
      },
    });
  } catch (error) {
    console.error("Error creating subscription plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create subscription plan",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /subscriptions/plans/:itemType/:itemId
 * Get subscription plan for an item
 */
router.get("/plans/:itemType/:itemId", async (req, res) => {
  try {
    const { itemType, itemId } = req.params;

    if (!["channel", "course", "workshop", "product"].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid item type",
      });
    }

    const plan = await getSubscriptionPlanForItem(itemType as any, itemId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "No subscription plan found for this item",
      });
    }

    res.json({
      success: true,
      plan: {
        id: plan._id,
        razorpayPlanId: plan.razorpayPlanId,
        itemType: plan.itemType,
        itemId: plan.itemId,
        name: plan.name,
        description: plan.description,
        amount: plan.amount,
        currency: plan.currency,
        period: plan.period,
        trialDays: plan.trialDays,
        isActive: plan.isActive,
      },
    });
  } catch (error) {
    console.error("Error getting subscription plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get subscription plan",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /subscriptions/plans/:planId
 * Deactivate a subscription plan
 */
router.delete("/plans/:planId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { planId } = req.params;

    // Verify user is the plan owner
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "Plan not found",
      });
    }

    if (plan.sellerId.toString() !== me.userId) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to deactivate this plan",
      });
    }

    const updatedPlan = await deactivateSubscriptionPlan(planId);

    res.json({
      success: true,
      message: "Plan deactivated",
      plan: {
        id: updatedPlan?._id,
        isActive: updatedPlan?.isActive,
      },
    });
  } catch (error) {
    console.error("Error deactivating plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to deactivate plan",
      details: (error as Error).message,
    });
  }
});

// ============= User Subscription Management =============

/**
 * POST /subscriptions/subscribe
 * Create a new subscription for the current user
 */
router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    const schema = z.object({
      planId: z.string(),
      totalCount: z.number().min(1).optional(), // null for infinite
    });

    const { planId, totalCount } = schema.parse(req.body);

    const subscription = await createUserSubscription({
      planId,
      userId: me.userId,
      orgId: me.orgId,
      totalCount,
    });

    res.status(201).json({
      success: true,
      subscription: {
        id: subscription._id,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        status: subscription.status,
        shortUrl: subscription.shortUrl, // User should be redirected to this URL to complete payment
        itemType: subscription.itemType,
        itemId: subscription.itemId,
      },
      message:
        "Subscription created. Please complete payment at the provided URL.",
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create subscription",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /subscriptions/my
 * Get current user's subscriptions
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    const schema = z.object({
      status: z
        .string()
        .optional()
        .transform((s) => (s ? s.split(",") : undefined)),
      itemType: z.enum(["channel", "course", "workshop", "product"]).optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });

    const { status, itemType, limit, offset } = schema.parse(req.query);

    const result = await getUserSubscriptions(me.userId, {
      status: status as any,
      itemType: itemType as any,
      limit,
      offset,
    });

    res.json({
      success: true,
      subscriptions: result.subscriptions.map((sub) => ({
        id: sub._id,
        status: sub.status,
        itemType: sub.itemType,
        itemId: sub.itemId,
        currentStart: sub.currentStart,
        currentEnd: sub.currentEnd,
        paidCount: sub.paidCount,
        plan: sub.planId,
      })),
      total: result.total,
      pagination: {
        limit,
        offset,
        hasMore: offset + result.subscriptions.length < result.total,
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
 * GET /subscriptions/check/:itemType/:itemId
 * Check if user has active subscription to an item
 */
router.get("/check/:itemType/:itemId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { itemType, itemId } = req.params;

    if (!["channel", "course", "workshop", "product"].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid item type",
      });
    }

    const hasAccess = await hasSubscriptionAccess(
      me.userId,
      itemType as any,
      itemId
    );

    const subscription = await getUserActiveSubscription(
      me.userId,
      itemType as any,
      itemId
    );

    res.json({
      success: true,
      hasAccess,
      subscription: subscription
        ? {
            id: subscription._id,
            status: subscription.status,
            currentEnd: subscription.currentEnd,
            paidCount: subscription.paidCount,
          }
        : null,
    });
  } catch (error) {
    console.error("Error checking subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check subscription",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /subscriptions/:subscriptionId
 * Get subscription details
 */
router.get("/:subscriptionId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { subscriptionId } = req.params;

    const subscription = await Subscription.findById(subscriptionId)
      .populate("planId")
      .lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    // Only owner can view subscription details
    if (subscription.userId.toString() !== me.userId) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to view this subscription",
      });
    }

    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        status: subscription.status,
        itemType: subscription.itemType,
        itemId: subscription.itemId,
        currentStart: subscription.currentStart,
        currentEnd: subscription.currentEnd,
        chargeAt: subscription.chargeAt,
        paidCount: subscription.paidCount,
        totalCount: subscription.totalCount,
        remainingCount: subscription.remainingCount,
        paymentMethod: subscription.paymentMethod,
        startedAt: subscription.startedAt,
        plan: subscription.planId,
      },
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
 * POST /subscriptions/:subscriptionId/cancel
 * Cancel a subscription
 */
router.post("/:subscriptionId/cancel", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { subscriptionId } = req.params;

    const schema = z.object({
      cancelAtCycleEnd: z.boolean().default(true),
    });

    const { cancelAtCycleEnd } = schema.parse(req.body);

    // Verify ownership
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    if (subscription.userId.toString() !== me.userId) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to cancel this subscription",
      });
    }

    const updatedSubscription = await cancelUserSubscription(
      subscriptionId,
      cancelAtCycleEnd
    );

    res.json({
      success: true,
      message: cancelAtCycleEnd
        ? `Subscription will be cancelled at the end of current billing cycle (${updatedSubscription.currentEnd?.toISOString()})`
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
});

/**
 * POST /subscriptions/:subscriptionId/pause
 * Pause a subscription
 */
router.post("/:subscriptionId/pause", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { subscriptionId } = req.params;

    // Verify ownership
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    if (subscription.userId.toString() !== me.userId) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to pause this subscription",
      });
    }

    const updatedSubscription = await pauseUserSubscription(subscriptionId);

    res.json({
      success: true,
      message: "Subscription paused",
      subscription: {
        id: updatedSubscription._id,
        status: updatedSubscription.status,
        pausedAt: updatedSubscription.pausedAt,
      },
    });
  } catch (error) {
    console.error("Error pausing subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to pause subscription",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /subscriptions/:subscriptionId/resume
 * Resume a paused subscription
 */
router.post("/:subscriptionId/resume", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { subscriptionId } = req.params;

    // Verify ownership
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    if (subscription.userId.toString() !== me.userId) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to resume this subscription",
      });
    }

    const updatedSubscription = await resumeUserSubscription(subscriptionId);

    res.json({
      success: true,
      message: "Subscription resumed",
      subscription: {
        id: updatedSubscription._id,
        status: updatedSubscription.status,
        currentEnd: updatedSubscription.currentEnd,
      },
    });
  } catch (error) {
    console.error("Error resuming subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resume subscription",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /subscriptions/:subscriptionId/sync
 * Sync subscription status with Razorpay
 */
router.post("/:subscriptionId/sync", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { subscriptionId } = req.params;

    // Verify ownership
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    if (subscription.userId.toString() !== me.userId) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to sync this subscription",
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
});

/**
 * GET /subscriptions/:subscriptionId/payments
 * Get payment history for a subscription
 */
router.get("/:subscriptionId/payments", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { subscriptionId } = req.params;

    const schema = z.object({
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });

    const { limit, offset } = schema.parse(req.query);

    // Verify ownership
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    if (subscription.userId.toString() !== me.userId) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to view these payments",
      });
    }

    const [payments, total] = await Promise.all([
      SubscriptionPayment.find({ subscriptionId: new Types.ObjectId(subscriptionId) })
        .sort({ paymentNumber: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      SubscriptionPayment.countDocuments({
        subscriptionId: new Types.ObjectId(subscriptionId),
      }),
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
        paidAt: p.paidAt,
      })),
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + payments.length < total,
      },
    });
  } catch (error) {
    console.error("Error getting subscription payments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get payments",
      details: (error as Error).message,
    });
  }
});

// ============= Seller Analytics =============

/**
 * GET /subscriptions/seller/stats
 * Get subscription stats for seller
 */
router.get("/seller/stats", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    const schema = z.object({
      itemType: z.enum(["channel", "course", "workshop", "product"]).optional(),
      itemId: z.string().optional(),
    });

    const { itemType, itemId } = schema.parse(req.query);

    const matchQuery: any = { sellerId: new Types.ObjectId(me.userId) };
    if (itemType) matchQuery.itemType = itemType;
    if (itemId) matchQuery.itemId = new Types.ObjectId(itemId);

    const stats = await Subscription.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalRevenue = await SubscriptionPayment.aggregate([
      {
        $match: {
          sellerId: new Types.ObjectId(me.userId),
          status: "captured",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      stats: {
        byStatus: stats.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {} as Record<string, number>),
        revenue: {
          total: totalRevenue[0]?.total || 0,
          paymentCount: totalRevenue[0]?.count || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error getting seller stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get stats",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /subscriptions/seller/subscribers
 * Get subscribers for seller's content
 */
router.get("/seller/subscribers", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    const schema = z.object({
      itemType: z.enum(["channel", "course", "workshop", "product"]).optional(),
      itemId: z.string().optional(),
      status: z.string().optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });

    const { itemType, itemId, status, limit, offset } = schema.parse(req.query);

    const matchQuery: any = { sellerId: new Types.ObjectId(me.userId) };
    if (itemType) matchQuery.itemType = itemType;
    if (itemId) matchQuery.itemId = new Types.ObjectId(itemId);
    if (status) matchQuery.status = status;

    const [subscriptions, total] = await Promise.all([
      Subscription.find(matchQuery)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("userId", "name email profilePicture")
        .populate("planId", "name amount period")
        .lean(),
      Subscription.countDocuments(matchQuery),
    ]);

    res.json({
      success: true,
      subscribers: subscriptions.map((sub) => ({
        id: sub._id,
        user: sub.userId,
        plan: sub.planId,
        status: sub.status,
        currentEnd: sub.currentEnd,
        paidCount: sub.paidCount,
        startedAt: sub.startedAt,
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
    console.error("Error getting subscribers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get subscribers",
      details: (error as Error).message,
    });
  }
});

export default router;
