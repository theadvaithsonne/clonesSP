"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/feed-api";

const MAX_MATCHES = 8;

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function Face({ m, className }: { m: TeamMember; className: string }) {
  return m.profilePicture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.profilePicture} alt={m.name} className={cn("rounded-full object-cover shrink-0", className)} />
  ) : (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold text-brand",
        className
      )}
    >
      {initialsOf(m.name || m.email || "?")}
    </div>
  );
}

/**
 * Search-and-chips picker for a webinar's speakers: the chosen members sit
 * as removable chips, a search box finds the next one by name or email, and
 * the matches list adds on click. Shared by the schedule form and the
 * "Go live now" form so both pick speakers the same way.
 */
export function SpeakerPicker({
  members,
  selectedIds,
  onChange,
  className,
}: {
  members: TeamMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = selectedIds
    .map((id) => members.find((m) => m._id === id))
    .filter((m): m is TeamMember => !!m);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter(
        (m) =>
          !selectedIds.includes(m._id) &&
          (!q ||
            (m.name || "").toLowerCase().includes(q) ||
            (m.email || "").toLowerCase().includes(q))
      )
      .slice(0, MAX_MATCHES);
  }, [members, selectedIds, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cn("space-y-2", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((m) => (
            <span
              key={m._id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand py-1 pl-1 pr-2 text-xs font-semibold text-brand-foreground"
            >
              <Face m={m} className="h-5 w-5" />
              <span className="truncate">{m.name || m.email}</span>
              <button
                type="button"
                onClick={() => onChange(selectedIds.filter((id) => id !== m._id))}
                aria-label={`Remove ${m.name || m.email}`}
                className="rounded-full p-0.5 transition-colors hover:bg-black/10"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-[#2a2a35] bg-[#131316] px-3 py-2.5 transition-colors focus-within:border-brand/60">
          <Search className="h-4 w-4 shrink-0 text-[#6b6b7b]" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search office members…"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#4a4a5a]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-[#6b6b7b] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {open && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[#2a2a35] bg-[#131316] shadow-xl">
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[#6b6b7b]">
                {members.length === 0
                  ? "No members found"
                  : selectedIds.length >= members.length
                    ? "Everyone is already a speaker"
                    : "No members match"}
              </p>
            ) : (
              matches.map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange([...selectedIds, m._id]);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#222228]"
                >
                  <Face m={m} className="h-8 w-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{m.name || m.email}</span>
                    <span className="block truncate text-xs text-[#9fa0b8]">{m.email}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
