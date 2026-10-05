"use client";

/**
 * Founder console → Orders, as a Bigin-style data grid.
 *
 * ONE component for every item type the endpoint serves. Mounted today at
 * Communities → Orders, Digital Products → Orders, Digital Products →
 * Customers and Courses → Orders; `itemType` is the only difference between
 * them. (Live Streams → Orders still uses the older shared
 * `FounderInvoicesPage`.)
 *
 * Replaces the 240px-sidebar + card-panel layout with the same shell the
 * founder Live Streams grid uses: a horizontal top bar, an expandable filter
 * tray, one full-bleed `DataTable`, and a 44px footer status strip. Nothing
 * about the DATA changed — both views still read
 * `GET /feed/founder/invoices` and `GET /feed/founder/item-users`.
 *
 * NO SELECTION COLUMN. `selectable` is deliberately not passed to DataTable:
 * a row here has exactly one action (open the invoice / open the customer
 * drawer), so a tick would arm a bulk action that doesn't exist. Invoice
 * Number is the grid's left edge.
 *
 * The page owns the data and the filters; `DataTable` owns the grid chrome
 * (frozen columns, resize/reorder persistence, sticky header, footer).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/DataTable";
import { exportRowsAsCsv } from "@/lib/csvExport";
import {
  getFounderInvoices,
  getFounderItemUsers,
  type ChannelInvoiceStatus,
  type FounderChannelInvoiceRow,
  type FounderInvoicesFilters,
  type FounderItemUserRow,
  type FounderItemUserStatus,
  type FounderItemUsersFilters,
} from "@/lib/feed-api";
import type { FounderInvoiceItemType } from "@/lib/feed-api";
import { UserActivityOverlay } from "@/components/dashboard/UserActivityOverlay";
import {
  buildFounderCustomerColumns,
  buildFounderOrderColumns,
} from "./founderOrderColumns";
import { formatDateTime, sumByCurrency } from "./founderOrderCells";
import { GRID_BG, ROW_H, SHELL_BORDER, SHELL_FOOTER_H } from "../tokens";
import {
  ANY,
  ClearAllButton,
  DateRangeFilter,
  ExportCsvButton,
  FilterGroup,
  FilterToggleButton,
  FilterTray,
  Gold,
  Green,
  GridEmptyState,
  ItemPicker,
  RPP_OPTIONS,
  SearchBox,
  TopBarActions,
  TopBarRow,
  TopBarShell,
  ViewTab,
  ViewTabBar,
  readOrgId,
} from "../chrome";

/**
 * Three real states a founder cares about. "Pending" is a UX bucket that maps
 * to BOTH the DB `draft` and `pending` values (see the BE's
 * `if (status === "pending")` branch in feed.ts — it expands to
 * `{ $in: ["draft", "pending"] }`). Cancelled + Paid map 1:1. The rarer
 * refunded/failed/expired states fold into "Any status" rather than each
 * getting a pill of its own.
 */
const STATUS_OPTIONS: Array<{
  id: ChannelInvoiceStatus | typeof ANY;
  label: string;
}> = [
  { id: ANY, label: "Any status" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "cancelled", label: "Cancelled" },
];

const TYPE_OPTIONS: Array<{ id: "true" | "false" | typeof ANY; label: string }> =
  [
    { id: ANY, label: "Any type" },
    { id: "true", label: "Recurring" },
    { id: "false", label: "One-time" },
  ];

const CURRENCY_OPTIONS: Array<{
  id: "USD" | "INR" | typeof ANY;
  label: string;
}> = [
  { id: ANY, label: "Any currency" },
  { id: "USD", label: "USD" },
  { id: "INR", label: "INR" },
];

type UserStatusOption = {
  id: FounderItemUserStatus | typeof ANY;
  label: string;
};

/**
 * Users-view statuses, per item type.
 *
 * Communities are membership-driven, so they surface the membership states.
 * The other three types have no membership — their status is a roll-up of
 * invoice state, so offering "Cancelling" there would be a filter that can
 * never match.
 */
const USER_STATUS_OPTIONS_CHANNEL: UserStatusOption[] = [
  { id: ANY, label: "Any status" },
  { id: "active", label: "Active" },
  { id: "cancelling", label: "Cancelling" },
  { id: "expired", label: "Expired" },
];

const USER_STATUS_OPTIONS_OTHER: UserStatusOption[] = [
  { id: ANY, label: "Any status" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "refunded", label: "Refunded" },
];

interface FiltersState {
  search: string;
  debouncedSearch: string;
  status: ChannelInvoiceStatus | typeof ANY;
  itemId: string | typeof ANY;
  currency: "USD" | "INR" | typeof ANY;
  isRecurring: "true" | "false" | typeof ANY;
  from: string;
  to: string;
}

const INITIAL_FILTERS: FiltersState = {
  search: "",
  debouncedSearch: "",
  status: ANY,
  itemId: ANY,
  currency: ANY,
  isRecurring: ANY,
  from: "",
  to: "",
};

interface UsersFiltersState {
  search: string;
  debouncedSearch: string;
  status: FounderItemUserStatus | typeof ANY;
  itemId: string | typeof ANY;
  currency: "USD" | "INR" | typeof ANY;
  from: string;
  to: string;
}

const INITIAL_USERS_FILTERS: UsersFiltersState = {
  search: "",
  debouncedSearch: "",
  status: ANY,
  itemId: ANY,
  currency: ANY,
  from: "",
  to: "",
};

type View = "invoices" | "users";

/**
 * The CSV's row shape.
 *
 * `/feed/founder/invoices` returns the generic `itemId`/`itemTitle` pair
 * alongside the legacy channel-named `channelId`/`channelTitle`, but
 * `FounderChannelInvoiceRow` only declares the legacy one. The export has
 * always written the generic columns, so widen rather than silently drop two
 * columns from every founder's spreadsheet.
 */
type ExportRow = FounderChannelInvoiceRow & {
  itemId?: string | null;
  itemTitle?: string | null;
};

export interface FounderOrdersTableProps {
  itemType: FounderInvoiceItemType;
  /** Singular — column header, CSV headers, picker label. */
  itemLabel: string;
  /** Plural — picker placeholder, toast copy, CSV filename. */
  itemLabelPlural: string;
  /** Which view to open on. Defaults to "invoices"; the dedicated Customers
   *  pages pass "users". */
  initialView?: View;
  /**
   * Drop the Invoices/Customers switcher and render `initialView` only.
   *
   * For the dedicated Customers pages, which sit in the nav beside their own
   * Orders entry — offering a second route back to Invoices from there would
   * make two nav items lead to the same screen.
   */
  hideViewSwitch?: boolean;
}

export function FounderOrdersTable({
  itemType,
  itemLabel,
  itemLabelPlural,
  initialView = "invoices",
  hideViewSwitch = false,
}: FounderOrdersTableProps) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Shared between both views — the BE returns the same `items[]` list on
  // either endpoint, so whichever loads first populates the picker.
  const [items, setItems] = useState<{ _id: string; title: string }[]>([]);

  /* ── invoices view ────────────────────────────────────────────────── */
  const [invoices, setInvoices] = useState<FounderChannelInvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [exporting, setExporting] = useState(false);

  /* ── users view ───────────────────────────────────────────────────── */
  // Kept fully independent from the invoices view so switching preserves
  // each side's pagination + filter selection.
  const [users, setUsers] = useState<FounderItemUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(20);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersFilters, setUsersFilters] = useState<UsersFiltersState>(
    INITIAL_USERS_FILTERS,
  );
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  useEffect(() => {
    setOrgId(readOrgId());
  }, []);

  // Debounce the search boxes so the BE isn't hit on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((prev) => ({ ...prev, debouncedSearch: prev.search }));
    }, 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  useEffect(() => {
    const id = setTimeout(() => {
      setUsersFilters((prev) => ({ ...prev, debouncedSearch: prev.search }));
    }, 350);
    return () => clearTimeout(id);
  }, [usersFilters.search]);

  // Any narrowing invalidates the current page number — page 4 of a filter
  // that now returns 12 rows is an empty table.
  useEffect(() => {
    setPage(1);
  }, [
    filters.debouncedSearch,
    filters.status,
    filters.itemId,
    filters.currency,
    filters.isRecurring,
    filters.from,
    filters.to,
    pageSize,
  ]);

  useEffect(() => {
    setUsersPage(1);
  }, [
    usersFilters.debouncedSearch,
    usersFilters.status,
    usersFilters.itemId,
    usersFilters.currency,
    usersFilters.from,
    usersFilters.to,
    usersPageSize,
  ]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const apiFilters: FounderInvoicesFilters = {
        limit: pageSize,
        skip: (page - 1) * pageSize,
        search: filters.debouncedSearch || undefined,
        status: filters.status === ANY ? undefined : filters.status,
        itemId: filters.itemId === ANY ? undefined : filters.itemId,
        currency: filters.currency === ANY ? undefined : filters.currency,
        isRecurring:
          filters.isRecurring === ANY ? undefined : filters.isRecurring,
        from: filters.from || undefined,
        to: filters.to || undefined,
      };
      const res = await getFounderInvoices(orgId, itemType, apiFilters);
      setInvoices(res.invoices);
      setTotal(res.total);
      if (res.items.length) setItems(res.items);
    } catch (err) {
      toast.error(
        (err as Error)?.message ??
          `Failed to load ${itemLabelPlural.toLowerCase()} invoices`,
      );
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    orgId,
    itemType,
    itemLabelPlural,
    page,
    pageSize,
    filters.debouncedSearch,
    filters.status,
    filters.itemId,
    filters.currency,
    filters.isRecurring,
    filters.from,
    filters.to,
  ]);

  useEffect(() => {
    // A dedicated Customers page can never reach the invoices view, so its
    // data never renders — skip the round-trip entirely.
    if (hideViewSwitch && view !== "invoices") return;
    load();
  }, [load, hideViewSwitch, view]);

  const loadUsers = useCallback(async () => {
    if (!orgId) return;
    setUsersLoading(true);
    try {
      const apiFilters: FounderItemUsersFilters = {
        limit: usersPageSize,
        skip: (usersPage - 1) * usersPageSize,
        q: usersFilters.debouncedSearch || undefined,
        status: usersFilters.status === ANY ? undefined : usersFilters.status,
        itemId: usersFilters.itemId === ANY ? undefined : usersFilters.itemId,
        currency:
          usersFilters.currency === ANY ? undefined : usersFilters.currency,
        from: usersFilters.from || undefined,
        to: usersFilters.to || undefined,
      };
      const res = await getFounderItemUsers(orgId, itemType, apiFilters);
      setUsers(res.users);
      setUsersTotal(res.total);
      if (res.items.length) setItems(res.items);
    } catch (err) {
      toast.error(
        (err as Error)?.message ??
          `Failed to load ${itemLabelPlural.toLowerCase()} users`,
      );
      setUsers([]);
      setUsersTotal(0);
    } finally {
      setUsersLoading(false);
    }
  }, [
    orgId,
    itemType,
    itemLabelPlural,
    usersPage,
    usersPageSize,
    usersFilters.debouncedSearch,
    usersFilters.status,
    usersFilters.itemId,
    usersFilters.currency,
    usersFilters.from,
    usersFilters.to,
  ]);

  // Only fire the users query when its view is active — avoids a second
  // round-trip on every page load when the founder only wants invoices.
  useEffect(() => {
    if (view === "users") loadUsers();
  }, [view, loadUsers]);

  /**
   * CSV export — the CURRENT filter set, every page of it.
   *
   * Pages through the API at the BE's 100-row ceiling rather than exporting
   * what's on screen: a founder who filters to "paid, October" and hits
   * export means all of it, not the 20 rows they can see.
   */
  const handleExport = useCallback(async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const allInvoices: ExportRow[] = [];
      let currentSkip = 0;
      const batchSize = 100;
      let hasMore = true;

      while (hasMore) {
        const apiFilters = {
          limit: batchSize,
          skip: currentSkip,
          search: filters.debouncedSearch || undefined,
          status: filters.status === ANY ? undefined : filters.status,
          itemId: filters.itemId === ANY ? undefined : filters.itemId,
          currency: filters.currency === ANY ? undefined : filters.currency,
          isRecurring:
            filters.isRecurring === ANY ? undefined : filters.isRecurring,
          from: filters.from || undefined,
          to: filters.to || undefined,
        };
        const res = await getFounderInvoices(orgId, itemType, apiFilters);
        allInvoices.push(...res.invoices);

        currentSkip += batchSize;
        hasMore = res.hasMore && res.invoices.length > 0;
      }

      const columns = [
        { header: "Invoice Number", accessor: (inv: ExportRow) => inv.invoiceNumber || "" },
        { header: "Customer Name", accessor: (inv: ExportRow) => inv.customerName || "" },
        { header: "Customer Email", accessor: (inv: ExportRow) => inv.customerEmail || "" },
        { header: "Customer ID", accessor: (inv: ExportRow) => inv.customerId || "" },
        { header: `${itemLabel} Title`, accessor: (inv: ExportRow) => inv.itemTitle || "" },
        { header: `${itemLabel} ID`, accessor: (inv: ExportRow) => inv.itemId || "" },
        {
          header: "Type",
          accessor: (inv: ExportRow) =>
            inv.isRecurring ? `Recurring (${inv.recurringPeriod || ""})` : "One-time",
        },
        { header: "Cycle", accessor: (inv: ExportRow) => inv.recurringPaymentNumber || "" },
        { header: "Amount", accessor: (inv: ExportRow) => (inv.totalAmount || 0) / 100 },
        { header: "Currency", accessor: (inv: ExportRow) => inv.itemCurrency || "" },
        { header: "Payment Currency", accessor: (inv: ExportRow) => inv.paymentCurrency || "" },
        {
          header: "Status",
          accessor: (inv: ExportRow) => (inv.status === "draft" ? "Pending" : inv.status),
        },
        { header: "Payment Platform", accessor: (inv: ExportRow) => inv.paymentPlatform || "" },
        { header: "Created At", accessor: (inv: ExportRow) => formatDateTime(inv.createdAt) },
        { header: "Paid At", accessor: (inv: ExportRow) => formatDateTime(inv.paidAt) },
        { header: "Cancelled At", accessor: (inv: ExportRow) => formatDateTime(inv.cancelledAt) },
        { header: "Next Due Date", accessor: (inv: ExportRow) => formatDateTime(inv.nextDueDate) },
      ];

      const filename = `founder-${itemLabelPlural.toLowerCase()}-invoices-${Date.now()}`;
      exportRowsAsCsv(allInvoices, columns, filename);
      toast.success(`Successfully exported ${allInvoices.length} invoices to CSV.`);
    } catch (err) {
      toast.error((err as Error)?.message ?? "Failed to export invoices");
    } finally {
      setExporting(false);
    }
  }, [
    orgId,
    itemType,
    itemLabel,
    itemLabelPlural,
    filters.debouncedSearch,
    filters.status,
    filters.itemId,
    filters.currency,
    filters.isRecurring,
    filters.from,
    filters.to,
  ]);

  /**
   * Dedupe items by title — the mobile app has occasionally created duplicate
   * channels with the same name (e.g. 3 x "Chamak Skin School" during the
   * `currency: "USD $"` bug). Instead of rendering three identical entries,
   * group by title and emit ONE whose value is a comma-joined list of the
   * underlying IDs. The BE splits and `$in`s that list, so filtering by the
   * deduped title still returns invoices from every duplicate.
   */
  const itemOptions = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const it of items) {
      const titleKey = it.title || "Untitled";
      if (!groups.has(titleKey)) groups.set(titleKey, []);
      groups.get(titleKey)!.push(it._id);
    }
    return Array.from(groups.entries())
      .map(([title, ids]) => ({ title, value: ids.join(","), count: ids.length }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  const invoiceColumns = useMemo(
    () => buildFounderOrderColumns({ itemLabel }),
    [itemLabel],
  );
  const userColumns = useMemo(
    () => buildFounderCustomerColumns({ itemLabelPlural }),
    [itemLabelPlural],
  );

  const usersStatusOptions =
    itemType === "channel"
      ? USER_STATUS_OPTIONS_CHANNEL
      : USER_STATUS_OPTIONS_OTHER;

  const filterActive =
    view === "invoices"
      ? filters.debouncedSearch.trim().length > 0 ||
        filters.status !== ANY ||
        filters.itemId !== ANY ||
        filters.currency !== ANY ||
        filters.isRecurring !== ANY ||
        !!filters.from ||
        !!filters.to
      : usersFilters.debouncedSearch.trim().length > 0 ||
        usersFilters.status !== ANY ||
        usersFilters.itemId !== ANY ||
        usersFilters.currency !== ANY ||
        !!usersFilters.from ||
        !!usersFilters.to;

  const clearAll = useCallback(() => {
    if (view === "invoices") setFilters(INITIAL_FILTERS);
    else setUsersFilters(INITIAL_USERS_FILTERS);
  }, [view]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const usersTotalPages = Math.max(1, Math.ceil(usersTotal / usersPageSize));

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0 of 0";
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return `${from} to ${to} of ${total.toLocaleString()}`;
  }, [page, pageSize, total]);

  const usersRangeLabel = useMemo(() => {
    if (usersTotal === 0) return "0 of 0";
    const from = (usersPage - 1) * usersPageSize + 1;
    const to = Math.min(usersTotal, usersPage * usersPageSize);
    return `${from} to ${to} of ${usersTotal.toLocaleString()}`;
  }, [usersPage, usersPageSize, usersTotal]);

  /**
   * Footer strip.
   *
   * "Invoices" is the whole filtered set (the BE's `total`). The other two
   * are labelled "(page)" on purpose: `/feed/founder/invoices` returns rows
   * and a count, not aggregates, so paid-count and revenue can only be
   * summed over the rows actually fetched. Printing a page sum under a
   * label that reads "Total Revenue" would understate a founder's earnings
   * by however many pages they hadn't scrolled to.
   */
  const invoiceTotals = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid");
    return [
      { label: "Invoices", value: <Gold>{total.toLocaleString()}</Gold> },
      { label: "Paid (page)", value: <Gold>{paid.length.toLocaleString()}</Gold> },
      {
        label: "Revenue (page)",
        value: (
          <Green>
            {sumByCurrency(
              paid.map((i) => ({ amount: i.totalAmount, currency: i.itemCurrency })),
            )}
          </Green>
        ),
      },
    ];
  }, [invoices, total]);

  const userTotals = useMemo(
    () => [
      { label: "Customers", value: <Gold>{usersTotal.toLocaleString()}</Gold> },
      {
        label: "Invoices (page)",
        value: (
          <Gold>
            {users
              .reduce((sum, u) => sum + (u.invoiceCount || 0), 0)
              .toLocaleString()}
          </Gold>
        ),
      },
      {
        label: "Lifetime spend (page)",
        value: (
          <Green>
            {sumByCurrency(
              users.map((u) => ({ amount: u.totalPaid, currency: u.currency })),
            )}
          </Green>
        ),
      },
    ],
    [users, usersTotal],
  );

  const topBar = (
    <TopBar
      view={view}
      onView={setView}
      filtersOpen={filtersOpen}
      onToggleFilters={() => setFiltersOpen((v) => !v)}
      filterActive={filterActive}
      itemOptions={itemOptions}
      itemId={view === "invoices" ? filters.itemId : usersFilters.itemId}
      onItemId={(v) =>
        view === "invoices"
          ? setFilters((prev) => ({ ...prev, itemId: v }))
          : setUsersFilters((prev) => ({ ...prev, itemId: v }))
      }
      exporting={exporting}
      onExport={handleExport}
      filters={filters}
      onFilters={setFilters}
      usersFilters={usersFilters}
      onUsersFilters={setUsersFilters}
      usersStatusOptions={usersStatusOptions}
      onClearAll={clearAll}
      itemLabel={itemLabel}
      itemLabelPlural={itemLabelPlural}
      hideViewSwitch={hideViewSwitch}
    />
  );

  const emptyState = (title: string) => (
    <GridEmptyState
      title={title}
      onClearFilters={filterActive ? clearAll : undefined}
    />
  );

  return (
    // Same surface and border as the dashboard shell (sidebar + header bar
    // are #0a0a0d / #2E2E2E), so the grid reads as part of the app rather
    // than a darker panel sitting on top of it.
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col"
      style={{ backgroundColor: GRID_BG }}
    >
      {view === "invoices" ? (
        <DataTable<FounderChannelInvoiceRow>
          tableId={`founder-${itemType}-orders-table`}
          // Sticky header + frozen columns must be the SAME opaque colour as
          // the rows, or they read as a mismatched band while scrolling.
          stickyBg={GRID_BG}
          borderColor={SHELL_BORDER}
          footerHeight={SHELL_FOOTER_H}
          columns={invoiceColumns}
          rows={invoices}
          getRowId={(r) => r._id}
          loading={loading}
          // Invoice cells are one or two lines — at the 95px default they sat
          // pinned to the ceiling of a mostly-empty row, which read as broken
          // alignment. See ROW_H in DataTable for why the default is tall.
          rowHeight={ROW_H}
          cellVerticalAlign="middle"
          emptyLabel={emptyState(
            filterActive
              ? "No orders match these filters."
              : `No ${itemLabelPlural.toLowerCase()} orders yet.`,
          )}
          // The Invoice Number column's filter affix and the tray's search box
          // are two doors into the SAME backend `search` parameter (which
          // matches invoice number, customer name and email). Bound to one
          // piece of state so they can never disagree about what's filtered.
          filters={
            filters.search.trim() ? { invoiceNumber: filters.search } : {}
          }
          onFiltersChange={(next) =>
            setFilters((prev) => ({ ...prev, search: next.invoiceNumber || "" }))
          }
          onRowClick={(r) =>
            window.open(
              `/invoice/${r.invoiceNumber || r._id}`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          topBar={topBar}
          footerTotals={invoiceTotals}
          pagination={{
            page,
            totalPages,
            rangeLabel,
            recordsPerPage: pageSize,
            recordsPerPageOptions: RPP_OPTIONS,
            onPrev: () => setPage((p) => Math.max(1, p - 1)),
            onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
            onRecordsPerPageChange: setPageSize,
          }}
        />
      ) : (
        <DataTable<FounderItemUserRow>
          tableId={`founder-${itemType}-customers-table`}
          stickyBg={GRID_BG}
          borderColor={SHELL_BORDER}
          footerHeight={SHELL_FOOTER_H}
          columns={userColumns}
          rows={users}
          getRowId={(r) => r.userId}
          loading={usersLoading}
          rowHeight={ROW_H}
          cellVerticalAlign="middle"
          emptyLabel={emptyState(
            filterActive
              ? "No customers match these filters."
              : `No ${itemLabelPlural.toLowerCase()} customers yet.`,
          )}
          onRowClick={(r) => setOpenUserId(r.userId)}
          topBar={topBar}
          footerTotals={userTotals}
          pagination={{
            page: usersPage,
            totalPages: usersTotalPages,
            rangeLabel: usersRangeLabel,
            recordsPerPage: usersPageSize,
            recordsPerPageOptions: RPP_OPTIONS,
            onPrev: () => setUsersPage((p) => Math.max(1, p - 1)),
            onNext: () => setUsersPage((p) => Math.min(usersTotalPages, p + 1)),
            onRecordsPerPageChange: setUsersPageSize,
          }}
        />
      )}

      {/* Full-screen per-customer detail overlay — mounted at the component
          root so it takes over the viewport regardless of grid scroll. */}
      {openUserId && orgId && (
        <UserActivityOverlay
          orgId={orgId}
          itemType={itemType}
          itemLabel={itemLabel}
          itemLabelPlural={itemLabelPlural}
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
        />
      )}
    </div>
  );
}

/* ── top bar ────────────────────────────────────────────────────────────── */

function TopBar({
  view,
  onView,
  filtersOpen,
  onToggleFilters,
  filterActive,
  itemOptions,
  itemId,
  onItemId,
  exporting,
  onExport,
  filters,
  onFilters,
  usersFilters,
  onUsersFilters,
  usersStatusOptions,
  onClearAll,
  itemLabel,
  itemLabelPlural,
  hideViewSwitch,
}: {
  view: View;
  onView: (v: View) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  filterActive: boolean;
  itemOptions: Array<{ title: string; value: string; count: number }>;
  itemId: string;
  onItemId: (v: string) => void;
  exporting: boolean;
  onExport: () => void;
  filters: FiltersState;
  onFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  usersFilters: UsersFiltersState;
  onUsersFilters: React.Dispatch<React.SetStateAction<UsersFiltersState>>;
  usersStatusOptions: UserStatusOption[];
  onClearAll: () => void;
  itemLabel: string;
  itemLabelPlural: string;
  hideViewSwitch: boolean;
}) {
  const search = view === "invoices" ? filters.search : usersFilters.search;
  const setSearch = (v: string) =>
    view === "invoices"
      ? onFilters((prev) => ({ ...prev, search: v }))
      : onUsersFilters((prev) => ({ ...prev, search: v }));

  const from = view === "invoices" ? filters.from : usersFilters.from;
  const to = view === "invoices" ? filters.to : usersFilters.to;
  const setFrom = (v: string) =>
    view === "invoices"
      ? onFilters((prev) => ({ ...prev, from: v }))
      : onUsersFilters((prev) => ({ ...prev, from: v }));
  const setTo = (v: string) =>
    view === "invoices"
      ? onFilters((prev) => ({ ...prev, to: v }))
      : onUsersFilters((prev) => ({ ...prev, to: v }));

  const currency =
    view === "invoices" ? filters.currency : usersFilters.currency;
  const setCurrency = (v: string) =>
    view === "invoices"
      ? onFilters((prev) => ({ ...prev, currency: v as FiltersState["currency"] }))
      : onUsersFilters((prev) => ({
          ...prev,
          currency: v as UsersFiltersState["currency"],
        }));

  return (
    <TopBarShell>
      <TopBarRow>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <FilterToggleButton
            open={filtersOpen}
            active={filterActive}
            onToggle={onToggleFilters}
          />

          {/* View switcher — same segmented pill geometry as the Live Streams
              One Time / Recurring control. */}
          {!hideViewSwitch && (
            <ViewTabBar>
              <ViewTab
                active={view === "invoices"}
                onClick={() => onView("invoices")}
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Invoices"
              />
              <ViewTab
                active={view === "users"}
                onClick={() => onView("users")}
                icon={<UsersIcon className="h-3.5 w-3.5" />}
                label="Customers"
              />
            </ViewTabBar>
          )}

          <ItemPicker
            value={itemId}
            onChange={onItemId}
            options={itemOptions}
            itemLabel={itemLabel}
            itemLabelPlural={itemLabelPlural}
          />
        </div>

        <TopBarActions>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={
              view === "invoices" ? "Name, email, or invoice #" : "Name or email"
            }
          />

          {/* Export is an invoices-view action: there is no CSV shape for the
              customer roll-up, and one never existed. */}
          {view === "invoices" && (
            <ExportCsvButton exporting={exporting} onClick={onExport} />
          )}
        </TopBarActions>
      </TopBarRow>

      {filtersOpen && (
        <FilterTray>
          {view === "invoices" ? (
            <>
              <FilterGroup
                label="Status"
                options={STATUS_OPTIONS}
                value={filters.status}
                onChange={(v) =>
                  onFilters((prev) => ({
                    ...prev,
                    status: v as FiltersState["status"],
                  }))
                }
              />
              <FilterGroup
                label="Type"
                options={TYPE_OPTIONS}
                value={filters.isRecurring}
                onChange={(v) =>
                  onFilters((prev) => ({
                    ...prev,
                    isRecurring: v as FiltersState["isRecurring"],
                  }))
                }
              />
            </>
          ) : (
            <FilterGroup
              label="Status"
              options={usersStatusOptions}
              value={usersFilters.status}
              onChange={(v) =>
                onUsersFilters((prev) => ({
                  ...prev,
                  status: v as UsersFiltersState["status"],
                }))
              }
            />
          )}

          <FilterGroup
            label="Currency"
            options={CURRENCY_OPTIONS}
            value={currency}
            onChange={setCurrency}
          />

          <DateRangeFilter
            label={view === "invoices" ? "Date range" : "Last activity"}
            from={from}
            to={to}
            onFrom={setFrom}
            onTo={setTo}
          />

          {filterActive && <ClearAllButton onClick={onClearAll} />}
        </FilterTray>
      )}
    </TopBarShell>
  );
}
