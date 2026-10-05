"use client";

import * as React from "react";
import { Search, UserPlus, X, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useSearchParams } from "next/navigation";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import axios from "axios";

export interface User {
    _id: string;
    name: string;
    email?: string;
    initials: string;
    color: string;
    avatar?: string;
    image?: string;
}

interface AssigneePickerProps {
    assignedToIds?: string[];
    onSelect: (ids: string[]) => void;
    children: React.ReactNode;
    roomId?: string;
    activeColor?: string;
    bgColor?: string;
    borderColor?: string;
    contentClassName?: string;
}

export function AssigneePicker({ assignedToIds = [], onSelect, children, roomId: roomIdProp, activeColor, bgColor, borderColor, contentClassName = "bg-[#0a0a0d]" }: AssigneePickerProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [users, setUsers] = React.useState<User[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isFetchingMore, setIsFetchingMore] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);

    const { currentRoomDetail } = useTaskroomWorkspacetore();
    const searchParams = useSearchParams();
    const roomId =
        roomIdProp ||
        (searchParams.get("shareTask") ? searchParams.get("roomId") : currentRoomDetail?._id);
    console.log("page <= totalPages", page, totalPages)
    const fetchMembers = React.useCallback(async (pageNum = 1, searchQuery = "") => {
        if (!roomId) return;
        if (pageNum === 1) setIsLoading(true);
        else setIsFetchingMore(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}room/members?roomId=${roomId}&search=${encodeURIComponent(searchQuery)}&page=${pageNum}&size=25`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data?.success || res.data?.status) {
                const membersData = res.data?.data?.data || res.data?.data || [];
                const metadata = res.data?.metadata;

                if (metadata && metadata.totalPages) {
                    setTotalPages(metadata.totalPages);
                }

                const formattedUsers = membersData.map((m: any) => {
                    const userData = m.userData || m.userId || m;
                    const name = userData?.name || "Unknown User";
                    const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                    const image = userData?.image || userData?.profilePicture || userData?.avatar || userData?.userAvatarUrl || userData?.photoUrl || userData?.photo || m?.image || m?.avatar || m?.profilePicture || "";
                    return {
                        _id: userData?._id || m._id,
                        name: name,
                        email: userData?.email || "",
                        initials,
                        color: "bg-[#2E2E3A]", // Default color as fallback
                        avatar: userData?.avatar || "",
                        image
                    };
                });

                if (pageNum === 1) {
                    setUsers(formattedUsers);
                } else {
                    setUsers(prev => {
                        const newUsers = formattedUsers.filter((nu: any) => !prev.some(pu => pu._id === nu._id));
                        return [...prev, ...newUsers];
                    });
                }
                setPage(pageNum);
            }
        } catch (err) {
            console.error("Failed to fetch room members for picker", err);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [roomId]);

    React.useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                setPage(1);
                fetchMembers(1, search);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setSearch("");
            setUsers([]);
        }
    }, [open, search, fetchMembers]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) {
            if (!isLoading && !isFetchingMore && page <= totalPages) {
                fetchMembers(page + 1, search);
            }
        }
    };

    const handleToggle = (userId: string) => {
        const newIds = assignedToIds.includes(userId)
            ? assignedToIds.filter(id => id !== userId)
            : [...assignedToIds, userId];
        onSelect(newIds);
    };

    const uniqueId = React.useId().replace(/:/g, "");
    const styleId = `assignee-picker-style-${uniqueId}`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent
                className={cn("w-72 p-0 border", contentClassName)}
                style={{ borderColor: borderColor || 'color-mix(in srgb, var(--brand) 8%, transparent)' }}
                align="start"
            >
                <style>{`
                    .${styleId}-item:hover {
                        background-color: ${bgColor || 'color-mix(in srgb, var(--brand) 8%, transparent)'} !important;
                    }
                    .${styleId}-item-assigned {
                        background-color: ${bgColor || 'color-mix(in srgb, var(--brand) 8%, transparent)'} !important;
                        border: 1px solid ${borderColor || 'color-mix(in srgb, var(--brand) 8%, transparent)'} !important;
                    }
                    .${styleId}-input:focus {
                        border-color: ${activeColor || 'var(--brand)'} !important;
                        box-shadow: 0 0 0 1px ${activeColor || 'var(--brand)'} !important;
                    }
                `}</style>
                <div className="flex flex-col p-2 gap-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50" />
                        <input
                            className={cn(
                                "h-9 w-full rounded-md border pl-8 pr-3 text-sm text-white/50 placeholder:text-white/50 focus:outline-none focus:ring-0 transition-shadow",
                                contentClassName
                            )}
                            style={{ borderColor: borderColor || 'rgba(229, 231, 235, 0.16)' }}
                            placeholder="Search or enter email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="text-[11px] font-semibold text-white/50 px-1 mt-1 uppercase tracking-wider flex items-center justify-between">
                        <span>Assignees</span>
                        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>

                    <div
                        className="flex flex-col gap-1.5 max-h-[200px] overflow-y-scroll custom-scrollbar"
                        onScroll={handleScroll}
                    >
                        {users.map(user => {
                            const isAssigned = assignedToIds.includes(user._id);
                            return (
                                <button
                                    key={user._id}
                                    onClick={() => handleToggle(user._id)}
                                    className={cn(
                                        "group flex items-center mb-1 justify-between w-full p-2 rounded-md transition-colors text-left",
                                        `${styleId}-item`,
                                        isAssigned && `${styleId}-item-assigned`
                                    )}
                                    style={{
                                        border: '1px solid transparent',
                                    }}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="relative">
                                            {user.image ? (
                                                <img
                                                    src={user.image}
                                                    alt={user.name}
                                                    className="h-7 w-7 rounded-full object-cover shadow-sm"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                        if (fallback) fallback.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white/50 shadow-sm", user.color)}
                                                style={{ display: user.image ? 'none' : 'flex' }}
                                            >
                                                {user.initials}
                                            </div>
                                            {isAssigned && (
                                                <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-[#0a0a0d] rounded-full flex items-center justify-center shadow-lg ring-2 ring-[#111116]">
                                                    <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full flex items-center justify-center">
                                                        <X className="h-1.5 w-1.5 text-white/50" strokeWidth={4} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-sm text-white/50 font-normal">
                                            {user.name}
                                        </span>
                                    </div>

                                    {isAssigned && (
                                        <div className="flex items-center gap-1.5">
                                            <div
                                                className="h-5.5 w-5.5 border rounded-sm flex items-center justify-center text-white/50 transition-colors"
                                                style={{
                                                    backgroundColor: '#0a0a0d',
                                                    borderColor: borderColor || 'rgba(229, 231, 235, 0.16)',
                                                }}
                                            >
                                                <RefreshCw className="h-3 w-3" />
                                            </div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}

                        {isFetchingMore && (
                            <div className="flex justify-center py-2">
                                <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
