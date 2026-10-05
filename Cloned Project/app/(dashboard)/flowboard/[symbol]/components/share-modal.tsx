"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Link, Copy, Sparkles, Users, ChevronDown, Globe, User, Shield, Trash2 } from "lucide-react";
import { useMemberStore } from "@/store/flowboard/memberStore";
import { Skeleton } from "@/components/ui/skeleton";
import { boardSocketService } from "../../lib/board-socket-service";
import { notificationSocketService } from "../../lib/notification-socket-service";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button"
import { Check, Share2 } from "lucide-react"

interface ShareLinkProps {
    url: string
}
interface Board {
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
interface ShareModalProps {
    onClose: () => void;
    boardId: string;
    orgId: string;
    userId: string;
    role: string | undefined;
    currentBoard: Board | null
}

export const ShareModal: React.FC<ShareModalProps> = ({ onClose, boardId, orgId, currentBoard, role, userId, }) => {
    const [email, setEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"member" | "admin" | "observer">("member");
    const [memberToDelete, setMemberToDelete] = useState<any>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Store
    const members = useMemberStore((state) => state.members);
    const availableUsers = useMemberStore((state) => state.availableUsers);
    const isSearchingUsers = useMemberStore((state) => state.isSearchingUsers);
    const searchUsers = useMemberStore((state) => state.searchUsers);
    const isLoading = useMemberStore((state) => state.isLoading);
    const fetchMembers = useMemberStore((state) => state.fetchMembers);
    const addMember = useMemberStore((state) => state.addMember);
    const updateMember = useMemberStore((state) => state.updateMember);
    const deleteMember = useMemberStore((state) => state.deleteMember);
    const loadMoreMembers = useMemberStore((state) => state.loadMoreMembers);
    const isLoadingMore = useMemberStore((state) => state.isLoadingMore);
    const pagination = useMemberStore((state) => state.pagination);

    const observer = useRef<IntersectionObserver | null>(null);
    const [copied, setCopied] = useState(false)
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const memberSearchTimeout = useRef<NodeJS.Timeout | null>(null);
    const boardSocketId = boardSocketService.socketId || undefined;
    const notificationSocketId = notificationSocketService.socketId || undefined;
    console.log("members", members)
    // const handleCopy = async () => {
    //     try {
    //         await navigator.clipboard.writeText(`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`)
    //         setCopied(true)
    //         setTimeout(() => setCopied(false), 2000)
    //     } catch (err) {
    //         console.error("Failed to copy:", err)
    //     }
    // }
    useEffect(() => {
        const handleMemberCreated = (playload) => {
            console.log("handleMemberCreated", playload)
            //addBoardSocket(playload?.data)
        }
        const handleMemberUpdated = (playload) => {
            console.log("handleBoarderUpdated", playload)
            // updatesocket(playload?._id, playload)
            // addBoardSocket(playload?.data)
        }

        const handleBoarderDeleted = (playload) => {
            console.log("handleBoarderDeleted", playload)
        }
        boardSocketService.on("member:created", handleMemberCreated);
        // notificationSocketService.on("board:updated", handleBoarderUpdated);
        // notificationSocketService.on("board:deleted", handleBoarderDeleted);
        return () => {
            boardSocketService.off("member:created", handleMemberCreated);
            // notificationSocketService.off("board:updated", handleBoarderUpdated);
            // notificationSocketService.off("board:deleted", handleBoarderDeleted);

        };
    }, [])

    const handleCopy = () => {
        // Create a temporary textarea element
        const textarea = document.createElement('textarea');
        textarea.value = `https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`;
        textarea.style.position = 'fixed';     // Avoid scrolling to bottom
        textarea.style.opacity = '0';          // Hide it visually
        document.body.appendChild(textarea);

        // Select and copy the text
        textarea.focus();
        textarea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {

                setTimeout(() => setCopied(false), 2000); // Reset message after 2s
            } else {
                console.error('Copy command failed');
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }

        // Clean up
        document.body.removeChild(textarea);
    };
    const lastMemberElementRef = useCallback((node: HTMLDivElement | null) => {
        if (isLoadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadMoreMembers(boardId, memberSearchQuery);
            }
        });
        if (node) observer.current.observe(node);
    }, [isLoadingMore, loadMoreMembers, boardId]);

    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        if (boardId) {
            fetchMembers(boardId, 1, "");
        }
    }, [boardId, fetchMembers]);

    const handleMemberSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setMemberSearchQuery(query);

        if (memberSearchTimeout.current) clearTimeout(memberSearchTimeout.current);

        memberSearchTimeout.current = setTimeout(() => {
            fetchMembers(boardId, 1, query);
        }, 500); // Debounce for 500ms
    };

    useEffect(() => {
        // Load initial list
        searchUsers("");
    }, [searchUsers]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setEmail(query);
        setShowResults(true);
        searchUsers(query);
    };

    const handleSelectUser = async (user: any) => {
        const playload = {
            boardId,
            orgId,
            userId: {
                _id: user.id,
                email: user.email,
                name: user?.name
            },
            role: inviteRole,
            memberUserId: user.id,
            email: user.email,
            name: user?.name,
            image: ""
        }
        await addMember({
            boardId,
            orgId,
            role: inviteRole,
            memberUserId: user.id,
            email: user.email,
            name: user?.name,
            image: "",
            boardSocketId,
            notificationSocketId,
            newBoardMember: true
        }, playload);
        setEmail("");
        setShowResults(false);
        // Refresh members list just in case, though addMember should update store
    };
    const avatarColors = [
        "bg-gradient-to-br from-gray-800 to-gray-900",
        "bg-gradient-to-br from-gray-900 to-black",
        "bg-gradient-to-br from-zinc-800 to-zinc-950",
        "bg-gradient-to-br from-neutral-800 to-neutral-900",
        "bg-gradient-to-br from-slate-700 to-slate-900",
        "bg-gradient-to-br from-gray-900 to-gray-950",
    ]

    console.log("members234234234", members, userId)
    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(`https://flowboard-new-garage-app.vercel.app/flowboard/${boardId}`);
        // Could show toast here
    };

    const handleDeleteClick = (member: any) => {
        setMemberToDelete(member);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (memberToDelete && memberToDelete._id) {
            try {
                setIsDeleting(true);
                await deleteMember(memberToDelete._id);
                setIsDeleteDialogOpen(false);
                setMemberToDelete(null);
            } catch (error) {
                console.error("Failed to delete member:", error);
                // Optionally show error toast here
            } finally {
                setIsDeleting(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="relative flex items-center justify-between px-6 py-5 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-zinc-900 dark:to-zinc-900 border-b border-gray-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black rounded-lg">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Board Members</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Manage who has access to this board</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hover:bg-white/50 dark:hover:bg-zinc-800/50 rounded-lg p-2"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-6 scrollbar-thin dark:bg-zinc-900">
                    {/* Upgrade Banner */}

                    {

                        role != "member" &&
                        <div className="flex gap-2 mb-6 relative z-20">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    placeholder="Email address or name"
                                    className="w-full h-10 px-4 border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    value={email}
                                    onChange={handleSearch}
                                    onFocus={() => setShowResults(true)}
                                // onBlur={() => setTimeout(() => setShowResults(false), 200)} // Delay to allow click
                                />

                                {/* Search Results Dropdown */}
                                {showResults && (email || availableUsers.length > 0) && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                                        {isSearchingUsers ? (
                                            <div className="p-3 text-sm text-gray-500 text-center">Searching...</div>
                                        ) : availableUsers.length > 0 ? (
                                            availableUsers.map(user => (
                                                <button
                                                    key={user._id}
                                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-3 transition-colors"
                                                    onClick={() => handleSelectUser(user)}
                                                >
                                                    {user.avatar ? (
                                                        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                                            {user.name?.charAt(0) || "U"}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-3 text-sm text-gray-500 text-center">No users found</div>
                                        )}
                                    </div>
                                )}

                                {/* Overlay to close dropdown when clicking outside */}
                                {showResults && (
                                    <div
                                        className="fixed inset-0 z-[-1]"
                                        onClick={() => setShowResults(false)}
                                    ></div>
                                )}
                            </div>
                            <div className="relative">
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value as any)}
                                    className="h-10 px-3 border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 flex items-center gap-2 text-sm text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8 cursor-pointer"
                                >
                                    <option value="member">Member</option>
                                    {
                                        role == "admin" && userId === currentBoard?.userId &&
                                        <option value="admin">Admin</option>
                                    }

                                    <option value="observer">Observer</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-3 pointer-events-none text-gray-500" />
                            </div>
                            {/* <button
                                //onClick={handleInvite}
                                className="h-10 px-6 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                                disabled={isLoading}
                            >
                                {isLoading ? "Sharing..." : "Share"}
                            </button> */}
                        </div>
                    }
                    {/* Share Link Section - Visible to all */}


                    {/* Social Share Section */}

                    {/* Link Share */}


                    {/* Members List */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-white">Board members</h3>
                            <span className="bg-blue-900 text-white text-xs px-2 py-0.5 rounded-full font-medium">{pagination?.count || members.length}</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Search members..."
                            value={memberSearchQuery}
                            onChange={handleMemberSearch}
                            className="w-full h-9 px-3 mb-4 text-sm border bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <div className="space-y-4">
                            {isLoading && members.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="w-9 h-9 rounded-full" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-48" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-8 w-20 rounded" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <>
                                    {members.map((member, index) => {
                                        const colorIndex = index % avatarColors.length
                                        return (
                                            <>
                                                <div
                                                    key={member.id}
                                                    className="flex items-center justify-between"
                                                    ref={index === members.length - 1 ? lastMemberElementRef : null}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {member.user?.avatar ? (
                                                            <img src={member.user.avatar} alt={member.user.name} className="w-9 h-9 rounded-full object-cover" />
                                                        ) : (
                                                            <div className={`w-9 h-9 rounded-full bg-blue-900 flex items-center justify-center text-white text-xs font-medium`}>
                                                                {
                                                                    typeof member.userId === 'object' && member.userId?.name
                                                                    && member.userId.name.charAt(0).toUpperCase()

                                                                }

                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {
                                                                        (() => {
                                                                            const user =
                                                                                typeof member.userId === 'object' ? member.userId : null

                                                                            return (
                                                                                <>
                                                                                    {user?.name}
                                                                                    {user?._id === userId && ' (you)'}
                                                                                </>
                                                                            )
                                                                        })()
                                                                    }


                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {
                                                                    typeof member.userId === 'object'
                                                                        ? `${member.userId.email ?? 'No email'} • ${member.role}`
                                                                        : `No email • ${member.role}`
                                                                }


                                                            </p>
                                                        </div>
                                                    </div>

                                                    {
                                                        role != "member" &&
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={(member.role?.toLowerCase()?.trim() || "member") as "member" | "admin" | "observer"}
                                                                onChange={(e) =>
                                                                    member?._id && updateMember(member._id, e.target.value as "member" | "admin" | "observer")
                                                                }
                                                                className="h-8 px-2 border border-gray-200 dark:border-zinc-700 rounded text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none cursor-pointer"
                                                                disabled={member?.userId?._id === currentBoard?.userId} // Can't change own role?
                                                            >
                                                                <option value="member">Member</option>
                                                                {
                                                                    (role == "admin" && userId === currentBoard?.userId) || member.role?.toLowerCase() === "admin" ?
                                                                        <option value="admin">Admin</option>
                                                                        : null
                                                                }

                                                                <option value="observer">Observer</option>
                                                            </select>

                                                            {member.userId?._id !== currentBoard?.userId && (
                                                                <button
                                                                    onClick={() => handleDeleteClick(member)}

                                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                                    title="Remove member"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>

                                                    }

                                                </div>
                                            </>
                                        )
                                    })}
                                    {members.length === 0 && !isLoading && (
                                        <p className="text-sm text-gray-500 text-center py-4">No members found.</p>
                                    )}
                                    {isLoadingMore && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="w-9 h-9 rounded-full" />
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-32" />
                                                    <Skeleton className="h-3 w-48" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-8 w-20 rounded" />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove <span className="font-medium text-foreground">{memberToDelete?.userId?.name || "this member"}</span> from the board.
                            They will no longer have access to this board.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setMemberToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isDeleting}>
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
};

