"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DealsNavbar from "@/components/crm/DealsNavbar";
import CmsDashboard from "@/components/deals/cms/CmsDashboard";
import PageBuilderShell from "@/components/deals/cms/PageBuilderShell";
import CmsPageAccessGuard from "@/components/deals/cms/CmsPageAccessGuard";
import { isDealsInlineMode } from "@/lib/deals-events";

export default function DealsCmsPage() {
  const router = useRouter();
  const inline = typeof window !== "undefined" && isDealsInlineMode();
  const [builderId, setBuilderId] = useState<string | null>(null);

  const openBuilder = (pageId: string) => {
    if (inline) {
      setBuilderId(pageId);
      return;
    }
    router.push(`/deals/cms/${pageId}`);
  };

  if (builderId) {
    return (
      <CmsPageAccessGuard>
        <div className="flex h-full min-h-0 flex-col">
          {!inline ? <DealsNavbar /> : null}
          <div className="min-h-0 flex-1">
            <PageBuilderShell pageId={builderId} onBack={() => setBuilderId(null)} />
          </div>
        </div>
      </CmsPageAccessGuard>
    );
  }

  return (
    <CmsPageAccessGuard>
      <div className="flex h-full min-h-0 flex-col">
        {!inline ? <DealsNavbar /> : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <CmsDashboard onOpenBuilder={openBuilder} />
        </div>
      </div>
    </CmsPageAccessGuard>
  );
}
