"use client";

import { useState, useEffect, useRef } from "react";
import {
  Users,
  Search,
  RefreshCcw,
  Mail,
  Rss,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  TrendingUp,
  DollarSign,
  UserCheck,
  Clock,
  SlidersHorizontal,
  LayoutGrid,
  Columns3,
  Copy,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Check,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getCustomers,
  getOrgChannels,
  getFeedStats,
  type Customer,
  type Channel,
  type FeedStats,
} from "@/lib/feed-api";

function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

type StatusTab = "all" | "active" | "inactive";
type ViewMode = "column" | "grid";
type SortKey = "name" | "email" | "totalSpent" | "joinedAt" | "channels";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

export function CustomersPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>("column");
  const [showViewDrop, setShowViewDrop] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [showFilter, setShowFilter] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("joinedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const filterRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = getOrgId();
    setOrgId(id);
  }, []);

  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [customersData, channelsData, statsData] = await Promise.all([
        getCustomers(orgId, {
          channelId: selectedChannelId || undefined,
          status: statusTab === "all" ? undefined : statusTab,
        }),
        getOrgChannels(orgId),
        getFeedStats(orgId),
      ]);
      setCustomers(customersData.customers);
      setChannels(channelsData.channels);
      setStats(statsData.stats);
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to load network data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) fetchData();
  }, [orgId, selectedChannelId, statusTab]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setShowFilter(false);
      if (viewRef.current && !viewRef.current.contains(e.target as Node))
        setShowViewDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fmt$ = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const clearFilters = () => {
    setSelectedChannelId(null);
    setStatusTab("all");
  };

  const hasActiveFilters = selectedChannelId !== null || statusTab !== "all";

  const filtered = customers
    .filter((c) => {
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        if (
          !c.user?.name?.toLowerCase().includes(t) &&
          !c.user?.email?.toLowerCase().includes(t)
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = (a.user?.name || "").localeCompare(b.user?.name || "");
      else if (sortKey === "email") cmp = (a.user?.email || "").localeCompare(b.user?.email || "");
      else if (sortKey === "totalSpent") cmp = a.totalSpent - b.totalSpent;
      else if (sortKey === "joinedAt")
        cmp = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      else if (sortKey === "channels")
        cmp =
          a.subscriptions.filter((s) => s.status === "active").length -
          b.subscriptions.filter((s) => s.status === "active").length;
      return sortDir === "asc" ? cmp : -cmp;
    });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
    setPage(1);
  };

  const tabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
  ];

  return (
    <div className="h-[calc(100%-60px)] w-full flex flex-col bg-[#0b0b0d] text-white">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 pt-5 pb-0">
        {/* Left: title */}
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-brand/15 rounded-lg">
            <Users className="h-5 w-5 text-brand" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Customers</h1>
          {!loading && (
            <span className="text-sm text-[#5a5a72] font-normal">
              ({filtered.length} of {customers.length})
            </span>
          )}
        </div>

        {/* Right: stats */}
        {stats && (
          <div className="flex items-center">
            {[
              {
                icon: <Users className="h-3.5 w-3.5 text-[#7c96ff]" />,
                bg: "bg-[#3a4080]",
                label: "Subscribers",
                value: stats.totalSubscribers,
              },
              {
                icon: <DollarSign className="h-3.5 w-3.5 text-emerald-300" />,
                bg: "bg-[#1a4a35]",
                label: "Revenue",
                value: fmt$(stats.totalRevenueUsd),
              },
              {
                icon: <Rss className="h-3.5 w-3.5 text-[#5bc8d0]" />,
                bg: "bg-[#1a3540]",
                label: "Channels",
                value: stats.activeChannels,
              },
              {
                icon: <TrendingUp className="h-3.5 w-3.5 text-violet-400" />,
                bg: "bg-[#2d1f50]",
                label: "Posts",
                value: stats.totalPosts,
              },
            ].map((s, i) => (
              <div key={i} className="flex items-center">
                <div className="flex items-center gap-2 px-3">
                  <div className={cn("p-1.5 rounded-lg", s.bg)}>{s.icon}</div>
                  <div>
                    <p className="text-[10px] text-[#7c7c9c] leading-tight">{s.label}</p>
                    <p className="text-xs font-bold text-white">{s.value}</p>
                  </div>
                </div>
                {i < 3 && <div className="h-8 w-px bg-[#2a2a35]" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sub-header: tabs + controls ── */}
      <div className="flex items-center justify-between px-6 pt-4 pb-0 border-b border-[#2a2a35]">
        {/* Status tabs */}
        <div className="flex items-center">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setStatusTab(t.key); setPage(1); }}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold transition-all duration-150 border-b-2",
                statusTab === t.key
                  ? "text-brand border-brand"
                  : "text-[#7c7c9c] border-transparent hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 pb-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a5a72]" />
            <input
              type="text"
              placeholder="Type to search"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="h-8 pl-9 pr-3 w-48 rounded-lg bg-[#13131a] border border-[#2a2a35] text-sm text-white placeholder:text-[#5a5a72] focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>

          {/* Filters dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilter((v) => !v)}
              className={cn(
                "h-8 px-3 flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-all duration-150",
                hasActiveFilters || showFilter
                  ? "border-brand/60 text-brand bg-brand/10"
                  : "border-[#2a2a35] text-[#7c7c9c] bg-[#13131a] hover:border-brand/40 hover:text-white"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
            </button>

            {/* Filter Popover */}
            {showFilter && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#111118] border border-[#2a2a35] rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a35]">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-brand" />
                    <span className="text-sm font-bold text-white">Filters</span>
                  </div>
                  <button
                    onClick={() => setShowFilter(false)}
                    className="p-1 text-[#5a5a72] hover:text-white rounded-md hover:bg-[#1e1e28] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
                  {/* Status */}
                  <div>
                    <p className="text-[10px] font-bold text-[#5a5a72] uppercase tracking-widest mb-2.5">
                      Status
                    </p>
                    <div className="space-y-1">
                      {(["all", "active", "inactive"] as StatusTab[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => { setStatusTab(s); setPage(1); }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center justify-between gap-2",
                            statusTab === s
                              ? "bg-brand text-brand-foreground"
                              : "text-[#9a9ab0] hover:bg-[#1e1e28] hover:text-white"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {s === "active" && <UserCheck className="h-3.5 w-3.5" />}
                            {s === "inactive" && <Clock className="h-3.5 w-3.5" />}
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </span>
                          {statusTab === s && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Channel */}
                  {channels.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[#5a5a72] uppercase tracking-widest mb-2.5">
                        Channel
                      </p>
                      <div className="space-y-1">
                        <button
                          onClick={() => setSelectedChannelId(null)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center justify-between",
                            selectedChannelId === null
                              ? "bg-brand text-brand-foreground"
                              : "text-[#9a9ab0] hover:bg-[#1e1e28] hover:text-white"
                          )}
                        >
                          All Channels
                          {selectedChannelId === null && <Check className="h-3.5 w-3.5" />}
                        </button>
                        {channels.map((ch) => (
                          <button
                            key={ch._id}
                            onClick={() => setSelectedChannelId(ch._id)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center justify-between gap-2",
                              selectedChannelId === ch._id
                                ? "bg-brand text-brand-foreground"
                                : "text-[#9a9ab0] hover:bg-[#1e1e28] hover:text-white"
                            )}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Rss className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{ch.title}</span>
                            </span>
                            {selectedChannelId === ch._id && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasActiveFilters && (
                    <button
                      onClick={() => { clearFilters(); setShowFilter(false); }}
                      className="w-full py-2 rounded-lg border border-[#2a2a35] text-sm text-[#7c7c9c] hover:text-white hover:border-brand/40 transition-all duration-150"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* View mode dropdown */}
          <div className="relative" ref={viewRef}>
            <button
              onClick={() => setShowViewDrop((v) => !v)}
              className={cn(
                "h-8 px-3 flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-all duration-150",
                showViewDrop
                  ? "border-brand/60 text-brand bg-brand/10"
                  : "border-[#2a2a35] text-[#7c7c9c] bg-[#13131a] hover:border-brand/40 hover:text-white"
              )}
            >
              {viewMode === "column" ? (
                <Columns3 className="h-3.5 w-3.5" />
              ) : (
                <LayoutGrid className="h-3.5 w-3.5" />
              )}
              {viewMode === "column" ? "Column" : "Grid"}
              <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform duration-150", showViewDrop && "rotate-180")} />
            </button>

            {showViewDrop && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#111118] border border-[#2a2a35] rounded-xl shadow-2xl shadow-black/70 z-50 overflow-hidden">
                {/* Header */}
                <div className="px-3.5 pt-3 pb-2 border-b border-[#1e1e28]">
                  <p className="text-[10px] font-bold text-[#5a5a72] uppercase tracking-widest">View Layout</p>
                </div>

                <div className="p-2 space-y-1">
                  {/* Column option */}
                  <button
                    onClick={() => { setViewMode("column"); setShowViewDrop(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-all duration-150 group/opt",
                      viewMode === "column"
                        ? "bg-brand/10 ring-1 ring-brand/25"
                        : "hover:bg-[#1a1a24]"
                    )}
                  >
                    {/* Preview: 3 horizontal rows */}
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex flex-col justify-center gap-1 px-1.5 flex-shrink-0 border transition-colors",
                      viewMode === "column" ? "bg-brand/15 border-brand/25" : "bg-[#1a1a24] border-[#2a2a35] group-hover/opt:border-[#3a3a4a]"
                    )}>
                      {[0,1,2].map(i => (
                        <div key={i} className={cn("h-1 rounded-full", viewMode === "column" ? "bg-brand/70" : "bg-[#3a3a4a] group-hover/opt:bg-[#4a4a5a]")} />
                      ))}
                    </div>
                    <div className="text-left flex-1">
                      <p className={cn("text-sm font-semibold leading-tight", viewMode === "column" ? "text-brand" : "text-[#b0b0c8]")}>
                        Column
                      </p>
                      <p className="text-[11px] text-[#5a5a72] mt-0.5">Table with rows</p>
                    </div>
                    {viewMode === "column" && (
                      <Check className="h-3.5 w-3.5 text-brand flex-shrink-0" />
                    )}
                  </button>

                  {/* Grid option */}
                  <button
                    onClick={() => { setViewMode("grid"); setShowViewDrop(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-all duration-150 group/opt",
                      viewMode === "grid"
                        ? "bg-brand/10 ring-1 ring-brand/25"
                        : "hover:bg-[#1a1a24]"
                    )}
                  >
                    {/* Preview: 2×2 grid */}
                    <div className={cn(
                      "w-9 h-9 rounded-lg grid grid-cols-2 gap-1 p-1.5 flex-shrink-0 border transition-colors",
                      viewMode === "grid" ? "bg-brand/15 border-brand/25" : "bg-[#1a1a24] border-[#2a2a35] group-hover/opt:border-[#3a3a4a]"
                    )}>
                      {[0,1,2,3].map(i => (
                        <div key={i} className={cn("rounded-sm", viewMode === "grid" ? "bg-brand/70" : "bg-[#3a3a4a] group-hover/opt:bg-[#4a4a5a]")} />
                      ))}
                    </div>
                    <div className="text-left flex-1">
                      <p className={cn("text-sm font-semibold leading-tight", viewMode === "grid" ? "text-brand" : "text-[#b0b0c8]")}>
                        Grid
                      </p>
                      <p className="text-[11px] text-[#5a5a72] mt-0.5">Card layout</p>
                    </div>
                    {viewMode === "grid" && (
                      <Check className="h-3.5 w-3.5 text-brand flex-shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>


          {/* Refresh */}
          <button
            onClick={() => fetchData()}
            title="Refresh"
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#2a2a35] bg-[#13131a] text-[#7c7c9c] hover:border-brand/40 hover:text-brand transition-all duration-150"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Main content (scrollable) ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-brand/10 mb-4">
              <Users className="h-8 w-8 text-brand/60" />
            </div>
            <p className="text-[#7c7c9c] text-sm font-medium">
              {searchTerm || hasActiveFilters
                ? "No customers match your filters"
                : "No customers yet"}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-3 text-xs text-brand hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : viewMode === "column" ? (
          /* ── TABLE ── */
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a35] bg-[#0c0c10] sticky top-0 z-10">
                <th className="pl-6 pr-3 py-3.5 text-left">
                  <SortBtn label="Affiliate" k="name" cur={sortKey} dir={sortDir} onClick={handleSort} />
                </th>
                <th className="w-36 px-4 py-3.5 text-left">
                  <SortBtn label="Subscriptions" k="channels" cur={sortKey} dir={sortDir} onClick={handleSort} />
                </th>
                <th className="w-36 px-4 py-3.5 text-left">
                  <SortBtn label="Total Earning" k="totalSpent" cur={sortKey} dir={sortDir} onClick={handleSort} />
                </th>
                <th className="w-36 px-4 py-3.5 text-left">
                  <SortBtn label="Joined" k="joinedAt" cur={sortKey} dir={sortDir} onClick={handleSort} />
                </th>
                <th className="w-28 pr-6 pl-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#5a5a72]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((customer, idx) => (
                <TableRow
                  key={customer.user._id}
                  customer={customer}
                  fmt$={fmt$}
                  fmtDate={fmtDate}
                  isExpanded={expandedCustomerId === customer.user._id}
                  onToggleExpand={() =>
                    setExpandedCustomerId(
                      expandedCustomerId === customer.user._id ? null : customer.user._id
                    )
                  }
                  isLast={idx === paginated.length - 1}
                />
              ))}
            </tbody>
          </table>
        ) : (
          /* ── GRID ── */
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginated.map((customer) => (
              <GridCard
                key={customer.user._id}
                customer={customer}
                fmt$={fmt$}
                fmtDate={fmtDate}
                isExpanded={expandedCustomerId === customer.user._id}
                onToggleExpand={() =>
                  setExpandedCustomerId(
                    expandedCustomerId === customer.user._id ? null : customer.user._id
                  )
                }
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && filtered.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#2a2a35]">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 w-7 flex items-center justify-center rounded border border-[#2a2a35] text-[#7c7c9c] hover:border-brand/50 hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "h-7 px-2.5 min-w-[28px] flex items-center justify-center rounded text-xs font-bold transition-colors",
                  page === p
                    ? "bg-brand/15 text-brand border border-brand/30"
                    : "text-[#7c7c9c] border border-transparent hover:border-[#2a2a35] hover:text-white"
                )}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 w-7 flex items-center justify-center rounded border border-[#2a2a35] text-[#7c7c9c] hover:border-brand/50 hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SortBtn                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
function SortBtn({
  label, k, cur, dir, onClick,
}: {
  label: string; k: SortKey; cur: SortKey; dir: SortDir; onClick: (k: SortKey) => void;
}) {
  const active = cur === k;
  return (
    <button
      onClick={() => onClick(k)}
      className={cn(
        "flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors group select-none",
        active ? "text-brand" : "text-[#5a5a72] hover:text-[#b0b0c8]"
      )}
    >
      {label}
      <span className={cn("transition-colors", active ? "text-brand" : "text-[#3a3a4a] group-hover:text-[#5a5a72]")}>
        {active && dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* StatusBadge                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold",
      isActive
        ? "text-emerald-400 bg-emerald-400/10"
        : "text-[#7c7c9c] bg-[#1a1a24]"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-400" : "bg-[#5a5a72]")} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ChannelBadge — small pill showing channel count next to name               */
/* ─────────────────────────────────────────────────────────────────────────── */
function ChannelBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand/10 text-[10px] font-bold text-brand border border-brand/15 flex-shrink-0 whitespace-nowrap">
      <Rss className="h-2.5 w-2.5" />
      {count} {count === 1 ? "channel" : "channels"}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* AffiliateCell — avatar + name (+ channel badge + copy) + email (+ copy)    */
/* ─────────────────────────────────────────────────────────────────────────── */
function AffiliateCell({ customer }: { customer: Customer }) {
  const channelCount = customer.subscriptions.length;

  const copyName = () => {
    navigator.clipboard.writeText(customer.user.name || "");
    toast.success("Name copied!");
  };
  const copyEmail = () => {
    navigator.clipboard.writeText(customer.user.email);
    toast.success("Email copied!");
  };

  return (
    <div className="flex items-center gap-3 group/aff">
      {/* Avatar */}
      {customer.user.profilePicture ? (
        <img
          src={customer.user.profilePicture}
          alt={customer.user.name}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-[#1e1e2a]"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand/25 to-[#f59e0b]/15 border border-brand/20 flex items-center justify-center text-brand font-bold text-sm flex-shrink-0">
          {(customer.user.name || customer.user.email || "?").charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name + channel badge + email */}
      <div className="min-w-0">
        {/* Name row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold text-white truncate max-w-[140px]">
            {customer.user.name || "Unknown"}
          </span>
          <ChannelBadge count={channelCount} />
          <button
            onClick={copyName}
            title="Copy name"
            className="opacity-0 group-hover/aff:opacity-100 p-0.5 text-[#5a5a72] hover:text-brand transition-all duration-150 flex-shrink-0"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
        {/* Email row */}
        <div className="flex items-center gap-1 mt-0.5">
          <Mail className="h-3 w-3 text-[#4a4a60] flex-shrink-0" />
          <span className="text-[12px] text-[#7c7c9c] truncate max-w-[170px]">
            {customer.user.email}
          </span>
          <button
            onClick={copyEmail}
            title="Copy email"
            className="opacity-0 group-hover/aff:opacity-100 p-0.5 text-[#5a5a72] hover:text-brand transition-all duration-150 flex-shrink-0"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* TableRow                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
function TableRow({
  customer, fmt$, fmtDate, isExpanded, onToggleExpand, isLast,
}: {
  customer: Customer;
  fmt$: (n: number) => string;
  fmtDate: (s: string) => string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isLast: boolean;
}) {
  const activeSubs = customer.subscriptions.filter((s) => s.status === "active").length;
  const isActive = activeSubs > 0;

  return (
    <>
      <tr className={cn(
        "transition-colors duration-100 group",
        !isLast && !isExpanded && "border-b border-[#1a1a24]",
        "hover:bg-[#111116]"
      )}>
        {/* Affiliate */}
        <td className="pl-6 pr-3 py-3.5 align-middle">
          <AffiliateCell customer={customer} />
        </td>

        {/* Subscriptions */}
        <td className="px-4 py-3.5 align-middle">
          <button
            onClick={customer.subscriptions.length > 0 ? onToggleExpand : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-semibold transition-all duration-150",
              customer.subscriptions.length > 0
                ? isExpanded
                  ? "bg-brand/15 text-brand"
                  : "bg-[#13131a] text-white hover:bg-[#1a1a24]"
                : "bg-transparent text-[#3a3a4a] cursor-default"
            )}
          >
            {customer.subscriptions.length}
            {customer.subscriptions.length > 0 && (
              isExpanded
                ? <ChevronUp className="h-3 w-3" />
                : <ChevronDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        </td>

        {/* Total Earning */}
        <td className="px-4 py-3.5 align-middle">
          <span className={cn(
            "text-[13px] font-bold",
            customer.totalSpent > 0 ? "text-brand" : "text-[#3a3a4a]"
          )}>
            {fmt$(customer.totalSpent)}
          </span>
        </td>

        {/* Joined */}
        <td className="px-4 py-3.5 align-middle">
          <div className="flex items-center gap-1.5 text-[13px] text-[#7c7c9c]">
            <Calendar className="h-3.5 w-3.5 text-[#4a4a60]" />
            {fmtDate(customer.joinedAt)}
          </div>
        </td>

        {/* Status */}
        <td className="pr-6 pl-4 py-3.5 align-middle">
          <StatusBadge isActive={isActive} />
        </td>
      </tr>

      {/* Expanded subscriptions */}
      {isExpanded && customer.subscriptions.length > 0 && (
        <tr className={cn(!isLast && "border-b border-[#1a1a24]")}>
          <td colSpan={5} className="bg-[#08080b] px-6 py-4">
            <div className="ml-12">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5a5a72] mb-3">
                Subscriptions
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {customer.subscriptions.map((sub, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-[#0e0e12] border border-[#1e1e28] rounded-lg hover:border-[#2a2a38] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-brand/8 rounded-lg">
                        <Rss className="h-3.5 w-3.5 text-brand/80" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-white leading-tight">{sub.channelTitle}</p>
                        <p className="text-[11px] text-[#5a5a72]">Since {fmtDate(sub.joinedAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {sub.isFree ? (
                        <span className="text-emerald-400 text-xs font-bold">Free</span>
                      ) : (
                        <span className="text-brand text-xs font-bold">
                          {fmt$(sub.price)}
                          {sub.isSubscription && <span className="text-[#5a5a72] font-normal">/mo</span>}
                        </span>
                      )}
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        sub.status === "active"
                          ? "bg-emerald-400/10 text-emerald-400"
                          : "bg-[#1e1e28] text-[#7c7c9c]"
                      )}>
                        {sub.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* GridCard                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
function GridCard({
  customer, fmt$, fmtDate, isExpanded, onToggleExpand,
}: {
  customer: Customer;
  fmt$: (n: number) => string;
  fmtDate: (s: string) => string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const activeSubs = customer.subscriptions.filter((s) => s.status === "active").length;
  const isActive = activeSubs > 0;
  const channelCount = customer.subscriptions.length;

  const copyName = () => { navigator.clipboard.writeText(customer.user.name || ""); toast.success("Name copied!"); };
  const copyEmail = () => { navigator.clipboard.writeText(customer.user.email); toast.success("Email copied!"); };

  const hasSubs = customer.subscriptions.length > 0;

  return (
    <div
      onClick={hasSubs ? onToggleExpand : undefined}
      className={cn(
        "bg-[#0e0e12] border rounded-xl overflow-hidden transition-all duration-200 flex flex-col group/card",
        hasSubs ? "cursor-pointer" : "cursor-default",
        isExpanded
          ? "border-brand/40 shadow-lg shadow-brand/5"
          : hasSubs
            ? "border-[#1e1e28] hover:border-brand/35 hover:shadow-md hover:shadow-brand/5"
            : "border-[#1e1e28]"
      )}
    >
      {/* Card body */}
      <div className="p-4 space-y-3">
        {/* Status */}
        <div className="flex justify-end">
          <StatusBadge isActive={isActive} />
        </div>

        {/* Avatar + Name + Email */}
        <div className="flex items-start gap-3 group/gc">
          {customer.user.profilePicture ? (
            <img
              src={customer.user.profilePicture}
              alt={customer.user.name}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-[#1e1e2a] flex-shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand/25 to-[#f59e0b]/15 border border-brand/20 flex items-center justify-center text-brand font-bold text-base flex-shrink-0">
              {(customer.user.name || customer.user.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {/* Name + channel badge */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold text-white truncate">{customer.user.name || "Unknown"}</p>
              <ChannelBadge count={channelCount} />
              <button
                onClick={(e) => { e.stopPropagation(); copyName(); }}
                title="Copy name"
                className="opacity-0 group-hover/gc:opacity-100 p-0.5 text-[#5a5a72] hover:text-brand transition-all duration-150 flex-shrink-0"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            {/* Email */}
            <div className="flex items-center gap-1 mt-0.5">
              <Mail className="h-3 w-3 text-[#4a4a60] flex-shrink-0" />
              <p className="text-[11px] text-[#7c7c9c] truncate flex-1">{customer.user.email}</p>
              <button
                onClick={(e) => { e.stopPropagation(); copyEmail(); }}
                title="Copy email"
                className="opacity-0 group-hover/gc:opacity-100 p-0.5 text-[#5a5a72] hover:text-brand transition-all duration-150 flex-shrink-0"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-[#0a0a0e] rounded-lg p-2.5 border border-[#1e1e28]">
            <p className="text-[10px] text-[#5a5a72] uppercase tracking-wider mb-1">Earning</p>
            <p className={cn("text-sm font-bold", customer.totalSpent > 0 ? "text-brand" : "text-[#3a3a4a]")}>{fmt$(customer.totalSpent)}</p>
          </div>
          <div className="bg-[#0a0a0e] rounded-lg p-2.5 border border-[#1e1e28]">
            <p className="text-[10px] text-[#5a5a72] uppercase tracking-wider mb-1">Joined</p>
            <p className="text-[11px] font-semibold text-white">{fmtDate(customer.joinedAt)}</p>
          </div>
        </div>
      </div>

      {/* ── Subscription indicator footer (visual only — whole card is the trigger) ── */}
      <div className={cn(
        "mt-auto flex items-center justify-between px-4 py-3 border-t transition-all duration-200",
        isExpanded
          ? "border-brand/30 bg-brand/5"
          : "border-[#1e1e28] bg-[#08080b]"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn("p-1 rounded transition-colors duration-200", isExpanded ? "bg-brand/20" : "bg-brand/8")}>
            <Rss className={cn("h-3 w-3 transition-colors duration-200", isExpanded ? "text-brand" : "text-brand/70")} />
          </div>
          <span className={cn("text-xs font-semibold transition-colors duration-200", isExpanded ? "text-brand" : "text-[#7c7c9c]")}>
            {customer.subscriptions.length} subscription{customer.subscriptions.length !== 1 ? "s" : ""}
          </span>
        </div>
        {hasSubs && (
          <ChevronDown className={cn(
            "h-4 w-4 transition-all duration-200",
            isExpanded ? "rotate-180 text-brand" : "text-[#5a5a72]"
          )} />
        )}
      </div>

      {/* ── Expanded subscription list ── */}
      {isExpanded && hasSubs && (
        <div
          className="border-t border-brand/15 bg-[#08080b] px-3 py-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          {customer.subscriptions.map((sub, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2.5 bg-[#0e0e13] border border-[#1e1e28] rounded-lg hover:border-[#2a2a38] transition-colors"
            >
              <div className="min-w-0 mr-2">
                <p className="text-[12px] font-semibold text-white leading-tight truncate">{sub.channelTitle}</p>
                <p className="text-[10px] text-[#5a5a72] mt-0.5">Since {fmtDate(sub.joinedAt)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {sub.isFree ? (
                  <span className="text-emerald-400 text-[10px] font-bold">Free</span>
                ) : (
                  <span className="text-brand text-[10px] font-bold">{fmt$(sub.price)}</span>
                )}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                  sub.status === "active" ? "bg-emerald-400/15 text-emerald-400" : "bg-[#1e1e28] text-[#7c7c9c]"
                )}>
                  {sub.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
