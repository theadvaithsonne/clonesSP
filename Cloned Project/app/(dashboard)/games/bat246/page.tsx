"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useMyBat246Grants, type Bat246CardKey } from "@/lib/hooks/useBat246CardAccess";
import { LayoutGrid, Users, Network, BookOpen, DollarSign, UserPlus, ShieldCheck, Wallet, Landmark } from "lucide-react";
import { setMembersCache } from "@/lib/bat246MembersCache";
import { Bat246NotificationBell } from "@/components/bat246/Bat246NotificationBell";
import { Bat246ReferralInviteButton } from "@/components/bat246/Bat246ReferralInviteButton";

// Both spellings accepted — see boards/page.tsx's identical constant for why.
const BAT246_ORGS  = ["TestCompany XYZ", "Bat246", "BAT 246"];
const API          = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Mirrors DEFAULT_ORG_CARD_KEYS in the backend's bat246Permission.service.ts
// — every Bat246-office member is granted these two automatically, so their
// presence in `grantedKeys` alone doesn't mean the person has any *real*
// (Alan-granted) admin access. Used below to tell "plain office member"
// apart from "genuinely granted admin" for routing purposes.
const DEFAULT_MEMBER_CARD_KEYS: Bat246CardKey[] = ["documentation", "b2coinwallet"];

let _statsCache: { membersCount: number; distributorsCount: number } | null = null;
let _statsCacheAt = 0;
const STATS_TTL = 60_000;

/*
 * Redesigned 2026-08-25 for readability, then reworked again the same day
 * into a simple "app icon grid" layout (large, uniform tiles — icon on
 * top, name below, like a phone home screen) since a plain list read as
 * too plain. No functionality changed — same links, same access control,
 * same data, just the visual layout.
 */

/* ─── Nav Tile ────────────────────────────────────── */
interface CardCfg {
  href: string;
  Icon: React.ElementType;
  // When set, renders this image instead of `Icon` (still required as a
  // type-safe fallback/placeholder) — same slot, same size. Used for B2
  // Coin Wallet's own branded coin artwork instead of a generic lucide
  // icon.
  iconImage?: string;
  label: string;
  sub: string;
  iconRing: string;
  iconColor: string;
  // Which grantable card this tile maps to (see useBat246CardAccess). The
  // Permissions tile has none — it's never grantable, Alan-only always.
  cardKey?: Bat246CardKey;
  // Shown to every office member who lands on this page, regardless of
  // Permissions grants — unlike the other cardKey-less tile (Permissions),
  // which stays Alan-only. Coin Wallet is the one exception.
  alwaysVisible?: boolean;
}

function NavTile({ c, number }: { c: CardCfg; number: number }) {
  return (
    <Link
      href={c.href}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border-2 border-white/10 bg-white/[0.05] hover:bg-white/[0.08] hover:border-white/25 hover:-translate-y-1 transition-all duration-200 px-6 py-7"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white border-2 border-white/15 flex items-center justify-center text-lg font-black text-black">
            {number}
          </div>
          <div className="text-lg sm:text-xl font-bold text-white leading-snug text-left">{c.label}</div>
        </div>

        {c.iconImage ? (
          // No ring/border/background for the coin artwork itself — it's
          // a real logo, not a glyph that needs a colored badge behind it.
          // Sized to fill the same footprint the ring+icon combo used to
          // occupy, so the tile's layout doesn't shift.
          <img
            src={c.iconImage}
            alt=""
            className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 object-contain transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 ${c.iconRing} flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}>
            <c.Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${c.iconColor}`} />
          </div>
        )}
      </div>

      <div className="text-base sm:text-lg text-white/65 leading-snug text-left">{c.sub}</div>
    </Link>
  );
}

/* ─── Stat Card ───────────────────────────────────── */
function StatCard({
  label, value, Icon, iconRing, iconColor, color,
}: {
  label: string; value: number; Icon: React.ElementType; iconRing: string; iconColor: string; color: string;
}) {
  return (
    <div className="flex-1 min-w-[220px] flex items-center gap-4 px-6 py-5 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border-2 border-white/10">
      <div className={`flex-shrink-0 w-14 h-14 rounded-2xl border-2 ${iconRing} flex items-center justify-center`}>
        <Icon className={`w-7 h-7 ${iconColor}`} />
      </div>
      <div>
        <div className={`text-3xl sm:text-4xl font-black ${color} leading-none`}>{value}</div>
        <div className="text-sm sm:text-base text-white/55 font-semibold mt-1">{label}</div>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────── */
export default function Bat246AdminPage() {
  const router = useRouter();
  const { userData, loading } = useAmIFounder();
  const { isAlanK, grantedKeys, loading: grantsLoading } = useMyBat246Grants();
  const [membersCount,      setMembersCount]      = useState(0);
  const [distributorsCount, setDistributorsCount] = useState(0);
  // A plain office member only ever holds the two default cards (or none) —
  // real admin access means at least one grant beyond those.
  const hasRealAdminGrant = grantedKeys.some(k => !DEFAULT_MEMBER_CARD_KEYS.includes(k));
  // Drives the "Admin Dashboard" heading + Office Members/Distributors
  // stats — plain members get a plainer "BAT 246 Dashboard" with no stats.
  const isAdmin = isAlanK || hasRealAdminGrant;
  // Starts true so a board-position holder never flashes the 3-card grid
  // before being redirected to their richer /dashboard page (unchanged
  // behavior) — set false once we know they're not one, or once it doesn't
  // apply (Alan / real admin grant).
  const [checkingBoardPosition, setCheckingBoardPosition] = useState(true);

  const CARDS: CardCfg[] = [
    {
      href:  "/games/bat246/boards",
      Icon:  LayoutGrid,
      label: "Game Boards",
      sub:   "View and manage all active boards",
      iconRing:  "border-blue-400/40 bg-blue-500/15",
      iconColor: "text-blue-300",
      cardKey: "boards",
      // Every office member can view/play their own board regardless of
      // admin board-management grants — same href, just a different reason
      // to be there. Part of the default 3-card set (Game Boards /
      // Documentation / B2 Coin Wallet) every plain member sees below.
      alwaysVisible: true,
    },
    {
      href:  "/games/bat246/members",
      Icon:  Users,
      label: "Office Members",
      sub:   "All registered members in the network",
      iconRing:  "border-violet-400/40 bg-violet-500/15",
      iconColor: "text-violet-300",
      cardKey: "members",
    },
    {
      href:  "/games/bat246/distributors",
      Icon:  Network,
      label: "Distributors",
      sub:   "Review all qualified distributors",
      iconRing:  "border-amber-400/40 bg-amber-500/15",
      iconColor: "text-amber-300",
      cardKey: "distributors",
    },
    {
      href:  "/games/bat246/documentation",
      Icon:  BookOpen,
      label: "Documentation",
      sub:   "Guides and reference for the game",
      iconRing:  "border-emerald-400/40 bg-emerald-500/15",
      iconColor: "text-emerald-300",
      cardKey: "documentation",
    },
    {
      href:  "/games/bat246/lostmoney",
      Icon:  DollarSign,
      label: "Lost Money",
      sub:   "Track lost / unresolved money",
      iconRing:  "border-red-400/40 bg-red-500/15",
      iconColor: "text-red-300",
      cardKey: "lostmoney",
    },
    {
      href:  "/games/bat246/Inviteandplace",
      Icon:  UserPlus,
      label: "Invite and Place",
      sub:   "Invite someone and place them",
      iconRing:  "border-cyan-400/40 bg-cyan-500/15",
      iconColor: "text-cyan-300",
      cardKey: "inviteandplace",
    },
    // No cardKey — Permissions is never grantable, filtered separately below.
    {
      href:  "/games/bat246/permission",
      Icon:  ShieldCheck,
      label: "Permissions",
      sub:   "Manage access and permissions",
      iconRing:  "border-pink-400/40 bg-pink-500/15",
      iconColor: "text-pink-300",
    },
    // No cardKey either, but alwaysVisible — every office member sees this
    // one regardless of Permissions grants.
    {
      href:  "/games/bat246/B2CoinWallet",
      Icon:  Wallet,
      iconImage: "/images/bat246-b2coin-logo.png",
      label: "B2 Coin Wallet",
      sub:   "View your B2 Coins balance",
      iconRing:  "border-yellow-400/40 bg-yellow-500/15",
      iconColor: "text-yellow-300",
      alwaysVisible: true,
    },
    // One tab for everyone — same alwaysVisible/no-cardKey treatment as
    // B2 Coin Wallet above. The destination page itself is role-aware:
    // admins (Alan, or anyone granted the "snapbackloans" card) see the
    // org-wide backoffice grid; everyone else sees their own loan,
    // giving power, requests, and activity. Deliberately ONE tile/route
    // rather than a separate admin-only tile — the "snapbackloans" card
    // permission still exists and still gates the admin CONTENT inside
    // that page, it just no longer gates this tile's visibility.
    {
      href:  "/games/bat246/snapbackloans",
      Icon:  Landmark,
      label: "Snap Back Loans",
      sub:   "Borrow B2 Coins for your entry, or check your loan",
      iconRing:  "border-orange-400/40 bg-orange-500/15",
      iconColor: "text-orange-300",
      alwaysVisible: true,
    },
  ];

  useEffect(() => {
    if (loading || grantsLoading) return;
    if (userData.orgName && !BAT246_ORGS.includes(userData.orgName)) {
      // Same auto-join-then-reload dance as boards/page.tsx, and sharing its
      // exact sessionStorage key: this is the page the sidebar "BAT 246"
      // link actually points to, so a brand-new invitee whose current org
      // context isn't Bat246 yet was landing here FIRST and getting bounced
      // straight to /workspace with no attempt to fix it — "clicking BAT 246
      // doesn't take me inside." Guarded to at most one attempt (shared with
      // boards/page.tsx) so the two pages can never combine into a longer
      // reload loop between them.
      if (sessionStorage.getItem("bat246_org_autojoin_attempted")) {
        router.replace("/workspace");
        return;
      }
      sessionStorage.setItem("bat246_org_autojoin_attempted", "1");

      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      fetch(`${API}/bat246/office/join`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (d?.token) {
            localStorage.setItem("garage_tok", d.token);
            localStorage.setItem("garage_org_id", d.orgId || "6a0d34e677323d1b81c6469b");
            window.location.reload();
          } else {
            router.replace("/workspace");
          }
        })
        .catch(() => router.replace("/workspace"));
      return;
    }
    if (userData.orgName && BAT246_ORGS.includes(userData.orgName)) {
      sessionStorage.removeItem("bat246_org_autojoin_attempted");
    }
    // A user with at least one *real* Permissions-page grant (beyond the two
    // defaults every office member already has) stays on this page and sees
    // just their granted tiles (below) — same as before this feature
    // existed, just no longer fooled by documentation/b2coinwallet being
    // in grantedKeys for everyone now.
    if (isAlanK || hasRealAdminGrant) {
      setCheckingBoardPosition(false);
      return;
    }
    if (!userData.email) return;
    // Board-position holders still get the richer /dashboard page (6 cards)
    // exactly as before this feature existed. Everyone else (a plain office
    // member with no board position and no real admin grant) now stays
    // right here instead of being bounced to /boards — they see the default
    // 3-card grid (Game Boards / Documentation / B2 Coin Wallet, all
    // alwaysVisible or org-default-granted).
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/my-dashboard-access`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.hasAccess) { router.replace("/games/bat246/dashboard"); return; }
        setCheckingBoardPosition(false);
      })
      .catch(() => setCheckingBoardPosition(false));
  }, [userData, loading, isAlanK, hasRealAdminGrant, grantsLoading, router]);

  useEffect(() => {
    // Stats are admin-only UI now — skip the fetch entirely for a plain
    // office member, both because they're never shown and because these
    // endpoints are admin-facing to begin with.
    if (loading || grantsLoading || !isAdmin) return;
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
  }, [loading, grantsLoading, isAdmin]);

  if (loading || grantsLoading) return null;
  if (userData.email && !isAlanK && !hasRealAdminGrant && checkingBoardPosition) return null;

  // Alan sees all 6 cards + Permissions; a granted user sees only their
  // granted cards, never Permissions (it has no cardKey, so it's excluded
  // for anyone but Alan automatically). A plain office member (no real
  // grant, no board position) falls through to here too, and sees just the
  // 3 alwaysVisible/org-default tiles — Game Boards, Documentation, B2 Coin
  // Wallet.
  const visibleCards = CARDS.filter(c => isAlanK || c.alwaysVisible || (c.cardKey && grantedKeys.includes(c.cardKey)));

  return (
    <div className="min-h-full bg-[#09090f] text-white overflow-auto">
      <div className="px-4 sm:px-12 py-6 sm:py-10 max-w-[1500px] mx-auto">

        {/* ── Header ───────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          {/* Title and the invite button share a row; on a narrow screen the
              button wraps underneath instead of squeezing the title. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-1.5">
              {isAdmin ? "BAT 246 Admin Dashboard" : "BAT 246 Dashboard"}
            </h1>
            <Bat246ReferralInviteButton />
          </div>
          <div className="flex-shrink-0">
            <Bat246NotificationBell />
          </div>
        </div>

        {/* ── Stats ── admin only, a plain member has no use for these ── */}
        {isAdmin && (
          <div className="flex items-stretch gap-4 sm:gap-5 mb-8 flex-wrap">
            <StatCard
              label="Office Members" value={membersCount}
              Icon={Users} iconRing="border-violet-400/40 bg-violet-500/15" iconColor="text-violet-300"
              color="text-violet-300"
            />
            <StatCard
              label="Distributors" value={distributorsCount}
              Icon={Network} iconRing="border-amber-400/40 bg-amber-500/15" iconColor="text-amber-300"
              color="text-amber-300"
            />
          </div>
        )}

        {/* ── Icon grid ────────────────────────────── */}
        {/* grid-cols-1 below sm: a 2-column grid on a phone (<640px) left
            each tile only ~160px wide — nowhere near enough room for the
            number badge + label + icon row (NavTile below), which was
            rendering as visibly overlapping text/icon rather than just
            tight. Single column up to sm, 2 from sm, 3 from lg. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {visibleCards.map((c, i) => (
            <NavTile key={c.href} c={c} number={i + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
