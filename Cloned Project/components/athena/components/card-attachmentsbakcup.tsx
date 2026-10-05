"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import {
    Upload,
    Trash2,
    Play,
    FileText,
    File,
    Download,
    Loader2,
    Plus,
    LayoutGrid,
    List,
    Maximize2,
    ChevronDown,
    ChevronRight,
    ImageIcon,
    FileVideo,
    FileArchive,
    Music,
    Code2,
    Sheet,
    Presentation,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export interface Attachment {
    _id?: string
    link: string
    name: string
    fileType: "document" | "image" | "video"
    comment: string
    fileSize?: number
    uploadedAt?: string
    uploaderName?: string
    uploaderAvatar?: string
}

interface CardAttachmentsProps {
    cardId: string
    boardId: string
    attachments: Attachment[]
    onAttachmentsChange: (attachments: Attachment[]) => void
    onSave?: (attachments: Attachment[]) => Promise<void>
    showAttachments?: boolean
    isReadOnly?: boolean
}

const API_URL = "https://uatapi.garage.app"
const FLOWBOARD_API_URL = "https://uatapi.garage.app/taskroomv2/v2"

// ───── FILE TYPE DETECTION ─────
function detectFileType(
    mime: string,
    name: string
): "document" | "image" | "video" {
    const ext = name.split(".").pop()?.toLowerCase() || ""

    // Image types
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff", "avif", "heic"]
    const imagesMime = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff", "image/avif"]
    if (imagesMime.includes(mime) || imageExts.includes(ext)) return "image"

    // Video types
    const videoExts = ["mp4", "webm", "mov", "avi", "mkv", "flv", "wmv", "m4v", "ogv", "3gp", "ts"]
    const videoMime = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/ogg", "video/3gpp"]
    if (videoMime.some(v => mime.startsWith("video/")) || videoExts.includes(ext)) return "video"
    if (mime === "video/link") return "video"

    // Everything else is a document
    return "document"
}

function formatFileSize(bytes?: number): string {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return "Just now"
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return "Just now"
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60_000) return "Just now"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ───── FILE ICON ─────
function FileIcon({ name, fileType, size = 20 }: { name: string; fileType: "document" | "image" | "video"; size?: number }) {
    const ext = name.split(".").pop()?.toLowerCase() || ""
    const s = size

    if (fileType === "image") return <ImageIcon size={s} className="text-blue-400" />
    if (fileType === "video") return <FileVideo size={s} className="text-purple-400" />

    if (["pdf"].includes(ext)) return (
        <div style={{ width: s + 8, height: s + 8 }} className="flex items-center justify-center rounded bg-red-700/80">
            <span className="text-white font-bold" style={{ fontSize: s * 0.45 }}>PDF</span>
        </div>
    )
    if (["doc", "docx"].includes(ext)) return (
        <div style={{ width: s + 8, height: s + 8 }} className="flex items-center justify-center rounded bg-blue-700/80">
            <FileText size={s * 0.7} className="text-white" />
        </div>
    )
    if (["xls", "xlsx", "csv"].includes(ext)) return <Sheet size={s} className="text-green-400" />
    if (["ppt", "pptx"].includes(ext)) return <Presentation size={s} className="text-orange-400" />
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) return <FileArchive size={s} className="text-yellow-400" />
    if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return <Music size={s} className="text-pink-400" />
    if (["js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "html", "css", "json"].includes(ext)) return <Code2 size={s} className="text-cyan-400" />
    if (["webm"].includes(ext)) return <FileVideo size={s} className="text-purple-400" />

    return <File size={s} className="text-white/40" />
}

// ───── THUMBNAIL FOR GRID ─────
function GridThumbnail({ att }: { att: Attachment }) {
    const ext = att.name.split(".").pop()?.toLowerCase() || ""

    if (att.fileType === "image") {
        return (
            <div className="w-full aspect-square bg-[#1a1a20] rounded-t-lg overflow-hidden flex items-center justify-center">
                <img src={att.link} alt={att.name} className="w-full h-full object-contain" />
            </div>
        )
    }

    // Icon-based thumbnail
    const bgMap: Record<string, string> = {
        webm: "bg-purple-900/40", mp4: "bg-purple-900/40", mov: "bg-purple-900/40",
        pdf: "bg-red-900/40",
        doc: "bg-blue-900/40", docx: "bg-blue-900/40",
        xls: "bg-green-900/40", xlsx: "bg-green-900/40",
    }
    const bg = bgMap[ext] || "bg-[#1e1e26]"

    return (
        <div className={`w-full aspect-square ${bg} rounded-t-lg flex items-center justify-center`}>
            <FileIcon name={att.name} fileType={att.fileType} size={40} />
        </div>
    )
}

// ───── AVATAR ─────
function Avatar({ name }: { name?: string }) {
    const initial = (name || "U").charAt(0).toUpperCase()
    const colors = ["bg-violet-600", "bg-blue-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600"]
    const idx = initial.charCodeAt(0) % colors.length
    return (
        <div className={`w-7 h-7 rounded-full ${colors[idx]} flex items-center justify-center flex-shrink-0`}>
            <span className="text-white text-xs font-semibold">{initial}</span>
        </div>
    )
}

export function CardAttachments({
    cardId,
    boardId,
    attachments,
    onAttachmentsChange,
    onSave,
    showAttachments = false,
    isReadOnly = false,
}: CardAttachmentsProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const [newVideoLink, setNewVideoLink] = useState("")
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewItem, setPreviewItem] = useState<{
        type: "image" | "video" | "pdf" | "doc" | "other"
        url: string
        name: string
    } | null>(null)
    const [viewMode, setViewMode] = useState<"list" | "grid">("list")
    const [expanded, setExpanded] = useState(true)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [hasNextPage, setHasNextPage] = useState(false)
    const [hasFetchedFiles, setHasFetchedFiles] = useState(false)
    const [isLoadingFiles, setIsLoadingFiles] = useState(false)
    const observer = useRef<IntersectionObserver | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const pasteInputRef = useRef<HTMLInputElement>(null)

    // ───── FETCH FILES WITH PAGINATION ─────
    useEffect(() => {
        if (!cardId || !boardId || hasFetchedFiles) return

        const fetchFirstPage = async () => {
            setIsLoadingFiles(true)
            setCurrentPage(1)
            setHasNextPage(true)
            try {
                const url = new URL(`${FLOWBOARD_API_URL}/attachments`)
                url.searchParams.append("roomId", boardId)
                url.searchParams.append("taskId", cardId)
                url.searchParams.append("page", "1")
                url.searchParams.append("size", "50")

                const token = localStorage.getItem("garage_tok")
                const response = await fetch(url.toString(), {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                })

                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const result = await response.json()

                const newFiles = Array.isArray(result.data) ? result.data : []
                const mappedFiles: Attachment[] = newFiles.map((file: any) => ({
                    _id: file._id,
                    link: file.link || file.fileUrl || "",
                    name: file.name || "",
                    fileType: detectFileType(file.mimeType || file.fileType || "", file.name || ""),
                    comment: file.comment || "",
                    fileSize: file.fileSize || file.size,
                    uploadedAt: file.createdAt || file.uploadedAt,
                    uploaderName: file.uploaderName || file.createdBy?.name,
                    uploaderAvatar: file.createdBy?.avatar,
                }))

                onAttachmentsChange(mappedFiles)
                setHasNextPage(!!result.metadata?.nextPage)
                setHasFetchedFiles(true)
            } catch (err) {
                console.error("Failed to load files:", err)
                toast.error("Failed to load files")
            } finally {
                setIsLoadingFiles(false)
            }
        }

        fetchFirstPage()
    }, [cardId, boardId, hasFetchedFiles, onAttachmentsChange])

    // ───── FETCH NEXT PAGE ─────
    useEffect(() => {
        if (currentPage <= 1 || !hasFetchedFiles || !cardId || !boardId || !hasNextPage) return

        const fetchNextPage = async () => {
            setIsLoadingFiles(true)
            try {
                const url = new URL(`${FLOWBOARD_API_URL}/attachments`)
                url.searchParams.append("roomId", boardId)
                url.searchParams.append("taskId", cardId)
                url.searchParams.append("page", currentPage.toString())
                url.searchParams.append("size", "50")

                const token = localStorage.getItem("garage_tok")
                const response = await fetch(url.toString(), {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                })

                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const result = await response.json()

                const newFiles = Array.isArray(result.data) ? result.data : []
                const mappedFiles: Attachment[] = newFiles.map((file: any) => ({
                    _id: file._id,
                    link: file.link || file.fileUrl || "",
                    name: file.name || "",
                    fileType: detectFileType(file.mimeType || file.fileType || "", file.name || ""),
                    comment: file.comment || "",
                    fileSize: file.fileSize || file.size,
                    uploadedAt: file.createdAt || file.uploadedAt,
                    uploaderName: file.uploaderName || file.createdBy?.name,
                }))

                onAttachmentsChange([...attachments, ...mappedFiles])
                setHasNextPage(!!result.metadata?.nextPage)
            } catch (err) {
                console.error("Failed to load more files:", err)
                toast.error("Failed to load more files")
            } finally {
                setIsLoadingFiles(false)
            }
        }

        fetchNextPage()
    }, [currentPage, hasFetchedFiles, cardId, boardId, hasNextPage])

    // ───── INFINITE SCROLL ─────
    const lastElementRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isLoadingFiles || !hasNextPage) return
            if (observer.current) observer.current.disconnect()
            observer.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting && hasNextPage && !isLoadingFiles) {
                        setCurrentPage((prev) => prev + 1)
                    }
                },
                { rootMargin: "200px" }
            )
            if (node) observer.current.observe(node)
        },
        [isLoadingFiles, hasNextPage]
    )

    useEffect(() => {
        if (!showAttachments) {
            setHasFetchedFiles(false)
            setCurrentPage(1)
            setHasNextPage(false)
        }
    }, [showAttachments])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setPreviewOpen(false)
            }
        }
        if (previewOpen) {
            window.addEventListener("keydown", handleKeyDown)
        }
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [previewOpen])

    // ───── S3 UPLOAD ─────
    const uploadFilesToS3 = async (files: File[]): Promise<Attachment[]> => {
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
            return {
                link: r.url,
                name: r.fileName || f.name,
                fileType: detectFileType(f.type || "", f.name),
                comment: "Uploaded via CardAttachments",
                fileSize: f.size,
                uploadedAt: new Date().toISOString(),
            }
        })
    }

    const processFiles = async (fileList: FileList | File[]) => {
        if (isReadOnly || isUploading || !fileList.length) return
        setIsUploading(true)
        const files = Array.from(fileList)
        try {
            const uploaded = await uploadFilesToS3(files)
            const newAttachments = [...attachments, ...uploaded]
            if (onSave) {
                await onSave(newAttachments)
                onAttachmentsChange(newAttachments)
            } else {
                onAttachmentsChange(newAttachments)
            }
            toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`)
        } catch (e) {
            console.error(e)
            toast.error("Upload failed")
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    // ───── DRAG / PASTE ─────
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
        if (isReadOnly) return
        if (e.dataTransfer.files) processFiles(e.dataTransfer.files)
    }

    const handlePaste = async (e: React.ClipboardEvent) => {
        if (isReadOnly) return
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

    // ───── VIDEO LINK ─────
    const addVideoLink = async () => {
        if (isReadOnly || !newVideoLink.trim()) return
        const url = newVideoLink.trim()
        if (attachments.some((a) => a.link === url)) {
            toast.error("This link is already added")
            return
        }
        let name = "Video Link"
        try { name = new URL(url).pathname.split("/").pop() || "Video Link" } catch { }

        const newAttachments = [
            ...attachments,
            { link: url, name, fileType: "video" as const, comment: "Uploaded via CardAttachments", uploadedAt: new Date().toISOString() },
        ]
        onAttachmentsChange(newAttachments)
        if (onSave) await onSave(newAttachments)
        setNewVideoLink("")
        toast.success("Video link added")
    }

    const removeAttachment = async (link: string) => {
        if (isReadOnly) { toast.error("Observers can only view attachments"); return }
        const att = attachments.find((a) => a.link === link)
        if (!att) return

        if (att._id) {
            try {
                const token = localStorage.getItem("garage_tok")
                if (!token) { toast.error("Authentication token missing"); return }
                const response = await fetch(`${FLOWBOARD_API_URL}/v1/files/${att._id}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                })
                if (!response.ok) {
                    const result = await response.json()
                    throw new Error(result.message || "Failed to delete attachment")
                }
                onAttachmentsChange(attachments.filter((a) => a.link !== link))
                toast.success("Attachment removed")
            } catch (error) {
                console.error("Failed to delete attachment:", error)
                toast.error(error instanceof Error ? error.message : "Failed to delete attachment")
            }
        } else {
            onAttachmentsChange(attachments.filter((a) => a.link !== link))
            toast.success("Attachment removed")
        }
    }

    // ───── PREVIEW ─────
    const googleViewerUrl = (fileUrl: string) =>
        `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`

    const handlePreview = (att: Attachment) => {
        const { link, name, fileType } = att
        if (fileType === "image") {
            setPreviewItem({ type: "image", url: link, name: name })
        } else if (fileType === "video") {
            setPreviewItem({ type: "video", url: link, name: name })
        } else {
            const ext = name.split(".").pop()?.toLowerCase()
            if (ext === "pdf") setPreviewItem({ type: "pdf", url: link, name: name })
            else if (["doc", "docx"].includes(ext || "")) setPreviewItem({ type: "doc", url: googleViewerUrl(link), name: name })
            else setPreviewItem({ type: "other", url: link, name: name })
        }
        setPreviewOpen(true)
    }

    const downloadAll = () => {
        attachments.forEach((att) => {
            if (att.fileType !== "video") {
                const a = document.createElement("a")
                a.href = att.link
                a.download = att.name
                a.target = "_blank"
                a.click()
            }
        })
    }

    return (
        <>
            <div className="rounded-lg border border-white/[0.08] overflow-hidden bg-[#0e0e13]">
                {/* ── HEADER ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                    <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
                        onClick={() => setExpanded((v) => !v)}
                    >
                        {expanded
                            ? <ChevronDown size={15} className="text-white/40" />
                            : <ChevronRight size={15} className="text-white/40" />}
                        Attachments
                        {attachments.length > 0 && (
                            <span className="ml-1 text-xs bg-white/10 text-white/50 rounded-full px-2 py-0.5 font-normal">
                                {attachments.length}
                            </span>
                        )}
                    </button>

                    <div className="flex items-center gap-1">
                        {/* Download all */}
                        <button
                            type="button"
                            title="Download all"
                            onClick={downloadAll}
                            className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                        >
                            <Download size={15} />
                        </button>
                        {/* Grid view */}
                        <button
                            type="button"
                            title="Grid view"
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-white/15 text-white" : "text-white/40 hover:bg-white/10 hover:text-white/70"}`}
                        >
                            <LayoutGrid size={15} />
                        </button>
                        {/* List view */}
                        <button
                            type="button"
                            title="List view"
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-white/15 text-white" : "text-white/40 hover:bg-white/10 hover:text-white/70"}`}
                        >
                            <List size={15} />
                        </button>
                        {/* Expand */}
                        <button
                            type="button"
                            title="Expand"
                            className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                        >
                            <Maximize2 size={15} />
                        </button>
                        {/* Add */}
                        {!isReadOnly && (
                            <button
                                type="button"
                                title="Upload files"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                            >
                                <Plus size={15} />
                            </button>
                        )}
                    </div>
                </div>

                {expanded && (
                    <div className="p-3 space-y-3">
                        {/* ── UPLOAD AREA ── */}
                        {!isReadOnly && (
                            <>
                                {/* Drop zone */}
                                <div
                                    className={`border border-dashed rounded-lg px-4 py-3 text-center cursor-pointer transition-all ${dragActive
                                        ? "border-white/30 bg-white/5"
                                        : "border-white/[0.12] hover:border-white/25 hover:bg-white/[0.02]"
                                        }`}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {isUploading
                                        ? <Loader2 size={16} className="animate-spin text-white/40 mx-auto mb-1" />
                                        : <Upload size={16} className="text-white/30 mx-auto mb-1" />
                                    }
                                    <p className="text-xs text-white/40">
                                        Drop your files here to{" "}
                                        <span className="text-white/60 underline underline-offset-2">upload</span>
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*,video/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.rar"
                                        onChange={(e) => e.target.files && processFiles(e.target.files)}
                                        className="hidden"
                                    />
                                </div>

                                {/* Paste zone */}
                                <div className="flex gap-2">
                                    <input
                                        ref={pasteInputRef}
                                        type="text"
                                        placeholder="Click here and paste images/files (Ctrl+V)"
                                        className="flex-1 px-3 py-1.5 text-xs rounded border border-white/[0.1] bg-white/[0.03] text-white/50 placeholder:text-white/25 focus:outline-none focus:border-white/20"
                                        onPaste={handlePaste}
                                        readOnly
                                    />
                                </div>

                                {/* Video link */}
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Paste Video URL..."
                                        value={newVideoLink}
                                        onChange={(e) => setNewVideoLink(e.target.value)}
                                        onKeyPress={(e) => e.key === "Enter" && addVideoLink()}
                                        className="text-xs text-white/50 bg-white/[0.03] border-white/[0.1] focus-visible:ring-0 focus:border-white/20 h-8"
                                        disabled={isReadOnly}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addVideoLink}
                                        className="h-8 px-3 text-xs border-white/10 text-white/50 hover:text-white/80 bg-transparent hover:bg-white/5"
                                    >
                                        <Plus size={13} className="mr-1" /> Add
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* ── FILE LIST ── */}
                        {attachments.length > 0 && (
                            viewMode === "list" ? (
                                /* LIST VIEW */
                                <div className="rounded-md border border-white/[0.08] overflow-hidden">
                                    {/* Table header */}
                                    <div className="grid grid-cols-[1fr_90px_140px_100px_36px] gap-2 px-3 py-2 border-b border-white/[0.08] bg-white/[0.02]">
                                        <span className="text-[11px] text-white/30 font-medium">Name</span>
                                        <span className="text-[11px] text-white/30 font-medium">Size</span>
                                        <span className="text-[11px] text-white/30 font-medium">Modified ▲</span>
                                        <span className="text-[11px] text-white/30 font-medium">Author</span>
                                        <span />
                                    </div>

                                    {attachments.map((att, index) => (
                                        <div
                                            key={att._id || att.link}
                                            ref={index === attachments.length - 1 ? lastElementRef : null}
                                            className="grid grid-cols-[1fr_90px_140px_100px_36px] gap-2 items-center px-3 py-2.5 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] cursor-pointer group transition-colors"
                                            onClick={() => handlePreview(att)}
                                        >
                                            {/* Name + icon */}
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="flex-shrink-0">
                                                    {att.fileType === "image" ? (
                                                        <img src={att.link} alt="" className="w-7 h-7 object-cover rounded" />
                                                    ) : (
                                                        <FileIcon name={att.name} fileType={att.fileType} size={18} />
                                                    )}
                                                </div>
                                                <span className="text-sm text-white/70 truncate">{att.name}</span>
                                            </div>

                                            {/* Size */}
                                            <span className="text-xs text-white/35 truncate">
                                                {formatFileSize(att.fileSize)}
                                            </span>

                                            {/* Modified */}
                                            <span className="text-xs text-white/35 truncate">
                                                {formatDate(att.uploadedAt)}
                                            </span>

                                            {/* Author */}
                                            <div className="flex items-center">
                                                <Avatar name={att.uploaderName} />
                                            </div>

                                            {/* Delete */}
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeAttachment(att.link) }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400/70 hover:text-red-400 p-1 rounded"
                                                disabled={isReadOnly}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* GRID VIEW */
                                <div className="grid grid-cols-3 gap-3">
                                    {attachments.map((att, index) => (
                                        <div
                                            key={att._id || att.link}
                                            ref={index === attachments.length - 1 ? lastElementRef : null}
                                            className="rounded-lg border border-white/[0.08] overflow-hidden hover:border-white/20 cursor-pointer group transition-all bg-[#13131a]"
                                            onClick={() => handlePreview(att)}
                                        >
                                            <GridThumbnail att={att} />
                                            <div className="px-2.5 py-2">
                                                <div className="flex items-start justify-between gap-1">
                                                    <div className="min-w-0">
                                                        <p className="text-xs text-white/65 truncate leading-snug">
                                                            {att.name.replace(/\.[^.]+$/, "")}
                                                            <span className="text-white/30">
                                                                {att.name.includes(".") ? "." + att.name.split(".").pop() : ""}
                                                            </span>
                                                        </p>
                                                        <p className="text-[11px] text-white/30 mt-0.5">{formatDate(att.uploadedAt)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                                                        <Avatar name={att.uploaderName} />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); removeAttachment(att.link) }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400/70 hover:text-red-400 p-0.5 rounded"
                                                            disabled={isReadOnly}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {isLoadingFiles && (
                            <div className="flex items-center justify-center py-4 gap-2">
                                <Loader2 size={15} className="animate-spin text-white/40" />
                                <span className="text-xs text-white/40">Loading files…</span>
                            </div>
                        )}

                        {!isLoadingFiles && attachments.length === 0 && (
                            <div className="py-6 text-center">
                                <File size={24} className="mx-auto text-white/15 mb-2" />
                                <p className="text-xs text-white/25">No attachments yet</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── PREVIEW MODAL ── */}
            {previewOpen && (
                <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0e0e13] overflow-hidden animate-in fade-in duration-200">
                    <div className="px-6 pt-5 pb-4 border-b border-white/[0.08] flex flex-row items-center justify-between flex-shrink-0 bg-[#0e0e13]">
                        <h2 className="truncate max-w-md text-sm text-white/80 font-medium">{previewItem?.name}</h2>
                        <div className="flex items-center gap-2">
                            {previewItem && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => window.open(previewItem.url, "_blank")}
                                    className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10"
                                    title="Open / Download"
                                >
                                    <Download size={15} />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPreviewOpen(false)}
                                className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10"
                                title="Close"
                            >
                                <X size={15} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-[#0a0a10] p-4 flex items-center justify-center">
                        {previewItem?.type === "image" && (
                            <img src={previewItem.url} alt={previewItem.name} className="max-w-full max-h-full object-contain mx-auto rounded-md" />
                        )}
                        {previewItem?.type === "video" && (
                            <div className="w-full h-full flex items-center justify-center">
                                <video
                                    src={previewItem.url}
                                    controls
                                    className="max-w-full max-h-[100vh] rounded-lg"
                                    onError={() => {
                                        // Fallback to iframe for embedded links
                                    }}
                                >
                                    <source src={previewItem.url} />
                                    <iframe
                                        src={previewItem.url}
                                        title="Video"
                                        className="w-full h-96 border-0 rounded-lg"
                                        allowFullScreen
                                    />
                                </video>
                            </div>
                        )}
                        {previewItem?.type === "pdf" && (
                            <iframe
                                src={previewItem.url}
                                title="PDF Preview"
                                className="w-full border-0 rounded-lg h-full"
                                style={{ minHeight: "78vh" }}
                            />
                        )}
                        {previewItem?.type === "doc" && (
                            <iframe
                                src={previewItem.url}
                                title="Document Preview"
                                className="w-full border-0 rounded-lg h-full"
                                style={{ minHeight: "78vh" }}
                                allowFullScreen
                            />
                        )}
                        {previewItem?.type === "other" && (
                            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                                <File size={48} className="text-white/20" />
                                <p className="text-sm font-medium text-white/60">Preview not available</p>
                                <p className="text-xs text-white/35">This file type cannot be previewed in the browser.</p>
                                <Button onClick={() => window.open(previewItem.url, "_blank")} size="sm" className="bg-white/10 hover:bg-white/15 text-white/70 border-0">
                                    <Download size={14} className="mr-2" /> Download File
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}