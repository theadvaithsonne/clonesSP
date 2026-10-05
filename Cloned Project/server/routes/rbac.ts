import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireOrgAdmin } from "../middleware/roles";
import { User } from "../models/user.model";
import { PermissionGrant } from "../models/permissionGrant.model";
import {
  GRANT_TTL_MS,
  MODULE_LABELS,
  RBAC_MODULES,
  RbacModule,
  isRbacModule,
} from "../config/rbacModules";
import {
  findMembership,
  isAssignable,
  normalizePermissions,
  sanitizeModuleList,
  OrgMembershipLike,
} from "../utils/rbac";
import { hasFounderAccess } from "../utils/accessCheck";
import { ok, fail } from "../utils/http";
import {
  acceptGrant,
  createGrants,
  declineGrant,
  expireIfLapsed,
  findLiveGrants,
  revokeModules,
} from "../services/permissionGrant";

/**
 * Module-level RBAC.
 *
 * Founders delegate admin rights on individual product modules to non-founder,
 * non-guest members. A grant is an OFFER: it does not change access until the
 * member accepts, and it dies 24h after it was made. Revoking skips all of
 * that and applies immediately.
 *
 * Founder-only endpoints are guarded by requireOrgAdmin, which reads `?orgId=`
 * from the query and verifies founder status against the database.
 */
const router = Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const modulesBody = z.object({
  modules: z.array(z.string()).min(1, "At least one module is required"),
});

/** Escape user input before it reaches a Mongo $regex. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function badRequest(res: Response, message: string, code?: string) {
  return res.status(400).json(fail(message, code));
}

/** Founder-only endpoints resolve the org from the query, per requireOrgAdmin. */
function scopedOrgId(req: Request): string {
  return req.query.orgId as string;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/** GET /rbac/modules — so the client never hardcodes the column list. */
router.get("/modules", requireAuth, (_req: Request, res: Response) => {
  return res.json(
    ok({
      modules: RBAC_MODULES.map((key) => ({ key, label: MODULE_LABELS[key] })),
    })
  );
});

// ---------------------------------------------------------------------------
// Member-facing — the caller's own permissions and pending offers
// ---------------------------------------------------------------------------

/** GET /rbac/me — effective permissions for the caller in one org. */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; orgId?: string };
    const orgId = (req.query.orgId as string) || me.orgId;
    if (!orgId) return badRequest(res, "Organization ID required");

    const dbUser = await User.findById(me.userId).select("organizations").lean();
    const membership = findMembership(
      dbUser?.organizations as OrgMembershipLike[],
      orgId
    );
    if (!membership) {
      return res.status(403).json(fail("Not a member of this organization"));
    }

    const isFounder = hasFounderAccess(membership);
    const pendingCount = await PermissionGrant.countDocuments({
      orgId,
      userId: me.userId,
      action: "grant",
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    return res.json(
      ok({
        orgId,
        role: membership.role,
        isFounder,
        guest: membership.guest === true,
        // Founders bypass the map; report them as admin of everything so the
        // client can gate on one field.
        permissions: isFounder
          ? Object.fromEntries(RBAC_MODULES.map((m) => [m, true]))
          : normalizePermissions(membership),
        pendingCount,
      })
    );
  } catch (err: any) {
    console.error("[RBAC] GET /me error:", err);
    return res.status(500).json(fail("Internal server error"));
  }
});

/** GET /rbac/my-grants — offers awaiting my response. Drives the inbox badge. */
router.get("/my-grants", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; orgId?: string };
    const orgId = (req.query.orgId as string) || me.orgId;

    const query: Record<string, unknown> = {
      userId: me.userId,
      action: "grant",
      status: "pending",
      expiresAt: { $gt: new Date() },
    };
    if (orgId) query.orgId = orgId;

    const grants = await PermissionGrant.find(query)
      .populate("grantedBy", "name email profilePicture")
      .populate("orgId", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      ok({
        grants: grants.map((g: any) => ({
          grantId: String(g._id),
          orgId: g.orgId?._id ? String(g.orgId._id) : String(g.orgId),
          orgName: g.orgId?.name ?? null,
          module: g.module,
          moduleLabel: MODULE_LABELS[g.module as RbacModule] ?? g.module,
          expiresAt: g.expiresAt,
          createdAt: g.createdAt,
          grantedBy: g.grantedBy
            ? {
                id: String(g.grantedBy._id),
                name: g.grantedBy.name ?? null,
                email: g.grantedBy.email ?? null,
                profilePicture: g.grantedBy.profilePicture ?? null,
              }
            : null,
        })),
      })
    );
  } catch (err: any) {
    console.error("[RBAC] GET /my-grants error:", err);
    return res.status(500).json(fail("Internal server error"));
  }
});

/** Shared guard for accept/decline: the grant must be mine, live, and pending. */
async function loadRespondableGrant(req: Request, res: Response) {
  const me = (req as any).user as { userId: string };
  const parsed = objectId.safeParse(req.params.grantId);
  if (!parsed.success) {
    badRequest(res, "Invalid grant ID");
    return null;
  }

  const grant = await PermissionGrant.findById(parsed.data);
  if (!grant) {
    res.status(404).json(fail("Grant not found"));
    return null;
  }
  if (String(grant.userId) !== me.userId) {
    res.status(403).json(fail("This grant is not yours"));
    return null;
  }
  // Lazy expiry — never trust the sweeper to have run.
  if (await expireIfLapsed(grant)) {
    res.status(410).json(fail("This grant has expired", "GRANT_EXPIRED"));
    return null;
  }
  if (grant.status !== "pending") {
    res
      .status(409)
      .json(fail(`Grant already ${grant.status}`, "GRANT_NOT_PENDING"));
    return null;
  }
  return grant;
}

/** POST /rbac/grants/:grantId/accept — the moment access actually turns on. */
router.post(
  "/grants/:grantId/accept",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const grant = await loadRespondableGrant(req, res);
      if (!grant) return;

      await acceptGrant(grant);
      return res.json(
        ok({
          grantId: String(grant._id),
          module: grant.module,
          status: "accepted",
        })
      );
    } catch (err: any) {
      console.error("[RBAC] accept grant error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

/** POST /rbac/grants/:grantId/decline */
router.post(
  "/grants/:grantId/decline",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const grant = await loadRespondableGrant(req, res);
      if (!grant) return;

      await declineGrant(grant);
      return res.json(
        ok({
          grantId: String(grant._id),
          module: grant.module,
          status: "declined",
        })
      );
    } catch (err: any) {
      console.error("[RBAC] decline grant error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

// ---------------------------------------------------------------------------
// Founder-facing — the permission table
// ---------------------------------------------------------------------------

/**
 * GET /rbac/members?orgId=&search=&module=&granted=&page=&limit=
 *
 * Guests are excluded outright — they are outside the employee permission
 * model. Founders are returned with editable:false so the UI can render them
 * as locked rows.
 */
router.get(
  "/members",
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const orgId = scopedOrgId(req);
      const me = (req as any).user as { userId: string };

      const search = (req.query.search as string | undefined)?.trim();
      const moduleFilter = req.query.module as string | undefined;
      const grantedFilter = req.query.granted as string | undefined;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

      if (moduleFilter && !isRbacModule(moduleFilter)) {
        return badRequest(res, `Unknown module: ${moduleFilter}`);
      }

      const query: Record<string, unknown> = {
        "organizations.organization": new Types.ObjectId(orgId),
      };
      if (search) {
        const rx = new RegExp(escapeRegex(search), "i");
        query.$or = [{ name: rx }, { email: rx }, { phone: rx }];
      }

      const users = await User.find(query)
        .select("name email profilePicture organizations")
        .lean();

      let rows = users
        .map((u: any) => {
          const membership = findMembership(
            u.organizations as OrgMembershipLike[],
            orgId
          );
          if (!membership) return null;
          // Guests are not part of the employee permission model.
          if (membership.guest === true) return null;

          return {
            userId: String(u._id),
            name: u.name ?? null,
            email: u.email,
            profilePicture: u.profilePicture ?? null,
            role: membership.role ?? "stakeholder",
            permissions: normalizePermissions(membership),
            pending: {} as Record<
              string,
              { grantId: string; expiresAt: Date }
            >,
            editable: isAssignable(membership),
            isSelf: String(u._id) === me.userId,
          };
        })
        .filter(Boolean) as any[];

      if (moduleFilter) {
        const want = grantedFilter !== "false";
        rows = rows.filter(
          (r) => r.permissions[moduleFilter as RbacModule] === want
        );
      }

      rows.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

      const total = rows.length;
      const paged = rows.slice((page - 1) * limit, page * limit);

      // Decorate with live offers so the table can show "awaiting acceptance"
      // per cell. Only for the page being returned.
      const live = await findLiveGrants(
        orgId,
        paged.map((r) => r.userId)
      );
      const byUser = new Map<string, any[]>();
      for (const g of live as any[]) {
        const key = String(g.userId);
        if (!byUser.has(key)) byUser.set(key, []);
        byUser.get(key)!.push(g);
      }
      for (const row of paged) {
        for (const g of byUser.get(row.userId) ?? []) {
          row.pending[g.module] = {
            grantId: String(g._id),
            expiresAt: g.expiresAt,
          };
        }
      }

      return res.json(
        ok({
          rows: paged,
          modules: RBAC_MODULES.map((key) => ({
            key,
            label: MODULE_LABELS[key],
          })),
          page,
          limit,
          total,
          hasMore: page * limit < total,
        })
      );
    } catch (err: any) {
      console.error("[RBAC] GET /members error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

/** GET /rbac/members/:userId — one member, with their full grant history. */
router.get(
  "/members/:userId",
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const orgId = scopedOrgId(req);
      const parsed = objectId.safeParse(req.params.userId);
      if (!parsed.success) return badRequest(res, "Invalid user ID");

      const user = await User.findById(parsed.data)
        .select("name email profilePicture organizations")
        .lean();
      if (!user) return res.status(404).json(fail("User not found"));

      const membership = findMembership(
        (user as any).organizations as OrgMembershipLike[],
        orgId
      );
      if (!membership) {
        return res
          .status(404)
          .json(fail("Member not found in this organization"));
      }

      const history = await PermissionGrant.find({ orgId, userId: parsed.data })
        .populate("grantedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      const pending: Record<string, { grantId: string; expiresAt: Date }> = {};
      for (const g of (await findLiveGrants(orgId, [parsed.data])) as any[]) {
        pending[g.module] = { grantId: String(g._id), expiresAt: g.expiresAt };
      }

      return res.json(
        ok({
          userId: String((user as any)._id),
          name: (user as any).name ?? null,
          email: (user as any).email,
          profilePicture: (user as any).profilePicture ?? null,
          role: membership.role ?? "stakeholder",
          guest: membership.guest === true,
          permissions: normalizePermissions(membership),
          pending,
          editable: isAssignable(membership),
          history: (history as any[]).map((g) => ({
            grantId: String(g._id),
            module: g.module,
            action: g.action,
            status: g.status,
            expiresAt: g.expiresAt ?? null,
            respondedAt: g.respondedAt ?? null,
            createdAt: g.createdAt,
            grantedBy: g.grantedBy
              ? {
                  id: String(g.grantedBy._id),
                  name: g.grantedBy.name ?? null,
                  email: g.grantedBy.email ?? null,
                }
              : null,
          })),
        })
      );
    } catch (err: any) {
      console.error("[RBAC] GET /members/:userId error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

// ---------------------------------------------------------------------------
// Founder-facing — granting
// ---------------------------------------------------------------------------

const grantBody = modulesBody.extend({ userId: objectId });

/** POST /rbac/grants — offer modules to one member. Creates pending grants. */
router.post(
  "/grants",
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const orgId = scopedOrgId(req);
      const me = (req as any).user as { userId: string; email?: string };

      const parsed = grantBody.safeParse(req.body);
      if (!parsed.success) {
        return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid body");
      }

      const modules = sanitizeModuleList(parsed.data.modules);
      if (!modules.length) {
        return badRequest(
          res,
          `Unknown module. Valid modules: ${RBAC_MODULES.join(", ")}`
        );
      }

      const actor = await User.findById(me.userId).select("name").lean();
      const result = await createGrants({
        orgId,
        targetUserId: parsed.data.userId,
        modules,
        actorId: me.userId,
        actorName: (actor as any)?.name || me.email,
      });

      // A single-target request that produced nothing is a client error worth
      // surfacing as such, rather than a misleading 200.
      if (
        !result.created.length &&
        !result.existing.length &&
        result.skipped.length
      ) {
        const reason = result.skipped[0].reason;
        if (reason === "SELF_ASSIGN") {
          return badRequest(
            res,
            "You cannot assign permissions to yourself",
            "SELF_ASSIGN"
          );
        }
        if (reason === "NOT_ASSIGNABLE") {
          return badRequest(
            res,
            "Permissions can only be assigned to non-founder, non-guest members",
            "NOT_ASSIGNABLE"
          );
        }
        if (reason === "NOT_A_MEMBER") {
          return res
            .status(404)
            .json(fail("Member not found in this organization", "NOT_A_MEMBER"));
        }
      }

      return res.json(
        ok({
          created: result.created.map((g: any) => ({
            grantId: String(g._id),
            module: g.module,
            expiresAt: g.expiresAt,
            status: g.status,
          })),
          alreadyPending: result.existing.map((g: any) => ({
            grantId: String(g._id),
            module: g.module,
            expiresAt: g.expiresAt,
          })),
          skipped: result.skipped,
        })
      );
    } catch (err: any) {
      console.error("[RBAC] POST /grants error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

const bulkBody = modulesBody.extend({
  userIds: z.array(objectId).min(1, "At least one member is required"),
});

/**
 * POST /rbac/grants/bulk — same offer to many members (the checkbox column).
 * Never fails wholesale; ineligible members come back in `skipped`.
 */
router.post(
  "/grants/bulk",
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const orgId = scopedOrgId(req);
      const me = (req as any).user as { userId: string; email?: string };

      const parsed = bulkBody.safeParse(req.body);
      if (!parsed.success) {
        return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid body");
      }

      const modules = sanitizeModuleList(parsed.data.modules);
      if (!modules.length) {
        return badRequest(
          res,
          `Unknown module. Valid modules: ${RBAC_MODULES.join(", ")}`
        );
      }

      const actor = await User.findById(me.userId).select("name").lean();
      const actorName = (actor as any)?.name || me.email;

      const created: any[] = [];
      const skipped: any[] = [];
      for (const userId of [...new Set(parsed.data.userIds)]) {
        const result = await createGrants({
          orgId,
          targetUserId: userId,
          modules,
          actorId: me.userId,
          actorName,
        });
        created.push(
          ...result.created.map((g: any) => ({
            userId,
            grantId: String(g._id),
            module: g.module,
            expiresAt: g.expiresAt,
          }))
        );
        skipped.push(...result.skipped);
      }

      return res.json(
        ok({ created, skipped, createdCount: created.length })
      );
    } catch (err: any) {
      console.error("[RBAC] POST /grants/bulk error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

/** POST /rbac/grants/:grantId/resend — restart the 24h clock on a live offer. */
router.post(
  "/grants/:grantId/resend",
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const orgId = scopedOrgId(req);
      const parsed = objectId.safeParse(req.params.grantId);
      if (!parsed.success) return badRequest(res, "Invalid grant ID");

      const grant = await PermissionGrant.findOne({
        _id: parsed.data,
        orgId,
        action: "grant",
      });
      if (!grant) return res.status(404).json(fail("Grant not found"));

      // An offer that already lapsed can be revived by resending — that is the
      // whole point of this endpoint, so re-open it rather than 410.
      if (grant.status !== "pending" && grant.status !== "expired") {
        return res
          .status(409)
          .json(fail(`Grant already ${grant.status}`, "GRANT_NOT_PENDING"));
      }

      grant.status = "pending";
      grant.respondedAt = undefined as any;
      grant.expiresAt = new Date(Date.now() + GRANT_TTL_MS);
      await grant.save();

      return res.json(
        ok({
          grantId: String(grant._id),
          module: grant.module,
          expiresAt: grant.expiresAt,
          status: grant.status,
        })
      );
    } catch (err: any) {
      // Reviving an expired grant can collide with a newer pending offer for
      // the same (org, member, module).
      if (err?.code === 11000) {
        return res
          .status(409)
          .json(
            fail(
              "A live offer already exists for this module",
              "GRANT_ALREADY_PENDING"
            )
          );
      }
      console.error("[RBAC] resend grant error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

/** DELETE /rbac/grants/:grantId — withdraw an offer before it is answered. */
router.delete(
  "/grants/:grantId",
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const orgId = scopedOrgId(req);
      const parsed = objectId.safeParse(req.params.grantId);
      if (!parsed.success) return badRequest(res, "Invalid grant ID");

      const grant = await PermissionGrant.findOne({
        _id: parsed.data,
        orgId,
        action: "grant",
      });
      if (!grant) return res.status(404).json(fail("Grant not found"));
      if (grant.status !== "pending") {
        return res
          .status(409)
          .json(fail(`Grant already ${grant.status}`, "GRANT_NOT_PENDING"));
      }

      grant.status = "cancelled";
      grant.respondedAt = new Date();
      await grant.save();

      return res.json(
        ok({ grantId: String(grant._id), module: grant.module, status: "cancelled" })
      );
    } catch (err: any) {
      console.error("[RBAC] cancel grant error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

// ---------------------------------------------------------------------------
// Founder-facing — revoking (immediate, no acceptance step)
// ---------------------------------------------------------------------------

/** Shared validation for both revoke endpoints. */
async function loadRevokeTarget(req: Request, res: Response, orgId: string) {
  const me = (req as any).user as { userId: string };
  const parsed = objectId.safeParse(req.params.userId);
  if (!parsed.success) {
    badRequest(res, "Invalid user ID");
    return null;
  }
  if (parsed.data === me.userId) {
    badRequest(res, "You cannot change your own permissions", "SELF_ASSIGN");
    return null;
  }

  const user = await User.findById(parsed.data).select("organizations").lean();
  const membership = findMembership(
    (user as any)?.organizations as OrgMembershipLike[],
    orgId
  );
  if (!membership) {
    res.status(404).json(fail("Member not found in this organization"));
    return null;
  }
  if (!isAssignable(membership)) {
    badRequest(
      res,
      "Permissions can only be changed for non-founder, non-guest members",
      "NOT_ASSIGNABLE"
    );
    return null;
  }
  return { userId: parsed.data, membership };
}

/** DELETE /rbac/members/:userId/permissions/:module — revoke one, immediately. */
router.delete(
  "/members/:userId/permissions/:module",
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const orgId = scopedOrgId(req);
      const me = (req as any).user as { userId: string };

      const module = req.params.module;
      if (!isRbacModule(module)) {
        return badRequest(res, `Unknown module: ${module}`);
      }

      const target = await loadRevokeTarget(req, res, orgId);
      if (!target) return;

      const result = await revokeModules({
        orgId,
        targetUserId: target.userId,
        modules: [module],
        actorId: me.userId,
      });

      return res.json(
        ok({
          userId: target.userId,
          revoked: result.revoked,
          cancelledPending: result.cancelled,
        })
      );
    } catch (err: any) {
      console.error("[RBAC] revoke module error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

/** DELETE /rbac/members/:userId/permissions — revoke everything, immediately. */
router.delete(
  "/members/:userId/permissions",
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const orgId = scopedOrgId(req);
      const me = (req as any).user as { userId: string };

      const target = await loadRevokeTarget(req, res, orgId);
      if (!target) return;

      // Only touch modules they actually hold, so the audit trail does not fill
      // with no-op revokes.
      const current = normalizePermissions(target.membership);
      const held = RBAC_MODULES.filter((m) => current[m] === true);

      const result = await revokeModules({
        orgId,
        targetUserId: target.userId,
        modules: held,
        actorId: me.userId,
      });

      return res.json(
        ok({
          userId: target.userId,
          revoked: result.revoked,
          cancelledPending: result.cancelled,
        })
      );
    } catch (err: any) {
      console.error("[RBAC] revoke all error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

// ---------------------------------------------------------------------------
// Founder-facing — audit trail
// ---------------------------------------------------------------------------

/**
 * GET /rbac/grants?orgId=&status=&userId=&module=&action=&page=&limit=
 * Every grant and revoke ever made in this org — the audit log.
 */
router.get(
  "/grants",
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const orgId = scopedOrgId(req);
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

      const query: Record<string, unknown> = { orgId };

      const status = req.query.status as string | undefined;
      if (status) query.status = status;

      const action = req.query.action as string | undefined;
      if (action) query.action = action;

      const moduleFilter = req.query.module as string | undefined;
      if (moduleFilter) {
        if (!isRbacModule(moduleFilter)) {
          return badRequest(res, `Unknown module: ${moduleFilter}`);
        }
        query.module = moduleFilter;
      }

      const userId = req.query.userId as string | undefined;
      if (userId) {
        if (!objectId.safeParse(userId).success) {
          return badRequest(res, "Invalid user ID");
        }
        query.userId = userId;
      }

      const [grants, total] = await Promise.all([
        PermissionGrant.find(query)
          .populate("userId", "name email profilePicture")
          .populate("grantedBy", "name email")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        PermissionGrant.countDocuments(query),
      ]);

      return res.json(
        ok({
          grants: (grants as any[]).map((g) => ({
            grantId: String(g._id),
            module: g.module,
            moduleLabel: MODULE_LABELS[g.module as RbacModule] ?? g.module,
            action: g.action,
            status: g.status,
            expiresAt: g.expiresAt ?? null,
            respondedAt: g.respondedAt ?? null,
            createdAt: g.createdAt,
            member: g.userId
              ? {
                  id: String(g.userId._id ?? g.userId),
                  name: g.userId.name ?? null,
                  email: g.userId.email ?? null,
                  profilePicture: g.userId.profilePicture ?? null,
                }
              : null,
            grantedBy: g.grantedBy
              ? {
                  id: String(g.grantedBy._id ?? g.grantedBy),
                  name: g.grantedBy.name ?? null,
                  email: g.grantedBy.email ?? null,
                }
              : null,
          })),
          page,
          limit,
          total,
          hasMore: page * limit < total,
        })
      );
    } catch (err: any) {
      console.error("[RBAC] GET /grants error:", err);
      return res.status(500).json(fail("Internal server error"));
    }
  }
);

export default router;
