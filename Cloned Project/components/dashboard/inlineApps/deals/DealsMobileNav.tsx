"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  UserPlus,
  TrendingUp,
  Users2,
  Building,
  Package,
  LayoutTemplate,
  Menu,
  BriefcaseBusiness,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { dispatchDealsInlineNavigate } from "@/lib/deals-events";

export type DealsNavSection =
  | "dashboard"
  | "leads"
  | "funnel"
  | "contacts"
  | "companies"
  | "products"
  | "cms";

const MENU_ITEMS: Array<{
  id: DealsNavSection;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: UserPlus },
  { id: "funnel", label: "Funnels", icon: TrendingUp },
  { id: "contacts", label: "Contacts", icon: Users2 },
  { id: "companies", label: "Companies", icon: Building },
  { id: "products", label: "Products & Services", icon: Package },
  { id: "cms", label: "CMS", icon: LayoutTemplate },
];

type DealsMobileNavProps = {
  activeSection: DealsNavSection;
};

export default function DealsMobileNav({ activeSection }: DealsMobileNavProps) {
  const [open, setOpen] = useState(false);

  const handleNavigate = (section: DealsNavSection) => {
    dispatchDealsInlineNavigate(section);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors"
        title="Open Deals menu"
        aria-label="Open Deals menu"
      >
        <Menu className="h-4 w-4 text-[#9ea0b6]" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[280px] sm:max-w-[280px] bg-[#0e0e12] border-[#2a2a35] text-white p-0 gap-0"
        >
          <SheetHeader className="px-4 py-4 border-b border-[#2a2a35]">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-brand text-brand-foreground flex items-center justify-center shrink-0">
                <BriefcaseBusiness className="h-4 w-4" />
              </div>
              <SheetTitle className="text-white text-sm font-semibold">
                Deals
              </SheetTitle>
            </div>
          </SheetHeader>

          <nav className="flex-1 overflow-y-auto py-2">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-[#15151b] text-white"
                      : "text-[#9ea0b6] hover:bg-[#15151b] hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
