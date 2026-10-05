"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationProps } from "@/components/ui/data-table/types";

// Same prev/next table-pagination contract as components/ui/data-table (the one
// pagination pattern already in production in this app), restyled to match Docusign's
// dark-panel look instead of the CRM theme. No page-size selector, no "Load more" —
// real server-side page/limit pagination, driven by whatever fetch action the caller
// passes into onPrev/onNext.
export function SimplePagination({ page, totalPages, rangeLabel, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-1 py-3 text-xs">
      <span className="tabular-nums text-[#8a8a9b]">{rangeLabel}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="grid h-7 w-7 place-items-center rounded-full border border-white/[0.1] text-[#8a8a9b] transition enabled:hover:bg-white/[0.06] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-1 tabular-nums text-white/70">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="grid h-7 w-7 place-items-center rounded-full border border-white/[0.1] text-[#8a8a9b] transition enabled:hover:bg-white/[0.06] disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Shared helper so every list view builds the same "X to Y of Z" label the same way.
export function paginationRangeLabel(pagination: { page: number; limit: number; total: number }) {
  if (!pagination.total) return "0 of 0";
  const from = (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);
  return `${from} to ${to} of ${pagination.total}`;
}
