import { create } from "zustand";
import Cookies from "js-cookie";
import { toast } from "sonner"
import { useStageStore } from "./stageStore";
import { useCardStore } from "./cardStore";

const API_BASE_URL = "https://uatapi.garage.app/flowboard/v1/boards";

export interface Board {
    id: string; // Mapped from _id
    _id: string;
    name: string;
    description: string;
    color: string;
    bgImage?: string;
    starred: boolean;
    lists: number;
    cards: number;
    members: string[];
    lastUpdated: string;
    userId: string;
    orgId: string;
    boardUsers?: {
        totalUserCount?: number
        userData?: BoardUser[]
    }
}
interface BoardUser {
    name?: string
    _id?: string
    userData?: {
        name?: string
        _id?: string

    }
}
export interface Metadata {
    count: number;
    totalPages: number;
    currentPage: number;
    nextPage?: number;
}

interface CreateBoardRequest {
    name: string;
    description: string;
    socketId?: string | null
    color?: string;
    bgImage?: string;
}

interface UpdateBoardRequest {
    name?: string;
    description?: string;
    color?: string;
    bgImage?: string;
    socketId?: string | null
}
interface BoardMember {
    /** The ID of the board this membership belongs to */
    boardId: string;

    /** The unique ID of this board membership record */
    _id: string;

    /** The ID of the user who is a member of the board */
    userId: string;

    /** The ID of the organization the board belongs to */
    orgId: string;

    /** The role of the user in this board (e.g., "admin", "member", "viewer") */
    role: "admin" | "member" | "viewer"; // extend with other roles if needed

    /** Whether the user is the owner of the board */
    isOwner: boolean;

    /** Status of the membership */
    status: "active" | "inactive" | "invited"; // add more statuses if needed

    /** Timestamp when the membership was created */
    createdAt: string; // ISO date string

    /** Timestamp when the membership was last updated */
    updatedAt: string; // ISO date string

    /** MongoDB version key (usually not needed in frontend logic) */
    __v?: number;
}
interface BoardStore {
    // All Boards state
    allBoards: Board[];
    allBoardsMetadata: Metadata | null;
    isLoadingAllBoards: boolean;

    // Starred Boards state
    starredBoards: Board[];
    starredBoardsMetadata: Metadata | null;
    isLoadingStarredBoards: boolean;
    memberData: BoardMember | null;  // Make it nullable so initial state is valid
    // Legacy combined state (for backward compatibility)
    boards: Board[];
    metadata: Metadata | null;
    isLoading: boolean;

    boardDetailsMetadata: Metadata | null; // For specific board details (stages)
    error: string | null;

    // Current board data
    currentBoard: Board | null;

    // Separate fetch functions
    fetchAllBoards: (page?: number) => Promise<void>;
    fetchStarredBoards: (page?: number) => Promise<void>;

    // Legacy fetch (deprecated)
    fetchBoards: (page?: number) => Promise<void>;

    addBoard: (board: CreateBoardRequest) => Promise<void>;
    addBoardSocket: (bord: Board) => Promise<void>;
    updateBoard: (id: string, updates: UpdateBoardRequest, socketId?: string) => Promise<void>;
    updatesocket: (id: string, updates: UpdateBoardRequest) => Promise<void>;
    deleteBoard: (id: string, notificationSocketId: string) => Promise<void>;
    toggleStar: (id: string, isFavorite: boolean, notificationSocketId: string) => Promise<void>;
    fetchBoardDetailsStageId: (boardId: string, page?: number, size?: number, sortOrder?: string, stageId?: string) => Promise<any>;
    fetchBoardDetails: (boardId: string, page?: number, size?: number, sortOrder?: string) => Promise<any>; // Return any for flexibility
    fetchBoardById: (boardId: string) => Promise<Board | null>; // Fetch individual board data

    // Tag Management
    tags: TagParams[];
    addTag: (tag: TagParams) => void;
    updateTag: (id: string, tag: TagParams) => void;
    deleteTag: (id: string) => void;

    incrementListCount: (boardId: string) => void;
    decrementListCount: (boardId: string) => void;
    incrementCardCount: (boardId: string) => void;
    decrementCardCount: (boardId: string) => void;
    addBoardMember: (boardId: string, user: any) => void;
    removeBoardMember: (boardId: string, userId: string) => void;
}

export interface TagParams {
    _id: string;
    boardId: string;
    name: string;
    color: string;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
    // All Boards state
    allBoards: [],
    allBoardsMetadata: null,
    isLoadingAllBoards: true,
    memberData: null,
    // Starred Boards state
    starredBoards: [],
    starredBoardsMetadata: null,
    isLoadingStarredBoards: true,

    // Legacy combined state
    boards: [],
    metadata: null,
    boardDetailsMetadata: null,
    isLoading: false,
    error: null,
    tags: [],

    // Counter actions
    incrementListCount: (boardId: string) => set((state) => {
        const updateBoard = (b: Board) => b.id === boardId ? { ...b, lists: (b.lists || 0) + 1 } : b;
        return {
            allBoards: state.allBoards.map(updateBoard),
            starredBoards: state.starredBoards.map(updateBoard),
            boards: state.boards.map(updateBoard),
            currentBoard: state.currentBoard?.id === boardId ? { ...state.currentBoard, lists: (state.currentBoard.lists || 0) + 1 } : state.currentBoard
        };
    }),




    decrementListCount: (boardId: string) => set((state) => {
        const updateBoard = (b: Board) => b.id === boardId ? { ...b, lists: Math.max((b.lists || 0) - 1, 0) } : b;
        return {
            allBoards: state.allBoards.map(updateBoard),
            starredBoards: state.starredBoards.map(updateBoard),
            boards: state.boards.map(updateBoard),
            currentBoard: state.currentBoard?.id === boardId ? { ...state.currentBoard, lists: Math.max((state.currentBoard.lists || 0) - 1, 0) } : state.currentBoard
        };
    }),
    incrementCardCount: (boardId: string) => set((state) => {
        const updateBoard = (b: Board) => b.id === boardId ? { ...b, cards: (b.cards || 0) + 1 } : b;
        return {
            allBoards: state.allBoards.map(updateBoard),
            starredBoards: state.starredBoards.map(updateBoard),
            boards: state.boards.map(updateBoard),
            currentBoard: state.currentBoard?.id === boardId ? { ...state.currentBoard, cards: (state.currentBoard.cards || 0) + 1 } : state.currentBoard
        };
    }),
    decrementCardCount: (boardId: string) => set((state) => {
        const updateBoard = (b: Board) => b.id === boardId ? { ...b, cards: Math.max((b.cards || 0) - 1, 0) } : b;
        return {
            allBoards: state.allBoards.map(updateBoard),
            starredBoards: state.starredBoards.map(updateBoard),
            boards: state.boards.map(updateBoard),
            currentBoard: state.currentBoard?.id === boardId ? { ...state.currentBoard, cards: Math.max((state.currentBoard.cards || 0) - 1, 0) } : state.currentBoard
        };
    }),
    addBoardMember: (boardId: string, user: any) => set((state) => {
        let currentBoard = state.currentBoard;
        if (currentBoard?.id === boardId && currentBoard.boardUsers) {
            const newUserData = { userData: user };
            const updatedUserData = currentBoard.boardUsers.userData ? [newUserData, ...currentBoard.boardUsers.userData] : [newUserData];

            currentBoard = {
                ...currentBoard,
                boardUsers: {
                    ...currentBoard.boardUsers,
                    totalUserCount: (currentBoard.boardUsers.totalUserCount || 0) + 1,
                    userData: updatedUserData
                }
            };
        }
        return { currentBoard };
    }),
    removeBoardMember: (boardId: string, userId: string) => set((state) => {
        let currentBoard = state.currentBoard;
        if (currentBoard?.id === boardId && currentBoard.boardUsers) {
            const updatedUserData = currentBoard.boardUsers.userData?.filter((u: any) => u?.userData?._id !== userId) || [];

            currentBoard = {
                ...currentBoard,
                boardUsers: {
                    ...currentBoard.boardUsers,
                    totalUserCount: Math.max((currentBoard.boardUsers.totalUserCount || 0) - 1, 0),
                    userData: updatedUserData
                }
            };
        }
        return { currentBoard };
    }),

    // Current board data
    currentBoard: null,

    addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
    updateTag: (id, tag) => set((state) => ({ tags: state.tags.map(t => t._id === id ? { ...t, ...tag } : t) })),
    deleteTag: (id) => set((state) => ({ tags: state.tags.filter(t => t._id !== id) })),

    // Fetch All Boards (isFavorite=false)
    fetchAllBoards: async (page = 1) => {
        set({ isLoadingAllBoards: true, error: null });
        try {
            const token = Cookies.get("auth-token");

            const response = await fetch(
                `https://uatapi.garage.app/flowboard/v1/members/myBoards?page=${page}&size=20`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch all boards");
            }

            const newBoards = (data?.data || []).map((item: any) => {
                const b = item.boardDetails;
                return {
                    ...b,
                    id: b._id,
                    lists: b.stageCount || 0,
                    cards: b.cardCount || 0,
                    members: b?.boardUsers?.userData?.map((u: any) => u?.name || "Member") || [],
                    starred: item.isFavorite || false,
                    lastUpdated: b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : "Recently"
                };
            });


            set((state) => ({
                allBoards: page === 1 ? newBoards : [...state.allBoards, ...newBoards],
                allBoardsMetadata: data.metadata || null,
                isLoadingAllBoards: false
            }));

        } catch (error: any) {
            console.error("Fetch all boards error:", error);
            set({ error: error.message || "Failed to load all boards", isLoadingAllBoards: false });
            toast(error.message || "Failed to load all boards");
        }
    },

    // Fetch Starred Boards (isFavorite=true)
    fetchStarredBoards: async (page = 1) => {
        set({ isLoadingStarredBoards: true, error: null });
        try {
            const token = Cookies.get("auth-token");

            const response = await fetch(
                `https://uatapi.garage.app/flowboard/v1/members/myBoards?page=${page}&size=20&isFavorite=true`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch starred boards");
            }

            const newBoards = (data?.data || []).map((item: any) => {
                const b = item.boardDetails;
                return {
                    ...b,
                    id: b._id,
                    lists: b.stageCount || 0,
                    cards: b.cardCount || 0,
                    members: b?.boardUsers?.userData?.map((u: any) => u?.name || "Member") || [],
                    starred: item.isFavorite || false,
                    lastUpdated: b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : "Recently"
                };
            });


            set((state) => ({
                starredBoards: page === 1 ? newBoards : [...state.starredBoards, ...newBoards],
                starredBoardsMetadata: data.metadata || null,
                isLoadingStarredBoards: false
            }));

        } catch (error: any) {
            console.error("Fetch starred boards error:", error);
            set({ error: error.message || "Failed to load starred boards", isLoadingStarredBoards: false });
            toast(error.message || "Failed to load starred boards");
        }
    },

    fetchBoards: async (page = 1) => {
        set({ isLoading: true, error: null });
        try {
            const token = Cookies.get("auth-token");
            // Use members endpoint to get boards
            const response = await fetch(
                `https://uatapi.garage.app/flowboard/v1/members/myBoards?page=${page}&size=20&isFavorite=false`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch boards");
            }

            const newBoards = (data?.data || []).map((item: any) => {
                const b = item.boardDetails;
                return {
                    ...b,
                    id: b._id,
                    lists: b.stageCount || 0,
                    cards: b.cardCount || 0,
                    members: b?.boardUsers?.userData?.map((u: any) => u?.name || "Member") || [],
                    starred: item.isFavorite || false,
                    lastUpdated: b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : "Recently"
                };
            });
            set((state) => ({
                boards: page === 1 ? newBoards : [...state.boards, ...newBoards],
                metadata: data.metadata || null,
                isLoading: false
            }));

        } catch (error: any) {
            console.error("Fetch boards error:", error);
            set({ error: error.message || "Failed to load boards", isLoading: false });
            toast(error.message || "Failed to load boards");
        }
    },

    addBoard: async (newBoard) => {
        // isLoading handled locally in component to prevent global skeleton/spinner
        try {
            const token = Cookies.get("auth-token");
            const response = await fetch(API_BASE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newBoard),
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to create board");
            }

            const createdBoard = data?.data || data; // Handle varying response wrapper

            const newBoardData = {
                ...createdBoard,
                id: createdBoard._id,
                lists: 0,
                cards: 0,
                members: [],
                starred: false,
                lastUpdated: "Just now",
            };

            set((state) => ({
                boards: [newBoardData, ...state.boards],
                allBoards: [newBoardData, ...state.allBoards], // Add to allBoards since it's not starred
            }));
            toast.success("Board created successfully");
        } catch (error: any) {
            console.error("Create board error:", error);
            toast(error.message || "Failed to create board");
        }
    },

    addBoardSocket: async (newBoard) => {
        const newBoardData = {
            ...newBoard,
            id: newBoard._id,
            lists: 0,
            cards: 0,
            members: [],
            starred: false,
            lastUpdated: "Just now",
        };

        set((state) => ({
            boards: [newBoardData, ...state.boards],
            allBoards: [newBoardData, ...state.allBoards], // Add to allBoards since it's not starred
        }));
    },

    updateBoard: async (id, updates, notificationSocketId) => {
        // isLoading handled locally
        try {
            const token = Cookies.get("auth-token");
            const response = await fetch(`${API_BASE_URL}/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...updates,        // the actual board changes
                    notificationSocketId,          // ← sent to backend for broadcast exclusion
                    // or use a clearer name: senderSocketId: socketId
                }),
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to update board");
            }

            // Assuming API returns the updated object
            const updated = data?.data || data;

            set((state) => ({
                boards: state.boards.map((b) =>
                    // Merge existing, updates (optimistic), and server response
                    b.id === id ? { ...b, ...updates, ...updated, id: updated._id || b.id } : b
                ),
                allBoards: state.allBoards.map((b) =>
                    b.id === id ? { ...b, ...updates, ...updated, id: updated._id || b.id } : b
                ),
                starredBoards: state.starredBoards.map((b) =>
                    b.id === id ? { ...b, ...updates, ...updated, id: updated._id || b.id } : b
                ),
            }));
            toast.success("Board updated successfully");
        } catch (error: any) {
            console.error("Update board error:", error);
            toast(error.message || "Failed to update board");
        }
    },

    updatesocket: async (id, updates) => {
        set((state) => ({
            boards: state.boards.map((b) =>
                // Merge existing, updates (optimistic), and server response
                b.id === id ? { ...b, ...updates, id: b.id } : b
            ),
            allBoards: state.allBoards.map((b) =>
                b.id === id ? { ...b, ...updates, id: b.id } : b
            ),
            starredBoards: state.starredBoards.map((b) =>
                b.id === id ? { ...b, ...updates, id: b.id } : b
            ),
        }));
    },

    deleteBoard: async (id, notificationSocketId) => {
        set({ isLoading: true });
        try {
            const token = Cookies.get("auth-token");
            const response = await fetch(`${API_BASE_URL}/${id}?notificationSocketId=${notificationSocketId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to delete board");
            }

            set((state) => ({
                boards: state.boards.filter((b) => b.id !== id),
                allBoards: state.allBoards.filter((b) => b.id !== id),
                starredBoards: state.starredBoards.filter((b) => b.id !== id),
                isLoading: false,
            }));
            toast("Board deleted successfully");
        } catch (error: any) {
            console.error("Delete board error:", error);
            toast(error.message || "Failed to delete board");
            set({ isLoading: false });
        }
    },
    toggleStarSocket: async (id: string, isFavorite: boolean) => {
        if (isFavorite) {
            // Moving to starred: remove from allBoards, add to starredBoards
            set((state) => ({
                allBoards: state.allBoards.filter((b) => b.id !== id),

            }));
        } else {
            // Moving to all boards: remove from starredBoards, add to allBoards
            set((state) => ({
                starredBoards: state.starredBoards.filter((b) => b.id !== id),
                // allBoards: [updatedBoard, ...state.allBoards],
                // boards: state.boards.map((b) => b.id === id ? updatedBoard : b),
            }));
        }
    },

    toggleStar: async (id: string, isFavorite: boolean, notificationSocketId) => {
        // Optimistic update - save previous state for rollback
        const previousAllBoards = get().allBoards;
        const previousStarredBoards = get().starredBoards;
        const previousBoards = get().boards;

        // Find the board in either list
        const board = [...get().allBoards, ...get().starredBoards].find(b => b.id === id);

        if (board) {
            // Update the board's starred status
            const updatedBoard = { ...board, starred: isFavorite };

            // Move board between lists based on isFavorite
            if (isFavorite) {
                // Moving to starred: remove from allBoards, add to starredBoards
                set((state) => ({
                    allBoards: state.allBoards.filter((b) => b.id !== id),
                    starredBoards: [updatedBoard, ...state.starredBoards],
                    boards: state.boards.map((b) => b.id === id ? updatedBoard : b),
                }));
            } else {
                // Moving to all boards: remove from starredBoards, add to allBoards
                set((state) => ({
                    starredBoards: state.starredBoards.filter((b) => b.id !== id),
                    allBoards: [updatedBoard, ...state.allBoards],
                    boards: state.boards.map((b) => b.id === id ? updatedBoard : b),
                }));
            }
        }

        try {
            const token = Cookies.get("auth-token");
            const response = await fetch(`https://uatapi.garage.app/flowboard/v1/boards/favorite/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ isFavorite, socketId: notificationSocketId }),
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to update favorite status");
            }

            toast("Board successfully Updated ");
        } catch (error: any) {
            console.error("Toggle star error:", error);
            toast(error.message || "Failed to update favorite status");
            // Rollback on error
            set({
                allBoards: previousAllBoards,
                starredBoards: previousStarredBoards,
                boards: previousBoards
            });
        }
    },

    fetchBoardDetailsStageId: async (boardId: string, page = 1, size = 30, sortOrder?: string, stageId?: string) => {
        set({ isLoading: true, error: null });
        try {
            const token = Cookies.get("auth-token");
            // API: /v1/boards/detail/:id?page=X&size=Y
            const response = await fetch(
                `${API_BASE_URL}/detail/${boardId}?page=${page}&size=${size}&sortBy=createdAt&sortOrder=${sortOrder}&stageId=${stageId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch board details");
            }

            const stagesData = data?.data || [];
            const MemberDatalist = data?.MemberData || [];
            // Format Stages - Direct Mapping as per user request
            // We use spread to keep all fields, but ensure _id and name are present
            const formattedStages = stagesData.map((s: any) => ({
                ...s,
                _id: s._id,
                name: s.name,
            }));
            const currentState = get();
            if (page === 1) {

                set({ memberData: data?.memberData ?? null }); // or just data?.memberData
            }
            // Extract Tags - Assumptions: tags are in data.tags based on user request "in fetchBoardDetails ... already tagData and tags"
            // Or maybe inside the stagesData?
            // If the user says "API response", and previously we used `fetch(`${API_BASE_URL}?boardId=${boardId}`...` for tags.
            // Here `data` is the response from `/detail/:id`.
            // Let's assume `data.tags` exists.

            const fetchedTags = data.tags || data.tagData || [];
            if (fetchedTags.length > 0) {
                set({ tags: fetchedTags });
            } else {
                // If not in root, maybe we should construct from cards? 
                // But `card.tagData` is per card. 
                // If the user insists it's there, I'll trust `data.tags` or `data.tagData`.
                // Let's also check if it returns `tags` inside `data.data` (which is stagesData in my code but maybe it's `data: { stages: [], tags: [] }`?)
                // My code: `const stagesData = data?.data || [];`
                // If data.data IS array, then `tags` must be at `data.tags`.
                // If data.data IS object, then previous code `data.data || []` would have failed if stages data wasn't array...
                // Wait, previous code: `const stagesData = data?.data || [];`. If `data.data` is object, `stagesData.map` would crash. 
                // BUT the code ran fine before? 
                // The user says "in fetchBoardDetails function there already tagData and tags". 
                // I will assume `data.tags`.
            }

            // To be safe, if we find tags in `data.tags`, we set them.
            if (data.tags && Array.isArray(data.tags)) {
                set({ tags: data.tags });
            } else if (data.tagData && Array.isArray(data.tagData)) {
                set({ tags: data.tagData });
            }


            // Extract and Format Cards
            const formattedCards = stagesData.flatMap((s: any) => {
                const stageCards = s.cardData || [];
                return stageCards.map((c: any) => ({
                    ...c,
                    _id: c._id,
                    boardId: c.boardId,
                    stageId: c.stageId,
                    name: c.name, // Use name as per API
                    // assignedToIds, tags, etc. should be in 'c' as per API response
                }));
            });

            if (page === 1) {
                useStageStore.getState().setStages(formattedStages);
                useCardStore.getState().setCards(formattedCards);
            } else {
                useStageStore.getState().addStages(formattedStages);
                useCardStore.getState().addCards(formattedCards);
            }

            // Update Metadata for pagination if needed
            set({
                boardDetailsMetadata: data.metadata || null,
                isLoading: false
            });

            return formattedStages; // Return data for component usage

        } catch (error: any) {
            console.error("Fetch board details error:", error);
            set({ error: error.message || "Failed to load board details", isLoading: false });
            toast(error.message || "Failed to load board details");
            return []; // Return empty on error
        }
    },



    fetchBoardDetails: async (boardId: string, page = 1, size = 30, sortOrder?: string) => {
        set({ isLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            // API: /v1/boards/detail/:id?page=X&size=Y
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/detail/${boardId}?page=${page}&size=${size}&cardSize=30`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch board details");
            }

            const stagesData = data?.data || [];
            const MemberDatalist = data?.MemberData || [];
            // Format Stages - Direct Mapping as per user request
            // We use spread to keep all fields, but ensure _id and name are present
            const formattedStages = stagesData.map((s: any) => ({
                ...s,
                _id: s._id,
                name: s.name,
                userId: s?.userId,
                roomId: s?.roomId,
            }));
            const currentState = get();
            if (page === 1) {

                set({ memberData: data?.memberData ?? null }); // or just data?.memberData
            }
            // Extract Tags - Assumptions: tags are in data.tags based on user request "in fetchBoardDetails ... already tagData and tags"
            // Or maybe inside the stagesData?
            // If the user says "API response", and previously we used `fetch(`${API_BASE_URL}?boardId=${boardId}`...` for tags.
            // Here `data` is the response from `/detail/:id`.
            // Let's assume `data.tags` exists.

            const fetchedTags = data.tags || data.tagData || [];
            if (fetchedTags.length > 0) {
                set({ tags: fetchedTags });
            } else {
                // If not in root, maybe we should construct from cards? 
                // But `card.tagData` is per card. 
                // If the user insists it's there, I'll trust `data.tags` or `data.tagData`.
                // Let's also check if it returns `tags` inside `data.data` (which is stagesData in my code but maybe it's `data: { stages: [], tags: [] }`?)
                // My code: `const stagesData = data?.data || [];`
                // If data.data IS array, then `tags` must be at `data.tags`.
                // If data.data IS object, then previous code `data.data || []` would have failed if stages data wasn't array...
                // Wait, previous code: `const stagesData = data?.data || [];`. If `data.data` is object, `stagesData.map` would crash. 
                // BUT the code ran fine before? 
                // The user says "in fetchBoardDetails function there already tagData and tags". 
                // I will assume `data.tags`.
            }

            // To be safe, if we find tags in `data.tags`, we set them.
            if (data.tags && Array.isArray(data.tags)) {
                set({ tags: data.tags });
            } else if (data.tagData && Array.isArray(data.tagData)) {
                set({ tags: data.tagData });
            }





            // Update Metadata for pagination if needed
            set({
                boardDetailsMetadata: data.metadata || null,
                isLoading: false
            });

            return formattedStages; // Return data for component usage

        } catch (error: any) {
            console.error("Fetch board details error:", error);
            set({ error: error.message || "Failed to load board details", isLoading: false });
            toast(error.message || "Failed to load board details");
            return []; // Return empty on error
        }
    },

    fetchBoardById: async (boardId: string) => {
        try {
            const token = Cookies.get("auth-token");
            const response = await fetch(
                `https://uatapi.garage.app/flowboard/v1/members/myBoards?page=1&size=50&boardId=${boardId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch board");
            }

            // The API returns an array, we need the first item
            const boardItem = data?.data?.[0];
            if (!boardItem) {
                return null;
            }

            const b = boardItem.boardDetails;
            const board: Board = {
                ...b,
                id: b._id,
                lists: b.stageCount || 0,
                cards: b.cardCount || 0,
                members: b?.boardUsers?.userData?.map((u: any) => u?.name || "Member") || [],
                starred: boardItem.isFavorite || false,
                lastUpdated: b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : "Recently"
            };

            set({ currentBoard: board });
            return board;

        } catch (error: any) {
            console.error("Fetch board by ID error:", error);
            toast(error.message || "Failed to load board");
            return null;
        }
    }
}));
