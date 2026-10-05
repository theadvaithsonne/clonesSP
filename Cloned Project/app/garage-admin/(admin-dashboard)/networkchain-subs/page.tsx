"use client";

// NetworkChain Subs — Admin → Citizens → NetworkChain Subs.
//
// Uses the reusable Bigin-style DataTable (copied from the NC frontend,
// components/data-table/*). Column resize, reorder, sort menu, and layout
// persistence come for free from the shared component; this file just
// declares the 10 columns Shorupan drew in Figma frame 39:1521 and wires
// up the top bar + footer totals + pagination.
//
// Data: GET /garage-admin/networkchain-subs (garagenew-backend
// routes/garageAdminNetworkChainSubs.ts).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { garageAdminApi } from "@/lib/api";
import {
  AssignAgentDialog,
  AssignedCell,
  type AssignedAgent,
} from "@/components/garage-admin/assign-agent";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { getCountryFlag } from "@/lib/country-flag";
import { toast } from "sonner";
import {
  CheckCircle2,
  Trash2,
  Hourglass,
  Clock,
  ChevronDown,
  Plus,
  SlidersHorizontal,
  X,
  Pencil,
  MoreHorizontal,
  Check as CheckIcon,
  Copy,
  Loader2,
} from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import type {
  ColumnDef,
  SortState,
} from "@/components/data-table/types";
import {
  NetworkChainSubsFilterDrawer,
  type NcSubsFilters,
} from "@/components/garage-admin/NetworkChainSubsFilterDrawer";
import { InvoiceDetailDrawer } from "@/components/garage-admin/InvoiceDetailDrawer";
import { AffiliateMemberDrawer } from "@/components/garage-admin/AffiliateMemberDrawer";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";

type UserSummary = {
  _id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  country: string | null;
  /**
   * The User document is gone — admin deletion does not cascade, so an
   * invoice outlives its owner. The backend then falls back to the customer
   * snapshot stored on the invoice itself. `_id` is null here: there is no
   * account left to open a profile panel for.
   */
  deleted?: boolean;
} | null;

// The support agent (a GarageAdmin) assigned to a subscriber, + the admin
// picker options — same shapes as the Companies page's assign flow.
/** An invoice reference as the backend renders it — the public page link included. */
type InvoiceRef = {
  id: string;
  invoiceNumber: string;
  status: string;
  amountUsd: number;
  currency: string;
  publicUrl: string;
};

/**
 * One side of the payment story — the subscription's first invoice, or its
 * most recent paid one. When the NC invoice is $0 because the money went
 * through the $25 licence (free first month / licence+term bundle),
 * `via25Offer` is set and `offerInvoice` is that $25 invoice; the payment
 * method and auto-debit setup then describe the $25 invoice, since that is
 * what was actually paid.
 */
type PaymentDetails = {
  date: string;
  invoice: InvoiceRef | null;
  via25Offer: boolean;
  offerInvoice: InvoiceRef | null;
  /** What the invoice was for, e.g. "Unilevel Plus + 3 months of NetworkChain". */
  itemName: string | null;
  paymentMethodCategory: string | null;
  paymentPlatform: string | null;
  paymentCurrency: string | null;
  couponCode: string | null;
  /** What paying this set up for renewals. */
  autoDebitSetUp: "upi" | "card" | "not_applicable" | "none";
  /** Set when the renewal cron collected this invoice. */
  paidByAutoDebit: "upi" | "card" | null;
  /** Activated by hand on the NetworkChains side — no Garage invoice. */
  manualGrant: boolean;
};

type Row = {
  _id: string;
  // The subscriber's user id — the Assign/Change action targets this.
  userId: string | null;
  user: UserSummary;
  upline: UserSummary;
  status: "active" | "cancelled" | "expired" | "pending";
  location: {
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  // Support agent assigned to this subscriber (Assigned To column).
  assignedTo: AssignedAgent | null;
  subscriptionStart: PaymentDetails;
  lastPayment: PaymentDetails | null;
  /** The period end and, when the cron has already drafted it, the invoice for it. */
  nextPayment: { date: string | null; invoice: InvoiceRef | null };
  /** What will collect the next cycle — or why nothing will. */
  autoDebit: {
    state: "upi_enabled" | "card_enabled" | "cancelled_by_user" | "not_applicable" | "not_enabled";
    via: "upi" | "card" | null;
    cancelledAt: string | null;
    /** VPA / card tail, or "inferred" when the cancellation is deduced from history. */
    detail: string | null;
  };
  nextPaymentDate: string | null;
  paymentsCount: number;
  cycle: number;
  // Total revenue collected from this subscriber across all paid cycles.
  totalCollectedUsd: number;
  // Current tier + the period it was computed for (for the "as of" hover).
  rank: string | null;
  rankPeriodKey: string | null;
  // Kept for the invoice drawer drill-down — no longer a visible column.
  commercials: Array<{
    amount: number;
    currency: string;
    status: string;
    invoiceNumber: string;
  }>;
};

type Stats = {
  subscribers: number;
  active: number;
  expired: number;
  cancelled: number;
  pending: number;
};

const RPP_OPTIONS = [10, 20, 50, 100];

export default function NetworkChainSubsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>({
    subscribers: 0,
    active: 0,
    expired: 0,
    cancelled: 0,
    pending: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<NcSubsFilters>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Invoice number whose detail drawer is open (null = closed). Set by
  // clicking any invoice number in the table.
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  // Subscriber whose "assign support agent" picker is open (null = closed).
  const [assignFor, setAssignFor] = useState<Row | null>(null);
  // Assigning a support agent is its own grantable action (page-manage or the
  // assign-agent action, on NetworkChain Subs or One Time Affiliates — same
  // shared field). A view-only admin sees the column but no Assign pill.
  const { canDoAction } = useAdminAccess();
  const canAssignAgent = canDoAction("networkchain_subs", "assign-agent");
  // Person side panel (Open View / View Profile), opened from the Name or
  // Upline Details cell.
  const [panelPerson, setPanelPerson] = useState<UserSummary>(null);
  // "Open View" — view the table from a specific user's perspective (their
  // downline). Sent to the backend as ?rootUserId.
  const [viewAsUser, setViewAsUser] = useState<{ _id: string; name: string | null } | null>(null);
  const router = useRouter();

  // Shared header search — filters this table server-side (debounced).
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, page, filters, sort, debouncedSearch, viewAsUser]);

  // Any change to filters/sort/search bounces the page back to 1 so we don't
  // land past the last page of the new (possibly smaller) result set.
  useEffect(() => {
    setPage(1);
  }, [filters, sort, debouncedSearch, viewAsUser]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const offset = (page - 1) * pageSize;
      const qs = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (filters.startedFrom) qs.set("startedFrom", filters.startedFrom);
      if (filters.startedTo) qs.set("startedTo", filters.startedTo);
      if (sort?.by) {
        qs.set("sortBy", sort.by);
        qs.set("sortOrder", sort.order);
      }
      if (debouncedSearch) qs.set("q", debouncedSearch);
      // Open View: show the table from the selected user's perspective (their
      // downline). The backend narrows to everyone with this id in their
      // ancestors path.
      if (viewAsUser?._id) qs.set("rootUserId", viewAsUser._id);
      const res = await garageAdminApi<{
        data: Row[];
        stats: Stats;
        pagination: { total: number };
      }>(`/garage-admin/networkchain-subs?${qs.toString()}`, { method: "GET" });
      setRows(res?.data || []);
      setStats(
        res?.stats || {
          subscribers: 0,
          active: 0,
          expired: 0,
          cancelled: 0,
          pending: 0,
        }
      );
      setTotal(res?.pagination?.total || 0);
    } catch (error: any) {
      const msg = error?.message || "Failed to load NetworkChain subs";
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

  // Patch every row for this subscriber in place after an assignment (a user
  // could in principle appear on more than one subscription row).
  function applyAssignment(userId: string, agent: AssignedAgent | null) {
    setRows((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, assignedTo: agent } : r)),
    );
  }

  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      buildColumns(
        (n) => setOpenInvoice(n),
        (p) => setPanelPerson(p),
        (r) => setAssignFor(r),
        canAssignAgent,
      ),
    // Resolves in an effect, so it flips on the second render.
    [canAssignAgent],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return `${from} to ${to}`;
  }, [page, pageSize, total]);

  return (
    // Break out of the admin shell's px-8/pt-7/pb-8 gutters so this page
    // runs edge-to-edge like NC's downline table, and paint the whole
    // surface with NC's near-black so the frozen column + sticky header
    // blend as one system instead of banding against the Garage shell.
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808]">
      <NetworkChainSubsFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onApply={setFilters}
      />
      {/* Invoice detail — opens in-page when an invoice number is clicked. */}
      <InvoiceDetailDrawer
        invoiceNumber={openInvoice}
        onClose={() => setOpenInvoice(null)}
      />
      {/* Assign a support agent to a subscriber (Assigned To column). */}
      <AssignAgentDialog
        subject={assignFor}
        onClose={() => setAssignFor(null)}
        onAssigned={applyAssignment}
        canAssign={canAssignAgent}
      />
      {/* Person side panel — opens from the Name / Upline Details cells. */}
      <AffiliateMemberDrawer
        profileBasePath="/garage-admin/networkchain-subs"
        person={panelPerson}
        onClose={() => setPanelPerson(null)}
        onOpenView={(p) => {
          setViewAsUser({ _id: p._id, name: p.name });
          setPanelPerson(null);
        }}
      />
      {/* Open View banner — the table is scoped to a user's downline. */}
      {viewAsUser && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#FFC200]/25 bg-[#FFC200]/[0.06] px-4 py-2.5">
          <div className="min-w-0 text-[13px] text-zinc-200">
            Viewing the downline of{" "}
            <span className="font-semibold text-white">
              {viewAsUser.name || "this user"}
            </span>
          </div>
          <button
            onClick={() => setViewAsUser(null)}
            className="shrink-0 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-[12px] text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Exit view
          </button>
        </div>
      )}
      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="text-sm font-medium text-white">
            Couldn&apos;t load NetworkChain subs
          </div>
          <div className="max-w-md text-xs text-zinc-500">{loadError}</div>
          <button
            onClick={load}
            className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06]"
          >
            Retry
          </button>
        </div>
      ) : (
        <DataTable<Row>
          tableId="garage-admin-networkchain-subs-v2"
          stickyBg="#181818"
          columns={columns}
          rows={rows}
          getRowId={(r) => r._id}
          loading={loading}
          emptyLabel="No NetworkChain subscribers yet."
          sort={sort}
          onSortChange={setSort}
          onColumnFilter={() => setDrawerOpen(true)}
          selectable
          selectedIds={selectedIds}
          allSelected={rows.length > 0 && rows.every((r) => selectedIds.has(r._id))}
          onToggleRow={(id) =>
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onToggleAll={() =>
            setSelectedIds((prev) => {
              const all = rows.every((r) => prev.has(r._id));
              if (all) return new Set();
              return new Set(rows.map((r) => r._id));
            })
          }
          topBar={
            selectedIds.size > 0 ? (
              <BulkActionBar
                count={selectedIds.size}
                onClear={() => setSelectedIds(new Set())}
              />
            ) : (
              <TopBar
                onOpenFilters={() => setDrawerOpen(true)}
                filterActive={!!filters.startedFrom || !!filters.startedTo}
              />
            )
          }
          // Active only — the backend never returns pending / expired /
          // cancelled rows, so one figure is the whole story.
          footerTotals={[
            { label: "Active Subscribers", value: stats.active },
          ]}
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

/* ── Bulk action bar (shown in place of TopBar when 1+ rows selected) ── */

function BulkActionBar({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-medium text-black hover:bg-emerald-400"
        >
          <Pencil className="h-3.5 w-3.5" />
          Update Field
        </button>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-zinc-200 hover:bg-white/[0.06]"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
          More
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="flex h-8 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] pl-3 pr-2 text-[13px] text-zinc-200 hover:bg-white/[0.06]"
          title="Clear selection"
        >
          {count} Selected
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.1]">
            <X className="h-3 w-3" />
          </span>
        </button>
      </div>
    </div>
  );
}

/* ── Top bar (view selector + subscription add) ── */

function TopBar({
  onOpenFilters,
  filterActive,
}: {
  onOpenFilters: () => void;
  filterActive: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
      <div className="flex items-center gap-2">
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
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 hover:bg-white/[0.06]"
        >
          <BrandDot className="h-4 w-4" />
          Entire Company
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>

      <button
        type="button"
        className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-zinc-200 hover:bg-white/[0.06]"
      >
        <Plus className="h-4 w-4" />
        Subscription
        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
      </button>
    </div>
  );
}

/* ── Column definitions ── */

function buildColumns(
  onInvoiceClick: (invoiceNumber: string) => void,
  onOpenPerson: (u: UserSummary) => void,
  onAssign: (row: Row) => void,
  canAssign: boolean,
): ColumnDef<Row>[] {
  return [
    {
      id: "name",
      header: "Name",
      width: 240,
      minWidth: 200,
      sortable: true,
      filterable: true,
      frozen: true,
      cell: (r) =>
        // A deleted account has no profile to open — don't offer the click.
        r.user?.deleted ? (
          <UserCell u={r.user} />
        ) : (
          <div className="cursor-pointer" onClick={() => onOpenPerson(r.user)}>
            <UserCell u={r.user} />
          </div>
        ),
    },
    {
      id: "upline",
      header: "Upline Details",
      width: 240,
      minWidth: 200,
      sortable: true,
      filterable: true,
      // Opens the panel for the UPLINE person, not the row's subscriber.
      cell: (r) =>
        r.upline ? (
          <div className="cursor-pointer" onClick={() => onOpenPerson(r.upline)}>
            <UserCell u={r.upline} />
          </div>
        ) : (
          <UserCell u={r.upline} />
        ),
    },
    {
      id: "status",
      header: "Status",
      width: 140,
      minWidth: 120,
      sortable: true,
      filterable: true,
      cell: (r) => <StatusPill status={r.status} />,
    },
    {
      id: "location",
      header: "Location",
      width: 200,
      minWidth: 160,
      sortable: true,
      filterable: true,
      cell: (r) => <LocationCell loc={r.location} />,
    },
    {
      id: "assignedTo",
      header: "Assigned To",
      width: 233,
      minWidth: 180,
      cell: (r) => (
        <AssignedCell row={r} onAssign={onAssign} canAssign={canAssign} />
      ),
    },
    {
      id: "subscriptionStart",
      header: "Subscription Start Details",
      width: 250,
      minWidth: 220,
      sortable: true,
      filterable: true,
      cell: (r) => <PaymentDetailsCell d={r.subscriptionStart} side="start" />,
    },
    {
      id: "lastPayment",
      header: "Last Subscription Payment",
      width: 250,
      minWidth: 220,
      sortable: true,
      filterable: true,
      cell: (r) =>
        r.lastPayment ? (
          <PaymentDetailsCell d={r.lastPayment} side="last" />
        ) : (
          <span className="text-zinc-600">—</span>
        ),
    },
    {
      id: "autoDebit",
      header: "Auto Debit",
      width: 190,
      minWidth: 170,
      cell: (r) => <AutoDebitCell a={r.autoDebit} />,
    },
    {
      id: "nextPaymentDate",
      header: "Payment Due",
      width: 170,
      minWidth: 150,
      sortable: true,
      filterable: true,
      cell: (r) => <NextPaymentCell n={r.nextPayment} autoDebit={r.autoDebit} />,
    },
    {
      id: "paymentsCount",
      header: "Payments",
      width: 100,
      minWidth: 90,
      align: "center",
      sortable: true,
      cell: (r) => <span className="text-[14px] font-semibold text-white/50">{r.paymentsCount}</span>,
    },
    {
      id: "cycle",
      header: "Cycle",
      width: 100,
      minWidth: 90,
      align: "center",
      sortable: true,
      cell: (r) => <span className="text-[14px] font-semibold text-white/50">{ordinal(r.cycle)}</span>,
    },
    {
      id: "totalCollected",
      header: "Total Collected",
      width: 140,
      minWidth: 120,
      align: "right",
      sortable: true,
      cell: (r) => (
        <span className="text-[14px] font-semibold tabular-nums text-white/50">
          {formatMoney(r.totalCollectedUsd ?? 0, "USD")}
        </span>
      ),
    },
    {
      id: "rank",
      header: "Rank",
      width: 120,
      minWidth: 100,
      sortable: true,
      cell: (r) => <RankCell rank={r.rank} periodKey={r.rankPeriodKey} />,
    },
  ];
}

/* ── Cells ── */

/** Small inline copy-to-clipboard button; stops propagation so it copies rather
 *  than triggering the clickable cell. */
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
      {copied ? (
        <CheckIcon className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function UserCell({ u }: { u: UserSummary }) {
  if (!u) return <span className="text-white/40">—</span>;
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
          {/* The invoice survives its owner by design (financial history).
              Without this the whole cell rendered blank and the row looked
              broken rather than orphaned. */}
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

// Status pill per the Figma: a neutral gray pill with a status-tinted icon and
// bold white label.
function StatusPill({ status }: { status: Row["status"] }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full bg-[rgba(114,114,114,0.32)] px-3 py-1 text-[10px] font-bold text-white";
  if (status === "active") {
    return (
      <span className={base}>
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        Active
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className={base}>
        <Trash2 className="h-3.5 w-3.5 text-red-400" />
        Cancelled
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className={base}>
        <Clock className="h-3.5 w-3.5 text-amber-400" />
        Pending
      </span>
    );
  }
  return (
    <span className={base}>
      <Hourglass className="h-3.5 w-3.5 text-[#FBD10D]" />
      Expired
    </span>
  );
}

function LocationCell({ loc }: { loc: Row["location"] }) {
  if (!loc || (!loc.city && !loc.state && !loc.country))
    return <span className="text-white/40">—</span>;
  return (
    <div className="space-y-1.5 leading-tight">
      <div className="text-[14px] font-semibold text-white/50">{loc.city || "—"}</div>
      {loc.state && (
        <div className="text-[14px] font-semibold text-white/50">{loc.state}</div>
      )}
      {loc.country && (
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] leading-none" aria-hidden>
            {getCountryFlag(loc.country)}
          </span>
          <span className="text-[14px] font-semibold text-white/50">{loc.country}</span>
        </div>
      )}
    </div>
  );
}

/** The public invoice page, opened in a new tab, with a status badge beside it. */
function InvoiceLink({ inv, title, pendingNote }: { inv: InvoiceRef; title?: string; pendingNote?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <a
        href={inv.publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-[13px] font-semibold text-white/70 underline underline-offset-2 transition-colors hover:text-white"
        title={title || inv.invoiceNumber}
      >
        {inv.invoiceNumber}
      </a>
      <InvoiceStatusBadge status={inv.status} pendingNote={pendingNote} />
    </span>
  );
}

function InvoiceStatusBadge({ status, pendingNote }: { status: string; pendingNote?: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "paid"
      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25"
      : s === "pending" || s === "draft"
        ? "text-amber-300 bg-amber-500/10 border-amber-500/25"
        : "text-zinc-400 bg-zinc-500/10 border-zinc-500/25";
  // A drafted next-cycle invoice is, to an admin, simply not paid yet —
  // "Draft" read as an internal state. Both show as Pending.
  const isPending = s === "draft" || s === "pending";
  const label = s === "paid" ? "Paid" : isPending ? `Pending${pendingNote ? ` · ${pendingNote}` : ""}` : s || "—";
  return (
    <span className={`rounded-full border px-1.5 py-[1px] text-[10px] font-semibold leading-tight ${cls}`}>
      {label}
    </span>
  );
}

/** Small pill for the auto-debit facts under a payment. */
function Pill({ text, tone }: { text: string; tone: "green" | "amber" | "zinc" | "red" }) {
  const cls = {
    green: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
    amber: "text-amber-300 bg-amber-500/10 border-amber-500/25",
    zinc: "text-zinc-400 bg-zinc-500/10 border-zinc-500/25",
    red: "text-red-300 bg-red-500/10 border-red-500/25",
  }[tone];
  return (
    <span className={`inline-block rounded-full border px-2 py-[2px] text-[10px] font-semibold leading-tight ${cls}`}>
      {text}
    </span>
  );
}

// Human-readable label for a paymentMethodCategory + paymentPlatform pair —
// "Card (Stripe)", "UPI (Razorpay)", "Affiliate Wallet", "Crypto".
function paymentMethodLabel(category: string | null, platform: string | null): string {
  if (!category && !platform) return "—";
  const c = (category || "").toLowerCase();
  const p = (platform || "").toLowerCase();
  if (p === "store_wallet") return "Store Wallet";
  if (p === "affiliate_wallet") return "Affiliate Wallet";
  if (p === "content_rewards_wallet") return "Content Rewards Wallet";
  if (c === "wallet") return "Wallet";
  if (c === "crypto" || p === "crypto_wallet") return "Crypto";
  const provider = p === "razorpay" ? "Razorpay" : p === "stripe" ? "Stripe" : p ? p : "";
  if (c === "card") return provider ? `Card (${provider})` : "Card";
  if (c === "upi") return provider ? `UPI (${provider})` : "UPI";
  if (c === "bank_transfer") return "Bank Transfer";
  return category || platform || "—";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/**
 * Subscription Start Details / Last Subscription Payment.
 *
 *   Sep 18, 2026 at 4:46 PM
 *   INV-…  [Paid]              ← the NC subscription invoice ("Invoice #1")
 *   (Via $25 offer)            ← only when the money went through the licence
 *   INV-…  [Paid]              ←   …and that $25 invoice
 *   USD | Card (Stripe)        ← how the money moved
 *   [Auto Debit Was Enabled]   ← start: what paying it set up
 *   [Paid With UPI Auto Debit] ← last: when the renewal cron collected it
 */
function PaymentDetailsCell({ d, side }: { d: PaymentDetails; side: "start" | "last" }) {
  if (d.manualGrant) {
    return (
      <div className="space-y-1.5 leading-tight">
        <div className="text-[14px] font-semibold text-white/50">{formatDateTime(d.date)}</div>
        <div className="text-[12px] text-white/50">Activated by NetworkChains admin</div>
        <Pill text="Manual" tone="zinc" />
      </div>
    );
  }
  const method = paymentMethodLabel(d.paymentMethodCategory, d.paymentPlatform);
  const methodLine = d.paymentCurrency ? `${d.paymentCurrency} | ${method}` : method;

  let pill: { text: string; tone: "green" | "amber" | "zinc" } | null = null;
  if (side === "start") {
    if (d.autoDebitSetUp === "upi") pill = { text: "UPI Auto Debit Was Enabled", tone: "green" };
    else if (d.autoDebitSetUp === "card") pill = { text: "Card Auto Debit Was Enabled", tone: "green" };
    else if (d.autoDebitSetUp === "not_applicable") pill = { text: "Auto Debit Not Applicable", tone: "zinc" };
  } else if (d.paidByAutoDebit === "upi") {
    pill = { text: "Paid With UPI Auto Debit", tone: "green" };
  } else if (d.paidByAutoDebit === "card") {
    pill = { text: "Paid With Card Auto Debit", tone: "green" };
  }

  return (
    <div className="space-y-1.5 leading-tight">
      <div className="text-[14px] font-semibold text-white/50">{formatDateTime(d.date)}</div>
      {d.invoice ? <InvoiceLink inv={d.invoice} title="Subscription invoice" /> : <div className="text-[14px] text-white/40">—</div>}
      {/* Last payment resolves to the invoice that collected the money — on a
          combo that is the licence+term invoice, so say what it covered. */}
      {side === "last" && d.itemName && (
        <div className="text-[11px] text-white/40 truncate" title={d.itemName}>{d.itemName}</div>
      )}
      {d.via25Offer && (
        <>
          <div className="text-[12px] text-white/40">(Via $25 offer)</div>
          {d.offerInvoice && <InvoiceLink inv={d.offerInvoice} title="$25 licence invoice" />}
        </>
      )}
      <div className="text-[12px] text-white/50">{methodLine === "—" && d.via25Offer ? "" : methodLine}</div>
      {pill && <Pill text={pill.text} tone={pill.tone} />}
    </div>
  );
}

/** Auto Debit column — what will collect the next cycle, or why nothing will. */
function AutoDebitCell({ a }: { a: Row["autoDebit"] }) {
  switch (a.state) {
    case "upi_enabled":
      return (
        <div className="space-y-1 leading-tight">
          <Pill text="UPI Currently Enabled" tone="green" />
          {a.detail && <div className="text-[11px] text-white/40">{a.detail}</div>}
        </div>
      );
    case "card_enabled":
      return (
        <div className="space-y-1 leading-tight">
          <Pill text="Saved Card Enabled" tone="green" />
          {a.detail && <div className="text-[11px] text-white/40">{a.detail}</div>}
        </div>
      );
    case "cancelled_by_user":
      return (
        <div className="space-y-1 leading-tight">
          <Pill text={`User Cancelled${a.via ? ` · ${a.via === "upi" ? "UPI" : "Card"}` : ""}`} tone="red" />
          <div className="text-[11px] text-white/40">
            {a.cancelledAt
              ? formatShortDate(a.cancelledAt)
              : a.detail === "inferred"
                ? "Was set up at payment, no longer on file"
                : a.detail || ""}
          </div>
        </div>
      );
    case "not_applicable":
      return <Pill text="Not Applicable" tone="zinc" />;
    default:
      return <Pill text="Not Enabled" tone="amber" />;
  }
}

/**
 * Payment Due — the date and, when already drafted, the invoice for it.
 * The pending badge says what will happen on that date: the renewal cron
 * collects it when an instrument is on file (Auto Debit column), otherwise
 * it waits for the user.
 */
function NextPaymentCell({ n, autoDebit }: { n: Row["nextPayment"]; autoDebit: Row["autoDebit"] }) {
  const willAutoDebit = autoDebit.state === "upi_enabled" || autoDebit.state === "card_enabled";
  return (
    <div className="space-y-1.5 leading-tight">
      <div className="text-[14px] font-semibold text-white/50">{n.date ? formatShortDate(n.date) : "—"}</div>
      {n.invoice && (
        <InvoiceLink
          inv={n.invoice}
          title="Next cycle invoice"
          pendingNote={willAutoDebit ? "will auto-debit" : "user to pay"}
        />
      )}
    </div>
  );
}

function RankCell({ rank, periodKey }: { rank: string | null; periodKey: string | null }) {
  if (!rank) return <span className="text-[14px] font-semibold text-white/40">No Rank</span>;
  return (
    <span
      className="text-[14px] font-semibold capitalize text-white/50"
      title={periodKey ? `As of ${periodKey}` : undefined}
    >
      {rank}
    </span>
  );
}

// Assigned To — the support agent for this subscriber. Shows the agent (avatar
// + name/email + Change) when set, or an Assign pill when not. Matches the
// Figma; clicking either opens the agent picker.
function CommercialsCell({
  commercials,
  onInvoiceClick,
}: {
  commercials: Row["commercials"];
  onInvoiceClick: (invoiceNumber: string) => void;
}) {
  if (!commercials?.length) return <span className="text-zinc-600">—</span>;
  return (
    <div className="flex flex-col text-[12px]">
      {commercials.slice(0, 3).map((c, i) => {
        const color =
          String(c.status).toLowerCase() === "paid"
            ? "text-emerald-400"
            : String(c.status).toLowerCase() === "cancelled"
              ? "text-red-400 line-through"
              : "text-zinc-500";
        // Each commercial carries its own invoice — click the amount to
        // open that invoice's detail in the same page.
        return c.invoiceNumber ? (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInvoiceClick(c.invoiceNumber);
            }}
            className={`text-left underline-offset-2 hover:underline ${color}`}
            title={`View invoice ${c.invoiceNumber}`}
          >
            {formatMoney(c.amount, c.currency)}
          </button>
        ) : (
          <span key={i} className={color}>
            {formatMoney(c.amount, c.currency)}
          </span>
        );
      })}
      {commercials.length > 3 && (
        <span className="text-[10px] text-zinc-600">
          +{commercials.length - 3} more
        </span>
      )}
    </div>
  );
}

/* ── Small helpers ── */

function BrandDot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <rect x="11.2499" y="0" width="5.92097" height="23.6839" fill="#FBD10D" />
      <circle cx="4.49007" cy="19.1938" r="4.49007" fill="#FBD10D" />
      <circle cx="24.3472" cy="4.97071" r="4.97069" fill="#FBD10D" />
      <circle cx="24.3472" cy="18.7132" r="4.97069" fill="#FBD10D" />
    </svg>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
