import { garageAdminApi, API_URL } from "@/lib/api";

export interface WalletListItem {
  orgId: string;
  orgName: string;
  orgSlug: string;
  founderEmail: string | null;
  balance: number;
  debt: number;
  lastTransactionAt: string | null;
  orgDeleted?: boolean;
}

export interface WalletStats {
  totalOrgs: number;
  totalBalance: number;
  totalDebt: number;
  orgsWithDebt: number;
}

export interface WalletTransaction {
  _id: string;
  walletId: string;
  orgId: string;
  type: "credit" | "debit" | "clear_debt";
  amount: number;
  balanceAfter: number;
  debtAfter: number;
  source: "user" | "admin" | "system";
  adminEmail?: string;
  description: string;
  note?: string;
  createdAt: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

export interface OrgWalletDetail {
  org: { _id: string; name: string; slug: string; founderEmail: string | null };
  wallet: { orgId: string; balance: number; debt: number; lastTransactionAt: string | null };
  transactions: WalletTransaction[];
}

export interface ListFilters {
  limit?: number;
  skip?: number;
  sort?: "balance" | "debt" | "lastActivity";
  order?: "asc" | "desc";
  hasDebt?: boolean;
  minDebt?: number;
  search?: string;
  /** Universal header search — matches org name/slug + founder name/email. */
  q?: string;
}

export interface LedgerFilters {
  limit?: number;
  skip?: number;
  dateFrom?: string;
  dateTo?: string;
  types?: Array<"credit" | "debit" | "clear_debt">;
  sources?: Array<"user" | "admin" | "system">;
  orgIds?: string[];
}

export interface LedgerResult extends PagedResult<WalletTransaction & { orgName: string; orgSlug: string; orgDeleted?: boolean }> {
  totalIn: number;
  totalOut: number;
}

function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
    } else {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function listWallets(f: ListFilters = {}): Promise<PagedResult<WalletListItem>> {
  return garageAdminApi(`/garage-admin/wallets${qs(f)}`);
}

export async function getWalletStats(): Promise<WalletStats> {
  return garageAdminApi("/garage-admin/wallets/stats");
}

export async function getOrgWallet(orgId: string): Promise<OrgWalletDetail> {
  return garageAdminApi(`/garage-admin/wallets/${orgId}`);
}

export async function getOrgWalletTransactions(
  orgId: string,
  opts: { limit?: number; skip?: number } = {}
): Promise<PagedResult<WalletTransaction>> {
  return garageAdminApi(`/garage-admin/wallets/${orgId}/transactions${qs(opts)}`);
}

export async function creditOrgWallet(
  orgId: string,
  body: { amountCents: number; note?: string },
  idempotencyKey: string
): Promise<{ wallet: any }> {
  return garageAdminApi(`/garage-admin/wallets/${orgId}/credit`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function debitOrgWallet(
  orgId: string,
  body: { amountCents: number; note: string },
  idempotencyKey: string
): Promise<{ wallet: any }> {
  return garageAdminApi(`/garage-admin/wallets/${orgId}/debit`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function clearOrgDebt(
  orgId: string,
  body: { note: string },
  idempotencyKey: string
): Promise<{ wallet: any }> {
  return garageAdminApi(`/garage-admin/wallets/${orgId}/clear-debt`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function bulkCredit(body: {
  amountCents: number;
  note?: string;
  filter: { createdBefore?: string; country?: string; hasDebt?: boolean };
}): Promise<{ succeeded: number; failed: number; errors: Array<{ orgId: string; error: string }>; orgIds: string[] }> {
  return garageAdminApi("/garage-admin/wallets/bulk-credit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getLedger(f: LedgerFilters = {}): Promise<LedgerResult> {
  return garageAdminApi(`/garage-admin/wallets/ledger${qs(f)}`);
}

/** CSV export — returns a blob URL the caller can navigate to.
 * EventSource-style limitation: native <a download> can't carry custom headers,
 * so we fetch the CSV with the admin token and synthesize an object URL.
 */
export async function fetchLedgerCsv(f: LedgerFilters = {}): Promise<string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_admin_token") : null;
  if (!token) throw new Error("Not signed in as admin");
  const res = await fetch(`${API_URL}/garage-admin/wallets/ledger/export.csv${qs(f)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
