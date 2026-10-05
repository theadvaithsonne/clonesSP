"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { X, BriefcaseBusiness, RefreshCw } from "lucide-react";
import {
  dispatchDealsInlineRefresh,
  type DealsInlineSection,
} from "@/lib/deals-events";
import type { InlineAppProps } from "../registry";
import DealsMobileNav from "./DealsMobileNav";
import CmsAccessGateHost from "@/components/deals/cms/CmsAccessGateHost";

type DealsSection =
  | "dashboard"
  | "leads"
  | "funnel"
  | "contacts"
  | "companies"
  | "products"
  | "cms";

const DealsDashboardPage = dynamic(() => import("@/app/(dashboard)/deals/page"), {
  ssr: false,
});
const DealsLeadsPage = dynamic(() => import("@/app/(dashboard)/deals/leads/page"), {
  ssr: false,
});
const DealsFunnelPage = dynamic(() => import("@/app/(dashboard)/deals/funnel/page"), {
  ssr: false,
});
const DealsContactsPage = dynamic(() => import("@/app/(dashboard)/deals/contacts/page"), {
  ssr: false,
});
const DealsCompaniesPage = dynamic(() => import("@/app/(dashboard)/deals/companies/page"), {
  ssr: false,
});
const DealsProductsPage = dynamic(() => import("@/app/(dashboard)/deals/products/page"), {
  ssr: false,
});
const DealsCmsPage = dynamic(() => import("@/app/(dashboard)/deals/cms/page"), {
  ssr: false,
});
const DealsLeadDetailsPage = dynamic(
  () => import("@/app/(dashboard)/deals/leads/[id]/page"),
  { ssr: false }
);

const SECTION_TITLE: Record<DealsSection, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  funnel: "Funnels",
  contacts: "Contacts",
  companies: "Companies",
  products: "Products & Services",
  cms: "CMS",
};

function resolveSection(section?: string): DealsSection {
  if (
    section === "dashboard" ||
    section === "leads" ||
    section === "funnel" ||
    section === "contacts" ||
    section === "companies" ||
    section === "products" ||
    section === "cms"
  ) {
    return section;
  }
  return "dashboard";
}

export default function DealsApp({ onClose, section }: InlineAppProps) {
  const [inlineLeadId, setInlineLeadId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mountLeadsAddLeadModal, setMountLeadsAddLeadModal] = useState(false);

  // Set synchronously so child route pages detect inline mode on first paint.
  if (typeof window !== "undefined") {
    (window as any).__garageDealsInline = true;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pendingLeadId = sessionStorage.getItem("deals:inline-pending-lead-id");
    if (pendingLeadId) {
      setInlineLeadId(pendingLeadId);
      sessionStorage.removeItem("deals:inline-pending-lead-id");
    }

    const openLeadHandler = (event: Event) => {
      const customEvent = event as CustomEvent<{ leadId?: string }>;
      const leadId = customEvent.detail?.leadId;
      if (!leadId) return;
      setInlineLeadId(String(leadId));
    };

    const backToLeadsHandler = () => {
      setInlineLeadId(null);
    };

    window.addEventListener("deals:inline-open-lead", openLeadHandler as EventListener);
    window.addEventListener("deals:inline-back-to-leads", backToLeadsHandler);

    return () => {
      window.removeEventListener("deals:inline-open-lead", openLeadHandler as EventListener);
      window.removeEventListener("deals:inline-back-to-leads", backToLeadsHandler);
      (window as any).__garageDealsInline = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (inlineLeadId) {
      sessionStorage.setItem("deals:inline-lead-id", inlineLeadId);
    } else {
      sessionStorage.removeItem("deals:inline-lead-id");
    }
  }, [inlineLeadId]);

  useEffect(() => {
    // If section changed from the sidebar, drop detail state and show chosen section.
    setInlineLeadId(null);
  }, [section]);

  const activeSection = useMemo(() => {
    if (inlineLeadId) return "leads";
    return resolveSection(section);
  }, [inlineLeadId, section]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("deals:inline-section", activeSection);
    window.dispatchEvent(
      new CustomEvent("deals:inline-section-change", {
        detail: { section: activeSection },
      })
    );
  }, [activeSection]);

  // Open full "Add Lead" modal in-place (no navigation) by mounting the Leads page invisibly.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const requestOpen = () => {
      setMountLeadsAddLeadModal(true);
      // After mount, dispatch the event that the Leads page already listens to.
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("deals:open-add-lead"));
      }, 0);
    };

    window.addEventListener("deals:open-add-lead-request", requestOpen as EventListener);
    return () => {
      window.removeEventListener("deals:open-add-lead-request", requestOpen as EventListener);
    };
  }, []);

  const handleRefresh = () => {
    const refreshSection: DealsInlineSection = inlineLeadId ? "leads-detail" : activeSection;
    setIsRefreshing(true);
    dispatchDealsInlineRefresh(refreshSection);
    window.setTimeout(() => setIsRefreshing(false), 600);
  };

  const renderSection = () => {
    if (inlineLeadId) {
      return <DealsLeadDetailsPage />;
    }

    switch (activeSection) {
      case "leads":
        return <DealsLeadsPage />;
      case "funnel":
        return <DealsFunnelPage />;
      case "contacts":
        return <DealsContactsPage />;
      case "companies":
        return <DealsCompaniesPage />;
      case "products":
        return <DealsProductsPage />;
      case "cms":
        return <DealsCmsPage />;
      case "dashboard":
      default:
        return <DealsDashboardPage />;
    }
  };

  return (
    <div className="deals-inline-shell dark flex h-full flex-col bg-[#0e0e0e] text-white">
      <CmsAccessGateHost />
      <main className="flex-1 min-h-0 min-w-0 overflow-auto">
        {renderSection()}
        {mountLeadsAddLeadModal ? (
          <div className="hidden">
            <DealsLeadsPage />
          </div>
        ) : null}
      </main>
      <style jsx global>{`
        .deals-inline-shell {
          color-scheme: dark;
        }

        .deals-inline-shell main {
          overflow-x: hidden;
        }

        /* Force dark app canvas for inline Deals pages */
        .deals-inline-shell,
        .deals-inline-shell [class*="bg-background"] {
          background-color: #0e0e0e !important;
        }

        /* Use the inline shell header only (avoid double top bars) */
        .deals-inline-shell .deals-navbar-root {
          display: none !important;
        }

        /* Route pages use h-screen; inside inline app they should fit container */
        .deals-inline-shell .h-screen {
          height: 100% !important;
        }

        /* Normalize common light surfaces that appear in routed pages */
        .deals-inline-shell .bg-white,
        .deals-inline-shell [class*="bg-white"] {
          background-color: #13131a !important;
          color: #e7e7ee !important;
        }

        /* When routed pages render "light mode" token classes in inline mode,
           force readable text contrast on dark cards/backgrounds. */
        .deals-inline-shell [class*="text-[#1f1f1f]"],
        .deals-inline-shell [class*="text-[#111827]"],
        .deals-inline-shell [class*="text-[#374151]"],
        .deals-inline-shell [class*="text-gray-900"],
        .deals-inline-shell [class*="text-gray-800"],
        .deals-inline-shell [class*="text-gray-700"],
        .deals-inline-shell [class*="text-gray-600"] {
          color: #ececf4 !important;
        }

        .deals-inline-shell [class*="text-[#6b7280]"],
        .deals-inline-shell [class*="text-gray-500"],
        .deals-inline-shell [class*="text-gray-400"] {
          color: #b8bbcc !important;
        }

        /* Ensure key metric numbers/labels inside cards remain visible */
        .deals-inline-shell [class*="font-bold"],
        .deals-inline-shell [class*="font-semibold"] {
          text-shadow: 0 0 0.01px rgba(255, 255, 255, 0.2);
        }

        /* Improve visibility where text defaults to dark in route pages */
        .deals-inline-shell .text-black,
        .deals-inline-shell [class*="text-black"] {
          color: #e7e7ee !important;
        }

        /* Keep borders visible on dark surfaces */
        .deals-inline-shell [class*="border-[#e5e7eb]"],
        .deals-inline-shell [class*="border-gray-200"] {
          border-color: rgba(255, 255, 255, 0.14) !important;
        }

        /* Inputs/selects should not render bright white */
        .deals-inline-shell input,
        .deals-inline-shell select,
        .deals-inline-shell textarea {
          background-color: #16161f;
          color: #ececf4;
          border-color: rgba(255, 255, 255, 0.18);
        }

        /* Date inputs: keep placeholder/value visible on narrow mobile widths */
        .deals-inline-shell input[type="date"] {
          min-width: 0;
          color-scheme: dark;
        }

        .deals-inline-shell input[type="date"]::-webkit-date-and-time-value {
          text-align: left;
          min-width: 0;
        }

        .deals-inline-shell input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 1;
          filter: none !important;
          background-color: transparent;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: center;
          background-size: 14px 14px;
          width: 14px;
          height: 14px;
          padding: 0;
          color: transparent;
        }
      `}</style>
    </div>
  );
}
