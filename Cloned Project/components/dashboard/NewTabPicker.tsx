"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useModuleAccess } from "@/lib/hooks/useModuleAccess";
import type { TabSet } from "@/lib/founderPages";

interface TabOption {
  name: string;
  selectName: string;
  category: string;
  /** Founder console page a delegated admin can open with this module. */
  module?: string;
}

const TAB_OPTIONS: TabOption[] = [
  // Workspace & Office
  { name: "Directory", selectName: "Directory", category: "Workspace & Office" },
  { name: "Calendar", selectName: "Calendar", category: "Workspace & Office" },
  { name: "Cabinet", selectName: "Cabinet", category: "Workspace & Office" },
  { name: "Tasks", selectName: "Tasks", category: "Workspace & Office" },
  { name: "Taskroom", selectName: "Taskroom", category: "Workspace & Office" },
  { name: "Deals", selectName: "Deals", category: "Workspace & Office" },
  { name: "Notes", selectName: "Notes", category: "Workspace & Office" },
  { name: "Network Mail", selectName: "Network Mail", category: "Workspace & Office" },
  { name: "Notifications", selectName: "Notifications", category: "Workspace & Office" },
  { name: "Support", selectName: "Support", category: "Workspace & Office" },

  // Network & Revenue
  { name: "1Network", selectName: "1Network", category: "Network & Revenue" },
  { name: "Leaderboard", selectName: "Leaderboard", category: "Network & Revenue" },
  { name: "Auction", selectName: "Auction", category: "Network & Revenue" },
  { name: "Community", selectName: "Communities", category: "Network & Revenue" },
  { name: "Vaults", selectName: "GaragePay", category: "Network & Revenue" },

  // Content & Creation
  { name: "Content", selectName: "Long Form Videos", category: "Content & Creation" },
  { name: "Courses", selectName: "Learn", category: "Content & Creation" },
  { name: "Content Rewards", selectName: "Clipping", category: "Content & Creation" },
  { name: "Live", selectName: "Live Streams", category: "Content & Creation" },

  // Commerce
  { name: "Products", selectName: "Digital Products", category: "Commerce" },
  { name: "Services", selectName: "Services", category: "Commerce" },
  { name: "Marketplace", selectName: "Job Marketplace", category: "Commerce" },
  { name: "Jobs", selectName: "My Jobs", category: "Commerce" },

  // AI & Tech
  { name: "Ai Employees", selectName: "My Ai Employees", category: "AI & Tech" },
  { name: "Integrations", selectName: "Integrations", category: "AI & Tech" },
  { name: "Context Library", selectName: "Context Library", category: "AI & Tech" },

  // Founders — offered only on the founder tab set, gated like the sidebar's
  // Founders menu. `selectName` is the founder tab id.
  { name: "Community", selectName: "Founder:Communities", category: "Founders", module: "community" },
  { name: "Live Streams", selectName: "Founder:Live", category: "Founders", module: "live_streams" },
  { name: "Content", selectName: "Founder:Content", category: "Founders" },
  { name: "Courses", selectName: "Founder:Courses", category: "Founders", module: "courses" },
  { name: "Products", selectName: "Founder:Products", category: "Founders", module: "digital_products" },
  { name: "Events", selectName: "Founder:Events", category: "Founders", module: "live_streams" },
  { name: "Services", selectName: "Founder:Services", category: "Founders", module: "services" },
  { name: "Networks Manager", selectName: "Networks Manager", category: "Founders" },
  { name: "Office Settings", selectName: "Office Settings", category: "Founders" }
];

interface NewTabPickerProps {
  tabSet?: TabSet;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tabName: string) => void;
  triggerRect: DOMRect | null;
}

export default function NewTabPicker({
  tabSet = "main",
  isOpen,
  onClose,
  onSelect,
  triggerRect,
}: NewTabPickerProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside clicks
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, onClose]);

  const { amIFounder, userData, loading } = useAmIFounder();
  const { can: canModuleConsole } = useModuleAccess();

  const isStakeholder = userData?.membershipRole === "stakeholder" && !userData?.guest;

  const filteredTabOptions = useMemo(() => {
    if (loading) return [];

    return TAB_OPTIONS.filter((option) => {
      // 1. Founders category — the whole picker on the founder tab set, and
      //    absent from the main one
      if (option.category === "Founders") {
        if (tabSet !== "founders") return false;
        return amIFounder || (!!option.module && canModuleConsole(option.module));
      }
      if (tabSet === "founders") return false;

      // 2. Workspace & Office category
      if (option.category === "Workspace & Office") {
        // Guest doesn't have employees view
        if (userData?.guest) return false;
        return amIFounder || isStakeholder;
      }

      // 3. AI & Tech category - currently commented out in MainSidebar for all users
      if (option.category === "AI & Tech") {
        return false;
      }

      // 4. Specific disabled options in other categories (commented out or not in sidebar)
      const disabledOptions = [
        "Leaderboard",
        "Auction",
        "Clipping", // Content Rewards
        "Job Marketplace", // Marketplace
        "My Jobs" // Jobs
      ];
      if (disabledOptions.includes(option.selectName)) {
        return false;
      }

      return true;
    });
  }, [amIFounder, isStakeholder, userData, loading, tabSet, canModuleConsole]);

  // Filter options based on search query
  const filtered = filteredTabOptions.filter((option) =>
    option.name.toLowerCase().includes(search.toLowerCase())
  );

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length)
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].selectName);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const activeEl = containerRef.current?.querySelector(".picker-item-active");
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen || !triggerRect) return null;

  // Group filtered options by category
  const groups: Record<string, TabOption[]> = {};
  filtered.forEach((item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
  });

  // Calculate absolute coordinates below the trigger button
  const pickerWidth = 260;
  const pickerHeight = 360;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  let top = triggerRect.bottom + 8;
  let left = triggerRect.left;

  // Reposition if overflows screen bounds
  if (left + pickerWidth > viewportWidth) {
    left = viewportWidth - pickerWidth - 16;
  }
  if (top + pickerHeight > viewportHeight) {
    top = triggerRect.top - pickerHeight - 8;
  }

  // Flatten options to map raw index to selectedIndex easily
  const flatFilteredList: TabOption[] = [];
  const renderedGroups = Object.keys(groups).map((category) => {
    const items = groups[category];
    const categoryStartIdx = flatFilteredList.length;
    flatFilteredList.push(...items);

    return (
      <div key={category} className="mb-2 last:mb-0">
        <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-white/30 select-none">
          {category}
        </div>
        {items.map((item, localIdx) => {
          const absoluteIdx = categoryStartIdx + localIdx;
          const isActive = absoluteIdx === selectedIndex;

          return (
            <button
              key={item.name}
              onClick={() => onSelect(item.selectName)}
              className={cn(
                "w-full flex items-center text-left px-3 py-1.5 text-xs text-white/70 rounded-md transition-all select-none cursor-pointer",
                isActive
                  ? "picker-item-active bg-[#F5A623]/20 text-white font-medium border-l-2 border-[#F5A623] pl-2.5"
                  : "hover:bg-white/5 hover:text-white border-l-2 border-transparent"
              )}
            >
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>
    );
  });

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top,
        left,
        width: pickerWidth,
        zIndex: 99999,
      }}
      className="bg-[#0a0a0d]/90 backdrop-blur-xl border border-white/[0.08] shadow-2xl rounded-xl flex flex-col max-h-[360px] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Search Input Section */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06] flex-shrink-0">
        <Search className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search views..."
          autoFocus
          className="bg-transparent border-none outline-none text-xs text-white placeholder-white/30 w-full flex-grow p-0 focus:ring-0 focus:outline-none focus:border-none"
        />
      </div>

      {/* Option List Section */}
      <div className="flex-1 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {filtered.length > 0 ? (
          renderedGroups
        ) : (
          <div className="px-3 py-6 text-center text-xs text-white/30 select-none">
            No matching views found
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
