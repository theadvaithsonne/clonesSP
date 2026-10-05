"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import {
    Users,
    Plus,
    Search,
    Trash2,
    X,
    Loader2,
    Building2,
    FolderKanban,
    DoorOpen,
    UserPlus,
    MoreHorizontal,
    Check,
    ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaceMemberStore } from "@/store/taskroom/workspaceMemberStore";
import { SpaceMembersDialog } from "./space-members-dialog";
import { RoomMembersDialog } from "./room-members-dialog";
import { RemoveMemberConfirmDialog } from "./remove-member-confirm-dialog";
import {
    MembersTable,
    MemberTableRow,
    MemberNameCell,
    MemberEmailCell,
    MemberRoleCell,
    MemberStatusCell,
    MemberActionsCell,
    MemberTableSkeletonRows,
    MemberActionTrigger,
    OwnerBadge,
    getInitials,
} from "./members-table";
import {
    PeopleScopeTabs,
} from "./members-view";

const MEMBERS_API_BASE = (process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/").replace(/\/+$/, "");

// ─── Constants ───────────────────────────────────────────────────────────────

type MemberTab = "workspace" | "space" | "room";

const WORKSPACE_ROLES = [
    { id: "member", name: "Member", desc: "Can access all public items in your Workspace." },
    { id: "observer", name: "Observer", desc: "Can't use all features or be added to Spaces." },
    { id: "admin", name: "Admin", desc: "Can manage Spaces, People, Billing and other Workspace settings." },
];

const roles = WORKSPACE_ROLES.map((r) => ({ name: r.name, description: r.desc }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(value?: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function getAuthHeaders() {
    return { Authorization: `Bearer ${localStorage.getItem("garage_tok") || ""}` };
}

function getWorkspaceDisplayName(ws: { name?: string; workspacename?: string } | null) {
    if (!ws) return "Untitled";
    return ws.name || ws.workspacename || "Untitled";
}

function roleBadgeClass(role: string) {
    const r = role?.toLowerCase();
    if (r === "admin") return "text-violet-400";
    if (r === "observer") return "text-amber-400";
    if (r === "owner") return "text-brand";
    return "text-blue-400";
}

function canManageMembers(detail?: { role?: string; isOwner?: boolean } | null) {
    if (!detail) return false;
    const role = (detail.role || "").toLowerCase();
    return role === "admin" || role === "owner" || !!detail.isOwner;
}

function memberDetailFrom(entity: any) {
    if (!entity) return null;
    if (entity.MemberDetail) return entity.MemberDetail;
    if (entity.role || entity.isOwner) return entity;
    return null;
}

function EmptyMembers({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Users className="w-8 h-8 text-white/10" />
            <p className="text-[13px] text-white/25">{text}</p>
        </div>
    );
}

function EmptyContext({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center flex-1 py-20 gap-3">
            <Icon className="h-10 w-10 text-white/15" />
            <p className="text-[13px] text-white/35 text-center max-w-xs">{message}</p>
        </div>
    );
}

// ─── Invite workspace dialog ───────────────────────────────────────────────────

function InviteWorkspaceDialog({
    open,
    onOpenChange,
    onInviteSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInviteSuccess?: () => void;
}) {
    const [email, setEmail] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [existingMemberEmails, setExistingMemberEmails] = useState<Set<string>>(new Set());
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { currentWorkspace } = useTaskroomWorkspacetore();
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id;
    const { addMemberToState } = useWorkspaceMemberStore();

    useEffect(() => {
        if (!open) {
            setEmail("");
            setSelectedUsers([]);
            setSearchResults([]);
            setShowResults(false);
            setExistingMemberEmails(new Set());
            return;
        }
        if (!workspaceId) return;
        axios
            .get(`${MEMBERS_API_BASE}/workspace/members/all?workspaceId=${workspaceId}`, { headers: getAuthHeaders() })
            .then((res) => {
                const data = res?.data?.data;
                const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.members) ? data.members : [];
                setExistingMemberEmails(new Set(list.map((m) => (m?.userData?.email || m?.email || "").toLowerCase()).filter(Boolean)));
            })
            .catch(() => {});
    }, [open, workspaceId]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const fetchUsers = useCallback(async (query: string) => {
        if (!query) { setSearchResults([]); setShowResults(false); return; }
        setIsSearching(true);
        try {
            const garage_org_id = localStorage.getItem("garage_org_id");
            const response = await axios.get(
                `https://test.garage.app/public/organizations/${garage_org_id}/users?search=${query}`,
                { headers: getAuthHeaders() }
            );
            const users = response?.data?.data;
            if (Array.isArray(users?.users)) {
                const filtered = users.users.filter((u: any) => {
                    const userEmail = (u?.email || "").toLowerCase();
                    if (selectedUsers.some((s) => s.id === u._id)) return false;
                    if (existingMemberEmails.has(userEmail)) return false;
                    return true;
                });
                setSearchResults(filtered.map((u: any) => ({
                    name: u?.name, email: u?.email, id: u?._id,
                    profilePicture: u?.profilePicture || u?.image || u?.avatar,
                })));
                setShowResults(filtered.length > 0);
            }
        } catch { /* ignore */ }
        finally { setIsSearching(false); }
    }, [selectedUsers, existingMemberEmails]);

    useEffect(() => {
        const timer = setTimeout(() => { if (email) fetchUsers(email); }, 300);
        return () => clearTimeout(timer);
    }, [email, fetchUsers]);

    const handleInvite = async () => {
        if (selectedUsers.length === 0) { toast.error("Select at least one person"); return; }
        setIsInviting(true);
        try {
            const orgId = localStorage.getItem("garage_org_id");
            const membersList = selectedUsers.map((user) => ({
                memberUserId: user.id,
                email: user.email,
                name: user.name,
                image: user.profilePicture || "",
                role: user.role.name.toLowerCase(),
            }));
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members/bulk`,
                { membersList, workspaceId, orgId },
                { headers: getAuthHeaders() }
            );
            if (res.data?.status || res.data?.success) {
                (res.data?.data || []).forEach((item: any, index: number) => {
                    const user = selectedUsers[index];
                    if (item && user) {
                        addMemberToState({
                            _id: item._id,
                            userData: { _id: user.id, name: user.name, email: user.email, profilePicture: user.profilePicture },
                            role: user.role.name.toLowerCase(),
                            status: item?.status,
                            invitedOn: item.createdAt,
                        });
                    }
                });
                toast.success("Invitation(s) sent");
                onOpenChange(false);
                onInviteSuccess?.();
            } else {
                toast.error(res?.data?.message);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to send invitations");
        } finally {
            setIsInviting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[80vw] h-[80vh] max-w-[80vw] max-h-[80vh] sm:max-w-[80vw] p-0 bg-[#161616] border-0 text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 pb-4 shrink-0">
                    <h2 className="text-[16px] font-semibold text-white mb-1">Invite to workspace</h2>
                    <p className="text-[12px] text-white/35 mb-4">Search and add people from your organization.</p>
                    <div className="relative" ref={searchRef}>
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                        <input
                            ref={inputRef}
                            placeholder="Search by name or email…"
                            className="w-full h-9 pl-9 pr-9 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); if (!e.target.value) setShowResults(false); }}
                            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                        />
                        {isSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 animate-spin" />}
                        {showResults && searchResults.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-[#161616] border border-white/[0.06] rounded-xl shadow-2xl max-h-[220px] overflow-y-auto">
                                {searchResults.map((user, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#2a2a32] text-left border-b border-[#e5e7eb12] last:border-0"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            if (!user.id || selectedUsers.some((u) => u.id === user.id)) return;
                                            setSelectedUsers((prev) => [...prev, { ...user, role: roles[0] }]);
                                            setEmail("");
                                            setShowResults(false);
                                            setTimeout(() => inputRef.current?.focus(), 50);
                                        }}
                                    >
                                        <Avatar className="h-7 w-7">
                                            {user.profilePicture && <AvatarImage src={user.profilePicture} />}
                                            <AvatarFallback className="bg-[#2a2a32] text-white/50 text-xs">{getInitials(user.name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[13px] text-white/70 truncate block">{user.name}</span>
                                            <span className="text-[11px] text-white/40 truncate block">{user.email}</span>
                                        </div>
                                        <Plus className="h-3.5 w-3.5 text-white/40" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
                    {selectedUsers.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold">
                                {selectedUsers.length} {selectedUsers.length === 1 ? "person" : "people"} to invite
                            </p>
                            {selectedUsers.map((user) => (
                                <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#1a1a1f] border border-white/[0.06] group">
                                    <Avatar className="h-8 w-8 shrink-0">
                                        {user.profilePicture && <AvatarImage src={user.profilePicture} />}
                                        <AvatarFallback className="bg-[#2a2a32] text-white/50 text-xs">{getInitials(user.name)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[13px] text-white/75 truncate block">{user.name}</span>
                                        <span className="text-[11px] text-white/35 truncate block">{user.email}</span>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#2a2a32] border border-white/[0.08] text-[12px] text-white/65 hover:text-white/85 hover:bg-[#323238] transition-colors shrink-0"
                                            >
                                                {user.role.name}
                                                <ChevronDown className="w-3 h-3 opacity-50" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="end"
                                            sideOffset={4}
                                            style={{ zIndex: 9999 }}
                                            className="w-[220px] bg-[#161616] border-white/[0.06] text-white p-1.5 rounded-xl shadow-2xl"
                                        >
                                            {WORKSPACE_ROLES.map((r) => (
                                                <DropdownMenuItem
                                                    key={r.id}
                                                    onClick={() => {
                                                        setSelectedUsers((prev) =>
                                                            prev.map((u) =>
                                                                u.id === user.id
                                                                    ? { ...u, role: { name: r.name, description: r.desc } }
                                                                    : u
                                                            )
                                                        );
                                                    }}
                                                    className="flex items-start justify-between gap-2 p-2.5 cursor-pointer focus:bg-white/5 rounded-lg"
                                                >
                                                    <div>
                                                        <p className="text-[13px] font-semibold">{r.name}</p>
                                                        <p className="text-[11px] text-white/35 mt-0.5">{r.desc}</p>
                                                    </div>
                                                    {user.role.name === r.name && (
                                                        <Check className="w-3.5 h-3.5 text-white/60 mt-0.5 shrink-0" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id))}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-auto flex items-center justify-end gap-2 p-6 border-t border-white/[0.05] shrink-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="h-9 px-4 text-[13px] text-white/40 hover:text-white/70 hover:bg-white/5"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleInvite}
                        disabled={isInviting || selectedUsers.length === 0}
                        className="h-9 px-5 text-[13px] bg-brand text-brand-foreground font-semibold hover:bg-brand rounded-lg disabled:opacity-40"
                    >
                        {isInviting ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Sending...</>
                        ) : selectedUsers.length > 1 ? (
                            `Send ${selectedUsers.length} invites`
                        ) : (
                            "Send invite"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Workspace members tab ───────────────────────────────────────────────────

function WorkspaceMemberActions({
    member,
    onUpdateRole,
    onRemove,
    actionLoading,
    triggerClassName,
}: {
    member: any;
    onUpdateRole: (memberId: string, role: string) => void;
    onRemove: (memberId: string) => void;
    actionLoading: boolean;
    triggerClassName?: string;
}) {
    const isOwner = member.role === "owner" || member?.isOwner;
    if (isOwner) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <MemberActionTrigger
                    disabled={actionLoading}
                    className={triggerClassName}
                >
                    <MoreHorizontal className="w-4 h-4" />
                </MemberActionTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                sideOffset={4}
                style={{ zIndex: 9999 }}
                align="end"
                className="w-[220px] bg-[#161616] border-white/[0.06] text-white p-1.5 rounded-xl shadow-2xl"
            >
                {/* <p className="px-2 py-1 text-[13px] text-white/70  tracking-widest font-semibold">Change Role</p> */}
                {WORKSPACE_ROLES.map((r) => (
                    <DropdownMenuItem
                        key={r.id}
                        onClick={() => onUpdateRole(member._id, r.id)}
                        className="flex items-start justify-between gap-2 p-2.5 cursor-pointer focus:bg-white/5 rounded-lg"
                    >
                        <div>
                            <p className="text-[13px] font-semibold">{r.name}</p>
                            <p className="text-[11px] text-white/35 mt-0.5">{r.desc}</p>
                        </div>
                        {member.role?.toLowerCase() === r.id && (
                            <Check className="w-3.5 h-3.5 text-white/60 mt-0.5 shrink-0" />
                        )}
                    </DropdownMenuItem>
                ))}
                <div className="h-px bg-white/[0.05] my-1" />
                <DropdownMenuItem
                    onClick={() => onRemove(member._id)}
                    className="text-[13px] text-rose-400 cursor-pointer focus:text-rose-300 focus:bg-rose-500/10 cursor-pointer rounded-lg px-2 py-2"
                >
                    <Trash2 className="w-3.5 h-3.5 mr-2 inline focus:text-rose-300" />
                    Remove
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function WorkspaceMemberRow({
    member,
    onUpdateRole,
    onRemove,
    actionLoading,
    canManage,
}: {
    member: any;
    onUpdateRole: (memberId: string, role: string) => void;
    onRemove: (memberId: string) => void;
    actionLoading: boolean;
    canManage: boolean;
}) {
    const isOwner = member.role === "owner" || member?.isOwner;

    return (
        <MemberTableRow>
            <MemberNameCell
                userData={member.userData}
                badge={isOwner ? <OwnerBadge /> : undefined}
            />
            <MemberEmailCell email={member.userData?.email} />
            <MemberRoleCell role={member.role} roleClassName={roleBadgeClass(member.role)} />
            <MemberStatusCell status={member.status} />
            {canManage && (
                <MemberActionsCell>
                    <WorkspaceMemberActions
                        member={member}
                        onUpdateRole={onUpdateRole}
                        onRemove={onRemove}
                        actionLoading={actionLoading}
                    />
                </MemberActionsCell>
            )}
        </MemberTableRow>
    );
}

function hasMorePages(metadata: { totalPages?: number; currentPage?: number; nextPage?: number | null } | null | undefined, page: number, rowCount: number, pageSize: number) {
    if (metadata) {
        if (metadata.nextPage != null) return true;
        if (typeof metadata.totalPages === "number" && typeof metadata.currentPage === "number") {
            return metadata.currentPage < metadata.totalPages;
        }
        if (typeof metadata.totalPages === "number") return page < metadata.totalPages;
    }
    return rowCount >= pageSize;
}

function WorkspaceMembersTab({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
    const [actionLoading, setActionLoading] = useState(false);
    const workspaceColumns = canManage
        ? (["name", "email", "role", "status", "actions"] as const)
        : (["name", "email", "role", "status"] as const);
    const colSpan = workspaceColumns.length;
    const [removeTarget, setRemoveTarget] = useState<{ id: string; name?: string } | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const PAGE_SIZE = 50;

    const { members, metadata, isLoading, isLoadingMore, fetchMembers, updateMemberRole, removeMember } = useWorkspaceMemberStore();

    const loadMembers = useCallback((nextPage: number, append = false) => {
        fetchMembers(workspaceId, nextPage, "", false, append);
    }, [workspaceId, fetchMembers]);

    useEffect(() => {
        setPage(1);
        setHasMore(false);
    }, [workspaceId]);

    useEffect(() => {
        if (metadata) {
            setHasMore(hasMorePages(metadata, page, PAGE_SIZE, PAGE_SIZE));
            return;
        }
        // Fallback when API omits metadata: only continue if every loaded page looks full.
        setHasMore(members.length > 0 && members.length >= page * PAGE_SIZE);
    }, [metadata, page, members.length]);

    useEffect(() => {
        const el = sentinelRef.current;
        const root = scrollRef.current;
        if (!el || !root || isLoading || members.length === 0) return;
        if (!hasMore || isLoadingMore) return;

        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
                const next = page + 1;
                setPage(next);
                loadMembers(next, true);
            }
        }, { root, rootMargin: "0px 0px 120px 0px", threshold: 0 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [hasMore, isLoadingMore, isLoading, page, loadMembers, members.length]);

    const handleUpdateRole = async (memberId: string, role: string) => {
        setActionLoading(true);
        try {
            const res = await axios.put(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members/${memberId}`,
                { role },
                { headers: getAuthHeaders() }
            );
            if (res.data?.status || res.data?.success) {
                updateMemberRole(memberId, role);
                toast.success("Role updated");
            } else {
                toast.error(res?.data?.message || "Failed to update");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to update");
        } finally {
            setActionLoading(false);
        }
    };

    const requestRemove = (memberId: string) => {
        const member = members.find((m) => m._id === memberId);
        if (!member) return;
        setRemoveTarget({ id: memberId, name: member.userData?.name });
    };

    const confirmRemove = async () => {
        if (!removeTarget) return;
        const member = members.find((m) => m._id === removeTarget.id);
        setActionLoading(true);
        try {
            const success = await removeMember(removeTarget.id);
            if (success) {
                toast.success(`${member?.userData?.name || "Member"} removed`);
                setRemoveTarget(null);
            }
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="flex flex-col overflow-hidden text-white h-full min-h-0">
            <RemoveMemberConfirmDialog
                open={!!removeTarget}
                onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
                onConfirm={confirmRemove}
                loading={actionLoading}
                memberName={removeTarget?.name}
                scope="workspace"
            />

            <div className="flex-1 min-h-0 flex flex-col pb-5 px-1 mt-2">
                {isLoading ? (
                    <MembersTable columns={[...workspaceColumns]}>
                        <MemberTableSkeletonRows cols={colSpan} />
                    </MembersTable>
                ) : members.length === 0 ? (
                    <EmptyMembers text="No members yet." />
                ) : (
                    <MembersTable columns={[...workspaceColumns]} scrollRef={scrollRef}>
                        {members.map((member) => (
                            <WorkspaceMemberRow
                                key={member._id}
                                member={member}
                                onUpdateRole={handleUpdateRole}
                                onRemove={requestRemove}
                                actionLoading={actionLoading}
                                canManage={canManage}
                            />
                        ))}
                        <tr><td colSpan={colSpan}><div ref={sentinelRef} className="h-1" /></td></tr>
                        {isLoadingMore && (
                            <tr>
                                <td colSpan={colSpan} className="py-3 text-center">
                                    <Loader2 className="w-4 h-4 animate-spin text-white/20 inline-block" />
                                </td>
                            </tr>
                        )}
                    </MembersTable>
                )}
            </div>

            <div className="py-5 mt-2 border-t border-white/[0.05] flex items-center justify-between shrink-0 px-2 gap-4">
                <span className="text-[12px] text-white/35">
                    {metadata?.count ?? members.length} member{(metadata?.count ?? members.length) !== 1 ? "s" : ""}
                </span>
            </div>
        </div>
    );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function WorkspacePeopleDashboard() {
    const [activeTab, setActiveTab] = useState<MemberTab>("workspace");
    const [showInvite, setShowInvite] = useState(false);
    const [spaceMemberCount, setSpaceMemberCount] = useState(0);
    const [roomMemberCount, setRoomMemberCount] = useState(0);
    const searchParams = useSearchParams();
    const fetchMembers = useWorkspaceMemberStore((s) => s.fetchMembers);
    const workspaceMemberCount = useWorkspaceMemberStore((s) => s.metadata?.count ?? 0);
    const {
        currentWorkspace,
        currentRoomDetail,
        spaceData: allSpaceData,
        activeSpaceId: storeActiveSpaceId,
    } = useTaskroomWorkspacetore();

    const workspaceId = searchParams.get("shareTask")
        ? searchParams.get("workspaceId")
        : currentWorkspace?._id;

    const currentSpaceId = searchParams.get("shareTask")
        ? searchParams.get("spaceId")
        : storeActiveSpaceId || currentRoomDetail?.spaceId || undefined;

    const spaceData = workspaceId ? allSpaceData[workspaceId as string] || [] : [];
    const currentSpace = currentSpaceId
        ? spaceData.find((s) => s._id === currentSpaceId)
        : undefined;

    const canManageWorkspace = canManageMembers(memberDetailFrom(currentWorkspace));
    const canManageSpace = canManageMembers(memberDetailFrom(currentSpace));
    const canManageRoom = canManageMembers(memberDetailFrom(currentRoomDetail));

    const tabs: { id: MemberTab; label: string; name: string; count: number; disabled?: boolean }[] = [
        {
            id: "workspace",
            label: "Workspace",
            name: capitalize(getWorkspaceDisplayName(currentWorkspace)),
            count: workspaceMemberCount,
            disabled: !workspaceId,
        },
        {
            id: "space",
            label: "Space",
            name: currentSpace?.name
                ? capitalize(currentSpace.name)
                : currentSpace
                    ? "Untitled Space"
                    : "No space selected",
            count: spaceMemberCount,
            disabled: !currentSpace,
        },
        {
            id: "room",
            label: "Room",
            name: currentRoomDetail?.name ? capitalize(currentRoomDetail.name) : "No room selected",
            count: roomMemberCount,
            disabled: !currentRoomDetail,
        },
    ];

    useEffect(() => {
        if (!workspaceId) return;
        fetchMembers(workspaceId as string, 1, "", true, false);
        setActiveTab("workspace");
    }, [workspaceId, fetchMembers]);

    useEffect(() => {
        if (!currentSpace?._id) {
            setSpaceMemberCount(0);
            return;
        }
        axios
            .get(`${MEMBERS_API_BASE}/space/members`, {
                params: { spaceId: currentSpace._id, page: 1, size: 1 },
                headers: getAuthHeaders(),
            })
            .then((res) => {
                const count = res.data?.metadata?.count;
                setSpaceMemberCount(
                    typeof count === "number" ? count : (res.data?.data?.data?.length ?? 0)
                );
            })
            .catch(() => setSpaceMemberCount(0));
    }, [currentSpace?._id]);

    useEffect(() => {
        if (!currentRoomDetail?._id) {
            setRoomMemberCount(0);
            return;
        }
        axios
            .get(`${MEMBERS_API_BASE}/room/members`, {
                params: { roomId: currentRoomDetail._id, page: 1, size: 1 },
                headers: getAuthHeaders(),
            })
            .then((res) => {
                const count = res.data?.metadata?.count;
                setRoomMemberCount(
                    typeof count === "number" ? count : (res.data?.data?.data?.length ?? 0)
                );
            })
            .catch(() => setRoomMemberCount(0));
    }, [currentRoomDetail?._id]);

    useEffect(() => {
        const openInvite = () => {
            if (!canManageWorkspace) return;
            setShowInvite(true);
        };
        window.addEventListener("taskroom:open-invite-people", openInvite);
        return () => window.removeEventListener("taskroom:open-invite-people", openInvite);
    }, [canManageWorkspace]);

    return (
        <div className="flex h-full min-h-0 rounded-tr-lg rounded-br-lg py-3 pt-0 px-6">
            <InviteWorkspaceDialog
                open={showInvite}
                onOpenChange={setShowInvite}
                onInviteSuccess={() => {
                    setActiveTab("workspace");
                    if (workspaceId) {
                        fetchMembers(workspaceId as string, 1, "", true, false);
                    }
                }}
            />
            <div className="flex-1 min-h-0 overflow-hidden w-full flex flex-col">
                {/* Header */}
                {/* <div className="flex items-center gap-2 mb-4 shrink-0">
                    <Users className="h-4 w-4 text-white/40" />
                    <h1 className="text-[15px] font-semibold text-white/75">People</h1>
                    <span className="text-[12px] text-white/30">— manage members for your current selection</span>
                </div> */}

                {/* Scope tabs */}
                <PeopleScopeTabs
                    tabs={tabs}
                    activeId={activeTab}
                    onChange={(id) => setActiveTab(id as MemberTab)}
                />

                {/* Tab content */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {activeTab === "workspace" && workspaceId && (
                        <WorkspaceMembersTab workspaceId={workspaceId as string} canManage={canManageWorkspace} />
                    )}
                    {activeTab === "workspace" && !workspaceId && (
                        <EmptyContext icon={Building2} message="Select a workspace from the sidebar to manage members." />
                    )}

                    {activeTab === "space" && (
                        currentSpace && workspaceId ? (
                            <SpaceMembersDialog
                                key={`${workspaceId}-${currentSpace._id}`}
                                embedded
                                open
                                onOpenChange={() => {}}
                                space={currentSpace}
                                workspaceId={workspaceId as string}
                                canManage={canManageSpace}
                            />
                        ) : (
                            <EmptyContext icon={FolderKanban} message="Select a space from the sidebar to add or manage space members." />
                        )
                    )}

                    {activeTab === "room" && (
                        currentRoomDetail && currentSpaceId ? (
                            <RoomMembersDialog
                                embedded
                                open
                                onOpenChange={() => {}}
                                room={currentRoomDetail}
                                spaceId={currentSpaceId as string}
                                canManage={canManageRoom}
                            />
                        ) : (
                            <EmptyContext icon={DoorOpen} message="Select a room from the sidebar to add or manage room members." />
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
