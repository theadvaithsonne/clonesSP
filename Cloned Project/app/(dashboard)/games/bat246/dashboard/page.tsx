"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { LayoutGrid, Users, Network, ArrowUpRight, Activity, UserPlus, Wallet } from "lucide-react";
import { setMembersCache } from "@/lib/bat246MembersCache";
import { Bat246NotificationBell } from "@/components/bat246/Bat246NotificationBell";
import { Bat246ReferralInviteButton } from "@/components/bat246/Bat246ReferralInviteButton";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let _statsCache: { membersCount: number; distributorsCount: number } | null = null;
let _statsCacheAt = 0;
const STATS_TTL = 60_000;

interface CardCfg {
  href: string;
  Icon: React.ElementType;
  // When set, renders this image instead of `Icon` in both icon slots
  // below (still required as a type-safe fallback) — same slots, same
  // sizes. Used for B2 Coin Wallet's own branded coin artwork instead of
  // a generic lucide icon.
  iconImage?: string;
  label: string;
  sub: string;
  accentLine: string;
  glow: string;
  iconRing: string;
  iconColor: string;
  count: number | null;
  countColor: string;
}

/** "YMB" lettermark, drawn as an icon so it slots into the card's Icon slot
 *  like a lucide glyph — scales to the given size and inherits currentColor
 *  from the card's iconColor class. */
function YmbIcon({
  style,
  className,
}: {
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" style={style} className={className} aria-hidden>
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="8"
        fontWeight="800"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        YMB
      </text>
    </svg>
  );
}

function NavCard({ c }: { c: CardCfg }) {
  return (
    <Link
      href={c.href}
      className="group relative overflow-hidden rounded-xl border border-white/[0.08] flex flex-col transition-all duration-300 hover:border-white/20"
      style={{ background: "linear-gradient(145deg, #0e0e1c 0%, #0a0a10 100%)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = c.glow; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      <div className={`h-[2px] w-full bg-gradient-to-r ${c.accentLine}`} />
      <div className="absolute -bottom-4 -right-4 opacity-[0.035] pointer-events-none">
        {c.iconImage ? (
          <img src={c.iconImage} alt="" style={{ width: 90, height: 90 }} className="object-contain" />
        ) : (
          <c.Icon style={{ width: 90, height: 90 }} />
        )}
      </div>

      <div className="relative flex flex-col flex-1 p-4">
        <div className="flex items-start justify-between mb-3">
          {c.iconImage ? (
            // No ring/border/background for the coin artwork — real logo,
            // not a glyph. Filled to the same w-9 h-9 footprint the
            // ring+icon combo used to occupy.
            <img src={c.iconImage} alt="" style={{ width: 36, height: 36 }} className="object-contain" />
          ) : (
            <div className={`w-9 h-9 rounded-xl border ${c.iconRing} flex items-center justify-center`}>
              <c.Icon style={{ width: 16, height: 16 }} className={c.iconColor} />
            </div>
          )}
          <ArrowUpRight
            style={{ width: 14, height: 14 }}
            className={`text-white/10 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${c.iconColor} opacity-0 group-hover:opacity-60`}
          />
        </div>

        <div className="flex-1">
          <div className="text-[14px] font-bold text-white/90 mb-1">{c.label}</div>
          <div className="text-[11px] text-white/35 leading-relaxed">{c.sub}</div>
        </div>

        <div className="flex items-end justify-between mt-3 pt-3 border-t border-white/[0.06]">
          {c.count !== null ? (
            <div>
              <div className={`text-2xl font-black ${c.countColor} leading-none`}>{c.count}</div>
              <div className="text-[10px] text-white/25 uppercase tracking-wider mt-1">Total</div>
            </div>
          ) : (
            <div className={`text-[11px] font-semibold ${c.countColor} uppercase tracking-wider`}>
              BAT 246
            </div>
          )}
          <span className={`text-[11px] font-semibold ${c.iconColor} opacity-0 group-hover:opacity-100 transition-opacity`}>
            Open →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Bat246DashboardPage() {
  const router = useRouter();
  const { userData, loading } = useAmIFounder();
  const [membersCount, setMembersCount] = useState(0);
  const [distributorsCount, setDistributorsCount] = useState(0);
  const [checking, setChecking] = useState(true);

  // Access check — only homePlate/3rdBase/2ndBaseA/B/1stBase holders may stay here
  useEffect(() => {
    if (loading) return;
    if (userData.email === "redbaron2020@mail.com") { setChecking(false); return; }
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/my-dashboard-access`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.hasAccess) router.replace("/games/bat246/boards");
        else setChecking(false);
      })
      .catch(() => router.replace("/games/bat246/boards"));
  }, [userData, loading, router]);

  useEffect(() => {
    if (_statsCache && Date.now() - _statsCacheAt < STATS_TTL) {
      setMembersCount(_statsCache.membersCount);
      setDistributorsCount(_statsCache.distributorsCount);
      return;
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/office/bat246/members`, { headers }).then(r => r.json()).then(d => { setMembersCache(d); return d; }),
      fetch(`${API}/bat246/distributors?page=1&limit=1`, { headers }).then(r => r.json()),
    ])
      .then(([membersRes, distRes]) => {
        const result = {
          membersCount:      membersRes.totalMembers ?? 0,
          distributorsCount: distRes.total           ?? 0,
        };
        _statsCache   = result;
        _statsCacheAt = Date.now();
        setMembersCount(result.membersCount);
        setDistributorsCount(result.distributorsCount);
      })
      .catch(() => {});
  }, []);

  const CARDS: CardCfg[] = [
    {
      href:       "/games/bat246/boards",
      Icon:       LayoutGrid,
      label:      "Boards",
      sub:        "View and manage all active HRI BAT 246 game boards",
      accentLine: "from-transparent via-blue-500/60 to-transparent",
      glow:       "0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(59,130,246,0.06)",
      iconRing:   "border-blue-500/25 bg-blue-500/10",
      iconColor:  "text-blue-400",
      count:      null,
      countColor: "text-blue-400",
    },
    {
      href:       "/games/bat246/members",
      Icon:       Users,
      label:      "Office Members",
      sub:        "View all registered office members in the BAT 246 network",
      accentLine: "from-transparent via-violet-500/60 to-transparent",
      glow:       "0 0 40px rgba(139,92,246,0.15), 0 0 80px rgba(139,92,246,0.06)",
      iconRing:   "border-violet-500/25 bg-violet-500/10",
      iconColor:  "text-violet-400",
      count:      membersCount,
      countColor: "text-violet-400",
    },
    {
      href:       "/games/bat246/distributors",
      Icon:       Network,
      label:      "Distributors",
      sub:        "Manage and review all qualified BAT 246 distributors",
      accentLine: "from-transparent via-amber-500/60 to-transparent",
      glow:       "0 0 40px rgba(245,158,11,0.15), 0 0 80px rgba(245,158,11,0.06)",
      iconRing:   "border-amber-500/25 bg-amber-500/10",
      iconColor:  "text-amber-400",
      count:      distributorsCount,
      countColor: "text-amber-400",
    },
    {
      href:       "/games/bat246/Inviteandplace",
      Icon:       UserPlus,
      label:      "Invite and Place",
      sub:        "Invite a new member and place them on a board",
      accentLine: "from-transparent via-cyan-500/60 to-transparent",
      glow:       "0 0 40px rgba(6,182,212,0.15), 0 0 80px rgba(6,182,212,0.06)",
      iconRing:   "border-cyan-500/25 bg-cyan-500/10",
      iconColor:  "text-cyan-400",
      count:      null,
      countColor: "text-cyan-400",
    },
    {
      href:       "/games/bat246/lostmoney",
      Icon:       YmbIcon,
      label:      "YourMoneyBack",
      sub:        "The YourMoneyBack.info site, submitted entries and paid list",
      accentLine: "from-transparent via-emerald-500/60 to-transparent",
      glow:       "0 0 40px rgba(16,185,129,0.15), 0 0 80px rgba(16,185,129,0.06)",
      iconRing:   "border-emerald-500/25 bg-emerald-500/10",
      iconColor:  "text-emerald-400",
      count:      null,
      countColor: "text-emerald-400",
    },
    {
      href:       "/games/bat246/B2CoinWallet",
      Icon:       Wallet,
      iconImage:  "/images/bat246-b2coin-logo.png",
      label:      "B2 Coin Wallet",
      sub:        "View your B2 Coins balance",
      accentLine: "from-transparent via-yellow-500/60 to-transparent",
      glow:       "0 0 40px rgba(234,179,8,0.15), 0 0 80px rgba(234,179,8,0.06)",
      iconRing:   "border-yellow-500/25 bg-yellow-500/10",
      iconColor:  "text-yellow-400",
      count:      null,
      countColor: "text-yellow-400",
    },
  ];

  if (checking) return null;

  return (
    <div className="min-h-full bg-[#09090f] text-white overflow-auto">

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="relative border-b border-white/[0.06]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-blue-600/6 blur-3xl" />
          <div className="absolute -top-16 right-24 w-72 h-72 rounded-full bg-violet-600/6 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-80 h-40 rounded-full bg-amber-600/4 blur-3xl" />

          <div
            className="absolute inset-0 opacity-[0.3]"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        <div className="relative px-4 sm:px-8 py-5 max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between gap-4 sm:gap-8 flex-wrap">
            {/* Title block and the invite button share a row; on a narrow
                screen the button wraps underneath. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <h1 className="text-2xl font-black leading-none tracking-tight mb-1">
                  <span className="bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent">
                    Dashboard
                  </span>
                </h1>
                <p className="text-white/30 text-[12px] font-medium tracking-wide">
                  BAT 246 Dashboard
                </p>
              </div>
              <Bat246ReferralInviteButton />
            </div>

            <div className="flex-shrink-0 flex items-center gap-3">
              <Bat246NotificationBell />
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/10">
                <Activity style={{ width: 12, height: 12 }} className="text-green-400" />
                <span className="text-[10px] font-semibold text-green-400">Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cards ────────────────────────────────────── */}
      <div className="px-4 sm:px-8 py-6 max-w-[1400px] mx-auto">
        {/* grid-cols-1 below sm, same reasoning as games/bat246/page.tsx's
            icon grid: a fixed 3-column grid squeezed each card to ~100px
            wide on a phone, nowhere near enough room for its icon badge +
            label + sub text. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map((c) => (
            <NavCard key={c.href} c={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
