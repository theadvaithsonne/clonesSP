"use client";

/**
 * "Downline / Sponsor" filter screen — pick the root of a referral tree, and
 * optionally leave some legs out of it.
 *
 * Lifted out of OneTimeAffiliatesFilterDrawer so Daily Reports scopes a tree
 * exactly the same way. The comment inside PersonSearch already said the two
 * halves share one implementation "so they cannot drift"; the same reasoning
 * applies across tables — the semantics here are subtle (the root is NOT in
 * its own downline; excluding someone removes what they recruited but keeps
 * them) and two copies would diverge.
 *
 * Wire format both consumers use: `?rootUserId=<id>` plus a repeated
 * `?excludeUserId=<id>` per excluded person.
 */
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Loader2, Search, X } from "lucide-react";
import { listUsers, type AdminUserListItem } from "@/lib/admin-api/users";

export type DownlinePerson = {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
};

/**
 * Search a person by name/email and scope the table to their downline tree.
 * Hits the admin users endpoint (300ms debounce) rather than the affiliates
 * table itself, so the sponsor doesn't have to be a one-time affiliate.
 */
/**
 * Downline / Sponsor screen: pick the root of the tree, and optionally one leg
 * to leave out.
 *
 * The exception only appears once a root is chosen, because "exclude this leg"
 * has no meaning without a tree to exclude it from — and offering it first
 * would invite "everyone except X", which this table does not support.
 */
export function DownlineScreen({
  selected,
  onChange,
  excluded,
  onChangeExcluded,
}: {
  selected: DownlinePerson | null;
  onChange: (person: DownlinePerson | null) => void;
  excluded: DownlinePerson[];
  onChangeExcluded: (people: DownlinePerson[]) => void;
}) {
  if (selected) {
    return (
      <div className="px-5 py-4">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">
          Scoped to this person&apos;s downline
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-3">
          <PersonAvatar src={selected.avatar} name={selected.name || selected.email} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium text-white">
              {selected.name || "Unnamed"}
            </div>
            <div className="truncate text-[11px] text-zinc-400">
              {selected.email || "—"}
            </div>
          </div>
          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[13px] text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-9 flex-1 rounded-lg border border-red-500/20 bg-red-500/[0.06] text-[13px] text-red-300 transition hover:bg-red-500/[0.12]"
          >
            Remove
          </button>
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">
          The table will show every affiliate below this person in the referral
          tree.
        </p>

        {/* Exceptions — leave any number of legs out of that tree. */}
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">
              Except these people&apos;s downlines
            </span>
            {excluded.length > 1 && (
              <button
                type="button"
                onClick={() => onChangeExcluded([])}
                className="text-[11px] text-zinc-400 transition hover:text-white"
              >
                Clear all
              </button>
            )}
          </div>

          {excluded.length > 0 && (
            <div className="mb-3 flex flex-col gap-2">
              {excluded.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2.5"
                >
                  <PersonAvatar src={p.avatar} name={p.name || p.email} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[13px] font-medium text-white">
                      {p.name || "Unnamed"}
                    </div>
                    <div className="truncate text-[11px] text-zinc-400">
                      {p.email || "—"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeExcluded(excluded.filter((x) => x.id !== p.id))
                    }
                    aria-label={`Stop excluding ${p.name || p.email || "this person"}`}
                    className="shrink-0 rounded-md p-1 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Always available, so more legs can be added without clearing the
              ones already chosen. Picking someone twice is a no-op. */}
          <PersonSearch
            // Only people inside the chosen tree can be excluded from it.
            // Unscoped, this listed the first 8 matches from the whole
            // platform — including the tree's own upline — none of which
            // excluding would change.
            withinDownlineOf={selected.id}
            placeholder={`Search ${
              selected.name || "this person"
            }'s downline to exclude`}
            autoFocus={false}
            onPick={(person) =>
              onChangeExcluded(
                excluded.some((x) => x.id === person.id)
                  ? excluded
                  : [...excluded, person],
              )
            }
            emptyHint={
              excluded.length
                ? `Hidden: everyone below ${excluded.length === 1 ? "this person" : `these ${excluded.length} people`} — the people themselves stay listed.`
                : "Leave empty to include the whole tree."
            }
          />
        </div>
      </div>
    );
  }

  return <PersonSearch onPick={onChange} autoFocus />;
}

/**
 * Debounced person search used by both halves of the Downline screen — the
 * root of the tree and the leg being excluded. One implementation so the two
 * cannot drift in behaviour (min length, debounce, out-of-order guard).
 */
export function PersonSearch({
  onPick,
  autoFocus = false,
  placeholder = "Search by name or email",
  emptyHint,
  withinDownlineOf,
}: {
  onPick: (person: DownlinePerson) => void;
  autoFocus?: boolean;
  placeholder?: string;
  emptyHint?: string;
  /**
   * Restrict results to this person's downline (sent as ?rootUserId, which
   * matches on `ancestors` — strictly BELOW them, never the person or anyone
   * above). Used by the exception picker: the only legs that can be excluded
   * from a tree are legs inside it, so offering anyone else — the platform
   * root, or the tree's own upline — is offering a choice that does nothing.
   */
  withinDownlineOf?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a slow earlier request overwriting a newer one's results.
  const reqRef = useRef(0);

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
          limit: 8,
          includeActivated: true,
          ...(withinDownlineOf ? { rootUserId: withinDownlineOf } : {}),
        });
        if (seq !== reqRef.current) return;
        setResults(res.items || []);
        setError(null);
      } catch (e: any) {
        if (seq !== reqRef.current) return;
        setResults([]);
        setError(e?.message || "Couldn't search people");
      } finally {
        if (seq === reqRef.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // withinDownlineOf is part of the query: changing the root must re-run the
    // search, or results from the previous tree would stay on screen.
  }, [query, withinDownlineOf]);

  return (
    <div className="flex flex-col">
      <div className={autoFocus ? "px-5 py-4" : "pb-2"}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            autoFocus={autoFocus}
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-9 text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-white/[0.2]"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
          )}
        </div>
      </div>

      <div className={autoFocus ? "flex flex-col" : "flex flex-col"}>
        {error && (
          <div className={`${autoFocus ? "px-5" : ""} pb-4 text-[12px] text-red-400`}>
            {error}
          </div>
        )}
        {!error && query.trim().length < 2 && (
          <div className={`${autoFocus ? "px-5" : ""} pb-4 text-[12px] text-zinc-500`}>
            {emptyHint ?? "Type at least 2 characters to search people."}
          </div>
        )}
        {!error && query.trim().length >= 2 && !searching && results.length === 0 && (
          <div className={`${autoFocus ? "px-5" : ""} pb-4 text-[12px] text-zinc-500`}>
            No people match “{query.trim()}”.
          </div>
        )}
        {results.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() =>
              onPick({
                id: u.id,
                name: u.name,
                email: u.email,
                avatar: u.profilePicture ?? null,
              })
            }
            className={`flex items-center gap-3 border-b border-white/[0.04] ${
              autoFocus ? "px-5" : "px-2"
            } py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.02]`}
          >
            <PersonAvatar src={u.profilePicture ?? null} name={u.name || u.email} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] text-white">
                {u.name || "Unnamed"}
              </div>
              <div className="truncate text-[11px] text-zinc-400">
                {u.email || "—"}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function PersonAvatar({
  src,
  name,
}: {
  src: string | null;
  name: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full border border-white/[0.08] object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-[13px] font-semibold text-black">
      {(name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}

