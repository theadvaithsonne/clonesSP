"use client";

/**
 * Garage Admin → Sweeper tab.
 *
 * Every settled-but-unswept HD-derived crypto deposit across BSC /
 * Polygon / Ethereum / Bitcoin / Tron, plus a full history of every
 * completed sweep. Backed by three endpoints on the crypto backend:
 *   GET /garage-admin/sweeper/summary   — top-of-page totals
 *   GET /garage-admin/sweeper/pending   — unswept rows (with USD)
 *   GET /garage-admin/sweeper/history   — completed sweeps (with USD)
 *   GET /garage-admin/sweeper/gas-status— per-chain gas-float health
 *   POST /garage-admin/sweeper/run      — trigger a sweep
 *
 * Detection is automatic on the backend — this page only exposes the
 * consolidation step + a verifiable audit trail.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Fuel,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Check as CheckIcon,
  Wallet,
  TrendingUp,
  History as HistoryIcon,
  Clock,
} from "lucide-react";
import {
  listPendingSweeps,
  listSweepHistory,
  getSweeperGasStatus,
  getSweeperSummary,
  runSweeper,
  recoverSweeperGas,
  type SweeperPendingRow,
  type SweeperHistoryRow,
  type SweeperGasStatus,
  type SweeperChain,
  type SweeperRunResult,
  type SweeperSummary,
} from "@/lib/admin-api/sweeper";

// ───────── chain metadata ─────────

type ChainKey = SweeperChain;

const CHAIN_ORDER: ChainKey[] = [
  "bsc",
  "polygon",
  "ethereum",
  "bitcoin",
  "tron",
];

const CHAIN_LABELS: Record<ChainKey, string> = {
  bsc: "BNB Chain",
  polygon: "Polygon",
  ethereum: "Ethereum",
  bitcoin: "Bitcoin",
  tron: "Tron",
};

// Muted chain dot colors — align with the rest of the admin UI's
// restrained palette. Not exact brand colours; picked to be
// distinguishable at a glance without shouting.
const CHAIN_DOT: Record<ChainKey, string> = {
  bsc: "bg-yellow-400",
  polygon: "bg-purple-400",
  ethereum: "bg-blue-400",
  bitcoin: "bg-orange-400",
  tron: "bg-red-400",
};

const EXPLORER_ADDRESS: Record<ChainKey, string> = {
  bsc: "https://bscscan.com/address/",
  polygon: "https://polygonscan.com/address/",
  ethereum: "https://etherscan.io/address/",
  bitcoin: "https://mempool.space/address/",
  tron: "https://tronscan.org/#/address/",
};
const EXPLORER_TX: Record<ChainKey, string> = {
  bsc: "https://bscscan.com/tx/",
  polygon: "https://polygonscan.com/tx/",
  ethereum: "https://etherscan.io/tx/",
  bitcoin: "https://mempool.space/tx/",
  tron: "https://tronscan.org/#/transaction/",
};

// ───────── helpers ─────────

function fromAtomic(atomicStr: string, decimals: number): number {
  if (!atomicStr) return 0;
  try {
    const big = BigInt(atomicStr);
    return Number(big) / 10 ** decimals;
  } catch {
    return 0;
  }
}

function formatCoinAmount(amount: number, coin: string): string {
  // BTC / ETH: 6 decimals; USDT / USDC: 2; native gas: 4-6 depending
  // on how small it is. Keeps columns visually aligned.
  if (coin === "BTC" || coin === "ETH") return amount.toFixed(6);
  if (coin === "USDT" || coin === "USDC") return amount.toFixed(2);
  if (amount === 0) return "0";
  if (amount < 0.0001) return amount.toExponential(2);
  if (amount < 1) return amount.toFixed(6);
  return amount.toFixed(4);
}

function formatUsd(n: number): string {
  if (!n || n < 0) return "—";
  if (n < 0.01) return "< $0.01";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function truncateMid(s: string, headLen = 8, tailLen = 6): string {
  if (!s) return "";
  if (s.length <= headLen + tailLen + 3) return s;
  return `${s.slice(0, headLen)}…${s.slice(-tailLen)}`;
}

function timeAgo(input: string | Date | null): string {
  if (!input) return "—";
  const then = typeof input === "string" ? new Date(input) : input;
  const ms = Date.now() - then.getTime();
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function fullTimestamp(input: string | Date | null): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  return d
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}

/** Compact absolute stamp for the timeline rows: "24 Sep 08:06". */
function shortStamp(input: string | Date | null): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

/** Humanise a duration in ms: "1m 16s", "15m", "5h 4m", "3d". */
function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 0) return "0s";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return remSec ? `${min}m ${remSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  if (hr < 24) return remMin ? `${hr}h ${remMin}m` : `${hr}h`;
  const day = Math.floor(hr / 24);
  const remHr = hr % 24;
  return remHr ? `${day}d ${remHr}h` : `${day}d`;
}

/**
 * Per-row lifecycle timeline.
 *
 * Shows every timestamp in the deposit's life as absolute UTC stamps
 * instead of a single relative "5d ago" on one field. The gap between
 * "Paid" (block time of the incoming transfer) and "Detected" (when we
 * settled it) is the detection lag — the thing that caused the
 * Sep-2026 incidents and was previously impossible to see from the UI.
 *
 * A lag over 5 minutes is highlighted amber so slow detection is
 * obvious at a glance rather than something you have to compute.
 */
function EventTimeline({
  createdAt,
  fundsReceivedAt,
  matchedAt,
  sweptAt,
  detectionLagMs,
  compact = false,
}: {
  createdAt?: string | Date | null;
  fundsReceivedAt?: string | Date | null;
  matchedAt?: string | Date | null;
  sweptAt?: string | Date | null;
  detectionLagMs?: number | null;
  compact?: boolean;
}) {
  const laggy = detectionLagMs !== null && (detectionLagMs ?? 0) > 5 * 60_000;
  const steps: Array<{
    label: string;
    at: string | Date | null | undefined;
    hint?: string;
    warn?: boolean;
  }> = [
    { label: "Created", at: createdAt, hint: "Deposit address minted" },
    {
      label: "Paid",
      at: fundsReceivedAt,
      hint: "On-chain block time of the incoming transfer",
    },
    {
      label: "Detected",
      at: matchedAt,
      hint: laggy
        ? `Detection lag ${formatDuration(detectionLagMs ?? null)} — funds sat unnoticed`
        : "When we saw it and settled the invoice",
      warn: laggy,
    },
    { label: "Swept", at: sweptAt, hint: "Moved to treasury" },
  ];
  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      {steps.map((s) => (
        <div
          key={s.label}
          className="flex items-baseline gap-1.5 text-[10px] leading-tight"
          title={s.at ? `${s.label}: ${fullTimestamp(s.at)}` : `${s.label}: —`}
        >
          <span className="text-[#6b6b80] w-[52px] shrink-0">{s.label}</span>
          <span
            className={`tabular-nums ${
              !s.at
                ? "text-[#3a3a48]"
                : s.warn
                  ? "text-amber-400"
                  : "text-[#c7c7da]"
            }`}
          >
            {shortStamp(s.at ?? null)}
          </span>
          {s.label === "Detected" && detectionLagMs !== null && (
            <span
              className={`ml-auto shrink-0 px-1 rounded ${
                laggy
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-emerald-500/10 text-emerald-400"
              }`}
              title={s.hint}
            >
              +{formatDuration(detectionLagMs ?? null)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ───────── copy-on-click helper hook ─────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#6b6b80] hover:text-white"
      aria-label="Copy"
      title={copied ? "Copied" : "Copy"}
    >
      {copied ? (
        <CheckIcon className="w-3 h-3 text-emerald-400" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  );
}

// ───────── page ─────────

type SubTab = "pending" | "history";

export default function SweeperPage() {
  const [summary, setSummary] = useState<SweeperSummary | null>(null);
  const [pendingRows, setPendingRows] = useState<SweeperPendingRow[]>([]);
  const [historyRows, setHistoryRows] = useState<SweeperHistoryRow[]>([]);
  const [gas, setGas] = useState<SweeperGasStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Chain filter: "all" or a specific chain.
  const [chainFilter, setChainFilter] = useState<"all" | ChainKey>("all");
  const [subTab, setSubTab] = useState<SubTab>("pending");

  // Per-row + batch running state.
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  // Separate from `runningIds` — a row can be mid-gas-recovery in the
  // History tab while an unrelated row is mid-sweep in Pending.
  const [recoveringIds, setRecoveringIds] = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning] = useState<null | "all" | ChainKey>(
    null,
  );

  // Sweep-All confirm dialog.
  const [confirmOpen, setConfirmOpen] = useState<null | "all" | ChainKey>(
    null,
  );

  // Gas-float wallets collapsed by default.
  const [gasOpen, setGasOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const [s, p, h, g] = await Promise.all([
        getSweeperSummary(),
        listPendingSweeps(),
        listSweepHistory({ limit: 100 }),
        getSweeperGasStatus(),
      ]);
      setSummary(s);
      setPendingRows(p.rows);
      setHistoryRows(h.rows);
      setGas(g.chains);
    } catch (err: any) {
      const msg = err?.message || "Failed to load sweeper state";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── filter rows by chain tab ───
  const visiblePending = useMemo(
    () =>
      chainFilter === "all"
        ? pendingRows
        : pendingRows.filter((r) => r.chain === chainFilter),
    [pendingRows, chainFilter],
  );
  const visibleHistory = useMemo(
    () =>
      chainFilter === "all"
        ? historyRows
        : historyRows.filter((r) => r.chain === chainFilter),
    [historyRows, chainFilter],
  );

  const pendingCountForChain = useCallback(
    (c: ChainKey): number =>
      pendingRows.filter((r) => r.chain === c).length,
    [pendingRows],
  );

  // ─── actions ───
  const runOne = async (row: SweeperPendingRow) => {
    if (runningIds.has(row._id)) return;
    setRunningIds((s) => new Set(s).add(row._id));
    try {
      const res = await runSweeper({ requestId: row._id });
      handleResult(res.results, `Sweep ${truncateMid(row.address)}`);
      await load(true);
    } catch (err: any) {
      toast.error(err?.message || "Sweep failed");
    } finally {
      setRunningIds((s) => {
        const n = new Set(s);
        n.delete(row._id);
        return n;
      });
    }
  };

  /**
   * Drain leftover gas from an already-swept deposit address.
   *
   * The sweep attempts this automatically, but that leg is best-effort
   * and used to fail silently under RPC rate-limits — leaving real
   * BNB/POL/ETH stranded with no way to reclaim it from the UI. This is
   * the manual retry. Safe to click twice: recovering an empty address
   * is a clean no-op on the backend.
   */
  const recoverGas = async (row: SweeperHistoryRow) => {
    if (recoveringIds.has(row._id)) return;
    setRecoveringIds((s) => new Set(s).add(row._id));
    try {
      const res = await recoverSweeperGas({ requestId: row._id });
      const r = res.results?.[0];
      if (r?.txHash) {
        toast.success(
          `Recovered ${r.amount?.toFixed(6) ?? "?"} from ${truncateMid(row.address)}`,
        );
      } else if (r?.success) {
        toast.info("Nothing left to recover on that address");
      } else {
        toast.error(r?.error || "Recovery failed");
      }
      await load(true);
    } catch (err: any) {
      toast.error(err?.message || "Recovery failed");
    } finally {
      setRecoveringIds((s) => {
        const n = new Set(s);
        n.delete(row._id);
        return n;
      });
    }
  };

  const runBatch = async (scope: "all" | ChainKey) => {
    if (batchRunning) return;
    setBatchRunning(scope);
    setConfirmOpen(null);
    try {
      const res = await runSweeper(
        scope === "all" ? { all: true } : { chain: scope, all: true },
      );
      handleResult(
        res.results,
        scope === "all" ? "Sweep all chains" : `Sweep all ${CHAIN_LABELS[scope]}`,
      );
      await load(true);
    } catch (err: any) {
      toast.error(err?.message || "Sweep failed");
    } finally {
      setBatchRunning(null);
    }
  };

  const handleResult = (results: SweeperRunResult[], label: string) => {
    const swept = results.filter((r) => r.success && !r.skippedReason).length;
    const errors = results.filter((r) => !r.success).length;
    const skipped = results.filter((r) => r.success && r.skippedReason).length;
    if (swept > 0)
      toast.success(
        `${label}: swept ${swept}${skipped ? `, skipped ${skipped}` : ""}`,
      );
    if (errors > 0) {
      const firstErr = results.find((r) => !r.success)?.error;
      toast.error(
        `${label}: ${errors} error${errors > 1 ? "s" : ""}${firstErr ? ` — ${firstErr}` : ""}`,
      );
    }
    if (swept === 0 && errors === 0 && skipped === results.length)
      toast.info(`${label}: nothing to sweep`);
  };

  // ─── render ───
  if (loading) {
    return (
      <div className="p-6">
        <SkeletonHeader />
        <SkeletonSummary />
        <SkeletonTable />
      </div>
    );
  }

  if (loadError && !summary) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.03] p-6 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-white">Failed to load sweeper</p>
          <p className="text-[11px] text-[#6b6b80] mt-1">{loadError}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#FBD10D] hover:underline"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const gasHealthySummary = (() => {
    if (!gas.length) return { text: "—", tone: "muted" as const };
    const empty = gas.filter((g) => g.balanceWhole === 0).length;
    const low = gas.filter((g) => g.balanceWhole > 0 && g.sweepsFunded < 10)
      .length;
    if (empty > 0)
      return {
        text: `${empty}/${gas.length} empty`,
        tone: "danger" as const,
      };
    if (low > 0)
      return { text: `${low}/${gas.length} low`, tone: "warn" as const };
    return {
      text: `${gas.length}/${gas.length} healthy`,
      tone: "ok" as const,
    };
  })();

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Sweeper
          </h1>
          <p className="text-sm text-[#9fa0b8] mt-1 max-w-xl">
            Consolidate settled crypto deposits into the treasury. Detection is
            automatic — only the final on-chain move is manual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-xs text-[#9fa0b8] hover:text-white transition-colors px-3 py-1.5 rounded-md border border-[#2a2a35] hover:border-[#3a3a48] disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </button>
          <button
            type="button"
            disabled={
              (summary?.totalPendingCount ?? 0) === 0 || batchRunning !== null
            }
            onClick={() => setConfirmOpen("all")}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#FBD10D] text-black px-3 py-1.5 rounded-md hover:bg-[#e6c00d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {batchRunning === "all" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
            Sweep All Chains
            {summary && summary.totalPendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-black/20 rounded-full tabular-nums">
                {summary.totalPendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Summary tiles ──────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard
            label="Pending"
            value={formatUsd(summary.totalPendingUsd)}
            sub={`${summary.totalPendingCount} row${summary.totalPendingCount === 1 ? "" : "s"} awaiting sweep`}
            icon={<Clock className="w-3.5 h-3.5" />}
            tone={summary.totalPendingCount > 0 ? "accent" : "muted"}
          />
          <SummaryCard
            label="Swept last 30d"
            value={formatUsd(summary.totalSweptLast30dUsd)}
            sub={`${summary.totalSweptLast30dCount} completed sweep${summary.totalSweptLast30dCount === 1 ? "" : "s"}`}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            tone="muted"
          />
          <SummaryCard
            label="Gas float"
            value={gasHealthySummary.text}
            sub="Native-coin drums across EVM chains"
            icon={<Fuel className="w-3.5 h-3.5" />}
            tone={
              gasHealthySummary.tone === "danger"
                ? "danger"
                : gasHealthySummary.tone === "warn"
                  ? "warn"
                  : gasHealthySummary.tone === "ok"
                    ? "ok"
                    : "muted"
            }
          />
        </div>
      )}

      {/* ── Chain filter pills ─────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        <ChainPill
          active={chainFilter === "all"}
          onClick={() => setChainFilter("all")}
          label="All"
          count={summary?.totalPendingCount ?? 0}
          dot={null}
        />
        {CHAIN_ORDER.map((c) => (
          <ChainPill
            key={c}
            active={chainFilter === c}
            onClick={() => setChainFilter(c)}
            label={CHAIN_LABELS[c]}
            count={pendingCountForChain(c)}
            dot={CHAIN_DOT[c]}
          />
        ))}
      </div>

      {/* ── Sub-tabs ───────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[#1a1a22]">
        <div className="flex items-center gap-6">
          <SubTabButton
            active={subTab === "pending"}
            onClick={() => setSubTab("pending")}
            label="Pending"
            count={visiblePending.length}
            icon={<Clock className="w-3.5 h-3.5" />}
          />
          <SubTabButton
            active={subTab === "history"}
            onClick={() => setSubTab("history")}
            label="History"
            count={visibleHistory.length}
            icon={<HistoryIcon className="w-3.5 h-3.5" />}
          />
        </div>
        {subTab === "pending" &&
          chainFilter !== "all" &&
          visiblePending.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmOpen(chainFilter)}
              disabled={batchRunning !== null}
              className="text-[11px] text-[#FBD10D] hover:text-[#e6c00d] mb-2 inline-flex items-center gap-1 disabled:opacity-40"
            >
              {batchRunning === chainFilter ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ArrowUpRight className="w-3 h-3" />
              )}
              Sweep all {CHAIN_LABELS[chainFilter]} ({visiblePending.length})
            </button>
          )}
      </div>

      {/* ── Table body ─────────────────────────────── */}
      {subTab === "pending" ? (
        <PendingTable
          rows={visiblePending}
          runningIds={runningIds}
          batchRunning={batchRunning !== null}
          onSweep={runOne}
        />
      ) : (
        <HistoryTable
          rows={visibleHistory}
          onRecoverGas={recoverGas}
          recoveringIds={recoveringIds}
        />
      )}

      {/* ── Gas-float wallets (collapsible) ───────── */}
      <section className="rounded-xl border border-[#1a1a22] bg-[#0a0a0e] overflow-hidden">
        <button
          type="button"
          onClick={() => setGasOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#0e0e12] transition-colors"
        >
          <div className="flex items-center gap-2 text-[11px] text-[#9fa0b8] uppercase tracking-wider">
            <Fuel className="w-3.5 h-3.5" />
            Gas-Float Wallets
            <span className="text-[10px] text-[#6b6b80] normal-case tracking-normal">
              (funds each new deposit address so it can pay its own sweep gas)
            </span>
          </div>
          {gasOpen ? (
            <ChevronDown className="w-4 h-4 text-[#6b6b80]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#6b6b80]" />
          )}
        </button>
        {gasOpen && (
          <div className="border-t border-[#1a1a22] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {gas.map((g) => (
                <GasFloatCard key={g.chain} g={g} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Confirm dialog for batch sweeps ───────── */}
      {confirmOpen && (
        <BatchConfirmDialog
          scope={confirmOpen}
          summary={summary}
          gas={gas}
          onConfirm={() => runBatch(confirmOpen)}
          onCancel={() => setConfirmOpen(null)}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════
// Sub-components
// ═════════════════════════════════════════════════════

function SummaryCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone: "accent" | "muted" | "ok" | "warn" | "danger";
}) {
  const toneClasses = {
    accent: "border-[#FBD10D]/20 bg-[#FBD10D]/[0.02]",
    muted: "border-[#1a1a22] bg-[#0a0a0e]",
    ok: "border-emerald-500/20 bg-emerald-500/[0.02]",
    warn: "border-amber-500/25 bg-amber-500/[0.03]",
    danger: "border-red-500/30 bg-red-500/[0.03]",
  }[tone];
  const iconTone = {
    accent: "text-[#FBD10D]",
    muted: "text-[#6b6b80]",
    ok: "text-emerald-400",
    warn: "text-amber-400",
    danger: "text-red-400",
  }[tone];
  return (
    <div className={`rounded-xl border ${toneClasses} p-4`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#9fa0b8]">
        <span className={iconTone}>{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 text-xl font-medium text-white tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-[#6b6b80]">{sub}</div>
    </div>
  );
}

function ChainPill({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-white text-black border-white"
          : "border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a48] bg-[#0a0a0e]"
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
      <span
        className={`px-1.5 py-0 rounded-full text-[10px] tabular-nums ${
          active
            ? "bg-black/10 text-black/70"
            : "bg-[#1a1a22] text-[#6b6b80]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function SubTabButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 text-xs pb-2.5 pt-1 transition-colors ${
        active
          ? "text-white"
          : "text-[#9fa0b8] hover:text-white"
      }`}
    >
      {icon}
      {label}
      <span className="text-[10px] text-[#6b6b80] tabular-nums bg-[#1a1a22] px-1.5 rounded-full">
        {count}
      </span>
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[#FBD10D] rounded-full" />
      )}
    </button>
  );
}

function PendingTable({
  rows,
  runningIds,
  batchRunning,
  onSweep,
}: {
  rows: SweeperPendingRow[];
  runningIds: Set<string>;
  batchRunning: boolean;
  onSweep: (row: SweeperPendingRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#1a1a22] bg-[#0a0a0e] p-10 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        <p className="text-sm text-white">Nothing to sweep.</p>
        <p className="text-[11px] text-[#6b6b80] mt-1">
          All settled deposits have been consolidated into the treasury.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#1a1a22] bg-[#0a0a0e] overflow-hidden">
      <div className="grid grid-cols-[minmax(0,2.6fr)_minmax(0,2.6fr)_minmax(0,1.7fr)_minmax(0,1.7fr)_minmax(0,2.4fr)_auto] gap-3 px-4 py-2 border-b border-[#1a1a22] text-[10px] uppercase tracking-wider text-[#6b6b80]">
        <div>Address</div>
        <div>Invoice / Buyer</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Gas</div>
        <div>Timeline (UTC)</div>
        <div className="text-right pr-1">Action</div>
      </div>
      <div className="divide-y divide-[#1a1a22]">
        {rows.map((row) => {
          const running = runningIds.has(row._id);
          const onChainAmount = fromAtomic(row.onChainAtomic, row.decimals);
          const gasAmount =
            row.gasDecimals > 0
              ? fromAtomic(row.gasAtomic, row.gasDecimals)
              : 0;
          const isBtc = row.chain === "bitcoin";
          const noGas = !isBtc && gasAmount === 0;
          return (
            <div
              key={row._id}
              className="grid grid-cols-[minmax(0,2.6fr)_minmax(0,2.6fr)_minmax(0,1.7fr)_minmax(0,1.7fr)_minmax(0,2.4fr)_auto] gap-3 px-4 py-3 items-center hover:bg-[#0e0e12] transition-colors"
            >
              {/* Address */}
              <div className="min-w-0 flex items-center gap-1.5 group">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${CHAIN_DOT[row.chain]}`}
                  title={CHAIN_LABELS[row.chain]}
                />
                <a
                  href={`${EXPLORER_ADDRESS[row.chain]}${row.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 min-w-0 text-xs font-mono text-white hover:text-[#FBD10D]"
                  title={row.address}
                >
                  {truncateMid(row.address, 10, 8)}
                  <ExternalLink className="w-2.5 h-2.5 text-[#6b6b80] group-hover:text-[#FBD10D] shrink-0" />
                </a>
                <CopyButton value={row.address} />
              </div>

              {/* Invoice / buyer */}
              <div className="min-w-0 text-xs">
                <div className="text-white truncate" title={row.invoiceNumber || ""}>
                  {row.invoiceNumber || "—"}
                </div>
                <div className="text-[10px] text-[#6b6b80] truncate mt-0.5">
                  {row.invoiceUserEmail || "—"}
                </div>
                {/* Rows listed because funds arrived WITHOUT settling the
                    invoice (underpayment). Money is real and sweepable,
                    but the purchase never completed — flag it so the
                    admin doesn't assume every listed row is a clean
                    settled sale. */}
                {row.sweepReason === "unmatched_funds" && (
                  <span
                    className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    title={`Funds arrived but the invoice never settled (request status: ${row.requestStatus}). Sweepable, but the purchase did not complete.`}
                  >
                    unsettled · {row.requestStatus}
                  </span>
                )}
              </div>

              {/* Amount + USD */}
              <div className="text-right">
                <div className="text-xs text-white tabular-nums">
                  {formatCoinAmount(onChainAmount, row.coin)}{" "}
                  <span className="text-[#6b6b80] font-normal">{row.coin}</span>
                </div>
                <div className="text-[10px] text-[#9fa0b8] tabular-nums mt-0.5">
                  ≈ {formatUsd(row.onChainUsd)}
                </div>
              </div>

              {/* Gas + USD */}
              <div className="text-right">
                {isBtc ? (
                  <>
                    <div className="text-xs text-[#6b6b80]">—</div>
                    <div className="text-[10px] text-[#6b6b80] mt-0.5">
                      fee from UTXO
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={`text-xs tabular-nums inline-flex items-center gap-1 ${
                        noGas ? "text-red-400" : "text-white"
                      }`}
                    >
                      {noGas ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      )}
                      {formatCoinAmount(gasAmount, row.gasSymbol)}{" "}
                      <span className="text-[#6b6b80] font-normal">
                        {row.gasSymbol}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#9fa0b8] tabular-nums mt-0.5">
                      ≈ {formatUsd(row.gasUsd)}
                    </div>
                  </>
                )}
              </div>

              {/* Timeline — absolute UTC stamps for every lifecycle
                  event, plus the detection-lag badge. Replaces the old
                  single "Age" cell, which only showed matchedAt and
                  made it impossible to tell when money actually
                  arrived. */}
              <div className="min-w-0">
                <EventTimeline
                  createdAt={row.createdAt}
                  fundsReceivedAt={row.fundsReceivedAt}
                  matchedAt={row.matchedAt}
                  sweptAt={null}
                  detectionLagMs={row.detectionLagMs}
                  compact
                />
              </div>

              {/* Action */}
              <div className="justify-self-end">
                <button
                  type="button"
                  onClick={() => onSweep(row)}
                  disabled={running || batchRunning}
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#1a1a22] hover:bg-[#22222c] text-white border border-[#2a2a35] px-2.5 py-1 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {running ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Broadcasting…
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-3 h-3" />
                      Sweep
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryTable({
  rows,
  onRecoverGas,
  recoveringIds,
}: {
  rows: SweeperHistoryRow[];
  onRecoverGas: (row: SweeperHistoryRow) => void;
  recoveringIds: Set<string>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#1a1a22] bg-[#0a0a0e] p-10 text-center">
        <HistoryIcon className="w-8 h-8 text-[#6b6b80] mx-auto mb-2" />
        <p className="text-sm text-white">No sweeps recorded yet.</p>
        <p className="text-[11px] text-[#6b6b80] mt-1">
          Completed sweeps for the selected chain will appear here with tx
          hashes + destinations.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#1a1a22] bg-[#0a0a0e] overflow-hidden">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,2.2fr)_minmax(0,1.9fr)] gap-3 px-4 py-2 border-b border-[#1a1a22] text-[10px] uppercase tracking-wider text-[#6b6b80]">
        <div>From (deposit)</div>
        <div>Invoice / Buyer</div>
        <div className="text-right">Amount</div>
        <div>Sweep tx</div>
        <div>To (treasury)</div>
        <div>Timeline (UTC)</div>
        <div className="text-right">Still in wallet</div>
      </div>
      <div className="divide-y divide-[#1a1a22]">
        {rows.map((row) => {
          const amount = fromAtomic(row.expectedAmountAtomic, row.decimals);
          const leftoverGas =
            row.residualGasDecimals > 0
              ? fromAtomic(row.residualGasAtomic, row.residualGasDecimals)
              : 0;
          const leftoverToken = fromAtomic(
            row.residualTokenAtomic,
            row.decimals,
          );
          const recovering = recoveringIds.has(row._id);
          return (
            <div
              key={row._id}
              className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,2.2fr)_minmax(0,1.9fr)] gap-3 px-4 py-3 items-center hover:bg-[#0e0e12] transition-colors"
            >
              {/* From */}
              <div className="min-w-0 flex items-center gap-1.5 group">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${CHAIN_DOT[row.chain]}`}
                  title={CHAIN_LABELS[row.chain]}
                />
                <a
                  href={`${EXPLORER_ADDRESS[row.chain]}${row.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 min-w-0 text-xs font-mono text-white hover:text-[#FBD10D]"
                  title={row.address}
                >
                  {truncateMid(row.address, 10, 8)}
                  <ExternalLink className="w-2.5 h-2.5 text-[#6b6b80] group-hover:text-[#FBD10D] shrink-0" />
                </a>
                <CopyButton value={row.address} />
              </div>

              {/* Invoice / buyer */}
              <div className="min-w-0 text-xs">
                <div className="text-white truncate" title={row.invoiceNumber || ""}>
                  {row.invoiceNumber || "—"}
                </div>
                <div className="text-[10px] text-[#6b6b80] truncate mt-0.5">
                  {row.invoiceUserEmail || "—"}
                </div>
              </div>

              {/* Amount + USD */}
              <div className="text-right">
                <div className="text-xs text-white tabular-nums">
                  {formatCoinAmount(amount, row.coin)}{" "}
                  <span className="text-[#6b6b80] font-normal">{row.coin}</span>
                </div>
                <div
                  className="text-[10px] text-[#9fa0b8] tabular-nums mt-0.5"
                  title="Live snapshot — not the price at sweep time"
                >
                  ≈ {formatUsd(row.amountUsd)}
                </div>
              </div>

              {/* Sweep tx */}
              <div className="min-w-0 flex items-center gap-1.5 group">
                {row.sweepTxHash ? (
                  <>
                    <a
                      href={`${EXPLORER_TX[row.chain]}${row.sweepTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 min-w-0 text-xs font-mono text-white hover:text-[#FBD10D]"
                      title={row.sweepTxHash}
                    >
                      {truncateMid(row.sweepTxHash, 8, 6)}
                      <ExternalLink className="w-2.5 h-2.5 text-[#6b6b80] group-hover:text-[#FBD10D] shrink-0" />
                    </a>
                    <CopyButton value={row.sweepTxHash} />
                  </>
                ) : (
                  <span className="text-xs text-[#6b6b80]">—</span>
                )}
              </div>

              {/* To */}
              <div className="min-w-0 flex items-center gap-1.5 group">
                {row.sweepDestination ? (
                  <>
                    <a
                      href={`${EXPLORER_ADDRESS[row.chain]}${row.sweepDestination}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 min-w-0 text-xs font-mono text-white hover:text-[#FBD10D]"
                      title={row.sweepDestination}
                    >
                      {truncateMid(row.sweepDestination, 10, 8)}
                      <ExternalLink className="w-2.5 h-2.5 text-[#6b6b80] group-hover:text-[#FBD10D] shrink-0" />
                    </a>
                    <CopyButton value={row.sweepDestination} />
                  </>
                ) : (
                  <span className="text-xs text-[#6b6b80]">—</span>
                )}
              </div>

              {/* Timeline — the full lifecycle, not just sweep time.
                  History previously showed only `sweptAt`, so you could
                  see when money left but never when it arrived. */}
              <div className="min-w-0">
                <EventTimeline
                  createdAt={row.createdAt}
                  fundsReceivedAt={row.fundsReceivedAt}
                  matchedAt={row.matchedAt}
                  sweptAt={row.sweptAt}
                  detectionLagMs={row.detectionLagMs}
                  compact
                />
              </div>

              {/* Still in wallet — what's left on the deposit address
                  AFTER the sweep. An ERC-20 sweep is signed by the
                  deposit address, so it has to be pre-funded with gas;
                  whatever isn't burned stays behind. That remainder was
                  previously invisible once a row moved to history, and
                  the auto-recovery leg was failing silently — so real
                  BNB/POL/ETH just accumulated unnoticed. */}
              <div className="text-right min-w-0">
                {row.hasResidual ? (
                  <div className="space-y-1">
                    {leftoverToken > 0 && (
                      <div
                        className="text-[11px] text-amber-400 tabular-nums"
                        title="Token still on the deposit address — the sweep did not move everything"
                      >
                        {formatCoinAmount(leftoverToken, row.coin)} {row.coin}
                      </div>
                    )}
                    {leftoverGas > 0 && (
                      <div
                        className="text-[11px] text-amber-400 tabular-nums"
                        title={`Leftover gas — ${formatUsd(row.residualGasUsd)}`}
                      >
                        {formatCoinAmount(leftoverGas, row.residualGasSymbol)}{" "}
                        <span className="text-[#6b6b80]">
                          {row.residualGasSymbol}
                        </span>
                      </div>
                    )}
                    <div className="text-[9px] text-[#6b6b80] tabular-nums">
                      ≈ {formatUsd(row.residualTokenUsd + row.residualGasUsd)}
                    </div>
                    {/* Recovery state — distinguishes "never tried" from
                        "tried and failed", which the old silent-catch
                        made impossible to tell apart. */}
                    {row.nativeRecoveryFailedReason && (
                      <div
                        className="text-[9px] text-red-400 truncate"
                        title={row.nativeRecoveryFailedReason}
                      >
                        recovery failed
                      </div>
                    )}
                    {/* Bitcoin has no separate gas balance — the miner
                        fee comes out of the swept UTXOs, so there is
                        never a leftover native amount to reclaim.
                        Offering the button there just produces a
                        confusing error. */}
                    {row.chain !== "bitcoin" && (
                      <button
                        type="button"
                        onClick={() => onRecoverGas(row)}
                        disabled={recovering}
                        className="inline-flex items-center gap-1 text-[10px] font-medium bg-[#1a1a22] hover:bg-[#22222c] text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Send the leftover balance on this address to the treasury"
                      >
                        {recovering ? (
                          <>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Recovering
                          </>
                        ) : (
                          <>
                            <Fuel className="w-2.5 h-2.5" />
                            Recover
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : row.nativeRecoveryTxHash ? (
                  <a
                    href={`${EXPLORER_TX[row.chain]}${row.nativeRecoveryTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300"
                    title={`Recovered ${row.nativeRecoveredAmount ?? 0} — click for the tx`}
                  >
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    recovered
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                ) : (
                  <span
                    className="text-[10px] text-[#3a3a48]"
                    title="Nothing left on this address"
                  >
                    empty
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GasFloatCard({ g }: { g: SweeperGasStatus }) {
  const empty = g.balanceWhole === 0;
  const low = !empty && g.sweepsFunded < 10;
  const stateClasses = empty
    ? "border-red-500/40 bg-red-500/[0.03]"
    : low
      ? "border-amber-500/40 bg-amber-500/[0.03]"
      : "border-[#1a1a22] bg-[#0a0a0e]";
  const chainLabel = CHAIN_LABELS[g.chain as ChainKey];
  return (
    <div className={`rounded-lg border ${stateClasses} p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-[#9fa0b8] flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${CHAIN_DOT[g.chain as ChainKey]}`}
          />
          {chainLabel}
        </span>
        {empty ? (
          <span className="text-[9px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
            EMPTY
          </span>
        ) : low ? (
          <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
            LOW
          </span>
        ) : (
          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            OK
          </span>
        )}
      </div>
      <div className="text-base font-medium text-white tabular-nums">
        {g.balanceWhole.toFixed(6)}
      </div>
      <div className="text-[10px] text-[#6b6b80] mb-1.5">
        {g.sweepsFunded > 0
          ? `~${g.sweepsFunded} sweeps of runway`
          : "cannot fund any sweeps"}
      </div>
      <a
        href={`${EXPLORER_ADDRESS[g.chain as ChainKey]}${g.address}`}
        target="_blank"
        rel="noreferrer"
        className="text-[10px] text-[#6b6b80] hover:text-[#FBD10D] font-mono flex items-center gap-1 truncate"
      >
        {truncateMid(g.address, 8, 6)}
        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
      </a>
    </div>
  );
}

function BatchConfirmDialog({
  scope,
  summary,
  gas,
  onConfirm,
  onCancel,
}: {
  scope: "all" | ChainKey;
  summary: SweeperSummary | null;
  gas: SweeperGasStatus[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isAll = scope === "all";
  const chainBreakdown = summary?.chainBreakdown || [];
  const relevant = isAll
    ? chainBreakdown.filter((c) => c.pendingCount > 0)
    : chainBreakdown.filter((c) => c.chain === scope);
  const totalUsd = relevant.reduce((s, c) => s + c.pendingUsd, 0);
  const totalCount = relevant.reduce((s, c) => s + c.pendingCount, 0);
  const gasWarnings = gas.filter(
    (g) =>
      (isAll ||
        (scope === g.chain && (scope === "bsc" || scope === "polygon" || scope === "ethereum"))) &&
      g.balanceWhole === 0,
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#2a2a35] bg-[#0e0e12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#9fa0b8] mb-2">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#FBD10D]" />
            Confirm sweep
          </div>
          <h3 className="text-base font-medium text-white">
            {isAll
              ? "Sweep every chain"
              : `Sweep all ${CHAIN_LABELS[scope]}`}
          </h3>
          <p className="text-xs text-[#9fa0b8] mt-1">
            Broadcasts one on-chain transaction per row. Failures don&apos;t
            abort the batch — each row&apos;s outcome is reported individually.
          </p>
        </div>
        <div className="mx-5 rounded-lg border border-[#1a1a22] bg-[#0a0a0e] p-3 space-y-2">
          {relevant.map((c) => (
            <div
              key={c.chain}
              className="flex items-center justify-between text-xs"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${CHAIN_DOT[c.chain as ChainKey]}`}
                />
                <span className="text-white">
                  {CHAIN_LABELS[c.chain as ChainKey]}
                </span>
                <span className="text-[10px] text-[#6b6b80]">
                  ({c.pendingCount} row{c.pendingCount === 1 ? "" : "s"})
                </span>
              </span>
              <span className="tabular-nums text-[#9fa0b8]">
                {formatUsd(c.pendingUsd)}
              </span>
            </div>
          ))}
          {relevant.length === 0 && (
            <div className="text-xs text-[#6b6b80] text-center py-2">
              Nothing pending on this scope.
            </div>
          )}
          <div className="border-t border-[#1a1a22] pt-2 flex items-center justify-between text-xs">
            <span className="text-white font-medium">Total</span>
            <span className="tabular-nums text-white font-medium">
              {formatUsd(totalUsd)} · {totalCount} row
              {totalCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {gasWarnings.length > 0 && (
          <div className="mx-5 mt-3 rounded-lg border border-red-500/30 bg-red-500/[0.03] p-3 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#9fa0b8]">
              Gas float empty on{" "}
              <span className="text-red-400 font-medium">
                {gasWarnings
                  .map((g) => CHAIN_LABELS[g.chain as ChainKey])
                  .join(", ")}
              </span>
              . Those rows will fail — fund the drum first for a clean batch.
            </div>
          </div>
        )}
        <div className="px-5 pt-4 pb-5 mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[#9fa0b8] hover:text-white px-3 py-1.5 rounded-md hover:bg-[#1a1a22] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={totalCount === 0}
            onClick={onConfirm}
            className="text-xs font-medium bg-[#FBD10D] text-black hover:bg-[#e6c00d] px-3 py-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Confirm & sweep
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// Skeleton loaders
// ═════════════════════════════════════════════════════

function SkeletonHeader() {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <div className="h-7 w-40 bg-[#1a1a22] rounded animate-pulse" />
        <div className="h-3 w-72 bg-[#1a1a22] rounded animate-pulse mt-2" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-24 bg-[#1a1a22] rounded animate-pulse" />
        <div className="h-8 w-40 bg-[#1a1a22] rounded animate-pulse" />
      </div>
    </div>
  );
}

function SkeletonSummary() {
  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[#1a1a22] bg-[#0a0a0e] p-4"
        >
          <div className="h-3 w-16 bg-[#1a1a22] rounded animate-pulse" />
          <div className="h-6 w-24 bg-[#1a1a22] rounded animate-pulse mt-2" />
          <div className="h-3 w-32 bg-[#1a1a22] rounded animate-pulse mt-2" />
        </div>
      ))}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-xl border border-[#1a1a22] bg-[#0a0a0e] overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="grid grid-cols-6 gap-3 px-4 py-3 border-b border-[#1a1a22] last:border-b-0"
        >
          {[0, 1, 2, 3, 4, 5].map((j) => (
            <div
              key={j}
              className="h-4 bg-[#1a1a22] rounded animate-pulse"
              style={{ animationDelay: `${(i + j) * 80}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
