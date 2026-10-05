"use client";

// Daily Reports — Admin → Analytics → Daily Reports.
//
// "What did we sell, and to whom": every paid Founders Office, Unilevel Plus
// and crypto white-label invoice in an IST date window, one row per buyer
// with that buyer's invoices inside the row. Same DataTable / top bar /
// filter drawer vocabulary as NetworkChain Subs so the two read as one
// panel; the difference is the unit of the row (a person's day of
// purchases, not a subscription).
//
// Data: GET /garage-admin/daily-reports (garagenew-backend
// routes/garageAdminDailyReports.ts). Page key `daily_reports` — grantable to
// non-super admins as a view-only page.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check as CheckIcon,
  ChevronDown,
  Copy,
  ExternalLink,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import type { ColumnDef, SortState } from "@/components/data-table/types";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { getCountryFlag } from "@/lib/country-flag";
import {
  DailyReportsFilterDrawer,
  type DailyReportsFilters,
} from "@/components/garage-admin/DailyReportsFilterDrawer";
import {
  getDailyReports,
  defaultRange,
  formatIst,
  presetForRange,
  rangeSummary,
  RANGE_PRESETS,
  KIND_LABEL,
  KIND_ORDER,
  explorerTxUrl,
  type DailyReportInvoice,
  type DailyReportKind,
  type DailyReportResponse,
  type DailyReportRow,
  type DailyReportStats,
  type DailyReportUser,
} from "@/lib/admin-api/daily-reports";

const PAGE_KEY = "daily_reports";
const RPP_OPTIONS = [10, 20, 50, 100];

const EMPTY_STATS: DailyReportStats = {
  users: 0,
  invoices: 0,
  totalUsd: 0,
  officeUsd: 0,
  unilevelUsd: 0,
  networkchainUsd: 0,
  whitelabelUsd: 0,
  cryptoUsd: 0,
  officeCount: 0,
  unilevelCount: 0,
  networkchainCount: 0,
  whitelabelCount: 0,
  cryptoCount: 0,
  flagged: 0,
};

export default function DailyReportsPage() {
  const router = useRouter();
  const { ready, canView } = useAdminAccess();

  const [rows, setRows] = useState<DailyReportRow[]>([]);
  const [stats, setStats] = useState<DailyReportStats>(EMPTY_STATS);
  const [range, setRange] = useState<DailyReportResponse["range"] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ by: "totalUsd", order: "desc" });
  const [filters, setFilters] = useState<DailyReportsFilters>(() => defaultRange());
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Shared header search — buyer name / email / phone, server-side.
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, page, filters, sort, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [filters, sort, debouncedSearch]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getDailyReports({
        from: filters.from,
        to: filters.to,
        kind: filters.kind,
        q: debouncedSearch || undefined,
        sortBy: sort?.by,
        sortOrder: sort?.order,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        rootUserId: filters.downlineOf?.id,
        excludeUserId: (filters.excludedUsers ?? []).map((p) => p.id),
      });
      setRows(res?.data || []);
      setStats(res?.stats || EMPTY_STATS);
      setRange(res?.range || null);
      setTotal(res?.pagination?.total || 0);
    } catch (error: any) {
      const msg = error?.message || "Failed to load daily reports";
      if (/invalid token|unauthor|401|expired/i.test(msg)) {
        try {
          localStorage.removeItem("garage_admin_token");
          localStorage.removeItem("garage_admin_info");
        } catch {}
        toast.error("Session expired — signing you out");
        router.push("/garage-admin/login");
        return;
      }
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const columns = useMemo(() => buildColumns(), []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);
  const rangeLabel = `${rangeFrom} to ${rangeTo}`;

  const preset = presetForRange(filters.from, filters.to);
  const filterActive = preset !== "since_yesterday" || !!filters.kind || !!filters.downlineOf;

  if (ready && !canView(PAGE_KEY)) {
    return (
      <div className="p-8 text-sm text-zinc-400">You don&apos;t have access to Daily Reports.</div>
    );
  }

  const footerTotals = [
    { label: "Buyers", value: stats.users },
    { label: "Invoices", value: stats.invoices },
    { label: "Total collected", value: <Money usd={stats.totalUsd} strong /> },
    { label: "Founders Office", value: <Money usd={stats.officeUsd} /> },
    { label: "Unilevel Plus", value: <Money usd={stats.unilevelUsd} /> },
    { label: "NetworkChain", value: <Money usd={stats.networkchainUsd} /> },
    { label: "White-label", value: <Money usd={stats.whitelabelUsd} /> },
    ...(stats.cryptoCount > 0
      ? [{ label: `Paid in crypto (${stats.cryptoCount})`, value: <Money usd={stats.cryptoUsd} /> }]
      : []),
    ...(stats.flagged > 0
      ? [
          {
            label: "Not in USD totals",
            value: <span className="text-amber-300">{stats.flagged}</span>,
          },
        ]
      : []),
  ];

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808]">
      <DailyReportsFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onApply={setFilters}
      />

      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="text-sm font-medium text-white">Couldn&apos;t load daily reports</div>
          <div className="max-w-md text-xs text-zinc-500">{loadError}</div>
          <button
            onClick={load}
            className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06]"
          >
            Retry
          </button>
        </div>
      ) : (
        <DataTable<DailyReportRow>
          tableId="garage-admin-daily-reports-v1"
          stickyBg="#181818"
          columns={columns}
          rows={rows}
          getRowId={(r) => r._id}
          loading={loading}
          rowHeight="auto"
          emptyLabel="No paid invoices in this range."
          sort={sort}
          onSortChange={setSort}
          onColumnFilter={() => setDrawerOpen(true)}
          topBar={
            <TopBar
              filters={filters}
              range={range}
              filterActive={filterActive}
              onOpenFilters={() => setDrawerOpen(true)}
              onPreset={(next) => setFilters((f) => ({ ...f, ...next }))}
              onKind={(kind) => setFilters((f) => ({ ...f, kind }))}
              onClearScope={() =>
                setFilters((f) => ({ ...f, downlineOf: null, excludedUsers: undefined }))
              }
            />
          }
          footerTotals={footerTotals}
          pagination={{
            page,
            totalPages,
            rangeLabel,
            recordsPerPage: pageSize,
            recordsPerPageOptions: RPP_OPTIONS,
            onPrev: () => setPage((p) => Math.max(1, p - 1)),
            onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
            onRecordsPerPageChange: (n) => {
              setPageSize(n);
              setPage(1);
            },
          }}
        />
      )}
    </div>
  );
}

/* ── Top bar: the window, one-tap presets, sale-type chips ── */

function TopBar({
  filters,
  range,
  filterActive,
  onOpenFilters,
  onPreset,
  onKind,
  onClearScope,
}: {
  filters: DailyReportsFilters;
  range: DailyReportResponse["range"] | null;
  filterActive: boolean;
  onOpenFilters: () => void;
  onPreset: (next: { from: string; to: string }) => void;
  onKind: (kind?: DailyReportKind) => void;
  onClearScope: () => void;
}) {
  const active = presetForRange(filters.from, filters.to);
  const kinds: Array<{ id: DailyReportKind | ""; label: string }> = [
    { id: "", label: "All" },
    { id: "office", label: "Office" },
    { id: "unilevel", label: "Unilevel" },
    { id: "networkchain", label: "NetworkChain" },
    { id: "whitelabel", label: "White-label" },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenFilters}
          className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            filterActive
              ? "border-[#FBD10D]/40 bg-[#FBD10D]/10 text-[#FBD10D]"
              : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          }`}
          aria-label="Filters"
          title="Filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {filterActive && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FBD10D] ring-2 ring-[#181818]" />
          )}
        </button>

        {/* The window, exactly as the server resolved it — so what's on
            screen is never ambiguous about which hours it covers. */}
        <button
          type="button"
          onClick={onOpenFilters}
          className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 hover:bg-white/[0.06]"
          title="Change the date range"
        >
          <span className="font-medium text-white">{rangeSummary(filters.from, filters.to)}</span>
          {range && (
            <span className="hidden text-[12px] text-zinc-500 sm:inline">
              {formatIst(range.fromAt)} → {formatIst(range.toAt)} IST
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>

        {/* Whose tree this is scoped to, when it is. */}
        {filters.downlineOf && (
          <button
            type="button"
            onClick={onOpenFilters}
            className="flex h-9 items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-3 text-sm text-emerald-200 hover:bg-emerald-500/[0.14]"
            title="Change the downline scope"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate font-medium">
              {filters.downlineOf.name || filters.downlineOf.email || "Selected person"}
            </span>
            <span className="text-[12px] text-emerald-300/70">
              &apos;s downline
              {filters.excludedUsers?.length ? ` · −${filters.excludedUsers.length}` : ""}
            </span>
            <X
              className="h-3.5 w-3.5 text-emerald-300/70 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onClearScope();
              }}
            />
          </button>
        )}

        {/* One-tap presets — the same ranges the drawer offers. */}
        <div className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1 lg:flex">
          {RANGE_PRESETS.map((p) => {
            const on = active === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPreset(p.range())}
                className={`h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors ${
                  on ? "bg-[#FBD10D]/15 text-[#FBD10D]" : "text-zinc-400 hover:text-white"
                }`}
              >
                {p.short}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
        {kinds.map((k) => {
          const on = (filters.kind || "") === k.id;
          return (
            <button
              key={k.id || "all"}
              type="button"
              onClick={() => onKind(k.id === "" ? undefined : k.id)}
              className={`h-7 rounded-full px-3 text-[12px] font-medium transition-colors ${
                on ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Columns ── */

function buildColumns(): ColumnDef<DailyReportRow>[] {
  return [
    {
      id: "name",
      header: "Buyer",
      width: 290,
      minWidth: 240,
      sortable: true,
      frozen: "left",
      cell: (r) => <UserCell u={r.user} location={r.location} />,
    },
    {
      // Second column, as on NetworkChain Subs — who referred this buyer.
      // Declared here rather than appended so it lands beside the buyer
      // even for admins who already have a saved column layout.
      id: "upline",
      header: "Upline Details",
      width: 270,
      minWidth: 220,
      cell: (r) =>
        r.upline ? (
          <UserCell u={r.upline} location={null} />
        ) : (
          <span className="text-white/30">—</span>
        ),
    },
    {
      id: "invoices",
      header: "Invoices",
      width: 640,
      minWidth: 480,
      cell: (r) => (
        <div className="divide-y divide-white/[0.05] py-1">
          {r.invoices.map((inv) => (
            <InvoiceLine key={inv.id} inv={inv} />
          ))}
        </div>
      ),
    },
    {
      id: "invoiceCount",
      header: "Kinds",
      width: 190,
      minWidth: 160,
      sortable: true,
      cell: (r) => <KindsCell r={r} />,
    },
    {
      id: "totalUsd",
      header: "USD collected",
      width: 150,
      minWidth: 130,
      align: "right",
      sortable: true,
      cell: (r) => (
        <div className="space-y-1 py-1 text-right leading-tight">
          <Money usd={r.totalUsd} strong />
          <div className="text-[11px] text-white/40">
            {KIND_ORDER.filter((k) => r.byKindUsd[k] > 0)
              .map((k) => `${KIND_SHORT[k]} ${fmtUsd(r.byKindUsd[k])}`)
              .join(" · ")}
          </div>
        </div>
      ),
    },
    {
      id: "lastPaidAt",
      header: "Last paid (IST)",
      width: 170,
      minWidth: 150,
      sortable: true,
      cell: (r) => (
        <span className="text-[14px] font-semibold text-white/50">{formatIst(r.lastPaidAt)}</span>
      ),
    },
  ];
}

/* ── Cells ── */

const KIND_SHORT: Record<DailyReportKind, string> = {
  office: "Office",
  unilevel: "UP",
  networkchain: "NC",
  whitelabel: "WL",
};

const KIND_BADGE: Record<DailyReportKind, string> = {
  office: "text-[#FBD10D] bg-[#FBD10D]/10 border-[#FBD10D]/25",
  unilevel: "text-sky-300 bg-sky-500/10 border-sky-500/25",
  networkchain: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  whitelabel: "text-violet-300 bg-violet-500/10 border-violet-500/25",
};

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtCharged(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function Money({ usd, strong }: { usd: number; strong?: boolean }) {
  return (
    <span
      className={`tabular-nums ${
        strong ? "text-[14px] font-semibold text-emerald-300" : "text-[13px] font-medium text-emerald-300/80"
      }`}
    >
      {fmtUsd(usd)}
    </span>
  );
}

/** One invoice inside a buyer's row: number → public page, what it was, what was paid. */
function InvoiceLine({ inv }: { inv: DailyReportInvoice }) {
  const flagLabel: Record<DailyReportInvoice["flags"][number], { text: string; cls: string; title: string }> = {
    cryptobrand_bootstrap: {
      text: "bootstrap",
      cls: "text-amber-300 border-amber-500/30 bg-amber-500/10",
      title: "Minted with the cryptobrand office bootstrap (paired with its office invoice)",
    },
    legacy_inr_paise: {
      text: "legacy INR",
      cls: "text-amber-300 border-amber-500/30 bg-amber-500/10",
      title: "Old Razorpay-subscription cycle stored in rupees; not counted in USD totals",
    },
    paidAt_missing: {
      text: "date ≈",
      cls: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10",
      title: "No paid timestamp on this invoice — created date shown instead",
    },
  };
  return (
    <div className="space-y-1 py-2 leading-tight">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <a
          href={inv.publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#FBD10D] hover:underline"
          title="Open the invoice page"
        >
          {inv.invoiceNumber}
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>
        <CopyBtn value={inv.invoiceNumber} label="invoice number" />
        <span
          className={`rounded-full border px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide ${KIND_BADGE[inv.kind]}`}
        >
          {KIND_LABEL[inv.kind]}
        </span>
        <span className="text-[12px] text-white/70">{inv.tag}</span>
        <span className="truncate text-[12px] text-white/40" title={inv.itemName}>
          {inv.itemName}
        </span>
        {inv.flags.map((f) => (
          <span
            key={f}
            title={flagLabel[f].title}
            className={`rounded-full border px-1.5 py-[1px] text-[10px] font-semibold ${flagLabel[f].cls}`}
          >
            {flagLabel[f].text}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-white/50">
        <span>{formatIst(inv.paidAt)}</span>
        <span className="text-white/20">·</span>
        <span>{inv.method}</span>
        <span className="text-white/20">·</span>
        {inv.usd != null ? (
          <span className="font-semibold tabular-nums text-white/80">{fmtUsd(inv.usd)}</span>
        ) : (
          <span className="text-white/40">— USD</span>
        )}
        {inv.gstUsd != null && (
          <span className="tabular-nums text-white/40">incl. {fmtUsd(inv.gstUsd)} GST</span>
        )}
        {inv.charged && (
          <>
            <span className="text-white/20">·</span>
            <span className="tabular-nums text-white/60">
              charged {fmtCharged(inv.charged.amount, inv.charged.currency)}
            </span>
          </>
        )}
        {inv.txHash && (
          <>
            <span className="text-white/20">·</span>
            {explorerTxUrl(inv.cryptoChain, inv.txHash) ? (
              <a
                href={explorerTxUrl(inv.cryptoChain, inv.txHash)!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-[11px] text-white/50 hover:text-white hover:underline"
                title={inv.txHash}
              >
                tx {inv.txHash.slice(0, 8)}…{inv.txHash.slice(-6)}
              </a>
            ) : (
              <span className="font-mono text-[11px] text-white/40" title={inv.txHash}>
                tx {inv.txHash.slice(0, 8)}…{inv.txHash.slice(-6)}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KindsCell({ r }: { r: DailyReportRow }) {
  return (
    <div className="space-y-1.5 py-1 leading-tight">
      <div className="text-[14px] font-semibold text-white/80">
        {r.invoiceCount} {r.invoiceCount === 1 ? "invoice" : "invoices"}
      </div>
      <div className="flex flex-wrap gap-1">
        {KIND_ORDER.map((k) => {
          const n = r.counts[k];
          return (
            <span
              key={k}
              className={`rounded-full border px-1.5 py-[1px] text-[10px] font-semibold ${
                n > 0 ? KIND_BADGE[k] : "border-white/[0.06] text-white/25"
              }`}
            >
              {n} {KIND_SHORT[k]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CopyBtn({ value, label }: { value: string | null; label: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            toast.success(`Copied ${label}`);
            setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => toast.error("Couldn't copy"));
      }}
      className="shrink-0 rounded p-0.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
    >
      {copied ? <CheckIcon className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function UserCell({
  u,
  location,
}: {
  u: DailyReportUser;
  location: DailyReportRow["location"];
}) {
  if (!u) return <span className="text-white/40">—</span>;
  const place = [location?.city, location?.state].filter(Boolean).join(", ");
  return (
    <div className="flex items-start gap-3 py-1">
      <Avatar src={u.profilePicture} name={u.name || u.email || "?"} />
      <div className="min-w-0 space-y-1 leading-tight">
        <div className="flex items-center gap-1">
          <span
            className={`truncate text-[14px] font-semibold ${
              u.deleted ? "text-white/40 line-through" : "text-white/80"
            }`}
          >
            {u.name || (u.deleted ? "Deleted user" : "Unnamed")}
          </span>
          {u.deleted && (
            <span
              className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-amber-300"
              title="This account was deleted. The invoice is kept for financial history."
            >
              Deleted
            </span>
          )}
          {!u.deleted && <CopyBtn value={u.name} label="name" />}
        </div>
        <div className="flex items-center gap-1">
          <span className="truncate text-[14px] text-white/50">{u.email}</span>
          <CopyBtn value={u.email} label="email" />
        </div>
        {u.phone && (
          <div className="flex items-center gap-1.5">
            {u.country && (
              <span className="text-[14px] leading-none" aria-hidden>
                {getCountryFlag(u.country)}
              </span>
            )}
            <span className="text-[14px] font-semibold text-white/50">{u.phone}</span>
            <CopyBtn value={u.phone} label="phone" />
          </div>
        )}
        {(place || location?.country) && (
          <div className="truncate text-[12px] text-white/35">
            {[place, location?.country].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full border border-white/[0.08] object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-sm font-semibold text-black">
      {initial}
    </div>
  );
}
