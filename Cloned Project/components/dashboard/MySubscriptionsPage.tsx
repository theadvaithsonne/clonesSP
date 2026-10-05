"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  RefreshCw,
  Package,
  BookOpen,
  Video,
  Rss,
  Calendar,
  CreditCard,
  Settings,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getMySubscriptions,
  Subscription,
  SubscriptionItemType,
  SubscriptionStatus,
  SubscriptionPlan,
} from "@/lib/feed-api";
import { SubscriptionStatusBadge, PeriodBadge } from "./SubscriptionStatusBadge";
import { SubscriptionManagementModal } from "./SubscriptionManagementModal";

interface MySubscriptionsPageProps {
  orgId: string;
}

const ITEM_TYPE_ICONS: Record<SubscriptionItemType, React.ReactNode> = {
  channel: <Rss className="w-5 h-5" />,
  course: <BookOpen className="w-5 h-5" />,
  workshop: <Video className="w-5 h-5" />,
  product: <Package className="w-5 h-5" />,
};

const ITEM_TYPE_LABELS: Record<SubscriptionItemType, string> = {
  channel: "Channel",
  course: "Course",
  workshop: "Workshop",
  product: "Product",
};

type FilterStatus = "all" | "active" | "cancelled" | "paused" | "expired";

export function MySubscriptionsPage({ orgId }: MySubscriptionsPageProps) {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<SubscriptionItemType | "all">("all");
  const [selectedSubscription, setSelectedSubscription] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchSubscriptions();
  }, [orgId, filterStatus, filterType, page]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const statusFilter = filterStatus === "all" ? undefined :
        filterStatus === "expired" ? ["expired", "completed"] as SubscriptionStatus[] :
        filterStatus as SubscriptionStatus;

      const result = await getMySubscriptions(orgId, {
        status: statusFilter,
        itemType: filterType === "all" ? undefined : filterType,
        page,
        limit: 10,
      });

      setSubscriptions(result.subscriptions);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to fetch subscriptions:", err);
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(dateString));
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  const getPlan = (subscription: Subscription): SubscriptionPlan | null => {
    if (typeof subscription.planId === "object") {
      return subscription.planId as SubscriptionPlan;
    }
    return subscription.planDetails || null;
  };

  const getActiveCount = () => subscriptions.filter(s => s.status === "active").length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Subscriptions</h1>
          <p className="text-sm text-[#9fa0b8] mt-1">
            Manage your recurring subscriptions and billing
          </p>
        </div>
        <Button
          onClick={fetchSubscriptions}
          variant="outline"
          size="sm"
          className="border-[#2a2a35] text-white hover:bg-[#1a1a22]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
          <div className="text-2xl font-bold text-white">{total}</div>
          <div className="text-xs text-[#9fa0b8]">Total Subscriptions</div>
        </div>
        <div className="p-4 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
          <div className="text-2xl font-bold text-green-400">{getActiveCount()}</div>
          <div className="text-xs text-[#9fa0b8]">Active</div>
        </div>
        <div className="p-4 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
          <div className="text-2xl font-bold text-blue-400">
            {subscriptions.filter(s => s.status === "paused").length}
          </div>
          <div className="text-xs text-[#9fa0b8]">Paused</div>
        </div>
        <div className="p-4 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
          <div className="text-2xl font-bold text-orange-400">
            {subscriptions.filter(s => s.status === "cancelled").length}
          </div>
          <div className="text-xs text-[#9fa0b8]">Cancelled</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {(["all", "active", "paused", "cancelled", "expired"] as FilterStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilterStatus(status);
                setPage(1);
              }}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${filterStatus === status
                  ? "bg-brand text-brand-foreground"
                  : "bg-[#1a1a22] text-[#9fa0b8] hover:bg-[#252530]"
                }
              `}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          {(["all", "channel", "course", "workshop", "product"] as (SubscriptionItemType | "all")[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setFilterType(type);
                setPage(1);
              }}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5
                ${filterType === type
                  ? "bg-brand/20 text-brand border border-brand/30"
                  : "bg-[#1a1a22] text-[#9fa0b8] hover:bg-[#252530] border border-transparent"
                }
              `}
            >
              {type !== "all" && ITEM_TYPE_ICONS[type]}
              {type === "all" ? "All Types" : ITEM_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-[#9fa0b8] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No subscriptions found</h3>
          <p className="text-sm text-[#9fa0b8]">
            {filterStatus !== "all" || filterType !== "all"
              ? "Try adjusting your filters"
              : "You haven't subscribed to anything yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((subscription) => {
            const plan = getPlan(subscription);

            return (
              <div
                key={subscription._id}
                className="p-4 bg-[#1a1a22] border border-[#2a2a35] rounded-lg hover:border-[#3a3a45] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {/* Item Icon */}
                    <div className="p-2 bg-brand/10 rounded-lg text-brand">
                      {ITEM_TYPE_ICONS[subscription.itemType]}
                    </div>

                    {/* Item Details */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">
                          {subscription.itemDetails?.name || plan?.name || "Subscription"}
                        </h3>
                        <SubscriptionStatusBadge status={subscription.status} size="sm" />
                      </div>

                      <p className="text-xs text-[#9fa0b8] mb-2 capitalize">
                        {subscription.itemType}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#9fa0b8]">
                        {plan && (
                          <>
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3.5 h-3.5" />
                              {formatCurrency(plan.amount, plan.currency)}/{plan.period}
                            </span>
                            <PeriodBadge period={plan.period} size="sm" />
                          </>
                        )}

                        {subscription.currentEnd && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {subscription.status === "cancelled"
                              ? `Access until ${formatDate(subscription.currentEnd)}`
                              : `Renews ${formatDate(subscription.chargeAt || subscription.currentEnd)}`}
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                          {subscription.paidCount} payment{subscription.paidCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Manage Button */}
                  <Button
                    onClick={() => setSelectedSubscription(subscription._id)}
                    variant="ghost"
                    size="sm"
                    className="text-[#9fa0b8] hover:text-white hover:bg-[#252530]"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Manage
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="outline"
            size="sm"
            className="border-[#2a2a35] text-white hover:bg-[#1a1a22] disabled:opacity-50"
          >
            Previous
          </Button>
          <span className="text-sm text-[#9fa0b8]">
            Page {page} of {totalPages}
          </span>
          <Button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            variant="outline"
            size="sm"
            className="border-[#2a2a35] text-white hover:bg-[#1a1a22] disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      )}

      {/* Management Modal */}
      {selectedSubscription && (
        <SubscriptionManagementModal
          isOpen={true}
          onClose={() => setSelectedSubscription(null)}
          subscriptionId={selectedSubscription}
          orgId={orgId}
          onUpdate={fetchSubscriptions}
        />
      )}
    </div>
  );
}
