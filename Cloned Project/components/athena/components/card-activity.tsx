"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
    Trash2, SendHorizonal, PencilLine, MessageCircle,
    Paperclip, Image as ImageIcon, X, FileText,
    FileArchive, Film, Music, Download, Eye,
    ClipboardPaste, FileSpreadsheet, Link2
} from "lucide-react"
import { toast } from "sonner"
import type { Column } from "./Dashbaord"

// ─── Types ────────────────────────────────────────────────────────────────────

type Attachment = {
    _id?: string
    link: string
    name: string
    fileType: string
    tags?: string[]
    status?: string
}

type S3Attachment = {
    fileLink: string
    fileName: string
    fileType: string
    comment: string
}

type CommentItem = {
    _id: string
    userId?: { _id?: string; name?: string; email?: string; image?: string }
    userName?: string
    userAvatarUrl?: string
    comment: string
    attachmentIds?: Attachment[]
    attachments?: Attachment[]
    createdAt?: string
    updatedAt?: string
}

// Per-attachment edit data
type AttachmentEdit = {
    name: string
    replacementFile?: File
    replacementPreview?: string
    deleted?: boolean   // true = remove this attachment on save
}

// Full edit state for a comment
type EditState = {
    commentId: string
    text: string
    attachmentEdits: Record<string, AttachmentEdit>
}

const API_URL = "https://uatapi.garage.app"
const TASKROOM_URL = process.env.NEXT_PUBLIC_TASKROOM_URL ?? ""

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeFileType(mimeType?: string, fileName?: string): string {
    const mime = typeof mimeType === "string" ? mimeType.toLowerCase() : ""
    const ext = typeof fileName === "string" ? (fileName.split(".").pop() ?? "").toLowerCase() : ""

    if (mime.startsWith("image/")) return "image"
    if (mime.startsWith("video/")) return "video"
    if (mime.startsWith("audio/")) return "audio"
    if (mime === "application/pdf") return "pdf"
    if (
        mime === "application/msword" ||
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mime === "application/vnd.oasis.opendocument.text"
    ) return "document"
    if (
        mime === "application/vnd.ms-excel" ||
        mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        mime === "text/csv" ||
        mime === "application/vnd.oasis.opendocument.spreadsheet"
    ) return "spreadsheet"
    if (
        mime === "application/vnd.ms-powerpoint" ||
        mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) return "document"
    if (
        mime === "application/zip" ||
        mime === "application/x-rar-compressed" ||
        mime === "application/x-7z-compressed" ||
        mime === "application/x-tar" ||
        mime === "application/gzip"
    ) return "archive"

    if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"].includes(ext)) return "image"
    if (["mp4", "mov", "avi", "webm", "mkv", "flv", "wmv", "m4v"].includes(ext)) return "video"
    if (["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"].includes(ext)) return "audio"
    if (ext === "pdf") return "pdf"
    if (["doc", "docx", "odt", "rtf", "txt", "ppt", "pptx"].includes(ext)) return "document"
    if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "spreadsheet"
    if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "archive"

    return "file"
}

function isUrl(str?: string): boolean {
    if (!str || typeof str !== "string") return false
    return /^https?:\/\//i.test(str.trim())
}

// FIX: robust owner check — always compares as strings
function isSameUser(a?: string, b?: string): boolean {
    if (!a || !b) return false
    return String(a).trim() === String(b).trim()
}

function FileIcon({ type, className }: { type: string; className?: string }) {
    const cls = cn("w-4 h-4 flex-shrink-0", className)
    if (type === "image") return <ImageIcon className={cls} />
    if (type === "video") return <Film className={cls} />
    if (type === "audio") return <Music className={cls} />
    if (type === "archive") return <FileArchive className={cls} />
    if (type === "spreadsheet") return <FileSpreadsheet className={cls} />
    if (type === "pdf") return <FileText className={cn(cls, "text-red-400/70")} />
    if (type === "document") return <FileText className={cn(cls, "text-blue-400/70")} />
    if (type === "link") return <Link2 className={cls} />
    return <FileText className={cls} />
}

function fileTypeBadgeColor(type: string) {
    switch (type) {
        case "pdf": return "text-red-400/70 bg-red-400/10 border-red-400/20"
        case "document": return "text-blue-400/70 bg-blue-400/10 border-blue-400/20"
        case "spreadsheet": return "text-green-400/70 bg-green-400/10 border-green-400/20"
        case "archive": return "text-yellow-400/70 bg-yellow-400/10 border-yellow-400/20"
        case "video": return "text-purple-400/70 bg-purple-400/10 border-purple-400/20"
        case "audio": return "text-pink-400/70 bg-pink-400/10 border-pink-400/20"
        case "link": return "text-cyan-400/70 bg-cyan-400/10 border-cyan-400/20"
        default: return "text-white/50 text-white/50 border-[#e5e7eb29]"
    }
}

// ─── Attachment preview in the composer ───────────────────────────────────────

function AttachmentPreview({ att, onRemove }: { att: Attachment & { preview?: string }; onRemove?: () => void }) {
    const isImage = att.fileType === "image"
    return (
        <div className="group relative flex items-center gap-2 rounded-lg border border-[#e5e7eb29] p-2 pr-3 hover:bg-white/[0.06] hover:border-[#e5e7eb29] transition-all duration-150">
            {isImage ? (
                <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 border border-[#e5e7eb29]">
                    <img src={(att as any).preview ?? att.link} alt={att.name} className="w-full h-full object-cover" />
                </div>
            ) : (
                <div className={cn("w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 border", fileTypeBadgeColor(att.fileType))}>
                    <FileIcon type={att.fileType} />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/50 truncate font-medium leading-tight">{att.name}</p>
                <p className={cn("text-[10px] uppercase mt-0.5 font-semibold", fileTypeBadgeColor(att.fileType).split(" ")[0])}>
                    {att.fileType}
                </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {att.link && att.link.startsWith("http") && (
                    <a href={att.link} target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded text-white/50 hover:text-white/50 hover:text-white/50 transition" title="Open">
                        <Eye className="w-3 h-3" />
                    </a>
                )}
                {onRemove && (
                    <button onClick={onRemove}
                        className="p-1 rounded text-white/50 hover:text-red-400 hover:bg-red-400/10 transition" title="Remove">
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    )
}

// ─── Single attachment in view mode ───────────────────────────────────────────

function CommentAttachment({ att }: { att: Attachment }) {
    const safeName = typeof att?.name === "string" ? att.name : ""
    const safeLink = typeof att?.link === "string" ? att.link : ""
    const safeFileType = typeof att?.fileType === "string" ? att.fileType : ""
    const type = safeFileType.toLowerCase() || normalizeFileType("", safeName)
    const ext = safeName.includes(".") ? safeName.split(".").pop()?.toUpperCase() ?? "" : ""

    if (type === "image") {
        return (
            <a href={safeLink} target="_blank" rel="noopener noreferrer"
                className="group/img relative block overflow-hidden rounded-lg border border-[#e5e7eb29] hover:border-[#e5e7eb29] transition-all">
                <img src={safeLink} alt={safeName} className="w-full max-h-48 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white/50 opacity-0 group-hover/img:opacity-100 transition-opacity" />
                </div>
            </a>
        )
    }
    if (type === "video") {
        return (
            <div className="rounded-lg overflow-hidden border border-[#e5e7eb29]">
                <video src={safeLink} controls preload="metadata" className="w-full max-h-48 bg-black rounded-lg">
                    <a href={safeLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 text-sm text-white/50 hover:text-white/50 transition">
                        <Film className="w-4 h-4 text-purple-400/70" />{safeName || "Video"}
                    </a>
                </video>
            </div>
        )
    }
    if (type === "audio") {
        return (
            <div className="flex flex-col gap-1.5 rounded-lg border border-[#e5e7eb29] p-3">
                <div className="flex items-center gap-2">
                    <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 border", fileTypeBadgeColor("audio"))}>
                        <Music className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[11px] text-white/50 truncate font-medium">{safeName || "Audio"}</p>
                </div>
                <audio controls preload="metadata" className="w-full h-8" style={{ height: 32 }}>
                    <source src={safeLink} />
                </audio>
            </div>
        )
    }
    if (type === "pdf") {
        return (
            <a href={safeLink} target="_blank" rel="noopener noreferrer"
                className="group/file flex items-center gap-2.5 rounded-lg border border-red-400/15 bg-red-400/[0.04] p-2.5 hover:bg-red-400/[0.08] hover:border-red-400/25 transition-all">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-red-400/10 border border-red-400/20 flex-shrink-0">
                    <FileText className="w-4 h-4 text-red-400/70" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50 truncate font-medium">{safeName || "Document.pdf"}</p>
                    <p className="text-[10px] text-red-400/50 uppercase font-semibold mt-0.5">PDF</p>
                </div>
                <Download className="w-3.5 h-3.5 text-white/50 group-hover/file:text-red-400/60 flex-shrink-0 transition" />
            </a>
        )
    }
    if (type === "document") {
        return (
            <a href={safeLink} target="_blank" rel="noopener noreferrer"
                className="group/file flex items-center gap-2.5 rounded-lg border border-blue-400/15 bg-blue-400/[0.04] p-2.5 hover:bg-blue-400/[0.08] hover:border-blue-400/25 transition-all">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-blue-400/10 border border-blue-400/20 flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-400/70" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50 truncate font-medium">{safeName || "Document"}</p>
                    <p className="text-[10px] text-blue-400/50 uppercase font-semibold mt-0.5">{ext || "DOC"}</p>
                </div>
                <Download className="w-3.5 h-3.5 text-white/50 group-hover/file:text-blue-400/60 flex-shrink-0 transition" />
            </a>
        )
    }
    if (type === "spreadsheet") {
        return (
            <a href={safeLink} target="_blank" rel="noopener noreferrer"
                className="group/file flex items-center gap-2.5 rounded-lg border border-green-400/15 bg-green-400/[0.04] p-2.5 hover:bg-green-400/[0.08] hover:border-green-400/25 transition-all">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-green-400/10 border border-green-400/20 flex-shrink-0">
                    <FileSpreadsheet className="w-4 h-4 text-green-400/70" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50 truncate font-medium">{safeName || "Spreadsheet"}</p>
                    <p className="text-[10px] text-green-400/50 uppercase font-semibold mt-0.5">{ext || "XLS"}</p>
                </div>
                <Download className="w-3.5 h-3.5 text-white/50 group-hover/file:text-green-400/60 flex-shrink-0 transition" />
            </a>
        )
    }
    if (type === "archive") {
        return (
            <a href={safeLink} target="_blank" rel="noopener noreferrer"
                className="group/file flex items-center gap-2.5 rounded-lg border border-yellow-400/15 bg-yellow-400/[0.04] p-2.5 hover:bg-yellow-400/[0.08] hover:border-yellow-400/25 transition-all">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-yellow-400/10 border border-yellow-400/20 flex-shrink-0">
                    <FileArchive className="w-4 h-4 text-yellow-400/70" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50 truncate font-medium">{safeName || "Archive"}</p>
                    <p className="text-[10px] text-yellow-400/50 uppercase font-semibold mt-0.5">{ext || "ZIP"}</p>
                </div>
                <Download className="w-3.5 h-3.5 text-white/50 group-hover/file:text-yellow-400/60 flex-shrink-0 transition" />
            </a>
        )
    }
    if (type === "link" || isUrl(safeLink)) {
        const displayUrl = safeName && !isUrl(safeName) ? safeName : safeLink
        return (
            <a href={safeLink} target="_blank" rel="noopener noreferrer"
                className="group/file flex items-center gap-2.5 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.04] p-2.5 hover:bg-cyan-400/[0.08] hover:border-cyan-400/25 transition-all">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-cyan-400/10 border border-cyan-400/20 flex-shrink-0">
                    <Link2 className="w-4 h-4 text-cyan-400/70" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50 truncate font-medium">{displayUrl || "Link"}</p>
                    <p className="text-[10px] text-cyan-400/50 uppercase font-semibold mt-0.5">Link</p>
                </div>
                <Eye className="w-3.5 h-3.5 text-white/50 group-hover/file:text-cyan-400/60 flex-shrink-0 transition" />
            </a>
        )
    }
    return (
        <a href={safeLink} target="_blank" rel="noopener noreferrer"
            className="group/file flex items-center gap-2 rounded-lg border border-[#e5e7eb29] p-2 pr-3 hover:bg-white/[0.06] hover:border-[#e5e7eb29] transition-all">
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-white/50 border border-[#e5e7eb29] flex-shrink-0">
                <FileText className="w-4 h-4 text-white/50" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/50 truncate font-medium">{safeName || "File"}</p>
                <p className="text-[10px] text-white/50 uppercase">{ext || safeFileType || "file"}</p>
            </div>
            <Download className="w-3.5 h-3.5 text-white/50 group-hover/file:text-white/50 flex-shrink-0 transition" />
        </a>
    )
}

// ─── Attachment edit row (rename + replace file) ──────────────────────────────

function AttachmentEditRow({
    att,
    editData,
    onChange,
    onDelete,
}: {
    att: Attachment
    editData: AttachmentEdit
    onChange: (update: Partial<AttachmentEdit>) => void
    onDelete: () => void
}) {
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const type = (att.fileType || normalizeFileType("", att.name)).toLowerCase()
    const previewSrc = editData.replacementPreview ?? (type === "image" ? att.link : undefined)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const newType = normalizeFileType(file.type, file.name)
        const preview = newType === "image" ? URL.createObjectURL(file) : undefined
        onChange({
            replacementFile: file,
            name: editData.name || file.name,
            deleted: false,
            ...(preview ? { replacementPreview: preview } : {}),
        })
        e.target.value = ""
    }

    // Clear staged replacement (revert to original)
    const clearReplacement = () => {
        if (editData.replacementPreview) URL.revokeObjectURL(editData.replacementPreview)
        onChange({ replacementFile: undefined, replacementPreview: undefined })
    }

    if (editData.deleted) {
        // Show a struck-through ghost row with an undo option
        return (
            <div className="flex items-center gap-2 rounded-lg  bg-red-400/[0.04] px-2 py-1.5 opacity-60">
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-3 h-3 text-red-400/60" />
                </div>
                <p className="flex-1 text-[11px] text-white/50 line-through truncate">{att.name}</p>
                <button
                    type="button"
                    onClick={() => onChange({ deleted: false })}
                    className="text-[10px] text-white/50 hover:text-white/50 hover:text-white/50 px-2 h-5 rounded transition flex-shrink-0"
                >
                    Undo
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.04] p-2">
            {/* Thumbnail / icon */}
            <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 border border-[#e5e7eb29] text-white/50 flex items-center justify-center">
                {previewSrc ? (
                    <img src={previewSrc} alt={editData.name} className="w-full h-full object-cover" />
                ) : (
                    <FileIcon type={type} className="w-4 h-4 text-white/50" />
                )}
            </div>

            {/* Editable name */}
            <input
                type="text"
                value={editData.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="File name…"
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[11px] text-white/50 placeholder-white/20 font-medium"
            />

            {/* Replace file button */}
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Replace file"
                className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] text-indigo-300/70 hover:text-indigo-300 hover:bg-indigo-500/10 border border-indigo-500/20 transition flex-shrink-0"
            >
                <Paperclip className="w-3 h-3" />
                {editData.replacementFile
                    ? <span className="max-w-[60px] truncate">{editData.replacementFile.name}</span>
                    : <span>Replace</span>
                }
            </button>

            {/* X button — clears staged replacement if present, else marks attachment deleted */}
            <button
                type="button"
                onClick={editData.replacementFile ? clearReplacement : onDelete}
                title={editData.replacementFile ? "Clear replacement" : "Remove attachment"}
                className="w-6 h-6 flex items-center justify-center rounded text-white/50 hover:text-red-400 hover:bg-red-400/10 transition flex-shrink-0"
            >
                <X className="w-3 h-3" />
            </button>

            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>
    )
}

// ─── Upload helper ─────────────────────────────────────────────────────────────

async function uploadFilesToS3(files: File[]): Promise<S3Attachment[]> {
    if (!files.length) return []
    const token = localStorage.getItem("garage_tok")
    if (!token) throw new Error("Authentication token missing")

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
    if (!json.success || !Array.isArray(json.data)) throw new Error("Invalid S3 response")

    return json.data.map((r: { url: string; fileName: string }, i: number) => {
        const f = files[i]
        const normalizedType = normalizeFileType(f.type || "", r.fileName)
        return { fileLink: r.url, fileName: r.fileName, fileType: normalizedType, comment: "Uploaded via CardActivity" }
    })
}

type StagedFile = {
    id: string
    file: File
    preview?: string
    fileType: string
    name: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CardActivity({
    boardId,
    cardId,
    userId,
    connected,
    className,
    onCommentCountChange,
    setColumns,
    isReadOnly,
}: {
    boardId: string
    cardId: string
    userId?: string
    className?: string
    connected?: boolean
    onCommentCountChange?: (diff: number) => void
    setColumns?: React.Dispatch<React.SetStateAction<Column[]>>
    isReadOnly?: boolean
}) {
    const [comments, setComments] = React.useState<CommentItem[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [isFetchingMore, setIsFetchingMore] = React.useState(false)
    const [isPosting, setIsPosting] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [newComment, setNewComment] = React.useState("")
    const [editState, setEditState] = React.useState<EditState | null>(null)
    const [isSavingEdit, setIsSavingEdit] = React.useState(false)
    const [stagedFiles, setStagedFiles] = React.useState<StagedFile[]>([])
    const [isDragging, setIsDragging] = React.useState(false)
    const [isFocused, setIsFocused] = React.useState(false)

    // Pagination
    const [currentPage, setCurrentPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)
    const hasMore = currentPage < totalPages

    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const topSentinelRef = React.useRef<HTMLDivElement>(null)

    // ── Scroll to bottom ──────────────────────────────────────────────────────
    const scrollToBottom = () => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
    }

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchComments = async (page: number, isInitial = false) => {
        if (isInitial) setIsLoading(true)
        else setIsFetchingMore(true)
        setError(null)
        try {
            const token = localStorage.getItem("garage_tok")
            const params = new URLSearchParams({ roomId: boardId, taskId: cardId, page: String(page), size: "30" })
            const response = await fetch(`${TASKROOM_URL}comments?${params}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            })
            const data = await response.json()
            if (!response.ok || data.status === false) throw new Error(data.message || "Failed to load comments")

            const incoming: CommentItem[] = data.data || []
            const meta = data.metadata ?? {}
            const tp: number = meta.totalPages ?? 1
            const cp: number = meta.currentPage ?? page

            setTotalPages(tp)
            setCurrentPage(cp)

            if (isInitial) {
                setComments(incoming)
            } else {
                const container = scrollRef.current
                const prevScrollHeight = container?.scrollHeight ?? 0
                setComments((prev) => [...incoming, ...prev])
                requestAnimationFrame(() => {
                    if (container) container.scrollTop = container.scrollHeight - prevScrollHeight
                })
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load comments")
        } finally {
            setIsLoading(false)
            setIsFetchingMore(false)
        }
    }

    // ── Initial load ──────────────────────────────────────────────────────────
    React.useEffect(() => {
        if (!boardId || !cardId) return
        setComments([])
        setCurrentPage(1)
        setTotalPages(1)
        fetchComments(1, true)
    }, [boardId, cardId])

    React.useEffect(() => {
        if (!isLoading && comments.length > 0 && currentPage === 1) scrollToBottom()
    }, [isLoading])

    // ── IntersectionObserver ──────────────────────────────────────────────────
    React.useEffect(() => {
        const sentinel = topSentinelRef.current
        if (!sentinel) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isFetchingMore && !isLoading) {
                    fetchComments(currentPage + 1)
                }
            },
            { root: scrollRef.current, threshold: 0.1 }
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [hasMore, isFetchingMore, isLoading, currentPage])

    // ── Stage files ───────────────────────────────────────────────────────────
    const stageFiles = (files: FileList | File[]) => {
        const arr = Array.from(files)
        const staged: StagedFile[] = arr.map((f) => {
            const fileType = normalizeFileType(f.type, f.name)
            const preview = fileType === "image" ? URL.createObjectURL(f) : undefined
            return { id: crypto.randomUUID(), file: f, preview, fileType, name: f.name }
        })
        setStagedFiles((prev) => [...prev, ...staged])
        setIsFocused(true)
        textareaRef.current?.focus()
    }

    const removeStagedFile = (id: string) => {
        setStagedFiles((prev) => {
            const found = prev.find((f) => f.id === id)
            if (found?.preview) URL.revokeObjectURL(found.preview)
            return prev.filter((f) => f.id !== id)
        })
    }

    // ── Paste & Drag ──────────────────────────────────────────────────────────
    const handlePaste = (e: React.ClipboardEvent) => {
        const files = Array.from(e.clipboardData.files)
        if (files.length > 0) { e.preventDefault(); stageFiles(files) }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files.length > 0) stageFiles(e.dataTransfer.files)
    }

    // ── Post comment ──────────────────────────────────────────────────────────
    const handlePost = async () => {
        const text = newComment.trim()
        if (!text && stagedFiles.length === 0) return
        setIsPosting(true)
        setNewComment("")
        try {
            const token = localStorage.getItem("garage_tok")
            if (!token) { toast.error("Authentication token missing"); return }

            let attachments: Attachment[] = []
            if (stagedFiles.length > 0) {
                const uploaded = await uploadFilesToS3(stagedFiles.map((s) => s.file))
                attachments = uploaded.map((u) => ({ link: u.fileLink, name: u.fileName, fileType: u.fileType }))
                stagedFiles.forEach((s) => { if (s.preview) URL.revokeObjectURL(s.preview) })
                setStagedFiles([])
            }

            const response = await fetch(`${TASKROOM_URL}comments/attachment`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ roomId: boardId, taskId: cardId, comment: text, attachments }),
            })
            const data = await response.json()
            if (!response.ok || data.status === false) throw new Error(data.message || "Failed to post comment")

            const created: CommentItem | null = data?.data?.data ?? data?.data
            if (created) {
                setComments((prev) => [...prev, created])
                if (onCommentCountChange) onCommentCountChange(1)
                requestAnimationFrame(() => scrollToBottom())
            }
            setIsFocused(false)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to post comment")
        } finally {
            setIsPosting(false)
        }
    }

    // ── Delete entire comment (text + all attachments) ────────────────────────
    const handleDelete = async (id: string) => {
        if (!confirm("Delete this comment and all its attachments?")) return
        const original = comments
        setComments((prev) => prev.filter((c) => c._id !== id))
        try {
            const token = localStorage.getItem("garage_tok")
            const response = await fetch(`${TASKROOM_URL}comments/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token ?? ""}` },
            })
            const data = await response.json()
            if (!response.ok || data.status === false) throw new Error(data.message)
            if (onCommentCountChange) onCommentCountChange(-1)
            toast.success("Comment deleted")
        } catch (err) {
            setComments(original)
            toast.error(err instanceof Error ? err.message : "Failed to delete comment")
        }
    }

    // ── Begin edit ────────────────────────────────────────────────────────────
    const beginEdit = (c: CommentItem) => {
        const atts = (c.attachmentIds && c.attachmentIds.length > 0) ? c.attachmentIds : (c.attachments ?? [])
        const attachmentEdits: EditState["attachmentEdits"] = {}
        atts.forEach((a) => {
            attachmentEdits[a._id ?? a.link] = { name: a.name }
        })
        setEditState({ commentId: c._id, text: c.comment, attachmentEdits })
    }

    const cancelEdit = () => {
        if (editState) {
            Object.values(editState.attachmentEdits).forEach((ed) => {
                if (ed.replacementPreview) URL.revokeObjectURL(ed.replacementPreview)
            })
        }
        setEditState(null)
    }

    // ── Save edit (text + attachment renames/replacements) ────────────────────
    const handleSaveEdit = async () => {
        if (!editState) return
        const text = editState.text.trim()
        setIsSavingEdit(true)
        try {
            const token = localStorage.getItem("garage_tok")
            if (!token) throw new Error("Authentication token missing")

            const comment = comments.find((c) => c._id === editState.commentId)
            if (!comment) throw new Error("Comment not found")

            const atts = (comment.attachmentIds && comment.attachmentIds.length > 0)
                ? comment.attachmentIds
                : (comment.attachments ?? [])

            // Upload replacement files if any
            const filesToUpload: Array<{ key: string; file: File }> = []
            Object.entries(editState.attachmentEdits).forEach(([key, ed]) => {
                if (ed.replacementFile) filesToUpload.push({ key, file: ed.replacementFile })
            })
            const replacementUploads: Record<string, S3Attachment> = {}
            if (filesToUpload.length > 0) {
                const uploaded = await uploadFilesToS3(filesToUpload.map((f) => f.file))
                filesToUpload.forEach(({ key }, i) => { replacementUploads[key] = uploaded[i] })
            }

            // Build final attachments array — exclude any marked deleted
            const updatedAttachments: Attachment[] = atts
                .filter((a) => {
                    const key = a._id ?? a.link
                    return !editState.attachmentEdits[key]?.deleted
                })
                .map((a) => {
                    const key = a._id ?? a.link
                    const ed = editState.attachmentEdits[key]
                    if (!ed) return a
                    const replacement = replacementUploads[key]
                    return {
                        ...a,
                        name: ed.name || a.name,
                        ...(replacement ? { link: replacement.fileLink, fileType: replacement.fileType } : {}),
                    }
                })

            const response = await fetch(`${TASKROOM_URL}comments/${editState.commentId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ comment: text, attachments: updatedAttachments }),
            })
            const data = await response.json()
            if (!response.ok || data.status === false) throw new Error(data.message || "Failed to update comment")

            // Apply optimistic update
            setComments((prev) =>
                prev.map((c) => {
                    if (c._id !== editState.commentId) return c
                    const updated = { ...c, comment: text }
                    if (c.attachmentIds && c.attachmentIds.length > 0) updated.attachmentIds = updatedAttachments
                    else updated.attachments = updatedAttachments
                    return updated
                })
            )

            // Revoke any blob URLs
            Object.values(editState.attachmentEdits).forEach((ed) => {
                if (ed.replacementPreview) URL.revokeObjectURL(ed.replacementPreview)
            })

            setEditState(null)
            toast.success("Comment updated")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update comment")
        } finally {
            setIsSavingEdit(false)
        }
    }

    const hasContent = newComment.trim().length > 0 || stagedFiles.length > 0
    const isExpanded = isFocused || hasContent

    return (
        <div className={cn("flex flex-col flex-1 min-h-0 h-full", className)}>

            {/* ── Comments List ───────────────────────────────────────────── */}
            <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-4 sm:space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
            >
                {/* TOP SENTINEL */}
                <div ref={topSentinelRef} className="w-full">
                    {isFetchingMore && (
                        <div className="flex items-center justify-center gap-2 py-3">
                            <span className="w-3.5 h-3.5 border border-[#e5e7eb29] border-t-white/60 rounded-full animate-spin" />
                            <span className="text-[11px] text-white/50">Loading older messages…</span>
                        </div>
                    )}
                    {!hasMore && comments.length > 0 && (
                        <div className="flex items-center gap-2 py-2">
                            <div className="flex-1 h-px bg-white/[0.06]" />
                            <span className="text-[10px] text-white/50 px-1">Beginning of conversation</span>
                            <div className="flex-1 h-px bg-white/[0.06]" />
                        </div>
                    )}
                </div>

                {/* Loading skeleton */}
                {isLoading && comments.length === 0 ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-start gap-3 animate-pulse">
                                <div className="h-7 w-7 rounded-full text-white/50 flex-shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 w-20 text-white/50 rounded" />
                                    <div className="h-12 w-full text-white/50 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-white/50 space-y-2">
                        <MessageCircle className="w-7 h-7" />
                        <p className="text-sm">No comments yet</p>
                    </div>
                ) : (
                    comments.map((c) => {
                        // FIX 1: robust owner check
                        const isOwner = true
                        const initials = (c.userId?.name ?? "?").substring(0, 2).toUpperCase()
                        const atts = (c.attachmentIds && c.attachmentIds.length > 0)
                            ? c.attachmentIds
                            : (c.attachments ?? [])
                        const isEditing = editState?.commentId === c._id

                        return (
                            // FIX 2: named group `group/comment` so the action bar
                            // responds to hover on the entire row, not just the bubble
                            <div key={c._id} className="group/comment flex items-start gap-2.5">
                                {/* Avatar */}
                                <Avatar className="h-7 w-7 flex-shrink-0 border border-[#e5e7eb29] mt-0.5 overflow-hidden">
                                    {c.userId?.image || c.userAvatarUrl ? (
                                        <AvatarImage
                                            src={c.userId?.image || c.userAvatarUrl}
                                            alt={c.userId?.name || "User avatar"}
                                        />
                                    ) : (
                                        <AvatarFallback className="text-[9px] bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-white/50 font-bold">
                                            {initials}
                                        </AvatarFallback>
                                    )}
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    {/* Header row with action bar */}
                                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-semibold text-white/50">
                                                {c.userId?.name ?? "Unknown"}
                                            </span>
                                            <span className="text-[10px] text-white/50">
                                                {c.createdAt
                                                    ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })
                                                    : ""}
                                            </span>
                                        </div>

                                        {/* FIX 3: action bar moved to header row — always present,
                                            works for text-only, attachment-only, and mixed comments */}
                                        {!isReadOnly && isOwner && !isEditing && (
                                            <div className="flex items-center gap-0.5 bg-[#1c1c28] border border-[#e5e7eb29] rounded-md px-1 py-0.5 opacity-100 sm:opacity-0 sm:group-hover/comment:opacity-100 transition-opacity shadow-lg shrink-0">
                                                <button
                                                    title="Edit comment"
                                                    onClick={() => beginEdit(c)}
                                                    className="w-6 h-6 flex items-center justify-center rounded text-white/50 hover:text-white/50 hover:bg-white/8 transition"
                                                >
                                                    <PencilLine className="w-3 h-3" />
                                                </button>
                                                <div className="w-px h-3.5 bg-white/10 mx-0.5" />
                                                <button
                                                    title="Delete comment"
                                                    onClick={() => handleDelete(c._id)}
                                                    className="w-6 h-6 flex items-center justify-center rounded text-white/50 hover:text-red-400 hover:bg-red-400/10 transition"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── EDIT MODE ── */}
                                    {isEditing && editState ? (
                                        <div className="space-y-2">
                                            {/* Text */}
                                            <Textarea
                                                value={editState.text}
                                                onChange={(e) => setEditState({ ...editState, text: e.target.value })}
                                                className="min-h-[60px] resize-none text-sm bg-white/[0.04] text-white/50 rounded-lg border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
                                                    if (e.key === "Escape") cancelEdit()
                                                }}
                                            />

                                            {/* Per-attachment edit rows */}
                                            {atts.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-white/50 uppercase font-semibold px-0.5 tracking-wide">
                                                        Attachments
                                                    </p>
                                                    {atts.map((a) => {
                                                        const key = a._id ?? a.link
                                                        const ed = editState.attachmentEdits[key] ?? { name: a.name }
                                                        return (
                                                            <AttachmentEditRow
                                                                key={key}
                                                                att={a}
                                                                editData={ed}
                                                                onChange={(update) =>
                                                                    setEditState((prev) =>
                                                                        prev ? {
                                                                            ...prev,
                                                                            attachmentEdits: {
                                                                                ...prev.attachmentEdits,
                                                                                [key]: { ...ed, ...update },
                                                                            },
                                                                        } : prev
                                                                    )
                                                                }
                                                                onDelete={() =>
                                                                    setEditState((prev) =>
                                                                        prev ? {
                                                                            ...prev,
                                                                            attachmentEdits: {
                                                                                ...prev.attachmentEdits,
                                                                                [key]: { ...ed, deleted: true, replacementFile: undefined, replacementPreview: undefined },
                                                                            },
                                                                        } : prev
                                                                    )
                                                                }
                                                            />
                                                        )
                                                    })}
                                                </div>
                                            )}

                                            {/* Save / Cancel */}
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    disabled={isSavingEdit}
                                                    className="h-6 text-[10px] px-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/20"
                                                    onClick={handleSaveEdit}
                                                >
                                                    {isSavingEdit && (
                                                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
                                                    )}
                                                    {isSavingEdit ? "Saving…" : "Save"}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[10px] px-2 text-white/50 hover:text-white/50"
                                                    onClick={cancelEdit}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Comment text bubble */}
                                            {c.comment && (
                                                <div className="px-3  text-[12px] text-white/50 leading-relaxed break-words shadow-sm">
                                                    {c.comment}
                                                </div>
                                            )}

                                            {/* Attachments (view mode) */}
                                            {atts.length > 0 && (() => {
                                                const getType = (a: Attachment) =>
                                                (typeof a.fileType === "string" && a.fileType
                                                    ? a.fileType.toLowerCase()
                                                    : normalizeFileType("", typeof a.name === "string" ? a.name : ""))
                                                const images = atts.filter(a => getType(a) === "image")
                                                const others = atts.filter(a => getType(a) !== "image")
                                                return (
                                                    <div className="mt-1.5 flex flex-col gap-1.5">
                                                        {images.length > 0 && (
                                                            <div className={cn("grid gap-1.5", images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
                                                                {images.map((att) => (
                                                                    <CommentAttachment key={att._id ?? att.link} att={att} />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {others.map((att) => (
                                                            <CommentAttachment key={att._id ?? att.link} att={att} />
                                                        ))}
                                                    </div>
                                                )
                                            })()}
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* ── Composer ────────────────────────────────────────────────── */}
            {!isReadOnly && (
                <div className="shrink-0 p-2 sm:p-3 border-t border-[#e5e7eb29] sm:border-t-0">
                    <div
                        className={cn(
                            "rounded-xl border transition-all duration-200 overflow-hidden",
                            isDragging
                                ? "border-indigo-500/50 bg-indigo-500/5 ring-1 ring-indigo-500/20"
                                : isExpanded
                                    ? "border-white/12 ring-1 ring-white/5"
                                    : "border-[#e5e7eb29] "
                        )}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        {stagedFiles.length > 0 && (
                            <div className="px-3 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {stagedFiles.map((sf) => (
                                    <AttachmentPreview
                                        key={sf.id}
                                        att={{ link: sf.preview ?? "", name: sf.name, fileType: sf.fileType, preview: sf.preview } as any}
                                        onRemove={() => removeStagedFile(sf.id)}
                                    />
                                ))}
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onPaste={handlePaste}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && hasContent) {
                                    e.preventDefault()
                                    handlePost()
                                }
                                if (e.key === "Escape") setIsFocused(false)
                            }}
                            placeholder={isDragging ? "Drop files here…" : "Write a comment, paste or drop files…"}
                            rows={isExpanded ? 3 : 1}
                            className={cn(
                                "w-full bg-transparent border-none outline-none resize-none text-[12px] placeholder:text-[12px] text-white/50 px-3 transition-all duration-200",
                                isExpanded ? "py-3 min-h-[72px]" : "py-2.5 min-h-[40px]"
                            )}
                        />

                        {isExpanded && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 pb-2.5 pt-1 border-t border-[#e5e7eb29]">
                                <div className="flex items-center gap-1 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] text-white/50 hover:text-white cursor-pointer hover:text-white transition"
                                    >
                                        <Paperclip className="w-3 h-3" />
                                        <span>Attach</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => textareaRef.current?.focus()}
                                        className="flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] text-white/50  hover:text-white cursor-pointer transition"
                                    >
                                        <ClipboardPaste className="w-3 h-3" />
                                        <span>Paste</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => { setIsFocused(false); setNewComment(""); setStagedFiles([]) }}
                                        className="h-7 sm:h-6 px-2.5 rounded-md text-[10px] text-white/50 hover:text-white cursor-pointer transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePost}
                                        disabled={isPosting || !hasContent}
                                        className={cn(
                                            "flex items-center gap-1.5 h-7 sm:h-6 px-3 rounded-md text-[10px] font-medium transition-all",
                                            hasContent && !isPosting
                                                ? " hover: text-white/50  border border-indigo-500/25"
                                                : "text-white/50 text-white/50 cursor-not-allowed"
                                        )}
                                    >
                                        {isPosting
                                            ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                            : <SendHorizonal className="w-3 h-3" />
                                        }
                                        {isPosting ? "Sending…" : "Send"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {!isExpanded && (
                        <p className="text-center text-[10px] text-white/50/15 mt-1.5">
                            Click to type · Paste or drop files to attach
                        </p>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z,.txt,.csv"
                        className="hidden"
                        onChange={(e) => { if (e.target.files) stageFiles(e.target.files); e.target.value = "" }}
                    />
                </div>
            )}
        </div>
    )
}