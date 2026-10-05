"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useParams } from "next/navigation";
import { toast } from "sonner";
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

const sidebarItems = [
    { icon: Users, label: "People", active: true },
    { icon: Settings, label: "Settings" }

];

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

function InvitePeopleDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const [email, setEmail] = useState("");
    const [selectedRole, setSelectedRole] = useState(roles[0]);
    const [searchResults, setSearchResults] = useState<{ name: string; email: string; id?: string; profilePicture?: string; avatar?: string; image?: string }[]>([]);
    const [selectedUser, setSelectedUser] = useState<{ name: string; id: string; email: string; profilePicture?: string; avatar?: string; image?: string; status?: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const params = useParams();
    const workspaceId = params?.workspace as string;

    const { fetchMembers: fetchWorkspaceMembers, addMemberToState } = useWorkspaceMemberStore();
    const { addSpaceMember, fetchSpaceMembers, isAddingMember } = useSpaceStore();

    const handleInvite = async () => {
        if (!selectedUser) {
            toast.error("Please select a user from the search results");
            return;
        }

        setIsInviting(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const orgId = localStorage.getItem('garage_org_id');

            if (orgId) {

                const role = selectedRole.name.toLowerCase();


                // Workspace Member Invitation
                const res = await axios.post(
                    `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members`,
                    {
                        memberUserId: selectedUser.id,
                        workspaceId: workspaceId,
                        role: role,
                        orgId: orgId,
                        name: selectedUser.name,
                        email: selectedUser?.email
                    },
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
                // fetchWorkspaceMembers(workspaceId);
                console.log("jxcvhgy7fd", res)
                if (res.data?.status || res.data?.success) {
                    const responseData = res.data?.data;
                    if (responseData) {
                        addMemberToState({
                            _id: responseData._id,
                            userData: {
                                _id: selectedUser.id,
                                name: selectedUser.name,
                                email: selectedUser?.email,
                                profilePicture: selectedUser.profilePicture,
                                avatar: selectedUser.profilePicture || selectedUser.avatar || selectedUser.image,
                                image: selectedUser.profilePicture || selectedUser.image || selectedUser.avatar,
                            },
                            role: role,
                            status: responseData?.status,
                            invitedOn: responseData.createdAt,
                        });
                    }
                    toast.success("Invitation sent successfully");
                    onOpenChange(false);
                    setEmail("");
                    setSelectedUser(null);
                }
                else {
                    toast.error(res?.data?.message)
                }


            }
        } catch (error: any) {
            console.error("Failed to send invite:", error);
            // toast.error is already handled in store or can be here
        } finally {
            setIsInviting(false);
        }
    };

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
        if (!query || query.includes(",") || query.includes(" ")) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const garage_org_id = localStorage.getItem("garage_org_id");
            const response = await axios.get(
                `https://uatapi.garage.app/public/organizations/${garage_org_id}/users?search=${query}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            // Assuming the structure is { data: { data: [...] } } or { data: [...] } based on common patterns in this app
            const users = response?.data || [];
            if (Array.isArray(users?.users)) {
                setSearchResults(users?.users.map((u: any) => ({
                    name: u?.name,
                    email: u?.email,
                    id: u?.id || u?._id,
                    profilePicture: u?.profilePicture || u?.image || u?.avatar,
                    avatar: u?.profilePicture || u?.image || u?.avatar,
                    image: u?.profilePicture || u?.image || u?.avatar,
                })));
                setShowResults(users?.users?.length > 0);

            }
        } catch (error) {
            console.error("Failed to search users:", error);
        } finally {
            setIsSearching(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers(email);
        }, 300);

        return () => clearTimeout(timer);
    }, [email, fetchUsers]);
    console.log("searchResults", searchResults)
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] p-0  shadow-2xl rounded-2xl overflow-hidden border border-[#e5e7eb29] ">

                <div className="p-4 pb-0">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[20px] font-bold text-white tracking-tight">
                            Invite People
                        </h2>
                        {/* <button
                                onClick={() => onOpenChange(false)}
                                className="h-7 w-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                <X className="h-4 w-4 text-gray-500" />
                            </button> */}
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-2 relative" ref={searchRef}>
                            <label className="text-xs  text-white ">Invite by email</label>
                            <div className="relative mt-2">
                                <input
                                    placeholder="Email"
                                    className="
    h-[35px]
    w-full               
    rounded-[8px]
    border 
    px-3                  
    text-xs
    text-slate-300                
    placeholder:text-xs 
    placeholder:text-slate-300
 border-[#e5e7eb29] 
    focus:ring-0
    focus:outline-none
    focus-visible:ring-0
    focus-visible:outline-none
  "

                                    value={email}
                                    autoComplete="off"
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (!e.target.value) setShowResults(false);
                                    }}
                                    onFocus={() => {
                                        if (searchResults.length > 0) setShowResults(true);
                                    }}
                                />
                                {isSearching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="h-4 w-4 border-2 border-[#e5e7eb29] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                            {
                                showResults &&
                                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#111116] border border-[#e5e7eb29] rounded-[8px] shadow-2xl max-h-[140px] overflow-y-auto custom-scrollbar">
                                    {searchResults?.map((user, index) => (
                                        <button
                                            key={index}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-900 transition-colors cursor-pointer text-left border-b  border-[#e5e7eb29] last:border-0"
                                            onClick={() => {
                                                setEmail(user.email);
                                                setSelectedUser({
                                                    name: user.name,
                                                    id: user.id || "",
                                                    email: user?.email || "",
                                                    profilePicture: user.profilePicture,
                                                    avatar: user.avatar,
                                                    image: user.image
                                                });
                                                setShowResults(false);
                                            }}
                                        >
                                            <Avatar className="h-8 w-8">
                                                {(user.profilePicture || user.avatar || user.image) && (
                                                    <AvatarImage
                                                        src={user.profilePicture || user.avatar || user.image}
                                                        alt={user.name}
                                                        className="object-cover"
                                                    />
                                                )}
                                                <AvatarFallback className="bg-[#343439] text-white text-[10px] font-bold">
                                                    {user?.name?.substring(0, 2)?.toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-bold text-white">{user?.name}</span>
                                                <span className="text-xs text-slate-200">{user?.email}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            }

                        </div>

                        <div className="space-y-2">
                            <label className="text-xs  text-white ">Invite as</label>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>

                                    <button className="w-full cusror-pointer flex items-center mt-2 gap-4 p-1 bg-[#111116] border border-[#e5e7eb29]  transition-colors rounded-[8px] text-left group">
                                        <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#111116] text-slate-200">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[12px] text-white">{selectedRole.name}</span>
                                                <ChevronDown className="h-[14px] w-[14px] text-gray-500 group-data-[state=open]:rotate-180 transition-transform" />
                                            </div>
                                            <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">
                                                {selectedRole.description}
                                            </p>
                                        </div>
                                    </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="start" className="w-[380px] cursor-pointer p-2 rounded-2xl shadow-2xlborder border-[#e5e7eb29]  bg-[#111116] mt-1">
                                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {roles.map((role) => (
                                            <DropdownMenuItem
                                                key={role.name}
                                                className="flex flex-col items-start p-3 gap-1 rounded-xl cursor-pointer focus:bg-[#111116]"
                                                onClick={() => setSelectedRole(role)}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[12px] font-bold text-white">{role.name}</span>
                                                        {role.badge && (
                                                            <Badge className="bg-[#E9E4FF] text-[#6E56CF] hover:bg-[#E9E4FF] border-none px-2 py-0 text-[10px] font-bold rounded-[4px] h-[18px]">
                                                                {role.badge}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {selectedRole.name === role.name && (
                                                        <Check className="h-4 w-4 text-gray-900" strokeWidth={3} />
                                                    )}
                                                </div>
                                                <p className="text-[12px] text-gray-400 font-medium leading-relaxed">
                                                    {role.description}
                                                </p>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>

                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 bg-[#111116] pt-0">

                    <button
                        onClick={() => onOpenChange(false)}
                        className="text-[12px] font-bold text-white px-4 py-2 cursor-pointer transition-colors bg-[#111116]"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleInvite}
                        disabled={isInviting || !selectedUser}
                        className="h-[35px] px-4 bg-[#111116] hover:bg-[#111116] cursor-pointer text-white border border-[#e5e7eb29]  font-bold text-[12px] rounded-xl shadow-lg disabled:opacity-50"
                    >
                        {isInviting ? "Sending..." : "Send  invite"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>

    );
}

function EditPermissionDialog({
    open,
    onOpenChange,
    member
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    member: any
}) {
    const [selectedRole, setSelectedRole] = useState(roles[0]);
    const [isUpdating, setIsUpdating] = useState(false);
    const { updateMemberRole } = useWorkspaceMemberStore();

    useEffect(() => {
        if (member) {
            const roleObj = roles.find(r => r.name.toLowerCase() === member.role.toLowerCase());
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
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            // Check success based on the API response structure
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
            <DialogContent className="sm:max-w-[480px] p-0 shadow-2xl rounded-2xl overflow-hidden border border-[#e5e7eb29]">
                <div className="p-4 pb-0">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[20px] font-bold text-white hover:bg-[#343439]">
                            Edit Permissions
                        </h2>
                    </div>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <label className="text-xs  text-white">Select new role for {member?.userData?.name}</label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="w-full cursor-pointer flex items-center mt-2 gap-4 p-1 bg-[#111116] border border-[#e5e7eb29] transition-colors rounded-[8px] text-left group">
                                        <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#111116] text-white">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[12px] text-white">{selectedRole?.name}</span>
                                                <ChevronDown className="h-[14px] w-[14px] text-gray-500 group-data-[state=open]:rotate-180 transition-transform" />
                                            </div>
                                            <p className="text-[12px] text-gray-400 mt-0.5 line-clamp-1">
                                                {selectedRole?.description}
                                            </p>
                                        </div>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[380px] p-2 rounded-2xl shadow-2xl border border-[#e5e7eb29]  bg-[#111116]  mt-1">
                                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {roles.map((role) => (
                                            <DropdownMenuItem
                                                key={role.name}
                                                className="flex flex-col items-start p-3 gap-1 rounded-xl cursor-pointer focus:bg-[#343439]"
                                                onClick={() => setSelectedRole(role)}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[12px] font-bold text-white">{role.name}</span>
                                                        {role.badge && (
                                                            <Badge className="bg-[#E9E4FF] text-[#6E56CF] hover:bg-[#E9E4FF] border-none px-2 py-0 text-[10px] font-bold rounded-[4px] h-[18px]">
                                                                {role.badge}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {selectedRole?.name === role.name && (
                                                        <Check className="h-4 w-4 text-white" strokeWidth={3} />
                                                    )}
                                                </div>
                                                <p className="text-[12px] text-gray-400 font-medium leading-relaxed">
                                                    {role.description}
                                                </p>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-4 bg-[#111116] pt-0 mt-6">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="text-[12px] font-bold text-white cursor-pointer px-4 py-2 transition-colors"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleUpdate}
                        disabled={isUpdating}
                        className="h-[35px] px-4  text-white border border-[#e5e7eb29] hover:bg-[#111116] bg-[#111116] cursor-pointer font-bold text-[12px] rounded-xl shadow-lg disabled:opacity-50"
                    >
                        {isUpdating ? "Saving..." : "Save changes"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function RemoveMemberDialog({
    open,
    onOpenChange,
    member
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    member: any
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
    console.log("member35vc", member)
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px] p-0 shadow-2xl rounded-2xl overflow-hidden border border-[#e5e7eb29] bg-[#111116]">
                <div className="p-6">
                    <h2 className="text-[20px] font-bold text-white mb-2">Remove Member</h2>
                    <p className="text-sm text-gray-400">
                        Are you sure you want to remove <span className="font-bold text-white">{member?.userData?.name}</span> from this workspace? They will lose access to all rooms and tasks.
                    </p>
                </div>
                <div className="flex items-center justify-end gap-3 p-4 pt-0 bg-[#111116] ">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="text-[12px] font-bold text-white cursor-pointer px-4 py-2 transition-colors hover:text-gray-300"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleRemove}
                        disabled={isRemoving}
                        variant="destructive"
                        className="h-[35px] px-4 font-bold cursor-pointer  text-[12px] border border-[#e5e7eb29]  bg-[#111116]  rounded-xl shadow-lg disabled:opacity-50"
                    >
                        {isRemoving ? "Removing..." : "Remove"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function PeoplePage() {
    const params = useParams();
    const workspaceId = params?.workspace as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const [selectedMemberForEdit, setSelectedMemberForEdit] = useState<any>(null);
    const [selectedMemberForRemove, setSelectedMemberForRemove] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1); // Reset to first page on search
        }, 500); // 500ms debounce delay

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const {
        members: workspaceMembers,
        metadata: workspaceMetadata,
        isLoading: isWorkspaceLoading,
        fetchMembers: fetchWorkspaceMembers
    } = useWorkspaceMemberStore();

    const {
        members: spaceMembers,
        isLoading: isSpaceLoading,
        fetchSpaceMembers
    } = useSpaceStore();

    const isSpace = !!params.space;
    const members = workspaceMembers;
    const isLoading = isWorkspaceLoading;
    console.log("membersmembers", workspaceMembers)
    useEffect(() => {
        if (workspaceId) {
            fetchWorkspaceMembers(workspaceId, currentPage, debouncedSearch);
        }
    }, [workspaceId, currentPage, debouncedSearch, fetchWorkspaceMembers]);


    // Filter members based on search query
    // const filteredMembers = members.filter(member =>
    //     member?.userId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //     member?.userId?.email?.toLowerCase().includes(searchQuery.toLowerCase())
    // );
    console.log("filteredMembers", members)
    return (
        <>
            <div
                className="
    flex h-full 
   bg-[#111116]
    border border-[#e5e7eb29]
    border-l-0              
    rounded-tr-lg           
    rounded-br-lg  
    py-2
    px-4        
  "
            >
                {/* Sidebar */}


                {/* Main Content */}
                <div className="flex-1 overflow-hidden w-full flex flex-col">
                    <div className="w-full  flex flex-col min-h-0">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <h1 className="text-[24px] font-bold text-white tracking-tight">Manage people</h1>
                            </div>
                            {/* <Button variant="outline" size="sm" className="h-8 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 border-gray-200 hover:bg-gray-50 rounded-md">
                            <Download className="h-[15px] w-[15px]" />
                            Export
                        </Button> */}
                        </div>

                        {/* Search/Invite Bar */}
                        <div className="mb-8 shrink-0">
                            <div className="flex items-center border    bg-[#343439]
    border border-slate-800 rounded-lg overflow-hidden   focus-within:ring-0 focus-within:ring-[#e5e7eb29] focus-within:border-[#e5e7eb29] transition-all h-[48px]">
                                <div className="pl-4">
                                    <Search className="h-[14px] w-[14px] text-white" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="
    flex-1 px-3 py-3 
    text-[12px]              
    placeholder:text-[14px]  
    placeholder:text-white 
    focus:ring-0 
    focus:outline-none 
    focus-visible:ring-0 
    focus-visible:outline-none 
    font-normal 
   
    bg-[#343439]
  "
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <div className="pr-1.5">
                                    <Button
                                        onClick={() => setIsInviteDialogOpen(true)}
                                        className=" cursor-pointer text-white hover:bg-[#343439] bg-[#111116] border border-[#e5e7eb29]  h-[35px] px-4 flex items-center gap-2 rounded-md text-[12px]  font-bold"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Invite people
                                    </Button>
                                </div>
                            </div>
                        </div>
                        {/* User Table */}
                    </div>
                    {/* User Table */}
                    <div className="overflow-auto flex-1 min-h-0 relative">
                        <table className="w-full caption-bottom text-sm max-h-full">
                            <TableHeader className="[&_tr]:border-b-0">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="sticky top-0 bg-[#111116] z-10 before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-[#e5e7eb29] text-[10px] font-bold text-white uppercase tracking-wider h-8 py-0 ">Name</TableHead>
                                    <TableHead className="sticky top-0 bg-[#111116] z-10 before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-[#e5e7eb29] text-[10px] font-bold text-white uppercase tracking-wider h-8 py-0">Email</TableHead>
                                    <TableHead className="sticky top-0 bg-[#111116] z-10 before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-[#e5e7eb29] text-[10px] font-bold text-white uppercase tracking-wider h-8 py-0">Role</TableHead>
                                    <TableHead className="sticky top-0 bg-[#111116] z-10 before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-[#e5e7eb29] text-[10px] font-bold text-white uppercase tracking-wider h-8 py-0">Invited on</TableHead>
                                    <TableHead className="sticky top-0 bg-[#111116] z-10 before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-[#e5e7eb29] text-[10px] font-bold text-white uppercase tracking-wider h-8 py-0">Status</TableHead>
                                    <TableHead className="sticky top-0 bg-[#111116] z-10 before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-[#e5e7eb29] w-8 h-8 py-0"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Invite People Row */}
                                <TableRow
                                    className="group cursor-pointer hover:bg-[#343439] border-none transition-colors"
                                    onClick={() => setIsInviteDialogOpen(true)}
                                >
                                    <TableCell colSpan={8} className="py-2.5">
                                        <div className="flex items-center gap-3 ml-1">
                                            <div className="flex h-[22px] w-[22px] border border-[#e5e7eb29]  items-center justify-center rounded-full  transition-colors">
                                                <Plus className="h-[13px] w-[13px] text-slate-200" strokeWidth={3} />
                                            </div>
                                            <span className="text-[12px]  text-slate-300">Invite people</span>
                                        </div>
                                    </TableCell>
                                </TableRow>

                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-10 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                                                <span className="text-sm text-text-slate-300 font-medium">Loading members...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : members?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-10 text-center">
                                            <span className="text-sm text-text-slate-300 font-medium">No members found</span>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    members?.map((member) => (
                                        <TableRow key={member._id} className="hover:bg-[#343439] border-none group transition-colors">
                                            <TableCell className="py-2.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative ml-1">
                                                        <Avatar className="h-[26px] w-[26px]">
                                                            {member.userData?.profilePicture || member.userData?.avatar || member.userData?.image ? (
                                                                <AvatarImage
                                                                    src={member.userData.profilePicture || member.userData.avatar || member.userData.image}
                                                                    alt={member.userData.name}
                                                                    className="object-cover"
                                                                />
                                                            ) : (
                                                                <AvatarFallback className="border-[#e5e7eb29] border bg-[#111116] text-white  text-[10px] text-slate-200">
                                                                    {member.userData?.name?.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            )}
                                                        </Avatar>
                                                        {/* <div className="absolute -bottom-1 -right-1 h-[14px] w-[14px] rounded-full bg-white flex items-center justify-center border-[2px] border-white shadow-sm">
                                                            <Plus className="h-[9px] w-[9px] text-gray-400" strokeWidth={4} />
                                                        </div> */}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[12px]  text-white capitalize">{member.userData?.name}</span>
                                                        {member.role === 'owner' && (
                                                            <Badge className="bg-[#E5E7EB] text-white hover:bg-[#E5E7EB] px-1.5 py-0 text-[10px]  rounded-[3px] border-none shadow-none uppercase h-[18px]">
                                                                Owner
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[12px] text-white capitalize">{member.userData?.email}</TableCell>
                                            <TableCell className="text-[12px] text-white  capitalize">{member.role}</TableCell>


                                            <TableCell className="text-[12px] text-white capitalize">
                                                {member.invitedOn ? new Date(member?.invitedOn).toLocaleDateString() : new Date(member?.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-[12px] text-white capitalize">{member?.status}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0  border border-[#e5e7eb29] text-gray-200 hover:text-slate-200 group-hover:text-slate-200 transition-colors">
                                                            <MoreHorizontal className="h-5 w-5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[200px] border border-[#e5e7eb29] bg-[#111116] ">
                                                        <DropdownMenuItem
                                                            className="text-xs py-2 px-3 text-white  hover:bg-[#343439] cursor-pointer focus:bg-[#343439] focus:text-white"
                                                            onClick={() => {
                                                                setSelectedMemberForEdit(member);
                                                                setIsEditDialogOpen(true);
                                                            }}
                                                        >
                                                            Edit Permissions
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-red-600 text-xs py-2 px-3 hover:bg-[#343439] cursor-pointer focus:bg-[#343439] focus:text-red-600"
                                                            onClick={() => {
                                                                setSelectedMemberForRemove(member);
                                                                setIsRemoveDialogOpen(true);
                                                            }}
                                                        >
                                                            Remove From Workspace
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
                    {workspaceMetadata && workspaceMetadata.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-t border-[#e5e7eb29]">
                            <div className="text-[12px] text-gray-400 font-bold">
                                Showing page {workspaceMetadata.currentPage} of {workspaceMetadata.totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={workspaceMetadata.currentPage === 1 || isLoading}
                                    className="h-[30px] border-[#e5e7eb29] bg-[#111116] text-slate-200 hover:bg-[#343439] hover:text-white text-[12px] font-bold"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(workspaceMetadata.totalPages, p + 1))}
                                    disabled={workspaceMetadata.currentPage === workspaceMetadata.totalPages || isLoading}
                                    className="h-[30px] border-[#e5e7eb29] bg-[#111116] text-slate-200 hover:bg-[#343439] hover:text-white text-[12px] font-bold"
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
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
