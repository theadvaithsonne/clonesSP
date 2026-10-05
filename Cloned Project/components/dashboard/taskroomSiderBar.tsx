"use client";

import React, { useState, useEffect } from "react";
import {
    Plus,
    Inbox,
    MessageSquareReply,
    MessageCircle,
    CheckSquare,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    LayoutList,
    CalendarDays, PlusIcon,
    FolderKanban,
    FolderOpen,
    Lock,
    FileText,
    Search,
    SlidersHorizontal,
    Star,

    Home,
    ChevronDown, SquareArrowLeft,
    ChevronUp,
    Edit,
    Trash2,
    Users,
    Settings,
    ClipboardClock,
    ArrowDownUp,
    UserCheck,
} from "lucide-react";
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { CreateSpaceDialog } from "../athena/components/create-space-dialog";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
// import Fixedsidebar from './fixed-sidebar'
import { useUIStoreAthena } from '@/store/athena/uiStore'
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskroomWorkspacetore, Room } from "@/store/taskroom/taskroomWorkspace";
import { CreateRoomDialog } from "../athena/components/create-room-dialog";
import { useSpaceStore } from "@/store/taskroom/spaceStore";

import { useTemplateStore } from "@/store/taskroom/templateStore";

import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';
import { useUserStore } from '@/store/athena/userStore';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useBoardStore } from "@/store/athena/boardStore"
import { useMobileSidebar } from "@/lib/mobile-sidebar-context";

import { useDashboardStore } from "@/store/athena/dashboardStore";
import { SpaceMembersDialog } from "../athena/components/space-members-dialog";
import { RoomMembersDialog } from "../athena/components/room-members-dialog";
export interface Card {
    _id: string
    name: string
    userId?: string
    isOverDue?: boolean
    isCompleted?: boolean
    description: string
    tags: string[]
    tagData: Array<{ _id: string; name: string; color: string }>
    members: Array<{ _id: string; name: string; email: string }>
    dueDate?: string | number | undefined;
    startDate?: string | number | undefined;
    checklist?: { completed: number; total: number }
    commentCount?: number
    comments?: Array<{
        id: string
        user: { name: string; initials: string; bg: string }
        text: string
        createdAt: string
    }>
    priority?: string
    timeEstimate?: number
    stageId: string
    assignedToIds?: string[]
    subTaskCount?: number
    TaskDataCount?: {
        totalChildCount?: number
        totalCompletedChildCount?: number
    }
    attachments?: Array<{
        fileLink?: string
        fileName?: string
        fileType?: "document" | "image" | "video"
        comment?: string

        dueDate?: string | number;

    }>
}

export interface Column {
    _id: string
    name: string
    roomId: string
    userId: string
    cards: Card[]
    taskCount?: number
    localCardCount?: number
    stageType: string
    orderId: number
    color: string
}

const transformCard = (card: any, stageId: string): Card => ({
    _id: card?._id,
    name: card?.title,
    userId: card?.userId,
    description: card?.description || "",
    tags: card?.tags || [],
    tagData: card?.tagData || [],
    members: card?.assigneeData ? card.assigneeData : [],
    dueDate: card?.dueDate,
    startDate: card?.startDate,
    checklist: card?.checklist ? card.checklist || [] : [],
    isOverDue: card?.isOverDue,
    isCompleted: card?.isCompleted,
    priority: card?.priority,
    comments: [],
    commentCount: card?.commentCount,
    timeEstimate: card?.timeEstimate,
    subTaskCount: card?.subTaskCount,
    stageId: stageId,
    assignedToIds: card?.assignedToIds ? card.assignedToIds || [] : [],
    TaskDataCount: {
        totalChildCount: card?.TaskDataCount?.totalChildCount ?? 0,
        totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0
    }
});
const transformStage = (stage: any): Column => ({
    _id: stage._id,
    name: stage.name,
    userId: stage?.userId,
    roomId: stage?.roomId,
    cards: (stage.cardData || []).map((card: any) => transformCard(card, stage._id)),
    taskCount: stage.taskCount || 0,
    localCardCount: stage.taskCount || 0,
    stageType: stage?.stageType,
    orderId: stage?.orderId,
    color: stage?.color
});

export function TaskroomSidebar({ setActiveItem, setActivePopover }) {
    // const collapsed = useUIStore((state) => state.sidebarCollapsed);
    // const toggle = useUIStore((state) => state.toggleSidebar);
    const {
        workspaces,
        spaceData: allSpaceData,
        isLoading: isSpacesLoading,
        fetchspaces, fetchWorkspaces,
        showCreateSpace,
        setShowCreateSpace,
        spaceMetadata,
        loadingWorkspaceSpaces
    } = useWorkspaceStore();
    const pathname = usePathname();

    const isActive = (path: string) => pathname?.startsWith(path);

    const [isSpaceListOpen, setIsSpaceListOpen] = useState(true);
    const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({});
    const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({});
    const { rooms, roomMetadata, fetchRooms, loadingSpaces, isRoomLoading: isRoomsLoading, deleteRoom, getRoomById, setCurrentRoomDetail, currentRoomDetail } = useTaskroomWorkspacetore();
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [showAddPeople, setShowAddPeople] = useState(false);
    const [showAddPeopleToRoom, setShowAddPeopleToRoom] = useState(false);
    const [activeSpaceForPeople, setActiveSpaceForPeople] = useState<any>(null);
    const [activeRoomForPeople, setActiveRoomForPeople] = useState<any>(null);
    const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [editingSpace, setEditingSpace] = useState<any>(null);
    const { deleteSpace } = useSpaceStore();
    const { space } = useParams()
    const searchParams = useSearchParams();
    const { isLoadingCurrentWorkspace, isLoadingWorkspacesAndSpaceAndRooms, fetchWorkspacesAndSpaceAndRooms, currentWorkspace, fetchWorkspaceById } = useWorkspaceStore();
    const workspaceId = searchParams.get("workspaceId") || currentWorkspace?._id;
    const Idspace = searchParams.get("spaceId") || currentRoomDetail?.spaceId;
    const roomId = searchParams.get("roomId") || currentRoomDetail?._id;
    const spaceData = workspaceId ? allSpaceData[workspaceId as string] || [] : [];
    const router = useRouter();

    console.log("1111111111111111111pathnamespaceData", currentWorkspace)
    const { fetchBoardDetails } = useBoardStore()


    const columns = useDashboardStore(state => state.columns) as Column[]
    const setColumns = useDashboardStore(state => state.setColumns)
    const isFetchingColumns = useDashboardStore(state => state.isFetchingColumns)
    const setIsFetchingColumns = useDashboardStore(state => state.setIsFetchingColumns)

    const { projectActiveItem, setProjectActiveItem } = useTaskroomWorkspacetore();
    const { closeMobileSidebar, isMobileSidebarOpen } = useMobileSidebar();

    const fetchUserProfile = useUserStore((state) => state.fetchUserProfile);
    const isUserProfileFetched = useUserStore((state) => state.isUserProfileFetched);
    const { setIsOpenTempate, setCurrentRoom } = useTemplateStore();






    useEffect(() => {
        const shareTaskId = searchParams.get("shareTask");
        if (shareTaskId && roomId && Idspace) {
            setColumns([]);
            setIsFetchingColumns(true);

            getRoomById(roomId).then((room) => {
                if (room) {
                    setCurrentRoomDetail(room);
                }
            });

            fetchBoardDetails(roomId, 1, 30, "ascs").then((data: any) => {
                if (data && Array.isArray(data)) {
                    setProjectActiveItem("DashMangement")
                    setColumns(data.map(transformStage));
                    toggleSpace(Idspace)
                }
            }).finally(() => {
                setIsFetchingColumns(false);
            });
        }
    }, []);


    console.log("projectActiveItem", projectActiveItem)
    const toggleRoom = async (room) => {


        if (room?._id) {
            setColumns([]);
            setIsFetchingColumns(true);
            // Fetch page 1
            fetchBoardDetails(room?._id, 1, 30, "ascs").then((data: any) => {
                if (data && Array.isArray(data)) {
                    // router.push(`?workspaceId=${workspaceId as string}&spaceId=${room?.spaceId}&roomId=${room._id}`)
                    // setActivePopover("Taskroom")
                    setCurrentRoomDetail(room)
                    setProjectActiveItem("DashMangement")
                    setColumns(data.map(transformStage));
                    if (isMobileSidebarOpen) {
                        closeMobileSidebar();
                    }

                }
            }).finally(() => {
                setIsFetchingColumns(false);

            });
            // fetchTags(boardId); // Removed as tags come with board details now
        }




    }

    const toggleWorkspace = async (wsId: string) => {
        const isExpanded = !expandedWorkspaces[wsId];
        setExpandedWorkspaces(prev => ({
            ...prev,
            [wsId]: isExpanded,
        }));
        if (isExpanded) {
            await fetchspaces(wsId);
        }
    };

    const toggleSpace = (spaceId: string) => {
        const isExpanded = !expandedSpaces[spaceId];

        setExpandedSpaces(prev => ({
            ...prev,
            [spaceId]: isExpanded,
        }));

        if (isExpanded) {
            fetchRooms(spaceId, 1);
        }
    };
    const handleCreateRoom = (spaceId: string) => {
        setActiveSpaceId(spaceId);
        setEditingRoom(null);
        setShowCreateRoom(true);
    };

    const handleEditRoom = (room: Room) => {
        console.log("handleEditRoom", room)
        setEditingRoom(room);
        setActiveSpaceId(room.spaceId);
        setShowCreateRoom(true);
    };

    const handleEditSpace = (space: any) => {
        console.log("currentSpaces2342343", space)
        setEditingSpace(space);
        setShowCreateSpace(true);
    };

    const handleAddPeople = (space: any) => {
        setActiveSpaceForPeople(space);
        setShowAddPeople(true);
    };

    const handleAddPeopleToRoom = (room: Room, spaceId: string) => {
        setActiveRoomForPeople(room);
        setActiveSpaceId(spaceId);
        setShowAddPeopleToRoom(true);
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

    // useEffect(() => {
    //     if (!workspaceId) return;
    //     fetchWorkspaceById(workspaceId);
    //     fetchspaces(workspaceId);
    // }, [workspaceId, fetchWorkspaceById, fetchspaces]);




    // useEffect(() => {
    //     async function initialize() {
    //         try {
    //             // 1. Verify User
    //             const token = localStorage.getItem("garage_tok");
    //             if (!token) {
    //                 alert("token");
    //                 return;
    //             }

    //             const res = await fetch(
    //                 `${process.env.NEXT_PUBLIC_TASKROOM_URL}users/profile`,
    //                 {
    //                     headers: { Authorization: `Bearer ${token}` },
    //                 }
    //             );

    //             if (!res.ok) {
    //                 alert("api failed");
    //                 return;
    //             }

    //             const data = await res?.json();
    //             const result = data?.data;
    //             Cookies.set("TaskRoomUserDetails", JSON.stringify(result));

    //             // 2. Fetch Workspace Data (if applicable)
    //             if (workspaceId) {
    //                 await fetchWorkspaceById(workspaceId);
    //             }

    //             if (!pathname.includes('settings')) {
    //                 await fetchWorkspacesAndSpaceAndRooms(router, workspaceId, Idspace);
    //             }



    //         } catch (err) {
    //             console.error("Initialization failed:", err);

    //         }
    //     }

    //     initialize();
    // }, []); 

    useEffect(() => {
        if (!Idspace) return;
        setExpandedSpaces((prev) => ({
            ...prev,
            [Idspace]: true,
        }));

        fetchRooms(Idspace);
    }, [Idspace]);


    console.log("spaceDatavvcvcbvbc", rooms)
    // const isSettingsPage = pathname.includes('/settings');


    let activeTab: React.ReactNode;




    return (

        <div className="flex h-full w-full gap-2 overflow-hidden">

            <aside
                aria-label="Taskroom navigation"
                className="flex w-full min-w-full flex-none flex-col h-full"
            >


                {/* Header */}




                <div className="flex flex-shrink-0 items-center truncate justify-between gap-2 border-t  border-b border-[#e5e7eb29]  mb-2 px-3 py-2.5">

                 
                    {isLoadingCurrentWorkspace ? (
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-6 w-6 rounded-sm bg-[#343439]" />
                            <Skeleton className="h-5 w-24 bg-[#343439]" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 truncate">
                            <div >
                                {currentWorkspace?.image_circle_url || currentWorkspace?.image_square_url ? (
                                    <img
                                        src={currentWorkspace.image_circle_url || currentWorkspace.image_square_url}
                                        alt={currentWorkspace.name || currentWorkspace.workspacename || "Workspace logo"}
                                        className=" object-cover min-h-8 min-w-8 max-h-8 max-w-8 rounded-[5px] "
                                    />
                                ) : (
                                    <div className="flex min-h-6 min-w-6 items-center justify-center  rounded-[100px] text-[12px] font-bold text-white/70 shadow overflow-hidden" style={{ backgroundColor: currentWorkspace?.color || "green" }}>
                                        {currentWorkspace?.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <span className="text-[16px] font-semibold text-white/70 truncate"
                                title={`${currentWorkspace?.name}`}
                            >
                                {currentWorkspace?.name
                                    ? currentWorkspace?.name.charAt(0).toUpperCase() + currentWorkspace?.name.slice(1)
                                    : "Untitled"
                                }


                            </span>
                        </div>
                    )}
                    <button
                        type="button"
                        className="rounded-md p-1.5 cursor-pointer text-brand hover:bg-[#343439] hover:text-brand"
                        aria-label="Filter"
                        onClick={() => {
                            setActivePopover?.(null);
                            setActiveItem?.("taskroomsworkspace");
                        }}
                    >
                        <SquareArrowLeft className="h-4 w-4" />
                    </button>
                    {/* <div className="flex items-center gap-1">
                      
                        <button
                            type="button"
                            className="rounded-md p-1.5 text-white/70 hover:bg-[#343439] hover:text-white/70"
                            aria-label="Filter"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={toggle}
                            className="rounded-md p-1.5 text-white/70 hover:bg-[#343439] hover:text-white/70"
                            aria-label="Minimize sidebar"
                        >
                            <span className="flex -space-x-0.5">
                                <ChevronLeft className="h-4 w-4" />
                                <ChevronLeft className="h-4 w-4" />
                            </span>
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-2.5 py-1.5 text-sm font-medium text-white/70 shadow-sm hover:bg-purple-700"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Create
                        </button>
                    </div> */}
                </div>






                {/* Main nav */}
                <nav className="flex flex-1 flex-col overflow-y-auto py-2">
                    <ul className="space-y-1.5 px-2">
                        <li >
                            <NavLinkGobal
                                icon={Users}
                                label="People"
                                active={projectActiveItem == "WorkspacePeople"}
                                onClick={() => setProjectActiveItem('WorkspacePeople')}
                            />
                        </li>
                        <li>
                            <NavLinkGobal
                                icon={Settings}
                                label="Setting"
                                active={projectActiveItem === "WorkspaceSettings"}
                                onClick={() => setProjectActiveItem('WorkspaceSettings')}
                            />
                        </li>
                        <li>
                            <NavLinkGobal
                                icon={ClipboardClock}
                                label="TimeSheets"
                                active={projectActiveItem === "TimeSheets"}
                                onClick={() => setProjectActiveItem('TimeSheets')}
                            />
                        </li>
                        <li>
                            <NavLinkGobal
                                icon={UserCheck}
                                label="Assigned To Me"
                                active={projectActiveItem === "AssignedToMe"}
                                onClick={() => setProjectActiveItem('AssignedToMe')}
                            />
                        </li>
                        {/* <li>
                            <NavLinkGobal
                                icon={ArrowDownUp}
                                label="Import/Export"
                                active={projectActiveItem === "ImportExport"}
                                onClick={() => setProjectActiveItem('ImportExport')}
                            />
                        </li> */}


                        {/* <li>
                            <NavLinkGobal icon={MessageCircle} label="Assigned Comments" />
                        </li> */}
                        {/* <li>
                            <NavLinkGobal icon={CheckSquare} label="My Tasks" />
                        </li> */}
                        {/* <li>
                            <NavLink icon={FileText} label="Docs" href="/docs" active={isActive('/docs')} />
                        </li> */}
                        {/* <li>
            <NavLink icon={MoreHorizontal} label="More" />
          </li> */}
                    </ul>

                    {/* Favorites */}
                    {/* <div className="mt-4 px-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                            Favorites
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/70">
                            <Star className="h-3 w-3" />
                            Click to add favorites to your sidebar
                        </p>
                    </div> */}

                    {/* Spaces */}
                    <div className="mt-4 flex-1 min-h-0">
                        <div className="flex items-center justify-between px-3">
                            <p className="text-[13px] font-semibold uppercase tracking-wide text-[#fff]">
                                Space
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowCreateSpace(true)}
                                className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded p-1.5 text-white/70 hover:bg-[#343439] touch-manipulation"
                                aria-label="Add space"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-1 space-y-0.5 px-2">
                            {isSpacesLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                                        <Skeleton className="h-4 w-4 bg-[#343439]" />
                                        <Skeleton className="h-4 flex-1 bg-[#343439]" />
                                    </div>
                                ))
                            ) : (
                                <>
                                    {spaceData.map((space) => {
                                        if (!space._id) return null;
                                        const isExpanded = expandedSpaces[space._id];
                                        const spaceRooms = rooms[space._id] || [];
                                        const meta = roomMetadata?.[space._id!] || { totalPages: 1, currentPage: 1 };
                                        const hasMore = meta.totalPages > meta.currentPage;

                                        const firstLetter = (space.name || "S").charAt(0).toUpperCase();
                                        const color = "#e11d48";

                                        return (
                                            <div key={space._id} className="space-y-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSpace(space._id!)}
                                                    className="flex w-full truncate items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-white/70 cursor-pointer hover:bg-[#343439] "
                                                >
                                                    <span className="flex items-center gap-2 truncate">
                                                        {space?.image ? (
                                                            <img
                                                                src={space?.image}
                                                                alt={space.name}
                                                                className="h-3.5 w-3.5 flex-shrink-0 rounded-sm object-cover"
                                                            />
                                                        ) : (
                                                            <FolderKanban className="h-3.5 w-3.5 flex-shrink-0 text-white/70" />
                                                        )}
                                                        <span className=" truncate"
                                                            title={`${space.name.charAt(0).toUpperCase() + space.name.slice(1)}`}
                                                        >

                                                            {space.name
                                                                ? space.name.charAt(0).toUpperCase() + space.name.slice(1)
                                                                : "Untitled Space"
                                                            }
                                                        </span>

                                                    </span>
                                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button
                                                                    className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded p-1 text-white cursor-pointer touch-manipulation"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    aria-label="Space options"
                                                                >
                                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-32 bg-[#111116] cursor-pointer border-[#e5e7eb29]">
                                                                <DropdownMenuItem onClick={() => handleEditSpace(space)}>
                                                                    <Edit className="mr-2 h-2 w-2 text-white/70" />
                                                                    <span className="text-[11px] text-white/70">Edit</span>
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem onClick={() => handleAddPeople(space)}>
                                                                    <Edit className="mr-2 h-2 w-2 text-white/70" />
                                                                    <span className="text-[11px] text-white/70">Add People</span>
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem
                                                                    className="text-red-600 focus:text-red-600"
                                                                    onClick={() => handleDeleteSpace(space._id!)}
                                                                >
                                                                    <Trash2 className="mr-2 h-2 w-2 text-white/70" />
                                                                    <span className="text-[11px] text-white/70">Delete</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </button>

                                                {isExpanded && (
                                                    <div className="ml-1 pl-0 py-0.5 relative pt-1 space-y-2">
                                                        {/* Vertical line connecting children */}
                                                        <div className="absolute left-[8px] top-0 bottom-4 w-[1px] bg-slate-700" />
                                                        {loadingSpaces[space._id!] && spaceRooms.length === 0 ? (
                                                            Array.from({ length: 3 }).map((_, i) => (
                                                                <div key={i} className="flex i items-center gap-2 px-2 py-1.5 group relative pl-5">
                                                                    <div className="absolute left-[8px] top-[14px] w-[8px] h-[1px] bg-slate-700" />
                                                                    <Skeleton className="h-4 w-4 bg-[#343439] rounded-sm" />
                                                                    <Skeleton className="h-4 w-24 bg-[#343439]" />
                                                                </div>
                                                            ))
                                                        ) : spaceRooms.length > 0 ? (
                                                            spaceRooms.map((room) => {
                                                                const firstLetter = (room.name || "S")?.charAt(0).toUpperCase();

                                                                return (
                                                                    <div key={room._id} className="space-y-0.5 group relative pl-5  ">
                                                                        {/* L junction */}
                                                                        <div className="absolute left-[8px] top-[14px] w-[8px] h-[1px] bg-slate-700" />

                                                                        <div
                                                                            onClick={() => toggleRoom(room)}
                                                                            className={cn(
                                                                                `flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-normal transition-colors cursor-pointer 
                                                                                space-y-0.5 group relative
             hover:scale-[1.02] 
             transition-transform duration-250 ease-out
             will-change-transform
             transform-gp`,
                                                                                room?._id == roomId
                                                                                    ? "bg-[#343439] text-white font-bold"
                                                                                    : "text-white/70 hover:bg-[#343439]"
                                                                            )}
                                                                        >
                                                                            <div className="flex items-center gap-2 truncate">

                                                                                {room.bgImage ? (
                                                                                    <img
                                                                                        src={room.bgImage}
                                                                                        alt={room.name}
                                                                                        className="h-3.5 w-3.5 rounded-sm object-cover"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="flex min-h-4 min-w-4 items-center justify-center rounded-sm text-[8px] font-bold text-white/70 shadow" style={{ backgroundColor: color }}>
                                                                                        {firstLetter}
                                                                                    </div>
                                                                                )}

                                                                                <span className="truncate text-[12px]" style={{ color: room?._id === roomId ? "#fff" : undefined }}>{room.name
                                                                                    ? room.name.charAt(0).toUpperCase() + room.name.slice(1)
                                                                                    : "Untitled Space"
                                                                                }</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                                <DropdownMenu>
                                                                                    <DropdownMenuTrigger asChild>
                                                                                        <button
                                                                                            className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded p-1 text-white/70 cursor-pointer opacity-100 hover:bg-slate-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                            aria-label="Room options"
                                                                                        >
                                                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                                                        </button>
                                                                                    </DropdownMenuTrigger>
                                                                                    <DropdownMenuContent align="end" className="w-32 bg-[#111116] cursor-pointer border-[#e5e7eb29]">
                                                                                        <DropdownMenuItem onClick={() => handleEditRoom(room)}>
                                                                                            <Edit className="mr-2 h-2 w-2 text-white/70" />
                                                                                            <span className="text-[11px] text-white/70">Edit</span>
                                                                                        </DropdownMenuItem>


                                                                                        <DropdownMenuItem onClick={() => handleAddPeopleToRoom(room, room.spaceId)}>
                                                                                            <Edit className="mr-2 h-2 w-2 text-white/70" />
                                                                                            <span className="text-[11px] text-white/70">Add people</span>
                                                                                        </DropdownMenuItem>

                                                                                        <DropdownMenuItem onClick={() => {
                                                                                            setCurrentRoom({ id: room._id, name: room.name });
                                                                                            setIsOpenTempate(true);
                                                                                        }}>
                                                                                            <Edit className="mr-2 h-2 w-2 text-white/70" />
                                                                                            <span className="text-[11px] text-white/70">Template</span>
                                                                                        </DropdownMenuItem>



                                                                                        <DropdownMenuItem
                                                                                            className="text-white/70 focus:text-white/70"
                                                                                            onClick={() => handleDeleteRoom(room)}
                                                                                        >
                                                                                            <Trash2 className="mr-2 h-2 w-2 " />
                                                                                            <span className="text-[11px] text-white/70">Delete</span>
                                                                                        </DropdownMenuItem>
                                                                                    </DropdownMenuContent>
                                                                                </DropdownMenu>
                                                                            </div>
                                                                        </div>


                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="px-3 py-2 text-[11px] text-zinc-500 italic pl-6 pt-2">
                                                                No projects found
                                                            </div>
                                                        )}

                                                        {hasMore && (
                                                            <button
                                                                type="button"
                                                                onClick={() => fetchRooms(space._id!, meta.currentPage + 1)}
                                                                disabled={loadingSpaces[space._id!]}
                                                                className="mt-1 flex w-[calc(100%-16px)] ml-4 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-zinc-400 hover:bg-[#343439] hover:text-white/70 group relative disabled:opacity-50"
                                                            >
                                                                <div className="absolute -left-[8px] top-[14px] w-[8px] h-[1px] bg-slate-700" />
                                                                <ChevronDown className="h-3.5 w-3.5" />
                                                                {loadingSpaces[space._id!] ? 'Loading...' : 'Load More'}
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => handleCreateRoom(space._id!)}
                                                            className="mt-1 flex w-[calc(100%-16px)] ml-4 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-zinc-400 hover:bg-[#343439] hover:text-white/70 group relative"
                                                        >
                                                            <div className="absolute cursor-pointer -left-[8px] top-[14px] w-[8px] h-[1px] bg-slate-700" />
                                                            <Plus className="h-3.5 w-3.5" />
                                                            New Room
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {workspaceId && spaceMetadata?.[workspaceId as string]?.totalPages > spaceMetadata?.[workspaceId as string]?.currentPage && (
                                        <button
                                            type="button"
                                            onClick={() => fetchspaces(workspaceId as string, spaceMetadata[workspaceId as string].currentPage + 1)}
                                            disabled={loadingWorkspaceSpaces?.[workspaceId as string]}
                                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-zinc-400 hover:bg-[#343439] hover:text-white/70 disabled:opacity-50 border border-zinc-700/50 border-dashed"
                                        >
                                            <ChevronDown className="h-3.5 w-3.5" />
                                            {loadingWorkspaceSpaces?.[workspaceId as string] ? 'Loading...' : 'Load More Spaces'}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Views */}
                        {/* <div className="mt-4 px-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                                Views
                            </p>
                            <ul className="mt-1 space-y-0.5">
                                <li>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-2 rounded-lg hover:bg-[#343439] px-2 py-1.5 text-left text-sm font-medium text-white/70"
                                    >
                                        <LayoutList className="h-3.5 w-3.5 text-white/70" />
                                        List
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-white/70 hover:bg-[#343439]"
                                    >
                                        <CalendarDays className="h-3.5 w-3.5 text-white/70" />
                                        Calendar
                                    </button>
                                </li>
                            </ul>
                        </div> */}

                        {/* Channels */}
                        {/* <div className="mt-4 px-3 pb-4">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                                Channels
                            </p>
                        </div> */}
                    </div>
                </nav >
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

                {showAddPeople && (
                    <SpaceMembersDialog
                        open={showAddPeople}
                        onOpenChange={setShowAddPeople}
                        space={activeSpaceForPeople}
                        workspaceId={workspaceId as string}
                    />
                )}

                {showAddPeopleToRoom && (
                    <RoomMembersDialog
                        open={showAddPeopleToRoom}
                        onOpenChange={setShowAddPeopleToRoom}
                        room={activeRoomForPeople}
                        spaceId={activeSpaceId || ""}
                    />
                )}

            </aside >






        </div >


    );
}

function NavLink({
    icon: Icon,
    label,
    active,
    badge,
    href,
    onAction,
    dropdown,
}: {
    icon: React.ElementType;
    label: string;
    active?: boolean;
    badge?: number;
    href?: string;
    onAction?: () => void;
    dropdown?: React.ReactNode;
}) {
    const content = (
        <>
            <span className="relative flex-shrink-0">
                <Icon className="h-3.5 w-3.5 text-white/70" />
                {badge !== undefined && badge > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px]  items-center justify-center rounded-full  px-1 text-[10px] font-normal text-white/70">
                        {badge}
                    </span>
                )}
            </span>
            <span className="truncate"
                style={{
                    fontWeight: "600"
                }}
            >{label}</span>
            {dropdown ? (
                <div onClick={(e) => e.stopPropagation()} className="ml-auto flex items-center">
                    {dropdown}
                </div>
            ) : onAction && (
                <div
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAction();
                    }}
                    className="ml-auto p-0.5 rounded hover:bg-[#343439] text-white/70  transition-opacity font-normal cursor-pointer"
                >
                    <MoreHorizontal className="h-3 w-3" />
                </div>
            )}
        </>
    );

    const className = cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors cursor-pointer",
        active
            ? "bg-[#343439] text-white font-bold"
            : "text-white/70 hover:bg-[#343439]"
    );

    if (href) {
        return <Link href={href} className={className}>{content}</Link>;
    }

    return (
        <button
            type="button"
            className={className}
        >
            {content}
        </button>
    );
}



function NavLinkGobal({
    icon: Icon,
    label,
    active,
    badge,
    href,
    onClick,
    onAction,
    dropdown,
}: {
    icon: React.ElementType;
    label: string;
    active?: boolean;
    badge?: number;
    href?: string;
    onClick?: () => void;
    onAction?: () => void;
    dropdown?: React.ReactNode;
}) {
    const content = (
        <>
            <span className="relative flex-shrink-0">
                <Icon className={cn("h-3.5 w-3.5 ",
                    active
                        ? "text-white font-bold"
                        : "text-white/70 "
                )}

                />
                {badge !== undefined && badge > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px]  items-center justify-center rounded-full  px-1 text-[10px] font-normal text-white/70">
                        {badge}
                    </span>
                )}
            </span>
            <span className="truncate"
                style={{
                    fontWeight: "600"
                }}
            >{label}</span>
            {dropdown ? (
                <div onClick={(e) => e.stopPropagation()} className="ml-auto flex items-center">
                    {dropdown}
                </div>
            ) : onAction && (
                <div
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAction();
                    }}
                    className="ml-auto p-0.5 rounded hover:bg-[#343439] text-white/70  transition-opacity font-normal cursor-pointer"
                >
                    <MoreHorizontal className="h-3 w-3" />
                </div>
            )}
        </>
    );

    const className = cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors cursor-pointer",
        active
            ? "bg-[#343439] text-white font-bold"
            : "text-white/70 hover:bg-[#343439]"
    );

    return (
        <button
            type="button"
            className={className}
            onClick={onClick}
        >
            {content}
        </button>
    );
}
