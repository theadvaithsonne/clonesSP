import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

// ─── Types ─────────────────────────────────────────────────────────────

export interface EligibilityCandidate {
  userId: string;
  name?: string;
  email: string;
  balance: number;
  eligible: boolean;
}

export interface PendingCouponOffer {
  _id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  priceUsd: number;
  message?: string;
  orgId: string;
  couponSource: "platform" | "legacy";
  couponCode: string;
  coupon: {
    _id: string;
    code: string;
    name: string;
    description?: string;
    productType: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    maxDiscountAmount?: number;
    currency: "USD" | "INR";
    cycleCount?: number;
    validUntil?: string;
  } | null;
  counterparty: {
    _id: string;
    name?: string;
    email: string;
    profilePicture?: string;
  } | null;
  createdAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const err: any = new Error(data?.error || `HTTP ${res.status}`);
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─── Endpoints ─────────────────────────────────────────────────────────

/**
 * Free gift (no money) — instant transfer, no approval. Matches current
 * behaviour. Pass `priceUsd` to switch into the paid flow below.
 */
export async function giftReward(
  assignmentId: string,
  body: { recipientEmail: string; message?: string }
) {
  const res = await fetch(`${API_URL}/me/rewards/${assignmentId}/gift`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

/**
 * Paid offer — creates a PendingCouponGift. Recipient must approve before
 * wallet + coupon move.
 */
export async function createPaidCouponOffer(
  assignmentId: string,
  body: {
    recipientEmail: string;
    priceUsd: number;
    orgId: string;
    message?: string;
  }
) {
  const res = await fetch(`${API_URL}/me/rewards/${assignmentId}/gift`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

export async function listIncomingOffers(): Promise<{
  offers: PendingCouponOffer[];
}> {
  const res = await fetch(`${API_URL}/me/rewards/offers/incoming`, {
    headers: authHeaders(),
  });
  return jsonOrThrow(res);
}

export async function listOutgoingOffers(): Promise<{
  offers: PendingCouponOffer[];
}> {
  const res = await fetch(`${API_URL}/me/rewards/offers/outgoing`, {
    headers: authHeaders(),
  });
  return jsonOrThrow(res);
}

export async function approveCouponOffer(offerId: string) {
  const res = await fetch(`${API_URL}/me/rewards/offers/${offerId}/approve`, {
    method: "POST",
    headers: authHeaders(),
  });
  return jsonOrThrow(res);
}

export async function rejectCouponOffer(offerId: string) {
  const res = await fetch(`${API_URL}/me/rewards/offers/${offerId}/reject`, {
    method: "POST",
    headers: authHeaders(),
  });
  return jsonOrThrow(res);
}

export async function cancelCouponOffer(offerId: string) {
  const res = await fetch(`${API_URL}/me/rewards/offers/${offerId}/cancel`, {
    method: "POST",
    headers: authHeaders(),
  });
  return jsonOrThrow(res);
}

/**
 * Search candidate recipients for a paid offer. Returns each candidate's
 * store wallet balance in the supplied org plus an `eligible` flag the UI
 * uses to grey out users with insufficient balance.
 */
export async function searchRecipientEligibility(args: {
  q: string;
  orgId: string;
  priceUsd: number;
}): Promise<{ candidates: EligibilityCandidate[] }> {
  const params = new URLSearchParams({
    q: args.q,
    orgId: args.orgId,
    priceUsd: String(args.priceUsd),
  });
  const res = await fetch(
    `${API_URL}/me/rewards/offers/recipient-eligibility?${params.toString()}`,
    { headers: authHeaders() }
  );
  return jsonOrThrow(res);
}
