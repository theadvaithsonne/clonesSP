"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrgMemberLite } from "@/store/docusign/docusignStore";

export const RECIPIENT_PICKER_PAGE_SIZE = 8;

// Always a string: the members API returns whatever the org has, and some entries have neither a name nor an email.
// Returning undefined here used to crash the whole editor in the sort below ("reading 'localeCompare'").
const displayName = (m: OrgMemberLite) => m.name || m.email || "";

// Members not already added whose name or email contains every word typed, in name order. The org has
// well over a thousand people, so browsing is alphabetical rather than in whatever order the API returns.
export function filterMembers(members: OrgMemberLite[], query: string, excludeIds: Set<string>): OrgMemberLite[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (members || [])
    .filter((m) => {
      // An entry with no id can't be stored as a recipient, and one with neither name nor email can't be shown or
      // emailed — skip them rather than let one bad row break the picker (and the editor around it).
      if (!m || !m._id || !displayName(m)) return false;
      if (excludeIds.has(m._id)) return false;
      const haystack = `${m.name || ""} ${m.email || ""}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base" }));
}

interface RecipientPickerProps {
  members: OrgMemberLite[];
  // Ids of people already on the document; they are not offered again.
  excludeIds: string[];
  // Called the first time the picker is opened (and on Retry). Resolves to false when the load failed.
  onLoadMembers: () => Promise<boolean>;
  onPick: (member: OrgMemberLite) => void;
}

// "Add a recipient" control. The organisation's members are only fetched when this is opened — not when the
// editor opens — and are then searched and paged in the browser (the members API ignores page/size).
export function RecipientPicker({ members, excludeIds, onLoadMembers, onPick }: RecipientPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const requestedRef = useRef(false);

  const load = async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const ok = await onLoadMembers();
      if (!ok) setLoadFailed(true);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !requestedRef.current) {
      requestedRef.current = true;
      void load();
    }
  };

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const matches = useMemo(() => filterMembers(members, query, excluded), [members, query, excluded]);

  const pageCount = Math.max(1, Math.ceil(matches.length / RECIPIENT_PICKER_PAGE_SIZE));
  // Clamp rather than trusting `page`: adding the last person on a page can leave it empty.
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * RECIPIENT_PICKER_PAGE_SIZE;
  const visible = matches.slice(start, start + RECIPIENT_PICKER_PAGE_SIZE);

  return (
    <div
      data-testid="recipient-picker"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) setOpen(false);
      }}
    >
      <button
        type="button"
        data-testid="recipient-picker-trigger"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2.5 text-xs text-white/70 transition-colors hover:border-[#3b3b4a] hover:text-white/90"
      >
        <span className="flex items-center">
          <UserPlus className="mr-2 h-4 w-4 shrink-0" />
          Add a recipient
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div data-testid="recipient-picker-panel" className="mt-2 space-y-2 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7a7a90]" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search by name or email"
              aria-label="Search recipients"
              className="h-8 rounded-lg border border-[#2a2a35] bg-[#0c0c10] pl-8 pr-2.5 text-xs text-white/85 placeholder:text-[#5a5a72] focus:border-[#3b3b4a] focus:outline-none"
            />
          </div>

          {isLoading && members.length === 0 ? (
            <div className="space-y-1 py-1" data-testid="recipient-picker-loading" aria-label="Loading members">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-white/[0.04]" />
              ))}
            </div>
          ) : loadFailed && members.length === 0 ? (
            <div className="space-y-2 py-4 text-center text-xs text-[#7a7a90]" data-testid="recipient-picker-error">
              <p>Couldn&apos;t load your organization&apos;s members.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : matches.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#7a7a90]" data-testid="recipient-picker-empty">
              {query.trim() ? `No one matches “${query.trim()}”.` : "Everyone in your organization has been added."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {visible.map((m) => (
                <li key={m._id}>
                  <button
                    type="button"
                    data-testid="recipient-option"
                    onClick={() => onPick(m)}
                    className="flex w-full flex-col rounded px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="truncate text-[13px] font-medium text-white/90">{displayName(m)}</span>
                    {m.name && <span className="truncate text-xs text-[#7a7a90]">{m.email}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {matches.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#2a2a35] pt-2 text-xs text-[#7a7a90]">
              <span data-testid="recipient-picker-range">
                {start + 1}–{start + visible.length} of {matches.length.toLocaleString()}
                {isLoading && <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin" aria-label="Refreshing" />}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Previous page"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span data-testid="recipient-picker-page">
                  {safePage + 1} / {pageCount}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Next page"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
