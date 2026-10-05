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
    Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import Cookies from "js-cookie"

export interface Attachment {
    _id?: string
    fileLink: string
    fileName: string
    fileType: "document" | "image" | "video"
    comment: string
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
const FLOWBOARD_API_URL = "https://uatapi.garage.app/flowboard"

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
                const url = new URL(`${FLOWBOARD_API_URL}/v1/files`)
                url.searchParams.append("boardId", boardId)
                url.searchParams.append("cardId", cardId)
                url.searchParams.append("page", "1")
                url.searchParams.append("size", "50")

                const token = localStorage.getItem("garage_tok")
                const response = await fetch(url, {
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
                    fileLink: file.fileLink || file.fileUrl || "",
                    fileName: file.fileName || "",
                    fileType: file.fileType || "document",
                    comment: file.comment || "",
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
    }, [showAttachments, cardId, boardId, hasFetchedFiles, onAttachmentsChange])

    // ───── FETCH NEXT PAGE (Infinite Scroll) ─────
    useEffect(() => {
        if (currentPage <= 1 || !hasFetchedFiles || !cardId || !boardId || !hasNextPage) return

        const fetchNextPage = async () => {
            setIsLoadingFiles(true)
            try {
                const url = new URL(`${FLOWBOARD_API_URL}/v1/files`)
                url.searchParams.append("boardId", boardId)
                url.searchParams.append("cardId", cardId)
                url.searchParams.append("page", currentPage.toString())
                url.searchParams.append("size", "50")

                const token = localStorage.getItem("garage_tok")
                const response = await fetch(url, {
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
                    fileLink: file.fileLink || file.fileUrl || "",
                    fileName: file.fileName || "",
                    fileType: file.fileType || "document",
                    comment: file.comment || "",
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
    }, [currentPage, hasFetchedFiles, cardId, boardId, hasNextPage, onAttachmentsChange])

    // ───── INFINITE SCROLL OBSERVER ─────
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

    // Reset pagination when showAttachments changes to false
    useEffect(() => {
        if (!showAttachments) {
            setHasFetchedFiles(false)
            setCurrentPage(1)
            setHasNextPage(false)
        }
    }, [showAttachments])

    // ───── NORMALIZE MIME TO document | image | video ─────
    const normalizeFileType = (mime: string, fileName: string): "document" | "image" | "video" => {
        if (mime.startsWith("image/")) return "image"
        if (mime === "video/link") return "video"
        return "document"
    }

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
                comment: "Uploaded via CardAttachments",
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
            onAttachmentsChange(newAttachments)
            if (onSave) {
                await onSave(newAttachments)
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
        const items = e.clipboardData?.items
        if (!items) return
        if (isReadOnly) return
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

    // ───── UI HELPERS ─────
    const addVideoLink = async () => {
        if (isReadOnly) return
        if (newVideoLink.trim()) {
            const url = newVideoLink.trim()
            if (attachments.some((a) => a.fileLink === url)) {
                toast.error("This link is already added")
                return
            }

            let fileName = "Video Link"
            try {
                fileName = new URL(url).pathname.split("/").pop() || "Video Link"
            } catch {
                // Invalid URL, keep default
            }

            const newAttachments = [
                ...attachments,
                {
                    fileLink: url,
                    fileName,
                    fileType: "video" as const,
                    comment: "Uploaded via CardAttachments",
                },
            ]
            onAttachmentsChange(newAttachments)
            if (onSave) {
                await onSave(newAttachments)
            }
            setNewVideoLink("")
            toast.success("Video link added")
        }
    }

    const removeAttachment = async (fileLink: string) => {
        if (isReadOnly) {
            toast.error("Observers can only view attachments")
            return
        }
        const attachmentToDelete = attachments.find((a) => a.fileLink === fileLink)
        if (!attachmentToDelete) {
            console.error("Attachment not found for fileLink:", fileLink)
            return
        }

        console.log("removeAttachment called with:", { fileLink, attachmentToDelete })

        // If the attachment has an _id, call the DELETE API endpoint directly
        if (attachmentToDelete._id) {
            try {
                const token = localStorage.getItem("garage_tok")
                if (!token) {
                    toast.error("Authentication token missing")
                    return
                }

                console.log("Calling DELETE API for file _id:", attachmentToDelete._id)
                const response = await fetch(`${FLOWBOARD_API_URL}/v1/files/${attachmentToDelete._id}`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                })

                console.log("DELETE API response status:", response.status)

                if (!response.ok) {
                    const result = await response.json()
                    throw new Error(result.message || "Failed to delete attachment")
                }

                // Update local state after successful deletion via DELETE API
                // Do NOT call onSave here as the DELETE API already handles the backend deletion
                const newAttachments = attachments.filter((a) => a.fileLink !== fileLink)
                onAttachmentsChange(newAttachments)
                toast.success("Attachment removed")
            } catch (error) {
                console.error("Failed to delete attachment:", error)
                toast.error(error instanceof Error ? error.message : "Failed to delete attachment")
            }
        } else {
            console.warn("Attachment does not have _id, cannot call DELETE API. Attachment:", attachmentToDelete)
            // Fallback: if no _id, just update local state (for newly uploaded files not yet saved)
            // This should not happen for files fetched from API, but handle it for safety
            const newAttachments = attachments.filter((a) => a.fileLink !== fileLink)
            onAttachmentsChange(newAttachments)
            toast.success("Attachment removed")
        }
    }

    const handleVideoLinkKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            addVideoLink()
        }
    }

    // ───── PREVIEW LOGIC ─────
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

    const getFileIcon = (type: "document" | "image" | "video", name: string) => {
        if (type === "image") return <FileText className="h-5 w-5 text-gray-500" />
        if (type === "video") return <Play className="h-5 w-5 text-purple-500" />
        return <FileText className="h-5 w-5 text-gray-700" />
    }

    return (
        <>
            <div className="space-y-2">
                {
                    showAttachments &&
                    <>
                        <div className="mb-3 p-3 bg-muted/70 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-2">Quick Paste Zone:</p>
                            <input
                                ref={pasteInputRef}
                                type="text"
                                placeholder="Click here and paste images/files (Ctrl+V)"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                onPaste={handlePaste}
                            />
                        </div>

                        {/* Drag & Drop */}
                        {/* Drag & Drop */}
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragActive
                                ? "border-gray-500 bg-muted/70 dark:bg-gray-800"
                                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                                }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => {
                                if (isReadOnly) {
                                    toast.error("Observers can only view attachments")
                                    return
                                }
                                fileInputRef.current?.click()
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx,.txt"
                                onChange={(e) => e.target.files && processFiles(e.target.files)}
                                className="hidden"
                                disabled={isReadOnly}
                            />
                            {isUploading ? (
                                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-gray-500 dark:text-gray-400" />
                            ) : (
                                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                            )}
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-200">Drag and drop files here, or click to select</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Images, PDF, DOC, DOCX, TXT</p>
                        </div>

                        {/* Add Video Link */}
                        <div className="flex gap-2 mt-3">
                            <Input
                                placeholder="Paste video URL..."
                                value={newVideoLink}
                                onChange={(e) => setNewVideoLink(e.target.value)}
                                onKeyPress={handleVideoLinkKeyPress}
                                className="focus:ring-0 focus-visible:ring-0 text-xs text-muted-foreground dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600"
                                disabled={isReadOnly}
                            />
                            <Button type="button" variant="outline" size="icon" onClick={addVideoLink} disabled={isReadOnly}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </>
                }
                {/* Quick Paste Zone */}


                {/* List of All Attachments */}
                {(attachments.length > 0 || isLoadingFiles) && (
                    <div className="mt-4 space-y-2">

                        {attachments.map((att, index) => (
                            <div
                                key={att._id || att.fileLink}
                                ref={index === attachments.length - 1 ? lastElementRef : null}
                                className="flex items-center justify-between bg-muted/70 dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 hover:bg-muted/70 dark:hover:bg-gray-800 cursor-pointer group"
                                onClick={() => handlePreview(att)}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {att.fileType === "image" ? (
                                        <img
                                            src={att.fileLink}
                                            alt={att.fileName}
                                            className="w-10 h-10 object-contain"
                                        />
                                    ) : att.fileType === "video" ? (
                                        <Play className="h-5 w-5 text-purple-500" />
                                    ) : (
                                        <div className="w-10 h-10 rounded flex items-center justify-center border">
                                            {getFileIcon(att.fileType, att.fileName)}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate text-gray-900 dark:text-gray-200">{att.fileName}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {att.fileType === "video"
                                                ? "Video Link"
                                                : att.fileType === "image"
                                                    ? "Image"
                                                    : "Document"}
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
                                    disabled={isReadOnly}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        {isLoadingFiles && (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                                <span className="ml-2 text-xs text-gray-500">Loading more files...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b flex items-center justify-between flex-shrink-0">
                        <DialogTitle className="truncate max-w-md">{previewItem?.name}</DialogTitle>
                        {previewItem && ["image", "pdf", "doc", "other"].includes(previewItem.type) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(previewItem.url, "_blank")}
                                title="Download"
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        )}
                    </DialogHeader>

                    <div className="flex-1 overflow-auto bg-muted/70 dark:bg-gray-900 p-6">
                        {previewItem?.type === "image" && (
                            <img
                                src={previewItem.url}
                                alt={previewItem.name}
                                className="max-w-full max-h-full object-contain mx-auto"
                            />
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
                                <p className="text-xs text-muted-foreground">
                                    This file type cannot be previewed in the browser.
                                </p>
                                <Button onClick={() => window.open(previewItem.url, "_blank")}>
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

