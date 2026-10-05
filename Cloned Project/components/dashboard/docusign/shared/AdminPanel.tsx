"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MembersTab } from "@/components/dashboard/docusign/shared/admin/MembersTab";
import { BrandingTab } from "@/components/dashboard/docusign/shared/admin/branding/BrandingTab";

// Founder/admin only (DocusignPage gates it; the backend enforces it).
const TABS = ["Members", "Branding"] as const;
type AdminTab = (typeof TABS)[number];

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("Members");
  // Branding edits live only in that tab until saved — leaving it would silently drop them.
  const [brandingDirty, setBrandingDirty] = useState(false);

  const selectTab = (next: AdminTab) => {
    if (next === tab) return;
    if (tab === "Branding" && brandingDirty && !window.confirm("Discard unsaved branding changes?")) return;
    setBrandingDirty(false);
    setTab(next);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-white">Admin</h2>
        <p className="text-sm text-[#8a8a9b]">
          Control who can use Docusign and what they can do. Founders always have full access.
        </p>
      </div>

      <div className="border-b border-[#2a2a35]">
        <nav className="flex gap-6 overflow-x-auto" role="tablist" aria-label="Admin sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => selectTab(t)}
              className={cn(
                "-mb-px shrink-0 border-b-2 pb-3 text-sm transition-colors",
                tab === t
                  ? "border-brand font-semibold text-white"
                  : "border-transparent text-[#8a8a9b] hover:text-white/80"
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === "Members" ? <MembersTab /> : <BrandingTab onDirtyChange={setBrandingDirty} />}
    </div>
  );
}
