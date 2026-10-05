"use client";

import React, { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Search,
  MoreVertical,
  Folder,
  File,
  Download,
  Trash2,
  Edit,
  ChevronRight,
  ExternalLink,
  Eye,
  Calendar,
  Clock,
  FileText,
  Loader2,
  Star,
  Users2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAskSupported } from "@/lib/askSupported";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useAffiliateShare } from "@/lib/hooks/useAffiliateShare";
import { Copy } from "lucide-react";

interface Cabinet {
  _id: string;
  name: string;
  description?: string;
  path: string;
  isRoot: boolean;
  createdAt: string;
  updatedAt: string;
  organization: string;
  cabinetType: "organization";
}

interface TranscriptionData {
  transcription: string;
  summary: string[];
  actionItems: string[];
  generatedAt: string;
  model: string;
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
  metadata?: {
    transcription?: TranscriptionData;
  };
}

interface CabinetContents {
  cabinet: Cabinet;
  subCabinets: Cabinet[];
  files: CabinetFile[];
  storageDetails?: {
    photos: number;
    videos: number;
    documents: number;
    totalUsed: number;
    storageLimit: number;
  };
}

// Helper component to preview image files inside table rows
function FileImagePreview({
  fileId,
  organizationId,
  mimeType,
  fallbackBgColor,
  fallbackText,
}: {
  fileId: string;
  organizationId: string;
  mimeType: string;
  fallbackBgColor: string;
  fallbackText: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await api<{
          success: boolean;
          data: { downloadUrl: string };
        }>(
          `/cabinet/organization/files/${fileId}/download?organizationId=${organizationId}`
        );
        if (!cancelled) {
          setImageUrl(res.data.downloadUrl);
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
  }, [fileId, organizationId]);

  if (loading) {
    return (
      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
        <Loader2 className="h-4.5 w-4.5 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-extrabold text-white uppercase font-sans shrink-0"
        style={{ backgroundColor: fallbackBgColor }}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt="Preview"
      className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
    />
  );
}

interface OrganizationCabinetPageProps {
  onClose?: () => void;
}

type CategoryTab = "all" | "documents" | "photos" | "videos" | "starred";

export default function OrganizationCabinetPage({ onClose }: OrganizationCabinetPageProps) {
  const { userData, amIFounder } = useAmIFounder();
  const orgName = userData.orgName;

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [starredIds, setStarredIds] = useState<string[]>([]);

  // Cabinet state
  const [cabinetContents, setCabinetContents] = useState<CabinetContents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>(["Home"]);
  const [organizationId, setOrganizationId] = useState<string>("");
  const cabinetHistoryRef = useRef<Record<string, string>>({});

  // Dialogs
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedItemForRename, setSelectedItemForRename] = useState<{
    id: string;
    type: "file" | "cabinet";
    name: string;
  } | null>(null);
  const [newNameForRename, setNewNameForRename] = useState("");

  // AI & Media Preview
  const [askOpen, setAskOpen] = useState(false);
  const [askFile, setAskFile] = useState<{ id: string; name?: string } | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  // Transcription
  const [transcribingFileId, setTranscribingFileId] = useState<string | null>(null);
  const [transcriptModal, setTranscriptModal] = useState<{
    fileName: string;
    data: TranscriptionData;
  } | null>(null);

  // Load Starred files from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("org_starred_files");
      if (stored) {
        setStarredIds(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load starred files", e);
    }
  }, []);

  // Save Starred files to local storage
  const toggleStar = (fileId: string) => {
    try {
      let updated: string[];
      if (starredIds.includes(fileId)) {
        updated = starredIds.filter((id) => id !== fileId);
        toast.success("Removed from Starred");
      } else {
        updated = [...starredIds, fileId];
        toast.success("Added to Starred");
      }
      setStarredIds(updated);
      localStorage.setItem("org_starred_files", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to star file", e);
    }
  };

  // Initialize Cabinet
  useEffect(() => {
    const initializeCabinet = async () => {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) {
          setError("No organization selected. Please select an organization first.");
          setLoading(false);
          return;
        }
        setOrganizationId(orgId);
        await loadOrganizationCabinet(orgId);
      } catch (err) {
        console.error("Error initializing cabinet:", err);
        setError("Failed to load cabinet. Please try again.");
        setLoading(false);
      }
    };
    initializeCabinet();
  }, []);

  const loadOrganizationCabinet = async (orgId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ success: boolean; data: CabinetContents }>(
        `/cabinet/organization?organizationId=${orgId}`
      );
      setCabinetContents(response.data);
      setPath(["Home"]);
      
      // Store the root cabinet ID in the history map
      cabinetHistoryRef.current["/organization"] = response.data.cabinet._id;
      
      // Store all sub-cabinets of root in history
      response.data.subCabinets.forEach((sub) => {
        cabinetHistoryRef.current[sub.path] = sub._id;
      });
    } catch (error) {
      console.error("Error loading organization cabinet:", error);
      setError("Failed to load organization cabinet. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ─── Affiliate sharing ─── */

  // This cabinet is browse-only: files are searched, previewed, downloaded and
  // queried here, never added. Uploading is founder-only and lives in
  // FounderCabinetPage, so there are no paste, drop or picker gestures on this
  // page to stage a file the server would refuse anyway.
  const { affiliateId, copyAffiliateLink } = useAffiliateShare(
    { kind: "organization" },
    organizationId
  );

  const loadCabinetContents = async (cabinetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ success: boolean; data: CabinetContents }>(
        `/cabinet/organization/${cabinetId}?organizationId=${organizationId}`
      );
      setCabinetContents(response.data);

      const cabinetPath = response.data.cabinet.path.split("/").filter(Boolean);
      // Filter out "organization" from display list
      const displayFolders = cabinetPath.filter((x) => x !== "organization");
      setPath(["Home", ...displayFolders]);

      // Save the current cabinet's path to ID mapping
      cabinetHistoryRef.current[response.data.cabinet.path] = response.data.cabinet._id;

      // Save all sub-cabinets of the current cabinet to ID mapping
      response.data.subCabinets.forEach((sub) => {
        cabinetHistoryRef.current[sub.path] = sub._id;
      });
    } catch (error) {
      console.error("Error loading cabinet contents:", error);
      setError("Failed to load folder contents.");
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (fileId: string, fileName: string) => {
    try {
      toast.loading("Downloading file...");
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const token = localStorage.getItem("garage_tok");
      const downloadUrl = `${baseUrl}/cabinet/organization/files/${fileId}/stream?organizationId=${organizationId}`;

      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Download request failed");

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
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download error:", error);
      toast.dismiss();
      toast.error("Failed to download file");
    }
  };

  const openFileInNewTab = async (fileId: string) => {
    try {
      const response = await api<{
        success: boolean;
        data: { downloadUrl: string };
      }>(
        `/cabinet/organization/files/${fileId}/download?organizationId=${organizationId}`
      );
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
      }>(
        `/cabinet/organization/files/${fileId}/download?organizationId=${organizationId}`
      );
      setMediaPreview({
        url: response.data.downloadUrl,
        type: mimeType,
        name: fileName,
      });
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Failed to load preview");
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      await api(
        `/cabinet/organization/files/${fileId}?organizationId=${organizationId}`,
        { method: "DELETE" }
      );
      toast.success("File deleted successfully");
      if (cabinetContents?.cabinet._id) {
        if (cabinetContents.cabinet.isRoot) {
          await loadOrganizationCabinet(organizationId);
        } else {
          await loadCabinetContents(cabinetContents.cabinet._id);
        }
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    }
  };

  const renameItem = async () => {
    if (!selectedItemForRename || !newNameForRename.trim()) {
      toast.error("Please enter a valid name");
      return;
    }
    try {
      const endpoint =
        selectedItemForRename.type === "file"
          ? `/cabinet/organization/files/${selectedItemForRename.id}/rename?organizationId=${organizationId}`
          : `/cabinet/organization/${selectedItemForRename.id}/rename?organizationId=${organizationId}`;

      await api(endpoint, {
        method: "PUT",
        body: JSON.stringify({ name: newNameForRename.trim() }),
      });

      toast.success("Renamed successfully");
      setRenameDialogOpen(false);
      setSelectedItemForRename(null);
      setNewNameForRename("");

      if (cabinetContents?.cabinet._id) {
        if (cabinetContents.cabinet.isRoot) {
          await loadOrganizationCabinet(organizationId);
        } else {
          await loadCabinetContents(cabinetContents.cabinet._id);
        }
      }
    } catch (error) {
      console.error("Rename error:", error);
      toast.error("Failed to rename");
    }
  };

  const transcribeRecording = async (file: CabinetFile) => {
    if (file.metadata?.transcription) {
      setTranscriptModal({
        fileName: file.name || file.originalName,
        data: file.metadata.transcription,
      });
      return;
    }
    setTranscribingFileId(file._id);
    try {
      const response = await api<{ success: boolean; data: TranscriptionData }>(
        `/cabinet/organization/files/${file._id}/transcribe`,
        { method: "POST" }
      );
      setCabinetContents((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          files: prev.files.map((f) =>
            f._id === file._id
              ? { ...f, metadata: { ...f.metadata, transcription: response.data } }
              : f
          ),
        };
      });
      setTranscriptModal({
        fileName: file.name || file.originalName,
        data: response.data,
      });
      toast.success("Transcription complete!");
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Failed to transcribe. Please try again.");
    } finally {
      setTranscribingFileId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  const getFileBadgeInfo = (mimeType: string, name: string) => {
    const ext = name.split(".").pop()?.toUpperCase() || "";
    if (ext === "PDF" || mimeType.includes("pdf")) return { text: "PDF", bgColor: "#ff4d4f" };
    if (ext === "DOC" || ext === "DOCX" || mimeType.includes("word")) return { text: "DOC", bgColor: "#1890ff" };
    if (ext === "XLS" || ext === "XLSX" || mimeType.includes("excel") || mimeType.includes("spreadsheet")) return { text: "XLS", bgColor: "#52c41a" };
    if (ext === "PPT" || ext === "PPTX" || mimeType.includes("presentation")) return { text: "PPT", bgColor: "#ff4d4f" };
    if (ext === "CSV" || mimeType.includes("csv")) return { text: "CSV", bgColor: "#52c41a" };
    if (ext === "TXT" || mimeType.includes("text/plain")) return { text: "TXT", bgColor: "#fa8c16" };
    return { text: ext || "FILE", bgColor: "#595959" };
  };

  const isPreviewableMedia = (mimeType: string) => {
    if (!mimeType) return false;
    return mimeType.startsWith("image/") || mimeType.startsWith("video/");
  };

  // Tab Filtering logic
  const getFilteredItems = () => {
    if (!cabinetContents) return { subCabinets: [], files: [] };

    // Search query filter
    const matchesSearch = (name: string) =>
      searchQuery === "" || name.toLowerCase().includes(searchQuery.toLowerCase());

    const folders = cabinetContents.subCabinets.filter((c) => matchesSearch(c.name));
    const files = cabinetContents.files.filter((f) => matchesSearch(f.name));

    if (activeTab === "all") {
      return { subCabinets: folders, files };
    }

    if (activeTab === "documents") {
      const documentExtensions = [
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
        "csv",
        "txt",
      ];
      const docFiles = files.filter((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        return (
          documentExtensions.includes(ext) ||
          f.mimeType.includes("pdf") ||
          f.mimeType.includes("word") ||
          f.mimeType.includes("excel") ||
          f.mimeType.includes("spreadsheet") ||
          f.mimeType.includes("presentation") ||
          f.mimeType.includes("csv")
        );
      });
      return { subCabinets: [], files: docFiles };
    }

    if (activeTab === "photos") {
      const imgFiles = files.filter((f) => f.mimeType.startsWith("image/"));
      return { subCabinets: [], files: imgFiles };
    }

    if (activeTab === "videos") {
      const vidFiles = files.filter((f) => f.mimeType.startsWith("video/"));
      return { subCabinets: [], files: vidFiles };
    }

    if (activeTab === "starred") {
      const starredFiles = files.filter((f) => starredIds.includes(f._id));
      return { subCabinets: [], files: starredFiles };
    }

    return { subCabinets: [], files: [] };
  };

  const { subCabinets: filteredFolders, files: filteredFiles } = getFilteredItems();



  return (
    <div className="relative flex flex-col h-full bg-[#0c0c0e] text-white overflow-hidden">
      {/* Top Navbar Header */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] bg-[#0c0c0e]/95 sticky top-0 z-40">
        {/* Breadcrumbs Top Left */}
        <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium select-none">
          <button
            onClick={() => {
              if (organizationId) loadOrganizationCabinet(organizationId);
            }}
            className="flex items-center gap-1.5 px-4.5 py-1.5 bg-[#e8f0fe] border-2 border-[#1a73e8] text-[#1a73e8] hover:bg-[#d2e3fc] text-xs font-bold rounded-full transition-all shrink-0 cursor-pointer"
          >
            <User className="h-4 w-4 stroke-[2.5]" />
            <span>{orgName || "Design Collective"}'s Cabinet</span>
          </button>
          {path.slice(1).map((segment, idx) => {
            const isLast = idx === path.slice(1).length - 1;
            const folderSegments = path.slice(1, 1 + idx + 1);
            const pathKey = "/organization/" + folderSegments.join("/");

            const handleBreadcrumbClick = () => {
              if (isLast) return;
              const targetCabinetId = cabinetHistoryRef.current[pathKey];
              if (targetCabinetId) {
                loadCabinetContents(targetCabinetId);
              } else {
                console.error("Cabinet ID not found in history for path key:", pathKey);
                if (organizationId) loadOrganizationCabinet(organizationId);
              }
            };

            return (
              <React.Fragment key={idx}>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                <button
                  onClick={handleBreadcrumbClick}
                  disabled={isLast}
                  className={cn(
                    "text-xs truncate max-w-[120px] sm:max-w-[200px] bg-transparent border-none p-0 outline-none text-left",
                    isLast ? "text-white font-semibold cursor-default" : "text-zinc-400 hover:text-white cursor-pointer"
                  )}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Tab Filters Top Right */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-1">
          {(
            [
              { id: "all", label: "All Files", count: cabinetContents ? cabinetContents.files.length + cabinetContents.subCabinets.length : 0 },
              { id: "documents", label: "Documents" },
              { id: "photos", label: "Photos" },
              { id: "videos", label: "Videos" },
              { id: "starred", label: "Starred", count: starredIds.length },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5 border border-transparent",
                  isActive
                    ? "bg-white/[0.08] text-white border-white/[0.12] shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
                )}
              >
                <span>{tab.label}</span>
                {"count" in tab && typeof tab.count === "number" && tab.count > 0 && (
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full text-zinc-300">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">




        {/* Content Table view */}
        <div className="w-full">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="h-8 w-8 text-[#1e6ffd] animate-spin" />
                <p className="text-zinc-500 text-xs">Loading Cabinet files...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-20 px-6">
              <p className="text-red-400 text-sm font-medium mb-3">{error}</p>
              <Button
                onClick={() => {
                  if (organizationId) loadOrganizationCabinet(organizationId);
                }}
                variant="outline"
                size="sm"
                className="text-xs border-white/10"
              >
                Retry loading
              </Button>
            </div>
          ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-12 h-12 bg-white/[0.03] rounded-full flex items-center justify-center mb-3">
                <File className="h-6 w-6 text-zinc-500" />
              </div>
              <h4 className="text-sm font-semibold mb-1">No files found</h4>
              <p className="text-xs text-zinc-500 text-center max-w-xs">
                {searchQuery
                  ? "No results match your search query."
                  : "There are no files or folders in this directory."}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.06] text-xs font-semibold text-zinc-400 select-none">
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4 w-40">Modified Date</th>
                    <th className="py-3 px-4 w-28">File Size</th>
                    <th className="py-3 px-4 w-32 text-right pr-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {/* Render Folders */}
                  {filteredFolders.map((cabinet) => (
                    <tr
                      key={cabinet._id}
                      onClick={() => loadCabinetContents(cabinet._id)}
                      className="group hover:bg-white/[0.01] transition-all cursor-pointer text-xs"
                    >
                      <td className="py-3.5 px-4 font-medium text-white group-hover:text-[#1e6ffd] transition-colors">
                        <div className="flex items-center gap-3">
                          {/* Folder badge/icon */}
                          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                            <Folder className="h-4.5 w-4.5 text-[#fa8c16]" />
                          </div>
                          <span className="truncate max-w-[250px] sm:max-w-md">{cabinet.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        {new Date(cabinet.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">—</td>
                      <td
                        className="py-3.5 px-4 text-right pr-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {amIFounder && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-white/5"
                                >
                                  <MoreVertical className="h-3.5 w-3.5 text-zinc-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-[#121216] border-white/10 text-white min-w-[120px]"
                              >
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedItemForRename({
                                      id: cabinet._id,
                                      type: "cabinet",
                                      name: cabinet.name,
                                    });
                                    setNewNameForRename(cabinet.name);
                                    setRenameDialogOpen(true);
                                  }}
                                  className="hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                                  Rename
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Render Files */}
                  {filteredFiles.map((file) => {
                    const badgeInfo = getFileBadgeInfo(file.mimeType, file.name);
                    const isStarred = starredIds.includes(file._id);

                    return (
                      <tr
                        key={file._id}
                        onClick={() => {
                          if (isPreviewableMedia(file.mimeType)) {
                            openMediaPreview(file._id, file.name || file.originalName, file.mimeType);
                          } else {
                            openFileInNewTab(file._id);
                          }
                        }}
                        className="group hover:bg-white/[0.01] transition-all cursor-pointer text-xs"
                      >
                        <td className="py-3.5 px-4 font-medium text-white group-hover:text-[#1e6ffd] transition-colors">
                          <div className="flex items-center gap-3">
                            {/* Figma-styled Solid Color Badge */}
                            {file.mimeType?.startsWith("image/") ? (
                              <FileImagePreview
                                fileId={file._id}
                                organizationId={organizationId}
                                mimeType={file.mimeType}
                                fallbackBgColor={badgeInfo.bgColor}
                                fallbackText={badgeInfo.text}
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-extrabold text-white uppercase font-sans shrink-0"
                                style={{ backgroundColor: badgeInfo.bgColor }}
                              >
                                {badgeInfo.text}
                              </div>
                            )}
                            <span className="truncate max-w-[250px] sm:max-w-md">{file.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400">
                          {new Date(file.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400">
                          {formatFileSize(file.size)}
                        </td>
                        <td
                          className="py-3.5 px-4 text-right pr-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Star Action */}
                            <button
                              onClick={() => toggleStar(file._id)}
                              className="h-7 w-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                              title={isStarred ? "Unstar File" : "Star File"}
                            >
                              <Star
                                className={cn(
                                  "h-3.5 w-3.5",
                                  isStarred ? "fill-[#fa8c16] text-[#fa8c16]" : ""
                                )}
                              />
                            </button>

                            {/* Download Action */}
                            <button
                              onClick={() => downloadFile(file._id, file.originalName)}
                              className="h-7 w-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                              title="Download File"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>

                            {/* Dropdown Options */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="h-3.5 w-3.5 text-zinc-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-[#121216] border-white/10 text-white min-w-[130px]"
                              >
                                {isPreviewableMedia(file.mimeType) && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      openMediaPreview(file._id, file.name || file.originalName, file.mimeType)
                                    }
                                    className="hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                                    Preview
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => openFileInNewTab(file._id)}
                                  className="hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                                  Open in New Tab
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    void copyAffiliateLink(
                                      file._id,
                                      file.name || file.originalName
                                    )
                                  }
                                  className="hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs"
                                >
                                  <Copy className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                                  {affiliateId
                                    ? "Copy Affiliate Share Link"
                                    : "Copy Share Link"}
                                </DropdownMenuItem>
                                {isAskSupported(file.mimeType) && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setAskFile({
                                        id: file._id,
                                        name: file.name || file.originalName,
                                      });
                                      setAskOpen(true);
                                    }}
                                    className="hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                                    Ask about file
                                  </DropdownMenuItem>
                                )}
                                {file.mimeType.startsWith("video/") && (
                                  <DropdownMenuItem
                                    onClick={() => transcribeRecording(file)}
                                    disabled={transcribingFileId === file._id}
                                    className="hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs"
                                  >
                                    {transcribingFileId === file._id ? (
                                      <Loader2 className="h-3.5 w-3.5 mr-2 text-[#1e6ffd] animate-spin" />
                                    ) : (
                                      <FileText className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                                    )}
                                    {file.metadata?.transcription
                                      ? "View Transcript"
                                      : transcribingFileId === file._id
                                      ? "Transcribing..."
                                      : "Transcribe & Summarize"}
                                  </DropdownMenuItem>
                                )}
                                {amIFounder && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedItemForRename({
                                          id: file._id,
                                          type: "file",
                                          name: file.name,
                                        });
                                        setNewNameForRename(file.name);
                                        setRenameDialogOpen(true);
                                      }}
                                      className="hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs"
                                    >
                                      <Edit className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => deleteFile(file._id)}
                                      className="text-red-400 hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2 text-red-400" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-[#121216] border-white/10 text-white max-w-[90vw] sm:max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Edit className="h-4.5 w-4.5 text-[#1e6ffd]" />
              <span>Rename {selectedItemForRename?.type === "file" ? "File" : "Folder"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">New Name</label>
              <Input
                value={newNameForRename}
                onChange={(e) => setNewNameForRename(e.target.value)}
                placeholder="Enter new name"
                className="bg-[#1c1c24] border-white/10 text-white text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    renameItem();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRenameDialogOpen(false);
                  setSelectedItemForRename(null);
                  setNewNameForRename("");
                }}
                className="text-xs bg-transparent border-white/10 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={renameItem}
                size="sm"
                disabled={!newNameForRename.trim()}
                className="text-xs bg-[#1e6ffd] hover:bg-[#1e6ffd]/90"
              >
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ask File Dialog */}
      <AskFileDialog
        open={askOpen}
        onOpenChange={setAskOpen}
        fileId={askFile?.id || null}
        fileName={askFile?.name}
      />

      {/* Transcript Modal */}
      <Dialog open={!!transcriptModal} onOpenChange={(open) => { if (!open) setTranscriptModal(null); }}>
        <DialogContent className="bg-[#121216] border-white/10 text-white max-w-2xl w-full max-h-[85vh] flex flex-col mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText className="h-5 w-5 text-purple-400" />
              <span>Transcript — {transcriptModal?.fileName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 pt-2">
            {transcriptModal?.data.summary && transcriptModal.data.summary.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">Summary</p>
                <ul className="space-y-1">
                  {transcriptModal.data.summary.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {transcriptModal?.data.actionItems && transcriptModal.data.actionItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Action Items</p>
                <ul className="space-y-1">
                  {transcriptModal.data.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="mt-0.5 text-emerald-400 shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {transcriptModal?.data.transcription && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Full Transcript</p>
                <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-400 bg-white/5 rounded-lg p-3 max-h-64 overflow-y-auto leading-relaxed">
                  {transcriptModal.data.transcription}
                </pre>
              </div>
            )}
            {transcriptModal?.data.generatedAt && (
              <p className="text-[10px] text-zinc-600 text-right">
                Generated {new Date(transcriptModal.data.generatedAt).toLocaleString()} · {transcriptModal.data.model}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Preview Modal */}
      <MediaPreviewModal
        media={mediaPreview}
        onClose={() => setMediaPreview(null)}
      />
    </div>
  );
}
