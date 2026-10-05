import { create } from "zustand";
import Cookies from "js-cookie";
import { toast } from "sonner";

export interface ChecklistItem {
    _id: string;
    description: string;
    isCompleted: boolean;
    taskId: string;
    boardId: string;
}

interface ChecklistStore {
    checklistItems: ChecklistItem[];
    isLoading: boolean;
    error: string | null;
    fetchChecklistItems: (taskId: string, boardId: string) => Promise<void>;
    createChecklistItem: (
        taskId: string,
        description: string,
        boardId: string
    ) => Promise<void>;
    updateChecklistItem: (
        checklistId: string,
        updates: { description?: string; isCompleted?: boolean }
    ) => Promise<void>;
    deleteChecklistItem: (checklistId: string, taskId: string) => Promise<void>;
    addChecklistItemFromSocket: (item: ChecklistItem) => void;
    updateChecklistItemFromSocket: (item: ChecklistItem) => void;
    deleteChecklistItemFromSocket: (checklistId: string) => void;
}

const API_BASE_URL = "https://uatapi.garage.app/flowboard/v1/tasks/checklists";
// Note: Based on user request
// Create: POST baseurl+/v1/tasks/:id/checklists -> body: { description }
// Get: GET baseurl+/v1/tasks/checklists/ -> query: taskId
// Edit: PUT baseurl+/v1/tasks/checklists/:id -> body: { description } (and likely isCompleted or status)
// Delete: DELETE baseurl+/v1/tasks/checklists/:id

export const useChecklistStore = create<ChecklistStore>((set, get) => ({
    checklistItems: [],
    isLoading: false,
    error: null,

    fetchChecklistItems: async (taskId, boardId) => {
        set({ isLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(
                `${API_BASE_URL}?taskId=${taskId}&boardId=${boardId}&size=100`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            const data = await response.json();
            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch checklist items");
            }
            set({ checklistItems: data.data || [], isLoading: false });
        } catch (error: any) {
            console.error("Fetch checklist error:", error);
            set({ error: error.message, isLoading: false });
        }
    },

    createChecklistItem: async (taskId, description, boardId) => {
        try {
            const token = localStorage.getItem("garage_tok");
            // URL: baseurl+/v1/tasks/:id/checklists
            const url = `https://uatapi.garage.app/flowboard/v1/tasks/${taskId}/checklists`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ description }),
            });

            const data = await response.json();
            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to create checklist item");
            }

            // Optimistic or Fetch? Let's just append for now if return matches
            // But standard is likely to re-fetch or append.
            // Assuming data.data is the new item
            const newItem = data.data;
            set((state) => ({
                checklistItems: [...state.checklistItems, newItem],
            }));
            toast.success("Checklist item added");
        } catch (error: any) {
            console.error("Create checklist error:", error);
            toast.error(error.message || "Failed to create checklist item");
        }
    },

    updateChecklistItem: async (checklistId, updates) => {
        // Optimistic update
        const previousItems = get().checklistItems;
        set((state) => ({
            checklistItems: state.checklistItems.map((item) =>
                item._id === checklistId ? { ...item, ...updates } : item
            ),
        }));

        try {
            const token = localStorage.getItem("garage_tok");
            // URL: baseurl+/v1/tasks/checklists/:id
            const response = await fetch(`${API_BASE_URL}/${checklistId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updates),
            });

            const data = await response.json();
            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to update checklist item");
            }
            // Success, maybe update with server data if needed, but optimistic was likely fine
        } catch (error: any) {
            console.error("Update checklist error:", error);
            set({ checklistItems: previousItems }); // Revert
            toast.error(error.message || "Failed to update checklist item");
        }
    },

    deleteChecklistItem: async (checklistId, taskId) => {
        // Optimistic
        const previousItems = get().checklistItems;
        set((state) => ({
            checklistItems: state.checklistItems.filter((i) => i._id !== checklistId),
        }));

        try {
            const token = localStorage.getItem("garage_tok");
            // URL: baseurl+/v1/tasks/checklists/:id
            const response = await fetch(`${API_BASE_URL}/${checklistId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to delete checklist item");
            }
            toast.success("Checklist item deleted");
        } catch (error: any) {
            console.error("Delete checklist error:", error);
            set({ checklistItems: previousItems });
            toast.error(error.message || "Failed to delete checklist item");
        }
    },

    addChecklistItemFromSocket: (newItem: ChecklistItem) => {
        set((state) => {
            const exists = state.checklistItems.some((i) => i._id === newItem._id);
            if (exists) return state;
            return {
                checklistItems: [...state.checklistItems, newItem],
            };
        });
    },

    updateChecklistItemFromSocket: (updatedItem: ChecklistItem) => {
        set((state) => ({
            checklistItems: state.checklistItems.map((item) =>
                item._id === updatedItem._id ? { ...item, ...updatedItem } : item
            ),
        }));
    },

    deleteChecklistItemFromSocket: (checklistId: string) => {
        set((state) => ({
            checklistItems: state.checklistItems.filter((i) => i._id !== checklistId),
        }));
    },
}));
