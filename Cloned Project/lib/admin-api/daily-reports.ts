import { garageAdminApi } from "@/lib/api";
import type { DownlinePerson } from "@/components/garage-admin/downline-scope";
import { ymdInTimeZone } from "@/lib/zonedTime";

// Daily Reports — paid sales per buyer inside an IST date window.
// Backs app/garage-admin/(admin-dashboard)/daily-reports. Mirrors the
// response of garagenew-backend routes/garageAdminDailyReports.ts.

export type DailyReportKind = "office" | "unilevel" | "networkchain" | "whitelabel";
export type DailyReportFlag = "cryptobrand_bootstrap" | "legacy_inr_paise" | "paidAt_missing";

export interface DailyReportInvoice {
  id: string;
  invoiceNumber: string;
  /** Buyer-facing page, my.garage.app/invoice/<id>. */
  publicUrl: string;
  kind: DailyReportKind;
  /** "Combo + 3-month", "Renewal · cycle 2", "White-label · self-serve", … */
  tag: string;
  itemName: string;
  paidAt: string;
  /** USD total incl. GST; null only for a legacy row stored in paise. */
  usd: number | null;
  gstUsd: number | null;
  /** What the buyer actually paid when it wasn't in USD. */
  charged: { amount: number; currency: string } | null;
  /** "UPI (Razorpay)", "Card (Stripe)", "Crypto · USDT (BSC)", "Store Vault"… */
  method: string;
  /** Set on crypto payments when the chain transaction is known. */
  txHash: string | null;
  cryptoChain: string | null;
  flags: DailyReportFlag[];
}

export interface DailyReportUser {
  _id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  country: string | null;
  deleted: boolean;
}

export interface DailyReportRow {
  _id: string;
  user: DailyReportUser;
  /** Who referred the buyer (User.referredBy) — same source as NC Subs. */
  upline: DailyReportUser | null;
  location: { city: string | null; state: string | null; country: string | null } | null;
  invoiceCount: number;
  counts: Record<DailyReportKind, number>;
  byKindUsd: Record<DailyReportKind, number>;
  totalUsd: number;
  lastPaidAt: string;
  invoices: DailyReportInvoice[];
}

export interface DailyReportStats {
  users: number;
  invoices: number;
  totalUsd: number;
  officeUsd: number;
  unilevelUsd: number;
  networkchainUsd: number;
  whitelabelUsd: number;
  /** Subset of totalUsd that was settled in crypto (any kind). */
  cryptoUsd: number;
  officeCount: number;
  unilevelCount: number;
  networkchainCount: number;
  whitelabelCount: number;
  cryptoCount: number;
  flagged: number;
}

export interface DailyReportResponse {
  data: DailyReportRow[];
  stats: DailyReportStats;
  pagination: { total: number; limit: number; offset: number };
  range: { from: string; to: string; fromAt: string; toAt: string; timeZone: string };
}

export interface DailyReportsFilters {
  /** IST calendar day, YYYY-MM-DD. */
  from: string;
  to: string;
  kind?: DailyReportKind;
  /** Scope to everyone BELOW this person in the referral tree (?rootUserId). */
  downlineOf?: DownlinePerson | null;
  /** Legs left out of that tree — the people stay, what they recruited doesn't. */
  excludedUsers?: DownlinePerson[];
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

export async function getDailyReports(params: {
  from?: string;
  to?: string;
  kind?: DailyReportKind;
  q?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  rootUserId?: string;
  /** Repeated on the wire, one per excluded person. */
  excludeUserId?: string[];
}): Promise<DailyReportResponse> {
  const { excludeUserId, ...rest } = params;
  const sp = new URLSearchParams(qs(rest).replace(/^\?/, ""));
  // Exceptions only travel with a root — the backend ignores them alone.
  if (rest.rootUserId) for (const id of excludeUserId ?? []) sp.append("excludeUserId", id);
  const query = sp.toString();
  return garageAdminApi<DailyReportResponse>(
    `/garage-admin/daily-reports${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
}

/* ── IST calendar helpers ──────────────────────────────────────────────
 * The report's "day" is an Asia/Kolkata day. Everything here works on
 * "YYYY-MM-DD" strings so the drawer's draft state and the URL never carry a
 * browser-local Date.
 */
export const REPORT_TZ = "Asia/Kolkata";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function istToday(): string {
  const { year, month, day } = ymdInTimeZone(new Date(), REPORT_TZ);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Shift a YYYY-MM-DD by whole days (IST has no DST, so noon arithmetic is exact). */
export function istShift(ymd: string, days: number): string {
  const at = new Date(`${ymd}T12:00:00.000+05:30`);
  at.setUTCDate(at.getUTCDate() + days);
  const { year, month, day } = ymdInTimeZone(at, REPORT_TZ);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function istMonthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function defaultRange(): { from: string; to: string } {
  const today = istToday();
  return { from: istShift(today, -1), to: today };
}

export type RangePresetId =
  | "since_yesterday"
  | "today"
  | "yesterday"
  | "last_7"
  | "last_30"
  | "this_month"
  | "custom";

export const RANGE_PRESETS: {
  id: Exclude<RangePresetId, "custom">;
  label: string;
  short: string;
  range: () => { from: string; to: string };
}[] = [
  { id: "since_yesterday", label: "Since yesterday", short: "Since yesterday", range: defaultRange },
  { id: "today", label: "Today", short: "Today", range: () => ({ from: istToday(), to: istToday() }) },
  {
    id: "yesterday",
    label: "Yesterday",
    short: "Yesterday",
    range: () => ({ from: istShift(istToday(), -1), to: istShift(istToday(), -1) }),
  },
  { id: "last_7", label: "Last 7 days", short: "7d", range: () => ({ from: istShift(istToday(), -6), to: istToday() }) },
  { id: "last_30", label: "Last 30 days", short: "30d", range: () => ({ from: istShift(istToday(), -29), to: istToday() }) },
  {
    id: "this_month",
    label: "This month",
    short: "This month",
    range: () => ({ from: istMonthStart(istToday()), to: istToday() }),
  },
];

export function presetForRange(from: string, to: string): RangePresetId {
  for (const p of RANGE_PRESETS) {
    const r = p.range();
    if (r.from === from && r.to === to) return p.id;
  }
  return "custom";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "21 Sep" — from the string, never through a Date. */
export function formatYmd(ymd: string, withYear = false): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "Since yesterday" / "Last 7 days" / "12 Sep → 18 Sep". */
export function rangeSummary(from: string, to: string): string {
  const preset = presetForRange(from, to);
  if (preset !== "custom") return RANGE_PRESETS.find((p) => p.id === preset)!.label;
  if (from === to) return formatYmd(from, true);
  return `${formatYmd(from)} → ${formatYmd(to, true)}`;
}

/** An instant rendered on the IST clock: "21 Sep, 3:59 pm". */
export function formatIst(iso: string, withYear = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: REPORT_TZ,
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export const KIND_LABEL: Record<DailyReportKind, string> = {
  office: "Founders Office",
  unilevel: "Unilevel Plus",
  networkchain: "NetworkChain",
  whitelabel: "Crypto white-label",
};

export const KIND_ORDER: DailyReportKind[] = ["office", "unilevel", "networkchain", "whitelabel"];

/** Block-explorer link for a crypto payment's transaction. */
export function explorerTxUrl(chain: string | null, hash: string | null): string | null {
  if (!chain || !hash) return null;
  const c = chain.toLowerCase();
  if (c === "bsc") return `https://bscscan.com/tx/${hash}`;
  if (c === "polygon") return `https://polygonscan.com/tx/${hash}`;
  if (c === "ethereum") return `https://etherscan.io/tx/${hash}`;
  if (c === "tron") return `https://tronscan.org/#/transaction/${hash}`;
  if (c === "bitcoin") return `https://mempool.space/tx/${hash}`;
  return null;
}
