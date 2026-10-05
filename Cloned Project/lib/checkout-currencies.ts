/**
 * The fiat currencies a buyer can pay an invoice in — ONE table for the
 * checkout surfaces (currency tiles, amount labels, invoice preview/document).
 *
 * USD and INR are what invoices are PRICED in; the rest are card-only payment
 * currencies via Stripe, converted at checkout. The backend's
 * `/payment-options` response decides which are actually offered — this file
 * only says how each one renders. A currency the backend returns that is not
 * in this table is dropped by the tile builder, so an older frontend never
 * shows an unlabeled tile for a currency added on the backend first.
 *
 * Mirrors `SUPPORTED_FIAT_CURRENCIES` in garagenew-backend
 * (src/utils/exchangeRate.ts). Add a currency in both places.
 *
 * Symbols are what a buyer reads next to a number on the same screen as a
 * "$" USD tile, so dollar-family currencies get a prefix ("CA$") and
 * currencies without a widely recognised glyph use their code ("AED ").
 */

export type CheckoutFiatCurrency = {
  code: string;
  /** Tile title, e.g. "$ USD". */
  label: string;
  /** One-liner under the tile title. */
  sublabel: string;
  flag: string;
  gradient: string;
  /** Prefix for amounts. */
  symbol: string;
  /** `toLocaleString` locale for digit grouping. */
  locale: string;
};

const CARD_ONLY = "International cards only";

export const CHECKOUT_FIAT_CURRENCIES: readonly CheckoutFiatCurrency[] = [
  {
    code: "USD",
    label: "$ USD",
    sublabel: "International cards",
    flag: "🇺🇸",
    gradient: "from-blue-500/20 to-indigo-500/10",
    symbol: "$",
    locale: "en-US",
  },
  {
    code: "INR",
    label: "₹ INR",
    sublabel: "UPI, cards, netbanking",
    flag: "🇮🇳",
    gradient: "from-emerald-500/20 to-teal-500/10",
    symbol: "₹",
    locale: "en-IN",
  },
  // Card-only currencies via Stripe. Shown to every buyer; Stripe India
  // declines non-INR charges on Indian-ISSUED cards, hence the sublabel.
  {
    code: "CAD",
    label: "CA$ CAD",
    sublabel: CARD_ONLY,
    flag: "🇨🇦",
    gradient: "from-red-500/20 to-rose-500/10",
    symbol: "CA$",
    locale: "en-US",
  },
  {
    code: "EUR",
    label: "€ EUR",
    sublabel: CARD_ONLY,
    flag: "🇪🇺",
    gradient: "from-sky-500/20 to-blue-500/10",
    symbol: "€",
    locale: "en-US",
  },
  {
    code: "GBP",
    label: "£ GBP",
    sublabel: CARD_ONLY,
    flag: "🇬🇧",
    gradient: "from-violet-500/20 to-purple-500/10",
    symbol: "£",
    locale: "en-US",
  },
  {
    code: "AED",
    label: "AED",
    sublabel: CARD_ONLY,
    flag: "🇦🇪",
    gradient: "from-green-500/20 to-emerald-500/10",
    symbol: "AED ",
    locale: "en-US",
  },
  {
    code: "PHP",
    label: "₱ PHP",
    sublabel: CARD_ONLY,
    flag: "🇵🇭",
    gradient: "from-yellow-500/20 to-amber-500/10",
    symbol: "₱",
    locale: "en-US",
  },
] as const;

export const FIAT_CURRENCY_CODES = CHECKOUT_FIAT_CURRENCIES.map((c) => c.code);

const BY_CODE = new Map(CHECKOUT_FIAT_CURRENCIES.map((c) => [c.code, c]));

export function isFiatCurrency(code: string): boolean {
  return BY_CODE.has((code || "").toUpperCase());
}

export function fiatCurrencyConfig(code: string): CheckoutFiatCurrency | undefined {
  return BY_CODE.get((code || "").toUpperCase());
}

/** Amount prefix for a code; the code itself (with a space) when unknown. */
export function currencySymbol(code: string): string {
  return BY_CODE.get((code || "").toUpperCase())?.symbol ?? `${(code || "").toUpperCase()} `;
}

/**
 * Minor units → display, e.g. 3478 CAD → "CA$34.78". Every currency here
 * uses 1/100 minor units (the backend relies on the same assumption).
 */
export function formatMinor(minor: number, code: string): string {
  const value = (Number(minor) || 0) / 100;
  const cfg = BY_CODE.get((code || "").toUpperCase());
  if (!cfg) return `${(code || "").toUpperCase()} ${value.toFixed(2)}`;
  return `${cfg.symbol}${value.toLocaleString(cfg.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
