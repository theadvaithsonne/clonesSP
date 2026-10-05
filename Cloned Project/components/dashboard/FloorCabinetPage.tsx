"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AskFileDialog } from "@/components/dashboard/AskFileDialog";
import {
  FolderPlus,
  Upload,
  Search,
  MoreVertical,
  Folder,
  File,
  Download,
  Trash2,
  Edit,
  ChevronRight,
  Home,
  ExternalLink,
  Eye,
  Calendar,
  HardDrive,
  Users,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAskSupported } from "@/lib/askSupported";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { useAffiliateShare } from "@/lib/hooks/useAffiliateShare";
import { useCabinetUploadGestures } from "@/lib/hooks/useCabinetUploadGestures";
import { toPickedFiles, type PickedFile } from "@/lib/clipboard-files";
import {
  CabinetDropOverlay,
  CabinetUploadProgress,
  CabinetUploadReviewDialog,
} from "@/components/dashboard/cabinet-upload-ui";
import { Copy } from "lucide-react";
import Cookies from "js-cookie";
interface Cabinet {
  _id: string;
  name: string;
  description?: string;
  path: string;
  isRoot: boolean;
  createdAt: string;
  updatedAt: string;
  floorId?: string;
  cabinetType: "user" | "floor";
}

interface CabinetFile {
  _id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension?: string;
  createdAt: string;
  updatedAt: string;
}

interface Floor {
  id: string;
  name: string;
  level: number;
}

interface CabinetContents {
  cabinet: Cabinet;
  subCabinets: Cabinet[];
  files: CabinetFile[];
  floor: Floor;
}

interface FloorCabinetPageProps {
  floorId: string;
  floorName: string;
  onClose: () => void;
}

export default function FloorCabinetPage({
  floorId,
  floorName,
  onClose,
}: FloorCabinetPageProps) {
  const [askOpen, setAskOpen] = useState(false);
  const [askFile, setAskFile] = useState<{ id: string; name?: string } | null>(
    null
  );

  // Media preview state
  const [mediaPreview, setMediaPreview] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  const [cabinetContents, setCabinetContents] =
    useState<CabinetContents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [path, setPath] = useState<string[]>(["Home", floorName]);
  const [organizationId, setOrganizationId] = useState<string>("");

  // Dialog states
  const [createCabinetOpen, setCreateCabinetOpen] = useState(false);
  const [uploadFileOpen, setUploadFileOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newCabinetName, setNewCabinetName] = useState("");
  const [newCabinetDescription, setNewCabinetDescription] = useState("");
  const [selectedItemForRename, setSelectedItemForRename] = useState<{
    id: string;
    type: "file" | "cabinet";
    name: string;
  } | null>(null);
  const [newNameForRename, setNewNameForRename] = useState("");

  // Load floor cabinet on mount
  useEffect(() => {
    const initializeFloorCabinet = async () => {
      try {
        // Get organization ID from localStorage
        const orgId = localStorage.getItem("garage_org_id");

        if (!orgId) {
          setError(
            "No organization selected. Please select an organization first."
          );
          setLoading(false);
          return;
        }

        setOrganizationId(orgId);
        await loadFloorCabinet(orgId);
      } catch (err) {
        console.error("Error initializing floor cabinet:", err);
        setError("Failed to load floor cabinet. Please try again.");
        setLoading(false);
      }
    };

    initializeFloorCabinet();
  }, [floorId]);

  const loadFloorCabinet = async (orgId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ success: boolean; data: CabinetContents }>(
        `/cabinet/floor/${floorId}?organizationId=${orgId}`
      );

      setCabinetContents(response.data);
      setPath(["Home", response.data.floor.name]);
    } catch (error) {
      console.error("Error loading floor cabinet:", error);

      // If it's an authentication error, show a more specific message
      if (error instanceof Error && error.message.includes("401")) {
        setError("Authentication failed. Please log in again.");
      } else if (error instanceof Error && error.message.includes("403")) {
        setError(
          "Access denied. You don't have permission to access this floor's cabinet."
        );
      } else {
        setError(
          "Failed to load floor cabinet. Please check your connection and try again."
        );
      }

      toast.error("Failed to load floor cabinet");
    } finally {
      setLoading(false);
    }
  };

  const loadCabinetContents = async (cabinetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ success: boolean; data: CabinetContents }>(
        `/cabinet/${cabinetId}?organizationId=${organizationId}`
      );
      setCabinetContents(response.data);

      // Update path
      const cabinetPath = response.data.cabinet.path.split("/").filter(Boolean);
      const floorLabel =
        response.data.floor?.name || cabinetContents?.floor?.name || floorName;
      setPath(["Home", floorLabel, ...cabinetPath]);
    } catch (error) {
      console.error("Error loading cabinet contents:", error);
      setError("Failed to load cabinet contents. Please try again.");
      toast.error("Failed to load cabinet contents");
    } finally {
      setLoading(false);
    }
  };

  const createCabinet = async () => {
    if (!newCabinetName.trim()) {
      toast.error("Cabinet name is required");
      return;
    }

    if (!organizationId) {
      toast.error("No organization selected");
      return;
    }

    try {
      const response = await api<{ success: boolean; data: Cabinet }>(
        `/cabinet/floor/${floorId}/sub-cabinet?organizationId=${organizationId}`,
        {
          method: "POST",
          body: JSON.stringify({
            name: newCabinetName,
            description: newCabinetDescription,
            parentCabinetId: cabinetContents?.cabinet._id,
          }),
        }
      );

      toast.success("Cabinet created successfully");
      setCreateCabinetOpen(false);
      setNewCabinetName("");
      setNewCabinetDescription("");

      // Reload floor cabinet
      await loadFloorCabinet(organizationId);
    } catch (error) {
      console.error("Error creating cabinet:", error);
      toast.error("Failed to create cabinet");
    }
  };

  /* ─── Upload: dialog, paste and drag-and-drop all land here ─── */

  const { affiliateId, copyAffiliateLink, announceUpload } = useAffiliateShare(
    { kind: "floor", floorId },
    organizationId
  );

  const uploadOneFile = async (file: globalThis.File) => {
    // No `target` handling: the floor cabinet has no per-folder listing route,
    // so a dropped folder's files land flat in the open cabinet. The review
    // dialog says so before the upload starts.
    const cabinetId = cabinetContents?.cabinet._id;
    if (!cabinetId) throw new Error("No folder open");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("cabinetId", cabinetId);

    const response = await api<{ success: boolean; data: CabinetFile }>(
      `/cabinet/floor/${floorId}/files/upload?organizationId=${organizationId}`,
      {
        method: "POST",
        body: formData,
        headers: {
          // Don't set Content-Type, let browser set it for FormData
        },
      }
    );
    const data = response.data;
    return { _id: data?._id || "", name: data?.name || file.name };
  };

  // Files pasted, dropped or picked but not sent yet — the review dialog
  // stands between the gesture and the server.
  const [stagedFiles, setStagedFiles] = useState<PickedFile[]>([]);

  const stageFiles = (incoming: PickedFile[]) => {
    if (incoming.length === 0) return;
    setStagedFiles((prev) => [...prev, ...incoming]);
    setUploadFileOpen(true);
  };

  const {
    isDraggingFiles,
    uploadProgress,
    uploading: uploadingFile,
    uploadFiles,
    dropZoneProps,
  } = useCabinetUploadGestures({
    enabled: !!organizationId && !!cabinetContents?.cabinet._id,
    disabledReason: "Please select a cabinet to upload files",
    uploadFile: uploadOneFile,
    refresh: () => loadFloorCabinet(organizationId),
    onStageFiles: stageFiles,
    onUploaded: (files) => {
      // A rejected file stays staged so it can be retried without re-picking.
      const sent = new Set(files.map((f) => f.name));
      setStagedFiles((prev) => {
        const remaining = prev.filter(({ file }) => !sent.has(file.name));
        if (remaining.length === 0) setUploadFileOpen(false);
        return remaining;
      });
      announceUpload(files);
    },
  });


  const downloadFile = async (fileId: string, fileName: string) => {
    try {
      toast.loading("Downloading file...");
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const token = localStorage.getItem("garage_tok");

      // Use the stream endpoint to download the file
      const downloadUrl = `${baseUrl}/cabinet/files/${fileId}/stream?organizationId=${organizationId}`;

      // Fetch the file as a blob
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss();
      toast.success("File downloaded successfully");

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.dismiss();
      toast.error("Failed to download file");
    }
  };

  const openFileInNewTab = async (fileId: string) => {
    try {
      const response = await api<{
        success: boolean;
        data: { downloadUrl: string };
      }>(`/cabinet/files/${fileId}/download?organizationId=${organizationId}`);

      // Open file in new tab
      window.open(response.data.downloadUrl, "_blank");
    } catch (error) {
      console.error("Error opening file:", error);
      toast.error("Failed to open file");
    }
  };

  const openMediaPreview = async (fileId: string, fileName: string, mimeType: string) => {
    try {
      const response = await api<{
        success: boolean;
        data: { downloadUrl: string };
      }>(`/cabinet/files/${fileId}/download?organizationId=${organizationId}`);

      setMediaPreview({
        url: response.data.downloadUrl,
        type: mimeType,
        name: fileName,
      });
    } catch (error) {
      console.error("Error opening media preview:", error);
      toast.error("Failed to open media preview");
    }
  };

  const isPreviewableMedia = (mimeType: string) => {
    if (!mimeType) return false;
    if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) return true;
    // Additional video formats that might not have standard mime types
    const videoHints = ["webm", "x-matroska", "quicktime", "x-msvideo", "x-ms-wmv", "x-flv", "mp2t", "3gpp", "3gpp2", "ogg", "mpeg", "m4v"];
    return videoHints.some(hint => mimeType.toLowerCase().includes(hint));
  };

  const isImageType = (mimeType: string) => mimeType?.startsWith("image/");
  const isVideoType = (mimeType: string) => {
    if (!mimeType) return false;
    if (mimeType.startsWith("video/")) return true;
    const videoHints = ["webm", "x-matroska", "quicktime", "x-msvideo", "x-ms-wmv", "x-flv", "mp2t", "3gpp", "3gpp2", "ogg", "mpeg", "m4v"];
    return videoHints.some(hint => mimeType.toLowerCase().includes(hint));
  };

  // Component to show image/video thumbnail
  const FileThumbnail = ({ fileId, mimeType, fileName }: { fileId: string; mimeType: string; fileName: string }) => {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
      let cancelled = false;
      if (!organizationId) return;
      if (!isPreviewableMedia(mimeType)) {
        setLoading(false);
        return;
      }

      (async () => {
        try {
          const res = await api<{
            success: boolean;
            data: { downloadUrl: string };
          }>(`/cabinet/files/${fileId}/download?organizationId=${organizationId}`);
          if (!cancelled) {
            setThumbnailUrl(res.data.downloadUrl);
            setLoading(false);
          }
        } catch (e) {
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [fileId, mimeType]);

    if (loading) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="animate-pulse bg-white/20 rounded w-full h-full" />
        </div>
      );
    }

    if (error || !thumbnailUrl) {
      return (
        <span className="text-4xl">{getFileIcon(mimeType)}</span>
      );
    }

    if (isImageType(mimeType)) {
      return (
        <img
          src={thumbnailUrl}
          alt={fileName}
          className="w-full h-full object-cover rounded-lg"
          onError={() => setError(true)}
        />
      );
    }

    if (isVideoType(mimeType)) {
      return (
        <div className="relative w-full h-full">
          <video
            src={thumbnailUrl}
            className="w-full h-full object-cover rounded-lg"
            muted
            preload="metadata"
            onLoadedMetadata={(e) => {
              const video = e.target as HTMLVideoElement;
              video.currentTime = 0.1;
            }}
            onError={() => setError(true)}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
            <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
              <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-black border-b-[8px] border-b-transparent ml-1" />
            </div>
          </div>
        </div>
      );
    }

    return <span className="text-4xl">{getFileIcon(mimeType)}</span>;
  };

  const deleteFile = async (fileId: string) => {
    try {
      await api(`/cabinet/files/${fileId}?organizationId=${organizationId}`, {
        method: "DELETE",
      });

      toast.success("File deleted successfully");

      // Reload floor cabinet
      if (organizationId) {
        await loadFloorCabinet(organizationId);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    }
  };

  const renameItem = async () => {
    if (!selectedItemForRename || !newNameForRename.trim()) {
      toast.error("Please enter a valid name");
      return;
    }

    if (!organizationId) {
      toast.error("No organization selected");
      return;
    }

    try {
      const endpoint =
        selectedItemForRename.type === "file"
          ? `/cabinet/files/${selectedItemForRename.id}/rename?organizationId=${organizationId}`
          : `/cabinet/${selectedItemForRename.id}/rename?organizationId=${organizationId}`;

      await api(endpoint, {
        method: "PUT",
        body: JSON.stringify({ name: newNameForRename.trim() }),
      });

      toast.success(
        `${
          selectedItemForRename.type === "file" ? "File" : "Folder"
        } renamed successfully`
      );
      setRenameDialogOpen(false);
      setSelectedItemForRename(null);
      setNewNameForRename("");

      // Reload floor cabinet
      if (organizationId) {
        await loadFloorCabinet(organizationId);
      }
    } catch (error) {
      console.error("Error renaming item:", error);
      toast.error("Failed to rename item");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.startsWith("video/")) return "🎥";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("word")) return "📝";
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
      return "📊";
    if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
      return "📽️";
    return "📄";
  };

  return (
    <div
      className="fixed inset-0 bg-[#0b0b0d] z-50 flex flex-col pt-14 md:pt-0"
      {...dropZoneProps}
    >
      <CabinetDropOverlay
        visible={isDraggingFiles}
        targetName={cabinetContents?.cabinet.name || floorName || "this floor"}
      />
      <CabinetUploadProgress progress={uploadProgress} />
      {/* Modern Header */}
      <div className="px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3">
        {/* Top Row - Breadcrumb and Close */}
        <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-1 flex-wrap max-w-full overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 transition-colors">
              <Users className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="text-xs font-medium text-white/90 whitespace-nowrap">
                Floor Cabinet
              </span>
            </div>
            {path.map((segment, index) => (
              <div key={index} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="h-3 w-3 text-white/30" />
                <button
                  className={cn(
                    "text-xs font-medium px-1.5 py-0.5 rounded transition-all whitespace-nowrap",
                    index === 0
                      ? "text-blue-400 hover:bg-white/5 cursor-pointer"
                      : "text-white/60 cursor-default"
                  )}
                  onClick={() => {
                    if (index === 0 && organizationId) {
                      loadFloorCabinet(organizationId);
                    }
                  }}
                  disabled={index !== 0}
                >
                  {segment}
                </button>
              </div>
            ))}
          </div>

          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-7 w-7 p-0 shrink-0 rounded-lg"
          >
            ✕
          </Button>
        </div>

        {/* Bottom Row - Search and Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            <Input
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 h-8 w-full bg-white/5 backdrop-blur-sm border-white/10 text-white text-xs placeholder:text-white/40 focus:bg-white/10 focus:border-blue-400/50 transition-all rounded-lg"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* New Folder */}
            <Dialog
              open={createCabinetOpen}
              onOpenChange={setCreateCabinetOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 sm:px-3 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 hover:text-white transition-all rounded-lg"
                >
                  <FolderPlus className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">New Folder</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Folder</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Folder Name</label>
                    <Input
                      value={newCabinetName}
                      onChange={(e) => setNewCabinetName(e.target.value)}
                      placeholder="Enter folder name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Description (Optional)
                    </label>
                    <Input
                      value={newCabinetDescription}
                      onChange={(e) => setNewCabinetDescription(e.target.value)}
                      placeholder="Enter description"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setCreateCabinetOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={createCabinet}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Upload Files — the picker stages, the review dialog sends */}
            <Button
              size="sm"
              onClick={() => setUploadFileOpen(true)}
              className="h-8 px-3 text-xs bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-sm transition-all rounded-lg"
            >
              <Upload className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Upload Files</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Subtle Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Content */}
      <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto bg-transparent">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-blue-400"></div>
              <p className="text-white/80">Loading floor cabinet...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <p className="text-lg font-medium text-red-400 mb-2">Error</p>
              <p className="text-sm mb-4 text-white/80">{error}</p>
              <Button
                onClick={() => {
                  if (organizationId) {
                    loadFloorCabinet(organizationId);
                  } else {
                    window.location.reload();
                  }
                }}
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {/* Folders */}
            {cabinetContents?.subCabinets
              .filter(
                (cabinet) =>
                  searchQuery === "" ||
                  cabinet.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((cabinet) => (
                <div
                  key={cabinet._id}
                  className="group relative bg-white/10 backdrop-blur-sm rounded-xl py-2 px-3 hover:shadow-lg hover:shadow-blue-400/20 hover:scale-105 hover:z-10 transition-all duration-200 cursor-pointer border border-white/20 hover:border-blue-400/50 h-46 w-46 flex flex-col gap-2"
                  onClick={() => loadCabinetContents(cabinet._id)}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-sm">
                      <Folder className="h-4 w-4 text-blue-400" />
                    </span>
                    <p className="font-medium text-white text-sm truncate group-hover:text-blue-400 transition-colors">
                      {cabinet.name}
                    </p>
                  </div>
                  <div className="relative flex w-full h-full items-center justify-center bg-[black]/60 rounded-lg">
                    <div className="relative">
                      <Folder className="h-8 w-8 text-blue-400" />
                      <div className="absolute -top-1 -right-1 bg-blue-400/20 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="h-3 w-3 text-blue-400" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between gap-1">
                    <div className="flex flex-col items-start">
                      <p className="text-[10px] text-white/50">
                        <Calendar className="h-2 w-2 inline mr-1" />
                        {new Date(cabinet.createdAt).toLocaleDateString()} {""}
                      </p>
                      <p className="text-[10px] text-white/50">
                        <Clock className="h-2 w-2 inline mr-1" />
                        {new Date(cabinet.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <p className="text-[10px] text-white/50">
                      <Folder className="h-2 w-2 inline mr-1" />
                      Folder
                    </p>
                  </div>
                </div>
              ))}

            {/* Files */}
            {cabinetContents?.files
              .filter(
                (file) =>
                  searchQuery === "" ||
                  file.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((file) => (
                <div
                  key={file._id}
                  className={cn(
                    "group relative bg-white/10 backdrop-blur-sm rounded-xl py-2 px-3 hover:shadow-lg hover:shadow-blue-400/20 hover:scale-105 hover:z-10 transition-all duration-200 border border-white/20 hover:border-blue-400/50 h-46 w-46 flex flex-col gap-2",
                    isPreviewableMedia(file.mimeType) && "cursor-pointer"
                  )}
                  onClick={() => {
                    if (isPreviewableMedia(file.mimeType)) {
                      openMediaPreview(file._id, file.name || file.originalName, file.mimeType);
                    }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-sm">
                      {getFileIcon(file.mimeType)}
                    </span>
                    <p className="font-medium text-white text-sm truncate group-hover:text-blue-400 transition-colors">
                      {file.name}
                    </p>
                  </div>
                  <div className="relative flex w-full h-full items-center justify-center bg-[black]/60 rounded-lg overflow-hidden">
                    {isPreviewableMedia(file.mimeType) ? (
                      <FileThumbnail
                        fileId={file._id}
                        mimeType={file.mimeType}
                        fileName={file.name || file.originalName}
                      />
                    ) : (
                      <span className="text-4xl">
                        {getFileIcon(file.mimeType)}
                      </span>
                    )}
                    {!isPreviewableMedia(file.mimeType) && (
                      <div className="absolute -top-1 -right-1 bg-blue-400/20 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="h-3 w-3 text-blue-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between gap-1">
                    <div className="flex flex-col items-start">
                      <p className="text-[10px] text-white/50">
                        <Calendar className="h-2 w-2 inline mr-1" />
                        {new Date(file.createdAt).toLocaleDateString()} {""}
                      </p>
                      <p className="text-[10px] text-white/50">
                        <Clock className="h-2 w-2 inline mr-1" />
                        {new Date(file.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <p className="text-[10px] text-white/50">
                      <File className="h-2 w-2 inline mr-1" />
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all duration-200 p-1 h-6 w-6"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-white/10 backdrop-blur-sm border-white/20"
                    >
                      {isPreviewableMedia(file.mimeType) && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openMediaPreview(file._id, file.name || file.originalName, file.mimeType);
                          }}
                          className="hover:bg-purple-500/20 focus:bg-purple-500/20 focus:outline-none"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          openFileInNewTab(file._id);
                        }}
                        className="hover:bg-blue-500/20 focus:bg-blue-500/20 focus:outline-none"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(file._id, file.originalName);
                        }}
                        className="hover:bg-green-500/20 focus:bg-green-500/20 focus:outline-none"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          void copyAffiliateLink(
                            file._id,
                            file.name || file.originalName
                          );
                        }}
                        className="hover:bg-blue-500/20 focus:bg-blue-500/20 focus:outline-none"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {affiliateId
                          ? "Copy Affiliate Share Link"
                          : "Copy Share Link"}
                      </DropdownMenuItem>
                      {isAskSupported(file.mimeType) && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setAskFile({
                              id: file._id,
                              name: file.name || file.originalName,
                            });
                            setAskOpen(true);
                          }}
                          className="hover:bg-blue-500/20 focus:bg-blue-500/20 focus:outline-none"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ask about this file
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemForRename({
                            id: file._id,
                            type: "file",
                            name: file.name,
                          });
                          setNewNameForRename(file.name);
                          setRenameDialogOpen(true);
                        }}
                        className="hover:bg-yellow-500/20 focus:bg-yellow-500/20 focus:outline-none"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFile(file._id);
                        }}
                        className="text-red-400 hover:bg-red-500/20 focus:bg-red-500/20 focus:outline-none"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
          </div>
        )}

        {/* Empty state */}
        {!loading &&
          cabinetContents &&
          cabinetContents.subCabinets.length === 0 &&
          cabinetContents.files.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[500px] text-white/60 px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
                <div className="relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                  <Users className="h-16 w-16 text-white/40" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 text-center">
                Floor Cabinet is Empty
              </h3>
              <p className="text-white/50 mb-6 max-w-sm text-center text-sm">
                This floor's shared cabinet is empty. Upload files or create new folders to start collaborating with your floor members.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  onClick={() => setUploadFileOpen(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm h-10 px-6 shadow-lg shadow-blue-500/20"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCreateCabinetOpen(true)}
                  className="bg-white/5 hover:bg-white/10 border-white/10 text-white hover:text-white text-sm h-10 px-6"
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Create Folder
                </Button>
              </div>
            </div>
          )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-gradient-to-br backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <Edit className="h-5 w-5 text-purple-400" />
              Rename {selectedItemForRename?.type === "file" ? "File" : "Folder"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">New Name</label>
              <Input
                value={newNameForRename}
                onChange={(e) => setNewNameForRename(e.target.value)}
                placeholder={`Enter new ${
                  selectedItemForRename?.type === "file" ? "file" : "folder"
                } name`}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400/50 focus:ring-purple-400/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    renameItem();
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setRenameDialogOpen(false);
                  setSelectedItemForRename(null);
                  setNewNameForRename("");
                }}
                className="border-white/20 text-white hover:bg-white/10 hover:border-white/30"
              >
                Cancel
              </Button>
              <Button
                onClick={renameItem}
                disabled={!newNameForRename.trim()}
                className="bg-gradient-to-r from-purple-400 to-pink-500 hover:from-purple-500 hover:to-pink-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Edit className="h-4 w-4 mr-2" />
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AskFileDialog
        open={askOpen}
        onOpenChange={setAskOpen}
        fileId={askFile?.id || null}
        fileName={askFile?.name}
      />

      {/* Paste, drop and the picker all stage here first */}
      <CabinetUploadReviewDialog
        open={uploadFileOpen}
        onOpenChange={(open) => {
          setUploadFileOpen(open);
          if (!open) setStagedFiles([]);
        }}
        files={stagedFiles}
        destination={cabinetContents?.cabinet.name || "this cabinet"}
        onRemove={(index) =>
          setStagedFiles((prev) => prev.filter((_, i) => i !== index))
        }
        onClear={() => setStagedFiles([])}
        onConfirm={() => {
          if (stagedFiles.length > 0) void uploadFiles(stagedFiles);
        }}
        onAddFiles={(picked) => stageFiles(toPickedFiles(picked))}
        uploading={uploadingFile}
        progress={uploadProgress}
        recreatesFolders={false}
      />

      {/* Media Preview Modal */}
      <MediaPreviewModal
        media={mediaPreview}
        onClose={() => setMediaPreview(null)}
      />
    </div>
  );
}
