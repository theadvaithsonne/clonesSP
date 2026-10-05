"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tag, Ticket, Loader2, X } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { TableTopBar, type TopBarView } from "@/components/data-table/TableTopBar";
import {
  AppliedFilterChips,
  type FilterChip,
} from "@/components/data-table/AppliedFilterChips";
import type { ColumnDef, SortState } from "@/components/data-table/types";
import { ExportPanel, ExportButton, type ExportField } from "@/components/data-table/ExportPanel";
import {
  getOfferings,
  getOfferingDetail,
  AdminUnauthorizedError,
  type Offering,
  type OfferingCategory,
  type OfferingDetailResponse,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { PlatformLogo } from "@/components/icons/platform-logos";
import { useAdminSearch } from "@/components/garage-admin/admin-search";

const CATEGORY_META: Record<OfferingCategory, { label: string; className: string }> = {
  digital: { label: "Digital", className: "bg-sky-500/15 text-sky-300 border-sky-500/25" },
  physical: { label: "Physical", className: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
  office: { label: "Office", className: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25" },
  offer: { label: "Offer", className: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  platform: { label: "Platform", className: "bg-[#FFC200]/15 text-[#FFC200] border-[#FFC200]/30" },
};

const OUTCOME_META: Record<string, { label: string; className: string }> = {
  wrong: { label: "Wrong", className: "bg-red-500/15 text-red-300 border-red-500/25" },
  close: { label: "Close", className: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  chosen: { label: "Chosen", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
};

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "digital", label: "Digital" },
  { key: "physical", label: "Physical" },
  { key: "office", label: "Office" },
  { key: "offer", label: "Offers" },
  { key: "platform", label: "Platform" },
];

/** Column id → server sort key (only pre-aggregation fields are sortable). */
const OFF_SORT: Record<string, string> = {
  offering: "name",
  price: "price",
  commission: "commission",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
function fmtUsdCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPrice(minor: number | null, currency: string | null): string {
  if (minor == null) return "—";
  const amt = (minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency ? currency + " " : "$"}${amt}`;
}

/** CSV columns for the offerings table (export order). */
const OFFERING_EXPORT_FIELDS: ExportField<Offering>[] = [
  { key: "name", label: "Offering", value: (o) => o.name ?? "" },
  { key: "category", label: "Category", value: (o) => CATEGORY_META[o.category]?.label ?? o.category },
  { key: "org", label: "Org", value: (o) => o.orgName ?? "" },
  { key: "price", label: "Price", value: (o) => fmtPrice(o.priceMinor, o.currency) },
  { key: "currency", label: "Currency", value: (o) => o.currency ?? "" },
  { key: "commission", label: "Commission %", value: (o) => (o.commissionPct == null ? "" : o.commissionPct) },
  { key: "offerCode", label: "Offer Code", value: (o) => o.offer?.code ?? "" },
  { key: "opps_total", label: "Opportunities", value: (o) => o.opps?.total ?? 0 },
  { key: "opps_toReach", label: "To Reach", value: (o) => o.opps?.toReach ?? 0 },
  { key: "opps_reachedOut", label: "Reached Out", value: (o) => o.opps?.reachedOut ?? 0 },
  { key: "opps_snoozed", label: "Snoozed", value: (o) => o.opps?.snoozed ?? 0 },
  { key: "out_chosen", label: "Outcome Chosen", value: (o) => o.outcomes?.chosen ?? 0 },
  { key: "out_close", label: "Outcome Close", value: (o) => o.outcomes?.close ?? 0 },
  { key: "out_wrong", label: "Outcome Wrong", value: (o) => o.outcomes?.wrong ?? 0 },
  { key: "potential", label: "Potential (USD)", value: (o) => (o.opps?.potentialUsdCents != null ? fmtUsdCents(o.opps.potentialUsdCents) : "") },
  { key: "itemType", label: "Item Type", value: (o) => o.itemType ?? "" },
  { key: "itemId", label: "Item ID", value: (o) => o.itemId ?? "" },
];

export default function OfferingsPage() {
  const [rows, setRows] = useState<Offering[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");
  const { query: search } = useAdminSearch();
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Offering | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  // Caps the auth-recovery retry to one attempt per failure episode — see
  // reload below. Without this, an operator de-allowlisted at the endpoint
  // level but still elevatable would loop forever hammering the backend.
  // Re-arms on the next successful fetch.
  const recoveryAttempted = useRef(false);

  // Pull every offering matching the current type/search/sort, page by page.
  const fetchAllOfferings = useCallback(async (): Promise<Offering[]> => {
    const out: Offering[] = [];
    for (let p = 1; ; p++) {
      const d = await getOfferings({
        page: p,
        type,
        search: debounced,
        sort: sort ? OFF_SORT[sort.by] : undefined,
        order: sort?.order,
      });
      out.push(...d.offerings);
      if (d.offerings.length === 0 || out.length >= d.pagination.total || p >= (d.pagination.totalPages || 1)) break;
    }
    return out;
  }, [type, debounced, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [sort]);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    getOfferings({
      page,
      type,
      search: debounced,
      sort: sort ? OFF_SORT[sort.by] : undefined,
      order: sort?.order,
    })
      .then((d) => {
        setRows(d.offerings);
        setTypeCounts(d.typeCounts);
        setTotal(d.pagination.total);
        setTotalPages(d.pagination.totalPages || 1);
        if (d.pagination.limit) setLimit(d.pagination.limit);
        recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      })
      .catch((e) => {
        if (e instanceof AdminUnauthorizedError) {
          if (recoveryAttempted.current) return; // one attempt per failure episode
          recoveryAttempted.current = true;
          ensureNcAdminToken().then((result) => {
            if (result.ok === true) {
              reload();
            }
          });
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to load offerings");
      })
      .finally(() => setLoading(false));
  }, [page, type, debounced, sort]);

  useEffect(() => {
    reload();
  }, [reload]);

  const views: TopBarView[] = TYPE_FILTERS.map((f) => ({
    id: f.key,
    label: f.key === "all" ? "All Offerings" : f.label,
    count: typeCounts[f.key],
  }));

  const chips: FilterChip[] = [];
  if (type !== "all") {
    chips.push({
      id: "type",
      label: `Type: ${TYPE_FILTERS.find((f) => f.key === type)?.label ?? type}`,
      onClear: () => {
        setType("all");
        setPage(1);
      },
    });
  }

  const columns = useMemo<ColumnDef<Offering>[]>(
    () => [
      {
        id: "offering",
        header: "Offering",
        frozen: true,
        sortable: true,
        width: 340,
        minWidth: 240,
        cell: (o) => {
          const meta = CATEGORY_META[o.category];
          return o.itemType === "platform" ? (
            <div className="flex items-center gap-3">
              <PlatformLogo itemId={o.itemId} className="h-6 w-auto max-w-[170px]" />
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${meta.className}`}>
                {meta.label}
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.05]">
                <OfferingIcon offering={o} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-white">{o.name}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[12px] text-zinc-500">
                  {o.offer
                    ? `${o.offer.code} · ${o.offer.discountValue}% off · ${o.offer.appliesTo}`
                    : o.orgName || "—"}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "price",
        header: "Price",
        sortable: true,
        width: 120,
        cell: (o) => (
          <span className="whitespace-nowrap text-zinc-300">{fmtPrice(o.priceMinor, o.currency)}</span>
        ),
      },
      {
        id: "commission",
        header: "Commission",
        sortable: true,
        width: 120,
        cell: (o) => (
          <span className="text-zinc-300">{o.commissionPct != null ? `${o.commissionPct}%` : "—"}</span>
        ),
      },
      {
        id: "opportunities",
        header: "Opportunities",
        width: 180,
        cell: (o) => (
          <span className="whitespace-nowrap">
            <span className="font-medium text-white">{o.opps.total}</span>
            {o.opps.total > 0 && (
              <span className="ml-2 text-[12px] text-zinc-500">
                {o.opps.toReach}·{o.opps.reachedOut}·{o.opps.snoozed}
              </span>
            )}
          </span>
        ),
      },
      {
        id: "outcomes",
        header: "Outcomes",
        width: 130,
        cell: (o) => (
          <span className="whitespace-nowrap text-[12px]">
            <span className="text-emerald-400">{o.outcomes.chosen}</span>
            <span className="text-zinc-600"> / </span>
            <span className="text-amber-400">{o.outcomes.close}</span>
            <span className="text-zinc-600"> / </span>
            <span className="text-red-400">{o.outcomes.wrong}</span>
          </span>
        ),
      },
      {
        id: "potential",
        header: "Potential",
        width: 130,
        align: "right",
        cell: (o) => (
          <span className="whitespace-nowrap text-zinc-300">
            {o.opps.potentialUsdCents > 0 ? fmtUsdCents(o.opps.potentialUsdCents) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808] text-white">
      <div className="flex-none px-4 pt-5">
        <h1 className="text-lg font-semibold tracking-tight">Offerings</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Everything EarnGPT can consider — click a row for its stats + drill-down
        </p>
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <DataTable<Offering>
          tableId="admin-offerings"
          rowHeight="auto"
          headerHeight={48}
          // stickyBg default now tracks Garage's own #181818 shell; NC's ported
          // pages sit on an #080808 page background and need the near-black
          // sticky/frozen surface NC originally shipped with.
          stickyBg="#181818"
          columns={columns}
          rows={rows}
          getRowId={(o) => o.key}
          loading={loading}
          emptyLabel="No offerings found."
          sort={sort}
          onSortChange={setSort}
          onRowClick={(o) => setSelected(o)}
          topBar={
            <>
              <TableTopBar
                views={views}
                activeView={type}
                onViewChange={(v) => {
                  setType(v);
                  setPage(1);
                }}
                actions={<ExportButton onClick={() => setExportOpen(true)} />}
              />
              <AppliedFilterChips
                chips={chips}
                onClearAll={() => {
                  setType("all");
                  setPage(1);
                }}
              />
            </>
          }
          footerTotals={[{ label: "Total Offerings", value: typeCounts.all ?? total }]}
          pagination={{
            page,
            totalPages: Math.max(1, totalPages),
            rangeLabel: total === 0 ? "0" : `${(page - 1) * limit + 1} to ${Math.min(total, page * limit)}`,
            onPrev: () => setPage((p) => Math.max(1, p - 1)),
            onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
          }}
        />
      </div>

      {selected && <OfferingDetailDrawer offering={selected} onClose={() => setSelected(null)} />}

      <ExportPanel<Offering>
        open={exportOpen}
        onOpenChange={setExportOpen}
        fields={OFFERING_EXPORT_FIELDS}
        fetchAll={fetchAllOfferings}
        filenameBase="admin-offerings"
      />
    </div>
  );
}

function OfferingIcon({ offering }: { offering: Offering }) {
  if (offering.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={offering.coverUrl} alt="" className="h-full w-full object-cover" />;
  }
  if (offering.category === "offer") {
    return <Ticket className="h-4 w-4 text-amber-400/70" />;
  }
  return <Tag className="h-4 w-4 text-zinc-600" />;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function OfferingDetailDrawer({
  offering,
  onClose,
}: {
  offering: Offering;
  onClose: () => void;
}) {
  const [data, setData] = useState<OfferingDetailResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getOfferingDetail(offering.itemType, offering.itemId, page)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [offering.itemType, offering.itemId, page]);

  const meta = CATEGORY_META[offering.category];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-white/10 bg-[#0d0d0d] p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {offering.itemType === "platform" ? (
                <PlatformLogo itemId={offering.itemId} className="h-7 w-auto max-w-[200px]" />
              ) : (
                <h2 className="truncate text-xl font-semibold">{offering.name}</h2>
              )}
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${meta.className}`}>
                {meta.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {offering.offer
                ? `${offering.offer.code} · ${offering.offer.discountValue}% off`
                : offering.orgName || offering.itemType}
              {offering.priceMinor != null && ` · ${fmtPrice(offering.priceMinor, offering.currency)}`}
              {offering.commissionPct != null && ` · ${offering.commissionPct}% commission`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {offering.offer && (
          <p className="mb-4 text-xs text-zinc-500">
            Applies to: <span className="text-zinc-300">{offering.offer.appliesTo}</span>
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : data ? (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Opportunities"
                value={String(data.stats.opps.total)}
                sub={`${data.stats.opps.toReach} open · ${data.stats.opps.reachedOut} reached`}
              />
              <StatCard label="Potential" value={fmtUsdCents(data.stats.opps.potentialUsdCents)} />
              <StatCard
                label="Outcomes"
                value={`${data.stats.outcomes.chosen}/${data.stats.outcomes.close}/${data.stats.outcomes.wrong}`}
                sub="chosen / close / wrong"
              />
              <StatCard label="Snoozed" value={String(data.stats.opps.snoozed)} />
            </div>

            <h3 className="mb-2 text-sm font-medium text-zinc-300">Opportunities across all users</h3>
            {data.opportunities.rows.length === 0 ? (
              <p className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] py-8 text-center text-sm text-zinc-500">
                No opportunities generated yet.
              </p>
            ) : (
              <div className="mb-3 overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">User</th>
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Potential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.opportunities.rows.map((r) => (
                      <tr key={r._id} className="border-b border-white/[0.04] align-top last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{fmtDateTime(r.createdAt)}</td>
                        <td className="px-3 py-2 text-zinc-300">{r.userName}</td>
                        <td className="max-w-[200px] px-3 py-2 text-zinc-400">
                          <span className="line-clamp-2">{r.eventTitle}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{r.status}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-300">
                          {r.potentialUsdCents > 0 ? fmtUsdCents(r.potentialUsdCents) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.opportunities.pagination.totalPages > 1 && (
              <div className="mb-6 flex items-center justify-center gap-3 text-xs">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-300 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-zinc-500">
                  {page} / {data.opportunities.pagination.totalPages}
                </span>
                <button
                  disabled={page >= data.opportunities.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}

            {data.feedback.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-medium text-zinc-300">Learning outcomes</h3>
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/[0.06] uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">When</th>
                        <th className="px-3 py-2 font-medium">User</th>
                        <th className="px-3 py-2 font-medium">Outcome</th>
                        <th className="px-3 py-2 font-medium">Reasoning / Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.feedback.map((f) => {
                        const om = OUTCOME_META[f.option];
                        return (
                          <tr key={f._id} className="border-b border-white/[0.04] align-top last:border-0">
                            <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{fmtDateTime(f.createdAt)}</td>
                            <td className="px-3 py-2 text-zinc-300">{f.userName}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${om?.className ?? ""}`}>
                                {om?.label ?? f.option}
                              </span>
                            </td>
                            <td className="max-w-[240px] px-3 py-2 text-zinc-400">
                              {f.reasoning && <span className="line-clamp-2">{f.reasoning}</span>}
                              {f.freeText && (
                                <span className="mt-1 block italic text-zinc-300 line-clamp-2">“{f.freeText}”</span>
                              )}
                              {!f.reasoning && !f.freeText && <span className="text-zinc-600">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
