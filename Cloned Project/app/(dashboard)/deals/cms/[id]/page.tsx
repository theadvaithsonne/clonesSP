"use client";

import { useParams, useRouter } from "next/navigation";
import DealsNavbar from "@/components/crm/DealsNavbar";
import PageBuilderShell from "@/components/deals/cms/PageBuilderShell";
import CmsPageAccessGuard from "@/components/deals/cms/CmsPageAccessGuard";
import { isDealsInlineMode } from "@/lib/deals-events";

export default function DealsCmsBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const pageId = String(params?.id || "");
  const inline = typeof window !== "undefined" && isDealsInlineMode();

  if (!pageId) return null;

  return (
    <CmsPageAccessGuard>
      <div className="flex h-full min-h-[100vh] flex-col">
        {!inline ? <DealsNavbar /> : null}
        <div className="min-h-0 flex-1">
          <PageBuilderShell
            pageId={pageId}
            onBack={() => {
              router.push("/deals/cms");
            }}
          />
        </div>
      </div>
    </CmsPageAccessGuard>
  );
}
