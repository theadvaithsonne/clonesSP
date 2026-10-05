import { api } from "./api";

// ─── Saved-payment-methods API wrappers (phase 1: Stripe) ─────────────
//
// Backs the /settings/payment-methods page and the saved-card row on
// PaymentMethodSelector. Every card entry still happens inside Stripe
// Elements — these endpoints only manage the tokenized reference on our
// User doc.

export interface SavedStripeMethod {
  id: string; // pm_xxx
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  // ISO-2 issuer country from Stripe (`card.country`). Drives the
  // currency filter in the picker (INR shows "IN"; USD shows non-IN).
  // Null on legacy rows saved before we started capturing it.
  country: string | null;
  // RBI e-mandate metadata — present when this card was authorized
  // for zero-OTP off-session INR charges up to `mandateAmount` paise.
  // Only Indian issuer cards get a mandate; foreign cards leave these
  // null.
  mandateId: string | null;
  mandateAmount: number | null;
  mandateStatus: string | null; // "active" | "inactive" | "pending"
  isDefault: boolean;
  addedAt: string;
}

export interface SavedRazorpayToken {
  id: string; // token_xxx
  method: string; // "card" | "upi"
  last4: string | null;
  network: string | null;
  issuer: string | null;
  expMonth: number | null;
  expYear: number | null;
  /** Paise ceiling for any single debit on this token. */
  maxAmount: number | null;
  expireAt: string | null;
  /**
   * UPI Autopay. Present only when `method === "upi"`.
   *
   * `vpa` is the payer's UPI handle — the only human-recognisable identifier
   * for a UPI token, since there is no card number to show.
   *
   * `mandateStatus` is the payer's standing authority, which is NOT the same
   * as the token existing: they can revoke it in their UPI app and the row
   * remains. Anything other than "active" means we cannot auto-debit.
   */
  vpa?: string | null;
  mandateId?: string | null;
  mandateStatus?: "active" | "paused" | "revoked" | "pending" | null;
  mandateExpiresAt?: string | null;
  isDefault: boolean;
  addedAt: string;
}

export interface PaymentMethodsResponse {
  success: true;
  stripe: {
    customerId: string | null;
    methods: SavedStripeMethod[];
  };
  razorpay: {
    customerId: string | null;
    tokens: SavedRazorpayToken[];
  };
}

export function listPaymentMethods(): Promise<PaymentMethodsResponse> {
  return api<PaymentMethodsResponse>("/payment-methods", { method: "GET" });
}

export interface SetupIntentResponse {
  success: true;
  clientSecret: string;
  setupIntentId: string;
  customerId: string;
  publishableKey: string;
}

export function createStripeSetupIntent(): Promise<SetupIntentResponse> {
  return api<SetupIntentResponse>("/payment-methods/stripe/setup-intent", {
    method: "POST",
  });
}

export function deleteStripePaymentMethod(
  pmId: string,
): Promise<{ success: true; removed: boolean }> {
  return api(`/payment-methods/stripe/${pmId}`, { method: "DELETE" });
}

export function setStripeDefaultPaymentMethod(
  pmId: string,
): Promise<{ success: true }> {
  return api(`/payment-methods/stripe/${pmId}/default`, { method: "PATCH" });
}

// ─── Razorpay (phase 2) ────────────────────────────────────────────────

export interface RazorpaySaveCardOrderResponse {
  success: true;
  orderId: string;
  keyId: string;
  customerId: string;
  amount: number;
  currency: string;
}

/**
 * Create a ₹1 auth order for saving a card via Standard Checkout. The
 * FE then opens Razorpay with `save: 1` + this `customer_id`. On
 * capture, the BE webhook auto-refunds and `token.confirmed` persists
 * the saved card onto the User doc.
 */
export function createRazorpaySaveCardOrder(): Promise<RazorpaySaveCardOrderResponse> {
  return api<RazorpaySaveCardOrderResponse>(
    "/payment-methods/razorpay/save-card-order",
    { method: "POST" },
  );
}

export function deleteRazorpayToken(
  tokenId: string,
): Promise<{ success: true; removed: boolean }> {
  return api(`/payment-methods/razorpay/${tokenId}`, { method: "DELETE" });
}

export function setRazorpayDefaultToken(
  tokenId: string,
): Promise<{ success: true }> {
  return api(`/payment-methods/razorpay/${tokenId}/default`, {
    method: "PATCH",
  });
}
