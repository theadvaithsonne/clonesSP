/**
 * Garage's own back-office subdomain.
 *
 * Deliberately a standalone module with no imports. Both `middleware.ts`
 * (Edge runtime) and `lib/whitelabel.ts` need this value, and importing
 * whitelabel.ts from middleware would drag `lib/api` → `lib/auth` into the
 * Edge bundle for the sake of one string.
 */
export const ADMIN_APP_DOMAIN = "admin.garage.app";

/**
 * The Garage HQ web app's public origin.
 *
 * The back office is served from ADMIN_APP_DOMAIN, so a relative link like
 * `/invoice/…` resolves against admin.garage.app — where the customer-facing
 * page isn't served. Anything pointing at a customer page from the admin panel
 * has to be absolute.
 *
 * Static on purpose: this is where invoices live regardless of which host the
 * admin is browsing, so it must not follow the current origin.
 */
export const GARAGE_APP_ORIGIN = "https://my.garage.app";

/** Absolute URL of an invoice's public page, by invoice number or id. */
export function invoiceUrl(numberOrId: string): string {
  return `${GARAGE_APP_ORIGIN}/invoice/${encodeURIComponent(numberOrId)}`;
}
