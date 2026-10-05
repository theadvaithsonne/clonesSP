"use client";
import { Building2, DollarSign, AlertTriangle, TrendingDown } from "lucide-react";
import type { WalletStats } from "@/lib/admin-api/wallets";

function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const Stat = ({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; icon: any;
  accent: "yellow" | "green" | "red" | "orange";
}) => {
  const palette: Record<string, { bg: string; border: string; text: string }> = {
    yellow: { bg: "bg-[#FBD10D]/5", border: "border-[#FBD10D]/15", text: "text-[#FBD10D]" },
    green:  { bg: "bg-green-500/5",  border: "border-green-500/15",  text: "text-green-400" },
    red:    { bg: "bg-red-500/5",    border: "border-red-500/15",    text: "text-red-400" },
    orange: { bg: "bg-orange-500/5", border: "border-orange-500/15", text: "text-orange-400" },
  };
  const p = palette[accent];
  return (
    <div className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-4 shadow-xl hover:border-[#3a3a4a] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`h-11 w-11 rounded-xl ${p.bg} border ${p.border} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${p.text}`} />
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1">{label}</p>
      <p className="text-2xl font-black text-white leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[#5a5a72] mt-1.5">{sub}</p>}
    </div>
  );
};

export function WalletStatsCards({ stats }: { stats: WalletStats | null }) {
  if (!stats) {
    // Skeleton
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-4 shadow-xl">
            <div className="h-11 w-11 rounded-xl bg-[#1a1a22] animate-pulse mb-3" />
            <div className="h-3 w-24 rounded bg-[#1a1a22] animate-pulse mb-2" />
            <div className="h-7 w-16 rounded bg-[#1a1a22] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <Stat
        label="Orgs with wallets"
        value={stats.totalOrgs.toLocaleString()}
        icon={Building2}
        accent="yellow"
      />
      <Stat
        label="Total balance"
        value={fmtCents(stats.totalBalance)}
        sub="across all wallets"
        icon={DollarSign}
        accent="green"
      />
      <Stat
        label="Outstanding debt"
        value={fmtCents(stats.totalDebt)}
        sub="across all wallets"
        icon={TrendingDown}
        accent="red"
      />
      <Stat
        label="Orgs with debt"
        value={stats.orgsWithDebt.toLocaleString()}
        icon={AlertTriangle}
        accent="orange"
      />
    </div>
  );
}
