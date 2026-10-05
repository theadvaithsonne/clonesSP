"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Trophy, DollarSign, Users, TrendingUp, Zap, Globe,
  Rocket, Loader2, AlertCircle, ChevronDown, Filter, Search,
  Building2, Earth, Clock, Tag, Award, ShoppingBag,
  UserCheck, Package, Coins, X, Download, ToggleLeft, ToggleRight,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { getRevenueNetworkData } from "@/lib/revenue-network-cache";
import {
  fetchAllDirectReferrals,
  fetchAllIndirectReferrals,
  fetchLeaderboardPage,
  fetchAllLeaderboard,
  fetchCategories,
  fetchAffiliateDetails,
  type DirectReferralItem,
  type IndirectReferralItem,
  type LeaderboardItem,
  type AffiliateInfo,
  type UnifiedLeaderboardRow,
  type AnalyticsRange,
  type UnilevelPlusSubscription,
  type PaginationInfo,
  type AffiliateItemStats,
} from "@/lib/affiliate-analytics-api";

// Rows rendered per page in the raw Affiliate Details table — keeps the
// DOM light when the API returns 900+ affiliates.
const DETAILS_PAGE_SIZE = 50;

/**
 * Slim shape for the raw affiliate-details table. The API returns a heavy
 * per-affiliate `stats` block (revenue/commissions/customers/etc.) that this
 * table never renders, so we map it away on fetch to keep ~900 rows light in
 * memory. The detail drawer fetches its own stats by userId, so nothing here
 * depends on the dropped fields.
 */
interface AffiliateDetailRow {
  userId: string;
  affiliateId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  profilePicture: string | null;
  joinedAt: string | null;
  subscription?: UnilevelPlusSubscription | null;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatRevenue(cents: number): string {
  const d = cents / 100;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(2)}M`;
  if (d >= 100_000) return `$${(d / 1_000).toFixed(1)}K`;
  return `$${d.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRevenueExact(cents: number): string {
  const d = cents / 100;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(2)}M`;
  if (d >= 100_000) return `$${(d / 1_000).toFixed(1)}K`;
  return `$${d.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "argentina": "AR",
  "armenia": "AM", "australia": "AU", "austria": "AT", "azerbaijan": "AZ",
  "bahamas": "BS", "bahrain": "BH", "bangladesh": "BD", "barbados": "BB",
  "belarus": "BY", "belgium": "BE", "belize": "BZ", "bhutan": "BT",
  "bolivia": "BO", "bosnia and herzegovina": "BA", "botswana": "BW",
  "brazil": "BR", "british indian ocean territory": "IO", "brunei": "BN",
  "bulgaria": "BG", "cambodia": "KH", "cameroon": "CM", "canada": "CA",
  "chile": "CL", "china": "CN", "colombia": "CO", "costa rica": "CR",
  "croatia": "HR", "cuba": "CU", "cyprus": "CY", "czech republic": "CZ",
  "czechia": "CZ", "denmark": "DK", "dominican republic": "DO",
  "ecuador": "EC", "egypt": "EG", "el salvador": "SV", "estonia": "EE",
  "ethiopia": "ET", "fiji": "FJ", "finland": "FI", "france": "FR",
  "georgia": "GE", "germany": "DE", "ghana": "GH", "greece": "GR",
  "guatemala": "GT", "guyana": "GY", "haiti": "HT", "honduras": "HN",
  "hong kong": "HK", "hungary": "HU", "iceland": "IS", "india": "IN",
  "indonesia": "ID", "iran": "IR", "iraq": "IQ", "ireland": "IE",
  "israel": "IL", "italy": "IT", "ivory coast": "CI", "jamaica": "JM",
  "japan": "JP", "jordan": "JO", "kazakhstan": "KZ", "kenya": "KE",
  "kuwait": "KW", "latvia": "LV", "lebanon": "LB", "libya": "LY",
  "lithuania": "LT", "luxembourg": "LU", "malaysia": "MY", "maldives": "MV",
  "malta": "MT", "mexico": "MX", "moldova": "MD", "mongolia": "MN",
  "montenegro": "ME", "morocco": "MA", "mozambique": "MZ", "myanmar": "MM",
  "namibia": "NA", "nepal": "NP", "netherlands": "NL", "new zealand": "NZ",
  "nicaragua": "NI", "nigeria": "NG", "north macedonia": "MK", "norway": "NO",
  "oman": "OM", "pakistan": "PK", "palestine": "PS", "panama": "PA",
  "paraguay": "PY", "peru": "PE", "philippines": "PH", "poland": "PL",
  "portugal": "PT", "qatar": "QA", "romania": "RO", "russia": "RU",
  "rwanda": "RW", "saudi arabia": "SA", "senegal": "SN", "serbia": "RS",
  "singapore": "SG", "slovakia": "SK", "slovenia": "SI", "south africa": "ZA",
  "south korea": "KR", "spain": "ES", "sri lanka": "LK", "sudan": "SD",
  "sweden": "SE", "switzerland": "CH", "syria": "SY", "taiwan": "TW",
  "tanzania": "TZ", "thailand": "TH", "trinidad and tobago": "TT",
  "tunisia": "TN", "turkey": "TR", "turkmenistan": "TM", "uganda": "UG",
  "ukraine": "UA", "united arab emirates": "AE", "united kingdom": "GB",
  "united states": "US", "uruguay": "UY", "uzbekistan": "UZ",
  "venezuela": "VE", "vietnam": "VN", "yemen": "YE", "zambia": "ZM",
  "zimbabwe": "ZW",
};

function getCountryFlag(nameOrCode: string | null): string {
  if (!nameOrCode) return "🌍";
  // If already a 2-letter code, use directly
  if (nameOrCode.length === 2) {
    const cp = [...nameOrCode.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
    return String.fromCodePoint(...cp);
  }
  // Look up full country name
  const iso = COUNTRY_NAME_TO_CODE[nameOrCode.toLowerCase()];
  if (!iso) return "🌍";
  const cp = [...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...cp);
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function getTier(revenueCents: number): { label: string; color: string; bg: string } {
  const d = revenueCents / 100;
  if (d >= 50_000) return { label: "DIAMOND", color: "#b9f2ff", bg: "rgba(185,242,255,0.12)" };
  if (d >= 25_000) return { label: "PLATINUM", color: "#e5e4e2", bg: "rgba(229,228,226,0.12)" };
  if (d >= 5_000) return { label: "GOLD", color: "#ffd700", bg: "rgba(255,215,0,0.12)" };
  if (d >= 2_500) return { label: "SILVER", color: "#c0c0c0", bg: "rgba(192,192,192,0.12)" };
  if (d >= 500) return { label: "BRONZE", color: "#cd7f32", bg: "rgba(205,127,50,0.12)" };
  return { label: "STARTER", color: "#9fa0b8", bg: "rgba(159,160,184,0.08)" };
}

type PageMode = "leaderboard" | "my-network";
type NetworkView = "direct" | "indirect" | "combined";
type OfficeScope = "current" | "all";
type SortKey = "revenue" | "sales" | "businesses" | "commissions" | "joined";

const RANGE_OPTIONS: { key: AnalyticsRange; label: string }[] = [
  { key: "1d", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "all", label: "All Time" },
];

// ─── Stat Card ────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] p-3.5 hover:border-[#3a3a45] transition-all duration-200 flex flex-col justify-between min-h-[110px] sm:min-h-[120px] min-w-0">
      <div>
        <div className="flex items-start gap-1.5 mb-1.5 h-8 sm:h-9 min-w-0">
          <Icon className="h-3.5 w-3.5 text-brand flex-shrink-0 mt-0.5" />
          <span className="text-[10px] text-[#9fa0b8] uppercase tracking-wider font-semibold leading-tight line-clamp-2">
            {label}
          </span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-white leading-tight">
          {value}
        </p>
      </div>
      {sub && (
        <p className="text-[10px] text-[#9fa0b8] mt-1.5 truncate" title={sub}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Podium Card ──────────────────────────────────────────────────

function PodiumCard({
  item,
  rank,
  isCenter,
  isLeaderboardMode,
  onClick,
}: {
  item: UnifiedLeaderboardRow;
  rank: number;
  isCenter: boolean;
  isLeaderboardMode: boolean;
  onClick?: () => void;
}) {
  const initials = getInitials(item.name);
  const flag = getCountryFlag(item.country);

  const rankColors: Record<number, { ring: string; border: string; glow: string }> = {
    1: { ring: "#D4A844", border: "rgba(212,168,68,0.50)", glow: "0 0 50px rgba(212,168,68,0.10), 0 0 15px rgba(212,168,68,0.06)" },
    2: { ring: "#A8B4C0", border: "rgba(168,180,192,0.40)", glow: "none" },
    3: { ring: "#CD7F32", border: "rgba(205,127,50,0.40)", glow: "none" },
  };
  const rc = rankColors[rank] || rankColors[3];

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col items-center rounded-2xl ${
        onClick ? "cursor-pointer" : ""
      } ${rank === 1 ? "pt-10 pb-7 px-7 z-10" : rank === 2 ? "pt-9 pb-6 px-6" : "pt-8 pb-5 px-4"
        }`}
      style={{
        background: "#12121a",
        border: `1px solid ${rc.border}`,
        boxShadow: rc.glow,
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-[10%] right-[10%] h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${rc.ring}90, transparent)` }}
      />

      {/* Rank badge */}
      {isCenter ? (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1 rounded-full"
          style={{
            background: "linear-gradient(135deg, rgba(212,168,68,0.22), rgba(212,168,68,0.10))",
            border: "1px solid rgba(212,168,68,0.45)",
          }}
        >
          <Trophy className="h-3 w-3 text-[#D4A844]" />
          <span className="text-[10px] font-bold text-[#D4A844] uppercase tracking-wider">
            Current Leader
          </span>
        </div>
      ) : (
        <div
          className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-0.5 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${rc.ring}25, ${rc.ring}10)`,
            border: `1px solid ${rc.ring}50`,
          }}
        >
          <span className="text-xs">{rank === 2 ? "🥈" : "🥉"}</span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: rc.ring }}
          >
            Rank {String(rank).padStart(2, "0")}
          </span>
        </div>
      )}

      {/* Avatar */}
      <div className={`relative mb-4 ${isCenter ? "mt-3" : "mt-2"}`}>
        <div
          className={`rounded-full ${rank === 1 ? "p-[3px]" : "p-[2px]"}`}
          style={{
            background: `linear-gradient(135deg, ${rc.ring}90, ${rc.ring}30)`,
          }}
        >
          {item.profilePicture ? (
            <img
              src={item.profilePicture}
              alt={item.name || ""}
              className={`rounded-full object-cover border-2 border-[#12121a] ${rank === 1 ? "h-[76px] w-[76px]" : rank === 2 ? "h-[60px] w-[60px]" : "h-[48px] w-[48px]"
                }`}
            />
          ) : (
            <div
              className={`rounded-full border-2 border-[#12121a] flex items-center justify-center font-bold ${rank === 1 ? "h-[76px] w-[76px] text-xl" : rank === 2 ? "h-[60px] w-[60px] text-base" : "h-[48px] w-[48px] text-sm"
                }`}
              style={{
                background: "linear-gradient(135deg, #111118, #0a0a10)",
                color: rc.ring,
              }}
            >
              {initials}
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <h3
        className={`font-semibold text-white text-center truncate max-w-full leading-snug ${rank === 1 ? "text-base" : rank === 2 ? "text-sm" : "text-[12px]"
          }`}
      >
        {item.name || "Unknown"}
      </h3>

      {/* Country + level/directs */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap mt-1">
        <span className="text-xs">{flag}</span>
        <span className="text-[10px] text-[#7a7a90]">{item.country || "—"}</span>
        {isLeaderboardMode && item.directReferralsCount != null && (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-brand/10 text-brand whitespace-nowrap">
            {item.directReferralsCount} directs
          </span>
        )}
        {!isLeaderboardMode && item.level && item.level > 1 && (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-[#2a2a35]/60 text-[#7a7a90] whitespace-nowrap">
            L{item.level}
          </span>
        )}
      </div>

      {/* Revenue */}
      <div className={`text-center w-full ${isCenter ? "mt-5" : "mt-4"}`}>
        <p className="text-[8px] text-[#5a5a70] uppercase tracking-[0.15em] font-medium mb-1">
          {isLeaderboardMode ? "Network Revenue" : "Revenue"}
        </p>
        <p
          className={`font-bold leading-none ${rank === 1 ? "text-[28px]" : rank === 2 ? "text-xl" : "text-base"}`}
          style={{ color: "#34d399" }}
        >
          {formatRevenueExact(item.stats.totalSalesVolumeCents)}
        </p>
      </div>

      {/* Center card extra stats */}
      {isCenter && (
        <div className="mt-5 w-full">
          <div
            className="h-[1px] w-full mb-4"
            style={{ background: "linear-gradient(90deg, transparent, #2a2a3580, transparent)" }}
          />
          <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            <div className="text-center min-w-[50px]">
              <p className="text-[8px] text-[#5a5a70] uppercase tracking-wider mb-0.5">Deals</p>
              <p className="text-[15px] font-bold text-white">{item.stats.salesCount}</p>
            </div>
            <div className="w-[1px] h-6 bg-[#2a2a35]/60 hidden min-[340px]:block" />
            <div className="text-center min-w-[50px]">
              <p className="text-[8px] text-[#5a5a70] uppercase tracking-wider mb-0.5">Businesses</p>
              <p className="text-[15px] font-bold text-[#D4A844]">{item.stats.businessesCount}</p>
            </div>
            <div className="w-[1px] h-6 bg-[#2a2a35]/60 hidden min-[340px]:block" />
            <div className="text-center min-w-[50px]">
              <p className="text-[8px] text-[#5a5a70] uppercase tracking-wider mb-0.5">
                {isLeaderboardMode ? "Commissions" : "Joined"}
              </p>
              <p className="text-[15px] font-bold text-white truncate max-w-[80px]">
                {isLeaderboardMode
                  ? formatRevenue(item.stats.commissionsEarnedCents)
                  : relativeTime(item.joinedAt)}
              </p>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

// ─── Leaderboard Table Row ────────────────────────────────────────

function TableRow({
  item,
  rank,
  showLevel,
  isLeaderboardMode,
  onClick,
}: {
  item: UnifiedLeaderboardRow;
  rank: number;
  showLevel: boolean;
  isLeaderboardMode: boolean;
  onClick?: () => void;
}) {
  const initials = getInitials(item.name);
  const flag = getCountryFlag(item.country);

  const rankMedals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const isTop3 = rank <= 3;
  const top3Borders: Record<number, string> = {
    1: "border-l-[#D4A844]",
    2: "border-l-[#A8B4C0]",
    3: "border-l-[#CD7F32]",
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-3 px-4 border-b border-[#2a2a35]/40 last:border-b-0 group ${
        onClick ? "cursor-pointer hover:bg-[#0a0a10]/80 transition-colors" : ""
      } ${isTop3
          ? `border-l-2 ${top3Borders[rank]} bg-brand/[0.03]`
          : ""
        }`}
    >
      {/* Rank */}
      <span
        className={`text-[12px] font-mono w-7 text-right flex-shrink-0 ${isTop3 ? "text-brand font-bold" : "text-[#9fa0b8]"
          }`}
      >
        {rankMedals[rank] || rank}
      </span>

      {/* Avatar */}
      {item.profilePicture ? (
        <img
          src={item.profilePicture}
          alt=""
          className="h-9 w-9 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-[10px] font-bold text-[#9fa0b8] flex-shrink-0">
          {initials}
        </div>
      )}

      {/* Name / Email */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {item.name || "Unknown"}
        </p>
        <p className="text-[10px] text-[#9fa0b8] truncate">{item.email || "—"}</p>
      </div>

      {/* Country */}
      <div className="hidden sm:flex items-center gap-1 w-14 flex-shrink-0">
        <span className="text-sm">{flag}</span>
        <span className="text-[10px] text-[#9fa0b8]">{item.country || "—"}</span>
      </div>

      {/* Level (indirect) / Directs (leaderboard) */}
      {showLevel && (
        <div className="w-[68px] flex-shrink-0 text-center">
          {isLeaderboardMode ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand">
              {item.directReferralsCount ?? 0} dir
            </span>
          ) : item.level && item.level > 1 ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a35] text-[#9fa0b8]">
              L{item.level}
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand">
              L1
            </span>
          )}
        </div>
      )}

      {/* Revenue */}
      <div className="text-right w-20 flex-shrink-0">
        <p className="text-sm font-bold text-white">
          {formatRevenue(item.stats.totalSalesVolumeCents)}
        </p>
        <p className="text-[9px] text-[#9fa0b8]">revenue</p>
      </div>

      {/* Commissions */}
      <div className="text-right w-16 flex-shrink-0 hidden md:block">
        <p className="text-sm font-bold text-[#a78bfa]">
          {formatRevenue(item.stats.commissionsEarnedCents)}
        </p>
        <p className="text-[9px] text-[#9fa0b8]">earned</p>
      </div>

      {/* Sales */}
      <div className="text-right w-12 flex-shrink-0 hidden md:block">
        <p className="text-sm font-bold text-white">{item.stats.salesCount}</p>
        <p className="text-[9px] text-[#9fa0b8]">sales</p>
      </div>

      {/* Businesses */}
      <div className="text-right w-12 flex-shrink-0 hidden lg:block">
        <p className="text-sm font-bold text-white">{item.stats.businessesCount}</p>
        <p className="text-[9px] text-[#9fa0b8]">biz</p>
      </div>

      {/* Customers */}
      <div className="text-right w-12 flex-shrink-0 hidden xl:block">
        <p className="text-sm font-bold text-white">{item.stats.uniqueCustomers}</p>
        <p className="text-[9px] text-[#9fa0b8]">custs</p>
      </div>

      {/* Products */}
      <div className="text-right w-12 flex-shrink-0 hidden xl:block">
        <p className="text-sm font-bold text-white">{item.stats.uniqueProducts}</p>
        <p className="text-[9px] text-[#9fa0b8]">prods</p>
      </div>

      {/* Joined */}
      <div className="text-right w-14 flex-shrink-0 hidden md:block">
        <p className="text-[11px] text-[#9fa0b8]">{relativeTime(item.joinedAt)}</p>
      </div>


    </div>
  );
}

// ─── Achievement Card ─────────────────────────────────────────────

function AchievementCard({
  icon: Icon,
  badge,
  badgeColor,
  title,
  description,
}: {
  icon: any;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] p-4 hover:border-[#3a3a45] transition-all duration-200 flex-1 min-w-[200px]">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg bg-[#0a0a10] border border-[#2a2a35]">
          <Icon className="h-4 w-4 text-[#9fa0b8]" />
        </div>
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            color: badgeColor,
            backgroundColor: `${badgeColor}18`,
            border: `1px solid ${badgeColor}30`,
          }}
        >
          {badge}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
      <p className="text-[11px] text-[#9fa0b8] leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Dropdown Component ───────────────────────────────────────────

function Dropdown({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: any;
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = options.find((o) => o.key === value)?.label || label;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 pr-7 rounded-full text-[11px] font-medium transition-all duration-200 border ${value
            ? "bg-brand/15 text-brand border-brand/30"
            : "bg-[#12121a] text-[#9fa0b8] border-[#2a2a35] hover:border-[#3a3a45]"
          }`}
      >
        <Icon className="h-3 w-3" />
        {activeLabel}
      </button>
      <ChevronDown
        className={`absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none transition-transform duration-200 ${open ? "rotate-180" : ""
          } ${value ? "text-brand" : "text-[#9fa0b8]"}`}
      />

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-xl bg-[#1a1a22] border border-[#2a2a35] shadow-2xl shadow-black/40 py-1.5 max-h-[240px] overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[11px] font-medium transition-colors ${value === opt.key
                    ? "text-brand bg-brand/10"
                    : "text-[#c7c7da] hover:bg-[#12121a] hover:text-white"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function AffiliateLeaderboardPage() {
  // ── Mode + filters ───────────────────────────────────────────
  const [pageMode, setPageMode] = useState<PageMode>("leaderboard");
  const [networkView, setNetworkView] = useState<NetworkView>("direct");
  const [officeScope, setOfficeScope] = useState<OfficeScope>("current");
  const [sortBy, setSortBy] = useState<SortKey>("revenue");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [rangeFilter, setRangeFilter] = useState<AnalyticsRange>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // Selected user for drill-down details
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<UnifiedLeaderboardRow | null>(null);

  // ── Affiliate ID (only needed for My Network mode) ──────────
  const [affiliateId, setAffiliateId] = useState<string>("");
  const [affiliateInfo, setAffiliateInfo] = useState<AffiliateInfo | null>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);

  // ── Data ────────────────────────────────────────────────────
  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardItem[]>([]);
  const [leaderboardTotal, setLeaderboardTotal] = useState(0);
  const [directItems, setDirectItems] = useState<DirectReferralItem[]>([]);
  const [indirectItems, setIndirectItems] = useState<IndirectReferralItem[]>([]);
  const [directTotal, setDirectTotal] = useState(0);
  const [indirectTotal, setIndirectTotal] = useState(0);

  // ── Categories ──────────────────────────────────────────────
  const [categories, setCategories] = useState<string[]>([]);

  // ── UI ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAffiliateDetails, setShowAffiliateDetails] = useState(false);

  // ── Raw affiliate-details list ──────────────────────────────
  // Independent of the leaderboard's office scope / filters: the
  // exhaustive, unfiltered list of every affiliate the API returns.
  const [detailsItems, setDetailsItems] = useState<AffiliateDetailRow[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsFetched, setDetailsFetched] = useState(false);
  const [detailsPage, setDetailsPage] = useState(0);
  // Subscription filter for the affiliate-details table.
  const [detailsSubFilter, setDetailsSubFilter] = useState<"all" | "paid" | "assigned" | "none">("all");

  // ── Fetch categories on mount ───────────────────────────────

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => console.warn("[Leaderboard] Failed to fetch categories:", err));
  }, []);

  // ── Resolve affiliateId (only when switching to My Network) ──

  useEffect(() => {
    if (pageMode !== "my-network" || affiliateId) return;

    const resolve = async () => {
      setAffiliateLoading(true);
      try {
        const cachedData = await getRevenueNetworkData();
        if (cachedData?.affiliateId) {
          setAffiliateId(cachedData.affiliateId);
          setAffiliateLoading(false);
          return;
        }

        const token = getToken();
        if (!token) {
          setError("Not authenticated");
          setAffiliateLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const res = await fetch(`${apiUrl}/affiliate/my-affiliate-id`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.affiliateId) {
            setAffiliateId(data.affiliateId);
          } else {
            setError("No affiliate ID found for your account");
          }
        } else {
          setError("Failed to fetch affiliate ID");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load affiliate data");
      } finally {
        setAffiliateLoading(false);
      }
    };

    resolve();
  }, [pageMode, affiliateId]);

  // ── Fetch data ──────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const orgId = localStorage.getItem("garage_org_id") || undefined;
    const officeId = officeScope === "current" ? orgId : undefined;

    try {
      if (pageMode === "leaderboard") {
        // Mode A: Org-scoped leaderboard — officeId filters both users
        // (by org membership) and stats (by invoice org) on the backend.
        const res = await fetchLeaderboardPage({
          officeId,
          country: countryFilter || undefined,
          category: categoryFilter || undefined,
          range: rangeFilter,
        });
        setLeaderboardItems(res.items);
        setLeaderboardTotal(res.total);
        // Clear my-network data
        setDirectItems([]);
        setIndirectItems([]);
        setDirectTotal(0);
        setIndirectTotal(0);
      } else {
        // Mode B: My Network (requires affiliateId)
        if (!affiliateId) {
          setLoading(false);
          return;
        }

        // Clear leaderboard data
        setLeaderboardItems([]);
        setLeaderboardTotal(0);

        if (networkView === "direct" || networkView === "combined") {
          const directRes = await fetchAllDirectReferrals({
            affiliateId,
            officeId,
            country: countryFilter || undefined,
            category: categoryFilter || undefined,
            range: rangeFilter,
          });
          setDirectItems(directRes.items);
          setDirectTotal(directRes.total);
          if (directRes.affiliate) setAffiliateInfo(directRes.affiliate);
        } else {
          setDirectItems([]);
          setDirectTotal(0);
        }

        if (networkView === "indirect" || networkView === "combined") {
          const indirectRes = await fetchAllIndirectReferrals({
            affiliateId,
            officeId,
            country: countryFilter || undefined,
            category: categoryFilter || undefined,
            range: rangeFilter,
          });
          setIndirectItems(indirectRes.items);
          setIndirectTotal(indirectRes.total);
        } else {
          setIndirectItems([]);
          setIndirectTotal(0);
        }
      }
    } catch (err: any) {
      console.error("[AffiliateLeaderboard] fetch error:", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [pageMode, affiliateId, officeScope, networkView, countryFilter, categoryFilter, rangeFilter]);

  useEffect(() => {
    // Leaderboard mode: fetch immediately (no affiliateId needed, uses orgId).
    // My Network mode: wait for affiliateId to be resolved first.
    if (pageMode === "leaderboard") {
      fetchData();
    } else if (pageMode === "my-network" && affiliateId) {
      fetchData();
    }
  }, [fetchData, pageMode, affiliateId]);

  // ── Lazily fetch the raw affiliate-details list ─────────────
  // Fired the first time the user opens the Affiliate Details view.
  // Calls the exhaustive pager with NO params — no office scope, no
  // country/category/range, no revenue filter — so the table reflects
  // exactly what the API returns.
  useEffect(() => {
    if (!showAffiliateDetails || detailsFetched) return;

    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError(null);

    fetchAllLeaderboard({})
      .then((res) => {
        if (cancelled) return;
        // The endpoint returns every platform user; keep only actual
        // affiliates (those with an affiliateId). Also drop the heavy
        // `stats` block we never render in this table.
        setDetailsItems(
          res.items
            .filter((it) => it.affiliateId)
            .map((it) => ({
              userId: it.userId,
              affiliateId: it.affiliateId,
              name: it.name,
              email: it.email,
              phone: it.phone,
              country: it.country,
              profilePicture: it.profilePicture,
              joinedAt: it.joinedAt,
              subscription: it.subscription ?? null,
            }))
        );
        setDetailsFetched(true);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setDetailsError(err?.message || "Failed to load affiliate details");
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showAffiliateDetails, detailsFetched]);

  // Reset to the first page whenever the search or filter narrows the list.
  useEffect(() => {
    setDetailsPage(0);
  }, [searchQuery, detailsSubFilter]);

  // ── Compute unified + sorted list ───────────────────────────

  const sortedItems = useMemo((): UnifiedLeaderboardRow[] => {
    let rows: UnifiedLeaderboardRow[];

    if (pageMode === "leaderboard") {
      rows = leaderboardItems.map((it) => ({
        ...it,
        source: "leaderboard" as const,
      }));
    } else {
      rows = [
        ...directItems.map((it) => ({ ...it, source: "direct" as const })),
        ...indirectItems.map((it) => ({ ...it, source: "indirect" as const })),
      ];
    }

    // Deduplicate by userId
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      if (seen.has(r.userId)) return false;
      seen.add(r.userId);
      return true;
    });

    // In leaderboard mode, exclude users with no revenue
    const filtered = pageMode === "leaderboard"
      ? deduped.filter((r) => r.stats.totalSalesVolumeCents > 0)
      : deduped;

    // Sort
    const comparators: Record<SortKey, (a: UnifiedLeaderboardRow, b: UnifiedLeaderboardRow) => number> = {
      revenue: (a, b) => b.stats.totalSalesVolumeCents - a.stats.totalSalesVolumeCents,
      sales: (a, b) => b.stats.salesCount - a.stats.salesCount,
      businesses: (a, b) => b.stats.businessesCount - a.stats.businessesCount,
      commissions: (a, b) => b.stats.commissionsEarnedCents - a.stats.commissionsEarnedCents,
      joined: (a, b) => {
        const ta = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        const tb = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
        return tb - ta;
      },
    };

    filtered.sort(comparators[sortBy]);
    return filtered;
  }, [pageMode, leaderboardItems, directItems, indirectItems, sortBy]);

  // ── Aggregate stats ─────────────────────────────────────────

  const aggregates = useMemo(() => {
    const totalRevenue = sortedItems.reduce((s, r) => s + r.stats.totalSalesVolumeCents, 0);
    const totalSales = sortedItems.reduce((s, r) => s + r.stats.salesCount, 0);
    const totalCommissions = sortedItems.reduce((s, r) => s + r.stats.commissionsEarnedCents, 0);
    const totalCustomers = sortedItems.reduce((s, r) => s + r.stats.uniqueCustomers, 0);
    const totalProducts = sortedItems.reduce((s, r) => s + r.stats.uniqueProducts, 0);
    const totalBusinesses = sortedItems.reduce((s, r) => s + r.stats.businessesCount, 0);
    const activeCount = sortedItems.filter((r) => r.stats.salesCount > 0).length;

    return {
      totalRevenue,
      totalSales,
      totalCommissions,
      totalCustomers,
      totalProducts,
      totalBusinesses,
      activeCount,
      totalAffiliates: sortedItems.length,
    };
  }, [sortedItems]);

  // ── Country list for filter ─────────────────────────────────

  const countryList = useMemo(() => {
    const set = new Set<string>();
    sortedItems.forEach((r) => {
      if (r.country) set.add(r.country);
    });
    return Array.from(set).sort();
  }, [sortedItems]);

  // ── Achievements ────────────────────────────────────────────

  const achievements = useMemo(() => {
    if (sortedItems.length === 0) return [];

    const topRevenue = [...sortedItems].sort(
      (a, b) => b.stats.totalSalesVolumeCents - a.stats.totalSalesVolumeCents
    )[0];

    const topSales = [...sortedItems].sort(
      (a, b) => b.stats.salesCount - a.stats.salesCount
    )[0];

    const topBiz = [...sortedItems].sort(
      (a, b) => b.stats.businessesCount - a.stats.businessesCount
    )[0];

    const topCommissions = [...sortedItems].sort(
      (a, b) => b.stats.commissionsEarnedCents - a.stats.commissionsEarnedCents
    )[0];

    // Newest star: highest revenue among those joined in last 90 days
    const cutoff = Date.now() - 90 * 86400000;
    const recent = sortedItems.filter(
      (r) => r.joinedAt && new Date(r.joinedAt).getTime() > cutoff
    );
    const newStar = recent.length > 0
      ? [...recent].sort(
        (a, b) => b.stats.totalSalesVolumeCents - a.stats.totalSalesVolumeCents
      )[0]
      : null;

    const result = [];

    if (topRevenue && topRevenue.stats.totalSalesVolumeCents > 0) {
      result.push({
        icon: Trophy,
        badge: "TOP REVENUE",
        badgeColor: "#FBD10D",
        title: "Top Performer",
        description: `${topRevenue.name || "Unknown"} generated ${formatRevenueExact(topRevenue.stats.totalSalesVolumeCents)} in total sales across ${topRevenue.stats.uniqueCustomers} customers.`,
      });
    }

    if (topSales && topSales.stats.salesCount > 0) {
      result.push({
        icon: Zap,
        badge: "MOST SALES",
        badgeColor: "#a78bfa",
        title: "Sales Champion",
        description: `${topSales.name || "Unknown"} closed ${topSales.stats.salesCount} deals across ${topSales.stats.businessesCount} businesses.`,
      });
    }

    if (topCommissions && topCommissions.stats.commissionsEarnedCents > 0) {
      result.push({
        icon: Coins,
        badge: "TOP EARNER",
        badgeColor: "#34d399",
        title: "Commission Leader",
        description: `${topCommissions.name || "Unknown"} earned ${formatRevenueExact(topCommissions.stats.commissionsEarnedCents)} in commissions.`,
      });
    }

    if (topBiz && topBiz.stats.businessesCount > 1) {
      result.push({
        icon: Globe,
        badge: "MOST DIVERSE",
        badgeColor: "#60a5fa",
        title: "Business Builder",
        description: `${topBiz.name || "Unknown"} sold to ${topBiz.stats.businessesCount} different businesses with ${topBiz.stats.uniqueProducts} unique products.`,
      });
    }

    if (newStar && newStar.stats.totalSalesVolumeCents > 0) {
      result.push({
        icon: Rocket,
        badge: "RISING STAR",
        badgeColor: "#f472b6",
        title: "Newest Star",
        description: `${newStar.name || "Unknown"} earned ${formatRevenueExact(newStar.stats.totalSalesVolumeCents)} since joining ${relativeTime(newStar.joinedAt)}.`,
      });
    }

    return result;
  }, [sortedItems]);

  // ── Split podium + table ────────────────────────────────────

  const podiumItems = sortedItems.slice(0, 3);
  const tableItems = sortedItems.slice(3);
  const showLevelColumn = pageMode === "leaderboard" || networkView === "indirect" || networkView === "combined";
  const isLeaderboardMode = pageMode === "leaderboard";

  // ── Category filter options ─────────────────────────────────

  const categoryOptions = useMemo(
    () => [
      { key: "", label: "All Categories" },
      ...categories.map((c) => ({ key: c, label: c })),
    ],
    [categories]
  );

  // ── Loading state (My Network — resolving affiliate ID) ──────

  if (pageMode === "my-network" && affiliateLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
          <p className="text-sm text-[#9fa0b8]">Resolving your affiliate account...</p>
        </div>
      </div>
    );
  }

  if (pageMode === "my-network" && error && !affiliateId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="p-3 rounded-xl bg-[#12121a] border border-[#2a2a35]">
            <AlertCircle className="h-6 w-6 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Cannot Load My Network</h3>
          <p className="text-sm text-[#9fa0b8]">{error}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setPageMode("leaderboard")}
              className="text-xs text-brand hover:underline"
            >
              View Leaderboard Instead
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-[#9fa0b8] hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#0a0a10] min-h-screen">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex-none px-5 pt-5 pb-4">
        {/* ── All filters in one line ────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          {/* Page mode toggle */}
          <div className="flex items-center rounded-full bg-[#12121a] border border-[#2a2a35] p-0.5">
            <button
              onClick={() => setPageMode("leaderboard")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${pageMode === "leaderboard"
                  ? "bg-brand/15 text-brand shadow-[0_0_12px_color-mix(in_srgb,_var(--brand)_8%,_transparent)]"
                  : "text-[#9fa0b8] hover:text-white"
                }`}
            >
              <Award className="h-3 w-3" />
              Leaderboard
            </button>
            <button
              onClick={() => setPageMode("my-network")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${pageMode === "my-network"
                  ? "bg-brand/15 text-brand shadow-[0_0_12px_color-mix(in_srgb,_var(--brand)_8%,_transparent)]"
                  : "text-[#9fa0b8] hover:text-white"
                }`}
            >
              <Users className="h-3 w-3" />
              My Network
            </button>
          </div>

          {/* Range filter pills */}
          <div className="flex items-center rounded-full bg-[#12121a] border border-[#2a2a35] p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRangeFilter(opt.key)}
                className={`px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-all duration-200 ${rangeFilter === opt.key
                    ? "bg-brand/15 text-brand"
                    : "text-[#9fa0b8] hover:text-white"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Office scope toggle */}
          <div className="flex items-center rounded-full bg-[#12121a] border border-[#2a2a35] p-0.5">
            <button
              onClick={() => setOfficeScope("current")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${officeScope === "current"
                  ? "bg-brand/15 text-brand shadow-[0_0_12px_color-mix(in_srgb,_var(--brand)_8%,_transparent)]"
                  : "text-[#9fa0b8] hover:text-white"
                }`}
            >
              <Building2 className="h-3 w-3" />
              Current Office
            </button>
            <button
              onClick={() => setOfficeScope("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${officeScope === "all"
                  ? "bg-brand/15 text-brand shadow-[0_0_12px_color-mix(in_srgb,_var(--brand)_8%,_transparent)]"
                  : "text-[#9fa0b8] hover:text-white"
                }`}
            >
              <Earth className="h-3 w-3" />
              All Offices
            </button>
          </div>

          {/* Category filter dropdown */}
          {categories.length > 0 && (
            <Dropdown
              label="All Categories"
              icon={Tag}
              value={categoryFilter}
              options={categoryOptions}
              onChange={setCategoryFilter}
            />
          )}

          {/* My Network sub-toggle */}
          {pageMode === "my-network" && (
            <div className="flex items-center rounded-full bg-[#12121a] border border-[#2a2a35] p-0.5">
              {(["direct", "indirect", "combined"] as NetworkView[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setNetworkView(mode)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 capitalize ${networkView === mode
                      ? "bg-brand/15 text-brand"
                      : "text-[#9fa0b8] hover:text-white"
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}

          {/* Country filter */}
          {countryList.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 pr-7 rounded-full text-[11px] font-medium transition-all duration-200 border ${countryFilter
                    ? "bg-brand/15 text-brand border-brand/30"
                    : "bg-[#12121a] text-[#9fa0b8] border-[#2a2a35] hover:border-[#3a3a45]"
                  }`}
              >
                <Filter className="h-3 w-3" />
                {countryFilter
                  ? `${getCountryFlag(countryFilter)} ${countryFilter}`
                  : "All Countries"}
              </button>
              <ChevronDown
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none transition-transform duration-200 ${countryDropdownOpen ? "rotate-180" : ""
                  } ${countryFilter ? "text-brand" : "text-[#9fa0b8]"}`}
              />

              {countryDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCountryDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-xl bg-[#1a1a22] border border-[#2a2a35] shadow-2xl shadow-black/40 py-1.5 max-h-[240px] overflow-y-auto">
                    <button
                      onClick={() => {
                        setCountryFilter("");
                        setCountryDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[11px] font-medium transition-colors ${!countryFilter
                          ? "text-brand bg-brand/10"
                          : "text-[#c7c7da] hover:bg-[#12121a] hover:text-white"
                        }`}
                    >
                      🌍 All Countries
                    </button>
                    {countryList.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setCountryFilter(c);
                          setCountryDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[11px] font-medium transition-colors ${countryFilter === c
                            ? "text-brand bg-brand/10"
                            : "text-[#c7c7da] hover:bg-[#12121a] hover:text-white"
                          }`}
                      >
                        {getCountryFlag(c)} {c}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Stats Summary ──────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-2">
          <StatCard
            icon={DollarSign}
            label={isLeaderboardMode ? "Network Revenue" : "Total Revenue"}
            value={formatRevenue(aggregates.totalRevenue)}
            sub={aggregates.totalSales > 0 ? `From ${aggregates.totalSales} sales` : `From ${aggregates.totalAffiliates} affiliates`}
          />
          <StatCard
            icon={Users}
            label={isLeaderboardMode ? "Affiliates" : "Network Size"}
            value={String(aggregates.totalAffiliates)}
            sub={aggregates.activeCount > 0 ? `${aggregates.activeCount} with sales` : "No sales yet"}
          />
          <StatCard
            icon={Coins}
            label="Commissions"
            value={formatRevenue(aggregates.totalCommissions)}
            sub={aggregates.activeCount > 0 ? `Across ${aggregates.activeCount} earners` : "No commissions yet"}
          />
          <StatCard
            icon={Building2}
            label="Unique Businesses"
            value={String(aggregates.totalBusinesses)}
            sub={aggregates.totalBusinesses > 0 ? "Across all affiliates" : "No businesses yet"}
          />
          <StatCard
            icon={UserCheck}
            label="Unique Customers"
            value={String(aggregates.totalCustomers)}
            sub={aggregates.totalCustomers > 0 ? "Across all affiliates" : "No customers yet"}
          />
          <StatCard
            icon={Package}
            label="Unique Products"
            value={String(aggregates.totalProducts)}
            sub={aggregates.totalProducts > 0 ? "Distinct items sold" : "No products yet"}
          />
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="flex-1 px-5 pb-8 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : sortedItems.length === 0 && !showAffiliateDetails ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-xl bg-[#12121a] border border-[#2a2a35] mb-4">
              <Users className="h-8 w-8 text-[#9fa0b8]" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No Results Found</h3>
            <p className="text-sm text-[#9fa0b8] max-w-xs">
              {countryFilter
                ? `No affiliates found for country "${countryFilter}". Try removing the filter.`
                : categoryFilter
                  ? `No results for category "${categoryFilter}". Try a different category.`
                  : rangeFilter !== "all"
                    ? `No activity in the selected time range. Try "All Time".`
                    : officeScope === "current"
                      ? "No affiliates found for this office. Try switching to 'All Offices'."
                      : isLeaderboardMode
                        ? "No affiliate data available on the platform."
                        : "Your affiliate network doesn't have any referrals yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Podium Section ──────────────────────────── */}
            {podiumItems.length > 0 && (
              // relative z-0 keeps the rank-1 card's z-10 contained in this
              // section's stacking context, so it can't paint over the
              // sticky page header (which is also z-10) while scrolling.
              <div className="relative z-0">

                <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-4 md:gap-6 px-4">
                  {/* Rank 2 (left) */}
                  {podiumItems[1] && (
                    <div className="w-full max-w-sm md:max-w-[280px] md:mt-4 order-2 md:order-1">
                      <PodiumCard
                        item={podiumItems[1]}
                        rank={2}
                        isCenter={false}
                        isLeaderboardMode={isLeaderboardMode}
                        onClick={isLeaderboardMode ? () => setSelectedUserForDetail(podiumItems[1]) : undefined}
                      />
                    </div>
                  )}

                  {/* Rank 1 (center, elevated) */}
                  {podiumItems[0] && (
                    <div className="w-full max-w-sm md:max-w-[320px] order-1 md:order-2">
                      <PodiumCard
                        item={podiumItems[0]}
                        rank={1}
                        isCenter={true}
                        isLeaderboardMode={isLeaderboardMode}
                        onClick={isLeaderboardMode ? () => setSelectedUserForDetail(podiumItems[0]) : undefined}
                      />
                    </div>
                  )}

                  {/* Rank 3 (right) */}
                  {podiumItems[2] && (
                    <div className="w-full max-w-sm md:max-w-[250px] md:mt-10 order-3 md:order-3">
                      <PodiumCard
                        item={podiumItems[2]}
                        rank={3}
                        isCenter={false}
                        isLeaderboardMode={isLeaderboardMode}
                        onClick={isLeaderboardMode ? () => setSelectedUserForDetail(podiumItems[2]) : undefined}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {(sortedItems.length > 0 || showAffiliateDetails) && (() => {
              const q = searchQuery.toLowerCase().trim();
              const matchesQuery = (r: { name: string | null; email: string | null }) =>
                (r.name && r.name.toLowerCase().includes(q)) ||
                (r.email && r.email.toLowerCase().includes(q));

              const filteredItems = q ? sortedItems.filter(matchesQuery) : sortedItems;

              // Raw affiliate-details list (independent of office scope /
              // leaderboard filters), narrowed by the search box and the
              // subscription filter.
              const subKind = (sub: UnilevelPlusSubscription | null | undefined): "paid" | "assigned" | "none" => {
                if (!sub || !sub.hasUnilevelPlus) return "none";
                return sub.source === "reserve_assignment" ? "assigned" : "paid";
              };
              const detailsFiltered = detailsItems.filter(
                (r) =>
                  (!q || matchesQuery(r)) &&
                  (detailsSubFilter === "all" || subKind(r.subscription) === detailsSubFilter)
              );

              // The toolbar count / table source depend on which view is active.
              const visibleCount = showAffiliateDetails ? detailsFiltered.length : filteredItems.length;
              const totalCount = showAffiliateDetails ? detailsItems.length : sortedItems.length;

              // Client-side pagination for the (potentially 900+ row) details table.
              const totalDetailPages = Math.max(1, Math.ceil(detailsFiltered.length / DETAILS_PAGE_SIZE));
              const currentDetailPage = Math.min(detailsPage, totalDetailPages - 1);
              const detailPageStart = currentDetailPage * DETAILS_PAGE_SIZE;
              const pagedDetails = detailsFiltered.slice(detailPageStart, detailPageStart + DETAILS_PAGE_SIZE);

              // ── CSV export helper (exports the raw affiliate list) ──
              const exportAffiliatesCsv = () => {
                const headers = [
                  "#", "Name", "Email", "Mobile", "Country",
                  "Subscription", "Subscription Type", "Subscription Amount", "Subscription Currency", "Purchased At",
                  "Joined",
                ];
                const rows = detailsFiltered.map((item, i) => {
                  const sub = (item as any).subscription;
                  const active = sub && sub.hasUnilevelPlus;
                  const subType = active ? (sub.source === "reserve_assignment" ? "Assigned" : "Paid") : "";
                  return [
                    i + 1,
                    `"${(item.name || "Unknown").replace(/"/g, '""')}"`,
                    `"${(item.email || "—").replace(/"/g, '""')}"`,
                    `"${(item.phone || "—").replace(/"/g, '""')}"`,
                    `"${(item.country || "—").replace(/"/g, '""')}"`,
                    active ? "Active" : "No",
                    `"${subType}"`,
                    active && typeof sub.amount === "number" ? sub.amount : "",
                    `"${active ? (sub.currency || "") : ""}"`,
                    active && sub.purchasedAt ? new Date(sub.purchasedAt).toLocaleDateString() : "",
                    item.joinedAt ? new Date(item.joinedAt).toLocaleDateString() : "—",
                  ].join(",");
                });
                const csv = [headers.join(","), ...rows].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `affiliate-details-${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              };

              return (
                <div>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-brand" />
                      <h2 className="text-[13px] font-semibold text-white">
                        {showAffiliateDetails ? "Affiliate Details" : "Full Rankings"}
                      </h2>
                      <span className="text-[11px] text-[#9fa0b8]">
                        ({visibleCount}{q ? ` of ${totalCount}` : ""})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Affiliate Details Toggle */}
                      <button
                        onClick={() => setShowAffiliateDetails(!showAffiliateDetails)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 border ${showAffiliateDetails
                            ? "bg-brand/15 text-brand border-brand/30"
                            : "bg-[#12121a] text-[#9fa0b8] border-[#2a2a35] hover:border-[#3a3a45] hover:text-white"
                          }`}
                      >
                        {showAffiliateDetails ? (
                          <ToggleRight className="h-3.5 w-3.5" />
                        ) : (
                          <ToggleLeft className="h-3.5 w-3.5" />
                        )}
                        All Affiliate
                      </button>

                      {/* Subscription filter (affiliate details view only) */}
                      {showAffiliateDetails && (
                        <div className="flex items-center gap-1">
                          {(
                            [
                              { key: "all", label: "All" },
                              { key: "paid", label: "Paid" },
                              { key: "assigned", label: "Assigned" },
                              { key: "none", label: "Free" },
                            ] as { key: typeof detailsSubFilter; label: string }[]
                          ).map((opt) => (
                            <button
                              key={opt.key}
                              onClick={() => setDetailsSubFilter(opt.key)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                                detailsSubFilter === opt.key
                                  ? "bg-[#34d399]/15 text-[#34d399] ring-1 ring-[#34d399]/30"
                                  : "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Export CSV Button (shown only in affiliate details view) */}
                      {showAffiliateDetails && detailsItems.length > 0 && (
                        <button
                          onClick={exportAffiliatesCsv}
                          disabled={detailsLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 border bg-[#34d399]/10 text-[#34d399] border-[#34d399]/30 hover:bg-[#34d399]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export CSV
                        </button>
                      )}

                      {/* Sort buttons (only in rankings view) */}
                      {!showAffiliateDetails && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(
                            [
                              { key: "revenue", label: "Revenue" },
                              { key: "commissions", label: "Commissions" },
                              { key: "sales", label: "Sales" },
                              { key: "businesses", label: "Businesses" },
                              { key: "joined", label: "Newest" },
                            ] as { key: SortKey; label: string }[]
                          ).map((opt) => (
                            <button
                              key={opt.key}
                              onClick={() => setSortBy(opt.key)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${sortBy === opt.key
                                  ? "bg-brand/15 text-brand ring-1 ring-brand/30"
                                  : "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                                }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9fa0b8] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-lg bg-[#12121a] border border-[#2a2a35] text-sm text-white placeholder-[#5a5a70] focus:outline-none focus:border-brand/40 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9fa0b8] hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* ── Affiliate Details Table ──────────────── */}
                  {showAffiliateDetails ? (
                    <>
                    <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] overflow-hidden">
                      {detailsLoading ? (
                        <div className="py-10 text-center">
                          <p className="text-sm text-[#9fa0b8]">Loading all affiliates…</p>
                        </div>
                      ) : detailsError ? (
                        <div className="py-10 text-center">
                          <p className="text-sm text-[#f87171]">{detailsError}</p>
                        </div>
                      ) : detailsFiltered.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px]">
                            <thead>
                              <tr className="border-b border-[#2a2a35]">
                                <th className="text-left px-4 py-3 text-[10px] text-[#5a5a70] uppercase tracking-wider font-bold w-10">#</th>
                                <th className="text-left px-4 py-3 text-[10px] text-[#5a5a70] uppercase tracking-wider font-bold">Name</th>
                                <th className="text-left px-4 py-3 text-[10px] text-[#5a5a70] uppercase tracking-wider font-bold">Email</th>
                                <th className="text-left px-4 py-3 text-[10px] text-[#5a5a70] uppercase tracking-wider font-bold">Mobile</th>
                                <th className="text-left px-4 py-3 text-[10px] text-[#5a5a70] uppercase tracking-wider font-bold">Country</th>
                                <th className="text-center px-4 py-3 text-[10px] text-[#5a5a70] uppercase tracking-wider font-bold">Subscription</th>
                                <th className="text-right px-4 py-3 text-[10px] text-[#5a5a70] uppercase tracking-wider font-bold">Joined</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedDetails.map((item, i) => {
                                const sub = (item as any).subscription;
                                const hasSubscription = sub && sub.hasUnilevelPlus;
                                return (
                                  <tr
                                    key={item.userId}
                                    className="border-b border-[#2a2a35]/40 last:border-b-0 hover:bg-[#0a0a10]/80 transition-colors group"
                                  >
                                    {/* # */}
                                    <td className="px-4 py-3">
                                      <span className="text-xs text-[#9fa0b8] font-mono">{detailPageStart + i + 1}</span>
                                    </td>

                                    {/* Name + Avatar */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {item.profilePicture ? (
                                          <img
                                            src={item.profilePicture}
                                            alt=""
                                            className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                                          />
                                        ) : (
                                          <div className="h-8 w-8 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-[9px] font-bold text-[#9fa0b8] flex-shrink-0">
                                            {getInitials(item.name)}
                                          </div>
                                        )}
                                        <span className="text-sm font-medium text-white truncate transition-colors">
                                          {item.name || "Unknown"}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Email */}
                                    <td className="px-4 py-3">
                                      <span className="text-xs text-[#9fa0b8] truncate block max-w-[200px]">
                                        {item.email || "—"}
                                      </span>
                                    </td>

                                    {/* Mobile */}
                                    <td className="px-4 py-3">
                                      <span className="text-xs text-[#9fa0b8] truncate block max-w-[140px]">
                                        {item.phone || "—"}
                                      </span>
                                    </td>

                                    {/* Country */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1">
                                        <span className="text-sm">{getCountryFlag(item.country)}</span>
                                        <span className="text-xs text-[#9fa0b8]">{item.country || "—"}</span>
                                      </div>
                                    </td>

                                    {/* Subscription */}
                                    <td className="px-4 py-3 text-center">
                                      {hasSubscription ? (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
                                            {sub.source === "reserve_assignment" ? "Assigned" : "Paid"}
                                          </span>
                                          {typeof sub.amount === "number" && sub.amount > 0 && (
                                            <span className="text-[10px] font-medium text-white">
                                              {sub.amount.toLocaleString()} {sub.currency || ""}
                                            </span>
                                          )}
                                          {sub.purchasedAt && (
                                            <span className="text-[9px] text-[#5a5a70]">
                                              {new Date(sub.purchasedAt).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#9fa0b8]/10 text-[#5a5a70] border border-[#2a2a35]">
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#5a5a70]" />
                                          No
                                        </span>
                                      )}
                                    </td>

                                    {/* Joined */}
                                    <td className="px-4 py-3 text-right">
                                      <span className="text-[11px] text-[#9fa0b8]">
                                        {relativeTime(item.joinedAt)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-sm text-[#9fa0b8]">
                            {searchQuery
                              ? `No results for "${searchQuery}"`
                              : detailsSubFilter !== "all"
                              ? `No ${detailsSubFilter === "none" ? "free" : detailsSubFilter} affiliates`
                              : "No affiliates found"}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ── Pagination controls ──────────────────── */}
                    {!detailsLoading && !detailsError && detailsFiltered.length > DETAILS_PAGE_SIZE && (
                      <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-2">
                        <span className="text-[11px] text-[#9fa0b8]">
                          Showing {detailPageStart + 1}–{Math.min(detailPageStart + DETAILS_PAGE_SIZE, detailsFiltered.length)} of {detailsFiltered.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDetailsPage((p) => Math.max(0, p - 1))}
                            disabled={currentDetailPage === 0}
                            className="px-3 py-1.5 rounded-full text-[11px] font-medium border bg-[#12121a] text-[#9fa0b8] border-[#2a2a35] hover:border-[#3a3a45] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Prev
                          </button>
                          <span className="text-[11px] text-[#9fa0b8]">
                            Page {currentDetailPage + 1} of {totalDetailPages}
                          </span>
                          <button
                            onClick={() => setDetailsPage((p) => Math.min(totalDetailPages - 1, p + 1))}
                            disabled={currentDetailPage >= totalDetailPages - 1}
                            className="px-3 py-1.5 rounded-full text-[11px] font-medium border bg-[#12121a] text-[#9fa0b8] border-[#2a2a35] hover:border-[#3a3a45] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                    </>
                  ) : (
                    /* ── Original Rankings Table ─────────────── */
                    <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] overflow-hidden">
                      {filteredItems.length > 0 ? (
                        filteredItems.map((item, i) => (
                          <TableRow
                            key={item.userId}
                            item={item}
                            rank={i + 1}
                            showLevel={showLevelColumn}
                            isLeaderboardMode={isLeaderboardMode}
                            onClick={isLeaderboardMode ? () => setSelectedUserForDetail(item) : undefined}
                          />
                        ))
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-sm text-[#9fa0b8]">No results for &quot;{searchQuery}&quot;</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Achievements Section ────────────────────── */}
            {achievements.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] text-[#9fa0b8] font-semibold uppercase tracking-wider">
                    Network Highlights
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {achievements.map((ach, i) => (
                    <AchievementCard key={i} {...ach} />
                  ))}
                </div>
              </div>
            )}

            {/* Error banner (non-blocking) */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
                <button
                  onClick={fetchData}
                  className="ml-auto text-xs text-brand hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedUserForDetail && (
        <AffiliateDetailsDrawer
          user={selectedUserForDetail}
          onClose={() => setSelectedUserForDetail(null)}
          pageMode={pageMode}
          officeScope={officeScope}
          categoryFilter={categoryFilter}
          rangeFilter={rangeFilter}
          countryFilter={countryFilter}
        />
      )}
    </div>
  );
}

// ─── Affiliate Details Drawer ─────────────────────────────────────
interface AffiliateDetailsDrawerProps {
  user: UnifiedLeaderboardRow | null;
  onClose: () => void;
  pageMode: PageMode;
  officeScope: OfficeScope;
  categoryFilter: string;
  rangeFilter: AnalyticsRange;
  countryFilter: string;
}

interface DetailUser {
  _id: string;
  name: string | null;
  email: string | null;
  affiliateId: string | null;
  country: string | null;
  profilePicture: string | null;
  joinedAt: string | null;
}

function AffiliateDetailsDrawer({
  user,
  onClose,
  pageMode,
  officeScope,
  categoryFilter,
  rangeFilter,
  countryFilter,
}: AffiliateDetailsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"transactions" | "products" | "customers" | "businesses">("transactions");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [detailStats, setDetailStats] = useState<AffiliateItemStats | null>(null);
  const [detailUser, setDetailUser] = useState<DetailUser | null>(null);
  const activeFetchesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    setIsOpen(true);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  const fetchTabDetails = useCallback(async (tab: typeof activeTab, offsetVal: number) => {
    if (!user) return;
    const fetchKey = `${user.userId}-${tab}-${offsetVal}`;
    if (activeFetchesRef.current.has(fetchKey)) return;
    activeFetchesRef.current.add(fetchKey);

    const isLoadMore = offsetVal > 0;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setItems([]);
    }
    setError(null);

    const orgId = typeof window !== "undefined" ? localStorage.getItem("garage_org_id") || undefined : undefined;
    const officeId = officeScope === "current" ? orgId : undefined;
    const mode = pageMode === "leaderboard" ? "leaderboard" : "affiliate-downline";

    try {
      const res = await fetchAffiliateDetails({
        userId: user.userId,
        detail: tab,
        mode,
        officeId,
        country: countryFilter || undefined,
        category: categoryFilter || undefined,
        range: rangeFilter,
        limit: 50,
        offset: offsetVal,
      });

      if (res.success && res.data) {
        if (isLoadMore) {
          setItems((prev) => [...prev, ...res.data.items]);
        } else {
          setItems(res.data.items);
          setDetailStats(res.data.stats);
          setDetailUser(res.data.user);
        }
        setPagination(res.data.pagination);
      } else {
        throw new Error("Invalid response schema from details API");
      }
    } catch (err: any) {
      console.error("[AffiliateDetailsDrawer] fetch error:", err);
      setError(err.message || "Failed to load details");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      activeFetchesRef.current.delete(fetchKey);
    }
  }, [user?.userId, pageMode, officeScope, categoryFilter, rangeFilter, countryFilter]);

  useEffect(() => {
    fetchTabDetails(activeTab, 0);
  }, [fetchTabDetails, activeTab]);

  const handleLoadMore = () => {
    if (loadingMore || !pagination?.hasMore) return;
    fetchTabDetails(activeTab, items.length);
  };

  if (!user) return null;
  if (!mounted) return null;

  // Use values from detail fetch if available, otherwise fall back to list item row data
  const stats = detailStats || user.stats || {
    totalSalesVolumeCents: 0,
    currency: "USD",
    salesCount: 0,
    businessesCount: 0,
    uniqueCustomers: 0,
    uniqueProducts: 0,
    commissionsDistributedCents: 0,
    commissionsEarnedCents: 0,
  };
  const profile = detailUser || user;
  const initials = getInitials(profile.name);
  const flag = getCountryFlag(profile.country);

  const tabOptions = [
    { key: "transactions", label: "Transactions", count: stats.salesCount },
    { key: "products", label: "Products", count: stats.uniqueProducts },
    { key: "customers", label: "Customers", count: stats.uniqueCustomers },
    { key: "businesses", label: "Businesses", count: stats.businessesCount },
  ] as const;

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        onClick={handleClose}
      />

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-[#0a0a10] border-l border-[#2a2a35] z-[9999] flex flex-col shadow-2xl transition-transform duration-300 ease-out transform ${isOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Header container */}
        <div className="relative p-6 border-b border-[#2a2a35] bg-[#12121a]">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-[#9fa0b8] hover:text-white p-1.5 rounded-lg hover:bg-[#1a1a24] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* User profile card */}
          <div className="flex items-center gap-4 mb-6">
            {profile.profilePicture ? (
              <img
                src={profile.profilePicture}
                alt={profile.name || ""}
                className="h-16 w-16 rounded-full object-cover border border-[#2a2a35]"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-lg font-bold text-[#9fa0b8]">
                {initials}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                {profile.name || "Unknown"}
                {flag && <span className="text-base" title={profile.country || ""}>{flag}</span>}
              </h3>
              <p className="text-xs text-[#9fa0b8]">{profile.email || "No email provided"}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] text-[#7a7a90] flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Joined {relativeTime(profile.joinedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Stats quick grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-[#0c0c12]/80 border border-[#2a2a35]/40 rounded-xl p-3">
            <div className="text-center">
              <p className="text-[8px] text-[#5a5a70] uppercase tracking-wider font-bold mb-0.5">Revenue</p>
              <p className="text-xs font-bold text-[#34d399]" title={formatRevenueExact(stats.totalSalesVolumeCents)}>
                {formatRevenue(stats.totalSalesVolumeCents)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-[#5a5a70] uppercase tracking-wider font-bold mb-0.5">Earned</p>
              <p className="text-xs font-bold text-[#a78bfa]">
                {formatRevenue(stats.commissionsEarnedCents)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-[#5a5a70] uppercase tracking-wider font-bold mb-0.5">Sales</p>
              <p className="text-xs font-bold text-white">
                {stats.salesCount}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-[#5a5a70] uppercase tracking-wider font-bold mb-0.5">Businesses</p>
              <p className="text-xs font-bold text-white">
                {stats.businessesCount}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-[#5a5a70] uppercase tracking-wider font-bold mb-0.5">Customers</p>
              <p className="text-xs font-bold text-white">
                {stats.uniqueCustomers}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-[#5a5a70] uppercase tracking-wider font-bold mb-0.5">Products</p>
              <p className="text-xs font-bold text-white">
                {stats.uniqueProducts}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#2a2a35] bg-[#12121a]">
          {tabOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setActiveTab(opt.key)}
              className={`flex-1 py-3 px-1 text-center text-xs font-medium border-b-2 transition-all duration-200 ${activeTab === opt.key
                  ? "border-brand text-brand bg-brand/5"
                  : "border-transparent text-[#9fa0b8] hover:text-white hover:bg-[#1a1a24]/30"
                }`}
            >
              <span className="block text-[9px] sm:text-[11px] uppercase tracking-wider font-bold truncate">{opt.label}</span>
              <span className="block text-[10px] text-[#7a7a90] mt-0.5 font-mono">({opt.count})</span>
            </button>
          ))}
        </div>

        {/* Content list container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
              <p className="text-xs text-[#9fa0b8]">Fetching active tab details...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-400 font-medium">{error}</p>
              <button
                onClick={() => fetchTabDetails(activeTab, 0)}
                className="px-3 py-1.5 rounded-full text-xs bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-[#9fa0b8] gap-2">
              <p className="text-sm font-medium">No results found</p>
              <p className="text-xs text-[#5a5a70]">
                There are no {activeTab} listed for this affiliate under current filter conditions.
              </p>
            </div>
          ) : (
            <>
              {activeTab === "transactions" &&
                items.map((item) => (
                  <div
                    key={item._id}
                    className="border border-[#2a2a35]/60 bg-[#12121a]/60 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs text-[#9fa0b8] font-mono">
                          Invoice: {item.invoiceNumber || "—"}
                        </p>
                        <p className="text-[10px] text-[#5a5a70]">
                          {item.paidAt ? new Date(item.paidAt).toLocaleString() : "—"}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm font-bold text-[#34d399]">
                          {formatRevenueExact(item.totalAmount)}
                        </p>
                        <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {item.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs py-2 border-t border-b border-[#2a2a35]/30">
                      <div>
                        <p className="text-[9px] text-[#5a5a70] uppercase font-bold tracking-wider mb-0.5">
                          Customer
                        </p>
                        <p className="text-white font-medium truncate">
                          {item.customer?.name || "—"}
                        </p>
                        <p className="text-[10px] text-[#9fa0b8] truncate">
                          {item.customer?.email || "—"}
                        </p>
                      </div>
                      {item.seller && (
                        <div>
                          <p className="text-[9px] text-[#5a5a70] uppercase font-bold tracking-wider mb-0.5">
                            Seller
                          </p>
                          <p className="text-white font-medium truncate">
                            {item.seller.name || "—"}
                          </p>
                          <p className="text-[10px] text-[#9fa0b8] truncate">
                            {item.seller.email || "—"}
                          </p>
                        </div>
                      )}
                    </div>

                    {item.lineItems && item.lineItems.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[9px] text-[#5a5a70] uppercase font-bold tracking-wider">
                          Line Items
                        </p>
                        <div className="space-y-1">
                          {item.lineItems.map((li: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center text-xs text-[#9fa0b8] bg-[#0c0c12] px-2.5 py-1.5 rounded-md"
                            >
                              <span className="truncate max-w-[70%] font-medium text-white">
                                {li.itemName || "Unnamed Item"}
                              </span>
                              <span>
                                {li.quantity} × {formatRevenue(li.unitPrice)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              {activeTab === "products" &&
                items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 border border-[#2a2a35]/60 bg-[#12121a]/60 rounded-xl p-4"
                  >
                    <div className="p-2.5 rounded-lg bg-[#0c0c12] border border-[#2a2a35]">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name || ""}
                          className="h-8 w-8 object-cover rounded"
                        />
                      ) : (
                        <Package className="h-8 w-8 text-[#9fa0b8]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {item.name || "Unknown Product"}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#2a2a35] text-[#9fa0b8]">
                          {item.itemType}
                        </span>
                        <span className="text-[10px] text-[#7a7a90]">
                          {item.distinctCustomers} unique buyers
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#34d399]">
                        {formatRevenueExact(item.totalRevenueCents)}
                      </p>
                      <p className="text-[10px] text-[#9fa0b8]">{item.quantitySold} units sold</p>
                    </div>
                  </div>
                ))}

              {activeTab === "customers" &&
                items.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center gap-3 border border-[#2a2a35]/60 bg-[#12121a]/60 rounded-xl p-4"
                  >
                    {item.profilePicture ? (
                      <img
                        src={item.profilePicture}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-[11px] font-bold text-[#9fa0b8] flex-shrink-0">
                        {getInitials(item.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {item.name || "Unknown"}
                        {item.country && (
                          <span className="ml-1.5 text-xs" title={item.country}>
                            {getCountryFlag(item.country)}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-[#9fa0b8] truncate">{item.email || "—"}</p>
                      <p className="text-[10px] text-[#5a5a70] mt-0.5">
                        First purchase:{" "}
                        {item.firstPurchaseAt
                          ? new Date(item.firstPurchaseAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#34d399]">
                        {formatRevenueExact(item.totalSpentCents)}
                      </p>
                      <p className="text-[10px] text-[#9fa0b8]">{item.invoiceCount} invoices</p>
                    </div>
                  </div>
                ))}

              {activeTab === "businesses" &&
                items.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center gap-3 border border-[#2a2a35]/60 bg-[#12121a]/60 rounded-xl p-4"
                  >
                    <div className="p-2.5 rounded-lg bg-[#0c0c12] border border-[#2a2a35] text-brand">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {item.name || "Unknown Business"}
                        {item.country && (
                          <span className="ml-1.5 text-xs" title={item.country}>
                            {getCountryFlag(item.country)}
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.category && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#2a2a35] text-[#9fa0b8]">
                            {item.category}
                          </span>
                        )}
                        <span className="text-[10px] text-[#7a7a90]">
                          {item.distinctCustomers} customers • {item.distinctProducts} products
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#34d399]">
                        {formatRevenueExact(item.totalRevenueCents)}
                      </p>
                      <p className="text-[10px] text-[#9fa0b8]">{item.salesCount} sales</p>
                    </div>
                  </div>
                ))}

              {/* Load more indicator / button */}
              {pagination?.hasMore && (
                <div className="pt-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full py-2.5 bg-[#12121a] hover:bg-[#1a1a24] disabled:opacity-50 text-xs font-semibold text-white rounded-lg border border-[#2a2a35] hover:border-[#3a3a45] transition-all flex items-center justify-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                        Loading more...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

