/**
 * Display symbols for currencies — the canonical map, echoed to callers
 * of `/public/fx/currencies` so clients never keep a divergent copy.
 * Used only as the fallback when `Intl.NumberFormat` can't format a
 * code; Intl handles the common path.
 *
 * Ported from contacts-backend's `src/money/currencyMeta.ts`.
 */

export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  AUD: "A$",
  CAD: "C$",
  NZD: "NZ$",
  SGD: "S$",
  HKD: "HK$",
  KRW: "₩",
  NGN: "₦",
  BRL: "R$",
  MXN: "MX$",
  ZAR: "R",
  RUB: "₽",
  TRY: "₺",
  THB: "฿",
  VND: "₫",
  PHP: "₱",
  IDR: "Rp",
  MYR: "RM",
  AED: "AED ",
  SAR: "SAR ",
  PKR: "₨",
  LKR: "₨",
  BDT: "৳",
};

/** Symbol for a code, or the ISO code with a trailing space as a safe
 *  fallback (e.g. "AED 200" never a bare "200"). */
export function currencySymbol(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.toUpperCase();
  return CURRENCY_SYMBOL[c] ?? `${c} `;
}
