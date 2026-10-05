import { garageAdminApi } from "@/lib/api";

export type WithdrawalStatus = "initiated" | "completed" | "rejected";

export interface AdminWithdrawal {
  id: string;
  user: {
    id: string;
    name?: string;
    email?: string;
    profilePicture?: string | null;
  };
  walletType: "store" | "affiliate" | "content_rewards";
  walletLabel: string;
  orgId: string | null;
  orgName: string | null;
  accountType: "bank" | "crypto";
  account: {
    type: "bank" | "crypto";
    label: string;
    bankName: string;
    accountNumber: string;
    cryptoNetwork: string;
    cryptoAddress: string;
  };
  grossAmount: number; // cents
  feeAmount: number;   // cents
  feePercent: number;
  /** Bank's own charge, cents. Deducted from the payout, never our revenue. */
  bankTransferFee: number;
  /** fee + taxes — what the platform actually keeps. Excludes the bank's cut. */
  platformRetains: number;
  /**
   * Why `feePercent` is what it is (affiliate wallet only): the user's
   * daily/weekly choice and whether they keep $50 in the wallet. Snapshotted
   * when the withdrawal was initiated, so a later preference change never
   * rewrites what was charged.
   */
  feeTier: {
    frequency: "daily" | "weekly" | null;
    keepAmountCents: number | null;
    meetsKeepThreshold: boolean;
    configured: boolean;
    payoutMethod: "bank" | "crypto" | null;
  } | null;
  /** Set only when a super admin overrode the fee or released locked funds. */
  adminOverride: {
    tierFeePercent: number | null;
    appliedFeePercent: number | null;
    gatedCapCents: number | null;
    walletBalanceCents: number | null;
    releasedCents: number | null;
    lockedByMaturityCents: number | null;
    lockedByLicenceCents: number | null;
    reason: string | null;
    at: string | null;
  } | null;
  taxes: { label: string; type: "percent" | "flat"; value: number; amount: number }[];
  taxTotal: number;    // cents
  netAmount: number;   // cents
  currency: string;
  status: WithdrawalStatus;
  receiptUrl: string;
  rejectionReason: string;
  createdAt: string;
  processedAt: string | null;
}

export interface WithdrawalsResult {
  items: AdminWithdrawal[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
}

export interface WithdrawalStats {
  pending: number;
  pendingAmount: number; // cents
  completed: number;
  rejected: number;
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

// All endpoints return the ok() envelope { success, data } — unwrap .data.

export async function listWithdrawals(
  filters: { status?: string; search?: string; skip?: number; limit?: number } = {}
): Promise<WithdrawalsResult> {
  const res = await garageAdminApi<{ success: boolean; data: WithdrawalsResult }>(
    `/garage-admin/withdrawals${qs(filters)}`
  );
  return res.data;
}

export async function getWithdrawalStats(): Promise<WithdrawalStats> {
  const res = await garageAdminApi<{ success: boolean; data: WithdrawalStats }>(
    `/garage-admin/withdrawals/stats`
  );
  return res.data;
}

/** What a withdrawal would cost, before committing to it. */
export interface WithdrawalQuote {
  grossCents: number;
  feePercent: number;
  feeCents: number;
  bankTransferFeeCents: number;
  taxes: { label: string; type: "percent" | "flat"; value: number; amount: number }[];
  taxTotalCents: number;
  netCents: number;
  /** fee + taxes. The bank's cut is not ours and is excluded. */
  platformRetainsCents: number;
  feeTier: AdminWithdrawal["feeTier"];
  availableCents: number;
  keepAmountCents: number;
  payableAfterKeepCents: number;
  keepThresholdCents: number;
  sufficient: boolean;
  payoutMethod: "bank" | "crypto";
  /** Why the cap is what it is — drives the "what's held back" panel. */
  breakdown?: WithdrawableBreakdown;
  /** The most that may be withdrawn given the overrides in play. */
  ceilingCents?: number;
  feeOverridden?: boolean;
  /** The member's own fee tier, before any override. */
  tierFeePercent?: number;
  releasingLockedFunds?: boolean;
}

/**
 * The two locks on an affiliate wallet, priced.
 *
 * They overlap, so `lockedByMaturity + lockedByLicence` is NOT the total held
 * back — show them as separate reasons, never as a sum.
 */
export interface WithdrawableBreakdown {
  balanceCents: number;
  withdrawableCents: number;
  maturedCents: number;
  redeemableCents: number;
  lockedByMaturityCents: number;
  lockedByLicenceCents: number;
  maturityCutoff: string | null;
  hasLicence: boolean;
}

/** Super-admin, one withdrawal only. Never saved to the member's preference. */
export interface WithdrawalOverrides {
  feePercent?: number;
  releaseLockedFunds?: boolean;
  reason?: string;
}

export async function quoteWithdrawal(body: {
  userId: string;
  walletType: string;
  orgId?: string | null;
  accountId?: string;
  amountCents: number;
  taxes?: { label: string; type: "percent" | "flat"; value: number }[];
  bankTransferFeeCents?: number;
  overrides?: WithdrawalOverrides;
}): Promise<WithdrawalQuote> {
  const res = await garageAdminApi<{ success: boolean; data: WithdrawalQuote }>(
    `/garage-admin/withdrawals/quote`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function initiateWithdrawal(body: {
  userId: string;
  walletType: string;
  orgId?: string | null;
  accountId: string;
  amountCents: number;
  taxes?: { label: string; type: "percent" | "flat"; value: number }[];
  /** What the bank charges to send it. Bank payouts only. */
  bankTransferFeeCents?: number;
  overrides?: WithdrawalOverrides;
}): Promise<AdminWithdrawal> {
  const res = await garageAdminApi<{ success: boolean; data: AdminWithdrawal }>(
    `/garage-admin/withdrawals`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function completeWithdrawal(
  id: string,
  receiptUrl?: string
): Promise<AdminWithdrawal> {
  const res = await garageAdminApi<{ success: boolean; data: AdminWithdrawal }>(
    `/garage-admin/withdrawals/${id}/complete`,
    { method: "POST", body: JSON.stringify({ receiptUrl }) }
  );
  return res.data;
}

export async function rejectWithdrawal(
  id: string,
  reason?: string
): Promise<AdminWithdrawal> {
  const res = await garageAdminApi<{ success: boolean; data: AdminWithdrawal }>(
    `/garage-admin/withdrawals/${id}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
  return res.data;
}

// ── Withdrawal preferences (Vaults → Withdrawals → Preferences tab) ──────
// Standing payout instructions users set on their wallets, with what is due
// against each right now. Read-only: the team initiates withdrawals from the
// queue as before.

export type WithdrawalFrequency = "weekly" | "daily";

export interface WithdrawalPreferenceRow {
  id: string;
  user: {
    _id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    profilePicture: string | null;
    country: string | null;
  };
  walletType: "store" | "affiliate" | "content_rewards";
  org: { id: string; name: string | null; icon: string | null } | null;
  frequency: WithdrawalFrequency;
  /** Cents left in the wallet each payout. Counts on daily AND weekly. */
  keepAmountCents: number | null;
  withdrawableCents: number;
  /** withdrawable − keep, floored at 0. */
  dueCents: number;
  /** Garage processing fee this instruction earns. 0 for non-affiliate wallets. */
  feePercent: number;
  feeOnDueCents: number;
  netOnDueCents: number;
  feeTier: {
    frequency: WithdrawalFrequency;
    keepAmountCents: number;
    meetsKeepThreshold: boolean;
    feePercent: number;
    configured: boolean;
  } | null;
  keepThresholdCents: number;
  nextRunAt: string;
  updatedAt: string;
}

export interface WithdrawalPreferencesResult {
  items: WithdrawalPreferenceRow[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
  stats: {
    total: number;
    weekly: number;
    daily: number;
    dueNow: number;
    dueAmountCents: number;
    /** Garage processing fee across everything currently due. */
    feeAmountCents: number;
    nextFriday: string;
  };
}

export async function listWithdrawalPreferences(
  filters: { frequency?: WithdrawalFrequency | "all"; due?: boolean; search?: string; skip?: number; limit?: number } = {}
): Promise<WithdrawalPreferencesResult> {
  const res = await garageAdminApi<{ success: boolean; data: WithdrawalPreferencesResult }>(
    `/garage-admin/withdrawal-preferences${qs({ ...filters, due: filters.due ? 1 : undefined })}`
  );
  return res.data;
}
