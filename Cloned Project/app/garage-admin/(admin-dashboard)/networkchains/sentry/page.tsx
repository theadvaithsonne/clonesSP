"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table/DataTable";
import { TableTopBar, type TopBarView } from "@/components/data-table/TableTopBar";
import {
  AppliedFilterChips,
  type FilterChip,
} from "@/components/data-table/AppliedFilterChips";
import type { ColumnDef } from "@/components/data-table/types";
import { ExportPanel, ExportButton, type ExportField } from "@/components/data-table/ExportPanel";
import {
  listProjects,
  listIssues,
  levelClass,
  relTime,
  type SentryProject,
  type SentryIssue,
  type SentrySort,
  type SentryStatsPeriod,
  SentryUnavailableError,
} from "@/lib/nc-admin-api/admin-sentry";
import { AdminUnauthorizedError } from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { UnavailableState } from "@/components/nc-admin/sentry/unavailable-state";
import { useAdminProduct, ADMIN_PRODUCTS } from "@/lib/admin/product";
import { ProductSwitch } from "@/components/nc-admin/product-switch";
import { useAdminSearch } from "@/components/garage-admin/admin-search";

const SORTS: { value: SentrySort; label: string }[] = [
  { value: "date", label: "Last seen" },
  { value: "new", label: "First seen" },
  { value: "freq", label: "Events" },
  { value: "user", label: "Users" },
  { value: "priority", label: "Priority" },
];
const PERIODS: SentryStatsPeriod[] = ["1h", "24h", "7d", "14d", "30d", "90d"];
const DEFAULT_QUERY = "is:unresolved";

/** CSV columns for the Sentry issues table (export order). */
const SENTRY_EXPORT_FIELDS: ExportField<SentryIssue>[] = [
  { key: "title", label: "Error", value: (it) => it.title ?? "" },
  { key: "culprit", label: "Culprit", value: (it) => it.culprit ?? "" },
  { key: "value", label: "Detail", value: (it) => it.metadata?.value ?? "" },
  { key: "level", label: "Level", value: (it) => it.level ?? "" },
  { key: "status", label: "Status", value: (it) => it.status ?? "" },
  { key: "count", label: "Events", value: (it) => (it.count == null ? "" : String(it.count)) },
  { key: "userCount", label: "Users", value: (it) => it.userCount ?? 0 },
  { key: "firstSeen", label: "First Seen", value: (it) => it.firstSeen ?? "" },
  { key: "lastSeen", label: "Last Seen", value: (it) => it.lastSeen ?? "" },
  { key: "shortId", label: "Short ID", value: (it) => it.shortId ?? "" },
  { key: "project", label: "Project", value: (it) => it.project?.slug ?? "" },
  { key: "permalink", label: "Permalink", value: (it) => it.permalink ?? "" },
  { key: "id", label: "Issue ID", value: (it) => it.id ?? "" },
];

// Cursor pagination has no total; cap the export loop so a runaway cursor
// can't spin forever (100 pages × ~100 issues ≈ 10k rows).
const EXPORT_PAGE_CAP = 100;

export default function AdminSentryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<SentryProject[]>([]);
  const [project, setProject] = useState<string>(""); // slug
  // Header search replaces the page's own query box. Its initial value is ""
  // (not DEFAULT_QUERY), but `query || DEFAULT_QUERY` below already treats an
  // empty query as "is:unresolved", so the default filtered view is unchanged.
  const { query: queryInput, setQuery: setAdminSearch } = useAdminSearch();
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [sort, setSort] = useState<SentrySort>("date");
  const [statsPeriod, setStatsPeriod] = useState<SentryStatsPeriod>("14d");

  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const backStack = useRef<(string | undefined)[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [product] = useAdminProduct();

  // Only show the selected product's Sentry projects (tagged in SENTRY_PROJECTS).
  const visibleProjects = useMemo(
    () => projects.filter((p) => (p.product ?? "networkchains") === product),
    [projects, product],
  );
  // Keep the selected project inside the current product when it switches.
  useEffect(() => {
    if (visibleProjects.length === 0) return;
    if (!visibleProjects.some((p) => p.slug === project)) {
      setProject(visibleProjects[0].slug);
    }
  }, [visibleProjects, project]);

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms on the next successful load.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no page-level clear is needed here.
  const recoveryAttempted = useRef(false);

  const handleErr = useCallback((e: unknown, retry: () => void) => {
    if (e instanceof AdminUnauthorizedError) {
      if (recoveryAttempted.current) return; // one attempt per failure episode
      recoveryAttempted.current = true;
      ensureNcAdminToken().then((result) => {
        if (result.ok === true) {
          retry();
        }
      });
      return;
    }
    if (e instanceof SentryUnavailableError) {
      setUnavailable(e.reason);
      return;
    }
    setError("Failed to load issues.");
  }, []);

  // Walk the cursor chain from the start, collecting every issue for the
  // current project/query/sort/period (capped — cursor paging has no total).
  const fetchAllIssues = useCallback(async (): Promise<SentryIssue[]> => {
    if (!project) return [];
    const out: SentryIssue[] = [];
    let cur: string | undefined = undefined;
    for (let i = 0; i < EXPORT_PAGE_CAP; i++) {
      const r = await listIssues({ project, query: query || DEFAULT_QUERY, sort, statsPeriod, cursor: cur });
      out.push(...r.issues);
      if (!r.nextCursor || r.issues.length === 0) break;
      cur = r.nextCursor;
    }
    return out;
  }, [project, query, sort, statsPeriod]);

  // Debounce the search box into `query`.
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim()), 400);
    return () => clearTimeout(t);
  }, [queryInput]);

  // Load the project list once.
  const loadProjects = useCallback(async () => {
    try {
      const r = await listProjects();
      setProjects(r.projects);
      setProject((p) => p || r.projects[0]?.slug || "");
      if (r.projects.length === 0) setUnavailable("sentry_not_configured");
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      handleErr(e, loadProjects);
    }
  }, [handleErr]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const reqId = useRef(0);

  const fetchIssues = useCallback(
    async (cur: string | undefined) => {
      if (!project) return;
      // Stamp the request and drop its response if a newer one has started.
      // The product switch hydrates from localStorage after mount, so a hard
      // refresh on Seller resolves the default NetworkChains project first and
      // the real one a tick later — and NetworkChains, having issues to return,
      // was landing last and overwriting them. Without this the switch says one
      // product and the rows are another.
      const id = ++reqId.current;
      setLoading(true);
      setError("");
      setUnavailable(null);
      try {
        const r = await listIssues({ project, query: query || DEFAULT_QUERY, sort, statsPeriod, cursor: cur });
        if (id !== reqId.current) return;
        setIssues(r.issues);
        setNextCursor(r.nextCursor);
        recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      } catch (e) {
        if (id !== reqId.current) return;
        handleErr(e, () => fetchIssues(cur));
      } finally {
        // Only the newest request owns the spinner; a superseded one clearing
        // it would hide that the current fetch is still running.
        if (id === reqId.current) setLoading(false);
      }
    },
    [project, query, sort, statsPeriod, handleErr],
  );

  // Reset to page 0 whenever the filters change.
  useEffect(() => {
    backStack.current = [];
    setCursor(undefined);
    fetchIssues(undefined);
  }, [fetchIssues]);

  const next = () => {
    if (!nextCursor) return;
    backStack.current.push(cursor);
    setCursor(nextCursor);
    fetchIssues(nextCursor);
  };
  const prev = () => {
    const c = backStack.current.pop();
    setCursor(c);
    fetchIssues(c);
  };

  const views: TopBarView[] = visibleProjects.map((p) => ({ id: p.slug, label: p.label }));

  // A non-default query is otherwise invisible once typed — the box scrolls
  // away with the top bar, so a filtered list looks like an empty project.
  // Unlike NC, the query here comes from the dashboard shell's global search
  // box, so clearing the chip clears THAT — there is no local input to reset.
  const chips: FilterChip[] = [];
  if (queryInput.trim()) {
    chips.push({
      id: "query",
      label: `Query: ${queryInput.trim()}`,
      onClear: () => setAdminSearch(""),
    });
  }

  const selectCls =
    "rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-white/[0.2]";

  const columns = useMemo<ColumnDef<SentryIssue>[]>(
    () => [
      {
        id: "error",
        header: "Error",
        frozen: true,
        width: 440,
        minWidth: 280,
        cell: (it) => (
          <div className="flex items-start gap-2">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full border ${levelClass(it.level)}`} />
            <div className="min-w-0">
              <div className="truncate font-medium text-zinc-100">{it.title}</div>
              {(it.culprit || it.metadata?.value) && (
                <div className="truncate font-mono text-[11px] text-zinc-500">
                  {it.culprit || it.metadata?.value}
                </div>
              )}
            </div>
            {it.shortId && (
              <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-600">{it.shortId}</span>
            )}
          </div>
        ),
      },
      {
        id: "events",
        header: "Events",
        align: "right",
        width: 110,
        cell: (it) => <span className="font-mono text-zinc-300">{String(it.count ?? "—")}</span>,
      },
      {
        id: "users",
        header: "Users",
        align: "right",
        width: 100,
        cell: (it) => <span className="font-mono text-zinc-300">{it.userCount ?? 0}</span>,
      },
      {
        id: "lastSeen",
        header: "Last seen",
        align: "right",
        width: 150,
        cell: (it) => <span className="text-zinc-400">{relTime(it.lastSeen)}</span>,
      },
    ],
    [],
  );

  const page = backStack.current.length + 1;
  const totalPages = page + (nextCursor ? 1 : 0);

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808] text-white">
      <div className="flex-none px-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Sentry</h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              Live error issues across the {ADMIN_PRODUCTS.find((p) => p.id === product)?.label ?? "NetworkChains"} Sentry projects (read-only)
            </p>
          </div>
          <ProductSwitch />
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1">
        {unavailable ? (
          <div className="px-4">
            <UnavailableState reason={unavailable} />
          </div>
        ) : (
          <DataTable<SentryIssue>
            tableId="admin-sentry"
            columns={columns}
            rows={issues}
            getRowId={(it) => it.id}
            loading={loading}
            emptyLabel="No issues match."
            onRowClick={(it) => router.push(`/garage-admin/networkchains/sentry/${it.id}`)}
            rowHeight="auto"
            headerHeight={48}
            stickyBg="#181818"
            topBar={
              <>
              <TableTopBar
                views={views}
                activeView={project}
                onViewChange={setProject}
                actions={
                  <>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SentrySort)}
                      className={selectCls}
                      aria-label="Sort"
                    >
                      {SORTS.map((s) => (
                        <option key={s.value} value={s.value} className="bg-[#111]">
                          Sort: {s.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={statsPeriod}
                      onChange={(e) => setStatsPeriod(e.target.value as SentryStatsPeriod)}
                      className={selectCls}
                      aria-label="Stats period"
                    >
                      {PERIODS.map((p) => (
                        <option key={p} value={p} className="bg-[#111]">
                          {p}
                        </option>
                      ))}
                    </select>
                    <ExportButton onClick={() => setExportOpen(true)} />
                  </>
                }
              />
                <AppliedFilterChips
                  chips={chips}
                  onClearAll={() => setAdminSearch("")}
                />
              </>
            }
            pagination={{
              page,
              totalPages,
              rangeLabel: `${issues.length} shown`,
              onPrev: prev,
              onNext: next,
            }}
          />
        )}
      </div>

      <ExportPanel<SentryIssue>
        open={exportOpen}
        onOpenChange={setExportOpen}
        fields={SENTRY_EXPORT_FIELDS}
        fetchAll={fetchAllIssues}
        filenameBase="admin-sentry"
      />
    </div>
  );
}
