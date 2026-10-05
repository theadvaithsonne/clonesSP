// USD → crypto FX rate service for native-coin invoices (ETH, BTC).
//
// USDT/USDC invoices don't need this — they're USD-pegged 1:1 and
// their atomic amount comes straight from the invoice's USD cents.
// Native coins (ETH, BTC) need a live rate to translate "$50 USD" into
// "0.0125 ETH at 1 ETH = $4,000".
//
// Contract:
//   getUsdPerCoin("ETH") → Promise<number>  // USD price of 1 ETH
//   getUsdPerCoin("BTC") → Promise<number>  // USD price of 1 BTC
//
// The rate we return is CAPTURED AT MINT time and locked onto the
// CryptoPaymentRequest's `expectedAmountAtomic`. If the market moves
// during the buyer's payment window, that's their exposure — same
// model BitPay / Coinbase Commerce use. Never re-quote at settle time.
//
// Cache: 5-min TTL per coin (in-memory). Rate feeds are shared across
// buyers who mint invoices in the same window, so at 1 mint/min we
// hit CoinGecko once every 5 min per coin — well under the 10-50
// req/min free-tier limit.
//
// Failure policy: on price-feed failure we throw. Callers (the mint
// path) catch and refuse to mint the crypto request, forcing the
// buyer to retry. We NEVER return a stale-or-fallback rate for a
// native-coin invoice — the risk of locking in a wildly wrong number
// (e.g. old cached rate during a 10% market move) is worse than a
// short-lived UX failure.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Native invoice coins we can price against USD via CoinGecko. "POL" is
// Polygon's native gas coin (renamed from MATIC in Sep 2024 — same
// on-chain token, new ticker); its CoinGecko id is still "matic-network".
type SupportedFxCoin = "ETH" | "BTC" | "POL";

/** Every currency the multi-currency store wallet + transfer/convert
 *  APIs know how to move money between. Extend both this list AND
 *  `convertBetween` below when adding a new supported currency.
 *
 *  USDT/USDC are USD-pegged 1:1 in the wallet layer (same treatment
 *  invoices already give them at mint time in cryptoWallets.ts). The
 *  ledger holds them as their own currency so a desk that wants to
 *  keep stablecoin balances distinct from fiat USD can do so, but
 *  every FX hop treats them as USD. Extend the pegged set below when
 *  adding another stablecoin. */
export const TRANSFERABLE_CURRENCIES = [
  "USD",
  "INR",
  "ETH",
  "BTC",
  "USDT",
  "USDC",
] as const;
export type TransferableCurrency = (typeof TRANSFERABLE_CURRENCIES)[number];

/** USD-pegged stablecoins — treated as USD in every FX hop. */
const USD_PEGGED = new Set<TransferableCurrency>(["USD", "USDT", "USDC"]);

interface CachedRate {
  usdPerCoin: number;
  fetchedAtMs: number;
}

const cache: Partial<Record<SupportedFxCoin, CachedRate>> = {};

// CoinGecko free tier — no API key required, ~10-50 req/min limit.
// Combined endpoint returns both coins in one call, so a mint burst
// gets both rates for the price of one HTTP round-trip.
const COIN_TO_COINGECKO_ID: Record<SupportedFxCoin, string> = {
  ETH: "ethereum",
  BTC: "bitcoin",
  POL: "matic-network",
};

// One combined call refreshes every price we care about in a single
// round-trip. Rebuilt from COIN_TO_COINGECKO_ID so adding a new native
// invoice coin only requires editing that map.
const COINGECKO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(
  COIN_TO_COINGECKO_ID,
).join(",")}&vs_currencies=usd`;

/**
 * Get the live USD-per-coin rate, cached for CACHE_TTL_MS.
 *
 * Throws when the price feed is unreachable AND no fresh cache entry
 * exists — see the failure-policy note above. Callers should treat
 * a throw as "cannot mint this crypto request, ask the buyer to try
 * again".
 */
export async function getUsdPerCoin(
  coin: SupportedFxCoin,
): Promise<number> {
  const now = Date.now();
  const hit = cache[coin];
  if (hit && now - hit.fetchedAtMs < CACHE_TTL_MS) {
    return hit.usdPerCoin;
  }

  // Cache miss OR stale — refresh both coins in one call.
  const res = await fetch(COINGECKO_URL, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(
      `cryptoFxRate: CoinGecko returned ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as Record<string, { usd?: number }>;

  const fetchedAtMs = Date.now();
  for (const c of Object.keys(COIN_TO_COINGECKO_ID) as SupportedFxCoin[]) {
    const id = COIN_TO_COINGECKO_ID[c];
    const usd = data[id]?.usd;
    if (typeof usd === "number" && usd > 0) {
      cache[c] = { usdPerCoin: usd, fetchedAtMs };
    }
  }

  const refreshed = cache[coin];
  if (!refreshed || !Number.isFinite(refreshed.usdPerCoin)) {
    throw new Error(
      `cryptoFxRate: CoinGecko response missing ${coin} price`,
    );
  }
  return refreshed.usdPerCoin;
}

/**
 * Convert a USD-cent amount to the coin's atomic (smallest) unit
 * at the current live rate.
 *
 * Example: usdCents=5000 (i.e. $50.00), coin="ETH", decimals=18,
 * live rate 1 ETH = $4,000 → returns 12_500_000_000_000_000n
 * (0.0125 ETH in wei).
 *
 * Returns both the atomic amount AND the rate used, so callers can
 * stamp the rate on the invoice for reconciliation.
 */
export async function usdCentsToNativeAtomic(
  usdCents: number,
  coin: SupportedFxCoin,
  decimals: number,
): Promise<{ atomic: bigint; usdPerCoin: number }> {
  const usdPerCoin = await getUsdPerCoin(coin);
  // usdCents / 100 = USD ; USD / usdPerCoin = coins ; * 10^decimals = atomic
  // Use float for the intermediate then BigInt at the end. Fine for
  // 6-8 significant digits of precision, which is far more than any
  // wallet UI can display.
  const coins = (usdCents / 100) / usdPerCoin;
  const atomic = BigInt(Math.round(coins * 10 ** decimals));
  return { atomic, usdPerCoin };
}

/**
 * Convert a whole-unit amount between any two supported currencies at
 * live spot rate. Powers the multi-currency store-wallet transfer +
 * convert APIs.
 *
 * Same → same:   identity, rate=1, path=[cur].
 * One side USD:  single-hop via convertUsdToInr / convertInrToUsd
 *                (INR) or getUsdPerCoin (ETH/BTC).
 * Non-USD ↔ Non-USD: two-hop via USD (path records the pivot). E.g.
 *                INR → BTC computes (INR → USD) → (USD → BTC).
 *
 * All rates come from the same feeds already in production:
 *   USD/INR — 1h-cached exchangerate-api (utils/exchangeRate.ts).
 *   USD/ETH, USD/BTC — 5min-cached CoinGecko (this module).
 * No new external calls introduced.
 *
 * Failure policy: if any leg's feed is unreachable AND has no fresh
 * cache, we throw. Callers surface a 503 to the caller and force a
 * retry rather than lock in a stale-or-fallback rate.
 */
export async function convertBetween(
  amount: number,
  from: TransferableCurrency,
  to: TransferableCurrency,
): Promise<{
  converted: number;
  rate: number;
  path: TransferableCurrency[];
  capturedAt: Date;
}> {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`convertBetween: invalid amount ${amount}`);
  }
  const capturedAt = new Date();
  if (from === to) {
    return { converted: amount, rate: 1, path: [from], capturedAt };
  }
  // USDT/USDC ↔ USD (and each other) is a pure identity — no external
  // rate feed touched. Preserves the invariant that a stablecoin
  // convert never fails when CoinGecko / exchangerate-api are down.
  if (USD_PEGGED.has(from) && USD_PEGGED.has(to)) {
    return { converted: amount, rate: 1, path: [from, to], capturedAt };
  }

  // Convert an amount in a non-USD currency into USD whole units.
  const toUsd = async (amt: number, cur: TransferableCurrency): Promise<number> => {
    if (USD_PEGGED.has(cur)) return amt;
    if (cur === "INR") {
      const { convertInrToUsd } = await import("../utils/exchangeRate");
      const { usdAmount } = await convertInrToUsd(amt);
      return usdAmount;
    }
    // ETH / BTC: amt (in coins) × USD-per-coin.
    const usdPerCoin = await getUsdPerCoin(cur as SupportedFxCoin);
    return amt * usdPerCoin;
  };

  // Convert a USD whole-unit amount into some target currency.
  const fromUsd = async (usd: number, cur: TransferableCurrency): Promise<number> => {
    if (USD_PEGGED.has(cur)) return usd;
    if (cur === "INR") {
      const { convertUsdToInr } = await import("../utils/exchangeRate");
      const { inrAmount } = await convertUsdToInr(usd);
      return inrAmount;
    }
    const usdPerCoin = await getUsdPerCoin(cur as SupportedFxCoin);
    return usd / usdPerCoin;
  };

  // Treat any USD-pegged side as USD for the hop-count decision — a
  // USDT → INR hop is single, not two-hop through "USD".
  if (USD_PEGGED.has(from) || USD_PEGGED.has(to)) {
    const converted =
      USD_PEGGED.has(from) ? await fromUsd(amount, to) : await toUsd(amount, from);
    const rate = amount > 0 ? converted / amount : 0;
    return { converted, rate, path: [from, to], capturedAt };
  }

  // Both sides non-USD → pivot through USD.
  const inUsd = await toUsd(amount, from);
  const converted = await fromUsd(inUsd, to);
  const rate = amount > 0 ? converted / amount : 0;
  return { converted, rate, path: [from, "USD", to], capturedAt };
}
