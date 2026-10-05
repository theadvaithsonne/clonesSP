"use client";

import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEP_LABELS = [
  "Basic info",
  "Address",
  "Employees",
  "Products & finalize",
] as const;

type Props = {
  /** Currently displayed step (1-indexed). */
  current: number;
  /** Highest step completed (0..4). 0 = step 1 not yet submitted. */
  done: number;
  onJump?: (step: number) => void;
};

export function Stepper({ current, done, onJump }: Props) {
  return (
    <ol className="flex items-center gap-1 flex-wrap">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const isComplete = done >= n;
        const isActive = current === n;
        const clickable = !!onJump && isComplete && !isActive;
        const content = (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200 border",
              isActive
                ? "bg-[#15151b] text-white border-[#3b3b4a]"
                : isComplete
                  ? "text-brand border-transparent"
                  : "text-[#9fa0b8] border-transparent",
              clickable &&
                "hover:bg-[#101015] hover:border-[#2a2a3a] cursor-pointer",
            )}
          >
            <span
              className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium border transition-colors duration-200",
                isComplete || isActive
                  ? "bg-brand/20 border-brand/40 text-brand"
                  : "bg-[#15151b] border-[#2a2a3a]",
              )}
            >
              {isComplete && !isActive ? <Check className="h-3 w-3" /> : n}
            </span>
            {label}
          </div>
        );
        return (
          <li key={n} className="flex items-center gap-1">
            {clickable ? (
              <button type="button" onClick={() => onJump!(n)} className="block">
                {content}
              </button>
            ) : (
              content
            )}
            {n < STEP_LABELS.length && (
              <ChevronRight className="h-3.5 w-3.5 text-[#3b3b4a]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
