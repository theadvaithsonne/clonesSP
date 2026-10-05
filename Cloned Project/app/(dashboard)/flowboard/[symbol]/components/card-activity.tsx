"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, SendHorizonal, MoreVertical, PencilLine, MessageCircle, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import Cookies from "js-cookie"
import { boardSocketService } from "../../lib/board-socket-service"
import { jwtDecode } from 'jwt-decode'
import type { Column } from "./kanban-board"
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
type CommentItem = {
    _id: string
    userId?: {
        _id?: string;
        name?: string
        email?: string
    }
    userName?: string
    userAvatarUrl?: string
    comment: string
    createdAt?: string
    updatedAt?: string
}

export function CardActivity({
    boardId,
    cardId,
    userId,
    connected,
    className,
    onCommentCountChange,
    setColumns

}: {
    boardId: string
    cardId: string
    userId?: string | undefined
    className?: string
    connected: boolean
    onCommentCountChange?: (diff: number) => void
    setColumns: React.Dispatch<React.SetStateAction<Column[]>>

}) {
    const baseUrlComments = "https://uatapi.garage.app/flowboard"
    const [comments, setComments] = React.useState<CommentItem[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [UserData, setUserData] = React.useState("")
    const [newComment, setNewComment] = React.useState("")
    const [editingId, setEditingId] = React.useState<string | null>(null)
    const [editingText, setEditingText] = React.useState("")

    // -----------------------------------------------------------------
    // FETCH COMMENTS
    // -----------------------------------------------------------------
    React.useEffect(() => {
        if (!boardId || !cardId) return



        fetchComments()
    }, [boardId, cardId])

    // -----------------------------------------------------------------
    // SOCKET LISTENERS
    // -----------------------------------------------------------------
    React.useEffect(() => {
        const handleCommentCreated = (newComment) => {
            console.log("zcvxczxczxcdzc", newComment)
            setComments((prev) => [newComment, ...prev])
        };







        const handleCommentUpdated = (updatedComment: CommentItem) => {

            // setComments(prev => prev.map(c => (c._id === updatedComment._id ? { ...c, comment: updatedComment } : c));

            // If updatedComment is already the plain CommentItem (no wrapper)
            setComments((prev) =>
                prev.map((c) =>
                    c._id === updatedComment._id
                        ? { ...c, comment: updatedComment.comment }  // extract the nested CommentItem
                        : c
                )
            );

        };

        const handleCommentDeleted = (payload: any) => {
            console.log("handleCommentDeleted payload:", payload);
            // Payload might be an object { commentId: "..." } or just the id string
            const idToDelete = typeof payload === 'string' ? payload : (payload?._id || payload?.commentId || payload?.id);

            if (!idToDelete) {
                console.error("handleCommentDeleted: Could not extract ID from payload", payload);
                return;
            }

            setComments((prev) => prev.filter((c) => c._id !== idToDelete))

        };

        boardSocketService.on("comment:created", handleCommentCreated);
        boardSocketService.on("comment:updated", handleCommentUpdated);
        boardSocketService.on("comment:deleted", handleCommentDeleted);

        return () => {
            boardSocketService.off("comment:created", handleCommentCreated);
            boardSocketService.off("comment:updated", handleCommentUpdated);
            boardSocketService.off("comment:deleted", handleCommentDeleted);
        };
    }, [onCommentCountChange]);



    React.useEffect(() => {
        const userData = localStorage.getItem("garage_tok");
        if (userData) {
            try {
                const parsed = jwtDecode<JwtPayload>(userData)
                setUserData(parsed?.name);




            } catch (e) {
                console.error("Failed to parse flowboadUserdata cookie", e);
            }
        }
    }, []);

    console.log("cv13123223", comments)

    const fetchComments = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const token = localStorage.getItem("garage_tok")
            const params = new URLSearchParams({
                boardId,
                cardId,
                page: "1",
                size: "50",
            })
            const response = await fetch(
                `${baseUrlComments}/v1/comments?${params.toString()}`,
                {
                    headers: token
                        ? {
                            Authorization: `Bearer ${token}`,
                        }
                        : undefined,
                }
            )
            const data = await response.json()

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to load comments")
            }
            console.log("d23423423423423ata.data", data.data)
            setComments(data.data || [])
        } catch (err) {
            console.error("Failed to load comments", err)
            setError(err instanceof Error ? err.message : "Failed to load comments")
        } finally {
            setIsLoading(false)
        }
    }
    // -----------------------------------------------------------------
    // POST NEW COMMENT
    // -----------------------------------------------------------------
    const handlePost = async () => {
        const text = newComment.trim()
        if (!text) return

        setNewComment("")

        try {
            const token = localStorage.getItem("garage_tok")
            if (!token) {
                toast.error("Authentication token missing")
                return
            }

            const response = await fetch(`${baseUrlComments}/v1/comments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    boardId,
                    cardId,
                    comment: text,
                    socketId: boardSocketService.socketId,
                }),
            })

            const data = await response.json()

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to post comment")
            }

            //fetchComments()
            const created: CommentItem | null = data?.data
            console.log("data.data", data.data)

            if (created) {
                setComments((prev) => [created, ...prev])
                if (onCommentCountChange) onCommentCountChange(1);
            }


        } catch (err) {
            console.error("Failed to post comment", err)
            setError(err instanceof Error ? err.message : "Failed to post comment")
            toast.error(err instanceof Error ? err.message : "Failed to post comment")
        }
    }
    console.log("jcxvhjvcxuhfuhd", comments)
    // -----------------------------------------------------------------
    // DELETE COMMENT
    // -----------------------------------------------------------------
    const handleDelete = async (id: string) => {
        const originalComments = comments
        setIsLoading(true)

        try {
            const token = localStorage.getItem("garage_tok")
            if (!token) {
                toast.error("Authentication token missing")
                return
            }

            const response = await fetch(`${baseUrlComments}/v1/comments/${id}?socketId=${boardSocketService.socketId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
            const data = await response.json()

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to delete comment")
            }

            setComments((prev) => prev.filter((c) => c._id !== id))
            if (onCommentCountChange) onCommentCountChange(-1);

            toast.success("Comment deleted")
        } catch (err) {
            setComments(originalComments)
            setError(err instanceof Error ? err.message : "Failed to delete comment")
            toast.error(err instanceof Error ? err.message : "Failed to delete comment")
        } finally {
            setIsLoading(false)
        }
    }

    // -----------------------------------------------------------------
    // EDIT COMMENT
    // -----------------------------------------------------------------
    const handleSaveEdit = async (id: string) => {
        const text = editingText.trim()
        if (!text) {
            setEditingId(null)
            return
        }

        const originalComments = comments

        try {
            const token = localStorage.getItem("garage_tok")
            if (!token) {
                toast.error("Authentication token missing")
                return
            }

            const response = await fetch(`${baseUrlComments}/v1/comments/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ comment: text, socketId: boardSocketService.socketId }),
            })
            const data = await response.json()

            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to update comment")
            }

            setComments((prev) =>
                prev.map((c) => (c._id === id ? { ...c, comment: text } : c))
            )
            setEditingId(null)
            setEditingText("")
        } catch (err) {
            setComments(originalComments)
            setError(err instanceof Error ? err.message : "Failed to update comment")
            toast.error(err instanceof Error ? err.message : "Failed to update comment")
        }
    }

    // Mock employee name since we don't have the list
    const getEmployeeName = (id?: string): string => {
        if (!id) return "Unknown User"
        return "User"
    }

    return (
        <div className={cn("", className)}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    <span>Activity</span>
                </div>

            </div>

            <div className="">
                {/* Comment Input */}

                <div className="flex gap-3">
                    {/* <Avatar className="h-9 w-9 border-2 border-primary/20">
                        <AvatarFallback className="bg-[#333] text-primary-foreground text-xs font-medium">{(UserData)?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar> */}
                    <div className="flex-1 space-y-2">
                        <Textarea
                            placeholder="Write a comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    handlePost()
                                }
                            }}
                            className="min-h-[80px] resize-none bg-muted/70 dark:bg-gray-800 border-border dark:border-gray-700 text-xs text-muted-foreground dark:text-gray-200 transition-colors"
                        />
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                onClick={handlePost}
                                disabled={isLoading || !newComment.trim()}
                                className="bg-[#333] hover:bg-[#222] text-xs text-primary-foreground dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900"
                            >
                                Add Comment
                            </Button>
                        </div>
                    </div>
                </div>




                {/* 
                <div className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-black text-white text-xs">
                            {(UserData)?.[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition">
                            <Textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Write a comment..."
                                className="w-full px-3 py-2 border-none focus:ring-0 resize-none min-h-[60px] text-xs shadow-none focus-visible:ring-0"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        handlePost()
                                    }
                                }}
                            />
                        </div>
                        {newComment && (
                            <Button
                                onClick={handlePost}
                                disabled={isLoading}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Save
                            </Button>
                        )}
                    </div>
                </div> */}

                {/* Comments List */}
                <div className="space-y-6">
                    {isLoading && comments?.length === 0 ? (
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-start gap-3 animate-pulse">
                                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-24 bg-gray-200 rounded" />
                                        <div className="h-10 w-full bg-gray-200 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        comments?.map((c) => (
                            <div key={c._id} className="flex items-start gap-3 group">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarFallback className="text-xs bg-gray-500 text-white">
                                        {(c.userId?.name)?.substring(0, 2).toUpperCase() ?? "?"}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs">
                                            {(c.userId?.name)}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {c.createdAt
                                                ? formatDistanceToNow(new Date(c.createdAt), {
                                                    addSuffix: true,
                                                })
                                                : ""}
                                        </span>
                                    </div>

                                    {editingId === c._id ? (
                                        <div className="space-y-2">
                                            <Textarea
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                className="min-h-[60px] resize-none text-xs bg-white dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="bg-[#333] hover:bg-[#222] dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900"
                                                    onClick={() => handleSaveEdit(c._id)}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"

                                                    onClick={() => {
                                                        setEditingId(null)
                                                        setEditingText("")
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className=" text-accent-foreground bg-muted/70 dark:bg-gray-800 rounded-md p-3 text-xs text-gray-700 dark:text-gray-200 shadow-sm border border-transparent dark:border-gray-700">
                                                {c.comment}
                                            </div>
                                            {c.userId?._id === userId && (
                                                <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="text-xs text-gray-500 hover:underline"
                                                        onClick={() => {
                                                            setEditingId(c._id)
                                                            setEditingText(c.comment)
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="text-xs text-gray-500 hover:underline"
                                                        onClick={() => handleDelete(c._id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
