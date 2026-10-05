"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Loader2, Plus, Minus, Eraser, Building2, Wallet,
  ArrowUpRight, ArrowDownLeft, Eraser as EraserIcon, Download,
} from "lucide-react";
import { toast } from "sonner";
import { WalletActionDialog } from "@/components/admin/wallets/WalletActionDialogs";
import {
  getOrgWallet,
  getOrgWalletTransactions,
  type OrgWalletDetail,
  type WalletTransaction,
} from "@/lib/admin-api/wallets";
import { exportRowsAsCsv } from "@/lib/csvExport";

const PAGE_SIZE = 50;

function fmtCents(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

const TYPE_PALETTE: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  credit:     { bg: "bg-green-500/10",  border: "border-green-500/25",  text: "text-green-400",  icon: ArrowUpRight },
  debit:      { bg: "bg-red-500/10",    border: "border-red-500/25",    text: "text-red-400",    icon: ArrowDownLeft },
  clear_debt: { bg: "bg-orange-500/10", border: "border-orange-500/25", text: "text-orange-400", icon: EraserIcon },
};

const SOURCE_PALETTE: Record<string, string> = {
  user:   "bg-blue-500/10 border-blue-500/25 text-blue-400",
  admin:  "bg-[#FBD10D]/10 border-[#FBD10D]/25 text-[#FBD10D]",
  system: "bg-[#1a1a22] border-[#2c2c3a] text-[#9fa0b8]",
};

export default function OrgWalletDetailPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [data, setData] = useState<OrgWalletDetail | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"credit" | "debit" | "clear-debt" | null>(null);

  async function refetch() {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([
        getOrgWallet(orgId),
        getOrgWalletTransactions(orgId, { limit: PAGE_SIZE, skip }),
      ]);
      setData(d);
      setTxns(t.items);
      setTotal(t.total);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refetch(); /* eslint-disable-next-line */ }, [orgId, skip]);

  if (loading && !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-6 shadow-xl flex justify-center">
          <Loader2 className="h-6 w-6 text-[#FBD10D] animate-spin" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { org, wallet } = data;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Link
        href="/garage-admin/wallets"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5a5a72] hover:text-[#c7c7da] mb-4 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to wallets
      </Link>

      {/* Header card */}
      <div className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-5 shadow-xl mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-12 w-12 rounded-xl bg-[#FBD10D]/5 border border-[#FBD10D]/15 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-[#FBD10D]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">{org.name}</h1>
            <p className="text-xs text-[#9fa0b8] mt-1 truncate">
              {org.slug}{org.founderEmail ? ` · ${org.founderEmail}` : ""}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1">Balance</p>
          <p className="text-3xl font-black text-white font-mono leading-none">{fmtCents(wallet.balance)}</p>
          {wallet.debt > 0 && (
            <p className="text-xs text-red-400 font-mono mt-1.5">debt {fmtCents(wallet.debt)}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          onClick={() => setMode("credit")}
          className="h-9 bg-[#FBD10D] text-black font-bold hover:bg-[#e8c00c] active:scale-[0.98] rounded-xl shadow-lg shadow-[#FBD10D]/10"
        >
          <Plus className="h-4 w-4 mr-2" /> Add credits
        </Button>
        <Button
          variant="outline"
          onClick={() => setMode("debit")}
          className="h-9 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-xl"
        >
          <Minus className="h-4 w-4 mr-2" /> Deduct credits
        </Button>
        <Button
          variant="outline"
          disabled={wallet.debt === 0}
          onClick={() => setMode("clear-debt")}
          className="h-9 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-xl disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Eraser className="h-4 w-4 mr-2" /> Clear debt
        </Button>
      </div>

      {/* Transaction history */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72]">Transaction history</p>
        <div className="flex items-center gap-3">
          {/* Export the CURRENT PAGE of transactions to CSV. Reusable
              client-side helper — for a full-history export across all pages
              admins should still go via the global ledger which has a BE
              streamed endpoint. */}
          <Button
            size="sm"
            variant="outline"
            disabled={txns.length === 0}
            onClick={() => {
              const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const count = exportRowsAsCsv(
                txns,
                [
                  { header: "Date (UTC)", accessor: (t) => t.createdAt },
                  { header: "Type", accessor: (t) => t.type },
                  { header: "Source", accessor: (t) => t.source },
                  {
                    // Signed amount in USD, matching the +/- shown in the
                    // list. Credits positive, debits/clear_debt negative.
                    // Sum this column for net wallet movement.
                    header: "Amount (USD)",
                    accessor: (t) => {
                      const usd = t.amount / 100;
                      return t.type === "credit"
                        ? usd.toFixed(2)
                        : (-usd).toFixed(2);
                    },
                  },
                  { header: "Balance after (USD)", accessor: (t) => (t.balanceAfter / 100).toFixed(2) },
                  { header: "Debt after (USD)", accessor: (t) => (t.debtAfter / 100).toFixed(2) },
                  { header: "Admin email", accessor: (t) => t.adminEmail || "" },
                  { header: "Description", accessor: (t) => t.description || "" },
                  { header: "Note", accessor: (t) => t.note || "" },
                ],
                `org-wallet-${orgId}-${skip}-${skip + txns.length}-${ts}.csv`
              );
              toast.success(`Exported ${count} transaction${count === 1 ? "" : "s"}`);
            }}
            className="h-7 px-2 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40"
          >
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
          <p className="text-[10px] text-[#5a5a72]">{total} total</p>
        </div>
      </div>

      {txns.length === 0 ? (
        <div className="border border-dashed border-[#2a2a35] rounded-2xl py-16 flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[#0d0d11] border border-[#2a2a35] flex items-center justify-center">
            <Wallet className="h-6 w-6 text-[#5a5a72]" />
          </div>
          <p className="text-sm font-bold text-[#c7c7da]">No transactions yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {txns.map((t) => {
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
                    <span className="text-sm font-bold text-white capitalize">{t.type.replace("_", " ")}</span>
                    <span className={`text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md border ${SOURCE_PALETTE[t.source] ?? SOURCE_PALETTE.system}`}>
                      {t.source}
                    </span>
                  </div>
                  <p className="text-xs text-[#9fa0b8] mt-1 leading-snug">{t.description}</p>
                  {t.note && <p className="text-xs italic text-[#5a5a72] mt-0.5">&quot;{t.note}&quot;</p>}
                  <p className="text-[10px] text-[#5a5a72] mt-1.5">
                    {fmtDate(t.createdAt)}{t.adminEmail ? ` · ${t.adminEmail}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-mono font-black text-sm ${t.type === "credit" ? "text-green-400" : "text-red-400"}`}>
                    {sign}{fmtCents(t.amount)}
                  </p>
                  <p className="text-[10px] text-[#5a5a72] font-mono mt-0.5">bal {fmtCents(t.balanceAfter)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 text-xs text-[#5a5a72]">
        <span>{total === 0 ? 0 : skip + 1}–{Math.min(skip + txns.length, total)} of {total}</span>
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
            disabled={skip + txns.length >= total}
            onClick={() => setSkip(skip + PAGE_SIZE)}
            className="h-8 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40"
          >Next</Button>
        </div>
      </div>

      <WalletActionDialog
        mode={mode}
        onClose={() => setMode(null)}
        onSuccess={refetch}
        orgId={orgId}
        orgName={org.name}
        currentBalance={wallet.balance}
        currentDebt={wallet.debt}
      />
    </div>
  );
}
