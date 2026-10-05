"use client";

import React, { useState, useEffect } from "react";
import {
    Plus,
    Inbox, SquareArrowLeft,
    MessageSquareReply,
    MessageCircle,
    CheckSquare,
    MoreHorizontal, PlusIcon,
    ChevronLeft,
    ChevronRight,
    LayoutList,
    CalendarDays,
    FolderKanban,
    FolderOpen, GalleryHorizontalEnd,
    Lock,
    FileText,
    Search,
    SlidersHorizontal,
    Star,
    Users,
    Home,
    ChevronDown, X,
    ChevronUp,
    Edit,
    Trash2,
} from "lucide-react";
import { AddWorkspaceDialog } from "../athena/components/add-workspace-dialog";
import { useWorkspaceMemberStore } from "@/store/taskroom/workspaceMemberStore";
import {

    Activity,
    Settings,

    TrendingUp,
    MessageSquare,
    BarChart3,

    Users2,
    Zap,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { CreateSpaceDialog } from "../athena/components/create-space-dialog";
import { CreateRoomDialog } from "../athena/components/create-room-dialog";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
// import Fixedsidebar from './fixed-sidebar'
import { useUIStore } from "@/store/taskroom/uiStore";
import { useUIStoreAthena } from '@/store/athena/uiStore'

// import SettingSidebar from './setting-sidebar'
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskroomWorkspacetore, Room } from "@/store/taskroom/taskroomWorkspace";
import { useSpaceStore } from "@/store/taskroom/spaceStore";
// 
import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';
import { useUserStore } from '@/store/athena/userStore';
import axios from 'axios';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export function TaskroomWorkspace({ setActivePopover, setActiveItem }) {
    const collapsed = useUIStore((state) => state.sidebarCollapsed);
    const toggle = useUIStore((state) => state.toggleSidebar);
    const { showAddWorkspace, setShowAddWorkspace } = useUIStore();
    const {
        workspaces,
        spaceData,
        isLoading: isSpacesLoading,
        fetchspaces, fetchWorkspaces,
        showCreateSpace,
        setShowCreateSpace
    } = useWorkspaceStore();
    const pathname = usePathname();

    const isActive = (path: string) => pathname?.startsWith(path);

    const [isSpaceListOpen, setIsSpaceListOpen] = useState(true);
    const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({});
    const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({});
    const { rooms, fetchRooms, isRoomLoading: isRoomsLoading, deleteRoom, currentRoomDetail } = useTaskroomWorkspacetore();
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [editingSpace, setEditingSpace] = useState<any>(null);
    const { deleteSpace } = useSpaceStore();
    const { space } = useParams()
    const searchParams = useSearchParams();
    const { isLoadingWorkspacesAndSpaceAndRooms, fetchWorkspacesAndSpaceAndRooms, fetchWorkspaceById, currentWorkspace } = useWorkspaceStore();
    const workspaceId = searchParams.get("workspaceId") || currentWorkspace?._id;
    const Idspace = searchParams.get("spaceId") || currentRoomDetail?.spaceId;
    const roomId = searchParams.get("roomId") || currentRoomDetail?._id;
    const currentSpaces = workspaceId ? spaceData[workspaceId as string] || [] : [];
    const {

        fetchMembers,

    } = useWorkspaceMemberStore();
    const router = useRouter();
    const [menuactiveItem, setmenuActiveItem] = useState<string>('Projects');
    const [searchOpen, setSearchOpen] = useState(false);
    const { projectActiveItem, setProjectActiveItem } = useUIStoreAthena();

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);


    // const [searchOpen, setSearchOpen] = useState(false);

    const [expanded, setExpanded] = useState({ 1: true, 2: false });


    const toggleProject = (id) =>
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const openSearch = () => {
        setSearchOpen(true);
    };

    const closeSearch = () => {
        setSearchOpen(false);
        setSearchQuery("");
    };







    const searchWorkspacesApi = async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const baseUrl = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
            const response = await axios.get(
                `${baseUrl}workspaces/me?size=50&searchData=${encodeURIComponent(query)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (response?.data?.data) {
                setSearchResults(response.data.data);
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            console.error("Failed to search workspaces:", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchClick = () => {
        setSearchOpen(!searchOpen);
        setmenuActiveItem('Search');
        console.log('[v0] Search clicked, open:', !searchOpen);
    };

    const handleNavClick = (label: string) => {
        setmenuActiveItem(label);
        setSearchOpen(false);
        console.log('[v0] Navigated to:', label);
    };
    const fetchUserProfile = useUserStore((state) => state.fetchUserProfile);
    const isUserProfileFetched = useUserStore((state) => state.isUserProfileFetched);


    useEffect(() => {
        const shareTaskId = searchParams.get("shareTask");

        if (shareTaskId) {
            taskShareCombination()
        }
    }, [])

    console.log("pathnamespaceData", spaceData)
    const taskShareCombination = async () => {
        if (!workspaceId) return;

        useWorkspaceMemberStore.setState({ members: [], isLoading: true });
        await workspaceAndSpace(workspaceId);
        setActiveItem("Athena");
        setProjectActiveItem("DashMangement");
        setActivePopover("Taskroom");
    };

    const workspaceAndSpace = async (wsId: string) => {
        await Promise.all([
            fetchWorkspaceById(wsId),
            fetchspaces(wsId),
        ]);
    };

    const toggleWorkspace = async (wsId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("workspaceId", wsId);
        params.delete("spaceId");
        params.delete("roomId");
        // router.replace(`${pathname}?${params.toString()}`, { scroll: false });

        useWorkspaceMemberStore.setState({ members: [], isLoading: true });
        setActiveItem("Athena");
        setProjectActiveItem("WorkspacePeople");
        setActivePopover("Taskroom");
        await workspaceAndSpace(wsId);
        await fetchMembers(wsId, 1, "");


    };
    const toggleSpace = (spaceId: string) => {
        const isExpanded = !expandedSpaces[spaceId];

        setExpandedSpaces(prev => ({
            ...prev,
            [spaceId]: isExpanded,
        }));

        if (isExpanded) {
            fetchRooms(spaceId);
        }
    };
    const handleCreateRoom = (spaceId: string) => {
        setActiveSpaceId(spaceId);
        setEditingRoom(null);
        setShowCreateRoom(true);
    };
    console.log("currentSpaces", currentSpaces)
    const handleEditRoom = (room: Room) => {
        setEditingRoom(room);
        setActiveSpaceId(room.spaceId);
        setShowCreateRoom(true);
    };

    const handleEditSpace = (space: any) => {
        console.log("currentSpaces2342343", space)
        setEditingSpace(space);
        setShowCreateSpace(true);
    };

    const handleDeleteSpace = async (spaceId: string) => {
        if (confirm("Are you sure you want to delete this space?")) {
            const success = await deleteSpace(spaceId);
            if (success && workspaceId) {
                fetchspaces(workspaceId as string);
            }
        }
    };

    const handleDeleteRoom = async (room: Room) => {
        if (confirm(`Are you sure you want to delete the room "${room.name}"?`)) {
            await deleteRoom(room._id);
        }
    };


    useEffect(() => {
        const loadProfileAndWorkspaces = async () => {
            try {
                await fetchUserProfile();
                await fetchWorkspaces();
            } catch (error) {
                console.error("Failed to load user profile or workspaces:", error);
            }
        };

        loadProfileAndWorkspaces();
    }, [fetchUserProfile, fetchWorkspaces]);




    console.log("spaceDatavvcvcbvbc", rooms)



    let activeTab: React.ReactNode;

    const displayWorkspaces = searchQuery ? searchResults : workspaces;

    return (

        <div className="flex h-full w-full overflow-hidden gap-2">
            {/* <Fixedsidebar /> */}
            {/* {
        isSettingsPage 

        else
      } */}
            <aside
                aria-label="Taskroom navigation"
                className="flex w-full min-w-full flex-none flex-col h-full text-sm sm:text-base"
            >

                <div className="flex items-center justify-between px-2 pt-5 pb-4 border-t  border-white/10">
                    {/* Logo */}


                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                setActiveItem?.("");
                                // Go back to employees view instead of BackOffice default menu
                                window.dispatchEvent(new CustomEvent("sidebar:switch-to-employees"));
                            }}
                            className="flex items-center cursor-pointer justify-center p-1.5 rounded-md text-text-white/70 hover:text-white hover:bg-white/5 transition-colors duration-200"
                            aria-label="Go back"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>

                        <Image
                            src="/taskroom.png"
                            alt="Taskroom"
                            width={45}
                            height={45}

                        />
                        <span className="sm:text-[14px] text-[12px] font-semibold text-white"
                            style={{
                                position: "relative",
                                left: "-11px",
                                bottom: "-10px"
                            }}
                        >Taskroom</span>
                    </div>

                    {/* Panel toggle */}
                    {/* <button className="text-white/70 hover:text-white/70 transition-colors cursor-pointer  p-1 rounded-md hover:bg-white/5"
                        onClick={() => setActiveItem("")}
                    >
                        <GalleryHorizontalEnd size={16} strokeWidth={2} />
                    </button> */}
                </div>

                {/* Search / Create bar */}
                {/* Search / Create bar */}
                <div className="px-2 pb-3">
                    <div className="relative flex items-center gap-2">
                        {!searchOpen ? (
                            <button
                                onClick={() => setShowAddWorkspace(true)}
                                className="group flex cursor-pointer items-center justify-center gap-1.5 flex-1 text-[12px] font-medium rounded-lg px-3 py-[7px] border border-white/10 bg-white/5 text-white/70 hover:bg-white/5 hover:text-white hover:border-white/10 transition-colors"
                            >
                                <Plus size={14} strokeWidth={2.5} className="text-white/70 group-hover:text-white transition-colors" />
                                <span className="transition-colors">Create Workspace</span>
                            </button>
                        ) : (
                            <div className="flex cursor-pointer text-white/70 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-[4px]  flex-1">
                                <Search size={13} className="text-white/70 shrink-0" />
                                <input
                                    autoFocus
                                    value={searchQuery}
                                    onChange={(e) => searchWorkspacesApi(e.target.value)}
                                    placeholder="Search..."
                                    className="bg-transparent  placeholder:text-[12px] text-[12px] text-white/70 placeholder-white/70 outline-none w-full"
                                />
                            </div>
                        )}

                        <button
                            onClick={() => {
                                if (searchOpen) {
                                    setSearchOpen(false);
                                    setSearchQuery("");
                                    setSearchResults([]);
                                } else {
                                    setSearchOpen(true);
                                }
                            }}
                            className="shrink-0 w-8 h-8 cursor-pointer flex items-center justify-center rounded-lg bg-white/5 text-white/50 hover:text-white hover:bg-white/5 transition-all border border-white/10"
                        >
                            {searchOpen ? <X size={14} /> : <Search size={14} />}
                        </button>
                    </div>
                </div>










                {/* Header */}

                {/* Main nav */}
                <nav className="flex flex-col  py-2 pt-0">


                    {/* Favorites */}
                    {/* <div className="mt-4 px-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                            Favorites
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/50">
                            <Star className="h-3 w-3" />
                            Click to add favorites to your sidebar
                        </p>
                    </div> */}

                    {/* Spaces */}
                    <div className=" flex-1 min-h-0 overflow-y-auto">
                        <div className="flex items-center mt-2 justify-between px-3">
                            <p className="sm:text-[13px] mb-2 text-[12px] font-semibold uppercase tracking-wide text-brand">
                                WorkSpace
                            </p>
                            {/* <button
                                type="button"
                                onClick={() => setShowAddWorkspace(true)}
                                className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded p-1.5 text-white cursor-pointer hover:bg-[#343439] hover:text-white touch-manipulation"
                                aria-label="Add workspace"
                            >
                                <Plus className="h-4 w-4" />
                            </button> */}
                        </div>

                        <div className="mt-1  flex-1 space-y-0.5 px-2">
                            {isSpacesLoading || !isUserProfileFetched || isSearching ? (
                                // Skeleton Loader for Workspaces
                                <div className="space-y-2">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                                            <Skeleton className="h-6 w-6 rounded-sm bg-[#1e1e2d]" />
                                            <Skeleton className="h-4 w-3/4 bg-[#1e1e2d]" />
                                        </div>
                                    ))}
                                </div>
                            ) : displayWorkspaces && displayWorkspaces.length > 0 ? (
                                displayWorkspaces.map((ws) => {
                             
                                    const firstLetter = (ws?.name || ws?.workspacename || "P").charAt(0).toUpperCase();
                                    return (
                                        <div key={ws._id} className="space-y-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    toggleWorkspace(ws._id)
                                                }}
                                                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-white/50 cursor-pointer hover:bg-white/5 group transition-colors"
                                            >
                                                <span className="flex items-center gap-2 truncate">
                                                    <div
                                                        className=" rounded-[100px]"

                                                    >
                                                        {ws?.image_square_url || ws?.image_circle_url ? (
                                                            <img
                                                                src={ws?.image_square_url || ws?.image_circle_url}
                                                                alt={ws.name || ws.workspacename || "Workspace logo"}
                                                                className=" object-cover min-h-5 min-w-5 max-h-5 max-w-5 rounded-[5px] "
                                                            />
                                                        ) : (
                                                            <div
                                                                className="flex min-h-5 min-w-5 max-h-5 max-w-5 items-center justify-center rounded-[5px] text-[10px] font-medium text-white/70 group-hover:text-white shadow overflow-hidden"
                                                                style={{ backgroundColor: ws.color || '#4F46E5' }}
                                                            >
                                                                {firstLetter}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="truncate text-white/70 text-[12px] font-normal group-hover:text-white transition-colors">
                                                        {(() => {
                                                            const name = ws?.name || ws?.workspacename || "Projects";
                                                            return name?.charAt(0)?.toUpperCase() + name?.slice(1);
                                                        })()}
                                                    </span>
                                                </span>
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                // No workspaces found state
                                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                    <div className="mb-4 rounded-full bg-[#1e1e2d] p-3 text-slate-500">
                                        <FolderOpen className="h-10 w-10" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-200">No workspace found</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Get started by creating your first workspace.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddWorkspace(true)}
                                        className="mt-4 flex items-center gap-2 rounded-md bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f46e5] transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Create Workspace
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </nav>
            </aside>
            <AddWorkspaceDialog
                open={showAddWorkspace}
                onOpenChange={setShowAddWorkspace}
            />
            <CreateSpaceDialog
                open={showCreateSpace}
                onOpenChange={(open) => {
                    setShowCreateSpace(open);
                    if (!open) setEditingSpace(null);
                }}
                space={editingSpace}
            />
            <CreateRoomDialog
                open={showCreateRoom}
                onOpenChange={(open) => {
                    setShowCreateRoom(open);
                    if (!open) setEditingRoom(null);
                }}
                spaceId={activeSpaceId || undefined}
                room={editingRoom}
            />
        </div>


    );
}



function SidebarNavItem({
    icon,
    label,
    active = false,
    badge = false,
    onClick,
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 rounded transition-colors cursor-pointer',
                active
                    ? 'whitetext-white'
                    : 'text-neutral-400 hover:text-white hover:bg-[#1e1e26]'
            )}
        >
            <div className="flex items-center gap-3 flex-1">
                <div className="w-5 h-5 flex items-center justify-center">{icon}</div>
                <span className="text-sm font-medium">{label}</span>
            </div>
            {badge && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
        </button>
    );
}














