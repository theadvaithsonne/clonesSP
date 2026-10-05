import { create } from "zustand";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { useBoardStore, TagParams } from "./boardStore";

const API_BASE_URL = "https://uatapi.garage.app/flowboard/v1/tags";

export interface Tag {
    _id: string;
    boardId: string;
    name: string;
    color: string;
}

interface CreateTagRequest {
    boardId?: string;
    name: string;
    color: string;
    socketId?: string
    workspaceId?: string
    spaceId: string
}

interface UpdateTagRequest {
    name: string;
    color: string;
    tagItemIds?: string
    socketId?: string
}

interface TagStore {
    isLoading: boolean;
    error: string | null;

    createTag: (data: CreateTagRequest) => Promise<Tag | null>;
    updateTag: (id: string, data: UpdateTagRequest) => Promise<Tag | null>;
    deleteTag: (id: string, socketId?: string) => Promise<boolean>;
}

export const useTagStore = create<TagStore>((set, get) => ({
    isLoading: false,
    error: null,

    createTag: async (data: CreateTagRequest) => {
        set({ isLoading: true });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tags`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) throw new Error("Failed to create tag");

            const resData = await response.json();
            const newTag = resData.data?.data;

            // Update Board Store
            // useBoardStore.getState().addTag(newTag);

            set({ isLoading: false });
            toast.success("Tag created successfully");
            return newTag;
        } catch (error: any) {
            console.error("Create tag error:", error);
            toast.error(error.message || "Failed to create tag");
            set({ isLoading: false });
            return null;
        }
    },

    updateTag: async (id: string, data: UpdateTagRequest) => {
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tags/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) throw new Error("Failed to update tag");

            const resData = await response.json();
            const updatedTag = resData.data;
            const fullUpdatedTag = { ...updatedTag, _id: id };

            // Update Board Store
            useBoardStore.getState().updateTag(id, fullUpdatedTag);

            toast.success("Tag updated successfully");
            return fullUpdatedTag;
        } catch (error: any) {
            console.error("Update tag error:", error);
            toast.error(error.message || "Failed to update tag");
            return null;
        }
    },

    deleteTag: async (id: string, socketId?: string) => {
        try {
            const token = localStorage.getItem("garage_tok");
            const query = socketId ? `?socketId=${encodeURIComponent(socketId)}` : "";
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tags/${id}${query}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error("Failed to delete tag");

            // Update Board Store
            useBoardStore.getState().deleteTag(id);

            toast.success("Tag deleted successfully");
            return true;
        } catch (error: any) {
            console.error("Delete tag error:", error);
            toast.error(error.message || "Failed to delete tag");
            return false;
        }
    },
}));
