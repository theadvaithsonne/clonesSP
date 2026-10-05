"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart3, Eye, Clock, Users, TrendingUp, CheckCircle2,
  Play, FileText, Video, Radio, Quote, Loader2, AlertCircle,
  Timer, Zap, Activity, Trophy, ArrowUpRight, Smartphone, Monitor, Tablet,
  User,
} from "lucide-react";
import {
  fetchOverview, fetchLeaderboard,
  type OverviewData, type LeaderboardData, type LeaderboardItem,
  type ContentTypeStats, type TopAffiliate, type TopContentItem, type LeaderboardAffiliate,
} from "@/lib/content-analytics-api";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "video", label: "Long Form Videos", icon: Video },
  { id: "drop", label: "Drops", icon: Play },
  { id: "article", label: "Articles", icon: FileText },
  { id: "recording", label: "Recorded Streams", icon: Radio },
  { id: "testimonial", label: "Testimonials", icon: Quote },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DATE_RANGES = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "all", label: "All time" },
] as const;
type DateRangeId = (typeof DATE_RANGES)[number]["id"];

function getDateRange(id: DateRangeId): { from?: string; to?: string } {
  if (id === "all") return {};
  const days = id === "7d" ? 7 : id === "30d" ? 30 : 90;
  const from = new Date(Date.now() - days * 86400000).toISOString();
  return { from };
}

function fmtTime(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function fmtNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

const TC: Record<string, { label: string; icon: any; accent: string }> = {
  video:       { label: "Long Form Videos", icon: Video,    accent: "#a78bfa" },
  drop:        { label: "Drops",            icon: Play,     accent: "#fbbf24" },
  article:     { label: "Articles",         icon: FileText, accent: "#60a5fa" },
  recording:   { label: "Recorded Streams", icon: Radio,    accent: "#f87171" },
  testimonial: { label: "Testimonials",     icon: Quote,    accent: "#34d399" },
};

const DEVICE_ICONS: Record<string, any> = { mobile: Smartphone, desktop: Monitor, tablet: Tablet };
const MEDALS = ["🥇", "🥈", "🥉"];

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#2a2a35] bg-[#12121a] px-3 py-2.5 hover:border-[#3a3a45] transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-brand" />
        <span className="text-[10px] text-[#9fa0b8] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-white leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-[#9fa0b8] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Content Type Card (Overview) ───────────────────────────────────
function ContentTypeCard({ data, onClick }: { data: ContentTypeStats; onClick: () => void }) {
  const c = TC[data.contentType] || TC.video;
  const Icon = c.icon;
  const isVid = ["video", "drop", "recording", "testimonial"].includes(data.contentType);
  const time = isVid ? data.totalWatchTime : data.totalReadTime;
  return (
    <button onClick={onClick} className="w-full text-left rounded-lg border border-[#2a2a35] bg-[#12121a] px-3 py-2.5 hover:border-[#3a3a45] transition-all group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-[#0a0a10]"><Icon className="h-3.5 w-3.5" style={{ color: c.accent }} /></div>
          <span className="text-[12px] font-semibold text-white">{c.label}</span>
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-[#9fa0b8] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          { l: "Sessions", v: fmtNum(data.totalSessions) },
          { l: "Viewers", v: fmtNum(data.uniqueViewers) },
          { l: isVid ? "Watch" : "Read", v: fmtTime(time) },
          { l: "Done", v: `${data.avgCompletion}%` },
        ].map(({ l, v }) => (
          <div key={l}><p className="text-[9px] text-[#9fa0b8]">{l}</p><p className="text-sm font-bold text-white">{v}</p></div>
        ))}
      </div>
      <div className="mt-2 h-1 rounded-full bg-[#0a0a10] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(data.avgCompletion, 100)}%`, background: c.accent }} />
      </div>
    </button>
  );
}

// ── Top Content Row (Overview) ─────────────────────────────────────
function TopContentRow({ item, rank }: { item: TopContentItem; rank: number }) {
  const c = TC[item.contentType] || TC.video;
  const Icon = c.icon;
  const isVid = ["video", "drop", "recording", "testimonial"].includes(item.contentType);
  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-[#0a0a10] transition-colors">
      <span className="text-base w-6 text-center">{MEDALS[rank] || <span className="text-[11px] font-mono text-[#9fa0b8]">{rank + 1}</span>}</span>
      <div className="p-1.5 rounded-md bg-[#0a0a10]"><Icon className="h-3.5 w-3.5" style={{ color: c.accent }} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.contentTitle || "Untitled"}</p>
        <p className="text-[10px] text-[#9fa0b8]">{c.label}</p>
      </div>
      <div className="text-right mr-3">
        <p className="text-sm font-bold text-white">{fmtNum(item.totalSessions)}</p>
        <p className="text-[10px] text-[#9fa0b8]">sessions</p>
      </div>
      <div className="text-right mr-3">
        <p className="text-sm font-bold text-white">{fmtNum(item.uniqueViewers)}</p>
        <p className="text-[10px] text-[#9fa0b8]">viewers</p>
      </div>
      <div className="text-right w-16">
        <p className="text-sm font-bold text-white">{fmtTime(isVid ? item.totalWatchTime : item.totalReadTime)}</p>
        <p className="text-[10px] text-[#9fa0b8]">{isVid ? "watch" : "read"}</p>
      </div>
    </div>
  );
}

// ── Affiliate Row ──────────────────────────────────────────────────
function AffiliateRow({ aff, rank }: { aff: TopAffiliate | LeaderboardAffiliate; rank: number }) {
  const name = aff.name || "?";
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const sessions = "totalSessions" in aff ? aff.totalSessions : (aff as LeaderboardAffiliate).sessions;
  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-[#0a0a10] transition-colors">
      <span className={`text-[11px] font-mono w-5 text-right ${rank <= 3 ? "text-brand font-bold" : "text-[#9fa0b8]"}`}>{rank}</span>
      {aff.profilePicture
        ? <img src={aff.profilePicture} alt="" className="h-8 w-8 rounded-full object-cover" />
        : <div className="h-8 w-8 rounded-full bg-[#0a0a10] border border-[#2a2a35] flex items-center justify-center text-[10px] font-bold text-[#9fa0b8]">{initials}</div>
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        {aff.email && <p className="text-[11px] text-[#9fa0b8] truncate">{aff.email}</p>}
      </div>
      <div className="text-right mr-2">
        <p className="text-sm font-bold text-white">{fmtNum(sessions)}</p>
        <p className="text-[10px] text-[#9fa0b8]">sessions</p>
      </div>
      <div className="text-right w-14">
        <p className="text-sm font-bold text-white">{aff.avgCompletion}%</p>
        <p className="text-[10px] text-[#9fa0b8]">completion</p>
      </div>
    </div>
  );
}

// ── Leaderboard Row ────────────────────────────────────────────────
function LeaderboardRow({ item, rank, maxSessions, isArticle }: {
  item: LeaderboardItem; rank: number; maxSessions: number; isArticle: boolean;
}) {
  const barW = maxSessions > 0 ? Math.max(4, (item.totalSessions / maxSessions) * 100) : 0;
  const DevIcon = DEVICE_ICONS[item.topDevice] || Monitor;
  return (
    <div className="group flex items-center gap-3 py-3 px-4 hover:bg-[#0a0a10]/80 transition-colors border-b border-[#2a2a35]/40 last:border-b-0">
      <span className="text-base w-6 text-center flex-shrink-0">
        {MEDALS[rank] || <span className="text-[11px] font-mono text-[#9fa0b8]">{rank + 1}</span>}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.contentTitle || "Untitled"}</p>
        <div className="mt-1.5 h-1 rounded-full bg-[#1a1a22] overflow-hidden">
          <div className="h-full rounded-full bg-brand/60 transition-all" style={{ width: `${barW}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right w-14">
          <p className="text-sm font-bold text-white">{fmtNum(item.totalSessions)}</p>
          <p className="text-[10px] text-[#9fa0b8]">sessions</p>
        </div>
        <div className="text-right w-14">
          <p className="text-sm font-bold text-white">{fmtNum(item.uniqueViewersCount)}</p>
          <p className="text-[10px] text-[#9fa0b8]">viewers</p>
        </div>
        <div className="text-right w-16">
          <p className="text-sm font-bold text-white">{fmtTime(isArticle ? item.avgReadTime : item.avgWatchTime)}</p>
          <p className="text-[10px] text-[#9fa0b8]">avg {isArticle ? "read" : "watch"}</p>
        </div>
        <div className="text-right w-14">
          <p className={`text-sm font-bold ${item.avgCompletion >= 70 ? "text-green-400" : item.avgCompletion >= 40 ? "text-amber-400" : "text-red-400"}`}>
            {item.avgCompletion}%
          </p>
          <p className="text-[10px] text-[#9fa0b8]">done</p>
        </div>
        {item.affiliateDriven > 0 && (
          <div className="text-right w-12">
            <p className="text-sm font-bold text-brand">{item.affiliatePercent}%</p>
            <p className="text-[10px] text-[#9fa0b8]">affil</p>
          </div>
        )}
        <DevIcon className="w-3.5 h-3.5 text-[#9fa0b8]/50 hidden sm:block" title={item.topDevice} />
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────
function EmptyState({ contentType }: { contentType?: string }) {
  const c = contentType ? TC[contentType] : null;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-xl bg-[#12121a] border border-[#2a2a35] mb-4">
        {c ? <c.icon className="h-8 w-8 text-[#9fa0b8]" /> : <Activity className="h-8 w-8 text-[#9fa0b8]" />}
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">No Analytics Yet</h3>
      <p className="text-sm text-[#9fa0b8] max-w-xs">
        Share your content via affiliate links. Engagement data will appear here as viewers interact.
      </p>
    </div>
  );
}

// ── Leaderboard View (per content type tab) ────────────────────────
function LeaderboardView({ contentType, dateRange, myPostsOnly }: { contentType: string; dateRange: DateRangeId; myPostsOnly: boolean }) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("totalSessions");

  const c = TC[contentType] || TC.video;
  const isArticle = contentType === "article";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const range = getDateRange(dateRange);
        const r = await fetchLeaderboard(contentType, { ...range, sortBy, limit: 50, myPostsOnly });
        if (!cancelled) setData(r);
      } catch (e: any) { if (!cancelled) setError(e.message || "Failed to load"); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [contentType, dateRange, sortBy, myPostsOnly]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;
  if (error) return <div className="flex flex-col items-center py-20 gap-2"><AlertCircle className="h-6 w-6 text-red-400" /><p className="text-sm text-red-400">{error}</p></div>;
  if (!data || data.items.length === 0) return <EmptyState contentType={contentType} />;

  const agg = data.aggregated;
  const maxS = data.items[0]?.totalSessions || 1;
  const sortOpts = [
    { key: "totalSessions", label: "Sessions" },
    { key: "uniqueViewers", label: "Viewers" },
    { key: "totalWatchTime", label: isArticle ? "Read Time" : "Watch Time" },
    { key: "avgCompletion", label: "Completion" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Eye} label="Total Sessions" value={fmtNum(agg.totalSessions)} />
        <StatCard icon={Users} label={isArticle ? "Unique Readers" : "Unique Viewers"} value={fmtNum(agg.uniqueViewers)} />
        <StatCard icon={isArticle ? Timer : Clock} label={isArticle ? "Total Read Time" : "Total Watch Time"} value={fmtTime(isArticle ? agg.totalReadTime : agg.totalWatchTime)} />
        <StatCard icon={TrendingUp} label="Avg Completion" value={`${agg.avgCompletion}%`} />
      </div>

      {/* Leaderboard */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-brand" />
            <h2 className="text-[13px] font-semibold text-white">Top Performing {c.label}</h2>
            <span className="text-[11px] text-[#9fa0b8] ml-1">({data.items.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            {sortOpts.map(o => (
              <button key={o.key} onClick={() => setSortBy(o.key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  sortBy === o.key
                    ? "bg-brand/15 text-brand ring-1 ring-brand/30"
                    : "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] overflow-hidden">
          {data.items.map((item, i) => (
            <LeaderboardRow key={item.contentId} item={item} rank={i} maxSessions={maxS} isArticle={isArticle} />
          ))}
        </div>
      </div>

      {/* Top Affiliates */}
      {data.topAffiliates.length > 0 && (
        <div>
          <h2 className="text-[11px] font-semibold text-[#9fa0b8] uppercase tracking-wider mb-3">Top Affiliates — {c.label}</h2>
          <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] overflow-hidden divide-y divide-[#2a2a35]/40">
            {data.topAffiliates.map((a, i) => <AffiliateRow key={a.affiliateId} aff={a} rank={i + 1} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export function ContentAnalyticsPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [dateRange, setDateRange] = useState<DateRangeId>("all");
  const [myPostsOnly, setMyPostsOnly] = useState(false);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try { setLoading(true); setError(null);
        const range = getDateRange(dateRange);
        const r = await fetchOverview(range.from, range.to, myPostsOnly);
        if (!c) setData(r);
      } catch (e: any) { if (!c) setError(e.message || "Failed to load"); }
      finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, [dateRange, myPostsOnly]);

  const totals = useMemo(() => {
    const bt = data?.byType || [];
    if (!bt.length) return { s: 0, v: 0, w: 0, r: 0, c: 0 };
    return {
      s: bt.reduce((a, d) => a + d.totalSessions, 0),
      v: bt.reduce((a, d) => a + d.uniqueViewers, 0),
      w: bt.reduce((a, d) => a + d.totalWatchTime, 0),
      r: bt.reduce((a, d) => a + d.totalReadTime, 0),
      c: Math.round(bt.reduce((a, d) => a + d.avgCompletion, 0) / bt.length),
    };
  }, [data]);

  if (loading && tab === "overview") return (
    <div className="flex items-center justify-center h-full min-h-[400px]"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
  );
  if (error && tab === "overview") return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="h-6 w-6 text-red-400" /><p className="text-sm text-red-400">{error}</p>
        <button onClick={() => window.location.reload()} className="text-xs text-brand hover:underline">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col bg-[#0a0a10] min-h-screen">
      {/* Header */}
      <div className="flex-none px-5 pt-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#12121a] border border-[#2a2a35]">
              <BarChart3 className="h-4 w-4 text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Content Analytics</h1>
              <p className="text-[11px] text-[#9fa0b8]">
                {myPostsOnly ? "Track engagement across your content" : "Track engagement across all your content"}
              </p>
            </div>
          </div>

          {/* My Posts toggle + Date range */}
          <div className="flex items-center gap-3">
            {/* My Posts Toggle */}
            <button
              onClick={() => setMyPostsOnly(!myPostsOnly)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 border ${
                myPostsOnly
                  ? "bg-brand/15 text-brand border-brand/30 shadow-[0_0_12px] shadow-brand/10"
                  : "bg-[#12121a] text-[#9fa0b8] border-[#2a2a35] hover:text-white hover:border-[#3a3a45]"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>My Posts</span>
              <div className={`relative w-7 h-4 rounded-full transition-colors duration-200 ${
                myPostsOnly ? "bg-brand" : "bg-[#2a2a35]"
              }`}>
                <div className={`absolute top-0.5 h-3 w-3 rounded-full transition-all duration-200 ${
                  myPostsOnly
                    ? "left-3.5 bg-[#0a0a10]"
                    : "left-0.5 bg-[#9fa0b8]"
                }`} />
              </div>
            </button>

            {/* Date range selector */}
            <div className="flex items-center gap-0.5">
              {DATE_RANGES.map(r => (
                <button key={r.id} onClick={() => setDateRange(r.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    dateRange === r.id
                      ? "bg-brand/15 text-brand ring-1 ring-brand/30"
                      : "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-5 border-b border-[#2a2a35]">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 pb-2.5 text-[13px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  active ? "text-brand border-brand" : "text-[#9fa0b8] border-transparent hover:text-white"
                }`}>
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {tab === "overview" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard icon={Eye} label="Total Sessions" value={fmtNum(totals.s)} />
              <StatCard icon={Users} label="Unique Viewers" value={fmtNum(totals.v)} />
              <StatCard icon={Clock} label="Watch Time" value={fmtTime(totals.w)} sub={totals.r > 0 ? `+ ${fmtTime(totals.r)} read time` : undefined} />
              <StatCard icon={TrendingUp} label="Avg Completion" value={`${totals.c}%`} />
            </div>

            {data?.byType?.length ? (
              <>
                <div>
                  <h2 className="text-[11px] font-semibold text-[#9fa0b8] uppercase tracking-wider mb-2">By Content Type</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.byType.map(d => <ContentTypeCard key={d.contentType} data={d} onClick={() => setTab(d.contentType as TabId)} />)}
                  </div>
                </div>

                {/* Top Performing Content */}
                {data.topContent?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4 text-brand" />
                      <h2 className="text-[11px] font-semibold text-[#9fa0b8] uppercase tracking-wider">Top Performing Content</h2>
                    </div>
                    <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] overflow-hidden divide-y divide-[#2a2a35]/40">
                      {data.topContent.map((item, i) => <TopContentRow key={`${item.contentId}`} item={item} rank={i} />)}
                    </div>
                  </div>
                )}

                {data.topAffiliates?.length > 0 && (
                  <div>
                    <h2 className="text-[11px] font-semibold text-[#9fa0b8] uppercase tracking-wider mb-2">Top Affiliates</h2>
                    <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] overflow-hidden divide-y divide-[#2a2a35]/40">
                      {data.topAffiliates.map((a, i) => <AffiliateRow key={a.affiliateId} aff={a} rank={i + 1} />)}
                    </div>
                  </div>
                )}
              </>
            ) : <EmptyState />}
          </div>
        ) : (
          <LeaderboardView contentType={tab} dateRange={dateRange} myPostsOnly={myPostsOnly} />
        )}
      </div>
    </div>
  );
}
