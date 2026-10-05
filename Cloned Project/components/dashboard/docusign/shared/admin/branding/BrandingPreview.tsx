"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveEmailFrame } from "@/components/shared/EmailTemplatePreview";
import type { DsBrandingPreview } from "@/lib/docusign/types";

interface BrandingPreviewProps {
  preview: DsBrandingPreview | null;
  isLoading: boolean;
  error: string | null;
}

// The inbox header an email client would show above the message — who it's from, where replies go.
function InboxStrip({ preview }: { preview: DsBrandingPreview }) {
  const rows: Array<[string, string]> = [
    ["From", preview.from],
    ["Reply-to", preview.replyTo || "Not set — replies go to the sending address"],
    ["Subject", preview.subject],
  ];
  return (
    <div className="space-y-1 border-b border-black/[0.06] bg-white px-4 py-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-3 text-xs">
          <span className="w-16 shrink-0 text-zinc-400">{label}</span>
          <span className={cn("min-w-0 break-words", label === "Subject" ? "font-semibold text-zinc-900" : "text-zinc-600")}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// The email exactly as it would go out — rendered by the backend with the same builders as the real emails.
export function BrandingPreview({ preview, isLoading, error }: BrandingPreviewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white/90">Preview</h3>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7a7a90]" />}
      </div>

      {preview ? (
        <div className={cn("overflow-hidden rounded-xl border border-[#2a2a35] transition-opacity", isLoading && "opacity-80")}>
          <InboxStrip preview={preview} />
          <div className="bg-[#f4f4f5]">
            <ResponsiveEmailFrame html={preview.html} title="Email preview" emailWidth={600} fallbackHeight={520} />
          </div>
        </div>
      ) : error ? (
        <div className="grid h-80 place-items-center rounded-xl border border-[#2a2a35] bg-[#111116] px-6 text-center text-xs text-[#8a8a9b]">{error}</div>
      ) : (
        <div className="h-[520px] animate-pulse rounded-xl bg-white/[0.04]" />
      )}
    </div>
  );
}
