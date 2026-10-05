// One place that turns a bond holding into the numbers people see.
//
// The public bond page, the owner's view and the purchase-history list
// all go through here, so "interest paid" or "net ROI" can never mean
// two different things on two screens.
//
// `computeBondSummary` is pure (no DB, no network) and unit-tested.
// Everything around it only loads data and decides what each audience
// is allowed to see.

import { BondCurrency, fromAtomic, addAtomic, mulUnits } from "../config/bondMoney";
import { PAYOUT_PERIOD_DAYS, PayoutFrequency } from "./bondMath";

export interface Money {
  /** Exact integer smallest-unit string — authoritative. */
  atomic: string;
  /** Exact decimal string in whole units. */
  amount: string;
  /** Value at the current rate. Null when the price feed is down. */
  usdNow: number | null;
}

export interface SummaryEvent {
  sequenceNo: number;
  status: string;
  interestAtomic: string;
  dueAt: Date | string;
  paidAt?: Date | string | null;
  usdAtPayment?: number | null;
}

export interface SummaryInput {
  currency: BondCurrency;
  units: number;
  principalAtomic: string;
  payoutAmountPerUnitAtomic: string;
  payoutCount: number;
  payoutFrequency: PayoutFrequency;
  events: SummaryEvent[];
  /** USD per 1 whole unit of `currency`, or null if unknown. */
  usdPerUnit: number | null;
}

export interface BondSummary {
  value: Money;
  perPayout: Money;
  dailyEarning: Money;
  termInterest: Money;
  totalPaidInterest: Money;
  totalRemainingInterest: Money;
  paymentsTillDate: number;
  paymentsRemaining: number;
  paymentsTotal: number;
  /** Payouts that exhausted their retries — still owed by the issuer. */
  failedPayments: number;
  nextPayoutAt: Date | null;
  /** Buyer-side fees. Always zero: commission is paid by the ISSUER. */
  fees: Money;
  netRoi: { pct: string; interest: Money };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function money(
  atomic: string,
  currency: BondCurrency,
  usdPerUnit: number | null,
): Money {
  const amount = fromAtomic(atomic, currency);
  return {
    atomic,
    amount,
    usdNow: usdPerUnit === null ? null : round2(Number(amount) * usdPerUnit),
  };
}

/** Integer division rounding half up, for non-negative BigInts. */
function divHalfUp(n: bigint, d: bigint): bigint {
  const q = n / d;
  return (n % d) * 2n >= d ? q + 1n : q;
}

export function computeBondSummary(i: SummaryInput): BondSummary {
  const c = i.currency;
  const m = (a: string) => money(a, c, i.usdPerUnit);

  // Per unit first, then x units — spec §8, so identical holdings can
  // never disagree.
  const perPayoutAtomic = mulUnits(i.payoutAmountPerUnitAtomic, i.units);
  const termAtomic = mulUnits(perPayoutAtomic, i.payoutCount);
  const periodDays = BigInt(PAYOUT_PERIOD_DAYS[i.payoutFrequency]);
  const dailyAtomic = divHalfUp(BigInt(perPayoutAtomic), periodDays).toString();

  let paidAtomic = "0";
  let remainingAtomic = "0";
  let paid = 0;
  let remaining = 0;
  let failed = 0;
  let next: Date | null = null;
  for (const e of i.events) {
    if (e.status === "paid") {
      paidAtomic = addAtomic(paidAtomic, e.interestAtomic);
      paid++;
    } else if (e.status === "scheduled" || e.status === "failed") {
      // A failed (retries exhausted) payout is still OWED — the issuer
      // can be made to retry it. Counting it as done would understate
      // what the investor is due.
      remainingAtomic = addAtomic(remainingAtomic, e.interestAtomic);
      remaining++;
      if (e.status === "failed") failed++;
      if (e.status === "scheduled") {
        const d = new Date(e.dueAt);
        if (!next || d < next) next = d;
      }
    }
  }

  // Net ROI over the full term. No buyer fees exist, so net == gross.
  const principal = BigInt(i.principalAtomic);
  const pctScaled =
    principal > 0n ? divHalfUp(BigInt(termAtomic) * 1000000n, principal) : 0n; // pct x 1e4
  const whole = pctScaled / 10000n;
  const frac = (pctScaled % 10000n).toString().padStart(4, "0").replace(/0+$/, "");

  return {
    value: m(i.principalAtomic),
    perPayout: m(perPayoutAtomic),
    dailyEarning: m(dailyAtomic),
    termInterest: m(termAtomic),
    totalPaidInterest: m(paidAtomic),
    totalRemainingInterest: m(remainingAtomic),
    paymentsTillDate: paid,
    paymentsRemaining: remaining,
    paymentsTotal: i.payoutCount,
    failedPayments: failed,
    nextPayoutAt: next,
    fees: m("0"),
    netRoi: { pct: frac ? `${whole}.${frac}` : whole.toString(), interest: m(termAtomic) },
  };
}

/**
 * USD per whole unit, via the 5-minute-cached FX layer. Returns null
 * instead of throwing: a dead price feed must degrade the page to
 * "USD unavailable", never break it.
 */
export async function usdPerUnit(currency: BondCurrency): Promise<number | null> {
  if (currency === "USD") return 1;
  try {
    const { convertBetween } = await import("./cryptoFxRate");
    const q = await convertBetween(1, currency as any, "USD");
    return Number.isFinite(q.converted) ? q.converted : null;
  } catch {
    return null;
  }
}

export interface ViewSources {
  holding: any;
  instrument: any;
  issuerName: string | null;
  events: any[];
  usdPerUnit: number | null;
}

/**
 * The public bond page. Visible to ANYONE with the bond hash, so it
 * deliberately omits: who owns it (user id, email), the invoice, wallet
 * transaction ids, and the issuer's commission / affiliate payouts.
 */
export function buildPublicBondView(
  src: ViewSources,
  log: { limit: number; offset: number } = { limit: 50, offset: 0 },
) {
  const { holding: h, instrument: inst, events, usdPerUnit: rate } = src;
  const c = h.currency as BondCurrency;
  const s = computeBondSummary({
    currency: c,
    units: h.units,
    principalAtomic: h.principalAtomic,
    payoutAmountPerUnitAtomic: h.payoutAmountPerUnitAtomic,
    payoutCount: h.payoutCount,
    payoutFrequency: inst.payoutFrequency,
    events,
    usdPerUnit: rate,
  });

  const now = Date.now();
  // History = anything that has happened (or should have): paid,
  // failed, skipped, and scheduled-but-overdue. Newest first.
  const history = events
    .filter((e) => e.status !== "scheduled" || new Date(e.dueAt).getTime() <= now)
    .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime());
  const upcoming = events
    .filter((e) => e.status === "scheduled" && new Date(e.dueAt).getTime() > now)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 5);
  const logRow = (e: any) => ({
    sequenceNo: e.sequenceNo,
    status: e.status,
    dueAt: e.dueAt,
    paidAt: e.paidAt || null,
    ...money(e.interestAtomic, c, rate),
    usdAtPayment: e.usdAtPayment ?? null,
  });

  return {
    bondHash: h.bondHash,
    name: inst.name,
    description: inst.description || "",
    issuer: { name: src.issuerName },
    currency: c,
    status: h.status,
    value: s.value,
    issuance: {
      purchasedAt: h.purchasedAt,
      bondPublishedAt: inst.publishedAt || null,
      units: h.units,
      unitPrice: money(inst.unitPriceAtomic, c, rate),
      principal: s.value,
    },
    redemption: {
      maturesAt: h.maturesAt,
      redeemed: h.status === "redeemed",
      redeemedAt: h.redeemedAt || null,
      autoRedeemed: !!h.autoRedeemed,
      principalReturn: s.value,
    },
    mechanics: {
      // Fixed-income by design: the rate is locked when the bond is
      // published, so an "interest rate log" is constant over the term.
      rateType: "fixed" as const,
      payoutFrequency: inst.payoutFrequency,
      periodDays: PAYOUT_PERIOD_DAYS[inst.payoutFrequency as PayoutFrequency],
      ratePerPayoutPeriodPct: inst.ratePerPayoutPeriod,
      annualisedRatePct: inst.derived?.annualisedRatePct ?? null,
      durationDays: inst.durationDays,
      payoutCount: h.payoutCount,
    },
    earningPower: {
      perPayout: s.perPayout,
      daily: s.dailyEarning,
      term: s.termInterest,
    },
    progress: {
      paymentsTillDate: s.paymentsTillDate,
      paymentsRemaining: s.paymentsRemaining,
      paymentsTotal: s.paymentsTotal,
      failedPayments: s.failedPayments,
      totalPaidInterest: s.totalPaidInterest,
      totalRemainingInterest: s.totalRemainingInterest,
      nextPayoutAt: s.nextPayoutAt,
    },
    fees: {
      ...s.fees,
      note: "Investors pay no fees on this bond. Any commission is paid by the issuer.",
    },
    netRoi: s.netRoi,
    interestLog: {
      items: history.slice(log.offset, log.offset + log.limit).map(logRow),
      total: history.length,
      limit: log.limit,
      offset: log.offset,
    },
    upcoming: upcoming.map(logRow),
    pricing: {
      usdPerUnit: rate,
      source: rate === null ? "unavailable" : "live",
      note:
        "usdNow uses the current rate. usdAtPayment is the value when each payment was made " +
        "(null for payments made before this was recorded).",
    },
  };
}

/** Compact row for the purchase-history list. */
export function buildHoldingListItem(src: ViewSources) {
  const { holding: h, instrument: inst } = src;
  const s = computeBondSummary({
    currency: h.currency,
    units: h.units,
    principalAtomic: h.principalAtomic,
    payoutAmountPerUnitAtomic: h.payoutAmountPerUnitAtomic,
    payoutCount: h.payoutCount,
    payoutFrequency: inst.payoutFrequency,
    events: src.events,
    usdPerUnit: src.usdPerUnit,
  });
  return {
    bondHash: h.bondHash || null,
    name: inst.name,
    issuer: { name: src.issuerName },
    payoutFrequency: inst.payoutFrequency,
    annualisedRatePct: inst.derived?.annualisedRatePct ?? null,
    value: s.value,
    totalPaidInterest: s.totalPaidInterest,
    totalRemainingInterest: s.totalRemainingInterest,
    paymentsTillDate: s.paymentsTillDate,
    paymentsRemaining: s.paymentsRemaining,
    paymentsTotal: s.paymentsTotal,
    failedPayments: s.failedPayments,
    nextPayoutAt: s.nextPayoutAt,
    netRoi: s.netRoi,
  };
}

/**
 * Load everything the view builders need for a set of holdings, in a
 * fixed number of queries regardless of how many holdings there are:
 * one for instruments, one for issuer names, one for payout events,
 * plus one cached FX lookup per distinct currency.
 */
export async function loadViewSources(holdings: any[]): Promise<ViewSources[]> {
  if (holdings.length === 0) return [];
  const { BondInstrument } = await import("../models/bondInstrument.model");
  const { BondPayoutEvent } = await import("../models/bondPayoutEvent.model");
  const { Organization } = await import("../models/organization.model");

  const instIds = [...new Set(holdings.map((h) => String(h.instrumentId)))];
  const orgIds = [...new Set(holdings.map((h) => String(h.orgId)))];
  const holdingIds = holdings.map((h) => h._id);

  const [instruments, orgs, events] = await Promise.all([
    BondInstrument.find({ _id: { $in: instIds } }).lean(),
    Organization.find({ _id: { $in: orgIds } }).select("name").lean(),
    BondPayoutEvent.find({ holdingId: { $in: holdingIds } })
      .select("holdingId sequenceNo status interestAtomic dueAt paidAt usdAtPayment")
      .lean(),
  ]);

  const instById = new Map(instruments.map((i: any) => [String(i._id), i]));
  const orgById = new Map(orgs.map((o: any) => [String(o._id), o]));
  const eventsByHolding = new Map<string, any[]>();
  for (const e of events as any[]) {
    const k = String(e.holdingId);
    if (!eventsByHolding.has(k)) eventsByHolding.set(k, []);
    eventsByHolding.get(k)!.push(e);
  }

  const currencies = [...new Set(holdings.map((h) => h.currency as BondCurrency))];
  const rates = new Map<string, number | null>();
  await Promise.all(
    currencies.map(async (c) => rates.set(c, await usdPerUnit(c))),
  );

  const out: ViewSources[] = [];
  for (const h of holdings) {
    const instrument = instById.get(String(h.instrumentId));
    // A holding whose instrument is gone can't be described honestly —
    // skip it rather than render invented numbers.
    if (!instrument) continue;
    out.push({
      holding: h,
      instrument,
      issuerName: (orgById.get(String(h.orgId)) as any)?.name ?? null,
      events: eventsByHolding.get(String(h._id)) || [],
      usdPerUnit: rates.get(h.currency) ?? null,
    });
  }
  return out;
}
