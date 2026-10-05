import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Subscription } from "../models/subscription.model";
import { SubscriptionItemType } from "../models/subscriptionPlan.model";

/**
 * Middleware to require an active subscription for accessing content
 *
 * @param itemType - The type of content (channel, course, workshop, product)
 * @param itemIdParam - The request parameter name containing the item ID (default: based on itemType)
 */
export function requireActiveSubscription(
  itemType: SubscriptionItemType,
  itemIdParam?: string
) {
  const defaultParamMap: Record<SubscriptionItemType, string> = {
    channel: "channelId",
    course: "courseId",
    workshop: "workshopId",
    product: "productId",
  };

  const paramName = itemIdParam || defaultParamMap[itemType];

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const itemId = req.params[paramName];
      if (!itemId) {
        return res.status(400).json({ error: `Missing ${paramName} parameter` });
      }

      // Check for active subscription
      const subscription = await Subscription.findOne({
        userId: new Types.ObjectId(userId),
        itemType,
        itemId: new Types.ObjectId(itemId),
        status: { $in: ["active", "authenticated"] },
      });

      if (!subscription) {
        return res.status(403).json({
          error: "Active subscription required",
          code: "SUBSCRIPTION_REQUIRED",
          itemType,
          itemId,
        });
      }

      // Check if subscription is still within valid period
      if (subscription.currentEnd && subscription.currentEnd < new Date()) {
        return res.status(403).json({
          error: "Subscription has expired",
          code: "SUBSCRIPTION_EXPIRED",
          itemType,
          itemId,
          expiredAt: subscription.currentEnd,
        });
      }

      // Attach subscription to request for use in route handlers
      (req as any).subscription = subscription;

      next();
    } catch (error) {
      console.error("Subscription access check failed:", error);
      return res.status(500).json({ error: "Failed to verify subscription" });
    }
  };
}

/**
 * Middleware to optionally check subscription status
 * Doesn't block access, just attaches subscription info to request
 */
export function checkSubscriptionStatus(
  itemType: SubscriptionItemType,
  itemIdParam?: string
) {
  const defaultParamMap: Record<SubscriptionItemType, string> = {
    channel: "channelId",
    course: "courseId",
    workshop: "workshopId",
    product: "productId",
  };

  const paramName = itemIdParam || defaultParamMap[itemType];

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      const itemId = req.params[paramName];

      if (!userId || !itemId) {
        (req as any).subscriptionStatus = {
          hasSubscription: false,
          isActive: false,
        };
        return next();
      }

      const subscription = await Subscription.findOne({
        userId: new Types.ObjectId(userId),
        itemType,
        itemId: new Types.ObjectId(itemId),
      }).sort({ createdAt: -1 });

      if (!subscription) {
        (req as any).subscriptionStatus = {
          hasSubscription: false,
          isActive: false,
        };
        return next();
      }

      const isActive =
        ["active", "authenticated"].includes(subscription.status) &&
        (!subscription.currentEnd || subscription.currentEnd >= new Date());

      (req as any).subscriptionStatus = {
        hasSubscription: true,
        isActive,
        subscription: {
          id: subscription._id,
          status: subscription.status,
          currentEnd: subscription.currentEnd,
          paidCount: subscription.paidCount,
        },
      };

      next();
    } catch (error) {
      console.error("Subscription status check failed:", error);
      (req as any).subscriptionStatus = {
        hasSubscription: false,
        isActive: false,
        error: "Failed to check subscription",
      };
      next();
    }
  };
}

/**
 * Middleware to require user owns the subscription or is admin
 */
export function requireSubscriptionOwnerOrAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      const subscriptionId = req.params.subscriptionId;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!subscriptionId) {
        return res.status(400).json({ error: "Missing subscriptionId parameter" });
      }

      const subscription = await Subscription.findById(subscriptionId);

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Check if user owns the subscription
      if (subscription.userId.toString() !== userId) {
        // TODO: Add admin check here if needed
        return res.status(403).json({
          error: "You do not have permission to access this subscription",
        });
      }

      (req as any).subscription = subscription;
      next();
    } catch (error) {
      console.error("Subscription owner check failed:", error);
      return res.status(500).json({ error: "Failed to verify subscription ownership" });
    }
  };
}

/**
 * Middleware to require user is the seller of the subscription's content
 */
export function requireSubscriptionSeller() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      const subscriptionId = req.params.subscriptionId;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!subscriptionId) {
        return res.status(400).json({ error: "Missing subscriptionId parameter" });
      }

      const subscription = await Subscription.findById(subscriptionId);

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Check if user is the seller
      if (subscription.sellerId.toString() !== userId) {
        return res.status(403).json({
          error: "You do not have permission to manage this subscription",
        });
      }

      (req as any).subscription = subscription;
      next();
    } catch (error) {
      console.error("Subscription seller check failed:", error);
      return res.status(500).json({ error: "Failed to verify seller permission" });
    }
  };
}
