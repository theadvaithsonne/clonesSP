"use client";

// One Time Affiliates — Admin → Citizens → One Time Affiliates.
//
// Everyone who has paid the $25 Unilevel Plus license, whether or not
// they've since become an active NetworkChain subscriber. Table matches
// Shorupan's Figma frame 77:3 (Garage-Dashboard file).
//
// Backend: GET /garage-admin/one-time-affiliates (garagenew-backend
// routes/garageAdminOneTimeAffiliates.ts).

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
  ChevronDown,
  Download,
  Loader2,
  SlidersHorizontal,
  X,
  Pencil,
  MoreHorizontal,
  Check as CheckIcon,
  Copy,
} from "lucide-react";
import { exportRowsAsCsv, type CsvColumn } from "@/lib/csvExport";
import { DataTable } from "@/components/data-table/DataTable";
import type {
  ColumnDef,
  SortState,
} from "@/components/data-table/types";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { InvoiceDetailDrawer } from "@/components/garage-admin/InvoiceDetailDrawer";
import { AffiliateMemberDrawer } from "@/components/garage-admin/AffiliateMemberDrawer";
import {
  CompanyScopeDialog,
  ScopeAvatar,
  type ScopePerson,
} from "@/components/garage-admin/CompanyScopeDialog";
import {
  OneTimeAffiliatesFilterDrawer,
  applyFiltersToQuery,
  hasAnyFilter,
  type LocationFacet,
  type OneTimeAffiliateFilters,
} from "@/components/garage-admin/OneTimeAffiliatesFilterDrawer";
import { IgniteCallCell } from "@/components/garage-admin/ignite-call";
import { IgniteCallScheduleDrawer } from "@/components/garage-admin/catchup/IgniteCallScheduleDrawer";
import { IgniteCallDrawer } from "@/components/garage-admin/IgniteCallDrawer";
import { IGNITE_STATUS_LABEL, type IgniteCallSummary } from "@/lib/admin-api/ignite-call";

type UserSummary = {
  _id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  country: string | null;
} | null;

type Row = {
  _id: string;
  // The affiliate's user id — the Assign/Change action targets this. The
  // assignment lives on the User, so it is the same one NetworkChain Subs
  // shows for this person.
  userId: string | null;
  assignedTo: AssignedAgent | null;
  igniteCall: IgniteCallSummary | null;
  user: UserSummary;
  upline: UserSummary;
  location: {
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  joining: {
    date: string;
    firstOffice: {
      id: string;
      name: string | null;
      icon: string | null;
    } | null;
  };
  activation: {
    // null for a whole-tree member who never activated a $25 licence.
    date: string | null;
    invoiceNumber: string | null;
    paymentMethod?: string | null;
    paymentPlatform?: string | null;
    paymentCurrency?: string | null;
    paymentMode?: string | null;
    storeName?: string | null;
    cryptoChain?: string | null;
    cryptoCoin?: string | null;
  };
  /**
   * Stored payment instruments, for the chips in the Activation column.
   * `upiAutopay` is true only for an ACTIVE, unexpired mandate — the
   * backend filters on that, so a chip always means "chargeable today".
   */
  savedInstruments?: {
    cards: number;
    upiAutopay: boolean;
  };
  reserves: number;
  assigned: number;
  directs: number;
  downline: number;
  commercials: Array<{
    amount: number;
    currency: string;
    invoiceNumber: string;
    paidAt: string;
    paymentMethod?: string | null;
    paymentPlatform?: string | null;
    storeName?: string | null;
  }>;
  // Authoritative UnilevelPlus spend (base seat + reserves) from the
  // UnilevelPlusPurchase source of truth — always ≥ $25 for anyone in
  // this list. Preferred over summing `commercials`, which can be empty
  // for legacy purchases with no matching unilevel_plus invoice line.
  totalCommercialsUsd: number;
  currency: string;
  isNetworkChainSubscriber: boolean;
  /**
   * PROVISIONAL — currently "has any NetworkChain chat at all", not
   * "has a chat with an NVC". NVC is an admin role that does not exist
   * yet, so there is nobody to match against. See the backend note in
   * garageAdminOneTimeAffiliates.ts.
   */
  hasNvcChat: boolean;
  licenseSource?: "purchased" | "assigned" | "none";
  // False for whole-tree rows: a downline member who never bought the $25
  // licence. Their money columns are empty by definition.
  isOneTimeAffiliate?: boolean;
};

type Stats = {
  affiliates: number;
  /** Every row — equals `affiliates` unless whole-tree mode is on. */
  members?: number;
  totalLicenses: number;
  activeLicenses: number;
  reservedLicenses: number;
  totalRevenue: number;
};

const RPP_OPTIONS = [10, 20, 50, 100];

/** The endpoint's hard `limit` ceiling — the export pages through at this size. */
const EXPORT_PAGE_SIZE = 200;

/**
 * CSV shape. Mirrors the visible table, but flattens the cells that render as
 * stacked sub-values (a user cell is name + email + phone) into their own
 * columns, since a spreadsheet can't show a stack.
 */
/**
 * Chips showing what an admin can actually charge this person on.
 *
 * Deliberately only rendered when something exists — a row of "none" chips on
 * every affiliate would be noise, and the absence of a chip already reads as
 * "nothing saved". The UPI chip is gated server-side on an ACTIVE, unexpired
 * mandate, so its presence means chargeable right now, not merely "once set
 * autopay up".
 */
function SavedInstrumentChips({
  saved,
}: {
  saved?: { cards: number; upiAutopay: boolean };
}) {
  if (!saved) return null;
  const { cards, upiAutopay } = saved;
  if (!upiAutopay && cards === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {upiAutopay && (
        <span
          title="Active UPI Autopay mandate — chargeable from the Saved Cards tab"
          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-[1px] text-[10px] leading-none text-emerald-400"
        >
          UPI Autopay
        </span>
      )}
      {cards > 0 && (
        <span
          title={`${cards} saved card${cards === 1 ? "" : "s"}`}
          className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-1.5 py-[1px] text-[10px] leading-none text-sky-400"
        >
          {cards > 1 ? `${cards} cards` : "Card"}
        </span>
      )}
    </div>
  );
}

const CSV_COLUMNS: CsvColumn<Row>[] = [
  { header: "Name", accessor: (r) => r.user?.name ?? "" },
  { header: "Email", accessor: (r) => r.user?.email ?? "" },
  { header: "Phone", accessor: (r) => r.user?.phone ?? "" },
  { header: "Upline Name", accessor: (r) => r.upline?.name ?? "" },
  { header: "Upline Email", accessor: (r) => r.upline?.email ?? "" },
  { header: "City", accessor: (r) => r.location?.city ?? "" },
  { header: "State", accessor: (r) => r.location?.state ?? "" },
  { header: "Country", accessor: (r) => r.location?.country ?? "" },
  { header: "Joining Date", accessor: (r) => isoDate(r.joining?.date) },
  { header: "First Office", accessor: (r) => r.joining?.firstOffice?.name ?? "" },
  { header: "Activation Date", accessor: (r) => isoDate(r.activation?.date) },
  { header: "Invoice Number", accessor: (r) => r.activation?.invoiceNumber ?? "" },
  {
    header: "Payment Method",
    accessor: (r) => formatPaymentLabel(r.activation, r.licenseSource) ?? "",
  },
  { header: "Reserves", accessor: (r) => r.reserves },
  { header: "Assigned", accessor: (r) => r.assigned },
  { header: "Directs", accessor: (r) => r.directs },
  { header: "Downline", accessor: (r) => r.downline },
  // Raw number, not the formatted "$25.00" — a currency string with a comma
  // is a spreadsheet's problem, and the currency has its own column.
  { header: "Commercials", accessor: (r) => r.totalCommercialsUsd ?? 0 },
  { header: "Currency", accessor: (r) => r.currency || "USD" },
  {
    header: "NetworkChain Subscriber",
    accessor: (r) => (r.isNetworkChainSubscriber ? "Yes" : "No"),
  },
  { header: "NVC Chat", accessor: (r) => (r.hasNvcChat ? "Yes" : "No") },
  // Distinguishes a $25 buyer from a downline member in whole-tree exports;
  // always "Yes" when the toggle is off.
  {
    header: "One Time Affiliate",
    accessor: (r) => (r.isOneTimeAffiliate === false ? "No" : "Yes"),
  },
  {
    header: "Ignite Call Status",
    accessor: (r) => IGNITE_STATUS_LABEL[r.igniteCall?.status ?? "not_scheduled"],
  },
  { header: "Ignite Call Admin", accessor: (r) => r.igniteCall?.admin?.name ?? "" },
  { header: "Ignite Call Date", accessor: (r) => isoDate(r.igniteCall?.scheduledAt) },
];

export default function OneTimeAffiliatesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>({
    affiliates: 0,
    totalLicenses: 0,
    activeLicenses: 0,
    reservedLicenses: 0,
    totalRevenue: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Server-side filters from the filter drawer. Serialized onto the same
  // /garage-admin/one-time-affiliates request the table already makes.
  const [filters, setFilters] = useState<OneTimeAffiliateFilters>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  // Tree-depth toggle for the scoped view:
  //   • false (default) — DIRECTS only: the scoped person's immediate
  //     level-1 referrals.
  //   • true — FULL tree: every generation beneath.
  // Non-buyers are always included in either mode (a scoped table needs
  // to show its whole scope, buyers or not).
  const [includeMembers, setIncludeMembers] = useState(false);
  /**
   * Scoped views list everyone in the tree, buyers and non-buyers alike. This
   * narrows them to people who actually paid for the $25 licence — a view that
   * can stand as proof of who has paid, rather than a mixed list that needs
   * explaining. Only offered while scoped: unscoped, the table is buyers-only
   * already.
   */
  // Country/state/city options for the drawer's location pickers, served
  // alongside the rows so the admin picks real values instead of guessing
  // spellings ("Bengaluru", not "Bangalore").
  const [locations, setLocations] = useState<LocationFacet[]>([]);
  const [exporting, setExporting] = useState(false);
  // Invoice number whose detail drawer is open (null = closed). Set by
  // clicking an invoice number in the table.
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  // Person side panel (Open View / View Profile), opened from the Name or
  // Upline Details cell.
  const [panelPerson, setPanelPerson] = useState<UserSummary>(null);
  const router = useRouter();

  // The "Entire Company" scope selector, row-level "Open View", and the
  // filter drawer's Downline / Sponsor field are all the SAME scoping —
  // every one of them sends ?rootUserId. They read and write this single
  // derived value, so no two can disagree about what the table is showing.
  const viewAsUser: ScopePerson | null = filters.uplineUserId
    ? {
        _id: filters.uplineUserId,
        name: filters.uplineUserName ?? filters.uplineUserEmail ?? null,
        email: filters.uplineUserEmail ?? null,
        avatar: filters.uplineUserAvatar ?? null,
        country: filters.uplineUserCountry ?? null,
      }
    : null;
  const setViewAsUser = (person: Partial<ScopePerson> | null) =>
    setFilters((f) => ({
      ...f,
      uplineUserId: person?._id,
      uplineUserName: person?.name ?? undefined,
      uplineUserEmail: person?.email ?? undefined,
      uplineUserAvatar: person?.avatar ?? undefined,
      uplineUserCountry: person?.country ?? undefined,
    }));

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
  }, [pageSize, page, sort, debouncedSearch, filters, includeMembers]);

  // Any change to filters/sort/search bounces the page back to 1 so we don't
  // land on an out-of-range offset for the newly narrowed result set.
  useEffect(() => {
    setPage(1);
  }, [sort, debouncedSearch, filters, includeMembers]);

  /**
   * The current view as a query string. Shared by the table load and the CSV
   * export so an export can never describe a different result set than the
   * rows on screen — only limit/offset differ.
   */
  function buildQuery(limit: number, offset: number): URLSearchParams {
    const qs = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (sort?.by) {
      qs.set("sortBy", sort.by);
      qs.set("sortOrder", sort.order);
    }
    if (debouncedSearch) qs.set("q", debouncedSearch);
    // Filter drawer — a query layer on this same endpoint, not a separate
    // search route. Also emits ?rootUserId for the downline scoping, so
    // Open View and the drawer's person picker share one code path.
    applyFiltersToQuery(qs, filters);
    // Tree-depth for the scoped view. Only meaningful with a scope — the
    // backend ignores it otherwise, but don't send noise.
    if (filters.uplineUserId) {
      qs.set("treeScope", includeMembers ? "full" : "directs");
    }
    return qs;
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = buildQuery(pageSize, (page - 1) * pageSize);
      const res = await garageAdminApi<{
        data: Row[];
        stats: Stats;
        locations?: LocationFacet[];
        pagination: { total: number };
      }>(`/garage-admin/one-time-affiliates?${qs.toString()}`, {
        method: "GET",
      });
      setRows(res?.data || []);
      setLocations(res?.locations || []);
      setStats(
        res?.stats || {
          affiliates: 0,
          totalLicenses: 0,
          activeLicenses: 0,
          reservedLicenses: 0,
          totalRevenue: 0,
        }
      );
      setTotal(res?.pagination?.total || 0);
    } catch (error: any) {
      const msg = error?.message || "Failed to load One Time Affiliates";
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

  /**
   * Export EVERY row matching the current filters/search/sort, not just the
   * page on screen. The endpoint caps `limit` at 200, so walk it a page at a
   * time — safe only because the backend sort is fully deterministic
   * (explicit tie-break on _id), so consecutive pages can't overlap or skip.
   */
  async function handleExport() {
    setExporting(true);
    try {
      const all: Row[] = [];
      let offset = 0;
      for (;;) {
        const res = await garageAdminApi<{
          data: Row[];
          pagination: { total: number };
        }>(
          `/garage-admin/one-time-affiliates?${buildQuery(
            EXPORT_PAGE_SIZE,
            offset
          ).toString()}`,
          { method: "GET" }
        );
        const batch = res?.data || [];
        all.push(...batch);
        const matching = res?.pagination?.total ?? all.length;
        offset += EXPORT_PAGE_SIZE;
        // Stop on a short/empty page as well as on the count, so a backend
        // hiccup can't spin this loop forever.
        if (batch.length < EXPORT_PAGE_SIZE || all.length >= matching) break;
      }

      if (all.length === 0) {
        toast.message("Nothing to export — no rows match these filters");
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const n = exportRowsAsCsv(
        all,
        CSV_COLUMNS,
        `one-time-affiliates-${stamp}.csv`
      );
      toast.success(
        `Exported ${n} affiliate${n === 1 ? "" : "s"}${
          hasAnyFilter(filters) || debouncedSearch ? " (filtered)" : ""
        }`
      );
    } catch (error: any) {
      toast.error(error?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const [assignFor, setAssignFor] = useState<Row | null>(null);
  const [igniteSubject, setIgniteSubject] = useState<Row | null>(null);
  const [igniteRelated, setIgniteRelated] = useState<Row | null>(null);
  // The two writes on this page are now independently grantable: assigning a
  // support agent and marking the NVC chat each has its own permission (either
  // page-manage or the specific action, on One Time Affiliates or NetworkChain
  // Subs). A view-only admin sees the values but no controls. Super admins can.
  const { canDoAction } = useAdminAccess();
  const canAssignAgent = canDoAction("one_time_affiliates", "assign-agent");
  const canMarkNvc = canDoAction("one_time_affiliates", "mark-nvc");

  // Patch the row in place rather than refetching the page: the assignment is
  // the only thing that changed.
  function applyAssignment(userId: string, agent: AssignedAgent | null) {
    setRows((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, assignedTo: agent } : r)),
    );
  }

  // "NVC chat created" is MARKED by an admin — the chat happens off-platform,
  // so there is nothing to derive it from. Optimistic: flip the cell, then
  // roll back if the write fails, so ticking a long list stays responsive.
  async function toggleNvcChat(row: Row) {
    if (!row.userId || !canMarkNvc) return;
    const next = !row.hasNvcChat;
    setRows((prev) =>
      prev.map((r) => (r.userId === row.userId ? { ...r, hasNvcChat: next } : r)),
    );
    try {
      await garageAdminApi(`/garage-admin/users/${row.userId}/nvc-chat`, {
        method: "POST",
        body: JSON.stringify({ created: next }),
      });
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) =>
          r.userId === row.userId ? { ...r, hasNvcChat: !next } : r,
        ),
      );
      toast.error(e?.message || "Couldn't update NVC chat");
    }
  }

  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      buildColumns(
        (n) => setOpenInvoice(n),
        (p) => setPanelPerson(p),
        (r) => setAssignFor(r),
        canAssignAgent,
        toggleNvcChat,
        canMarkNvc,
        (r) => setIgniteSubject(r),
        (r) => setIgniteRelated(r),
      ),
    // toggleNvcChat is stable for the life of the page (it only calls
    // setRows, which React guarantees is stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canAssignAgent, canMarkNvc],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return `${from} to ${to}`;
  }, [page, pageSize, total]);

  return (
    // Break out of the admin shell's px-8/pt-7/pb-8 gutters so this table
    // runs edge-to-edge. The surface is the SAME #181818 passed to the table
    // as stickyBg, so the sticky header and frozen column are indistinguishable
    // from the rows behind them — one flat colour, no banding.
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#181818]">
      <OneTimeAffiliatesFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onApply={setFilters}
        locations={locations}
      />
      {/* "Entire Company" scope switcher — writes the same scope state as
          Open View and the drawer's Downline / Sponsor field. */}
      <CompanyScopeDialog
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        active={viewAsUser}
        onSelect={setViewAsUser}
      />
      {/* Invoice detail — opens in-page when an invoice number is clicked. */}
      {/* Assign a support agent. The assignment is stored on the USER, so it
          is the same one the NetworkChain Subs table shows for this person. */}
      <AssignAgentDialog
        subject={assignFor}
        onClose={() => setAssignFor(null)}
        onAssigned={applyAssignment}
        canAssign={canAssignAgent}
      />

      {/* Ignite call — the NetworkChains catch-up drawer, scheduled under the
          affiliate's assigned agent. The link lives on the neutral
          ignite-call endpoint. */}
      <IgniteCallScheduleDrawer
        subject={igniteSubject}
        onClose={() => setIgniteSubject(null)}
        onSaved={(userId, call) =>
          setRows((prev) =>
            prev.map((r) => (r.userId === userId ? { ...r, igniteCall: call } : r)),
          )
        }
      />
      <IgniteCallDrawer
        userId={igniteRelated?.userId ?? null}
        callId={igniteRelated?.igniteCall?.id ?? null}
        personName={igniteRelated?.user?.name ?? null}
        onClose={() => setIgniteRelated(null)}
        canEdit={canAssignAgent}
        onDetached={() => {
          // Don't locally blank the row: with more than one attached call
          // the backend's `newestLiveCall` surfaces the NEXT non-detached
          // call on reload, so a local "Not Scheduled" would contradict the
          // very next refresh. Refetch from the existing list load instead.
          void load();
        }}
      />

      <InvoiceDetailDrawer
        invoiceNumber={openInvoice}
        onClose={() => setOpenInvoice(null)}
      />
      {/* Person side panel — opens from the Name / Upline Details cells. */}
      <AffiliateMemberDrawer
        person={panelPerson}
        onClose={() => setPanelPerson(null)}
        onOpenView={(p) => {
          // Carry the avatar/country too so the scope button renders the
          // same chip whether the scope came from here or the selector.
          setViewAsUser({
            _id: p._id,
            name: p.name,
            email: p.email,
            avatar: p.profilePicture,
            country: p.country,
          });
          setPanelPerson(null);
        }}
      />
      {/* Open View banner — reflects the current tree-depth toggle. */}
      {viewAsUser && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#FFC200]/25 bg-[#FFC200]/[0.06] px-4 py-2.5">
          <div className="min-w-0 text-[13px] text-zinc-200">
            Viewing{" "}
            <span className="font-semibold text-white">
              {viewAsUser.name || "this user"}
            </span>
            &apos;s {includeMembers ? "full downline" : "direct referrals"}
            {total > 0 && (
              <span className="text-zinc-400">
                {" "}
                — {total} affiliate{total === 1 ? "" : "s"}
              </span>
            )}
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
            Couldn&apos;t load One Time Affiliates
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
          tableId="garage-admin-one-time-affiliates-v1"
          stickyBg="#181818"
          columns={columns}
          rows={rows}
          getRowId={(r) => r._id}
          loading={loading}
          // A blank table under an active filter isn't "none exist yet" —
          // say which narrowing produced nothing so it doesn't read as a
          // broken page.
          emptyLabel={
            viewAsUser
              ? `${viewAsUser.name || "This person"} has no One Time Affiliates in their organisation.`
              : hasAnyFilter(filters) || debouncedSearch
                ? "No One Time Affiliates match these filters."
                : "No One Time Affiliates yet."
          }
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
                filterActive={hasAnyFilter(filters)}
                onExport={handleExport}
                exporting={exporting}
                exportCount={total}
                scopePerson={viewAsUser}
                onOpenScope={() => setScopeOpen(true)}
                includeMembers={includeMembers}
                onToggleMembers={() => setIncludeMembers((v) => !v)}
              />
            )
          }
          footerTotals={[
            { label: "Affiliates", value: stats.affiliates },
            // No "Downline Members" tile: the table lists licence holders
            // only, scoped or not, so it would just repeat Affiliates.
            { label: "Total Licenses", value: stats.totalLicenses },
            { label: "Active Licenses", value: stats.activeLicenses },
            { label: "Reserved Licenses", value: stats.reservedLicenses },
            {
              label: "Total Revenue",
              value: formatMoney(stats.totalRevenue, "USD"),
            },
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

/* ── Top bars ── */

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
  );
}

function TopBar({
  onOpenFilters,
  filterActive,
  onExport,
  exporting,
  exportCount,
  scopePerson,
  onOpenScope,
  includeMembers,
  onToggleMembers,
}: {
  onOpenFilters: () => void;
  filterActive: boolean;
  onExport: () => void;
  exporting: boolean;
  /** Rows the export will write — the filtered total, not the page. */
  exportCount: number;
  /** Active view scope; null = Entire Company. */
  scopePerson: ScopePerson | null;
  onOpenScope: () => void;
  /** Tree depth for the scoped view: full tree vs. direct referrals. Rows
   *  are licence holders either way. */
  includeMembers: boolean;
  onToggleMembers: () => void;
  /** Hide people in the scope who never bought the $25 licence. */
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
        {/* Scope switcher. Shows the scoped member once one is picked, so
            the table's scope is readable without opening anything. */}
        <button
          type="button"
          onClick={onOpenScope}
          aria-label="Change view scope"
          title={
            scopePerson
              ? `Viewing ${scopePerson.name || "member"}'s organisation — click to change`
              : "Viewing the entire company — click to scope to a member"
          }
          className={`flex h-9 max-w-[260px] items-center gap-2 rounded-full border pl-3 pr-3 text-sm transition-colors ${
            scopePerson
              ? "border-[#FBD10D]/40 bg-[#FBD10D]/10 text-[#FBD10D]"
              : "border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06]"
          }`}
        >
          {scopePerson ? (
            <>
              <ScopeAvatar
                src={scopePerson.avatar}
                name={scopePerson.name || scopePerson.email}
                className="h-5 w-5"
              />
              <span className="truncate">
                {scopePerson.name || scopePerson.email || "Member"}
              </span>
            </>
          ) : (
            <>
              <BrandDot className="h-4 w-4" />
              Entire Company
            </>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 ${
              scopePerson ? "text-[#FBD10D]/70" : "text-zinc-500"
            }`}
          />
        </button>

        {/* Tree-depth switch. OFF = directs (level 1); ON = full tree.
            Only offered when scoped — unscoped it would mean "every user
            in the system", which is a different table. */}
        {scopePerson && (
          <button
            type="button"
            onClick={onToggleMembers}
            role="switch"
            aria-checked={includeMembers}
            title={
              includeMembers
                ? "Showing the entire tree beneath this person (all generations)"
                : "Showing this person's direct referrals only (level 1)"
            }
            className={`flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
              includeMembers
                ? "border-white/[0.14] bg-white/[0.06] text-zinc-100"
                : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"
            }`}
          >
            <span
              className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                includeMembers ? "bg-[#FBD10D]" : "bg-white/[0.14]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-black transition-all ${
                  includeMembers ? "left-3.5" : "left-0.5 bg-zinc-400"
                }`}
              />
            </span>
            Full downline
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={exporting || exportCount === 0}
          className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-40 disabled:hover:bg-white/[0.03]"
          title={
            exportCount === 0
              ? "Nothing to export"
              : `Export all ${exportCount} matching rows as CSV`
          }
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exporting ? "Exporting…" : "Export"}
        </button>
      </div>
    </div>
  );
}

/* ── Column definitions ── */

/** Yes/No that an admin sets. Click to toggle — this is where you "mark that
 *  his NVC chat has been created". */
function NvcChatCell({
  row,
  onToggle,
  canToggle,
}: {
  row: Row;
  onToggle: (row: Row) => void;
  canToggle: boolean;
}) {
  if (!row.userId) return <span className="text-zinc-600">—</span>;
  const yes = row.hasNvcChat;
  // View-only admins see the state but can't change it — a static chip, not a
  // button that would only ever 403.
  if (!canToggle) {
    return (
      <span
        className={
          yes
            ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[12px] font-semibold text-emerald-400"
            : "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-zinc-400"
        }
      >
        {yes ? "Yes" : "No"}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={yes ? "NVC chat created — click to unmark" : "Mark NVC chat as created"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(row);
      }}
      className={
        yes
          ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[12px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
          : "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-zinc-400 transition-colors hover:bg-white/[0.09] hover:text-zinc-200"
      }
    >
      {yes ? "Yes" : "No"}
    </button>
  );
}

function buildColumns(
  onInvoiceClick: (invoiceNumber: string) => void,
  onOpenPerson: (u: UserSummary) => void,
  onAssign: (row: Row) => void,
  canAssign: boolean,
  onToggleNvcChat: (row: Row) => void,
  canToggleNvcChat: boolean,
  onScheduleIgniteCall: (row: Row) => void,
  onOpenIgniteRelated: (row: Row) => void,
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
      cell: (r) => (
        <div className="cursor-pointer" onClick={() => onOpenPerson(r.user)}>
          <UserCell u={r.user} member={r.isOneTimeAffiliate === false} />
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
      // Opens the panel for the UPLINE person, not the row's affiliate.
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
      id: "location",
      header: "Location",
      width: 200,
      minWidth: 160,
      sortable: true,
      filterable: true,
      cell: (r) => <LocationCell loc={r.location} />,
    },
    {
      id: "hasNvcChat",
      header: "NVC Chat",
      width: 110,
      minWidth: 90,
      sortable: true,
      filterable: true,
      cell: (r) => (
        <NvcChatCell
          row={r}
          onToggle={onToggleNvcChat}
          canToggle={canToggleNvcChat}
        />
      ),
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
    // Deliberately not sortable/filterable, same reasoning as assignedTo:
    // this table paginates server-side and the status is derived
    // cross-service, so it cannot be ordered or filtered over the full
    // result set.
    {
      id: "igniteCall",
      header: "Ignite Call Status",
      width: 200,
      minWidth: 180,
      cell: (r) => (
        <IgniteCallCell
          row={r}
          canEdit={canAssign}
          onSchedule={onScheduleIgniteCall}
          onOpenRelated={onOpenIgniteRelated}
        />
      ),
      skeleton: (
        <div className="flex flex-col gap-1">
          <div className="h-4 w-24 rounded bg-white/10" />
          <div className="h-3 w-16 rounded bg-white/5" />
        </div>
      ),
    },
    {
      id: "joining",
      header: "Joining Date",
      width: 170,
      minWidth: 150,
      sortable: true,
      filterable: true,
      cell: (r) => <JoiningCell joining={r.joining} />,
    },
    {
      id: "activation",
      header: "Activation Date",
      width: 170,
      minWidth: 150,
      sortable: true,
      filterable: true,
      cell: (r) => {
        const paymentLabel = formatPaymentLabel(r.activation, r.licenseSource);
        return (
          <div className="leading-tight">
            <div className="text-[13px] text-zinc-200">
              {formatShortDate(r.activation.date)}
            </div>
            {r.activation.invoiceNumber && (
              <div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInvoiceClick(r.activation.invoiceNumber!);
                  }}
                  className="text-[11px] text-zinc-500 underline underline-offset-2 hover:text-[#FBD10D]"
                >
                  {r.activation.invoiceNumber}
                </button>
              </div>
            )}
            <SavedInstrumentChips saved={r.savedInstruments} />
            {paymentLabel && (
              <div className="mt-0.5 text-[11px] text-zinc-400">
                {paymentLabel}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "reserves",
      header: "Reserves",
      width: 100,
      minWidth: 80,
      align: "center",
      sortable: true,
      cell: (r) => <span className="text-zinc-200">{r.reserves}</span>,
    },
    {
      id: "assigned",
      header: "Assigned",
      width: 100,
      minWidth: 80,
      align: "center",
      sortable: true,
      cell: (r) => <span className="text-zinc-200">{r.assigned}</span>,
    },
    {
      id: "directs",
      header: "Directs",
      width: 100,
      minWidth: 80,
      align: "center",
      sortable: true,
      cell: (r) => <span className="text-zinc-200">{r.directs}</span>,
    },
    {
      id: "downline",
      header: "Downline",
      width: 100,
      minWidth: 80,
      align: "center",
      // Sortable now that the backend returns a real recursive count — it
      // used to be a hardcoded 0, where sorting would have been a no-op.
      sortable: true,
      cell: (r) => <span className="text-zinc-200">{r.downline}</span>,
    },
    {
      id: "commercials",
      header: "Commercials",
      width: 140,
      minWidth: 120,
      cell: (r) => (
        <CommercialsCell total={r.totalCommercialsUsd} currency={r.currency} />
      ),
    },
    {
      id: "isNetworkChainSubscriber",
      header: "NetworkChain Subscriber",
      width: 170,
      minWidth: 140,
      sortable: true,
      filterable: true,
      cell: (r) => (
        <span
          className={
            r.isNetworkChainSubscriber
              ? "text-emerald-400"
              : "text-zinc-500"
          }
        >
          {r.isNetworkChainSubscriber ? "Yes" : "No"}
        </span>
      ),
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

function UserCell({ u, member }: { u: UserSummary; member?: boolean }) {
  if (!u) return <span className="text-zinc-600">—</span>;
  return (
    <div className="flex items-start gap-2.5 py-1">
      <Avatar src={u.profilePicture} name={u.name || u.email || "?"} />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1">
          <span className="truncate text-[13px] font-medium text-white">
            {u.name || "Unnamed"}
          </span>
          {/* Whole-tree row: in the downline but never bought a licence, so
              the money columns are empty by definition rather than missing. */}
          {member && (
            <span
              className="shrink-0 rounded-full border border-white/[0.12] bg-white/[0.04] px-1.5 py-px text-[9px] uppercase tracking-wider text-zinc-400"
              title="Downline member — has not purchased a $25 licence"
            >
              Member
            </span>
          )}
          <CopyBtn value={u.name} label="name" />
        </div>
        <div className="flex items-center gap-1">
          <span className="truncate text-[11px] text-zinc-400">{u.email}</span>
          <CopyBtn value={u.email} label="email" />
        </div>
        {u.phone && (
          <div className="mt-1 flex items-center gap-1.5">
            {u.country && (
              <span className="text-[13px] leading-none" aria-hidden>
                {getCountryFlag(u.country)}
              </span>
            )}
            <span className="text-[11px] text-zinc-300">{u.phone}</span>
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
        className="h-9 w-9 shrink-0 rounded-full border border-white/[0.08] object-cover"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-sm font-semibold text-black">
      {initial}
    </div>
  );
}

function LocationCell({ loc }: { loc: Row["location"] }) {
  if (!loc || (!loc.city && !loc.state && !loc.country))
    return <span className="text-zinc-600">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-[13px] text-zinc-200">{loc.city || "—"}</div>
      {loc.state && (
        <div className="text-[12px] text-zinc-400">{loc.state}</div>
      )}
      {loc.country && (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[13px] leading-none" aria-hidden>
            {getCountryFlag(loc.country)}
          </span>
          <span className="text-[12px] text-zinc-300">{loc.country}</span>
        </div>
      )}
    </div>
  );
}

function JoiningCell({ joining }: { joining: Row["joining"] }) {
  return (
    <div className="leading-tight">
      <div className="text-[13px] text-zinc-200">
        {formatShortDate(joining.date)}
      </div>
      {joining.firstOffice && (
        <div className="mt-1 flex items-center gap-1.5">
          {joining.firstOffice.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={joining.firstOffice.icon}
              alt=""
              className="h-4 w-4 rounded-full object-cover"
            />
          ) : (
            <span className="inline-block h-4 w-4 rounded-full bg-white/[0.06]" />
          )}
          <span className="truncate text-[12px] text-zinc-300">
            {joining.firstOffice.name || "Office"}
          </span>
        </div>
      )}
    </div>
  );
}

function CommercialsCell({
  total,
  currency,
}: {
  total: number;
  currency: string;
}) {
  if (!total || total <= 0) return <span className="text-zinc-600">—</span>;
  return (
    <span className="text-[13px] font-medium tabular-nums text-emerald-400">
      {formatMoney(total, currency || "USD")}
    </span>
  );
}

/* ── helpers ── */

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

/** YYYY-MM-DD for CSV cells — sorts correctly in a spreadsheet, unlike "Aug 21, 2026". */
function isoDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
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

/**
 * Pretty-format payment method along with payment platform / type.
 * e.g. "UPI (Razorpay)", "Card (Stripe)", "Crypto (USDT)", "Store Wallet", "Assigned (Reserve)".
 */
function formatPaymentLabel(
  activation?: Row["activation"] | null,
  licenseSource?: string | null
): string | null {
  if (!activation) return null;

  if (licenseSource === "assigned" && !activation.invoiceNumber) {
    return "Assigned (Reserve)";
  }

  const method = activation.paymentMethod?.toLowerCase().trim();
  const platform = activation.paymentPlatform?.toLowerCase().trim();
  const coin = activation.cryptoCoin?.toUpperCase().trim();
  const chain = activation.cryptoChain?.toUpperCase().trim();

  // Known platform names
  const PLATFORM_NAMES: Record<string, string> = {
    razorpay: "Razorpay",
    stripe: "Stripe",
    phonepe: "PhonePe",
    paytm: "Paytm",
    openmoney: "OpenMoney",
    square: "Square",
    crypto_wallet: "Crypto",
    store_wallet: "Store Wallet",
    affiliate_wallet: "Affiliate Wallet",
    auction_wallet: "Auction Wallet",
    reserve_pool: "Reserve Pool",
  };

  // Known method names
  const METHOD_NAMES: Record<string, string> = {
    card: "Card",
    upi: "UPI",
    crypto: "Crypto",
    wallet: "Wallet",
    assigned: "Assigned",
  };

  if (method === "crypto" || platform === "crypto_wallet") {
    if (coin && chain) return `Crypto (${coin} · ${chain})`;
    if (coin) return `Crypto (${coin})`;
    if (chain) return `Crypto (${chain})`;
    return "Crypto";
  }

  if (platform === "store_wallet") {
    return activation.storeName
      ? `Store Wallet (${activation.storeName})`
      : "Store Wallet";
  }
  if (platform === "affiliate_wallet") return "Affiliate Wallet";
  if (platform === "auction_wallet") return "Auction Wallet";
  if (method === "assigned" || platform === "reserve_pool") {
    return "Assigned (Reserve)";
  }

  const methodLabel = method ? METHOD_NAMES[method] || method : null;
  const platformLabel = platform ? PLATFORM_NAMES[platform] || platform : null;

  if (
    methodLabel &&
    platformLabel &&
    methodLabel.toLowerCase() !== platformLabel.toLowerCase()
  ) {
    return `${methodLabel} (${platformLabel})`;
  }
  if (methodLabel) return methodLabel;
  if (platformLabel) return platformLabel;
  if (activation.paymentMode) return activation.paymentMode;

  return null;
}

