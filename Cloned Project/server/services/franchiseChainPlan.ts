import { FranchiseGeoLevel } from "../models/franchiseTerritoryAssignment.model";

/**
 * Pure chain-integrity decision for founder-program payouts. No DB access —
 * kept dependency-free so it can be unit-tested in isolation and reused by the
 * distributor (services/franchiseProgramCommission.ts).
 *
 * Rule (cascade-up, updated 2026-07-17):
 *   Each level's slice is paid to the assigned owner AT THAT LEVEL. When a
 *   level has no owner, its slice cascades UPWARDS to the nearest owner
 *   above (territory → country). Anything that never finds an owner in the
 *   chain stays with the source (the office wallet, in this system).
 *
 *   Concretely:
 *     - subTerritory slice: paid to subT owner if assigned; else to
 *       territory owner if assigned; else to country owner if assigned;
 *       else stays with office.
 *     - territory slice: paid to territory owner if assigned; else to
 *       country owner if assigned; else stays with office.
 *     - country slice: paid to country owner if assigned; else stays with
 *       office.
 *
 * Previous rule (removed): territory owner required subT to also be
 * assigned; country owner required both sub AND territory to be assigned.
 * That blocked mid-tier owners from earning when the ground level hadn't
 * been sub-franchised yet — founder wanted upper levels to earn
 * independently AND absorb unowned lower slices.
 *
 * `assigned[level]` is truthy when an ACTIVE assignment exists at that level
 * for the buyer's geo entity; `cfg[level]` is the founder-configured % (a slice
 * is only planned when its % is > 0).
 */

export type CommissionConfig = {
  country: number;
  territory: number;
  subTerritory: number;
};

export type LevelAssigned = {
  country: boolean;
  territory: boolean;
  subTerritory: boolean;
};

export interface ChainPlanItem {
  /** Which configured slice this payout represents (the level the % came from). */
  sliceLevel: FranchiseGeoLevel;
  /** Where the slice actually lands (may differ from sliceLevel when cascaded UP). */
  recipientLevel: FranchiseGeoLevel;
  splitPct: number;
}

export function buildFranchiseChainPlan(
  assigned: LevelAssigned,
  cfg: CommissionConfig
): ChainPlanItem[] {
  const plan: ChainPlanItem[] = [];

  // Nearest-owner-at-or-above helper.
  const cascadeFrom = (level: FranchiseGeoLevel): FranchiseGeoLevel | null => {
    if (level === "subTerritory") {
      if (assigned.subTerritory) return "subTerritory";
      if (assigned.territory) return "territory";
      if (assigned.country) return "country";
      return null;
    }
    if (level === "territory") {
      if (assigned.territory) return "territory";
      if (assigned.country) return "country";
      return null;
    }
    // country
    if (assigned.country) return "country";
    return null;
  };

  if (cfg.subTerritory > 0) {
    const recipientLevel = cascadeFrom("subTerritory");
    if (recipientLevel) {
      plan.push({
        sliceLevel: "subTerritory",
        recipientLevel,
        splitPct: cfg.subTerritory,
      });
    }
  }
  if (cfg.territory > 0) {
    const recipientLevel = cascadeFrom("territory");
    if (recipientLevel) {
      plan.push({
        sliceLevel: "territory",
        recipientLevel,
        splitPct: cfg.territory,
      });
    }
  }
  if (cfg.country > 0) {
    const recipientLevel = cascadeFrom("country");
    if (recipientLevel) {
      plan.push({
        sliceLevel: "country",
        recipientLevel,
        splitPct: cfg.country,
      });
    }
  }

  return plan;
}
