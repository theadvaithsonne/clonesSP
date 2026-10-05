"use client";

import Link from "next/link";
import { ChevronLeft, Globe, ClipboardList, DollarSign } from "lucide-react";

/*
 * Redesigned 2026-08-26 to match the Bat246 Admin home page style —
 * numbered, high-contrast cards with a colored icon badge, no hover-only
 * affordances, bigger text throughout. No functionality changed, same
 * three links.
 */

interface CardCfg {
  href: string;
  Icon: React.ElementType;
  label: string;
  sub: string;
  iconRing: string;
  iconColor: string;
}

const CARDS: CardCfg[] = [
  {
    href:  "/games/bat246/lostmoney/index",
    Icon:  Globe,
    label: "Lost Money Website",
    sub:   "View the public Lost Money website",
    iconRing:  "border-amber-400/40 bg-amber-500/15",
    iconColor: "text-amber-300",
  },
  {
    href:  "/games/bat246/lostmoney/admin",
    Icon:  ClipboardList,
    label: "Lost Money Backoffice",
    sub:   "Review submitted claims and approve testimonials",
    iconRing:  "border-blue-400/40 bg-blue-500/15",
    iconColor: "text-blue-300",
  },
  {
    href:  "/games/bat246/lostmoney/paidlist",
    Icon:  DollarSign,
    label: "View Paid List",
    sub:   "View and manage the Paid List",
    iconRing:  "border-emerald-400/40 bg-emerald-500/15",
    iconColor: "text-emerald-300",
  },
];

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

        <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 ${c.iconRing} flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}>
          <c.Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${c.iconColor}`} />
        </div>
      </div>

      <div className="text-base sm:text-lg text-white/65 leading-snug text-left">{c.sub}</div>
    </Link>
  );
}

export default function Bat246LostMoneyPage() {
  return (
    <div className="min-h-full bg-[#09090f] text-white overflow-auto">
      <div className="px-6 sm:px-12 py-8 sm:py-10 max-w-[1500px] mx-auto">

        {/* ── Header ───────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/games/bat246"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-sm font-semibold transition-colors group mb-3"
          >
            <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            Admin Board
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-1.5">Lost Money</h1>
          <p className="text-white/60 text-base sm:text-lg font-medium">BAT 246</p>
        </div>

        {/* ── Nav tiles ────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          {CARDS.map((c, i) => (
            <NavTile key={c.href} c={c} number={i + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
