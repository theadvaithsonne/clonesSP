// src/components/FlowBoards.tsx
"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Star, Users, List, CreditCard, Clock, MoreVertical, Plus, Trash2, Pencil, Wifi, WifiOff, Moon, Sun } from 'lucide-react';
import { useBoardStore, Board } from '@/store/flowboard/boardStore';
import { useRouter } from "next/navigation"
import Cookies from "js-cookie";
import { useUserStore } from '@/store/flowboard/userStore';
import { notificationSocketService } from './lib/notification-socket-service';
import { useThemeStore } from "@/store/flowboard/themeStore";
import { jwtDecode } from 'jwt-decode'
const COLORS = ['#3B82F6', '#A855F7', '#10B981', '#F97316', '#EC4899', '#EF4444', '#F59E0B', '#6366F1'];
interface JwtPayload {
    // Adjust these fields according to YOUR actual JWT payload
    sub?: string        // user id
    name?: string
    email?: string
    role?: string
    exp?: number
    orgId?: string
    iat?: number
    userId?: string
    // ... add any custom claims like garageId, permissions, etc.
    [key: string]: any
}
// BoardCard Component
const BoardCard: React.FC<{
    board: Board; onEdit: (board: Board) => void; userId: string
    notificationSocketId: string | null
}> = ({ board, onEdit, userId, notificationSocketId }) => {
    const toggleStar = useBoardStore((state) => state.toggleStar);
    const deleteBoard = useBoardStore((state) => state.deleteBoard);
    const router = useRouter()

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this board?")) {
            if (notificationSocketId) {
                deleteBoard(board.id, notificationSocketId);
            }

        }
    };
    console.log("board", board)
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer" onClick={() => router.push(`/flowboard/${board.id}`)}>
            <div className="h-24 relative" style={{ backgroundColor: board.color }}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        const id = board.id;
                        if (notificationSocketId) {
                            toggleStar(id, !board.starred, notificationSocketId ?? undefined);
                        }
                    }}
                    className="absolute top-3 right-3 text-white hover:scale-110 transition-transform"
                >
                    <Star size={20} fill={board.starred ? 'white' : 'none'} strokeWidth={2} />
                </button>
            </div>

            <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate pr-2">{board.name}</h3>
                    {
                        board?.userId == userId &&
                        <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(board);
                                }}
                                className="text-gray-400 hover:text-blue-500 transition-colors"
                                title="Edit Board"
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                onClick={handleDelete}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Delete Board"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    }

                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 min-h-[40px]">{board.description || "No description"}</p>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <div className="flex items-center gap-1">
                        <List size={14} />
                        <span>{board.lists} lists</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <CreditCard size={14} />
                        <span>{board.cards} cards</span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                        {
                            board?.boardUsers?.userData &&
                            <>
                                {board?.boardUsers?.userData.map((member, idx) => (
                                    <div
                                        key={idx}
                                        className="w-7 h-7 rounded-full bg-gray-800 border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                                    >
                                        {member?.userData?.name?.charAt(0)}
                                    </div>
                                ))}
                            </>
                        }

                    </div>

                    <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Clock size={12} />
                        <span>{board.lastUpdated}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Skeleton Loader Components
const SkeletonBoardCard = () => (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
        <div className="h-24 bg-gray-200" />
        <div className="p-4">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-6" />
            <div className="flex gap-4 mb-4">
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
            <div className="flex justify-between items-center">
                <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white" />
                    <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white" />
                </div>
                <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
        </div>
    </div>
);

const BoardSkeletonLoader = () => (
    <div className="space-y-12">
        {/* Starred Boards Skeleton */}
        <div>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <SkeletonBoardCard key={`starred-${i}`} />
                ))}
            </div>
        </div>

        {/* All Boards Skeleton */}
        <div>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <SkeletonBoardCard key={`all-${i}`} />
                ))}
            </div>
        </div>
    </div>
);

// Board Modal (Create & Edit)
const BoardModal: React.FC<{
    onClose: () => void;
    userId: string;
    orgId: string;
    board?: Board | null
    notificationSocketId?: string | null
}> = ({ onClose, userId, orgId, board, notificationSocketId }) => {
    const [name, setName] = useState(board?.name || '');
    const [description, setDescription] = useState(board?.description || '');
    const [selectedColor, setSelectedColor] = useState(board?.color || COLORS[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addBoard = useBoardStore((state) => state.addBoard);
    const updateBoard = useBoardStore((state) => state.updateBoard);
    console.log("ewq8rhjdfsd", board)
    const handleSubmit = async () => {
        if (name.trim() && !isSubmitting) {
            setIsSubmitting(true);
            try {
                if (board) {
                    const updates: Partial<any> = {};
                    if (name.trim() !== board.name) updates.name = name.trim();
                    if (description.trim() !== board.description) updates.description = description.trim();
                    if (selectedColor !== board.color) updates.color = selectedColor;
                    // const notificationSocketId = notificationSocketId
                    if (Object.keys(updates).length > 0) {
                        if (notificationSocketId) {
                            await updateBoard(board.id, updates, notificationSocketId);
                        }

                    } else {
                        onClose();
                        return;
                    }
                } else {
                    await addBoard({
                        name: name.trim(),
                        description: description.trim(),
                        color: selectedColor,
                        socketId: notificationSocketId
                    });
                }
                onClose();
            } catch (error) {
                console.error(error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className=" border-[#e5e7eb29] border rounded-lg p-6 w-full max-w-md shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-semibold">{board ? 'Edit Board' : 'Create New Board'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700" disabled={isSubmitting}>
                        <X size={20} />
                    </button>
                </div>

                <input
                    type="text"
                    placeholder="Board name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-[#e5e7eb29] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-sm"
                    autoFocus
                    disabled={isSubmitting}
                />

                <input
                    type="text"
                    placeholder="Description (optional)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-[#e5e7eb29] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-sm"
                    disabled={isSubmitting}
                />

                <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-3">Choose a color</p>
                    <div className="flex gap-2">
                        {COLORS.map((color) => (
                            <button
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                disabled={isSubmitting}
                                className={`w-10 h-10 rounded-lg transition-transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-800' : ''
                                    } ${isSubmitting ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 bg-black  border border-[#e5e7eb29] text-white py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4  border-t-transparent rounded-full animate-spin" />
                                {board ? 'Saving...' : 'Creating...'}
                            </>
                        ) : (
                            board ? 'Save Changes' : 'Create Board'
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-2 text-gray-700 border  border-[#e5e7eb29] hover:bg-gray-100 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

// Main Component
const FlowBoards: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBoard, setEditingBoard] = useState<Board | null>(null);

    const handleOpenCreate = () => {
        setEditingBoard(null);
        setIsModalOpen(true);
    };

    const handleEditBoard = (board: Board) => {
        setEditingBoard(board);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setEditingBoard(null), 300); // Clear after fade out if possible, but here just delay to avoid flicker
    };

    // Separate state for all boards and starred boards
    const allBoards = useBoardStore((state) => state.allBoards);
    const starredBoards = useBoardStore((state) => state.starredBoards);
    const fetchAllBoards = useBoardStore((state) => state.fetchAllBoards);
    const fetchStarredBoards = useBoardStore((state) => state.fetchStarredBoards);
    const isLoadingAllBoards = useBoardStore((state) => state.isLoadingAllBoards);
    const isLoadingStarredBoards = useBoardStore((state) => state.isLoadingStarredBoards);
    const allBoardsMetadata = useBoardStore((state) => state.allBoardsMetadata);
    const starredBoardsMetadata = useBoardStore((state) => state.starredBoardsMetadata);
    const addBoardSocket = useBoardStore((state) => state.addBoardSocket);
    const [userId, setUserId] = useState<string>("");
    const [orgId, setOrgId] = useState<string>("");

    // Separate observers for all boards and starred boards
    const allBoardsObserverTarget = useRef<HTMLDivElement>(null);
    const starredBoardsObserverTarget = useRef<HTMLDivElement>(null);

    const isLoadingAllBoardsRef = useRef(isLoadingAllBoards);
    const isLoadingStarredBoardsRef = useRef(isLoadingStarredBoards);
    const allBoardsMetadataRef = useRef(allBoardsMetadata);
    const starredBoardsMetadataRef = useRef(starredBoardsMetadata);

    const userIdRef = useRef(userId);
    const orgIdRef = useRef(orgId);

    const isUserProfileFetched = useUserStore((state) => state.isUserProfileFetched);
    console.log("isUserProfileFetched", isUserProfileFetched);

    // Socket connection status
    const [isSocketConnected, setIsSocketConnected] = useState(false);
    const [isSocketConnecting, setIsSocketConnecting] = useState(false);
    const [notificationSocketId, setNotificationSocketId] = useState<string | null>(null);
    const { incrementListCount, decrementListCount, decrementCardCount, incrementCardCount, updatesocket } = useBoardStore()
    const { theme, toggleTheme } = useThemeStore();
    useEffect(() => {
        // if (!isUserProfileFetched || !userId) return;
        if (!userId) return;

        const handleConnected = () => {
            setIsSocketConnected(true);
            setIsSocketConnecting(false);
        };

        const handleDisconnected = () => {
            setIsSocketConnected(false);
            setIsSocketConnecting(false);
        };

        const handleConnecting = () => {
            setIsSocketConnecting(true);
        };

        const handleSocketId = (id: string) => {
            console.log("Setting notificationSocketId:", id);
            setNotificationSocketId(id);
        };

        // Set initial state
        setIsSocketConnected(notificationSocketService.connected);
        setIsSocketConnecting(notificationSocketService.connecting);
        if (notificationSocketService.socketId) {
            setNotificationSocketId(notificationSocketService.socketId);
        }

        // Subscribe to connection events
        notificationSocketService.on('connected', handleConnected);
        notificationSocketService.on('disconnected', handleDisconnected);
        notificationSocketService.on('reconnecting', handleConnecting);
        notificationSocketService.on('reconnect', handleConnected);
        notificationSocketService.on('your-id', handleSocketId);

        // Cleanup listeners when leaving this page (but keep socket connected)
        return () => {
            notificationSocketService.off('connected', handleConnected);
            notificationSocketService.off('disconnected', handleDisconnected);
            notificationSocketService.off('reconnecting', handleConnecting);
            notificationSocketService.off('reconnect', handleConnected);
            notificationSocketService.off('your-id', handleSocketId);
        };
    }, [isUserProfileFetched, userId]);



    useEffect(() => {

        const handleStageCreated = (payload) => {
            console.log("Payload handleBoardUpdate:", payload);
            incrementListCount(payload?.data?.boardId)
        }
        const handleStageDeleted = (payload) => {
            console.log("Payload handleStageDeleted:", payload);
            decrementListCount(payload?.boardId)
        }
        const handleTaskCreated = (payload) => {
            // alert()
            console.log("fsdfsdfsdfsdfsdfsdfsdfsdfsdfsdf", payload);
            incrementCardCount(payload?.data?.boardId)
        }
        const handleTaskDeleted = (payload) => {
            console.log("23333333333333leStageDeleted:", payload);
            decrementCardCount(payload?.boardId)
        }
        notificationSocketService.on("stage:created", handleStageCreated);
        notificationSocketService.on("stage:deleted", handleStageDeleted);
        notificationSocketService.on("card:created", handleTaskCreated);
        notificationSocketService.on("card:deleted", handleTaskDeleted);

        return () => {
            notificationSocketService.off("stage:created", handleStageCreated);
            notificationSocketService.off("stage:deleted", handleStageDeleted);
            notificationSocketService.off("card:created", handleTaskCreated);
            notificationSocketService.off("card:deleted", handleTaskDeleted);
        };
    }, []);


    useEffect(() => {
        const handleBoarderCreated = (playload) => {
            console.log("playloadCreatete", playload)
            addBoardSocket(playload?.data)
        }
        const handleBoarderUpdated = (playload) => {
            console.log("handleBoarderUpdated", playload)
            updatesocket(playload?._id, playload)
            // addBoardSocket(playload?.data)
        }

        const handleBoarderDeleted = (playload) => {
            console.log("handleBoarderDeleted", playload)
        }
        notificationSocketService.on("board:created", handleBoarderCreated);
        notificationSocketService.on("board:updated", handleBoarderUpdated);
        notificationSocketService.on("board:deleted", handleBoarderDeleted);
        return () => {
            notificationSocketService.off("board:created", handleBoarderCreated);
            notificationSocketService.off("board:updated", handleBoarderUpdated);
            notificationSocketService.off("board:deleted", handleBoarderDeleted);

        };
    }, [])



    useEffect(() => { isLoadingAllBoardsRef.current = isLoadingAllBoards; }, [isLoadingAllBoards]);
    useEffect(() => { isLoadingStarredBoardsRef.current = isLoadingStarredBoards; }, [isLoadingStarredBoards]);
    useEffect(() => { allBoardsMetadataRef.current = allBoardsMetadata; }, [allBoardsMetadata]);
    useEffect(() => { starredBoardsMetadataRef.current = starredBoardsMetadata; }, [starredBoardsMetadata]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { orgIdRef.current = orgId; }, [orgId]);

    const [areInitialBoardsLoaded, setAreInitialBoardsLoaded] = useState(false);

    const lastSyncedIdsRef = useRef<string>("");
    // Trigger sync only after successful fetch (initial or pagination)
    const [syncTrigger, setSyncTrigger] = useState(0);

    useEffect(() => {
        // Reset sync status on mount or when user changes
        lastSyncedIdsRef.current = "";
        setAreInitialBoardsLoaded(false);
    }, [isUserProfileFetched]);

    useEffect(() => {
        // if (!isUserProfileFetched) {
        //     console.log("Profile not fetched yet, waiting...");
        //     return;
        // }

        // Fetch both all boards and starred boards on mount
        console.log("FlowBoards page mounted - calling fetchAllBoards(1) and fetchStarredBoards(1)");

        const userData = localStorage.getItem("garage_tok");
        console.log("userIdwqeqweqwew", userId, orgId, userData)
        if (userData) {
            try {
                const parsed = jwtDecode<JwtPayload>(userData)
                if (parsed.userId && parsed.orgId) {
                    setUserId(parsed.userId);
                    setOrgId(parsed.orgId);
                    userIdRef.current = parsed.userId;
                    orgIdRef.current = parsed._orgId;

                    // Fetch boards and then mark as loaded
                    Promise.all([fetchAllBoards(1), fetchStarredBoards(1)]).then(() => {
                        setAreInitialBoardsLoaded(true);
                        setSyncTrigger(prev => prev + 1);
                    });
                }
            } catch (e) {
                console.error("Failed to parse user data cookie", e);
            }
        }
    }, [isUserProfileFetched]); // Only run once on mount

    // Sync Notifications Effect
    useEffect(() => {
        const syncNotifications = async () => {
            if (areInitialBoardsLoaded && notificationSocketId) {
                console.log("Syncing notifications with socket ID:", notificationSocketId);


                const allBoardIds = allBoards.map(b => b.id);
                const starredBoardIds = starredBoards.map(b => b.id);
                // Combine and deduplicate IDs
                const uniqueBoardIds = Array.from(new Set([...allBoardIds, ...starredBoardIds]));

                if (uniqueBoardIds.length === 0) {
                    return;
                }

                const currentIdsString = JSON.stringify(uniqueBoardIds.sort());
                if (lastSyncedIdsRef.current === currentIdsString) { return; }

                console.log("Syncing notifications. Board Count:", uniqueBoardIds.length);
                lastSyncedIdsRef.current = currentIdsString;

                try {
                    const token = localStorage.getItem("garage_tok");
                    const response = await fetch("https://uatapi.garage.app/flowboard/v1/users/join/notifications", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            notificationSocketId,
                            boardIds: uniqueBoardIds
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error("Failed to sync notifications:", errorData);
                    } else {
                        console.log("Successfully synced notifications for boards:", uniqueBoardIds);
                    }
                } catch (error) {
                    console.error("Error syncing notifications:", error);
                }
            }
        };

        syncNotifications();
    }, [areInitialBoardsLoaded, notificationSocketId, syncTrigger]);


    console.log("userIdwqeqweqwew", userId, orgId)

    // Infinite scroll observer for All Boards
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                const entry = entries[0];
                if (entry.isIntersecting) {
                    // Use getState() to access fresh state directly, avoiding stale closures
                    const store = useBoardStore.getState();
                    const meta = store.allBoardsMetadata;
                    const loading = store.isLoadingAllBoards;

                    console.log("All Boards Observer intersecting", { meta, loading });

                    if (meta && meta.currentPage < meta.totalPages && !loading) {
                        console.log("Fetching next page of all boards:", meta.currentPage + 1);
                        fetchAllBoards(meta.currentPage + 1).then(() => {
                            setSyncTrigger(prev => prev + 1);
                        });
                    } else {
                        console.log("Not fetching next page - conditions not met");
                    }
                }
            },
            { threshold: 0.1 }
        );

        const currentTarget = allBoardsObserverTarget.current;
        if (currentTarget) observer.observe(currentTarget);

        return () => {
            if (currentTarget) observer.unobserve(currentTarget);
        };
    }, [fetchAllBoards, isLoadingAllBoards]);

    // Infinite scroll observer for Starred Boards
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                const entry = entries[0];
                if (entry.isIntersecting) {
                    // Use getState() to access fresh state directly, avoiding stale closures
                    const store = useBoardStore.getState();
                    const meta = store.starredBoardsMetadata;
                    const loading = store.isLoadingStarredBoards;

                    console.log("Starred Boards Observer intersecting", { meta, loading });

                    if (meta && meta.currentPage < meta.totalPages && !loading) {
                        console.log("Fetching next page of starred boards:", meta.currentPage + 1);
                        fetchStarredBoards(meta.currentPage + 1).then(() => {
                            setSyncTrigger(prev => prev + 1);
                        });
                    } else {
                        console.log("Not fetching next page - conditions not met");
                    }
                }
            },
            { threshold: 0.1 }
        );

        const currentTarget = starredBoardsObserverTarget.current;
        if (currentTarget) observer.observe(currentTarget);

        return () => {
            if (currentTarget) observer.unobserve(currentTarget);
        };
    }, [fetchStarredBoards, isLoadingStarredBoards]);


    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background">
            <div className="max-w-full mx-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">FlowBoards</h1>

                            {/* {isUserProfileFetched && (
                                <div className="flex items-center gap-2">
                                    {isSocketConnected ? (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-full">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            <span className="text-xs font-medium text-green-700">Connected</span>
                                        </div>
                                    ) : isSocketConnecting ? (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded-full">
                                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                                            <span className="text-xs font-medium text-yellow-700">Connecting...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded-full">
                                            <WifiOff className="w-3 h-3 text-gray-500" />
                                            <span className="text-xs font-medium text-gray-600">Disconnected</span>
                                        </div>
                                    )}
                                </div>
                            )} */}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Organize tasks and projects with visual boards</p>
                    </div>
                    {/* <div className="flex bg-gray-100 p-1 rounded-lg mr-4">
                        <button
                            onClick={() => toggleTheme()}
                            className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                            title="Light Mode"
                        >
                            <Sun size={18} />
                        </button>
                        <button
                            onClick={() => toggleTheme()}
                            className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                            title="Dark Mode"
                        >
                            <Moon size={18} />
                        </button>
                    </div> */}
                    <button
                        onClick={handleOpenCreate}
                        className="bg-black text-white border border-[#e5e7eb29] px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-colors text-sm"
                    >
                        <Plus size={18} />
                        Create Board
                    </button>
                </div>


                {(isLoadingAllBoards || isLoadingStarredBoards) && allBoards.length === 0 && starredBoards.length === 0 ? (
                    <BoardSkeletonLoader />
                ) : (
                    <>
                        {/* Starred Boards */}
                        {starredBoards.length > 0 && (
                            <div className="mb-12">
                                <div className="flex items-center gap-2 mb-6">
                                    <Star size={20} fill="#FBBF24" stroke="#F59E0B" />
                                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Starred Boards</h2>
                                    <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                                        {starredBoards.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {starredBoards.map((board) => (
                                        <BoardCard key={board.id} board={board} userId={userId} onEdit={handleEditBoard} notificationSocketId={notificationSocketId} />
                                    ))}
                                </div>

                                {/* Infinite scroll sentinel for starred boards */}
                                <div ref={starredBoardsObserverTarget} className="py-4 flex justify-center w-full h-10">
                                    {isLoadingStarredBoards && starredBoards.length > 0 && (
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* All Boards */}
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-6">All Boards</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {Array.from(
                                    new Map(allBoards.map((board) => [board.id, board])).values()
                                ).map((board) => (
                                    <BoardCard
                                        key={board.id}
                                        board={board}
                                        userId={userId}
                                        onEdit={handleEditBoard}
                                        notificationSocketId={notificationSocketId}
                                    />
                                ))}

                                {/* Create New Board Tile */}
                                <button
                                    onClick={handleOpenCreate}
                                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all p-8 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-[#e5e7eb29] dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 h-full min-h-[200px]"
                                >
                                    <Plus size={36} className="text-gray-400" />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Create new board</span>
                                </button>
                            </div>

                            {/* Infinite scroll sentinel for all boards */}
                            <div ref={allBoardsObserverTarget} className="py-4 flex justify-center w-full h-10">
                                {isLoadingAllBoards && allBoards.length > 0 && (
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Modal */}
                {isModalOpen && (
                    <BoardModal
                        onClose={handleCloseModal}
                        userId={userId}
                        orgId={orgId}
                        board={editingBoard}
                        notificationSocketId={notificationSocketId}
                    />
                )}
            </div>
        </div >
    );
};

export default FlowBoards;