// HiFi investment invoicing — config constants.
//
// Products, applications, KYC, subscriptions, payouts all live in the
// existing `hifi_*` collections in roam-admin-prod (owned + maintained
// by the garage-seller-hifi Next app). This module governs the invoice
// + payment layer we bolt onto the existing hifi application flow:
//
//   1. On the "Pay" step the seller FE calls
//      `POST /hifi/applications/:id/invoice` to mint one of our invoices.
//   2. The investor pays via the standard invoice page, EITHER:
//        • wallet — for wallet-payable currencies (USD/INR/ETH/BTC)
//        • crypto-invoice pipeline — for stablecoins on-chain (USDC/USDT
//          on Polygon), matched by the in-house poller
//   3. `services/hifiInvoiceFulfillment.ts` fires on payment (any
//      channel), updates `hifi_investment_applications` +
//      `hifi_investment_subscriptions`.

/**
 * Wallet-payable currencies. Backed by the multi-currency store-wallet
 * system (see services/cryptobrandWallets.ts). Extend both this list
 * and CRYPTOBRAND_EXTRA_CURRENCIES in lockstep if you add a currency.
 */
export const HIFI_WALLET_CURRENCIES = [
  "USD",
  "INR",
  "ETH",
  "BTC",
] as const;

export type HifiWalletCurrency = (typeof HIFI_WALLET_CURRENCIES)[number];

/**
 * Crypto-invoice-payable currencies. Backed by the in-house crypto
 * pipeline (`CryptoPaymentRequest` + `cryptoPaymentPoller`). The
 * investor sends the token on-chain to the platform address; the
 * poller correlates the amount back to the invoice.
 *
 * NOT backed by store wallets — no one holds a "USDC store-wallet
 * balance" today. Extend `SUPPORTED_CHAINS` in `config/cryptoWallets.ts`
 * in lockstep (a currency listed here MUST have at least one
 * (chain, coin) row there with a populated platform address, else
 * `POST /hifi/applications/:id/invoice` will 400 at pay time).
 */
export const HIFI_CRYPTO_INVOICE_CURRENCIES = ["USDC", "USDT"] as const;

export type HifiCryptoInvoiceCurrency =
  (typeof HIFI_CRYPTO_INVOICE_CURRENCIES)[number];

/**
 * Tagged normalization of the free-text currency field on
 * `hifi_investment_application` (e.g. `"USDC"`, `"INR (₹)"`,
 * `"USD ($)"`, `"USDT (BEP-20)"`).
 *
 * Returns `{ kind: "wallet", currency }` when the currency should ride
 * the store-wallet pay path (metadata.allowedWalletCurrencies gate on
 * the invoice + the wallet tab on the FE).
 *
 * Returns `{ kind: "crypto", currency }` when the currency should ride
 * the crypto-invoice pay pipeline (metadata.paymentChannel = "crypto"
 * on the invoice + the crypto tab on the FE).
 *
 * Returns `null` when the currency isn't payable through either
 * channel — caller returns 400 with the supported list.
 */
export type NormalizedHifiCurrency =
  | { kind: "wallet"; currency: HifiWalletCurrency }
  | { kind: "crypto"; currency: HifiCryptoInvoiceCurrency };

export function normalizeHifiCurrency(
  raw: string | undefined | null,
): NormalizedHifiCurrency | null {
  if (!raw) return null;
  const upper = String(raw).toUpperCase().trim();
  // Strip common decorations from the display form ("INR (₹)",
  // "USD ($)", "USDT (BEP-20)", "USDC (Polygon)").
  const alpha = upper.replace(/[^A-Z]/g, "");

  // Crypto-invoice currencies first — must catch USDT/USDC before the
  // "USD" prefix branch (USDT starts with "USD").
  if (alpha.startsWith("USDC")) return { kind: "crypto", currency: "USDC" };
  if (alpha.startsWith("USDT")) return { kind: "crypto", currency: "USDT" };

  // Wallet currencies.
  if (alpha.startsWith("INR")) return { kind: "wallet", currency: "INR" };
  if (alpha.startsWith("USD")) return { kind: "wallet", currency: "USD" };
  if (alpha === "ETH") return { kind: "wallet", currency: "ETH" };
  if (alpha === "BTC") return { kind: "wallet", currency: "BTC" };

  return null;
}

/**
 * Human-readable list of everything a hifi application `currency` can
 * successfully resolve to — used in 400 error messages.
 */
export const HIFI_PAYABLE_CURRENCIES = [
  ...HIFI_WALLET_CURRENCIES,
  ...HIFI_CRYPTO_INVOICE_CURRENCIES,
] as const;

/**
 * `hifi_investment_application` shape — the fields we touch. Kept as a
 * minimal type so callers get autocomplete without pulling in a full
 * mirror of the seller schema.
 */
export interface HifiApplicationDoc {
  _id: any;
  id: string;
  productId: string;
  userId: string;
  orgId: string;
  units: number;
  currency: string;
  payableInr: number;
  amountConfirmed?: string;
  status?: string;
  paidAt?: Date | null;
  paymentStatus?: string;
  paymentPayload?: Record<string, any>;
  stepStatuses?: Record<string, string>;
  activeStepId?: string;
  walletCurrency?: string;
  walletAmount?: number;
}
