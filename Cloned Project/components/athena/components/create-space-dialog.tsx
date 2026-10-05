"use client";

import React, { useState, useEffect, useRef } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import Cookies from "js-cookie"
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
    ImagePlus,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { useParams, useSearchParams } from "next/navigation";
import { useSpaceStore } from "@/store/taskroom/spaceStore";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";

import { useWorkspaceMemberStore } from "@/store/taskroom/workspaceMemberStore";

const API_URL = "https://uatapi.garage.app";

interface CreateSpaceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    space?: any;
}


export function CreateSpaceDialog({ open, onOpenChange, space }: CreateSpaceDialogProps) {
    const { currentWorkspace } = useTaskroomWorkspacetore();
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get("shareTask") ? searchParams.get('workspaceId') : currentWorkspace?._id;

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setisPrivate] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<{ _id: string, name: string, email: string, role: string }[]>([]);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState("");
    const [isUploadingIcon, setIsUploadingIcon] = useState(false);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [color, setColor] = useState("#6366f1");
    const [memberSearch, setMemberSearch] = useState("");
    const [spaceMembers, setSpaceMembers] = useState<any[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [showAllMembers, setShowAllMembers] = useState(false);
    const [UserId, setUserId] = useState("");
    const { createSpace, updateSpace, isCreating } = useSpaceStore();

    const isValidImageUrl = (value: string) => typeof value === "string" && /^https?:\/\//i.test(value);

    const getIconUrl = (image: any) => {
        if (!image) return "";
        if (typeof image === "string") return image;
        if (typeof image === "object") return image.url || image.value || image.path || "";
        return "";
    };

    const getBooleanValue = (value: any) => {
        if (typeof value === "boolean") return value;
        if (typeof value === "object" && value !== null) return Boolean(value.value ?? value.isPrivate ?? value.enabled ?? value);
        return Boolean(value);
    };

    const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Images only");
            return;
        }
        setIconFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setIconPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const uploadIconToS3 = async (file: File): Promise<string> => {
        const token = localStorage.getItem("garage_tok");
        if (!token) throw new Error("Auth token missing");
        const fd = new FormData();
        fd.append("files", file);
        fd.append("folder", "space-icons");
        const res = await fetch(`${API_URL}/api/s3upload/multiple`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const json = await res.json();
        if (!json.success || !json.data?.[0]?.url) throw new Error("Invalid upload response");
        return json.data[0].url as string;
    };

    const removeIcon = () => {
        setIconFile(null);
        setIconPreview("");
        if (iconInputRef.current) iconInputRef.current.value = "";
    };
    const { members, fetchMembers } = useWorkspaceMemberStore();
    console.log("cxzcxczxselectedUsers", selectedUsers)
    React.useEffect(() => {
        if (open && workspaceId) {
            fetchMembers(workspaceId);
        }
    }, [open, workspaceId, fetchMembers]);



    useEffect(() => {
        const userData = Cookies.get("TaskRoomUserDetails")
        if (userData) {
            try {
                const parsedData = JSON.parse(userData)
                if (parsedData?._id) {

                    setUserId(parsedData._id)

                }

            } catch (error) {
                console.error("Error parsing userData:", error)
            }
        }
    }, [])


    console.log("jnkvcxjhvcxuji", space)
    React.useEffect(() => {
        if (open && space) {
            setName(space.name || "");
            setDescription(space.description || "");
            setisPrivate(getBooleanValue(space.isPrivate));
            setColor(space.color || "#6366f1");
            const iconValue = getIconUrl(space?.image);
            setIconPreview(isValidImageUrl(iconValue) ? iconValue : "");
            setIconFile(null);

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
            setisPrivate(false);
            setColor("#6366f1");
            setIconFile(null);
            setIconPreview("");
            setSelectedUsers([]);
            setSpaceMembers([]);
        }
    }, [open, space]);

    const handleCreate = async () => {
        if (!name) return;

        let iconUrl = iconPreview;
        if (iconFile) {
            setIsUploadingIcon(true);
            try {
                iconUrl = await uploadIconToS3(iconFile);
                setIconPreview(iconUrl);
            } catch (error: any) {
                toast.error(error?.message || "Failed to upload image");
                setIsUploadingIcon(false);
                return;
            } finally {
                setIsUploadingIcon(false);
            }
        }

        const payload = {
            name,
            description,
            color,
            image: iconUrl || getIconUrl(space?.image) || "Layout",
            spaceCode: name?.substring(0, 3)?.toUpperCase(),
            isPrivate: isPrivate,
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-1rem)] max-w-xl max-h-[90dvh] overflow-y-auto p-0 gap-0 rounded-2xl bg-[#161616] border-[#161616] text-white">
                <div className="p-4 sm:p-6 pb-4 sm:pt-3 pt-3">
                    <div className="flex items-start justify-between">
                        <div>
                            <DialogTitle className="text-[16px] font-semibold text-white">{space ? "Edit Space" : "Create a Space"}</DialogTitle>
                            <p className="text-[12px] text-white/50 mt-1 leading-relaxed">
                                A Space represents teams, departments, or groups, each with its own Lists, workflows, and settings.
                            </p>
                        </div>
                        {/* Close button is handled by DialogContent's default X usually, but we can customize or let it be */}
                    </div>

                    <div className="mt-4 space-y-5">
                        {/* Icon & Name */}
                        <div className="space-y-2">
                            <Label className="text-[12px] text-white font-mediu font-semibold tracking-wide">Icon & name</Label>
                            <div className="flex gap-3 items-center">
                                <button
                                    type="button"
                                    onClick={() => iconInputRef.current?.click()}
                                    className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.08] transition-colors overflow-hidden"
                                >
                                    {iconPreview ? (
                                        <img src={iconPreview} alt="Space image" className="h-full w-full object-cover" />
                                    ) : (
                                        <ImagePlus className="w-5 h-5 text-white/40" />
                                    )}
                                </button>

                                <Input
                                    value={name}
                                    style={{
                                        fontSize: "12px"
                                    }}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Marketing, Engineering, HR"
                                    className="h-10 bg-transparent border-[#e5e7eb29] text-white text-[12px] text-white/50 placeholder:text-[12px] placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#e5e7eb29]"
                                />
                                {iconPreview && (
                                    <button type="button" onClick={removeIcon} className="text-white/40 hover:text-white transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                                <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconSelect} />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label className="text-[12px] font-semibold text-white  tracking-wide">
                                Description<span className="text-white  font-normal normal-case">(optional)</span>
                            </Label>
                            <Textarea
                                value={description}
                                style={{
                                    fontSize: "12px"
                                }}
                                onChange={(e) => setDescription(e.target.value)}
                                className="resize-none min-h-[40px] text-[12px] bg-transparent border-[#e5e7eb29] text-white focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#e5e7eb29]"
                            />
                        </div>

                        {/* Default Permission (Visual only per screenshot, maybe real later) */}
                        {/* The screenshot shows 'Default permission' label and 'Full edit' dropdown. 
                I'll keep it simple or skip if not strictly required, but it's in the screenshot.
            */}
                        {/* <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Label className="text-[12px] font-medium text-neutral-400">Default permission</Label>
                    <Info className="h-4 w-4 text-white/50" />
                 </div>
                 <Button variant="outline" size="sm" className="h-8 text-[12px] font-normal">
                    Full edit
                 </Button>
            </div> */}
                        {/* Actually, user screenshot 1 shows it. Okay. */}


                        {/* <div className="h-px bg-slate-100" /> */}

                        {/* Make Private */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-[12px] font-semibold text-white block">Make Private</Label>
                                    <p className="text-[12px] text-white/50 mt-0.5">Only you and invited members have access</p>
                                </div>
                                <Switch
                                    checked={isPrivate}
                                    onCheckedChange={setisPrivate}
                                    className="data-[state=checked]:bg-brand"
                                />
                            </div>

                            {/* {isPrivate && (
                                <div className="flex items-center justify-between">
                                    <Label className="text-[12px] text-white/50 font-normal">Share only with:</Label>
                                    <div className="flex items-center gap-2">
                             
                                        <div className="flex -space-x-2">
                                            {selectedUsers
                                                .filter(user => user?._id !== UserId)
                                                .slice(0, 5)
                                                .map((user) => (
                                                    <div key={user._id} className="relative group">
                                                        <Avatar className="h-7 w-7 border-2 border-white ring-0">
                                                            <AvatarFallback className="text-[10px] text-white bg-[#343439]">
                                                                {user?.name?.substring(0, 2).toUpperCase() || '??'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                ))}
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

                                        
                                        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                                            <PopoverTrigger asChild>
                                                <button className="h-7 w-7 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-white/50 hover:border-slate-400 hover:text-white/50  transition-colors">
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0 w-[240px] overflow-hidden   bg-[#161616]   shadow-xl border border-s[#e5e7eb29]" align="end">
                                                <div className="flex flex-col h-full">
                                                    <div className="p-2 border-b   bg-[#161616] 
  text-white 
   border-[#e5e7eb29] ">
                                                        <div className="relative">
                                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/50" />
                                                            <Input
                                                                style={{
                                                                    fontSize: "12px"
                                                                }}
                                                                placeholder="Search members..."
                                                                className="h-8 pl-8 text-[12px] placeholder:text-[12px]  text-[12px] bg-transparent border-[#e5e7eb29] text-white focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                                                                value={memberSearch}
                                                                onChange={(e) => setMemberSearch(e.target.value)}
                                                                autoFocus
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="max-h-[280px] overflow-y-auto p-1 py-1.5 custom-scrollbar">
                                                        {members.filter(m =>
                                                            (m.userData?._id !== UserId) &&
                                                            (m.userData?.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                                                m.userData?.email?.toLowerCase().includes(memberSearch.toLowerCase()))
                                                        ).length === 0 ? (
                                                            <div className="py-6 text-center text-[12px] text-neutral-400">No members found.</div>
                                                        ) : (
                                                            members
                                                                .filter(m =>
                                                                    (m.userData?._id !== UserId) &&
                                                                    (m.userData?.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                                                        m.userData?.email?.toLowerCase().includes(memberSearch.toLowerCase()))
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
                                                                                    <span className="text-[10px] text-white/50 truncate -mt-0.5">{member.userData?.email}</span>
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
                            )} */}


                            {/* {selectedUsers.length > 0 && (
                                <div className="space-y-2 mt-4 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                    <Label className="text-[12px] font-semibold text-white   tracking-tight">Selected Members & Roles</Label>
                                    {selectedUsers?.filter(user => user?._id !== UserId).map((user) => {
                                        const member = members.find(m => m.userData?._id === user._id);
                                        return (
                                            <div key={user._id} className="flex items-center justify-between p-2 rounded-xl   bg-[#161616] 
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
                                                        <span className="text-[10px] text-white/50  truncate">{user.email}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] font-medium text-white   bg-[#161616] 
  text-white 
  border border-[#e5e7eb29]  hover:shadow-sm capitalize">
                                                                {user.role} <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuPortal>
                                                            <DropdownMenuContent align="end" className="w-[120px] z-[9999]">
                                                                <DropdownMenuItem className="text-[12px]" onSelect={() => handleUpdateRole(user._id, "member")}>Member</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-[12px]" onSelect={() => handleUpdateRole(user._id, "observer")}>Observer</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-[12px]" onSelect={() => handleUpdateRole(user._id, "admin")}>Admin</DropdownMenuItem>
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
                            )} */}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 sm:px-6 py-4 flex items-center justify-end border-t border-[#e5e7eb29]">
                    {/* <button className="text-[12px] font-medium text-white/50  hover:text-slate-700 transition-colors">
                        Use Templates
                    </button> */}
                    <Button
                        onClick={handleCreate}
                        disabled={isCreating || !name}
                        className="bg-brand cursor-pointer hover:bg-brand border border-brand text-brand-foreground font-semibold px-6 min-w-[100px] w-full sm:w-auto h-10 sm:h-9"
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
            <DialogContent className="w-[calc(100%-1rem)] max-w-md max-h-[90dvh] overflow-y-auto p-0 rounded-2xl bg-[#161616] border border-[#e5e7eb29] shadow-2xl">
                <div className="p-4 border-b border-[#e5e7eb29]  flex items-center justify-between bg-[#161616]">
                    <div>
                        <h3 className="text-[14px] font-bold text-white">Space Members</h3>
                        <p className="text-[10px] text-neutral-400">{members.length} people have access to this space</p>
                    </div>
                    {/* <button
                        onClick={() => onOpenChange(false)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        <X size={18} className="text-neutral-400" />
                    </button> */}
                </div>
                <div className="max-h-[400px] overflow-y-auto p-4  pt-0 space-y-4 custom-scrollbar">
                    {members.map((user) => (
                        <div key={user._id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-[#e5e7eb29]  shadow-sm">
                                    {(user.userData?.avatar || user.avatar) ? (
                                        <AvatarImage src={user.userData?.avatar || user.avatar} alt={user.name || user.userData?.name} />
                                    ) : (
                                        <AvatarFallback className="bg-[#343439] text-white text-[12px] font-semi">
                                            {(user.name || user.userData?.name || "UN")?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                                <div className="flex flex-col leading-tight">
                                    <span className="text-[12px] font-semi text-white">{user.name || user.userData?.name}</span>
                                    <span className="text-[11px] text-white/50">{user.email || user.userData?.email}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-[#343439] rounded-full text-[10px] font-semi text-white/50  capitalize border border-[#e5e7eb29]">
                                    {user.role || "member"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-[#161616] border-t border-[#e5e7eb29]  flex justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="h-8 text-[12px] font-semi cursor-pointer  rounded-lg border-[#e5e7eb29]"
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
