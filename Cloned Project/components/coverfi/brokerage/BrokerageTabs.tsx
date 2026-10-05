"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/coverfi/brokerage", label: "Profile" },
  { href: "/coverfi/brokerage/branding", label: "Branding" },
  { href: "/coverfi/brokerage/locations", label: "Locations" },
  { href: "/coverfi/brokerage/employees", label: "Stakeholders" },
  { href: "/coverfi/brokerage/landing", label: "Landing Page" },
];

export default function BrokerageTabs() {
  const pathname = usePathname() || "";

  return (
    <div className="border-b border-white/5 px-8">
      <nav className="flex gap-1">
        {tabs.map((t) => {
          const active =
            t.href === "/coverfi/brokerage"
              ? pathname === t.href
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative px-4 py-3 text-sm transition-colors -mb-px",
                active
                  ? "text-white border-b-2 border-brand"
                  : "text-[#9fa0b8] hover:text-white border-b-2 border-transparent",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
