"use client";

import { Button } from "@/components/ui/button";
import CRMPageLayout from "@/components/crm/CRMPageLayout";
import { ContactsDataTable } from "@/components/deals/contacts/ContactsDataTable";
import type { SortState } from "@/components/ui/data-table/types";
import { DealsPageToolbar, DealsSearchField, dealsToolbarActionBtn } from "@/components/crm/DealsPageToolbar";
import { useTheme } from "next-themes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
// import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Trash2,
  Eye,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Upload,
  Download,
  Building2,
  X,
  Plus,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { useDealsInlineRefresh } from "@/lib/deals-events";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BulkUploadContactsFlow from "@/components/crm/contacts/BulkUploadContactsFlow";
import * as XLSX from "xlsx";

// Define the type for contact data based on the image
interface Contact {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role?: string;
  companyName?: string;
  lastActivity?: string;
  ownerId?: string;
  ownerName?: string;
}

const DEFAULT_ROLE_OPTIONS = [
  "CEO",
  "CTO",
  "VP of Sales",
  "IT Director",
  "Founder",
  "Manager",
  "Director",
  "Executive",
  "Associate",
  "Other",
];

const extractErrorMessage = (error: any, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    return extractErrorMessage(error[0], fallback);
  }
  if (typeof error === "object") {
    return (
      error.message ||
      error.error ||
      error.description ||
      (typeof error.details === "string" ? error.details : null) ||
      (Array.isArray(error.details) ? extractErrorMessage(error.details[0], fallback) : null) ||
      (Array.isArray(error.errors) ? extractErrorMessage(error.errors[0], fallback) : null) ||
      (typeof error.errors === "string" ? error.errors : null) ||
      fallback
    );
  }
  return fallback;
};

const resolveCompanyName = (contact: any): string => {
  return (
    contact?.companyDetails?.companyName ||
    contact?.companyDetails?.name ||
    (contact?.company && (contact.company.name || contact.companyName)) ||
    contact?.companyName ||
    ""
  );
};

const extractContactOwner = (contact: any) => {
  const primaryOwner =
    contact?.owner ||
    (Array.isArray(contact?.owners) && contact.owners.length > 0 ? contact.owners[0] : null);

  const ownerId =
    primaryOwner?._id ||
    primaryOwner?.id ||
    primaryOwner?.userId ||
    contact?.ownerId ||
    contact?.assignedTo ||
    (Array.isArray(contact?.assignedUsers) && contact.assignedUsers.length > 0
      ? contact.assignedUsers[0]?._id ||
      contact.assignedUsers[0]?.id ||
      contact.assignedUsers[0]?.userId
      : "");

  const ownerName =
    (primaryOwner &&
      (primaryOwner.name ||
        `${primaryOwner.firstName || ""} ${primaryOwner.lastName || ""}`.trim())) ||
    contact?.ownerName ||
    "";

  return { ownerId, ownerName };
};

const mapContactFromApi = (contact: any): Contact => {
  const { ownerId, ownerName } = extractContactOwner(contact);
  return {
    _id: contact?._id,
    firstName: contact?.firstName || "",
    lastName: contact?.lastName || "",
    email: contact?.email || "",
    phoneNumber: contact?.phoneNumber || contact?.phone || "",
    role: contact?.role || "",
    companyName: resolveCompanyName(contact),
    lastActivity: contact?.lastActivity || contact?.updatedAt || contact?.createdAt || "",
    ownerId: ownerId || undefined,
    ownerName: ownerName || undefined,
  };
};

export default function ContactsPage() {
  const { theme } = useTheme();
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
  const isFigma = isInlineDealsMode;
  const resolvedTheme =
    theme === "color" ? "color" : theme === "dark" || isInlineDealsMode ? "dark" : "light";
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isExportingContacts, setIsExportingContacts] = useState(false);

  // Add Contact state
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    phone: "",
  });
  const [isAddLoading, setIsAddLoading] = useState(false);
  const [companies, setCompanies] = useState<Array<{ _id: string; name: string }>>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [owners, setOwners] = useState<Array<{ id: string; name: string; email?: string }>>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("all");
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);

  // Filter dialog state
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [filterSelectedOwners, setFilterSelectedOwners] = useState<string[]>(["all"]);

  // View funnel states
  const [isViewFunnelOpen, setIsViewFunnelOpen] = useState(false);
  const [viewingFunnel, setViewingFunnel] = useState<any>(null);
  const [isLoadingFunnelDetails, setIsLoadingFunnelDetails] = useState(false);

  // View contact states
  const [isViewContactOpen, setIsViewContactOpen] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [isLoadingContactDetails, setIsLoadingContactDetails] = useState(false);
  const getSelectedOwnerName = useCallback(() => {
    if (!selectedOwnerId || selectedOwnerId === "all") {
      return "";
    }

    const owner = owners.find((owner) => owner.id === selectedOwnerId);
    return owner?.name?.trim() || "";
  }, [selectedOwnerId, owners]);

  // Add Contact validation error states
  const [addNameError, setAddNameError] = useState("");
  const [addEmailError, setAddEmailError] = useState("");

  // Edit state
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    phone: "",
  });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editCompanies, setEditCompanies] = useState<Array<{ _id: string; name: string }>>([]);
  const [loadingEditCompanies, setLoadingEditCompanies] = useState(false);

  // Edit validation error states
  const [editNameError, setEditNameError] = useState("");
  const [editEmailError, setEditEmailError] = useState("");

  // Delete state
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const hasFetchedInitialContacts = useRef(false);
  const lastAppliedOwnerRef = useRef("");
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [limit, setLimit] = useState(50);

  // Column sort for the BackOffice DataTable — applied to the loaded page, as
  // the contacts API paginates server-side and takes no sort parameter.
  const [contactsSort, setContactsSort] = useState<SortState | null>(null);
  const [roleOptions, setRoleOptions] = useState<string[]>(DEFAULT_ROLE_OPTIONS);
  const [isCustomRoleDialogOpen, setIsCustomRoleDialogOpen] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [customRoleError, setCustomRoleError] = useState("");
  const [pendingRoleTarget, setPendingRoleTarget] = useState<"add" | "edit" | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  const ensureRoleOption = (roleValue: string | undefined | null) => {
    const trimmed = (roleValue || "").trim();
    if (!trimmed) return;
    setRoleOptions((prev) => {
      if (prev.some((opt) => opt.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const withoutOther = prev.filter((opt) => opt.toLowerCase() !== "other");
      return [...withoutOther, trimmed, "Other"];
    });
  };

  const openCustomRoleDialog = (target: "add" | "edit") => {
    setPendingRoleTarget(target);
    setCustomRoleInput("");
    setCustomRoleError("");
    setIsCustomRoleDialogOpen(true);
  };

  const handleCloseCustomRoleDialog = () => {
    setIsCustomRoleDialogOpen(false);
    setCustomRoleInput("");
    setCustomRoleError("");
    setPendingRoleTarget(null);
  };

  const handleCustomRoleSubmit = () => {
    const roleName = customRoleInput.trim();
    if (!roleName) {
      setCustomRoleError("Role is required");
      return;
    }

    const roleNameLower = roleName.toLowerCase();
    const existing = roleOptions.find((opt) => opt.toLowerCase() === roleNameLower);
    const finalRole = existing || roleName;

    if (!existing) {
      setRoleOptions((prev) => {
        const withoutOther = prev.filter((opt) => opt.toLowerCase() !== "other");
        return [...withoutOther, finalRole, "Other"];
      });
    }

    if (pendingRoleTarget === "add") {
      setAddForm((prev) => ({ ...prev, role: finalRole }));
    } else if (pendingRoleTarget === "edit") {
      setEditForm((prev) => ({ ...prev, role: finalRole }));
    }

    handleCloseCustomRoleDialog();
  };

  // Handle view contact
  const handleViewContact = async (contactId: string) => {
    if (!contactId) return;

    setIsLoadingContactDetails(true);
    setIsViewContactOpen(true);

    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/contacts/${contactId}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const contactData = await response.json();
        setViewingContact(contactData);
      } else {
        toast.error("Failed to load contact details");
        setIsViewContactOpen(false);
      }
    } catch (error) {
      console.error("Error fetching contact details:", error);
      toast.error("Failed to load contact details");
      setIsViewContactOpen(false);
    } finally {
      setIsLoadingContactDetails(false);
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

  const fetchOwners = useCallback(async () => {
    setIsLoadingOwners(true);
    try {
      const response = await authenticatedFetch(buildExternalUrl("crm/contact/owners"), {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch owners: ${response.statusText}`);
      }

      const data = await response.json();
      const rawOwners = Array.isArray(data?.owners)
        ? data.owners
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

      const mappedOwners: Array<{ id: string; name: string; email?: string }> = rawOwners
        .filter((owner: any) => owner && (owner._id || owner.id || owner.userId))
        .map((owner: any) => {
          const id = owner._id || owner.id || owner.userId;
          const nameSource =
            owner.name ||
            `${owner.firstName || ""} ${owner.lastName || ""}`.trim();

          return {
            id,
            name: nameSource || owner.email || "Owner",
            email: owner.email,
          };
        });

      setOwners(mappedOwners);
      setSelectedOwnerId((prev) => {
        if (mappedOwners.length === 0) {
          return "all";
        }

        if (prev && prev !== "all") {
          const stillExists = mappedOwners.some((owner) => owner.id === prev);
          if (stillExists) {
            return prev;
          }
        }

        return "all";
      });
    } catch (error) {
      console.error("Error fetching contact owners:", error);
      setOwners([]);
      setSelectedOwnerId("all");
    } finally {
      setIsLoadingOwners(false);
    }
  }, []);

  // Fetch contacts from API with pagination
  const fetchContacts = useCallback(
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

        const ownerName = getSelectedOwnerName();
        if (ownerName) {
          params.append("ownerName", ownerName);
        }

        const response = await authenticatedFetch(
          buildExternalUrl(`crm/contacts?${params.toString()}`),
          {
            method: "GET",
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch contacts: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Contacts data:", data);

        // Transform API data to match our Contact type
        const transformedContacts: Contact[] = Array.isArray(data.contacts)
          ? data.contacts.map(mapContactFromApi)
          : Array.isArray(data)
            ? data.map(mapContactFromApi)
            : [];

        setContacts(transformedContacts);

        const fetchedRoles = transformedContacts
          .map((contact) => (contact.role || "").trim())
          .filter((role) => role.length > 0);

        if (fetchedRoles.length > 0) {
          setRoleOptions((prev) => {
            const withoutOther = prev.filter((opt) => opt.toLowerCase() !== "other");
            const existingLower = new Set(withoutOther.map((opt) => opt.toLowerCase()));
            const updated = [...withoutOther];
            fetchedRoles.forEach((role) => {
              if (!existingLower.has(role.toLowerCase())) {
                updated.push(role);
                existingLower.add(role.toLowerCase());
              }
            });
            return [...updated, "Other"];
          });
        }

        // Update pagination info from API response
        if (data.total !== undefined) {
          setTotalContacts(data.total);
          setTotalPages(Math.ceil(data.total / pageSize));
        } else if (data.pagination && data.pagination.total !== undefined) {
          setTotalContacts(data.pagination.total);
          setTotalPages(Math.ceil(data.pagination.total / pageSize));
        } else {
          setTotalContacts(transformedContacts.length);
          setTotalPages(1);
        }

        currentPageRef.current = targetPage;
        setCurrentPage(targetPage);
      } catch (err) {
        console.error("Error fetching contacts:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch contacts");
        setContacts([]);
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    },
    [limit, getSelectedOwnerName]
  );

  // Pagination functions
  const handlePageChange = (page: number) => {
    currentPageRef.current = page;
    setCurrentPage(page);
    fetchContacts(page);
  };

  // Search functionality
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching
    currentPageRef.current = 1;

    if (term.trim()) {
      // Use search API when there's a search term
      await searchContacts(term);
    } else {
      // Fetch normal paginated contacts when search is cleared
      await fetchContacts(1);
    }
  };

  // Search contacts using the search API
  const searchContacts = async (searchTerm: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchTerm,
      });
      const ownerName = getSelectedOwnerName();
      if (ownerName) {
        params.append("ownerName", ownerName);
      }

      const response = await authenticatedFetch(buildExternalUrl(`crm/searchcontact?${params.toString()}`), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const searchResults = data.contacts || data || [];

        // Transform API data to match our Contact type
        const transformedContacts: Contact[] = Array.isArray(searchResults)
          ? searchResults.map((contact: any) => mapContactFromApi(contact))
          : [];

        setContacts(transformedContacts);

        const fetchedRoles = transformedContacts
          .map((contact) => (contact.role || "").trim())
          .filter((role) => role.length > 0);

        if (fetchedRoles.length > 0) {
          setRoleOptions((prev) => {
            const withoutOther = prev.filter((opt) => opt.toLowerCase() !== "other");
            const existingLower = new Set(withoutOther.map((opt) => opt.toLowerCase()));
            const updated = [...withoutOther];
            fetchedRoles.forEach((role) => {
              if (!existingLower.has(role.toLowerCase())) {
                updated.push(role);
                existingLower.add(role.toLowerCase());
              }
            });
            return [...updated, "Other"];
          });
        }

        // For search results, we don't have pagination info, so we'll show all results
        setTotalContacts(transformedContacts.length);
        setTotalPages(1);
      } else {
        console.error("Failed to search contacts");
        // Fallback to normal fetch if search fails
        await fetchContacts(1);
      }
    } catch (error) {
      console.error("Error searching contacts:", error);
      // Fallback to normal fetch if search fails
      await fetchContacts(1);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Refresh contacts
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchContacts();
    setRefreshing(false);
  };

  // Fetch companies for Edit Contact form
  useEffect(() => {
    const fetchEditCompanies = async () => {
      try {
        setLoadingEditCompanies(true);
        const response = await authenticatedFetch(buildExternalUrl("crm/companies"), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch companies: ${response.statusText}`);
        }

        const data = await response.json();
        const extracted = Array.isArray(data)
          ? data
          : Array.isArray(data?.companies)
            ? data.companies
            : Array.isArray(data?.data)
              ? data.data
              : [];

        const companiesData: Array<{ _id: string; name: string }> = extracted
          .map((company: any) => ({
            _id: company?._id || company?.id || company?.companyId || "",
            name: company?.companyName || company?.name || "Unnamed Company",
          }))
          .filter((company) => company._id);

        setEditCompanies(companiesData);
        // Preserve existing company selection; leave blank if none is set
      } catch (error) {
        console.error("Error fetching companies:", error);
        setEditCompanies([]);
      } finally {
        setLoadingEditCompanies(false);
      }
    };

    if (isEditOpen) {
      fetchEditCompanies();
    }
  }, [isEditOpen]);

  // Edit form validation functions
  const validateEditName = (name: string): boolean => {
    if (!name.trim()) {
      setEditNameError("Name is required");
      return false;
    }
    setEditNameError("");
    return true;
  };

  const validateEditEmail = (email: string): boolean => {
    if (!email.trim()) {
      setEditEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEditEmailError("Please enter a valid email address");
      return false;
    }
    setEditEmailError("");
    return true;
  };


  // Handle edit contact
  const handleEditClick = (contact: Contact) => {
    setEditingContact(contact);
    // Combine firstName and lastName into full name
    const fullName = `${contact.firstName} ${contact.lastName}`.trim();
    ensureRoleOption(contact.role);
    setEditForm({
      name: fullName,
      email: contact.email,
      company: (contact as any).companyId || "",
      role: contact.role || "",
      phone: contact.phoneNumber,
    });

    // Clear all validation errors
    setEditNameError("");
    setEditEmailError("");

    setIsEditOpen(true);
  };

  // Save edited contact
  const handleEditSave = async () => {
    if (!editingContact) return;

    // Validate required fields
    const isNameValid = validateEditName(editForm.name);
    const isEmailValid = validateEditEmail(editForm.email);

    if (!isNameValid || !isEmailValid) {
      toast.error("Please fill in all required fields correctly");
      return;
    }

    try {
      setIsEditLoading(true);

      // Split name into firstName and lastName
      const nameParts = editForm.name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const contactData: any = {
        firstName,
        lastName,
        email: editForm.email,
        phoneNumber: editForm.phone,
        role: editForm.role || undefined,
        companyId: editForm.company || undefined,
      };

      const response = await authenticatedFetch(buildExternalUrl(`crm/contacts/${editingContact._id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        throw new Error("Failed to update contact");
      }

      const result = await response.json();
      console.log("Contact updated successfully:", result);

      toast.success("Contact updated successfully!");
      setIsEditOpen(false);
      setEditingContact(null);

      // Refresh contacts list
      await fetchContacts();
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Failed to update contact");
    } finally {
      setIsEditLoading(false);
    }
  };

  // Handle delete contact
  const handleDeleteClick = (contact: Contact) => {
    setDeletingContact(contact);
    setIsDeleteOpen(true);
  };

  // Confirm delete contact
  const handleDeleteConfirm = async () => {
    if (!deletingContact) return;

    try {
      setIsDeleteLoading(true);

      const response = await authenticatedFetch(buildExternalUrl(`crm/contacts/${deletingContact._id}`), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete contact");
      }

      console.log("Contact deleted successfully");
      toast.success("Contact deleted successfully!");
      setIsDeleteOpen(false);
      setDeletingContact(null);

      // Refresh contacts list
      await fetchContacts();
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedContactIds.length === 0) {
      setIsBulkDeleteDialogOpen(false);
      return;
    }

    setIsBulkDeleting(true);
    const loadingToast = toast.loading("Deleting selected contacts...");

    try {
      const response = await authenticatedFetch(
        buildExternalUrl("/crm/contacts/bulk-delete"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contactIds: selectedContactIds,
            confirmDelete: true,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to delete contacts";
        try {
          const errorData = await response.json();
          errorMessage = extractErrorMessage(errorData, errorMessage);
        } catch (parseError) {
          const text = await response.text().catch(() => "");
          if (text) {
            errorMessage = text;
          }
        }
        throw new Error(errorMessage);
      }

      await response.json().catch(() => undefined);
      const count = selectedContactIds.length;
      toast.success(`${count} contact${count === 1 ? "" : "s"} deleted successfully.`, {
        id: loadingToast,
      });
      setSelectedContactIds([]);
      setIsBulkDeleteDialogOpen(false);
      await fetchContacts(currentPageRef.current);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to delete contacts. Please try again.";
      toast.error(message, { id: loadingToast });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Filter contacts based on search term
  const normalizedSearch = searchTerm.toLowerCase();
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.firstName.toLowerCase().includes(normalizedSearch) ||
      contact.lastName.toLowerCase().includes(normalizedSearch) ||
      contact.email.toLowerCase().includes(normalizedSearch) ||
      contact.phoneNumber.includes(searchTerm);

    if (selectedOwnerId === "all" || selectedOwnerId === "") {
      return matchesSearch;
    }

    if (contact.ownerId && contact.ownerId === selectedOwnerId) {
      return matchesSearch;
    }

    const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId);
    const ownerNameLower = selectedOwner?.name?.toLowerCase().trim();
    const contactOwnerLower = contact.ownerName?.toLowerCase().trim();

    const matchesOwnerByName =
      ownerNameLower && contactOwnerLower ? contactOwnerLower.includes(ownerNameLower) : false;

    return matchesSearch && matchesOwnerByName;
  });

  useEffect(() => {
    if (selectedContactIds.length === 0) return;
    setSelectedContactIds((prev) => {
      const filtered = prev.filter((id) => contacts.some((contact) => contact._id === id));
      if (filtered.length === prev.length) {
        return prev;
      }
      return filtered;
    });
  }, [contacts, selectedContactIds]);

  const getContactDisplayName = useCallback((contact: Contact | undefined | null) => {
    if (!contact) return "";
    const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
    return fullName || contact.email || contact.phoneNumber || "Unnamed Contact";
  }, []);

  const displayedContactIds = useMemo(
    () =>
      filteredContacts
        .map((contact) => contact?._id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    [filteredContacts]
  );

  const getContactLastActivity = useCallback(
    (contact: Contact) =>
      contact.lastActivity ? new Date(contact.lastActivity).toISOString().slice(0, 10) : "",
    []
  );

  const sortedContacts = useMemo(() => {
    if (!contactsSort) return filteredContacts;
    const direction = contactsSort.order === "asc" ? 1 : -1;

    const keyOf = (contact: Contact): string | number => {
      switch (contactsSort.by) {
        case "name":
          return `${contact.firstName || ""} ${contact.lastName || ""}`.trim().toLowerCase();
        case "role":
          return (contact.role || "").toLowerCase();
        case "email":
          return (contact.email || "").toLowerCase();
        case "phone":
          return (contact.phoneNumber || "").toLowerCase();
        case "company":
          return (contact.companyName || "").toLowerCase();
        case "lastActivity": {
          const time = contact.lastActivity ? new Date(contact.lastActivity).getTime() : NaN;
          // Undated contacts sink to the bottom in both directions rather than
          // scattering through the list on an NaN comparison.
          return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
        }
        default:
          return "";
      }
    };

    return [...filteredContacts].sort((a, b) => {
      const left = keyOf(a);
      const right = keyOf(b);
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [filteredContacts, contactsSort]);

  const selectedContactIdSet = useMemo(
    () => new Set(selectedContactIds),
    [selectedContactIds]
  );

  const renderContactRowActions = (contact: Contact) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-[15px] w-[15px] p-0 text-[#9ca3af] hover:bg-transparent hover:text-[#e5e7eb]"
          aria-label="Contact actions"
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
          onClick={() => handleViewContact(contact._id)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-white hover:bg-white/5"
          onClick={() => handleEditClick(contact)}
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-400 hover:bg-red-500/10"
          onClick={() => handleDeleteClick(contact)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const selectedContacts = useMemo(
    () =>
      selectedContactIds
        .map((id) => contacts.find((contact) => contact._id === id) || null)
        .filter((contact): contact is Contact => Boolean(contact)),
    [selectedContactIds, contacts]
  );

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
    // This matches the current API which supports single owner filter
    const ownerValue = filterSelectedOwners.includes("all") || filterSelectedOwners.length === 0
      ? "all"
      : filterSelectedOwners[0];

    setSelectedOwnerId(ownerValue);
    setIsFilterDialogOpen(false);
    // The useEffect will handle fetching contacts when selectedOwnerId changes
  };

  const selectedContactsPreview = useMemo(() => selectedContacts.slice(0, 5), [selectedContacts]);
  const remainingSelectedContacts =
    selectedContacts.length > selectedContactsPreview.length
      ? selectedContacts.length - selectedContactsPreview.length
      : 0;

  const allDisplayedSelected =
    displayedContactIds.length > 0 && displayedContactIds.every((id) => selectedContactIds.includes(id));
  const partiallySelected =
    !allDisplayedSelected && displayedContactIds.some((id) => selectedContactIds.includes(id));
  const headerCheckboxValue = allDisplayedSelected ? true : partiallySelected ? "indeterminate" : false;
  const hasSelectedContacts = selectedContactIds.length > 0;

  const handleToggleContactSelection = useCallback((contactId: string, shouldSelect: boolean) => {
    setSelectedContactIds((prev) => {
      if (shouldSelect) {
        if (prev.includes(contactId)) return prev;
        return [...prev, contactId];
      }
      return prev.filter((id) => id !== contactId);
    });
  }, []);

  const handleToggleSelectAllDisplayed = useCallback(
    (shouldSelect: boolean) => {
      if (displayedContactIds.length === 0) {
        if (!shouldSelect) {
          setSelectedContactIds([]);
        }
        return;
      }

      setSelectedContactIds((prev) => {
        if (shouldSelect) {
          const merged = new Set([...prev, ...displayedContactIds]);
          return Array.from(merged);
        }
        return prev.filter((id) => !displayedContactIds.includes(id));
      });
    },
    [displayedContactIds]
  );

  const figmaCheckboxClass =
    "h-[14px] w-[14px] rounded-full border-[1.5px] border-[#8c8c9e] data-[state=checked]:bg-[#8c8c9e] data-[state=checked]:text-[#181818]";

  // Fetch companies for Add Contact form
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoadingCompanies(true);
        const response = await authenticatedFetch(buildExternalUrl("crm/companies"), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch companies: ${response.statusText}`);
        }

        const data = await response.json();
        const extracted = Array.isArray(data)
          ? data
          : Array.isArray(data?.companies)
            ? data.companies
            : Array.isArray(data?.data)
              ? data.data
              : [];

        const companiesData: Array<{ _id: string; name: string }> = extracted
          .map((company: any) => ({
            _id: company?._id || company?.id || company?.companyId || "",
            name: company?.companyName || company?.name || "Unnamed Company",
          }))
          .filter((company) => company._id);

        setCompanies(companiesData);

        // Do not auto-select a company; keep user choice blank by default
      } catch (error) {
        console.error("Error fetching companies:", error);
        setCompanies([]);
        if (isAddOpen) {
          setAddForm((prev) => ({
            ...prev,
            company: "",
          }));
        }
      } finally {
        setLoadingCompanies(false);
      }
    };

    if (isAddOpen) {
      fetchCompanies();
    }
  }, [isAddOpen]);

  // Add Contact validation functions
  const validateAddName = (name: string): boolean => {
    if (!name.trim()) {
      setAddNameError("Name is required");
      return false;
    }
    setAddNameError("");
    return true;
  };

  const validateAddEmail = (email: string): boolean => {
    if (!email.trim()) {
      setAddEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAddEmailError("Please enter a valid email address");
      return false;
    }
    setAddEmailError("");
    return true;
  };

  // Handle Add Contact
  const handleAddContact = async () => {
    // Validate required fields
    const isNameValid = validateAddName(addForm.name);
    const isEmailValid = validateAddEmail(addForm.email);

    if (!isNameValid || !isEmailValid) {
      toast.error("Please fill in all required fields correctly");
      return;
    }

    try {
      setIsAddLoading(true);

      // Split name into firstName and lastName
      const nameParts = addForm.name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const contactData: any = {
        firstName,
        lastName,
        email: addForm.email,
        phoneNumber: addForm.phone,
        role: addForm.role || undefined,
        companyId: addForm.company || undefined,
      };

      const response = await authenticatedFetch(buildExternalUrl("crm/contacts"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create contact";
        try {
          const errorData = await response.json();
          errorMessage = extractErrorMessage(errorData, errorMessage);
        } catch (parseError) {
          const text = await response.text().catch(() => "");
          if (text) {
            errorMessage = text;
          }
        }
        throw new Error(errorMessage);
      }

      await response.json().catch(() => undefined);
      toast.success("Contact created successfully!");

      // Reset form - will be set when dialog reopens
      setAddForm({
        name: "",
        email: "",
        company: "",
        role: "",
        phone: "",
      });
      setAddNameError("");
      setAddEmailError("");
      setIsAddOpen(false);

      // Refresh contacts list
      await fetchContacts();
    } catch (error) {
      console.error("Error creating contact:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to create contact. Please try again.";
      toast.error(message);
    } finally {
      setIsAddLoading(false);
    }
  };

  // Fetch contacts on component mount
  useEffect(() => {
    if (hasFetchedInitialContacts.current) return;
    hasFetchedInitialContacts.current = true;
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    const onOpenAdd = () => setIsAddOpen(true);
    window.addEventListener("deals:open-add-contact", onOpenAdd);
    return () => window.removeEventListener("deals:open-add-contact", onOpenAdd);
  }, []);

  // Refetch contacts when owner filter changes
  useEffect(() => {
    if (isLoadingOwners) return;
    const ownerName = getSelectedOwnerName();
    const normalizedOwner = ownerName ? ownerName.toLowerCase() : "";
    const appliedOwner = lastAppliedOwnerRef.current;

    if (selectedOwnerId === "all" && normalizedOwner === "") {
      if (appliedOwner !== "") {
        lastAppliedOwnerRef.current = "";
        fetchContacts(1);
      }
      return;
    }

    if (normalizedOwner === appliedOwner) {
      return;
    }

    lastAppliedOwnerRef.current = normalizedOwner;
    fetchContacts(1);
  }, [selectedOwnerId, isLoadingOwners, getSelectedOwnerName, fetchContacts]);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  useDealsInlineRefresh("contacts", () => {
    fetchContacts(currentPageRef.current);
  });

  const fetchAllContactsForExport = useCallback(async (): Promise<Contact[]> => {
    const ownerName = getSelectedOwnerName();
    const trimmedSearch = searchTerm.trim();
    const pageSize = 2000;

    if (trimmedSearch.length > 0) {
      const params = new URLSearchParams({ q: trimmedSearch });
      if (ownerName) {
        params.append("ownerName", ownerName);
      }

      const response = await authenticatedFetch(
        buildExternalUrl(`crm/searchcontact?${params.toString()}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts for export: ${response.statusText}`);
      }

      const data = await response.json();
      const searchResults = data?.contacts || data || [];

      return Array.isArray(searchResults)
        ? searchResults.map((contact: any) => mapContactFromApi(contact))
        : [];
    }

    let skip = 0;
    let aggregatedContacts: Contact[] = [];
    let total: number | undefined;

    while (true) {
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: pageSize.toString(),
      });

      if (ownerName) {
        params.append("ownerName", ownerName);
      }

      const response = await authenticatedFetch(
        buildExternalUrl(`crm/contacts?${params.toString()}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts for export: ${response.statusText}`);
      }

      const data = await response.json();
      const batch = Array.isArray(data?.contacts)
        ? data.contacts.map((contact: any) => mapContactFromApi(contact))
        : Array.isArray(data)
          ? data.map((contact: any) => mapContactFromApi(contact))
          : [];

      aggregatedContacts = aggregatedContacts.concat(batch);

      if (total === undefined) {
        if (typeof data?.total === "number") {
          total = data.total;
        } else if (typeof data?.pagination?.total === "number") {
          total = data.pagination.total;
        }
      }

      if (batch.length < pageSize) {
        break;
      }

      if (total !== undefined && aggregatedContacts.length >= total) {
        break;
      }

      skip += pageSize;
    }

    return aggregatedContacts;
  }, [getSelectedOwnerName, searchTerm]);

  const handleExportContacts = useCallback(async () => {
    if (isExportingContacts) return;

    setIsExportingContacts(true);
    const loadingToast = toast.loading("Preparing contacts export...");

    try {
      const contactsForExport = await fetchAllContactsForExport();

      if (!contactsForExport || contactsForExport.length === 0) {
        toast.error("No contacts available to export", { id: loadingToast });
        return;
      }

      const headers = [
        "First Name",
        "Last Name",
        "Email",
        "Phone Number",
        "Role",
        "Company",
        "Owner",
        "Last Activity",
      ];

      const rows = contactsForExport.map((contact) => [
        contact.firstName || "",
        contact.lastName || "",
        contact.email || "",
        contact.phoneNumber || "",
        contact.role || "",
        contact.companyName || "",
        contact.ownerName || "",
        contact.lastActivity ? new Date(contact.lastActivity).toLocaleString() : "",
      ]);

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 18 },
        { wch: 28 },
        { wch: 18 },
        { wch: 18 },
        { wch: 24 },
        { wch: 24 },
        { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Contacts_Export_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Contacts exported successfully", { id: loadingToast });
    } catch (error) {
      console.error("Contacts export error:", error);
      toast.error("Failed to export contacts. Please try again.", { id: loadingToast });
    } finally {
      setIsExportingContacts(false);
    }
  }, [fetchAllContactsForExport, isExportingContacts]);

  return (
    <CRMPageLayout fill={isFigma}>
      {isInitialLoad && loading ? (
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading contacts...</p>
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
                      placeholder="Search contacts..."
                      /* !bg-transparent: the inline Deals shell styles bare
                         `input` with a #16161f fill, which outranks a plain
                         bg utility and tinted this field navy. */
                      className="h-[20px] border-0 !bg-transparent p-0 text-[12px] text-[#e5e7eb] placeholder:text-[#9ca3af] focus-visible:ring-0 focus-visible:ring-offset-0"
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-[8px] shrink-0">
                    {hasSelectedContacts && (
                      <Button
                        variant="destructive"
                        className="flex items-center gap-2 h-[32px] px-[12px] py-[6px] rounded-[6px] text-[12px] font-semibold shrink-0"
                        onClick={() => setIsBulkDeleteDialogOpen(true)}
                        disabled={isBulkDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Selected
                        <span className="text-xs font-medium text-white/80">
                          ({selectedContactIds.length})
                        </span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="h-[32px] px-[12px] py-[6px] rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] text-[12px] font-semibold shadow-none hover:bg-[#181818]"
                      onClick={() => {
                        setFilterSelectedOwners(selectedOwnerId === "all" ? ["all"] : [selectedOwnerId]);
                        setIsFilterDialogOpen(true);
                      }}
                    >
                      <img
                        alt=""
                        src="/figma/deals/leads/filter.svg"
                        className="h-[15px] w-[15px] mr-[8px]"
                      />
                      Filters
                      {selectedOwnerId !== "all" && (
                        <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] shadow-none hover:bg-[#181818]"
                      onClick={handleExportContacts}
                      disabled={isExportingContacts}
                      aria-label="Export contacts"
                    >
                      {isExportingContacts ? (
                        <Loader2 className="h-[15px] w-[15px] text-[#e5e7eb] animate-spin" />
                      ) : (
                        <img
                          alt=""
                          src="/figma/deals/leads/export.svg"
                          className="h-[15px] w-[15px]"
                        />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] shadow-none hover:bg-[#181818]"
                      onClick={() => setIsBulkUploadOpen(true)}
                      aria-label="Bulk upload contacts"
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
                      aria-label="Add contact"
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
                  placeholder="Search contacts..."
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
                  onClick={() => {
                    setFilterSelectedOwners(selectedOwnerId === "all" ? ["all"] : [selectedOwnerId]);
                    setIsFilterDialogOpen(true);
                  }}
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
                  onClick={handleExportContacts}
                  disabled={isExportingContacts}
                >
                  {isExportingContacts ? (
                    <Loader2 className="h-4 w-4 sm:mr-[6px] animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 sm:mr-[6px]" />
                  )}
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
                {/* Add Contact Button */}
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
                  <span className="hidden sm:inline">Add Contact</span>
                </Button>
            </>}
          />
          )}

           {/* Contacts Count Section */}
          {!isFigma && (
            <div className={`border-b h-[33px] relative shrink-0 w-full ${
              theme === "color"
                ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)]"
                : "bg-[rgba(244,245,247,0.3)] dark:bg-[rgba(42,42,42,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
              }`}>
              <div className="flex items-center h-full px-3 sm:px-6 py-2">
                <p className={`text-[12px] font-bold leading-[16px] ${
                  theme === "color"
                    ? "text-[rgba(0,255,255,0.9)]"
                    : "text-[#6b7280] dark:text-[#9ca3af]"
                  }`}>
                  {totalContacts} Contact{totalContacts !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className={`mb-4 p-4 rounded-lg mx-6 mt-4 ${theme === "color"
              ? "bg-[rgba(255,0,0,0.1)] border border-[rgba(255,0,0,0.3)]"
              : "bg-red-50 border border-red-200"
              }`}>
              <p className={`text-sm ${theme === "color"
                ? "text-[rgba(255,100,100,0.9)]"
                : "text-red-700"
                }`}>
                {error} - Please check your connection and try refreshing.
              </p>
            </div>
          )}

          {/* Table Section */}
          {isFigma ? (
            <div className="relative flex min-h-0 w-full flex-1 flex-col bg-[#161616]">
              <ContactsDataTable
                rows={sortedContacts}
                loading={loading}
                emptyLabel="No contacts found."
                sort={contactsSort}
                onSortChange={setContactsSort}
                getRowId={(contact) => String(contact?._id || "")}
                onRowClick={(contact) => handleViewContact(contact._id)}
                selectedIds={selectedContactIdSet}
                allSelected={allDisplayedSelected}
                someSelected={partiallySelected}
                onToggleRow={(id) =>
                  handleToggleContactSelection(id, !selectedContactIdSet.has(id))
                }
                onToggleAll={() => handleToggleSelectAllDisplayed(!allDisplayedSelected)}
                getContactName={(contact) =>
                  `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
                }
                getRole={(contact) => contact.role || ""}
                getEmail={(contact) => contact.email || ""}
                getPhone={(contact) => contact.phoneNumber || ""}
                getCompany={(contact) => contact.companyName || ""}
                getLastActivity={getContactLastActivity}
                renderActions={renderContactRowActions}
                footerTotals={[
                  {
                    label: "Contacts",
                    value: totalContacts.toLocaleString(),
                  },
                  ...(selectedContactIds.length > 0
                    ? [
                      {
                        label: "Selected",
                        value: selectedContactIds.length.toLocaleString(),
                      },
                    ]
                    : []),
                ]}
                pagination={{
                  page: currentPage,
                  totalPages: Math.max(1, totalPages),
                  rangeLabel: `${totalContacts === 0 ? 0 : (currentPage - 1) * limit + 1
                    } to ${Math.min(currentPage * limit, totalContacts)}`,
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
                    fetchContacts(1, next);
                  },
                }}
              />
            </div>
          ) : (
          <div className={`flex-1 min-h-0 relative shrink-0 w-full overflow-auto ${theme === "color" ? "bg-[#0A0E27]" : ""}`}>
            {/* Mobile contacts table - horizontally scrollable */}
            <div className="md:hidden overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6">
              <div className="inline-block min-w-full px-3 sm:px-4 md:px-6">
                {loading ? (
                  <div className="py-16 flex flex-col items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading contacts...</p>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground px-3">
                    No contacts found for the selected filters.
                  </div>
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
                              checked={headerCheckboxValue}
                              onCheckedChange={(checked) =>
                                handleToggleSelectAllDisplayed(checked === true)
                              }
                              aria-label="Select all visible contacts"
                              className={figmaCheckboxClass}
                            />
                          </th>
                        )}
                        {["Contact", "Role", "Email", "Phone", "Company", "Last Activity"].map((h) => (
                          <th
                            key={h}
                            className={`font-bold text-left px-3 py-2 ${
                              isFigma
                                ? "text-[10px] leading-[14px] text-[#9ca3af]"
                                : `text-[12px] leading-[16px] ${
                                    theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                                  }`
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                        <th className="w-[52px] px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map((contact) => (
                        <tr
                          key={contact._id}
                          className={`cursor-pointer border-b-[0.667px] ${
                            isFigma
                              ? "bg-[#181818] border-[#2a2d3a] hover:bg-[#1c1c1c]"
                              : theme === "color"
                                ? "border-[rgba(0,255,255,0.2)] hover:bg-[rgba(0,255,255,0.05)]"
                                : "border-[#e5e7eb] dark:border-[#3a3a3a] hover:bg-muted/60"
                          }`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            const isInteractive =
                              target.closest('button') ||
                              target.closest('input') ||
                              target.closest('[role="checkbox"]') ||
                              target.closest('[role="menuitem"]') ||
                              target.closest('[role="button"]');
                            if (!isInteractive) {
                              handleViewContact(contact._id);
                            }
                          }}
                        >
                          {isFigma && (
                            <td
                              className="px-2 py-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={selectedContactIds.includes(contact._id)}
                                onCheckedChange={(checked) =>
                                  handleToggleContactSelection(contact._id, checked === true)
                                }
                                aria-label={`Select ${getContactDisplayName(contact)}`}
                                className={figmaCheckboxClass}
                              />
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {!isFigma && (
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                theme === "color"
                                  ? "bg-[rgba(0,255,255,0.1)]"
                                  : "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.1)]"
                              }`}>
                                <span className={`text-[10px] font-bold ${
                                  theme === "color"
                                    ? "text-[#0ff]"
                                    : "text-[#7b68ee] dark:text-[#8b7aff]"
                                }`}>
                                  {((contact.firstName || "").charAt(0) + (contact.lastName || "").charAt(0)).toUpperCase() || "?"}
                                </span>
                              </div>
                              )}
                              <span className={`font-bold truncate max-w-[160px] ${
                                isFigma
                                  ? "text-[12px] leading-[16px] text-white"
                                  : `text-[14px] leading-[20px] ${
                                      theme === "color"
                                        ? "text-[rgba(0,255,255,0.9)]"
                                        : "text-blue-600 dark:text-blue-400"
                                    }`
                              }`}>
                                {contact.firstName} {contact.lastName}
                              </span>
                            </div>
                          </td>
                          <td className={`px-3 py-2 ${
                            isFigma
                              ? "text-[12px] text-white"
                              : `text-[14px] leading-[20px] ${theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#1f1f1f] dark:text-[#e5e5e5]"}`
                          }`}>{contact.role || "--"}</td>
                          <td className={`px-3 py-2 truncate max-w-[200px] ${
                            isFigma
                              ? "text-[12px] text-white"
                              : `text-[14px] leading-[20px] ${theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#1f1f1f] dark:text-[#e5e5e5]"}`
                          }`}>{contact.email}</td>
                          <td className={`px-3 py-2 ${
                            isFigma
                              ? "text-[12px] text-white"
                              : `text-[14px] leading-[20px] ${theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#1f1f1f] dark:text-[#e5e5e5]"}`
                          }`}>{contact.phoneNumber || "--"}</td>
                          <td className={`px-3 py-2 truncate max-w-[160px] ${
                            isFigma
                              ? "text-[12px] text-white"
                              : `text-[14px] leading-[20px] ${theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#1f1f1f] dark:text-[#e5e5e5]"}`
                          }`}>{contact.companyName || "--"}</td>
                          <td className={`px-3 py-2 ${
                            isFigma
                              ? "text-[12px] text-[#9ca3af]"
                              : `text-[14px] leading-[20px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                          }`}>{contact.lastActivity ? new Date(contact.lastActivity).toISOString().slice(0, 10) : "--"}</td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
                                  aria-label="Contact actions"
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
                              <DropdownMenuContent
                                align="end"
                                className={
                                  isFigma
                                    ? "bg-[#181818] border border-[#2a2d3a] text-white"
                                    : theme === "color"
                                      ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
                                      : ""
                                }
                              >
                                <DropdownMenuItem
                                  onClick={() => handleViewContact(contact._id)}
                                  className={
                                    isFigma
                                      ? "text-white hover:bg-white/5"
                                      : theme === "color"
                                        ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                        : ""
                                  }
                                >
                                  <Eye className="h-4 w-4 mr-2" />View
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleEditClick(contact)}
                                  className={
                                    isFigma
                                      ? "text-white hover:bg-white/5"
                                      : theme === "color"
                                        ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                        : ""
                                  }
                                >
                                  <Pencil className="h-4 w-4 mr-2" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteClick(contact)}
                                  className={
                                    isFigma
                                      ? "text-red-400 hover:bg-red-500/10"
                                      : theme === "color"
                                        ? "text-[rgba(255,100,100,0.9)] hover:bg-[rgba(255,0,0,0.1)]"
                                        : ""
                                  }
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
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
                <Table className="w-full min-w-[900px]">
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
                            checked={headerCheckboxValue}
                            onCheckedChange={(checked) =>
                              handleToggleSelectAllDisplayed(checked === true)
                            }
                            aria-label="Select all visible contacts"
                            className={figmaCheckboxClass}
                          />
                        </TableHead>
                      )}
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Contact</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Role</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Email</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Phone</TableHead>
                      <TableHead className={`font-bold px-3 py-2 ${
                        isFigma
                          ? "text-[10px] leading-[14px] text-[#9ca3af]"
                          : `text-[12px] leading-[16px] ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`
                        }`}>Company</TableHead>
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
                        <TableCell colSpan={isFigma ? 8 : 7} className="py-16">
                          <div className={`flex flex-col items-center justify-center text-sm ${
                            isFigma
                              ? "text-[#9ca3af]"
                              : theme === "color"
                                ? "text-[rgba(0,255,255,0.9)]"
                                : "text-muted-foreground"
                            }`}>
                            <RefreshCw className="h-6 w-6 animate-spin mb-3" />
                            Loading contacts...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredContacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isFigma ? 8 : 7} className={`py-16 text-center ${
                          isFigma
                            ? "text-[#9ca3af]"
                            : theme === "color"
                              ? "text-[rgba(0,255,255,0.9)]"
                              : "text-muted-foreground"
                          }`}>
                          No contacts found for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContacts.map((contact) => (
                        <TableRow key={contact._id} className={`border-b ${
                          isFigma
                            ? "border-[#2a2d3a] bg-[#181818] hover:bg-[#1c1c1c]"
                            : theme === "color"
                              ? "border-[rgba(0,255,255,0.2)] hover:bg-[rgba(0,255,255,0.05)]"
                              : "border-[#e5e7eb] dark:border-[#3a3a3a] hover:bg-muted/30 dark:hover:bg-[rgba(42,42,42,0.5)]"
                          } transition-colors group`}>
                          {isFigma && (
                            <TableCell className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedContactIds.includes(contact._id)}
                                onCheckedChange={(checked) =>
                                  handleToggleContactSelection(contact._id, checked === true)
                                }
                                aria-label={`Select ${getContactDisplayName(contact)}`}
                                className={figmaCheckboxClass}
                              />
                            </TableCell>
                          )}
                          {/* Contact Column */}
                          <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                            <div className="flex items-center gap-2 h-7 min-w-0">
                              {!isFigma && (
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${theme === "color"
                                ? "bg-[rgba(0,255,255,0.1)]"
                                : "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.1)]"
                                }`}>
                                <span className={`text-[10px] font-bold leading-[15px] ${theme === "color"
                                  ? "text-[#0ff]"
                                  : "text-[#7b68ee] dark:text-[#8b7aff]"
                                  }`}>
                                  {((contact.firstName || "").charAt(0) + (contact.lastName || "").charAt(0)).toUpperCase() || "?"}
                                </span>
                              </div>
                              )}
                              <p
                                className={`font-bold cursor-pointer hover:underline truncate ${
                                  isFigma
                                    ? "text-[12px] leading-[16px] text-white"
                                    : `text-[14px] leading-[20px] ${theme === "color"
                                        ? "text-[rgba(0,255,255,0.9)]"
                                        : "text-blue-600 dark:text-blue-400"
                                      }`
                                  }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewContact(contact._id);
                                }}
                              >
                                {contact.firstName} {contact.lastName}
                              </p>
                            </div>
                          </TableCell>
                          {/* Role Column */}
                          <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                            {isFigma ? (
                              <span className="text-[12px] text-white truncate block">{contact.role || "--"}</span>
                            ) : contact.role ? (
                              <div className={`inline-block border rounded-[6px] px-2 py-[2px] ${theme === "color"
                                ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)]"
                                : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(42,42,42,0.5)] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                }`}>
                                <p className={`text-[11px] font-bold leading-[16.5px] ${theme === "color"
                                  ? "text-[rgba(0,255,255,0.9)]"
                                  : "text-[#1f1f1f] dark:text-[#e5e5e5]"
                                  }`}>
                                  {contact.role}
                                </p>
                              </div>
                            ) : (
                              <span className={`text-sm ${theme === "color"
                                ? "text-[rgba(0,255,255,0.6)]"
                                : "text-muted-foreground"
                                }`}>--</span>
                            )}
                          </TableCell>
                          {/* Email Column */}
                          <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                            {isFigma ? (
                              <span className="text-[12px] text-white truncate block">{contact.email}</span>
                            ) : (
                            <div className="flex items-center gap-[6px] h-4">
                              <Mail className={`h-3 w-3 ${theme === "color"
                                ? "text-[#0ff]"
                                : "text-[#7b68ee] dark:text-[#8b7aff]"
                                }`} />
                              <a
                                href={`mailto:${contact.email}`}
                                className={`text-[12px] leading-[16px] hover:underline ${theme === "color"
                                  ? "text-[#0ff]"
                                  : "text-[#7b68ee] dark:text-[#8b7aff]"
                                  }`}
                              >
                                {contact.email}
                              </a>
                            </div>
                            )}
                          </TableCell>
                          {/* Phone Column */}
                          <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                            {isFigma ? (
                              <span className="text-[12px] text-white truncate block">{contact.phoneNumber || "--"}</span>
                            ) : (
                            <div className="flex items-center gap-[6px] h-4">
                              <Phone className={`h-3 w-3 ${theme === "color"
                                ? "text-[rgba(0,255,255,0.9)]"
                                : "text-[#6b7280] dark:text-[#9ca3af]"
                                }`} />
                              <span className={`text-[12px] leading-[16px] ${theme === "color"
                                ? "text-[rgba(0,255,255,0.9)]"
                                : "text-[#6b7280] dark:text-[#9ca3af]"
                                }`}>
                                {contact.phoneNumber || "--"}
                              </span>
                            </div>
                            )}
                          </TableCell>
                          {/* Company Column */}
                          <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                            {isFigma ? (
                              <span className="text-[12px] text-white truncate block">{contact.companyName || "--"}</span>
                            ) : (
                            <div className="flex items-center gap-[6px] h-4">
                              <Building2 className={`h-3 w-3 ${theme === "color"
                                ? "text-[rgba(0,255,255,0.9)]"
                                : "text-[#6b7280] dark:text-[#9ca3af]"
                                }`} />
                              <span className={`text-[12px] leading-[16px] ${theme === "color"
                                ? "text-[rgba(0,255,255,0.9)]"
                                : "text-[#6b7280] dark:text-[#9ca3af]"
                                }`}>
                                {contact.companyName || "--"}
                              </span>
                            </div>
                            )}
                          </TableCell>
                          {/* Last Activity Column */}
                          <TableCell className={isFigma ? "px-2 py-3" : "px-3 py-2"}>
                            <span className={`block truncate whitespace-nowrap ${
                              isFigma
                                ? "text-[12px] text-[#9ca3af]"
                                : `text-[14px] leading-[20px] ${theme === "color"
                                    ? "text-[rgba(0,255,255,0.9)]"
                                    : "text-[#6b7280] dark:text-[#9ca3af]"
                                  }`
                              }`}>
                              {contact.lastActivity ? new Date(contact.lastActivity).toISOString().slice(0, 10) : "--"}
                            </span>
                          </TableCell>
                          {/* Actions Column */}
                          <TableCell className="w-[52px] px-2 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={
                                    isFigma
                                      ? "h-[15px] w-[15px] p-0 text-[#9ca3af] hover:bg-transparent hover:text-[#e5e7eb] opacity-100"
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
                              <DropdownMenuContent
                                align="end"
                                className={
                                  isFigma
                                    ? "bg-[#181818] border border-[#2a2d3a] text-white"
                                    : theme === "color"
                                      ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
                                      : ""
                                }
                              >
                                <DropdownMenuItem
                                  onClick={() => handleViewContact(contact._id)}
                                  className={
                                    isFigma
                                      ? "text-white hover:bg-white/5"
                                      : theme === "color"
                                        ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                        : ""
                                  }
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleEditClick(contact)}
                                  className={
                                    isFigma
                                      ? "text-white hover:bg-white/5"
                                      : theme === "color"
                                        ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                        : ""
                                  }
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteClick(contact)}
                                  className={
                                    isFigma
                                      ? "text-red-400 hover:bg-red-500/10"
                                      : theme === "color"
                                        ? "text-[rgba(255,100,100,0.9)] hover:bg-[rgba(255,0,0,0.1)]"
                                        : ""
                                  }
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Search Results Info */}
            {searchTerm && (
              <div className="flex items-center justify-between mt-6 px-6">
                <div className={`text-sm ${theme === "color"
                  ? "text-[rgba(0,255,255,0.9)]"
                  : "text-muted-foreground"
                  }`}>
                  Found {contacts.length} result{contacts.length !== 1 ? 's' : ''} for &quot;{searchTerm}&quot;
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSearch("")}
                  className={theme === "color"
                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                    : "text-primary hover:text-primary/80"
                  }
                >
                  Clear Search
                </Button>
              </div>
            )}

            {/* Pagination */}
            {!searchTerm && totalPages >= 1 && totalContacts > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 mb-6 pb-16 px-6">
                <div className={`text-sm ${theme === "color"
                  ? "text-[rgba(0,255,255,0.9)]"
                  : "text-muted-foreground"
                  }`}>
                  Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalContacts)} of {totalContacts} contacts
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`flex items-center gap-1 ${theme === "color"
                        ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] disabled:opacity-50"
                        : ""
                        }`}
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
                            className={`w-8 h-8 p-0 ${theme === "color"
                              ? currentPage === pageNum
                                ? "bg-[#0ff] text-[#0a0e27] hover:bg-[#0dd]"
                                : "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                              : currentPage === pageNum
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
                      className={`flex items-center gap-1 ${theme === "color"
                        ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] disabled:opacity-50"
                        : ""
                        }`}
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* Edit Contact Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className={`sm:max-w-[600px] ${
          isFigma
            ? "rounded-[20px] border-[#3a3a3a] bg-[#0f0f0f] text-white"
            : theme === "color"
              ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
              : ""
          }`}>
          <DialogHeader>
            <DialogTitle className={isFigma ? "text-white" : undefined}>Edit Contact</DialogTitle>
            <DialogDescription className={isFigma ? "text-[#9a9a9a]" : undefined}>
              Update contact information in your CRM database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className={isFigma ? "text-[#9a9a9a]" : undefined}>
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    placeholder="Full name"
                    value={editForm.name}
                    onChange={(e) => {
                      setEditForm({ ...editForm, name: e.target.value });
                      if (editNameError) setEditNameError("");
                    }}
                    className={`${editNameError ? "border-red-500" : ""} ${
                      isFigma
                        ? "bg-[#1e1e1e] border-[#3a3a3a] text-white placeholder:text-[#5a5a5a]"
                        : ""
                    }`}
                  />
                  {editNameError && (
                    <p className="text-sm text-red-500">{editNameError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email" className={isFigma ? "text-[#9a9a9a]" : undefined}>
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="email@company.com"
                    value={editForm.email}
                    onChange={(e) => {
                      setEditForm({ ...editForm, email: e.target.value });
                      if (editEmailError) setEditEmailError("");
                    }}
                    className={`${editEmailError ? "border-red-500" : ""} ${
                      isFigma
                        ? "bg-[#1e1e1e] border-[#3a3a3a] text-white placeholder:text-[#5a5a5a]"
                        : ""
                    }`}
                  />
                  {editEmailError && (
                    <p className="text-sm text-red-500">{editEmailError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-company" className={isFigma ? "text-[#9a9a9a]" : undefined}>Company</Label>
                  <Select
                    value={editForm.company}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, company: value })
                    }
                  >
                    <SelectTrigger className={isFigma ? "bg-[#1e1e1e] border-[#3a3a3a] text-white" : undefined}>
                      <SelectValue
                        placeholder={
                          loadingEditCompanies
                            ? "Loading companies..."
                            : "Company name"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className={isFigma ? "bg-[#1e1e1e] border-[#3a3a3a] text-white" : undefined}>
                      {loadingEditCompanies ? (
                        <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                          Loading companies...
                        </div>
                      ) : editCompanies.length > 0 ? (
                        editCompanies.map((company) => (
                          <SelectItem key={company._id} value={company._id}>
                            {company.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                          No companies available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-role" className={isFigma ? "text-[#9a9a9a]" : undefined}>Role</Label>
                  <Select
                    value={editForm.role || undefined}
                    onValueChange={(value) => {
                      if (value === "Other") {
                        openCustomRoleDialog("edit");
                      } else {
                        setEditForm({ ...editForm, role: value });
                      }
                    }}
                  >
                    <SelectTrigger className={isFigma ? "bg-[#1e1e1e] border-[#3a3a3a] text-white" : undefined}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className={isFigma ? "bg-[#1e1e1e] border-[#3a3a3a] text-white" : undefined}>
                      {roleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-phone" className={isFigma ? "text-[#9a9a9a]" : undefined}>Phone</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    placeholder="Phone number"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                    className={isFigma ? "bg-[#1e1e1e] border-[#3a3a3a] text-white placeholder:text-[#5a5a5a]" : undefined}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isEditLoading}
                className={isFigma ? "border-[#3a3a3a] bg-transparent text-[#9a9a9a] hover:bg-white/5 hover:text-white" : undefined}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={isEditLoading}
                className={
                  isFigma
                    ? "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)]"
                    : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                }
              >
                {isEditLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteLeadsDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(open) => {
          if (isBulkDeleting) return;
          setIsBulkDeleteDialogOpen(open);
        }}
        leads={selectedContactsPreview.map((contact) => ({
          id: contact._id,
          name: getContactDisplayName(contact),
        }))}
        totalCount={selectedContactIds.length}
        remainingCount={remainingSelectedContacts}
        title="Delete Contact(s)"
        description="This action cannot be undone. Deleting contacts will remove all associated information."
        selectedLabel="Selected contacts"
        onConfirm={handleConfirmBulkDelete}
        isDeleting={isBulkDeleting}
      />

      <DeleteLeadsDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        leads={
          deletingContact
            ? [{ id: deletingContact._id, name: getContactDisplayName(deletingContact) }]
            : []
        }
        title="Delete Contact(s)"
        description="This action cannot be undone. This will permanently remove this contact."
        selectedLabel="Selected contact"
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleteLoading}
      />

      {/* Add Contact Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={`sm:max-w-[600px] ${
          isFigma
            ? "rounded-[20px] border-[#3a3a3a] bg-[#0f0f0f] text-white"
            : theme === "color"
              ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
              : ""
          }`}>
          <DialogHeader>
            <DialogTitle className={
              isFigma ? "text-white" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : ""
            }>
              Add New Contact
            </DialogTitle>
            <DialogDescription className={
              isFigma ? "text-[#9a9a9a]" : theme === "color" ? "text-[rgba(0,255,255,0.7)]" : ""
            }>
              Add a new contact person to your CRM database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name" className={
                    isFigma ? "text-[#9a9a9a]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : ""
                  }>
                    Name <span className={theme === "color" && !isFigma ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}>*</span>
                  </Label>
                  <Input
                    id="add-name"
                    placeholder="Full name"
                    value={addForm.name}
                    onChange={(e) => {
                      setAddForm({ ...addForm, name: e.target.value });
                      if (addNameError) setAddNameError("");
                    }}
                    className={`${addNameError
                      ? theme === "color" && !isFigma ? "border-[rgba(255,100,100,0.5)]" : "border-red-500"
                      : ""
                      } ${
                      isFigma
                        ? "bg-[#1e1e1e] border-[#3a3a3a] text-white placeholder:text-[#5a5a5a]"
                        : theme === "color"
                          ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                          : ""
                      }`}
                  />
                  {addNameError && (
                    <p className={`text-sm ${theme === "color" && !isFigma ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}`}>
                      {addNameError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-email" className={
                    isFigma ? "text-[#9a9a9a]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : ""
                  }>
                    Email <span className={theme === "color" && !isFigma ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}>*</span>
                  </Label>
                  <Input
                    id="add-email"
                    type="email"
                    placeholder="email@company.com"
                    value={addForm.email}
                    onChange={(e) => {
                      setAddForm({ ...addForm, email: e.target.value });
                      if (addEmailError) setAddEmailError("");
                    }}
                    className={`${addEmailError
                      ? theme === "color" && !isFigma ? "border-[rgba(255,100,100,0.5)]" : "border-red-500"
                      : ""
                      } ${
                      isFigma
                        ? "bg-[#1e1e1e] border-[#3a3a3a] text-white placeholder:text-[#5a5a5a]"
                        : theme === "color"
                          ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                          : ""
                      }`}
                  />
                  {addEmailError && (
                    <p className={`text-sm ${theme === "color" && !isFigma ? "text-[rgba(255,100,100,0.9)]" : "text-red-500"}`}>
                      {addEmailError}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-role" className={
                    isFigma ? "text-[#9a9a9a]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : ""
                  }>
                    Role
                  </Label>
                  <Select
                    value={addForm.role || undefined}
                    onValueChange={(value) => {
                      if (value === "Other") {
                        openCustomRoleDialog("add");
                      } else {
                        setAddForm({ ...addForm, role: value });
                      }
                    }}
                  >
                    <SelectTrigger className={
                      isFigma
                        ? "bg-[#1e1e1e] border-[#3a3a3a] text-white"
                        : theme === "color"
                          ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus:border-[rgba(0,255,255,0.3)]"
                          : ""
                    }>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className={
                      isFigma
                        ? "bg-[#1e1e1e] border-[#3a3a3a] text-white"
                        : theme === "color"
                          ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
                          : ""
                    }>
                      {roleOptions.map((role) => (
                        <SelectItem
                          key={role}
                          value={role}
                          className={theme === "color" && !isFigma ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : ""}
                        >
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-phone" className={
                    isFigma ? "text-[#9a9a9a]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : ""
                  }>
                    Phone
                  </Label>
                  <Input
                    id="add-phone"
                    type="tel"
                    placeholder="Phone number"
                    value={addForm.phone}
                    onChange={(e) =>
                      setAddForm({ ...addForm, phone: e.target.value })
                    }
                    className={
                      isFigma
                        ? "bg-[#1e1e1e] border-[#3a3a3a] text-white placeholder:text-[#5a5a5a]"
                        : theme === "color"
                          ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                          : ""
                    }
                  />
                </div>
              </div>
            </div>

            {/* Company - Full Width */}
            <div className="space-y-2">
              <Label htmlFor="add-company" className={
                isFigma ? "text-[#9a9a9a]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : ""
              }>
                Company
              </Label>
              <Select
                value={addForm.company}
                onValueChange={(value) =>
                  setAddForm({ ...addForm, company: value })
                }
              >
                <SelectTrigger className={
                  isFigma
                    ? "bg-[#1e1e1e] border-[#3a3a3a] text-white"
                    : theme === "color"
                      ? "bg-[rgba(0,255,255,0.05)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus:border-[rgba(0,255,255,0.3)]"
                      : ""
                }>
                  <SelectValue
                    placeholder={
                      loadingCompanies
                        ? "Loading companies..."
                        : "Company name"
                    }
                  />
                </SelectTrigger>
                <SelectContent className={
                  isFigma
                    ? "bg-[#1e1e1e] border-[#3a3a3a] text-white"
                    : theme === "color"
                      ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
                      : ""
                }>
                  {loadingCompanies ? (
                    <div className={`flex items-center justify-center py-2 text-sm ${
                      isFigma ? "text-[#9a9a9a]" : theme === "color" ? "text-[rgba(0,255,255,0.7)]" : "text-muted-foreground"
                      }`}>
                      Loading companies...
                    </div>
                  ) : companies.length > 0 ? (
                    companies.map((company) => (
                      <SelectItem
                        key={company._id}
                        value={company._id}
                        className={theme === "color" && !isFigma ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)] focus:bg-[rgba(0,255,255,0.1)]" : ""}
                      >
                        {company.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className={`flex items-center justify-center py-2 text-sm ${
                      isFigma ? "text-[#9a9a9a]" : theme === "color" ? "text-[rgba(0,255,255,0.7)]" : "text-muted-foreground"
                      }`}>
                      No companies available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  setAddForm({
                    name: "",
                    email: "",
                    company: "",
                    role: "",
                    phone: "",
                  });
                  setAddNameError("");
                  setAddEmailError("");
                }}
                disabled={isAddLoading}
                className={
                  isFigma
                    ? "border-[#3a3a3a] bg-transparent text-[#9a9a9a] hover:bg-white/5 hover:text-white"
                    : theme === "color"
                      ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                      : ""
                }
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddContact}
                disabled={isAddLoading}
                className={
                  isFigma
                    ? "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)]"
                    : theme === "color"
                      ? "bg-[#0ff] text-[#0a0e27] hover:bg-[#0dd]"
                      : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                }
              >
                {isAddLoading ? "Adding..." : "Add Contact"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Role Dialog */}
      <Dialog
        open={isCustomRoleDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseCustomRoleDialog();
          }
        }}
      >
        <DialogContent className={`sm:max-w-[400px] ${theme === "color"
          ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
          : ""
          }`}>
          <DialogHeader>
            <DialogTitle>Add Custom Role</DialogTitle>
            <DialogDescription>
              Enter the role name to add it to the list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="custom-role-input">Role Name</Label>
              <Input
                id="custom-role-input"
                value={customRoleInput}
                onChange={(e) => {
                  setCustomRoleInput(e.target.value);
                  if (customRoleError) setCustomRoleError("");
                }}
                placeholder="Enter role"
                className={customRoleError ? "border-red-500" : ""}
              />
              {customRoleError && (
                <p className="text-sm text-red-500">{customRoleError}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleCloseCustomRoleDialog}>
              Cancel
            </Button>
            <Button onClick={handleCustomRoleSubmit} className="bg-[#7b68ee] text-white hover:bg-[#6b58dd]">
              Save Role
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BulkUploadContactsFlow
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        onUploadComplete={() => fetchContacts(currentPageRef.current)}
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
                  <span className="text-[12px] font-semibold text-white">Owner</span>
                  <ChevronRight className="size-3.5 shrink-0 text-white" />
                </button>
              </div>
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-5 gap-4">
                <h4 className="text-[14px] font-bold text-white">Owner</h4>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => handleToggleFilterOwner("all")}
                    className="flex w-full min-w-0 items-center gap-3 rounded-[4px] px-1 py-2.5 text-left hover:bg-white/5"
                  >
                    <span
                      className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border ${
                        filterSelectedOwners.includes("all")
                          ? "border-brand bg-brand"
                          : "border-[#334155] bg-white/10"
                      }`}
                    >
                      {filterSelectedOwners.includes("all") ? (
                        <span className="text-[10px] font-bold text-black">✓</span>
                      ) : null}
                    </span>
                    <span className="truncate text-[14px] text-white">All Owners</span>
                  </button>
                  {owners.map((owner) => {
                    const checked = filterSelectedOwners.includes(owner.id);
                    return (
                      <button
                        key={owner.id}
                        type="button"
                        onClick={() => handleToggleFilterOwner(owner.id)}
                        className="flex w-full min-w-0 items-center gap-3 rounded-[4px] px-1 py-2.5 text-left hover:bg-white/5"
                      >
                        <span
                          className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border ${
                            checked
                              ? "border-brand bg-brand"
                              : "border-[#334155] bg-white/10"
                          }`}
                        >
                          {checked ? (
                            <span className="text-[10px] font-bold text-black">✓</span>
                          ) : null}
                        </span>
                        <span className="truncate text-[14px] text-white">{owner.name}</span>
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
                  onClick={() => {
                    setFilterSelectedOwners(["all"]);
                    setSelectedOwnerId("all");
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
          resolvedTheme === "color"
              ? "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[rgba(0,255,255,0.2)] bg-[rgba(20,20,40,0.85)] backdrop-blur-md shadow-[0_8px_30px_rgba(0,255,255,0.15)]"
              : resolvedTheme === "dark"
                ? "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[#3a3a3a] bg-[#020617] shadow-[0_8px_30px_rgba(0,0,0,0.5)] dark"
                : "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[#e5e7eb] bg-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
        }>
          <div className={resolvedTheme === "dark" ? "dark" : ""}>
          {/* Header */}
          <div className="border-b-[0.667px] h-[52.667px] px-4 py-4 flex items-center border-[#e5e7eb] dark:border-[#3a3a3a]">
            <h3 className="font-['Arial',sans-serif] font-bold text-[14px] leading-[20px] text-[#1f1f1f] dark:text-[#e5e7eb]">
              Filters
            </h3>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-4 p-4 max-h-[472px] overflow-y-auto text-[#1f1f1f] dark:text-[#e5e7eb]">
            {/* Owner Section */}
            <div className="flex flex-col gap-2">
              <label className="font-['Arial',sans-serif] font-bold text-[12px] leading-[16px] text-[#1f1f1f] dark:text-[#e5e7eb]">
                Owner
              </label>
              <div className="flex flex-col gap-1">
                {/* All Owners */}
                <div
                  onClick={() => handleToggleFilterOwner("all")}
                  className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${
                    filterSelectedOwners.includes("all")
                      ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                      : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                    }`}
                >
                  <div
                    className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${
                      filterSelectedOwners.includes("all")
                        ? "bg-[#7b68ee] border-[#7b68ee]"
                        : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                      }`}
                  >
                    {filterSelectedOwners.includes("all") && (
                      <span className="text-[10px] font-bold leading-[13.333px] text-white">✓</span>
                    )}
                  </div>
                  <span
                    className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${
                      filterSelectedOwners.includes("all")
                        ? "font-bold text-[#7b68ee]"
                        : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                      }`}
                  >
                    All Owners
                  </span>
                </div>

                {/* Individual Owners */}
                {owners.map((owner) => (
                  <div
                    key={owner.id}
                    onClick={() => handleToggleFilterOwner(owner.id)}
                    className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${
                      filterSelectedOwners.includes(owner.id)
                        ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                        : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                      }`}
                  >
                    <div
                      className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${
                        filterSelectedOwners.includes(owner.id)
                          ? "bg-[#7b68ee] border-[#7b68ee]"
                          : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                        }`}
                    >
                      {filterSelectedOwners.includes(owner.id) && (
                        <span className="text-[10px] font-bold leading-[13.333px] text-white">✓</span>
                      )}
                    </div>
                    <span
                    className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${
                      filterSelectedOwners.includes(owner.id)
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
          <div className="border-t-[0.667px] h-[52.667px] px-3 py-3 flex items-center justify-between border-[#e5e7eb] dark:border-[#3a3a3a]">
            <Button
              variant="outline"
              onClick={() => setIsFilterDialogOpen(false)}
              className="h-[28px] px-3 rounded-[6px] text-[12px] font-['Arial',sans-serif] font-bold border-0 bg-transparent shadow-none cursor-pointer transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] text-[#1f1f1f] hover:bg-gray-100 dark:text-[#e5e7eb] dark:hover:bg-[#1f2937]"
            >
              Close
            </Button>
            <Button
              onClick={handleApplyFilters}
              className="h-[28px] px-3 rounded-[6px] text-[12px] font-['Arial',sans-serif] font-bold cursor-pointer transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] bg-[#7b68ee] text-white hover:bg-[#6b58dd] hover:shadow-[0_4px_12px_rgba(123,104,238,0.4)]"
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

      {/* View Contact Dialog */}
      <Dialog open={isViewContactOpen} onOpenChange={setIsViewContactOpen}>
        <DialogContent className={`sm:max-w-[800px] max-h-[90vh] overflow-y-auto ${resolvedTheme === "color"
          ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)] text-white"
          : resolvedTheme === "dark"
            ? "bg-[#14141b] border-[#3a3a3a] text-[#e5e5e5]"
            : "bg-white border-[#e5e7eb]"
          }`}>
          <DialogHeader>
            <DialogTitle className={resolvedTheme === "dark" ? "text-[#f3f4f6]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : ""}>Contact Details</DialogTitle>
            <DialogDescription className={resolvedTheme === "dark" ? "text-[#9ca3af]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : ""}>
              View contact information
            </DialogDescription>
          </DialogHeader>

          {isLoadingContactDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : viewingContact ? (
            <div className="space-y-6 py-4">
              <div className={`border border-[0.667px] rounded-[12px] p-6 flex flex-col gap-6 ${resolvedTheme === "dark"
                ? "bg-[#262626] border-[#3a3a3a]"
                : resolvedTheme === "color"
                  ? "bg-[rgba(20,20,40,0.6)] border-[rgba(0,255,255,0.2)]"
                  : "bg-white border-[#e5e7eb]"
                }`}>
                <h4 className={`text-[14px] font-bold leading-[20px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                  }`}>Contact Information</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-[8px] min-w-0">
                    <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                      }`}>First Name</Label>
                    <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center min-w-0 ${resolvedTheme === "dark"
                      ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                      : resolvedTheme === "color"
                        ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                        : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                      }`}>
                      <span className="truncate w-full">{viewingContact.firstName || "--"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-[8px] min-w-0">
                    <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                      }`}>Last Name</Label>
                    <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center min-w-0 ${resolvedTheme === "dark"
                      ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                      : resolvedTheme === "color"
                        ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                        : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                      }`}>
                      <span className="truncate w-full">{viewingContact.lastName || "--"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-[8px] min-w-0">
                    <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                      }`}>Email</Label>
                    <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center min-w-0 ${resolvedTheme === "dark"
                      ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                      : resolvedTheme === "color"
                        ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                        : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                      }`}>
                      <span className="truncate w-full">{viewingContact.email || "--"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-[8px] min-w-0">
                    <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                      }`}>Phone</Label>
                    <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center min-w-0 ${resolvedTheme === "dark"
                      ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                      : resolvedTheme === "color"
                        ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                        : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                      }`}>
                      <span className="truncate w-full">{viewingContact.phoneNumber || "--"}</span>
                    </div>
                  </div>

                  {viewingContact.role && (
                    <div className="flex flex-col gap-[8px] min-w-0">
                      <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                        }`}>Role</Label>
                      <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center min-w-0 ${resolvedTheme === "dark"
                        ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                        : resolvedTheme === "color"
                          ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                          : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                        }`}>
                        <span className="truncate w-full">{viewingContact.role}</span>
                      </div>
                    </div>
                  )}

                  {viewingContact.companyName && (
                    <div className="flex flex-col gap-[8px] min-w-0">
                      <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                        }`}>Company</Label>
                      <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center min-w-0 ${resolvedTheme === "dark"
                        ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                        : resolvedTheme === "color"
                          ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                          : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                        }`}>
                        <span className="truncate w-full">{viewingContact.companyName}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No contact data available
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewContactOpen(false)}
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
