"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrgId, getUserDataFromToken } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import { SimplePagination, paginationRangeLabel } from "@/components/dashboard/docusign/shared/SimplePagination";
import { ROW_NAME, ROW_SECONDARY } from "@/components/dashboard/docusign/shared/editorTokens";
import { RoleSelect } from "@/components/dashboard/docusign/shared/admin/RoleSelect";
import { ROLE_LABELS } from "@/lib/docusign/access";
import type { DsAdminMember, DsAdminOverlay, DsAssignableRole, DsPagination, DsRole } from "@/lib/docusign/types";
import { listDocusignRoleHolders, listDocusignAdminOverlay, setDocusignMemberRole } from "@/lib/docusign/shared-api";

const PAGE_SIZE = 20;
const EMPTY_PAGINATION: DsPagination = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };
// How long typing has to pause before the search is applied (one request per pause, not per keystroke).
const SEARCH_DEBOUNCE_MS = 300;

type Scope = "roles" | "all";
const SCOPE_LABELS: Record<Scope, string> = { roles: "Admins & senders", all: "All members" };

// Member | Role | Documents sent — shared by the header and every row so the columns line up.
const GRID = "grid grid-cols-[minmax(0,1fr)_150px_110px] items-center gap-4 px-5";

const initialsOf = (m: DsAdminMember) => {
  const words = (m.name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || m.email || "?").slice(0, 1).toUpperCase();
};

const roleChangedMessage = (name: string, role: DsAssignableRole) =>
  role === "none" ? `${name} no longer has a role` : `${name} is now ${role === "admin" ? "an Admin" : "a Sender"}`;

export function MembersTab() {
  const orgId = getOrgId() || getUserDataFromToken().orgId;
  // Nobody changes their own role (the backend refuses it too) — their row shows a static chip.
  const myUserId = useDocusignStore((s) => s.me?.userId);
  // Defaults to the short list of people holding a role — day to day this screen is "who can
  // send / manage Docusign," not a full org directory. "All members" is one click away for
  // giving someone new a role.
  const [scope, setScope] = useState<Scope>("roles");
  // `search` is what's in the box; `appliedSearch` is what the list is filtered by — it catches up
  // SEARCH_DEBOUNCE_MS after typing stops, together with the reset to page 1.
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // scope="roles": real server-side pagination, queried directly against ds_user in the
  // docusign backend — no garage platform call at all (see admin.controller.js). This is
  // what actually keeps the default view fast regardless of how large the org is.
  const [rolesData, setRolesData] = useState<DsAdminMember[]>([]);
  const [rolesPagination, setRolesPagination] = useState<DsPagination>(EMPTY_PAGINATION);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  // Latest loadRoles call. Paging/searching quickly overlaps requests and responses don't arrive in
  // order — only the newest one may update the list (same guard as the store's list fetches).
  const rolesRequestRef = useRef(0);

  const loadRoles = async (p: number, q: string, silent = false) => {
    if (!orgId) return;
    const requestId = ++rolesRequestRef.current;
    if (!silent) setIsLoadingRoles(true);
    try {
      const res = await listDocusignRoleHolders(orgId, p, PAGE_SIZE, q || undefined);
      if (requestId !== rolesRequestRef.current) return;
      setRolesData(res.data);
      setRolesPagination(res.pagination);
    } catch (err: any) {
      if (requestId !== rolesRequestRef.current) return;
      toast.error(err.message || "Failed to load members");
    } finally {
      // Whichever call is newest ends the loading state — even a silent one that superseded a visible one.
      if (requestId === rolesRequestRef.current) setIsLoadingRoles(false);
    }
  };

  // scope="all": the only path that pays the cost of the org's full, unbounded member
  // list — fetched lazily, only once this scope is actually opened, not on mount.
  const { orgMembers, isLoadingOrgMembers, fetchOrgMembers } = useDocusignStore();
  const [overlay, setOverlay] = useState<DsAdminOverlay[]>([]);
  const [isLoadingOverlay, setIsLoadingOverlay] = useState(false);
  const hasLoadedAllRef = useRef(false);

  const loadOverlay = async (silent = false) => {
    if (!orgId) return;
    if (!silent) setIsLoadingOverlay(true);
    try {
      const res = await listDocusignAdminOverlay(orgId);
      setOverlay(res.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load member roles");
    } finally {
      if (!silent) setIsLoadingOverlay(false);
    }
  };

  // Fetch the full org list + overlay only the first time "All members" is actually
  // opened — switching back and forth after that reuses what's already loaded.
  useEffect(() => {
    if (scope !== "all" || hasLoadedAllRef.current) return;
    hasLoadedAllRef.current = true;
    fetchOrgMembers();
    loadOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // Applies the search once typing pauses. A new search can shrink the result set below the
  // current page number, so it lands back on page 1 — set in the same update as the search, so
  // the fetch below runs once, for page 1, rather than first for the old page.
  useEffect(() => {
    const next = search.trim();
    if (next === appliedSearch) return;
    const timer = setTimeout(() => {
      setAppliedSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, appliedSearch]);

  // scope="roles" pagination/search is server-driven — refetch on change instead of
  // slicing locally, since the backend already only ever hands us one page. This is the
  // only place the list loads (mount included). The key check skips the repeat run React's
  // strict mode makes on mount in dev; it is cleared when leaving the scope so coming back
  // to "Admins & senders" always refetches.
  const lastRolesQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (scope !== "roles") {
      lastRolesQueryRef.current = null;
      return;
    }
    const key = `${page}|${appliedSearch}`;
    if (lastRolesQueryRef.current === key) return;
    lastRolesQueryRef.current = key;
    loadRoles(page, appliedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedSearch, scope]);

  const handleScopeChange = (next: Scope) => {
    if (next === scope) return;
    // Same reason as the search: page 3 of one list means nothing in the other.
    setScope(next);
    setPage(1);
  };

  // Assembled client-side, not on the backend — orgMembers is the org's real roster
  // (name/email/avatar/role, straight from the garage platform); overlay only adds
  // what's docusign-specific. Someone in overlay with no matching orgMembers row (e.g.
  // they left the org since their last document) is simply not shown — the org's own
  // member list is the source of truth for who's a "member" here.
  const allMembers = useMemo<DsAdminMember[]>(() => {
    const overlayByUserId = new Map(overlay.map((o) => [o.userId, o]));
    return orgMembers.map((m) => {
      const ov = overlayByUserId.get(m._id);
      const isFounder = m.role === "founder" || ov?.role === "founder";
      return {
        userId: m._id,
        name: m.name,
        email: m.email,
        profilePicture: m.profilePicture,
        role: isFounder ? "founder" : "stakeholder",
        docusignRole: isFounder ? "founder" : (ov?.docusignRole ?? null),
        isDocusignAdmin: isFounder || !!ov?.isDocusignAdmin,
        isDocusignSender: !!ov?.isDocusignSender,
        synced: !!ov?.synced,
        documentsSent: ov?.documentsSent || 0,
        pendingSignatures: ov?.pendingSignatures || 0,
      };
    });
  }, [orgMembers, overlay]);

  const visibleAllMembers = useMemo(() => {
    const q = appliedSearch.toLowerCase();
    if (!q) return allMembers;
    // Both fields are guarded: the org list genuinely contains members with no email and
    // no name (see RecipientPicker's filterMembers), and an unguarded `m.email` here used
    // to throw mid-render on the first keystroke — which DocusignErrorBoundary turned into
    // "Something went wrong" across the whole Docusign tab. The store normalises these too;
    // this stays because DsAdminMember arrives by a different path (listDocusignRoleHolders).
    return allMembers.filter(
      (m) => (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)
    );
  }, [allMembers, appliedSearch]);

  const allTotalPages = Math.max(1, Math.ceil(visibleAllMembers.length / PAGE_SIZE));
  const pagedAllMembers = useMemo(
    () => visibleAllMembers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [visibleAllMembers, page]
  );
  const allPagination: DsPagination = { page, limit: PAGE_SIZE, total: visibleAllMembers.length, totalPages: allTotalPages };

  const isRoles = scope === "roles";
  const members = isRoles ? rolesData : pagedAllMembers;
  const pagination = isRoles ? rolesPagination : allPagination;
  const isLoading = isRoles ? isLoadingRoles : isLoadingOrgMembers || isLoadingOverlay;

  const changeRole = async (member: DsAdminMember, role: DsAssignableRole) => {
    setPendingUserId(member.userId);
    try {
      // Name/email/picture go along so a member who has never opened Docusign gets a profile
      // with their photo, instead of initials, until their own first sync.
      await setDocusignMemberRole(member.userId, role, {
        email: member.email,
        name: member.name,
        profilePicture: member.profilePicture,
      });
      await Promise.all([loadRoles(page, appliedSearch, true), hasLoadedAllRef.current ? loadOverlay(true) : Promise.resolve()]);
      toast.success(roleChangedMessage(member.name || member.email || "Member", role));
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setPendingUserId(null);
    }
  };

  const renderRole = (m: DsAdminMember) => {
    const role: DsRole = m.docusignRole;
    // Founders always have full access and can't be changed; nor can your own role.
    if (role === "founder" || m.userId === myUserId) {
      return (
        <span className="inline-flex h-7 items-center rounded-md bg-white/[0.06] px-2.5 text-xs text-white/70">
          {role ? ROLE_LABELS[role] : "No role"}
          {m.userId === myUserId && role !== "founder" && <span className="ml-1 text-white/40">(you)</span>}
        </span>
      );
    }
    return (
      <RoleSelect
        value={role}
        isSaving={pendingUserId === m.userId}
        memberLabel={m.name || m.email || m.userId}
        onChange={(next) => changeRole(m, next)}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a7a90]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search members by name or email"
            className="h-10 w-full rounded-lg border border-[#2a2a35] bg-[#0c0c10] pl-9 pr-3 text-[13px] text-white/85 placeholder:text-[#5a5a72] focus:border-[#3b3b4a] focus:outline-none"
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a35] bg-[#0c0c10] p-1">
          {(["roles", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleScopeChange(s)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                scope === s ? "bg-brand text-[#141414]" : "text-[#8a8a9b] hover:text-white/80"
              )}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>
        {!isLoading && (
          <span className="ml-auto text-xs tabular-nums text-[#8a8a9b]">
            {pagination.total} {pagination.total === 1 ? "member" : "members"}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#2a2a35] bg-[#111116]">
        <div className={cn(GRID, "border-b border-[#2a2a35] bg-white/[0.02] py-3 text-[11px] text-[#7a7a90]")}>
          <span>Member</span>
          <span>Role</span>
          <span>Documents sent</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-[#2a2a35]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn(GRID, "py-4")}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/[0.04]" />
                  <div className="h-3 w-40 animate-pulse rounded bg-white/[0.04]" />
                </div>
                <div className="h-7 w-24 animate-pulse rounded-lg bg-white/[0.04]" />
                <div className="h-3 w-6 animate-pulse rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : !members.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#8a8a9b]">
            <Users className="h-8 w-8" />
            <p className="text-xs">
              {appliedSearch
                ? isRoles
                  ? "No admins or senders match your search"
                  : "No members match your search"
                : isRoles
                  ? "No one has a role yet — open All members to add an admin or sender"
                  : "No org members found yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#2a2a35]">
            {members.map((m) => (
              <div key={m.userId} className={cn(GRID, "py-4 transition-colors hover:bg-white/[0.02]")}>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {m.profilePicture ? <AvatarImage src={m.profilePicture} /> : null}
                    <AvatarFallback className="bg-brand text-xs font-semibold text-[#141414]">{initialsOf(m)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className={cn(ROW_NAME, "truncate")}>{m.name || m.email || m.userId}</p>
                    {m.email && <p className={cn(ROW_SECONDARY, "truncate")}>{m.email}</p>}
                  </div>
                </div>
                <div>{renderRole(m)}</div>
                <span className="text-[13px] tabular-nums text-white/80">{m.documentsSent}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isLoading && members.length > 0 && (
        <SimplePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          rangeLabel={paginationRangeLabel(pagination)}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  );
}
