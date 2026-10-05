/**
 * The ONE canonical FX fallback table for the public currency service,
 * used only when no usable rate snapshot exists at all (fresh deploy,
 * every upstream provider down on a cold cache). Values are USD→X
 * (1 USD = N units of X), the providers' native direction.
 *
 * Ported from contacts-backend's `src/money/fxFallback.ts` — keep the
 * two tables in sync if either is hand-edited.
 *
 * Hand-maintained; refreshed occasionally. Last set: 2026-06-05.
 */

export const FX_FALLBACK_BASE = "USD" as const;

export const FX_FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  INR: 85, // canonical fallback — collapses the prior 85/88 drift
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.52,
  CAD: 1.37,
  JPY: 157,
  AED: 3.67,
  SGD: 1.35,
  NGN: 1480,
};

export const FX_FALLBACK_PROVIDER = "fallback-table@2026-06-05";
