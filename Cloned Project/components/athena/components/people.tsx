"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";

const TASKROOM_API_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
import {
    Users,
    Zap,
    Grid,
    Settings,
    Calendar,
    Layers,
    Shield,
    FileText,
    CheckCircle,
    Download,
    Share2,
    Mail,
    MoreHorizontal,
    Plus,
    Search,
    ChevronDown,
    Trash2,
    ExternalLink,
    ChevronRight,
    ChevronLeft,
    LogOut,
    User,
    LayoutGrid,
    X,
    Check,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { useWorkspaceMemberStore } from "@/store/taskroom/workspaceMemberStore";
import { useSpaceStore } from "@/store/taskroom/spaceStore";

const roles = [
    {
        name: "Member",
        description: "Can access all public items in your Workspace.",
        badge: null
    },
    {
        name: "Observer",
        description: "Can't use all features or be added to Spaces. Can only access items shared with them.",
        badge: null
    },
    {
        name: "Admin",
        description: "Can manage Spaces, People, Billing and other Workspace settings.",
        badge: null
    }
];

/** Returns up to 2 uppercase initials from a name */
function getInitials(name?: string) {
    if (!name) return "??";
    return name.substring(0, 2).toUpperCase();
}

/** Shared Member Avatar — maps image if present, falls back to initials */
function MemberAvatar({ userData, size = "sm" }: { userData: any; size?: "sm" | "md" }) {
    const dim = size === "md" ? "h-9 w-9" : "h-[26px] w-[26px]";
    const textSize = size === "md" ? "text-sm" : "text-xs";
    const avatarUrl = userData?.profilePicture || userData?.image || userData?.avatar;
    return (
        <Avatar className={cn(dim, "ring-1 ring-white/10 transition-all duration-300 group-hover:ring-white/25")}>
            {avatarUrl ? (
                <AvatarImage
                    src={avatarUrl}
                    alt={userData?.name ?? "member"}
                    className="object-cover"
                />
            ) : null}
            <AvatarFallback
                className={cn(
                    "bg-[#1e1e24] border border-[#e5e7eb18] text-white/60 font-semibold",
                    textSize
                )}
            >
                {getInitials(userData?.name)}
            </AvatarFallback>
        </Avatar>
    );
}

function InvitePeopleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const [email, setEmail] = useState("");
    const [searchResults, setSearchResults] = useState<{ name: string; email: string; id?: string; profilePicture?: string; image?: string; avatar?: string }[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<{
        name: string; id: string; email: string;
        profilePicture?: string; image?: string; avatar?: string;
        role: typeof roles[number];
    }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [showResults, setShowResults] = useState(false);
    // Emails of users already in the workspace
    const [existingMemberEmails, setExistingMemberEmails] = useState<Set<string>>(new Set());
    const [isFetchingExisting, setIsFetchingExisting] = useState(false);

    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { currentWorkspace } = useTaskroomWorkspacetore();
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id;
    const { addMemberToState } = useWorkspaceMemberStore();
    // Fetch all existing workspace members when dialog opens
    useEffect(() => {
        if (!open) {
            setEmail("");
            setSelectedUsers([]);
            setSearchResults([]);
            setShowResults(false);
            setExistingMemberEmails(new Set());
            return;
        }

        const fetchExistingMembers = async () => {
            if (!workspaceId) return;
            setIsFetchingExisting(true);
            try {
                const token = localStorage.getItem("garage_tok");
                const res = await axios.get(
                    `${TASKROOM_API_URL}workspace/members/all?workspaceId=${workspaceId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = res?.data?.data;
                const membersList: any[] = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.members)
                        ? data.members
                        : [];

                const emailSet = new Set<string>(
                    membersList
                        .map((m: any) => (m?.userData?.email || m?.email || "").toLowerCase())
                        .filter(Boolean)
                );
                setExistingMemberEmails(emailSet);
            } catch (err) {
                console.error("Failed to fetch existing workspace members:", err);
            } finally {
                setIsFetchingExisting(false);
            }
        };

        fetchExistingMembers();
    }, [open, workspaceId]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchUsers = useCallback(async (query: string) => {
        if (!query) { setSearchResults([]); setShowResults(false); return; }
        setIsSearching(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const garage_org_id = localStorage.getItem("garage_org_id");
            const response = await axios.get(
                `https://test.garage.app/public/organizations/${garage_org_id}/users?search=${query}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const users = response?.data?.data || [];
            if (Array.isArray(users?.users)) {
                const filtered = users.users.filter((u: any) => {
                    const userEmail = (u?.email || "").toLowerCase();
                    // Exclude already selected users
                    if (selectedUsers.some((s) => s.id === u._id)) return false;
                    // Exclude users already in the workspace (by email)
                    if (existingMemberEmails.has(userEmail)) return false;
                    return true;
                });
                setSearchResults(filtered.map((u: any) => ({
                    name: u?.name, email: u?.email, id: u?._id,
                    profilePicture: u?.profilePicture || u?.image || u?.avatar,
                    image: u?.profilePicture || u?.image || u?.avatar,
                    avatar: u?.profilePicture || u?.image || u?.avatar,
                })));
                setShowResults(filtered.length > 0);
            }
        } catch (error) {
            console.error("Failed to search users:", error);
        } finally {
            setIsSearching(false);
        }
    }, [selectedUsers, existingMemberEmails]);

    useEffect(() => {
        const timer = setTimeout(() => { if (email) fetchUsers(email); }, 300);
        return () => clearTimeout(timer);
    }, [email, fetchUsers]);

    const addUser = (user: typeof searchResults[number]) => {
        if (!user.id || selectedUsers.some((u) => u.id === user.id)) return;
        setSelectedUsers((prev) => [...prev, { ...user, id: user.id!, role: roles[0] }]);
        setEmail("");
        setShowResults(false);
        setSearchResults([]);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const removeUser = (id: string) => setSelectedUsers((prev) => prev.filter((u) => u.id !== id));

    const updateUserRole = (id: string, role: typeof roles[number]) => {
        setSelectedUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
    };

    const handleInvite = async () => {
        if (selectedUsers.length === 0) { toast.error("Please select at least one user"); return; }
        setIsInviting(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const orgId = localStorage.getItem("garage_org_id");
            if (orgId) {
                // Updated body structure: membersList instead of members
                const membersList = selectedUsers.map((user) => ({
                    memberUserId: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.profilePicture || user.image || user.avatar || "",
                    role: user.role.name.toLowerCase(),
                }));

                const res = await axios.post(
                    `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members/bulk`,
                    { membersList, workspaceId, orgId },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (res.data?.status || res.data?.success) {
                    const responseData: any[] = res.data?.data || [];
                    responseData.forEach((item: any, index: number) => {
                        const user = selectedUsers[index];
                        if (item && user) {
                            addMemberToState({
                                _id: item._id,
                                userData: {
                                    _id: user.id,
                                    name: user.name,
                                    email: user.email,
                                    profilePicture: user.profilePicture,
                                    image: user.profilePicture || user.image,
                                    avatar: user.profilePicture || user.avatar,
                                },
                                role: user.role.name.toLowerCase(),
                                status: item?.status,
                                invitedOn: item.createdAt,
                            });
                        }
                    });
                    toast.success(selectedUsers.length === 1 ? "Invitation sent successfully" : `${selectedUsers.length} invitations sent successfully`);
                    onOpenChange(false);
                    setEmail("");
                    setSelectedUsers([]);
                } else {
                    toast.error(res?.data?.message);
                }
            }
        } catch (error: any) {
            console.error("Failed to send invite:", error);
            toast.error(error?.response?.data?.message || "Failed to send invitations");
        } finally {
            setIsInviting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 shadow-2xl rounded-2xl overflow-hidden border border-[#e5e7eb20] bg-[#0a0a0d]">
                <div className="p-5 pb-0">
                    <h2 className="text-[18px] font-semibold text-white/70 mb-4">Invite People</h2>

                    {/* Search input */}
                    <div className="space-y-1.5 relative" ref={searchRef}>
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider ">Search people</label>
                        <div className="relative mt-2">
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                <Search className="h-3 w text-white/30 mt-0.5 mr-1 " />
                            </div>
                            <input
                                ref={inputRef}
                                placeholder="Search by name or email..."
                                className="h-[38px] w-full rounded-lg border border-[#e5e7eb20] bg-[#1a1a20] pl-8 pr-8 placeholder:text-xs text-xs text-white/70 placeholder:text-white/30 focus:outline-none focus:border-[#e5e7eb40] transition-colors duration-200"
                                value={email}
                                autoComplete="off"
                                onChange={(e) => { setEmail(e.target.value); if (!e.target.value) setShowResults(false); }}
                                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                                disabled={isFetchingExisting}
                            />
                            {(isSearching || isFetchingExisting) && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-3.5 w-3.5 text-white/30 animate-spin" />
                                </div>
                            )}
                        </div>

                        {/* Dropdown */}
                        {showResults && searchResults.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#16161c] border border-[#e5e7eb20] rounded-xl shadow-2xl max-h-[180px] overflow-y-auto">
                                {searchResults.map((user, index) => (
                                    <button
                                        key={index}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#2a2a32] transition-colors duration-150 cursor-pointer text-left border-b border-[#e5e7eb12] last:border-0 first:rounded-t-xl last:rounded-b-xl"
                                        onMouseDown={(e) => { e.preventDefault(); addUser(user); }}
                                    >
                                        <Avatar className="h-7 w-7 shrink-0">
                                            {user.image && <AvatarImage src={user.image} alt={user.name} className="object-cover" />}
                                            <AvatarFallback className="bg-[#2a2a32] text-white/50 text-xs font-semibold">{getInitials(user.name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-[13px] font-medium text-white/70 truncate">{user.name}</span>
                                            <span className="text-[11px] text-white/40 truncate">{user.email}</span>
                                        </div>
                                        <div className="h-5 w-5 rounded-md border border-[#e5e7eb25] flex items-center justify-center shrink-0">
                                            <Plus className="h-3 w-3 text-white/40" strokeWidth={3} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected users list with per-user role */}
                    {selectedUsers.length > 0 && (
                        <div className="mt-4 space-y-1">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                                    {selectedUsers.length} {selectedUsers.length === 1 ? "person" : "people"} to invite
                                </label>
                            </div>
                            <div className="max-h-[220px] overflow-y-auto space-y-1 pr-0.5">
                                {selectedUsers.map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center gap-2.5 p-2 rounded-lg bg-[#1a1a20] border border-[#e5e7eb15] group"
                                    >
                                        <Avatar className="h-7 w-7 shrink-0">
                                            {user.image && <AvatarImage src={user.image} alt={user.name} className="object-cover" />}
                                            <AvatarFallback className="bg-[#2a2a32] text-white/50 text-xs font-semibold">{getInitials(user.name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-[12px] font-medium text-white/65 truncate">{user.name}</span>
                                            <span className="text-[11px] text-white/35 truncate">{user.email}</span>
                                        </div>

                                        {/* Per-user role dropdown */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#2a2a32] border border-[#e5e7eb18] hover:border-[#e5e7eb30] transition-colors duration-150 cursor-pointer shrink-0">
                                                    <span className="text-[11px] font-medium text-white/55">{user.role.name}</span>
                                                    <ChevronDown className="h-3 w-3 text-white/35" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="w-[260px] p-1.5 rounded-xl border border-[#e5e7eb20] bg-[#16161c] shadow-2xl"
                                            >
                                                {roles.map((role) => (
                                                    <DropdownMenuItem
                                                        key={role.name}
                                                        className="flex flex-col items-start p-2.5 gap-0.5 rounded-lg cursor-pointer focus:bg-[#2a2a32] transition-colors duration-150"
                                                        onClick={() => updateUserRole(user.id, role)}
                                                    >
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className="text-[13px] font-semibold text-white/70">{role.name}</span>
                                                            {user.role.name === role.name && (
                                                                <Check className="h-3.5 w-3.5 text-white/50" strokeWidth={3} />
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-white/40 leading-relaxed">{role.description}</p>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* Remove */}
                                        <button
                                            onClick={() => removeUser(user.id)}
                                            className="h-6 w-6 flex items-center justify-center rounded-md text-white/25 hover:text-white/55 hover:bg-[#2a2a32] transition-all duration-150 shrink-0 opacity-0 group-hover:opacity-100"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 p-4 pt-5">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="text-[13px] font-medium text-white/40 px-4 py-2 rounded-lg hover:text-white/60 hover:bg-[#1a1a20] transition-all duration-200 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleInvite}
                        disabled={isInviting || selectedUsers.length === 0}
                        className="h-[34px] px-5 bg-[#1e1e26] hover:bg-[#2a2a35] cursor-pointer text-brand border border-[#e5e7eb25] font-medium text-[13px] rounded-lg transition-all duration-200 disabled:opacity-40"
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

function EditPermissionDialog({
    open,
    onOpenChange,
    member,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: any;
}) {
    const [selectedRole, setSelectedRole] = useState(roles[0]);
    const [isUpdating, setIsUpdating] = useState(false);
    const { updateMemberRole } = useWorkspaceMemberStore();

    useEffect(() => {
        if (member) {
            const roleObj = roles.find((r) => r.name.toLowerCase() === member.role.toLowerCase());
            if (roleObj) setSelectedRole(roleObj);
        }
    }, [member]);

    const handleUpdate = async () => {
        if (!member) return;
        setIsUpdating(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const newRole = selectedRole.name.toLowerCase();
            const res = await axios.put(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members/${member._id}`,
                { role: newRole },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data?.status || res.data?.success) {
                updateMemberRole(member._id, newRole);
                toast.success("Permissions updated successfully");
                onOpenChange(false);
            } else {
                toast.error(res?.data?.message || "Failed to update permissions");
            }
        } catch (error: any) {
            console.error("Failed to update role:", error);
            toast.error(error.response?.data?.message || "Failed to update permissions");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] p-0 shadow-2xl rounded-2xl overflow-hidden border border-[#e5e7eb20] bg-[#0a0a0d]">
                <div className="p-5 pb-0">
                    <h2 className="text-[18px] font-semibold text-white/70 mb-1">Edit Permissions</h2>
                    {member?.userData && (
                        <div className="flex items-center gap-2.5 mb-4 mt-3 p-2.5 bg-[#1a1a20] rounded-lg border border-[#e5e7eb15]">
                            <MemberAvatar userData={member.userData} size="md" />
                            <div>
                                <p className="text-[13px] font-medium text-white/70">{member.userData.name}</p>
                                <p className="text-[11px] text-white/40">{member.userData.email}</p>
                            </div>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider">New role</label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="w-full cursor-pointer flex items-center gap-3 p-2.5 bg-[#1a1a20] border border-[#e5e7eb20] rounded-lg text-left group hover:border-[#e5e7eb35] transition-colors duration-200">
                                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#2a2a32] text-white/50">
                                        <User className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[13px] font-medium text-white/70">{selectedRole?.name}</span>
                                            <ChevronDown className="h-3.5 w-3.5 text-white/40 group-data-[state=open]:rotate-180 transition-transform duration-200" />
                                        </div>
                                        <p className="text-[11px] text-white/35 mt-0.5 truncate">{selectedRole?.description}</p>
                                    </div>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="start"
                                sideOffset={4}
                                style={{ zIndex: 9999 }}
                                className="w-[400px] p-1.5 rounded-xl border border-[#e5e7eb20] bg-[#16161c] shadow-2xl mt-1"
                            >                                {roles.map((role) => (
                                <DropdownMenuItem
                                    key={role.name}
                                    className="flex flex-col items-start p-3 gap-0.5 rounded-lg cursor-pointer focus:bg-[#2a2a32] transition-colors duration-150"
                                    onClick={() => setSelectedRole(role)}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-[13px] font-semibold text-white/70">{role.name}</span>
                                        {selectedRole?.name === role.name && (
                                            <Check className="h-3.5 w-3.5 text-white/50" strokeWidth={3} />
                                        )}
                                    </div>
                                    <p className="text-[12px] text-white/40 leading-relaxed">{role.description}</p>
                                </DropdownMenuItem>
                            ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 p-4 pt-5 mt-2">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="text-[13px] font-medium text-white/40 px-4 py-2 rounded-lg hover:text-white/60 hover:bg-[#1a1a20] transition-all duration-200 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleUpdate}
                        disabled={isUpdating}
                        className="h-[34px] px-5 bg-[#1e1e26] hover:bg-[#2a2a35] cursor-pointer text-white/70 border border-[#e5e7eb25] font-medium text-[13px] rounded-lg transition-all duration-200 disabled:opacity-40"
                    >
                        {isUpdating ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving...</>
                        ) : (
                            "Save changes"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function RemoveMemberDialog({
    open,
    onOpenChange,
    member,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: any;
}) {
    const [isRemoving, setIsRemoving] = useState(false);
    const { removeMember } = useWorkspaceMemberStore();

    const handleRemove = async () => {
        if (!member) return;
        setIsRemoving(true);
        try {
            const success = await removeMember(member._id);
            if (success) {
                toast.success(`${member?.userData?.name} removed from workspace`);
                onOpenChange(false);
            }
        } catch (error: any) {
            console.error("Failed to remove member:", error);
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px] p-0 shadow-2xl rounded-2xl overflow-hidden border border-[#e5e7eb20] bg-[#0a0a0d]">
                <div className="p-5">
                    <h2 className="text-[18px] font-semibold text-white/70 mb-2">Remove Member</h2>
                    {member?.userData && (
                        <div className="flex items-center gap-2.5 my-3 p-2.5 bg-[#1a1a20] rounded-lg border border-[#e5e7eb15]">
                            <MemberAvatar userData={member.userData} size="md" />
                            <div>
                                <p className="text-[13px] font-medium text-white/70">{member.userData.name}</p>
                                <p className="text-[11px] text-white/40">{member.userData.email}</p>
                            </div>
                        </div>
                    )}
                    <p className="text-[13px] text-white/45 leading-relaxed">
                        This will remove them from the workspace. They'll lose access to all rooms and tasks.
                    </p>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 pb-5">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="text-[13px] font-medium text-white/40 px-4 py-2 rounded-lg hover:text-white/60 hover:bg-[#1a1a20] transition-all duration-200 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleRemove}
                        disabled={isRemoving}
                        className="h-[34px] px-5 bg-red-500/10 hover:bg-red-500/20 cursor-pointer text-red-400 border border-red-500/20 font-medium text-[13px] rounded-lg transition-all duration-200 disabled:opacity-40"
                    >
                        {isRemoving ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Removing...</>
                        ) : (
                            "Remove"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function PeoplePage() {
    const { currentWorkspace } = useTaskroomWorkspacetore();
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id;
    const [searchQuery, setSearchQuery] = useState("");
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const [selectedMemberForEdit, setSelectedMemberForEdit] = useState<any>(null);
    const [selectedMemberForRemove, setSelectedMemberForRemove] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        members: workspaceMembers,
        metadata: workspaceMetadata,
        isLoading: isWorkspaceLoading,
        fetchMembers,
    } = useWorkspaceMemberStore();

    const members = workspaceMembers;
    const isLoading = isWorkspaceLoading;

    const loadMembers = useCallback(
        (page: number, search: string) => {
            if (workspaceId) {
                fetchMembers(workspaceId, page, search);
            }
        },
        [workspaceId, fetchMembers]
    );

    useEffect(() => {
        if (!workspaceId) return;
        setCurrentPage(1);
        setSearchQuery("");
        loadMembers(1, "");
    }, [workspaceId, loadMembers]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setCurrentPage(1);
            loadMembers(1, value);
        }, 500);
    };

    return (
        <>
            <div className="flex h-full min-h-0 bg-[#0a0a0d] rounded-tr-lg rounded-br-lg py-3 pt-0 px-5">
                <div className="flex-1 min-h-0 overflow-hidden w-full flex flex-col">
                    {/* Header */}
                    {/* <div className="flex items-center justify-between mb-5 shrink-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium text-white/35">
                                {currentWorkspace?.name
                                    ? currentWorkspace.name.charAt(0).toUpperCase() + currentWorkspace.name.slice(1)
                                    : "Untitled"}
                            </span>
                            <ChevronRight className="w-4 h-4 text-white/15" />
                            <span className="text-[13px] font-semibold text-white/80">Manage People</span>
                        </div>
                    </div> */}

                    {/* Search + Invite bar */}
                    <div className="mb-3 shrink-0">
                        <div className="flex items-center bg-[#1a1a20] border border-[#e5e7eb18] rounded-xl overflow-hidden h-[44px] focus-within:border-[#e5e7eb30] transition-colors duration-200">
                            <div className="pl-4 shrink-0">
                                <Search className="h-[14px] w-[14px] text-white/30" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search members..."
                                className="flex-1 px-3 py-3 text-[13px] placeholder:text-[13px] placeholder:text-white/30 text-white/70 focus:ring-0 focus:outline-none bg-transparent"
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
                            <div className="pr-1.5 shrink-0">
                                <Button
                                    onClick={() => setIsInviteDialogOpen(true)}
                                    className="cursor-pointer text-brand hover:bg-brand/10 bg-transparent border border-brand/30 h-[34px] px-4 flex items-center gap-1.5 rounded-lg text-[13px] font-medium transition-all duration-200"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Invite people
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-auto flex-1 min-h-0 relative">
                        <table className="w-full caption-bottom text-sm">
                            <TableHeader className="[&_tr]:border-b-0">
                                <TableRow className="hover:bg-transparent border-none">
                                    {["Name", "Email", "Role", "Invited on", "Status", ""].map((col, i) => (
                                        <TableHead
                                            key={i}
                                            className={cn(
                                                "sticky top-0 bg-[#0a0a0d] z-10 text-[11px] font-semibold text-white/80 uppercase tracking-widest h-8 py-0",
                                                "before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-[#e5e7eb15]",
                                                i === 5 ? "w-10" : ""
                                            )}
                                        >
                                            {col}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Invite row */}
                                <TableRow
                                    className="group cursor-pointer border-none transition-colors duration-200 hover:bg-[#1a1a20]"
                                    onClick={() => setIsInviteDialogOpen(true)}
                                >
                                    <TableCell colSpan={8} className="py-2.5">
                                        <div className="flex items-center gap-3 ml-1">
                                            <div className="flex h-[22px] w-[22px] border border-[#e5e7eb20] items-center justify-center rounded-full group-hover:border-[#e5e7eb35] transition-colors duration-200">
                                                <Plus className="h-[11px] w-[11px] text-white/40 group-hover:text-white/80 transition-colors duration-200" strokeWidth={3} />
                                            </div>
                                            <span className="text-[13px] text-white/80 group-hover:text-white/60 transition-colors duration-200">
                                                Invite people
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>

                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-5 w-5 animate-spin text-white/25" />
                                                <span className="text-[13px] text-white/30">Loading members...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : members?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-16 text-center">
                                            <span className="text-[13px] text-white/30">No members found</span>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    members?.map((member) => (
                                        <TableRow
                                            key={member._id}
                                            className="group border-none transition-all duration-200 hover:bg-[#1a1a20]"
                                        >
                                            {/* Name */}
                                            <TableCell className="py-2.5">
                                                <div className="flex items-center gap-3 ml-1">
                                                    <MemberAvatar userData={member.userData} />
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[13px] font-medium text-white/45 capitalize">
                                                            {member.userData?.name}
                                                        </span>
                                                        {member.role === "owner" || member?.isOwner ? (
                                                            <Badge className="bg-white/8 text-white/80  hover:bg-white/8 px-1.5 py-0 text-[10px] font-semibold rounded border-none uppercase h-[17px] tracking-wide">
                                                                Owner
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Email */}
                                            <TableCell className="text-[13px] text-white/45">
                                                {member.userData?.email}
                                            </TableCell>

                                            {/* Role */}
                                            <TableCell>
                                                <span className="text-[13px] text-white/45 capitalize">{member.role}</span>
                                            </TableCell>

                                            {/* Invited on */}
                                            <TableCell className="text-[13px] text-white/40">
                                                {member.invitedOn
                                                    ? new Date(member.invitedOn).toLocaleDateString()
                                                    : new Date(member.createdAt).toLocaleDateString()}
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell>
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center gap-1.5 text-[12px] font-medium capitalize",
                                                        member.status === "active"
                                                            ? "text-emerald-400/70"
                                                            : "text-white/35"
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "h-1.5 w-1.5 rounded-full",
                                                            member.status === "active" ? "bg-emerald-400/70" : "bg-white/25"
                                                        )}
                                                    />
                                                    {member.status}
                                                </span>
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 border border-transparent hover:border-[#e5e7eb20] text-white/40 hover:text-white/70 hover:bg-[#2a2a32] transition-all duration-200"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="w-[190px] border border-[#e5e7eb20] bg-[#16161c] rounded-xl p-1 shadow-2xl"
                                                    >
                                                        <DropdownMenuItem
                                                            className="text-[13px] py-2 px-3 text-white/55 rounded-lg hover:bg-[#2a2a32] cursor-pointer focus:bg-[#2a2a32] focus:text-white/70 transition-colors duration-150"
                                                            onClick={() => {
                                                                setSelectedMemberForEdit(member);
                                                                setIsEditDialogOpen(true);
                                                            }}
                                                        >
                                                            Edit Permissions
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-[13px] py-2 px-3 text-red-400/70 rounded-lg hover:bg-red-500/10 cursor-pointer focus:bg-red-500/10 focus:text-red-400 transition-colors duration-150 mt-0.5"
                                                            onClick={() => {
                                                                setSelectedMemberForRemove(member);
                                                                setIsRemoveDialogOpen(true);
                                                            }}
                                                        >
                                                            Remove from Workspace
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {workspaceMetadata && workspaceMetadata.totalPages > 1 && (
                        <div className="flex items-center justify-between px-1 py-3 shrink-0 border-t border-[#e5e7eb15]">
                            <span className="text-[12px] text-white/35 font-medium">
                                Page {workspaceMetadata.currentPage} of {workspaceMetadata.totalPages}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const newPage = Math.max(1, currentPage - 1);
                                        setCurrentPage(newPage);
                                        loadMembers(newPage, searchQuery);
                                    }}
                                    disabled={workspaceMetadata.currentPage === 1 || isLoading}
                                    className="h-[30px] border-[#e5e7eb20] bg-transparent text-white/45 hover:bg-[#1a1a20] hover:text-white/65 text-[12px] font-medium transition-all duration-200"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const newPage = Math.min(workspaceMetadata.totalPages, currentPage + 1);
                                        setCurrentPage(newPage);
                                        loadMembers(newPage, searchQuery);
                                    }}
                                    disabled={workspaceMetadata.currentPage === workspaceMetadata.totalPages || isLoading}
                                    className="h-[30px] border-[#e5e7eb20] bg-transparent text-white/45 hover:bg-[#1a1a20] hover:text-white/65 text-[12px] font-medium transition-all duration-200"
                                >
                                    Next
                                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <InvitePeopleDialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen} />
            <EditPermissionDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                member={selectedMemberForEdit}
            />
            <RemoveMemberDialog
                open={isRemoveDialogOpen}
                onOpenChange={setIsRemoveDialogOpen}
                member={selectedMemberForRemove}
            />
        </>
    );
}