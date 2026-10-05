"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, ArrowUpRight, Landmark, Coins, Loader2, Clock, CheckCircle2,
  XCircle, Upload, X, FileText, Wallet, ListChecks, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { WithdrawalPreferencesTab } from "@/components/garage-admin/WithdrawalPreferencesTab";
import {
  listWithdrawals, getWithdrawalStats, completeWithdrawal, rejectWithdrawal,
  type AdminWithdrawal, type WithdrawalStats,
} from "@/lib/admin-api/withdrawals";

const PAGE_SIZE = 30;
const STATUSES = ["initiated", "completed", "rejected", "all"] as const;
const NETWORK_LABELS: Record<string, string> = {
  ethereum: "Ethereum", tron: "Tron", bitcoin: "Bitcoin",
  solana: "Solana", bsc: "BNB Chain", polygon: "Polygon",
};

// Block-explorer URLs per network. Used to turn a bare tx-hash paste
// into a clickable link stored on `Withdrawal.receiptUrl`, which the
// user's "withdrawal completed" email already renders as a
// "View transfer receipt →" button.
const EXPLORER_TX_URL: Record<string, (hash: string) => string> = {
  ethereum: (h) => `https://etherscan.io/tx/${h}`,
  bsc:      (h) => `https://bscscan.com/tx/${h}`,
  polygon:  (h) => `https://polygonscan.com/tx/${h}`,
  tron:     (h) => `https://tronscan.org/#/transaction/${h}`,
  bitcoin:  (h) => `https://mempool.space/tx/${h}`,
  solana:   (h) => `https://solscan.io/tx/${h}`,
};

/** Accept either a bare hash or a full URL. Bare hash → wrap in the
 *  network's block-explorer URL. Anything already starting with http(s)
 *  passes through unchanged. Whitespace trimmed. */
function normalizeReceiptFromHashOrUrl(input: string, network: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const builder = EXPLORER_TX_URL[network];
  return builder ? builder(raw) : raw; // unknown network → store as-is
}

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
function accountLine(w: AdminWithdrawal): string {
  if (w.account.type === "bank") {
    const tail = w.account.accountNumber ? `••••${w.account.accountNumber.slice(-4)}` : "";
    return `${w.account.bankName || "Bank"}${tail ? ` · ${tail}` : ""}`;
  }
  const net = NETWORK_LABELS[w.account.cryptoNetwork] || w.account.cryptoNetwork;
  const tail = w.account.cryptoAddress ? `${w.account.cryptoAddress.slice(0, 6)}…${w.account.cryptoAddress.slice(-4)}` : "";
  return `${net}${tail ? ` · ${tail}` : ""}`;
}

function StatusPill({ status }: { status: string }) {
  const cfg =
    status === "completed"
      ? { c: "bg-green-500/10 text-green-400 border-green-500/20", label: "Completed" }
      : status === "rejected"
      ? { c: "bg-red-500/10 text-red-400 border-red-500/20", label: "Rejected" }
      : { c: "bg-[#FBD10D]/10 text-[#FBD10D] border-[#FBD10D]/20", label: "Initiated" };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.c}`}>{cfg.label}</span>;
}

function StatCard({ label, value, icon: Icon, accent }: {
  label: string; value: string; icon: any; accent: "yellow" | "green" | "red";
}) {
  const p = {
    yellow: "bg-[#FBD10D]/5 border-[#FBD10D]/15 text-[#FBD10D]",
    green: "bg-green-500/5 border-green-500/15 text-green-400",
    red: "bg-red-500/5 border-red-500/15 text-red-400",
  }[accent];
  return (
    <div className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-4 shadow-xl">
      <div className={`h-11 w-11 rounded-xl border flex items-center justify-center mb-3 ${p}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1">{label}</p>
      <p className="text-2xl font-black text-white leading-none">{value}</p>
    </div>
  );
}

const TABS = [
  { id: "queue", label: "Queue", icon: ListChecks },
  { id: "preferences", label: "Preferences", icon: CalendarClock },
] as const;

export default function WithdrawalsQueuePage() {
  // Sub-tab: the withdrawal queue (unchanged) or the standing payout
  // preferences users set on their wallets.
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("queue");
  const [items, setItems] = useState<AdminWithdrawal[]>([]);
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("initiated");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);

  // Action modal
  const [acting, setActing] = useState<{ w: AdminWithdrawal; mode: "complete" | "reject" } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setSkip(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Shared header search — filters this queue server-side (debounced). Feeds
  // the same ?search= param (requester name/email) as the toolbar box; the
  // toolbar wins when both are set.
  const { query: headerSearch } = useAdminSearch();
  const [debouncedHeader, setDebouncedHeader] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedHeader(headerSearch.trim()); setSkip(0); }, 350);
    return () => clearTimeout(t);
  }, [headerSearch]);

  const effectiveSearch = debounced || debouncedHeader;

  const params = useMemo(
    () => ({ status, search: effectiveSearch || undefined, skip, limit: PAGE_SIZE }),
    [status, effectiveSearch, skip]
  );

  const reload = () => {
    setLoading(true);
    Promise.all([listWithdrawals(params), getWithdrawalStats()])
      .then(([list, s]) => { setItems(list.items); setTotal(list.total); setStats(s); })
      .catch((e) => toast.error(e?.message ?? "Failed to load withdrawals"))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [params]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#FBD10D]/15 to-[#FBD10D]/[0.02] border border-[#FBD10D]/15 flex items-center justify-center shrink-0">
          <ArrowUpRight className="h-5 w-5 text-[#FBD10D]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none">Withdrawals</h1>
          <p className="text-sm text-[#9fa0b8] mt-1.5">
            {tab === "queue"
              ? "Review pending initiations, attach receipts, complete or reject."
              : "What users asked for — weekly every Friday or daily, and how much to leave in the wallet. Pay out from the Queue."}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="inline-flex items-center gap-1 rounded-xl border border-[#2a2a35] bg-[#0d0d11] p-1 mb-5" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors ${
                on ? "bg-[#FBD10D]/10 text-[#FBD10D]" : "text-[#9fa0b8] hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "preferences" && <WithdrawalPreferencesTab headerSearch={debouncedHeader} />}

      {tab === "queue" && (<>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Pending" value={stats ? String(stats.pending) : "—"} icon={Clock} accent="yellow" />
        <StatCard label="Pending amount" value={stats ? fmt(stats.pendingAmount) : "—"} icon={Wallet} accent="yellow" />
        <StatCard label="Completed" value={stats ? String(stats.completed) : "—"} icon={CheckCircle2} accent="green" />
        <StatCard label="Rejected" value={stats ? String(stats.rejected) : "—"} icon={XCircle} accent="red" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a5a72]" />
          <Input
            placeholder="Search by user name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-[#0d0d11] border-[#2c2c3a] text-white placeholder:text-[#5a5a72] rounded-xl focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setSkip(0); }}
              className={`h-9 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                status === s
                  ? "bg-[#FBD10D]/10 border border-[#FBD10D]/30 text-[#FBD10D]"
                  : "bg-[#0d0d11] border border-[#2c2c3a] text-[#9fa0b8] hover:text-white hover:border-[#363649]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      {loading ? (
        <div className="grid grid-cols-1 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-[#2a2a35] rounded-2xl py-20 flex flex-col items-center gap-3">
          <ArrowUpRight className="h-6 w-6 text-[#5a5a72]" />
          <p className="text-sm font-bold text-[#c7c7da]">No {status === "all" ? "" : status} withdrawals</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {items.map((w) => (
            <div key={w.id} className="bg-gradient-to-b from-[#13131a] to-[#0f0f14] border border-[#2a2a35] rounded-2xl p-4">
              <div className="flex items-center gap-3">
                {w.user.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.user.profilePicture} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0 ring-1 ring-[#2a2a35]" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-[#FBD10D]/5 border border-[#FBD10D]/10 flex items-center justify-center shrink-0 text-sm font-black text-[#FBD10D]">
                    {(w.user.name || w.user.email || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white truncate">{w.user.name || w.user.email || "User"}</p>
                    <StatusPill status={w.status} />
                  </div>
                  <p className="text-[11px] text-[#5a5a72] truncate mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>
                      {w.walletLabel}
                      {w.orgName ? ` · ${w.orgName}` : ""}
                    </span>
                    <span className="text-[#2a2a35]">·</span>
                    {w.account.type === "bank" ? <Landmark className="h-3 w-3" /> : <Coins className="h-3 w-3" />}
                    <span>{accountLine(w)}</span>
                    <span className="text-[#2a2a35]">·</span>
                    <span>{fmtRelative(w.createdAt)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-base font-black text-white leading-none">{fmt(w.grossAmount)}</p>
                  <p className="text-[10px] text-[#5a5a72] mt-1 font-mono">
                    net {fmt(w.netAmount)} · fee {fmt(w.feeAmount)}
                    {w.feePercent ? ` (${w.feePercent}%)` : ""}
                    {w.bankTransferFee > 0 ? ` · bank ${fmt(w.bankTransferFee)}` : ""}
                    {w.taxTotal > 0 ? ` · taxes ${fmt(w.taxTotal)}` : ""}
                  </p>
                </div>
              </div>

              {(w.status === "initiated" || w.receiptUrl || w.rejectionReason) && (
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#2a2a35]/70">
                  <div className="text-[11px] text-[#5a5a72] min-w-0 truncate">
                    {w.status === "rejected" && w.rejectionReason && <span>Reason: {w.rejectionReason}</span>}
                    {w.status === "completed" && w.receiptUrl && (
                      <a href={w.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#FBD10D]/80 hover:text-[#FBD10D]">
                        <FileText className="h-3 w-3" /> View receipt
                      </a>
                    )}
                  </div>
                  {w.status === "initiated" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setActing({ w, mode: "reject" })}
                        className="h-8 px-3 rounded-lg border border-red-500/30 text-red-400 text-[11px] font-bold hover:bg-red-500/10 transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setActing({ w, mode: "complete" })}
                        className="h-8 px-3 rounded-lg bg-[#FBD10D] text-black text-[11px] font-bold hover:bg-[#e6c00d] transition-colors"
                      >
                        Complete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && items.length > 0 && (
        <div className="flex items-center justify-between mt-5 text-xs text-[#5a5a72]">
          <span>{skip + 1}–{Math.min(skip + items.length, total)} of {total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              className="h-8 border-[#2a2a35] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40">Prev</Button>
            <Button size="sm" variant="outline" disabled={skip + items.length >= total}
              onClick={() => setSkip(skip + PAGE_SIZE)}
              className="h-8 border-[#2a2a35] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-lg disabled:opacity-40">Next</Button>
          </div>
        </div>
      )}

      {acting && (
        <ActionDialog
          withdrawal={acting.w}
          mode={acting.mode}
          onClose={() => setActing(null)}
          onDone={() => { setActing(null); reload(); }}
        />
      )}
      </>)}
    </div>
  );
}

function ActionDialog({
  withdrawal, mode, onClose, onDone,
}: {
  withdrawal: AdminWithdrawal;
  mode: "complete" | "reject";
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [txHashInput, setTxHashInput] = useState(""); // crypto only
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isCrypto = withdrawal.account.type === "crypto";
  const cryptoNetwork = isCrypto
    ? (withdrawal.account.cryptoNetwork || "").toLowerCase()
    : "";

  async function uploadReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("garage_admin_token");
      const res = await fetch(`${API_URL}/garage-admin/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        // Surface the server's actual error (e.g. "file type not allowed")
        // instead of a generic message — saved many bug reports already.
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      setReceiptUrl(data.url);
      toast.success("Receipt uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload receipt");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      if (mode === "complete") {
        // Crypto: pass the normalized tx-hash → explorer URL. Bank:
        // pass the uploaded file URL. Same `receiptUrl` field on both.
        const receipt = isCrypto
          ? normalizeReceiptFromHashOrUrl(txHashInput, cryptoNetwork)
          : receiptUrl;
        await completeWithdrawal(withdrawal.id, receipt || undefined);
        toast.success("Withdrawal completed");
      } else {
        await rejectWithdrawal(withdrawal.id, reason || undefined);
        toast.success("Withdrawal rejected · refunded");
      }
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  const isComplete = mode === "complete";
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#111116] border-[#2a2a35] text-white rounded-2xl shadow-2xl max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${isComplete ? "bg-[#FBD10D]/10 border-[#FBD10D]/25" : "bg-red-500/10 border-red-500/25"}`}>
              {isComplete ? <CheckCircle2 className="h-5 w-5 text-[#FBD10D]" /> : <XCircle className="h-5 w-5 text-red-400" />}
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">
              {isComplete ? "Complete withdrawal" : "Reject withdrawal"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Body scrolls; the header and the Complete/Reject buttons stay put
            so they are reachable however long the detail runs. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1 space-y-3 py-1">
          <div className="bg-[#0d0d11] border border-[#2a2a35] rounded-xl p-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-[#9fa0b8]">User</span><span className="text-white truncate ml-2">{withdrawal.user.name || withdrawal.user.email}</span></div>
            <div className="flex items-center justify-between mt-1"><span className="text-[#9fa0b8]">Wallet</span><span className="text-white truncate ml-2">{withdrawal.walletLabel}{withdrawal.orgName ? ` · ${withdrawal.orgName}` : ""}</span></div>
            <div className="flex items-center justify-between mt-1"><span className="text-[#9fa0b8]">Withdrawal amount</span><span className="font-mono text-white">{fmt(withdrawal.grossAmount)}</span></div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[#9fa0b8]">Garage processing fee ({withdrawal.feePercent}%)</span>
              <span className="font-mono text-[#c7c7da]">{withdrawal.feeAmount > 0 ? `−${fmt(withdrawal.feeAmount)}` : "—"}</span>
            </div>
            {/* Why that rate: the member's own schedule choice, spelled out
                rather than compressed into a hint. Affiliate only. */}
            {withdrawal.feeTier && (
              <div className="mt-1 rounded-lg bg-[#101015] border border-[#22222c] px-2.5 py-2 space-y-1">
                {withdrawal.feeTier.configured ? (
                  <>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#5a5a72]">Payout frequency</span>
                      <span className="text-[#c7c7da]">
                        {withdrawal.feeTier.frequency === "daily" ? "Daily" : "Weekly"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#5a5a72]">Keeps in wallet</span>
                      <span className="font-mono text-[#c7c7da]">
                        {withdrawal.feeTier.keepAmountCents
                          ? fmt(withdrawal.feeTier.keepAmountCents)
                          : "nothing"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#5a5a72]">Meets the $50 buffer</span>
                      <span className={withdrawal.feeTier.meetsKeepThreshold ? "text-emerald-400" : "text-[#c7c7da]"}>
                        {withdrawal.feeTier.meetsKeepThreshold ? "Yes" : "No"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-[#5a5a72]">
                    No preference saved — default rate applied
                  </div>
                )}
              </div>
            )}
            {withdrawal.bankTransferFee > 0 && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-[#9fa0b8]">Bank transfer fee <span className="text-[#5a5a72]">(charged by the bank)</span></span>
                <span className="font-mono text-[#c7c7da]">−{fmt(withdrawal.bankTransferFee)}</span>
              </div>
            )}
            {withdrawal.taxes.map((t, i) => (
              <div key={i} className="flex items-center justify-between mt-1"><span className="text-[#9fa0b8] truncate ml-0 mr-2">{t.label}</span><span className="font-mono text-[#c7c7da]">−{fmt(t.amount)}</span></div>
            ))}
            <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-[#2a2a35]"><span className="text-white font-semibold">Net payout</span><span className="font-mono text-[#FBD10D] font-bold">{fmt(withdrawal.netAmount)}</span></div>
            {/* What Garage actually keeps — the bank's cut is not ours. */}
            <div className="flex items-center justify-between mt-1">
              <span className="text-[#5a5a72] text-[11px]">Garage keeps (fee + taxes)</span>
              <span className="font-mono text-[11px] text-[#9fa0b8]">{fmt(withdrawal.platformRetains)}</span>
            </div>
            <div className="flex items-center justify-between mt-1"><span className="text-[#9fa0b8]">To</span><span className="text-white truncate ml-2">{accountLine(withdrawal)}</span></div>
          </div>

          {/* A super admin departed from the rules when this was initiated.
              Whoever completes it is releasing that money, so the exception
              is shown here too rather than only at initiate time. */}
          {withdrawal.adminOverride && (
            <div className="rounded-xl border border-[#FBD10D]/30 bg-[#FBD10D]/[0.06] p-3 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#FBD10D]/80">
                Initiated with an override
              </p>
              {withdrawal.adminOverride.releasedCents ? (
                <div className="flex items-start justify-between gap-3 text-[11px]">
                  <span className="text-[#e4d8a8]">
                    Released beyond the withdrawable cap of{" "}
                    <span className="font-mono">{fmt(withdrawal.adminOverride.gatedCapCents || 0)}</span>
                  </span>
                  <span className="font-mono text-[#FBD10D] shrink-0">
                    +{fmt(withdrawal.adminOverride.releasedCents)}
                  </span>
                </div>
              ) : null}
              {withdrawal.adminOverride.appliedFeePercent != null && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#e4d8a8]">Fee charged</span>
                  <span className="font-mono text-[#FBD10D]">
                    {withdrawal.adminOverride.appliedFeePercent}% instead of{" "}
                    {withdrawal.adminOverride.tierFeePercent}%
                  </span>
                </div>
              )}
              {withdrawal.adminOverride.reason && (
                <p className="text-[11px] leading-snug text-[#b9ac7e] pt-0.5">
                  “{withdrawal.adminOverride.reason}”
                </p>
              )}
            </div>
          )}

          {isComplete ? (
            isCrypto ? (
              // Crypto payouts: paste the on-chain transaction hash (or a
              // full explorer URL). Stored on `Withdrawal.receiptUrl` as a
              // clickable block-explorer link — the "withdrawal completed"
              // email already renders that field as a "View transfer
              // receipt →" button, so users get a one-click link to verify
              // the on-chain settlement.
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5 block">
                  Transaction hash (optional)
                </label>
                <Input
                  value={txHashInput}
                  onChange={(e) => setTxHashInput(e.target.value)}
                  placeholder={
                    cryptoNetwork === "bitcoin"
                      ? "e.g. a1b2…c3d4 (txid) or full explorer URL"
                      : cryptoNetwork === "tron"
                      ? "e.g. a1b2…c3d4 (TxID) or full explorer URL"
                      : "e.g. 0xabc…def or full explorer URL"
                  }
                  className="h-10 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl font-mono text-[13px] focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
                />
                {txHashInput.trim() && (
                  <p className="text-[10.5px] text-[#5a5a72] mt-1.5 break-all">
                    Will store as:{" "}
                    <span className="text-[#c7c7da]">
                      {normalizeReceiptFromHashOrUrl(txHashInput, cryptoNetwork)}
                    </span>
                  </p>
                )}
                {!txHashInput.trim() && (
                  <p className="text-[10.5px] text-[#5a5a72] mt-1.5">
                    Paste a bare hash — we&apos;ll wrap it with the{" "}
                    {NETWORK_LABELS[cryptoNetwork] || cryptoNetwork || "chain"}
                    &apos;s block explorer.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5 block">Receipt (optional)</label>
                {receiptUrl ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0d0d11] border border-[#2a2a35]">
                    <FileText className="h-4 w-4 text-[#FBD10D] shrink-0" />
                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-[#c7c7da] truncate flex-1 hover:text-white">Uploaded receipt</a>
                    <button onClick={() => setReceiptUrl("")} className="text-[#5a5a72] hover:text-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-10 rounded-xl border border-dashed border-[#2a2a35] bg-[#0d0d11] text-[#9fa0b8] hover:border-[#FBD10D]/30 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading…" : "Upload receipt"}
                  </button>
                )}
                <p className="text-[10.5px] text-[#5a5a72] mt-1.5">PNG, JPG, WebP, or PDF · max 10 MB</p>
                {/* Bank-transfer receipts are usually PDFs, so PDF is allowed
                    alongside images. Matches the backend fileFilter in
                    src/routes/garageAdmin.ts. */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                  className="hidden"
                  onChange={uploadReceipt}
                />
              </div>
            )
          ) : (
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5 block">Reason (optional)</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. invalid account details"
                className="h-10 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
              />
              <p className="text-[11px] text-[#5a5a72] mt-1.5">The full {fmt(withdrawal.grossAmount)} will be refunded to the user's wallet.</p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-[#22222c] pt-3 mt-1">
          <Button variant="outline" onClick={onClose} disabled={submitting || uploading}
            className="h-9 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting || uploading}
            className={`h-9 font-bold rounded-xl shadow-lg disabled:opacity-50 ${isComplete ? "bg-[#FBD10D] text-black hover:bg-[#e8c00c] shadow-[#FBD10D]/10" : "bg-red-500 text-white hover:bg-red-600 shadow-red-500/10"}`}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Working…</> : isComplete ? "Complete" : "Reject & refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
