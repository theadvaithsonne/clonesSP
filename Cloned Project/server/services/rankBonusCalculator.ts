// src/services/rankBonusCalculator.ts
//
// Pure earnings model for the NetworkChain monthly rank bonus. No DB writes.
//
// It mirrors services/rankBonus/qualify.ts rather than restating the rules in
// a second dialect. The three that matter:
//
//   1. Bronze gates EVERYTHING. Inactive yourself, or fewer than the required
//      active directs, and you hold no rank at all no matter how strong your
//      downline is.
//   2. Above Bronze the test is LEGS, not headcount: `requiredLegs` separate
//      legs must each contain at least one holder of the rank directly below.
//      Two Silvers in one leg count once.
//   3. A higher rank satisfies a lower-rank leg requirement — a Gold sitting
//      in a leg also makes it a "Silver leg". That's why the ladder rewards
//      outranking rather than punishing it.
//
// Bronze STACKS with every rank above it (bronzeStacks), so a Silver draws
// $200 + $40. Higher ranks never stack with each other.
//
// The rank bonus is monthly and recurring: it pays again every month the
// qualification still holds, which is the single biggest thing a one-off
// figure fails to convey.

import { IRankPlan, RANK_KEYS, RankKey, payoutFor } from "../models/rankPlan.model";

export interface RankCalculatorInput {
  /** Do YOU hold an active paid subscription? Nothing pays if false. */
  selfActive?: boolean;
  /** Directs holding an active paid subscription. Drives Bronze. */
  activeDirects: number;
  /**
   * Top rank found in each of your legs, one entry per leg — exactly what
   * GET /rank-bonus/me returns. `null`/"" for a leg carrying no rank.
   * Overrides `legsWith` when present.
   */
  legs?: (string | null)[];
  /**
   * Alternative to `legs`: how many DISTINCT legs contain at least one holder
   * of each rank. A higher rank counts for every rank below it, so these are
   * expected to be non-increasing; the calculator enforces that.
   */
  legsWith?: Partial<Record<RankKey, number>>;
  /** Monthly sponsor bonus per active direct. Defaults to the live config. */
  sponsorBonusPerDirect?: number;
}

export interface LadderRow {
  rank: RankKey;
  requirement: string;
  paysMonthlyUsd: number;
  you: string;
  met: boolean;
  /** The first rank you fall short of. */
  isNextTarget: boolean;
}

export interface RankCalculatorResult {
  plan: { version: number; bronzeStacks: boolean; currency: string };
  inputs: {
    selfActive: boolean;
    activeDirects: number;
    legs: number;
    legsWith: Record<string, number>;
  };
  result: {
    rank: RankKey | null;
    rankBonusMonthlyUsd: number;
    sponsorBonusMonthlyUsd: number;
    totalMonthlyUsd: number;
    totalAnnualUsd: number;
    explanation: string;
  };
  breakdown: {
    rankBonus: { usd: number; rank: RankKey | null; stackedBronzeUsd: number; explanation: string };
    sponsorBonus: { usd: number; perDirectUsd: number; activeDirects: number; explanation: string };
  };
  ladder: LadderRow[];
  nextRank: {
    target: RankKey;
    requirement: string;
    have: number;
    need: number;
    shortBy: number;
    wouldPayMonthlyUsd: number;
    upliftMonthlyUsd: number;
    explanation: string;
  } | null;
  assumptions: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Legs carrying at least rank `r`, derived from a per-leg top-rank list. */
function legsWithFromLegs(legs: (string | null)[]): Record<string, number> {
  const out: Record<string, number> = {};
  RANK_KEYS.forEach((key, idx) => {
    out[key] = legs.filter((l) => {
      if (!l) return false;
      const i = RANK_KEYS.indexOf(l as RankKey);
      // A higher rank satisfies every rank below it.
      return i >= idx;
    }).length;
  });
  return out;
}

export function calculateRankBonus(
  plan: IRankPlan,
  input: RankCalculatorInput,
  sponsorBonusDefault = 6
): RankCalculatorResult {
  const selfActive = input.selfActive !== false;
  const activeDirects = Math.max(0, Math.floor(input.activeDirects || 0));
  const perDirect = input.sponsorBonusPerDirect ?? sponsorBonusDefault;

  // ── Resolve legsWith ──────────────────────────────────────────────────
  let legsWith: Record<string, number>;
  let legCount: number;
  if (input.legs?.length) {
    legsWith = legsWithFromLegs(input.legs);
    legCount = input.legs.length;
  } else {
    const raw = input.legsWith || {};
    legsWith = {};
    // Enforce the monotonic invariant the tree guarantees: a leg containing a
    // Gold necessarily contains a Silver. Without this a caller could claim
    // 0 Silver legs and 5 Gold legs and get a nonsense answer.
    let carry = 0;
    for (let i = RANK_KEYS.length - 1; i >= 0; i--) {
      const k = RANK_KEYS[i];
      carry = Math.max(carry, Math.max(0, Math.floor((raw as any)[k] || 0)));
      legsWith[k] = carry;
    }
    legCount = Math.max(legsWith[RANK_KEYS[0]], activeDirects);
  }

  const requiredActiveDirects = plan.tiers[0].requiredActiveDirects || 5;
  const legsNeeded = plan.tiers.map((t) => t.requiredLegs || 0);

  // ── Rank, exactly as qualify.ts computes it ───────────────────────────
  let ordinal = -1;
  if (selfActive && activeDirects >= requiredActiveDirects) {
    ordinal = 0;
    for (let r = 1; r < RANK_KEYS.length; r++) {
      if (legsWith[RANK_KEYS[r - 1]] >= legsNeeded[r]) ordinal = r;
      else break;
    }
  }
  const rank: RankKey | null = ordinal >= 0 ? RANK_KEYS[ordinal] : null;

  const bronzeBase = plan.tiers[0].bonusUsd;
  const rankBonus = rank ? payoutFor(plan, rank) : 0;
  const stackedBronze = rank && rank !== "Bronze" && plan.bronzeStacks ? bronzeBase : 0;
  const sponsorBonus = r2(activeDirects * perDirect);
  const totalMonthly = r2(rankBonus + sponsorBonus);

  // ── Ladder ────────────────────────────────────────────────────────────
  let nextTargetSeen = false;
  const ladder: LadderRow[] = RANK_KEYS.map((key, i) => {
    const tier = plan.tiers[i];
    const isBronze = i === 0;
    const met = ordinal >= i;
    const requirement = isBronze
      ? `${requiredActiveDirects} active directs, and you active yourself`
      : `1 ${RANK_KEYS[i - 1]} in ${legsNeeded[i]} separate legs`;
    const you = isBronze
      ? `${activeDirects} active direct${activeDirects === 1 ? "" : "s"}${selfActive ? "" : " (you are INACTIVE)"}`
      : `${legsWith[RANK_KEYS[i - 1]]} leg${legsWith[RANK_KEYS[i - 1]] === 1 ? "" : "s"} with a ${RANK_KEYS[i - 1]}`;
    const isNextTarget = !met && !nextTargetSeen;
    if (isNextTarget) nextTargetSeen = true;
    return { rank: key, requirement, paysMonthlyUsd: payoutFor(plan, key), you, met, isNextTarget };
  });

  // ── Next rank ─────────────────────────────────────────────────────────
  const nextRow = ladder.find((l) => l.isNextTarget);
  let nextRank: RankCalculatorResult["nextRank"] = null;
  if (nextRow) {
    const i = RANK_KEYS.indexOf(nextRow.rank);
    const isBronze = i === 0;
    const have = isBronze ? activeDirects : legsWith[RANK_KEYS[i - 1]];
    const need = isBronze ? requiredActiveDirects : legsNeeded[i];
    const pays = payoutFor(plan, nextRow.rank);
    nextRank = {
      target: nextRow.rank,
      requirement: nextRow.requirement,
      have,
      need,
      shortBy: Math.max(0, need - have),
      wouldPayMonthlyUsd: pays,
      upliftMonthlyUsd: r2(pays - rankBonus),
      explanation: !selfActive
        ? "Your own subscription is inactive. Nothing pays until it is current, whatever your downline does."
        : isBronze
          ? `You need ${Math.max(0, need - have)} more active direct${need - have === 1 ? "" : "s"} to reach Bronze. Reactivating a lapsed direct counts just as much as recruiting a new one.`
          : `You need a ${RANK_KEYS[i - 1]} in ${Math.max(0, need - have)} more separate leg${need - have === 1 ? "" : "s"}. Depth in a leg you already qualify on adds nothing — width is what promotes you.`,
    };
  }

  const explanation = !selfActive
    ? "You hold no rank because your own subscription is inactive. Every rank requires it, no matter how strong your team is."
    : rank
      ? `You are ${rank}, paying $${rankBonus} a month for as long as you hold it${stackedBronze ? ` (that includes the $${stackedBronze} Bronze bonus, which stacks on every rank)` : ""}. With $${sponsorBonus} of monthly sponsor bonus, you earn $${totalMonthly} a month.`
      : `You hold no rank yet. Bronze needs ${requiredActiveDirects} active directs and you have ${activeDirects}. Your $${sponsorBonus} of monthly sponsor bonus is unaffected — that pays from your first active direct.`;

  return {
    plan: { version: plan.version, bronzeStacks: plan.bronzeStacks, currency: "USD" },
    inputs: { selfActive, activeDirects, legs: legCount, legsWith },
    result: {
      rank,
      rankBonusMonthlyUsd: rankBonus,
      sponsorBonusMonthlyUsd: sponsorBonus,
      totalMonthlyUsd: totalMonthly,
      totalAnnualUsd: r2(totalMonthly * 12),
      explanation,
    },
    breakdown: {
      rankBonus: {
        usd: rankBonus,
        rank,
        stackedBronzeUsd: stackedBronze,
        explanation: rank
          ? `${rank} pays $${rankBonus} every month you qualify.${stackedBronze ? ` Bronze stacks, so that is $${payoutFor(plan, rank) - stackedBronze} for ${rank} plus $${stackedBronze} for Bronze.` : ""} It is re-tested monthly, not awarded permanently.`
          : `No rank, so no rank bonus. Bronze is the gate: ${requiredActiveDirects} active directs and your own subscription current.`,
      },
      sponsorBonus: {
        usd: sponsorBonus,
        perDirectUsd: perDirect,
        activeDirects,
        explanation: `$${perDirect} per month for each of your ${activeDirects} active direct${activeDirects === 1 ? "" : "s"}. This is paid on the subscription itself and goes only to the DIRECT sponsor — nobody above you earns from it, and it does not require a rank.`,
      },
    },
    ladder,
    nextRank,
    assumptions: [
      "The rank bonus is monthly and re-tested every period — it is not awarded permanently. Lose a qualification and the payment stops the month it lapses.",
      "You must hold an active PAID subscription yourself. A free trial month does not count.",
      "Only directs on an active PAID subscription count toward Bronze.",
      "Above Bronze the test is separate LEGS, not headcount. Two qualifiers in one leg count once — width promotes you, depth does not.",
      "A higher rank satisfies a lower-rank leg requirement: a Gold in a leg also makes it a Silver leg.",
      "Bronze stacks with every rank above it; higher ranks never stack with each other.",
      "Figures are gross, before any withholding or currency conversion.",
    ],
  };
}
