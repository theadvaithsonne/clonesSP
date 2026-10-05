import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model";
import type { RbacModule } from "../config/rbacModules";
import {
  findMembership,
  isModuleAdmin,
  OrgMembershipLike,
} from "../utils/rbac";

/**
 * Module-level RBAC guards.
 *
 * Gate a route on admin rights for one product module, rather than on being a
 * founder outright. Founders — and stakeholders holding the legacy `fullAccess`
 * flag — always pass, because isModuleAdmin() bypasses via the same
 * hasFounderAccess() check every founder-only route already uses. So:
 *
 *   - router.post("/", requireAuth, requireFounder, handler)
 *   + router.post("/", requireAuth, requireModuleAdmin("courses"), handler)
 *
 * is a strict relaxation: nobody who can reach that route today loses it, and
 * members a founder delegated the module to gain it.
 *
 * These guards are currently applied to NO existing routes — converting them is
 * deliberate follow-up work, one module at a time.
 *
 * Must run AFTER requireAuth.
 */

/** Org this request is acting on. Query param wins — the codebase-wide convention. */
function resolveOrgId(req: Request): string | undefined {
  return (
    (req.query.orgId as string | undefined) ||
    (req.params.orgId as string | undefined) ||
    (req as any).user?.orgId
  );
}

/**
 * The caller's membership for the org being acted on.
 *
 * requireAuth already attached the membership for the token's org, so the
 * common case costs nothing. Only a cross-org request (?orgId= pointing
 * somewhere other than the token's org) falls through to a query.
 */
async function resolveMembership(
  req: Request,
  orgId: string | undefined
): Promise<OrgMembershipLike | null> {
  const user = (req as any).user as { userId?: string; orgId?: string } | undefined;
  if (!user?.userId || !orgId) return null;

  if (orgId === user.orgId) {
    return ((req as any).membership as OrgMembershipLike | null) ?? null;
  }

  const dbUser = await User.findById(user.userId)
    .select("organizations")
    .lean();
  return findMembership(dbUser?.organizations as OrgMembershipLike[], orgId);
}

/** Require admin rights on `module` for the org in scope. */
export function requireModuleAdmin(module: RbacModule) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ success: false, message: "Organization ID required" });
    }

    try {
      const membership = await resolveMembership(req, orgId);
      if (!isModuleAdmin(membership, module)) {
        return res.status(403).json({
          success: false,
          message: `Admin access to ${module} is required`,
          code: "MODULE_ACCESS_REQUIRED",
          module,
        });
      }
      return next();
    } catch (err) {
      console.error("[requireModuleAdmin] Error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  };
}

/**
 * Boolean form, for handlers that branch on access rather than reject outright
 * (e.g. hiding fields). Only valid for the token's own org — a cross-org check
 * needs requireModuleAdmin, which can query.
 */
export function canModule(req: Request, module: RbacModule): boolean {
  const membership = (req as any).membership as OrgMembershipLike | null;
  return isModuleAdmin(membership, module);
}

/**
 * Legacy flexible role guard. Kept for compatibility; prefer requireModuleAdmin
 * for module-scoped access or requireFounder for org-wide founder gates.
 */
export function requireAnyRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any)?.user?.role as string | undefined;

    // Support legacy role mapping: admin -> founder
    const normalizedRole = role === "admin" ? "founder" : role;

    if (!normalizedRole || !roles.includes(normalizedRole)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}
