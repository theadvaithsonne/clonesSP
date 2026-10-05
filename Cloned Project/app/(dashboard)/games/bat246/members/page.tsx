"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  UserCircle,
  Crown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { getMembersCache, setMembersCache, type MembersApiResponse, type PersonBlock } from "@/lib/bat246MembersCache";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useBat246CardAccess } from "@/lib/hooks/useBat246CardAccess";

const API       = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 15;

type ApiResponse = MembersApiResponse;

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function initials(name: string | null, email: string | null) {
  return ((name || email) ?? "?").charAt(0).toUpperCase();
}

function MemberAvatar({ person, founder }: { person: Pick<PersonBlock, "name" | "email" | "profilePicture">; founder: boolean }) {
  if (person.profilePicture) {
    return (
      <img
        src={person.profilePicture}
        alt={person.name ?? ""}
        className="rounded-full object-cover shrink-0 ring-2 ring-white/8 group-hover:ring-white/20 transition-all"
        style={{ width: 32, height: 32 }}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all ring-2
        ${founder
          ? "bg-brand text-brand-foreground ring-brand/30"
          : "bg-white/8 text-white ring-white/10 group-hover:ring-white/20"
        }`}
      style={{ width: 32, height: 32 }}
    >
      {initials(person.name, person.email)}
    </div>
  );
}

function UplineAvatar({ person }: { person: Pick<PersonBlock, "name" | "email" | "profilePicture"> }) {
  if (person.profilePicture) {
    return (
      <img
        src={person.profilePicture}
        alt={person.name ?? ""}
        className="rounded-full object-cover shrink-0 ring-1 ring-white/10"
        style={{ width: 28, height: 28 }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-white/8 text-white ring-1 ring-white/10"
      style={{ width: 28, height: 28 }}
    >
      {initials(person.name, person.email)}
    </div>
  );
}

const GRID    = "grid-cols-[1fr_140px_180px_120px_100px_220px]";
const SKELGRD = "grid-cols-[1fr_140px_180px_120px_100px_220px]";

export default function Bat246MembersPage() {
  const [data,    setData]    = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const [focused, setFocused] = useState(false);
  const [page,    setPage]    = useState(1);
  const { loading: authLoading } = useAmIFounder();
  const { isAdmin } = useBat246CardAccess("members");
  const [hasDashboardAccess, setHasDashboardAccess] = useState(false);

  useEffect(() => {
    if (authLoading || isAdmin) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/my-dashboard-access`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setHasDashboardAccess(!!d.hasAccess))
      .catch(() => {});
  }, [authLoading, isAdmin]);

  useEffect(() => {
    const cached = getMembersCache();
    if (cached) { setData(cached as ApiResponse); setLoading(false); return; }
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/office/bat246/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: ApiResponse) => { setMembersCache(d); setData(d); setError(null); })
      .catch(() => setError("Failed to load members"))
      .finally(() => setLoading(false));
  }, []);

  const allMembers = data?.members ?? [];

  const filtered = allMembers.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.name  ?? "").toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q) ||
      (m.address.city    ?? "").toLowerCase().includes(q) ||
      (m.address.country ?? "").toLowerCase().includes(q) ||
      (m.upline?.name  ?? "").toLowerCase().includes(q) ||
      (m.upline?.email ?? "").toLowerCase().includes(q)
    );
  });

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start      = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end        = Math.min(page * PAGE_SIZE, filtered.length);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-full bg-[#09090f] text-white p-6">
      <div className="max-w-[1400px] mx-auto">

        {/* Back */}
        <div className="mb-4">
          <Link
            href={isAdmin ? "/games/bat246" : hasDashboardAccess ? "/games/bat246/dashboard" : "/games/bat246/boards"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.1] hover:border-white/25 text-sm font-semibold transition-colors group"
          >
            <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            {isAdmin ? "Admin Board" : hasDashboardAccess ? "Dashboard" : "Boards"}
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">BAT 246 Office Members</h2>
            <p className="text-[13px] text-[#7a7a7a] mt-1">
              {loading
                ? "Loading…"
                : `${data?.totalMembers ?? 0} member${(data?.totalMembers ?? 0) !== 1 ? "s" : ""} in the office`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
              focused ? "text-violet-400" : "text-[#5a5a5a]"
            }`}
            style={{ width: 15, height: 15 }}
          />
          <input
            type="text"
            placeholder="Search by name, email, city, country or upline…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full h-10 pl-10 pr-5 rounded-lg bg-[#0e0e14] border border-white/[0.08] text-[13px] text-white
                       placeholder:text-[#5a5a5a]
                       focus:outline-none focus:border-violet-500/30 focus:ring-1 focus:ring-violet-500/10
                       transition-all duration-200"
          />
          {search && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-[#5a5a5a]">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-[#0b0b12] rounded-xl border border-white/[0.08] overflow-hidden">
            <div className={`grid ${SKELGRD} px-5 py-3 border-b border-white/[0.06]`}>
              {[220, 100, 130, 70, 65, 150].map((w, i) => (
                <div key={i} className="h-2 bg-white/8 rounded animate-pulse" style={{ maxWidth: w }} />
              ))}
            </div>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`grid ${SKELGRD} px-5 py-3 items-center border-b border-white/[0.05] last:border-b-0`}>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-white/8 shrink-0 animate-pulse" style={{ width: 32, height: 32 }} />
                  <div>
                    <div className="h-3 w-32 bg-white/10 rounded animate-pulse mb-1.5" />
                    <div className="h-2.5 w-44 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-2.5 w-24 bg-white/8 rounded animate-pulse" />
                <div className="h-2.5 w-28 bg-white/8 rounded animate-pulse" />
                <div className="h-5 w-20 bg-white/8 rounded-full animate-pulse" />
                <div className="h-2.5 w-16 bg-white/8 rounded animate-pulse" />
                <div className="flex items-center gap-2.5">
                  <div className="rounded-full bg-white/8 animate-pulse shrink-0" style={{ width: 28, height: 28 }} />
                  <div>
                    <div className="h-2.5 w-24 bg-white/10 rounded animate-pulse mb-1" />
                    <div className="h-2 w-32 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-900/40 border border-red-500/30 rounded-xl p-5 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-[#0b0b12] flex items-center justify-center mb-3 ring-1 ring-white/8">
              <UserCircle className="h-7 w-7 text-[#5a5a5a]" />
            </div>
            <p className="text-sm text-[#a8a8a8]">
              {search ? "No members match your search" : "No members found"}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && filtered.length > 0 && (
          <div className="bg-[#0b0b12] rounded-xl border border-white/[0.08] overflow-hidden animate-[fadeIn_0.3s_ease-out]">

            {/* Header */}
            <div className={`grid ${GRID} px-5 py-3 text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-[0.12em] border-b border-white/[0.06] items-center`}>
              <span>Member</span>
              <span>Phone</span>
              <span>Location</span>
              <span>Role</span>
              <span>Joined</span>
              <span>Upline (Referrer)</span>
            </div>

            {/* Rows */}
            <div>
              {paginated.map((m, i) => {
                const loc       = [m.address.city, m.address.country].filter(Boolean).join(", ");
                const isFounder = m.role === "founder";

                return (
                  <div
                    key={m.userId}
                    style={{ animationDelay: `${i * 20}ms` }}
                    className={`grid ${GRID} px-5 py-3 items-center
                               border-b border-white/[0.05] last:border-b-0
                               hover:bg-white/[0.03] transition-all duration-150
                               animate-[fadeIn_0.3s_ease-out_both] group`}
                  >
                    {/* Member */}
                    <div className="flex items-center gap-3 min-w-0">
                      <MemberAvatar person={m} founder={isFounder} />
                      <div className="min-w-0">
                        <p
                          title={m.name ?? undefined}
                          className="text-[13px] font-semibold text-white truncate group-hover:text-violet-300 transition-colors"
                        >
                          {m.name || <span className="text-[#5a5a5a] italic font-normal">No name</span>}
                        </p>
                        <p title={m.email ?? undefined} className="text-[11px] text-[#7a7a7a] truncate mt-0.5">
                          {m.email || "—"}
                        </p>
                      </div>
                    </div>

                    {/* Phone */}
                    <span className="text-[12px] text-[#a8a8a8] truncate">
                      {m.phone || "—"}
                    </span>

                    {/* Location */}
                    <span className="text-[12px] text-[#a8a8a8] truncate" title={m.address.formatted ?? undefined}>
                      {loc || "—"}
                    </span>

                    {/* Role */}
                    <div>
                      {isFounder ? (
                        <Badge
                          variant="outline"
                          className="border-brand/20 bg-brand/5 text-brand text-[10px] gap-1 font-semibold px-2 py-0.5"
                        >
                          <Crown className="h-2.5 w-2.5" />
                          Founder
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-violet-500/20 bg-violet-500/5 text-violet-300 text-[10px] font-medium px-2 py-0.5"
                        >
                          Stakeholder
                        </Badge>
                      )}
                    </div>

                    {/* Joined */}
                    <span className="text-[11px] text-[#7a7a7a] tabular-nums font-medium">
                      {fmtDate(m.joinedAt)}
                    </span>

                    {/* Upline */}
                    {m.upline ? (
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UplineAvatar person={m.upline} />
                        <div className="min-w-0">
                          <p title={m.upline.name ?? undefined} className="text-[12px] font-medium text-[#c8c8c8] truncate">
                            {m.upline.name || <span className="text-[#5a5a5a] italic font-normal">No name</span>}
                          </p>
                          <p title={m.upline.email ?? undefined} className="text-[11px] text-[#5a5a5a] truncate mt-0.5">
                            {m.upline.email || "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#3a3a3a]">—</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.08]">
                <span className="text-xs text-[#7a7a7a]">
                  Showing <span className="text-white font-semibold">{start}</span>–
                  <span className="text-white font-semibold">{end}</span> of{" "}
                  <span className="text-white font-semibold">{filtered.length}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#a8a8a8] bg-[#0e0e12] border border-white/8 rounded-lg hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <span className="text-xs text-[#7a7a7a] px-1">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#a8a8a8] bg-[#0e0e12] border border-white/8 rounded-lg hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
