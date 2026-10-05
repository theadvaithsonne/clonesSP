// Display-only FX rate for the webinar buy-flow toggles. The catalog
// stores each item's native currency; this lets buyers (and the host
// picker) eyeball USD/INR without re-pricing on the backend. The
// invoice endpoint receives the chosen `displayCurrency` and does the
// canonical conversion server-side — this constant is purely for the
// preview number. Update when the rate drifts materially or wire to
// a live feed if precision matters.
export const USD_TO_INR = 88;

export type DisplayCurrency = "USD" | "INR";

export const CURRENCY_SYMBOL: Record<DisplayCurrency, string> = {
  USD: "$",
  INR: "₹",
};

export function convertPrice(
  price: number,
  from: string | undefined,
  to: DisplayCurrency,
): number {
  const fromUpper = (from || "USD").toUpperCase();
  if (fromUpper === to) return price;
  if (fromUpper === "USD" && to === "INR") return price * USD_TO_INR;
  if (fromUpper === "INR" && to === "USD") return price / USD_TO_INR;
  return price;
}

export function formatPrice(price: number): string {
  const cleaned = Number(price.toFixed(4));
  return cleaned.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

/**
 * Money with its own symbol attached, for surfaces that render a currency the
 * viewer didn't choose — an auction lot is priced in the seller's currency and
 * bid in that same currency, so there is no display toggle to honour here.
 */
export function formatMoney(amount: number, currency?: string): string {
  const code = (currency || "USD").toUpperCase();
  const symbol =
    code === "USD" ? "$" : code === "INR" ? "₹" : code === "EUR" ? "€" : "";
  const shown = `${symbol}${formatPrice(amount)}`;
  return symbol ? shown : `${formatPrice(amount)} ${code}`;
}
