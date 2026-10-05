"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Umbrella,
  ShieldCheck,
  Briefcase,
  Mail,
  UserCircle,
  MapPin,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefix?: boolean;
};

const items: NavItem[] = [
  { href: "/coverfi", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/coverfi/brokerage", label: "My Brokerage", icon: <Building2 className="h-4 w-4" />, matchPrefix: true },
  { href: "/coverfi/insurance-companies", label: "Insurance Companies", icon: <Umbrella className="h-4 w-4" /> },
  { href: "/coverfi/products", label: "Products", icon: <ShieldCheck className="h-4 w-4" />, matchPrefix: true },
  { href: "/coverfi/companies", label: "Companies", icon: <Briefcase className="h-4 w-4" />, matchPrefix: true },
  { href: "/coverfi/communication/templates", label: "Communication", icon: <Mail className="h-4 w-4" />, matchPrefix: false },
  { href: "/coverfi/roles", label: "Roles", icon: <UserCircle className="h-4 w-4" /> },
  { href: "/coverfi/office-locations", label: "Office Locations", icon: <MapPin className="h-4 w-4" /> },
  { href: "/coverfi/policy-settings", label: "Policy Settings", icon: <Settings className="h-4 w-4" /> },
];

export default function CoverfiSubnav() {
  const pathname = usePathname() || "";

  return (
    <aside className="w-60 shrink-0 border-r border-[#1c1c24] bg-[#08080b] text-white">
      <div className="px-4 py-5">
        <div className="flex items-center gap-2 mb-5 px-1">
          <div className="h-7 w-7 rounded-md bg-brand flex items-center justify-center shadow-[0_0_18px_-4px_color-mix(in_srgb,_var(--brand)_45%,_transparent)]">
            <Umbrella className="h-3.5 w-3.5 text-brand-foreground" strokeWidth={2.4} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Coverfi</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#6b6b80]">
              Brokerage backoffice
            </div>
          </div>
        </div>

        <nav className="space-y-0.5">
          {items.map((item) => {
            const active = item.matchPrefix
              ? pathname === item.href || pathname.startsWith(`${item.href}/`)
              : pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-all duration-200 ease-out",
                  active
                    ? "bg-[#15151b] text-white"
                    : "text-[#9fa0b8] hover:bg-[#101015] hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-brand transition-all duration-200 ease-out",
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-30",
                  )}
                />
                <span
                  className={cn(
                    "shrink-0 transition-colors duration-200",
                    active ? "text-brand" : "text-[#6b6b80] group-hover:text-[#c7c7da]",
                  )}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
