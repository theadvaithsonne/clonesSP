"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Upload,
  Search,
  FileText,
  ImageIcon,
  Video,
  MoreHorizontal,
  Download,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  File,
  Eye,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Employee } from "../types/kanban"

type FileType = "document" | "image" | "video"

interface FileItem {
  id: string
  name: string
  type: FileType
  size: string
  author: {
    name: string
    avatar: string
  }
  date: string
  fileLink: string
}

interface Fileprops {
  taskRoomId: string
  currentUser: string
  employees: Employee[]
}

export function FilesView({ taskRoomId, currentUser, employees }: Fileprops) {
  const [searchQuery, setSearchQuery] = useState("")
  const [files, setFiles] = useState<FileItem[]>([])
  const [folderName] = useState("Uploads")
  const [isUploading, setIsUploading] = useState(false)
  const [selectedType, setSelectedType] = useState<FileType | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [nextPage, setNextPage] = useState<number | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(false)

  // Preview Dialog
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<
    | {
      name: string
      url: string
      type: "image" | "video" | "google" | "other"
    }
    | null
  >(null)

  // === Google Docs Viewer URL ===
  const googleViewerUrl = (fileUrl: string) =>
    `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`

  // === Employee Helpers ===
  const getEmployeeName = (id: string): string => {
    const employee = employees?.find((emp) => emp.id === id)
    return employee ? employee.name : "Unknown User"
  }

  const getInitials = (name: string): string => {
    const fullName = getEmployeeName(name).trim()
    return fullName ? fullName.charAt(0).toUpperCase() : "U"
  }

  // === File Type Inference ===
  const getSimplifiedFileType = (mimeType: string): FileType => {
    if (!mimeType) return "document"
    const type = mimeType.toLowerCase()
    if (type.startsWith("image/")) return "image"
    if (type.startsWith("video/")) return "video"
    return "document"
  }

  // === Fetch Files with Pagination ===
  useEffect(() => {
    const fetchFiles = async () => {
      if (!taskRoomId) return

      setIsLoadingPage(true)
      try {
        const response = await fetch(
          `https://uatapi.garage.app/taskroom/v1/files?roomId=${taskRoomId}&size=50&page=${page}`
        )
        const result = await response.json()

        if (!result.status || !result.data) {
          throw new Error(result.message || "Failed to fetch files")
        }

        const meta = result.metadata || {}
        setTotalPages(meta.totalPages ?? 1)
        setNextPage(meta.nextPage ?? null)
        if (meta.currentPage !== page) {
          setPage(meta.currentPage ?? page)
        }

        const fetchedFiles: FileItem[] = result.data.map((file: any) => {
          let type: FileType = "document"

          if (["document", "image", "video"].includes(file.fileType)) {
            type = file.fileType as FileType
          } else {
            const ext = file.fileName.split(".").pop()?.toLowerCase()
            if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) {
              type = "image"
            } else if (["mp4", "webm", "ogg", "mov", "avi"].includes(ext || "")) {
              type = "video"
            }
          }

          return {
            id: file._id,
            name: file.fileName,
            type,
            size: "Unknown",
            author: {
              name: file.userId,
              avatar: file.userId.slice(0, 2).toUpperCase(),
            },
            date: new Date(file.createdAt).toISOString().split("T")[0],
            fileLink: file.fileLink,
          }
        })

        setFiles(fetchedFiles)
      } catch (error) {
        console.error("Error fetching files:", error)
        toast.error("Failed to load files. Please try again.")
      } finally {
        setIsLoadingPage(false)
      }
    }

    fetchFiles()
  }, [taskRoomId, page])

  // === Filter Files ===
  const filteredFiles = files.filter(
    (file) =>
      (!selectedType || file.type === selectedType) &&
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getFilesByType = (type: FileType) => files.filter((f) => f.type === type)

  // === UI Helpers ===
  const getFileIcon = (type: FileType) => {
    switch (type) {
      case "document":
        return <FileText className="h-5 w-5 text-blue-500" />
      case "image":
        return <ImageIcon className="h-5 w-5 text-green-500" />
      case "video":
        return <Video className="h-5 w-5 text-purple-500" />
    }
  }

  const getTypeColor = (type: FileType) => {
    switch (type) {
      case "document":
        return "bg-blue-500/10 border-blue-500/20"
      case "image":
        return "bg-green-500/10 border-green-500/20"
      case "video":
        return "bg-purple-500/10 border-purple-500/20"
    }
  }

  const totalSize = files.reduce((acc, file) => {
    const match = file.size.match(/([\d.]+)\s*MB/i)
    const sizeMB = match ? parseFloat(match[1]) : 0
    return acc + sizeMB
  }, 0)

  // === Upload Handlers ===
  const handleFileUpload = () => fileInputRef.current?.click()

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", folderName)

    try {
      const uploadResponse = await fetch(
        "https://uatapi.garage.app/api/s3upload/single",
        { method: "POST", body: formData }
      )

      if (!uploadResponse.ok) throw new Error("Upload failed")

      const uploadResult = await uploadResponse.json()
      if (!uploadResult.success || !uploadResult.data)
        throw new Error("Invalid upload response")

      const fileType = getSimplifiedFileType(file.type)

      const payload = {
        roomId: taskRoomId,
        userId: currentUser,
        fileLink: uploadResult.data.url,
        fileName: uploadResult.data.fileName,
        fileType,
        comment: "Uploaded via FilesView",
      }

      const recordRes = await fetch("https://uatapi.garage.app/taskroom/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!recordRes.ok) throw new Error("Failed to record file")

      const recordData = await recordRes.json()

      const sizeStr =
        uploadResult.data.size && uploadResult.data.size > 0
          ? `${(uploadResult.data.size / 1024 / 1024).toFixed(2)} MB`
          : "Unknown"

      const newFile: FileItem = {
        id: recordData.data._id || Date.now().toString(),
        name: uploadResult.data.fileName,
        type: fileType,
        size: sizeStr,
        author: { name: currentUser, avatar: currentUser.slice(0, 2).toUpperCase() },
        date: new Date().toISOString().split("T")[0],
        fileLink: uploadResult.data.url,
      }

      if (page === 1) {
        setFiles((prev) => [newFile, ...prev])
      }

      toast.success(`"${newFile.name}" uploaded successfully!`)
    } catch (err) {
      console.error("Upload error:", err)
      toast.error("Failed to upload file. Please try again.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // === Preview Logic ===
  const openPreview = (file: FileItem) => {
    let previewType: "image" | "video" | "google" | "other" = "other"

    if (file.type === "image") {
      previewType = "image"
    } else if (file.type === "video") {
      previewType = "video"
    } else {
      previewType = "google" // All documents via Google Viewer
    }

    setPreviewItem({
      name: file.name,
      url: file.fileLink,
      type: previewType,
    })
    setPreviewOpen(true)
  }
  const handleDownload = async (url: string, filename: string) => {

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

  // === Download & Delete ===
  const handleDownloadFile = (file: FileItem) => {
    try {
      window.open(file.fileLink, "_blank")
      toast.success(`Opening "${file.name}"`)
    } catch {
      toast.error("Failed to open file.")
    }
  }

  const openDeleteDialog = (file: FileItem) => {
    setFileToDelete(file)
    setDeleteDialogOpen(true)
  }

  const handleDeleteFile = async () => {
    if (!fileToDelete) return

    setIsDeleting(fileToDelete.id)
    try {
      const response = await fetch(
        `https://uatapi.garage.app/taskroom/v1/files/${fileToDelete.id}`,
        { method: "DELETE", headers: { "Content-Type": "application/json" } }
      )

      if (!response.ok) throw new Error("Delete failed")

      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id))
      toast.success(`"${fileToDelete.name}" deleted.`)
    } catch {
      toast.error("Failed to delete file.")
    } finally {
      setIsDeleting(null)
      setDeleteDialogOpen(false)
      setFileToDelete(null)
    }
  }

  // === Pagination Logic ===
  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page || isLoadingPage) return
    setPage(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const renderPageNumbers = () => {
    const pages: (number | string)[] = []

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1, 2)
      if (page > 4) pages.push("...")
      const start = Math.max(3, page - 1)
      const end = Math.min(totalPages - 2, page + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (page < totalPages - 3) pages.push("...")
      pages.push(totalPages - 1, totalPages)
    }

    return pages.map((p, idx) =>
      p === "..." ? (
        <span key={idx} className="px-2 text-muted-foreground">
          ...
        </span>
      ) : (
        <Button
          key={p}
          variant={page === p ? "default" : "outline"}
          size="sm"
          className="w-9 h-9 p-0"
          onClick={() => goToPage(p as number)}
          disabled={isLoadingPage}
        >
          {p}
        </Button>
      )
    )
  }
  console.log("previewItemz", filteredFiles)
  return (
    <div className="h-full flex flex-col bg-[#0e0e12]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#e5e7eb29] mb-6 bg-[#0e0e12]">
        <div>
          <h1 className="text-xl font-semibold text-white">Files & Documents</h1>
          <p className="text-sm text-gray-400">
            {files.length} files • {totalSize.toFixed(1)} MB (page {page} of {totalPages})
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500 focus-visible:ring-offset-0 focus-visible:ring-gray-600"
              disabled={isUploading || isLoadingPage}
            />
          </div>
          <Button
            className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 font-semibold"
            onClick={handleFileUpload}
            disabled={isUploading || isLoadingPage}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Files
              </>
            )}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.pptx"
          />
        </div>
      </div>

      {/* File Type Filters */}
      <div className="grid grid-cols-3 gap-4 px-6 pb-6">
        {(["document", "image", "video"] as FileType[]).map((type) => (
          <div
            key={type}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedType === type ? "ring-2 ring-offset-2" : ""
              } ${getTypeColor(type)} ${selectedType === type
                ? type === "document"
                  ? "ring-blue-500"
                  : type === "image"
                    ? "ring-green-500"
                    : "ring-purple-500"
                : ""
              }`}
            onClick={() => setSelectedType(selectedType === type ? null : type)}
          >
            <div className="flex items-center gap-3 mb-2">
              {getFileIcon(type)}
              <span className="font-medium capitalize text-white">{type}s</span>
            </div>
            <p className="text-sm text-gray-400">
              {getFilesByType(type).length} files
            </p>
          </div>
        ))}
      </div>

      {/* Files Grid */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoadingPage ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFiles.length === 0 ? (
              <p className="col-span-full text-center text-gray-500 py-8">
                {searchQuery || selectedType
                  ? "No files match your search."
                  : "No files uploaded yet."}
              </p>
            ) : (
              filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={`p-4 rounded-lg border ${getTypeColor(
                    file.type
                  )} hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(file.type)}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate text-white">{file.name}</h3>
                        <p className="text-xs text-gray-500">
                          {file.size !== "Unknown" ? `${file.size} • ` : ""}
                          {file.type}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Preview: Image, Video, or any document */}
                        {(file.type === "image" || file.type === "video" || file.type === "document") && (
                          <DropdownMenuItem onClick={() => openPreview(file)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem onClick={() => handleDownload(file?.fileLink, file?.name)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => openDeleteDialog(file)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-gray-600 text-white">
                        {getInitials(file.author.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-gray-500 truncate">
                      {getEmployeeName(file.author.name)} • {file.date}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-[#e5e7eb29] bg-[#0e0e12]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page - 1)}
            disabled={page === 1 || isLoadingPage}
            className="border-gray-700 text-gray-400 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {renderPageNumbers()}

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={!nextPage || isLoadingPage}
            className="border-gray-700 text-gray-400 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[#0e0e12] border-[#e5e7eb29] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Delete File</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete <strong className="text-white">{fileToDelete?.name}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setFileToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFile}
              disabled={!!isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog with Google Docs Viewer */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden flex flex-col bg-[#0e0e12] border-[#e5e7eb29]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e5e7eb29] flex items-center justify-between flex-shrink-0">
            <DialogTitle className="truncate max-w-md text-white">{previewItem?.name}</DialogTitle>
            {previewItem && ["image", "video", "google"].includes(previewItem.type) && (
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

          <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
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

            {previewItem?.type === "google" && (
              <iframe
                src={googleViewerUrl(previewItem.url)}
                title="Document Preview"
                className="w-full h-full min-h-[80vh] border-0 rounded-lg"
                allowFullScreen
              />
            )}

            {previewItem?.type === "other" && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <File className="h-16 w-16 text-gray-700" />
                <p className="text-lg font-medium text-white">Preview not available</p>
                <p className="text-sm text-gray-500">
                  This file type cannot be previewed in the browser.
                </p>
                <Button onClick={() => window.open(previewItem.url, "_blank")} className="bg-white text-black hover:bg-gray-200 font-semibold">
                  <Download className="mr-2 h-4 w-4" /> Download File
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}