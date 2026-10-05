"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Percent,
  TrendingDown,
} from "lucide-react";

interface DowngradePreview {
  canDowngrade: boolean;
  reason?: string;
  currentPlan?: {
    name: string;
    slug: string;
    amount: number;
    amountWithGst: number;
  };
  targetPlan?: {
    name: string;
    slug: string;
    amount: number;
    amountWithGst: number;
  };
  effectiveAt?: string;
  alreadyScheduled?: boolean;
  scheduledRequestedAt?: string;
  platformFeePercentageAfter?: number;
}

interface DowngradeResult {
  success: boolean;
  effectiveAt: string;
  subscription: {
    _id: string;
    status: string;
    planName: string;
  };
}

export default function DowngradeCheckoutPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<DowngradePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [downgrading, setDowngrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDowngradePreview();
  }, []);

  const loadDowngradePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const tokenPayload = JSON.parse(atob(token.split(".")[1]));

      if (tokenPayload.role !== "founder") {
        toast.error("Only founders can downgrade the plan");
        router.push("/workspace");
        return;
      }

      const orgId = localStorage.getItem("garage_org_id") || tokenPayload.orgId;

      const res = await api<DowngradePreview>(
        `/checkout/office/${orgId}/downgrade/preview`,
        {},
        token,
      );
      setPreview(res);
      // `alreadyScheduled` returns canDowngrade=false but is not an error —
      // we render the "already scheduled" panel instead of the CTA.
      if (!res.canDowngrade && res.reason && !res.alreadyScheduled) {
        setError(res.reason);
      }
    } catch (err: any) {
      console.error("Failed to load downgrade preview:", err);
      setError(err.message || "Failed to load downgrade details");
    } finally {
      setLoading(false);
    }
  };

  const handleDowngrade = useCallback(async () => {
    if (!preview?.canDowngrade) return;

    setDowngrading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const tokenPayload = JSON.parse(atob(token.split(".")[1]));
      const orgId = localStorage.getItem("garage_org_id") || tokenPayload.orgId;

      const result = await api<DowngradeResult>(
        `/checkout/office/${orgId}/downgrade/initiate`,
        { method: "POST" },
        token,
      );

      if (result.success) {
        window.dispatchEvent(new CustomEvent("subscription:downgraded"));
        toast.success(
          `Downgrade scheduled for ${formatDate(result.effectiveAt)}.`,
        );
        // Reload the preview so the page flips to the "already scheduled"
        // panel without a manual refresh.
        await loadDowngradePreview();
        setDowngrading(false);
      }
    } catch (err: any) {
      console.error("Downgrade failed:", err);
      setError(err.message || "Failed to schedule downgrade");
      toast.error(err.message || "Failed to schedule downgrade");
      setDowngrading(false);
    }
  }, [preview, router]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const daysUntil = (dateString?: string | null) => {
    if (!dateString) return null;
    const diffMs = new Date(dateString).getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#9fa0b8]" />
          <p className="text-[#9fa0b8]">Loading downgrade details...</p>
        </div>
      </div>
    );
  }

  if (error && !preview?.canDowngrade && !preview?.alreadyScheduled) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30">
            <TrendingDown className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Cannot Downgrade
          </h1>
          <p className="text-[#9fa0b8] mb-6">{error}</p>
          <Button
            onClick={() => router.push("/workspace")}
            className="bg-[#1a1a22] hover:bg-[#2a2a35] text-white border border-[#2a2a35]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Workspace
          </Button>
        </div>
      </div>
    );
  }

  const remainingDays = daysUntil(preview?.effectiveAt);

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <Button
          onClick={() => router.push("/workspace")}
          variant="ghost"
          className="mb-6 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Workspace
        </Button>

        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1a22] border border-[#2a2a35] mb-4">
            <TrendingDown className="w-4 h-4 text-[#9fa0b8]" />
            <span className="text-sm text-[#9fa0b8] font-medium">
              Change Plan
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {preview?.alreadyScheduled
              ? "Downgrade Scheduled"
              : "Downgrade to Starter"}
          </h1>
          <p className="text-[#9fa0b8]">
            {preview?.alreadyScheduled
              ? `You'll keep Pro until ${formatDate(preview?.effectiveAt)}, then Starter activates automatically.`
              : "Your Pro plan keeps running until the end of your current billing cycle. Starter activates automatically after that — no refund, nothing to pay."}
          </p>
        </div>

        {preview?.alreadyScheduled ? (
          /* Already-scheduled state — read-only status card. */
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Downgrade scheduled
                  </h2>
                  <p className="text-sm text-[#9fa0b8] mt-0.5">
                    Requested on {formatDate(preview.scheduledRequestedAt)}
                  </p>
                </div>
              </div>
              <div className="space-y-3 pl-13">
                <div className="flex justify-between text-sm">
                  <span className="text-[#9fa0b8]">Pro access ends</span>
                  <span className="text-white font-medium">
                    {formatDate(preview.effectiveAt)}
                    {remainingDays !== null && (
                      <span className="text-[#6b6b80] ml-1.5">
                        ({remainingDays} day{remainingDays === 1 ? "" : "s"})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#9fa0b8]">Starter activates</span>
                  <span className="text-white font-medium">
                    {formatDate(preview.effectiveAt)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#9fa0b8]">Next Pro charge</span>
                  <span className="text-emerald-400 font-medium">
                    None — cancelled
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-6 text-sm text-[#9fa0b8]">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-[#6b6b80] shrink-0 mt-0.5" />
                <p>
                  Changed your mind? To keep Pro, re-subscribe from the plan
                  picker after your Pro period ends and Starter activates.
                </p>
              </div>
            </div>
          </div>
        ) : (
          preview && (
            <div className="space-y-6">
              {/* What changes card */}
              <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                  What changes on Starter
                </h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-sm text-[#e6e6e6]">
                      You keep Pro until{" "}
                      <strong className="text-white">
                        {formatDate(preview.effectiveAt)}
                      </strong>
                      . Nothing changes today.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-sm text-[#e6e6e6]">
                      Starter is free — no monthly office fee.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center mt-0.5">
                      <Percent className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="text-sm text-[#e6e6e6]">
                      Platform fee on your marketplace sales changes to{" "}
                      <strong className="text-amber-300">
                        {preview.platformFeePercentageAfter ?? 10}%
                      </strong>{" "}
                      when Starter starts.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#9fa0b8]/10 flex items-center justify-center mt-0.5">
                      <Info className="w-3.5 h-3.5 text-[#9fa0b8]" />
                    </div>
                    <span className="text-sm text-[#e6e6e6]">
                      Pro-only features (unlimited stakeholders, extra
                      conference rooms) will pause once Starter takes
                      over. You can upgrade back anytime.
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline card */}
              <div className="rounded-2xl border border-[#2a2a35] bg-gradient-to-b from-[#1a1a22]/30 to-transparent p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-[#9fa0b8]" />
                  Timeline
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">Today</p>
                      <p className="text-xs text-[#9fa0b8]">
                        You&apos;re still on Pro — nothing changes.
                        Razorpay stops the next Pro charge.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">
                        {formatDate(preview.effectiveAt)}
                        {remainingDays !== null && (
                          <span className="text-[#6b6b80] font-normal ml-1.5">
                            (in {remainingDays} day
                            {remainingDays === 1 ? "" : "s"})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#9fa0b8]">
                        Pro cycle ends. Starter activates automatically at
                        $0/month.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <Button
                onClick={handleDowngrade}
                disabled={downgrading || !preview.canDowngrade}
                className={cn(
                  "w-full h-14 text-lg font-semibold bg-[#1a1a22] hover:bg-[#2a2a35] text-white border border-[#2a2a35] rounded-xl transition-all",
                  (downgrading || !preview.canDowngrade) &&
                    "opacity-70 cursor-not-allowed",
                )}
              >
                {downgrading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-5 w-5 mr-2" />
                    Schedule Downgrade for {formatDate(preview.effectiveAt)}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-[#6b6b80]">
                To keep Pro, re-subscribe from the plan picker after the
                switch takes effect.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
