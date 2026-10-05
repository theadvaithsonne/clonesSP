"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { getToken, saveToken, saveOrgId, getUserIdFromToken } from "@/lib/auth";
import { clearRevenueNetworkCache } from "@/lib/revenue-network-cache";
import { connectSocket, getSocket } from "@/lib/socket";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/featureFlags";
import {
  Lock,
  CreditCard,
  ArrowRight,
  Loader2,
  RefreshCw,
  UserCircle,
  Building2,
  AlertTriangle,
  ExternalLink,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  canInviteStakeholders: boolean;
  subscription: {
    _id: string;
    status: string;
    currentEnd?: string;
    plan?: {
      name: string;
      slug: string;
    };
    // Trial fields
    isTrial?: boolean;
    trialStartedAt?: string;
    trialEndsAt?: string;
    daysRemaining?: number;
    trialExpired?: boolean;
  } | null;
}

interface Organization {
  id: string;
  name: string;
  role: "founder" | "stakeholder";
  icon?: string;
}

interface UnpaidInvoice {
  invoiceId: string;
  amount: number;
  status: string;
  issuedAt: string;
  shortUrl: string;
}

interface RecoveryInfo {
  isHalted: boolean;
  isPending: boolean;
  subscription: {
    _id: string;
    status: string;
    planName: string;
    currentEnd?: string;
  } | null;
  recoveryUrl: string | null;
  unpaidInvoices: UnpaidInvoice[];
  totalOutstanding: number;
  instructions: string[];
}

interface OfficeSubscriptionLockProps {
  children: React.ReactNode;
}

/**
 * Public wrapper — decides whether to mount the real lock implementation
 * or bypass it entirely. This is evaluated at build time from a
 * NEXT_PUBLIC env var, so when subscriptions are disabled the
 * implementation's hooks never run and no billing API calls are made.
 * Mirrors the backend's ENFORCE_AGENT_SUBSCRIPTION flag. Flip both to
 * restore the subscription model.
 */
export function OfficeSubscriptionLock({
  children,
}: OfficeSubscriptionLockProps) {
  if (!SUBSCRIPTIONS_ENABLED) {
    return <>{children}</>;
  }
  return <OfficeSubscriptionLockImpl>{children}</OfficeSubscriptionLockImpl>;
}

function OfficeSubscriptionLockImpl({
  children,
}: OfficeSubscriptionLockProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);
  const [loadingRecovery, setLoadingRecovery] = useState(false);
  const [pollingRecovery, setPollingRecovery] = useState(false);

  // Check if subscription is halted or pending (payment failed)
  const isPaymentFailed =
    status?.subscription?.status === "halted" ||
    status?.subscription?.status === "pending";

  useEffect(() => {
    checkSubscription();
    fetchOrganizations();
  }, []);

  // Set up Socket.IO listener for recovery events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleSubscriptionUpdate = (data: {
      type: string;
      orgId: string;
      message?: string;
    }) => {
      console.log("[OfficeSubscriptionLock] Received subscription update:", data);
      if (data.type === "recovered") {
        toast.success(data.message || "Subscription recovered!");
        // Refresh status immediately
        checkSubscription();
        setRecoveryInfo(null);
        setPollingRecovery(false);
      } else if (data.type === "halted" || data.type === "pending") {
        toast.error(data.message || "Payment issue detected");
        checkSubscription();
      }
    };

    socket.on("office:subscription:update", handleSubscriptionUpdate);

    return () => {
      socket.off("office:subscription:update", handleSubscriptionUpdate);
    };
  }, []);

  // Fetch recovery info when subscription is halted/pending
  useEffect(() => {
    if (isPaymentFailed && isFounder && currentOrgId) {
      fetchRecoveryInfo();
    }
  }, [isPaymentFailed, isFounder, currentOrgId]);

  // Poll for recovery status when user is on recovery flow
  useEffect(() => {
    if (!pollingRecovery || !currentOrgId) return;

    const pollInterval = setInterval(async () => {
      try {
        const token = getToken();
        if (!token) return;

        const response = await api<{
          success: boolean;
          wasRecovered: boolean;
          currentStatus: string;
          hasActiveSubscription: boolean;
        }>(`/checkout/office/${currentOrgId}/refresh-status`, {
          method: "POST",
        }, token);

        if (response.wasRecovered || response.hasActiveSubscription) {
          toast.success("Subscription recovered!");
          setPollingRecovery(false);
          checkSubscription();
          setRecoveryInfo(null);
        }
      } catch (error) {
        console.error("Error polling recovery status:", error);
      }
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(pollInterval);
  }, [pollingRecovery, currentOrgId]);

  const fetchRecoveryInfo = async () => {
    if (!currentOrgId) return;

    setLoadingRecovery(true);
    try {
      const token = getToken();
      if (!token) return;

      const response = await api<RecoveryInfo>(
        `/checkout/office/${currentOrgId}/recovery`,
        {},
        token
      );
      setRecoveryInfo(response);
    } catch (error) {
      console.error("Error fetching recovery info:", error);
    } finally {
      setLoadingRecovery(false);
    }
  };

  const handleRecoveryClick = () => {
    if (recoveryInfo?.recoveryUrl) {
      // Start polling when user clicks recovery
      setPollingRecovery(true);
      window.open(recoveryInfo.recoveryUrl, "_blank");
      toast.info("Update your payment method in the new tab. We'll check for recovery automatically.");
    }
  };

  const fetchOrganizations = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await api<{ user: { organizations: Organization[] } }>(
        "/auth/me",
        {},
        token
      );
      setOrganizations(response.user.organizations || []);

      // Get current org from token
      const tokenPayload = JSON.parse(atob(token.split(".")[1]));
      setCurrentOrgId(tokenPayload.orgId);
    } catch (error) {
      console.error("Error fetching organizations:", error);
    }
  };

  const switchOrganization = async (orgId: string) => {
    const userId = getUserIdFromToken();
    if (!userId || switchingOrg) return;

    setSwitchingOrg(orgId);
    try {
      const response = await api<{
        token: string;
        currentOrg: { id: string; name: string };
      }>("/auth/select-org", {
        method: "POST",
        body: JSON.stringify({ userId, orgId }),
      });

      saveToken(response.token);
      saveOrgId(orgId);
      clearRevenueNetworkCache();
      toast.success(`Switched to ${response.currentOrg.name}!`);
      connectSocket();

      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Error switching organization:", error);
      toast.error("Failed to switch organization");
      setSwitchingOrg(null);
    }
  };

  const checkSubscription = async () => {
    try {
      const token = getToken();
      if (!token) {
        return;
      }

      // Parse token to get role and orgId ID
      const tokenPayload = JSON.parse(atob(token.split(".")[1]));
      setIsFounder(tokenPayload.role === "founder");

      // Get orgId from localStorage (set during login/org selection)
      const orgId = localStorage.getItem("garage_org_id") || tokenPayload.orgId;
      if (!orgId) {
        setLoading(false);
        return;
      }

      const response = await api<SubscriptionStatus>(
        `/office-subscription/status?orgId=${orgId}`,
        {},
        token
      );

      setStatus(response);
    } catch (error) {
      console.error("Error checking subscription:", error);
      // On error, assume subscription is active to not block users
      setStatus({
        hasActiveSubscription: true,
        canInviteStakeholders: false,
        subscription: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = () => {
    router.push("/office-payment");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkSubscription();
    setRefreshing(false);
  };

  // While loading, show children (optimistic approach)
  if (loading) {
    return <>{children}</>;
  }

  // If has active subscription, show children
  if (status?.hasActiveSubscription) {
    return <>{children}</>;
  }

  // Only unlock for authenticated/active/trial subscriptions, NOT "created"
  // "created" means payment was initiated but never completed
  if (
    status?.subscription &&
    ["authenticated", "active", "trial"].includes(status.subscription.status)
  ) {
    return <>{children}</>;
  }

  // Show lock overlay (for both founders and stakeholders if no subscription exists)
  // Keep sidebar accessible by only covering the main content area
  return (
    <div className="relative w-full h-full">
      {/* Blurred content - lighter blur so office is still visible */}
      <div className="w-full h-full filter blur-[6px] brightness-[0.5] pointer-events-none select-none">
        {children}
      </div>

      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Compact lock dialog - centered in the content area */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={cn(
          "pointer-events-auto w-full mx-4 text-center p-6 bg-[#0e0e12]/95 backdrop-blur-md rounded-2xl border border-[#2a2a35]/60 shadow-xl",
          isPaymentFailed && recoveryInfo ? "max-w-md" : "max-w-sm"
        )}>
          {/* Icon - different for payment failed vs no subscription */}
          <div className={cn(
            "mb-4 inline-flex items-center justify-center w-14 h-14 rounded-full border",
            isPaymentFailed
              ? "bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30"
              : "bg-gradient-to-br from-brand/20 to-brand/5 border-brand/30"
          )}>
            {isPaymentFailed ? (
              <AlertTriangle className="w-7 h-7 text-red-400" />
            ) : (
              <Lock className="w-7 h-7 text-brand" />
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-white mb-2">
            {isPaymentFailed
              ? "Payment Failed"
              : isFounder
              ? "Office Locked"
              : "Access Restricted"}
          </h2>

          {/* Description - different content based on state */}
          {isPaymentFailed ? (
            // Payment failed state (halted/pending)
            <div className="mb-5">
              <p className="text-sm text-[#9fa0b8] mb-3">
                {status?.subscription?.status === "halted"
                  ? "Your subscription payment failed after multiple attempts."
                  : "Your payment is being processed. Please update your payment method if needed."}
              </p>
              {recoveryInfo && recoveryInfo.totalOutstanding > 0 && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
                  <p className="text-sm text-red-400 font-medium">
                    Outstanding: ${recoveryInfo.totalOutstanding.toFixed(2)}
                  </p>
                </div>
              )}
              {!isFounder && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 text-amber-400">
                    <UserCircle className="w-4 h-4 shrink-0" />
                    <p className="text-xs text-left">
                      Contact your <span className="font-semibold">Founder</span>{" "}
                      to update payment method.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : isFounder ? (
            <p className="text-sm text-[#9fa0b8] mb-5">
              Complete your subscription payment to unlock your workspace.
            </p>
          ) : (
            <div className="mb-5">
              <p className="text-sm text-[#9fa0b8] mb-3">
                Subscription payment is pending.
              </p>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 text-amber-400">
                  <UserCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs text-left">
                    Contact your <span className="font-semibold">Founder</span>{" "}
                    to complete payment.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="space-y-2">
            {isFounder ? (
              isPaymentFailed && recoveryInfo?.recoveryUrl ? (
                // Payment failed - show recovery button
                <>
                  <Button
                    onClick={handleRecoveryClick}
                    disabled={loadingRecovery}
                    className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-brand to-[#f59e0b] hover:from-[color:color-mix(in_srgb,var(--brand)_91%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_90%,black)] text-brand-foreground rounded-lg transition-all"
                  >
                    {loadingRecovery ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Update Payment Method
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>

                  {pollingRecovery && (
                    <div className="flex items-center justify-center gap-2 text-xs text-[#9fa0b8] py-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Checking for recovery...</span>
                    </div>
                  )}

                  {/* Unpaid invoices section */}
                  {recoveryInfo.unpaidInvoices.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#2a2a35]">
                      <p className="text-xs text-[#6b6b80] mb-2">
                        Unpaid Invoices ({recoveryInfo.unpaidInvoices.length})
                      </p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {recoveryInfo.unpaidInvoices.map((invoice) => (
                          <a
                            key={invoice.invoiceId}
                            href={invoice.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2 rounded-lg bg-[#1a1a22] hover:bg-[#222230] transition-colors text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-[#6b6b80]" />
                              <span className="text-[#9fa0b8]">
                                ${invoice.amount.toFixed(2)}
                              </span>
                            </div>
                            <ExternalLink className="w-3 h-3 text-[#6b6b80]" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    variant="ghost"
                    className="w-full h-9 text-sm text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] rounded-lg"
                  >
                    {refreshing ? (
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    )}
                    {refreshing ? "Checking..." : "Refresh Status"}
                  </Button>
                </>
              ) : (
                // No subscription - show pay now button
                <>
                  <Button
                    onClick={handlePayNow}
                    className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-brand to-[#f59e0b] hover:from-[color:color-mix(in_srgb,var(--brand)_91%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_90%,black)] text-brand-foreground rounded-lg transition-all"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Complete Payment
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>

                  <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    variant="ghost"
                    className="w-full h-9 text-sm text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] rounded-lg"
                  >
                    {refreshing ? (
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    )}
                    {refreshing ? "Checking..." : "Refresh Status"}
                  </Button>
                </>
              )
            ) : (
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-brand to-[#f59e0b] hover:from-[color:color-mix(in_srgb,var(--brand)_91%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_90%,black)] text-brand-foreground rounded-lg transition-all"
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {refreshing ? "Checking..." : "Check Status"}
              </Button>
            )}
          </div>

          {/* Switch Organization Section */}
          {organizations.length > 1 && (
            <div className="mt-5 pt-4 border-t border-[#2a2a35]">
              <p className="text-xs text-[#6b6b80] mb-3">
                Switch to another office
              </p>
              <div className="flex items-center justify-center gap-2">
                {organizations
                  .filter((org) => org.id !== currentOrgId)
                  .slice(0, 4)
                  .map((org) => {
                    const isSwitching = switchingOrg === org.id;
                    return (
                      <button
                        key={org.id}
                        onClick={() => switchOrganization(org.id)}
                        disabled={!!switchingOrg}
                        title={org.name}
                        className={cn(
                          "relative group transition-all",
                          isSwitching && "opacity-50"
                        )}
                      >
                        <Avatar className="h-9 w-9 border-2 border-[#2a2a35] hover:border-brand/50 transition-colors">
                          <AvatarImage src={org.icon || ""} />
                          <AvatarFallback className="text-xs bg-[#1a1a22] text-white font-medium">
                            {org.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isSwitching && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-brand" />
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Footer - minimal */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[#3a3a45]">
            <Building2 className="w-3 h-3" />
            <span className="text-[10px]">Garage Workspace</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to check subscription status (for use in other components)
export function useOfficeSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const token = getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const tokenPayload = JSON.parse(atob(token.split(".")[1]));

        // Only founders have subscriptions
        if (tokenPayload.role !== "founder") {
          setStatus({
            hasActiveSubscription: true,
            canInviteStakeholders: true,
            subscription: null,
          });
          setLoading(false);
          return;
        }

        // Get orgId from localStorage (set during login/org selection)
        const orgId =
          localStorage.getItem("garage_org_id") || tokenPayload.orgId;
        if (!orgId) {
          setLoading(false);
          return;
        }

        const response = await api<SubscriptionStatus>(
          `/office-subscription/status?orgId=${orgId}`,
          {},
          token
        );

        setStatus(response);
      } catch (error) {
        console.error("Error checking subscription:", error);
        setStatus({
          hasActiveSubscription: true,
          canInviteStakeholders: false,
          subscription: null,
        });
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, []);

  return { status, loading };
}
