"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useUIStore } from "@/store/taskroom/uiStore";
import { AddWorkspaceDialog } from "./add-workspace-dialog";
import {
    ChevronDown,
    ChevronRight,
    Plus,
    MoreHorizontal,
    FolderKanban,
    Edit,
    Trash2,
    UserPlus,
    MoveRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { useSpaceStore } from "@/store/taskroom/spaceStore";
import { useTemplateStore } from "@/store/taskroom/templateStore";
import { useMobileSidebar } from "@/lib/mobile-sidebar-context";
import { CreateSpaceDialog } from "./create-space-dialog";

import { CreateRoomDialog } from "./create-room-dialog";

import { SpaceMembersDialog } from "./space-members-dialog";
import { RoomMembersDialog } from "./room-members-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { MoveRoomDialog } from "./move-room-dialog";

type WorkspacesMetadata = {
    count: number;
    totalPages: number;
    currentPage: number;
    nextPage: number | null;
};

function hasMoreWorkspaces(metadata?: WorkspacesMetadata | null) {
    if (!metadata) return false;
    if (metadata.nextPage != null) return true;
    return metadata.currentPage < metadata.totalPages;
}

// import { useTaskroomWorkspacetore } from "@/store/taskroom/roomStore";






// ---- Board/column shapes + transforms, needed so clicking a room can open its board ----
// (ported as-is from TaskroomSidebar.tsx so the shape matches what useDashboardStore expects)

export interface Card {
    _id: string;
    name: string;
    userId?: string;
    isOverDue?: boolean;
    isCompleted?: boolean;
    description: string;
    tags: string[];
    tagData: Array<{ _id: string; name: string; color: string }>;
    members: Array<{ _id: string; name: string; email: string }>;
    dueDate?: string | number | undefined;
    startDate?: string | number | undefined;
    checklist?: { completed: number; total: number };
    commentCount?: number;
    comments?: Array<{
        id: string;
        user: { name: string; initials: string; bg: string };
        text: string;
        createdAt: string;
    }>;
    priority?: string;
    timeEstimate?: number;
    stageId: string;
    assignedToIds?: string[];
    subTaskCount?: number;
    TaskDataCount?: {
        totalChildCount?: number;
        totalCompletedChildCount?: number;
    };
    attachments?: Array<{
        fileLink?: string;
        fileName?: string;
        fileType?: "document" | "image" | "video";
        comment?: string;
        dueDate?: string | number;
    }>;
}

export interface Column {
    _id: string;
    name: string;
    roomId: string;
    userId: string;
    cards: Card[];
    taskCount?: number;
    localCardCount?: number;
    stageType: string;
    orderId: number;
    color: string;
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
        totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0,
    },
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
    color: stage?.color,
});

// Renders a workspace's logo image if it has one, otherwise a colored initial —
// mirrors the avatar markup TaskroomSidebar uses for `currentWorkspace`.
function WorkspaceAvatar({
    workspace,
    compact,
    selected = false,
}: {
    workspace: any;
    compact?: boolean;
    selected?: boolean;
}) {
    const imageUrl = workspace?.image_circle_url || workspace?.image_square_url;
    const sizeClass = compact ? "h-4 w-4 rounded text-[10px]" : "h-4 w-4 rounded-md text-[10px]";

    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={workspace?.name || workspace?.workspacename || "Workspace logo"}
                className={cn("shrink-0 object-cover", sizeClass)}
            />
        );
    }

    return (
        <span
            className={cn(
                "flex shrink-0 items-center justify-center text-[10px]",
                selected ? "text-white/50" : "text-white/50",
                sizeClass
            )}
            style={{ backgroundColor: workspace?.color || "#6b7280" }}
        >
            {workspace?.name ? workspace.name.charAt(0).toUpperCase() : "W"}
        </span>
    );
}

function capitalize(value?: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSpaceImageUrl(image: unknown): string {
    if (!image) return "";
    const isUrl = (value: string) =>
        /^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("/");

    if (typeof image === "string") {
        return isUrl(image) ? image : "";
    }
    if (typeof image === "object" && image !== null) {
        const candidate =
            (image as { url?: string; value?: string; path?: string }).url ||
            (image as { url?: string; value?: string; path?: string }).value ||
            (image as { url?: string; value?: string; path?: string }).path ||
            "";
        return typeof candidate === "string" && isUrl(candidate) ? candidate : "";
    }
    return "";
}

function SpaceIcon({
    space,
    className,
    selected = false,
}: {
    space?: any;
    className?: string;
    selected?: boolean;
}) {
    const imageUrl = getSpaceImageUrl(space?.image) || getSpaceImageUrl(space?.icon);
    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={space?.name || "Space"}
                className={cn("h-3 w-3 shrink-0 rounded-sm object-cover", className)}
            />
        );
    }
    return (
        <FolderKanban
            className={cn(
                "h-3 w-3 shrink-0",
                selected ? "text-white/50" : "text-white/50",
                className
            )}
        />
    );
}

const DROPDOWN_PANEL_CLASS =
    "flex flex-col rounded-xl  bg-[#161616] p-3 shadow-xl shadow-black/40 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden overscroll-contain";

const DROPDOWN_SCROLL_CLASS =
    "mt-1.5 space-y-0.5 overflow-y-auto pr-0.5 min-h-0 scrollbar-thin scrollbar-thumb-white/10";

type MenuPosition = { top: number; left: number; width: number; maxHeight: number };

const MOBILE_BREAKPOINT = 640;
const DROPDOWN_Z_INDEX = 10050;
const DROPDOWN_BACKDROP_Z_INDEX = 10049;

function isNarrowViewport() {
    if (typeof window === "undefined") return false;
    return (window.visualViewport?.width ?? window.innerWidth) < MOBILE_BREAKPOINT;
}

function getAvailableDropdownHeight(anchorTop: number, bottomPadding = 16): number {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const availableBelow = viewportHeight - anchorTop - bottomPadding;
    return Math.max(140, Math.min(availableBelow, viewportHeight * 0.75));
}

function getSpaceSectionMaxHeight(panelMaxHeight: number) {
    const footerHeight = 44;
    const chromeHeight = 104;
    const scrollable = Math.max(120, panelMaxHeight - footerHeight - chromeHeight);
    return Math.floor(scrollable * (isNarrowViewport() ? 0.42 : 0.48));
}

function getMenuPosition(trigger: HTMLElement | null, minWidth = 280): MenuPosition {
    if (!trigger) return { top: 0, left: 0, width: minWidth, maxHeight: 320 };
    const rect = trigger.getBoundingClientRect();
    const padding = 12;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const narrow = viewportWidth < MOBILE_BREAKPOINT;
    const top = rect.bottom + 4;
    let width = narrow
        ? viewportWidth - padding * 2
        : Math.max(rect.width, minWidth);
    width = Math.min(width, viewportWidth - padding * 2);
    let left = narrow ? padding : rect.left;
    if (!narrow && left + width > viewportWidth - padding) {
        left = viewportWidth - padding - width;
    }
    left = Math.max(padding, left);
    return {
        top,
        left,
        width,
        maxHeight: getAvailableDropdownHeight(top),
    };
}

const TRIGGER_BTN_CLASS =
    "flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[14px] transition-all min-h-[36px] touch-manipulation w-full min-w-0 sm:min-h-[30px] sm:py-[8px] sm:px-[9px] outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-[#161616] active:bg-[#161616] [-webkit-tap-highlight-color:transparent]";

export default function WorkspaceSidebar() {
    const searchParams = useSearchParams();

    const {
        workspaces,
        currentWorkspace,
        fetchspaces,
        spaceData: allSpaceData,
        isLoadingSpace: isSpacesLoading,
        showCreateSpace,
        setShowCreateSpace,
        setCurrentWorkspace,
        fetchWorkspaces,
        workspacesMetadata,
        isLoadingWorkspaces,
        spaceMetadata,
        loadingWorkspaceSpaces,
        fetchBoardByRoomsDetails,
        setColumns,
        setIsFetchingColumns,
        activeSpaceId: storeActiveSpaceId,
        toggleSpace: setStoreActiveSpaceId,
        setProjectActiveItem,
        wsrKLoading,
        workspacesListApiResult,

    } = useTaskroomWorkspacetore();

    const {
        rooms,
        roomMetadata,
        fetchRooms,
        loadingSpaces,
        deleteRoom,
        setCurrentRoomDetail,
        currentRoomDetail,
    } = useTaskroomWorkspacetore();

    const { deleteSpace } = useSpaceStore();
    const { setIsOpenTempate, setCurrentRoom } = useTemplateStore();


    const { closeMobileSidebar } = useMobileSidebar();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSpaceDropdownOpen, setIsSpaceDropdownOpen] = useState(false);
    const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
    const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const spaceTriggerRef = useRef<HTMLButtonElement>(null);
    const roomTriggerRef = useRef<HTMLButtonElement>(null);
    const dropdownPanelRef = useRef<HTMLDivElement>(null);
    const spaceDropdownPanelRef = useRef<HTMLDivElement>(null);
    const roomDropdownPanelRef = useRef<HTMLDivElement>(null);
    const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0, width: 320, maxHeight: 320 });
    const [spaceMenuPosition, setSpaceMenuPosition] = useState<MenuPosition>({ top: 0, left: 0, width: 280, maxHeight: 280 });
    const [roomMenuPosition, setRoomMenuPosition] = useState<MenuPosition>({ top: 0, left: 0, width: 280, maxHeight: 280 });

    const updateMenuPosition = useCallback(() => {
        setMenuPosition(getMenuPosition(triggerRef.current, 320));
    }, []);

    const updateSpaceMenuPosition = useCallback(() => {
        setSpaceMenuPosition(getMenuPosition(spaceTriggerRef.current, 280));
    }, []);

    const updateRoomMenuPosition = useCallback(() => {
        setRoomMenuPosition(getMenuPosition(roomTriggerRef.current, 280));
    }, []);

    const closeAllDropdowns = useCallback(() => {
        setIsDropdownOpen(false);
        setIsSpaceDropdownOpen(false);
        setIsRoomDropdownOpen(false);
    }, []);

    const anyDropdownOpen = isDropdownOpen || isSpaceDropdownOpen || isRoomDropdownOpen;

    const refreshOpenMenuPositions = useCallback(() => {
        if (isDropdownOpen) updateMenuPosition();
        if (isSpaceDropdownOpen) updateSpaceMenuPosition();
        if (isRoomDropdownOpen) updateRoomMenuPosition();
    }, [
        isDropdownOpen,
        isSpaceDropdownOpen,
        isRoomDropdownOpen,
        updateMenuPosition,
        updateSpaceMenuPosition,
        updateRoomMenuPosition,
    ]);

    useEffect(() => {
        if (!anyDropdownOpen) return;
        const vv = window.visualViewport;
        refreshOpenMenuPositions();
        vv?.addEventListener("resize", refreshOpenMenuPositions);
        vv?.addEventListener("scroll", refreshOpenMenuPositions);
        return () => {
            vv?.removeEventListener("resize", refreshOpenMenuPositions);
            vv?.removeEventListener("scroll", refreshOpenMenuPositions);
        };
    }, [anyDropdownOpen, refreshOpenMenuPositions]);

    useEffect(() => {
        if (!isDropdownOpen) return;
        updateMenuPosition();
        window.addEventListener("resize", updateMenuPosition);
        window.addEventListener("scroll", updateMenuPosition, true);
        return () => {
            window.removeEventListener("resize", updateMenuPosition);
            window.removeEventListener("scroll", updateMenuPosition, true);
        };
    }, [isDropdownOpen, updateMenuPosition]);

    useEffect(() => {
        if (!isSpaceDropdownOpen) return;
        updateSpaceMenuPosition();
        window.addEventListener("resize", updateSpaceMenuPosition);
        window.addEventListener("scroll", updateSpaceMenuPosition, true);
        return () => {
            window.removeEventListener("resize", updateSpaceMenuPosition);
            window.removeEventListener("scroll", updateSpaceMenuPosition, true);
        };
    }, [isSpaceDropdownOpen, updateSpaceMenuPosition]);

    useEffect(() => {
        if (!isRoomDropdownOpen) return;
        updateRoomMenuPosition();
        window.addEventListener("resize", updateRoomMenuPosition);
        window.addEventListener("scroll", updateRoomMenuPosition, true);
        return () => {
            window.removeEventListener("resize", updateRoomMenuPosition);
            window.removeEventListener("scroll", updateRoomMenuPosition, true);
        };
    }, [isRoomDropdownOpen, updateRoomMenuPosition]);

    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [showAddPeople, setShowAddPeople] = useState(false);
    const [showAddPeopleToRoom, setShowAddPeopleToRoom] = useState(false);
    const [activeSpaceForPeople, setActiveSpaceForPeople] = useState<any>(null);
    const [activeRoomForPeople, setActiveRoomForPeople] = useState<any>(null);
    const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
    const [editingRoom, setEditingRoom] = useState<any | null>(null);
    const [editingSpace, setEditingSpace] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ type: "space" | "room"; id: string; name: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showMoveRoom, setShowMoveRoom] = useState(false);
    const [movingRoom, setMovingRoom] = useState<any | null>(null);
    const workspacesListRef = useRef<HTMLDivElement>(null);
    const workspacesObserverRef = useRef<HTMLDivElement>(null);

    const workspaceId = currentWorkspace?._id || searchParams.get("workspaceId");
    const roomId = currentRoomDetail?._id;
    const spaceData = workspaceId ? allSpaceData[workspaceId as string] || [] : [];
    const currentSpaceId = storeActiveSpaceId || currentRoomDetail?.spaceId;
    const currentSpace = currentSpaceId
        ? spaceData.find((space) => space._id === currentSpaceId)
        : undefined;
    const currentSpaceRooms = currentSpaceId ? rooms[currentSpaceId] || [] : [];
    const currentSpaceRoomMeta = currentSpaceId
        ? roomMetadata?.[currentSpaceId] || { totalPages: 1, currentPage: 1 }
        : { totalPages: 1, currentPage: 1 };
    const { showAddWorkspace, setShowAddWorkspace } = useUIStore();
    const apiReturnedEmptyWorkspaces = workspacesListApiResult === "empty";
    const showWorkspaceEmptyState = apiReturnedEmptyWorkspaces;
    const isWorkspaceInitialLoading =
        workspacesListApiResult === "idle" && (isLoadingWorkspaces || wsrKLoading);
    const hasAutoOpenedWorkspaceDialogRef = useRef(false);
    // Load the workspaces list so "Switch workspaces" has something to show.
    useEffect(() => {
        if (!workspaces || workspaces.length === 0) {
            fetchWorkspaces(1);
        }
    }, [workspaces.length, fetchWorkspaces]);

    useEffect(() => {
        if (workspacesListApiResult !== "empty") {
            if (workspacesListApiResult === "has_data") {
                hasAutoOpenedWorkspaceDialogRef.current = false;
            }
            return;
        }
        if (hasAutoOpenedWorkspaceDialogRef.current) return;

        hasAutoOpenedWorkspaceDialogRef.current = true;
        setShowAddWorkspace(true);
    }, [workspacesListApiResult, setShowAddWorkspace]);

    const handleOpenCreateWorkspace = useCallback(() => {
        closeAllDropdowns();
        setShowAddWorkspace(true);
    }, [closeAllDropdowns, setShowAddWorkspace]);

    const loadMoreWorkspaces = useCallback(() => {
        if (isLoadingWorkspaces) return;
        if (!hasMoreWorkspaces(workspacesMetadata)) return;
        const nextPage =
            workspacesMetadata!.nextPage ?? workspacesMetadata!.currentPage + 1;
        fetchWorkspaces(nextPage);
    }, [fetchWorkspaces, isLoadingWorkspaces, workspacesMetadata]);

    const handleWorkspacesScroll = useCallback(() => {
        const root = workspacesListRef.current;
        if (!root || isLoadingWorkspaces) return;
        if (!hasMoreWorkspaces(workspacesMetadata)) return;

        const nearBottom =
            root.scrollTop + root.clientHeight >= root.scrollHeight - 80;
        if (nearBottom) {
            loadMoreWorkspaces();
        }
    }, [isLoadingWorkspaces, workspacesMetadata, loadMoreWorkspaces]);

    useEffect(() => {
        const sentinel = workspacesObserverRef.current;
        const root = workspacesListRef.current;
        if (!sentinel || !root) return;
        if (!isDropdownOpen) return;
        if (isLoadingWorkspaces) return;
        if (!hasMoreWorkspaces(workspacesMetadata)) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry?.isIntersecting) {
                    loadMoreWorkspaces();
                }
            },
            {
                root,
                rootMargin: "0px 0px 120px 0px",
                threshold: 0,
            }
        );

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [
        isDropdownOpen,
        loadMoreWorkspaces,
        isLoadingWorkspaces,
        workspacesMetadata,
        workspaces.length,
    ]);

    useEffect(() => {
        const root = workspacesListRef.current;
        if (!root) return;
        if (!isDropdownOpen) return;
        if (isLoadingWorkspaces) return;
        if (!hasMoreWorkspaces(workspacesMetadata)) return;

        const shouldLoad =
            root.scrollHeight <= root.clientHeight ||
            root.scrollTop + root.clientHeight >= root.scrollHeight - 120;
        if (shouldLoad) {
            loadMoreWorkspaces();
        }
    }, [
        isDropdownOpen,
        workspacesMetadata,
        isLoadingWorkspaces,
        loadMoreWorkspaces,
        workspaces.length,
    ]);

    useEffect(() => {
        if (!isSpaceDropdownOpen || !workspaceId) return;
        if (!spaceData.length && !loadingWorkspaceSpaces?.[workspaceId as string]) {
            fetchspaces(workspaceId as string, 1);
        }
    }, [isSpaceDropdownOpen, workspaceId, spaceData.length, fetchspaces, loadingWorkspaceSpaces]);

    useEffect(() => {
        if (!currentSpaceId) return;

        if (isDropdownOpen) {
            setExpandedSpaces((prev) =>
                prev[currentSpaceId] ? prev : { ...prev, [currentSpaceId]: true }
            );
        }

        if (isDropdownOpen || isRoomDropdownOpen) {
            fetchRooms(currentSpaceId, 1);
        }
    }, [isDropdownOpen, isRoomDropdownOpen, currentSpaceId, fetchRooms]);

    // Load spaces for whichever workspace is currently active.
    // useEffect(() => {
    //     if (!workspaceId) return;
    //     fetchspaces(workspaceId as string);
    // }, [workspaceId]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                showCreateSpace ||
                showCreateRoom ||
                showAddWorkspace ||
                showAddPeople ||
                showAddPeopleToRoom ||
                showMoveRoom
            ) {
                return;
            }

            const target = event.target as Node;
            const path = event.composedPath?.() ?? [target];
            const isInsideDropdown =
                triggerRef.current?.contains(target) ||
                spaceTriggerRef.current?.contains(target) ||
                roomTriggerRef.current?.contains(target) ||
                dropdownPanelRef.current?.contains(target) ||
                spaceDropdownPanelRef.current?.contains(target) ||
                roomDropdownPanelRef.current?.contains(target) ||
                path.some((node) => {
                    if (!(node instanceof HTMLElement)) return false;
                    return (
                        node.closest('[data-slot="dropdown-menu-content"]') !== null ||
                        node.closest('[data-slot="dropdown-menu-portal"]') !== null ||
                        node.closest('[data-slot="dropdown-menu-trigger"]') !== null
                    );
                });

            if (!isInsideDropdown) {
                closeAllDropdowns();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [
        showCreateSpace,
        showCreateRoom,
        showAddWorkspace,
        showAddPeople,
        showAddPeopleToRoom,
        showMoveRoom,
        closeAllDropdowns,
    ]);

    const toggleSpaceExpanded = (spaceId: string) => {
        const isExpanded = !expandedSpaces[spaceId];
        setExpandedSpaces((prev) => ({ ...prev, [spaceId]: isExpanded }));
        if (isExpanded) {
            fetchRooms(spaceId, 1);
        }
    };

    const handleSelectSpace = (space: any) => {
        if (!space?._id) return;
        setStoreActiveSpaceId(space._id);
        setExpandedSpaces((prev) => ({ ...prev, [space._id]: true }));
        fetchRooms(space._id, 1, true);
        if (currentRoomDetail?.spaceId !== space._id) {
            setCurrentRoomDetail(null);
            setColumns([]);
        }
        setIsSpaceDropdownOpen(false);
        setIsRoomDropdownOpen(false);
        closeMobileSidebar();
    };

    const handleSpaceTreeClick = (space: any) => {
        if (!space?._id) return;
        setStoreActiveSpaceId(space._id);
        const isExpanded = !expandedSpaces[space._id];
        setExpandedSpaces((prev) => ({ ...prev, [space._id]: isExpanded }));
        if (isExpanded) {
            fetchRooms(space._id, 1, true);
        }
        if (currentRoomDetail?.spaceId !== space._id) {
            setCurrentRoomDetail(null);
            setColumns([]);
        }
        setIsRoomDropdownOpen(false);
    };

    const toggleRoom = async (room: any) => {
        if (!room?._id) return;
        closeAllDropdowns();
        closeMobileSidebar();
        if (room.spaceId) {
            setStoreActiveSpaceId(room.spaceId);
            setExpandedSpaces((prev) => ({ ...prev, [room.spaceId]: true }));
        }
        await setColumns([]);
        await setCurrentRoomDetail(room);
        await fetchBoardByRoomsDetails(room._id, 1, 30, "ascs");
        setProjectActiveItem("DashMangement");
        setIsRoomDropdownOpen(false);

    };

    // NOTE: TaskroomSidebar never switched between workspaces, so this is new —
    // it assumes `fetchWorkspaceById` updates `currentWorkspace` in the store.
    // Adjust if your store expects a different call to change the active workspace.
    const handleSwitchWorkspace = async (ws: any) => {
        if (!ws?._id || ws._id === currentWorkspace?._id) return;

        setExpandedSpaces({});
        setActiveSpaceId(null);
        // Clears activeSpaceId, currentRoomDetail, and columns in the store
        setCurrentWorkspace(ws);
        fetchspaces(ws._id as string);
        closeAllDropdowns();
        closeMobileSidebar();
    };

    const handleCreateRoom = (spaceId: string) => {
        closeAllDropdowns();
        setActiveSpaceId(spaceId);
        setStoreActiveSpaceId(spaceId);
        setExpandedSpaces((prev) => ({ ...prev, [spaceId]: true }));
        setEditingRoom(null);
        setShowCreateRoom(true);
    };

    const handleCreateSpace = () => {
        closeAllDropdowns();
        setEditingSpace(null);
        setShowCreateSpace(true);
    };

    const handleEditRoom = (room) => {
        closeAllDropdowns();
        setEditingRoom(room);
        setActiveSpaceId(room.spaceId);
        setShowCreateRoom(true);
    };

    const handleEditSpace = (space: any) => {
        closeAllDropdowns();
        setEditingSpace(space);
        setShowCreateSpace(true);
    };

    const handleAddPeople = (space: any) => {
        closeAllDropdowns();
        setActiveSpaceForPeople(space);
        setShowAddPeople(true);
    };

    const handleAddPeopleToRoom = (room, spaceId: string) => {
        closeAllDropdowns();
        setActiveRoomForPeople(room);
        setActiveSpaceId(spaceId);
        setShowAddPeopleToRoom(true);
    };

    const requestDeleteSpace = (space: any) => {
        closeAllDropdowns();
        setDeleteTarget({
            type: "space",
            id: space._id,
            name: space.name || "this space",
        });
    };

    const requestDeleteRoom = (room: any) => {
        closeAllDropdowns();
        setDeleteTarget({
            type: "room",
            id: room._id,
            name: room.name || "this room",
        });
    };

    const handleMoveRoom = (room: any) => {
        if (!room?._id) return;
        if (room._id === currentRoomDetail?._id || room._id === roomId) {
            toast.error("You can't move the currently selected room");
            closeAllDropdowns();
            return;
        }
        closeAllDropdowns();
        setMovingRoom(room);
        setShowMoveRoom(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            if (deleteTarget.type === "space") {
                const success = await deleteSpace(deleteTarget.id);
                if (success) setDeleteTarget(null);
            } else {
                await deleteRoom(deleteTarget.id);
                setDeleteTarget(null);
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    const renderSpaceListItems = (onSelect?: (space: any) => void, selectedId?: string | null) =>
        spaceData.map((space) => {
            if (!space._id) return null;
            const isSelected = selectedId === space._id;

            return (
                <button
                    key={space._id}
                    type="button"
                    onClick={() => (onSelect ? onSelect(space) : toggleSpaceExpanded(space._id!))}
                    className={cn(
                        "flex w-full items-center cursor-pointer justify-between gap-2 rounded-lg px-2 py-2 text-left text-[14px] font-medium transition-colors min-h-[36px] touch-manipulation sm:min-h-0 sm:py-1",
                        isSelected
                            ? "text-white/50"
                            : "text-white/50 "
                    )}
                >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <SpaceIcon space={space} selected={isSelected} />
                        <span className="truncate">
                            {space.name ? capitalize(space.name) : "Untitled Space"}
                        </span>
                    </span>
                    {!onSelect && (
                        <ChevronDown
                            className={cn(
                                "h-3 w-3 shrink-0 text-white/50 transition-transform",
                                expandedSpaces[space._id] && "rotate-180"
                            )}
                        />
                    )}
                </button>
            );
        });

    const renderRoomListItems = (
        spaceId: string,
        spaceRooms: any[],
        onSelect?: (room: any) => void
    ) =>
        spaceRooms.map((room) => {
            const firstLetter = (room.name || "R").charAt(0).toUpperCase();
            const color = "#e11d48";
            const isSelected = room?._id === roomId;

            return (
                <div
                    key={room._id}
                    className={cn(
                        "flex w-full items-center gap-1 rounded-lg px-1 py-1 text-[14px] min-h-[36px] touch-manipulation sm:min-h-0 sm:py-0.5",
                        isSelected ? "text-white/50" : "text-white/50"
                    )}
                >
                    <button
                        type="button"
                        onClick={() => (onSelect ? onSelect(room) : toggleRoom(room))}
                        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left transition-colors cursor-pointer hover:bg-[#343439]"
                    >
                        {room.bgImage ? (
                            <img
                                src={room.bgImage}
                                alt={room.name}
                                className="h-3 w-3 shrink-0 rounded-sm object-cover"
                            />
                        ) : (
                            <span
                                className="flex h-3 w-3 shrink-0 items-center justify-center rounded-sm text-[7px] font-bold text-white"
                                style={{ backgroundColor: color }}
                            >
                                {firstLetter}
                            </span>
                        )}
                        <span className="truncate">
                            {room.name ? capitalize(room.name) : "Untitled Room"}
                        </span>
                    </button>
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="flex min-h-[24px] min-w-[24px] items-center justify-center rounded p-0.5 text-white/50 cursor-pointer hover:bg-[#343439] touch-manipulation"
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Room options"
                                >
                                    <MoreHorizontal className="h-3 w-3" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-[10050] w-36 bg-[#161616] cursor-pointer border-[#e5e7eb29]">
                                <DropdownMenuItem onClick={() => handleEditRoom(room)}>
                                    <Edit className="mr-2 h-2 w-2 text-white/50" />
                                    <span className="text-[14px] text-white/50">Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddPeopleToRoom(room, spaceId)}>
                                    <UserPlus className="mr-2 h-2 w-2 text-white/50" />
                                    <span className="text-[14px] text-white/50">Add people</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={isSelected}
                                    onClick={() => {
                                        if (isSelected) return;
                                        handleMoveRoom({ ...room, spaceId: room.spaceId || spaceId });
                                    }}
                                    className={cn(isSelected && "opacity-40 pointer-events-none")}
                                >
                                    <MoveRight className="mr-2 h-2 w-2 text-white/50" />
                                    <span className="text-[14px] text-white/50">Move</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-white/50 focus:text-white/50"
                                    onClick={() => requestDeleteRoom(room)}
                                >
                                    <Trash2 className="mr-2 h-2 w-2 text-white/50" />
                                    <span className="text-[14px] text-white/50">Delete</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            );
        });

    const spaceDropdownPanel = isSpaceDropdownOpen ? (
        <div
            ref={spaceDropdownPanelRef}
            style={{
                position: "fixed",
                top: spaceMenuPosition.top,
                left: spaceMenuPosition.left,
                width: spaceMenuPosition.width,
                maxHeight: spaceMenuPosition.maxHeight,
                zIndex: DROPDOWN_Z_INDEX,
            }}
            className={DROPDOWN_PANEL_CLASS}
        >
            <div className="flex items-center justify-between px-1.5 shrink-0">
                <p className="text-[14px] font-semibold tracking-wide text-white shrink-0">
                    Spaces
                </p>
                <button
                    type="button"
                    onClick={handleCreateSpace}
                    className="flex h-6 w-6 items-center justify-center rounded text-white hover:bg-[#343439]"
                    aria-label="Add space"
                >
                    <Plus className="h-3 w-3" />
                </button>
            </div>

            <div className={cn(DROPDOWN_SCROLL_CLASS, "flex-1")}>
                {isSpacesLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1">
                            <Skeleton className="h-3 w-3 bg-[#343439]" />
                            <Skeleton className="h-3 flex-1 bg-[#343439]" />
                        </div>
                    ))
                ) : spaceData.length > 0 ? (
                    <>
                        {renderSpaceListItems(handleSelectSpace, currentSpaceId)}
                        {workspaceId &&
                            spaceMetadata?.[workspaceId as string]?.totalPages >
                            spaceMetadata?.[workspaceId as string]?.currentPage && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        fetchspaces(
                                            workspaceId as string,
                                            spaceMetadata[workspaceId as string].currentPage + 1
                                        )
                                    }
                                    disabled={loadingWorkspaceSpaces?.[workspaceId as string]}
                                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700/50 px-2 py-1 text-[14px] text-white/50 hover:bg-[#343439] hover:text-white/50 disabled:opacity-50"
                                >
                                    <ChevronDown className="h-3 w-3" />
                                    {loadingWorkspaceSpaces?.[workspaceId as string]
                                        ? "Loading..."
                                        : "Load more"}
                                </button>
                            )}
                    </>
                ) : (
                    <p className="px-2 py-2 text-[14px] italic text-zinc-500">No spaces found</p>
                )}
            </div>
        </div>
    ) : null;

    const roomDropdownPanel = isRoomDropdownOpen && currentSpaceId ? (
        <div
            ref={roomDropdownPanelRef}
            style={{
                position: "fixed",
                top: roomMenuPosition.top,
                left: roomMenuPosition.left,
                width: roomMenuPosition.width,
                maxHeight: roomMenuPosition.maxHeight,
                zIndex: DROPDOWN_Z_INDEX,
            }}
            className={DROPDOWN_PANEL_CLASS}
        >
            <div className="flex items-center justify-between px-1.5 shrink-0">
                <p className="text-[14px] font-semibold tracking-wide text-gray-500 shrink-0">
                    Rooms
                </p>
                <button
                    type="button"
                    onClick={() => handleCreateRoom(currentSpaceId)}
                    className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:bg-[#343439]"
                    aria-label="Add room"
                >
                    <Plus className="h-3 w-3" />
                </button>
            </div>

            <div className={cn(DROPDOWN_SCROLL_CLASS, "flex-1")}>
                {loadingSpaces[currentSpaceId] && currentSpaceRooms.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1">
                            <Skeleton className="h-3 w-3 bg-[#343439]" />
                            <Skeleton className="h-3 flex-1 bg-[#343439]" />
                        </div>
                    ))
                ) : currentSpaceRooms.length > 0 ? (
                    <>
                        {renderRoomListItems(currentSpaceId, currentSpaceRooms, toggleRoom)}
                        {currentSpaceRoomMeta.totalPages > currentSpaceRoomMeta.currentPage && (
                            <button
                                type="button"
                                onClick={() =>
                                    fetchRooms(currentSpaceId, currentSpaceRoomMeta.currentPage + 1)
                                }
                                disabled={loadingSpaces[currentSpaceId]}
                                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700/50 px-2 py-1 text-[14px] text-white/50 hover:bg-[#343439] hover:text-white/50 disabled:opacity-50"
                            >
                                <ChevronDown className="h-3 w-3" />
                                {loadingSpaces[currentSpaceId] ? "Loading..." : "Load more"}
                            </button>
                        )}
                    </>
                ) : (
                    <p className="px-2 py-2 text-[14px] italic text-zinc-500">No rooms found</p>
                )}
            </div>
        </div>
    ) : null;

    const spaceSectionMaxHeight = getSpaceSectionMaxHeight(menuPosition.maxHeight);

    const dropdownPanel = isDropdownOpen ? (
        <div
            ref={dropdownPanelRef}
            style={{
                position: "fixed",
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
                height: menuPosition.maxHeight,
                zIndex: DROPDOWN_Z_INDEX,
            }}
            className={DROPDOWN_PANEL_CLASS}
        >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex flex-col min-h-0 shrink-0">
                    <div className="flex items-center justify-between px-1.5 shrink-0">
                        <p className="font-semibold tracking-wide text-[14px] text-white shrink-0">
                            Space
                        </p>
                        <button
                            type="button"
                            onClick={handleCreateSpace}
                            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-white  touch-manipulation"
                            aria-label="Add space"
                        >
                            <Plus className="h-3 w-3" />
                        </button>
                    </div>

                    <div
                        className={DROPDOWN_SCROLL_CLASS}
                        style={{ maxHeight: spaceSectionMaxHeight }}
                    >
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
                                    const isSpaceSelected = space._id === currentSpaceId;
                                    const spaceRooms = rooms[space._id] || [];
                                    const meta = roomMetadata?.[space._id!] || { totalPages: 1, currentPage: 1 };
                                    const hasMore = meta.totalPages > meta.currentPage;

                                    const firstLetter = (space.name || "S").charAt(0).toUpperCase();
                                    const color = "#e11d48";

                                    return (
                                        <div key={space._id} className="space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => handleSpaceTreeClick(space)}
                                                className={cn(
                                                    "flex w-full truncate items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-[14px] cursor-pointer transition-colors",
                                                    isSpaceSelected
                                                        ? "text-white/50"
                                                        : "text-white/50 "
                                                )}
                                            >
                                                <span className="flex items-center gap-1.5 truncate">
                                                    <SpaceIcon space={space} selected={isSpaceSelected} />
                                                    <span
                                                        className="truncate"
                                                        title={`${space.name.charAt(0).toUpperCase() + space.name.slice(1)}`}
                                                    >
                                                        {space.name
                                                            ? space.name.charAt(0).toUpperCase() + space.name.slice(1)
                                                            : "Untitled Space"
                                                        }
                                                    </span>
                                                </span>
                                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu modal={false}>
                                                        <DropdownMenuTrigger asChild>
                                                            <button
                                                                className="flex min-h-[24px] min-w-[24px] items-center justify-center rounded p-0.5 text-white/50 cursor-pointer touch-manipulation opacity-100 hover:bg-[#343439]"
                                                                onClick={(e) => e.stopPropagation()}
                                                                aria-label="Space options"
                                                            >
                                                                <MoreHorizontal className="h-3 w-3" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="z-[10050] w-32 bg-[#161616] cursor-pointer border-[#e5e7eb29]">
                                                            <DropdownMenuItem onClick={() => handleEditSpace(space)}>
                                                                <Edit className="mr-2 h-2 w-2 text-white/50" />
                                                                <span className="text-[14px] text-white/50">Edit</span>
                                                            </DropdownMenuItem>

                                                            <DropdownMenuItem onClick={() => handleAddPeople(space)}>
                                                                <UserPlus className="mr-2 h-2 w-2 text-white/50" />
                                                                <span className="text-[14px] text-white/50">Add People</span>
                                                            </DropdownMenuItem>

                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600"
                                                                onClick={() => requestDeleteSpace(space)}
                                                            >
                                                                <Trash2 className="mr-2 h-2 w-2 text-white/50" />
                                                                <span className="text-[14px] text-white/50">Delete</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="ml-1 pl-0 py-0.5 relative pt-1 space-y-2">
                                                    {/* Vertical line connecting children */}
                                                    <div className="absolute left-[8px] top-0 bottom-4 w-[1px] bg-white/20" />
                                                    {loadingSpaces[space._id!] && spaceRooms.length === 0 ? (
                                                        Array.from({ length: 3 }).map((_, i) => (
                                                            <div key={i} className="flex i items-center gap-2 px-2 py-1.5 group relative pl-5">
                                                                <div className="absolute left-[8px] top-[14px] w-[8px] h-[1px] bg-white/20" />
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
                                                                    <div className="absolute left-[8px] top-[14px] w-[8px] h-[1px] bg-white/20" />

                                                                    <div
                                                                        onClick={() => toggleRoom(room)}
                                                                        className={cn(
                                                                            "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-0 text-left text-[14px] transition-colors cursor-pointer",
                                                                            room?._id === roomId
                                                                                ? "text-white/50"
                                                                                : "text-white/50 "
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
                                                                                <div className="flex min-h-4 min-w-4 items-center justify-center rounded-sm text-[8px] font-bold text-white/50 shadow" style={{ backgroundColor: color }}>
                                                                                    {firstLetter}
                                                                                </div>
                                                                            )}

                                                                            <span className="truncate text-[14px]">
                                                                                {room.name
                                                                                    ? room.name.charAt(0).toUpperCase() + room.name.slice(1)
                                                                                    : "Untitled Room"
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                            <DropdownMenu modal={false}>
                                                                                <DropdownMenuTrigger asChild>
                                                                                    <button
                                                                                        className="flex min-h-[24px] min-w-[24px] items-center justify-center rounded p-0.5 text-white/50 cursor-pointer opacity-100 hover:bg-[#343439] touch-manipulation"
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                        aria-label="Room options"
                                                                                    >
                                                                                        <MoreHorizontal className="h-3 w-3" />
                                                                                    </button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end" className="z-[10050] w-36 bg-[#161616] cursor-pointer border-[#e5e7eb29]">
                                                                                    <DropdownMenuItem onClick={() => handleEditRoom(room)}>
                                                                                        <Edit className="mr-2 h-2 w-2 text-white/50" />
                                                                                        <span className="text-[14px] text-white/50">Edit</span>
                                                                                    </DropdownMenuItem>


                                                                                    <DropdownMenuItem onClick={() => handleAddPeopleToRoom(room, room.spaceId)}>
                                                                                        <UserPlus className="mr-2 h-2 w-2 text-white/50" />
                                                                                        <span className="text-[14px] text-white/50">Add people</span>
                                                                                    </DropdownMenuItem>

                                                                                    <DropdownMenuItem
                                                                                        disabled={room?._id === roomId || room?._id === currentRoomDetail?._id}
                                                                                        onClick={() => {
                                                                                            if (room?._id === roomId || room?._id === currentRoomDetail?._id) return;
                                                                                            handleMoveRoom(room);
                                                                                        }}
                                                                                        className={cn(
                                                                                            (room?._id === roomId || room?._id === currentRoomDetail?._id) &&
                                                                                            "opacity-40 pointer-events-none"
                                                                                        )}
                                                                                    >
                                                                                        <MoveRight className="mr-2 h-2 w-2 text-white/50" />
                                                                                        <span className="text-[14px] text-white/50">Move</span>
                                                                                    </DropdownMenuItem>

                                                                                    {/* <DropdownMenuItem onClick={() => {
                                                                                        setCurrentRoom({ id: room._id, name: room.name });
                                                                                        setIsOpenTempate(true);
                                                                                    }}>
                                                                                        <Edit className="mr-2 h-2 w-2 text-white/50" />
                                                                                        <span className="text-[14px] text-white/50">Template</span>
                                                                                    </DropdownMenuItem> */}



                                                                                    <DropdownMenuItem
                                                                                        className="text-white/50 focus:text-white/50"
                                                                                        onClick={() => requestDeleteRoom(room)}
                                                                                    >
                                                                                        <Trash2 className="mr-2 h-2 w-2 text-white/50" />
                                                                                        <span className="text-[14px] text-white/50">Delete</span>
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </div>
                                                                    </div>


                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="px-3 py-2 text-[14px] text-zinc-500 italic pl-6 pt-2">
                                                            No projects found
                                                        </div>
                                                    )}

                                                    {hasMore && (
                                                        <button
                                                            type="button"
                                                            onClick={() => fetchRooms(space._id!, meta.currentPage + 1)}
                                                            disabled={loadingSpaces[space._id!]}
                                                            className="mt-1 flex w-[calc(100%-16px)] ml-4 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] text-white/50 hover:bg-[#343439] hover:text-white/50 group relative disabled:opacity-50"
                                                        >
                                                            <div className="absolute -left-[8px] top-[14px] w-[8px] h-[1px] bg-white/20" />
                                                            <ChevronDown className="h-3.5 w-3.5" />
                                                            {loadingSpaces[space._id!] ? 'Loading...' : 'Load More'}
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => handleCreateRoom(space._id!)}
                                                        className="mt-1 flex w-[calc(100%-16px)] cursor-pointer ml-4 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] text-white/50  hover:text-white group relative"
                                                    >
                                                        <div className="absolute cursor-pointer -left-[8px] top-[14px] w-[8px] h-[1px] bg-white/20" />
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
                                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[14px] text-white/50 hover:bg-[#343439] hover:text-white/50 disabled:opacity-50 border border-zinc-700/50 border-dashed"
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
                            <p className="text-[14px] font-semibold uppercase tracking-wide text-white/50">
                                Views
                            </p>
                            <ul className="mt-1 space-y-0.5">
                                <li>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-2 rounded-lg hover:bg-[#343439] px-2 py-1.5 text-left text-[14px] font-medium text-white/50"
                                    >
                                        <LayoutList className="h-3.5 w-3.5 text-white/50" />
                                        List
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] text-white/50 hover:bg-[#343439]"
                                    >
                                        <CalendarDays className="h-3.5 w-3.5 text-white/50" />
                                        Calendar
                                    </button>
                                </li>
                            </ul>
                        </div> */}

                    {/* Channels */}
                    {/* <div className="mt-4 px-3 pb-4">
                            <p className="text-[14px] font-semibold uppercase tracking-wide text-white/50">
                                Channels
                            </p>
                        </div> */}
                </div>




                <div className="my-2 border-t border-white/10 shrink-0" />

                {/* --- SWITCH WORKSPACES (fills remaining space) --- */}
                <div className="flex min-h-0 flex-1 flex-col">
                    <span className="mb-2 shrink-0 px-1 mt-1 text-[14px] text-white">Switch Workspaces</span>

                    <div
                        ref={workspacesListRef}
                        onScroll={handleWorkspacesScroll}
                        className={cn(DROPDOWN_SCROLL_CLASS, "flex-1 min-h-0")}
                    >
                        {workspaces.length > 0 ? (
                            workspaces.map((ws: any) => {
                                const isSelected = ws._id === currentWorkspace?._id;
                                return (
                                    <button
                                        key={ws._id}
                                        onClick={() => handleSwitchWorkspace(ws)}
                                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left "
                                    >
                                        <WorkspaceAvatar workspace={ws} compact selected={isSelected} />
                                        <span
                                            className={cn(
                                                "text-[14px] truncate",
                                                isSelected ? "text-white/50" : "text-white/50"
                                            )}
                                        >
                                            {ws.name ? capitalize(ws.name) : "Untitled"}
                                        </span>
                                    </button>
                                );
                            })
                        ) : (
                            <button
                                type="button"
                                onClick={handleOpenCreateWorkspace}
                                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-[#161616] px-2 py-2 text-[14px] text-white/60 hover:border-white/25 hover:text-white transition-colors"
                            >
                                <Plus size={12} />
                                Create workspace
                            </button>
                        )}

                        {isLoadingWorkspaces && workspaces.length > 0 && (
                            <div className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 px-2 py-1 text-[14px] text-gray-500">
                                <ChevronDown size={12} className="animate-spin" />
                                Loading more...
                            </div>
                        )}
                        {isLoadingWorkspaces && workspaces.length === 0 && (
                            <div className="mt-1 flex w-full items-center justify-center gap-1.5 px-2 py-2 text-[14px] text-gray-500">
                                <ChevronDown size={12} className="animate-spin" />
                                Loading workspaces...
                            </div>
                        )}
                        {hasMoreWorkspaces(workspacesMetadata) && !isLoadingWorkspaces && (
                            <div ref={workspacesObserverRef} className="h-4 w-full shrink-0" />
                        )}
                    </div>
                </div>
            </div>

            <button
                type="button"
                className="mt-2 w-full shrink-0 rounded-lg border border-white/15 bg-[#161616] px-2 py-1.5 text-center text-[14px] text-white/50 hover:border-white/25 hover:text-gray-300"
                onClick={handleOpenCreateWorkspace}
            >
                <span className="inline-flex items-center gap-1.5">
                    <Plus size={12} />
                    Create new workspace
                </span>
            </button>
        </div>
    ) : null;

    return (
        <>
            {typeof document !== "undefined" && anyDropdownOpen
                ? createPortal(
                    <button
                        type="button"
                        aria-label="Close menu"
                        className="fixed inset-0 bg-black/45 sm:hidden touch-manipulation"
                        style={{ zIndex: DROPDOWN_BACKDROP_Z_INDEX }}
                        onClick={closeAllDropdowns}
                    />,
                    document.body
                )
                : null}

            <div className="flex w-full min-w-0 flex-col gap-2 text-[14px] sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative w-full min-w-0 sm:w-[min(220px,100%)] sm:shrink-0">
                    {isWorkspaceInitialLoading ? (
                        <div
                            className={cn(
                                TRIGGER_BTN_CLASS,
                                "gap-2 border-white/10 bg-[#161616] text-white/45 justify-center cursor-default"
                            )}
                        >
                            <ChevronDown size={13} className="animate-spin shrink-0" />
                            <span className="text-[14px]">Loading workspaces...</span>
                        </div>
                    ) : showWorkspaceEmptyState ? (
                        <button
                            type="button"
                            onClick={handleOpenCreateWorkspace}
                            className={cn(
                                TRIGGER_BTN_CLASS,
                                "gap-2 border-white/15 bg-[#161616] text-white/70 hover:border-white/25 hover:text-white justify-center"
                            )}
                        >
                            <Plus size={14} className="shrink-0" />
                            <span className="text-[14px] font-medium">Create Workspace</span>
                        </button>
                    ) : (
                        <button
                            ref={triggerRef}
                            type="button"
                            onClick={(e) => {
                                updateMenuPosition();
                                setIsSpaceDropdownOpen(false);
                                setIsRoomDropdownOpen(false);
                                setIsDropdownOpen((prev) => !prev);
                                e.currentTarget.blur();
                            }}
                            className={cn(
                                TRIGGER_BTN_CLASS,
                                "gap-2 border-white/10 bg-[#161616] cursor-pointer focus:border-white/10 focus-visible:border-white/10 active:border-white/10",
                                isDropdownOpen && "border-white/20 focus:border-white/20 focus-visible:border-white/20 active:border-white/20"
                            )}
                        >
                            <WorkspaceAvatar workspace={currentWorkspace} compact selected />
                            <span className="flex-1 min-w-0 text-left text-[14px] text-white/50 truncate leading-tight">
                                {currentWorkspace?.name ? capitalize(currentWorkspace.name) : "Untitled"}
                            </span>
                            <ChevronDown
                                size={13}
                                className={cn(
                                    "text-gray-500 transition-transform duration-200 shrink-0",
                                    isDropdownOpen && "rotate-180"
                                )}
                            />
                        </button>
                    )}

                    {typeof document !== "undefined" && dropdownPanel && !showWorkspaceEmptyState
                        ? createPortal(dropdownPanel, document.body)
                        : null}
                </div>

                {workspaceId && (
                    <div className="flex w-full min-w-0 items-stretch gap-1.5 sm:w-auto sm:items-center sm:gap-2">
                        <>

                            <ChevronRight className="hidden h-3 w-3 shrink-0 self-center text-white/50 sm:block" aria-hidden />
                            <button
                                ref={spaceTriggerRef}
                                type="button"
                                onClick={(e) => {
                                    updateSpaceMenuPosition();
                                    setIsDropdownOpen(false);
                                    setIsRoomDropdownOpen(false);
                                    setIsSpaceDropdownOpen((prev) => !prev);
                                    e.currentTarget.blur();
                                }}
                                className={cn(
                                    TRIGGER_BTN_CLASS,
                                    "flex-1 sm:flex-none sm:max-w-[150px] cursor-pointer",
                                    isSpaceDropdownOpen
                                        ? "border-white/20 bg-[#161616] text-white/50 focus:border-white/20 focus-visible:border-white/20 active:border-white/20"
                                        : "border-white/10 bg-[#161616] text-white/50 hover:border-white/20 focus:border-white/10 focus-visible:border-white/10 active:border-white/10"
                                )}
                                title={currentSpace?.name ? capitalize(currentSpace.name) : "Select space"}
                            >
                                <SpaceIcon space={currentSpace} selected />
                                <span className="flex-1 min-w-0 truncate text-[14px] text-left">
                                    {currentSpace?.name
                                        ? capitalize(currentSpace.name)
                                        : "Select space"}
                                </span>
                                <ChevronDown
                                    size={11}
                                    className={cn(
                                        "shrink-0 text-gray-500 transition-transform",
                                        isSpaceDropdownOpen && "rotate-180"
                                    )}
                                />
                            </button>
                        </>
                        {currentSpaceId && (
                            <>
                                <ChevronRight className="hidden h-3 w-3 shrink-0 self-center text-white/50 sm:block" aria-hidden />

                                <button
                                    ref={roomTriggerRef}
                                    type="button"
                                    onClick={(e) => {
                                        updateRoomMenuPosition();
                                        setIsDropdownOpen(false);
                                        setIsSpaceDropdownOpen(false);
                                        setIsRoomDropdownOpen((prev) => !prev);
                                        e.currentTarget.blur();
                                    }}
                                    className={cn(
                                        TRIGGER_BTN_CLASS,
                                        "flex-1 sm:flex-none sm:max-w-[160px] cursor-pointer",
                                        isRoomDropdownOpen
                                            ? "border-white/20 bg-[#161616] text-white/50 focus:border-white/20 focus-visible:border-white/20 active:border-white/20"
                                            : "border-white/15 bg-[#161616] text-white/50 hover:border-white/25 focus:border-white/15 focus-visible:border-white/15 active:border-white/15"
                                    )}
                                    title={
                                        currentRoomDetail?.name
                                            ? capitalize(currentRoomDetail.name)
                                            : "Select room"
                                    }
                                >
                                    {currentRoomDetail?.bgImage ? (
                                        <img
                                            src={currentRoomDetail.bgImage}
                                            alt=""
                                            className="h-3 w-3 shrink-0 rounded-sm object-cover"
                                        />
                                    ) : (
                                        <span
                                            className="flex h-3 w-3 shrink-0 items-center justify-center rounded-sm   text-white"
                                            style={{ backgroundColor: "#e11d48" }}
                                        >
                                            {(currentRoomDetail?.name || "R").charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                    <span className="flex-1 min-w-0 truncate text-[14px] text-left">
                                        {currentRoomDetail?.name
                                            ? capitalize(currentRoomDetail.name)
                                            : "Select room"}
                                    </span>
                                    <ChevronDown
                                        size={11}
                                        className={cn(
                                            "shrink-0 text-gray-500 transition-transform",
                                            isRoomDropdownOpen && "rotate-180"
                                        )}
                                    />
                                </button>
                            </>
                        )}
                    </div>
                )}

                {typeof document !== "undefined" && spaceDropdownPanel
                    ? createPortal(spaceDropdownPanel, document.body)
                    : null}
                {typeof document !== "undefined" && roomDropdownPanel
                    ? createPortal(roomDropdownPanel, document.body)
                    : null}
            </div>

            {/* Dialogs */}
            <CreateSpaceDialog
                open={showCreateSpace}
                onOpenChange={(open) => {
                    setShowCreateSpace(open);
                    if (!open) {
                        setEditingSpace(null);
                        closeAllDropdowns();
                    }
                }}
                space={editingSpace}
            />

            <CreateRoomDialog
                open={showCreateRoom}
                onOpenChange={(open) => {
                    setShowCreateRoom(open);
                    if (!open) {
                        setEditingRoom(null);
                        closeAllDropdowns();
                    }
                }}
                onSuccess={(spaceId) => {
                    setExpandedSpaces((prev) => ({ ...prev, [spaceId]: true }));
                    setStoreActiveSpaceId(spaceId);
                }}
                spaceId={activeSpaceId || currentSpaceId || undefined}
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
            <AddWorkspaceDialog
                open={showAddWorkspace}
                onOpenChange={setShowAddWorkspace}
                onCreated={() => {
                    closeAllDropdowns();
                    setExpandedSpaces({});
                }}
            />
            {showAddPeopleToRoom && (
                <RoomMembersDialog
                    open={showAddPeopleToRoom}
                    onOpenChange={setShowAddPeopleToRoom}
                    room={activeRoomForPeople}
                    spaceId={activeSpaceId || ""}
                />
            )}

            <DeleteConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open && !deleteLoading) setDeleteTarget(null);
                }}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                itemName={deleteTarget?.name}
                scope={deleteTarget?.type ?? "space"}
            />

            <MoveRoomDialog
                open={showMoveRoom}
                onOpenChange={(open) => {
                    setShowMoveRoom(open);
                    if (!open) setMovingRoom(null);
                }}
                room={movingRoom}
            />
        </>
    );
}