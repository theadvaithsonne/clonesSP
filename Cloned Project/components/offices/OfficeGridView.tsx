"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2, Plus, RotateCcw, SearchX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchDiscoverOffices,
  type DiscoverCategory,
  type DiscoverOffice,
  type DiscoverPagination,
} from "@/lib/discover-api";
import { CategoryRail, CategoryTiles } from "./CategoryNav";
import { OfficeCard, OfficeCardSkeleton } from "./OfficeCard";
import { LoadingMessage } from "./OfficesSkeletons";
import { BackLink, Eyebrow, Pagination, Pill, PillButton } from "./ui";

const PAGE_SIZE = 12;
/** Gap between cards fading in, so a new set arrives as a wave. */
const STAGGER_MS = 35;

export type GridMode =
  | { kind: "all"; page: number }
  | { kind: "category"; category: string }
  | { kind: "search"; query: string };

/**
 * The full-page lists: every office (paged), one category, or a search
 * (both with "Load more"), including their loading and empty states.
 *
 * Switching filter or page keeps the current cards on screen, dimmed, until
 * the next set has arrived, then fades the new cards in — no skeleton flash
 * or jump between sets.
 */
export function OfficeGridView({
  mode,
  categories,
  categoriesLoading,
  renderFooter,
  isMember,
  onOpenOffice,
  onSelectCategory,
  onPage,
  onClearSearch,
  onCreateOffice,
  onBack,
}: {
  mode: GridMode;
  categories: DiscoverCategory[];
  categoriesLoading: boolean;
  renderFooter: (office: DiscoverOffice) => React.ReactNode;
  isMember: (officeId: string) => boolean;
  onOpenOffice: (office: DiscoverOffice) => void;
  onSelectCategory: (category: string | null) => void;
  onPage: (page: number) => void;
  onClearSearch: () => void;
  onCreateOffice: () => void;
  /** Back to the Offices home. */
  onBack: () => void;
}) {
  const [offices, setOffices] = useState<DiscoverOffice[]>([]);
  const [pagination, setPagination] = useState<DiscoverPagination | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // The request the cards on screen came from — keys their entrance, so a
  // new set animates in while "Load more" only animates what it adds.
  const [shownKey, setShownKey] = useState("");
  const shownPageRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const category = mode.kind === "category" ? mode.category : undefined;
  const search = mode.kind === "search" ? mode.query : undefined;
  const page = mode.kind === "all" ? mode.page : 1;
  const requestKey = `${category ?? ""}|${search ?? ""}|${page}`;

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    setError(false);
    fetchDiscoverOffices({ category, search, page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setOffices(res.organizations || []);
        setPagination(res.pagination);
        setShownKey(requestKey);
        // "Next" is pressed at the bottom of the list; once the new page is
        // in, glide back up to its start.
        if (shownPageRef.current !== null && shownPageRef.current !== page) {
          rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        shownPageRef.current = page;
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
    // requestKey is derived from category/search/page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search, page, reloadKey]);

  const loadMore = useCallback(async () => {
    if (!pagination) return;
    setLoadingMore(true);
    try {
      const res = await fetchDiscoverOffices({
        category,
        search,
        page: pagination.page + 1,
        limit: PAGE_SIZE,
      });
      setOffices((prev) => {
        const seen = new Set(prev.map((o) => o._id));
        return [...prev, ...(res.organizations || []).filter((o) => !seen.has(o._id))];
      });
      setPagination(res.pagination);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [category, search, pagination]);

  const total = pagination?.total ?? 0;
  const firstLoad = pagination === null && !error;
  const noResults = !refreshing && !error && pagination !== null && total === 0;

  const header =
    mode.kind === "all"
      ? { title: "All offices", subtitle: "Explore every community on Garage, from tiny expert rooms to global networks." }
      : mode.kind === "category"
        ? { title: mode.category, subtitle: `Every office on Garage in ${mode.category}.` }
        : { title: "Search offices", subtitle: "Find a community by its name." };

  return (
    <div ref={rootRef} className="flex scroll-mt-24 flex-col gap-9">
      <div className="flex flex-col gap-5">
        <BackLink onClick={onBack} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="text-[32px] font-semibold leading-tight text-[#f5f1e7] sm:text-[40px]">{header.title}</h1>
            <p className="max-w-[680px] text-[15px] leading-[1.5] text-[#aaa69c]">{header.subtitle}</p>
          </div>
          {pagination && total > 0 && (
            <Pill tone="neutral">
              {total} {total === 1 ? "office" : "offices"}
            </Pill>
          )}
        </div>
      </div>

      {mode.kind !== "search" && (
        <CategoryRail
          categories={categories}
          loading={categoriesLoading}
          selected={category ?? null}
          onSelect={onSelectCategory}
        />
      )}

      {pagination && total > 0 && (
        <div className="-mt-2 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#747169]">
          {mode.kind === "all" && (
            <p>
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, total)} of {total} offices
            </p>
          )}
          {mode.kind === "category" && (
            <div className="flex items-center gap-2">
              <Pill tone="accent">{mode.category}</Pill>
              <button type="button" onClick={() => onSelectCategory(null)} className="text-[#ffc200] hover:opacity-80">
                Clear filters
              </button>
            </div>
          )}
          {mode.kind === "search" && (
            <div className="flex items-center gap-2">
              <Pill tone="accent">&ldquo;{mode.query}&rdquo;</Pill>
              <button type="button" onClick={onClearSearch} className="text-[#ffc200] hover:opacity-80">
                Clear search
              </button>
            </div>
          )}
          <p className="flex items-center gap-2">
            {refreshing && <Loader2 className="size-3.5 animate-spin text-[#ffc200]" />}
            {mode.kind !== "all" && `${total} ${total === 1 ? "result" : "results"}`}
          </p>
        </div>
      )}

      {firstLoad ? (
        <>
          <OfficeGrid>
            {Array.from({ length: 8 }).map((_, i) => (
              <OfficeCardSkeleton key={i} />
            ))}
          </OfficeGrid>
          <LoadingMessage />
        </>
      ) : error && offices.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[28px] border border-[#2b2923] bg-[#121210] p-12 text-center animate-in fade-in-0 duration-300">
          <p className="text-[20px] font-semibold text-[#f5f1e7]">Couldn&apos;t load offices</p>
          <p className="text-[13px] text-[#aaa69c]">Check your connection and try again.</p>
          <PillButton onClick={() => setReloadKey((k) => k + 1)}>
            <RotateCcw className="size-4" />
            Try again
          </PillButton>
        </div>
      ) : noResults ? (
        <div className="animate-in fade-in-0 duration-300">
          <EmptyResults
            query={mode.kind === "search" ? mode.query : undefined}
            categories={categories}
            onClearSearch={onClearSearch}
            onSelectCategory={(c) => onSelectCategory(c)}
            onCreateOffice={onCreateOffice}
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col gap-9 transition-opacity duration-200",
            refreshing && "pointer-events-none opacity-40"
          )}
        >
          <OfficeGrid>
            {offices.map((office, i) => (
              <div
                key={`${shownKey}:${office._id}`}
                className="animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                style={{ animationDelay: `${(i % PAGE_SIZE) * STAGGER_MS}ms`, animationFillMode: "both" }}
              >
                <OfficeCard
                  office={office}
                  highlighted={isMember(office._id)}
                  onOpen={() => onOpenOffice(office)}
                  footer={renderFooter(office)}
                />
              </div>
            ))}
          </OfficeGrid>

          {mode.kind === "all" && pagination ? (
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPage={onPage} />
          ) : (
            pagination &&
            pagination.page < pagination.totalPages && (
              <div className="flex justify-center">
                <PillButton onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Load more offices
                </PillButton>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function OfficeGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

function EmptyResults({
  query,
  categories,
  onClearSearch,
  onSelectCategory,
  onCreateOffice,
}: {
  query?: string;
  categories: DiscoverCategory[];
  onClearSearch: () => void;
  onSelectCategory: (category: string) => void;
  onCreateOffice: () => void;
}) {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col items-center gap-[18px] rounded-[28px] border border-[#2b2923] bg-[#121210] px-6 py-12 text-center">
        <div className="flex size-[74px] items-center justify-center rounded-full bg-[rgba(229,184,92,0.1)]">
          <SearchX className="size-[30px] text-[#ffc200]" />
        </div>
        <div className="flex flex-col items-center gap-[9px]">
          <p className="text-[24px] font-semibold text-[#f5f1e7] sm:text-[28px]">No offices found</p>
          <p className="max-w-[540px] text-[15px] leading-[1.5] text-[#aaa69c]">
            {query ? (
              <>
                We couldn&apos;t find anything for &ldquo;{query}&rdquo;. Try a broader name or explore a category below.
              </>
            ) : (
              "Nothing here yet. Explore another category below."
            )}
          </p>
        </div>
        {query && (
          <PillButton onClick={onClearSearch}>
            <X className="size-4" />
            Clear search
          </PillButton>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-col gap-[22px]">
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Try another path</Eyebrow>
            <h2 className="text-[24px] font-semibold leading-[1.15] text-[#f5f1e7] sm:text-[28px]">Popular categories</h2>
          </div>
          <CategoryTiles categories={categories.slice(0, 6)} onSelect={onSelectCategory} compact />
        </div>
      )}

      <CreateOfficeNote onCreateOffice={onCreateOffice} />
    </div>
  );
}

export function CreateOfficeNote({ onCreateOffice }: { onCreateOffice: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3.5 rounded-[20px] border border-[rgba(229,184,92,0.3)] bg-[rgba(229,184,92,0.1)] p-[22px] sm:flex-row sm:items-center">
      <Lightbulb className="size-5 shrink-0 text-[#ffc200]" />
      <p className="flex-1 text-[13px] text-[#aaa69c]">
        Can&apos;t find the room you need? Create an office and invite the first members.
      </p>
      <PillButton onClick={onCreateOffice}>Create an office</PillButton>
    </div>
  );
}
