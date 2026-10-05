"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
  activeTab: string | null;
  tabTrail?: string[];
  onSelectTab: (tab: string) => void;
  onCloseAll: () => void;
  dynamicItems?: { label: string; key?: string }[];
  onDynamicItemClick?: (item: { label: string; key?: string }, index: number) => void;
}

interface FullSegment {
  label: string;
  key?: string;
  isClickable: boolean;
  type: "tab" | "dynamic";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function Breadcrumbs({
  activeTab,
  tabTrail = [],
  onSelectTab,
  onCloseAll,
  dynamicItems = [],
  onDynamicItemClick,
}: BreadcrumbsProps) {
  const [showCollapsedDropdown, setShowCollapsedDropdown] = useState(false);
  const [collapsedRect, setCollapsedRect] = useState<DOMRect | null>(null);
  const collapsedDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        collapsedDropdownRef.current &&
        !collapsedDropdownRef.current.contains(target)
      ) {
        setShowCollapsedDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update positions on scroll or resize
  useEffect(() => {
    function handleUpdatePositions() {
      setShowCollapsedDropdown(false);
    }
    window.addEventListener("resize", handleUpdatePositions);
    window.addEventListener("scroll", handleUpdatePositions, { capture: true });
    return () => {
      window.removeEventListener("resize", handleUpdatePositions);
      window.removeEventListener("scroll", handleUpdatePositions, { capture: true });
    };
  }, []);

  if (!activeTab) return null;

  const trail = tabTrail.length > 0 ? tabTrail : (activeTab ? [activeTab] : []);

  // Compile segments (TabTrail -> DynamicItems)
  const segments: FullSegment[] = [];

  // 1. Add all tabs from trail
  trail.forEach((tab, index) => {
    const isActive = index === trail.length - 1;
    segments.push({
      label: tab,
      isClickable: !isActive || dynamicItems.length > 0, // Clickable if not the active tab, or if nested deep
      type: "tab",
      onClick: () => {
        onSelectTab(tab);
      },
    });
  });

  // 2. Add dynamic items
  dynamicItems.forEach((item, idx) => {
    segments.push({
      label: item.label,
      key: item.key,
      isClickable: idx < dynamicItems.length - 1, // Intermediate dynamic segments are clickable
      type: "dynamic" as const,
      onClick: () => {
        if (onDynamicItemClick) {
          onDynamicItemClick(item, idx);
        }
      },
    });
  });

  // Notion-like smart collapsing: collapse middle items if segments length > 4
  const shouldCollapse = segments.length > 4;
  let visibleSegments: FullSegment[] = [];
  let collapsedSegments: FullSegment[] = [];

  if (shouldCollapse) {
    visibleSegments.push(segments[0]); // Active Tab (e.g. Cabinet)
    // Collapse intermediate dynamic segments
    for (let i = 1; i < segments.length - 2; i++) {
      collapsedSegments.push(segments[i]);
    }
    visibleSegments.push({
      label: "...",
      isClickable: true,
      type: "dynamic",
      onClick: (e) => {
        setCollapsedRect(e.currentTarget.getBoundingClientRect());
        setShowCollapsedDropdown((prev) => !prev);
      },
    });
    visibleSegments.push(segments[segments.length - 2]);
    visibleSegments.push(segments[segments.length - 1]);
  } else {
    visibleSegments = segments;
  }

  return (
    <div className="flex items-center gap-1 text-[11px] sm:text-xs text-[#7d7d9b] font-medium max-w-full overflow-x-auto scrollbar-none py-1.5 px-1">
      {visibleSegments.map((segment, index) => {
        const isLast = index === visibleSegments.length - 1;

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="h-2.5 w-2.5 text-white/10 flex-shrink-0" />
            )}

            <div className="relative flex-shrink-0">
              {segment.label === "..." ? (
                <button
                  onClick={segment.onClick}
                  className={cn(
                    "flex items-center justify-center h-5 w-7 rounded hover:bg-white/5 hover:text-white transition-colors duration-150 border border-transparent hover:border-white/[0.04]",
                    showCollapsedDropdown && "bg-white/5 text-white"
                  )}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  disabled={!segment.isClickable}
                  onClick={segment.onClick}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded transition-all duration-150 border border-transparent select-none",
                    segment.isClickable
                      ? "hover:bg-white/5 hover:text-white hover:border-white/[0.04] cursor-pointer"
                      : "text-white font-semibold cursor-default"
                  )}
                >
                  <span>{segment.label}</span>
                </button>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {/* Render Dropdowns via React Portal */}
      {typeof document !== "undefined" && showCollapsedDropdown && collapsedRect &&
        createPortal(
          <div
            ref={collapsedDropdownRef}
            style={{
              position: "fixed",
              top: collapsedRect.bottom + 6,
              left: Math.max(8, Math.min(collapsedRect.left, window.innerWidth - 150)),
              zIndex: 99999,
            }}
            className="bg-[#0c0c0f]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl rounded-lg py-1 min-w-[140px] animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {collapsedSegments.map((colSeg, cIdx) => (
              <button
                key={cIdx}
                onClick={() => {
                  if (colSeg.onClick) colSeg.onClick(null as any);
                  setShowCollapsedDropdown(false);
                }}
                className="w-full flex items-center px-3 py-1.5 text-left text-[11px] sm:text-xs text-[#9898b0] hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
              >
                <span className="truncate">{colSeg.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )
      }
    </div>
  );
}
