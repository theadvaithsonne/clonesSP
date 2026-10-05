"use client"
import * as React from "react"
import { useEffect, SetStateAction, Dispatch, useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { CalendarDays, Clock, User, Check, ChevronsUpDown, X, Plus, Trash2, FileImage, ChevronDown, Upload, Play, FileText, Download, File, Edit } from "lucide-react"
import {
    ArrowLeft, CalendarIcon, Loader2, Search, Share2
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Column, Task, Subtask } from "../types/kanban"
import { CommentsPanel } from "./comments-panel"
import Cookies from 'js-cookie';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useSearchParams } from "next/navigation"
import { useParams } from "next/navigation"
type Employee = {
    id: string
    name: string
    email?: string
    color?: string
    avatar?: string
}

interface Attachment {
    fileLink: string
    fileName: string
    fileType: "document" | "image" | "video"
    comment: string
}



type EditTaskPayload = {
    title: string
    description: string
    tags: string[]
    roomId?: string
    stageId: string
    userId?: string
    assignedToId: string
    dueDate: number
    priority: "low" | "medium" | "high"
    startDate: number
    attachments?: Attachment[]
}

const baseurl = "https://uatapi.garage.app/taskroom"
const API_URL = "https://uatapi.garage.app"

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
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filtered = (employees || []).filter((e) =>
        e?.name?.toLowerCase().includes(search.toLowerCase())
    )

    const selectedEmployees = (assigneeIds || [])
        .map((id) => (employees || []).find((e) => e.id === id))
        .filter((emp): emp is Employee => Boolean(emp))

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <Button
                variant="outline"
                type="button"
                disabled={disabled}
                onClick={() => setOpen(!open)}
                className={cn(
                    "w-full h-10 justify-between text-xs px-3",
                    assigneeIds.length === 0 && "text-muted-foreground",
                    "focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-[#e5e7eb29]  focus:outline-none",
                    open && "ring-0 ring-blue-500 cursor-pointer"
                )}
            >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {selectedEmployees.length === 0 ? (
                        <span className="truncate text-muted-foreground">Unassigned</span>
                    ) : (
                        <TooltipProvider delayDuration={100}>
                            <div className="flex items-center gap-1">
                                {selectedEmployees.slice(0, 3).map((emp) => (
                                    <Tooltip key={emp.id}>
                                        <TooltipTrigger asChild>
                                            <div
                                                className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold uppercase border border-white shadow-sm shrink-0"
                                            >
                                                {getInitials(emp.name)}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">{emp.name}</TooltipContent>
                                    </Tooltip>
                                ))}

                                {selectedEmployees.length > 3 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold border border-dashed border-gray-300 shrink-0">
                                                +{selectedEmployees.length - 3}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            {selectedEmployees
                                                .slice(3)
                                                .map((emp) => emp.name)
                                                .join(", ")}
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </TooltipProvider>
                    )}
                </div>

                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>

            {open && (
                <div className="absolute z-50 w-64 mt-2 bg-[#0e0e12] border border-[#e5e7eb29] rounded-md shadow-md overflow-hidden left-0">
                    <div className="p-2 border-b border-[#e5e7eb29]">
                        <Input
                            placeholder="Search employees…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8 text-xs border-[#e5e7eb29] focus-visible:ring-0 focus:outline-none"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-muted-foreground italic">
                                No employee found.
                            </div>
                        ) : (
                            filtered.map((emp) => {
                                const isSelected = assigneeIds.includes(emp.id);

                                return (
                                    <div
                                        key={emp.id}
                                        onClick={() => {
                                            const next = isSelected
                                                ? assigneeIds.filter((id) => id !== emp.id)
                                                : [...assigneeIds, emp.id];
                                            onChange(next);
                                        }}
                                        className="flex items-center gap-2 py-2 px-3 text-sm cursor-pointer hover:bg-[#1a1a1f] transition-colors"
                                    >
                                        <div className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                            isSelected ? "bg-blue-500 border-blue-500" : "border-[#e5e7eb29]"
                                        )}>
                                            {isSelected && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                        <div
                                            className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold uppercase shrink-0"
                                        >
                                            {getInitials(emp.name)}
                                        </div>
                                        <span className="truncate text-foreground">{emp.name}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Subtask</DialogTitle>
                    <DialogDescription>
                        Make changes to your subtask details and assignees.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Subtask Details</label>
                        <Input
                            value={detail}
                            onChange={(e) => setDetail(e.target.value)}
                            placeholder="Enter subtask details..."
                            className="w-full border-1 border-[#e5e7eb29] "

                        />
                    </div>
                    <div className="space-y-2 gap-2">
                        {/* <label className="text-sm font-medium mr-15">Assignees</label> */}
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
                        className="border-[#e5e7eb29] border"
                    >
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving || isDeleting}
                            className="border-[#e5e7eb29] border"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || isDeleting || !detail.trim()}
                            className="border-[#e5e7eb29] border"
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

// Subtasks Panel Component
const SubtasksPanel = ({
    taskId,
    roomId,
    userId,
    stageId,
    employees,
    open,
    subtasks,
    setSubtasks,
    code
}: {
    taskId: string
    roomId: string
    userId: string
    stageId: string
    employees: Employee[]
    open: boolean
    subtasks: Subtask[]
    setSubtasks: React.Dispatch<React.SetStateAction<Subtask[]>>;
    code: string | null
}) => {

    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [nextPage, setNextPage] = useState<number | null>(2)
    const [hasMore, setHasMore] = useState(true)
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
    const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<string[]>([])
    const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const hasFetchedInitial = React.useRef(false)
    const isFetchingPage = React.useRef<number | null>(null)
    const observer = React.useRef<IntersectionObserver | null>(null)

    const fetchSubtasks = useCallback(async (page = 1) => {
        if (!code) {
            if (!taskId) return
        }

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

            const url = `${baseurl}/v1/sub_tasks?taskId=${code ? code : taskId}&page=${page}&size=8`
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
                const currentPageNum = typeof rawCurrent === "number" ? rawCurrent : Number(rawCurrent) || page
                const totalPages = typeof rawTotal === "number" ? rawTotal : Number(rawTotal) || 0
                const nextPageCandidate = rawNext === null || rawNext === undefined
                    ? null
                    : typeof rawNext === "number"
                        ? rawNext
                        : Number(rawNext) || null
                const hasNext = totalPages ? currentPageNum < totalPages : nextPageCandidate !== null

                setCurrentPage(currentPageNum)
                setHasMore(hasNext)
                setNextPage(hasNext ? (nextPageCandidate ?? currentPageNum + 1) : null)
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
        fetchSubtasks(1)
    }, [])

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
            setIsAdding(false)
            setNewSubtaskAssignee([])
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

        }
    }, [open, taskId])

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
        if (!newSubtaskTitle.trim()) return
        setIsAdding(true)
        const payload = {
            subTaskDetail: newSubtaskTitle.trim(),
            assignedToIds: newSubtaskAssignee,
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
                setIsAdding(false)
            } else {
                toast.error(data.message || "Failed to add")
                setIsAdding(false)
            }
        } catch (err) {
            toast.error("Network error")
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

            // Get current subtask to compare with previous assignees
            const currentSubtask = subtasks.find(s => s._id === id)
            const previousAssigneeIds = Array.isArray(currentSubtask?.assignedToIds)
                ? currentSubtask.assignedToIds
                : currentSubtask?.assignedToIds
                    ? [currentSubtask.assignedToIds]
                    : []

            // Find newly added assignees
            const newAssignees = assigneeIds.filter(id => !previousAssigneeIds.includes(id))

            // Find removed assignees
            const removedAssignees = previousAssigneeIds.filter(id => !assigneeIds.includes(id))

            const payload: any = {
                subTaskDetail: detail,
            }

            // Only include addAssignedTo if there are new assignees
            if (newAssignees.length > 0) {
                payload.addAssignedTo = newAssignees // Send the IDs directly
            }

            // Only include removeAssignedToIds if there are removed assignees
            if (removedAssignees.length > 0) {
                payload.removeAssignedToIds = removedAssignees
            }

            const res = await fetch(`${baseurl}/v1/sub_tasks/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
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



    return (
        <>


            <div className="w-full  mx-auto ">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border border-[#e5e7eb29]  rounded flex items-center justify-center">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                        </div>
                        <h1 className="text-sm font-semibold text-foreground">Subtasks</h1>
                    </div>

                    {/* Main Card */}
                    <div className="border-[#e5e7eb29] border  rounded-lg p-6 space-y-4">
                        {/* Title Input */}
                        <Input
                            placeholder="Add a new subtask..."
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && newSubtaskTitle.trim() && handleAddSubtask()}

                            className="h-10 text-sm border border-[#e5e7eb29] focus-visible:border-gray-500 rounded-md focus-visible:ring-0 focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:outline-none"
                        />

                        {/* Assign to Section */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground mb-2">Assign to</label>

                            {/* Dropdown */}
                            <SubtaskAssigneeDropdown
                                assigneeIds={newSubtaskAssignee}
                                employees={employees}
                                onChange={setNewSubtaskAssignee}
                            />
                        </div>

                        {/* Add Subtask Button */}
                        <button
                            onClick={handleAddSubtask}
                            disabled={!newSubtaskTitle.trim() || isAdding}
                            className="w-full py-3 flex border-[#e5e7eb29] border cursor-pointer text-white text-sm items-center justify-center gap-2 "
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {isAdding ? (
                                <>

                                    Adding...
                                </>
                            ) : (
                                <>

                                    Add
                                </>
                            )}
                        </button>
                    </div>

                </div>
            </div>





            <div className="space-y-6 mt-2">
                {/* Add Subtask Form */}


                {/* Subtasks List */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border animate-pulse">
                                <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded" />
                                <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                                <div className="w-32 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                            </div>
                        ))}
                    </div>
                ) : subtasks?.length === 0 ? (
                    <div className="text-center py-12   rounded-lg border border-[#e5e7eb29] border-dashed">
                        <p className="text-white italic">
                            No subtasks yet. Create your first subtask above.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {subtasks?.map((subtask, index) => {
                            const isLast = index === subtasks?.length - 1
                            const assigneeNames = getAssigneeNames(subtask.assignedToIds)

                            return (
                                <div
                                    key={subtask._id}
                                    ref={isLast ? lastElementRef : null}
                                    className="group flex items-center gap-3 p-4 text-white rounded-lg border border-[#e5e7eb29] hover:shadow-md transition-all duration-200"
                                >
                                    <button
                                        onClick={() => handleToggleComplete(subtask)}
                                        className={cn(
                                            "w-5 h-5 rounded border-2  border-[#e5e7eb29] flex items-center justify-center transition-all flex-shrink-0",
                                            subtask.isCompleted
                                                ? "bg-green-500 border-green-500"
                                                : "border-gray-300 hover:border-gray-400"
                                        )}
                                    >
                                        {subtask.isCompleted && <Check className="h-3 w-3 text-white" />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "text-sm font-medium",
                                            subtask.isCompleted && "line-through text-muted-foreground"
                                        )}>
                                            {subtask.subTaskDetail}
                                        </p>
                                        {assigneeNames.length > 0 && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Assigned to: {assigneeNames.join(", ")}
                                            </p>
                                        )}
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditSubtask(subtask)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 flex-shrink-0"
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












export function EditTaskRoom({
    task,
    employees,
    columns,
    roomId,
    userId,
    onCancel,
    onOpenChange,
    open,
    setColumns,
    workspaceUserId,
    userRole,
    setStagecolumns,
    conversationId,
    subtasks,
    setSubtasks
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    task?: Task | null
    employees: Employee[]
    columns: Column[]
    setColumns: Dispatch<SetStateAction<Column[]>>
    roomId: string
    onCancel: () => void
    setStagecolumns: React.Dispatch<React.SetStateAction<Task[]>>;
    userId: string
    workspaceUserId: string | undefined
    userRole: string
    conversationId: string | undefined
    subtasks: Subtask[]
    setSubtasks: React.Dispatch<React.SetStateAction<Subtask[]>>;
}) {
    const [title, setTitle] = React.useState(task?.title || "")
    const [taskDeatails, settaskDeatails] = React.useState<Task | null>(null)
    const [description, setDescription] = React.useState(task?.description || "")
    const [assigneeId, setAssigneeId] = React.useState<string>(task?.assignedToId || "")
    const [dueDate, setDueDate] = React.useState<Date | undefined>(task?.dueDate ? new Date(task.dueDate) : undefined)
    const [startDate, setstartDate] = React.useState<Date | undefined>(task?.startDate ? new Date(task.startDate) : undefined)
    const [updateDate, setupdateDate] = React.useState(task?.updatedAt || "")
    const [stageId, setStageId] = React.useState<string>(task?.stageId || "")
    const [priority, setPriority] = React.useState<"low" | "medium" | "high">(task?.priority || "medium")
    const [tags, setTags] = React.useState<string[]>(Array.isArray(task?.tags) ? task.tags : [])
    const [newTag, setNewTag] = React.useState("")
    const [assigneeSearch, setAssigneeSearch] = React.useState("")
    const [stageSearch, setStageSearch] = React.useState("")
    const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = React.useState(false)
    const [isDueDatePopoverOpen, setIsDueDatePopoverOpen] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [isSavingfile, setisSavingfile] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState<"files" | "comments" | "subtasks">("files")
    const [originalAttachments, setOriginalAttachments] = React.useState<Attachment[]>([])
    const [newAttachments, setNewAttachments] = useState<Attachment[]>([])
    const [copied, setCopied] = useState(false)
    const [copieId, setcopieId] = useState("")
    const [newVideoLink, setNewVideoLink] = React.useState("")
    const [isUploading, setIsUploading] = React.useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const pasteInputRef = React.useRef<HTMLInputElement>(null)
    const [dragActive, setDragActive] = React.useState(false)
    const [uizue, setUizue] = React.useState(false)
    const [isInitialLoad, setIsInitialLoad] = React.useState(true)
    const [currentPage, setCurrentPage] = React.useState(1)
    const [hasNextPage, setHasNextPage] = React.useState(true)
    const [hasFetchedFiles, setHasFetchedFiles] = React.useState(false)
    const [previewOpen, setPreviewOpen] = React.useState(false)
    const [previewItem, setPreviewItem] = React.useState<{
        type: "image" | "video" | "pdf" | "doc" | "other"
        url: string
        name: string
    } | null>(null)
    const [originals, setoriginals] = React.useState({
        title: "", description: "", tags: [], stageId: "", assignedToId: "", dueDate: "", startDate: "", priority: "",
    })
    const observer = React.useRef<IntersectionObserver | null>(null)
    const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);
    const [personFilter, setPersonFilter] = useState("");
    const personDropdownRef = React.useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();

    const code = searchParams.get('card');
    // your selected person ID state (renamed)
    const [chosenPersonId, setChosenPersonId] = useState<string>("");

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (personDropdownRef.current && !personDropdownRef.current.contains(e.target as Node)) {
                setIsPersonDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    const allAttachments = React.useMemo(() => {
        return [...originalAttachments, ...newAttachments]
    }, [originalAttachments, newAttachments])

    // Fetch Task Data
    const fetchTaskData = async (taskId: string) => {

        if (!taskId) return
        try {
            const taskUrl = `https://uatapi.garage.app/taskroom/v1/tasks/${taskId}`
            const taskRes = await fetch(taskUrl)
            if (!taskRes.ok) throw new Error(`HTTP ${taskRes.status}`)
            const apiTask = await taskRes.json()
            const data = apiTask?.data
            if (!data) return
            setTitle(data.title ?? "")
            setcopieId(data?._id ?? "")
            setDescription(data.description ?? "")
            setAssigneeId(data.assignedToId ?? "")
            setDueDate(data.dueDate ? new Date(data.dueDate) : undefined)
            setstartDate(data.startDate ? new Date(data.startDate) : undefined)
            setStageId(data.stageId ?? "")
            setupdateDate(data.updatedAt ?? "")
            settaskDeatails(data)
            setTags(Array.isArray(data.tags) ? data.tags : [])
            setPriority(data.priority ?? "medium")
            setoriginals({
                title: data.title ?? "",
                description: data.description ?? "",
                tags: Array.isArray(data.tags) ? data.tags : [],
                stageId: data.stageId ?? "",
                assignedToId: data.assignedToId ?? "",
                dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : "",
                startDate: data.startDate ? new Date(data.startDate).toISOString() : "",
                priority: data.priority ?? "medium",
            })
            setNewAttachments([])
            setNewVideoLink("")
        } catch (err) {
            console.error("Fetch error:", err)
            toast.error("Failed to load task")
        }
    }

    // Reset on Open/Close
    useEffect(() => {


        if (code) {

            if (!open || !code) {
                setTitle("")
                setDescription("")
                setAssigneeId("")
                setDueDate(undefined)
                setstartDate(undefined)
                setStageId("")
                setupdateDate("")
                setTags([])
                setPriority("medium")
                setAssigneeSearch("")
                setStageSearch("")
                setNewTag("")
                setOriginalAttachments([])
                setNewAttachments([])
                setNewVideoLink("")
                setActiveTab('files')
                setCurrentPage(1)
                setHasNextPage(true)
                setIsInitialLoad(true)
                setHasFetchedFiles(false)
                return
            }
            fetchTaskData(code)
        }
        else {
            if (!open || !task?._id) {
                setTitle("")
                setDescription("")
                setAssigneeId("")
                setDueDate(undefined)
                setstartDate(undefined)
                setStageId("")
                setupdateDate("")
                setTags([])
                setPriority("medium")
                setAssigneeSearch("")
                setStageSearch("")
                setNewTag("")
                setOriginalAttachments([])
                setNewAttachments([])
                setNewVideoLink("")
                setActiveTab('files')
                setCurrentPage(1)
                setHasNextPage(true)
                setIsInitialLoad(true)
                setHasFetchedFiles(false)
                return
            }
            fetchTaskData(task._id)
        }

    }, [open, task?._id])

    // Fetch Files
    useEffect(() => {

        if (code) {
            if (!open || !code || hasFetchedFiles || activeTab !== "files") return
        }
        else {
            if (!open || !task?._id || hasFetchedFiles || activeTab !== "files") return
        }



        const fetchFirstPage = async () => {
            setUizue(true)
            setIsInitialLoad(true)
            setCurrentPage(1)
            setOriginalAttachments([])
            setHasNextPage(true)
            try {
                const url = new URL('https://uatapi.garage.app/taskroom/v1/files')
                url.searchParams.append('roomId', roomId)
                url.searchParams.append('taskId', task?._id ?? '')
                url.searchParams.append('page', '1')
                url.searchParams.append('size', '50')
                const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const result = await response.json()
                const newFiles = Array.isArray(result.data) ? result.data : []
                setOriginalAttachments(newFiles)
                setHasNextPage(!!result.metadata?.nextPage)
                setHasFetchedFiles(true)
            } catch (err) {
                toast.error("Failed to load files")
            } finally {
                setUizue(false)
                setIsInitialLoad(false)
            }
        }
        fetchFirstPage()
    }, [open, task?._id, activeTab, hasFetchedFiles, roomId])

    // Infinite scroll
    const lastElementRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (uizue || !hasNextPage) return
            if (observer.current) observer.current.disconnect()
            observer.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting && hasNextPage && !uizue) {
                        setCurrentPage((prev) => prev + 1)
                    }
                },
                { rootMargin: '200px' }
            )
            if (node) observer.current.observe(node)
        },
        [uizue, hasNextPage]
    )

    useEffect(() => {
        if (currentPage <= 1 || !hasFetchedFiles) return
        const fetchNextPage = async () => {
            setUizue(true)
            try {
                const url = new URL('https://uatapi.garage.app/taskroom/v1/files')
                url.searchParams.append('roomId', roomId)
                url.searchParams.append('taskId', task?._id ?? '')
                url.searchParams.append('page', currentPage.toString())
                url.searchParams.append('size', '50')
                const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const result = await response.json()
                const newFiles = Array.isArray(result.data) ? result.data : []
                setOriginalAttachments(prev => [...prev, ...newFiles])
                setHasNextPage(!!result.metadata?.nextPage)
            } catch (err) {
                toast.error("Failed to load more files")
            } finally {
                setUizue(false)
            }
        }
        fetchNextPage()
    }, [currentPage, hasFetchedFiles, task?._id, roomId])

    // Filters
    const filteredEmployees = React.useMemo(
        () => employees?.filter((e) => e?.name?.toLowerCase()?.includes(personFilter?.toLowerCase())),
        [employees, personFilter],
    )
    const filteredStages = React.useMemo(
        () => columns.filter((s) => s?.name?.toLowerCase()?.includes(stageSearch?.toLowerCase())),
        [columns, stageSearch],
    )

    const addTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags([...tags, newTag.trim()])
            setNewTag("")
        }
    }
    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter((tag) => tag !== tagToRemove))
    }
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            addTag()
        }
    }

    const handleStartDateSelect = (date: Date | undefined) => {
        setstartDate(date)
        if (date && dueDate && date > dueDate) {
            toast("Due date cannot be earlier than start date")
            setDueDate(undefined)
        }
        setIsStartDatePopoverOpen(false)
    }
    const handleDueDateSelect = (date: Date | undefined) => {
        if (date && startDate && date < startDate) {
            toast("Due date cannot be earlier than start date")
            return
        }

        const sourceDate = date ?? new Date(); // use today if d is null/undefined
        const endOfDay = new Date(sourceDate);
        endOfDay.setHours(23, 59, 59, 999);;
        setDueDate(endOfDay)
        setIsDueDatePopoverOpen(false)
    }

    // Upload


    const uploadFilesToS3 = async (files: File[]): Promise<Attachment[]> => {
        if (!files.length) return []

        const token = localStorage.getItem("garage_tok")
        if (!token) throw new Error("Authentication token missing")

        const formData = new FormData()
        files.forEach((file) => formData.append("files", file))
        formData.append("folder", "task-attachments")

        const res = await fetch(`${API_URL}/api/s3upload/multiple`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                // Note: Do NOT set Content-Type — browser sets it automatically with correct boundary
            },
            body: formData,
        })

        if (!res.ok) {
            const error = await res.text()
            throw new Error(`S3 upload failed: ${res.status} ${error}`)
        }

        const json = await res.json()
        if (!json.success || !Array.isArray(json.data)) {
            throw new Error("Invalid S3 response format")
        }

        return json.data.map((item: { url: string; fileName: string }, index: number) => {
            const file = files[index]
            const mime = file.type || ""
            const fileName = item.fileName || file.name

            // Determine fileType: image → video → document
            let fileType: "image" | "video" | "document" = "document"

            if (mime.startsWith("image/")) {
                fileType = "image"
            } else if (mime.startsWith("video/")) {
                fileType = "video"
            } else if (!mime && fileName) {
                // Fallback when MIME is missing (common on Safari/iOS with .mov, etc.)
                const ext = fileName.split(".").pop()?.toLowerCase()

                const videoExts = ["mp4", "mov", "avi", "mkv", "webm", "mpg", "mpeg", "m4v", "3gp", "flv", "wmv"]
                const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff", "heic", "heif"]

                if (videoExts.includes(ext || "")) fileType = "video"
                else if (imageExts.includes(ext || "")) fileType = "image"
            }

            return {
                fileLink: item.url,
                fileName,
                fileType, // Correctly detected: image | video | document
                comment: "Uploaded via EditTaskRoom",
            }
        })
    }



    const processFiles = async (fileList: FileList | File[]) => {
        if (isUploading || !fileList.length) return
        setIsUploading(true)
        const files = Array.from(fileList)
        try {
            const uploaded = await uploadFilesToS3(files)
            setNewAttachments(p => [...p, ...uploaded])
            toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`)
        } catch (e) {
            toast.error("Upload failed")
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
        else if (e.type === "dragleave") setDragActive(false)
    }
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files) processFiles(e.dataTransfer.files)
    }
    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return
        const files: File[] = []
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === "file") {
                const f = items[i].getAsFile()
                if (f) files.push(f)
            }
        }
        if (files.length) {
            e.preventDefault()
            await processFiles(files)
        }
    }

    const addVideoLink = () => {
        if (!newVideoLink.trim()) return
        const url = newVideoLink.trim()
        if (allAttachments.some(a => a.fileLink === url)) return
        let fileName = "Video Link"
        try { fileName = new URL(url).pathname.split("/").pop() || fileName } catch { }
        setNewAttachments(p => [...p, { fileLink: url, fileName, fileType: "video", comment: "Video link" }])
        setNewVideoLink("")
    }

    const removeNewAttachment = (link: string) => {
        setNewAttachments(p => p.filter(a => a.fileLink !== link))
    }

    const getFileIcon = (type: "document" | "image" | "video", name: string) => {
        if (type === "image") return <FileImage className="h-5 w-5 text-gray-500" />
        if (type === "video") return <Play className="h-5 w-5 text-purple-500" />
        return <FileText className="h-5 w-5 text-gray-700" />
    }

    const googleViewerUrl = (url: string) => `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`

    const openPreview = (att: Attachment) => {
        const { fileLink, fileName, fileType } = att
        if (fileType === "image") {
            setPreviewItem({ type: "image", url: fileLink, name: fileName })
        } else if (fileType === "video") {
            setPreviewItem({ type: "video", url: fileLink, name: fileName })
        } else {
            const ext = fileName.split(".").pop()?.toLowerCase()
            if (ext === "pdf") setPreviewItem({ type: "pdf", url: fileLink, name: fileName })
            else if (["doc", "docx"].includes(ext || "")) setPreviewItem({ type: "doc", url: googleViewerUrl(fileLink), name: fileName })
            else setPreviewItem({ type: "other", url: fileLink, name: fileName })
        }
        setPreviewOpen(true)
    }

    // Save Task
    // ----------------------------------------------------------
    // ADD: Wrapper Function (Token Verification + Save + Chat)
    // ----------------------------------------------------------
    const handleSaveWrapper = async () => {
        const isAssigneeChanged = assigneeId !== originals.assignedToId

        try {
            if (isAssigneeChanged) {
                const token = localStorage.getItem("garage_tok")

                // 1️⃣ Token verification
                const tokenRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                if (!tokenRes.ok) {
                    toast("Invalid or expired token. Please log in again.")
                    return
                }

                // 2️⃣ Save Task
                const saveSuccess = await handleSave()
                if (!saveSuccess) return

                // 3️⃣ Add new assignee to chat
                // await addMembersToTaskroomChat(assigneeId)

            } else {
                // If assignee is same → only save task
                await handleSave()
            }
        } catch (err) {
            console.error("Error in handleSaveWrapper:", err)
            toast.error("Invalid or expired token. Please log in again.")
        }
    }



    // ----------------------------------------------------------
    // ORIGINAL - UPDATED handleSave() (returns true/false now)
    // ----------------------------------------------------------

    async function handleSave() {
        if (!task?._id) return toast.error("No task selected")
        if (!title.trim()) return toast.error("Title is required")

        if (!startDate) return toast.error("Start date is required")
        if (!dueDate) return toast.error("Due date is required")
        if (dueDate < startDate) return toast.error("Due date cannot be earlier than start date")
        if (!stageId) return toast.error("Stage is required")


        setIsSaving(true)

        try {
            const payload: Partial<EditTaskPayload> = {}

            if (title.trim() !== originals.title) payload.title = title.trim()
            if (description.trim() !== originals.description) payload.description = description.trim()
            if (JSON.stringify(tags) !== JSON.stringify(originals.tags)) payload.tags = tags
            if (stageId !== originals.stageId) payload.stageId = stageId
            if (assigneeId !== originals.assignedToId) payload.assignedToId = assigneeId
            if (dueDate && dueDate.toISOString() !== originals.dueDate) {
                payload.dueDate = dueDate?.getTime();
            }

            if (startDate && startDate.toISOString() !== originals.startDate) {
                payload.startDate = startDate?.getTime();
            }
            if (priority !== originals.priority) payload.priority = priority

            if (Object.keys(payload).length === 0) {
                toast.info("No changes detected")
                return false
            }

            const token = localStorage.getItem("garage_tok")
            const res = await fetch(`${baseurl}/v1/tasks/${task._id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            })

            const responseData = await res.json()

            if (responseData?.status) {
                const updatedTask: Task = {
                    ...task,
                    ...(responseData?.data.title !== undefined && { title: responseData?.data.title }),
                    ...(responseData?.data.description !== undefined && { description: responseData?.data.description }),
                    ...(responseData?.data.assignedToId !== undefined && { assignedToId: responseData?.data.assignedToId }),
                    ...(responseData?.data.dueDate !== undefined && { dueDate: responseData?.data.dueDate }),
                    ...(responseData?.data.startDate !== undefined && { startDate: responseData?.data.startDate }),
                    ...(responseData?.data.priority !== undefined && { priority: responseData?.data.priority }),
                    ...(responseData?.data.stageId !== undefined && { stageId: responseData?.data.stageId }),
                    ...(responseData?.data.tags !== undefined && { tags: responseData?.data.tags }),
                    updatedAt: responseData?.data?.updatedAt,
                }

                setupdateDate(responseData?.data?.updatedAt)

                // Update Columns
                let updatedColumns = columns
                if (task.stageId !== stageId) {
                    updatedColumns = columns.map(c => {
                        if (c._id === task.stageId) {
                            return { ...c, tasks: c.tasks.filter(t => t._id !== task._id) }
                        }
                        if (c._id === updatedTask.stageId) {
                            return { ...c, tasks: [...c.tasks, updatedTask] }
                        }
                        return c
                    })
                } else {
                    updatedColumns = columns.map(c => {
                        if (c._id === updatedTask.stageId) {
                            return {
                                ...c,
                                tasks: c.tasks.map(t =>
                                    t._id === updatedTask._id ? updatedTask : t
                                )
                            }
                        }
                        return c
                    })
                }

                setColumns(updatedColumns)

                toast(task.stageId !== stageId ? "Task moved & updated" : "Task updated")
                onCancel()
                return true // ⭐ success
            } else {
                toast.error(responseData?.message || "Update failed")
                return false
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to save")
            return false
        } finally {
            setIsSaving(false)
        }
    }



    // ----------------------------------------------------------
    // Your Chat API (unchanged)
    // ----------------------------------------------------------

    const addMembersToTaskroomChat = async (uid: string) => {
        const token = localStorage.getItem("garage_tok")
        try {
            const res = await fetch(`${API_URL}/api/chat/conversations/${conversationId}/participants`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ participants: [uid] }),
            })

            if (!res.ok) throw new Error("Failed to add member to chat")

            return await res.json()
        } catch (e) {
            toast("Error while adding member to chat")
            console.error("Failed to add member:", e)
        }
    }

    // Save Files
    const handleSubmitFiles = async (e: React.MouseEvent) => {
        e.preventDefault()
        if (newAttachments.length === 0) {
            toast('Please add at least one attachment.')
            return
        }
        setisSavingfile(true)
        const payload = { roomId, userId, taskId: task?._id, attachments: newAttachments }
        try {
            const response = await fetch(`${baseurl}/v1/files/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const result = await response.json()
            if (response.ok) {
                toast('Files saved successfully!')
                setOriginalAttachments(prev => [...prev, ...newAttachments])
                setNewAttachments([])
            } else {
                toast(`Failed to save files: ${result.message}`)
            }
        } catch (error) {
            toast('Network error. Please try again.')
        } finally {
            setisSavingfile(false)
        }
    }
    console.log("previewItem", previewItem)
    // Delete Task
    async function handleDelete() {
        if (!task?._id) return toast.error("No task selected")
        const token = localStorage.getItem("garage_tok")
        try {
            setIsDeleting(true)
            const res = await fetch(`${baseurl}/v1/tasks/${task._id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (!data?.status) throw new Error(data?.message || "Delete failed")
            setStagecolumns(prev => prev.filter(t => t._id !== task._id))
            setColumns(prev => prev.map(col => {
                if (col._id === task.stageId) {
                    return { ...col, tasks: col.tasks.filter(t => t._id !== task._id), taskCount: (col.taskCount ?? 0) - 1 }
                }
                return col
            }))
            toast.success("Task deleted")
            onCancel()
        } catch (e: any) {
            toast.error(e.message || "Delete failed")
        } finally {
            setIsDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    const getEmployeeName = (id: string): string => {
        const employee = employees.find(emp => emp.id === id)
        return employee ? employee.name : id
    }

    const formatInLocalTime = (date: Date | undefined) => {
        if (!date) return 'DD-MM-YYYY'
        return format(date, 'dd-MM-yyyy')
    }

    const todayNY = new Date(new Date().getTime() - (4 * 60 * 60 * 1000))
    todayNY.setHours(0, 0, 0, 0)
    const downloadImage = async () => {

        try {
            const url = "https://nela-app.s3.us-east-1.amazonaws.com/task-attachments/1762590884348-driving.jpg";
            const response = await fetch(url);

            if (!response.ok) throw new Error("Failed to fetch image");

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            // Create a temporary link and trigger download
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = "driving.jpg"; // desired filename
            document.body.appendChild(a);
            a.click();

            // Cleanup
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed:", error);
            alert("Failed to download image");
        } finally {

        }
    };
    const isDirectVideoFile = (url: string): boolean => {
        console.log("urlsdsdfsdfsdfsd", url)
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();

            // List of video extensions
            const videoExtensions = [
                '.mp4', '.webm', '.ogg', '.mov', '.avi',
                '.mkv', '.flv', '.wmv', '.m4v', '.3gp', '.ogv'
            ];

            // Check if pathname ends with a video extension
            if (videoExtensions.some(ext => pathname.endsWith(ext))) {
                return true;
            }

            // Optional: also check Content-Type header if you can (via HEAD request), but not possible in browser easily

            // Explicitly block known embed platforms
            const hostname = urlObj.hostname.toLowerCase();
            const embedDomains = [
                'youtube.com', 'youtu.be', 'www.youtube.com',
                'vimeo.com', 'player.vimeo.com',
                'dailymotion.com', 'www.dailymotion.com',
                'twitch.tv', 'player.twitch.tv',
                'rumble.com', 'odysee.com'
            ];

            if (embedDomains.some(domain => hostname.includes(domain))) {
                return false;
            }

            // If it's marked as video and not an embed domain → assume direct video
            return true;

        } catch (e) {
            // Invalid URL → fallback to iframe (safer)
            return false;
        }
    };
    // const handleDownload = async (url: string) => {

    //     try {
    //         const response = await fetch(``);
    //         if (!response.ok) throw new Error('Network error');

    //         const blob = await response.blob();
    //         const url = URL.createObjectURL(blob);
    //         const a = document.createElement('a');
    //         a.href = url;
    //         a.download = url;
    //         a.click();
    //         URL.revokeObjectURL(url);
    //     } catch (err) {
    //         alert('Download failed – likely CORS issue. Use server proxy.');
    //     }
    // };
    const handleDownload = async (url: string, filename: string) => {
        const token = localStorage.getItem("garage_tok")
        try {
            const response = await fetch(`https://uatapi.garage.app/api/s3upload/download-url?url=${url}`, {
                method: "GET",

            });

            if (!response.ok) throw new Error("Download failed");

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename; // This triggers download with the desired filename
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(blobUrl); // Clean up
            toast("SucessFully downloaded.");
        } catch (error) {
            console.error("Download failed:", error);
            toast("Failed to download file. Please try again.");
        }
    };

    const handleCopy = async () => {
        const shareUrl = `https://taskrooms.garage.app/all-taskrooms/${roomId}?card=${copieId}`

        try {
            // 1. Try Modern Clipboard API
            await navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            toast("Copied Link")
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            // 2. Fallback for non-secure contexts or incompatible browsers
            try {
                const textarea = document.createElement('textarea')
                textarea.value = shareUrl

                // Ensure element is part of DOM but hidden
                textarea.style.position = 'fixed'
                textarea.style.left = '-9999px'
                textarea.style.top = '0'
                textarea.setAttribute('readonly', '')

                document.body.appendChild(textarea)
                textarea.focus()
                textarea.select()

                const successful = document.execCommand('copy')
                document.body.removeChild(textarea)

                if (successful) {
                    setCopied(true)
                    toast("Copied Link")
                    setTimeout(() => setCopied(false), 2000)
                } else {
                    throw new Error("Fallback copy failed")
                }
            } catch (fallbackErr) {
                console.error('Copy failed:', fallbackErr)
                toast.error("Failed to copy link manually. Please select and copy: " + shareUrl)
            }
        }
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[100vw] w-full h-[100vh] p-0 sm:max-w-[100vw] md:max-w-[100vw] lg:max-w-[100vw] xl:max-w-[100vw] p-0 overflow-hidden h-[100vh]" style={{ border: 'none', borderRadius: 0, padding: 0, margin: 0, maxHeight: 'none' }}>
                <div className="block md:flex  overflow-scroll md:overflow-hidden  h-screen bg-background">
                    {/* Header */}

                    <DialogHeader className=" block">
                        <div className="fixed top-0 left-0 right-0 bg-background border-b border-[#e5e7eb29] h-16 flex items-center justify-between px-6 z-10">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" size="icon" onClick={onCancel}>
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <DialogTitle className="text-xl font-semibold">Task Details</DialogTitle>
                                    <p className="text-sm text-muted-foreground">Edit task details and manage properties</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button className="border-[#e5e7eb29] border bg-[#0e0e12] text-white" onClick={handleCopy}>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Share
                                </Button>
                                <Button onClick={handleSaveWrapper} disabled={isSaving} className="border-[#e5e7eb29] border text-white bg-[#0e0e12]">
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                                <Button onClick={() => setShowDeleteConfirm(true)} disabled={isDeleting} className="border-[#e5e7eb29] text-white border bg-[#0e0e12]">
                                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>
                    {/* Left Panel */}
                    <div className="w-full md:w-1/2 border-r border-[#e5e7eb29] overflow-y-auto mt-16">
                        <div className="p-6 space-y-6">
                            {/* Title & Description */}
                            <div className="space-y-3">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title"

                                    className="focus-visible:ring-0 border-[#e5e7eb29] focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:outline-none"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Describe the task"
                                    className="min-h-28 focus-visible:ring-0  border-[#e5e7eb29] focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:outline-none"

                                    onPaste={handlePaste}
                                />
                            </div>
                            {/* Assignee */}
                            <div className="space-y-3">
                                <Label>Assignees</Label>


                                <div className="relative" ref={personDropdownRef}>
                                    <button
                                        onClick={() => setIsPersonDropdownOpen(!isPersonDropdownOpen)}
                                        className="flex items-center justify-between w-full px-4 py-2 border  border-[#e5e7eb29] rounded-lg  transition"
                                    >
                                        {assigneeId ? (
                                            <div className="flex items-center gap-3 text-sm">
                                                <div className="w-5 h-5 text-sm rounded-full text-sm bg-gray-500 text-white flex items-center justify-center text-sm font-medium">
                                                    {getEmployeeName(assigneeId)?.[0]}
                                                </div>
                                                <span>{getEmployeeName(assigneeId)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 text-sm">Choose a Assignees</span>
                                        )}
                                        <ChevronDown className={`h-4 w-4 transition-transform ${isPersonDropdownOpen ? "rotate-180" : ""}`} />
                                    </button>

                                    {isPersonDropdownOpen && (
                                        <div className="absolute top-full mt-2 w-full bg-[#0e0e12] border border-[#e5e7eb29] rounded-lg shadow-xl z-50">
                                            <div className="p-3 border-b border-[#e5e7eb29]">
                                                <div className="flex items-center gap-2">
                                                    <Search className="h-4 w-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search..."
                                                        value={personFilter}
                                                        onChange={e => setPersonFilter(e.target.value)}
                                                        className="w-full text-sm outline-none text-sm"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>

                                            <div className="max-h-64 overflow-y-auto">
                                                {filteredEmployees.map(person => (
                                                    <button
                                                        key={person.id}
                                                        onClick={() => {
                                                            setAssigneeId(person.id);
                                                            setIsPersonDropdownOpen(false);
                                                            setPersonFilter("");
                                                        }}
                                                        className="w-full px-4 text-sm py-2.5 hover:bg-card flex items-center gap-3 text-left"
                                                    >
                                                        <div className="w-7 h-7 text-sm  rounded-full bg-gray-500 text-white flex items-center justify-center text-sm font-medium">
                                                            {person.name[0]}
                                                        </div>
                                                        {person.name}
                                                    </button>
                                                ))}
                                                {filteredEmployees.length === 0 && (
                                                    <div className="px-4 py-3 text-sm text-gray-500">Nobody found</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* <Select value={assigneeId} onValueChange={setAssigneeId}>
                                    <SelectTrigger
                                        className="focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none data-[state=open]:ring-0 data-[state=open]:ring-blue-500"
                                    >
                                        <SelectValue placeholder="Select assignee">
                                            {assigneeId && (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white" style={{ backgroundColor: "#6b7280" }}>
                                                        {getEmployeeName(assigneeId)?.[0]}
                                                    </div>
                                                    {getEmployeeName(assigneeId)}
                                                </div>
                                            )}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="flex items-center px-3 pb-2">
                                            <Search className="mr-2 h-4 w-4 opacity-50" />
                                            <Input placeholder="Search..." value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)}
                                                className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                                            />
                                        </div>
                                        {filteredEmployees?.map(emp => (
                                            <SelectItem key={emp.id} value={emp.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#6b7280" }} />
                                                    {emp.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select> */}
                            </div>
                            {/* Status & Priority */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <Label>Status</Label>
                                    <Select value={stageId} onValueChange={setStageId}>
                                        <SelectTrigger className="focus:ring-0 focus-visible:ring-0 border-[#e5e7eb29] focus-visible:ring-offset-0 focus:outline-none data-[state=open]:ring-0 data-[state=open]:ring-blue-500">
                                            <SelectValue placeholder="Select status">
                                                {stageId && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: columns.find(s => s._id === stageId)?.color }} />
                                                        {columns.find(s => s._id === stageId)?.name}
                                                    </div>
                                                )}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <div className="flex items-center px-3 pb-2">
                                                <Search className="mr-2 h-4 w-4 opacity-50" />
                                                <Input placeholder="Search stages..." value={stageSearch} onChange={e => setStageSearch(e.target.value)}

                                                    className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                                                />
                                            </div>
                                            {filteredStages.map(stage => (
                                                <SelectItem key={stage._id} value={stage._id}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                                        {stage.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-3">
                                    <Label>Priority</Label>
                                    <Select value={priority} onValueChange={v => setPriority(v as any)}>
                                        <SelectTrigger
                                            className="focus:ring-0 border-[#e5e7eb29] focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none data-[state=open]:ring-0 data-[state=open]:ring-blue-500"
                                        >
                                            <SelectValue>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${priority === "high" ? "bg-red-500" : priority === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
                                                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                                                </div>
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["low", "medium", "high"].map(p => (
                                                <SelectItem key={p} value={p}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${p === "high" ? "bg-red-500" : p === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
                                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {/* Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                                        <PopoverTrigger asChild className="focus:ring-0  border-[#e5e7eb29] focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none data-[state=open]:ring-0 data-[state=open]:ring-blue-500">
                                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {startDate ? formatInLocalTime(startDate) : 'DD-MM-YYYY'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar


                                                mode="single" selected={startDate} onSelect={handleStartDateSelect} disabled={date => date < todayNY} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Popover open={isDueDatePopoverOpen} onOpenChange={setIsDueDatePopoverOpen}>
                                        <PopoverTrigger asChild className="focus:ring-0 border-[#e5e7eb29] focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none data-[state=open]:ring-0 data-[state=open]:ring-blue-500">
                                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dueDate ? formatInLocalTime(dueDate) : 'DD-MM-YYYY'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={dueDate} onSelect={handleDueDateSelect} disabled={date => date < todayNY || (startDate ? date < startDate : false)} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            {/* Tags */}
                            <div className="space-y-2">
                                <Label>Tags</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {tags.map(tag => (
                                        <div key={tag} className="flex px-2 items-center gap-1 relative border-[#e5e7eb29] border">
                                            {tag}
                                            <X className="h-3 w-3 cursor-pointer ml-2" onClick={() => removeTag(tag)} />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Input placeholder="Add tag..."
                                        className="focus-visible:ring-0 border-[#e5e7eb29] focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:outline-none"

                                        value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={handleKeyPress} />
                                    <Button variant="outline" size="icon" onClick={addTag} className="border-[#e5e7eb29] border "><Plus className="h-4 w-4" /></Button>
                                </div>
                            </div>

                            <div className="" style={{ marginBottom: "4rem" }}>

                                <SubtasksPanel
                                    taskId={task?._id || ""}
                                    roomId={roomId}
                                    userId={userId}
                                    stageId={task?.stageId || ""}
                                    employees={employees}
                                    open={open}
                                    subtasks={subtasks}
                                    setSubtasks={setSubtasks}
                                    code={code}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div className="w-full md:w-1/2 flex flex-col mt-16">
                        <div className=" border-b border-[#e5e7eb29] px-6 py-4 space-y-4">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        <CalendarDays size={14} className="text-gray-500" />
                                        Created
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">{taskDeatails?.createdAt ? new Date(taskDeatails.createdAt).toLocaleDateString() : "-"}</p>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        <Clock size={14} className="text-gray-500" />
                                        Updated
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">{updateDate ? formatDistanceToNow(new Date(updateDate), { addSuffix: true }) : "-"}</p>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        <User size={14} className="text-gray-500" />
                                        Created By
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground">{taskDeatails?.userId && getEmployeeName(taskDeatails.userId)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full h-full pt-2 flex flex-col">
                            {/* <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 border-none shadow-none rounded-none overflow-visible">
                                <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-gray-500 data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3 text-sm font-medium transition-all hover:text-gray-700">
                                    Files/Attachments
                                </TabsTrigger>
                                <TabsTrigger value="comments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-gray-500 data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3 text-sm font-medium transition-all hover:text-gray-700">
                                    Comments
                                </TabsTrigger>
                                <TabsTrigger value="subtasks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-gray-500 data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3 text-sm font-medium transition-all hover:text-gray-700">
                                    Subtasks
                                </TabsTrigger>
                            </TabsList> */}
                            <div className="flex-1 overflow-y-auto p-6" style={{ marginBottom: "5rem" }}>
                                {/* Files Tab */}
                                <div className="mt-0  border border-[#e5e7eb29] rounded-lg">
                                    <div className=" p-6 space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <Label>Attachments & Video Links (Optional)</Label>
                                            <Button
                                                onClick={handleSubmitFiles}
                                                disabled={isSavingfile || newAttachments.length === 0}
                                                className="border-[#e5e7eb29] bg-[#0e0e12] border text-xs text-white"
                                            >
                                                {isSavingfile ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    `Save Files (${newAttachments.length})`
                                                )}
                                            </Button>
                                        </div>
                                        {/* Paste Zone */}
                                        <div className="p-3  border border-[#e5e7eb29] rounded-lg">
                                            <p className="text-xs font-medium mb-2">Quick Paste Zone:</p>
                                            <input
                                                ref={pasteInputRef}
                                                type="text"
                                                placeholder="Click and paste (Ctrl+V)"
                                                className=" w-full px-3 py-2 border rounded text-sm text-white border-[#e5e7eb29] focus-visible:ring-0 focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:outline-none"

                                                onPaste={handlePaste}
                                            />
                                        </div>
                                        {/* Drop Zone */}
                                        <div
                                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragActive ? "border-gray-500 bg-gray-50" : "border-gray-300"}`}
                                            onDragEnter={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDragOver={handleDrag}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.mp4" onChange={e => e.target.files && processFiles(e.target.files)} className="hidden" />
                                            {isUploading ? <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" /> : <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />}
                                            <p className="text-sm font-medium">Drop files or click</p>
                                            <p className="text-xs text-gray-500">Images, PDF, DOC, TXT,Video</p>
                                        </div>
                                        {/* Video Link */}
                                        <div className="flex gap-2">
                                            <Input
                                                className="focus-visible:ring-0 focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:outline-none"
                                                placeholder="Paste video URL..." value={newVideoLink} onChange={e => setNewVideoLink(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addVideoLink())} />
                                            <Button variant="outline" size="icon" onClick={addVideoLink}><Plus className="h-4 w-4" /></Button>
                                        </div>
                                        {/* Attachment List */}
                                        {isInitialLoad && uizue ? (
                                            <>
                                                <AttachmentSkeleton />
                                                <AttachmentSkeleton />
                                                <AttachmentSkeleton />
                                            </>
                                        ) : allAttachments.length > 0 ? (
                                            <div className="space-y-2">

                                                {allAttachments.map((att, idx) => {
                                                    const isLast = idx === allAttachments.length - 1
                                                    return (
                                                        <div
                                                            key={att.fileLink}
                                                            ref={isLast ? lastElementRef : null}
                                                            className="flex items-center justify-between border-[#e5e7eb29] p-3 rounded-lg border  cursor-pointer group"
                                                            onClick={() => openPreview(att)}
                                                        >
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                {att.fileType === "image" ? (
                                                                    <img src={att.fileLink} alt={att.fileName} className="w-10 h-10 object-contain" />
                                                                ) : att.fileType === "video" ? (
                                                                    <Play className="h-5 w-5 text-purple-500" />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded flex items-center justify-center border">
                                                                        {getFileIcon(att.fileType, att.fileName)}
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium truncate">{att.fileName}</p>
                                                                    <p className="text-xs text-gray-500">{att.fileType}</p>
                                                                </div>
                                                            </div>
                                                            {newAttachments.some(a => a.fileLink === att.fileLink) && (
                                                                <button
                                                                    onClick={e => {
                                                                        e.stopPropagation()
                                                                        removeNewAttachment(att.fileLink)
                                                                    }}
                                                                    className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                                {uizue && !isInitialLoad && (
                                                    <div className="flex justify-center py-3">
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No attachments yet.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-0 ">
                                    <CommentsPanel
                                        roomId={roomId}
                                        taskId={task?._id}
                                        userId={userId}
                                        open={open}
                                        employees={employees}
                                        currentUser={{
                                            id: assigneeId || "user-1",
                                            name: employees.find(e => e.id === assigneeId)?.name || "User",
                                        }}
                                    />
                                </div>


                                {/* Comments Tab */}
                                {/* <TabsContent value="comments" className="mt-0 p-6">
                                  

                                </TabsContent> */}

                                {/* Subtasks Tab */}
                                {/* <TabsContent value="subtasks" className="mt-0 p-6">
                                    <SubtasksPanel
                                        taskId={task?._id || ""}
                                        roomId={roomId}
                                        userId={userId}
                                        stageId={task?.stageId || ""}
                                        employees={employees}
                                        open={open && activeTab === "subtasks"}
                                        subtasks={subtasks}
                                        setSubtasks={setSubtasks}
                                    />
                                </TabsContent> */}
                            </div>
                        </Tabs>
                    </div>
                </div>

                {/* Delete Confirm */}
                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Delete Task?</DialogTitle></DialogHeader>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Preview Modal */}
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
                        <DialogHeader className="px-6 pt-6 pb-4 border-b flex items-center justify-between">
                            <DialogTitle className="truncate max-w-md">
                                {previewItem?.name}
                            </DialogTitle>
                            {previewItem && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDownload(previewItem.url, previewItem.name)}
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            )}
                        </DialogHeader>

                        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
                            {/* Image Preview */}
                            {previewItem?.type === "image" && (
                                <img
                                    src={previewItem.url}
                                    alt={previewItem.name}
                                    className="max-w-full max-h-full object-contain mx-auto"
                                />
                            )}

                            {
                                previewItem?.type === "video" && (
                                    isDirectVideoFile(previewItem.url) ?
                                        <video src={previewItem.url} controls />
                                        :
                                        <iframe
                                            src={previewItem.url}
                                            className="w-full h-full min-h-[80vh] border-0"
                                            title="PDF Preview"
                                        />

                                )}

                            {/* Direct Video Files (MP4, WebM, etc.) */}


                            {/* Audio Files */}


                            {/* PDF Preview */}
                            {previewItem?.type === "pdf" && (
                                <iframe
                                    src={previewItem.url}
                                    className="w-full h-full min-h-[80vh] border-0"
                                    title="PDF Preview"
                                />
                            )}

                            {/* Document Preview (Google Docs, etc.) */}
                            {previewItem?.type === "doc" && (
                                <iframe
                                    src={previewItem.url}
                                    className="w-full h-full min-h-[80vh] border-0"
                                    title="Document Preview"
                                />
                            )}

                            {/* Fallback for Other File Types */}
                            {previewItem?.type === "other" && (

                                isDirectVideoFile(previewItem.url) ?
                                    <video src={previewItem.url} controls
                                        className="w-full h-[300px] object-contain bg-black rounded-lg"
                                        preload="metadata"
                                        playsInline /> :



                                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                                        <File className="h-16 w-16 text-gray-400" />
                                        <p className="text-lg font-medium">Preview not available</p>
                                        <Button onClick={() => handleDownload(previewItem.url, previewItem.name)}>
                                            <Download className="mr-2 h-4 w-4" /> Download
                                        </Button>
                                    </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    )
}

// Skeleton
const AttachmentSkeleton = () => (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border animate-pulse">
        <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="flex-1 min-w-0">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
        </div>
    </div>
)