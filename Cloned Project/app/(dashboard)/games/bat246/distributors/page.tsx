"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Search,
  Copy,
} from "lucide-react";
import {
  getMembersCache,
  setMembersCache,
  type CachedMember,
  type PersonBlock,
} from "@/lib/bat246MembersCache";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useBat246CardAccess } from "@/lib/hooks/useBat246CardAccess";
import { toast } from "sonner";

const API          = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE    = 15;

// Plain CSS values applied via inline style (not a Tailwind class) — dynamic
// arbitrary-value grid-cols-[...] classes built from a ternary get purged by
// the JIT scanner (same reason BoardLayout.tsx uses inline gridColumn/gridRow
// instead of dynamic Tailwind classes — see bat246_gameplay_rules.md).
// The Invite-To-POD / POD Invite Status columns (and the "+ Invite" button)
// moved to /games/bat246/Inviteandplace — this page is back to a plain
// qualified-distributors list.
const GRID_9  = "1fr 200px 145px 220px 125px";
const GRID_10 = "1fr 200px 145px 220px 125px 105px";

interface DistributorUser {
  _id: string;
  name?: string;
  email: string;
  phone?: string;
  profilePicture?: string;
  country?: string;
  state?: string;
  city?: string;
}

interface Distributor {
  _id: string;
  // Mongoose .populate() returns null (not a throw) when the referenced
  // user document no longer exists — an orphaned distributor record. The
  // type used to claim this was always present, which is exactly how a
  // deleted user's leftover distributor row crashed the whole page (line
  // ~435 read u.name straight off this with no guard).
  userId: DistributorUser | null;
  distributorId?: string;
  isOfficeMember: boolean;
  isGarageAffiliate: boolean;
  garageAffiliateExpiresAt?: string;
  hasBat246Membership: boolean;
  membershipExpiresAt?: string;
  hasPurchasedProduct: boolean;
  isQualified: boolean;
  qualifiedAt?: string;
  isOnBoard?: boolean;
  isApproved?: boolean;
  // Still present on the API response (listDistributors always computes it —
  // the Inviteandplace page reads it), just no longer rendered on this page.
  podStatus: "not_invited" | "invited" | "purchased" | "placed";
  podInvitedByName?: string | null;
  podPlacedBoardTrackingNo?: string | null;
}

interface ApiResponse {
  distributors: Distributor[];
  total: number;
  page: number;
  pages: number;
}

interface PlacementInfo {
  boardId: string;
  boardTrackingNo: string;
  reservedPosition: string | null;
  reservedPositionStatus: "filled" | "blank" | null;
  reservedPositionStale: boolean;
  availablePositions: string[];
  dugoutAvailable: boolean;
}

const DUGOUT = "__dugout__";

function positionLabel(key: string): string {
  if (key === "thirdBase") return "3rd Base";
  if (key === "secondBaseA") return "2nd Base A";
  if (key === "secondBaseB") return "2nd Base B";
  if (key.startsWith("1st")) return `1st Base ${key[3]}`;
  if (key.startsWith("atBat-")) return `At Bat ${Number(key.split("-")[1]) + 1}`;
  if (key === DUGOUT) return "Dugout";
  return key;
}

function fmtDate(s?: string) {
  return s ? new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—";
}

function findNearbyUpline(
  userId: string,
  membersMap: Map<string, CachedMember>,
  distributorSet: Set<string>,
): PersonBlock | null {
  const visited = new Set<string>([userId]);
  let current   = membersMap.get(userId);

  for (let depth = 0; depth < 20; depth++) {
    if (!current?.upline) break;
    const uplineId = current.upline.userId;
    if (visited.has(uplineId)) break;
    visited.add(uplineId);
    if (distributorSet.has(uplineId)) {
      const rich = membersMap.get(uplineId);
      return rich ?? current.upline;
    }
    current = membersMap.get(uplineId);
  }

  return null;
}

export default function Bat246DistributorsPage() {
  const [page,        setPage]        = useState(1);
  const [data,        setData]        = useState<ApiResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [membersData, setMembersData] = useState<CachedMember[] | null>(null);
  const [allDistIds,  setAllDistIds]  = useState<Set<string>>(new Set());
  const [search,      setSearch]      = useState("");
  const [focused,     setFocused]     = useState(false);
  const [approving,   setApproving]   = useState<string | null>(null);
  const [approved,    setApproved]    = useState<Set<string>>(new Set());
  const [placementModal, setPlacementModal] = useState<{
    userId: string;
    info: PlacementInfo;
    selected: string;
    error: string | null;
    submitting: boolean;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const { loading: authLoading } = useAmIFounder();
  const { isAdmin } = useBat246CardAccess("distributors");
  const [hasDashboardAccess, setHasDashboardAccess] = useState(false);
  const [isFirstBase, setIsFirstBase] = useState(false);
  const [salesCredits, setSalesCredits] = useState<number | null>(null);
  const [atBatFilledCount, setAtBatFilledCount] = useState<number | null>(null);
  const [myCardType, setMyCardType] = useState<string | null>(null);
  const canPlaceUsers = isFirstBase;
  // Approve column is restricted to 1st Base players only —
  // admin, 2nd Base A/B, 3rd Base, Home Plate must not see it at all
  const canApprove = canPlaceUsers;
  // Board nearly full (6 of 8 AT BAT slots filled) — Approve is disabled for
  // everyone in this state, regardless of the rules below.
  const boardNearlyFull = atBatFilledCount === 6;
  // Approve is clickable only when 1st Base has earned both Green Cards (salesCredits===2)
  // and has NOT yet earned Gold (myCardType===null). Once Gold is earned, all further
  // referrals go to Dugout automatically — no manual Approve needed.
  const canClickApprove = canPlaceUsers && !boardNearlyFull && salesCredits === 2 && myCardType === null;

  useEffect(() => {
    if (authLoading || isAdmin) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/my-dashboard-access`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setHasDashboardAccess(!!d.hasAccess); setIsFirstBase(!!d.canApprove); setSalesCredits(d.salesCredits ?? null); setAtBatFilledCount(d.atBatFilledCount ?? null); setMyCardType(d.myCardType ?? null); })
      .catch(() => {});
  }, [authLoading, isAdmin]);

  useEffect(() => {
    const cached = getMembersCache();
    if (cached) { setMembersData(cached.members); return; }
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/office/bat246/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setMembersCache(d); setMembersData(d.members ?? []); })
      .catch(() => setMembersData([]));
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/distributors?page=1&limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const ids = new Set<string>(
          (d.distributors ?? []).map((dist: any) => String(dist.userId?._id ?? dist.userId))
        );
        setAllDistIds(ids);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/distributors?page=${page}&limit=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r  => r.json())
      .then(d  => { setData(d); setError(null); })
      .catch(() => setError("Failed to load distributors"))
      .finally(() => setLoading(false));
  }, [page]);

  const membersMap = useMemo(() => {
    const map = new Map<string, CachedMember>();
    (membersData ?? []).forEach(m => map.set(m.userId, m));
    return map;
  }, [membersData]);

  // Client-side search filter across all loaded distributors
  const allDistributors = data?.distributors ?? [];
  const filtered = useMemo(() => {
    if (!search) return allDistributors;
    const q = search.toLowerCase();
    return allDistributors.filter(d => {
      const u = d.userId;
      // Same orphaned-row case as the render map below — nothing to
      // search against, so it just never matches instead of crashing.
      if (!u) return false;
      const loc = [u.city, u.state, u.country].filter(Boolean).join(", ");
      const nearbyUpline = findNearbyUpline(u._id, membersMap, allDistIds);
      return (
        (u.name  ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q) ||
        (nearbyUpline?.name  ?? "").toLowerCase().includes(q) ||
        (nearbyUpline?.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [search, allDistributors, membersMap, allDistIds]);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search]);

  function defaultSelection(info: PlacementInfo): string {
    if (
      info.reservedPosition &&
      !info.reservedPositionStale &&
      info.reservedPositionStatus === "blank" &&
      info.availablePositions.includes(info.reservedPosition)
    ) {
      return info.reservedPosition;
    }
    if (info.availablePositions.length > 0) return info.availablePositions[0];
    return "";
  }

  async function handleApprove(userId: string) {
    if (approving) return;
    setApproving(userId);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/distributors/${userId}/placement-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to load placement info");
        return;
      }
      const info: PlacementInfo = d;
      setPlacementModal({ userId, info, selected: defaultSelection(info), error: null, submitting: false });
    } catch {
      toast.error("Failed to load placement info");
    } finally {
      setApproving(null);
    }
  }

  async function refreshPlacementInfo(userId: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    const res = await fetch(`${API}/bat246/distributors/${userId}/placement-info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Failed to load placement info");
    return d as PlacementInfo;
  }

  async function handleConfirmPlacement() {
    if (!placementModal || placementModal.submitting) return;
    const { userId, selected } = placementModal;
    if (!selected) return;
    setPlacementModal(m => m && { ...m, submitting: true, error: null });
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const body =
        selected === DUGOUT
          ? { boardId: placementModal.info.boardId, toDugout: true }
          : { boardId: placementModal.info.boardId, position: selected };
      const res = await fetch(`${API}/bat246/distributors/${userId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        // Position no longer valid — refresh choices, let admin pick again
        try {
          const info = await refreshPlacementInfo(userId);
          setPlacementModal({ userId, info, selected: defaultSelection(info), error: d.error || "Placement failed — please choose again", submitting: false });
        } catch {
          setPlacementModal(m => m && { ...m, submitting: false, error: d.error || "Placement failed — please choose again" });
        }
        return;
      }
      setApproved(prev => new Set(prev).add(userId));
      setPlacementModal(null);
    } catch {
      setPlacementModal(m => m && { ...m, submitting: false, error: "Network error — please try again" });
    }
  }

  const total      = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;
  const start      = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end        = Math.min(page * PAGE_SIZE, total);
  const paginated  = filtered;

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
            <h2 className="text-2xl font-bold text-white tracking-tight">Distributors</h2>
            <p className="text-sm text-[#9a9a9a] mt-1">
              {total} qualified BAT246 distributor{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
              focused ? "text-amber-400" : "text-[#5a5a5a]"
            }`}
            style={{ width: 15, height: 15 }}
          />
          <input
            type="text"
            placeholder="Search by name, email, phone, location or upline…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full h-11 pl-10 pr-5 rounded-lg bg-[#0e0e14] border border-white/[0.08] text-sm text-white
                       placeholder:text-[#6a6a6a]
                       focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/10
                       transition-all duration-200"
          />
          {search && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-[#8a8a8a]">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-[#0b0b12] rounded-xl border border-white/[0.08] overflow-hidden">
            <div className="grid px-5 py-3 border-b border-white/[0.06]" style={{ gridTemplateColumns: canApprove ? GRID_10 : GRID_9 }}>
              {[200, 120, 80, 120, 70, ...(canApprove ? [60] : [])].map((w, i) => (
                <div key={i} className={`h-2 bg-white/8 rounded animate-pulse ${i > 3 ? "mx-auto" : ""}`} style={{ maxWidth: w }} />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid px-5 py-4 items-center border-b border-white/[0.05] last:border-b-0" style={{ gridTemplateColumns: canApprove ? GRID_10 : GRID_9 }}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/8 shrink-0 animate-pulse" />
                  <div>
                    <div className="h-3 w-32 bg-white/10 rounded animate-pulse mb-1.5" />
                    <div className="h-2.5 w-40 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-2.5 w-28 bg-white/8 rounded animate-pulse" />
                <div className="h-2.5 w-24 bg-white/8 rounded animate-pulse" />
                <div className="h-2.5 w-28 bg-white/8 rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-white/8 rounded animate-pulse" />
                {canApprove && <div className="h-6 w-14 mx-auto bg-white/8 rounded animate-pulse" />}
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
        {!loading && !error && data && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-[#0b0b12] flex items-center justify-center mb-3 ring-1 ring-white/8">
              <UserCircle className="h-7 w-7 text-[#5a5a5a]" />
            </div>
            <p className="text-sm text-[#a8a8a8]">
              {search ? "No distributors match your search" : "No qualified distributors yet"}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && data && filtered.length > 0 && (
          <div className="bg-[#0b0b12] rounded-xl border border-white/[0.08] overflow-hidden">

            {/* Header row */}
            <div className="grid px-5 py-3.5 text-[11px] font-semibold text-[#8a8a8a] uppercase tracking-[0.1em] border-b border-white/[0.06] items-center" style={{ gridTemplateColumns: canApprove ? GRID_10 : GRID_9 }}>
              <span>Distributor</span>
              <span>Nearby Upline</span>
              <span>Phone</span>
              <span>Location</span>
              <span>Qualified</span>
              {canApprove && <span>Action</span>}
            </div>

            {/* Rows */}
            <div>
              {paginated.map((d, i) => {
                const u = d.userId;
                // Orphaned row — the user this distributor pointed at was
                // deleted. Nothing to show, so skip it instead of crashing
                // the rest of the list.
                if (!u) return null;
                const initial      = (u.name || u.email).charAt(0).toUpperCase();
                const loc          = [u.city, u.state, u.country].filter(Boolean).join(", ");
                const nearbyUpline = findNearbyUpline(u._id, membersMap, allDistIds);

                return (
                  <div
                    key={d._id}
                    style={{ animationDelay: `${i * 20}ms`, gridTemplateColumns: canApprove ? GRID_10 : GRID_9 }}
                    className="grid px-5 py-4 items-center border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.04] transition-all duration-150 animate-[fadeIn_0.3s_ease-out_both] group"
                  >
                    {/* Avatar + Name + Email */}
                    <div className="flex items-center gap-3 min-w-0">
                      {u.profilePicture ? (
                        <img
                          src={u.profilePicture}
                          alt={u.name || u.email}
                          className="h-10 w-10 rounded-full object-cover shrink-0 ring-2 ring-white/8"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-white/8 text-white ring-2 ring-white/10 group-hover:ring-white/20 transition-all">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/games/bat246/distributors/${u._id}`}
                            className="text-[15px] font-semibold text-white truncate hover:text-brand transition-colors"
                          >
                            {u.name || "—"}
                          </Link>
                          {d.distributorId && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-semibold text-amber-400 tracking-wide">
                              {d.distributorId}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[12.5px] text-[#9a9a9a] truncate">{u.email}</p>
                          <button
                            onClick={() => { navigator.clipboard.writeText(u.email); setCopiedEmail(u._id); setTimeout(() => setCopiedEmail(null), 1500); }}
                            className="shrink-0 text-[#4a4a4a] hover:text-amber-400 transition-colors"
                            title="Copy email"
                          >
                            <Copy style={{ width: 12, height: 12 }} />
                          </button>
                          {copiedEmail === u._id && <span className="text-[10px] text-amber-400 shrink-0">Copied</span>}
                        </div>
                      </div>
                    </div>

                    {/* Nearby Upline */}
                    <div className="min-w-0">
                      {nearbyUpline ? (
                        <>
                          <p className="text-[13px] text-[#d8d8d8] truncate font-medium">{nearbyUpline.name || "—"}</p>
                          <p className="text-[12px] text-[#6a6a6a] truncate mt-0.5">{nearbyUpline.email || ""}</p>
                        </>
                      ) : (
                        <span className="text-[13px] text-[#4a4a4a]">—</span>
                      )}
                    </div>

                    {/* Phone */}
                    <span className="text-[13px] text-[#b8b8b8] truncate">
                      {u.phone || "—"}
                    </span>

                    {/* Location */}
                    <span className="text-[13px] text-[#b8b8b8] truncate" title={loc || undefined}>
                      {loc || "—"}
                    </span>

                    {/* Qualified At */}
                    <span className="text-[12.5px] text-[#9a9a9a] tabular-nums font-medium">
                      {fmtDate(d.qualifiedAt)}
                    </span>

                    {/* Approve (1st Base only) */}
                    {canApprove && (
                      <div className="flex justify-center">
                        {approved.has(u._id) || d.isApproved || d.isOnBoard ? (
                          <button
                            disabled
                            className="px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-[12px] font-semibold cursor-not-allowed opacity-70"
                          >
                            Approved
                          </button>
                        ) : d.isQualified && canPlaceUsers && canClickApprove ? (
                          <button
                            onClick={() => handleApprove(u._id)}
                            disabled={approving === u._id}
                            className="px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[12px] font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {approving === u._id ? "…" : "Approve"}
                          </button>
                        ) : d.isQualified && canPlaceUsers ? (
                          <button
                            disabled
                            title={
                              boardNearlyFull
                                ? "Approvals are paused while the board is nearly full"
                                : salesCredits === 0
                                ? "Generate your first sale link (Without Position) to unlock Approve"
                                : salesCredits === 1
                                ? "Your second AT BAT slot is being auto-filled — Approve unlocks after your 2nd Green Card"
                                : myCardType === "Gold"
                                ? "Gold card already earned — new referrals go to Dugout automatically"
                                : "Both your 1st Base positions are filled"
                            }
                            className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white/30 text-[12px] font-semibold cursor-not-allowed"
                          >
                            Approve
                          </button>
                        ) : (
                          <span className="text-[12px] text-white/20">—</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.08]">
                <span className="text-[13px] text-[#9a9a9a]">
                  Showing <span className="text-white font-semibold">{start}</span>–
                  <span className="text-white font-semibold">{end}</span> of{" "}
                  <span className="text-white font-semibold">{filtered.length}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#a8a8a8] bg-[#0e0e12] border border-white/8 rounded-lg hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <span className="text-[13px] text-[#9a9a9a] px-1">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#a8a8a8] bg-[#0e0e12] border border-white/8 rounded-lg hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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

      {/* Approve placement modal */}
      {placementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#0e0e14] border border-white/10 rounded-xl w-full max-w-md p-5">
            <h3 className="text-sm font-bold text-white mb-1">Approve & Place on Board</h3>
            <p className="text-[11px] text-[#7a7a7a] mb-4">
              Board #{placementModal.info.boardTrackingNo || "—"}
            </p>

            {/* Reserved position info */}
            {placementModal.info.reservedPosition && (
              <div className="mb-3 text-[12px] text-[#c8c8c8]">
                Reserved position: <span className="font-semibold text-white">{positionLabel(placementModal.info.reservedPosition)}</span>{" "}
                {placementModal.info.reservedPositionStale ? (
                  <span className="text-amber-400">(on a closed board — no longer applicable)</span>
                ) : placementModal.info.reservedPositionStatus === "filled" ? (
                  <span className="text-red-400">(now filled — choose another)</span>
                ) : (
                  <span className="text-green-400">(open)</span>
                )}
              </div>
            )}
            {!placementModal.info.reservedPosition && (
              <p className="mb-3 text-[12px] text-[#7a7a7a]">No reservation on file — choose a position below.</p>
            )}

            {/* Position choices (Dugout excluded — 1st Base cannot place into Dugout) */}
            {placementModal.info.availablePositions.length > 0 ? (
              <div className="mb-4">
                <label className="block text-[11px] text-[#7a7a7a] mb-1.5">Place at</label>
                <select
                  value={placementModal.selected}
                  onChange={e => setPlacementModal(m => m && { ...m, selected: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-amber-500/30"
                >
                  {placementModal.info.availablePositions.map(key => (
                    <option key={key} value={key}>{positionLabel(key)}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mb-4 text-[12px] text-amber-400">
                No position available on this board and Dugout is full — cannot place automatically.
              </p>
            )}

            {placementModal.error && (
              <p className="mb-3 text-[12px] text-red-400">{placementModal.error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPlacementModal(null)}
                disabled={placementModal.submitting}
                className="px-3 py-1.5 rounded-md bg-white/[0.06] border border-white/10 text-white text-[12px] font-medium hover:bg-white/[0.1] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPlacement}
                disabled={placementModal.submitting || !placementModal.selected}
                className="px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[12px] font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {placementModal.submitting ? "…" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
