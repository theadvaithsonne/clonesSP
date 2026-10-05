"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Users as UsersIcon } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { TableTopBar, type TopBarView } from "@/components/data-table/TableTopBar";
import {
  AppliedFilterChips,
  type FilterChip,
} from "@/components/data-table/AppliedFilterChips";
import type { ColumnDef, SortState } from "@/components/data-table/types";
import { ExportPanel, ExportButton, type ExportField } from "@/components/data-table/ExportPanel";
import {
  listAxons,
  axonLabel,
  type RawAxon,
  type AxonStatus,
  type AxonSort,
} from "@/lib/nc-admin-api/admin-axons";
import { AdminUnauthorizedError } from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { useAdminSearch } from "@/components/garage-admin/admin-search";

const RPP_OPTIONS = [10, 25, 50, 100];

/** CSV columns for the axons table (export order). */
const AXON_EXPORT_FIELDS: ExportField<RawAxon>[] = [
  { key: "name", label: "Name", value: (a) => axonLabel(a) },
  { key: "headline", label: "Headline", value: (a) => a.headline ?? "" },
  { key: "emails", label: "Emails", value: (a) => (a.emails ?? []).map((e) => e.value).join("; ") },
  { key: "phones", label: "Phones", value: (a) => (a.phones ?? []).map((p) => p.value).join("; ") },
  { key: "matchKeys", label: "Match Keys", value: (a) => (a.matchKeys ?? []).join("; ") },
  { key: "contributors", label: "Contributors", value: (a) => a.contributorCount ?? 0 },
  { key: "status", label: "Status", value: (a) => STATUS_LABEL[a.status] ?? a.status },
  { key: "created", label: "Created", value: (a) => a.createdAt ?? "" },
  { key: "updated", label: "Updated", value: (a) => a.updatedAt ?? "" },
  { key: "axonId", label: "Axon ID", value: (a) => a._id ?? "" },
];

const VIEWS: TopBarView[] = [
  { id: "", label: "All Axons" },
  { id: "active", label: "Active" },
  { id: "merged_into", label: "Merged" },
  { id: "erased", label: "Erased" },
];
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  merged_into: "Merged",
  erased: "Erased",
};

/** Column id → server sort key. */
const COL_SORT: Record<string, AxonSort> = {
  identity: "displayName",
  contributors: "contributorCount",
  created: "createdAt",
  updated: "updatedAt",
};

function Avatar({ src, name }: { src?: string; name?: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const showImg = !!src && !failed;
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-xs font-semibold text-black">
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AxonStatus }) {
  const map: Record<AxonStatus, string> = {
    active: "bg-emerald-500/15 text-emerald-300",
    merged_into: "bg-zinc-500/20 text-zinc-400",
    erased: "bg-red-500/15 text-red-300",
  };
  const label: Record<AxonStatus, string> = {
    active: "active",
    merged_into: "merged",
    erased: "erased",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${map[status]}`}>{label[status]}</span>
  );
}

export default function AdminAxonsPage() {
  const router = useRouter();
  const [items, setItems] = useState<RawAxon[]>([]);
  const [total, setTotal] = useState(0);
  // Grand total across ALL axons (unfiltered) — captured from the unfiltered load.
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(25);
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<AxonStatus | "">("");
  const [sort, setSort] = useState<SortState | null>({ by: "contributors", order: "desc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms once data loads again.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no page-level clear is needed here.
  const recoveryAttempted = useRef(false);

  // Pull every axon matching the current status/search/sort, in skip/limit chunks.
  const fetchAllAxons = useCallback(async (): Promise<RawAxon[]> => {
    const out: RawAxon[] = [];
    const chunk = 200;
    for (let s = 0; ; s += chunk) {
      const data = await listAxons({
        q: debouncedSearch || undefined,
        status: status || undefined,
        sort: COL_SORT[sort?.by ?? ""] ?? "contributorCount",
        order: sort?.order ?? "desc",
        limit: chunk,
        skip: s,
      });
      out.push(...data.items);
      if (data.items.length === 0 || out.length >= data.total) break;
    }
    return out;
  }, [debouncedSearch, status, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setSkip(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setSkip(0), [status, sort, limit]);

  const fetchAxons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAxons({
        q: debouncedSearch || undefined,
        status: status || undefined,
        sort: COL_SORT[sort?.by ?? ""] ?? "contributorCount",
        order: sort?.order ?? "desc",
        limit,
        skip,
      });
      setItems(data.items);
      setTotal(data.total);
      if (!status && !debouncedSearch) setGrandTotal(data.total);
      setError("");
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (recoveryAttempted.current) return; // one attempt per failure episode
        recoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchAxons();
          }
        });
        return;
      }
      setError("Failed to load axons");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, sort, limit, skip]);

  useEffect(() => {
    fetchAxons();
  }, [fetchAxons]);

  const page = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const chips: FilterChip[] = [];
  if (status) {
    chips.push({
      id: "status",
      label: `Status: ${STATUS_LABEL[status]}`,
      onClear: () => setStatus(""),
    });
  }

  const columns = useMemo<ColumnDef<RawAxon>[]>(
    () => [
      {
        id: "identity",
        header: "Identity",
        frozen: true,
        sortable: true,
        width: 300,
        minWidth: 220,
        cell: (a) => (
          <div className="flex items-center gap-3">
            <Avatar src={a.imageUrl} name={axonLabel(a)} />
            <div className="min-w-0">
              <div className="truncate text-white">{axonLabel(a)}</div>
              <div className="truncate text-[11px] text-zinc-500">
                {a.headline || a.emails?.[0]?.value || a.phones?.[0]?.value || a._id}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "keys",
        header: "Keys",
        width: 200,
        cell: (a) => (
          <div className="flex flex-wrap gap-1">
            {(a.matchKeys ?? []).slice(0, 3).map((k) => (
              <span key={k} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-400">
                {k}
              </span>
            ))}
            {(a.matchKeys?.length ?? 0) > 3 && (
              <span className="text-[10px] text-zinc-500">+{(a.matchKeys?.length ?? 0) - 3}</span>
            )}
          </div>
        ),
      },
      {
        id: "contributors",
        header: "Contributors",
        sortable: true,
        align: "right",
        width: 140,
        cell: (a) => (
          <span className="inline-flex items-center gap-1 text-zinc-300">
            <UsersIcon className="h-3 w-3 text-zinc-500" />
            {a.contributorCount}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "right",
        width: 120,
        cell: (a) => <StatusBadge status={a.status} />,
      },
      {
        id: "created",
        header: "Created",
        sortable: true,
        align: "right",
        width: 130,
        cell: (a) => (
          <span className="text-zinc-400">
            {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        id: "updated",
        header: "Updated",
        sortable: true,
        align: "right",
        width: 130,
        cell: (a) => (
          <span className="text-zinc-400">
            {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808] text-white">
      <div className="flex-none px-4 pt-5">
        <h1 className="text-lg font-semibold tracking-tight">Axon Directory</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Global deduplicated person identities (raw, admin only) — search by email, phone, or id;
          click a row for the full axon.
        </p>
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <DataTable<RawAxon>
          tableId="admin-axons"
          columns={columns}
          rows={items}
          getRowId={(a) => a._id}
          loading={loading}
          emptyLabel="No axons found."
          rowHeight="auto"
          headerHeight={48}
          stickyBg="#181818"
          sort={sort}
          onSortChange={setSort}
          onRowClick={(a) => router.push(`/garage-admin/networkchains/axons/${a._id}`)}
          topBar={
            <>
              <TableTopBar
                views={VIEWS}
                activeView={status}
                onViewChange={(v) => setStatus(v as AxonStatus | "")}
                actions={<ExportButton onClick={() => setExportOpen(true)} />}
              />
              <AppliedFilterChips
                chips={chips}
                onClearAll={() => {
                  setStatus("");
                }}
              />
            </>
          }
          footerTotals={[
            {
              label: "All Axons",
              value: (grandTotal ?? total).toLocaleString(),
            },
          ]}
          pagination={{
            page,
            totalPages,
            rangeLabel: total === 0 ? "0" : `${skip + 1} to ${Math.min(total, skip + limit)}`,
            recordsPerPage: limit,
            recordsPerPageOptions: RPP_OPTIONS,
            onPrev: () => setSkip((s) => Math.max(0, s - limit)),
            onNext: () => setSkip((s) => s + limit),
            onRecordsPerPageChange: (n) => {
              setLimit(n);
              setSkip(0);
            },
          }}
        />
      </div>

      <ExportPanel<RawAxon>
        open={exportOpen}
        onOpenChange={setExportOpen}
        fields={AXON_EXPORT_FIELDS}
        fetchAll={fetchAllAxons}
        filenameBase="admin-axons"
      />
    </div>
  );
}
