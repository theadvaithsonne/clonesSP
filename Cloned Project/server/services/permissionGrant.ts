import { PermissionGrant } from "../models/permissionGrant.model";
import { UserNotification } from "../models/userNotification.model";
import { User } from "../models/user.model";
import {
  GRANT_TTL_MS,
  MODULE_LABELS,
  RbacModule,
} from "../config/rbacModules";
import {
  findMembership,
  isAssignable,
  normalizePermissions,
  OrgMembershipLike,
} from "../utils/rbac";

/**
 * Grant lifecycle for module-level RBAC.
 *
 * The asymmetry to keep in mind throughout: granting is an OFFER (pending →
 * the member accepts → permission writes), revoking is an ACT (permission
 * writes immediately, the row is only an audit record).
 */

export type SkipReason =
  | "NOT_A_MEMBER"
  | "NOT_ASSIGNABLE"
  | "SELF_ASSIGN"
  | "ALREADY_GRANTED";

export interface Skipped {
  userId: string;
  module?: RbacModule;
  reason: SkipReason;
}

/**
 * Flip a pending grant whose clock ran out.
 *
 * Called on every read/accept path so correctness never depends on the
 * sweeper — a stalled cron can delay tidying, but it cannot leak access.
 * Returns true when the grant is (now) expired.
 */
export async function expireIfLapsed(grant: any): Promise<boolean> {
  if (!grant || grant.status !== "pending") return false;
  if (!grant.expiresAt || grant.expiresAt.getTime() > Date.now()) return false;

  grant.status = "expired";
  grant.respondedAt = new Date();
  await grant.save();
  return true;
}

/** Pending, unexpired grants for a set of members in one org. */
export async function findLiveGrants(orgId: string, userIds: string[]) {
  if (!userIds.length) return [];
  return PermissionGrant.find({
    orgId,
    userId: { $in: userIds },
    action: "grant",
    status: "pending",
    expiresAt: { $gt: new Date() },
  }).lean();
}

async function notifyGrantOffered(params: {
  orgId: string;
  userId: string;
  grantId: any;
  module: RbacModule;
  expiresAt: Date;
  grantedByName?: string;
}) {
  try {
    await UserNotification.create({
      userId: params.userId,
      orgId: params.orgId,
      type: "permission_grant",
      grantId: params.grantId,
      grantModule: params.module,
      grantModuleLabel: MODULE_LABELS[params.module],
      grantExpiresAt: params.expiresAt,
      grantedByName: params.grantedByName || "A founder",
    });
  } catch (err: any) {
    // A missing notification must never fail the grant itself — the member can
    // still see it via GET /rbac/my-grants.
    console.error(
      "[PermissionGrant] Failed to write notification:",
      err?.message ?? err
    );
  }
}

/**
 * Offer `modules` to one member. Does NOT change their access.
 *
 * Idempotent: re-offering a module that already has a live pending grant
 * returns that grant untouched, without extending its expiry. Use resend for
 * that.
 */
export async function createGrants(params: {
  orgId: string;
  targetUserId: string;
  modules: RbacModule[];
  actorId: string;
  actorName?: string;
}): Promise<{ created: any[]; existing: any[]; skipped: Skipped[] }> {
  const { orgId, targetUserId, modules, actorId, actorName } = params;
  const created: any[] = [];
  const existing: any[] = [];
  const skipped: Skipped[] = [];

  if (targetUserId === actorId) {
    return {
      created,
      existing,
      skipped: [{ userId: targetUserId, reason: "SELF_ASSIGN" }],
    };
  }

  const targetUser = await User.findById(targetUserId)
    .select("organizations")
    .lean();
  const membership = findMembership(
    targetUser?.organizations as OrgMembershipLike[],
    orgId
  );

  if (!membership) {
    return {
      created,
      existing,
      skipped: [{ userId: targetUserId, reason: "NOT_A_MEMBER" }],
    };
  }
  if (!isAssignable(membership)) {
    return {
      created,
      existing,
      skipped: [{ userId: targetUserId, reason: "NOT_ASSIGNABLE" }],
    };
  }

  const current = normalizePermissions(membership);

  for (const module of modules) {
    if (current[module] === true) {
      skipped.push({ userId: targetUserId, module, reason: "ALREADY_GRANTED" });
      continue;
    }

    const insert = async () => {
      const expiresAt = new Date(Date.now() + GRANT_TTL_MS);
      const grant = await PermissionGrant.create({
        orgId,
        userId: targetUserId,
        module,
        action: "grant",
        status: "pending",
        grantedBy: actorId,
        expiresAt,
      });
      created.push(grant);
      await notifyGrantOffered({
        orgId,
        userId: targetUserId,
        grantId: grant._id,
        module,
        expiresAt,
        grantedByName: actorName,
      });
    };

    try {
      await insert();
    } catch (err: any) {
      // Duplicate key on the partial unique index => an offer already occupies
      // this (org, member, module) slot.
      if (err?.code !== 11000) throw err;

      const live = await PermissionGrant.findOne({
        orgId,
        userId: targetUserId,
        module,
        status: "pending",
      });

      if (!live) {
        // Raced with a sweep or a response that freed the slot — retry once.
        await insert();
      } else if (await expireIfLapsed(live)) {
        // The blocking offer had already lapsed; retire it and re-offer, so a
        // founder is never stuck behind a dead grant.
        await insert();
      } else {
        // A genuinely live offer. Idempotent: hand it back, clock untouched.
        existing.push(live);
      }
    }
  }

  return { created, existing, skipped };
}

/** Member accepted — write the permission and close the grant. */
export async function acceptGrant(grant: any): Promise<void> {
  await User.updateOne(
    {
      _id: grant.userId,
      "organizations.organization": grant.orgId,
    },
    {
      $set: {
        [`organizations.$.modulePermissions.${grant.module}`]: true,
      },
    }
  );

  grant.status = "accepted";
  grant.respondedAt = new Date();
  await grant.save();
}

/** Member declined — nothing changes except the grant's status. */
export async function declineGrant(grant: any): Promise<void> {
  grant.status = "declined";
  grant.respondedAt = new Date();
  await grant.save();
}

/**
 * Take `modules` away from a member — immediately, with no acceptance step.
 *
 * Also cancels any live offer for those modules, so revoking cannot leave a
 * pending grant behind that the member could later accept to undo it.
 */
export async function revokeModules(params: {
  orgId: string;
  targetUserId: string;
  modules: RbacModule[];
  actorId: string;
}): Promise<{ revoked: RbacModule[]; cancelled: number }> {
  const { orgId, targetUserId, modules, actorId } = params;
  if (!modules.length) return { revoked: [], cancelled: 0 };

  const unset: Record<string, boolean> = {};
  for (const module of modules) {
    unset[`organizations.$.modulePermissions.${module}`] = false;
  }

  await User.updateOne(
    { _id: targetUserId, "organizations.organization": orgId },
    { $set: unset }
  );

  const cancelled = await PermissionGrant.updateMany(
    {
      orgId,
      userId: targetUserId,
      module: { $in: modules },
      action: "grant",
      status: "pending",
    },
    { $set: { status: "cancelled", respondedAt: new Date() } }
  );

  // Audit rows — revokes have no pending phase, so they land as applied.
  await PermissionGrant.insertMany(
    modules.map((module) => ({
      orgId,
      userId: targetUserId,
      module,
      action: "revoke",
      status: "applied",
      grantedBy: actorId,
      respondedAt: new Date(),
    }))
  );

  return { revoked: modules, cancelled: cancelled.modifiedCount ?? 0 };
}
