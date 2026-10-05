// src/services/foundersOfficeCalculator.ts
//
// Pure earnings model for referring Founders Office ($96/month) subscriptions.
// No DB writes, no side effects — a hypothetical downline of subscribers in,
// what it pays out with the reasoning attached.
//
// It mirrors services/officeSubscription.ts (Pro branch) and
// config/founderSubBonus.ts rather than inventing rules. Every $96 payment —
// the activation AND every monthly renewal — is split three ways:
//
//   $25  → the Unilevel Plus tree, as exactly one licence unit. So the
//          founder's referral chain earns what it would on a $25 licence
//          sale: $9 direct, level bonus by leg multiplier × level × $0.02,
//          $0.40 / $2.00 infinity per qualifying upline.
//   $24  → flat, to the founder's DIRECT referrer.
//   $47  → the platform. The monthly volume bonus below is carved from it.
//
// On top, once a calendar month, the direct referrer earns a volume bonus on
// NEW Pro subscriptions they closed that month (renewals never count):
//   < 50 → $0 · 50–99 → $24 each · 100+ → $48 each, capped at 100 ($4,800).
//
// So a referrer's income has two shapes: RECURRING (the $24 + tree share on
// every active sub, every month) and ONE-OFF (the volume bonus on this
// month's new sales). The result keeps them apart.

import { IUnilevelPlusPlan } from "../models/unilevelPlusPlan.model";
import {
  FOUNDER_SUB_BONUS,
  computeFounderSubBonusUsd,
} from "../config/founderSubBonus";
import {
  averageLegMultiplier,
  CALC_T1_PER_RECIPIENT,
  CALC_T2_PER_RECIPIENT,
  CALC_MAX_RECIPIENTS_PER_TIER,
  CALC_T1_MIN_LEGS,
  CALC_T2_MIN_LEGS,
} from "./unilevelPlusCalculator";

/** Mirrors the constants in officeSubscription.ts' Pro branch. */
export const FOUNDERS_OFFICE_PRICE_USD = 96;
export const FOUNDERS_OFFICE_DIRECT_FLAT_USD = 24;

export interface FoundersOfficeInput {
  /** NEW Pro subscriptions you personally closed this calendar month. */
  newSubsThisMonth?: number;
  /** ALL active Pro subscriptions you personally referred (including this
   *  month's). Each pays you every month it stays active. */
  activeDirectSubs?: number;
  /** Your UP-active direct referrals — your legs. Defaults to
   *  activeDirectSubs, i.e. every founder you referred holds a licence. */
  directs?: number;
  /** Active Pro subs at each level below you, level 1 first. Level 1 should
   *  equal activeDirectSubs. Overrides the duplication model. */
  subsByLevel?: number[];
  /** Symmetric model: subs at level L = activeDirectSubs × duplication^(L−1). */
  duplication?: number;
  depth?: number;
  /** Months to total the recurring income over. Default 1. */
  months?: number;
}

export interface FoundersOfficeLevelRow {
  level: number;
  subs: number;
  legMultiplier: number;
  perSubUsd: number;
  monthlyUsd: number;
}

export interface FoundersOfficeResult {
  plan: {
    name: "Founders Office";
    priceUsd: number;
    currency: "USD";
    split: { name: string; usd: number; paidTo: string }[];
    volumeBonus: {
      lowerThresholdSales: number;
      lowerPerSaleUsd: number;
      upperThresholdSales: number;
      upperPerSaleUsd: number;
      upperCapSales: number;
      maxUsd: number;
      countsRenewals: false;
    };
  };
  inputs: {
    newSubsThisMonth: number;
    activeDirectSubs: number;
    directs: number;
    subsByLevel: number[];
    totalSubs: number;
    months: number;
    source: "subsByLevel" | "duplication" | "directs-only";
  };
  summary: {
    thisMonthUsd: number;
    everyMonthAfterUsd: number;
    totalUsd: number;
    totalSubs: number;
    grossSubscriptionRevenueUsd: number;
    recurringPerDirectSubUsd: number;
  };
  breakdown: {
    directFlat: { usd: number; subs: number; perSubUsd: number; explanation: string };
    directBonus: { usd: number; subs: number; perSubUsd: number; explanation: string };
    levelBonus: { usd: number; byLevel: FoundersOfficeLevelRow[]; explanation: string };
    infinityTier1: { usd: number; qualified: boolean; qualifyingSubs: number; perSubUsd: number; explanation: string };
    infinityTier2: { usd: number; qualified: boolean; qualifyingSubs: number; perSubUsd: number; explanation: string };
    volumeBonus: { usd: number; newSubs: number; tier: "none" | "lower" | "upper"; countedSubs: number; perSaleUsd: number; explanation: string };
  };
  qualifications: { name: string; requirement: string; you: string; met: boolean; unlocks: string }[];
  nextMilestone: { name: string; requirement: string; salesToGo: number; wouldPayUsd: number; explanation: string } | null;
  assumptions: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateFoundersOfficeEarnings(
  plan: IUnilevelPlusPlan,
  input: FoundersOfficeInput
): FoundersOfficeResult {
  const newSubs = Math.max(0, Math.floor(input.newSubsThisMonth ?? 0));
  // A sale closed this month is, by definition, an active sub — so the active
  // count can never be below it.
  const activeDirect = Math.max(newSubs, Math.floor(input.activeDirectSubs ?? 0));
  const directs = Math.max(0, Math.floor(input.directs ?? activeDirect));
  const months = Math.max(1, Math.floor(input.months ?? 1));
  const maxLevels = plan.maxLevels;

  // ── Downline shape ────────────────────────────────────────────────────
  let subsByLevel: number[];
  let source: FoundersOfficeResult["inputs"]["source"];
  if (input.subsByLevel?.length) {
    subsByLevel = input.subsByLevel.slice(0, maxLevels).map((n) => Math.max(0, Math.round(n)));
    source = "subsByLevel";
  } else if (input.duplication !== undefined && input.depth) {
    const dup = Math.max(0, input.duplication);
    const depth = Math.min(Math.max(1, Math.floor(input.depth)), maxLevels);
    subsByLevel = [];
    for (let L = 1; L <= depth; L++) subsByLevel.push(Math.round(activeDirect * Math.pow(dup, L - 1)));
    source = "duplication";
  } else {
    subsByLevel = [activeDirect];
    source = "directs-only";
  }
  // The direct rows are priced off activeDirect, so level 1 has to agree.
  const level1 = source === "subsByLevel" ? subsByLevel[0] ?? 0 : activeDirect;
  const directSubs = Math.max(activeDirect, level1);
  const totalSubs = subsByLevel.reduce((a, b) => a + b, 0);

  // ── The $25 tree unit ─────────────────────────────────────────────────
  const unit = plan.productPrice;
  const share = (pct: number) => r2((unit * pct) / 100);
  const directBonusPerSub = share(plan.directBonusPercentage);
  const directBonusUsd = r2(directBonusPerSub * directSubs);

  const avgMult = averageLegMultiplier(directs, plan.legMultipliers);
  const byLevel: FoundersOfficeLevelRow[] = subsByLevel.map((subs, i) => {
    const level = i + 1;
    const perSub = r2(avgMult * level * plan.pointValue);
    return { level, subs, legMultiplier: r2(avgMult), perSubUsd: perSub, monthlyUsd: r2(perSub * subs) };
  });
  const levelUsd = r2(byLevel.reduce((a, b) => a + b.monthlyUsd, 0));

  // Headcount gate: 4+ / 10+ UP-active directs qualifies every sale below you.
  const tierShare = (minLegs: number) => (directs >= minLegs ? 1 : 0);
  const t1PerSub = r2(CALC_T1_PER_RECIPIENT * (unit / 25));
  const t2PerSub = r2(CALC_T2_PER_RECIPIENT * (unit / 25));
  const t1Subs = Math.round(totalSubs * tierShare(CALC_T1_MIN_LEGS));
  const t2Subs = Math.round(totalSubs * tierShare(CALC_T2_MIN_LEGS));
  const t1Usd = r2(t1Subs * t1PerSub);
  const t2Usd = r2(t2Subs * t2PerSub);

  // ── The $24 flat ──────────────────────────────────────────────────────
  const flatUsd = r2(FOUNDERS_OFFICE_DIRECT_FLAT_USD * directSubs);

  // ── Volume bonus (one-off, new sales only) ────────────────────────────
  const cfg = FOUNDER_SUB_BONUS.tiers;
  const lowerPerSale = cfg.lowerPerSaleUsdCents / 100;
  const upperPerSale = cfg.upperPerSaleUsdCents / 100;
  const volumeUsd = computeFounderSubBonusUsd(newSubs);
  const tier: "none" | "lower" | "upper" =
    newSubs >= cfg.upperThresholdSales ? "upper" : newSubs >= cfg.lowerThresholdSales ? "lower" : "none";
  const countedSubs = tier === "upper" ? Math.min(newSubs, cfg.upperCapSales) : tier === "lower" ? newSubs : 0;
  const volumePerSale = tier === "upper" ? upperPerSale : tier === "lower" ? lowerPerSale : 0;
  const maxVolume = r2(cfg.upperCapSales * upperPerSale);

  const recurring = r2(flatUsd + directBonusUsd + levelUsd + t1Usd + t2Usd);
  const thisMonth = r2(recurring + volumeUsd);
  const total = r2(recurring * months + volumeUsd);

  let nextMilestone: FoundersOfficeResult["nextMilestone"] = null;
  if (newSubs < cfg.lowerThresholdSales) {
    const toGo = cfg.lowerThresholdSales - newSubs;
    nextMilestone = {
      name: "Volume bonus",
      requirement: `${cfg.lowerThresholdSales} new Founders Office sales in a calendar month`,
      salesToGo: toGo,
      wouldPayUsd: r2(cfg.lowerThresholdSales * lowerPerSale),
      explanation: `${toGo} more new sale${toGo === 1 ? "" : "s"} this month and every one of the ${cfg.lowerThresholdSales} pays $${lowerPerSale} — $${r2(cfg.lowerThresholdSales * lowerPerSale)} on top of your recurring income. Renewals don't count; only subscriptions started this month.`,
    };
  } else if (newSubs < cfg.upperThresholdSales) {
    const toGo = cfg.upperThresholdSales - newSubs;
    nextMilestone = {
      name: "Volume bonus — upper tier",
      requirement: `${cfg.upperThresholdSales} new sales in a calendar month`,
      salesToGo: toGo,
      wouldPayUsd: maxVolume,
      explanation: `${toGo} more and the rate doubles to $${upperPerSale} on all ${cfg.upperThresholdSales} — $${maxVolume}, the plan's maximum.`,
    };
  }

  return {
    plan: {
      name: "Founders Office",
      priceUsd: FOUNDERS_OFFICE_PRICE_USD,
      currency: "USD",
      split: [
        { name: "Unilevel Plus unit", usd: unit, paidTo: "The founder's referral chain, exactly as a $25 licence sale: $9 direct, level bonus, infinity" },
        { name: "Direct flat", usd: FOUNDERS_OFFICE_DIRECT_FLAT_USD, paidTo: "The founder's direct referrer" },
        { name: "Platform", usd: r2(FOUNDERS_OFFICE_PRICE_USD - unit - FOUNDERS_OFFICE_DIRECT_FLAT_USD), paidTo: "Platform — the monthly volume bonus is carved from this" },
      ],
      volumeBonus: {
        lowerThresholdSales: cfg.lowerThresholdSales,
        lowerPerSaleUsd: lowerPerSale,
        upperThresholdSales: cfg.upperThresholdSales,
        upperPerSaleUsd: upperPerSale,
        upperCapSales: cfg.upperCapSales,
        maxUsd: maxVolume,
        countsRenewals: false,
      },
    },
    inputs: { newSubsThisMonth: newSubs, activeDirectSubs: directSubs, directs, subsByLevel, totalSubs, months, source },
    summary: {
      thisMonthUsd: thisMonth,
      everyMonthAfterUsd: recurring,
      totalUsd: total,
      totalSubs,
      grossSubscriptionRevenueUsd: r2(totalSubs * FOUNDERS_OFFICE_PRICE_USD),
      recurringPerDirectSubUsd: r2(FOUNDERS_OFFICE_DIRECT_FLAT_USD + directBonusPerSub + (byLevel[0]?.perSubUsd ?? 0)),
    },
    breakdown: {
      directFlat: {
        usd: flatUsd,
        subs: directSubs,
        perSubUsd: FOUNDERS_OFFICE_DIRECT_FLAT_USD,
        explanation: `$${FOUNDERS_OFFICE_DIRECT_FLAT_USD} flat on every one of your ${directSubs} active direct subscription${directSubs === 1 ? "" : "s"}, every month it renews. Paid only to the founder's direct referrer.`,
      },
      directBonus: {
        usd: directBonusUsd,
        subs: directSubs,
        perSubUsd: directBonusPerSub,
        explanation: `Each payment also funds one $${unit} Unilevel Plus unit, and its ${plan.directBonusPercentage}% direct bonus — $${directBonusPerSub} — goes to you as the direct referrer. So a direct sub is worth $${r2(FOUNDERS_OFFICE_DIRECT_FLAT_USD + directBonusPerSub)} a month before level bonus.`,
      },
      levelBonus: {
        usd: levelUsd,
        byLevel,
        explanation: `Every active sub up to ${maxLevels} levels below you pays legMultiplier × level × $${plan.pointValue} a month from the $${unit} unit. Your ${directs} leg${directs === 1 ? "" : "s"} average ${r2(avgMult)}×.`,
      },
      infinityTier1: {
        usd: t1Usd,
        qualified: directs >= CALC_T1_MIN_LEGS,
        qualifyingSubs: t1Subs,
        perSubUsd: t1PerSub,
        explanation: directs >= CALC_T1_MIN_LEGS
          ? `You have ${directs} legs, so all ${totalSubs} subs below you qualify at $${t1PerSub} a month each — subject to the 3-nearest-uplines cap per payment.`
          : `Locked. Needs ${CALC_T1_MIN_LEGS} UP-active directs; you have ${directs}.`,
      },
      infinityTier2: {
        usd: t2Usd,
        qualified: directs >= CALC_T2_MIN_LEGS,
        qualifyingSubs: t2Subs,
        perSubUsd: t2PerSub,
        explanation: directs >= CALC_T2_MIN_LEGS
          ? `You have ${directs} legs, so all ${totalSubs} subs below you qualify at $${t2PerSub} a month each — subject to the 3-nearest-uplines cap per payment.`
          : `Locked. Needs ${CALC_T2_MIN_LEGS} UP-active directs; you have ${directs}.`,
      },
      volumeBonus: {
        usd: volumeUsd,
        newSubs,
        tier,
        countedSubs,
        perSaleUsd: volumePerSale,
        explanation:
          tier === "none"
            ? `$0 — the volume bonus starts at ${cfg.lowerThresholdSales} NEW sales in a calendar month; you have ${newSubs}.`
            : tier === "lower"
              ? `${newSubs} new sales this month × $${lowerPerSale}. Paid once at month-close; next month starts from zero.`
              : `${countedSubs} of your ${newSubs} new sales count (capped at ${cfg.upperCapSales}) × $${upperPerSale}. Paid once at month-close; next month starts from zero.`,
      },
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
        name: "Direct income",
        requirement: "Refer a founder who subscribes",
        you: `${directSubs} active direct sub${directSubs === 1 ? "" : "s"}`,
        met: directSubs > 0,
        unlocks: `$${r2(FOUNDERS_OFFICE_DIRECT_FLAT_USD + directBonusPerSub)} a month per sub`,
      },
      {
        name: "Infinity Tier 1",
        requirement: `${CALC_T1_MIN_LEGS}+ UP-active directs`,
        you: `${directs} leg${directs === 1 ? "" : "s"}`,
        met: directs >= CALC_T1_MIN_LEGS,
        unlocks: `$${t1PerSub} a month per qualifying sub, at any depth`,
      },
      {
        name: "Infinity Tier 2",
        requirement: `${CALC_T2_MIN_LEGS}+ UP-active directs`,
        you: `${directs} leg${directs === 1 ? "" : "s"}`,
        met: directs >= CALC_T2_MIN_LEGS,
        unlocks: `$${t2PerSub} a month per qualifying sub, at any depth`,
      },
      {
        name: "Volume bonus",
        requirement: `${cfg.lowerThresholdSales}+ new sales in a calendar month`,
        you: `${newSubs} new sale${newSubs === 1 ? "" : "s"} this month`,
        met: tier !== "none",
        unlocks: `$${lowerPerSale} per sale, $${upperPerSale} from ${cfg.upperThresholdSales} (max $${maxVolume})`,
      },
    ],
    nextMilestone,
    assumptions: [
      "Every payment — activation and each monthly renewal — is split the same way, so recurring income repeats for as long as the subscription stays active.",
      "The volume bonus counts only subscriptions STARTED in the calendar month, and only ones that reached a paid cycle. Renewals never count, and it is paid once at month-close.",
      "Only directs holding an ACTIVE $25 licence count as legs. Buying a Founders Office does not itself grant one — by default this model assumes every founder you referred also holds a licence.",
      "Subs are spread evenly across your legs. Volume concentrated in leg 1 or 2 earns less on the level bonus, because those legs carry a 1× and 2× multiplier against 3× for every later leg.",
      `Infinity tiers pay at most ${CALC_MAX_RECIPIENTS_PER_TIER} uplines per payment, nearest the founder first.`,
      "Only an upline who holds an active $25 Unilevel Plus licence is paid; an unlicensed upline's share goes to the platform instead.",
      "An upline without an active NetworkChain subscription keeps half of each commission — the other half is forwarded to the nearest subscribed upline.",
      "The $96 is the base price; GST is charged on top and never enters the split.",
      "Figures are gross commission before any withholding, fees or currency conversion.",
    ],
  };
}
