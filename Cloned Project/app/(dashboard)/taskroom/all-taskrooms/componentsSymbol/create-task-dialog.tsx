"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    CalendarIcon,
    Plus,
    X,
    User,
    Search,
    Loader2,
    Upload,
    Trash2,
    Play,
    FileText,
    File,
    Download,
} from "lucide-react"
import { format } from "date-fns"
import type { Column, Task, Employee, Member } from "../types/kanban"
import { toast } from "sonner"
import Cookies from "js-cookie"

interface Attachment {
    fileLink: string
    fileName: string
    fileType: "document" | "image" | "video"
    comment: string
}

interface CreateTaskDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    userId: string
    onCreateTask: (task: Omit<Task, "id">) => void
    taskRoomId: string
    columns: Column[]
    employees: Employee[]
    isLoadingEmployees: boolean
    conversationId: string | undefined
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>
    members: Member[]
    initialStageId?: string
}

const baseurl = "https://uatapi.garage.app/taskroom"
const API_URL = "https://uatapi.garage.app"
const today = new Date()
today.setHours(0, 0, 0, 0)
const todayNY = new Date(today)

const getUTCStartOfDay = (d: Date) => {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

const getUTCEndOfDay = (d: Date) => {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999))
}

const resetForm = (
    setTitle: React.Dispatch<React.SetStateAction<string>>,
    setDescription: React.Dispatch<React.SetStateAction<string>>,
    setAssigneeId: React.Dispatch<React.SetStateAction<string>>,
    setDueDate: React.Dispatch<React.SetStateAction<Date | undefined>>,
    setStageId: React.Dispatch<React.SetStateAction<string>>,
    setTags: React.Dispatch<React.SetStateAction<string[]>>,
    setNewTag: React.Dispatch<React.SetStateAction<string>>,
    setstartDate: React.Dispatch<React.SetStateAction<Date | undefined>>,
    setPriority: React.Dispatch<React.SetStateAction<"low" | "medium" | "high">>,
    setAssigneeSearch: React.Dispatch<React.SetStateAction<string>>,
    setStageSearch: React.Dispatch<React.SetStateAction<string>>,
    setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>,
    setNewVideoLink: React.Dispatch<React.SetStateAction<string>>,
) => {
    setTitle("")
    setDescription("")
    setAssigneeId("")
    setDueDate(undefined)
    setStageId("")
    setTags([])
    setNewTag("")
    setstartDate(todayNY)
    setPriority("medium")
    setAssigneeSearch("")
    setStageSearch("")
    setAttachments([])
    setNewVideoLink("")
}


export function CreateTaskDialog({
    open,
    onOpenChange,
    taskRoomId,
    userId,
    conversationId,
    onCreateTask,
    columns,
    employees,
    isLoadingEmployees,
    setMembers,
    members,
    initialStageId
}: CreateTaskDialogProps) {
    /* ────────────────────── STATE ────────────────────── */
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [assigneeId, setAssigneeId] = useState<string>("")
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
    const [stageId, setStageId] = useState<string>("")
    const [tags, setTags] = useState<string[]>([])
    const [newTag, setNewTag] = useState("")
    const [startDate, setstartDate] = useState<Date | undefined>(todayNY)
    const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false)
    const [isDueDatePopoverOpen, setIsDueDatePopoverOpen] = useState(false)
    const [priority, setPriority] = useState<"low" | "medium" | "high">("medium")
    const [assigneeSearch, setAssigneeSearch] = useState("")
    const [stageSearch, setStageSearch] = useState("")
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [newVideoLink, setNewVideoLink] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const [isCreatingTask, setIsCreatingTask] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const pasteInputRef = useRef<HTMLInputElement>(null)
    const [dragActive, setDragActive] = useState(false)

    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewItem, setPreviewItem] = useState<{
        type: "image" | "video" | "pdf" | "doc" | "other"
        url: string
        name: string
    } | null>(null)
    console.log("startDate222", startDate)
    /* ────────────────────── EFFECTS ────────────────────── */
    // Reset when dialog opens
    useEffect(() => {
        if (open) {
            resetForm(
                setTitle,
                setDescription,
                setAssigneeId,
                setDueDate,
                setStageId,
                setTags,
                setNewTag,
                setstartDate,
                setPriority,
                setAssigneeSearch,
                setStageSearch,
                setAttachments,
                setNewVideoLink,
            )
            if (initialStageId) {
                setStageId(initialStageId)
            } else if (columns.length > 0) {
                setStageId(columns[0]._id)
            }
        }
    }, [open, columns, initialStageId])

    /* ────────────────────── HELPERS ────────────────────── */
    const filteredEmployees = employees?.filter((e) =>
        e?.name?.toLowerCase()?.includes(assigneeSearch?.toLowerCase()),
    )
    const getEmployeeName = (id: string) => {
        const emp = employees.find((e) => e.id === id)
        return emp ? emp?.name : "Unassigned"
    }
    const filteredStages = columns.filter((s) =>
        s?.name?.toLowerCase().includes(stageSearch.toLowerCase()),
    )

    const formatInLocalTime = (d?: Date) => (d ? format(d, "dd-MM-yyyy") : "DD-MM-YYYY")


    const getFileIcon = (type: "document" | "image" | "video", name: string) => {
        if (type === "image") return <FileText className="h-5 w-5 text-gray-500" />
        if (type === "video") return <Play className="h-5 w-5 text-purple-500" />
        return <FileText className="h-5 w-5 text-gray-700" />
    }

    // ───── NORMALIZE MIME TO document | image | video ─────
    const normalizeFileType = (mime: string, fileName: string): "document" | "image" | "video" => {
        if (mime.startsWith("image/")) return "image"
        if (mime === "video/link") return "video"
        // All others → document
        return "document"
    }

    /* ────────────────────── S3 UPLOAD ────────────────────── */
    const uploadFilesToS3 = async (files: File[]): Promise<Attachment[]> => {
        if (!files.length) return []

        const token = localStorage.getItem("garage_tok")
        const formData = new FormData()
        files.forEach((f) => formData.append("files", f))
        formData.append("folder", "task-attachments")

        const res = await fetch(`${API_URL}/api/s3upload/multiple`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        })

        if (!res.ok) {
            const txt = await res.text()
            throw new Error(`S3 upload failed: ${res.status} – ${txt}`)
        }

        const json = await res.json()
        if (!json.success || !Array.isArray(json.data)) {
            throw new Error("Invalid S3 response")
        }

        return json.data.map((r: { url: string; fileName: string }, i: number) => {
            const f = files[i]
            const normalizedType = normalizeFileType(f.type || "", r.fileName)
            return {
                fileLink: r.url,
                fileName: r.fileName,
                fileType: normalizedType,
                comment: "Uploaded via FilesView",
            }
        })
    }

    const processFiles = async (fileList: FileList | File[]) => {
        if (isUploading || !fileList.length) return
        setIsUploading(true)
        const files = Array.from(fileList)
        try {
            const uploaded = await uploadFilesToS3(files)
            setAttachments((prev) => [...prev, ...uploaded])
            toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`)
        } catch (e) {
            console.error(e)
            toast.error("Upload failed")
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    /* ────────────────────── DRAG / PASTE ────────────────────── */
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

    /* ────────────────────── UI HELPERS ────────────────────── */
    const addVideoLink = () => {
        if (newVideoLink.trim()) {
            const url = newVideoLink.trim()
            if (attachments.some(a => a.fileLink === url)) return

            let fileName = "Video Link"
            try {
                fileName = new URL(url).pathname.split("/").pop() || "Video Link"
            } catch { }

            setAttachments((prev) => [
                ...prev,
                {
                    fileLink: url,
                    fileName,
                    fileType: "video",
                    comment: "Uploaded via FilesView",
                },
            ])
            setNewVideoLink("")
        }
    }

    const removeAttachment = (fileLink: string) => {
        setAttachments((p) => p.filter((a) => a.fileLink !== fileLink))
    }

    const addTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags((p) => [...p, newTag.trim()])
            setNewTag("")
        }
    }

    const removeTag = (t: string) => setTags((p) => p.filter((x) => x !== t))

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            addTag()
        }
    }

    const handleVideoLinkKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            addVideoLink()
        }
    }

    const handleStartDateSelect = (d: Date | undefined) => {
        console.log("azxczxczxc", d?.getTime())
        setstartDate(d)
        if (d && dueDate && d > dueDate) {
            toast("Due date cannot be earlier than start date")
            setDueDate(undefined)
        }
        setIsStartDatePopoverOpen(false)
    }
    function setEndOfDay(date: Date): Date {
        if (!date) return date;
        const endOfDay = new Date(date.getTime());
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay;
    }


    const handleDueDateSelect = (d: Date | undefined) => {

        if (d && startDate && d < startDate) {
            toast("Due date cannot be earlier than start date")
            return
        }

        const sourceDate = d ?? new Date(); // use today if d is null/undefined
        const endOfDay = new Date(sourceDate);
        endOfDay.setHours(23, 59, 59, 999);;
        setDueDate(endOfDay)
        setIsDueDatePopoverOpen(false)
    }
    console.log("1111111111111azxczxcz3123123123123xc", dueDate)
    /* ────────────────────── PREVIEW LOGIC ────────────────────── */
    const googleViewerUrl = (fileUrl: string) =>
        `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`

    const handlePreview = (att: Attachment) => {
        const { fileLink, fileName, fileType } = att

        if (fileType === "image") {
            setPreviewItem({ type: "image", url: fileLink, name: fileName })
        } else if (fileType === "video") {
            setPreviewItem({ type: "video", url: fileLink, name: fileName })
        } else if (fileType === "document") {
            const ext = fileName.split(".").pop()?.toLowerCase()
            if (ext === "pdf") {
                setPreviewItem({ type: "pdf", url: fileLink, name: fileName })
            } else if (["doc", "docx"].includes(ext || "")) {
                setPreviewItem({ type: "doc", url: googleViewerUrl(fileLink), name: fileName })
            } else {
                setPreviewItem({ type: "other", url: fileLink, name: fileName })
            }
        }

        setPreviewOpen(true)
    }

    /* ────────────────────── SUBMIT ────────────────────── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!title.trim()) return toast("Title is required")
        if (!startDate) return toast("Start date is required")
        if (!dueDate) return toast("Due date is required")
        if (dueDate < startDate) return toast("Due date cannot be earlier than start date")
        if (!stageId) return toast("Stage is required")
        if (!taskRoomId) return toast("Room ID is required")
        console.log("1221312312312312312", getUTCStartOfDay(startDate).toISOString())

        setIsCreatingTask(true)

        try {
            const token = localStorage.getItem("garage_tok")
            const tokenRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!tokenRes.ok) {
                toast("Invalid or expired token. Please log in again.")
                throw new Error("Token verification failed")
            }

            const payload = {
                title: title.trim(),
                description: description.trim(),
                roomId: taskRoomId,
                stageId,
                userId,
                priority,
                assignedToId: assigneeId,
                startDate: startDate ? startDate?.getTime() : new Date().toISOString(),
                dueDate: dueDate ? dueDate?.getTime() : new Date().toISOString(),
                tags,
                attachments,
            }

            const response = await fetch(`${baseurl}/v1/tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            })

            const data = await response.json()
            console.log("cvxcvxc1czczczczxcvxcv", data)
            if (data.status) {
                onCreateTask({
                    _id: data?.data?._id,
                    title: payload.title,
                    description: payload.description,
                    assignedToId: payload.assignedToId,
                    dueDate: payload.dueDate,
                    startDate: payload.startDate,
                    createdAt: data?.data?.createdAt,
                    priority: payload.priority,
                    roomId: payload.roomId,
                    stageId: payload.stageId,
                    tags: payload.tags,
                    userId,
                    attachments: payload.attachments,
                })

                toast("Task Created Successfully")
                // setMembers([...members, {
                //     _id: data?.data?._id,
                //     role: "assigned",
                //     roomId: payload.roomId,
                //     userId: payload.assignedToId,
                // }]);
                // if (assigneeId !== "") {
                //     if (assigneeId !== userId) 
                //         await addMembersToTaskroomChat(assigneeId)
                // }


                resetForm(
                    setTitle,
                    setDescription,
                    setAssigneeId,
                    setDueDate,
                    setStageId,
                    setTags,
                    setNewTag,
                    setstartDate,
                    setPriority,
                    setAssigneeSearch,
                    setStageSearch,
                    setAttachments,
                    setNewVideoLink,
                )
                onOpenChange(false)
            } else {
                toast(data?.message || "Failed to create task")
            }
        } catch (err) {
            console.error(err)
            toast("Invalid or expired token. Please log in again.")
        } finally {
            setIsCreatingTask(false)
        }
    }

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

            if (!res.ok) {
                throw new Error("Failed to add member to chat")
            }

            return await res.json()
        } catch (e) {
            // Show SPECIFIC error — this will be the ONLY toast if chat fails
            toast("Error while adding member to chat")
            console.error("Failed to add member to task chat:", e)
            // Do NOT rethrow — prevents outer catch
        }
    }
    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-[80vw] h-full max-w-full max-h-[90vh] p-0 rounded-none flex flex-col bg-[#0e0e12] border-[#e5e7eb29]">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e5e7eb29] flex-shrink-0">
                        <DialogTitle className="text-white">Create New Task</DialogTitle>
                        <DialogDescription className="text-sm text-gray-400">
                            Create a new task with all the necessary details and assign it to team members.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6">
                        <div className="space-y-6">
                            {/* Title */}
                            <div className="space-y-2">
                                <Label htmlFor="title" className="text-gray-300">Task Title</Label>
                                <Input
                                    id="title"
                                    placeholder="Enter task title..."
                                    className="bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500 focus-visible:ring-offset-0 focus-visible:ring-gray-600"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-gray-300">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Describe the task..."
                                    className="bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500 focus-visible:ring-offset-0 focus-visible:ring-gray-600"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    onPaste={handlePaste}
                                />
                            </div>

                            {/* Assignee / Dates */}
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-300">Assignee</Label>
                                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                                        <SelectTrigger className="bg-[#1e1e2d] w-full  border-[#e5e7eb29] text-white">
                                            <SelectValue placeholder={isLoadingEmployees ? "Loading..." : "Select assignee"}>
                                                {assigneeId && (
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        {getEmployeeName(assigneeId)}
                                                    </div>
                                                )}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px] bg-[#0e0e12] border-[#e5e7eb29] text-white">
                                            <div className="sticky top-0 z-10 bg-[#0e0e12] px-3 pb-2 border-b border-[#e5e7eb29]">
                                                <div className="flex items-center">
                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                    <Input
                                                        placeholder="Search employees..."
                                                        value={assigneeSearch}
                                                        onChange={(e) => setAssigneeSearch(e.target.value)}
                                                        className="h-8 w-full border-0 p-0 bg-transparent text-white placeholder:text-gray-500 focus-visible:ring-0"
                                                        onKeyDown={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            {isLoadingEmployees ? (
                                                <div className="flex justify-center py-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                </div>
                                            ) : (
                                                filteredEmployees?.map((emp) => (
                                                    <SelectItem key={emp.id} value={emp.id}>
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-4 h-4 rounded-full flex items-center justify-center text-xs text-white"
                                                                style={{ backgroundColor: emp.color || "#6b7280" }}
                                                            >
                                                                {emp.avatar || emp.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <span className="text-white">{emp.name}</span>
                                                                <span className="block text-xs text-gray-500">{emp.email}</span>
                                                            </div>
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>


                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-300">Start Date</Label>
                                    <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start text-left font-normal bg-[#1e1e2d] border-[#e5e7eb29] text-white hover:bg-[#1e1e2d]/80 transition-colors">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {startDate ? formatInLocalTime(startDate) : "DD-MM-YYYY"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-[#0e0e12] border-[#e5e7eb29]">
                                            <Calendar mode="single" selected={startDate} onSelect={handleStartDateSelect} disabled={(d) => d < todayNY} />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-gray-300">End Date</Label>
                                    <Popover open={isDueDatePopoverOpen} onOpenChange={setIsDueDatePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start text-left font-normal bg-[#1e1e2d] border-[#e5e7eb29] text-white hover:bg-[#1e1e2d]/80 transition-colors">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dueDate ? formatInLocalTime(dueDate) : "DD-MM-YYYY"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-[#0e0e12] border-[#e5e7eb29]">
                                            <Calendar
                                                mode="single"
                                                selected={dueDate}
                                                onSelect={handleDueDateSelect}
                                                disabled={(d) => d < todayNY || (startDate ? d < startDate : false)}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>


                            </div>
                            {/* Priority & Stage */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-300">Priority</Label>
                                    <Select value={priority} onValueChange={(v: "low" | "medium" | "high") => setPriority(v)}>
                                        <SelectTrigger className="bg-[#1e1e2d] border-[#e5e7eb29] text-white">
                                            <SelectValue>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={`w-2 h-2 rounded-full ${priority === "high" ? "bg-red-500" : priority === "medium" ? "bg-yellow-500" : "bg-green-500"
                                                            }`}
                                                    />
                                                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                                                </div>
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#0e0e12] border-[#e5e7eb29] text-white">
                                            {["low", "medium", "high"].map((p) => (
                                                <SelectItem key={p} value={p} className="focus:bg-[#1e1e2d] focus:text-white">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={`w-2 h-2 rounded-full ${p === "high" ? "bg-red-500" : p === "medium" ? "bg-yellow-500" : "bg-green-500"
                                                                }`}
                                                        />
                                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-gray-300">Initial Status</Label>
                                    <Select value={stageId} onValueChange={setStageId}>
                                        <SelectTrigger className="bg-[#1e1e2d] border-[#e5e7eb29] text-white">
                                            <SelectValue placeholder="Select status">
                                                {stageId && (
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: columns.find((s) => s._id === stageId)?.color }}
                                                        />
                                                        {columns.find((s) => s._id === stageId)?.name}
                                                    </div>
                                                )}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#0e0e12] border-[#e5e7eb29] text-white">
                                            <div className="flex items-center px-3 pb-2 border-b border-[#e5e7eb29] bg-[#0e0e12]">
                                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                <Input
                                                    placeholder="Search stages..."
                                                    value={stageSearch}
                                                    onChange={(e) => setStageSearch(e.target.value)}

                                                    className="h-8 w-full border-0 p-0 bg-transparent text-white placeholder:text-gray-500 focus-visible:ring-0"
                                                />
                                            </div>
                                            {filteredStages.map((s) => (
                                                <SelectItem key={s._id} value={s._id} className="focus:bg-[#1e1e2d] focus:text-white">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                        {s.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="space-y-2">
                                <Label className="text-gray-300">Tags</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {tags.map((t) => (
                                        <Badge key={t} variant="secondary" className="flex items-center gap-1 bg-[#1e1e2d] text-white border border-[#e5e7eb29]">
                                            {t}
                                            <X className="h-3 w-3 cursor-pointer hover:text-white" onClick={() => removeTag(t)} />
                                        </Badge>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add a tag..."
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        className="bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500 focus-visible:ring-offset-0 focus-visible:ring-gray-600"
                                    />
                                    <Button type="button" variant="outline" size="icon" onClick={addTag} className="bg-[#1e1e2d] border-[#e5e7eb29] text-white hover:bg-[#1e1e2d]/80 transition-colors">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Unified Attachments & Video Links */}
                            <div className="space-y-2">
                                <Label className="text-gray-300">Attachments & Video Links</Label>

                                {/* Quick Paste Zone */}
                                <div className="mb-3 p-3 bg-[#0e0e12] border border-[#e5e7eb29] rounded-lg">
                                    <p className="text-xs font-medium text-gray-300 mb-2">Quick Paste Zone:</p>
                                    <input
                                        ref={pasteInputRef}
                                        type="text"
                                        placeholder="Click here and paste images/files (Ctrl+V)"


                                        className="w-full px-3 py-2 border border-[#e5e7eb29] rounded text-sm bg-black text-white focus:outline-none focus:ring-1 focus:ring-gray-600 placeholder:text-gray-500"
                                        onPaste={handlePaste}
                                    />
                                </div>

                                {/* Drag & Drop */}
                                <div
                                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragActive ? "border-gray-500 bg-[#0e0e12]" : "border-[#e5e7eb29] hover:border-gray-600 bg-[#0e0e12]"
                                        }`}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*,.pdf,.doc,.docx,.txt"
                                        onChange={(e) => e.target.files && processFiles(e.target.files)}
                                        className="hidden"

                                    />
                                    {isUploading ? (
                                        <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-gray-500" />
                                    ) : (
                                        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                    )}
                                    <p className="text-sm font-medium text-white">Drag and drop files here, or click to select</p>
                                    <p className="text-xs text-gray-500 mt-1">Images, PDF, DOC, DOCX, TXT</p>
                                </div>

                                {/* Add Video Link */}
                                <div className="flex gap-2 mt-3">
                                    <Input
                                        placeholder="Paste video URL..."
                                        value={newVideoLink}
                                        onChange={(e) => setNewVideoLink(e.target.value)}
                                        onKeyPress={handleVideoLinkKeyPress}
                                        className="bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500 focus-visible:ring-offset-0 focus-visible:ring-gray-600"
                                    />
                                    <Button type="button" variant="outline" onClick={addVideoLink} className="bg-[#1e1e2d] border-[#e5e7eb29] text-white hover:bg-[#1e1e2d]/80 transition-colors">
                                        Add
                                    </Button>
                                </div>

                                {/* List of All Attachments */}
                                {attachments.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-sm font-medium">Items ({attachments.length})</p>
                                        {attachments.map((att) => (
                                            <div
                                                key={att.fileLink}
                                                className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group"
                                                onClick={() => handlePreview(att)}
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
                                                        <p className="text-xs text-gray-500">
                                                            {att.fileType === "video" ? "Video Link" : att.fileType === "image" ? "Image" : "Document"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        removeAttachment(att.fileLink)
                                                    }}
                                                    className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Submit */}
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent border-[#e5e7eb29] text-white hover:bg-[#1e1e2d]">
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isCreatingTask || isUploading}
                                    className="bg-white text-black hover:bg-gray-200 font-semibold"
                                >
                                    {isCreatingTask ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                                        </>
                                    ) : (
                                        "Create Task"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ==================== PREVIEW MODAL ==================== */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden flex flex-col bg-[#0e0e12] border-[#e5e7eb29]">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e5e7eb29] flex items-center justify-between flex-shrink-0">
                        <DialogTitle className="truncate max-w-md text-white">{previewItem?.name}</DialogTitle>
                        {previewItem && ["image", "pdf", "doc", "other"].includes(previewItem.type) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(previewItem.url, "_blank")}
                                title="Download"
                                className="text-gray-400 hover:text-white"
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        )}
                    </DialogHeader>

                    <div className="flex-1 overflow-auto bg-[#0e0e12] p-6">
                        {previewItem?.type === "image" && (
                            <img src={previewItem.url} alt={previewItem.name} className="max-w-full max-h-full object-contain mx-auto" />
                        )}

                        {previewItem?.type === "video" && (
                            <iframe
                                src={previewItem.url}
                                title="Video"
                                className="w-full h-96 border-0 rounded-lg"
                                allowFullScreen
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                        )}

                        {previewItem?.type === "pdf" && (
                            <iframe
                                src={previewItem.url}
                                title="PDF Preview"
                                className="w-full h-full min-h-[80vh] border-0 rounded-lg"
                            />
                        )}

                        {previewItem?.type === "doc" && (
                            <iframe
                                src={previewItem.url}
                                title="Document Preview"
                                className="w-full h-full min-h-[80vh] border-0 rounded-lg"
                                allowFullScreen
                            />
                        )}

                        {previewItem?.type === "other" && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                <File className="h-16 w-16 text-gray-400" />
                                <p className="text-lg font-medium">Preview not available</p>
                                <p className="text-sm text-muted-foreground">
                                    This file type cannot be previewed in the browser.
                                </p>
                                <Button className="bg-white text-black hover:bg-gray-200" onClick={() => window.open(previewItem.url, "_blank")}>
                                    <Download className="mr-2 h-4 w-4" /> Download File
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}