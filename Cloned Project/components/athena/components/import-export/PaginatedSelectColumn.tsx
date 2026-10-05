"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListMetadata } from "./importExportApi";
import { hasMorePages } from "./importExportApi";
import { ie } from "./importExportStyles";

function SelectCard({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
        selected
          ? "border-brand bg-brand/15 shadow-[0_0_0_1px_color-mix(in_srgb,_var(--brand)_25%,_transparent)]"
          : "border-white/10 bg-[#161616] hover:border-brand/30 hover:bg-brand/5"
      )}
    >
      <div
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-brand bg-brand/20" : "border-white/25"
        )}
      >
        {selected && <div className="h-2 w-2 rounded-full bg-brand" />}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate transition-colors",
            ie.cardLabel,
            selected ? ie.cardLabelSelected : ie.cardLabelIdle
          )}
        >
          {label}
        </p>
        {sub ? (
          <p
            className={cn(
              "truncate text-sm font-normal transition-colors",
              selected ? "text-brand/65" : "text-white/50"
            )}
          >
            {sub}
          </p>
        ) : null}
      </div>
    </button>
  );
}

type PaginatedSelectColumnProps<T extends { _id: string }> = {
  title: string;
  items: T[];
  selectedId: string;
  onSelect: (item: T) => void;
  getLabel: (item: T) => string;
  emptyMessage: string;
  placeholderMessage?: string;
  showPlaceholder?: boolean;
  loading: boolean;
  loadingMore: boolean;
  metadata: ListMetadata | null;
  onLoadMore: () => void;
};

export function PaginatedSelectColumn<T extends { _id: string }>({
  title,
  items,
  selectedId,
  onSelect,
  getLabel,
  emptyMessage,
  placeholderMessage = "Select an option above",
  showPlaceholder = false,
  loading,
  loadingMore,
  metadata,
  onLoadMore,
}: PaginatedSelectColumnProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = hasMorePages(metadata);

  const tryLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    onLoadMore();
  }, [hasMore, loading, loadingMore, onLoadMore]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || showPlaceholder) return;
    if (loading || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) tryLoadMore();
      },
      { root, rootMargin: "0px 0px 80px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [tryLoadMore, loading, hasMore, showPlaceholder, items.length]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || showPlaceholder || loading || !hasMore) return;

    const nearBottom =
      root.scrollHeight <= root.clientHeight ||
      root.scrollTop + root.clientHeight >= root.scrollHeight - 80;
    if (nearBottom) tryLoadMore();
  }, [tryLoadMore, loading, hasMore, showPlaceholder, items.length, metadata?.currentPage]);

  const handleScroll = useCallback(() => {
    const root = scrollRef.current;
    if (!root || loading || loadingMore || !hasMore) return;
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 80) {
      tryLoadMore();
    }
  }, [hasMore, loading, loadingMore, tryLoadMore]);

  return (
    <div>
      <p
        className={cn(
          "mb-2 transition-colors",
          ie.columnTitle,
          selectedId ? ie.columnTitleActive : ie.columnTitleIdle
        )}
      >
        {title}
      </p>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-52 space-y-1.5 overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-white/10"
      >
        {showPlaceholder ? (
          <p className={cn(ie.placeholder, "py-4 text-center")}>{placeholderMessage}</p>
        ) : loading && items.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : items.length === 0 ? (
          <p className={cn(ie.empty, "py-4 text-center")}>{emptyMessage}</p>
        ) : (
          <>
            {items.map((item) => (
              <SelectCard
                key={item._id}
                label={getLabel(item)}
                selected={selectedId === item._id}
                onClick={() => onSelect(item)}
              />
            ))}
            <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
            {loadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
              </div>
            )}
            {!loadingMore && hasMore && items.length > 0 && (
              <p className={cn(ie.hint, "py-2 text-center")}>Scroll for more</p>
            )}
            {!loadingMore && !hasMore && items.length > 0 && (
              <p className={cn(ie.hint, "py-2 text-center")}>All loaded</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
