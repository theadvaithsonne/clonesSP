"use client";

import { CheckCircle2, Circle, Layers, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/docusign/shared/StatusBadge";
import type { DsBundleMember } from "@/lib/docusign/types";

// The tabs across the top of the editor when a document was uploaded together with 1–2 others (a group sent to
// the same people). Each tab is one document; a tick means every recipient has at least one field on it, which
// is what sending needs. Switching saves the current document first (the editor does that before calling onSelect).
interface BundleBarProps {
  documents: DsBundleMember[];
  currentId: string;
  // The current document's readiness from the editor's live (possibly unsaved) state, which is newer than the
  // server's count.
  currentReady?: boolean;
  onSelect: (documentId: string) => void;
  busy?: boolean;
}

export function BundleBar({ documents, currentId, currentReady, onSelect, busy }: BundleBarProps) {
  if (documents.length < 2) return null;
  const isDraft = documents.every((d) => d.status === "draft");
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-[#2a2a35] bg-[#0c0c10] px-4 py-2">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-[#7a7a90]">
        <Layers className="h-3.5 w-3.5" />
        {documents.length} documents sent together
      </span>
      <div className="flex gap-1.5">
        {documents.map((d, i) => {
          const active = d._id === currentId;
          const ready = active && currentReady !== undefined ? currentReady : d.fieldCount > 0 && d.recipientsWithoutFields.length === 0;
          return (
            <button
              key={d._id}
              type="button"
              disabled={busy || active}
              onClick={() => onSelect(d._id)}
              title={
                isDraft
                  ? ready
                    ? "Every recipient has a field on this document"
                    : d.recipientsWithoutFields.length
                      ? `No fields yet for ${d.recipientsWithoutFields.join(", ")}`
                      : "No fields placed yet"
                  : d.title
              }
              className={cn(
                "flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:cursor-default",
                active ? "border-brand bg-brand/10 text-white" : "border-[#2a2a35] text-[#8a8a9b] hover:border-[#3b3b4a] hover:text-white/85"
              )}
            >
              <span className="tabular-nums text-white/40">{i + 1}</span>
              <span className="truncate">{d.title}</span>
              {isDraft ? (
                ready ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-white/25" />
              ) : (
                <StatusBadge status={d.status} />
              )}
            </button>
          );
        })}
      </div>
      {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#7a7a90]" />}
    </div>
  );
}
