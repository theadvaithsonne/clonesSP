// Publish-time and purchase-time validation for HiFi bonds.
//
// Separated from the routes so the rules are unit-testable and stated
// once. Every rule here corresponds to a specific clause of the spec.

import { BondCurrency, MINOR_UNITS, fromAtomic, toAtomic } from "../config/bondMoney";
import {
  PayoutFrequency,
  isWholeMultipleOfPeriod,
  stubDaysFor,
  PAYOUT_PERIOD_DAYS,
} from "./bondMath";

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

/**
 * The invoice layer stores amounts as a JS number of 1/100ths of a unit
 * (`Math.round(amount * 100)`) for EVERY currency, crypto included. A
 * bond priced at 0.005 ETH would therefore be recorded on its own
 * receipt as 0.01 ETH.
 *
 * Rather than silently misstate the receipt, v1 requires a unit price
 * that is exactly representable at 2 decimal places. Lifting this means
 * widening the invoice amount representation, not loosening this check.
 */
export function isInvoiceRepresentable(
  atomicAmount: string,
  currency: BondCurrency,
): boolean {
  const dp = MINOR_UNITS[currency];
  if (dp <= 2) return true;
  // Exactly representable at 2dp iff the sub-1/100th remainder is zero.
  const divisor = 10n ** BigInt(dp - 2);
  return BigInt(atomicAmount) % divisor === 0n;
}

/** Smallest-unit integer for the invoice line item (2dp convention). */
export function toInvoiceMinorUnits(
  atomicAmount: string,
  currency: BondCurrency,
): number {
  const dp = MINOR_UNITS[currency];
  if (dp <= 2) {
    return Number(BigInt(atomicAmount) * 10n ** BigInt(2 - dp));
  }
  return Number(BigInt(atomicAmount) / 10n ** BigInt(dp - 2));
}

export interface InstrumentDraft {
  unitPriceAtomic: string;
  currency: BondCurrency;
  durationDays: number;
  payoutFrequency: PayoutFrequency;
  ratePerPayoutPeriod: string;
  totalUnits: number;
  minUnits: number;
  commissionBasis: "principal" | "payout" | "both" | "none";
  principalCommissionRate: string;
  payoutCommissionRate: string;
}

/** Structural rules — enforced at create AND publish. */
export function validateInstrument(d: InstrumentDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (BigInt(d.unitPriceAtomic) <= 0n) {
    issues.push({
      field: "unitPrice",
      code: "UNIT_PRICE_POSITIVE",
      message: "Unit price must be greater than zero.",
    });
  }

  if (!isInvoiceRepresentable(d.unitPriceAtomic, d.currency)) {
    issues.push({
      field: "unitPrice",
      code: "UNIT_PRICE_PRECISION",
      message:
        `A ${d.currency} unit price must be exactly representable to 2 decimal places ` +
        `(the invoice layer stores 1/100ths of a unit). ` +
        `${fromAtomic(d.unitPriceAtomic, d.currency)} ${d.currency} is finer than that.`,
    });
  }

  // Spec §8 — frequency/duration mismatch. Blocking is the spec's own
  // "simplest" resolution, and the payout engine implements no
  // pro-rata stub, so allowing one would silently drop the remainder.
  if (!isWholeMultipleOfPeriod(d.durationDays, d.payoutFrequency)) {
    const stub = stubDaysFor(d.durationDays, d.payoutFrequency);
    issues.push({
      field: "durationDays",
      code: "DURATION_NOT_WHOLE_PERIODS",
      message:
        `${d.durationDays} days is not a whole number of ${d.payoutFrequency} periods ` +
        `(${PAYOUT_PERIOD_DAYS[d.payoutFrequency]} days each) — it leaves a ${stub}-day stub. ` +
        `Choose a duration that divides evenly.`,
    });
  }

  if (d.durationDays < PAYOUT_PERIOD_DAYS[d.payoutFrequency]) {
    issues.push({
      field: "durationDays",
      code: "DURATION_SHORTER_THAN_PERIOD",
      message: `A ${d.payoutFrequency} bond must run at least ${PAYOUT_PERIOD_DAYS[d.payoutFrequency]} days.`,
    });
  }

  if (Number(d.ratePerPayoutPeriod) <= 0) {
    issues.push({
      field: "ratePerPayoutPeriod",
      code: "RATE_POSITIVE",
      message: "Rate per payout period must be greater than zero.",
    });
  }

  if (d.minUnits > d.totalUnits) {
    issues.push({
      field: "minUnits",
      code: "MIN_EXCEEDS_TOTAL",
      message: "Minimum units per buyer cannot exceed total supply.",
    });
  }

  const needsPrincipalRate =
    d.commissionBasis === "principal" || d.commissionBasis === "both";
  const needsPayoutRate =
    d.commissionBasis === "payout" || d.commissionBasis === "both";
  if (needsPrincipalRate && Number(d.principalCommissionRate) <= 0) {
    issues.push({
      field: "principalCommissionRate",
      code: "PRINCIPAL_RATE_REQUIRED",
      message: `commissionBasis "${d.commissionBasis}" requires a principal commission rate.`,
    });
  }
  if (needsPayoutRate && Number(d.payoutCommissionRate) <= 0) {
    issues.push({
      field: "payoutCommissionRate",
      code: "PAYOUT_RATE_REQUIRED",
      message: `commissionBasis "${d.commissionBasis}" requires a payout commission rate.`,
    });
  }

  return issues;
}

/**
 * Spec §7: the seller must acknowledge the exact total-outflow figure,
 * not tick a generic "I agree". We compare against the derived value so
 * a stale builder screen cannot publish a number the founder never saw.
 */
export function validateAcknowledgement(
  acknowledgedOutflowAtomic: string | undefined,
  derivedOutflowAtomic: string,
  currency: BondCurrency,
): ValidationIssue[] {
  if (!acknowledgedOutflowAtomic) {
    return [
      {
        field: "acknowledgedOutflow",
        code: "ACK_REQUIRED",
        message:
          "Publishing requires acknowledging the total amount you will pay out per unit.",
      },
    ];
  }
  if (acknowledgedOutflowAtomic !== derivedOutflowAtomic) {
    return [
      {
        field: "acknowledgedOutflow",
        code: "ACK_MISMATCH",
        message:
          `The acknowledged figure (${fromAtomic(acknowledgedOutflowAtomic, currency)} ${currency}) ` +
          `does not match this bond's total outflow per unit ` +
          `(${fromAtomic(derivedOutflowAtomic, currency)} ${currency}). ` +
          `Re-check the summary before publishing.`,
      },
    ];
  }
  return [];
}

/**
 * A `levels` comb plan's percentages must add up to the bond's own
 * commission rate — the founder "enters each percentage and the total,
 * and it should match". A drift means the founder thinks they are
 * paying a different amount than they are.
 */
export function validateLevelsAgainstRate(
  levels: { level: number; percentage: number }[],
  commissionRatePct: string,
): ValidationIssue[] {
  const total = levels.reduce((s, l) => s + Number(l.percentage || 0), 0);
  const rate = Number(commissionRatePct);
  // 0.0001 tolerance — these are human-entered percentages.
  if (Math.abs(total - rate) > 0.0001) {
    return [
      {
        field: "combPlanId",
        code: "LEVELS_TOTAL_MISMATCH",
        message:
          `The comb plan's level percentages total ${total}%, but this bond's ` +
          `commission rate is ${rate}%. They must match.`,
      },
    ];
  }
  return [];
}

export { toAtomic };
