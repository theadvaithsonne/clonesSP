import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../services/jwt";
import { User } from "../models/user.model";
import { GarageAdminModel } from "../models/garageAdmin.model";
import { hasFounderAccess } from "../utils/accessCheck";

/**
 * Accept EITHER a regular user JWT OR a garage-admin token.
 *
 * The member profile/purchases endpoints (GET /affiliate/user-info/:userId and
 * GET /affiliate/downline/:userId/purchases) are reached from two places:
 *   - the NC member app, with the user's JWT (`req.user = {userId, orgId, …}`);
 *   - the garage ADMIN panel, which has its OWN token and NO user session — a
 *     plain `requireAuth` there 401s (that was the incognito bug).
 *
 * Both tokens are signed with the same JWT_SECRET and are told apart by their
 * claims (`userId` vs `garageAdminId`). For an admin caller `req.user` is set to
 * an empty object so downstream handlers that read `req.user?.orgId` / `.userId`
 * (both used only for optional enrichment — the org's isFounder flag and the
 * "You Earned" commission column) degrade gracefully instead of crashing.
 */
export async function requireUserOrGarageAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing auth" });
  const token = header.split(" ")[1];

  let payload: { userId?: string; orgId?: string; garageAdminId?: string };
  try {
    payload = verifyJwt<typeof payload>(token);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // ── Garage admin token ──────────────────────────────────────────────────
  if (payload?.garageAdminId) {
    const admin = await GarageAdminModel.findById(payload.garageAdminId).lean();
    if (!admin) {
      return res.status(401).json({ error: "Admin not found or inactive" });
    }
    // No user session — handlers read orgId/userId optionally.
    (req as any).user = {};
    (req as any).garageAdmin = {
      id: String((admin as any)._id),
      role: (admin as any).role,
    };
    return next();
  }

  // ── Regular user token (same flow as requireAuth) ───────────────────────
  if (payload?.userId) {
    const dbUser = await User.findById(payload.userId)
      .select("email role organization organizations")
      .lean();
    if (!dbUser) return res.status(401).json({ error: "Invalid user" });

    const orgId = payload.orgId || (dbUser as any).organization?.toString();
    let effectiveRole = (dbUser as any).role;
    if (orgId && (dbUser as any).organizations) {
      const membership = ((dbUser as any).organizations as any[]).find(
        (m: any) => m.organization.toString() === orgId
      );
      if (membership) {
        effectiveRole = hasFounderAccess(membership) ? "founder" : membership.role;
      }
    }
    (req as any).user = {
      userId: payload.userId,
      role: effectiveRole,
      orgId,
      email: (dbUser as any).email,
    };
    return next();
  }

  return res.status(401).json({ error: "Invalid token" });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Same acceptance rules as `requireUserOrGarageAdmin` (regular user JWT OR
 * garage-admin token), but for endpoints whose handler genuinely reads
 * `req.user.userId` to scope or own data (e.g. `/affiliate/links`,
 * `/affiliate/my-affiliate-id`) — a bare `req.user = {}` for admin callers
 * would crash those (`new Types.ObjectId(undefined)`), not just degrade.
 *
 * For a garage-admin token, the admin is mapped onto THEIR OWN Garage `User`
 * account: looked up by email, case-insensitively and trimmed (mirroring the
 * `.trim().toLowerCase()` normalisation `superAdminEmails()` applies on the
 * contacts-backend side). If no such `User` exists, the request is refused
 * with 403 — never falls through with an empty/partial `req.user`, which is
 * exactly the crash this middleware exists to prevent.
 *
 * Deliberately a separate export from `requireUserOrGarageAdmin`: two
 * existing endpoints (`/affiliate/user-info/:userId`, and one in
 * `downlineProfile.ts`) rely on that one's `req.user = {}` admin behaviour,
 * so it is left untouched.
 */
export async function requireUserOrGarageAdminAsUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing auth" });
  const token = header.split(" ")[1];

  let payload: { userId?: string; orgId?: string; garageAdminId?: string };
  try {
    payload = verifyJwt<typeof payload>(token);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // ── Garage admin token — map onto the admin's own Garage user account ──
  if (payload?.garageAdminId) {
    const admin = await GarageAdminModel.findById(payload.garageAdminId).lean();
    if (!admin) {
      return res.status(401).json({ error: "Admin not found or inactive" });
    }

    const normalizedEmail = String((admin as any).email || "").trim().toLowerCase();
    const dbUser = normalizedEmail
      ? await User.findOne({
          email: { $regex: `^${escapeRegex(normalizedEmail)}$`, $options: "i" },
        })
          .select("email")
          .lean()
      : null;

    if (!dbUser) {
      return res.status(403).json({
        error:
          "This garage admin has no linked Garage user account — sign in to Garage with a matching email to use this feature.",
      });
    }

    (req as any).user = { userId: String((dbUser as any)._id) };
    (req as any).garageAdmin = {
      id: String((admin as any)._id),
      role: (admin as any).role,
    };
    return next();
  }

  // ── Regular user token (same flow as requireAuth) ───────────────────────
  if (payload?.userId) {
    const dbUser = await User.findById(payload.userId)
      .select("email role organization organizations")
      .lean();
    if (!dbUser) return res.status(401).json({ error: "Invalid user" });

    const orgId = payload.orgId || (dbUser as any).organization?.toString();
    let effectiveRole = (dbUser as any).role;
    if (orgId && (dbUser as any).organizations) {
      const membership = ((dbUser as any).organizations as any[]).find(
        (m: any) => m.organization.toString() === orgId
      );
      if (membership) {
        effectiveRole = hasFounderAccess(membership) ? "founder" : membership.role;
      }
    }
    (req as any).user = {
      userId: payload.userId,
      role: effectiveRole,
      orgId,
      email: (dbUser as any).email,
    };
    return next();
  }

  return res.status(401).json({ error: "Invalid token" });
}
