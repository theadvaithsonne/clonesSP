import { Types } from "mongoose";
import { User } from "../models/user.model";
import { FranchiseTerritoryAssignment } from "../models/franchiseTerritoryAssignment.model";
import { FranchiseGlobalAssignment } from "../models/franchiseGlobalAssignment.model";
import { hasFounderAccess } from "./accessCheck";
import { resolveLeafFromOrg } from "./territoryResolver";
import { PLATFORM_USER_EMAIL } from "../services/commission";

/**
 * Returns true iff `userId` is allowed to view the customer roster of
 * office `officeId`. Three roles qualify:
 *
 *   1. **Office founder** — the user's primary `organization` is the office
 *      with role admin/founder, OR the user has an `organizations[]`
 *      membership on the office with founder-level access.
 *   2. **Platform admin** — user's email matches `PLATFORM_USER_EMAIL`.
 *   3. **Franchise owner in the office's chain** — the user owns an ACTIVE
 *      `FranchiseTerritoryAssignment` (System B) OR `FranchiseGlobalAssignment`
 *      (System A) for any level (subT/terr/country) that contains this
 *      office's geo location.
 *
 * Returns a discriminator alongside so callers can log or explain refusals.
 */
export async function canAccessOfficeCustomers(
  userId: string,
  officeId: string
): Promise<{
  allowed: boolean;
  reason:
    | "office_founder"
    | "platform_admin"
    | "franchise_owner_system_a"
    | "franchise_owner_system_b"
    | "denied";
}> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(officeId)) {
    return { allowed: false, reason: "denied" };
  }

  const dbUser = await User.findById(userId)
    .select("email role organization organizations")
    .lean<any>();
  if (!dbUser) return { allowed: false, reason: "denied" };

  // (2) Platform admin — cheapest check.
  if (
    (dbUser.email || "").toLowerCase() === PLATFORM_USER_EMAIL.toLowerCase()
  ) {
    return { allowed: true, reason: "platform_admin" };
  }

  // (1) Office founder.
  const primaryOrg = dbUser.organization?.toString();
  const isPrimaryFounder =
    primaryOrg === officeId &&
    ["admin", "founder"].includes(dbUser.role || "");
  if (isPrimaryFounder) return { allowed: true, reason: "office_founder" };

  const membership = (dbUser.organizations as any[] | undefined)?.find(
    (m: any) => m.organization?.toString() === officeId
  );
  if (membership && hasFounderAccess(membership)) {
    return { allowed: true, reason: "office_founder" };
  }

  // (3) Franchise owner in the office's chain. Only run the chain resolve
  //     if the cheaper checks failed — it does a Mongo query per catalog
  //     level.
  const chain = await resolveLeafFromOrg(officeId);
  if (!chain) return { allowed: false, reason: "denied" };
  const scopes: Array<{
    level: "country" | "territory" | "subTerritory";
    id: string;
  }> = [];
  if (chain.subTerritory) {
    scopes.push({
      level: "subTerritory",
      id: String((chain.subTerritory as any)._id),
    });
  }
  if (chain.territory) {
    scopes.push({
      level: "territory",
      id: String((chain.territory as any)._id),
    });
  }
  if (chain.country) {
    scopes.push({
      level: "country",
      id: String((chain.country as any)._id),
    });
  }
  if (scopes.length === 0) return { allowed: false, reason: "denied" };

  const uidObj = new Types.ObjectId(userId);

  // System B — per-office franchise. Any active assignment owned by userId
  // for one of the chain's levels grants access.
  const sysB = await FranchiseTerritoryAssignment.exists({
    ownerUserId: uidObj,
    status: "active",
    $or: scopes.map((s) => ({
      geoLevel: s.level,
      geoEntityId: s.id,
    })),
  });
  if (sysB) return { allowed: true, reason: "franchise_owner_system_b" };

  // System A — global franchise. Same shape, different collection.
  const sysA = await FranchiseGlobalAssignment.exists({
    ownerUserId: uidObj,
    status: "active",
    $or: scopes.map((s) => ({
      geoLevel: s.level,
      geoEntityId: s.id,
    })),
  });
  if (sysA) return { allowed: true, reason: "franchise_owner_system_a" };

  return { allowed: false, reason: "denied" };
}
