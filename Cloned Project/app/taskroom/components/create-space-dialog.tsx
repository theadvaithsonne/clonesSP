"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
    X,
    Plus,
    Search,
    User,
    Users,
    Briefcase,
    Layout,
    Settings,
    Smile,
    Plane,
    Car,
    Home,
    ShoppingBag,
    Gift,
    Coffee,
    Music,
    Camera,
    Video,
    Mic,
    Gamepad2,
    Trophy,
    Globe,
    MapPin,
    Clock,
    Calendar,
    Cloud,
    Sun,
    Moon,
    Zap,
    Heart,
    Star,
    Flag,
    Bookmark,
    Tag,
    Hash,
    AlertCircle,
    HelpCircle,
    CheckCircle2,
    XCircle,
    Info,
    MoreHorizontal,
    Folder,
    File,
    Image as ImageIcon,
    ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { useParams } from "next/navigation";
import { useSpaceStore } from "@/store/taskroom/spaceStore";
import { useWorkspaceMemberStore } from "@/store/taskroom/workspaceMemberStore";
import { Loader2 } from "lucide-react";

interface CreateSpaceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    space?: any;
}

const ICONS = [
    { icon: Layout, name: "Layout" },
    { icon: Briefcase, name: "Work" },
    { icon: Users, name: "People" },
    { icon: Settings, name: "Settings" },
    { icon: Smile, name: "Smile" },
    { icon: Plane, name: "Travel" },
    { icon: Car, name: "Transport" },
    { icon: Home, name: "Home" },
    { icon: ShoppingBag, name: "Shopping" },
    { icon: Gift, name: "Gift" },
    { icon: Coffee, name: "Food" },
    { icon: Music, name: "Music" },
    { icon: Camera, name: "Photo" },
    { icon: Video, name: "Video" },
    { icon: Mic, name: "Audio" },
    { icon: Gamepad2, name: "Gaming" },
    { icon: Trophy, name: "Award" },
    { icon: Globe, name: "Web" },
    { icon: MapPin, name: "Location" },
    { icon: Clock, name: "Time" },
    { icon: Calendar, name: "Date" },
    { icon: Cloud, name: "Weather" },
    { icon: Sun, name: "Day" },
    { icon: Moon, name: "Night" },
    { icon: Zap, name: "Energy" },
    { icon: Heart, name: "Love" },
    { icon: Star, name: "Favorite" },
    { icon: Flag, name: "Goal" },
    { icon: Bookmark, name: "Save" },
    { icon: Tag, name: "Label" },
    { icon: Hash, name: "Tag" },
    { icon: AlertCircle, name: "Alert" },
    { icon: HelpCircle, name: "Help" },
    { icon: CheckCircle2, name: "Success" },
    { icon: XCircle, name: "Error" },
    { icon: Info, name: "Info" },
    { icon: Folder, name: "Directory" },
    { icon: File, name: "Document" },
    { icon: ImageIcon, name: "Image" },
];

export function CreateSpaceDialog({ open, onOpenChange, space }: CreateSpaceDialogProps) {
    const params = useParams();
    const workspaceId = params?.workspace as string;

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState<any>(null);
    const [selectedUsers, setSelectedUsers] = useState<{ _id: string, name: string, email: string, role: string }[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);
    const [color, setColor] = useState("#6366f1");
    const [memberSearch, setMemberSearch] = useState("");
    const [spaceMembers, setSpaceMembers] = useState<any[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [showAllMembers, setShowAllMembers] = useState(false);

    const { createSpace, updateSpace, isCreating } = useSpaceStore();
    const { members, fetchMembers } = useWorkspaceMemberStore();
    console.log("cxzcxczxselectedUsers", selectedUsers)
    React.useEffect(() => {
        if (open && workspaceId) {
            fetchMembers(workspaceId);
        }
    }, [open, workspaceId, fetchMembers]);
    console.log("jnkvcxjhvcxuji", space)
    React.useEffect(() => {
        if (open && space) {
            setName(space.name || "");
            setDescription(space.description || "");
            setIsPrivate(space.isprivate);
            setColor(space.color || "#6366f1");
            const iconObj = ICONS.find(i => i.name === space.icon) || null;
            setSelectedIcon(iconObj);

            // Initial sync from space object
            // setSelectedUsers(space.userData?.map((u: any) => ({
            //     _id: u._id,
            //     name: u.name,
            //     email: u.email,
            //     role: u.role || "member"
            // })) || []);

            // Fresh fetch from API
            const fetchSpaceMembers = async () => {
                setIsLoadingMembers(true);
                try {
                    const token = localStorage.getItem("garage_tok");
                    const res = await axios.get(
                        `${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members?spaceId=${space._id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (res.data?.success || res.data?.status) {
                        const membersData = res.data?.data?.data || [];
                        console.log("membersData", membersData)
                        setSpaceMembers(membersData);
                        setSelectedUsers(membersData.map((m: any) => ({
                            _id: m.userData?._id,
                            name: m.userData?.name,
                            email: m.userData?.email,
                            role: m.role || "member",
                            avatar: m.userData?.avatar || m.avatar
                        })));
                    }
                } catch (err) {
                    console.error("Failed to fetch space members", err);
                } finally {
                    setIsLoadingMembers(false);
                }
            };
            fetchSpaceMembers();
        } else if (open) {
            // Reset for create
            setName("");
            setDescription("");
            setIsPrivate(false);
            setColor("#6366f1");
            setSelectedIcon(null);
            setSelectedUsers([]);
            setSpaceMembers([]);
        }
    }, [open, space]);

    const handleCreate = async () => {
        if (!name) return;

        const payload = {
            name,
            description,
            color,
            icon: selectedIcon?.name || "Layout",
            spaceCode: name?.substring(0, 3)?.toUpperCase(),
            isprivate: isPrivate,
            workspaceId: workspaceId,
            setDefault: false,
            members: selectedUsers,
        };

        let success;
        if (space?._id) {
            success = await updateSpace(space._id, payload);
        } else {
            success = await createSpace(payload);
        }

        if (success) {
            onOpenChange(false);
            if (!space) {
                // Reset form only on create
                setName("");
                setDescription("");
                setSelectedUsers([]);
            }
        }
    };

    const handleAddUser = (user: { _id: string, name: string, email: string }) => {
        if (!selectedUsers.some((u) => u._id === user._id)) {
            setSelectedUsers([...selectedUsers, { ...user, role: "member" }]);
        }
    };

    const handleUpdateRole = (userData: string, role: string) => {
        setSelectedUsers(selectedUsers.map(u => u._id === userData ? { ...u, role } : u));
    };

    const handleRemoveUser = async (userData: string) => {
        if (space?._id) {
            // Find the member record ID from spaceMembers
            const memberRecord = spaceMembers?.find(m => (m.userData?._id || m._id) === userData);
            if (memberRecord?._id) {
                try {
                    const token = localStorage.getItem("garage_tok");
                    const res = await axios.delete(
                        `${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members/${memberRecord._id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (res.data?.success || res.data?.status) {
                        toast.success("Member removed from space");
                        setSpaceMembers(prev => prev.filter(m => m._id !== memberRecord._id));
                    }
                } catch (err) {
                    console.error("Failed to delete member", err);
                    toast.error("Failed to remove member");
                    return; // Prevent local state update if API fails
                }
            }
        }
        setSelectedUsers(selectedUsers.filter((u) => u._id !== userData));
    };

    const SelectedLucideIcon = selectedIcon ? selectedIcon.icon : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl p-0 gap-0 rounded-2xl overflow-hidden bg-[#111116] border-[#e5e7eb29] text-slate-200">
                <div className="p-6 pb-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <DialogTitle className="text-xl font-semibold text-slate-200">{space ? "Edit Space" : "Create a Space"}</DialogTitle>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                A Space represents teams, departments, or groups, each with its own Lists, workflows, and settings.
                            </p>
                        </div>
                        {/* Close button is handled by DialogContent's default X usually, but we can customize or let it be */}
                    </div>

                    <div className="mt-6 space-y-5">
                        {/* Icon & Name */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-white  tracking-wide">Icon & name</Label>
                            <div className="flex gap-3">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                                        >
                                            {SelectedLucideIcon ? (
                                                <div className="flex items-center justify-center bg-[#343439] text-white rounded-md h-full w-full">
                                                    <SelectedLucideIcon className="h-5 w-5" />
                                                </div>
                                            ) : (
                                                <span className="font-semibold text-lg">S</span>
                                            )}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[340px] p-2" align="start">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 px-1">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                                    <Input
                                                        style={{
                                                            fontSize: "12px"
                                                        }}
                                                        placeholder="Search..."
                                                        className="h-9 
    pl-9 
    text-xs 
    bg-transparent 
    border 
    border-[#e5e7eb29] 
placeholder:text-xs
    text-white
    focus:border-[#e5e7eb80]   
    focus:ring-0                 
    focus-visible:ring-0
    transition-colors
  "
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <div className="h-2 w-2 rounded-full bg-slate-400"></div>
                                                </div>
                                                <button className="h-8 w-8 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200">
                                                    <Plus className="h-4 w-4 text-slate-600" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-7 gap-1 h-[240px] overflow-y-auto pr-1">
                                                {/* Default S option */}
                                                <button
                                                    onClick={() => setSelectedIcon(null)}
                                                    className={cn(
                                                        "flex h-9 w-9 items-center justify-center rounded hover:bg-slate-100",
                                                        !selectedIcon ? "bg-[#343439] text-white hover:bg-slate-700" : "text-slate-600"
                                                    )}
                                                >
                                                    <span className="font-semibold text-xs">S</span>
                                                </button>

                                                {ICONS.map((item, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setSelectedIcon(item)}
                                                        className={cn(
                                                            "flex h-9 w-9 items-center justify-center rounded hover:bg-slate-100",
                                                            selectedIcon?.name === item.name ? "bg-[#343439] text-white hover:bg-slate-900" : "text-slate-500"
                                                        )}
                                                        title={item.name}
                                                    >
                                                        <item.icon className="h-5 w-5" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Input
                                    value={name}
                                    style={{
                                        fontSize: "12px"
                                    }}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Marketing, Engineering, HR"
                                    className="
    h-10 
    bg-transparent 
    border-[#e5e7eb29] 
    text-slate-200 
    text-xs               
    placeholder:text-xs   
    placeholder:text-slate-500 
  
  "
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-white  tracking-wide">
                                Description<span className="text-slate-500 font-normal normal-case">(optional)</span>
                            </Label>
                            <Textarea
                                value={description}
                                style={{
                                    fontSize: "12px"
                                }}
                                onChange={(e) => setDescription(e.target.value)}
                                className="resize-none min-h-[40px] text-xs bg-transparent border-[#e5e7eb29] text-slate-200  "
                            />
                        </div>

                        {/* Default Permission (Visual only per screenshot, maybe real later) */}
                        {/* The screenshot shows 'Default permission' label and 'Full edit' dropdown. 
                I'll keep it simple or skip if not strictly required, but it's in the screenshot.
            */}
                        {/* <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-slate-900">Default permission</Label>
                    <Info className="h-4 w-4 text-slate-400" />
                 </div>
                 <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                    Full edit
                 </Button>
            </div> */}
                        {/* Actually, user screenshot 1 shows it. Okay. */}


                        <div className="h-px bg-slate-100" />

                        {/* Make Private */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-xs font-semibold text-slate-200 block">Make Private</Label>
                                    <p className="text-xs text-slate-400 mt-0.5">Only you and invited members have access</p>
                                </div>
                                <Switch
                                    checked={isPrivate}
                                    onCheckedChange={setIsPrivate}
                                    className="data-[state=checked]:bg-purple-600"
                                />
                            </div>

                            {isPrivate && (
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-slate-400 font-normal">Share only with:</Label>
                                    <div className="flex items-center gap-2">
                                        {/* Selected Users Avatars */}
                                        <div className="flex -space-x-2">
                                            {selectedUsers.slice(0, 5).map((user) => {
                                                const member = members.find(m => m.userData?._id === user._id);
                                                return (
                                                    <div key={user._id} className="relative group">
                                                        <Avatar className="h-7 w-7 border-2 border-white ring-0">
                                                            {(member?.userData?.avatar || user.avatar) ? (
                                                                <AvatarImage src={member?.userData?.avatar || user.avatar} alt={user.name} />
                                                            ) : (
                                                                <AvatarFallback className="text-[10px] text-white bg-[#343439]">
                                                                    {user?.name?.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            )}
                                                        </Avatar>
                                                    </div>
                                                );
                                            })}
                                            {selectedUsers.length > 5 && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setShowAllMembers(true);
                                                    }}
                                                    className="h-7 w-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 hover:bg-slate-200 transition-colors z-10"
                                                >
                                                    +{selectedUsers.length - 5}
                                                </button>
                                            )}
                                        </div>

                                        {/* User Picker Popover */}
                                        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                                            <PopoverTrigger asChild>
                                                <button className="h-7 w-7 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors">
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0 w-[240px] overflow-hidden   bg-[#111116]   shadow-xl border border-s[#e5e7eb29]" align="end">
                                                <div className="flex flex-col h-full">
                                                    <div className="p-2 border-b   bg-[#111116] 
  text-white 
   border-[#e5e7eb29] ">
                                                        <div className="relative">
                                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                                            <Input
                                                                style={{
                                                                    fontSize: "12px"
                                                                }}
                                                                placeholder="Search members..."
                                                                className="h-8 pl-8 text-xs placeholder:text-xs  text-xs bg-transparent border-[#e5e7eb29] text-slate-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                                                                value={memberSearch}
                                                                onChange={(e) => setMemberSearch(e.target.value)}
                                                                autoFocus
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="max-h-[280px] overflow-y-auto p-1 py-1.5 custom-scrollbar">
                                                        {members.filter(m =>
                                                            m.userData?.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                                            m.userData?.email?.toLowerCase().includes(memberSearch.toLowerCase())
                                                        ).length === 0 ? (
                                                            <div className="py-6 text-center text-xs text-slate-500">No members found.</div>
                                                        ) : (
                                                            members
                                                                .filter(m =>
                                                                    m.userData?.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                                                    m.userData?.email?.toLowerCase().includes(memberSearch.toLowerCase())
                                                                )
                                                                .map((member) => {
                                                                    const userData = member.userData?._id;
                                                                    if (!userData) return null;
                                                                    const isSelected = selectedUsers.some(u => u._id === userData);

                                                                    return (
                                                                        <button
                                                                            key={userData}
                                                                            onClick={() => {
                                                                                if (isSelected) {
                                                                                    handleRemoveUser(userData);
                                                                                } else {
                                                                                    handleAddUser({
                                                                                        _id: userData,
                                                                                        name: member.userData.name,
                                                                                        email: member.userData.email
                                                                                    });
                                                                                }
                                                                            }}
                                                                            className={cn(
                                                                                "flex w-full items-center justify-between px-2 py-2 rounded-md transition-colors text-left",
                                                                            
                                                                            )}
                                                                        >
                                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                                <Avatar className="h-6 w-6 shrink-0 border border-slate-200">
                                                                                    {member.userData?.avatar ? (
                                                                                        <AvatarImage src={member.userData.avatar} />
                                                                                    ) : (
                                                                                        <AvatarFallback className="text-[9px] font-bold text-white bg-slate-500">
                                                                                            {member.userData?.name?.substring(0, 2).toUpperCase()}
                                                                                        </AvatarFallback>
                                                                                    )}
                                                                                </Avatar>
                                                                                <div className="flex flex-col min-w-0 overflow-hidden leading-tight">
                                                                                    <span className="text-[13px] font-medium text-white mb-2 truncate">{member.userData?.name}</span>
                                                                                    <span className="text-[10px] text-slate-400 truncate -mt-0.5">{member.userData?.email}</span>
                                                                                </div>
                                                                            </div>
                                                                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />}
                                                                        </button>
                                                                    )
                                                                })
                                                        )}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            )}

                            {/* Selected Users List with Roles */}
                            {selectedUsers.length > 0 && (
                                <div className="space-y-2 mt-4 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                    <Label className="text-xs font-semibold text-white   tracking-tight">Selected Members & Roles</Label>
                                    {selectedUsers.map((user) => {
                                        const member = members.find(m => m.userData?._id === user._id);
                                        return (
                                            <div key={user._id} className="flex items-center justify-between p-2 rounded-xl   bg-[#111116] 
  text-white 
  border border-[#e5e7eb29]  transition-all group">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <Avatar className="h-8 w-8 border border-white shadow-sm">
                                                        {member?.userData?.avatar ? (
                                                            <AvatarImage src={member.userData.avatar} alt={user.name} />
                                                        ) : (
                                                            <AvatarFallback className="text-[10px] text-white bg-[#343439]">
                                                                {user?.name?.substring(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        )}
                                                    </Avatar>
                                                    <div className="flex flex-col min-w-0 leading-tight">
                                                        <span className="text-[13px] font-semibold text-white truncate">{user.name}</span>
                                                        <span className="text-[10px] text-slate-400  truncate">{user.email}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] font-medium text-white   bg-[#111116] 
  text-white 
  border border-[#e5e7eb29]  hover:shadow-sm capitalize">
                                                                {user.role} <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuPortal>
                                                            <DropdownMenuContent align="end" className="w-[120px] z-[9999]">
                                                                <DropdownMenuItem className="text-xs" onSelect={() => handleUpdateRole(user._id, "member")}>Member</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-xs" onSelect={() => handleUpdateRole(user._id, "observer")}>Observer</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-xs" onSelect={() => handleUpdateRole(user._id, "admin")}>Admin</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenuPortal>
                                                    </DropdownMenu>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveUser(user._id)}
                                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-[#e5e7eb29]">
                    {/* <button className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
                        Use Templates
                    </button> */}
                    <Button
                        onClick={handleCreate}
                        disabled={isCreating || !name}
                        className="bg-slate-900 hover:bg-[#343439] text-white font-medium px-6 min-w-[100px]"
                    >
                        {isCreating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            space ? "Apply changes" : "Continue"
                        )}
                    </Button>
                </div>
            </DialogContent>
            <AllMembersDialog
                open={showAllMembers}
                onOpenChange={setShowAllMembers}
                members={selectedUsers}
            />
        </Dialog>
    );
}

// Separate component for showing all members to keep it clean
function AllMembersDialog({ open, onOpenChange, members }: { open: boolean, onOpenChange: (open: boolean) => void, members: any[] }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-xs font-bold text-slate-900">Space Members</h3>
                        <p className="text-[10px] text-slate-500">{members.length} people have access to this space</p>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {members.map((user) => (
                        <div key={user._id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-slate-100 shadow-sm">
                                    {(user.userData?.avatar || user.avatar) ? (
                                        <AvatarImage src={user.userData?.avatar || user.avatar} alt={user.name || user.userData?.name} />
                                    ) : (
                                        <AvatarFallback className="bg-[#343439] text-white text-xs font-bold">
                                            {(user.name || user.userData?.name || "UN")?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                                <div className="flex flex-col leading-tight">
                                    <span className="text-xs font-bold text-slate-800">{user.name || user.userData?.name}</span>
                                    <span className="text-[11px] text-slate-400">{user.email || user.userData?.email}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 capitalize border border-slate-200">
                                    {user.role || "member"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="h-8 text-xs font-semibold rounded-lg"
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
