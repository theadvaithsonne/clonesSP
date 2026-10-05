// src/services/founderProductCalculator.ts
//
// Pure earnings model for FOUNDER-SET commission on store items (courses,
// products, channels, workshops, services, calls, events). No DB writes, no
// side effects — a plan shape plus a hypothetical sales shape in, what that
// would pay out with the reasoning attached.
//
// It mirrors services/commission.ts rather than inventing a second set of
// rules. A founder chooses ONE of two engines per item (CombPlanKind):
//
//   "levels"        — fixed L1/L2/L3… percentages of the sale principal, paid
//                     to the buyer's referral chain. L1 is the buyer's direct
//                     referrer. Every active plan in production is this kind.
//   "unilevel_plus" — a single percentage of the principal is handed to the
//                     Unilevel Plus tree and split by ITS rules (36% direct,
//                     28.8% levels, 4.8%/24% infinity, 4% company, 2.4%
//                     manager). Distributed with `sweepUnspent: "return"`, so
//                     the company share, the manager pool and anything the
//                     tree does not pay go BACK TO THE FOUNDER — the network
//                     can earn at most 93.6% of the pool, never the pool.
//
//                     The level bonus is the part that behaves differently
//                     from a licence sale. The engine pays a FIXED
//                     `pointValue` per point (legMultiplier × level), nearest
//                     upline first, and stops when the level pool (28.8% of
//                     the founder's amount) is spent. On a $25 licence the
//                     pool covers all 15 levels; on a $4 pool it runs out
//                     after ~6, and everyone deeper gets nothing. Infinity is
//                     the opposite: a per-recipient amount SCALED by pool/$25.
//
// Unlike the licence calculator this is RECURRING: an org keeps buying month
// after month, so inputs are sales per month and the answer is per month,
// with an optional total across `months`.

import { IUnilevelPlusPlan } from "../models/unilevelPlusPlan.model";
import {
  averageLegMultiplier,
  CALC_T1_PER_RECIPIENT,
  CALC_T2_PER_RECIPIENT,
  CALC_MAX_RECIPIENTS_PER_TIER,
  CALC_T1_MIN_LEGS,
  CALC_T2_MIN_LEGS,
} from "./unilevelPlusCalculator";

/** Same ceiling commission.ts enforces on a plan's level percentages. */
export const COMB_PLAN_MAX_PERCENTAGE = 90;
/** The Unilevel Plus engine's own depth; sales below this pay nothing. */
export const UP_MAX_LEVELS = 15;

export type FounderPlanKind = "levels" | "unilevel_plus";

export interface FounderCalculatorInput {
  /** Defaults to "unilevel_plus". */
  kind?: FounderPlanKind;
  /** Sale price of the item, in USD. */
  productPrice: number;
  /** "levels" kind: the founder's L1, L2, L3… percentages, L1 first. */
  levelPercents?: number[];
  /** "unilevel_plus" kind: the single percentage handed to the tree. */
  commissionPercent?: number;
  /** Your UP-active direct referrals — your legs. Drives leg multipliers and
   *  infinity gates on the "unilevel_plus" kind. Also level-1 headcount for
   *  the duplication model. */
  directs?: number;
  /** Purchases per month by people at each level below you, level 1 first.
   *  Overrides the duplication model. */
  salesByLevel?: number[];
  /** Symmetric model: how many people each person refers. */
  duplication?: number;
  /** Symmetric model: how many levels deep to project. */
  depth?: number;
  /** Symmetric model: purchases each person makes per month. Default 1. */
  salesPerPerson?: number;
  /** Multiply the monthly answer. Default 1. */
  months?: number;
}

export interface FounderLevelRow {
  level: number;
  /** Founder's percentage at this level (levels kind) or the effective per-sale
   *  share the tree pays here (unilevel_plus kind). */
  percent: number;
  sales: number;
  perSaleUsd: number;
  monthlyUsd: number;
}

export interface FounderCalculatorResult {
  kind: FounderPlanKind;
  plan: {
    productPrice: number;
    currency: "USD";
    /** What the founder gives up per sale, before the engine splits it. */
    commissionPercent: number;
    commissionPerSaleUsd: number;
    /** "levels": the founder's table. "unilevel_plus": the tree's split of the pool. */
    schedule: { level?: number; name: string; percent: number; perSaleUsd: number; paidTo: string }[];
    /** Most the network as a whole can earn on one sale. */
    networkMaxPerSaleUsd: number;
    /** unilevel_plus: how many levels the level pool reaches before it is spent. */
    levelPoolReachesLevels?: number;
    /** Pool money that comes back to the founder on every sale (unilevel_plus only). */
    returnedToFounderPerSaleUsd: number;
  };
  inputs: {
    directs: number;
    salesByLevel: number[];
    salesPerMonth: number;
    months: number;
    source: "salesByLevel" | "duplication" | "directs-only";
  };
  summary: {
    salesPerMonth: number;
    grossSalesPerMonthUsd: number;
    youEarnPerMonthUsd: number;
    youEarnTotalUsd: number;
    averagePerSaleUsd: number;
  };
  breakdown: {
    byLevel: FounderLevelRow[];
    /** Present only for the unilevel_plus kind. */
    pools?: {
      directBonus: { usd: number; sales: number; perSaleUsd: number; explanation: string };
      levelBonus: { usd: number; explanation: string };
      infinityTier1: { usd: number; qualified: boolean; qualifyingSales: number; perSaleUsd: number; explanation: string };
      infinityTier2: { usd: number; qualified: boolean; qualifyingSales: number; perSaleUsd: number; explanation: string };
      returnedToFounder: { usd: number; explanation: string };
    };
    explanation: string;
  };
  qualifications: { name: string; requirement: string; you: string; met: boolean; unlocks: string }[];
  nextMilestone: { name: string; requirement: string; extraMonthlyUsd: number; explanation: string } | null;
  assumptions: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Four places, matching the engine — a level rate here is genuinely sub-cent. */
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Shared by both kinds: turn the input into purchases-per-month per level. */
function resolveSales(
  input: FounderCalculatorInput,
  maxLevels: number
): { levels: number[]; directs: number; source: FounderCalculatorResult["inputs"]["source"] } {
  const directs = Math.max(0, Math.floor(input.directs || 0));
  const perPerson = Math.max(0, input.salesPerPerson ?? 1);

  if (input.salesByLevel?.length) {
    return {
      levels: input.salesByLevel.slice(0, maxLevels).map((n) => Math.max(0, Math.round(n))),
      directs,
      source: "salesByLevel",
    };
  }
  if (input.duplication !== undefined && input.depth) {
    const dup = Math.max(0, input.duplication);
    const depth = Math.min(Math.max(1, Math.floor(input.depth)), maxLevels);
    const levels: number[] = [];
    for (let L = 1; L <= depth; L++) {
      levels.push(Math.round(directs * Math.pow(dup, L - 1) * perPerson));
    }
    return { levels, directs, source: "duplication" };
  }
  return { levels: [Math.round(directs * perPerson)], directs, source: "directs-only" };
}

const COMMON_ASSUMPTIONS = [
  "Commission is calculated on the full sale price the customer paid, not on what the seller keeps.",
  "A sale at level N means the BUYER sits N levels below you — your own referred customers are level 1.",
  "Only an upline who holds an active $25 Unilevel Plus licence is paid; an unlicensed upline's share goes to the platform instead.",
  "An upline without an active NetworkChain subscription keeps half of each commission — the other half is forwarded to the nearest subscribed upline.",
  "Founders may cap how many times one customer pays a given affiliate (per-pair cap). This model assumes no cap.",
  "Figures are gross commission before any withholding, fees or currency conversion.",
];

// ─────────────────────────────────────────────────────────────────────────
// "levels" kind
// ─────────────────────────────────────────────────────────────────────────

function calculateLevels(input: FounderCalculatorInput): FounderCalculatorResult {
  const price = r2(input.productPrice);
  const pcts = (input.levelPercents || []).map((p) => Math.max(0, p));
  const totalPct = r2(pcts.reduce((a, b) => a + b, 0));
  if (totalPct > COMB_PLAN_MAX_PERCENTAGE) {
    throw new RangeError(
      `Level percentages sum to ${totalPct}%; a founder cannot set more than ${COMB_PLAN_MAX_PERCENTAGE}%.`
    );
  }
  const months = Math.max(1, Math.floor(input.months ?? 1));
  // Keep sales deeper than the founder's table so they can be reported as
  // unpaid, rather than trimmed away before anyone sees them.
  const { levels: sales, directs, source } = resolveSales(input, UP_MAX_LEVELS);

  const byLevel: FounderLevelRow[] = pcts.map((pct, i) => {
    // Exact rate for the arithmetic, rounded only for display — rounding
    // first multiplies the error by the sales count on that level.
    const perSaleExact = (price * pct) / 100;
    const n = sales[i] ?? 0;
    return {
      level: i + 1,
      percent: pct,
      sales: n,
      perSaleUsd: r4(perSaleExact),
      monthlyUsd: r2(perSaleExact * n),
    };
  });
  // Sales deeper than the founder's table pay nothing — say so rather than
  // silently dropping them.
  const beyond = sales.slice(pcts.length).reduce((a, b) => a + b, 0);

  const monthly = r2(byLevel.reduce((a, b) => a + b.monthlyUsd, 0));
  const salesPerMonth = sales.reduce((a, b) => a + b, 0);
  const commissionPerSale = r2((price * totalPct) / 100);

  return {
    kind: "levels",
    plan: {
      productPrice: price,
      currency: "USD",
      commissionPercent: totalPct,
      commissionPerSaleUsd: commissionPerSale,
      schedule: pcts.map((pct, i) => ({
        level: i + 1,
        name: `Level ${i + 1}`,
        percent: pct,
        perSaleUsd: r2((price * pct) / 100),
        paidTo: i === 0 ? "The buyer's direct referrer" : `The buyer's level-${i + 1} upline`,
      })),
      networkMaxPerSaleUsd: commissionPerSale,
      returnedToFounderPerSaleUsd: 0,
    },
    inputs: { directs, salesByLevel: sales, salesPerMonth, months, source },
    summary: {
      salesPerMonth,
      grossSalesPerMonthUsd: r2(salesPerMonth * price),
      youEarnPerMonthUsd: monthly,
      youEarnTotalUsd: r2(monthly * months),
      averagePerSaleUsd: salesPerMonth ? r2(monthly / salesPerMonth) : 0,
    },
    breakdown: {
      byLevel,
      explanation:
        `The founder pays a fixed share of every sale to each of the buyer's first ${pcts.length} upline${pcts.length === 1 ? "" : "s"}: ` +
        pcts.map((p, i) => `${p}% at level ${i + 1}`).join(", ") +
        `. You earn the level-N rate on every purchase made N levels below you.` +
        (beyond > 0
          ? ` ${beyond} of your monthly sales sit deeper than level ${pcts.length} and pay you nothing on this item.`
          : ""),
    },
    qualifications: [
      {
        name: "Unilevel Plus licence",
        requirement: "Hold an active $25 licence",
        you: "Assumed active",
        met: true,
        unlocks: "Any commission at all — without it your share is routed to the platform",
      },
      {
        name: "Referral position",
        requirement: `Be within the buyer's first ${pcts.length} upline${pcts.length === 1 ? "" : "s"}`,
        you: `${salesPerMonth - beyond} of ${salesPerMonth} monthly sales in range`,
        met: salesPerMonth - beyond > 0,
        unlocks: "The founder's rate for that level, on every sale",
      },
    ],
    nextMilestone: null,
    assumptions: [
      "Every level in the founder's table is paid if someone occupies it — there are no rank or leg gates on this kind of plan.",
      "On an OFFLINE store, an upline only earns a level if they have themselves bought from that store; non-buyers are skipped and the level passes to the next buyer above. This model assumes an online store.",
      ...COMMON_ASSUMPTIONS,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// "unilevel_plus" kind
// ─────────────────────────────────────────────────────────────────────────

function calculateUnilevelPlusKind(
  input: FounderCalculatorInput,
  plan: IUnilevelPlusPlan
): FounderCalculatorResult {
  const price = r2(input.productPrice);
  const pct = Math.max(0, input.commissionPercent || 0);
  if (pct > COMB_PLAN_MAX_PERCENTAGE) {
    throw new RangeError(
      `Commission is ${pct}%; a founder cannot set more than ${COMB_PLAN_MAX_PERCENTAGE}%.`
    );
  }
  const months = Math.max(1, Math.floor(input.months ?? 1));
  const maxLevels = Math.min(plan.maxLevels, UP_MAX_LEVELS);
  const { levels: sales, directs, source } = resolveSales(input, maxLevels);
  const salesPerMonth = sales.reduce((a, b) => a + b, 0);

  // The pool per sale is what the founder set. The tree then splits it by the
  // SAME percentages it uses on the $25 licence — the engine is literally
  // called with saleAmount = pool.
  const pool = r2((price * pct) / 100);
  const share = (p: number) => r2((pool * p) / 100);
  const pools = {
    company: plan.companyPercentage,
    direct: plan.directBonusPercentage,
    level: plan.levelBonusPercentage,
    t1: plan.infinityTier1Percentage,
    t2: plan.infinityTier2Percentage,
    manager: plan.managerBonusPercentage,
  };
  const returnedPct = pools.company + pools.manager;

  // Direct: only sales by your own level-1 people.
  const directPerSale = share(pools.direct);
  const directSales = sales[0] ?? 0;
  const directUsd = r2(directPerSale * directSales);

  // Levels — mirrors the engine's walk exactly (unilevelPlusCommission.ts
  // ~L600): a FIXED pointValue per point, paid level 1 upward, each level
  // capped at whatever is left of the level pool. For "you at level k" that
  // means the k−1 uplines closer to the buyer are paid first; you get what
  // remains, and once the pool is gone the deeper levels get $0.
  //
  // `pointValue` is an ABSOLUTE amount calibrated to the $25 licence, where
  // $0.02 × 3 × (1+2+…+15) = $7.20 = the 28.8% level pool exactly. A founder
  // product puts its own commission through the same schedule — $40 × 10% =
  // $4.00 here — so without scaling, a $7.20 price list is funded with
  // $1.15 and the walk simply stops partway down. That is why levels 8-15
  // read $0.00 on this screen.
  //
  // Scaled by the same planScale the engine uses (capped at 1, so a $25
  // base is unchanged), the whole 15-level chain fits inside the pool again.
  const planScale = Math.min(pool / plan.productPrice, 1);
  // Multiply before rounding — at these bases the scaled rate is sub-cent
  // and rounding it first would floor every level to zero.
  const pointValue = plan.pointValue * planScale;
  const levelPool = share(pools.level);
  const avgMult = averageLegMultiplier(directs, plan.legMultipliers);
  let spent = 0;
  let levelsPaid = 0;
  const byLevel: FounderLevelRow[] = sales.map((n, i) => {
    const level = i + 1;
    // Four places, like the engine: at these bases `avgMult × level ×
    // pointValue` is sub-cent, and cent-rounding floored whole levels to $0.
    const nominal = r4(avgMult * level * pointValue);
    const perSale = Math.max(0, Math.min(nominal, r4(levelPool - spent)));
    spent = r4(spent + perSale);
    if (perSale > 0) levelsPaid = level;
    return {
      level,
      percent: pool ? r2((perSale / pool) * 100) : 0,
      sales: n,
      perSaleUsd: perSale,
      monthlyUsd: r2(perSale * n),
    };
  });
  const levelUsd = r2(byLevel.reduce((a, b) => a + b.monthlyUsd, 0));
  // How deep the pool reaches on THIS product, independent of the org shape
  // the caller happened to send — so the answer can say "pays 6 levels".
  let reach = 0;
  for (let acc = 0, L = 1; L <= maxLevels; L++) {
    const a = r2(avgMult * L * pointValue);
    if (a <= 0 || acc >= levelPool) break;
    acc = r2(acc + Math.min(a, levelPool - acc));
    reach = L;
  }

  // Infinity: a per-recipient amount scaled by pool/$25 (capped at 1×, as the
  // engine's planScale is), gated on a HEADCOUNT of UP-active directs.
  const tierShare = (minLegs: number) => (directs >= minLegs ? 1 : 0);
  const t1PerSale = r2(CALC_T1_PER_RECIPIENT * planScale);
  const t2PerSale = r2(CALC_T2_PER_RECIPIENT * planScale);
  const t1Sales = Math.round(salesPerMonth * tierShare(CALC_T1_MIN_LEGS));
  const t2Sales = Math.round(salesPerMonth * tierShare(CALC_T2_MIN_LEGS));
  const t1Usd = r2(t1Sales * t1PerSale);
  const t2Usd = r2(t2Sales * t2PerSale);

  const monthly = r2(directUsd + levelUsd + t1Usd + t2Usd);
  const returnedPerSale = share(returnedPct);

  let nextMilestone: FounderCalculatorResult["nextMilestone"] = null;
  if (directs < CALC_T1_MIN_LEGS) {
    const extra = r2(salesPerMonth * t1PerSale);
    nextMilestone = {
      name: "Infinity Tier 1",
      requirement: `${CALC_T1_MIN_LEGS} UP-active directs`,
      extraMonthlyUsd: extra,
      explanation: `You have ${directs} of ${CALC_T1_MIN_LEGS} legs. At ${CALC_T1_MIN_LEGS}, every sale in your organisation starts paying $${t1PerSale} on top of everything else — whichever leg it comes through.`,
    };
  } else if (directs < CALC_T2_MIN_LEGS) {
    const extra = r2(salesPerMonth * t2PerSale);
    nextMilestone = {
      name: "Infinity Tier 2",
      requirement: `${CALC_T2_MIN_LEGS} UP-active directs`,
      extraMonthlyUsd: extra,
      explanation: `You have ${directs} of ${CALC_T2_MIN_LEGS} legs. Tier 2 pays $${t2PerSale} per qualifying sale — the largest pool in the plan.`,
    };
  }

  return {
    kind: "unilevel_plus",
    plan: {
      productPrice: price,
      currency: "USD",
      commissionPercent: pct,
      commissionPerSaleUsd: pool,
      schedule: [
        { name: "Direct bonus", percent: pools.direct, perSaleUsd: share(pools.direct), paidTo: "The buyer's direct referrer" },
        { name: "Level bonus", percent: pools.level, perSaleUsd: share(pools.level), paidTo: `Up to ${maxLevels} levels of upline, by leg multiplier × level` },
        { name: "Infinity Tier 1", percent: pools.t1, perSaleUsd: share(pools.t1), paidTo: `Up to ${CALC_MAX_RECIPIENTS_PER_TIER} uplines with ${CALC_T1_MIN_LEGS}+ legs` },
        { name: "Infinity Tier 2", percent: pools.t2, perSaleUsd: share(pools.t2), paidTo: `Up to ${CALC_MAX_RECIPIENTS_PER_TIER} uplines with ${CALC_T2_MIN_LEGS}+ legs` },
        { name: "Company share", percent: pools.company, perSaleUsd: share(pools.company), paidTo: "Returned to the founder — not paid to the network" },
        { name: "Manager pool", percent: pools.manager, perSaleUsd: share(pools.manager), paidTo: "Returned to the founder — paid to nobody" },
      ],
      networkMaxPerSaleUsd: r2(pool - returnedPerSale),
      returnedToFounderPerSaleUsd: returnedPerSale,
      levelPoolReachesLevels: reach,
    },
    inputs: { directs, salesByLevel: sales, salesPerMonth, months, source },
    summary: {
      salesPerMonth,
      grossSalesPerMonthUsd: r2(salesPerMonth * price),
      youEarnPerMonthUsd: monthly,
      youEarnTotalUsd: r2(monthly * months),
      averagePerSaleUsd: salesPerMonth ? r2(monthly / salesPerMonth) : 0,
    },
    breakdown: {
      byLevel,
      pools: {
        directBonus: {
          usd: directUsd,
          sales: directSales,
          perSaleUsd: directPerSale,
          explanation: `$${directPerSale} on each of the ${directSales} monthly purchases by your own referrals — ${pools.direct}% of the $${pool} pool. Nothing deeper pays this.`,
        },
        levelBonus: {
          usd: levelUsd,
          explanation:
            `The level pool is $${levelPool} a sale (${pools.level}% of $${pool}), paid $${pointValue} per point (legMultiplier × level) to the nearest upline first until it runs out. ` +
            `With your ${directs} leg${directs === 1 ? "" : "s"} averaging ${r2(avgMult)}× it reaches about ${reach} level${reach === 1 ? "" : "s"} on this product — ` +
            (levelsPaid < sales.length
              ? `sales ${levelsPaid + 1} or more levels below you pay you nothing on this line.`
              : `every level in your projection is inside that.`),
        },
        infinityTier1: {
          usd: t1Usd,
          qualified: directs >= CALC_T1_MIN_LEGS,
          qualifyingSales: t1Sales,
          perSaleUsd: t1PerSale,
          explanation: directs >= CALC_T1_MIN_LEGS
            ? `You have ${directs} legs, so all ${salesPerMonth} monthly sales qualify at $${t1PerSale} each — subject to the 3-nearest-uplines cap on each sale.`
            : `Locked. Needs ${CALC_T1_MIN_LEGS} UP-active directs; you have ${directs}.`,
        },
        infinityTier2: {
          usd: t2Usd,
          qualified: directs >= CALC_T2_MIN_LEGS,
          qualifyingSales: t2Sales,
          perSaleUsd: t2PerSale,
          explanation: directs >= CALC_T2_MIN_LEGS
            ? `You have ${directs} legs, so all ${salesPerMonth} monthly sales qualify at $${t2PerSale} each — subject to the 3-nearest-uplines cap on each sale.`
            : `Locked. Needs ${CALC_T2_MIN_LEGS} UP-active directs; you have ${directs}.`,
        },
        returnedToFounder: {
          usd: r2(returnedPerSale * salesPerMonth),
          explanation: `${returnedPct}% of the pool ($${returnedPerSale} a sale) is the company share and the manager pool. On founder-funded plans both go back to the founder, so the network can never earn more than $${r2(pool - returnedPerSale)} of the $${pool}.`,
        },
      },
      explanation: `The founder hands ${pct}% of every sale ($${pool}) to the Unilevel Plus tree, which splits it exactly as it splits a $25 licence.`,
    },
    qualifications: [
      {
        name: "Unilevel Plus licence",
        requirement: "Hold an active $25 licence",
        you: "Assumed active",
        met: true,
        unlocks: "Any commission at all — without it your share is routed to the platform",
      },
      {
        name: "Direct bonus",
        requirement: "Your own referrals buy",
        you: `${directSales} purchase${directSales === 1 ? "" : "s"} a month at level 1`,
        met: directSales > 0,
        unlocks: `$${directPerSale} per purchase`,
      },
      {
        name: "Infinity Tier 1",
        requirement: `${CALC_T1_MIN_LEGS}+ UP-active directs`,
        you: `${directs} leg${directs === 1 ? "" : "s"}`,
        met: directs >= CALC_T1_MIN_LEGS,
        unlocks: `$${t1PerSale} per qualifying sale, at any depth`,
      },
      {
        name: "Infinity Tier 2",
        requirement: `${CALC_T2_MIN_LEGS}+ UP-active directs`,
        you: `${directs} leg${directs === 1 ? "" : "s"}`,
        met: directs >= CALC_T2_MIN_LEGS,
        unlocks: `$${t2PerSale} per qualifying sale, at any depth`,
      },
    ],
    nextMilestone,
    assumptions: [
      "Only directs holding an ACTIVE $25 licence count as legs — an inactive referral does not open a leg.",
      `The level pool is capped at $${levelPool} per sale across ALL uplines combined and is paid nearest-the-buyer first at a fixed $${pointValue} a point. On this product it is spent after about ${reach} level${reach === 1 ? "" : "s"}; deeper uplines earn no level bonus on it, and the unspent remainder returns to the founder.`,
      "Sales are spread evenly across your legs. Volume concentrated in leg 1 or 2 earns less, because those legs carry a 1× and 2× multiplier against 3× for every later leg.",
      `Infinity tiers pay at most ${CALC_MAX_RECIPIENTS_PER_TIER} uplines per sale, nearest the buyer first. Three qualifying uplines between you and a sale means that sale pays you nothing on that tier.`,
      "The company share and manager pool are returned to the founder on this kind of plan, so they never reach the network.",
      ...COMMON_ASSUMPTIONS,
    ],
  };
}

/**
 * Entry point. `plan` is only needed for the "unilevel_plus" kind; the
 * "levels" kind is fully described by the founder's own percentages.
 */
export function calculateFounderProductEarnings(
  input: FounderCalculatorInput,
  plan?: IUnilevelPlusPlan | null
): FounderCalculatorResult {
  if (!(input.productPrice > 0)) {
    throw new RangeError("productPrice must be greater than 0.");
  }
  // Default is the tree: that is the comp plan a founder assigns when creating
  // an item, with one percentage. "levels" is the legacy fixed-table kind.
  const kind: FounderPlanKind = input.kind ?? "unilevel_plus";
  if (kind === "unilevel_plus") {
    if (!plan) throw new Error("The Unilevel Plus plan is required for the unilevel_plus kind.");
    return calculateUnilevelPlusKind(input, plan);
  }
  return calculateLevels(input);
}
