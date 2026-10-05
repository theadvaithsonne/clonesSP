"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Rss,
  Plus,
  Edit2,
  Trash2,
  Users,
  X,
  Loader2,
  RefreshCw,
  CreditCard,
  Gift,
  Info,
  Upload,
  Link2,
  Video,
  Copy,
  Check,
  Layers,
  Star,
  Sparkles,
  MessageSquare,
  HelpCircle,
  CheckCircle,
  User,
  Image as ImageIcon,
  UserPlus,
  Percent,
  Ban,
  ChevronDown,
  ChevronUp,
  Apple,
  Smartphone,
  Eye,
  Lock,
  Crop,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DescriptionEditor from "./DescriptionEditor";
import { toast } from "sonner";
import EmojiPicker, { Theme } from "emoji-picker-react";
import {
  getOrgChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  getChannelSubscribers,
  getSubscribedChannels,
  subscribeToFreeChannel,
  unsubscribeFromChannel,
  getChannelWithStats,
  setChannelDefault,
  toggleMemberPosting,
  getCombPlanForItem,
  getChannelAnalytics,
  type Channel,
  type ChannelSubscriber,
  type SubscribedChannel,
  type CombPlan,
  type ChannelAnalyticsRow,
  type ChannelAnalyticsHeaderStats,
} from "@/lib/feed-api";
import { getToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { CommissionPlanSection, saveCommissionPlan, CompPlanDisplay, CompPlanBadge } from "./CommissionPlanSection";
import { ProductEmailAlertsSection } from "@/components/dashboard/products/ProductEmailAlertsSection";
// Same reusable drawer Products + Courses use. `itemType="channel"`
// routes the save through updateChannel (org-scoped).
import ProductThankYouPageEditor from "@/components/dashboard/ProductThankYouPageEditor";
import { useEmailAlerts } from "@/components/dashboard/products/useEmailAlerts";
import { useFounderAlerts } from "@/components/dashboard/products/useFounderAlerts";
import { FounderAlertsSection } from "@/components/dashboard/products/FounderAlertsSection";
import { ChannelPaymentModalNew } from "./ChannelPaymentModalNew";
import { ReservesPanel } from "./ReservesPanel";
import ImageCropDialog, { type CropState } from "@/components/shared/ImageCropDialog";
import {
  resolveCropSource,
  resolveOriginalToRemember,
  writeCoverOriginal,
} from "@/lib/coverOriginal";

/**
 * The community banner at the top of the feed is `aspect-[4/1] md:aspect-[5/1]
 * lg:aspect-[6/1]` with `object-cover` (see FeedPageRedesigned). Cover images
 * are framed at the desktop ratio, with the mobile ratio drawn as a safe area
 * so nothing important lands in the part narrow screens trim away.
 */
const BANNER_ASPECT = 6 / 1;
const BANNER_NARROW_ASPECT = 4 / 1;

/**
 * Community table row selector.
 *
 * The old flat `bg-[#1a1a22]` box was all but invisible against the table's
 * `#0a0a0d` surface. This is a frosted-glass chip instead: a translucent white
 * fill over a blur, a bright-edge inset highlight along the top and a soft drop
 * shadow, which reads clearly on the dark table without adding a light block to
 * the page. Checked stays in the same glass idiom — a tinted blue pane rather
 * than a solid fill — so selection is obvious but never glaring.
 */
const TABLE_CHECKBOX_CLASS =
  "w-4 h-4 shrink-0 appearance-none rounded-[5px] relative cursor-pointer align-middle transition-all duration-150 " +
  "border border-white/25 bg-white/[0.08] backdrop-blur-md " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.45)] " +
  "hover:border-white/40 hover:bg-white/[0.14] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 " +
  "checked:bg-[#3b82f6]/35 checked:border-[#60a5fa]/70 " +
  "checked:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_8px_rgba(59,130,246,0.3)] " +
  "checked:after:content-[''] checked:after:absolute checked:after:left-[5px] checked:after:top-[1.5px] " +
  "checked:after:w-[5px] checked:after:h-[9px] checked:after:border-white checked:after:border-r-2 " +
  "checked:after:border-b-2 checked:after:rotate-45";
/**
 * Covers save the *whole* upload, padded so the chosen band sits dead centre.
 * `object-cover` centres its crop, so the banner still shows exactly that band
 * — while the sidebar, the sales page and any later reframe get the full
 * picture out of the same single file the schema gives us.
 */

import { FounderMembersPanel } from "./FounderMembersPanel";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, slugify } from "@/lib/utils";
import {
  useCommunityStream,
  CommunityStreamOverlay,
} from "@/components/community-stream";
import { CurrencyDropdown } from "./WorkshopsPage";
import { CardRatingRow } from "@/components/reviews";
import { useRatingSummaries } from "@/lib/hooks/useRatingSummaries";
import type { RatingSummary } from "@/lib/reviews-api";
import { MAX_BENEFITS, MAX_FAQS, limitReachedLabel } from "@/lib/form-limits";
import {
  formatSellablePrice,
  garageStorefrontUrl,
  showSellablePublished,
  subscriptionUnit,
} from "@/components/shared/SellablePublishedModal";

// Helper to format currency with .00 and explicit currency name (e.g. $10.00 USD, ₹10.00 INR)
export function formatCardPrice(amount: number, currency: string = "USD"): string {
  const symbol = currency === "INR" ? "₹" : "$";
  return `${symbol}${amount.toFixed(2)} ${currency}`;
}

// Helper to get orgId from localStorage
function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

interface ChannelFormData {
  title: string;
  description: string;
  price: string;
  currency: string;
  coverImage: string;
  isFree: boolean;
  isSubscription: boolean;
  subscriptionPeriod: "weekly" | "monthly" | "quarterly" | "yearly";
  // Channel detail page fields
  rating: string;
  ratingCount: string;
  aboutText: string;
  whatsIncluded: string[];
  benefits: { icon: string; title: string; description: string }[];
  reviews: { reviewerName: string; reviewerRole: string; reviewerAvatar: string; rating: number; text: string }[];
  faqs: { question: string; answer: string }[];
  isDefault: boolean;
  mandatoryOnJoin: boolean;
  // New form fields
  galleryImages: string[];
  videoUrl: string;
  videoFile: string;
  whoCanPost: "everyone" | "admins_only";
  gstInclusive: boolean;
  requireIosPayment: boolean;
  appleFeeInclusive: boolean;
}

const defaultFormData: ChannelFormData = {
  title: "",
  description: "",
  price: "",
  currency: "USD",
  coverImage: "",
  isFree: false,
  isSubscription: false,
  subscriptionPeriod: "monthly",
  rating: "",
  ratingCount: "",
  aboutText: "",
  whatsIncluded: [],
  benefits: [],
  reviews: [],
  faqs: [],
  isDefault: false,
  mandatoryOnJoin: false,
  galleryImages: [],
  videoUrl: "",
  videoFile: "",
  whoCanPost: "everyone",
  gstInclusive: true,
  requireIosPayment: false,
  appleFeeInclusive: false,
};

interface CommunityCardCustomerProps {
  channel: Channel;
  isSubscribed: boolean;
  isFreeChannel: boolean;
  affiliateId: string;
  orgSlug: string;
  handleSubscribeToChannel: (channelId: string) => void;
  handleCopyCheckoutLink: (channelId: string) => void;
  previewAvatars?: string[];
  /** Undefined while the batched rating summaries are still loading. */
  ratingSummary?: RatingSummary;
}

function CommunityCardCustomer({
  channel,
  isSubscribed,
  isFreeChannel,
  affiliateId,
  orgSlug,
  handleSubscribeToChannel,
  handleCopyCheckoutLink,
  previewAvatars = [],
  ratingSummary,
}: CommunityCardCustomerProps) {
  const [plan, setPlan] = useState<CombPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const defaultBlankAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%238888a0'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";

  const avatarList = useMemo(() => {
    const list = [...previewAvatars];
    const targetCount = Math.min(3, channel.memberCount || 0);
    while (list.length < targetCount) {
      list.push(defaultBlankAvatar);
    }
    if (list.length === 0 && (channel.memberCount || 0) > 0) {
      for (let i = 0; i < Math.min(3, channel.memberCount || 0); i++) {
        list.push(defaultBlankAvatar);
      }
    }
    return list;
  }, [previewAvatars, channel.memberCount]);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const result = await getCombPlanForItem("channel", channel._id);
        if (result?.plan) {
          setPlan(result.plan);
        }
      } catch (err) {
        console.error("Error loading plan:", err);
      } finally {
        setLoadingPlan(false);
      }
    };
    loadPlan();
  }, [channel._id]);

  const updatePanelPosition = useCallback(() => {
    if (triggerRef.current && expanded) {
      const rect = triggerRef.current.getBoundingClientRect();
      const panelWidth = 288; // w-72 = 18rem = 288px

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = rect.left + rect.width / 2 - panelWidth / 2;
      let top = rect.bottom + 8;

      if (left < 8) {
        left = 8;
      }
      if (left + panelWidth > viewportWidth - 8) {
        left = viewportWidth - panelWidth - 8;
      }

      const panelHeight = 320; // approximate height including header, stats, levels
      if (top + panelHeight > viewportHeight) {
        top = rect.top - panelHeight - 8;
        if (top < 8) {
          top = 8;
        }
      }

      setPanelPosition({ top, left });
    }
  }, [expanded]);

  useEffect(() => {
    updatePanelPosition();

    if (expanded) {
      window.addEventListener("scroll", updatePanelPosition, true);
      window.addEventListener("resize", updatePanelPosition);
      return () => {
        window.removeEventListener("scroll", updatePanelPosition, true);
        window.removeEventListener("resize", updatePanelPosition);
      };
    }
  }, [expanded, updatePanelPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setExpanded(false);
      }
    };

    if (expanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [expanded]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };

    if (expanded) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [expanded]);

  const formatMemberCount = (count?: number): string => {
    if (count === undefined || count === null || count === 0) return "0 Members";
    if (count === 1) return "1 member";
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M Members`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k Members`;
    }
    return `${count} Members`;
  };

  const priceVal = channel.price || 0;
  const currencySymbol = channel.currency === "INR" ? "₹" : "$";

  const calculateAmount = (percentage: number): number => {
    if (priceVal <= 0) return 0;
    const netPrice = priceVal * 0.95;
    return Math.round(((netPrice * percentage) / 100) * 100) / 100;
  };

  const formatAmount = (amount: number): string => {
    return currencySymbol + amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const platformFeePercent = plan?.platformPercentage ?? 5;
  const totalCommission = plan ? plan.levels.reduce((sum, l) => sum + l.percentage, 0) : 0;
  const sellerPercentage = 100 - platformFeePercent - totalCommission;

  const platformFeeAmount = priceVal * (platformFeePercent / 100);
  const affiliatesAmount = calculateAmount(totalCommission);
  const youKeepAmount = priceVal - platformFeeAmount - affiliatesAmount;

  const baseUrl = `${window.location.origin}/checkout/channel/${channel._id}`;
  const checkoutUrl = affiliateId ? `${baseUrl}?ref=${affiliateId}` : baseUrl;

  return (
    <div className="group relative bg-[#111114] rounded-2xl overflow-hidden border border-[#1f1f2a] hover:border-[#2a2a3a] transition-all duration-300 hover:shadow-xl hover:shadow-black/20 flex flex-col justify-between min-h-[460px]">
      <div className="flex flex-col flex-1">
        {/* Cover Image */}
        <div className="relative h-36 sm:h-40 overflow-hidden">
          {channel.coverImage ? (
            <img
              src={channel.coverImage}
              alt={channel.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1a1a22] to-[#0e0e12] flex items-center justify-center">
              <Rss className="w-10 h-10 text-[#2a2a35]" />
            </div>
          )}
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111114] via-transparent to-transparent" />
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
          <div>
            {/* Title */}
            <h3 className="text-lg font-semibold text-white mb-1.5 truncate group-hover:text-brand transition-colors">
              {channel.title}
            </h3>

            {/* Description */}
            {channel.description && (
              <div
                className="text-[#6b6b7b] text-sm leading-relaxed mb-4 line-clamp-2 min-h-[40px] [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_p]:mb-0 [&_a]:text-brand [&_a]:underline [&_a]:pointer-events-none"
                dangerouslySetInnerHTML={{ __html: sanitizeDescription(channel.description) }}
              />
            )}

            {/* Pills row (Members, Affiliate Link) */}
            <div className="flex flex-row items-center gap-1.5 mb-5 w-full justify-between">
              {/* Members Pill */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                    detail: {
                      type: "members",
                      channel: channel,
                      affiliateId: affiliateId
                    }
                  }));
                }}
                className="flex-auto flex items-center justify-center px-2 py-1.5 text-xs font-normal text-white border border-white/25 bg-white/[0.03] rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-[1.03] hover:bg-white/[0.08] hover:border-white/40 cursor-pointer active:scale-[0.98] select-none whitespace-nowrap min-w-0"
              >
                <div className="flex -space-x-1 mr-1.5 shrink-0">
                  {avatarList.map((url, idx) => (
                    <img
                      key={idx}
                      className="w-4 h-4 rounded-full border border-black object-cover bg-[#1b1b1f] shrink-0"
                      src={url}
                      alt="avatar"
                    />
                  ))}
                </div>
                <span className="whitespace-nowrap">{formatMemberCount(channel.memberCount)}</span>
              </div>

              {/* Learn More Pill */}
              <button
                id={`community-learn-more-btn-${channel._id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                    detail: {
                      type: "information",
                      channel: channel,
                      affiliateId: affiliateId
                    }
                  }));
                }}
                className="flex-auto flex items-center justify-center px-2 py-1.5 text-xs font-normal text-white border border-white/25 bg-white/[0.03] rounded-full hover:bg-white/[0.08] hover:border-white/40 hover:text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer whitespace-nowrap min-w-0"
              >
                <Info className="w-3.5 h-3.5 mr-1.5 text-white/70 shrink-0" />
                <span className="whitespace-nowrap">Learn More</span>
              </button>

              {/* Affiliate Link Pill */}
              <button
                id={`community-affiliate-link-btn-${channel._id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                    detail: {
                      type: plan ? "commission" : "affiliate",
                      channel: channel,
                      affiliateId: affiliateId
                    }
                  }));
                }}
                className="flex-auto flex items-center justify-center px-2 py-1.5 text-xs font-normal text-white border border-white/25 bg-white/[0.03] rounded-full hover:bg-white/[0.08] hover:border-white/40 hover:text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer whitespace-nowrap min-w-0"
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5 text-white/70 shrink-0" />
                <span className="whitespace-nowrap">Affiliate Link</span>
              </button>
            </div>

            {/* Ratings row */}
            <CardRatingRow
              targetType="channel"
              targetId={channel._id}
              targetName={channel.title}
              summary={ratingSummary}
              className="mb-1"
            />
          </div>

          {/* Pricing & Join Button Row (side-by-side) */}
          <div className="flex items-center justify-between mt-auto pt-3">
            {/* Pricing */}
            <div>
              {isFreeChannel ? (
                <span className="text-emerald-400 font-bold text-sm sm:text-base">Free to join</span>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-white">
                    {formatCardPrice(channel.price, channel.currency)}
                  </span>
                  {channel.isSubscription && channel.subscriptionPeriod && (
                    <span className="text-sm text-[#9fa0b8] font-semibold ml-1.5">/ {channel.subscriptionPeriod}</span>
                  )}
                </div>
              )}
            </div>

            {/* Action Button */}
            <Button
              id={`community-join-btn-${channel._id}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSubscribeToChannel(channel._id);
              }}
              disabled={isSubscribed}
              className={cn(
                "h-9 text-xs font-semibold rounded-full px-4 flex items-center gap-1.5 transition-all duration-200",
                isSubscribed
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default hover:bg-emerald-500/10"
                  : "bg-brand hover:opacity-90 text-brand-foreground shadow-lg shadow-brand/10 hover:shadow-brand/20 cursor-pointer border-none"
              )}
            >
              {isSubscribed ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Joined
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  {isFreeChannel ? "Join Community" : "Subscribe"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className="w-full">
        {loadingPlan ? (
          <div className="bg-[#2a2a35]/40 text-white/40 text-[13px] font-medium py-1.5 text-center animate-pulse">
            Checking commission structure...
          </div>
        ) : plan ? (
          <div className="bg-brand text-brand-foreground text-[13px] font-bold py-1.5 px-3 text-center leading-relaxed">
            <style>{`
              @keyframes slideArrow {
                0%, 100% { transform: translateX(0); }
                50% { transform: translateX(3px); }
              }
              .animate-slide-arrow {
                display: inline-block;
                animation: slideArrow 1.6s infinite ease-in-out;
                transition: transform 0.2s ease-in-out;
              }
              .earn-btn:hover .animate-slide-arrow {
                animation: none;
                transform: translateX(5px);
              }
            `}</style>
            <button
              ref={triggerRef}
              id={`find-out-earn-btn-${channel._id}`}
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                  detail: {
                    type: "commission",
                    channel: channel,
                    affiliateId: affiliateId
                  }
                }));
              }}
              className="earn-btn cursor-pointer font-bold transition-all duration-200 active:scale-[0.98] hover:opacity-80 inline-block bg-transparent border-none p-0"
            >
              Find out how much you can earn <span className="animate-slide-arrow ml-1">→</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#5E5E5E] text-white/95 text-[13px] font-bold py-1.5 px-3 text-center leading-relaxed">
            No commissions paid for this community
          </div>
        )}
      </div>
    </div>
  );
}

// ============= My Community Card (for "My Communities" view) =============

interface MyCommunityCardProps {
  channel: Channel;
  affiliateId: string;
  orgSlug: string;
  onUnsubscribe: (channelId: string) => void;
  previewAvatars?: string[];
  // The matching row from the user's `subscribedChannels` list — passed
  // in so the card can surface the "Cancelling — access until X" badge
  // for recurring subs that have been cancelled but aren't yet expired.
  subscribed?: SubscribedChannel;
  /** Undefined while the batched rating summaries are still loading. */
  ratingSummary?: RatingSummary;
}

function MyCommunityCard({
  channel,
  affiliateId,
  orgSlug,
  onUnsubscribe,
  previewAvatars = [],
  subscribed,
  ratingSummary,
}: MyCommunityCardProps) {
  const isCancelling = subscribed?.subscriptionStatus === "cancelled";
  const accessUntilLabel = subscribed?.accessUntil
    ? new Date(subscribed.accessUntil).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const [plan, setPlan] = useState<CombPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const result = await getCombPlanForItem("channel", channel._id);
        if (result?.plan) {
          setPlan(result.plan);
        }
      } catch (err) {
        console.error("Error loading plan:", err);
      } finally {
        setLoadingPlan(false);
      }
    };
    loadPlan();
  }, [channel._id]);

  return (
    <>
      <div className="group relative bg-[#111114] rounded-2xl overflow-hidden border border-[#1f1f2a] hover:border-[#2a2a3a] transition-all duration-300 hover:shadow-xl hover:shadow-black/20 flex flex-col justify-between min-h-[460px]">
        <div className="flex flex-col flex-1">
          {/* Cover Image */}
          <div className="relative h-36 sm:h-40 overflow-hidden">
            {channel.coverImage ? (
              <img
                src={channel.coverImage}
                alt={channel.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a1a22] to-[#0e0e12] flex items-center justify-center">
                <Rss className="w-10 h-10 text-[#2a2a35]" />
              </div>
            )}
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#111114] via-transparent to-transparent" />
          </div>

          {/* Content Body */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
            <div>
              {/* Title */}
              <h3 className="text-lg font-semibold text-white mb-1.5 truncate group-hover:text-brand transition-colors">
                {channel.title}
              </h3>

              {/* Cancelling badge — surfaces when a recurring sub has
                  been cancelled but the paid cycle hasn't ended yet.
                  Access continues until `accessUntilLabel`. Rendered on
                  the user's own "My Communities" card so they see
                  exactly when they lose access. */}
              {isCancelling && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {accessUntilLabel
                    ? `Cancelling — access until ${accessUntilLabel}`
                    : "Cancelling at end of current cycle"}
                </div>
              )}

              {/* Description */}
              {channel.description && (
                <div
                  className="text-[#6b6b7b] text-sm leading-relaxed mb-4 line-clamp-2 min-h-[40px] [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_p]:mb-0 [&_a]:text-brand [&_a]:underline [&_a]:pointer-events-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeDescription(channel.description) }}
                />
              )}

              {/* Action Pills row (Membership Details, Learn More, Affiliate Link) */}
              <div className="flex flex-row items-center gap-1.5 mb-5 w-full">
                {/* Membership Details Pill */}
                <button
                  id={`my-community-membership-btn-${channel._id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                      detail: {
                        type: "membership",
                        channel: channel,
                        affiliateId: affiliateId
                      }
                    }));
                  }}
                  className="flex-auto flex items-center justify-center px-2 py-1.5 text-xs font-normal text-white border border-white/25 bg-white/[0.03] rounded-full hover:bg-white/[0.08] hover:border-white/40 hover:text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer whitespace-nowrap min-w-0"
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5 text-white/70 shrink-0" />
                  <span className="whitespace-nowrap">Membership</span>
                </button>

                {/* Learn More Pill */}
                <button
                  id={`my-community-learn-more-btn-${channel._id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                      detail: {
                        type: "information",
                        channel: channel,
                        affiliateId: affiliateId
                      }
                    }));
                  }}
                  className="flex-auto flex items-center justify-center px-2 py-1.5 text-xs font-normal text-white border border-white/25 bg-white/[0.03] rounded-full hover:bg-white/[0.08] hover:border-white/40 hover:text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer whitespace-nowrap min-w-0"
                >
                  <Info className="w-3.5 h-3.5 mr-1.5 text-white/70 shrink-0" />
                  <span className="whitespace-nowrap">Learn More</span>
                </button>

                {/* Affiliate Link Pill */}
                <button
                  id={`my-community-affiliate-btn-${channel._id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                      detail: {
                        type: plan ? "commission" : "affiliate",
                        channel: channel,
                        affiliateId: affiliateId
                      }
                    }));
                  }}
                  className="flex-auto flex items-center justify-center px-2 py-1.5 text-xs font-normal text-white border border-white/25 bg-white/[0.03] rounded-full hover:bg-white/[0.08] hover:border-white/40 hover:text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer whitespace-nowrap min-w-0"
                >
                  <Link2 className="w-3.5 h-3.5 mr-1.5 text-white/70 shrink-0" />
                  <span className="whitespace-nowrap">Affiliate Link</span>
                </button>
              </div>

              {/* Ratings row */}
              <CardRatingRow
                targetType="channel"
                targetId={channel._id}
                targetName={channel.title}
                summary={ratingSummary}
                className="mb-1"
              />
            </div>

            {/* Unsubscribe Button */}
            <div className="mt-auto pt-3">
              <Button
                id={`my-community-unsubscribe-btn-${channel._id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(true);
                }}
                className="w-full h-10 text-sm font-semibold rounded-full bg-brand hover:opacity-90 text-brand-foreground shadow-lg shadow-brand/10 hover:shadow-brand/20 cursor-pointer border-none transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Ban className="w-4 h-4 shrink-0" />
                Unsubscribe
              </Button>
            </div>
          </div>
        </div>

        {/* Footer bar — commission info */}
        <div className="w-full">
          {loadingPlan ? (
            <div className="bg-[#2a2a35]/40 text-white/40 text-[13px] font-medium py-1.5 text-center animate-pulse">
              Checking commission structure...
            </div>
          ) : plan ? (
            <div className="bg-brand text-brand-foreground text-[13px] font-bold py-1.5 px-3 text-center leading-relaxed">
              <style>{`
                @keyframes slideArrowMy {
                  0%, 100% { transform: translateX(0); }
                  50% { transform: translateX(3px); }
                }
                .animate-slide-arrow-my {
                  display: inline-block;
                  animation: slideArrowMy 1.6s infinite ease-in-out;
                  transition: transform 0.2s ease-in-out;
                }
                .earn-btn-my:hover .animate-slide-arrow-my {
                  animation: none;
                  transform: translateX(5px);
                }
              `}</style>
              <button
                id={`my-find-out-earn-btn-${channel._id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                    detail: {
                      type: "commission",
                      channel: channel,
                      affiliateId: affiliateId
                    }
                  }));
                }}
                className="earn-btn-my cursor-pointer font-bold transition-all duration-200 active:scale-[0.98] hover:opacity-80 inline-block bg-transparent border-none p-0"
              >
                Find out how much you can earn <span className="animate-slide-arrow-my ml-1">→</span>
              </button>
            </div>
          ) : (
            <div className="bg-[#5E5E5E] text-white/95 text-[13px] font-bold py-1.5 px-3 text-center leading-relaxed">
              No commissions paid for this community
            </div>
          )}
        </div>
      </div>

      {/* Unsubscribe Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-[#111114] border-[#2a2a35] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-lg">
              Unsubscribe from {channel.title}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8] text-sm">
              You will lose access to this community&apos;s feeds and content.
              {channel.isSubscription && " Your subscription will be cancelled at the end of the current billing cycle."}
              {!channel.isSubscription && !channel.isFree && channel.price > 0 && " You may need to pay again to rejoin."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#2a2a35] text-white hover:bg-[#1a1a22]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onUnsubscribe(channel._id)}
              className="bg-red-600 hover:bg-red-700 text-white border-none"
            >
              Unsubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SubscriptionPeriodDropdownProps {
  value: string;
  onChange: (val: string) => void;
}

function SubscriptionPeriodDropdown({ value, onChange }: SubscriptionPeriodDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const periodOptions = [
    { value: "one-time", label: "One-time payment" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly (every 3 months)" },
    { value: "yearly", label: "Yearly" },
  ];

  const selected = periodOptions.find((opt) => opt.value === value) || periodOptions[0];

  return (
    <div ref={containerRef} className="relative w-full text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-lg px-3.5 py-2.5 outline-none focus:border-brand/60 transition-colors"
      >
        <span className="text-white font-medium text-sm">{selected.label}</span>
        <ChevronDown className={`h-4 w-4 text-[#9fa0b8] transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[1000] left-0 right-0 mt-1.5 bg-[#16161c] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden py-1">
          {periodOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-[#1a1a22] ${
                  isSelected ? "bg-[#1a1a22]" : ""
                }`}
              >
                <span className={`font-medium ${isSelected ? "text-brand font-bold" : "text-[#d1d1e0]"}`}>{opt.label}</span>
                {isSelected && <Check className="h-4 w-4 text-brand" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ChannelsPageProps {
  initialView?: "main" | "reserves" | "members" | "my-communities";
  viewRole?: "customer" | "founder";
}

export function ChannelsPage({ initialView = "main", viewRole }: ChannelsPageProps = {}) {
  const { amIFounder, userData } = useAmIFounder();
  const isFounderMode = viewRole === "founder";
  const [orgId, setOrgId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [totalRevenueUsd, setTotalRevenueUsd] = useState(0);
  // Analytics powering the Communities view (founder mode only). Keyed by
  // channel _id so per-row lookups stay O(1). Header stats live in a
  // separate state so we can render header cards independently.
  const [analyticsById, setAnalyticsById] = useState<
    Map<string, ChannelAnalyticsRow>
  >(new Map());
  const [headerStats, setHeaderStats] =
    useState<ChannelAnalyticsHeaderStats | null>(null);
  const [channelPreviewAvatars, setChannelPreviewAvatars] = useState<Record<string, string[]>>({});

  // One batched request for every visible community card's rating.
  const ratingSummaries = useRatingSummaries(
    "channel",
    channels.map((c) => c._id)
  );

  useEffect(() => {
    if (!orgId || channels.length === 0) return;

    const loadAllPreviews = async () => {
      const newAvatars: Record<string, string[]> = {};
      await Promise.all(
        channels.map(async (channel) => {
          try {
            const result = await getChannelSubscribers(channel._id, orgId, { limit: 3 });
            if (result?.subscribers) {
              const avatars = result.subscribers
                .map((sub: any) => sub.user?.profilePicture)
                .filter(Boolean) as string[];
              newAvatars[channel._id] = avatars;
            }
          } catch (err) {
            // Silently ignore 403 / other fetch errors
          }
        })
      );
      setChannelPreviewAvatars((prev) => ({ ...prev, ...newAvatars }));
    };

    loadAllPreviews();
  }, [channels, orgId]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Page-level view switcher: the "Reserves" tab swaps the channels grid out
  // for the buyer's reserve license pool for the "channel" item type.
  const [pageView, setPageView] = useState<"main" | "reserves" | "members" | "my-communities">(initialView);

  useEffect(() => {
    setPageView(initialView);
  }, [initialView]);



  const [affiliateId, setAffiliateId] = useState<string>("");
  const [orgSlug, setOrgSlug] = useState<string>("");

  useEffect(() => {
    const fetchOrgSlug = async () => {
      if (!orgId) return;
      try {
        const response = await api<any>(`/org/${orgId}`);
        if (response?.org?.slug) {
          setOrgSlug(response.org.slug);
        } else if (response?.org?.name) {
          setOrgSlug(slugify(response.org.name));
        }
      } catch (err) {
        console.error("Error fetching organization slug:", err);
      }
    };
    fetchOrgSlug();
  }, [orgId]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSubscribersModal, setShowSubscribersModal] = useState(false);
  const [showDefaultConfirmModal, setShowDefaultConfirmModal] = useState(false);
  const [pendingDefaultState, setPendingDefaultState] = useState<boolean | null>(null);

  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [formData, setFormData] = useState<ChannelFormData>(defaultFormData);
  // Post-purchase order email — shared with the product and course forms.
  const emailAlertsForm = useEmailAlerts();
  const founderAlertsForm = useFounderAlerts();
  // Post-purchase thank-you page drawer. Only meaningful in the EDIT
  // modal (create has no channel _id yet). Local snapshot mirrors the
  // channel's config so the "· configured" badge updates instantly on
  // save without waiting for the parent list to refetch.
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [thankYouSnapshot, setThankYouSnapshot] = useState<
    Channel["thankYouPage"]
  >(undefined);
  useEffect(() => {
    setThankYouSnapshot(selectedChannel?.thankYouPage);
  }, [selectedChannel?._id, selectedChannel?.thankYouPage]);
  const [submitting, setSubmitting] = useState(false);

  // Tab state for create/edit modal
  const [activeTab, setActiveTab] = useState<"details" | "page" | "payment">("details");
  const [pageDetailsExpanded, setPageDetailsExpanded] = useState(true);
  const [faqsSectionExpanded, setFaqsSectionExpanded] = useState(true);
  const [pricingExpanded, setPricingExpanded] = useState(true);
  const [draggedBenefitIndex, setDraggedBenefitIndex] = useState<number | null>(null);
  const [activeEmojiPickerIndex, setActiveEmojiPickerIndex] = useState<number | null>(null);
  const [showPriceBreakdownModal, setShowPriceBreakdownModal] = useState(false);
  const [showIosPricingModal, setShowIosPricingModal] = useState(false);
  const [tempIosOption, setTempIosOption] = useState<"inclusive" | "exclusive" | "restrict">("exclusive");

  // Subscribers
  const [subscribers, setSubscribers] = useState<ChannelSubscriber[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [selectedMembersChannelId, setSelectedMembersChannelId] = useState<string>("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Cover crop — the picked file (or the already-saved URL) waiting to be framed
  const [cropSource, setCropSource] = useState<File | string | null>(null);
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  /** Kept so "Reposition" can re-crop from the original, full-resolution file. */
  const [coverSourceFile, setCoverSourceFile] = useState<File | null>(null);
  /** The framing chosen for that original, so reposition resumes where it left off. */
  const [coverCropState, setCoverCropState] = useState<CropState | null>(null);
  /** Hosted URL of the untouched upload behind the current cover, if we have one. */
  const [coverOriginalUrl, setCoverOriginalUrl] = useState<string | null>(null);
  /** Set when what's open in the cropper IS the original, not the saved cover. */
  const [cropSourceOriginalUrl, setCropSourceOriginalUrl] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // New gallery and video upload states/refs
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  
  // Section toggle for accordion in the new create community form
  const [sectionPageOpen, setSectionPageOpen] = useState(false);

  // Price breakdown getter helper
  const getAffiliateInfo = () => {
    if (typeof window !== "undefined" && (window as any).__commissionPlanInfo) {
      return (window as any).__commissionPlanInfo;
    }
    return { enabled: false, levels: [], totalCommission: 0 };
  };

  const getDetailedPriceBreakdown = () => {
    const priceVal = parseFloat(formData.price) || 0;
    const isInclusive = formData.gstInclusive;
    const affInfo = getAffiliateInfo();
    const affPercent = affInfo.enabled ? affInfo.totalCommission : 0;
    
    // Base Price
    const basePrice = isInclusive ? priceVal / 1.18 : priceVal;
    
    // 1. Non-iOS calculation
    const nonIosAppleFee = 0;
    const nonIosGst = basePrice * 0.18;
    const nonIosCustomerPays = isInclusive ? priceVal : basePrice + nonIosGst;
    
    const nonIosGovGst = nonIosGst;
    const nonIosAppleDist = 0;
    const nonIosPlatformFee = basePrice * 0.05;
    const nonIosAffiliateCut = basePrice * (affPercent / 100);
    const nonIosYouReceive = basePrice - nonIosPlatformFee - nonIosAffiliateCut;
    
    // 2. iOS calculation
    const iosAppleFee = basePrice * 0.30;
    const iosGst = (basePrice + iosAppleFee) * 0.18;
    const iosCustomerPays = basePrice + iosAppleFee + iosGst;
    
    const iosGovGst = iosGst;
    const iosAppleDist = iosAppleFee;
    const iosPlatformFee = basePrice * 0.05;
    const iosAffiliateCut = basePrice * (affPercent / 100);
    const iosYouReceive = basePrice - iosPlatformFee - iosAffiliateCut;

    return {
      basePrice,
      affPercent,
      nonIos: {
        appleFee: nonIosAppleFee,
        gst: nonIosGst,
        customerPays: nonIosCustomerPays,
        govGst: nonIosGovGst,
        appleDist: nonIosAppleDist,
        platformFee: nonIosPlatformFee,
        affiliateCut: nonIosAffiliateCut,
        youReceive: nonIosYouReceive
      },
      ios: {
        appleFee: iosAppleFee,
        gst: iosGst,
        customerPays: iosCustomerPays,
        govGst: iosGovGst,
        appleDist: iosAppleDist,
        platformFee: iosPlatformFee,
        affiliateCut: iosAffiliateCut,
        youReceive: iosYouReceive
      }
    };
  };

  const getPriceDetails = () => {
    const p = parseFloat(formData.price) || 0;
    const currency = formData.currency === "INR" ? "₹" : "$";
    let baseWeb = p;
    let gstWeb = 0;
    let totalWeb = p;
    if (p > 0) {
      if (formData.gstInclusive) {
        baseWeb = p / 1.18;
        gstWeb = p - baseWeb;
        totalWeb = p;
      } else {
        baseWeb = p;
        gstWeb = p * 0.18;
        totalWeb = p + gstWeb;
      }
    }
    let totalIos = totalWeb;
    let appleCut = 0;
    if (formData.requireIosPayment && p > 0) {
      if (formData.appleFeeInclusive) {
        totalIos = totalWeb;
        appleCut = totalWeb * 0.3;
      } else {
        totalIos = totalWeb / 0.7;
        appleCut = totalIos * 0.3;
      }
    }
    return { currency, baseWeb, gstWeb, totalWeb, totalIos, appleCut };
  };

  const getYouTubeEmbedUrl = (url: string): string => {
    if (!url) return "";
    if (url.includes("youtu.be/")) {
      const parts = url.split("youtu.be/");
      if (parts[1]) {
        return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
      }
    } else if (url.includes("youtube.com/watch?v=")) {
      const parts = url.split("v=");
      if (parts[1]) {
        return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
      }
    } else if (url.includes("youtube.com/embed/")) {
      const parts = url.split("embed/");
      if (parts[1]) {
        return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
      }
    }
    return "";
  };

  // Reorder helpers for benefits and faqs
  const moveBenefit = (index: number, direction: 'up' | 'down') => {
    const updated = [...formData.benefits];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFormData(prev => ({ ...prev, benefits: updated }));
  };

  const moveFAQ = (index: number, direction: 'up' | 'down') => {
    const updated = [...formData.faqs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFormData(prev => ({ ...prev, faqs: updated }));
  };

  const handleDragStartBenefit = (e: React.DragEvent, index: number) => {
    setDraggedBenefitIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverBenefit = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDropBenefit = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedBenefitIndex === null || draggedBenefitIndex === targetIndex) return;

    const newBenefits = [...formData.benefits];
    const temp = newBenefits[draggedBenefitIndex];
    newBenefits.splice(draggedBenefitIndex, 1);
    newBenefits.splice(targetIndex, 0, temp);

    setFormData((prev) => ({ ...prev, benefits: newBenefits }));
    setDraggedBenefitIndex(null);
  };

  const updateBenefitTitle = (index: number, value: string) => {
    const list = formData.benefits.length > 0 ? [...formData.benefits] : [{ icon: "😊", title: "", description: "" }];
    list[index] = { ...list[index], title: value };
    setFormData(prev => ({ ...prev, benefits: list }));
  };

  const updateBenefitIcon = (index: number, value: string) => {
    const list = formData.benefits.length > 0 ? [...formData.benefits] : [{ icon: "😊", title: "", description: "" }];
    list[index] = { ...list[index], icon: value };
    setFormData(prev => ({ ...prev, benefits: list }));
  };

  const updateBenefitDescription = (index: number, value: string) => {
    const list = formData.benefits.length > 0 ? [...formData.benefits] : [{ icon: "😊", title: "", description: "" }];
    list[index] = { ...list[index], description: value };
    setFormData(prev => ({ ...prev, benefits: list }));
  };

  const addBenefitRow = () => {
    const list = formData.benefits.length > 0 ? [...formData.benefits] : [];
    if (list.length >= MAX_BENEFITS) return;
    list.push({ icon: "😊", title: "", description: "" });
    setFormData(prev => ({ ...prev, benefits: list }));
  };

  const removeBenefitRow = (index: number) => {
    const list = formData.benefits.length > 0 ? [...formData.benefits] : [{ icon: "😊", title: "", description: "" }];
    const updated = list.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, benefits: updated }));
  };

  const updateFaqQuestion = (index: number, value: string) => {
    const list = formData.faqs.length > 0 ? [...formData.faqs] : [{ question: "", answer: "" }];
    list[index] = { ...list[index], question: value };
    setFormData(prev => ({ ...prev, faqs: list }));
  };

  const updateFaqAnswer = (index: number, value: string) => {
    const list = formData.faqs.length > 0 ? [...formData.faqs] : [{ question: "", answer: "" }];
    list[index] = { ...list[index], answer: value };
    setFormData(prev => ({ ...prev, faqs: list }));
  };

  const addFaqRow = () => {
    const list = formData.faqs.length > 0 ? [...formData.faqs] : [];
    if (list.length >= MAX_FAQS) return;
    list.push({ question: "", answer: "" });
    setFormData(prev => ({ ...prev, faqs: list }));
  };

  const removeFaqRow = (index: number) => {
    const list = formData.faqs.length > 0 ? [...formData.faqs] : [{ question: "", answer: "" }];
    const updated = list.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, faqs: updated }));
  };

  // Lock parent scrollable containers when create/edit modal is open
  useEffect(() => {
    if (!showCreateModal && !showEditModal) return;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const scrollableParents: HTMLElement[] = [];
    let el = modalRef.current?.parentElement;
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      if (style.overflow === "auto" || style.overflow === "scroll" ||
        style.overflowY === "auto" || style.overflowY === "scroll") {
        scrollableParents.push(el);
        el.style.overflow = "hidden";
      }
      el = el.parentElement;
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      scrollableParents.forEach((parent) => {
        parent.style.overflow = "";
      });
    };
  }, [showCreateModal, showEditModal]);

  // Non-founder states for browse/join functionality
  const [subscribedChannels, setSubscribedChannels] = useState<SubscribedChannel[]>([]);
  const [showChannelPaymentModal, setShowChannelPaymentModal] = useState(false);
  const [selectedChannelForPayment, setSelectedChannelForPayment] = useState<Channel | null>(null);

  // My Communities table state
  const [myCommFilter, setMyCommFilter] = useState<"all" | "active" | "inactive">("all");
  const [myCommSelected, setMyCommSelected] = useState<Set<string>>(new Set());

  // Founder Communities table state
  const [founderPriceFilter, setFounderPriceFilter] = useState<"all" | "free" | "paid">("all");
  const [founderStatusFilter, setFounderStatusFilter] = useState<"all" | "published" | "draft" | "inactive">("all");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Community Stream
  const meId = userData?.userId || "";
  const {
    streamState,
    joinCommunityStream,
    leaveCommunityStream,
    isInStream,
  } = useCommunityStream(meId);

  const filteredSubscribers = subscribers.filter((sub) => {
    if (!sub || !sub.user) return false;
    if (!memberSearchQuery) return true;
    const name = (sub.user.name || "").toLowerCase();
    const email = (sub.user.email || "").toLowerCase();
    const q = memberSearchQuery.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  useEffect(() => {
    const shouldHideBottomTab =
      selectedChannelIds.length > 0 ||
      showCreateModal ||
      showEditModal ||
      isInStream;

    if (shouldHideBottomTab) {
      window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    } else {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [selectedChannelIds.length, showCreateModal, showEditModal, isInStream]);

  useEffect(() => {
    const id = getOrgId();
    setOrgId(id);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".actions-menu-container")) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const fetchChannels = async (isRefresh = false) => {
    if (!orgId) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [data, analytics] = await Promise.all([
        getOrgChannels(orgId),
        // /feed/channels/analytics is founder-gated on the BE and is a
        // superset of the older /feed/stats totals — one call gives us
        // header cards + per-channel real numbers.
        isFounderMode
          ? getChannelAnalytics(orgId).catch(() => null)
          : null,
      ]);
      setChannels(data.channels);
      if (analytics) {
        const nextMap = new Map<string, ChannelAnalyticsRow>();
        for (const row of analytics.channels) nextMap.set(row._id, row);
        setAnalyticsById(nextMap);
        setHeaderStats(analytics.headerStats);
        setTotalRevenueUsd(analytics.headerStats.totalRevenueUsd);
      } else {
        setAnalyticsById(new Map());
        setHeaderStats(null);
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
      toast.error("Failed to load channels");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchChannels();
    }
  }, [orgId]);

  // Fetch subscribed channels for non-founders
  useEffect(() => {
    if (orgId && !isFounderMode) {
      const fetchSubscribedChannels = async () => {
        try {
          const data = await getSubscribedChannels(orgId);
          setSubscribedChannels(data.channels || []);
        } catch (error) {
          console.error("Error fetching subscribed channels:", error);
        }
      };
      fetchSubscribedChannels();
    }
  }, [orgId, isFounderMode]);

  // Set default selected channel for members list when channels load
  useEffect(() => {
    if (channels.length > 0) {
      const stillExists = channels.some(c => c._id === selectedMembersChannelId);
      if (!stillExists) {
        const defaultChan = channels.find(c => c.isDefault) || channels[0];
        setSelectedMembersChannelId(defaultChan._id);
      }
    } else {
      setSelectedMembersChannelId("");
    }
  }, [channels]);

  // Fetch subscribers for the active page view if it is "members"
  useEffect(() => {
    if (pageView === "members" && orgId && selectedMembersChannelId) {
      const fetchSubscribersForPage = async () => {
        setLoadingSubscribers(true);
        try {
          const data = await getChannelSubscribers(selectedMembersChannelId, orgId);
          setSubscribers(data.subscribers || []);
        } catch (error) {
          console.error("Error fetching subscribers:", error);
          toast.error("Failed to load subscribers");
        } finally {
          setLoadingSubscribers(false);
        }
      };
      fetchSubscribersForPage();
    }
  }, [pageView, orgId, selectedMembersChannelId]);

  // Handle subscribing to a channel (for non-founders)
  const handleSubscribeToChannel = async (channelId: string) => {
    if (!orgId) {
      toast.error("Unable to subscribe. Please ensure you are logged in.");
      return;
    }

    const channel = channels.find(c => c._id === channelId);
    if (!channel) return;

    if (subscribedChannels.find(c => c.channelId === channelId)) {
      toast.info(`Already subscribed to ${channel.title}`);
      return;
    }

    // Paid channel - open payment modal
    if (!channel.isFree && channel.price > 0) {
      setSelectedChannelForPayment(channel);
      setShowChannelPaymentModal(true);
      return;
    }

    // Free channel - subscribe directly
    try {
      await subscribeToFreeChannel(channelId, orgId);
      setSubscribedChannels([...subscribedChannels, {
        channelId,
        channelTitle: channel.title,
        status: 'active',
        joinedAt: new Date(),
      }]);
      toast.success(`Joined ${channel.title}`);
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error("Failed to join channel");
    }
  };

  // Handle payment success for channel subscription
  const handleChannelPaymentSuccess = () => {
    if (selectedChannelForPayment) {
      setSubscribedChannels([...subscribedChannels, {
        channelId: selectedChannelForPayment._id,
        channelTitle: selectedChannelForPayment.title,
        status: 'active',
        joinedAt: new Date(),
      }]);
    }
    setShowChannelPaymentModal(false);
    setSelectedChannelForPayment(null);
  };

  // Handle unsubscribing from a channel (for non-founders)
  //
  // Single BE endpoint (`DELETE /feed/channels/:channelId/subscribe`) now
  // handles free, one-time paid AND recurring paid — the response's
  // `status` field tells us what happened so the UI can react
  // accordingly. Removed the FE branching on `subscribed.subscriptionId`
  // which used to hit a different endpoint for paid subs and skip the
  // membership-side bookkeeping.
  const handleUnsubscribeFromChannel = async (channelId: string) => {
    if (!orgId) {
      toast.error("Unable to unsubscribe. Please ensure you are logged in.");
      return;
    }

    const subscribed = subscribedChannels.find((c) => c.channelId === channelId);
    if (!subscribed) return;

    try {
      const result = await unsubscribeFromChannel(channelId, orgId);

      if (result.status === "cancelling_at_cycle_end") {
        // Recurring paid — keep the row in the subscribed list so the
        // user can see "Cancelling — access until X" and still enter
        // the channel until the sweeper flips them at nextPaymentDate.
        setSubscribedChannels((prev) =>
          prev.map((c) =>
            c.channelId === channelId
              ? {
                  ...c,
                  subscriptionStatus: "cancelled",
                  accessUntil: result.accessUntil,
                }
              : c,
          ),
        );
        const untilLabel = result.accessUntil
          ? new Date(result.accessUntil).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "the end of your current cycle";
        toast.success(
          `Subscription will end on ${untilLabel}. You'll keep access until then.`,
        );
        // NOTE: not closing the right panel — the user is still a member
        // this cycle and might want to see the badge / cancel state.
      } else {
        // cancelled_immediately (free / one-time) OR already_inactive —
        // remove from the subscribed list and close the details panel.
        setSubscribedChannels((prev) => prev.filter((c) => c.channelId !== channelId));
        window.dispatchEvent(new CustomEvent("right-panel:close"));
        toast.success(
          result.status === "already_inactive"
            ? "You've already left this community"
            : "You've left the community",
        );
      }
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to unsubscribe");
    }
  };

  // Fetch affiliate ID for checkout links
  useEffect(() => {
    const fetchAffiliateId = async () => {
      try {
        const response = await api<{
          success: boolean;
          affiliateId: string | null;
          hasAffiliateId: boolean;
        }>("/affiliate/my-affiliate-id", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        if (response.success && response.affiliateId) {
          setAffiliateId(response.affiliateId);
        }
      } catch (error) {
        console.error("Error fetching affiliate ID:", error);
      }
    };

    fetchAffiliateId();
  }, []);

  const isTab1Valid = () => {
    return formData.title.trim().length > 0;
  };

  const isTab2Valid = () => {
    if (formData.isFree) return true;
    const hasValidPrice = formData.price && parseFloat(formData.price) > 0;
    return hasValidPrice;
  };

  const handleCreateChannel = async (iosOverride?: { requireIosPayment: boolean; appleFeeInclusive: boolean }) => {
    if (!orgId || !formData.title.trim()) {
      toast.error("Please enter a community title");
      return;
    }

    // Validate description length (HTML from RichTextEditor can be long)
    const descLen = formData.description.trim().length;
    if (descLen > 5000) {
      toast.error(`Description is too long (${descLen.toLocaleString()}/5,000 characters). Please shorten it.`);
      return;
    }

    const hasBenefit = formData.benefits.some((b) => b.title.trim() !== "");
    if (!hasBenefit) {
      toast.error("Please enter at least one benefit/key feature");
      return;
    }

    const hasFaq = formData.faqs.some((f) => f.question.trim() !== "" && f.answer.trim() !== "");
    if (!hasFaq) {
      toast.error("Please enter at least one FAQ with both a question and an answer");
      return;
    }

    const emailAlertsMsg = emailAlertsForm.validate();
    if (emailAlertsMsg) {
      toast.error(emailAlertsMsg);
      return;
    }

    const requireIosPayment = iosOverride ? iosOverride.requireIosPayment : formData.requireIosPayment;
    const appleFeeInclusive = iosOverride ? iosOverride.appleFeeInclusive : formData.appleFeeInclusive;

    setSubmitting(true);
    try {
      const result = await createChannel(orgId, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        price: formData.isFree ? 0 : parseFloat(formData.price) || 0,
        currency: formData.currency,
        coverImage: formData.coverImage || undefined,
        isFree:
          formData.isFree ||
          !formData.price ||
          parseFloat(formData.price) === 0,
        isSubscription: formData.isSubscription,
        subscriptionPeriod: formData.isSubscription
          ? formData.subscriptionPeriod
          : undefined,
        rating: formData.rating ? parseFloat(formData.rating) : undefined,
        ratingCount: formData.ratingCount
          ? parseInt(formData.ratingCount)
          : undefined,
        aboutText: formData.aboutText.trim() || undefined,
        whatsIncluded:
          formData.whatsIncluded.filter((s) => s.trim()).length > 0
            ? formData.whatsIncluded.filter((s) => s.trim())
            : undefined,
        benefits:
          formData.benefits.filter((b) => b.title.trim()).length > 0
            ? formData.benefits.filter((b) => b.title.trim()).map((b) => ({
                title: b.title.trim(),
                icon: b.icon.trim() || "😊",
                description: b.description.trim() || b.title.trim(),
              }))
            : undefined,
        reviews:
          formData.reviews.filter((r) => r.reviewerName.trim() && r.text.trim())
            .length > 0
            ? formData.reviews.filter(
                (r) => r.reviewerName.trim() && r.text.trim()
              )
            : undefined,
        faqs:
          formData.faqs.filter((f) => f.question.trim() && f.answer.trim())
            .length > 0
            ? formData.faqs.filter(
                (f) => f.question.trim() && f.answer.trim()
              )
            : undefined,
        isDefault: formData.isDefault || undefined,
        mandatoryOnJoin: formData.mandatoryOnJoin || undefined,
        galleryImages: formData.galleryImages,
        videoUrl: formData.videoUrl.trim() || undefined,
        videoFile: formData.videoFile || undefined,
        whoCanPost: formData.whoCanPost,
        gstInclusive: formData.gstInclusive,
        requireIosPayment,
        appleFeeInclusive,
        emailAlerts: emailAlertsForm.buildPayload(),
        founderAlerts: founderAlertsForm.buildPayload(),
      });

      // Save commission plan if channel is paid
      const isPaid = !formData.isFree && parseFloat(formData.price) > 0;
      if (isPaid && result.channel?._id) {
        await saveCommissionPlan(result.channel._id);
      }
      emailAlertsForm.noteTemplateUse();

      const created = result.channel;
      if (created?._id) {
        showSellablePublished({
          kind: "community",
          title: created.title,
          image: created.coverImage,
          url: garageStorefrontUrl("channel", created._id),
          price: formatSellablePrice(
            created.isFree ? 0 : created.price,
            created.currency,
            created.isSubscription ? subscriptionUnit(created.subscriptionPeriod) : null,
          ),
          // What a member gets, as the founder wrote it.
          facts: formData.benefits
            .filter((b) => b.title.trim())
            .slice(0, 2)
            .map((b) => `${b.icon.trim() || "😊"} ${b.title.trim()}`),
        });
      } else {
        toast.success("Community created successfully");
      }
      setShowCreateModal(false);
      setFormData(defaultFormData);
      emailAlertsForm.reset();
      founderAlertsForm.reset();
      setActiveTab("details");
      fetchChannels(true);
    } catch (error) {
      console.error("Error creating Community:", error);
      // Surface the backend's `details` field — the create handler returns
      // `{ success: false, error: "Failed to create channel", details: ... }`
      // on 500, and a per-cause message on 403 / 400. Without this the
      // toast was always "Failed to create Community" even when the
      // actual cause was "Only founders can create channels" or a Zod
      // validation error — making the bug impossible to diagnose from
      // the UI alone.
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to create Community";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateChannel = async (iosOverride?: { requireIosPayment: boolean; appleFeeInclusive: boolean }) => {
    if (!orgId || !selectedChannel) return;

    // Validate description length (HTML from RichTextEditor can be long)
    const descLen = formData.description.trim().length;
    if (descLen > 5000) {
      toast.error(`Description is too long (${descLen.toLocaleString()}/5,000 characters). Please shorten it.`);
      return;
    }

    const hasBenefit = formData.benefits.some((b) => b.title.trim() !== "");
    if (!hasBenefit) {
      toast.error("Please enter at least one benefit/key feature");
      return;
    }

    const hasFaq = formData.faqs.some((f) => f.question.trim() !== "" && f.answer.trim() !== "");
    if (!hasFaq) {
      toast.error("Please enter at least one FAQ with both a question and an answer");
      return;
    }

    const emailAlertsMsg = emailAlertsForm.validate();
    if (emailAlertsMsg) {
      toast.error(emailAlertsMsg);
      return;
    }

    const requireIosPayment = iosOverride ? iosOverride.requireIosPayment : formData.requireIosPayment;
    const appleFeeInclusive = iosOverride ? iosOverride.appleFeeInclusive : formData.appleFeeInclusive;

    setSubmitting(true);
    try {
      await updateChannel(selectedChannel._id, orgId, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        price: formData.isFree ? 0 : parseFloat(formData.price) || 0,
        currency: formData.currency,
        coverImage: formData.coverImage || undefined,
        isFree:
          formData.isFree ||
          !formData.price ||
          parseFloat(formData.price) === 0,
        isSubscription: formData.isSubscription,
        subscriptionPeriod: formData.isSubscription
          ? formData.subscriptionPeriod
          : undefined,
        rating: formData.rating ? parseFloat(formData.rating) : null,
        ratingCount: formData.ratingCount
          ? parseInt(formData.ratingCount)
          : null,
        aboutText: formData.aboutText.trim() || null,
        whatsIncluded:
          formData.whatsIncluded.filter((s) => s.trim()).length > 0
            ? formData.whatsIncluded.filter((s) => s.trim())
            : null,
        benefits:
          formData.benefits.filter((b) => b.title.trim()).length > 0
            ? formData.benefits.filter((b) => b.title.trim()).map((b) => ({
                title: b.title.trim(),
                icon: b.icon.trim() || "😊",
                description: b.description.trim() || b.title.trim(),
              }))
            : null,
        reviews:
          formData.reviews.filter((r) => r.reviewerName.trim() && r.text.trim())
            .length > 0
            ? formData.reviews.filter(
                (r) => r.reviewerName.trim() && r.text.trim()
              )
            : null,
        faqs:
          formData.faqs.filter((f) => f.question.trim() && f.answer.trim())
            .length > 0
            ? formData.faqs.filter(
                (f) => f.question.trim() && f.answer.trim()
              )
            : null,
        isDefault: formData.isDefault,
        mandatoryOnJoin: formData.mandatoryOnJoin,
        galleryImages: formData.galleryImages,
        videoUrl: formData.videoUrl.trim() || null,
        videoFile: formData.videoFile || null,
        whoCanPost: formData.whoCanPost,
        gstInclusive: formData.gstInclusive,
        requireIosPayment,
        appleFeeInclusive,
        emailAlerts: emailAlertsForm.buildPayload(),
        founderAlerts: founderAlertsForm.buildPayload(),
      });

      // Persist the commission plan changes too. `handleCreateChannel`
      // does this for new channels; the edit path was forgetting it
      // entirely — so founders adjusting their affiliate split saw
      // "Community updated" but the comb-plan changes were silently
      // dropped (CommissionPlanSection's window.__commissionPlanSave
      // was never called from this handler).
      const isPaid = !formData.isFree && parseFloat(formData.price) > 0;
      if (isPaid && selectedChannel._id) {
        await saveCommissionPlan(selectedChannel._id);
      }

      emailAlertsForm.noteTemplateUse();

      toast.success("Community updated successfully");
      setShowEditModal(false);
      setSelectedChannel(null);
      setFormData(defaultFormData);
      emailAlertsForm.reset();
      founderAlertsForm.reset();
      setActiveTab("details");
      fetchChannels(true);
    } catch (error) {
      console.error("Error updating Community:", error);
      const msg =
        error instanceof Error ? error.message : "Failed to update Community";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveClick = () => {
    if (!orgId || !formData.title.trim()) {
      toast.error("Please enter a community title");
      return;
    }

    const descLen = formData.description.trim().length;
    if (descLen > 5000) {
      toast.error(`Description is too long (${descLen.toLocaleString()}/5,000 characters). Please shorten it.`);
      return;
    }

    const hasBenefit = formData.benefits.some((b) => b.title.trim() !== "");
    if (!hasBenefit) {
      toast.error("Please enter at least one benefit/key feature");
      return;
    }

    const hasFaq = formData.faqs.some((f) => f.question.trim() !== "" && f.answer.trim() !== "");
    if (!hasFaq) {
      toast.error("Please enter at least one FAQ with both a question and an answer");
      return;
    }

    if (!formData.isFree) {
      const priceNum = parseFloat(formData.price) || 0;
      if (!formData.price || priceNum <= 0) {
        toast.error("Please enter a valid price for paid community");
        return;
      }
    }

    if (formData.isFree || !formData.requireIosPayment) {
      if (showCreateModal) {
        handleCreateChannel();
      } else {
        handleUpdateChannel();
      }
    } else {
      // Determine selection option for paid
      if (!formData.requireIosPayment) {
        setTempIosOption("restrict");
      } else if (formData.appleFeeInclusive) {
        setTempIosOption("inclusive");
      } else {
        setTempIosOption("exclusive");
      }
      setShowIosPricingModal(true);
    }
  };

  const handleConfirmIosPricing = async () => {
    setShowIosPricingModal(false);
    const requireIos = tempIosOption !== "restrict";
    const inclusive = tempIosOption === "inclusive";

    setFormData((prev) => ({
      ...prev,
      requireIosPayment: requireIos,
      appleFeeInclusive: inclusive,
    }));

    const iosOverride = { requireIosPayment: requireIos, appleFeeInclusive: inclusive };
    if (showCreateModal) {
      await handleCreateChannel(iosOverride);
    } else {
      await handleUpdateChannel(iosOverride);
    }
  };

  const handleDeleteChannel = async () => {
    if (!orgId || !selectedChannel) return;

    setSubmitting(true);
    try {
      await deleteChannel(selectedChannel._id, orgId);
      toast.success("Community deleted successfully");
      setShowDeleteModal(false);
      setSelectedChannel(null);
      fetchChannels(true);
    } catch (error) {
      console.error("Error deleting Community:", error);
      toast.error("Failed to delete Community");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkDeleteChannels = async () => {
    if (!orgId || selectedChannelIds.length === 0) return;

    setSubmitting(true);
    try {
      await Promise.all(selectedChannelIds.map(id => deleteChannel(id, orgId)));
      toast.success("Selected communities deleted successfully");
      setShowBulkDeleteModal(false);
      setSelectedChannelIds([]);
      fetchChannels(true);
    } catch (error) {
      console.error("Error deleting communities:", error);
      toast.error("Failed to delete selected communities");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewSubscribers = async (channel: Channel) => {
    if (!orgId) return;

    setSelectedChannel(channel);
    setShowSubscribersModal(true);
    setLoadingSubscribers(true);

    try {
      const data = await getChannelSubscribers(channel._id, orgId);
      setSubscribers(data.subscribers);
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      toast.error("Failed to load subscribers");
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const handleCopyCheckoutLink = (channelId: string) => {
    const baseUrl = `${window.location.origin}/checkout/channel/${channelId}`;
    const checkoutUrl = affiliateId ? `${baseUrl}?ref=${affiliateId}` : baseUrl;
    navigator.clipboard.writeText(checkoutUrl);
    toast.success("Checkout link copied to clipboard!");
  };

  const openEditModal = async (channel: Channel) => {
    setSelectedChannel(channel);
    setActiveTab("details");
    setShowEditModal(true);
    // No local original yet — reposition resolves one from storage on demand.
    setCoverSourceFile(null);
    setCoverCropState(null);
    setCoverOriginalUrl(null);
    setCropSourceOriginalUrl(null);

    // Pre-fill with basic data from the list immediately
    setFormData({
      title: channel.title,
      description: channel.description || "",
      price: channel.price?.toString() || "",
      currency: channel.currency || "USD",
      coverImage: channel.coverImage || "",
      isFree: channel.isFree || false,
      isSubscription: channel.isSubscription || false,
      subscriptionPeriod: channel.subscriptionPeriod || "monthly",
      rating: channel.rating?.toString() || "",
      ratingCount: channel.ratingCount?.toString() || "",
      aboutText: channel.aboutText || "",
      whatsIncluded: channel.whatsIncluded || [],
      benefits: (channel.benefits || []).map((b) => ({
        icon: b.icon,
        title: b.title,
        description: b.description,
      })),
      reviews: (channel.reviews || []).map((r) => ({
        reviewerName: r.reviewerName,
        reviewerRole: r.reviewerRole || "",
        reviewerAvatar: r.reviewerAvatar || "",
        rating: r.rating,
        text: r.text,
      })),
      faqs: channel.faqs || [],
      isDefault: channel.isDefault || false,
      mandatoryOnJoin: (channel as any).mandatoryOnJoin || false,
      galleryImages: channel.galleryImages || [],
      videoUrl: channel.videoUrl || "",
      videoFile: channel.videoFile || "",
      whoCanPost: channel.whoCanPost || "everyone",
      gstInclusive: channel.gstInclusive !== false,
      requireIosPayment: false,
      appleFeeInclusive: (channel as any).appleFeeInclusive || false,
    });
    emailAlertsForm.hydrate(channel.emailAlerts);
    founderAlertsForm.hydrate((channel as any).founderAlerts);

    // Fetch full channel details (including page details fields) from the server
    if (orgId) {
      try {
        const { channel: fullChannel } = await getChannelWithStats(channel._id, orgId);
        setSelectedChannel(fullChannel);
        setFormData({
          title: fullChannel.title,
          description: fullChannel.description || "",
          price: fullChannel.price?.toString() || "",
          currency: fullChannel.currency || "USD",
          coverImage: fullChannel.coverImage || "",
          isFree: fullChannel.isFree || false,
          isSubscription: fullChannel.isSubscription || false,
          subscriptionPeriod: fullChannel.subscriptionPeriod || "monthly",
          rating: fullChannel.rating?.toString() || "",
          ratingCount: fullChannel.ratingCount?.toString() || "",
          aboutText: fullChannel.aboutText || "",
          whatsIncluded: fullChannel.whatsIncluded || [],
          benefits: (fullChannel.benefits || []).map((b) => ({
            icon: b.icon,
            title: b.title,
            description: b.description,
          })),
          reviews: (fullChannel.reviews || []).map((r) => ({
            reviewerName: r.reviewerName,
            reviewerRole: r.reviewerRole || "",
            reviewerAvatar: r.reviewerAvatar || "",
            rating: r.rating,
            text: r.text,
          })),
          faqs: fullChannel.faqs || [],
          isDefault: fullChannel.isDefault || false,
          mandatoryOnJoin: (fullChannel as any).mandatoryOnJoin || false,
          galleryImages: fullChannel.galleryImages || [],
          videoUrl: fullChannel.videoUrl || "",
          videoFile: fullChannel.videoFile || "",
          whoCanPost: fullChannel.whoCanPost || "everyone",
          gstInclusive: fullChannel.gstInclusive !== false,
          requireIosPayment: false,
          appleFeeInclusive: (fullChannel as any).appleFeeInclusive || false,
        });
        emailAlertsForm.hydrate(fullChannel.emailAlerts);
        founderAlertsForm.hydrate((fullChannel as any).founderAlerts);
      } catch (err) {
        console.error("Error fetching full channel details:", err);
      }
    }
  };

  const openCreateModal = () => {
    setFormData(defaultFormData);
    emailAlertsForm.reset();
    founderAlertsForm.reset();
    setActiveTab("details");
    setShowCreateModal(true);
  };

  const handleUnsubscribeRef = useRef(handleUnsubscribeFromChannel);
  const handleSubscribeRef = useRef(handleSubscribeToChannel);
  useEffect(() => {
    handleUnsubscribeRef.current = handleUnsubscribeFromChannel;
    handleSubscribeRef.current = handleSubscribeToChannel;
  }, [handleUnsubscribeFromChannel, handleSubscribeToChannel]);

  useEffect(() => {
    const handleOpenCreate = () => {
      openCreateModal();
    };
    const handleUnsubscribeRequest = (e: Event) => {
      const customEvent = e as CustomEvent<{ channelId: string }>;
      if (customEvent.detail?.channelId) {
        handleUnsubscribeRef.current(customEvent.detail.channelId);
      }
    };
    const handleSubscribeRequest = (e: Event) => {
      const customEvent = e as CustomEvent<{ channelId: string }>;
      if (customEvent.detail?.channelId) {
        handleSubscribeRef.current(customEvent.detail.channelId);
      }
    };
    window.addEventListener("channels:open-create-modal", handleOpenCreate);
    window.addEventListener("community:unsubscribe-request", handleUnsubscribeRequest);
    window.addEventListener("community:subscribe-request", handleSubscribeRequest);
    return () => {
      window.removeEventListener("channels:open-create-modal", handleOpenCreate);
      window.removeEventListener("community:unsubscribe-request", handleUnsubscribeRequest);
      window.removeEventListener("community:subscribe-request", handleSubscribeRequest);
    };
  }, []);

  const closeModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedChannel(null);
    setFormData(defaultFormData);
    emailAlertsForm.reset();
    founderAlertsForm.reset();
    setActiveTab("details");
    setShowCoverCropper(false);
    setCropSource(null);
    setCoverSourceFile(null);
    setCoverCropState(null);
    setCoverOriginalUrl(null);
    setCropSourceOriginalUrl(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input straight away so re-picking the same file still fires.
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    // Frame it before uploading — the banner shows exactly what is saved.
    setCoverSourceFile(file);
    setCoverCropState(null);
    setCoverOriginalUrl(null);
    setCropSourceOriginalUrl(null);
    setCropSource(file);
    setShowCoverCropper(true);
  };

  /** POSTs a file to /upload and returns the hosted URL. */
  const uploadFile = async (file: File): Promise<string> => {
    const token = getToken();
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataUpload,
      }
    );

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const data = await response.json();
    return data.url as string;
  };

  /** Uploads the framed cover produced by the crop dialog. */
  const handleCoverCropped = async (blob: Blob, state: CropState) => {
    setShowCoverCropper(false);
    const croppedFromOriginal = cropSource instanceof File ? cropSource : cropSourceOriginalUrl;
    if (croppedFromOriginal) setCoverCropState(state);
    setUploadingImage(true);
    try {
      const extension = blob.type === "image/png" ? "png" : "jpg";
      const croppedFile = new File([blob], `community-cover.${extension}`, { type: blob.type });

      // The untouched upload goes up alongside the crop so "Reposition" can
      // reopen the whole picture. Uploaded in parallel — it never blocks.
      const [url, uploadedOriginal] = await Promise.all([
        uploadFile(croppedFile),
        cropSource instanceof File && !cropSourceOriginalUrl
          ? uploadFile(cropSource).catch(() => null)
          : Promise.resolve(null),
      ]);

      const originalUrl = resolveOriginalToRemember({
        croppedFrom: cropSource!,
        uploadedOriginalUrl: uploadedOriginal,
        knownOriginalUrl: cropSourceOriginalUrl,
      });

      if (originalUrl) writeCoverOriginal(url, { url: originalUrl, state });
      setCoverOriginalUrl(originalUrl);
      setFormData((prev) => ({ ...prev, coverImage: url }));
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
      setCropSource(null);
    }
  };

  /**
   * Re-opens the cropper on the fullest image we still have: the file picked
   * this session, else the original kept from an earlier session, else the
   * saved cover itself (which only allows nudging within what was kept).
   */
  const openCoverCropper = () => {
    const resolved = resolveCropSource({
      pickedFile: coverSourceFile,
      pickedFileUrl: coverOriginalUrl,
      pickedFileState: coverCropState,
      coverUrl: formData.coverImage,
    });
    if (!resolved) return;

    setCoverCropState(resolved.initialState);
    setCoverOriginalUrl(resolved.originalUrl);
    setCropSourceOriginalUrl(resolved.originalUrl);
    setCropSource(resolved.source);
    setShowCoverCropper(true);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = formData.galleryImages?.length || 0;
    if (currentCount >= 3) {
      toast.error("You can upload a maximum of 3 gallery images");
      return;
    }

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingGallery(true);
    try {
      const token = getToken();
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formDataUpload,
        }
      );

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setFormData((prev) => ({
        ...prev,
        galleryImages: [...(prev.galleryImages || []), data.url],
      }));
      toast.success("Gallery image uploaded successfully");
    } catch (error) {
      console.error("Gallery upload error:", error);
      toast.error("Failed to upload gallery image");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) {
        galleryInputRef.current.value = "";
      }
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file (MP4 etc.)");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast.error("Video must be less than 500MB");
      return;
    }

    setUploadingVideo(true);
    try {
      const token = getToken();
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formDataUpload,
        }
      );

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setFormData((prev) => ({ ...prev, videoFile: data.url, videoUrl: "" }));
      toast.success("Video uploaded successfully");
    } catch (error) {
      console.error("Video upload error:", error);
      toast.error("Failed to upload video");
    } finally {
      setUploadingVideo(false);
      if (videoFileInputRef.current) {
        videoFileInputRef.current.value = "";
      }
    }
  };

  const removeUploadedVideo = () => {
    setFormData((prev) => ({ ...prev, videoFile: "" }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    const newFormData = {
      ...formData,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    };
    setFormData(newFormData);
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getSubscriptionLabel = (period: string) => {
    switch (period) {
      case "weekly":
        return "week";
      case "monthly":
        return "month";
      case "quarterly":
        return "3 months";
      case "yearly":
        return "year";
      default:
        return "month";
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-brand"></div>
          </div>
        </div>
      </div>
    );
  }

  // Non-founder view: Browse & Join channels
  if (!isFounderMode) {
    // If user is in a community stream, show the overlay as main content
    if (isInStream) {
      return (
        <div className="h-full w-full bg-[#0a0a0d]">
          <CommunityStreamOverlay
            isOpen={true}
            channelTitle={streamState.channelTitle}
            meId={meId}
            onClose={leaveCommunityStream}
          />
        </div>
      );
    }

    const displayChannels = pageView === "my-communities"
      ? channels.filter(channel => subscribedChannels.some(sc => sc.channelId === channel._id))
      : channels.filter(channel => !subscribedChannels.some(sc => sc.channelId === channel._id));

    // If there are no communities to discover, show the centered custom dialog box (no page header)
    // Note: exclude "reserves" view so it always renders the ReservesPanel regardless of channel count
    if (pageView !== "my-communities" && pageView !== "reserves" && displayChannels.length === 0) {
      return (
        <div className="p-4 sm:p-6 min-h-[85vh] flex items-center justify-center bg-[#0a0a0d]">
          <div className="bg-[#131316] border border-[#27272a] rounded-[24px] p-6 max-w-xl w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="relative w-full rounded-2xl overflow-hidden mb-6 bg-white">
              <img
                src="/55af4267ac781cf9fbb4267b4efc8309e28a48dc.png"
                alt="All joined"
                className="w-full h-auto object-cover max-h-[300px]"
              />
            </div>
            <h2 className="text-xl sm:text-[22px] font-bold text-white mb-3 px-2 leading-snug">
              Great Job. You Are Already Apart Of Every Community In This Office
            </h2>
            <p className="text-[#8e8e9f] text-xs sm:text-sm px-4 leading-relaxed mb-6">
              You're all set - stay connected and engaged with your teams.
              <br />
              You can now browse posts, join discussions, and share updates across every community.
            </p>
            <Button
              onClick={() => setPageView("my-communities")}
              className="w-full bg-brand hover:opacity-90 text-brand-foreground rounded-full py-3.5 text-sm font-semibold flex items-center justify-center transition-all shadow-lg shadow-brand/10 hover:shadow-brand/25 mb-4"
            >
              <Users className="w-4 h-4 mr-2" />
              Go to my communities
            </Button>
            <div className="text-xs text-[#6b6b7b]">
              Need help? <span className="text-brand hover:underline cursor-pointer">Contact support</span>
            </div>
          </div>
        </div>
      );
    }


    return (
      <div className="p-4 sm:p-6 min-h-screen bg-[#0a0a0d]">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Header removed */}



          {/* Channels Grid - Browse View */}
          {pageView === "reserves" ? (
            <ReservesPanel itemType="channel" />
          ) : displayChannels.length === 0 ? (
            <div className="bg-[#0e0e12]/50 backdrop-blur border border-[#1f1f2a] rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-[#1a1a22] flex items-center justify-center mx-auto mb-4">
                <Rss className="w-8 h-8 text-[#3a3a4a]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No joined communities</h3>
              <p className="text-[#6b6b7b] text-sm max-w-sm mx-auto">
                You haven't joined any communities yet. Go to Discover to find and join some!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {displayChannels.map((channel) => {
                const isSubscribed = subscribedChannels.some(c => c.channelId === channel._id);
                const isFreeChannel = channel.isFree || channel.price === 0;

                return pageView === "my-communities" ? (
                  <MyCommunityCard
                    key={channel._id}
                    channel={channel}
                    affiliateId={affiliateId}
                    orgSlug={orgSlug}
                    onUnsubscribe={handleUnsubscribeFromChannel}
                    previewAvatars={channelPreviewAvatars[channel._id] || []}
                    subscribed={subscribedChannels.find((c) => c.channelId === channel._id)}
                    ratingSummary={ratingSummaries[channel._id]}
                  />
                ) : (
                  <CommunityCardCustomer
                    key={channel._id}
                    channel={channel}
                    isSubscribed={isSubscribed}
                    isFreeChannel={isFreeChannel}
                    affiliateId={affiliateId}
                    orgSlug={orgSlug}
                    handleSubscribeToChannel={handleSubscribeToChannel}
                    handleCopyCheckoutLink={handleCopyCheckoutLink}
                    previewAvatars={channelPreviewAvatars[channel._id] || []}
                    ratingSummary={ratingSummaries[channel._id]}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {selectedChannelForPayment && orgId && (
          <ChannelPaymentModalNew
            isOpen={showChannelPaymentModal}
            onClose={() => {
              setShowChannelPaymentModal(false);
              setSelectedChannelForPayment(null);
            }}
            channel={selectedChannelForPayment}
            orgId={orgId}
            userData={{
              name: userData?.name || "",
              email: userData?.email || "",
            }}
            onSuccess={handleChannelPaymentSuccess}
          />
        )}
      </div>
    );
  }

  // Founder view: Manage channels
  // If user is in a community stream, show the overlay as main content
  if (isInStream) {
    return (
      <div className="h-[94vh] w-full bg-[#0a0a0d]">
        <CommunityStreamOverlay
          isOpen={true}
          channelTitle={streamState.channelTitle}
          meId={meId}
          onClose={leaveCommunityStream}
        />
      </div>
    );
  }

  const priceDetails = getPriceDetails();

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0a0a0d]">
      <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
        {/* Channels Grid */}
        {pageView === "members" ? (
          /* Rebuilt 2026-07-06: swap the inline members table for the
             UI-kit FounderMembersPanel. Owns its own fetching,
             pagination, and bucket filters via
             /feed/channels/:id/subscribers. Legacy 200-line inline JSX
             lived here previously — see git history for the pre-rebuild
             version if the old columns are needed. */
          <FounderMembersPanel orgId={orgId} channels={channels} />
        ) : /* DEAD BRANCH — never fires (guarded by `false`). Retained
             here purely to preserve the sequence of legacy JSX + hooks
             so state that other effects in this file still reference
             (subscribers, memberSearchQuery) doesn't get dead-code-
             eliminated during a rushed refactor. Delete on next pass
             along with the unused state hooks. */ false ? (
          <div className="space-y-6">
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-[#0e0e12]/60 border border-[#1f1f2a] p-4 rounded-xl">
              {/* Channel Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
                <label className="text-sm font-medium text-[#9fa0b8] whitespace-nowrap">Select Community:</label>
                <select
                  value={selectedMembersChannelId}
                  onChange={(e) => setSelectedMembersChannelId(e.target.value)}
                  className="bg-[#1a1a22] border border-[#2a2a35] text-white text-sm rounded-lg focus:ring-brand focus:border-brand block w-full sm:w-64 p-2.5 outline-none cursor-pointer hover:bg-[#20202a] transition-colors"
                >
                  {channels.map((chan) => (
                    <option key={chan._id} value={chan._id}>
                      {chan.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div className="w-full md:w-72">
                <Input
                  type="text"
                  placeholder="Search members by name/email..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#5a5a6a] focus-visible:ring-brand focus-visible:border-brand h-10"
                />
              </div>
            </div>

            {/* Members List Section */}
            <div className="bg-[#0e0e12]/60 border border-[#1f1f2a] rounded-2xl overflow-hidden p-4">
              {loadingSubscribers ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-brand" />
                  <p className="text-sm text-[#9fa0b8]">Loading members...</p>
                </div>
              ) : channels.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-12 h-12 text-[#2a2a35] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No Communities Found</h3>
                  <p className="text-sm text-[#6b6b7b] max-w-sm mx-auto">
                    You need to create a community first before you can manage its members.
                  </p>
                </div>
              ) : filteredSubscribers.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-12 h-12 text-[#2a2a35] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No Members Found</h3>
                  <p className="text-sm text-[#6b6b7b] max-w-sm mx-auto">
                    {memberSearchQuery ? "No members match your search criteria." : "No subscribers have joined this channel yet."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1f1f2a] text-xs font-semibold text-[#9fa0b8] uppercase tracking-wider">
                        <th className="py-3.5 px-4">Member Info</th>
                        <th className="py-3.5 px-4">Role / Status</th>
                        <th className="py-3.5 px-4">Joined Date</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f1f2a] text-sm">
                      {filteredSubscribers.map((sub, index) => {
                        const displayName = sub.user.name || sub.user.email;
                        const avatarChar = displayName.charAt(0).toUpperCase();
                        return (
                          <tr key={index} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                {sub.user.profilePicture ? (
                                  <img
                                    src={sub.user.profilePicture}
                                    alt={displayName}
                                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#2a2a35]"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-[#2a2a35] flex items-center justify-center text-brand font-semibold text-base shrink-0">
                                    {avatarChar}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-white truncate">{displayName}</p>
                                  <p className="text-xs text-[#9fa0b8] truncate">{sub.user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  sub.status === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}>
                                  {sub.status || "active"}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-[#9fa0b8]">
                              {new Date(sub.joinedAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            <td className="py-4 px-4 text-right">
                              {/* Can Post toggle */}
                              <button
                                onClick={async () => {
                                  if (!orgId || !selectedMembersChannelId) return;
                                  const newCanPost = !sub.canPost;
                                  // Optimistic update
                                  setSubscribers((prev) =>
                                    prev.map((s, i) =>
                                      i === index ? { ...s, canPost: newCanPost } : s
                                    )
                                  );
                                  try {
                                    await toggleMemberPosting(
                                      selectedMembersChannelId,
                                      sub.user._id,
                                      orgId,
                                      newCanPost
                                    );
                                    toast.success(
                                      newCanPost
                                        ? `${displayName} can now post`
                                        : `${displayName} has been muted`
                                    );
                                  } catch (err) {
                                    // Revert optimistic update
                                    setSubscribers((prev) =>
                                      prev.map((s, i) =>
                                        i === index ? { ...s, canPost: !newCanPost } : s
                                      )
                                    );
                                    toast.error("Failed to update posting permission");
                                  }
                                }}
                                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                                  sub.canPost !== false
                                    ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                                    : "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30"
                                }`}
                                title={sub.canPost !== false ? "Click to mute" : "Click to unmute"}
                              >
                                {sub.canPost !== false ? "Can Post" : "Muted"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : pageView === "reserves" ? (
          <ReservesPanel itemType="channel" />
        ) : (
          <div className="space-y-6">
            {/* Stats Row */}
            {(() => {
              // Prefer BE analytics numbers when available; fall back to
              // client-computed values so the cards still render for
              // non-founder viewers or during the analytics fetch.
              //
              // "Total Members" now uses `uniqueMembers` (distinct
              // userIds across all channels) rather than the sum of
              // ChannelMembership rows. So a member of both the default
              // free channel AND a paid channel counts as ONE person in
              // the header — matching the founder's mental model of
              // "how many actual people are in my community." The
              // per-row "Total Members" column still shows sum-per-
              // channel, so those numbers can be larger than the
              // header total by design.
              // Fallback also dedupes by title so the number the founder
              // sees never disagrees with the deduped BE count during
              // the analytics fetch window.
              const totalCommunities =
                headerStats?.totalCommunities ??
                new Set(
                  channels.map((c) => (c.title || "").trim().toLowerCase()),
                ).size;
              const totalMembers =
                headerStats?.uniqueMembers ??
                channels.reduce((sum, ch) => sum + (ch.memberCount || 0), 0);
              const highestReferredTitle =
                headerStats?.highestReferredChannel?.title ??
                channels.reduce<Channel | null>(
                  (best, ch) =>
                    (ch.memberCount || 0) > (best?.memberCount || 0) ? ch : best,
                  null,
                )?.title ??
                null;

              // Shared card treatment — subtle ring instead of hard border,
              // soft drop shadow so the tiles read as "lifted" against
              // the page. Matches the pattern used on the invoices page.
              const statCardClass =
                "bg-[#131318] rounded-2xl ring-1 ring-inset ring-white/[0.04] shadow-[0_8px_28px_-14px_rgba(0,0,0,0.5)] p-4 sm:p-5";
              const iconTileClass =
                "h-9 w-9 rounded-xl flex items-center justify-center shrink-0";
              const labelClass =
                "text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8aa0]";

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Total Communities */}
                  <div className={statCardClass}>
                    <div className="flex items-center gap-2.5">
                      <div className={`${iconTileClass} bg-blue-500/10 ring-1 ring-inset ring-blue-500/20`}>
                        <Users className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className={labelClass}>Total Communities</span>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-white leading-none mt-3 tracking-tight">
                      {totalCommunities}
                    </div>
                  </div>

                  {/* Total Members */}
                  <div className={statCardClass}>
                    <div className="flex items-center gap-2.5">
                      <div className={`${iconTileClass} bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20`}>
                        <User className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className={labelClass}>Total Members</span>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-white leading-none mt-3 tracking-tight">
                      {totalMembers.toLocaleString()}
                    </div>
                  </div>

                  {/* Highest Referred Community */}
                  <div className={statCardClass}>
                    <div className="flex items-center gap-2.5">
                      <div className={`${iconTileClass} bg-brand/10 ring-1 ring-inset ring-brand/25`}>
                        <Star className="w-4 h-4 text-brand" />
                      </div>
                      <span className={labelClass}>Highest Referred</span>
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-brand mt-3 truncate tracking-tight" title={highestReferredTitle || undefined}>
                      {highestReferredTitle || "—"}
                    </div>
                  </div>

                  {/* Total Revenue */}
                  <div className={statCardClass}>
                    <div className="flex items-center gap-2.5">
                      <div className={`${iconTileClass} bg-purple-500/10 ring-1 ring-inset ring-purple-500/20`}>
                        <CreditCard className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className={labelClass}>Total Revenue</span>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-white leading-none mt-3 tracking-tight font-mono">
                      ${totalRevenueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Controls Bar — proper Select for pricing filter, segmented
                Tabs component for status. No raw <select> or bare
                button pills anywhere. */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Price Filter — themed Select */}
              <Select
                value={founderPriceFilter}
                onValueChange={(v) => setFounderPriceFilter(v as any)}
              >
                <SelectTrigger className="h-9 min-w-[180px] bg-[#131318] ring-1 ring-inset ring-white/[0.05] border-transparent text-white text-sm hover:bg-[#17171e] transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141419] border-transparent ring-1 ring-white/[0.06] text-white shadow-2xl shadow-black/60">
                  <SelectItem value="all" className="focus:bg-white/[0.06] focus:text-white">
                    Both paid & Free
                  </SelectItem>
                  <SelectItem value="free" className="focus:bg-white/[0.06] focus:text-white">
                    Free
                  </SelectItem>
                  <SelectItem value="paid" className="focus:bg-white/[0.06] focus:text-white">
                    Paid
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter — segmented tab group.
                  Sliding highlight instead of per-button hard borders. */}
              <div className="inline-flex items-center gap-0.5 bg-[#131318] rounded-xl p-1 ring-1 ring-inset ring-white/[0.05]">
                {(["all", "published", "draft", "inactive"] as const).map((f) => {
                  const isActive = founderStatusFilter === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFounderStatusFilter(f)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all",
                        isActive
                          ? "bg-white/[0.08] text-white shadow-sm shadow-black/40"
                          : "text-[#8a8aa0] hover:text-white hover:bg-white/[0.03]",
                      )}
                    >
                      {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Channels Table */}
            {(() => {
              // Apply filters
              const filteredChannels = channels.filter(ch => {
                // Status Filter
                if (founderStatusFilter === "inactive") {
                  if (ch.isActive !== false) return false;
                } else if (founderStatusFilter === "published") {
                  if (ch.isActive === false) return false;
                } else if (founderStatusFilter === "draft") {
                  // Since we don't have draft state, draft tab is always empty
                  return false;
                }

                // Price Filter
                if (founderPriceFilter === "free") {
                  const isFree = ch.isFree || ch.price === 0;
                  if (!isFree) return false;
                } else if (founderPriceFilter === "paid") {
                  const isFree = ch.isFree || ch.price === 0;
                  if (isFree) return false;
                }

                return true;
              });

              const formatPrice = (ch: Channel) => {
                const symbol = ch.currency === "INR" ? "₹" : "$";
                const isFree = ch.isFree || ch.price === 0;
                if (isFree) return `${symbol}0.00`;
                const p = ch.price;
                const suffix = ch.isSubscription ? `/${ch.subscriptionPeriod?.slice(0, 2) || "mo"}` : "";
                return `${symbol}${p.toFixed(2)}${suffix}`;
              };

              const hasCustomDefault = channels.some(c => c.isDefault);

              return (
                <div className="w-full bg-[#0a0a0d] rounded-lg h-[600px] overflow-hidden flex flex-col">
                  {filteredChannels.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-[#1a1a22] flex items-center justify-center mx-auto mb-4">
                        <Rss className="w-8 h-8 text-[#3a3a4a]" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">No communities found</h3>
                      <p className="text-[#6b6b7b] text-sm">Create a new community or adjust your filters.</p>
                    </div>
                  ) : (
                    <div className="overflow-auto flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <table className="w-full min-w-[1100px] text-left border-collapse">
                        <thead className="sticky top-0 bg-[#0a0a0d] z-10">
                          <tr className="border-b border-[#1f1f2a] text-xs font-semibold text-[#9fa0b8]">
                            <th className="py-2.5 px-4 w-10">
                              <input
                                type="checkbox"
                                checked={filteredChannels.length > 0 && selectedChannelIds.length === filteredChannels.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedChannelIds(filteredChannels.map(ch => ch._id));
                                  } else {
                                    setSelectedChannelIds([]);
                                  }
                                }}
                                aria-label="Select all communities"
                                className={TABLE_CHECKBOX_CLASS}
                              />
                            </th>
                            <th className="py-2.5 px-4 whitespace-nowrap min-w-[120px]">Name</th>
                            <th className="py-2.5 px-4 whitespace-normal max-w-[100px] min-w-[80px] leading-tight">
                              <span className="sm:inline hidden">Community Type</span>
                              <span className="sm:hidden">Type</span>
                            </th>
                            <th className="py-2.5 px-4 whitespace-nowrap">Currency</th>
                            <th className="py-2.5 px-4 whitespace-nowrap">Frequency</th>
                            <th className="py-2.5 px-4 whitespace-nowrap">Price</th>
                            <th className="py-2.5 px-4 whitespace-nowrap">Status</th>
                            <th className="py-2.5 px-4 whitespace-normal max-w-[90px] min-w-[70px] leading-tight">
                              <span className="sm:inline hidden">Total Members</span>
                              <span className="sm:hidden">Members</span>
                            </th>
                            <th className="py-2.5 px-4 whitespace-normal max-w-[110px] min-w-[80px] leading-tight">
                              <span className="lg:inline hidden">Total Active Members</span>
                              <span className="lg:hidden sm:inline hidden">Active Members</span>
                              <span className="sm:hidden">Active</span>
                            </th>
                            {/* "Unsubbed (still active this cycle)" —
                                the count of members who cancelled a recurring
                                sub and are riding out their paid period. Amber
                                bucket, blank when zero. */}
                            <th className="py-2.5 px-4 whitespace-normal max-w-[110px] min-w-[85px] leading-tight">
                              <span className="lg:inline hidden">Unsubbed (still active)</span>
                              <span className="lg:hidden sm:inline hidden">Cancelling</span>
                              <span className="sm:hidden">Cancel</span>
                            </th>
                            {/* "Unsubbed" — total historical unsubs.
                                Includes both the "still active" batch AND
                                anyone whose access has already fully
                                expired via the sweeper. Read the diff
                                against the column to its left as
                                "already lost access." */}
                            <th className="py-2.5 px-4 whitespace-normal max-w-[100px] min-w-[75px] leading-tight">
                              <span className="sm:inline hidden">Unsubbed</span>
                              <span className="sm:hidden">Unsub</span>
                            </th>
                            <th className="py-2.5 px-4 whitespace-normal max-w-[90px] min-w-[70px] leading-tight">
                              <span className="sm:inline hidden">Total Revenue</span>
                              <span className="sm:hidden">Revenue</span>
                            </th>
                            <th className="py-2.5 px-4 whitespace-normal max-w-[95px] min-w-[75px] leading-tight">
                              <span className="sm:inline hidden">Monthly Revenue</span>
                              <span className="sm:hidden">MRR</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1f1f2a]">
                          {filteredChannels.map(ch => {
                            const isFree = ch.isFree || ch.price === 0;
                            const isActive = ch.isActive !== false;
                            const isEmployeesChannel = ch.title === "Employees" || ch.title === "Members";
                            const isEffectivelyDefault = ch.isDefault || (isEmployeesChannel && !hasCustomDefault);
                            const isReadOnly = isEmployeesChannel && !hasCustomDefault;

                            const publishDate = ch.createdAt ? new Date(ch.createdAt) : null;
                            // Native symbol is only used on the Price column
                            // (what the customer is charged). Revenue columns
                            // are always USD-normalised on the BE, so they
                            // show "$" regardless of the channel's currency.
                            const symbol = ch.currency === "INR" ? "₹" : "$";

                            // Per-channel real analytics (founder-only, from
                            // /feed/channels/analytics). Falls back to zeros
                            // for non-founder viewers or the initial fetch —
                            // the pseudo-random activeMembersCount and
                            // memberCount × price revenue estimate they
                            // replaced were both giving misleading numbers.
                            const rowAnalytics = analyticsById.get(ch._id);
                            const activeMembersCount =
                              rowAnalytics?.activeMembers ?? 0;
                            const channelRevenueUsd =
                              rowAnalytics?.totalRevenueUsd ?? 0;
                            const monthlyRevenueUsd =
                              rowAnalytics?.monthlyRevenueUsd; // may be null (one-time) or undefined

                            return (
                              <tr
                                key={ch._id}
                                className="group hover:bg-white/[0.02] transition-colors"
                              >
                                <td className="py-2 px-4 w-10">
                                  <input
                                    type="checkbox"
                                    checked={selectedChannelIds.includes(ch._id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedChannelIds(prev => [...prev, ch._id]);
                                      } else {
                                        setSelectedChannelIds(prev => prev.filter(id => id !== ch._id));
                                      }
                                    }}
                                    aria-label={`Select ${ch.title}`}
                                    className={TABLE_CHECKBOX_CLASS}
                                  />
                                </td>
                                {/* Name */}
                                <td className="py-2 px-4">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center relative">
                                      {ch.coverImage ? (
                                        <img src={ch.coverImage} alt={ch.title} className="w-full h-full object-cover" />
                                      ) : (
                                        <Rss className="w-4 h-4 text-[#3a3a4a]" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-white truncate group-hover:text-brand transition-colors">{ch.title}</p>
                                        {isEffectivelyDefault && (
                                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-[#3b82f6] text-white rounded-md shrink-0">
                                            Default
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Community Type */}
                                <td className="py-2 px-4">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${
                                    isFree ? "bg-[#8b5cf6]" : "bg-[#3b82f6]"
                                  }`}>
                                    {isFree ? "Free" : "Paid"}
                                  </span>
                                </td>

                                {/* Currency */}
                                <td className="py-2 px-4 text-sm text-[#9fa0b8] whitespace-nowrap">
                                  {isFree ? "—" : (ch.currency || "USD")}
                                </td>

                                {/* Frequency */}
                                <td className="py-2 px-4 text-sm text-[#9fa0b8] whitespace-nowrap capitalize">
                                  {isFree ? "—" : (ch.isSubscription ? (ch.subscriptionPeriod === "yearly" ? "Annual" : ch.subscriptionPeriod) : "One-Time")}
                                </td>

                                {/* Price */}
                                <td className="py-2 px-4 text-sm text-[#9fa0b8] whitespace-nowrap">
                                  {isFree ? `${symbol}0.00` : `${symbol}${(ch.price || 0).toFixed(2)}`}
                                </td>

                                {/* Status */}
                                <td className="py-2 px-4">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    isActive
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                                  }`}>
                                    {isActive ? "Published" : "Inactive"}
                                  </span>
                                </td>

                                {/* Total Members */}
                                <td className="py-2 px-4 text-sm text-white font-medium whitespace-nowrap">
                                  {(ch.memberCount ?? 0).toLocaleString()}
                                </td>

                                {/* Total Active Members */}
                                <td className="py-2 px-4 text-sm text-[#9fa0b8] whitespace-nowrap">
                                  {activeMembersCount.toLocaleString()}
                                </td>

                                {/* Unsubbed (still active this cycle) —
                                    amber when > 0, dash when 0 so the column
                                    doesn't get visually noisy for healthy
                                    channels. */}
                                <td className="py-2 px-4 text-sm whitespace-nowrap">
                                  {rowAnalytics && rowAnalytics.cancellingMembers > 0 ? (
                                    <span className="text-amber-400 font-medium">
                                      {rowAnalytics.cancellingMembers.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-[#3a3a4a]">—</span>
                                  )}
                                </td>

                                {/* Unsubbed (all-time). Rose color to
                                    distinguish from the amber "still
                                    active" batch on its left. Zero
                                    renders as dash so healthy channels
                                    stay quiet. */}
                                <td className="py-2 px-4 text-sm whitespace-nowrap">
                                  {rowAnalytics && rowAnalytics.totalUnsubs > 0 ? (
                                    <span className="text-rose-400 font-medium">
                                      {rowAnalytics.totalUnsubs.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-[#3a3a4a]">—</span>
                                  )}
                                </td>

                                {/* Total Revenue (USD, from paid invoices) */}
                                <td className="py-2 px-4 text-sm text-[#10B981] font-semibold whitespace-nowrap">
                                  {isFree
                                    ? "$0.00"
                                    : "$" +
                                      channelRevenueUsd.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                </td>

                                {/* Monthly Revenue (USD MRR from active subs).
                                    MRR is only defined for recurring paid
                                    channels — free + one-time channels
                                    show a dash. `null` means BE explicitly
                                    marked "not applicable"; `undefined`
                                    means the analytics call hasn't landed
                                    yet (or the row is missing for a
                                    non-founder viewer). Both render as
                                    "—" so the column never shows a
                                    misleading $0.00 for a channel type
                                    where MRR doesn't apply. */}
                                <td className="py-4 px-4 text-sm text-[#10B981] font-semibold whitespace-nowrap">
                                  {monthlyRevenueUsd === null ||
                                  monthlyRevenueUsd === undefined
                                    ? "—"
                                    : "$" +
                                      monthlyRevenueUsd.toLocaleString(
                                        "en-US",
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        },
                                      )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {(showCreateModal || showEditModal) && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            >
              <div ref={modalRef} className="relative w-full max-w-[560px] max-h-[92vh] flex flex-col bg-[#111114] border border-[#2a2a35] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35] shrink-0">
                      <h2 className="text-base font-semibold text-white">
                        {showCreateModal ? "Create Community" : "Edit Community"}
                      </h2>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                      <div className="w-full px-5 py-4 space-y-6">
                        {/* Community Title */}
                        <div>
                          <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                            Community Title <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Input
                              name="title"
                              value={formData.title}
                              onChange={handleInputChange}
                              placeholder="e.g., Design Systems Club"
                              maxLength={100}
                              className="bg-[#131316] border-[#2a2a35] text-white pr-16 text-sm h-10 rounded-lg focus:ring-brand/50 focus:border-brand/50"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9fa0b8]/60">
                              {formData.title.length}/100
                            </div>
                          </div>
                        </div>

                        {/* Upload Images */}
                        <div>
                          <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                            Upload Images
                          </label>
                          <div className="space-y-3">
                            {/* Main Cover Box */}
                            {formData.coverImage ? (
                              <div className="space-y-2">
                                {/* Shown at the banner's real ratio, so this preview
                                    is exactly what members get at the top of the feed. */}
                                <div
                                  style={{ aspectRatio: String(BANNER_ASPECT) }}
                                  className="relative w-full rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316]"
                                >
                                  <img src={formData.coverImage} className="w-full h-full object-cover" />
                                  {uploadingImage && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                      <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-[#6b6b7b]">
                                    Community banner preview
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={openCoverCropper}
                                      title="Reposition and zoom"
                                      className="flex items-center gap-1.5 border border-[#2a2a35] hover:border-brand/50 text-[#9fa0b8] hover:text-white text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors"
                                    >
                                      <Crop className="w-3.5 h-3.5" />
                                      Reposition
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormData((prev) => ({ ...prev, coverImage: "" }));
                                        setCoverSourceFile(null);
                                        setCoverCropState(null);
                                        setCoverOriginalUrl(null);
                                      }}
                                      title="Remove cover image"
                                      className="border border-[#2a2a35] hover:border-red-500/60 text-[#9fa0b8] hover:text-red-400 rounded-lg p-1.5 transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="border border-dashed border-[#2a2a35] rounded-xl w-full flex items-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                {uploadingImage ? (
                                  <div className="w-full py-8 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-4 p-5 w-full">
                                    <div className="w-12 h-12 rounded-xl bg-[#131316] flex items-center justify-center border border-[#2a2a35] shrink-0">
                                      <ImageIcon className="w-5 h-5 text-[#9fa0b8]" />
                                    </div>
                                    <div className="text-left">
                                      <span className="text-sm font-semibold text-white block">Upload cover image</span>
                                      <p className="text-xs text-[#6b6b7b] mt-0.5">
                                        Images should be horizontal, at least 1920px wide. PNG or JPG, up to 5mb
                                      </p>
                                      <p className="text-xs text-[#6b6b7b] mt-0.5">
                                        The banner is a wide 6:1 strip — you&apos;ll pick which part of it shows.
                                      </p>
                                    </div>
                                  </div>
                                )}
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageUpload}
                                  className="hidden"
                                  disabled={uploadingImage}
                                />
                              </div>
                            )}

                            {/* 3 Gallery slots below cover image */}
                            <div className="grid grid-cols-3 gap-3">
                              {Array.from({ length: 3 }).map((_, index) => {
                                const imgUrl = formData.galleryImages?.[index];
                                return (
                                  <div key={index} className="aspect-video w-full">
                                    {imgUrl ? (
                                      <div className="relative w-full h-full rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316]">
                                        <img src={imgUrl} className="w-full h-full object-cover" />
                                        <button
                                          type="button"
                                          onClick={() => setFormData(prev => ({
                                            ...prev,
                                            galleryImages: prev.galleryImages.filter((_, i) => i !== index)
                                          }))}
                                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        onClick={() => {
                                          galleryInputRef.current?.click();
                                        }}
                                        className="border border-dashed border-[#2a2a35] rounded-xl w-full h-full flex flex-col items-center justify-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80"
                                      >
                                        {uploadingGallery && index === (formData.galleryImages?.length || 0) ? (
                                          <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                                        ) : (
                                          <Plus className="w-5 h-5 text-[#9fa0b8]" />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <input
                              ref={galleryInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleGalleryUpload}
                              className="hidden"
                              disabled={uploadingGallery}
                            />
                          </div>
                        </div>

                        {/* Cover framing */}
                        <ImageCropDialog
                          open={showCoverCropper}
                          source={cropSource}
                          // Matches the community banner in FeedPageRedesigned:
                          // aspect-[6/1] on desktop, down to aspect-[4/1] on mobile.
                          aspect={BANNER_ASPECT}
                          safeAreaAspect={BANNER_NARROW_ASPECT}
                          storeWholeImage
                          outputWidth={1920}
                          title="Edit image"
                          description="The bright area is your community banner — drag, zoom or rotate to choose it."
                          confirmLabel="Save changes"
                          busy={uploadingImage}
                          // Whether reframing the saved cover is limiting is
                          // something only the dialog can tell, once it has
                          // measured the image — so it says so itself.
                          // Only meaningful against the original file — a saved
                          // cover URL is already cropped, so it starts fresh.
                          initialState={
                            cropSource instanceof File || cropSourceOriginalUrl ? coverCropState : null
                          }
                          onCancel={() => {
                            setShowCoverCropper(false);
                            setCropSource(null);
                          }}
                          onConfirm={handleCoverCropped}
                        />

                        {/* Introduction Video */}
                        <div>
                          <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                            Introduction Video
                          </label>
                          <div className="space-y-4">
                            {/* YouTube Paste Input */}
                            <div className="relative flex items-center">
                              <span className="absolute left-3.5 text-[#9fa0b8]/60">
                                <Video className="w-4 h-4" />
                              </span>
                              <Input
                                name="videoUrl"
                                value={formData.videoUrl}
                                onChange={(e) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    videoUrl: e.target.value,
                                    videoFile: "", // clear uploaded file if link is provided
                                  }));
                                }}
                                placeholder="Paste YouTube link..."
                                className="bg-[#131316] border-[#2a2a35] text-white pl-10 h-10 text-sm rounded-lg focus:ring-brand/50 focus:border-brand/50 w-full"
                              />
                            </div>

                            {formData.videoUrl && (() => {
                              const embedUrl = getYouTubeEmbedUrl(formData.videoUrl);
                              if (!embedUrl) return null;
                              return (
                                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#2a2a35] bg-black">
                                  <iframe
                                    src={embedUrl}
                                    className="w-full h-full"
                                    allowFullScreen
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  />
                                </div>
                              );
                            })()}

                            {/* Divider OR */}
                            <div className="relative flex py-2 items-center">
                              <div className="flex-grow border-t border-[#2a2a35]/40"></div>
                              <span className="flex-shrink mx-4 text-xs font-semibold text-[#6b6b7b]">OR</span>
                              <div className="flex-grow border-t border-[#2a2a35]/40"></div>
                            </div>

                            {/* Video Upload Box */}
                            <div>
                              {formData.videoFile ? (
                                <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-4 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                      <CheckCircle className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-white">Video uploaded</p>
                                      <p className="text-xs text-green-400">Ready to save</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={removeUploadedVideo}
                                    className="text-[#9fa0b8] hover:text-red-400 transition-colors p-1.5 rounded-lg border border-[#2a2a35] hover:bg-red-500/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : uploadingVideo ? (
                                <div className="border border-[#2a2a35] rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-[#13131a]/40">
                                  <Loader2 className="w-6 h-6 text-brand animate-spin" />
                                  <span className="text-xs text-[#9fa0b8]">Uploading video...</span>
                                </div>
                              ) : (
                                <div
                                  onClick={() => videoFileInputRef.current?.click()}
                                  className="border border-dashed border-[#2a2a35] hover:border-brand/50 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80 transition-colors"
                                >
                                  <div className="w-10 h-10 rounded-lg bg-[#131316] flex items-center justify-center border border-[#2a2a35]">
                                    <Upload className="w-4 h-4 text-[#9fa0b8]" />
                                  </div>
                                  <span className="text-sm font-semibold text-white">Upload MP4 video</span>
                                  <p className="text-xs text-[#6b6b7b]">Max 500MB • .mp4 format</p>
                                </div>
                              )}
                              <input
                                ref={videoFileInputRef}
                                type="file"
                                accept="video/mp4"
                                onChange={handleVideoUpload}
                                className="hidden"
                                disabled={uploadingVideo}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Short Description */}
                        <div>
                          <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                            Short Description
                          </label>
                          <DescriptionEditor
                            value={formData.description}
                            onChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                description: value,
                              }))
                            }
                            placeholder="A short summary shown on your community card..."
                          />
                          {/* Character count & warning */}
                          {(() => {
                            const len = formData.description.length;
                            const max = 5000;
                            const isOver = len > max;
                            const isNear = len > max * 0.85;
                            return (
                              <div className={`flex items-center justify-end gap-1.5 mt-1.5 text-xs ${
                                isOver ? 'text-red-400' : isNear ? 'text-amber-400' : 'text-[#6b6b7b]'
                              }`}>
                                {isOver && (
                                  <span className="mr-auto text-red-400 font-medium">
                                    Description is too long — please shorten it
                                  </span>
                                )}
                                <span className="font-mono">
                                  {len.toLocaleString()}/{max.toLocaleString()}
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Default Community Toggle */}
                        <div className="flex items-center justify-between py-4 border-t border-[#2a2a35]/40 mt-2">
                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                              Default Community
                            </label>
                            <p className="text-xs text-[#9fa0b8]">
                              Set this community as the default auto-join workspace community for new members.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, isDefault: !prev.isDefault }))}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ml-4 ${
                              formData.isDefault
                                ? "bg-brand cursor-pointer hover:opacity-90"
                                : "bg-[#2a2a35] cursor-pointer hover:bg-[#3a3a45]"
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                formData.isDefault ? "translate-x-[18px]" : "translate-x-[3px]"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Mandatory on join — free communities only */}
                        {(() => {
                          // A paid community can't be mandated: auto-enrolling
                          // someone would hand them something they never
                          // bought. The backend refuses it and clears the flag
                          // if the community is later priced, so the UI just
                          // mirrors that rule.
                          const isPaidCommunity =
                            !formData.isFree && Number(formData.price || 0) > 0;
                          const on = formData.mandatoryOnJoin && !isPaidCommunity;
                          return (
                            <div className="flex items-start justify-between py-4 border-t border-[#2a2a35]/40">
                              <div className="space-y-1 pr-4">
                                <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                  Mandatory on signup
                                </label>
                                <p className="text-xs text-[#9fa0b8]">
                                  Everyone who joins this office is
                                  automatically enrolled in this community.
                                </p>
                                {isPaidCommunity && (
                                  <p className="text-[11px] text-amber-400/90 flex items-center gap-1.5 pt-0.5">
                                    <Lock className="h-3 w-3 shrink-0" />
                                    Only free communities can be mandatory —
                                    remove the price to enable this.
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={isPaidCommunity}
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    mandatoryOnJoin: !prev.mandatoryOnJoin,
                                  }))
                                }
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ml-4 mt-0.5 ${
                                  isPaidCommunity
                                    ? "bg-[#2a2a35]/60 cursor-not-allowed opacity-50"
                                    : on
                                      ? "bg-brand cursor-pointer hover:opacity-90"
                                      : "bg-[#2a2a35] cursor-pointer hover:bg-[#3a3a45]"
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                    on ? "translate-x-[18px]" : "translate-x-[3px]"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })()}

                        {/* Post-purchase order email */}
                        <div className="py-4 border-t border-[#2a2a35]/40">
                          <ProductEmailAlertsSection
                            {...emailAlertsForm.sectionProps}
                            product={{
                              productName: formData.title,
                              price: parseFloat(formData.price) || 0,
                              currency: formData.currency,
                              isFree: formData.isFree,
                            }}
                          />
                        </div>

                        {/* Founder's own "someone joined" alert */}
                        <div className="py-4 border-t border-[#2a2a35]/40">
                          <FounderAlertsSection
                            {...founderAlertsForm.sectionProps}
                            context="community"
                          />
                        </div>

                        {/* Post-purchase thank-you page trigger (edit
                            mode only — create needs an _id to save
                            against). Same reusable drawer Products +
                            Courses use; itemType="channel" routes save
                            through updateChannel. */}
                        {selectedChannel && (
                          <div className="py-4 border-t border-[#2a2a35]/40">
                            <button
                              type="button"
                              onClick={() => setThankYouOpen(true)}
                              className="w-full text-left rounded-xl border border-[#2a2a35] hover:border-brand/40 bg-[#0e0e12] hover:bg-[#111114] transition-colors px-4 py-3 flex items-center gap-3"
                            >
                              <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center shrink-0">
                                <Sparkles className="w-4 h-4 text-brand" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-white">
                                  Post-purchase page
                                  {thankYouSnapshot ? (
                                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                                      · configured
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-[#9fa0b8] mt-0.5">
                                  Redirect new members, or show a custom
                                  message and CTAs after they join.
                                </div>
                              </div>
                            </button>
                          </div>
                        )}

                        {/* ============= Page Details Section ============= */}
                        <div className="space-y-4">
                          <div className="pb-4 pt-1 space-y-6">
                              {/* Benefits Section */}
                              <div className="space-y-3">
                                <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                  Benefits / Key features <span className="text-red-500">*</span> <span className="text-[10px] text-[#6b6b7b] lowercase font-normal">At least 1 required</span>
                                </label>

                                <div className="space-y-3">
                                  {(formData.benefits.length > 0 ? formData.benefits : [{ icon: "😊", title: "", description: "" }]).map((benefit, index) => (
                                    <div
                                      key={index}
                                      className={cn(
                                        "bg-[#131316] border border-[#2a2a35] rounded-xl p-4 space-y-4 transition-opacity duration-200"
                                      )}
                                    >
                                      {/* Top Row: emoji, title input, and delete button */}
                                      <div className="flex items-center gap-3">

                                        {/* Emoji Button */}
                                        <div className="relative">
                                          <button
                                            type="button"
                                            onClick={() => setActiveEmojiPickerIndex(activeEmojiPickerIndex === index ? null : index)}
                                            className="w-10 h-10 rounded-lg bg-[#131316] border border-[#2a2a35] flex items-center justify-center cursor-pointer hover:bg-[#252530] transition-colors shrink-0 text-lg"
                                          >
                                            {benefit.icon || "😊"}
                                          </button>
                                          
                                          {activeEmojiPickerIndex === index && (
                                            <>
                                              <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setActiveEmojiPickerIndex(null)}
                                              />
                                              <div className="absolute top-full left-0 mt-2 z-50 bg-[#16181C] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden">
                                                <EmojiPicker
                                                  onEmojiClick={(emojiData) => {
                                                    updateBenefitIcon(index, emojiData.emoji);
                                                    setActiveEmojiPickerIndex(null);
                                                  }}
                                                  theme={Theme.DARK}
                                                  width={300}
                                                  height={380}
                                                  lazyLoadEmojis={true}
                                                />
                                              </div>
                                            </>
                                          )}
                                        </div>

                                        <Input
                                          value={benefit.title}
                                          onChange={(e) => updateBenefitTitle(index, e.target.value)}
                                          placeholder={`e.g., Benefit ${index + 1} title`}
                                          className="bg-[#131316] border-[#2a2a35] text-white h-10 text-sm flex-1 rounded-lg focus:ring-brand/50 focus:border-brand/50 px-3"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeBenefitRow(index)}
                                          disabled={formData.benefits.length <= 1}
                                          className="w-10 h-10 rounded-lg border border-[#2a2a35] bg-[#131316] text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>

                                      {/* Description Row */}
                                      <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                          Description
                                        </label>
                                        <textarea
                                          value={benefit.description}
                                          onChange={(e) => updateBenefitDescription(index, e.target.value)}
                                          placeholder="Write a short description..."
                                          rows={3}
                                          className="w-full bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-lg focus:ring-brand/50 focus:border-brand/50 p-3 outline-none resize-none transition-all duration-200 placeholder-[#5a5a6a]"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex items-center gap-3 mt-2">
                                  <button
                                    type="button"
                                    onClick={addBenefitRow}
                                    disabled={formData.benefits.length >= MAX_BENEFITS}
                                    className="flex items-center gap-1.5 text-xs font-bold text-brand hover:opacity-80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                  >
                                    <Plus className="h-4 w-4" />
                                    + Add benefit
                                  </button>
                                  {formData.benefits.length >= MAX_BENEFITS && (
                                    <span className="text-[11px] text-[#6b6b7b]">
                                      {limitReachedLabel(MAX_BENEFITS, "benefits")}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="h-px bg-[#2a2a35]" />

                              {/* FAQs Sub-section */}
                              <div className="space-y-3">
                                <div
                                  onClick={() => setFaqsSectionExpanded(!faqsSectionExpanded)}
                                  className="flex items-center justify-between py-2 cursor-pointer transition-colors"
                                >
                                  <label className="text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide cursor-pointer flex items-center gap-1">
                                    FAQs <span className="text-red-500">*</span> <span className="text-[10px] text-[#6b6b7b] lowercase font-normal">At least 1 required</span>
                                  </label>
                                  {faqsSectionExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#9fa0b8]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#9fa0b8]" />}
                                </div>

                                {faqsSectionExpanded && (
                                  <div className="pb-4 pt-1 space-y-4">
                                    {(formData.faqs.length > 0 ? formData.faqs : [{ question: "", answer: "" }]).map((faq, index) => (
                                      <div
                                        key={index}
                                        className="flex flex-col gap-2 pb-4 border-b border-[#2a2a35]/30 last:border-b-0"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Input
                                            value={faq.question}
                                            onChange={(e) => updateFaqQuestion(index, e.target.value)}
                                            placeholder="e.g., What is this community about?"
                                            className="bg-[#131316] border-[#2a2a35] text-white h-10 text-sm flex-1 rounded-lg focus:ring-brand/50 focus:border-brand/50 px-3"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => removeFaqRow(index)}
                                            disabled={formData.faqs.length <= 1}
                                            className="w-10 h-10 rounded-lg border border-[#2a2a35] bg-[#131316] text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-xs font-semibold text-[#8b8c9d]">
                                            Answer
                                          </label>
                                          <textarea
                                            value={faq.answer}
                                            onChange={(e) => updateFaqAnswer(index, e.target.value)}
                                            placeholder="Write a clear answer..."
                                            rows={3}
                                            className="w-full bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-lg focus:ring-brand/50 focus:border-brand/50 focus:outline-none p-3 resize-none"
                                          />
                                        </div>
                                      </div>
                                    ))}

                                    <div className="flex items-center gap-3 mt-2">
                                      <button
                                        type="button"
                                        onClick={addFaqRow}
                                        disabled={formData.faqs.length >= MAX_FAQS}
                                        className="flex items-center gap-1.5 text-xs font-bold text-brand hover:opacity-80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                      >
                                        <Plus className="h-4 w-4" />
                                        + Add FAQ
                                      </button>
                                      {formData.faqs.length >= MAX_FAQS && (
                                        <span className="text-[11px] text-[#6b6b7b]">
                                          {limitReachedLabel(MAX_FAQS, "FAQs")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                        </div>

                        {/* ============= Community Type ============= */}
                        <div>
                          <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                            Community Type <span className="text-red-500">*</span>
                          </label>
                          <div className="flex rounded-lg border border-[#2a2a35] bg-[#13131a] p-1 w-full">
                            <button
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, isFree: true }))}
                              className={cn(
                                "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all text-center",
                                formData.isFree ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                              )}
                            >
                              Free
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, isFree: false }))}
                              className={cn(
                                "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all text-center",
                                !formData.isFree ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                              )}
                            >
                              Paid
                            </button>
                          </div>
                        </div>

                        {/* ============= Pricing Section ============= */}
                        {!formData.isFree && (
                          <div className="space-y-4">
                            <div className="pb-4 pt-1 space-y-5">
                                {/* Subscription Period */}
                                <div className="space-y-1.5 w-full">
                                  <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                    Subscription Period <span className="text-red-500">*</span>
                                  </label>
                                  <SubscriptionPeriodDropdown
                                    value={formData.isSubscription ? formData.subscriptionPeriod : "one-time"}
                                    onChange={(val) => {
                                      if (val === "one-time") {
                                        setFormData((prev) => ({
                                          ...prev,
                                          isSubscription: false,
                                          subscriptionPeriod: "monthly",
                                        }));
                                      } else {
                                        setFormData((prev) => ({
                                          ...prev,
                                          isSubscription: true,
                                          subscriptionPeriod: val as any,
                                        }));
                                      }
                                    }}
                                  />
                                </div>

                                {/* Currency Selector */}
                                <div className="space-y-1.5 w-full">
                                  <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                    Currency <span className="text-red-500">*</span>
                                  </label>
                                  <CurrencyDropdown
                                    value={formData.currency}
                                    onChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                                  />
                                </div>

                                {/* Selling Price */}
                                <div className="space-y-1.5 w-full">
                                  <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                    Selling price <span className="text-red-500">*</span>
                                  </label>
                                  <div className="relative w-full">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9fa0b8] text-sm font-medium">
                                      {formData.currency === "INR" ? "₹" : "$"}
                                    </span>
                                    <Input
                                      type="number"
                                      name="price"
                                      value={formData.price}
                                      onChange={handleInputChange}
                                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                      placeholder="0.00"
                                      min="0"
                                      step="0.01"
                                      className="bg-[#131316] border-[#2a2a35] text-white pl-8 text-sm h-10 rounded-lg focus:ring-brand/50 focus:border-brand/50 w-full"
                                    />
                                  </div>
                                </div>

                                {/* GST / Tax Treatment */}
                                <div className="space-y-2">
                                  <span className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                    GST / Tax
                                  </span>
                                  <p className="text-xs text-[#9fa0b8] leading-normal">
                                    18.00% GST (Goods &amp; Services Tax) applies to buyers in India, whatever currency you price in. Does the price above already include it?
                                  </p>
                                  <div className="flex rounded-lg border border-[#2a2a35] bg-[#131316] p-1 w-full gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setFormData((prev) => ({ ...prev, gstInclusive: true }))}
                                      className={cn(
                                        "flex-1 py-2 text-xs font-medium rounded-md transition-all text-center",
                                        formData.gstInclusive ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                                      )}
                                    >
                                      Yes, I'll cover it in the above price
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setFormData((prev) => ({ ...prev, gstInclusive: false }))}
                                      className={cn(
                                        "flex-1 py-2 text-xs font-medium rounded-md transition-all text-center",
                                        !formData.gstInclusive ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                                      )}
                                    >
                                      No, add it on top
                                    </button>
                                  </div>
                                </div>

                                {/* iOS App Purchases */}
                                <div className="space-y-2">
                                  <span className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                    iOS App Purchases
                                  </span>
                                  <p className="text-xs text-[#9fa0b8] leading-normal">
                                    Do you require your customers to be able to pay for this community on the iOS app?
                                  </p>
                                  <div className="flex rounded-lg border border-[#2a2a35] bg-[#131316] p-1 w-full gap-1">
                                    <button
                                      type="button"
                                      className="flex-1 py-2 text-xs font-bold rounded-md transition-all text-center bg-brand text-brand-foreground"
                                    >
                                      No
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toast.info("iOS app purchases coming soon!")}
                                      className="flex-1 py-2 text-xs font-medium rounded-md transition-all text-center text-[#8b8c9d] bg-transparent hover:bg-[#1a1a22] flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      Yes <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2a2a35] text-brand font-medium">Coming Soon</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Affiliate Program Section */}
                                <div className="border-t border-[#2a2a35]/40 pt-4 space-y-4">
                                  <CommissionPlanSection
                                    itemType="channel"
                                    itemId={selectedChannel?._id}
                                    itemName={formData.title || "New Community"}
                                    isPaid={true}
                                  />
                                  {selectedChannel?._id && (
                                    <CompPlanDisplay itemType="channel" itemId={selectedChannel._id} />
                                  )}
                                </div>
                              </div>
                          </div>
                        )}

                      {/* Actions row (part of the page, not a footer) */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
                        {/* Price Info / Breakdown */}
                        {!formData.isFree && (
                          <div className="flex flex-wrap items-center gap-5 w-full sm:w-auto">
                            <div className="flex items-center gap-5">
                              {/* iOS Price block */}
                              <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                  iOS
                                </span>
                                <span className="text-[#9fa0b8] font-bold text-sm sm:text-base mt-0.5">
                                  N/A
                                </span>
                              </div>

                              {/* Vertical divider */}
                              <div className="h-7 w-px bg-[#2a2a35]" />

                              {/* Non-iOS Price block */}
                              <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                                  Non-iOS
                                </span>
                                {/* Both figures: what the buyer is charged, and
                                    the pre-tax base. Showing only one made it
                                    impossible to tell whether GST was already
                                    inside the price. */}
                                <span className="text-brand font-bold text-sm sm:text-base mt-0.5 leading-none">
                                  {formData.isFree || !formData.price || parseFloat(formData.price) <= 0 ? "$0.00" : priceDetails.currency + priceDetails.totalWeb.toFixed(2)}
                                  {!formData.isFree && parseFloat(formData.price) > 0 && (
                                    <span className="text-[9px] font-medium text-[#6b6b7b] ml-1">incl. GST</span>
                                  )}
                                </span>
                                {!formData.isFree && parseFloat(formData.price) > 0 && (
                                  <span className="text-[9px] text-[#8b8c9d] mt-0.5 leading-none">
                                    {priceDetails.currency}{priceDetails.baseWeb.toFixed(2)} excl. GST
                                    {priceDetails.gstWeb > 0 && (
                                      <span className="text-[#6b6b7b]"> · GST {priceDetails.currency}{priceDetails.gstWeb.toFixed(2)}</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setShowPriceBreakdownModal(true)}
                              disabled={formData.isFree || !formData.price || parseFloat(formData.price) <= 0}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1E1E] border border-[#2a2a35] text-xs font-semibold text-[#9fa0b8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-2"
                            >
                              <Info className="w-3.5 h-3.5" />
                              Price Breakdown
                            </button>
                          </div>
                        )}

                        {/* Buttons */}
                        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end ml-auto">
                          <button
                            type="button"
                            onClick={closeModal}
                            className="text-[#9fa0b8] hover:text-white text-sm h-10 px-4 font-semibold transition-colors"
                          >
                            Cancel
                          </button>
                          <Button
                            type="button"
                            onClick={handleSaveClick}
                            disabled={submitting}
                            className="bg-brand hover:opacity-90 text-brand-foreground disabled:opacity-50 h-10 text-sm px-6 font-bold rounded-lg transition-colors"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {showCreateModal ? "Creating..." : "Saving..."}
                              </>
                            ) : (
                              showCreateModal ? "Create" : "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                      </div>

                    </div>
              </div>
            </div>
          )
      }
        {/* iOS Pricing Confirmation Modal */}
        {showIosPricingModal && (
          <Dialog open={showIosPricingModal} onOpenChange={setShowIosPricingModal}>
            <DialogContent className="bg-[#18181c] border border-[#2a2a35] z-[1200] max-w-[480px] text-white p-6 rounded-2xl" showCloseButton={false}>
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">iOS Pricing</h3>
                <button
                  type="button"
                  onClick={() => setShowIosPricingModal(false)}
                  className="w-7 h-7 rounded-full border border-[#2a2a35] bg-[#1a1a22] flex items-center justify-center text-[#9fa0b8] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-[#9fa0b8] leading-relaxed mb-6">
                Is the price you entered inclusive of Apple's 30% fee? If not, we will be adding 30% to the final price that users on iOS will have to pay to cover Apple's fee.
              </p>

              {/* Options */}
              <div className="space-y-3 mb-6">
                {/* Yes, I'll cover it */}
                <div
                  onClick={() => setTempIosOption("inclusive")}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    tempIosOption === "inclusive"
                      ? "bg-[#1E1E1E] border-brand"
                      : "bg-[#1E1E1E] border-[#2a2a35] hover:border-[#3a3a45]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    tempIosOption === "inclusive" ? "border-brand" : "border-[#9fa0b8]/40"
                  }`}>
                    {tempIosOption === "inclusive" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-brand" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-white">
                    Yes, I'll cover it in the above price
                  </span>
                </div>

                {/* No, add it on top */}
                <div
                  onClick={() => setTempIosOption("exclusive")}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    tempIosOption === "exclusive"
                      ? "bg-[#1E1E1E] border-brand"
                      : "bg-[#1E1E1E] border-[#2a2a35] hover:border-[#3a3a45]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    tempIosOption === "exclusive" ? "border-brand" : "border-[#9fa0b8]/40"
                  }`}>
                    {tempIosOption === "exclusive" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-brand" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-white">
                    No, add it on top
                  </span>
                </div>

                {/* Restrict purchases */}
                <div
                  onClick={() => setTempIosOption("restrict")}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    tempIosOption === "restrict"
                      ? "bg-[#1E1E1E] border-brand"
                      : "bg-[#1E1E1E] border-[#2a2a35] hover:border-[#3a3a45]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    tempIosOption === "restrict" ? "border-brand" : "border-[#9fa0b8]/40"
                  }`}>
                    {tempIosOption === "restrict" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-brand" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-white">
                    Restrict purchases from iOS app
                  </span>
                </div>
              </div>

              {/* Warning note for restrict option */}
              {tempIosOption === "restrict" && (
                <div className="bg-[#ea580c]/5 border border-[#ea580c]/25 rounded-xl p-4 mb-6">
                  <p className="text-xs text-[#ea580c]/90 leading-relaxed">
                    Just because you restrict purchases from the iOS app, doesn't mean that iPhone users can't buy your community. It just means that they will have to purchase it in the web or mobile browser and then enjoy the benefits inside of the Garage mobile app.
                  </p>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowIosPricingModal(false)}
                  className="text-[#9fa0b8] hover:text-white text-sm font-semibold h-10 px-4 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmIosPricing}
                  className="bg-brand hover:opacity-90 text-brand-foreground h-10 px-6 font-bold rounded-lg transition-colors text-sm"
                >
                  Confirm
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Default Community Confirmation */}
        <AlertDialog
          open={showDefaultConfirmModal}
          onOpenChange={(open) => {
            setShowDefaultConfirmModal(open);
            if (!open) setPendingDefaultState(null);
          }}
        >
          <AlertDialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[600] max-w-[420px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white text-lg">
                {pendingDefaultState === true ? "Set Default Community" : "Remove Default Community"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#9fa0b8] mt-3" asChild>
                <div className="space-y-4">
                  {/* FROM → TO visual */}
                  <div className="flex items-center gap-2 bg-[#1a1a22] rounded-xl p-3 border border-[#2a2a35]">
                    <div className="flex-1 text-center">
                      <p className="text-[10px] text-[#6b6b7b] uppercase tracking-wider mb-1">From</p>
                      <p className="text-sm font-semibold text-white">
                        {pendingDefaultState === true
                          ? (channels.find(c => c.isDefault && c._id !== selectedChannel?._id)?.title || "Employees")
                          : (formData.title || "this community")}
                      </p>
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center">
                      <span className="text-brand text-sm font-bold">→</span>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-[10px] text-[#6b6b7b] uppercase tracking-wider mb-1">To</p>
                      <p className="text-sm font-semibold text-brand">
                        {pendingDefaultState === true
                          ? (formData.title || "this community")
                          : "Employees"}
                      </p>
                    </div>
                  </div>

                  {/* Consequence note */}
                  <p className="text-xs text-[#6b6b7b] leading-relaxed">
                    {pendingDefaultState === true
                      ? <>New members who join your workspace will automatically be added to <span className="text-white font-medium">{formData.title || "this community"}</span> instead of Employees.</>
                      : <>The default will revert to <span className="text-white font-medium">Employees</span>. New members will automatically join Employees when they join your workspace.</>
                    }
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#2a2a35]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  if (pendingDefaultState === null || !orgId || !selectedChannel) return;

                  try {
                    await setChannelDefault(selectedChannel._id, orgId, pendingDefaultState);
                    
                    // Sync local state instantly
                    setChannels((prevChannels) => 
                      prevChannels.map(c => {
                        if (c._id === selectedChannel._id) return { ...c, isDefault: pendingDefaultState };
                        if (pendingDefaultState === true) return { ...c, isDefault: false };
                        return c;
                      })
                    );
                    
                    setFormData((prev) => ({ ...prev, isDefault: pendingDefaultState }));
                    toast.success(pendingDefaultState ? "Successfully updated default community" : "Removed default community. New members will join Employees.");
                    
                    setShowDefaultConfirmModal(false);
                    setPendingDefaultState(null);
                  } catch (err) {
                    console.error("Failed to sync default state:", err);
                    toast.error("Failed to update default community. Please try again.");
                  }
                }}
                className="bg-brand hover:opacity-90 text-brand-foreground"
              >
                Confirm Change
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation */}
        <AlertDialog
          open={showDeleteModal && !!selectedChannel}
          onOpenChange={() => {
            setShowDeleteModal(false);
            setSelectedChannel(null);
          }}
        >
          <AlertDialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[600]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                Delete Community
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#9fa0b8]">
                Are you sure you want to delete "{selectedChannel?.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#2a2a35]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteChannel}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation */}
        <AlertDialog
          open={showBulkDeleteModal}
          onOpenChange={setShowBulkDeleteModal}
        >
          <AlertDialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[600]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                Delete Communities
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#9fa0b8]">
                Are you sure you want to delete {selectedChannelIds.length} selected communities? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#2a2a35]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                onClick={handleBulkDeleteChannels}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Floating bottom selection menu */}
        {selectedChannelIds.length > 0 && !showCreateModal && !showEditModal && !isInStream && (
          <div className="fixed bottom-6 left-[calc(50%+var(--sidebar-width,0px)/2)] -translate-x-1/2 z-[550] flex items-center justify-center w-full px-4 max-w-[calc(100%-32px)] sm:max-w-md md:max-w-lg lg:max-w-xl pointer-events-none">
            <div
              className="flex items-center gap-4 p-3 pointer-events-auto rounded-[24px] text-white"
              style={{
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                background: "rgba(30, 30, 30, 0.75)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.25)"
              }}
            >
              {/* Selected Count */}
              <div className="pl-4 pr-2 text-sm font-semibold text-white whitespace-nowrap">
                {selectedChannelIds.length} Selected
              </div>

              {/* Vertical Divider */}
              <div className="h-8 w-[1px] bg-white/20 mx-1 self-center" />

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pr-2">
                {/* View Action */}
                <button
                  type="button"
                  disabled={selectedChannelIds.length !== 1}
                  onClick={() => {
                    const selectedChan = channels.find(c => c._id === selectedChannelIds[0]);
                    if (selectedChan) {
                      window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                        detail: { type: "view_options", channel: selectedChan }
                      }));
                    }
                  }}
                  className={`flex flex-col items-center justify-center px-4 py-2 gap-1 rounded-[16px] transition-all duration-300 ${
                    selectedChannelIds.length === 1
                      ? "text-white/80 hover:text-white hover:bg-white/[0.05] cursor-pointer"
                      : "text-white/30 cursor-not-allowed"
                  }`}
                  title="View options (available when 1 item selected)"
                >
                  <Eye className="h-5 w-5" />
                  <span className="text-[11px] font-medium tracking-wide">View</span>
                </button>

                {/* Edit Action */}
                <button
                  type="button"
                  disabled={selectedChannelIds.length !== 1}
                  onClick={() => {
                    const selectedChan = channels.find(c => c._id === selectedChannelIds[0]);
                    if (selectedChan) {
                      openEditModal(selectedChan);
                    }
                  }}
                  className={`flex flex-col items-center justify-center px-4 py-2 gap-1 rounded-[16px] transition-all duration-300 ${
                    selectedChannelIds.length === 1
                      ? "text-white/80 hover:text-white hover:bg-white/[0.05] cursor-pointer"
                      : "text-white/30 cursor-not-allowed"
                  }`}
                  title="Edit community (available when 1 item selected)"
                >
                  <Edit2 className="h-5 w-5" />
                  <span className="text-[11px] font-medium tracking-wide">Edit</span>
                </button>

                {/* Share Action — opens the same affiliate-link panel
                    (referral URL + QR) the community cards use. */}
                <button
                  type="button"
                  disabled={selectedChannelIds.length !== 1}
                  onClick={() => {
                    const selectedChan = channels.find(c => c._id === selectedChannelIds[0]);
                    if (selectedChan) {
                      window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                        detail: {
                          type: "affiliate",
                          channel: selectedChan,
                          itemType: "channel",
                          affiliateId: affiliateId
                        }
                      }));
                    }
                  }}
                  className={`flex flex-col items-center justify-center px-4 py-2 gap-1 rounded-[16px] transition-all duration-300 ${
                    selectedChannelIds.length === 1
                      ? "text-white/80 hover:text-white hover:bg-white/[0.05] cursor-pointer"
                      : "text-white/30 cursor-not-allowed"
                  }`}
                  title="Share affiliate link (available when 1 item selected)"
                >
                  <Share2 className="h-5 w-5" />
                  <span className="text-[11px] font-medium tracking-wide">Share</span>
                </button>

                {/* Delete Action */}
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="flex flex-col items-center justify-center px-4 py-2 gap-1 rounded-[16px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-300 cursor-pointer"
                  title="Delete selected communities"
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="text-[11px] font-medium tracking-wide text-white/80 hover:text-white">Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Price Breakdown Modal */}
        {showPriceBreakdownModal && (() => {
          const breakdown = getDetailedPriceBreakdown();
          const formatTablePrice = (amount: number, isMinusOrPlus?: "minus" | "plus" | "none") => {
            const symbol = formData.currency === "INR" ? "₹" : "$";
            if (amount === 0 && isMinusOrPlus === "none") return "-";
            const prefix = isMinusOrPlus === "plus" ? "+" : isMinusOrPlus === "minus" ? "-" : "";
            return `${prefix}${symbol}${amount.toFixed(2)}`;
          };
          const getPeriodText = () => {
            if (!formData.isSubscription) return "one-time payment";
            switch (formData.subscriptionPeriod) {
              case "weekly": return "per week";
              case "monthly": return "per month";
              case "quarterly": return "per quarter";
              case "yearly": return "per year";
              default: return "per month";
            }
          };

          return (
            <Dialog open={showPriceBreakdownModal} onOpenChange={setShowPriceBreakdownModal}>
              <DialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[1200] max-w-2xl text-white p-6 rounded-2xl" showCloseButton={false}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">Price Preview</span>
                    <span className="w-2 h-2 rounded-full bg-brand" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPriceBreakdownModal(false)}
                    className="w-7 h-7 rounded-full border border-[#2a2a35] bg-[#1a1a22] flex items-center justify-center text-[#9fa0b8] hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* GST only applies to buyers in India — this preview shows
                    that case. Without saying so the numbers read as universal. */}
                <p className="text-[11px] text-[#6b6b7b] leading-relaxed -mt-3 mb-5">
                  Figures below are for a buyer <span className="text-[#9fa0b8]">in India</span>, where 18% GST applies.
                  Buyers outside India pay no GST: they pay the listed price and
                  the full amount counts as your base.
                </p>

                {/* Cards Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* iOS Customers Card */}
                  <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2 opacity-75">
                    <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                      <Apple className="w-3 h-3 text-[#9fa0b8]" />
                      iOS Customers
                    </div>
                    <div className="text-2xl font-bold text-[#9fa0b8] mt-1">
                      N/A
                    </div>
                    <div className="text-xs text-[#6b6b7b]">
                      {getPeriodText()}
                    </div>
                  </div>

                  {/* Non-iOS Customers Card */}
                  <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2">
                    <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                      <Smartphone className="w-3 h-3 text-[#9fa0b8]" />
                      Non-iOS Customers
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {formatCardPrice(breakdown.nonIos.customerPays, formData.currency)}
                    </div>
                    <div className="text-xs text-[#6b6b7b]">
                      {getPeriodText()}
                    </div>
                  </div>
                </div>

                {/* Table Container */}
                <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-white mb-2">Price Breakdown</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* iOS Column */}
                    <div className="space-y-2 opacity-75">
                      <div className="text-xs text-[#9fa0b8] font-semibold mb-3">iOS Customers</div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Base price</span>
                        <span className="text-[#9fa0b8]">N/A</span>
                      </div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Apple fee (30%)</span>
                        <span className="text-[#9fa0b8]">N/A</span>
                      </div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>GST (18%)</span>
                        <span className="text-[#9fa0b8]">N/A</span>
                      </div>
                      
                      <div className="border-t border-[#2a2a35]/60 my-1 pt-1.5 flex justify-between text-xs font-semibold text-[#9fa0b8]">
                        <span>Customer pays</span>
                        <span>N/A</span>
                      </div>
                      
                      {/* Distribution */}
                      <div className="pt-2">
                        <div className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-semibold mb-2">DISTRIBUTION</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Government (GST)</span>
                            <span className="text-[#9fa0b8]">N/A</span>
                          </div>
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Apple</span>
                            <span className="text-[#9fa0b8]">N/A</span>
                          </div>
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Platform (5%)</span>
                            <span className="text-[#9fa0b8]">N/A</span>
                          </div>
                          {breakdown.affPercent > 0 && (
                            <div className="flex justify-between text-xs text-[#9fa0b8]">
                              <span>→ Affiliate ({breakdown.affPercent}%)</span>
                              <span className="text-[#9fa0b8]">N/A</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="border-t border-[#2a2a35]/60 mt-2 pt-2 flex justify-between text-xs font-bold text-[#9fa0b8]">
                        <span>You receive</span>
                        <span>N/A</span>
                      </div>
                    </div>

                    {/* Non-iOS Column */}
                    <div className="space-y-2">
                      <div className="text-xs text-[#9fa0b8] font-semibold mb-3">Non-iOS Customers</div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Base price</span>
                        <span className="text-white">{formatTablePrice(breakdown.basePrice)}</span>
                      </div>
                      
                      <div className="flex justify-between text-xs text-[#6b6b7b]">
                        <span>Apple fee (30%)</span>
                        <span>-</span>
                      </div>
                      
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>GST (18%)</span>
                        <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.nonIos.gst, "plus")}</span>
                      </div>
                      
                      <div className="border-t border-[#2a2a35]/60 my-1 pt-1.5 flex justify-between text-xs font-semibold text-white">
                        <span>Customer pays</span>
                        <span>{formatTablePrice(breakdown.nonIos.customerPays)}</span>
                      </div>
                      
                      {/* Distribution */}
                      <div className="pt-2">
                        <div className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-semibold mb-2">DISTRIBUTION</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Government (GST)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.govGst)}</span>
                          </div>
                          
                          {/* Empty spacer to align vertically with iOS (since Apple distribution row doesn't exist for non-iOS) */}
                          <div className="h-[16px] w-full" />
                          
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Platform (5%)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.platformFee)}</span>
                          </div>
                          {breakdown.affPercent > 0 && (
                            <div className="flex justify-between text-xs text-[#9fa0b8]">
                              <span>→ Affiliate ({breakdown.affPercent}%)</span>
                              <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.affiliateCut)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="border-t border-[#2a2a35]/60 mt-2 pt-2 flex justify-between text-xs font-bold">
                        <span className="text-brand">You receive</span>
                        <span className="text-brand">{formatTablePrice(breakdown.nonIos.youReceive)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}

        {/* Subscribers Modal */}
        {showSubscribersModal && selectedChannel && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-4 sm:p-6 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                    {selectedChannel.title}
                  </h2>
                  <p className="text-[#9fa0b8] text-xs sm:text-sm">
                    {subscribers.length} subscriber
                    {subscribers.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowSubscribersModal(false);
                    setSelectedChannel(null);
                    setSubscribers([]);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-[#1a1a22] rounded-full transition-colors ml-2"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingSubscribers ? (
                  <div className="flex items-center justify-center py-8 sm:py-12">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-brand" />
                  </div>
                ) : subscribers.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <Users className="w-10 h-10 sm:w-12 sm:h-12 text-[#2a2a35] mx-auto mb-3 sm:mb-4" />
                    <p className="text-[#9fa0b8] text-sm sm:text-base">No subscribers yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {subscribers.filter((sub) => sub.user).map((sub, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-[#1a1a22] rounded-lg"
                      >
                        {sub.user.profilePicture ? (
                          <img
                            src={sub.user.profilePicture}
                            alt={sub.user.name || sub.user.email}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2a2a35] flex items-center justify-center text-brand font-semibold text-sm sm:text-base shrink-0">
                            {(sub.user.name || sub.user.email || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate text-sm sm:text-base">
                            {sub.user.name || sub.user.email}
                          </p>
                          <p className="text-[#9fa0b8] text-xs sm:text-sm truncate">
                            {sub.user.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Can Post toggle (founder only) */}
                          {isFounderMode && (
                            <button
                              onClick={async () => {
                                if (!orgId || !selectedChannel) return;
                                const newCanPost = !sub.canPost;
                                // Optimistic update
                                setSubscribers((prev) =>
                                  prev.map((s, i) =>
                                    i === index ? { ...s, canPost: newCanPost } : s
                                  )
                                );
                                try {
                                  await toggleMemberPosting(
                                    selectedChannel._id,
                                    sub.user._id,
                                    orgId,
                                    newCanPost
                                  );
                                  toast.success(
                                    newCanPost
                                      ? `${sub.user.name || sub.user.email} can now post`
                                      : `${sub.user.name || sub.user.email} has been muted`
                                  );
                                } catch (err) {
                                  // Revert optimistic update
                                  setSubscribers((prev) =>
                                    prev.map((s, i) =>
                                      i === index ? { ...s, canPost: !newCanPost } : s
                                    )
                                  );
                                  toast.error("Failed to update posting permission");
                                }
                              }}
                              className={`px-2 py-1 text-[10px] sm:text-xs rounded-full font-medium transition-colors ${
                                sub.canPost !== false
                                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              }`}
                              title={sub.canPost !== false ? "Click to mute" : "Click to unmute"}
                            >
                              {sub.canPost !== false ? "Can Post" : "Muted"}
                            </button>
                          )}
                          <div className="text-right">
                            <span
                              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full ${sub.status === "active"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                                }`}
                            >
                              {sub.status}
                            </span>
                            <p className="text-[#9fa0b8] text-[10px] sm:text-xs mt-1">
                              {new Date(sub.joinedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Post-purchase thank-you page editor drawer (edit mode only).
            Mounted at the page level so it lives outside the modal's
            transform context — otherwise the fixed-positioned drawer
            wouldn't cover the whole viewport. Renders nothing until
            `thankYouOpen`, so mounting is free. */}
        <ProductThankYouPageEditor
          item={
            selectedChannel
              ? ({ ...selectedChannel, thankYouPage: thankYouSnapshot } as any)
              : null
          }
          itemType="channel"
          open={thankYouOpen && !!selectedChannel}
          onClose={() => setThankYouOpen(false)}
          onSaved={(updated) => {
            const ch = updated as Channel;
            setThankYouSnapshot(ch.thankYouPage);
            // Keep the currently-open modal's Channel in sync so the
            // badge updates without a refetch. Also patch the list
            // cache so a close-and-reopen keeps the fresh value.
            setSelectedChannel((prev) =>
              prev && prev._id === ch._id
                ? { ...prev, thankYouPage: ch.thankYouPage }
                : prev,
            );
            setChannels((prev) =>
              prev.map((c) =>
                c._id === ch._id
                  ? ({ ...c, thankYouPage: ch.thankYouPage } as Channel)
                  : c,
              ),
            );
          }}
        />
      </div>
    </div>
  );
}
