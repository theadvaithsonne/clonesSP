"use client";

// NetworkChain monthly rank bonus — admin surface.
//
// Two views behind one page:
//   People  — everyone in the tree, their subscription state, who referred them,
//             their rank. Click a row for the full why-this-rank breakdown.
//   Runs    — the monthly job history, with a dry-run trigger for the current
//             period so the bill can be previewed before any money moves.
//
// Backend: garagenew-backend/src/routes/garageAdminRankBonus.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { garageAdminApi } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { toast } from "sonner";
import {
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  CalendarClock,
  Loader2,
  Trophy,
  X,
} from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import type { ColumnDef, SortState } from "@/components/data-table/types";
import { RankBadge, ActivePill } from "@/components/garage-admin/RankBadge";
import { RankPersonDrawer } from "@/components/garage-admin/RankPersonDrawer";

const RPP_OPTIONS = [10, 20, 50, 100];
const RANKS = ["Bronze", "Silver", "Gold", "Diamond", "Platinum"] as const;

/** Distribution-bar colours, matching RankBadge's metal palette. */
const RANK_BAR: Record<string, string> = {
  Bronze: "#D08B4F",
  Silver: "#C7CBD1",
  Gold: "#FFC200",
  Diamond: "#6FC3FF",
  Platinum: "#C4B0FF",
};

type PersonRow = {
  id: string;
  name: string | null;
  email: string | null;
  affiliateId: string | null;
  joinedAt: string | null;
  active: boolean;
  rank: string | null;
  rankPeriodKey: string | null;
  directsCount: number;
  downlineCount: number;
  activeDirects: number;
  referrerId: string | null;
  referrerName: string | null;
  referrerEmail: string | null;
};

type RunTotals = {
  activeSubscribers?: number;
  evaluated?: number;
  qualified?: number;
  byRank?: Record<string, number>;
  bonusUsd?: number;
  paidUsd?: number;
  routedToPlatformUsd?: number;
  failed?: number;
};

type RunRow = {
  _id: string;
  periodKey: string;
  planVersion: number;
  /** computing | computed | paying | paid | failed */
  status: string;
  dryRun: boolean;
  totals: RunTotals;
  snapshotAt?: string | null;
  startedAt?: string | null;
  computedAt?: string | null;
  paidAt?: string | null;
  triggeredBy?: string | null;
  error?: string | null;
};

/** Outcome envelope from POST /runs/:periodKey/execute. */
type RunOutcome = {
  status: "completed" | "skipped_locked" | "already_paid" | "failed";
  run?: RunRow;
  message?: string;
};

type RankTier = {
  key: string;
  bonusUsd: number;
  requiredActiveDirects?: number;
  requiredLegs?: number;
};

type RankPlan = {
  version: number;
  tiers: RankTier[];
  bronzeStacks: boolean;
  note?: string;
};

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function periodLabel(periodKey: string): string {
  const [y, m] = periodKey.split("-").map(Number);
  if (!y || !m) return periodKey;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Avatar({ name, email }: { name: string | null; email: string | null }) {
  const initial = (name || email || "?").charAt(0).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-sm font-semibold text-black">
      {initial}
    </div>
  );
}

const dash = <span className="text-zinc-600">—</span>;

/** Header KPI. Compact enough that four fit above the table without crowding. */
function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "gold" | "emerald";
}) {
  const valueCls =
    tone === "gold"
      ? "text-[#FFC200]"
      : tone === "emerald"
      ? "text-emerald-400"
      : "text-white";
  return (
    <div className="min-w-[128px] flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </div>
      <div className={`mt-1 text-[19px] font-semibold tabular-nums ${valueCls}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-zinc-600">{sub}</div>}
    </div>
  );
}

/** Proportional strip of who holds what rank right now. */
function RankDistribution({
  counts,
  totalRanked,
  activeRank,
  onPick,
}: {
  counts: Record<string, number>;
  totalRanked: number;
  activeRank: string;
  onPick: (rank: string) => void;
}) {
  if (!totalRanked) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-3 text-[12px] text-zinc-600">
        No one holds a rank yet — ranks are stamped when a run completes.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Rank distribution
        </span>
        <span className="text-[11px] tabular-nums text-zinc-500">
          {totalRanked.toLocaleString()} ranked
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
        {RANKS.map((r) =>
          counts[r] ? (
            <div
              key={r}
              className="h-full transition-all"
              style={{
                width: `${(counts[r] / totalRanked) * 100}%`,
                background: RANK_BAR[r],
              }}
              title={`${counts[r]} ${r}`}
            />
          ) : null
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {RANKS.map((r) => (
          <button
            key={r}
            onClick={() => onPick(r)}
            className={`flex items-center gap-1.5 text-[11px] transition ${
              activeRank === r ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            } ${counts[r] ? "" : "opacity-40"}`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: RANK_BAR[r] }}
            />
            {r}
            <span className="tabular-nums text-zinc-600">{counts[r] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RankBonusPage() {
  const router = useRouter();
  const { query: search } = useAdminSearch();

  const [tab, setTab] = useState<"people" | "runs">("people");

  // ── People ──────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [rankCounts, setRankCounts] = useState<Record<string, number>>({});
  const [rankedTotal, setRankedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<SortState | null>(null);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [rankFilter, setRankFilter] = useState<string>("");
  const [detailId, setDetailId] = useState<string | null>(null);

  // ── Runs ────────────────────────────────────────────────────────────────
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState<boolean | null>(null);
  // Two different months. `accruing` is in progress and can only be previewed;
  // `settling` is the one that has closed and is what actually gets paid.
  const [accruingPeriod, setAccruingPeriod] = useState<string | null>(null);
  const [settlingPeriod, setSettlingPeriod] = useState<string | null>(null);
  const [settlingEligible, setSettlingEligible] = useState(false);
  const [plan, setPlan] = useState<RankPlan | null>(null);
  const [executing, setExecuting] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleAuthError = useCallback(
    (msg: string) => {
      if (!/invalid token|unauthor|401|expired/i.test(msg)) return false;
      try {
        localStorage.removeItem("garage_admin_token");
        localStorage.removeItem("garage_admin_info");
      } catch {}
      toast.error("Session expired — signing you out");
      router.push("/garage-admin/login");
      return true;
    },
    [router]
  );

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams({
        limit: String(pageSize),
        skip: String((page - 1) * pageSize),
      });
      if (status !== "all") qs.set("status", status);
      if (rankFilter) qs.set("rank", rankFilter);
      if (debouncedSearch) qs.set("search", debouncedSearch);
      if (sort?.by) {
        qs.set("sortBy", sort.by);
        qs.set("sortOrder", sort.order);
      }
      const res = await garageAdminApi<{
        rows: PersonRow[];
        total: number;
        activeTotal: number;
        rankCounts: Record<string, number>;
        rankedTotal: number;
      }>(`/garage-admin/rank-bonus/people?${qs.toString()}`, { method: "GET" });
      setRows(res?.rows || []);
      setTotal(res?.total || 0);
      setActiveTotal(res?.activeTotal || 0);
      setRankCounts(res?.rankCounts || {});
      setRankedTotal(res?.rankedTotal || 0);
    } catch (error: any) {
      const msg = error?.message || "Failed to load people";
      if (handleAuthError(msg)) return;
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, rankFilter, debouncedSearch, sort, handleAuthError]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const [runsRes, currentRes, planRes] = await Promise.all([
        garageAdminApi<{ runs: RunRow[]; payoutsEnabled: boolean }>(
          "/garage-admin/rank-bonus/runs?limit=24",
          { method: "GET" }
        ),
        garageAdminApi<{
          accruingPeriodKey: string;
          settlingPeriodKey: string;
          settlingEligible: boolean;
        }>("/garage-admin/rank-bonus/current", { method: "GET" }),
        // A missing plan is a legitimate pre-seed state, not an error.
        garageAdminApi<{ plan: RankPlan }>("/garage-admin/rank-bonus/plan", {
          method: "GET",
        }).catch(() => null),
      ]);
      setRuns(runsRes?.runs || []);
      setPayoutsEnabled(Boolean(runsRes?.payoutsEnabled));
      setAccruingPeriod(currentRes?.accruingPeriodKey || null);
      setSettlingPeriod(currentRes?.settlingPeriodKey || null);
      setSettlingEligible(Boolean(currentRes?.settlingEligible));
      setPlan(planRes?.plan || null);
    } catch (error: any) {
      const msg = error?.message || "Failed to load runs";
      if (handleAuthError(msg)) return;
      toast.error(msg);
    } finally {
      setRunsLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);
  useEffect(() => {
    loadRuns();
  }, [loadRuns]);
  useEffect(() => {
    setPage(1);
  }, [status, rankFilter, debouncedSearch, sort]);

  async function execute(periodKey: string, dryRun: boolean) {
    if (
      !dryRun &&
      !window.confirm(
        `Pay out rank bonuses for ${periodLabel(periodKey)}?\n\n` +
          `This moves real money into affiliate wallets and cannot be reversed automatically.`
      )
    ) {
      return;
    }
    setExecuting(true);
    try {
      const out = await garageAdminApi<RunOutcome>(
        `/garage-admin/rank-bonus/runs/${periodKey}/execute`,
        { method: "POST", body: JSON.stringify({ dryRun }) }
      );
      const t = out?.run?.totals;
      if (out?.status === "completed") {
        toast.success(
          dryRun
            ? `Dry run complete — ${t?.qualified ?? 0} qualifiers, ${formatMoney(
                t?.bonusUsd ?? 0
              )} owed`
            : `Paid ${formatMoney(t?.paidUsd ?? 0)} to ${t?.qualified ?? 0} qualifiers` +
              (t?.failed ? ` · ${t.failed} failed` : "")
        );
      } else {
        // already_paid / skipped_locked / failed all come back 4xx-5xx, so this
        // branch is mostly defensive.
        toast.warning(out?.message || out?.status || "Run did not complete");
      }
      await Promise.all([loadRuns(), loadPeople()]);
    } catch (error: any) {
      const msg = error?.message || "Run failed";
      if (!handleAuthError(msg)) toast.error(msg);
    } finally {
      setExecuting(false);
    }
  }

  const bronzeNeeded =
    plan?.tiers?.find((t) => t.key === "Bronze")?.requiredActiveDirects ?? 5;

  const columns = useMemo<ColumnDef<PersonRow>[]>(
    () => [
      {
        id: "name",
        header: "Member",
        width: 270,
        frozen: true,
        sortable: true,
        cell: (r) => (
          <div className="flex items-center gap-3">
            <Avatar name={r.name} email={r.email} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-white">
                {r.name || "—"}
              </div>
              <div className="truncate text-[11px] text-zinc-400">{r.email || "—"}</div>
            </div>
          </div>
        ),
      },
      {
        id: "rank",
        header: "Rank",
        width: 120,
        sortable: true,
        cell: (r) => <RankBadge rank={r.rank} />,
      },
      {
        id: "active",
        header: "Subscription",
        width: 128,
        cell: (r) => <ActivePill active={r.active} />,
      },
      {
        id: "directsCount",
        header: "Active directs",
        width: 150,
        sortable: true,
        cell: (r) => {
          const hit = r.activeDirects >= bronzeNeeded;
          const pct = Math.min(100, (r.activeDirects / bronzeNeeded) * 100);
          return (
            <div
              className="flex flex-col gap-1"
              title={`${r.activeDirects} of ${r.directsCount} directs hold an active paid subscription. ${bronzeNeeded} is the Bronze threshold.`}
            >
              <div className="flex items-baseline gap-1 text-[12px] tabular-nums">
                <span className={hit ? "font-semibold text-emerald-400" : "text-zinc-200"}>
                  {r.activeDirects}
                </span>
                <span className="text-zinc-600">/ {r.directsCount} directs</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full ${
                    hit ? "bg-emerald-500" : "bg-zinc-600"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        id: "downlineCount",
        header: "Downline",
        width: 100,
        align: "right",
        sortable: true,
        cell: (r) => (
          <span className="tabular-nums text-zinc-300">
            {r.downlineCount.toLocaleString()}
          </span>
        ),
      },
      {
        id: "referrerName",
        header: "Referred by",
        width: 220,
        cell: (r) =>
          r.referrerId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailId(r.referrerId!);
              }}
              className="min-w-0 max-w-full text-left"
            >
              <div className="truncate text-[13px] text-zinc-200 hover:text-[#FFC200] hover:underline">
                {r.referrerName || r.referrerEmail || "—"}
              </div>
              {r.referrerName && (
                <div className="truncate text-[11px] text-zinc-500">
                  {r.referrerEmail || ""}
                </div>
              )}
            </button>
          ) : (
            <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-500">
              Root
            </span>
          ),
      },
      {
        id: "joinedAt",
        header: "Joined",
        width: 130,
        sortable: true,
        cell: (r) =>
          r.joinedAt ? (
            <span className="text-[12px] text-zinc-300">{formatShortDate(r.joinedAt)}</span>
          ) : (
            dash
          ),
      },
      {
        id: "rankPeriodKey",
        header: "Ranked in",
        width: 110,
        cell: (r) =>
          r.rankPeriodKey ? (
            <span className="font-mono text-[11px] text-zinc-400">{r.rankPeriodKey}</span>
          ) : (
            dash
          ),
      },
    ],
    [bronzeNeeded]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const from = (page - 1) * pageSize + 1;
    return `${from} to ${Math.min(total, page * pageSize)}`;
  }, [page, pageSize, total]);

  const latestRun = runs[0];
  const accruingRun = accruingPeriod
    ? runs.find((r) => r.periodKey === accruingPeriod)
    : undefined;
  const settlingRun = settlingPeriod
    ? runs.find((r) => r.periodKey === settlingPeriod)
    : undefined;
  const filtersOn = status !== "all" || !!rankFilter || !!debouncedSearch;

  const topBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`h-8 rounded-full px-3.5 text-[12px] font-medium capitalize transition ${
                status === s
                  ? "bg-[#FBD10D] text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {s === "all" ? "All members" : s}
            </button>
          ))}
        </div>

        {rankFilter && (
          <button
            onClick={() => setRankFilter("")}
            className="flex h-8 items-center gap-1.5 rounded-full border border-[#FBD10D]/30 bg-[#FBD10D]/10 px-3 text-[12px] font-medium text-[#FBD10D] transition hover:bg-[#FBD10D]/15"
          >
            {rankFilter}
            <X className="h-3 w-3" />
          </button>
        )}

        {filtersOn && (
          <button
            onClick={() => {
              setStatus("all");
              setRankFilter("");
            }}
            className="h-8 px-2 text-[12px] text-zinc-500 transition hover:text-zinc-300"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {sort?.by && (
          <button
            onClick={() => setSort(null)}
            className="h-8 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-zinc-400 transition hover:text-white"
            title="Back to default ordering (largest organisations first)"
          >
            Sorted by {sort.by} ↓
          </button>
        )}
        <button
          onClick={loadPeople}
          disabled={loading}
          className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </div>
  );

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-none border-b border-white/[0.06] bg-[#0d0d0d] px-5 pb-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#FBD10D]/15 bg-gradient-to-br from-[#FBD10D]/15 to-[#FBD10D]/[0.02]">
              <Trophy className="h-5 w-5 text-[#FBD10D]" />
            </div>
            <div>
              <h1 className="text-2xl font-black leading-none tracking-tight text-white">
                Rank Bonus
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500">
                NetworkChain monthly ranks — Bronze through Platinum. Each month settles on the 1st of the next.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5">
              {(
                [
                  { k: "people", label: "People", icon: Users },
                  { k: "runs", label: "Monthly runs", icon: CalendarClock },
                ] as const
              ).map((t) => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition ${
                    tab === t.k ? "bg-[#FBD10D] text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {payoutsEnabled === null ? null : payoutsEnabled ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 text-[11px] font-medium text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Payouts live
              </span>
            ) : (
              <span
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 text-[11px] font-medium text-amber-400"
                title="RANK_BONUS_PAYOUTS_ENABLED is not set — runs compute and record but move no money"
              >
                <ShieldAlert className="h-3.5 w-3.5" /> Dry-run mode
              </span>
            )}

            {accruingPeriod && (
              <button
                onClick={() => execute(accruingPeriod, true)}
                disabled={executing}
                title="Dry run against the month in progress — nothing is paid"
                className="flex h-9 items-center gap-2 rounded-full bg-[#FBD10D] px-4 text-sm font-medium text-black transition hover:bg-[#f5c800] disabled:opacity-60"
              >
                {executing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Preview {accruingPeriod}
              </button>
            )}
          </div>
        </div>

        {/* KPIs + distribution */}
        <div className="mt-4 flex flex-wrap items-stretch gap-3">
          <Kpi
            label="Active subscribers"
            value={activeTotal.toLocaleString()}
            sub="paid, not free-month only"
            tone="emerald"
          />
          <Kpi
            label="Ranked members"
            value={rankedTotal.toLocaleString()}
            sub={
              activeTotal
                ? `ceiling ${Math.floor(activeTotal / bronzeNeeded).toLocaleString()} at ${bronzeNeeded} directs each`
                : undefined
            }
          />
          <Kpi
            label={latestRun?.dryRun ? "Last run — would owe" : "Last run — paid"}
            value={formatMoney(
              latestRun?.dryRun
                ? latestRun?.totals?.bonusUsd || 0
                : latestRun?.totals?.paidUsd || 0
            )}
            sub={latestRun ? periodLabel(latestRun.periodKey) : "no runs yet"}
            tone="gold"
          />
          <Kpi
            label="Members in tree"
            value={total.toLocaleString()}
            sub={filtersOn ? "matching filters" : "all levels"}
          />
          <div className="min-w-[300px] flex-[2]">
            <RankDistribution
              counts={rankCounts}
              totalRanked={rankedTotal}
              activeRank={rankFilter}
              onPick={(r) => setRankFilter(rankFilter === r ? "" : r)}
            />
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {tab === "people" ? (
        loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="text-sm font-medium text-white">
              Couldn&apos;t load rank bonus people
            </div>
            <div className="max-w-md text-center text-xs text-zinc-500">{loadError}</div>
            <button
              onClick={loadPeople}
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06]"
            >
              Retry
            </button>
          </div>
        ) : (
          <DataTable<PersonRow>
            tableId="garage-admin-rank-bonus-people-v1"
            stickyBg="#181818"
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            loading={loading}
            emptyLabel={
              filtersOn
                ? "No members match these filters."
                : "No members yet."
            }
            sort={sort}
            onSortChange={setSort}
            onRowClick={(r) => setDetailId(r.id)}
            topBar={topBar}
            footerTotals={[
              { label: "Members", value: total.toLocaleString() },
              { label: "Active", value: activeTotal.toLocaleString() },
              { label: "Ranked", value: rankedTotal.toLocaleString() },
            ]}
            pagination={{
              page,
              totalPages,
              rangeLabel,
              recordsPerPage: pageSize,
              recordsPerPageOptions: RPP_OPTIONS,
              onPrev: () => setPage((p) => Math.max(1, p - 1)),
              onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
              onRecordsPerPageChange: (n) => {
                setPageSize(n);
                setPage(1);
              },
            }}
          />
        )
      ) : (
        <RunsView
          runs={runs}
          loading={runsLoading}
          accruingPeriod={accruingPeriod}
          accruingRun={accruingRun}
          settlingPeriod={settlingPeriod}
          settlingRun={settlingRun}
          settlingEligible={settlingEligible}
          executing={executing}
          payoutsEnabled={payoutsEnabled}
          plan={plan}
          onExecute={execute}
          onRefresh={loadRuns}
        />
      )}

      <RankPersonDrawer
        userId={detailId}
        onClose={() => setDetailId(null)}
        onNavigate={(id) => setDetailId(id)}
      />
    </div>
  );
}

// ── Runs tab ──────────────────────────────────────────────────────────────

/** Shared totals strip for a period card. */
function RunTotalsStrip({ run }: { run: RunRow }) {
  const cells = [
    {
      l: "Active subscribers",
      v: (run.totals?.activeSubscribers || 0).toLocaleString(),
    },
    { l: "Qualifiers", v: (run.totals?.qualified || 0).toLocaleString() },
    { l: "Owed", v: formatMoney(run.totals?.bonusUsd || 0) },
    {
      l: "Paid",
      v: run.dryRun
        ? "Dry run — $0"
        : `${formatMoney(run.totals?.paidUsd || 0)}${
            run.totals?.failed ? ` · ${run.totals.failed} failed` : ""
          }`,
    },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/[0.06] sm:grid-cols-4">
      {cells.map((s) => (
        <div key={s.l} className="bg-[#0e0e0e] px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600">
            {s.l}
          </div>
          <div className="mt-1 text-[15px] font-semibold text-white">{s.v}</div>
        </div>
      ))}
    </div>
  );
}

function RunsView({
  runs,
  loading,
  accruingPeriod,
  accruingRun,
  settlingPeriod,
  settlingRun,
  settlingEligible,
  executing,
  payoutsEnabled,
  plan,
  onExecute,
  onRefresh,
}: {
  runs: RunRow[];
  loading: boolean;
  accruingPeriod: string | null;
  accruingRun: RunRow | undefined;
  settlingPeriod: string | null;
  settlingRun: RunRow | undefined;
  settlingEligible: boolean;
  executing: boolean;
  payoutsEnabled: boolean | null;
  plan: RankPlan | null;
  onExecute: (periodKey: string, dryRun: boolean) => void;
  onRefresh: () => void;
}) {
  const settled = settlingRun?.status === "paid" && !settlingRun?.dryRun;

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {/* The month that has closed — this is what actually gets paid. */}
          {settlingPeriod && settlingEligible && (
            <div className="mb-4 rounded-2xl border border-[#FBD10D]/25 bg-gradient-to-b from-[#FBD10D]/[0.07] to-transparent p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-[#FBD10D]">
                    {settled ? "Last settled" : "Ready to settle"}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {periodLabel(settlingPeriod)}
                  </div>
                  <p className="mt-1.5 max-w-lg text-[12px] leading-relaxed text-zinc-500">
                    This month has closed. The cron settles it automatically; a dry
                    run recomputes and records the bill without moving money, and
                    paying out cannot be reversed.
                  </p>
                </div>
                {!settled && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onExecute(settlingPeriod, true)}
                      disabled={executing}
                      className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
                    >
                      {executing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      Dry run
                    </button>
                    <button
                      onClick={() => onExecute(settlingPeriod, false)}
                      disabled={executing || !payoutsEnabled}
                      title={
                        payoutsEnabled
                          ? "Compute and pay this period"
                          : "RANK_BONUS_PAYOUTS_ENABLED is off — no money can move"
                      }
                      className="flex h-9 items-center gap-2 rounded-full bg-[#FBD10D] px-4 text-sm font-medium text-black transition hover:bg-[#f5c800] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Pay out
                    </button>
                  </div>
                )}
              </div>

              {settlingRun ? (
                <RunTotalsStrip run={settlingRun} />
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-white/[0.08] px-4 py-5 text-center text-[12px] text-zinc-600">
                  Not computed yet. The cron picks it up automatically, or run it now.
                </div>
              )}
            </div>
          )}

          {/* The month in progress — preview only, never payable. */}
          {accruingPeriod && (
            <div className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    In progress
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {periodLabel(accruingPeriod)}
                  </div>
                  <p className="mt-1.5 max-w-lg text-[12px] leading-relaxed text-zinc-500">
                    Still accruing — it settles once the month closes. Preview shows
                    what it would pay if the month ended today.
                  </p>
                </div>
                <button
                  onClick={() => onExecute(accruingPeriod, true)}
                  disabled={executing}
                  className="flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
                >
                  {executing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Preview
                </button>
              </div>

              {accruingRun ? (
                <RunTotalsStrip run={accruingRun} />
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-white/[0.08] px-4 py-5 text-center text-[12px] text-zinc-600">
                  Not previewed yet. Run a preview to see what this month would pay.
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Run history
            </h2>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {loading && runs.length === 0 ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[76px] animate-pulse rounded-xl bg-white/[0.04]" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/[0.08] py-16">
              <div className="text-sm text-zinc-400">No runs yet</div>
              <div className="text-xs text-zinc-600">
                The first run fires once the current month closes, or trigger one above.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <RunCard key={r._id} run={r} />
              ))}
            </div>
          )}
        </div>

        {/* Plan reference */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Plan
              </h2>
              {plan && (
                <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-400">
                  v{plan.version}
                </span>
              )}
            </div>

            {!plan ? (
              <p className="text-[12px] text-zinc-600">
                No active RankPlan is configured.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  {plan.tiers.map((t) => (
                    <div
                      key={t.key}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <RankBadge rank={t.key} />
                        <div className="mt-1 truncate text-[11px] text-zinc-500">
                          {t.key === "Bronze"
                            ? `${t.requiredActiveDirects ?? 5} active directs`
                            : `1 ${prevRank(t.key)} in ${t.requiredLegs ?? 0} legs`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-semibold tabular-nums text-white">
                          {formatMoney(t.bonusUsd)}
                        </div>
                        {plan.bronzeStacks && t.key !== "Bronze" && (
                          <div className="text-[10px] tabular-nums text-zinc-600">
                            pays{" "}
                            {formatMoney(
                              t.bonusUsd +
                                (plan.tiers.find((x) => x.key === "Bronze")?.bonusUsd || 0)
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {plan.bronzeStacks && (
                  <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
                    Bronze stacks with every rank; higher ranks replace each other.
                    You must be active yourself to earn anything.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function prevRank(key: string): string {
  const i = RANKS.indexOf(key as (typeof RANKS)[number]);
  return i > 0 ? RANKS[i - 1] : "—";
}

function RunCard({ run: r }: { run: RunRow }) {
  const statusCls =
    r.status === "paid"
      ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25"
      : r.status === "failed"
      ? "bg-rose-500/10 text-rose-400 ring-rose-500/25"
      : r.status === "computed"
      ? "bg-zinc-500/10 text-zinc-300 ring-white/[0.08]"
      : "bg-sky-500/10 text-sky-400 ring-sky-500/25";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/[0.1] hover:bg-white/[0.035]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[15px] font-semibold text-white">
            {periodLabel(r.periodKey)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${statusCls}`}
          >
            {r.status}
          </span>
          {r.dryRun && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25">
              Dry run
            </span>
          )}
          <span className="text-[11px] text-zinc-600">plan v{r.planVersion}</span>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-600">
              Qualifiers
            </div>
            <div className="text-[13px] font-medium tabular-nums text-zinc-200">
              {(r.totals?.qualified || 0).toLocaleString()}
              <span className="text-zinc-600">
                {" / "}
                {(r.totals?.activeSubscribers || 0).toLocaleString()}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-600">
              {r.dryRun ? "Would owe" : "Paid"}
            </div>
            <div className="text-[13px] font-semibold tabular-nums text-white">
              {formatMoney(r.dryRun ? r.totals?.bonusUsd || 0 : r.totals?.paidUsd || 0)}
            </div>
          </div>
          <div className="w-24">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600">
              {r.paidAt ? "Paid on" : "Computed"}
            </div>
            <div className="text-[12px] text-zinc-400">
              {formatShortDate(r.paidAt || r.computedAt)}
            </div>
          </div>
        </div>
      </div>

      {r.totals?.byRank && Object.values(r.totals.byRank).some(Boolean) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.04] pt-3">
          {RANKS.filter((k) => (r.totals.byRank as any)?.[k]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <RankBadge rank={k} />
              <span className="text-[12px] tabular-nums text-zinc-400">
                ×{(r.totals.byRank as any)[k]}
              </span>
            </span>
          ))}
          {!!r.totals.routedToPlatformUsd && (
            <span
              className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400 ring-1 ring-inset ring-amber-500/25"
              title="Earners with no active Unilevel Plus licence — the money went to the platform"
            >
              {formatMoney(r.totals.routedToPlatformUsd)} to platform
            </span>
          )}
        </div>
      )}

      {r.error && (
        <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-300">
          {r.error}
        </div>
      )}

      {r.triggeredBy && (
        <div className="mt-2 text-[11px] text-zinc-600">Triggered by {r.triggeredBy}</div>
      )}
    </div>
  );
}
