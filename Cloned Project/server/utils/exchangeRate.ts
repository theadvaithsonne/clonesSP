/**
 * Live USD-based exchange rates with in-memory caching.
 *
 * Uses the free exchangerate-api (no API key required). One call returns
 * every rate against USD; the whole table is cached for 1 hour. Falls back
 * to hardcoded rates if the API is unreachable.
 *
 * USD ↔ INR are the currencies invoices are denominated in. CAD / EUR / GBP
 * are PAYMENT currencies only — a buyer may settle a USD- or INR-priced
 * invoice in one of them by card (Stripe), and the conversion is captured on
 * the invoice. Nothing is ever priced in them.
 */

/** Currencies a buyer may pay an invoice in, besides the two it can be priced in. */
export const EXTRA_PAYMENT_CURRENCIES = ["CAD", "EUR", "GBP", "AED", "PHP"] as const;
export type ExtraPaymentCurrency = (typeof EXTRA_PAYMENT_CURRENCIES)[number];

/**
 * Every currency the rate table must be able to answer for. This list is the
 * single source of truth: Invoice.paymentCurrency's enum and the
 * select-payment zod schema are derived from it, so adding a currency here is
 * the whole backend change (plus a fallback rate above).
 *
 * Constraint: every entry must be a 2-decimal currency — convertCurrency
 * applies the rate to minor-unit integers and assumes 1/100 everywhere. A
 * 0-decimal currency (JPY) or 3-decimal one (KWD) needs that helper changed.
 */
export const SUPPORTED_FIAT_CURRENCIES = [
  "USD",
  "INR",
  ...EXTRA_PAYMENT_CURRENCIES,
] as const;
export type SupportedFiatCurrency = (typeof SUPPORTED_FIAT_CURRENCIES)[number];

export function isSupportedFiatCurrency(c: string): c is SupportedFiatCurrency {
  return (SUPPORTED_FIAT_CURRENCIES as readonly string[]).includes(c);
}

// Conservative fallbacks if the API fails — USD per unit, i.e. how many of
// the currency one dollar buys.
const FALLBACK_RATES: Record<SupportedFiatCurrency, number> = {
  USD: 1,
  INR: 85,
  CAD: 1.37,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  PHP: 58,
};
const FALLBACK_RATE = FALLBACK_RATES.INR;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedRates: Record<string, number> | null = null;
let cachedAt: number = 0;

/**
 * Fetch the full USD → * rate table.
 * Returns the cached table if fetched within the last hour.
 */
async function getUsdRateTable(): Promise<Record<string, number>> {
  const now = Date.now();

  if (cachedRates && now - cachedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  try {
    // Primary: exchangerate-api (free, no key)
    const res = await fetch(
      "https://open.er-api.com/v6/latest/USD"
    );
    const data = await res.json();

    if (data?.rates?.INR) {
      cachedRates = data.rates as Record<string, number>;
      cachedAt = now;
      console.log(
        `[ExchangeRate] USD→INR: ${cachedRates.INR}` +
          EXTRA_PAYMENT_CURRENCIES.map((c) => ` ${c}: ${cachedRates![c] ?? "?"}`).join("")
      );
      return cachedRates;
    }
  } catch (err) {
    console.warn("[ExchangeRate] API call failed, using fallback:", (err as Error).message);
  }

  // Return cached table if available (even if stale), otherwise fallbacks
  if (cachedRates) {
    console.warn(`[ExchangeRate] Using stale cached rates (USD→INR ${cachedRates.INR})`);
    return cachedRates;
  }

  console.warn(`[ExchangeRate] Using fallback rates`);
  return { ...FALLBACK_RATES };
}

/**
 * Current USD → <currency> rate. Unknown or missing currencies fall back to
 * the hardcoded table rather than throwing, matching the INR behaviour.
 */
export async function getUsdToRate(currency: string): Promise<number> {
  const cur = currency.toUpperCase();
  if (cur === "USD") return 1;
  const table = await getUsdRateTable();
  const live = table[cur];
  if (typeof live === "number" && live > 0) return live;
  const fallback = (FALLBACK_RATES as Record<string, number>)[cur];
  if (fallback) {
    console.warn(`[ExchangeRate] No live USD→${cur} rate, using fallback ${fallback}`);
    return fallback;
  }
  throw new Error(`Unsupported currency: ${cur}`);
}

/**
 * Fetch the current USD → INR exchange rate.
 * Returns a cached value if fetched within the last hour.
 */
export async function getUsdToInrRate(): Promise<number> {
  try {
    return await getUsdToRate("INR");
  } catch {
    return FALLBACK_RATE;
  }
}

/**
 * Convert a USD amount to INR using the live exchange rate.
 * Rounds to 2 decimal places.
 */
export async function convertUsdToInr(usdAmount: number): Promise<{
  inrAmount: number;
  exchangeRate: number;
}> {
  const rate = await getUsdToInrRate();
  const inrAmount = Math.round(usdAmount * rate * 100) / 100;
  return { inrAmount, exchangeRate: rate };
}

/**
 * Convert an INR amount to USD using the live exchange rate.
 * Uses the inverse of USD→INR rate (avoids a separate API call).
 * Rounds to 2 decimal places.
 */
export async function convertInrToUsd(inrAmount: number): Promise<{
  usdAmount: number;
  exchangeRate: number;
}> {
  const usdToInrRate = await getUsdToInrRate();
  const usdAmount = Math.round((inrAmount / usdToInrRate) * 100) / 100;
  return { usdAmount, exchangeRate: usdToInrRate };
}

/**
 * Convert any supported currency amount to USD.
 * - If already USD, returns as-is (no API call).
 * - If INR, converts using live rate.
 * Rounds to 2 decimal places.
 */
export async function convertToUsd(
  amount: number,
  fromCurrency: string
): Promise<{
  usdAmount: number;
  exchangeRate: number;
  originalCurrency: string;
}> {
  if (fromCurrency === "USD") {
    return { usdAmount: amount, exchangeRate: 1, originalCurrency: "USD" };
  }

  if (fromCurrency === "INR") {
    const { usdAmount, exchangeRate } = await convertInrToUsd(amount);
    return { usdAmount, exchangeRate, originalCurrency: "INR" };
  }

  throw new Error(`Unsupported currency for conversion: ${fromCurrency}`);
}
