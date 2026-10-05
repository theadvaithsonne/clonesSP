import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model";
import { Types } from "mongoose";
import { hasFounderAccess } from "../utils/accessCheck";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as { role?: string };
  // Support both legacy "admin" and new "founder" roles
  if (!["admin", "founder"].includes(user?.role || ""))
    return res.status(403).json({ error: "Admin only" });
  next();
}

export async function requireOrgAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as any).user as {
    userId: string;
    role?: string;
    orgId?: string;
  };
  const { orgId } = req.query as { orgId: string };

  if (!orgId) {
    return res.status(400).json({ error: "Organization ID required" });
  }

  try {
    // Get user with organization memberships
    const dbUser = await User.findById(user.userId)
      .select("role organization organizations")
      .lean();

    if (!dbUser) {
      return res.status(401).json({ error: "Invalid user" });
    }

    // Check legacy single organization (backward compatibility)
    if (dbUser.organization?.toString() === orgId) {
      if (["admin", "founder"].includes(dbUser.role || "")) {
        return next();
      }
    }

    // Check new multiple organization memberships
    if (dbUser.organizations) {
      const membership = dbUser.organizations.find(
        (membership: any) => membership.organization.toString() === orgId
      );

      if (membership && hasFounderAccess(membership)) {
        return next();
      }
    }

    return res.status(403).json({ error: "Admin only" });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export function requireFounder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as any).user as { role?: string };
  if (user?.role !== "founder") {
    return res.status(403).json({ error: "Founder only" });
  }
  next();
}

/**
 * Middleware to verify user is a founder of the organization specified in req.params.orgId
 * This checks the actual database membership, not just the JWT token role
 */
export async function requireOrgFounder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as any).user as {
    userId: string;
    role?: string;
    orgId?: string;
  };
  const { orgId } = req.params as { orgId: string };

  if (!orgId) {
    return res.status(400).json({ error: "Organization ID required in URL" });
  }

  try {
    // Get user with organization memberships
    const dbUser = await User.findById(user.userId)
      .select("role organization organizations")
      .lean();

    if (!dbUser) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check legacy single organization (backward compatibility)
    if (dbUser.organization?.toString() === orgId) {
      if (["admin", "founder"].includes(dbUser.role || "")) {
        return next();
      }
    }

    // Check new multiple organization memberships
    if (dbUser.organizations) {
      const membership = dbUser.organizations.find(
        (membership: any) => membership.organization.toString() === orgId
      );

      if (membership && hasFounderAccess(membership)) {
        return next();
      }
    }

    return res.status(403).json({ error: "Only founders can perform this action" });
  } catch (error) {
    console.error("[requireOrgFounder] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
