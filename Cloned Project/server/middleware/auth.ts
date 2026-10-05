import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../services/jwt";
import { User } from "../models/user.model";
import { hasFounderAccess } from "../utils/accessCheck";
import { normalizePermissions, OrgMembershipLike } from "../utils/rbac";
import type { RbacModule } from "../config/rbacModules";

// User payload type for authenticated requests
export interface AuthUser {
  userId: string;
  role?: string;
  orgId: string;
  email?: string;
  /**
   * Module-RBAC permissions for the CURRENT org (req.user.orgId), all keys
   * present. Founders and fullAccess holders bypass this map entirely — do not
   * read it to answer "can they?"; use middleware/rbac.ts#requireModuleAdmin
   * or canModule(), which apply the founder bypass.
   */
  permissions?: Record<RbacModule, boolean>;
}

// Extend Request to include user property - using intersection for better compatibility
export type AuthRequest = Request & {
  user: AuthUser;
};

/**
 * Soft authentication: if a valid Authorization header is present, attach
 * `req.user = { userId }`. If absent / malformed / expired, silently fall
 * through as a guest. Use on public endpoints (e.g. the public-invoice-link
 * flow) where the route handler decides what to do with vs without a user.
 *
 * Unlike requireAuth, this does NOT do a DB lookup to confirm the user still
 * exists — that's the caller's responsibility if they need it.
 */
export function softAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header) return next();
  try {
    const token = header.split(" ")[1];
    const payload = verifyJwt<{
      userId: string;
      orgId?: string;
      email?: string;
    }>(token);
    (req as any).user = {
      userId: payload.userId,
      orgId: payload.orgId,
      email: payload.email,
    };
  } catch {
    // invalid/expired token — continue as guest
  }
  next();
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing auth" });
  const token = header.split(" ")[1];
  try {
    const payload = verifyJwt<{ userId: string; orgId?: string }>(token);
    const dbUser = await User.findById(payload.userId)
      .select("email role organization organizations")
      .lean();
    if (!dbUser) return res.status(401).json({ error: "Invalid user" });

    const orgId = payload.orgId || dbUser.organization?.toString();
    let effectiveRole = dbUser.role;
    let membership: OrgMembershipLike | null = null;

    // Check multi-org membership for fullAccess elevation
    if (orgId && dbUser.organizations) {
      const found = (dbUser.organizations as any[]).find(
        (m: any) => m.organization.toString() === orgId
      );
      if (found) {
        membership = found;
        effectiveRole = hasFounderAccess(found) ? "founder" : found.role;
      }
    }

    (req as any).user = {
      userId: payload.userId,
      role: effectiveRole,
      orgId,
      email: dbUser.email,
      permissions: normalizePermissions(membership),
    };
    // Raw membership for the current org, so module-RBAC checks downstream cost
    // no extra query. Null when the token's org isn't one this user belongs to.
    (req as any).membership = membership;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Require the authenticated user to be a founder of their current org.
 * Stakeholders with fullAccess granted by a founder are also accepted —
 * requireAuth already normalizes that into role === "founder".
 *
 * Must run AFTER requireAuth.
 */
export function requireFounder(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as any).user as AuthUser | undefined;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (user.role !== "founder") {
    res.status(403).json({ error: "Founder access required" });
    return;
  }
  next();
}


/** Service-to-service auth via X-Internal-Api-Key header (used by Agent-Manager). */
export function requireInternalKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = req.headers["x-internal-api-key"] as string | undefined;
  if (!process.env.INTERNAL_API_KEY) {
    res.status(503).json({ error: "Internal API not configured" });
    return;
  }
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    res.status(401).json({ error: "Invalid internal API key" });
    return;
  }
  next();
}
