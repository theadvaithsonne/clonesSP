import { garageAdminApi } from "@/lib/api";

export interface AdminUserOffice {
  id: string;
  name: string;
  role: string;
  /** Org logo (square icon) for the office chip; null when unset. */
  logo?: string | null;
}

export interface AdminUserUpline {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
}

export interface AdminUserOfferWindow {
  windowStartsAt: string | null;
  windowExpiresAt: string | null;
  windowOpen: boolean;
  secondsRemaining: number;
  completed: boolean;
  status: "not_started" | "pending" | "expired" | "completed";
  extendedByAdmin: boolean;
  extendedAt: string | null;
  extendedByAdminId: string | null;
}

export interface AdminUserListItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  affiliateId: string | null;
  /** Email verification — separates "delete unverified" from "delete verified". */
  isVerified: boolean;
  phoneVerified: boolean;
  profileComplete: boolean;
  location: {
    country: string | null;
    state: string | null;
    city: string | null;
  };
  upline: AdminUserUpline | null;
  offices: AdminUserOffice[];
  createdAt: string;
  typeFlags: Record<string, boolean>;
  directsCount: number;
  downlineCount: number;
  twentyFourHourOffer: AdminUserOfferWindow;
  purchases: {
    volumeUsd: number;
    purchaseCount: number;
    productCount: number;
  };
  commissionsGenerated: {
    totalUsd: number;
    count: number;
  };
}

export interface AdminUsersResult {
  items: AdminUserListItem[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
}

export interface AdminWalletAccount {
  _id: string;
  walletType: "store" | "affiliate" | "content_rewards";
  accountType: "bank" | "crypto";
  label: string;
  // bank
  country: string;
  bankName: string;
  accountNumber: string;
  swiftCode: string;
  routingNumber: string;
  ibanNumber: string;
  beneficiaryName: string;
  // crypto
  cryptoNetwork: string;
  cryptoAddress: string;
  cryptoMemo: string;
}

export interface AdminUserWallet {
  walletType: "store" | "affiliate" | "content_rewards";
  orgId: string | null;
  orgName: string | null;
  balance: number;
  withdrawableBalance: number; // cents
  currency: string;
  accounts: AdminWalletAccount[];
}

export interface AdminUplineRef {
  id: string;
  name: string;
  email: string;
  profilePicture: string | null;
  affiliateId: string | null;
}

export interface AdminUserWallets {
  user: {
    id: string;
    name: string;
    email: string;
    profilePicture: string | null;
    affiliateId: string | null;
    offices: AdminUserOffice[];
    upline: AdminUplineRef | null;
    directReferrals: number;
  };
  wallets: AdminUserWallet[];
}

export interface MoveUplineResult {
  member: { id: string; name: string; email: string };
  previousUpline: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string | null;
    affiliateId?: string | null;
  } | null;
  newUpline: AdminUplineRef;
  directReferralsMoved: number;
  /**
   * Outcome of the optional commission sweep. Null when `moveCommissions` was
   * not requested. The move can succeed while the sweep declines or fails, so
   * this is reported separately — never assume money moved because the request
   * returned 200.
   */
  commissionMove?: {
    status: "applied" | "skipped" | "blocked" | "failed";
    reason?: string;
    /** Total clawed back from the old chain, in dollars. */
    reversalTotal?: number;
    /** False when the re-distribution didn't reconcile to the sale amount. */
    balanced?: boolean;
    /** Negative = platform gave money back to the network. */
    platformDelta?: number;
    newDistributionId?: string;
  } | null;
}

function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// Both endpoints return the ok() envelope { success, data }, so unwrap .data.

export async function listUsers(
  filters: {
    search?: string;
    skip?: number;
    limit?: number;
    // Backend defaults to a prospecting view (hides users who already
    // activated the $25 UP sub). Pass true to show everyone.
    includeActivated?: boolean;
    /**
     * Per-column filters. Applied server-side because this endpoint
     * paginates — filtering the returned page in the browser would search
     * ~30 of ~1,900 users. Only columns backed by a stored field are
     * supported; see the controller.
     */
    fName?: string;
    fLocation?: string;
    fActivated?: string;
    // Open View: scope the list to a specific user's downline. The backend
    // narrows to everyone with this id in their ancestors path.
    rootUserId?: string;
  } = {}
): Promise<AdminUsersResult> {
  const res = await garageAdminApi<{ success: boolean; data: AdminUsersResult }>(
    `/garage-admin/users${qs(filters)}`
  );
  return res.data;
}

export async function getUserWallets(userId: string): Promise<AdminUserWallets> {
  const res = await garageAdminApi<{ success: boolean; data: AdminUserWallets }>(
    `/garage-admin/users/${userId}/wallets`
  );
  return res.data;
}

// Extend (or re-open) a user's 24-hour welcome-offer window. `hours` counts
// from now (1–720). Backend never shortens an existing window. Returns the
// recomputed offer window so the caller can refresh the row in place.
export async function extendUserOffer(
  userId: string,
  hours: number
): Promise<Partial<AdminUserOfferWindow>> {
  const res = await garageAdminApi<{
    success: boolean;
    data: { twentyFourHourOffer: Partial<AdminUserOfferWindow> };
  }>(`/garage-admin/users/${userId}/extend-offer`, {
    method: "POST",
    body: JSON.stringify({ hours }),
  });
  return res.data.twentyFourHourOffer;
}

/**
 * Re-parent a member under a new upline. Only affects future commissions —
 * the historical ledger is immutable. Throws with the server's message on any
 * validation failure (self-referral, cycle, no-op, not found).
 */
export async function moveUpline(
  userId: string,
  newReferrerId: string,
  opts: {
    /**
     * Also re-point the member's ALREADY-PAID Unilevel Plus commission at the
     * new upline. Defaults false on the server — a move otherwise only affects
     * future earnings. Turning it on reverses the original distribution and
     * re-runs it down the new chain, moving real money between wallets.
     */
    moveCommissions?: boolean;
  } = {}
): Promise<MoveUplineResult> {
  const res = await garageAdminApi<{ success: boolean; data: MoveUplineResult }>(
    `/garage-admin/users/${userId}/move-upline`,
    {
      method: "POST",
      body: JSON.stringify({
        newReferrerId,
        ...(opts.moveCommissions ? { moveCommissions: true } : {}),
      }),
    }
  );
  return res.data;
}

/** A hit from the admin user-search picker. */
export type AdminUserSuggestion = {
  _id: string;
  name: string | null;
  email: string;
  profilePicture?: string | null;
};

/**
 * Type-ahead over every verified user, name OR email.
 *
 * Backed by GET /garage-admin/users/search (routes/userSearch.ts), the same
 * endpoint the coupon-assignment picker uses. Returns [] for a blank query
 * rather than the whole user table.
 */
export async function searchUsers(
  q: string,
  limit = 8
): Promise<AdminUserSuggestion[]> {
  const query = q.trim();
  if (!query) return [];
  const res = await garageAdminApi<{
    success: boolean;
    users: AdminUserSuggestion[];
  }>(
    `/garage-admin/users/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { method: "GET" }
  );
  return res?.users || [];
}
