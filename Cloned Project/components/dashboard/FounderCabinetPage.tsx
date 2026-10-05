"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Building2,
  Users,
  Clock,
  FileText,
  Loader2,
  Star,
  Plus,
  ArrowRight,
  Users2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAskSupported } from "@/lib/askSupported";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useAffiliateShare } from "@/lib/hooks/useAffiliateShare";
import {
  useCabinetUploadGestures,
  type UploadedCabinetFile,
} from "@/lib/hooks/useCabinetUploadGestures";
import {
  renamePickedFile,
  toPickedFiles,
  type PickedFile,
} from "@/lib/clipboard-files";
import {
  CabinetDropOverlay,
  CabinetUploadProgress,
  CabinetUploadReviewDialog,
  type CabinetShareAccess,
} from "@/components/dashboard/cabinet-upload-ui";
import { AlertTriangle, Copy, Globe, Lock, Share2 } from "lucide-react";

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
    /** 2 GB on Starter, 200 GB on the paid plan — resolved server-side. */
    storageLimit: number;
    planSlug?: "starter" | "pro";
    isPro?: boolean;
  };
}

/** Who may open a file's share link. Mirrors the backend's `sharing.access`. */
type FileAccess = "office" | "public";

interface SharingSettings {
  fileId: string;
  name: string;
  access: FileAccess;
  /** False for a member reading a founder-only setting. */
  canEdit: boolean;
  url: string | null;
  expiresAt: string | null;
}

/**
 * Changing the access mode does not re-point the existing link — the backend
 * revokes it and mints a new token. Anyone holding the old URL loses the file,
 * which is the whole point of switching a file back to office-only, but it is
 * not something to discover after the fact.
 */
const LINK_ROTATION_WARNING =
  "Switching modes expires the current link anyone holding it loses access.";

const SHARE_MODES: Array<{
  value: FileAccess;
  icon: typeof Lock;
  title: string;
  hint: string;
}> = [
    {
      value: "office",
      icon: Lock,
      title: "Restricted to office",
      hint: "Only office members can open it after signing in.",
    },
    {
      value: "public",
      icon: Globe,
      title: "Anyone with the link",
      hint: "Opens view-only in the browser, no account needed.",
    },
  ];

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

interface FounderCabinetPageProps {
  onClose?: () => void;
}

type CategoryTab = "all" | "documents" | "photos" | "videos" | "starred";

export default function FounderCabinetPage({ onClose }: FounderCabinetPageProps) {
  const { userData, amIFounder } = useAmIFounder();
  const orgName = userData.orgName;

  const router = useRouter();

  // The cabinet lives in a dashboard popover rather than on a route of its
  // own, so there is nothing sensible to hand /upgrade as a return path — it
  // falls back to /workspace once the plan is bought.
  const goToUpgrade = () => router.push("/upgrade");

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

  // Sharing — who may open a file's link, and the link itself
  const [sharing, setSharing] = useState<SharingSettings | null>(null);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [savingAccess, setSavingAccess] = useState<FileAccess | null>(null);

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
      const stored = localStorage.getItem("founder_starred_files");
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
      localStorage.setItem("founder_starred_files", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to star file", e);
    }
  };

  // Both write actions are driven from the bottom dock — this page has no
  // buttons of its own for them. The dock dispatches these after switching to
  // the cabinet popover, so the dialogs are the only UI either one needs.
  useEffect(() => {
    const handleUploadTrigger = () => {
      setUploadFileOpen(true);
    };
    const handleNewFolderTrigger = () => {
      setCreateCabinetOpen(true);
    };
    window.addEventListener("cabinet:trigger-upload", handleUploadTrigger);
    window.addEventListener("cabinet:trigger-new-folder", handleNewFolderTrigger);
    return () => {
      window.removeEventListener("cabinet:trigger-upload", handleUploadTrigger);
      window.removeEventListener("cabinet:trigger-new-folder", handleNewFolderTrigger);
    };
  }, []);

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

  const createCabinet = async () => {
    if (!newCabinetName.trim()) {
      toast.error("Folder name is required");
      return;
    }
    try {
      await api(
        `/cabinet/organization/sub-cabinet?organizationId=${organizationId}`,
        {
          method: "POST",
          body: JSON.stringify({
            name: newCabinetName,
            description: newCabinetDescription,
            parentCabinetId: cabinetContents?.cabinet._id,
          }),
        }
      );

      toast.success("Folder created successfully");
      setCreateCabinetOpen(false);
      setNewCabinetName("");
      setNewCabinetDescription("");

      if (cabinetContents?.cabinet._id) {
        if (cabinetContents.cabinet.isRoot) {
          await loadOrganizationCabinet(organizationId);
        } else {
          await loadCabinetContents(cabinetContents.cabinet._id);
        }
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Failed to create folder");
    }
  };

  /* ─── Upload: dialog, paste and drag-and-drop all land here ─── */

  const { affiliateId, copyAffiliateLink, announceUpload, forgetLink } =
    useAffiliateShare({ kind: "organization" }, organizationId);

  const refreshCurrentCabinet = async () => {
    const cabinet = cabinetContents?.cabinet;
    if (!cabinet || !organizationId) return;
    if (cabinet.isRoot) {
      await loadOrganizationCabinet(organizationId);
    } else {
      await loadCabinetContents(cabinet._id);
    }
  };

  const uploadOneFile = async (file: globalThis.File) => {
    const cabinetId = cabinetContents?.cabinet._id;
    if (!cabinetId) throw new Error("No folder open");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("cabinetId", cabinetId);

    const response = await api<{ success: boolean; data?: { _id: string; name?: string } }>(
      `/cabinet/organization/files/upload?organizationId=${organizationId}`,
      {
        method: "POST",
        body: formData,
      }
    );
    return { _id: response.data?._id || "", name: response.data?.name || file.name };
  };

  // Files pasted, dropped or picked but not sent yet — reviewed first, so a
  // stray Cmd+V can be renamed, trimmed or cancelled before it reaches S3.
  const [stagedFiles, setStagedFiles] = useState<PickedFile[]>([]);
  const [uploadReviewOpen, setUploadReviewOpen] = useState(false);
  const [stagedAccess, setStagedAccess] = useState<CabinetShareAccess>("office");

  const stageFiles = (incoming: PickedFile[]) => {
    if (incoming.length === 0) return;
    setStagedFiles((prev) => [...prev, ...incoming]);
    setUploadFileOpen(false);
    setUploadReviewOpen(true);
  };

  /**
   * Applies the batch's chosen access to each new file. Skipped entirely for
   * "office" — that is already the schema default, so there is nothing to say.
   */
  const applyStagedAccess = async (
    uploaded: UploadedCabinetFile[],
    access: CabinetShareAccess
  ) => {
    if (access === "office") return;
    const ids = uploaded.map((f) => f._id).filter(Boolean);
    if (ids.length === 0) return;

    let failed = 0;
    for (const fileId of ids) {
      try {
        await api(
          `/cabinet/organization/files/${fileId}/sharing?organizationId=${organizationId}`,
          { method: "PUT", body: JSON.stringify({ access }) }
        );
      } catch (error) {
        console.error("Error applying share access after upload:", error);
        failed += 1;
      }
    }

    if (failed > 0) {
      // The files are up either way — only the access flip missed, and it can
      // still be set from the row's Share settings.
      toast.error(
        failed === ids.length
          ? "Uploaded, but the share access couldn't be set"
          : `Uploaded, but ${failed} file${failed === 1 ? "" : "s"} kept office-only access`
      );
    }
  };

  const {
    isDraggingFiles,
    uploadProgress,
    uploading: uploadingFile,
    uploadFiles,
    dropZoneProps,
  } = useCabinetUploadGestures({
    enabled: !!organizationId && !!cabinetContents?.cabinet._id,
    // Kept apart from `enabled` so a member's paste or drop is ignored
    // outright rather than staged and then refused by the server.
    canUpload: amIFounder,
    disabledReason: "Please select a folder to upload files",
    uploadFile: uploadOneFile,
    refresh: refreshCurrentCabinet,
    onStageFiles: stageFiles,
    onUploaded: (files) => {
      setUploadFileOpen(false);
      // Only what actually went up leaves the list — a rejected file stays
      // staged so it can be retried without re-picking it.
      const sent = new Set(files.map((f) => f.name));
      setStagedFiles((prev) => {
        const remaining = prev.filter(({ file }) => !sent.has(file.name));
        if (remaining.length === 0) setUploadReviewOpen(false);
        return remaining;
      });
      void applyStagedAccess(files, stagedAccess);
      announceUpload(files);
    },
  });


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

  /* ─── Sharing: who may open a file's link ─── */

  const openSharing = async (file: CabinetFile) => {
    const name = file.name || file.originalName;
    // Opened optimistically so the dialog appears on the click rather than
    // after the round trip; the fetch fills in the real values.
    setSharing({
      fileId: file._id,
      name,
      access: "office",
      canEdit: false,
      url: null,
      expiresAt: null,
    });
    setSharingLoading(true);

    try {
      const response = await api<{
        success: boolean;
        data: {
          access: FileAccess;
          canEdit: boolean;
          url: string | null;
          expiresAt: string | null;
        };
      }>(
        `/cabinet/organization/files/${file._id}/sharing?organizationId=${organizationId}`
      );

      setSharing({
        fileId: file._id,
        name,
        access: response.data.access,
        canEdit: response.data.canEdit,
        url: response.data.url,
        expiresAt: response.data.expiresAt,
      });
    } catch (error) {
      console.error("Error reading sharing settings:", error);
      toast.error("Couldn't read this file's sharing settings");
      setSharing(null);
    } finally {
      setSharingLoading(false);
    }
  };

  const changeAccess = async (next: FileAccess) => {
    if (!sharing || sharing.access === next || savingAccess) return;
    setSavingAccess(next);

    try {
      const response = await api<{
        success: boolean;
        data: { url: string; expiresAt: string | null };
      }>(
        `/cabinet/organization/files/${sharing.fileId}/sharing?organizationId=${organizationId}`,
        { method: "PUT", body: JSON.stringify({ access: next }) }
      );

      setSharing({
        ...sharing,
        access: next,
        url: response.data.url,
        expiresAt: response.data.expiresAt,
      });

      // The cached copy of the old link would hand out a dead URL — the
      // backend has just revoked that token.
      forgetLink(sharing.fileId);

      toast.success(
        next === "public"
          ? "Anyone with the new link can now view this file"
          : "This file is restricted to your office again",
        { description: "The previous link has expired." }
      );
    } catch (error) {
      console.error("Error updating sharing settings:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update sharing"
      );
    } finally {
      setSavingAccess(null);
    }
  };

  const copySharingLink = async () => {
    if (!sharing) return;
    // Minted through the shared helper so the copier's own `?ref=` rides
    // along, exactly as the row's copy action does.
    await copyAffiliateLink(sharing.fileId, sharing.name);
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

  // Dynamic Storage Calculation
  const getStorageDetails = () => {
    const GB = 1024 * 1024 * 1024;
    const photosBytes = cabinetContents?.storageDetails?.photos ?? 0;
    const videosBytes = cabinetContents?.storageDetails?.videos ?? 0;
    const documentsBytes = cabinetContents?.storageDetails?.documents ?? 0;
    const totalUsedBytes = cabinetContents?.storageDetails?.totalUsed ?? 0;
    const totalCapacityBytes = cabinetContents?.storageDetails?.storageLimit ?? (200 * GB);
    const freeSpaceBytes = Math.max(0, totalCapacityBytes - totalUsedBytes);
    // Three signals, any one of which settles it. The cap itself is included
    // because it is the one the banner already renders — if it reads 200 GB,
    // offering an upgrade to 200 GB is nonsense whatever the slug says. It also
    // covers the pre-load default, so the button never flashes on for a Pro
    // office while the cabinet request is still in flight.
    const details = cabinetContents?.storageDetails;
    const isPro =
      details?.planSlug === "pro" ||
      details?.isPro === true ||
      totalCapacityBytes >= 200 * GB;

    return {
      totalUsedBytes,
      totalCapacityBytes,
      isPro,
      photosPercent: totalCapacityBytes > 0 ? (photosBytes / totalCapacityBytes) * 100 : 0,
      videosPercent: totalCapacityBytes > 0 ? (videosBytes / totalCapacityBytes) * 100 : 0,
      documentsPercent: totalCapacityBytes > 0 ? (documentsBytes / totalCapacityBytes) * 100 : 0,
      freeSpacePercent: totalCapacityBytes > 0 ? (freeSpaceBytes / totalCapacityBytes) * 100 : 0,
    };
  };

  const formatUsedSize = (bytes: number) => {
    const GB = 1024 * 1024 * 1024;
    const MB = 1024 * 1024;
    if (bytes >= GB) {
      return `${(bytes / GB).toFixed(1)} GB`;
    } else if (bytes >= MB) {
      return `${(bytes / MB).toFixed(1)} MB`;
    } else if (bytes > 0) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return "0 GB";
    }
  };

  const storage = getStorageDetails();

  return (
    <div
      className="relative flex flex-col h-full bg-[#0c0c0e] text-white overflow-hidden"
      {...dropZoneProps}
    >
      <CabinetDropOverlay
        visible={isDraggingFiles}
        targetName={cabinetContents?.cabinet.name || "this cabinet"}
      />
      <CabinetUploadProgress progress={uploadProgress} />
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
        {/* Storage Banner */}
        <div className="relative overflow-hidden py-2 px-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">{formatUsedSize(storage.totalUsedBytes)}</span>
                <span className="text-zinc-400 text-sm md:text-base font-medium">of {formatFileSize(storage.totalCapacityBytes)} used</span>
              </div>
            </div>
            {/* Starter only. A button rather than an anchor: an href="#" was
                jumping the scroll position before the route ever changed. */}
            {!storage.isPro && (
              <button
                type="button"
                onClick={goToUpgrade}
                className="text-[color:color-mix(in_srgb,var(--brand-2)_96%,white)] hover:text-[color:color-mix(in_srgb,var(--brand-2)_96%,white)]/90 text-xs font-bold uppercase tracking-wider transition-all hover:underline cursor-pointer self-start md:self-auto"
              >
                UPGRADE STORAGE →
              </button>
            )}
          </div>

          {/* Segmented Progress Bar */}
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex mt-4 shadow-inner">
            <div className="bg-[#1e6ffd] h-full" style={{ width: `${storage.photosPercent}%` }} title={`Photos (${storage.photosPercent.toFixed(1)}%)`} />
            <div className="bg-[#52c41a] h-full" style={{ width: `${storage.videosPercent}%` }} title={`Videos (${storage.videosPercent.toFixed(1)}%)`} />
            <div className="bg-[#fa8c16] h-full" style={{ width: `${storage.documentsPercent}%` }} title={`Documents (${storage.documentsPercent.toFixed(1)}%)`} />
            <div className="bg-white/90 h-full animate-pulse" style={{ width: `${storage.freeSpacePercent}%` }} title="Free Space" />
          </div>

          {/* Legend dots */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 text-xs font-medium text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1e6ffd] shrink-0" />
              <span className="text-zinc-400">Photos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#52c41a] shrink-0" />
              <span className="text-zinc-400">Videos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#fa8c16] shrink-0" />
              <span className="text-zinc-400">Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white shrink-0" />
              <span className="text-zinc-400">Free Space</span>
            </div>
          </div>
        </div>

        {/* Search row. New Folder and Upload live in the bottom dock, so no
            in-page buttons here — they were a second copy of the same action. */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 h-9 w-full bg-[#16161c] border-white/10 text-white text-xs placeholder:text-zinc-500 focus:bg-[#1a1a24] focus:border-[#1e6ffd] transition-all rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2 justify-end shrink-0">
            {/* Create Folder Dialog — opened from the bottom dock */}
            <Dialog open={createCabinetOpen} onOpenChange={setCreateCabinetOpen}>
              <DialogContent className="bg-[#121216] border-white/10 text-white max-w-[90vw] sm:max-w-md mx-auto">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg font-bold">Create New Folder</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Folder Name</label>
                    <Input
                      value={newCabinetName}
                      onChange={(e) => setNewCabinetName(e.target.value)}
                      placeholder="Enter folder name"
                      className="bg-[#1c1c24] border-white/10 text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Description (Optional)</label>
                    <Input
                      value={newCabinetDescription}
                      onChange={(e) => setNewCabinetDescription(e.target.value)}
                      placeholder="Enter folder description"
                      className="bg-[#1c1c24] border-white/10 text-white text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateCabinetOpen(false)}
                      className="text-xs bg-transparent border-white/10 hover:bg-white/5"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createCabinet}
                      size="sm"
                      className="text-xs bg-[#1e6ffd] hover:bg-[#1e6ffd]/90"
                    >
                      Create Folder
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Hidden upload dialog for bottom nav launcher */}
            <Dialog open={uploadFileOpen} onOpenChange={setUploadFileOpen}>
              <DialogContent className="bg-[#121216] border-white/10 text-white max-w-[90vw] sm:max-w-md mx-auto">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg font-bold">Upload File</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:border-[#1e6ffd] transition-all bg-[#16161c]">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        // Staged, not sent — the picker lands in the same
                        // review dialog as a paste or a drop.
                        stageFiles(toPickedFiles(Array.from(e.target.files || [])));
                        e.target.value = "";
                      }}
                      className="hidden"
                      id="founder-file-upload"
                      disabled={uploadingFile}
                    />
                    <label htmlFor="founder-file-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto mb-3 text-zinc-400 hover:text-white transition-colors" />
                      <p className="text-xs text-zinc-300 font-medium">
                        {uploadingFile
                          ? uploadProgress
                            ? `Uploading ${uploadProgress.done + 1} of ${uploadProgress.total}...`
                            : "Uploading..."
                          : "Click to select files, or drop them anywhere"}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Any file type up to 100MB — Ctrl/Cmd+V pastes a screenshot
                      </p>
                    </label>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

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
                          {/* Folder badge/icon - styled consistent with files (w-10 h-10 rounded-xl) */}
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
                            {/* Figma-styled Solid Color Badge - w-10 h-10 rounded-xl */}
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
                                <DropdownMenuItem
                                  onClick={() => void openSharing(file)}
                                  className="hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs"
                                >
                                  <Share2 className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                                  Share settings
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

      {/* Paste, drop and the picker all stage here before anything is sent */}
      <CabinetUploadReviewDialog
        open={uploadReviewOpen}
        onOpenChange={(open) => {
          setUploadReviewOpen(open);
          if (!open) {
            setStagedFiles([]);
            // Public is a deliberate choice each time, never a sticky one.
            setStagedAccess("office");
          }
        }}
        files={stagedFiles}
        destination={cabinetContents?.cabinet.name || "this cabinet"}
        onRemove={(index) =>
          setStagedFiles((prev) => prev.filter((_, i) => i !== index))
        }
        onRename={(index, nextName) =>
          setStagedFiles((prev) =>
            prev.map((entry, i) =>
              i === index ? renamePickedFile(entry, nextName) : entry
            )
          )
        }
        onClear={() => setStagedFiles([])}
        onConfirm={() => {
          if (stagedFiles.length > 0) void uploadFiles(stagedFiles);
        }}
        onAddFiles={(picked) => stageFiles(toPickedFiles(picked))}
        shareAccess={stagedAccess}
        onShareAccessChange={setStagedAccess}
        uploading={uploadingFile}
        progress={uploadProgress}
      />

      {/* Share settings — access mode, the live link, and what changing it costs */}
      <Dialog
        open={!!sharing}
        onOpenChange={(open) => {
          if (!open) setSharing(null);
        }}
      >
        <DialogContent className="bg-[#121216] border-white/10 text-white max-w-[90vw] sm:max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Share2 className="h-4.5 w-4.5 text-brand" />
              <span className="truncate">Share settings</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <p className="truncate text-xs text-zinc-400">{sharing?.name}</p>

            {sharingLoading ? (
              <div className="flex items-center gap-2 py-6 text-xs text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading sharing settings...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {SHARE_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const isActive = sharing?.access === mode.value;
                    const isSaving = savingAccess === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        disabled={!sharing?.canEdit || !!savingAccess}
                        onClick={() => void changeAccess(mode.value)}
                        className={cn(
                          "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                          isActive
                            ? "border-brand bg-brand/10"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
                          (!sharing?.canEdit || !!savingAccess) &&
                          "cursor-not-allowed opacity-60"
                        )}
                      >
                        {isSaving ? (
                          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand" />
                        ) : (
                          <Icon
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              isActive ? "text-brand" : "text-zinc-400"
                            )}
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-white">
                            {mode.title}
                          </span>
                          <span className="block text-[11px] text-zinc-400">
                            {mode.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Said before the switch, not after it — the old link dies the
                    moment the mode changes. One line: it is a footnote to the
                    choice above, not a section of its own. */}
                <p className="flex items-center gap-1.5 text-[10px] leading-snug text-amber-300/80">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {LINK_ROTATION_WARNING}
                </p>

                {!sharing?.canEdit && (
                  <p className="text-[10px] text-zinc-500">
                    Only founders can change sharing for office files.
                  </p>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">
                    Current link
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={sharing?.url || "No link yet — copy to create one"}
                      className="bg-[#1c1c24] border-white/10 text-white text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => void copySharingLink()}
                      className="shrink-0 text-xs bg-brand text-brand-foreground font-semibold hover:bg-brand/90"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy
                    </Button>
                  </div>
                  {sharing?.expiresAt && (
                    <p className="text-[10px] text-zinc-500">
                      Expires{" "}
                      {new Date(sharing.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
