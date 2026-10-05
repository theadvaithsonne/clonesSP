"use client";

import DealsNavbar from "@/components/crm/DealsNavbar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pencil,
  Trash2,
  Eye,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  TrendingUp,
  Users,
  Download,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import FunnelFlow from "@/components/deals/FunnelFlow";
import { FunnelsDataTable } from "@/components/deals/funnel/FunnelsDataTable";
import type { SortState } from "@/components/ui/data-table/types";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { useDealsInlineRefresh } from "@/lib/deals-events";
import {
  FunnelApiResponse,
  FunnelsApiResponse,
  FunnelProduct,
} from "@/types/crm";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import ViewFunnelDialog from "@/components/crm/ViewFunnelDialog";
import DeleteLeadsDialog from "@/components/crm/leads/DeleteLeadsDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const FIGMA_STAGE_COLORS = [
  "#3b82f5",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
];

const SOFT_STAGE_COLORS = [
  { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.2)", text: "#3b82f6" },
  { bg: "rgba(139, 92, 246, 0.1)", border: "rgba(139, 92, 246, 0.2)", text: "#8b5cf6" },
  { bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.2)", text: "#10b981" },
  { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)", text: "#f59e0b" },
  { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
  { bg: "rgba(6, 182, 212, 0.1)", border: "rgba(6, 182, 212, 0.2)", text: "#06b6d4" },
  { bg: "rgba(236, 72, 153, 0.1)", border: "rgba(236, 72, 153, 0.2)", text: "#ec4899" },
  { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)", text: "#22c55e" },
];

// Define the type for your funnel data
type Funnel = {
  id: string;
  _id: string;
  funnelId: string;
  funnelName: string;
  funnelDesc?: string;
  products: FunnelProduct[];
  numberOfStages: number;
  ownerName?: string;
  activeLeads?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function FunnelsPage() {
  const { theme } = useTheme();
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
  const isFigma = isInlineDealsMode;
  const resolvedTheme =
    theme === "color" ? "color" : theme === "dark" || isInlineDealsMode ? "dark" : "light";
  const [isAdd, setIsAdd] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedFunnelIds, setSelectedFunnelIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Delete states
  const [deletingFunnel, setDeletingFunnel] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // View funnel states
  const [isViewFunnelOpen, setIsViewFunnelOpen] = useState(false);
  const [viewingFunnel, setViewingFunnel] = useState<any>(null);
  const [isLoadingFunnelDetails, setIsLoadingFunnelDetails] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalFunnels, setTotalFunnels] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [limit, setLimit] = useState(50);

  // Column sort for the BackOffice DataTable — applied to the loaded page, as
  // the funnels API paginates server-side and takes no sort parameter.
  const [funnelsSort, setFunnelsSort] = useState<SortState | null>(null);

  // Fetch funnels from API with pagination. `pageSize` is passed explicitly by
  // the records-per-page control so it doesn't read a stale `limit`.
  const fetchFunnels = async (page: number = currentPage, pageSize: number = limit) => {
    try {
      setLoading(true);
      setError(null);

      const skip = (page - 1) * pageSize; // Convert page to skip (0-based)
      const response = await authenticatedFetch(
        buildExternalUrl(`crm/funnels?skip=${skip}&limit=${pageSize}`),
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch funnels: ${response.statusText}`);
      }

      const data: FunnelsApiResponse = await response.json();
      console.log(data.funnels, "data");
      // Transform API data to match our Funnel type
      const transformedFunnels: Funnel[] = Array.isArray(data.funnels)
        ? data.funnels.map((funnel: FunnelApiResponse, index: number) => ({
          id: funnel.id || funnel._id || (index + 1).toString(),
          _id: funnel._id || funnel.id || (index + 1).toString(),
          funnelId:
            funnel.funnelId || `F${String(index + 1).padStart(3, "0")}`,
          funnelName:
            funnel.funnelName || funnel.name || `Funnel ${index + 1}`,
          funnelDesc: funnel.funnelDesc || "",
          products: funnel.products || funnel.funnelStage || [],
          numberOfStages:
            funnel.numberOfStages ||
            (funnel.funnelStage ? funnel.funnelStage.length : 0),
          ownerName: (() => { const cb = (funnel as any)?.createdby || (funnel as any)?.owner?.name || (funnel as any)?.ownerName || ""; return cb && cb.includes("@") ? cb : "--"; })(),
          activeLeads: (funnel as any)?.leadsCount ?? (funnel as any)?.activeLeads ?? (funnel as any)?.active_leads ?? 0,
          status: ((funnel as any)?.status || ((funnel as any)?.isActive ? "Active" : "Inactive")) as string,
          createdAt: funnel.createdAt,
          updatedAt: funnel.updatedAt,
        }))
        : [];

      setFunnels(transformedFunnels);

      // Update pagination info from API response
      if (data.total !== undefined) {
        setTotalFunnels(data.total);
        setTotalPages(Math.ceil(data.total / pageSize));
      } else if (data.pagination && data.pagination.total !== undefined) {
        setTotalFunnels(data.pagination.total);
        setTotalPages(Math.ceil(data.pagination.total / pageSize));
      } else {
        setTotalFunnels(transformedFunnels.length);
        setTotalPages(1);
      }

      console.log(transformedFunnels, "transformedFunnels");
    } catch (err) {
      console.error("Error fetching funnels:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch funnels");
      setFunnels([]); // Set empty array instead of dummy data
    } finally {
      setLoading(false);
    }
  };

  // Stage count badge with tag-style background color
  const renderStagesColumn = (funnel: Funnel) => {
    const label = `${funnel.numberOfStages} ${funnel.numberOfStages === 1 ? "stage" : "stages"}`;
    const colorIndex = Math.max(0, funnel.numberOfStages);
    if (isFigma) {
      return (
        <span
          className="px-2 py-0.5 rounded-[999px] text-[10px] font-semibold leading-[14px] text-white whitespace-nowrap"
          style={{ backgroundColor: FIGMA_STAGE_COLORS[colorIndex % FIGMA_STAGE_COLORS.length] }}
        >
          {label}
        </span>
      );
    }
    const color = SOFT_STAGE_COLORS[colorIndex % SOFT_STAGE_COLORS.length];
    return (
      <span
        className="text-[11px] font-bold px-2 h-[21.833px] inline-flex items-center rounded-[6px] border-[0.667px] whitespace-nowrap"
        style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
      >
        {label}
      </span>
    );
  };

  // Pagination functions
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchFunnels(page);
  };

  // Search functionality
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching

    if (term.trim()) {
      // Use search API when there's a search term
      await searchFunnels(term);
    } else {
      // Fetch normal paginated funnels when search is cleared
      await fetchFunnels(1);
    }
  };

  // Search funnels using the search API
  const searchFunnels = async (searchTerm: string) => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/searchfunnel?q=${encodeURIComponent(searchTerm)}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const searchResults = data.funnels || data || [];

        // Transform API data to match our Funnel type
        const transformedFunnels: Funnel[] = Array.isArray(searchResults)
          ? searchResults.map((funnel: any, index: number) => ({
            id: funnel.id || funnel._id || (index + 1).toString(),
            _id: funnel._id || funnel.id || (index + 1).toString(),
            funnelId: funnel.funnelId || `F${String(index + 1).padStart(3, "0")}`,
            funnelName: funnel.funnelName || funnel.name || `Funnel ${index + 1}`,
            funnelDesc: funnel.funnelDesc || "",
            products: funnel.products || funnel.funnelStage || [],
            numberOfStages: funnel.numberOfStages || (funnel.funnelStage ? funnel.funnelStage.length : 0),
            ownerName: (() => { const cb = funnel?.createdby || funnel?.owner?.name || funnel?.ownerName || ""; return cb && cb.includes("@") ? cb : "--"; })(),
            activeLeads: funnel?.leadsCount ?? funnel?.activeLeads ?? funnel?.active_leads ?? 0,
            status: (funnel?.status || (funnel?.isActive ? "Active" : "Inactive")) as string,
            createdAt: funnel.createdAt,
            updatedAt: funnel.updatedAt,
          }))
          : [];

        setFunnels(transformedFunnels);

        // For search results, we don't have pagination info, so we'll show all results
        setTotalFunnels(transformedFunnels.length);
        setTotalPages(1);
      } else {
        console.error("Failed to search funnels");
        // Fallback to normal fetch if search fails
        await fetchFunnels(1);
      }
    } catch (error) {
      console.error("Error searching funnels:", error);
      // Fallback to normal fetch if search fails
      await fetchFunnels(1);
    } finally {
      setLoading(false);
    }
  };

  // Refresh funnels
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFunnels();
    setRefreshing(false);
  };

  // Export funnels to Excel
  const handleExport = () => {
    try {
      // Prepare data for export
      const exportData = filteredFunnels.map((funnel) => ({
        "Funnel Name": funnel.funnelName,
        "Stages": `${funnel.numberOfStages} ${funnel.numberOfStages === 1 ? "stage" : "stages"}`,
        "Owner": funnel.ownerName || "--",
        "Active Leads": funnel.activeLeads ?? 0,
        "Status": funnel.status || "--",
        "Last Updated": funnel.updatedAt ? new Date(funnel.updatedAt).toLocaleDateString("en-CA") : "--",
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Funnels");

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      // Save file
      const fileName = `funnels_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      saveAs(data, fileName);

      toast.success("Funnels exported successfully!");
    } catch (error) {
      console.error("Error exporting funnels:", error);
      toast.error("Failed to export funnels. Please try again.");
    }
  };

  // Handle view funnel
  const handleViewFunnel = async (funnelId: string) => {
    if (!funnelId) return;

    setIsLoadingFunnelDetails(true);
    setIsViewFunnelOpen(true);

    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/funnels/${funnelId}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const funnelData = await response.json();
        setViewingFunnel(funnelData);
      } else {
        toast.error("Failed to load funnel details");
        setIsViewFunnelOpen(false);
      }
    } catch (error) {
      console.error("Error fetching funnel details:", error);
      toast.error("Failed to load funnel details");
      setIsViewFunnelOpen(false);
    } finally {
      setIsLoadingFunnelDetails(false);
    }
  };

  // Handle edit funnel
  const handleEditFunnel = (funnel: Funnel) => {
    setEditingFunnel(funnel);
    setIsEdit(true);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingFunnel(null);
    setIsEdit(false);
  };

  // Handle delete funnel
  const handleDeleteFunnel = (funnelId: string) => {
    setDeletingFunnel(funnelId);
    setIsDeleteModalOpen(true);
  };

  // Confirm delete funnel
  const confirmDeleteFunnel = async () => {
    if (!deletingFunnel) return;

    setIsDeleting(true);
    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`crm/funnels/${deletingFunnel}`),
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Refresh the funnels list
        await fetchFunnels();
        toast.success("Funnel deleted successfully!");
      } else {
        const errorData = await response.json();
        console.error("Failed to delete funnel:", errorData);
        toast.error(
          `Failed to delete funnel: ${errorData.message || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error deleting funnel:", error);
      toast.error(
        "Error deleting funnel: " +
        (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsDeleting(false);
      setDeletingFunnel(null);
      setIsDeleteModalOpen(false);
    }
  };

  const funnelPendingDelete = funnels.find(
    (f) => f._id === deletingFunnel || f.id === deletingFunnel
  );

  const openFilterDialog = () => {
    setDraftStatusFilter(statusFilter);
    setIsFilterDialogOpen(true);
  };

  const applyFilters = () => {
    setStatusFilter(draftStatusFilter);
    setIsFilterDialogOpen(false);
  };

  const resetFilters = () => {
    setDraftStatusFilter("all");
    setStatusFilter("all");
    setIsFilterDialogOpen(false);
  };

  // Filter funnels based on search term and status
  const filteredFunnels = funnels
    .filter((funnel) => {
      const matchesSearch =
        funnel.funnelId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        funnel.funnelName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && (funnel.status || "").toLowerCase() === "active") ||
        (statusFilter === "inactive" && (funnel.status || "").toLowerCase() === "inactive");
      return matchesSearch && matchesStatus;
    });

  const getFunnelUpdatedLabel = (funnel: Funnel) =>
    funnel.updatedAt ? new Date(funnel.updatedAt).toLocaleDateString("en-CA") : "";

  const sortedFunnels = useMemo(() => {
    if (!funnelsSort) return filteredFunnels;
    const direction = funnelsSort.order === "asc" ? 1 : -1;

    const keyOf = (funnel: Funnel): string | number => {
      switch (funnelsSort.by) {
        case "name":
          return (funnel.funnelName || "").toLowerCase();
        case "stages":
          return funnel.numberOfStages ?? 0;
        case "owner":
          return (funnel.ownerName || "").toLowerCase();
        case "activeLeads":
          return funnel.activeLeads ?? 0;
        case "status":
          return (funnel.status || "").toLowerCase();
        case "updatedAt": {
          const time = funnel.updatedAt ? new Date(funnel.updatedAt).getTime() : NaN;
          // Undated funnels sink to the bottom in both directions rather than
          // scattering through the list on an NaN comparison.
          return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
        }
        default:
          return "";
      }
    };

    return [...filteredFunnels].sort((a, b) => {
      const left = keyOf(a);
      const right = keyOf(b);
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right)) * direction;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFunnels, funnelsSort]);

  const displayedFunnelIds = filteredFunnels.map((f) => f._id || f.id).filter(Boolean);
  const selectedFunnelIdSet = new Set(selectedFunnelIds);
  const allDisplayedSelected =
    displayedFunnelIds.length > 0 &&
    displayedFunnelIds.every((id) => selectedFunnelIds.includes(id));
  const someDisplayedSelected =
    displayedFunnelIds.some((id) => selectedFunnelIds.includes(id)) && !allDisplayedSelected;

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFunnelIds((prev) => Array.from(new Set([...prev, ...displayedFunnelIds])));
    } else {
      setSelectedFunnelIds((prev) => prev.filter((id) => !displayedFunnelIds.includes(id)));
    }
  };

  const handleToggleFunnelSelection = (funnelId: string, checked: boolean) => {
    setSelectedFunnelIds((prev) =>
      checked ? (prev.includes(funnelId) ? prev : [...prev, funnelId]) : prev.filter((id) => id !== funnelId)
    );
  };

  const confirmBulkDelete = async () => {
    if (selectedFunnelIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const results = await Promise.all(
        selectedFunnelIds.map((id) =>
          authenticatedFetch(buildExternalUrl(`crm/funnels/${id}`), { method: "DELETE" })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed === 0) {
        toast.success(
          selectedFunnelIds.length === 1
            ? "Funnel deleted successfully!"
            : `${selectedFunnelIds.length} funnels deleted successfully!`
        );
      } else {
        toast.error(`Failed to delete ${failed} funnel${failed === 1 ? "" : "s"}`);
      }
      setSelectedFunnelIds([]);
      setIsBulkDeleteOpen(false);
      await fetchFunnels();
    } catch (error) {
      console.error("Error bulk deleting funnels:", error);
      toast.error("Failed to delete funnels. Please try again.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const figmaCheckboxClass =
    "h-[14px] w-[14px] rounded-full border-[1.5px] border-[#8c8c9e] data-[state=checked]:bg-[#8c8c9e] data-[state=checked]:text-[#181818]";

  console.log(filteredFunnels, "filteredFunnels");

  // Fetch funnels on component mount
  useEffect(() => {
    try {
      fetchFunnels();
    } catch (error) {
      console.error("Error in fetchFunnels on mount:", error);
      setError("Failed to load funnels. Please refresh the page.");
      setLoading(false);
    }
  }, []);

  // Refresh funnels when returning from FunnelFlow
  useEffect(() => {
    if (!isAdd && !isEdit) {
      fetchFunnels();
    }
  }, [isAdd, isEdit]);

  useEffect(() => {
    const onOpenAdd = () => setIsAdd(true);
    window.addEventListener("deals:open-add-funnel", onOpenAdd);
    return () => window.removeEventListener("deals:open-add-funnel", onOpenAdd);
  }, []);

  useDealsInlineRefresh("funnel", () => {
    fetchFunnels(currentPage);
  });

  const statusOptions: { id: "all" | "active" | "inactive"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "inactive", label: "Inactive" },
  ];

  const renderRowMenu = (funnel: Funnel) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={
            isFigma
              ? "h-[15px] w-[15px] p-0 text-[#9ca3af] hover:bg-transparent hover:text-[#e5e7eb]"
              : `h-7 w-7 ${
                  resolvedTheme === "color"
                    ? "hover:bg-[rgba(0,255,255,0.1)]"
                    : "hover:bg-muted/50"
                }`
          }
          aria-label="Funnel actions"
        >
          <MoreHorizontal
            className={
              isFigma
                ? "h-[15px] w-[15px] text-[#9ca3af]"
                : `h-4 w-4 ${
                    resolvedTheme === "color" || resolvedTheme === "dark"
                      ? "text-white"
                      : "text-black"
                  }`
            }
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={
          isFigma
            ? "bg-[#181818] border border-[#2a2d3a] text-white"
            : resolvedTheme === "color"
              ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
              : ""
        }
      >
        <DropdownMenuItem
          onClick={() => handleViewFunnel(funnel._id || funnel.id)}
          className={
            isFigma
              ? "text-white hover:bg-white/5"
              : resolvedTheme === "color"
                ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                : ""
          }
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleEditFunnel(funnel)}
          className={
            isFigma
              ? "text-white hover:bg-white/5"
              : resolvedTheme === "color"
                ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                : ""
          }
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleDeleteFunnel(funnel._id)}
          disabled={deletingFunnel === funnel._id}
          className={
            isFigma
              ? "text-red-400 hover:bg-red-500/10"
              : resolvedTheme === "color"
                ? "text-[rgba(255,100,100,0.9)] hover:bg-[rgba(255,0,0,0.1)]"
                : ""
          }
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {deletingFunnel === funnel._id ? "Deleting..." : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // BackOffice renders the shared DataTable, which has its own skeleton state —
  // only the standalone page swaps in a full-screen spinner.
  if (loading && funnels.length === 0 && !isFigma) {
    return (
      <div className={`flex h-screen overflow-hidden ${isFigma ? "bg-[#0e0e0e]" : "bg-background"}`}>
        <div className="flex-1 overflow-hidden flex flex-col">
          {!isInlineDealsMode && <DealsNavbar />}
          <div className="p-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw
                  className={`h-8 w-8 animate-spin mx-auto mb-4 ${isFigma ? "text-[#9ca3af]" : "text-gray-500"}`}
                />
                <p className={isFigma ? "text-[#9ca3af]" : "text-gray-600"}>Loading funnels...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen overflow-hidden min-w-0 ${isFigma ? "bg-[#0e0e0e]" : "bg-background"}`}
    >
      <div className={`flex-1 overflow-hidden flex flex-col min-w-0 ${isFigma ? "bg-[#0e0e0e]" : ""}`}>
        {!isInlineDealsMode && <DealsNavbar />}
        {/* BackOffice funnels use the shared DataTable, which owns its own
            vertical scroll (sticky header + pinned footer). Give it a bounded
            flex column there; the standalone page keeps page scroll. */}
        <div
          className={
            isFigma
              ? "flex h-full min-h-0 flex-col overflow-hidden min-w-0 pb-24 md:pb-0 bg-[#0e0e0e]"
              : `h-full overflow-y-auto overflow-x-hidden min-w-0 pb-24 md:pb-0 ${
                  resolvedTheme === "color" ? "bg-[#0A0E27]" : ""
                }`
          }
        >
          {isAdd && !isFigma ? (
            <FunnelFlow setIsAdd={setIsAdd} />
          ) : isEdit && editingFunnel && !isFigma ? (
            <FunnelFlow
              setIsAdd={setIsEdit}
              editingFunnel={editingFunnel}
              onCancel={handleCancelEdit}
            />
          ) : (
            <div
              className={
                isFigma
                  ? "flex min-h-0 flex-1 flex-col bg-[#0e0e0e]"
                  : resolvedTheme === "color"
                    ? "bg-[#0A0E27]"
                    : resolvedTheme === "dark"
                      ? "bg-[#1a1a1a]"
                      : "bg-white"
              }
            >
              {error && (
                <div
                  className={`mb-4 p-4 rounded-lg border ${
                    isFigma
                      ? "mx-5 mt-4 bg-[#181818] border-[#2a2d3a]"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <p className={`text-sm ${isFigma ? "text-[#e5e7eb]" : "text-red-700"}`}>
                    {error} - Please check your connection and try refreshing.
                  </p>
                </div>
              )}

              {isFigma ? (
                <div className="w-full max-w-full shrink-0">
                  <div className="bg-black px-[20px] pt-[20px] pb-[15px]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between overflow-clip">
                      <div className="relative h-[32px] w-full sm:w-[420px] min-w-0 rounded-[6px] border border-[#2a2d3a] bg-black px-[12px] py-[6px] flex items-center gap-[8px]">
                        <img
                          alt=""
                          src="/figma/deals/leads/search.svg"
                          className="h-[16px] w-[16px] shrink-0"
                        />
                        <Input
                          type="text"
                          placeholder="Search funnels..."
                          /* !bg-transparent: the inline Deals shell styles bare
                             `input` with a #16161f fill, which outranks a plain
                             bg utility and tinted this field navy. */
                          className="h-[20px] border-0 !bg-transparent p-0 text-[12px] text-[#e5e7eb] placeholder:text-[#9ca3af] focus-visible:ring-0 focus-visible:ring-offset-0"
                          value={searchTerm}
                          onChange={(e) => handleSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-[8px] shrink-0">
                        {selectedFunnelIds.length > 0 && (
                          <Button
                            variant="destructive"
                            className="flex items-center gap-2 h-[32px] px-[12px] py-[6px] rounded-[6px] text-[12px] font-semibold shrink-0"
                            onClick={() => setIsBulkDeleteOpen(true)}
                            disabled={isBulkDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Selected
                            <span className="text-xs font-medium text-white/80">
                              ({selectedFunnelIds.length})
                            </span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="h-[32px] px-[12px] py-[6px] rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] text-[12px] font-semibold shadow-none hover:bg-[#181818]"
                          onClick={openFilterDialog}
                        >
                          <img
                            alt=""
                            src="/figma/deals/leads/filter.svg"
                            className="h-[15px] w-[15px] mr-[8px]"
                          />
                          Filters
                          {statusFilter !== "all" && (
                            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] shadow-none hover:bg-[#181818]"
                          onClick={handleExport}
                          aria-label="Export funnels"
                        >
                          <img
                            alt=""
                            src="/figma/deals/leads/export.svg"
                            className="h-[15px] w-[15px]"
                          />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] shadow-none hover:bg-[#181818]"
                          onClick={() => setIsAdd(true)}
                          aria-label="Create funnel"
                        >
                          <Plus className="h-[15px] w-[15px]" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`border-b border-b-[0.667px] min-h-[64.667px] relative shrink-0 w-full max-w-full ${
                    resolvedTheme === "color"
                      ? "border-[rgba(0,255,255,0.2)]"
                      : resolvedTheme === "dark"
                        ? "border-[#3a3a3a]"
                        : "border-[#e5e7eb]"
                  }`}
                >
                  <div className="flex flex-col gap-2 px-3 sm:px-6 py-3 sm:py-0 sm:h-[64.667px] sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2 w-full min-w-0 sm:flex-1">
                      <div className="relative hidden sm:block sm:w-[384px] h-8 shrink-0">
                        <Search
                          className={`absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] z-10 ${
                            resolvedTheme === "color"
                              ? "text-[rgba(0,255,255,0.6)]"
                              : resolvedTheme === "dark"
                                ? "text-[#9ca3af]"
                                : "text-[#6b7280]"
                          }`}
                        />
                        <Input
                          type="text"
                          placeholder="Search funnels..."
                          className={`pl-[32px] pr-3 py-1 h-8 rounded-[6px] border-0 text-[14px] focus:outline-none focus:ring-0 ${
                            resolvedTheme === "color"
                              ? "bg-[rgba(255,255,255,0.03)] text-[rgba(0,255,255,0.6)] placeholder:text-[rgba(0,255,255,0.6)]"
                              : resolvedTheme === "dark"
                                ? "bg-[rgba(42,42,42,0.5)] text-[#9ca3af] placeholder:text-[#9ca3af]"
                                : "bg-[rgba(244,245,247,0.5)] text-[#6b7280]"
                          }`}
                          value={searchTerm}
                          onChange={(e) => handleSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 w-full min-w-0 sm:w-auto sm:ml-auto">
                        <div className="flex items-center gap-1.5 shrink-0">
                          {statusOptions.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => setStatusFilter(opt.id)}
                              className={`h-8 rounded-[6px] px-3 flex items-center justify-center text-[12px] font-bold leading-4 transition-colors ${
                                statusFilter === opt.id
                                  ? resolvedTheme === "color"
                                    ? "bg-[#0ff] text-[#0a0e27]"
                                    : resolvedTheme === "dark"
                                      ? "bg-[#8b7aff] text-white"
                                      : "bg-[#7b68ee] text-white"
                                  : resolvedTheme === "color"
                                    ? "border border-[rgba(0,255,255,0.2)] text-white"
                                    : resolvedTheme === "dark"
                                      ? "bg-[rgba(42,42,42,0.5)] border border-[#3a3a3a] text-[#9ca3af]"
                                      : "bg-white border border-[#e5e7eb] text-[#1f1f1f]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                          <button
                            onClick={handleExport}
                            className={`border h-8 w-8 sm:w-auto shrink-0 rounded-[6px] sm:px-3 flex items-center justify-center gap-2 text-[12px] font-bold ${
                              resolvedTheme === "color"
                                ? "border-[rgba(0,255,255,0.2)] text-white"
                                : resolvedTheme === "dark"
                                  ? "bg-[rgba(42,42,42,0.5)] border-[#3a3a3a] text-[#9ca3af]"
                                  : "bg-white border-[#e5e7eb] text-[#1f1f1f]"
                            }`}
                          >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Export</span>
                          </button>
                          <button
                            onClick={() => setIsAdd(true)}
                            className={`h-8 w-8 sm:w-auto shrink-0 rounded-[6px] sm:px-3 flex items-center justify-center gap-2 text-[12px] font-bold ${
                              resolvedTheme === "color"
                                ? "bg-[#0ff] text-[#0a0e27]"
                                : resolvedTheme === "dark"
                                  ? "bg-[#8b7aff] text-white"
                                  : "bg-[#7b68ee] text-white"
                            }`}
                          >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Create Funnel</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="relative w-full h-8 sm:hidden">
                      <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[#6b7280]" />
                      <Input
                        type="text"
                        placeholder="Search funnels..."
                        className="pl-[32px] pr-3 py-1 h-8 w-full rounded-[6px] border-0 text-[14px] bg-[rgba(244,245,247,0.5)]"
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!isFigma && (
                <div
                  className={`border-b pt-2 px-3 sm:px-6 ${
                    resolvedTheme === "color"
                      ? "bg-[rgba(255,255,255,0.02)] border-[rgba(0,255,255,0.2)]"
                      : resolvedTheme === "dark"
                        ? "bg-[rgba(42,42,42,0.5)] border-[#3a3a3a]"
                        : "bg-[rgba(244,245,247,0.3)] border-[#e5e7eb]"
                  }`}
                >
                  <p
                    className={`text-[12px] font-bold leading-4 ${
                      resolvedTheme === "color"
                        ? "text-[rgba(0,255,255,0.6)]"
                        : "text-[#6b7280] dark:text-[#9ca3af]"
                    }`}
                  >
                    {totalFunnels} {totalFunnels === 1 ? "Funnel" : "Funnels"}
                  </p>
                </div>
              )}

              {isFigma ? (
                <div className="relative flex min-h-0 flex-1 flex-col bg-[#161616]">
                  <FunnelsDataTable
                    rows={sortedFunnels}
                    loading={loading}
                    emptyLabel="No funnels found."
                    sort={funnelsSort}
                    onSortChange={setFunnelsSort}
                    getRowId={(funnel) => String(funnel?._id || funnel?.id || "")}
                    onRowClick={(funnel) => handleViewFunnel(funnel._id || funnel.id)}
                    selectedIds={selectedFunnelIdSet}
                    allSelected={allDisplayedSelected}
                    someSelected={someDisplayedSelected}
                    onToggleRow={(id) =>
                      handleToggleFunnelSelection(id, !selectedFunnelIdSet.has(id))
                    }
                    onToggleAll={() => handleToggleSelectAll(!allDisplayedSelected)}
                    getFunnelName={(funnel) => funnel.funnelName || ""}
                    getOwner={(funnel) => ({ name: funnel.ownerName || "" })}
                    getActiveLeads={(funnel) => funnel.activeLeads ?? 0}
                    getStatus={(funnel) => funnel.status || ""}
                    getLastUpdated={getFunnelUpdatedLabel}
                    renderStages={renderStagesColumn}
                    renderActions={renderRowMenu}
                    footerTotals={[
                      {
                        label: "Funnels",
                        value: totalFunnels.toLocaleString(),
                      },
                      ...(selectedFunnelIds.length > 0
                        ? [
                          {
                            label: "Selected",
                            value: selectedFunnelIds.length.toLocaleString(),
                          },
                        ]
                        : []),
                    ]}
                    pagination={{
                      page: currentPage,
                      totalPages: Math.max(1, totalPages),
                      rangeLabel: `${totalFunnels === 0 ? 0 : (currentPage - 1) * limit + 1
                        } to ${Math.min(currentPage * limit, totalFunnels)}`,
                      recordsPerPage: limit,
                      recordsPerPageOptions: [25, 50, 100, 200],
                      onPrev: () => {
                        if (currentPage > 1) handlePageChange(currentPage - 1);
                      },
                      onNext: () => {
                        if (currentPage < totalPages) handlePageChange(currentPage + 1);
                      },
                      onRecordsPerPageChange: (next) => {
                        setLimit(next);
                        setCurrentPage(1);
                        fetchFunnels(1, next);
                      },
                    }}
                  />
                </div>
              ) : (
              <div className="">
                {/* Mobile table */}
                <div className="md:hidden overflow-x-auto">
                  <div className="inline-block min-w-full px-3 sm:px-5">
                    <table className="min-w-[700px] w-full border-collapse">
                      <thead>
                        <tr
                          className={`border-b ${
                            isFigma
                              ? "bg-[#2e2e2e] border-[#2a2d3a]"
                              : resolvedTheme === "dark"
                                ? "bg-[rgba(42,42,42,0.3)] border-[#3a3a3a]"
                                : "bg-[rgba(244,245,247,0.5)] border-[#e5e7eb]"
                          }`}
                        >
                          {isFigma && (
                            <th className="w-[32px] px-2 py-2">
                              <Checkbox
                                checked={
                                  allDisplayedSelected
                                    ? true
                                    : someDisplayedSelected
                                      ? "indeterminate"
                                      : false
                                }
                                onCheckedChange={(checked) => handleToggleSelectAll(checked === true)}
                                aria-label="Select all visible funnels"
                                className={figmaCheckboxClass}
                              />
                            </th>
                          )}
                          {["Funnel Name", "Stages", "Owner", "Active Leads", "Status", "Last Updated"].map(
                            (h) => (
                              <th
                                key={h}
                                className={`font-bold text-left px-2 py-2 ${
                                  isFigma
                                    ? "text-[10px] leading-[14px] text-[#9ca3af]"
                                    : "text-[12px] text-[#6b7280] dark:text-[#9ca3af]"
                                }`}
                              >
                                {h}
                              </th>
                            )
                          )}
                          <th className="w-[52px] px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFunnels.map((funnel) => (
                          <tr
                            key={funnel._id}
                            className={`cursor-pointer border-b ${
                              isFigma
                                ? "border-[#2a2d3a] bg-[#181818]"
                                : "border-[#e5e7eb] dark:border-[#3a3a3a] hover:bg-muted/60"
                            }`}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (
                                !target.closest("button") &&
                                !target.closest("input") &&
                                !target.closest('[role="menuitem"]') &&
                                !target.closest('[role="checkbox"]') &&
                                !target.closest('[role="button"]')
                              ) {
                                handleViewFunnel(funnel._id || funnel.id);
                              }
                            }}
                          >
                            {isFigma && (
                              <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedFunnelIds.includes(funnel._id || funnel.id)}
                                  onCheckedChange={(checked) =>
                                    handleToggleFunnelSelection(funnel._id || funnel.id, checked === true)
                                  }
                                  aria-label={`Select ${funnel.funnelName}`}
                                  className={figmaCheckboxClass}
                                />
                              </td>
                            )}
                            <td className="px-2 py-3">
                              <span
                                className={
                                  isFigma
                                    ? "font-semibold text-[12px] text-white"
                                    : "font-bold text-[14px] text-[#7b68ee] dark:text-[#8b7aff]"
                                }
                              >
                                {funnel.funnelName}
                              </span>
                            </td>
                            <td className="px-2 py-3">
                              {renderStagesColumn(funnel)}
                            </td>
                            <td
                              className={`px-2 py-3 text-[12px] ${isFigma ? "text-white" : "text-[#6b7280]"}`}
                            >
                              {funnel.ownerName || "--"}
                            </td>
                            <td
                              className={`px-2 py-3 text-[12px] font-semibold ${
                                isFigma ? "text-white" : "text-[#7b68ee]"
                              }`}
                            >
                              {funnel.activeLeads ?? 0}
                            </td>
                            <td className="px-2 py-3">
                              {(funnel.status || "").toLowerCase() === "active" ? (
                                <span className="text-[11px] font-bold text-[#10b981] bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-[6px] px-2 py-0.5">
                                  Active
                                </span>
                              ) : (
                                <span
                                  className={`text-[11px] font-bold rounded-[6px] px-2 py-0.5 border ${
                                    isFigma
                                      ? "text-[#9ca3af] border-[#2a2d3a] bg-[#2a2a2a]"
                                      : "text-[#6b7280] border-[#e5e7eb]"
                                  }`}
                                >
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td
                              className={`px-2 py-3 text-[12px] ${isFigma ? "text-[#9ca3af]" : "text-[#6b7280]"}`}
                            >
                              {funnel.updatedAt
                                ? new Date(funnel.updatedAt).toLocaleDateString("en-CA")
                                : "--"}
                            </td>
                            <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              {renderRowMenu(funnel)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Desktop table */}
                <div
                  className={`hidden md:block overflow-x-auto ${
                    isFigma ? "" : "border border-[#e5e7eb] dark:border-[#3a3a3a] rounded-[12px]"
                  }`}
                >
                  <Table className={isFigma ? "min-w-[900px] w-full" : "min-w-[900px]"}>
                    <TableHeader
                      className={
                        isFigma
                          ? "bg-[#2e2e2e] border-b border-[#2a2d3a]"
                          : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(42,42,42,0.5)] border-b"
                      }
                    >
                      <TableRow className="hover:bg-transparent">
                        {isFigma && (
                          <TableHead className="w-[32px] h-[26px] px-2 py-0 text-[#9ca3af]">
                            <Checkbox
                              checked={
                                allDisplayedSelected
                                  ? true
                                  : someDisplayedSelected
                                    ? "indeterminate"
                                    : false
                              }
                              onCheckedChange={(checked) => handleToggleSelectAll(checked === true)}
                              aria-label="Select all visible funnels"
                              className={figmaCheckboxClass}
                            />
                          </TableHead>
                        )}
                        {[
                          "Funnel Name",
                          "Stages",
                          "Owner",
                          "Active Leads",
                          "Status",
                          "Last Updated",
                        ].map((h) => (
                          <TableHead
                            key={h}
                            className={
                              isFigma
                                ? "h-[26px] px-2 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af]"
                                : "px-3 py-2 text-[12px] font-bold text-[#6b7280] dark:text-[#9ca3af]"
                            }
                          >
                            {h}
                          </TableHead>
                        ))}
                        <TableHead
                          className={
                            isFigma
                              ? "h-[26px] px-2 py-0 text-[10px] font-bold text-[#9ca3af] w-[88px]"
                              : "w-[52px]"
                          }
                        >
                          {isFigma ? "Actions" : ""}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFunnels.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={isFigma ? 8 : 7}
                            className={`text-center py-8 ${isFigma ? "text-[#9ca3af]" : "text-gray-500"}`}
                          >
                            No funnels found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredFunnels.map((funnel) => (
                          <TableRow
                            key={funnel._id}
                            className={
                              isFigma
                                ? "group cursor-pointer border-b border-[#2a2d3a] bg-[#181818] hover:bg-[#181818]"
                                : "group h-[44.667px] border-b border-[#e5e7eb] dark:border-[#3a3a3a] hover:bg-transparent"
                            }
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (
                                !target.closest("button") &&
                                !target.closest("input") &&
                                !target.closest('[role="menuitem"]') &&
                                !target.closest('[role="checkbox"]')
                              ) {
                                handleViewFunnel(funnel._id || funnel.id);
                              }
                            }}
                          >
                            {isFigma && (
                              <TableCell
                                className="px-2 py-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={selectedFunnelIds.includes(funnel._id || funnel.id)}
                                  onCheckedChange={(checked) =>
                                    handleToggleFunnelSelection(funnel._id || funnel.id, checked === true)
                                  }
                                  aria-label={`Select ${funnel.funnelName}`}
                                  className={figmaCheckboxClass}
                                />
                              </TableCell>
                            )}
                            <TableCell className={isFigma ? "px-2 py-3 text-white" : "px-3"}>
                              {isFigma ? (
                                <span className="font-semibold text-[12px] leading-[16px] truncate">
                                  {funnel.funnelName}
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="rounded-[4px] w-[26px] h-[26px] flex items-center justify-center bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.1)]">
                                    <TrendingUp className="h-[14px] w-[14px] text-[#7b68ee] dark:text-[#8b7aff]" />
                                  </div>
                                  <p
                                    className="text-[14px] font-bold text-[#7b68ee] dark:text-[#8b7aff] cursor-pointer hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewFunnel(funnel._id || funnel.id);
                                    }}
                                  >
                                    {funnel.funnelName}
                                  </p>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3"}>
                              {renderStagesColumn(funnel)}
                            </TableCell>
                            <TableCell
                              className={
                                isFigma
                                  ? "px-2 py-3 text-[12px] text-white"
                                  : "px-3 text-[14px] text-[#6b7280] dark:text-[#9ca3af]"
                              }
                            >
                              {funnel.ownerName || "--"}
                            </TableCell>
                            <TableCell
                              className={
                                isFigma
                                  ? "px-2 py-3 text-[12px] font-semibold text-white"
                                  : "px-3"
                              }
                            >
                              {isFigma ? (
                                funnel.activeLeads ?? 0
                              ) : (
                                <div className="rounded-[6px] h-6 w-fit px-2 flex items-center gap-1.5 bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.1)]">
                                  <Users className="h-3 w-3 text-[#7b68ee] dark:text-[#8b7aff]" />
                                  <p className="text-[12px] font-bold text-[#7b68ee] dark:text-[#8b7aff]">
                                    {funnel.activeLeads ?? 0}
                                  </p>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3"}>
                              {(funnel.status || "").toLowerCase() === "active" ? (
                                <span className="text-[11px] font-bold text-[#10b981] bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-[6px] px-2 py-0.5">
                                  Active
                                </span>
                              ) : (
                                <span
                                  className={`text-[11px] font-bold rounded-[6px] px-2 py-0.5 border ${
                                    isFigma
                                      ? "text-[#9ca3af] border-[#2a2d3a] bg-[#2a2a2a]"
                                      : "text-[#6b7280] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                  }`}
                                >
                                  Inactive
                                </span>
                              )}
                            </TableCell>
                            <TableCell
                              className={
                                isFigma
                                  ? "px-2 py-3 text-[12px] text-[#9ca3af]"
                                  : "px-3 text-[14px] text-[#6b7280] dark:text-[#9ca3af]"
                              }
                            >
                              {funnel.updatedAt
                                ? new Date(funnel.updatedAt).toLocaleDateString("en-CA")
                                : "--"}
                            </TableCell>
                            <TableCell
                              className={isFigma ? "px-2 py-3" : "px-3"}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {renderRowMenu(funnel)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {searchTerm && (
                  <div
                    className={`flex items-center justify-between mt-6 px-5 ${
                      isFigma ? "text-[#9ca3af]" : "text-sm text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <div className="text-sm">
                      Found {funnels.length} result{funnels.length !== 1 ? "s" : ""} for &quot;
                      {searchTerm}&quot;
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch("")}
                      className={
                        isFigma
                          ? "h-8 border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] hover:bg-[#181818]"
                          : "text-blue-600 hover:text-blue-700"
                      }
                    >
                      Clear Search
                    </Button>
                  </div>
                )}

                {!searchTerm && totalPages > 1 && (
                  <div
                    className={`flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 mb-6 pb-16 px-5 ${
                      isFigma ? "text-[#9ca3af]" : ""
                    }`}
                  >
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Showing {(currentPage - 1) * limit + 1} to{" "}
                      {Math.min(currentPage * limit, totalFunnels)} of {totalFunnels} funnels
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={
                          isFigma
                            ? "h-8 border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] hover:bg-[#181818]"
                            : "flex items-center gap-1"
                        }
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Previous</span>
                      </Button>
                      <div className="hidden sm:flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) pageNum = i + 1;
                          else if (currentPage <= 3) pageNum = i + 1;
                          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                          else pageNum = currentPage - 2 + i;
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className={`w-8 h-8 p-0 ${
                                currentPage === pageNum
                                  ? isFigma
                                    ? "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)]"
                                    : "bg-black text-white hover:bg-black/80"
                                  : isFigma
                                    ? "border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] hover:bg-[#181818]"
                                    : "hover:bg-gray-50"
                              }`}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={
                          isFigma
                            ? "h-8 border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] hover:bg-[#181818]"
                            : "flex items-center gap-1"
                        }
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {isFigma && (isAdd || (isEdit && editingFunnel)) && (
            <FunnelFlow
              setIsAdd={isEdit ? setIsEdit : setIsAdd}
              editingFunnel={isEdit ? editingFunnel : undefined}
              onCancel={isEdit ? handleCancelEdit : undefined}
              asDialog
            />
          )}
        </div>

        {/* Delete confirmation — Figma-styled dialog (same pattern as Leads) */}
        <DeleteLeadsDialog
          open={isDeleteModalOpen}
          onOpenChange={(open) => {
            setIsDeleteModalOpen(open);
            if (!open) setDeletingFunnel(null);
          }}
          leads={
            funnelPendingDelete
              ? [{ id: funnelPendingDelete._id, name: funnelPendingDelete.funnelName }]
              : []
          }
          title="Delete Funnel (1)"
          description="This action is permanent. The funnel and its stage configuration will be deleted and cannot be recovered."
          selectedLabel="Selected funnel"
          onConfirm={confirmDeleteFunnel}
          isDeleting={isDeleting}
        />

        <DeleteLeadsDialog
          open={isBulkDeleteOpen}
          onOpenChange={setIsBulkDeleteOpen}
          leads={funnels
            .filter((f) => selectedFunnelIds.includes(f._id || f.id))
            .map((f) => ({ id: f._id, name: f.funnelName }))}
          totalCount={selectedFunnelIds.length}
          title={
            selectedFunnelIds.length === 1
              ? "Delete Funnel (1)"
              : `Delete Funnels (${selectedFunnelIds.length})`
          }
          description="This action is permanent. The selected funnels and their stage configurations will be deleted and cannot be recovered."
          selectedLabel="Selected funnels"
          onConfirm={confirmBulkDelete}
          isDeleting={isBulkDeleting}
        />

        <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
          <DialogContent
            showCloseButton={false}
            className="!max-w-[min(494px,calc(100vw-2rem))] w-full p-0 rounded-[12px] border border-[#334155] bg-[#2e2e2e] shadow-[0px_24px_48px_0px_rgba(0,0,0,0.5)] gap-0 overflow-hidden"
          >
            <div className="flex w-full min-w-0 overflow-hidden h-[280px]">
              <div className="flex w-[210px] shrink-0 flex-col border-r border-[#2e2e48]">
                <div className="px-4 pb-3 pt-5 flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-white">Filters</h3>
                  <button
                    type="button"
                    onClick={() => setIsFilterDialogOpen(false)}
                    className="text-[#94a3b8] hover:text-white"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-between pl-4 pr-3 text-left bg-[#181818]"
                >
                  <span className="text-[12px] font-semibold text-white">Status</span>
                  <ChevronRight className="size-3.5 shrink-0 text-white" />
                </button>
              </div>
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-5 gap-4">
                <h4 className="text-[14px] font-bold text-white">Status</h4>
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                  {statusOptions.map((opt) => {
                    const checked = draftStatusFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraftStatusFilter(opt.id)}
                        className="flex h-9 items-center gap-2.5 rounded-[6px] px-2 text-left hover:bg-white/5"
                      >
                        <span
                          className={`flex size-4 items-center justify-center rounded-[4px] border ${
                            checked
                              ? "border-brand bg-brand"
                              : "border-[#64748b] bg-transparent"
                          }`}
                        >
                          {checked ? (
                            <span className="text-[10px] font-bold text-black">✓</span>
                          ) : null}
                        </span>
                        <span className="text-[14px] text-white">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex h-16 shrink-0 items-center justify-between border-t border-[#181818] px-4">
              <button
                type="button"
                onClick={() => setIsFilterDialogOpen(false)}
                className="text-[14px] font-semibold text-[#94a3b8] hover:text-white"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFilters}
                  className="h-[35px] rounded-[6px] border-[#334155] bg-transparent px-3 text-[13px] font-semibold text-white shadow-none hover:bg-white/5"
                >
                  Reset Filter
                </Button>
                <Button
                  type="button"
                  onClick={applyFilters}
                  className="h-[35px] rounded-[6px] bg-brand px-4 text-[13px] font-bold text-brand-foreground shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)]"
                >
                  Apply Filter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ViewFunnelDialog
          open={isViewFunnelOpen}
          onOpenChange={setIsViewFunnelOpen}
          viewingFunnel={viewingFunnel}
          isLoading={isLoadingFunnelDetails}
        />
      </div>
    </div>
  );
}
