"use client"

import type React from "react"
import { useRef, useCallback, useEffect, useState } from "react"
import { X, Users } from "lucide-react"
import { useMemberStore } from "@/store/flowboard/memberStore"
import { Skeleton } from "@/components/ui/skeleton"

interface BoardMembersModalProps {
    onClose: () => void
    boardId: string
    userId: string | undefined
}

const avatarColors = [
    "bg-gradient-to-br from-blue-500 to-blue-600",
    "bg-gradient-to-br from-purple-500 to-purple-600",
    "bg-gradient-to-br from-emerald-500 to-emerald-600",
    "bg-gradient-to-br from-amber-500 to-amber-600",
    "bg-gradient-to-br from-rose-500 to-rose-600",
    "bg-gradient-to-br from-cyan-500 to-cyan-600",
]

const getRoleBadge = (role: string) => {
    const roleStyles: Record<string, string> = {
        admin: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
        owner: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
        member: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
        viewer: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    }
    return roleStyles[role.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
}

export const BoardMembersModal: React.FC<BoardMembersModalProps> = ({ onClose, boardId, userId }) => {
    const members = useMemberStore((state) => state.members)
    const isLoading = useMemberStore((state) => state.isLoading)
    const fetchMembers = useMemberStore((state) => state.fetchMembers)
    const loadMoreMembers = useMemberStore((state) => state.loadMoreMembers)
    const isLoadingMore = useMemberStore((state) => state.isLoadingMore)
    const pagination = useMemberStore((state) => state.pagination)


    const [searchQuery, setSearchQuery] = useState("")
    const searchTimeout = useRef<NodeJS.Timeout | null>(null)

    const observer = useRef<IntersectionObserver | null>(null)

    const lastMemberElementRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isLoadingMore) return
            if (observer.current) observer.current.disconnect()
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreMembers(boardId, searchQuery)
                }
            })
            if (node) observer.current.observe(node)
        },
        [isLoadingMore, loadMoreMembers, boardId],
    )


    useEffect(() => {
        if (boardId) {
            fetchMembers(boardId, 1, "")
        }
    }, [boardId, fetchMembers])

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value
        setSearchQuery(query)

        if (searchTimeout.current) clearTimeout(searchTimeout.current)

        searchTimeout.current = setTimeout(() => {
            fetchMembers(boardId, 1, query)
        }, 500)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                <div className="relative flex items-center justify-between px-6 py-5 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-lg">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Board Members</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Manage who has access to this board</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg p-2"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 bg-gray-50/50 dark:bg-gray-900">
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Search board members..."
                            value={searchQuery}
                            onChange={handleSearch}
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400"
                        />
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Members</h3>
                        <span className="bg-blue-800 text-white text-xs px-2.5 py-1 rounded-full font-medium shadow-sm">
                            {pagination?.count || members.length}
                        </span>
                    </div>

                    <div className="space-y-1">
                        {isLoading && members.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl "
                                >
                                    <Skeleton className="w-12 h-12 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-56" />
                                    </div>
                                    <Skeleton className="h-6 w-16 rounded-full" />
                                </div>
                            ))
                        ) : (
                            <>
                                {members.map((member, index) => {
                                    const user = typeof member.userId === "object" ? member.userId : null
                                    const colorIndex = index % avatarColors.length

                                    return (
                                        <div
                                            key={member.id || index}
                                            className="flex items-center gap-4 p-1 bg-white dark:bg-gray-900 rounded-xl  group"
                                            ref={index === members.length - 1 ? lastMemberElementRef : null}
                                        >
                                            {member.user?.avatar ? (
                                                <img
                                                    src={member.user.avatar || "/placeholder.svg"}
                                                    alt={member.user.name}
                                                    className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700 group-hover:ring-blue-400 transition-all"
                                                />
                                            ) : (
                                                <div
                                                    className={`w-10 h-10 rounded-full bg-blue-800 flex  dark:text-gray-400 items-center justify-center text-white text-base font-semibold ring-2 ring-gray-200 dark:ring-gray-700  transition-all shadow-sm`}
                                                >
                                                    {user?.name && user.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0">
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                        {user?.name}
                                                    </span>
                                                    {user?._id === userId && (
                                                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email ?? "No email"}</p>
                                            </div>

                                            <span
                                                className={`text-xs font-medium px-3 py-1.5 rounded-full border capitalize ${getRoleBadge(member?.role ?? "member")}`}
                                            >
                                                {member.role}
                                            </span>
                                        </div>
                                    )
                                })}

                                {members.length === 0 && !isLoading && (
                                    <div className="text-center py-12">
                                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                                            <Users className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No members found</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Members will appear here once added</p>
                                    </div>
                                )}

                                {isLoadingMore && (
                                    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <Skeleton className="w-12 h-12 rounded-full" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="h-3 w-56" />
                                        </div>
                                        <Skeleton className="h-6 w-16 rounded-full" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
