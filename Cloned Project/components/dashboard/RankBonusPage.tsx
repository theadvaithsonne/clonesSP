"use client";

// Member-facing view of the NetworkChain rank bonus.
//
// The admin page answers "what does the company owe?". This one answers the
// three questions a member actually has: what rank am I, what is stopping me
// from the next one, and who in my team do I need to nudge. Everything comes
// from GET /rank-bonus/me, which is self-scoped server-side — there is no way
// to view anyone else's tree from here.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Trophy,
  Users,
  TrendingUp,
  Loader2,
  AlertCircle,
  Check,
  Minus,
  Lock,
  Wallet,
  GitBranch,
  RefreshCw,
} from "lucide-react";

const RANKS = ["Bronze", "Silver", "Gold", "Diamond", "Platinum"] as const;

/** How many rows to show before collapsing behind a "show all". */
const DIRECTS_PREVIEW = 8;
const LEGS_PREVIEW = 5;
type RankKey = (typeof RANKS)[number];

const RANK_COLOR: Record<string, string> = {
  Bronze: "#D08B4F",
  Silver: "#C7CBD1",
  Gold: "#FFC200",
  Diamond: "#6FC3FF",
  Platinum: "#C4B0FF",
};

type Person = {
  id: string;
  name: string | null;
  email: string | null;
  joinedAt: string | null;
  active: boolean;
  rank: string | null;
  directsCount: number;
  downlineCount: number;
};

type Tier = {
  key: string;
  bonusUsd: number;
  requiredActiveDirects?: number;
  requiredLegs?: number;
};

type Me = {
  user: Person & { rankPeriodKey: string | null };
  referrer: Person | null;
  subscription: {
    active: boolean;
    reason: string;
    currentPeriodEnd: string | null;
    termMonths: number | null;
    paidCycles: number;
  };
  directs: Person[];
  activeDirects: number;
  legs: Array<{ legHead: Person; topRank: string | null; size: number }>;
  history: Array<{
    periodKey: string;
    rank: string;
    bonusUsd: number;
    payoutStatus: string;
    routedToPlatform: boolean;
    paidAt: string | null;
  }>;
  nextRank: {
    target: string;
    requirement: string;
    have: number;
    need: number;
  } | null;
  lifetimeUsd: number;
  currentPeriodKey: string;
  plan: { version: number; bronzeStacks: boolean; tiers: Tier[] };
};

const money = (n: number) =>
  `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function periodLabel(periodKey: string) {
  const [y, m] = periodKey.split("-").map(Number);
  if (!y || !m) return periodKey;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A month is paid once it closes, so "Aug 2026" settles on 1 Sep. */
function nextMonthLabel(periodKey: string) {
  const [y, m] = periodKey.split("-").map(Number);
  if (!y || !m) return "next month";
  return new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

/** What this rank actually pays, Bronze stacking included. */
function payoutFor(plan: Me["plan"], key: string): number {
  const tier = plan.tiers.find((t) => t.key === key);
  if (!tier) return 0;
  if (key === "Bronze" || !plan.bronzeStacks) return tier.bonusUsd;
  const bronze = plan.tiers.find((t) => t.key === "Bronze")?.bonusUsd || 0;
  return tier.bonusUsd + bronze;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-xl border border-[#2a2a35] bg-[#12121a] p-3.5 transition-all duration-200 hover:border-[#3a3a45]">
      <div className="mb-1.5 flex items-start gap-1.5">
        <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand" />
        <span className="text-[10px] font-semibold uppercase leading-tight tracking-wider text-[#9fa0b8]">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold leading-tight text-white">{value}</p>
      {sub && <p className="mt-1.5 truncate text-[10px] text-[#9fa0b8]">{sub}</p>}
    </div>
  );
}

export default function RankBonusPage() {
  const [data, setData] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A founder can have hundreds of directs; rendering them all is ~1,300 DOM
  // subtrees nobody scrolls through. Show the ones that matter, expand on ask.
  const [showAllDirects, setShowAllDirects] = useState(false);
  const [showAllLegs, setShowAllLegs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<Me>("/rank-bonus/me"));
    } catch (e: any) {
      setError(e?.message || "Couldn't load your rank");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a10]">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
        <p className="mt-3 text-sm text-[#9fa0b8]">Loading your rank…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a10] px-6 text-center">
        <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] p-3">
          <AlertCircle className="h-5 w-5 text-brand" />
        </div>
        <p className="max-w-sm text-sm text-[#9fa0b8]">{error}</p>
        <button
          onClick={load}
          className="rounded-full border border-[#2a2a35] bg-[#12121a] px-4 py-2 text-xs text-white transition hover:border-[#3a3a45]"
        >
          Try again
        </button>
      </div>
    );
  }

  const rank = data.user.rank;
  const rankColor = rank ? RANK_COLOR[rank] : "#6b6b80";
  const currentOrdinal = rank ? RANKS.indexOf(rank as RankKey) : -1;
  const bronzeNeeded =
    data.plan.tiers.find((t) => t.key === "Bronze")?.requiredActiveDirects ?? 5;
  const inactiveDirects = data.directs.filter((d) => !d.active);

  // Active first — they're the ones that count toward Bronze — then the most
  // recent joiners, who are the likeliest to still convert.
  const sortedDirects = [...data.directs].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime();
  });
  const visibleDirects = showAllDirects
    ? sortedDirects
    : sortedDirects.slice(0, DIRECTS_PREVIEW);

  // Legs are only interesting for the rank they carry, so rank-bearing legs
  // sort first, then the biggest.
  const sortedLegs = [...data.legs].sort((a, b) => {
    const ra = a.topRank ? RANKS.indexOf(a.topRank as RankKey) : -1;
    const rb = b.topRank ? RANKS.indexOf(b.topRank as RankKey) : -1;
    if (ra !== rb) return rb - ra;
    return b.size - a.size;
  });
  const rankedLegs = sortedLegs.filter((l) => l.topRank).length;
  const visibleLegs = showAllLegs ? sortedLegs : sortedLegs.slice(0, LEGS_PREVIEW);

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a10]">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/15 bg-gradient-to-br from-brand/15 to-brand/[0.02]">
              <Trophy className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h1 className="text-2xl font-black leading-none tracking-tight text-white">
                Rank Bonus
              </h1>
              <p className="mt-1.5 text-sm text-[#9fa0b8]">
                Monthly bonus for building an active NetworkChain team.
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#2a2a35] bg-[#12121a] px-3.5 text-xs text-[#9fa0b8] transition hover:border-[#3a3a45] hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {/* ── Your standing ──────────────────────────────────────── */}
        <div
          className="relative mb-4 overflow-hidden rounded-2xl border p-5"
          style={{
            borderColor: `${rankColor}40`,
            background: `linear-gradient(135deg, ${rankColor}14 0%, rgba(18,18,26,0) 60%)`,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9fa0b8]">
                Your rank
              </div>
              <div
                className="mt-1 text-3xl font-black tracking-tight"
                style={{ color: rankColor }}
              >
                {rank || "Unranked"}
              </div>
              <p className="mt-1.5 max-w-md text-[12px] text-[#9fa0b8]">
                {rank
                  ? `Pays ${money(payoutFor(data.plan, rank))} every month you hold it.`
                  : `Reach Bronze with ${bronzeNeeded} active directs to start earning.`}
              </p>
            </div>

            {rank && (
              <div className="rounded-xl border border-[#2a2a35] bg-[#12121a]/80 px-4 py-3 text-right">
                <div className="text-[10px] uppercase tracking-wider text-[#9fa0b8]">
                  Monthly bonus
                </div>
                <div className="text-2xl font-bold text-white">
                  {money(payoutFor(data.plan, rank))}
                </div>
              </div>
            )}
          </div>

          {/* Own subscription gate — the thing that silently blocks everything */}
          {!data.subscription.active && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-[13px] font-medium text-amber-300">
                  Your own subscription isn&apos;t active
                </p>
                <p className="mt-0.5 text-[12px] text-amber-200/70">
                  {data.subscription.reason === "free_month_only"
                    ? "You're on the free first month. Rank bonuses start once your first paid cycle goes through."
                    : "You need an active paid NetworkChain subscription to earn a rank bonus, no matter how your team performs."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={Wallet}
            label="Earned to date"
            value={money(data.lifetimeUsd)}
            sub="rank bonuses paid"
          />
          <StatCard
            icon={Users}
            label="Active directs"
            value={`${data.activeDirects}/${data.user.directsCount}`}
            sub={`${bronzeNeeded} needed for Bronze`}
          />
          <StatCard
            icon={GitBranch}
            label="Team size"
            value={data.user.downlineCount.toLocaleString()}
            sub="all levels"
          />
          <StatCard
            icon={TrendingUp}
            label="This month"
            value={periodLabel(data.currentPeriodKey)}
            sub={`settles ${nextMonthLabel(data.currentPeriodKey)} 1st`}
          />
        </div>

        {/* ── Next rank ──────────────────────────────────────────── */}
        {data.nextRank && (
          <div className="mb-4 rounded-2xl border border-[#2a2a35] bg-[#12121a] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-white">
                Next up: {data.nextRank.target}
              </h2>
              <span className="text-[12px] text-[#9fa0b8]">
                worth {money(payoutFor(data.plan, data.nextRank.target))}/month
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#9fa0b8]">
              {data.nextRank.requirement}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#0a0a10]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (data.nextRank.have / Math.max(1, data.nextRank.need)) * 100
                    )}%`,
                    background: `linear-gradient(90deg, #FFC200, #FFA800)`,
                  }}
                />
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                {data.nextRank.have}
                <span className="text-[#6b6b80]">/{data.nextRank.need}</span>
              </span>
            </div>
            {data.nextRank.have < data.nextRank.need && (
              <p className="mt-2.5 text-[12px] text-[#6b6b80]">
                {data.nextRank.need - data.nextRank.have} more to go.
                {inactiveDirects.length > 0 &&
                  data.nextRank.target === "Bronze" &&
                  ` You have ${inactiveDirects.length} direct${
                    inactiveDirects.length > 1 ? "s" : ""
                  } whose subscription has lapsed — reactivating them counts.`}
              </p>
            )}
          </div>
        )}

        {/* ── The ladder ─────────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-[#2a2a35] bg-[#12121a] p-5">
          <h2 className="mb-3 text-[15px] font-semibold text-white">
            How the ranks work
          </h2>
          <div className="space-y-2">
            {data.plan.tiers.map((t, i) => {
              const held = currentOrdinal >= i;
              const isCurrent = currentOrdinal === i;
              const color = RANK_COLOR[t.key];
              return (
                <div
                  key={t.key}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
                    isCurrent
                      ? "border-brand/30 bg-brand/[0.05]"
                      : "border-[#2a2a35]/60 bg-[#0a0a10]"
                  }`}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      background: held ? color : "#1a1a22",
                      color: held ? "#000" : "#6b6b80",
                    }}
                  >
                    {held ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: held ? color : "#c7c7da" }}
                      >
                        {t.key}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
                          You are here
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#9fa0b8]">
                      {t.key === "Bronze"
                        ? `${t.requiredActiveDirects ?? bronzeNeeded} directs with an active subscription`
                        : `A ${RANKS[i - 1]} in ${t.requiredLegs ?? 0} separate legs`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-bold text-white">
                      {money(payoutFor(data.plan, t.key))}
                    </div>
                    <div className="text-[10px] text-[#6b6b80]">per month</div>
                  </div>
                </div>
              );
            })}
          </div>
          {data.plan.bronzeStacks && (
            <p className="mt-3 text-[11px] leading-relaxed text-[#6b6b80]">
              Bronze pays on top of every higher rank, so the amounts above are
              what you actually receive. You must hold an active subscription
              yourself to be paid.
            </p>
          )}
        </div>

        {/* ── Your team ──────────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-[#2a2a35] bg-[#12121a] p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-white">
              Your direct referrals
            </h2>
            <span className="text-[12px] text-[#9fa0b8]">
              {data.activeDirects} of {data.directs.length} active
            </span>
          </div>

          {data.directs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2a2a35] py-10 text-center">
              <p className="text-[13px] text-[#9fa0b8]">
                You haven&apos;t referred anyone yet.
              </p>
              <p className="mt-1 text-[11px] text-[#6b6b80]">
                {bronzeNeeded} active directs unlocks Bronze.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleDirects.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-xl border border-[#2a2a35]/50 bg-[#0a0a10] px-3.5 py-2.5"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      d.active
                        ? "bg-gradient-to-br from-brand to-brand-2 text-brand-foreground"
                        : "bg-[#1a1a22] text-[#6b6b80]"
                    }`}
                  >
                    {(d.name || d.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-white">
                      {d.name || d.email || "—"}
                    </div>
                    <div className="truncate text-[11px] text-[#6b6b80]">
                      Joined {fmtDate(d.joinedAt)}
                    </div>
                  </div>
                  {d.rank && (
                    <span
                      className="hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline"
                      style={{
                        color: RANK_COLOR[d.rank],
                        background: `${RANK_COLOR[d.rank]}1f`,
                      }}
                    >
                      {d.rank}
                    </span>
                  )}
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      d.active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-[#1a1a22] text-[#6b6b80]"
                    }`}
                    title={
                      d.active
                        ? "Counts toward your rank"
                        : "Subscription not active — doesn't count"
                    }
                  >
                    {d.active ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {d.active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}

              {sortedDirects.length > DIRECTS_PREVIEW && (
                <button
                  onClick={() => setShowAllDirects((v) => !v)}
                  className="mt-1 w-full rounded-xl border border-[#2a2a35]/50 py-2.5 text-[12px] text-[#9fa0b8] transition hover:border-[#3a3a45] hover:text-white"
                >
                  {showAllDirects
                    ? "Show less"
                    : `Show all ${sortedDirects.length.toLocaleString()}`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Legs ───────────────────────────────────────────────── */}
        {data.legs.length > 0 && currentOrdinal >= 0 && (
          <div className="mb-4 rounded-2xl border border-[#2a2a35] bg-[#12121a] p-5">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-white">Your legs</h2>
              <span className="text-[12px] text-[#9fa0b8]">
                {rankedLegs > 0
                  ? `${rankedLegs} of ${sortedLegs.length} carry a rank`
                  : "highest rank in each branch"}
              </span>
            </div>
            <p className="mb-3 text-[11px] text-[#6b6b80]">
              Ranks above Bronze need a qualifier in several separate legs — one
              deep leg can&apos;t carry you on its own.
            </p>
            <div className="space-y-1.5">
              {visibleLegs.map((l) => (
                <div
                  key={l.legHead.id}
                  className="flex items-center gap-3 rounded-xl border border-[#2a2a35]/50 bg-[#0a0a10] px-3.5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-white">
                      {l.legHead.name || l.legHead.email || "—"}
                    </div>
                    <div className="text-[11px] text-[#6b6b80]">
                      {l.size.toLocaleString()} in this leg
                    </div>
                  </div>
                  {l.topRank ? (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{
                        color: RANK_COLOR[l.topRank],
                        background: `${RANK_COLOR[l.topRank]}1f`,
                      }}
                    >
                      {l.topRank}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#1a1a22] px-2.5 py-0.5 text-[11px] text-[#6b6b80]">
                      No rank yet
                    </span>
                  )}
                </div>
              ))}

              {sortedLegs.length > LEGS_PREVIEW && (
                <button
                  onClick={() => setShowAllLegs((v) => !v)}
                  className="mt-1 w-full rounded-xl border border-[#2a2a35]/50 py-2.5 text-[12px] text-[#9fa0b8] transition hover:border-[#3a3a45] hover:text-white"
                >
                  {showAllLegs
                    ? "Show less"
                    : `Show all ${sortedLegs.length.toLocaleString()} legs`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── History ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#2a2a35] bg-[#12121a] p-5">
          <h2 className="mb-3 text-[15px] font-semibold text-white">
            Bonus history
          </h2>
          {data.history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2a2a35] py-10 text-center">
              <p className="text-[13px] text-[#9fa0b8]">No bonuses yet.</p>
              <p className="mt-1 text-[11px] text-[#6b6b80]">
                Each month is settled on the 1st of the month after it.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.history.map((h) => (
                <div
                  key={h.periodKey}
                  className="flex items-center gap-3 rounded-xl border border-[#2a2a35]/50 bg-[#0a0a10] px-3.5 py-2.5"
                >
                  <span className="w-20 shrink-0 text-[12px] text-[#9fa0b8]">
                    {periodLabel(h.periodKey)}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      color: RANK_COLOR[h.rank] || "#c7c7da",
                      background: `${RANK_COLOR[h.rank] || "#c7c7da"}1f`,
                    }}
                  >
                    {h.rank}
                  </span>
                  <span className="flex-1 text-right text-[13px] font-semibold tabular-nums text-white">
                    {money(h.bonusUsd)}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      h.payoutStatus === "paid"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : h.payoutStatus === "failed"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-[#1a1a22] text-[#6b6b80]"
                    }`}
                  >
                    {h.payoutStatus === "paid"
                      ? "Paid"
                      : h.payoutStatus === "failed"
                      ? "Failed"
                      : h.payoutStatus === "skipped_dry_run"
                      ? "Not yet paid"
                      : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
