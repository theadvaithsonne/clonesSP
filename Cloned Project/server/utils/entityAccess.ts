import { Types } from "mongoose";
import { User } from "../models/user.model";
import { FranchiseCountry } from "../models/franchiseCountry.model";
import { FranchiseTerritory } from "../models/franchiseTerritory.model";
import { FranchiseSubTerritory } from "../models/franchiseSubTerritory.model";
import { FranchiseTerritoryAssignment } from "../models/franchiseTerritoryAssignment.model";
import { FranchiseGlobalAssignment } from "../models/franchiseGlobalAssignment.model";
import { PLATFORM_USER_EMAIL } from "../services/commission";

export type EntityLevel = "country" | "territory" | "subTerritory";

/**
 * Compute the ancestor chain of a franchise catalog entity, starting from
 * itself and walking UP to the country.
 *
 *   subTerritory  → [subTerritory, territory, country]
 *   territory     → [territory, country]
 *   country       → [country]
 *
 * Uses the catalog's `parentTerritory` / `country` name fields (case-
 * insensitive lookup) since the models don't consistently carry parent
 * ObjectIds. Returns [] if the entity isn't found.
 */
export async function loadEntityWithAncestors(
  level: EntityLevel,
  entityId: string
): Promise<Array<{ level: EntityLevel; id: string; entity: any }>> {
  const out: Array<{ level: EntityLevel; id: string; entity: any }> = [];

  if (level === "subTerritory") {
    const sub = await FranchiseSubTerritory.findById(entityId).lean<any>();
    if (!sub) return [];
    out.push({ level: "subTerritory", id: String(sub._id), entity: sub });
    if (sub.parentTerritory && sub.country) {
      const ter = await FranchiseTerritory.findOne({
        name: new RegExp(
          "^" + escapeRegex(String(sub.parentTerritory).trim()) + "$",
          "i"
        ),
        country: new RegExp(
          "^" + escapeRegex(String(sub.country).trim()) + "$",
          "i"
        ),
      }).lean<any>();
      if (ter) out.push({ level: "territory", id: String(ter._id), entity: ter });
    }
    if (sub.country) {
      const cou = await FranchiseCountry.findOne({
        name: new RegExp(
          "^" + escapeRegex(String(sub.country).trim()) + "$",
          "i"
        ),
      }).lean<any>();
      if (cou) out.push({ level: "country", id: String(cou._id), entity: cou });
    }
    return out;
  }

  if (level === "territory") {
    const ter = await FranchiseTerritory.findById(entityId).lean<any>();
    if (!ter) return [];
    out.push({ level: "territory", id: String(ter._id), entity: ter });
    if (ter.country) {
      const cou = await FranchiseCountry.findOne({
        name: new RegExp(
          "^" + escapeRegex(String(ter.country).trim()) + "$",
          "i"
        ),
      }).lean<any>();
      if (cou) out.push({ level: "country", id: String(cou._id), entity: cou });
    }
    return out;
  }

  const cou = await FranchiseCountry.findById(entityId).lean<any>();
  if (!cou) return [];
  return [{ level: "country", id: String(cou._id), entity: cou }];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns true iff `userId` is allowed to view detail (customers, affiliates)
 * for the given franchise entity. Six ways in:
 *   1. Platform admin.
 *   2. Active FranchiseGlobalAssignment on this entity (System A direct owner).
 *   3. Active FranchiseTerritoryAssignment on this entity (System B direct owner).
 *   4. Any of the above for a PARENT entity (country owner sees territory,
 *      territory owner sees sub-territory).
 *   5. Legacy catalog `ownerEmail` matches user's email on this entity or any
 *      parent (System A legacy fallback — pre-Garage-invoice owners).
 *
 * Returns a discriminator for logging / audit.
 */
export async function canAccessEntity(
  userId: string,
  level: EntityLevel,
  entityId: string
): Promise<{
  allowed: boolean;
  reason:
    | "platform_admin"
    | "garage_owner_system_a"
    | "garage_owner_system_b"
    | "catalog_legacy_owner"
    | "denied";
}> {
  if (!Types.ObjectId.isValid(userId)) {
    return { allowed: false, reason: "denied" };
  }

  const dbUser = await User.findById(userId)
    .select("email")
    .lean<any>();
  if (!dbUser) return { allowed: false, reason: "denied" };

  // (1) Platform admin — cheapest.
  const userEmail = String(dbUser.email || "").toLowerCase();
  if (userEmail === PLATFORM_USER_EMAIL.toLowerCase()) {
    return { allowed: true, reason: "platform_admin" };
  }

  const chain = await loadEntityWithAncestors(level, entityId);
  if (chain.length === 0) {
    return { allowed: false, reason: "denied" };
  }

  const uidObj = new Types.ObjectId(userId);

  // (5) Legacy catalog ownerEmail on any level in the chain — cheapest DB
  //     work after we already loaded the entities.
  for (const step of chain) {
    const catalogEmail = String(step.entity.ownerEmail || "").toLowerCase();
    if (catalogEmail && catalogEmail === userEmail) {
      return { allowed: true, reason: "catalog_legacy_owner" };
    }
  }

  const scopes = chain.map((s) => ({ geoLevel: s.level, geoEntityId: s.id }));

  // (2) System A — global Garage assignment on this or any parent entity.
  const sysA = await FranchiseGlobalAssignment.exists({
    ownerUserId: uidObj,
    status: "active",
    $or: scopes,
  });
  if (sysA) return { allowed: true, reason: "garage_owner_system_a" };

  // (3)/(4) System B — per-office franchise assignment.
  const sysB = await FranchiseTerritoryAssignment.exists({
    ownerUserId: uidObj,
    status: "active",
    $or: scopes,
  });
  if (sysB) return { allowed: true, reason: "garage_owner_system_b" };

  return { allowed: false, reason: "denied" };
}
