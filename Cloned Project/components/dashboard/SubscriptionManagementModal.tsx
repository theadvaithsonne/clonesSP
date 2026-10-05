"use client";

import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Calendar,
  CreditCard,
  Pause,
  Play,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Package,
  BookOpen,
  Video,
  Rss,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getSubscriptionPayments,
  Subscription,
  SubscriptionPayment,
  SubscriptionItemType,
  SubscriptionStatus,
  SubscriptionPlan,
} from "@/lib/feed-api";

interface SubscriptionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionId: string;
  orgId: string;
  onUpdate?: () => void;
}

const STATUS_COLORS: Record<SubscriptionStatus, { bg: string; text: string; label: string }> = {
  created: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Created" },
  authenticated: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Authenticated" },
  active: { bg: "bg-green-500/20", text: "text-green-400", label: "Active" },
  pending: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Pending" },
  halted: { bg: "bg-red-500/20", text: "text-red-400", label: "Halted" },
  cancelled: { bg: "bg-orange-500/20", text: "text-orange-400", label: "Cancelled" },
  completed: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Completed" },
  paused: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Paused" },
  expired: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Expired" },
};

const ITEM_TYPE_ICONS: Record<SubscriptionItemType, React.ReactNode> = {
  channel: <Rss className="w-5 h-5" />,
  course: <BookOpen className="w-5 h-5" />,
  workshop: <Video className="w-5 h-5" />,
  product: <Package className="w-5 h-5" />,
};

const PAYMENT_STATUS_ICONS: Record<string, React.ReactNode> = {
  captured: <CheckCircle className="w-4 h-4 text-green-400" />,
  failed: <XCircle className="w-4 h-4 text-red-400" />,
  refunded: <RefreshCw className="w-4 h-4 text-blue-400" />,
  authorized: <Clock className="w-4 h-4 text-yellow-400" />,
  created: <Clock className="w-4 h-4 text-gray-400" />,
};

export function SubscriptionManagementModal({
  isOpen,
  onClose,
  subscriptionId,
  orgId,
  onUpdate,
}: SubscriptionManagementModalProps) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [showPayments, setShowPayments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "pause" | null>(null);

  useEffect(() => {
    if (isOpen && subscriptionId) {
      fetchSubscription();
    }
  }, [isOpen, subscriptionId, orgId]);

  const fetchSubscription = async () => {
    setLoading(true);
    setError(null);
    try {
      const sub = await getSubscription(orgId, subscriptionId);
      setSubscription(sub);
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
      setError(err instanceof Error ? err.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    if (payments.length > 0) {
      setShowPayments(!showPayments);
      return;
    }

    try {
      const result = await getSubscriptionPayments(orgId, subscriptionId, { limit: 10 });
      setPayments(result.payments);
      setShowPayments(true);
    } catch (err) {
      console.error("Failed to fetch payments:", err);
      toast.error("Failed to load payment history");
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;
    setActionLoading("cancel");
    try {
      const updated = await cancelSubscription(orgId, subscriptionId, true);
      setSubscription(updated);
      toast.success("Subscription cancelled. Access continues until end of billing period.");
      onUpdate?.();
      setConfirmAction(null);
    } catch (err) {
      console.error("Failed to cancel subscription:", err);
      toast.error(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async () => {
    if (!subscription) return;
    setActionLoading("pause");
    try {
      const updated = await pauseSubscription(orgId, subscriptionId);
      setSubscription(updated);
      toast.success("Subscription paused");
      onUpdate?.();
      setConfirmAction(null);
    } catch (err) {
      console.error("Failed to pause subscription:", err);
      toast.error(err instanceof Error ? err.message : "Failed to pause subscription");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    if (!subscription) return;
    setActionLoading("resume");
    try {
      const updated = await resumeSubscription(orgId, subscriptionId);
      setSubscription(updated);
      toast.success("Subscription resumed");
      onUpdate?.();
    } catch (err) {
      console.error("Failed to resume subscription:", err);
      toast.error(err instanceof Error ? err.message : "Failed to resume subscription");
    } finally {
      setActionLoading(null);
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

  const getPlan = (): SubscriptionPlan | null => {
    if (!subscription) return null;
    if (typeof subscription.planId === "object") {
      return subscription.planId as SubscriptionPlan;
    }
    return subscription.planDetails || null;
  };

  if (!isOpen) return null;

  const plan = getPlan();
  const statusConfig = subscription ? STATUS_COLORS[subscription.status] : null;
  const canPause = subscription?.status === "active";
  const canResume = subscription?.status === "paused";
  const canCancel = ["active", "authenticated", "pending"].includes(subscription?.status || "");

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Manage Subscription</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a22] rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg mb-4">
              <div className="text-red-400 text-sm">{error}</div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-[#2a2a35] text-white hover:bg-[#1a1a22]"
            >
              Close
            </Button>
          </div>
        ) : subscription ? (
          <>
            {/* Subscription Header */}
            <div className="mb-6 p-4 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-brand">{ITEM_TYPE_ICONS[subscription.itemType]}</span>
                  <div>
                    <h3 className="font-semibold text-white">
                      {subscription.itemDetails?.name || plan?.name || "Subscription"}
                    </h3>
                    <p className="text-xs text-[#9fa0b8] capitalize">{subscription.itemType}</p>
                  </div>
                </div>
                {statusConfig && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                    {statusConfig.label}
                  </span>
                )}
              </div>

              {subscription.itemDetails?.description && (
                <p className="text-sm text-[#9fa0b8] mb-3 line-clamp-2">
                  {subscription.itemDetails.description}
                </p>
              )}
            </div>

            {/* Subscription Details */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
                  <div className="flex items-center gap-2 text-[#9fa0b8] text-xs mb-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    Amount
                  </div>
                  <div className="text-white font-semibold">
                    {plan ? formatCurrency(plan.amount, plan.currency) : "N/A"}
                    {plan && <span className="text-xs text-[#9fa0b8] font-normal">/{plan.period}</span>}
                  </div>
                </div>

                <div className="p-3 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
                  <div className="flex items-center gap-2 text-[#9fa0b8] text-xs mb-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Payments Made
                  </div>
                  <div className="text-white font-semibold">
                    {subscription.paidCount}
                    {subscription.totalCount && <span className="text-xs text-[#9fa0b8] font-normal"> / {subscription.totalCount}</span>}
                  </div>
                </div>

                <div className="p-3 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
                  <div className="flex items-center gap-2 text-[#9fa0b8] text-xs mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Current Period Ends
                  </div>
                  <div className="text-white font-semibold">
                    {formatDate(subscription.currentEnd)}
                  </div>
                </div>

                <div className="p-3 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
                  <div className="flex items-center gap-2 text-[#9fa0b8] text-xs mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Next Charge
                  </div>
                  <div className="text-white font-semibold">
                    {subscription.status === "cancelled" ? "Cancelled" : formatDate(subscription.chargeAt)}
                  </div>
                </div>
              </div>

              {subscription.paymentMethod && (
                <div className="p-3 bg-[#1a1a22] border border-[#2a2a35] rounded-lg flex items-center justify-between">
                  <span className="text-sm text-[#9fa0b8]">Payment Method</span>
                  <span className="text-sm text-white capitalize">{subscription.paymentMethod}</span>
                </div>
              )}

              {subscription.startedAt && (
                <div className="p-3 bg-[#1a1a22] border border-[#2a2a35] rounded-lg flex items-center justify-between">
                  <span className="text-sm text-[#9fa0b8]">Started</span>
                  <span className="text-sm text-white">{formatDate(subscription.startedAt)}</span>
                </div>
              )}
            </div>

            {/* Payment History Toggle */}
            <button
              onClick={fetchPayments}
              className="w-full p-3 bg-[#1a1a22] border border-[#2a2a35] rounded-lg flex items-center justify-between hover:bg-[#252530] transition-colors mb-4"
            >
              <span className="text-sm text-white">Payment History</span>
              {showPayments ? (
                <ChevronUp className="w-4 h-4 text-[#9fa0b8]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#9fa0b8]" />
              )}
            </button>

            {/* Payment History */}
            {showPayments && (
              <div className="mb-6 space-y-2">
                {payments.length === 0 ? (
                  <div className="text-center py-4 text-[#9fa0b8] text-sm">
                    No payment history yet
                  </div>
                ) : (
                  payments.map((payment) => (
                    <div
                      key={payment._id}
                      className="p-3 bg-[#1a1a22] border border-[#2a2a35] rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {PAYMENT_STATUS_ICONS[payment.status]}
                        <div>
                          <div className="text-sm text-white">
                            Payment #{payment.paymentNumber}
                          </div>
                          <div className="text-xs text-[#9fa0b8]">
                            {formatDate(payment.paidAt || payment.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">
                          {formatCurrency(payment.amount, payment.currency)}
                        </div>
                        <div className="text-xs text-[#9fa0b8] capitalize">{payment.status}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Confirm Action Dialog */}
            {confirmAction && (
              <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-400 mb-1">
                      {confirmAction === "cancel" ? "Cancel Subscription?" : "Pause Subscription?"}
                    </h4>
                    <p className="text-xs text-[#9fa0b8] mb-3">
                      {confirmAction === "cancel"
                        ? "Your subscription will be cancelled at the end of the current billing period. You'll retain access until then."
                        : "Your subscription will be paused. You won't be charged until you resume."}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={confirmAction === "cancel" ? handleCancel : handlePause}
                        disabled={actionLoading !== null}
                        className="bg-yellow-500 hover:bg-yellow-600 text-black"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Confirm"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmAction(null)}
                        className="border-[#2a2a35] text-white hover:bg-[#1a1a22]"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {canResume && (
                <Button
                  onClick={handleResume}
                  disabled={actionLoading !== null}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {actionLoading === "resume" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Resume
                    </>
                  )}
                </Button>
              )}

              {canPause && (
                <Button
                  onClick={() => setConfirmAction("pause")}
                  disabled={actionLoading !== null}
                  variant="outline"
                  className="flex-1 border-blue-500 text-blue-400 hover:bg-blue-500/10"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}

              {canCancel && (
                <Button
                  onClick={() => setConfirmAction("cancel")}
                  disabled={actionLoading !== null}
                  variant="outline"
                  className="flex-1 border-red-500 text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>

            {/* Close Button */}
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full mt-3 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
            >
              Close
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
