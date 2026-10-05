"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    ArrowLeft,
    Edit,
    Archive,
    X,
    CheckCircle,
    MoreHorizontal,
    Building,
    Users,
    Mail,
    Phone,
    Calendar,
    MessageSquare,
    Plus,
    Star,
    Clock,
    FileText,
    Paperclip,
    Bell,
    Folder,
    UserPlus,
    User,
    ChevronDown,
    Trash2,
    Trophy,
    Target,
    // For re-activating closed leads
    RefreshCw,
    MapPin,
    DollarSign,
    Globe,
    Loader2,
    ShoppingBag,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { buildExternalUrl } from "@/lib/api-config";
import { DEALS_CRM_STATS_REFRESH_EVENT, useDealsInlineRefresh } from "@/lib/deals-events";
import { createWhatsAppContactTask } from "@/lib/crm/leadContactActions";
import { isFollowUpTask, FOLLOW_UP_TASK_DEFAULTS } from "@/lib/crm/isFollowUpTask";
import {
    buildLeadContactFieldsForApi,
    hasLeadEmailOrPhone,
} from "@/lib/crm/resolveLeadContactInfo";
import { authenticatedFetch } from "@/utils/api";
import { toast } from "sonner";
import CRMSidebar from "@/components/crm/CRMSidebar";
import DealsNavbar from "@/components/crm/DealsNavbar";
import DeleteLeadsDialog from "@/components/crm/leads/DeleteLeadsDialog";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import LeadDetailFigmaView, {
    formatDueLabel,
    type ActivityTab,
    type InlineFollowupForm,
    type TimelineItem,
} from "@/components/deals/LeadDetailFigmaView";
import { EditLeadProfileDialog } from "@/components/deals/EditLeadProfileDialog";
import { AddContactDialog } from "@/components/deals/AddContactDialog";
import { AddCompanyDialog } from "@/components/deals/AddCompanyDialog";
import { AddProductDialog } from "@/components/deals/AddProductDialog";
import type { ProductSelection } from "@/components/deals/AddProductDialog";
import { AddDocumentDialog } from "@/components/deals/AddDocumentDialog";
import { AddTagDialog } from "@/components/deals/AddTagDialog";
import { useTheme } from "next-themes";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSearchParams } from 'next/navigation';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import Cookies from "js-cookie";
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
const COMPANY_SIZE_OPTIONS = ["1-10", "10-50", "50-100", "100-500", "500-1000", "1000+"];

const getDirectoryUserName = (user: any): string => {
    if (!user) return "";
    return (
        (typeof user.name === "string" && user.name.trim()) ||
        [user.firstName, user.lastName].filter((p) => typeof p === "string" && p.trim()).join(" ").trim() ||
        (typeof user.username === "string" && user.username.trim()) ||
        (typeof user.email === "string" && user.email.trim()) ||
        ""
    );
};

const getCurrentActor = (): { userId: string; name: string } => {
    const fromToken = getUserDataFromToken();
    const userId = fromToken.userId || "";
    const name =
        (fromToken.name && fromToken.name.trim()) ||
        (fromToken.email ? fromToken.email.split("@")[0] : "") ||
        "";
    return { userId, name };
};

const isAutoFollowUpEnabled = (value: unknown): boolean =>
    value === true || value === "on" || value === "true";

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

export default function LeadDetailsPage() {
    const DARK = {
        bg: "#0a0a0d",
        card: "#1a1a24",
        cardHover: "#1e1e2a",
        accent: "#f5c518",
        accentHover: "#e6b800",
        textPrimary: "#ffffff",
        textSecondary: "#9ca3af",
        textMuted: "#6b7280",
        border: "#2a2a3a",
        borderLight: "#3a3a4a",
        inputBg: "#2a2a3a",
        green: "#22c55e",
        blue: "#3b82f6",
        purple: "#8b7aff",
        red: "#ef4444",
        yellow: "#f5c518",
    };

    const router = useRouter();
    // const searchParams = useSearchParams();
    // const leadId = searchParams.get('details');
    const params = useParams();
    const routeLeadId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] || "" : "";
    const inlineLeadId =
        typeof window !== "undefined"
            ? sessionStorage.getItem("deals:inline-lead-id")
            : null;
    const leadId = routeLeadId || inlineLeadId || "";
    const isInlineDealsMode =
        typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
    const navigateBackToLeads = () => {
        if (typeof window !== "undefined" && isInlineDealsMode) {
            window.dispatchEvent(new CustomEvent("deals:inline-back-to-leads"));
            return;
        }
        router.back();
    };
    const { theme } = useTheme();
    const resolvedTheme =
        theme === "color" ? "color" : theme === "dark" || isInlineDealsMode ? "dark" : "light";

    const [lead, setLead] = useState<any>(null);
    const [originalLeadData, setOriginalLeadData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activityTab, setActivityTab] = useState<ActivityTab>("followups");
    const [inlineFollowupForm, setInlineFollowupForm] = useState<InlineFollowupForm>({
        title: "",
        description: "",
        enableAutoFollowUp: false,
        startDate: "",
        endDate: "",
        frequency: "2",
    });
    const [selectedStage, setSelectedStage] = useState("");
    const [showActionsSidebar, setShowActionsSidebar] = useState(false);
    const [isUpdatingStage, setIsUpdatingStage] = useState(false);

    // Pipeline funnel state
    const [pipelineFunnels, setPipelineFunnels] = useState<Array<{ _id: string; name: string }>>([]);
    const [isChangingFunnel, setIsChangingFunnel] = useState(false);

    // Log Activity Modal State
    const [isLogActivityOpen, setIsLogActivityOpen] = useState(false);
    const [activityForm, setActivityForm] = useState({
        title: "",
        description: "",
        type: "note",
        stage: "",
    });
    const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);

    // Add Note in Sidebar State
    const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
    const [noteForm, setNoteForm] = useState({
        description: "",
    });
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);

    // Derived: does this lead actually have a linked company in backend?
    const hasCompanyForLead = useMemo(() => {
        if (!originalLeadData) return !!lead?.company;
        const rawCompany = originalLeadData.company || {};
        const companyId =
            originalLeadData.companyId ||
            rawCompany._id ||
            rawCompany.id ||
            rawCompany.companyId ||
            "";
        return !!companyId;
    }, [originalLeadData, lead?.company]);

    const hasFunnelStages = useMemo(
        () => Array.isArray(lead?.funnelStages) && lead.funnelStages.length > 0,
        [lead]
    );

    const hasAssignedFunnel = useMemo(() => {
        console.log("=== hasAssignedFunnel Debug ===");
        console.log("lead:", lead);
        console.log("lead.funnel:", lead?.funnel);
        console.log("lead.salesFunnel:", lead?.salesFunnel);
        console.log("lead.salesFunnelId:", lead?.salesFunnelId);
        console.log("lead.funnelId:", lead?.funnelId);

        if (!lead) {
            console.log("No lead, returning false");
            return false;
        }

        // Check if funnel object exists (this is the most reliable indicator)
        const hasFunnelObject = lead.funnel && typeof lead.funnel === "object" && (lead.funnel.id || lead.funnel._id || lead.funnel.name);
        console.log("hasFunnelObject check:", hasFunnelObject);
        if (hasFunnelObject) {
            console.log("Returning true from funnel object check");
            return true;
        }

        // Check if salesFunnel is a string ID (common case from API)
        const hasSalesFunnelString = typeof lead.salesFunnel === "string" && lead.salesFunnel.trim();
        console.log("hasSalesFunnelString check:", hasSalesFunnelString, "value:", lead.salesFunnel);
        if (hasSalesFunnelString) {
            console.log("Returning true from salesFunnel string check");
            return true;
        }

        // Check for various funnel ID properties
        const funnelIdCandidate =
            lead.salesFunnelId ||
            lead.salesFunnel?._id ||
            lead.salesFunnel?.id ||
            lead.funnelId ||
            lead.salesFunnelID ||
            lead.funnel?.id ||
            lead.funnel?._id;
        console.log("funnelIdCandidate:", funnelIdCandidate);
        if (typeof funnelIdCandidate === "string" && funnelIdCandidate.trim()) {
            console.log("Returning true from funnelIdCandidate string check");
            return true;
        }
        if (typeof funnelIdCandidate === "number" && !Number.isNaN(funnelIdCandidate)) {
            console.log("Returning true from funnelIdCandidate number check");
            return true;
        }

        // Check for funnel name properties
        const funnelNameCandidate =
            lead.salesFunnel?.funnelName ||
            lead.salesFunnel?.name ||
            lead.salesFunnelName ||
            lead.funnelName ||
            lead.funnel?.name;
        console.log("funnelNameCandidate:", funnelNameCandidate);
        const result = typeof funnelNameCandidate === "string" && funnelNameCandidate.trim().length > 0;
        console.log("Final result:", result);
        console.log("=== End Debug ===");
        return result;
    }, [lead]);

    // Prefill Add Note dialog from first note in API response
    useEffect(() => {
        if (!isAddNoteOpen) return;

        try {
            const notesData = originalLeadData?.notes;
            if (!notesData) return;

            // Support both array and single object shapes
            const firstNote = Array.isArray(notesData) ? notesData[0] : notesData;
            if (!firstNote) return;

            let prefill = "";
            if (firstNote.notes !== undefined) {
                prefill = typeof firstNote.notes === "string"
                    ? firstNote.notes
                    : typeof firstNote.notes === "object"
                        ? JSON.stringify(firstNote.notes)
                        : String(firstNote.notes || "");
            } else if (firstNote.description !== undefined) {
                prefill = typeof firstNote.description === "string"
                    ? firstNote.description
                    : typeof firstNote.description === "object"
                        ? JSON.stringify(firstNote.description)
                        : String(firstNote.description || "");
            }

            // Only set if the field is currently empty to avoid overwriting user input
            if (prefill && !noteForm.description) {
                setNoteForm({ description: prefill });
            }
        } catch (e) {
            // Silently ignore any parsing errors; modal will remain empty
            console.error("Error pre-filling note dialog:", e);
        }
    }, [isAddNoteOpen, originalLeadData]);

    // Task Modal State
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isFollowUpDropdownOpen, setIsFollowUpDropdownOpen] = useState(false);
    const [taskForm, setTaskForm] = useState({
        title: "",
        description: "",
        dueDate: "",
        priority: "medium",
        assignedTo: "",
    });
    const [isTaskDateTimeOpen, setIsTaskDateTimeOpen] = useState(false);
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<string | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
    const [isDeletingTask, setIsDeletingTask] = useState(false);

    const buildLeadCabinetUrl = (endpoint: string): string => {
        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "https://uatapi.garage.app").replace(/\/+$/, "");
        const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        return `${baseUrl}${cleanEndpoint}`;
    };

    const authenticatedFetchWithCabinetFallback = async (
        endpoint: string,
        init?: RequestInit
    ): Promise<Response> => {
        // Match the same auth pattern used in Cabinet page:
        // call NEXT_PUBLIC_API_URL directly and attach garage_tok as Bearer.
        const token =
            typeof window !== "undefined"
                ? localStorage.getItem("garage_tok") || localStorage.getItem("auth-token") || ""
                : "";

        const headers = new Headers(init?.headers || {});
        if (!headers.has("Authorization") && token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
        if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        return fetch(buildLeadCabinetUrl(endpoint), {
            ...init,
            headers,
            cache: "no-store",
            mode: "cors",
        });
    };

    // Fetch current-workspace members for Assignee dropdown / actor name resolution
    useEffect(() => {
        if (
            (isTaskModalOpen || activityTab === "tasks" || activityTab === "followups") &&
            editLeadUsers.length === 0
        ) {
            const fetchUsers = async () => {
                try {
                    const orgId = getOrgId() || getUserDataFromToken().orgId || "";
                    if (!orgId) {
                        toast.error("Unable to load assignees. Missing workspace.");
                        return;
                    }

                    // Prefer /team/list (same roster as Community/Feeds members).
                    let usersList: any[] = [];
                    try {
                        usersList = await getTeamMembers(orgId);
                    } catch (teamErr) {
                        console.warn("team/list failed, falling back to CRM organization-users:", teamErr);
                    }

                    if (!Array.isArray(usersList) || usersList.length === 0) {
                        const response = await authenticatedFetch(
                            buildExternalUrl(`/crm/organization-users?organizationId=${orgId}&limit=1000`),
                            { method: "GET" }
                        );
                        const result = await response.json();
                        usersList =
                            result?.users ||
                            result?.members ||
                            result?.data?.users ||
                            result?.data?.members ||
                            result?.data ||
                            result ||
                            [];
                        if (!response.ok || !Array.isArray(usersList)) {
                            toast.error("Unable to load assignees. Please try again.", {
                                description: typeof result?.message === "string" ? result.message : undefined,
                            });
                            return;
                        }
                    }

                    const transformedUsers = usersList.map((user: any) => {
                        const { _id, ...rest } = user;
                        const id = _id || user?.id || user?.userId || "";
                        return {
                            id,
                            ...rest,
                            name: getDirectoryUserName({ ...user, _id: id }),
                        };
                    });

                    setEditLeadUsers(transformedUsers);
                } catch (err) {
                    console.log(err);
                }
            };
            fetchUsers();
        }
    }, [isTaskModalOpen, activityTab]);

    // File Upload State
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const dealsDocumentsCabinetIdRef = useRef<string | null>(null);
    const leadCabinetIdCacheRef = useRef<Record<string, string>>({});
    const backfillSignatureRef = useRef<string | null>(null);
    const backfillRunningRef = useRef(false);

    // Image Preview Dialog State
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string>("");

    // Delete Document State
    const [isDeletingDocument, setIsDeletingDocument] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

    // Edit Lead Name State
    const [isEditingLeadName, setIsEditingLeadName] = useState(false);
    const [editedLeadName, setEditedLeadName] = useState("");
    const [isUpdatingLeadName, setIsUpdatingLeadName] = useState(false);

    // Edit Company State
    const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false);
    const [companyForm, setCompanyForm] = useState({
        name: "",
        industry: "",
        size: "",
        revenue: "",
        city: "",
        state: "",
        country: "",
        website: "",
    });
    const [isUpdatingCompany, setIsUpdatingCompany] = useState(false);

    // Add Company directly to Lead (when no company exists)
    const [isAddCompanyForLeadOpen, setIsAddCompanyForLeadOpen] = useState(false);
    const [isCreatingCompanyForLead, setIsCreatingCompanyForLead] = useState(false);
    const [newCompanyForLeadForm, setNewCompanyForLeadForm] = useState({
        name: "",
        industry: "",
        size: "",
        revenue: "",
        website: "",
    });

    // Add Product State
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [productForm, setProductForm] = useState({
        productId: "",
        quantity: "1",
    });
    const [productSelections, setProductSelections] = useState<ProductSelection[]>([]);
    const [productSearchQuery, setProductSearchQuery] = useState("");
    const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
    const [productToDelete, setProductToDelete] = useState<string | null>(null);
    const [isDeletingProduct, setIsDeletingProduct] = useState(false);
    const [productToEdit, setProductToEdit] = useState<any | null>(null);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editingProductData, setEditingProductData] = useState<{
        quantity: string;
        price: string;
        unit: string;
    } | null>(null);
    const [isSavingProductEdit, setIsSavingProductEdit] = useState(false);

    // Add Contact State
    const [isAddContactOpen, setIsAddContactOpen] = useState(false);
    const [allContacts, setAllContacts] = useState<any[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [isAddingContacts, setIsAddingContacts] = useState(false);
    const [contactSearchQuery, setContactSearchQuery] = useState("");

    // Add New Contact Dialog State
    const [isAddNewContactOpen, setIsAddNewContactOpen] = useState(false);
    const [newContactForm, setNewContactForm] = useState({
        name: "",
        email: "",
        company: "",
        role: "",
        phone: "",
    });
    const [isSubmittingNewContact, setIsSubmittingNewContact] = useState(false);
    const [newContactCompanies, setNewContactCompanies] = useState<Array<{ _id: string; name: string }>>([]);
    const [loadingNewContactCompanies, setLoadingNewContactCompanies] = useState(false);
    const [newContactNameError, setNewContactNameError] = useState("");
    const [newContactEmailError, setNewContactEmailError] = useState("");
    const [isEditContactOpen, setIsEditContactOpen] = useState(false);
    const [editingContactId, setEditingContactId] = useState("");
    const [editContactForm, setEditContactForm] = useState({
        name: "",
        email: "",
        company: "",
        role: "",
        phone: "",
    });
    const [isSubmittingEditContact, setIsSubmittingEditContact] = useState(false);
    const [editContactNameError, setEditContactNameError] = useState("");
    const [editContactEmailError, setEditContactEmailError] = useState("");
    const [isAddCompanyForContactOpen, setIsAddCompanyForContactOpen] = useState(false);
    const [isCreatingCompanyForContact, setIsCreatingCompanyForContact] = useState(false);
    const [newCompanyForContactForm, setNewCompanyForContactForm] = useState({
        name: "",
        industry: "",
        revenue: "",
        website: "",
    });

    const handleCreateCompanyForContact = async () => {
        if (!newCompanyForContactForm.name.trim()) {
            toast.error("Company name is required");
            return;
        }

        setIsCreatingCompanyForContact(true);
        try {
            const response = await authenticatedFetch(
                buildExternalUrl("/crm/companies"),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        companyName: newCompanyForContactForm.name.trim(),
                        industry: newCompanyForContactForm.industry.trim() || undefined,
                        revenue: newCompanyForContactForm.revenue.trim() || undefined,
                        website: newCompanyForContactForm.website.trim() || undefined,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg =
                    errorData.error ||
                    errorData.message ||
                    "Failed to create company. Please try again.";
                toast.error(msg);
                return;
            }

            const saved = await response.json().catch(() => ({}));
            const companyId =
                saved._id ||
                saved.id ||
                saved.companyId ||
                saved.company?._id ||
                "";

            // Update dropdown options
            if (companyId) {
                setNewContactCompanies((prev) => [
                    ...prev,
                    { _id: companyId, name: newCompanyForContactForm.name.trim() },
                ]);
                // Select newly created company in the contact form
                setNewContactForm((prev) => ({ ...prev, company: companyId }));
            }

            // Reset and close dialog
            setNewCompanyForContactForm({
                name: "",
                industry: "",
                revenue: "",
                website: "",
            });
            setIsAddCompanyForContactOpen(false);

            toast.success("Company created successfully");
        } catch (error) {
            console.error("Error creating company for contact:", error);
            toast.error("Failed to create company. Please try again.");
        } finally {
            setIsCreatingCompanyForContact(false);
        }
    };

    const handleCreateCompanyForLead = async () => {
        if (!newCompanyForLeadForm.name.trim()) {
            toast.error("Company name is required");
            return;
        }

        setIsCreatingCompanyForLead(true);
        try {
            // 1) Create the company
            const response = await authenticatedFetch(
                buildExternalUrl("/crm/companies"),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        companyName: newCompanyForLeadForm.name.trim(),
                        industry: newCompanyForLeadForm.industry.trim() || undefined,
                        size: newCompanyForLeadForm.size || undefined,
                        revenue: newCompanyForLeadForm.revenue.trim() || undefined,
                        website: newCompanyForLeadForm.website.trim() || undefined,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg =
                    errorData.error ||
                    errorData.message ||
                    "Failed to create company. Please try again.";
                toast.error(msg);
                return;
            }

            const saved = await response.json().catch(() => ({}));
            const companyId =
                saved._id ||
                saved.id ||
                saved.companyId ||
                saved.company?._id ||
                "";

            if (companyId) {
                // 2) Attach this company to the lead
                const attachResp = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            companyId,
                        }),
                    }
                );

                if (!attachResp.ok) {
                    const attachErr = await attachResp.json().catch(() => ({}));
                    const msg =
                        attachErr.error ||
                        attachErr.message ||
                        "Company created, but failed to link to lead.";
                    toast.error(msg);
                } else {
                    // Refetch lead details so UI has the new company
                    const fetchResponse = await authenticatedFetch(
                        buildExternalUrl(`/crm/leads/${leadId}`),
                        {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );
                    if (fetchResponse.ok) {
                        const data = await fetchResponse.json();
                        const leadData = data.lead || data.data || data;
                        setOriginalLeadData(leadData);
                        const transformedLead = transformLeadData(leadData);
                        setLead(transformedLead);
                    }
                    router.refresh();
                    toast.success("Company added and linked to lead successfully");
                }
            }

            // Reset and close dialog
            setNewCompanyForLeadForm({
                name: "",
                industry: "",
                size: "",
                revenue: "",
                website: "",
            });
            setIsAddCompanyForLeadOpen(false);
        } catch (error) {
            console.error("Error creating company for lead:", error);
            toast.error("Failed to create company. Please try again.");
        } finally {
            setIsCreatingCompanyForLead(false);
        }
    };

    // Attach File Dialog State
    const [isAttachFileOpen, setIsAttachFileOpen] = useState(false);

    // Schedule Follow-up Dialog State
    const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
    const [followUpForm, setFollowUpForm] = useState({
        title: "Follow-up with Lead",
        description: "",
        scheduledDate: "",
        scheduledTime: "",
        priority: "medium",
        assignedTo: "",
    });
    const [isFollowUpDateTimeOpen, setIsFollowUpDateTimeOpen] = useState(false);
    const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

    const [isAutoFollowUpOpen, setIsAutoFollowUpOpen] = useState(false);
    const [isSubmittingAutoFollowUp, setIsSubmittingAutoFollowUp] = useState(false);
    const [autoFollowUpForm, setAutoFollowUpForm] = useState({
        enableAutoFollowUp: false,
        title: "Follow-up with Lead",
        description: "",
        followUpIntervalDays: "2",
        autoFollowUpEndDate: "",
        assignedTo: "",
    });

    // Schedule Meeting Dialog State
    const [isMeetingOpen, setIsMeetingOpen] = useState(false);
    const [meetingForm, setMeetingForm] = useState({
        title: "Meeting with Lead",
        description: "",
        scheduledDate: "",
        scheduledTime: "",
        location: "",
        priority: "medium",
        assignedTo: "",
    });
    const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);

    // Delete Lead Dialog State
    const [isDeleteLeadOpen, setIsDeleteLeadOpen] = useState(false);
    const [isDeletingLead, setIsDeletingLead] = useState(false);

    // Tags State
    const [tags, setTags] = useState<string[]>([]);
    const [isAddTagDialogOpen, setIsAddTagDialogOpen] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [isSavingTags, setIsSavingTags] = useState(false);

    // Handle Add Tags
    const handleAddTags = async () => {
        if (!tagInput.trim()) {
            toast.error("Please enter at least one tag");
            return;
        }

        // Split by comma and trim each tag
        const newTags = tagInput
            .split(",")
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);

        if (newTags.length === 0) {
            toast.error("Please enter valid tag names");
            return;
        }

        const leadSource = originalLeadData ?? lead;
        if (!hasLeadEmailOrPhone(leadSource)) {
            toast.error("Either email or phone number is required on the lead or linked contact");
            return;
        }

        setIsSavingTags(true);
        const loadingToast = toast.loading("Saving tags...");

        try {
            // Use addTags API endpoint - API will handle duplicate prevention
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        addTags: newTags,
                        ...buildLeadContactFieldsForApi(leadSource),
                    }),
                }
            );

            if (response.ok) {
                toast.success("Tags added successfully!", { id: loadingToast });
                setTagInput("");
                setIsAddTagDialogOpen(false);

                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                    // Update tags state from API response
                    setTags((transformedLead as any).tags || []);
                }
                router.refresh();
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(
                    extractErrorMessage(errorData, "Failed to save tags"),
                    { id: loadingToast }
                );
            }
        } catch (error) {
            console.error("Error saving tags:", error);
            toast.error("Failed to save tags. Please try again.", { id: loadingToast });
        } finally {
            setIsSavingTags(false);
        }
    };

    // Handle Add Single Tag
    const handleAddSingleTag = async (tag: string) => {
        if (!tag.trim()) return;
        if (tags.includes(tag.trim())) {
            toast.error("Tag already exists");
            return;
        }

        const leadSource = originalLeadData ?? lead;
        if (!hasLeadEmailOrPhone(leadSource)) {
            toast.error("Either email or phone number is required on the lead or linked contact");
            return;
        }

        const loadingToast = toast.loading("Adding tag...");

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        addTags: [tag.trim()],
                        ...buildLeadContactFieldsForApi(leadSource),
                    }),
                }
            );

            if (response.ok) {
                toast.success("Tag added successfully!", { id: loadingToast });
                setTags((prev) => [...prev, tag.trim()]);
                router.refresh();
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(
                    extractErrorMessage(errorData, "Failed to add tag"),
                    { id: loadingToast }
                );
            }
        } catch (error) {
            console.error("Error adding tag:", error);
            toast.error("Failed to add tag. Please try again.", { id: loadingToast });
        }
    };

    // Handle Remove Tag
    const handleRemoveTag = async (tagToRemove: string) => {
        const leadSource = originalLeadData ?? lead;
        if (!hasLeadEmailOrPhone(leadSource)) {
            toast.error("Either email or phone number is required on the lead or linked contact");
            return;
        }

        setIsSavingTags(true);
        const loadingToast = toast.loading("Removing tag...");

        try {
            // Use removeTags API endpoint - API will handle removal
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        removeTags: [tagToRemove],
                        ...buildLeadContactFieldsForApi(leadSource),
                    }),
                }
            );

            if (response.ok) {
                toast.success("Tag removed successfully!", { id: loadingToast });

                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                    // Update tags state from API response
                    setTags((transformedLead as any).tags || []);
                }
                router.refresh();
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(
                    extractErrorMessage(errorData, "Failed to remove tag"),
                    { id: loadingToast }
                );
            }
        } catch (error) {
            console.error("Error removing tag:", error);
            toast.error("Failed to remove tag. Please try again.", { id: loadingToast });
        } finally {
            setIsSavingTags(false);
        }
    };

    // Tag color generator - different colors for different tags
    const getTagColor = (tag: string, index: number) => {
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

    // Edit Lead Details Dialog State
    const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
    const [editLeadForm, setEditLeadForm] = useState({
        leadName: "",
        email: "",
        phone: "",
        source: "",
        notes: "",
        estimatedValue: "",
        priority: "",
        nextFollowUp: "",
        estimatedClose: "",
        salesFunnelId: "",
        stage: "",
        category: "",
        companyId: "",
        contactId: "",
        productId: "",
        quantity: "",
        pricing: "",
        negotiatedPricing: "",
        maxDiscPrice: "",
        duration: "",
        assignedTo: "",
        tags: "",
        autoFollowUp: false,
        description: "",
    });
    const [isSubmittingEditLead, setIsSubmittingEditLead] = useState(false);
    const [editLeadSources] = useState<string[]>(["Website", "Referral", "Cold Call", "LinkedIn", "Event", "Email Campaign", "Facebook", "Facebook Lead Ads", "Google Ads", "WhatsApp"]);
    const [isCustomSource, setIsCustomSource] = useState(false);
    const [customSourceValue, setCustomSourceValue] = useState("");

    // Dropdown data for Edit Lead Dialog
    const [editLeadFunnels, setEditLeadFunnels] = useState<Array<{ _id: string; name: string; stages?: any[] }>>([]);
    const [editLeadFunnelStages, setEditLeadFunnelStages] = useState<string[]>([]);
    const [editLeadCategories, setEditLeadCategories] = useState<Array<{ _id: string; category: string }>>([]);
    const [editLeadCompanies, setEditLeadCompanies] = useState<Array<{ _id: string; companyName: string }>>([]);
    const [editLeadContacts, setEditLeadContacts] = useState<Array<{ _id: string; firstName: string; lastName: string; email?: string }>>([]);
    const [editLeadProducts, setEditLeadProducts] = useState<Array<{ _id: string; name: string }>>([]);
    const [editLeadUsers, setEditLeadUsers] = useState<Array<{ id: string; name: string; email?: string }>>([]);
    const [isLoadingEditLeadDropdowns, setIsLoadingEditLeadDropdowns] = useState(false);

    // Helper function to get lead name (prioritize leadName field from API)
    const getLeadName = (leadData: any) => {
        // First check for leadName field from API
        if (leadData.leadName) {
            return leadData.leadName;
        }
        // If leadName is not present, return "--"
        return "--";
    };

    // Helper function to get owner name
    // Helper to extract a readable string from API notes (array/object/string)
    const extractFirstNoteText = (notesData: any): string => {
        if (!notesData) return "";
        const firstNote = Array.isArray(notesData) ? notesData[0] : notesData;
        if (!firstNote) return "";
        let value: any;
        if (firstNote.notes !== undefined) {
            value = firstNote.notes;
        } else if (firstNote.description !== undefined) {
            value = firstNote.description;
        } else {
            // If structure is unexpected, stringify whole note object
            value = firstNote;
        }

        if (typeof value === "string") return value;
        if (typeof value === "object") return JSON.stringify(value);
        return String(value ?? "");
    };
    const getOwnerName = (leadData: any) => {
        // Prefer assignedUsers array from API
        if (Array.isArray(leadData.assignedUsers) && leadData.assignedUsers.length > 0) {
            const names = leadData.assignedUsers
                .map((user: any) => user?.name || user?.userName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim())
                .filter((name: string) => name && name.trim() !== "");
            if (names.length > 0) {
                return names.join(", ");
            }
            const emailFallback = leadData.assignedUsers.find((u: any) => u?.email)?.email;
            if (emailFallback) return emailFallback;
        }
        // Check if owner is populated as an object
        if (leadData.owner?.name) {
            return leadData.owner.name;
        }
        if (leadData.owner?.firstName && leadData.owner?.lastName) {
            return `${leadData.owner.firstName} ${leadData.owner.lastName}`;
        }
        // Check if assignedTo is populated as an object
        if (leadData.assignedTo && Array.isArray(leadData.assignedTo) && leadData.assignedTo.length > 0) {
            const firstAssignee = leadData.assignedTo[0];
            if (typeof firstAssignee === 'object') {
                if (firstAssignee.name) {
                    return firstAssignee.name;
                }
                if (firstAssignee.firstName && firstAssignee.lastName) {
                    return `${firstAssignee.firstName} ${firstAssignee.lastName}`;
                }
                if (firstAssignee.email) {
                    return firstAssignee.email;
                }
            }
        }
        // Check if assignedToUser is populated
        if (leadData.assignedToUser?.name) {
            return leadData.assignedToUser.name;
        }
        if (leadData.assignedToUser?.firstName && leadData.assignedToUser?.lastName) {
            return `${leadData.assignedToUser.firstName} ${leadData.assignedToUser.lastName}`;
        }
        return "Unassigned";
    };

    // Helper function to get owner email
    const getOwnerEmail = (leadData: any) => {
        // Prefer assignedUsers array
        if (Array.isArray(leadData.assignedUsers) && leadData.assignedUsers.length > 0) {
            const firstWithEmail = leadData.assignedUsers.find((u: any) => u?.email);
            if (firstWithEmail?.email) return firstWithEmail.email;
        }
        if (leadData.owner?.email) {
            return leadData.owner.email;
        }
        if (leadData.assignedTo && Array.isArray(leadData.assignedTo) && leadData.assignedTo.length > 0) {
            const firstAssignee = leadData.assignedTo[0];
            if (typeof firstAssignee === 'object' && firstAssignee.email) {
                return firstAssignee.email;
            }
        }
        if (leadData.assignedToUser?.email) {
            return leadData.assignedToUser.email;
        }
        return null;
    };

    // Format Facebook lead description into structured bullet points
    const formatFacebookLeadDescription = (description: string): { isFacebookLead: boolean; header: string; items: Array<{ label: string; value: string }> } => {
        if (!description) return { isFacebookLead: false, header: "", items: [] };

        // Detect if this is a Facebook lead by checking for common patterns
        const isFacebookLead =
            description.toLowerCase().includes("imported from facebook") ||
            description.toLowerCase().includes("facebook lead") ||
            description.toLowerCase().includes("additional information:") ||
            (description.includes("_") && description.includes("?:"));

        if (!isFacebookLead) return { isFacebookLead: false, header: "", items: [] };

        // Extract header (form name) - everything before "Additional Information:"
        let header = "";
        let infoText = description;
        const additionalInfoIndex = description.toLowerCase().indexOf("additional information:");
        if (additionalInfoIndex !== -1) {
            header = description.substring(0, additionalInfoIndex).trim();
            infoText = description.substring(additionalInfoIndex + "additional information:".length).trim();
        } else {
            // Try to extract header from "Imported from Facebook Lead Form: ..."
            const formMatch = description.match(/Imported from Facebook Lead Form:\s*(.+?)(?:\s+(?:[a-z_]+\??:))/i);
            if (formMatch) {
                header = `Facebook Lead Form: ${formMatch[1].trim()}`;
            }
        }

        // Helper to convert snake_case keys to Title Case
        const toTitleCase = (str: string): string => {
            return str
                .replace(/_/g, " ")
                .replace(/\?$/, "")
                .split(" ")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(" ")
                .trim();
        };

        // Parse key-value pairs from the text
        // Pattern: key_in_snake_case?: value (or key_in_snake_case:: value)
        const items: Array<{ label: string; value: string }> = [];

        // Split by known key patterns: word characters/underscores followed by ?: or ::
        // Use a regex to find all key:value pairs
        const keyValueRegex = /([a-zA-Z_][a-zA-Z0-9_ ]*\??):+\s*/g;
        const matches: Array<{ key: string; index: number; matchLength: number }> = [];
        let match;

        while ((match = keyValueRegex.exec(infoText)) !== null) {
            matches.push({
                key: match[1],
                index: match.index,
                matchLength: match[0].length,
            });
        }

        if (matches.length > 0) {
            for (let i = 0; i < matches.length; i++) {
                const currentMatch = matches[i];
                const valueStart = currentMatch.index + currentMatch.matchLength;
                const valueEnd = i + 1 < matches.length ? matches[i + 1].index : infoText.length;
                const value = infoText.substring(valueStart, valueEnd).trim();
                const label = toTitleCase(currentMatch.key);

                if (label && value) {
                    items.push({ label, value });
                }
            }
        }

        // If no key-value pairs found, just return the whole text as a single item
        if (items.length === 0 && infoText.trim()) {
            items.push({ label: "Details", value: infoText.trim() });
        }

        return { isFacebookLead: true, header, items };
    };

    // Transform API data to match UI structure
    const transformLeadData = (apiData: any) => {
        const leadName = getLeadName(apiData);
        const ownerName = getOwnerName(apiData);
        const ownerEmail = getOwnerEmail(apiData);
        // Value should come from pricing field in API
        const value = apiData.pricing || 0;
        // Handle stage as both string and object
        // When stage is an empty object {}, we should default to "Lead"
        let stage = "Lead";
        if (apiData.stage) {
            if (typeof apiData.stage === 'string') {
                stage = apiData.stage;
            } else if (typeof apiData.stage === 'object') {
                const stageName = apiData.stage.name || apiData.stage.stage || apiData.stage.stageName;
                if (stageName && typeof stageName === 'string') {
                    stage = stageName;
                }
            }
        }

        // Get company info
        const company = apiData.company ? {
            name: apiData.company.name || apiData.company.companyName || "Unknown Company",
            industry: apiData.company.industry || "N/A",
            size: apiData.company.size || apiData.company.employeeCount || "N/A",
            revenue: apiData.company.revenue || "N/A",
            location: [
                apiData.company.city,
                apiData.company.state,
                apiData.company.country
            ].filter(Boolean).join(", ") || "N/A",
            website: apiData.company.website || apiData.company.url || "N/A"
        } : null;

        // Get contacts - check if contact exists or if there's a contact array
        // Use a Set to track contact IDs to avoid duplicates
        const contactIds = new Set<string>();
        const contacts: Array<{
            id?: string;
            _id?: string;
            contactId?: string;
            name: string;
            title: string;
            email: string;
            phone: string;
            lastContact: string;
            isPrimary: boolean;
        }> = [];

        // Helper function to get contact ID
        const getContactId = (contact: any): string => {
            return contact._id || contact.id || contact.contactId || "";
        };

        // Helper function to add contact if not duplicate
        const addContactIfNotDuplicate = (contact: any, isPrimary: boolean = false) => {
            const contactId = getContactId(contact);
            // If contactId exists and we've already seen it, skip
            if (contactId && contactIds.has(contactId)) {
                return;
            }
            // If no contactId, check by email and phone combination to avoid duplicates
            const email = contact.email || "";
            const phone = contact.phoneNumber || contact.phone || "";
            const key = `${email}-${phone}`;
            if (!contactId && contactIds.has(key)) {
                return;
            }

            // Add to tracking set
            if (contactId) {
                contactIds.add(contactId);
            } else {
                contactIds.add(key);
            }

            // Add contact
            contacts.push({
                id: contact._id || contact.id || contact.contactId || "",
                _id: contact._id || contact.id || contact.contactId || "",
                contactId: contact._id || contact.id || contact.contactId || "",
                name: (() => {
                    const first = (contact.firstName ?? contact.first_name ?? "").toString().trim();
                    const last = (contact.lastName ?? contact.last_name ?? "").toString().trim();
                    const combined = [first, last].filter(Boolean).join(" ").trim();
                    if (combined) return combined;
                    return (contact.name ?? contact.fullName ?? contact.contactName ?? "Unknown Contact").toString().trim() || "Unknown Contact";
                })(),
                title: contact.title || contact.role || "N/A",
                // Keep raw values (empty string if missing) so edit forms don't see "N/A" as a real email/phone
                email: email || "",
                phone: phone || "",
                lastContact: contact.lastActivity || contact.updatedAt || "",
                isPrimary: isPrimary
            });
        };

        // First, process contacts array (prioritize array over singular contact)
        if (apiData.contacts && Array.isArray(apiData.contacts) && apiData.contacts.length > 0) {
            apiData.contacts.forEach((contact: any, index: number) => {
                addContactIfNotDuplicate(contact, index === 0);
            });
        }

        // Then, process singular contact only if it's not already in the array
        if (apiData.contact) {
            addContactIfNotDuplicate(apiData.contact, contacts.length === 0);
        }

        // Get products/services from products array in API response
        // Use pricing and unit from products array, ignore price field
        const products: Array<{
            _id?: string;
            id?: string;
            productId?: string;
            name: string;
            quantity: number;
            price: number;
            total: number;
            unit?: string;
        }> = [];
        let totalValue = 0;

        // Use products array directly from API response
        if (apiData.products && Array.isArray(apiData.products) && apiData.products.length > 0) {
            apiData.products.forEach((product: any) => {
                const quantity = product.quantity || 1;
                // Use pricing from products array, ignore price field
                const pricing = typeof product.pricing === 'number'
                    ? product.pricing
                    : (parseFloat(product.pricing || "0") || 0);
                const total = quantity * pricing;
                totalValue += total;

                products.push({
                    _id: product._id || product.id || product.productId,
                    id: product._id || product.id || product.productId,
                    productId: product._id || product.id || product.productId,
                    name: product.name || product.productName || "Unknown Product",
                    quantity: quantity,
                    price: pricing, // Store pricing as price for display
                    total: total,
                    unit: product.unit || "" // Store unit from API
                });
            });
        }

        // Get funnel stages and calculate probabilities
        let funnelStages: Array<{
            name: string;
            probability: number;
        }> = [];
        let currentStageProbability = 50;
        let stageCompletionPercent = 0;

        if (apiData.funnel && apiData.funnel.stages && Array.isArray(apiData.funnel.stages)) {
            // Handle both string array and object array formats
            funnelStages = apiData.funnel.stages.map((stageItem: any, index: number) => {
                // If stageItem is a string, use it as the name
                if (typeof stageItem === 'string') {
                    return {
                        name: stageItem,
                        probability: 0 // Default probability if not provided
                    };
                }
                // If stageItem is an object, extract name and probability
                return {
                    name: stageItem.name || stageItem.stage || "",
                    probability: typeof stageItem.probability === 'string'
                        ? parseFloat(stageItem.probability) || 0
                        : (stageItem.probability || 0)
                };
            }).filter((stage: any) => stage.name && stage.name !== ""); // Filter out empty names

            // Find current stage's probability
            const currentStageData = funnelStages.find((s: any) =>
                s.name.toLowerCase() === stage.toLowerCase()
            );
            if (currentStageData && currentStageData.probability > 0) {
                currentStageProbability = currentStageData.probability;
            } else if (funnelStages.length > 0) {
                // Calculate probability based on position if not provided
                const currentIndex = funnelStages.findIndex((s: any) =>
                    s.name.toLowerCase() === stage.toLowerCase()
                );
                if (currentIndex >= 0) {
                    currentStageProbability = Math.round(((currentIndex + 1) / funnelStages.length) * 100);
                }
            }

            // Always calculate stage completion percent based on position in the funnel
            if (funnelStages.length > 0) {
                const positionIndex = funnelStages.findIndex((s: any) =>
                    s.name.toLowerCase() === stage.toLowerCase()
                );
                if (positionIndex >= 0) {
                    stageCompletionPercent = Math.round(((positionIndex + 1) / funnelStages.length) * 100);
                } else {
                    stageCompletionPercent = 0;
                }
            }
        }

        // Fallback to default stages if no funnel data
        if (funnelStages.length === 0) {
            funnelStages = [
                { name: "Prospects", probability: 10 },
                { name: "Qualified", probability: 25 },
                { name: "Proposal", probability: 50 },
                { name: "Negotiation", probability: 75 },
                { name: "Closed Won", probability: 100 }
            ];

            // Calculate stage completion percent based on default funnel
            const defaultIndex = funnelStages.findIndex((s: any) =>
                s.name.toLowerCase() === stage.toLowerCase()
            );
            if (defaultIndex >= 0) {
                stageCompletionPercent = Math.round(((defaultIndex + 1) / funnelStages.length) * 100);
            } else {
                stageCompletionPercent = 0;
            }
        }

        // Get activities from API response
        const activities: Array<{
            _id: string;
            title: string;
            description: string;
            type: string;
            timestamp: string;
            createdBy: string;
            createdAt: string;
        }> = [];

        // Process activities
        if (apiData.activities && Array.isArray(apiData.activities)) {
            activities.push(...apiData.activities.map((activity: any) => ({
                _id: activity._id || activity.id || "",
                title: activity.title || "",
                description: activity.description || "",
                type: activity.type || "note",
                timestamp: activity.timestamp || activity.createdAt || "",
                createdBy: activity.createdBy || "",
                createdAt: activity.createdAt || "",
            })));
        }

        // Process notes and convert them to activities format
        // Handle both array and single object cases
        if (apiData.notes) {
            let notesArray: any[] = [];
            if (Array.isArray(apiData.notes)) {
                notesArray = apiData.notes;
            } else if (typeof apiData.notes === 'object') {
                // If notes is a single object, convert to array
                notesArray = [apiData.notes];
            }

            notesArray.forEach((note: any) => {
                // Ensure we extract string values, not objects
                // Handle both 'notes' and 'description' fields, and ensure they're strings
                let noteDescription = "";
                if (note.notes) {
                    noteDescription = typeof note.notes === 'string' ? note.notes : (typeof note.notes === 'object' ? JSON.stringify(note.notes) : String(note.notes || ""));
                } else if (note.description) {
                    noteDescription = typeof note.description === 'string' ? note.description : (typeof note.description === 'object' ? JSON.stringify(note.description) : String(note.description || ""));
                }

                // Ensure createdBy is a string
                let createdByStr = "";
                if (note.createdBy) {
                    if (typeof note.createdBy === 'string') {
                        createdByStr = note.createdBy;
                    } else if (typeof note.createdBy === 'object') {
                        createdByStr = note.createdBy.name || note.createdBy.id || note.createdBy._id || "";
                    } else {
                        createdByStr = String(note.createdBy);
                    }
                }

                activities.push({
                    _id: note._id || note.id || "",
                    title: "Note",
                    description: noteDescription,
                    type: "note",
                    timestamp: note.createdAt || note.timestamp || "",
                    createdBy: createdByStr,
                    createdAt: note.createdAt || "",
                });
            });
        }

        // Derive a human-readable description for the lead:
        // - Prefer explicit description from API
        // - Fallback to the first note's text if available (from raw notes or note-type activities)
        const descriptionFromNotes =
            extractFirstNoteText(apiData.notes) ||
            (activities.find((a) => a.type === "note" && a.description)?.description ?? "");

        // Derive last activity timestamp:
        // - Prefer max timestamp from activities array
        // - Fallback to explicit lastActivity/updatedAt fields from API
        let lastActivity = "";
        const activityTimestamps: string[] = [];

        activities.forEach((act) => {
            const ts = act.timestamp || act.createdAt;
            if (ts) activityTimestamps.push(ts);
        });

        if (apiData.lastActivity || apiData.last_activity) {
            activityTimestamps.push(apiData.lastActivity || apiData.last_activity);
        }
        if (apiData.updatedAt || apiData.updated_at) {
            activityTimestamps.push(apiData.updatedAt || apiData.updated_at);
        }

        if (activityTimestamps.length > 0) {
            const validDates = activityTimestamps
                .map((s) => new Date(s))
                .filter((d) => !Number.isNaN(d.getTime()));
            if (validDates.length > 0) {
                const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));
                lastActivity = maxDate.toISOString();
            }
        }

        // Get tasks from API response
        const tasks: Array<{
            _id: string;
            title: string;
            description: string;
            dueDate: string;
            priority: string;
            status: string;
            assignedTo: any; // Can be string, object, or array
            assignedToName?: string;
            createdAt: string;
            createdBy?: any;
            createdByName?: string;
            completedBy?: any;
            completedByName?: string;
            updatedBy?: any;
            updatedByName?: string;
            isCompleted: boolean;
            type?: string;
            isFollowUp?: boolean;
            assignedToDetails?: any[];
        }> = [];
        if (apiData.tasks && Array.isArray(apiData.tasks)) {
            tasks.push(...apiData.tasks.map((task: any) => ({
                _id: task._id || task.id || "",
                title: task.title || "",
                description: task.description || "",
                dueDate: task.dueDate || task.due || "",
                priority: task.priority || "medium",
                status: task.status || "open",
                type: task.type || task.taskType || "",
                isFollowUp: task.isFollowUp,
                // Preserve assignedTo as ID/array/object for form; do not use display name (assignedToName)
                assignedTo: task.assignedTo ?? "",
                assignedToName: task.assignedToName || "",
                createdAt: task.createdAt || "",
                createdBy: task.createdBy ?? "",
                createdByName: task.createdByName || "",
                completedBy: task.completedBy ?? "",
                completedByName: task.completedByName || "",
                updatedBy: task.updatedBy ?? "",
                updatedByName: task.updatedByName || "",
                isCompleted:
                    task.isCompleted === true ||
                    task.isCompleted === "true" ||
                    ["completed", "done"].includes(String(task.status || "").toLowerCase()),
                assignedToDetails: task.assignedToDetails || [],
            })));
            tasks.sort((a, b) => {
                const dueA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                const dueB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                if (dueB !== dueA) return dueB - dueA;
                const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return createdB - createdA;
            });
        }

        // Get documents/files from API response
        const documents: Array<{
            _id: string;
            docName: string;
            docLink: string;
            notes?: string;
            uploadedBy: string;
            uploadedAt: string;
        }> = [];
        if (apiData.documents && Array.isArray(apiData.documents)) {
            documents.push(...apiData.documents.map((doc: any) => ({
                _id: doc._id || doc.id || "",
                docName: doc.docName || doc.fileName || "Unknown File",
                docLink: doc.docLink || doc.url || doc.location || "",
                notes: doc.notes || "",
                uploadedBy: doc.uploadedBy || "",
                uploadedAt: doc.uploadedAt || doc.createdAt || "",
            })));
        }

        // Normalise API description: treat backend placeholder like "No description available." as empty
        const rawDescription = typeof apiData.description === "string" ? apiData.description.trim() : "";
        const isPlaceholderDescription =
            rawDescription !== "" &&
            rawDescription.toLowerCase().replace(/\.$/, "") === "no description available";
        const normalizedDescription = isPlaceholderDescription ? "" : rawDescription;

        return {
            _id: (apiData as any)._id || (apiData as any).id || leadId,
            name: leadName,
            // Display value directly from pricing (do not override with product totals)
            value: (typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0 : value),
            probability: currentStageProbability,
            currentStageProbability: currentStageProbability,
            stageCompletionPercent: stageCompletionPercent,
            owner: ownerName,
            ownerEmail: ownerEmail,
            expectedClose: apiData.estimatedClose || apiData.expectedClose || apiData.expectedCloseDate || apiData.closeDate || "N/A",
            nextFollowUp: apiData.nextFollowUp || apiData.nextFollowup || "N/A",
            stage: stage,
            priority: apiData.priority || "Medium Priority",
            // Prefer explicit non-placeholder description; otherwise use first note text (from notes or note-type activities)
            description: normalizedDescription || descriptionFromNotes || "No description available.",
            source: apiData.source || "Unknown",
            createdDate: apiData.createdAt ? new Date(apiData.createdAt).toISOString().split('T')[0] : apiData.createdDate || "N/A",
            lastActivity,
            updatedAt: apiData.updatedAt || apiData.updated_at || lastActivity || "",
            leadStatus: apiData.leadStatus || "",
            funnelStages: funnelStages,
            // Preserve funnel and salesFunnel properties for hasAssignedFunnel check
            funnel: apiData.funnel || null,
            salesFunnel: apiData.salesFunnel || null,
            salesFunnelId: apiData.salesFunnelId || apiData.salesFunnelID || null,
            funnelId: apiData.funnelId || null,
            activities: activities,
            tasks: tasks,
            documents: documents,
            company: company || {
                name: "No Company",
                industry: "N/A",
                size: "N/A",
                revenue: "N/A",
                location: "N/A",
                website: "N/A"
            },
            // If there are no contacts, provide a placeholder contact for display only,
            // but do NOT populate email/phone with "N/A" so they don't get treated as real values.
            contacts: contacts.length > 0 ? contacts : [{
                name: "No Contact",
                title: "N/A",
                email: "",
                phone: "",
                lastContact: "",
                isPrimary: true
            }],
            products: products.length > 0 ? products : [],
            tags: apiData.tags || (Array.isArray(apiData.tag) ? apiData.tag : []) || [],
            autoFollowUp: isAutoFollowUpEnabled(apiData.autoFollowUp),
        };
    };

    const fetchLeadDetails = useCallback(async () => {
        if (!leadId) return;
        setIsLoading(true);
        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                console.log("API Response data:", data);
                const leadData = data.lead || data.data || data;
                console.log("Extracted leadData:", leadData);

                const leadDataId = (leadData as any)?._id || (leadData as any)?.id;
                if (!leadData || !leadDataId) {
                    console.error("Invalid lead data received - no _id or id:", leadData);
                    setIsLoading(false);
                    return;
                }

                setOriginalLeadData(leadData);
                const transformedLead = transformLeadData(leadData);
                console.log("Transformed lead:", transformedLead);

                if (!transformedLead || !(transformedLead as any)._id) {
                    console.error("Failed to transform lead data - no _id:", transformedLead);
                    setIsLoading(false);
                    return;
                }

                setLead(transformedLead);
                setSelectedStage(
                    transformedLead.stage && transformedLead.stage !== "" ? transformedLead.stage : ""
                );
                setTags((transformedLead as any).tags || []);
            } else {
                console.error("Failed to fetch lead details. Status:", response.status, response.statusText);
                try {
                    const errorData = await response.json();
                    console.error("Error response:", errorData);
                } catch (e) {
                    console.error("Could not parse error response");
                }
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Error fetching lead details:", error);
            setIsLoading(false);
        } finally {
            setIsLoading(false);
        }
    }, [leadId]);

    useEffect(() => {
        if (leadId) {
            void fetchLeadDetails();
            fetchProducts();
        }
    }, [leadId, fetchLeadDetails]);

    useDealsInlineRefresh("leads-detail", fetchLeadDetails);

    useEffect(() => {
        if (!lead) return;
        const enabled = isAutoFollowUpEnabled(lead.autoFollowUp);
        setInlineFollowupForm((prev) => ({
            ...prev,
            enableAutoFollowUp: enabled,
        }));
        setAutoFollowUpForm((prev) => ({
            ...prev,
            enableAutoFollowUp: enabled,
        }));
    }, [lead?._id, lead?.autoFollowUp]);

    // Update product names when products list is loaded
    useEffect(() => {
        if (lead && products.length > 0 && lead.products && lead.products.length > 0) {
            const needsUpdate = lead.products.some((product: any) =>
                product.name === "Loading..." && product.productId
            );

            if (needsUpdate) {
                const updatedProducts = lead.products.map((product: any) => {
                    if (product.name === "Loading..." && product.productId) {
                        const matchedProduct = products.find(
                            (p: any) => (p._id || p.id) === product.productId
                        );
                        if (matchedProduct) {
                            return {
                                ...product,
                                name: matchedProduct.name || matchedProduct.productName || "Unknown Product"
                            };
                        }
                        return {
                            ...product,
                            name: "Unknown Product"
                        };
                    }
                    return product;
                });

                setLead((prev: any) => ({
                    ...prev,
                    products: updatedProducts
                }));
            }
        }
    }, [products]);

    // Fetch funnels for pipeline dropdown on mount
    useEffect(() => {
        const fetchPipelineFunnels = async () => {
            try {
                const res = await authenticatedFetch(
                    buildExternalUrl("/crm/funnels?skip=0&limit=100"),
                    { method: "GET" }
                );
                if (res.ok) {
                    const data = await res.json();
                    const funnelsList = data.funnels || data.data || data || [];
                    setPipelineFunnels(funnelsList);
                }
            } catch (e) {
                console.error("Error fetching funnels for pipeline:", e);
            }
        };
        fetchPipelineFunnels();
    }, []);

    // Handle funnel change from pipeline card
    const handlePipelineFunnelChange = async (funnelId: string) => {
        if (!lead || isChangingFunnel) return;
        const currentFunnelId = lead.salesFunnelId || lead.funnelId || lead.funnel?._id || lead.funnel?.id || "";
        if (funnelId === currentFunnelId) return;

        setIsChangingFunnel(true);
        const loadingToast = toast.loading("Changing sales funnel...");

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ salesFunnel: funnelId }),
                }
            );

            if (response.ok) {
                toast.success("Sales funnel updated! Reloading stages...", { id: loadingToast });
                // Refetch lead details to get updated funnel stages
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    { method: "GET", headers: { "Content-Type": "application/json" } }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                    setSelectedStage(transformedLead.stage || "");
                }
                router.refresh();
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to update sales funnel", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error changing funnel:", error);
            toast.error("Failed to change sales funnel.", { id: loadingToast });
        } finally {
            setIsChangingFunnel(false);
        }
    };

    // Handle stage change
    const handleStageChange = async (newStage: string) => {
        const prevStageStr =
            typeof lead?.stage === "string"
                ? lead.stage.trim()
                : String(lead?.stage?.name ?? lead?.stage?.value ?? "").trim();
        const nextStageStr = newStage.trim();
        if (!lead || !nextStageStr || prevStageStr.toLowerCase() === nextStageStr.toLowerCase() || isUpdatingStage) {
            return;
        }

        setIsUpdatingStage(true);
        const loadingToast = toast.loading("Updating lead stage...");

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        stage: newStage,
                    }),
                }
            );

            if (response.ok) {
                toast.success("Stage updated successfully!", { id: loadingToast });
                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                    setSelectedStage(newStage);

                    // Final stage → won; moving off final stage while won → active
                    const stages = transformedLead.funnelStages || [];
                    const lastStageObj = stages.length > 0 ? stages[stages.length - 1] : null;
                    const lastMeta = lastStageObj as { name?: string; value?: string } | null;
                    const lastStageName = lastMeta
                        ? String(lastMeta.name || lastMeta.value || "").trim()
                        : "";
                    const isAtLastStage =
                        !!lastStageName && nextStageStr.toLowerCase() === lastStageName.toLowerCase();
                    const currentStatus = (transformedLead.leadStatus || "").toLowerCase();

                    if (isAtLastStage) {
                        setLead((prev: any) => ({
                            ...prev,
                            stage: newStage,
                            leadStatus: "won",
                        }));
                        try {
                            const wonResponse = await authenticatedFetch(
                                buildExternalUrl(`/crm/leads/${leadId}`),
                                {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ leadStatus: "won" }),
                                }
                            );
                            if (!wonResponse.ok) {
                                console.warn("Auto-mark as won API returned non-OK response");
                            }
                        } catch (e) {
                            console.warn("Failed to auto-mark as won after reaching final stage", e);
                        }
                    } else if (currentStatus === "won") {
                        try {
                            const activeRes = await authenticatedFetch(
                                buildExternalUrl(`/crm/leads/${leadId}`),
                                {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ leadStatus: "active" }),
                                }
                            );
                            if (activeRes.ok) {
                                setLead((prev: any) => (prev ? { ...prev, leadStatus: "active" } : prev));
                            }
                            const refreshResponse = await authenticatedFetch(
                                buildExternalUrl(`/crm/leads/${leadId}`),
                                { method: "GET", headers: { "Content-Type": "application/json" } }
                            );
                            if (refreshResponse.ok) {
                                const refreshData = await refreshResponse.json();
                                const refreshedLead = transformLeadData(
                                    refreshData.lead || refreshData.data || refreshData
                                );
                                setLead(refreshedLead);
                            }
                        } catch (e) {
                            console.warn("Failed to reset status to active after leaving final stage", e);
                        }
                    }
                }
                // Refresh the page
                router.refresh();
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to update stage", { id: loadingToast });
                // Revert the selection
                setSelectedStage(lead.stage && lead.stage !== "" ? lead.stage : "");
            }
        } catch (error) {
            console.error("Error updating stage:", error);
            toast.error("Failed to update stage. Please try again.", { id: loadingToast });
            // Revert the selection
            setSelectedStage(lead.stage);
        } finally {
            setIsUpdatingStage(false);
        }
    };

    // Handle Add Note
    const handleAddNote = async () => {
        if (!noteForm.description.trim()) {
            toast.error("Please enter a note");
            return;
        }

        setIsSubmittingNote(true);
        const loadingToast = toast.loading("Adding note...");

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

            // Decide whether to create or update based on existing first note
            const existingNotes = originalLeadData?.notes;
            const firstNote = Array.isArray(existingNotes)
                ? existingNotes[0]
                : (typeof existingNotes === "object" ? existingNotes : null);
            const existingNoteId = firstNote && (firstNote._id || firstNote.id);

            const notePayload = existingNoteId
                ? {
                    notes: noteForm.description,
                    organizationId,
                    updatedBy: userId,
                }
                : {
                    leadId: leadId,
                    notes: noteForm.description,
                    organizationId,
                    createdBy: userId,
                };

            const endpoint = existingNoteId
                ? `/crm/notes/${existingNoteId}`
                : "/crm/notes";
            const method = existingNoteId ? "PUT" : "POST";

            const response = await authenticatedFetch(
                buildExternalUrl(endpoint),
                {
                    method,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(notePayload),
                }
            );

            if (response.ok) {
                toast.success(existingNoteId ? "Note updated successfully!" : "Note added successfully!", { id: loadingToast });
                // Reset form
                setNoteForm({
                    description: "",
                });
                setIsAddNoteOpen(false);
                // Refresh the page to show updated activities
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
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

    // Handle Log Activity
    const handleLogActivity = async () => {
        if (!activityForm.title.trim() || !activityForm.description.trim()) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsSubmittingActivity(true);
        const loadingToast = toast.loading("Creating activity...");

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

            const activityData = {
                leadId: leadId,
                title: activityForm.title,
                description: activityForm.description,
                type: activityForm.type,
                timestamp: new Date().toISOString(), // Use current timestamp
                organizationId: organizationId,
                createdBy: userId,
            };

            const response = await authenticatedFetch(
                buildExternalUrl("/crm/activities"),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(activityData),
                }
            );

            if (response.ok) {
                toast.success("Activity logged successfully!", { id: loadingToast });
                // Reset form
                setActivityForm({
                    title: "",
                    description: "",
                    type: "note",
                    stage: "",
                });
                setIsLogActivityOpen(false);
                // Refresh the page to show updated activities
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to log activity", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error logging activity:", error);
            toast.error("Failed to log activity. Please try again.", { id: loadingToast });
        } finally {
            setIsSubmittingActivity(false);
        }
    };

    // Calculate follow-up date based on selection
    const getFollowUpDate = (option: string): string => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (option) {
            case "today":
                return today.toISOString().slice(0, 10);
            case "tomorrow":
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return tomorrow.toISOString().slice(0, 10);
            case "next-monday": {
                const nextMonday = new Date(today);
                const daysUntilMonday = (1 + 7 - nextMonday.getDay()) % 7;
                nextMonday.setDate(nextMonday.getDate() + (daysUntilMonday || 7));
                return nextMonday.toISOString().slice(0, 10);
            }
            case "next-tuesday": {
                const nextTuesday = new Date(today);
                const daysUntilTuesday = (2 + 7 - nextTuesday.getDay()) % 7;
                nextTuesday.setDate(nextTuesday.getDate() + (daysUntilTuesday || 7));
                return nextTuesday.toISOString().slice(0, 10);
            }
            case "next-wednesday": {
                const nextWednesday = new Date(today);
                const daysUntilWednesday = (3 + 7 - nextWednesday.getDay()) % 7;
                nextWednesday.setDate(nextWednesday.getDate() + (daysUntilWednesday || 7));
                return nextWednesday.toISOString().slice(0, 10);
            }
            case "next-thursday": {
                const nextThursday = new Date(today);
                const daysUntilThursday = (4 + 7 - nextThursday.getDay()) % 7;
                nextThursday.setDate(nextThursday.getDate() + (daysUntilThursday || 7));
                return nextThursday.toISOString().slice(0, 10);
            }
            case "next-friday": {
                const nextFriday = new Date(today);
                const daysUntilFriday = (5 + 7 - nextFriday.getDay()) % 7;
                nextFriday.setDate(nextFriday.getDate() + (daysUntilFriday || 7));
                return nextFriday.toISOString().slice(0, 10);
            }
            default:
                return today.toISOString().slice(0, 10);
        }
    };

    // Handle Follow Up selection
    const handleFollowUpSelect = (option: string) => {
        if (option === "custom") {
            // Open modal without pre-filling date
            setTaskForm({
                title: "Follow-up with Lead",
                description: "Follow-up scheduled",
                dueDate: "",
                priority: "medium",
                assignedTo: "",
            });
            setIsTaskModalOpen(true);
        } else {
            // Pre-fill form with selected date
            const dueDate = getFollowUpDate(option);
            setTaskForm({
                title: "Follow-up with Lead",
                description: "Follow-up scheduled",
                dueDate: dueDate,
                priority: "medium",
                assignedTo: "",
            });
            setIsTaskModalOpen(true);
        }
        setIsFollowUpDropdownOpen(false);
    };

    // Handle Edit Task - Opens modal with pre-filled data
    const handleEditTask = (task: any) => {
        // Format due date for local date-time picker
        let formattedDueDate = "";
        if (task.dueDate) {
            const date = new Date(task.dueDate);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const d = String(date.getDate()).padStart(2, "0");
            const hh = String(date.getHours()).padStart(2, "0");
            const mm = String(date.getMinutes()).padStart(2, "0");
            formattedDueDate = `${y}-${m}-${d}T${hh}:${mm}`;
        }

        // Resolve assignedTo to a single string ID for the form (scalar value for Select)
        let assignedToId = "";

        // Check assignedToDetails first (full user objects from API)
        if (task.assignedToDetails && Array.isArray(task.assignedToDetails) && task.assignedToDetails.length > 0) {
            const u = task.assignedToDetails[0];
            assignedToId = u._id || u.id || u.userId || (u.user && (u.user._id || u.user.id)) || "";
        }

        // Fallback to assignedTo field (can be string, array of IDs, or array of user/assignment objects)
        if (!assignedToId && task.assignedTo != null && task.assignedTo !== "") {
            console.log("Processing task.assignedTo:", task.assignedTo);
            if (typeof task.assignedTo === "string") {
                assignedToId = task.assignedTo;
            } else if (Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
                const first = task.assignedTo[0];
                if (typeof first === "string") {
                    assignedToId = first;
                } else if (first && typeof first === "object") {
                    // Prioritize _id as it's likely the foreign key used in dropdowns
                    // If _id exists, use it. If not, fallback to id.
                    assignedToId = first._id || first.id || first.userId || (first.user && (first.user._id || first.user.id)) || "";
                }
            } else if (task.assignedTo && typeof task.assignedTo === "object") {
                // Prioritize _id for single object as well
                assignedToId = task.assignedTo._id || task.assignedTo.id || task.assignedTo.userId || "";
            }
        }

        // Check for various funnel ID properties
        console.log("handleEditTask: task", task);
        console.log("handleEditTask: assignedToId (resolved)", assignedToId);

        setTaskForm({
            title: task.title || "",
            description: task.description || "",
            dueDate: formattedDueDate,
            priority: task.priority || "medium",
            assignedTo: String(assignedToId || ""),
        });
        setTaskToEdit(task._id);
        setIsTaskModalOpen(true);
    };

    // Handle Delete Task
    const handleDeleteTask = async (taskId: string) => {
        if (!taskId) return;

        setIsDeletingTask(true);
        const loadingToast = toast.loading("Deleting task...");

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/tasks/${taskId}`),
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.ok) {
                toast.success("Task deleted successfully!", { id: loadingToast });
                // Refresh the page to show updated tasks
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to delete task", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error deleting task:", error);
            toast.error("Failed to delete task. Please try again.", { id: loadingToast });
        } finally {
            setIsDeletingTask(false);
            setTaskToDelete(null);
        }
    };

    // Handle Toggle Task Status (Mark as Done / Undone)
    const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
        if (!taskId) return;

        const isDone =
            currentStatus === "completed" ||
            currentStatus === "done" ||
            currentStatus === "true";
        const newStatus = isDone ? "open" : "completed";
        const actionLabel = newStatus === "completed" ? "Marking as done" : "Reopening task";
        const loadingToast = toast.loading(`${actionLabel}...`);

        try {
            const { userId, name: tokenName } = getCurrentActor();
            const directoryName =
                editLeadUsers.find(
                    (u) =>
                        u.id === userId ||
                        (u as any)._id === userId ||
                        (u as any).userId === userId
                )?.name || "";
            const actorName = directoryName || tokenName || "You";

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/tasks/${taskId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status: newStatus,
                        isCompleted: newStatus === "completed",
                        ...(newStatus === "completed" && userId
                            ? { completedBy: userId, completedByName: actorName }
                            : { completedBy: null, completedByName: null }),
                    }),
                }
            );

            if (response.ok) {
                toast.success(
                    newStatus === "completed" ? "Task marked as done!" : "Task reopened!",
                    { id: loadingToast }
                );

                // Optimistic UI update so the actor name shows immediately
                setLead((prev: any) => {
                    if (!prev || !Array.isArray(prev.tasks)) return prev;
                    return {
                        ...prev,
                        tasks: prev.tasks.map((t: any) => {
                            if ((t._id || t.id) !== taskId) return t;
                            if (newStatus === "completed") {
                                return {
                                    ...t,
                                    status: "completed",
                                    isCompleted: true,
                                    completedBy: userId || t.completedBy,
                                    completedByName: actorName,
                                };
                            }
                            return {
                                ...t,
                                status: "open",
                                isCompleted: false,
                                completedBy: "",
                                completedByName: "",
                            };
                        }),
                    };
                });

                router.refresh();
                // Refetch lead details and keep actor fields if API omits them
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    { method: "GET", headers: { "Content-Type": "application/json" } }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);

                    if (Array.isArray(transformedLead.tasks)) {
                        transformedLead.tasks = transformedLead.tasks.map((t: any) => {
                            if ((t._id || t.id) !== taskId) return t;
                            if (newStatus === "completed") {
                                return {
                                    ...t,
                                    status: t.status || "completed",
                                    isCompleted: true,
                                    completedBy: t.completedBy || userId,
                                    completedByName:
                                        t.completedByName || actorName,
                                };
                            }
                            return {
                                ...t,
                                completedBy: "",
                                completedByName: "",
                            };
                        });
                    }

                    setLead(transformedLead);
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to update task status", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error updating task status:", error);
            toast.error("Failed to update task status. Please try again.", { id: loadingToast });
        }
    };

    // Handle Task Creation/Update
    const handleCreateTask = async () => {
        if (!taskForm.title.trim() || !taskForm.description.trim() || !taskForm.dueDate) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsSubmittingTask(true);
        const loadingToast = toast.loading(taskToEdit ? "Updating task..." : "Creating task...");

        try {
            const { userId: actorId, name: actorName } = getCurrentActor();
            const userData = localStorage.getItem("garage_tok");
            let userId = actorId;
            let organizationId = "";

            if (userData) {
                try {
                    const parsedData = jwtDecode<JwtPayload>(userData)
                    userId = parsedData.userId || parsedData.id || userId || "";
                    organizationId = parsedData?.orgId || "";
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }

            const creatorName =
                editLeadUsers.find(
                    (u) =>
                        u.id === userId ||
                        (u as any)._id === userId ||
                        (u as any).userId === userId
                )?.name ||
                actorName ||
                "You";

            const dueDateIso = new Date(
                taskForm.dueDate.includes("T")
                    ? taskForm.dueDate
                    : `${taskForm.dueDate}T23:59:59`
            ).toISOString();

            const taskData = {
                leadId: leadId,
                title: taskForm.title,
                description: taskForm.description,
                dueDate: dueDateIso,
                priority: taskForm.priority,
                status: "open",
                assignedTo: taskForm.assignedTo || userId,
                organizationId: organizationId,
                createdBy: userId,
                createdByName: creatorName,
            };

            // If editing, use PUT method
            const url = taskToEdit
                ? buildExternalUrl(`/crm/tasks/${taskToEdit}`)
                : buildExternalUrl("/crm/tasks");
            const method = taskToEdit ? "PUT" : "POST";

            const response = await authenticatedFetch(
                url,
                {
                    method: method,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(taskData),
                }
            );

            if (response.ok) {
                const createdTitle = taskForm.title;
                toast.success(taskToEdit ? "Task updated successfully!" : "Task created successfully!", { id: loadingToast });
                // Reset form and states
                setTaskForm({
                    title: "",
                    description: "",
                    dueDate: "",
                    priority: "medium",
                    assignedTo: "",
                });
                setTaskToEdit(null);
                setIsTaskModalOpen(false);
                // Refresh the page to show updated tasks
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);

                    // Ensure "Added by" shows even if API omits createdByName
                    if (!taskToEdit && userId && Array.isArray(transformedLead.tasks)) {
                        let patchedOnce = false;
                        transformedLead.tasks = transformedLead.tasks.map((t: any) => {
                            if (patchedOnce) return t;
                            if (t.title === createdTitle && !t.createdByName) {
                                patchedOnce = true;
                                return {
                                    ...t,
                                    createdBy: t.createdBy || userId,
                                    createdByName: creatorName,
                                };
                            }
                            return t;
                        });
                        if (!patchedOnce) {
                            // Fallback: patch newest task missing creator name
                            transformedLead.tasks = transformedLead.tasks.map((t: any, index: number) => {
                                if (index !== 0 || t.createdByName) return t;
                                return {
                                    ...t,
                                    createdBy: t.createdBy || userId,
                                    createdByName: creatorName,
                                };
                            });
                        }
                    }

                    setLead(transformedLead);
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                const rawMessage =
                    errorData?.message ||
                    (typeof errorData === "string" ? errorData : "") ||
                    (taskToEdit ? "Failed to update task" : "Failed to create task");
                const lower = String(rawMessage).toLowerCase();

                // Some legacy task endpoints incorrectly return "expired token" even when
                // the main auth token is valid. Avoid confusing the user by masking this.
                if (
                    lower.includes("expired token") ||
                    lower.includes("token expired") ||
                    lower.includes("jwt expired")
                ) {
                    console.warn("Task API reported token expiry but global auth did not:", {
                        status: response.status,
                        message: rawMessage,
                    });
                    toast.error(
                        taskToEdit
                            ? "Unable to update task. Please try again later."
                            : "Unable to create task. Please try again later.",
                        { id: loadingToast }
                    );
                    return;
                }

                toast.error(rawMessage, { id: loadingToast });
            }
        } catch (error) {
            console.error("Error saving task:", error);
            toast.error(taskToEdit ? "Failed to update task. Please try again." : "Failed to create task. Please try again.", { id: loadingToast });
        } finally {
            setIsSubmittingTask(false);
        }
    };

    const normalizeLeadNameForFolder = (rawName?: string): string => {
        const base = String(rawName || "")
            .replace(/\s+Deal$/i, "")
            .trim()
            .replace(/[\\/:*?"<>|]+/g, " ")
            .replace(/\s+/g, " ");
        return base || "Unknown Lead";
    };

    const getLeadNameForCabinet = (): string => {
        const fromApi = originalLeadData?.leadName || lead?.leadName;
        const fromUi = lead?.name;
        return normalizeLeadNameForFolder(fromApi || fromUi || "");
    };

    const getOrganizationIdForCabinet = (): string => {
        const fromStorage =
            typeof window !== "undefined" ? localStorage.getItem("garage_org_id") || "" : "";
        if (fromStorage) return fromStorage;

        const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
        if (token) {
            try {
                const parsed = jwtDecode<JwtPayload>(token);
                return parsed?.orgId || "";
            } catch {
                return "";
            }
        }
        return "";
    };

    const ensureDealsDocumentsCabinet = async (
        orgId: string
    ): Promise<string | null> => {
        if (!orgId) return null;
        if (dealsDocumentsCabinetIdRef.current) return dealsDocumentsCabinetIdRef.current;

        const listRes = await authenticatedFetchWithCabinetFallback(
            `/cabinet?organizationId=${orgId}`,
            { method: "GET" }
        );
        if (!listRes.ok) return null;

        const listData = await listRes.json().catch(() => ({}));
        const cabinets = listData?.data || listData?.cabinets || listData || [];
        const existing = Array.isArray(cabinets)
            ? cabinets.find(
                (cab: any) =>
                    String(cab?.name || "").trim().toLowerCase() === "deals documents"
            )
            : null;

        if (existing?._id) {
            dealsDocumentsCabinetIdRef.current = existing._id;
            return existing._id;
        }

        const createRes = await authenticatedFetchWithCabinetFallback(
            `/cabinet?organizationId=${orgId}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Deals Documents",
                    description: "Auto-organized lead files from Deals",
                    parentCabinetId: null,
                }),
            }
        );
        if (!createRes.ok) return null;

        const created = await createRes.json().catch(() => ({}));
        const createdCabinet = created?.data || created?.cabinet || created;
        const createdId = createdCabinet?._id || null;
        dealsDocumentsCabinetIdRef.current = createdId;
        return createdId;
    };

    const ensureLeadCabinet = async (orgId: string, leadName: string): Promise<string | null> => {
        if (!orgId || !leadName) return null;

        const cacheKey = leadName.toLowerCase();
        if (leadCabinetIdCacheRef.current[cacheKey]) {
            return leadCabinetIdCacheRef.current[cacheKey];
        }

        const dealsCabinetId = await ensureDealsDocumentsCabinet(orgId);
        if (!dealsCabinetId) return null;

        const targetFolderName = `${leadName} Files`;
        const parentRes = await authenticatedFetchWithCabinetFallback(
            `/cabinet/${dealsCabinetId}?organizationId=${orgId}`,
            { method: "GET" }
        );
        if (!parentRes.ok) return null;

        const parentData = await parentRes.json().catch(() => ({}));
        const subCabinets = parentData?.data?.subCabinets || parentData?.subCabinets || [];
        const existing = Array.isArray(subCabinets)
            ? subCabinets.find(
                (cab: any) =>
                    String(cab?.name || "").trim().toLowerCase() ===
                    targetFolderName.toLowerCase()
            )
            : null;

        if (existing?._id) {
            leadCabinetIdCacheRef.current[cacheKey] = existing._id;
            return existing._id;
        }

        const createRes = await authenticatedFetchWithCabinetFallback(
            `/cabinet?organizationId=${orgId}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: targetFolderName,
                    description: `Files for lead ${leadName}`,
                    parentCabinetId: dealsCabinetId,
                }),
            }
        );
        if (!createRes.ok) return null;

        const created = await createRes.json().catch(() => ({}));
        const createdCabinet = created?.data || created?.cabinet || created;
        const createdId = createdCabinet?._id || null;
        if (createdId) {
            leadCabinetIdCacheRef.current[cacheKey] = createdId;
        }
        return createdId;
    };

    const uploadFilesToLeadCabinet = async (files: File[]): Promise<number> => {
        if (!files.length) return 0;

        const orgId = getOrganizationIdForCabinet();
        const leadName = getLeadNameForCabinet();
        if (!orgId || !leadName) return 0;

        const leadCabinetId = await ensureLeadCabinet(orgId, leadName);
        if (!leadCabinetId) return 0;

        let uploaded = 0;
        for (const file of files) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("cabinetId", leadCabinetId);

            const uploadRes = await authenticatedFetchWithCabinetFallback(
                `/cabinet/files/upload?organizationId=${orgId}`,
                {
                    method: "POST",
                    body: formData,
                }
            );
            if (uploadRes.ok) uploaded += 1;
        }

        return uploaded;
    };

    const syncExistingLeadDocumentsToCabinet = async () => {
        const docs = Array.isArray(lead?.documents) ? lead.documents : [];
        if (!docs.length || backfillRunningRef.current) return;

        const validDocs = docs.filter(
            (doc: any) => String(doc?.docLink || "").trim() && String(doc?.docName || "").trim()
        );
        if (!validDocs.length) return;

        const signature = `${lead?._id || leadId}|${validDocs
            .map((doc: any) => `${doc.docName}|${doc.docLink}`)
            .sort()
            .join("||")}`;
        if (backfillSignatureRef.current === signature) return;

        backfillRunningRef.current = true;
        try {
            const orgId = getOrganizationIdForCabinet();
            const leadName = getLeadNameForCabinet();
            if (!orgId || !leadName) return;

            const leadCabinetId = await ensureLeadCabinet(orgId, leadName);
            if (!leadCabinetId) return;

            const cabinetResponse = await authenticatedFetchWithCabinetFallback(
                `/cabinet/${leadCabinetId}?organizationId=${orgId}`,
                { method: "GET" }
            );
            if (!cabinetResponse.ok) return;

            const cabinetData = await cabinetResponse.json().catch(() => ({}));
            const existingFiles = cabinetData?.data?.files || cabinetData?.files || [];
            const existingNames = new Set(
                (Array.isArray(existingFiles) ? existingFiles : []).map((f: any) =>
                    String(f?.originalName || f?.name || "").trim().toLowerCase()
                )
            );

            let syncedCount = 0;
            for (const doc of validDocs) {
                const docName = String(doc.docName || "").trim();
                const docLink = String(doc.docLink || "").trim();
                if (!docName || !docLink) continue;
                if (existingNames.has(docName.toLowerCase())) continue;

                try {
                    const sourceResponse = await fetch(docLink);
                    if (!sourceResponse.ok) continue;
                    const blob = await sourceResponse.blob();
                    const file = new File([blob], docName, {
                        type: blob.type || "application/octet-stream",
                    });

                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("cabinetId", leadCabinetId);

                    const uploadRes = await authenticatedFetchWithCabinetFallback(
                        `/cabinet/files/upload?organizationId=${orgId}`,
                        {
                            method: "POST",
                            body: formData,
                        }
                    );

                    if (uploadRes.ok) {
                        syncedCount += 1;
                        existingNames.add(docName.toLowerCase());
                    }
                } catch (syncError) {
                    console.error(`Failed to sync existing lead file "${docName}"`, syncError);
                }
            }

            if (syncedCount > 0) {
                toast.success(
                    `${syncedCount} existing file${syncedCount > 1 ? "s" : ""} synced to Cabinet`
                );
            }

            backfillSignatureRef.current = signature;
        } finally {
            backfillRunningRef.current = false;
        }
    };

    // Handle File Upload
    const handleFileUpload = async (file: File) => {
        if (!file) {
            toast.error("Please select a file");
            return;
        }

        setIsUploadingFile(true);
        const loadingToast = toast.loading("Uploading file...");

        try {
            const uploadWithField = async (fieldName: "single" | "file") => {
                const uploadFormData = new FormData();
                uploadFormData.append(fieldName, file);
                uploadFormData.append("folder", "leads");
                return authenticatedFetch(buildExternalUrl("/s3upload/single"), {
                    method: "POST",
                    body: uploadFormData,
                });
            };

            // Step 1: Upload file to S3
            // Different backend deployments expect different field names (`single` or `file`).
            // Try one, and automatically retry with the other if multer reports "Unexpected field".
            let uploadResponse: Response;
            try {
                uploadResponse = await uploadWithField("single");
            } catch (error) {
                console.error("File upload error:", error);
                if (error instanceof TypeError && error.message.includes("fetch")) {
                    toast.error("CORS Error: Backend server needs to allow requests from this origin. Please contact backend team.", { id: loadingToast });
                } else {
                    toast.error(error instanceof Error ? error.message : "Failed to upload file. Please check network connectivity.", { id: loadingToast });
                }
                setIsUploadingFile(false);
                throw error;
            }

            if (!uploadResponse.ok) {
                const firstErrorData = await uploadResponse.json().catch(() => ({} as any));
                const firstErrorText = JSON.stringify(firstErrorData || {}).toLowerCase();
                const shouldRetryWithFileField =
                    firstErrorText.includes("unexpected field") ||
                    firstErrorText.includes("limit_unexpected_file");

                if (shouldRetryWithFileField) {
                    uploadResponse = await uploadWithField("file");
                }

                if (!uploadResponse.ok) {
                    const errorData = await uploadResponse.json().catch(() => ({}));
                    const errorMessage = errorData.message || `Upload failed with status ${uploadResponse.status}`;
                    console.error("Upload response error:", {
                        status: uploadResponse.status,
                        statusText: uploadResponse.statusText,
                        error: errorData
                    });
                    toast.error(errorMessage, { id: loadingToast });
                    setIsUploadingFile(false);
                    return;
                }
            }

            const uploadData = await uploadResponse.json();
            const fileUrl = uploadData.data?.url || uploadData.data?.location || uploadData.url;
            const fileName = uploadData.data?.fileName || file.name;

            if (!fileUrl) {
                toast.error("Upload successful but no URL received", { id: loadingToast });
                setIsUploadingFile(false);
                return;
            }

            // Step 2: Create document record in CRM
            const userData = localStorage.getItem("garage_tok");
            let userId = "";

            if (userData) {
                try {
                    const parsedData = jwtDecode<JwtPayload>(userData)
                    userId = parsedData.userId || parsedData.id || "";
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }

            const documentData = {
                docName: fileName,
                docLink: fileUrl,
                notes: "",
                uploadedBy: userId,
            };

            const documentResponse = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}/documents`),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(documentData),
                }
            );

            if (documentResponse.ok) {
                const cabinetCount = await uploadFilesToLeadCabinet([file]);
                if (cabinetCount === 0) {
                    console.warn("Lead file uploaded to CRM but cabinet sync failed or skipped.");
                }
                toast.success("File uploaded successfully!", { id: loadingToast });
                // Refresh the page to show updated files
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                // Reset file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            } else {
                const errorData = await documentResponse.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to save document record", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error uploading file:", error);
            toast.error("Failed to upload file. Please try again.", { id: loadingToast });
        } finally {
            setIsUploadingFile(false);
        }
    };
    // Handle Multiple File Upload using s3upload/multiple
    const handleMultipleFileUpload = async (files: FileList) => {
        if (files.length === 0) return;

        // For single file, use the existing single upload
        if (files.length === 1) {
            await handleFileUpload(files[0]);
            return;
        }

        setIsUploadingFile(true);
        const loadingToast = toast.loading(`Uploading ${files.length} files...`);

        try {
            // Step 1: Upload all files to S3 in one request
            const uploadFormData = new FormData();
            for (let i = 0; i < files.length; i++) {
                uploadFormData.append("files", files[i]);
            }
            uploadFormData.append("folder", "leads");

            const uploadResponse = await authenticatedFetch(
                buildExternalUrl("/s3upload/multiple"),
                {
                    method: "POST",
                    body: uploadFormData,
                }
            ).catch((error) => {
                console.error("Multiple file upload error:", error);
                if (error instanceof TypeError && error.message.includes("fetch")) {
                    toast.error("CORS Error: Backend server needs to allow requests from this origin.", { id: loadingToast });
                } else {
                    toast.error(error.message || "Failed to upload files. Please check network connectivity.", { id: loadingToast });
                }
                setIsUploadingFile(false);
                throw error;
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json().catch(() => ({}));
                const errorMessage = errorData.message || `Upload failed with status ${uploadResponse.status}`;
                toast.error(errorMessage, { id: loadingToast });
                setIsUploadingFile(false);
                return;
            }

            const uploadData = await uploadResponse.json();
            // The API may return an array of uploaded files in data or files
            const uploadedFiles = uploadData.data || uploadData.files || uploadData || [];
            const uploadedArray = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

            if (uploadedArray.length === 0) {
                toast.error("Upload successful but no files data received", { id: loadingToast });
                setIsUploadingFile(false);
                return;
            }

            // Step 2: Create document records for each uploaded file
            const userData = localStorage.getItem("garage_tok");
            let userId = "";
            if (userData) {
                try {
                    const parsedData = jwtDecode<JwtPayload>(userData)
                    userId = parsedData.userId || parsedData.id || "";
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }

            let successCount = 0;
            for (let i = 0; i < uploadedArray.length; i++) {
                const uploadedFile = uploadedArray[i];
                const fileUrl = uploadedFile.url || uploadedFile.location || uploadedFile.data?.url || uploadedFile.data?.location || "";
                const fileName = uploadedFile.fileName || uploadedFile.originalName || uploadedFile.name || (files[i] ? files[i].name : `file-${i + 1}`);

                if (!fileUrl) continue;

                const documentData = {
                    docName: fileName,
                    docLink: fileUrl,
                    notes: "",
                    uploadedBy: userId,
                };

                try {
                    const documentResponse = await authenticatedFetch(
                        buildExternalUrl(`/crm/leads/${leadId}/documents`),
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(documentData),
                        }
                    );
                    if (documentResponse.ok) {
                        successCount++;
                    }
                } catch (docError) {
                    console.error(`Error creating document record for ${fileName}:`, docError);
                }
            }

            if (successCount > 0) {
                const cabinetCount = await uploadFilesToLeadCabinet(Array.from(files));
                if (cabinetCount === 0) {
                    console.warn("Bulk lead files uploaded to CRM but cabinet sync failed or skipped.");
                }
                toast.success(`${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully!`, { id: loadingToast });
                // Refetch lead details
                router.refresh();
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: { "Content-Type": "application/json" },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
            } else {
                toast.error("Failed to save document records", { id: loadingToast });
            }

            // Reset file inputs
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (error) {
            console.error("Error uploading files:", error);
            toast.error("Failed to upload files. Please try again.", { id: loadingToast });
        } finally {
            setIsUploadingFile(false);
        }
    };

    // Handle file input change
    const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        await handleMultipleFileUpload(files);
        // Reset input so the same file(s) can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Handle View Image/File
    const handleViewFile = (docLink: string, docName: string) => {
        // Check if it's an image
        const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
        const ext = docName.split(".").pop()?.toLowerCase();

        if (ext && imageExtensions.includes(ext)) {
            // Open in popup dialog
            setPreviewImageUrl(docLink);
            setIsImagePreviewOpen(true);
        } else {
            // For non-images, open in new tab
            window.open(docLink, "_blank");
        }
    };

    useEffect(() => {
        if (!lead || !leadId) return;
        syncExistingLeadDocumentsToCabinet();
        // We intentionally gate reruns with backfillSignatureRef to avoid duplicate syncs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lead, leadId]);

    // Handle Edit Lead Name
    const handleEditLeadName = () => {
        // Remove " Deal" suffix if present, since API stores name without it
        const nameWithoutSuffix = lead.name.replace(/\s+Deal$/, "");
        setEditedLeadName(nameWithoutSuffix);
        setIsEditingLeadName(true);
    };

    // Handle Save Lead Name
    const handleSaveLeadName = async () => {
        if (!editedLeadName.trim()) {
            toast.error("Lead name cannot be empty");
            return;
        }

        // Get the base name without " Deal" suffix for comparison
        const currentBaseName = lead.name.replace(/\s+Deal$/, "");

        // If name hasn't changed, just exit edit mode
        if (editedLeadName.trim() === currentBaseName) {
            setIsEditingLeadName(false);
            return;
        }

        setIsUpdatingLeadName(true);
        const loadingToast = toast.loading("Updating lead name...");

        try {
            // Save without " Deal" suffix - API stores just the leadName
            const nameToSave = editedLeadName.trim();

            // Send leadName field to update API
            const updateData = {
                leadName: nameToSave,
            };

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(updateData),
                }
            );

            if (response.ok) {
                toast.success("Lead name updated successfully!", { id: loadingToast });
                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                // Refresh the page
                router.refresh();
                setIsEditingLeadName(false);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to update lead name", { id: loadingToast });
                // Revert to original base name (without Deal)
                const originalBaseName = lead.name.replace(/\s+Deal$/, "");
                setEditedLeadName(originalBaseName);
            }
        } catch (error) {
            console.error("Error updating lead name:", error);
            toast.error("Failed to update lead name. Please try again.", { id: loadingToast });
            // Revert to original base name (without Deal)
            const originalBaseName = lead.name.replace(/\s+Deal$/, "");
            setEditedLeadName(originalBaseName);
        } finally {
            setIsUpdatingLeadName(false);
        }
    };

    // Handle Cancel Edit Lead Name
    const handleCancelEditLeadName = () => {
        // Reset to base name without " Deal"
        const nameWithoutSuffix = lead.name.replace(/\s+Deal$/, "");
        setEditedLeadName(nameWithoutSuffix);
        setIsEditingLeadName(false);
    };

    // Handle Open Edit Company Modal
    const handleOpenEditCompany = () => {
        if (!originalLeadData || !originalLeadData.company) {
            toast.error("Company information not available");
            return;
        }

        const company = originalLeadData.company;
        const normalizeCompanySize = (raw: any): string => {
            if (!raw) return "";
            const str = String(raw).toLowerCase().replace(/employees?/g, "").replace(/\s+/g, "");
            // Direct matches (with or without spaces handled above)
            if (COMPANY_SIZE_OPTIONS.includes(str)) return str;
            // Convert variations like "1- 10", "20-50" etc to range
            const m = str.match(/^(\d+)-(\d+)$/);
            if (m) {
                const low = parseInt(m[1], 10);
                const high = parseInt(m[2], 10);
                if (low >= 1 && high <= 10) return "1-10";
                if (low >= 10 && high <= 50) return "10-50";
                if (low >= 50 && high <= 100) return "50-100";
                if (low >= 100 && high <= 500) return "100-500";
                if (low >= 500 && high <= 1000) return "500-1000";
                if (high > 1000) return "1000+";
            }
            // Single number -> map to bucket
            const n = parseInt(str, 10);
            if (!Number.isNaN(n)) {
                if (n <= 10) return "1-10";
                if (n <= 50) return "10-50";
                if (n <= 100) return "50-100";
                if (n <= 500) return "100-500";
                if (n <= 1000) return "500-1000";
                return "1000+";
            }
            return "";
        };
        setCompanyForm({
            name: company.name || company.companyName || "",
            industry: company.industry || "",
            size: normalizeCompanySize(company.size || company.employeeCount || "") || (company.size || company.employeeCount || ""),
            revenue: company.revenue || "",
            city: company.city || "",
            state: company.state || "",
            country: company.country || "",
            website: company.website || company.url || "",
        });
        setIsEditCompanyOpen(true);
    };

    // Handle Remove Company from Lead
    const handleRemoveCompany = async () => {
        if (!originalLeadData || !originalLeadData.company) {
            toast.error("Company information not available");
            return;
        }

        const company = originalLeadData.company;
        const companyId = company._id || company.id || company.companyId;

        if (!companyId) {
            toast.error("Company ID not found");
            return;
        }

        const loadingToast = toast.loading("Removing company from lead...");

        try {
            // Prepare request body with removeCompanyId
            const requestBody = {
                removeCompanyId: companyId,
            };

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                }
            );

            if (response.ok) {
                toast.success("Company removed from lead successfully!", { id: loadingToast });
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    { method: "GET", headers: { "Content-Type": "application/json" } }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    setLead(transformLeadData(leadData));
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to remove company from lead", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error removing company from lead:", error);
            toast.error("Failed to remove company from lead. Please try again.", { id: loadingToast });
        }
    };

    // Handle Save Company Updates
    const handleSaveCompany = async () => {
        if (!companyForm.name.trim()) {
            toast.error("Company name is required");
            return;
        }

        if (!originalLeadData || !originalLeadData.company) {
            toast.error("Company information not available");
            return;
        }

        const company = originalLeadData.company;
        const companyId = company._id || company.id || company.companyId;

        if (!companyId) {
            toast.error("Company ID not found");
            return;
        }

        setIsUpdatingCompany(true);
        const loadingToast = toast.loading("Updating company details...");

        try {
            // Prepare company update data - only send fields that have values
            const companyUpdateData: any = {};

            if (companyForm.name.trim()) {
                companyUpdateData.companyName = companyForm.name.trim();
            }
            if (companyForm.industry.trim()) {
                companyUpdateData.industry = companyForm.industry.trim();
            }
            if (companyForm.size.trim()) {
                companyUpdateData.size = companyForm.size.trim();
            }
            if (companyForm.revenue.trim()) {
                companyUpdateData.revenue = companyForm.revenue.trim();
            }
            if (companyForm.city.trim()) {
                companyUpdateData.city = companyForm.city.trim();
            }
            if (companyForm.state.trim()) {
                companyUpdateData.state = companyForm.state.trim();
            }
            if (companyForm.country.trim()) {
                companyUpdateData.country = companyForm.country.trim();
            }
            if (companyForm.website.trim()) {
                companyUpdateData.website = companyForm.website.trim();
            }

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/companies/${companyId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(companyUpdateData),
                }
            );

            if (response.ok) {
                toast.success("Company details updated successfully!", { id: loadingToast });

                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                // Refresh the page
                router.refresh();
                setIsEditCompanyOpen(false);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to update company details", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error updating company details:", error);
            toast.error("Failed to update company details. Please try again.", { id: loadingToast });
        } finally {
            setIsUpdatingCompany(false);
        }
    };

    // Fetch Products
    const fetchProducts = async () => {
        setIsLoadingProducts(true);
        try {
            const response = await authenticatedFetch(
                buildExternalUrl("/crm/products"),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                const productsData = data.products || data || [];
                setProducts(productsData);
            } else {
                console.error("Failed to fetch products");
                setProducts([]);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
            setProducts([]);
        } finally {
            setIsLoadingProducts(false);
        }
    };

    // Handle Open Add Product Modal
    const handleOpenAddProduct = () => {
        setProductToEdit(null);
        setProductForm({
            productId: "",
            quantity: "1",
        });
        setProductSelections([]);
        setProductSearchQuery("");
        setIsAddProductOpen(true);
        // Fetch products when modal opens
        fetchProducts();
    };

    // Handle Open Edit Product Modal
    const handleOpenEditProduct = (product: any) => {
        // Get the product ID - this should match what's stored in the lead's products array
        const productId = product._id || product.id || product.productId;
        const quantity = product.quantity || 1;

        // Set productToEdit with both id and productId to ensure matching in handleAddProduct
        setProductToEdit({
            id: productId,
            productId: productId,
            _id: productId, // Also include _id for consistency
        });
        setProductForm({
            productId: productId, // Pre-select the current product
            quantity: String(quantity),
        });
        setProductSelections([{ productId, quantity: String(quantity) }]);
        setProductSearchQuery("");
        setIsAddProductOpen(true);
        // Fetch products when modal opens
        fetchProducts();
    };

    const handleToggleProductSelection = (productId: string) => {
        setProductSelections((prev) => {
            const exists = prev.some((s) => s.productId === productId);
            if (productToEdit) {
                // Edit mode: single selection only
                return exists ? [] : [{ productId, quantity: "1" }];
            }
            if (exists) {
                return prev.filter((s) => s.productId !== productId);
            }
            return [...prev, { productId, quantity: "1" }];
        });
    };

    const handleProductQuantityChange = (productId: string, quantity: string) => {
        setProductSelections((prev) =>
            prev.map((s) => (s.productId === productId ? { ...s, quantity } : s))
        );
    };

    const parseProductPricing = (product: any): number => {
        if (typeof product.pricing === "number") {
            return product.pricing;
        }
        if (product.pricing) {
            const pricingStr = product.pricing.toString();
            const numericMatch = pricingStr.match(/^(\d+(?:\.\d+)?)/);
            if (numericMatch) {
                return parseFloat(numericMatch[1]);
            }
            return parseFloat(pricingStr) || 0;
        }
        if (product.price) {
            return typeof product.price === "number"
                ? product.price
                : parseFloat(product.price.toString()) || 0;
        }
        return 0;
    };

    // Handle Add/Edit Product
    const handleAddProduct = async () => {
        if (productSelections.length === 0) {
            toast.error("Please select at least one product");
            return;
        }

        for (const selection of productSelections) {
            const quantity = parseInt(selection.quantity, 10) || 0;
            if (quantity < 1) {
                toast.error("Quantity must be at least 1 for each selected product");
                return;
            }
        }

        const isEditing = productToEdit !== null;
        setIsSubmittingProduct(true);
        const loadingToast = toast.loading(
            isEditing
                ? "Updating product..."
                : productSelections.length > 1
                    ? "Adding products..."
                    : "Adding product..."
        );

        try {
            const existingProducts = originalLeadData?.products || [];

            let existingProductsFormatted = existingProducts.map((product: any) => {
                const productId = product._id || product.id || product.productId;
                return {
                    productId: productId,
                    quantity: product.quantity || 1,
                    pricing:
                        typeof product.price === "string"
                            ? parseFloat(
                                  (product.price || product.pricing || "0").match(
                                      /^(\d+(?:\.\d+)?)/
                                  )?.[1] || "0"
                              ) || 0
                            : product.price || product.pricing || 0,
                    unit: product.unit || "",
                };
            });

            if (isEditing && productToEdit) {
                const selection = productSelections[0];
                const selectedProduct = products.find(
                    (p) => (p._id || p.id) === selection.productId
                );
                if (!selectedProduct) {
                    toast.error("Selected product not found", { id: loadingToast });
                    return;
                }

                const productPricing = parseProductPricing(selectedProduct);
                if (productPricing <= 0) {
                    toast.error("Product pricing not available", { id: loadingToast });
                    return;
                }

                const editProductId = productToEdit.id || productToEdit.productId;
                const quantity = parseInt(selection.quantity, 10) || 1;
                const productUnit = selectedProduct.unit || "";

                existingProductsFormatted = existingProductsFormatted.map((p: any) => {
                    if (p.productId === editProductId) {
                        return {
                            productId: selection.productId,
                            quantity,
                            pricing: productPricing,
                            unit: productUnit,
                        };
                    }
                    return p;
                });
            } else {
                const productsToAdd: Array<{
                    productId: string;
                    quantity: number;
                    pricing: number;
                    unit: string;
                }> = [];

                for (const selection of productSelections) {
                    const selectedProduct = products.find(
                        (p) => (p._id || p.id) === selection.productId
                    );
                    if (!selectedProduct) {
                        toast.error("One or more selected products were not found", {
                            id: loadingToast,
                        });
                        return;
                    }

                    const productPricing = parseProductPricing(selectedProduct);
                    if (productPricing <= 0) {
                        const name =
                            selectedProduct.name ||
                            selectedProduct.productName ||
                            "Selected product";
                        toast.error(`Pricing not available for ${name}`, {
                            id: loadingToast,
                        });
                        return;
                    }

                    productsToAdd.push({
                        productId: selection.productId,
                        quantity: parseInt(selection.quantity, 10) || 1,
                        pricing: productPricing,
                        unit: selectedProduct.unit || "",
                    });
                }

                // Avoid duplicating products already on the lead — bump quantity instead
                for (const toAdd of productsToAdd) {
                    const existingIndex = existingProductsFormatted.findIndex(
                        (p: any) => p.productId === toAdd.productId
                    );
                    if (existingIndex >= 0) {
                        existingProductsFormatted[existingIndex] = {
                            ...existingProductsFormatted[existingIndex],
                            quantity:
                                (existingProductsFormatted[existingIndex].quantity || 0) +
                                toAdd.quantity,
                            pricing: toAdd.pricing,
                            unit: toAdd.unit,
                        };
                    } else {
                        existingProductsFormatted.push(toAdd);
                    }
                }
            }

            const requestBody = {
                products: existingProductsFormatted,
            };

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                }
            );

            if (response.ok) {
                toast.success(
                    isEditing
                        ? "Product updated successfully!"
                        : productSelections.length > 1
                            ? `${productSelections.length} products added successfully!`
                            : "Product added successfully!",
                    { id: loadingToast }
                );

                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                router.refresh();
                setIsAddProductOpen(false);
                setProductToEdit(null);
                setProductForm({
                    productId: "",
                    quantity: "1",
                });
                setProductSelections([]);
                setProductSearchQuery("");
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(
                    errorData.message ||
                        (isEditing ? "Failed to update product" : "Failed to add products"),
                    { id: loadingToast }
                );
            }
        } catch (error) {
            console.error("Error adding/updating product:", error);
            toast.error(
                isEditing
                    ? "Failed to update product. Please try again."
                    : "Failed to add products. Please try again.",
                { id: loadingToast }
            );
        } finally {
            setIsSubmittingProduct(false);
        }
    };

    // Handle Restore Lead
    const handleRestoreLead = async () => {
        setIsSubmittingProduct(true);
        const loadingToast = toast.loading("Restoring lead...");

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        leadStatus: "active",
                    }),
                }
            );

            if (response.ok) {
                toast.success("Lead restored successfully!", { id: loadingToast });

                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                // Refresh the page
                router.refresh();
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to restore lead", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error restoring lead:", error);
            toast.error("Failed to restore lead. Please try again.", { id: loadingToast });
        } finally {
            setIsSubmittingProduct(false);
        }
    };

    // Handle Update Lead Status
    const handleUpdateLeadStatus = async (status: "archived" | "lost" | "won" | "active") => {
        setIsSubmittingProduct(true);
        const loadingToast = toast.loading(`Updating lead status...`);

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        leadStatus: status,
                    }),
                }
            );

            if (response.ok) {
                const statusMessages: Record<string, string> = {
                    archived: "Lead archived successfully!",
                    lost: "Lead marked as lost!",
                    won: "Lead marked as won!",
                    active: "Lead reactivated successfully!",
                };
                toast.success(statusMessages[status] || "Lead updated successfully!", {
                    id: loadingToast,
                });

                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                // Refresh the page
                router.refresh();
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || `Failed to update lead status`, { id: loadingToast });
            }
        } catch (error) {
            console.error("Error updating lead status:", error);
            toast.error("Failed to update lead status. Please try again.", { id: loadingToast });
        } finally {
            setIsSubmittingProduct(false);
        }
    };

    // Handle Delete Product
    const handleDeleteProduct = async (productId: string) => {
        if (!productId) return;

        setIsDeletingProduct(true);
        const loadingToast = toast.loading("Deleting product...");

        try {
            // Prepare request body with removeProductId
            const requestBody = {
                removeProductId: productId,
            };

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                }
            );

            if (response.ok) {
                toast.success("Product deleted successfully!", { id: loadingToast });

                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                // Refresh the page
                router.refresh();
                setProductToDelete(null);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to delete product", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error deleting product:", error);
            toast.error("Failed to delete product. Please try again.", { id: loadingToast });
        } finally {
            setIsDeletingProduct(false);
        }
    };

    // Fetch All Contacts
    const fetchAllContacts = async () => {
        setIsLoadingContacts(true);
        try {
            const response = await authenticatedFetch(
                buildExternalUrl("/crm/contacts?skip=0&limit=1000"),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                const contactsData = data.contacts || data || [];
                setAllContacts(contactsData);
            } else {
                console.error("Failed to fetch contacts");
                setAllContacts([]);
            }
        } catch (error) {
            console.error("Error fetching contacts:", error);
            setAllContacts([]);
        } finally {
            setIsLoadingContacts(false);
        }
    };

    // Build a display name robustly since API payloads may omit `name` or only provide one of first/last name.
    const getContactDisplayName = (contact: any): string => {
        if (!contact) return "";

        const first =
            contact.firstName ??
            contact.first_name ??
            contact.givenName ??
            "";
        const last =
            contact.lastName ??
            contact.last_name ??
            contact.familyName ??
            "";

        const firstStr = first == null ? "" : String(first).trim();
        const lastStr = last == null ? "" : String(last).trim();

        const combined = [firstStr, lastStr].filter(Boolean).join(" ").trim();
        if (combined) return combined;

        return (
            contact.name ??
            contact.fullName ??
            contact.contactName ??
            ""
        ).toString().trim();
    };

    // Handle Open Add Contact Modal
    const handleOpenAddContact = () => {
        setSelectedContactIds([]);
        setContactSearchQuery("");
        setIsAddContactOpen(true);
        fetchAllContacts();
    };

    // Fetch Companies for New Contact Form
    const fetchNewContactCompanies = async () => {
        setLoadingNewContactCompanies(true);
        try {
            const response = await authenticatedFetch(
                buildExternalUrl("/crm/companies?skip=0&limit=100"),
                { method: "GET" }
            );
            if (response.ok) {
                const data = await response.json();
                const companiesList = data.companies || data.data || data || [];
                setNewContactCompanies(companiesList.map((c: any) => ({ _id: c._id, name: c.name || c.companyName })));
            }
        } catch (error) {
            console.error("Error fetching companies:", error);
        } finally {
            setLoadingNewContactCompanies(false);
        }
    };

    // Handle Open Add New Contact Dialog
    const handleOpenAddNewContact = () => {
        setIsAddNewContactOpen(true);
        fetchNewContactCompanies();
    };

    // Validate New Contact Form
    const validateNewContactName = (name: string): boolean => {
        if (!name.trim()) {
            setNewContactNameError("Name is required");
            return false;
        }
        setNewContactNameError("");
        return true;
    };

    const validateNewContactEmail = (email: string): boolean => {
        if (!email.trim()) {
            setNewContactEmailError("Email is required");
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setNewContactEmailError("Please enter a valid email address");
            return false;
        }
        setNewContactEmailError("");
        return true;
    };

    const validateEditContactName = (name: string): boolean => {
        if (!name.trim()) {
            setEditContactNameError("Name is required");
            return false;
        }
        setEditContactNameError("");
        return true;
    };

    const validateEditContactEmail = (email: string): boolean => {
        if (!email.trim()) {
            setEditContactEmailError("Email is required");
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setEditContactEmailError("Please enter a valid email address");
            return false;
        }
        setEditContactEmailError("");
        return true;
    };

    // Helper function to format phone number for WhatsApp
    const formatPhoneForWhatsApp = (phone: string): string => {
        if (!phone) return "";
        // Remove all non-digit characters except + at the start
        let cleaned = phone.trim();
        // If it starts with +, keep it, otherwise remove all non-digits
        if (cleaned.startsWith("+")) {
            cleaned = "+" + cleaned.slice(1).replace(/\D/g, "");
        } else {
            cleaned = cleaned.replace(/\D/g, "");
        }
        return cleaned;
    };

    const normalizePhoneValue = (value: unknown): string => String(value ?? "").trim();

    const extractFirstPhoneFromEntity = (entity: any): string => {
        if (!entity) return "";

        const directCandidates = [
            entity.phoneNumber,
            entity.phone,
            entity.mobile,
            entity.number,
            entity.value,
        ]
            .map(normalizePhoneValue)
            .filter(Boolean);

        if (directCandidates.length > 0) {
            return directCandidates[0];
        }

        const phoneNumbers = Array.isArray(entity.phoneNumbers) ? entity.phoneNumbers : [];
        const normalizedPhoneEntries = phoneNumbers
            .map((item: any) => {
                if (typeof item === "string") {
                    return { value: normalizePhoneValue(item), type: "" };
                }

                return {
                    value: normalizePhoneValue(
                        item?.phoneNumber ?? item?.phone ?? item?.number ?? item?.value
                    ),
                    type: normalizePhoneValue(item?.type ?? item?.label ?? item?.kind).toLowerCase(),
                };
            })
            .filter((item: { value: string; type: string }) => item.value);

        if (normalizedPhoneEntries.length === 0) {
            return "";
        }

        const firstMobile = normalizedPhoneEntries.find((item: { value: string; type: string }) =>
            /(mobile|cell)/.test(item.type)
        );

        return firstMobile?.value || normalizedPhoneEntries[0].value;
    };

    const resolveLeadPhoneNumber = (data: { leadData?: any; contacts?: any[] }): string => {
        const primaryContact =
            data.contacts?.find((contact: any) => contact?.isPrimary) ||
            data.contacts?.[0] ||
            data.leadData?.contact ||
            data.leadData?.contacts?.find((contact: any) => contact?.isPrimary) ||
            data.leadData?.contacts?.[0] ||
            null;

        const primaryContactPhone = extractFirstPhoneFromEntity(primaryContact);
        if (primaryContactPhone) {
            return primaryContactPhone;
        }

        return extractFirstPhoneFromEntity(data.leadData);
    };

    // Helper function to open Gmail compose
    const handleOpenGmail = (email: string) => {
        if (!email || email === "N/A") {
            toast.error("No email address available");
            return;
        }
        const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`;
        window.open(gmailUrl, "_blank");
    };

    const refreshLeadAfterWhatsAppTask = useCallback(async () => {
        const fetchResponse = await authenticatedFetch(
            buildExternalUrl(`/crm/leads/${leadId}`),
            { method: "GET", headers: { "Content-Type": "application/json" } }
        );
        if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            const leadData = data.lead || data.data || data;
            setOriginalLeadData(leadData);
            setLead(transformLeadData(leadData));
        }
    }, [leadId]);

    // Helper function to open WhatsApp
    const handleOpenWhatsApp = (phone: string) => {
        if (!phone || phone === "N/A") {
            toast.error("number does not exist");
            return;
        }
        const formattedPhone = formatPhoneForWhatsApp(phone);
        if (!formattedPhone) {
            toast.error("Invalid phone number");
            return;
        }
        window.open(`https://wa.me/${formattedPhone}`, "_blank");
        void createWhatsAppContactTask(
            { _id: leadId },
            { leadId, onSuccess: refreshLeadAfterWhatsAppTask }
        );
    };

    // Handle Attach File from Sidebar
    const handleAttachFileClick = () => {
        setIsAttachFileOpen(true);
    };

    // Handle Add Task from Sidebar
    const handleAddTaskClick = () => {
        setTaskForm({
            title: "",
            description: "",
            dueDate: "",
            priority: "medium",
            assignedTo: "",
        });
        setTaskToEdit(null);
        setIsTaskModalOpen(true);
        setShowActionsSidebar(false);
    };

    const getAutoFollowUpPrefill = useCallback(() => {
        const leadDesc = lead?.description;
        const hasLeadDesc =
            typeof leadDesc === "string" &&
            leadDesc.trim() &&
            leadDesc.trim().toLowerCase().replace(/\.$/, "") !== "no description available";

        if (hasLeadDesc) {
            return { title: "Follow-up with Lead", description: leadDesc.trim() };
        }

        const tasks = Array.isArray(lead?.tasks) ? [...lead.tasks] : [];
        tasks.sort((a: { dueDate?: string; createdAt?: string }, b: { dueDate?: string; createdAt?: string }) => {
            const dueA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            const dueB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            if (dueB !== dueA) return dueB - dueA;
            const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return createdB - createdA;
        });

        const latestWithDescription = tasks.find(
            (t: { description?: string }) => typeof t.description === "string" && t.description.trim()
        ) as { title?: string; description?: string } | undefined;

        if (latestWithDescription?.description) {
            return {
                title: latestWithDescription.title?.trim() || "Follow-up with Lead",
                description: latestWithDescription.description.trim(),
            };
        }

        return { title: "Follow-up with Lead", description: "Follow-up scheduled" };
    }, [lead]);

    const handleOpenAutoFollowUp = () => {
        const prefill = getAutoFollowUpPrefill();
        setAutoFollowUpForm({
            enableAutoFollowUp: isAutoFollowUpEnabled(lead?.autoFollowUp),
            title: prefill.title,
            description: prefill.description,
            followUpIntervalDays: "2",
            autoFollowUpEndDate: "",
            assignedTo: "",
        });
        setIsAutoFollowUpOpen(true);
    };

    const handleConfirmAutoFollowUp = async (
        override?: typeof autoFollowUpForm & { startDate?: string }
    ) => {
        const form = override ?? autoFollowUpForm;
        if (!form.enableAutoFollowUp) {
            toast.error("Please enable auto follow-up");
            return;
        }

        setIsSubmittingAutoFollowUp(true);
        const loadingToast = toast.loading("Starting auto follow-up...");

        try {
            const userData = localStorage.getItem("garage_tok");
            let userId = "";
            let organizationId = "";

            if (userData) {
                try {
                    const parsedData = jwtDecode<JwtPayload>(userData);
                    userId = parsedData.userId || parsedData.id || "";
                    organizationId = parsedData?.orgId || "";
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }

            const startDate =
                ("startDate" in form && form.startDate) ||
                (() => {
                    const now = new Date();
                    const yyyy = now.getFullYear();
                    const mm = String(now.getMonth() + 1).padStart(2, "0");
                    const dd = String(now.getDate()).padStart(2, "0");
                    return `${yyyy}-${mm}-${dd}`;
                })();
            const dueDateTime = new Date(`${startDate}T23:59:59`).toISOString();

            await authenticatedFetch(buildExternalUrl("/crm/tasks"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leadId,
                    title: form.title.trim() || "Follow-up with Lead",
                    description: form.description.trim() || "Follow-up scheduled",
                    dueDate: dueDateTime,
                    priority: "medium",
                    status: "open",
                    assignedTo: form.assignedTo || userId,
                    organizationId,
                    createdBy: userId,
                    ...FOLLOW_UP_TASK_DEFAULTS,
                }),
            });

            const leadUpdateBody: Record<string, unknown> = {
                autoFollowUp: true,
            };
            const parsedInterval = parseInt(form.followUpIntervalDays, 10);
            if (Number.isFinite(parsedInterval) && parsedInterval > 0) {
                leadUpdateBody.followUpIntervalDays = parsedInterval;
            }
            if (form.autoFollowUpEndDate) {
                leadUpdateBody.autoFollowUpEndDate = form.autoFollowUpEndDate;
            }

            await authenticatedFetch(buildExternalUrl(`/crm/leads/${leadId}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(leadUpdateBody),
            });

            toast.success("Auto follow-up started!", { id: loadingToast });

            setIsAutoFollowUpOpen(false);
            setAutoFollowUpForm({
                enableAutoFollowUp: true,
                title: "Follow-up with Lead",
                description: "",
                followUpIntervalDays: "2",
                autoFollowUpEndDate: "",
                assignedTo: "",
            });

            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent(DEALS_CRM_STATS_REFRESH_EVENT));
            }

            await fetchLeadDetails();
        } catch (error) {
            console.error("Error scheduling auto follow-up:", error);
            toast.error("Failed to schedule auto follow-up. Please try again.", {
                id: loadingToast,
            });
        } finally {
            setIsSubmittingAutoFollowUp(false);
        }
    };

    // Handle Schedule Follow-up
    const handleScheduleFollowUp = async (
        override?: typeof followUpForm
    ) => {
        const form = override ?? followUpForm;
        if (!form.scheduledDate) {
            toast.error("Please select a date");
            return;
        }

        setIsSubmittingFollowUp(true);
        const loadingToast = toast.loading("Scheduling follow-up...");

        try {
            const { userId: actorId, name: actorTokenName } = getCurrentActor();
            const userData = localStorage.getItem("garage_tok");
            let userId = actorId;
            let organizationId = "";

            if (userData) {
                try {
                    const parsedData = jwtDecode<JwtPayload>(userData)
                    userId = parsedData.userId || parsedData.id || userId || "";
                    organizationId = parsedData?.orgId || "";
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }

            const creatorName =
                editLeadUsers.find(
                    (u) =>
                        u.id === userId ||
                        (u as any)._id === userId ||
                        (u as any).userId === userId
                )?.name ||
                actorTokenName ||
                "You";

            // Time is optional; default to end of selected day if not provided
            const dueDateTime = new Date(
                form.scheduledTime
                    ? `${form.scheduledDate}T${form.scheduledTime}`
                    : `${form.scheduledDate}T23:59:59`
            ).toISOString();

            const followUpTitle = form.title || "Follow-up with Lead";
            const taskData = {
                leadId: leadId,
                title: followUpTitle,
                description: form.description || "Follow-up scheduled",
                dueDate: dueDateTime,
                priority: form.priority,
                status: "open",
                assignedTo: form.assignedTo || userId,
                organizationId: organizationId,
                createdBy: userId,
                createdByName: creatorName,
                ...FOLLOW_UP_TASK_DEFAULTS,
            };

            const response = await authenticatedFetch(
                buildExternalUrl("/crm/tasks"),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(taskData),
                }
            );

            if (response.ok) {
                toast.success("Follow-up scheduled successfully!", { id: loadingToast });
                setIsFollowUpOpen(false);
                setFollowUpForm({
                    title: "Follow-up with Lead",
                    description: "",
                    scheduledDate: "",
                    scheduledTime: "",
                    priority: "medium",
                    assignedTo: "",
                });
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    { method: "GET", headers: { "Content-Type": "application/json" } }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);
                    if (Array.isArray(transformedLead.tasks)) {
                        let patched = false;
                        transformedLead.tasks = transformedLead.tasks.map((t: any) => {
                            if (patched) return t;
                            if (t.title === followUpTitle && !t.createdByName) {
                                patched = true;
                                return {
                                    ...t,
                                    createdBy: t.createdBy || userId,
                                    createdByName: creatorName,
                                };
                            }
                            return t;
                        });
                    }
                    setLead(transformedLead);
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to schedule follow-up", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error scheduling follow-up:", error);
            toast.error("Failed to schedule follow-up. Please try again.", { id: loadingToast });
        } finally {
            setIsSubmittingFollowUp(false);
        }
    };

    const handleInlineAddFollowup = async () => {
        const title = inlineFollowupForm.title.trim();
        const description = inlineFollowupForm.description.trim();

        if (!title) {
            toast.error("Please enter a title");
            return;
        }
        if (!description) {
            toast.error("Please enter a description");
            return;
        }

        const frequencyDays = Number(inlineFollowupForm.frequency);
        const canStartAuto =
            Boolean(inlineFollowupForm.startDate?.trim()) &&
            Boolean(inlineFollowupForm.endDate?.trim()) &&
            Number.isFinite(frequencyDays) &&
            frequencyDays > 0;

        // Dates + frequency → start auto follow-up; otherwise create a manual follow-up
        // (date is optional for manual).
        if (canStartAuto) {
            await handleConfirmAutoFollowUp({
                enableAutoFollowUp: true,
                title,
                description,
                followUpIntervalDays: String(frequencyDays),
                autoFollowUpEndDate: inlineFollowupForm.endDate,
                assignedTo: "",
                startDate: inlineFollowupForm.startDate,
            });
            setInlineFollowupForm((prev) => ({
                ...prev,
                title: "",
                description: "",
                startDate: "",
                endDate: "",
                frequency: "2",
            }));
            return;
        }

        const today = (() => {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, "0");
            const dd = String(now.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}`;
        })();

        await handleScheduleFollowUp({
            title,
            description,
            scheduledDate: inlineFollowupForm.startDate || today,
            scheduledTime: "",
            priority: "medium",
            assignedTo: "",
        });
        setInlineFollowupForm((prev) => ({
            ...prev,
            title: "",
            description: "",
            startDate: "",
            endDate: "",
            frequency: "2",
        }));
    };

    const primaryContact = useMemo(() => {
        if (!lead?.contacts?.length) return null;
        return lead.contacts.find((c: any) => c.isPrimary) || lead.contacts[0];
    }, [lead]);

    const displayLeadName = useMemo(
        () => lead?.name || lead?.leadName || primaryContact?.name || "Unknown Lead",
        [lead, primaryContact]
    );

    const displayEmail = useMemo(() => {
        return (
            primaryContact?.email ||
            originalLeadData?.email ||
            lead?.email ||
            ""
        );
    }, [primaryContact, originalLeadData, lead]);

    const displayPhone = useMemo(() => {
        return resolveLeadPhoneNumber({
            leadData: originalLeadData,
            contacts: lead?.contacts,
        });
    }, [originalLeadData, lead]);

    const funnelDisplayName = useMemo(() => {
        return (
            lead?.salesFunnel?.funnelName ||
            lead?.salesFunnel?.name ||
            lead?.funnel?.name ||
            lead?.funnelName ||
            originalLeadData?.funnel?.name ||
            originalLeadData?.salesFunnel?.name ||
            "—"
        );
    }, [lead, originalLeadData]);

    const dateAddedLabel = useMemo(() => {
        const raw = lead?.createdDate || lead?.dateAdded || originalLeadData?.createdAt;
        if (!raw || raw === "N/A") return "—";
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return "—";
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }, [lead, originalLeadData]);

    const lastActivityLabel = useMemo(() => {
        const raw = lead?.lastActivity || lead?.updatedAt || originalLeadData?.updatedAt;
        if (!raw || raw === "N/A") return "—";
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return "—";
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }, [lead, originalLeadData]);

    const companyDisplay = useMemo(() => {
        const company = lead?.company;
        if (!company || company.name === "No Company") return null;
        return {
            name: company.name || "Unknown Company",
            location: company.location || "",
            industry: company.industry || "",
        };
    }, [lead]);

    const resolveUserDisplayName = useCallback(
        (value: unknown): string => {
            if (!value) return "";

            if (typeof value === "object" && value !== null) {
                const obj = value as Record<string, unknown>;
                const nested = obj.user && typeof obj.user === "object"
                    ? (obj.user as Record<string, unknown>)
                    : null;
                const directName = getDirectoryUserName(obj) || getDirectoryUserName(nested);
                if (directName) return directName;
                const id =
                    (typeof obj._id === "string" && obj._id) ||
                    (typeof obj.id === "string" && obj.id) ||
                    (typeof obj.userId === "string" && obj.userId) ||
                    "";
                if (id) {
                    const match = editLeadUsers.find(
                        (u) => u.id === id || (u as any)._id === id || (u as any).userId === id
                    );
                    if (match) {
                        const name = getDirectoryUserName(match);
                        if (name) return name;
                    }
                }
                return "";
            }

            if (typeof value === "string") {
                const match = editLeadUsers.find(
                    (u) => u.id === value || (u as any)._id === value || (u as any).userId === value
                );
                if (match) {
                    const name = getDirectoryUserName(match);
                    if (name) return name;
                }
                // Likely already a display name (not a Mongo ObjectId)
                if (!/^[a-f0-9]{24}$/i.test(value)) return value;

                // Fallback: if this id is the current user, use token name
                const current = getCurrentActor();
                if (current.userId && current.userId === value && current.name) {
                    return current.name;
                }
            }

            return "";
        },
        [editLeadUsers]
    );

    const timelineItems = useMemo<TimelineItem[]>(() => {
        if (!lead) return [];

        const items: TimelineItem[] = [];

        (lead.tasks || []).forEach((task: any) => {
            const isFollowUp = isFollowUpTask(task);
            const isCompleted =
                task.status === "completed" ||
                task.isCompleted === true ||
                task.isCompleted === "true";

            const completedName =
                (typeof task.completedByName === "string" && task.completedByName.trim()) ||
                resolveUserDisplayName(task.completedBy) ||
                (typeof task.updatedByName === "string" && task.updatedByName.trim()) ||
                resolveUserDisplayName(task.updatedBy) ||
                "";

            const addedName =
                (typeof task.createdByName === "string" && task.createdByName.trim()) ||
                resolveUserDisplayName(task.createdBy) ||
                (typeof task.assignedToName === "string" && task.assignedToName.trim()) ||
                resolveUserDisplayName(task.assignedToDetails?.[0]) ||
                resolveUserDisplayName(task.assignedTo) ||
                "";

            // If ids match the signed-in user but directory lookup failed, use JWT name
            const currentActor = getCurrentActor();
            const completedFallback =
                isCompleted &&
                currentActor.name &&
                task.completedBy &&
                String(task.completedBy) === String(currentActor.userId)
                    ? currentActor.name
                    : "";
            const addedFallback =
                currentActor.name &&
                task.createdBy &&
                String(task.createdBy) === String(currentActor.userId)
                    ? currentActor.name
                    : "";

            const actorName = isCompleted
                ? completedName || completedFallback || addedName
                : addedName || addedFallback;
            const actorAction: TimelineItem["actorAction"] = isCompleted
                ? "completed"
                : "added";

            items.push({
                id: task._id || task.id || `task-${task.title}`,
                kind: isFollowUp ? "followup" : "task",
                title: task.title || `${isFollowUp ? "Followup" : "Task"} created`,
                description: task.description,
                dueLabel: formatDueLabel(task.dueDate),
                assigneeName: task.assignedToName,
                createdBy: typeof task.createdBy === "string" ? task.createdBy : undefined,
                actorName: actorName || undefined,
                actorAction: actorName ? actorAction : undefined,
                isCompleted,
                timestamp: new Date(task.createdAt || task.dueDate || 0).getTime(),
            });
        });

        const seen = new Set<string>();
        return items
            .filter((item) => {
                const key = `${item.kind}-${item.id}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return item.timestamp > 0 || Boolean(item.title);
            })
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [lead, resolveUserDisplayName]);

    const getTodayDate = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    };

    const isDateToday = (date: Date | string | undefined) => {
        if (!date) return false;
        const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
        const today = new Date();
        return (
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate()
        );
    };

    const getCurrentTimeString = () => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    };

    const isTimePast = (time: string) => {
        if (!time) return false;
        return time < getCurrentTimeString();
    };

    const getFollowUpSelectedDate = () => {
        if (!followUpForm.scheduledDate) return undefined;
        const selected = new Date(`${followUpForm.scheduledDate}T00:00:00`);
        return Number.isNaN(selected.getTime()) ? undefined : selected;
    };

    const formatFollowUpDateLabel = (date?: Date) => {
        if (!date) return "Select a date";
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const formatFollowUpDateTimeLabel = () => {
        const selectedDate = getFollowUpSelectedDate();
        if (!selectedDate) return "Select date and time";
        const dateLabel = formatFollowUpDateLabel(selectedDate);
        const timeLabel = followUpForm.scheduledTime || "--:--";
        return `${dateLabel} ${timeLabel}`;
    };

    const getTaskSelectedDate = () => {
        if (!taskForm.dueDate) return undefined;
        const [datePart] = taskForm.dueDate.split("T");
        if (!datePart) return undefined;
        const selected = new Date(`${datePart}T00:00:00`);
        return Number.isNaN(selected.getTime()) ? undefined : selected;
    };

    const getTaskSelectedTime = () => {
        if (!taskForm.dueDate || !taskForm.dueDate.includes("T")) return "";
        const [, timePart] = taskForm.dueDate.split("T");
        return (timePart || "").slice(0, 5);
    };

    const setTaskDatePart = (datePart: string) => {
        const existingTime = getTaskSelectedTime();
        const dueDate = existingTime ? `${datePart}T${existingTime}` : datePart;
        setTaskForm({ ...taskForm, dueDate });
    };

    const setTaskTimePart = (timePart: string) => {
        const selectedDate = getTaskSelectedDate();
        const datePart = selectedDate
            ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
            : (() => {
                const today = getTodayDate();
                return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            })();
        setTaskForm({ ...taskForm, dueDate: `${datePart}T${timePart}` });
    };

    const formatTaskDateTimeLabel = () => {
        const date = getTaskSelectedDate();
        if (!date) return "Select date and time";
        const dateLabel = formatFollowUpDateLabel(date);
        const timeLabel = getTaskSelectedTime() || "--:--";
        return `${dateLabel} ${timeLabel}`;
    };

    // Handle Schedule Meeting
    const handleScheduleMeeting = async () => {
        if (!meetingForm.scheduledDate || !meetingForm.scheduledTime) {
            toast.error("Please select both date and time");
            return;
        }

        setIsSubmittingMeeting(true);
        const loadingToast = toast.loading("Scheduling meeting...");

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

            // Combine date and time for dueDate
            const dueDateTime = new Date(`${meetingForm.scheduledDate}T${meetingForm.scheduledTime}`).toISOString();

            const taskData = {
                leadId: leadId,
                title: meetingForm.title || "Meeting with Lead",
                description: meetingForm.description || `Meeting scheduled${meetingForm.location ? ` at ${meetingForm.location}` : ""}`,
                dueDate: dueDateTime,
                priority: meetingForm.priority,
                status: "open",
                assignedTo: meetingForm.assignedTo || userId,
                organizationId: organizationId,
                createdBy: userId,
            };

            const response = await authenticatedFetch(
                buildExternalUrl("/crm/tasks"),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(taskData),
                }
            );

            if (response.ok) {
                toast.success("Meeting scheduled successfully!", { id: loadingToast });
                setIsMeetingOpen(false);
                setMeetingForm({
                    title: "Meeting with Lead",
                    description: "",
                    scheduledDate: "",
                    scheduledTime: "",
                    location: "",
                    priority: "medium",
                    assignedTo: "",
                });
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    { method: "GET", headers: { "Content-Type": "application/json" } }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setLead(transformLeadData(leadData));
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to schedule meeting", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error scheduling meeting:", error);
            toast.error("Failed to schedule meeting. Please try again.", { id: loadingToast });
        } finally {
            setIsSubmittingMeeting(false);
        }
    };

    // Fetch dropdown data for Edit Lead Dialog
    const fetchEditLeadDropdowns = async () => {
        setIsLoadingEditLeadDropdowns(true);
        let funnels: Array<{ _id: string; name: string; stages?: any[] }> = [];
        let users: Array<{ id: string; name: string; email?: string }> = [];
        try {
            // Fetch all dropdowns in parallel
            const orgIdForUsers = getOrgId() || getUserDataFromToken().orgId || "";
            const [funnelsRes, categoriesRes, companiesRes, contactsRes, productsRes, teamMembers] = await Promise.all([
                // Match the same endpoints used in the Leads list edit flow
                authenticatedFetch(buildExternalUrl("/crm/funnels?skip=0&limit=100"), { method: "GET" }),
                authenticatedFetch(buildExternalUrl("/crm/categories?skip=0&limit=100"), { method: "GET" }),
                authenticatedFetch(buildExternalUrl("/crm/companies?skip=0&limit=100"), { method: "GET" }),
                authenticatedFetch(buildExternalUrl("/crm/contacts?skip=0&limit=100"), { method: "GET" }),
                authenticatedFetch(buildExternalUrl("/crm/products?skip=0&limit=100"), { method: "GET" }),
                // Owners / assignees: same workspace roster as Community/Feeds
                orgIdForUsers
                    ? getTeamMembers(orgIdForUsers).catch(async () => {
                        const res = await authenticatedFetch(
                            buildExternalUrl(
                                `/crm/organization-users?organizationId=${orgIdForUsers}&limit=1000`
                            ),
                            { method: "GET" }
                        );
                        if (!res.ok) return [];
                        const data = await res.json();
                        return (
                            data?.users ||
                            data?.members ||
                            data?.data?.users ||
                            data?.data?.members ||
                            data?.data ||
                            []
                        );
                    })
                    : Promise.resolve([]),
            ]);

            if (funnelsRes.ok) {
                const funnelsData = await funnelsRes.json();
                funnels = funnelsData.funnels || funnelsData.data || funnelsData || [];
                setEditLeadFunnels(funnels);
            }
            if (categoriesRes.ok) {
                const categoriesData = await categoriesRes.json();
                setEditLeadCategories(categoriesData.categories || categoriesData.data || categoriesData || []);
            }
            if (companiesRes.ok) {
                const companiesData = await companiesRes.json();
                setEditLeadCompanies(companiesData.companies || companiesData.data || companiesData || []);
            }
            if (contactsRes.ok) {
                const contactsData = await contactsRes.json();
                setEditLeadContacts(contactsData.contacts || contactsData.data || contactsData || []);
            }
            if (productsRes.ok) {
                const productsData = await productsRes.json();
                setEditLeadProducts(productsData.products || productsData.data || productsData || []);
            }
            if (Array.isArray(teamMembers) && teamMembers.length > 0) {
                users = teamMembers.map((user: any) => {
                    const { _id, ...rest } = user;
                    const id = _id || user?.id || user?.userId || "";
                    return {
                        id,
                        ...rest,
                        name: getDirectoryUserName({ ...user, _id: id }),
                    };
                });

                setEditLeadUsers(users);
            }
        } catch (error) {
            console.error("Error fetching dropdown data:", error);
        } finally {
            setIsLoadingEditLeadDropdowns(false);
        }
        return { funnels, users };
    };

    // Handle Sales Funnel Change in Edit Dialog
    const handleEditLeadFunnelChange = async (funnelId: string, resetStage: boolean = true) => {
        if (resetStage) {
            setEditLeadForm((prev) => ({ ...prev, salesFunnelId: funnelId, stage: "" }));
        } else {
            setEditLeadForm((prev) => ({ ...prev, salesFunnelId: funnelId }));
        }
        setEditLeadFunnelStages([]);

        if (!funnelId) return;

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/funnels/${funnelId}`),
                { method: "GET" }
            );
            if (response.ok) {
                const funnelData = await response.json();
                const stages = funnelData.funnelStage || funnelData.stages || [];
                const stageNames = stages.map((s: any) => typeof s === 'string' ? s : (s.name || s.stage || ""));
                setEditLeadFunnelStages(stageNames.filter(Boolean));

                // If stage is not reset and current stage exists in available stages, preserve it
                if (!resetStage) {
                    const currentStage = editLeadForm.stage || lead?.stage || originalLeadData?.stage || "";
                    if (currentStage && stageNames.includes(currentStage)) {
                        setEditLeadForm((prev) => ({ ...prev, stage: currentStage }));
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching funnel stages:", error);
        }
    };

    // Handle Open Edit Lead Details
    const handleOpenEditLead = () => {
        if (!lead) return;

        setIsCustomSource(false);
        setCustomSourceValue("");

        const ld = originalLeadData;

        // Get current values
        const rawSalesFunnel = ld?.salesFunnel;
        const currentFunnelId =
            ld?.salesFunnelId ||
            ld?.funnel?.id ||
            ld?.funnel?._id ||
            (rawSalesFunnel && typeof rawSalesFunnel === "object"
                ? (rawSalesFunnel as any)._id || (rawSalesFunnel as any).id
                : typeof rawSalesFunnel === "string"
                    ? rawSalesFunnel
                    : "");
        const currentStage = ld?.stage || lead?.stage || "";

        // Get email and phone from contact details
        let contactEmail = "";
        let contactPhone = "";
        if (lead?.contacts && Array.isArray(lead.contacts) && lead.contacts.length > 0) {
            const primaryContact = lead.contacts.find((c: any) => c.isPrimary) || lead.contacts[0];
            contactEmail = primaryContact?.email || "";
            contactPhone = primaryContact?.phoneNumber || primaryContact?.phone || "";
        }
        const phoneCandidates = [
            ...(Array.isArray(ld?.phoneNumbers) ? ld.phoneNumbers : []),
            ld?.phone,
            ld?.mobile,
            contactPhone,
        ]
            .map((item) => String(item ?? "").trim())
            .filter(Boolean);
        const resolvedPhone = Array.from(new Set(phoneCandidates)).join(", ");

        // Extract contactId from multiple possible shapes (same as leads list)
        const contactSource = ld?.contact || (ld?.contacts && ld.contacts.length > 0 ? ld.contacts[0] : null);
        const contactId = ld?.contactId || ld?.contactIds?.[0] || contactSource?._id || contactSource?.id || contactSource?.contactId || "";

        // Extract companyId from multiple possible shapes
        const companySource = ld?.company || (ld?.companies && ld.companies.length > 0 ? ld.companies[0] : null);
        const companyId = ld?.companyId || companySource?._id || companySource?.id || companySource?.companyId || "";

        // Extract assignedTo ID (assignedTo can be string, array of IDs, or array of user objects)
        let assignedToId = "";
        if (typeof ld?.assignedTo === "string") {
            assignedToId = ld.assignedTo;
        } else if (Array.isArray(ld?.assignedTo) && ld.assignedTo.length > 0) {
            const first = ld.assignedTo[0];
            assignedToId = typeof first === "string" ? first : (first?._id || first?.id || first?.userId || "");
        }
        if (!assignedToId && ld?.assignedToUser) {
            assignedToId = ld.assignedToUser._id || ld.assignedToUser.id || ld.assignedToUser.userId || "";
        }
        if (!assignedToId && ld?.assignedUsers && ld.assignedUsers.length > 0) {
            const first = ld.assignedUsers[0];
            assignedToId = first?._id || first?.id || first?.userId || "";
        }
        if (!assignedToId && ld?.owner) {
            assignedToId = ld.owner._id || ld.owner.id || ld.owner.userId || "";
        }

        // Populate form with current lead data
        setEditLeadForm({
            leadName: ld?.leadName || lead.name?.replace(/\s+Deal$/, "") || "",
            email: contactEmail || "",
            phone: resolvedPhone || "",
            source: ld?.source || "",
            notes: extractFirstNoteText(ld?.notes) || "",
            estimatedValue: ld?.estimatedValue || ld?.negotiatedPricing || ld?.pricing || "0",
            priority: ld?.priority || "",
            nextFollowUp: ld?.nextFollowUp ? String(ld.nextFollowUp).split("T")[0] : "",
            estimatedClose: ld?.estimatedClose ? String(ld.estimatedClose).split("T")[0] : "",
            salesFunnelId: currentFunnelId,
            stage: currentStage,
            category: ld?.category || "",
            companyId: String(companyId || ""),
            contactId: String(contactId || ""),
            productId: ld?.productId || ld?.productIds?.[0] || "",
            quantity: String(ld?.quantity || 1),
            pricing: String(ld?.pricing || ld?.estimatedValue || "0"),
            negotiatedPricing: String(ld?.negotiatedPricing || ld?.pricing || "0"),
            maxDiscPrice: String(ld?.MaxDiscPrice || "0"),
            duration: String(ld?.duration || ""),
            assignedTo: String(assignedToId || ""),
            tags: Array.isArray(ld?.tags)
                ? ld.tags.join(", ")
                : Array.isArray(lead?.tags)
                    ? lead.tags.join(", ")
                    : (ld?.tags || lead?.tags || ""),
            autoFollowUp: isAutoFollowUpEnabled(ld?.autoFollowUp) || isAutoFollowUpEnabled(lead?.autoFollowUp),
            description: ld?.description || lead?.description || "",
        });

        setIsEditLeadOpen(true);

        // Seed stages from lead so Stage shows immediately while dropdowns load
        const existingStages = (lead?.funnelStages || [])
            .map((s: any) => (typeof s === "string" ? s : s?.name))
            .filter(Boolean);
        if (existingStages.length > 0) {
            setEditLeadFunnelStages(existingStages);
        }

        // Fetch dropdown data and merge lead's current contact/company/owner so they appear in selects
        fetchEditLeadDropdowns().then(({ funnels }) => {
            let resolvedFunnelId = String(currentFunnelId || "");
            const funnelNameHint = (
                (typeof ld?.salesFunnel === "object" && ((ld.salesFunnel as any)?.name || (ld.salesFunnel as any)?.funnelName)) ||
                (typeof ld?.salesFunnel === "string" ? ld.salesFunnel : "") ||
                ld?.funnel?.name ||
                ""
            ).toLowerCase();

            if (resolvedFunnelId) {
                const byId = funnels.find((f) => String(f._id) === resolvedFunnelId);
                if (!byId) {
                    const byName = funnels.find((f) => {
                        const name = ((f as any).name || (f as any).funnelName || "").toLowerCase();
                        return name && (name === resolvedFunnelId.toLowerCase() || name === funnelNameHint);
                    });
                    if (byName) {
                        resolvedFunnelId = byName._id;
                        setEditLeadForm((prev) => ({ ...prev, salesFunnelId: byName._id }));
                    }
                }
            } else if (funnelNameHint) {
                const byName = funnels.find((f) => {
                    const name = ((f as any).name || (f as any).funnelName || "").toLowerCase();
                    return name === funnelNameHint;
                });
                if (byName) {
                    resolvedFunnelId = byName._id;
                    setEditLeadForm((prev) => ({ ...prev, salesFunnelId: byName._id }));
                }
            }

            if (resolvedFunnelId) {
                handleEditLeadFunnelChange(resolvedFunnelId, false);
            }

            // Ensure lead's current contact is in the dropdown (may not be in first 100 from API)
            if (contactSource && contactId) {
                const cid = String(contactId);
                setEditLeadContacts((prev) => {
                    if (prev.some((c) => String((c as any)._id || (c as any).id) === cid)) return prev;
                    let firstName = contactSource.firstName || "";
                    let lastName = contactSource.lastName || "";
                    if (!firstName && !lastName && contactSource.name) {
                        const parts = String(contactSource.name).trim().split(/\s+/);
                        firstName = parts[0] || "";
                        lastName = parts.slice(1).join(" ") || "";
                    }
                    const entry = { _id: cid, id: cid, firstName, lastName, email: contactSource.email || "" };
                    return [entry, ...prev];
                });
            }

            // Ensure lead's current company is in the dropdown
            if (companySource && companyId) {
                const compId = String(companyId);
                setEditLeadCompanies((prev) => {
                    if (prev.some((c) => String(c._id || (c as any).id) === compId)) return prev;
                    return [
                        {
                            _id: compId,
                            id: compId,
                            companyName: companySource.companyName || companySource.name || "Unknown Company",
                            name: companySource.companyName || companySource.name || "Unknown Company",
                        } as any,
                        ...prev,
                    ];
                });
            }

            // Ensure lead's current owner is in the dropdown
            const ownerSource =
                (Array.isArray(ld?.assignedUsers) && ld.assignedUsers.length > 0 ? ld.assignedUsers[0] : null) ||
                (Array.isArray(ld?.assignedTo) && ld.assignedTo.length > 0 && typeof ld.assignedTo[0] === "object" ? ld.assignedTo[0] : null) ||
                ld?.assignedToUser ||
                ld?.owner;
            if (ownerSource && assignedToId) {
                const oid = String(assignedToId);
                setEditLeadUsers((prev) => {
                    if (prev.some((u) => String(u.id || (u as any)._id) === oid)) return prev;
                    const name =
                        ownerSource.name ||
                        [ownerSource.firstName, ownerSource.lastName].filter(Boolean).join(" ") ||
                        ownerSource.email ||
                        "Unknown";
                    return [{ id: oid, _id: oid, name, email: ownerSource.email || "" } as any, ...prev];
                });
            }
        });
    };

    // Handle Edit Lead Profile (Sales Funnel, Stage, Source, Owner)
    const handleEditLeadProfile = async () => {
        setIsSubmittingEditLead(true);
        const loadingToast = toast.loading("Updating lead...");

        try {
            const updateData: any = {
                salesFunnel: editLeadForm.salesFunnelId || undefined,
                stage: editLeadForm.stage || undefined,
                source: editLeadForm.source || undefined,
                assignedTo: editLeadForm.assignedTo || undefined,
                description: editLeadForm.description || undefined,
            };

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(updateData),
                }
            );

            if (response.ok) {
                toast.success("Lead updated successfully!", { id: loadingToast });
                setIsEditLeadOpen(false);
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    { method: "GET", headers: { "Content-Type": "application/json" } }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    setLead(transformLeadData(leadData));
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to update lead", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error updating lead:", error);
            toast.error("Failed to update lead. Please try again.", { id: loadingToast });
        } finally {
            setIsSubmittingEditLead(false);
        }
    };

    // Handle Delete Lead
    const handleDeleteLead = () => {
        setIsDeleteLeadOpen(true);
    };

    // Handle Confirm Delete Lead
    const handleConfirmDeleteLead = async () => {
        if (!lead || !leadId) {
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
                // Redirect to leads list page
                if (typeof window !== "undefined" && isInlineDealsMode) {
                    window.dispatchEvent(new CustomEvent("deals:inline-back-to-leads"));
                } else {
                    router.push("/deals/leads");
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

    // Handle Add New Contact
    const handleAddNewContact = async () => {
        // Validate required fields
        const isNameValid = validateNewContactName(newContactForm.name);
        const isEmailValid = validateNewContactEmail(newContactForm.email);

        if (!isNameValid || !isEmailValid) {
            toast.error("Please fill in all required fields correctly");
            return;
        }

        setIsSubmittingNewContact(true);
        const loadingToast = toast.loading("Creating contact...");

        try {
            // Split name into firstName and lastName
            const nameParts = newContactForm.name.trim().split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            const contactData: any = {
                firstName,
                lastName,
                email: newContactForm.email,
                phoneNumber: newContactForm.phone,
                role: newContactForm.role || undefined,
                companyId: newContactForm.company || undefined,
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

            const result = await response.json().catch(() => ({}));
            toast.success("Contact created successfully!", { id: loadingToast });

            // Reset form
            setNewContactForm({
                name: "",
                email: "",
                company: "",
                role: "",
                phone: "",
            });
            setNewContactNameError("");
            setNewContactEmailError("");
            setIsAddNewContactOpen(false);

            // Refresh contacts list
            await fetchAllContacts();

            // Optionally auto-select the newly created contact
            if (result._id || result.id) {
                const newContactId = result._id || result.id;
                setSelectedContactIds(prev => [...prev, newContactId]);
            }
        } catch (error) {
            console.error("Error creating contact:", error);
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to create contact. Please try again.";
            toast.error(message, { id: loadingToast });
        } finally {
            setIsSubmittingNewContact(false);
        }
    };

    // Handle Toggle Contact Selection
    const handleToggleContactSelection = (contactId: string) => {
        setSelectedContactIds(prev => {
            if (prev.includes(contactId)) {
                return prev.filter(id => id !== contactId);
            } else {
                return [...prev, contactId];
            }
        });
    };

    // Handle Add Selected Contacts
    const handleAddSelectedContacts = async () => {
        if (selectedContactIds.length === 0) {
            toast.error("Please select at least one contact");
            return;
        }

        setIsAddingContacts(true);
        const loadingToast = toast.loading("Adding contacts...");

        try {
            // Get contact IDs from selected contacts
            const contactIdsToAdd = selectedContactIds.filter(contactId => {
                // Verify contact exists
                return allContacts.some(contact =>
                    (contact._id || contact.id) === contactId
                );
            });

            if (contactIdsToAdd.length === 0) {
                toast.error("No valid contacts selected", { id: loadingToast });
                return;
            }

            // Format addContactId: string if single, array if multiple
            const addContactId = contactIdsToAdd.length === 1
                ? contactIdsToAdd[0]
                : contactIdsToAdd;

            // Update lead with addContactId
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        addContactId: addContactId,
                    }),
                }
            );

            if (response.ok) {
                toast.success(`${contactIdsToAdd.length} contact(s) added successfully!`, { id: loadingToast });

                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                // Refresh the page
                router.refresh();
                setIsAddContactOpen(false);
                setSelectedContactIds([]);
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to add contacts", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error adding contacts:", error);
            toast.error("Failed to add contacts. Please try again.", { id: loadingToast });
        } finally {
            setIsAddingContacts(false);
        }
    };

    // Handle Set Primary Contact
    const handleSetPrimaryContact = async (contactId: string) => {
        if (!contactId) {
            toast.error("Contact ID is required");
            return;
        }

        const loadingToast = toast.loading("Setting primary contact...");

        try {
            // Get all contact IDs from the lead
            let allContactIds: string[] = [];

            // First, try to get from originalLeadData.contactIds (if it's an array)
            if (originalLeadData?.contactIds && Array.isArray(originalLeadData.contactIds)) {
                allContactIds = originalLeadData.contactIds.filter((id: any) => id && String(id).trim() !== "");
            }
            // Otherwise, extract from contacts array
            else if (originalLeadData?.contacts && Array.isArray(originalLeadData.contacts)) {
                allContactIds = originalLeadData.contacts
                    .map((contact: any) => contact._id || contact.id || contact.contactId)
                    .filter((id: any) => id && String(id).trim() !== "");
            }
            // Fallback: extract from transformed lead.contacts
            else if (lead?.contacts && Array.isArray(lead.contacts)) {
                allContactIds = lead.contacts
                    .map((contact: any) => contact.id || contact._id || contact.contactId)
                    .filter((id: any) => id && String(id).trim() !== "");
            }

            // Remove the selected contact ID from the array (if it exists)
            allContactIds = allContactIds.filter((id: string) => String(id) !== String(contactId));

            // Put the selected contact ID at the beginning
            const reorderedContactIds = [contactId, ...allContactIds];

            // Update lead with reordered contactIds array
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contactIds: reorderedContactIds, // Send reordered array with primary contact first
                    }),
                }
            );

            if (response.ok) {
                toast.success("Primary contact updated successfully!", { id: loadingToast });

                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                router.refresh();
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to update primary contact", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error setting primary contact:", error);
            toast.error("Failed to update primary contact. Please try again.", { id: loadingToast });
        }
    };

    // Handle Delete Contact
    const [contactToDelete, setContactToDelete] = useState<string | null>(null);
    const [isDeleteContactOpen, setIsDeleteContactOpen] = useState(false);
    const [isDeletingContact, setIsDeletingContact] = useState(false);

    const handleDeleteContact = (contactId: string) => {
        setContactToDelete(contactId);
        setIsDeleteContactOpen(true);
    };

    const handleOpenEditContact = (contact: any, contactId: string) => {
        if (!contactId) {
            toast.error("Contact ID is required");
            return;
        }

        fetchNewContactCompanies();

        const rawContacts = Array.isArray(originalLeadData?.contacts) ? originalLeadData.contacts : [];
        const matchedContact = rawContacts.find((c: any) => {
            const rawId = String(c?._id || c?.id || c?.contactId || "");
            if (rawId && rawId === String(contactId)) return true;

            const cEmail = (c?.email || "").toString().trim().toLowerCase();
            const cardEmail = (contact?.email || "").toString().trim().toLowerCase();
            if (cEmail && cardEmail && cEmail === cardEmail) return true;

            const cPhone = (c?.phoneNumber || c?.phone || "").toString().trim();
            const cardPhone = (contact?.phone || "").toString().trim();
            return Boolean(cPhone && cardPhone && cPhone === cardPhone);
        }) || {};

        const firstName = (matchedContact?.firstName ?? matchedContact?.first_name ?? "").toString().trim();
        const lastName = (matchedContact?.lastName ?? matchedContact?.last_name ?? "").toString().trim();
        const fallbackName = (contact?.name ?? matchedContact?.name ?? "").toString().trim();
        const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || fallbackName;

        const companyId = (
            matchedContact?.companyId ||
            matchedContact?.company?._id ||
            matchedContact?.company?.id ||
            ""
        ).toString();

        setEditingContactId(String(contactId));
        setEditContactForm({
            name: fullName,
            email: (matchedContact?.email ?? contact?.email ?? "").toString(),
            company: companyId,
            role: (matchedContact?.role ?? matchedContact?.title ?? contact?.title ?? "").toString().replace("N/A", ""),
            phone: (matchedContact?.phoneNumber ?? matchedContact?.phone ?? contact?.phone ?? "").toString(),
        });
        setEditContactNameError("");
        setEditContactEmailError("");
        setIsEditContactOpen(true);
    };

    const handleSaveEditedContact = async () => {
        if (!editingContactId) {
            toast.error("Contact ID is required");
            return;
        }

        const isNameValid = validateEditContactName(editContactForm.name);
        const isEmailValid = validateEditContactEmail(editContactForm.email);
        if (!isNameValid || !isEmailValid) {
            toast.error("Please fill in all required fields correctly");
            return;
        }

        setIsSubmittingEditContact(true);
        const loadingToast = toast.loading("Updating contact...");

        try {
            const nameParts = editContactForm.name.trim().split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            const payload: any = {
                firstName,
                lastName,
                email: editContactForm.email,
                phoneNumber: editContactForm.phone,
                role: editContactForm.role || undefined,
                companyId: editContactForm.company || undefined,
            };

            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/contacts/${editingContactId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!response.ok) {
                let errorMessage = "Failed to update contact";
                try {
                    const errorData = await response.json();
                    errorMessage = extractErrorMessage(errorData, errorMessage);
                } catch {
                    const text = await response.text().catch(() => "");
                    if (text) errorMessage = text;
                }
                throw new Error(errorMessage);
            }

            toast.success("Contact updated successfully!", { id: loadingToast });
            setIsEditContactOpen(false);
            setEditingContactId("");
            setEditContactForm({
                name: "",
                email: "",
                company: "",
                role: "",
                phone: "",
            });
            setEditContactNameError("");
            setEditContactEmailError("");
            await fetchAllContacts();

            const fetchResponse = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            if (fetchResponse.ok) {
                const data = await fetchResponse.json();
                const leadData = data.lead || data.data || data;
                setOriginalLeadData(leadData);
                const transformedLead = transformLeadData(leadData);
                setLead(transformedLead);
            }
            router.refresh();
        } catch (error) {
            console.error("Error updating contact:", error);
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to update contact. Please try again.";
            toast.error(message, { id: loadingToast });
        } finally {
            setIsSubmittingEditContact(false);
        }
    };

    const handleConfirmDeleteContact = async () => {
        if (!contactToDelete || !leadId) {
            toast.error("Contact ID is required");
            return;
        }

        setIsDeletingContact(true);
        const loadingToast = toast.loading("Removing contact...");

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}`),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        removeContactId: contactToDelete,
                    }),
                }
            );

            if (response.ok) {
                toast.success("Contact removed successfully!", { id: loadingToast });
                setIsDeleteContactOpen(false);
                setContactToDelete(null);

                // Refetch lead details to get updated data
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    setOriginalLeadData(leadData);
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
                router.refresh();
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to remove contact", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error removing contact:", error);
            toast.error("Failed to remove contact. Please try again.", { id: loadingToast });
        } finally {
            setIsDeletingContact(false);
        }
    };

    // Handle Delete Document
    const handleDeleteDocument = async (documentId: string) => {
        if (!documentId) return;

        setIsDeletingDocument(true);
        const loadingToast = toast.loading("Deleting document...");

        try {
            const response = await authenticatedFetch(
                buildExternalUrl(`/crm/leads/${leadId}/documents/${documentId}`),
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.ok) {
                toast.success("Document deleted successfully!", { id: loadingToast });
                // Refresh the page to show updated files
                router.refresh();
                // Refetch lead details
                const fetchResponse = await authenticatedFetch(
                    buildExternalUrl(`/crm/leads/${leadId}`),
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    const leadData = data.lead || data.data || data;
                    const transformedLead = transformLeadData(leadData);
                    setLead(transformedLead);
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                toast.error(errorData.message || "Failed to delete document", { id: loadingToast });
            }
        } catch (error) {
            console.error("Error deleting document:", error);
            toast.error("Failed to delete document. Please try again.", { id: loadingToast });
        } finally {
            setIsDeletingDocument(false);
            setDocumentToDelete(null);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority.toLowerCase()) {
            case "high priority":
                return "bg-red-100 text-red-800";
            case "medium priority":
                return "bg-yellow-100 text-yellow-800";
            case "low priority":
                return "bg-green-100 text-green-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const getStageColor = (stage: string) => {
        switch (stage.toLowerCase()) {
            case "proposal":
                return "bg-purple-100 text-purple-800";
            case "qualified":
                return "bg-yellow-100 text-yellow-800";
            case "negotiation":
                return "bg-orange-100 text-orange-800";
            case "prospects":
                return "bg-blue-100 text-blue-800";
            case "discovery":
                return "bg-green-100 text-green-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen overflow-hidden" style={{ background: "#181818" }}>
                <div className="flex-1 overflow-hidden flex flex-col">
                    <main className="flex-1 overflow-y-auto">
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--brand)" }}></div>
                                <p style={{ color: "#9a9a9a" }}>Loading lead details...</p>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    if (!lead) {
        return (
            <div className="flex h-screen overflow-hidden" style={{ background: "#181818" }}>
                <div className="flex-1 overflow-hidden flex flex-col">
                    <main className="flex-1 overflow-y-auto">
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <p style={{ color: "#9a9a9a" }}>Lead not found</p>
                                <Button onClick={navigateBackToLeads} className="mt-4" style={{ background: "var(--brand)", color: "#000" }}>
                                    Go Back
                                </Button>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden min-w-0" style={{ background: "#181818" }}>
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <DealsNavbar />

                <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
                    <LeadDetailFigmaView
                        lead={lead}
                        tags={tags}
                        products={products}
                        funnelStages={lead.funnelStages || []}
                        displayLeadName={displayLeadName}
                        displayEmail={displayEmail}
                        displayPhone={displayPhone}
                        funnelDisplayName={funnelDisplayName}
                        dateAddedLabel={dateAddedLabel}
                        lastActivityLabel={lastActivityLabel}
                        ownerName={lead.owner || lead.ownerName || "—"}
                        company={companyDisplay}
                        hasCompany={hasCompanyForLead}
                        timelineItems={timelineItems}
                        activityTab={activityTab}
                        onActivityTabChange={setActivityTab}
                        taskForm={taskForm}
                        onTaskFormChange={setTaskForm}
                        inlineFollowupForm={inlineFollowupForm}
                        onInlineFollowupFormChange={setInlineFollowupForm}
                        editLeadUsers={editLeadUsers}
                        isSubmittingTask={isSubmittingTask}
                        isSubmittingFollowUp={isSubmittingFollowUp}
                        isSubmittingAutoFollowUp={isSubmittingAutoFollowUp}
                        onStageChange={handleStageChange}
                        onEditLead={handleOpenEditLead}
                        onAddProduct={handleOpenAddProduct}
                        onEditProducts={handleOpenAddProduct}
                        onCreateTask={handleCreateTask}
                        onInlineAddFollowup={handleInlineAddFollowup}
                        onToggleTaskStatus={handleToggleTaskStatus}
                        onEditTask={handleEditTask}
                        onDeleteTask={handleDeleteTask}
                        onAddContact={handleOpenAddContact}
                        onOpenWhatsApp={handleOpenWhatsApp}
                        onOpenGmail={handleOpenGmail}
                        onEditCompany={handleOpenEditCompany}
                        onAddCompany={() => setIsAddCompanyForLeadOpen(true)}
                        onAttachFile={handleAttachFileClick}
                        onDeleteDocument={handleDeleteDocument}
                        onRemoveTag={handleRemoveTag}
                    />
                </main>
            </div>

            {/* Add Note Dialog */}
            <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Add Note</DialogTitle>
                        <DialogDescription>
                            Add a note to track important information about this lead.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">

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
                                setNoteForm({
                                    description: "",
                                });
                            }}
                            disabled={isSubmittingNote}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddNote}
                            disabled={isSubmittingNote}
                            className={`${theme === "color"
                                ? "bg-[#0ff] hover:bg-[#00e6e6] text-[#0a0e27]"
                                : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                                }`}
                        >
                            {isSubmittingNote ? "Adding..." : "Add Note"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Log Activity Dialog */}
            <Dialog open={isLogActivityOpen} onOpenChange={setIsLogActivityOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Log Activity</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="activity-title">Title *</Label>
                            <Input
                                id="activity-title"
                                placeholder="Enter activity title"
                                value={activityForm.title}
                                onChange={(e) =>
                                    setActivityForm({ ...activityForm, title: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="activity-description">Description *</Label>
                            <Textarea
                                id="activity-description"
                                placeholder="Enter activity description"
                                value={activityForm.description}
                                onChange={(e) =>
                                    setActivityForm({ ...activityForm, description: e.target.value })
                                }
                                rows={4}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="activity-type">Type *</Label>
                            <Select
                                value={activityForm.type}
                                onValueChange={(value) =>
                                    setActivityForm({ ...activityForm, type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select activity type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="call">Call</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="meeting">Meeting</SelectItem>
                                    <SelectItem value="note">Note</SelectItem>
                                    <SelectItem value="stage">Stage</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsLogActivityOpen(false);
                                setActivityForm({
                                    title: "",
                                    description: "",
                                    type: "note",
                                    stage: "",
                                });
                            }}
                            disabled={isSubmittingActivity}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleLogActivity}
                            disabled={isSubmittingActivity}
                            className={`${theme === "color"
                                ? "bg-[#0ff] hover:bg-[#00e6e6] text-[#0a0e27]"
                                : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                                }`}
                        >
                            {isSubmittingActivity ? "Saving..." : "Log Activity"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Preview Dialog */}
            <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
                <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-0">
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white"
                            onClick={() => {
                                setIsImagePreviewOpen(false);
                                setPreviewImageUrl("");
                            }}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                        <img
                            src={previewImageUrl}
                            alt="Preview"
                            className="w-full h-auto max-h-[90vh] object-contain"
                            onClick={() => window.open(previewImageUrl, "_blank")}
                            style={{ cursor: "pointer" }}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Task Confirmation Dialog */}
            <Dialog open={taskToDelete !== null} onOpenChange={(open) => !open && setTaskToDelete(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete Task</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-gray-600">
                            Are you sure you want to delete this task? This action cannot be undone.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setTaskToDelete(null)}
                            disabled={isDeletingTask}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => taskToDelete && handleDeleteTask(taskToDelete)}
                            disabled={isDeletingTask}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeletingTask ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Document Confirmation Dialog */}
            <Dialog open={documentToDelete !== null} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete Document</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-gray-600">
                            Are you sure you want to delete this document? This action cannot be undone.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDocumentToDelete(null)}
                            disabled={isDeletingDocument}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => documentToDelete && handleDeleteDocument(documentToDelete)}
                            disabled={isDeletingDocument}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeletingDocument ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Product Confirmation Dialog */}
            <Dialog open={productToDelete !== null} onOpenChange={(open) => !open && setProductToDelete(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete Product</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-gray-600">
                            Are you sure you want to delete this product from the lead? This action cannot be undone.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setProductToDelete(null)}
                            disabled={isDeletingProduct}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => productToDelete && handleDeleteProduct(productToDelete)}
                            disabled={isDeletingProduct}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeletingProduct ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AddContactDialog
                open={isAddContactOpen}
                onOpenChange={(open) => {
                    setIsAddContactOpen(open);
                    if (!open) {
                        setSelectedContactIds([]);
                        setContactSearchQuery("");
                    }
                }}
                contacts={allContacts.map((contact) => ({
                    id: contact._id || contact.id,
                    name: getContactDisplayName(contact) || "Unknown Contact",
                    email: contact.email || undefined,
                    phone: contact.phoneNumber || contact.phone || undefined,
                }))}
                selectedIds={selectedContactIds}
                searchQuery={contactSearchQuery}
                onSearchChange={setContactSearchQuery}
                onToggleContact={handleToggleContactSelection}
                onSave={handleAddSelectedContacts}
                isLoading={isLoadingContacts}
                isSubmitting={isAddingContacts}
            />

            {/* Add New Contact Dialog */}
            <Dialog open={isAddNewContactOpen} onOpenChange={setIsAddNewContactOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Add New Contact</DialogTitle>
                        <DialogDescription>
                            Add a new contact person to your CRM database.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Left Column */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-contact-name">
                                        Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="new-contact-name"
                                        placeholder="Full name"
                                        value={newContactForm.name}
                                        onChange={(e) => {
                                            setNewContactForm({ ...newContactForm, name: e.target.value });
                                            if (newContactNameError) setNewContactNameError("");
                                        }}
                                        className={newContactNameError ? "border-red-500" : ""}
                                    />
                                    {newContactNameError && (
                                        <p className="text-sm text-red-500">{newContactNameError}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="new-contact-email">
                                        Email <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="new-contact-email"
                                        type="email"
                                        placeholder="email@company.com"
                                        value={newContactForm.email}
                                        onChange={(e) => {
                                            setNewContactForm({ ...newContactForm, email: e.target.value });
                                            if (newContactEmailError) setNewContactEmailError("");
                                        }}
                                        className={newContactEmailError ? "border-red-500" : ""}
                                    />
                                    {newContactEmailError && (
                                        <p className="text-sm text-red-500">{newContactEmailError}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="new-contact-company">Company</Label>
                                    <Select
                                        value={newContactForm.company || undefined}
                                        onValueChange={(value) => {
                                            if (value === "__add_new_company__") {
                                                // Open the \"Add New Company\" dialog and keep current selection
                                                setIsAddCompanyForContactOpen(true);
                                                return;
                                            }
                                            setNewContactForm((prev) => ({ ...prev, company: value }));
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder={
                                                    loadingNewContactCompanies
                                                        ? "Loading companies..."
                                                        : "Company name"
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {loadingNewContactCompanies ? (
                                                <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                                                    Loading companies...
                                                </div>
                                            ) : newContactCompanies.length > 0 ? (
                                                <>
                                                    <SelectItem
                                                        value="__add_new_company__"
                                                        className="text-blue-600 dark:text-blue-300 font-medium focus:bg-blue-50 dark:focus:bg-blue-950 data-[highlighted]:bg-blue-50 dark:data-[highlighted]:bg-blue-950"
                                                    >
                                                        + Add New Company
                                                    </SelectItem>
                                                    <div className="border-t border-gray-200 my-1" />
                                                    {newContactCompanies
                                                        .filter(
                                                            (company) => company._id && company._id !== ""
                                                        )
                                                        .map((company) => (
                                                            <SelectItem key={company._id} value={company._id}>
                                                                {company.name}
                                                            </SelectItem>
                                                        ))}
                                                </>
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
                                    <Label htmlFor="new-contact-role">Role</Label>
                                    <Select
                                        value={newContactForm.role}
                                        onValueChange={(value) =>
                                            setNewContactForm({ ...newContactForm, role: value })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CEO">CEO</SelectItem>
                                            <SelectItem value="CTO">CTO</SelectItem>
                                            <SelectItem value="VP of Sales">VP of Sales</SelectItem>
                                            <SelectItem value="IT Director">IT Director</SelectItem>
                                            <SelectItem value="Founder">Founder</SelectItem>
                                            <SelectItem value="Manager">Manager</SelectItem>
                                            <SelectItem value="Director">Director</SelectItem>
                                            <SelectItem value="Executive">Executive</SelectItem>
                                            <SelectItem value="Associate">Associate</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="new-contact-phone">Phone</Label>
                                    <Input
                                        id="new-contact-phone"
                                        type="tel"
                                        placeholder="Phone number"
                                        value={newContactForm.phone}
                                        onChange={(e) =>
                                            setNewContactForm({ ...newContactForm, phone: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsAddNewContactOpen(false);
                                    setNewContactForm({
                                        name: "",
                                        email: "",
                                        company: "",
                                        role: "",
                                        phone: "",
                                    });
                                    setNewContactNameError("");
                                    setNewContactEmailError("");
                                }}
                                disabled={isSubmittingNewContact}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddNewContact}
                                disabled={isSubmittingNewContact}
                                className="bg-[#7b68ee] hover:bg-[#6a5acd] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmittingNewContact ? "Adding..." : "Add Contact"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Contact Dialog */}
            <Dialog open={isEditContactOpen} onOpenChange={setIsEditContactOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Contact</DialogTitle>
                        <DialogDescription>
                            Update this contact&apos;s details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-contact-name">
                                        Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="edit-contact-name"
                                        placeholder="Full name"
                                        value={editContactForm.name}
                                        onChange={(e) => {
                                            setEditContactForm({ ...editContactForm, name: e.target.value });
                                            if (editContactNameError) setEditContactNameError("");
                                        }}
                                        className={editContactNameError ? "border-red-500" : ""}
                                    />
                                    {editContactNameError && (
                                        <p className="text-sm text-red-500">{editContactNameError}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-contact-email">
                                        Email <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="edit-contact-email"
                                        type="email"
                                        placeholder="email@company.com"
                                        value={editContactForm.email}
                                        onChange={(e) => {
                                            setEditContactForm({ ...editContactForm, email: e.target.value });
                                            if (editContactEmailError) setEditContactEmailError("");
                                        }}
                                        className={editContactEmailError ? "border-red-500" : ""}
                                    />
                                    {editContactEmailError && (
                                        <p className="text-sm text-red-500">{editContactEmailError}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-contact-company">Company</Label>
                                    <Select
                                        value={editContactForm.company || undefined}
                                        onValueChange={(value) =>
                                            setEditContactForm((prev) => ({ ...prev, company: value }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder={
                                                    loadingNewContactCompanies
                                                        ? "Loading companies..."
                                                        : "Company name"
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {loadingNewContactCompanies ? (
                                                <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                                                    Loading companies...
                                                </div>
                                            ) : newContactCompanies.length > 0 ? (
                                                newContactCompanies
                                                    .filter((company) => company._id && company._id !== "")
                                                    .map((company) => (
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

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-contact-role">Role</Label>
                                    <Select
                                        value={editContactForm.role || undefined}
                                        onValueChange={(value) =>
                                            setEditContactForm({ ...editContactForm, role: value })
                                        }
                                    >
                                        <SelectTrigger id="edit-contact-role">
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CEO">CEO</SelectItem>
                                            <SelectItem value="CTO">CTO</SelectItem>
                                            <SelectItem value="VP of Sales">VP of Sales</SelectItem>
                                            <SelectItem value="IT Director">IT Director</SelectItem>
                                            <SelectItem value="Founder">Founder</SelectItem>
                                            <SelectItem value="Manager">Manager</SelectItem>
                                            <SelectItem value="Director">Director</SelectItem>
                                            <SelectItem value="Executive">Executive</SelectItem>
                                            <SelectItem value="Associate">Associate</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-contact-phone">Phone</Label>
                                    <Input
                                        id="edit-contact-phone"
                                        type="tel"
                                        placeholder="Phone number"
                                        value={editContactForm.phone}
                                        onChange={(e) =>
                                            setEditContactForm({ ...editContactForm, phone: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsEditContactOpen(false);
                                    setEditingContactId("");
                                    setEditContactForm({
                                        name: "",
                                        email: "",
                                        company: "",
                                        role: "",
                                        phone: "",
                                    });
                                    setEditContactNameError("");
                                    setEditContactEmailError("");
                                }}
                                disabled={isSubmittingEditContact}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveEditedContact}
                                disabled={isSubmittingEditContact}
                                className="bg-[#7b68ee] hover:bg-[#6a5acd] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmittingEditContact ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AddProductDialog
                open={isAddProductOpen}
                onOpenChange={(open) => {
                    setIsAddProductOpen(open);
                    if (!open) {
                        setProductToEdit(null);
                        setProductForm({
                            productId: "",
                            quantity: "1",
                        });
                        setProductSelections([]);
                        setProductSearchQuery("");
                    }
                }}
                products={products
                    .map((product) => {
                        const productId = product._id || product.id;
                        if (!productId) return null;

                        let price = 0;
                        if (typeof product.pricing === "number") {
                            price = product.pricing;
                        } else if (product.pricing) {
                            const pricingStr = product.pricing.toString();
                            const numericMatch = pricingStr.match(/^(\d+(?:\.\d+)?)/);
                            if (numericMatch) {
                                price = parseFloat(numericMatch[1]);
                            } else {
                                price = parseFloat(pricingStr) || 0;
                            }
                        } else if (product.price) {
                            price =
                                typeof product.price === "number"
                                    ? product.price
                                    : parseFloat(product.price.toString()) || 0;
                        }

                        const unit = product.unit || "";
                        const productName =
                            product.name || product.productName || "Unknown Product";
                        const pricingLabel = unit
                            ? `₹${price.toLocaleString()}/${unit}`
                            : `₹${price.toLocaleString()}`;

                        return {
                            id: productId,
                            name: productName,
                            pricingLabel,
                        };
                    })
                    .filter(Boolean) as Array<{
                    id: string;
                    name: string;
                    pricingLabel: string;
                }>}
                selections={productSelections}
                searchQuery={productSearchQuery}
                onSearchChange={setProductSearchQuery}
                onToggleProduct={handleToggleProductSelection}
                onQuantityChange={handleProductQuantityChange}
                onSave={handleAddProduct}
                isEdit={!!productToEdit}
                isLoading={isLoadingProducts}
                isSubmitting={isSubmittingProduct}
            />

            {/* Edit Company Dialog */}
            <Dialog open={isEditCompanyOpen} onOpenChange={setIsEditCompanyOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Company Details</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="company-name">
                                Company Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="company-name"
                                placeholder="Enter company name"
                                value={companyForm.name}
                                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                                disabled={isUpdatingCompany}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company-industry">Industry</Label>
                            <Input
                                id="company-industry"
                                placeholder="Enter industry"
                                value={companyForm.industry}
                                onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                                disabled={isUpdatingCompany}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company-size">Company Size</Label>
                            <Select
                                value={companyForm.size}
                                onValueChange={(value) => setCompanyForm({ ...companyForm, size: value })}
                                disabled={isUpdatingCompany}
                            >
                                <SelectTrigger
                                    id="company-size"
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg"
                                    style={{ boxShadow: "none" }}
                                >
                                    <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border border-gray-200 rounded-lg shadow-lg">
                                    {COMPANY_SIZE_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company-revenue">Revenue</Label>
                            <Input
                                id="company-revenue"
                                placeholder="e.g., ₹1Cr - ₹10Cr"
                                value={companyForm.revenue}
                                onChange={(e) => setCompanyForm({ ...companyForm, revenue: e.target.value })}
                                disabled={isUpdatingCompany}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company-city">City</Label>
                            <Input
                                id="company-city"
                                placeholder="Enter city"
                                value={companyForm.city}
                                onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                                disabled={isUpdatingCompany}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company-state">State</Label>
                            <Input
                                id="company-state"
                                placeholder="Enter state"
                                value={companyForm.state}
                                onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                                disabled={isUpdatingCompany}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company-country">Country</Label>
                            <Input
                                id="company-country"
                                placeholder="Enter country"
                                value={companyForm.country}
                                onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                                disabled={isUpdatingCompany}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company-website">Website</Label>
                            <Input
                                id="company-website"
                                placeholder="https://example.com"
                                value={companyForm.website}
                                onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                                disabled={isUpdatingCompany}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsEditCompanyOpen(false)}
                            disabled={isUpdatingCompany}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveCompany}
                            disabled={isUpdatingCompany}
                            className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUpdatingCompany ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create/Edit Task Dialog */}
            <Dialog open={isTaskModalOpen} onOpenChange={(open) => {
                if (!open) {
                    setTaskForm({
                        title: "",
                        description: "",
                        dueDate: "",
                        priority: "medium",
                        assignedTo: "",
                    });
                    setTaskToEdit(null);
                }
                setIsTaskModalOpen(open);
            }}>
                <DialogContent className="sm:max-w-[500px]" aria-describedby={taskToEdit ? "edit-task-desc" : "create-task-desc"}>
                    <DialogHeader>
                        <DialogTitle>{taskToEdit ? "Edit Task" : "Create Task"}</DialogTitle>
                        <DialogDescription id={taskToEdit ? "edit-task-desc" : "create-task-desc"}>
                            {taskToEdit ? "Update task title, description, due date, priority, and assignee." : "Create a new task for this lead."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-title">Title *</Label>
                            <Input
                                id="task-title"
                                placeholder="Enter task title"
                                value={taskForm.title}
                                onChange={(e) =>
                                    setTaskForm({ ...taskForm, title: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-description">Description *</Label>
                            <Textarea
                                id="task-description"
                                placeholder="Enter task description"
                                value={taskForm.description}
                                onChange={(e) =>
                                    setTaskForm({ ...taskForm, description: e.target.value })
                                }
                                rows={4}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-due-date">Due Date & Time *</Label>
                            <Popover open={isTaskDateTimeOpen} onOpenChange={setIsTaskDateTimeOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="task-due-date"
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal"
                                    >
                                        {formatTaskDateTimeLabel()}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" align="start">
                                    <div className="space-y-3">
                                        <DatePickerCalendar
                                            mode="single"
                                            selected={getTaskSelectedDate()}
                                            disabled={{ before: getTodayDate() }}
                                            onSelect={(selectedDate) => {
                                                if (!selectedDate) return;
                                                const y = selectedDate.getFullYear();
                                                const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
                                                const d = String(selectedDate.getDate()).padStart(2, "0");
                                                const newDate = `${y}-${m}-${d}`;
                                                if (isDateToday(newDate) && getTaskSelectedTime() && isTimePast(getTaskSelectedTime())) {
                                                    setTaskForm({ ...taskForm, dueDate: newDate });
                                                } else {
                                                    setTaskDatePart(newDate);
                                                }
                                            }}
                                            initialFocus
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="task-time-inline">Time</Label>
                                            <Input
                                                id="task-time-inline"
                                                type="time"
                                                value={getTaskSelectedTime()}
                                                min={isDateToday(getTaskSelectedDate()) ? getCurrentTimeString() : undefined}
                                                onChange={(e) => {
                                                    const newTime = e.target.value;
                                                    if (isDateToday(getTaskSelectedDate()) && isTimePast(newTime)) return;
                                                    setTaskTimePart(newTime);
                                                }}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => setIsTaskDateTimeOpen(false)}
                                            >
                                                Apply
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-priority">Priority *</Label>
                            <Select
                                value={taskForm.priority}
                                onValueChange={(value) =>
                                    setTaskForm({ ...taskForm, priority: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-assignee">Assignee</Label>
                            <Select
                                value={taskForm.assignedTo ?? ""}
                                onValueChange={(value) => {
                                    console.log("Selected Assignee ID in Edit Task:", value);
                                    setTaskForm({ ...taskForm, assignedTo: value });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select assignee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {editLeadUsers.length > 0 ? (
                                        editLeadUsers.map((user: any) => {
                                            const userId = String(user._id || user.id || user.userId || "");
                                            const userName = user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Unknown";
                                            if (!userId) return null;
                                            return (
                                                <SelectItem key={userId} value={userId}>
                                                    {userName}{user.email ? ` (${user.email})` : ""}
                                                </SelectItem>
                                            );
                                        })
                                    ) : (
                                        <div className="py-3 text-center text-sm text-muted-foreground">Loading members...</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsTaskModalOpen(false);
                                setTaskForm({
                                    title: "",
                                    description: "",
                                    dueDate: "",
                                    priority: "medium",
                                    assignedTo: "",
                                });
                                setTaskToEdit(null);
                            }}
                            disabled={isSubmittingTask}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateTask}
                            disabled={isSubmittingTask}
                            className={`${theme === "color"
                                ? "bg-[#0ff] hover:bg-[#00e6e6] text-[#0a0e27]"
                                : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                                }`}
                        >
                            {isSubmittingTask
                                ? (taskToEdit ? "Updating..." : "Creating...")
                                : (taskToEdit ? "Update Task" : "Create Task")
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AddCompanyDialog
                open={isAddCompanyForContactOpen}
                onOpenChange={(open) => {
                    setIsAddCompanyForContactOpen(open);
                    if (!open) {
                        setNewCompanyForContactForm({
                            name: "",
                            industry: "",
                            revenue: "",
                            website: "",
                        });
                    }
                }}
                form={{
                    name: newCompanyForContactForm.name,
                    industry: newCompanyForContactForm.industry,
                    size: "",
                    revenue: newCompanyForContactForm.revenue,
                    website: newCompanyForContactForm.website,
                }}
                onFormChange={(patch) =>
                    setNewCompanyForContactForm((prev) => ({
                        ...prev,
                        ...patch,
                    }))
                }
                onSave={handleCreateCompanyForContact}
                isSubmitting={isCreatingCompanyForContact}
                showSize={false}
                industryAsText
                title="Add Company"
                saveLabel="Save"
            />

            <AddCompanyDialog
                open={isAddCompanyForLeadOpen}
                onOpenChange={(open) => {
                    setIsAddCompanyForLeadOpen(open);
                    if (!open) {
                        setNewCompanyForLeadForm({
                            name: "",
                            industry: "",
                            size: "",
                            revenue: "",
                            website: "",
                        });
                    }
                }}
                form={newCompanyForLeadForm}
                onFormChange={(patch) =>
                    setNewCompanyForLeadForm((prev) => ({
                        ...prev,
                        ...patch,
                    }))
                }
                onSave={handleCreateCompanyForLead}
                isSubmitting={isCreatingCompanyForLead}
                title="Add Company"
                saveLabel="Save"
            />

            <AddDocumentDialog
                open={isAttachFileOpen}
                onOpenChange={setIsAttachFileOpen}
                onFilesSelected={async (files) => {
                    setIsAttachFileOpen(false);
                    await handleMultipleFileUpload(files);
                }}
                isUploading={isUploadingFile}
            />

            {/* Auto Follow-up Dialog */}
            <Dialog open={isAutoFollowUpOpen} onOpenChange={setIsAutoFollowUpOpen}>
                <DialogContent className="sm:max-w-[480px] bg-[#1a1a24] border-[#3a3a3a] text-[#e5e5e5]">
                    <div className="max-h-[75vh] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#555] [&::-webkit-scrollbar-thumb]:rounded-full" style={{ scrollbarWidth: 'thin', scrollbarColor: '#555 transparent' }}>
                    <DialogHeader>
                        <DialogTitle className="text-white">Auto Follow-up</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2 w-full min-w-0">
                        {/* Enable Auto Follow-up Checkbox */}
                        <div className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                id="lead-auto-follow-up"
                                checked={autoFollowUpForm.enableAutoFollowUp}
                                onChange={(e) =>
                                    setAutoFollowUpForm((prev) => ({
                                        ...prev,
                                        enableAutoFollowUp: e.target.checked,
                                    }))
                                }
                                className="h-4 w-4 rounded border-[#3a3a3a] bg-[#2a2a3a] text-[#8b7aff] focus:ring-[#8b7aff]"
                            />
                            <Label htmlFor="lead-auto-follow-up" className="text-[13px] text-white cursor-pointer">
                                Enable auto follow-up
                            </Label>
                        </div>

                        {/* Configure Section */}
                        {autoFollowUpForm.enableAutoFollowUp && (
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-[13px] font-medium text-white mb-1">Configure auto followup</h4>
                                    <p className="text-[11px] text-[#9ca3af] leading-relaxed">
                                        Set how often the AI sends follow-ups and when to stop.
                                    </p>
                                </div>

                                {/* Title */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="lead-follow-up-title" className="text-[12px] text-[#d1d5db]">
                                        Title
                                    </Label>
                                    <Input
                                        id="lead-follow-up-title"
                                        type="text"
                                        placeholder="Enter follow-up title..."
                                        value={autoFollowUpForm.title}
                                        onChange={(e) =>
                                            setAutoFollowUpForm((prev) => ({
                                                ...prev,
                                                title: e.target.value,
                                            }))
                                        }
                                        className="h-9 bg-[#2a2a3a] border-[#3a3a3a] text-[13px] text-white placeholder:text-[#6b7280] focus:border-[#8b7aff] focus:ring-[#8b7aff]"
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="lead-follow-up-description" className="text-[12px] text-[#d1d5db]">
                                        Description
                                    </Label>
                                    <Textarea
                                        id="lead-follow-up-description"
                                        placeholder="Enter follow-up description..."
                                        value={autoFollowUpForm.description}
                                        onChange={(e) =>
                                            setAutoFollowUpForm((prev) => ({
                                                ...prev,
                                                description: e.target.value,
                                            }))
                                        }
                                        rows={2}
                                        className="bg-[#2a2a3a] border-[#3a3a3a] text-[13px] text-white placeholder:text-[#6b7280] focus:border-[#8b7aff] focus:ring-[#8b7aff] resize-none"
                                    />
                                </div>

                                {/* Frequency of Followup */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="lead-follow-up-frequency" className="text-[12px] text-[#d1d5db]">
                                        Frequency of Followup
                                    </Label>
                                    <Input
                                        id="lead-follow-up-frequency"
                                        type="number"
                                        min={1}
                                        placeholder="e.g. Every 2 days, Weekly..."
                                        value={autoFollowUpForm.followUpIntervalDays}
                                        onChange={(e) =>
                                            setAutoFollowUpForm((prev) => ({
                                                ...prev,
                                                followUpIntervalDays: e.target.value,
                                            }))
                                        }
                                        className="h-9 bg-[#2a2a3a] border-[#3a3a3a] text-[13px] text-white placeholder:text-[#6b7280] focus:border-[#8b7aff] focus:ring-[#8b7aff]"
                                    />
                                </div>

                                {/* End Date */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="lead-follow-up-end-date" className="text-[12px] text-[#d1d5db]">
                                        End Date
                                    </Label>
                                    <Input
                                        id="lead-follow-up-end-date"
                                        type="date"
                                        placeholder="Select end date..."
                                        value={autoFollowUpForm.autoFollowUpEndDate}
                                        onChange={(e) =>
                                            setAutoFollowUpForm((prev) => ({
                                                ...prev,
                                                autoFollowUpEndDate: e.target.value,
                                            }))
                                        }
                                        className="h-9 bg-[#2a2a3a] border-[#3a3a3a] text-[13px] text-white placeholder:text-[#6b7280] focus:border-[#8b7aff] focus:ring-[#8b7aff]"
                                    />
                                </div>

                                <p className="text-[11px] text-[#9ca3af]">
                                    Defaults apply when left blank: every 2 days with 3 auto follow-ups.
                                </p>
                            </div>
                        )}
                    </div>
                    </div>

                    <DialogFooter className="flex flex-row justify-between gap-3 sm:justify-between">
                        <Button
                            variant="outline"
                            onClick={() => setIsAutoFollowUpOpen(false)}
                            disabled={isSubmittingAutoFollowUp}
                            className="h-9 border-[#3a3a3a] text-[#d1d5db] hover:bg-[#2a2a3a] hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleConfirmAutoFollowUp()}
                            disabled={isSubmittingAutoFollowUp || !autoFollowUpForm.enableAutoFollowUp}
                            className="h-9 !bg-brand !hover:bg-[color:color-mix(in_srgb,var(--brand)_93%,black)] text-black font-semibold"
                        >
                            {isSubmittingAutoFollowUp ? "Saving..." : "Start Auto Follow Up"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Schedule Follow-up Dialog */}
            <Dialog open={isFollowUpOpen} onOpenChange={setIsFollowUpOpen}>
                <DialogContent className="sm:max-w-[500px] max-w-[calc(100vw-2rem)] overflow-hidden">
                    <DialogHeader className="w-full max-w-full min-w-0">
                        <DialogTitle>Schedule Follow-up</DialogTitle>
                        <DialogDescription>
                            Schedule a follow-up task for this lead.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 w-full max-w-full min-w-0">
                        <div className="space-y-2">
                            <Label htmlFor="follow-up-title">Title *</Label>
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
                                placeholder="Enter follow-up description"
                                value={followUpForm.description}
                                onChange={(e) =>
                                    setFollowUpForm({ ...followUpForm, description: e.target.value })
                                }
                                rows={4}
                                className="[field-sizing:fixed] resize-y"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="follow-up-date-time">Date & Time *</Label>
                            <Popover
                                open={isFollowUpDateTimeOpen}
                                onOpenChange={setIsFollowUpDateTimeOpen}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        id="follow-up-date-time"
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal"
                                    >
                                        {formatFollowUpDateTimeLabel()}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" align="start">
                                    <div className="space-y-3">
                                        <DatePickerCalendar
                                            mode="single"
                                            selected={getFollowUpSelectedDate()}
                                            disabled={{ before: getTodayDate() }}
                                            onSelect={(selectedDate) => {
                                                if (!selectedDate) return;
                                                const y = selectedDate.getFullYear();
                                                const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
                                                const d = String(selectedDate.getDate()).padStart(2, "0");
                                                const newDate = `${y}-${m}-${d}`;
                                                const updatedForm = {
                                                    ...followUpForm,
                                                    scheduledDate: newDate,
                                                };
                                                if (isDateToday(newDate) && followUpForm.scheduledTime && isTimePast(followUpForm.scheduledTime)) {
                                                    updatedForm.scheduledTime = "";
                                                }
                                                setFollowUpForm(updatedForm);
                                            }}
                                            initialFocus
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="follow-up-time-inline">Time</Label>
                                            <Input
                                                id="follow-up-time-inline"
                                                type="time"
                                                value={followUpForm.scheduledTime}
                                                min={isDateToday(followUpForm.scheduledDate) ? getCurrentTimeString() : undefined}
                                                onChange={(e) => {
                                                    const newTime = e.target.value;
                                                    if (isDateToday(followUpForm.scheduledDate) && isTimePast(newTime)) return;
                                                    setFollowUpForm({
                                                        ...followUpForm,
                                                        scheduledTime: newTime,
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => setIsFollowUpDateTimeOpen(false)}
                                            >
                                                Apply
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
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
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="w-full max-w-full min-w-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsFollowUpOpen(false);
                                setFollowUpForm({
                                    title: "Follow-up with Lead",
                                    description: "",
                                    scheduledDate: "",
                                    scheduledTime: "",
                                    priority: "medium",
                                    assignedTo: "",
                                });
                            }}
                            disabled={isSubmittingFollowUp}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleScheduleFollowUp()}
                            disabled={isSubmittingFollowUp}
                            className={`${theme === "color"
                                ? "bg-[#0ff] hover:bg-[#00e6e6] text-[#0a0e27]"
                                : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                                }`}
                        >
                            {isSubmittingFollowUp ? "Scheduling..." : "Schedule Follow-up"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Schedule Meeting Dialog */}
            <Dialog open={isMeetingOpen} onOpenChange={setIsMeetingOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Schedule Meeting</DialogTitle>
                        <DialogDescription>
                            Schedule a meeting for this lead.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="meeting-title">Title *</Label>
                            <Input
                                id="meeting-title"
                                placeholder="Meeting with Lead"
                                value={meetingForm.title}
                                onChange={(e) =>
                                    setMeetingForm({ ...meetingForm, title: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="meeting-description">Description</Label>
                            <Textarea
                                id="meeting-description"
                                placeholder="Enter meeting description"
                                value={meetingForm.description}
                                onChange={(e) =>
                                    setMeetingForm({ ...meetingForm, description: e.target.value })
                                }
                                rows={4}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="meeting-date">Date *</Label>
                                <Input
                                    id="meeting-date"
                                    type="date"
                                    value={meetingForm.scheduledDate}
                                    onChange={(e) =>
                                        setMeetingForm({ ...meetingForm, scheduledDate: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="meeting-time">Time *</Label>
                                <Input
                                    id="meeting-time"
                                    type="time"
                                    value={meetingForm.scheduledTime}
                                    onChange={(e) =>
                                        setMeetingForm({ ...meetingForm, scheduledTime: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="meeting-location">Location</Label>
                            <Input
                                id="meeting-location"
                                placeholder="Meeting location (optional)"
                                value={meetingForm.location}
                                onChange={(e) =>
                                    setMeetingForm({ ...meetingForm, location: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="meeting-priority">Priority</Label>
                            <Select
                                value={meetingForm.priority}
                                onValueChange={(value) =>
                                    setMeetingForm({ ...meetingForm, priority: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsMeetingOpen(false);
                                setMeetingForm({
                                    title: "Meeting with Lead",
                                    description: "",
                                    scheduledDate: "",
                                    scheduledTime: "",
                                    location: "",
                                    priority: "medium",
                                    assignedTo: "",
                                });
                            }}
                            disabled={isSubmittingMeeting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleScheduleMeeting}
                            disabled={isSubmittingMeeting}
                            className={`${theme === "color"
                                ? "bg-[#0ff] hover:bg-[#00e6e6] text-[#0a0e27]"
                                : "bg-[#7b68ee] hover:bg-[#6a5acd] text-white"
                                }`}
                        >
                            {isSubmittingMeeting ? "Scheduling..." : "Schedule Meeting"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DeleteLeadsDialog
                open={isDeleteLeadOpen}
                onOpenChange={setIsDeleteLeadOpen}
                leads={
                    lead
                        ? [
                              {
                                  id: String(leadId || lead?.id || "lead"),
                                  name: lead?.name || getLeadName(lead) || getLeadName(originalLeadData) || "this lead",
                              },
                          ]
                        : []
                }
                onConfirm={handleConfirmDeleteLead}
                isDeleting={isDeletingLead}
            />

            <AddTagDialog
                open={isAddTagDialogOpen}
                onOpenChange={(open) => {
                    setIsAddTagDialogOpen(open);
                    if (!open) setTagInput("");
                }}
                tagInput={tagInput}
                onTagInputChange={setTagInput}
                currentTags={tags}
                getTagColor={getTagColor}
                onRemoveTag={handleRemoveTag}
                onSave={handleAddTags}
                isSubmitting={isSavingTags}
            />

            {/* Delete Contact Dialog */}
            <Dialog
                open={isDeleteContactOpen}
                onOpenChange={(open) => {
                    setIsDeleteContactOpen(open);
                    if (!open) {
                        setContactToDelete(null);
                    }
                }}
            >
                <DialogContent
                    className={`sm:max-w-[420px] ${resolvedTheme === "color"
                        ? "bg-[#0A0E27] border-[rgba(0,255,255,0.2)] text-white"
                        : resolvedTheme === "dark"
                            ? "bg-[#1a1a1a] border-[#3a3a3a] text-[#e5e5e5]"
                            : "bg-white border-[#e5e7eb] text-[#1f1f1f]"
                        }`}
                >
                    <DialogHeader>
                        <DialogTitle className={resolvedTheme === "dark" ? "text-[#f3f4f6]" : resolvedTheme === "color" ? "text-white" : "text-[#111827]"}>
                            Delete Contact
                        </DialogTitle>
                        <DialogDescription className={resolvedTheme === "dark" ? "text-[#9ca3af]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : "text-[#6b7280]"}>
                            Are you sure you want to remove this contact from the lead? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-3">
                        <div className={`p-3 rounded-lg border ${resolvedTheme === "dark"
                            ? "bg-red-900/15 border-red-900/40"
                            : resolvedTheme === "color"
                                ? "bg-[rgba(255,80,80,0.12)] border-[rgba(255,80,80,0.25)]"
                                : "bg-red-50 border-red-100"
                            }`}>
                            <p className={`text-sm ${resolvedTheme === "dark" ? "text-red-300" : resolvedTheme === "color" ? "text-red-200" : "text-red-700"}`}>
                                This will remove the contact from this lead. The contact will not be deleted from your contacts list.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsDeleteContactOpen(false);
                                setContactToDelete(null);
                            }}
                            disabled={isDeletingContact}
                            className={resolvedTheme === "dark"
                                ? "border-[#3a3a3a] bg-[#1f1f1f] text-[#e5e5e5] hover:bg-[#2a2a2a]"
                                : resolvedTheme === "color"
                                    ? "border-[rgba(0,255,255,0.2)] bg-[rgba(255,255,255,0.03)] text-white hover:bg-[rgba(0,255,255,0.08)]"
                                    : ""}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmDeleteContact}
                            disabled={isDeletingContact}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeletingContact ? "Removing..." : "Remove Contact"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <EditLeadProfileDialog
                open={isEditLeadOpen}
                onOpenChange={setIsEditLeadOpen}
                form={{
                    salesFunnelId: editLeadForm.salesFunnelId,
                    stage: editLeadForm.stage,
                    source: editLeadForm.source,
                    assignedTo: editLeadForm.assignedTo,
                    description: editLeadForm.description,
                }}
                onFormChange={(patch) =>
                    setEditLeadForm((prev) => ({ ...prev, ...patch }))
                }
                funnels={editLeadFunnels}
                stages={editLeadFunnelStages}
                sources={editLeadSources}
                users={editLeadUsers}
                isLoading={isLoadingEditLeadDropdowns}
                isSubmitting={isSubmittingEditLead}
                isCustomSource={isCustomSource}
                customSourceValue={customSourceValue}
                onCustomSourceChange={setCustomSourceValue}
                onToggleCustomSource={setIsCustomSource}
                onFunnelChange={(funnelId) => handleEditLeadFunnelChange(funnelId)}
                onSave={handleEditLeadProfile}
                leadStatus={lead?.leadStatus || "active"}
                onAddTag={handleAddSingleTag}
                onRemoveTag={handleRemoveTag}
                currentTags={tags}
                onArchive={() => handleUpdateLeadStatus("archived")}
                onCloseLost={() => handleUpdateLeadStatus("lost")}
                onMarkWon={() => handleUpdateLeadStatus("won")}
                onMakeActive={() => handleUpdateLeadStatus("active")}
            />
        </div>
    );
};
