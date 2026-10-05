import React, { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, Plus, Trash2, Edit, Check, X, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import Cookies from 'js-cookie'
import { cn } from "@/lib/utils"

const baseurl = "https://uatapi.garage.app/taskroom"

type Employee = {
    id: string
    name: string
    email?: string
    color?: string
    avatar?: string
}

interface Subtask {
    _id: string
    subTaskDetail: string
    isCompleted: boolean
    assignedToIds?: string | string[]
    taskId: string
}

const getInitials = (name: string) => {
    if (!name) return ""
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
}

// Reusable Dropdown for Subtask Assignees
const SubtaskAssigneeDropdown = ({
    assigneeIds,
    employees,
    onChange,
    disabled = false
}: {
    assigneeIds: string[]
    employees: Employee[]
    onChange: (ids: string[]) => void
    disabled?: boolean
}) => {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")

    const filtered = employees.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase())
    )

    const selectedEmployees = assigneeIds
        .map((id) => employees.find((e) => e?.id === id))
        .filter((emp): emp is Employee => Boolean(emp))

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    disabled={disabled}
                    className={cn(
                        "w-40 h-8 justify-between text-xs",
                        assigneeIds.length === 0 && "text-muted-foreground"
                    )}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        {selectedEmployees.length === 0 ? (
                            <span className="truncate text-muted-foreground">Unassigned</span>
                        ) : (
                            <TooltipProvider delayDuration={100}>
                                <div className="flex items-center gap-1">
                                    {selectedEmployees.slice(0, 3).map((emp) => (
                                        <Tooltip key={emp.id}>
                                            <TooltipTrigger asChild>
                                                <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold uppercase border border-white shadow-sm">
                                                    {getInitials(emp.name)}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                {emp.name}
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                                    {selectedEmployees.length > 3 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold border border-dashed border-gray-300">
                                                    +{selectedEmployees.length - 3}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                {selectedEmployees.slice(3).map((emp) => emp.name).join(", ")}
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                            </TooltipProvider>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-0 bg-[#0e0e12] border border-[#e5e7eb29]" align="start">
                <div className="p-2 border-b border-[#e5e7eb29]">
                    <Input
                        placeholder="Search employees…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 text-xs bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500"
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </div>
                <div className="max-h-64 overflow-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                            No employee found.
                        </div>
                    ) : (
                        filtered.map((emp) => {
                            const selected = assigneeIds.includes(emp.id)
                            return (
                                <DropdownMenuCheckboxItem
                                    key={emp.id}
                                    checked={selected}
                                    onCheckedChange={(checked) => {
                                        const next = checked
                                            ? [...assigneeIds, emp.id]
                                            : assigneeIds.filter((x) => x !== emp.id)
                                        onChange(next)
                                    }}
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold uppercase">
                                            {getInitials(emp.name)}
                                        </div>
                                        <span>{emp.name}</span>
                                    </div>
                                </DropdownMenuCheckboxItem>
                            )
                        })
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// Edit Subtask Dialog
const EditSubtaskDialog = ({
    open,
    onOpenChange,
    subtask,
    employees,
    onSave,
    onDelete
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    subtask: Subtask | null
    employees: Employee[]
    onSave: (id: string, detail: string, assigneeIds: string[]) => Promise<void>
    onDelete: (id: string) => Promise<void>
}) => {
    const [detail, setDetail] = useState("")
    const [assigneeIds, setAssigneeIds] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        if (subtask) {
            setDetail(subtask.subTaskDetail)
            const ids = Array.isArray(subtask.assignedToIds)
                ? subtask.assignedToIds
                : subtask.assignedToIds
                    ? [subtask.assignedToIds]
                    : []
            setAssigneeIds(ids)
        }
    }, [subtask])

    const handleSave = async () => {
        if (!subtask || !detail.trim()) return
        setIsSaving(true)
        try {
            await onSave(subtask._id, detail.trim(), assigneeIds)
            onOpenChange(false)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!subtask) return
        setIsDeleting(true)
        try {
            await onDelete(subtask._id)
            onOpenChange(false)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-[#0e0e12] border-[#e5e7eb29] text-white">
                <DialogHeader>
                    <DialogTitle>Edit Subtask</DialogTitle>
                    <DialogDescription>
                        Make changes to your subtask details and assignees.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white">Subtask Details</label>
                        <Input
                            value={detail}
                            onChange={(e) => setDetail(e.target.value)}
                            placeholder="Enter subtask details..."
                            className="w-full bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Assignees</label>
                        <SubtaskAssigneeDropdown
                            assigneeIds={assigneeIds}
                            employees={employees}
                            onChange={setAssigneeIds}
                        />
                    </div>
                </div>
                <div className="flex justify-between">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting || isSaving}
                    >
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving || isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || isDeleting || !detail.trim()}
                            className="bg-white text-black hover:bg-gray-200 font-semibold"
                        >
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// Main Subtasks Component
export const SubtasksPanel = ({
    taskId,
    roomId,
    userId,
    stageId,
    employees,
    open
}: {
    taskId: string
    roomId: string
    userId: string
    stageId: string
    employees: Employee[]
    open: boolean
}) => {
    const [subtasks, setSubtasks] = useState<Subtask[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [nextPage, setNextPage] = useState<number | null>(2)
    const [hasMore, setHasMore] = useState(true)
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
    const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<string[]>([])
    const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isAdding, setIsAdding] = useState(false) // ← NEW: Loader for adding subtask

    const hasFetchedInitial = useRef(false)
    const isFetchingPage = useRef<number | null>(null)
    const observer = useRef<IntersectionObserver | null>(null)

    const fetchSubtasks = useCallback(async (page = 1) => {
        if (!taskId) return
        if (isFetchingPage.current === page) return

        isFetchingPage.current = page
        if (page === 1) {
            setIsLoading(true)
            hasFetchedInitial.current = true
        } else {
            setIsLoadingMore(true)
        }

        try {
            const token = localStorage.getItem("garage_tok")
            const url = `${baseurl}/v1/sub_tasks?taskId=${taskId}&page=${page}&size=8`
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const result = await res.json()

            if (result.status && Array.isArray(result.data)) {
                const records: Subtask[] = result.data
                setSubtasks(prev => {
                    if (page === 1) return records
                    const existingIds = new Set(prev.map(item => item._id))
                    const merged = [...prev]
                    for (const record of records) {
                        if (!existingIds.has(record._id)) {
                            merged.push(record)
                            existingIds.add(record._id)
                        }
                    }
                    return merged
                })

                const metadata = result.metadata ?? {}
                const rawCurrent = metadata.currentPage
                const rawTotal = metadata.totalPages
                const rawNext = metadata.nextPage
                const currentPage = typeof rawCurrent === "number" ? rawCurrent : Number(rawCurrent) || page
                const totalPages = typeof rawTotal === "number" ? rawTotal : Number(rawTotal) || 0
                const nextPageCandidate = rawNext === null || rawNext === undefined
                    ? null
                    : typeof rawNext === "number"
                        ? rawNext
                        : Number(rawNext) || null
                const hasNext = totalPages ? currentPage < totalPages : nextPageCandidate !== null

                setCurrentPage(currentPage)
                setHasMore(hasNext)
                setNextPage(hasNext ? (nextPageCandidate ?? currentPage + 1) : null)
            } else {
                if (page === 1) setSubtasks([])
                setHasMore(false)
                setNextPage(null)
            }
        } catch (err) {
            console.error("Failed to load subtasks", err)
            toast.error("Failed to load subtasks")
            if (page === 1) setSubtasks([])
            setHasMore(false)
            setNextPage(null)
        } finally {
            isFetchingPage.current = null
            if (page === 1) {
                setIsLoading(false)
            } else {
                setIsLoadingMore(false)
            }
        }
    }, [taskId])

    useEffect(() => {
        if (!open || !taskId) {
            setSubtasks([])
            setCurrentPage(1)
            setNextPage(2)
            setHasMore(true)
            setIsLoading(false)
            setIsLoadingMore(false)
            hasFetchedInitial.current = false
            isFetchingPage.current = null
            setNewSubtaskTitle("")
            setNewSubtaskAssignee([])
            setIsAdding(false)
            if (observer.current) {
                observer.current.disconnect()
                observer.current = null
            }
            return
        }

        if (!hasFetchedInitial.current) {
            setCurrentPage(1)
            setNextPage(2)
            setHasMore(true)
            fetchSubtasks(1)
        }
    }, [open, taskId, fetchSubtasks])

    const lastElementRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (!hasFetchedInitial.current || isLoading || isLoadingMore || !hasMore || !taskId) {
                if (observer.current) {
                    observer.current.disconnect()
                    observer.current = null
                }
                return
            }
            if (observer.current) observer.current.disconnect()
            observer.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0]?.isIntersecting && hasFetchedInitial.current && !isLoading && !isLoadingMore && hasMore && nextPage) {
                        fetchSubtasks(nextPage)
                    }
                },
                { rootMargin: '200px' }
            )
            if (node) observer.current.observe(node)
        },
        [fetchSubtasks, hasMore, isLoadingMore, isLoading, nextPage, taskId]
    )

    const handleAddSubtask = async () => {
        if (!newSubtaskTitle.trim() || isAdding) return

        setIsAdding(true)

        const payload = {
            subTaskDetail: newSubtaskTitle.trim(),
            assignedToIds: newSubtaskAssignee.length > 0 ? newSubtaskAssignee : [],
            taskId,
            roomId,
            stageId,
            userId,
        }

        try {
            const token = localStorage.getItem("garage_tok")
            const res = await fetch(`${baseurl}/v1/sub_tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (data.status) {
                setSubtasks(prev => [data.data, ...prev])
                setNewSubtaskTitle("")
                setNewSubtaskAssignee([])
                toast.success("Subtask added")
            } else {
                toast.error(data.message || "Failed to add subtask")
            }
        } catch (err) {
            console.error("Error adding subtask:", err)
            toast.error("Network error")
        } finally {
            setIsAdding(false)
        }
    }

    const handleToggleComplete = async (subtask: Subtask) => {
        const newStatus = !subtask.isCompleted
        setSubtasks(prev => prev.map(s => s._id === subtask._id ? { ...s, isCompleted: newStatus } : s))

        try {
            const token = localStorage.getItem("garage_tok")
            const res = await fetch(`${baseurl}/v1/sub_tasks/${subtask._id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ isCompleted: newStatus }),
            })
            const data = await res.json()
            if (!data.status) {
                setSubtasks(prev => prev.map(s => s._id === subtask._id ? { ...s, isCompleted: !newStatus } : s))
                toast.error(data.message || "Update failed")
            }
        } catch (err) {
            setSubtasks(prev => prev.map(s => s._id === subtask._id ? { ...s, isCompleted: !newStatus } : s))
            toast.error("Network error")
        }
    }

    const handleEditSubtask = (subtask: Subtask) => {
        setEditingSubtask(subtask)
        setIsEditDialogOpen(true)
    }

    const handleSaveEdit = async (id: string, detail: string, assigneeIds: string[]) => {
        try {
            const token = localStorage.getItem("garage_tok")
            const res = await fetch(`${baseurl}/v1/sub_tasks/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ subTaskDetail: detail, assignedToIds: assigneeIds }),
            })
            const data = await res.json()
            if (data.status) {
                setSubtasks(prev => prev.map(s =>
                    s._id === id ? { ...s, subTaskDetail: detail, assignedToIds: assigneeIds } : s
                ))
                toast.success("Subtask updated")
            } else {
                toast.error(data.message || "Update failed")
            }
        } catch (err) {
            toast.error("Network error")
        }
    }

    const handleDeleteSubtask = async (id: string) => {
        try {
            const token = localStorage.getItem("garage_tok")
            const res = await fetch(`${baseurl}/v1/sub_tasks/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (data.status) {
                setSubtasks(prev => prev.filter(s => s._id !== id))
                toast.success("Subtask deleted")
            } else {
                toast.error(data.message || "Delete failed")
            }
        } catch (err) {
            toast.error("Network error")
        }
    }

    const getAssigneeNames = (assignedToIds: string | string[] | undefined): string[] => {
        if (!assignedToIds) return []
        const ids = Array.isArray(assignedToIds) ? assignedToIds : [assignedToIds]
        return ids.map(id => {
            const emp = employees.find(e => e.id === id)
            return emp ? emp.name : id
        })
    }

    const completedCount = subtasks.filter(s => s.isCompleted).length
    const totalCount = subtasks.length

    return (
        <>
            <div className="space-y-6">
                {/* Header with Progress */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Subtasks</h3>
                        <span className="text-sm text-gray-400">
                            {completedCount} of {totalCount} completed
                        </span>
                    </div>
                    {totalCount > 0 && (
                        <div className="w-full bg-[#1e1e2d] rounded-full h-2 border border-[#e5e7eb29]">
                            <div
                                className="bg-green-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Add Subtask Form - With Loader */}
                <div className="flex items-center gap-3 p-4 bg-[#1e1e2d] rounded-lg border border-[#e5e7eb29] shadow-sm">
                    <div className="flex-1">
                        <Input
                            placeholder="Add a new subtask..."
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && newSubtaskTitle.trim() && !isAdding) {
                                    e.preventDefault()
                                    handleAddSubtask()
                                }
                            }}
                            disabled={isAdding}
                            className="h-10 border-0 shadow-none bg-transparent text-white placeholder:text-gray-500"
                        />
                    </div>
                    <SubtaskAssigneeDropdown
                        assigneeIds={newSubtaskAssignee}
                        employees={employees}
                        onChange={setNewSubtaskAssignee}
                        disabled={isAdding}
                    />
                    <Button
                        size="sm"
                        onClick={handleAddSubtask}
                        disabled={!newSubtaskTitle.trim() || isAdding}
                        className="bg-white text-black hover:bg-gray-200 h-10 px-4 min-w-[100px] flex items-center justify-center gap-2 font-semibold"
                    >
                        {isAdding ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4" />
                                Add
                            </>
                        )}
                    </Button>
                </div>

                {/* Subtasks List */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border animate-pulse">
                                <div className="w-5 h-5 bg-gray-300 rounded" />
                                <div className="flex-1 h-10 bg-gray-200 rounded" />
                                <div className="w-32 h-8 bg-gray-200 rounded" />
                                <div className="w-8 h-8 bg-gray-200 rounded" />
                            </div>
                        ))}
                    </div>
                ) : subtasks.length === 0 ? (
                    <div className="text-center py-12 bg-[#0e0e12]/50 rounded-lg border border-[#e5e7eb29] border-dashed">
                        <p className="text-gray-400 italic">
                            No subtasks yet. Create your first subtask above.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {subtasks.map((subtask, index) => {
                            const isLast = index === subtasks.length - 1
                            const assigneeNames = getAssigneeNames(subtask.assignedToIds)

                            return (
                                <div
                                    key={subtask._id}
                                    ref={isLast ? lastElementRef : null}
                                    className="group flex items-center gap-3 p-4 bg-[#1e1e2d] rounded-lg border border-[#e5e7eb29] hover:bg-[#1e1e2d]/80 transition-all duration-200"
                                >
                                    <button
                                        onClick={() => handleToggleComplete(subtask)}
                                        className={cn(
                                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                            subtask.isCompleted
                                                ? "bg-green-500 border-green-500"
                                                : "border-gray-700 hover:border-gray-500"
                                        )}
                                    >
                                        {subtask.isCompleted && <Check className="h-3 w-3 text-white" />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "text-sm font-medium text-white",
                                            subtask.isCompleted && "line-through text-gray-500"
                                        )}>
                                            {subtask.subTaskDetail}
                                        </p>
                                        {assigneeNames.length > 0 && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                Assigned to: {assigneeNames.join(", ")}
                                            </p>
                                        )}
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditSubtask(subtask)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-gray-400 hover:text-white"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>
                            )
                        })}
                        {isLoadingMore && (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <EditSubtaskDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                subtask={editingSubtask}
                employees={employees}
                onSave={handleSaveEdit}
                onDelete={handleDeleteSubtask}
            />
        </>
    )
}