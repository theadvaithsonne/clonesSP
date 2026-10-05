import { create } from "zustand";
import Cookies from "js-cookie";
import { toast } from "sonner"

const API_BASE_URL = "https://uatapi.garage.app/flowboard/v1/stages";

export interface Stage {
    id: string; // Mapped from _id
    _id: string;
    name: string;
    description: string;
    boardId: string;
    orgId: string;
    userId: string;
    status: string;
    order: number;
}

interface CreateStageRequest {
    name: string;
    description: string;
    boardId: string;
    boardSocketId?: string;
    notificationSocketId?: string;
}

interface UpdateStageRequest {
    name?: string;
    description?: string;
    socketId?: string;
    notificationSocketId?: string;
}

interface StageStore {
    stages: Stage[];
    isLoading: boolean;
    error: string | null;

    fetchStages: (orgId: string, boardId: string) => Promise<void>;
    createStage: (stage: CreateStageRequest) => Promise<Stage | null>;
    updateStage: (id: string, updates: UpdateStageRequest) => Promise<void>;
    deleteStage: (id: string, boardSocketId: string, notificationSocketId: string) => Promise<void>;
    setStages: (stages: Stage[]) => void;
    addStages: (stages: Stage[]) => void;
}

export const useStageStore = create<StageStore>((set, get) => ({
    stages: [],
    isLoading: false,
    error: null,

    fetchStages: async (orgId: string, boardId: string) => {
        set({ isLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            // The API requires orgId and boardId as query params
            const response = await fetch(
                `${API_BASE_URL}?size=100`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error("Failed to fetch stages");

            const data = await response.json();

            const newStages = (data?.data || []).map((s: any) => ({
                ...s,
                id: s._id,
            }));

            set({ stages: newStages, isLoading: false });
        } catch (error) {
            console.error("Fetch stages error:", error);
            set({ error: "Failed to load stages", isLoading: false });
            toast.error("Failed to load stages");
        }
    },

    createStage: async (newStage) => {
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(API_BASE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newStage),
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to create stage");
            }

            const createdStage = data?.data || data;

            set((state) => ({
                stages: [...state.stages, { ...createdStage, id: createdStage._id }],
            }));
            toast.success("Stage created successfully");
            return createdStage;
        } catch (error: any) {
            console.error("Create stage error:", error);
            toast.error(error.message || "Failed to create stage");
            return null;
        }
    },

    updateStage: async (id, updates) => {
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${API_BASE_URL}/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updates),
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to update stage");
            }

            const updated = data?.data || data;

            set((state) => ({
                stages: state.stages.map((s) =>
                    s.id === id ? { ...s, ...updated, id: updated._id || s.id } : s
                ),
            }));
            toast.success("Stage updated successfully");
        } catch (error: any) {
            console.error("Update stage error:", error);
            toast.error(error.message || "Failed to update stage");
        }
    },

    deleteStage: async (id, boardSocketId, notificationSocketId) => {
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${API_BASE_URL}/${id}?boardSocketId=${boardSocketId}&notificationSocketId=${notificationSocketId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to delete stage");
            }

            set((state) => ({
                stages: state.stages.filter((s) => s.id !== id),
            }));
            toast.success("Stage deleted successfully");
        } catch (error: any) {
            console.error("Delete stage error:", error);
            toast.error(error.message || "Failed to delete stage");
        }
    },

    setStages: (stages) => set({ stages }),
    addStages: (newStages) => set((state) => ({ stages: [...state.stages, ...newStages] })),
}));
