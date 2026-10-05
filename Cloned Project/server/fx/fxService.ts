/**
 * Public multi-currency FX service. Backs `/public/fx/*`
 * (`src/routes/publicFx.ts`) and the hourly refresh + boot warm-up in
 * `src/index.ts`.
 *
 * Ported from contacts-backend's `src/money/fxService.ts`
 * (`getUsdRateTable`/`refreshFxRates`/`validateRates`), trimmed to what
 * a public rates/convert/currencies API needs:
 *  - dropped the EarnGPT-specific `moneyFromProviderRate` /
 *    `convertToUsdCents` (those build `Money` objects tied to
 *    contacts-backend's `money.types`, not needed here).
 *  - dropped the `asOf` historical-snapshot lookup (no backfill/audit
 *    use case here — this service only ever wants "the current table").
 *  - added a second upstream hop (frankfurter.dev) between the primary
 *    provider (open.er-api.com) and the static fallback table, per the
 *    Task 1 brief — contacts-backend's version only has provider +
 *    fallback.
 *
 * Provider chain (never throws to callers):
 *   1. open.er-api.com          -> persisted, source: "live"
 *   2. api.frankfurter.dev      -> persisted, source: "cached-alt"
 *   3. static FX_FALLBACK_RATES -> NOT persisted, source: "fallback"
 *      (a read-time safety net only; the hourly refresh + boot warm-up
 *      are what keep real snapshots in Mongo).
 */

import { FxRateSnapshot } from "../models/fxRateSnapshot.model";
import { FX_FALLBACK_RATES } from "./fxFallback";

const LIVE_PROVIDER = "open.er-api.com";
const LIVE_URL = "https://open.er-api.com/v6/latest/USD";
const ALT_PROVIDER = "frankfurter.dev";
const ALT_URL = "https://api.frankfurter.dev/v1/latest?base=USD";

// A snapshot older than this is not trusted even as "stale" — reads fall
// through to the static fallback table instead.
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7d
// In-process memo of the latest resolved USD table, to avoid a Mongo
// round-trip on every request.
const MEMO_MS = 60 * 1000; // 1m

/** Core currencies that must be present + sane for a table to be trusted. */
const REQUIRED = ["USD", "INR", "EUR", "GBP"];

export type FxSource = "live" | "cached-alt" | "fallback";

export interface RateTable {
  base: string;
  rates: Record<string, number>;
  asOf: Date;
  source: FxSource;
}

interface UsdRateTable {
  rates: Record<string, number>; // USD -> X (provider-native direction)
  fetchedAt: Date;
  source: FxSource;
}

let memo: { table: UsdRateTable; at: number } | null = null;

function mapToObj(m: unknown): Record<string, number> {
  if (m instanceof Map) return Object.fromEntries(m) as Record<string, number>;
  return (m as Record<string, number>) || {};
}

/**
 * Reject implausible rate tables (provider glitches) before trusting
 * them: required currencies present and finite/positive, USD ~= 1, and
 * INR within a plausible band (catches an outright garbled response
 * without needing a previous-snapshot comparison).
 */
export function validateRates(rates: Record<string, number> | null | undefined): boolean {
  if (!rates || typeof rates !== "object") return false;
  for (const c of REQUIRED) {
    const v = rates[c];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return false;
  }
  if (rates.USD !== undefined && Math.abs(rates.USD - 1) > 0.01) return false;
  const inr = rates.INR;
  if (typeof inr === "number" && (inr < 30 || inr > 200)) return false;
  return true;
}

async function fetchLiveTable(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(LIVE_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const rates = data?.rates;
    if (!rates || !validateRates(rates)) return null;
    return rates;
  } catch (err) {
    console.warn("[fx] live fetch (open.er-api.com) failed:", (err as Error).message);
    return null;
  }
}

async function fetchAltTable(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(ALT_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as { base?: string; rates?: Record<string, number> };
    if (!data?.rates || typeof data.rates !== "object") return null;
    // frankfurter omits the base currency from `rates` — add it back so
    // downstream rebasing/validation sees a complete USD table.
    const withBase = { ...data.rates, USD: 1 };
    if (!validateRates(withBase)) return null;
    return withBase;
  } catch (err) {
    console.warn("[fx] alt fetch (frankfurter.dev) failed:", (err as Error).message);
    return null;
  }
}

/**
 * Force-refresh the persisted USD rate snapshot: try the primary
 * provider, then the alternate, then fall back to the static table.
 * Invalidates the in-process memo on success. Used by the boot warm-up
 * and hourly cron in `index.ts` — MUST NEVER throw, both call sites
 * fire-and-forget this.
 */
export async function refreshRates(): Promise<{ source: FxSource; count: number }> {
  try {
    const live = await fetchLiveTable();
    if (live) {
      const fetchedAt = new Date();
      await FxRateSnapshot.create({
        base: "USD",
        rates: live,
        fetchedAt,
        source: "live",
        provider: LIVE_PROVIDER,
      });
      memo = { table: { rates: live, fetchedAt, source: "live" }, at: Date.now() };
      return { source: "live", count: Object.keys(live).length };
    }

    const alt = await fetchAltTable();
    if (alt) {
      const fetchedAt = new Date();
      await FxRateSnapshot.create({
        base: "USD",
        rates: alt,
        fetchedAt,
        source: "cached-alt",
        provider: ALT_PROVIDER,
      });
      memo = { table: { rates: alt, fetchedAt, source: "cached-alt" }, at: Date.now() };
      return { source: "cached-alt", count: Object.keys(alt).length };
    }

    console.warn("[fx] both live and alt providers failed; reads will use the static fallback table");
    return { source: "fallback", count: Object.keys(FX_FALLBACK_RATES).length };
  } catch (err) {
    // Belt-and-braces: this function must never throw to its caller.
    console.error("[fx] refreshRates failed unexpectedly:", err);
    return { source: "fallback", count: 0 };
  }
}

/** Resolve the freshest USD table: memo -> newest Mongo snapshot within
 *  MAX_STALE -> static fallback (unpersisted read-time safety net). */
async function resolveUsdTable(): Promise<UsdRateTable> {
  const now = Date.now();
  if (memo && now - memo.at < MEMO_MS) return memo.table;

  try {
    const latest = await FxRateSnapshot.findOne().sort({ fetchedAt: -1 }).lean();
    if (latest) {
      const fetchedAt = new Date(latest.fetchedAt);
      const age = now - fetchedAt.getTime();
      if (age <= MAX_STALE_MS) {
        const table: UsdRateTable = {
          rates: mapToObj(latest.rates),
          fetchedAt,
          source: (latest.source as FxSource) ?? "cached-alt",
        };
        memo = { table, at: now };
        return table;
      }
    }
  } catch (err) {
    // DB unreachable, etc. — never throw, fall through to the static table.
    console.error("[fx] failed to read latest FX snapshot:", err);
  }

  const table: UsdRateTable = {
    rates: { ...FX_FALLBACK_RATES },
    fetchedAt: new Date(),
    source: "fallback",
  };
  memo = { table, at: now };
  return table;
}

/** Rebase a USD->X table to another base currency by pivot: 1 `base` =
 *  (usdRates[X] / usdRates[base]) units of X. */
function rebase(usdRates: Record<string, number>, base: string): Record<string, number> {
  if (base === "USD") return { ...usdRates };
  const baseRate = usdRates[base];
  if (typeof baseRate !== "number" || !Number.isFinite(baseRate) || baseRate <= 0) {
    // Unknown/bad base for this table — caller (getRateTable) already
    // guards this by falling back to "USD" before calling rebase.
    return { ...usdRates };
  }
  const out: Record<string, number> = {};
  for (const [ccy, usdRate] of Object.entries(usdRates)) {
    out[ccy] = usdRate / baseRate;
  }
  out[base] = 1;
  return out;
}

/**
 * Public entry point: the current rate table, denominated in `base`
 * (default "USD"). Never throws — an unknown/unsupported `base` quietly
 * falls back to a USD-denominated table (and `base` in the response
 * reflects that).
 */
export async function getRateTable(base: string = "USD"): Promise<RateTable> {
  const usdTable = await resolveUsdTable();
  const requested = (base || "USD").toUpperCase();
  const canRebase =
    requested === "USD" ||
    (typeof usdTable.rates[requested] === "number" && usdTable.rates[requested] > 0);
  const effectiveBase = canRebase ? requested : "USD";
  return {
    base: effectiveBase,
    rates: rebase(usdTable.rates, effectiveBase),
    asOf: usdTable.fetchedAt,
    source: usdTable.source,
  };
}
