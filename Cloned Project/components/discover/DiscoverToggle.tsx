"use client";

import { Search, Globe } from "lucide-react";

export type DiscoverView = "search" | "maps";

interface DiscoverToggleProps {
  activeView: DiscoverView;
  onViewChange: (view: DiscoverView) => void;
}

export function DiscoverToggle({
  activeView,
  onViewChange,
}: DiscoverToggleProps) {
  return (
    <div className="flex items-center justify-center">
      <div className="inline-flex items-center rounded-full bg-black/60 backdrop-blur-xl p-1 border border-white/10 shadow-lg shadow-black/20">
        <button
          onClick={() => onViewChange("search")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
            activeView === "search"
              ? "bg-brand-2 text-brand-foreground shadow-md"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </button>
        <button
          onClick={() => onViewChange("maps")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
            activeView === "maps"
              ? "bg-brand-2 text-brand-foreground shadow-md"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Maps</span>
        </button>
      </div>
    </div>
  );
}
