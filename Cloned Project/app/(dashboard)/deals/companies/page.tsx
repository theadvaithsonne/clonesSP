"use client";

import { Button } from "@/components/ui/button";
import CRMPageLayout from "@/components/crm/CRMPageLayout";
import { CompaniesDataTable } from "@/components/deals/companies/CompaniesDataTable";
import type { SortState } from "@/components/ui/data-table/types";
import { DealsPageToolbar, DealsSearchField, dealsToolbarActionBtn } from "@/components/crm/DealsPageToolbar";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Eye, Search, Filter, RefreshCw, Building, Globe, ChevronLeft, ChevronRight, Upload, Download, TrendingUp, User, MoreHorizontal, X, Plus, Users, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { openDealsLeadInline, useDealsInlineRefresh } from "@/lib/deals-events";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import ViewFunnelDialog from "@/components/crm/ViewFunnelDialog";
import DeleteLeadsDialog from "@/components/crm/leads/DeleteLeadsDialog";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocationStore } from "@/store/locationStore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import BulkUploadCompaniesFlow from "@/components/crm/companies/BulkUploadCompaniesFlow";
import * as XLSX from "xlsx";
import { useTheme } from "next-themes";

// Define the type for company data
interface Company {
  _id: string;
  companyName: string;
  industry: string;
  website: string;
  pinCode: string;
  address: string;
  country: string;
  city: string;
  state: string;
  size?: string; // Employee size range
  revenue?: string;
  ownerName?: string;
  ownerId?: string;
  openLeads?: number;
  wonDeals?: number;
  lastActivity?: string;
  leads?: any[];
}

export default function CompaniesPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
  const isFigma = isInlineDealsMode;
  const resolvedTheme =
    theme === "color" ? "color" : theme === "dark" || isInlineDealsMode ? "dark" : "light";
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Add Company state
  const [addForm, setAddForm] = useState({
    companyName: "",
    industry: "",
    website: "",
    size: "",
    revenue: "",
  });
  const [isAddLoading, setIsAddLoading] = useState(false);

  // Add Company validation error states
  const [addCompanyNameError, setAddCompanyNameError] = useState("");

  // Edit state
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editForm, setEditForm] = useState({
    companyName: "",
    industry: "",
    website: "",
    pinCode: "",
    address: "",
    country: "",
    city: "",
    state: "",
    size: "",
    revenue: "",
  });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [industryOptions, setIndustryOptions] = useState<string[]>([]);
  const [isLoadingIndustries, setIsLoadingIndustries] = useState(false);
  const [isCustomIndustryDialogOpen, setIsCustomIndustryDialogOpen] = useState(false);
  const [customIndustryInput, setCustomIndustryInput] = useState("");
  const [customIndustryError, setCustomIndustryError] = useState("");
  const [pendingIndustryTarget, setPendingIndustryTarget] = useState<"add" | "edit" | null>(null);

  // Edit validation error states
  const [editCompanyNameError, setEditCompanyNameError] = useState("");
  const [editIndustryError, setEditIndustryError] = useState("");
  const [editPinCodeError, setEditPinCodeError] = useState("");
  const [editCountryError, setEditCountryError] = useState("");
  const [editCityError, setEditCityError] = useState("");
  const [editStateError, setEditStateError] = useState("");

  // Delete state
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const hasFetchedInitialCompanies = useRef(false);
  const lastAppliedCompanyOwnerRef = useRef("");
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [limit, setLimit] = useState(50);

  // Column sort for the BackOffice DataTable — applied to the loaded page, as
  // the companies API paginates server-side and takes no sort parameter.
  const [companiesSort, setCompaniesSort] = useState<SortState | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  const [ownerFilterOptions, setOwnerFilterOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOwnerName, setSelectedOwnerName] = useState("");
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState("all");
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState("all");
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);

  // Filter dialog state
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [filterSelectedIndustries, setFilterSelectedIndustries] = useState<string[]>(["all"]);
  const [filterSelectedOwners, setFilterSelectedOwners] = useState<string[]>(["all"]);
  const [availableFilterIndustries, setAvailableFilterIndustries] = useState<string[]>([]);
  const [activeFilterCategory, setActiveFilterCategory] = useState<"industry" | "owner">("industry");

  // View funnel states
  const [isViewFunnelOpen, setIsViewFunnelOpen] = useState(false);
  const [viewingFunnel, setViewingFunnel] = useState<any>(null);
  const [isLoadingFunnelDetails, setIsLoadingFunnelDetails] = useState(false);

  // View company states
  const [isViewCompanyOpen, setIsViewCompanyOpen] = useState(false);
  const [viewingCompany, setViewingCompany] = useState<Company | null>(null);
  const [isLoadingCompanyDetails, setIsLoadingCompanyDetails] = useState(false);
  const [isViewLeadsOpen, setIsViewLeadsOpen] = useState(false);
  const [viewingCompanyLeads, setViewingCompanyLeads] = useState<any[]>([]);
  const [viewingCompanyName, setViewingCompanyName] = useState("");

  // Location store for edit dialog
  const {
    countries,
    states,
    cities,
    selectedCountry,
    selectedState,
    selectedCity,
    loadCountries,
    loadStates,
    loadCities,
    setSelectedCountry,
    setSelectedState,
    setSelectedCity,
    resetStates,
    resetCities,
  } = useLocationStore();

  // Load countries on mount
  useEffect(() => {
    if (countries.length === 0) {
      loadCountries();
    }
  }, [countries.length, loadCountries]);

  useEffect(() => {
    let cancelled = false;
    const loadIndustries = async () => {
      setIsLoadingIndustries(true);
      try {
        const response = await authenticatedFetch(buildExternalUrl("crm/companies/industries"), {
          method: "GET",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch industries: ${response.statusText}`);
        }
        const data = await response.json();
        const rawList =
          (Array.isArray(data?.industries) && data.industries) ||
          (Array.isArray(data) && data) ||
          [];
        const normalized = rawList
          .map((item: any) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object") {
              if (typeof item.name === "string") return item.name.trim();
              if (typeof item.label === "string") return item.label.trim();
            }
            return "";
          })
          .filter((value: string) => value.length > 0);
        const unique = Array.from(new Set(normalized.map((value) => value.toLowerCase()))).map((lower) =>
          normalized.find((value) => value.toLowerCase() === lower) || lower
        );
        unique.sort((a, b) => a.localeCompare(b));
        if (!unique.some((option) => option.toLowerCase() === "other")) {
          unique.push("Other");
        }
        if (!cancelled) {
          setIndustryOptions(unique);
        }
      } catch (error) {
        console.error("Error fetching industries:", error);
      } finally {
        if (!cancelled) {
          setIsLoadingIndustries(false);
        }
      }
    };

    loadIndustries();

    return () => {
      cancelled = true;
    };
  }, [authenticatedFetch, buildExternalUrl]);

  const mergeOwnerOptions = useCallback((owners: Array<{ id: string; name: string }>) => {
    setOwnerFilterOptions((prev) => {
      const ownersMap = new Map<string, string>();

      prev.forEach((owner) => {
        if (owner.id) {
          ownersMap.set(owner.id, owner.name);
        }
      });

      owners.forEach((owner) => {
        const id = owner.id?.trim();
        const name = owner.name?.trim();
        if (id && name && !ownersMap.has(id)) {
          ownersMap.set(id, name);
        }
      });

      const merged = Array.from(ownersMap.entries()).map(([id, name]) => ({ id, name }));
      merged.sort((a, b) => a.name.localeCompare(b.name));
      return merged;
    });
  }, []);

  useEffect(() => {
    if (isLoadingOwners) return;
    if (selectedOwnerFilter === "all") {
      if (selectedOwnerName !== "") {
        setSelectedOwnerName("");
      }
      return;
    }

    const existingOwner = ownerFilterOptions.find((owner) => owner.id === selectedOwnerFilter);

    if (!existingOwner) {
      if (ownerFilterOptions.length > 0) {
        const fallback = ownerFilterOptions[0];
        setSelectedOwnerFilter(fallback.id);
        setSelectedOwnerName(fallback.name?.trim() || "");
      } else {
        setSelectedOwnerFilter("all");
        setSelectedOwnerName("");
      }
      return;
    }

    const resolvedName = existingOwner.name?.trim() || "";
    if (resolvedName !== selectedOwnerName) {
      setSelectedOwnerName(resolvedName);
    }
  }, [ownerFilterOptions, selectedOwnerFilter, selectedOwnerName, isLoadingOwners]);

  // Fetch companies from API with pagination
  const fetchCompanies = useCallback(
    // `pageSize` is passed explicitly by the records-per-page control so it
    // doesn't read a stale `limit`.
    async (page?: number, pageSize: number = limit) => {
      const targetPage = typeof page === "number" && page > 0 ? page : currentPageRef.current;
      try {
        setLoading(true);
        setError(null);

        const skip = (targetPage - 1) * pageSize; // Convert page to skip (0-based)
        const params = new URLSearchParams({
          skip: skip.toString(),
          limit: pageSize.toString(),
        });

        const ownerName = selectedOwnerName.trim();
        if (ownerName) {
          params.append("ownerName", ownerName);
        }
        if (selectedIndustryFilter && selectedIndustryFilter !== "all") {
          params.append("industry", selectedIndustryFilter);
        }

        const response = await authenticatedFetch(
          buildExternalUrl(`crm/companies?${params.toString()}`),
          {
            method: "GET",
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch companies: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Companies data:", data);

        // Transform API data to match our Company type
        const transformedCompanies: Company[] = Array.isArray(data.companies)
          ? data.companies.map((company: any) => {
            const formatSize = (size: string | number | undefined): string | undefined => {
              if (!size) return undefined;
              const numSize = typeof size === "string" ? parseInt(size) : size;
              if (isNaN(numSize)) return size as string;

              if (numSize < 10) return "1-10";
              if (numSize < 50) return "10-50";
              if (numSize < 100) return "50-100";
              if (numSize < 500) return "100-500";
              if (numSize < 1000) return "500-1000";
              return "1000+";
            };

            const owner = company.owner || company.ownerDetails || company.ownerInfo;
            const ownersArray = Array.isArray(company.owners) ? company.owners : [];
            const primaryOwner = owner || (ownersArray.length > 0 ? ownersArray[0] : undefined);
            const ownerId = company.ownerId || owner?._id || owner?.id || "";
            const ownerNameValue =
              company.ownerName ||
              primaryOwner?.name ||
              `${primaryOwner?.firstName || ""} ${primaryOwner?.lastName || ""}`.trim();

            return {
              _id: company._id,
              companyName: company.companyName || company.name || "",
              industry: company.industry || "",
              website: company.website || company.websiteUrl || "",
              pinCode: company.pinCode || "",
              address: company.address || "",
              country: company.country || "",
              city: company.city || "",
              state: company.state || "",
              size: formatSize(
                company.size || company.employeeSize || company.numberOfTeamMembers
              ),
              revenue: company.revenue || "",
              ownerName: ownerNameValue || undefined,
              ownerId: ownerId || primaryOwner?._id || primaryOwner?.id || undefined,
              openLeads: company.activeLeadsCount ?? company.openLeads ?? company.activeLeads ?? 0,
              wonDeals: company.wonLeadsCount ?? company.wonDeals ?? company.successfulDeals ?? 0,
              lastActivity: company.lastActivity || company.updatedAt || company.createdAt || "",
              leads: Array.isArray(company.leads) ? company.leads : [],
            };
          })
          : [];

        setCompanies(transformedCompanies);

        const ownersFromCompanies = transformedCompanies
          .map((company) => ({ id: company.ownerId || "", name: company.ownerName || "" }))
          .filter((owner) => owner.id && owner.name);
        if (ownersFromCompanies.length > 0) {
          mergeOwnerOptions(ownersFromCompanies);
        }

        const fetchedIndustries = transformedCompanies
          .map((company) => (company.industry || "").trim())
          .filter((industry) => industry.length > 0);

        if (fetchedIndustries.length > 0) {
          setIndustryOptions((prev) => {
            const withoutOther = prev.filter((opt) => opt.toLowerCase() !== "other");
            const existingLower = new Set(withoutOther.map((opt) => opt.toLowerCase()));
            const updated = [...withoutOther];
            fetchedIndustries.forEach((industry) => {
              if (!existingLower.has(industry.toLowerCase())) {
                updated.push(industry);
                existingLower.add(industry.toLowerCase());
              }
            });
            return [...updated, "Other"];
          });
        }

        // Update pagination info from API response
        if (data.total !== undefined) {
          setTotalCompanies(data.total);
          setTotalPages(Math.ceil(data.total / pageSize));
        } else if (data.pagination && data.pagination.total !== undefined) {
          setTotalCompanies(data.pagination.total);
          setTotalPages(Math.ceil(data.pagination.total / pageSize));
        } else {
          setTotalCompanies(transformedCompanies.length);
          setTotalPages(1);
        }

        currentPageRef.current = targetPage;
        setCurrentPage(targetPage);
      } catch (err) {
        console.error("Error fetching companies:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch companies");
        setCompanies([]);
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    },
    [limit, selectedOwnerName, selectedIndustryFilter, mergeOwnerOptions, authenticatedFetch, buildExternalUrl]
  );

  // Pagination functions
  const handlePageChange = (page: number) => {
    currentPageRef.current = page;
    setCurrentPage(page);
    fetchCompanies(page);
  };

  // Search functionality
  // Handle view company
  const handleViewCompany = async (companyId: string) => {
    if (!companyId) return;

    setIsLoadingCompanyDetails(true);
    setIsViewCompanyOpen(true);

    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/companies/${companyId}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const companyData = await response.json();
        setViewingCompany(companyData);
      } else {
        toast.error("Failed to load company details");
        setIsViewCompanyOpen(false);
      }
    } catch (error) {
      console.error("Error fetching company details:", error);
      toast.error("Failed to load company details");
      setIsViewCompanyOpen(false);
    } finally {
      setIsLoadingCompanyDetails(false);
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

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching
    currentPageRef.current = 1;

    if (term.trim()) {
      // Use search API when there's a search term
      await searchCompanies(term);
    } else {
      // Fetch normal paginated companies when search is cleared
      await fetchCompanies(1);
    }
  };

  // Search companies using the search API
  const searchCompanies = async (searchTerm: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchTerm,
      });
      const ownerName = selectedOwnerName.trim();
      if (ownerName) {
        params.append("ownerName", ownerName);
      }

      const response = await authenticatedFetch(
        buildExternalUrl(`crm/searchcompany?${params.toString()}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const searchResults = data.companies || data || [];

        // Transform API data to match our Company type
        const transformedCompanies: Company[] = Array.isArray(searchResults)
          ? searchResults.map((company: any) => {
            const formatSize = (size: string | number | undefined): string | undefined => {
              if (!size) return undefined;
              const numSize = typeof size === 'string' ? parseInt(size) : size;
              if (isNaN(numSize)) return size as string;

              if (numSize < 10) return "1-10";
              if (numSize < 50) return "10-50";
              if (numSize < 100) return "50-100";
              if (numSize < 500) return "100-500";
              if (numSize < 1000) return "500-1000";
              return "1000+";
            };

            const owner = company.owner || company.ownerDetails || company.ownerInfo;
            const ownerId = company.ownerId || owner?._id || owner?.id || "";
            const ownerName = company.ownerName || owner?.name || `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim();

            return {
              _id: company._id,
              companyName: company.companyName || company.name || "",
              industry: company.industry || "",
              website: company.website || company.websiteUrl || "",
              pinCode: company.pinCode || "",
              address: company.address || "",
              country: company.country || "",
              city: company.city || "",
              state: company.state || "",
              size: formatSize(company.size || company.employeeSize || company.numberOfTeamMembers),
              revenue: company.revenue || "",
              ownerName: ownerName || undefined,
              ownerId: ownerId || undefined,
              openLeads: company.activeLeadsCount ?? company.openLeads ?? company.activeLeads ?? 0,
              wonDeals: company.wonLeadsCount ?? company.wonDeals ?? company.successfulDeals ?? 0,
              lastActivity: company.lastActivity || company.updatedAt || company.createdAt || "",
              leads: Array.isArray(company.leads) ? company.leads : [],
            };
          })
          : [];

        setCompanies(transformedCompanies);

        const ownersFromCompanies = transformedCompanies
          .map((company) => ({ id: company.ownerId || "", name: company.ownerName || "" }))
          .filter((owner) => owner.id && owner.name);
        if (ownersFromCompanies.length > 0) {
          mergeOwnerOptions(ownersFromCompanies);
        }

        const fetchedIndustries = transformedCompanies
          .map((company) => (company.industry || "").trim())
          .filter((industry) => industry.length > 0);

        if (fetchedIndustries.length > 0) {
          setIndustryOptions((prev) => {
            const withoutOther = prev.filter((opt) => opt.toLowerCase() !== "other");
            const existingLower = new Set(withoutOther.map((opt) => opt.toLowerCase()));
            const updated = [...withoutOther];
            fetchedIndustries.forEach((industry) => {
              if (!existingLower.has(industry.toLowerCase())) {
                updated.push(industry);
                existingLower.add(industry.toLowerCase());
              }
            });
            return [...updated, "Other"];
          });
        }

        // For search results, we don't have pagination info, so we'll show all results
        setTotalCompanies(transformedCompanies.length);
        setTotalPages(1);
      } else {
        console.error("Failed to search companies");
        // Fallback to normal fetch if search fails
        await fetchCompanies(1);
      }
    } catch (error) {
      console.error("Error searching companies:", error);
      // Fallback to normal fetch if search fails
      await fetchCompanies(1);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Handle filter industry toggle
  const handleToggleFilterIndustry = (industry: string) => {
    if (industry === "all") {
      setFilterSelectedIndustries(["all"]);
    } else {
      setFilterSelectedIndustries((prev) => {
        // Remove "all" if selecting a specific industry
        const withoutAll = prev.filter((i) => i !== "all");
        const newSelection = withoutAll.includes(industry)
          ? withoutAll.filter((i) => i !== industry)
          : [...withoutAll, industry];
        return newSelection.length === 0 ? ["all"] : newSelection;
      });
    }
  };

  // Handle filter owner toggle
  const handleToggleFilterOwner = (ownerId: string) => {
    if (ownerId === "all") {
      setFilterSelectedOwners(["all"]);
    } else {
      setFilterSelectedOwners((prev) => {
        // Remove "all" if selecting a specific owner
        const withoutAll = prev.filter((id) => id !== "all");
        const newSelection = withoutAll.includes(ownerId)
          ? withoutAll.filter((id) => id !== ownerId)
          : [...withoutAll, ownerId];
        return newSelection.length === 0 ? ["all"] : newSelection;
      });
    }
  };

  // Handle apply filters
  const handleApplyFilters = () => {
    // For now, use the first selected item (or "all" if "all" is selected)
    // This matches the current API which supports single industry/owner filter
    const industryValue = filterSelectedIndustries.includes("all") || filterSelectedIndustries.length === 0
      ? "all"
      : filterSelectedIndustries[0];
    const ownerValue = filterSelectedOwners.includes("all") || filterSelectedOwners.length === 0
      ? "all"
      : filterSelectedOwners[0];

    setSelectedIndustryFilter(industryValue);
    setSelectedOwnerFilter(ownerValue);
    setIsFilterDialogOpen(false);
    // The useEffect will handle fetching companies when filters change
  };

  // Refresh companies
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCompanies();
    await fetchCompanyOwners();
    setRefreshing(false);
  };

  const fetchCompanyOwners = useCallback(async () => {
    try {
      setIsLoadingOwners(true);
      const response = await authenticatedFetch(buildExternalUrl("crm/companies/owners"), {
        method: "GET",
      });

      if (!response.ok) {
        console.error("Failed to fetch company owners");
        return;
      }

      const data = await response.json();
      const owners = Array.isArray(data?.owners)
        ? data.owners
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

      const normalized = owners
        .map((owner: any) => {
          const id = owner?._id || owner?.id || owner?.ownerId || owner?.userId || "";
          const name =
            owner?.name ||
            `${owner?.firstName || ""} ${owner?.lastName || ""}`.trim() ||
            owner?.email ||
            "";

          return {
            id,
            name,
            email: owner?.email as string | undefined,
          };
        })
        .filter((owner: { id: string; name: string }) => owner.id && owner.name);

      if (normalized.length > 0) {
        mergeOwnerOptions(normalized.map(({ id, name }) => ({ id, name })));
        const stillExists =
          selectedOwnerFilter !== "all" &&
          normalized.some((owner) => owner.id === selectedOwnerFilter);

        if (stillExists) {
          const ownerName =
            normalized.find((owner) => owner.id === selectedOwnerFilter)?.name?.trim() || "";
          setSelectedOwnerName(ownerName);
        } else {
          setSelectedOwnerFilter("all");
          setSelectedOwnerName("");
        }
      } else {
        setSelectedOwnerFilter("all");
        setSelectedOwnerName("");
      }
    } catch (error) {
      console.error("Error fetching company owners:", error);
    } finally {
      setIsLoadingOwners(false);
    }
  }, [mergeOwnerOptions, selectedOwnerFilter, selectedOwnerName]);

  useEffect(() => {
    fetchCompanyOwners();
  }, [fetchCompanyOwners]);

  const ensureIndustryOption = (industryValue: string | undefined | null) => {
    const trimmed = (industryValue || "").trim();
    if (!trimmed) return;
    setIndustryOptions((prev) => {
      if (prev.some((opt) => opt.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const withoutOther = prev.filter((opt) => opt.toLowerCase() !== "other");
      return [...withoutOther, trimmed, "Other"];
    });
  };

  const openCustomIndustryDialog = (target: "add" | "edit") => {
    setPendingIndustryTarget(target);
    setCustomIndustryInput("");
    setCustomIndustryError("");
    setIsCustomIndustryDialogOpen(true);
  };

  const handleCloseCustomIndustryDialog = () => {
    setIsCustomIndustryDialogOpen(false);
    setCustomIndustryInput("");
    setCustomIndustryError("");
    setPendingIndustryTarget(null);
  };

  const handleCustomIndustrySubmit = () => {
    const industryName = customIndustryInput.trim();
    if (!industryName) {
      setCustomIndustryError("Industry is required");
      return;
    }

    const industryLower = industryName.toLowerCase();
    const existing = industryOptions.find((opt) => opt.toLowerCase() === industryLower);
    const finalIndustry = existing || industryName;

    if (!existing) {
      setIndustryOptions((prev) => {
        const withoutOther = prev.filter((opt) => opt.toLowerCase() !== "other");
        return [...withoutOther, finalIndustry, "Other"];
      });
    }

    if (pendingIndustryTarget === "add") {
      setAddForm((prev) => ({ ...prev, industry: finalIndustry }));
    } else if (pendingIndustryTarget === "edit") {
      setEditForm((prev) => ({ ...prev, industry: finalIndustry }));
    }

    handleCloseCustomIndustryDialog();
  };

  // Edit form validation functions
  const validateEditCompanyName = (name: string): boolean => {
    if (!name.trim()) {
      setEditCompanyNameError("Company name is required");
      return false;
    }
    setEditCompanyNameError("");
    return true;
  };

  const validateEditIndustry = (industry: string): boolean => {
    if (!industry.trim()) {
      setEditIndustryError("Industry is required");
      return false;
    }
    setEditIndustryError("");
    return true;
  };

  const validateEditPinCode = (pinCode: string): boolean => {
    if (!pinCode.trim()) {
      setEditPinCodeError("Pin code is required");
      return false;
    }
    setEditPinCodeError("");
    return true;
  };

  const validateEditCountry = (): boolean => {
    if (!selectedCountry) {
      setEditCountryError("Country is required");
      return false;
    }
    setEditCountryError("");
    return true;
  };

  const validateEditState = (): boolean => {
    if (!selectedState) {
      setEditStateError("State is required");
      return false;
    }
    setEditStateError("");
    return true;
  };

  const validateEditCity = (): boolean => {
    if (!selectedCity) {
      setEditCityError("City is required");
      return false;
    }
    setEditCityError("");
    return true;
  };

  // Handle edit company
  const handleEditClick = (company: Company) => {
    setEditingCompany(company);
    setEditForm({
      companyName: company.companyName,
      industry: company.industry,
      website: company.website,
      pinCode: company.pinCode,
      address: company.address,
      country: company.country,
      city: company.city,
      state: company.state,
      size: company.size || "",
      revenue: company.revenue || "",
    });

    // Clear all validation errors
    setEditCompanyNameError("");
    setEditIndustryError("");
    setEditPinCodeError("");
    setEditCountryError("");
    setEditCityError("");
    setEditStateError("");

    // Set location dropdowns based on company data
    if (company.country) {
      const country = countries.find(c => c.name === company.country);
      if (country) {
        setSelectedCountry(country);
        loadStates(country.isoCode);

        // Set state after a short delay to ensure states are loaded
        setTimeout(() => {
          if (company.state) {
            const state = states.find(s => s.name === company.state);
            if (state) {
              setSelectedState(state);
              loadCities(country.isoCode, state.isoCode);

              // Set city after a short delay to ensure cities are loaded
              setTimeout(() => {
                if (company.city) {
                  const city = cities.find(c => c.name === company.city);
                  if (city) {
                    setSelectedCity(city);
                  }
                }
              }, 100);
            }
          }
        }, 100);
      }
    }

    ensureIndustryOption(company.industry);

    setIsEditOpen(true);
  };

  // Save edited company
  const handleEditSave = async () => {
    if (!editingCompany) return;

    // Validate required fields
    const isCompanyNameValid = validateEditCompanyName(editForm.companyName);
    const isIndustryValid = validateEditIndustry(editForm.industry);
    const isPinCodeValid = validateEditPinCode(editForm.pinCode);
    const isCountryValid = validateEditCountry();
    const isStateValid = validateEditState();
    const isCityValid = validateEditCity();

    if (!isCompanyNameValid || !isIndustryValid || !isPinCodeValid || !isCountryValid || !isStateValid || !isCityValid) {
      toast.error("Please fill in all required fields correctly");
      return;
    }

    try {
      setIsEditLoading(true);

      // Prepare company data with location values from dropdowns
      const companyData = {
        ...editForm,
        country: selectedCountry?.name || editForm.country,
        state: selectedState?.name || editForm.state,
        city: selectedCity?.name || editForm.city,
      };

      const response = await authenticatedFetch(buildExternalUrl(`crm/companies/${editingCompany._id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyData),
      });

      if (!response.ok) {
        throw new Error("Failed to update company");
      }

      const result = await response.json();
      console.log("Company updated successfully:", result);

      toast.success("Company updated successfully!");
      setIsEditOpen(false);
      setEditingCompany(null);

      // Refresh companies list
      await fetchCompanies();
      await fetchCompanyOwners();
    } catch (error) {
      console.error("Error updating company:", error);
      toast.error("Failed to update company");
    } finally {
      setIsEditLoading(false);
    }
  };

  // Handle delete company
  const handleDeleteClick = (company: Company) => {
    setDeletingCompany(company);
    setIsDeleteOpen(true);
  };

  const handleViewLeadsClick = (company: Company) => {
    const leads = Array.isArray(company.leads) ? company.leads : [];
    setViewingCompanyLeads(leads);
    setViewingCompanyName(company.companyName || "Company");
    setIsViewLeadsOpen(true);
  };

  const getLeadDisplayName = (lead: any) => {
    const direct =
      lead?.leadName ||
      lead?.name ||
      lead?.title ||
      "";
    if (direct) return String(direct);
    const contact = lead?.contact || (Array.isArray(lead?.contacts) ? lead.contacts[0] : null);
    const first = contact?.firstName || "";
    const last = contact?.lastName || "";
    const contactName = `${first} ${last}`.trim() || contact?.name || "";
    if (contactName) return String(contactName);
    const id = lead?._id || lead?.id;
    return id ? `Lead ${String(id).slice(-6)}` : "Unnamed Lead";
  };

  // Confirm delete company
  const handleDeleteConfirm = async () => {
    if (!deletingCompany) return;

    try {
      setIsDeleteLoading(true);

      const response = await authenticatedFetch(buildExternalUrl(`crm/companies/${deletingCompany._id}`), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete company");
      }

      console.log("Company deleted successfully");
      toast.success("Company deleted successfully!");
      setIsDeleteOpen(false);
      setDeletingCompany(null);

      // Refresh companies list
      await fetchCompanies();
      await fetchCompanyOwners();
    } catch (error) {
      console.error("Error deleting company:", error);
      toast.error("Failed to delete company");
    } finally {
      setIsDeleteLoading(false);
    }
  };

  // Format size from number to range string
  const formatSize = (size: string | number | undefined): string | undefined => {
    if (!size) return undefined;
    const numSize = typeof size === 'string' ? parseInt(size) : size;
    if (isNaN(numSize)) return size as string; // Return as-is if not a number

    if (numSize < 10) return "1-10";
    if (numSize < 50) return "10-50";
    if (numSize < 100) return "50-100";
    if (numSize < 500) return "100-500";
    if (numSize < 1000) return "500-1000";
    return "1000+";
  };

  // Get company initials for avatar
  const getCompanyInitials = (companyName: string): string => {
    if (!companyName) return "";
    const words = companyName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyName.substring(0, 2).toUpperCase();
  };

  // Get size badge color based on size range (matching Figma design)
  const getSizeBadgeColor = (size: string | undefined): { bg: string; text: string; border: string } => {
    if (!size) {
      return {
        bg: theme === "color" ? "bg-[rgba(0,255,255,0.1)]" : "bg-[#f4f5f7] dark:bg-[rgba(58,58,58,0.3)]",
        text: theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#6b7280] dark:text-[#9ca3af]",
        border: theme === "color" ? "border-[rgba(0,255,255,0.2)]" : "border-[#e5e7eb] dark:border-[#3a3a3a]"
      };
    }
    const sizeLower = size.toLowerCase();
    if (sizeLower.includes("500-1000") || sizeLower.includes("100-500")) {
      return {
        bg: theme === "color" ? "bg-[rgba(0,255,255,0.1)]" : "bg-[rgba(123,104,238,0.1)]",
        text: theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#7b68ee]",
        border: theme === "color" ? "border-[rgba(0,255,255,0.2)]" : "border-[rgba(123,104,238,0.2)]"
      };
    } else if (sizeLower.includes("50-100")) {
      return {
        bg: theme === "color" ? "bg-[rgba(0,255,255,0.1)]" : "bg-[rgba(236,72,153,0.1)]",
        text: theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#ec4899]",
        border: theme === "color" ? "border-[rgba(0,255,255,0.2)]" : "border-[rgba(236,72,153,0.2)]"
      };
    } else if (sizeLower.includes("1000+")) {
      return {
        bg: theme === "color" ? "bg-[rgba(0,255,255,0.1)]" : "bg-[rgba(16,185,129,0.1)]",
        text: theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#10b981]",
        border: theme === "color" ? "border-[rgba(0,255,255,0.2)]" : "border-[rgba(16,185,129,0.2)]"
      };
    } else if (sizeLower.includes("10-50")) {
      return {
        bg: theme === "color" ? "bg-[rgba(255,255,255,0.05)]" : "bg-[#f4f5f7] dark:bg-[rgba(58,58,58,0.3)]",
        text: theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]",
        border: theme === "color" ? "border-[rgba(0,255,255,0.2)]" : "border-[#e5e7eb] dark:border-[#3a3a3a]"
      };
    } else {
      return {
        bg: theme === "color" ? "bg-[rgba(123,104,238,0.1)]" : "bg-[rgba(123,104,238,0.1)]",
        text: theme === "color" ? "text-[#7b68ee]" : "text-[#7b68ee]",
        border: theme === "color" ? "border-[rgba(123,104,238,0.2)]" : "border-[rgba(123,104,238,0.2)]"
      };
    }
  };

  // Filter companies based on search term
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const activeOwnerName =
    selectedOwnerFilter === "all" ? "" : selectedOwnerName || "";
  const activeOwnerNameLower = activeOwnerName.trim().toLowerCase();
  const hasFilters =
    normalizedSearchTerm.length > 0 ||
    selectedOwnerFilter !== "all" ||
    selectedIndustryFilter !== "all";

  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      normalizedSearchTerm.length === 0 ||
      company.companyName.toLowerCase().includes(normalizedSearchTerm) ||
      company.industry.toLowerCase().includes(normalizedSearchTerm) ||
      company.city.toLowerCase().includes(normalizedSearchTerm) ||
      company.country.toLowerCase().includes(normalizedSearchTerm);

    const matchesOwner =
      selectedOwnerFilter === "all" ||
      (company.ownerId && company.ownerId === selectedOwnerFilter) ||
      (activeOwnerNameLower.length > 0 &&
        (company.ownerName || "").toLowerCase().includes(activeOwnerNameLower));

    const matchesIndustry =
      selectedIndustryFilter === "all" ||
      (company.industry || "").toLowerCase() === selectedIndustryFilter.toLowerCase();

    return matchesSearch && matchesOwner && matchesIndustry;
  });

  useEffect(() => {
    if (selectedCompanyIds.length === 0) return;
    setSelectedCompanyIds((prev) => {
      const filtered = prev.filter((id) => companies.some((company) => company._id === id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [companies, selectedCompanyIds]);

  const displayedCompanyIds = filteredCompanies
    .map((c) => c._id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const allDisplayedSelected =
    displayedCompanyIds.length > 0 &&
    displayedCompanyIds.every((id) => selectedCompanyIds.includes(id));
  const someDisplayedSelected =
    displayedCompanyIds.some((id) => selectedCompanyIds.includes(id)) && !allDisplayedSelected;

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompanyIds((prev) => Array.from(new Set([...prev, ...displayedCompanyIds])));
    } else {
      setSelectedCompanyIds((prev) => prev.filter((id) => !displayedCompanyIds.includes(id)));
    }
  };

  const handleToggleCompanySelection = (companyId: string, checked: boolean) => {
    setSelectedCompanyIds((prev) =>
      checked
        ? prev.includes(companyId)
          ? prev
          : [...prev, companyId]
        : prev.filter((id) => id !== companyId)
    );
  };

  const selectedCompanyIdSet = new Set(selectedCompanyIds);

  const getCompanyLastActivity = (company: Company) =>
    company.lastActivity ? new Date(company.lastActivity).toISOString().slice(0, 10) : "";

  const getCompanySizeLabel = (company: Company) =>
    formatSize(company.size) || company.size || "";

  const sortedCompanies = useMemo(() => {
    if (!companiesSort) return filteredCompanies;
    const direction = companiesSort.order === "asc" ? 1 : -1;

    const keyOf = (company: Company): string | number => {
      switch (companiesSort.by) {
        case "name":
          return (company.companyName || "").toLowerCase();
        case "industry":
          return (company.industry || "").toLowerCase();
        case "size":
          return String(getCompanySizeLabel(company)).toLowerCase();
        case "owner":
          return (company.ownerName || "").toLowerCase();
        case "openLeads":
          return company.openLeads ?? 0;
        case "wonDeals":
          return company.wonDeals ?? 0;
        case "lastActivity": {
          const time = company.lastActivity ? new Date(company.lastActivity).getTime() : NaN;
          // Undated companies sink to the bottom in both directions rather than
          // scattering through the list on an NaN comparison.
          return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
        }
        default:
          return "";
      }
    };

    return [...filteredCompanies].sort((a, b) => {
      const left = keyOf(a);
      const right = keyOf(b);
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right)) * direction;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCompanies, companiesSort]);

  const renderCompanyRowActions = (company: Company) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-[15px] w-[15px] p-0 text-[#9ca3af] hover:bg-transparent hover:text-[#e5e7eb]"
          aria-label="Company actions"
        >
          <MoreHorizontal className="h-[15px] w-[15px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-[#181818] border border-[#2a2d3a] text-white"
      >
        <DropdownMenuItem
          className="text-white hover:bg-white/5"
          onClick={() => handleViewCompany(company._id)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-white hover:bg-white/5"
          onClick={() => handleEditClick(company)}
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-400 hover:bg-red-500/10"
          onClick={() => handleDeleteClick(company)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const confirmBulkDelete = async () => {
    if (selectedCompanyIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      let failed = 0;
      for (const id of selectedCompanyIds) {
        const response = await authenticatedFetch(buildExternalUrl(`crm/companies/${id}`), {
          method: "DELETE",
        });
        if (!response.ok) failed += 1;
      }
      if (failed === 0) {
        toast.success(
          selectedCompanyIds.length === 1
            ? "Company deleted successfully!"
            : `${selectedCompanyIds.length} companies deleted successfully!`
        );
      } else {
        toast.error(`Failed to delete ${failed} compan${failed === 1 ? "y" : "ies"}`);
      }
      setSelectedCompanyIds([]);
      setIsBulkDeleteOpen(false);
      await fetchCompanies();
      await fetchCompanyOwners();
    } catch (error) {
      console.error("Error bulk deleting companies:", error);
      toast.error("Failed to delete companies. Please try again.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const figmaCheckboxClass =
    "h-[14px] w-[14px] rounded-full border-[1.5px] border-[#8c8c9e] data-[state=checked]:bg-[#8c8c9e] data-[state=checked]:text-[#181818]";

  const openCompaniesFilterDialog = () => {
    setFilterSelectedIndustries(selectedIndustryFilter === "all" ? ["all"] : [selectedIndustryFilter]);
    setFilterSelectedOwners(selectedOwnerFilter === "all" ? ["all"] : [selectedOwnerFilter]);
    setActiveFilterCategory("industry");
    const uniqueIndustries = Array.from(
      new Set(
        companies
          .map((company) => company.industry)
          .filter((industry) => industry && industry.trim() !== "")
      )
    ) as string[];
    setAvailableFilterIndustries(uniqueIndustries.sort());
    setIsFilterDialogOpen(true);
  };

  // Add Company validation functions
  const validateAddCompanyName = (name: string): boolean => {
    if (!name.trim()) {
      setAddCompanyNameError("Company name is required");
      return false;
    }
    setAddCompanyNameError("");
    return true;
  };

  // Handle Add Company
  const handleAddCompany = async () => {
    // Validate required fields
    const isCompanyNameValid = validateAddCompanyName(addForm.companyName);

    if (!isCompanyNameValid) {
      toast.error("Please fill in all required fields correctly");
      return;
    }

    try {
      setIsAddLoading(true);

      const companyData: any = {
        companyName: addForm.companyName,
        industry: addForm.industry || undefined,
        website: addForm.website || undefined,
        size: addForm.size || undefined,
        revenue: addForm.revenue || undefined,
      };

      const response = await authenticatedFetch(buildExternalUrl("crm/companies"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyData),
      });

      if (!response.ok) {
        throw new Error("Failed to create company");
      }

      const result = await response.json();
      console.log("Company created successfully:", result);
      toast.success("Company created successfully!");

      // Reset form
      setAddForm({
        companyName: "",
        industry: "",
        website: "",
        size: "",
        revenue: "",
      });
      setAddCompanyNameError("");
      setIsAddOpen(false);

      // Refresh companies list
      await fetchCompanies();
      await fetchCompanyOwners();
    } catch (error) {
      console.error("Error creating company:", error);
      toast.error("Failed to create company. Please try again.");
    } finally {
      setIsAddLoading(false);
    }
  };

  // Fetch companies on component mount
  useEffect(() => {
    if (hasFetchedInitialCompanies.current) return;
    hasFetchedInitialCompanies.current = true;
    fetchCompanies();
    fetchCompanyOwners();
  }, [fetchCompanies, fetchCompanyOwners]);

  useEffect(() => {
    const onOpenAdd = () => setIsAddOpen(true);
    window.addEventListener("deals:open-add-company", onOpenAdd);
    return () => window.removeEventListener("deals:open-add-company", onOpenAdd);
  }, []);

  useDealsInlineRefresh("companies", () => {
    fetchCompanies(currentPageRef.current);
  });

  // Refetch companies when owner filter changes
  useEffect(() => {
    if (isLoadingOwners) return;
    const ownerName = selectedOwnerName.trim();
    const normalizedOwner = ownerName ? ownerName.toLowerCase() : "";
    const appliedOwner = lastAppliedCompanyOwnerRef.current;

    if (selectedOwnerFilter === "all" && normalizedOwner === "") {
      if (appliedOwner !== "") {
        lastAppliedCompanyOwnerRef.current = "";
        fetchCompanies(1);
      }
      return;
    }

    if (normalizedOwner === appliedOwner) {
      return;
    }

    lastAppliedCompanyOwnerRef.current = normalizedOwner;
    fetchCompanies(1);
  }, [selectedOwnerFilter, isLoadingOwners, selectedOwnerName, fetchCompanies]);

  useEffect(() => {
    if (selectedIndustryFilter === "all") return;
    const exists = industryOptions.some(
      (option) => option.toLowerCase() === selectedIndustryFilter.toLowerCase()
    );
    if (!exists) {
      setSelectedIndustryFilter("all");
    }
  }, [industryOptions, selectedIndustryFilter]);

  useEffect(() => {
    if (!hasFetchedInitialCompanies.current) return;
    fetchCompanies(1);
  }, [selectedIndustryFilter, fetchCompanies]);

  const handleExportCompanies = () => {
    if (companies.length === 0) {
      toast.error("No companies available to export");
      return;
    }

    try {
      const headers = [
        "Company Name",
        "Industry",
        "Website",
        "Phone Number",
        "Email",
        "Address",
        "City",
        "State",
        "Country",
        "Pincode",
        "Owner",
        "Last Activity",
      ];

      const rows = companies.map((company) => [
        company.companyName || "",
        company.industry || "",
        company.website || "",
        (company as any).phoneNumber || (company as any).phone || "",
        (company as any).email || "",
        company.address || "",
        company.city || "",
        company.state || "",
        company.country || "",
        company.pinCode || "",
        company.ownerName || "",
        company.lastActivity ? new Date(company.lastActivity).toLocaleString() : "",
      ]);

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      worksheet["!cols"] = [
        { wch: 26 },
        { wch: 18 },
        { wch: 28 },
        { wch: 18 },
        { wch: 26 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 12 },
        { wch: 20 },
        { wch: 24 },
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, "Companies");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Companies_Export_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Companies exported successfully");
    } catch (error) {
      console.error("Companies export error:", error);
      toast.error("Failed to export companies. Please try again.");
    }
  };

  return (
    <CRMPageLayout fill={isFigma}>
      {isInitialLoad && loading ? (
        <div className={`p-6 ${isFigma ? "bg-[#0e0e0e]" : ""}`}>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className={`h-8 w-8 animate-spin mx-auto mb-4 ${isFigma ? "text-[#9ca3af]" : "text-muted-foreground"}`} />
              <p className={isFigma ? "text-[#9ca3af]" : "text-muted-foreground"}>Loading companies...</p>
            </div>
          </div>
        </div>
      ) : (
        <div className={`flex flex-col items-start relative size-full ${
          isFigma
            ? "min-h-0 overflow-hidden bg-[#0e0e0e]"
            : theme === "color"
              ? "bg-[#0A0A1E]"
              : "bg-white dark:bg-[#1a1a1a]"
          }`}>
          {/* Header Section */}
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
                      placeholder="Search companies..."
                      /* !bg-transparent: the inline Deals shell styles bare
                         `input` with a #16161f fill, which outranks a plain
                         bg utility and tinted this field navy. */
                      className="h-[20px] border-0 !bg-transparent p-0 text-[12px] text-[#e5e7eb] placeholder:text-[#9ca3af] focus-visible:ring-0 focus-visible:ring-offset-0"
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-[8px] shrink-0">
                    {selectedCompanyIds.length > 0 && (
                      <Button
                        variant="destructive"
                        className="flex items-center gap-2 h-[32px] px-[12px] py-[6px] rounded-[6px] text-[12px] font-semibold shrink-0"
                        onClick={() => setIsBulkDeleteOpen(true)}
                        disabled={isBulkDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Selected
                        <span className="text-xs font-medium text-white/80">
                          ({selectedCompanyIds.length})
                        </span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="h-[32px] px-[12px] py-[6px] rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] text-[12px] font-semibold shadow-none hover:bg-[#181818]"
                      onClick={openCompaniesFilterDialog}
                    >
                      <img
                        alt=""
                        src="/figma/deals/leads/filter.svg"
                        className="h-[15px] w-[15px] mr-[8px]"
                      />
                      Filters
                      {(selectedIndustryFilter !== "all" || selectedOwnerFilter !== "all") && (
                        <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] shadow-none hover:bg-[#181818]"
                      onClick={handleExportCompanies}
                      aria-label="Export companies"
                    >
                      <img
                        alt=""
                        src="/figma/deals/leads/export.svg"
                        className="h-[15px] w-[15px]"
                      />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] shadow-none hover:bg-[#181818]"
                      onClick={() => setIsBulkUploadOpen(true)}
                      aria-label="Bulk upload companies"
                    >
                      <img
                        alt=""
                        src="/figma/deals/leads/bulk-upload.svg"
                        className="h-[15px] w-[15px]"
                      />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] shadow-none hover:bg-[#181818]"
                      onClick={() => setIsAddOpen(true)}
                      aria-label="Add company"
                    >
                      <Plus className="h-[15px] w-[15px]" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <DealsPageToolbar
            className={theme === "color"
              ? "border-[rgba(0,255,255,0.2)]"
              : "border-[#e5e7eb] dark:border-[#3a3a3a]"
            }
            search={
              <DealsSearchField>
                <Search className={`absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] z-10 ${theme === "color"
                  ? "text-[rgba(0,255,255,0.9)]"
                  : "text-[#6b7280] dark:text-[#9ca3af]"
                  }`} />
                <Input
                  type="text"
                  placeholder="Search companies..."
                  className={`pl-[32px] pr-3 py-1 h-[32px] w-full rounded-[6px] text-[14px] focus-visible:ring-0 ${theme === "color"
                    ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                    : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(58,58,58,0.3)] border border-[#e5e7eb] dark:border-[#3a3a3a] text-[#6b7280] dark:text-[#9ca3af] placeholder:text-[#6b7280] dark:placeholder:text-[#9ca3af] focus-visible:border-[#e5e7eb] dark:focus-visible:border-[#3a3a3a]"
                    }`}
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </DealsSearchField>
            }
            actions={<>
                {/* Filters Button */}
                <Button
                  variant="outline"
                  className={`${dealsToolbarActionBtn} rounded-[6px] text-[12px] font-bold shadow-none ${theme === "color"
                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                    : "border border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[rgba(58,58,58,0.3)] text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50 dark:hover:bg-[rgba(58,58,58,0.5)]"
                    }`}
                  onClick={openCompaniesFilterDialog}
                >
                  <Filter className="h-4 w-4 sm:mr-[6px]" />
                  <span className="hidden sm:inline">Filters</span>
                </Button>
                {/* Divider */}
                <div className={`hidden sm:block w-px h-5 shrink-0 ${theme === "color"
                  ? "bg-[rgba(0,255,255,0.2)]"
                  : "bg-[#e5e7eb] dark:bg-[#3a3a3a]"
                  }`} />
                {/* Export Button */}
                <Button
                  variant="outline"
                  className={`${dealsToolbarActionBtn} rounded-[6px] text-[12px] font-bold shadow-none ${theme === "color"
                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                    : "border border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[rgba(58,58,58,0.3)] text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50 dark:hover:bg-[rgba(58,58,58,0.5)]"
                    }`}
                  onClick={handleExportCompanies}
                >
                  <Download className="h-4 w-4 sm:mr-[6px]" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                {/* Import CSV Button */}
                <Button
                  variant="outline"
                  className={`${dealsToolbarActionBtn} rounded-[6px] text-[12px] font-bold shadow-none ${theme === "color"
                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                    : "border border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[rgba(58,58,58,0.3)] text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50 dark:hover:bg-[rgba(58,58,58,0.5)]"
                    }`}
                  onClick={() => setIsBulkUploadOpen(true)}
                >
                  <Upload className="h-4 w-4 sm:mr-[6px]" />
                  <span className="hidden sm:inline">Import CSV</span>
                </Button>
                {/* Add Company Button */}
                <Button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  className={`${dealsToolbarActionBtn} sm:px-3 rounded-[6px] text-[12px] font-bold shadow-none ${
                    theme === "color"
                      ? "bg-[#0ff] text-[#0a0e27] hover:bg-[#0dd]"
                      : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                  }`}
                >
                  <Plus className="h-4 w-4 sm:mr-[6px]" />
                  <span className="hidden sm:inline">Add Company</span>
                </Button>
            </>}
          />
          )}

          {error && (
            <div className={`mb-4 p-4 rounded-lg border ${
              isFigma
                ? "mx-5 mt-4 bg-[#181818] border-[#2a2d3a]"
                : "bg-red-50 border-red-200"
            }`}>
              <p className={`text-sm ${isFigma ? "text-[#e5e7eb]" : "text-red-700"}`}>
                {error} - Please check your connection and try refreshing.
              </p>
            </div>
          )}

          {/* Companies Count Section */}
          {!isFigma && (
          <div className={`border-b h-[33px] relative shrink-0 w-full ${theme === "color"
            ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)]"
            : "bg-[rgba(244,245,247,0.3)] dark:bg-[rgba(42,42,42,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
            }`}>
            <div className="flex items-center h-full px-3 sm:px-6 py-2">
              <p className={`text-[12px] font-bold leading-[16px] ${theme === "color"
                ? "text-[rgba(0,255,255,0.9)]"
                : "text-[#6b7280] dark:text-[#9ca3af]"
                }`}>
                {hasFilters ? filteredCompanies.length : totalCompanies} Companies
              </p>
            </div>
          </div>
          )}

          {isFigma ? (
            <div className="relative flex min-h-0 w-full flex-1 flex-col bg-[#161616]">
              <CompaniesDataTable
                rows={sortedCompanies}
                loading={loading}
                emptyLabel="No companies found."
                sort={companiesSort}
                onSortChange={setCompaniesSort}
                getRowId={(company) => String(company?._id || "")}
                onRowClick={(company) => handleViewCompany(company._id)}
                selectedIds={selectedCompanyIdSet}
                allSelected={allDisplayedSelected}
                someSelected={someDisplayedSelected}
                onToggleRow={(id) =>
                  handleToggleCompanySelection(id, !selectedCompanyIdSet.has(id))
                }
                onToggleAll={() => handleToggleSelectAll(!allDisplayedSelected)}
                getCompanyName={(company) => company.companyName || ""}
                getWebsite={(company) => company.website || ""}
                getIndustry={(company) => company.industry || ""}
                getSize={getCompanySizeLabel}
                getOwner={(company) => ({ name: company.ownerName || "" })}
                getOpenLeads={(company) => company.openLeads ?? 0}
                getWonDeals={(company) => company.wonDeals ?? 0}
                getLastActivity={getCompanyLastActivity}
                renderActions={renderCompanyRowActions}
                footerTotals={[
                  {
                    label: "Companies",
                    value: (hasFilters
                      ? filteredCompanies.length
                      : totalCompanies
                    ).toLocaleString(),
                  },
                  ...(selectedCompanyIds.length > 0
                    ? [
                      {
                        label: "Selected",
                        value: selectedCompanyIds.length.toLocaleString(),
                      },
                    ]
                    : []),
                ]}
                pagination={{
                  page: currentPage,
                  totalPages: Math.max(1, totalPages),
                  rangeLabel: `${totalCompanies === 0 ? 0 : (currentPage - 1) * limit + 1
                    } to ${Math.min(currentPage * limit, totalCompanies)}`,
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
                    currentPageRef.current = 1;
                    fetchCompanies(1, next);
                  },
                }}
              />
            </div>
          ) : (
          <div className="w-full">
            {/* Mobile companies table - horizontally scrollable */}
            <div className="md:hidden overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 pb-24">
              <div className="inline-block min-w-full px-3 sm:px-4 md:px-6">
                {loading ? (
                  <div className="py-16 flex flex-col items-center justify-center text-sm text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mb-3" />
                    Loading companies...
                  </div>
                ) : filteredCompanies.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground px-3">No companies found.</div>
                ) : (
                  <table className="min-w-[700px] w-full border-collapse">
                    <thead>
                      <tr className={`border-b-[0.667px] ${
                        isFigma
                          ? "bg-[#2e2e2e] border-[#2a2d3a]"
                          : theme === "color"
                            ? "bg-[rgba(255,255,255,0.03)] border-[rgba(0,255,255,0.2)]"
                            : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(42,42,42,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
                      }`}>
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
                              aria-label="Select all visible companies"
                              className={figmaCheckboxClass}
                            />
                          </th>
                        )}
                        <th className={`font-bold text-left px-3 py-2 ${
                          isFigma
                            ? "text-[10px] leading-[14px] text-[#9ca3af]"
                            : theme === "color" ? "text-[12px] leading-[16px] text-[rgba(0,255,255,0.6)]" : "text-[12px] leading-[16px] text-[#6b7280] dark:text-[#9ca3af]"
                        }`}>Company</th>
                        <th className={`font-bold text-left px-3 py-2 ${
                          isFigma
                            ? "text-[10px] leading-[14px] text-[#9ca3af]"
                            : theme === "color" ? "text-[12px] leading-[16px] text-[rgba(0,255,255,0.6)]" : "text-[12px] leading-[16px] text-[#6b7280] dark:text-[#9ca3af]"
                        }`}>Industry</th>
                        <th className={`font-bold text-left px-3 py-2 ${
                          isFigma
                            ? "text-[10px] leading-[14px] text-[#9ca3af]"
                            : theme === "color" ? "text-[12px] leading-[16px] text-[rgba(0,255,255,0.6)]" : "text-[12px] leading-[16px] text-[#6b7280] dark:text-[#9ca3af]"
                        }`}>Size</th>
                        <th className={`font-bold text-left px-3 py-2 ${
                          isFigma
                            ? "text-[10px] leading-[14px] text-[#9ca3af]"
                            : theme === "color" ? "text-[12px] leading-[16px] text-[rgba(0,255,255,0.6)]" : "text-[12px] leading-[16px] text-[#6b7280] dark:text-[#9ca3af]"
                        }`}>Owner</th>
                        <th className={`font-bold text-left px-3 py-2 ${
                          isFigma
                            ? "text-[10px] leading-[14px] text-[#9ca3af]"
                            : theme === "color" ? "text-[12px] leading-[16px] text-[rgba(0,255,255,0.6)]" : "text-[12px] leading-[16px] text-[#6b7280] dark:text-[#9ca3af]"
                        }`}>Open Leads</th>
                        <th className={`font-bold text-left px-3 py-2 ${
                          isFigma
                            ? "text-[10px] leading-[14px] text-[#9ca3af]"
                            : theme === "color" ? "text-[12px] leading-[16px] text-[rgba(0,255,255,0.6)]" : "text-[12px] leading-[16px] text-[#6b7280] dark:text-[#9ca3af]"
                        }`}>Won Deals</th>
                        <th className={`font-bold text-left px-3 py-2 ${
                          isFigma
                            ? "text-[10px] leading-[14px] text-[#9ca3af]"
                            : theme === "color" ? "text-[12px] leading-[16px] text-[rgba(0,255,255,0.6)]" : "text-[12px] leading-[16px] text-[#6b7280] dark:text-[#9ca3af]"
                        }`}>Last Activity</th>
                        <th className="w-[52px] px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((company) => {
                        const formattedSize = formatSize(company.size) || company.size || "";
                        const sizeColors = getSizeBadgeColor(company.size);
                        return (
                          <tr
                            key={company._id}
                            className={`cursor-pointer border-b-[0.667px] ${
                              isFigma
                                ? "border-[#2a2d3a] bg-[#181818]"
                                : theme === "color"
                                  ? "border-[rgba(0,255,255,0.2)] hover:bg-[rgba(0,255,255,0.05)]"
                                  : "border-[#e5e7eb] dark:border-[#3a3a3a] hover:bg-muted/60"
                            }`}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              const isInteractive =
                                target.closest('button') ||
                                target.closest('input') ||
                                target.closest('[role="menuitem"]') ||
                                target.closest('[role="checkbox"]') ||
                                target.closest('[role="button"]');
                              if (!isInteractive) {
                                handleViewCompany(company._id);
                              }
                            }}
                          >
                            {isFigma && (
                              <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedCompanyIds.includes(company._id)}
                                  onCheckedChange={(checked) =>
                                    handleToggleCompanySelection(company._id, checked === true)
                                  }
                                  aria-label={`Select ${company.companyName}`}
                                  className={figmaCheckboxClass}
                                />
                              </td>
                            )}
                            <td className={`px-3 ${isFigma ? "py-3" : "py-2"}`}>
                              <div className="flex items-center gap-2">
                                <div className={`flex items-center justify-center rounded-full size-7 shrink-0 ${
                                  isFigma
                                    ? "bg-[rgba(255,194,0,0.15)]"
                                    : theme === "color"
                                      ? "bg-[rgba(1,255,255,0.1)]"
                                      : "bg-[rgba(123,104,238,0.1)]"
                                }`}>
                                  <span className={`text-[10px] font-bold ${
                                    isFigma
                                      ? "text-brand"
                                      : theme === "color"
                                        ? "text-[#0ff]"
                                        : "text-[#7b68ee]"
                                  }`}>
                                    {getCompanyInitials(company.companyName)}
                                  </span>
                                </div>
                                <span className={`font-bold truncate max-w-[160px] ${
                                  isFigma
                                    ? "text-[12px] leading-[16px] text-white"
                                    : theme === "color" ? "text-[14px] leading-[20px] text-white" : "text-[14px] leading-[20px] text-blue-600 dark:text-blue-400"
                                }`}>
                                  {company.companyName}
                                </span>
                              </div>
                            </td>
                            <td className={`px-3 ${isFigma ? "py-3" : "py-2"}`}>
                              <span className={`${isFigma ? "text-[12px] text-white" : `text-[11px] font-bold leading-[16.5px] px-2 py-0.5 rounded-[6px] border ${
                                theme === "color"
                                  ? "bg-[rgba(255,255,255,0.03)] border-[rgba(0,255,255,0.2)] text-white"
                                  : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(58,58,58,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a] text-[#1f1f1f] dark:text-[#e5e5e5]"
                              } inline-block`}`}>
                                {company.industry || "--"}
                              </span>
                            </td>
                            <td className={`px-3 ${isFigma ? "py-3" : "py-2"}`}>
                              {formattedSize ? (
                                <span
                                  className={
                                    isFigma
                                      ? "text-[12px] text-white inline-flex items-center gap-1.5"
                                      : `text-[11px] font-bold leading-[16.5px] px-2 py-0.5 rounded-[6px] border inline-flex items-center gap-1.5 ${sizeColors.bg} ${sizeColors.text} ${sizeColors.border}`
                                  }
                                >
                                  <Users className="size-3" />
                                  {formattedSize}
                                </span>
                              ) : (
                                <span className={`text-[12px] ${
                                  isFigma ? "text-white" : theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                                }`}>--</span>
                              )}
                            </td>
                            <td className={`px-3 ${isFigma ? "py-3" : "py-2"}`}>
                              <span className={`${isFigma ? "text-[12px] text-white" : `text-[14px] leading-[20px] ${
                                theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                              }`}`}>{company.ownerName || "--"}</span>
                            </td>
                            <td className={`px-3 ${isFigma ? "py-3" : "py-2"}`}>
                              <span className={`${isFigma ? "text-[12px] text-white font-bold" : `text-[14px] leading-[20px] font-bold ${
                                theme === "color" ? "text-white" : "text-[#1f1f1f] dark:text-[#e5e5e5]"
                              }`}`}>{company.openLeads ?? 0}</span>
                            </td>
                            <td className={`px-3 ${isFigma ? "py-3" : "py-2"}`}>
                              <span className={`${isFigma ? "text-[12px] text-white font-bold" : `text-[14px] leading-[20px] font-bold ${
                                theme === "color" ? "text-white" : "text-[#1f1f1f] dark:text-[#e5e5e5]"
                              }`}`}>{company.wonDeals ?? 0}</span>
                            </td>
                            <td className={`px-3 ${isFigma ? "py-3" : "py-2"}`}>
                              <span className={`${isFigma ? "text-[12px] text-[#9ca3af]" : `text-[14px] leading-[20px] ${
                                theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                              }`}`}>{company.lastActivity ? new Date(company.lastActivity).toISOString().slice(0, 10) : "--"}</span>
                            </td>
                            <td className={`px-3 ${isFigma ? "py-3" : "py-2"}`} onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={
                                      isFigma
                                        ? "h-[15px] w-[15px] p-0 text-[#9ca3af] hover:bg-transparent hover:text-[#e5e7eb]"
                                        : `h-7 w-7 ${
                                            theme === "color"
                                              ? "hover:bg-[rgba(0,255,255,0.1)]"
                                              : "hover:bg-muted/50"
                                          }`
                                    }
                                    aria-label="Company actions"
                                  >
                                    <MoreHorizontal className={
                                      isFigma
                                        ? "h-[15px] w-[15px] text-[#9ca3af]"
                                        : `h-4 w-4 ${
                                            theme === "color" ? "text-white" : theme === "dark" ? "text-white" : "text-black"
                                          }`
                                    } />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className={
                                  isFigma
                                    ? "bg-[#181818] border border-[#2a2d3a] text-white"
                                    : theme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : ""
                                }>
                                  <DropdownMenuItem onClick={() => handleViewCompany(company._id)} className={
                                    isFigma ? "text-white hover:bg-white/5" : theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""
                                  }>
                                    <Eye className="h-4 w-4 mr-2" />View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewLeadsClick(company)} className={
                                    isFigma ? "text-white hover:bg-white/5" : theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""
                                  }>
                                    <TrendingUp className="h-4 w-4 mr-2" />View Leads
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditClick(company)} className={
                                    isFigma ? "text-white hover:bg-white/5" : theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""
                                  }>
                                    <Pencil className="h-4 w-4 mr-2" />Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteClick(company)} className={
                                    isFigma ? "text-red-400 hover:bg-red-500/10" : theme === "color" ? "text-[rgba(255,100,100,0.9)] hover:bg-[rgba(255,0,0,0.1)]" : ""
                                  }>
                                    <Trash2 className="h-4 w-4 mr-2" />Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
<div className={`hidden md:block w-full ${isFigma ? "" : `rounded-xl border shadow-sm ${theme === "color"
              ? "border-[rgba(0,255,255,0.2)] bg-transparent"
              : "border-border/70 dark:border-border/40 bg-card text-card-foreground"
              }`}`}>
              <div className="w-full pb-6 overflow-x-auto">
                <Table className={isFigma ? "w-full min-w-[900px]" : "w-full min-w-[900px]"}>
                  <TableHeader className={`border-b ${
                    isFigma
                      ? "bg-[#2e2e2e] border-[#2a2d3a]"
                      : theme === "color"
                        ? "bg-[rgba(255,255,255,0.03)] border-[rgba(0,255,255,0.2)]"
                        : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(42,42,42,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
                    }`}>
                    <TableRow className="hover:bg-transparent">
                      {isFigma && (
                        <TableHead className="w-[32px] px-2 py-2">
                          <Checkbox
                            checked={
                              allDisplayedSelected
                                ? true
                                : someDisplayedSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(checked) => handleToggleSelectAll(checked === true)}
                            aria-label="Select all visible companies"
                            className={figmaCheckboxClass}
                          />
                        </TableHead>
                      )}
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Company</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Industry</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Size</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Owner</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Open Leads</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Won Deals</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Last Activity</TableHead>
                      <TableHead className={`font-bold px-3 py-2 w-[52px] ${isFigma ? "text-[10px] leading-[14px] text-[#9ca3af]" : "text-[12px] leading-[16px]"}`}>
                        {isFigma ? "Actions" : ""}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={isFigma ? 9 : 8} className={`py-16 ${isFigma ? "text-[#9ca3af]" : ""}`}>
                          <div className={`flex flex-col items-center justify-center text-sm ${isFigma ? "text-[#9ca3af]" : "text-muted-foreground"}`}>
                            <RefreshCw className="h-6 w-6 animate-spin mb-3 text-muted-foreground" />
                            Loading companies...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredCompanies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isFigma ? 9 : 8} className={`py-16 text-center ${isFigma ? "text-[#9ca3af]" : "text-muted-foreground"}`}>
                          No companies found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCompanies.map((company) => {
                        const sizeColors = getSizeBadgeColor(company.size);
                        const formattedSize = formatSize(company.size) || company.size || "";
                        return (
                          <TableRow key={company._id} className={`border-b ${
                            isFigma
                              ? "border-[#2a2d3a] bg-[#181818] hover:bg-[#181818]"
                              : theme === "color"
                                ? "border-[rgba(0,255,255,0.2)] hover:bg-[rgba(0,255,255,0.05)]"
                                : "border-[#e5e7eb] dark:border-[#3a3a3a] hover:bg-muted/30 dark:hover:bg-[rgba(58,58,58,0.2)]"
                            } transition-colors group`}>
                            {isFigma && (
                              <TableCell className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedCompanyIds.includes(company._id)}
                                  onCheckedChange={(checked) =>
                                    handleToggleCompanySelection(company._id, checked === true)
                                  }
                                  aria-label={`Select ${company.companyName}`}
                                  className={figmaCheckboxClass}
                                />
                              </TableCell>
                            )}
                            {/* Company Column */}
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 h-7">
                                  <div
                                    className={`flex items-center justify-center rounded-full size-7 shrink-0 ${
                                      isFigma
                                        ? "bg-[rgba(255,194,0,0.15)]"
                                        : theme === "color"
                                          ? "bg-[rgba(1,255,255,0.1)]"
                                          : "bg-[rgba(123,104,238,0.1)]"
                                    }`}
                                  >
                                    <span
                                      className={`text-[10px] font-bold leading-[15px] ${
                                        isFigma
                                          ? "text-brand"
                                          : theme === "color"
                                            ? "text-[#0ff]"
                                            : "text-[#7b68ee]"
                                      }`}
                                    >
                                      {getCompanyInitials(company.companyName)}
                                    </span>
                                  </div>
                                  <span
                                    className={`font-bold cursor-pointer hover:underline ${
                                      isFigma
                                        ? "text-[12px] leading-[16px] text-white"
                                        : `text-[14px] leading-[20px] ${theme === "color" ? "text-white" : "text-blue-600 dark:text-blue-400"}`
                                      }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewCompany(company._id);
                                    }}
                                  >
                                    {company.companyName}
                                  </span>
                                </div>
                                {company.website && (
                                  <div className="flex items-center gap-1.5 pl-9">
                                    <Globe
                                      className={`size-3 ${
                                        isFigma
                                          ? "text-brand"
                                          : theme === "color"
                                            ? "text-[#0ff]"
                                            : "text-[#7b68ee]"
                                      }`}
                                    />
                                    <a
                                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`hover:underline ${
                                        isFigma
                                          ? "text-[12px] leading-[16px] text-[#9ca3af]"
                                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[#0ff]" : "text-[#7b68ee]"}`
                                        }`}
                                    >
                                      {company.website}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            {/* Industry Column */}
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                              {isFigma ? (
                                <span className="text-[12px] text-white">{company.industry || "--"}</span>
                              ) : (
                              <span className={`text-[11px] font-bold leading-[16.5px] px-2 py-0.5 rounded-[6px] border ${theme === "color"
                                ? "bg-[rgba(255,255,255,0.03)] border-[rgba(0,255,255,0.2)] text-white"
                                : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(58,58,58,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a] text-[#1f1f1f] dark:text-[#e5e5e5]"
                                } inline-block`}>
                                {company.industry || "--"}
                              </span>
                              )}
                            </TableCell>
                            {/* Size Column */}
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                              {formattedSize ? (
                                <span
                                  className={
                                    isFigma
                                      ? "text-[12px] text-white inline-flex items-center gap-1.5"
                                      : `text-[11px] font-bold leading-[16.5px] px-2 py-0.5 rounded-[6px] border inline-flex items-center gap-1.5 ${sizeColors.bg} ${sizeColors.text} ${sizeColors.border}`
                                  }
                                >
                                  <Users className="size-3" />
                                  {formattedSize}
                                </span>
                              ) : (
                                <span className={`text-[12px] ${isFigma ? "text-white" : theme === "color"
                                  ? "text-[rgba(0,255,255,0.6)]"
                                  : "text-[#6b7280] dark:text-[#9ca3af]"
                                  }`}>--</span>
                              )}
                            </TableCell>
                            {/* Owner Column */}
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                              <span className={`${isFigma ? "text-[12px] text-white" : `text-[14px] leading-[20px] ${theme === "color"
                                ? "text-[rgba(0,255,255,0.6)]"
                                : "text-[#6b7280] dark:text-[#9ca3af]"
                                }`}`}>
                                {company.ownerName || "--"}
                              </span>
                            </TableCell>
                            {/* Open Leads Column */}
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                              {isFigma ? (
                                <span className="text-[12px] font-bold text-white">{company.openLeads ?? 0}</span>
                              ) : (
                              <span className={`text-[12px] font-bold leading-[16px] px-2 py-1 rounded-[6px] inline-flex items-center gap-1.5 ${theme === "color"
                                ? "bg-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                                : "bg-[rgba(245,158,11,0.1)] text-[#f59e0b]"
                                }`}>
                                <TrendingUp className="size-3" />
                                {company.openLeads ?? 0}
                              </span>
                              )}
                            </TableCell>
                            {/* Won Deals Column */}
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                              {isFigma ? (
                                <span className="text-[12px] font-bold text-white">{company.wonDeals ?? 0}</span>
                              ) : (
                              <span className={`text-[12px] font-bold leading-[16px] px-2 py-1 rounded-[6px] inline-flex items-center gap-1.5 ${theme === "color"
                                ? "bg-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                                : "bg-[rgba(16,185,129,0.1)] text-[#10b981]"
                                }`}>
                                <CheckCircle2 className="size-3" />
                                {company.wonDeals ?? 0}
                              </span>
                              )}
                            </TableCell>
                            {/* Last Activity Column */}
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                              <span className={`${isFigma ? "text-[12px] text-[#9ca3af]" : `text-[14px] leading-[20px] ${theme === "color"
                                ? "text-[rgba(0,255,255,0.6)]"
                                : "text-[#6b7280] dark:text-[#9ca3af]"
                                }`}`}>
                                {company.lastActivity ? new Date(company.lastActivity).toISOString().slice(0, 10) : "--"}
                              </span>
                            </TableCell>
                            {/* Actions Column */}
                            <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={
                                      isFigma
                                        ? "h-[15px] w-[15px] p-0 text-[#9ca3af] hover:bg-transparent hover:text-[#e5e7eb]"
                                        : `h-7 w-7 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ${theme === "color"
                                          ? "hover:bg-[rgba(0,255,255,0.1)]"
                                          : "hover:bg-muted/50"
                                          }`
                                    }
                                  >
                                    <MoreHorizontal className={
                                      isFigma
                                        ? "h-[15px] w-[15px] text-[#9ca3af]"
                                        : `h-4 w-4 ${theme === "color"
                                          ? "text-white group-hover:text-white"
                                          : theme === "dark"
                                            ? "text-white group-hover:text-white"
                                            : "text-black group-hover:text-black"
                                          }`
                                    } />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className={
                                  isFigma
                                    ? "bg-[#181818] border border-[#2a2d3a] text-white"
                                    : theme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : ""
                                }>
                                  <DropdownMenuItem onClick={() => handleViewCompany(company._id)} className={
                                    isFigma ? "text-white hover:bg-white/5" : theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""
                                  }>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleViewLeadsClick(company)}
                                    className={
                                      isFigma ? "text-white hover:bg-white/5" : theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""
                                    }
                                  >
                                    <TrendingUp className="h-4 w-4 mr-2" />
                                    View Leads
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditClick(company)} className={
                                    isFigma ? "text-white hover:bg-white/5" : theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""
                                  }>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteClick(company)} className={
                                    isFigma ? "text-red-400 hover:bg-red-500/10" : theme === "color" ? "text-[rgba(255,100,100,0.9)] hover:bg-[rgba(255,0,0,0.1)]" : ""
                                  }>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Filter Info */}
              {hasFilters && (
                <div className="flex items-center justify-between mt-6 px-6">
                  <div className="text-sm text-muted-foreground">
                    Found {filteredCompanies.length} result{filteredCompanies.length !== 1 ? 's' : ''}
                    {normalizedSearchTerm.length > 0 && (
                      <>
                        {' '}for &quot;{searchTerm.trim()}&quot;
                      </>
                    )}
                    {selectedOwnerFilter !== "all" && activeOwnerName && (
                      <>
                        {normalizedSearchTerm.length > 0 ? ' and' : ' for'} owner {activeOwnerName}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {normalizedSearchTerm.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSearch("")}
                        className="text-primary hover:text-primary/80"
                      >
                        Clear Search
                      </Button>
                    )}
                    {selectedOwnerFilter !== "all" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOwnerFilter("all");
                          setSelectedOwnerName("");
                        }}
                        className="text-primary hover:text-primary/80"
                      >
                        Clear Owner Filter
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Pagination */}
              {!searchTerm && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 mb-6 pb-16 px-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCompanies)} of {totalCompanies} companies
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>

                    {/* Page numbers - hidden on mobile */}
                    <div className="hidden sm:flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className={`w-8 h-8 p-0 ${currentPage === pageNum
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "hover:bg-muted/60 dark:hover:bg-white/10"
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
                      className="flex items-center gap-1"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Delete Company Dialog */}
      {isFigma ? (
        <DeleteLeadsDialog
          open={isDeleteOpen}
          onOpenChange={(open) => {
            setIsDeleteOpen(open);
            if (!open) setDeletingCompany(null);
          }}
          leads={
            deletingCompany
              ? [{ id: deletingCompany._id, name: deletingCompany.companyName }]
              : []
          }
          title="Delete Company (1)"
          description="This action is permanent. The company will be deleted and cannot be recovered."
          selectedLabel="Selected company"
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleteLoading}
        />
      ) : (
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent
          className={`sm:max-w-[400px] ${resolvedTheme === "color"
            ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)] text-white"
            : resolvedTheme === "dark"
              ? "bg-[#14141b] border-[#3a3a3a] text-[#e5e5e5]"
              : "bg-white border-[#e5e7eb]"
            }`}
        >
          <DialogHeader>
            <DialogTitle className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#f3f4f6]" : ""}>
              Delete Company
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : "text-muted-foreground"}>
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {deletingCompany?.companyName}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isDeleteLoading}
                className={isFigma
                  ? "border-[#3a3a3a] bg-transparent text-[#e5e7eb] hover:bg-white/5"
                  : resolvedTheme === "color"
                  ? "bg-black text-white border-black hover:bg-black/80"
                  : resolvedTheme === "dark"
                    ? "border-[#3a3a3a] bg-[#1f1f1f] text-[#ececf4] hover:bg-[#2a2a2a]"
                    : ""}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isDeleteLoading}
              >
                {isDeleteLoading ? "Deleting..." : "Delete Company"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      <DeleteLeadsDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        leads={companies
          .filter((c) => selectedCompanyIds.includes(c._id))
          .map((c) => ({ id: c._id, name: c.companyName }))}
        totalCount={selectedCompanyIds.length}
        title={
          selectedCompanyIds.length === 1
            ? "Delete Company (1)"
            : `Delete Companies (${selectedCompanyIds.length})`
        }
        description="This action is permanent. The selected companies will be deleted and cannot be recovered."
        selectedLabel="Selected companies"
        onConfirm={confirmBulkDelete}
        isDeleting={isBulkDeleting}
      />

      {/* Edit Company Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className={`max-w-2xl ${
          isFigma
            ? "bg-[#0f0f0f] border-[#2a2d3a] text-white"
            : resolvedTheme === "color"
          ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
          : resolvedTheme === "dark"
            ? "bg-[#14141b] border-[#3a3a3a] text-[#e5e5e5]"
            : ""
          }`}>
          <DialogHeader>
            <DialogTitle className={
              isFigma ? "text-white" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#f3f4f6]" : ""
            }>
              Edit Company
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-company-name" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                  Company Name <span className={resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}>*</span>
                </Label>
                <Input
                  id="edit-company-name"
                  value={editForm.companyName}
                  onChange={(e) => {
                    setEditForm({ ...editForm, companyName: e.target.value });
                    if (editCompanyNameError) setEditCompanyNameError("");
                  }}
                  className={`${editCompanyNameError
                    ? resolvedTheme === "color" ? "border-[rgba(255,100,100,0.5)]" : "border-red-500"
                    : ""
                    } ${isFigma
                      ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] placeholder:text-[#5a5a5a] focus-visible:ring-0"
                      : resolvedTheme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                      : resolvedTheme === "dark"
                        ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] placeholder:text-[#8f93a8] focus-visible:border-[#8b7aff]"
                        : ""
                    }`}
                  style={{ boxShadow: 'none' }}
                />
                {editCompanyNameError && (
                  <p className={`text-sm ${resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}`}>
                    {editCompanyNameError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-industry" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                  Industry <span className={resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}>*</span>
                </Label>
                <Select
                  value={editForm.industry || undefined}
                  onValueChange={(value) => {
                    if (value === "Other") {
                      openCustomIndustryDialog("edit");
                    } else {
                      setEditForm({ ...editForm, industry: value });
                      if (editIndustryError) setEditIndustryError("");
                    }
                  }}
                >
                  <SelectTrigger className={`${editIndustryError
                    ? resolvedTheme === "color" ? "border-[rgba(255,100,100,0.5)]" : "border-red-500"
                    : ""
                    } ${isFigma
                      ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] data-[placeholder]:text-[#5a5a5a] focus:ring-0"
                      : resolvedTheme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus:border-[rgba(0,255,255,0.3)]"
                      : resolvedTheme === "dark"
                        ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] data-[placeholder]:text-[#8f93a8] focus:border-[#8b7aff]"
                        : ""
                    }`}>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent className={resolvedTheme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : resolvedTheme === "dark" ? "bg-[#16161f] border-[#3a3a3a] text-[#ececf4]" : ""}>
                    {industryOptions.map((industry) => (
                      <SelectItem
                        key={industry}
                        value={industry}
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editIndustryError && (
                  <p className={`text-sm ${resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}`}>
                    {editIndustryError}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-website" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                Website
              </Label>
              <Input
                id="edit-website"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                className={`${isFigma
                  ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] placeholder:text-[#5a5a5a] focus-visible:ring-0"
                  : resolvedTheme === "color"
                  ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                  : resolvedTheme === "dark"
                    ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] placeholder:text-[#8f93a8] focus-visible:border-[#8b7aff]"
                    : ""
                  }`}
                style={{ boxShadow: 'none' }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                Address
              </Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className={`${isFigma
                  ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] placeholder:text-[#5a5a5a] focus-visible:ring-0"
                  : resolvedTheme === "color"
                  ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                  : resolvedTheme === "dark"
                    ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] placeholder:text-[#8f93a8] focus-visible:border-[#8b7aff]"
                    : ""
                  }`}
                style={{ boxShadow: 'none' }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-country" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                  Country <span className={resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}>*</span>
                </Label>
                <Select
                  value={selectedCountry?.isoCode || ""}
                  onValueChange={(countryCode) => {
                    const country = countries.find(c => c.isoCode === countryCode);
                    setSelectedCountry(country || null);
                    resetStates();
                    resetCities();
                    if (country) {
                      loadStates(country.isoCode);
                      setEditForm({ ...editForm, country: country.name });
                    }
                    if (editCountryError) setEditCountryError("");
                  }}
                >
                  <SelectTrigger className={`${editCountryError
                    ? resolvedTheme === "color" ? "border-[rgba(255,100,100,0.5)]" : "border-red-500"
                    : ""
                    } ${isFigma
                      ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] data-[placeholder]:text-[#5a5a5a] focus:ring-0"
                      : resolvedTheme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus:border-[rgba(0,255,255,0.3)]"
                      : resolvedTheme === "dark"
                        ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] data-[placeholder]:text-[#8f93a8] focus:border-[#8b7aff]"
                        : ""
                    }`}>
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>
                  <SelectContent className={resolvedTheme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : resolvedTheme === "dark" ? "bg-[#16161f] border-[#3a3a3a] text-[#ececf4]" : ""}>
                    {countries.map((country) => (
                      <SelectItem
                        key={country.isoCode}
                        value={country.isoCode}
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editCountryError && (
                  <p className={`text-sm ${resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}`}>
                    {editCountryError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-state" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                  State <span className={resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}>*</span>
                </Label>
                <Select
                  value={selectedState?.isoCode || ""}
                  onValueChange={(stateCode) => {
                    const state = states.find(s => s.isoCode === stateCode);
                    setSelectedState(state || null);
                    resetCities();
                    if (state && selectedCountry) {
                      loadCities(selectedCountry.isoCode, state.isoCode);
                      setEditForm({ ...editForm, state: state.name });
                    }
                    if (editStateError) setEditStateError("");
                  }}
                  disabled={!selectedCountry || states.length === 0}
                >
                  <SelectTrigger className={`${editStateError
                    ? resolvedTheme === "color" ? "border-[rgba(255,100,100,0.5)]" : "border-red-500"
                    : ""
                    } ${isFigma
                      ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] data-[placeholder]:text-[#5a5a5a] focus:ring-0"
                      : resolvedTheme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus:border-[rgba(0,255,255,0.3)]"
                      : resolvedTheme === "dark"
                        ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] data-[placeholder]:text-[#8f93a8] focus:border-[#8b7aff]"
                        : ""
                    }`}>
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent className={resolvedTheme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : resolvedTheme === "dark" ? "bg-[#16161f] border-[#3a3a3a] text-[#ececf4]" : ""}>
                    {states.map((state) => (
                      <SelectItem
                        key={state.isoCode}
                        value={state.isoCode}
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editStateError && (
                  <p className={`text-sm ${resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}`}>
                    {editStateError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-city" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                  City <span className={resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}>*</span>
                </Label>
                <Select
                  value={selectedCity?.name || ""}
                  onValueChange={(cityName) => {
                    const city = cities.find(c => c.name === cityName);
                    setSelectedCity(city || null);
                    if (city) {
                      setEditForm({ ...editForm, city: city.name });
                    }
                    if (editCityError) setEditCityError("");
                  }}
                  disabled={!selectedState || cities.length === 0}
                >
                  <SelectTrigger className={`${editCityError
                    ? resolvedTheme === "color" ? "border-[rgba(255,100,100,0.5)]" : "border-red-500"
                    : ""
                    } ${isFigma
                      ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] data-[placeholder]:text-[#5a5a5a] focus:ring-0"
                      : resolvedTheme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus:border-[rgba(0,255,255,0.3)]"
                      : resolvedTheme === "dark"
                        ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] data-[placeholder]:text-[#8f93a8] focus:border-[#8b7aff]"
                        : ""
                    }`}>
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>
                  <SelectContent className={resolvedTheme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : resolvedTheme === "dark" ? "bg-[#16161f] border-[#3a3a3a] text-[#ececf4]" : ""}>
                    {cities.map((city) => (
                      <SelectItem
                        key={city.name}
                        value={city.name}
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editCityError && (
                  <p className={`text-sm ${resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}`}>
                    {editCityError}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-pin-code" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                Pin Code <span className={resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}>*</span>
              </Label>
              <Input
                id="edit-pin-code"
                value={editForm.pinCode}
                onChange={(e) => {
                  setEditForm({ ...editForm, pinCode: e.target.value });
                  if (editPinCodeError) setEditPinCodeError("");
                }}
                className={`${editPinCodeError
                  ? resolvedTheme === "color" ? "border-[rgba(255,100,100,0.5)]" : "border-red-500"
                  : ""
                  } ${isFigma
                    ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] placeholder:text-[#5a5a5a] focus-visible:ring-0"
                    : resolvedTheme === "color"
                    ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                    : resolvedTheme === "dark"
                      ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] placeholder:text-[#8f93a8] focus-visible:border-[#8b7aff]"
                      : ""
                  }`}
                style={{ boxShadow: 'none' }}
              />
              {editPinCodeError && (
                <p className={`text-sm ${resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}`}>
                  {editPinCodeError}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-size" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                  Company Size
                </Label>
                <Select
                  value={editForm.size}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, size: value })
                  }
                >
                  <SelectTrigger className={`${isFigma
                    ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] data-[placeholder]:text-[#5a5a5a] focus:ring-0"
                    : resolvedTheme === "color"
                    ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus:border-[rgba(0,255,255,0.3)]"
                    : resolvedTheme === "dark"
                      ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] data-[placeholder]:text-[#8f93a8] focus:border-[#8b7aff]"
                      : ""
                    }`}>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent className={resolvedTheme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : resolvedTheme === "dark" ? "bg-[#16161f] border-[#3a3a3a] text-[#ececf4]" : ""}>
                    <SelectItem
                      value="1-10"
                      className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                    >
                      1-10
                    </SelectItem>
                    <SelectItem
                      value="10-50"
                      className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                    >
                      10-50
                    </SelectItem>
                    <SelectItem
                      value="50-100"
                      className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                    >
                      50-100
                    </SelectItem>
                    <SelectItem
                      value="100-500"
                      className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                    >
                      100-500
                    </SelectItem>
                    <SelectItem
                      value="500-1000"
                      className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                    >
                      500-1000
                    </SelectItem>
                    <SelectItem
                      value="1000+"
                      className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                    >
                      1000+
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-revenue" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                  Revenue
                </Label>
                <Input
                  id="edit-revenue"
                  type="text"
                  placeholder="Enter revenue"
                  value={editForm.revenue}
                  onChange={(e) =>
                    setEditForm({ ...editForm, revenue: e.target.value })
                  }
                  className={`${isFigma
                    ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] placeholder:text-[#5a5a5a] focus-visible:ring-0"
                    : resolvedTheme === "color"
                    ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                    : resolvedTheme === "dark"
                      ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] placeholder:text-[#8f93a8] focus-visible:border-[#8b7aff]"
                      : ""
                    }`}
                  style={{ boxShadow: 'none' }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isEditLoading}
                className={isFigma
                  ? "border-[#3a3a3a] bg-transparent text-[#e5e7eb] hover:bg-white/5"
                  : resolvedTheme === "color"
                  ? "bg-black text-white border-black hover:bg-black/80"
                  : resolvedTheme === "dark"
                    ? "border-[#3a3a3a] bg-[#1f1f1f] text-[#ececf4] hover:bg-[#2a2a2a]"
                    : ""}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={isEditLoading}
                className={
                  isFigma
                    ? "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)]"
                    : resolvedTheme === "color"
                    ? "bg-[#0ff] text-[#0a0e27] hover:bg-[#0dd]"
                    : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                }
              >
                {isEditLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Company Leads Dialog */}
      <Dialog open={isViewLeadsOpen} onOpenChange={setIsViewLeadsOpen}>
        <DialogContent
          className={
            isFigma
              ? "sm:max-w-[720px] max-h-[80vh] overflow-y-auto rounded-[20px] border-[#2a2d3a] bg-[#0f0f0f] text-white gap-0"
              : resolvedTheme === "color"
                ? "sm:max-w-[720px] max-h-[80vh] overflow-y-auto bg-[#0A0A1E] border-[rgba(0,255,255,0.2)] text-white"
                : resolvedTheme === "dark"
                  ? "sm:max-w-[720px] max-h-[80vh] overflow-y-auto bg-[#14141b] border-[#3a3a3a] text-[#e5e5e5]"
                  : "sm:max-w-[720px] max-h-[80vh] overflow-y-auto"
          }
        >
          <DialogHeader>
            <DialogTitle
              className={
                isFigma
                  ? "text-white"
                  : resolvedTheme === "color"
                    ? "text-[rgba(0,255,255,0.9)]"
                    : resolvedTheme === "dark"
                      ? "text-[#f3f4f6]"
                      : undefined
              }
            >
              Leads - {viewingCompanyName}
            </DialogTitle>
            <DialogDescription
              className={
                isFigma
                  ? "text-[#9a9a9a]"
                  : resolvedTheme === "color"
                    ? "text-[rgba(0,255,255,0.7)]"
                    : resolvedTheme === "dark"
                      ? "text-[#9ca3af]"
                      : undefined
              }
            >
              Click a lead to open full lead details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {viewingCompanyLeads.length === 0 ? (
              <div
                className={`text-sm py-6 text-center ${
                  isFigma
                    ? "text-[#9a9a9a]"
                    : resolvedTheme === "color"
                      ? "text-[rgba(0,255,255,0.6)]"
                      : "text-muted-foreground"
                }`}
              >
                No leads found for this company.
              </div>
            ) : (
              viewingCompanyLeads.map((lead: any, index: number) => {
                const leadId = lead?._id || lead?.id;
                const stageText =
                  typeof lead?.stage === "string"
                    ? lead.stage
                    : lead?.stage?.name || lead?.stage?.value || "--";
                const valueText =
                  lead?.pricing ?? lead?.negotiatedPricing ?? lead?.estimatedValue ?? "--";
                return (
                  <button
                    key={leadId || index}
                    type="button"
                    disabled={!leadId}
                    onClick={() => {
                      if (!leadId) return;
                      setIsViewLeadsOpen(false);
                      if (!openDealsLeadInline(String(leadId))) {
                        router.push(`/deals/leads/${leadId}`);
                      }
                    }}
                    className={
                      isFigma
                        ? "w-full text-left rounded-[12px] border border-[#2a2d3a] bg-[#181818] p-3 hover:bg-[#1e1e1e] disabled:opacity-60 transition-colors"
                        : resolvedTheme === "color"
                          ? "w-full text-left rounded-md border border-[rgba(0,255,255,0.2)] bg-[rgba(20,20,40,0.6)] p-3 hover:bg-[rgba(0,255,255,0.05)] disabled:opacity-60"
                          : resolvedTheme === "dark"
                            ? "w-full text-left rounded-md border border-[#3a3a3a] bg-[#1b1b24] p-3 hover:bg-[#262626] disabled:opacity-60"
                            : "w-full text-left rounded-md border p-3 hover:bg-muted/50 disabled:opacity-60"
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isFigma || resolvedTheme === "color" || resolvedTheme === "dark"
                              ? "text-white"
                              : ""
                          }`}
                        >
                          {getLeadDisplayName(lead)}
                        </p>
                        <p
                          className={`text-xs truncate ${
                            isFigma
                              ? "text-[#9a9a9a]"
                              : resolvedTheme === "color"
                                ? "text-[rgba(0,255,255,0.6)]"
                                : "text-muted-foreground"
                          }`}
                        >
                          Stage: {stageText || "--"} • Value: {valueText}
                        </p>
                      </div>
                      {!leadId && (
                        <span
                          className={`text-xs ${
                            isFigma ? "text-[#9a9a9a]" : "text-muted-foreground"
                          }`}
                        >
                          No lead ID
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Company Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={`sm:max-w-[600px] ${
          isFigma
            ? "bg-[#0f0f0f] border-[#2a2d3a] text-white"
            : resolvedTheme === "color"
          ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
          : resolvedTheme === "dark"
            ? "bg-[#14141b] border-[#3a3a3a] text-[#e5e5e5]"
            : "bg-white border-[#e5e7eb]"
          }`}>
          <DialogHeader>
            <DialogTitle className={
              isFigma ? "text-white" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#f3f4f6]" : ""
            }>
              Add New Company
            </DialogTitle>
            <DialogDescription className={
              isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : ""
            }>
              Add a new company to your CRM database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-company-name" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                    Company Name <span className={resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}>*</span>
                  </Label>
                  <Input
                    id="add-company-name"
                    placeholder="Company name"
                    value={addForm.companyName}
                    onChange={(e) => {
                      setAddForm({ ...addForm, companyName: e.target.value });
                      if (addCompanyNameError) setAddCompanyNameError("");
                    }}
                    className={`${addCompanyNameError
                      ? resolvedTheme === "color" ? "border-[rgba(255,100,100,0.5)]" : "border-red-500"
                      : ""
                      } ${isFigma
                        ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] placeholder:text-[#5a5a5a] focus-visible:ring-0"
                        : resolvedTheme === "color"
                        ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                        : resolvedTheme === "dark"
                          ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] placeholder:text-[#8f93a8] focus-visible:border-[#8b7aff]"
                          : "bg-muted/70 border border-border"
                      } rounded-lg`}
                    style={{ boxShadow: 'none' }}
                  />
                  {addCompanyNameError && (
                    <p className={`text-sm ${resolvedTheme === "color" ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}`}>
                      {addCompanyNameError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-size" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                    Company Size
                  </Label>
                  <Select
                    value={addForm.size}
                    onValueChange={(value) =>
                      setAddForm({ ...addForm, size: value })
                    }
                  >
                    <SelectTrigger className={`${isFigma
                      ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] data-[placeholder]:text-[#5a5a5a] focus:ring-0"
                      : resolvedTheme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus:border-[rgba(0,255,255,0.3)]"
                      : resolvedTheme === "dark"
                        ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] data-[placeholder]:text-[#8f93a8] focus:border-[#8b7aff]"
                        : "bg-muted/70 border border-border"
                      } rounded-lg shadow-none`}>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent className={resolvedTheme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : resolvedTheme === "dark" ? "bg-[#16161f] border-[#3a3a3a] text-[#ececf4]" : ""}>
                      <SelectItem
                        value="1-10"
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        1-10
                      </SelectItem>
                      <SelectItem
                        value="10-50"
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        10-50
                      </SelectItem>
                      <SelectItem
                        value="50-100"
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        50-100
                      </SelectItem>
                      <SelectItem
                        value="100-500"
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        100-500
                      </SelectItem>
                      <SelectItem
                        value="500-1000"
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        500-1000
                      </SelectItem>
                      <SelectItem
                        value="1000+"
                        className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                      >
                        1000+
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-revenue" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                    Revenue
                  </Label>
                  <Input
                    id="add-revenue"
                    type="text"
                    placeholder="Enter revenue"
                    value={addForm.revenue}
                    onChange={(e) =>
                      setAddForm({ ...addForm, revenue: e.target.value })
                    }
                    className={`${isFigma
                      ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] placeholder:text-[#5a5a5a] focus-visible:ring-0"
                      : resolvedTheme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                      : resolvedTheme === "dark"
                        ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] placeholder:text-[#8f93a8] focus-visible:border-[#8b7aff]"
                        : "bg-muted/70 border border-border"
                      } rounded-lg`}
                    style={{ boxShadow: 'none' }}
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-industry" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                    Industry
                  </Label>
                  <Select
                    value={addForm.industry}
                    onValueChange={(value) => {
                      if (value === "Other") {
                        openCustomIndustryDialog("add");
                      } else {
                        setAddForm({ ...addForm, industry: value });
                      }
                    }}
                  >
                    <SelectTrigger className={`${isFigma
                      ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] data-[placeholder]:text-[#5a5a5a] focus:ring-0"
                      : resolvedTheme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus:border-[rgba(0,255,255,0.3)]"
                      : resolvedTheme === "dark"
                        ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] data-[placeholder]:text-[#8f93a8] focus:border-[#8b7aff]"
                        : "bg-muted/70 border border-border"
                      } rounded-lg shadow-none`}>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent className={resolvedTheme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : resolvedTheme === "dark" ? "bg-[#16161f] border-[#3a3a3a] text-[#ececf4]" : ""}>
                      {industryOptions.map((industry) => (
                        <SelectItem
                          key={industry}
                          value={industry}
                          className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : resolvedTheme === "dark" ? "text-[#ececf4] focus:bg-[#242432]" : ""}
                        >
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-website" className={isFigma ? "text-[#9a9a9a]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : ""}>
                    Website
                  </Label>
                  <Input
                    id="add-website"
                    type="url"
                    placeholder="www.company.com"
                    value={addForm.website}
                    onChange={(e) =>
                      setAddForm({ ...addForm, website: e.target.value })
                    }
                    className={`${isFigma
                      ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#efefef] placeholder:text-[#5a5a5a] focus-visible:ring-0"
                      : resolvedTheme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                      : resolvedTheme === "dark"
                        ? "bg-[#1b1b24] border-[#3a3a3a] text-[#ececf4] placeholder:text-[#8f93a8] focus-visible:border-[#8b7aff]"
                        : "bg-muted/70 border border-border"
                      } rounded-lg`}
                    style={{ boxShadow: 'none' }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  setAddForm({
                    companyName: "",
                    industry: "",
                    website: "",
                    size: "",
                    revenue: "",
                  });
                  setAddCompanyNameError("");
                }}
                disabled={isAddLoading}
                className={isFigma
                  ? "border-[#3a3a3a] bg-transparent text-[#e5e7eb] hover:bg-white/5"
                  : resolvedTheme === "color"
                  ? "bg-black text-white border-black hover:bg-black/80"
                  : resolvedTheme === "dark"
                    ? "border-[#3a3a3a] bg-[#1f1f1f] text-[#ececf4] hover:bg-[#2a2a2a]"
                    : ""}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCompany}
                disabled={isAddLoading}
                className={
                  isFigma
                    ? "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)]"
                    : resolvedTheme === "color"
                    ? "bg-[#0ff] text-[#0a0e27] hover:bg-[#0dd]"
                    : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                }
              >
                {isAddLoading ? "Adding..." : "Add Company"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Industry Dialog */}
      <Dialog
        open={isCustomIndustryDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseCustomIndustryDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Custom Industry</DialogTitle>
            <DialogDescription>
              Enter the industry name to add it to the list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="custom-industry-input">Industry</Label>
              <Input
                id="custom-industry-input"
                value={customIndustryInput}
                onChange={(e) => {
                  setCustomIndustryInput(e.target.value);
                  if (customIndustryError) setCustomIndustryError("");
                }}
                placeholder="Enter industry"
                className={customIndustryError ? "border-red-500" : ""}
              />
              {customIndustryError && (
                <p className="text-sm text-red-500">{customIndustryError}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleCloseCustomIndustryDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleCustomIndustrySubmit}
              className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
            >
              Save Industry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BulkUploadCompaniesFlow
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        onUploadComplete={() => fetchCompanies(currentPageRef.current)}
      />

      {/* Filters Dialog */}
      {isFigma ? (
        <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
          <DialogContent
            showCloseButton={false}
            className="!max-w-[min(494px,calc(100vw-2rem))] w-full p-0 rounded-[12px] border border-[#334155] bg-[#2e2e2e] shadow-[0px_24px_48px_0px_rgba(0,0,0,0.5)] gap-0 overflow-hidden"
          >
            <div className="flex w-full min-w-0 overflow-hidden h-[280px]">
              <div className="flex w-[210px] shrink-0 flex-col border-r border-[#2e2e48]">
                <div className="px-4 pb-3 pt-5 flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-white">Filters</h3>
                  <button type="button" onClick={() => setIsFilterDialogOpen(false)} className="text-[#94a3b8] hover:text-white" aria-label="Close">
                    <X className="size-4" />
                  </button>
                </div>
                {([
                  { id: "industry" as const, label: "Industry" },
                  { id: "owner" as const, label: "Owner" },
                ]).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveFilterCategory(cat.id)}
                    className={`flex h-10 w-full items-center justify-between pl-4 pr-3 text-left ${
                      activeFilterCategory === cat.id ? "bg-[#181818]" : "hover:bg-[#181818]/60"
                    }`}
                  >
                    <span className="text-[12px] font-semibold text-white">{cat.label}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-white" />
                  </button>
                ))}
              </div>
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-5 gap-4">
                <h4 className="text-[14px] font-bold text-white">
                  {activeFilterCategory === "industry" ? "Industry" : "Owner"}
                </h4>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                  {activeFilterCategory === "industry" ? (
                    <>
                      <button type="button" onClick={() => handleToggleFilterIndustry("all")} className="flex w-full min-w-0 items-center gap-3 rounded-[4px] px-1 py-2.5 text-left hover:bg-white/5">
                        <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border ${filterSelectedIndustries.includes("all") ? "border-brand bg-brand" : "border-[#334155] bg-white/10"}`}>
                          {filterSelectedIndustries.includes("all") ? <span className="text-[10px] font-bold text-brand-foreground">✓</span> : null}
                        </span>
                        <span className="truncate text-[14px] text-white">All Industries</span>
                      </button>
                      {availableFilterIndustries.map((industry) => {
                        const checked = filterSelectedIndustries.includes(industry);
                        return (
                          <button key={industry} type="button" onClick={() => handleToggleFilterIndustry(industry)} className="flex w-full min-w-0 items-center gap-3 rounded-[4px] px-1 py-2.5 text-left hover:bg-white/5">
                            <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border ${checked ? "border-brand bg-brand" : "border-[#334155] bg-white/10"}`}>
                              {checked ? <span className="text-[10px] font-bold text-brand-foreground">✓</span> : null}
                            </span>
                            <span className="truncate text-[14px] text-white">{industry}</span>
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => handleToggleFilterOwner("all")} className="flex w-full min-w-0 items-center gap-3 rounded-[4px] px-1 py-2.5 text-left hover:bg-white/5">
                        <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border ${filterSelectedOwners.includes("all") ? "border-brand bg-brand" : "border-[#334155] bg-white/10"}`}>
                          {filterSelectedOwners.includes("all") ? <span className="text-[10px] font-bold text-brand-foreground">✓</span> : null}
                        </span>
                        <span className="truncate text-[14px] text-white">All Owners</span>
                      </button>
                      {ownerFilterOptions.map((owner) => {
                        const checked = filterSelectedOwners.includes(owner.id);
                        return (
                          <button key={owner.id} type="button" onClick={() => handleToggleFilterOwner(owner.id)} className="flex w-full min-w-0 items-center gap-3 rounded-[4px] px-1 py-2.5 text-left hover:bg-white/5">
                            <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border ${checked ? "border-brand bg-brand" : "border-[#334155] bg-white/10"}`}>
                              {checked ? <span className="text-[10px] font-bold text-brand-foreground">✓</span> : null}
                            </span>
                            <span className="truncate text-[14px] text-white">{owner.name}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
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
                  onClick={() => {
                    setFilterSelectedIndustries(["all"]);
                    setFilterSelectedOwners(["all"]);
                    setSelectedIndustryFilter("all");
                    setSelectedOwnerFilter("all");
                    setIsFilterDialogOpen(false);
                  }}
                  className="h-[35px] rounded-[6px] border-[#334155] bg-transparent px-3 text-[13px] font-semibold text-white shadow-none hover:bg-white/5"
                >
                  Reset Filter
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyFilters}
                  className="h-[35px] rounded-[6px] bg-brand px-4 text-[13px] font-bold text-brand-foreground shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)]"
                >
                  Apply Filter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className={
          isFigma
            ? "sm:max-w-[286.667px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#0f0f0f] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            : resolvedTheme === "color"
            ? "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[rgba(0,255,255,0.2)] bg-[rgba(20,20,40,0.85)] backdrop-blur-md shadow-[0_8px_30px_rgba(0,255,255,0.15)]"
            : resolvedTheme === "dark"
              ? "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[#3a3a3a] bg-[#020617] shadow-[0_8px_30px_rgba(0,0,0,0.5)] dark"
              : "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[#e5e7eb] bg-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
        }>
          <div className={resolvedTheme === "dark" || isFigma ? "dark" : ""}>
          {/* Header */}
          <div className={`border-b-[0.667px] h-[52.667px] px-4 py-4 flex items-center ${isFigma ? "border-[#2a2d3a]" : "border-[#e5e7eb] dark:border-[#3a3a3a]"}`}>
            <h3 className={`font-['Arial',sans-serif] font-bold text-[14px] leading-[20px] ${isFigma ? "text-white" : "text-[#1f1f1f] dark:text-[#e5e7eb]"}`}>
              Filters
            </h3>
          </div>

          {/* Content */}
          <div className={`flex flex-col gap-4 p-4 max-h-[472px] overflow-y-auto ${isFigma ? "text-[#e5e7eb]" : "text-[#1f1f1f] dark:text-[#e5e7eb]"}`}>
            {/* Industry Section */}
            <div className="flex flex-col gap-2">
              <label className={`font-['Arial',sans-serif] font-bold text-[12px] leading-[16px] ${isFigma ? "text-[#9a9a9a]" : "text-[#1f1f1f] dark:text-[#e5e7eb]"}`}>
                Industry
              </label>
              <div className="flex flex-col gap-1">
                {/* All Industries */}
                <div
                  onClick={() => handleToggleFilterIndustry("all")}
                  className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${filterSelectedIndustries.includes("all")
                    ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                    : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                    }`}
                >
                  <div
                    className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${filterSelectedIndustries.includes("all")
                      ? "bg-[#7b68ee] border-[#7b68ee]"
                      : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                      }`}
                  >
                    {filterSelectedIndustries.includes("all") && (
                      <span className="text-white text-[10px] font-bold leading-[13.333px]">✓</span>
                    )}
                  </div>
                  <span
                    className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${filterSelectedIndustries.includes("all")
                      ? "font-bold text-[#7b68ee]"
                      : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                      }`}
                  >
                    All Industries
                  </span>
                </div>

                {/* Individual Industries */}
                {availableFilterIndustries.map((industry) => (
                  <div
                    key={industry}
                    onClick={() => handleToggleFilterIndustry(industry)}
                    className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${filterSelectedIndustries.includes(industry)
                      ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                      : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                      }`}
                  >
                  <div
                    className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${filterSelectedIndustries.includes(industry)
                      ? "bg-[#7b68ee] border-[#7b68ee]"
                      : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                      }`}
                    >
                      {filterSelectedIndustries.includes(industry) && (
                        <span className="text-white text-[10px] font-bold leading-[13.333px]">✓</span>
                      )}
                    </div>
                  <span
                    className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${filterSelectedIndustries.includes(industry)
                      ? "font-bold text-[#7b68ee]"
                      : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                      }`}
                    >
                      {industry}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Owner Section */}
            <div className="flex flex-col gap-2">
              <label className={`font-['Arial',sans-serif] font-bold text-[12px] leading-[16px] ${isFigma ? "text-[#9a9a9a]" : "text-[#1f1f1f] dark:text-[#e5e7eb]"}`}>
                Owner
              </label>
              <div className="flex flex-col gap-1">
                {/* All Owners */}
                <div
                  onClick={() => handleToggleFilterOwner("all")}
                  className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${filterSelectedOwners.includes("all")
                    ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                    : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                    }`}
                >
                  <div
                    className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${filterSelectedOwners.includes("all")
                      ? "bg-[#7b68ee] border-[#7b68ee]"
                      : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                      }`}
                  >
                    {filterSelectedOwners.includes("all") && (
                      <span className="text-white text-[10px] font-bold leading-[13.333px]">✓</span>
                    )}
                  </div>
                  <span
                    className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${filterSelectedOwners.includes("all")
                      ? "font-bold text-[#7b68ee]"
                      : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                      }`}
                  >
                    All Owners
                  </span>
                </div>

                {/* Individual Owners */}
                {ownerFilterOptions.map((owner) => (
                  <div
                    key={owner.id}
                    onClick={() => handleToggleFilterOwner(owner.id)}
                    className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${filterSelectedOwners.includes(owner.id)
                      ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                      : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                      }`}
                  >
                  <div
                    className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${filterSelectedOwners.includes(owner.id)
                      ? "bg-[#7b68ee] border-[#7b68ee]"
                      : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                      }`}
                    >
                      {filterSelectedOwners.includes(owner.id) && (
                        <span className="text-white text-[10px] font-bold leading-[13.333px]">✓</span>
                      )}
                    </div>
                  <span
                    className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${filterSelectedOwners.includes(owner.id)
                      ? "font-bold text-[#7b68ee]"
                      : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                      }`}
                    >
                      {owner.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`border-t-[0.667px] h-[52.667px] px-3 py-3 flex items-center justify-between ${isFigma ? "border-[#2a2d3a]" : "border-[#e5e7eb] dark:border-[#3a3a3a]"}`}>
            <Button
              variant="outline"
              onClick={() => setIsFilterDialogOpen(false)}
              className={`h-[28px] px-3 rounded-[6px] text-[12px] font-['Arial',sans-serif] font-bold border-0 bg-transparent shadow-none cursor-pointer transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] ${
                isFigma
                  ? "text-[#e5e7eb] hover:bg-white/5"
                  : "text-[#1f1f1f] hover:bg-gray-100 dark:text-[#e5e7eb] dark:hover:bg-[#1f2937]"
              }`}
            >
              Close
            </Button>
            <Button
              onClick={handleApplyFilters}
              className={`h-[28px] px-3 rounded-[6px] text-[12px] font-['Arial',sans-serif] font-bold cursor-pointer transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] ${
                isFigma
                  ? "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)]"
                  : "bg-[#7b68ee] text-white hover:bg-[#6b58dd] hover:shadow-[0_4px_12px_rgba(123,104,238,0.4)]"
              }`}
            >
              Apply Filters
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      <ViewFunnelDialog
        open={isViewFunnelOpen}
        onOpenChange={setIsViewFunnelOpen}
        viewingFunnel={viewingFunnel}
        isLoading={isLoadingFunnelDetails}
      />

      {/* View Company Dialog */}
      <Dialog open={isViewCompanyOpen} onOpenChange={setIsViewCompanyOpen}>
        <DialogContent className={`sm:max-w-[800px] max-h-[90vh] overflow-y-auto ${resolvedTheme === "color"
          ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)] text-white"
          : resolvedTheme === "dark"
            ? "bg-[#14141b] border-[#3a3a3a] text-[#e5e5e5]"
            : "bg-white border-[#e5e7eb]"
          }`}>
          <DialogHeader>
            <DialogTitle className={resolvedTheme === "dark" ? "text-[#f3f4f6]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : ""}>Company Details</DialogTitle>
            <DialogDescription className={resolvedTheme === "dark" ? "text-[#9ca3af]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : ""}>
              View company information
            </DialogDescription>
          </DialogHeader>

          {isLoadingCompanyDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : viewingCompany ? (
            <div className="space-y-6 py-4">
              <div className={`border border-[0.667px] rounded-[12px] p-6 flex flex-col gap-6 ${resolvedTheme === "dark"
                ? "bg-[#262626] border-[#3a3a3a]"
                : resolvedTheme === "color"
                  ? "bg-[rgba(20,20,40,0.6)] border-[rgba(0,255,255,0.2)]"
                  : "bg-white border-[#e5e7eb]"
                }`}>
                <h4 className={`text-[14px] font-bold leading-[20px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                  }`}>Company Information</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-[8px]">
                    <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                      }`}>Company Name</Label>
                    <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                      ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                      : resolvedTheme === "color"
                        ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                        : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                      }`}>
                      {viewingCompany.companyName || "--"}
                    </div>
                  </div>

                  <div className="flex flex-col gap-[8px]">
                    <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                      }`}>Industry</Label>
                    <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                      ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                      : resolvedTheme === "color"
                        ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                        : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                      }`}>
                      {viewingCompany.industry || "--"}
                    </div>
                  </div>

                  {viewingCompany.website && (
                    <div className="flex flex-col gap-[8px]">
                      <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                        }`}>Website</Label>
                      <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                        ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                        : resolvedTheme === "color"
                          ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                          : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                        }`}>
                        {viewingCompany.website}
                      </div>
                    </div>
                  )}

                  {viewingCompany.size && (
                    <div className="flex flex-col gap-[8px]">
                      <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                        }`}>Size</Label>
                      <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                        ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                        : resolvedTheme === "color"
                          ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                          : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                        }`}>
                        {viewingCompany.size}
                      </div>
                    </div>
                  )}

                  {viewingCompany.address && (
                    <div className="flex flex-col gap-[8px] col-span-2">
                      <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                        }`}>Address</Label>
                      <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                        ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                        : resolvedTheme === "color"
                          ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                          : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                        }`}>
                        {viewingCompany.address}
                      </div>
                    </div>
                  )}

                  {viewingCompany.city && (
                    <div className="flex flex-col gap-[8px]">
                      <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                        }`}>City</Label>
                      <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                        ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                        : resolvedTheme === "color"
                          ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                          : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                        }`}>
                        {viewingCompany.city}
                      </div>
                    </div>
                  )}

                  {viewingCompany.state && (
                    <div className="flex flex-col gap-[8px]">
                      <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                        }`}>State</Label>
                      <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                        ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                        : resolvedTheme === "color"
                          ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                          : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                        }`}>
                        {viewingCompany.state}
                      </div>
                    </div>
                  )}

                  {viewingCompany.country && (
                    <div className="flex flex-col gap-[8px]">
                      <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                        }`}>Country</Label>
                      <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                        ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                        : resolvedTheme === "color"
                          ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                          : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                        }`}>
                        {viewingCompany.country}
                      </div>
                    </div>
                  )}

                  {viewingCompany.ownerName && (
                    <div className="flex flex-col gap-[8px]">
                      <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                        }`}>Owner</Label>
                      <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                        ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                        : resolvedTheme === "color"
                          ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                          : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                        }`}>
                        {viewingCompany.ownerName}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No company data available
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewCompanyOpen(false)}
              className={resolvedTheme === "dark"
                ? "border-[#3a3a3a] bg-[#1f1f1f] text-[#ececf4] hover:bg-[#2a2a2a]"
                : resolvedTheme === "color"
                  ? "border-[rgba(0,255,255,0.2)] bg-[rgba(255,255,255,0.03)] text-white hover:bg-[rgba(0,255,255,0.08)]"
                  : ""}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CRMPageLayout>
  );
}
