import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { GarageAdminModel } from "../models/garageAdmin.model";
import {
  AdminPageLevel,
  levelSatisfies,
  permissionsSatisfy,
  resolveAdminPath,
  resolvePagePermissions,
} from "../config/adminPages";
import { isGated } from "../services/adminVerification";

/** Order the three levels so "the best one held" can be picked. */
function rankLevel(level: AdminPageLevel | "none"): number {
  return level === "manage" ? 2 : level === "view" ? 1 : 0;
}

export interface GarageAdminRequest extends Request {
  garageAdmin?: {
    id: string;
    name: string;
    role: string;
    email: string;
    isSuperAdmin: boolean;
    permissions: Record<string, AdminPageLevel>;
    /** This admin has step-up questions seeded (see services/adminVerification). */
    gated: boolean;
    /** This token has already cleared the step-up gate. */
    verified: boolean;
  };
}

/**
 * Verifies the bearer token and loads the admin. Returns null on any
 * failure — the caller decides what status to send.
 */
async function loadGarageAdmin(req: GarageAdminRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.substring(7);
  let decoded: any;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as any;
  } catch {
    return null;
  }
  if (!decoded?.garageAdminId) return null;

  // `+verification` rides along on the fetch that was happening anyway, so
  // requireAdminVerified can decide without a second round-trip.
  const admin = await GarageAdminModel.findById(decoded.garageAdminId).select(
    "+verification"
  );
  if (!admin || !admin.isActive) return null;

  // Tokens minted before a forced sign-out are dead, whoever is holding
  // them. `iat` is in whole seconds; compare at that resolution so a login
  // in the same second as the invalidation isn't caught by its own stamp.
  const cutoff = (admin as any).sessionsInvalidatedAt;
  if (cutoff && decoded.iat && decoded.iat < Math.floor(new Date(cutoff).getTime() / 1000)) {
    return null;
  }

  return { admin, decoded };
}

/**
 * Attaches the admin (and their resolved permission map) to the request.
 *
 * The permission map is read off the document on every request rather than
 * baked into the JWT — a super admin revoking access takes effect on the
 * admin's next call, not on their next login.
 */
function attach(req: GarageAdminRequest, admin: any, decoded: any) {
  req.garageAdmin = {
    id: admin._id.toString(),
    name: admin.name,
    role: admin.role,
    email: admin.email,
    isSuperAdmin: admin.role === "garage-super-admin",
    permissions: resolvePagePermissions(
      admin.pagePermissions?.toObject
        ? admin.pagePermissions.toObject()
        : admin.pagePermissions,
      admin.pagePermissionsSet
    ),
    gated: isGated(
      admin.verification?.toObject
        ? admin.verification.toObject()
        : admin.verification
    ),
    // The claim is minted only by POST /garage-admin/verify, which re-signs
    // this same token after a correct answer. A fresh login token never
    // carries it — which is exactly "ask once per login, not per refresh".
    verified: !!decoded?.adminVerified,
  };
}

export async function requireGarageAdminAuth(
  req: GarageAdminRequest,
  res: Response,
  next: NextFunction
) {
  // The page gate (garageAdminPageGate) already authenticated this request
  // at the mount prefix. Every admin router still calls this per route, so
  // short-circuiting here is what keeps those ~60 call sites unchanged —
  // and saves a duplicate database read on each one.
  if (req.garageAdmin) return next();

  try {
    const loaded = await loadGarageAdmin(req);
    if (!loaded) {
      return res.status(401).json({ error: "Admin not found or inactive" });
    }
    attach(req, loaded.admin, loaded.decoded);
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireGarageSuperAdmin(
  req: GarageAdminRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.garageAdmin || req.garageAdmin.role !== "garage-super-admin") {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
}

/**
 * Page-level RBAC gate, mounted at the admin route prefixes in app.ts
 * rather than per route.
 *
 * Resolves the request path to a page key via config/adminPages, then
 * checks the admin's level for it. Deny-by-default: a path that maps to no
 * page requires super admin, so newly-added admin routes are locked down
 * until they are deliberately mapped.
 *
 * Super admins bypass the check entirely. Nothing in the permission map can
 * express a super-admin-only capability, so no role a super admin builds
 * can reach one.
 */
export async function garageAdminPageGate(
  req: GarageAdminRequest,
  res: Response,
  next: NextFunction
) {
  // req.path is relative to the mount point; baseUrl puts the prefix back
  // so the rules in adminPages can be written as full paths.
  const fullPath = `${req.baseUrl || ""}${req.path || ""}`;
  const verdict = resolveAdminPath(fullPath, req.method);

  if (verdict.kind === "public") return next();

  try {
    const loaded = await loadGarageAdmin(req);
    if (!loaded) {
      return res.status(401).json({ error: "Admin not found or inactive" });
    }
    attach(req, loaded.admin, loaded.decoded);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const ctx = req.garageAdmin!;
  if (ctx.isSuperAdmin) return next();
  if (verdict.kind === "any-admin") return next();

  if (verdict.kind === "super-only") {
    return res.status(403).json({ error: "Super admin access required" });
  }

  // Satisfied by the required level on ANY of the mapped pages (usually one).
  // For a WRITE that names an action, page-manage OR the action grant passes.
  const ok = permissionsSatisfy(
    ctx.permissions,
    verdict.pages,
    verdict.level,
    verdict.action
  );
  if (!ok) {
    // Report the best-held level across the candidate pages, so the message
    // can distinguish "read-only here" from "no access at all".
    const bestHeld = verdict.pages
      .map((page) => ctx.permissions[page] || "none")
      .sort((a, b) => rankLevel(b) - rankLevel(a))[0];
    return res.status(403).json({
      error:
        verdict.level === "manage" && bestHeld === "view"
          ? "You have read-only access to this section"
          : "You do not have access to this section",
      page: verdict.pages[0],
      pages: verdict.pages,
      required: verdict.level,
      held: bestHeld,
    });
  }

  next();
}

/**
 * Per-route variant, for the handful of endpoints that live outside a
 * gated mount prefix. Assumes requireGarageAdminAuth ran first.
 */
export function requireAdminPage(page: string, level: AdminPageLevel = "view") {
  return requireAnyAdminPage([page], level);
}

/**
 * Per-route guard satisfied by `level` on ANY of `pages`. The belt to the
 * mount-level gate's multi-page rule (config/adminPages ADMIN_PATH_RULES) —
 * for shared write actions like assigning a support agent, reachable from
 * both One Time Affiliates and NetworkChain Subs. Assumes
 * requireGarageAdminAuth ran first. Super admins always pass.
 */
export function requireAnyAdminPage(
  pages: string[],
  level: AdminPageLevel = "view"
) {
  return function (
    req: GarageAdminRequest,
    res: Response,
    next: NextFunction
  ) {
    const ctx = req.garageAdmin;
    if (!ctx) return res.status(401).json({ error: "Not authenticated" });
    if (ctx.isSuperAdmin) return next();
    const ok = pages.some((page) =>
      levelSatisfies(ctx.permissions[page] || "none", level)
    );
    if (!ok) {
      return res
        .status(403)
        .json({ error: "You do not have access to this section" });
    }
    next();
  };
}

/**
 * Per-route guard for one independently-grantable write ACTION. Passes if the
 * admin holds `manage` on ANY of `pages` (the superset) or the specific
 * `action` grant on any of them. The belt to the gate's per-action rule (see
 * config/adminPages permissionsSatisfy). Assumes requireGarageAdminAuth ran.
 */
export function requireAdminAction(pages: string[], action: string) {
  return function (
    req: GarageAdminRequest,
    res: Response,
    next: NextFunction
  ) {
    const ctx = req.garageAdmin;
    if (!ctx) return res.status(401).json({ error: "Not authenticated" });
    if (ctx.isSuperAdmin) return next();
    if (!permissionsSatisfy(ctx.permissions, pages, "manage", action)) {
      return res
        .status(403)
        .json({ error: "You do not have access to this action" });
    }
    next();
  };
}

/**
 * Enforces the "Verify your admin" step-up gate.
 *
 * Chained after garageAdminPageGate at the admin mount prefixes, so one
 * line covers every admin route rather than sixty. Three ways through:
 *
 *   - no admin on the request (a public route, e.g. login/OTP) → pass
 *   - the admin has no seeded questions, or the kill switch is off → pass
 *   - the token already carries the verified claim → pass
 *
 * Everything else gets 403 ADMIN_VERIFICATION_REQUIRED, which is what the
 * console's overlay keys off. Without this the blur would be cosmetic: the
 * token in localStorage can call these APIs directly.
 */
export async function requireAdminVerified(
  req: GarageAdminRequest,
  res: Response,
  next: NextFunction
) {
  const admin = req.garageAdmin;
  if (!admin || !admin.gated || admin.verified) return next();

  // Two exemptions, both needed to paint the shell behind the overlay and
  // neither carrying business data: the admin's own identity, and the
  // static catalogue of page keys the sidebar is built from.
  const fullPath = `${req.baseUrl || ""}${req.path || ""}`;
  if (
    fullPath === "/garage-admin/profile" ||
    fullPath === "/garage-admin/admin-pages"
  ) {
    return next();
  }

  return res.status(403).json({
    error: "Admin verification required",
    code: "ADMIN_VERIFICATION_REQUIRED",
  });
}
