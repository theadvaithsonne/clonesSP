"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronsUpDown,
  Bell,
  RefreshCw,
  RotateCcw,
  Clock,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  Star,
  Check,
  Loader2,
  Facebook,
  ArrowLeft,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useCallback, Suspense } from "react";
import { getUserData } from "@/utils/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { dispatchDealsInlineNavigate } from "@/lib/deals-events";
import {
  getLeadNotifications,
  markNotificationsAsRead,
  getUnreadNotificationCount,
  type LeadNotification
} from "@/utils/leadNotifications";
import { jwtDecode } from 'jwt-decode'
import { getOrgId, getUserDataFromToken } from "@/lib/auth";
import { getTeamMembers } from "@/lib/feed-api";
interface JwtPayload {
  // Adjust these fields according to YOUR actual JWT payload
  sub?: string        // user id
  name?: string
  email?: string
  role?: string
  exp?: number
  orgId?: string
  iat?: number
  userId?: string
  // ... add any custom claims like garageId, permissions, etc.
  [key: string]: any
}
interface AuditLog {
  _id: string;
  action?: string;
  entityType?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  description?: string;
  createdAt?: string;
  timestamp?: string;
  changes?: Record<string, unknown>;
  oldData?: any;
  newData?: any;
  leadName?: string;
  app?: string;
  isDeals?: boolean;
}

function getNotificationId(id: any): string {
  if (!id) return "";
  if (typeof id === "string") return id;
  if (typeof id === "object") {
    if (id.$oid) return String(id.$oid);
    if (id.id) return String(id.id);
    if (id._id) return String(id._id);
    if (id.oid) return String(id.oid);
    if (id.toString && typeof id.toString === "function") {
      const str = id.toString();
      if (str && str !== "[object Object]") return str;
    }
  }
  return String(id);
}

function toTitleCase(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getEntityName(entityType: string, data: any): string {
  if (!data) return "";
  const type = entityType.toLowerCase();
  if (type === "lead" || type === "leads") {
    return data.leadName || data.name || "";
  }
  if (type === "task" || type === "tasks" || type === "activity" || type === "activities") {
    return data.title || data.description || "";
  }
  if (type === "company" || type === "companies") {
    return data.companyName || data.name || "";
  }
  if (type === "contact" || type === "contacts") {
    if (data.firstName || data.lastName) {
      return `${data.firstName || ""} ${data.lastName || ""}`.trim();
    }
    return data.name || data.email || "";
  }
  if (type === "funnel" || type === "funnels") {
    return data.funnelName || data.name || "";
  }
  if (type === "product" || type === "products") {
    return data.name || data.productName || "";
  }
  return data.name || data.title || "";
}

function formatAuditNotification(n: AuditLog, usersMap: Record<string, string>): string {
  const entityType = (n.entityType || "record").toLowerCase();
  const action = (n.action || "").toLowerCase();
  
  const data = n.newData || n.oldData;
  const entityName = getEntityName(entityType, data);
  const entityNameStr = entityName ? `"${entityName}"` : "";

  let actionVerb = action;
  if (action === "create") actionVerb = "created";
  else if (action === "update") actionVerb = "updated";
  else if (action === "delete") actionVerb = "deleted";

  let typePretty = entityType;
  if (entityType === "task") typePretty = "Task";
  else if (entityType === "lead") typePretty = "Lead";
  else if (entityType === "funnel") typePretty = "Funnel";
  else if (entityType === "contact") typePretty = "Contact";
  else if (entityType === "company") typePretty = "Company";
  else if (entityType === "product") typePretty = "Product";
  else if (entityType === "activity") typePretty = "Activity";
  else if (entityType === "note") typePretty = "Note";

  const leadName = n.leadName || n.newData?.leadName || n.oldData?.leadName || "";

  let displayAction = actionVerb;
  if (action === "update" && n.changes && typeof n.changes === "object") {
    const changedFields = Object.keys(n.changes);
    if (entityType === "task" && changedFields.includes("isCompleted")) {
      const isCompleted = n.newData?.isCompleted;
      if (isCompleted === true) {
        displayAction = "marked as completed";
      } else if (isCompleted === false) {
        displayAction = "marked as incomplete";
      }
    }
  }

  let resultStr = "";
  if (entityType !== "lead" && entityType !== "leads" && leadName) {
    resultStr = `${typePretty} ${entityNameStr} ${displayAction} for "${leadName}"`;
  } else {
    resultStr = `${typePretty} ${entityNameStr} ${displayAction}`;
  }

  if (action === "update" && displayAction === "updated" && n.changes && typeof n.changes === "object") {
    const changedFields = Object.keys(n.changes);
    if (changedFields.length > 0) {
      resultStr += `: ${changedFields.join(", ")}`;
    }
  }

  const fallbackDesc = n.description || "Change recorded in CRM";
  return resultStr.trim() || fallbackDesc;
}

const AUDIT_LOGS_REFRESH_EVENT = "crm:auditLogs:refresh";
const AUDIT_LAST_SEEN_KEY = "crm:last-seen-audit-log";

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

interface ContactOption {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  companyName?: string;
  raw: any;
}

interface CompanyOption {
  id: string;
  name: string;
  industry?: string;
  raw: any;
}

const extractCompanyName = (entity: any): string => {
  return (
    entity?.companyDetails?.companyName ||
    entity?.companyDetails?.name ||
    entity?.company?.companyName ||
    entity?.company?.name ||
    entity?.companyName ||
    ""
  );
};

const toContactOption = (contact: any): ContactOption | null => {
  const id = contact?._id || contact?.id || contact?.contactId;
  if (!id) return null;
  const firstName = contact?.firstName || "";
  const lastName = contact?.lastName || "";
  const displayName = `${firstName} ${lastName}`.trim() || contact?.name || contact?.email || "Unknown Contact";
  return {
    id: String(id),
    name: displayName,
    email: contact?.email || "",
    phoneNumber: contact?.phoneNumber || contact?.phone || "",
    companyName: extractCompanyName(contact),
    raw: contact,
  };
};

const toCompanyOption = (company: any): CompanyOption | null => {
  const id = company?._id || company?.id || company?.companyId;
  if (!id) return null;
  return {
    id: String(id),
    name: company?.name || company?.companyName || company?.title || "Unknown Company",
    industry: company?.industry || company?.companyDetails?.industry || company?.sector || company?.category,
    raw: company,
  };
};

interface OwnerOption {
  id: string;
  name: string;
  email?: string;
  raw: any;
}

const toOwnerOption = (owner: any): OwnerOption | null => {
  const id = owner?._id || owner?.id || owner?.userId;
  if (!id) return null;
  const displayName =
    owner?.name ||
    `${owner?.firstName || ""} ${owner?.lastName || ""}`.trim() ||
    owner?.email ||
    "Unknown Owner";
  return {
    id: String(id),
    name: displayName,
    email: owner?.email || "",
    raw: owner,
  };
};

const extractErrorMessage = (error: any, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    return extractErrorMessage(error[0], fallback);
  }
  if (typeof error === "object") {
    console.log(error);
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

function DealsNavbarContent({
  forceStandardOnFacebook = false,
}: {
  forceStandardOnFacebook?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [inlineSection, setInlineSection] = useState<string | null>(null);
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
  const searchParams = useSearchParams();
  const { theme, resolvedTheme: nextResolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const resolvedTheme =
    theme === "color"
      ? "color"
      : theme === "dark" || nextResolvedTheme === "dark" || isInlineDealsMode
        ? "dark"
        : "light";

  // Check if we're on Facebook leads tab (URL-driven; not in inline overlay)
  const isFacebookLeadsTab =
    !isInlineDealsMode &&
    (pathname?.startsWith("/deals/leads") ?? false) &&
    searchParams.get("tab") === "facebook-leads";

  useEffect(() => {
    if (typeof window === "undefined" || !isInlineDealsMode) return;

    setInlineSection(sessionStorage.getItem("deals:inline-section"));

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ section?: string }>;
      const nextSection = customEvent.detail?.section;
      if (nextSection) {
        setInlineSection(nextSection);
      }
    };

    window.addEventListener(
      "deals:inline-section-change",
      handler as EventListener
    );
    return () => {
      window.removeEventListener(
        "deals:inline-section-change",
        handler as EventListener
      );
    };
  }, [isInlineDealsMode]);
  const showFacebookToolbar = isFacebookLeadsTab && !forceStandardOnFacebook;

  const [isFacebookConnected, setIsFacebookConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("facebook_leads_integration");
      const parsed = raw ? JSON.parse(raw) : null;
      setIsFacebookConnected(Boolean(parsed?.accessToken));
    } catch {
      setIsFacebookConnected(false);
    }
  }, [isFacebookLeadsTab]);

  // Get page title and subtitle based on pathname
  const getPageTitle = () => {
    if (isInlineDealsMode) {
      if (inlineSection === "leads") return "Leads";
      if (inlineSection === "funnel") return "Funnels";
      if (inlineSection === "products") return "Products & Services";
      if (inlineSection === "cms") return "Landing Pages";
      if (inlineSection === "contacts") return "Contacts";
      if (inlineSection === "companies") return "Companies";
      return "Dashboard";
    }
    if (pathname === "" || pathname === "/deals" || pathname === "/deals/") return "Dashboard";
    if (pathname.startsWith("/deals/leads")) return "Leads";
    if (pathname.startsWith("/deals/funnel")) return "Funnels";
    if (pathname.startsWith("/deals/products")) return "Products & Services";
    if (pathname.startsWith("/deals/cms")) return "Landing Pages";
    if (pathname.startsWith("/deals/contacts")) return "Contacts";
    if (pathname.startsWith("/deals/companies")) return "Companies";
    if (pathname.startsWith("/deals/messages")) return "Communication";
    if (pathname.startsWith("/deals/activities")) return "Activities";
    if (pathname.startsWith("/deals/pipeline")) return "Pipeline";
    return "Dashboard";
  };

  const getPageSubtitle = () => {
    if (isInlineDealsMode) {
      if (inlineSection === "leads") return "Manage and track your leads";
      if (inlineSection === "funnel") return "View and manage sales funnels";
      if (inlineSection === "products") return "Manage products and services";
      if (inlineSection === "cms") return "Build, publish and manage your pages";
      if (inlineSection === "contacts") return "Manage your contacts";
      if (inlineSection === "companies") return "Manage company information";
      return "Overview of your sales performance";
    }
    if (pathname === "" || pathname === "/deals" || pathname === "/deals/")
      return "Overview of your sales performance";
    if (pathname.startsWith("/deals/leads")) return "Manage and track your leads";
    if (pathname.startsWith("/deals/funnel")) return "View and manage sales funnels";
    if (pathname.startsWith("/deals/products")) return "Manage products and services";
    if (pathname.startsWith("/deals/cms")) return "Build, publish and manage your pages";
    if (pathname.startsWith("/deals/contacts")) return "Manage your contacts";
    if (pathname.startsWith("/deals/companies")) return "Manage company information";
    if (pathname.startsWith("/deals/messages")) return "View and manage communications";
    if (pathname.startsWith("/deals/activities")) return "Track activities and follow-ups";
    if (pathname.startsWith("/deals/pipeline")) return "View your sales pipeline";
    return "Overview of your sales performance";
  };

  // Handle theme toggle - toggle between dark and custom color theme
  const toggleTheme = () => {
    if (theme === "color") {
      setTheme("dark");
    } else {
      setTheme("color");
    }
  };

  // Dialog states
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);

  // Add Lead form state
  const [leadForm, setLeadForm] = useState({
    leadName: "",
    contactId: "",
    phone: "",
    initialStage: "Prospects",
    source: "",
    notes: "",
    companyId: "",
    email: "",
    salesFunnelId: "",
    estimatedValue: "0",
    assignedTo: "",
    priority: "",
    nextFollowUp: "",
    estimatedClose: "",
  });
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [funnels, setFunnels] = useState<any[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [sources] = useState<string[]>(["Website", "Referral", "Cold Call", "LinkedIn", "Event", "Email Campaign"]);
  const [funnelStages, setFunnelStages] = useState<any[]>([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false);
  const [isContactComboOpen, setIsContactComboOpen] = useState(false);
  const [isCompanyComboOpen, setIsCompanyComboOpen] = useState(false);
  const [isOwnerComboOpen, setIsOwnerComboOpen] = useState(false);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);
  const [selectedContactOption, setSelectedContactOption] = useState<ContactOption | null>(null);
  const [selectedCompanyOption, setSelectedCompanyOption] = useState<CompanyOption | null>(null);
  const [selectedOwnerOption, setSelectedOwnerOption] = useState<OwnerOption | null>(null);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [isCompaniesLoading, setIsCompaniesLoading] = useState(false);
  const [isOwnersLoading, setIsOwnersLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState("");

  // Add Product form state
  const [productForm, setProductForm] = useState({
    type: "product" as "product" | "service",
    name: "",
    code: "",
    category: "",
    price: "",
    unit: "monthly" as "hourly" | "monthly" | "yearly" | "daily" | "weekly" | "one-time" | "per-unit",
    status: "Active" as "Active" | "Pause" | "Inactive",
    description: "",
  });
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Add Contact form state
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    phone: "",
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactCompanies, setContactCompanies] = useState<Array<{ _id: string; name: string }>>([]);
  const [loadingContactCompanies, setLoadingContactCompanies] = useState(false);
  const [contactNameError, setContactNameError] = useState("");
  const [contactEmailError, setContactEmailError] = useState("");
  const [roleOptions, setRoleOptions] = useState<string[]>(DEFAULT_ROLE_OPTIONS);
  const [isCustomRoleDialogOpen, setIsCustomRoleDialogOpen] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [customRoleError, setCustomRoleError] = useState("");
  const [pendingRoleTarget, setPendingRoleTarget] = useState<"add" | null>(null);

  // Inline Add Company/Contact Dialog states
  const [isAddCompanyDialogOpen, setIsAddCompanyDialogOpen] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    companyName: "",
    industry: "",
    revenue: "",
    website: "",
    address: "",
  });
  const [isAddContactDialogOpen, setIsAddContactDialogOpen] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [newContactForm, setNewContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [unreadAuditCount, setUnreadAuditCount] = useState(0);
  const [isAuditDropdownOpen, setIsAuditDropdownOpen] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [auditSkip, setAuditSkip] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [isFetchingMoreAudit, setIsFetchingMoreAudit] = useState(false);

  useEffect(() => {
    const fetchUsersAndEmployees = async () => {
      const uMap: Record<string, string> = {};
      const orgId = getOrgId() || getUserDataFromToken().orgId || "";

      // 1. Fetch current-workspace members for name resolution
      try {
        if (orgId) {
          let list: any[] = [];
          try {
            list = await getTeamMembers(orgId);
          } catch {
            const res = await authenticatedFetch(
              buildExternalUrl(`/crm/organization-users?organizationId=${orgId}&limit=1000`),
              { method: "GET" }
            );
            if (res.ok) {
              const data = await res.json();
              list = data?.users || data?.members || data?.data?.users || data?.data?.members || data?.data || data || [];
            }
          }
          (Array.isArray(list) ? list : []).forEach((user: any) => {
            const id = getNotificationId(user._id || user.id);
            const name = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "";
            if (id && name) {
              uMap[id] = name;
            }
          });
        }
      } catch (e) {
        console.error("Failed to fetch users for notifications:", e);
      }

      // 2. Fetch Employees
      try {
        const empRes = await authenticatedFetch(buildExternalUrl("/employees"), {
          method: "GET",
        });
        if (empRes.ok) {
          const data = await empRes.json();
          const list = Array.isArray(data) ? data : (data?.data || data?.employees || []);
          list.forEach((emp: any) => {
            const id = getNotificationId(emp._id || emp.id);
            const name = emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email || "";
            if (id && name) {
              uMap[id] = name;
            }
          });
        }
      } catch (e) {
        console.error("Failed to fetch employees for notifications:", e);
      }

      setUsersMap(uMap);
    };

    fetchUsersAndEmployees();
  }, [authenticatedFetch, buildExternalUrl]);

  // Lead notifications state (for Facebook imports etc.)
  const [leadNotifications, setLeadNotifications] = useState<LeadNotification[]>([]);
  const [unreadLeadNotificationCount, setUnreadLeadNotificationCount] = useState(0);

  // Load lead notifications from localStorage
  const refreshLeadNotifications = useCallback(() => {
    const notifications = getLeadNotifications();
    setLeadNotifications(notifications);
    setUnreadLeadNotificationCount(getUnreadNotificationCount());
  }, []);

  // Listen for lead notification events
  useEffect(() => {
    refreshLeadNotifications();

    const handleNotificationAdded = () => refreshLeadNotifications();
    const handleNotificationsRead = () => refreshLeadNotifications();
    const handleNotificationsCleared = () => refreshLeadNotifications();

    window.addEventListener('leadNotificationAdded', handleNotificationAdded);
    window.addEventListener('leadNotificationsRead', handleNotificationsRead);
    window.addEventListener('leadNotificationsCleared', handleNotificationsCleared);

    return () => {
      window.removeEventListener('leadNotificationAdded', handleNotificationAdded);
      window.removeEventListener('leadNotificationsRead', handleNotificationsRead);
      window.removeEventListener('leadNotificationsCleared', handleNotificationsCleared);
    };
  }, [refreshLeadNotifications]);

  const formatRelativeTime = useCallback((value?: string) => {
    if (!value) return "Just now";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    return date.toLocaleString();
  }, []);

  const fetchAuditLogs = useCallback(
    async (treatDropdownOpen: boolean = isAuditDropdownOpen, skipOffset: number = 0, isLoadMore: boolean = false) => {
      if (isLoadMore) {
        setIsFetchingMoreAudit(true);
      } else {
        setIsLoadingAuditLogs(true);
      }
      setAuditError("");
      try {
        const response = await authenticatedFetch(
          buildExternalUrl(`/crm/audit-logs?limit=30&skip=${skipOffset}`),
          { method: "GET" }
        );

        if (!response.ok) {
          setAuditError("Unable to load activity feed.");
          return;
        }

        const data = await response.json();
        const rawLogs = Array.isArray(data?.logs)
          ? data.logs
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
              ? data
              : [];

        const normalizedLogs: AuditLog[] = rawLogs
          .filter((log: any) => log && typeof log === "object")
          .map((log: any) => ({ ...log }));

        if (isLoadMore) {
          setAuditLogs((prev) => [...prev, ...normalizedLogs]);
        } else {
          setAuditLogs(normalizedLogs);
        }

        if (data?.pagination) {
          setAuditHasMore(data.pagination.hasMore);
        } else {
          setAuditHasMore(normalizedLogs.length === 30);
        }

        if (typeof window !== "undefined") {
          // Calculate unreads only if we're doing an initial fetch (not a load more)
          if (!isLoadMore) {
            if (normalizedLogs.length > 0) {
              const latestRaw = normalizedLogs[0].createdAt || normalizedLogs[0].timestamp || "";
              if (treatDropdownOpen && latestRaw) {
                localStorage.setItem(AUDIT_LAST_SEEN_KEY, latestRaw);
                setUnreadAuditCount(0);
              } else if (!treatDropdownOpen) {
                const lastSeenRaw = localStorage.getItem(AUDIT_LAST_SEEN_KEY);
                if (!lastSeenRaw) {
                  setUnreadAuditCount(normalizedLogs.length);
                } else {
                  const lastSeenTs = Date.parse(lastSeenRaw);
                  if (Number.isNaN(lastSeenTs)) {
                    setUnreadAuditCount(normalizedLogs.length);
                  } else {
                    const unread = normalizedLogs.filter((log) => {
                      const rawTs = log.createdAt || log.timestamp;
                      const ts = rawTs ? Date.parse(rawTs) : NaN;
                      return !Number.isNaN(ts) && ts > lastSeenTs;
                    }).length;
                    setUnreadAuditCount(unread);
                  }
                }
              }
            } else {
              if (treatDropdownOpen) {
                localStorage.removeItem(AUDIT_LAST_SEEN_KEY);
              }
              setUnreadAuditCount(0);
            }
          }
        } else {
          if (!isLoadMore) {
            setUnreadAuditCount(treatDropdownOpen ? 0 : normalizedLogs.length);
          }
        }
      } catch (error) {
        console.error("Error fetching audit logs:", error);
        setAuditError("Unable to load activity feed.");
      } finally {
        if (isLoadMore) {
          setIsFetchingMoreAudit(false);
        } else {
          setIsLoadingAuditLogs(false);
        }
      }
    },
    [isAuditDropdownOpen]
  );

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => fetchAuditLogs();
    window.addEventListener(AUDIT_LOGS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(AUDIT_LOGS_REFRESH_EVENT, handler);
  }, [fetchAuditLogs]);

  const handleAuditDropdownOpenChange = (open: boolean) => {
    setIsAuditDropdownOpen(open);
    if (open) {
      setAuditSkip(0);
      setUnreadAuditCount(0);
      if (typeof window !== "undefined") {
        const latestRaw = auditLogs[0]?.createdAt || auditLogs[0]?.timestamp;
        if (latestRaw) {
          localStorage.setItem(AUDIT_LAST_SEEN_KEY, latestRaw);
        }
      }
      fetchAuditLogs(true, 0, false);
    }
  };

  const handleLoadMoreAuditLogs = () => {
    const nextSkip = auditSkip + 30;
    setAuditSkip(nextSkip);
    fetchAuditLogs(isAuditDropdownOpen, nextSkip, true);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const currentUserData = getUserData();
    if (currentUserData) {
      setUserData(currentUserData);
    }
  }, []);

  useEffect(() => {
    const storedUserData = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;


    if (!storedUserData) {
      setOrganizationId("");
      return;
    }
    try {
      // const  = JSON.parse(storedUserData);
      const parsed = jwtDecode<JwtPayload>(storedUserData)

      setOrganizationId(parsed.orgId || "");
    } catch (error) {
      console.error("Failed to parse user data for organizationId:", error);
      setOrganizationId("");
    }
  }, []);

  // Fetch dropdown data when dialogs open
  useEffect(() => {
    if (isAddLeadOpen) {
      fetchLeadDropdownData();
    }
  }, [isAddLeadOpen]);

  useEffect(() => {
    if (isAddContactOpen) {
      fetchContactCompanies();
      setRoleOptions((prev) => {
        const withoutOther = prev.filter((opt) => opt.toLowerCase() !== "other");
        return [...withoutOther, "Other"];
      });
    }
  }, [isAddContactOpen]);

  const loadContacts = useCallback(
    async (term?: string) => {
      const query = term?.trim() || "";
      const isSearch = query.length > 0;
      try {
        if (isSearch) {
          setIsSearchingContacts(true);
        } else {
          setIsSearchingContacts(false);
        }
        setIsContactsLoading(true);
        let response: Response;
        if (isSearch) {
          const params = new URLSearchParams({ q: query });
          response = await authenticatedFetch(
            buildExternalUrl(`/crm/searchcontact?${params.toString()}`),
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            }
          );
        } else {
          response = await authenticatedFetch(
            buildExternalUrl("/crm/contacts?skip=0&limit=50"),
            { method: "GET" }
          );
        }

        if (response.ok) {
          const data = await response.json();
          const list = data.contacts || data.data || data || [];
          const options = (Array.isArray(list) ? list : [])
            .map(toContactOption)
            .filter(Boolean) as ContactOption[];

          if (isSearch) {
            setContacts(options);
          } else {
            setContacts((prev) => {
              if (!leadForm.contactId) return options;
              const idStr = String(leadForm.contactId);
              if (options.some((option) => option.id === idStr)) {
                return options;
              }
              const existing = prev.find((option) => option.id === idStr);
              return existing ? [existing, ...options] : options;
            });
          }

          if (leadForm.contactId) {
            const match = options.find((option) => option.id === String(leadForm.contactId));
            if (match) {
              setSelectedContactOption(match);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load contacts:", error);
      } finally {
        setIsContactsLoading(false);
        setIsSearchingContacts(false);
      }
    },
    [authenticatedFetch, buildExternalUrl, leadForm.contactId]
  );

  const loadCompanies = useCallback(
    async (term?: string) => {
      const query = term?.trim() || "";
      const isSearch = query.length > 0;
      try {
        if (isSearch) {
          setIsSearchingCompanies(true);
        } else {
          setIsSearchingCompanies(false);
        }
        setIsCompaniesLoading(true);
        let response: Response;
        if (isSearch) {
          const params = new URLSearchParams({ q: query });
          response = await authenticatedFetch(
            buildExternalUrl(`crm/searchcompany?${params.toString()}`),
            { method: "GET" }
          );
        } else {
          response = await authenticatedFetch(
            buildExternalUrl("/crm/companies?skip=0&limit=50"),
            { method: "GET" }
          );
        }

        if (response.ok) {
          const data = await response.json();
          const list = data.companies || data.data || data || [];
          const options = (Array.isArray(list) ? list : [])
            .map(toCompanyOption)
            .filter(Boolean) as CompanyOption[];

          if (isSearch) {
            setCompanies(options);
          } else {
            setCompanies((prev) => {
              if (!leadForm.companyId) return options;
              const idStr = String(leadForm.companyId);
              if (options.some((option) => option.id === idStr)) {
                return options;
              }
              const existing = prev.find((option) => option.id === idStr);
              return existing ? [existing, ...options] : options;
            });
          }

          if (leadForm.companyId) {
            const match = options.find((option) => option.id === String(leadForm.companyId));
            if (match) {
              setSelectedCompanyOption(match);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load companies:", error);
      } finally {
        setIsCompaniesLoading(false);
        setIsSearchingCompanies(false);
      }
    },
    [authenticatedFetch, buildExternalUrl, leadForm.companyId]
  );

  const loadOwners = useCallback(
    async (term?: string) => {
      const query = term?.trim() || "";
      const orgId = getOrgId() || getUserDataFromToken().orgId || organizationId || "";
      try {
        if (!orgId) {
          setOwners([]);
          setIsOwnersLoading(false);
          return;
        }
        setIsOwnersLoading(true);
        let list: any[] = [];
        try {
          list = await getTeamMembers(orgId);
        } catch {
          list = [];
        }
        if (!Array.isArray(list) || list.length === 0) {
          const response = await authenticatedFetch(
            buildExternalUrl(`/crm/organization-users?organizationId=${orgId}&limit=1000`),
            { method: "GET" }
          );
          if (!response.ok) {
            throw new Error("Failed to load owners");
          }
          const data = await response.json();
          list = data?.users || data?.members || data?.data?.users || data?.data?.members || data?.data || [];
        }
        list = Array.isArray(list) ? list : [];
        if (query.length > 0) {
          const q = query.toLowerCase();
          list = list.filter((owner: any) => {
            const name = `${owner?.name || ""} ${owner?.firstName || ""} ${owner?.lastName || ""} ${owner?.email || ""}`.toLowerCase();
            return name.includes(q);
          });
        }
        const options = list
          .map((owner: any) => {
            const option = toOwnerOption(owner);
            return option;
          })
          .filter(Boolean) as OwnerOption[];

        if (query.length > 0) {
          setOwners(options);
        } else {
          setOwners((prev) => {
            if (!leadForm.assignedTo) return options;
            const idStr = String(leadForm.assignedTo);
            if (options.some((option) => option.id === idStr)) {
              return options;
            }
            const existing = prev.find((option) => option.id === idStr);
            return existing ? [existing, ...options] : options;
          });
        }

        if (!leadForm.assignedTo && options.length > 0 && query.length === 0) {
          setLeadForm((prev) => {
            if (prev.assignedTo) return prev;
            return { ...prev, assignedTo: options[0].id };
          });
        }

        if (leadForm.assignedTo) {
          const match = options.find((option) => option.id === String(leadForm.assignedTo));
          if (match) {
            setSelectedOwnerOption(match);
          }
        }
      } catch (error) {
        console.error("Failed to load owners:", error);
        if (query.length > 0) {
          setOwners([]);
        }
      } finally {
        setIsOwnersLoading(false);
      }
    },
    [authenticatedFetch, buildExternalUrl, organizationId, leadForm.assignedTo]
  );

  useEffect(() => {
    if (!isAddLeadOpen) return;
    const term = contactSearchTerm.trim();
    if (term.length === 0) {
      if (contacts.length === 0) {
        loadContacts();
      } else {
        setIsContactsLoading(false);
        setIsSearchingContacts(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      loadContacts(term);
    }, 300);

    return () => clearTimeout(timer);
  }, [contactSearchTerm, contacts.length, isAddLeadOpen, loadContacts]);

  useEffect(() => {
    if (!isAddLeadOpen) return;
    const term = companySearchTerm.trim();
    if (term.length === 0) {
      if (companies.length === 0) {
        loadCompanies();
      } else {
        setIsCompaniesLoading(false);
        setIsSearchingCompanies(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      loadCompanies(term);
    }, 300);

    return () => clearTimeout(timer);
  }, [companySearchTerm, companies.length, isAddLeadOpen, loadCompanies]);

  useEffect(() => {
    if (!leadForm.contactId) {
      setSelectedContactOption(null);
      return;
    }
    const match = contacts.find((option) => option.id === String(leadForm.contactId));
    if (match) {
      setSelectedContactOption(match);
    }
  }, [contacts, leadForm.contactId]);

  useEffect(() => {
    if (!leadForm.companyId) {
      setSelectedCompanyOption(null);
      return;
    }
    const match = companies.find((option) => option.id === String(leadForm.companyId));
    if (match) {
      setSelectedCompanyOption(match);
    }
  }, [companies, leadForm.companyId]);

  useEffect(() => {
    if (!leadForm.assignedTo) {
      setSelectedOwnerOption(null);
      return;
    }
    const match = owners.find((option) => option.id === String(leadForm.assignedTo));
    if (match) {
      setSelectedOwnerOption(match);
    }
  }, [owners, leadForm.assignedTo]);

  useEffect(() => {
    if (!isOwnerComboOpen) return;
    if (owners.length === 0) {
      loadOwners();
    }
  }, [isOwnerComboOpen, owners.length, loadOwners]);

  useEffect(() => {
    if (!isOwnerComboOpen) return;
    const term = ownerSearchTerm.trim();
    const timer = setTimeout(() => {
      loadOwners(term.length > 0 ? term : undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [ownerSearchTerm, isOwnerComboOpen, loadOwners]);

  useEffect(() => {
    if (isAddLeadOpen && organizationId) {
      loadOwners();
    }
  }, [isAddLeadOpen, organizationId, loadOwners]);

  const fetchLeadDropdownData = async () => {
    try {
      await loadContacts();
      await loadCompanies();
      await loadOwners();

      // Fetch funnels
      const funnelsResponse = await authenticatedFetch(
        buildExternalUrl("/crm/funnels?skip=0&limit=100"),
        { method: "GET" }
      );
      if (funnelsResponse.ok) {
        const funnelsData = await funnelsResponse.json();
        const funnelsList = funnelsData.funnels || funnelsData.data || funnelsData || [];
        setFunnels(funnelsList);
        if (funnelsList.length > 0 && !leadForm.salesFunnelId) {
          const firstFunnelId = funnelsList[0]._id || funnelsList[0].id;
          setLeadForm(prev => ({ ...prev, salesFunnelId: firstFunnelId }));
          await fetchFunnelStages(firstFunnelId);
        }
      }

    } catch (error) {
      console.error("Error fetching dropdown data:", error);
      toast.error("Failed to load dropdown data. Please try again.");
    }
  };

  const fetchFunnelStages = async (funnelId: string) => {
    if (!funnelId) {
      setFunnelStages([]);
      return;
    }

    setIsLoadingStages(true);
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
        const stages = funnelData.funnelStage || funnelData.stages || [];

        const transformedStages = stages.map((stage: any) => {
          if (typeof stage === 'string') {
            return { name: stage, value: stage };
          }
          return {
            name: stage.name || stage.stageName || stage,
            value: stage.name || stage.stageName || stage.id || stage,
          };
        });

        setFunnelStages(transformedStages);
        if (transformedStages.length > 0) {
          const firstStage = transformedStages[0].name || transformedStages[0].value;
          setLeadForm(prev => ({
            ...prev,
            initialStage: firstStage,
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching funnel stages:", error);
      setFunnelStages([]);
    } finally {
      setIsLoadingStages(false);
    }
  };

  const fetchContactCompanies = async () => {
    setLoadingContactCompanies(true);
    try {
      const response = await authenticatedFetch(
        buildExternalUrl("/crm/companies?skip=0&limit=100"),
        { method: "GET" }
      );
      if (response.ok) {
        const data = await response.json();
        const companiesList = data.companies || data.data || data || [];
        setContactCompanies(companiesList.map((c: any) => ({ _id: c._id, name: c.name || c.companyName })));
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoadingContactCompanies(false);
    }
  };

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

  const openCustomRoleDialog = (target: "add") => {
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
      setContactForm((prev) => ({ ...prev, role: finalRole }));
    }

    handleCloseCustomRoleDialog();
  };

  const splitPhoneNumbers = (value: string): string[] =>
    (value || "")
      .split(/[,\n;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

  const isValidPhoneNumberEntry = (value: string): boolean => {
    if (/[^0-9\s()+-]/.test(value)) return false;
    const digitsOnly = value.replace(/\D/g, "");
    const isValidLocal10 = digitsOnly.length === 10;
    const isValidIndiaWithCountryCode = digitsOnly.length === 12 && digitsOnly.startsWith("91");
    return isValidLocal10 || isValidIndiaWithCountryCode;
  };

  const handleAddLead = async () => {
    if (!leadForm.leadName.trim()) {
      toast.error("Lead Name is required");
      return;
    }
    if (!leadForm.contactId) {
      setContactError("Contact Person is required");
      toast.error("Contact Person is required");
      return;
    }
    if (!leadForm.companyId) {
      toast.error("Company is required");
      return;
    }
    if (!leadForm.salesFunnelId) {
      toast.error("Sales Funnel is required");
      return;
    }
    const phoneEntries = splitPhoneNumbers(leadForm.phone || "");
    if (phoneEntries.length > 0) {
      const hasInvalidEntry = phoneEntries.some((entry) => !isValidPhoneNumberEntry(entry));
      if (hasInvalidEntry) {
        toast.error("Each phone number must be 10 digits (or +91 followed by 10 digits)");
        return;
      }
    }

    setIsSubmittingLead(true);
    const loadingToast = toast.loading("Creating lead...");

    try {
      const userData = localStorage.getItem("garage_tok");
      let userId = "";
      let organizationId = "";

      if (userData) {
        try {
          const parsedData = jwtDecode<JwtPayload>(userData)
          userId = parsedData.userId || parsedData.id || "";
          organizationId = parsedData?.orgId || "";
        } catch (e) {
          console.error("Error parsing user data:", e);
        }
      }

      const estimatedValue = parseFloat(leadForm.estimatedValue) || 0;

      const leadData = {
        quantity: 1,
        pricing: estimatedValue,
        negotiatedPricing: estimatedValue,
        MaxDiscPrice: estimatedValue,
        salesFunnel: leadForm.salesFunnelId,
        stage: leadForm.initialStage || "Prospects",
        companyId: leadForm.companyId,
        documents: [],
        duration: 0,
        category: "",
        leadName: leadForm.leadName.trim().replace(/\s+Deal$/, ""),
        email: leadForm.email || "",
        phone: phoneEntries[0] || "",
        phoneNumbers: phoneEntries,
        estimatedValue: estimatedValue,
        source: leadForm.source || "",
        assignedTo: leadForm.assignedTo || userId,
        notes: leadForm.notes || "",
        priority: leadForm.priority || "",
        nextFollowUp: leadForm.nextFollowUp || "",
        estimatedClose: leadForm.estimatedClose || "",
        contactId: leadForm.contactId,
        organizationId: organizationId,
        createdBy: userId,
      };

      const response = await authenticatedFetch(
        buildExternalUrl("/crm/leads"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(leadData),
        }
      );

      if (response.ok) {
        toast.success("Lead created successfully!", { id: loadingToast });
        setIsAddLeadOpen(false);
        resetLeadForm();
        router.refresh();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || "Failed to create lead", { id: loadingToast });
      }
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error("Failed to create lead. Please try again.", { id: loadingToast });
    } finally {
      setIsSubmittingLead(false);
    }
  };
  console.log("theme", theme)
  const selectContactOption = (option: ContactOption) => {
    setLeadForm((prev) => ({
      ...prev,
      contactId: option.id,
      email: option.email || "",
      phone: option.phoneNumber || "",
    }));
    setSelectedContactOption(option);
    setContactError(null);
    setContactSearchTerm("");
    setIsContactComboOpen(false);
  };

  const selectCompanyOption = (option: CompanyOption) => {
    setLeadForm((prev) => ({
      ...prev,
      companyId: option.id,
    }));
    setSelectedCompanyOption(option);
    setCompanySearchTerm("");
    setIsCompanyComboOpen(false);
  };

  const selectOwnerOption = (option: OwnerOption) => {
    setLeadForm((prev) => ({
      ...prev,
      assignedTo: option.id,
    }));
    setSelectedOwnerOption(option);
    setOwnerSearchTerm("");
    setIsOwnerComboOpen(false);
  };

  // Handle creating company from inline dialog
  const handleCreateCompanyFromDialog = async () => {
    if (!newCompanyForm.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    setIsCreatingCompany(true);
    const loadingToast = toast.loading("Creating company...");

    try {
      const userData = localStorage.getItem("garage_tok");
      let userId = "";
      let orgId = organizationId;

      if (userData) {
        try {
          const parsedData = jwtDecode<JwtPayload>(userData)
          userId = parsedData.userId || parsedData.id || "";
          orgId = parsedData?.orgId || organizationId || "";
        } catch (e) {
          console.error("Error parsing user data:", e);
        }
      }

      const payload = {
        companyName: newCompanyForm.companyName.trim(),
        industry: newCompanyForm.industry || "",
        revenue: newCompanyForm.revenue || "",
        website: newCompanyForm.website || "",
        address: newCompanyForm.address || "",
        organizationId: orgId,
        createdBy: userId,
      };

      const response = await authenticatedFetch(
        buildExternalUrl("/crm/companies"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to create company";
        try {
          const errorData = await response.json();
          errorMessage = errorData?.message || errorMessage;
        } catch { }
        toast.error(errorMessage, { id: loadingToast });
        return;
      }

      const data = await response.json().catch(() => ({}));
      const createdCompany = data.company || data.data || data || {};

      const option = toCompanyOption(createdCompany);
      if (option) {
        setCompanies((prev) => {
          const exists = prev.some((c) => c.id === option.id);
          return exists ? prev : [option, ...prev];
        });
        setSelectedCompanyOption(option);
        setLeadForm((prev) => ({ ...prev, companyId: option.id }));
      }

      toast.success("Company created successfully!", { id: loadingToast });
      setIsAddCompanyDialogOpen(false);
      setNewCompanyForm({
        companyName: "",
        industry: "",
        revenue: "",
        website: "",
        address: "",
      });
    } catch (error) {
      console.error("Error creating company:", error);
      toast.error("Failed to create company. Please try again.");
    } finally {
      setIsCreatingCompany(false);
    }
  };

  // Handle creating contact from inline dialog
  const handleCreateContactFromDialog = async () => {
    if (!newContactForm.firstName.trim() || !newContactForm.lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    setIsCreatingContact(true);
    const loadingToast = toast.loading("Creating contact...");

    try {
      const userData = localStorage.getItem("garage_tok");
      let userId = "";
      let orgId = organizationId;

      if (userData) {
        try {
          const parsedData = jwtDecode<JwtPayload>(userData)
          userId = parsedData.userId || parsedData.id || "";
          orgId = parsedData?.orgId || organizationId || "";
        } catch (e) {
          console.error("Error parsing user data:", e);
        }
      }

      const payload = {
        firstName: newContactForm.firstName.trim(),
        lastName: newContactForm.lastName.trim(),
        email: newContactForm.email || "",
        phoneNumber: newContactForm.phoneNumber || "",
        organizationId: orgId,
        createdBy: userId,
      };

      const response = await authenticatedFetch(
        buildExternalUrl("/crm/contacts"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to create contact";
        try {
          const errorData = await response.json();
          errorMessage = errorData?.message || errorData?.error || errorMessage;
        } catch { }
        toast.error(errorMessage, { id: loadingToast });
        return;
      }

      const data = await response.json().catch(() => ({}));
      const createdContact = data.contact || data.data || data || {};

      const option = toContactOption(createdContact);
      if (option) {
        setContacts((prev) => {
          const exists = prev.some((c) => c.id === option.id);
          return exists ? prev : [option, ...prev];
        });
        setSelectedContactOption(option);
        setLeadForm((prev) => ({
          ...prev,
          contactId: option.id,
          email: option.email || prev.email,
          phone: option.phoneNumber || prev.phone,
        }));
        setContactError(null);
      }

      toast.success("Contact created successfully!", { id: loadingToast });
      setIsAddContactDialogOpen(false);
      setNewContactForm({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
      });
    } catch (error) {
      console.error("Error creating contact:", error);
      toast.error("Failed to create contact. Please try again.");
    } finally {
      setIsCreatingContact(false);
    }
  };

  const handleAddProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    setIsSubmittingProduct(true);
    const loadingToast = toast.loading("Creating product...");

    try {
      const isService = productForm.type === "service";
      const payload: any = {
        type: productForm.type,
        name: productForm.name,
        pricing: productForm.price ? parseFloat(productForm.price) : 0,
        unit: productForm.unit || "",
        category: productForm.category,
        status: productForm.status.toLowerCase(),
        description: productForm.description,
      };
      if (isService) payload.serviceId = productForm.code;
      else payload.productId = productForm.code;

      const response = await authenticatedFetch(
        buildExternalUrl("/crm/products"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create: ${response.status}`);
      }

      toast.success("Product created successfully!", { id: loadingToast });
      setIsAddProductOpen(false);
      resetProductForm();
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to create product. Please try again.", { id: loadingToast });
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleAddContact = async () => {
    // Validate
    if (!contactForm.name.trim()) {
      setContactNameError("Name is required");
      return;
    }
    if (!contactForm.email.trim()) {
      setContactEmailError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email)) {
      setContactEmailError("Please enter a valid email address");
      return;
    }

    setIsSubmittingContact(true);
    const loadingToast = toast.loading("Creating contact...");

    try {
      // Split name into firstName and lastName
      const nameParts = contactForm.name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const contactData = {
        firstName,
        lastName,
        email: contactForm.email,
        phoneNumber: contactForm.phone,
        role: contactForm.role,
        companyId: contactForm.company || undefined,
      };

      const response = await authenticatedFetch(
        buildExternalUrl("/crm/contacts"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(contactData),
        }
      );

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
      toast.success("Contact created successfully!", { id: loadingToast });
      setIsAddContactOpen(false);
      resetContactForm();
      router.refresh();
    } catch (error) {
      console.error("Error creating contact:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to create contact. Please try again.";
      toast.error(message, { id: loadingToast });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const resetLeadForm = () => {
    const firstFunnelId = funnels.length > 0 ? (funnels[0]._id || funnels[0].id) : "";
    setLeadForm({
      leadName: "",
      contactId: "",
      phone: "",
      initialStage: "Prospects",
      source: "",
      notes: "",
      companyId: "",
      email: "",
      salesFunnelId: firstFunnelId,
      estimatedValue: "0",
      assignedTo: owners.length > 0 ? owners[0].id : "",
      priority: "",
      nextFollowUp: "",
      estimatedClose: "",
    });
    setSelectedContactOption(null);
    setSelectedCompanyOption(null);
    setSelectedOwnerOption(null);
    setContactSearchTerm("");
    setCompanySearchTerm("");
    setOwnerSearchTerm("");
    setContactError(null);
  };

  const resetProductForm = () => {
    setProductForm({
      type: "product",
      name: "",
      code: "",
      category: "",
      price: "",
      unit: "monthly",
      status: "Active",
      description: "",
    });
  };

  const resetContactForm = () => {
    setContactForm({
      name: "",
      email: "",
      company: "",
      role: "",
      phone: "",
    });
    setContactNameError("");
    setContactEmailError("");
  };

  // Facebook Leads Navbar (Dark Theme)
  if (showFacebookToolbar && resolvedTheme === "dark" && isFacebookConnected) {
    return (
      <div className="relative z-50 border-[#3a3a3a] border-b-[0.667px] border-l-0 border-r-0 border-solid border-t-0 pb-[0.667px] pt-4 px-3 sm:px-6">
        <div className="min-h-[36px] relative w-full flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Back to CRM Button */}
          <button
            onClick={() => {
              if (isInlineDealsMode) {
                dispatchDealsInlineNavigate("leads");
              } else {
                router.push("/leads?tab=leads");
              }
            }}
            className="h-[32px] shrink-0 rounded-[6px] flex items-center gap-2 px-[10px] hover:bg-[rgba(58,58,58,0.3)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-[#e5e5e5]" />
            <span className="text-[12px] font-bold text-[#e5e5e5] leading-[16px] hidden sm:inline">
              Back to CRM
            </span>
          </button>

          {/* Divider */}
          <div className="hidden sm:block bg-[#3a3a3a] h-[20px] w-px shrink-0" />

          {/* All Pages Dropdown */}
          <Select defaultValue="all">
            <SelectTrigger className="h-[36px] w-full sm:w-[224px] shrink-0 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] border-[0.667px] rounded-[6px] px-[12.667px] text-[12px] text-[#9ca3af] hover:bg-[rgba(58,58,58,0.5)]">
              <SelectValue>
                <span className="text-[12px] text-[#9ca3af]">All Pages</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#3a3a3a]">
              <SelectItem value="all" className="text-[#9ca3af]">All Pages</SelectItem>
            </SelectContent>
          </Select>

          {/* All Forms Dropdown */}
          <Select defaultValue="all">
            <SelectTrigger className="h-[36px] w-full sm:w-[224px] shrink-0 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] border-[0.667px] rounded-[6px] px-[12.667px] text-[12px] text-[#e5e5e5] hover:bg-[rgba(58,58,58,0.5)]">
              <SelectValue>
                <span className="text-[12px] text-[#e5e5e5]">All Forms</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#3a3a3a]">
              <SelectItem value="all" className="text-[#e5e5e5]">All Forms</SelectItem>
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-0 w-full sm:max-w-[384px]">
            <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[#9ca3af]" />
            <Input
              placeholder="Search Facebook leads..."
              className="h-[32px] pl-[32px] pr-[12px] bg-[rgba(58,58,58,0.3)] border-0 rounded-[6px] text-[14px] text-[#9ca3af] placeholder:text-[#9ca3af] focus-visible:ring-0 focus-visible:outline-none"
            />
          </div>

          {/* Divider */}
          <div className="hidden sm:block bg-[#3a3a3a] h-[20px] w-px shrink-0" />

          {/* Sync Button */}
          <Button
            className="h-[32px] px-[10px] shrink-0 rounded-[6px] bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] border-[0.667px] text-[#e5e5e5] text-[12px] font-bold hover:bg-[rgba(58,58,58,0.5)] shadow-none"
          >
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          {/* Export to CRM Button */}
          <Button
            disabled
            className="h-[32px] px-[10px] shrink-0 rounded-[6px] bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] border-[0.667px] text-[#e5e5e5] text-[12px] font-bold opacity-50 cursor-not-allowed shadow-none"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export to CRM (0)</span>
          </Button>
        </div>
      </div>
    );
  }

  // Facebook Leads Navbar (Color Theme)
  if (showFacebookToolbar && resolvedTheme === "color" && isFacebookConnected) {
    return (
      <div className="relative z-50 border-[rgba(0,255,255,0.2)] border-b-[0.667px] border-l-0 border-r-0 border-solid border-t-0 pb-[0.667px] pt-4 px-3 sm:px-6">
        <div className="min-h-[36px] relative w-full flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Back to CRM Button */}
          <button
            onClick={() => {
              if (isInlineDealsMode) {
                dispatchDealsInlineNavigate("leads");
              } else {
                router.push("/leads?tab=leads");
              }
            }}
            className="h-[32px] shrink-0 rounded-[6px] flex items-center gap-2 px-[10px] hover:bg-[rgba(0,255,255,0.05)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
            <span className="text-[12px] font-bold text-white leading-[16px] hidden sm:inline">
              Back to CRM
            </span>
          </button>

          {/* Divider */}
          <div className="hidden sm:block bg-[rgba(0,255,255,0.2)] h-[20px] w-px shrink-0" />

          {/* All Pages Dropdown */}
          <Select defaultValue="all">
            <SelectTrigger className="h-[36px] w-full sm:w-[224px] shrink-0 bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] border-[0.667px] rounded-[6px] px-[12.667px] text-[12px] text-[rgba(0,255,255,0.6)] hover:bg-[rgba(0,0,0,0.4)]">
              <SelectValue>
                <span className="text-[12px] text-[rgba(0,255,255,0.6)]">All Pages</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#0A0E27] border-[rgba(0,255,255,0.2)]">
              <SelectItem value="all" className="text-[rgba(0,255,255,0.6)]">All Pages</SelectItem>
            </SelectContent>
          </Select>

          {/* All Forms Dropdown */}
          <Select defaultValue="all">
            <SelectTrigger className="h-[36px] w-full sm:w-[224px] shrink-0 bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] border-[0.667px] rounded-[6px] px-[12.667px] text-[12px] text-white hover:bg-[rgba(0,0,0,0.4)]">
              <SelectValue>
                <span className="text-[12px] text-white">All Forms</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#0A0E27] border-[rgba(0,255,255,0.2)]">
              <SelectItem value="all" className="text-white">All Forms</SelectItem>
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-0 w-full sm:max-w-[384px]">
            <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[rgba(0,255,255,0.6)]" />
            <Input
              placeholder="Search Facebook leads..."
              className="h-[32px] pl-[32px] pr-[12px] bg-[rgba(255,255,255,0.03)] border-0 rounded-[6px] text-[14px] text-[rgba(0,255,255,0.6)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:ring-0 focus-visible:outline-none"
            />
          </div>

          {/* Divider */}
          <div className="hidden sm:block bg-[rgba(0,255,255,0.2)] h-[20px] w-px shrink-0" />

          {/* Sync Button */}
          <Button
            className="h-[32px] px-[10px] shrink-0 rounded-[6px] bg-transparent border-[rgba(0,255,255,0.2)] border-[0.667px] text-white text-[12px] font-bold hover:bg-[rgba(0,255,255,0.05)] shadow-none"
          >
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          {/* Export to CRM Button */}
          <Button
            disabled
            className="h-[32px] px-[10px] shrink-0 rounded-[6px] bg-transparent border-[rgba(0,255,255,0.2)] border-[0.667px] text-white text-[12px] font-bold opacity-50 cursor-not-allowed shadow-none"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export to CRM (0)</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "0.53rem" }} className={`relative z-50 ${resolvedTheme === "dark"
      ? "bg-[rgba(26,26,26,0.6)] border-[#3a3a3a]"
      : resolvedTheme === "color"
        ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
        : "bg-[rgba(255,255,255,0.6)] border-[#e5e7eb]"
      } border-b border-b-[0.667px] pt-3 pb-3 px-3 sm:px-6`}>
      <div className="flex items-center justify-between min-h-11 gap-2">
        {/* Left Section: Title/Subtitle */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Title and Subtitle */}
          <div className="flex flex-col items-start flex-1 min-w-0">
            <h1 className={`text-base sm:text-[20px] leading-tight sm:leading-[28px] font-bold truncate max-w-full ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
              }`}>
              {getPageTitle()}
            </h1>
            <p className={`text-[11px] sm:text-[12px] leading-[16px] font-normal truncate max-w-full ${resolvedTheme === "dark" ? "text-[#9ca3af]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280]"
              }`}>
              {getPageSubtitle()}
            </p>
          </div>
        </div>

        {/* Right Section: Theme Toggle + Notifications */}
        <div className="relative h-9 w-20 shrink-0">
          {/* Theme Toggle Button */}
          <button
            type="button"
            className="absolute left-0 top-0 w-9 h-9 rounded-[6px] flex items-center justify-center hover:bg-muted/50 transition-colors"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {mounted ? (
              theme === "color" ? (
                <Star className="h-4 w-4 text-[#00ffff]" />
              ) : (
                <Moon className="h-4 w-4 text-[#e5e5e5]" />
              )
            ) : (
              <Moon className="h-4 w-4 text-[#e5e5e5]" />
            )}
          </button>

          {/* Notifications Button */}
          <DropdownMenu open={isAuditDropdownOpen} onOpenChange={handleAuditDropdownOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="absolute left-11 top-0 w-9 h-9 rounded-[6px] flex items-center justify-center hover:bg-muted/50 transition-colors"
                aria-label="View notifications"
              >
                <Bell className={`h-4 w-4 ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#4b5563]"
                  }`} />
                {(unreadAuditCount + unreadLeadNotificationCount) > 0 && (
                  <div className={`absolute ${resolvedTheme === "dark" ? "bg-[#8b7aff]" : "bg-[#7b68ee]"
                    } border-[0.667px] border-transparent rounded-full w-4 h-4 flex items-center justify-center -top-1 left-6 overflow-clip`}>
                    <span className="text-[10px] leading-[14.286px] font-bold text-white text-center">
                      {(unreadAuditCount + unreadLeadNotificationCount) > 99 ? "99+" : (unreadAuditCount + unreadLeadNotificationCount)}
                    </span>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 overflow-visible">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <span className="text-sm font-semibold text-gray-700">Notifications</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    fetchAuditLogs(true);
                    refreshLeadNotifications();
                  }}
                  aria-label="Refresh activity"
                >
                  <RotateCcw className={`h-4 w-4 text-gray-500 ${isLoadingAuditLogs ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="max-h-72 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {/* Lead Notifications Section */}
                {leadNotifications.length > 0 && (
                  <>
                    {leadNotifications.slice(0, 10).map((notification) => (
                      <div
                        key={notification.id}
                        className={`px-3 py-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${!notification.read ? 'bg-blue-50/50' : ''}`}
                        onClick={() => {
                          if (notification.leadId) {
                            markNotificationsAsRead([notification.id]);
                            window.location.href = `/leads/${notification.leadId}`;
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Facebook className="h-3 w-3 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {notification.type === 'facebook_lead' ? 'Facebook Lead' : 'New Lead'}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {notification.leadName}
                              </p>
                              {notification.estimatedValue && (
                                <p className="text-xs text-green-600 mt-0.5">
                                  ₹{notification.estimatedValue.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-2 ml-8">{formatRelativeTime(notification.timestamp)}</p>
                      </div>
                    ))}
                    {auditLogs.length > 0 && (
                      <div className="px-3 py-2 bg-gray-50 border-b">
                        <span className="text-xs font-semibold text-gray-500">Activity Logs</span>
                      </div>
                    )}
                  </>
                )}

                {/* Audit Logs Section */}
                {isLoadingAuditLogs ? (
                  <div className="flex flex-col items-center justify-center py-6 text-sm text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin mb-2 text-gray-400" />
                    Loading...
                  </div>
                ) : auditError ? (
                  <div className="py-6 text-sm text-red-500 text-center px-4">{auditError}</div>
                ) : auditLogs.length === 0 && leadNotifications.length === 0 ? (
                  <div className="py-6 text-sm text-gray-500 text-center px-4">No recent activity.</div>
                ) : (
                  auditLogs.map((log) => {
                    const activityTime = log.createdAt || log.timestamp;
                    return (
                      <div key={log._id} className="px-3 py-3 border-b last:border-b-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {toTitleCase(log.action || "Activity")}
                              {log.app ? <span className="text-blue-500"> - {toTitleCase(log.app)}</span> : <span className="text-blue-500"> - Deals</span>}
                              {log.entityType ? <span className="text-gray-500"> - {toTitleCase(log.entityType)}</span> : null}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatAuditNotification(log, usersMap)}
                            </p>
                            {log.userName && (
                              <p className="text-[11px] text-gray-400 mt-1">
                                {log.userName}
                                 {log.userEmail ? ` - ${log.userEmail}` : ""}
                              </p>
                            )}
                          </div>
                          <Clock className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-2">{formatRelativeTime(activityTime)}</p>
                      </div>
                    );
                  })
                )}

                {auditHasMore && !isLoadingAuditLogs && !auditError && (
                  <div className="px-3 py-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      disabled={isFetchingMoreAudit}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLoadMoreAuditLogs();
                      }}
                    >
                      {isFetchingMoreAudit ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading...
                        </span>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded-lg">
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {userData ? (userData.name || userData.firstName || 'U').charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-sm">
                  <div className="font-medium">{userData ? (userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User') : 'User'}</div>
                  <div className="text-gray-500">{userData ? (userData.email || 'user@example.com') : 'user@example.com'}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> */}
        </div>
      </div>

      {/* Add Lead Dialog */}
      <Dialog
        open={isAddLeadOpen}
        onOpenChange={(open) => {
          setIsAddLeadOpen(open);
          if (!open) {
            resetLeadForm();
            setIsContactComboOpen(false);
            setIsCompanyComboOpen(false);
            setIsOwnerComboOpen(false);
          } else {
            setContactSearchTerm("");
            setCompanySearchTerm("");
            setOwnerSearchTerm("");
          }
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Create a new lead opportunity in your sales pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 py-4">
            {/* Left Column */}
            <div className="space-y-4 min-w-0">
              <div className="space-y-2">
                <Label htmlFor="lead-name">
                  Lead Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lead-name"
                  placeholder="Deal or project name"
                  value={leadForm.leadName}
                  onChange={(e) => setLeadForm({ ...leadForm, leadName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-person">
                  Contact Person <span className="text-red-500">*</span>
                </Label>
                <Popover open={isContactComboOpen} onOpenChange={setIsContactComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isContactComboOpen}
                      className={`w-full min-w-0 justify-between gap-2 ${contactError ? "border-red-500" : ""}`}
                    >
                      <span className="truncate text-left">
                        {selectedContactOption?.name || "Select contact..."}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search contacts..."
                        value={contactSearchTerm}
                        onValueChange={setContactSearchTerm}
                      />
                      <CommandList className="max-h-60 overflow-auto">
                        {isContactsLoading && (
                          <CommandEmpty>
                            <span className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {isSearchingContacts ? "Searching contacts..." : "Loading contacts..."}
                            </span>
                          </CommandEmpty>
                        )}
                        {!isContactsLoading && (
                          <CommandGroup heading="Add or select" className="border-b border-gray-200 dark:border-gray-700">
                            <CommandItem
                              value="__add_new_contact__"
                              onSelect={() => {
                                setIsContactComboOpen(false);
                                setIsAddContactDialogOpen(true);
                                const nameParts = contactSearchTerm.trim().split(" ");
                                setNewContactForm({
                                  firstName: nameParts[0] || "",
                                  lastName: nameParts.slice(1).join(" ") || "",
                                  email: "",
                                  phoneNumber: "",
                                });
                              }}
                              className="cursor-pointer text-primary hover:bg-primary/10"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              <span>Add New Contact</span>
                            </CommandItem>
                          </CommandGroup>
                        )}
                        {!isContactsLoading && contacts.length === 0 && (
                          <CommandEmpty>No contacts found.</CommandEmpty>
                        )}
                        {!isContactsLoading && contacts.length > 0 && (
                          <CommandGroup>
                            {contacts.map((contact) => {
                              const isSelected = contact.id === String(leadForm.contactId || "");
                              return (
                                <CommandItem
                                  key={contact.id}
                                  value={`${contact.name} ${contact.email} ${contact.companyName || ""}`.trim() || contact.id}
                                  onSelect={() => selectContactOption(contact)}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectContactOption(contact);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate">{contact.name}</span>
                                    <span className="text-xs text-muted-foreground truncate">
                                      {[contact.email, contact.companyName].filter(Boolean).join(" | ") || " "}
                                    </span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {contactError && <p className="text-sm text-red-600">{contactError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="e.g. 8076034219, +918076034219"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Add multiple numbers separated by comma, semicolon, or new line.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initial-stage">Initial Stage</Label>
                <Select
                  value={leadForm.initialStage}
                  onValueChange={(value) => setLeadForm({ ...leadForm, initialStage: value })}
                  disabled={!leadForm.salesFunnelId || isLoadingStages || funnelStages.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingStages ? "Loading stages..." : leadForm.salesFunnelId ? "Select stage" : "Select sales funnel first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {funnelStages.length > 0 ? (
                      funnelStages.map((stage, index) => (
                        <SelectItem key={index} value={stage.name || stage.value}>
                          {stage.name || stage.value}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="Prospects" disabled>No stages available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={leadForm.source}
                  onValueChange={(value) => setLeadForm({ ...leadForm, source: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this lead"
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  rows={4}
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4 min-w-0">
              <div className="space-y-2">
                <Label htmlFor="company">
                  Company <span className="text-red-500">*</span>
                </Label>
                <Popover open={isCompanyComboOpen} onOpenChange={setIsCompanyComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCompanyComboOpen}
                      className="w-full min-w-0 justify-between gap-2"
                    >
                      <span className="truncate text-left">
                        {selectedCompanyOption?.name || "Select company..."}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search companies..."
                        value={companySearchTerm}
                        onValueChange={setCompanySearchTerm}
                      />
                      <CommandList className="max-h-60 overflow-auto">
                        {isCompaniesLoading && (
                          <CommandEmpty>
                            <span className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {isSearchingCompanies ? "Searching companies..." : "Loading companies..."}
                            </span>
                          </CommandEmpty>
                        )}
                        {!isCompaniesLoading && (
                          <CommandGroup heading="Add or select" className="border-b border-gray-200 dark:border-gray-700">
                            <CommandItem
                              value="__add_new_company__"
                              onSelect={() => {
                                setIsCompanyComboOpen(false);
                                setIsAddCompanyDialogOpen(true);
                                setNewCompanyForm({
                                  companyName: companySearchTerm,
                                  industry: "",
                                  revenue: "",
                                  website: "",
                                  address: "",
                                });
                              }}
                              className="cursor-pointer text-primary hover:bg-primary/10"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              <span>Add New Company</span>
                            </CommandItem>
                          </CommandGroup>
                        )}
                        {!isCompaniesLoading && companies.length === 0 && (
                          <CommandEmpty>No companies found.</CommandEmpty>
                        )}
                        {!isCompaniesLoading && companies.length > 0 && (
                          <CommandGroup>
                            {companies.map((company) => {
                              const isSelected = company.id === String(leadForm.companyId || "");
                              return (
                                <CommandItem
                                  key={company.id}
                                  value={`${company.name} ${company.industry || ""}`.trim() || company.id}
                                  onSelect={() => selectCompanyOption(company)}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectCompanyOption(company);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate">{company.name}</span>
                                    {company.industry ? (
                                      <span className="text-xs text-muted-foreground truncate">{company.industry}</span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">&nbsp;</span>
                                    )}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@company.com"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-funnel">
                  Sales Funnel <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={leadForm.salesFunnelId}
                  onValueChange={async (value) => {
                    setLeadForm({ ...leadForm, salesFunnelId: value });
                    await fetchFunnelStages(value);
                  }}
                  disabled={isLoadingStages}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sales funnel" />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels.map((funnel) => (
                      <SelectItem key={funnel._id || funnel.id} value={funnel._id || funnel.id}>
                        {funnel.funnelName || funnel.name || "Unknown Funnel"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated-value">Estimated Value</Label>
                <Input
                  id="estimated-value"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={leadForm.estimatedValue}
                  onChange={(e) => setLeadForm({ ...leadForm, estimatedValue: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned-to">Assign to / Owner</Label>
                <Popover open={isOwnerComboOpen} onOpenChange={setIsOwnerComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isOwnerComboOpen}
                      className="w-full min-w-0 justify-between gap-2"
                    >
                      <span className="truncate text-left">
                        {selectedOwnerOption?.name || "Select owner..."}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search owners..."
                        value={ownerSearchTerm}
                        onValueChange={setOwnerSearchTerm}
                      />
                      <CommandList className="max-h-60 overflow-auto">
                        {isOwnersLoading && (
                          <CommandEmpty>
                            <span className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading owners...
                            </span>
                          </CommandEmpty>
                        )}
                        {!isOwnersLoading && owners.length === 0 && (
                          <CommandEmpty>No owners found.</CommandEmpty>
                        )}
                        {!isOwnersLoading && owners.length > 0 && (
                          <CommandGroup>
                            {owners.map((owner) => {
                              const isSelected = owner.id === String(leadForm.assignedTo || "");
                              return (
                                <CommandItem
                                  key={owner.id}
                                  value={`${owner.name} ${owner.email || ""}`.trim() || owner.id}
                                  onSelect={() => selectOwnerOption(owner)}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectOwnerOption(owner);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate">{owner.name}</span>
                                    {owner.email ? (
                                      <span className="text-xs text-muted-foreground truncate">{owner.email}</span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">&nbsp;</span>
                                    )}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={leadForm.priority}
                  onValueChange={(value) => setLeadForm({ ...leadForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="next-follow-up">Next Follow Up</Label>
                <Input
                  id="next-follow-up"
                  type="date"
                  min={(() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return tomorrow.toISOString().split('T')[0];
                  })()}
                  value={leadForm.nextFollowUp}
                  onChange={(e) => setLeadForm({ ...leadForm, nextFollowUp: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated-close">Estimated Close</Label>
                <Input
                  id="estimated-close"
                  type="date"
                  min={(() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return tomorrow.toISOString().split('T')[0];
                  })()}
                  value={leadForm.estimatedClose}
                  onChange={(e) => setLeadForm({ ...leadForm, estimatedClose: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddLeadOpen(false);
                resetLeadForm();
              }}
              disabled={isSubmittingLead}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddLead}
              disabled={isSubmittingLead}
              className="bg-[#8b7aff] hover:bg-[#7b6aee] text-white"
            >
              {isSubmittingLead ? "Adding..." : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Add a new product or service to your CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={productForm.type} onValueChange={(v: any) => setProductForm({ ...productForm, type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="e.g., CRM Enterprise" />
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input value={productForm.code} onChange={(e) => setProductForm({ ...productForm, code: e.target.value })} placeholder="e.g., CRM-ENT" />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="e.g., Software" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || !isNaN(parseFloat(value))) {
                      setProductForm({ ...productForm, price: value });
                    }
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Select value={productForm.unit} onValueChange={(v: any) => setProductForm({ ...productForm, unit: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="per-unit">Per Unit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={productForm.status} onValueChange={(v: any) => setProductForm({ ...productForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pause">Pause</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Enter a detailed description..." />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddProductOpen(false);
                resetProductForm();
              }}
              disabled={isSubmittingProduct}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={isSubmittingProduct}
              className="bg-[#8b7aff] hover:bg-[#7b6aee] text-white"
            >
              {isSubmittingProduct ? "Adding..." : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Add a new contact person to your CRM database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4 min-w-0">
                <div className="space-y-2">
                  <Label htmlFor="add-name">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="add-name"
                    placeholder="Full name"
                    value={contactForm.name}
                    onChange={(e) => {
                      setContactForm({ ...contactForm, name: e.target.value });
                      if (contactNameError) setContactNameError("");
                    }}
                    className={contactNameError ? "border-red-500" : ""}
                  />
                  {contactNameError && (
                    <p className="text-sm text-red-500">{contactNameError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="add-email"
                    type="email"
                    placeholder="email@company.com"
                    value={contactForm.email}
                    onChange={(e) => {
                      setContactForm({ ...contactForm, email: e.target.value });
                      if (contactEmailError) setContactEmailError("");
                    }}
                    className={contactEmailError ? "border-red-500" : ""}
                  />
                  {contactEmailError && (
                    <p className="text-sm text-red-500">{contactEmailError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-company">Company</Label>
                  <Select
                    value={contactForm.company}
                    onValueChange={(value) =>
                      setContactForm({ ...contactForm, company: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingContactCompanies
                            ? "Loading companies..."
                            : "Company name"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingContactCompanies ? (
                        <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                          Loading companies...
                        </div>
                      ) : contactCompanies.length > 0 ? (
                        contactCompanies.map((company) => (
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
                  <Label htmlFor="add-role">Role</Label>
                  <Select
                    value={contactForm.role || undefined}
                    onValueChange={(value) => {
                      if (value === "Other") {
                        openCustomRoleDialog("add");
                      } else {
                        ensureRoleOption(value);
                        setContactForm({ ...contactForm, role: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-phone">Phone</Label>
                  <Input
                    id="add-phone"
                    type="tel"
                    placeholder="Phone number"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddContactOpen(false);
                  resetContactForm();
                }}
                disabled={isSubmittingContact}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddContact}
                disabled={isSubmittingContact}
                className="bg-yellow-500 text-black hover:bg-yellow-600"
              >
                {isSubmittingContact ? "Adding..." : "Add Contact"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCustomRoleDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseCustomRoleDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
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
            <Button onClick={handleCustomRoleSubmit} className="bg-yellow-500 text-black hover:bg-yellow-600">
              Save Role
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Add Company Dialog */}
      <Dialog
        open={isAddCompanyDialogOpen}
        onOpenChange={(open) => {
          if (isCreatingCompany) return;
          setIsAddCompanyDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
            <DialogDescription>
              Create a new company to associate with this lead.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inline-company-name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="inline-company-name"
                placeholder="Enter company name"
                value={newCompanyForm.companyName}
                onChange={(e) =>
                  setNewCompanyForm({ ...newCompanyForm, companyName: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inline-company-industry">Industry</Label>
              <Input
                id="inline-company-industry"
                placeholder="e.g., Technology, Finance"
                value={newCompanyForm.industry}
                onChange={(e) =>
                  setNewCompanyForm({ ...newCompanyForm, industry: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inline-company-revenue">Revenue</Label>
              <Input
                id="inline-company-revenue"
                placeholder="Enter revenue"
                value={newCompanyForm.revenue}
                onChange={(e) =>
                  setNewCompanyForm({ ...newCompanyForm, revenue: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inline-company-website">Website</Label>
              <Input
                id="inline-company-website"
                placeholder="https://example.com"
                value={newCompanyForm.website}
                onChange={(e) =>
                  setNewCompanyForm({ ...newCompanyForm, website: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inline-company-address">Address</Label>
              <Input
                id="inline-company-address"
                placeholder="Company address"
                value={newCompanyForm.address}
                onChange={(e) =>
                  setNewCompanyForm({ ...newCompanyForm, address: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddCompanyDialogOpen(false);
                setNewCompanyForm({
                  companyName: "",
                  industry: "",
                  revenue: "",
                  website: "",
                  address: "",
                });
              }}
              disabled={isCreatingCompany}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCompanyFromDialog}
              disabled={isCreatingCompany || !newCompanyForm.companyName.trim()}
              className="bg-[#8b7aff] hover:bg-[#7b6aee] text-white"
            >
              {isCreatingCompany ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Add Contact Dialog */}
      <Dialog
        open={isAddContactDialogOpen}
        onOpenChange={(open) => {
          if (isCreatingContact) return;
          setIsAddContactDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Create a new contact to associate with this lead.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inline-contact-firstname">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="inline-contact-firstname"
                  placeholder="First name"
                  value={newContactForm.firstName}
                  onChange={(e) =>
                    setNewContactForm({ ...newContactForm, firstName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inline-contact-lastname">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="inline-contact-lastname"
                  placeholder="Last name"
                  value={newContactForm.lastName}
                  onChange={(e) =>
                    setNewContactForm({ ...newContactForm, lastName: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inline-contact-email">Email</Label>
              <Input
                id="inline-contact-email"
                type="email"
                placeholder="email@example.com"
                value={newContactForm.email}
                onChange={(e) =>
                  setNewContactForm({ ...newContactForm, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inline-contact-phone">Phone Number</Label>
              <Input
                id="inline-contact-phone"
                placeholder="+1234567890"
                value={newContactForm.phoneNumber}
                onChange={(e) =>
                  setNewContactForm({ ...newContactForm, phoneNumber: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddContactDialogOpen(false);
                setNewContactForm({
                  firstName: "",
                  lastName: "",
                  email: "",
                  phoneNumber: "",
                });
              }}
              disabled={isCreatingContact}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateContactFromDialog}
              disabled={isCreatingContact || !newContactForm.firstName.trim() || !newContactForm.lastName.trim()}
              className="bg-[#8b7aff] hover:bg-[#7b6aee] text-white"
            >
              {isCreatingContact ? "Creating..." : "Create Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DealsNavbar({
  forceStandardOnFacebook = false,
}: {
  forceStandardOnFacebook?: boolean;
}) {
  return (
    <div className="deals-navbar-root">
      <Suspense fallback={
      <div className="border-b border-b-[0.667px] pt-3 pb-3 px-3 sm:px-6">
        <div className="flex items-center justify-between h-11">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex flex-col items-start flex-1 min-w-0">
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
            </div>
          </div>
        </div>
      </div>
    }>
        <DealsNavbarContent forceStandardOnFacebook={forceStandardOnFacebook} />
      </Suspense>
    </div>
  );
}
