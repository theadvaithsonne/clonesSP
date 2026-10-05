"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Search,
  ShoppingBag,
  BookOpen,
  Video,
  Tv,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  User,
  Calendar,
  MapPin,
  Clock,
  TrendingUp,
  CreditCard,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  RefreshCw,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Wallet,
  FileText,
  IndianRupee,
  Smartphone,
  Banknote,
  Sparkles,
  Briefcase,
  Phone,
  Zap,
  Link2,
  Loader2,
  XCircle,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { subscribeStandalone } from "@/lib/webinar/garage-store-plans";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { unsubscribeFromChannel } from "@/lib/feed-api";
import { getPageCache, setPageCache } from "@/lib/revenue-network-cache";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// Types matching the backend unified orders API
type UnifiedOrderType = "product" | "course" | "workshop" | "channel" | "service" | "call";

// Office subscription interface
interface OfficeSubscription {
  _id: string;
  orgId: string;
  founderId: string;
  planId: {
    _id: string;
    name: string;
    slug: string;
    amount: number;
    period: string;
    features?: string[];
    canInviteStakeholders?: boolean;
  } | null;
  status: string;
  razorpaySubscriptionId: string;
  currentStart?: string;
  currentEnd?: string;
  chargeAt?: string;
  paidCount: number;
  createdAt: string;
  startedAt?: string;
  paymentMethod?: string;
}

// Office subscription payment interface
interface OfficePayment {
  _id: string;
  paymentNumber: number;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  paidAt: string;
  razorpayPaymentId: string;
  razorpayInvoiceId?: string;
  invoiceShortUrl?: string;
  razorpayOrderId?: string;
  fee?: number;
  tax?: number;
  vpa?: string;
  bank?: string;
  wallet?: string;
}

// Office addon subscription interface
interface OfficeAddonSubscription {
  _id: string;
  orgId: string;
  founderId: string;
  addonId: {
    _id: string;
    name: string;
    slug: string;
    amount: number;
    taxAmount: number;
    totalAmount: number;
    period: string;
    features?: string[];
  } | null;
  status: string;
  razorpaySubscriptionId: string;
  currentStart?: string;
  currentEnd?: string;
  chargeAt?: string;
  paidCount: number;
  createdAt: string;
  startedAt?: string;
  paymentMethod?: string;
}

// Office addon payment interface
interface OfficeAddonPayment {
  _id: string;
  paymentNumber: number;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  paidAt: string;
  razorpayPaymentId: string;
  razorpayInvoiceId?: string;
  invoiceShortUrl?: string;
  razorpayOrderId?: string;
  fee?: number;
  tax?: number;
  vpa?: string;
  bank?: string;
  wallet?: string;
  addonId?: {
    _id: string;
    name: string;
    slug: string;
  } | null;
}

interface UnifiedOrderItem {
  _id: string;
  orderNumber: string;
  type: UnifiedOrderType;
  itemName: string;
  itemImage?: string;
  amount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  invoiceShortUrl?: string;
  customer: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  } | null;
  metadata: {
    // Product specific
    quantity?: number;
    isDigital?: boolean;
    requiresShipping?: boolean;
    trackingNumber?: string;
    trackingUrl?: string;
    digitalAssets?: Array<{ name: string; url: string; type: string }>;
    digitalLinks?: Array<{ label: string; url: string; description?: string }>;
    fulfillmentStatus?: string;
    shippingAddress?: {
      fullName: string;
      addressLine1: string;
      city: string;
      state: string;
      country: string;
    };
    // Course specific
    progressPercentage?: number;
    completedChapters?: number;
    totalChapters?: number;
    enrollmentStatus?: string;
    // Workshop specific
    eventDate?: string;
    eventTime?: string;
    timezone?: string;
    meetingUrl?: string;
    attendanceStatus?: string;
    isRecurring?: boolean;
    // Channel/Subscription specific
    subscriptionStatus?: string;
    currentPeriodEnd?: string;
    nextBillingDate?: string;
    billingCycle?: string;
    // Service specific
    serviceStatus?: string;
    completedMilestones?: number;
    totalMilestones?: number;
    amountPaid?: number;
    amountPending?: number;
    paymentTiming?: string;
    // Call specific
    quantityPurchased?: number;
    quantityUsed?: number;
    quantityRemaining?: number;
    quantityScheduled?: number;
    callDuration?: number;
    nextBookingDate?: string;
  };
}

interface OrderCounts {
  all: number;
  product: number;
  course: number;
  workshop: number;
  channel: number;
  service: number;
  call: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const ORDER_TYPES: {
  value: UnifiedOrderType | "all" | "garage_subs" | "unilevel_plus" | "invoices";
  label: string;
  icon: React.ReactNode;
}[] = [
    // SUSPENDED (2026-07-06): every tab except "Invoices" is temporarily
    // hidden. The tab-content branches (activeType === "garage_subs" | ...)
    // remain in place so the direct `<OrdersPage initialType="channel"
    // hideTabs />`-style callers from the dashboard layout keep working;
    // only the tab bar itself is trimmed. Uncomment individual entries to
    // bring them back one by one.
    // { value: "all", label: "All Orders", icon: <Package className="h-4 w-4" /> },
    // {
    //   value: "product",
    //   label: "Products",
    //   icon: <ShoppingBag className="h-4 w-4" />,
    // },
    // { value: "course", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
    // {
    //   value: "workshop",
    //   label: "Workshops",
    //   icon: <Video className="h-4 w-4" />,
    // },
    // { value: "channel", label: "Channels", icon: <Tv className="h-4 w-4" /> },
    // {
    //   value: "service",
    //   label: "Services",
    //   icon: <Briefcase className="h-4 w-4" />,
    // },
    // {
    //   value: "call",
    //   label: "Calls",
    //   icon: <Phone className="h-4 w-4" />,
    // },
    // {
    //   value: "garage_subs",
    //   label: "Garage Subs",
    //   icon: <Building2 className="h-4 w-4" />,
    // },
    // {
    //   value: "unilevel_plus",
    //   label: "Unilevel Plus",
    //   icon: <Zap className="h-4 w-4" />,
    // },
    {
      value: "invoices",
      label: "Invoices",
      icon: <Receipt className="h-4 w-4" />,
    },
  ];

export function OrdersPage({
  // Default landed on "all" when every tab existed; with the tab-bar
  // trimmed to just Invoices on 2026-07-06 (see ORDER_TYPES above), land
  // there instead so the top-level `<OrdersPage />` from the dashboard
  // layout doesn't render blank empty state for a tab that no longer
  // has a chip. Direct callers that pass `initialType` are unaffected.
  initialType = "invoices",
  hideTabs = false,
  // Which invoice sub-tab to land on. Set by the GaragePay sidebar dropdown,
  // which picks One-time / Recurring before this panel mounts — a
  // `garagepay:set-tab` event fired at click time would arrive before the
  // listener below is attached, so the choice comes in as a prop instead.
  initialInvoiceTab = "one_time",
}: {
  initialType?: UnifiedOrderType | "all" | "garage_subs" | "unilevel_plus" | "invoices";
  hideTabs?: boolean;
  initialInvoiceTab?: "one_time" | "recurring";
} = {}) {
  const { amIFounder } = useAmIFounder();
  const [orders, setOrders] = useState<UnifiedOrderItem[]>([]);
  const [counts, setCounts] = useState<OrderCounts>({
    all: 0,
    product: 0,
    course: 0,
    workshop: 0,
    channel: 0,
    service: 0,
    call: 0,
  });
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeType, setActiveType] = useState<
    UnifiedOrderType | "all" | "garage_subs" | "unilevel_plus" | "invoices"
  >(initialType);
  const [garageSubscription, setGarageSubscription] =
    useState<OfficeSubscription | null>(null);
  const [garagePayments, setGaragePayments] = useState<OfficePayment[]>([]);
  const [garageSubLoading, setGarageSubLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  // Add-on subscription state
  const [addonSubscriptions, setAddonSubscriptions] = useState<
    OfficeAddonSubscription[]
  >([]);
  const [addonPayments, setAddonPayments] = useState<OfficeAddonPayment[]>([]);
  const [addonLoading, setAddonLoading] = useState(false);
  const [statusFilter] = useState<string>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  // Invoice state
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [upcomingInvoices, setUpcomingInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [cancellingInvoiceId, setCancellingInvoiceId] = useState<string | null>(null);
  const [invoiceTab, setInvoiceTab] = useState<"one_time" | "recurring">(initialInvoiceTab);

  // UPI autopay (Razorpay mandate). Account-level, not per-subscription: one
  // mandate covers every recurring invoice this user owes.
  const [autopay, setAutopay] = useState<{
    enabled: boolean;
    mandateStatus: string | null;
    vpa: string | null;
    maxAmount: number | null;
    mandateExpiresAt: string | null;
    reason: string | null;
  } | null>(null);
  const [autopayBusy, setAutopayBusy] = useState(false);

  /**
   * Third-party (NetworkChain) subscriptions, keyed by their parent invoice.
   * Carries the current term, the selectable terms with prices, and whether a
   * change is allowed — everything the plan switcher needs. The API existed
   * long before this UI did; nothing called it.
   */
  const [tpSubs, setTpSubs] = useState<any[]>([]);
  const [termBusy, setTermBusy] = useState<string | null>(null);
  const [confirmTermChange, setConfirmTermChange] = useState<{
    parentInvoiceId: string;
    fromMonths: number;
    toMonths: number;
    label: string;
    amount: number;
    clientId: string;
    clientName?: string;
    /** change: paid + running, queue for next cycle. reissue: first invoice
     *  never paid, backend replaces it. resubscribe: cancelled/lapsed, start a
     *  fresh subscription via the standalone checkout. */
    mode: "change" | "reissue" | "resubscribe";
  } | null>(null);
  const [confirmDisableAutopay, setConfirmDisableAutopay] = useState(false);
  const [renewingSubId, setRenewingSubId] = useState<string | null>(null);
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [cancellingSubId, setCancellingSubId] = useState<string | null>(null);
  const [confirmCancelInvoice, setConfirmCancelInvoice] = useState<{ _id: string; invoiceNumber?: string; itemName?: string } | null>(null);
  // itemType + itemId let executeCancelSubscription route channel subs
  // through the unified /feed/channels/:id/subscribe DELETE (which also
  // updates ChannelMembership) instead of the invoice-only endpoint.
  const [confirmCancelSub, setConfirmCancelSub] = useState<{
    parentId: string;
    itemName: string;
    nextDueDate?: string;
    itemType?: string;
    itemId?: string;
    orgId?: string;
    // Parent invoice status. "pending"/"draft" = never activated, we
    // cancel the invoice itself; anything else = active paid subscription,
    // cancels at end of the billing period.
    parentStatus?: string;
  } | null>(null);

  // Unilevel Plus purchase state
  const [upPurchase, setUpPurchase] = useState<{
    plan: {
      _id: string;
      name: string;
      description?: string;
      productPrice: number;
      currency: string;
    } | null;
    purchased: boolean;
    purchase: {
      _id: string;
      paymentId: string;
      amount: number;
      currency: string;
      status: string;
      purchasedAt: string;
    } | null;
  } | null>(null);
  const [upLoading, setUpLoading] = useState(false);

  // Fetch Unilevel Plus purchase
  const fetchUPPurchase = async () => {
    setUpLoading(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/unilevel-plus/product`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch UP product");
      const data = await response.json();
      setUpPurchase({
        plan: data.plan,
        purchased: data.purchased,
        purchase: data.purchase,
      });
    } catch (err) {
      console.error("Error fetching UP purchase:", err);
    } finally {
      setUpLoading(false);
    }
  };

  // Fetch garage subscription and payments
  const fetchGarageSubscription = async () => {
    setGarageSubLoading(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      // Get orgId from localStorage
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setGarageSubLoading(false);
        return;
      }

      const response = await fetch(
        `${apiUrl}/office-subscription/status?orgId=${orgId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch subscription");
      }

      const data = await response.json();
      setGarageSubscription(data.subscription);

      // Fetch payments if subscription exists
      if (data.subscription) {
        fetchGaragePayments(orgId);
      }
    } catch (err) {
      console.error("Error fetching garage subscription:", err);
    } finally {
      setGarageSubLoading(false);
    }
  };

  // Fetch garage payments
  const fetchGaragePayments = async (orgId: string) => {
    setPaymentsLoading(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await fetch(
        `${apiUrl}/office-subscription/payments?orgId=${orgId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch payments");
      }

      const data = await response.json();
      setGaragePayments(data.payments || []);
    } catch (err) {
      console.error("Error fetching garage payments:", err);
    } finally {
      setPaymentsLoading(false);
    }
  };

  // Fetch addon subscriptions
  const fetchAddonSubscriptions = async (orgId: string) => {
    setAddonLoading(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await fetch(
        `${apiUrl}/office-addon-subscription/status?orgId=${orgId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch addon subscriptions");
      }

      const data = await response.json();
      setAddonSubscriptions(data.subscriptions || []);

      // Fetch addon payments
      fetchAddonPayments(orgId);
    } catch (err) {
      console.error("Error fetching addon subscriptions:", err);
    } finally {
      setAddonLoading(false);
    }
  };

  // Fetch addon payments
  const fetchAddonPayments = async (orgId: string) => {
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await fetch(
        `${apiUrl}/office-addon-subscription/payments?orgId=${orgId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch addon payments");
      }

      const data = await response.json();
      setAddonPayments(data.payments || []);
    } catch (err) {
      console.error("Error fetching addon payments:", err);
    }
  };

  // Fetch invoices (upcoming + history)
  const fetchInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const limit = 20;
      const skip = (currentPage - 1) * limit;

      // Fetch upcoming and paid invoices in parallel
      const [upcomingRes, listRes] = await Promise.all([
        fetch(`${apiUrl}/api/invoices/my/upcoming`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/invoices/my/list?limit=${limit}&skip=${skip}&invoiceType=${invoiceTab}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (upcomingRes.ok) {
        const upcomingData = await upcomingRes.json();
        setUpcomingInvoices(upcomingData.invoices || []);
      }

      if (listRes.ok) {
        const listData = await listRes.json();
        setInvoicesList(listData.invoices || []);
        setInvoicesTotal(listData.total || 0);

        // Update pagination for the invoices tab
        const totalPages = Math.ceil((listData.total || 0) / limit);
        setPagination({
          page: currentPage,
          limit,
          total: listData.total || 0,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1,
        });
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Handle paying an upcoming/pending invoice — opens standalone page in new tab
  // Accepts the invoice object (or just an ID for upcoming projections)
  const handlePayInvoice = (inv: { _id: string; invoiceNumber?: string }) => {
    // For upcoming (projected) invoices, the ID starts with "upcoming_"
    if (inv._id.startsWith("upcoming_")) {
      toast.info("This invoice will be auto-charged by your subscription. No action needed yet.");
      return;
    }

    // Prefer the human-readable invoice number; fall back to _id
    const urlId = inv.invoiceNumber || inv._id;
    setPayingInvoiceId(inv._id);
    window.open(`/invoice/${urlId}`, "_blank");
    // Reset the loading indicator after a short delay
    setTimeout(() => setPayingInvoiceId(null), 500);
  };

  // ── UPI autopay ───────────────────────────────────────────────────────
  //
  // The distinction this UI has to make unmissable: turning autopay OFF is
  // NOT cancelling. Invoices keep being issued on the same schedule and the
  // user pays each one by hand — exactly how collection worked before
  // autopay existed. Access is untouched. Cancelling the subscription is a
  // separate, destructive action with its own button and its own dialog.
  const fetchThirdPartySubs = async () => {
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/api/third-party/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // non-fatal — the plan switcher just won't render
      const data = await res.json();
      if (data?.success) setTpSubs(data.subscriptions || []);
    } catch {
      // Decoration on top of the invoice list; never blank the page for it.
    }
  };

  /**
   * Switch the billing term.
   *
   * Changing the term invalidates the UPI mandate: its ceiling is sized to the
   * plan the payer authorised, so a monthly mandate cannot fund a quarterly
   * debit — it would bounce off its own cap every cycle. The backend cancels
   * the old mandate at NPCI and the next payment registers one at the new
   * amount, which is why the confirm dialog warns about a single hand-paid
   * cycle rather than pretending the switch is invisible.
   */
  const executeTermChange = async () => {
    if (!confirmTermChange || termBusy) return;
    const { parentInvoiceId, toMonths } = confirmTermChange;
    setTermBusy(parentInvoiceId);

    // Cancelled or lapsed: there is no chain to change, so this is a brand-new
    // subscription through the same checkout the store uses. The backend
    // refuses it only if a live subscription already exists.
    if (confirmTermChange.mode === "resubscribe") {
      try {
        const res = await subscribeStandalone({
          thirdPartyClientId: confirmTermChange.clientId,
          termMonths: toMonths,
        });
        toast.success(
          `Invoice issued for ${confirmTermChange.label} — pay it to reactivate your subscription.`,
        );
        setConfirmTermChange(null);
        window.location.href = `/invoice/${res.invoice._id}`;
      } catch (e: any) {
        toast.error(e?.message || "Couldn't start the subscription");
      } finally {
        setTermBusy(null);
      }
      return;
    }

    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(
        `${apiUrl}/api/third-party/subscriptions/${parentInvoiceId}/term`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ termMonths: toMonths }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || data?.message || "Couldn't change the plan");
        return;
      }
      // The root was never paid, so the backend cancelled it and minted a
      // fresh first-cycle invoice at the chosen term. Nothing is queued —
      // the user has to PAY this one, so take them straight to it.
      if (data.status === "reissued" && data.invoice?.id) {
        toast.success(
          `New invoice issued for ${confirmTermChange.label} — pay it to start your subscription.`,
        );
        setConfirmTermChange(null);
        window.location.href = `/invoice/${data.invoice.id}`;
        return;
      }
      const when = data.effectiveFrom
        ? new Date(data.effectiveFrom).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null;
      toast.success(
        data.status === "noop"
          ? "You're already on that plan"
          : `Plan changes${when ? ` on ${when}` : ""}. Autopay was switched off — turn it back on to set up the new amount.`,
      );
      fetchInvoices();
      fetchAutopay();
      fetchThirdPartySubs();
    } catch {
      toast.error("Couldn't change the plan");
    } finally {
      setTermBusy(null);
      setConfirmTermChange(null);
    }
  };

  const fetchAutopay = async () => {
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/api/invoices/autopay/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // non-fatal: the page works fine without it
      const data = await res.json();
      if (data?.success) setAutopay(data.autopay ?? null);
    } catch {
      // Autopay state is decoration on top of the invoice list — never let a
      // failure here blank out the orders page.
    }
  };

  const executeDisableAutopay = async () => {
    if (autopayBusy) return;
    setAutopayBusy(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/api/invoices/autopay/disable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        toast.success(
          data.alreadyOff
            ? "Autopay was already off"
            : "Autopay turned off. You'll keep getting invoices — pay each one manually.",
        );
        setAutopay(data.autopay ?? null);
        fetchInvoices();
      } else {
        toast.error(data.error || "Failed to turn off autopay");
      }
    } catch {
      toast.error("Failed to turn off autopay");
    } finally {
      setAutopayBusy(false);
      setConfirmDisableAutopay(false);
    }
  };

  // Turning autopay back on — also the "resubscribe" path after Razorpay
  // stops retrying a dead mandate. There is no authorise-without-paying on
  // UPI: a mandate only ever comes into existence as a side effect of a real
  // payment. So the backend hands back the invoice to settle, and paying it
  // by UPI attaches the new mandate.
  const handleEnableAutopay = async (parentId: string) => {
    if (autopayBusy) return;
    setAutopayBusy(true);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/api/invoices/${parentId}/autopay/enable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data.error || "Couldn't turn autopay back on");
        return;
      }
      if (data.autopay) setAutopay(data.autopay);
      if (data.alreadyOn) {
        toast.success(data.message || "Autopay is already active");
        return;
      }
      if (data.invoice) {
        // Send them to the invoice — paying it by UPI is what mints the mandate.
        toast.success(data.message || "Pay this invoice by UPI to switch autopay on");
        handlePayInvoice(data.invoice);
      } else {
        toast.success(data.message || "Autopay will be set up on your next UPI renewal");
      }
      fetchInvoices();
    } catch {
      toast.error("Couldn't turn autopay back on");
    } finally {
      setAutopayBusy(false);
    }
  };

  // Reactivate a cancelled subscription in place (same parent invoice, no new
  // subscription). `covered` = the paid period still covers today, so there is
  // nothing to pay now; otherwise the returned child is payable immediately.
  const handleRenewSubscription = async (parentId: string) => {
    if (renewingSubId) return;
    setRenewingSubId(parentId);
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/api/invoices/${parentId}/renew-subscription`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data.error || "Failed to resubscribe");
        return;
      }
      if (data.covered) {
        toast.success("Subscription resumed — you're already paid up for this period.");
      } else if (data.invoice) {
        toast.success("Subscription resumed — pay the invoice to reactivate.");
        handlePayInvoice(data.invoice);
      } else {
        toast.success("Subscription resumed");
      }
      fetchInvoices();
      fetchAutopay();
    } catch {
      toast.error("Failed to resubscribe");
    } finally {
      setRenewingSubId(null);
    }
  };

  // Cancel a one-time pending/draft invoice (called after confirm dialog)
  const executeCancelInvoice = async (invoiceId: string) => {
    if (cancellingInvoiceId) return;
    setCancellingInvoiceId(invoiceId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/api/invoices/${invoiceId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast.success("Invoice cancelled");
        fetchInvoices();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to cancel invoice");
      }
    } catch {
      toast.error("Failed to cancel invoice");
    } finally {
      setCancellingInvoiceId(null);
      setConfirmCancelInvoice(null);
    }
  };

  // Cancel a recurring subscription (called after confirm dialog).
  //
  // Channel subs route through the unified DELETE /feed/channels/:id/
  // subscribe endpoint so the ChannelMembership row is also updated
  // (subscriptionStatus: "cancelled", etc.); the sweeper will then flip
  // it to inactive at nextPaymentDate. Non-channel subs (office plans,
  // Unilevel Plus, third-party) fall back to the invoice-only endpoint
  // which just stamps parent.cancelledAt and cancels draft children.
  const executeCancelSubscription = async () => {
    if (!confirmCancelSub) return;
    const { parentId, itemType, itemId, orgId, parentStatus } = confirmCancelSub;
    if (cancellingSubId) return;
    setCancellingSubId(parentId);
    try {
      // Pending / draft parent — the subscription was never activated
      // (no cycle ever ran, no ChannelMembership was created). Cancel the
      // invoice itself via the plain invoice-cancel endpoint, which
      // already accepts pending/draft. Avoids routing through
      // cancel-subscription (which was throwing "Subscription is not active"
      // for this case) or unsubscribeFromChannel (which just returns
      // already_inactive because there's no membership row yet).
      if (parentStatus === "pending" || parentStatus === "draft") {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${apiUrl}/api/invoices/${parentId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          toast.success("Subscription cancelled");
          fetchInvoices();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to cancel subscription");
        }
      } else if (itemType === "channel" && itemId && orgId) {
        const result = await unsubscribeFromChannel(itemId, orgId);
        if (result.status === "cancelling_at_cycle_end") {
          const untilLabel = result.accessUntil
            ? new Date(result.accessUntil).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "the end of your current cycle";
          toast.success(`Subscription will end on ${untilLabel}. You'll keep access until then.`);
        } else if (result.status === "cancelled_immediately") {
          toast.success("You've left the community");
        } else {
          toast.success("Subscription was already cancelled");
        }
        fetchInvoices();
      } else {
        // Non-channel subs — legacy invoice-cancel path stays.
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${apiUrl}/api/invoices/${parentId}/cancel-subscription`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (res.ok) {
          toast.success("Subscription will cancel at end of billing period");
          fetchInvoices();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to cancel subscription");
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel subscription");
    } finally {
      setCancellingSubId(null);
      setConfirmCancelSub(null);
    }
  };

  // Listen for navigate:invoices event from sidebar banner
  useEffect(() => {
    const handleNavigateInvoices = () => {
      setActiveType("invoices");
    };
    window.addEventListener("navigate:invoices", handleNavigateInvoices);
    return () => {
      window.removeEventListener("navigate:invoices", handleNavigateInvoices);
    };
  }, []);

  // Sync activeType when initialType prop changes
  useEffect(() => {
    setActiveType(initialType);
    setCurrentPage(1);
  }, [initialType]);

  // Sync invoiceTab when the caller switches the requested tab on an already
  // mounted panel (sidebar dropdown / bottom nav re-click).
  useEffect(() => {
    setInvoiceTab(initialInvoiceTab);
  }, [initialInvoiceTab]);

  // Sync invoiceTab when custom tab events are triggered from bottom navigation
  useEffect(() => {
    const handleSetTab = (e: Event) => {
      const customEvent = e as CustomEvent<"one_time" | "recurring">;
      if (customEvent.detail === "one_time" || customEvent.detail === "recurring") {
        setInvoiceTab(customEvent.detail);
      }
    };
    window.addEventListener("garagepay:set-tab", handleSetTab);
    return () => {
      window.removeEventListener("garagepay:set-tab", handleSetTab);
    };
  }, []);

  // Reset page when switching invoice sub-tabs
  useEffect(() => {
    setCurrentPage(1);
  }, [invoiceTab]);

  // Fetch orders
  useEffect(() => {
    // If garage_subs tab is active, fetch subscription and addons
    if (activeType === "garage_subs") {
      setPagination(null);
      fetchGarageSubscription();
      const orgId = localStorage.getItem("garage_org_id");
      if (orgId) {
        fetchAddonSubscriptions(orgId);
      }
      return;
    }

    // If unilevel_plus tab is active, fetch UP purchase
    if (activeType === "unilevel_plus") {
      setPagination(null);
      fetchUPPurchase();
      return;
    }

    // If invoices tab is active, fetch invoices
    if (activeType === "invoices") {
      fetchInvoices();
      fetchAutopay();
      fetchThirdPartySubs();
      return;
    }

    const fetchOrders = async () => {
      const cacheKey = `orders:${activeType}:${currentPage}:${statusFilter}:${searchQuery}`;
      const cached = getPageCache<{ orders: typeof orders; counts: typeof counts; pagination: typeof pagination }>(cacheKey);
      if (cached) {
        setOrders(cached.orders);
        setCounts(cached.counts);
        setPagination(cached.pagination);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        const params = new URLSearchParams();
        params.append("page", currentPage.toString());
        params.append("limit", "20");
        if (activeType !== "all") params.append("type", activeType);
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (searchQuery) params.append("search", searchQuery);

        const response = await fetch(
          `${apiUrl}/unified-orders?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch orders");
        }

        const data = await response.json();
        setOrders(data.orders);
        setCounts(data.counts);
        setPagination(data.pagination);
        setPageCache(cacheKey, { orders: data.orders, counts: data.counts, pagination: data.pagination });
      } catch (err) {
        console.error("Error fetching orders:", err);
        if (!cached) toast.error("Failed to load orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentPage, activeType, statusFilter, invoiceTab]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!searchQuery && currentPage === 1) return;

      const cacheKey = `orders:${activeType}:1:${statusFilter}:${searchQuery}`;
      const cached = getPageCache<{ orders: typeof orders; counts: typeof counts; pagination: typeof pagination }>(cacheKey);
      if (cached) {
        setOrders(cached.orders);
        setCounts(cached.counts);
        setPagination(cached.pagination);
        setCurrentPage(1);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        const params = new URLSearchParams();
        params.append("page", "1");
        params.append("limit", "20");
        if (activeType !== "all") params.append("type", activeType);
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (searchQuery) params.append("search", searchQuery);

        const response = await fetch(
          `${apiUrl}/unified-orders?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch orders");

        const data = await response.json();
        setOrders(data.orders);
        setCounts(data.counts);
        setPagination(data.pagination);
        setCurrentPage(1);
        setPageCache(cacheKey, { orders: data.orders, counts: data.counts, pagination: data.pagination });
      } catch (err) {
        console.error("Error searching orders:", err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const formatPrice = (amount: number, currency = "USD") => {
    if (amount === 0) return "FREE";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Given a `nextDueDate` (the date the NEXT cycle would fire) and a
  // recurring period, back off one period to get THIS cycle's own due
  // date. BE's cascade stores each child's `nextDueDate` as its
  // successor's due (see services/invoice.ts:3213), so a pending child
  // has no direct field pointing to when IT is owed — we compute it.
  // Falls back to null on unknown period / malformed date, letting the
  // caller pick the legacy `createdAt` fallback.
  const subOnePeriod = (
    iso: string,
    period: string | null | undefined,
  ): Date | null => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    switch (period) {
      case "weekly":
        d.setDate(d.getDate() - 7);
        break;
      case "monthly":
        d.setMonth(d.getMonth() - 1);
        break;
      case "quarterly":
        d.setMonth(d.getMonth() - 3);
        break;
      case "yearly":
        d.setFullYear(d.getFullYear() - 1);
        break;
      default:
        return null;
    }
    return d;
  };

  const formatDateTime = (dateString: string, timeString?: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    if (timeString) {
      return `${dateStr} at ${timeString}`;
    }
    return dateStr;
  };

  const getTypeIcon = (type: UnifiedOrderType) => {
    const typeConfig = ORDER_TYPES.find((t) => t.value === type);
    return typeConfig?.icon || <Package className="h-4 w-4" />;
  };

  const getStatusBadge = (paymentStatus: string) => {
    // Normalize status for display
    const statusMap: Record<string, string> = {
      completed: "paid",
      paid: "paid",
      active: "paid",
      failed: "failed",
      refunded: "refunded",
      cancelled: "cancelled",
      pending: "pending",
    };
    const displayStatus = statusMap[paymentStatus] || "pending";

    const statusStyles: Record<string, string> = {
      paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      failed: "bg-red-500/10 text-red-400 border-red-500/20",
      refunded: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    };

    const dotStyles: Record<string, string> = {
      paid: "bg-emerald-400",
      pending: "bg-amber-400",
      failed: "bg-red-400",
      refunded: "bg-purple-400",
      cancelled: "bg-zinc-400",
    };

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
          statusStyles[displayStatus] || statusStyles.pending
        )}
      >
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            dotStyles[displayStatus] || "bg-amber-400"
          )}
        />
        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
      </span>
    );
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sortedOrders = [...orders].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (key) {
        case "date":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "amount":
          aValue = a.amount;
          bValue = b.amount;
          break;
        case "type":
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setOrders(sortedOrders);
  };

  const renderExpandedContent = (order: UnifiedOrderItem) => {
    const { metadata, type } = order;

    return (
      <div className="px-6 py-4 bg-[#0a0a0c] border-t border-[#1a1a22]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Customer Info */}
          {order.customer && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                Customer
              </h4>
              <div className="flex items-center gap-3">
                {order.customer.profilePicture ? (
                  <img
                    src={order.customer.profilePicture}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#1a1a22] flex items-center justify-center">
                    <User className="w-4 h-4 text-[#6b6b80]" />
                  </div>
                )}
                <div>
                  <p className="text-sm text-white font-medium">
                    {order.customer.name}
                  </p>
                  <p className="text-xs text-[#6b6b80]">
                    {order.customer.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Type-specific details */}
          {type === "product" && (
            <>
              {metadata.requiresShipping && metadata.shippingAddress && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                    Shipping
                  </h4>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#6b6b80] mt-0.5" />
                    <div className="text-sm text-[#9fa0b8]">
                      <p>{metadata.shippingAddress.fullName}</p>
                      <p>{metadata.shippingAddress.addressLine1}</p>
                      <p>
                        {metadata.shippingAddress.city},{" "}
                        {metadata.shippingAddress.state}
                      </p>
                    </div>
                  </div>
                  {metadata.trackingNumber && (
                    <div className="mt-2">
                      <span className="text-xs text-[#6b6b80]">Tracking: </span>
                      <span className="text-xs text-brand font-mono">
                        {metadata.trackingNumber}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {metadata.isDigital &&
                metadata.digitalAssets &&
                metadata.digitalAssets.length > 0 && (
                  <div className="space-y-2 col-span-2">
                    <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                      Digital Downloads
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {metadata.digitalAssets.map((asset, idx) => (
                        <a
                          key={idx}
                          href={asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a22] hover:bg-[#252530] rounded-lg text-sm text-white transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-brand" />
                          {asset.name}
                          <ExternalLink className="w-3 h-3 text-[#6b6b80]" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              {metadata.isDigital &&
                metadata.digitalLinks &&
                metadata.digitalLinks.length > 0 && (
                  <div className="space-y-2 col-span-2">
                    <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                      Access Links
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {metadata.digitalLinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a22] hover:bg-[#252530] rounded-lg text-sm text-white transition-colors"
                          title={link.description}
                        >
                          <Link2 className="w-3.5 h-3.5 text-purple-400" />
                          {link.label}
                          <ExternalLink className="w-3 h-3 text-[#6b6b80]" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
            </>
          )}

          {type === "course" && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                Progress
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9fa0b8]">Completed</span>
                  <span className="text-white font-medium">
                    {metadata.progressPercentage || 0}%
                  </span>
                </div>
                <div className="h-2 bg-[#1a1a22] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand to-[#f59e0b] rounded-full transition-all"
                    style={{ width: `${metadata.progressPercentage || 0}%` }}
                  />
                </div>
                <p className="text-xs text-[#6b6b80]">
                  {metadata.completedChapters || 0} of{" "}
                  {metadata.totalChapters || 0} chapters
                </p>
              </div>
            </div>
          )}

          {type === "workshop" && (
            <>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                  Event Details
                </h4>
                <div className="space-y-1.5">
                  {metadata.eventDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-[#6b6b80]" />
                      <span className="text-white">
                        {formatDateTime(metadata.eventDate, metadata.eventTime)}
                      </span>
                    </div>
                  )}
                  {metadata.timezone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-[#6b6b80]" />
                      <span className="text-[#9fa0b8]">
                        {metadata.timezone}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {metadata.meetingUrl && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                    Meeting Link
                  </h4>
                  <a
                    href={metadata.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a22] hover:bg-[#252530] rounded-lg text-sm text-white transition-colors"
                  >
                    <Video className="w-4 h-4 text-brand" />
                    Join Meeting
                    <ExternalLink className="w-3 h-3 text-[#6b6b80]" />
                  </a>
                </div>
              )}
            </>
          )}

          {type === "channel" && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                Subscription
              </h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#6b6b80]" />
                  <span className="text-[#9fa0b8]">Cycle:</span>
                  <span className="text-white capitalize">
                    {metadata.billingCycle || "Monthly"}
                  </span>
                </div>
                {metadata.nextBillingDate && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#6b6b80]" />
                    <span className="text-[#9fa0b8]">Next billing:</span>
                    <span className="text-white">
                      {formatDate(metadata.nextBillingDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {type === "service" && (
            <>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                  Progress
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#9fa0b8]">Milestones</span>
                    <span className="text-white font-medium">
                      {metadata.completedMilestones || 0} / {metadata.totalMilestones || 0}
                    </span>
                  </div>
                  <div className="h-2 bg-[#1a1a22] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand to-[#f59e0b] rounded-full transition-all"
                      style={{ width: `${metadata.progressPercentage || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#6b6b80]">
                    {metadata.progressPercentage || 0}% complete
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                  Payment
                </h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-[#6b6b80]" />
                    <span className="text-[#9fa0b8]">Paid:</span>
                    <span className="text-emerald-400 font-medium">
                      {formatPrice(metadata.amountPaid || 0, order.currency)}
                    </span>
                  </div>
                  {(metadata.amountPending || 0) > 0 && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#6b6b80]" />
                      <span className="text-[#9fa0b8]">Pending:</span>
                      <span className="text-amber-400 font-medium">
                        {formatPrice(metadata.amountPending || 0, order.currency)}
                      </span>
                    </div>
                  )}
                  {metadata.paymentTiming && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#6b6b80]" />
                      <span className="text-[#9fa0b8]">Timing:</span>
                      <span className="text-white capitalize">
                        {metadata.paymentTiming.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                  Status
                </h4>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                    metadata.serviceStatus === "completed"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : metadata.serviceStatus === "in_progress"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : metadata.serviceStatus === "cancelled"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  )}
                >
                  {metadata.serviceStatus === "in_progress" ? "In Progress" :
                    metadata.serviceStatus?.charAt(0).toUpperCase() + (metadata.serviceStatus?.slice(1) || "")}
                </span>
              </div>
            </>
          )}

          {/* Invoice Download - Show for all paid orders */}
          {order.paymentStatus === "completed" && order.invoiceShortUrl && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">
                Invoice
              </h4>
              <a
                href={order.invoiceShortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a22] hover:bg-[#252530] rounded-lg text-sm text-white transition-colors"
              >
                <FileText className="w-4 h-4 text-brand" />
                View Invoice
                <Download className="w-3 h-3 text-[#6b6b80]" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    return (
      <div className="px-4 sm:px-6 py-6 pb-28">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
          <p className="text-xs sm:text-sm text-[#8a8a9e] font-medium">
            Showing <span className="text-white font-semibold">{(pagination.page - 1) * pagination.limit + 1}</span> to{" "}
            <span className="text-white font-semibold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{" "}
            <span className="text-white font-semibold">{pagination.total}</span> orders
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              className="h-9 px-3 border-[#1a1a22] bg-[#0d0d11]/80 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] hover:border-[#2a2a35] disabled:opacity-45 disabled:pointer-events-none transition-all rounded-lg flex items-center gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <div className="flex items-center gap-1">
              {Array.from(
                { length: Math.min(5, pagination.totalPages) },
                (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  const isActive = currentPage === pageNum;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-9 h-9 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center border",
                        isActive
                          ? "bg-brand text-brand-foreground border-brand shadow-md shadow-brand/20 font-bold"
                          : "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] border-transparent hover:border-[#2a2a35]"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                }
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!pagination.hasNext}
              className="h-9 px-3 border-[#1a1a22] bg-[#0d0d11]/80 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] hover:border-[#2a2a35] disabled:opacity-45 disabled:pointer-events-none transition-all rounded-lg flex items-center gap-1.5"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">


      {/* Garage Subs Tab Content */}
      {activeType === "garage_subs" ? (
        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {garageSubLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#6b6b80]">
                  Loading subscription...
                </p>
              </div>
            </div>
          ) : garageSubscription ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Subscription Overview Card */}
              <div className="bg-gradient-to-br from-[#0e0e12] to-[#0a0a0c] rounded-2xl border border-[#1a1a22] overflow-hidden">
                {/* Header with Plan Info */}
                <div className="p-6 border-b border-[#1a1a22]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20">
                        <Building2 className="h-8 w-8 text-brand" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-white">
                            {garageSubscription.planId?.name || "Office"} Plan
                          </h3>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                              garageSubscription.status === "active" ||
                                garageSubscription.status === "authenticated"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : garageSubscription.status === "created"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : garageSubscription.status === "halted"
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                            )}
                          >
                            {garageSubscription.status === "active" ||
                              garageSubscription.status === "authenticated" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : garageSubscription.status === "halted" ? (
                              <AlertCircle className="h-3 w-3" />
                            ) : null}
                            {garageSubscription.status.charAt(0).toUpperCase() +
                              garageSubscription.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-[#6b6b80] mt-1">
                          Office Subscription • Started{" "}
                          {garageSubscription.startedAt
                            ? formatDate(garageSubscription.startedAt)
                            : formatDate(garageSubscription.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchGarageSubscription}
                      className="text-[#6b6b80] hover:text-white hover:bg-[#1a1a22]"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1a1a22]">
                  <div className="p-3 sm:p-5">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4 text-[#6b6b80]" />
                      <p className="text-[10px] sm:text-xs text-[#6b6b80] uppercase tracking-wider">
                        Plan Amount
                      </p>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {formatPrice(garageSubscription.planId?.amount || 0)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-[#6b6b80] mt-1">
                      per {garageSubscription.planId?.period || "month"}
                    </p>
                  </div>
                  <div className="p-3 sm:p-5">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <Receipt className="h-3 w-3 sm:h-4 sm:w-4 text-[#6b6b80]" />
                      <p className="text-[10px] sm:text-xs text-[#6b6b80] uppercase tracking-wider">
                        Payments Made
                      </p>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {garageSubscription.paidCount || 0}
                    </p>
                    <p className="text-[10px] sm:text-xs text-[#6b6b80] mt-1">
                      billing cycles
                    </p>
                  </div>
                  <div className="p-3 sm:p-5">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-[#6b6b80]" />
                      <p className="text-[10px] sm:text-xs text-[#6b6b80] uppercase tracking-wider">
                        Current Period
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      {garageSubscription.currentStart
                        ? formatDate(garageSubscription.currentStart)
                        : "-"}
                    </p>
                    <p className="text-[10px] sm:text-xs text-[#6b6b80] mt-1">
                      {garageSubscription.currentEnd
                        ? `to ${formatDate(garageSubscription.currentEnd)}`
                        : ""}
                    </p>
                  </div>
                  <div className="p-3 sm:p-5">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 text-[#6b6b80]" />
                      <p className="text-[10px] sm:text-xs text-[#6b6b80] uppercase tracking-wider">
                        Next Charge
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      {garageSubscription.chargeAt
                        ? formatDate(garageSubscription.chargeAt)
                        : "-"}
                    </p>
                    <p className="text-[10px] sm:text-xs text-[#6b6b80] mt-1">
                      {garageSubscription.paymentMethod
                        ? `via ${garageSubscription.paymentMethod.toUpperCase()}`
                        : ""}
                    </p>
                  </div>
                </div>

                {/* Subscription ID */}
                <div className="px-6 py-4 bg-[#0a0a0c] border-t border-[#1a1a22]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#6b6b80]" />
                      <span className="text-xs text-[#6b6b80]">
                        Subscription ID:
                      </span>
                      <code className="text-xs text-[#9fa0b8] font-mono bg-[#1a1a22] px-2 py-0.5 rounded">
                        {garageSubscription.razorpaySubscriptionId}
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="bg-[#0e0e12] rounded-2xl border border-[#1a1a22] overflow-hidden">
                <div className="p-5 border-b border-[#1a1a22]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#1a1a22]">
                        <Banknote className="h-5 w-5 text-brand" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-white">
                          Payment History
                        </h4>
                        <p className="text-xs text-[#6b6b80]">
                          {garagePayments.length} transaction
                          {garagePayments.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : garagePayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Receipt className="h-8 w-8 text-[#3a3a45] mb-3" />
                    <p className="text-sm text-[#6b6b80]">No payments yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1a1a22]">
                    {garagePayments.map((payment) => (
                      <div
                        key={payment._id}
                        className="p-4 hover:bg-[#0a0a0c] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                payment.status === "captured"
                                  ? "bg-emerald-500/10"
                                  : "bg-amber-500/10"
                              )}
                            >
                              {payment.method === "upi" ? (
                                <Smartphone className="h-5 w-5 text-emerald-400" />
                              ) : payment.method === "card" ? (
                                <CreditCard className="h-5 w-5 text-emerald-400" />
                              ) : payment.method === "wallet" ? (
                                <Wallet className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <Banknote className="h-5 w-5 text-emerald-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-white">
                                  Payment #{payment.paymentNumber}
                                </p>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                                    payment.status === "captured"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : payment.status === "authorized"
                                        ? "bg-blue-500/10 text-blue-400"
                                        : payment.status === "failed"
                                          ? "bg-red-500/10 text-red-400"
                                          : "bg-zinc-500/10 text-zinc-400"
                                  )}
                                >
                                  {payment.status === "captured" && (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  {payment.status.charAt(0).toUpperCase() +
                                    payment.status.slice(1)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-xs text-[#6b6b80]">
                                  {formatDate(payment.paidAt)}
                                </p>
                                {payment.method && (
                                  <span className="text-xs text-[#6b6b80]">
                                    • {payment.method.toUpperCase()}
                                    {payment.vpa && ` (${payment.vpa})`}
                                    {payment.bank && ` (${payment.bank})`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-base font-semibold text-white">
                                {formatPrice(payment.amount)}
                              </p>
                              {payment.fee && (
                                <p className="text-xs text-[#6b6b80]">
                                  Fee: {formatPrice(payment.fee)}
                                </p>
                              )}
                            </div>
                            {payment.invoiceShortUrl && (
                              <a
                                href={payment.invoiceShortUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-[#1a1a22] hover:bg-[#252530] text-[#6b6b80] hover:text-white transition-colors"
                                title="View Invoice"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </div>
                        {/* Payment ID */}
                        <div className="mt-3 pt-3 border-t border-[#1a1a22]/50">
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-[#6b6b80]">Payment ID:</span>
                            <code className="text-[#9fa0b8] font-mono">
                              {payment.razorpayPaymentId}
                            </code>
                            {payment.razorpayOrderId && (
                              <>
                                <span className="text-[#3a3a45]">|</span>
                                <span className="text-[#6b6b80]">Order:</span>
                                <code className="text-[#9fa0b8] font-mono">
                                  {payment.razorpayOrderId}
                                </code>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add-on Subscriptions Section */}
              {addonSubscriptions.length > 0 && (
                <div className="bg-[#0e0e12] rounded-2xl border border-[#1a1a22] overflow-hidden">
                  <div className="p-5 border-b border-[#1a1a22]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-brand/20 to-brand/5">
                          <Sparkles className="h-5 w-5 text-brand" />
                        </div>
                        <div>
                          <h4 className="text-base font-semibold text-white">
                            Add-ons
                          </h4>
                          <p className="text-xs text-[#6b6b80]">
                            {addonSubscriptions.length} add-on
                            {addonSubscriptions.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {addonLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1a1a22]">
                      {addonSubscriptions.map((addon) => (
                        <div key={addon._id} className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-[#1a1a22]">
                                <Sparkles className="h-5 w-5 text-brand" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="text-sm font-medium text-white">
                                    {addon.addonId?.name || "Add-on"}
                                  </h5>
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                                      addon.status === "active" ||
                                        addon.status === "authenticated"
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : addon.status === "created"
                                          ? "bg-amber-500/10 text-amber-400"
                                          : addon.status === "halted"
                                            ? "bg-red-500/10 text-red-400"
                                            : "bg-zinc-500/10 text-zinc-400"
                                    )}
                                  >
                                    {(addon.status === "active" ||
                                      addon.status === "authenticated") && (
                                        <CheckCircle2 className="h-3 w-3" />
                                      )}
                                    {addon.status.charAt(0).toUpperCase() +
                                      addon.status.slice(1)}
                                  </span>
                                </div>
                                <p className="text-xs text-[#6b6b80] mt-0.5">
                                  {formatPrice(
                                    addon.addonId?.totalAmount || 0
                                  )}{" "}
                                  / {addon.addonId?.period || "year"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[#6b6b80]">
                                {addon.paidCount || 0} payment
                                {addon.paidCount !== 1 ? "s" : ""}
                              </p>
                              {addon.chargeAt && (
                                <p className="text-xs text-[#6b6b80] mt-0.5">
                                  Next: {formatDate(addon.chargeAt)}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Current period */}
                          {addon.currentStart && addon.currentEnd && (
                            <div className="flex items-center gap-2 text-xs text-[#6b6b80] mb-3">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>
                                {formatDate(addon.currentStart)} -{" "}
                                {formatDate(addon.currentEnd)}
                              </span>
                            </div>
                          )}

                          {/* Subscription ID */}
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#6b6b80]">ID:</span>
                            <code className="text-[#9fa0b8] font-mono bg-[#1a1a22] px-2 py-0.5 rounded">
                              {addon.razorpaySubscriptionId}
                            </code>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Add-on Payment History */}
              {addonPayments.length > 0 && (
                <div className="bg-[#0e0e12] rounded-2xl border border-[#1a1a22] overflow-hidden">
                  <div className="p-5 border-b border-[#1a1a22]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#1a1a22]">
                        <Banknote className="h-5 w-5 text-brand" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-white">
                          Add-on Payment History
                        </h4>
                        <p className="text-xs text-[#6b6b80]">
                          {addonPayments.length} transaction
                          {addonPayments.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-[#1a1a22]">
                    {addonPayments.map((payment) => (
                      <div
                        key={payment._id}
                        className="p-4 hover:bg-[#0a0a0c] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                payment.status === "captured"
                                  ? "bg-emerald-500/10"
                                  : "bg-amber-500/10"
                              )}
                            >
                              {payment.method === "upi" ? (
                                <Smartphone className="h-5 w-5 text-emerald-400" />
                              ) : payment.method === "card" ? (
                                <CreditCard className="h-5 w-5 text-emerald-400" />
                              ) : payment.method === "wallet" ? (
                                <Wallet className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <Banknote className="h-5 w-5 text-emerald-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-white">
                                  {payment.addonId?.name || "Add-on"} #{payment.paymentNumber}
                                </p>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                                    payment.status === "captured"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : payment.status === "authorized"
                                        ? "bg-blue-500/10 text-blue-400"
                                        : payment.status === "failed"
                                          ? "bg-red-500/10 text-red-400"
                                          : "bg-zinc-500/10 text-zinc-400"
                                  )}
                                >
                                  {payment.status === "captured" && (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  {payment.status.charAt(0).toUpperCase() +
                                    payment.status.slice(1)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-xs text-[#6b6b80]">
                                  {formatDate(payment.paidAt)}
                                </p>
                                {payment.method && (
                                  <span className="text-xs text-[#6b6b80]">
                                    • {payment.method.toUpperCase()}
                                    {payment.vpa && ` (${payment.vpa})`}
                                    {payment.bank && ` (${payment.bank})`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-base font-semibold text-white">
                                {formatPrice(payment.amount)}
                              </p>
                              {payment.fee && (
                                <p className="text-xs text-[#6b6b80]">
                                  Fee: {formatPrice(payment.fee)}
                                </p>
                              )}
                            </div>
                            {payment.invoiceShortUrl && (
                              <a
                                href={payment.invoiceShortUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-[#1a1a22] hover:bg-[#252530] text-[#6b6b80] hover:text-white transition-colors"
                                title="View Invoice"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </div>
                        {/* Payment ID */}
                        <div className="mt-3 pt-3 border-t border-[#1a1a22]/50">
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-[#6b6b80]">Payment ID:</span>
                            <code className="text-[#9fa0b8] font-mono">
                              {payment.razorpayPaymentId}
                            </code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-4 rounded-full bg-[#1a1a22] mb-4">
                <Building2 className="h-8 w-8 text-[#6b6b80]" />
              </div>
              <p className="text-[#9fa0b8] font-medium">
                No subscription found
              </p>
              <p className="text-sm text-[#6b6b80] mt-1">
                You don&apos;t have an active office subscription
              </p>
            </div>
          )}
        </div>
      ) : activeType === "invoices" ? (
        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#6b6b80]">Loading invoices...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* Refresh button only, sub-tabs removed from top and moved to bottom menu */}
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchInvoices}
                  className="text-[#6b6b80] hover:text-white hover:bg-[#1a1a22] h-8"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* ============ ONE-TIME TAB ============ */}
              {invoiceTab === "one_time" && (() => {
                const oneTimeInvoices = invoicesList.filter((inv: any) => !inv.isRecurring);
                const oneTimeDue = upcomingInvoices.filter((inv: any) => !inv.isRecurring);

                return (
                  <div className="space-y-5">
                    {/* Due Soon — one-time only */}
                    {oneTimeDue.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="h-4 w-4 text-amber-400" />
                          <h3 className="text-sm font-semibold text-amber-400">Pending</h3>
                        </div>
                        <div className="space-y-2">
                          {oneTimeDue.map((inv: any) => {
                            // `failed` is retryable — BE's selectPaymentMethod
                            // resets it back to draft and wipes the prior
                            // failure trace on the next attempt. Same
                            // predicate as InvoicePayPage.tsx:125.
                            const isPending =
                              inv.status === "pending" ||
                              inv.status === "draft" ||
                              inv.status === "failed";
                            return (
                              <div
                                key={inv._id}
                                className="bg-[#0e0e12] rounded-xl border border-amber-500/20 p-4 flex items-center justify-between gap-4"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                                    <Receipt className="h-4 w-4 text-amber-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                      {inv.lineItems?.[0]?.itemName || "Invoice"}
                                    </p>
                                    <span className="text-xs text-[#6b6b80]">{inv.invoiceNumber}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-sm font-semibold text-white">
                                    {(inv.itemCurrency || "USD") === "INR" ? "₹" : "$"}
                                    {((inv.totalAmount || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                  {isPending && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setConfirmCancelInvoice({ _id: inv._id, invoiceNumber: inv.invoiceNumber, itemName: inv.lineItems?.[0]?.itemName })}
                                        disabled={cancellingInvoiceId === inv._id}
                                        className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10 text-xs h-8 px-3 font-medium"
                                      >
                                        {cancellingInvoiceId === inv._id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <>
                                            <XCircle className="h-3.5 w-3.5 mr-1" />
                                            Cancel
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handlePayInvoice(inv)}
                                        disabled={payingInvoiceId === inv._id}
                                        className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground text-xs h-8 px-3 font-semibold"
                                      >
                                        {payingInvoiceId === inv._id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <>
                                            <CreditCard className="h-3 w-3 mr-1" />
                                            Pay Now
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* One-time history */}
                    {oneTimeInvoices.length === 0 && oneTimeDue.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className="p-4 rounded-full bg-[#1a1a22] mb-4">
                          <Receipt className="h-8 w-8 text-[#6b6b80]" />
                        </div>
                        <p className="text-[#9fa0b8] font-medium">No one-time invoices</p>
                        <p className="text-sm text-[#6b6b80] mt-1">One-time purchase invoices will appear here</p>
                      </div>
                    ) : oneTimeInvoices.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-4 w-4 text-[#9fa0b8]" />
                          <h3 className="text-sm font-semibold text-[#9fa0b8]">History</h3>
                        </div>
                        <div className="space-y-1.5">
                          {oneTimeInvoices.map((inv: any) => (
                            <div
                              key={inv._id}
                              className="bg-[#0e0e12] rounded-lg border border-[#1a1a22] px-4 py-3 flex items-center justify-between gap-3 hover:border-[#252530] transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={cn(
                                  "p-1.5 rounded-md shrink-0",
                                  inv.status === "paid" ? "bg-emerald-500/10"
                                    : inv.status === "failed" ? "bg-red-500/10"
                                      : inv.status === "cancelled" ? "bg-orange-500/10"
                                        : "bg-[#1a1a22]"
                                )}>
                                  {inv.status === "paid" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                    : inv.status === "failed" ? <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                                      : inv.status === "cancelled" ? <XCircle className="h-3.5 w-3.5 text-orange-400" />
                                        : <Receipt className="h-3.5 w-3.5 text-[#6b6b80]" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-white truncate">
                                    {inv.lineItems?.[0]?.itemName || "Invoice"}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs text-[#6b6b80]">{inv.invoiceNumber}</span>
                                    <span className="text-xs text-[#6b6b80]">
                                      • {new Date(inv.paidAt || inv.cancelledAt || inv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                    {inv.couponCode && inv.discount > 0 && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                                        Coupon: {inv.couponCode}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm font-medium text-white">
                                  {/* Prefer itemCurrency for the symbol — that's
                                      the currency the buyer saw at checkout, and
                                      totalAmount is stored in its smallest unit.
                                      paymentCurrency can be "USD" for wallet
                                      payments on INR items, which mis-labels
                                      those rows if we short-circuit off it. */}
                                  {(inv.itemCurrency || inv.paymentCurrency) === "INR" ? "₹" : "$"}
                                  {((inv.totalAmount || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full capitalize",
                                  inv.status === "paid" ? "bg-emerald-500/10 text-emerald-400"
                                    : inv.status === "failed" ? "bg-red-500/10 text-red-400"
                                      : inv.status === "cancelled" ? "bg-orange-500/10 text-orange-400"
                                        : inv.status === "refunded" ? "bg-blue-500/10 text-blue-400"
                                          : "bg-zinc-500/10 text-zinc-400"
                                )}>
                                  {inv.status}
                                </span>
                                <a
                                  href={`/invoice/${inv.invoiceNumber || inv._id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[#6b6b80] hover:text-white transition-colors flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ============ RECURRING TAB ============ */}
              {invoiceTab === "recurring" && (() => {
                const recurringInvoices = invoicesList.filter((inv: any) => inv.isRecurring);
                const recurringDue = upcomingInvoices.filter((inv: any) => inv.isRecurring);

                // Group by subscription: parent invoices (no parentInvoiceId) are the subscription roots
                // Child invoices link to their parent via parentInvoiceId
                const subscriptionMap = new Map<string, { parent: any; children: any[]; pending: any | null }>();

                // First pass: find parent invoices
                for (const inv of recurringInvoices) {
                  if (!inv.parentInvoiceId) {
                    subscriptionMap.set(inv._id, {
                      parent: inv,
                      children: [],
                      pending: null,
                    });
                  }
                }

                // Second pass: attach children
                for (const inv of recurringInvoices) {
                  if (inv.parentInvoiceId) {
                    const group = subscriptionMap.get(inv.parentInvoiceId);
                    if (group) {
                      group.children.push(inv);
                    } else {
                      // Parent not in current page — create a synthetic group
                      subscriptionMap.set(inv.parentInvoiceId, {
                        parent: null,
                        children: [inv],
                        pending: null,
                      });
                    }
                  }
                }

                // Attach upcoming/pending invoices to their subscription
                for (const inv of recurringDue) {
                  const parentId = inv.parentInvoiceId || inv._id;
                  const group = subscriptionMap.get(parentId);
                  if (group) {
                    group.pending = inv;
                  } else {
                    subscriptionMap.set(parentId, { parent: inv, children: [], pending: inv });
                  }
                }

                const subscriptions = Array.from(subscriptionMap.entries()).sort(
                  (a, b) => {
                    const dateA = a[1].parent?.createdAt || a[1].children[0]?.createdAt || "";
                    const dateB = b[1].parent?.createdAt || b[1].children[0]?.createdAt || "";
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                  }
                );

                if (subscriptions.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="p-4 rounded-full bg-[#1a1a22] mb-4">
                        <Repeat className="h-8 w-8 text-[#6b6b80]" />
                      </div>
                      <p className="text-[#9fa0b8] font-medium">No recurring invoices</p>
                      <p className="text-sm text-[#6b6b80] mt-1">Subscription invoices will appear here</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {subscriptions.map(([subId, group]) => {
                      const representative = group.parent || group.children[0];
                      if (!representative) return null;

                      const isExpanded = expandedSubId === subId;
                      const allInvoices = [
                        ...(group.parent ? [group.parent] : []),
                        ...group.children,
                      ].sort((a, b) => (b.recurringPaymentNumber || 0) - (a.recurringPaymentNumber || 0));

                      const itemName = representative.lineItems?.[0]?.itemName || "Subscription";
                      const period = representative.recurringPeriod || "monthly";
                      // itemCurrency first: paymentCurrency can be "USD" for
                      // wallet-paid INR items and would mis-label the symbol.
                      const currency = representative.itemCurrency || representative.paymentCurrency || "USD";
                      const currencySymbol = currency === "INR" ? "₹" : "$";
                      const amount = ((representative.totalAmount || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
                      const paidCount = allInvoices.filter((i: any) => i.status === "paid").length;
                      const hasPending = group.pending && ["draft", "pending"].includes(group.pending.status);

                      return (
                        <div key={subId} className="bg-[#0e0e12] rounded-xl border border-[#1a1a22] overflow-hidden">
                          {/* Subscription header */}
                          <button
                            onClick={() => setExpandedSubId(isExpanded ? null : subId)}
                            className="w-full px-4 py-4 flex items-center justify-between gap-4 hover:bg-[#12121a] transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 rounded-lg bg-[#1a1a22] shrink-0">
                                <Repeat className="h-4 w-4 text-brand" />
                              </div>
                              <div className="min-w-0 text-left">
                                <p className="text-sm font-medium text-white truncate">{itemName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-[#6b6b80] capitalize">{period}</span>
                                  <span className="text-xs text-[#6b6b80]">•</span>
                                  <span className="text-xs text-[#6b6b80]">{currencySymbol}{amount}</span>
                                  <span className="text-xs text-[#6b6b80]">•</span>
                                  <span className="text-xs text-[#6b6b80]">{paidCount} paid</span>
                                  {hasPending && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                                      Due
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {group.parent?.cancelledAt && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                  Cancels {group.parent.nextDueDate
                                    ? new Date(group.parent.nextDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                    : "at end of period"}
                                </span>
                              )}
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-[#6b6b80] transition-transform",
                                  isExpanded && "rotate-180"
                                )}
                              />
                            </div>
                          </button>

                          {/* Expanded: pending due + invoice history */}
                          {isExpanded && (
                            <div className="border-t border-[#1a1a22]">
                              {/* Pending payment card */}
                              {hasPending && (() => {
                                const pInv = group.pending;
                                const dueDate = pInv.dueDate ? new Date(pInv.dueDate) : null;
                                const daysUntilDue = dueDate
                                  ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                  : null;
                                return (
                                  <div className="mx-3 mt-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-amber-400">
                                        Payment #{pInv.recurringPaymentNumber || "—"} due
                                        {daysUntilDue !== null && daysUntilDue <= 0
                                          ? " today"
                                          : daysUntilDue === 1
                                            ? " tomorrow"
                                            : dueDate
                                              ? ` in ${daysUntilDue} days`
                                              : ""}
                                      </p>
                                      <span className="text-xs text-[#6b6b80]">{pInv.invoiceNumber}</span>
                                      {/* Autopay is on, so this invoice will be
                                          collected on its own. Say so — otherwise
                                          a pending invoice next to a "Pay" button
                                          reads as "you owe this now", and the user
                                          either double-handles it or worries. */}
                                      {autopay?.enabled && pInv.status !== "upcoming" && (
                                        pInv.status === "failed" ? (
                                          // Autopay is on but THIS cycle's debit
                                          // failed. Saying "nothing to do" here
                                          // would be wrong — this is the one
                                          // case that needs the buyer to act.
                                          <p className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3 shrink-0" />
                                            Auto-debit didn&apos;t go through — pay this one by hand.
                                            Autopay stays on for future renewals.
                                          </p>
                                        ) : (
                                          <p className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
                                            <Zap className="h-3 w-3 shrink-0" />
                                            Auto-debits
                                            {dueDate ? ` on ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                                            {autopay.vpa ? ` from ${autopay.vpa}` : " via UPI autopay"} — nothing to do.
                                          </p>
                                        )
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-sm font-semibold text-white">
                                        {currencySymbol}
                                        {((pInv.totalAmount || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                      {/* Hide "Pay" when autopay will collect this
                                          cycle — showing it next to "nothing to
                                          do" contradicts itself and invites a
                                          payment the mandate is about to make.
                                          A `failed` invoice is the exception:
                                          the auto-debit already didn't work, so
                                          paying by hand is exactly the action
                                          needed. */}
                                      {pInv.status !== "upcoming" &&
                                        (!autopay?.enabled || pInv.status === "failed") && (
                                        <Button
                                          size="sm"
                                          onClick={() => handlePayInvoice(pInv)}
                                          disabled={payingInvoiceId === pInv._id}
                                          className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground text-xs h-7 px-3 font-semibold"
                                        >
                                          {payingInvoiceId === pInv._id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : "Pay"}
                                        </Button>
                                      )}
                                      {pInv.status === "upcoming" && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                          Auto-charge
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Payment timeline */}
                              <div className="px-3 py-3">
                                {allInvoices.length === 0 ? (
                                  <p className="text-xs text-[#6b6b80] text-center py-4">No payment history yet</p>
                                ) : (
                                  <div className="space-y-px">
                                    {allInvoices.map((inv: any, idx: number) => (
                                      <div
                                        key={inv._id}
                                        className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#12121a] transition-colors"
                                      >
                                        {/* Timeline dot + line */}
                                        <div className="flex flex-col items-center shrink-0 self-stretch">
                                          <div className={cn(
                                            "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                            inv.status === "paid" ? "bg-emerald-400"
                                              : inv.status === "failed" ? "bg-red-400"
                                                : inv.status === "cancelled" ? "bg-orange-400"
                                                  : inv.status === "draft" || inv.status === "pending" ? "bg-amber-400"
                                                    : "bg-[#6b6b80]"
                                          )} />
                                          {idx < allInvoices.length - 1 && (
                                            <div className="w-px flex-1 bg-[#1a1a22] mt-1" />
                                          )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-medium text-white">
                                                #{inv.recurringPaymentNumber || 1}
                                              </span>
                                              <span className={cn(
                                                "text-[10px] px-1.5 py-px rounded-full capitalize",
                                                inv.status === "paid" ? "bg-emerald-500/10 text-emerald-400"
                                                  : inv.status === "failed" ? "bg-red-500/10 text-red-400"
                                                    : inv.status === "cancelled" ? "bg-orange-500/10 text-orange-400"
                                                      : inv.status === "draft" || inv.status === "pending" ? "bg-amber-500/10 text-amber-400"
                                                        : "bg-zinc-500/10 text-zinc-400"
                                              )}>
                                                {inv.status === "draft" ? "Pending" : inv.status}
                                              </span>
                                              {inv.couponCode && inv.discount > 0 && (
                                                <span className="text-[10px] px-1.5 py-px rounded bg-emerald-500/10 text-emerald-400 font-medium">
                                                  {inv.couponCode}
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-[11px] text-[#6b6b80]">
                                              {(() => {
                                                // Pending / draft children were often pre-created
                                                // alongside the parent, so their `createdAt` collides
                                                // with the parent's paid date (see founder screenshot
                                                // where both cycle #1 paid and cycle #2 pending showed
                                                // the same Jul 15). For those, show the ACTUAL due
                                                // date computed from `nextDueDate - one period`, since
                                                // BE stores each child's `nextDueDate` as its
                                                // successor's due (services/invoice.ts:3213).
                                                const isPendingChild =
                                                  inv.status === "draft" || inv.status === "pending";
                                                if (isPendingChild && inv.nextDueDate) {
                                                  const period =
                                                    inv.recurringPeriod ||
                                                    (group.parent as any)?.recurringPeriod;
                                                  const due = subOnePeriod(inv.nextDueDate, period);
                                                  if (due) {
                                                    return due.toLocaleDateString("en-US", {
                                                      month: "short",
                                                      day: "numeric",
                                                      year: "numeric",
                                                    });
                                                  }
                                                }
                                                return new Date(
                                                  inv.paidAt || inv.cancelledAt || inv.createdAt,
                                                ).toLocaleDateString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                  year: "numeric",
                                                });
                                              })()}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-medium text-white">
                                              {currencySymbol}
                                              {((inv.totalAmount || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                            <a
                                              href={`/invoice/${inv.invoiceNumber || inv._id}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[#6b6b80] hover:text-white transition-colors flex items-center gap-0.5"
                                              title="View invoice"
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                            </a>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* ── Billing plan ──────────────────────────────
                                  Real plan cards, not a row of chips: the whole
                                  point of the longer terms is the per-month
                                  saving, and that comparison is unreadable
                                  unless each option shows its own total,
                                  effective monthly rate and discount side by
                                  side. Matched to this card by parent invoice
                                  id; renders nothing for subscriptions the API
                                  doesn't cover. */}
                              {(() => {
                                                              const parent = group.parent;
                                                              if (!parent) return null;
                                                              const sub = tpSubs.find(
                                                                (x: any) => x.parentInvoiceId === String(parent._id),
                                                              );
                                                              // Missing = the list hid it (a never-paid root that was
                                                              // reissued at another term; its successor shows the picker).
                                                              if (!sub || !sub.terms?.length) return null;
                              
                                                              // Three situations, three different actions:
                                                              //   change      — paid and running: queue a different term for
                                                              //                 the next renewal. Nothing charged now.
                                                              //   reissue     — the FIRST invoice was never paid: the backend
                                                              //                 replaces it at the chosen term and the user
                                                              //                 pays that one.
                                                              //   resubscribe — cancelled, or the chain lapsed (past due with
                                                              //                 nothing pending): start a fresh subscription
                                                              //                 through the standalone checkout.
                                                              const cancelled = !!parent.cancelledAt;
                                                              const unpaidRoot = sub.firstCyclePaid === false;
                                                              const lapsed =
                                                                !cancelled &&
                                                                !unpaidRoot &&
                                                                !!sub.nextDueDate &&
                                                                new Date(sub.nextDueDate).getTime() < Date.now() &&
                                                                !sub.pendingInvoice;
                                                              const mode: "change" | "reissue" | "resubscribe" =
                                                                cancelled || lapsed ? "resubscribe" : unpaidRoot ? "reissue" : "change";
                              
                                                              const current = sub.pendingTermMonths ?? sub.currentTermMonths ?? 1;
                                                              const monthlyRate =
                                                                sub.terms.find((t: any) => t.termMonths === 1)?.monthlyEquivalent ?? null;
                                                              const longest = Math.max(...sub.terms.map((t: any) => t.termMonths));
                                                              const busy = termBusy === sub.parentInvoiceId;
                                                              // In change mode the backend refuses cancelled / in-flight
                                                              // payment roots; the other two modes are exactly for those.
                                                              const canAct = mode === "change" ? !!sub.canChangeTerm : true;
                              
                                                              const heading =
                                                                mode === "resubscribe"
                                                                  ? cancelled
                                                                    ? "Subscription cancelled"
                                                                    : "Subscription lapsed"
                                                                  : mode === "reissue"
                                                                    ? "First payment outstanding"
                                                                    : "Billing plan";
                                                              const blurb =
                                                                mode === "resubscribe"
                                                                  ? "Pick a plan to subscribe again — we'll issue a new invoice and take you to it."
                                                                  : mode === "reissue"
                                                                    ? "Your first invoice was never paid. Pick a plan and we'll issue a fresh invoice at that price for you to pay."
                                                                    : "Longer terms cost less per month. Changes apply from your next cycle — nothing is charged now.";
                              
                                                              return (
                                                                <div className="px-3 pb-3 pt-3 border-t border-[#1a1a22]">
                                                                  <div className="flex items-start justify-between gap-3 mb-1">
                                                                    <div className="min-w-0">
                                                                      <p
                                                                        className={cn(
                                                                          "text-xs font-semibold",
                                                                          mode === "change" ? "text-white" : "text-amber-400",
                                                                        )}
                                                                      >
                                                                        {heading}
                                                                      </p>
                                                                      <p className="text-[11px] text-[#6b6b80] mt-0.5">{blurb}</p>
                                                                    </div>
                                                                    {mode === "change" && sub.pendingTermMonths ? (
                                                                      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                        {sub.pendingTermMonths === 1
                                                                          ? "Monthly"
                                                                          : `${sub.pendingTermMonths} months`}{" "}
                                                                        from next cycle
                                                                      </span>
                                                                    ) : null}
                                                                  </div>
                              
                                                                  {mode === "change" && !sub.canChangeTerm && sub.changeBlockedReason && (
                                                                    <p className="text-[11px] text-amber-400/80 mt-2 mb-1">
                                                                      {sub.changeBlockedReason}
                                                                    </p>
                                                                  )}
                              
                                                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                                                                    {sub.terms.map((t: any) => {
                                                                      const isCurrent = t.termMonths === current;
                                                                      // Only a RUNNING plan's current term is inert — on an
                                                                      // unpaid/cancelled chain every term is a valid pick,
                                                                      // including the one they had before.
                                                                      const clickable = canAct && !busy && !(mode === "change" && isCurrent);
                                                                      const highlight = mode === "change" && isCurrent;
                                                                      const savePct =
                                                                        monthlyRate && t.termMonths > 1
                                                                          ? Math.round(((monthlyRate - t.monthlyEquivalent) / monthlyRate) * 100)
                                                                          : 0;
                                                                      return (
                                                                        <button
                                                                          key={t.termMonths}
                                                                          disabled={!clickable}
                                                                          onClick={() =>
                                                                            setConfirmTermChange({
                                                                              parentInvoiceId: sub.parentInvoiceId,
                                                                              clientId: sub.clientId,
                                                                              clientName: sub.clientName,
                                                                              fromMonths: current,
                                                                              toMonths: t.termMonths,
                                                                              label: t.label,
                                                                              amount: t.totalAmount,
                                                                              mode,
                                                                            })
                                                                          }
                                                                          className={cn(
                                                                            "relative rounded-xl border p-3 text-left transition-all",
                                                                            highlight
                                                                              ? "border-brand/50 bg-brand/[0.07]"
                                                                              : clickable
                                                                                ? "border-[#2a2a35] bg-[#0e0e12] hover:border-brand/40 hover:bg-[#12121a]"
                                                                                : "border-[#1a1a22] bg-[#0e0e12] opacity-50 cursor-not-allowed",
                                                                          )}
                                                                        >
                                                                          {t.termMonths === longest && longest > 1 && !highlight && (
                                                                            <span className="absolute -top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                                                              Best value
                                                                            </span>
                                                                          )}
                                                                          <p
                                                                            className={cn(
                                                                              "text-[11px] font-semibold",
                                                                              highlight ? "text-brand" : "text-white",
                                                                            )}
                                                                          >
                                                                            {t.label}
                                                                          </p>
                                                                          {/* Headline is what they will actually be billed;
                                                                              the per-month figure is the comparison aid. */}
                                                                          <p className="text-base font-bold text-white mt-1 leading-none">
                                                                            ${t.totalAmount}
                                                                            <span className="text-[10px] font-normal text-[#6b6b80]">
                                                                              {t.termMonths === 1 ? " /month" : ` /${t.termMonths} months`}
                                                                            </span>
                                                                          </p>
                                                                          {t.termMonths > 1 && (
                                                                            <p className="text-[10px] text-[#6b6b80] mt-1">
                                                                              ${t.monthlyEquivalent}/mo equivalent
                                                                            </p>
                                                                          )}
                                                                          {savePct > 0 && (
                                                                            <p className="text-[10px] text-emerald-400 mt-1">
                                                                              Save {savePct}%
                                                                            </p>
                                                                          )}
                                                                          {highlight && (
                                                                            <p className="text-[10px] text-brand mt-1.5 flex items-center gap-1">
                                                                              <CheckCircle2 className="h-3 w-3" />
                                                                              Current plan
                                                                            </p>
                                                                          )}
                                                                          {mode !== "change" && isCurrent && (
                                                                            <p className="text-[10px] text-[#6b6b80] mt-1.5">
                                                                              Previous plan
                                                                            </p>
                                                                          )}
                                                                        </button>
                                                                      );
                                                                    })}
                                                                  </div>
                              
                                                                  {mode === "change" && autopay?.enabled && sub.canChangeTerm && (
                                                                    <p className="text-[10px] text-[#6b6b80] mt-2.5 flex items-start gap-1.5">
                                                                      <Smartphone className="h-3 w-3 shrink-0 mt-px" />
                                                                      <span>
                                                                        Switching plans cancels your UPI Autopay mandate — it&apos;s
                                                                        authorised for the current amount only. You&apos;ll pay the
                                                                        next invoice by hand, which sets autopay up again at the
                                                                        new amount.
                                                                      </span>
                                                                    </p>
                                                                  )}
                                                                </div>
                                                              );
                                                            })()}

                              {/* Autopay — deliberately ABOVE and visually separate
                                  from Cancel Subscription. Turning autopay off
                                  only changes how the invoice gets paid; it does
                                  not end the subscription, and the copy has to
                                  make that impossible to misread. */}
                              {group.parent && !group.parent.cancelledAt && !group.parent.razorpaySubscriptionId && (
                                <div className="px-3 pb-2 pt-2 border-t border-[#1a1a22] flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-[#9fa0b8] flex items-center gap-1.5">
                                      <Smartphone className="h-3.5 w-3.5 shrink-0 text-[#6b6b80]" />
                                      UPI Autopay
                                      <span
                                        className={cn(
                                          "text-[10px] px-1.5 py-0.5 rounded-full border",
                                          autopay?.enabled
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            : "bg-[#1a1a22] text-[#6b6b80] border-[#1a1a22]",
                                        )}
                                      >
                                        {autopay?.enabled ? "On" : "Off"}
                                      </span>
                                    </p>
                                    <p className="text-[11px] text-[#6b6b80] mt-0.5">
                                      {autopay?.enabled
                                        ? `All renewals are collected automatically${autopay.vpa ? ` from ${autopay.vpa}` : ""}.`
                                        : autopay?.reason || "Invoices are issued as usual and paid manually."}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={autopayBusy}
                                    onClick={() =>
                                      autopay?.enabled
                                        ? setConfirmDisableAutopay(true)
                                        : handleEnableAutopay(group.parent._id)
                                    }
                                    className={cn(
                                      "text-xs h-7 px-3 font-medium shrink-0",
                                      autopay?.enabled
                                        ? "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                                        : "text-brand hover:text-brand hover:bg-brand/10",
                                    )}
                                  >
                                    {autopayBusy ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : autopay?.enabled ? (
                                      "Turn off"
                                    ) : (
                                      "Turn on"
                                    )}
                                  </Button>
                                </div>
                              )}

                              {/* Resubscribe — a cancelled subscription is revived
                                  in place on the same parent invoice. Also the way
                                  back for someone whose mandate died and whose
                                  subscription then lapsed. */}
                              {group.parent && group.parent.cancelledAt && !group.parent.razorpaySubscriptionId && (
                                <div className="px-3 pb-3 pt-1 border-t border-[#1a1a22]">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRenewSubscription(group.parent._id)}
                                    disabled={renewingSubId === group.parent._id}
                                    className="w-full text-brand hover:text-brand hover:bg-brand/10 text-xs h-8 font-medium"
                                  >
                                    {renewingSubId === group.parent._id ? (
                                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                    ) : (
                                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    Resubscribe
                                  </Button>
                                </div>
                              )}

                              {/* Cancel subscription */}
                              {group.parent && !group.parent.cancelledAt && !group.parent.razorpaySubscriptionId && (
                                <div className="px-3 pb-3 pt-1 border-t border-[#1a1a22]">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setConfirmCancelSub({
                                      parentId: group.parent._id,
                                      itemName,
                                      nextDueDate: group.parent.nextDueDate,
                                      itemType: (group.parent as any)?.lineItems?.[0]?.itemType,
                                      itemId: (group.parent as any)?.lineItems?.[0]?.itemId?.toString?.() ?? (group.parent as any)?.lineItems?.[0]?.itemId,
                                      orgId: (group.parent as any)?.organizationId?.toString?.() ?? (group.parent as any)?.organizationId,
                                      parentStatus: (group.parent as any)?.status,
                                    })}
                                    disabled={cancellingSubId === group.parent._id}
                                    className="w-full text-red-400/70 hover:text-red-400 hover:bg-red-500/10 text-xs h-8 font-medium"
                                  >
                                    {cancellingSubId === group.parent._id ? (
                                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    Cancel Subscription
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {renderPagination()}
            </div>
          )}
        </div>
      ) : activeType === "unilevel_plus" ? (
        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {upLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#6b6b80]">Loading purchase info...</p>
              </div>
            </div>
          ) : upPurchase?.purchased && upPurchase.purchase ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Purchase Receipt Card */}
              <div className="bg-gradient-to-br from-[#0e0e12] to-[#0a0a0c] rounded-2xl border border-[#1a1a22] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-[#1a1a22]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20">
                        <Zap className="h-8 w-8 text-brand" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-white">
                            {upPurchase.plan?.name || "Unilevel Plus"}
                          </h3>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            {upPurchase.purchase.status.charAt(0).toUpperCase() + upPurchase.purchase.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-[#6b6b80] mt-1">
                          {upPurchase.plan?.description || "Multi-level affiliate commission plan"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Receipt Details */}
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-[#6b6b80] uppercase tracking-wider mb-1">Amount Paid</p>
                        <p className="text-2xl font-bold text-white">
                          {formatPrice(upPurchase.purchase.amount, upPurchase.purchase.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b6b80] uppercase tracking-wider mb-1">Currency</p>
                        <p className="text-sm font-medium text-[#9fa0b8]">
                          {upPurchase.purchase.currency}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-[#6b6b80] uppercase tracking-wider mb-1">Activated On</p>
                        <p className="text-sm font-medium text-[#9fa0b8]">
                          {formatDate(upPurchase.purchase.purchasedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b6b80] uppercase tracking-wider mb-1">Payment ID</p>
                        <code className="text-xs text-[#9fa0b8] font-mono bg-[#1a1a22] px-2 py-1 rounded">
                          {upPurchase.purchase.paymentId}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-4 rounded-full bg-[#1a1a22] mb-4">
                <Zap className="h-8 w-8 text-[#6b6b80]" />
              </div>
              <p className="text-[#9fa0b8] font-medium">
                No purchase found
              </p>
              <p className="text-sm text-[#6b6b80] mt-1">
                You haven&apos;t activated the Unilevel Plus plan yet
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Table */
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[#0e0e12] animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-[#1a1a22] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-[#1a1a22] rounded w-48" />
                    <div className="h-3 bg-[#1a1a22] rounded w-32" />
                  </div>
                  <div className="h-3.5 bg-[#1a1a22] rounded w-16" />
                  <div className="h-3.5 bg-[#1a1a22] rounded w-20" />
                  <div className="h-6 bg-[#1a1a22] rounded w-20" />
                  <div className="h-3.5 bg-[#1a1a22] rounded w-24" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-4 rounded-full bg-[#1a1a22] mb-4">
                <Package className="h-8 w-8 text-[#6b6b80]" />
              </div>
              <p className="text-[#9fa0b8] font-medium">No orders found</p>
              <p className="text-sm text-[#6b6b80] mt-1">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Orders will appear here"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#1a1a22] hover:bg-transparent">
                  <TableHead className="text-[#6b6b80] font-medium w-[280px]">
                    Order
                  </TableHead>
                  <TableHead className="text-[#6b6b80] font-medium w-[100px]">
                    <button
                      onClick={() => handleSort("type")}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      Type
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </TableHead>
                  <TableHead className="text-[#6b6b80] font-medium">
                    Customer
                  </TableHead>
                  <TableHead className="text-[#6b6b80] font-medium w-[100px]">
                    <button
                      onClick={() => handleSort("amount")}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      Amount
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </TableHead>
                  <TableHead className="text-[#6b6b80] font-medium w-[100px]">
                    Status
                  </TableHead>
                  <TableHead className="text-[#6b6b80] font-medium w-[110px]">
                    <button
                      onClick={() => handleSort("date")}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      Date
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </TableHead>
                  <TableHead className="text-[#6b6b80] font-medium w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <>
                    <TableRow
                      key={order._id}
                      className={cn(
                        "border-[#1a1a22] cursor-pointer transition-colors",
                        expandedOrderId === order._id
                          ? "bg-[#0e0e12]"
                          : "hover:bg-[#0e0e12]/50"
                      )}
                      onClick={() =>
                        setExpandedOrderId(
                          expandedOrderId === order._id ? null : order._id
                        )
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#1a1a22] overflow-hidden flex-shrink-0">
                            {order.itemImage ? (
                              <img
                                src={order.itemImage}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#6b6b80]">
                                {getTypeIcon(order.type)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {order.itemName}
                            </p>
                            <p className="text-xs text-[#6b6b80] font-mono">
                              {order.orderNumber}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-[#9fa0b8]">
                          {getTypeIcon(order.type)}
                          <span className="text-sm capitalize">
                            {order.type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.customer ? (
                          <div className="flex items-center gap-2">
                            {order.customer.profilePicture ? (
                              <img
                                src={order.customer.profilePicture}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#1a1a22] flex items-center justify-center">
                                <User className="w-3.5 h-3.5 text-[#6b6b80]" />
                              </div>
                            )}
                            <span className="text-sm text-white truncate max-w-[120px]">
                              {order.customer.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-[#6b6b80]">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            order.amount === 0
                              ? "text-emerald-400"
                              : "text-white"
                          )}
                        >
                          {formatPrice(order.amount, order.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.paymentStatus)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[#9fa0b8]">
                          {formatDate(order.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button className="p-1 text-[#6b6b80] hover:text-white transition-colors">
                          {expandedOrderId === order._id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                    {expandedOrderId === order._id && (
                      <TableRow className="border-[#1a1a22] hover:bg-transparent">
                        <TableCell colSpan={7} className="p-0">
                          {renderExpandedContent(order)}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
          {renderPagination()}
        </div>
      )}
      {/* Dialog + CheckoutPaymentStep removed — pay panel is now inline in the Invoices tab */}

      {/* Confirm cancel invoice dialog */}
      <AlertDialog open={!!confirmCancelInvoice} onOpenChange={(open) => { if (!open && !cancellingInvoiceId) setConfirmCancelInvoice(null); }}>
        <AlertDialogContent className="bg-[#0e0e12] border-[#1a1a22]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancel invoice?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6b6b80]">
              This will cancel invoice{" "}
              <span className="text-[#9fa0b8] font-medium">{confirmCancelInvoice?.invoiceNumber}</span>
              {confirmCancelInvoice?.itemName && (
                <> for <span className="text-[#9fa0b8] font-medium">{confirmCancelInvoice.itemName}</span></>
              )}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!cancellingInvoiceId} className="bg-transparent border-[#1a1a22] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white">
              Keep Invoice
            </AlertDialogCancel>
            <Button
              disabled={!!cancellingInvoiceId}
              onClick={() => confirmCancelInvoice && executeCancelInvoice(confirmCancelInvoice._id)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {cancellingInvoiceId ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelling...</>
              ) : "Cancel Invoice"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm plan change.
          Leads with the autopay consequence because it is the part that costs
          the buyer something: the mandate's ceiling is sized to the plan they
          authorised, so switching term cancels it and the next cycle is paid by
          hand before a new mandate can be established. Hiding that would make
          the following month look like a billing failure. */}
      <AlertDialog
        open={!!confirmTermChange}
        onOpenChange={(open) => { if (!open && !termBusy) setConfirmTermChange(null); }}
      >
        <AlertDialogContent className="bg-[#0e0e12] border-[#1a1a22] !z-[9999]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {confirmTermChange?.mode === "resubscribe"
                ? `Subscribe again — ${confirmTermChange?.label}?`
                : confirmTermChange?.mode === "reissue"
                  ? `Start with ${confirmTermChange?.label}?`
                  : `Switch to ${confirmTermChange?.label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6b6b80]">
              {confirmTermChange?.mode === "resubscribe" ? (
                <>
                  We&apos;ll issue a new{" "}
                  {confirmTermChange?.clientName || "subscription"} invoice for{" "}
                  <span className="text-[#9fa0b8] font-medium">
                    ${confirmTermChange?.amount}
                  </span>{" "}
                  ({confirmTermChange?.label}) and take you to it. Your subscription
                  is active again as soon as it&apos;s paid.
                </>
              ) : confirmTermChange?.mode === "reissue" ? (
                <>
                  We&apos;ll replace your unpaid invoice with a new one for{" "}
                  <span className="text-[#9fa0b8] font-medium">
                    ${confirmTermChange?.amount}
                  </span>{" "}
                  ({confirmTermChange?.label}) and take you to it. Your subscription
                  starts once that invoice is paid.
                </>
              ) : (
                <>
                  Your next cycle will bill{" "}
                  <span className="text-[#9fa0b8] font-medium">
                    ${confirmTermChange?.amount}
                  </span>{" "}
                  for {confirmTermChange?.label}. Nothing is charged right now, and the
                  current cycle is unaffected.
                </>
              )}
              {autopay?.enabled && confirmTermChange?.mode === "change" ? (
                <>
                  {" "}
                  <span className="text-[#9fa0b8] font-medium">
                    UPI Autopay will be switched off as part of this change.
                  </span>{" "}
                  Your mandate is authorised for the old amount and can&apos;t cover
                  the new one, so it gets cancelled with your bank. Pay the next
                  invoice by UPI to set autopay up again at the new amount — your
                  subscription stays active throughout.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={!!termBusy}
              className="bg-transparent border-[#1a1a22] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white"
            >
              Keep current plan
            </AlertDialogCancel>
            <Button
              disabled={!!termBusy}
              onClick={() => executeTermChange()}
              className="bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] font-semibold"
            >
              {termBusy ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Switching...</>
              ) : confirmTermChange?.mode === "resubscribe"
                ? `Subscribe — $${confirmTermChange?.amount}`
                : confirmTermChange?.mode === "reissue"
                  ? `Issue ${confirmTermChange?.label ?? "this plan"} invoice`
                  : `Switch to ${confirmTermChange?.label ?? "this plan"}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm turn-off-autopay dialog.
          Not styled as a destructive action, because it isn't one — the whole
          point is that the subscription survives. The copy leads with what
          KEEPS working so nobody reads this as cancelling. */}
      <AlertDialog open={confirmDisableAutopay} onOpenChange={(open) => { if (!open && !autopayBusy) setConfirmDisableAutopay(false); }}>
        <AlertDialogContent className="bg-[#0e0e12] border-[#1a1a22] !z-[9999]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Turn off UPI autopay?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6b6b80]">
              <span className="text-[#9fa0b8] font-medium">Nothing is cancelled — your subscriptions stay active.</span> You&apos;ll
              keep getting an invoice for every renewal on the same schedule; you&apos;ll just pay each one
              yourself instead of it being collected automatically. One mandate covers every recurring
              payment on your account, so this turns off automatic collection for all of them.
              {autopay?.vpa ? (
                <> The mandate on <span className="text-[#9fa0b8] font-medium">{autopay.vpa}</span> will be revoked.</>
              ) : null}
              {" "}You can turn autopay back on at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={autopayBusy} className="bg-transparent border-[#1a1a22] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white">
              Keep Autopay
            </AlertDialogCancel>
            <Button
              disabled={autopayBusy}
              onClick={() => executeDisableAutopay()}
              className="bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] font-semibold"
            >
              {autopayBusy ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Turning off...</>
              ) : "Turn Off Autopay"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm cancel subscription dialog */}
      <AlertDialog open={!!confirmCancelSub} onOpenChange={(open) => { if (!open && !cancellingSubId) setConfirmCancelSub(null); }}>
        <AlertDialogContent className="bg-[#0e0e12] border-[#1a1a22] !z-[9999]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6b6b80]">
              {confirmCancelSub?.parentStatus === "pending" || confirmCancelSub?.parentStatus === "draft" ? (
                <>
                  Your <span className="text-[#9fa0b8] font-medium">{confirmCancelSub?.itemName}</span> subscription hasn&apos;t been paid yet. Cancelling now will void the pending invoice — no charge will be made and no future invoices will be generated.
                </>
              ) : (
                <>
                  Your <span className="text-[#9fa0b8] font-medium">{confirmCancelSub?.itemName}</span> subscription will remain active
                  {confirmCancelSub?.nextDueDate ? (
                    <> until <span className="text-[#9fa0b8] font-medium">{new Date(confirmCancelSub.nextDueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></>
                  ) : (
                    <> until the end of the current billing period</>
                  )}
                  . After that, no further invoices will be generated.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!cancellingSubId} className="bg-transparent border-[#1a1a22] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white">
              Keep Subscription
            </AlertDialogCancel>
            <Button
              disabled={!!cancellingSubId}
              onClick={() => executeCancelSubscription()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {cancellingSubId ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelling...</>
              ) : "Cancel Subscription"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
