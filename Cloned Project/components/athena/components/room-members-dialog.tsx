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

interface RoomMembersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    room: any;
    spaceId: string;
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
];

type Tab = "room" | "space";

const ROOM_PAGE_SIZE = 20;
const SPACE_PAGE_SIZE = 10;

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
                        <p className="text-[15px] font-semibold text-white">Add all space members?</p>
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

// ── Main ──────────────────────────────────────────────────────────────────────
export function RoomMembersDialog({ open, onOpenChange, room, spaceId, embedded = false, canManage: canManageProp }: RoomMembersDialogProps) {
    const [tab, setTab] = useState<Tab>("room");
    const [roomMembers, setRoomMembers] = useState<any[]>([]);
    const [spaceMembers, setSpaceMembers] = useState<any[]>([]);
    const [loadingRoom, setLoadingRoom] = useState(false);
    const [loadingSpace, setLoadingSpace] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [addAllLoading, setAddAllLoading] = useState(false);
    const [addRole, setAddRole] = useState(ROLES[0]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ id: string; name?: string } | null>(null);

    const [roomPage, setRoomPage] = useState(1);
    const [roomMore, setRoomMore] = useState(false);
    const [spacePage, setSpacePage] = useState(1);
    const [spaceMore, setSpaceMore] = useState(false);
    const [moreRoom, setMoreRoom] = useState(false);
    const [moreSpace, setMoreSpace] = useState(false);

    const roomSentinel = useRef<HTMLDivElement>(null);
    const spaceSentinel = useRef<HTMLDivElement>(null);
    const roomScrollRef = useRef<HTMLDivElement>(null);
    const spaceScrollRef = useRef<HTMLDivElement>(null);
    const tabRef = useRef<Tab>("room");
    const pendingFetchesRef = useRef<Set<string>>(new Set());
    const isActiveRef = useRef(false);

    tabRef.current = tab;

    const getToken = () => localStorage.getItem("garage_tok");
    const canManage = canManageProp ?? canManageMembers(
        room?.MemberDetail ?? (room?.role || room?.isOwner ? room : null)
    );

    useEffect(() => {
        if (!canManage && tab === "space") {
            tabRef.current = "room";
            setTab("room");
        }
    }, [canManage, tab]);

    const runFetch = useCallback(async (
        kind: "room" | "space",
        page = 1,
        append = false,
        q = "",
    ) => {
        if (!room?._id) return;
        if (kind === "space" && !spaceId) return;

        const fetchKey = `${kind}:${room._id}:${spaceId}:${page}:${q}`;
        if (!append && (globalInFlightFetches.has(fetchKey) || pendingFetchesRef.current.has(fetchKey))) return;
        globalInFlightFetches.add(fetchKey);
        pendingFetchesRef.current.add(fetchKey);

        if (kind === "room") {
            append ? setMoreRoom(true) : setLoadingRoom(true);
        } else {
            append ? setMoreSpace(true) : setLoadingSpace(true);
        }

        try {
            if (kind === "room") {
                const r = await axios.get(`${BASE_URL}/room/members`, {
                    params: {
                        roomId: room._id,
                        page,
                        size: ROOM_PAGE_SIZE,
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
                setRoomMembers(p => append ? [...p, ...normalized.filter(x => !p.some(y => y._id === x._id))] : normalized);
                const meta = r.data?.metadata;
                setRoomMore(hasMorePages(meta, page, normalized.length, ROOM_PAGE_SIZE));
            } else {
                const r = await axios.get(`${BASE_URL}/room/members/unadded`, {
                    params: { spaceId, roomId: room._id, page, size: SPACE_PAGE_SIZE, ...(q ? { search: q } : {}) },
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
                setSpaceMembers(p => append ? [...p, ...normalized.filter(x => !p.some(y => y._id === x._id))] : normalized);
                const meta = r.data?.metadata;
                setSpaceMore(hasMorePages(meta, page, normalized.length, SPACE_PAGE_SIZE));
            }
        } catch {
            if (!append) {
                if (kind === "room") setRoomMembers([]);
                else setSpaceMembers([]);
            }
        } finally {
            globalInFlightFetches.delete(fetchKey);
            pendingFetchesRef.current.delete(fetchKey);
            if (kind === "room") append ? setMoreRoom(false) : setLoadingRoom(false);
            else append ? setMoreSpace(false) : setLoadingSpace(false);
        }
    }, [room?._id, spaceId]);

    const fetchRoom = useCallback((page = 1, append = false, q = "") => runFetch("room", page, append, q), [runFetch]);
    const fetchSpace = useCallback((page = 1, append = false, q = "") => runFetch("space", page, append, q), [runFetch]);
    const runFetchRef = useRef(runFetch);
    runFetchRef.current = runFetch;

    // ── Init ──────────────────────────────────────────────────────────────────
    const isActive = open || embedded;
    isActiveRef.current = isActive;
    const contextKey = room?._id && spaceId ? `${room._id}:${spaceId}` : null;

    useEffect(() => {
        if (!isActive || !contextKey) return;
        tabRef.current = "room";
        setTab("room");
        setSelected(new Set());
        setRoomPage(1);
        setSpacePage(1);
        setRoomMembers([]);
        setSpaceMembers([]);
        void runFetchRef.current("room", 1, false, "");
        void runFetchRef.current("space", 1, false, "");
    }, [isActive, contextKey]);

    const handleTabChange = (t: Tab) => {
        tabRef.current = t;
        setTab(t);
        setSelected(new Set());
        if (t === "room") {
            setRoomPage(1);
            setRoomMembers([]);
            fetchRoom(1);
        } else {
            setSpacePage(1);
            setSpaceMembers([]);
            fetchSpace(1);
        }
    };

    // ── Infinite scroll ───────────────────────────────────────────────────────
    useEffect(() => {
        if (tab !== "room") return;
        const el = roomSentinel.current;
        const root = roomScrollRef.current;
        if (!el || !root || !roomMore || moreRoom || loadingRoom) return;
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && roomMore && !moreRoom) {
                const next = roomPage + 1;
                setRoomPage(next);
                fetchRoom(next, true);
            }
        }, { root, rootMargin: "0px 0px 120px 0px", threshold: 0 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [tab, roomMore, moreRoom, roomPage, fetchRoom, loadingRoom, roomMembers.length]);

    useEffect(() => {
        if (tab !== "space") return;
        const el = spaceSentinel.current;
        const root = spaceScrollRef.current;
        if (!el || !root || !spaceMore || moreSpace || loadingSpace) return;
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && spaceMore && !moreSpace) {
                const next = spacePage + 1;
                setSpacePage(next);
                fetchSpace(next, true);
            }
        }, { root, rootMargin: "0px 0px 120px 0px", threshold: 0 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [tab, spaceMore, moreSpace, spacePage, fetchSpace, loadingSpace, spaceMembers.length]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const refresh = () => {
        setRoomPage(1); setSpacePage(1);
        setRoomMembers([]);
        fetchRoom(1);
        setSpaceMembers([]);
        fetchSpace(1);
    };

    const bulkAdd = async (ids?: Set<string>) => {
        const targets = ids ?? selected;
        if (!targets.size) return;
        setActionLoading(true);
        try {
            await axios.post(`${BASE_URL}/room/members/bulk`, {
                spaceId, roomId: room._id,
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
            await axios.post(`${BASE_URL}/room/members/unadded`, {
                spaceId, roomId: room._id, defaultRole: "member",
            }, { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success("All members added");
            setConfirmOpen(false); setSelected(new Set()); refresh();
        } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
        finally { setAddAllLoading(false); }
    };

    const updateRole = async (memberId: string, role: string) => {
        setActionLoading(true);
        try {
            await axios.put(`${BASE_URL}/room/members/${memberId}`, { role },
                { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success("Role updated"); fetchRoom(1);
        } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
        finally { setActionLoading(false); }
    };

    const requestRemoveMember = (memberId: string) => {
        const member = roomMembers.find((m) => m._id === memberId);
        setRemoveTarget({ id: memberId, name: member?.userData?.name });
    };

    const confirmRemoveMember = async () => {
        if (!removeTarget) return;
        setActionLoading(true);
        try {
            await axios.delete(`${BASE_URL}/room/members/${removeTarget.id}`,
                { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success("Member removed");
            setRemoveTarget(null);
            refresh();
        } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
        finally { setActionLoading(false); }
    };

    const toggleOne = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const allSelected = spaceMembers.length > 0 && selected.size === spaceMembers.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(spaceMembers.map(m => m.userData?._id || m._id)));

    const roleBadgeClass = (role: string) =>
        role === "admin" ? "text-violet-400" : role === "observer" ? "text-amber-400" : "text-blue-400";

    const panelContent = (
        <div className={cn(
            "flex flex-col overflow-hidden text-white",
            embedded ? "h-full min-h-0" : "h-full min-h-0 bg-[#161616] rounded-2xl shadow-2xl"
        )}>
            <div className={cn("pb-0 shrink-0", embedded ? "px-1 pt-0" : "px-7 pt-5 sm:pt-6")}>
                {!embedded && (
                    <p className="text-[11px] text-white font-semibold tracking-[0.12em] uppercase mb-1">
                        {room?.name}
                    </p>
                )}

                <div className="flex items-center justify-between gap-4 mb-3">
                    <PeopleSubTabs
                        tabs={[
                            { id: "room", label: "Existing Members" },
                            ...(canManage ? [{ id: "space", label: "Available Members" }] : []),
                        ]}
                        activeId={tab}
                        onChange={(id) => handleTabChange(id as Tab)}
                    />

                    {canManage && tab === "space" && (
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
                                    disabled={spaceMembers.length === 0}
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

            <div className={cn("flex-1 min-h-0 flex flex-col pb-5 mt-2", embedded ? "px-1" : "px-7")}>
                {tab === "room" ? (
                    loadingRoom ? (
                        <MembersTable columns={canManage ? ["name", "email", "role", "actions"] : ["name", "email", "role"]}>
                            <MemberTableSkeletonRows cols={canManage ? 4 : 3} />
                        </MembersTable>
                    ) : roomMembers.length === 0 ? (
                        <Empty text="No members yet." />
                    ) : (
                        <MembersTable columns={canManage ? ["name", "email", "role", "actions"] : ["name", "email", "role"]} scrollRef={roomScrollRef}>
                            {roomMembers.map((m) => (
                                <RoomRow
                                    key={m._id}
                                    member={m}
                                    roles={ROLES}
                                    roleBadgeClass={roleBadgeClass}
                                    onUpdateRole={updateRole}
                                    onRemove={requestRemoveMember}
                                    canManage={canManage}
                                />
                            ))}
                            <tr><td colSpan={canManage ? 4 : 3}><div ref={roomSentinel} className="h-1" /></td></tr>
                            {moreRoom && (
                                <tr>
                                    <td colSpan={canManage ? 4 : 3} className="py-3 text-center">
                                        <Loader2 className="w-4 h-4 animate-spin text-white/20 inline-block" />
                                    </td>
                                </tr>
                            )}
                        </MembersTable>
                    )
                ) : canManage ? (
                    loadingSpace ? (
                        <MembersTable columns={["select", "name", "email", "actions"]}>
                            <MemberTableSkeletonRows cols={4} />
                        </MembersTable>
                    ) : spaceMembers.length === 0 ? (
                        <Empty text="All space members are already in this room." />
                    ) : (
                        <MembersTable columns={["select", "name", "email", "actions"]} scrollRef={spaceScrollRef}>
                            {spaceMembers.map((m) => {
                                const uid = m.userData?._id || m._id;
                                const isSelected = selected.has(uid);
                                return (
                                    <SpaceRow
                                        key={m._id}
                                        member={m}
                                        isSelected={isSelected}
                                        onToggle={() => toggleOne(uid)}
                                        onQuickAdd={() => { const s = new Set([uid]); bulkAdd(s); }}
                                        actionLoading={actionLoading}
                                    />
                                );
                            })}
                            <tr><td colSpan={4}><div ref={spaceSentinel} className="h-1" /></td></tr>
                            {moreSpace && (
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

            <div className={cn(
                "py-5 mt-2 border-t border-white/[0.05] flex items-center justify-between shrink-0 gap-4",
                embedded ? "px-2" : "px-7"
            )}>
                <span className="text-[12px] text-white/35">
                    {tab === "room" ? `${roomMembers.length} member${roomMembers.length !== 1 ? "s" : ""}` : selected.size > 0 ? `${selected.size} selected` : `${spaceMembers.length} available`}
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
                count={spaceMembers.length}
            />

            <RemoveMemberConfirmDialog
                open={!!removeTarget}
                onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
                onConfirm={confirmRemoveMember}
                loading={actionLoading}
                memberName={removeTarget?.name}
                scope="room"
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

function RoomMemberActions({ member, roles, onUpdateRole, onRemove }: {
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

function RoomRow({ member, roles, roleBadgeClass, onUpdateRole, onRemove, canManage }: {
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
                    <RoomMemberActions member={member} roles={roles} onUpdateRole={onUpdateRole} onRemove={onRemove} />
                </MemberActionsCell>
            )}
        </MemberTableRow>
    );
}

function SpaceRow({ member, isSelected, onToggle, onQuickAdd, actionLoading }: {
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