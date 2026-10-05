"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTaskroomWorkspacetore, Room } from "@/store/taskroom/taskroomWorkspace";
import { Loader2, Search, Plus, CheckCircle2, ChevronDown, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWorkspaceMemberStore } from "@/store/taskroom/workspaceMemberStore";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CreateRoomDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spaceId?: string;
    room?: Room | null;
}

export function CreateRoomDialog({ open, onOpenChange, spaceId, room }: CreateRoomDialogProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState("#6366f1");
    const [bgImage, setBgImage] = useState("");
    const [isPrivate, setIsPrivate] = useState(true);
    const [isDefault, setIsDefault] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<{ _id: string, name: string, email: string, role: string }[]>([]);
    const [memberSearch, setMemberSearch] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [spaceMembers, setSpaceMembers] = useState<any[]>([]);
    const [roomMembers, setRoomMembers] = useState<any[]>([]);
    const router = useRouter();
    // const params = useParams();
    // const workspaceIdParam = params?.workspace as string;
    const { workspace } = useParams()
    const workspaceId = workspace as string
    const { createRoom, updateRoom, isRoomLoading: isLoading } = useTaskroomWorkspacetore();
    const { members, fetchSpaceMembers } = useWorkspaceMemberStore();


    useEffect(() => {
        const targetId = room?._id
        if (open && (room?._id)) {
            const fetchRoomSelectedMembers = async () => {
                setIsLoadingMembers(true);
                try {
                    const token = localStorage.getItem("garage_tok");
                    const res = await axios.get(
                        `${process.env.NEXT_PUBLIC_TASKROOM_URL}room/members?roomId=${targetId}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (res.data?.success || res.data?.status) {
                        const membersData = res.data?.data?.data || [];
                        setRoomMembers(membersData);
                        setSelectedUsers(membersData.map((m: any) => ({
                            _id: m.userId?._id || m._id,
                            name: m.userId?.name || m.name,
                            email: m.userId?.email || m.email,
                            role: m.role || "member",
                            avatar: m.userId?.avatar || m.avatar
                        })));
                    }
                } catch (err) {
                    console.error("Failed to fetch space/room members", err);
                } finally {
                    setIsLoadingMembers(false);
                }
            };
            fetchRoomSelectedMembers();
        }
    }, [open])
    useEffect(() => {
        if (open && (spaceId)) {
            const targetId = spaceId;
            const fetchRoomMembers = async () => {
                setIsLoadingMembers(true);
                try {
                    const token = localStorage.getItem("garage_tok");
                    const res = await axios.get(
                        `${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members?spaceId=${targetId}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (res.data?.success || res.data?.status) {
                        const membersData = res.data?.data?.data || [];
                        setSpaceMembers(membersData);
                        // setSelectedUsers(membersData.map((m: any) => ({
                        //     _id: m.userId?._id || m._id,
                        //     name: m.userId?.name || m.name,
                        //     email: m.userId?.email || m.email,
                        //     role: m.role || "member",
                        //     avatar: m.userId?.avatar || m.avatar
                        // })));
                    }
                } catch (err) {
                    console.error("Failed to fetch space/room members", err);
                } finally {
                    setIsLoadingMembers(false);
                }
            };
            fetchRoomMembers();

            if (room) {
                setName(room.name);
                setDescription(room.description || "");
                setColor(room.color);
                setBgImage(room.bgImage || "");
                setIsPrivate(room.isprivate || true);
                setIsDefault(room.setDefault || false);
            } else {
                setName("");
                setDescription("");
                setColor("#6366f1");
                setBgImage("");
                setIsPrivate(true);
                setSelectedUsers([]);
            }
        }
    }, [open, spaceId, room]);

    const handleAddUser = (user: { _id: string, name: string, email: string }) => {
        if (!selectedUsers.some((u) => u._id === user._id)) {
            setSelectedUsers([...selectedUsers, { ...user, role: "member" }]);
        }
    };

    const handleUpdateRole = (userId: string, role: string) => {
        setSelectedUsers(selectedUsers.map(u => u._id === userId ? { ...u, role } : u));
    };

    const handleRemoveUser = async (userId: string) => {
        if (room?._id) {
            // Find the member record ID from roomMembers (members currently in the room)
            const memberRecord = roomMembers.find(m => (m.userId?._id || m._id) === userId);
            if (memberRecord?._id) {
                try {
                    const token = localStorage.getItem("garage_tok");
                    const res = await axios.delete(
                        `${process.env.NEXT_PUBLIC_TASKROOM_URL}room/members/${memberRecord._id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (res.data?.success || res.data?.status) {
                        toast.success("Member removed from room");
                        setRoomMembers(prev => prev.filter(m => m._id !== memberRecord._id));
                    }
                } catch (err) {
                    console.error("Failed to delete room member", err);
                    toast.error("Failed to remove member");
                    return; // Prevent local state update if API fails
                }
            }
        }
        setSelectedUsers(selectedUsers.filter((u) => u._id !== userId));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        let success = false;
        if (room) {
            success = await updateRoom(room._id, {
                name,
                description,
                color,
                bgImage,
                isprivate: isPrivate,
                members: selectedUsers,
                setDefault: isDefault
            });
        } else if (spaceId) {
            success = await createRoom({
                name,
                description,
                spaceId,
                color,
                bgImage,
                isprivate: isPrivate,
                members: selectedUsers,
                setDefault: isDefault
            }, workspaceId, router);
        }

        if (success) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] text-xs bg-[#111116] border-[#e5e7eb29] text-slate-200">
                <DialogHeader>
                    <DialogTitle className="text-sm">{room ? "Edit Room" : "Create New Room"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-2 p-0">
                    <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-xs font-medium">
                            Room Name
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Room name"
                            required
                            className="h-9 text-xs placeholder:text-slate-500 border-[#e5e7eb29] bg-transparent text-slate-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent rounded-md shadow-none"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-xs font-medium">
                            Description (optional)
                        </Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add a short description..."
                            className="min-h-[90px] text-xs placeholder:text-slate-500 border-[#e5e7eb29] bg-transparent text-slate-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent rounded-md shadow-none resize-none"
                        />
                    </div>

                    <div className="h-px bg-[#e5e7eb29] my-5" />

                    {/* Room Settings Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-xs font-semibold text-white block">Make Private</Label>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Only you and invited members can access
                                </p>
                            </div>
                            <Switch
                                checked={isPrivate}
                                onCheckedChange={setIsPrivate}
                                className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-slate-700"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-xs font-semibold text-white block">Set as Default</Label>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Make this the default landing room for this space
                                </p>
                            </div>
                            <Switch
                                checked={isDefault}
                                onCheckedChange={setIsDefault}
                                className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-slate-700"
                            />
                        </div>
                    </div>

                    {isPrivate && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-500">Share with:</Label>

                                <div className="flex items-center gap-2">
                                    {/* Selected avatars */}
                                    <div className="flex -space-x-2">
                                        {selectedUsers.map((user) => {
                                            const member = spaceMembers?.find((m) => (m.userId?._id || m._id) === user._id);
                                            return (
                                                <div key={user._id} className="relative group">
                                                    <Avatar className="h-7 w-7 border-2 border-white">
                                                        {(member?.userId?.avatar || member?.avatar) ? (
                                                            <AvatarImage src={member?.userId?.avatar || member?.avatar} alt={user.name} />
                                                        ) : (
                                                            <AvatarFallback className="text-[10px] bg-[#343439] text-white">
                                                                {user?.name?.substring(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        )}
                                                    </Avatar>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className="h-7 w-7 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-0 bg-[#111116] border-[#e5e7eb29]" align="end">
                                            <div className="border-b border-[#e5e7eb29] bg-[#1a1a22] p-2">
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                                    <Input
                                                        placeholder="Search members..."
                                                        className="h-8 pl-8 pr-4 text-xs placeholder:text-slate-500 bg-transparent border-[#e5e7eb29] text-slate-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                                                        value={memberSearch}
                                                        onChange={(e) => setMemberSearch(e.target.value)}
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>

                                            <div className="max-h-[260px] overflow-y-auto">
                                                {Array.isArray(spaceMembers) &&
                                                    spaceMembers?.filter(
                                                        (m) =>
                                                            (m.userId?.name || m.name || "").toLowerCase().includes(memberSearch.toLowerCase()) ||
                                                            (m.userId?.email || m.email || "").toLowerCase().includes(memberSearch.toLowerCase())
                                                    ).length === 0 ? (
                                                    <div className="py-8 text-center text-xs text-slate-500">
                                                        No members found
                                                    </div>
                                                ) : (
                                                    spaceMembers
                                                        .filter(
                                                            (m) =>
                                                                (m.userId?.name || m.name || "").toLowerCase().includes(memberSearch.toLowerCase()) ||
                                                                (m.userId?.email || m.email || "").toLowerCase().includes(memberSearch.toLowerCase())
                                                        )
                                                        .map((member) => {
                                                            const userId = member.userId?._id || member._id;
                                                            if (!userId) return null;
                                                            const isSelected = selectedUsers.some((u) => u._id === userId);

                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={userId}
                                                                    onClick={() => {
                                                                        if (isSelected) {
                                                                            handleRemoveUser(userId);
                                                                        } else {
                                                                            handleAddUser({
                                                                                _id: userId,
                                                                                name: member.userId?.name || member.name,
                                                                                email: member.userId?.email || member.email,
                                                                            });
                                                                        }
                                                                    }}
                                                                    className={cn(
                                                                        "flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#343439] transition-colors",
                                                                        isSelected && "bg-purple-600/10"
                                                                    )}
                                                                >
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        <Avatar className="h-6 w-6 border border-slate-200 shrink-0">
                                                                            {(member.userId?.avatar || member.avatar) ? (
                                                                                <AvatarImage src={member.userId?.avatar || member.avatar} />
                                                                            ) : (
                                                                                <AvatarFallback className="text-[10px] bg-slate-500 text-white">
                                                                                    {(member.userId?.name || member.name || "UN")?.substring(0, 2).toUpperCase()}
                                                                                </AvatarFallback>
                                                                            )}
                                                                        </Avatar>
                                                                        <div className="min-w-0">
                                                                            <div className="text-xs font-medium text-slate-200 truncate">
                                                                                {member.userId?.name || member.name}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-400 truncate">
                                                                                {member.userId?.email || member.email}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0" />
                                                                    )}
                                                                </button>
                                                            );
                                                        })
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Selected Members List with Roles */}
                    {selectedUsers.length > 0 && isPrivate && (
                        <div className="space-y-2 mt-4 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Selected Members & Roles</Label>
                            {selectedUsers.map((user) => {
                                const member = members.find(m => m.userId?._id === user._id);
                                return (
                                    <div key={user._id} className="flex items-center justify-between p-1.5 rounded-lg border border-[#e5e7eb29] bg-[#1a1a22] group">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Avatar className="h-6 w-6 border border-white">
                                                {(member?.userId?.avatar || member?.avatar) ? (
                                                    <AvatarImage src={member.userId?.avatar} alt={user.name} />
                                                ) : (
                                                    <AvatarFallback className="text-[8px] text-white bg-[#343439]">
                                                        {user?.userId?.name?.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                )}
                                            </Avatar>
                                            <div className="flex flex-col min-w-0 leading-tight">
                                                <span className="text-[11px] font-semibold text-slate-200 truncate">{user.name}</span>
                                                <span className="text-[9px] text-slate-400 truncate">{user.email}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white capitalize">
                                                        {user.role} <ChevronDown className="ml-1 h-2.5 w-2.5 opacity-50" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuPortal>
                                                    <DropdownMenuContent align="end" className="w-[110px] z-[9999]">
                                                        <DropdownMenuItem className="text-xs" onSelect={() => handleUpdateRole(user._id, "member")}>Member</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-xs" onSelect={() => handleUpdateRole(user._id, "observer")}>Observer</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-xs" onSelect={() => handleUpdateRole(user._id, "admin")}>Admin</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenuPortal>
                                            </DropdownMenu>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveUser(user._id)}
                                                className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}


                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="text-xs px-4 h-9"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || !name.trim()}
                            className="text-xs px-5 h-9 bg-purple-600 hover:bg-purple-700"
                        >
                            {isLoading && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                            {room ? "Update Room" : "Create Room"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}