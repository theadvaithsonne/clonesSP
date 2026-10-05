// src/services/whiteLabelCalculator.ts
//
// Pure earnings model for referring White Label licences ($600/year). No DB
// writes, no side effects.
//
// Mirrors config/whitelabelAddon.ts and services/whitelabelAddonPurchase.ts
// (chargeReferralCommission), which runs on the activation invoice AND on
// every yearly renewal invoice. Each $600 payment pays $300 of commission:
//
//   $150  flat, to the buyer's DIRECT referrer.
//   $150  run through the Unilevel Plus tree as SIX separate $25 licence
//         units — so the chain earns six times what one licence pays:
//         6 × $9 direct, 6 × the level bonus, 6 × $0.40 / $2.00 infinity.
//   $6    platform residual.
//
// On top, once a calendar month, the direct referrer earns a volume bonus:
// ≥ 10 NEW licences that month → $150 on EVERY one of them, uncapped.
// Renewals never count.
//
// So income has two shapes: YEARLY recurring (every active licence, every
// renewal) and a ONE-OFF monthly volume bonus. The result keeps them apart.

import { IUnilevelPlusPlan } from "../models/unilevelPlusPlan.model";
import { WHITELABEL_ADDON } from "../config/whitelabelAddon";
import {
  averageLegMultiplier,
  CALC_T1_PER_RECIPIENT,
  CALC_T2_PER_RECIPIENT,
  CALC_MAX_RECIPIENTS_PER_TIER,
  CALC_T1_MIN_LEGS,
  CALC_T2_MIN_LEGS,
} from "./unilevelPlusCalculator";

/** Mirrors the loop in chargeReferralCommission. */
export const WHITE_LABEL_UP_UNITS = 6;

export interface WhiteLabelInput {
  /** NEW licences you personally sold this calendar month. */
  newSalesThisMonth?: number;
  /** ALL active licences you personally referred (including this month's). */
  activeDirectLicences?: number;
  /** Your UP-active legs. Defaults to activeDirectLicences. */
  directs?: number;
  /** Active licences per level below you, level 1 first. Overrides duplication. */
  licencesByLevel?: number[];
  duplication?: number;
  depth?: number;
  /** Years to total the recurring income over. Default 1. */
  years?: number;
}

export interface WhiteLabelLevelRow {
  level: number;
  licences: number;
  legMultiplier: number;
  perLicenceUsd: number;
  yearlyUsd: number;
}

export interface WhiteLabelResult {
  plan: {
    name: "White Label";
    priceUsd: number;
    currency: "USD";
    billing: "yearly";
    commissionUsd: number;
    split: { name: string; usd: number; paidTo: string }[];
    unitsPerSale: number;
    volumeBonus: { thresholdSales: number; perSaleUsd: number; capped: false; countsRenewals: false };
  };
  inputs: {
    newSalesThisMonth: number;
    activeDirectLicences: number;
    directs: number;
    licencesByLevel: number[];
    totalLicences: number;
    years: number;
    source: "licencesByLevel" | "duplication" | "directs-only";
  };
  summary: {
    perYearUsd: number;
    thisMonthIncentiveUsd: number;
    totalUsd: number;
    totalLicences: number;
    grossLicenceRevenueUsd: number;
    recurringPerDirectLicenceUsd: number;
  };
  breakdown: {
    directFlat: { usd: number; licences: number; perLicenceUsd: number; explanation: string };
    directBonus: { usd: number; licences: number; perLicenceUsd: number; explanation: string };
    levelBonus: { usd: number; byLevel: WhiteLabelLevelRow[]; explanation: string };
    infinityTier1: { usd: number; qualified: boolean; qualifyingLicences: number; perLicenceUsd: number; explanation: string };
    infinityTier2: { usd: number; qualified: boolean; qualifyingLicences: number; perLicenceUsd: number; explanation: string };
    volumeBonus: { usd: number; newSales: number; qualified: boolean; perSaleUsd: number; explanation: string };
  };
  qualifications: { name: string; requirement: string; you: string; met: boolean; unlocks: string }[];
  nextMilestone: { name: string; requirement: string; salesToGo: number; wouldPayUsd: number; explanation: string } | null;
  assumptions: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateWhiteLabelEarnings(
  plan: IUnilevelPlusPlan,
  input: WhiteLabelInput
): WhiteLabelResult {
  const cfg = WHITELABEL_ADDON;
  const price = cfg.priceUsdCents / 100;
  const flat = cfg.commission.directFlatUsdCents / 100;
  const cascade = cfg.commission.cascadePoolUsdCents / 100;
  const residual = cfg.commission.platformResidualUsdCents / 100;
  const units = WHITE_LABEL_UP_UNITS;
  const unitUsd = r2(cascade / units);
  const threshold = cfg.monthlyVolumeBonus.thresholdSales;
  const bonusPerSale = cfg.monthlyVolumeBonus.bonusPerSaleUsdCents / 100;

  const newSales = Math.max(0, Math.floor(input.newSalesThisMonth ?? 0));
  const activeDirect = Math.max(newSales, Math.floor(input.activeDirectLicences ?? 0));
  const directs = Math.max(0, Math.floor(input.directs ?? activeDirect));
  const years = Math.max(1, Math.floor(input.years ?? 1));
  const maxLevels = plan.maxLevels;

  let byLevelIn: number[];
  let source: WhiteLabelResult["inputs"]["source"];
  if (input.licencesByLevel?.length) {
    byLevelIn = input.licencesByLevel.slice(0, maxLevels).map((n) => Math.max(0, Math.round(n)));
    source = "licencesByLevel";
  } else if (input.duplication !== undefined && input.depth) {
    const dup = Math.max(0, input.duplication);
    const depth = Math.min(Math.max(1, Math.floor(input.depth)), maxLevels);
    byLevelIn = [];
    for (let L = 1; L <= depth; L++) byLevelIn.push(Math.round(activeDirect * Math.pow(dup, L - 1)));
    source = "duplication";
  } else {
    byLevelIn = [activeDirect];
    source = "directs-only";
  }
  const level1 = source === "licencesByLevel" ? byLevelIn[0] ?? 0 : activeDirect;
  const directLicences = Math.max(activeDirect, level1);
  const totalLicences = byLevelIn.reduce((a, b) => a + b, 0);

  // ── Six $25 units per licence ─────────────────────────────────────────
  const directBonusPerUnit = r2((unitUsd * plan.directBonusPercentage) / 100);
  const directBonusPerLicence = r2(directBonusPerUnit * units);
  const directBonusUsd = r2(directBonusPerLicence * directLicences);

  const avgMult = averageLegMultiplier(directs, plan.legMultipliers);
  const byLevel: WhiteLabelLevelRow[] = byLevelIn.map((licences, i) => {
    const level = i + 1;
    const perLicence = r2(avgMult * level * plan.pointValue * units);
    return { level, licences, legMultiplier: r2(avgMult), perLicenceUsd: perLicence, yearlyUsd: r2(perLicence * licences) };
  });
  const levelUsd = r2(byLevel.reduce((a, b) => a + b.yearlyUsd, 0));

  // Headcount gate: 4+ / 10+ UP-active directs qualifies every sale below you.
  const tierShare = (minLegs: number) => (directs >= minLegs ? 1 : 0);
  const t1PerLicence = r2(CALC_T1_PER_RECIPIENT * (unitUsd / 25) * units);
  const t2PerLicence = r2(CALC_T2_PER_RECIPIENT * (unitUsd / 25) * units);
  const t1Licences = Math.round(totalLicences * tierShare(CALC_T1_MIN_LEGS));
  const t2Licences = Math.round(totalLicences * tierShare(CALC_T2_MIN_LEGS));
  const t1Usd = r2(t1Licences * t1PerLicence);
  const t2Usd = r2(t2Licences * t2PerLicence);

  const flatUsd = r2(flat * directLicences);

  // ── Volume bonus ──────────────────────────────────────────────────────
  const qualifiedBonus = newSales >= threshold;
  const volumeUsd = qualifiedBonus ? r2(newSales * bonusPerSale) : 0;

  const perYear = r2(flatUsd + directBonusUsd + levelUsd + t1Usd + t2Usd);
  const total = r2(perYear * years + volumeUsd);

  const nextMilestone: WhiteLabelResult["nextMilestone"] = qualifiedBonus
    ? null
    : {
        name: "Volume bonus",
        requirement: `${threshold} new White Label sales in a calendar month`,
        salesToGo: threshold - newSales,
        wouldPayUsd: r2(threshold * bonusPerSale),
        explanation: `${threshold - newSales} more new sale${threshold - newSales === 1 ? "" : "s"} this month and every one of the ${threshold} pays $${bonusPerSale} — $${r2(threshold * bonusPerSale)}, on top of the $${r2(flat + directBonusPerLicence)} each already earns. There is no cap: ${threshold + 5} sales pay $${r2((threshold + 5) * bonusPerSale)}.`,
      };

  return {
    plan: {
      name: "White Label",
      priceUsd: price,
      currency: "USD",
      billing: "yearly",
      commissionUsd: r2(flat + cascade + residual),
      split: [
        { name: "Direct flat", usd: flat, paidTo: "The buyer's direct referrer" },
        { name: `Unilevel Plus cascade (${units} × $${unitUsd})`, usd: cascade, paidTo: `The buyer's referral chain, as ${units} separate $${unitUsd} licence sales` },
        { name: "Platform residual", usd: residual, paidTo: "Platform" },
        { name: "Platform revenue", usd: r2(price - flat - cascade - residual), paidTo: "Platform" },
      ],
      unitsPerSale: units,
      volumeBonus: { thresholdSales: threshold, perSaleUsd: bonusPerSale, capped: false, countsRenewals: false },
    },
    inputs: { newSalesThisMonth: newSales, activeDirectLicences: directLicences, directs, licencesByLevel: byLevelIn, totalLicences, years, source },
    summary: {
      perYearUsd: perYear,
      thisMonthIncentiveUsd: volumeUsd,
      totalUsd: total,
      totalLicences,
      grossLicenceRevenueUsd: r2(totalLicences * price),
      recurringPerDirectLicenceUsd: r2(flat + directBonusPerLicence + (byLevel[0]?.perLicenceUsd ?? 0)),
    },
    breakdown: {
      directFlat: {
        usd: flatUsd,
        licences: directLicences,
        perLicenceUsd: flat,
        explanation: `$${flat} flat on each of your ${directLicences} active direct licence${directLicences === 1 ? "" : "s"}, paid on activation and again on every yearly renewal.`,
      },
      directBonus: {
        usd: directBonusUsd,
        licences: directLicences,
        perLicenceUsd: directBonusPerLicence,
        explanation: `Each licence also runs ${units} × $${unitUsd} through the Unilevel Plus tree, and the ${plan.directBonusPercentage}% direct bonus on each unit — $${directBonusPerUnit} × ${units} = $${directBonusPerLicence} — goes to you as the direct referrer. So a direct licence is worth $${r2(flat + directBonusPerLicence)} a year before level bonus.`,
      },
      levelBonus: {
        usd: levelUsd,
        byLevel,
        explanation: `Every licence up to ${maxLevels} levels below you pays ${units} × legMultiplier × level × $${plan.pointValue} a year. Your ${directs} leg${directs === 1 ? "" : "s"} average ${r2(avgMult)}×.`,
      },
      infinityTier1: {
        usd: t1Usd,
        qualified: directs >= CALC_T1_MIN_LEGS,
        qualifyingLicences: t1Licences,
        perLicenceUsd: t1PerLicence,
        explanation: directs >= CALC_T1_MIN_LEGS
          ? `You have ${directs} legs, so all ${totalLicences} licences below you qualify at $${t1PerLicence} a year each (${units} × $${r2(t1PerLicence / units)}) — subject to the 3-nearest-uplines cap per unit.`
          : `Locked. Needs ${CALC_T1_MIN_LEGS} UP-active directs; you have ${directs}.`,
      },
      infinityTier2: {
        usd: t2Usd,
        qualified: directs >= CALC_T2_MIN_LEGS,
        qualifyingLicences: t2Licences,
        perLicenceUsd: t2PerLicence,
        explanation: directs >= CALC_T2_MIN_LEGS
          ? `You have ${directs} legs, so all ${totalLicences} licences below you qualify at $${t2PerLicence} a year each (${units} × $${r2(t2PerLicence / units)}) — subject to the 3-nearest-uplines cap per unit.`
          : `Locked. Needs ${CALC_T2_MIN_LEGS} UP-active directs; you have ${directs}.`,
      },
      volumeBonus: {
        usd: volumeUsd,
        newSales,
        qualified: qualifiedBonus,
        perSaleUsd: bonusPerSale,
        explanation: qualifiedBonus
          ? `${newSales} new sales this month × $${bonusPerSale}, paid once at month-close. Retroactive on all of them and uncapped; next month starts from zero.`
          : `$0 — the volume bonus needs ${threshold} NEW sales in a calendar month; you have ${newSales}.`,
      },
    },
    qualifications: [
      { name: "Unilevel Plus licence", requirement: "Hold an active $25 licence", you: "Assumed active", met: true, unlocks: "Any commission at all — without it your share is routed to the platform" },
      { name: "Direct income", requirement: "Refer a founder who buys White Label", you: `${directLicences} active direct licence${directLicences === 1 ? "" : "s"}`, met: directLicences > 0, unlocks: `$${r2(flat + directBonusPerLicence)} a year per licence` },
      { name: "Infinity Tier 1", requirement: `${CALC_T1_MIN_LEGS}+ UP-active directs`, you: `${directs} leg${directs === 1 ? "" : "s"}`, met: directs >= CALC_T1_MIN_LEGS, unlocks: `$${t1PerLicence} a year per qualifying licence, at any depth` },
      { name: "Infinity Tier 2", requirement: `${CALC_T2_MIN_LEGS}+ UP-active directs`, you: `${directs} leg${directs === 1 ? "" : "s"}`, met: directs >= CALC_T2_MIN_LEGS, unlocks: `$${t2PerLicence} a year per qualifying licence, at any depth` },
      { name: "Volume bonus", requirement: `${threshold}+ new sales in a calendar month`, you: `${newSales} new sale${newSales === 1 ? "" : "s"} this month`, met: qualifiedBonus, unlocks: `$${bonusPerSale} on every sale that month, uncapped` },
    ],
    nextMilestone,
    assumptions: [
      "The activation invoice and every yearly renewal invoice pay the same commission, so recurring income repeats for as long as the licence renews.",
      "The volume bonus counts only licences ACTIVATED in the calendar month. Renewals never count, and it is paid once at month-close.",
      `The $${cascade} cascade is paid as ${units} separate $${unitUsd} Unilevel Plus sales, so every tree figure is ${units}× what one licence pays.`,
      "Only directs holding an ACTIVE $25 licence count as legs. Buying White Label does not itself grant one — by default this model assumes every founder you referred also holds a licence.",
      "Licences are spread evenly across your legs. Volume concentrated in leg 1 or 2 earns less on the level bonus, because those legs carry a 1× and 2× multiplier against 3× for every later leg.",
      `Infinity tiers pay at most ${CALC_MAX_RECIPIENTS_PER_TIER} uplines per unit, nearest the buyer first.`,
      "Only an upline who holds an active $25 Unilevel Plus licence is paid; an unlicensed upline's share goes to the platform instead.",
      "An upline without an active NetworkChain subscription keeps half of each commission — the other half is forwarded to the nearest subscribed upline.",
      `The $${price} is the base price; GST is charged on top for Indian buyers and never enters the split.`,
      "Figures are gross commission before any withholding, fees or currency conversion.",
    ],
  };
}
