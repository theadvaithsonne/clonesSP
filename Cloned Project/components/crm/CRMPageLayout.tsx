"use client";
import CRMSidebar from "@/components/crm/CRMSidebar";
import DealsNavbar from "@/components/crm/DealsNavbar";
import { useTheme } from "next-themes";
import { isDealsInlineMode } from "@/lib/deals-events";

interface CRMPageLayoutProps {
  children: React.ReactNode;
  /** Hand the full viewport height to the page instead of scrolling it — for
   *  pages that render the shared DataTable, which owns its own vertical
   *  scroll (sticky header + pinned footer). */
  fill?: boolean;
}

export default function CRMPageLayout({ children, fill }: CRMPageLayoutProps) {
  const { theme } = useTheme();
  const inlineDeals = isDealsInlineMode();

  return (
    <div className={`flex h-screen overflow-hidden text-foreground min-w-0 ${theme === "color" ? "bg-[#0A0A1E]" : "bg-background"
      }`}>
      {/* CRM Sidebar */}
      {/* <CRMSidebar /> */}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden min-w-0 ${theme === "color" ? "bg-[#0A0A1E]" : "bg-background"
        }`}>
        {/* Inline Deals uses DealsApp header - skip route navbar */}
        {!inlineDeals && <DealsNavbar />}
        <main className={`min-w-0 ${fill
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "flex-1 overflow-y-auto overflow-x-hidden pb-28"
          } ${theme === "color" ? "bg-[#0A0A1E]" : "bg-background"
          }`}>
          {children}
        </main>
      </div>
    </div>
  );
}
