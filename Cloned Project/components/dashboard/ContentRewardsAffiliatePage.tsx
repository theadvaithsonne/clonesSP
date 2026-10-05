"use client";

import { useState, useEffect } from "react";
import {
  Gift, Loader2, Sparkles, Eye, Users, ExternalLink, ArrowRight,
} from "lucide-react";
import { fetchActiveCampaigns, type Campaign } from "@/lib/content-rewards-api";
import { getToken } from "@/lib/auth";

const PL: Record<string, string> = { instagram: "Instagram", youtube: "YouTube" };
const PC: Record<string, string> = { instagram: "#e1306c", youtube: "#ff0000" };

function fmtMoney(c: number, currency: "USD" | "INR" = "USD") {
  const sym = currency === "INR" ? "₹" : "$";
  return `${sym}${(c / 100).toFixed(2)}`;
}
function fmtNum(n: number) { return n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n); }

// Network Chains rewards URL — env-driven so local dev can point to localhost:3001
const NC_REWARDS_BASE = process.env.NEXT_PUBLIC_NC_REWARDS_URL || "https://networkchains.com/rewards";

/** Build NC rewards URL with token handoff so the user is auto-authenticated */
function ncRewardsUrl(campaignId?: string) {
  const token = getToken();
  const url = new URL(NC_REWARDS_BASE, window.location.origin);
  if (token) url.searchParams.set("token", token);
  if (campaignId) url.searchParams.set("campaign", campaignId);
  return url.toString();
}

// ── Discover Campaign Card ──
function DiscoverCampaignCard({ c }: { c: Campaign }) {
  const cur = c.currency || "USD";
  const sym = cur === "INR" ? "₹" : "$";

  const handleJoin = () => {
    window.open(ncRewardsUrl(c._id), "_blank", "noopener");
  };

  return (
    <div className="group rounded-2xl border border-[#2a2a35] bg-[#12121a] overflow-hidden hover:border-brand/30 transition-all hover:shadow-lg hover:shadow-brand/5">
      {/* Thumbnail Banner */}
      <div className="relative h-40 bg-gradient-to-br from-[#1a1a2e] to-[#0a0a10] overflow-hidden">
        {c.thumbnailUrl ? (
          <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand/5 to-brand/0">
            <Sparkles className="h-10 w-10 text-brand/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#12121a]/80 via-transparent to-transparent" />
        <div className="absolute top-2 right-2 flex gap-1">
          {c.platforms.map(p => (
            <span key={p} className="text-[8px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm" style={{ color: PC[p], background: `${PC[p]}25` }}>{PL[p]}</span>
          ))}
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand text-brand-foreground font-bold">{fmtMoney(c.ratePerThousand, cur)}/1K</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 backdrop-blur-sm text-white/80 font-medium">{cur}</span>
        </div>
      </div>
      {/* Info */}
      <div className="p-4">
        <h3 className="text-[15px] font-bold text-white mb-1 group-hover:text-brand transition-colors leading-snug">{c.title}</h3>
        {c.description && <p className="text-[11px] text-[#9fa0b8] line-clamp-2 mb-3 leading-relaxed">{c.description}</p>}
        <div className="flex items-center gap-3 text-[10px] mb-3">
          <span className="flex items-center gap-1 text-[#9fa0b8]"><Users className="h-3 w-3" />{c.totalParticipants || 0}</span>
          <span className="flex items-center gap-1 text-[#9fa0b8]"><Eye className="h-3 w-3" />{fmtNum(c.totalViews)}</span>
          <span className="flex items-center gap-1 text-[#34d399] font-semibold">{sym} {fmtMoney(c.budgetRemaining, cur).slice(1)} left</span>
        </div>
        {/* CTA — redirects to Network Chains */}
        <button onClick={handleJoin}
          className="w-full py-2 rounded-xl bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition flex items-center justify-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5" /> Join on NetworkChains
        </button>
      </div>
    </div>
  );
}

// ── Discover Page ──
export function ContentRewardsAffiliatePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchActiveCampaigns()
      .then(r => setCampaigns(r.campaigns))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full min-h-[400px]"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;

  return (
    <div className="flex flex-col bg-[#0a0a10] min-h-screen">
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#12121a] border border-[#2a2a35]"><Gift className="h-4 w-4 text-brand" /></div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Discover</h1>
              <p className="text-[11px] text-[#9fa0b8]">Explore campaigns & earn on NetworkChains</p>
            </div>
          </div>
          <a href={ncRewardsUrl()} target="_blank" rel="noopener"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/20 text-brand text-xs font-medium hover:bg-brand/20 transition">
            <ExternalLink className="h-3.5 w-3.5" /> Open Rewards Dashboard
          </a>
        </div>


      </div>

      <div className="px-5 py-4">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-center">
            <Sparkles className="h-8 w-8 text-[#9fa0b8]" />
            <h3 className="text-lg font-semibold text-white">No Active Campaigns</h3>
            <p className="text-sm text-[#9fa0b8]">Check back later for new opportunities.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map(c => <DiscoverCampaignCard key={c._id} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
