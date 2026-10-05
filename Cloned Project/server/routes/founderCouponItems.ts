import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import { Channel } from "../models/channel.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Product } from "../models/product.model";
import { Service } from "../models/service.model";
import { CallOffering } from "../models/callOffering.model";
import { StoreProduct } from "../models/storeProduct.model";

const router = Router({ mergeParams: true });

const PRODUCT_TYPES = [
  "channel",
  "course",
  "workshop",
  "product",
  "service",
  "call",
  "ecommerce",
] as const;
type ProductType = (typeof PRODUCT_TYPES)[number];

async function requireFounder(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const { orgId } = req.params;
    const userId = authReq.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const user = await User.findById(userId).lean();
    if (!user)
      return res.status(401).json({ success: false, error: "User not found" });

    const membership = (user.organizations as any[] | undefined)?.find(
      (m: any) => m.organization.toString() === orgId && hasFounderAccess(m)
    );
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You must be a founder of this organization",
      });
    }
    next();
  } catch (err: any) {
    console.error("[founderCouponItems] requireFounder error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

interface EligibleItem {
  _id: string;
  title: string;
  price: number;
  currency: string;
  image?: string;
  isRecurring: boolean;
  recurringDetail?: string;
  status?: string;
}

/**
 * GET /org/:orgId/coupon-eligible-items?productType=channel
 * Returns items in this org for the given productType, each tagged with
 * isRecurring (= subscription billing applies, so cycleCount is meaningful).
 *
 *   channel | course | workshop | product → isRecurring = item.isSubscription
 *   service | call                        → isRecurring = false (no subscription support)
 */
router.get(
  "/",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const productType = String(req.query.productType || "") as ProductType;
      if (!PRODUCT_TYPES.includes(productType)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid productType" });
      }

      const orgObjId = new Types.ObjectId(orgId);
      let items: EligibleItem[] = [];

      switch (productType) {
        case "channel": {
          const docs = await Channel.find({
            storeId: orgObjId,
            isActive: { $ne: false },
          })
            .select("title price currency coverImage isSubscription subscriptionPeriod")
            .sort({ updatedAt: -1 })
            .lean();
          items = docs.map((c: any) => ({
            _id: c._id.toString(),
            title: c.title,
            price: c.price ?? 0,
            currency: c.currency || "USD",
            image: c.coverImage,
            isRecurring: !!c.isSubscription,
            recurringDetail: c.isSubscription
              ? `Subscription · ${c.subscriptionPeriod || "monthly"}`
              : undefined,
          }));
          break;
        }
        case "course": {
          const docs = await Course.find({
            organizationId: orgObjId,
            status: { $ne: "archived" },
          })
            .select("title price currency coverImage isSubscription subscriptionPeriod status")
            .sort({ updatedAt: -1 })
            .lean();
          items = docs.map((c: any) => ({
            _id: c._id.toString(),
            title: c.title,
            price: c.price ?? 0,
            currency: c.currency || "USD",
            image: c.coverImage,
            isRecurring: !!c.isSubscription,
            recurringDetail: c.isSubscription
              ? `Subscription · ${c.subscriptionPeriod || "monthly"}`
              : undefined,
            status: c.status,
          }));
          break;
        }
        case "workshop": {
          const docs = await Workshop.find({
            orgId: orgObjId,
            isActive: { $ne: false },
          })
            .select("title price currency thumbnail isSubscription subscriptionPeriod isRecurring enrollmentType")
            .sort({ updatedAt: -1 })
            .lean();
          items = docs.map((w: any) => {
            const recurring = !!w.isSubscription;
            const detail = recurring
              ? `Subscription · ${w.subscriptionPeriod || "monthly"}`
              : w.isRecurring
                ? `Multiple sessions · ${w.enrollmentType || "once"}`
                : undefined;
            return {
              _id: w._id.toString(),
              title: w.title,
              price: w.price ?? 0,
              currency: w.currency || "USD",
              image: w.thumbnail,
              isRecurring: recurring,
              recurringDetail: detail,
            };
          });
          break;
        }
        case "product": {
          const docs = await Product.find({
            organizationId: orgObjId,
            status: { $ne: "archived" },
          })
            .select("name price currency images isSubscription subscriptionPeriod status")
            .sort({ updatedAt: -1 })
            .lean();
          items = docs.map((p: any) => ({
            _id: p._id.toString(),
            title: p.name,
            price: p.price ?? 0,
            currency: p.currency || "USD",
            image: Array.isArray(p.images) ? p.images[0] : undefined,
            isRecurring: !!p.isSubscription,
            recurringDetail: p.isSubscription
              ? `Subscription · ${p.subscriptionPeriod || "monthly"}`
              : undefined,
            status: p.status,
          }));
          break;
        }
        case "service": {
          const docs = await Service.find({
            organizationId: orgObjId,
            status: { $ne: "archived" },
          })
            .select("title price currency coverImage status")
            .sort({ updatedAt: -1 })
            .lean();
          items = docs.map((s: any) => ({
            _id: s._id.toString(),
            title: s.title,
            price: s.price ?? 0,
            currency: s.currency || "USD",
            image: s.coverImage,
            isRecurring: false,
            status: s.status,
          }));
          break;
        }
        case "call": {
          const docs = await CallOffering.find({
            organizationId: orgObjId,
            status: { $ne: "archived" },
          })
            .select("title pricePerCall currency coverImage status")
            .sort({ updatedAt: -1 })
            .lean();
          items = docs.map((c: any) => ({
            _id: c._id.toString(),
            title: c.title,
            price: c.pricePerCall ?? 0,
            currency: c.currency || "USD",
            image: c.coverImage,
            isRecurring: false,
            status: c.status,
          }));
          break;
        }
        case "ecommerce": {
          // Storefront items live in StoreProduct, keyed by `orgId` (not
          // `organizationId`). One-time purchases only → isRecurring=false.
          const docs = await StoreProduct.find({
            orgId: orgObjId,
            status: "active",
          })
            .select("title price currency featuredImage images status")
            .sort({ updatedAt: -1 })
            .lean();
          items = docs.map((s: any) => ({
            _id: s._id.toString(),
            title: s.title,
            price: s.price ?? 0,
            currency: s.currency || "USD",
            image:
              s.featuredImage ||
              (Array.isArray(s.images) ? s.images[0]?.url : undefined),
            isRecurring: false,
            status: s.status,
          }));
          break;
        }
      }

      res.json({ success: true, items });
    } catch (err: any) {
      console.error("[founderCouponItems] list error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /org/:orgId/coupon-eligible-items/all
 * Returns ALL sellables across ALL product types for this org. Each item
 * carries its `productType` tag and `isRecurring` flag. Used by the rule
 * editor's unified item picker.
 */
router.get(
  "/all",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const orgObjId = new Types.ObjectId(orgId);

      type EligibleItemAny = EligibleItem & { productType: ProductType };
      const collected: EligibleItemAny[] = [];

      const [channels, courses, workshops, products, services, calls, storeProducts] =
        await Promise.all([
          Channel.find({ storeId: orgObjId, isActive: { $ne: false } })
            .select("title price currency coverImage isSubscription subscriptionPeriod")
            .sort({ updatedAt: -1 })
            .lean(),
          Course.find({
            organizationId: orgObjId,
            status: { $ne: "archived" },
          })
            .select("title price currency coverImage isSubscription subscriptionPeriod status")
            .sort({ updatedAt: -1 })
            .lean(),
          Workshop.find({ orgId: orgObjId, isActive: { $ne: false } })
            .select("title price currency thumbnail isSubscription subscriptionPeriod isRecurring enrollmentType")
            .sort({ updatedAt: -1 })
            .lean(),
          Product.find({
            organizationId: orgObjId,
            status: { $ne: "archived" },
          })
            .select("name price currency images isSubscription subscriptionPeriod status")
            .sort({ updatedAt: -1 })
            .lean(),
          Service.find({
            organizationId: orgObjId,
            status: { $ne: "archived" },
          })
            .select("title price currency coverImage status")
            .sort({ updatedAt: -1 })
            .lean(),
          CallOffering.find({
            organizationId: orgObjId,
            status: { $ne: "archived" },
          })
            .select("title pricePerCall currency coverImage status")
            .sort({ updatedAt: -1 })
            .lean(),
          StoreProduct.find({ orgId: orgObjId, status: "active" })
            .select("title price currency featuredImage images status")
            .sort({ updatedAt: -1 })
            .lean(),
        ]);

      for (const c of channels) {
        collected.push({
          _id: (c as any)._id.toString(),
          productType: "channel",
          title: (c as any).title,
          price: (c as any).price ?? 0,
          currency: (c as any).currency || "USD",
          image: (c as any).coverImage,
          isRecurring: !!(c as any).isSubscription,
          recurringDetail: (c as any).isSubscription
            ? `Subscription · ${(c as any).subscriptionPeriod || "monthly"}`
            : undefined,
        });
      }
      for (const c of courses) {
        collected.push({
          _id: (c as any)._id.toString(),
          productType: "course",
          title: (c as any).title,
          price: (c as any).price ?? 0,
          currency: (c as any).currency || "USD",
          image: (c as any).coverImage,
          isRecurring: !!(c as any).isSubscription,
          recurringDetail: (c as any).isSubscription
            ? `Subscription · ${(c as any).subscriptionPeriod || "monthly"}`
            : undefined,
          status: (c as any).status,
        });
      }
      for (const w of workshops) {
        const recurring = !!(w as any).isSubscription;
        collected.push({
          _id: (w as any)._id.toString(),
          productType: "workshop",
          title: (w as any).title,
          price: (w as any).price ?? 0,
          currency: (w as any).currency || "USD",
          image: (w as any).thumbnail,
          isRecurring: recurring,
          recurringDetail: recurring
            ? `Subscription · ${(w as any).subscriptionPeriod || "monthly"}`
            : (w as any).isRecurring
              ? `Multiple sessions · ${(w as any).enrollmentType || "once"}`
              : undefined,
        });
      }
      for (const p of products) {
        collected.push({
          _id: (p as any)._id.toString(),
          productType: "product",
          title: (p as any).name,
          price: (p as any).price ?? 0,
          currency: (p as any).currency || "USD",
          image: Array.isArray((p as any).images) ? (p as any).images[0] : undefined,
          isRecurring: !!(p as any).isSubscription,
          recurringDetail: (p as any).isSubscription
            ? `Subscription · ${(p as any).subscriptionPeriod || "monthly"}`
            : undefined,
          status: (p as any).status,
        });
      }
      for (const s of services) {
        collected.push({
          _id: (s as any)._id.toString(),
          productType: "service",
          title: (s as any).title,
          price: (s as any).price ?? 0,
          currency: (s as any).currency || "USD",
          image: (s as any).coverImage,
          isRecurring: false,
          status: (s as any).status,
        });
      }
      for (const c of calls) {
        collected.push({
          _id: (c as any)._id.toString(),
          productType: "call",
          title: (c as any).title,
          price: (c as any).pricePerCall ?? 0,
          currency: (c as any).currency || "USD",
          image: (c as any).coverImage,
          isRecurring: false,
          status: (c as any).status,
        });
      }
      for (const s of storeProducts) {
        collected.push({
          _id: (s as any)._id.toString(),
          productType: "ecommerce",
          title: (s as any).title,
          price: (s as any).price ?? 0,
          currency: (s as any).currency || "USD",
          image:
            (s as any).featuredImage ||
            (Array.isArray((s as any).images)
              ? (s as any).images[0]?.url
              : undefined),
          isRecurring: false,
          status: (s as any).status,
        });
      }

      res.json({ success: true, items: collected });
    } catch (err: any) {
      console.error("[founderCouponItems] all error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
