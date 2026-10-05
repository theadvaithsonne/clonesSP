"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { api, API_URL } from "@/lib/api";
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
  Share2,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Link,
  Copy,
  Globe,
  Building2,
  FileText,
  FileSpreadsheet,
  Presentation,
  FilePlus,
  Star,
  LayoutGrid,
  Image as ImageIcon,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { withAffiliateRef } from "@/lib/affiliate-share";
import { useAffiliateShare } from "@/lib/hooks/useAffiliateShare";
import {
  useCabinetUploadGestures,
  type UploadTarget,
} from "@/lib/hooks/useCabinetUploadGestures";
import { toPickedFiles, type PickedFile } from "@/lib/clipboard-files";
import {
  CabinetDropOverlay,
  CabinetUploadProgress,
  CabinetUploadReviewDialog,
} from "@/components/dashboard/cabinet-upload-ui";
import { AskFileDialog } from "@/components/dashboard/AskFileDialog";
import { isAskSupported } from "@/lib/askSupported";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import CreateDocumentDialog from "@/components/dashboard/CreateDocumentDialog";
import { DocumentEditorOverlay } from "@/components/dashboard/DocumentEditorOverlay";
import { useRouter } from "next/navigation";

// Collaborative document interface
interface CollaborativeDocument {
  _id: string;
  title: string;
  type: "word" | "cell" | "slide";
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  collaborators: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Cabinet {
  _id: string;
  name: string;
  description?: string;
  path: string;
  isRoot: boolean;
  createdAt: string;
  updatedAt: string;
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

interface SharedItem {
  _id: string;
  itemId: string;
  itemType: "file" | "cabinet" | "document";
  owner: {
    _id: string;
    name: string;
    email: string;
  };
  sharedWith: {
    _id: string;
    name: string;
    email: string;
  };
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  message?: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  createdAt: string;
  updatedAt: string;
  item?: Cabinet | CabinetFile;
}

interface CabinetContents {
  cabinet: Cabinet;
  subCabinets: Cabinet[];
  files: CabinetFile[];
}

type ContentFilter = "all" | "file" | "photo" | "video" | "folder" | "starred";

const CONTENT_FILTERS: {
  id: ContentFilter;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { id: "all", label: "All Files", icon: LayoutGrid },
  { id: "file", label: "Documents", icon: FileText },
  { id: "photo", label: "Photos", icon: ImageIcon },
  { id: "video", label: "Videos", icon: Play },
  { id: "starred", label: "Starred", icon: Star },
];

const getEmptyFilterMessage = (filter: ContentFilter) => {
  switch (filter) {
    case "file":
      return "No documents in this folder";
    case "photo":
      return "No photos in this folder";
    case "video":
      return "No videos in this folder";
    case "folder":
      return "No folders here";
    case "starred":
      return "No starred files";
    default:
      return "No files in this folder";
  }
};

export default function CabinetPage() {
  const [currentCabinetId, setCurrentCabinetId] = useState<string | null>(null);
  const [cabinetContents, setCabinetContents] =
    useState<CabinetContents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [path, setPath] = useState<string[]>(["Home"]);
  const [organizationId, setOrganizationId] = useState<string>("");
  const cabinetHistoryRef = useRef<Record<string, string>>({});
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"personal" | "shared">("personal");
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedContents, setSharedContents] = useState<CabinetContents | null>(null);
  const [sharedCabinetId, setSharedCabinetId] = useState<string | null>(null);
  const [sharedPath, setSharedPath] = useState<string[]>(["Shared"]);
  const sharedHistoryRef = useRef<Record<string, string>>({});
  const [starredIds, setStarredIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("cabinet_starred_files") || "[]");
    } catch {
      return [];
    }
  });
  const selectedIdsRef = useRef(selectedIds);
  const cabinetContentsRef = useRef(cabinetContents);
  const downloadAllRef = useRef<() => Promise<void>>(async () => {});
  selectedIdsRef.current = selectedIds;
  cabinetContentsRef.current = cabinetContents;

  // Synchronize path changes with global dashboard breadcrumbs
  useEffect(() => {
    const activePath = activeTab === "shared" ? sharedPath : path;
    const history =
      activeTab === "shared" ? sharedHistoryRef.current : cabinetHistoryRef.current;
    const subSegments = activePath
      .filter((p) => p !== "Home" && p !== "Shared")
      .map((segment) => {
        const folderId = history[segment];
        return {
          label: segment,
          key: folderId || (activeTab === "shared" ? "shared-root" : "root"),
        };
      });
    window.dispatchEvent(
      new CustomEvent("workspace:set-breadcrumbs", {
        detail: { items: subSegments },
      })
    );
  }, [path, sharedPath, activeTab]);

  // Handle breadcrumb clicks from the dashboard layout header
  useEffect(() => {
    const handleBreadcrumbClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ label: string; key: string; index: number }>;
      const { key } = customEvent.detail;

      if (key) {
        if (key === "root") {
          setActiveTab("personal");
          if (organizationId) loadRootCabinets(organizationId);
        } else if (key === "shared-root") {
          setActiveTab("shared");
          setSharedCabinetId(null);
          setSharedContents(null);
          setSharedPath(["Shared"]);
          loadSharedItems();
        } else if (activeTab === "shared" || sharedHistoryRef.current) {
          // Prefer shared navigation when key belongs to shared history
          if (sharedHistoryRef.current && Object.values(sharedHistoryRef.current).includes(key)) {
            void openSharedCabinet(key);
          } else {
            setActiveTab("personal");
            loadCabinetContents(key);
          }
        } else {
          setActiveTab("personal");
          loadCabinetContents(key);
        }
      }
    };

    window.addEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    return () => {
      window.removeEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    };
  }, [organizationId, activeTab]);

  // Dialog states
  const [createCabinetOpen, setCreateCabinetOpen] = useState(false);
  const [uploadFileOpen, setUploadFileOpen] = useState(false);
  const [shareItemOpen, setShareItemOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newCabinetName, setNewCabinetName] = useState("");
  const [newCabinetDescription, setNewCabinetDescription] = useState("");
  // Files picked or pasted but not sent yet — the upload dialog lists them and
  // waits for a click, so a stray Cmd+V never uploads on its own.
  const [stagedFiles, setStagedFiles] = useState<PickedFile[]>([]);
  const [selectedItemForShare, setSelectedItemForShare] = useState<{
    id: string;
    type: "file" | "cabinet" | "document";
    name: string;
  } | null>(null);
  const [selectedItemForRename, setSelectedItemForRename] = useState<{
    id: string;
    type: "file" | "cabinet";
    name: string;
  } | null>(null);
  const [newNameForRename, setNewNameForRename] = useState("");
  const [organizationMembers, setOrganizationMembers] = useState<any[]>([]);
  const [selectedUsersForShare, setSelectedUsersForShare] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [existingShares, setExistingShares] = useState<any[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [shareModalTab, setShareModalTab] = useState<"add" | "existing">("add");

  // Affiliate share links for this cabinet's files (personal tree).
  const { affiliateId, copyAffiliateLink, announceUpload } = useAffiliateShare(
    { kind: "personal" },
    organizationId
  );

  // Ask modal state
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

  // Shareable link dialog state
  const [shareLinkDialogOpen, setShareLinkDialogOpen] = useState(false);
  const [selectedFileForLink, setSelectedFileForLink] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [shareableLinks, setShareableLinks] = useState<{
    internal?: {
      url: string;
      expiresAt: string;
      accessCount: number;
      maxAccessCount: number;
    };
    external?: {
      url: string;
      expiresAt: string;
      accessCount: number;
      maxAccessCount: number;
    };
  }>({});
  const [loadingLinkType, setLoadingLinkType] = useState<
    "internal" | "external" | null
  >(null);

  // Router for navigation
  const router = useRouter();

  // Collaborative documents state
  const [createDocumentOpen, setCreateDocumentOpen] = useState(false);
  const [collaborativeDocuments, setCollaborativeDocuments] = useState<
    CollaborativeDocument[]
  >([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  // Document editor overlay state
  const [editorOverlayOpen, setEditorOverlayOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  // Load user info on mount
  useEffect(() => {
    const userId = localStorage.getItem("garage_user_id") || "";
    const userName = localStorage.getItem("garage_user_name") || "User";
    const userEmail = localStorage.getItem("garage_user_email") || "";
    setCurrentUserId(userId);
    setCurrentUserName(userName);
    setCurrentUserEmail(userEmail);
  }, []);

  // Function to open document in overlay
  const openDocumentInOverlay = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setEditorOverlayOpen(true);
  };

  // Load root cabinets on mount
  useEffect(() => {
    const initializeCabinet = async () => {
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
        await loadRootCabinets(orgId);
      } catch (err) {
        console.error("Error initializing cabinet:", err);
        setError("Failed to load cabinet. Please try again.");
        setLoading(false);
      }
    };

    initializeCabinet();
  }, []);

  // Bottom-nav triggers from layout (File Upload / Create Folder)
  useEffect(() => {
    const handleUploadTrigger = () => setUploadFileOpen(true);
    const handleCreateFolderTrigger = () => setCreateCabinetOpen(true);

    window.addEventListener("cabinet:trigger-upload", handleUploadTrigger);
    window.addEventListener("cabinet:trigger-create-folder", handleCreateFolderTrigger);
    return () => {
      window.removeEventListener("cabinet:trigger-upload", handleUploadTrigger);
      window.removeEventListener("cabinet:trigger-create-folder", handleCreateFolderTrigger);
    };
  }, []);

  const buildFilterQuery = (filter: ContentFilter = contentFilter) => {
    // When "all" is selected, do not send type/starred query params
    if (filter === "all") return "";
    if (filter === "starred") return "&starred=true";
    return `&type=${filter}`;
  };

  const applyContentFilter = (filter: ContentFilter) => {
    setContentFilter(filter);
    setSelectedIds(new Set());
    if (!organizationId) return;
    // Defer so buildFilterQuery reads the new filter on next tick via explicit arg
    const run = async () => {
      if (!currentCabinetId || currentCabinetId === "root") {
        await loadRootCabinets(organizationId, filter);
      } else {
        await loadCabinetContents(currentCabinetId, filter);
      }
    };
    void run();
  };

  // Load shared items when switching to shared tab
  useEffect(() => {
    if (activeTab === "shared" && organizationId) {
      loadSharedItems();
    }
  }, [activeTab, organizationId]);

  // Load organization members and existing shares when share dialog opens
  useEffect(() => {
    if (shareItemOpen && organizationId && selectedItemForShare) {
      loadOrganizationMembers();
      loadExistingShares(selectedItemForShare.id, selectedItemForShare.type);
    }
  }, [shareItemOpen, organizationId, selectedItemForShare]);

  const loadRootCabinets = async (orgId: string, filter: ContentFilter = contentFilter) => {
    setLoading(true);
    setError(null);
    try {
      const filterQuery = buildFilterQuery(filter);
      const response = await api<{ success: boolean; data: Cabinet[] }>(
        `/cabinet?organizationId=${orgId}${filterQuery}`
      );

      // Create a mock root cabinet structure
      const mockRootCabinet: Cabinet = {
        _id: "root",
        name: "My Cabinet",
        description: "Your personal file storage",
        path: "/",
        isRoot: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Get default cabinet files
      let defaultFiles: CabinetFile[] = [];
      try {
        const defaultResponse = await api<{
          success: boolean;
          data: { cabinet: Cabinet; files: CabinetFile[] };
        }>(`/cabinet/default?organizationId=${orgId}${filterQuery}`);
        defaultFiles = defaultResponse.data.files;
      } catch (error) {
        // Default cabinet might not exist yet, that's okay
        console.log("No default cabinet found yet");
      }

      // Filter out the default "My Files" cabinet from subCabinets since we show its files in root
      let filteredCabinets = (response.data || []).filter(
        (cabinet: any) => cabinet.name !== "My Files"
      );

      // Client-side fallback when API ignores type filters
      if (filter === "folder") {
        defaultFiles = [];
      } else if (filter !== "all" && filter !== "starred") {
        filteredCabinets = [];
      }
      if (filter === "starred") {
        defaultFiles = defaultFiles.filter((f) => starredIds.includes(f._id));
        filteredCabinets = [];
      }

      setCabinetContents({
        cabinet: mockRootCabinet,
        subCabinets: filteredCabinets,
        files: defaultFiles,
      });
      setCurrentCabinetId("root");
      setPath(["Home"]);
    } catch (error) {
      console.error("Error loading cabinets:", error);

      // If it's an authentication error, show a more specific message
      if (error instanceof Error && error.message.includes("401")) {
        setError("Authentication failed. Please log in again.");
      } else if (error instanceof Error && error.message.includes("403")) {
        setError(
          "Access denied. You don't have permission to access this organization's cabinets."
        );
      } else {
        setError(
          "Failed to load cabinets. Please check your connection and try again."
        );
      }

      toast.error("Failed to load cabinets");
    } finally {
      setLoading(false);
    }
  };

  // Load collaborative documents
  const loadCollaborativeDocuments = async (orgId: string) => {
    setDocumentsLoading(true);
    try {
      const response = await api<{
        success: boolean;
        data: CollaborativeDocument[];
      }>(`/cabinet/documents?organizationId=${orgId}`);
      setCollaborativeDocuments(response.data || []);
    } catch (error) {
      console.error("Error loading collaborative documents:", error);
      // Silently fail - documents feature might not be set up yet
    } finally {
      setDocumentsLoading(false);
    }
  };

  // Load documents when organization is set
  useEffect(() => {
    if (organizationId) {
      loadCollaborativeDocuments(organizationId);
    }
  }, [organizationId]);

  // Get icon for document type
  const getDocumentTypeIcon = (type: "word" | "cell" | "slide") => {
    switch (type) {
      case "word":
        return <FileText className="h-4 w-4 text-blue-400" />;
      case "cell":
        return <FileSpreadsheet className="h-4 w-4 text-green-400" />;
      case "slide":
        return <Presentation className="h-4 w-4 text-orange-400" />;
      default:
        return <FileText className="h-4 w-4 text-blue-400" />;
    }
  };

  // Get document type label
  const getDocumentTypeLabel = (type: "word" | "cell" | "slide") => {
    switch (type) {
      case "word":
        return "Document";
      case "cell":
        return "Spreadsheet";
      case "slide":
        return "Presentation";
      default:
        return "Document";
    }
  };

  const loadSharedItems = async () => {
    if (!organizationId) return;

    setSharedLoading(true);
    try {
      const response = await api<{ success: boolean; data: SharedItem[] }>(
        `/cabinet/shared/with-me?organizationId=${organizationId}`
      );
      setSharedItems(response.data || []);
    } catch (error) {
      console.error("Error loading shared items:", error);
      toast.error("Failed to load shared items");
    } finally {
      setSharedLoading(false);
    }
  };

  const loadOrganizationMembers = async () => {
    if (!organizationId) return;

    setLoadingMembers(true);
    try {
      const response = await api<{ success: boolean; data: any[] }>(
        `/cabinet/users/members?organizationId=${organizationId}`
      );
      setOrganizationMembers(response.data || []);
    } catch (error) {
      console.error("Error loading organization members:", error);
      toast.error("Failed to load organization members");
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadExistingShares = async (itemId: string, itemType: string) => {
    if (!organizationId) return;

    setLoadingShares(true);
    try {
      // Handle collaborative documents differently
      if (itemType === "document") {
        const response = await api<{ success: boolean; data: any }>(
          `/cabinet/documents/${itemId}?organizationId=${organizationId}`
        );
        // Transform collaborators to match the share format
        const collaborators = response.data?.collaborators || [];
        const transformedShares = collaborators.map((collab: any) => ({
          _id: collab._id,
          sharedWith: {
            _id: collab._id,
            name: collab.name,
            email: collab.email,
          },
        }));
        setExistingShares(transformedShares);
      } else {
        const response = await api<{ success: boolean; data: any[] }>(
          `/cabinet/share/${itemId}/${itemType}?organizationId=${organizationId}`
        );
        setExistingShares(response.data || []);
      }
    } catch (error) {
      console.error("Error loading existing shares:", error);
      toast.error("Failed to load existing shares");
    } finally {
      setLoadingShares(false);
    }
  };

  const loadCabinetContents = async (
    cabinetId: string,
    filter: ContentFilter = contentFilter
  ) => {
    setLoading(true);
    setError(null);
    try {
      // If it's the root cabinet, reload root cabinets instead
      if (cabinetId === "root") {
        if (organizationId) {
          await loadRootCabinets(organizationId, filter);
        } else {
          setError("No organization selected");
        }
        return;
      }

      const filterQuery = buildFilterQuery(filter);
      const response = await api<{ success: boolean; data: CabinetContents }>(
        `/cabinet/${cabinetId}?organizationId=${organizationId}${filterQuery}`
      );

      let data = response.data;
      // Client-side fallback when API ignores type filters
      if (filter === "folder") {
        data = { ...data, files: [] };
      } else if (filter !== "all" && filter !== "starred") {
        data = { ...data, subCabinets: [] };
      }
      if (filter === "starred") {
        data = {
          ...data,
          subCabinets: [],
          files: (data.files || []).filter((f) => starredIds.includes(f._id)),
        };
      }

      setCabinetContents(data);
      setCurrentCabinetId(cabinetId);
      setSelectedIds(new Set());

      if (data.cabinet) {
        cabinetHistoryRef.current[data.cabinet.name] = data.cabinet._id;
      }

      // Update path
      const cabinetPath = data.cabinet.path.split("/").filter(Boolean);
      setPath(["Home", ...cabinetPath]);
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
        `/cabinet?organizationId=${organizationId}`,
        {
          method: "POST",
          body: JSON.stringify({
            name: newCabinetName,
            description: newCabinetDescription,
            parentCabinetId:
              currentCabinetId === "root" ? null : currentCabinetId,
          }),
        }
      );

      toast.success("Cabinet created successfully");
      setCreateCabinetOpen(false);
      setNewCabinetName("");
      setNewCabinetDescription("");

      // Reload current cabinet contents
      if (currentCabinetId) {
        if (currentCabinetId === "root" && organizationId) {
          loadRootCabinets(organizationId);
        } else {
          loadCabinetContents(currentCabinetId);
        }
      }
    } catch (error) {
      console.error("Error creating cabinet:", error);
      toast.error("Failed to create cabinet");
    }
  };

  /** Re-reads whatever folder is on screen, so a new file shows up at once. */
  const refreshCurrentFolder = async () => {
    if (!organizationId) return;
    if (currentCabinetId && currentCabinetId !== "root") {
      await loadCabinetContents(currentCabinetId);
    } else {
      await loadRootCabinets(organizationId);
    }
  };

  /**
   * Recreates a dropped folder's path under the open cabinet and returns the
   * cabinet its files belong in. Look-up before create: dropping the same
   * folder twice should reuse it rather than fail on the duplicate name.
   */
  const ensureFolderForPath = async (
    relativePath: string
  ): Promise<string | null> => {
    if (!relativePath || !organizationId) return null;

    let parentId = currentCabinetId === "root" ? null : currentCabinetId;
    for (const segment of relativePath.split("/").filter(Boolean)) {
      const listPath = parentId
        ? `/cabinet/${parentId}?organizationId=${organizationId}`
        : `/cabinet?organizationId=${organizationId}`;
      const listed = await api<{
        success: boolean;
        data: { subCabinets?: Cabinet[] } | Cabinet[];
      }>(listPath);
      // The root listing returns the cabinets directly; a folder returns its
      // contents with the children under `subCabinets`.
      const children: Cabinet[] = Array.isArray(listed.data)
        ? listed.data
        : listed.data?.subCabinets || [];
      const match = children.find((c) => c.name === segment);

      if (match) {
        parentId = match._id;
        continue;
      }

      const created = await api<{ success: boolean; data: Cabinet }>(
        `/cabinet?organizationId=${organizationId}`,
        {
          method: "POST",
          body: JSON.stringify({ name: segment, parentCabinetId: parentId }),
        }
      );
      parentId = created.data._id;
    }
    return parentId;
  };

  const uploadOneFile = async (
    file: globalThis.File,
    target: UploadTarget
  ) => {
    const formData = new FormData();
    formData.append("file", file);

    // Only add cabinetId if we have a specific cabinet selected
    const cabinetId =
      target.cabinetId ||
      (currentCabinetId && currentCabinetId !== "root" ? currentCabinetId : "");
    if (cabinetId) {
      formData.append("cabinetId", cabinetId);
    }
    // If no cabinet selected, let backend create/use default cabinet

    const response = await api<{ success: boolean; data: CabinetFile }>(
      `/cabinet/files/upload?organizationId=${organizationId}`,
      {
        method: "POST",
        body: formData,
        headers: {
          // Don't set Content-Type, let browser set it for FormData
        },
      }
    );
    const data = response.data;
    return { _id: data._id, name: data.name || data.originalName };
  };

  /**
   * Paste, drop and the upload dialog all funnel through the shared gesture
   * hook, so the three entry points cannot drift apart.
   */
  const {
    isDraggingFiles,
    uploadProgress,
    uploading: uploadingFile,
    uploadFiles,
    dropZoneProps,
  } = useCabinetUploadGestures({
    // Shared files live in someone else's cabinet — there is nowhere to drop
    // an upload while that tab is open.
    enabled: !!organizationId && activeTab === "personal",
    disabledReason: organizationId
      ? "Switch to My files to upload"
      : "No organization selected",
    uploadFile: uploadOneFile,
    ensureFolder: ensureFolderForPath,
    refresh: refreshCurrentFolder,
    onUploaded: (files) => {
      // Only what actually went up leaves the list — a file the server
      // rejected stays staged so it can be retried without re-pasting.
      const sent = new Set(files.map((f) => f.name));
      setStagedFiles((prev) => {
        const remaining = prev.filter(({ file }) => !sent.has(file.name));
        if (remaining.length === 0) setUploadFileOpen(false);
        return remaining;
      });
      announceUpload(files);
    },
    // Both gestures are reviewed first — see `stageFiles`.
    onStageFiles: (files) => stageFiles(files),
  });

  /* ─── Files waiting in the upload dialog ─── */

  const stageFiles = (files: PickedFile[]) => {
    if (files.length === 0) return;
    setStagedFiles((prev) => [...prev, ...files]);
    setUploadFileOpen(true);
  };

  const clearStagedFiles = () => {
    setStagedFiles([]);
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadStagedFiles = () => {
    if (stagedFiles.length === 0) return;
    void uploadFiles(stagedFiles);
  };

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

  const downloadFileQuiet = async (fileId: string, fileName: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const token = localStorage.getItem("garage_tok");
    const downloadUrl = `${baseUrl}/cabinet/files/${fileId}/stream?organizationId=${organizationId}`;

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
    window.URL.revokeObjectURL(blobUrl);
  };

  const downloadSelectedOrAll = async () => {
    toast.loading("Preparing download...");
    try {
      const token = localStorage.getItem("garage_tok");
      // No query params — POST /cabinet/download only
      const downloadUrl = `${API_URL.replace(/\/+$/, "")}/cabinet/download`;
      const response = await fetch(downloadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,        },
      });

      if (!response.ok) {
        const text = await response.text();
        let msg = `Download failed (${response.status})`;
        try {
          const j = JSON.parse(text);
          msg = j.error || j.message || msg;
        } catch {}
        throw new Error(msg);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
      const fileName = match
        ? match[1].replace(/['"]/g, "")
        : "cabinet-download.zip";

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.dismiss();
      toast.success("Download started");
    } catch (error) {
      console.error("Error downloading items:", error);
      toast.dismiss();
      toast.error(error instanceof Error ? error.message : "Failed to download");
    }
  };
  downloadAllRef.current = downloadSelectedOrAll;

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const fileIds = (cabinetContents?.files || []).map((f) => f._id);
    const folderIds = (cabinetContents?.subCabinets || []).map((c) => c._id);
    const allIds = [...fileIds, ...folderIds];
    setSelectedIds((prev) => {
      if (allIds.length > 0 && allIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(allIds);
    });
  };

  const toggleStarred = (fileId: string) => {
    setStarredIds((prev) => {
      const next = prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId];
      localStorage.setItem("cabinet_starred_files", JSON.stringify(next));
      toast.success(prev.includes(fileId) ? "Removed from Starred" : "Added to Starred");
      return next;
    });
  };

  const getFileTypeBadge = (mimeType: string, fileName?: string) => {
    const name = (fileName || "").toLowerCase();
    const mime = (mimeType || "").toLowerCase();
    if (mime.includes("pdf") || name.endsWith(".pdf")) {
      return { label: "PDF", className: "bg-[#E53935] text-white" };
    }
    if (mime.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) {
      return { label: "DOC", className: "bg-[#1E88E5] text-white" };
    }
    if (mime.includes("excel") || mime.includes("spreadsheet") || name.endsWith(".xls") || name.endsWith(".xlsx")) {
      return { label: "XLS", className: "bg-[#43A047] text-white" };
    }
    if (mime.includes("powerpoint") || mime.includes("presentation") || name.endsWith(".ppt") || name.endsWith(".pptx")) {
      return { label: "PPT", className: "bg-[#FB8C00] text-white" };
    }
    if (mime.includes("csv") || name.endsWith(".csv")) {
      return { label: "CSV", className: "bg-[#2E7D32] text-white" };
    }
    if (mime.startsWith("text/") || name.endsWith(".txt")) {
      return { label: "TXT", className: "bg-[color:color-mix(in_srgb,var(--brand-2)_90%,white)] text-black" };
    }
    if (mime.startsWith("image/")) {
      return { label: "IMG", className: "bg-[#8E24AA] text-white" };
    }
    if (isVideoMime(mime)) {
      return { label: "VID", className: "bg-[#D81B60] text-white" };
    }
    return { label: "FILE", className: "bg-[#546E7A] text-white" };
  };

  const formatModifiedDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
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

  const openSharedFileInNewTab = async (fileId: string) => {
    try {
      const response = await api<{
        success: boolean;
        data: { downloadUrl: string };
      }>(`/cabinet/shared/files/${fileId}/download?organizationId=${organizationId}`);

      window.open(response.data.downloadUrl, "_blank");
    } catch (error) {
      console.error("Error opening shared file:", error);
      toast.error("Failed to open shared file");
    }
  };

  const openSharedMediaPreview = async (
    fileId: string,
    fileName: string,
    mimeType: string
  ) => {
    try {
      const response = await api<{
        success: boolean;
        data: { downloadUrl: string };
      }>(`/cabinet/shared/files/${fileId}/download?organizationId=${organizationId}`);

      setMediaPreview({
        url: response.data.downloadUrl,
        type: mimeType,
        name: fileName,
      });
    } catch (error) {
      console.error("Error opening shared media preview:", error);
      toast.error("Failed to open media preview");
    }
  };

  const openMediaPreview = async (
    fileId: string,
    fileName: string,
    mimeType: string
  ) => {
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
    if (mimeType.startsWith("image/") || mimeType.startsWith("video/"))
      return true;
    // Additional video formats that might not have standard mime types
    const videoHints = [
      "webm",
      "x-matroska",
      "quicktime",
      "x-msvideo",
      "x-ms-wmv",
      "x-flv",
      "mp2t",
      "3gpp",
      "3gpp2",
      "ogg",
      "mpeg",
      "m4v",
    ];
    return videoHints.some((hint) => mimeType.toLowerCase().includes(hint));
  };

  // Check if file can be edited with ONLYOFFICE
  const isEditableWithOnlyOffice = (mimeType: string, fileName: string) => {
    if (!mimeType && !fileName) return false;
    const editableMimeTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
      "application/msword", // doc
      "application/vnd.ms-excel", // xls
      "application/vnd.ms-powerpoint", // ppt
    ];
    const editableExtensions = [
      ".docx",
      ".xlsx",
      ".pptx",
      ".doc",
      ".xls",
      ".ppt",
    ];

    if (mimeType && editableMimeTypes.includes(mimeType)) return true;
    if (fileName) {
      const lowerName = fileName.toLowerCase();
      return editableExtensions.some((ext) => lowerName.endsWith(ext));
    }
    return false;
  };

  // Convert uploaded file to collaborative document for editing
  const convertToCollaborativeDocument = async (
    fileId: string,
    fileName: string,
    mimeType: string
  ) => {
    if (!organizationId) {
      toast.error("No organization selected");
      return;
    }

    try {
      toast.loading("Converting file for editing...");

      // Determine document type from mime type or file extension
      let docType = "word";
      if (
        mimeType.includes("spreadsheet") ||
        mimeType.includes("excel") ||
        fileName.toLowerCase().endsWith(".xlsx") ||
        fileName.toLowerCase().endsWith(".xls")
      ) {
        docType = "cell";
      } else if (
        mimeType.includes("presentation") ||
        mimeType.includes("powerpoint") ||
        fileName.toLowerCase().endsWith(".pptx") ||
        fileName.toLowerCase().endsWith(".ppt")
      ) {
        docType = "slide";
      }

      const response = await api<{ success: boolean; data: any }>(
        `/cabinet/documents/from-file?organizationId=${organizationId}`,
        {
          method: "POST",
          body: JSON.stringify({
            fileId,
            title: fileName.replace(/\.[^/.]+$/, ""), // Remove extension from title
            type: docType,
          }),
        }
      );

      toast.dismiss();
      toast.success("File ready for editing!");

      // Open in overlay instead of navigating
      openDocumentInOverlay(response.data._id);
    } catch (error) {
      toast.dismiss();
      console.error("Error converting file:", error);
      toast.error("Failed to convert file for editing");
    }
  };

  const isImageType = (mimeType: string) => mimeType?.startsWith("image/");
  const isVideoType = (mimeType: string) => {
    if (!mimeType) return false;
    if (mimeType.startsWith("video/")) return true;
    const videoHints = [
      "webm",
      "x-matroska",
      "quicktime",
      "x-msvideo",
      "x-ms-wmv",
      "x-flv",
      "mp2t",
      "3gpp",
      "3gpp2",
      "ogg",
      "mpeg",
      "m4v",
    ];
    return videoHints.some((hint) => mimeType.toLowerCase().includes(hint));
  };

  // Component to show image/video thumbnail
  const FileThumbnail = ({
    fileId,
    mimeType,
    fileName,
  }: {
    fileId: string;
    mimeType: string;
    fileName: string;
  }) => {
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
          }>(
            `/cabinet/files/${fileId}/download?organizationId=${organizationId}`
          );
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
      return <span className="text-4xl">{getFileIcon(mimeType)}</span>;
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

      // Reload current cabinet contents
      if (currentCabinetId) {
        if (currentCabinetId === "root" && organizationId) {
          loadRootCabinets(organizationId);
        } else {
          loadCabinetContents(currentCabinetId);
        }
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      await api(
        `/cabinet/documents/${documentId}?organizationId=${organizationId}`,
        {
          method: "DELETE",
        }
      );

      toast.success("Document deleted successfully");

      // Reload collaborative documents
      if (organizationId) {
        loadCollaborativeDocuments(organizationId);
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const deleteCabinet = async (cabinetId: string) => {
    try {
      await api(`/cabinet/${cabinetId}`, {
        method: "DELETE",
      });

      toast.success("Cabinet deleted successfully");

      // Go back to parent or root
      if (currentCabinetId) {
        if (currentCabinetId === "root" && organizationId) {
          loadRootCabinets(organizationId);
        } else {
          loadCabinetContents(currentCabinetId);
        }
      }
    } catch (error) {
      console.error("Error deleting cabinet:", error);
      toast.error("Failed to delete cabinet");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`;
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

  const isVideoMime = (mimeType: string) => {
    if (!mimeType) return false;
    if (mimeType.startsWith("video/")) return true;
    const hints = [
      "x-matroska",
      "quicktime",
      "x-msvideo",
      "x-ms-wmv",
      "x-flv",
      "mp2t",
      "3gpp",
      "3gpp2",
      "webm",
      "mp4",
      "mpeg",
      "m4v",
      "ogg",
      "mxf",
      "x-mpegurl",
      "vnd.apple.mpegurl",
      "dash+xml",
    ];
    return hints.some((h) => mimeType.toLowerCase().includes(h));
  };

  const formatDuration = (seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return null;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const two = (n: number) => String(n).padStart(2, "0");
    return hrs > 0
      ? `${hrs}:${two(mins)}:${two(secs)}`
      : `${mins}:${two(secs)}`;
  };

  const VideoDurationLabel = ({
    fileId,
    mimeType,
  }: {
    fileId: string;
    mimeType: string;
  }) => {
    const [duration, setDuration] = useState<number | null>(null);

    useEffect(() => {
      let cancelled = false;
      if (!organizationId) return;
      if (!isVideoMime(mimeType)) return;

      (async () => {
        try {
          const res = await api<{
            success: boolean;
            data: { downloadUrl: string };
          }>(
            `/cabinet/files/${fileId}/download?organizationId=${organizationId}`
          );
          const downloadUrl = res.data.downloadUrl;
          const video = document.createElement("video");
          video.preload = "metadata";
          video.src = downloadUrl;
          const onLoaded = () => {
            if (!cancelled) {
              setDuration(video.duration || 0);
            }
            // Prevent further network loading
            video.removeAttribute("src");
            video.load();
          };
          const onError = () => {
            // ignore errors for duration
            video.removeAttribute("src");
            video.load();
          };
          video.addEventListener("loadedmetadata", onLoaded, { once: true });
          video.addEventListener("error", onError, { once: true });
        } catch (e) {
          // ignore
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [fileId, mimeType, organizationId]);

    const label = duration != null ? formatDuration(duration) : null;
    if (!label) return null;
    return (
      <p className="text-[10px] text-white/50">
        <Clock className="h-2 w-2 inline mr-1" />
        {label}
      </p>
    );
  };

  const shareItem = async (
    itemId: string,
    itemType: "file" | "cabinet" | "document",
    userId: string
  ) => {
    if (!organizationId) {
      toast.error("No organization selected");
      return;
    }

    try {
      // Handle collaborative documents differently
      if (itemType === "document") {
        await api(
          `/cabinet/documents/${itemId}/collaborators?organizationId=${organizationId}`,
          {
            method: "POST",
            body: JSON.stringify({
              collaboratorId: userId,
            }),
          }
        );
        toast.success("Collaborator added successfully");
        // Reload collaborative documents to refresh the collaborators list
        loadCollaborativeDocuments(organizationId);
      } else {
        await api(`/cabinet/share?organizationId=${organizationId}`, {
          method: "POST",
          body: JSON.stringify({
            itemId,
            itemType,
            sharedWithUserId: userId,
          }),
        });
        toast.success("Item shared successfully");
      }

      // Reload existing shares
      await loadExistingShares(itemId, itemType);
      setUserSearchQuery("");
    } catch (error) {
      console.error("Error sharing item:", error);
      toast.error("Failed to share item");
    }
  };

  const removeShare = async (shareId: string) => {
    try {
      // Handle collaborative documents differently
      if (selectedItemForShare?.type === "document") {
        await api(
          `/cabinet/documents/${selectedItemForShare.id}/collaborators/${shareId}?organizationId=${organizationId}`,
          {
            method: "DELETE",
          }
        );
        toast.success("Collaborator removed successfully");
        // Reload collaborative documents to refresh the list
        loadCollaborativeDocuments(organizationId);
      } else {
        await api(
          `/cabinet/share/${shareId}?organizationId=${organizationId}`,
          {
            method: "DELETE",
          }
        );
        toast.success("Share removed successfully");
      }

      // Reload existing shares
      if (selectedItemForShare) {
        loadExistingShares(selectedItemForShare.id, selectedItemForShare.type);
      }
    } catch (error) {
      console.error("Error removing share:", error);
      toast.error("Failed to remove share/collaborator");
    }
  };

  const updateShareStatus = async (
    shareId: string,
    status: "accepted" | "declined"
  ) => {
    try {
      await api(`/cabinet/share/${shareId}?organizationId=${organizationId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      toast.success(`Share ${status} successfully`);
      loadSharedItems(); // Reload shared items
    } catch (error) {
      console.error("Error updating share status:", error);
      toast.error("Failed to update share status");
    }
  };

  const downloadSharedFile = async (fileId: string, fileName: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const token = localStorage.getItem("garage_tok");

      // Use the stream endpoint to download the file
      const downloadUrl = `${baseUrl}/cabinet/shared/files/${fileId}/stream?organizationId=${organizationId}`;

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

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading shared file:", error);
      toast.error("Failed to download file");
    }
  };

  const openSharedCabinet = async (cabinetId: string) => {
    try {
      const response = await api<{ success: boolean; data: any }>(
        `/cabinet/shared/cabinets/${cabinetId}?organizationId=${organizationId}`
      );

      setSharedContents(response.data);
      setSharedCabinetId(cabinetId);
      setActiveTab("shared");
      if (response.data.cabinet) {
        sharedHistoryRef.current[response.data.cabinet.name] =
          response.data.cabinet._id;
        setSharedPath(["Shared", response.data.cabinet.name]);
      } else {
        setSharedPath(["Shared"]);
      }
    } catch (error) {
      console.error("Error opening shared cabinet:", error);
      toast.error("Failed to open shared cabinet");
    }
  };

  const resetSharedRoot = () => {
    setActiveTab("shared");
    setSharedCabinetId(null);
    setSharedContents(null);
    setSharedPath(["Shared"]);
    setSelectedIds(new Set());
    if (organizationId) loadSharedItems();
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
        `${selectedItemForRename.type === "file" ? "File" : "Folder"
        } renamed successfully`
      );
      setRenameDialogOpen(false);
      setSelectedItemForRename(null);
      setNewNameForRename("");

      // Reload current cabinet contents
      if (currentCabinetId) {
        if (currentCabinetId === "root" && organizationId) {
          loadRootCabinets(organizationId);
        } else {
          loadCabinetContents(currentCabinetId);
        }
      }
    } catch (error) {
      console.error("Error renaming item:", error);
      toast.error("Failed to rename item");
    }
  };

  const openShareLinkDialog = async (fileId: string, fileName: string) => {
    setSelectedFileForLink({ id: fileId, name: fileName });
    setShareableLinks({});
    setShareLinkDialogOpen(true);

    // Load existing links for this file
    try {
      const response = await api<{
        success: boolean;
        data: Array<{
          token: string;
          linkType: "internal" | "external";
          url: string;
          expiresAt: string;
          accessCount: number;
          maxAccessCount: number;
          status: string;
        }>;
      }>(
        `/cabinet/files/${fileId}/share-links?organizationId=${organizationId}`
      );

      const links: typeof shareableLinks = {};
      for (const link of response.data) {
        if (link.status === "active") {
          links[link.linkType] = {
            url: link.url,
            expiresAt: link.expiresAt,
            accessCount: link.accessCount,
            maxAccessCount: link.maxAccessCount,
          };
        }
      }
      setShareableLinks(links);
    } catch (error) {
      console.error("Error loading existing links:", error);
    }
  };

  const createShareableLink = async (linkType: "internal" | "external") => {
    if (!selectedFileForLink?.id || !organizationId) {
      toast.error("No file selected to share");
      return;
    }

    setLoadingLinkType(linkType);
    try {
      const response = await api<{
        success: boolean;
        data: {
          token: string;
          linkType: "internal" | "external";
          url: string;
          expiresAt: string;
          accessCount: number;
          maxAccessCount: number;
          isNew: boolean;
        };
      }>(
        `/cabinet/files/${selectedFileForLink.id}/share-link?organizationId=${organizationId}`,
        {
          method: "POST",
          body: JSON.stringify({ linkType }),
        }
      );

      const linkData = {
        url: response.data.url,
        expiresAt: response.data.expiresAt,
        accessCount: response.data.accessCount,
        maxAccessCount: response.data.maxAccessCount,
      };

      setShareableLinks((prev) => ({
        ...prev,
        [linkType]: linkData,
      }));

      // Every link this page hands out carries the sharer's affiliate ref.
      const link = withAffiliateRef(response.data.url, affiliateId);

      await navigator.clipboard.writeText(link);
      toast.success(
        response.data.isNew
          ? "Link created and copied to clipboard!"
          : "Link copied to clipboard!"
      );
    } catch (error) {
      console.error("Error creating shareable link:", error);
      toast.error("Failed to create shareable link");
    } finally {
      setLoadingLinkType(null);
    }
  };

  const dropTargetName = cabinetContents?.cabinet?.name || "My Cabinet";

  const copyLinkToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-transparent" {...dropZoneProps}>
      <CabinetDropOverlay visible={isDraggingFiles} targetName={dropTargetName} />
      <CabinetUploadProgress progress={uploadProgress} />

      {/* Header: breadcrumb + My files/Shared + filters */}
      <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-white/55 min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (activeTab === "shared") {
                    resetSharedRoot();
                  } else if (organizationId) {
                    loadRootCabinets(organizationId, contentFilter);
                  }
                }}
                className="font-medium hover:text-white transition-colors shrink-0"
              >
                My Cabinet
              </button>
              {activeTab === "personal"
                ? path
                    .filter((p) => p !== "Home" && p !== "Shared")
                    .map((segment, idx, arr) => (
                      <span key={`${segment}-${idx}`} className="flex items-center gap-1.5 min-w-0">
                        <ChevronRight className="h-3.5 w-3.5 text-white/30 shrink-0" />
                        <button
                          type="button"
                          onClick={() => {
                            const folderId = cabinetHistoryRef.current[segment];
                            if (folderId) loadCabinetContents(folderId, contentFilter);
                          }}
                          className={cn(
                            "truncate transition-colors",
                            idx === arr.length - 1
                              ? "text-white/80 font-medium"
                              : "text-white/45 hover:text-white/70"
                          )}
                        >
                          {segment}
                        </button>
                      </span>
                    ))
                : sharedPath
                    .filter((p) => p !== "Shared")
                    .map((segment, idx, arr) => (
                      <span key={`shared-${segment}-${idx}`} className="flex items-center gap-1.5 min-w-0">
                        <ChevronRight className="h-3.5 w-3.5 text-white/30 shrink-0" />
                        <button
                          type="button"
                          onClick={() => {
                            const folderId = sharedHistoryRef.current[segment];
                            if (folderId) void openSharedCabinet(folderId);
                          }}
                          className={cn(
                            "truncate transition-colors",
                            idx === arr.length - 1
                              ? "text-white/80 font-medium"
                              : "text-white/45 hover:text-white/70"
                          )}
                        >
                          {segment}
                        </button>
                      </span>
                    ))}
            </div>

            <div className="hidden sm:block h-5 w-px bg-white/20" />

            <div className="flex items-center gap-0.5 bg-white/5 rounded-full p-0.5 border border-white/10">
              <button
                onClick={() => {
                  setActiveTab("personal");
                  setSelectedIds(new Set());
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                  activeTab === "personal"
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-white/60 hover:text-white"
                )}
              >
                My files
              </button>
              <button
                onClick={() => {
                  setActiveTab("shared");
                  setSelectedIds(new Set());
                  if (!sharedCabinetId && organizationId) loadSharedItems();
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                  activeTab === "shared"
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-white/60 hover:text-white"
                )}
              >
                Shared
              </button>
            </div>
          </div>

          {activeTab === "personal" && (
            <div className="flex items-center gap-4 sm:gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CONTENT_FILTERS.map((filter) => {
                const Icon = filter.icon;
                const active = contentFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => applyContentFilter(filter.id)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap transition-colors",
                      active
                        ? "text-white"
                        : "text-white/45 hover:text-white/70"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs opened via bottom nav */}
      <Dialog open={createCabinetOpen} onOpenChange={setCreateCabinetOpen}>
        <DialogContent className="border-0 shadow-xl bg-[#1a1a1a]">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Folder Name</label>
              <Input
                value={newCabinetName}
                onChange={(e) => setNewCabinetName(e.target.value)}
                placeholder="Enter folder name"
                className="border border-white/15 bg-white/5 focus-visible:border-white/30 focus-visible:ring-0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Description (Optional)</label>
              <Input
                value={newCabinetDescription}
                onChange={(e) => setNewCabinetDescription(e.target.value)}
                placeholder="Enter description"
                className="border border-white/15 bg-white/5 focus-visible:border-white/30 focus-visible:ring-0"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setCreateCabinetOpen(false)}
                className="border border-white/15 bg-transparent hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button onClick={createCabinet}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Paste, drop and the picker all stage here first */}
      <CabinetUploadReviewDialog
        open={uploadFileOpen}
        onOpenChange={(open) => {
          setUploadFileOpen(open);
          // Closing the dialog throws away anything not sent yet — otherwise
          // a forgotten screenshot rides along with the next upload.
          if (!open) clearStagedFiles();
        }}
        files={stagedFiles}
        destination={dropTargetName}
        onRemove={removeStagedFile}
        onClear={clearStagedFiles}
        onConfirm={uploadStagedFiles}
        onAddFiles={(picked) => stageFiles(toPickedFiles(picked))}
        uploading={uploadingFile}
        progress={uploadProgress}
      />

      {/* Subtle Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Content */}
      <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto bg-transparent">
        {activeTab === "personal" ? (
          loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <div className="flex flex-col items-center space-y-3 sm:space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-white/20 border-t-yellow-400"></div>
                <p className="text-white/80 text-sm sm:text-base">Loading files...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-gray-500">
              <div className="text-center px-4">
                <p className="text-base sm:text-lg font-medium text-red-400 mb-2">Error</p>
                <p className="text-xs sm:text-sm mb-4 text-white/80">{error}</p>
                <Button
                  onClick={() => {
                    if (organizationId) {
                      loadRootCabinets(organizationId, contentFilter);
                    } else {
                      window.location.reload();
                    }
                  }}
                  variant="outline"
                  className="text-xs sm:text-sm h-8 sm:h-10"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full rounded-2xl bg-white/[0.02] border border-white/[0.06] p-2 sm:p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_96px] sm:grid-cols-[minmax(0,1fr)_180px_120px_96px] gap-3 sm:gap-6 items-center px-3 sm:px-5 py-2.5 rounded-full bg-[#1a1a1a] text-[11px] sm:text-xs text-white/50 font-medium">
                <div>File Name</div>
                <div className="hidden sm:block">Modified Date</div>
                <div className="hidden sm:block">File Size</div>
                <div />
              </div>

              <div className="divide-y divide-white/[0.06]">
                {(cabinetContents?.files || [])
                  .filter(
                    (file) =>
                      searchQuery === "" ||
                      file.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((file) => {
                    const badge = getFileTypeBadge(file.mimeType, file.name);
                    const isStarred = starredIds.includes(file._id);
                    return (
                      <div
                        key={file._id}
                        className="grid grid-cols-[minmax(0,1fr)_96px] sm:grid-cols-[minmax(0,1fr)_180px_120px_96px] gap-3 sm:gap-6 px-3 sm:px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors group"
                      >
                        <button
                          type="button"
                          className="flex items-center gap-3 min-w-0 text-left"
                          onClick={() => {
                            if (isPreviewableMedia(file.mimeType)) {
                              openMediaPreview(
                                file._id,
                                file.name || file.originalName,
                                file.mimeType
                              );
                            } else {
                              openFileInNewTab(file._id);
                            }
                          }}
                        >
                          <span
                            className={cn(
                              "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-[10px] font-bold tracking-wide",
                              badge.className
                            )}
                          >
                            {badge.label}
                          </span>
                          <span className="truncate text-sm text-white">
                            {file.name || file.originalName}
                          </span>
                        </button>
                        <div className="hidden sm:block text-sm text-white/45">
                          {formatModifiedDate(file.updatedAt || file.createdAt)}
                        </div>
                        <div className="hidden sm:block text-sm text-white/45">
                          {formatFileSize(file.size)}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center text-white/45 hover:text-white transition-colors"
                            onClick={() => {
                              if (isPreviewableMedia(file.mimeType)) {
                                openMediaPreview(
                                  file._id,
                                  file.name || file.originalName,
                                  file.mimeType
                                );
                              } else {
                                openFileInNewTab(file._id);
                              }
                            }}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {/* Share sits on the row itself — copying the public
                              affiliate link is the common case and was buried
                              in the overflow menu. */}
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center text-white/45 hover:text-white transition-colors"
                            onClick={() =>
                              void copyAffiliateLink(
                                file._id,
                                file.name || file.originalName
                              )
                            }
                            title={
                              affiliateId
                                ? "Copy affiliate share link"
                                : "Copy share link"
                            }
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center text-white/45 hover:text-white transition-colors"
                            onClick={() =>
                              downloadFile(file._id, file.name || file.originalName)
                            }
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "h-8 w-8 inline-flex items-center justify-center transition-colors",
                              isStarred
                                ? "text-brand"
                                : "text-white/45 hover:text-white"
                            )}
                            onClick={() => toggleStarred(file._id)}
                            title="Star"
                          >
                            <Star
                              className={cn(
                                "h-4 w-4",
                                isStarred && "fill-current"
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center text-white/45 hover:text-white transition-colors"
                            onClick={() => {
                              setSelectedItemForShare({
                                id: file._id,
                                type: "file",
                                name: file.name || file.originalName,
                              });
                              setShareModalTab("add");
                              setUserSearchQuery("");
                              setSelectedUsersForShare([]);
                              setShareItemOpen(true);
                              loadOrganizationMembers();
                              loadExistingShares(file._id, "file");
                            }}
                            title="Share"
                          >
                            <Link className="h-4 w-4" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center text-white/45 hover:text-white transition-colors"
                                title="More actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-[#1a1a1a] border border-white/10 text-white"
                            >
                              <DropdownMenuItem
                                onClick={() =>
                                  openShareLinkDialog(
                                    file._id,
                                    file.name || file.originalName
                                  )
                                }
                                className="cursor-pointer focus:bg-white/10"
                              >
                                <Globe className="h-4 w-4 mr-2" />
                                Shareable link options
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  downloadFile(
                                    file._id,
                                    file.name || file.originalName
                                  )
                                }
                                className="cursor-pointer focus:bg-white/10"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedItemForRename({
                                    id: file._id,
                                    type: "file",
                                    name: file.name || file.originalName,
                                  });
                                  setNewNameForRename(
                                    file.name || file.originalName
                                  );
                                  setRenameDialogOpen(true);
                                }}
                                className="cursor-pointer focus:bg-white/10"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}

                {(cabinetContents?.subCabinets || [])
                  .filter(
                    (cabinet) =>
                      searchQuery === "" ||
                      cabinet.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((cabinet) => (
                    <div
                      key={cabinet._id}
                      className="grid grid-cols-[minmax(0,1fr)_96px] sm:grid-cols-[minmax(0,1fr)_180px_120px_96px] gap-3 sm:gap-6 px-3 sm:px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors group"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-3 min-w-0 text-left"
                        onClick={() =>
                          loadCabinetContents(cabinet._id, contentFilter)
                        }
                      >
                        <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md bg-brand text-brand-foreground">
                          <Folder className="h-4 w-4" />
                        </span>
                        <span className="truncate text-sm text-white">
                          {cabinet.name}
                        </span>
                      </button>
                      <div className="hidden sm:block text-sm text-white/45">
                        {formatModifiedDate(cabinet.updatedAt || cabinet.createdAt)}
                      </div>
                      <div className="hidden sm:block text-sm text-white/45">—</div>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center text-white/45 hover:text-white transition-colors"
                          onClick={() => {
                            setSelectedItemForShare({
                              id: cabinet._id,
                              type: "cabinet",
                              name: cabinet.name,
                            });
                            setShareModalTab("add");
                            setUserSearchQuery("");
                            setSelectedUsersForShare([]);
                            setShareItemOpen(true);
                            loadOrganizationMembers();
                            loadExistingShares(cabinet._id, "cabinet");
                          }}
                          title="Share"
                        >
                          <Link className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                {(cabinetContents?.files?.length || 0) === 0 &&
                  (cabinetContents?.subCabinets?.length || 0) === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-white/50">
                      <HardDrive className="h-12 w-12 mb-3 text-white/30" />
                      <p className="text-sm">{getEmptyFilterMessage(contentFilter)}</p>
                    </div>
                  )}
              </div>
            </div>
          )
        ) : // Shared Files Tab — fully separate from My files
          sharedLoading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <div className="flex flex-col items-center space-y-3 sm:space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-white/20 border-t-yellow-400"></div>
                <p className="text-white/80 text-sm sm:text-base">Loading shared items...</p>
              </div>
            </div>
          ) : sharedCabinetId && sharedContents ? (
            /* Inside a shared folder (shared-only state) */
            <div className="w-full rounded-2xl bg-white/[0.02] border border-white/[0.06] p-2 sm:p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_96px] sm:grid-cols-[minmax(0,1fr)_180px_120px_96px] gap-3 sm:gap-6 items-center px-3 sm:px-5 py-2.5 rounded-full bg-[#1a1a1a] text-[11px] sm:text-xs text-white/50 font-medium">
                <div>File Name</div>
                <div className="hidden sm:block">Modified Date</div>
                <div className="hidden sm:block">File Size</div>
                <div />
              </div>

              <div className="divide-y divide-white/[0.06]">
                {(sharedContents?.files || []).map((file) => {
                  const badge = getFileTypeBadge(file.mimeType, file.name);
                  const isStarred = starredIds.includes(file._id);
                  return (
                    <div
                      key={file._id}
                      className="grid grid-cols-[minmax(0,1fr)_96px] sm:grid-cols-[minmax(0,1fr)_180px_120px_96px] gap-3 sm:gap-6 px-3 sm:px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors group"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-3 min-w-0 text-left"
                        onClick={() => {
                          if (isPreviewableMedia(file.mimeType)) {
                            openSharedMediaPreview(
                              file._id,
                              file.name || file.originalName,
                              file.mimeType
                            );
                          } else {
                            openSharedFileInNewTab(file._id);
                          }
                        }}
                      >
                        <span
                          className={cn(
                            "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-[10px] font-bold tracking-wide",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                        <span className="truncate text-sm text-white">
                          {file.name || file.originalName}
                        </span>
                      </button>
                      <div className="hidden sm:block text-sm text-white/45">
                        {formatModifiedDate(file.updatedAt || file.createdAt)}
                      </div>
                      <div className="hidden sm:block text-sm text-white/45">
                        {formatFileSize(file.size)}
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center text-white/45 hover:text-white transition-colors"
                          onClick={() =>
                            downloadSharedFile(
                              file._id,
                              file.name || file.originalName
                            )
                          }
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "h-8 w-8 inline-flex items-center justify-center transition-colors",
                            isStarred
                              ? "text-brand"
                              : "text-white/45 hover:text-white"
                          )}
                          onClick={() => toggleStarred(file._id)}
                          title="Star"
                        >
                          <Star
                            className={cn(
                              "h-4 w-4",
                              isStarred && "fill-current"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(sharedContents?.subCabinets || []).map((cabinet) => (
                  <div
                    key={cabinet._id}
                    className="grid grid-cols-[minmax(0,1fr)_96px] sm:grid-cols-[minmax(0,1fr)_180px_120px_96px] gap-3 sm:gap-6 px-3 sm:px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors group"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-3 min-w-0 text-left"
                      onClick={() => openSharedCabinet(cabinet._id)}
                    >
                      <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md bg-brand text-brand-foreground">
                        <Folder className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm text-white">
                        {cabinet.name}
                      </span>
                    </button>
                    <div className="hidden sm:block text-sm text-white/45">
                      {formatModifiedDate(cabinet.updatedAt || cabinet.createdAt)}
                    </div>
                    <div className="hidden sm:block text-sm text-white/45">—</div>
                    <div />
                  </div>
                ))}

                {(sharedContents?.files?.length || 0) === 0 &&
                  (sharedContents?.subCabinets?.length || 0) === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-white/50">
                      <HardDrive className="h-12 w-12 mb-3 text-white/30" />
                      <p className="text-sm">No files in this folder</p>
                    </div>
                  )}
              </div>
            </div>
          ) : sharedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/50">
              <Users className="h-12 w-12 mb-3 text-white/30" />
              <p className="text-sm mb-1">No shared items</p>
              <p className="text-xs text-white/40 text-center max-w-sm">
                Files or folders shared with you will appear here.
              </p>
            </div>
          ) : (
            <div className="w-full rounded-2xl bg-white/[0.02] border border-white/[0.06] p-2 sm:p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_96px] sm:grid-cols-[minmax(0,1fr)_180px_120px_96px] gap-3 sm:gap-6 items-center px-3 sm:px-5 py-2.5 rounded-full bg-[#1a1a1a] text-[11px] sm:text-xs text-white/50 font-medium">
                <div>File Name</div>
                <div className="hidden sm:block">Modified Date</div>
                <div className="hidden sm:block">File Size</div>
                <div />
              </div>

              <div className="divide-y divide-white/[0.06]">
                {sharedItems
                  .filter(
                    (item) =>
                      searchQuery === "" ||
                      item.item?.name
                        ?.toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      (item.item as any)?.title
                        ?.toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      item.owner.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())
                  )
                  .map((sharedItem) => {
                    const fileItem =
                      sharedItem.itemType === "file"
                        ? (sharedItem.item as CabinetFile | undefined)
                        : undefined;
                    const name =
                      sharedItem.item?.name ||
                      (sharedItem.item as any)?.title ||
                      "Untitled";
                    const badge =
                      sharedItem.itemType === "cabinet"
                        ? null
                        : sharedItem.itemType === "document"
                          ? { label: "DOC", className: "bg-[#1E88E5] text-white" }
                          : getFileTypeBadge(
                              fileItem?.mimeType || "",
                              name
                            );
                    const isStarred = starredIds.includes(sharedItem.itemId);

                    return (
                      <div
                        key={sharedItem._id}
                        className="grid grid-cols-[minmax(0,1fr)_96px] sm:grid-cols-[minmax(0,1fr)_180px_120px_96px] gap-3 sm:gap-6 px-3 sm:px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors group"
                      >
                        <button
                          type="button"
                          className="flex items-center gap-3 min-w-0 text-left"
                          onClick={() => {
                            if (sharedItem.itemType === "cabinet") {
                              openSharedCabinet(sharedItem.itemId);
                            } else if (sharedItem.itemType === "document") {
                              openDocumentInOverlay(sharedItem.itemId);
                            } else if (sharedItem.itemType === "file") {
                              const mimeType = fileItem?.mimeType || "";
                              if (isPreviewableMedia(mimeType)) {
                                openSharedMediaPreview(
                                  sharedItem.itemId,
                                  name,
                                  mimeType
                                );
                              } else {
                                openSharedFileInNewTab(sharedItem.itemId);
                              }
                            }
                          }}
                        >
                          {sharedItem.itemType === "cabinet" ? (
                            <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md bg-brand text-brand-foreground">
                              <Folder className="h-4 w-4" />
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-[10px] font-bold tracking-wide",
                                badge?.className
                              )}
                            >
                              {badge?.label}
                            </span>
                          )}
                          <span className="min-w-0 flex flex-col">
                            <span className="truncate text-sm text-white">
                              {name}
                            </span>
                            <span className="truncate text-[11px] text-white/40">
                              Shared by {sharedItem.owner.name}
                            </span>
                          </span>
                        </button>
                        <div className="hidden sm:block text-sm text-white/45">
                          {formatModifiedDate(
                            sharedItem.updatedAt || sharedItem.createdAt
                          )}
                        </div>
                        <div className="hidden sm:block text-sm text-white/45">
                          {fileItem?.size != null
                            ? formatFileSize(fileItem.size)
                            : "—"}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {sharedItem.itemType === "file" && (
                            <button
                              type="button"
                              className="h-8 w-8 inline-flex items-center justify-center text-white/45 hover:text-white transition-colors"
                              onClick={() =>
                                downloadSharedFile(sharedItem.itemId, name)
                              }
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          {sharedItem.itemType === "file" && (
                            <button
                              type="button"
                              className={cn(
                                "h-8 w-8 inline-flex items-center justify-center transition-colors",
                                isStarred
                                  ? "text-brand"
                                  : "text-white/45 hover:text-white"
                              )}
                              onClick={() => toggleStarred(sharedItem.itemId)}
                              title="Star"
                            >
                              <Star
                                className={cn(
                                  "h-4 w-4",
                                  isStarred && "fill-current"
                                )}
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
      </div>

      {/* Share Dialog */}
      <Dialog open={shareItemOpen} onOpenChange={setShareItemOpen}>
        <DialogContent className="!max-w-3xl !w-full bg-gradient-to-br backdrop-blur-xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <Share2 className="h-5 w-5 text-yellow-400" />
              {selectedItemForShare?.type === "document"
                ? "Add Collaborators"
                : `Share ${selectedItemForShare?.type === "file" ? "File" : "Folder"
                }`}
            </DialogTitle>
            {selectedItemForShare?.type === "document" && (
              <p className="text-white/60 text-sm">
                Collaborators can view and edit this document in real-time
              </p>
            )}
          </DialogHeader>

          <div className="space-y-6">
            {/* Existing Shares */}
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="space-y-3 w-full">
                {/* <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-green-400" />
                  <label className="text-sm font-semibold text-white">
                    File Details
                  </label>
                </div> */}
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedItemForShare?.type === "document"
                        ? "bg-gradient-to-br from-purple-400 to-blue-500"
                        : "bg-gradient-to-br from-yellow-400 to-orange-500"
                      }`}
                  >
                    {selectedItemForShare?.type === "document" ? (
                      <FileText className="h-4 w-4 text-white" />
                    ) : selectedItemForShare?.type === "file" ? (
                      <File className="h-4 w-4 text-white" />
                    ) : (
                      <Folder className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {selectedItemForShare?.name}
                    </p>
                    <p className="text-white/60 text-xs">Ready to share</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Add New Share */}

            <div className="space-y-3">
              <div className="flex items-center gap-4 w-full">
                <div
                  className={`flex items-center gap-2 p-2 rounded-lg !cursor-pointer hover:bg-blue-500/20 transition-all duration-200 ${shareModalTab === "add" ? "bg-blue-500/20" : "text-white/40"
                    }`}
                  onClick={() => setShareModalTab("add")}
                >
                  <Share2 className="h-4 w-4 text-blue-400" />
                  <label className="text-xs font-semibold text-white">
                    {selectedItemForShare?.type === "document"
                      ? "Add Collaborator"
                      : "Add New Share"}
                  </label>
                </div>

                <div
                  className={`flex items-center gap-2 p-2 rounded-lg !cursor-pointer hover:bg-green-500/20 transition-all duration-200 ${shareModalTab === "existing"
                      ? "bg-green-500/20"
                      : "text-white/40"
                    }`}
                  onClick={() => setShareModalTab("existing")}
                >
                  <Users className="h-4 w-4 text-green-400" />
                  <label className="text-xs font-semibold text-white">
                    {selectedItemForShare?.type === "document"
                      ? "Current Collaborators"
                      : "Currently Shared With"}
                  </label>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                    {existingShares.length}
                  </span>
                </div>
              </div>
              {/* Search Input */}

              {shareModalTab === "add" ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      placeholder="Search users..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400/50 focus:ring-blue-400/20"
                    />
                  </div>
                  {loadingMembers ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-blue-400"></div>
                    </div>
                  ) : (
                    <div className="max-h-64 grid overflow-x-hidden py-4 px-4 grid-cols-2 gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                      {organizationMembers
                        .filter(
                          (member) =>
                            !existingShares.some(
                              (share) => share.sharedWith._id === member._id
                            ) &&
                            (member.name
                              ?.toLowerCase()
                              .includes(userSearchQuery.toLowerCase()) ||
                              member.email
                                ?.toLowerCase()
                                .includes(userSearchQuery.toLowerCase()))
                        )
                        .map((member, index) => (
                          <div
                            key={member._id}
                            className={`group p-3 cursor-pointer rounded-xl border transition-all duration-200 hover:scale-[1.02] ${selectedUsersForShare.some(u => u._id === member._id)
                                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10"
                                : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-blue-400/30"
                              }`}
                            onClick={() => {
                              setSelectedUsersForShare(prev => {
                                const isSelected = prev.some(u => u._id === member._id);
                                if (isSelected) {
                                  return prev.filter(u => u._id !== member._id);
                                } else {
                                  return [...prev, member];
                                }
                              });
                            }}
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <div className="flex items-center space-x-3">
                              {member.profilePicture ? (
                                <img
                                  src={member.profilePicture}
                                  alt={member.name || "User"}
                                  className={`w-8 h-8 rounded-full object-cover shadow-lg transition-all duration-200 ${selectedUsersForShare.some(u => u._id === member._id)
                                      ? "ring-2 ring-blue-400 scale-110"
                                      : "group-hover:scale-105"
                                    }`}
                                />
                              ) : (
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg transition-all duration-200 ${selectedUsersForShare.some(u => u._id === member._id)
                                      ? "bg-gradient-to-br from-blue-500 to-purple-600 scale-110"
                                      : "bg-gradient-to-br from-blue-500 to-blue-600 group-hover:scale-105"
                                    }`}
                                >
                                  {member.name?.charAt(0)?.toUpperCase() ||
                                    member.email?.charAt(0)?.toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="text-white font-medium text-xs">
                                  {member.name || "No name"}
                                </p>
                                <p className="text-white/60 text-[10px]">
                                  {member.email}
                                </p>
                              </div>
                              {selectedUsersForShare.some(u => u._id === member._id) && (
                                <CheckCircle className="h-5 w-5 text-blue-400 animate-pulse" />
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3 w-full">
                  {loadingShares ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-yellow-400"></div>
                    </div>
                  ) : existingShares.length === 0 ? (
                    <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10">
                      <Users className="h-8 w-8 text-white/30 mx-auto mb-3" />
                      <p className="text-white/60 text-sm">Not shared with anyone yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {existingShares.map((share) => (
                        <div
                          key={share._id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
                        >
                          <div>
                            <p className="text-white text-sm">{share.sharedWith?.name || "No name"}</p>
                            <p className="text-white/60 text-xs">{share.sharedWith?.email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeShare(share._id)}
                            className="text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedUsersForShare.length > 0 && (
              <div className="flex justify-end pt-4 border-t border-white/10">
                <Button
                  onClick={async () => {
                    if (!selectedItemForShare) return;
                    for (const user of selectedUsersForShare) {
                      await shareItem(
                        selectedItemForShare.id,
                        selectedItemForShare.type,
                        user._id
                      );
                    }
                    setSelectedUsersForShare([]);
                  }}
                  className="bg-brand text-brand-foreground"
                >
                  Share
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newNameForRename}
              onChange={(e) => setNewNameForRename(e.target.value)}
              placeholder="New name"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={renameItem}>Rename</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shareable Link Dialog */}
      <Dialog open={shareLinkDialogOpen} onOpenChange={setShareLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shareable Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              onClick={() => {
                // The dialog sets `selectedFileForLink` before it opens; if it
                // is somehow empty, say so rather than no-op on the click.
                if (!selectedFileForLink?.id) {
                  toast.error("No file selected to share");
                  return;
                }
                void copyAffiliateLink(
                  selectedFileForLink.id,
                  selectedFileForLink.name
                );
              }}
              className="w-full"
            >
              <Copy className="h-4 w-4 mr-2" />
              {affiliateId
                ? "Copy Affiliate Share Link"
                : "Copy Public Share Link"}
            </Button>
            {affiliateId ? (
              <p className="text-[11px] text-white/45 -mt-1">
                Public link with your affiliate ref (<code>?ref={affiliateId}</code>)
                attached, so signups from it are credited to you.
              </p>
            ) : null}
            <Button
              onClick={() => createShareableLink("internal")}
              disabled={loadingLinkType === "internal"}
              className="w-full"
              variant="outline"
            >
              Create Internal Link
            </Button>
            <Button
              onClick={() => createShareableLink("external")}
              disabled={loadingLinkType === "external"}
              className="w-full"
              variant="outline"
            >
              Create Public Link
            </Button>
            {shareableLinks.internal && (
              <p className="text-xs text-white/60 break-all">{shareableLinks.internal.url}</p>
            )}
            {shareableLinks.external && (
              <p className="text-xs text-white/60 break-all">{shareableLinks.external.url}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AskFileDialog
        open={askOpen}
        onOpenChange={setAskOpen}
        fileId={askFile?.id || null}
        fileName={askFile?.name}
      />

      <MediaPreviewModal
        media={mediaPreview}
        onClose={() => setMediaPreview(null)}
      />

      <CreateDocumentDialog
        open={createDocumentOpen}
        onOpenChange={setCreateDocumentOpen}
        organizationId={organizationId}
        cabinetId={currentCabinetId === "root" ? null : currentCabinetId}
        onDocumentCreated={(documentId) => {
          loadCollaborativeDocuments(organizationId);
          openDocumentInOverlay(documentId);
        }}
      />

      {selectedDocumentId && (
        <DocumentEditorOverlay
          isOpen={editorOverlayOpen}
          onClose={() => {
            setEditorOverlayOpen(false);
            setSelectedDocumentId(null);
            loadCollaborativeDocuments(organizationId);
          }}
          documentId={selectedDocumentId}
          organizationId={organizationId}
          userId={currentUserId}
          userName={currentUserName}
          userEmail={currentUserEmail}
        />
      )}
    </div>
  );
}
