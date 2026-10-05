"use client";

import { cn } from "@/lib/utils";

interface CategoryChipProps {
  name: string;
  count?: number;
  isActive?: boolean;
  onClick?: () => void;
}

export function CategoryChip({
  name,
  count,
  isActive = false,
  onClick,
}: CategoryChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border whitespace-nowrap",
        isActive
          ? "bg-brand-2/10 border-brand-2/30 text-brand-2"
          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/[0.07] hover:border-white/20 hover:text-white"
      )}
    >
      <span>{name}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "text-xs px-1.5 py-0.5 rounded-full",
            isActive ? "bg-brand-2/20" : "bg-white/10"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
