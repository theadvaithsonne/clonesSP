// Money primitives for HiFi bonds.
//
// Every bond amount is an INTEGER number of a currency's smallest unit,
// carried as a STRING and manipulated with BigInt. Two reasons, both
// load-bearing:
//
//   1. `StoreWallet.balance` is a plain JS float. A `$inc` on it produced
//      a balance of 0.10000000000000142 in production. A 90-payout daily
//      bond compounds that kind of drift across every holding, so bond
//      arithmetic must not touch floats at all.
//
//   2. ETH cannot be an integer in a JS `number`. 1 ETH = 1e18 wei and
//      Number.MAX_SAFE_INTEGER is ~9.0e15, so even 0.01 ETH overflows.
//      BigInt is the only correct representation.
//
// Floats appear at exactly one place: `toWalletAmount`, the edge where we
// hand a figure to the existing (float-based) wallet services.

/** Currencies a bond may be denominated in — the cryptobrand set. */
export const BOND_CURRENCIES = ["INR", "USD", "USDT", "BTC", "ETH"] as const;
export type BondCurrency = (typeof BOND_CURRENCIES)[number];

/** Decimal places in one whole unit of each currency. */
export const MINOR_UNITS: Record<BondCurrency, number> = {
  INR: 2, // paise
  USD: 2, // cents
  USDT: 6,
  BTC: 8, // satoshi
  ETH: 18, // wei
};

export function isBondCurrency(c: string): c is BondCurrency {
  return (BOND_CURRENCIES as readonly string[]).includes(c);
}

function scaleOf(currency: BondCurrency): bigint {
  return 10n ** BigInt(MINOR_UNITS[currency]);
}

/**
 * Percentage rates are carried as decimal percents ("1", "1.5",
 * "0.0125"). We scale them to integers before any BigInt math so a rate
 * never enters the pipeline as a float. 6 dp is far finer than any rate
 * a founder will type.
 */
export const RATE_DP = 6;
const RATE_SCALE = 10n ** BigInt(RATE_DP);

/** Integer division rounding half away from zero. Inputs must be >= 0. */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("bondMoney: denominator must be > 0");
  if (numerator < 0n) throw new Error("bondMoney: negative amounts unsupported");
  const q = numerator / denominator;
  const r = numerator % denominator;
  return r * 2n >= denominator ? q + 1n : q;
}

/**
 * Parse a decimal string/number into a scaled BigInt with `dp` decimal
 * places, WITHOUT going through a float. "1.5" at dp=2 -> 150n.
 * Digits beyond `dp` are rounded half-up.
 */
function parseDecimalToScaled(value: string | number, dp: number): bigint {
  const raw = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`bondMoney: "${raw}" is not a non-negative decimal`);
  }
  const [intPart, fracRaw = ""] = raw.split(".");
  // Keep one extra digit so we can round rather than truncate.
  const frac = fracRaw.padEnd(dp + 1, "0");
  const kept = frac.slice(0, dp);
  const nextDigit = Number(frac[dp] ?? "0");
  let scaled = BigInt(intPart + (kept || "")) ;
  if (dp === 0) scaled = BigInt(intPart);
  if (nextDigit >= 5) scaled += 1n;
  return scaled;
}

/** Whole-unit decimal ("1000", "0.05") -> atomic string. */
export function toAtomic(value: string | number, currency: BondCurrency): string {
  return parseDecimalToScaled(value, MINOR_UNITS[currency]).toString();
}

/** Atomic string -> exact decimal string. Never lossy. */
export function fromAtomic(atomic: string, currency: BondCurrency): string {
  const dp = MINOR_UNITS[currency];
  const v = BigInt(atomic);
  if (dp === 0) return v.toString();
  const s = v.toString().padStart(dp + 1, "0");
  const int = s.slice(0, -dp);
  const frac = s.slice(-dp).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

/**
 * Atomic -> JS number, for handing to the float-based wallet services.
 * THE ONLY sanctioned float conversion. Throws rather than silently
 * losing precision (notably for ETH/wei).
 */
export function toWalletAmount(atomic: string, currency: BondCurrency): number {
  const decimal = fromAtomic(atomic, currency);
  const n = Number(decimal);
  if (!Number.isFinite(n) || String(n) !== decimal) {
    // Round-trip disagreement means the float cannot represent this value.
    const back = toAtomic(n.toFixed(MINOR_UNITS[currency]), currency);
    if (back !== atomic) {
      throw new Error(
        `bondMoney: ${decimal} ${currency} is not exactly representable as a JS number ` +
          `(atomic ${atomic} -> ${back}). Refusing to move money at reduced precision.`,
      );
    }
  }
  return n;
}

export function addAtomic(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

export function subAtomic(a: string, b: string): string {
  const r = BigInt(a) - BigInt(b);
  if (r < 0n) throw new Error(`bondMoney: subAtomic underflow (${a} - ${b})`);
  return r.toString();
}

/**
 * Multiply a per-unit amount by a unit count.
 *
 * Spec §8: "Round per unit, then multiply by N — not the other way — or
 * two buyers with the same holding get different totals." Callers must
 * therefore pass an ALREADY-ROUNDED per-unit atomic amount here.
 */
export function mulUnits(perUnitAtomic: string, units: number): string {
  if (!Number.isInteger(units) || units < 0) {
    throw new Error(`bondMoney: units must be a non-negative integer (got ${units})`);
  }
  return (BigInt(perUnitAtomic) * BigInt(units)).toString();
}

/**
 * `ratePct` percent of an atomic amount, rounded half-up to the
 * currency's smallest unit.
 */
export function percentOf(atomic: string, ratePct: string | number): string {
  const scaledRate = parseDecimalToScaled(ratePct, RATE_DP);
  return divRoundHalfUp(BigInt(atomic) * scaledRate, 100n * RATE_SCALE).toString();
}

/** Format for display, e.g. "₹1,919.00". Presentation only. */
export function formatAtomic(atomic: string, currency: BondCurrency): string {
  return `${fromAtomic(atomic, currency)} ${currency}`;
}

export const __testing = { divRoundHalfUp, parseDecimalToScaled, scaleOf };
