// src/services/unilevelPlusCalculator.ts
//
// Pure earnings model for the $25 Unilevel Plus licence. No DB writes, no
// side effects — it takes a plan plus a hypothetical org shape and returns
// what that shape would pay, with the reasoning attached.
//
// It mirrors services/unilevelPlusCommission.ts rather than inventing a
// second set of rules. Where the two could drift, the constants below are
// the ones to keep in step:
//
//   direct   — flat `directBonusPercentage` of the sale, to the buyer's
//              direct referrer only.
//   level    — `legMultiplier × level × pointValue` per sale, walking up to
//              `maxLevels`. Multiplier comes from the upline's leg POSITION
//              (1st direct → 1×, 2nd → 2×, 3rd and beyond → 3×).
//   infinity — a flat amount per qualifying upline, capped at 3 recipients
//              per tier per sale. Qualifying is a HEADCOUNT: the upline has
//              4+ (T1) / 10+ (T2) directs holding an active licence, and is
//              then paid on every sale beneath them, whichever leg it came
//              through. (Position-gated until 2026-09-16.)
//   manager  — reserved and paid to NOBODY. It sweeps to the platform along
//              with the company share and any unspent pool.

import { IUnilevelPlusPlan } from "../models/unilevelPlusPlan.model";

/** Kept in step with the same-named constants in unilevelPlusCommission.ts. */
export const CALC_T1_PER_RECIPIENT = 0.4;
export const CALC_T2_PER_RECIPIENT = 2.0;
export const CALC_MAX_RECIPIENTS_PER_TIER = 3;
export const CALC_T1_MIN_LEGS = 4;
export const CALC_T2_MIN_LEGS = 10;

export interface CalculatorInput {
  /** Your UP-active direct referrals. Each one is a "leg". */
  directs: number;
  /** Headcount per level, level 1 first. Overrides duplication/depth. */
  levels?: number[];
  /** Symmetric model: how many each person goes on to refer. */
  duplication?: number;
  /** Symmetric model: how many levels deep to project. */
  depth?: number;
  /** Override the licence price. Defaults to the live plan. */
  licencePrice?: number;
}

export interface LevelRow {
  level: number;
  people: number;
  /** Average leg multiplier applied at this level. */
  legMultiplier: number;
  pointsPerSale: number;
  perSaleUsd: number;
  totalUsd: number;
}

export interface CalculatorResult {
  plan: {
    name: string;
    licencePrice: number;
    currency: string;
    maxLevels: number;
    pointValue: number;
    legMultipliers: number[];
    pools: Record<string, { percent: number; usd: number; paidTo: string }>;
  };
  inputs: {
    directs: number;
    levels: number[];
    totalDownline: number;
    source: "levels" | "duplication" | "directs-only";
  };
  summary: {
    totalDownline: number;
    /** One licence sale per person in the projection. */
    totalSales: number;
    youEarnUsd: number;
    averagePerSaleUsd: number;
    /** What the same downline pays the platform, for contrast. */
    platformKeepsUsd: number;
  };
  breakdown: {
    directBonus: { usd: number; sales: number; perSaleUsd: number; explanation: string };
    levelBonus: { usd: number; byLevel: LevelRow[]; explanation: string };
    infinityTier1: {
      usd: number; qualified: boolean; qualifyingSales: number;
      perSaleUsd: number; explanation: string;
    };
    infinityTier2: {
      usd: number; qualified: boolean; qualifyingSales: number;
      perSaleUsd: number; explanation: string;
    };
  };
  qualifications: Array<{
    name: string; requirement: string; you: string; met: boolean; unlocks: string;
  }>;
  /** What you'd add by reaching the next gate, at the same downline size. */
  nextMilestone: { name: string; requirement: string; extraUsd: number; explanation: string } | null;
  assumptions: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/**
 * Rates are carried to FOUR places, matching the engine
 * (services/unilevelPlusCommission.ts). A level rate is genuinely sub-cent —
 * 2.7 average legs × level 1 × $0.02 is $0.054 — and showing it as $0.05 both
 * misstates the rate and, if a total is derived from it, misstates the total.
 */
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Leg 1 → 1×, leg 2 → 2×, leg 3+ → 3× (last entry repeats). */
export function legMultiplier(legNumber: number, multipliers: number[]): number {
  if (legNumber <= 0) return 0;
  return legNumber <= multipliers.length
    ? multipliers[legNumber - 1]
    : multipliers[multipliers.length - 1];
}

/**
 * Mean multiplier across `directs` legs.
 *
 * Sales are assumed to arrive evenly across your legs, so the level bonus uses
 * the average rather than a specific leg. With [1,2,3] the first two legs are
 * worth less than every later one, so a 2-leg builder averages 1.5× while a
 * 10-leg builder averages 2.7×.
 */
export function averageLegMultiplier(directs: number, multipliers: number[]): number {
  if (directs <= 0) return 0;
  let sum = 0;
  for (let leg = 1; leg <= directs; leg++) sum += legMultiplier(leg, multipliers);
  return sum / directs;
}

export function calculateUnilevelPlusEarnings(
  plan: IUnilevelPlusPlan,
  input: CalculatorInput
): CalculatorResult {
  const price = input.licencePrice ?? plan.productPrice;
  const directs = Math.max(0, Math.floor(input.directs || 0));
  const maxLevels = plan.maxLevels;

  // ── Resolve the downline shape ────────────────────────────────────────
  let levels: number[];
  let source: CalculatorResult["inputs"]["source"];
  if (input.levels?.length) {
    levels = input.levels.slice(0, maxLevels).map((n) => Math.max(0, Math.floor(n)));
    // Level 1 IS your directs — a mismatch would make the two halves of the
    // answer disagree, so the explicit list wins and `directs` follows it.
    source = "levels";
  } else if (input.duplication && input.depth) {
    const dup = Math.max(0, input.duplication);
    const depth = Math.min(Math.max(1, Math.floor(input.depth)), maxLevels);
    levels = [];
    for (let L = 1; L <= depth; L++) {
      levels.push(Math.round(directs * Math.pow(dup, L - 1)));
    }
    source = "duplication";
  } else {
    levels = [directs];
    source = "directs-only";
  }

  const effectiveDirects = source === "levels" ? levels[0] ?? directs : directs;
  const totalDownline = levels.reduce((a, b) => a + b, 0);

  const pools = {
    company: plan.companyPercentage,
    direct: plan.directBonusPercentage,
    level: plan.levelBonusPercentage,
    infinityTier1: plan.infinityTier1Percentage,
    infinityTier2: plan.infinityTier2Percentage,
    manager: plan.managerBonusPercentage,
  };
  const poolUsd = (pct: number) => r2((price * pct) / 100);

  // ── Scale the FIXED schedules to this sale's base ─────────────────────
  // Mirrors `planScale` in unilevelPlusCommission.ts and must stay in step.
  // The pools are percentages and shrink on their own; `pointValue` and the
  // per-recipient infinity bonuses are absolute dollars calibrated to the
  // $25 licence, where each exactly consumes its pool. Run them against a
  // smaller base — a founder comb plan passing its own commission, or
  // NetworkChain's $12 portion — and the schedule outruns the pool.
  //
  // Capped at 1 so this only ever scales DOWN: at the $25 licence it is × 1
  // and every existing quote is unchanged, and bases above $25 (Office Pro's
  // $48) keep their deliberate surplus rather than reallocating it.
  const planScale =
    plan.productPrice > 0 ? Math.min(price / plan.productPrice, 1) : 0;
  // Sub-cent on small bases — multiply by the points BEFORE rounding, or a
  // scaled rate rounds to zero and the whole level pays nothing.
  const scaledPointValue = plan.pointValue * planScale;

  // ── Direct bonus ──────────────────────────────────────────────────────
  // Only your OWN level-1 people. Nothing deeper pays this.
  const directPerSale = poolUsd(pools.direct);
  const directSales = levels[0] ?? 0;
  const directUsd = r2(directPerSale * directSales);

  // ── Level bonus ───────────────────────────────────────────────────────
  const avgMult = averageLegMultiplier(effectiveDirects, plan.legMultipliers);
  const byLevel: LevelRow[] = levels.map((people, i) => {
    const level = i + 1;
    const points = avgMult * level;
    // Multiply the EXACT rate by the headcount, then round once. Rounding the
    // rate first and multiplying by the headcount scales the rounding error by
    // the headcount: at level 8 with 21,870 people, $0.432 reported as $0.43
    // understated that row by $43.74 — and level 4 OVERstated by $1.08, since
    // the error flips sign with the direction of the rounding.
    const perSaleExact = points * scaledPointValue;
    return {
      level,
      people,
      legMultiplier: r2(avgMult),
      pointsPerSale: r2(points),
      perSaleUsd: r4(perSaleExact),
      totalUsd: r2(perSaleExact * people),
    };
  });
  // Summed from the exact rates, not from the eight already-rounded totals.
  const levelUsd = r2(
    levels.reduce((a, people, i) => a + avgMult * (i + 1) * scaledPointValue * people, 0)
  );

  // ── Infinity tiers ────────────────────────────────────────────────────
  // The gate is a HEADCOUNT of UP-active directs. Once you have 4 (T1) or 10
  // (T2), every sale below you is a candidate — the only limits are the 3
  // nearest qualifying uplines per sale and the pool.
  const tierShare = (minLegs: number) => (effectiveDirects >= minLegs ? 1 : 0);

  const t1Share = tierShare(CALC_T1_MIN_LEGS);
  const t2Share = tierShare(CALC_T2_MIN_LEGS);
  const t1Sales = Math.round(totalDownline * t1Share);
  const t2Sales = Math.round(totalDownline * t2Share);
  // Was `price / 25` — a hardcoded base with no ceiling, which both ignored
  // a re-priced plan and scaled UP above $25 where the engine caps at 1.
  const t1PerSale = r2(CALC_T1_PER_RECIPIENT * planScale);
  const t2PerSale = r2(CALC_T2_PER_RECIPIENT * planScale);
  const t1Usd = r2(t1Sales * t1PerSale);
  const t2Usd = r2(t2Sales * t2PerSale);

  const youEarn = r2(directUsd + levelUsd + t1Usd + t2Usd);
  const grossSales = r2(totalDownline * price);

  // ── What reaching the next gate would add ─────────────────────────────
  let nextMilestone: CalculatorResult["nextMilestone"] = null;
  if (effectiveDirects < CALC_T1_MIN_LEGS) {
    const share = (CALC_T1_MIN_LEGS - (CALC_T1_MIN_LEGS - 1)) / CALC_T1_MIN_LEGS;
    nextMilestone = {
      name: "Infinity Tier 1",
      requirement: `${CALC_T1_MIN_LEGS} UP-active directs`,
      extraUsd: r2(Math.round(totalDownline * share) * t1PerSale),
      explanation: `You have ${effectiveDirects} of ${CALC_T1_MIN_LEGS} legs. At ${CALC_T1_MIN_LEGS}, every sale in your organisation starts paying you $${t1PerSale} on top of everything else — whichever leg it comes through.`,
    };
  } else if (effectiveDirects < CALC_T2_MIN_LEGS) {
    const share = (CALC_T2_MIN_LEGS - (CALC_T2_MIN_LEGS - 1)) / CALC_T2_MIN_LEGS;
    nextMilestone = {
      name: "Infinity Tier 2",
      requirement: `${CALC_T2_MIN_LEGS} UP-active directs`,
      extraUsd: r2(Math.round(totalDownline * share) * t2PerSale),
      explanation: `You have ${effectiveDirects} of ${CALC_T2_MIN_LEGS} legs. Tier 2 pays $${t2PerSale} per qualifying sale — ${Math.round(t2PerSale / Math.max(t1PerSale, 0.01))}× Tier 1, and the single biggest lever in the plan.`,
    };
  }

  return {
    plan: {
      name: plan.name,
      licencePrice: price,
      currency: plan.currency,
      maxLevels,
      pointValue: plan.pointValue,
      legMultipliers: plan.legMultipliers,
      pools: {
        company: { percent: pools.company, usd: poolUsd(pools.company), paidTo: "Platform" },
        directBonus: { percent: pools.direct, usd: poolUsd(pools.direct), paidTo: "The buyer's direct referrer" },
        levelBonus: { percent: pools.level, usd: poolUsd(pools.level), paidTo: `Up to ${maxLevels} levels of upline` },
        infinityTier1: { percent: pools.infinityTier1, usd: poolUsd(pools.infinityTier1), paidTo: `Up to ${CALC_MAX_RECIPIENTS_PER_TIER} uplines with ${CALC_T1_MIN_LEGS}+ legs` },
        infinityTier2: { percent: pools.infinityTier2, usd: poolUsd(pools.infinityTier2), paidTo: `Up to ${CALC_MAX_RECIPIENTS_PER_TIER} uplines with ${CALC_T2_MIN_LEGS}+ legs` },
        manager: { percent: pools.manager, usd: poolUsd(pools.manager), paidTo: "Reserved — currently paid to nobody" },
      },
    },
    inputs: { directs: effectiveDirects, levels, totalDownline, source },
    summary: {
      totalDownline,
      totalSales: totalDownline,
      youEarnUsd: youEarn,
      averagePerSaleUsd: totalDownline ? r2(youEarn / totalDownline) : 0,
      platformKeepsUsd: r2(grossSales - youEarn),
    },
    breakdown: {
      directBonus: {
        usd: directUsd,
        sales: directSales,
        perSaleUsd: directPerSale,
        explanation: `$${directPerSale} on each of your ${directSales} personally referred licence${directSales === 1 ? "" : "s"}. This is ${pools.direct}% of the $${price} licence and it is only ever paid to the person who referred the buyer directly — it never pays on your deeper levels.`,
      },
      levelBonus: {
        usd: levelUsd,
        byLevel,
        explanation: `Every sale up to ${maxLevels} levels below you pays legMultiplier × level × $${plan.pointValue}. Your ${effectiveDirects} leg${effectiveDirects === 1 ? "" : "s"} average a ${r2(avgMult)}× multiplier, so a level-5 sale pays about $${r2(avgMult * 5 * plan.pointValue)}. Deeper levels pay MORE per sale, which is why depth compounds.`,
      },
      infinityTier1: {
        usd: t1Usd,
        qualified: effectiveDirects >= CALC_T1_MIN_LEGS,
        qualifyingSales: t1Sales,
        perSaleUsd: t1PerSale,
        explanation: effectiveDirects >= CALC_T1_MIN_LEGS
          ? `You have ${effectiveDirects} legs, so every one of your ${totalDownline} sales qualifies at $${t1PerSale} each — subject to the 3-nearest-uplines cap on each sale.`
          : `Locked. Needs ${CALC_T1_MIN_LEGS} UP-active directs; you have ${effectiveDirects}.`,
      },
      infinityTier2: {
        usd: t2Usd,
        qualified: effectiveDirects >= CALC_T2_MIN_LEGS,
        qualifyingSales: t2Sales,
        perSaleUsd: t2PerSale,
        explanation: effectiveDirects >= CALC_T2_MIN_LEGS
          ? `You have ${effectiveDirects} legs, so every one of your ${totalDownline} sales qualifies at $${t2PerSale} each — subject to the 3-nearest-uplines cap. This is the largest pool in the plan at ${pools.infinityTier2}%.`
          : `Locked. Needs ${CALC_T2_MIN_LEGS} UP-active directs; you have ${effectiveDirects}.`,
      },
    },
    qualifications: [
      {
        name: "Direct Bonus",
        requirement: "Refer someone who buys a licence",
        you: `${directSales} direct sale${directSales === 1 ? "" : "s"}`,
        met: directSales > 0,
        unlocks: `$${directPerSale} per personally referred licence`,
      },
      {
        name: "Level Bonus",
        requirement: "Have anyone below you buy a licence",
        you: `${totalDownline} people in your projection`,
        met: totalDownline > 0,
        unlocks: `Up to ${maxLevels} levels deep, paying more per level the deeper it goes`,
      },
      {
        name: "Infinity Tier 1",
        requirement: `${CALC_T1_MIN_LEGS}+ UP-active directs`,
        you: `${effectiveDirects} leg${effectiveDirects === 1 ? "" : "s"}`,
        met: effectiveDirects >= CALC_T1_MIN_LEGS,
        unlocks: `$${t1PerSale} per qualifying sale, at any depth`,
      },
      {
        name: "Infinity Tier 2",
        requirement: `${CALC_T2_MIN_LEGS}+ UP-active directs`,
        you: `${effectiveDirects} leg${effectiveDirects === 1 ? "" : "s"}`,
        met: effectiveDirects >= CALC_T2_MIN_LEGS,
        unlocks: `$${t2PerSale} per qualifying sale, at any depth`,
      },
    ],
    nextMilestone,
    assumptions: [
      "Every person in the projection buys exactly one licence.",
      "Only directs holding an ACTIVE licence count as legs — an inactive referral does not open a leg.",
      "Sales are spread evenly across your legs. A lopsided org where most volume sits in leg 1 or 2 earns less, because those legs carry a 1× and 2× multiplier against 3× for every later leg.",
      `Infinity tiers pay a maximum of ${CALC_MAX_RECIPIENTS_PER_TIER} uplines per sale, nearest the buyer first. Once you qualify, every sale below you is a candidate — but if three qualifying uplines sit between you and a sale, that sale pays you nothing on that tier. Deep infinity income is a projection, not a guarantee.`,
      `The level pool is $${poolUsd(pools.level)} per sale across ALL uplines combined. Every per-level amount is scaled to this sale's base${planScale < 1 ? ` (${Math.round(planScale * 100)}% of the $${plan.productPrice} licence)` : ""}, so a full ${maxLevels}-level chain consumes the pool exactly and never truncates, whatever the base.`,
      "Figures are gross commission before any withholding, fees or currency conversion.",
    ],
  };
}
