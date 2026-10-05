"use client";

import { useState, useEffect } from "react";
import {
  Briefcase,
  X,
  Package,
  Layers,
  Menu,
  Pause,
  Play,
  ArrowRight,
  Edit,
  Trash2,
  Loader2,
  Link2,
  Users,
  Clock,
  PlayCircle,
  Target,
  Star,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Shield,
} from "lucide-react";
import {
  getServices,
  getService,
  updateService,
  deleteService,
  getServiceOptIns,
  getMyServiceOptIns,
  optInToService,
  startServiceMilestone,
  completeServiceMilestone,
  createServiceMilestonePaymentOrder,
  verifyServiceMilestonePayment,
  getServicePendingPayments,
  getServiceReviews,
  type Service,
  type ServiceOpt,
  type PendingPayment,
  getTeamMembers,
  type TeamMember,
} from "@/lib/feed-api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { CompPlanBadge } from "./CommissionPlanSection";
import { CreateDigitalServiceModal, EditServiceModal, announceService } from "./ServiceFormModal";
import { ServiceMediaCarousel, buildServiceMedia } from "./ServiceMediaCarousel";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { ServiceEngagementView } from "./ServiceEngagementView";

// Helper to get orgId
function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

interface ServicesPageProps {
  initialTab?: "services" | "optins" | "myservices";
  viewRole?: "customer" | "founder";
}

export function ServicesPage({ initialTab = "services", viewRole }: ServicesPageProps = {}) {
  const { amIFounder, loading: founderLoading } = useAmIFounder();
  const isFounderMode = viewRole === "founder";
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [affiliateId, setAffiliateId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"services" | "optins" | "myservices">(initialTab);

  // The "optins" tab is the founder's roster of everyone who bought a service,
  // and it only has data in founder mode (viewRole="founder"). The shared
  // Services nav sends founders here too, where the same tab renders the
  // personal engagement list — so outside founder mode it *is* "myservices".
  // Without this the tab fetched nothing and rendered an empty My Services,
  // hiding a service the founder had just enrolled in themselves.
  const resolvedTab =
    activeTab === "optins" && !isFounderMode ? "myservices" : activeTab;

  const [optInsRefreshKey, setOptInsRefreshKey] = useState(0);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
  // Service detail/edit view state
  const [viewingService, setViewingService] = useState<Service | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      // Landing on a services tab always shows the list, not a stale detail view
      setViewingService(null);
      setEditingService(null);
      setSelectedEngagementId(null);
      setOptInsRefreshKey((k) => k + 1);
    }
  }, [initialTab]);

  // Clicking a services nav item while a detail view is open returns to the cards
  useEffect(() => {
    const handleShowList = () => {
      setViewingService(null);
      setEditingService(null);
      setSelectedEngagementId(null);
      setOptInsRefreshKey((k) => k + 1);
    };
    window.addEventListener("services:show-list", handleShowList);
    return () => window.removeEventListener("services:show-list", handleShowList);
  }, []);

  // Opt-ins state
  const [optIns, setOptIns] = useState<ServiceOpt[]>([]);
  const [loadingOptIns, setLoadingOptIns] = useState(false);
  const [myOptIns, setMyOptIns] = useState<ServiceOpt[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (showCreateModal || !!editingService || !!viewingService) {
      window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    } else {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [showCreateModal, editingService, viewingService]);

  // The founder bottom menu owns the "Create Service" action
  useEffect(() => {
    const handleOpenCreateModal = () => setShowCreateModal(true);
    window.addEventListener("services:open-create-modal", handleOpenCreateModal);
    return () => {
      window.removeEventListener("services:open-create-modal", handleOpenCreateModal);
    };
  }, []);

  // Synchronize path changes with global dashboard breadcrumbs
  useEffect(() => {
    // Editing happens in a modal over the list, so it gets no breadcrumb.
    const items: { label: string; key: string }[] = [];

    const engagement = myOptIns.find((o) => o._id === selectedEngagementId);

    if (engagement) {
      const engagementService =
        typeof engagement.serviceId === "object"
          ? (engagement.serviceId as Service)
          : null;
      items.push({
        label: engagementService?.title || "My Service",
        key: "engagement",
      });
    } else if (viewingService) {
      items.push({
        label: viewingService.title || "Service Details",
        key: "view-service",
      });
    }

    window.dispatchEvent(
      new CustomEvent("workspace:set-breadcrumbs", {
        detail: { items },
      })
    );
  }, [viewingService, selectedEngagementId, myOptIns]);

  // Handle breadcrumb clicks from the dashboard layout header
  useEffect(() => {
    const handleBreadcrumbClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ label: string; key: string; index: number }>;
      const { key } = customEvent.detail;

      if (key === "root") {
        setEditingService(null);
        setViewingService(null);
        setSelectedEngagementId(null);
      }
    };

    window.addEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    return () => {
      window.removeEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    };
  }, []);

  // Fetch services
  useEffect(() => {
    const fetchData = async () => {
      if (founderLoading) return;

      const cacheKey = `services:${isFounderMode ? "founder" : "stakeholder"}`;
      const cached = getPageCache<{ services: typeof services }>(cacheKey);
      if (cached) {
        setServices(cached.services);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const data = await getServices({ status: isFounderMode ? "all" : "active" });
        setServices(data.services);
        setPageCache(cacheKey, { services: data.services });
      } catch (error) {
        console.error("Error fetching services:", error);
        if (!cached) toast.error("Failed to load services");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isFounderMode, founderLoading]);

  // Fetch opt-ins when tab changes
  useEffect(() => {
    if (resolvedTab === "optins" && isFounderMode) {
      const fetchOptIns = async () => {
        setLoadingOptIns(true);
        try {
          // Fetch all opt-ins across all services
          const allOptIns: ServiceOpt[] = [];
          for (const service of services) {
            const data = await getServiceOptIns(service._id);
            // Inject service data into each opt-in since backend doesn't populate it
            const optInsWithService = data.optIns.map(optIn => ({
              ...optIn,
              serviceId: service, // Inject the full service object
            }));
            allOptIns.push(...optInsWithService);
          }
          setOptIns(allOptIns);
        } catch (error) {
          console.error("Error fetching opt-ins:", error);
          toast.error("Failed to load opt-ins");
        } finally {
          setLoadingOptIns(false);
        }
      };
      fetchOptIns();
    } else if (resolvedTab === "myservices") {
      const fetchMyOptIns = async () => {
        setLoadingOptIns(true);
        try {
          const [optInsData, paymentsData] = await Promise.all([
            getMyServiceOptIns(),
            getServicePendingPayments(),
          ]);
          setMyOptIns(optInsData.optIns);
          setPendingPayments(paymentsData.pendingPayments);
        } catch (error) {
          console.error("Error fetching my opt-ins:", error);
          toast.error("Failed to load my services");
        } finally {
          setLoadingOptIns(false);
        }
      };
      fetchMyOptIns();
    }
  }, [resolvedTab, isFounderMode, services, optInsRefreshKey]);

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

  // Filter services
  const filteredServices = services.filter((service) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        service.title.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query) ||
        service.tags?.some((tag) => tag.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Open service edit view (founder)
  const openServiceEdit = async (service: Service) => {
    try {
      const data = await getService(service._id);
      setEditingService(data.service);
    } catch (error) {
      console.error("Error fetching service:", error);
      toast.error("Failed to load service details");
    }
  };

  // Open service detail view (stakeholder)
  const openServiceDetail = async (service: Service) => {
    try {
      const data = await getService(service._id);
      setViewingService(data.service);
    } catch (error) {
      console.error("Error fetching service:", error);
      toast.error("Failed to load service details");
    }
  };

  // Handle service card action. Browse/Discover always opens the service page;
  // the engagement workspace is only reachable from My Services.
  const handleServiceAction = (service: Service) => {
    if (isFounderMode) {
      openServiceEdit(service);
    } else {
      openServiceDetail(service);
    }
  };

  // Deep-link support: layout.tsx dispatches this after a storefront link
  // (garage.app/digital/service/<id>?ref=…) routes here via
  // ?openApp=discover&itemType=service&itemId=…. Fires after the initialTab
  // effect above has already cleared any stale detail view, so it always wins
  // the race — same ordering the course deep link relies on.
  useEffect(() => {
    const handleOpenServiceEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ serviceId?: string }>;
      const serviceId = customEvent.detail?.serviceId;
      if (!serviceId) return;
      // Founders edit rather than browse, so send them to their own view of it.
      if (isFounderMode) {
        openServiceEdit({ _id: serviceId } as Service);
      } else {
        openServiceDetail({ _id: serviceId } as Service);
      }
    };

    window.addEventListener("services:open-service", handleOpenServiceEvent);

    // The same deep link also leaves the id in sessionStorage, because the
    // dispatch above can fire before this listener exists on a cold load. Read
    // it once and clear it, so a later visit to Services shows the list.
    let pendingId: string | null = null;
    try {
      pendingId = sessionStorage.getItem("services:pending-service-id");
      if (pendingId) sessionStorage.removeItem("services:pending-service-id");
    } catch {
      // ignore storage errors — the event above is the primary path
    }
    if (pendingId) {
      if (isFounderMode) {
        openServiceEdit({ _id: pendingId } as Service);
      } else {
        openServiceDetail({ _id: pendingId } as Service);
      }
    }

    return () => {
      window.removeEventListener("services:open-service", handleOpenServiceEvent);
    };
  }, [isFounderMode]);

  // Handle delete service
  const handleDeleteService = async (serviceId: string) => {
    try {
      await deleteService(serviceId);
      invalidatePageCache("services:");
      setServices((prev) => prev.filter((s) => s._id !== serviceId));
      toast.success("Service deleted successfully");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Failed to delete service");
    }
  };

  // Refresh services
  const refreshServices = async () => {
    try {
      invalidatePageCache("services:");
      const data = await getServices({ status: isFounderMode ? "all" : "active" });
      setServices(data.services);
      setPageCache(`services:${isFounderMode ? "founder" : "stakeholder"}`, { services: data.services });
    } catch (error) {
      console.error("Error refreshing services:", error);
    }
  };

  // Format currency
  const formatCurrency = (value: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  };

  if (loading || founderLoading) {
    return (
      <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
        <div className="border-b border-[#2a2a35] bg-[#0e0e12] px-6 py-4 animate-pulse">
          <div className="h-6 w-32 bg-[#1a1a22] rounded mb-2" />
          <div className="h-4 w-52 bg-[#1a1a22] rounded" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#0e0e12] border border-[#2a2a35] p-4 animate-pulse flex gap-4 items-center">
              <div className="h-16 w-16 bg-[#1a1a22] rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#1a1a22] rounded w-48" />
                <div className="h-3 bg-[#1a1a22] rounded w-64" />
                <div className="h-3 bg-[#1a1a22] rounded w-32" />
              </div>
              <div className="h-8 bg-[#1a1a22] rounded w-24 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Service Detail View (Stakeholder)
  if (viewingService && !isFounderMode) {
    return (
      <ServiceDetailView
        service={viewingService}
        onBack={() => setViewingService(null)}
        formatCurrency={formatCurrency}
        onOptIn={async () => {
          const data = await getService(viewingService._id);
          setViewingService(data.service);
        }}
      />
    );
  }

  // Main List View
  const activeEngagements = services.reduce(
    (sum, s) => sum + (s.activeOptIns || 0),
    0,
  );

  // Pause (archive) / resume (publish) a service straight from the card menu
  const handleToggleStatus = async (service: Service) => {
    const nextStatus = service.status === "active" ? "archived" : "active";
    try {
      const data = await updateService(service._id, { status: nextStatus });
      invalidatePageCache("services:");
      setServices((prev) =>
        prev.map((s) =>
          s._id === service._id
            ? { ...s, status: data.service?.status ?? nextStatus }
            : s,
        ),
      );
      // A draft going live for the first time gets the share popup; resuming
      // a service that was on hold is just a status change.
      if (service.status === "draft" && nextStatus === "active") {
        announceService({ ...service, ...data.service, status: "active" });
      } else {
        toast.success(
          nextStatus === "active" ? "Service published" : "Service put on hold",
        );
      }
    } catch (error) {
      console.error("Error updating service status:", error);
      toast.error("Failed to update service status");
    }
  };

  // Opens the right panel's affiliate view for this service — earnings
  // breakdown, QR code, share tools and the referral link itself — the same
  // panel the product and course cards open. The link it hands out points at
  // the garage.app storefront page for the service, whose CTA deep-links back
  // into the workspace and opens it here.
  const openAffiliatePanel = (service: Service) => {
    window.dispatchEvent(
      new CustomEvent("right-panel:open-information", {
        detail: {
          type: "affiliate",
          service,
          itemType: "service",
          affiliateId,
        },
      })
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 py-5 sm:py-6">
        <div
          className={cn(
            resolvedTab === "myservices" && selectedEngagementId
              ? "w-full"
              : "max-w-7xl mx-auto",
          )}
        >
          {resolvedTab === "services" ? (
            // Services Tab
            <>
              {/* Dashboard metrics (founder only) */}
              {isFounderMode && services.length > 0 && (
                <div className="mb-5 grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <StatCard
                    label="Active engagements"
                    value={String(activeEngagements)}
                    badge={
                      activeEngagements > 0
                        ? { text: "Live", tone: "emerald" }
                        : undefined
                    }
                  />
                  <StatCard label="Revenue this month" hint="Not tracked yet" />
                  <StatCard label="Awaiting your action" hint="Not tracked yet" />
                  <StatCard label="Overdue" hint="Not tracked yet" />
                </div>
              )}

              {services.length === 0 ? (
                isFounderMode ? (
                  <FounderEmptyState onCreate={() => setShowCreateModal(true)} />
                ) : (
                  <CustomerEmptyState />
                )
              ) : filteredServices.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2a2a35] bg-[#0e0e12] py-16 text-center">
                  <Briefcase className="mb-3 h-10 w-10 text-[#9fa0b8]" />
                  <p className="text-sm text-[#9fa0b8]">
                    No services match your search.
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-3 text-xs font-medium text-brand hover:underline"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredServices.map((service) => (
                    <ServiceCard
                      key={service._id}
                      service={service}
                      isFounder={isFounderMode}
                      onAction={() => handleServiceAction(service)}
                      onEdit={() => openServiceEdit(service)}
                      onDelete={() => setShowDeleteConfirm(service._id)}
                      onShareLink={() => openAffiliatePanel(service)}
                      onToggleStatus={() => handleToggleStatus(service)}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              )}
            </>
          ) : resolvedTab === "optins" && isFounderMode ? (
            // Opt-ins Tab (Founder)
            <OptInsView
              optIns={optIns}
              loading={loadingOptIns}
              formatCurrency={formatCurrency}
              onRefresh={async () => {
                setLoadingOptIns(true);
                try {
                  const allOptIns: ServiceOpt[] = [];
                  for (const service of services) {
                    const data = await getServiceOptIns(service._id);
                    // Inject service data into each opt-in
                    const optInsWithService = data.optIns.map(optIn => ({
                      ...optIn,
                      serviceId: service,
                    }));
                    allOptIns.push(...optInsWithService);
                  }
                  setOptIns(allOptIns);
                } catch (error) {
                  console.error("Error refreshing opt-ins:", error);
                } finally {
                  setLoadingOptIns(false);
                }
              }}
            />
          ) : (
            // My Services Tab (Stakeholder)
            <MyServicesView
              optIns={myOptIns}
              pendingPayments={pendingPayments}
              loading={loadingOptIns}
              formatCurrency={formatCurrency}
              selectedOptInId={selectedEngagementId}
              onSelectOptIn={setSelectedEngagementId}
              onRefresh={async () => {
                setLoadingOptIns(true);
                try {
                  const [optInsData, paymentsData] = await Promise.all([
                    getMyServiceOptIns(),
                    getServicePendingPayments(),
                  ]);
                  setMyOptIns(optInsData.optIns);
                  setPendingPayments(paymentsData.pendingPayments);
                } catch (error) {
                  console.error("Error refreshing my services:", error);
                } finally {
                  setLoadingOptIns(false);
                }
              }}
            />
          )}
        </div>
      </div>
      {/* Create Service Modal */}
      <CreateDigitalServiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={async (service) => {
          setShowCreateModal(false);
          invalidatePageCache("services:");
          // Refresh the services list from API
          try {
            const data = await getServices();
            setServices(data.services);
            setPageCache(`services:${isFounderMode ? "founder" : "stakeholder"}`, { services: data.services });
          } catch (error) {
            // Fallback to adding locally if API fails
            setServices((prev) => [service, ...prev]);
          }
        }}
      />

      {/* Edit Service Modal */}
      <EditServiceModal
        service={isFounderMode ? editingService : null}
        onClose={() => {
          setEditingService(null);
          refreshServices();
        }}
        onSaved={(updated) => {
          setEditingService(null);
          invalidatePageCache("services:");
          setServices((prev) =>
            prev.map((s) => (s._id === updated._id ? updated : s)),
          );
          refreshServices();
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <AlertDialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[600]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Service</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8]">
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#2a2a35]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteConfirm && handleDeleteService(showDeleteConfirm)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Status pill styling per service status
const SERVICE_STATUS_META: Record<
  Service["status"],
  { label: string; dot: string; pill: string }
> = {
  active: {
    label: "Published",
    dot: "bg-emerald-400",
    pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  draft: {
    label: "Draft",
    dot: "bg-zinc-400",
    pill: "bg-[#141414]/90 text-[#c7c7da] border-[#2a2a35]",
  },
  archived: {
    label: "On hold",
    dot: "bg-amber-400",
    pill: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
};

const STAT_BADGE_TONES: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  zinc: "bg-[#1F1F1F] text-[#9fa0b8] border-[#2a2a35]",
};

// Dashboard metric tile. Metrics without a data source render as "—" plus a hint
// instead of a fabricated number.
function StatCard({
  label,
  value,
  badge,
  hint,
}: {
  label: string;
  value?: string;
  badge?: { text: string; tone: keyof typeof STAT_BADGE_TONES };
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[#2a2a35] bg-[#141414] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[9px] font-medium uppercase tracking-wider text-[#9fa0b8]">
          {label}
        </p>
        {badge && (
          <span
            className={cn(
              "shrink-0 rounded-full border px-1.5 py-px text-[9px] font-medium",
              STAT_BADGE_TONES[badge.tone] || STAT_BADGE_TONES.zinc,
            )}
          >
            {badge.text}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <p
          className={cn(
            "text-lg font-bold leading-tight",
            value ? "text-white" : "text-[#6b6c85]",
          )}
        >
          {value ?? "—"}
        </p>
        {hint && <span className="text-[9px] text-[#6b6c85]">{hint}</span>}
      </div>
    </div>
  );
}

// Founder zero-state: no services created yet
function FounderEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center py-12 text-center">
      <div className="mb-6 inline-flex rounded-2xl border border-brand/30 bg-[#1a1a22] p-4 text-brand">
        <Package className="h-8 w-8" />
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-white">
        Sell your expertise, not just your files
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-[#9fa0b8]">
        Package your consulting, engineering, and design capabilities into
        repeatable digital service units with streamlined milestone checkouts.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 sm:grid-cols-2 gap-4 text-left">
        <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-5">
          <div className="mb-4 inline-flex rounded-lg bg-[#1a1a22] p-2.5 text-brand">
            <Layers className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">
            Fixed-scope project
          </h3>
          <p className="mt-1 text-xs text-[#9fa0b8]">
            Milestone-based billing with structured deliverables and transparent
            timelines.
          </p>
        </div>
        <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-5">
          <div className="mb-4 inline-flex rounded-lg bg-[#1a1a22] p-2.5 text-brand">
            <Clock className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">
            Retainer or hourly
          </h3>
          <p className="mt-1 text-xs text-[#9fa0b8]">
            Continuous advisory or sprint support capped by weekly hour
            allocations.
          </p>
        </div>
      </div>

      <Button
        onClick={onCreate}
        className="mt-8 h-auto rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-md transition-transform hover:scale-105 hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
      >
        Setup First Digital Service
      </Button>
    </div>
  );
}

// Customer/storefront zero-state
function CustomerEmptyState() {
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center py-12 text-center">
      <div className="mb-6 inline-flex rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-4 text-brand">
        <Package className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-semibold text-white">
        No services are currently available
      </h2>
      <p className="mt-2 text-sm text-[#9fa0b8]">Check back soon.</p>
    </div>
  );
}

// Service Card Component
function ServiceCard({
  service,
  isFounder,
  onAction,
  onEdit,
  onDelete,
  onShareLink,
  onToggleStatus,
  formatCurrency,
}: {
  service: Service;
  isFounder: boolean;
  onAction: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Opens the right panel's affiliate view (earnings, QR, referral link). */
  onShareLink: () => void;
  onToggleStatus?: () => void;
  formatCurrency: (value: number, currency?: string) => string;
}) {
  const isFree = service.paymentTiming === "free";
  const milestonesCount = service.milestones?.length || 0;
  const status = SERVICE_STATUS_META[service.status] || SERVICE_STATUS_META.draft;

  return (
    <div
      onClick={onAction}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#2a2a35] bg-[#141414] shadow-lg transition-all hover:border-[#3a3a4a]"
    >
      {/* Banner */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#1a1a22]">
        {service.coverImage ? (
          <img
            src={service.coverImage}
            alt={service.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : service.icon ? (
          <div
            className="flex h-full w-full items-center justify-center text-6xl"
            style={{ backgroundColor: service.iconBgColor || "#1a1a22" }}
          >
            {service.icon}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a22] to-[#141414]">
            <Briefcase className="h-10 w-10 text-[#4a4b5f]" />
          </div>
        )}

        {isFounder && (
          <span
            className={cn(
              "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm",
              status.pill,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
        )}

        {isFree && (
          <span className="absolute right-3 top-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400 backdrop-blur-sm">
            Free
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-1 text-base md:text-lg font-bold text-white">
          {service.title}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-[32px] text-xs text-[#9fa0b8]">
          {service.description || "No description added yet."}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] font-medium",
              milestonesCount > 0
                ? "border-brand/20 bg-brand/10 text-brand"
                : "border-[#2a2a35] bg-[#1F1F1F] text-[#9fa0b8]",
            )}
          >
            {service.pricingModel === "billable"
              ? service.hourlyConfig?.billingModelType === "retainer"
                ? "Retainer"
                : "Hourly"
              : milestonesCount > 0
                ? "Milestone"
                : "One-time"}
          </span>
          <span className="text-base font-semibold text-brand">
            {isFree
              ? "Free"
              : service.pricingModel === "billable"
                ? // Billable services carry no contract total — the rate is the
                  // only price there is until hours are logged.
                  `${formatCurrency(service.hourlyConfig?.hourlyRate || 0, service.currency)}/hr`
                : formatCurrency(service.totalPrice, service.currency)}
          </span>
        </div>

        {!isFree && service.pricingModel !== "billable" && service.totalPrice > 0 && (
          <div className="mt-2 flex justify-end">
            <CompPlanBadge
              itemType="service"
              itemId={service._id}
              price={service.totalPrice}
              currency={service.currency === "INR" ? "₹" : "$"}
              isFounder={isFounder}
            />
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#2a2a35] pt-3 text-xs text-[#9fa0b8]">
          {isFounder ? (
            <>
              <span className="truncate">
                {service.activeOptIns || 0} active
                {service.projectsCompleted > 0
                  ? ` · ${service.projectsCompleted} completed`
                  : ""}
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-[#9fa0b8] hover:bg-[#1F1F1F] hover:text-white"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-[#141414] border-[#2a2a35]"
                  >
                    <DropdownMenuItem
                      onClick={onEdit}
                      className="text-white hover:bg-[#1F1F1F]"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={onShareLink}
                      className="text-white hover:bg-[#1F1F1F]"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Affiliate link
                    </DropdownMenuItem>
                    {onToggleStatus && (
                      <DropdownMenuItem
                        onClick={onToggleStatus}
                        className="text-white hover:bg-[#1F1F1F]"
                      >
                        {service.status === "active" ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Publish
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-red-400 hover:bg-[#1F1F1F]"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <>
              <span className="flex min-w-0 items-center gap-3 truncate">
                {service.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {service.duration}
                  </span>
                )}
                {milestonesCount > 0 && (
                  <span>
                    {milestonesCount} milestone{milestonesCount !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-[#9fa0b8] hover:bg-[#1F1F1F] hover:text-brand"
                  title="Affiliate Link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareLink();
                  }}
                >
                  <Link2 className="h-4 w-4" />
                </Button>
                <span className="flex items-center gap-1 font-medium text-brand">
                  View Details
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// Opt-ins View (Founder Dashboard)
function OptInsView({
  optIns,
  loading,
  formatCurrency,
  onRefresh,
}: {
  optIns: ServiceOpt[];
  loading: boolean;
  formatCurrency: (value: number, currency?: string) => string;
  onRefresh: () => void;
}) {
  const [expandedOptIns, setExpandedOptIns] = useState<Set<string>>(new Set());
  const [processingMilestone, setProcessingMilestone] = useState<string | null>(null);

  const toggleExpanded = (optInId: string) => {
    setExpandedOptIns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(optInId)) {
        newSet.delete(optInId);
      } else {
        newSet.add(optInId);
      }
      return newSet;
    });
  };

  const handleStartMilestone = async (optInId: string, milestoneId: string) => {
    setProcessingMilestone(`${optInId}-${milestoneId}-start`);
    try {
      await startServiceMilestone(optInId, milestoneId);
      toast.success("Milestone started");
      onRefresh();
    } catch (error) {
      console.error("Error starting milestone:", error);
      toast.error("Failed to start milestone");
    } finally {
      setProcessingMilestone(null);
    }
  };

  const handleCompleteMilestone = async (optInId: string, milestoneId: string) => {
    setProcessingMilestone(`${optInId}-${milestoneId}-complete`);
    try {
      await completeServiceMilestone(optInId, milestoneId);
      toast.success("Milestone completed");
      onRefresh();
    } catch (error) {
      console.error("Error completing milestone:", error);
      toast.error("Failed to complete milestone");
    } finally {
      setProcessingMilestone(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (optIns.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-[#9fa0b8] mx-auto mb-4" />
        <p className="text-[#9fa0b8]">No opt-ins yet</p>
        <p className="text-sm text-[#9fa0b8]">When users opt-in to your services, they will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {optIns.map((optIn) => {
        const service = typeof optIn.serviceId === "object" ? optIn.serviceId as Service : null;
        const user = typeof optIn.userId === "object" ? optIn.userId : null;
        const isExpanded = expandedOptIns.has(optIn._id);

        return (
          <div key={optIn._id} className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg overflow-hidden">
            {/* Header - Clickable to expand */}
            <div
              className="p-4 cursor-pointer hover:bg-[#1a1a22] transition-colors"
              onClick={() => toggleExpanded(optIn._id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {user?.profilePicture ? (
                    <img src={user.profilePicture} alt={user?.name || ""} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#2a2a35] flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#9fa0b8]" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-white font-medium">{user?.name || "Unknown User"}</h4>
                    <p className="text-xs text-[#9fa0b8]">{user?.email}</p>
                    <p className="text-xs text-brand mt-0.5">{service?.title || "Service"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      optIn.status === "completed" ? "bg-green-500/20 text-green-400" :
                        optIn.status === "in_progress" ? "bg-blue-500/20 text-blue-400" :
                          optIn.status === "cancelled" ? "bg-red-500/20 text-red-400" :
                            "bg-yellow-500/20 text-yellow-400"
                    )}>
                      {optIn.status}
                    </span>
                    <p className="text-xs text-[#9fa0b8] mt-1">
                      {optIn.completedMilestones}/{optIn.totalMilestones} milestones
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-[#9fa0b8]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#9fa0b8]" />
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="w-full h-2 bg-[#2a2a35] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand transition-all"
                    style={{ width: `${optIn.progressPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-[#9fa0b8]">
                  <span>{optIn.progressPercentage}% complete</span>
                  {service?.paymentTiming !== "free" && (
                    <span>{formatCurrency(optIn.amountPaid, optIn.currency)} / {formatCurrency(optIn.totalAmount, optIn.currency)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Milestones Section */}
            {isExpanded && (
              <div className="border-t border-[#2a2a35] p-4 bg-[#0b0b0d]">
                <h5 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-brand" />
                  Milestones Progress
                </h5>
                <div className="space-y-3">
                  {optIn.milestonesProgress.map((milestone) => {
                    const isProcessingStart = processingMilestone === `${optIn._id}-${milestone.milestoneId}-start`;
                    const isProcessingComplete = processingMilestone === `${optIn._id}-${milestone.milestoneId}-complete`;
                    const canStart = milestone.status === "pending" &&
                      (service?.paymentTiming !== "pay_before_milestone" ||
                        !milestone.paymentRequired ||
                        milestone.paymentStatus === "paid");

                    return (
                      <div
                        key={milestone.milestoneId}
                        className="flex items-center gap-4 p-3 bg-[#1a1a22] rounded-lg"
                      >
                        {/* Status Icon */}
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          milestone.status === "completed" ? "bg-green-500/20 text-green-400" :
                            milestone.status === "in_progress" ? "bg-blue-500/20 text-blue-400" :
                              "bg-[#2a2a35] text-[#9fa0b8]"
                        )}>
                          {milestone.status === "completed" ? (
                            <Check className="w-4 h-4" />
                          ) : milestone.status === "in_progress" ? (
                            <PlayCircle className="w-4 h-4" />
                          ) : (
                            <span className="text-sm font-medium">{milestone.order}</span>
                          )}
                        </div>

                        {/* Milestone Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{milestone.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {/* Payment Status Badge */}
                            {service?.paymentTiming !== "free" && milestone.paymentRequired && (
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                milestone.paymentStatus === "paid" ? "bg-green-500/20 text-green-400" :
                                  milestone.paymentStatus === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                                    "bg-[#2a2a35] text-[#9fa0b8]"
                              )}>
                                {milestone.paymentStatus === "paid" ? "Paid" :
                                  milestone.paymentStatus === "pending" ? "Awaiting Payment" :
                                    "Not Paid"}
                              </span>
                            )}
                            {/* Completion Date */}
                            {milestone.status === "completed" && milestone.completedAt && (
                              <span className="text-xs text-[#9fa0b8]">
                                Completed {new Date(milestone.completedAt).toLocaleDateString()}
                              </span>
                            )}
                            {/* Started Date */}
                            {milestone.status === "in_progress" && milestone.startedAt && (
                              <span className="text-xs text-[#9fa0b8]">
                                Started {new Date(milestone.startedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {service?.paymentTiming !== "free" && milestone.paymentAmount > 0 && (
                            <span className="text-sm text-brand font-medium">
                              {formatCurrency(milestone.paymentAmount, milestone.currency)}
                            </span>
                          )}

                          {/* Start Button */}
                          {milestone.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartMilestone(optIn._id, milestone.milestoneId);
                              }}
                              disabled={!canStart || isProcessingStart}
                              className={cn(
                                "bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground text-xs",
                                !canStart && "opacity-50 cursor-not-allowed"
                              )}
                              title={!canStart && service?.paymentTiming === "pay_before_milestone" ? "Payment required before starting" : undefined}
                            >
                              {isProcessingStart ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Start"
                              )}
                            </Button>
                          )}

                          {/* Complete Button */}
                          {milestone.status === "in_progress" && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteMilestone(optIn._id, milestone.milestoneId);
                              }}
                              disabled={isProcessingComplete}
                              className="bg-green-500 hover:bg-green-600 text-white text-xs"
                            >
                              {isProcessingComplete ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Complete"
                              )}
                            </Button>
                          )}

                          {/* Completed Check */}
                          {milestone.status === "completed" && (
                            <div className="text-green-400">
                              <Check className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Payment Summary */}
                {service?.paymentTiming !== "free" && (
                  <div className="mt-4 pt-4 border-t border-[#2a2a35] grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-[#9fa0b8] text-xs">Paid</p>
                      <p className="text-green-400 font-medium">{formatCurrency(optIn.amountPaid, optIn.currency)}</p>
                    </div>
                    <div>
                      <p className="text-[#9fa0b8] text-xs">Pending</p>
                      <p className="text-yellow-400 font-medium">{formatCurrency(optIn.amountPending, optIn.currency)}</p>
                    </div>
                    <div>
                      <p className="text-[#9fa0b8] text-xs">Total</p>
                      <p className="text-white font-medium">{formatCurrency(optIn.totalAmount, optIn.currency)}</p>
                    </div>
                  </div>
                )}

                {/* Opted At Info */}
                <div className="mt-3 text-xs text-[#9fa0b8]">
                  Opted in on {new Date(optIn.optedAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// My Services View (Stakeholder)
function MyServicesView({
  optIns,
  pendingPayments,
  loading,
  formatCurrency,
  onRefresh,
  selectedOptInId,
  onSelectOptIn,
}: {
  optIns: ServiceOpt[];
  pendingPayments: PendingPayment[];
  loading: boolean;
  formatCurrency: (value: number, currency?: string) => string;
  onRefresh: () => void;
  selectedOptInId: string | null;
  onSelectOptIn: (optInId: string | null) => void;
}) {
  const [payingMilestone, setPayingMilestone] = useState<string | null>(null);
  const selectedOptIn = optIns.find((o) => o._id === selectedOptInId) || null;
  // Founders viewing their own engagement get the "Take to Taskroom" jump and
  // the provisioning retry; clients get neither.
  const { amIFounder } = useAmIFounder();

  // Invoice-based payment state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [paymentOrderData, setPaymentOrderData] = useState<{ key?: string; currency?: string; amount?: number; description?: string } | null>(null);

  // Helper: load Razorpay SDK script
  const loadRazorpayScript = async (): Promise<boolean> => {
    if ((window as any).Razorpay) return true;
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if ((window as any).Razorpay) resolve(true);
        else if (attempts >= 50) resolve(false);
        else { attempts++; setTimeout(check, 100); }
      };
      check();
    });
  };

  // Helper: open Razorpay checkout
  const openRazorpayCheckout = async (opts: {
    key: string;
    amount: number;
    currency: string;
    orderId: string;
    name: string;
    description: string;
    subscriptionId?: string;
    onVerify: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => Promise<void>;
    onDismiss?: () => void;
  }) => {
    const loaded = await loadRazorpayScript();
    if (!loaded || !(window as any).Razorpay) throw new Error("Payment gateway not available");

    const { getRazorpayContactForCurrentUser } = await import("@/lib/razorpayPrefill");
    const rzpOptions: any = {
      key: opts.key,
      amount: opts.amount,
      currency: opts.currency,
      order_id: opts.orderId,
      name: opts.name,
      description: opts.description,
      handler: opts.onVerify,
      modal: { ondismiss: opts.onDismiss || (() => {}) },
      theme: { color: "var(--brand)" },
      prefill: { contact: await getRazorpayContactForCurrentUser() },
    };
    if (opts.subscriptionId) rzpOptions.subscription_id = opts.subscriptionId;

    const razorpay = new (window as any).Razorpay(rzpOptions);
    razorpay.open();
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
      toast.success("Payment successful!");
      setShowPaymentSelector(false);
      setInvoiceId(null);
      setPaymentOrderData(null);
      return;
    }
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      toast.info("Complete your crypto payment in the new tab. The invoice will update automatically once confirmed.");
      return;
    }

    try {
      if (data.shortUrl) {
        window.open(data.shortUrl, "_blank");
        return;
      }

      const key = data.razorpayKeyId || paymentOrderData?.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
      if (!key) throw new Error("Missing Razorpay key");

      await openRazorpayCheckout({
        key,
        amount: data.amount,
        currency: data.currency,
        orderId: data.razorpayOrderId || "",
        name: "Service Milestone Payment",
        description: paymentOrderData?.description || "Service Payment",
        subscriptionId: data.razorpaySubscriptionId,
        onVerify: async () => {
          toast.success("Payment successful!");
          setShowPaymentSelector(false);
          setInvoiceId(null);
          setPaymentOrderData(null);
          onRefresh();
        },
      });
    } catch (err) {
      console.error("Payment initiation failed:", err);
      toast.error(err instanceof Error ? err.message : "Payment initiation failed");
    }
  };

  const handlePayment = async (payment: Pick<PendingPayment, "serviceOptId" | "milestoneId">) => {
    setPayingMilestone(payment.milestoneId);
    try {
      const orderData = await createServiceMilestonePaymentOrder(payment.serviceOptId, payment.milestoneId) as any;
      const description = `${orderData.service.title} - ${orderData.milestone.title}`;

      // If backend returns an invoiceId, show payment method selector
      if (orderData.invoiceId) {
        setInvoiceId(orderData.invoiceId);
        setPaymentOrderData({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          currency: orderData.order?.currency || "INR",
          amount: orderData.order?.amount,
          description,
        });
        setShowPaymentSelector(true);
        setPayingMilestone(null);
        return;
      }

      // Fallback: direct Razorpay flow
      await openRazorpayCheckout({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        orderId: orderData.order.id,
        name: "Service Milestone Payment",
        description,
        onVerify: async (response) => {
          try {
            await verifyServiceMilestonePayment(payment.serviceOptId, payment.milestoneId, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success("Payment successful!");
            onRefresh();
          } catch (err) {
            console.error("Payment verification error:", err);
            toast.error("Payment verification failed");
          }
        },
      });
    } catch (error) {
      console.error("Error creating payment order:", error);
      toast.error("Failed to initiate payment");
    } finally {
      setPayingMilestone(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  // Payment Method Selector — right-side slide-in drawer, matching
  // ChannelPaymentModalNew / WebinarPreJoin / WorkshopsPage / ProductsPage / CoursesPage.
  const paymentDrawer =
    showPaymentSelector && invoiceId ? (
      <div
        className="fixed inset-0 z-[9999] flex"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop — clicking cancels. */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => { setShowPaymentSelector(false); setInvoiceId(null); setPaymentOrderData(null); }}
        />

        {/* Slide-in drawer panel */}
        <div className="relative ml-auto h-full w-full sm:max-w-md bg-[#0b0b0d] border-l border-[#2a2a35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-[#2a2a35]">
            <h2 className="text-lg font-semibold text-white">Select Payment Method</h2>
            <button
              onClick={() => { setShowPaymentSelector(false); setInvoiceId(null); setPaymentOrderData(null); }}
              className="p-1.5 hover:bg-[#1a1a22] rounded-full transition-colors"
              aria-label="Close payment"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {paymentOrderData?.description && (
              <p className="text-sm text-[#9fa0b8] mb-4">{paymentOrderData.description}</p>
            )}
            <PaymentMethodSelector
              invoiceId={invoiceId}
              itemCurrency={paymentOrderData?.currency || "INR"}
              totalAmount={paymentOrderData?.amount || 0}
              onPaymentInitiated={handlePaymentInitiated}
              onError={(errMsg) => toast.error(errMsg)}
            />
          </div>
        </div>
      </div>
    ) : null;

  if (selectedOptIn) {
    const selectedService =
      typeof selectedOptIn.serviceId === "object"
        ? (selectedOptIn.serviceId as Service)
        : null;

    return (
      <div className="space-y-6">
        <ServiceEngagementView
          optIn={selectedOptIn}
          service={selectedService}
          formatCurrency={formatCurrency}
          payingMilestoneId={payingMilestone}
          isFounder={amIFounder}
          onPayMilestone={(milestoneId) =>
            handlePayment({ serviceOptId: selectedOptIn._id, milestoneId })
          }
        />
        {paymentDrawer}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {optIns.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase className="h-12 w-12 text-[#9fa0b8] mx-auto mb-4" />
          <p className="text-[#9fa0b8]">You haven&apos;t opted into any services yet</p>
          <p className="text-sm text-[#9fa0b8]">Browse available services and opt-in to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {optIns.map((optIn) => {
            const service =
              typeof optIn.serviceId === "object" ? (optIn.serviceId as Service) : null;
            const duePayments = pendingPayments.filter(
              (p) => p.serviceOptId === optIn._id,
            );

            return (
              <div
                key={optIn._id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectOptIn(optIn._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectOptIn(optIn._id);
                }}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#2a2a35] bg-[#141414] shadow-lg transition-all hover:border-[#3a3a4a]"
              >
                {/* Banner */}
                <div className="relative aspect-video w-full overflow-hidden bg-[#1a1a22]">
                  {service?.coverImage ? (
                    <img
                      src={service.coverImage}
                      alt={service.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : service?.icon ? (
                    <div
                      className="flex h-full w-full items-center justify-center text-6xl"
                      style={{ backgroundColor: service.iconBgColor || "#1a1a22" }}
                    >
                      {service.icon}
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a22] to-[#141414]">
                      <Briefcase className="h-10 w-10 text-[#4a4b5f]" />
                    </div>
                  )}

                  <span
                    className={cn(
                      "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm",
                      optIn.status === "completed"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : optIn.status === "cancelled"
                          ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                          : "border-brand/20 bg-brand/10 text-brand",
                    )}
                  >
                    {optIn.status === "in_progress"
                      ? "In progress"
                      : optIn.status === "opted"
                        ? "Opted in"
                        : optIn.status.charAt(0).toUpperCase() + optIn.status.slice(1)}
                  </span>

                  {duePayments.length > 0 && (
                    <span className="absolute right-3 top-3 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[10px] font-medium text-brand backdrop-blur-sm">
                      {duePayments.length} payment{duePayments.length !== 1 ? "s" : ""} due
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="line-clamp-1 text-base md:text-lg font-bold text-white">
                    {service?.title || "Service"}
                  </h3>
                  <p className="mt-1 text-[11px] text-[#6b6c85]">
                    Opted on {new Date(optIn.optedAt).toLocaleDateString()}
                  </p>

                  {/* Progress */}
                  <div className="mt-4">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1F1F1F]">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${optIn.progressPercentage}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#9fa0b8]">
                      <span>
                        {optIn.completedMilestones}/{optIn.totalMilestones} milestones
                      </span>
                      <span>{optIn.progressPercentage}% complete</span>
                    </div>
                  </div>

                  {/* Pending payments for this engagement */}
                  {duePayments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {duePayments.map((payment) => (
                        <div
                          key={`${payment.serviceOptId}-${payment.milestoneId}`}
                          className="flex items-center gap-2 rounded-xl border border-brand/20 bg-brand/5 p-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] text-[#9fa0b8]">
                              {payment.milestoneTitle}
                            </p>
                            <p className="text-sm font-semibold text-brand">
                              {formatCurrency(payment.amount, payment.currency)}
                            </p>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePayment(payment);
                            }}
                            disabled={payingMilestone === payment.milestoneId}
                            className="h-8 shrink-0 bg-brand px-3 text-xs font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
                          >
                            {payingMilestone === payment.milestoneId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Pay Now"
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Milestone summary */}
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#2a2a35] pt-3 text-xs text-[#9fa0b8]">
                    <span className="truncate">
                      {formatCurrency(optIn.amountPaid || 0, optIn.currency)} paid
                      {optIn.amountPending > 0
                        ? ` · ${formatCurrency(optIn.amountPending, optIn.currency)} due`
                        : ""}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-medium text-brand">
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {paymentDrawer}
    </div>
  );
}

// Service Detail View (Stakeholder)
// Escrow split for the checkout card: what the buyer pays now vs on approval
function getPaymentSplit(service: Service) {
  const milestones = service.milestones || [];
  const total = service.totalPrice || 0;
  if (service.paymentTiming === "free") return { dueToday: 0, dueLater: 0 };
  if (service.paymentTiming === "pay_before_milestone") {
    const first = milestones[0]?.paymentAmount || 0;
    return { dueToday: first, dueLater: Math.max(total - first, 0) };
  }
  return { dueToday: 0, dueLater: total };
}

function milestonePaymentLabel(service: Service) {
  if (service.paymentTiming === "free") return null;
  return service.paymentTiming === "pay_before_milestone"
    ? { text: "Paid upfront", cls: "border-amber-500/20 bg-amber-500/10 text-amber-400" }
    : { text: "Paid after approval", cls: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" };
}

function ServiceDetailView({
  service,
  onBack,
  formatCurrency,
  onOptIn,
}: {
  service: Service;
  onBack: () => void;
  formatCurrency: (value: number, currency?: string) => string;
  onOptIn: () => void;
}) {
  const [optingIn, setOptingIn] = useState(false);
  const [existingOptIn, setExistingOptIn] = useState<ServiceOpt | null>(null);
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null);
  const [founder, setFounder] = useState<TeamMember | null>(null);
  const [showAllMilestones, setShowAllMilestones] = useState(false);

  // Check if user already opted in
  useEffect(() => {
    const checkOptIn = async () => {
      try {
        const data = await import("@/lib/feed-api").then(m => m.getServiceOptIn(service._id));
        setExistingOptIn(data.optIn);
      } catch (error) {
        console.error("Error checking opt-in status:", error);
      }
    };
    checkOptIn();
  }, [service._id]);

  // Public rating summary (only rendered when the service actually has reviews)
  useEffect(() => {
    const loadReviews = async () => {
      try {
        const data = await getServiceReviews(service._id, { publicOnly: true, limit: 1 });
        if (data.total > 0) {
          setRating({ average: data.averageRating, count: data.total });
        }
      } catch (error) {
        console.error("Error loading service reviews:", error);
      }
    };
    loadReviews();
  }, [service._id]);

  // Resolve the founder that created the service so the checkout card can name them
  useEffect(() => {
    const loadFounder = async () => {
      const orgId = getOrgId();
      if (!service.createdBy || !orgId) return;
      try {
        const members = await getTeamMembers(orgId);
        const match = members?.find((m) => m._id === service.createdBy);
        if (match) setFounder(match);
      } catch (error) {
        console.error("Error loading service owner:", error);
      }
    };
    loadFounder();
  }, [service.createdBy]);

  const handleOptIn = async () => {
    setOptingIn(true);
    try {
      const data = await optInToService(service._id);
      setExistingOptIn(data.optIn);
      toast.success("Successfully opted in to service!");
      onOptIn();
    } catch (error) {
      console.error("Error opting in:", error);
      toast.error("Failed to opt-in to service");
    } finally {
      setOptingIn(false);
    }
  };

  const isFree = service.paymentTiming === "free";
  const milestones = service.milestones || [];
  const MILESTONE_PREVIEW_COUNT = 4;
  const visibleMilestones = showAllMilestones
    ? milestones
    : milestones.slice(0, MILESTONE_PREVIEW_COUNT);
  const { dueToday, dueLater } = getPaymentSplit(service);
  const paymentBadge = milestonePaymentLabel(service);
  const included = [...(service.features || []), ...(service.deliverables || [])];

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Hero + checkout card share the first row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <ServiceMediaCarousel
                items={buildServiceMedia(service)}
                fallbackIcon={service.icon}
                fallbackIconBg={service.iconBgColor}
              />
            </div>

            <div className="lg:col-span-1 rounded-2xl border border-[#2a2a35] bg-[#141414] p-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                {isFree
                  ? "Price"
                  : service.pricingModel === "billable"
                    ? "Billed hourly"
                    : "Total fixed contract price"}
              </p>
              <p className="mt-1 text-3xl font-bold text-white">
                {isFree
                  ? "Free"
                  : service.pricingModel === "billable"
                    ? `${formatCurrency(service.hourlyConfig?.hourlyRate || 0, service.currency)}/hr`
                    : formatCurrency(service.totalPrice, service.currency)}
              </p>
              {!isFree && service.pricingModel === "billable" && (
                <p className="mt-1 text-[11px] text-[#9fa0b8]">
                  {service.hourlyConfig?.hardCapEnabled &&
                  service.hourlyConfig.maxHoursPerMonth
                    ? `Capped at ${service.hourlyConfig.maxHoursPerMonth} h a month · billed ${service.hourlyConfig.billingCycle === "weekly" ? "weekly" : service.hourlyConfig.billingCycle === "bi_weekly" ? "every two weeks" : "monthly"}`
                    : `Billed ${service.hourlyConfig?.billingCycle === "weekly" ? "weekly" : service.hourlyConfig?.billingCycle === "bi_weekly" ? "every two weeks" : "monthly"} from the hours logged`}
                </p>
              )}

              {!isFree && (
                <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-[#2a2a35] bg-[#1F1F1F] p-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                      Due today
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatCurrency(dueToday, service.currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                      Due later (on approval)
                    </p>
                    <p className="mt-1 text-sm font-semibold text-brand">
                      {formatCurrency(dueLater, service.currency)}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2 text-xs text-[#9fa0b8]">
                {service.duration && (
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#6b6c85]" />
                    Delivery duration:{" "}
                    <span className="font-semibold text-white">{service.duration}</span>
                  </p>
                )}
                {founder && (
                  <p className="flex items-center gap-2">
                    {founder.profilePicture ? (
                      <img
                        src={founder.profilePicture}
                        alt={founder.name}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1F1F1F] text-[9px] font-semibold text-[#c7c7da]">
                        {founder.name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                    Founder:{" "}
                    <span className="font-semibold text-white">{founder.name}</span>
                    {rating && (
                      <span className="text-[#6b6c85]">({rating.average.toFixed(1)} rating)</span>
                    )}
                  </p>
                )}
              </div>

              {existingOptIn ? (
                <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-400">
                  <Check className="h-4 w-4" />
                  Already purchased
                </div>
              ) : (
                <Button
                  onClick={handleOptIn}
                  disabled={optingIn}
                  className="mt-5 h-11 w-full rounded-lg bg-brand text-sm font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
                >
                  {optingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isFree ? (
                    "Get Service"
                  ) : (
                    "Buy Service"
                  )}
                </Button>
              )}

              <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#2a2a35] bg-[#1F1F1F] p-3 text-[11px] text-[#9fa0b8]">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                <span>
                  Garage Pay Escrow • Approve before you pay
                  {service.projectsCompleted > 0
                    ? ` • ${service.projectsCompleted} delivered successfully`
                    : ""}
                </span>
              </div>

              {!isFree && service.totalPrice > 0 && (
                <div className="mt-4 flex justify-end">
                  <CompPlanBadge
                    itemType="service"
                    itemId={service._id}
                    price={service.totalPrice}
                    currency={service.currency === "INR" ? "₹" : "$"}
                    isFounder={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Title block */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {milestones.length > 0 && (
                <span className="rounded-md border border-brand/20 bg-brand/10 px-2 py-1 text-[10px] font-medium text-brand">
                  Milestone-based
                </span>
              )}
              {service.tags?.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-[#2a2a35] bg-[#1a1a22] px-2 py-1 text-[10px] font-medium text-[#c7c7da]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {service.title}
            </h1>

            {rating && (
              <div className="mt-2 flex items-center gap-2 text-xs text-[#9fa0b8]">
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-3.5 w-3.5",
                        i < Math.round(rating.average)
                          ? "fill-brand text-brand"
                          : "text-[#4a4b5f]",
                      )}
                    />
                  ))}
                </span>
                <span className="font-semibold text-white">
                  {rating.average.toFixed(1)}
                </span>
                <span>({rating.count})</span>
              </div>
            )}
          </div>

          {/* Who delivers it. Pay rates are stripped server-side for
              non-founders, so there is nothing here but names and roles. */}
          {(service.hourlyConfig?.team || []).length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-bold text-white">
                Your delivery team
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {(service.hourlyConfig?.team || []).map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 rounded-xl border border-[#2a2a35] bg-[#141414] p-4"
                  >
                    {member.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.image}
                        alt={member.name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a1a22] text-xs font-semibold text-[#c7c7da]">
                        {member.name
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() || "")
                          .join("") || "?"}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {member.name}
                      </p>
                      <p className="truncate text-[11px] text-[#9fa0b8]">
                        {member.role || "Delivery team"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-[#6b6c85]">
                They work in your taskroom for this engagement — their tasks show
                up on your board with their name on them.
              </p>
            </div>
          )}

          {/* Milestone stepper */}
          {milestones.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-bold text-white">
                How this works (Milestone Stepper)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {visibleMilestones.map((milestone, idx) => (
                  <div
                    key={milestone._id || idx}
                    className="flex h-full flex-col rounded-xl border border-[#2a2a35] bg-[#141414] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/15 text-[11px] font-bold text-brand">
                        {idx + 1}
                      </span>
                      {milestone.duration && (
                        <span className="text-[11px] text-[#9fa0b8]">
                          {milestone.duration}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 line-clamp-2 min-h-[40px] text-sm font-semibold text-white">
                      {milestone.title}
                    </h3>

                    {/* Pinned to the bottom so price and badge line up across cards */}
                    <div className="mt-auto pt-3">
                      <div className="flex min-h-[18px] items-end justify-between gap-2">
                        <p className="line-clamp-1 text-[11px] text-[#6b6c85]">
                          {milestone.description || ""}
                        </p>
                        {!isFree && milestone.paymentAmount > 0 && (
                          <span className="shrink-0 text-sm font-semibold text-white">
                            {formatCurrency(milestone.paymentAmount, milestone.currency)}
                          </span>
                        )}
                      </div>

                      {paymentBadge && (
                        <span
                          className={cn(
                            "mt-3 inline-flex rounded-md border px-2 py-1 text-[10px] font-medium",
                            paymentBadge.cls,
                          )}
                        >
                          {paymentBadge.text}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {milestones.length > MILESTONE_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllMilestones((prev) => !prev)}
                  className="mt-4 text-xs font-medium text-brand hover:underline"
                >
                  {showAllMilestones
                    ? "Show less"
                    : `See all ${milestones.length} milestones`}
                </button>
              )}

              <p className="mt-4 flex items-start gap-2 text-[11px] text-[#9fa0b8]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9fa0b8]" />
                All payments remain safely secured in Garage Pay escrow and are only
                released to the founder upon your direct approval of deliverables.
              </p>
            </div>
          )}

          {/* What's Included */}
          {included.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-bold text-white">What&apos;s Included</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {included.map((item, idx) => (
                  <div key={`${item}-${idx}`} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check className="h-3 w-3 text-emerald-400" />
                    </span>
                    <span className="text-sm text-[#c7c7da]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {(service.longDescription || service.description) && (
            <div>
              <h2 className="mb-3 text-lg font-bold text-white">Description</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#9fa0b8]">
                {service.longDescription || service.description}
              </p>
            </div>
          )}

          {/* Why choose us */}
          {service.whyChooseUs && service.whyChooseUs.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-bold text-white">Why choose us</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {service.whyChooseUs.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-4"
                  >
                    {item.icon && (
                      <img
                        src={item.icon}
                        alt=""
                        className="mb-3 h-8 w-8 rounded-md object-cover"
                      />
                    )}
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    {item.description && (
                      <p className="mt-1 text-xs text-[#9fa0b8]">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
