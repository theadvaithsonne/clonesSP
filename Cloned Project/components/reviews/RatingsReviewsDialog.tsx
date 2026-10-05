"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RateOfficesForm } from "./RateOfficesForm";
import { ReviewsModerationList } from "./ReviewsModerationList";
import { cn } from "@/lib/utils";

type Tab = "write" | "manage";

interface RatingsReviewsDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Viewer is a founder of `orgId`. Unlocks the "All reviews" tab, where they
   * can delete any review across every product the office owns.
   */
  amIFounder?: boolean;
  /** The office whose reviews the founder tab moderates — the signed-in org. */
  orgId?: string | null;
}

/**
 * The "Ratings & Reviews" entry point from the sidebar user menu.
 *
 * Everyone gets the write form, with an office picker on top so a member can
 * rate one or several of the offices they've joined in one go. Founders
 * additionally get a tab listing every review across the office's communities,
 * courses, digital products, workshops, services and calls, where the one
 * available action is deleting.
 */
export function RatingsReviewsDialog({
  open,
  onClose,
  amIFounder = false,
  orgId,
}: RatingsReviewsDialogProps) {
  const [tab, setTab] = useState<Tab>("write");

  // Founders land on the queue — reading feedback is what they open this for,
  // while writing a review is the members' path.
  useEffect(() => {
    if (open) setTab(amIFounder && orgId ? "manage" : "write");
  }, [open, amIFounder, orgId]);

  // Escape to close, and lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const showTabs = amIFounder && Boolean(orgId);

  return (
    <div
      className="lg-backdrop fixed inset-0 z-[9998] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ratings and reviews"
        className="lg-shell lg-scope w-full max-w-[560px] max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-3 px-6 pt-5 pb-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white leading-tight tracking-[-0.01em]">
              Ratings &amp; Reviews
            </h2>
            <p className="text-xs text-[#9a9aab] mt-1">
              {tab === "manage"
                ? "Every review across your office. You can remove a comment; the rating stays."
                : "Rate the offices you've joined."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg-icon-btn p-1.5 -mt-0.5 rounded-full text-[#c4c4d4] hover:text-white cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showTabs && (
          <div className="relative z-10 px-6 pb-4 shrink-0">
            <div
              role="tablist"
              className="lg-panel flex items-center gap-1 rounded-2xl p-1"
            >
              {(
                [
                  { id: "manage", label: "All reviews" },
                  { id: "write", label: "Rate an office" },
                ] as { id: Tab; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "lg-chip flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer",
                    tab === item.id
                      ? "lg-chip-active text-white"
                      : "text-[#9a9aab] hover:text-white",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative z-10 px-6 pb-6 overflow-y-auto">
          {tab === "manage" && orgId ? (
            <ReviewsModerationList orgId={orgId} />
          ) : (
            // The form closes itself once every selected office succeeded; it
            // deliberately stays open on a partial failure so the offices that
            // didn't go through are still on screen.
            <RateOfficesForm
              open={open && tab === "write"}
              onClose={onClose}
              defaultOfficeId={orgId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
