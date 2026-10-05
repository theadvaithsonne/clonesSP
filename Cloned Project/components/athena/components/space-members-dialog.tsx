"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
    Shield, Trash2, Loader2, Users, Check,
    ChevronDown, MoreHorizontal, UserPlus, PlusCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
    MembersTable,
    MemberTableRow,
    MemberNameCell,
    MemberEmailCell,
    MemberRoleCell,
    MemberActionsCell,
    MemberSelectCell,
    MemberTableSkeletonRows,
    MemberActionTrigger,
    MemberQuickAddButton,
} from "./members-table";
import {
    PeopleSubTabs,
} from "./members-view";
import { RemoveMemberConfirmDialog } from "./remove-member-confirm-dialog";

const BASE_URL = (process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/").replace(/\/+$/, "");
const globalInFlightFetches = new Set<string>();

interface SpaceMembersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    space: any;
    workspaceId: string;
    /** Render inline without Dialog wrapper (e.g. inside People dashboard tab) */
    embedded?: boolean;
    canManage?: boolean;
}

function canManageMembers(detail?: { role?: string; isOwner?: boolean } | null) {
    if (!detail) return false;
    const role = (detail.role || "").toLowerCase();
    return role === "admin" || role === "owner" || !!detail.isOwner;
}

const ROLES = [
    { id: "member", name: "Member", desc: "Can access and edit items." },
    { id: "admin", name: "Admin", desc: "Can manage members and settings." },
    { id: "observer", name: "Observer", desc: "Can only view items." },
    { id: "commenter", name: "Commenter", desc: "Can view and comment on items." },
];

type Tab = "space" | "workspace";

const SPACE_PAGE_SIZE = 20;
const WORKSPACE_PAGE_SIZE = 10;

function hasMorePages(
    meta: { totalPages?: number; currentPage?: number; nextPage?: number | null } | null | undefined,
    page: number,
    rowCount: number,
    pageSize: number,
) {
    if (meta) {
        if (meta.nextPage != null) return true;
        if (typeof meta.totalPages === "number" && typeof meta.currentPage === "number") {
            return meta.currentPage < meta.totalPages;
        }
        if (typeof meta.totalPages === "number") return page < meta.totalPages;
    }
    return rowCount >= pageSize;
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ open, onOpenChange, onConfirm, loading, count }: {
    open: boolean; onOpenChange: (v: boolean) => void;
    onConfirm: () => void; loading: boolean; count: number;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-1rem)] sm:max-w-[360px] max-h-[90dvh] overflow-y-auto bg-[#161616] border-0 text-white rounded-2xl p-6 sm:p-8 shadow-2xl">
                <div className="flex flex-col gap-5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-[15px] font-semibold text-white">Add all workspace members?</p>
                        <p className="text-[13px] text-white/40 mt-1 leading-relaxed">
                            All unjoined member{count !== 1 ? "s" : ""} will be added as <span className="text-white/70">Member</span>.
                        </p>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="ghost"
                            className="flex-1 h-9 text-[13px] text-white/40 hover:text-white/70 hover:bg-white/5"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 h-9 text-[13px] bg-brand text-brand-foreground font-semibold hover:bg-brand"
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                            Confirm
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function SpaceMembersDialog({ open, onOpenChange, space, workspaceId, embedded = false, canManage: canManageProp }: SpaceMembersDialogProps) {
    const [tab, setTab] = useState<Tab>("space");
    const [spaceMembers, setSpaceMembers] = useState<any[]>([]);
    const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
    const [loadingSpace, setLoadingSpace] = useState(false);
    const [loadingWorkspace, setLoadingWorkspace] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [addAllLoading, setAddAllLoading] = useState(false);
    const [addRole, setAddRole] = useState(ROLES[0]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ id: string; name?: string } | null>(null);

    const [spacePage, setSpacePage] = useState(1);
    const [spaceMore, setSpaceMore] = useState(false);
    const [moreSpace, setMoreSpace] = useState(false);

    const [workspacePage, setWorkspacePage] = useState(1);
    const [workspaceMore, setWorkspaceMore] = useState(false);
    const [moreWorkspace, setMoreWorkspace] = useState(false);

    const spaceSentinel = useRef<HTMLDivElement>(null);
    const workspaceSentinel = useRef<HTMLDivElement>(null);
    const spaceScrollRef = useRef<HTMLDivElement>(null);
    const workspaceScrollRef = useRef<HTMLDivElement>(null);
    const tabRef = useRef<Tab>("space");
    const pendingFetchesRef = useRef<Set<string>>(new Set());
    const isActiveRef = useRef(false);

    tabRef.current = tab;

    const getToken = () => localStorage.getItem("garage_tok");
    const canManage = canManageProp ?? canManageMembers(
        space?.MemberDetail ?? (space?.role || space?.isOwner ? space : null)
    );

    useEffect(() => {
        if (!canManage && tab === "workspace") {
            tabRef.current = "space";
            setTab("space");
        }
    }, [canManage, tab]);

    const runFetch = useCallback(async (
        kind: "space" | "workspace",
        page = 1,
        append = false,
        q = "",
    ) => {
        if (!space?._id) return;
        if (kind === "workspace" && !workspaceId) return;

        const fetchKey = `${kind}:${space._id}:${workspaceId}:${page}:${q}`;
        if (!append && (globalInFlightFetches.has(fetchKey) || pendingFetchesRef.current.has(fetchKey))) return;
        globalInFlightFetches.add(fetchKey);
        pendingFetchesRef.current.add(fetchKey);

        if (kind === "space") {
            append ? setMoreSpace(true) : setLoadingSpace(true);
        } else {
            append ? setMoreWorkspace(true) : setLoadingWorkspace(true);
        }

        try {
            if (kind === "space") {
                const r = await axios.get(`${BASE_URL}/space/members`, {
                    params: {
                        spaceId: space._id,
                        page,
                        size: SPACE_PAGE_SIZE,
                        ...(q ? { search: q } : {}),
                    },
                    headers: { Authorization: `Bearer ${getToken()}` },
                });
                const rows: any[] = r.data?.data?.data || [];
                const normalized = rows.map((row: any) => ({
                    ...row,
                    userData: {
                        ...row.userData,
                        avatar: row.userData?.avatar || row.userData?.image || row.image || row.avatar || undefined,
                    },
                }));
                setSpaceMembers(p => append ? [...p, ...normalized.filter(x => !p.some(y => y._id === x._id))] : normalized);
                const meta = r.data?.metadata;
                setSpaceMore(hasMorePages(meta, page, normalized.length, SPACE_PAGE_SIZE));
            } else {
                const r = await axios.get(`${BASE_URL}/space/members/unadded`, {
                    params: { spaceId: space._id, workspaceId, page, size: WORKSPACE_PAGE_SIZE, ...(q ? { search: q } : {}) },
                    headers: { Authorization: `Bearer ${getToken()}` },
                });
                const rows: any[] = r.data?.data || [];
                const normalized = rows.map((row: any) => ({
                    ...row,
                    userData: {
                        _id: row._id,
                        name: row.name,
                        email: row.email,
                        avatar: row.userData?.avatar || row.userData?.image || row.image || row.avatar || undefined,
                    }
                }));
                setWorkspaceMembers(p => append ? [...p, ...normalized.filter(x => !p.some(y => y._id === x._id))] : normalized);
                const meta = r.data?.metadata;
                setWorkspaceMore(hasMorePages(meta, page, normalized.length, WORKSPACE_PAGE_SIZE));
            }
        } catch {
            if (!append) {
                if (kind === "space") setSpaceMembers([]);
                else setWorkspaceMembers([]);
            }
        } finally {
            globalInFlightFetches.delete(fetchKey);
            pendingFetchesRef.current.delete(fetchKey);
            if (kind === "space") append ? setMoreSpace(false) : setLoadingSpace(false);
            else append ? setMoreWorkspace(false) : setLoadingWorkspace(false);
        }
    }, [space?._id, workspaceId]);

    const fetchSpace = useCallback((page = 1, append = false, q = "") => runFetch("space", page, append, q), [runFetch]);
    const fetchWorkspace = useCallback((page = 1, append = false, q = "") => runFetch("workspace", page, append, q), [runFetch]);
    const runFetchRef = useRef(runFetch);
    runFetchRef.current = runFetch;

    // ── Init ──────────────────────────────────────────────────────────────────
    const isActive = open || embedded;
    isActiveRef.current = isActive;
    const contextKey = space?._id && workspaceId ? `${space._id}:${workspaceId}` : null;

    useEffect(() => {
        if (!isActive || !contextKey) return;
        tabRef.current = "space";
        setTab("space");
        setSelected(new Set());
        setSpacePage(1);
        setWorkspacePage(1);
        setSpaceMembers([]);
        setWorkspaceMembers([]);
        void runFetchRef.current("space", 1, false, "");
        void runFetchRef.current("workspace", 1, false, "");
    }, [isActive, contextKey]);

    const handleTabChange = (t: Tab) => {
        tabRef.current = t;
        setTab(t);
        setSelected(new Set());
        if (t === "space") {
            setSpacePage(1);
            setSpaceMembers([]);
            fetchSpace(1);
        } else {
            setWorkspacePage(1);
            setWorkspaceMembers([]);
            fetchWorkspace(1);
        }
    };

    // ── Infinite scroll ───────────────────────────────────────────────────────
    useEffect(() => {
        const el = spaceSentinel.current; if (!el) return;
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && spaceMore && !moreSpace) {
                const next = spacePage + 1; setSpacePage(next); fetchSpace(next, true);
            }
        }, { threshold: 0.1 });
        obs.observe(el); return () => obs.disconnect();
    }, [spaceMore, moreSpace, spacePage, fetchSpace]);

    useEffect(() => {
        const el = workspaceSentinel.current; if (!el) return;
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && workspaceMore && !moreWorkspace) {
                const next = workspacePage + 1; setWorkspacePage(next); fetchWorkspace(next, true);
            }
        }, { threshold: 0.1 });
        obs.observe(el); return () => obs.disconnect();
    }, [workspaceMore, moreWorkspace, workspacePage, fetchWorkspace]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const refresh = () => {
        setSpacePage(1); setWorkspacePage(1);
        setSpaceMembers([]);
        fetchSpace(1);
        setWorkspaceMembers([]);
        fetchWorkspace(1);
    };

    const bulkAdd = async (ids?: Set<string>) => {
        const targets = ids ?? selected;
        if (!targets.size) return;
        setActionLoading(true);
        try {
            await axios.post(`${BASE_URL}/space/members/bulk`, {
                spaceId: space._id, workspaceId,
                membersList: Array.from(targets).map(id => ({ userId: id, role: addRole.id })),
            }, { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success(`${targets.size} member${targets.size > 1 ? "s" : ""} added`);
            setSelected(new Set()); refresh();
        } catch (e: any) { toast.error(e.response?.data?.message || "Failed to add"); }
        finally { setActionLoading(false); }
    };

    const addAll = async () => {
        setAddAllLoading(true);
        try {
            await axios.post(`${BASE_URL}/space/members/unadded`, {
                spaceId: space._id, workspaceId, defaultRole: "member",
            }, { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success("All members added");
            setConfirmOpen(false); setSelected(new Set()); refresh();
        } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
        finally { setAddAllLoading(false); }
    };

    const updateRole = async (memberId: string, role: string) => {
        setActionLoading(true);
        try {
            await axios.put(`${BASE_URL}/space/members/${memberId}`, { role },
                { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success("Role updated"); fetchSpace(1);
        } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
        finally { setActionLoading(false); }
    };

    const requestRemoveMember = (memberId: string) => {
        const member = spaceMembers.find((m) => m._id === memberId);
        setRemoveTarget({ id: memberId, name: member?.userData?.name });
    };

    const confirmRemoveMember = async () => {
        if (!removeTarget) return;
        setActionLoading(true);
        try {
            await axios.delete(`${BASE_URL}/space/members/${removeTarget.id}`,
                { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success("Member removed");
            setRemoveTarget(null);
            refresh();
        } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
        finally { setActionLoading(false); }
    };

    const toggleOne = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const allSelected = workspaceMembers.length > 0 && selected.size === workspaceMembers.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(workspaceMembers.map(m => m.userData?._id || m._id)));

    const roleBadgeClass = (role: string) =>
        role === "admin" ? "text-violet-400" : role === "observer" ? "text-amber-400" : role === "commenter" ? "text-cyan-400" : "text-blue-400";

    const panelContent = (
        <div className={cn(
            "flex flex-col overflow-hidden text-white",
            embedded ? "h-full min-h-0" : "h-full min-h-0 bg-[#161616] rounded-2xl shadow-2xl"
        )}>
            {/* Header */}
            <div className={cn("pb-0 shrink-0", embedded ? "px-1 pt-0" : "px-7 pt-5 sm:pt-6")}>
                {!embedded && (
                    <p className="text-[11px] text-white font-semibold tracking-[0.12em] uppercase mb-1">
                        {space?.name}
                    </p>
                )}

                <div className="flex items-center justify-between gap-4 mb-3">
                    <PeopleSubTabs
                        tabs={[
                            { id: "space", label: "Existing Members" },
                            ...(canManage ? [{ id: "workspace", label: "Available Members" }] : []),
                        ]}
                        activeId={tab}
                        onChange={(id) => handleTabChange(id as Tab)}
                    />

                    {canManage && tab === "workspace" && (
                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors">
                                        <Shield className="w-3 h-3 text-white/30" />
                                        {addRole.name}
                                        <ChevronDown className="w-3 h-3 opacity-50" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[220px] bg-[#161616] border-white/[0.06] text-white p-1.5 rounded-xl shadow-2xl">
                                    {ROLES.map(role => (
                                        <DropdownMenuItem
                                            key={role.id}
                                            onClick={() => setAddRole(role)}
                                            className="flex items-start justify-between gap-2 p-2.5 cursor-pointer focus:bg-white/5 rounded-lg"
                                        >
                                            <div>
                                                <p className="text-[13px] font-semibold">{role.name}</p>
                                                <p className="text-[11px] text-white/35 mt-0.5">
                                                    {role.desc ? role.desc.charAt(0).toUpperCase() + role.desc.slice(1) : ''}
                                                </p>
                                            </div>
                                            {addRole.id === role.id && <Check className="w-3.5 h-3.5 text-white/60 mt-0.5 shrink-0" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <span className="text-white/10">·</span>

                            {selected.size > 0 ? (
                                <button
                                    onClick={() => bulkAdd()}
                                    disabled={actionLoading}
                                    className="flex items-center cursor-pointer gap-1.5 text-[12px] font-semibold text-brand hover:text-brand transition-colors disabled:opacity-50"
                                >
                                    {actionLoading
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <UserPlus className="w-3 h-3" />}
                                    Add {selected.size} selected
                                </button>
                            ) : (
                                <button
                                    onClick={() => setConfirmOpen(true)}
                                    disabled={workspaceMembers.length === 0}
                                    className="flex items-center gap-1.5 text-[12px] text-white/35 hover:text-white/60 transition-colors disabled:opacity-30"
                                >
                                    <PlusCircle className="w-3 h-3" />
                                    Add all
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className={cn("flex-1 min-h-0 flex flex-col pb-5 mt-2", embedded ? "px-1" : "px-7")}>
                {tab === "space" ? (
                    loadingSpace ? (
                        <MembersTable columns={canManage ? ["name", "email", "role", "actions"] : ["name", "email", "role"]}>
                            <MemberTableSkeletonRows cols={canManage ? 4 : 3} />
                        </MembersTable>
                    ) : spaceMembers.length === 0 ? (
                        <Empty text="No members yet." />
                    ) : (
                        <MembersTable columns={canManage ? ["name", "email", "role", "actions"] : ["name", "email", "role"]} scrollRef={spaceScrollRef}>
                            {spaceMembers.map((m) => (
                                <SpaceRow
                                    key={m._id}
                                    member={m}
                                    roles={ROLES}
                                    roleBadgeClass={roleBadgeClass}
                                    onUpdateRole={updateRole}
                                    onRemove={requestRemoveMember}
                                    canManage={canManage}
                                />
                            ))}
                            <tr><td colSpan={canManage ? 4 : 3}><div ref={spaceSentinel} className="h-1" /></td></tr>
                            {moreSpace && (
                                <tr>
                                    <td colSpan={canManage ? 4 : 3} className="py-3 text-center">
                                        <Loader2 className="w-4 h-4 animate-spin text-white/20 inline-block" />
                                    </td>
                                </tr>
                            )}
                        </MembersTable>
                    )
                ) : canManage ? (
                    loadingWorkspace ? (
                        <MembersTable columns={["select", "name", "email", "actions"]}>
                            <MemberTableSkeletonRows cols={4} />
                        </MembersTable>
                    ) : workspaceMembers.length === 0 ? (
                        <Empty text="All workspace members are already in this space." />
                    ) : (
                        <MembersTable columns={["select", "name", "email", "actions"]} scrollRef={workspaceScrollRef}>
                            {workspaceMembers.map((m) => {
                                const uid = m.userData?._id || m._id;
                                const isSelected = selected.has(uid);
                                return (
                                    <WorkspaceRow
                                        key={m._id}
                                        member={m}
                                        isSelected={isSelected}
                                        onToggle={() => toggleOne(uid)}
                                        onQuickAdd={() => { const s = new Set([uid]); bulkAdd(s); }}
                                        actionLoading={actionLoading}
                                    />
                                );
                            })}
                            <tr><td colSpan={4}><div ref={workspaceSentinel} className="h-1" /></td></tr>
                            {moreWorkspace && (
                                <tr>
                                    <td colSpan={4} className="py-3 text-center">
                                        <Loader2 className="w-4 h-4 animate-spin text-white/20 inline-block" />
                                    </td>
                                </tr>
                            )}
                        </MembersTable>
                    )
                ) : null}
            </div>

            {/* Footer */}
            <div className={cn(
                "py-5 mt-2 border-t border-white/[0.05] flex items-center justify-between shrink-0 gap-4",
                embedded ? "px-2" : "px-7"
            )}>
                <span className="text-[12px] text-white/35">
                    {tab === "space" ? `${spaceMembers.length} member${spaceMembers.length !== 1 ? "s" : ""}` : selected.size > 0 ? `${selected.size} selected` : `${workspaceMembers.length} available`}
                </span>
                {!embedded && (
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="h-8 px-4 text-[13px] font-medium text-brand-foreground bg-brand hover:text-white rounded-lg"
                    >
                        Close
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <>
            {embedded ? (
                panelContent
            ) : (
                <Dialog open={open} onOpenChange={onOpenChange}>
                    <DialogContent
                        showCloseButton={false}
                        className="p-0 bg-[#161616] border-0 text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                        style={{ width: "80vw", maxWidth: "80vw", height: "80dvh", maxHeight: "80dvh" }}
                    >
                        {panelContent}
                    </DialogContent>
                </Dialog>
            )}

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={addAll}
                loading={addAllLoading}
                count={workspaceMembers.length}
            />

            <RemoveMemberConfirmDialog
                open={!!removeTarget}
                onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
                onConfirm={confirmRemoveMember}
                loading={actionLoading}
                memberName={removeTarget?.name}
                scope="space"
            />
        </>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Checkbox({ checked }: { checked: boolean }) {
    return (
        <div className={cn(
            "w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all",
            checked ? "bg-white" : "border border-white/20"
        )}>
            {checked && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
        </div>
    );
}

function SpaceMemberActions({ member, roles, onUpdateRole, onRemove }: {
    member: any; roles: typeof ROLES;
    onUpdateRole: (id: string, role: string) => void;
    onRemove: (id: string) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <MemberActionTrigger>
                    <MoreHorizontal className="w-4 h-4" />
                </MemberActionTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                sideOffset={4}
                style={{ zIndex: 9999 }}
                align="end"
                className="w-[220px] bg-[#161616] border-white/[0.06] text-white p-1.5 rounded-xl shadow-2xl"
            >
                {roles.map((r) => (
                    <DropdownMenuItem
                        key={r.id}
                        onClick={() => onUpdateRole(member._id, r.id)}
                        className="flex items-start justify-between gap-2 p-2.5 cursor-pointer focus:bg-white/5 rounded-lg"
                    >
                        <div>
                            <p className="text-[13px] font-semibold">{r.name}</p>
                            <p className="text-[11px] text-white/35 mt-0.5">{r.desc}</p>
                        </div>
                        {member.role === r.id && <Check className="w-3.5 h-3.5 text-white/60 mt-0.5 shrink-0" />}
                    </DropdownMenuItem>
                ))}
                <div className="h-px bg-white/[0.05] my-1" />
                <DropdownMenuItem
                    onClick={() => onRemove(member._id)}
                    className="text-[13px] text-rose-400 focus:text-rose-300 focus:bg-rose-500/10 cursor-pointer rounded-lg px-2 py-2"
                >
                    <Trash2 className="w-3.5 h-3.5 mr-2 inline focus:text-rose-300" />
                    Remove
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function SpaceRow({ member, roles, roleBadgeClass, onUpdateRole, onRemove, canManage }: {
    member: any; roles: typeof ROLES;
    roleBadgeClass: (r: string) => string;
    onUpdateRole: (id: string, role: string) => void;
    onRemove: (id: string) => void;
    canManage: boolean;
}) {
    return (
        <MemberTableRow>
            <MemberNameCell userData={member.userData} />
            <MemberEmailCell email={member.userData?.email} />
            <MemberRoleCell role={member.role} roleClassName={roleBadgeClass(member.role)} />
            {canManage && (
                <MemberActionsCell>
                    <SpaceMemberActions member={member} roles={roles} onUpdateRole={onUpdateRole} onRemove={onRemove} />
                </MemberActionsCell>
            )}
        </MemberTableRow>
    );
}

function WorkspaceRow({ member, isSelected, onToggle, onQuickAdd, actionLoading }: {
    member: any; isSelected: boolean;
    onToggle: () => void; onQuickAdd: () => void; actionLoading: boolean;
}) {
    return (
        <MemberTableRow onClick={onToggle} className={isSelected ? "bg-white/[0.04]" : undefined}>
            <MemberSelectCell>
                <Checkbox checked={isSelected} />
            </MemberSelectCell>
            <MemberNameCell userData={member.userData} />
            <MemberEmailCell email={member.userData?.email} />
            <MemberActionsCell>
                <MemberQuickAddButton
                    onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
                    disabled={actionLoading}
                />
            </MemberActionsCell>
        </MemberTableRow>
    );
}

function Empty({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Users className="w-8 h-8 text-white/10" />
            <p className="text-[13px] text-white/25">{text}</p>
        </div>
    );
}
