// src/routes/publicFx.ts
//
// PUBLIC currency-conversion API. No auth, no user context, no writes —
// reads the FX rate table maintained by src/fx/fxService.ts (refreshed
// hourly + on boot, see index.ts) and does pure conversion math.
//
// Mount point: /public/fx
//
//   GET /rates       ?base=USD                     -> { base, rates, asOf, source }
//   GET /convert      ?from=USD&to=INR&amount=25    -> { from, to, amount, result, rate, asOf, source }
//   GET /currencies                                  -> [{ code, name, symbol, decimals }]
//
// Cached at the edge (CDN/proxy) — rates only meaningfully change hourly.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { getRateTable } from "../fx/fxService";
import { CURRENCY_SYMBOL } from "../fx/currencyMeta";
import { ccyExponent } from "../fx/ccyExponent";
import { ok, fail } from "../utils/http";

const router = Router();

// Every response here is cacheable — set once for the whole router.
router.use((_req: Request, res: Response, next) => {
  res.set("Cache-Control", "public, max-age=300, s-maxage=3600");
  next();
});

/** Human-readable names for the currencies we display, echoed alongside
 *  the symbol/decimals in GET /currencies. Not exhaustive — codes we
 *  don't have a friendly name for fall back to the ISO code itself. */
const CURRENCY_NAME: Record<string, string> = {
  USD: "US Dollar",
  INR: "Indian Rupee",
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  CNY: "Chinese Yuan",
  AUD: "Australian Dollar",
  CAD: "Canadian Dollar",
  NZD: "New Zealand Dollar",
  SGD: "Singapore Dollar",
  HKD: "Hong Kong Dollar",
  KRW: "South Korean Won",
  NGN: "Nigerian Naira",
  BRL: "Brazilian Real",
  MXN: "Mexican Peso",
  ZAR: "South African Rand",
  RUB: "Russian Ruble",
  TRY: "Turkish Lira",
  THB: "Thai Baht",
  VND: "Vietnamese Dong",
  PHP: "Philippine Peso",
  IDR: "Indonesian Rupiah",
  MYR: "Malaysian Ringgit",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
  PKR: "Pakistani Rupee",
  LKR: "Sri Lankan Rupee",
  BDT: "Bangladeshi Taka",
};

function round(amount: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round((amount + Number.EPSILON) * f) / f;
}

/**
 * GET /rates?base=USD
 * Returns the current full rate table, denominated in `base` (defaults
 * USD). Never 400s — an unknown `base` just yields a USD-denominated
 * table (fxService reports the effective base it actually used).
 */
router.get("/rates", async (req: Request, res: Response) => {
  const base = typeof req.query.base === "string" ? req.query.base : "USD";
  const table = await getRateTable(base);
  res.json(ok(table));
});

const convertQuerySchema = z.object({
  from: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((s) => s.toUpperCase()),
  to: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((s) => s.toUpperCase()),
  amount: z
    .string()
    .trim()
    .min(1)
    .refine((s) => Number.isFinite(Number(s)), { message: "amount must be numeric" })
    .transform((s) => Number(s)),
});

/**
 * GET /convert?from=USD&to=INR&amount=25
 * Pivots through the fetched USD-denominated table: rate(from->to) =
 * usdRates[to] / usdRates[from]. Rounds the result to `to`'s ISO-4217
 * minor-unit decimals (never assumes 2).
 */
router.get("/convert", async (req: Request, res: Response) => {
  const parsed = convertQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(fail(parsed.error.issues[0]?.message ?? "invalid query params", "INVALID_QUERY"));
  }
  const { from, to, amount } = parsed.data;
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json(fail("amount must be a non-negative number", "INVALID_AMOUNT"));
  }

  const toDecimals = ccyExponent(to);
  if (toDecimals === null) {
    return res.status(400).json(fail(`unknown currency: ${to}`, "UNKNOWN_CURRENCY"));
  }
  if (ccyExponent(from) === null) {
    return res.status(400).json(fail(`unknown currency: ${from}`, "UNKNOWN_CURRENCY"));
  }

  // Fetch the table denominated in USD (source of truth) and pivot —
  // avoids double-fetching/rebasing twice for from vs to.
  const table = await getRateTable("USD");
  const fromRate = from === "USD" ? 1 : table.rates[from];
  const toRate = to === "USD" ? 1 : table.rates[to];
  if (
    typeof fromRate !== "number" ||
    typeof toRate !== "number" ||
    !Number.isFinite(fromRate) ||
    !Number.isFinite(toRate) ||
    fromRate <= 0 ||
    toRate <= 0
  ) {
    return res.status(400).json(fail(`unsupported currency for conversion: ${from === "USD" ? to : from}`, "UNSUPPORTED_CURRENCY"));
  }

  const rate = toRate / fromRate; // 1 `from` = rate units of `to`
  const result = round(amount * rate, toDecimals);

  res.json(
    ok({
      from,
      to,
      amount,
      result,
      rate,
      asOf: table.asOf,
      source: table.source,
    }),
  );
});

/**
 * GET /currencies
 * The supported currency set: CURRENCY_SYMBOL keys intersected with the
 * current USD rate table's keys, so we never advertise a currency we
 * can't actually quote a rate for right now.
 */
router.get("/currencies", async (_req: Request, res: Response) => {
  const table = await getRateTable("USD");
  const rateKeys = new Set(Object.keys(table.rates));
  const currencies = Object.keys(CURRENCY_SYMBOL)
    .filter((code) => rateKeys.has(code))
    .map((code) => ({
      code,
      name: CURRENCY_NAME[code] ?? code,
      symbol: CURRENCY_SYMBOL[code],
      decimals: ccyExponent(code) ?? 2,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  res.json(ok(currencies));
});

export default router;
