"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, ShieldCheck } from "lucide-react";

const BASE = "/games/bat246/lostmoney/index";

// On yourmoneyback.info, middleware.ts's LOSTMONEY_ROUTE_ALIASES rewrites
// these short paths to the real internal routes — used only there so the
// address bar reads /aboutus instead of /games/bat246/lostmoney/index/about.
// Anywhere else (my.garage.app, e.g. the admin "Lost Money Website" preview
// tile) the internal path is used directly since no such alias exists off
// that domain.
const CUSTOM_DOMAIN_NAV_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/aboutus", label: "About Us" },
  { href: "/paidlist", label: "Paid List" },
  { href: "/testimonials", label: "Testimonials" },
];

const INTERNAL_NAV_LINKS = [
  { href: `${BASE}`, label: "Home" },
  { href: `${BASE}/about`, label: "About Us" },
  { href: `${BASE}/paid`, label: "Paid List" },
  { href: `${BASE}/testimonials`, label: "Testimonials" },
];

export function SiteHeader({ isCustomDomain = false }: { isCustomDomain?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navLinks = isCustomDomain ? CUSTOM_DOMAIN_NAV_LINKS : INTERNAL_NAV_LINKS;
  const homeHref = isCustomDomain ? "/home" : BASE;
  const registerHref = isCustomDomain ? "/register" : `${BASE}/register`;

  return (
    <header className="sticky top-0 z-50 bg-stone-900/95 backdrop-blur border-b border-white/10">
      <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 h-[88px] flex items-center justify-between">
        <Link href={homeHref} className="flex items-center gap-2 text-white font-black text-xl sm:text-2xl tracking-tight">
          <ShieldCheck className="w-7 h-7 text-emerald-500" />
          YourMoneyBack.info
        </Link>

        <nav className="hidden lg:flex items-center gap-9">
          {navLinks.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-2xl font-semibold transition-colors ${
                  active ? "text-emerald-500" : "text-stone-300 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <Link
            href={registerHref}
            className="px-6 py-3.5 rounded-lg bg-emerald-700 text-white font-bold text-lg hover:bg-emerald-600 transition-colors"
          >
            Register Your Claim
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden text-stone-300 hover:text-white p-1"
          aria-label="Toggle menu"
        >
          {open ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
        </button>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-white/10 px-5 py-3 flex flex-col gap-1">
          {navLinks.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`text-2xl font-semibold py-3.5 px-2 rounded-lg transition-colors ${
                  active ? "text-emerald-500 bg-white/[0.06]" : "text-stone-300 hover:text-white hover:bg-white/5"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href={registerHref}
            onClick={() => setOpen(false)}
            className="mt-2 text-center px-5 py-3.5 rounded-lg bg-emerald-700 text-white font-bold text-lg"
          >
            Register Your Claim
          </Link>
        </nav>
      )}
    </header>
  );
}
