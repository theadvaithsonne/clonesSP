"use client";
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
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Download,
    Upload,
    Plus,
    MoreHorizontal,
    Filter,
    ChevronDown,
    Eye,
    User,
    Calendar as CalendarIcon,
    FileText,
    ChevronLeft,
    ChevronRight,
    Pencil,
    Trash,
    Trash2,
    Check,
    CheckCircle2,
    ChevronsUpDown,
    Loader2,
    FileSpreadsheet,
    Info,
    Mail,
    MessageSquare,
    RefreshCw,
    X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, Fragment, type ReactNode, type WheelEvent } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { useRouter, useSearchParams } from "next/navigation";
import CRMSidebar from "@/components/crm/CRMSidebar";
import DealsNavbar from "@/components/crm/DealsNavbar";
import { buildExternalUrl } from "@/lib/api-config";
import { getTeamMembers } from "@/lib/feed-api";
import { DEALS_CRM_STATS_REFRESH_EVENT, DEALS_LEADS_REFRESH_EVENT, openDealsLeadInline, useDealsInlineRefresh } from "@/lib/deals-events";
import { LeadsDataTable } from "@/components/deals/leads/LeadsDataTable";
import type { SortState } from "@/components/ui/data-table/types";
import { buildFollowUpSchedule } from "@/lib/crm/followUpSchedule";
import { FOLLOW_UP_TASK_DEFAULTS } from "@/lib/crm/isFollowUpTask";
import { authenticatedFetch } from "@/utils/api";
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import Cookies from "js-cookie";
import * as XLSX from "xlsx";
import { Country, State } from "country-state-city";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import BulkUploadLeadsFlow from "@/components/crm/leads/BulkUploadLeadsFlow";
import DeleteLeadsDialog from "@/components/crm/leads/DeleteLeadsDialog";
import LeadContactQuickActions from "@/components/crm/LeadContactQuickActions";
import { useTheme } from "next-themes";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import { jwtDecode } from 'jwt-decode'
// Dynamically import Facebook integration to avoid SSR issues
const FacebookLeadsIntegration = dynamic(
    () => import("../facebook/facebookintegration"),
    { ssr: false }
);
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

interface CSVLead {
    firstName: string;
    lastName: string;
    email: string;
    leadName?: string;
    phoneNumber?: string;
    dob?: string;
    companyName?: string;
    industry?: string;
    website?: string;
    address?: string;
    country?: string;
    state?: string;
    city?: string;
    pinCode?: string;
    productName?: string;
    quantity?: string;
    pricing?: string;
    negotiatedPricing?: string;
    MaxDiscPrice?: string;
    salesFunnel?: string;
    stage?: string;
    estRevenue?: string;
    assignedTo?: string;
    notes?: string;
}

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

interface OwnerOption {
    id: string;
    name: string;
    email?: string;
    raw: any;
    _id?: string;
    userId?: string;
    firstName?: string;
    lastName?: string;
}

interface ExternalSheetRow {
    row: Record<string, string>;
    index: number;
}

const deriveLeadName = (lead: Partial<CSVLead>): string => {
    const first = lead.firstName?.trim() ?? "";
    const last = lead.lastName?.trim() ?? "";
    const combined = `${first} ${last}`.replace(/\s+/g, " ").trim();
    if (combined) {
        return combined;
    }
    const existing = lead.leadName?.trim();
    if (existing) {
        return existing;
    }
    return first || last || "";
};

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
        _id: String(id),
        userId: owner?.userId ? String(owner.userId) : String(id),
        firstName: owner?.firstName || "",
        lastName: owner?.lastName || "",
    };
};

/** API may return stage as a string or as an object ({ name, value, stageName, ... }). Always coerce to string for forms and comparisons. */
function normalizeLeadStageValue(stage: unknown): string {
    if (stage == null) return "";
    if (typeof stage === "string") return stage.trim();
    if (typeof stage === "object" && !Array.isArray(stage)) {
        const o = stage as Record<string, unknown>;
        const pick = o.name ?? o.stageName ?? o.value ?? o.stage;
        if (typeof pick === "string") return pick.trim();
        if (pick != null) return String(pick).trim();
    }
    return "";
}

const splitMultiParam = (value: string): string[] => {
    if (!value || value === "all") return [];
    return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
};

const LEADS_FILTER_STORAGE_KEY = "deals-leads-filters-v1";

function LeadTagsSeeAll({
    figma,
    themeClassName,
    children,
}: {
    figma: boolean;
    themeClassName: string;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCloseTimer = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };

    const openNow = () => {
        clearCloseTimer();
        setOpen(true);
    };

    const scheduleClose = () => {
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => setOpen(false), 150);
    };

    return (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-lead-tags-see-all
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseEnter={openNow}
                    onMouseLeave={scheduleClose}
                    className={
                        figma
                            ? "px-2 py-0.5 rounded-[999px] text-[10px] font-semibold leading-[14px] text-white whitespace-nowrap bg-[#3a3a3a] hover:bg-[#4a4a4a]"
                            : themeClassName
                    }
                >
                    see all
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="start"
                sideOffset={6}
                collisionPadding={8}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={openNow}
                onMouseLeave={scheduleClose}
                className="w-auto max-w-[320px] p-2 border-[#3a3a3a] bg-[#1a1a1a] text-white"
            >
                <div className="flex flex-wrap gap-1">{children}</div>
            </PopoverContent>
        </Popover>
    );
}

type PersistedLeadsFilters = {
    searchTerm: string;
    selectedStage: string;
    selectedOwner: string;
    selectedLeadStatus: string;
    selectedFunnel: string;
    selectedTags: string[];
    dateFrom: string;
    dateTo: string;
    currentPage: number;
};

const getPersistedLeadsFilters = (): PersistedLeadsFilters | null => {
    if (typeof window === "undefined") return null;

    try {
        const raw = window.sessionStorage.getItem(LEADS_FILTER_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PersistedLeadsFilters>;

        return {
            searchTerm: typeof parsed.searchTerm === "string" ? parsed.searchTerm : "",
            selectedStage: typeof parsed.selectedStage === "string" ? parsed.selectedStage : "all",
            selectedOwner: typeof parsed.selectedOwner === "string" ? parsed.selectedOwner : "all",
            selectedLeadStatus:
                typeof parsed.selectedLeadStatus === "string" ? parsed.selectedLeadStatus : "all",
            selectedFunnel: typeof parsed.selectedFunnel === "string" ? parsed.selectedFunnel : "all",
            selectedTags: Array.isArray(parsed.selectedTags)
                ? parsed.selectedTags.filter((tag): tag is string => typeof tag === "string")
                : [],
            dateFrom: typeof parsed.dateFrom === "string" ? parsed.dateFrom : "",
            dateTo: typeof parsed.dateTo === "string" ? parsed.dateTo : "",
            currentPage:
                typeof parsed.currentPage === "number" && Number.isFinite(parsed.currentPage) && parsed.currentPage > 0
                    ? parsed.currentPage
                    : 1,
        };
    } catch {
        return null;
    }
};

function LeadsPageContent() {
    console.log("!!! SMOKE TEST - LEADS PAGE MOUNTED !!!");
    const router = useRouter();
    const { theme } = useTheme();
    const isInlineDealsMode =
        typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
    const isFigmaInlineDealsDesign = isInlineDealsMode;
    const resolvedTheme =
        theme === "color" ? "color" : theme === "dark" || isInlineDealsMode ? "dark" : "light";

    const searchParams = useSearchParams();
    const persistedFilters = useMemo(() => getPersistedLeadsFilters(), []);
    const [inlineActiveTab, setInlineActiveTab] = useState<"leads" | "facebook-leads">("leads");

    // State for real data
    const [leads, setLeads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(() => {
        if (isInlineDealsMode) return persistedFilters?.searchTerm || "";
        const search = searchParams.get("search");
        if (search !== null) return search;
        return persistedFilters?.searchTerm || "";
    });
    const [selectedStage, setSelectedStage] = useState(() => {
        if (isInlineDealsMode) return persistedFilters?.selectedStage || "all";
        const stage = searchParams.get("stage");
        if (stage !== null) return stage;
        return persistedFilters?.selectedStage || "all";
    });
    const [selectedOwner, setSelectedOwner] = useState(() => {
        if (isInlineDealsMode) return persistedFilters?.selectedOwner || "all";
        const ownerName = searchParams.get("ownerName");
        if (ownerName !== null) return ownerName;
        return persistedFilters?.selectedOwner || "all";
    });
    const [selectedLeadStatus, setSelectedLeadStatus] = useState<string>(() => {
        if (isInlineDealsMode) return persistedFilters?.selectedLeadStatus || "all";
        const leadStatus = searchParams.get("leadStatus");
        if (leadStatus !== null) return leadStatus;
        return persistedFilters?.selectedLeadStatus || "all";
    });
    const [dateFrom, setDateFrom] = useState(() => {
        if (isInlineDealsMode) return persistedFilters?.dateFrom || "";
        const from = searchParams.get("dateFrom");
        if (from !== null) return from;
        return persistedFilters?.dateFrom || "";
    });
    const [dateTo, setDateTo] = useState(() => {
        if (isInlineDealsMode) return persistedFilters?.dateTo || "";
        const to = searchParams.get("dateTo");
        if (to !== null) return to;
        return persistedFilters?.dateTo || "";
    });
    const [selectedTags, setSelectedTags] = useState<string[]>(() => {
        if (isInlineDealsMode) return persistedFilters?.selectedTags || [];
        const tags = searchParams.get("tags");
        if (tags !== null) return tags ? tags.split(",") : [];
        return persistedFilters?.selectedTags || [];
    });
    const [selectedFunnel, setSelectedFunnel] = useState(() => {
        if (isInlineDealsMode) return persistedFilters?.selectedFunnel || "all";
        const funnel = searchParams.get("salesFunnel");
        if (funnel !== null) return funnel;
        return persistedFilters?.selectedFunnel || "all";
    });

    // Filter dialog state
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
    const [filterSelectedStages, setFilterSelectedStages] = useState<string[]>(["all"]);
    const [filterSelectedOwners, setFilterSelectedOwners] = useState<string[]>(["all"]);
    const [filterSelectedFunnels, setFilterSelectedFunnels] = useState<string[]>(["all"]);
    const [filterSelectedTags, setFilterSelectedTags] = useState<string[]>([]);
    const [availableFilterStages, setAvailableFilterStages] = useState<string[]>([]);
    const [availableFilterOwners, setAvailableFilterOwners] = useState<Array<{ id: string; name: string }>>([]);
    const [availableFilterFunnels, setAvailableFilterFunnels] = useState<Array<{ id: string; name: string }>>([]);
    const [availableFilterTags, setAvailableFilterTags] = useState<string[]>([]);
    const [isLoadingFilterTags, setIsLoadingFilterTags] = useState(false);
    const [filterStageSearchTerm, setFilterStageSearchTerm] = useState("");
    const [filterOwnerSearchTerm, setFilterOwnerSearchTerm] = useState("");
    const [filterFunnelSearchTerm, setFilterFunnelSearchTerm] = useState("");
    const [filterTagSearchTerm, setFilterTagSearchTerm] = useState("");
    type FigmaFilterCategory = "stage" | "owner" | "date" | "tags" | "funnel";
    const [activeFilterCategory, setActiveFilterCategory] = useState<FigmaFilterCategory>("stage");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterCalendarMonth, setFilterCalendarMonth] = useState<Date>(() => new Date());
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [selectedLeadsCache, setSelectedLeadsCache] = useState<Record<string, any>>({});
    const [isExportingLeads, setIsExportingLeads] = useState(false);
    const [isRefreshingLeads, setIsRefreshingLeads] = useState(false);
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Activity Log (today)
    const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
    const [isLoadingActivityLog, setIsLoadingActivityLog] = useState(false);
    const [activityLogData, setActivityLogData] = useState<any>(null);
    const [activityLogError, setActivityLogError] = useState<string>("");
    const [activityLogStartDate, setActivityLogStartDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [activityLogEndDate, setActivityLogEndDate] = useState(() => new Date().toISOString().split("T")[0]);
    const isSearchInitializedRef = useRef(false);
    const isUrlStateInitializedRef = useRef(false);
    const fetchAbortControllerRef = useRef<AbortController | null>(null);
    const activeTab: "leads" | "facebook-leads" = isInlineDealsMode
        ? inlineActiveTab
        : searchParams.get("tab") === "facebook-leads"
            ? "facebook-leads"
            : "leads";

    const setActiveTab = useCallback(
        (next: "leads" | "facebook-leads") => {
            if (isInlineDealsMode) {
                setInlineActiveTab(next);
                return;
            }
            const params = new URLSearchParams(searchParams.toString());
            if (next === "facebook-leads") {
                params.set("tab", "facebook-leads");
            } else {
                params.delete("tab");
            }
            const qs = params.toString();
            router.replace(qs ? `?${qs}` : "?", { scroll: false });
        },
        [isInlineDealsMode, router, searchParams]
    );

    // Drag scroll state
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStateRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    // Update scroll button states
    const updateScrollButtons = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;

        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }, []);

    // Check scroll position on scroll and resize
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        updateScrollButtons();

        container.addEventListener('scroll', updateScrollButtons);
        window.addEventListener('resize', updateScrollButtons);

        return () => {
            container.removeEventListener('scroll', updateScrollButtons);
            window.removeEventListener('resize', updateScrollButtons);
        };
    }, [updateScrollButtons]);

    // Handle drag scroll with global mouse events
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragStateRef.current.isDown || !scrollContainerRef.current) {
                dragStateRef.current.isDown = false;
                setIsDragging(false);
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const x = e.clientX;
            const walk = (x - dragStateRef.current.startX) * 2;
            const newScrollLeft = dragStateRef.current.scrollLeft - walk;

            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = newScrollLeft;
                updateScrollButtons();
            }
        };

        const handleMouseUp = () => {
            dragStateRef.current.isDown = false;
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove, { passive: false, capture: true });
        document.addEventListener('mouseup', handleMouseUp, { capture: true });
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove, { capture: true });
            document.removeEventListener('mouseup', handleMouseUp, { capture: true });
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            dragStateRef.current.isDown = false;
        };
    }, [isDragging]);

    // Add Lead Modal State
    const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
    const [isSubmittingLead, setIsSubmittingLead] = useState(false);
    const initialLeadFormState = {
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
        followUpIntervalDays: "",
        autoFollowUpEndDate: "",
        estimatedClose: "",
        tags: "",
        autoFollowUp: false,
        products: [] as any[],
    };

    const [leadForm, setLeadForm] = useState(() => ({ ...initialLeadFormState }));
    const [isAutoFollowUpConfigOpen, setIsAutoFollowUpConfigOpen] = useState(false);

    // Dropdown Data State
    const [contacts, setContacts] = useState<ContactOption[]>([]);
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [funnels, setFunnels] = useState<any[]>([]);
    const [isLoadingFunnels, setIsLoadingFunnels] = useState(false);
    const [owners, setOwners] = useState<OwnerOption[]>([]);
    const [leadStages, setLeadStages] = useState<string[]>([]);
    const [isLoadingLeadStages, setIsLoadingLeadStages] = useState(false);
    const [sources, setSources] = useState<string[]>(["Website", "Referral", "Cold Call", "LinkedIn", "Event", "Email Campaign", "Facebook Lead Ads", "Google Ads", "WhatsApp"]);
    const [isCustomSourceAdd, setIsCustomSourceAdd] = useState(false);
    const [customSourceAddValue, setCustomSourceAddValue] = useState("");
    const [funnelStages, setFunnelStages] = useState<any[]>([]);
    const [isLoadingStages, setIsLoadingStages] = useState(false);
    const [contactSearchTerm, setContactSearchTerm] = useState("");
    const [isSearchingContacts, setIsSearchingContacts] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState("");
    const [isProductComboOpen, setIsProductComboOpen] = useState(false);
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
    const [isContactsLoading, setIsContactsLoading] = useState(true);
    const [isCompaniesLoading, setIsCompaniesLoading] = useState(true);
    const [isOwnersLoading, setIsOwnersLoading] = useState(true);
    const [organizationId, setOrganizationId] = useState<string>("");

    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);

    useEffect(() => {
        const userData = localStorage.getItem("garage_tok")

        if (!userData) return;
        try {
            const parsedData = jwtDecode<JwtPayload>(userData)

            // const parsedData= jwtDecode<JwtPayload>(userData)
            setOrganizationId(parsedData.orgId || "");
        } catch (error) {
            console.error("Failed to parse user data for organizationId:", error);
            setOrganizationId("");
        }
    }, []);

    const loadOwners = useCallback(
        async (term?: string) => {
            const query = term?.trim() || "";
            const orgId =
                (typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null) ||
                organizationId ||
                "";
            if (!orgId) {
                setIsOwnersLoading(false);
                return;
            }
            try {
                setIsOwnersLoading(true);
                let list: any[] = [];
                try {
                    list = await getTeamMembers(orgId);
                } catch {
                    list = [];
                }
                if (!Array.isArray(list) || list.length === 0) {
                    const params = new URLSearchParams({
                        organizationId: orgId,
                        limit: "1000",
                    });
                    if (query.length > 0) params.set("search", query);
                    const response = await authenticatedFetch(
                        buildExternalUrl(`/crm/organization-users?${params.toString()}`),
                        { method: "GET" }
                    );
                    if (!response.ok) {
                        throw new Error("Failed to load owners");
                    }
                    const data = await response.json();
                    list = data?.users || data?.members || data?.data?.users || data?.data?.members || data?.data || data || [];
                }
                list = Array.isArray(list) ? list : [];
                if (query.length > 0) {
                    const q = query.toLowerCase();
                    list = list.filter((user: any) => {
                        const name = `${user?.name || ""} ${user?.firstName || ""} ${user?.lastName || ""} ${user?.email || ""}`.toLowerCase();
                        return name.includes(q);
                    });
                }

                const options = list.map(toOwnerOption).filter(Boolean) as OwnerOption[];

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
        const term = contactSearchTerm.trim();
        if (term.length === 0) {
            setIsSearchingContacts(false);
            setIsContactsLoading(true);
            (async () => {
                try {
                    const res = await authenticatedFetch(buildExternalUrl("/crm/contacts?skip=0&limit=50"), {
                        method: "GET",
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const list = data.contacts || data.data || data || [];
                        const options = (Array.isArray(list) ? list : []).map(toContactOption).filter(Boolean) as ContactOption[];
                        setContacts((prev) => {
                            if (!leadForm.contactId) return options;
                            const idStr = String(leadForm.contactId);
                            if (options.some((option) => option.id === idStr)) {
                                return options;
                            }
                            const existing = prev.find((option) => option.id === idStr);
                            return existing ? [existing, ...options] : options;
                        });
                        if (leadForm.contactId) {
                            const match = options.find((option) => option.id === String(leadForm.contactId));
                            if (match) {
                                setSelectedContactOption(match);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to reload contacts:", e);
                } finally {
                    setIsSearchingContacts(false);
                    setIsContactsLoading(false);
                }
            })();
            return;
        }

        setIsSearchingContacts(true);
        setIsContactsLoading(true);
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ q: term });
                const res = await authenticatedFetch(
                    buildExternalUrl(`/crm/searchcontact?${params.toString()}`),
                    {
                        method: "GET",
                        headers: { "Content-Type": "application/json" },
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    const searchResults = data.contacts || data || [];
                    const transformed = (Array.isArray(searchResults) ? searchResults : [])
                        .map(toContactOption)
                        .filter(Boolean) as ContactOption[];
                    setContacts(transformed);
                    if (leadForm.contactId) {
                        const match = transformed.find((option) => option.id === String(leadForm.contactId));
                        if (match) {
                            setSelectedContactOption(match);
                        }
                    }
                }
            } catch (error) {
                console.error("Error searching contacts:", error);
            } finally {
                setIsSearchingContacts(false);
                setIsContactsLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [authenticatedFetch, buildExternalUrl, contactSearchTerm]);

    useEffect(() => {
        const term = companySearchTerm.trim();
        if (term.length === 0) {
            setIsSearchingCompanies(false);
            setIsCompaniesLoading(true);
            (async () => {
                try {
                    const res = await authenticatedFetch(buildExternalUrl("/crm/companies?skip=0&limit=50"), {
                        method: "GET",
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const list = data.companies || data.data || data || [];
                        const options = (Array.isArray(list) ? list : []).map(toCompanyOption).filter(Boolean) as CompanyOption[];
                        setCompanies((prev) => {
                            if (!leadForm.companyId) return options;
                            const idStr = String(leadForm.companyId);
                            if (options.some((option) => option.id === idStr)) {
                                return options;
                            }
                            const existing = prev.find((option) => option.id === idStr);
                            return existing ? [existing, ...options] : options;
                        });
                        if (leadForm.companyId) {
                            const match = options.find((option) => option.id === String(leadForm.companyId));
                            if (match) {
                                setSelectedCompanyOption(match);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to reload companies:", e);
                } finally {
                    setIsSearchingCompanies(false);
                    setIsCompaniesLoading(false);
                }
            })();
            return;
        }

        setIsSearchingCompanies(true);
        setIsCompaniesLoading(true);
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ q: term });
                const res = await authenticatedFetch(
                    buildExternalUrl(`crm/searchcompany?${params.toString()}`),
                    { method: "GET" }
                );
                if (res.ok) {
                    const data = await res.json();
                    const searchResults = data.companies || data.data || data || [];
                    const options = (Array.isArray(searchResults) ? searchResults : [])
                        .map(toCompanyOption)
                        .filter(Boolean) as CompanyOption[];
                    setCompanies(options);
                    if (leadForm.companyId) {
                        const match = options.find((option) => option.id === String(leadForm.companyId));
                        if (match) {
                            setSelectedCompanyOption(match);
                        }
                    }
                }
            } catch (error) {
                console.error("Error searching companies:", error);
            } finally {
                setIsSearchingCompanies(false);
                setIsCompaniesLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [authenticatedFetch, buildExternalUrl, companySearchTerm]);

    useEffect(() => {
        if (!leadForm.assignedTo) {
            setSelectedOwnerOption(null);
            return;
        }
        const targetId = String(leadForm.assignedTo);
        const match = owners.find(
            (option) =>
                option.id === targetId ||
                (option._id && option._id === targetId) ||
                (option.userId && option.userId === targetId)
        );
        if (match) {
            setSelectedOwnerOption(match);
        }
    }, [owners, leadForm.assignedTo]);

    useEffect(() => {
        const term = ownerSearchTerm.trim();

        if (!organizationId && term.length === 0) {
            // Wait until organizationId is available before initial load
            return;
        }

        if (term.length === 0) {
            loadOwners();
            return;
        }

        const timer = setTimeout(() => {
            loadOwners(term);
        }, 300);

        return () => clearTimeout(timer);
    }, [ownerSearchTerm, organizationId, loadOwners]);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(() => {
        const page = searchParams.get("page");
        if (page) return parseInt(page);
        return persistedFilters?.currentPage || 1;
    });
    const [totalLeads, setTotalLeads] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    // Page size — the BackOffice DataTable footer lets the user change it.
    const [limit, setLimit] = useState(50);

    // Column sort for the BackOffice DataTable. Applies to the rows currently
    // loaded (the API paginates server-side and takes no sort parameter).
    const [leadsSort, setLeadsSort] = useState<SortState | null>(null);

    // Reassign Dialog State
    const [isReassignOpen, setIsReassignOpen] = useState(false);
    const [selectedLeadForReassign, setSelectedLeadForReassign] = useState<any>(null);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
    const [isReassigning, setIsReassigning] = useState(false);

    // Bulk Upload Dialog State
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [bulkUploadProducts, setBulkUploadProducts] = useState<{ name: string }[]>([]);
    const [bulkUploadFunnels, setBulkUploadFunnels] = useState<{ funnelName: string }[]>([]);


    const [isConverterOpen, setIsConverterOpen] = useState(false);
    const [converterLink, setConverterLink] = useState("");
    const [isConvertingExternal, setIsConvertingExternal] = useState(false);
    const [converterError, setConverterError] = useState<string | null>(null);
    const [converterStats, setConverterStats] = useState<{ converted: number; skipped: number } | null>(null);
    const converterFileInputRef = useRef<HTMLInputElement | null>(null);

    // Change Stage Dialog State
    const [isChangeStageOpen, setIsChangeStageOpen] = useState(false);
    const [selectedLeadForStageChange, setSelectedLeadForStageChange] = useState<any>(null);
    const [selectedNewStage, setSelectedNewStage] = useState<string>("");
    const [availableStagesForLead, setAvailableStagesForLead] = useState<any[]>([]);
    const [isChangingStage, setIsChangingStage] = useState(false);
    const [isLoadingStagesForChange, setIsLoadingStagesForChange] = useState(false);

    // Add Follow-up Dialog State
    const [isAddFollowUpOpen, setIsAddFollowUpOpen] = useState(false);
    const [selectedLeadForFollowUp, setSelectedLeadForFollowUp] = useState<any>(null);
    const [followUpForm, setFollowUpForm] = useState({
        title: "Follow-up with Lead",
        description: "",
        scheduledDate: "",
        followUpIntervalDays: "",
        autoFollowUpEndDate: "",
        priority: "medium",
        assignedTo: "",
    });
    const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

    // Add Note Dialog State
    const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
    const [selectedLeadForNote, setSelectedLeadForNote] = useState<any>(null);
    const [noteForm, setNoteForm] = useState({
        description: "",
    });
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);
    const [leadNotes, setLeadNotes] = useState<any[]>([]);
    const [isAddCompanyDialogOpen, setIsAddCompanyDialogOpen] = useState(false);
    const [isCreatingCompany, setIsCreatingCompany] = useState(false);
    const [newCompanyForm, setNewCompanyForm] = useState({
        companyName: "",
        industry: "",
        revenue: "",
        website: "",
        address: "",
        pinCode: "",
        country: "",
        state: "",
        city: "",
    });
    const [isAddContactDialogOpen, setIsAddContactDialogOpen] = useState(false);
    const [isCreatingContact, setIsCreatingContact] = useState(false);
    const [newContactForm, setNewContactForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        role: "",
        dateOfBirth: "",
    });

    // Lead Edit/Delete State
    const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
    const [leadToDelete, setLeadToDelete] = useState<any>(null);
    const [isDeleteLeadOpen, setIsDeleteLeadOpen] = useState(false);
    const [isDeletingLead, setIsDeletingLead] = useState(false);

    // Fetch leads from API with pagination
    const fetchLeads = async (page: number = currentPage) => {
        // Abort any in-flight request so its stale response never overwrites us
        if (fetchAbortControllerRef.current) {
            fetchAbortControllerRef.current.abort();
        }
        const controller = new AbortController();
        fetchAbortControllerRef.current = controller;

        setIsLoading(true);
        let fetchedLeads: any[] = [];
        try {
            const skip = (page - 1) * limit; // Convert page to skip (0-based)

            // Build query parameters
            const queryParams = new URLSearchParams({
                skip: skip.toString(),
                limit: limit.toString(),
            });

            // Add leadStatus filter only if a specific status is selected (not "all")
            if (selectedLeadStatus && selectedLeadStatus !== "all") {
                queryParams.set("leadStatus", selectedLeadStatus);
            }

            const trimmedSearchTerm = searchTerm.trim();

            if (trimmedSearchTerm.length > 0) {
                queryParams.set("search", trimmedSearchTerm);
            } else if (selectedOwner && selectedOwner !== "all") {
                queryParams.set("ownerName", selectedOwner);
            }

            // Add stage filter when a stage is selected
            if (selectedStage && selectedStage !== "all") {
                queryParams.set("stage", selectedStage);
            }

            // Add sales funnel filter when a funnel is selected
            if (selectedFunnel && selectedFunnel !== "all") {
                queryParams.set("salesFunnel", selectedFunnel);
            }

            // Add tags filter when tags are selected
            if (selectedTags && selectedTags.length > 0) {
                queryParams.set("tags", selectedTags.join(","));
            }

            if (dateFrom && dateTo) {
                queryParams.set("dateFrom", dateFrom);
                queryParams.set("dateTo", dateTo);
            }

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads?${queryParams.toString()}`),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    signal: controller.signal,
                }
            );

            if (response.ok) {
                const data = await response.json();
                const leadsData = data.leads || data.data || data || [];
                // Debug: Log first lead to check structure
                if (Array.isArray(leadsData) && leadsData.length > 0) {
                    console.log("Sample lead data:", leadsData[0]);
                    console.log("assignedUsers:", leadsData[0]?.assignedUsers);
                }
                fetchedLeads = Array.isArray(leadsData) ? leadsData : [];
                setLeads(fetchedLeads);

                // Update pagination info from API response
                if (data.total !== undefined) {
                    setTotalLeads(data.total);
                    setTotalPages(Math.ceil(data.total / limit));
                } else if (data.pagination && data.pagination.total !== undefined) {
                    setTotalLeads(data.pagination.total);
                    setTotalPages(Math.ceil(data.pagination.total / limit));
                } else {
                    // Fallback: if API doesn't return total, assume current page is the last
                    setTotalLeads(leadsData.length);
                    setTotalPages(1);
                }
            } else {
                console.error("Failed to fetch leads");
                fetchedLeads = [];
                setLeads([]);
                setTotalLeads(0);
                setTotalPages(0);
            }
        } catch (error: any) {
            // If we aborted this request ourselves, do NOT clear leads or stop loading –
            // a newer request is already in progress and will handle that.
            if (error?.name === "AbortError") {
                return fetchedLeads;
            }
            console.error("Error fetching leads:", error);
            fetchedLeads = [];
            setLeads([]);
            setTotalLeads(0);
            setTotalPages(0);
        } finally {
            // Only clear loading if this controller is still the active one
            if (fetchAbortControllerRef.current === controller) {
                setIsLoading(false);
            }
        }

        return fetchedLeads;
    };

    // Calculate next follow-up date (fallback if API doesn't provide it)
    const calculateNextFollowUp = (updatedDate: string, duration: number) => {
        if (!updatedDate || !duration) return "N/A";

        const date = new Date(updatedDate);
        date.setDate(date.getDate() + duration);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${dd}-${mm}-${yyyy}`; // Return DD-MM-YYYY format
    };

    // Format date from API (nextFollowUp or estimatedClose)
    const formatDateFromAPI = (dateString: string | undefined | null): string => {
        if (!dateString) return "N/A";
        try {
            // If it's already in DD-MM-YYYY format, return as is
            if (typeof dateString === 'string' && /^\d{2}-\d{2}-\d{4}/.test(dateString)) {
                return dateString;
            }

            const date = new Date(dateString);
            if (isNaN(date.getTime())) return "N/A";

            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${dd}-${mm}-${yyyy}`;
        } catch {
            return "N/A";
        }
    };

    const formatShortFollowUpDate = (dateString: string | undefined | null): string => {
        if (!dateString || dateString === "N/A") return "N/A";
        try {
            let date: Date;
            if (typeof dateString === "string" && /^\d{2}-\d{2}-\d{4}/.test(dateString)) {
                const [dd, mm, yyyy] = dateString.split("-").map((part) => parseInt(part, 10));
                date = new Date(yyyy, mm - 1, dd);
            } else {
                date = new Date(dateString);
            }
            if (isNaN(date.getTime())) return "N/A";
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        } catch {
            return "N/A";
        }
    };

    // Get next follow-up from API or calculate fallback
    const getNextFollowUp = (lead: any): string => {
        // First try to get from API
        if (lead.nextFollowUp) {
            return isFigmaInlineDealsDesign
                ? formatShortFollowUpDate(lead.nextFollowUp)
                : formatDateFromAPI(lead.nextFollowUp);
        }
        // Fallback to calculation
        const fallback = calculateNextFollowUp(lead.updatedAt || lead.updatedDate || "", lead.duration || 0);
        return isFigmaInlineDealsDesign ? formatShortFollowUpDate(fallback) : fallback;
    };

    // Get estimated close date from API
    const getEstimatedClose = (lead: any): string => {
        return formatDateFromAPI(lead.estimatedClose);
    };

    const getCityFromLeadText = (lead: any): string => {
        const textSources = [
            lead?.description,
            lead?.notes,
            lead?.leadDescription,
            lead?.details,
        ]
            .filter((value) => typeof value === "string")
            .join("\n");

        if (!textSources) return "";

        const cityMatch = textSources.match(/(?:^|\n)\s*city\s*:\s*([^\n\r•|,]+)/i);
        return cityMatch?.[1]?.trim() || "";
    };

    // Get lead name from API (prioritize leadName field)
    const getLeadName = (lead: any) => {
        // First check for leadName field from API
        if (lead.leadName) {
            return lead.leadName;
        }
        // If leadName is not present, return "--"
        return "--";
    };

    // Get contact name
    const getContactName = (lead: any) => {
        if (lead.contact?.firstName && lead.contact?.lastName) {
            return `${lead.contact.firstName} ${lead.contact.lastName}`;
        }
        if (lead.firstName && lead.lastName) {
            return `${lead.firstName} ${lead.lastName}`;
        }
        if (lead.email) {
            return lead.email;
        }
        if (lead.contact?.email) {
            return lead.contact.email;
        }
        return "N/A";
    };

    // Get tags from lead
    const getTags = (lead: any): string[] => {
        const raw = Array.isArray(lead?.tags)
            ? lead.tags
            : Array.isArray(lead?.tag)
                ? lead.tag
                : [];
        return raw
            .map((tag: any) => {
                if (typeof tag === "string") return tag.trim();
                if (tag && typeof tag === "object") {
                    return String(tag.name || tag.label || tag.value || "").trim();
                }
                return String(tag ?? "").trim();
            })
            .filter((tag: string) => tag !== "");
    };

    // Get tag color based on index
    const getTagColor = (index: number) => {
        const colors = [
            { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.2)", text: "#3b82f6" }, // blue
            { bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.2)", text: "#10b981" }, // green
            { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)", text: "#f59e0b" }, // amber
            { bg: "rgba(139, 92, 246, 0.1)", border: "rgba(139, 92, 246, 0.2)", text: "#8b5cf6" }, // purple
            { bg: "rgba(236, 72, 153, 0.1)", border: "rgba(236, 72, 153, 0.2)", text: "#ec4899" }, // pink
            { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)", text: "#ef4444" }, // red
            { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)", text: "#22c55e" }, // emerald
            { bg: "rgba(168, 85, 247, 0.1)", border: "rgba(168, 85, 247, 0.2)", text: "#a855f7" }, // violet
        ];
        return colors[index % colors.length];
    };

    const FIGMA_TAG_COLOR_BY_NAME: Record<string, string> = {
        "hot lead": "#3b82f5",
        hot: "#3b82f5",
        enterprise: "#8b5cf6",
        new: "#3b82f5",
        warm: "#f59e0b",
        cold: "#8b5cf6",
        responsive: "#3b82f5",
        unresponsive: "#6b7280",
        capraise: "#06b6d4",
        funding: "#8b5cf6",
    };

    const FIGMA_TAG_FALLBACK_COLORS = [
        "#3b82f5",
        "#8b5cf6",
        "#10b981",
        "#f59e0b",
        "#ef4444",
        "#06b6d4",
    ];

    const getFigmaTagColor = (tag: string, index = 0) => {
        const key = String(tag).toLowerCase().trim();
        return FIGMA_TAG_COLOR_BY_NAME[key] ?? FIGMA_TAG_FALLBACK_COLORS[index % FIGMA_TAG_FALLBACK_COLORS.length];
    };

    const MAX_VISIBLE_LEAD_TAGS = 2;

    type LeadTagChip =
        | { kind: "priority"; label: string }
        | { kind: "stage"; label: string; stageRaw: unknown }
        | { kind: "tag"; label: string; index: number };

    const renderLeadTagChip = (chip: LeadTagChip, figma = false) => {
        if (chip.kind === "priority") {
            if (figma) {
                const p = chip.label.toLowerCase();
                return (
                    <span
                        key={`priority-${chip.label}`}
                        className="px-2 py-0.5 rounded-[999px] text-[10px] font-semibold leading-[14px] text-white capitalize whitespace-nowrap"
                        style={{
                            backgroundColor:
                                p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#3b82f5",
                        }}
                    >
                        {chip.label}
                    </span>
                );
            }
            const p = chip.label.toLowerCase();
            return (
                <span
                    key={`priority-${chip.label}`}
                    className={`px-2 py-0.5 rounded-[6px] text-[11px] font-medium border-[0.667px] capitalize whitespace-nowrap ${
                        p === "high"
                            ? "bg-red-100 text-red-700 border-red-200"
                            : p === "medium"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-blue-100 text-blue-700 border-blue-200"
                    }`}
                >
                    {chip.label}
                </span>
            );
        }

        if (chip.kind === "stage") {
            if (figma) {
                return (
                    <span
                        key={`stage-${chip.label}`}
                        className="px-2 py-0.5 rounded-[999px] text-[10px] font-semibold leading-[14px] text-white capitalize whitespace-nowrap"
                        style={{ backgroundColor: getFigmaTagColor(chip.label, 1) }}
                    >
                        {chip.label}
                    </span>
                );
            }
            return (
                <span
                    key={`stage-${chip.label}`}
                    className={`px-2 py-0.5 rounded-[6px] text-[11px] font-medium capitalize whitespace-nowrap ${getStageColor(chip.stageRaw)}`}
                >
                    {chip.label}
                </span>
            );
        }

        if (figma) {
            return (
                <span
                    key={`tag-${chip.index}-${chip.label}`}
                    className="px-2 py-0.5 rounded-[999px] text-[10px] font-semibold leading-[14px] text-white whitespace-nowrap"
                    style={{ backgroundColor: getFigmaTagColor(chip.label, chip.index) }}
                >
                    {chip.label}
                </span>
            );
        }
        const color = getTagColor(chip.index);
        return (
            <span
                key={`tag-${chip.index}-${chip.label}`}
                className="px-2 py-0.5 rounded-[6px] text-[11px] font-medium border-[0.667px] whitespace-nowrap"
                style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
            >
                {chip.label}
            </span>
        );
    };

    /** Tags column chips = priority + stage + tags; max 2 visible, rest in hover tooltip. */
    const renderLeadTagsColumn = (lead: any, figma = false) => {
        const chips: LeadTagChip[] = [];
        const priority = String(lead.priority || "medium").trim();
        if (priority) chips.push({ kind: "priority", label: priority });

        const stageStr = getStageString(lead.stage);
        if (lead.stage && stageStr !== "-") {
            chips.push({ kind: "stage", label: stageStr, stageRaw: lead.stage });
        }

        getTags(lead).forEach((tag, index) => {
            chips.push({ kind: "tag", label: String(tag), index });
        });

        if (chips.length === 0) return null;
        const visible = chips.slice(0, MAX_VISIBLE_LEAD_TAGS);
        const hasMore = chips.length > MAX_VISIBLE_LEAD_TAGS;

        return (
            <>
                {visible.map((chip) => renderLeadTagChip(chip, figma))}
                {hasMore && (
                    <LeadTagsSeeAll
                        figma={figma}
                        themeClassName={`px-2 py-0.5 rounded-[6px] text-[11px] font-medium border-[0.667px] whitespace-nowrap ${
                            theme === "color"
                                ? "border-[rgba(0,255,255,0.3)] text-[rgba(0,255,255,0.85)] hover:bg-[rgba(0,255,255,0.08)]"
                                : "border-[#d1d5db] text-[#6b7280] hover:bg-muted dark:border-[#3a3a3a] dark:text-[#9ca3af] dark:hover:bg-[#2a2a2a]"
                        }`}
                    >
                        {chips.map((chip) => renderLeadTagChip(chip, figma))}
                    </LeadTagsSeeAll>
                )}
            </>
        );
    };

    const getContactPhone = (lead: any): string => {
        const direct =
            lead?.contact?.phoneNumber ||
            lead?.contact?.phone ||
            lead?.phoneNumber ||
            lead?.phone;

        if (direct) {
            return typeof direct === "string" ? direct : String(direct);
        }

        if (Array.isArray(lead?.contacts)) {
            const contactWithPhone = lead.contacts.find(
                (c: any) => c?.phoneNumber || c?.phone
            );
            if (contactWithPhone) {
                const value = contactWithPhone.phoneNumber || contactWithPhone.phone;
                return typeof value === "string" ? value : String(value ?? "");
            }
        }

        return "";
    };

    const handleOpenGmail = (email: string) => {
        if (!email || email === "N/A") {
            toast.error("No email available");
            return;
        }
        const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(
            email
        )}`;
        window.open(gmailUrl, "_blank");
    };

    const formatPhoneForWhatsApp = (phone: string): string => {
        if (!phone) return "";
        const digits = phone.replace(/[^\d]/g, "");
        if (!digits) return "";
        if (digits.length === 10) {
            return `91${digits}`;
        }
        return digits;
    };

    const handleOpenWhatsApp = (phone: string) => {
        if (!phone || phone === "N/A") {
            toast.error("No phone number available");
            return;
        }
        const formattedPhone = formatPhoneForWhatsApp(phone);
        if (!formattedPhone) {
            toast.error("Invalid phone number");
            return;
        }
        const whatsappUrl = `https://wa.me/${formattedPhone}`;
        window.open(whatsappUrl, "_blank");
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

    // Get owner name
    const getOwnerName = (lead: any) => {
        // First check for assignedUsers array from API response (check multiple possible field names)
        const assignedUsers = lead.assignedUsers || lead.assignedUser || lead.assignedToUsers || lead.assigned;

        // Debug logging
        if (!assignedUsers && lead._id) {
            console.log("Lead ID:", lead._id, "Available fields:", Object.keys(lead));
            console.log("assignedUsers value:", lead.assignedUsers);
        }

        if (assignedUsers && Array.isArray(assignedUsers) && assignedUsers.length > 0) {
            // Get names from all assigned users
            const names = assignedUsers
                .map((user: any) => {
                    // Check multiple possible name fields
                    return user.name || user.userName || `${user.firstName || ""} ${user.lastName || ""}`.trim();
                })
                .filter((name: string) => name && name.trim() !== "");

            if (names.length > 0) {
                return names.join(", ");
            }
        }

        // Fallback to owner object
        if (lead.owner?.name) {
            return lead.owner.name;
        }
        if (lead.owner?.firstName && lead.owner?.lastName) {
            return `${lead.owner.firstName} ${lead.owner.lastName}`;
        }

        // Check if assignedTo is a user object with name
        if (lead.assignedTo && typeof lead.assignedTo === 'object' && lead.assignedTo.name) {
            return lead.assignedTo.name;
        }

        return "Unassigned";
    };

    // Get owner details (name, email, etc.)
    const getOwnerDetails = (lead: any) => {
        const assignedUsers = lead.assignedUsers || lead.assignedUser || lead.assignedToUsers || lead.assigned;

        if (assignedUsers && Array.isArray(assignedUsers) && assignedUsers.length > 0) {
            // Get details from first assigned user
            const user = assignedUsers[0];
            const name = user.name || user.userName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";
            const email = user.email || "";

            return {
                name,
                email,
                fullDetails: `${name}${email ? ` (${email})` : ""}`
            };
        }

        // Fallback to owner object
        if (lead.owner) {
            const name = lead.owner.name || `${lead.owner.firstName || ""} ${lead.owner.lastName || ""}`.trim() || "Unknown";
            const email = lead.owner.email || "";
            return {
                name,
                email,
                fullDetails: `${name}${email ? ` (${email})` : ""}`
            };
        }

        if (lead.assignedTo && typeof lead.assignedTo === 'object') {
            const name = lead.assignedTo.name || "Unknown";
            const email = lead.assignedTo.email || "";
            return {
                name,
                email,
                fullDetails: `${name}${email ? ` (${email})` : ""}`
            };
        }

        return {
            name: "Unassigned",
            email: "",
            fullDetails: "Unassigned"
        };
    };

    const buildDefaultLeadForm = () => {
        const defaultForm = { ...initialLeadFormState };

        if (funnels.length > 0) {
            const firstFunnel = funnels[0];
            defaultForm.salesFunnelId = firstFunnel?._id || firstFunnel?.id || "";
        }

        if (owners.length > 0) {
            const firstOwner = owners[0];
            defaultForm.assignedTo = firstOwner?.id || firstOwner?._id || firstOwner?.userId || "";
        }

        return defaultForm;
    };

    const formatDateForInput = (dateString: string | null | undefined) => {
        if (!dateString) return "";
        try {
            if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                return dateString;
            }
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return "";
            return date.toISOString().split("T")[0];
        } catch {
            return "";
        }
    };

    // Log the getPrimaryOwnerId function to verify its logic
    const getPrimaryOwnerId = (leadData: any) => {
        console.log("[DEBUG-EDIT-LEAD] getPrimaryOwnerId called with:", leadData ? "Data Present" : "No Data");
        if (!leadData) return "";

        if (leadData.assignedTo && typeof leadData.assignedTo === "string") {
            console.log("[DEBUG-EDIT-LEAD] Found string assignedTo:", leadData.assignedTo);
            return leadData.assignedTo;
        }

        if (Array.isArray(leadData.assignedTo) && leadData.assignedTo.length > 0) {
            const firstAssignee = leadData.assignedTo[0];
            const result = typeof firstAssignee === "string" ? firstAssignee : (firstAssignee?._id || firstAssignee?.id || firstAssignee?.userId || "");
            console.log("[DEBUG-EDIT-LEAD] Found array assignedTo. Result:", result);
            return result;
        }

        if (Array.isArray(leadData.assignedUsers) && leadData.assignedUsers.length > 0) {
            const firstUser = leadData.assignedUsers[0];
            const result = firstUser?._id || firstUser?.id || firstUser?.userId || "";
            console.log("[DEBUG-EDIT-LEAD] Found assignedUsers. Result:", result);
            return result;
        }

        if (leadData.assignedToUser) {
            const user = leadData.assignedToUser;
            const result = user?._id || user?.id || user?.userId || "";
            console.log("[DEBUG-EDIT-LEAD] Found assignedToUser. Result:", result);
            return result;
        }

        if (leadData.owner && typeof leadData.owner === "object") {
            const result = leadData.owner?._id || leadData.owner?.id || leadData.owner?.userId || "";
            console.log("[DEBUG-EDIT-LEAD] Found owner object. Result:", result);
            return result;
        }

        return "";
    };

    // Common sales funnels, stages, and industries for bulk upload template
    const commonSalesFunnels = [
        "Organic Search",
        "Paid Search",
        "Social Media",
        "Email Marketing",
        "Direct Traffic",
        "Referral",
        "Cold Calling",
        "Trade Show",
        "Content Marketing",
        "Webinar",
        "Partner Referral",
        "Word of Mouth"
    ];

    const commonStages = [
        "Lead",
        "Qualified",
        "Proposal",
        "Negotiation",
        "Closed Won",
        "Closed Lost"
    ];

    const commonIndustries = [
        "Technology",
        "Healthcare",
        "Finance",
        "Education",
        "Manufacturing",
        "Retail",
        "Real Estate",
        "Consulting"
    ];

    const leadTemplateHeaders = [
        "firstName",
        "lastName",
        "email",
        "phoneNumber",
        "dob",
        "companyName",
        "industry",
        "website",
        "address",
        "country",
        "state",
        "city",
        "pinCode",
        "productName",
        "quantity",
        "pricing",
        "negotiatedPricing",
        "MaxDiscPrice",
        "salesFunnel",
        "stage",
        "estRevenue",
        "assignedTo",
        "notes",
    ];

    // Fetch products for lead selection
    const fetchProducts = async () => {
        if (allProducts.length > 0) return allProducts;
        setIsLoadingProducts(true);
        try {
            const response = await authenticatedFetch(buildExternalUrl("/crm/products?skip=0&limit=100"));
            if (response.ok) {
                const productsData = await response.json();
                const normalized =
                    Array.isArray(productsData?.products)
                        ? productsData.products
                        : Array.isArray(productsData?.data)
                            ? productsData.data
                            : Array.isArray(productsData)
                                ? productsData
                                : [];
                setAllProducts(normalized);
                return normalized;
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setIsLoadingProducts(false);
        }
        return [];
    };

    // Fetch products for bulk upload template
    const fetchBulkUploadProducts = async () => {
        try {
            const response = await authenticatedFetch(buildExternalUrl("/crm/products?skip=0&limit=100"));
            if (response.ok) {
                const productsData = await response.json();
                const normalized =
                    Array.isArray(productsData?.products)
                        ? productsData.products
                        : Array.isArray(productsData?.data)
                            ? productsData.data
                            : Array.isArray(productsData)
                                ? productsData
                                : [];
                setBulkUploadProducts(normalized);
                return normalized;
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        }
        return [];
    };

    // Fetch funnels for bulk upload template
    const fetchBulkUploadFunnels = async () => {
        try {
            const response = await authenticatedFetch(buildExternalUrl("/crm/funnels?skip=0&limit=100"));
            if (response.ok) {
                const funnelsData = await response.json();
                const normalized =
                    Array.isArray(funnelsData?.funnels)
                        ? funnelsData.funnels
                        : Array.isArray(funnelsData?.data)
                            ? funnelsData.data
                            : Array.isArray(funnelsData)
                                ? funnelsData
                                : [];
                setBulkUploadFunnels(normalized);
                return normalized;
            }
        } catch (error) {
            console.error("Error fetching funnels:", error);
        }
        return [];
    };

    const fallbackCountryList = ["United States", "India", "United Kingdom", "Canada", "Australia"];

    const getCountryNamesForTemplate = () => {
        try {
            return Country.getAllCountries().map((country) => country.name);
        } catch (countryError) {
            console.error("Error fetching countries:", countryError);
            return fallbackCountryList;
        }
    };

    const generateLeadTemplateWorkbook = async (rows: CSVLead[] = []) => {
        const productsSource =
            bulkUploadProducts.length > 0 ? bulkUploadProducts : await fetchBulkUploadProducts();
        const funnelsSource =
            bulkUploadFunnels.length > 0 ? bulkUploadFunnels : await fetchBulkUploadFunnels();

        const safeProducts = Array.isArray(productsSource) ? productsSource : [];
        const safeFunnels = Array.isArray(funnelsSource) ? funnelsSource : [];

        const productNames = safeProducts
            .map((product: any) => product.productName || product.name || product.title || "")
            .filter(Boolean);
        const funnelNames = safeFunnels
            .map((funnel: any) => funnel.funnelName || funnel.name || funnel.salesFunnel || "")
            .filter(Boolean);
        const countryNames = getCountryNamesForTemplate();

        const workbook = XLSX.utils.book_new();

        const instructions = [
            ["LEAD BULK UPLOAD TEMPLATE - WITH DROPDOWNS"],
            [""],
            ["IMPORTANT INSTRUCTIONS:"],
            ["1. Fill data in the 'Lead Data' tab"],
            ["2. Use dropdowns for Industry, Sales Funnel, Stage, and Country"],
            ["3. Required fields are marked with * in headers"],
            ["4. Save as .xlsx and upload the same file"],
            [""],
            ["✅ Required Fields (marked with *):"],
            ["First Name*", "Lead's first name"],
            ["Last Name*", "Lead's last name"],
            ["Email*", "Lead's email address"],
            [""],
            ["📝 Optional Fields:"],
            ["Phone Number", "Contact phone number"],
            ["Date of Birth", "Format: YYYY-MM-DD (e.g., 1990-01-15)"],
            ["Company Name", "Lead's company name"],
            ["Industry", "Use dropdown - select from available industries"],
            ["Website", "Company website URL"],
            ["Address", "Full address"],
            ["Country", "Use dropdown - select from all available countries"],
            ["State", "Type state/province name manually"],
            ["City", "City name"],
            ["Pin Code", "Postal/zip code"],
            ["Product Name", "Use dropdown - select from available products"],
            ["Quantity", "Quantity required (number)"],
            ["Pricing", "Product pricing (number)"],
            ["Negotiated Pricing", "Final negotiated price (number)"],
            ["Max Disc Price", "Maximum discount price (number)"],
            ["Sales Funnel", "Use dropdown - lead source"],
            ["Stage", "Use dropdown - current lead stage"],
            ["Est Revenue", "Estimated revenue potential"],
            ["Assigned To", "Assigned team member"],
            ["Notes", "Additional context or internal remarks"],
            [""],
            ["📋 Available Options:"],
            ["Industries:", commonIndustries.slice(0, 5).join(", ") + "... (and more)"],
            ["Sales Funnels:", commonSalesFunnels.slice(0, 5).join(", ") + "... (and more)"],
            ["Stages:", commonStages.join(", ")],
            [
                "Products:",
                productNames.slice(0, 5).join(", ") + (productNames.length > 5 ? "... (and more)" : ""),
            ],
            ["Countries:", countryNames.slice(0, 10).join(", ") + "... (and more)"],
            [""],
            ["🚨 IMPORTANT NOTES:"],
            ["- Dropdowns are set up for Industry, Sales Funnel, Stage, Product Name, and Country"],
            ["- Country dropdown has ALL countries from country-state-city library"],
            ["- State field: Simply type the state/province name manually"],
            ["- Date fields use YYYY-MM-DD format"],
            ["- Numeric fields: quantity, pricing, etc. must be numbers"],
            ["- Save file as .xlsx format after filling data"],
            ["- Required fields must be filled for successful upload"],
        ];

        const instructionsWs = XLSX.utils.aoa_to_sheet(instructions);
        XLSX.utils.book_append_sheet(workbook, instructionsWs, "Instructions");

        const lookupData = [
            ["Industries", "SalesFunnels", "Countries", "Products"],
            ...Array.from(
                {
                    length: Math.max(
                        commonIndustries.length,
                        funnelNames.length,
                        countryNames.length,
                        productNames.length
                    ),
                },
                (_, i) => [
                    commonIndustries[i] || "",
                    funnelNames[i] || "",
                    countryNames[i] || "",
                    productNames[i] || "",
                ]
            ),
        ];

        const lookupWs = XLSX.utils.aoa_to_sheet(lookupData);
        XLSX.utils.book_append_sheet(workbook, lookupWs, "Lookups");

        const sampleData =
            rows.length > 0
                ? []
                : [
                    [
                        "John",
                        "Smith",
                        "john.smith@company.com",
                        "9876543210",
                        "1985-06-15",
                        "Tech Corp",
                        commonIndustries[0] || "Technology",
                        "https://techcorp.com",
                        "123 Business St",
                        "India",
                        "Maharashtra",
                        "Mumbai",
                        "400001",
                        productNames[0] || "Sample Product",
                        "10",
                        "50000",
                        "45000",
                        "40000",
                        funnelNames[0] || "Sales Funnel",
                        commonStages[0],
                        "500000",
                        "Sales Team",
                        "Interested in AI automation services",
                    ],
                    [
                        "Sarah",
                        "Johnson",
                        "sarah.johnson@example.com",
                        "9876543211",
                        "1990-03-20",
                        "Finance Solutions",
                        commonIndustries[1] || "Finance",
                        "https://financesol.com",
                        "456 Corporate Ave",
                        "United States",
                        "California",
                        "San Francisco",
                        "94102",
                        productNames[1] || "Consulting Service",
                        "1",
                        "75000",
                        "70000",
                        "65000",
                        funnelNames[1] || "Sales Funnel",
                        commonStages[1],
                        "750000",
                        "Account Manager",
                        "Needs follow-up after demo",
                    ],
                ];

        const leadRows =
            rows.length > 0
                ? rows.map((row) => leadTemplateHeaders.map((header) => (row as any)[header] ?? ""))
                : sampleData;

        const dataWs = XLSX.utils.aoa_to_sheet([leadTemplateHeaders, ...leadRows]);
        XLSX.utils.book_append_sheet(workbook, dataWs, "Lead Data");

        return workbook;
    };

    const downloadWorkbookFile = (workbook: XLSX.WorkBook, fileName: string) => {
        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    // Validation function for lead data
    const validateLead = (lead: CSVLead, index: number): string[] => {
        const errors: string[] = [];

        // Required fields
        if (!lead.firstName?.trim()) errors.push('First Name is required');
        if (!lead.lastName?.trim()) errors.push('Last Name is required');

        if (!lead.email?.trim() && !lead.phoneNumber?.trim()) {
            errors.push('Either Email or Phone Number is required');
        }

        // Email validation
        if (lead.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
            errors.push('Invalid email format');
        }

        // Date validation
        if (lead.dob && !/^\d{2}-\d{2}-\d{4}$/.test(lead.dob)) {
            errors.push('Date of Birth must be DD-MM-YYYY format');
        }

        // Numeric validations
        if (lead.quantity && isNaN(Number(lead.quantity))) {
            errors.push('Quantity must be a number');
        }
        if (lead.pricing && isNaN(Number(lead.pricing))) {
            errors.push('Pricing must be a number');
        }

        return errors;
    };

    // Parse Excel file
    const parseExcelFile = (file: File): Promise<CSVLead[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Look for the "Lead Data" sheet
                    const sheetName = workbook.SheetNames.find(name =>
                        name.toLowerCase().includes('lead') || name.toLowerCase().includes('data')
                    ) || workbook.SheetNames[0];

                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (jsonData.length < 2) {
                        throw new Error("Excel file must contain headers and at least one data row");
                    }

                    const headers = jsonData[0] as string[];
                    const requiredHeaders = ["firstName", "lastName"];
                    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

                    if (!headers.includes("email") && !headers.includes("phoneNumber")) {
                        missingHeaders.push("email or phoneNumber");
                    }

                    if (missingHeaders.length > 0) {
                        throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
                    }

                    const leads: CSVLead[] = [];

                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i] as any[];
                        if (!row || row.every(cell => !cell)) continue; // Skip empty rows

                        const lead: any = {};
                        headers.forEach((header, index) => {
                            lead[header] = row[index] ? String(row[index]).trim() : "";
                        });

                        // Skip rows where required fields are empty
                        if (lead.firstName && lead.lastName && (lead.email || lead.phoneNumber)) {
                            const leadWithName = {
                                ...lead,
                                leadName: deriveLeadName(lead),
                            } as CSVLead;
                            leads.push(leadWithName);
                        }
                    }

                    resolve(leads);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsArrayBuffer(file);
        });
    };

    // Parse one CSV line respecting double-quoted fields (commas inside quotes = one column)
    const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let idx = 0; idx < line.length; idx++) {
            const ch = line[idx];
            if (ch === '"') inQuotes = !inQuotes;
            else if (ch === "," && !inQuotes) {
                result.push(current.trim().replace(/^"(.*)"$/, "$1"));
                current = "";
            } else current += ch;
        }
        result.push(current.trim().replace(/^"(.*)"$/, "$1"));
        return result;
    };

    // Parse CSV file
    const parseCSV = (csvText: string): CSVLead[] => {
        const lines = csvText.trim().split(/\r?\n/).filter(line =>
            line.trim() && !line.startsWith("#")
        );

        const headers = parseCSVLine(lines[0]).map(h => h.trim());

        const requiredHeaders = ["firstName", "lastName"];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (!headers.includes("email") && !headers.includes("phoneNumber")) {
            missingHeaders.push("email or phoneNumber");
        }

        if (missingHeaders.length > 0) {
            throw new Error(`Missing required columns: ${missingHeaders.join(", ")}. Please use the download template.`);
        }

        const leads: CSVLead[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);

            if (values.length !== headers.length) {
                const rowNum = i + 1;
                const expected = headers.length;
                const got = values.length;
                throw new Error(
                    `Row ${rowNum} has ${got} column${got !== 1 ? "s" : ""} but the header has ${expected}. ` +
                    "Check for extra commas, unquoted commas inside a cell, or line breaks in a cell. " +
                    "Tip: Use the downloaded Excel template or wrap any cell that contains a comma in double quotes."
                );
            }

            const lead: any = {};
            headers.forEach((header, index) => {
                lead[header] = values[index] || "";
            });

            const leadWithName = {
                ...lead,
                leadName: deriveLeadName(lead),
            } as CSVLead;
            leads.push(leadWithName);
        }

        return leads;
    };

    // Handle View Details
    const handleViewDetails = (lead: any) => {
        const leadId = lead._id || lead.id;
        if (!leadId) return;
        if (openDealsLeadInline(String(leadId))) return;
        router.push(`/deals/leads/${leadId}`);
    };

    // Handle Change Stage
    const handleChangeStage = async (lead: any) => {
        setSelectedLeadForStageChange(lead);
        setSelectedNewStage("");
        setIsLoadingStagesForChange(true);

        try {
            // Get the funnel ID from the lead
            const funnelId = lead.salesFunnel?._id || lead.salesFunnel || lead.funnelId;

            if (funnelId) {
                // Fetch stages for the funnel
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

                    // Transform stages to a consistent format
                    const transformedStages = stages.map((stage: any) => {
                        if (typeof stage === 'string') {
                            return { name: stage, value: stage };
                        }
                        // Ensure name and value are always strings, never objects
                        const nameStr = stage?.name || stage?.stageName || (typeof stage === "string" ? stage : String(stage?.id || stage?._id || "Unknown Stage"));
                        const valueStr = stage?.name || stage?.stageName || stage?.id || stage?._id || (typeof stage === "string" ? stage : String(stage || "Unknown Stage"));
                        return {
                            name: String(nameStr),
                            value: String(valueStr),
                        };
                    });

                    setAvailableStagesForLead(transformedStages);
                    // Set current stage as default
                    setSelectedNewStage(lead.stage || "");
                } else {
                    setAvailableStagesForLead([]);
                }
            } else {
                setAvailableStagesForLead([]);
            }
        } catch (error) {
            console.error("Error fetching stages:", error);
            setAvailableStagesForLead([]);
        } finally {
            setIsLoadingStagesForChange(false);
            setIsChangeStageOpen(true);
        }
    };

    // Handle Confirm Change Stage (aligned with lead detail: last funnel stage → won, immediate UI)
    const handleConfirmChangeStage = async () => {
        if (!selectedLeadForStageChange || !selectedNewStage) {
            toast.error("Please select a new stage");
            return;
        }

        const prevStageNorm = normalizeLeadStageValue(selectedLeadForStageChange.stage);
        const newStageNorm = normalizeLeadStageValue(selectedNewStage);
        if (!newStageNorm) {
            toast.error("Please select a new stage");
            return;
        }
        if (newStageNorm === prevStageNorm) {
            toast.error("Please select a different stage");
            return;
        }

        setIsChangingStage(true);
        const loadingToast = toast.loading("Updating lead stage...");

        try {
            const leadId = selectedLeadForStageChange._id || selectedLeadForStageChange.id;

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        stage: newStageNorm,
                    }),
                }
            );

            if (response.ok) {
                const stagesList = availableStagesForLead;
                const last = stagesList[stagesList.length - 1];
                const norm = (s: string) => String(s || "").trim().toLowerCase();
                const matchesLast = (stageStr: string) =>
                    !!last &&
                    !!stageStr &&
                    (norm(stageStr) === norm(String(last.name || "")) ||
                        norm(stageStr) === norm(String(last.value || "")));
                const isAtLastStage = stagesList.length > 0 && matchesLast(newStageNorm);

                let stageSuccessMessage = "Stage updated successfully!";

                if (isAtLastStage) {
                    // Immediately reflect won in the table (same pattern as lead detail page)
                    setLeads((prev) =>
                        prev.map((l) => {
                            const id = l._id || l.id;
                            if (id !== leadId) return l;
                            return { ...l, stage: newStageNorm, leadStatus: "won" };
                        })
                    );
                    try {
                        const wonRes = await authenticatedFetch(
                            buildExternalUrl(`/crm/leads/${leadId}`),
                            {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ leadStatus: "won" }),
                            }
                        );
                        if (wonRes.ok) {
                            stageSuccessMessage = "Stage updated — lead marked as won!";
                        } else {
                            console.warn("Auto-mark as won API returned non-OK response");
                        }
                    } catch (e) {
                        console.warn("Failed to auto-mark as won after reaching final stage", e);
                    }
                }

                toast.success(stageSuccessMessage, { id: loadingToast });
                setIsChangeStageOpen(false);
                setSelectedLeadForStageChange(null);
                setSelectedNewStage("");
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent(DEALS_CRM_STATS_REFRESH_EVENT));
                }
                router.refresh();
                await fetchLeads(currentPage);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to update stage", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error updating stage:", error);
            toast.error("Failed to update stage. Please try again.", { id: loadingToast });
        } finally {
            setIsChangingStage(false);
        }
    };

    // Handle Add Follow-up
    const handleAddFollowUp = (lead: any) => {
        setSelectedLeadForFollowUp(lead);
        setFollowUpForm({
            title: "Follow-up with Lead",
            description: "",
            scheduledDate: "",
            followUpIntervalDays: "",
            autoFollowUpEndDate: "",
            priority: "medium",
            assignedTo: "",
        });
        setIsAddFollowUpOpen(true);
    };

    // Handle Confirm Add Follow-up
    const handleConfirmAddFollowUp = async () => {
        if (!selectedLeadForFollowUp) {
            toast.error("Lead not selected");
            return;
        }

        if (!followUpForm.scheduledDate) {
            toast.error("Please select a date");
            return;
        }

        setIsSubmittingFollowUp(true);
        const loadingToast = toast.loading("Scheduling follow-up...");

        try {
            const userData = localStorage.getItem("garage_tok")

            let userId = "";
            let organizationId = "";

            if (userData) {
                try {
                    const parsedData = jwtDecode<JwtPayload>(userData)

                    // const parsedData= jwtDecode<JwtPayload>(userData)
                    userId = parsedData.userId || parsedData.id || "";
                    organizationId = parsedData.orgId || "";
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }

            const leadId = selectedLeadForFollowUp._id || selectedLeadForFollowUp.id;
            const schedule = buildFollowUpSchedule(
                followUpForm.scheduledDate,
                followUpForm.followUpIntervalDays,
                followUpForm.autoFollowUpEndDate
            );

            if (schedule.error) {
                toast.error(schedule.error, { id: loadingToast });
                return;
            }

            const dueDates = schedule.dueDates;

            for (const dueDate of dueDates) {
                const yyyy = dueDate.getFullYear();
                const mm = String(dueDate.getMonth() + 1).padStart(2, "0");
                const dd = String(dueDate.getDate()).padStart(2, "0");
                const dueDateTime = new Date(
                    `${yyyy}-${mm}-${dd}T23:59:59`
                ).toISOString();

                const taskData = {
                    leadId: leadId,
                    title: followUpForm.title || "Follow-up with Lead",
                    description: followUpForm.description || "Follow-up scheduled",
                    dueDate: dueDateTime,
                    priority: followUpForm.priority,
                    status: "open",
                    assignedTo: followUpForm.assignedTo || userId,
                    organizationId: organizationId,
                    createdBy: userId,
                    ...FOLLOW_UP_TASK_DEFAULTS,
                };

                await authenticatedFetch(
                    buildExternalUrl("/crm/tasks"),
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(taskData),
                    }
                );
            }

            const suffix = dueDates.length > 1 ? "s" : "";
            toast.success(`${dueDates.length} follow-up${suffix} scheduled successfully!`, { id: loadingToast });
            setIsAddFollowUpOpen(false);
            setSelectedLeadForFollowUp(null);
            setFollowUpForm({
                title: "Follow-up with Lead",
                description: "",
                scheduledDate: "",
                followUpIntervalDays: "",
                autoFollowUpEndDate: "",
                priority: "medium",
                assignedTo: "",
            });
            // Refresh leads list
            await fetchLeads(currentPage);
        } catch (error) {
            console.error("Error scheduling follow-up:", error);
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to schedule follow-up. Please try again.";
            toast.error(message, { id: loadingToast });
        } finally {
            setIsSubmittingFollowUp(false);
        }
    };

    const followUpSchedulePreview = useMemo(
        () =>
            buildFollowUpSchedule(
                followUpForm.scheduledDate,
                followUpForm.followUpIntervalDays,
                followUpForm.autoFollowUpEndDate
            ),
        [
            followUpForm.scheduledDate,
            followUpForm.followUpIntervalDays,
            followUpForm.autoFollowUpEndDate,
        ]
    );

    // Handle Add Note
    const handleAddNote = (lead: any) => {
        setSelectedLeadForNote(lead);
        setNoteForm({
            description: "",
        });
        setIsAddNoteOpen(true);
    };

    // Handle Confirm Add Note
    const handleConfirmAddNote = async () => {
        if (!selectedLeadForNote) {
            toast.error("Lead not selected");
            return;
        }

        if (!noteForm.description.trim()) {
            toast.error("Please enter a note");
            return;
        }

        setIsSubmittingNote(true);
        const loadingToast = toast.loading("Adding note...");

        try {
            const userData = localStorage.getItem("garage_tok")

            let userId = "";
            let organizationId = "";

            if (userData) {
                try {
                    const parsedData = jwtDecode<JwtPayload>(userData)

                    // const parsedData= jwtDecode<JwtPayload>(userData)
                    userId = parsedData.userId || parsedData.id || "";
                    organizationId = parsedData.orgId || "";
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }

            const leadId = selectedLeadForNote._id || selectedLeadForNote.id;

            const noteData = {
                leadId: leadId,
                notes: noteForm.description,
                organizationId: organizationId,
                createdBy: userId,
            };

            const response = await authenticatedFetch(
                buildExternalUrl("/crm/notes"),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(noteData),
                }
            );

            if (response.ok) {
                toast.success("Note added successfully!", { id: loadingToast });
                setIsAddNoteOpen(false);
                setSelectedLeadForNote(null);
                setNoteForm({
                    description: "",
                });
                // Refresh leads list
                await fetchLeads(currentPage);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to add note", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error adding note:", error);
            toast.error("Failed to add note. Please try again.", { id: loadingToast });
        } finally {
            setIsSubmittingNote(false);
        }
    };

    const handleCreateCompanyFromDialog = async () => {
        if (!newCompanyForm.companyName.trim()) {
            toast.error("Company name is required");
            return;
        }

        setIsCreatingCompany(true);
        const loadingToast = toast.loading("Creating company...");

        try {
            const userData = localStorage.getItem("garage_tok")

            let userId = "";
            let orgId = organizationId;

            if (userData) {
                try {
                    const parsedData = jwtDecode<JwtPayload>(userData)

                    userId = parsedData.userId || parsedData.id || "";
                    orgId = parsedData.orgId || orgId || "";
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
                pinCode: newCompanyForm.pinCode || "",
                country: newCompanyForm.country || "",
                state: newCompanyForm.state || "",
                city: newCompanyForm.city || "",
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
            const companyId =
                createdCompany._id || createdCompany.id || data.companyId || data.id || "";

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
                pinCode: "",
                country: "",
                state: "",
                city: "",
            });
        } catch (error) {
            console.error("Error creating company:", error);
            toast.error("Failed to create company. Please try again.");
        } finally {
            setIsCreatingCompany(false);
        }
    };

    const handleCreateContactFromDialog = async () => {
        if (!newContactForm.firstName.trim() || !newContactForm.lastName.trim()) {
            toast.error("First name and last name are required");
            return;
        }

        setIsCreatingContact(true);
        const loadingToast = toast.loading("Creating contact...");

        try {
            const userData = localStorage.getItem("garage_tok")

            let userId = "";
            let orgId = "";

            if (userData) {
                try {
                    const parsedData = jwtDecode<JwtPayload>(userData)

                    userId = parsedData.userId || parsedData.id || "";
                    orgId = parsedData.orgId || organizationId || "";
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }

            const payload = {
                firstName: newContactForm.firstName.trim(),
                lastName: newContactForm.lastName.trim(),
                email: newContactForm.email || "",
                phoneNumber: newContactForm.phoneNumber || "",
                role: newContactForm.role || "",
                dateOfBirth: newContactForm.dateOfBirth || "",
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
                role: "",
                dateOfBirth: "",
            });
        } catch (error) {
            console.error("Error creating contact:", error);
            const message =
                error instanceof Error && error.message?.trim()
                    ? error.message
                    : "Failed to create contact. Please try again.";
            toast.error(message, { id: loadingToast });
        } finally {
            setIsCreatingContact(false);
        }
    };

    // Handle Reassign Lead
    const handleReassignLead = (lead: any) => {
        setSelectedLeadForReassign(lead);
        setSelectedEmployeeId("");
        setIsReassignOpen(true);
    };

    // Handle Confirm Reassign
    const handleConfirmReassign = async () => {
        if (!selectedLeadForReassign || !selectedEmployeeId) {
            toast.error("Please select an employee to reassign");
            return;
        }

        setIsReassigning(true);
        const loadingToast = toast.loading("Reassigning lead...");

        try {
            const leadId = selectedLeadForReassign._id || selectedLeadForReassign.id;

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        assignedTo: selectedEmployeeId,
                    }),
                }
            );

            if (response.ok) {
                toast.success("Lead reassigned successfully!", { id: loadingToast });
                setIsReassignOpen(false);
                setSelectedLeadForReassign(null);
                setSelectedEmployeeId("");
                // Refresh leads list
                await fetchLeads(currentPage);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to reassign lead", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error reassigning lead:", error);
            toast.error("Failed to reassign lead. Please try again.", { id: loadingToast });
        } finally {
            setIsReassigning(false);
        }
    };

    // Handle Bulk Upload Template Download
    const handleDownloadBulkUploadTemplate = async () => {
        setIsGeneratingTemplate(true);
        try {
            // Prefer backend-generated template so server controls columns, validation, etc.
            const response = await authenticatedFetch(
                buildExternalUrl("/crm/leads/bulk-upload/template"),
                {
                    method: "GET",
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(
                    errorText || `Template download failed with status ${response.status}`
                );
            }

            const blob = await response.blob();

            // Try to extract filename from Content-Disposition; fall back to default
            const disposition = response.headers.get("Content-Disposition") || "";
            let fileName = "Lead_Bulk_Upload_Template.xlsx";
            const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^\";]+)"?/i);
            if (match) {
                fileName = decodeURIComponent(match[1] || match[2] || fileName);
            }

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success("Lead template downloaded!");
        } catch (error) {
            console.error("Error generating Excel template:", error);
            toast.error(
                `Failed to download template: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        } finally {
            setIsGeneratingTemplate(false);
        }
    };

    // Handle File Upload for Bulk Upload
    const handleBulkUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ||
            file.type.includes('spreadsheetml') || file.type.includes('excel');
        const isCSV = file.type === "text/csv" || file.name.endsWith(".csv");

        if (!isExcel && !isCSV) {
            toast.error("Please upload an Excel (.xlsx) or CSV (.csv) file");
            return;
        }

        try {
            let leads: CSVLead[];

            if (isExcel) {
                leads = await parseExcelFile(file);
                toast.success(`Successfully parsed ${leads.length} leads from Excel file`);
            } else {
                // Handle CSV
                const reader = new FileReader();
                leads = await new Promise((resolve, reject) => {
                    reader.onload = (e) => {
                        try {
                            const csvText = e.target?.result as string;
                            const parsedLeads = parseCSV(csvText);
                            resolve(parsedLeads);
                        } catch (error) {
                            reject(error);
                        }
                    };
                    reader.onerror = () => reject(new Error("Failed to read CSV file"));
                    reader.readAsText(file);
                });
                toast.success(`Successfully parsed ${leads.length} leads from CSV file`);
            }

            setUploadedFile(file);

            // Inline overlay: keep upload in-page; standalone route only outside inline mode
            if (!isInlineDealsMode) {
                router.push("/deals/leads/bulk-upload");
                setIsBulkUploadOpen(false);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            toast.error(message.startsWith("Row ") || message.includes("Missing required") ? message : `Could not read file: ${message}`);
            console.error("File parsing error:", error);
        }
    };

    const normalizeHeaderKey = (value: string) =>
        value
            ? value
                .toString()
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_|_$/g, "")
            : "";

    const getRowValue = (row: Record<string, string>, keys: string[]) => {
        for (const key of keys) {
            if (!key) continue;
            if (row[key]) return row[key];
            const normalized = normalizeHeaderKey(key);
            if (normalized && row[normalized]) {
                return row[normalized];
            }
        }
        return "";
    };

    const parseWorksheetRows = (worksheet: XLSX.WorkSheet | undefined): ExternalSheetRow[] => {
        if (!worksheet) return [];
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
        if (!rawRows.length) return [];
        const headers = rawRows[0].map((header) =>
            typeof header === "string" ? header.trim() : String(header ?? "").trim()
        );
        const rows: ExternalSheetRow[] = [];
        rawRows.slice(1).forEach((rowValues, rowIndex) => {
            const rowData: Record<string, string> = {};
            headers.forEach((header, columnIndex) => {
                if (!header) return;
                const rawValue = rowValues[columnIndex] ?? "";
                const value =
                    typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim();
                rowData[header] = value;
                const normalized = normalizeHeaderKey(header);
                if (normalized) {
                    rowData[normalized] = value;
                }
            });
            const hasValue = Object.values(rowData).some((cell) => cell && cell.trim() !== "");
            if (hasValue) {
                rows.push({ row: rowData, index: rowIndex + 2 });
            }
        });
        return rows;
    };

    const sanitizeCurrencyValue = (value: string) => {
        if (!value) return "";
        const cleaned = value.replace(/[^0-9eE+.\-]/g, "");
        if (!cleaned) return "";
        const numeric = Number(cleaned);
        if (!Number.isFinite(numeric)) {
            return "";
        }
        return numeric.toString();
    };

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const extractFieldFromNotes = (notes: string, label: string) => {
        if (!notes || !label) return "";
        const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:：]*\\s*([^\\n]+)`, "i");
        const match = notes.match(pattern);
        if (match && match[1]) {
            return match[1].replace(/:+$/, "").trim();
        }
        return "";
    };

    const capitalizeWord = (value: string) => {
        if (!value) return value;
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const deriveNameParts = (fullName: string, fallbackIndex: number) => {
        const safeName = fullName?.trim();
        if (!safeName) {
            return {
                firstName: `Lead ${fallbackIndex + 1}`,
                lastName: "Imported",
            };
        }
        const parts = safeName.split(/\s+/);
        if (parts.length === 1) {
            return {
                firstName: capitalizeWord(parts[0]),
                lastName: "Lead",
            };
        }
        const firstName = capitalizeWord(parts.shift() || "");
        const lastName = capitalizeWord(parts.join(" "));
        return {
            firstName: firstName || `Lead ${fallbackIndex + 1}`,
            lastName: lastName || "Imported",
        };
    };

    const convertExternalRowsToLeads = (rows: ExternalSheetRow[]) => {
        const converted: CSVLead[] = [];
        let skipped = 0;

        rows.forEach(({ row }, index) => {
            const email =
                getRowValue(row, ["email", "email address"]) || getRowValue(row, ["work email"]);
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                skipped += 1;
                return;
            }

            const clientName =
                getRowValue(row, ["client name", "contact name", "display name", "name"]) ||
                email.split("@")[0];
            const { firstName, lastName } = deriveNameParts(clientName, index);
            const notes = getRowValue(row, ["notes"]);
            const phoneNumber =
                getRowValue(row, ["phone number", "phone"]) || getRowValue(row, ["whatsapp number"]);
            const stage = getRowValue(row, ["lead stage", "stage"]);
            const assignedTo = getRowValue(row, ["assigned team member", "owner"]);
            const salesFunnel =
                getRowValue(row, ["groups", "sales funnel", "source"]) ||
                getRowValue(row, ["facebook form"]);
            const productName =
                getRowValue(row, ["facebook form"]) ||
                getRowValue(row, ["facebook page"]) ||
                getRowValue(row, ["facebook ad set"]);
            const opportunity = sanitizeCurrencyValue(
                getRowValue(row, ["opportunity size ($)", "opportunity size"])
            );

            const budget = extractFieldFromNotes(
                notes,
                "What Is Your Budget For Developing Your Mvp?"
            );
            const idea = extractFieldFromNotes(notes, "Please Explain Your Product Idea In Brief");
            const city = extractFieldFromNotes(notes, "City");

            converted.push({
                firstName,
                lastName,
                email,
                phoneNumber: phoneNumber || "",
                companyName: clientName || "",
                industry: "",
                website: "",
                address: notes || "",
                country: "",
                state: "",
                city: city || "",
                pinCode: "",
                productName: idea || productName || budget || "",
                quantity: "",
                pricing: "",
                negotiatedPricing: "",
                MaxDiscPrice: "",
                salesFunnel: salesFunnel || "",
                stage: stage || "",
                estRevenue: opportunity,
                assignedTo: assignedTo || "",
                notes: notes || "",
            });
        });

        return { convertedLeads: converted, skippedCount: skipped };
    };

    const processExternalWorkbook = async (workbook: XLSX.WorkBook, downloadName: string) => {
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new Error("The provided sheet is empty.");
        }
        const worksheet = workbook.Sheets[sheetName];
        const rows = parseWorksheetRows(worksheet);
        if (rows.length === 0) {
            throw new Error("No rows found in the provided sheet.");
        }
        const { convertedLeads, skippedCount } = convertExternalRowsToLeads(rows);
        if (convertedLeads.length === 0) {
            throw new Error("No valid leads were found to convert.");
        }

        const convertedWorkbook = await generateLeadTemplateWorkbook(convertedLeads);
        downloadWorkbookFile(convertedWorkbook, downloadName);
        setConverterStats({ converted: convertedLeads.length, skipped: skippedCount });
    };

    const buildGoogleSheetExportUrl = (shareUrl: string) => {
        const trimmed = shareUrl.trim();
        const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!idMatch) {
            throw new Error("Please provide a valid Google Sheets link.");
        }
        const gidMatch = trimmed.match(/[?&]gid=(\d+)/);
        const base = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=xlsx`;
        return gidMatch ? `${base}&gid=${gidMatch[1]}` : base;
    };

    const resetConverterState = () => {
        setConverterError(null);
        setConverterStats(null);
        if (converterFileInputRef.current) {
            converterFileInputRef.current.value = "";
        }
    };

    const handleConvertExternalLink = async () => {
        const trimmedLink = converterLink.trim();
        if (!trimmedLink) {
            setConverterError("Please enter a Google Sheets link.");
            return;
        }
        setConverterError(null);
        setConverterStats(null);
        setIsConvertingExternal(true);
        try {
            const exportUrl = buildGoogleSheetExportUrl(trimmedLink);
            const response = await fetch(exportUrl);
            if (!response.ok) {
                throw new Error("Unable to fetch sheet. Please ensure the link is publicly accessible.");
            }
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            await processExternalWorkbook(
                workbook,
                `Converted_Leads_${new Date().toISOString().split("T")[0]}.xlsx`
            );
            toast.success("Converted leads downloaded");
        } catch (error) {
            console.error("External conversion error:", error);
            const message = error instanceof Error ? error.message : "Failed to convert leads.";
            setConverterError(message);
            toast.error(message);
        } finally {
            setIsConvertingExternal(false);
        }
    };

    const handleConvertExternalFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setConverterError(null);
        setConverterStats(null);
        setIsConvertingExternal(true);
        try {
            const isCSV =
                file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
            const data = isCSV ? await file.text() : await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: isCSV ? "string" : "array" });
            const safeName = file.name.replace(/\.[^.]+$/, "") || "Converted_Leads";
            await processExternalWorkbook(workbook, `${safeName}_Converted.xlsx`);
            toast.success("Converted leads downloaded");
        } catch (error) {
            console.error("File conversion error:", error);
            const message = error instanceof Error ? error.message : "Failed to convert uploaded file.";
            setConverterError(message);
            toast.error(message);
        } finally {
            if (converterFileInputRef.current) {
                converterFileInputRef.current.value = "";
            }
            setIsConvertingExternal(false);
        }
    };

    const fetchAllLeadsForExport = useCallback(async () => {
        const pageSize = 2000;
        let skip = 0;
        let aggregatedLeads: any[] = [];
        let total: number | undefined;
        const trimmedSearchTerm = searchTerm.trim();

        while (true) {
            const params = new URLSearchParams({
                skip: skip.toString(),
                limit: pageSize.toString(),
            });

            if (selectedLeadStatus && selectedLeadStatus !== "all") {
                params.set("leadStatus", selectedLeadStatus);
            }

            if (trimmedSearchTerm.length > 0) {
                params.set("search", trimmedSearchTerm);
            } else if (selectedOwner && selectedOwner !== "all") {
                params.set("ownerName", selectedOwner);
            }

            if (selectedStage && selectedStage !== "all") {
                params.set("stage", selectedStage);
            }

            if (dateFrom && dateTo) {
                params.set("dateFrom", dateFrom);
                params.set("dateTo", dateTo);
            }

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads?${params.toString()}`),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch leads for export: ${response.statusText}`);
            }

            const data = await response.json();
            const batch = Array.isArray(data?.leads)
                ? data.leads
                : Array.isArray(data?.data)
                    ? data.data
                    : Array.isArray(data)
                        ? data
                        : [];

            aggregatedLeads = aggregatedLeads.concat(batch);

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

            if (total !== undefined && aggregatedLeads.length >= total) {
                break;
            }

            skip += pageSize;
        }

        return aggregatedLeads;
    }, [searchTerm, selectedLeadStatus, selectedOwner, selectedStage, dateFrom, dateTo]);

    // Handle Export to Excel — selected leads if any; otherwise all matching leads
    const handleExportLeads = useCallback(async () => {
        if (isExportingLeads) return;

        setIsExportingLeads(true);
        const hasSelection = selectedLeadIds.length > 0;
        const loadingToast = toast.loading(
            hasSelection
                ? `Preparing export of ${selectedLeadIds.length} selected lead(s)...`
                : "Preparing leads export..."
        );

        try {
            let leadsForExport: any[] = [];

            if (hasSelection) {
                const idSet = new Set(selectedLeadIds);
                const fromCache = selectedLeadIds
                    .map((id) => selectedLeadsCache[id])
                    .filter(Boolean);

                if (fromCache.length === selectedLeadIds.length) {
                    leadsForExport = fromCache;
                } else {
                    const allLeads = await fetchAllLeadsForExport();
                    leadsForExport = allLeads.filter((lead) => {
                        const id = lead?._id || lead?.id;
                        return id ? idSet.has(String(id)) : false;
                    });
                }
            } else {
                leadsForExport = await fetchAllLeadsForExport();
            }

            if (!leadsForExport || leadsForExport.length === 0) {
                toast.error(
                    hasSelection ? "No selected leads to export" : "No leads to export",
                    { id: loadingToast }
                );
                return;
            }

            const headers = [
                "Lead Name",
                "Contact Name",
                "Contact Email",
                "Contact Phone",
                "Company",
                "Owner",
                "Owner Email",
                "Country",
                "State",
                "City",
                "Tags",
                "Funnel",
                "Stage",
                "Value",
                "Priority",
                "Source",
                "Status",
                "Next Follow-up",
                "Estimated Close",
                "Created At",
            ];

            const rows = leadsForExport.map((lead) => {
                const ownerDetails = getOwnerDetails(lead);
                const normalizedTags = getTags(lead)
                    .map((tag: any) => {
                        if (typeof tag === "string") return tag.trim();
                        if (tag && typeof tag === "object") {
                            return String(tag.name || tag.label || tag.value || "").trim();
                        }
                        return "";
                    })
                    .filter(Boolean)
                    .join(", ");
                const funnelName =
                    lead?.salesFunnel?.funnelName ||
                    lead?.salesFunnel?.name ||
                    lead?.salesFunnel?.salesFunnel ||
                    lead?.funnel?.funnelName ||
                    lead?.funnel?.name ||
                    (typeof lead?.salesFunnel === "string" ? lead.salesFunnel : "") ||
                    (typeof lead?.salesFunnelName === "string" ? lead.salesFunnelName : "") ||
                    "";
                const stageName = normalizeLeadStageValue(lead?.stage);
                const countryName =
                    lead?.country ||
                    lead?.company?.country ||
                    lead?.contact?.country ||
                    "";
                const stateName =
                    lead?.state ||
                    lead?.company?.state ||
                    lead?.contact?.state ||
                    "";
                const cityName =
                    lead?.city ||
                    lead?.company?.city ||
                    lead?.contact?.city ||
                    getCityFromLeadText(lead) ||
                    "";
                return [
                    getLeadName(lead) || "--",
                    getContactName(lead) || "N/A",
                    lead.contact?.email || lead.email || "",
                    getContactPhone(lead),
                    lead.company?.companyName || lead.companyName || "",
                    ownerDetails.name || "Unassigned",
                    ownerDetails.email || "",
                    countryName,
                    stateName,
                    cityName,
                    normalizedTags,
                    funnelName,
                    stageName,
                    lead.negotiatedPricing || lead.pricing || lead.estimatedValue || "0",
                    lead.priority || "",
                    lead.source || "",
                    lead.leadStatus || "active",
                    getNextFollowUp(lead),
                    getEstimatedClose(lead),
                    lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "",
                ];
            });

            const excelData = [headers, ...rows];
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(excelData);
            const columnWidths = [
                { wch: 25 }, // Lead Name
                { wch: 20 }, // Contact Name
                { wch: 25 }, // Contact Email
                { wch: 15 }, // Contact Phone
                { wch: 20 }, // Company
                { wch: 20 }, // Owner
                { wch: 25 }, // Owner Email
                { wch: 16 }, // Country
                { wch: 16 }, // State
                { wch: 16 }, // City
                { wch: 28 }, // Tags
                { wch: 22 }, // Funnel
                { wch: 15 }, // Stage
                { wch: 15 }, // Value
                { wch: 12 }, // Priority
                { wch: 15 }, // Source
                { wch: 12 }, // Status
                { wch: 15 }, // Next Follow-up
                { wch: 18 }, // Estimated Close
                { wch: 15 }, // Created At
            ];
            worksheet["!cols"] = columnWidths;
            XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

            const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Leads_Export_${new Date().toISOString().split("T")[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success(
                hasSelection
                    ? `${leadsForExport.length} selected lead(s) exported successfully!`
                    : `${leadsForExport.length} lead(s) exported successfully!`,
                { id: loadingToast }
            );
        } catch (error) {
            console.error("Error exporting leads:", error);
            toast.error("Failed to export leads. Please try again.", { id: loadingToast });
        } finally {
            setIsExportingLeads(false);
        }
    }, [fetchAllLeadsForExport, isExportingLeads, selectedLeadIds, selectedLeadsCache]);

    const handleRefreshLeads = useCallback(async () => {
        if (isRefreshingLeads || isLoading) return;

        setIsRefreshingLeads(true);
        try {
            await fetchLeads(currentPage);
            window.dispatchEvent(new CustomEvent(DEALS_CRM_STATS_REFRESH_EVENT));
            toast.success("Leads refreshed");
        } catch (error) {
            console.error("Error refreshing leads:", error);
            toast.error("Failed to refresh leads");
        } finally {
            setIsRefreshingLeads(false);
        }
    }, [currentPage, isRefreshingLeads, isLoading]);

    // Filter leads based on search and filters (client-side filtering on current page)
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const selectedStageList = splitMultiParam(selectedStage).map((s) => s.toLowerCase());
    const selectedOwnerList = splitMultiParam(selectedOwner).map((o) => o.toLowerCase());

    const filteredLeads = leads.filter((lead) => {
        const leadStageRaw =
            typeof lead.stage === "string"
                ? lead.stage
                : lead.stage?.name || lead.stage?.stage || lead.stage?.stageName || "";
        const leadStageStr = String(leadStageRaw || "").trim().toLowerCase();
        const leadOwnerStr = getOwnerName(lead).toLowerCase();

        if (selectedStageList.length > 0 && !selectedStageList.includes(leadStageStr)) {
            return false;
        }
        if (selectedOwnerList.length > 0 && !selectedOwnerList.includes(leadOwnerStr)) {
            return false;
        }

        if (normalizedSearch) {
            // Server already applied the search parameter; show all returned leads
            return true;
        }

        const matchesSearch =
            getLeadName(lead).toLowerCase().includes(normalizedSearch) ||
            getContactName(lead).toLowerCase().includes(normalizedSearch) ||
            getOwnerName(lead).toLowerCase().includes(normalizedSearch);

        return matchesSearch;
    });

    // Keep a cache of selected lead objects so previews still work across pages
    useEffect(() => {
        setSelectedLeadsCache((prev) => {
            let changed = false;
            const next = { ...prev };

            for (const lead of leads) {
                const rawId = lead?._id || lead?.id;
                if (!rawId) continue;
                const id = String(rawId);
                if (selectedLeadIds.includes(id)) {
                    if (next[id] !== lead) {
                        next[id] = lead;
                        changed = true;
                    }
                }
            }

            for (const id of Object.keys(next)) {
                if (!selectedLeadIds.includes(id)) {
                    delete next[id];
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [leads, selectedLeadIds]);

    const displayedLeadIds = useMemo(
        () =>
            filteredLeads
                .map((lead) => {
                    const id = lead?._id || lead?.id;
                    return id ? String(id) : null;
                })
                .filter((id): id is string => Boolean(id)),
        [filteredLeads]
    );

    const selectedLeads = useMemo(
        () =>
            selectedLeadIds
                .map((id) => selectedLeadsCache[id])
                .filter(Boolean),
        [selectedLeadIds, selectedLeadsCache]
    );

    const selectedLeadsPreview = useMemo(() => selectedLeads.slice(0, 5), [selectedLeads]);
    const remainingSelectedLeads =
        selectedLeads.length > selectedLeadsPreview.length
            ? selectedLeads.length - selectedLeadsPreview.length
            : 0;

    const allDisplayedSelected =
        displayedLeadIds.length > 0 && displayedLeadIds.every((id) => selectedLeadIds.includes(id));
    const partiallySelected =
        !allDisplayedSelected && displayedLeadIds.some((id) => selectedLeadIds.includes(id));
    const headerCheckboxValue = allDisplayedSelected ? true : partiallySelected ? "indeterminate" : false;
    const hasSelectedLeads = selectedLeadIds.length > 0;

    const handleToggleLeadSelection = useCallback((leadId: string, shouldSelect: boolean) => {
        setSelectedLeadIds((prev) => {
            if (shouldSelect) {
                if (prev.includes(leadId)) return prev;
                return [...prev, leadId];
            }
            return prev.filter((id) => id !== leadId);
        });
    }, []);

    const handleToggleSelectAllDisplayed = useCallback(
        (shouldSelect: boolean) => {
            if (displayedLeadIds.length === 0) {
                if (!shouldSelect) {
                    setSelectedLeadIds([]);
                }
                return;
            }

            setSelectedLeadIds((prev) => {
                if (shouldSelect) {
                    const merged = new Set([...prev, ...displayedLeadIds]);
                    return Array.from(merged);
                }
                return prev.filter((id) => !displayedLeadIds.includes(id));
            });
        },
        [displayedLeadIds]
    );

    const handleOwnerChange = (value: string) => {
        setSelectedOwner(value);
        setCurrentPage(1);
    };

    const handleStageChange = (value: string) => {
        setSelectedStage(value);
        setCurrentPage(1);
    };

    const handleOpenAddLead = async () => {
        setEditingLeadId(null);
        const defaultForm = buildDefaultLeadForm();
        setLeadForm(defaultForm);
        fetchProducts();
        setSelectedContactOption(null);
        setSelectedCompanyOption(null);
        setSelectedOwnerOption(null);
        setContactSearchTerm("");
        setCompanySearchTerm("");
        setOwnerSearchTerm("");
        setIsOwnerComboOpen(false);
        setFunnelStages([]);
        setLeadNotes([]);

        // Set loading state immediately if funnels are empty to prevent showing "No funnels found"
        if (funnels.length === 0) {
            setIsLoadingFunnels(true);
        }

        setIsAddLeadOpen(true);

        // Refresh dropdown data when dialog opens
        await fetchDropdownData();

        if (defaultForm.salesFunnelId) {
            await fetchFunnelStages(defaultForm.salesFunnelId);
        } else {
            setFunnelStages([]);
        }
    };

    useEffect(() => {
        const onOpenAddLead = () => {
            void handleOpenAddLead();
        };
        window.addEventListener("deals:open-add-lead", onOpenAddLead);
        return () => window.removeEventListener("deals:open-add-lead", onOpenAddLead);
    }, []);

    const handleEditLead = async (leadObject: any) => {
        console.log("!!! SMOKE TEST - handleEditLead CALLED !!!", leadObject);
        const lead = (typeof leadObject === "object" && leadObject !== null) ? leadObject : {};
        const id = typeof leadObject === "string" ? leadObject : leadObject._id || leadObject.id;
        if (!id) {
            console.error("!!! SMOKE TEST - NO VALID ID FOUND !!!", leadObject);
            toast.error("Unable to determine lead ID");
            return;
        }

        setEditingLeadId(id);
        fetchProducts();
        // Optimistically open modal to show we are doing something
        setIsAddLeadOpen(true);

        // Reset form states potentially?
        // setLeadForm(buildDefaultLeadForm());

        setFunnelStages([]);
        const loadingToast = toast.loading("Loading lead details...");

        try {
            console.log("!!! SMOKE TEST - FETCHING LEAD DETAILS !!!", `/crm/leads/${id}`);
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${id}`),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                console.error("!!! SMOKE TEST - FETCH FAILED !!!", response.status, await response.text());
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 404) {
                    toast.error("Lead not found", { id: loadingToast });
                } else {
                    toast.error(errorData.message || "Failed to load lead details", { id: loadingToast });
                }
                return;
            }

            const data = await response.json();
            console.log("!!! SMOKE TEST - CLICKED EDIT - RESPONSE RECEIVED !!!", data);
            const leadData = data.lead || data.data || data;

            console.log("[DEBUG-EDIT-LEAD] Full Lead Data:", leadData);
            console.log("[DEBUG-EDIT-LEAD] Assigned To Raw:", leadData.assignedTo);
            console.log("[DEBUG-EDIT-LEAD] Assigned Users:", leadData.assignedUsers);
            console.log("[DEBUG-EDIT-LEAD] Owner Field:", leadData.owner);
            console.log("[DEBUG-EDIT-LEAD] Contact ID:", leadData.contactId);
            console.log("[DEBUG-EDIT-LEAD] Contact Obj:", leadData.contact);
            console.log("[DEBUG-EDIT-LEAD] Company ID:", leadData.companyId);
            console.log("[DEBUG-EDIT-LEAD] Company Obj:", leadData.company);

            if (!leadData) {
                toast.error("Lead details not found", { id: loadingToast });
                return;
            }

            // Ensure related contact/company exist in dropdowns
            // Ensure related contact/company exist in dropdowns
            // Fallback to contacts array if contact object is missing
            const contactSource = leadData.contact || (leadData.contacts && leadData.contacts.length > 0 ? leadData.contacts[0] : null);
            const contactId = leadData.contactId || contactSource?.id || contactSource?._id || "";

            console.warn("[DEBUG] handleEditLead - Contact Logic:", {
                contactSource,
                contactId,
                hasId: !!contactId,
                origContact: leadData.contact,
                contactsArray: leadData.contacts
            });

            let finalContact = contactSource;
            if (!finalContact && contactId) {
                try {
                    console.warn("[DEBUG] Fetching missing contact details for ID:", contactId);
                    const contactResponse = await authenticatedFetch(
                        buildExternalUrl(`/crm/contacts/${contactId}`),
                        { method: "GET" }
                    );
                    if (contactResponse.ok) {
                        const contactData = await contactResponse.json();
                        finalContact = contactData.contact || contactData.data || contactData;
                    }
                } catch (error) {
                    console.error("Error fetching contact details:", error);
                }
            }

            if (finalContact && contactId) {
                const contactIdStr = String(contactId);
                const option = toContactOption(finalContact);
                console.warn("[DEBUG] handleEditLead - Created Contact Option:", option);

                setContacts((prev) => {
                    if (prev.some((contact) => contact.id === contactIdStr)) {
                        return prev;
                    }
                    return option ? [...prev, option] : prev;
                });
                if (option) {
                    console.warn("[DEBUG] Setting SelectedContactOption:", option.name);
                    setSelectedContactOption(option);
                }
            }

            // Fallback to companies array if company object is missing
            const companySource = leadData.company || (leadData.companies && leadData.companies.length > 0 ? leadData.companies[0] : null);
            const companyId = leadData.companyId || companySource?.id || companySource?._id || "";

            console.warn("[DEBUG] handleEditLead - Company Logic:", {
                companySource,
                companyId,
                hasId: !!companyId,
                origCompany: leadData.company,
                companiesArray: leadData.companies
            });

            let finalCompany = companySource;
            if (!finalCompany && companyId) {
                try {
                    console.warn("[DEBUG] Fetching missing company details for ID:", companyId);
                    const companyResponse = await authenticatedFetch(
                        buildExternalUrl(`/crm/companies/${companyId}`),
                        { method: "GET" }
                    );
                    if (companyResponse.ok) {
                        const companyData = await companyResponse.json();
                        finalCompany = companyData.company || companyData.data || companyData;
                    }
                } catch (error) {
                    console.error("Error fetching company details:", error);
                }
            }

            if (finalCompany && companyId) {
                const companyIdStr = String(companyId);
                const option = toCompanyOption(finalCompany);
                console.warn("[DEBUG] handleEditLead - Created Company Option:", option);

                setCompanies((prev) => {
                    if (prev.some((company) => company.id === companyIdStr)) {
                        return prev;
                    }
                    return option ? [...prev, option] : prev;
                });
                if (option) {
                    console.warn("[DEBUG] Setting SelectedCompanyOption:", option.name);
                    setSelectedCompanyOption(option);
                }
            }

            const assignedOwnerId = getPrimaryOwnerId(leadData) || getPrimaryOwnerId(lead) || leadForm.assignedTo || buildDefaultLeadForm().assignedTo;
            console.log("[DEBUG-EDIT-LEAD] Calculated Assigned Owner ID:", assignedOwnerId);
            console.log("[DEBUG-EDIT-LEAD] Available Owners Count:", owners.length);
            if (owners.length > 0) {
                console.log("[DEBUG-EDIT-LEAD] First Owner ID:", owners[0].id);
            }
            const ownerIdStr = assignedOwnerId ? String(assignedOwnerId) : "";
            if (ownerIdStr) {
                const existingOwner = owners.find(
                    (ownerOption) =>
                        ownerOption.id === ownerIdStr ||
                        (ownerOption._id && ownerOption._id === ownerIdStr) ||
                        (ownerOption.userId && ownerOption.userId === ownerIdStr)
                );
                if (existingOwner) {
                    setSelectedOwnerOption(existingOwner);
                } else {
                    // Prioritize assignedUsers as it contains the populated user objects
                    // assignedTo might be just an ID or array of IDs
                    // assignedTo needs to be checked carefully - if it's an ID (string) or array of IDs, we can't use it for option source
                    const ownerSource =
                        (Array.isArray(leadData.assignedUsers) && leadData.assignedUsers.length > 0 ? leadData.assignedUsers[0] : undefined) ||
                        (Array.isArray(lead.assignedUsers) && lead.assignedUsers.length > 0 ? lead.assignedUsers[0] : undefined) ||
                        (typeof leadData.assignedTo === 'object' && !Array.isArray(leadData.assignedTo) ? leadData.assignedTo : undefined) ||
                        (typeof lead.assignedTo === 'object' && !Array.isArray(lead.assignedTo) ? lead.assignedTo : undefined) ||
                        leadData.owner ||
                        lead.owner;

                    const ownerOption = toOwnerOption(ownerSource);

                    if (ownerOption) {
                        setOwners((prev) => {
                            if (prev.some((option) => option.id === ownerOption.id)) {
                                return prev;
                            }
                            return [...prev, ownerOption];
                        });
                        setSelectedOwnerOption(ownerOption);
                    } else {
                        setSelectedOwnerOption(null);
                    }
                }
            } else {
                setSelectedOwnerOption(null);
            }
            const salesFunnelId =
                leadData.salesFunnelId ||
                leadData.salesFunnel?._id ||
                leadData.salesFunnel?.id ||
                leadData.salesFunnel ||
                lead.salesFunnelId ||
                lead.salesFunnel?._id ||
                lead.salesFunnel?.id ||
                lead.salesFunnel ||
                "";

            const phoneCandidates = [
                ...(Array.isArray((leadData as any)?.phoneNumbers) ? (leadData as any).phoneNumbers : []),
                (leadData as any)?.phone,
                (leadData as any)?.mobile,
                ...(Array.isArray((lead as any)?.phoneNumbers) ? (lead as any).phoneNumbers : []),
                (lead as any)?.phone,
                (lead as any)?.mobile,
            ]
                .map((item) => String(item ?? "").trim())
                .filter(Boolean);
            const uniquePhones = Array.from(new Set(phoneCandidates));
            const resolvedPhone =
                uniquePhones.length > 0
                    ? uniquePhones.join(", ")
                    : getContactPhone({
                        ...lead,
                        ...leadData,
                        contact: leadData.contact || lead.contact,
                        contacts: leadData.contacts || lead.contacts,
                    });

            const resolvedStage =
                normalizeLeadStageValue(leadData.stage) ||
                normalizeLeadStageValue(lead.stage) ||
                "Prospects";

            const updatedForm = {
                ...initialLeadFormState,
                leadName: leadData.leadName || leadData.name || lead.leadName || getLeadName(lead),
                contactId: contactId || lead.contactId || "",
                phone: resolvedPhone,
                initialStage: resolvedStage,
                source: leadData.source || lead.source || "",
                // Ensure notes is a string for the Textarea; prefer first entry from array
                notes:
                    Array.isArray(leadData.notes)
                        ? (leadData.notes[0]?.notes || leadData.notes[0]?.description || "")
                        : typeof leadData.notes === "string"
                            ? leadData.notes
                            : Array.isArray(lead.notes)
                                ? (lead.notes[0]?.notes || lead.notes[0]?.description || "")
                                : typeof lead.notes === "string"
                                    ? lead.notes
                                    : "",
                companyId: companyId || lead.companyId || "",
                email: leadData.email || leadData.contact?.email || lead.contact?.email || lead.email || "",
                salesFunnelId: salesFunnelId || "",
                estimatedValue: String(leadData.negotiatedPricing || leadData.pricing || leadData.estimatedValue || lead.negotiatedPricing || lead.pricing || lead.estimatedValue || 0),
                assignedTo: assignedOwnerId || "",
                priority: leadData.priority || lead.priority || "",
                nextFollowUp: formatDateForInput(leadData.nextFollowUp || lead.nextFollowUp),
                followUpIntervalDays: String(
                    leadData.followUpIntervalDays ||
                    leadData.followUpDuration ||
                    lead.followUpIntervalDays ||
                    lead.followUpDuration ||
                    ""
                ),
                autoFollowUpEndDate: formatDateForInput(
                    leadData.autoFollowUpEndDate ||
                    leadData.followUpEndDate ||
                    lead.autoFollowUpEndDate ||
                    lead.followUpEndDate
                ),
                estimatedClose: formatDateForInput(leadData.estimatedClose || lead.estimatedClose),
                tags: Array.isArray(leadData.tags)
                    ? leadData.tags.join(", ")
                    : Array.isArray(lead.tags)
                        ? lead.tags.join(", ")
                        : (leadData.tags || lead.tags || ""),
                autoFollowUp: leadData.autoFollowUp === true || leadData.autoFollowUp === "on" || lead.autoFollowUp === true || lead.autoFollowUp === "on" || false,
                products: Array.isArray(leadData.products)
                    ? leadData.products.map((p: any) => ({
                        productId: p.productId || p._id || p.id,
                        quantity: p.quantity || 1,
                        pricing: p.pricing || p.price || 0,
                        unit: p.unit || "",
                    }))
                    : Array.isArray(lead.products)
                        ? lead.products.map((p: any) => ({
                            productId: p.productId || p._id || p.id,
                            quantity: p.quantity || 1,
                            pricing: p.pricing || p.price || 0,
                            unit: p.unit || "",
                        }))
                        : [],
            };

            setEditingLeadId(id);
            setLeadForm(updatedForm);
            const notesArray = Array.isArray(leadData.notes) ? leadData.notes : Array.isArray(lead.notes) ? lead.notes : [];
            setLeadNotes(notesArray);
            setNoteForm({
                description: notesArray.length > 0 ? notesArray[0]?.notes || notesArray[0]?.description || "" : leadData.notes || lead.notes || "",
            });
            setIsAddLeadOpen(true);

            if (salesFunnelId) {
                await fetchFunnelStages(salesFunnelId);
                setLeadForm((prev) => ({
                    ...prev,
                    salesFunnelId,
                    initialStage: resolvedStage || prev.initialStage,
                }));

                // Safely ensure the current lead stage exists in funnel stages list
                if (resolvedStage) {
                    const leadStageLower = resolvedStage.toLowerCase();

                    setFunnelStages((prev) => {
                        const stageExists = prev.some((stage: any) => {
                            const stageName = stage?.name || stage?.value || stage;
                            return (
                                typeof stageName === "string" &&
                                stageName.toLowerCase() === leadStageLower
                            );
                        });

                        if (stageExists) {
                            return prev;
                        }

                        return [...prev, { name: resolvedStage, value: resolvedStage }];
                    });
                }
            } else {
                setFunnelStages([]);
            }

            toast.success("Lead ready to edit", { id: loadingToast });
        } catch (error) {
            console.error("Error loading lead details:", error);
            toast.error("Failed to load lead. Please try again.", { id: loadingToast });
        }
    };

    const handleDeleteLead = (lead: any) => {
        setLeadToDelete(lead);
        setIsDeleteLeadOpen(true);
    };

    const handleConfirmDeleteLead = async () => {
        if (!leadToDelete) return;

        const leadId = leadToDelete._id || leadToDelete.id;
        if (!leadId) {
            toast.error("Unable to determine lead ID");
            return;
        }

        setIsDeletingLead(true);
        const loadingToast = toast.loading("Deleting lead...");

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.ok) {
                toast.success("Lead deleted successfully!", { id: loadingToast });
                setIsDeleteLeadOpen(false);
                setLeadToDelete(null);
                const updatedLeads = await fetchLeads(currentPage);
                if (updatedLeads.length === 0 && currentPage > 1) {
                    const previousPage = currentPage - 1;
                    setCurrentPage(previousPage);
                    await fetchLeads(previousPage);
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to delete lead", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error deleting lead:", error);
            toast.error("Failed to delete lead. Please try again.", { id: loadingToast });
        } finally {
            setIsDeletingLead(false);
        }
    };

    const handleConfirmBulkDelete = async () => {
        if (selectedLeadIds.length === 0) {
            setIsBulkDeleteDialogOpen(false);
            return;
        }

        setIsBulkDeleting(true);
        const loadingToast = toast.loading("Deleting selected leads...");

        try {
            const response = await authenticatedFetch(
                buildExternalUrl("/crm/leads/bulk-delete"),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        leadIds: selectedLeadIds,
                        confirmDelete: true,
                    }),
                }
            );

            if (!response.ok) {
                let errorMessage = "Failed to delete leads";
                try {
                    const errorData = await response.json();
                    errorMessage =
                        errorData?.message ||
                        errorData?.error ||
                        errorData?.description ||
                        (typeof errorData?.details === "string" ? errorData.details : undefined) ||
                        (typeof errorData?.errorMessage === "string" ? errorData.errorMessage : undefined) ||
                        errorMessage;
                } catch (parseError) {
                    const text = await response.text().catch(() => "");
                    if (text) {
                        errorMessage = text;
                    }
                }
                throw new Error(errorMessage);
            }

            await response.json().catch(() => undefined);
            const count = selectedLeadIds.length;
            toast.success(
                `${count} lead${count === 1 ? "" : "s"} deleted successfully.`,
                { id: loadingToast }
            );
            setIsBulkDeleteDialogOpen(false);
            setSelectedLeadIds([]);
            setSelectedLeadsCache({});
            const updatedLeads = await fetchLeads(currentPage);
            if (updatedLeads.length === 0 && currentPage > 1) {
                const previousPage = currentPage - 1;
                setCurrentPage(previousPage);
                await fetchLeads(previousPage);
            }
        } catch (error) {
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to delete leads. Please try again.";
            toast.error(message, { id: loadingToast });
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Pagination calculations
    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalLeads);


    // Push state changes to URL (standalone /deals routes only — not inline overlay)
    useEffect(() => {
        if (isInlineDealsMode) return;

        const params = new URLSearchParams(searchParams.toString());

        if (searchTerm) params.set("search", searchTerm);
        else params.delete("search");

        if (selectedStage !== "all") params.set("stage", selectedStage);
        else params.delete("stage");

        if (selectedOwner !== "all") params.set("ownerName", selectedOwner);
        else params.delete("ownerName");

        if (selectedLeadStatus !== "all") params.set("leadStatus", selectedLeadStatus);
        else params.delete("leadStatus");

        if (selectedFunnel !== "all") params.set("salesFunnel", selectedFunnel);
        else params.delete("salesFunnel");

        if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
        else params.delete("tags");

        if (dateFrom && dateTo) {
            params.set("dateFrom", dateFrom);
            params.set("dateTo", dateTo);
        } else {
            params.delete("dateFrom");
            params.delete("dateTo");
        }

        if (currentPage > 1) params.set("page", currentPage.toString());
        else params.delete("page");

        // Tab is URL-driven by `setActiveTab` (do not re-write it here).

        const newQuery = params.toString();
        const currentQuery = searchParams.toString();

        if (newQuery !== currentQuery) {
            router.replace(`?${newQuery}`, { scroll: false });
        }
    }, [isInlineDealsMode, searchTerm, selectedStage, selectedOwner, selectedLeadStatus, selectedFunnel, selectedTags, dateFrom, dateTo, currentPage, activeTab, router, searchParams]);

    // Handle URL changes (e.g. browser navigation)
    useEffect(() => {
        if (isInlineDealsMode) return;

        const urlSearch = searchParams.get("search") || "";
        const urlStage = searchParams.get("stage") || "all";
        const urlOwner = searchParams.get("ownerName") || "all";
        const urlStatus = searchParams.get("leadStatus") || "all";
        const urlFunnel = searchParams.get("salesFunnel") || "all";
        const urlDateFrom = searchParams.get("dateFrom") || "";
        const urlDateTo = searchParams.get("dateTo") || "";
        const urlTagsStr = searchParams.get("tags");
        const urlTags = urlTagsStr ? urlTagsStr.split(",") : [];
        const urlPageStr = searchParams.get("page");
        const urlPage = urlPageStr ? parseInt(urlPageStr) : 1;
        const hasExplicitUrlFilterState =
            searchParams.has("search") ||
            searchParams.has("stage") ||
            searchParams.has("ownerName") ||
            searchParams.has("leadStatus") ||
            searchParams.has("salesFunnel") ||
            searchParams.has("dateFrom") ||
            searchParams.has("dateTo") ||
            searchParams.has("tags") ||
            searchParams.has("page");
        // On first mount, initialise state from URL (supports deep links / reloads)
        if (!isUrlStateInitializedRef.current) {
            isUrlStateInitializedRef.current = true;
            // If URL has no filter params, keep state initialized from session storage.
            if (!hasExplicitUrlFilterState) {
                return;
            }
            if (urlSearch !== searchTerm) setSearchTerm(urlSearch);
            if (urlStage !== selectedStage) setSelectedStage(urlStage);
            if (urlOwner !== selectedOwner) setSelectedOwner(urlOwner);
            if (urlStatus !== selectedLeadStatus) setSelectedLeadStatus(urlStatus);
            if (urlFunnel !== selectedFunnel) setSelectedFunnel(urlFunnel);
            if (urlDateFrom !== dateFrom) setDateFrom(urlDateFrom);
            if (urlDateTo !== dateTo) setDateTo(urlDateTo);
            if (JSON.stringify(urlTags) !== JSON.stringify(selectedTags)) {
                setSelectedTags(urlTags);
            }
            if (urlPage !== currentPage) {
                setCurrentPage(urlPage);
            }
            return;
        }

        // After initialisation, let component state drive the URL; avoid
        // overwriting current search/filter state on background router.refresh.
    }, [searchParams, searchTerm, selectedStage, selectedOwner, selectedLeadStatus, selectedFunnel, selectedTags, dateFrom, dateTo, currentPage, activeTab]);

    // Persist filter state so navigation away/back keeps the same deals view.
    useEffect(() => {
        if (typeof window === "undefined") return;

        const hasAnyActiveState =
            searchTerm.trim().length > 0 ||
            selectedStage !== "all" ||
            selectedOwner !== "all" ||
            selectedLeadStatus !== "all" ||
            selectedFunnel !== "all" ||
            selectedTags.length > 0 ||
            Boolean(dateFrom && dateTo) ||
            currentPage > 1;

        if (!hasAnyActiveState) {
            window.sessionStorage.removeItem(LEADS_FILTER_STORAGE_KEY);
            return;
        }

        const payload: PersistedLeadsFilters = {
            searchTerm,
            selectedStage,
            selectedOwner,
            selectedLeadStatus,
            selectedFunnel,
            selectedTags,
            dateFrom,
            dateTo,
            currentPage,
        };

        window.sessionStorage.setItem(LEADS_FILTER_STORAGE_KEY, JSON.stringify(payload));
    }, [searchTerm, selectedStage, selectedOwner, selectedLeadStatus, selectedFunnel, selectedTags, dateFrom, dateTo, currentPage]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        // Scroll to top of table when page changes
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Main fetch effect - handles non-search and cleared-search state
    useEffect(() => {
        if (activeTab !== "leads") return;

        const trimmed = searchTerm.trim();
        // Apply date filter only when both boundaries are provided.
        if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
            return;
        }
        // When there is no search term, always fetch immediately on filters/page changes
        if (trimmed === "") {
            fetchLeads(currentPage);
        }
    }, [activeTab, searchTerm, currentPage, limit, selectedStage, selectedOwner, selectedLeadStatus, selectedFunnel, selectedTags, dateFrom, dateTo]);

    // Debounced search fetch for non-empty search term
    useEffect(() => {
        if (activeTab !== "leads") return;

        const trimmed = searchTerm.trim();
        if (trimmed === "") return;
        // Apply date filter only when both boundaries are provided.
        if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) return;

        if (!isSearchInitializedRef.current) {
            isSearchInitializedRef.current = true;
            // If there's an initial search term from URL, fetch immediately
            fetchLeads(currentPage);
            return;
        }

        // Show loading state immediately so user sees spinner instead of stale data
        setIsLoading(true);

        const handler = setTimeout(() => {
            fetchLeads(currentPage);
        }, 400);

        return () => clearTimeout(handler);
    }, [activeTab, searchTerm, currentPage, limit, selectedStage, selectedOwner, selectedLeadStatus, selectedFunnel, selectedTags, dateFrom, dateTo]);

    // Refetch when Facebook (or elsewhere) imports leads into CRM
    useEffect(() => {
        const handler = () => {
            setCurrentPage(1);
            if (activeTab === "leads") {
                fetchLeads(1);
            }
        };

        window.addEventListener(DEALS_LEADS_REFRESH_EVENT, handler);
        return () => window.removeEventListener(DEALS_LEADS_REFRESH_EVENT, handler);
    }, [activeTab]);

    // Auto-refresh leads - DISABLED to prevent continuous API calls
    // Uncomment and adjust interval if real-time updates are needed
    // useEffect(() => {
    //   const intervalId = setInterval(() => {
    //     // Only auto-refresh if user is not actively interacting (not loading, not submitting)
    //     if (!isLoading && !isSubmittingLead && !isReassigning && !isChangingStage && !isDeletingLead) {
    //       fetchLeads(currentPage);
    //     }
    //   }, 30000); // 30 seconds

    //   return () => clearInterval(intervalId);
    // }, [currentPage, isLoading, isSubmittingLead, isReassigning, isChangingStage, isDeletingLead]);

    useDealsInlineRefresh("leads", () => {
        fetchLeads(currentPage);
    });

    // Fetch filter data (stages and owners)
    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                // Fetch all funnels to get all stages
                const funnelsResponse = await authenticatedFetch(
                    buildExternalUrl("/crm/funnels?skip=0&limit=1000"),
                    { method: "GET" }
                );
                if (funnelsResponse.ok) {
                    const funnelsData = await funnelsResponse.json();
                    const funnelsList = funnelsData.funnels || funnelsData.data || funnelsData || [];

                    // Populate available filter funnels
                    const mappedFunnels = funnelsList
                        .map((funnel: any) => {
                            const id = funnel._id || funnel.id || "";
                            const name = funnel.funnelName || funnel.name || "";
                            return { id, name };
                        })
                        .filter((funnel: any) => funnel.id && funnel.name);
                    setAvailableFilterFunnels(mappedFunnels);

                    // Extract all unique stages from all funnels
                    const allStages = new Set<string>();
                    funnelsList.forEach((funnel: any) => {
                        const stages = funnel.funnelStage || funnel.stages || [];
                        if (Array.isArray(stages)) {
                            stages.forEach((stage: any) => {
                                const stageName = typeof stage === "string"
                                    ? stage
                                    : (stage?.name || stage?.stageName || "");
                                if (stageName && stageName.trim() !== "" && stageName !== "all") {
                                    allStages.add(stageName.trim());
                                }
                            });
                        }
                    });

                    setAvailableFilterStages(Array.from(allStages).sort());
                }

                // Fetch owners for current workspace only
                const ownersOrgId =
                    (typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null) ||
                    organizationId ||
                    "";
                let ownersList: any[] = [];
                if (ownersOrgId) {
                    try {
                        ownersList = await getTeamMembers(ownersOrgId);
                    } catch {
                        const ownersResponse = await authenticatedFetch(
                            buildExternalUrl(
                                `/crm/organization-users?organizationId=${ownersOrgId}&limit=1000`
                            ),
                            { method: "GET" }
                        );
                        if (ownersResponse?.ok) {
                            const ownersData = await ownersResponse.json();
                            ownersList =
                                ownersData?.users ||
                                ownersData?.members ||
                                ownersData?.data?.users ||
                                ownersData?.data?.members ||
                                ownersData?.data ||
                                ownersData ||
                                [];
                        }
                    }
                }

                if (Array.isArray(ownersList) && ownersList.length > 0) {
                    const ownerOptions = ownersList
                        .map((user: any) => {
                            const id = user._id || user.id || "";
                            const name = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown";
                            return { id, name };
                        })
                        .filter((owner: any) => owner.id && owner.name);
                    setAvailableFilterOwners(ownerOptions);
                }
                else {
                    console.warn("Failed to load owners for leads filter");
                    toast.error("Unable to load owners for filtering. Please try again.");
                }


                // if (ownersResponse.ok) {
                //     const ownersData = await ownersResponse.json();
                //     const ownersList = ownersData.users || ownersData.data || ownersData || [];
                //     const ownerOptions = ownersList
                //         .map((user: any) => {
                //             const id = user._id || user.id || "";
                //             const name = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown";
                //             return { id, name };
                //         })
                //         .filter((owner: any) => owner.id && owner.name);
                //     setAvailableFilterOwners(ownerOptions);
                // }

                // Fetch tags from API
                setIsLoadingFilterTags(true);
                try {
                    const tagsResponse = await authenticatedFetch(
                        buildExternalUrl("/crm/leads/tags"),
                        { method: "GET" }
                    );
                    if (tagsResponse.ok) {
                        const tagsData = await tagsResponse.json();
                        const tagsList = tagsData.tags || tagsData.data || tagsData || [];
                        // Handle both array and object formats
                        const tagStrings = Array.isArray(tagsList)
                            ? tagsList.map((tag: any) => (typeof tag === "string" ? tag : tag.name || tag.tag || String(tag))).filter(Boolean)
                            : [];
                        setAvailableFilterTags(tagStrings.sort());
                    }
                } catch (tagError) {
                    console.error("Error fetching tags:", tagError);
                    setAvailableFilterTags([]);
                } finally {
                    setIsLoadingFilterTags(false);
                }
            } catch (error) {
                console.error("Error fetching filter data:", error);
                setIsLoadingFilterTags(false);
            }
        };

        if (isFilterDialogOpen) {
            fetchFilterData();
        }
    }, [isFilterDialogOpen, authenticatedFetch, buildExternalUrl]);

    // Update filter selected owners when owner options load
    useEffect(() => {
        if (!isFilterDialogOpen || availableFilterOwners.length === 0) return;
        const selectedOwnerNames = splitMultiParam(selectedOwner);
        if (selectedOwnerNames.length === 0) return;
        const matchedOwnerIds = availableFilterOwners
            .filter((o) => selectedOwnerNames.includes(o.name))
            .map((o) => o.id);
        if (matchedOwnerIds.length > 0) {
            setFilterSelectedOwners(matchedOwnerIds);
        }
    }, [isFilterDialogOpen, selectedOwner, availableFilterOwners]);

    const filteredAvailableFilterStages = useMemo(() => {
        const term = filterStageSearchTerm.toLowerCase().trim();
        if (!term) return availableFilterStages;
        return availableFilterStages.filter((stage) =>
            stage.toLowerCase().includes(term)
        );
    }, [availableFilterStages, filterStageSearchTerm]);

    const filteredAvailableFilterOwners = useMemo(() => {
        const term = filterOwnerSearchTerm.toLowerCase().trim();
        if (!term) return availableFilterOwners;
        return availableFilterOwners.filter((owner) =>
            owner.name.toLowerCase().includes(term)
        );
    }, [availableFilterOwners, filterOwnerSearchTerm]);

    const filteredAvailableFilterTags = useMemo(() => {
        const term = filterTagSearchTerm.toLowerCase().trim();
        if (!term) return availableFilterTags;
        return availableFilterTags.filter((tag) =>
            tag.toLowerCase().includes(term)
        );
    }, [availableFilterTags, filterTagSearchTerm]);

    const filteredAvailableFilterFunnels = useMemo(() => {
        const term = filterFunnelSearchTerm.toLowerCase().trim();
        if (!term) return availableFilterFunnels;
        return availableFilterFunnels.filter((funnel) =>
            funnel.name.toLowerCase().includes(term)
        );
    }, [availableFilterFunnels, filterFunnelSearchTerm]);

    // Handle filter dialog open
    const handleOpenFilterDialog = async () => {
        // Initialize filter selections from current filters
        const stageSelections = splitMultiParam(selectedStage);
        setFilterSelectedStages(stageSelections.length > 0 ? stageSelections : ["all"]);

        const ownerSelectionsByName = splitMultiParam(selectedOwner);
        const ownerIds = availableFilterOwners
            .filter((o) => ownerSelectionsByName.includes(o.name))
            .map((o) => o.id);
        setFilterSelectedOwners(ownerIds.length > 0 ? ownerIds : ["all"]);

        const funnelSelections = splitMultiParam(selectedFunnel);
        setFilterSelectedFunnels(funnelSelections.length > 0 ? funnelSelections : ["all"]);

        // Initialize tags from applied tags
        setFilterSelectedTags(selectedTags);
        setFilterDateFrom(dateFrom);
        setFilterDateTo(dateTo);
        setFilterCalendarMonth(parseFilterDateValue(dateFrom) || new Date());
        setActiveFilterCategory("stage");

        // Reset filter search terms
        setFilterStageSearchTerm("");
        setFilterOwnerSearchTerm("");
        setFilterFunnelSearchTerm("");
        setFilterTagSearchTerm("");

        setIsFilterDialogOpen(true);
    };

    const handleToggleFilterFunnel = (funnelId: string) => {
        if (funnelId === "all") {
            setFilterSelectedFunnels(["all"]);
            return;
        }
        setFilterSelectedFunnels((prev) => {
            const withoutAll = prev.filter((f) => f !== "all");
            if (withoutAll.includes(funnelId)) {
                const next = withoutAll.filter((f) => f !== funnelId);
                return next.length > 0 ? next : ["all"];
            }
            return [...withoutAll, funnelId];
        });
    };

    const fetchActivityLogRange = useCallback(async (startDate: string, endDate: string) => {
        setIsLoadingActivityLog(true);
        setActivityLogError("");
        try {
            const res = await authenticatedFetch(
                buildExternalUrl(`/crm/user-activity?startDate=${startDate}&endDate=${endDate}`),
                { method: "GET", headers: { "Content-Type": "application/json" } }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.message || "Failed to fetch activity log");
            }
            const data = await res.json();
            setActivityLogData(data);
        } catch (e) {
            console.error("Error fetching activity log:", e);
            setActivityLogData(null);
            setActivityLogError(e instanceof Error ? e.message : "Failed to fetch activity log");
        } finally {
            setIsLoadingActivityLog(false);
        }
    }, []);

    const handleOpenActivityLog = async () => {
        const today = new Date().toISOString().split("T")[0];
        setActivityLogStartDate(today);
        setActivityLogEndDate(today);
        setIsActivityLogOpen(true);
        await fetchActivityLogRange(today, today);
    };

    const handleApplyActivityLogFilter = async () => {
        const start = activityLogStartDate;
        const end = activityLogEndDate;
        if (!start || !end) {
            toast.error("Please select both start and end date");
            return;
        }
        if (start > end) {
            toast.error("Start date must be before end date");
            return;
        }
        await fetchActivityLogRange(start, end);
    };

    const handleResetActivityLogFilter = async () => {
        const today = new Date().toISOString().split("T")[0];
        setActivityLogStartDate(today);
        setActivityLogEndDate(today);
        await fetchActivityLogRange(today, today);
    };

    const formatActivityLogTime = (ts: any) => {
        if (!ts) return "";
        try {
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return String(ts);
            return d.toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return String(ts);
        }
    };

    const toTitleCase = (s: string) =>
        s
            .split(/[\s_-]+/g)
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

    // Handle filter stage toggle (multiple selection)
    const handleToggleFilterStage = (stage: string) => {
        if (stage === "all") {
            setFilterSelectedStages(["all"]);
            return;
        }
        setFilterSelectedStages((prev) => {
            const withoutAll = prev.filter((s) => s !== "all");
            if (withoutAll.includes(stage)) {
                const next = withoutAll.filter((s) => s !== stage);
                return next.length > 0 ? next : ["all"];
            }
            return [...withoutAll, stage];
        });
    };

    // Handle filter owner toggle (multiple selection)
    const handleToggleFilterOwner = (ownerId: string) => {
        if (ownerId === "all") {
            setFilterSelectedOwners(["all"]);
            return;
        }
        setFilterSelectedOwners((prev) => {
            const withoutAll = prev.filter((o) => o !== "all");
            if (withoutAll.includes(ownerId)) {
                const next = withoutAll.filter((o) => o !== ownerId);
                return next.length > 0 ? next : ["all"];
            }
            return [...withoutAll, ownerId];
        });
    };

    // Handle filter tag toggle (multiple selection)
    const handleToggleFilterTag = (tag: string) => {
        setFilterSelectedTags((prev) => {
            if (prev.includes(tag)) {
                return prev.filter((t) => t !== tag);
            } else {
                return [...prev, tag];
            }
        });
    };

    // Handle apply filters
    const handleApplyFilters = () => {
        const stageValue =
            filterSelectedStages.includes("all") || filterSelectedStages.length === 0
                ? "all"
                : filterSelectedStages.join(",");

        const funnelValue =
            filterSelectedFunnels.includes("all") || filterSelectedFunnels.length === 0
                ? "all"
                : filterSelectedFunnels.join(",");

        // Map selected owner IDs -> owner names
        let ownerValue = "all";
        if (!filterSelectedOwners.includes("all") && filterSelectedOwners.length > 0) {
            const ownerNames = availableFilterOwners
                .filter((owner) => filterSelectedOwners.includes(owner.id))
                .map((owner) => owner.name)
                .filter(Boolean);
            ownerValue = ownerNames.length > 0 ? ownerNames.join(",") : "all";
        }

        setSelectedStage(stageValue);
        setSelectedOwner(ownerValue);
        setSelectedFunnel(funnelValue);
        // Update applied tags
        setSelectedTags(filterSelectedTags);
        setDateFrom(filterDateFrom);
        setDateTo(filterDateTo);
        setIsFilterDialogOpen(false);
        setCurrentPage(1);
    };

    // Handle reset filters
    const handleResetFilters = () => {
        setFilterSelectedStages(["all"]);
        setFilterSelectedOwners(["all"]);
        setFilterSelectedFunnels(["all"]);
        setFilterSelectedTags([]);
        setFilterDateFrom("");
        setFilterDateTo("");
        setFilterCalendarMonth(new Date());

        setSelectedStage("all");
        setSelectedOwner("all");
        setSelectedFunnel("all");
        setSelectedTags([]);
        setDateFrom("");
        setDateTo("");
        setIsFilterDialogOpen(false);
        setCurrentPage(1);
    };

    const figmaFilterCategories: Array<{ id: FigmaFilterCategory; label: string }> = [
        { id: "stage", label: "Lead Stage" },
        { id: "owner", label: "Lead Owner" },
        { id: "funnel", label: "Sales Funnel" },
        { id: "date", label: "Date" },
        { id: "tags", label: "Tags" },
    ];

    const parseFilterDateValue = (value: string): Date | undefined => {
        if (!value) return undefined;
        const [year, month, day] = value.split("-").map((part) => Number(part));
        if (!year || !month || !day) return undefined;
        return new Date(year, month - 1, day);
    };

    const toFilterDateValue = (date: Date) => format(date, "yyyy-MM-dd");

    const formatFilterDateDisplay = (value: string) => {
        const date = parseFilterDateValue(value);
        return date ? format(date, "MM/dd/yyyy") : "Select date";
    };

    const filterDateRange = useMemo<DateRange | undefined>(() => {
        const from = parseFilterDateValue(filterDateFrom);
        const to = parseFilterDateValue(filterDateTo);
        if (!from && !to) return undefined;
        return { from, to };
    }, [filterDateFrom, filterDateTo]);

    const handleFilterDateRangeSelect = (range: DateRange | undefined) => {
        setFilterDateFrom(range?.from ? toFilterDateValue(range.from) : "");
        setFilterDateTo(range?.to ? toFilterDateValue(range.to) : "");
        if (range?.from) {
            setFilterCalendarMonth(range.from);
        }
    };

    const renderFigmaFilterDateField = (label: string, value: string) => (
        <div className="flex w-full flex-col gap-1.5">
            <label className="text-[12px] font-medium text-white">{label}</label>
            <div className="flex h-[38px] w-full items-center gap-2 rounded-[8px] border border-[#e5e7eb] px-2.5">
                <CalendarIcon className="size-4 shrink-0 text-white" />
                <span className={`text-[13px] ${value ? "text-[#6b7280]" : "text-[#6b7280]/80"}`}>
                    {formatFilterDateDisplay(value)}
                </span>
            </div>
        </div>
    );

    const renderFigmaFilterDatePanel = () => (
        <div className="flex w-full flex-col gap-3">
            <div className="flex w-full flex-col gap-3">
                {renderFigmaFilterDateField("Start date", filterDateFrom)}
                {renderFigmaFilterDateField("End date", filterDateTo)}
            </div>
            <Calendar
                mode="range"
                navLayout="after"
                month={filterCalendarMonth}
                onMonthChange={setFilterCalendarMonth}
                selected={filterDateRange}
                onSelect={handleFilterDateRangeSelect}
                showOutsideDays={false}
                className="w-full p-0"
                classNames={{
                    months: "w-full",
                    month: "flex w-full flex-wrap items-center [&>table]:mt-3 [&>table]:w-full",
                    month_caption: "mb-0",
                    caption_label: "text-[14px] font-semibold text-white",
                    nav: "ml-auto flex items-center gap-1",
                    button_previous:
                        "static h-6 w-6 rounded-[4px] border-0 bg-transparent p-1 text-white opacity-100 hover:bg-white/10",
                    button_next:
                        "static h-6 w-6 rounded-[4px] border-0 bg-transparent p-1 text-white opacity-100 hover:bg-white/10",
                    month_grid: "w-full border-collapse",
                    weekdays: "flex justify-between",
                    weekday: "w-9 text-center text-[11px] font-semibold uppercase text-[#6b7280]",
                    week: "mt-1 flex w-full",
                    day: "relative h-9 w-9 p-0 text-center",
                    day_button:
                        "h-9 w-9 rounded-full p-0 text-[13px] font-normal text-white hover:bg-white/10 aria-selected:opacity-100",
                    selected:
                        "[&>button]:!bg-brand [&>button]:!text-[#1a1200] [&>button]:hover:!bg-brand [&>button]:hover:!text-[#1a1200]",
                    range_start:
                        "rounded-l-full bg-[#fef3c7] [&>button]:!bg-brand [&>button]:!text-[#1a1200] [&>button]:hover:!bg-brand [&>button]:hover:!text-[#1a1200]",
                    range_end:
                        "rounded-r-full bg-[#fef3c7] [&>button]:!bg-brand [&>button]:!text-[#1a1200] [&>button]:hover:!bg-brand [&>button]:hover:!text-[#1a1200]",
                    range_middle:
                        "rounded-none bg-[#fef3c7] [&>button]:!bg-transparent [&>button]:!text-[#1a1200] [&>button]:hover:!bg-transparent [&>button]:hover:!text-[#1a1200]",
                    today: "text-white",
                    outside: "text-[#6b7280] opacity-50",
                    disabled: "text-[#6b7280] opacity-30",
                }}
            />
        </div>
    );

    const renderFigmaFilterCheckbox = (
        label: string,
        checked: boolean,
        onToggle: () => void,
        badge?: ReactNode
    ) => (
        <button
            type="button"
            onClick={onToggle}
            className="flex w-full min-w-0 items-center gap-3 px-1 py-2.5 text-left hover:bg-white/5 rounded-[4px]"
        >
            <div
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border ${checked
                    ? "border-brand bg-brand"
                    : "border-[#334155] bg-white/10"
                    }`}
            >
                {checked ? <Check className="size-3 text-black" strokeWidth={3} /> : null}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-[14px] text-white">{label}</span>
                {badge}
            </div>
        </button>
    );

    const addLeadFieldClass = isFigmaInlineDealsDesign ? "flex flex-col gap-1.5" : "space-y-2";
    const addLeadColumnClass = isFigmaInlineDealsDesign ? "contents" : "space-y-4 min-w-0";
    const addLeadLabelClass = isFigmaInlineDealsDesign ? "text-[12px] font-medium text-[#9a9a9a]" : "";
    const addLeadInputClass = isFigmaInlineDealsDesign
        ? "h-9 rounded-[8px] border-[#3a3a3a] bg-[#1e1e1e] px-2.5 text-[13px] text-[#efefef] placeholder:text-[#5a5a5a] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        : "";
    const addLeadTextareaClass = isFigmaInlineDealsDesign
        ? "min-h-[80px] rounded-[8px] border-[#3a3a3a] bg-[#1e1e1e] px-2.5 py-2.5 text-[13px] text-[#efefef] placeholder:text-[#5a5a5a] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        : "";
    const addLeadComboClass = isFigmaInlineDealsDesign
        ? "h-9 w-full min-w-0 justify-between gap-2 rounded-[8px] border border-[#3a3a3a] bg-[#1e1e1e] px-2.5 text-[13px] font-normal text-[#efefef] shadow-none hover:bg-[#252525]"
        : "w-full min-w-0 justify-between gap-2";
    const addLeadSelectTriggerClass = isFigmaInlineDealsDesign
        ? "h-9 w-full rounded-[8px] border border-[#3a3a3a] bg-[#1e1e1e] px-2.5 text-[13px] text-[#efefef] shadow-none focus:ring-0"
        : "";
    const handleAddLeadDropdownWheel = (e: WheelEvent<HTMLElement>) => {
        e.stopPropagation();
    };
    const addLeadPopoverProps = isFigmaInlineDealsDesign ? { modal: false as const } : {};
    const addLeadPopoverContentProps = isFigmaInlineDealsDesign
        ? { onWheel: handleAddLeadDropdownWheel }
        : {};
    const addLeadPopoverContentClass = isFigmaInlineDealsDesign ? " overscroll-contain" : "";
    const addLeadCommandClass = isFigmaInlineDealsDesign ? "max-h-60 overflow-hidden" : "";
    const addLeadCommandListClass = isFigmaInlineDealsDesign
        ? "max-h-48 overflow-y-auto overscroll-contain"
        : "max-h-56 overflow-auto";
    const addLeadSelectContentClass = isFigmaInlineDealsDesign ? "max-h-60 overscroll-contain" : "";
    const addLeadSelectContentProps = isFigmaInlineDealsDesign
        ? { onWheel: handleAddLeadDropdownWheel }
        : {};

    // Fetch dropdown data
    const fetchFunnelStages = useCallback(
        async (funnelId: string) => {
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
                        if (typeof stage === "string") {
                            return { name: stage, value: stage };
                        }
                        // Ensure name and value are always strings, never objects
                        const nameStr = stage?.name || stage?.stageName || (typeof stage === "string" ? stage : String(stage?.id || stage?._id || "Unknown Stage"));
                        const valueStr = stage?.name || stage?.stageName || stage?.id || stage?._id || (typeof stage === "string" ? stage : String(stage || "Unknown Stage"));
                        return {
                            name: String(nameStr),
                            value: String(valueStr),
                        };
                    });

                    setFunnelStages(transformedStages);
                    setLeadForm((prev) => {
                        if (transformedStages.length > 0) {
                            const firstStage = transformedStages[0].name || transformedStages[0].value;
                            return { ...prev, initialStage: firstStage };
                        }
                        return { ...prev, initialStage: "Prospects" };
                    });
                } else {
                    setFunnelStages([]);
                }
            } catch (error) {
                console.error("Error fetching funnel stages:", error);
                setFunnelStages([]);
            } finally {
                setIsLoadingStages(false);
            }
        },
        [authenticatedFetch, buildExternalUrl]
    );

    const fetchDropdownData = useCallback(async () => {
        setIsOwnersLoading(true);
        try {
            // Fetch contacts
            const contactsResponse = await authenticatedFetch(
                buildExternalUrl("/crm/contacts?skip=0&limit=50"),
                { method: "GET" }
            );
            if (contactsResponse.ok) {
                const contactsData = await contactsResponse.json();
                const contactsList = contactsData.contacts || contactsData.data || contactsData || [];
                const contactOptions = (Array.isArray(contactsList) ? contactsList : [])
                    .map(toContactOption)
                    .filter(Boolean) as ContactOption[];
                setContacts((prev) => {
                    if (!leadForm.contactId) return contactOptions;
                    const idStr = String(leadForm.contactId);
                    if (contactOptions.some((option) => option.id === idStr)) {
                        return contactOptions;
                    }
                    const existing = prev.find((option) => option.id === idStr);
                    return existing ? [existing, ...contactOptions] : contactOptions;
                });
                if (leadForm.contactId) {
                    const match = contactOptions.find((option) => option.id === String(leadForm.contactId));
                    if (match) {
                        setSelectedContactOption(match);
                    }
                }
            }

            // Fetch companies
            const companiesResponse = await authenticatedFetch(
                buildExternalUrl("/crm/companies?skip=0&limit=50"),
                { method: "GET" }
            );
            if (companiesResponse.ok) {
                const companiesData = await companiesResponse.json();
                const companiesList = companiesData.companies || companiesData.data || companiesData || [];
                const companyOptions = (Array.isArray(companiesList) ? companiesList : [])
                    .map(toCompanyOption)
                    .filter(Boolean) as CompanyOption[];
                setCompanies((prev) => {
                    if (!leadForm.companyId) return companyOptions;
                    const idStr = String(leadForm.companyId);
                    if (companyOptions.some((option) => option.id === idStr)) {
                        return companyOptions;
                    }
                    const existing = prev.find((option) => option.id === idStr);
                    return existing ? [existing, ...companyOptions] : companyOptions;
                });
                if (leadForm.companyId) {
                    const match = companyOptions.find((option) => option.id === String(leadForm.companyId));
                    if (match) {
                        setSelectedCompanyOption(match);
                    }
                }
            }

            // Fetch funnels
            setIsLoadingFunnels(true);
            try {
                const funnelsResponse = await authenticatedFetch(
                    buildExternalUrl("/crm/funnels?skip=0&limit=50"),
                    { method: "GET" }
                );
                if (funnelsResponse.ok) {
                    const funnelsData = await funnelsResponse.json();
                    const funnelsList = funnelsData.funnels || funnelsData.data || funnelsData || [];
                    setFunnels(funnelsList);
                    // Set first funnel as default if available
                    if (funnelsList.length > 0) {
                        const firstFunnelId = funnelsList[0]._id || funnelsList[0].id;
                        if (firstFunnelId) {
                            setLeadForm((prev) => {
                                if (prev.salesFunnelId) {
                                    return prev;
                                }
                                fetchFunnelStages(firstFunnelId);
                                return { ...prev, salesFunnelId: firstFunnelId };
                            });
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching funnels:", error);
            } finally {
                setIsLoadingFunnels(false);
            }

            // Fetch lead stages for filter dropdown
            try {
                setIsLoadingLeadStages(true);
                const stagesResponse = await authenticatedFetch(
                    buildExternalUrl("/crm/leads/stages"),
                    { method: "GET" }
                );

                if (stagesResponse.ok) {
                    const stagesData = await stagesResponse.json();
                    const stagesList = stagesData.stages || stagesData.data || stagesData || [];
                    const mappedStages = Array.isArray(stagesList)
                        ? stagesList
                            .map((stage: any) => {
                                if (typeof stage === "string") return stage;
                                if (stage?.name) return stage.name;
                                if (stage?.stageName) return stage.stageName;
                                return "";
                            })
                            .filter((stage: string) => stage && stage.trim() !== "")
                        : [];

                    const uniqueStages = Array.from(new Set(mappedStages));
                    setLeadStages(uniqueStages);
                } else {
                    console.error("Failed to fetch lead stages");
                    setLeadStages([]);
                }
            } catch (stageError) {
                console.error("Error fetching lead stages:", stageError);
                setLeadStages([]);
            } finally {
                setIsLoadingLeadStages(false);
            }

            await loadOwners();
        } catch (error) {
            console.error("Error fetching dropdown data:", error);
        }
    }, [authenticatedFetch, buildExternalUrl, fetchFunnelStages, loadOwners]);

    // Handle Sales Funnel Change
    const handleSalesFunnelChange = async (funnelId: string) => {
        setLeadForm(prev => ({ ...prev, salesFunnelId: funnelId }));
        await fetchFunnelStages(funnelId);
    };

    const addProductToForm = (product: any) => {
        setLeadForm(prev => {
            const alreadyExists = prev.products.some(p => p.productId === (product._id || product.id));
            if (alreadyExists) {
                toast.error("Product already added");
                return prev;
            }
            const newProducts = [...prev.products, {
                productId: product._id || product.id,
                name: product.name,
                quantity: 1,
                pricing: product.price || product.pricing || 0,
                unit: product.unit || ""
            }];

            return {
                ...prev,
                products: newProducts,
            };
        });
    };

    const removeProductFromForm = (productId: string) => {
        setLeadForm(prev => {
            const newProducts = prev.products.filter(p => p.productId !== productId);
            return {
                ...prev,
                products: newProducts,
            };
        });
    };

    const updateProductQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) return;
        setLeadForm(prev => {
            const newProducts = prev.products.map(p =>
                p.productId === productId ? { ...p, quantity } : p
            );
            return {
                ...prev,
                products: newProducts,
            };
        });
    };

    // Handle Add Lead
    const handleSaveLead = async () => {
        // Validate required fields
        if (!leadForm.leadName.trim()) {
            toast.error("Lead Name is required");
            return;
        }
        if (!leadForm.contactId) {
            toast.error("Contact Person is required");
            return;
        }
        if (!leadForm.salesFunnelId) {
            toast.error("Sales Funnel is required");
            return;
        }

        // Validate optional email/phone inputs (backend may accept junk otherwise)
        const emailTrim = (leadForm.email || "").trim();
        if (emailTrim) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailTrim)) {
                toast.error("Please enter a valid email address");
                return;
            }
        }

        const phoneEntries = splitPhoneNumbers(leadForm.phone || "");
        if (phoneEntries.length > 0) {
            const hasInvalidEntry = phoneEntries.some((entry) => !isValidPhoneNumberEntry(entry));
            if (hasInvalidEntry) {
                toast.error("Each phone number must be 10 digits (or +91 followed by 10 digits)");
                return;
            }
        }

        const parsedEstimatedValue = Number(leadForm.estimatedValue) || 0;

        setIsSubmittingLead(true);
        const isEditing = Boolean(editingLeadId);
        const loadingToast = toast.loading(isEditing ? "Updating lead..." : "Creating lead...");

        try {
            // Get user data from cookies
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

            const estimatedValue = parsedEstimatedValue;

            const stageNorm =
                normalizeLeadStageValue(leadForm.initialStage) || "Prospects";
            const lastFunnelStage = funnelStages[funnelStages.length - 1];
            const normStage = (s: string) => String(s || "").trim().toLowerCase();
            const stageMatchesLast = (stageStr: string) =>
                !!lastFunnelStage &&
                !!stageStr &&
                (normStage(stageStr) === normStage(String(lastFunnelStage.name || "")) ||
                    normStage(stageStr) === normStage(String(lastFunnelStage.value || "")));
            const isAtLastStage =
                funnelStages.length > 0 && stageMatchesLast(stageNorm);

            const leadData: Record<string, unknown> = {
                // Existing fields
                quantity: 1, // Default quantity if not provided
                pricing: estimatedValue,
                negotiatedPricing: estimatedValue, // Same as estimated value by default
                MaxDiscPrice: estimatedValue, // Same as estimated value by default
                salesFunnel: leadForm.salesFunnelId,
                stage: stageNorm,
                documents: [], // Empty array by default
                duration: 0, // Default duration if not provided
                category: "", // Empty category if not provided

                // New fields from UI
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
                tags: leadForm.tags
                    ? leadForm.tags
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter((tag) => tag.length > 0)
                    : [],
                autoFollowUp: leadForm.autoFollowUp || false,

                // Additional required fields
                contactId: leadForm.contactId,
                organizationId: organizationId,
                createdBy: userId,
                products: leadForm.products,
            };

            const parsedFollowUpInterval = parseInt(leadForm.followUpIntervalDays, 10);
            if (Number.isFinite(parsedFollowUpInterval) && parsedFollowUpInterval > 0) {
                leadData.followUpIntervalDays = parsedFollowUpInterval;
            }
            if (leadForm.autoFollowUpEndDate) {
                leadData.autoFollowUpEndDate = leadForm.autoFollowUpEndDate;
            }

            if (isAtLastStage) {
                leadData.leadStatus = "won";
            }

            if (leadForm.companyId) {
                (leadData as any).companyId = leadForm.companyId;
            }

            const response = await authenticatedFetch(
                buildExternalUrl(isEditing ? `/crm/leads/${editingLeadId}` : "/crm/leads"),
                {
                    method: isEditing ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(leadData),
                }
            );
            let responseData: any = null;
            try {
                responseData = await response.clone().json();
            } catch (error) {
                responseData = null;
            }

            if (response.ok) {
                const leadIdFromResponse =
                    editingLeadId ||
                    responseData?.lead?._id ||
                    responseData?.lead?.id ||
                    responseData?.data?._id ||
                    responseData?.data?.id ||
                    responseData?._id ||
                    responseData?.id ||
                    responseData?.leadId || "";

                const trimmedNote = (leadForm.notes || "").trim();
                const shouldSyncNote = trimmedNote.length > 0;

                if (shouldSyncNote && leadIdFromResponse) {
                    const existingNote = Array.isArray(leadNotes) && leadNotes.length > 0 ? leadNotes[0] : null;
                    const hasExistingNote = existingNote && (existingNote._id || existingNote.id);

                    const notePayload = hasExistingNote
                        ? {
                            notes: trimmedNote,
                            organizationId,
                            updatedBy: userId,
                        }
                        : {
                            leadId: leadIdFromResponse,
                            notes: trimmedNote,
                            organizationId,
                            createdBy: userId,
                        };

                    try {
                        const endpoint = hasExistingNote
                            ? `/crm/notes/${existingNote._id || existingNote.id}`
                            : "/crm/notes";

                        const noteResponse = await authenticatedFetch(
                            buildExternalUrl(endpoint),
                            {
                                method: hasExistingNote ? "PUT" : "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(notePayload),
                            }
                        );

                        if (!noteResponse.ok) {
                            const noteError = await noteResponse.json().catch(() => ({}));
                            console.error("Failed to sync lead note:", noteError);
                            toast.error(noteError?.message || "Failed to sync note for the lead");
                        }
                    } catch (noteError) {
                        console.error("Error syncing lead note:", noteError);
                        toast.error("Failed to sync note for the lead");
                    }
                }

                toast.success(
                    isEditing && isAtLastStage
                        ? "Lead updated — marked as won!"
                        : isEditing
                            ? "Lead updated successfully!"
                            : isAtLastStage
                                ? "Lead created — marked as won!"
                                : "Lead created successfully!",
                    { id: loadingToast }
                );
                // Reset form
                const defaultForm = buildDefaultLeadForm();
                setLeadForm(defaultForm);
                setEditingLeadId(null);
                setIsAddLeadOpen(false);
                setLeadNotes([]);
                setSelectedContactOption(null);
                setSelectedCompanyOption(null);
                setContactSearchTerm("");
                setCompanySearchTerm("");
                if (defaultForm.salesFunnelId) {
                    await fetchFunnelStages(defaultForm.salesFunnelId);
                } else {
                    setFunnelStages([]);
                }

                const savedLeadId =
                    String(
                        leadIdFromResponse ||
                        editingLeadId ||
                        responseData?.lead?._id ||
                        responseData?.lead?.id ||
                        ""
                    );
                if (savedLeadId) {
                    setLeads((prev) =>
                        prev.map((l) => {
                            const id = String(l._id || l.id || "");
                            if (id !== savedLeadId) return l;
                            return {
                                ...l,
                                stage: stageNorm,
                                ...(isAtLastStage ? { leadStatus: "won" } : {}),
                            };
                        })
                    );
                }

                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent(DEALS_CRM_STATS_REFRESH_EVENT));
                }
                router.refresh();

                // Refresh leads list
                await fetchLeads(currentPage);
            } else {
                const errorData = responseData || (await response.json().catch(() => ({})));
                toast.error(errorData?.message || (isEditing ? "Failed to update lead" : "Failed to create lead"), { id: loadingToast });
            }
        } catch (error) {
            console.error("Error saving lead:", error);
            toast.error(isEditing ? "Failed to update lead. Please try again." : "Failed to create lead. Please try again.", { id: loadingToast });
        } finally {
            setIsSubmittingLead(false);
        }
    };

    const handleAutoFollowUpToggle = (checked: boolean) => {
        if (checked) {
            setLeadForm((prev) => ({ ...prev, autoFollowUp: true }));
            setIsAutoFollowUpConfigOpen(true);
            return;
        }

        setLeadForm((prev) => ({
            ...prev,
            autoFollowUp: false,
            followUpIntervalDays: "",
            autoFollowUpEndDate: "",
        }));
    };

    const handleAutoFollowUpConfigCancel = () => {
        setLeadForm((prev) => ({
            ...prev,
            autoFollowUp: false,
            followUpIntervalDays: "",
            autoFollowUpEndDate: "",
        }));
        setIsAutoFollowUpConfigOpen(false);
    };

    const handleAutoFollowUpConfigSave = () => {
        if (leadForm.nextFollowUp && leadForm.autoFollowUpEndDate) {
            const startDate = new Date(`${leadForm.nextFollowUp}T00:00:00`);
            const endDate = new Date(`${leadForm.autoFollowUpEndDate}T00:00:00`);
            if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate < startDate) {
                toast.error("End date cannot be before next follow-up date");
                return;
            }
        }

        setIsAutoFollowUpConfigOpen(false);
    };

    const autoFollowUpConfigPreview = useMemo(
        () =>
            buildFollowUpSchedule(
                leadForm.nextFollowUp,
                leadForm.followUpIntervalDays,
                leadForm.autoFollowUpEndDate
            ),
        [leadForm.nextFollowUp, leadForm.followUpIntervalDays, leadForm.autoFollowUpEndDate]
    );

    useEffect(() => {
        fetchDropdownData();
        // Fetch products and funnels for bulk upload template
        fetchBulkUploadProducts();
        fetchBulkUploadFunnels();
    }, [fetchDropdownData]);

    // Helper function to get stage as string (empty API stage shows as "-")
    const getStageString = (stage: string | any): string => {
        const emptyPlaceholder = "-";
        if (stage == null) return emptyPlaceholder;
        if (typeof stage === "string") {
            const trimmed = stage.trim();
            return trimmed === "" ? emptyPlaceholder : trimmed;
        }
        // Check for valid name properties in object; empty object or missing name → "-"
        const stageName = stage?.name ?? stage?.stage ?? stage?.stageName;
        if (stageName != null && typeof stageName === "string") {
            const trimmed = String(stageName).trim();
            return trimmed === "" ? emptyPlaceholder : trimmed;
        }
        return emptyPlaceholder;
    };

    const getStageColor = (stage: string | any) => {
        if (!stage) return "bg-[rgba(107,114,128,0.1)] border-[rgba(107,114,128,0.2)] text-[#6b7280]";

        // Handle case where stage might be an object
        let stageStr = "";
        if (typeof stage === 'string') {
            stageStr = stage;
        } else if (typeof stage === 'object') {
            const stageName = stage?.name || stage?.stage || stage?.stageName;
            stageStr = (stageName && typeof stageName === 'string') ? stageName : "";
        }

        // Return default color if we couldn't extract a valid stage string
        if (!stageStr) return "bg-[rgba(107,114,128,0.1)] border-[rgba(107,114,128,0.2)] text-[#6b7280]";

        const stageLower = stageStr.toLowerCase();
        switch (stageLower) {
            case "proposal":
                return "bg-[rgba(123,104,238,0.1)] border-[0.667px] border-[rgba(123,104,238,0.2)] text-[#7b68ee]";
            case "qualified":
                return "bg-[rgba(245,158,11,0.1)] border-[0.667px] border-[rgba(245,158,11,0.2)] text-[#f59e0b]";
            case "negotiation":
                return "bg-[rgba(236,72,153,0.1)] border-[0.667px] border-[rgba(236,72,153,0.2)] text-[#ec4899]";
            case "prospects":
            case "prospect":
                return "bg-[rgba(59,130,246,0.1)] border-[0.667px] border-[rgba(59,130,246,0.2)] text-[#3b82f6]";
            case "discovery":
                return "bg-[rgba(34,197,94,0.1)] border-[0.667px] border-[rgba(34,197,94,0.2)] text-[#22c55e]";
            case "closed-won":
            case "closed won":
            case "closed":
                return "bg-[rgba(34,197,94,0.1)] border-[0.667px] border-[rgba(34,197,94,0.2)] text-[#22c55e]";
            case "closed-lost":
            case "closed lost":
                return "bg-[rgba(239,68,68,0.1)] border-[0.667px] border-[rgba(239,68,68,0.2)] text-[#ef4444]";
            case "lead":
                return "bg-[rgba(99,102,241,0.1)] border-[0.667px] border-[rgba(99,102,241,0.2)] text-[#6366f1]";
            case "stage 1":
                return "bg-[rgba(236,72,153,0.1)] border-[0.667px] border-[rgba(236,72,153,0.2)] text-[#ec4899]";
            case "awareness":
                return "bg-[rgba(6,182,212,0.1)] border-[0.667px] border-[rgba(6,182,212,0.2)] text-[#06b6d4]";
            case "interest":
                return "bg-[rgba(16,185,129,0.1)] border-[0.667px] border-[rgba(16,185,129,0.2)] text-[#10b981]";
            case "consideration":
                return "bg-[rgba(245,158,11,0.1)] border-[0.667px] border-[rgba(245,158,11,0.2)] text-[#f59e0b]";
            case "intent":
                return "bg-[rgba(139,92,246,0.1)] border-[0.667px] border-[rgba(139,92,246,0.2)] text-[#8b5cf6]";
            case "evaluation":
                return "bg-[rgba(14,165,233,0.1)] border-[0.667px] border-[rgba(14,165,233,0.2)] text-[#0ea5e9]";
            default:
                return "bg-[rgba(107,114,128,0.1)] border-[0.667px] border-[rgba(107,114,128,0.2)] text-[#6b7280]";
        }
    };

    // Get status badge color
    const getStatusColor = (status: string | undefined | null) => {
        if (!status) return "bg-gray-100 text-gray-800";

        const statusLower = String(status).toLowerCase();
        switch (statusLower) {
            case "active":
                return "bg-blue-100 text-blue-800";
            case "won":
                return "bg-green-100 text-green-800";
            case "lost":
                return "bg-red-100 text-red-800";
            case "archived":
                return "bg-gray-100 text-gray-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    // Get status display text
    const getStatusText = (status: string | undefined | null) => {
        if (!status) return "Active";
        return String(status).charAt(0).toUpperCase() + String(status).slice(1).toLowerCase();
    };

    /* ---------------- BackOffice leads table (shared DataTable) ---------------- */

    const getLeadEmailValue = (lead: any): string =>
        String(
            lead?.email ||
            lead?.contactEmail ||
            lead?.contact?.email ||
            lead?.contactDetails?.email ||
            ""
        );

    const getLeadNumericValue = (lead: any): number =>
        Number(lead?.negotiatedPricing || lead?.pricing || lead?.estimatedValue || 0) || 0;

    const formatLeadValue = (value: number) => `₹${value.toLocaleString()}`;

    const getFollowUpSortKey = (lead: any): number => {
        const raw = lead?.nextFollowUp || lead?.updatedAt || lead?.updatedDate || "";
        const time = raw ? new Date(raw).getTime() : NaN;
        // Undated leads sink to the bottom in both directions rather than
        // scattering through the list on an NaN comparison.
        return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
    };

    // Sorting is applied to the rows already loaded — the CRM API paginates
    // server-side and takes no sort parameter, so this orders the current page.
    const sortedLeadsForTable = (() => {
        if (!leadsSort) return filteredLeads;
        const direction = leadsSort.order === "asc" ? 1 : -1;

        const keyOf = (lead: any): string | number => {
            switch (leadsSort.by) {
                case "name":
                    return getLeadName(lead).toLowerCase();
                case "owner":
                    return getOwnerDetails(lead).name.toLowerCase();
                case "stage":
                    return getStageString(lead.stage).toLowerCase();
                case "value":
                    return getLeadNumericValue(lead);
                case "contact":
                    return getLeadEmailValue(lead).toLowerCase();
                case "nextFollowUp":
                    return getFollowUpSortKey(lead);
                default:
                    return "";
            }
        };

        return [...filteredLeads].sort((a, b) => {
            const left = keyOf(a);
            const right = keyOf(b);
            if (typeof left === "number" && typeof right === "number") {
                return (left - right) * direction;
            }
            return String(left).localeCompare(String(right)) * direction;
        });
    })();

    const selectedLeadIdSet = new Set(selectedLeadIds);

    const openLeadFromRow = (lead: any) => {
        const rowLeadId = lead?._id || lead?.id;
        if (!rowLeadId) return;
        if (!openDealsLeadInline(String(rowLeadId))) {
            router.push(`/deals/leads/${rowLeadId}`);
        }
    };

    const renderLeadRowActions = (lead: any) => (
        <>
            <LeadContactQuickActions lead={lead} variant="figma" theme="dark" />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-[15px] w-[15px] p-0 text-[#9ca3af] hover:bg-transparent hover:text-[#e5e7eb]"
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
                        onClick={() => handleViewDetails(lead)}
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-white hover:bg-white/5"
                        onClick={() => handleEditLead(lead)}
                    >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDeleteLead(lead)}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );

    return (
        <div
            className={`flex h-screen overflow-hidden min-w-0 ${isFigmaInlineDealsDesign ? "bg-[#0e0e0e]" : "bg-background"
                }`}
        >
            {/* CRM Sidebar (New Sidebar) */}
            {/* <CRMSidebar /> */}

            {/* Main Content */}
            <div
                className={`flex-1 overflow-hidden min-w-0 ${isFigmaInlineDealsDesign ? "bg-[#0e0e0e]" : "bg-background"
                    }`}
            >
                {/* Global Navbar (keep Leads-style top bar on Facebook tab too) */}
                <DealsNavbar
                    forceStandardOnFacebook={activeTab === "facebook-leads"}
                />

                {/* BackOffice leads uses the shared DataTable, which owns its own
                    vertical scroll (sticky header + pinned footer). Give it a
                    bounded flex column there; every other view keeps page scroll. */}
                <main
                    className={
                        isFigmaInlineDealsDesign && activeTab === "leads"
                            ? "flex h-full min-h-0 flex-col overflow-hidden min-w-0 pb-24 md:pb-0"
                            : "h-full overflow-y-auto overflow-x-hidden min-w-0 pb-24 md:pb-0"
                    }
                >
                    {/* Header Section - Figma Design */}
                    {activeTab !== "facebook-leads" && (
                        isFigmaInlineDealsDesign ? (
                            <div className="w-full max-w-full shrink-0">
                                <div className="bg-black px-[20px] py-[16px]">
                                    <div className="flex items-start justify-between overflow-clip">
                                        <div className="flex items-start gap-[12px] min-w-0">
                                            <div className="flex flex-col gap-1 shrink-0">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            className="h-[32px] pl-[12px] pr-[10px] py-[6px] rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-white text-[12px] font-semibold shadow-none hover:bg-[#181818] shrink-0"
                                                        >
                                                            {activeTab === "leads" ? "CRM Leads" : "Facebook Leads"}
                                                            <img
                                                                alt=""
                                                                src="/figma/deals/leads/chevron-down.svg"
                                                                className="h-[14px] w-[14px] ml-[8px]"
                                                            />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="start"
                                                        className="bg-[#181818] border border-[#2a2d3a] text-white"
                                                    >
                                                        <DropdownMenuItem
                                                            className="h-[28px] px-2 rounded-[4px] text-white hover:bg-white/5"
                                                            onClick={() => setActiveTab("leads")}
                                                        >
                                                            <Check className={`h-4 w-4 mr-2 ${activeTab === "leads" ? "opacity-100" : "opacity-0"}`} />
                                                            <span className="text-[12px] leading-[16px]">CRM Leads</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="h-[28px] px-2 pl-7 rounded-[4px] text-white hover:bg-white/5"
                                                            onClick={() => setActiveTab("facebook-leads")}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-4 h-4 flex items-center justify-center">
                                                                    <span className="text-[12px] font-bold text-blue-400">f</span>
                                                                </div>
                                                                <span className="text-[12px] leading-[16px]">Facebook Leads</span>
                                                            </div>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <div className="w-full pt-3 flex items-center justify-start">
                                                    <span className="text-[12px] font-medium leading-none text-[#9ca3af] pl-1">
                                                        {totalLeads} leads
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="relative h-[32px] w-[420px] min-w-0 rounded-[6px] border border-[#2a2d3a] bg-black px-[12px] py-[6px] flex items-center gap-[8px]">
                                                <img
                                                    alt=""
                                                    src="/figma/deals/leads/search.svg"
                                                    className="h-[16px] w-[16px]"
                                                />
                                                <Input
                                                    type="text"
                                                    placeholder="Search leads, companies, contacts..."
                                                    /* !bg-transparent: the inline Deals shell styles bare
                                                       `input` with a #16161f fill, which outranks a plain
                                                       bg utility and tinted this field navy. */
                                                    className="h-[20px] border-0 !bg-transparent p-0 text-[12px] text-[#e5e7eb] placeholder:text-[#9ca3af] focus-visible:ring-0 focus-visible:ring-offset-0"
                                                    value={searchTerm}
                                                    onChange={(e) => {
                                                        setSearchTerm(e.target.value);
                                                        setCurrentPage(1);
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-[8px] shrink-0">
                                            {hasSelectedLeads && (
                                                <Button
                                                    variant="destructive"
                                                    className="flex items-center gap-2 h-[32px] px-[12px] py-[6px] rounded-[6px] text-[12px] font-semibold shrink-0"
                                                    onClick={() => setIsBulkDeleteDialogOpen(true)}
                                                    disabled={isBulkDeleting}
                                                >
                                                    <Trash className="h-4 w-4" />
                                                    Delete Selected
                                                    <span className="text-xs font-medium text-white/80">
                                                        ({selectedLeadIds.length})
                                                    </span>
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                className="h-[32px] px-[12px] py-[6px] rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] text-[12px] font-semibold shadow-none hover:bg-[#181818]"
                                                onClick={handleOpenFilterDialog}
                                            >
                                                <img
                                                    alt=""
                                                    src="/figma/deals/leads/filter.svg"
                                                    className="h-[15px] w-[15px] mr-[8px]"
                                                />
                                                Filters
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] shadow-none hover:bg-[#181818]"
                                                onClick={handleExportLeads}
                                                disabled={isExportingLeads}
                                                aria-label="Export leads"
                                            >
                                                {isExportingLeads ? (
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
                                                aria-label="Bulk upload leads"
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
                                                onClick={handleOpenAddLead}
                                                aria-label="Add lead"
                                                title="Add lead"
                                            >
                                                <Plus className="h-[15px] w-[15px]" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={`border-b min-h-[64.667px] relative shrink-0 w-full max-w-full ${theme === "color"
                                ? "border-[rgba(0,255,255,0.2)] bg-[#0A0E27]"
                                : "border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[#1a1a1a]"
                                }`}>
                                <div className="flex flex-col gap-2 px-3 sm:px-6 py-3 sm:py-0 sm:h-[64.667px] sm:flex-row sm:items-center">
                                    <div className="flex items-start gap-1.5 w-full min-w-0 sm:w-auto sm:gap-2">
                                        {/* CRM Leads Dropdown Button */}
                                        <div className="flex flex-col gap-1 shrink-0">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className={`h-[32px] px-[10px] rounded-[6px] text-[12px] font-bold shadow-none shrink-0 ${theme === "color"
                                                            ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                                            : "border border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[rgba(58,58,58,0.3)] text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50 dark:hover:bg-[rgba(58,58,58,0.5)]"
                                                            }`}
                                                    >
                                                        {activeTab === "leads" ? "CRM Leads" : "Facebook Leads"}
                                                        <ChevronDown className="h-4 w-4 ml-[6px]" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className={`${theme === "color"
                                                    ? "bg-white border-[rgba(0,255,255,0.2)]"
                                                    : "bg-white dark:bg-[#1a1a1a] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                                    }`}>
                                                    <DropdownMenuItem
                                                        className={`h-[28px] px-2 rounded-[4px] ${theme === "color"
                                                            ? "text-[#1f1f1f] hover:bg-[rgba(0,255,255,0.1)]"
                                                            : "text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50"
                                                            }`}
                                                        onClick={() => setActiveTab("leads")}
                                                    >
                                                        <Check className={`h-4 w-4 mr-2 ${activeTab === "leads" ? "opacity-100" : "opacity-0"}`} />
                                                        <span className="text-[12px] leading-[16px]">CRM Leads</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className={`h-[28px] px-2 pl-7 rounded-[4px] ${theme === "color"
                                                            ? "text-[#1f1f1f] hover:bg-[rgba(0,255,255,0.1)]"
                                                            : "text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50"
                                                            }`}
                                                        onClick={() => setActiveTab("facebook-leads")}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-4 h-4 flex items-center justify-center">
                                                                <span className="text-[12px] font-bold text-blue-600">f</span>
                                                            </div>
                                                            <span className="text-[12px] leading-[16px]">Facebook Leads</span>
                                                        </div>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <div className="w-full pt-3 flex items-center justify-start">
                                                <span className={`text-[12px] font-semibold leading-none pl-1 ${theme === "color"
                                                    ? "text-[rgba(0,255,255,0.6)]"
                                                    : "text-muted-foreground"
                                                    }`}>
                                                    {totalLeads} leads
                                                </span>
                                            </div>
                                        </div>

                                        {/* Search Input — desktop inline */}
                                        <div className="relative hidden sm:block sm:w-[384px] h-[32px] shrink-0">
                                            <Search className={`absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] z-10 ${theme === "color"
                                                ? "text-[rgba(0,255,255,0.6)]"
                                                : "text-[#6b7280] dark:text-[#9ca3af]"
                                                }`} />
                                            <Input
                                                type="text"
                                                placeholder="Search leads, companies, contacts..."
                                                className={`pl-[32px] pr-3 py-1 h-[32px] rounded-[6px] text-[14px] focus-visible:ring-0 ${theme === "color"
                                                    ? "bg-[rgba(244,245,247,0.5)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                                                    : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(58,58,58,0.3)] border border-[#e5e7eb] dark:border-[#3a3a3a] text-[#6b7280] dark:text-[#9ca3af] placeholder:text-[#6b7280] dark:placeholder:text-[#9ca3af] focus-visible:border-[#e5e7eb] dark:focus-visible:border-[#3a3a3a]"
                                                    }`}
                                                value={searchTerm}
                                                onChange={(e) => {
                                                    setSearchTerm(e.target.value);
                                                    setCurrentPage(1);
                                                }}
                                            />
                                        </div>

                                        {/* Action buttons — scrollable on mobile */}
                                        <div className="flex items-center gap-1 ml-auto shrink-0 overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                            {hasSelectedLeads && (
                                                <Button
                                                    variant="destructive"
                                                    className="h-8 px-2 sm:h-[32px] sm:px-[10px] shrink-0 rounded-[6px] text-[12px] font-bold flex items-center justify-center gap-2"
                                                    onClick={() => setIsBulkDeleteDialogOpen(true)}
                                                    disabled={isBulkDeleting}
                                                >
                                                    <Trash className="h-4 w-4" />
                                                    <span className="hidden sm:inline">Delete Selected</span>
                                                    <span className="text-xs font-medium text-white/80">
                                                        ({selectedLeadIds.length})
                                                    </span>
                                                </Button>
                                            )}
                                            {/* Filters Button */}
                                            <Button
                                                variant="outline"
                                                className={`h-8 w-8 p-0 sm:h-[32px] sm:w-auto sm:px-[10px] shrink-0 rounded-[6px] text-[12px] font-bold shadow-none flex items-center justify-center ${theme === "color"
                                                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                                    : "border border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[rgba(58,58,58,0.3)] text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50 dark:hover:bg-[rgba(58,58,58,0.5)]"
                                                    }`}
                                                onClick={handleOpenFilterDialog}
                                            >
                                                <Filter className="h-4 w-4 sm:mr-[6px]" />
                                                <span className="hidden sm:inline">Filters</span>
                                            </Button>

                                            {/* Activity Log Button */}
                                            <Button
                                                variant="outline"
                                                className={`h-8 w-8 p-0 sm:h-[32px] sm:w-auto sm:px-[10px] shrink-0 rounded-[6px] text-[12px] font-bold shadow-none flex items-center justify-center ${theme === "color"
                                                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                                    : "border border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[rgba(58,58,58,0.3)] text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50 dark:hover:bg-[rgba(58,58,58,0.5)]"
                                                    }`}
                                                onClick={handleOpenActivityLog}
                                            >
                                                <FileText className="h-4 w-4 sm:mr-[6px]" />
                                                <span className="hidden sm:inline">Activity Log</span>
                                            </Button>

                                            {/* Divider */}
                                            <div className={`hidden sm:block w-px h-5 shrink-0 ${theme === "color"
                                                ? "bg-[rgba(0,255,255,0.2)]"
                                                : "bg-[#e5e7eb] dark:bg-[#3a3a3a]"
                                                }`} />

                                            {/* Refresh Button */}
                                            <Button
                                                variant="outline"
                                                className={`h-8 w-8 p-0 sm:h-[32px] sm:w-[32px] shrink-0 rounded-[6px] text-[12px] font-bold shadow-none flex items-center justify-center ${theme === "color"
                                                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                                    : "border border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[rgba(58,58,58,0.3)] text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50 dark:hover:bg-[rgba(58,58,58,0.5)]"
                                                    }`}
                                                onClick={handleRefreshLeads}
                                                disabled={isRefreshingLeads || isLoading}
                                                aria-label="Refresh leads"
                                                title="Refresh leads"
                                            >
                                                {isRefreshingLeads || isLoading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="h-4 w-4" />
                                                )}
                                            </Button>

                                            {/* Export Button */}
                                            <Button
                                                variant="outline"
                                                className={`h-8 w-8 p-0 sm:h-[32px] sm:w-auto sm:px-[10px] shrink-0 rounded-[6px] text-[12px] font-bold shadow-none flex items-center justify-center ${theme === "color"
                                                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                                    : "border border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[rgba(58,58,58,0.3)] text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50 dark:hover:bg-[rgba(58,58,58,0.5)]"
                                                    }`}
                                                onClick={handleExportLeads}
                                                disabled={isExportingLeads}
                                            >
                                                {isExportingLeads ? (
                                                    <Loader2 className="h-4 w-4 sm:mr-[6px] animate-spin" />
                                                ) : (
                                                    <Download className="h-4 w-4 sm:mr-[6px]" />
                                                )}
                                                <span className="hidden sm:inline">Export</span>
                                            </Button>

                                            {/* Bulk Upload Button */}
                                            <Button
                                                variant="outline"
                                                className={`h-8 w-8 p-0 sm:h-[32px] sm:w-auto sm:px-[10px] shrink-0 rounded-[6px] text-[12px] font-bold shadow-none flex items-center justify-center ${theme === "color"
                                                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                                    : "border border-[#e5e7eb] dark:border-[#3a3a3a] bg-white dark:bg-[rgba(58,58,58,0.3)] text-[#1f1f1f] dark:text-[#e5e5e5] hover:bg-muted/50 dark:hover:bg-[rgba(58,58,58,0.5)]"
                                                    }`}
                                                onClick={() => setIsBulkUploadOpen(true)}
                                            >
                                                <Upload className="h-4 w-4 sm:mr-[6px]" />
                                                <span className="hidden sm:inline">Bulk Upload</span>
                                            </Button>

                                            {/* Add Lead Button */}
                                            <Button
                                                type="button"
                                                onClick={handleOpenAddLead}
                                                className={`h-8 w-8 p-0 sm:h-[32px] sm:w-auto sm:px-3 shrink-0 text-white rounded-[6px] text-[12px] font-bold shadow-none flex items-center justify-center ${theme === "color"
                                                    ? "bg-[#0ff] text-[#0a0e27] hover:bg-[#0dd]"
                                                    : "bg-[#7b68ee] dark:bg-[#8b7aff] hover:bg-[#6b58dd] dark:hover:bg-[#7b6aee]"
                                                    }`}
                                            >
                                                <Plus className="h-4 w-4 sm:mr-[6px]" />
                                                <span className="hidden sm:inline">Add Lead</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Search Input — full width on mobile */}
                                    <div className="relative w-full h-[32px] sm:hidden">
                                        <Search className={`absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] z-10 ${theme === "color"
                                            ? "text-[rgba(0,255,255,0.6)]"
                                            : "text-[#6b7280] dark:text-[#9ca3af]"
                                            }`} />
                                        <Input
                                            type="text"
                                            placeholder="Search leads, companies, contacts..."
                                            className={`pl-[32px] pr-3 py-1 h-[32px] w-full rounded-[6px] text-[14px] focus-visible:ring-0 ${theme === "color"
                                                ? "bg-[rgba(244,245,247,0.5)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)] placeholder:text-[rgba(0,255,255,0.6)] focus-visible:border-[rgba(0,255,255,0.3)]"
                                                : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(58,58,58,0.3)] border border-[#e5e7eb] dark:border-[#3a3a3a] text-[#6b7280] dark:text-[#9ca3af] placeholder:text-[#6b7280] dark:placeholder:text-[#9ca3af] focus-visible:border-[#e5e7eb] dark:focus-visible:border-[#3a3a3a]"
                                                }`}
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* Leads Date Range Filter Row */}
                    {activeTab === "leads" && !isFigmaInlineDealsDesign && (
                        <div className={`border-b-[0.667px] w-full max-w-full ${theme === "color"
                            ? "bg-[#0A0E27] border-[rgba(0,255,255,0.2)]"
                            : "bg-[rgba(244,245,247,0.3)] dark:bg-[rgba(42,42,42,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
                            }`}>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 px-3 sm:px-6 py-2">
                                <span className={`text-[12px] font-bold shrink-0 ${theme === "color"
                                    ? "text-[rgba(0,255,255,0.8)]"
                                    : "text-[#6b7280] dark:text-[#9ca3af]"
                                    }`}>
                                    Date range
                                </span>
                                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 w-full sm:flex sm:w-auto sm:min-w-0">
                                    <Input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => {
                                            setDateFrom(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className={`h-[32px] text-[12px] min-w-0 w-full sm:w-[150px] px-2 ${theme === "color"
                                            ? "bg-[rgba(244,245,247,0.5)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)]"
                                            : "bg-white dark:bg-[rgba(58,58,58,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                            }`}
                                    />
                                    <span className={`text-[12px] px-0.5 shrink-0 ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`}>to</span>
                                    <Input
                                        type="date"
                                        value={dateTo}
                                        min={dateFrom || undefined}
                                        onChange={(e) => {
                                            setDateTo(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className={`h-[32px] text-[12px] min-w-0 w-full sm:w-[150px] px-2 ${theme === "color"
                                            ? "bg-[rgba(244,245,247,0.5)] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.9)]"
                                            : "bg-white dark:bg-[rgba(58,58,58,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                            }`}
                                    />
                                </div>
                                {(dateFrom || dateTo) && (
                                    <Button
                                        variant="outline"
                                        className={`h-[30px] px-2 text-[11px] shrink-0 ${theme === "color"
                                            ? "border-[rgba(0,255,255,0.2)] bg-[rgba(0,255,255,0.05)] text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                            : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                                            }`}
                                        onClick={() => {
                                            setDateFrom("");
                                            setDateTo("");
                                            setCurrentPage(1);
                                        }}
                                    >
                                        Clear dates
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tabs Section */}
                    <Tabs
                        value={activeTab}
                        onValueChange={(value) =>
                            setActiveTab(value === "facebook-leads" ? "facebook-leads" : "leads")
                        }
                        className={
                            isFigmaInlineDealsDesign && activeTab === "leads"
                                ? "w-full flex min-h-0 flex-1 flex-col"
                                : "w-full"
                        }
                    >
                        <TabsContent
                            value="leads"
                            className={
                                isFigmaInlineDealsDesign
                                    ? "mt-0 flex min-h-0 flex-1 flex-col"
                                    : "mt-0"
                            }
                        >

                            {/* Leads Count Section */}
                            {!isFigmaInlineDealsDesign && (
                            <div className={`border-b-[0.667px] h-[33px] relative shrink-0 w-full ${theme === "color"
                                ? "bg-[#0A0E27] border-[rgba(0,255,255,0.2)]"
                                : "bg-[rgba(244,245,247,0.3)] dark:bg-[rgba(42,42,42,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                }`}>
                                <div className="flex items-center h-full px-6 py-2">
                                    <p className={`text-[12px] font-bold leading-[16px] ${theme === "color"
                                        ? "text-[rgba(0,255,255,0.6)]"
                                        : "text-[#6b7280] dark:text-[#9ca3af]"
                                        }`}>
                                        {(searchTerm || selectedStage !== "all" || selectedOwner !== "all" || selectedLeadStatus !== "all" || (dateFrom && dateTo)) ? filteredLeads.length : totalLeads} Lead{(searchTerm || selectedStage !== "all" || selectedOwner !== "all" || selectedLeadStatus !== "all" || (dateFrom && dateTo)) ? (filteredLeads.length !== 1 ? 's' : '') : (totalLeads !== 1 ? 's' : '')}
                                    </p>
                                </div>
                            </div>
                            )}

                            {/* Leads Table */}
                            <div
                                className={
                                    isFigmaInlineDealsDesign
                                        ? "relative flex min-h-0 flex-1 flex-col bg-[#161616]"
                                        : `relative ${theme === "color" ? "bg-[#0A0E27]" : ""}`
                                }
                            >
                                {isFigmaInlineDealsDesign ? (
                                    <LeadsDataTable
                                        rows={sortedLeadsForTable}
                                        loading={isLoading}
                                        emptyLabel="No leads found."
                                        sort={leadsSort}
                                        onSortChange={setLeadsSort}
                                        getRowId={(lead) => String(lead?._id || lead?.id || "")}
                                        onRowClick={openLeadFromRow}
                                        selectedIds={selectedLeadIdSet}
                                        allSelected={allDisplayedSelected}
                                        someSelected={partiallySelected}
                                        onToggleRow={(id) =>
                                            handleToggleLeadSelection(id, !selectedLeadIdSet.has(id))
                                        }
                                        onToggleAll={() =>
                                            handleToggleSelectAllDisplayed(!allDisplayedSelected)
                                        }
                                        getLeadName={getLeadName}
                                        getOwner={(lead) => {
                                            const owner = getOwnerDetails(lead);
                                            return { name: owner.name, email: owner.email };
                                        }}
                                        getStage={(lead) => getStageString(lead.stage)}
                                        getValue={getLeadNumericValue}
                                        formatValue={formatLeadValue}
                                        getNextFollowUp={getNextFollowUp}
                                        getEmail={getLeadEmailValue}
                                        renderTags={(lead) => renderLeadTagsColumn(lead, true)}
                                        renderActions={renderLeadRowActions}
                                        footerTotals={[
                                            {
                                                label: "Leads",
                                                value: totalLeads.toLocaleString(),
                                            },
                                            {
                                                label: "Page value",
                                                value: formatLeadValue(
                                                    sortedLeadsForTable.reduce(
                                                        (sum, lead) => sum + getLeadNumericValue(lead),
                                                        0
                                                    )
                                                ),
                                            },
                                            ...(selectedLeadIds.length > 0
                                                ? [
                                                    {
                                                        label: "Selected",
                                                        value: selectedLeadIds.length.toLocaleString(),
                                                    },
                                                ]
                                                : []),
                                        ]}
                                        pagination={{
                                            page: currentPage,
                                            totalPages: Math.max(1, totalPages),
                                            rangeLabel: `${totalLeads === 0 ? 0 : startIndex + 1} to ${endIndex}`,
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
                                            },
                                        }}
                                    />
                                ) : (
                                <>
                                {/* Mobile lead cards -- horizontally scrollable table */}
                                <div className="md:hidden overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6">
                                    <div className="inline-block min-w-full px-3 sm:px-4 md:px-6">
                                        {isLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2" />
                                                <span className="text-sm text-muted-foreground">Loading leads...</span>
                                            </div>
                                        ) : filteredLeads.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">No leads found</div>
                                        ) : (
                                            <table className="min-w-[700px] w-full border-collapse">
                                                <thead>
                                                    <tr className={`border-b-[0.667px] ${theme === "color"
                                                            ? "bg-[rgba(255,255,255,0.03)] border-[rgba(0,255,255,0.2)]"
                                                            : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(42,42,42,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                                        }`}>
                                                        <th className="w-[46px] px-3 py-2 text-left">
                                                            <Checkbox
                                                                checked={headerCheckboxValue}
                                                                onCheckedChange={(checked) =>
                                                                    handleToggleSelectAllDisplayed(checked === true)
                                                                }
                                                                aria-label="Select all visible leads"
                                                                className={theme === "color" ? "border-[rgba(0,255,255,0.2)] data-[state=checked]:bg-[rgba(0,0,0,0.3)] rounded-full" : "rounded-full"}
                                                            />
                                                        </th>
                                                        <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                                                            }`}>Lead Name</th>
                                                        <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                                                            }`}>Tags</th>
                                                        <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                                                            }`}>Owner</th>
                                                        <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                                                            }`}>Stage</th>
                                                        <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                                                            }`}>Value</th>
                                                        <th className={`font-bold text-[12px] leading-[16px] px-3 py-2 text-left ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                                                            }`}>Next Follow-up</th>
                                                        <th className={`w-[108px] px-3 py-2 font-bold text-[12px] leading-[16px] text-left ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"
                                                            }`}>Contact</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredLeads.map((lead) => {
                                                        const rawId = lead?._id || lead?.id;
                                                        if (!rawId) return null;
                                                        const leadId = String(rawId);
                                                        const isChecked = selectedLeadIds.includes(leadId);
                                                        return (
                                                            <tr
                                                                key={leadId}
                                                                className={`cursor-pointer border-b-[0.667px] ${theme === "color"
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
                                                                        target.closest('.dropdown-menu') ||
                                                                        target.closest('[data-lead-contact-action]') ||
                                                                        target.tagName === 'BUTTON' ||
                                                                        target.tagName === 'INPUT';
                                                                    if (!isInteractive) {
                                                                        const rowLeadId = lead._id || lead.id;
                                                                        if (!rowLeadId) return;
                                                                        if (!openDealsLeadInline(String(rowLeadId))) {
                                                                            router.push(`/deals/leads/${rowLeadId}`);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                                    <Checkbox
                                                                        checked={isChecked}
                                                                        onCheckedChange={(checked) => handleToggleLeadSelection(leadId, checked === true)}
                                                                        aria-label={`Select lead ${getLeadName(lead)}`}
                                                                        className={theme === "color" ? "border-[rgba(0,255,255,0.2)] data-[state=checked]:bg-[rgba(0,0,0,0.3)] rounded-full" : "rounded-full"}
                                                                    />
                                                                </td>
                                                                <td className={`px-3 py-2 ${theme === "color" ? "text-white" : "text-black dark:text-white"}`}>
                                                                    <span className="font-bold text-[14px] leading-[20px]">{getLeadName(lead)}</span>
                                                                </td>
                                                                <td className={`px-3 py-2 ${theme === "color" ? "text-white" : "text-[#1f1f1f] dark:text-[#e5e5e5]"}`}>
                                                                    <div className="flex flex-nowrap gap-1 items-center">
                                                                        {renderLeadTagsColumn(lead)}
                                                                    </div>
                                                                </td>
                                                                <td className={`px-3 py-2 ${theme === "color" ? "text-white" : "text-[#1f1f1f] dark:text-[#e5e5e5]"}`}>
                                                                    <span className="text-[14px] leading-[20px]">{getOwnerDetails(lead).name}</span>
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <Badge className={`${getStageColor(lead.stage)} h-[21.833px] px-2 rounded-[6px] text-[11px] font-bold leading-[16.5px] border-[0.667px]`}>
                                                                        {getStageString(lead.stage)}
                                                                    </Badge>
                                                                </td>
                                                                <td className={`px-3 py-2 ${theme === "color" ? "text-white" : "text-[#1f1f1f] dark:text-white"}`}>
                                                                    <span className="font-bold text-[14px] leading-[20px]">
                                                                        {`\u20b9${(lead.negotiatedPricing || lead.pricing || lead.estimatedValue || 0).toLocaleString()}`}
                                                                    </span>
                                                                </td>
                                                                <td className={`px-3 py-2 ${theme === "color" ? "text-[rgba(0,255,255,0.6)]" : "text-[#6b7280] dark:text-[#9ca3af]"}`}>
                                                                    <span className="text-[14px] leading-[20px]">{getNextFollowUp(lead)}</span>
                                                                </td>
                                                                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="flex items-center justify-end gap-0.5">
                                                                        <LeadContactQuickActions
                                                                            lead={lead}
                                                                            theme={theme === "color" ? "color" : theme === "dark" ? "dark" : "light"}
                                                                        />
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className={`h-7 w-7 ${theme === "color"
                                                                                            ? "hover:bg-[rgba(0,255,255,0.1)]"
                                                                                            : "hover:bg-muted/50"
                                                                                        }`}
                                                                                >
                                                                                    <MoreHorizontal className={`h-4 w-4 ${theme === "color" ? "text-white" : theme === "dark" ? "text-white" : "text-black"
                                                                                        }`} />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end" className={theme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : ""}>
                                                                                <DropdownMenuItem
                                                                                    className={theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""}
                                                                                    onClick={() => handleViewDetails(lead)}
                                                                                >
                                                                                    <Eye className="h-4 w-4 mr-2" />View
                                                                                </DropdownMenuItem>
                                                                                <DropdownMenuItem
                                                                                    className={theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""}
                                                                                    onClick={() => handleEditLead(lead)}
                                                                                >
                                                                                    <Pencil className="h-4 w-4 mr-2" />Edit
                                                                                </DropdownMenuItem>
                                                                                <DropdownMenuItem
                                                                                    className={theme === "color" ? "text-[rgba(255,100,100,0.9)] hover:bg-[rgba(255,0,0,0.1)]" : "text-red-600 focus:text-red-700"}
                                                                                    onClick={() => handleDeleteLead(lead)}
                                                                                >
                                                                                    <Trash2 className="h-4 w-4 mr-2" />Delete
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
                                        )}
                                    </div>
                                </div>

                                <div
                                    ref={scrollContainerRef}
                                    className="hidden md:block overflow-x-auto cursor-grab"
                                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                                    onMouseDown={(e) => {
                                        // Don't start dragging if clicking on interactive elements
                                        const target = e.target as HTMLElement;
                                        const isInteractive =
                                            target.tagName === 'BUTTON' ||
                                            target.tagName === 'INPUT' ||
                                            target.tagName === 'A' ||
                                            target.closest('button') ||
                                            target.closest('input') ||
                                            target.closest('a') ||
                                            target.closest('[role="button"]') ||
                                            target.closest('[role="checkbox"]');

                                        if (isInteractive) {
                                            return;
                                        }

                                        if (!scrollContainerRef.current) return;

                                        // Check if table is scrollable
                                        const container = scrollContainerRef.current;
                                        if (container.scrollWidth <= container.clientWidth) {
                                            return; // No need to scroll if content fits
                                        }

                                        dragStateRef.current = {
                                            isDown: true,
                                            startX: e.clientX,
                                            scrollLeft: container.scrollLeft,
                                        };
                                        setIsDragging(true);
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                >
                                    <Table
                                        className={`min-w-full ${isFigmaInlineDealsDesign ? "min-w-[1195px] table-fixed w-full rounded-[5px]" : ""}`}
                                        style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
                                    >
                                        {isFigmaInlineDealsDesign ? (
                                            <colgroup>
                                                <col className="w-[44px]" />
                                                <col className="w-[200px]" />
                                                <col className="w-[220px]" />
                                                <col className="w-[100px]" />
                                                <col className="w-[125px]" />
                                                <col className="w-[95px]" />
                                                <col className="w-[90px]" />
                                                <col className="w-[180px]" />
                                                <col className="w-[88px]" />
                                            </colgroup>
                                        ) : null}
                                        <TableHeader className={
                                            isFigmaInlineDealsDesign
                                                ? "bg-[#2e2e2e] border-b border-[#2a2d3a]"
                                                : `border-b-[0.667px] ${theme === "color"
                                                    ? "bg-[rgba(255,255,255,0.03)] border-[rgba(0,255,255,0.2)]"
                                                    : "bg-[rgba(244,245,247,0.5)] dark:bg-[rgba(42,42,42,0.3)] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                                }`
                                        }>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className={
                                                    isFigmaInlineDealsDesign
                                                        ? "w-[32px] h-[26px] px-2 py-0 text-[#9ca3af]"
                                                        : `w-[46px] px-3 py-2 ${theme === "color"
                                                            ? "text-[rgba(0,255,255,0.6)]"
                                                            : "text-[#6b7280] dark:text-[#9ca3af]"
                                                        }`
                                                }>
                                                    <Checkbox
                                                        checked={headerCheckboxValue}
                                                        onCheckedChange={(checked) => handleToggleSelectAllDisplayed(checked === true)}
                                                        aria-label="Select all visible leads"
                                                        className={
                                                            isFigmaInlineDealsDesign
                                                                ? "h-[14px] w-[14px] rounded-full border-[1.5px] border-[#8c8c9e] data-[state=checked]:bg-[#8c8c9e] data-[state=checked]:text-[#181818]"
                                                                : (theme === "color" ? "border-[rgba(0,255,255,0.2)] data-[state=checked]:bg-[rgba(0,0,0,0.3)] rounded-full" : "rounded-full")
                                                        }
                                                    />
                                                </TableHead>
                                                <TableHead className={
                                                    isFigmaInlineDealsDesign
                                                        ? "h-[26px] px-2 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af]"
                                                        : `font-bold text-[12px] leading-[16px] px-3 py-2 ${theme === "color"
                                                            ? "text-[rgba(0,255,255,0.6)]"
                                                            : "text-[#6b7280] dark:text-[#9ca3af]"
                                                        }`
                                                }>Lead Name</TableHead>
                                                <TableHead className={
                                                    isFigmaInlineDealsDesign
                                                        ? "h-[26px] px-2 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af] w-[220px] max-w-[220px]"
                                                        : `font-bold text-[12px] leading-[16px] px-3 py-2 ${theme === "color"
                                                            ? "text-[rgba(0,255,255,0.6)]"
                                                            : "text-[#6b7280] dark:text-[#9ca3af]"
                                                        }`
                                                }>Tags</TableHead>
                                                <TableHead className={
                                                    isFigmaInlineDealsDesign
                                                        ? "h-[26px] px-2 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af] w-[100px]"
                                                        : `font-bold text-[12px] leading-[16px] px-3 py-2 ${theme === "color"
                                                            ? "text-[rgba(0,255,255,0.6)]"
                                                            : "text-[#6b7280] dark:text-[#9ca3af]"
                                                        }`
                                                }>Owner</TableHead>
                                                <TableHead className={
                                                    isFigmaInlineDealsDesign
                                                        ? "h-[26px] px-2 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af] w-[125px] max-w-[125px]"
                                                        : `font-bold text-[12px] leading-[16px] px-3 py-2 ${theme === "color"
                                                            ? "text-[rgba(0,255,255,0.6)]"
                                                            : "text-[#6b7280] dark:text-[#9ca3af]"
                                                        }`
                                                }>Stage</TableHead>
                                                <TableHead className={
                                                    isFigmaInlineDealsDesign
                                                        ? "h-[26px] px-2 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af] w-[95px] max-w-[95px]"
                                                        : `font-bold text-[12px] leading-[16px] px-3 py-2 ${theme === "color"
                                                            ? "text-[rgba(0,255,255,0.6)]"
                                                            : "text-[#6b7280] dark:text-[#9ca3af]"
                                                        }`
                                                }>Value</TableHead>
                                                <TableHead className={
                                                    isFigmaInlineDealsDesign
                                                        ? "h-[26px] px-2 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af] w-[85px]"
                                                        : `font-bold text-[12px] leading-[16px] px-3 py-2 ${theme === "color"
                                                            ? "text-[rgba(0,255,255,0.6)]"
                                                            : "text-[#6b7280] dark:text-[#9ca3af]"
                                                        }`
                                                }>Next Follow-up</TableHead>
                                                <TableHead className={
                                                    isFigmaInlineDealsDesign
                                                        ? "h-[26px] pl-2 pr-1 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af] w-[180px]"
                                                        : `w-[108px] px-3 py-2 font-bold text-[12px] leading-[16px] ${theme === "color"
                                                            ? "text-[rgba(0,255,255,0.6)]"
                                                            : "text-[#6b7280] dark:text-[#9ca3af]"
                                                        }`
                                                }>Contact</TableHead>
                                                {isFigmaInlineDealsDesign ? (
                                                    <TableHead className="h-[26px] pl-1 pr-2 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af] w-[88px]">
                                                        Actions
                                                    </TableHead>
                                                ) : null}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={isFigmaInlineDealsDesign ? 9 : 8} className="text-center py-8 px-3 sm:px-4 md:px-6">
                                                        <div className="flex items-center justify-center">
                                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                                                            Loading leads...
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredLeads.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={isFigmaInlineDealsDesign ? 9 : 8} className="text-center py-8 text-gray-500 px-3 sm:px-4 md:px-6">
                                                        No leads found
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredLeads.map((lead, index) => {
                                                    const rawId = lead?._id || lead?.id;
                                                    if (!rawId) {
                                                        return null;
                                                    }
                                                    const leadId = String(rawId);
                                                    const isChecked = selectedLeadIds.includes(leadId);
                                                    return (
                                                        <TableRow
                                                            key={leadId}
                                                            className={
                                                                isFigmaInlineDealsDesign
                                                                    ? "group cursor-pointer border-b border-[#2a2d3a] bg-[#181818] hover:bg-[#181818]"
                                                                    : `group cursor-pointer border-b-[0.667px] ${theme === "color"
                                                                        ? "border-[rgba(0,255,255,0.2)] hover:bg-[rgba(0,255,255,0.05)]"
                                                                        : "border-[#e5e7eb] dark:border-[#3a3a3a] hover:bg-muted/60"
                                                                    }`
                                                            }
                                                            onClick={(e) => {
                                                                // Don't navigate if clicking on interactive elements
                                                                const target = e.target as HTMLElement;
                                                                const isInteractive =
                                                                    target.closest('button') ||
                                                                    target.closest('input') ||
                                                                    target.closest('[role="menuitem"]') ||
                                                                    target.closest('[role="checkbox"]') ||
                                                                    target.closest('.dropdown-menu') ||
                                                                    target.closest('[data-lead-contact-action]') ||
                                                                    target.tagName === 'BUTTON' ||
                                                                    target.tagName === 'INPUT';

                                                                if (!isInteractive) {
                                                                    const rowLeadId = lead._id || lead.id;
                                                                    if (!rowLeadId) return;
                                                                    if (!openDealsLeadInline(String(rowLeadId))) {
                                                                        router.push(`/deals/leads/${rowLeadId}`);
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <TableCell
                                                                className={isFigmaInlineDealsDesign ? "px-2 py-3" : "px-3 py-2"}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Checkbox
                                                                    checked={isChecked}
                                                                    onCheckedChange={(checked) => handleToggleLeadSelection(leadId, checked === true)}
                                                                    aria-label={`Select lead ${getLeadName(lead)}`}
                                                                    className={
                                                                        isFigmaInlineDealsDesign
                                                                            ? "h-[14px] w-[14px] rounded-full border-[1.5px] border-[#8c8c9e] data-[state=checked]:bg-[#8c8c9e] data-[state=checked]:text-[#181818]"
                                                                            : (theme === "color" ? "border-[rgba(0,255,255,0.2)] data-[state=checked]:bg-[rgba(0,0,0,0.3)] rounded-full" : "rounded-full")
                                                                    }
                                                                />
                                                            </TableCell>
                                                            <TableCell
                                                                className={
                                                                    isFigmaInlineDealsDesign
                                                                        ? "px-2 py-3 text-white"
                                                                        : `px-3 py-2 ${theme === "color"
                                                                            ? "text-white"
                                                                            : "text-black dark:text-white"
                                                                        }`
                                                                }
                                                            >
                                                                {isFigmaInlineDealsDesign ? (
                                                                    <div className="flex items-center min-w-0">
                                                                        <span className="font-semibold text-[12px] leading-[16px] truncate">
                                                                            {getLeadName(lead)}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="font-bold text-[14px] leading-[20px]">
                                                                        {getLeadName(lead)}
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className={
                                                                isFigmaInlineDealsDesign
                                                                    ? "px-2 py-3 text-white w-[220px] max-w-[220px] align-top"
                                                                    : `px-3 py-2 ${theme === "color"
                                                                        ? "text-white"
                                                                        : "text-[#1f1f1f] dark:text-[#e5e5e5]"
                                                                    }`
                                                            }>
                                                                <div className={isFigmaInlineDealsDesign ? "flex flex-nowrap gap-1 items-center w-full max-w-full" : "flex flex-nowrap gap-1 items-center"}>
                                                                    {renderLeadTagsColumn(lead, isFigmaInlineDealsDesign)}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className={
                                                                isFigmaInlineDealsDesign
                                                                    ? "px-2 py-3 text-white"
                                                                    : `px-3 py-2 ${theme === "color"
                                                                        ? "text-white"
                                                                        : "text-[#1f1f1f] dark:text-[#e5e5e5]"
                                                                    }`
                                                            }>
                                                                <span className={isFigmaInlineDealsDesign ? "text-[12px] leading-[16px]" : "text-[14px] leading-[20px]"}>
                                                                    {getOwnerDetails(lead).name}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className={isFigmaInlineDealsDesign ? "px-2 py-3 w-[125px] max-w-[125px] overflow-hidden" : "px-3 py-2"}>
                                                                {isFigmaInlineDealsDesign ? (
                                                                    <span
                                                                        className="block text-[12px] leading-[16px] text-white truncate"
                                                                        title={getStageString(lead.stage)}
                                                                    >
                                                                        {getStageString(lead.stage)}
                                                                    </span>
                                                                ) : (
                                                                    <Badge className={`${getStageColor(lead.stage)} h-[21.833px] px-2 rounded-[6px] text-[11px] font-bold leading-[16.5px] border-[0.667px]`}>
                                                                        {getStageString(lead.stage)}
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className={
                                                                isFigmaInlineDealsDesign
                                                                    ? "px-2 py-3 text-white w-[95px] max-w-[95px] overflow-hidden"
                                                                    : `px-3 py-2 ${theme === "color"
                                                                        ? "text-white"
                                                                        : "text-[#1f1f1f] dark:text-white"
                                                                    }`
                                                            }>
                                                                <span className={isFigmaInlineDealsDesign ? "block font-semibold text-[12px] leading-[16px] whitespace-nowrap truncate" : "font-bold text-[14px] leading-[20px]"}>
                                                                    ₹{(lead.negotiatedPricing || lead.pricing || lead.estimatedValue || 0).toLocaleString()}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className={
                                                                isFigmaInlineDealsDesign
                                                                    ? "px-2 py-3 text-[#9ca3af]"
                                                                    : `px-3 py-2 ${theme === "color"
                                                                        ? "text-[rgba(0,255,255,0.6)]"
                                                                        : "text-[#6b7280] dark:text-[#9ca3af]"
                                                                    }`
                                                            }>
                                                                <span className={isFigmaInlineDealsDesign ? "text-[12px] leading-[16px] whitespace-nowrap" : "text-[14px] leading-[20px] whitespace-nowrap"}>
                                                                    {getNextFollowUp(lead)}
                                                                </span>
                                                            </TableCell>
                                                            {isFigmaInlineDealsDesign ? (
                                                                <TableCell className="pl-2 pr-1 py-3 max-w-[180px] overflow-hidden">
                                                                    <span
                                                                        className="block text-[12px] leading-[16px] text-[#e5e7eb] truncate"
                                                                        title={(lead?.email || lead?.contactEmail || lead?.contact?.email || lead?.contactDetails?.email || "") as string}
                                                                    >
                                                                        {(lead?.email ||
                                                                            lead?.contactEmail ||
                                                                            lead?.contact?.email ||
                                                                            lead?.contactDetails?.email ||
                                                                            "") as string}
                                                                    </span>
                                                                </TableCell>
                                                            ) : null}
                                                            <TableCell
                                                                className={isFigmaInlineDealsDesign ? "pl-1 pr-2 py-3" : "px-3 py-2"}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <div className={isFigmaInlineDealsDesign ? "flex items-center justify-start gap-[6px]" : "flex items-center justify-end gap-0.5"}>
                                                                    <LeadContactQuickActions
                                                                        lead={lead}
                                                                        variant={isFigmaInlineDealsDesign ? "figma" : "default"}
                                                                        theme={
                                                                            theme === "color"
                                                                                ? "color"
                                                                                : theme === "dark"
                                                                                    ? "dark"
                                                                                    : "light"
                                                                        }
                                                                    />
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className={
                                                                                    isFigmaInlineDealsDesign
                                                                                        ? "h-[15px] w-[15px] p-0 opacity-100 hover:bg-transparent text-[#9ca3af] hover:text-[#e5e7eb]"
                                                                                        : `h-7 w-7 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ${theme === "color"
                                                                                            ? "hover:bg-[rgba(0,255,255,0.1)]"
                                                                                            : "hover:bg-muted/50"
                                                                                        }`
                                                                                }
                                                                            >
                                                                                <MoreHorizontal className={isFigmaInlineDealsDesign ? "h-[15px] w-[15px] text-[#9ca3af]" : `h-4 w-4 ${theme === "color"
                                                                                    ? "text-white group-hover:text-white"
                                                                                    : theme === "dark"
                                                                                        ? "text-white group-hover:text-white"
                                                                                        : "text-black group-hover:text-black"
                                                                                    }`} />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className={isFigmaInlineDealsDesign ? "bg-[#181818] border border-[#2a2d3a] text-white" : theme === "color" ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]" : ""}>
                                                                            <DropdownMenuItem
                                                                                className={isFigmaInlineDealsDesign ? "text-white hover:bg-white/5" : theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""}
                                                                                onClick={() => handleViewDetails(lead)}
                                                                            >
                                                                                <Eye className="h-4 w-4 mr-2" />
                                                                                View
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                className={isFigmaInlineDealsDesign ? "text-white hover:bg-white/5" : theme === "color" ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]" : ""}
                                                                                onClick={() => handleEditLead(lead)}
                                                                            >
                                                                                <Pencil className="h-4 w-4 mr-2" />
                                                                                Edit
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                className={isFigmaInlineDealsDesign ? "text-red-400 hover:bg-red-500/10" : theme === "color" ? "text-[rgba(255,100,100,0.9)] hover:bg-[rgba(255,0,0,0.1)]" : "text-red-600 focus:text-red-700"}
                                                                                onClick={() => handleDeleteLead(lead)}
                                                                            >
                                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 mb-6 pb-16">
                                        <div className="text-sm text-gray-700">
                                            Showing {startIndex + 1} to {endIndex} of {totalLeads} leads
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
                                                                ? "bg-black text-white hover:bg-black/80"
                                                                : "hover:bg-muted/60"
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
                                </>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent
                            value="facebook-leads"
                            className="mt-0 data-[state=inactive]:hidden"
                            forceMount
                        >
                             <FacebookLeadsIntegration
                                 activeTab={activeTab}
                                 setActiveTab={setActiveTab}
                             />
                        </TabsContent>
                    </Tabs>
                </main>
            </div>

            {/* Add Lead Modal */}
            <Dialog
                open={isAddLeadOpen}
                onOpenChange={(open) => {
                    setIsAddLeadOpen(open);
                    if (!open) {
                        setEditingLeadId(null);
                        setLeadForm(buildDefaultLeadForm());
                        setSelectedContactOption(null);
                        setSelectedCompanyOption(null);
                        setSelectedOwnerOption(null);
                        setContactSearchTerm("");
                        setCompanySearchTerm("");
                        setOwnerSearchTerm("");
                        setProductSearchTerm("");
                        setIsOwnerComboOpen(false);
                        setIsProductComboOpen(false);
                        setFunnelStages([]);
                        setLeadNotes([]);
                    }
                }}
            >
                <DialogContent
                    showCloseButton={!isFigmaInlineDealsDesign}
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                    className={
                        isFigmaInlineDealsDesign
                            ? "!max-w-[503px] w-[503px] max-w-[calc(100vw-2rem)] flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-[#0f0f0f] p-0 shadow-[2px_2px_2px_black] top-[50%] translate-y-[-50%]"
                            : "max-w-[calc(100vw-2rem)] sm:max-w-[800px] max-h-[90vh] overflow-y-auto top-[50%] translate-y-[-50%]"
                    }
                >
                    {isFigmaInlineDealsDesign ? (
                        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-5 py-5">
                            <h2 className="text-[15px] font-bold text-white">
                                {editingLeadId ? "Edit Lead" : "Create a Lead"}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsAddLeadOpen(false)}
                                className="text-[#9a9a9a] hover:text-white"
                                aria-label="Close"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                    ) : (
                        <DialogHeader>
                            <DialogTitle>{editingLeadId ? "Edit Lead" : "Add New Lead"}</DialogTitle>
                            <DialogDescription>
                                {editingLeadId ? "Update the lead details and save your changes." : "Create a new lead opportunity in your sales pipeline."}
                            </DialogDescription>
                        </DialogHeader>
                    )}

                    <div
                        className={
                            isFigmaInlineDealsDesign
                                ? "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5"
                                : "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 py-4"
                        }
                    >
                        {/* Left Column */}
                        <div className={addLeadColumnClass}>
                            <div className={addLeadFieldClass}>
                                <Label htmlFor="lead-name" className={addLeadLabelClass}>
                                    Lead Name <span className={isFigmaInlineDealsDesign ? "text-[#9a9a9a]" : "text-red-500"}>*</span>
                                </Label>
                                <Input
                                    id="lead-name"
                                    placeholder="Deal or project name"
                                    value={leadForm.leadName}
                                    onChange={(e) => setLeadForm({ ...leadForm, leadName: e.target.value })}
                                    className={addLeadInputClass}
                                />
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="contact-person" className={addLeadLabelClass}>
                                    Contact Person <span className={isFigmaInlineDealsDesign ? "text-[#9a9a9a]" : "text-red-500"}>*</span>
                                </Label>
                                <Popover open={isContactComboOpen} onOpenChange={setIsContactComboOpen} {...addLeadPopoverProps}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isContactComboOpen}
                                            className={`${addLeadComboClass} ${contactError ? "border-red-500" : ""}`}
                                        >
                                            <span className="truncate text-left">
                                                {(() => {
                                                    const selected =
                                                        selectedContactOption ||
                                                        contacts.find((c) => c.id === (leadForm.contactId ? String(leadForm.contactId) : ""));
                                                    return selected?.name || "Select contact...";
                                                })()}
                                            </span>
                                            {isFigmaInlineDealsDesign ? (
                                                <img alt="" src="/figma/deals/leads/chevron-down.svg" className="size-[15px] shrink-0 opacity-70" />
                                            ) : (
                                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className={`w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0${addLeadPopoverContentClass}`}
                                        {...addLeadPopoverContentProps}
                                    >
                                        <Command className={addLeadCommandClass}>
                                            <CommandInput
                                                placeholder="Search contacts..."
                                                value={contactSearchTerm}
                                                onValueChange={(val) => setContactSearchTerm(val)}
                                            />
                                            <CommandList
                                                className={addLeadCommandListClass}
                                                onWheel={isFigmaInlineDealsDesign ? handleAddLeadDropdownWheel : undefined}
                                            >
                                                {isContactsLoading && (
                                                    <CommandEmpty>
                                                        <span className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
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
                                                                    role: "",
                                                                    phoneNumber: "",
                                                                    dateOfBirth: "",
                                                                });
                                                            }}
                                                            className="cursor-pointer text-primary hover:bg-primary/10"
                                                        >
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            <span>Add New Contact</span>
                                                        </CommandItem>
                                                    </CommandGroup>
                                                )}
                                                {!isContactsLoading && !isSearchingContacts && contacts.length === 0 && (
                                                    <CommandEmpty>No contacts found.</CommandEmpty>
                                                )}
                                                {!isContactsLoading && contacts.length > 0 && (
                                                    <CommandGroup>
                                                        {contacts.map((contact) => {
                                                            const isSelected = String(leadForm.contactId || "") === contact.id;
                                                            const selectContact = () => {
                                                                setLeadForm((prev) => ({
                                                                    ...prev,
                                                                    contactId: contact.id,
                                                                    email: contact.email || "",
                                                                    phone: contact.phoneNumber || "",
                                                                }));
                                                                setSelectedContactOption(contact);
                                                                setContactError(null);
                                                                setContactSearchTerm("");
                                                                setIsContactComboOpen(false);
                                                            };
                                                            return (
                                                                <CommandItem
                                                                    key={contact.id}
                                                                    value={`${contact.name} ${contact.email} ${contact.companyName || ""}`.trim() || contact.id}
                                                                    onSelect={() => selectContact()}
                                                                    onMouseDown={(event) => {
                                                                        event.preventDefault();
                                                                        selectContact();
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
                                {contactError && <p className="text-sm text-red-600 mt-1">{contactError}</p>}
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="phone" className={addLeadLabelClass}>Phone</Label>
                                <Input
                                    id="phone"
                                    placeholder="e.g. 8076034219, +918076034219"
                                    value={leadForm.phone}
                                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                                    className={addLeadInputClass}
                                />
                                {!isFigmaInlineDealsDesign && (
                                <p className="text-xs text-muted-foreground">
                                    Add multiple numbers separated by comma, semicolon, or new line.
                                </p>
                                )}
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="initial-stage" className={addLeadLabelClass}>Initial Stage</Label>
                                <Select
                                    value={leadForm.initialStage}
                                    onValueChange={(value) => setLeadForm({ ...leadForm, initialStage: value })}
                                    disabled={!leadForm.salesFunnelId || isLoadingStages || funnelStages.length === 0}
                                >
                                    <SelectTrigger className={addLeadSelectTriggerClass}>
                                        <SelectValue placeholder={isLoadingStages ? "Loading stages..." : leadForm.salesFunnelId ? "Select stage" : "Select sales funnel first"} />
                                    </SelectTrigger>
                                    <SelectContent className={addLeadSelectContentClass} {...addLeadSelectContentProps}>
                                        {funnelStages.length > 0 ? (
                                            funnelStages.map((stage, index) => {
                                                const stageName = String(stage?.name || stage?.value || "");
                                                const stageValue = String(stage?.name || stage?.value || "");
                                                if (!stageName || !stageValue) return null;
                                                return (
                                                    <SelectItem key={index} value={stageValue}>
                                                        {stageName}
                                                    </SelectItem>
                                                );
                                            })
                                        ) : (
                                            <SelectItem value="Prospects" disabled>No stages available</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="source" className={addLeadLabelClass}>Source</Label>
                                {isCustomSourceAdd ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="custom-source-add"
                                            placeholder="Type custom source..."
                                            value={customSourceAddValue}
                                            onChange={(e) => {
                                                setCustomSourceAddValue(e.target.value);
                                                setLeadForm({ ...leadForm, source: e.target.value });
                                            }}
                                            autoFocus
                                            className={addLeadInputClass}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 shrink-0"
                                            onClick={() => {
                                                setIsCustomSourceAdd(false);
                                                setCustomSourceAddValue("");
                                                setLeadForm({ ...leadForm, source: "" });
                                            }}
                                            title="Back to presets"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Select
                                        value={
                                            sources.includes(leadForm.source || "")
                                                ? leadForm.source
                                                : leadForm.source
                                                    ? "__current_custom__"
                                                    : undefined
                                        }
                                        onValueChange={(value) => {
                                            if (value === "__add_custom__") {
                                                setIsCustomSourceAdd(true);
                                                setCustomSourceAddValue("");
                                                setLeadForm({ ...leadForm, source: "" });
                                            } else if (value === "__current_custom__") {
                                                // do nothing, already selected
                                            } else {
                                                setLeadForm({ ...leadForm, source: value });
                                            }
                                        }}
                                    >
                                        <SelectTrigger className={addLeadSelectTriggerClass}>
                                            <SelectValue placeholder="Select source" />
                                        </SelectTrigger>
                                        <SelectContent className={addLeadSelectContentClass} {...addLeadSelectContentProps}>
                                            {sources.map((source) => (
                                                <SelectItem key={source} value={source}>
                                                    {source}
                                                </SelectItem>
                                            ))}
                                            {/* Show existing custom source if not in presets */}
                                            {leadForm.source &&
                                                !sources.includes(leadForm.source) && (
                                                    <SelectItem key="__current_custom__" value="__current_custom__">
                                                        {leadForm.source}
                                                    </SelectItem>
                                                )}
                                            <SelectItem value="__add_custom__">
                                                <span className="flex items-center gap-1">
                                                    <Plus className="h-3 w-3" /> Add Custom Source
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="notes" className={addLeadLabelClass}>Notes</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Additional notes about this lead"
                                    value={leadForm.notes}
                                    onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                                    rows={isFigmaInlineDealsDesign ? 3 : 4}
                                    className={addLeadTextareaClass}
                                />
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className={addLeadColumnClass}>
                            <div className={addLeadFieldClass}>
                                <Label htmlFor="company" className={addLeadLabelClass}>Company</Label>
                                <Popover open={isCompanyComboOpen} onOpenChange={setIsCompanyComboOpen} {...addLeadPopoverProps}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isCompanyComboOpen}
                                            className={addLeadComboClass}
                                        >
                                            <span className="truncate text-left">
                                                {(() => {
                                                    const selected = selectedCompanyOption || companies.find((c) => c.id === (leadForm.companyId ? String(leadForm.companyId) : ""));
                                                    return selected?.name || "Select company...";
                                                })()}
                                            </span>
                                            {isFigmaInlineDealsDesign ? (
                                                <img alt="" src="/figma/deals/leads/chevron-down.svg" className="size-[15px] shrink-0 opacity-70" />
                                            ) : (
                                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className={`w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0${addLeadPopoverContentClass}`}
                                        {...addLeadPopoverContentProps}
                                    >
                                        <Command className={addLeadCommandClass}>
                                            <CommandInput
                                                placeholder="Search companies..."
                                                value={companySearchTerm}
                                                onValueChange={(val) => setCompanySearchTerm(val)}
                                            />
                                            <CommandList
                                                className={addLeadCommandListClass}
                                                onWheel={isFigmaInlineDealsDesign ? handleAddLeadDropdownWheel : undefined}
                                            >
                                                {isCompaniesLoading && (
                                                    <CommandEmpty>
                                                        <span className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
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
                                                                    pinCode: "",
                                                                    country: "",
                                                                    state: "",
                                                                    city: "",
                                                                });
                                                            }}
                                                            className="cursor-pointer text-primary hover:bg-primary/10"
                                                        >
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            <span>Add New Company</span>
                                                        </CommandItem>
                                                    </CommandGroup>
                                                )}
                                                {!isCompaniesLoading && !isSearchingCompanies && companies.length === 0 && (
                                                    <CommandEmpty>No companies found.</CommandEmpty>
                                                )}
                                                {!isCompaniesLoading && companies.length > 0 && (
                                                    <CommandGroup>
                                                        {companies.map((company) => {
                                                            const isSelected = String(leadForm.companyId || "") === company.id;
                                                            const pickCompany = () => {
                                                                setLeadForm((prev) => ({
                                                                    ...prev,
                                                                    companyId: company.id,
                                                                }));
                                                                setSelectedCompanyOption(company);
                                                                setCompanySearchTerm("");
                                                                setIsCompanyComboOpen(false);
                                                            };
                                                            return (
                                                                <CommandItem
                                                                    key={company.id}
                                                                    value={`${company.name} ${company.industry || ""}`.trim() || company.id}
                                                                    onSelect={() => pickCompany()}
                                                                    onMouseDown={(event) => {
                                                                        event.preventDefault();
                                                                        pickCompany();
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

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="email" className={addLeadLabelClass}>Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="contact@company.com"
                                    value={leadForm.email}
                                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                                    className={addLeadInputClass}
                                />
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="sales-funnel" className={addLeadLabelClass}>Sales Funnel</Label>
                                <Select
                                    value={leadForm.salesFunnelId}
                                    onValueChange={handleSalesFunnelChange}
                                    disabled={isLoadingStages || isLoadingFunnels}
                                >
                                    <SelectTrigger className={addLeadSelectTriggerClass}>
                                        <SelectValue placeholder={isLoadingFunnels ? "Loading funnels..." : "Sales funnel"} />
                                    </SelectTrigger>
                                    <SelectContent className={addLeadSelectContentClass} {...addLeadSelectContentProps}>
                                        {isLoadingFunnels ? (
                                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading funnels...
                                            </div>
                                        ) : funnels.length > 0 ? (
                                            funnels.map((funnel) => (
                                                <SelectItem key={funnel._id || funnel.id} value={funnel._id || funnel.id}>
                                                    {funnel.funnelName || funnel.name || "Unknown Funnel"}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <div className="py-6 text-center text-sm text-muted-foreground">No funnels found.</div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className={`${addLeadFieldClass}${isFigmaInlineDealsDesign ? "" : " pt-2 border-t mt-4"}`}>
                                <Label className={addLeadLabelClass}>Products</Label>
                                <div className="space-y-2">
                                    <Popover open={isProductComboOpen} onOpenChange={setIsProductComboOpen} {...addLeadPopoverProps}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isProductComboOpen}
                                                className={isFigmaInlineDealsDesign ? addLeadComboClass : "w-full justify-between"}
                                                disabled={isLoadingProducts}
                                            >
                                                {isLoadingProducts ? "Loading products..." : "Select product to add..."}
                                                {isFigmaInlineDealsDesign ? (
                                                    <img alt="" src="/figma/deals/leads/chevron-down.svg" className="size-[15px] shrink-0 opacity-70" />
                                                ) : (
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className={`w-[300px] p-0${addLeadPopoverContentClass}`}
                                            {...addLeadPopoverContentProps}
                                        >
                                            <Command className={addLeadCommandClass}>
                                                <CommandInput
                                                    placeholder="Search products..."
                                                    value={productSearchTerm}
                                                    onValueChange={setProductSearchTerm}
                                                />
                                                <CommandList
                                                className={addLeadCommandListClass}
                                                onWheel={isFigmaInlineDealsDesign ? handleAddLeadDropdownWheel : undefined}
                                            >
                                                    <CommandEmpty>No products found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {allProducts.map((product) => (
                                                            <CommandItem
                                                                key={product._id || product.id}
                                                                value={product.name}
                                                                onSelect={() => {
                                                                    addProductToForm(product);
                                                                    setIsProductComboOpen(false);
                                                                    setProductSearchTerm("");
                                                                }}
                                                            >
                                                                <Check className={`mr-2 h-4 w-4 shrink-0 ${leadForm.products.some(p => p.productId === (product._id || product.id)) ? "opacity-100" : "opacity-0"}`} />
                                                                <div className="flex flex-col">
                                                                    <span>{product.name}</span>
                                                                    <span className="text-xs text-muted-foreground">₹{product.price || product.pricing || 0}</span>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>

                                    {leadForm.products.length > 0 && (
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                            {leadForm.products.map((p) => (
                                                <div key={p.productId} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border">
                                                    <div className="flex-1 min-w-0 mr-2">
                                                        <p className="text-sm font-medium truncate">{p.name || "Unknown Product"}</p>
                                                        <p className="text-xs text-muted-foreground">₹{p.pricing} / {p.unit || 'unit'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center border rounded-md px-1 bg-white">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                type="button"
                                                                onClick={() => updateProductQuantity(p.productId, p.quantity - 1)}
                                                            >
                                                                <ChevronDown className="h-3 w-3" />
                                                            </Button>
                                                            <span className="text-xs min-w-[1.5rem] text-center">{p.quantity}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                type="button"
                                                                onClick={() => updateProductQuantity(p.productId, p.quantity + 1)}
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            type="button"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => removeProductFromForm(p.productId)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="estimated-value" className={addLeadLabelClass}>
                                    Estimated Value
                                </Label>
                                <Input
                                    id="estimated-value"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    value={leadForm.estimatedValue}
                                    onChange={(e) => setLeadForm({ ...leadForm, estimatedValue: e.target.value })}
                                    className={addLeadInputClass}
                                />
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="assigned-to" className={addLeadLabelClass}>Assign to / Owner</Label>
                                <Popover open={isOwnerComboOpen} onOpenChange={setIsOwnerComboOpen} {...addLeadPopoverProps}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isOwnerComboOpen}
                                            className={addLeadComboClass}
                                        >
                                            <span className="truncate text-left">
                                                {(() => {
                                                    const selected =
                                                        selectedOwnerOption ||
                                                        owners.find((owner) => owner.id === (leadForm.assignedTo ? String(leadForm.assignedTo) : ""));
                                                    return selected?.name || "Select owner...";
                                                })()}
                                            </span>
                                            {isFigmaInlineDealsDesign ? (
                                                <img alt="" src="/figma/deals/leads/chevron-down.svg" className="size-[15px] shrink-0 opacity-70" />
                                            ) : (
                                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className={`w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0${addLeadPopoverContentClass}`}
                                        {...addLeadPopoverContentProps}
                                    >
                                        <Command className={addLeadCommandClass}>
                                            <CommandInput
                                                placeholder="Search owners..."
                                                value={ownerSearchTerm}
                                                onValueChange={(val) => setOwnerSearchTerm(val)}
                                            />
                                            <CommandList
                                                className={addLeadCommandListClass}
                                                onWheel={isFigmaInlineDealsDesign ? handleAddLeadDropdownWheel : undefined}
                                            >
                                                {isOwnersLoading && (
                                                    <CommandEmpty>
                                                        <span className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
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
                                                            const isSelected = String(leadForm.assignedTo || "") === owner.id;
                                                            const chooseOwner = () => {
                                                                setLeadForm((prev) => ({
                                                                    ...prev,
                                                                    assignedTo: owner.id,
                                                                }));
                                                                setSelectedOwnerOption(owner);
                                                                setOwnerSearchTerm("");
                                                                setIsOwnerComboOpen(false);
                                                            };
                                                            return (
                                                                <CommandItem
                                                                    key={owner.id}
                                                                    value={`${owner.name} ${owner.email || ""}`.trim() || owner.id}
                                                                    onSelect={() => chooseOwner()}
                                                                    onMouseDown={(event) => {
                                                                        event.preventDefault();
                                                                        chooseOwner();
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

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="priority" className={addLeadLabelClass}>Priority</Label>
                                <Select
                                    value={leadForm.priority}
                                    onValueChange={(value) => setLeadForm({ ...leadForm, priority: value })}
                                >
                                    <SelectTrigger className={addLeadSelectTriggerClass}>
                                        <SelectValue placeholder="Select priority..." />
                                    </SelectTrigger>
                                    <SelectContent className={addLeadSelectContentClass} {...addLeadSelectContentProps}>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="next-follow-up" className={addLeadLabelClass}>Next Follow Up</Label>
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
                                    className={addLeadInputClass}
                                />
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="estimated-close" className={addLeadLabelClass}>Estimated Close</Label>
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
                                    className={addLeadInputClass}
                                />
                            </div>

                            <div className={addLeadFieldClass}>
                                <Label htmlFor="tags" className={addLeadLabelClass}>Tags</Label>
                                <Input
                                    id="tags"
                                    placeholder="e.g., urgent, follow-up, vip"
                                    value={leadForm.tags}
                                    onChange={(e) => setLeadForm({ ...leadForm, tags: e.target.value })}
                                    className={addLeadInputClass}
                                />
                                {!isFigmaInlineDealsDesign && (
                                <p className="text-xs text-muted-foreground">
                                    Separate multiple tags with commas
                                </p>
                                )}
                            </div>

                            <div className={isFigmaInlineDealsDesign ? addLeadFieldClass : "flex items-center space-x-2 pt-2"}>
                                {isFigmaInlineDealsDesign ? (
                                    <Label htmlFor="auto-follow-up" className={addLeadLabelClass}>Auto Follow-up</Label>
                                ) : null}
                                <div className={isFigmaInlineDealsDesign ? "flex h-9 items-center gap-2.5" : "flex items-center gap-2"}>
                                    <Checkbox
                                        id="auto-follow-up"
                                        checked={leadForm.autoFollowUp}
                                        onCheckedChange={(checked) => handleAutoFollowUpToggle(checked === true)}
                                        className={isFigmaInlineDealsDesign ? "size-4 rounded-[4px] border-[#3a3a3a] bg-[#1e1e1e] data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground" : ""}
                                    />
                                    <Label
                                        htmlFor="auto-follow-up"
                                        className={isFigmaInlineDealsDesign ? "cursor-pointer text-[13px] font-normal text-[#efefef]" : "text-sm font-normal cursor-pointer"}
                                    >
                                        {isFigmaInlineDealsDesign ? "Enable auto follow-up" : "Auto Follow-up"}
                                    </Label>
                                </div>
                            </div>
                            {leadForm.autoFollowUp && !isFigmaInlineDealsDesign && (
                                <p className="text-xs text-muted-foreground">
                                    Auto follow-up configured: every {leadForm.followUpIntervalDays || "2"} day
                                    {(leadForm.followUpIntervalDays || "2") !== "1" ? "s" : ""}
                                    {leadForm.autoFollowUpEndDate ? `, until ${leadForm.autoFollowUpEndDate}` : " (default 3 follow-ups)"}.
                                </p>
                            )}
                        </div>
                    </div>

                    {isFigmaInlineDealsDesign ? (
                        <div className="flex items-center justify-between border-t border-[#1f1f1f] bg-[#141414] px-6 py-[15px]">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddLeadOpen(false);
                                    setEditingLeadId(null);
                                    setLeadForm(buildDefaultLeadForm());
                                    setSelectedContactOption(null);
                                    setSelectedCompanyOption(null);
                                    setSelectedOwnerOption(null);
                                    setContactSearchTerm("");
                                    setCompanySearchTerm("");
                                    setOwnerSearchTerm("");
                                    setIsOwnerComboOpen(false);
                                }}
                                disabled={isSubmittingLead}
                                className="text-[14px] font-semibold text-[#888] hover:text-white disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <Button
                                onClick={handleSaveLead}
                                disabled={isSubmittingLead}
                                className="h-auto rounded-[8px] bg-brand px-5 py-3 text-[14px] font-bold text-brand-foreground shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)]"
                            >
                                {isSubmittingLead
                                    ? editingLeadId
                                        ? "Saving..."
                                        : "Creating..."
                                    : editingLeadId
                                        ? "Save Changes"
                                        : "Create Lead"}
                            </Button>
                        </div>
                    ) : (
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsAddLeadOpen(false);
                                setEditingLeadId(null);
                                setLeadForm(buildDefaultLeadForm());
                                setSelectedContactOption(null);
                                setSelectedCompanyOption(null);
                                setSelectedOwnerOption(null);
                                setContactSearchTerm("");
                                setCompanySearchTerm("");
                                setOwnerSearchTerm("");
                                setIsOwnerComboOpen(false);
                            }}
                            disabled={isSubmittingLead}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveLead}
                            disabled={isSubmittingLead}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                        >
                            {isSubmittingLead
                                ? editingLeadId
                                    ? "Saving..."
                                    : "Adding..."
                                : editingLeadId
                                    ? "Save Changes"
                                    : "Add Lead"}
                        </Button>
                    </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={isAutoFollowUpConfigOpen}
                onOpenChange={(open) => {
                    if (open) {
                        setIsAutoFollowUpConfigOpen(true);
                        return;
                    }
                    handleAutoFollowUpConfigCancel();
                }}
            >
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Configure Auto Follow-up</DialogTitle>
                        <DialogDescription>
                            Set interval and end date for automatic follow-up creation.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="auto-follow-up-interval-days">Every N days</Label>
                                <Input
                                    id="auto-follow-up-interval-days"
                                    type="number"
                                    min={1}
                                    placeholder="Default: 2"
                                    value={leadForm.followUpIntervalDays}
                                    onChange={(e) =>
                                        setLeadForm((prev) => ({
                                            ...prev,
                                            followUpIntervalDays: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="auto-follow-up-end-date">End date</Label>
                                <Input
                                    id="auto-follow-up-end-date"
                                    type="date"
                                    min={leadForm.nextFollowUp || undefined}
                                    value={leadForm.autoFollowUpEndDate}
                                    onChange={(e) =>
                                        setLeadForm((prev) => ({
                                            ...prev,
                                            autoFollowUpEndDate: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Defaults apply when left blank: every 2 days with 3 auto follow-ups.
                        </p>
                        {!leadForm.nextFollowUp ? (
                            <p className="text-xs text-amber-600">
                                Set &quot;Next Follow Up&quot; in the lead form to preview exact auto follow-up dates.
                            </p>
                        ) : autoFollowUpConfigPreview.error ? (
                            <p className="text-xs text-red-500">{autoFollowUpConfigPreview.error}</p>
                        ) : (
                            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                                <p className="font-medium text-foreground">
                                    Preview: {autoFollowUpConfigPreview.dueDates.length} follow-up
                                    {autoFollowUpConfigPreview.dueDates.length > 1 ? "s" : ""} every{" "}
                                    {autoFollowUpConfigPreview.intervalDays} day
                                    {autoFollowUpConfigPreview.intervalDays > 1 ? "s" : ""}.
                                </p>
                                <p className="text-muted-foreground">
                                    Dates:{" "}
                                    {autoFollowUpConfigPreview.dueDates
                                        .map((date) =>
                                            date.toLocaleDateString("en-GB", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })
                                        )
                                        .join(", ")}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleAutoFollowUpConfigCancel}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAutoFollowUpConfigSave}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                        >
                            Save Auto Follow-up
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Company Dialog */}
            <Dialog open={isAddCompanyDialogOpen} onOpenChange={setIsAddCompanyDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Add New Company</DialogTitle>
                        <DialogDescription>Create a company and attach it to this lead.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="company-name">Company Name</Label>
                                <Input
                                    id="company-name"
                                    placeholder="Enter company name"
                                    value={newCompanyForm.companyName}
                                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, companyName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="industry">Industry</Label>
                                <Input
                                    id="industry"
                                    placeholder="e.g. Software, Manufacturing"
                                    value={newCompanyForm.industry}
                                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, industry: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company-revenue">Revenue</Label>
                                <Input
                                    id="company-revenue"
                                    placeholder="Enter revenue"
                                    value={newCompanyForm.revenue}
                                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, revenue: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="website">Website</Label>
                                <Input
                                    id="website"
                                    placeholder="https://example.com"
                                    value={newCompanyForm.website}
                                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, website: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    placeholder="Street, Area"
                                    value={newCompanyForm.address}
                                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, address: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="country">Country</Label>
                                <Input
                                    id="country"
                                    value={newCompanyForm.country}
                                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, country: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="state">State</Label>
                                <Input
                                    id="state"
                                    value={newCompanyForm.state}
                                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, state: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">City</Label>
                                <Input
                                    id="city"
                                    value={newCompanyForm.city}
                                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, city: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pincode">Pin Code</Label>
                                <Input
                                    id="pincode"
                                    value={newCompanyForm.pinCode}
                                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, pinCode: e.target.value })}
                                />
                            </div>
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
                                    pinCode: "",
                                    country: "",
                                    state: "",
                                    city: "",
                                });
                            }}
                            disabled={isCreatingCompany}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateCompanyFromDialog}
                            disabled={isCreatingCompany || !newCompanyForm.companyName.trim()}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                        >
                            {isCreatingCompany ? "Creating..." : "Create Company"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reassign Lead Dialog */}
            <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Reassign Lead</DialogTitle>
                        <DialogDescription>
                            Select an employee from your organization to reassign this lead.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm font-medium text-gray-700">Lead:</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {selectedLeadForReassign ? getLeadName(selectedLeadForReassign) : ""}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reassign-employee">Assign to Employee</Label>
                                <Select
                                    value={selectedEmployeeId}
                                    onValueChange={setSelectedEmployeeId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select employee..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {owners.map((owner) => (
                                            <SelectItem key={owner.id} value={owner.id}>
                                                {owner.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsReassignOpen(false);
                                setSelectedLeadForReassign(null);
                                setSelectedEmployeeId("");
                            }}
                            disabled={isReassigning}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmReassign}
                            disabled={isReassigning || !selectedEmployeeId}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                        >
                            {isReassigning ? "Reassigning..." : "Reassign"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* External Leads Converter Dialog */}
            <Dialog
                open={isConverterOpen}
                onOpenChange={(open) => {
                    setIsConverterOpen(open);
                    if (!open) {
                        resetConverterState();
                    }
                }}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Convert External Leads</DialogTitle>
                        <DialogDescription>
                            Transform the Privyr export or any sheet with similar columns into the Supernova CRM bulk
                            upload template automatically.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                            <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
                            <div>
                                <p className="font-medium text-foreground">Works with Google Sheets or CSV/XLSX files</p>
                                <p>
                                    Paste a public link (e.g.
                                    {" "}
                                    <a
                                        href={""}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary underline"
                                    >
                                        Privyr Client List Export
                                    </a>
                                    ) or upload the downloaded file. We will download a CRM-ready Excel sheet for you.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="converter-link">Google Sheets link</Label>
                            <Input
                                id="converter-link"
                                value={converterLink}
                                onChange={(event) => setConverterLink(event.target.value)}
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                disabled={isConvertingExternal}
                            />
                            <Button
                                onClick={handleConvertExternalLink}
                                disabled={isConvertingExternal || !converterLink.trim()}
                                className="w-full sm:w-auto gap-2"
                            >
                                {isConvertingExternal ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Converting...
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4" />
                                        Fetch & Convert
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="converter-file">Or upload CSV / Excel</Label>
                            <Input
                                id="converter-file"
                                ref={converterFileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleConvertExternalFile}
                                disabled={isConvertingExternal}
                            />
                            <p className="text-xs text-muted-foreground">
                                Supported formats: .xlsx, .xls, .csv | We will download a converted Excel file instantly.
                            </p>
                        </div>

                        {converterError && (
                            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                {converterError}
                            </div>
                        )}

                        {converterStats && (
                            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                                Converted {converterStats.converted} leads
                                {converterStats.skipped
                                    ? ` | Skipped ${converterStats.skipped} rows without valid emails`
                                    : ""}.
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsConverterOpen(false);
                                resetConverterState();
                            }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Upload Dialog */}
            <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
                <DialogContent className="max-w-6xl p-0 overflow-hidden">
                    <BulkUploadLeadsFlow
                        mode="dialog"
                        onClose={() => setIsBulkUploadOpen(false)}
                        onUploadComplete={() => {
                            fetchLeads(currentPage);
                            setIsBulkUploadOpen(false);
                        }}
                    />
                </DialogContent>
            </Dialog>

            {/* Change Stage Dialog */}
            <Dialog open={isChangeStageOpen} onOpenChange={setIsChangeStageOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Change Stage</DialogTitle>
                        <DialogDescription>
                            Select a new stage for this lead.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm font-medium text-gray-700">Lead:</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {selectedLeadForStageChange ? getLeadName(selectedLeadForStageChange) : ""}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                    Current Stage: <span className="font-medium">{selectedLeadForStageChange?.stage || "N/A"}</span>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-stage">New Stage</Label>
                                {isLoadingStagesForChange ? (
                                    <div className="flex items-center justify-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : (
                                    <Select
                                        value={selectedNewStage}
                                        onValueChange={setSelectedNewStage}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select new stage..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableStagesForLead.length > 0 ? (
                                                availableStagesForLead.map((stage, index) => {
                                                    const stageName = String(stage?.name || stage?.value || "");
                                                    const stageValue = String(stage?.name || stage?.value || `stage-${index}`);
                                                    if (!stageName || !stageValue) return null;
                                                    return (
                                                        <SelectItem key={index} value={stageValue}>
                                                            {stageName}
                                                        </SelectItem>
                                                    );
                                                })
                                            ) : (
                                                <SelectItem value="no-stages" disabled>No stages available</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsChangeStageOpen(false);
                                setSelectedLeadForStageChange(null);
                                setSelectedNewStage("");
                                setAvailableStagesForLead([]);
                            }}
                            disabled={isChangingStage}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmChangeStage}
                            disabled={isChangingStage || !selectedNewStage || selectedNewStage === selectedLeadForStageChange?.stage}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                        >
                            {isChangingStage ? "Updating..." : "Update Stage"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Follow-up Dialog */}
            <Dialog open={isAddFollowUpOpen} onOpenChange={setIsAddFollowUpOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Schedule Follow-up</DialogTitle>
                        <DialogDescription>
                            Schedule a follow-up task for this lead.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-700">Lead:</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {selectedLeadForFollowUp ? getLeadName(selectedLeadForFollowUp) : ""}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="follow-up-title">Title</Label>
                            <Input
                                id="follow-up-title"
                                placeholder="Follow-up with Lead"
                                value={followUpForm.title}
                                onChange={(e) =>
                                    setFollowUpForm({ ...followUpForm, title: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="follow-up-description">Description</Label>
                            <Textarea
                                id="follow-up-description"
                                placeholder="Add description..."
                                value={followUpForm.description}
                                onChange={(e) =>
                                    setFollowUpForm({ ...followUpForm, description: e.target.value })
                                }
                                rows={4}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="follow-up-date">Date *</Label>
                            <Input
                                id="follow-up-date"
                                type="date"
                                min={(() => {
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    return tomorrow.toISOString().split('T')[0];
                                })()}
                                value={followUpForm.scheduledDate}
                                onChange={(e) =>
                                    setFollowUpForm({ ...followUpForm, scheduledDate: e.target.value })
                                }
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="follow-up-interval-days">Every N days</Label>
                                <Input
                                    id="follow-up-interval-days"
                                    type="number"
                                    min={1}
                                    placeholder="Default: 2"
                                    value={followUpForm.followUpIntervalDays}
                                    onChange={(e) =>
                                        setFollowUpForm({ ...followUpForm, followUpIntervalDays: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="follow-up-end-date">End date</Label>
                                <Input
                                    id="follow-up-end-date"
                                    type="date"
                                    min={followUpForm.scheduledDate || undefined}
                                    value={followUpForm.autoFollowUpEndDate}
                                    onChange={(e) =>
                                        setFollowUpForm({ ...followUpForm, autoFollowUpEndDate: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            If interval or end date is not provided, follow-ups will be scheduled every 2 days with a default of 3 follow-ups.
                        </p>
                        {followUpForm.scheduledDate && (
                            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                                {followUpSchedulePreview.error ? (
                                    <p className="text-red-500">{followUpSchedulePreview.error}</p>
                                ) : (
                                    <>
                                        <p className="font-medium text-foreground">
                                            Will create {followUpSchedulePreview.dueDates.length} follow-up
                                            {followUpSchedulePreview.dueDates.length > 1 ? "s" : ""}{" "}
                                            every {followUpSchedulePreview.intervalDays} day
                                            {followUpSchedulePreview.intervalDays > 1 ? "s" : ""}.
                                        </p>
                                        <p className="text-muted-foreground">
                                            Dates:{" "}
                                            {followUpSchedulePreview.dueDates
                                                .map((date) =>
                                                    date.toLocaleDateString("en-GB", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                    })
                                                )
                                                .join(", ")}
                                        </p>
                                        {followUpSchedulePreview.usingDefaultPattern && (
                                            <p className="text-muted-foreground">
                                                Using default pattern: 3 follow-ups, every 2 days.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="follow-up-priority">Priority</Label>
                            <Select
                                value={followUpForm.priority}
                                onValueChange={(value) =>
                                    setFollowUpForm({ ...followUpForm, priority: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsAddFollowUpOpen(false);
                                setSelectedLeadForFollowUp(null);
                                setFollowUpForm({
                                    title: "Follow-up with Lead",
                                    description: "",
                                    scheduledDate: "",
                                    followUpIntervalDays: "",
                                    autoFollowUpEndDate: "",
                                    priority: "medium",
                                    assignedTo: "",
                                });
                            }}
                            disabled={isSubmittingFollowUp}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmAddFollowUp}
                            disabled={isSubmittingFollowUp || !followUpForm.scheduledDate}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                        >
                            {isSubmittingFollowUp ? "Scheduling..." : "Schedule Follow-up"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Note Dialog */}
            <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Add Note</DialogTitle>
                        <DialogDescription>
                            Add a note to track important information about this lead.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-700">Lead:</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {selectedLeadForNote ? getLeadName(selectedLeadForNote) : ""}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="note-description">Note *</Label>
                            <Textarea
                                id="note-description"
                                placeholder="Enter your note here..."
                                value={noteForm.description}
                                onChange={(e) =>
                                    setNoteForm({ ...noteForm, description: e.target.value })
                                }
                                rows={4}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsAddNoteOpen(false);
                                setSelectedLeadForNote(null);
                                setNoteForm({
                                    description: "",
                                });
                            }}
                            disabled={isSubmittingNote}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmAddNote}
                            disabled={isSubmittingNote || !noteForm?.description}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                        >
                            {isSubmittingNote ? "Adding..." : "Add Note"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DeleteLeadsDialog
                open={isBulkDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (isBulkDeleting) return;
                    setIsBulkDeleteDialogOpen(open);
                }}
                leads={selectedLeadsPreview.map((lead, index) => ({
                    id: String(lead?._id || lead?.id || index),
                    name: getLeadName(lead),
                }))}
                totalCount={selectedLeadIds.length}
                remainingCount={remainingSelectedLeads}
                onConfirm={handleConfirmBulkDelete}
                isDeleting={isBulkDeleting}
            />

            <DeleteLeadsDialog
                open={isDeleteLeadOpen}
                onOpenChange={(open) => {
                    setIsDeleteLeadOpen(open);
                    if (!open) {
                        setLeadToDelete(null);
                    }
                }}
                leads={
                    leadToDelete
                        ? [
                              {
                                  id: String(leadToDelete._id || leadToDelete.id || "lead"),
                                  name: getLeadName(leadToDelete),
                              },
                          ]
                        : []
                }
                onConfirm={handleConfirmDeleteLead}
                isDeleting={isDeletingLead}
            />

            {/* Add Company Dialog */}
            <Dialog
                open={isAddCompanyDialogOpen}
                onOpenChange={(open) => {
                    if (isCreatingCompany) return;
                    setIsAddCompanyDialogOpen(open);
                }}
            >
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add New Company</DialogTitle>
                        <DialogDescription>
                            Create a new company to associate with this lead.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-company-name">
                                Company Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="new-company-name"
                                placeholder="Enter company name"
                                value={newCompanyForm.companyName}
                                onChange={(e) =>
                                    setNewCompanyForm({ ...newCompanyForm, companyName: e.target.value })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-company-industry">Industry</Label>
                            <Input
                                id="new-company-industry"
                                placeholder="e.g., Technology, Finance, Healthcare"
                                value={newCompanyForm.industry}
                                onChange={(e) =>
                                    setNewCompanyForm({ ...newCompanyForm, industry: e.target.value })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-company-revenue">Revenue</Label>
                            <Input
                                id="new-company-revenue"
                                placeholder="Enter revenue"
                                value={newCompanyForm.revenue}
                                onChange={(e) =>
                                    setNewCompanyForm({ ...newCompanyForm, revenue: e.target.value })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-company-website">Website</Label>
                            <Input
                                id="new-company-website"
                                placeholder="https://example.com"
                                value={newCompanyForm.website}
                                onChange={(e) =>
                                    setNewCompanyForm({ ...newCompanyForm, website: e.target.value })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-company-address">Address</Label>
                            <Input
                                id="new-company-address"
                                placeholder="Street address"
                                value={newCompanyForm.address}
                                onChange={(e) =>
                                    setNewCompanyForm({ ...newCompanyForm, address: e.target.value })
                                }
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-company-country">Country</Label>
                                <Select
                                    value={newCompanyForm.country}
                                    onValueChange={(value) =>
                                        setNewCompanyForm({ ...newCompanyForm, country: value, state: "", city: "" })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select country" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        {Country.getAllCountries().map((country) => (
                                            <SelectItem key={country.isoCode} value={country.isoCode}>
                                                {country.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-company-state">State</Label>
                                <Select
                                    value={newCompanyForm.state}
                                    onValueChange={(value) =>
                                        setNewCompanyForm({ ...newCompanyForm, state: value, city: "" })
                                    }
                                    disabled={!newCompanyForm.country}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select state" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        {State.getStatesOfCountry(newCompanyForm.country).map((state) => (
                                            <SelectItem key={state.isoCode} value={state.isoCode}>
                                                {state.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-company-city">City</Label>
                                <Input
                                    id="new-company-city"
                                    placeholder="City name"
                                    value={newCompanyForm.city}
                                    onChange={(e) =>
                                        setNewCompanyForm({ ...newCompanyForm, city: e.target.value })
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-company-pincode">Pin Code</Label>
                                <Input
                                    id="new-company-pincode"
                                    placeholder="Postal/ZIP code"
                                    value={newCompanyForm.pinCode}
                                    onChange={(e) =>
                                        setNewCompanyForm({ ...newCompanyForm, pinCode: e.target.value })
                                    }
                                />
                            </div>
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
                                    pinCode: "",
                                    country: "",
                                    state: "",
                                    city: "",
                                });
                            }}
                            disabled={isCreatingCompany}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateCompanyFromDialog}
                            disabled={isCreatingCompany || !newCompanyForm.companyName.trim()}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                        >
                            {isCreatingCompany ? "Creating..." : "Create Company"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Filters Dialog */}
            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                <DialogContent
                    showCloseButton={!isFigmaInlineDealsDesign}
                    className={
                        isFigmaInlineDealsDesign
                            ? "!max-w-[min(494px,calc(100vw-2rem))] w-full p-0 rounded-[12px] border border-[#334155] bg-[#2e2e2e] shadow-[0px_24px_48px_0px_rgba(0,0,0,0.5)] gap-0 overflow-hidden"
                            : resolvedTheme === "color"
                                ? "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[rgba(0,255,255,0.2)] bg-[rgba(20,20,40,0.85)] backdrop-blur-md shadow-[0_8px_30px_rgba(0,255,255,0.15)]"
                                : resolvedTheme === "dark"
                                    ? "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[#3a3a3a] bg-[#020617] shadow-[0_8px_30px_rgba(0,0,0,0.5)] dark"
                                    : "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[#e5e7eb] bg-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
                    }
                >
                    {isFigmaInlineDealsDesign ? (
                        <>
                            <div className={`flex w-full min-w-0 overflow-hidden ${activeFilterCategory === "date" ? "h-[500px]" : "h-[325px]"}`}>
                                <div className="flex w-[210px] shrink-0 flex-col border-r border-[#2e2e48]">
                                    <div className="px-4 pb-3 pt-5">
                                        <h3 className="text-[14px] font-bold text-white">Filters</h3>
                                    </div>
                                    <div className="flex flex-col">
                                        {figmaFilterCategories.map((category) => {
                                            const isActive = activeFilterCategory === category.id;
                                            return (
                                                <button
                                                    key={category.id}
                                                    type="button"
                                                    onClick={() => setActiveFilterCategory(category.id)}
                                                    className={`flex h-10 w-full items-center justify-between pl-4 pr-3 text-left ${isActive ? "bg-[#181818]" : "hover:bg-white/5"
                                                        }`}
                                                >
                                                    <span className={`text-[12px] text-white ${isActive ? "font-semibold" : "font-medium"}`}>
                                                        {category.label}
                                                    </span>
                                                    <ChevronRight className={`size-3.5 shrink-0 ${isActive ? "text-white" : "text-[#64748b]"}`} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className={`flex min-w-0 flex-1 flex-col overflow-hidden p-5 ${activeFilterCategory === "date" ? "gap-3" : "gap-4"}`}>
                                    {activeFilterCategory !== "date" ? (
                                        <div className="flex h-[35px] items-center gap-2.5 rounded-[8px] border border-[#334155] bg-white/10 px-3">
                                            <img
                                                alt=""
                                                src="/figma/deals/leads/search.svg"
                                                className="size-4 shrink-0 opacity-70"
                                            />
                                            <Input
                                                type="text"
                                                placeholder="Search..."
                                                value={
                                                    activeFilterCategory === "stage"
                                                        ? filterStageSearchTerm
                                                        : activeFilterCategory === "owner"
                                                            ? filterOwnerSearchTerm
                                                            : activeFilterCategory === "funnel"
                                                                ? filterFunnelSearchTerm
                                                                : filterTagSearchTerm
                                                }
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    if (activeFilterCategory === "stage") setFilterStageSearchTerm(value);
                                                    else if (activeFilterCategory === "owner") setFilterOwnerSearchTerm(value);
                                                    else if (activeFilterCategory === "funnel") setFilterFunnelSearchTerm(value);
                                                    else setFilterTagSearchTerm(value);
                                                }}
                                                className="h-auto border-0 bg-transparent p-0 text-[14px] text-white placeholder:text-[#94a3b8] focus-visible:ring-0 focus-visible:ring-offset-0"
                                            />
                                        </div>
                                    ) : null}

                                    {activeFilterCategory !== "date" ? (
                                        <h4 className="text-[14px] font-bold text-white">
                                            {figmaFilterCategories.find((category) => category.id === activeFilterCategory)?.label}
                                        </h4>
                                    ) : null}

                                    <div className={`flex min-h-0 flex-1 flex-col ${activeFilterCategory === "date" ? "gap-3 overflow-y-auto" : "gap-1 overflow-y-auto"}`}>
                                        {activeFilterCategory === "stage" ? (
                                            <>
                                                {renderFigmaFilterCheckbox(
                                                    "All Stages",
                                                    filterSelectedStages.includes("all"),
                                                    () => handleToggleFilterStage("all")
                                                )}
                                                {filteredAvailableFilterStages.map((stage) =>
                                                    <Fragment key={stage}>
                                                        {renderFigmaFilterCheckbox(
                                                            stage,
                                                            filterSelectedStages.includes(stage),
                                                            () => handleToggleFilterStage(stage),
                                                            stage.toLowerCase() === "closed won" ? (
                                                                <span className="rounded-[4px] border border-[#10b981] bg-[rgba(16,185,129,0.13)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#10b981]">
                                                                    Goal
                                                                </span>
                                                            ) : undefined
                                                        )}
                                                    </Fragment>
                                                )}
                                            </>
                                        ) : null}

                                        {activeFilterCategory === "owner" ? (
                                            <>
                                                {renderFigmaFilterCheckbox(
                                                    "All Owners",
                                                    filterSelectedOwners.includes("all"),
                                                    () => handleToggleFilterOwner("all")
                                                )}
                                                {filteredAvailableFilterOwners.map((owner) =>
                                                    <Fragment key={owner.id}>
                                                        {renderFigmaFilterCheckbox(
                                                            owner.name,
                                                            filterSelectedOwners.includes(owner.id),
                                                            () => handleToggleFilterOwner(owner.id)
                                                        )}
                                                    </Fragment>
                                                )}
                                            </>
                                        ) : null}

                                        {activeFilterCategory === "funnel" ? (
                                            <>
                                                {renderFigmaFilterCheckbox(
                                                    "All Funnels",
                                                    filterSelectedFunnels.includes("all"),
                                                    () => handleToggleFilterFunnel("all")
                                                )}
                                                {filteredAvailableFilterFunnels.map((funnel) =>
                                                    <Fragment key={funnel.id}>
                                                        {renderFigmaFilterCheckbox(
                                                            funnel.name,
                                                            filterSelectedFunnels.includes(funnel.id),
                                                            () => handleToggleFilterFunnel(funnel.id)
                                                        )}
                                                    </Fragment>
                                                )}
                                            </>
                                        ) : null}

                                        {activeFilterCategory === "date" ? renderFigmaFilterDatePanel() : null}

                                        {activeFilterCategory === "tags" ? (
                                            isLoadingFilterTags ? (
                                                <div className="flex items-center gap-2 py-2 text-[#94a3b8]">
                                                    <Loader2 className="size-4 animate-spin" />
                                                    <span className="text-[14px]">Loading tags...</span>
                                                </div>
                                            ) : availableFilterTags.length === 0 ? (
                                                <span className="py-2 text-[14px] text-[#94a3b8]">No tags available</span>
                                            ) : (
                                                filteredAvailableFilterTags.map((tag) =>
                                                    <Fragment key={tag}>
                                                        {renderFigmaFilterCheckbox(
                                                            tag,
                                                            filterSelectedTags.includes(tag),
                                                            () => handleToggleFilterTag(tag)
                                                        )}
                                                    </Fragment>
                                                )
                                            )
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="flex h-16 shrink-0 items-center justify-between border-t border-[#181818] px-4 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => setIsFilterDialogOpen(false)}
                                    className="shrink-0 text-[14px] font-semibold text-[#94a3b8] hover:text-white"
                                >
                                    Cancel
                                </button>
                                <div className="flex min-w-0 items-center justify-end gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleResetFilters}
                                        className="h-[35px] shrink-0 rounded-[6px] border-[#334155] bg-transparent px-3 text-[13px] font-semibold text-white shadow-none hover:bg-white/5"
                                    >
                                        Reset Filter
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleApplyFilters}
                                        className="h-[35px] shrink-0 rounded-[6px] bg-brand px-4 text-[13px] font-bold text-brand-foreground shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)]"
                                    >
                                        Apply Filter
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                    <div className={resolvedTheme === "dark" ? "dark" : ""}>
                        {/* Header */}
                        <div className="border-b-[0.667px] border-[#e5e7eb] dark:border-[#3a3a3a] h-[52.667px] px-4 py-4 flex items-center">
                            <h3 className="font-['Arial',sans-serif] font-bold text-[14px] leading-[20px] text-[#1f1f1f] dark:text-[#e5e7eb]">
                                Filters
                            </h3>
                        </div>

                        {/* Content */}
                        <div className="flex flex-col gap-4 p-4 max-h-[472px] overflow-y-auto text-[#1f1f1f] dark:text-[#e5e7eb]">
                            {/* Stage Section */}
                            <div className="flex flex-col gap-2">
                                <label className="font-['Arial',sans-serif] font-bold text-[12px] leading-[16px] text-[#1f1f1f] dark:text-[#e5e7eb]">
                                    Stage
                                </label>
                                {/* Stage Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                        className="pl-8 h-[28px] text-[12px] bg-white dark:bg-[#020617] text-[#1f1f1f] dark:text-[#e5e7eb] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                        placeholder="Search stages..."
                                        value={filterStageSearchTerm}
                                        onChange={(e) => setFilterStageSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                    {/* All Stages */}
                                    <div
                                        onClick={() => handleToggleFilterStage("all")}
                                        className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${filterSelectedStages.includes("all")
                                            ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                                            : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                                            }`}
                                    >
                                        <div
                                            className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${filterSelectedStages.includes("all")
                                                ? "bg-[#7b68ee] border-[#7b68ee]"
                                                : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                                                }`}
                                        >
                                            {filterSelectedStages.includes("all") && (
                                                <Check className="h-3 w-3 text-white" />
                                            )}
                                        </div>
                                        <span
                                            className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${filterSelectedStages.includes("all")
                                                ? "font-bold text-[#7b68ee]"
                                                : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                                                }`}
                                        >
                                            All Stages
                                        </span>
                                    </div>

                                    {/* Individual Stages */}
                                    {filteredAvailableFilterStages.map((stage) => (
                                        <div
                                            key={stage}
                                            onClick={() => handleToggleFilterStage(stage)}
                                            className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${filterSelectedStages.includes(stage)
                                                ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                                                : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                                                }`}
                                        >
                                            <div
                                                className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${filterSelectedStages.includes(stage)
                                                    ? "bg-[#7b68ee] border-[#7b68ee]"
                                                    : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                                                    }`}
                                            >
                                                {filterSelectedStages.includes(stage) && (
                                                    <Check className="h-3 w-3 text-white" />
                                                )}
                                            </div>
                                            <span
                                                className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${filterSelectedStages.includes(stage)
                                                    ? "font-bold text-[#7b68ee]"
                                                    : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                                                    }`}
                                            >
                                                {stage}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sales Funnel Section */}
                            <div className="flex flex-col gap-2">
                                <label className="font-['Arial',sans-serif] font-bold text-[12px] leading-[16px] text-[#1f1f1f] dark:text-[#e5e7eb]">
                                    Sales Funnel
                                </label>
                                {/* Sales Funnel Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                        className="pl-8 h-[28px] text-[12px] bg-white dark:bg-[#020617] text-[#1f1f1f] dark:text-[#e5e7eb] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                        placeholder="Search funnels..."
                                        value={filterFunnelSearchTerm}
                                        onChange={(e) => setFilterFunnelSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                    {/* All Funnels */}
                                    <div
                                        onClick={() => handleToggleFilterFunnel("all")}
                                        className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${filterSelectedFunnels.includes("all")
                                            ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                                            : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                                            }`}
                                    >
                                        <div
                                            className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${filterSelectedFunnels.includes("all")
                                                ? "bg-[#7b68ee] border-[#7b68ee]"
                                                : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                                                }`}
                                        >
                                            {filterSelectedFunnels.includes("all") && (
                                                <Check className="h-3 w-3 text-white" />
                                            )}
                                        </div>
                                        <span
                                            className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${filterSelectedFunnels.includes("all")
                                                ? "font-bold text-[#7b68ee]"
                                                : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                                                }`}
                                        >
                                            All Funnels
                                        </span>
                                    </div>

                                    {/* Individual Funnels */}
                                    {filteredAvailableFilterFunnels.map((funnel) => (
                                        <div
                                            key={funnel.id}
                                            onClick={() => handleToggleFilterFunnel(funnel.id)}
                                            className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${filterSelectedFunnels.includes(funnel.id)
                                                ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                                                : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                                                }`}
                                        >
                                            <div
                                                className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${filterSelectedFunnels.includes(funnel.id)
                                                    ? "bg-[#7b68ee] border-[#7b68ee]"
                                                    : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                                                    }`}
                                            >
                                                {filterSelectedFunnels.includes(funnel.id) && (
                                                    <Check className="h-3 w-3 text-white" />
                                                )}
                                            </div>
                                            <span
                                                className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${filterSelectedFunnels.includes(funnel.id)
                                                    ? "font-bold text-[#7b68ee]"
                                                    : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                                                    }`}
                                            >
                                                {funnel.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Owner Section */}
                            <div className="flex flex-col gap-2">
                                <label className="font-['Arial',sans-serif] font-bold text-[12px] leading-[16px] text-[#1f1f1f]">
                                    Owner
                                </label>
                                {/* Owner Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                        className="pl-8 h-[28px] text-[12px]"
                                        placeholder="Search owners..."
                                        value={filterOwnerSearchTerm}
                                        onChange={(e) => setFilterOwnerSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
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
                                                <Check className="h-3 w-3 text-white" />
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
                                    {filteredAvailableFilterOwners.map((owner) => (
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
                                                    <Check className="h-3 w-3 text-white" />
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

                            {/* Tags Section */}
                            <div className="flex flex-col gap-2">
                                <label className="font-['Arial',sans-serif] font-bold text-[12px] leading-[16px] text-[#1f1f1f] dark:text-[#e5e7eb]">
                                    Tags
                                </label>
                                {/* Tag Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                        className="pl-8 h-[28px] text-[12px] bg-white dark:bg-[#020617] text-[#1f1f1f] dark:text-[#e5e7eb] border-[#e5e7eb] dark:border-[#3a3a3a]"
                                        placeholder="Search tags..."
                                        value={filterTagSearchTerm}
                                        onChange={(e) => setFilterTagSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                    {isLoadingFilterTags ? (
                                        <div className="flex items-center justify-center h-[28px]">
                                            <Loader2 className="h-4 w-4 animate-spin text-[#7b68ee]" />
                                            <span className="font-['Arial',sans-serif] text-[12px] leading-[16px] text-[#6b7280] dark:text-[#9ca3af] ml-2">
                                                Loading tags...
                                            </span>
                                        </div>
                                    ) : availableFilterTags.length === 0 ? (
                                        <div className="flex items-center h-[28px] pl-2">
                                            <span className="font-['Arial',sans-serif] text-[12px] leading-[16px] text-[#6b7280] dark:text-[#9ca3af]">
                                                No tags available
                                            </span>
                                        </div>
                                    ) : (
                                        filteredAvailableFilterTags.map((tag) => (
                                            <div
                                                key={tag}
                                                onClick={() => handleToggleFilterTag(tag)}
                                                className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${filterSelectedTags.includes(tag)
                                                    ? "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(123,104,238,0.25)]"
                                                    : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                                                    }`}
                                            >
                                                <div
                                                    className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${filterSelectedTags.includes(tag)
                                                        ? "bg-[#7b68ee] border-[#7b68ee]"
                                                        : "border-[#e5e7eb] dark:border-[#3a3a3a]"
                                                        }`}
                                                >
                                                    {filterSelectedTags.includes(tag) && (
                                                        <Check className="h-3 w-3 text-white" />
                                                    )}
                                                </div>
                                                <span
                                                    className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${filterSelectedTags.includes(tag)
                                                        ? "font-bold text-[#7b68ee]"
                                                        : "font-normal text-[#1f1f1f] dark:text-[#e5e7eb]"
                                                        }`}
                                                >
                                                    {tag}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t-[0.667px] border-[#e5e7eb] dark:border-[#3a3a3a] h-[52.667px] px-3 py-3 flex items-center justify-between">
                            <Button
                                variant="outline"
                                onClick={() => setIsFilterDialogOpen(false)}
                                className="h-[28px] px-3 rounded-[6px] text-[12px] font-['Arial',sans-serif] font-bold text-[#1f1f1f] dark:text-[#e5e7eb] border-0 bg-transparent shadow-none cursor-pointer transition-all duration-200 hover:bg-gray-100 hover:scale-[1.05] active:scale-[0.95] dark:hover:bg-[#1f2937]"
                            >
                                Close
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleResetFilters}
                                    className="h-[28px] px-3 rounded-[6px] text-[12px] font-['Arial',sans-serif] font-bold text-[#1f1f1f] border border-[#e5e7eb] bg-transparent shadow-none cursor-pointer transition-all duration-200 hover:bg-gray-100 hover:scale-[1.05] active:scale-[0.95] dark:text-[#e5e5e5] dark:border-[#3a3a3a] dark:hover:bg-[rgba(58,58,58,0.6)] dark:hover:border-[#525252]"
                                >
                                    Reset Filters
                                </Button>
                                <Button
                                    onClick={handleApplyFilters}
                                    className="h-[28px] px-3 rounded-[6px] text-[12px] font-['Arial',sans-serif] font-bold bg-[#7b68ee] text-white cursor-pointer transition-all duration-200 hover:bg-[#6b58dd] hover:shadow-[0_4px_12px_rgba(123,104,238,0.4)] hover:scale-[1.05] active:scale-[0.95]"
                                >
                                    Apply Filters
                                </Button>
                            </div>
                        </div>
                    </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Activity Log Dialog */}
            <Dialog open={isActivityLogOpen} onOpenChange={setIsActivityLogOpen}>
                <DialogContent className={`sm:max-w-[900px] max-h-[80vh] overflow-y-auto ${resolvedTheme === "color"
                    ? "bg-[#0A0E27] border-[rgba(0,255,255,0.2)] text-white"
                    : resolvedTheme === "dark"
                        ? "bg-[#1a1a1a] border-[#3a3a3a] text-[#e5e5e5]"
                        : "bg-white border-[#e5e7eb] text-[#1f1f1f]"
                    }`}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Activity Log (Today)
                        </DialogTitle>
                        <DialogDescription className={resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : "text-[#6b7280]"}>
                            Today&apos;s activity log.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        {/* Date range filter */}
                        <div className={`rounded-md border p-3 ${resolvedTheme === "color"
                            ? "bg-[rgba(0,255,255,0.03)] border-[rgba(0,255,255,0.15)]"
                            : resolvedTheme === "dark"
                                ? "bg-[rgba(58,58,58,0.15)] border-[#3a3a3a]"
                                : "bg-white border-[#e5e7eb]"
                            }`}>
                            <div className="flex flex-col gap-2">
                                <div className={`text-xs font-bold ${resolvedTheme === "color" ? "text-[rgba(0,255,255,0.8)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>
                                    Filter by date range
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                                    <div className="flex-1">
                                        <Label className={`text-xs ${resolvedTheme === "color" ? "text-white" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : "text-[#1f1f1f]"}`}>
                                            Start date
                                        </Label>
                                        <Input
                                            type="date"
                                            value={activityLogStartDate}
                                            onChange={(e) => setActivityLogStartDate(e.target.value)}
                                            className={`h-[32px] mt-1 ${resolvedTheme === "color"
                                                ? "bg-[rgba(0,0,0,0.25)] border-[rgba(0,255,255,0.2)] text-white"
                                                : resolvedTheme === "dark"
                                                    ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                                                    : "bg-white border-[#e5e7eb]"
                                                }`}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Label className={`text-xs ${resolvedTheme === "color" ? "text-white" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : "text-[#1f1f1f]"}`}>
                                            End date
                                        </Label>
                                        <Input
                                            type="date"
                                            value={activityLogEndDate}
                                            onChange={(e) => setActivityLogEndDate(e.target.value)}
                                            className={`h-[32px] mt-1 ${resolvedTheme === "color"
                                                ? "bg-[rgba(0,0,0,0.25)] border-[rgba(0,255,255,0.2)] text-white"
                                                : resolvedTheme === "dark"
                                                    ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                                                    : "bg-white border-[#e5e7eb]"
                                                }`}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleApplyActivityLogFilter}
                                            disabled={isLoadingActivityLog}
                                            className={resolvedTheme === "color"
                                                ? "h-[32px] !bg-[#0ff] !hover:bg-[#0dd] text-[#0a0e27]"
                                                : "h-[32px] !bg-[#7b68ee] dark:!bg-[#8b7aff] text-white"}
                                        >
                                            Apply
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleResetActivityLogFilter}
                                            disabled={isLoadingActivityLog}
                                            className="h-[32px]"
                                        >
                                            Reset
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isLoadingActivityLog ? (
                            <div className="flex items-center gap-2 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading activity log...
                            </div>
                        ) : activityLogError ? (
                            <div className="text-sm text-red-500">{activityLogError}</div>
                        ) : (
                            (() => {
                                const items = Array.isArray(activityLogData?.items) ? activityLogData.items : [];
                                if (items.length === 0) {
                                    return (
                                        <div className={`text-sm ${resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>
                                            No activity found for today.
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-2">
                                        <div className={`text-xs ${resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>
                                            Showing {items.length} event{items.length === 1 ? "" : "s"} for today.
                                        </div>

                                        <div className="space-y-2">
                                            {items.map((it: any) => {
                                                const actorName = it?.actor?.name || it?.actor?.email || "Someone";
                                                const actorEmail = it?.actor?.email || "";
                                                const action = toTitleCase(String(it?.action || "activity"));
                                                const entityType = toTitleCase(String(it?.entityType || "record"));
                                                const message =
                                                    it?.message ||
                                                    `${actorName} ${String(it?.action || "updated")} ${String(it?.entityType || "a record")}`;
                                                const time = formatActivityLogTime(it?.timestamp);
                                                const changes = it?.changes && typeof it?.changes === "object" ? it.changes : null;

                                                return (
                                                    <div
                                                        key={it?.id || `${it?.timestamp}-${it?.entityId || ""}`}
                                                        className={`rounded-md border p-3 ${resolvedTheme === "color"
                                                            ? "bg-[rgba(0,255,255,0.03)] border-[rgba(0,255,255,0.15)]"
                                                            : resolvedTheme === "dark"
                                                                ? "bg-[rgba(58,58,58,0.15)] border-[#3a3a3a]"
                                                                : "bg-white border-[#e5e7eb]"
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`text-sm font-bold ${resolvedTheme === "color" ? "text-white" : resolvedTheme === "dark" ? "text-[#e5e7eb]" : "text-[#111827]"}`}>
                                                                        {actorName}
                                                                    </span>
                                                                    {actorEmail && actorEmail !== actorName && (
                                                                        <span className={`text-xs ${resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>
                                                                            {actorEmail}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className={`text-xs mt-1 ${resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>
                                                                    {action} - {entityType}
                                                                </div>
                                                                <div className={`text-sm mt-2 ${resolvedTheme === "color" ? "text-white" : resolvedTheme === "dark" ? "text-[#e5e5e5]" : "text-[#1f1f1f]"}`}>
                                                                    {message}
                                                                </div>
                                                            </div>
                                                            <div className={`text-xs flex-shrink-0 ${resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>
                                                                {time}
                                                            </div>
                                                        </div>

                                                        {(changes || it?.entityId) && (
                                                            <details className="mt-2">
                                                                <summary className={`cursor-pointer text-xs font-bold ${resolvedTheme === "color" ? "text-[#0ff]" : "text-[#7b68ee] dark:text-[#8b7aff]"}`}>
                                                                    Details
                                                                </summary>
                                                                <div className="mt-2 space-y-2">
                                                                    {it?.entityId && (
                                                                        <div className={`text-xs ${resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : resolvedTheme === "dark" ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>
                                                                            <span className="font-bold">Entity ID:</span> {String(it.entityId)}
                                                                        </div>
                                                                    )}
                                                                    {changes && (
                                                                        <pre className={`text-xs rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words ${resolvedTheme === "color"
                                                                            ? "bg-[rgba(0,255,255,0.05)] border border-[rgba(0,255,255,0.12)]"
                                                                            : resolvedTheme === "dark"
                                                                                ? "bg-[rgba(58,58,58,0.25)] border border-[#3a3a3a]"
                                                                                : "bg-[#f4f5f7] border border-[#e5e7eb]"
                                                                            }`}>
                                                                            {JSON.stringify(changes, null, 2)}
                                                                        </pre>
                                                                    )}
                                                                </div>
                                                            </details>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <details className="mt-3">
                                            <summary className={`cursor-pointer text-xs font-bold ${resolvedTheme === "color" ? "text-[#0ff]" : "text-[#7b68ee] dark:text-[#8b7aff]"}`}>
                                                Raw JSON
                                            </summary>
                                            <pre className={`text-xs rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words mt-2 ${resolvedTheme === "color"
                                                ? "bg-[rgba(0,255,255,0.05)] border border-[rgba(0,255,255,0.12)]"
                                                : resolvedTheme === "dark"
                                                    ? "bg-[rgba(58,58,58,0.25)] border border-[#3a3a3a]"
                                                    : "bg-[#f4f5f7] border border-[#e5e7eb]"
                                                }`}>
                                                {JSON.stringify(activityLogData, null, 2)}
                                            </pre>
                                        </details>
                                    </div>
                                );
                            })()
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsActivityLogOpen(false)}
                            className={resolvedTheme === "dark"
                                ? "border-[#3a3a3a] bg-[#1f1f1f] text-[#e5e5e5] hover:bg-[#2a2a2a]"
                                : resolvedTheme === "color"
                                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(255,255,255,0.03)] text-white hover:bg-[rgba(0,255,255,0.08)]"
                                    : ""}
                        >
                            Close
                        </Button>
                        <Button
                            onClick={() => fetchActivityLogRange(activityLogStartDate, activityLogEndDate)}
                            disabled={isLoadingActivityLog}
                            className={resolvedTheme === "color" ? "!bg-[#0ff] !hover:bg-[#0dd] text-[#0a0e27]" : "!bg-[#7b68ee] dark:!bg-[#8b7aff] text-white"}
                        >
                            {isLoadingActivityLog ? "Refreshing..." : "Refresh"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Contact Dialog */}
            <Dialog
                open={isAddContactDialogOpen}
                onOpenChange={(open) => {
                    if (isCreatingContact) return;
                    setIsAddContactDialogOpen(open);
                }}
            >
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Add New Contact</DialogTitle>
                        <DialogDescription>
                            Create a new contact to associate with this lead.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-contact-firstname">
                                    First Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="new-contact-firstname"
                                    placeholder="First name"
                                    value={newContactForm.firstName}
                                    onChange={(e) =>
                                        setNewContactForm({ ...newContactForm, firstName: e.target.value })
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-contact-lastname">
                                    Last Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="new-contact-lastname"
                                    placeholder="Last name"
                                    value={newContactForm.lastName}
                                    onChange={(e) =>
                                        setNewContactForm({ ...newContactForm, lastName: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-contact-email">Email</Label>
                            <Input
                                id="new-contact-email"
                                type="email"
                                placeholder="email@example.com"
                                value={newContactForm.email}
                                onChange={(e) =>
                                    setNewContactForm({ ...newContactForm, email: e.target.value })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-contact-phone">Phone Number</Label>
                            <Input
                                id="new-contact-phone"
                                placeholder="+1234567890"
                                value={newContactForm.phoneNumber}
                                onChange={(e) =>
                                    setNewContactForm({ ...newContactForm, phoneNumber: e.target.value })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-contact-role">Role</Label>
                            <Select
                                value={newContactForm.role || undefined}
                                onValueChange={(value) =>
                                    setNewContactForm({ ...newContactForm, role: value })
                                }
                            >
                                <SelectTrigger id="new-contact-role">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEFAULT_ROLE_OPTIONS.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {role}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-contact-dob">Date of Birth</Label>
                            <Input
                                id="new-contact-dob"
                                type="date"
                                value={newContactForm.dateOfBirth}
                                onChange={(e) =>
                                    setNewContactForm({ ...newContactForm, dateOfBirth: e.target.value })
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
                                    role: "",
                                    dateOfBirth: "",
                                });
                            }}
                            disabled={isCreatingContact}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateContactFromDialog}
                            disabled={isCreatingContact || !newContactForm.firstName.trim() || !newContactForm.lastName.trim()}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                        >
                            {isCreatingContact ? "Creating..." : "Create Contact"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function LeadsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <LeadsPageContent />
        </Suspense>
    );
}