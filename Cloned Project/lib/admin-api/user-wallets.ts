import { garageAdminApi } from "@/lib/api";

/**
 * Powers the "User Wallets" admin page — a global list of every user × every
 * wallet (store one row per org, plus one row each for affiliate +
 * content_rewards). Pair with `getUserWallets()` (per-user detail) to load
 * full account data when the admin clicks Withdraw.
 */

export type UserWalletType = "store" | "affiliate" | "content_rewards";

export interface UserWalletRow {
  walletId: string;
  walletType: UserWalletType;
  user: {
    _id: string;
    name?: string;
    email?: string;
    profilePicture?: string | null;
    country?: string | null;
  };
  orgId: string | null;
  orgName: string | null;
  /** USD (float) — content_rewards is already normalized from cents server-side. */
  balance: number;
  currency: string;
  lastTransactionAt: string | null;
  /** Whether the user has attached a payout account for this wallet slot. */
  hasAccount: boolean;
}

export interface UserWalletsListResult {
  items: UserWalletRow[];
  total: number;
  limit: number;
  offset: number;
  /** Countries present before the country filter — drives the dropdown. */
  countries?: UserWalletCountry[];
  /** The with/without payout split, counted before either filter applies. */
  payoutCounts?: { withAccount: number; withoutAccount: number };
}

export interface UserWalletsListFilters {
  q?: string;
  type?: UserWalletType | "all";
  sort?: "balance" | "name" | "activity";
  hasFunds?: boolean;
  /** Free-text country name; matched case- and whitespace-insensitively. */
  country?: string;
  /** "yes" = payout destination saved, "no" = none saved yet. */
  payout?: "any" | "yes" | "no";
  limit?: number;
  offset?: number;
}

/** One entry of the country dropdown, most populated first. */
export interface UserWalletCountry {
  country: string;
  count: number;
}

function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") {
      if (v) sp.set(k, "1");
      continue;
    }
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function listAllUserWallets(
  filters: UserWalletsListFilters = {}
): Promise<UserWalletsListResult> {
  const res = await garageAdminApi<{
    success: boolean;
    data: UserWalletsListResult;
  }>(`/garage-admin/user-wallets${qs(filters)}`);
  return res.data;
}
