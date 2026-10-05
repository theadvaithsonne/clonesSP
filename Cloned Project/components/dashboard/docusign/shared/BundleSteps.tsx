"use client";

import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DsBundleStepper } from "@/lib/docusign/types";

// For a signer of documents sent together (a group): where they are — "Document 2 of 3" — and each document's
// state for them. Clicking another document opens it. Shared by the in-app signing view and the public link page.
type Step = DsBundleStepper["documents"][number];

const SIGNABLE = ["sent", "in_progress"];
export const isStepOpen = (d: Step) => SIGNABLE.includes(d.status) && (d.myStatus === "pending" || d.myStatus === "viewed");

// The next document still waiting on this signer after `currentId` (wrapping around), or null when none is left.
export const nextOpenStep = (bundle: DsBundleStepper | null | undefined, currentId: string): Step | null => {
  if (!bundle) return null;
  const docs = bundle.documents;
  const at = Math.max(0, docs.findIndex((d) => String(d._id) === String(currentId)));
  const ordered = [...docs.slice(at + 1), ...docs.slice(0, at)];
  return ordered.find(isStepOpen) || null;
};

interface BundleStepsProps {
  bundle: DsBundleStepper;
  currentId: string;
  onSelect: (documentId: string) => void;
  disabled?: boolean;
}

export function BundleSteps({ bundle, currentId, onSelect, disabled }: BundleStepsProps) {
  const docs = bundle.documents;
  const at = docs.findIndex((d) => String(d._id) === String(currentId));
  const done = docs.filter((d) => d.myStatus === "signed").length;
  return (
    <div className="flex items-center gap-3 overflow-x-auto border-b border-[#1e1e2e] bg-[#0c0c10] px-4 py-2">
      <span className="shrink-0 text-xs text-white/70">
        Document <span className="font-semibold text-white">{at + 1}</span> of {docs.length}
        <span className="ml-2 text-[#7a7a90]">· {done} signed</span>
      </span>
      <div className="flex gap-1.5">
        {docs.map((d, i) => {
          const active = String(d._id) === String(currentId);
          const Icon = d.myStatus === "signed" ? CheckCircle2 : d.myStatus === "declined" || d.status === "voided" ? XCircle : Circle;
          const tone = d.myStatus === "signed" ? "text-emerald-400" : d.myStatus === "declined" || d.status === "voided" ? "text-red-400" : "text-white/30";
          return (
            <button
              key={String(d._id)}
              type="button"
              onClick={() => onSelect(String(d._id))}
              disabled={disabled || active}
              className={cn(
                "flex max-w-[200px] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:cursor-default",
                active ? "border-brand bg-brand/10 text-white" : "border-[#2a2a35] text-[#8a8a9b] hover:border-[#3b3b4a] hover:text-white/85"
              )}
            >
              <span className="tabular-nums text-white/40">{i + 1}</span>
              <span className="truncate">{d.title}</span>
              <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
