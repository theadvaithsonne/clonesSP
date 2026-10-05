// Admin API wrappers for the Saved Cards tab on
// /garage-admin/one-time-affiliates/[userId]. Backs
// routes/garageAdminSavedCards.ts. Super-admin only.

import { garageAdminApi } from "@/lib/api";

export interface AdminSavedStripeMethod {
  id: string; // pm_xxx
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  country: string | null;
  mandateId: string | null;
  mandateAmount: number | null;
  mandateStatus: string | null;
  isDefault: boolean;
  addedAt: string;
}

/**
 * A UPI Autopay mandate — the Razorpay counterpart to a saved card.
 *
 * `maxAmount` is the PER-DEBIT ceiling in paise, sized to the plan the mandate
 * was registered for, and is the constraint that decides whether a given
 * ad-hoc amount is chargeable at all.
 */
export interface AdminUpiMandate {
  id: string; // token_xxx
  vpa: string | null;
  mandateId: string | null;
  mandateStatus: string | null; // active | pending | paused | revoked
  maxAmount: number | null; // paise
  mandateExpiresAt: string | null;
  isDefault: boolean;
  addedAt: string;
  /** Active and unexpired — only these can actually be debited. */
  chargeable: boolean;
}

export interface AdminSavedCardsResponse {
  success: true;
  stripe: {
    customerId: string | null;
    methods: AdminSavedStripeMethod[];
  };
  /** Absent on older backends — treat as no mandates. */
  razorpay?: {
    customerId: string | null;
    mandates: AdminUpiMandate[];
  };
}

export function fetchAdminSavedCards(
  userId: string,
): Promise<AdminSavedCardsResponse> {
  return garageAdminApi(`/garage-admin/users/${userId}/saved-cards`);
}

export function setAdminDefaultCard(
  userId: string,
  pmId: string,
): Promise<{ success: true; modified: number }> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/saved-cards/${pmId}/default`,
    { method: "PATCH" },
  );
}

export function deleteAdminCard(
  userId: string,
  pmId: string,
): Promise<{ success: true }> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/saved-cards/${pmId}`,
    { method: "DELETE" },
  );
}

// ─── Product picker (per-org) ─────────────────────────────────────

export interface AdminOrgProduct {
  _id: string;
  name: string;
  price: number; // in smallest unit (paise/cents)
  currency: string;
  isDigital: boolean;
  gstInclusive: boolean;
  image: string | null;
}

export function fetchAdminOrgProducts(
  orgId: string,
): Promise<{ success: true; products: AdminOrgProduct[] }> {
  return garageAdminApi(`/garage-admin/orgs/${orgId}/products`);
}

// ─── Charge ────────────────────────────────────────────────────────

export type AdminChargeStatus =
  | "succeeded"
  | "processing"
  | "requires_action"
  | "failed";

export interface AdminChargeResponse {
  success: boolean;
  status: AdminChargeStatus;
  paymentIntentId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  clientSecret?: string;
  invoiceUrl?: string;
  note?: string;
  error?: string;
}

export function chargeAdminSavedCard(
  userId: string,
  pmId: string,
  body: { orgId: string; productId: string },
): Promise<AdminChargeResponse> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/saved-cards/${pmId}/charge`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

// ─── Refund ────────────────────────────────────────────────────────

export interface AdminRefundableCharge {
  invoiceId: string;
  invoiceNumber: string;
  paidAt: string;
  amount: number; // smallest unit
  currency: string;
  itemName?: string;
  paymentIntentId: string;
  paymentMethodId?: string;
  /** True when this charge was made on the exact PM we listed by. */
  matchedPm: boolean;
}

export function fetchAdminRefundableCharges(
  userId: string,
  pmId: string,
): Promise<{ success: true; charges: AdminRefundableCharge[] }> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/saved-cards/${pmId}/refundable-charges`,
  );
}

export function refundAdminCharge(
  userId: string,
  paymentIntentId: string,
): Promise<{
  success: true;
  refund: { id: string; status: string; amount: number; currency: string };
  invoiceId: string;
  note?: string;
}> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/saved-cards/refund`,
    {
      method: "POST",
      body: JSON.stringify({ paymentIntentId }),
    },
  );
}

// ─── Subscriptions ────────────────────────────────────────────────

export type SubscriptionPeriod =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface AdminSubscribableItem {
  itemType: "product" | "channel";
  _id: string;
  name: string;
  price: number; // smallest unit
  currency: string;
  subscriptionPeriod: SubscriptionPeriod;
  gstInclusive: boolean;
  image: string | null;
}

export function fetchAdminSubscribableItems(
  orgId: string,
): Promise<{ success: true; items: AdminSubscribableItem[] }> {
  return garageAdminApi(
    `/garage-admin/orgs/${orgId}/subscribable-items`,
  );
}

export interface AdminSubscriptionResponse {
  success: boolean;
  status: AdminChargeStatus;
  paymentIntentId?: string;
  clientSecret?: string;
  invoiceUrl?: string;
  chargeMode?: string;
  subscription?: {
    invoiceId: string;
    invoiceNumber: string;
    itemType: "product" | "channel";
    itemId: string;
    itemName: string;
    subscriptionPeriod: SubscriptionPeriod;
    amountPerCycle: number;
    currency: string;
    nextDueDate: string;
  };
  note?: string;
  error?: string;
}

export function startAdminSubscription(
  userId: string,
  pmId: string,
  body: {
    orgId: string;
    itemType: "product" | "channel";
    itemId: string;
  },
): Promise<AdminSubscriptionResponse> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/saved-cards/${pmId}/start-subscription`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

// ─── Ad-hoc charge (arbitrary amount + description) ──────────────

export interface AdminAdhocChargeResponse {
  success: boolean;
  status: AdminChargeStatus;
  paymentIntentId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  clientSecret?: string;
  invoiceUrl?: string;
  amount?: number;
  currency?: string;
  description?: string;
  note?: string;
  error?: string;
}

export function chargeAdminAdhoc(
  userId: string,
  pmId: string,
  body: {
    orgId: string;
    amount: number; // whole units (e.g. 12.50)
    currency: "USD" | "INR";
    description: string;
  },
): Promise<AdminAdhocChargeResponse> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/saved-cards/${pmId}/charge-adhoc`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

// ─── Admin-initiated add-card link ────────────────────────────────

export interface AdminAddCardLinkResponse {
  success: true;
  url: string;
  token: string;
  expiresAt: string;
  setupIntentId: string;
  recipient: {
    userId: string;
    email: string | null;
    name: string | null;
  };
}

/**
 * Mint a save-card link the admin can share with the user. The user
 * opens the URL on their own device, enters their card via Stripe
 * Elements + confirms the RBI mandate, and the existing
 * `setup_intent.succeeded` webhook persists the PM to their User doc
 * — no charge involved. Same mandate footprint as the user's own
 * settings-page save-card flow, so Indian cards land ready for
 * zero-OTP admin charges going forward.
 */
export function createAdminAddCardLink(
  userId: string,
): Promise<AdminAddCardLinkResponse> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/saved-cards/create-add-link`,
    { method: "POST" },
  );
}

// ─── UPI Autopay mandate charge ───────────────────────────────────

export interface AdminUpiChargeResponse {
  success: boolean;
  /**
   * "pending" is NOT a failure: above the RBI no-AFA threshold the customer
   * must approve the debit in their UPI app, so it settles asynchronously via
   * webhook. Surface the returned `note` rather than inventing copy.
   */
  status: "succeeded" | "pending" | "failed";
  paymentId?: string | null;
  invoiceId?: string;
  invoiceNumber?: string;
  amount?: number; // paise
  currency?: "INR";
  description?: string;
  note?: string;
  error?: string;
}

export function chargeAdminUpiMandate(
  userId: string,
  tokenId: string,
  body: {
    orgId: string;
    amount: number; // whole units (e.g. 12.50)
    currency: "USD" | "INR";
    description: string;
  },
): Promise<AdminUpiChargeResponse> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/upi-mandates/${tokenId}/charge-adhoc`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

// ── Garage's own paid products ────────────────────────────────────────
//
// `subscribable-items` above lists an ORG's products/channels. These list and
// bill the PLATFORM's products — Unilevel Plus, NetworkChain, Office Pro —
// which each activate differently and so have their own endpoint rather than
// being squeezed into `start-subscription`.

export interface PlatformBillableItem {
  itemType: "unilevel_plus" | "third_party" | "office_plan";
  name: string;
  /** "one_time" hides the free-cycle control — a $0 licence is a comp. */
  kind: "one_time" | "recurring";
  /** Smallest unit, same convention as AdminSubscribableItem. */
  price: number;
  currency: string;
  subscriptionPeriod?: "monthly";
  terms?: Array<{ termMonths: number; label: string; price: number }>;
  orgs?: Array<{ _id: string; name: string }>;
  eligible: boolean;
  /** Why the row is disabled. Null when eligible. */
  reason: string | null;
  /** NetworkChain needs a licence; without one we sell both together. */
  requiresCombo?: boolean;
  comboPrice?: number;
}

export function fetchPlatformBillableItems(
  userId: string,
): Promise<{ success: true; items: PlatformBillableItem[] }> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/billable-platform-items`,
  );
}

export function billPlatformItem(
  userId: string,
  pmId: string,
  body: {
    itemType: "unilevel_plus" | "third_party" | "office_plan";
    orgId?: string;
    termMonths?: number;
    freeCycles?: number;
  },
): Promise<AdminSubscriptionResponse & { freeCycle?: boolean }> {
  return garageAdminApi(
    `/garage-admin/users/${userId}/saved-cards/${pmId}/bill-platform-item`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
