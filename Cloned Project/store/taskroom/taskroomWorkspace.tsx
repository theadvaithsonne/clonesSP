import { create } from 'zustand';
import axios from 'axios';
import Cookies from 'js-cookie';
import { toast } from "sonner";
import { useUIStore } from './uiStore';
import { useTemplateStore } from './templateStore';
import { useWorkspaceStore } from './workspaceStore';

// ==========================================
// INTERFACES & TYPES
// ==========================================
export interface Workspace {
    _id: string;
    workspacename: string;
    category: string;
    name?: string;
    userId: string;
    orgId: string;
    color?: string;
    image_square_url?: string;
    image_circle_url?: string;
    MemberDetail?: {
        _id?: string;
        userId?: string;
        workspaceId?: string;
        orgId?: string;
        role?: string;
        status?: string;
        isOwner?: boolean;
    };
}

export interface space {
    _id?: string;
    workspacename: string;
    category: string;
    name?: string;
    userId: string;
    orgId: string;
    workspaceId?: string;
    defaultRoomId?: string;
    role?: string;
    isOwner?: boolean;
    MemberDetail?: {
        _id?: string;
        role?: string;
        isOwner?: boolean;
    };
}
export interface Room {
    _id: string;
    name: string;
    description?: string;
    spaceId: string;
    color: string;
    bgImage?: string;
    isPrivate?: boolean;
    setDefault?: boolean;
    members?: { _id: string; name: string; email: string; role?: string }[];
    customFields?: Array<{
        _id: string;
        name: string;
        type: string;
        options?: Array<string | { label?: string; name?: string; value?: string; color?: string }>;
    }>;
    MemberDetail?: {
        _id?: string;
        role?: string;
        isOwner?: boolean;
        isFavorite?: boolean;
    };
    role?: string;
}

export function isRoomObserver(
    room?: (Pick<Room, "_id" | "MemberDetail"> & { role?: string }) | null,
    memberData?: { role?: string } | null
) {
    if (!room?._id) return false;
    const role = String(room.MemberDetail?.role ?? room.role ?? memberData?.role ?? "").toLowerCase();
    return role === "observer";
}

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
    customFields?: Record<string, string | number | null | undefined>;
    createdAt?: string;
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

interface WorkspaceState {
    workspaces: Workspace[];
    spaceData: Record<string, space[]>;
    isLoadingSpace: boolean;
    rooms: Record<string, any[]>;
    columns: any[];
    setColumns: (columns: any[] | ((prev: any[]) => any[])) => void;
    isFetchingColumns: boolean;
    setIsFetchingColumns: (isFetching: boolean) => void;
    loadingWorkspaceSpaces: Record<string, boolean>;
    createWorkspaceAndSpaceAndRooms: (category: string, workspacename: string, router?: any) => Promise<any>;
    isLoadingWorkspacesAndSpaceAndRooms: boolean;
    projectActiveItem: string | null;
    activeSpaceId: string | null;
    currentWorkspace: Workspace | null;
    wsrKLoading: boolean;
    error: string | null;
    memberData: any;
    tags: any[];
    spaceMetadata: Record<string, { totalPages: number, currentPage: number }>;
    roomMetadata: Record<string, { totalPages: number, currentPage: number }>;
    workspacesMetadata: {
        count: number;
        totalPages: number;
        currentPage: number;
        nextPage: number | null;
    };
    isLoadingWorkspaces: boolean;
    workspacesListApiResult: "idle" | "empty" | "has_data";
    boardDetailsMetadata: any;
    /** Room whose stages are in `columns`; `loadMoreStages` pages this room. */
    boardRoomId: string | null;
    boardPageSize: number;
    /** Bumped on every page-1 board load so per-column paging state can reset. */
    boardLoadId: number;
    isLoadingMoreStages: boolean;
    loadMoreStages: () => Promise<void>;
    currentRoomDetail: Room | null;
    setCurrentRoomDetail: (room: Room | null) => void;
    setCurrentWorkspace: (workspace: Workspace | null) => void;
    showCreateSpace: boolean;
    setShowCreateSpace: (show: boolean) => void;
    deleteRoom: (roomId: string) => Promise<boolean>;
    moveRoom: (
        roomId: string,
        data: { spaceId: string; workspaceId: string },
        sourceSpaceId?: string
    ) => Promise<boolean>;
    createRoom: (data: {
        name: string;
        description?: string;
        spaceId: string;
        color: string;
        bgImage?: string;
        isPrivate: boolean;
        setDefault?: boolean;
        members: { _id: string; name: string; email: string; role?: string }[];
    }, workspaceId: string, router: any) => Promise<boolean>;
    updateRoom: (roomId: string, data: {
        name: string;
        description?: string;
        color: string;
        bgImage?: string;
        isPrivate?: boolean;
        setDefault?: boolean;
        members?: { _id: string; name: string; email: string; role?: string }[];
    }) => Promise<boolean>;
    isRoomLoading: boolean;
    fetchRooms: (spaceId: string, page?: number, force?: boolean) => Promise<void>;
    updateWorkspace: (workspaceId: string, data: Partial<Workspace>) => Promise<void>;
    isUpdatingWorkspace: boolean;
    isDeletingWorkspace: boolean;
    // UI Mutation State Helpers
    deleteWorkspace: (workspaceId: string) => Promise<boolean>;
    setProjectActiveItem: (item: string) => void;
    toggleSpace: (spaceId: string) => void;
    fetchspaces: (workspaceId: string, page?: number) => Promise<boolean>;
    fetchWorkspacesAndSpaceAndRoomsAndKanbanBoard: () => Promise<void>;
    loadingSpaces: Record<string, boolean>; // spaceId -> loadingState
    fetchBoardDetails: (boardId: string, spaceIdContext?: string, page?: number, size?: number, sortOrder?: string) => Promise<Column[]>;
    fetchBoardByRoomsDetails: (boardId: string, page?: number, size?: number, sortOrder?: string) => Promise<Column[]>;
    fetchWorkspaces: (page?: number) => Promise<boolean>;
    addSpace: (space: space) => void;
    addRoom: (room: Room) => void;
    syncRoom: (roomId: string, data: Partial<Room>) => void;
    refreshCurrentRoomDetail: (roomId: string) => Promise<Room | null>;
    fetchWorkspaceById: (workspaceId: string) => Promise<boolean>;
    getRoomById: (roomId: string) => Promise<Room | null>;
    loadShareTaskDeepLink: (params: {
        shareTaskId: string;
        workspaceId: string;
        spaceId: string;
        roomId: string;
    }) => Promise<boolean>;
    /**
     * Open a service engagement's room ("Take to Taskroom").
     *
     * Additive: reuses the existing deep-link chain rather than introducing a
     * second navigation path, so behaviour for every other room is untouched.
     */
    navigateToServiceRoom: (params: {
        roomId: string;
        spaceId?: string;
        workspaceId?: string;
    }) => Promise<boolean>;
}

// ==========================================
// DATA TRANSFORMERS (MAPPING LOGIC)
// ==========================================
const parseCardCustomFields = (card: any): Record<string, string | number | null | undefined> => {
    const result: Record<string, string | number | null | undefined> = {};

    if (card?.customFields && typeof card.customFields === "object" && !Array.isArray(card.customFields)) {
        Object.assign(result, card.customFields);
    }

    const valueArrays = [card?.customFieldData, card?.customFieldValues, card?.fieldValues];
    for (const arr of valueArrays) {
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
            const fieldId = item?.fieldId ?? item?._id ?? item?.customFieldId;
            const value = item?.value ?? item?.fieldValue ?? item?.textValue ?? item?.name;
            if (fieldId != null) result[String(fieldId)] = value ?? null;
        }
    }

    return result;
};

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
    createdAt: card?.createdAt,
    stageId: stageId,
    assignedToIds: card?.assignedToIds ? card.assignedToIds || [] : [],
    TaskDataCount: {
        totalChildCount: card?.TaskDataCount?.totalChildCount ?? 0,
        totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0
    },
    customFields: parseCardCustomFields(card),
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

// Only the newest board request may write `columns`; switching rooms quickly
// otherwise lets an older room's response land last and replace the board.
let latestBoardRequestId = 0;

// ==========================================
// ZUSTAND STORE IMPLEMENTATION
// ==========================================
export const useTaskroomWorkspacetore = create<WorkspaceState>((set, get) => ({
    workspaces: [],
    spaceData: {},
    isLoadingSpace: false,
    rooms: {},
    columns: [],
    setColumns: (updater) => set((state) => ({
        columns: typeof updater === 'function' ? updater(state.columns) : updater
    })),
    isFetchingColumns: false,
    setIsFetchingColumns: (isFetching) => set({ isFetchingColumns: isFetching }),
    projectActiveItem: null,
    activeSpaceId: null,
    currentWorkspace: null,
    wsrKLoading: false,
    error: null,
    memberData: null,
    tags: [],
    spaceMetadata: {},
    roomMetadata: {},
    workspacesMetadata: { count: 0, totalPages: 1, currentPage: 0, nextPage: null },
    isLoadingWorkspaces: false,
    workspacesListApiResult: "idle",
    loadingWorkspaceSpaces: {},
    boardDetailsMetadata: null,
    boardRoomId: null,
    boardPageSize: 30,
    boardLoadId: 0,
    isLoadingMoreStages: false,
    loadMoreStages: async () => {
        const { boardDetailsMetadata: meta, boardRoomId: roomId, boardPageSize: size, isLoadingMoreStages } = get();
        if (!roomId || !meta || isLoadingMoreStages) return;
        const currentPage = Number(meta.currentPage) || 1;
        const totalPages = Number(meta.totalPages) || 1;
        if (currentPage >= totalPages) return;

        // Not bumped: a room switch bumps it, which discards this page.
        const requestId = latestBoardRequestId;
        set({ isLoadingMoreStages: true });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/detail/${roomId}?page=${currentPage + 1}&size=${size}&cardSize=30`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await response.json();
            if (requestId !== latestBoardRequestId) return;
            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to load more stages");
            }

            const newColumns: Column[] = (data?.data || []).map(transformStage);
            set((state) => {
                const existingIds = new Set(state.columns.map((c: Column) => c._id));
                return {
                    columns: [...state.columns, ...newColumns.filter((c) => !existingIds.has(c._id))],
                    boardDetailsMetadata: data.metadata || { ...meta, currentPage: currentPage + 1 },
                };
            });
        } catch (error: any) {
            if (requestId === latestBoardRequestId) {
                toast.error(error.message || "Failed to load more stages");
            }
        } finally {
            set({ isLoadingMoreStages: false });
        }
    },
    currentRoomDetail: null,
    setCurrentRoomDetail: (room) => set({ currentRoomDetail: room }),
    setCurrentWorkspace: (workspace) => set((state) => {
        const isSameWorkspace = state.currentWorkspace?._id === workspace?._id;
        if (isSameWorkspace) {
            return { currentWorkspace: workspace };
        }
        latestBoardRequestId++;
        return {
            currentWorkspace: workspace,
            currentRoomDetail: null,
            activeSpaceId: null,
            columns: [],
            boardRoomId: null,
            boardDetailsMetadata: null,
            projectActiveItem: null,
        };
    }),
    setProjectActiveItem: (item) => set({ projectActiveItem: item }),
    toggleSpace: (spaceId) => set({ activeSpaceId: spaceId }),
    showCreateSpace: false,
    isLoadingWorkspacesAndSpaceAndRooms: false,
    isUpdatingWorkspace: false,
    isDeletingWorkspace: false,
    setShowCreateSpace: (show: boolean) => set({ showCreateSpace: show }),
    fetchspaces: async (workspaceId, page = 1) => {
        set((state) => ({ loadingWorkspaceSpaces: { ...state.loadingWorkspaceSpaces, [workspaceId]: true }, isLoadingSpace: true, error: null }));

        try {
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces/me?workspaceId=${workspaceId}&page=${page}&size=50`,
                {
                    headers: { Authorization: `Bearer ${localStorage.getItem("garage_tok") || ''}` },
                }
            );
            const data = res.data;
            if (data?.status || data?.success) {
                const fetchedSpaces = data.data || [];
                const meta = data.metadata || { totalPages: 1, currentPage: 1 };

                set((state) => {
                    const existingSpaces = page > 1 ? (state.spaceData[workspaceId] || []) : [];
                    return {
                        spaceData: {
                            ...state.spaceData,
                            [workspaceId]: [...existingSpaces, ...fetchedSpaces]
                        },
                        spaceMetadata: {
                            ...state.spaceMetadata,
                            [workspaceId]: {
                                totalPages: meta.totalPages || 1,
                                currentPage: meta.currentPage || page
                            }
                        },
                        loadingWorkspaceSpaces: { ...state.loadingWorkspaceSpaces, [workspaceId]: false },
                        isLoadingSpace: false
                    };
                });
                return true;
            } else {
                const msg = data?.message || "Failed to fetch spaces";
                toast.error(msg);
                set((state) => ({ loadingWorkspaceSpaces: { ...state.loadingWorkspaceSpaces, [workspaceId]: false }, isLoadingSpace: false, error: msg }));
                return false;
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.message ||
                err.message ||
                "Failed to fetch spaces";

            toast.error(msg);
            set((state) => ({ loadingWorkspaceSpaces: { ...state.loadingWorkspaceSpaces, [workspaceId]: false }, isLoadingSpace: false, error: msg }));
            return false;
        }
    },
    addSpace: (space) => set((state) => {
        const workspaceId = space.workspaceId;
        if (!workspaceId || !space._id) return state;
        const existing = (state.spaceData[workspaceId] || []).filter((s) => s._id !== space._id);
        return {
            spaceData: {
                ...state.spaceData,
                [workspaceId]: [space, ...existing],
            },
        };
    }),
    addRoom: (room) => set((state) => {
        const spaceId = room.spaceId;
        if (!spaceId || !room._id) return state;
        const existing = (state.rooms[spaceId] || []).filter((r) => r._id !== room._id);
        return {
            rooms: {
                ...state.rooms,
                [spaceId]: [room, ...existing],
            },
        };
    }),
    syncRoom: (roomId, data) => set((state) => {
        const newRooms = { ...state.rooms };
        for (const sid in newRooms) {
            newRooms[sid] = newRooms[sid].map((r) =>
                r._id === roomId ? { ...r, ...data } : r
            );
        }
        return {
            rooms: newRooms,
            currentRoomDetail:
                state.currentRoomDetail?._id === roomId
                    ? { ...state.currentRoomDetail, ...data }
                    : state.currentRoomDetail,
        };
    }),
    loadingSpaces: {},
    isRoomLoading: false,
    createRoom: async (data, workspaceId, router) => {
        set({ isRoomLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms`,
                data,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                const newRoom = response.data?.data?.data || response.data?.data;
                if (newRoom) {
                    const roomWithSpace = {
                        ...newRoom,
                        spaceId: newRoom.spaceId || data.spaceId,
                    };
                    get().addRoom(roomWithSpace);
                }
                toast.success("Room created successfully");
                return true;
            } else {
                toast.error(response.data?.message || "Failed to create room");
                return false;
            }
        } catch (error: any) {
            console.error("Failed to create room:", error);
            toast.error(error.response?.data?.message || 'Failed to create room');
            return false;
        } finally {
            set({ isRoomLoading: false });
        }
    },
    updateRoom: async (roomId, data) => {
        set({ isRoomLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.put(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/${roomId}`,
                data,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                toast.success("Room updated successfully");
                get().syncRoom(roomId, data);
                return true;
            } else {
                toast.error(response.data?.message || "Failed to update room");
                return false;
            }
        } catch (error: any) {
            console.error("Failed to update room:", error);
            toast.error(error.response?.data?.message || 'Failed to update room');
            return false;
        } finally {
            set({ isRoomLoading: false });
        }
    },
    deleteRoom: async (roomId) => {
        set({ error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.delete(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/${roomId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                toast.success("Room deleted successfully");
                // Find spaceId to refresh
                const spaceId = Object.keys(get().rooms).find(sid =>
                    get().rooms[sid].some(r => r._id === roomId)
                );
                if (spaceId) {
                    get().fetchRooms(spaceId, 1, true);
                }
                return true;
            } else {
                toast.error(response.data?.message || "Failed to delete room");
                return false;
            }
        } catch (error: any) {
            console.error("Failed to delete room:", error);
            toast.error(error.response?.data?.message || 'Failed to delete room');
            return false;
        } finally {

        }
    },
    moveRoom: async (roomId, data, sourceSpaceId) => {
        set({ isRoomLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) {
                toast.error("Authentication token not found");
                return false;
            }

            const response = await axios.put(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/move/${roomId}`,
                { spaceId: data.spaceId, workspaceId: data.workspaceId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data?.status || response.data?.success) {
                const movedRoom = response.data?.data?.data || response.data?.data;
                const fromSpaceId =
                    sourceSpaceId ||
                    Object.keys(get().rooms).find((sid) =>
                        get().rooms[sid].some((r) => r._id === roomId)
                    );

                set((state) => {
                    const nextRooms = { ...state.rooms };
                    if (fromSpaceId && nextRooms[fromSpaceId]) {
                        nextRooms[fromSpaceId] = nextRooms[fromSpaceId].filter(
                            (r) => r._id !== roomId
                        );
                    }

                    const existingRoom =
                        (fromSpaceId
                            ? state.rooms[fromSpaceId]?.find((r) => r._id === roomId)
                            : undefined) ||
                        (state.currentRoomDetail?._id === roomId
                            ? state.currentRoomDetail
                            : undefined);

                    const roomPayload = {
                        ...(existingRoom || {}),
                        ...(typeof movedRoom === "object" && movedRoom ? movedRoom : {}),
                        _id: roomId,
                        spaceId: data.spaceId,
                        name:
                            (typeof movedRoom === "object" && movedRoom?.name) ||
                            existingRoom?.name ||
                            "Untitled Room",
                    };

                    const existingTarget = (nextRooms[data.spaceId] || []).filter(
                        (r) => r._id !== roomId
                    );
                    nextRooms[data.spaceId] = [roomPayload, ...existingTarget];

                    const wasViewingMovedRoom = state.currentRoomDetail?._id === roomId;

                    return {
                        rooms: nextRooms,
                        // Keep current selection — do not auto-switch workspace/space/room after move
                        currentRoomDetail: wasViewingMovedRoom ? null : state.currentRoomDetail,
                        columns: wasViewingMovedRoom ? [] : state.columns,
                        isRoomLoading: false,
                    };
                });

                toast.success("Room moved successfully");
                return true;
            }

            toast.error(response.data?.message || "Failed to move room");
            set({ isRoomLoading: false });
            return false;
        } catch (error: any) {
            console.error("Failed to move room:", error);
            toast.error(error.response?.data?.message || "Failed to move room");
            set({ isRoomLoading: false });
            return false;
        }
    },
    fetchWorkspaceById: async (workspaceId) => {
        set({ isLoadingWorkspaces: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) {
                toast.error("Authentication token not found");
                set({ isLoadingWorkspaces: false });
                return false;
            }

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                const wsData = response?.data?.data;
                set({
                    currentWorkspace: wsData ? {
                        ...wsData,
                        image_square_url: wsData.image_square_url,
                        image_circle_url: wsData.image_circle_url,
                    } : null,
                    isLoadingWorkspaces: false
                });
                return Boolean(wsData?._id);
            }

            const msg = response.data?.message || "Failed to fetch workspace";
            toast.error(msg);
            set({ isLoadingWorkspaces: false, error: msg });
            return false;
        } catch (error: any) {
            console.error("Failed to fetch workspace:", error);
            const msg = error.response?.data?.message || error.message || "Failed to fetch workspace";
            toast.error(msg);
            set({
                isLoadingWorkspaces: false,
                error: msg
            });
            return false;
        }
    },
    getRoomById: async (roomId) => {
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) {
                toast.error("Authentication token not found");
                return null;
            }

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/${roomId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                return response.data?.data?.data ?? response.data?.data ?? null;
            }

            toast.error(response.data?.message || "Failed to fetch room");
            return null;
        } catch (error: any) {
            console.error("Failed to fetch room by id:", error);
            toast.error(error.response?.data?.message || error.message || "Failed to fetch room");
            return null;
        }
    },
    refreshCurrentRoomDetail: async (roomId) => {
        if (!roomId) return null;
        const fetched = await get().getRoomById(roomId);
        if (!fetched?._id) return null;

        const state = get();
        const merged: Room = {
            ...(state.currentRoomDetail?._id === roomId ? state.currentRoomDetail : {}),
            ...fetched,
            _id: roomId,
            spaceId: fetched.spaceId || state.currentRoomDetail?.spaceId || "",
            MemberDetail: fetched.MemberDetail ?? state.currentRoomDetail?.MemberDetail,
        };

        get().syncRoom(roomId, merged);
        return merged;
    },
    fetchRooms: async (spaceId: string, page = 1, force = false) => {
        const { loadingSpaces, rooms } = get();
        if (loadingSpaces[spaceId]) return;
        if (!force && page === 1 && (rooms[spaceId]?.length ?? 0) > 0) return;

        set((state) => ({
            loadingSpaces: { ...state.loadingSpaces, [spaceId]: true },
            error: null
        }));
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/me?spaceId=${spaceId}&page=${page}&size=50`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (response.data?.status || response.data?.success) {
                const fetchedRooms = response.data?.data || [];
                const meta = response.data?.metadata || { totalPages: 1, currentPage: 1 };

                set((state) => {
                    const existingRooms = page > 1 ? (state.rooms[spaceId] || []) : [];
                    return {
                        rooms: {
                            ...state.rooms,
                            [spaceId]: [...existingRooms, ...fetchedRooms],
                        },
                        roomMetadata: {
                            ...state.roomMetadata,
                            [spaceId]: {
                                totalPages: meta.totalPages || 1,
                                currentPage: meta.currentPage || page
                            }
                        },
                        loadingSpaces: { ...state.loadingSpaces, [spaceId]: false },
                    };
                });
            } else {
                set((state) => ({
                    loadingSpaces: { ...state.loadingSpaces, [spaceId]: false },
                    error: response.data?.message || "Failed to fetch rooms"
                }));
            }
        } catch (error: any) {
            console.error("Failed to fetch rooms:", error);
            set((state) => ({
                loadingSpaces: { ...state.loadingSpaces, [spaceId]: false },
                error: error.response?.data?.message || error.message || 'Failed to fetch rooms'
            }));
        }
    },
    fetchWorkspacesAndSpaceAndRoomsAndKanbanBoard: async () => {
        set({ wsrKLoading: true, error: null, workspacesListApiResult: "idle" });

        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) throw new Error("Authentication token not found");

            // STEP 1: FETCH WORKSPACES
            const workspaceResponse = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/me?size=50`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const workspaceResData = workspaceResponse.data;
            if (workspaceResData && (workspaceResData.status === false || workspaceResData.success === false)) {
                const errMsg = workspaceResData.message || "Failed to fetch workspaces";
                toast.error(`Workspace Error: ${errMsg}`);
                set({ wsrKLoading: false });
                return;
            }

            const workspaceDataArray = workspaceResData?.data || [];
            if (workspaceDataArray.length === 0) {
                set({
                    workspaces: [],
                    wsrKLoading: false,
                    isLoadingWorkspaces: false,
                    workspacesListApiResult: "empty",
                    workspacesMetadata: {
                        count: 0,
                        totalPages: 1,
                        currentPage: 1,
                        nextPage: null,
                    },
                });
                toast("No workspaces available found.");
                return;
            }

            set({
                currentWorkspace: workspaceDataArray?.[0] || null,
                workspaces: workspaceDataArray,
                workspacesListApiResult: "has_data",
            });

            const firstWorkspaceId = workspaceDataArray[0]?._id;
            if (!firstWorkspaceId) {
                set({ wsrKLoading: false });
                return;
            }

            // STEP 2: FETCH SPACES FOR THE FIRST WORKSPACE
            const spaceResponse = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces/me?workspaceId=${firstWorkspaceId}&page=1&size=50`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const spaceResData = spaceResponse.data;
            if (spaceResData?.status === false || spaceResData?.success === false) {
                const errMsg = spaceResData?.message || "Failed to fetch spaces";
                toast.error(`Space Error: ${errMsg}`);
                set({ wsrKLoading: false });
                return;
            }

            const fetchedSpaces = spaceResData.data || [];
            const spaceMeta = spaceResData.metadata || { totalPages: 1, currentPage: 1 };

            if (fetchedSpaces.length === 0) {
                set((state) => ({
                    spaceData: { ...state.spaceData, [firstWorkspaceId]: [] },
                    wsrKLoading: false
                }));
                toast("No spaces found inside this workspace.");
                return;
            }

            set((state) => ({
                spaceData: { ...state.spaceData, [firstWorkspaceId]: fetchedSpaces },
                spaceMetadata: {
                    ...state.spaceMetadata,
                    [firstWorkspaceId]: {
                        totalPages: spaceMeta.totalPages || 1,
                        currentPage: spaceMeta.currentPage || 1
                    }
                }
            }));

            const firstSpaceId = fetchedSpaces[0]?._id;
            if (!firstSpaceId) {
                set({ wsrKLoading: false });
                return;
            }

            // STEP 3: FETCH ROOMS FOR THE FIRST SPACE
            const roomResponse = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/me?spaceId=${firstSpaceId}&page=1&size=50`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const roomResData = roomResponse.data;
            if (roomResData?.status === false || roomResData?.success === false) {
                const errMsg = roomResData?.message || "Failed to fetch rooms";
                toast.error(`Room Error: ${errMsg}`);
                set({ wsrKLoading: false });
                return;
            }

            const fetchedRooms = roomResData.data || [];
            const roomMeta = roomResData.metadata || { totalPages: 1, currentPage: 1 };

            if (fetchedRooms.length === 0) {
                set((state) => ({
                    rooms: { ...state.rooms, [firstSpaceId]: [] },
                    wsrKLoading: false
                }));
                toast("No rooms found inside this space.");
                return;
            }

            set((state) => ({
                rooms: { ...state.rooms, [firstSpaceId]: fetchedRooms },
                currentRoomDetail: fetchedRooms?.[0] || null,
                roomMetadata: {
                    ...state.roomMetadata,
                    [firstSpaceId]: {
                        totalPages: roomMeta.totalPages || 1,
                        currentPage: roomMeta.currentPage || 1
                    }
                },
            }));

            // STEP 4: FETCH KANBAN DETAILS AND MUTATE UI STATE
            const firstRoomId = fetchedRooms?.[0]?._id;
            if (firstRoomId) {
                // Pass firstSpaceId down so fetchBoardDetails can run toggleSpace with it
                await get().fetchBoardDetails(firstRoomId, firstSpaceId, 1, 30);
            } else {
                set({ wsrKLoading: false });
                toast.error(`No valid room found to fetch Kanban board details.`);
            }

        } catch (error: any) {
            console.error("Error in sequential data fetching chain:", error);
            const finalErrorMessage = error.response?.data?.message || error.message || "An unexpected network error occurred";
            toast.error(`Network/Server Error: ${finalErrorMessage}`);
            set({ wsrKLoading: false, error: finalErrorMessage });
        }
    },
    updateWorkspace: async (workspaceId, data) => {
        set({ isUpdatingWorkspace: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) throw new Error("Authentication token not found");

            const response = await axios.put(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}`,
                data,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.success || response.data?.status) {
                toast.success("Workspace updated successfully");
                set((state) => ({
                    currentWorkspace: state.currentWorkspace?._id === workspaceId
                        ? { ...state.currentWorkspace, ...data }
                        : state.currentWorkspace,
                    workspaces: state.workspaces.map(w => w._id === workspaceId ? { ...w, ...data } : w),
                    isUpdatingWorkspace: false,
                }));
            } else {
                const msg = response.data?.message || "Failed to update workspace";
                toast.error(msg);
                set({ isUpdatingWorkspace: false, error: msg });
            }
        } catch (error: any) {
            console.error("Failed to update workspace:", error);
            const msg = error.response?.data?.message || error.message || "Failed to update workspace";
            toast.error(msg);
            set({ isUpdatingWorkspace: false, error: msg });
        }
    },
    deleteWorkspace: async (workspaceId) => {
        set({ isDeletingWorkspace: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) throw new Error("Authentication token not found");

            const response = await axios.delete(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.success || response.data?.status || response.status === 200 || response.status === 204) {
                toast.success("Workspace deleted successfully");
                set((state) => ({
                    workspaces: state.workspaces.filter((w) => w._id !== workspaceId),
                    currentWorkspace: state.currentWorkspace?._id === workspaceId ? null : state.currentWorkspace,
                    isDeletingWorkspace: false,
                }));
                return true;
            } else {
                const msg = response.data?.message || "Failed to delete workspace";
                toast.error(msg);
                set({ isDeletingWorkspace: false, error: msg });
                return false;
            }
        } catch (error: any) {
            console.error("Failed to delete workspace:", error);
            const msg = error.response?.data?.message || error.message || "Failed to delete workspace";
            toast.error(msg);
            set({ isDeletingWorkspace: false, error: msg });
            return false;
        }
    },
    createWorkspaceAndSpaceAndRooms: async (category, workspacename, router) => {
        set({ isLoadingWorkspacesAndSpaceAndRooms: true, error: null });

        const fail = (message: string, step: string) => {
            const msg = message || `Failed at step: ${step}`;
            toast.error(msg);
            set({
                isLoadingWorkspacesAndSpaceAndRooms: false,
                error: msg,
            });
            return null;
        };

        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) {
                return fail("Authentication token not found", "workspace");
            }

            // STEP 1: Create workspace
            const workspaceResponse = await axios.post(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces`,
                { category, name: workspacename, color: "#008080" },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const workspaceOk =
                workspaceResponse.data?.status === true ||
                workspaceResponse.data?.success === true ||
                workspaceResponse.status === 200 ||
                workspaceResponse.status === 201;

            const workspaceData =
                workspaceResponse?.data?.data?.data ||
                workspaceResponse?.data?.data;

            if (!workspaceOk || !workspaceData?._id) {
                return fail(
                    workspaceResponse.data?.message || "Failed to create workspace",
                    "workspace"
                );
            }

            const workspaceId = workspaceData._id;

            // STEP 2: Create default space
            let spaceData: any;
            try {
                const spaceResponse = await axios.post(
                    `${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces`,
                    {
                        name: `space${Math.random().toString(36).substring(2, 8)}`,
                        description: "",
                        color: "#008080",
                        spaceCode: `space-${Math.random().toString(36).substring(2, 8)}`,
                        workspaceId,
                        isprivate: true,
                        members: [],
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                const spaceOk =
                    spaceResponse.data?.status === true ||
                    spaceResponse.data?.success === true;

                spaceData =
                    spaceResponse?.data?.data?.data ||
                    spaceResponse?.data?.data;

                if (!spaceOk || !spaceData?._id) {
                    return fail(
                        spaceResponse.data?.message || "Failed to create space",
                        "space"
                    );
                }
            } catch (spaceError: any) {
                return fail(
                    spaceError.response?.data?.message || spaceError.message || "Failed to create space",
                    "space"
                );
            }

            // STEP 3: Create default room
            let newRoom: any;
            try {
                const roomResponse = await axios.post(
                    `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms`,
                    {
                        name: `room-${Math.random().toString(36).substring(2, 8)}`,
                        description: "",
                        spaceId: spaceData._id,
                        color: "",
                        bgImage: "",
                        isprivate: true,
                        members: [],
                        setDefault: true,
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                const roomOk =
                    roomResponse.data?.status === true ||
                    roomResponse.data?.success === true;

                newRoom =
                    roomResponse.data?.data?.data ||
                    roomResponse.data?.data;

                if (!roomOk || !newRoom?._id) {
                    return fail(
                        roomResponse.data?.message || "Failed to create room",
                        "room"
                    );
                }
            } catch (roomError: any) {
                return fail(
                    roomError.response?.data?.message || roomError.message || "Failed to create room",
                    "room"
                );
            }

            const roomWithSpace = { ...newRoom, spaceId: spaceData._id };
            // POST /workspaces does not return MemberDetail; creator is owner.
            const workspaceWithRole = {
                ...workspaceData,
                MemberDetail: {
                    ...workspaceData.MemberDetail,
                    role: workspaceData.MemberDetail?.role || "admin",
                    isOwner: workspaceData.MemberDetail?.isOwner ?? true,
                },
            };

            // All steps succeeded — update state (clear previous workspace room/space selection)
            set((state) => ({
                workspaces: [...state.workspaces, workspaceWithRole],
                currentWorkspace: workspaceWithRole,
                currentRoomDetail: roomWithSpace,
                activeSpaceId: spaceData._id,
                columns: [],
                projectActiveItem: null,
                workspacesListApiResult: "has_data",
                spaceData: {
                    ...state.spaceData,
                    [workspaceId]: [spaceData],
                },
                rooms: {
                    ...state.rooms,
                    [spaceData._id]: [roomWithSpace],
                },
                isLoadingWorkspacesAndSpaceAndRooms: false,
                error: null,
            }));

            useTemplateStore.getState().setCurrentRoom({
                id: newRoom._id,
                name: newRoom.name,
            });
            useWorkspaceStore.setState({ currentWorkspace: workspaceWithRole });
            useUIStore.getState().setShowAddWorkspace(false);

            await get().fetchBoardDetails(newRoom._id, spaceData._id, 1, 30);
            get().setProjectActiveItem("WorkspacePeople");

            toast.success("Workspace created successfully");

            if (router && spaceData?._id && newRoom?._id) {
                // router.push(`/taskroom/${workspaceId}/dashboard/${spaceData._id}?roomId=${newRoom._id}`);
            }

            return {
                workspace: workspaceData,
                currentWorkspace: workspaceData,
                spaceData,
                room: newRoom,
                status: true,
            };
        } catch (error: any) {
            return fail(
                error.response?.data?.message || error.message || "Failed to create workspace",
                "workspace"
            );
        }
    },

    fetchBoardDetails: async (boardId: string, spaceIdContext?: string, page = 1, size = 30, sortOrder?: string) => {
        const requestId = ++latestBoardRequestId;
        set({ wsrKLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/detail/${boardId}?page=${page}&size=${size}&cardSize=30`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const data = await response.json();
            if (requestId !== latestBoardRequestId) return get().columns;

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch board details");
            }

            // Map and Transform RAW stages & card payloads into Column[] structure
            const stagesData = data?.data || [];
            const formattedColumns: Column[] = stagesData.map(transformStage);

            // Execute requested UI state syncing mapping routines
            get().setProjectActiveItem("DashMangement");
            if (spaceIdContext) {
                get().toggleSpace(spaceIdContext);
            }

            if (page === 1) {
                set({ memberData: data?.memberData ?? null });
            }

            if (data.tags && Array.isArray(data.tags)) {
                set({ tags: data.tags });
            } else if (data.tagData && Array.isArray(data.tagData)) {
                set({ tags: data.tagData });
            }

            set((state) => ({
                columns: formattedColumns, // Save transformed Kanban board data to state
                boardDetailsMetadata: data.metadata || null,
                boardRoomId: boardId,
                boardPageSize: size,
                boardLoadId: state.boardLoadId + 1,
                wsrKLoading: false
            }));

            return formattedColumns;

        } catch (error: any) {
            if (requestId !== latestBoardRequestId) return get().columns;
            console.error("Fetch board details error:", error);
            set({ error: error.message || "Failed to load board details", wsrKLoading: false });
            toast(error.message || "Failed to load board details");
            return [];
        }
    },


    fetchWorkspaces: async (page = 1) => {
        set({
            isLoadingWorkspaces: true,
            error: null,
            ...(page === 1 ? { workspacesListApiResult: "idle" as const } : {}),
        });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) {
                toast.error("Authentication token not found");
                set({ isLoadingWorkspaces: false });
                return false;
            }

            const WORKSPACES_PAGE_SIZE = 10;
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/me?size=${WORKSPACES_PAGE_SIZE}&page=${page}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const result = response.data;
            if (!(result?.status || result?.success) && !Array.isArray(result?.data)) {
                const msg = result?.message || "Failed to fetch workspaces";
                toast.error(msg);
                set({ isLoadingWorkspaces: false, error: msg });
                return false;
            }

            const fetchedWorkspaces = result?.data || [];
            const metadata = result?.metadata || {
                count: fetchedWorkspaces.length,
                totalPages: 1,
                currentPage: page,
                nextPage: null,
            };

            const dedupeWorkspaces = (list: Workspace[]) => {
                const seen = new Set<string>();
                return list.filter((ws) => {
                    if (!ws?._id || seen.has(ws._id)) return false;
                    seen.add(ws._id);
                    return true;
                });
            };

            set((state) => {
                const merged =
                    page > 1
                        ? [...state.workspaces, ...fetchedWorkspaces]
                        : fetchedWorkspaces;
                const workspaces = dedupeWorkspaces(merged);

                return {
                    workspaces,
                    workspacesMetadata: {
                        count: metadata.count ?? workspaces.length,
                        totalPages: metadata.totalPages ?? 1,
                        currentPage: metadata.currentPage ?? page,
                        nextPage: metadata.nextPage ?? null,
                    },
                    isLoadingWorkspaces: false,
                    ...(page === 1
                        ? {
                              workspacesListApiResult:
                                  fetchedWorkspaces.length === 0 ? ("empty" as const) : ("has_data" as const),
                          }
                        : {}),
                };
            });

            useWorkspaceStore.setState((state) => {
                const merged =
                    page > 1
                        ? [...state.workspaces, ...fetchedWorkspaces]
                        : fetchedWorkspaces;
                return { workspaces: dedupeWorkspaces(merged) };
            });

            return true;
        } catch (error: any) {
            console.error("Failed to fetch workspaces:", error);
            const msg = error.response?.data?.message || error.message || "Failed to fetch workspaces";
            toast.error(msg);
            set({
                isLoadingWorkspaces: false,
                error: msg,
            });
            return false;
        }
    },

    fetchBoardByRoomsDetails: async (boardId: string, page = 1, size = 30, sortOrder?: string) => {
        const requestId = ++latestBoardRequestId;
        set({ wsrKLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/detail/${boardId}?page=${page}&size=${size}&cardSize=30`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const data = await response.json();
            if (requestId !== latestBoardRequestId) return get().columns;

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch board details");
            }

            // Map and Transform RAW stages & card payloads into Column[] structure
            const stagesData = data?.data || [];
            const formattedColumns: Column[] = stagesData.map(transformStage);

            if (page === 1) {
                set({ memberData: data?.memberData ?? null });
            }

            // if (data.tags && Array.isArray(data.tags)) {
            //     set({ tags: data.tags });
            // } else if (data.tagData && Array.isArray(data.tagData)) {
            //     set({ tags: data.tagData });
            // }

            set((state) => ({
                columns: formattedColumns, // Save transformed Kanban board data to state
                boardDetailsMetadata: data.metadata || null,
                boardRoomId: boardId,
                boardPageSize: size,
                boardLoadId: state.boardLoadId + 1,
                wsrKLoading: false
            }));

            return formattedColumns;

        } catch (error: any) {
            if (requestId !== latestBoardRequestId) return get().columns;
            console.error("Fetch board details error:", error);
            set({ error: error.message || "Failed to load board details", wsrKLoading: false });
            toast(error.message || "Failed to load board details");
            return [];
        }
    },

    loadShareTaskDeepLink: async ({ shareTaskId, workspaceId, spaceId, roomId }) => {
        if (!shareTaskId || !workspaceId || !spaceId || !roomId) {
            toast.error("Invalid share task link");
            return false;
        }

        set({ columns: [], isFetchingColumns: true, error: null });

        const workspacesOk = await get().fetchWorkspaces(1);
        if (!workspacesOk) {
            set({ isFetchingColumns: false });
            return false;
        }

        const workspaceOk = await get().fetchWorkspaceById(workspaceId);
        if (!workspaceOk) {
            set({ isFetchingColumns: false });
            return false;
        }

        const currentWorkspace = get().currentWorkspace;
        if (currentWorkspace) {
            useWorkspaceStore.setState({ currentWorkspace });
        }

        const spacesOk = await get().fetchspaces(workspaceId, 1);
        if (!spacesOk) {
            set({ isFetchingColumns: false });
            return false;
        }

        const fetchedSpaces = get().spaceData[workspaceId] || [];
        const spaceMeta = get().spaceMetadata[workspaceId];
        useWorkspaceStore.setState((state) => ({
            spaceData: { ...state.spaceData, [workspaceId]: fetchedSpaces },
            ...(spaceMeta ? { spaceMetadata: { ...state.spaceMetadata, [workspaceId]: spaceMeta } } : {}),
        }));

        const room = await get().getRoomById(roomId);
        if (!room) {
            set({ isFetchingColumns: false });
            return false;
        }

        const roomWithSpace = { ...room, spaceId: room.spaceId || spaceId };
        set({
            currentRoomDetail: roomWithSpace,
            activeSpaceId: spaceId,
        });
        await get().fetchRooms(spaceId, 1, true);

        const fetchedRooms = get().rooms[spaceId] || [];
        useWorkspaceStore.setState((state) => ({
            rooms: { ...state.rooms, [spaceId]: fetchedRooms },
        }));

        await get().fetchBoardByRoomsDetails(roomId, 1, 30, "ascs");
        if (get().error) {
            set({ isFetchingColumns: false });
            return false;
        }

        set({
            projectActiveItem: "DashMangement",
            isFetchingColumns: false,
        });

        return true;
    },

    navigateToServiceRoom: async ({ roomId, spaceId, workspaceId }) => {
        if (!roomId) return false;

        // Full handles available (the usual case — the backend stores all three
        // at provision time): reuse the deep-link loader verbatim.
        if (workspaceId && spaceId) {
            return get().loadShareTaskDeepLink({
                shareTaskId: roomId,
                workspaceId,
                spaceId,
                roomId,
            });
        }

        // Partial handles: the room is already reachable in the loaded tree, so
        // just select it and pull its board.
        set({ error: null });
        const room = await get().getRoomById(roomId);
        if (!room?._id) return false;

        const resolvedSpaceId = spaceId || room.spaceId || "";
        set({
            currentRoomDetail: { ...room, spaceId: resolvedSpaceId },
            ...(resolvedSpaceId ? { activeSpaceId: resolvedSpaceId } : {}),
        });

        await get().fetchBoardDetails(roomId, resolvedSpaceId || undefined, 1, 30);
        get().setProjectActiveItem("DashMangement");
        return !get().error;
    },

}));