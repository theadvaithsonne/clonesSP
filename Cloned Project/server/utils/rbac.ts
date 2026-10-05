import {
  RBAC_MODULES,
  RbacModule,
  emptyPermissions,
  isRbacModule,
} from "../config/rbacModules";
import { hasFounderAccess } from "./accessCheck";

/**
 * The shape of a single entry in `user.organizations[]`. Deliberately loose:
 * callers pass both hydrated Mongoose subdocuments and `.lean()` plain objects.
 */
export interface OrgMembershipLike {
  organization?: any;
  role?: string | null;
  fullAccess?: boolean;
  guest?: boolean;
  modulePermissions?: Record<string, boolean> | null;
}

/** Locate a user's membership in a given org. Returns null when not a member. */
export function findMembership<T extends OrgMembershipLike>(
  memberships: T[] | null | undefined,
  orgId: string | null | undefined,
): T | null {
  if (!memberships || !orgId) return null;
  return (
    memberships.find((m) => m?.organization?.toString() === orgId) ?? null
  );
}

/**
 * Read a membership's module permissions as a complete, all-keys-present map.
 *
 * This must be used for EVERY read. Most read paths in this codebase use
 * `.lean()`, and Mongoose does not apply schema defaults to lean results — so
 * `membership.modulePermissions` is `undefined` on every document written
 * before this feature shipped. Touching it directly yields `undefined` instead
 * of `false`, which is falsy but breaks any JSON response the client reads.
 */
export function normalizePermissions(
  membership: OrgMembershipLike | null | undefined,
): Record<RbacModule, boolean> {
  const out = emptyPermissions();
  const stored = membership?.modulePermissions;
  if (!stored) return out;
  for (const mod of RBAC_MODULES) {
    out[mod] = (stored as any)[mod] === true;
  }
  return out;
}

/**
 * Is this membership an admin of `module`?
 *
 * Founders — and stakeholders holding the legacy `fullAccess` flag — bypass.
 * That bypass reuses `hasFounderAccess()`, which is the same check every
 * founder-only route already performs, so swapping `requireFounder` for
 * `requireModuleAdmin` on an existing route can never remove access from
 * someone who has it today.
 */
export function isModuleAdmin(
  membership: OrgMembershipLike | null | undefined,
  module: RbacModule,
): boolean {
  if (!membership) return false;
  if (hasFounderAccess(membership)) return true;
  return normalizePermissions(membership)[module] === true;
}

/**
 * Can a founder assign module permissions to this membership?
 *
 * Only non-founder, non-guest members. Founders already have everything, and
 * guests are outside the employee permission model entirely.
 */
export function isAssignable(
  membership: OrgMembershipLike | null | undefined,
): boolean {
  if (!membership) return false;
  return membership.role !== "founder" && membership.guest !== true;
}

/** Filter arbitrary input down to known modules, de-duplicated. */
export function sanitizeModuleList(input: unknown): RbacModule[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter(isRbacModule))];
}

/**
 * "Can this user manage `module` in this org?" — the retrofit entry point for
 * the per-file `isUserFounder(userId, orgId)` helpers in the module route
 * files (course.ts, product.ts, feed.ts, workshop.ts).
 *
 * Returns true for founders, legacy single-org admins, `fullAccess` holders,
 * and members the founder granted this module. Because it is a superset of the
 * founder check those helpers already performed, swapping it in cannot remove
 * access from anyone who has it today.
 *
 * Does its own lookup so it is a drop-in for helpers that only receive ids.
 * Prefer middleware/rbac.ts#requireModuleAdmin on routes that run after
 * requireAuth — that path reuses the membership already on the request.
 */
export async function isFounderOrModuleAdmin(
  userId: string,
  orgId: string,
  module: RbacModule,
): Promise<boolean> {
  if (!userId || !orgId) return false;

  // Imported lazily: utils are loaded by middleware that the model layer does
  // not depend on, and this keeps that direction of the graph one-way.
  const { User } = await import("../models/user.model");
  const user = await User.findById(userId)
    .select("role organization organizations")
    .lean();
  if (!user) return false;

  // Legacy single-org founder, preserved from the helpers this replaces.
  if (
    (user as any).organization?.toString() === orgId &&
    ["admin", "founder"].includes((user as any).role || "")
  ) {
    return true;
  }

  const membership = findMembership(
    (user as any).organizations as OrgMembershipLike[],
    orgId,
  );
  // Covers founder, fullAccess, and an accepted grant for this module.
  return isModuleAdmin(membership, module);
}
