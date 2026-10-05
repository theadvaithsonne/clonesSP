// FE wrappers for the invoice-based whitelabel add-on flow. Backs
// /whitelabel-addon on the BE (routes/whitelabelAddon.ts).
//
// Purchase mints a $600/yr recurring invoice and on-session charges the
// founder's saved card. On success, the whitelabel add-on activates
// immediately and the buyer's direct referrer earns 50% ($300).

import { api } from "@/lib/api";

export interface WhitelabelPriceResponse {
  success: true;
  baseUsdCents: number;
  gstApplicable: boolean;
  gstAmountSmallest: number;
  totalUsdCents: number;
  currency: "USD";
  country: string;
  regionSource: string;
}

export interface WhitelabelStatusResponse {
  success: true;
  hasAccess: boolean;
  currentEnd?: string; // ISO
  willRenewAt?: string; // ISO
  source?: string;
  lastInvoice?: {
    id: string;
    number: string;
    paidAt?: string;
  };
}

export interface WhitelabelPurchaseResponse {
  success: true;
  invoiceId: string;
  invoiceNumber: string;
  amountSmallest: number;
  currency: string;
  /** Relative FE path — the standard invoice pay page. */
  redirectUrl: string;
}

export function fetchWhitelabelPrice(): Promise<WhitelabelPriceResponse> {
  return api("/whitelabel-addon/price");
}

export function fetchWhitelabelStatus(): Promise<WhitelabelStatusResponse> {
  return api("/whitelabel-addon/status");
}

export function purchaseWhitelabelAddon(): Promise<WhitelabelPurchaseResponse> {
  return api("/whitelabel-addon/purchase", { method: "POST" });
}
