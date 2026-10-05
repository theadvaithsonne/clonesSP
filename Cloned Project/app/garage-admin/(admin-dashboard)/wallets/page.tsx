"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Wallet, Building2, ArrowUpRight, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { WalletStatsCards } from "@/components/admin/wallets/StatsCards";
import { BulkCreditDialog } from "@/components/admin/wallets/BulkCreditDialog";
import {
  listWallets,
  getWalletStats,
  type WalletListItem,
  type WalletStats,
  type ListFilters,
} from "@/lib/admin-api/wallets";

const PAGE_SIZE = 50;

function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRelative(dateIso: string | null): string {
  if (!dateIso) return "never";
  const ms = Date.now() - new Date(dateIso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function WalletsListPage() {
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [items, setItems] = useState<WalletListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [hasDebt, setHasDebt] = useState(false);
  const [sort, setSort] = useState<NonNullable<ListFilters["sort"]>>("lastActivity");
  const [order, setOrder] = useState<NonNullable<ListFilters["order"]>>("desc");
  const [loading, setLoading] = useState(true);

  // Shared header search — filters this table server-side (debounced). Routed
  // through ?q= (broader match: org name/slug + founder name/email), separate
  // from the toolbar's ?search= org-name/slug box below.
  const { query: headerSearch } = useAdminSearch();
  const [debouncedHeaderSearch, setDebouncedHeaderSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHeaderSearch(headerSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [headerSearch]);
  // A new header search bounces back to the first page.
  useEffect(() => { setSkip(0); }, [debouncedHeaderSearch]);

  const queryParams: ListFilters = useMemo(() => ({
    limit: PAGE_SIZE,
    skip,
    sort,
    order,
    hasDebt,
    search: search || undefined,
    q: debouncedHeaderSearch || undefined,
  }), [skip, sort, order, hasDebt, search, debouncedHeaderSearch]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([listWallets(queryParams), getWalletStats()])
      .then(([list, s]) => {
        if (!alive) return;
        setItems(list.items);
        setTotal(list.total);
        setStats(s);
      })
      .catch((e) => toast.error(e?.message ?? "Failed to load wallets"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [queryParams]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#FBD10D]/5 border border-[#FBD10D]/15 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-[#FBD10D]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">Wallets</h1>
            <p className="text-sm text-[#9fa0b8] mt-1.5">
              Manage Aivatar wallet credits across every organization.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/garage-admin/wallets/ledger">
            <Button
              variant="outline"
              className="h-9 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-xl"
            >
              <ListOrdered className="h-4 w-4 mr-2" /> Ledger
            </Button>
          </Link>
          <BulkCreditDialog onComplete={() => setSkip(0)} />
        </div>
      </div>

      <WalletStatsCards stats={stats} />

      {/* Toolbar */}
      <div className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-3 mb-4 shadow-xl flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a5a72]" />
          <Input
            placeholder="Search by org name or slug…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSkip(0); }}
            className="pl-9 h-9 bg-[#0d0d11] border-[#2c2c3a] text-white placeholder:text-[#5a5a72] rounded-xl focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
          />
        </div>
        <button
          type="button"
          onClick={() => { setHasDebt((v) => !v); setSkip(0); }}
          className={`h-9 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
            hasDebt
              ? "bg-red-500/10 border border-red-500/30 text-red-400"
              : "bg-[#0d0d11] border border-[#2c2c3a] text-[#9fa0b8] hover:text-white hover:border-[#363649]"
          }`}
        >
          Has debt
        </button>
        <select
          value={`${sort}:${order}`}
          onChange={(e) => {
            const [s, o] = e.target.value.split(":");
            setSort(s as any); setOrder(o as any); setSkip(0);
          }}
          className="h-9 bg-[#0d0d11] border border-[#2c2c3a] text-white text-sm rounded-xl px-3 focus:outline-none focus:border-[#FBD10D]/40"
        >
          <option value="lastActivity:desc">Last activity ↓</option>
          <option value="balance:desc">Balance ↓</option>
          <option value="balance:asc">Balance ↑</option>
          <option value="debt:desc">Debt ↓</option>
        </select>
      </div>

      {/* Wallet rows */}
      {loading ? (
        <div className="grid grid-cols-1 gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-4 shadow-xl">
              <div className="h-4 w-48 bg-[#1a1a22] rounded animate-pulse mb-2" />
              <div className="h-3 w-72 bg-[#1a1a22] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-[#2a2a35] rounded-2xl py-20 flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[#0d0d11] border border-[#2a2a35] flex items-center justify-center">
            <Building2 className="h-6 w-6 text-[#5a5a72]" />
          </div>
          <p className="text-sm font-bold text-[#c7c7da]">No wallets match these filters</p>
          <p className="text-xs text-[#5a5a72]">Try clearing the search or the &quot;Has debt&quot; filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {items.map((w) => {
            const inner = (
              <>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  w.orgDeleted
                    ? "bg-[#1a1a22] border border-[#2c2c3a]"
                    : "bg-[#FBD10D]/5 border border-[#FBD10D]/10"
                }`}>
                  <Building2 className={`h-5 w-5 ${w.orgDeleted ? "text-[#3a3a4a]" : "text-[#FBD10D]"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-bold truncate ${
                      w.orgDeleted ? "text-[#5a5a72] line-through decoration-[#2a2a35]" : "text-white"
                    }`}>{w.orgName}</p>
                    {w.orgDeleted && (
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md border bg-[#1a1a22] border-[#2c2c3a] text-[#5a5a72]">
                        deleted
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5a5a72] truncate mt-0.5">
                    {w.orgSlug}{w.founderEmail ? ` · ${w.founderEmail}` : ""} · {fmtRelative(w.lastTransactionAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-mono text-base font-black leading-none ${
                    w.orgDeleted ? "text-[#5a5a72]" : "text-white"
                  }`}>{fmtCents(w.balance)}</p>
                  {w.debt > 0 && (
                    <p className="font-mono text-[11px] text-red-400 mt-1">debt {fmtCents(w.debt)}</p>
                  )}
                </div>
                {!w.orgDeleted && (
                  <ArrowUpRight className="h-4 w-4 text-[#5a5a72] group-hover:text-[#FBD10D] transition-colors shrink-0" />
                )}
              </>
            );
            if (w.orgDeleted) {
              return (
                <div
                  key={w.orgId}
                  title="The organization for this wallet has been deleted. The wallet doc is preserved pending review."
                  className="bg-[#0d0d11] border border-[#2a2a35] rounded-2xl p-4 shadow-xl flex items-center gap-4 cursor-not-allowed opacity-80"
                >
                  {inner}
                </div>
              );
            }
            return (
              <Link
                key={w.orgId}
                href={`/garage-admin/wallets/${w.orgId}`}
                className="group bg-[#111116] border border-[#2a2a35] rounded-2xl p-4 shadow-xl hover:border-[#FBD10D]/40 transition-colors flex items-center gap-4"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-xs text-[#5a5a72]">
        <span>{total === 0 ? 0 : skip + 1}–{Math.min(skip + items.length, total)} of {total}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
            className="h-8 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40"
          >Prev</Button>
          <Button
            size="sm"
            variant="outline"
            disabled={skip + items.length >= total}
            onClick={() => setSkip(skip + PAGE_SIZE)}
            className="h-8 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40"
          >Next</Button>
        </div>
      </div>
    </div>
  );
}
