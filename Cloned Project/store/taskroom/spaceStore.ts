import { create } from 'zustand';
import axios from 'axios';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import { useTaskroomWorkspacetore } from './taskroomWorkspace';

export interface SpaceMember {
    _id: string;
    userId: {
        _id: string;
        name: string;
        email: string;
        avatar?: string;
    };
    role: "member" | "observer" | "admin";
}

export interface CreateSpaceRequest {
    name: string;
    description?: string;
    color: string;
    icon?: string;
    spaceCode: string;
    isPrivate: boolean;
    workspaceId: string;
    members: { _id: string; name: string; email: string; role?: string }[];
}

interface SpaceState {
    members: SpaceMember[];
    isLoading: boolean;
    isCreating: boolean;
    isAddingMember: boolean;
    error: string | null;
    fetchSpaceMembers: (workspaceId: string, spaceId: string) => Promise<void>;
    addSpaceMember: (data: { trUserId: string; spaceId: string; workspaceId: string; role?: string }) => Promise<void>;
    createSpace: (data: CreateSpaceRequest) => Promise<boolean>;
    updateSpace: (spaceId: string, data: Partial<CreateSpaceRequest>) => Promise<boolean>;
    deleteSpace: (spaceId: string) => Promise<boolean>;
}

export const useSpaceStore = create<SpaceState>((set, get) => ({
    members: [],
    isLoading: false,
    isCreating: false,
    isAddingMember: false,
    error: null,

    updateSpace: async (spaceId, data) => {
        set({ isCreating: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.put(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces/${spaceId}`,
                data,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                toast.success("Space updated successfully");
                // Refresh spaces in workspace store
                const workspaceId = data.workspaceId || response.data?.data?.workspaceId;
                if (workspaceId) {
                    useTaskroomWorkspacetore.getState().fetchspaces(workspaceId);
                }
                return true;
            } else {
                toast.error(response.data?.message || "Failed to update space");
                return false;
            }
        } catch (error: any) {
            console.error("Failed to update space:", error);
            toast.error(error.response?.data?.message || 'Failed to update space');
            return false;
        } finally {
            set({ isCreating: false });
        }
    },

    deleteSpace: async (spaceId) => {
        set({ isLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.delete(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces/${spaceId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                toast.success("Space deleted successfully");
                // Refresh spaces in workspace store - might need workspaceId
                // For now, let's hope the caller handles refresh or we find workspaceId
                return true;
            } else {
                toast.error(response.data?.message || "Failed to delete space");
                return false;
            }
        } catch (error: any) {
            console.error("Failed to delete space:", error);
            toast.error(error.response?.data?.message || 'Failed to delete space');
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    fetchSpaceMembers: async (workspaceId: string, spaceId: string) => {
        set({ isLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members?workspace=${workspaceId}&space=${spaceId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                set({ members: response.data?.data || [], isLoading: false });
            } else {
                set({ isLoading: false, error: response.data?.message || "Failed to fetch space members" });
            }
        } catch (error: any) {
            console.error("Failed to fetch space members:", error);
            set({
                isLoading: false,
                error: error.response?.data?.message || error.message || 'Failed to fetch space members'
            });
        }
    },

    addSpaceMember: async (data) => {
        if (get().isAddingMember) return;
        set({ isAddingMember: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members`,
                data,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                toast.success("Member added to space");
                // Refresh members
                get().fetchSpaceMembers(data.workspaceId, data.spaceId);
            } else {
                toast.error(response.data?.message || "Failed to add member");
            }
        } catch (error: any) {
            console.error("Failed to add space member:", error);
            toast.error(error.response?.data?.message || 'Failed to add member');
        } finally {
            set({ isAddingMember: false });
        }
    },

    createSpace: async (data) => {
        if (get().isCreating) return false;
        set({ isCreating: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces`,
                data,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                const newSpace = response.data?.data?.data;
                if (newSpace) {
                    useTaskroomWorkspacetore.getState().addSpace({
                        ...newSpace,
                        workspaceId: newSpace.workspaceId || data.workspaceId,
                    });
                }
                toast.success("Space created successfully");
                return true;
            } else {
                toast.error(response.data?.message || "Failed to create space");
                return false;
            }
        } catch (error: any) {
            console.error("Failed to create space:", error);
            toast.error(error.response?.data?.message || 'Failed to create space');
            return false;
        } finally {
            set({ isCreating: false });
        }
    },
}));
