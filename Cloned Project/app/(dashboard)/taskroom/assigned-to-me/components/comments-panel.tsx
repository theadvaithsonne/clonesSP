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
import { Trash2, SendHorizonal, MoreVertical, PencilLine,MessageCircle } from "lucide-react"
import { toast } from "sonner"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

type CommentItem = {
    _id: string
    userId: string
    userName?: string
    userAvatarUrl?: string
    comment: string
    createdAt?: string
    updatedAt?: string
}

type Employee = {
    id: string
    name: string
    email?: string
    color?: string
    avatar?: string
}

export function CommentsPanel({
    roomId,
    taskId,
    userId,
    currentUser,
    className,
    open,
    employees,
}: {
    roomId: string  | undefined
    taskId: string | undefined
    currentUser: { id: string; name: string; avatarUrl?: string }
    className?: string
    userId: string
    open: boolean
    employees: Employee[]
}) {
    const baseUrlComments = "https://uatapi.garage.app/taskroom"
    const [comments, setComments] = React.useState<CommentItem[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const [newComment, setNewComment] = React.useState("")
    const [editingId, setEditingId] = React.useState<string | null>(null)
    const [editingText, setEditingText] = React.useState("")

    // -----------------------------------------------------------------
    // FETCH COMMENTS
    // -----------------------------------------------------------------
    React.useEffect(() => {
        if (!open || !taskId) return

        const fetchComments = async () => {
            setIsLoading(true)
            setError(null)
            try {
                const response = await fetch(
                    `${baseUrlComments}/v1/comments?taskId=${taskId}&roomId=${roomId}`
                )
                if (!response.ok) throw new Error("Failed to load comments")
                const data = await response.json()
                setComments(data.data || [])
            } catch (err) {
                toast("Failed to load comments")
            } finally {
                setIsLoading(false)
            }
        }

        fetchComments()
    }, [open, taskId, roomId])

    // -----------------------------------------------------------------
    // POST NEW COMMENT
    // -----------------------------------------------------------------
    const handlePost = async () => {
        const text = newComment.trim()
        if (!text) return

        setNewComment("")

        try {
            const response = await fetch(`${baseUrlComments}/v1/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roomId,
                    taskId,
                    userId,
                    comment: text,
                }),
            })

            if (!response.ok) throw new Error("Failed to post comment")
            const data = await response.json()

            if (data?.status && data?.data?.data) {
                setComments((prev) => [...prev, data.data.data])
            } else {
                toast("Failed to post comment")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to post comment")
        }
    }

    // -----------------------------------------------------------------
    // DELETE COMMENT
    // -----------------------------------------------------------------
    const handleDelete = async (id: string) => {
        const originalComments = comments
        setIsLoading(true)

        try {
            const response = await fetch(`${baseUrlComments}/v1/comments/${id}`, {
                method: "DELETE",
            })
            if (!response.ok) throw new Error("Failed to delete comment")
            const data = await response.json()

            if (data?.status) {
                setComments((prev) => prev.filter((c) => c._id !== id))
                toast("Comment deleted")
            } else {
                toast("Failed to delete comment")
            }
        } catch (err) {
            setComments(originalComments)
            setError(err instanceof Error ? err.message : "Failed to delete comment")
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
            const response = await fetch(`${baseUrlComments}/v1/comments/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ comment: text }),
            })
            if (!response.ok) throw new Error("Failed to update comment")
            const data = await response.json()

            if (data?.status) {
                setComments((prev) =>
                    prev.map((c) => (c._id === id ? { ...c, comment: text } : c))
                )
                setEditingId(null)
                setEditingText("")
            } else {
                toast("Failed to update comment")
            }
        } catch (err) {
            setComments(originalComments)
            setError(err instanceof Error ? err.message : "Failed to update comment")
        }
    }

    // -----------------------------------------------------------------
    // HELPER: Get employee name
    // -----------------------------------------------------------------
    const getEmployeeName = (id: string): string => {
        const employee = employees?.find((emp) => emp.id === id)
        return employee ? employee.name : "Unknown"
    }

    // -----------------------------------------------------------------
    // RENDER
    // -----------------------------------------------------------------
    return (
        <div className={cn("flex flex-col mt-4  border border-[#e5e7eb29] rounded-lg p-6 space-y-4  ", className)}

        // style={{
        //     height: 'calc(100vh - 220px)'
        // }}
        >
            {/* Scrollable Comments List */}
            <div
               
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors ${className}`}
            >
                <MessageCircle className="w-5 h-5" />
                <span className="font-medium text-sm">Comments</span>
          
            </div>
            <div className="flex-1 overflow-y-auto  pb-4 pr-1">
                {isLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-start gap-3 animate-pulse">
                                <div className="h-8 w-8 rounded-full bg-muted" />
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-24 bg-muted rounded" />
                                        <div className="h-3 w-16 bg-muted rounded" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-3 w-full bg-muted rounded" />
                                        <div className="h-3 w-3/4 bg-muted rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {error && <p className="text-sm text-destructive">{error}</p>}

                        {!error && comments.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No comments yet. Be the first!
                            </p>
                        )}

                        {comments.map((c) => (
                            <div key={c._id} className="flex items-start justify-between gap-3">
                                {/* Avatar + Content */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <Avatar className="h-8 w-8 flex-shrink-0">
                                        <AvatarFallback className="text-xs bg-muted">
                                            {getEmployeeName(c.userId)?.[0]?.toUpperCase() ?? "?"}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm text-foreground">
                                                {c.userId === userId ? "You" : getEmployeeName(c.userId)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {c.createdAt
                                                    ? formatDistanceToNow(new Date(c.createdAt), {
                                                        addSuffix: true,
                                                    })
                                                    : ""}
                                            </span>
                                        </div>

                                        {editingId === c._id ? (
                                            <div className="mt-2 space-y-2">
                                                <Textarea
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    className="min-h-20 resize-none text-sm"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        className="bg-black hover:bg-black text-white"
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
                                            <p className="mt-1 text-sm text-foreground break-words">
                                                {c.comment}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                {c.userId === userId && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-60 hover:opacity-100"
                                                aria-label="Comment actions"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-40 p-1" align="end">
                                            <div className="flex flex-col">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="justify-start"
                                                    onClick={() => {
                                                        setEditingId(c._id)
                                                        setEditingText(c.comment)
                                                    }}
                                                >
                                                    <PencilLine className="mr-2 h-4 w-4" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="justify-start text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(c._id)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Fixed Input at Bottom */}
            <div className="border-t pt-3 bg-background">
                <div className="flex items-start gap-2">
                    <Input
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handlePost()
                            }
                        }}
                        aria-label="Add a comment"

                        disabled={isLoading}
                        className="flex-1 resize-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:outline-none"
                    />
                    <Button
                        onClick={handlePost}
                        disabled={!newComment.trim() || isLoading}
                        className="bg-black hover:bg-black text-white disabled:opacity-50"
                        aria-label="Post comment"
                    >
                        <SendHorizonal className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}