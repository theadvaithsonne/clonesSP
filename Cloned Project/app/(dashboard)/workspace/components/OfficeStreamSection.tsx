"use client";

import { memo, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface PreviewPerson {
  key: string;
  name: string;
  profilePicture?: string;
  isAgent?: boolean;
  id?: string;
}

interface OfficeStreamSectionProps {
  title: string;
  /**
   * Total number of members in this section (Team / Customers / Affiliates).
   * Drives the right-side count + the "more" overflow math. The previous
   * `onlineCount` prop was retired along with the live-presence indicators;
   * the section now shows a preview slice of all members.
   */
  totalCount: number;
  /** How many additional members exist beyond the preview slice. */
  overflowCount: number;
  /** Number of members visible in this preview render (caller decides). */
  previewCount: number;
  onViewAll: () => void;
  /** Small avatar data for mobile 2x2 grid preview */
  previewPeople: PreviewPerson[];
  /** Full interactive cards shown on desktop */
  children: ReactNode;
}

export const OfficeStreamSection = memo(function OfficeStreamSection({
  title,
  totalCount,
  overflowCount,
  previewCount,
  onViewAll,
  previewPeople,
  children,
}: OfficeStreamSectionProps) {
  // Mobile preview: 2x2 grid — 3 real avatars + 1 "+more" slot
  const hasMore = previewCount > 3;
  const mobilePreview = previewPeople.slice(0, hasMore ? 3 : Math.min(previewCount, 4));
  const mobileOverflow = Math.max(0, previewCount - 3);

  return (
    <div className="flex flex-col bg-[#111118]/80 border border-[#2a2a35] rounded-2xl overflow-hidden md:min-h-0">
      {/* Header — title + total. The "N online" green badge was removed
          with the presence cleanup; totalCount is the only meaningful
          number here now. */}
      <div className="flex items-center justify-between px-3 py-2 md:px-4 md:py-2.5 shrink-0 border-b border-[#2a2a35]/60">
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
          <h3 className="text-xs md:text-sm font-semibold text-gray-300 truncate">{title}</h3>
          {totalCount > 0 && (
            <span className="text-[10px] bg-[#1a1a22] border border-[#2a2a35] text-gray-400 px-1.5 py-0.5 rounded-full font-medium">
              {totalCount}
            </span>
          )}
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center gap-0.5 md:gap-1 shrink-0"
          title="View all"
        >
          <ChevronRight className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-500" />
        </button>
      </div>

      {/* ── Mobile: compact avatar grid (iOS folder style) ── */}
      <div className="block md:hidden p-4" onClick={onViewAll}>
        {totalCount === 0 ? (
          <p className="text-xs text-gray-600 italic text-center py-4">
            No members
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 w-fit mx-auto">
            {mobilePreview.map((p) => {
              const initials = (p.name || "?").slice(0, 2).toUpperCase();
              return (
                <div
                  key={p.key}
                  className={`flex flex-col items-center gap-1 w-[56px] ${p.id ? "cursor-pointer" : ""}`}
                  onClick={(e) => {
                    if (p.id) {
                      e.stopPropagation();
                      window.dispatchEvent(
                        new CustomEvent("affiliate-profile:open", {
                          detail: { userId: p.id },
                        })
                      );
                    }
                  }}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 border border-[#2a2a35]">
                      {p.profilePicture && (
                        <AvatarImage src={p.profilePicture} alt={p.name} />
                      )}
                      <AvatarFallback
                        className={
                          p.isAgent
                            ? "bg-gradient-to-br from-violet-600 to-purple-700 text-white text-[10px] font-bold"
                            : "bg-[#2a2a35] text-gray-300 text-[10px] font-bold"
                        }
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <span className="text-[9px] text-gray-400 truncate w-full text-center leading-tight">
                    {(p.name || "?").split(" ")[0]}
                  </span>
                </div>
              );
            })}
            {hasMore && (
              <div className="flex flex-col items-center gap-1 w-[56px]">
                <div className="h-10 w-10 rounded-full bg-[#2a2a35] border border-[#3a3a45] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-gray-400">
                    +{mobileOverflow}
                  </span>
                </div>
                <span className="text-[9px] text-gray-500">more</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop: full interactive cards ── */}
      <div className="hidden md:block md:flex-1 md:min-h-0 md:overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-3">
        {totalCount === 0 ? (
          <p className="text-xs text-gray-600 italic text-center py-6">
            No members
          </p>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center">
            {children}

            {overflowCount > 0 && (
              <button
                onClick={onViewAll}
                className="flex flex-col items-center justify-center w-[240px] min-h-[120px] rounded-xl border border-dashed border-[#3a3a45] bg-[#1a1a24]/50 hover:bg-[#1a1a24] hover:border-[#4a4a55] transition-colors cursor-pointer"
              >
                <span className="text-lg font-bold text-gray-400">
                  +{overflowCount}
                </span>
                <span className="text-[10px] text-gray-500 mt-1">
                  View All
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
