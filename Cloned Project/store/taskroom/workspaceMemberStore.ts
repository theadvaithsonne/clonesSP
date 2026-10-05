import { create } from 'zustand';
import axios from 'axios';

const globalInFlightMemberFetches = new Set<string>();

export interface WorkspaceMember {
    _id: string;
    userData: {
        _id: string;
        name: string;
        email: string;
        profilePicture?: string;
        image?: string;
        avatar?: string;
    };
    role: string;
    isOwner?: boolean;
    lastActive?: string;
    invitedBy?: {
        name: string;
    };
    createdAt?: string
    invitedOn?: string;
    memberships?: string[];
    status?: string
}

interface WorkspaceMemberState {
    members: WorkspaceMember[];
    metadata: {
        count: number;
        totalPages: number;
        currentPage: number;
        nextPage: number | null;
    } | null;
    isLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;
    lastFetchedWorkspaceId: string | null;
    fetchMembers: (workspaceId: string, page?: number, search?: string, force?: boolean, append?: boolean) => Promise<void>;
    fetchSpaceMembers: (spaceId: string) => Promise<void>;
    addMemberToState: (member: WorkspaceMember) => void;
    updateMemberRole: (memberId: string, newRole: string) => void;
    removeMember: (memberId: string) => Promise<boolean>;
    setIsLoading: (loading: boolean) => void;
}

export const useWorkspaceMemberStore = create<WorkspaceMemberState>((set, get) => ({
    members: [],
    metadata: null,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    lastFetchedWorkspaceId: null,
    fetchMembers: async (workspaceId: string, page: number = 1, search: string = "", force = false, append = false) => {
        const state = get();
        const requestKey = `${workspaceId}:${page}:${search}:${append ? "append" : "replace"}`;

        if (!append && globalInFlightMemberFetches.has(requestKey)) return;
        if (append ? state.isLoadingMore : state.isLoading) return;
        if (
            !force &&
            !append &&
            page === 1 &&
            search === "" &&
            state.lastFetchedWorkspaceId === workspaceId &&
            state.members.length > 0
        ) {
            return;
        }

        if (!append && state.lastFetchedWorkspaceId !== workspaceId) {
            set({ members: [], metadata: null, lastFetchedWorkspaceId: workspaceId });
        }

        if (!append) globalInFlightMemberFetches.add(requestKey);
        set(append ? { isLoadingMore: true, error: null } : { isLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) throw new Error("Authentication token not found");

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members?workspaceId=${workspaceId}&page=${page}&size=50&search=${search}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                const fetchedData = response.data?.data?.data || response.data?.data || [];
                const requestMetadata = response.data?.metadata;
                const rows = Array.isArray(fetchedData) ? fetchedData : [];
                set((prev) => ({
                    members: append
                        ? [...prev.members, ...rows.filter((x) => !prev.members.some((y) => y._id === x._id))]
                        : rows,
                    metadata: requestMetadata || null,
                    isLoading: false,
                    isLoadingMore: false,
                    lastFetchedWorkspaceId: workspaceId,
                }));
            } else {
                set({
                    isLoading: false,
                    isLoadingMore: false,
                    error: response.data?.message || "Failed to fetch members"
                });
            }
        } catch (error: any) {
            console.error("Failed to fetch workspace members:", error);
            set({
                isLoading: false,
                isLoadingMore: false,
                error: error.response?.data?.message || error.message || 'Failed to fetch workspace members'
            });
        } finally {
            if (!append) globalInFlightMemberFetches.delete(requestKey);
        }
    },
    fetchSpaceMembers: async (spaceId: string) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) throw new Error("Authentication token not found");

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members?spaceId=${spaceId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                const fetchedData = response.data?.data?.data || response.data?.data || [];
                set({
                    members: Array.isArray(fetchedData) ? fetchedData : [],
                    isLoading: false
                });
            } else {
                set({
                    isLoading: false,
                    error: response.data?.message || "Failed to fetch space members"
                });
            }
        } catch (error: any) {
            console.error("Failed to fetch space members:", error);
            set({
                isLoading: false,
                error: error.response?.data?.message || error.message || 'Failed to fetch space members'
            });
        }
    },
    addMemberToState: (member: WorkspaceMember) => {
        set((state) => ({
            members: [member, ...state.members]
        }));
    },
    updateMemberRole: (memberId: string, newRole: string) => {
        set((state) => ({
            members: state.members.map((m) =>
                m._id === memberId ? { ...m, role: newRole } : m
            )
        }));
    },
    removeMember: async (memberId: string) => {
        set({ error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) throw new Error("Authentication token not found");

            const response = await axios.delete(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members/${memberId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                set((state) => ({
                    members: state.members.filter((m) => m._id !== memberId),
                }));
                return true;
            } else {
                set({
                    error: response.data?.message || "Failed to remove member"
                });
                return false;
            }
        } catch (error: any) {
            console.error("Failed to remove workspace member:", error);
            set({
                error: error.response?.data?.message || error.message || 'Failed to remove workspace member'
            });
            return false;
        }
    },
    setIsLoading: (loading: boolean) => {
        set({ isLoading: loading });
    },
}));
