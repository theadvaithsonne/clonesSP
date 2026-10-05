"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Download, ArrowLeft, ListOrdered, Building2,
  ArrowUpRight, ArrowDownLeft, Eraser,
} from "lucide-react";
import { toast } from "sonner";
import {
  getLedger, fetchLedgerCsv,
  type WalletTransaction, type LedgerFilters,
} from "@/lib/admin-api/wallets";

const PAGE_SIZE = 100;
const ALL_TYPES: NonNullable<LedgerFilters["types"]> = ["credit", "debit", "clear_debt"];
const ALL_SOURCES: NonNullable<LedgerFilters["sources"]> = ["user", "admin", "system"];

function fmtCents(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

const TYPE_PALETTE: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  credit:     { bg: "bg-green-500/10",  border: "border-green-500/25",  text: "text-green-400",  icon: ArrowUpRight },
  debit:      { bg: "bg-red-500/10",    border: "border-red-500/25",    text: "text-red-400",    icon: ArrowDownLeft },
  clear_debt: { bg: "bg-orange-500/10", border: "border-orange-500/25", text: "text-orange-400", icon: Eraser },
};

const SOURCE_PALETTE: Record<string, string> = {
  user:   "bg-blue-500/10 border-blue-500/25 text-blue-400",
  admin:  "bg-[#FBD10D]/10 border-[#FBD10D]/25 text-[#FBD10D]",
  system: "bg-[#1a1a22] border-[#2c2c3a] text-[#9fa0b8]",
};

function FilterChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 px-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? "bg-[#FBD10D]/10 border border-[#FBD10D]/30 text-[#FBD10D]"
          : "bg-[#0d0d11] border border-[#2c2c3a] text-[#9fa0b8] hover:text-white hover:border-[#363649]"
      }`}
    >
      {label}
    </button>
  );
}

export default function LedgerPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<(WalletTransaction & { orgName: string; orgSlug: string; orgDeleted?: boolean })[]>([]);
  const [total, setTotal] = useState(0);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [loading, setLoading] = useState(true);

  // Read raw query params as strings — using parsed arrays as effect deps
  // would loop forever because .split() returns fresh arrays each render.
  const dateFrom = sp.get("dateFrom") || "";
  const dateTo = sp.get("dateTo") || "";
  const typesStr = sp.get("types") ?? ALL_TYPES.join(",");
  const sourcesStr = sp.get("sources") ?? ALL_SOURCES.join(",");
  const skip = parseInt(sp.get("skip") || "0", 10) || 0;

  const types = useMemo(
    () => typesStr.split(",").filter(Boolean) as LedgerFilters["types"],
    [typesStr],
  );
  const sources = useMemo(
    () => sourcesStr.split(",").filter(Boolean) as LedgerFilters["sources"],
    [sourcesStr],
  );

  const filters: LedgerFilters = useMemo(() => ({
    limit: PAGE_SIZE,
    skip,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    types,
    sources,
  }), [skip, dateFrom, dateTo, types, sources]);

  function setQuery(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`?${next.toString()}`);
  }

  function toggleArr(setter: "types" | "sources", v: string) {
    const cur = (setter === "types" ? types : sources) as string[];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    setQuery({ [setter]: next.length ? next.join(",") : undefined, skip: "0" });
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getLedger(filters)
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setTotal(r.total);
        setTotalIn(r.totalIn);
        setTotalOut(r.totalOut);
      })
      .catch((e) => toast.error(e?.message ?? "Failed to load ledger"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [filters]);

  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      const url = await fetchLedgerCsv(filters);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wallet-ledger-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <Link
        href="/garage-admin/wallets"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5a5a72] hover:text-[#c7c7da] mb-4 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to wallets
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#FBD10D]/5 border border-[#FBD10D]/15 flex items-center justify-center shrink-0">
            <ListOrdered className="h-5 w-5 text-[#FBD10D]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">Ledger</h1>
            <p className="text-sm text-[#9fa0b8] mt-1.5">
              Every transaction across every wallet, filterable + exportable.
            </p>
          </div>
        </div>
        <Button
          onClick={exportCsv}
          disabled={exporting}
          className="h-9 bg-[#FBD10D] text-black font-bold hover:bg-[#e8c00c] active:scale-[0.98] rounded-xl shadow-lg shadow-[#FBD10D]/10 shrink-0 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Export CSV
        </Button>
      </div>

      <div className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-4 mb-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5">Date range</p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setQuery({ dateFrom: e.target.value, skip: "0" })}
                className="h-9 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
              />
              <span className="text-[#5a5a72]">→</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setQuery({ dateTo: e.target.value, skip: "0" })}
                className="h-9 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5">Types</p>
              <div className="flex gap-1.5 flex-wrap">
                {ALL_TYPES.map((t) => (
                  <FilterChip key={t} label={t.replace("_", " ")} active={!!types?.includes(t)} onClick={() => toggleArr("types", t)} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5">Sources</p>
              <div className="flex gap-1.5 flex-wrap">
                {ALL_SOURCES.map((s) => (
                  <FilterChip key={s} label={s} active={!!sources?.includes(s)} onClick={() => toggleArr("sources", s)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-[#9fa0b8]">
        <span><span className="text-[#5a5a72]">Showing</span> <span className="font-bold text-white">{total}</span> transactions</span>
        <span className="text-[#2a2a35]">·</span>
        <span><span className="text-[#5a5a72]">In</span> <span className="font-mono text-green-400">{fmtCents(totalIn)}</span></span>
        <span className="text-[#2a2a35]">·</span>
        <span><span className="text-[#5a5a72]">Out</span> <span className="font-mono text-red-400">{fmtCents(totalOut)}</span></span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-3.5 shadow-xl">
              <div className="h-4 w-48 bg-[#1a1a22] rounded animate-pulse mb-2" />
              <div className="h-3 w-72 bg-[#1a1a22] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-[#2a2a35] rounded-2xl py-20 flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[#0d0d11] border border-[#2a2a35] flex items-center justify-center">
            <ListOrdered className="h-6 w-6 text-[#5a5a72]" />
          </div>
          <p className="text-sm font-bold text-[#c7c7da]">No transactions match these filters</p>
          <p className="text-xs text-[#5a5a72]">Try widening the date range or adding more types/sources.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {items.map((t) => {
            const p = TYPE_PALETTE[t.type] ?? TYPE_PALETTE.credit;
            const Icon = p.icon;
            const sign = t.type === "credit" ? "+" : "-";
            return (
              <div
                key={t._id}
                className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-3.5 shadow-xl flex items-start gap-3 hover:border-[#3a3a4a] transition-colors"
              >
                <div className={`h-9 w-9 rounded-xl ${p.bg} border ${p.border} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 ${p.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {t.orgDeleted ? (
                      <span
                        className="text-sm font-bold text-[#5a5a72] truncate inline-flex items-center gap-1 line-through decoration-[#2a2a35]"
                        title="The organization for this transaction has been deleted. The audit row is preserved."
                      >
                        <Building2 className="h-3.5 w-3.5 text-[#3a3a4a]" /> {t.orgName}
                      </span>
                    ) : (
                      <Link
                        href={`/garage-admin/wallets/${t.orgId}`}
                        className="text-sm font-bold text-white hover:text-[#FBD10D] truncate transition-colors inline-flex items-center gap-1"
                      >
                        <Building2 className="h-3.5 w-3.5 text-[#5a5a72]" /> {t.orgName}
                      </Link>
                    )}
                    {t.orgDeleted && (
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md border bg-[#1a1a22] border-[#2c2c3a] text-[#5a5a72]">
                        deleted
                      </span>
                    )}
                    <span className={`text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md border ${SOURCE_PALETTE[t.source] ?? SOURCE_PALETTE.system}`}>
                      {t.source}
                    </span>
                  </div>
                  <p className="text-xs text-[#9fa0b8] mt-1 leading-snug truncate">{t.note ?? t.description}</p>
                  <p className="text-[10px] text-[#5a5a72] mt-1">
                    {fmtDate(t.createdAt)}{t.adminEmail ? ` · ${t.adminEmail}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-mono font-black text-sm ${t.type === "credit" ? "text-green-400" : "text-red-400"}`}>
                    {sign}{fmtCents(t.amount)}
                  </p>
                  <p className="text-[10px] text-[#5a5a72] font-mono mt-0.5 capitalize">{t.type.replace("_", " ")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 text-xs text-[#5a5a72]">
        <span>{total === 0 ? 0 : skip + 1}–{Math.min(skip + items.length, total)} of {total}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={skip === 0}
            onClick={() => setQuery({ skip: String(Math.max(0, skip - PAGE_SIZE)) })}
            className="h-8 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40"
          >Prev</Button>
          <Button
            size="sm"
            variant="outline"
            disabled={skip + items.length >= total}
            onClick={() => setQuery({ skip: String(skip + PAGE_SIZE) })}
            className="h-8 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40"
          >Next</Button>
        </div>
      </div>
    </div>
  );
}
