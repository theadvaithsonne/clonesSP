import { create } from "zustand";
import Cookies from "js-cookie";
import { toast } from "sonner"

const API_BASE_URL = `${process.env.NEXT_PUBLIC_TASKROOM_URL}`;

export interface Card {
    id: string; // Mapped from _id
    _id: string;
    boardId: string;
    stageId: string;
    name: string;
    description: string;
    cardCount?: number;
    commentCount?: number;
    tags: string[]; // IDs
    isCompleted?: boolean;

    tagData: Array<{ _id: string; name: string; color: string }>;
    assignedToIds: Array<{
        _id: string;
        userId: string;
        name: string;
        email: string;
        avatar?: string;
    }>;
    startDate?: string | number;
    dueDate?: string | number;
    createdAt?: string;
    updatedAt?: string;
    // Add other fields as per API response if needed
}

export interface CreateCardRequest {
    boardId?: string;
    stageId: string;
    priority?: string;
    roomId?: string;
    title?: string;
    name?: string;
    startDate?: number | null,
    dueDate?: number | null,
    description?: string;
    tags?: string[];
    assignedToIds?: any[]; // API likely expects IDs here
    boardSocketId?: string;
    notificationSocketId?: string;
}

export interface UpdateCardRequest {
    name?: string;
    title?: string;
    description?: string;
    tags?: string[];
    userAddAssignedToIds?:string
    assignedToIds?: Array<{ assignedToIds: string }>; // Update assignment
    stageId?: string; // For moving cards
    startDate?: number | null;
    dueDate?: number | null;
    attachments?: Array<{
        fileLink: string;
        fileName: string;
        fileType: "document" | "image" | "video";
        comment: string;
    }>;
    socketId?: string;
    tagRemoveItemIds?: string
    notificationSocketId?: string;
    userAssignedToIds?: string
    userRemoveAssignedToIds?: string
}

interface CardMetadata {
    currentPage: number;
    totalPages: number;
    isLoading: boolean;
}

interface CardStore {
    cards: Card[];
    isLoading: boolean;
    error: string | null;
    cardMetadata: Record<string, CardMetadata>; // Key is stageId
    sharedLongUrl?: string;

    fetchCards: (boardId: string, page?: number, size?: number) => Promise<void>;
    fetchCardsForStage: (stageId: string, page?: number, size?: number) => Promise<{ cards: Card[], totalPages: number }>;
    createCard: (card: CreateCardRequest) => Promise<any>;
    updateCard: (id: string, updates: UpdateCardRequest) => Promise<any>;
    moveCard: (id: string, payload: { toStageId: string; toTaskId?: string; toBottom: boolean }) => Promise<any | null>;
    deleteCard: (id: string, stageId: string) => Promise<void>;
    toggleComplete: (id: string, isCompleted: boolean, boardSocketId?: string, notificationSocketId?: string) => Promise<void>;
    setCards: (cards: Card[]) => void;
    addCards: (cards: Card[]) => void;
    setStageMetadata: (stageId: string, metadata: CardMetadata) => void;
    setSharedLongUrl: (url?: string) => void;
}

export const useCardStore = create<CardStore>((set, get) => ({
    cards: [],
    isLoading: false,
    error: null,
    cardMetadata: {},
    sharedLongUrl: undefined,

    fetchCards: async (boardId: string, page = 2, size = 10) => {

        // not required 
        set({ isLoading: true, error: null });
        try {
            const token = Cookies.get("auth-token");
            const response = await fetch(
                `${API_BASE_URL}?boardId=${boardId}&size=${size}&page=${page}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch cards");
            }

            const newCards = (data?.data || []).map((c: any) => ({
                ...c,
                id: c._id,
                assignedToIds: c.assignedToIds || [],
                tags: (c.tags || []).map((t: any) => typeof t === 'string' ? t : t._id),
                tagData: c.tagData || (Array.isArray(c.tags) && typeof c.tags[0] !== 'string' ? c.tags : []),
            }));

            set({ cards: newCards, isLoading: false });

        } catch (error: any) {
            console.error("Fetch cards error:", error);
            set({ error: error.message || "Failed to load cards", isLoading: false });
            toast.error(error.message || "Failed to load cards");
        }
    },

    fetchCardsForStage: async (stageId: string, page = 2, size = 30) => {

        const metadata = get().cardMetadata[stageId];

        // Set loading state for this stage
        set((state) => ({
            cardMetadata: {
                ...state.cardMetadata,
                [stageId]: {
                    ...state.cardMetadata[stageId],
                    isLoading: true,
                    // We update metadata on success, but don't read it for request
                }
            }
        }));
        try {
            const token = localStorage.getItem("garage_tok");
            const currentPage = page; // Use passed argument
            const nextPage = page; // The argument IS the page we want to fetch (next page passed from component)

            const response = await fetch(
                `${API_BASE_URL}stages/detail/${stageId}?size=${size}&page=${nextPage}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch cards");
            }

            const newCards = (data?.data || []).map((c: any) => ({
                ...c,
                id: c._id,
                assignedToIds: c.assignedToIds || [],
                tags: (c.tags || []).map((t: any) => typeof t === 'string' ? t : t._id),
                tagData: c.tagData || (Array.isArray(c.tags) && typeof c.tags[0] !== 'string' ? c.tags : []),
            }));

            // Update metadata in store (still useful for other things even if component ignores it for fetching)
            set((state) => ({
                cardMetadata: {
                    ...state.cardMetadata,
                    [stageId]: {
                        ...state.cardMetadata[stageId],
                        // If result is valid, we have new data
                        currentPage: data?.metadata?.currentPage || currentPage,
                        totalPages: data?.metadata?.totalPages || 0,
                        isLoading: false
                    }
                }
            }));

            // Return both cards and metadata for local component control
            return {
                cards: newCards,
                totalPages: data?.metadata?.totalPages || 0
            }

        } catch (error: any) {
            console.error("Error fetching cards:", error);

            // Reset loading state on error
            set((state) => ({
                cardMetadata: {
                    ...state.cardMetadata,
                    [stageId]: {
                        ...state.cardMetadata[stageId],
                        isLoading: false
                    }
                }
            }));
            toast.error(error.message || "Failed to load more cards");
            return { cards: [], totalPages: 0 };
        }
    },

    createCard: async (newCard) => {
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newCard),
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to create card");
            }

            const createdCard = data?.data || data;

            // set((state) => ({
            //     cards: [...state.cards, {
            //         ...createdCard,
            //         id: createdCard._id,
            //         tags: (createdCard.tags || []).map((t: any) => typeof t === 'string' ? t : t._id),
            //         tagData: createdCard.tagData || (Array.isArray(createdCard.tags) && typeof createdCard.tags[0] !== 'string' ? createdCard.tags : []),
            //         assignedToIds: createdCard.assignedToIds || []
            //     }],
            // }));
            toast.success(data.message || "Card created successfully");
            return createdCard;
        } catch (error: any) {
            console.error("Create card error:", error);
            toast.error(error.message || "Failed to create card");
            return null;
        }
    },

    updateCard: async (id, updates) => {
        // Optimistic update
        const previousCards = get().cards;
        // set((state) => ({
        //     cards: state.cards.map((c) => {
        //         if (c.id === id) {
        //             const { assignedToIds, ...safeUpdates } = updates;
        //             return { ...c, ...safeUpdates };
        //         }
        //         return c;
        //     }),
        // }));

        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updates),
            });

            const data = await response.json();

            // if (!response.ok || data.status === false) {
            //     // Revert optimistic update
            //     set({ cards: previousCards });
            //     toast(data.message || "Failed to update card");
            // }
            if (data.status) {
                const updated = data?.data || data;

                set((state) => ({
                    cards: state.cards.map((c) =>
                        c.id === id ? {
                            ...c,
                            ...updated,
                            description: updated?.description,
                            id: updated._id || c.id,
                            tags: updated.tags ? updated.tags.map((t: any) => typeof t === 'string' ? t : t._id) : c.tags,
                            tagData: updated.tagData || (updated.tags && typeof updated.tags[0] !== 'string' ? updated.tags : c.tagData),
                            assignedToIds: updated.assignedToIds || c.assignedToIds
                        } : c
                    ),
                }));
                // Only show success toast if user explicitly requested for all success.
                // But for simple drags it might be too much.
                // However, request is explicit: "for all api add toat messag idf there error or success fron data.message"
                // I'll add it.
                toast.success(data.message || "Card updated successfully");
                return data;
            }
            else {
                set({ cards: previousCards });
                toast.error(data.message || "Failed to update card");
                throw new Error(data.message || "Failed to update card");
            }

        } catch (error: any) {
            console.error("Update card error:", error);
            toast.error(error.message || "Failed to update card");
            throw error;
        }
    },

    moveCard: async (id: string, payload: { toStageId: string; toTaskId?: string; toBottom: boolean }) => {
        try {
            const token = localStorage.getItem("garage_tok");
            const body: { toStageId: string; toBottom: boolean; toTaskId?: string; orderType: "desc" } = {
                toStageId: payload.toStageId,
                toBottom: payload.toBottom,
                // Lists render newest first (createdAt desc)
                orderType: "desc",
            };
            if (payload.toTaskId) {
                body.toTaskId = payload.toTaskId;
            }
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/shift/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            let data: any = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }

            if (!response.ok || data?.status === false) {
                const message = data?.message || "Failed to move card";
                toast.error(message);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error("Move card error:", error);
            toast.error(error.message || "Failed to move card");
            return null;
        }
    },

    deleteCard: async (id) => {
        try {
            const token = localStorage.getItem("garage_tok");
            const boardSocketId = undefined;
            const notificationSocketId = undefined;
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to delete card");
            }

            set((state) => ({
                cards: state.cards.filter((c) => c.id !== id),
            }));
            toast.success(data.message || "Card deleted successfully");
        } catch (error: any) {
            console.error("Delete card error:", error);
            toast.error(error.message || "Failed to delete card");
        }
    },

    toggleComplete: async (id, isCompleted) => {
        // Optimistic update
        const previousCards = get().cards;
        set((state) => ({
            cards: state.cards.map((c) =>
                c.id === id || c._id === id ? { ...c, isCompleted } : c
            ),
        }));
        const socketId = undefined;
        try {
            const token = Cookies.get("auth-token");
            const response = await fetch(`${API_BASE_URL}/complete/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ isCompleted, socketId }),
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                // Revert optimistic update
                set({ cards: previousCards });
                throw new Error(data.message || "Failed to toggle completion status");
            }

            // Update with server response if available
            const updated = data?.data || data;
            if (updated) {
                set((state) => ({
                    cards: state.cards.map((c) =>
                        c.id === id || c._id === id
                            ? { ...c, isCompleted: updated.isCompleted ?? isCompleted }
                            : c
                    ),
                }));
            }

            toast.success(data.message || (isCompleted ? "Card marked as complete" : "Card marked as incomplete"));
        } catch (error: any) {
            console.error("Toggle complete error:", error);
            toast.error(error.message || "Failed to update completion status");
            throw error;
        }
    },

    setCards: (cards) => set({ cards }),
    addCards: (newCards) => set((state) => ({ cards: [...state.cards, ...newCards] })),
    setStageMetadata: (stageId, metadata) => set((state) => ({
        cardMetadata: {
            ...state.cardMetadata,
            [stageId]: metadata
        }
    })),
    setSharedLongUrl: (url) => set({ sharedLongUrl: url }),
}));
