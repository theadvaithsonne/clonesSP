// Derived figures for a HiFi bond instrument (spec §3 + §7).
//
// Pure: no DB, no IO, no floats. Everything here is BigInt arithmetic on
// atomic-unit strings, so it is directly unit-testable and safe to call
// on every keystroke from the builder's preview endpoint.
//
// The single most important thing this module exists for is spec §7: a
// founder entering "1% / daily / 90 days" is committing to pay out far
// more than they take in, and nothing on the create screen tells them.
// `deriveInstrumentFigures` is that number.

import {
  BondCurrency,
  addAtomic,
  mulUnits,
  percentOf,
} from "../config/bondMoney";

export const PAYOUT_FREQUENCIES = [
  "daily",
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
] as const;
export type PayoutFrequency = (typeof PAYOUT_FREQUENCIES)[number];

/**
 * Period length in days.
 *
 * A 30-day month basis, which the spec's own examples require: "90 days
 * at `quarterly` = 1 payout" and "100 days at `monthly` = 3 payouts plus
 * a 10-day stub". Year is therefore 360 (12 x 30), NOT 365 — mixing a
 * 30-day month with a 365-day year would make `yearly` inconsistent with
 * `monthly` x 12.
 */
export const PAYOUT_PERIOD_DAYS: Record<PayoutFrequency, number> = {
  daily: 1,
  monthly: 30,
  quarterly: 90,
  half_yearly: 180,
  yearly: 360,
};

export const DAYS_PER_YEAR = 360;

export type CommissionBasis = "principal" | "payout" | "both" | "none";

export interface InstrumentInput {
  unitPriceAtomic: string;
  currency: BondCurrency;
  durationDays: number;
  payoutFrequency: PayoutFrequency;
  /** Percent PER PAYOUT EVENT, not annualised. Spec §8. */
  ratePerPayoutPeriod: string | number;
  totalUnits: number;
  commissionBasis: CommissionBasis;
  /** Percent of unit price, charged once at purchase. */
  principalCommissionRate?: string | number;
  /** Percent of the payout amount, charged on every payout date. */
  payoutCommissionRate?: string | number;
}

export interface DerivedFigures {
  // ---- per unit (spec §3) ----
  payoutAmountPerUnitAtomic: string;
  payoutCount: number;
  totalInterestPerUnitAtomic: string;
  principalCommissionPerUnitAtomic: string;
  payoutCommissionPerPayoutPerUnitAtomic: string;
  totalCommissionPerUnitAtomic: string;
  /** principal returned + interest + commission. The headline figure. */
  totalOutflowPerUnitAtomic: string;
  /** Signed. Negative means the seller pays out more than they take in. */
  sellerNetPerUnitAtomic: string;

  // ---- at full subscription (spec §7 wants all five again) ----
  totalRaiseAtomic: string;
  totalInterestAtFullAtomic: string;
  totalCommissionAtFullAtomic: string;
  totalOutflowAtFullAtomic: string;
  sellerNetAtFullAtomic: string;

  // ---- sanity ----
  /** Simple (non-compounded) annualisation, for display beside the
   *  per-period rate so "1% daily" reads as the 360%/yr it is. */
  annualisedRatePct: string;
  /** Days left over when duration isn't a whole number of periods. */
  stubDays: number;
}

export function payoutCountFor(
  durationDays: number,
  frequency: PayoutFrequency,
): number {
  return Math.floor(durationDays / PAYOUT_PERIOD_DAYS[frequency]);
}

export function stubDaysFor(
  durationDays: number,
  frequency: PayoutFrequency,
): number {
  return durationDays % PAYOUT_PERIOD_DAYS[frequency];
}

/** Spec §8: simplest resolution of a frequency/duration mismatch is to
 *  block the combination at creation. */
export function isWholeMultipleOfPeriod(
  durationDays: number,
  frequency: PayoutFrequency,
): boolean {
  return stubDaysFor(durationDays, frequency) === 0;
}

/** Simple annualisation as a decimal-percent string, 4 dp. */
function annualise(
  ratePerPayoutPeriod: string | number,
  frequency: PayoutFrequency,
): string {
  const periodsPerYear = DAYS_PER_YEAR / PAYOUT_PERIOD_DAYS[frequency];
  // Keep it off floats: scale the rate to 6dp, multiply, then format.
  const scaled = BigInt(percentOf("1000000000000", ratePerPayoutPeriod)); // rate% of 1e12
  const annual = scaled * BigInt(periodsPerYear);
  // annual is (rate * periodsPerYear / 100) * 1e12 -> recover percent at 4dp
  const pctScaled = (annual * 10000n) / 10000000000n; // -> percent * 1e4
  const whole = pctScaled / 10000n;
  const frac = (pctScaled % 10000n).toString().padStart(4, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function deriveInstrumentFigures(
  input: InstrumentInput,
): DerivedFigures {
  const {
    unitPriceAtomic,
    durationDays,
    payoutFrequency,
    ratePerPayoutPeriod,
    totalUnits,
    commissionBasis,
    principalCommissionRate = 0,
    payoutCommissionRate = 0,
  } = input;

  const payoutCount = payoutCountFor(durationDays, payoutFrequency);

  // Round per unit FIRST, then multiply by N (spec §8) — doing it the
  // other way lets two identical holdings disagree.
  const payoutAmountPerUnitAtomic = percentOf(
    unitPriceAtomic,
    ratePerPayoutPeriod,
  );
  const totalInterestPerUnitAtomic = mulUnits(
    payoutAmountPerUnitAtomic,
    payoutCount,
  );

  const chargesPrincipal =
    commissionBasis === "principal" || commissionBasis === "both";
  const chargesPayout =
    commissionBasis === "payout" || commissionBasis === "both";

  const principalCommissionPerUnitAtomic = chargesPrincipal
    ? percentOf(unitPriceAtomic, principalCommissionRate)
    : "0";

  // Spec §6 / decision D2: the payout-basis rate applies to the PAYOUT
  // AMOUNT, not to the unit price. These differ by 100x on the spec's
  // own worked example.
  const payoutCommissionPerPayoutPerUnitAtomic = chargesPayout
    ? percentOf(payoutAmountPerUnitAtomic, payoutCommissionRate)
    : "0";

  const totalPayoutCommissionPerUnitAtomic = mulUnits(
    payoutCommissionPerPayoutPerUnitAtomic,
    payoutCount,
  );
  const totalCommissionPerUnitAtomic = addAtomic(
    principalCommissionPerUnitAtomic,
    totalPayoutCommissionPerUnitAtomic,
  );

  const totalOutflowPerUnitAtomic = addAtomic(
    addAtomic(unitPriceAtomic, totalInterestPerUnitAtomic),
    totalCommissionPerUnitAtomic,
  );

  // Signed — this one is expected to be negative and must not throw.
  const sellerNetPerUnitAtomic = (
    BigInt(unitPriceAtomic) - BigInt(totalOutflowPerUnitAtomic)
  ).toString();

  const totalRaiseAtomic = mulUnits(unitPriceAtomic, totalUnits);
  const totalInterestAtFullAtomic = mulUnits(
    totalInterestPerUnitAtomic,
    totalUnits,
  );
  const totalCommissionAtFullAtomic = mulUnits(
    totalCommissionPerUnitAtomic,
    totalUnits,
  );
  const totalOutflowAtFullAtomic = mulUnits(
    totalOutflowPerUnitAtomic,
    totalUnits,
  );
  const sellerNetAtFullAtomic = (
    BigInt(sellerNetPerUnitAtomic) * BigInt(totalUnits)
  ).toString();

  return {
    payoutAmountPerUnitAtomic,
    payoutCount,
    totalInterestPerUnitAtomic,
    principalCommissionPerUnitAtomic,
    payoutCommissionPerPayoutPerUnitAtomic,
    totalCommissionPerUnitAtomic,
    totalOutflowPerUnitAtomic,
    sellerNetPerUnitAtomic,
    totalRaiseAtomic,
    totalInterestAtFullAtomic,
    totalCommissionAtFullAtomic,
    totalOutflowAtFullAtomic,
    sellerNetAtFullAtomic,
    annualisedRatePct: annualise(ratePerPayoutPeriod, payoutFrequency),
    stubDays: stubDaysFor(durationDays, payoutFrequency),
  };
}
