"use client";

// Scope switcher for the One Time Affiliates table — the "Entire Company"
// button in the TopBar. Pick any member and the table reloads scoped to that
// person's organisation (them + their whole downline tree), mirroring 1
// Network's view-as experience.
//
// It writes the SAME state the filter drawer's "Downline / Sponsor" field
// writes, which the page serialises as ?rootUserId. Two entry points, one
// scope — they can never disagree.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Search, X } from "lucide-react";
import { listUsers, type AdminUserListItem } from "@/lib/admin-api/users";
import { getCountryFlag } from "@/lib/country-flag";

export interface ScopePerson {
  _id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  country: string | null;
}

export function CompanyScopeDialog({
  open,
  onClose,
  active,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  /** Currently scoped person, or null for Entire Company. */
  active: ScopePerson | null;
  /** null = reset to Entire Company. */
  onSelect: (person: ScopePerson | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  // Sequence guard: a slow earlier search must not overwrite a newer one.
  const reqRef = useRef(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [open]);

  // Close on Escape — a popover that only closes by clicking away is a trap
  // for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const seq = ++reqRef.current;
      try {
        const res = await listUsers({
          search: term,
          limit: 10,
          includeActivated: true,
        });
        if (seq !== reqRef.current) return;
        setResults(res.items || []);
        setError(null);
      } catch (e: any) {
        if (seq !== reqRef.current) return;
        setResults([]);
        setError(e?.message || "Couldn't search members");
      } finally {
        if (seq === reqRef.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const body = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[15vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-[70vh] w-[460px] max-w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e12] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <h2 className="text-sm font-semibold text-white">View scope</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Entire Company — always first, always available. */}
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                onClose();
              }}
              className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3 text-left transition-colors hover:bg-white/[0.02]"
            >
              <BrandDot className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-white">
                  Entire Company
                </div>
                <div className="text-[11px] text-zinc-500">
                  Every One Time Affiliate
                </div>
              </div>
              {!active && <Check className="h-4 w-4 shrink-0 text-brand" />}
            </button>

            {/* Search */}
            <div className="px-5 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  // No "phone" here: the admin users search doesn't match on
                  // phone, so offering it just produces empty results.
                  placeholder="Search member by name or email..."
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-9 text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-white/[0.2]"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
                )}
              </div>
            </div>

            {/* Results */}
            <div className="glass-scrollbar min-h-0 flex-1 overflow-y-auto">
              {error && (
                <div className="px-5 pb-4 text-[12px] text-red-400">{error}</div>
              )}

              {/* Keep the active person visible even before searching, so the
                  current scope is never a mystery. */}
              {!error && query.trim().length < 2 && active && (
                <PersonRow
                  avatar={active.avatar}
                  name={active.name}
                  email={active.email}
                  country={active.country}
                  selected
                  onClick={() => onClose()}
                />
              )}

              {!error && query.trim().length < 2 && (
                <div className="px-5 py-3 text-[12px] text-zinc-500">
                  Type at least 2 characters to find a member.
                </div>
              )}

              {!error &&
                query.trim().length >= 2 &&
                !searching &&
                results.length === 0 && (
                  <div className="px-5 py-3 text-[12px] text-zinc-500">
                    No members match “{query.trim()}”.
                  </div>
                )}

              {results.map((u) => (
                <PersonRow
                  key={u.id}
                  avatar={u.profilePicture ?? null}
                  name={u.name}
                  email={u.email}
                  country={u.location?.country ?? null}
                  selected={active?._id === u.id}
                  onClick={() => {
                    onSelect({
                      _id: u.id,
                      name: u.name,
                      email: u.email,
                      avatar: u.profilePicture ?? null,
                      country: u.location?.country ?? null,
                    });
                    onClose();
                  }}
                />
              ))}
            </div>

            <div className="border-t border-white/[0.06] px-5 py-3 text-[11px] text-zinc-500">
              Selecting a member scopes the table to their whole organisation —
              them plus every level of their downline.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(body, document.body);
}

function PersonRow({
  avatar,
  name,
  email,
  country,
  selected,
  onClick,
}: {
  avatar: string | null;
  name: string | null;
  email: string | null;
  country: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-white/[0.04] px-5 py-2.5 text-left transition-colors last:border-b-0 ${
        selected ? "bg-brand/[0.06]" : "hover:bg-white/[0.02]"
      }`}
    >
      <ScopeAvatar src={avatar} name={name || email} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] text-white">
            {name || "Unnamed"}
          </span>
          {country && (
            <span className="shrink-0 text-[12px] leading-none" aria-hidden>
              {getCountryFlag(country)}
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-zinc-400">{email || "—"}</div>
      </div>
      {selected && <Check className="h-4 w-4 shrink-0 text-brand" />}
    </button>
  );
}

export function ScopeAvatar({
  src,
  name,
  className = "h-7 w-7",
}: {
  src: string | null;
  name: string | null;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${className} shrink-0 rounded-full border border-white/[0.08] object-cover`}
      />
    );
  }
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-[11px] font-semibold text-brand-foreground`}
    >
      {(name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}

function BrandDot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <rect x="11.2499" y="0" width="5.92097" height="23.6839" fill="#FBD10D" />
      <circle cx="4.49007" cy="19.1938" r="4.49007" fill="#FBD10D" />
      <circle cx="24.3472" cy="4.97071" r="4.97069" fill="#FBD10D" />
      <circle cx="24.3472" cy="18.7132" r="4.97069" fill="#FBD10D" />
    </svg>
  );
}
