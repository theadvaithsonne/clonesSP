import { create } from 'zustand';
import axios from 'axios';
import Cookies from 'js-cookie';
import { toast } from "sonner";
import { useUIStore } from './uiStore';

import { useTemplateStore } from './templateStore';
export interface Workspace {
    _id: string;
    workspacename: string;
    category: string;
    name?: string
    userId: string
    orgId: string
    color?: string
    image_square_url?: string;
    image_circle_url?: string;
}
export interface space {
    _id?: string;
    workspacename: string;
    category: string;
    name?: string
    userId: string
    orgId: string
    workspaceId?: string;
    defaultRoomId?: string;
}
interface WorkspaceState {
    workspaces: Workspace[];
    spaceData: Record<string, space[]>;
    rooms: Record<string, any[]>;
    currentWorkspace: Workspace | null;
    isLoading: boolean;
    isLoadingWorkspacesAndSpaceAndRooms: boolean;
    error: string | null;
    spaceMetadata: Record<string, { totalPages: number, currentPage: number }>;
    loadingWorkspaceSpaces: Record<string, boolean>;
    isLoadingCurrentWorkspace: boolean;
    createWorkspaceAndSpaceAndRooms: (category: string, workspacename: string, router?: any) => Promise<any>;
    fetchWorkspaces: () => Promise<void>;
    // 5AndSpaceAndRooms: (router?: any) => Promise<any>;
    fetchWorkspacesAndSpaceAndRooms(router?: any, workspaceId?: string, Idspace?: string);
    fetchspaces: (workspaceId: string, page?: number) => Promise<void>;
    fetchspacesRouter: (workspaceId: string, router?: any) => Promise<void>;

    fetchWorkspaceById: (workspaceId: string) => Promise<void>;
    updateWorkspace: (workspaceId: string, data: Partial<Workspace>) => Promise<void>;
    addSpace: (space: space) => void;
    showCreateSpace: boolean;
    setShowCreateSpace: (show: boolean) => void;
    setCurrentWorkspace: (workspace: Workspace | null) => void;
    deleteWorkspace: (workspaceId: string) => Promise<boolean>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
    workspaces: [],
    spaceData: {},
    rooms: {},
    currentWorkspace: null,
    isLoading: false,
    isLoadingWorkspacesAndSpaceAndRooms: false,
    error: null,
    spaceMetadata: {},
    loadingWorkspaceSpaces: {},
    isLoadingCurrentWorkspace: false,
    showCreateSpace: false,
    setShowCreateSpace: (show: boolean) => set({ showCreateSpace: show }),
    setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
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

    fetchWorkspaces: async () => {
        set({ isLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) throw new Error("Authentication token not found");

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/me?size=50`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            console.log("hbbnxcdfvcxcv", response.data)
            set({ workspaces: response?.data?.data, isLoading: false });
        } catch (error: any) {
            console.error("Failed to fetch workspaces:", error);
            set({
                isLoading: false,
                error: error.response?.data?.message || error.message || 'Failed to fetch workspaces'
            });
        }
    },
    fetchWorkspaceById: async (workspaceId) => {
        set({ isLoadingCurrentWorkspace: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) throw new Error("Authentication token not found");

            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (response?.status) {
                console.log("response?.data?.data,", response?.data?.data)
                const wsData = response?.data?.data;
                set({
                    currentWorkspace: wsData ? {
                        ...wsData,
                        image_square_url: wsData.image_square_url,
                        image_circle_url: wsData.image_circle_url,
                    } : null,
                    isLoadingCurrentWorkspace: false
                });

            }
        } catch (error: any) {
            console.error("Failed to fetch workspace:", error);
            set({
                isLoadingCurrentWorkspace: false,
                error: error.response?.data?.message || error.message || 'Failed to fetch workspace'
            });
        }
    },
    createWorkspaceAndSpaceAndRooms: async (category, workspacename, router) => {
        set({ isLoadingWorkspacesAndSpaceAndRooms: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) {
                throw new Error("Authentication token not found");
            }

            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces`,
                { category, name: workspacename, color: "#008080" },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            if (response?.status) {
                toast.success("Workspace created successfully");
                console.log("Workspace created successfully:", response.data);

                let spaceData: any = null;
                try {
                    const workspaceId = response?.data?.data?.data?._id;
                    if (workspaceId) {
                        const spaceResponse = await axios.post(
                            `${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces`,
                            {
                                name: `space${Math.random().toString(36).substring(2, 8)}`,
                                description: "",
                                color: "#008080",
                                spaceCode: `space-${Math.random().toString(36).substring(2, 8)}`,
                                workspaceId: workspaceId,
                                isprivate: true,
                                members: [],


                            },
                            {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                },
                            }
                        );
                        // Extract space data more robustly
                        spaceData = spaceResponse?.data?.data?.data || spaceResponse?.data?.data || [];
                        console.log("Default space created successfully:", spaceData);

                        if (spaceResponse.data?.status || spaceResponse.data?.success) {
                            const newSpace = spaceResponse?.data?.data?.data;
                            set((state) => ({
                                spaceData: {
                                    ...state.spaceData,
                                    [workspaceId]: [newSpace]
                                }
                            }));
                        }

                        // 3. Create Default Room
                        try {
                            const roomResponse = await axios.post(
                                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms`,
                                {
                                    name: `room-${Math.random().toString(36).substring(2, 8)}`,
                                    description: "",
                                    spaceId: spaceResponse?.data?.data?.data?._id,
                                    color: "",
                                    bgImage: "",
                                    isprivate: true,
                                    members: [],
                                    setDefault: true
                                    // spaceId:spaceResponse?.data?.data?._id
                                },
                                {
                                    headers: { Authorization: `Bearer ${token}` },
                                }
                            );

                            if (roomResponse.data?.status || roomResponse.data?.success) {
                                const newRoom = roomResponse.data?.data?.data || roomResponse.data?.data;
                                if (newRoom) {
                                    set((state) => ({
                                        rooms: {
                                            [spaceData._id]: [newRoom],
                                        },
                                    }));
                                    useTemplateStore.getState().setCurrentRoom({
                                        id: newRoom._id,
                                        name: newRoom.name
                                    });
                                }
                                toast.success("Room created successfully");

                                if (router && spaceData?._id && newRoom?._id) {
                                    //  router.push(`/taskroom/${workspaceId}/dashboard/${spaceData._id}?roomId=${newRoom._id}`);
                                }
                            } else {
                                toast.error(roomResponse.data?.message || "Failed to create room");
                                //router.push(`/taskroom/${workspaceId}/dashboard/${spaceData._id}`);
                            }
                        } catch (roomError: any) {
                            console.error("Failed to create room:", roomError);
                            // router.push(`/taskroom/${workspaceId}/dashboard/${spaceData._id}`);
                            toast.error(roomError.response?.data?.message || 'Failed to create room');
                        }
                    }
                } catch (spaceError) {
                    console.error("Failed to create default space:", spaceError);
                }

                const createdWorkspace = response?.data?.data?.data;
                const workspaceWithRole = createdWorkspace
                    ? {
                        ...createdWorkspace,
                        MemberDetail: {
                            ...createdWorkspace.MemberDetail,
                            role: createdWorkspace.MemberDetail?.role || "admin",
                            isOwner: createdWorkspace.MemberDetail?.isOwner ?? true,
                        },
                    }
                    : createdWorkspace;
                set((state) => ({
                    workspaces: [...state.workspaces, workspaceWithRole],
                    currentWorkspace: workspaceWithRole,
                    isLoadingWorkspacesAndSpaceAndRooms: false
                }));
                useUIStore.getState().setShowAddWorkspace(false);
                // return {
                //     workspace: response?.data?.data?.data,
                //     currentWorkspace: response?.data?.data?.data,
                //     spaceData: spaceData,
                //     status: response?.data?.status || response?.status === 201 || response?.status === 200
                // };
            }

        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message || 'Failed to create workspace');
            set({
                isLoadingWorkspacesAndSpaceAndRooms: false,
                error: error.response?.data?.message || error.message || 'Failed to create workspace'
            });
            throw error;
        }
    },


    fetchspaces: async (workspaceId, page = 1) => {
        set((state) => ({ loadingWorkspaceSpaces: { ...state.loadingWorkspaceSpaces, [workspaceId]: true }, isLoading: true, error: null }));

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
                        isLoading: false
                    };
                });
            } else {
                const msg = data?.message || "Operation failed";
                toast.error(msg);
                set((state) => ({ loadingWorkspaceSpaces: { ...state.loadingWorkspaceSpaces, [workspaceId]: false }, isLoading: false, error: msg }));
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.message ||
                err.message ||
                "Failed to connect";

            toast.error(msg);
            set((state) => ({ loadingWorkspaceSpaces: { ...state.loadingWorkspaceSpaces, [workspaceId]: false }, isLoading: false, error: msg }));
        }
    },
    fetchspacesRouter: async (workspaceId, router) => {
        set({ isLoading: true, error: null });
        try {
            const token = localStorage.getItem("garage_tok");
            const res = await axios.get(`${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces?workspaceId=${workspaceId}`, {
                headers: { Authorization: `Bearer ${token || ''}` },
            });
            const data = res.data;
            if (data?.status) {
                if (data?.data?.length > 0) {
                    const firstSpace = data.data[0];
                    set((state) => ({
                        spaceData: {
                            ...state.spaceData,
                            [workspaceId]: data.data ?? []
                        },
                        isLoading: false
                    }));

                    if (firstSpace.defaultRoomId) {
                        router.push(`/taskroom/${workspaceId}/dashboard/${firstSpace._id}?roomId=${firstSpace.defaultRoomId}`);
                    } else {
                        // Create a room if no defaultRoomId
                        try {
                            const roomResponse = await axios.post(
                                `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms`,
                                {
                                    name: `room-${Math.random().toString(36).substring(2, 8)}`,
                                    description: "",
                                    spaceId: firstSpace._id,
                                    color: "",
                                    bgImage: "",
                                    isprivate: true,
                                    members: [],
                                },
                                {
                                    headers: { Authorization: `Bearer ${token}` },
                                }
                            );

                            if (roomResponse.data?.status || roomResponse.data?.success) {
                                const newRoom = roomResponse.data?.data?.data || roomResponse.data?.data;
                                if (newRoom) {
                                    set((state) => ({
                                        rooms: {
                                            ...state.rooms,
                                            [firstSpace._id]: [newRoom],
                                        },
                                    }));
                                    router.push(`/taskroom/${workspaceId}/dashboard/${firstSpace._id}?roomId=${newRoom?._id || newRoom?.id}`);
                                }
                            } else {
                                router.push(`/taskroom/${workspaceId}/dashboard/${firstSpace._id}`);
                            }
                        } catch (roomError) {
                            console.error("Failed to auto-create room:", roomError);
                            router.push(`/taskroom/${workspaceId}/dashboard/${firstSpace._id}`);
                        }
                    }
                } else {
                    router.push(`/taskroom/${workspaceId}`);
                    set((state) => ({
                        spaceData: {
                            ...state.spaceData,
                            [workspaceId]: []
                        },
                        isLoading: false,
                        showCreateSpace: true
                    }));
                }
            } else {
                const msg = data?.message || "Operation failed";
                toast.error(msg);
                set({ isLoading: false, error: msg });
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || "Failed to connect";
            toast.error(msg);
            set({ isLoading: false, error: msg });
        }
    },
    fetchWorkspacesAndSpaceAndRooms: async (router?: any, workspaceId?: string, Idspace?: string) => {
        //  alert()
        // toast("Authentication token not found");
        set({ isLoadingWorkspacesAndSpaceAndRooms: true, error: null });

        try {
            const token = localStorage.getItem("garage_tok");
            if (!token) {
                toast("Authentication token not found");
                return
            }

            const headers = { Authorization: `Bearer ${token}` };

            // 1. Fetch all workspaces
            const workspacesRes = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces?size=50`,
                { headers }
            );

            const workspaces = workspacesRes?.data?.data ?? [];

            console.log("Workspaces fetched:", workspaces);

            let currentWorkspaceSpaces: any[] = [];
            let rooms: Record<string, any[]> = {};

            // 2. If there is at least one workspace → fetch its spaces
            if (workspaces.length > 0) {
                const activeWorkspaceId = workspaceId ? workspaceId : workspaces[0]._id; // ← using _id from Workspace interface
                // Alternative choices:
                // const activeWorkspaceId = getLastUsedWorkspaceId() ?? workspaces[0].id;
                // const activeWorkspaceId = workspaces.find(w => w.isDefault)?.id ?? workspaces[0].id;

                try {
                    const spacesRes = await axios.get(
                        `${process.env.NEXT_PUBLIC_TASKROOM_URL}spaces?workspaceId=${activeWorkspaceId}`,
                        { headers }
                    );

                    const data = spacesRes.data;

                    if (data?.status) {
                        currentWorkspaceSpaces = data.data ?? [];
                        console.log("data.234234data", Idspace)
                        if (currentWorkspaceSpaces.length > 0) {
                            const spaceId = Idspace ? Idspace : data?.data?.[0]?._id;
                            try {
                                const response = await axios.get(
                                    `${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms?spaceId=${spaceId}`,
                                    {
                                        headers: { Authorization: `Bearer ${token}` },
                                    }
                                );

                                if (response.data?.status || response.data?.success) {
                                    rooms = {
                                        ...rooms,
                                        [spaceId]: response.data?.data || [],
                                    };
                                }
                                else {
                                    alert("room inviald")
                                }
                            } catch (roomErr) {
                                alert("room inviald")
                                console.error("Failed to fetch rooms:", roomErr);
                                set({
                                    isLoadingWorkspacesAndSpaceAndRooms: false,
                                    error: roomErr,
                                    // optionally: workspaces: [], spaceData: [] 
                                });
                            }
                        }
                    } else {
                        const msg = data?.message || "Failed to load spaces";
                        toast.error(msg);
                        // You can decide whether to set error or just log it
                        console.warn(msg);
                    }
                } catch (spacesErr: any) {

                    const msg =
                        spacesErr.response?.data?.message ||
                        spacesErr.message ||
                        "Failed to fetch spaces";
                    set({
                        isLoadingWorkspacesAndSpaceAndRooms: false,
                        error: msg,
                        // optionally: workspaces: [], spaceData: [] 
                    });
                    toast.error(msg);
                    console.error("Spaces fetch failed:", spacesErr);
                    // → you can choose to continue with workspaces even if spaces fail
                }
            }

            // Final state update (both succeeded or partially succeeded)
            set((state) => {
                const activeWorkspaceId = workspaces[0]?._id;
                return {
                    workspaces,
                    spaceData: {
                        ...state.spaceData,
                        ...(activeWorkspaceId ? { [activeWorkspaceId]: currentWorkspaceSpaces } : {})
                    },
                    rooms: {
                        ...state.rooms,
                        ...rooms
                    },
                    isLoadingWorkspacesAndSpaceAndRooms: false,
                };
            });


            const activeWorkspaceId = workspaces[0]?._id;
            const activeSpaces = currentWorkspaceSpaces;
            const activeSpaceId = Idspace ? Idspace : workspaces[0]?.defaultSpaceId?._id ? workspaces[0]?.defaultSpaceId?._id : activeSpaces?.[0]?._id;
            const activeRooms = workspaces[0]?.defaultSpaceId?._id ? rooms[workspaces?.[0]?.defaultSpaceId?._id] : rooms[activeSpaceId] || [];
            console.log("vxcvxcvxcvxcvxcvw4e5", workspaces.length, activeSpaces.length, activeRooms.length, activeRooms, rooms[activeSpaceId], rooms, activeSpaceId)
            if (workspaces && workspaces.length > 0 && activeSpaces && activeSpaces.length > 0 && activeRooms && activeRooms.length > 0) {


                router.replace(`?workspaceId=${workspaces?.[0]?._id}&spaceId${activeSpaceId}&roomId=${activeRooms?.[0]?._id}`);
            } else {
                useUIStore.getState().setShowAddWorkspace(true);
            }

        } catch (error: any) {
            console.error("Failed to fetch workspaces:", error);
            alert("redirect to Invaildworkspace")

            const msg =
                error.response?.data?.message ||
                error.message ||
                "Failed to fetch workspaces";

            toast.error(msg); // ← optional, depends on your UX preference

            set({
                isLoadingWorkspacesAndSpaceAndRooms: false,
                error: msg,
                // optionally: workspaces: [], spaceData: [] 
            });
        }
    },

    updateWorkspace: async (workspaceId, data) => {
        set({ isLoading: true, error: null });
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
                    isLoading: false
                }));
            }
        } catch (error: any) {
            console.error("Failed to update workspace:", error);
            const msg = error.response?.data?.message || error.message || 'Failed to update workspace';
            toast.error(msg);
            set({ isLoading: false, error: msg });
        }
    },

    deleteWorkspace: async (workspaceId) => {
        set({ isLoading: true, error: null });
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
                    isLoading: false
                }));
                return true;
            } else {
                const msg = response.data?.message || "Failed to delete workspace";
                toast.error(msg);
                set({ isLoading: false, error: msg });
                return false;
            }
        } catch (error: any) {
            console.error("Failed to delete workspace:", error);
            const msg = error.response?.data?.message || error.message || 'Failed to delete workspace';
            toast.error(msg);
            set({ isLoading: false, error: msg });
            return false;
        }
    },
}));
