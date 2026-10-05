"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Check, X, Shield, Hash, CalendarClock } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { TableTopBar, type TopBarView } from "@/components/data-table/TableTopBar";
import {
  AppliedFilterChips,
  type FilterChip,
} from "@/components/data-table/AppliedFilterChips";
import { SelectionBar } from "@/components/data-table/SelectionBar";
import {
  FilterDrawer,
  facetField,
  numericRangeField,
  type FilterField,
} from "@/components/data-table/FilterDrawer";
import type { ColumnDef, SortState } from "@/components/data-table/types";
import { ExportPanel, ExportButton, type ExportField } from "@/components/data-table/ExportPanel";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
  getSubscriptionUsers,
  activateSubscription,
  expireSubscription,
  AdminUnauthorizedError,
  type SubUser,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { useAdminSearch } from "@/components/garage-admin/admin-search";

type StatusView = "all" | "active" | "expired";
interface SubFilters {
  role?: string;
  payMin?: number;
  payMax?: number;
  daysMin?: number;
  daysMax?: number;
}
const RPP_OPTIONS = [10, 20, 50, 100];

/** CSV columns for the subscriptions table (export order). */
const SUB_EXPORT_FIELDS: ExportField<SubUser>[] = [
  { key: "name", label: "Name", value: (u) => u.name ?? "" },
  { key: "email", label: "Email", value: (u) => u.email ?? "" },
  { key: "role", label: "Role", value: (u) => u.role ?? "" },
  { key: "status", label: "Status", value: (u) => (u.isActive ? "Active" : "Expired") },
  { key: "statusRaw", label: "Status Detail", value: (u) => u.status ?? "" },
  { key: "renews", label: "Days Remaining", value: (u) => u.daysRemaining ?? 0 },
  { key: "periodEnd", label: "Current Period End", value: (u) => u.currentPeriodEnd ?? "" },
  { key: "payments", label: "Payments", value: (u) => u.paymentCount ?? 0 },
  { key: "userId", label: "User ID", value: (u) => u.userId ?? "" },
];


function rangeText(min?: number, max?: number, unit = ""): string {
  const u = unit ? ` ${unit}` : "";
  if (min != null && max != null) return `${min}${u} – ${max}${u}`;
  if (min != null) return `≥ ${min}${u}`;
  return `≤ ${max}${u}`;
}

export default function SubscriptionsPage() {
  // Server returns the current page + full-set aggregates (counts, role facets)
  // so the view tabs and Role filter stay correct regardless of the page.
  const [rows, setRows] = useState<SubUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activeCount, setActiveCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const { ready: accessReady, canManage } = useAdminAccess();
  const [roles, setRoles] = useState<{ value: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { query: search } = useAdminSearch();
  const debouncedSearch = useDebouncedValue(search, 300);
  const [view, setView] = useState<StatusView>("all");
  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<SubFilters>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  // Caps the auth-recovery retry to one attempt per failure episode — see
  // fetchUsers below. Without this, an operator de-allowlisted at the
  // endpoint level but still elevatable would loop forever hammering the
  // backend. Re-arms on the next successful fetch.
  const recoveryAttempted = useRef(false);

  // The filter/sort/page params sent to the server (shared by the table fetch
  // and the CSV export so both describe the same view).
  const queryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      view,
      role: filters.role,
      payMin: filters.payMin,
      payMax: filters.payMax,
      daysMin: filters.daysMin,
      daysMax: filters.daysMax,
      sortBy: sort?.by,
      sortOrder: sort?.order,
    }),
    [debouncedSearch, view, filters, sort],
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getSubscriptionUsers({ ...queryParams, page, limit });
      setRows(r.data);
      setTotal(r.total);
      setTotalPages(r.totalPages);
      setActiveCount(r.activeCount);
      setExpiredCount(r.expiredCount);
      setRoles(r.roles);
      setError("");
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        // Recover by silently re-elevating from the Garage session rather than
        // reloading, which would drop the operator out of the Garage shell.
        // lib/nc-admin-api/auth.ts already clears the stale NC token on every
        // path that throws this error, so no page-level clear is needed here.
        if (recoveryAttempted.current) return; // one attempt per failure episode
        recoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchUsers();
          }
        });
        return;
      }
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [queryParams, page, limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Bulk action over the current selection (the Bigin selection-bar pattern
  // replaces the per-row action column).
  const runBulk = useCallback(
    async (label: string, fn: (id: string) => Promise<unknown>) => {
      const ids = [...selectedIds];
      if (ids.length === 0) return;
      setBulkBusy(true);
      setError("");
      try {
        await Promise.all(ids.map((id) => fn(id)));
        await fetchUsers();
        setSelectedIds(new Set());
      } catch {
        setError(`Failed to ${label} some members`);
      } finally {
        setBulkBusy(false);
      }
    },
    [selectedIds, fetchUsers],
  );

  // Row selection exists solely to drive Activate/Expire, both of which are
  // writes contacts-backend refuses without "Full" on NC · Revenue. So a
  // view-only grant gets a plain read-only table: no checkboxes, no action
  // bar, rather than selection that leads to a 403.
  const canManageSubs = accessReady && canManage("nc_subscriptions");

  const handleBulkActivate = () =>
    runBulk("activate", (id) => activateSubscription(id, 30));
  const handleBulkExpire = () => {
    if (!window.confirm(`Expire ${selectedIds.size} subscription(s) immediately?`)) return;
    runBulk("expire", (id) => expireSubscription(id));
  };

  // Filter/sort/paginate now happen SERVER-SIDE (see queryParams + fetchUsers).
  // Any change to the filter/sort inputs returns to page 1 → page-0 refetch.
  useEffect(() => setPage(1), [queryParams, limit]);

  const currentPage = Math.min(page, totalPages);

  // Row selection (drives the Bigin bulk-action bar). Select-all toggles the
  // current page; the selection set itself persists across pages.
  const pageIds = rows.map((u) => u.userId);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (pageIds.every((id) => n.has(id))) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });

  const views: TopBarView[] = [
    { id: "all", label: "All Members", count: activeCount + expiredCount },
    { id: "active", label: "Active", count: activeCount },
    { id: "expired", label: "Expired", count: expiredCount },
  ];

  // Distinct roles + counts (full-set facets from the server) → Role options.
  const roleOptions = useMemo(
    () =>
      roles.map((r) => ({
        value: r.value,
        label: r.value,
        sub: `${r.count} users`,
      })),
    [roles],
  );

  const fields = useMemo<FilterField<SubFilters>[]>(
    () => [
      facetField<SubFilters>({
        id: "role",
        label: "Role",
        icon: Shield,
        allLabel: "All roles",
        options: (q) =>
          roleOptions.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase())),
        selected: (d) => (d.role ? new Set([d.role]) : new Set()),
        apply: (d, values) => ({ ...d, role: [...values][0] }),
      }),
      numericRangeField<SubFilters>({
        id: "payments",
        label: "Payments",
        icon: Hash,
        get: (d) => ({ min: d.payMin, max: d.payMax }),
        set: (d, r) => ({ ...d, payMin: r.min, payMax: r.max }),
      }),
      numericRangeField<SubFilters>({
        id: "renews",
        label: "Renews (days left)",
        icon: CalendarClock,
        unit: "d",
        get: (d) => ({ min: d.daysMin, max: d.daysMax }),
        set: (d, r) => ({ ...d, daysMin: r.min, daysMax: r.max }),
      }),
    ],
    [roleOptions],
  );

  const filterActive =
    !!filters.role ||
    filters.payMin != null ||
    filters.payMax != null ||
    filters.daysMin != null ||
    filters.daysMax != null;

  // Applied-filter chips (Bigin: active criteria stay visible + removable).
  const chips: FilterChip[] = [];
  if (view !== "all") {
    chips.push({
      id: "view",
      label: `Status: ${view === "active" ? "Active" : "Expired"}`,
      onClear: () => setView("all"),
    });
  }
  if (filters.role) {
    chips.push({
      id: "role",
      label: `Role: ${filters.role}`,
      onClear: () => setFilters((f) => ({ ...f, role: undefined })),
    });
  }
  if (filters.payMin != null || filters.payMax != null) {
    chips.push({
      id: "payments",
      label: `Payments: ${rangeText(filters.payMin, filters.payMax)}`,
      onClear: () => setFilters((f) => ({ ...f, payMin: undefined, payMax: undefined })),
    });
  }
  if (filters.daysMin != null || filters.daysMax != null) {
    chips.push({
      id: "renews",
      label: `Renews: ${rangeText(filters.daysMin, filters.daysMax, "d")}`,
      onClear: () => setFilters((f) => ({ ...f, daysMin: undefined, daysMax: undefined })),
    });
  }

  const columns = useMemo<ColumnDef<SubUser>[]>(
    () => [
      {
        id: "user",
        header: "User",
        frozen: true,
        sortable: true,
        width: 260,
        minWidth: 200,
        cell: (u) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-white">{u.name || "—"}</div>
            <div className="truncate text-[12px] text-zinc-500">{u.email}</div>
          </div>
        ),
      },
      {
        id: "role",
        header: "Role",
        sortable: true,
        filterable: true,
        width: 130,
        cell: (u) => (
          <span className="text-[12px] uppercase tracking-wide text-zinc-400">
            {u.role || "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        width: 130,
        cell: (u) =>
          u.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">
              <Check className="h-3 w-3" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-400">
              <X className="h-3 w-3" /> {u.status === "none" ? "Never" : "Expired"}
            </span>
          ),
      },
      {
        id: "renews",
        header: "Renews",
        sortable: true,
        filterable: true,
        width: 130,
        cell: (u) => (
          <span className="text-zinc-300">
            {u.isActive ? `${u.daysRemaining}d left` : "—"}
          </span>
        ),
      },
      {
        id: "payments",
        header: "Payments",
        sortable: true,
        filterable: true,
        width: 120,
        align: "right",
        cell: (u) => <span className="tabular-nums text-zinc-300">{u.paymentCount}</span>,
      },
    ],
    [],
  );

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808] text-white">
      {/* Slim module header (Bigin keeps a module title above the toolbar). */}
      <div className="flex-none px-4 pt-5">
        <h1 className="text-lg font-semibold tracking-tight">Subscription Management</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Activate or expire member subscriptions
        </p>
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <DataTable<SubUser>
          tableId="admin-subscriptions"
          columns={columns}
          rows={rows}
          getRowId={(u) => u.userId}
          loading={loading}
          emptyLabel="No members match this view."
          rowHeight="auto"
          headerHeight={48}
          stickyBg="#181818"
          sort={sort}
          onSortChange={setSort}
          onColumnFilter={() => setDrawerOpen(true)}
          selectable={canManageSubs}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          allSelected={allSelected}
          topBar={
            selectedIds.size > 0 && canManageSubs ? (
              <SelectionBar
                count={selectedIds.size}
                onClear={() => setSelectedIds(new Set())}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={handleBulkActivate}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {bulkBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Activate +30d
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkExpire}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-red-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      Expire
                    </button>
                  </>
                }
              />
            ) : (
              <>
                <TableTopBar
                  views={views}
                  activeView={view}
                  onViewChange={(v) => setView(v as StatusView)}
                  onOpenFilters={() => setDrawerOpen(true)}
                  filterActive={filterActive}
                  actions={<ExportButton onClick={() => setExportOpen(true)} />}
                />
                <AppliedFilterChips
                  chips={chips}
                  onClearAll={() => {
                    setView("all");
                    setFilters({});
                  }}
                />
              </>
            )
          }
          footerTotals={[{ label: "Total Members", value: total }]}
          pagination={{
            page: currentPage,
            totalPages,
            rangeLabel: rangeLabel(currentPage, limit, total),
            recordsPerPage: limit,
            recordsPerPageOptions: RPP_OPTIONS,
            onPrev: () => setPage((p) => Math.max(1, p - 1)),
            onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
            onRecordsPerPageChange: setLimit,
          }}
        />
      </div>

      <FilterDrawer<SubFilters>
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        fields={fields}
        value={filters}
        onApply={setFilters}
      />

      <ExportPanel<SubUser>
        open={exportOpen}
        onOpenChange={setExportOpen}
        fields={SUB_EXPORT_FIELDS}
        // Pull every row matching the current filters/sort, page by page.
        fetchAll={async () => {
          const out: SubUser[] = [];
          for (let p = 1; ; p++) {
            const r = await getSubscriptionUsers({ ...queryParams, page: p, limit: 500 });
            out.push(...r.data);
            if (r.data.length === 0 || out.length >= r.total) break;
          }
          return out;
        }}
        filenameBase="admin-subscriptions"
      />
    </div>
  );
}

function rangeLabel(page: number, limit: number, total: number): string {
  if (total === 0) return "0";
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return `${from} to ${to}`;
}
