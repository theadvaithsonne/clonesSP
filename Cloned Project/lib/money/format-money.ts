/**
 * Format a backend-normalized `Money` for display. The FE never converts
 * currency — `Money` already carries `usdCents` + the original. We only
 * render, deriving each currency's decimals from `Intl` so there's no
 * hardcoded exponent table to drift from the backend.
 *
 * Display rule (design §6):
 *   same (USD):        "$2.40"
 *   converted fresh:   "$2.40 (₹200)"
 *   converted approx:  "~$2.40 (₹200)"      (stale | fallback | backfilled)
 *   sub-cent:          "<$0.01 (₫1)"        (usdCents 0, usdMicros > 0)
 *   unconverted:       "₹200 (unconverted)" / "200 (unknown currency)"
 */

import type { Money } from "./types";

const APPROX_SOURCES = new Set<Money["fxSource"]>([
  "stale",
  "fallback",
  "backfilled",
]);

/** Fallback symbol map — only used when Intl can't format a code. */
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", INR: "₹", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", AUD: "A$",
  CAD: "C$", NZD: "NZ$", SGD: "S$", HKD: "HK$", KRW: "₩", NGN: "₦",
  BRL: "R$", MXN: "MX$", ZAR: "R", RUB: "₽", TRY: "₺", THB: "฿", VND: "₫",
  PHP: "₱", IDR: "Rp", MYR: "RM", AED: "AED ", SAR: "SAR ", PKR: "₨",
  LKR: "₨", BDT: "৳",
};

function symbol(code: string): string {
  const c = code.toUpperCase();
  return CURRENCY_SYMBOL[c] ?? `${c} `;
}

/** Decimal places for a currency, derived from Intl (JPY 0, KWD 3, …). */
function ccyExp(code: string): number {
  try {
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

function formatMajor(minor: number, ccy: string): string {
  const e = ccyExp(ccy);
  const value = minor / Math.pow(10, e);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
    }).format(value);
  } catch {
    const num = value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: e,
    });
    return `${symbol(ccy)}${num}`;
  }
}

function formatUsd(usdCents: number, usdMicros: number | null): string {
  if (usdCents === 0 && (usdMicros ?? 0) > 0) return "<$0.01";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(usdCents / 100);
  } catch {
    return `$${(usdCents / 100).toFixed(2)}`;
  }
}

export interface FormattedMoney {
  /** USD (or, when unconverted, the original) — the prominent figure. */
  primary: string;
  /** The original amount, or a marker like "unconverted". */
  secondary?: string;
  /** True when the USD figure is from a stale/fallback/backfilled rate. */
  approx: boolean;
}

export function formatMoney(m: Money): FormattedMoney {
  if (m.fxSource === "unconverted") {
    return {
      primary: m.originalCurrency
        ? formatMajor(m.originalAmountMinor, m.originalCurrency)
        : String(m.originalAmountMinor),
      secondary: m.originalCurrency ? "unconverted" : "unknown currency",
      approx: false,
    };
  }
  const approx = APPROX_SOURCES.has(m.fxSource);
  const primary = (approx ? "~" : "") + formatUsd(m.usdCents ?? 0, m.usdMicros);
  if (m.fxSource === "same" || !m.originalCurrency) return { primary, approx };
  return {
    primary,
    secondary: formatMajor(m.originalAmountMinor, m.originalCurrency),
    approx,
  };
}

/** Single-string form, e.g. "$2.40 (₹200)". */
export function formatMoneyInline(m: Money): string {
  const f = formatMoney(m);
  if (m.fxSource === "unconverted") {
    return `${f.primary} (${f.secondary})`;
  }
  return f.secondary ? `${f.primary} (${f.secondary})` : f.primary;
}

// ─── Catalog product commercials ─────────────────────────────────────────────
// Every EarnGPT product surface (grid, suggestions, browse dialog, contact
// picker) derived price/commission from the same ladder inline. These two
// helpers are that ladder, verbatim, so all surfaces render identically.

/** The row fields the commercial helpers read (a superset of the catalog rows). */
export interface ProductCommercialRow {
  money?: Money | null;
  priceCents?: number | null;
  currency?: string | null;
  level1Pct?: number | null;
}

/** Symbol prefix used when a row has raw cents but no `Money` (matches the
 *  original inline `currency ? currency+" " : "$"`). */
function rawSymbol(currency?: string | null): string {
  return currency ? `${currency} ` : "$";
}

/** Display price for a catalog row: prefer the normalized `Money`, else raw
 *  cents, else an em-dash. */
export function priceLabel(row: ProductCommercialRow): string {
  if (row.money) return formatMoneyInline(row.money);
  if (row.priceCents != null) {
    return `${rawSymbol(row.currency)}${(row.priceCents / 100).toFixed(2)}`;
  }
  return "—";
}

export interface ProductCommercials {
  priceLabel: string;
  /** L1 commission amount in the row's currency, or null when unknown. */
  commissionAmount: string | null;
  commissionPct: number | null;
}

/** Price + level-1 commission for a catalog row. Commission = priceCents × pct,
 *  in the row's own currency (identical to the previous per-surface math). */
export function deriveProductCommercials(row: ProductCommercialRow): ProductCommercials {
  const pct = row.level1Pct ?? null;
  const commissionMinor =
    row.priceCents != null && pct != null
      ? Math.round((row.priceCents * pct) / 100)
      : null;
  return {
    priceLabel: priceLabel(row),
    commissionAmount:
      commissionMinor != null
        ? `${rawSymbol(row.currency)}${(commissionMinor / 100).toFixed(2)}`
        : null,
    commissionPct: pct,
  };
}

/**
 * Sum Money for a total. Sums `usdCents` ONLY (never mixes currencies),
 * excluding unconverted values and counting them for an honest footnote.
 */
export function sumUsdCents(
  items: Array<Pick<Money, "usdCents"> | null | undefined>,
): { totalUsdCents: number; unconvertedCount: number } {
  let totalUsdCents = 0;
  let unconvertedCount = 0;
  for (const it of items) {
    if (it && typeof it.usdCents === "number") totalUsdCents += it.usdCents;
    else unconvertedCount++;
  }
  return { totalUsdCents, unconvertedCount };
}
