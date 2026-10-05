"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Copy,
  X,
  Check,
  Users,
  AlertCircle,
  Link2,
} from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useOrgShareOrigin } from "@/lib/hooks/useOrgShareOrigin";

interface GuestFunnelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  affiliateId: string;
  orgName?: string | null;
  orgSlug?: string | null;
  orgId?: string | null;
}

export function GuestFunnelDialog({
  isOpen,
  onClose,
  affiliateId,
  orgName,
  orgSlug,
  orgId,
}: GuestFunnelDialogProps) {
  const [copiedHq, setCopiedHq] = useState(false);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [guestLimit, setGuestLimit] = useState<number | null>(25);
  const [isProPlan, setIsProPlan] = useState(false);
  const shareOrigin = useOrgShareOrigin(orgId);

  // Check guest limit status and fetch custom domain when modal opens
  useEffect(() => {
    if (!isOpen || !orgId) return;

    async function checkGuestLimit() {
      try {
        const response = await api<{
          ok: boolean;
          guestCount: number;
          guestLimit: number | null;
          limitReached: boolean;
          planType?: string;
        }>(`/guest-auth/guest-limit-status?orgId=${orgId}`);

        if (response.ok) {
          setGuestLimitReached(response.limitReached);
          setGuestCount(response.guestCount);
          setGuestLimit(response.guestLimit);
          setIsProPlan(response.planType === "pro");
        }
      } catch (err) {
        console.error("Error checking guest limit:", err);
      }
    }

    checkGuestLimit();
  }, [isOpen, orgId]);

  // Guest links are built on the office's share origin — its own white-label
  // domain when that domain is verified AND actually serving the current app,
  // the canonical Garage origin otherwise. Resolving it here rather than
  // picking the primary verified domain locally keeps this dialog on the same
  // rule as every other share surface (see lib/hooks/useOrgShareOrigin.ts).
  const baseUrl = shareOrigin;
  const customAppDomain =
    baseUrl && !baseUrl.includes("my.garage.app")
      ? baseUrl.replace(/^https?:\/\//, "")
      : null;

  const guestSlug = orgSlug || (orgName ? slugify(orgName) : null);
  const guestPageUrl = guestSlug
    ? `${baseUrl}/guest/${guestSlug}?referCode=${affiliateId}`
    : null;

  // HQ Guest Page URL - main link
  // Override: if this is the main Garage App HQ (slug "garage-app"),
  // always point to the-network-economy with referral link intact.
  const hqSlug = guestSlug === "garage-app" ? "the-network-economy" : guestSlug;
  const hqGuestPageUrl = hqSlug
    ? `https://www.garage.app/hq/${hqSlug}?ref=${affiliateId}`
    : null;

  const handleCopyHqUrl = async () => {
    if (!hqGuestPageUrl) return;
    try {
      await navigator.clipboard.writeText(hqGuestPageUrl);
      setCopiedHq(true);
      toast.success("HQ Lobby link copied to clipboard!");

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedHq(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy link");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay - Hidden on mobile since dialog is full screen */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[700] hidden md:block"
            onClick={onClose}
          />

          {/* Dialog - Full screen on mobile, centered on desktop */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="md:hidden fixed inset-0 z-[750] bg-[#0e0e12] flex flex-col"
          >
            {/* Mobile Header */}
            <div className="px-4 py-4 pt-[calc(env(safe-area-inset-top)+72px)] border-b border-[#2a2a35] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <Link2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Share The  Lobby Link
                  </h3>
                  <p className="text-xs text-[#9fa0b8]">
                    Share this link to invite guests
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#1a1a22] hover:bg-[#2a2a35] flex items-center justify-center transition-all duration-200"
              >
                <X className="h-4 w-4 text-[#6a6a7a]" />
              </button>
            </div>

            {/* Mobile Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {guestPageUrl ? (
                <div
                  className={cn(
                    "p-4 border rounded-lg",
                    guestLimitReached
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-[#1a1a22]/50 border-[#2a2a35]"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users
                        className={cn(
                          "h-4 w-4",
                          guestLimitReached ? "text-red-400" : "text-primary"
                        )}
                      />
                      <span className="text-sm font-medium text-white">
                        Office Guest Page
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        guestLimitReached
                          ? "bg-red-500/20 text-red-400"
                          : isProPlan
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-[#2a2a35] text-[#9fa0b8]"
                      )}
                    >
                      {isProPlan
                        ? `${guestCount} guests (Unlimited)`
                        : `${guestCount}/${guestLimit} guests`}
                    </span>
                  </div>

                  {guestLimitReached ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-red-300 font-medium">
                            Guest limit reached
                          </p>
                          <p className="text-xs text-red-400/80 mt-1">
                            Your organization has reached the maximum of{" "}
                            {guestLimit} guests on the Basic plan. Upgrade to
                            Pro for unlimited guests.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* White-label / Custom Domain Link - blurred & disabled */}
                      <div className="mb-4 pb-4 border-b border-[#2a2a35] relative select-none pointer-events-none filter blur-[4px] opacity-50">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-[#6a6a7a] block">
                            {customAppDomain ? "White-label Link" : "Your Custom HQ Link"}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">
                            PRO Upgrade
                          </span>
                        </div>
                        <div className="flex items-center gap-2 p-1.5 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                          <div className="flex-1 min-w-0 px-2.5 py-1">
                            <code className="text-xs text-[#c7c7da]/60 break-all select-all block truncate">
                              {guestPageUrl || "https://custom.domain/hq/slug?ref=..."}
                            </code>
                          </div>
                          <Button
                            disabled
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-[#6a6a7a]"
                          >
                            <div className="flex items-center gap-1.5">
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </div>
                          </Button>
                        </div>
                      </div>

                      {/* HQ Lobby Link */}
                      {hqGuestPageUrl && (
                        <div>
                          <div className="flex items-center gap-2 p-1.5 bg-[#0e0e12] border border-[#2a2a35] rounded-lg hover:border-[#3a3a45] transition-all duration-200">
                            <div className="flex-1 min-w-0 px-2.5 py-1">
                              <code className="text-xs text-[#c7c7da] break-all select-all block truncate">
                                {hqGuestPageUrl}
                              </code>
                            </div>
                            <Button
                              onClick={handleCopyHqUrl}
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-8 px-3 transition-all duration-200 font-semibold text-xs rounded-md flex-shrink-0",
                                copiedHq
                                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                  : "text-[#c7c7da] hover:bg-[#1a1a22] hover:text-white"
                              )}
                            >
                              {copiedHq ? (
                                <div className="flex items-center gap-1.5">
                                  <Check className="h-3.5 w-3.5" />
                                  Copied
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </div>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-[#6a6a7a] mt-3 text-center">
                        Share this link with guests to let them view and request
                        to join your HQ.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-[#1a1a22]/50 border border-[#2a2a35] rounded-lg text-center">
                  <AlertCircle className="h-8 w-8 text-[#6a6a7a] mx-auto mb-2" />
                  <p className="text-sm text-[#9fa0b8]">
                    Guest page URL not available. Please ensure your
                    organization has a name or slug configured.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Desktop Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="hidden md:block fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[750] w-full max-w-lg bg-[#0e0e12]/98 border border-[#2a2a35] backdrop-blur-xl rounded-xl shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#2a2a35]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Share The Lobby Link
                    </h3>
                    <p className="text-sm text-[#9fa0b8]">
                      Share this link to invite guests to your office
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#1a1a22] hover:bg-[#2a2a35] flex items-center justify-center transition-all duration-200 hover:scale-105"
                >
                  <X className="h-4 w-4 text-[#6a6a7a]" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {guestPageUrl ? (
                <div
                  className={cn(
                    "p-4 border rounded-lg",
                    guestLimitReached
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-[#1a1a22]/50 border-[#2a2a35]"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users
                        className={cn(
                          "h-4 w-4",
                          guestLimitReached ? "text-red-400" : "text-primary"
                        )}
                      />
                      <span className="text-sm font-medium text-white">
                        Lobby Link
                      </span>
                    </div>
                    {/* Guest count indicator */}
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        guestLimitReached
                          ? "bg-red-500/20 text-red-400"
                          : isProPlan
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-[#2a2a35] text-[#9fa0b8]"
                      )}
                    >
                      {isProPlan
                        ? `${guestCount} guests (Unlimited)`
                        : `${guestCount}/${guestLimit} guests`}
                    </span>
                  </div>

                  {guestLimitReached ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-red-300 font-medium">
                            Guest limit reached
                          </p>
                          <p className="text-xs text-red-400/80 mt-1">
                            Your organization has reached the maximum of{" "}
                            {guestLimit} guests on the Basic plan. Upgrade to
                            Pro for unlimited guests.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* White-label / Custom Domain Link - blurred & disabled */}
                      <div className="mb-4 pb-4 border-b border-[#2a2a35] relative select-none pointer-events-none filter blur-[4px] opacity-50">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-[#6a6a7a] block">
                            {customAppDomain ? "White-label Link" : "Your Custom HQ Link"}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">
                            PRO Upgrade
                          </span>
                        </div>
                        <div className="flex items-center gap-2 p-1.5 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                          <div className="flex-1 min-w-0 px-2.5 py-1">
                            <code className="text-xs text-[#c7c7da]/60 break-all select-all block truncate">
                              {guestPageUrl || "https://custom.domain/hq/slug?ref=..."}
                            </code>
                          </div>
                          <Button
                            disabled
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-[#6a6a7a]"
                          >
                            <div className="flex items-center gap-1.5">
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </div>
                          </Button>
                        </div>
                      </div>

                      {/* HQ Lobby Link */}
                      {hqGuestPageUrl && (
                        <div>
                          <div className="flex items-center gap-2 p-1.5 bg-[#0e0e12] border border-[#2a2a35] rounded-lg hover:border-[#3a3a45] transition-all duration-200">
                            <div className="flex-1 min-w-0 px-2.5 py-1">
                              <code className="text-xs text-[#c7c7da] break-all select-all block truncate">
                                {hqGuestPageUrl}
                              </code>
                            </div>
                            <Button
                              onClick={handleCopyHqUrl}
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-8 px-3 transition-all duration-200 font-semibold text-xs rounded-md flex-shrink-0",
                                copiedHq
                                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                  : "text-[#c7c7da] hover:bg-[#1a1a22] hover:text-white"
                              )}
                            >
                              {copiedHq ? (
                                <div className="flex items-center gap-1.5">
                                  <Check className="h-3.5 w-3.5" />
                                  Copied
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </div>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-[#6a6a7a] mt-3 text-center">
                        Share this link with guests to let them view and request
                        to join your HQ.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-[#1a1a22]/50 border border-[#2a2a35] rounded-lg text-center">
                  <AlertCircle className="h-8 w-8 text-[#6a6a7a] mx-auto mb-2" />
                  <p className="text-sm text-[#9fa0b8]">
                    Guest page URL not available. Please ensure your
                    organization has a name or slug configured.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#2a2a35]">
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="w-fit h-9 border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] hover:border-[#3a3a45] transition-all duration-200 font-medium"
                >
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
