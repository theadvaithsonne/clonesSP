import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { requireGarageAdminAuth, GarageAdminRequest } from "../middleware/garageAdminAuth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";

/**
 * Returns up to `limit` verified users matching `q` against name OR email.
 * Used by the admin coupon-assignment picker (platform-wide).
 */
export const adminUserSearchRouter = Router();

adminUserSearchRouter.get(
  "/search",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const q = String(req.query.q || "").trim();
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      if (!q) return res.json({ success: true, users: [] });

      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const users = await User.find(
        {
          isVerified: true,
          $or: [{ name: regex }, { email: regex }, { phone: regex }],
        },
        { _id: 1, name: 1, email: 1, profilePicture: 1 }
      )
        .limit(limit)
        .lean();
      res.json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * Founder-scoped: search verified users who are members of :orgId.
 * Used by the founder coupon-assignment picker.
 */
export const founderUserSearchRouter = Router({ mergeParams: true });

async function requireFounder(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const { orgId } = req.params;
    const userId = authReq.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ success: false, error: "User not found" });

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
    console.error("[userSearch] requireFounder error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

founderUserSearchRouter.get(
  "/search",
  requireAuth,
  requireFounder,
  async (req, res: Response) => {
    try {
      const { orgId } = req.params;
      const q = String(req.query.q || "").trim();
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      if (!q) return res.json({ success: true, users: [] });

      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const users = await User.find(
        {
          isVerified: true,
          "organizations.organization": new Types.ObjectId(orgId),
          $or: [{ name: regex }, { email: regex }, { phone: regex }],
        },
        { _id: 1, name: 1, email: 1, profilePicture: 1 }
      )
        .limit(limit)
        .lean();
      res.json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);
