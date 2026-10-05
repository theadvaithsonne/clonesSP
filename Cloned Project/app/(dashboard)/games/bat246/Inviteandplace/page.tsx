"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Search,
  Copy,
  Trash2,
} from "lucide-react";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useBat246CardAccess } from "@/lib/hooks/useBat246CardAccess";
import { InviteNewDistributorModal } from "@/components/bat246/InviteNewDistributorModal";
import { toast } from "sonner";

// This page started as a duplicate of /games/bat246/distributors's grid +
// the "+ Invite to become Bat246 Distributor" button + the Invite-To-POD /
// POD Invite Status columns, kept as its own standalone page while
// /games/bat246/distributors itself was trimmed back down to a plain
// qualified-distributors list (no invite button, no POD columns). It has
// since grown its own "Invite To Board" / "Board Invite Status" columns
// (the $650 Board Entry counterpart to POD) and an admin-only permanent
// delete — the two pages are no longer exact duplicates. See
// "md files/Distributors.md" for the full write-up of the shared logic.

const API          = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE    = 15;

// Fixed px widths (not `1fr`) for every column, applied via inline style —
// dynamic arbitrary-value grid-cols-[...] classes built from a ternary get
// purged by the Tailwind JIT scanner (same reason BoardLayout.tsx uses
// inline gridColumn/gridRow instead — see bat246_gameplay_rules.md). `1fr`
// for the Distributor column used to work with 7 columns, but once this page
// grew to 8 fixed-width columns (POD + Board invite/status pairs) the sum of
// the fixed columns started exceeding the table's available width, squeezing
// the flexible column down to near-zero — which is why the name/email
// appeared to vanish. Fixed widths + a horizontal-scroll wrapper (see the
// table's outer div below) fixes that: every column always renders at a
// readable size, and the table scrolls sideways instead of collapsing.
const BASE_COLUMN_WIDTHS = [280, 145, 220, 110, 115, 200, 115, 200]; // Distributor, Phone, Location, Qualified, Invite To POD, POD Invite Status, Invite To Board, Board Invite Status
const APPROVE_COLUMN_WIDTH = 110;
const DELETE_COLUMN_WIDTH = 70;

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
  userId: DistributorUser;
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
  podStatus: "not_invited" | "invited" | "purchased" | "placed";
  podInvitedByName?: string | null;
  podPlacedBoardTrackingNo?: string | null;
  // $650 Board Entry counterpart to the POD fields above — "qualified" means
  // the backend verified an actual paid invoice on the $650 Board Entry
  // product (not just isQualified, which can also be satisfied by the $160
  // POD purchase). boardStatus can be "qualified"/"placed" WITHOUT an invite
  // ever having been sent through this button (e.g. approved the old way,
  // or purchased organically) — that's expected: "already qualified/placed"
  // is itself shown as "Invited" in the Invite To Board column.
  boardStatus: "not_invited" | "invited" | "qualified" | "placed";
  boardInvitedByName?: string | null;
  boardInviteSentAt?: string | null;
  boardPlacedBoardTrackingNo?: string | null;
  // Fallback "who invited them" name when neither boardInvitedByName nor
  // podInvitedByName is set — the original bat246Ref referrer.
  referredByName?: string | null;
}

interface PodBoardOption {
  _id: string;
  boardNumber: number;
  trackingNumber: string;
  podBlankCount: number;
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

interface BoardOption {
  boardId: string;
  boardTrackingNo: string;
  boardNumber: number;
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

export default function Bat246InviteAndPlacePage() {
  const [page,        setPage]        = useState(1);
  const [data,        setData]        = useState<ApiResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [podSending, setPodSending] = useState<string | null>(null);
  const [podPlaceModal, setPodPlaceModal] = useState<{
    userId: string;
    boards: PodBoardOption[];
    loading: boolean;
    selectedBoardId: string;
    error: string | null;
    submitting: boolean;
  } | null>(null);
  // $650 Board Entry invite/place — separate state from POD's (own endpoints,
  // own permission model: open to any active-board member, same gate as POD).
  const [boardSending, setBoardSending] = useState<string | null>(null);
  const [boardPlaceModal, setBoardPlaceModal] = useState<{
    userId: string;
    info: PlacementInfo;
    selected: string;
    error: string | null;
    submitting: boolean;
    // Admin-only board picker — every open board, not just the one
    // getPlacementInfo auto-detected. null while loading/for non-admins.
    boardOptions: BoardOption[] | null;
    boardSwitching: boolean;
  } | null>(null);
  // Admin-only permanent delete — confirm popup before the actual DELETE call.
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { loading: authLoading } = useAmIFounder();
  const { isAdmin } = useBat246CardAccess("inviteandplace");
  const [hasDashboardAccess, setHasDashboardAccess] = useState(false);
  const [isFirstBase, setIsFirstBase] = useState(false);
  const [salesCredits, setSalesCredits] = useState<number | null>(null);
  const [atBatFilledCount, setAtBatFilledCount] = useState<number | null>(null);
  const [myCardType, setMyCardType] = useState<string | null>(null);
  // Gates both POD columns — a viewer who isn't part of any active board
  // can't send invites/reminders or place anyone (nowhere to place into).
  const [canAccessPod, setCanAccessPod] = useState(false);
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
    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
    fetch(`${API}/bat246/my-active-board-membership`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setCanAccessPod(!!d.isPartOfActiveBoard))
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

  // Client-side search filter across all loaded distributors
  const allDistributors = data?.distributors ?? [];
  const filtered = useMemo(() => {
    if (!search) return allDistributors;
    const q = search.toLowerCase();
    return allDistributors.filter(d => {
      const u = d.userId;
      const loc = [u.city, u.state, u.country].filter(Boolean).join(", ");
      return (
        (u.name  ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q)
      );
    });
  }, [search, allDistributors]);

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

  async function handlePodInvite(userId: string) {
    if (podSending) return;
    setPodSending(userId);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/distributors/${userId}/invite-pod`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to send invite");
        return;
      }
      setData(prev =>
        prev && {
          ...prev,
          distributors: prev.distributors.map(x =>
            x.userId._id === userId ? { ...x, podStatus: "invited" } : x
          ),
        }
      );
      toast.success(d.type === "remind" ? "Reminder sent" : "Invite sent");
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setPodSending(null);
    }
  }

  async function handleOpenPodPlaceModal(userId: string) {
    setPodPlaceModal({ userId, boards: [], loading: true, selectedBoardId: "", error: null, submitting: false });
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/boards/my-active-pod-boards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        setPodPlaceModal(m => m && { ...m, loading: false, error: d.error || "Failed to load your boards" });
        return;
      }
      const boards: PodBoardOption[] = d.boards ?? [];
      setPodPlaceModal(m => m && { ...m, boards, loading: false, selectedBoardId: boards[0]?._id ?? "" });
    } catch {
      setPodPlaceModal(m => m && { ...m, loading: false, error: "Failed to load your boards" });
    }
  }

  async function handleConfirmPodPlace() {
    if (!podPlaceModal || podPlaceModal.submitting || !podPlaceModal.selectedBoardId) return;
    const { userId, selectedBoardId } = podPlaceModal;
    setPodPlaceModal(m => m && { ...m, submitting: true, error: null });
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/distributors/${userId}/place-pod`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: selectedBoardId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setPodPlaceModal(m => m && { ...m, submitting: false, error: d.error || "Failed to place on board" });
        return;
      }
      setData(prev =>
        prev && {
          ...prev,
          distributors: prev.distributors.map(x =>
            x.userId._id === userId
              ? { ...x, podStatus: "placed", podPlacedBoardTrackingNo: d.boardTrackingNumber }
              : x
          ),
        }
      );
      toast.success(`Placed on board ${d.boardTrackingNumber}`);
      setPodPlaceModal(null);
    } catch {
      setPodPlaceModal(m => m && { ...m, submitting: false, error: "Network error — please try again" });
    }
  }

  async function handleBoardInvite(userId: string) {
    if (boardSending) return;
    setBoardSending(userId);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/distributors/${userId}/invite-board`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to send invite");
        return;
      }
      setData(prev =>
        prev && {
          ...prev,
          distributors: prev.distributors.map(x =>
            x.userId._id === userId
              ? { ...x, boardStatus: x.boardStatus === "not_invited" ? "invited" : x.boardStatus, boardInviteSentAt: new Date().toISOString() }
              : x
          ),
        }
      );
      toast.success(d.type === "remind" ? "Reminder sent" : "Invite sent");
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setBoardSending(null);
    }
  }

  async function handleOpenBoardPlaceModal(userId: string) {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/distributors/${userId}/board-placement-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to load placement info");
        return;
      }
      const info: PlacementInfo = d;
      setBoardPlaceModal({ userId, info, selected: defaultSelection(info), error: null, submitting: false, boardOptions: null, boardSwitching: false });

      // Load boards for the picker dropdown — admin gets every open board,
      // anyone else gets only the boards they're personally part of (the
      // backend scopes this by caller, see listOpenBoardsForPlacement). The
      // dropdown itself only renders when there's actually more than one
      // option (see the modal JSX below), so a non-admin on just one board
      // still sees the plain "Board #xyz" line as before. Fetched after the
      // modal is already showing (with the auto-detected board), so a
      // slow/failed fetch just means no dropdown rather than a blocked modal.
      try {
        const boardsRes = await fetch(`${API}/bat246/boards/open-for-placement`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const boardsData = await boardsRes.json();
        if (boardsRes.ok) {
          setBoardPlaceModal(m => m && { ...m, boardOptions: boardsData.boards ?? [] });
        }
      } catch { /* dropdown just won't show — non-fatal */ }
    } catch {
      toast.error("Failed to load placement info");
    }
  }

  // Admin board-picker — re-fetches placement info scoped to the chosen
  // board and replaces `info`/`selected` with it.
  async function handleBoardPlaceModalBoardChange(boardId: string) {
    if (!boardPlaceModal) return;
    const { userId } = boardPlaceModal;
    setBoardPlaceModal(m => m && { ...m, boardSwitching: true, error: null });
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/distributors/${userId}/board-placement-info?boardId=${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        setBoardPlaceModal(m => m && { ...m, boardSwitching: false, error: d.error || "Failed to load that board" });
        return;
      }
      const info: PlacementInfo = d;
      setBoardPlaceModal(m => m && { ...m, info, selected: defaultSelection(info), boardSwitching: false });
    } catch {
      setBoardPlaceModal(m => m && { ...m, boardSwitching: false, error: "Failed to load that board" });
    }
  }

  async function handleConfirmBoardPlace() {
    if (!boardPlaceModal || boardPlaceModal.submitting || !boardPlaceModal.selected) return;
    const { userId, selected } = boardPlaceModal;
    setBoardPlaceModal(m => m && { ...m, submitting: true, error: null });
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/distributors/${userId}/place-on-board`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: boardPlaceModal.info.boardId, position: selected }),
      });
      const d = await res.json();
      if (!res.ok) {
        setBoardPlaceModal(m => m && { ...m, submitting: false, error: d.error || "Placement failed — please try again" });
        return;
      }
      setData(prev =>
        prev && {
          ...prev,
          distributors: prev.distributors.map(x =>
            x.userId._id === userId
              ? { ...x, boardStatus: "placed", isApproved: true, isOnBoard: true, boardPlacedBoardTrackingNo: d.placement?.boardTrackingNo ?? null }
              : x
          ),
        }
      );
      setApproved(prev => new Set(prev).add(userId));
      toast.success(`Placed on board ${d.placement?.boardTrackingNo ?? ""}`);
      setBoardPlaceModal(null);
    } catch {
      setBoardPlaceModal(m => m && { ...m, submitting: false, error: "Network error — please try again" });
    }
  }

  async function handleDeleteDistributor() {
    if (!deleteConfirm || deleting) return;
    const { userId } = deleteConfirm;
    setDeleting(userId);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
      const res = await fetch(`${API}/bat246/distributors/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to delete distributor");
        return;
      }
      setData(prev =>
        prev && {
          ...prev,
          distributors: prev.distributors.filter(x => x.userId._id !== userId),
          total: Math.max(0, prev.total - 1),
        }
      );
      toast.success("Distributor deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete distributor");
    } finally {
      setDeleting(null);
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

  const gridColumnWidths = [
    ...BASE_COLUMN_WIDTHS,
    ...(canApprove ? [APPROVE_COLUMN_WIDTH] : []),
    ...(isAdmin ? [DELETE_COLUMN_WIDTH] : []),
  ];
  const gridTemplateColumns = gridColumnWidths.map(w => `${w}px`).join(" ");
  const gridMinWidth = gridColumnWidths.reduce((sum, w) => sum + w, 0);

  return (
    <div className="min-h-full bg-[#09090f] text-white p-6">
      {/* Wide enough that the 8-column grid (min-width ~1565px, +110px more
          with the Approve column for 1st Base) fits without the horizontal
          scrollbar kicking in on typical desktop widths — was max-w-[1400px],
          which left the Delete column (and Approve, when present) clipped
          off-screen even though the page had unused space on both sides. */}
      <div className="max-w-[1800px] mx-auto">

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
            <h2 className="text-2xl font-bold text-white tracking-tight">Invite and Place</h2>
            <p className="text-sm text-[#9a9a9a] mt-1">
              {total} qualified BAT246 distributor{total !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-semibold hover:bg-amber-500/30 transition-colors"
          >
            + Invite to become BAT 246 Distributor
          </button>
        </div>

        {showInviteModal && <InviteNewDistributorModal onClose={() => setShowInviteModal(false)} />}

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
            placeholder="Search by name, email, phone, or location…"
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
            <div className="overflow-x-auto">
              <div style={{ minWidth: gridMinWidth }}>
                <div className="grid px-5 py-3 border-b border-white/[0.06]" style={{ gridTemplateColumns }}>
                  {[200, 80, 120, 70, 60, 120, 60, 120, ...(canApprove ? [60] : []), ...(isAdmin ? [40] : [])].map((w, i) => (
                    <div key={i} className={`h-2 bg-white/8 rounded animate-pulse ${i > 2 ? "mx-auto" : ""}`} style={{ maxWidth: w }} />
                  ))}
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid px-5 py-4 items-center border-b border-white/[0.05] last:border-b-0" style={{ gridTemplateColumns }}>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-white/8 shrink-0 animate-pulse" />
                      <div>
                        <div className="h-3 w-32 bg-white/10 rounded animate-pulse mb-1.5" />
                        <div className="h-2.5 w-40 bg-white/5 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="h-2.5 w-24 bg-white/8 rounded animate-pulse" />
                    <div className="h-2.5 w-28 bg-white/8 rounded animate-pulse" />
                    <div className="h-2.5 w-20 bg-white/8 rounded animate-pulse" />
                    <div className="h-6 w-14 mx-auto bg-white/8 rounded animate-pulse" />
                    <div className="h-5 w-24 bg-white/8 rounded animate-pulse" />
                    <div className="h-6 w-14 mx-auto bg-white/8 rounded animate-pulse" />
                    <div className="h-5 w-24 bg-white/8 rounded animate-pulse" />
                    {canApprove && <div className="h-6 w-14 mx-auto bg-white/8 rounded animate-pulse" />}
                    {isAdmin && <div className="h-6 w-6 mx-auto bg-white/8 rounded animate-pulse" />}
                  </div>
                ))}
              </div>
            </div>
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
            {/* Horizontal scroll wrapper — this grid has 8+ fixed-width
                columns that don't reliably fit max-w-[1400px], so it scrolls
                sideways instead of squeezing any column down to unreadable
                (this is what was making the Distributor name disappear). */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: gridMinWidth }}>

              {/* Header row */}
              <div className="grid px-5 py-3.5 text-[11px] font-semibold text-[#8a8a8a] uppercase tracking-[0.1em] border-b border-white/[0.06] items-center" style={{ gridTemplateColumns }}>
                <span>Distributor</span>
                <span>Phone</span>
                <span>Location</span>
                <span>Qualified</span>
                <span>Invite To POD</span>
                <span>POD Invite Status</span>
                <span>Invite To Board</span>
                <span>Board Invite Status</span>
                {canApprove && <span>Action</span>}
                {isAdmin && <span className="text-center">Delete</span>}
              </div>

              {/* Rows */}
              <div>
                {paginated.map((d, i) => {
                  const u       = d.userId;
                  const initial = (u.name || u.email).charAt(0).toUpperCase();
                  const loc     = [u.city, u.state, u.country].filter(Boolean).join(", ");

                  return (
                    <div
                      key={d._id}
                      style={{ animationDelay: `${i * 20}ms`, gridTemplateColumns }}
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

                    {/* Invite To POD */}
                    <div className="flex flex-col items-center">
                      {d.podStatus === "not_invited" ? (
                        <button
                          onClick={() => handlePodInvite(u._id)}
                          disabled={podSending === u._id || !canAccessPod}
                          title={!canAccessPod ? "You must be part of an active board to send POD invites" : undefined}
                          className="px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[12px] font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-500/20"
                        >
                          {podSending === u._id ? "…" : "Invite"}
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white/40 text-[12px] font-semibold">
                          Invited
                        </span>
                      )}
                      {d.podStatus !== "not_invited" && d.podInvitedByName && (
                        <p className="text-[11px] text-white/40 truncate mt-0.5">by {d.podInvitedByName}</p>
                      )}
                    </div>

                    {/* POD Invite Status */}
                    <div className="min-w-0">
                      {d.podStatus === "placed" ? (
                        <span
                          className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-[12.5px] font-semibold text-blue-400 leading-tight"
                          title={d.podPlacedBoardTrackingNo ? `Placed on board ${d.podPlacedBoardTrackingNo}` : undefined}
                        >
                          Placed{d.podPlacedBoardTrackingNo ? ` — ${d.podPlacedBoardTrackingNo}` : ""}
                        </span>
                      ) : d.podStatus === "purchased" ? (
                        <button
                          onClick={() => handleOpenPodPlaceModal(u._id)}
                          disabled={!canAccessPod}
                          title={!canAccessPod ? "You must be part of an active board to place someone on a board" : undefined}
                          className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/25 text-[12.5px] font-semibold text-green-400 leading-tight hover:bg-green-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-500/10"
                        >
                          Ready to be placed in pod
                        </button>
                      ) : d.podStatus === "invited" ? (
                        <button
                          onClick={() => handlePodInvite(u._id)}
                          disabled={podSending === u._id || !canAccessPod}
                          title={!canAccessPod ? "You must be part of an active board to send POD invites" : d.podInvitedByName ? `Invited by ${d.podInvitedByName} — click to remind again` : "Click to remind again"}
                          className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[12.5px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-500/10"
                        >
                          {podSending === u._id ? "…" : "Remind"}
                        </button>
                      ) : (
                        <span className="text-[13px] text-[#a8a8a8]">Yet to invite</span>
                      )}
                    </div>

                    {/* Invite To Board ($650 Board Entry) — "Invited" covers both an
                        actual invite sent through this button (boardInviteSentAt)
                        AND already qualified/placed without one (approved the old
                        way, or purchased organically): either way they don't need
                        (another) invite, so this column should never sit blank for
                        them. The "by <name>" line falls back through whichever
                        referral name is actually available. */}
                    {(() => {
                      const boardAlreadyInvited = !!d.boardInviteSentAt || d.boardStatus === "qualified" || d.boardStatus === "placed";
                      const boardByName = d.boardInvitedByName || d.podInvitedByName || d.referredByName;
                      return (
                        <div className="flex flex-col items-center">
                          {boardAlreadyInvited ? (
                            <span className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white/40 text-[12px] font-semibold">
                              Invited
                            </span>
                          ) : (
                            <button
                              onClick={() => handleBoardInvite(u._id)}
                              disabled={boardSending === u._id || !canAccessPod}
                              title={!canAccessPod ? "You must be part of an active board to send Board Entry invites" : undefined}
                              className="px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[12px] font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-500/20"
                            >
                              {boardSending === u._id ? "…" : "Invite"}
                            </button>
                          )}
                          {boardAlreadyInvited && boardByName && (
                            <p className="text-[11px] text-white/40 truncate mt-0.5">by {boardByName}</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Board Invite Status */}
                    <div className="min-w-0">
                      {d.boardStatus === "placed" ? (
                        <span
                          className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-[12.5px] font-semibold text-blue-400 leading-tight"
                          title={d.boardPlacedBoardTrackingNo ? `Placed on board ${d.boardPlacedBoardTrackingNo}` : undefined}
                        >
                          Placed{d.boardPlacedBoardTrackingNo ? ` — ${d.boardPlacedBoardTrackingNo}` : ""}
                        </span>
                      ) : d.boardStatus === "qualified" ? (
                        <button
                          onClick={() => handleOpenBoardPlaceModal(u._id)}
                          disabled={!canAccessPod}
                          title={!canAccessPod ? "You must be part of an active board to place someone on a board" : undefined}
                          className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/25 text-[12.5px] font-semibold text-green-400 leading-tight hover:bg-green-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-500/10"
                        >
                          Ready to be placed on board
                        </button>
                      ) : d.boardStatus === "invited" ? (
                        <button
                          onClick={() => handleBoardInvite(u._id)}
                          disabled={boardSending === u._id || !canAccessPod}
                          title={!canAccessPod ? "You must be part of an active board to send Board Entry invites" : d.boardInvitedByName ? `Invited by ${d.boardInvitedByName} — click to remind again` : "Click to remind again"}
                          className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[12.5px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-500/10"
                        >
                          {boardSending === u._id ? "…" : "Remind"}
                        </button>
                      ) : (
                        <span className="text-[13px] text-[#a8a8a8]">Yet to invite</span>
                      )}
                    </div>

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

                    {/* Delete (admin only) */}
                    {isAdmin && (
                      <div className="flex justify-center">
                        <button
                          onClick={() => setDeleteConfirm({ userId: u._id, label: u.name || u.email })}
                          className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete this distributor permanently"
                        >
                          <Trash2 style={{ width: 15, height: 15 }} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
              </div>
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

      {/* POD placement modal */}
      {podPlaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#0e0e14] border border-white/10 rounded-xl w-full max-w-md p-5">
            <h3 className="text-sm font-bold text-white mb-1">Place in POD</h3>
            <p className="text-[11px] text-[#7a7a7a] mb-4">
              Choose one of your active boards with an open POD seat (4 per board).
            </p>

            {podPlaceModal.loading ? (
              <p className="mb-4 text-[12px] text-[#7a7a7a]">Loading your boards…</p>
            ) : podPlaceModal.boards.length > 0 ? (
              <div className="mb-4">
                <label className="block text-[11px] text-[#7a7a7a] mb-1.5">Board</label>
                <select
                  value={podPlaceModal.selectedBoardId}
                  onChange={e => setPodPlaceModal(m => m && { ...m, selectedBoardId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-amber-500/30"
                >
                  {podPlaceModal.boards.map(b => (
                    <option key={b._id} value={b._id}>
                      Board {b.trackingNumber} — {b.podBlankCount} of 4 POD seats open
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mb-4 text-[12px] text-amber-400">
                You&apos;re not part of any active board with an open POD seat.
              </p>
            )}

            {podPlaceModal.error && (
              <p className="mb-3 text-[12px] text-red-400">{podPlaceModal.error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPodPlaceModal(null)}
                disabled={podPlaceModal.submitting}
                className="px-3 py-1.5 rounded-md bg-white/[0.06] border border-white/10 text-white text-[12px] font-medium hover:bg-white/[0.1] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPodPlace}
                disabled={podPlaceModal.submitting || podPlaceModal.loading || !podPlaceModal.selectedBoardId}
                className="px-3 py-1.5 rounded-md bg-green-500/20 border border-green-500/40 text-green-300 text-[12px] font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {podPlaceModal.submitting ? "…" : "Place"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board placement modal — "Ready to be placed on board" (open to any
          active-board member, separate from the admin/1st-Base Approve flow
          above, but same underlying position-choice UI). */}
      {boardPlaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#0e0e14] border border-white/10 rounded-xl w-full max-w-md p-5">
            <h3 className="text-sm font-bold text-white mb-1">Place on Board</h3>

            {boardPlaceModal.boardOptions && boardPlaceModal.boardOptions.length > 1 ? (
              <div className="mb-4">
                <label className="block text-[11px] text-[#7a7a7a] mb-1.5">Board</label>
                <select
                  value={boardPlaceModal.info.boardId}
                  onChange={e => handleBoardPlaceModalBoardChange(e.target.value)}
                  disabled={boardPlaceModal.boardSwitching || boardPlaceModal.submitting}
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-amber-500/30 disabled:opacity-50"
                >
                  {boardPlaceModal.boardOptions.map(b => (
                    <option key={b.boardId} value={b.boardId}>#{b.boardTrackingNo || b.boardNumber}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-[11px] text-[#7a7a7a] mb-4">
                Board #{boardPlaceModal.info.boardTrackingNo || "—"}
              </p>
            )}

            {boardPlaceModal.info.reservedPosition && (
              <div className="mb-3 text-[12px] text-[#c8c8c8]">
                Reserved position: <span className="font-semibold text-white">{positionLabel(boardPlaceModal.info.reservedPosition)}</span>{" "}
                {boardPlaceModal.info.reservedPositionStale ? (
                  <span className="text-amber-400">(on a closed board — no longer applicable)</span>
                ) : boardPlaceModal.info.reservedPositionStatus === "filled" ? (
                  <span className="text-red-400">(now filled — choose another)</span>
                ) : (
                  <span className="text-green-400">(open)</span>
                )}
              </div>
            )}
            {!boardPlaceModal.info.reservedPosition && (
              <p className="mb-3 text-[12px] text-[#7a7a7a]">No reservation on file — choose a position below.</p>
            )}

            {boardPlaceModal.info.availablePositions.length > 0 ? (
              <div className="mb-4">
                <label className="block text-[11px] text-[#7a7a7a] mb-1.5">Place at</label>
                <select
                  value={boardPlaceModal.selected}
                  onChange={e => setBoardPlaceModal(m => m && { ...m, selected: e.target.value })}
                  disabled={boardPlaceModal.boardSwitching}
                  className="w-full h-10 px-3 rounded-lg bg-[#1a1a22] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-amber-500/30 disabled:opacity-50"
                >
                  {boardPlaceModal.info.availablePositions.map(key => (
                    <option key={key} value={key}>{positionLabel(key)}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mb-4 text-[12px] text-amber-400">
                No position available on this board.
              </p>
            )}

            {boardPlaceModal.error && (
              <p className="mb-3 text-[12px] text-red-400">{boardPlaceModal.error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBoardPlaceModal(null)}
                disabled={boardPlaceModal.submitting}
                className="px-3 py-1.5 rounded-md bg-white/[0.06] border border-white/10 text-white text-[12px] font-medium hover:bg-white/[0.1] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBoardPlace}
                disabled={boardPlaceModal.submitting || boardPlaceModal.boardSwitching || !boardPlaceModal.selected}
                className="px-3 py-1.5 rounded-md bg-green-500/20 border border-green-500/40 text-green-300 text-[12px] font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {boardPlaceModal.submitting ? "…" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — admin only, irreversible */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#0e0e14] border border-white/10 rounded-xl w-full max-w-md p-5">
            <h3 className="text-sm font-bold text-white mb-1">Delete Distributor</h3>
            <p className="text-[12px] text-[#c8c8c8] mb-4">
              Permanently delete <span className="font-semibold text-white">{deleteConfirm.label}</span>&apos;s distributor record?
              This removes their qualification/invite tracking and cannot be undone. Their Garage account, any board placement
              already made, and their game history are not affected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting === deleteConfirm.userId}
                className="px-3 py-1.5 rounded-md bg-white/[0.06] border border-white/10 text-white text-[12px] font-medium hover:bg-white/[0.1] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDistributor}
                disabled={deleting === deleteConfirm.userId}
                className="px-3 py-1.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 text-[12px] font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting === deleteConfirm.userId ? "…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
