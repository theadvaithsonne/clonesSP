/**
 * NOWPayments crypto payment integration.
 * Handles creating crypto payments and verifying IPN (webhook) signatures.
 */
import crypto from "crypto";

const API_BASE = "https://api.nowpayments.io/v1";

// Hosted frontend origin the payer is redirected back to after a crypto
// payment. The NowPayments success_url must be a publicly reachable URL, so
// this is the production domain regardless of the local FRONTEND_URL env.
const FRONTEND_REDIRECT_BASE = "https://my.garage.app";
const SANDBOX_API_BASE = "https://api-sandbox.nowpayments.io/v1";

function getApiBase(): string {
  return process.env.NOWPAYMENTS_SANDBOX === "true" ? SANDBOX_API_BASE : API_BASE;
}

function getApiKey(): string {
  return process.env.NOWPAYMENTS_API_KEY || "";
}

function getIpnSecret(): string {
  return process.env.NOWPAYMENTS_IPN_SECRET || "";
}

// ============ Types ============

export interface CreateCryptoPaymentOptions {
  priceAmount: number; // Amount in fiat (e.g., 10.50)
  priceCurrency: string; // Fiat currency (USD, INR, EUR)
  payCurrency?: string; // Crypto to pay in (btc, eth, usdt). If omitted, user chooses on NOWPayments page.
  orderId: string; // Our invoice ID
  orderDescription?: string;
  ipnCallbackUrl: string; // Our webhook URL
  successUrl?: string; // Where to redirect the payer after a successful payment
  cancelUrl?: string; // Where to redirect the payer if they cancel
}

export interface CryptoPaymentResponse {
  payment_id: number;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
  purchase_id: number;
  created_at: string;
  updated_at: string;
  expiration_estimate_date: string;
  payment_url?: string; // NOWPayments hosted payment page
}

export interface CryptoPaymentStatus {
  payment_id: number;
  payment_status: "waiting" | "confirming" | "confirmed" | "sending" | "partially_paid" | "finished" | "failed" | "refunded" | "expired";
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  actually_paid: number;
  order_id: string;
  outcome_amount: number;
  outcome_currency: string;
}

export interface CryptoMinAmount {
  min_amount: number;
  currency_from: string;
  currency_to: string;
  fiat_equivalent: number;
}

// ============ API Functions ============

/**
 * Check if NOWPayments API is available.
 */
export async function checkStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/status`);
    const data = await res.json();
    return data.message === "OK";
  } catch {
    return false;
  }
}

/**
 * Get list of available cryptocurrencies.
 */
export async function getAvailableCurrencies(): Promise<string[]> {
  const res = await fetch(`${getApiBase()}/currencies`, {
    headers: { "x-api-key": getApiKey() },
  });
  const data = await res.json();
  return data.currencies || [];
}

/**
 * Get minimum payment amount for a crypto currency.
 */
export async function getMinimumAmount(
  currencyFrom: string,
  currencyTo: string = "usd"
): Promise<CryptoMinAmount> {
  const res = await fetch(
    `${getApiBase()}/min-amount?currency_from=${currencyFrom}&currency_to=${currencyTo}`,
    { headers: { "x-api-key": getApiKey() } }
  );
  return res.json();
}

/**
 * Get estimated price in crypto for a given fiat amount.
 */
export async function getEstimatedPrice(
  amount: number,
  currencyFrom: string,
  currencyTo: string
): Promise<{ estimated_amount: number; currency_from: string; currency_to: string }> {
  const res = await fetch(
    `${getApiBase()}/estimate?amount=${amount}&currency_from=${currencyFrom}&currency_to=${currencyTo}`,
    { headers: { "x-api-key": getApiKey() } }
  );
  return res.json();
}

/**
 * Create a crypto payment.
 * Returns the deposit address and amount the user should send.
 */
export async function createPayment(
  options: CreateCryptoPaymentOptions
): Promise<CryptoPaymentResponse> {
  const body: any = {
    price_amount: options.priceAmount,
    price_currency: options.priceCurrency.toLowerCase(),
    order_id: options.orderId,
    order_description: options.orderDescription || "",
    ipn_callback_url: options.ipnCallbackUrl,
  };

  if (options.payCurrency) {
    body.pay_currency = options.payCurrency.toLowerCase();
  }

  const res = await fetch(`${getApiBase()}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `NOWPayments API error: ${res.status}`);
  }

  const data = await res.json();
  console.log(`[NOWPayments] Created payment #${data.payment_id} for ${options.priceAmount} ${options.priceCurrency}`);
  return data;
}

/**
 * Create an invoice on NOWPayments (hosted payment page).
 * User gets redirected to NOWPayments to choose crypto and pay.
 * This is simpler than createPayment — user picks crypto on their page.
 */
export async function createInvoice(
  options: CreateCryptoPaymentOptions
): Promise<{ id: string; invoice_url: string }> {
  const body: any = {
    price_amount: options.priceAmount,
    price_currency: options.priceCurrency.toLowerCase(),
    order_id: options.orderId,
    order_description: options.orderDescription || "",
    ipn_callback_url: options.ipnCallbackUrl,
    success_url: options.successUrl || `${FRONTEND_REDIRECT_BASE}/workspace`,
    cancel_url: options.cancelUrl || `${FRONTEND_REDIRECT_BASE}/workspace`,
  };

  const res = await fetch(`${getApiBase()}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `NOWPayments invoice error: ${res.status}`);
  }

  const data = await res.json();
  console.log(`[NOWPayments] Created invoice #${data.id} → ${data.invoice_url}`);
  return data;
}

/**
 * Get payment status by payment ID.
 */
export async function getPaymentStatus(
  paymentId: number | string
): Promise<CryptoPaymentStatus> {
  const res = await fetch(`${getApiBase()}/payment/${paymentId}`, {
    headers: { "x-api-key": getApiKey() },
  });
  return res.json();
}

/**
 * Recursively sort object keys alphabetically so that JSON.stringify produces
 * a canonical representation. NOWPayments uses this canonical form for HMAC signing.
 */
function sortObject(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);

  const sorted: Record<string, any> = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = sortObject(obj[key]);
    });
  return sorted;
}

/**
 * Verify IPN (webhook) signature from NOWPayments.
 * Algorithm: recursively sort object keys → JSON.stringify → HMAC-SHA512 with IPN secret.
 */
export function verifyIpnSignature(
  body: Record<string, any>,
  receivedSignature: string
): boolean {
  const secret = getIpnSecret();
  if (!secret) {
    console.error("[NOWPayments] IPN secret not configured");
    return false;
  }

  const sorted = sortObject(body);
  const signString = JSON.stringify(sorted);
  const expectedSignature = crypto
    .createHmac("sha512", secret)
    .update(signString)
    .digest("hex");

  const matches = expectedSignature === receivedSignature;
  if (!matches) {
    console.warn(
      `[NOWPayments] Signature mismatch. Expected: ${expectedSignature.substring(0, 16)}..., Received: ${receivedSignature.substring(0, 16)}...`
    );
  }
  return matches;
}

/**
 * Check if NOWPayments is configured (API key exists).
 */
export function isConfigured(): boolean {
  return !!process.env.NOWPAYMENTS_API_KEY;
}
