"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { ReservesPanel } from "@/components/dashboard/ReservesPanel";
import { PlatformCouponInput } from "@/components/ui/platform-coupon-input";
import { API_URL } from "@/lib/api";
import {
  Phone,
  Search,
  Grid,
  List,
  TicketCheck,
  Filter,
  X,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Upload,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Save,
  Eye,
  Tag,
  DollarSign,
  Link2,
  Users,
  CheckCircle,
  Clock,
  Star,
  ChevronDown,
  ChevronUp,
  GripVertical,
  CreditCard,
  AlertCircle,
  Check,
  Calendar,
  Video,
  FileText,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Copy,
  ExternalLink,
  Play,
  Mic,
  CalendarClock,
  BadgeCheck,
  IndianRupee,
  Timer,
  Award,
  Image,
  HelpCircle,
  Target,
  Layers,
} from "lucide-react";
import {
  getCallOfferings,
  getCallOfferingsManage,
  getCallOffering,
  createCallOffering,
  updateCallOffering,
  deleteCallOffering,
  addIntakeQuestion,
  updateIntakeQuestion,
  deleteIntakeQuestion,
  reorderIntakeQuestions,
  getCallPurchases,
  getMyCallPurchases,
  getCallOfferingStats,
  getFounderCallBookings,
  getMyCallBookings,
  type CallOffering,
  type CallPurchase,
  type CallBooking,
  type CallStats,
  type IntakeQuestion,
  type CallTopic,
  type CallHowItWorks,
  type CallFaq,
} from "@/lib/feed-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { getPageCache, setPageCache, invalidatePageCache } from "@/lib/revenue-network-cache";
import { toast } from "sonner";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { CommissionPlanSection, CompPlanBadge } from "./CommissionPlanSection";
import {
  MAX_BENEFITS,
  MAX_FAQS,
  filterNonEmptyStrings,
  limitReachedLabel,
} from "@/lib/form-limits";
import {
  formatSellablePrice,
  showSellablePublished,
} from "@/components/shared/SellablePublishedModal";

/** The share popup, for a call offering that was just created or first published. */
function announceCall(call: CallOffering) {
  showSellablePublished({
    kind: "call",
    title: call.title,
    image: call.coverImage || null,
    url: `/checkout/call/${call._id}`,
    price: call.isFree ? "Free" : formatSellablePrice(call.pricePerCall, call.currency, "call"),
    facts: [call.duration > 0 && `${call.duration} min`],
    draft: call.status !== "published",
  });
}

// Helper to get orgId
function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

interface CallsPageProps {
  initialTab?: "calls" | "purchases" | "bookings" | "mycalls" | "reserves";
  setActivePopover?: (popover: string | null) => void;
  viewRole?: "customer" | "founder";
}

export function CallsPage({ initialTab = "calls", setActivePopover, viewRole }: CallsPageProps = {}) {
  const { amIFounder, loading: founderLoading } = useAmIFounder();
  const isFounderMode = viewRole === "founder";
  const [calls, setCalls] = useState<CallOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [affiliateId, setAffiliateId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [activeTab, setActiveTab] = useState<"calls" | "purchases" | "bookings" | "mycalls" | "reserves">(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Call detail/edit view state
  const [viewingCall, setViewingCall] = useState<CallOffering | null>(null);
  const [editingCall, setEditingCall] = useState<CallOffering | null>(null);

  // Purchases state
  const [purchases, setPurchases] = useState<CallPurchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [myPurchases, setMyPurchases] = useState<CallPurchase[]>([]);

  // Bookings state
  const [bookings, setBookings] = useState<CallBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [myBookings, setMyBookings] = useState<CallBooking[]>([]);

  // View states
  const [showCreateView, setShowCreateView] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (showCreateView || !!editingCall || !!viewingCall) {
      window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    } else {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [showCreateView, editingCall, viewingCall]);

  // Fetch calls
  useEffect(() => {
    const fetchData = async () => {
      if (founderLoading) return;

      const cacheKey = `calls:${isFounderMode ? "founder" : "stakeholder"}`;
      const cached = getPageCache<{ calls: typeof calls }>(cacheKey);
      if (cached) {
        setCalls(cached.calls);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        if (isFounderMode) {
          const data = await getCallOfferingsManage();
          setCalls(data.callOfferings);
          setPageCache(cacheKey, { calls: data.callOfferings });
        } else {
          const data = await getCallOfferings();
          setCalls(data.callOfferings);
          setPageCache(cacheKey, { calls: data.callOfferings });
        }
      } catch (error) {
        console.error("Error fetching calls:", error);
        if (!cached) toast.error("Failed to load calls");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isFounderMode, founderLoading]);

  // Fetch purchases when tab changes (founder view)
  useEffect(() => {
    if (activeTab === "purchases" && isFounderMode && calls.length > 0) {
      const fetchPurchases = async () => {
        setLoadingPurchases(true);
        try {
          const allPurchases: CallPurchase[] = [];
          for (const call of calls) {
            const data = await getCallPurchases(call._id);
            allPurchases.push(...data.purchases);
          }
          setPurchases(allPurchases);
        } catch (error) {
          console.error("Error fetching purchases:", error);
          toast.error("Failed to load purchases");
        } finally {
          setLoadingPurchases(false);
        }
      };
      fetchPurchases();
    } else if (activeTab === "mycalls" && !isFounderMode) {
      const fetchMyPurchases = async () => {
        setLoadingPurchases(true);
        try {
          const data = await getMyCallPurchases();
          setMyPurchases(data.purchases);
        } catch (error) {
          console.error("Error fetching my purchases:", error);
          toast.error("Failed to load my calls");
        } finally {
          setLoadingPurchases(false);
        }
      };
      fetchMyPurchases();
    }
  }, [activeTab, isFounderMode, calls]);

  // Fetch bookings when tab changes
  useEffect(() => {
    if (activeTab === "bookings" && isFounderMode) {
      const fetchBookings = async () => {
        setLoadingBookings(true);
        try {
          const data = await getFounderCallBookings();
          setBookings(data.bookings);
        } catch (error) {
          console.error("Error fetching bookings:", error);
          toast.error("Failed to load bookings");
        } finally {
          setLoadingBookings(false);
        }
      };
      fetchBookings();
    } else if (activeTab === "bookings" && !isFounderMode) {
      const fetchMyBookings = async () => {
        setLoadingBookings(true);
        try {
          const data = await getMyCallBookings();
          setMyBookings(data.bookings);
        } catch (error) {
          console.error("Error fetching my bookings:", error);
          toast.error("Failed to load my bookings");
        } finally {
          setLoadingBookings(false);
        }
      };
      fetchMyBookings();
    }
  }, [activeTab, isFounderMode]);

  // Fetch affiliate ID for checkout links
  useEffect(() => {
    const fetchAffiliateId = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/affiliate/my-affiliate-id`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        const data = await response.json();
        if (data.success && data.affiliateId) {
          setAffiliateId(data.affiliateId);
        }
      } catch (error) {
        console.error("Error fetching affiliate ID:", error);
      }
    };

    fetchAffiliateId();
  }, []);

  // Filter calls
  const filteredCalls = calls.filter((call) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        call.title.toLowerCase().includes(query) ||
        call.description?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    if (selectedFilter === "published" && call.status !== "published") return false;
    if (selectedFilter === "draft" && call.status !== "draft") return false;
    if (selectedFilter === "archived" && call.status !== "archived") return false;

    return true;
  });

  // Open call edit view (founder)
  const openCallEdit = async (call: CallOffering) => {
    try {
      const data = await getCallOffering(call._id);
      setEditingCall(data.callOffering);
    } catch (error) {
      console.error("Error fetching call:", error);
      toast.error("Failed to load call details");
    }
  };

  // Open call detail view (stakeholder)
  const openCallDetail = async (call: CallOffering) => {
    try {
      const data = await getCallOffering(call._id);
      setViewingCall(data.callOffering);
    } catch (error) {
      console.error("Error fetching call:", error);
      toast.error("Failed to load call details");
    }
  };

  // Handle call card action
  const handleCallAction = (call: CallOffering) => {
    if (isFounderMode) {
      openCallEdit(call);
    } else {
      openCallDetail(call);
    }
  };

  // Handle delete call
  const handleDeleteCall = async (callId: string) => {
    try {
      await deleteCallOffering(callId);
      invalidatePageCache("calls:");
      setCalls((prev) => prev.filter((c) => c._id !== callId));
      toast.success("Call deleted successfully");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting call:", error);
      toast.error("Failed to delete call");
    }
  };

  // Refresh calls
  const refreshCalls = async () => {
    try {
      invalidatePageCache("calls:");
      if (isFounderMode) {
        const data = await getCallOfferingsManage();
        setCalls(data.callOfferings);
        setPageCache("calls:founder", { calls: data.callOfferings });
      } else {
        const data = await getCallOfferings();
        setCalls(data.callOfferings);
        setPageCache("calls:stakeholder", { calls: data.callOfferings });
      }
    } catch (error) {
      console.error("Error refreshing calls:", error);
    }
  };

  // Format currency
  const formatCurrency = (value: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading || founderLoading) {
    return (
      <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
        <div className="border-b border-[#2a2a35] bg-[#0e0e12] px-6 py-4 animate-pulse">
          <div className="h-6 w-28 bg-[#1a1a22] rounded mb-2" />
          <div className="h-4 w-48 bg-[#1a1a22] rounded" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#0e0e12] border border-[#2a2a35] p-4 animate-pulse flex gap-4 items-center">
              <div className="h-14 w-14 bg-[#1a1a22] rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#1a1a22] rounded w-44" />
                <div className="h-3 bg-[#1a1a22] rounded w-28" />
              </div>
              <div className="h-8 bg-[#1a1a22] rounded w-24 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Call Create View (Founder)
  if (showCreateView && isFounderMode) {
    return (
      <CallCreateView
        onBack={() => {
          setShowCreateView(false);
          refreshCalls();
        }}
        onSuccess={() => {
          setShowCreateView(false);
          refreshCalls();
        }}
      />
    );
  }

  // Call Edit View (Founder)
  if (editingCall && isFounderMode) {
    return (
      <CallEditView
        call={editingCall}
        onBack={() => {
          setEditingCall(null);
          refreshCalls();
        }}
        onUpdate={(updated) => setEditingCall(updated)}
      />
    );
  }

  // Call Detail View (Stakeholder)
  if (viewingCall && !isFounderMode) {
    return (
      <CallDetailView
        call={viewingCall}
        onBack={() => setViewingCall(null)}
        formatCurrency={formatCurrency}
        onPurchase={() => {
          // Close the detail view
          setViewingCall(null);
          // Switch to My Calls tab
          if (setActivePopover) {
            setActivePopover("1:1 Calls:mycalls");
          } else {
            setActiveTab("mycalls");
          }
          // Refresh my purchases
          refreshCalls();
        }}
      />
    );
  }

  // Main List View
  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
      {/* Header */}
      <div className="border-b border-[#2a2a35] bg-gradient-to-r from-[#0e0e12] to-[#131318] px-4 sm:px-6 pt-4 sm:pt-5">
        {/* Title Row */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] flex items-center justify-center shadow-lg shadow-brand/20">
              <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-brand-foreground" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {isFounderMode ? "1:1 Calls" : "Book a Call"}
              </h1>
              <p className="text-xs sm:text-sm text-[#9fa0b8] mt-0.5">
                {isFounderMode ? "Manage your call offerings" : "Connect one-on-one with experts"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isFounderMode && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setShowCreateView(true)}
                  className="bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:from-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:to-[color:color-mix(in_srgb,var(--brand)_84%,black)] text-brand-foreground font-semibold h-10 sm:h-11 px-4 sm:px-5 shadow-lg shadow-brand/20"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create Call</span>
                </Button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
            <Input
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full pl-10 bg-[#1a1a22]/50 border-[#2a2a35] text-white placeholder:text-[#6b6b7b] focus:border-brand/50 focus:ring-brand/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilterDrawer(true)}
              className={cn(
                "gap-2 h-10 px-3 border border-[#2a2a35] hover:bg-[#1a1a22]",
                selectedFilter !== "all" && "border-brand/50 text-brand"
              )}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
              {selectedFilter !== "all" && (
                <span className="w-2 h-2 rounded-full bg-brand" />
              )}
            </Button>

            <div className="hidden sm:flex items-center gap-1 p-1 bg-[#1a1a22] rounded-lg border border-[#2a2a35]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 h-8 w-8",
                  viewMode === "grid" ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                )}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 h-8 w-8",
                  viewMode === "list" ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                )}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs removed to use central tabulation menu */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === "calls" ? (
              <motion.div
                key="calls"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {filteredCalls.length === 0 ? (
                  <EmptyState
                    icon={Phone}
                    title={searchQuery || selectedFilter !== "all" ? "No calls found" : "No calls yet"}
                    description={
                      isFounderMode
                        ? "Create your first 1:1 call offering and start connecting with your audience"
                        : "No call offerings are available at the moment"
                    }
                    action={
                      isFounderMode && !searchQuery && selectedFilter === "all" ? (
                        <Button
                          onClick={() => setShowCreateView(true)}
                          className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Call
                        </Button>
                      ) : undefined
                    }
                  />
                ) : viewMode === "grid" ? (
                  <motion.div
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
                  >
                    {filteredCalls.map((call, index) => (
                      <motion.div key={call._id} variants={fadeInUp} transition={{ delay: index * 0.05 }}>
                        <CallCard
                          call={call}
                          isFounder={amIFounder}
                          affiliateId={affiliateId}
                          onAction={() => handleCallAction(call)}
                          onView={() => openCallDetail(call)}
                          onEdit={() => openCallEdit(call)}
                          onDelete={() => setShowDeleteConfirm(call._id)}
                          formatCurrency={formatCurrency}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                    className="space-y-3"
                  >
                    {filteredCalls.map((call, index) => (
                      <motion.div key={call._id} variants={fadeInUp} transition={{ delay: index * 0.05 }}>
                        <CallCard
                          call={call}
                          isFounder={amIFounder}
                          affiliateId={affiliateId}
                          onAction={() => handleCallAction(call)}
                          onView={() => openCallDetail(call)}
                          onEdit={() => openCallEdit(call)}
                          onDelete={() => setShowDeleteConfirm(call._id)}
                          formatCurrency={formatCurrency}
                          isListView
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ) : activeTab === "purchases" ? (
              <motion.div key="purchases" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <PurchasesTab purchases={purchases} loading={loadingPurchases} formatCurrency={formatCurrency} />
              </motion.div>
            ) : activeTab === "mycalls" ? (
              <motion.div key="mycalls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <MyCallsTab purchases={myPurchases} loading={loadingPurchases} formatCurrency={formatCurrency} />
              </motion.div>
            ) : activeTab === "reserves" ? (
              <motion.div key="reserves" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ReservesPanel itemType="call" />
              </motion.div>
            ) : (
              <motion.div key="bookings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <BookingsTab
                  bookings={isFounderMode ? bookings : myBookings}
                  loading={loadingBookings}
                  isFounder={isFounderMode}
                  formatCurrency={formatCurrency}
                  onRefresh={async () => {
                    if (isFounderMode) {
                      const data = await getFounderCallBookings();
                      setBookings(data.bookings);
                    } else {
                      const data = await getMyCallBookings();
                      setMyBookings(data.bookings);
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>


      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <AlertDialogContent className="bg-[#1a1a22] border-[#2a2a35] z-[600]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Call Offering</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8]">
              This will permanently delete this call offering and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#2a2a35] text-white border-none hover:bg-[#3a3a45]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteConfirm && handleDeleteCall(showDeleteConfirm)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filter Drawer */}
      <AnimatePresence>
        {showFilterDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowFilterDrawer(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-80 z-50 bg-[#0e0e12] border-l border-[#2a2a35] p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Filters</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowFilterDrawer(false)} className="text-[#9fa0b8]">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <Label className="text-[#9fa0b8] text-sm mb-3 block">Status</Label>
                  <div className="space-y-2">
                    {[
                      { value: "all", label: "All" },
                      { value: "published", label: "Published" },
                      { value: "draft", label: "Draft" },
                      { value: "archived", label: "Archived" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSelectedFilter(option.value as any)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                          selectedFilter === option.value
                            ? "bg-brand/10 text-brand border border-brand/30"
                            : "bg-[#1a1a22] text-white hover:bg-[#2a2a35] border border-transparent"
                        )}
                      >
                        <span>{option.label}</span>
                        {selectedFilter === option.value && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setSelectedFilter("all");
                    setSearchQuery("");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==================== Empty State Component ====================

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center mb-6">
        <Icon className="h-10 w-10 text-[#6b6b7b]" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-[#9fa0b8] max-w-sm mb-6">{description}</p>
      {action}
    </motion.div>
  );
}

// ==================== Call Card Component ====================

interface CallCardProps {
  call: CallOffering;
  isFounder: boolean;
  affiliateId: string;
  onAction: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatCurrency: (value: number, currency?: string) => string;
  isListView?: boolean;
}

function CallCard({
  call,
  isFounder,
  affiliateId,
  onAction,
  onView,
  onEdit,
  onDelete,
  formatCurrency,
  isListView,
}: CallCardProps) {
  const [copied, setCopied] = useState(false);

  const getStatusBadge = () => {
    const styles = {
      published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      draft: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    };
    return (
      <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full border", styles[call.status])}>
        {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
      </span>
    );
  };

  const copyCheckoutLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/checkout/call/${call._id}${affiliateId ? `?ref=${affiliateId}` : ""}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Checkout link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isListView) {
    return (
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="bg-gradient-to-r from-[#1a1a22] to-[#1e1e26] border border-[#2a2a35] rounded-xl p-4 hover:border-brand/30 transition-all cursor-pointer group shadow-lg"
        onClick={onAction}
      >
        <div className="flex items-center gap-4">
          {/* Cover Image */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br from-[#2a2a35] to-[#1a1a22] overflow-hidden flex-shrink-0 relative">
            {call.coverImage ? (
              <img src={call.coverImage} alt={call.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Phone className="h-8 w-8 text-[#6b6b7b]" />
              </div>
            )}
            {call.purchaseCount > 10 && (
              <div className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] rounded bg-brand text-brand-foreground font-semibold flex items-center gap-0.5">
                <Sparkles className="h-2.5 w-2.5" />
                Popular
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex items-center gap-1 text-xs text-[#9fa0b8] bg-[#2a2a35]/50 px-2 py-0.5 rounded-full">
                    <Video className="h-3 w-3" />
                    Video meeting
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#9fa0b8]">
                    <Timer className="h-3 w-3" />
                    {call.duration} mins
                  </span>
                  {call.averageRating && (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <Star className="h-3 w-3 fill-amber-400" />
                      {call.averageRating.toFixed(1)}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-white text-lg group-hover:text-brand transition-colors truncate">
                  {call.title}
                </h3>
                {call.description && (
                  <p className="text-sm text-[#9fa0b8] line-clamp-1 mt-1">{call.description}</p>
                )}
              </div>
              {isFounder && getStatusBadge()}
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-brand">
                  {call.isFree ? "Free" : formatCurrency(call.pricePerCall, call.currency)}
                </span>
                {!call.isFree && <span className="text-sm text-[#6b6b7b]">per call</span>}
              </div>

              {isFounder && (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyCheckoutLink}
                    className={cn(
                      "h-9 px-3 text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35]",
                      copied && "text-emerald-400"
                    )}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 px-3 text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35]">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1a1a22] border-[#2a2a35]">
                      {/* <DropdownMenuItem onClick={onView} className="text-white hover:bg-[#2a2a35]">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem> */}
                      <DropdownMenuItem onClick={onEdit} className="text-white hover:bg-[#2a2a35]">
                        <Edit className="h-4 w-4 mr-2" />
                        View & Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyCheckoutLink} className="text-white hover:bg-[#2a2a35]">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[#2a2a35]" />
                      <DropdownMenuItem onClick={onDelete} className="text-red-400 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Commission Badge */}
            {!call.isFree && call.pricePerCall > 0 && (
              <div className="mt-2">
                <CompPlanBadge
                  itemType="call"
                  itemId={call._id}
                  price={call.pricePerCall}
                  currency={call.currency === "INR" ? "₹" : "$"}
                  isFounder={isFounder}
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid View Card
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl overflow-hidden hover:border-brand/30 transition-all cursor-pointer group shadow-xl"
      onClick={onAction}
    >
      {/* Cover Image */}
      <div className="aspect-[16/10] bg-gradient-to-br from-[#2a2a35] to-[#1a1a22] relative overflow-hidden">
        {call.coverImage ? (
          <img src={call.coverImage} alt={call.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand/5 to-transparent">
            <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
              <Phone className="h-8 w-8 text-brand" />
            </div>
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {isFounder && (
          <div className="absolute top-3 right-3">{getStatusBadge()}</div>
        )}

        {call.purchaseCount > 10 && (
          <div className="absolute top-3 left-3 px-2.5 py-1 text-xs rounded-full bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold flex items-center gap-1 shadow-lg">
            <Sparkles className="h-3 w-3" />
            Best Seller
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1 text-xs text-[#9fa0b8]">
            <Video className="h-3 w-3" />
            Video
          </span>
          <span className="w-1 h-1 rounded-full bg-[#6b6b7b]" />
          <span className="flex items-center gap-1 text-xs text-[#9fa0b8]">
            <Timer className="h-3 w-3" />
            {call.duration} mins
          </span>
          {call.averageRating && (
            <>
              <span className="w-1 h-1 rounded-full bg-[#6b6b7b]" />
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <Star className="h-3 w-3 fill-amber-400" />
                {call.averageRating.toFixed(1)}
              </span>
            </>
          )}
        </div>

        <h3 className="font-semibold text-white mb-1.5 line-clamp-2 group-hover:text-brand transition-colors">
          {call.title}
        </h3>

        {call.description && (
          <p className="text-sm text-[#6b6b7b] line-clamp-2 mb-4">{call.description}</p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[#2a2a35]">
          <div>
            <span className="text-xl font-bold text-brand">
              {call.isFree ? "Free" : formatCurrency(call.pricePerCall, call.currency)}
            </span>
            {!call.isFree && <span className="text-xs text-[#6b6b7b] ml-1">/call</span>}
          </div>

          {isFounder && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyCheckoutLink}
                className={cn("h-8 w-8 p-0", copied ? "text-emerald-400" : "text-[#6b6b7b] hover:text-white")}
              >
                {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#6b6b7b] hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#1a1a22] border-[#2a2a35]">
                  {/* <DropdownMenuItem onClick={onView} className="text-white hover:bg-[#2a2a35]">
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </DropdownMenuItem> */}
                  <DropdownMenuItem onClick={onEdit} className="text-white hover:bg-[#2a2a35]">
                    <Edit className="h-4 w-4 mr-2" />
                    View & Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#2a2a35]" />
                  <DropdownMenuItem onClick={onDelete} className="text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Commission Badge */}
        {!call.isFree && call.pricePerCall > 0 && (
          <div className="mt-2">
            <CompPlanBadge
              itemType="call"
              itemId={call._id}
              price={call.pricePerCall}
              currency={call.currency === "INR" ? "₹" : "$"}
              isFounder={isFounder}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ==================== Call Create View (In-Page) ====================

interface CallCreateViewProps {
  onBack: () => void;
  onSuccess: () => void;
}

function CallCreateView({ onBack, onSuccess }: CallCreateViewProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingStepIcon, setUploadingStepIcon] = useState(false);
  const [activeSection, setActiveSection] = useState<"details" | "questions" | "detail-page">("details");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepIconInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    coverImage: "",
    duration: 30,
    pricePerCall: 0,
    currency: "USD",
    status: "draft" as "draft" | "published",
  });

  const [questions, setQuestions] = useState<Array<{
    question: string;
    answerType: "text" | "file";
    isRequired: boolean;
  }>>([]);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question: "",
    answerType: "text" as "text" | "file",
    isRequired: false,
  });

  // Detail page fields
  const [whatsIncluded, setWhatsIncluded] = useState<string[]>([]);
  const [newIncludedItem, setNewIncludedItem] = useState("");
  const [topicsWeCover, setTopicsWeCover] = useState<CallTopic[]>([]);
  const [howItWorks, setHowItWorks] = useState<CallHowItWorks[]>([]);
  const [faqs, setFaqs] = useState<CallFaq[]>([]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("type", "call-cover");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload?orgId=${getOrgId()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formDataUpload,
        }
      );

      const data = await response.json();
      if (data.url) {
        setFormData({ ...formData, coverImage: data.url });
        toast.success("Cover image uploaded");
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleStepIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }

    const idx = parseInt(e.target.dataset.idx || "0", 10);
    setUploadingStepIcon(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload?orgId=${getOrgId()}`,
        { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: formDataUpload }
      );
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setHowItWorks((prev) => prev.map((item, i) => (i === idx ? { ...item, icon: data.url } : item)));
      toast.success("Icon uploaded");
    } catch (error) {
      console.error("Error uploading icon:", error);
      toast.error("Failed to upload icon");
    } finally {
      setUploadingStepIcon(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (publishNow: boolean = false) => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setLoading(true);
    const nonEmptyWhatsIncluded = filterNonEmptyStrings(whatsIncluded);
    const nonEmptyTopics = topicsWeCover.filter((t) => t.title.trim());
    const nonEmptyHowItWorks = howItWorks.filter(
      (h) => h.title.trim() && h.icon.trim(),
    );
    const nonEmptyFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    try {
      const response = await createCallOffering({
        ...formData,
        status: publishNow ? "published" : formData.status,
        intakeQuestions: questions,
        // Blank rows are dropped rather than sent — see the edit form's
        // sanitizedListFields for the same rule on update.
        whatsIncluded: nonEmptyWhatsIncluded.length > 0 ? nonEmptyWhatsIncluded : undefined,
        topicsWeCover: nonEmptyTopics.length > 0 ? nonEmptyTopics : undefined,
        howItWorks: nonEmptyHowItWorks.length > 0 ? nonEmptyHowItWorks : undefined,
        faqs: nonEmptyFaqs.length > 0 ? nonEmptyFaqs : undefined,
      });

      // Save commission plan if call is paid
      if (formData.pricePerCall > 0 && response.callOffering?._id) {
        try {
          const saveCommissionPlan = (window as any).__commissionPlanSave;
          if (saveCommissionPlan) {
            await saveCommissionPlan(response.callOffering._id);
          }
        } catch (commError) {
          console.error("Error saving commission plan:", commError);
          // Don't fail the entire operation if commission plan fails
        }
      }

      if (response.callOffering?._id) announceCall(response.callOffering);
      else toast.success(publishNow ? "Call offering published!" : "Call offering saved as draft!");
      onSuccess();
    } catch (error) {
      console.error("Error creating call:", error);
      toast.error("Failed to create call offering");
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    if (!newQuestion.question.trim()) {
      toast.error("Question is required");
      return;
    }
    setQuestions([...questions, newQuestion]);
    setNewQuestion({ question: "", answerType: "text", isRequired: false });
    setShowAddQuestion(false);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
      {/* Header */}
      <div className="border-b border-[#2a2a35] bg-gradient-to-r from-[#0e0e12] to-[#131318] px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-[#9fa0b8] hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Create New 1:1 Call</h1>
              <p className="text-sm text-[#6b6b7b] mt-0.5">Set up your call offering</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="border-[#2a2a35] hover:bg-[#1a1a22]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">Save Draft</span>
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:opacity-90 text-brand-foreground font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">Publish</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {/* Section Tabs */}
          <div className="flex gap-1 p-1 bg-[#1a1a22] rounded-xl border border-[#2a2a35] mb-8">
            {[
              { id: "details", label: "Basic Details", icon: FileText },
              { id: "detail-page", label: "Detail Page", icon: Layers },
              { id: "questions", label: `Intake Questions (${questions.length})`, icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all",
                  activeSection === tab.id
                    ? "bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground shadow-lg"
                    : "text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35]/50"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeSection === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Cover Image Section */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Upload className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Cover Image</h3>
                      <p className="text-xs text-[#6b6b7b]">Add an attractive cover image for your call</p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  {formData.coverImage ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-[#2a2a35] group">
                      <img
                        src={formData.coverImage}
                        alt="Cover"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="bg-white/10 border-white/20 hover:bg-white/20"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Change
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFormData({ ...formData, coverImage: "" })}
                          className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="w-full aspect-video rounded-xl border-2 border-dashed border-[#2a2a35] hover:border-brand/50 transition-colors flex flex-col items-center justify-center gap-4 bg-[#0e0e12]/50"
                    >
                      {uploadingImage ? (
                        <Loader2 className="h-10 w-10 text-brand animate-spin" />
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 flex items-center justify-center">
                            <Upload className="h-8 w-8 text-brand" />
                          </div>
                          <div className="text-center">
                            <p className="text-white font-medium">Click to upload cover image</p>
                            <p className="text-sm text-[#6b6b7b] mt-1">PNG, JPG up to 5MB • 16:9 recommended</p>
                          </div>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Basic Info Section */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Call Details</h3>
                      <p className="text-xs text-[#6b6b7b]">Basic information about your call offering</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <Label className="text-[#9fa0b8] text-sm flex items-center gap-1">
                        Title <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        placeholder="e.g., Career Guidance Call, Strategy Session, Mentorship Call"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="mt-2 bg-[#0e0e12] border-[#2a2a35] text-white h-12 text-lg focus:border-brand/50 focus:ring-brand/20"
                      />
                    </div>

                    <div>
                      <Label className="text-[#9fa0b8] text-sm">Description</Label>
                      <Textarea
                        placeholder="Describe what buyers will get from this call. What topics will you cover? What can they expect? Be specific to attract the right audience..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="mt-2 bg-[#0e0e12] border-[#2a2a35] text-white min-h-[150px] focus:border-brand/50 focus:ring-brand/20"
                      />
                      <p className="text-xs text-[#6b6b7b] mt-2">
                        {formData.description.length}/500 characters
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pricing & Duration Section */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Pricing & Duration</h3>
                      <p className="text-xs text-[#6b6b7b]">Set the price and duration for each call</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-[#9fa0b8] text-sm">Call Duration</Label>
                      <Select
                        value={formData.duration.toString()}
                        onValueChange={(v) => setFormData({ ...formData, duration: parseInt(v) })}
                      >
                        <SelectTrigger className="mt-2 bg-[#0e0e12] border-[#2a2a35] text-white h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a22] border-[#2a2a35]">
                          <SelectItem value="15">
                            <div className="flex items-center gap-2">
                              <Timer className="h-4 w-4" />
                              15 minutes - Quick chat
                            </div>
                          </SelectItem>
                          <SelectItem value="30">
                            <div className="flex items-center gap-2">
                              <Timer className="h-4 w-4" />
                              30 minutes - Standard
                            </div>
                          </SelectItem>
                          <SelectItem value="45">
                            <div className="flex items-center gap-2">
                              <Timer className="h-4 w-4" />
                              45 minutes - In-depth
                            </div>
                          </SelectItem>
                          <SelectItem value="60">
                            <div className="flex items-center gap-2">
                              <Timer className="h-4 w-4" />
                              60 minutes - Full session
                            </div>
                          </SelectItem>
                          <SelectItem value="90">
                            <div className="flex items-center gap-2">
                              <Timer className="h-4 w-4" />
                              90 minutes - Extended
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[#9fa0b8] text-sm">Currency</Label>
                      <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                        <SelectTrigger className="mt-2 bg-[#0e0e12] border-[#2a2a35] text-white h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a22] border-[#2a2a35]">
                          <SelectItem value="USD">$ USD (US Dollar)</SelectItem>
                          <SelectItem value="INR">₹ INR (Indian Rupee)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-[#9fa0b8] text-sm">Price per Call</Label>
                      <div className="relative mt-2">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand font-semibold">{formData.currency === "INR" ? "₹" : "$"}</span>
                        <Input
                          type="number"
                          placeholder="0"
                          value={formData.pricePerCall || ""}
                          onChange={(e) => setFormData({ ...formData, pricePerCall: parseFloat(e.target.value) || 0 })}
                          className="pl-10 bg-[#0e0e12] border-[#2a2a35] text-white h-12 text-lg font-semibold focus:border-brand/50"
                        />
                      </div>
                      <p className="text-xs text-[#6b6b7b] mt-2 flex items-center gap-1">
                        <BadgeCheck className="h-3 w-3 text-emerald-400" />
                        Set to 0 for free calls
                      </p>
                    </div>
                  </div>

                  {/* Price Preview */}
                  {formData.title && (
                    <div className="mt-6 p-4 bg-[#0e0e12] rounded-xl border border-[#2a2a35]">
                      <p className="text-xs text-[#6b6b7b] mb-2">Preview</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{formData.title}</p>
                          <p className="text-sm text-[#6b6b7b]">{formData.duration} minutes</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-brand">
                            {formData.pricePerCall === 0 ? "Free" : `${formData.currency === "INR" ? "₹" : "$"}${formData.pricePerCall}`}
                          </p>
                          <p className="text-xs text-[#6b6b7b]">per call</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Commission Plan - for paid calls */}
                {formData.pricePerCall > 0 && (
                  <CommissionPlanSection
                    itemType="call"
                    itemName={formData.title || "New Call"}
                    isPaid={true}
                  />
                )}

                {/* Quick Actions */}
                <div className="flex items-center justify-between p-4 bg-[#1a1a22]/50 rounded-xl border border-dashed border-[#2a2a35]">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-[#6b6b7b]" />
                    <div>
                      <p className="text-white font-medium">Add Intake Questions</p>
                      <p className="text-xs text-[#6b6b7b]">Ask buyers questions before they purchase</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setActiveSection("questions")}
                    className="border-[#2a2a35] hover:border-brand/50"
                  >
                    {questions.length > 0 ? `${questions.length} questions` : "Add"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {activeSection === "detail-page" && (
              <motion.div
                key="detail-page"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* What's Included */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Check className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">What&apos;s Included</h3>
                      <p className="text-xs text-[#6b6b7b]">Items shown as a checklist on the detail page</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <Input
                      placeholder="e.g., Pre-call questionnaire to understand your goals"
                      value={newIncludedItem}
                      onChange={(e) => setNewIncludedItem(e.target.value)}
                      disabled={whatsIncluded.length >= MAX_BENEFITS}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newIncludedItem.trim() && whatsIncluded.length < MAX_BENEFITS) { setWhatsIncluded([...whatsIncluded, newIncludedItem.trim()]); setNewIncludedItem(""); } } }}
                      className="bg-[#0e0e12] border-[#2a2a35] text-white"
                    />
                    <Button
                      onClick={() => { if (newIncludedItem.trim() && whatsIncluded.length < MAX_BENEFITS) { setWhatsIncluded([...whatsIncluded, newIncludedItem.trim()]); setNewIncludedItem(""); } }}
                      disabled={whatsIncluded.length >= MAX_BENEFITS}
                      variant="outline"
                      className="border-[#2a2a35] text-white hover:bg-[#1a1a22] shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {whatsIncluded.length >= MAX_BENEFITS && (
                    <p className="mb-3 text-[11px] text-[#6b6b7b]">
                      {limitReachedLabel(MAX_BENEFITS, "items")}
                    </p>
                  )}

                  {whatsIncluded.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {whatsIncluded.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-[#0e0e12] rounded-lg">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-sm text-white flex-1">{item}</span>
                          <button onClick={() => setWhatsIncluded(whatsIncluded.filter((_, i) => i !== idx))} className="text-[#9fa0b8] hover:text-red-400">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Topics We Cover */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Target className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Topics We Cover</h3>
                      <p className="text-xs text-[#6b6b7b]">Cards with title and description shown in a 2-column grid</p>
                    </div>
                  </div>

                  {topicsWeCover.map((topic, idx) => (
                    <div key={idx} className="mb-3 p-4 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Topic title (e.g., Strategy & Planning)"
                            value={topic.title}
                            onChange={(e) => setTopicsWeCover((prev) => prev.map((t, i) => (i === idx ? { ...t, title: e.target.value } : t)))}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                          <Textarea
                            placeholder="Brief description..."
                            value={topic.description}
                            onChange={(e) => setTopicsWeCover((prev) => prev.map((t, i) => (i === idx ? { ...t, description: e.target.value } : t)))}
                            rows={2}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                        </div>
                        <button onClick={() => setTopicsWeCover(topicsWeCover.filter((_, i) => i !== idx))} className="text-[#9fa0b8] hover:text-red-400 mt-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button
                    onClick={() => setTopicsWeCover([...topicsWeCover, { title: "", description: "" }])}
                    variant="outline"
                    className="w-full border-dashed border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-brand"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Topic
                  </Button>
                </div>

                {/* How It Works */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Layers className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">How It Works</h3>
                      <p className="text-xs text-[#6b6b7b]">Step-by-step process with icon, title, and description</p>
                    </div>
                  </div>

                  <input
                    ref={stepIconInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleStepIconUpload}
                    className="hidden"
                  />

                  {howItWorks.map((step, idx) => (
                    <div key={idx} className="mb-3 p-4 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 flex flex-col items-center gap-1">
                          <span className="text-xs text-[#6b6b7b]">Step {idx + 1}</span>
                          {step.icon ? (
                            <div className="relative group">
                              <img src={step.icon} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              <button
                                onClick={() => setHowItWorks((prev) => prev.map((s, i) => (i === idx ? { ...s, icon: "" } : s)))}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { if (stepIconInputRef.current) { stepIconInputRef.current.dataset.idx = String(idx); stepIconInputRef.current.click(); } }}
                              className="w-10 h-10 rounded-lg border-2 border-dashed border-[#2a2a35] flex items-center justify-center hover:border-brand transition-colors"
                            >
                              {uploadingStepIcon ? <Loader2 className="w-4 h-4 text-[#9fa0b8] animate-spin" /> : <Image className="w-4 h-4 text-[#9fa0b8]" />}
                            </button>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Step title (e.g., Book Your Session)"
                            value={step.title}
                            onChange={(e) => setHowItWorks((prev) => prev.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s)))}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                          <Textarea
                            placeholder="Step description..."
                            value={step.description}
                            onChange={(e) => setHowItWorks((prev) => prev.map((s, i) => (i === idx ? { ...s, description: e.target.value } : s)))}
                            rows={2}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                        </div>
                        <button onClick={() => setHowItWorks(howItWorks.filter((_, i) => i !== idx))} className="text-[#9fa0b8] hover:text-red-400 mt-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button
                    onClick={() => setHowItWorks([...howItWorks, { icon: "", title: "", description: "" }])}
                    variant="outline"
                    className="w-full border-dashed border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-brand"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Step
                  </Button>
                </div>

                {/* FAQs */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <HelpCircle className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Frequently Asked Questions</h3>
                      <p className="text-xs text-[#6b6b7b]">Expandable Q&A accordion on the detail page</p>
                    </div>
                  </div>

                  {faqs.map((faq, idx) => (
                    <div key={idx} className="mb-3 p-4 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Question (e.g., How do I schedule the call?)"
                            value={faq.question}
                            onChange={(e) => setFaqs((prev) => prev.map((f, i) => (i === idx ? { ...f, question: e.target.value } : f)))}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                          <Textarea
                            placeholder="Answer..."
                            value={faq.answer}
                            onChange={(e) => setFaqs((prev) => prev.map((f, i) => (i === idx ? { ...f, answer: e.target.value } : f)))}
                            rows={2}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                        </div>
                        <button onClick={() => setFaqs(faqs.filter((_, i) => i !== idx))} className="text-[#9fa0b8] hover:text-red-400 mt-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button
                    onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
                    disabled={faqs.length >= MAX_FAQS}
                    variant="outline"
                    className="w-full border-dashed border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-brand disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add FAQ
                  </Button>
                  {faqs.length >= MAX_FAQS && (
                    <p className="mt-2 text-[11px] text-[#6b6b7b] text-center">
                      {limitReachedLabel(MAX_FAQS, "FAQs")}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {activeSection === "questions" && (
              <motion.div
                key="questions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-brand" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Intake Questions</h3>
                        <p className="text-xs text-[#6b6b7b]">Questions buyers must answer before purchasing</p>
                      </div>
                    </div>
                  </div>

                  {questions.length > 0 ? (
                    <div className="space-y-3 mb-6">
                      {questions.map((q, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-start gap-4 p-4 bg-[#0e0e12] rounded-xl border border-[#2a2a35] group hover:border-brand/20 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-brand">{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium">{q.question}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="flex items-center gap-1.5 text-xs text-[#6b6b7b] bg-[#2a2a35] px-2.5 py-1 rounded-full">
                                {q.answerType === "text" ? <MessageSquare className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                {q.answerType === "text" ? "Text answer" : "File upload"}
                              </span>
                              {q.isRequired && (
                                <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Required
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuestion(index)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  ) : !showAddQuestion && (
                    <div className="text-center py-12 bg-[#0e0e12] rounded-xl border border-dashed border-[#2a2a35] mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-[#1a1a22] flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="h-8 w-8 text-[#3a3a45]" />
                      </div>
                      <p className="text-white font-medium mb-1">No intake questions yet</p>
                      <p className="text-sm text-[#6b6b7b] mb-4">
                        Add questions to learn more about your buyers before the call
                      </p>
                    </div>
                  )}

                  {showAddQuestion ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 bg-[#0e0e12] rounded-xl border border-brand/30 space-y-5"
                    >
                      <div>
                        <Label className="text-[#9fa0b8] text-sm">Question</Label>
                        <Input
                          placeholder="e.g., What do you want to accomplish from this call?"
                          value={newQuestion.question}
                          onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                          className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white h-12 focus:border-brand/50"
                          autoFocus
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={newQuestion.isRequired}
                            onChange={(e) => setNewQuestion({ ...newQuestion, isRequired: e.target.checked })}
                            className="w-5 h-5 rounded border-[#2a2a35] bg-[#1a1a22] text-brand focus:ring-brand/50 cursor-pointer"
                          />
                          <span className="text-sm text-[#9fa0b8] group-hover:text-white transition-colors">Make this required</span>
                        </label>
                      </div>

                      <div>
                        <Label className="text-[#9fa0b8] text-sm mb-3 block">Answer type</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { value: "text", label: "Text Answer", icon: MessageSquare, desc: "Short or long text response" },
                            { value: "file", label: "File Upload", icon: Upload, desc: "PDF, JPG, PNG files" },
                          ].map((type) => (
                            <button
                              key={type.value}
                              onClick={() => setNewQuestion({ ...newQuestion, answerType: type.value as any })}
                              className={cn(
                                "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all",
                                newQuestion.answerType === type.value
                                  ? "bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground border-brand shadow-lg shadow-brand/20"
                                  : "bg-[#1a1a22] text-white border-[#2a2a35] hover:border-brand/50"
                              )}
                            >
                              <type.icon className="h-6 w-6" />
                              <span className="text-sm font-semibold">{type.label}</span>
                              <span className={cn("text-xs", newQuestion.answerType === type.value ? "text-black/70" : "text-[#6b6b7b]")}>
                                {type.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddQuestion(false);
                            setNewQuestion({ question: "", answerType: "text", isRequired: false });
                          }}
                          className="flex-1 border-[#2a2a35]"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={addQuestion}
                          className="flex-1 bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground hover:opacity-90 font-semibold"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Question
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowAddQuestion(true)}
                      className="w-full h-14 border-dashed border-[#2a2a35] hover:border-brand/50 hover:bg-brand/5 transition-all"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add Question
                    </Button>
                  )}
                </div>

                {/* Back to Details */}
                <div className="flex items-center justify-between p-4 bg-[#1a1a22]/50 rounded-xl border border-dashed border-[#2a2a35]">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[#6b6b7b]" />
                    <div>
                      <p className="text-white font-medium">Review Details</p>
                      <p className="text-xs text-[#6b6b7b]">Go back to edit call details</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setActiveSection("details")}
                    className="border-[#2a2a35] hover:border-brand/50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ==================== Call Edit View (Founder) ====================

interface CallEditViewProps {
  call: CallOffering;
  onBack: () => void;
  onUpdate: (call: CallOffering) => void;
}

function CallEditView({ call, onBack, onUpdate }: CallEditViewProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: call.title,
    description: call.description || "",
    coverImage: call.coverImage || "",
    duration: call.duration,
    pricePerCall: call.pricePerCall,
    currency: call.currency,
    status: call.status,
    whatsIncluded: call.whatsIncluded || [] as string[],
    topicsWeCover: call.topicsWeCover || [] as CallTopic[],
    howItWorks: call.howItWorks || [] as CallHowItWorks[],
    faqs: call.faqs || [] as CallFaq[],
  });
  const [stats, setStats] = useState<CallStats | null>(null);
  const [activeSection, setActiveSection] = useState<"details" | "questions" | "commission" | "detail-page">("details");
  const [newIncludedItem, setNewIncludedItem] = useState("");
  const [uploadingStepIcon, setUploadingStepIcon] = useState(false);
  const editStepIconInputRef = useRef<HTMLInputElement>(null);

  // Sync formData when call prop changes (e.g., after save)
  useEffect(() => {
    setFormData({
      title: call.title,
      description: call.description || "",
      coverImage: call.coverImage || "",
      duration: call.duration,
      pricePerCall: call.pricePerCall,
      currency: call.currency,
      status: call.status,
      whatsIncluded: call.whatsIncluded || [],
      topicsWeCover: call.topicsWeCover || [],
      howItWorks: call.howItWorks || [],
      faqs: call.faqs || [],
    });
  }, [call]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getCallOfferingStats(call._id);
        setStats(data.stats);
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };
    fetchStats();
  }, [call._id]);

  const handleEditStepIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }

    const idx = parseInt(e.target.dataset.idx || "0", 10);
    setUploadingStepIcon(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload?orgId=${getOrgId()}`,
        { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: formDataUpload }
      );
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setFormData((prev) => ({
        ...prev,
        howItWorks: prev.howItWorks.map((item, i) => (i === idx ? { ...item, icon: data.url } : item)),
      }));
      toast.success("Icon uploaded");
    } catch (error) {
      console.error("Error uploading icon:", error);
      toast.error("Failed to upload icon");
    } finally {
      setUploadingStepIcon(false);
      e.target.value = "";
    }
  };

  /**
   * Blank rows left behind in the editor are dropped before save. They pad the
   * request body and render as empty bullets and empty accordions on the
   * public detail page.
   */
  const sanitizedListFields = () => ({
    howItWorks: formData.howItWorks.filter(h => h.title.trim() && h.icon.trim()),
    whatsIncluded: filterNonEmptyStrings(formData.whatsIncluded),
    topicsWeCover: formData.topicsWeCover.filter(t => t.title.trim()),
    faqs: formData.faqs.filter(f => f.question.trim() && f.answer.trim()),
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const sanitizedData = {
        ...formData,
        ...sanitizedListFields(),
      };
      const data = await updateCallOffering(call._id, sanitizedData);

      // Save commission plan if call is paid
      if (formData.pricePerCall > 0) {
        try {
          const saveCommissionPlan = (window as any).__commissionPlanSave;
          if (saveCommissionPlan) {
            await saveCommissionPlan(call._id);
          }
        } catch (commError) {
          console.error("Error saving commission plan:", commError);
        }
      }

      onUpdate(data.callOffering);
      toast.success("Call updated successfully");
    } catch (error) {
      console.error("Error updating call:", error);
      toast.error("Failed to update call");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async () => {
    setLoading(true);
    const newStatus = formData.status === "published" ? "draft" : "published";
    try {
      const sanitizedData = {
        ...formData,
        status: newStatus as "published" | "draft" | "archived",
        ...sanitizedListFields(),
      };
      const data = await updateCallOffering(call._id, sanitizedData);

      // Save commission plan if call is paid and being published
      if (formData.pricePerCall > 0 && newStatus === "published") {
        try {
          const saveCommissionPlan = (window as any).__commissionPlanSave;
          if (saveCommissionPlan) {
            await saveCommissionPlan(call._id);
          }
        } catch (commError) {
          console.error("Error saving commission plan:", commError);
        }
      }

      onUpdate(data.callOffering);
      if (newStatus === "published") announceCall({ ...call, ...data.callOffering, status: "published" });
      else toast.success("Call unpublished");
    } catch (error) {
      console.error("Error updating call status:", error);
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: formData.currency,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
      {/* Header */}
      <div className="border-b border-[#2a2a35] bg-gradient-to-r from-[#0e0e12] to-[#131318] px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-[#9fa0b8] hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">{formData.title || call.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded-full",
                  formData.status === "published" ? "bg-emerald-500/10 text-emerald-400" :
                    formData.status === "draft" ? "bg-amber-500/10 text-amber-400" :
                      "bg-zinc-500/10 text-zinc-400"
                )}>
                  {formData.status}
                </span>
                <span className="text-sm text-[#6b6b7b]">·</span>
                <span className="text-sm text-[#6b6b7b]">{formData.duration} mins</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={loading}
              variant="outline"
              className="border-[#2a2a35] hover:bg-[#1a1a22]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">Save</span>
            </Button>
            {/* <Button
              onClick={handleTogglePublish}
              disabled={loading}
              className={cn(
                "font-semibold",
                formData.status === "published"
                  ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
                  : "bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:opacity-90 text-brand-foreground"
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : formData.status === "published" ? (
                <Eye className="h-4 w-4 sm:mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">
                {formData.status === "published" ? "Unpublish" : "Publish"}
              </span>
            </Button> */}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Purchases", value: stats.totalPurchases, icon: Users },
                { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), icon: DollarSign, highlight: true },
                { label: "Calls Scheduled", value: stats.totalCallsScheduled, icon: Calendar },
                { label: "Avg Rating", value: stats.averageRating ? `${stats.averageRating.toFixed(1)} ★` : "N/A", icon: Star },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "bg-gradient-to-br from-[#1a1a22] to-[#16161c] border rounded-xl p-4",
                    stat.highlight ? "border-brand/30" : "border-[#2a2a35]"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={cn("h-4 w-4", stat.highlight ? "text-brand" : "text-[#6b6b7b]")} />
                    <span className="text-xs text-[#6b6b7b]">{stat.label}</span>
                  </div>
                  <p className={cn("text-xl font-bold", stat.highlight ? "text-brand" : "text-white")}>
                    {stat.value}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Section Tabs */}
          <div className="flex gap-1 p-1 bg-[#1a1a22] rounded-xl border border-[#2a2a35] mb-6">
            {[
              { id: "details", label: "Details", icon: FileText },
              { id: "detail-page", label: "Detail Page", icon: Layers },
              { id: "questions", label: `Questions (${call.intakeQuestions?.length || 0})`, icon: MessageSquare },
              ...(!call.isFree && call.pricePerCall > 0 ? [{ id: "commission", label: "Commission", icon: TrendingUp }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  activeSection === tab.id
                    ? "bg-brand text-brand-foreground"
                    : "text-[#9fa0b8] hover:text-white"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Details Section */}
          <AnimatePresence mode="wait">
            {activeSection === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[#9fa0b8]">Title</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white h-12"
                    />
                  </div>
                  <div>
                    <Label className="text-[#9fa0b8]">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a22] border-[#2a2a35]">
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-[#9fa0b8]">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white min-h-[120px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label className="text-[#9fa0b8]">Duration</Label>
                    <Select
                      value={formData.duration.toString()}
                      onValueChange={(v) => setFormData({ ...formData, duration: parseInt(v) })}
                    >
                      <SelectTrigger className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a22] border-[#2a2a35]">
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">60 minutes</SelectItem>
                        <SelectItem value="90">90 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[#9fa0b8]">Currency</Label>
                    <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                      <SelectTrigger className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a22] border-[#2a2a35]">
                        <SelectItem value="USD">$ USD</SelectItem>
                        <SelectItem value="INR">₹ INR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[#9fa0b8]">Price per Call</Label>
                    <div className="relative mt-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b6b7b]">{formData.currency === "INR" ? "₹" : "$"}</span>
                      <Input
                        type="number"
                        value={formData.pricePerCall || ""}
                        onChange={(e) => setFormData({ ...formData, pricePerCall: parseFloat(e.target.value) || 0 })}
                        className="pl-8 bg-[#1a1a22] border-[#2a2a35] text-white h-12"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === "detail-page" && (
              <motion.div
                key="detail-page"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* What's Included */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Check className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">What&apos;s Included</h3>
                      <p className="text-xs text-[#6b6b7b]">Items shown as a checklist on the detail page</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <Input
                      placeholder="e.g., Pre-call questionnaire to understand your goals"
                      value={newIncludedItem}
                      onChange={(e) => setNewIncludedItem(e.target.value)}
                      disabled={formData.whatsIncluded.length >= MAX_BENEFITS}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newIncludedItem.trim() && formData.whatsIncluded.length < MAX_BENEFITS) { setFormData((prev) => ({ ...prev, whatsIncluded: [...prev.whatsIncluded, newIncludedItem.trim()] })); setNewIncludedItem(""); } } }}
                      className="bg-[#0e0e12] border-[#2a2a35] text-white"
                    />
                    <Button
                      onClick={() => { if (newIncludedItem.trim() && formData.whatsIncluded.length < MAX_BENEFITS) { setFormData((prev) => ({ ...prev, whatsIncluded: [...prev.whatsIncluded, newIncludedItem.trim()] })); setNewIncludedItem(""); } }}
                      disabled={formData.whatsIncluded.length >= MAX_BENEFITS}
                      variant="outline"
                      className="border-[#2a2a35] text-white hover:bg-[#1a1a22] shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.whatsIncluded.length >= MAX_BENEFITS && (
                    <p className="mb-3 text-[11px] text-[#6b6b7b]">
                      {limitReachedLabel(MAX_BENEFITS, "items")}
                    </p>
                  )}

                  {formData.whatsIncluded.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {formData.whatsIncluded.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-[#0e0e12] rounded-lg">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-sm text-white flex-1">{item}</span>
                          <button onClick={() => setFormData((prev) => ({ ...prev, whatsIncluded: prev.whatsIncluded.filter((_, i) => i !== idx) }))} className="text-[#9fa0b8] hover:text-red-400">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Topics We Cover */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Target className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Topics We Cover</h3>
                      <p className="text-xs text-[#6b6b7b]">Cards with title and description shown in a 2-column grid</p>
                    </div>
                  </div>

                  {formData.topicsWeCover.map((topic, idx) => (
                    <div key={idx} className="mb-3 p-4 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Topic title (e.g., Strategy & Planning)"
                            value={topic.title}
                            onChange={(e) => setFormData((prev) => ({ ...prev, topicsWeCover: prev.topicsWeCover.map((t, i) => (i === idx ? { ...t, title: e.target.value } : t)) }))}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                          <Textarea
                            placeholder="Brief description..."
                            value={topic.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, topicsWeCover: prev.topicsWeCover.map((t, i) => (i === idx ? { ...t, description: e.target.value } : t)) }))}
                            rows={2}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                        </div>
                        <button onClick={() => setFormData((prev) => ({ ...prev, topicsWeCover: prev.topicsWeCover.filter((_, i) => i !== idx) }))} className="text-[#9fa0b8] hover:text-red-400 mt-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button
                    onClick={() => setFormData((prev) => ({ ...prev, topicsWeCover: [...prev.topicsWeCover, { title: "", description: "" }] }))}
                    variant="outline"
                    className="w-full border-dashed border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-brand"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Topic
                  </Button>
                </div>

                {/* How It Works */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Layers className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">How It Works</h3>
                      <p className="text-xs text-[#6b6b7b]">Step-by-step process with icon, title, and description</p>
                    </div>
                  </div>

                  <input
                    ref={editStepIconInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleEditStepIconUpload}
                    className="hidden"
                  />

                  {formData.howItWorks.map((step, idx) => (
                    <div key={idx} className="mb-3 p-4 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 flex flex-col items-center gap-1">
                          <span className="text-xs text-[#6b6b7b]">Step {idx + 1}</span>
                          {step.icon ? (
                            <div className="relative group">
                              <img src={step.icon} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              <button
                                onClick={() => setFormData((prev) => ({ ...prev, howItWorks: prev.howItWorks.map((s, i) => (i === idx ? { ...s, icon: "" } : s)) }))}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { if (editStepIconInputRef.current) { editStepIconInputRef.current.dataset.idx = String(idx); editStepIconInputRef.current.click(); } }}
                              className="w-10 h-10 rounded-lg border-2 border-dashed border-[#2a2a35] flex items-center justify-center hover:border-brand transition-colors"
                            >
                              {uploadingStepIcon ? <Loader2 className="w-4 h-4 text-[#9fa0b8] animate-spin" /> : <Image className="w-4 h-4 text-[#9fa0b8]" />}
                            </button>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Step title (e.g., Book Your Session)"
                            value={step.title}
                            onChange={(e) => setFormData((prev) => ({ ...prev, howItWorks: prev.howItWorks.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s)) }))}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                          <Textarea
                            placeholder="Step description..."
                            value={step.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, howItWorks: prev.howItWorks.map((s, i) => (i === idx ? { ...s, description: e.target.value } : s)) }))}
                            rows={2}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                        </div>
                        <button onClick={() => setFormData((prev) => ({ ...prev, howItWorks: prev.howItWorks.filter((_, i) => i !== idx) }))} className="text-[#9fa0b8] hover:text-red-400 mt-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button
                    onClick={() => setFormData((prev) => ({ ...prev, howItWorks: [...prev.howItWorks, { icon: "", title: "", description: "" }] }))}
                    variant="outline"
                    className="w-full border-dashed border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-brand"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Step
                  </Button>
                </div>

                {/* FAQs */}
                <div className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <HelpCircle className="h-4 w-4 text-brand" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Frequently Asked Questions</h3>
                      <p className="text-xs text-[#6b6b7b]">Expandable Q&A accordion on the detail page</p>
                    </div>
                  </div>

                  {formData.faqs.map((faq, idx) => (
                    <div key={idx} className="mb-3 p-4 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Question (e.g., How do I schedule the call?)"
                            value={faq.question}
                            onChange={(e) => setFormData((prev) => ({ ...prev, faqs: prev.faqs.map((f, i) => (i === idx ? { ...f, question: e.target.value } : f)) }))}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                          <Textarea
                            placeholder="Answer..."
                            value={faq.answer}
                            onChange={(e) => setFormData((prev) => ({ ...prev, faqs: prev.faqs.map((f, i) => (i === idx ? { ...f, answer: e.target.value } : f)) }))}
                            rows={2}
                            className="bg-[#1a1a22] border-[#2a2a35] text-white"
                          />
                        </div>
                        <button onClick={() => setFormData((prev) => ({ ...prev, faqs: prev.faqs.filter((_, i) => i !== idx) }))} className="text-[#9fa0b8] hover:text-red-400 mt-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button
                    onClick={() => setFormData((prev) => ({ ...prev, faqs: [...prev.faqs, { question: "", answer: "" }] }))}
                    disabled={formData.faqs.length >= MAX_FAQS}
                    variant="outline"
                    className="w-full border-dashed border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-brand disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add FAQ
                  </Button>
                  {formData.faqs.length >= MAX_FAQS && (
                    <p className="mt-2 text-[11px] text-[#6b6b7b] text-center">
                      {limitReachedLabel(MAX_FAQS, "FAQs")}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {activeSection === "questions" && (
              <motion.div
                key="questions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <IntakeQuestionsSection call={call} onUpdate={onUpdate} />
              </motion.div>
            )}

            {activeSection === "commission" && (
              <motion.div
                key="commission"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <CommissionPlanSection
                  itemType="call"
                  itemId={call._id}
                  itemName={call.title}
                  isPaid={!call.isFree && call.pricePerCall > 0}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ==================== Intake Questions Section ====================

interface IntakeQuestionsSectionProps {
  call: CallOffering;
  onUpdate: (call: CallOffering) => void;
}

function IntakeQuestionsSection({ call, onUpdate }: IntakeQuestionsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question: "",
    answerType: "text" as "text" | "file",
    isRequired: false,
  });

  const handleAddQuestion = async () => {
    if (!newQuestion.question.trim()) {
      toast.error("Question is required");
      return;
    }

    setLoading(true);
    try {
      const data = await addIntakeQuestion(call._id, newQuestion);
      onUpdate(data.callOffering);
      setNewQuestion({ question: "", answerType: "text", isRequired: false });
      setShowAddQuestion(false);
      toast.success("Question added");
    } catch (error) {
      console.error("Error adding question:", error);
      toast.error("Failed to add question");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setLoading(true);
    try {
      const data = await deleteIntakeQuestion(call._id, questionId);
      onUpdate(data.callOffering);
      toast.success("Question deleted");
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete question");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">Intake Questions</h3>
          <p className="text-sm text-[#6b6b7b] mt-1">Questions buyers must answer before purchasing</p>
        </div>
        {!showAddQuestion && (
          <Button variant="outline" size="sm" onClick={() => setShowAddQuestion(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        )}
      </div>

      {call.intakeQuestions?.length > 0 ? (
        <div className="space-y-3">
          {call.intakeQuestions.map((q, index) => (
            <motion.div
              key={q._id || `question-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-4 p-4 bg-[#1a1a22] rounded-xl border border-[#2a2a35]"
            >
              <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-brand">{index + 1}</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{q.question}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-[#6b6b7b] bg-[#2a2a35] px-2 py-1 rounded">
                    {q.answerType === "text" ? <MessageSquare className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {q.answerType === "text" ? "Text answer" : "File upload"}
                  </span>
                  {q.isRequired && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">Required</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => q._id && handleDeleteQuestion(q._id)}
                disabled={loading || !q._id}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}
        </div>
      ) : !showAddQuestion && (
        <div className="text-center py-12 bg-[#1a1a22] rounded-xl border border-dashed border-[#2a2a35]">
          <MessageSquare className="h-12 w-12 mx-auto text-[#3a3a45] mb-3" />
          <p className="text-[#6b6b7b]">No intake questions added yet</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddQuestion(true)}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Question
          </Button>
        </div>
      )}

      {showAddQuestion && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-[#1a1a22] rounded-xl border border-brand/30 space-y-4"
        >
          <div>
            <Label className="text-[#9fa0b8] text-sm">Question</Label>
            <Input
              placeholder="What do you want to accomplish?"
              value={newQuestion.question}
              onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
              className="mt-2 bg-[#0e0e12] border-[#2a2a35] text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newQuestion.isRequired}
                onChange={(e) => setNewQuestion({ ...newQuestion, isRequired: e.target.checked })}
                className="rounded border-[#2a2a35] bg-[#0e0e12] text-brand"
              />
              <span className="text-sm text-[#9fa0b8]">Required</span>
            </label>
          </div>

          <div>
            <Label className="text-[#9fa0b8] text-sm mb-2 block">Answer type</Label>
            <div className="flex gap-2">
              {[
                { value: "text", label: "Text", icon: MessageSquare },
                { value: "file", label: "File Upload", icon: Upload },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setNewQuestion({ ...newQuestion, answerType: type.value as any })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors",
                    newQuestion.answerType === type.value
                      ? "bg-brand text-brand-foreground border-brand"
                      : "bg-[#0e0e12] text-white border-[#2a2a35] hover:border-brand/50"
                  )}
                >
                  <type.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowAddQuestion(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAddQuestion}
              disabled={loading}
              className="flex-1 bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Question"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ==================== Call Detail View (Stakeholder) ====================

interface CallDetailViewProps {
  call: CallOffering;
  onBack: () => void;
  formatCurrency: (value: number, currency?: string) => string;
  onPurchase: () => void;
}

function CallDetailView({ call, onBack, formatCurrency, onPurchase }: CallDetailViewProps) {
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<"select" | "answers" | "confirm">("select");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [orderData, setOrderData] = useState<{ key?: string; currency?: string } | null>(null);
  const [discountedTotalCents, setDiscountedTotalCents] = useState<number | null>(null);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);

  const creator = typeof call.createdBy === 'object' ? call.createdBy : null;
  const hasIntakeQuestions = call.intakeQuestions && call.intakeQuestions.length > 0;

  const handleProceed = () => {
    if (hasIntakeQuestions) {
      setStep("answers");
    } else {
      setStep("confirm");
    }
  };

  const handlePayment = async () => {
    if (hasIntakeQuestions) {
      const missingRequired = call.intakeQuestions?.filter(
        q => q.isRequired && !answers[q._id]?.trim()
      );
      if (missingRequired?.length > 0) {
        toast.error("Please answer all required questions");
        return;
      }
    }

    setLoading(true);
    try {
      const intakeAnswers = call.intakeQuestions?.map(q => ({
        questionId: q._id,
        question: q.question,
        answerType: q.answerType,
        textAnswer: answers[q._id] || "",
      }));

      if (call.isFree || call.pricePerCall === 0) {
        const { purchaseFreeCalls } = await import("@/lib/feed-api");
        await purchaseFreeCalls(call._id, { quantity, intakeAnswers });
        toast.success("Calls purchased successfully!");
        onPurchase();
      } else {
        const { createCallPurchaseOrder, verifyCallPayment } = await import("@/lib/feed-api");
        const orderResponse = await createCallPurchaseOrder(call._id, quantity);

        // If backend returns an invoiceId, show payment method selector
        if (orderResponse.invoiceId) {
          setInvoiceId(orderResponse.invoiceId);
          setOrderData({ key: orderResponse.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, currency: orderResponse.currency || orderResponse.order?.currency || "INR" });
          setShowPaymentSelector(true);
          setLoading(false);
          return;
        }

        const orderData = orderResponse;

        // Load Razorpay SDK dynamically if not already loaded
        const windowWithRazorpay = window as { Razorpay?: any };
        if (!windowWithRazorpay.Razorpay) {
          const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
          if (!existingScript) {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            document.body.appendChild(script);
          }

          await new Promise((resolve, reject) => {
            let attempts = 0;
            const check = () => {
              if (windowWithRazorpay.Razorpay) resolve(true);
              else if (attempts >= 50) reject(new Error("Razorpay SDK timeout"));
              else { attempts++; setTimeout(check, 100); }
            };
            check();
          });
        }

        if (!windowWithRazorpay.Razorpay) {
          toast.error("Payment system not available");
          setLoading(false);
          return;
        }

        const rzp = new windowWithRazorpay.Razorpay({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          order_id: orderData.order.id,
          name: call.title,
          description: `${quantity} call(s)`,
          handler: async (response: any) => {
            try {
              await verifyCallPayment(call._id, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                quantity,
                intakeAnswers,
              });
              toast.success("Calls purchased successfully!");
              onPurchase();
            } catch (error) {
              console.error("Payment verification failed:", error);
              toast.error("Payment verification failed");
            }
          },
          modal: {
            ondismiss: () => setLoading(false),
          },
        });
        rzp.open();
        return;
      }
    } catch (error) {
      console.error("Purchase error:", error);
      toast.error("Failed to process purchase");
    } finally {
      setLoading(false);
    }
  };

  // Called by PaymentMethodSelector after user selects currency + method
  const handlePaymentInitiated = async (data: {
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    razorpaySubscriptionId?: string;
    shortUrl?: string;
    cryptoPaymentUrl?: string;
    walletPaid?: boolean;
    stripePaid?: boolean;
    amount: number;
    currency: string;
    invoiceId: string;
  }) => {
    if (data.walletPaid || data.stripePaid) {
      toast.success("Calls purchased successfully!");
      setShowPaymentSelector(false);
      setLoading(false);
      return;
    }
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      toast.info("Complete your crypto payment in the new tab. The invoice will update automatically once confirmed.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // If we got a short URL (e.g. for crypto), redirect
      if (data.shortUrl) {
        window.open(data.shortUrl, "_blank");
        setLoading(false);
        return;
      }

      const key = data.razorpayKeyId || orderData?.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) throw new Error("Missing Razorpay key");

      // Load Razorpay SDK dynamically if not already loaded
      const windowWithRazorpay = window as { Razorpay?: any };
      if (!windowWithRazorpay.Razorpay) {
        const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (!existingScript) {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          document.body.appendChild(script);
        }

        await new Promise((resolve, reject) => {
          let attempts = 0;
          const check = () => {
            if (windowWithRazorpay.Razorpay) resolve(true);
            else if (attempts >= 50) reject(new Error("Razorpay SDK timeout"));
            else { attempts++; setTimeout(check, 100); }
          };
          check();
        });
      }

      if (!windowWithRazorpay.Razorpay) {
        toast.error("Payment system not available");
        setLoading(false);
        return;
      }

      const { verifyCallPayment } = await import("@/lib/feed-api");

      const intakeAnswers = call.intakeQuestions?.map(q => ({
        questionId: q._id,
        question: q.question,
        answerType: q.answerType,
        textAnswer: answers[q._id] || "",
      }));

      const rzp = new windowWithRazorpay.Razorpay({
        key,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpayOrderId || "",
        subscription_id: data.razorpaySubscriptionId,
        name: call.title,
        description: `${quantity} call(s)`,
        handler: async (response: any) => {
          try {
            await verifyCallPayment(call._id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              quantity,
              intakeAnswers,
            });
            toast.success("Calls purchased successfully!");
            onPurchase();
          } catch (error) {
            console.error("Payment verification failed:", error);
            toast.error("Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.open();
    } catch (error) {
      console.error("Payment initiation failed:", error);
      toast.error(error instanceof Error ? error.message : "Payment initiation failed");
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
      {/* Header */}
      <div className="border-b border-[#2a2a35] bg-gradient-to-r from-[#0e0e12] to-[#131318] px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-[#9fa0b8] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg sm:text-xl font-bold text-white truncate">{call.title}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Column - Details */}
            <div className="lg:col-span-3 space-y-6">
              {call.coverImage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="aspect-video rounded-2xl overflow-hidden border border-[#2a2a35]"
                >
                  <img src={call.coverImage} alt={call.title} className="w-full h-full object-cover" />
                </motion.div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm text-[#9fa0b8] bg-[#1a1a22] px-3 py-1.5 rounded-full border border-[#2a2a35]">
                  <Video className="h-4 w-4" />
                  Video meeting
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[#9fa0b8] bg-[#1a1a22] px-3 py-1.5 rounded-full border border-[#2a2a35]">
                  <Clock className="h-4 w-4" />
                  {call.duration} minutes
                </span>
                {call.averageRating && (
                  <span className="flex items-center gap-1.5 text-sm text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                    <Star className="h-4 w-4 fill-amber-400" />
                    {call.averageRating.toFixed(1)} ({call.reviewCount} reviews)
                  </span>
                )}
              </div>

              {call.description && (
                <div className="bg-[#1a1a22] rounded-xl border border-[#2a2a35] p-5">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand" />
                    About this call
                  </h3>
                  <p className="text-[#9fa0b8] leading-relaxed">{call.description}</p>
                </div>
              )}

              {creator && (
                <div className="bg-[#1a1a22] rounded-xl border border-[#2a2a35] p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand" />
                    Meet your host
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] flex items-center justify-center">
                      {creator.profilePicture ? (
                        <img src={creator.profilePicture} alt={creator.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-black">{creator.name?.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{creator.name}</p>
                      <p className="text-sm text-[#6b6b7b]">{creator.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {call.intakeQuestions?.length > 0 && (
                <div className="bg-[#1a1a22] rounded-xl border border-[#2a2a35] p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-brand" />
                    You&apos;ll need to answer
                  </h3>
                  <ul className="space-y-3">
                    {call.intakeQuestions.map((q, i) => (
                      <li key={q._id || `intake-${i}`} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-brand">{i + 1}</span>
                        </span>
                        <div>
                          <span className="text-[#9fa0b8]">{q.question}</span>
                          {q.isRequired && <span className="text-xs text-red-400 ml-2">*</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right Column - Purchase */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-[#1a1a22] to-[#16161c] border border-[#2a2a35] rounded-2xl p-6 sticky top-6"
              >
                {/* Step indicator */}
                {hasIntakeQuestions && (
                  <div className="flex items-center gap-2 mb-6">
                    <div className={cn("h-1 flex-1 rounded-full transition-colors", step !== "select" ? "bg-brand" : "bg-[#2a2a35]")} />
                    <div className={cn("h-1 flex-1 rounded-full transition-colors", step === "confirm" ? "bg-brand" : "bg-[#2a2a35]")} />
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {step === "select" && (
                    <motion.div
                      key="select"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <div className="text-center mb-6">
                        <div className="text-4xl font-bold text-brand">
                          {call.isFree ? "Free" : formatCurrency(call.pricePerCall, call.currency)}
                        </div>
                        <p className="text-sm text-[#6b6b7b] mt-1">per call</p>
                      </div>

                      <div className="mb-6">
                        <Label className="text-[#9fa0b8] text-sm mb-3 block">How many calls?</Label>
                        <div className="flex items-center justify-center gap-4 p-3 bg-[#0e0e12] rounded-xl border border-[#2a2a35]">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            disabled={quantity <= 1}
                            className="h-10 w-10 rounded-lg"
                          >
                            -
                          </Button>
                          <span className="text-2xl font-bold text-white w-16 text-center">{quantity}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setQuantity(quantity + 1)}
                            className="h-10 w-10 rounded-lg"
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-4 border-t border-[#2a2a35]">
                        <span className="text-[#9fa0b8]">Total</span>
                        <span className="text-2xl font-bold text-white">
                          {call.isFree ? "Free" : formatCurrency(call.pricePerCall * quantity, call.currency)}
                        </span>
                      </div>

                      <Button
                        className="w-full h-14 bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:opacity-90 text-brand-foreground font-bold text-lg shadow-lg shadow-brand/20"
                        onClick={handleProceed}
                      >
                        {call.isFree ? "Get Free Calls" : "Continue"}
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button>

                      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[#6b6b7b]">
                        <BadgeCheck className="h-4 w-4 text-emerald-400" />
                        Book anytime · No expiration
                      </div>
                    </motion.div>
                  )}

                  {step === "answers" && hasIntakeQuestions && (
                    <motion.div
                      key="answers"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <h3 className="text-lg font-semibold text-white mb-4">Answer Questions</h3>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {call.intakeQuestions?.map((q, idx) => (
                          <div key={q._id || `answer-${idx}`}>
                            <Label className="text-[#9fa0b8] text-sm">
                              {q.question}
                              {q.isRequired && <span className="text-red-400 ml-1">*</span>}
                            </Label>
                            {q.answerType === "text" ? (
                              <Textarea
                                placeholder="Your answer..."
                                value={answers[q._id || `q-${idx}`] || ""}
                                onChange={(e) => setAnswers({ ...answers, [q._id || `q-${idx}`]: e.target.value })}
                                className="mt-2 bg-[#0e0e12] border-[#2a2a35] text-white min-h-[80px]"
                              />
                            ) : (
                              <div className="mt-2 p-4 border-2 border-dashed border-[#2a2a35] rounded-xl text-center">
                                <Upload className="h-6 w-6 mx-auto text-[#6b6b7b] mb-1" />
                                <p className="text-xs text-[#6b6b7b]">File upload coming soon</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3 mt-6 pt-4 border-t border-[#2a2a35]">
                        <Button
                          variant="outline"
                          onClick={() => setStep("select")}
                          className="flex-1 border-[#2a2a35]"
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back
                        </Button>
                        <Button
                          onClick={() => setStep("confirm")}
                          className="flex-1 bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
                        >
                          Continue
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {step === "confirm" && (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <h3 className="text-lg font-semibold text-white mb-4">Confirm Purchase</h3>
                      <div className="bg-[#0e0e12] rounded-xl p-4 space-y-3 border border-[#2a2a35]">
                        <div className="flex justify-between">
                          <span className="text-[#6b6b7b]">Call</span>
                          <span className="text-white font-medium text-right truncate max-w-[60%]">{call.title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6b6b7b]">Duration</span>
                          <span className="text-white">{call.duration} mins each</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6b6b7b]">Quantity</span>
                          <span className="text-white">{quantity} call(s)</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-[#2a2a35]">
                          <span className="text-[#9fa0b8] font-medium">Total</span>
                          <span className="text-2xl font-bold text-brand">
                            {call.isFree ? "Free" : formatCurrency(call.pricePerCall * quantity, call.currency)}
                          </span>
                        </div>
                      </div>

                      {showPaymentSelector && invoiceId ? (
                        <div className="mt-6">
                          <button
                            onClick={() => {
                              setShowPaymentSelector(false);
                              setInvoiceId(null);
                              setOrderData(null);
                              setDiscountedTotalCents(null);
                              setAppliedCouponCode(null);
                            }}
                            className="flex items-center gap-1 text-sm text-[#9fa0b8] hover:text-white mb-3 transition-colors"
                          >
                            <ArrowLeft className="w-3 h-3" />
                            <span>Back</span>
                          </button>
                          {!appliedCouponCode ? (
                            <div className="mb-3">
                              <PlatformCouponInput
                                productType="call"
                                amountCents={call.pricePerCall * quantity * 100}
                                orgId={call.organizationId}
                                itemId={call._id}
                                invoiceCurrency={(orderData?.currency as "USD" | "INR") || (call.currency as "USD" | "INR") || "USD"}
                                authToken={getToken() || undefined}
                                onApplied={async (ap) => {
                                  try {
                                    const res = await fetch(`${API_URL}/api/invoices/${invoiceId}/apply-platform-coupon`, {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${getToken() || ""}`,
                                      },
                                      body: JSON.stringify({ code: ap.code }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok || !data.success) {
                                      // Throw so the coupon input rolls back instead of showing a
                                      // discount the invoice never took.
                                      throw new Error(data.error || "Failed to apply coupon");
                                    }
                                    setDiscountedTotalCents(data.invoice.totalAmount);
                                    setAppliedCouponCode(data.invoice.couponCode);
                                    toast.success("Coupon applied");
                                  } catch (err: any) {
                                    toast.error(err?.message || "Failed to apply coupon");
                                    throw err;
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-xs text-emerald-400 font-medium">
                                Coupon {appliedCouponCode} applied
                              </span>
                            </div>
                          )}
                          <PaymentMethodSelector
                            invoiceId={invoiceId}
                            itemCurrency={orderData?.currency || call.currency || "INR"}
                            totalAmount={discountedTotalCents ?? (call.pricePerCall * quantity * 100)}
                            onPaymentInitiated={handlePaymentInitiated}
                            onError={(errMsg) => toast.error(errMsg)}
                            disabled={loading}
                          />
                        </div>
                      ) : (
                        <div className="flex gap-3 mt-6">
                          <Button
                            variant="outline"
                            onClick={() => setStep(hasIntakeQuestions ? "answers" : "select")}
                            className="flex-1 border-[#2a2a35]"
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                          </Button>
                          <Button
                            onClick={handlePayment}
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground hover:opacity-90"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : call.isFree ? (
                              "Get Free Calls"
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Pay Now
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Purchases Tab (Founder) ====================

interface PurchasesTabProps {
  purchases: CallPurchase[];
  loading: boolean;
  formatCurrency: (value: number, currency?: string) => string;
}

function PurchasesTab({ purchases, loading, formatCurrency }: PurchasesTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return <EmptyState icon={Users} title="No purchases yet" description="When someone purchases your calls, they'll appear here" />;
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
      {purchases.map((purchase, index) => {
        const call = purchase.callOfferingId as CallOffering;
        const user = purchase.userId as any;
        return (
          <motion.div
            key={purchase._id}
            variants={fadeInUp}
            transition={{ delay: index * 0.05 }}
            className="bg-gradient-to-r from-[#1a1a22] to-[#1e1e26] border border-[#2a2a35] rounded-xl p-5 hover:border-brand/20 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] overflow-hidden flex-shrink-0">
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-black font-bold">
                    {user?.name?.charAt(0) || "?"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-white">{user?.name || "Unknown"}</h3>
                    <p className="text-sm text-[#6b6b7b]">{user?.email}</p>
                  </div>
                  <span className="text-lg font-bold text-brand">
                    {formatCurrency(purchase.totalAmount, purchase.currency)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className="text-sm text-[#9fa0b8] bg-[#2a2a35]/50 px-3 py-1 rounded-full">
                    {call?.title || "Call"}
                  </span>
                  <span className="text-sm text-white font-medium">
                    {purchase.quantityPurchased} calls
                  </span>
                  <span className="text-sm text-emerald-400">
                    {purchase.quantityRemaining} remaining
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ==================== My Calls Tab (Stakeholder) ====================

interface MyCallsTabProps {
  purchases: CallPurchase[];
  loading: boolean;
  formatCurrency: (value: number, currency?: string) => string;
}

function MyCallsTab({ purchases, loading, formatCurrency }: MyCallsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return <EmptyState icon={Phone} title="No calls purchased" description="Browse available calls and make your first purchase" />;
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {purchases.map((purchase, index) => {
        const call = purchase.callOfferingId as CallOffering;
        return (
          <motion.div
            key={purchase._id}
            variants={fadeInUp}
            transition={{ delay: index * 0.05 }}
            className="bg-gradient-to-r from-[#1a1a22] to-[#1e1e26] border border-[#2a2a35] rounded-xl p-5 hover:border-brand/20 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#2a2a35] to-[#1a1a22] overflow-hidden flex-shrink-0">
                {call?.coverImage ? (
                  <img src={call.coverImage} alt={call.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Phone className="h-7 w-7 text-[#6b6b7b]" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-lg">{call?.title || "1:1 Call"}</h3>
                <p className="text-sm text-[#6b6b7b] mt-0.5">{call?.duration || 30} mins per call</p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="px-3 py-1.5 bg-brand/10 border border-brand/30 rounded-full">
                    <span className="text-sm text-brand font-semibold">
                      {purchase.quantityRemaining} calls remaining
                    </span>
                  </div>
                  {purchase.quantityScheduled > 0 && (
                    <span className="text-sm text-blue-400">
                      {purchase.quantityScheduled} scheduled
                    </span>
                  )}
                </div>
              </div>
              <Button
                className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold"
                disabled={purchase.quantityRemaining === 0}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Book
              </Button>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ==================== Bookings Tab ====================

interface BookingsTabProps {
  bookings: CallBooking[];
  loading: boolean;
  isFounder: boolean;
  formatCurrency: (value: number, currency?: string) => string;
  onRefresh: () => void;
}

function BookingsTab({ bookings, loading, isFounder, formatCurrency, onRefresh }: BookingsTabProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleComplete = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const { completeCallBooking } = await import("@/lib/feed-api");
      await completeCallBooking(bookingId);
      toast.success("Call marked as completed");
      onRefresh();
    } catch (error) {
      console.error("Error completing booking:", error);
      toast.error("Failed to complete booking");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const { cancelCallBooking } = await import("@/lib/feed-api");
      await cancelCallBooking(bookingId);
      toast.success("Booking cancelled");
      onRefresh();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return <EmptyState icon={Calendar} title="No scheduled calls" description={isFounder ? "Scheduled calls will appear here" : "Book a call from your purchased calls"} />;
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {bookings.map((booking, index) => {
        const call = booking.callOfferingId as CallOffering;
        const otherPerson = isFounder
          ? (booking.bookerId as any)
          : (booking.founderId as any);
        const startTime = new Date(booking.startTime);
        const endTime = new Date(booking.endTime);

        const statusStyles = {
          scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
          no_show: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
        };

        return (
          <motion.div
            key={booking._id}
            variants={fadeInUp}
            transition={{ delay: index * 0.05 }}
            className="bg-gradient-to-r from-[#1a1a22] to-[#1e1e26] border border-[#2a2a35] rounded-xl p-5 hover:border-brand/20 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] overflow-hidden flex-shrink-0">
                {otherPerson?.profilePicture ? (
                  <img src={otherPerson.profilePicture} alt={otherPerson.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-black font-bold">
                    {otherPerson?.name?.charAt(0) || "?"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-white">{call?.title || "1:1 Call"}</h3>
                    <p className="text-sm text-[#6b6b7b]">
                      {isFounder ? "with" : "by"} {otherPerson?.name || "Unknown"}
                    </p>
                  </div>
                  <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full border", statusStyles[booking.status])}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1).replace("_", " ")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[#9fa0b8]">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {startTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
              {booking.status === "scheduled" && (
                <div className="flex gap-2">
                  {isFounder && (
                    <Button
                      size="sm"
                      onClick={() => handleComplete(booking._id)}
                      disabled={actionLoading === booking._id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {actionLoading === booking._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Complete
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancel(booking._id)}
                    disabled={actionLoading === booking._id}
                    className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {booking.status === "completed" && !booking.rating && !isFounder && (
                <Button size="sm" variant="outline" className="text-brand border-brand/30">
                  <Star className="h-4 w-4 mr-1" />
                  Rate
                </Button>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default CallsPage;
