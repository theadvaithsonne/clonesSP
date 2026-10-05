"use client";

/**
 * Founder console → Unsub Log, as a Bigin-style data grid.
 *
 * Read-only log of every membership event across one item kind. The parent
 * pins the kind, so this renders at Communities → Unsub Log, Live Streams →
 * Unsub Log and Courses → Unsub Log from one component.
 *
 * Data sources, unchanged from the layout this replaces:
 *   channel / workshop  GET /feed/founder/unsub-log — written by
 *                       services/feed.ts:unsubscribeFromChannel (all three
 *                       cancel branches write an "unsubscribed" event) and by
 *                       the sweeper in index.ts, which flips "cancelling this
 *                       cycle" members to inactive at nextPaymentDate and
 *                       writes an "expired" event.
 *   product             GET /feed/founder/product-refunds — products have no
 *                       subscription to cancel, so the page shows refunded +
 *                       cancelled orders instead, shape-matched to the same
 *                       row type. (No nav entry today; see layout.tsx.)
 *   course              Nothing. Courses are one-time purchases with no
 *                       cancel flow in the codebase, so the page renders its
 *                       empty state without a round-trip.
 *
 * Every row carries frozen snapshots of customer name + email + LTV so the
 * log reads the same way it did the day the event fired, even if the User row
 * or the channel gets renamed later.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/DataTable";
import {
  getFounderUnsubLog,
  type FounderUnsubLogCounts,
  type FounderUnsubLogFilters,
  type FounderUnsubLogRow,
  type FounderUnsubLogWorkshopOption,
  type UnsubEventType,
  type UnsubItemKind,
} from "@/lib/feed-api";
import { buildUnsubLogColumns } from "./unsubLogColumns";
import { formatLtv } from "./unsubLogCells";
import { GRID_BG, ROW_H, SHELL_BORDER, SHELL_FOOTER_H } from "../tokens";
import {
  ANY,
  ClearAllButton,
  DateRangeFilter,
  FilterGroup,
  FilterToggleButton,
  FilterTray,
  Gold,
  Green,
  GridEmptyState,
  ItemPicker,
  type ItemPickerOption,
  RPP_OPTIONS,
  SearchBox,
  TopBarActions,
  TopBarRow,
  TopBarShell,
  readOrgId,
} from "../chrome";

const EVENT_OPTIONS: Array<{ id: UnsubEventType | typeof ANY; label: string }> =
  [
    { id: ANY, label: "All events" },
    { id: "unsubscribed", label: "Cancelled" },
    { id: "expired", label: "Expired" },
  ];

const EMPTY_COUNTS: FounderUnsubLogCounts = {
  unsubscribed: 0,
  expired: 0,
  channel: 0,
  workshop: 0,
  all: 0,
};

interface FiltersState {
  search: string;
  debouncedSearch: string;
  eventType: UnsubEventType | typeof ANY;
  /** A specific item within the pinned kind, as a comma-joined id list. */
  itemScope: string | typeof ANY;
  from: string;
  to: string;
}

const INITIAL_FILTERS: FiltersState = {
  search: "",
  debouncedSearch: "",
  eventType: ANY,
  itemScope: ANY,
  from: "",
  to: "",
};

/** Kind is pinned by the parent — one Unsub page per item type. */
export type FounderUnsubLogKind = "channel" | "workshop" | "course" | "product";

export interface UnsubLogTableProps {
  itemKind: FounderUnsubLogKind;
  /** "Community" | "Live Stream" | "Course" | "Digital Product" */
  itemLabel: string;
  /** "Communities" | "Live Streams" | … */
  itemLabelPlural: string;
}

export function UnsubLogTable({
  itemKind,
  itemLabel,
  itemLabelPlural,
}: UnsubLogTableProps) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [events, setEvents] = useState<FounderUnsubLogRow[]>([]);
  // `channels` doubles as the product list on the product page — the
  // product-refunds endpoint returns the same `{_id, title}` shape.
  const [channels, setChannels] = useState<{ _id: string; title: string }[]>([]);
  const [workshops, setWorkshops] = useState<FounderUnsubLogWorkshopOption[]>(
    [],
  );
  const [counts, setCounts] = useState<FounderUnsubLogCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);

  useEffect(() => {
    setOrgId(readOrgId());
  }, []);

  // Debounce the search box so the BE isn't hit on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((prev) => ({ ...prev, debouncedSearch: prev.search }));
    }, 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  // Any narrowing invalidates the current page number — page 4 of a filter
  // that now returns 12 rows is an empty table.
  useEffect(() => {
    setPage(1);
  }, [
    filters.debouncedSearch,
    filters.eventType,
    filters.itemScope,
    filters.from,
    filters.to,
    pageSize,
    itemKind,
  ]);

  /**
   * The item picker's options, for the pinned kind only.
   *
   * Channels and products dedupe by title (the mobile app has created
   * duplicate names), workshops don't — their ids are already distinct per
   * stream and collapsing two same-titled series would merge two different
   * schedules into one filter.
   */
  const itemOptions = useMemo<ItemPickerOption[]>(() => {
    if (itemKind === "workshop") {
      return workshops
        .map((w) => ({ title: w.title || "Untitled", value: w._id, count: 1 }))
        .sort((a, b) => a.title.localeCompare(b.title));
    }
    if (itemKind === "channel" || itemKind === "product") {
      const groups = new Map<string, string[]>();
      for (const c of channels) {
        const titleKey = c.title || "Untitled";
        if (!groups.has(titleKey)) groups.set(titleKey, []);
        groups.get(titleKey)!.push(c._id);
      }
      return Array.from(groups.entries())
        .map(([title, ids]) => ({
          title,
          value: ids.join(","),
          count: ids.length,
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
    }
    return [];
  }, [channels, workshops, itemKind]);

  const load = useCallback(async () => {
    if (!orgId) return;
    // Courses have no cancel/unsub flow in the codebase today — render the
    // empty state without hitting the network.
    if (itemKind === "course") {
      setEvents([]);
      setCounts(EMPTY_COUNTS);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const skip = (page - 1) * pageSize;
    try {
      if (itemKind === "product") {
        // Products don't have a subscription to cancel — the page reads
        // refunded + cancelled ProductOrder rows from a dedicated endpoint
        // and adapts them to the unsub row shape so the same grid renders.
        const { getFounderProductRefunds } = await import("@/lib/feed-api");
        const res = await getFounderProductRefunds(orgId, {
          limit: pageSize,
          skip,
          search: filters.debouncedSearch || undefined,
          productId:
            filters.itemScope !== ANY ? filters.itemScope : undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        });
        setEvents(
          res.events.map((e) => ({
            _id: e._id,
            userId: e.userId,
            itemKind: "channel" as UnsubItemKind, // treated as a generic row
            channelId: e.productId,
            channelTitle: e.productTitle,
            workshopId: null,
            workshopTitle: null,
            sessionDate: null,
            eventType: "unsubscribed" as UnsubEventType,
            occurredAt: e.occurredAt,
            channelKind: "one_time" as const,
            subscriptionPeriod: null,
            accessUntil: null,
            activeDaysUsed: null,
            activeDaysLeftAtCancel: null,
            lifetimeValueUsdSnapshot: e.totalAmount || 0,
            parentInvoiceId: null,
            customerName: e.customerName,
            customerEmail: e.customerEmail,
          })),
        );
        setTotal(res.total);
        if (res.products.length) setChannels(res.products);
        setCounts({
          unsubscribed: res.total,
          expired: 0,
          channel: 0,
          workshop: 0,
          all: res.total,
        });
      } else {
        // Channel or workshop — the classic unsub-log path.
        const apiFilters: FounderUnsubLogFilters = {
          limit: pageSize,
          skip,
          search: filters.debouncedSearch || undefined,
          eventType: filters.eventType === ANY ? undefined : filters.eventType,
          channelId:
            itemKind === "channel" && filters.itemScope !== ANY
              ? filters.itemScope
              : undefined,
          workshopId:
            itemKind === "workshop" && filters.itemScope !== ANY
              ? filters.itemScope
              : undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        };
        const res = await getFounderUnsubLog(orgId, itemKind, apiFilters);
        setEvents(res.events);
        setCounts(res.counts);
        setTotal(res.total);
        if (res.channels.length) setChannels(res.channels);
        if (res.workshops.length) setWorkshops(res.workshops);
      }
    } catch (err) {
      toast.error((err as Error)?.message ?? "Failed to load unsub log");
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    orgId,
    itemKind,
    page,
    pageSize,
    filters.debouncedSearch,
    filters.eventType,
    filters.itemScope,
    filters.from,
    filters.to,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(
    () =>
      buildUnsubLogColumns({
        itemLabel,
        // Only workshop events ever carry a sessionDate.
        showSession: itemKind === "workshop",
      }),
    [itemLabel, itemKind],
  );

  const filterActive =
    filters.debouncedSearch.trim().length > 0 ||
    filters.eventType !== ANY ||
    filters.itemScope !== ANY ||
    !!filters.from ||
    !!filters.to;

  const clearAll = useCallback(() => setFilters(INITIAL_FILTERS), []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeLabel = useMemo(() => {
    if (total === 0) return "0 of 0";
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return `${from} to ${to} of ${total.toLocaleString()}`;
  }, [page, pageSize, total]);

  /**
   * Footer strip.
   *
   * Events / Cancelled / Expired come from the BE's own counts, so they
   * describe the whole filtered set. The LTV total can only be summed over
   * the rows actually fetched, so it says "(page)" — labelling a page sum
   * "Lost LTV" would understate the damage by however many pages the founder
   * hadn't scrolled to.
   *
   * The kind split (`counts.channel` / `counts.workshop`) is deliberately not
   * shown: the parent pins one kind per page, so one of those two is always
   * the total and the other always zero.
   */
  const footerTotals = useMemo(
    () => [
      { label: "Events", value: <Gold>{total.toLocaleString()}</Gold> },
      {
        label: "Cancelled",
        value: <Gold>{counts.unsubscribed.toLocaleString()}</Gold>,
      },
      {
        label: "Expired",
        value: <Gold>{counts.expired.toLocaleString()}</Gold>,
      },
      {
        label: "LTV (page)",
        value: (
          <Green>
            $
            {formatLtv(
              events.reduce(
                (sum, e) => sum + (e.lifetimeValueUsdSnapshot || 0),
                0,
              ),
            )}
          </Green>
        ),
      },
    ],
    [total, counts, events],
  );

  /** Per-kind copy for the empty grid. A course page is empty by design, so
   *  it has to say why rather than read as a loading failure. */
  const empty = (() => {
    if (itemKind === "course") {
      return {
        title: "No course cancellations",
        detail:
          "Course enrolments are one-time purchases and are not currently cancellable in the app.",
      };
    }
    if (filterActive) {
      return {
        title: "No events match these filters",
        detail: "Try clearing filters or widening the date range.",
      };
    }
    if (itemKind === "product") {
      return {
        title: "No refunds or cancellations",
        detail: "Refunded or cancelled orders will show up here.",
      };
    }
    return {
      title: "No one has left yet",
      detail: `Cancel and cycle-end events across your ${itemLabelPlural.toLowerCase()} will show up here as they happen.`,
    };
  })();

  return (
    // Same surface and border as the dashboard shell, so the grid reads as
    // part of the app rather than a darker panel sitting on top of it.
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col"
      style={{ backgroundColor: GRID_BG }}
    >
      <DataTable<FounderUnsubLogRow>
        tableId={`founder-${itemKind}-unsub-log-table`}
        // Sticky header + frozen columns must be the SAME opaque colour as
        // the rows, or they read as a mismatched band while scrolling.
        stickyBg={GRID_BG}
        borderColor={SHELL_BORDER}
        footerHeight={SHELL_FOOTER_H}
        columns={columns}
        rows={events}
        getRowId={(r) => r._id}
        loading={loading}
        // One- and two-line cells; the 95px default left everything pinned to
        // the ceiling of a mostly-empty row.
        rowHeight={ROW_H}
        cellVerticalAlign="middle"
        emptyLabel={
          <GridEmptyState
            title={empty.title}
            detail={empty.detail}
            onClearFilters={filterActive ? clearAll : undefined}
          />
        }
        // The Member column's filter affix and the top bar's search box are
        // two doors into the SAME backend `search` parameter (name + email).
        // Bound to one piece of state so they can never disagree.
        filters={filters.search.trim() ? { member: filters.search } : {}}
        onFiltersChange={(next) =>
          setFilters((prev) => ({ ...prev, search: next.member || "" }))
        }
        // No onRowClick: the log is a record, not a list of things to open.
        topBar={
          <TopBarShell>
            <TopBarRow>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <FilterToggleButton
                  open={filtersOpen}
                  active={filterActive}
                  onToggle={() => setFiltersOpen((v) => !v)}
                />
                <ItemPicker
                  value={filters.itemScope}
                  onChange={(v) =>
                    setFilters((prev) => ({ ...prev, itemScope: v }))
                  }
                  options={itemOptions}
                  itemLabel={itemLabel}
                  itemLabelPlural={itemLabelPlural}
                />
              </div>

              <TopBarActions>
                <SearchBox
                  value={filters.search}
                  onChange={(v) =>
                    setFilters((prev) => ({ ...prev, search: v }))
                  }
                  placeholder="Name or email"
                />
              </TopBarActions>
            </TopBarRow>

            {filtersOpen && (
              <FilterTray>
                {/* Products have no expiry event — every row is a refund —
                    so the Event pills would offer a filter that can only
                    ever return everything or nothing. */}
                {itemKind !== "product" && (
                  <FilterGroup
                    label="Event"
                    options={EVENT_OPTIONS}
                    value={filters.eventType}
                    onChange={(v) =>
                      setFilters((prev) => ({
                        ...prev,
                        eventType: v as FiltersState["eventType"],
                      }))
                    }
                  />
                )}

                <DateRangeFilter
                  label="Date range"
                  from={filters.from}
                  to={filters.to}
                  onFrom={(v) => setFilters((prev) => ({ ...prev, from: v }))}
                  onTo={(v) => setFilters((prev) => ({ ...prev, to: v }))}
                />

                {filterActive && <ClearAllButton onClick={clearAll} />}
              </FilterTray>
            )}
          </TopBarShell>
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
          onRecordsPerPageChange: setPageSize,
        }}
      />
    </div>
  );
}
