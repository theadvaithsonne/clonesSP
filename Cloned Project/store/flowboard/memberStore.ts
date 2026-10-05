import { create } from "zustand";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { useBoardStore } from "./boardStore";

const API_BASE_URL = "https://uatapi.garage.app/flowboard/v1/members";

export interface Member {
    _id?: string; // ID of the membership record
    id?: string; // Alias for _id
    // userId?: string;
    boardId?: string;
    orgId?: string;
    role?: "admin" | "observer" | "member";
    user?: {
        _id: string;
        name: string;
        email: string;
        avatar?: string; // If available
    };
    userId?: {
        _id: string
        email?: string
        name?: string
    }
    name?: string;
    email?: string
    // Helper fields for UI if needed, otherwise we map user details
}

export interface UserResult {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
}

interface CreateMemberRequest {
    boardId: string;
    memberUserId?: string;
    image?: string
    notificationSocketId?: string
    boardSocketId?: string
    newBoardMember?: boolean
    userId?: {
        name?: string;
        email?: string;
        _id?: string
    }
    // Optional if inviting by email via backend, but API says userId. 
    // If API requires userId, we might need to search user first. 
    // For now, assuming email invite might handle lookup or we need a user search.
    // The prompt says "body: { boardId, userId, orgId, role }".
    // If the user inputs EMAIL, we can't send userId directly unless we lookup.
    // I will assume for now we need userId. 
    // Wait, "Email address or name" input in UI implies looking up.
    orgId: string;
    role?: "admin" | "observer" | "member";
    name?: string;
    email?: string; // Adding email tentatively if backend supports valid email invites
}

export interface PaginationMetadata {
    count: number;
    totalPages: number;
    currentPage: number;
    nextPage: number | null;
}

interface MemberStore {
    members: Member[];
    cardMembers: Member[];
    pagination: PaginationMetadata | null;
    isLoading: boolean;
    isLoadingAssign: boolean;
    isLoadingMore: boolean;
    error: string | null;
    assignCardMemberlist: Member[];
    availableUsers: UserResult[];
    isSearchingUsers: boolean;
    setAssignedMembers: (members: Member[]) => void;
    removeAssignedMember: (memberId: string) => void;
    removeMembersForCards: (memberId: string) => void;
    fetchMembers: (boardId: string, page?: number, search?: string) => Promise<void>;
    fetchMembersForCards: (boardId: string) => Promise<void>;
    fetchAssignForCards: (boardId: string) => Promise<void>;
    loadMoreMembers: (boardId: string, search?: string) => Promise<void>;
    addMember: (data: CreateMemberRequest, playload: Member) => Promise<void>;
    updateMember: (id: string, role: "admin" | "observer" | "member") => Promise<void>;
    deleteMember: (id: string) => Promise<void>;
    searchUsers: (query: string) => Promise<void>;
    addAssignedMember: (newMember: Member) => void;
}

export const useMemberStore = create<MemberStore>((set, get) => ({
    members: [],
    cardMembers: [],
    assignCardMemberlist: [],
    pagination: null,
    availableUsers: [],
    isLoadingAssign: true,
    isLoading: false,
    isLoadingMore: false,
    isSearchingUsers: false,
    error: null,

    setAssignedMembers: (members: Member[]) => {
        set({ assignCardMemberlist: members });
    },

    addAssignedMember: (newMember: Member) => {
        console.log("assignCardMemberlist", newMember)
        set((state) => {
            // Prevent duplicates by ID
            if (state.assignCardMemberlist.some((m) => m._id === newMember._id)) {
                return state; // no change
            }
            return {
                assignCardMemberlist: [...state.assignCardMemberlist, newMember],
            };
        });
    },

    removeAssignedMember: (memberId: string) => {
        set((state) => ({
            assignCardMemberlist: state.assignCardMemberlist.filter(
                (m) => m._id !== memberId
            ),
        }));
    },
    removeMembersForCards: (memberId: string) => {
        set((state) => ({
            cardMembers: state.cardMembers.filter(
                (m) => m._id !== memberId
            ),
        }));
    },

    fetchAssignForCards: async (boardId: string) => {

        set((state) => ({

            cardMembers: state.assignCardMemberlist,
            isLoadingAssign: true

        }));
        try {
            const token = localStorage.getItem("garage_tok");
            // Query params: size, page, status, userId, boardId
            const response = await fetch(
                `https://uatapi.garage.app/flowboard/v1/cards/${boardId}/assignees`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error("Failed to fetch members");

            const data = await response.json();


            set((state) => ({
                assignCardMemberlist: data?.data?.assignedToIds,
                isLoadingAssign: false
            }));
        } catch (error) {
            console.error("Fetch members error:", error);
            set({ error: "Failed to load members", isLoadingAssign: false });
            // toast.error("Failed to load members");
        }
    },


    fetchMembersForCards: async (boardId: string, page = 1) => {
        const isFirstPage = page === 1;
        set((state) => ({

            cardMembers: state.cardMembers,

        }));
        try {
            const token = localStorage.getItem("garage_tok");
            // Query params: size, page, status, userId, boardId
            const response = await fetch(
                `https://uatapi.garage.app/flowboard/v1/cards/${boardId}/members?size=50`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error("Failed to fetch members");

            const data = await response.json();


            set((state) => ({
                cardMembers: data?.data

            }));
        } catch (error) {
            console.error("Fetch members error:", error);

            // toast.error("Failed to load members");
        }
    },



    fetchMembers: async (boardId: string, page = 1, search = "") => {
        const isFirstPage = page === 1;
        set((state) => ({
            isLoading: isFirstPage,
            isLoadingMore: !isFirstPage,
            error: null,
            members: isFirstPage ? [] : state.members,
            pagination: isFirstPage ? null : state.pagination
        }));

        try {
            const token = localStorage.getItem("garage_tok");
            // Query params: size, page, status, userId, boardId
            let url = `${API_BASE_URL}?boardId=${boardId}&size=50&page=${page}`;
            if (search) {
                url += `&search=${encodeURIComponent(search)}`;
            }
            const response = await fetch(
                url,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error("Failed to fetch members");

            const data = await response.json();
            const newMembers = (data?.data || []).map((m: any) => ({
                ...m,
                id: m._id,
            }));

            const metadata = data?.metadata || {
                count: newMembers.length,
                totalPages: Math.ceil((data?.metadata?.count || newMembers.length) / 10), // Estimate if missing
                currentPage: page,
                nextPage: newMembers.length === 10 ? page + 1 : null // Simple heuristic if metadata missing
            };

            set((state) => ({
                members: isFirstPage ? newMembers : [...state.members, ...newMembers],
                pagination: metadata,
                isLoading: false,
                isLoadingMore: false
            }));
        } catch (error) {
            console.error("Fetch members error:", error);
            set({ error: "Failed to load members", isLoading: false, isLoadingMore: false });
            // toast.error("Failed to load members");
        }
    },

    loadMoreMembers: async (boardId: string, search = "") => {
        const state = get();
        if (state.isLoading || state.isLoadingMore) return;

        const nextPage = state.pagination?.nextPage;

        // If we have a next page from API or calculated heuristic
        let targetPage = nextPage;

        // Fallback calculation based on current vs total
        if ((targetPage === undefined || targetPage === null) && state.pagination) {
            if (state.pagination.currentPage < state.pagination.totalPages) {
                targetPage = state.pagination.currentPage + 1;
            }
        }

        if (targetPage) {
            await state.fetchMembers(boardId, targetPage, search);
        }
    },

    addMember: async (req, playload) => {
        set({ isLoading: true });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(API_BASE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(req),
            });

            if (!response.ok) throw new Error("Failed to add member");

            const data = await response.json();
            const newMember = { ...playload };
            console.log(newMember, "newMember")
            if (data?.status) {
                set((state) => ({
                    members: [...state.members, newMember as Member],
                    isLoading: false,
                    pagination: state.pagination ? { ...state.pagination, count: state.pagination.count + 1 } : null
                }));
                if (playload.userId) {
                    useBoardStore.getState().addBoardMember(req.boardId, { _id: playload.userId._id, name: playload.userId.name });
                }
                toast.success("Member added successfully");
            }
            else {
                toast(data?.message)
            }

        } catch (error) {
            console.error("Add member error:", error);
            toast.error("Failed to add member");
            set({ isLoading: false });
        }
    },

    // addMemberSocket: async (newBoard) => {

    // },



    updateMember: async (id, role) => {
        // Optimistic update? No, let's wait for server.
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${API_BASE_URL}/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role }),
            });

            if (!response.ok) throw new Error("Failed to update member");

            set((state) => ({
                members: state.members.map((m) =>
                    m.id === id ? { ...m, role } : m
                ),
            }));
            toast.success("Member role updated");
        } catch (error) {
            console.error("Update member error:", error);
            toast.error("Failed to update member");
        }
    },

    deleteMember: async (id) => {
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${API_BASE_URL}/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error("Failed to delete member");

            const deletedMember = get().members.find(m => m.id === id);
            set((state) => ({
                members: state.members.filter((m) => m.id !== id),
                pagination: state.pagination ? { ...state.pagination, count: Math.max(0, state.pagination.count - 1) } : null
            }));
            if (deletedMember && deletedMember.boardId && deletedMember.userId) {
                useBoardStore.getState().removeBoardMember(deletedMember.boardId, deletedMember.userId._id);
            }
            toast.success("Member removed");
        } catch (error) {
            console.error("Delete member error:", error);
            toast.error("Failed to remove member");
        }
    },
    searchUsers: async (query: string) => {
        set({ isSearchingUsers: true });
        try {
            if (query) {
                const orgId = localStorage.getItem("garage_org_id");

                if (!orgId) {
                    toast("orgId not found in localStorage");

                }
                let url = `${process.env.NEXT_PUBLIC_API_URL}/public/organizations/${orgId}/users?&search=${encodeURIComponent(query)}`;
                // if (query) {
                //     // Determine if query is email or name? 
                //     // The requirement says "search of email address or name".
                //     // The API usage example: ?limit=500&search=abcd
                //     url += `&search=${encodeURIComponent(query)}`;
                // }

                const response = await fetch(url, {
                    // headers: {
                    //     Authorization: `Bearer ${token}`,
                    // },
                });

                const result = await response.json();
                console.log("2response5345", result)
                if (result?.success) {
                    const transformedUsers = (result.data?.users || []).map((user: any) => {
                        const { _id, ...rest } = user;
                        return {
                            id: _id,           // ← rename _id to id
                            ...rest,
                        };
                    });

                    set({ availableUsers: transformedUsers || [], isSearchingUsers: false });
                }
                // Expected data structure: { data: User[] } or similar?
                // Assuming response matches the generic list response

            }
        } catch (error) {
            console.error("Search users error:", error);
            // toast.error("Failed to search users");
            set({ isSearchingUsers: false });
        }
    },
}));
