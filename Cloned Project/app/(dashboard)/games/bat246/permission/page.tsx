"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft, LayoutGrid, Users, Network, BookOpen, DollarSign, UserPlus,
  Search, Loader2, Pencil, Check, X, Lock, ChevronRight, Wallet,
} from "lucide-react";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import type { Bat246CardKey } from "@/lib/hooks/useBat246CardAccess";

const ALAN_K_EMAIL = "redbaron2020@mail.com";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 15;

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
  return { Authorization: `Bearer ${token}` };
}

interface AccessCell {
  granted: boolean;
  legacy: boolean; // has access via board position — locked, not editable here
}

interface PersonRow {
  userId: string;
  name: string | null;
  email: string;
  access: Record<Bat246CardKey, AccessCell>;
}

interface ColMeta {
  key: Bat246CardKey;
  label: string;
  Icon: React.ElementType;
  iconColor: string;
}

// Same icons/colors as the admin landing page's 6 cards (bat246/page.tsx).
const COLUMNS: ColMeta[] = [
  { key: "boards", label: "Game Boards", Icon: LayoutGrid, iconColor: "text-blue-300" },
  { key: "members", label: "Office Members", Icon: Users, iconColor: "text-violet-300" },
  { key: "distributors", label: "Distributors", Icon: Network, iconColor: "text-amber-300" },
  { key: "documentation", label: "Documentation", Icon: BookOpen, iconColor: "text-emerald-300" },
  { key: "lostmoney", label: "Lost Money", Icon: DollarSign, iconColor: "text-red-300" },
  { key: "inviteandplace", label: "Invite and Place", Icon: UserPlus, iconColor: "text-cyan-300" },
  { key: "b2coinwallet", label: "B2 Coin Wallet", Icon: Wallet, iconColor: "text-yellow-300" },
];

function initials(name: string | null, email: string) {
  return ((name || email) ?? "?").charAt(0).toUpperCase();
}

// draft[userId][cardKey] — only ever holds cells the admin can actually edit
// (legacy cells never enter it, they're always locked-on).
type Draft = Record<string, Partial<Record<Bat246CardKey, boolean>>>;

// Game Boards isn't managed from this grid — access to boards themselves
// stays governed entirely by board position (Home Plate/3rd Base/2nd
// Base/1st Base), never an explicit grant. Every other card stays editable.
const NON_EDITABLE_CARDS: Bat246CardKey[] = ["boards"];

export default function Bat246PermissionPage() {
  const { userData, loading: authLoading } = useAmIFounder();
  const isAlanK = !authLoading && userData.email?.toLowerCase() === ALAN_K_EMAIL;

  const [people, setPeople] = useState<PersonRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  function loadPeople() {
    setPeople(null);
    setLoadError(false);
    fetch(`${API}/bat246/permissions/people-matrix`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setPeople(d.people ?? []))
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    if (!isAlanK) return;
    loadPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAlanK]);

  const filtered = useMemo(() => {
    if (!people) return [];
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(p => (p.name ?? "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  }, [people, search]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function isChecked(person: PersonRow, cardKey: Bat246CardKey): boolean {
    const cell = person.access[cardKey];
    if (cell.legacy) return true;
    if (editing) {
      const override = draft[person.userId]?.[cardKey];
      return override !== undefined ? override : cell.granted;
    }
    return cell.granted;
  }

  function startEdit() {
    setDraft({});
    setEditing(true);
  }

  function cancelEdit() {
    setDraft({});
    setEditing(false);
  }

  function toggle(person: PersonRow, cardKey: Bat246CardKey) {
    if (!editing || person.access[cardKey].legacy || NON_EDITABLE_CARDS.includes(cardKey)) return;
    const current = isChecked(person, cardKey);
    setDraft(prev => ({
      ...prev,
      [person.userId]: { ...prev[person.userId], [cardKey]: !current },
    }));
  }

  async function save() {
    if (!people) return;
    const changes: { userId: string; cardKey: Bat246CardKey; granted: boolean }[] = [];
    for (const person of people) {
      const overrides = draft[person.userId];
      if (!overrides) continue;
      for (const [cardKey, granted] of Object.entries(overrides) as [Bat246CardKey, boolean][]) {
        if (person.access[cardKey].granted !== granted) {
          changes.push({ userId: person.userId, cardKey, granted });
        }
      }
    }

    if (changes.length === 0) {
      setEditing(false);
      setDraft({});
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/bat246/permissions/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ changes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save changes");

      toast.success(`Updated permissions for ${new Set(changes.map(c => c.userId)).size} ${changes.length === 1 ? "person" : "people"}`);
      setEditing(false);
      setDraft({});
      loadPeople();
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return null;

  if (!isAlanK) {
    return (
      <div className="min-h-full w-full bg-[#09090f] text-white flex items-center justify-center p-8">
        <p className="text-white/40 text-sm">Admin only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#09090f] text-white overflow-auto">
      <div className="px-6 sm:px-12 py-8 sm:py-10 max-w-[1500px] mx-auto">

        {/* ── Header ───────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <Link
              href="/games/bat246"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-sm font-semibold transition-colors group mb-3"
            >
              <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
              Admin Board
            </Link>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-1.5">Permissions</h1>
            <p className="text-white/60 text-base sm:text-lg font-medium">
              Everyone in the BAT 246 office, and which admin cards they can reach.
            </p>
          </div>

          <div className="flex-shrink-0 flex items-center gap-3">
            {!editing ? (
              <button
                type="button"
                onClick={startEdit}
                disabled={!people}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand text-brand-foreground font-bold text-base hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                <Pencil className="w-5 h-5" /> Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.06] border-2 border-white/15 text-white font-bold text-base hover:bg-white/[0.1] transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-black font-bold text-base hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Save
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Legend ───────────────────────────────── */}
        <div className="flex items-center gap-5 flex-wrap mb-5 text-sm text-white/50">
          <div className="flex items-center gap-2">
            <span className="inline-flex w-5 h-5 rounded-md bg-brand items-center justify-center">
              <Check className="w-3.5 h-3.5 text-brand-foreground" />
            </span>
            Has access
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex w-5 h-5 rounded-md bg-white/10 border border-white/15 items-center justify-center">
              <Lock className="w-3 h-3 text-white/40" />
            </span>
            Board position (locked — not editable here)
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex w-5 h-5 rounded-md border-2 border-white/20" />
            No access
          </div>
        </div>

        {/* ── Search ───────────────────────────────── */}
        <div className="relative mb-5 max-w-md">
          <Search className="w-4.5 h-4.5 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full h-11 pl-11 pr-3 rounded-lg bg-white/[0.06] border-2 border-white/10 text-white text-base placeholder:text-white/35 focus:outline-none focus:border-brand"
          />
        </div>

        {/* ── Grid ─────────────────────────────────── */}
        {loadError ? (
          <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-8 text-center text-white/50">
            Failed to load. <button className="text-brand font-semibold" onClick={loadPeople}>Try again</button>
          </div>
        ) : !people ? (
          <div className="h-96 rounded-2xl border-2 border-white/10 bg-white/[0.03] animate-pulse" />
        ) : (
          <div className="rounded-2xl border-2 border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-white/[0.06]">
                    <th className="text-left px-4 py-3 text-sm font-bold text-white/70 uppercase tracking-wide sticky left-0 bg-[#14141c] z-10">
                      Person
                    </th>
                    {COLUMNS.map(col => {
                      const nonEditable = NON_EDITABLE_CARDS.includes(col.key);
                      return (
                        <th
                          key={col.key}
                          className="px-3 py-3 min-w-[110px]"
                          title={nonEditable ? "Governed by board position — not editable here" : undefined}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              <col.Icon className={`w-4.5 h-4.5 ${col.iconColor}`} />
                              {nonEditable && <Lock className="w-3 h-3 text-white/35" />}
                            </div>
                            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wide text-center leading-tight">
                              {col.label}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="px-4 py-10 text-center text-white/40">
                        No matching people found.
                      </td>
                    </tr>
                  )}
                  {paginated.map((person, i) => (
                    <tr key={person.userId} className={i % 2 === 0 ? "bg-white/[0.015]" : ""}>
                      <td className="px-4 py-3 sticky left-0 bg-[#111118] z-10 border-t border-white/5">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center text-sm font-bold">
                            {initials(person.name, person.email)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white text-base truncate">{person.name || person.email}</div>
                            <div className="text-white/45 text-sm truncate">{person.email}</div>
                          </div>
                        </div>
                      </td>
                      {COLUMNS.map(col => {
                        const cell = person.access[col.key];
                        const checked = isChecked(person, col.key);
                        const nonEditable = NON_EDITABLE_CARDS.includes(col.key);
                        const disabled = !editing || cell.legacy || nonEditable;
                        const locked = cell.legacy || (nonEditable && !checked);
                        const title = cell.legacy
                          ? "Has access via board position — not editable here"
                          : nonEditable
                            ? "Governed by board position — not editable here"
                            : undefined;
                        return (
                          <td key={col.key} className="px-3 py-3 border-t border-white/5">
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                title={title}
                                onClick={() => toggle(person, col.key)}
                                disabled={disabled}
                                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors disabled:cursor-not-allowed ${
                                  locked
                                    ? "bg-white/10 border-white/15"
                                    : checked
                                      ? "bg-brand border-brand"
                                      : editing
                                        ? "border-white/25 hover:border-brand/60 cursor-pointer"
                                        : "border-white/15 cursor-default"
                                }`}
                              >
                                {locked ? (
                                  <Lock className="w-3 h-3 text-white/40" />
                                ) : checked ? (
                                  <Check className="w-4 h-4 text-black" />
                                ) : null}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Pagination ───────────────────────────── */}
        {people && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-white/45 text-sm">
              {filtered.length} {filtered.length === 1 ? "person" : "people"} · page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/10 text-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/10 text-white disabled:opacity-40"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
