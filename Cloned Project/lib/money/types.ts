/**
 * FE mirror of the backend canonical `Money` shape
 * (contacts-backend/src/money/money.types.ts). The backend sends fully
 * normalized Money in API payloads; the FE only formats it.
 */

export type CurrencyCode = string;

export type FxSource =
  | "same"
  | "live"
  | "cached"
  | "stale"
  | "fallback"
  | "backfilled"
  | "unconverted";

export interface Money {
  originalAmountMinor: number;
  originalCurrency: CurrencyCode | null;
  usdCents: number | null;
  usdMicros: number | null;
  fxRate: number | null;
  fxAsOf: string | null;
  fxSource: FxSource;
}
