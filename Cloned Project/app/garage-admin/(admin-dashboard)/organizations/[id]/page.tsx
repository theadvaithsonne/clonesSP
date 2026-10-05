"use client";

import { useState, useEffect } from "react";
import { invoiceUrl } from "@/lib/admin-domain";
import { garageAdminApi } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Calendar,
  ArrowLeft,
  Globe,
  Video,
  Image,
  Users,
  ExternalLink,
  Copy,
  CheckCircle,
  Store,
  Hash,
  Layers,
  UserCheck,
  UserX,
  FileText,
  Loader2,
  Repeat,
  Receipt,
  ShoppingBag,
  Radio,
  GraduationCap,
  Package,
  Phone,
  Wrench,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

interface Floor {
  id: string;
  level: number;
  name: string;
  departments: Array<{
    name: string;
    color: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  floorId?: string;
  department?: string;
  isVerified: boolean;
  createdAt: string;
}

// Compact invoice shape returned by
// GET /garage-admin/organizations/:id/invoices — powers the
// "Invoice history" section below Users.
interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceType?: string;
  status:
    | "draft"
    | "pending"
    | "paid"
    | "failed"
    | "cancelled"
    | "refunded"
    | "expired";
  totalAmount: number; // smallest currency unit (cents / paise)
  itemCurrency: "USD" | "INR" | string;
  paymentCurrency?: "USD" | "INR" | string;
  isRecurring: boolean;
  recurringPeriod?: "monthly" | "quarterly" | "yearly" | "weekly" | null;
  recurringPaymentNumber?: number | null;
  parentInvoiceId?: string | null;
  itemName?: string | null;
  itemType?: string | null;
  createdAt: string;
  paidAt?: string | null;
  nextDueDate?: string | null;
  cancelledAt?: string | null;
}

interface Organization {
  id: string;
  name: string;
  size?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  parent: boolean;
  description?: string;
  headingText?: string;
  subHeadingText?: string;
  icon?: string;
  coverPhoto?: string;
  promoVideoLink?: string;
  earngpt_data?: {
    message?: string;
    store?: {
      storeId: string;
      name: string;
      slug: string;
      category: string;
      sellerId: string;
    };
    channels?: Array<{
      channelId: string;
      title: string;
    }>;
  };
  floors: Floor[];
  users: User[];
  createdAt: string;
  updatedAt: string;
}

const INVOICES_PAGE_SIZE = 25;

// Every catalog record this office publishes — one shape, discriminated
// by `kind`. Matches the payload from
// GET /garage-admin/organizations/:id/sellable-items.
type SellableKind =
  | "channel"
  | "workshop"
  | "course"
  | "product"
  | "call"
  | "service";

interface SellableItem {
  id: string;
  kind: SellableKind;
  title: string;
  price: number;
  currency: string;
  status: string;
  isSubscription?: boolean;
  subscriptionPeriod?: string | null;
  durationMinutes?: number | null;
  createdAt: string;
}

export default function OrganizationDetailPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const orgId = params?.id as string;

  // Invoice history state — populated by a separate paginated endpoint,
  // NOT inlined into the org-detail response (see BE controller comment).
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesLoadingMore, setInvoicesLoadingMore] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  // Sellable items — everything this office publishes across channels,
  // workshops, courses, products, calls and services. Separate endpoint
  // so a large catalog doesn't slow the main org fetch.
  const [sellables, setSellables] = useState<SellableItem[]>([]);
  const [sellablesCounts, setSellablesCounts] = useState<Record<SellableKind, number> | null>(null);
  const [sellablesLoading, setSellablesLoading] = useState(true);
  const [sellablesError, setSellablesError] = useState<string | null>(null);
  const [sellablesFilter, setSellablesFilter] = useState<SellableKind | "all">("all");

  useEffect(() => {
    if (orgId) {
      loadOrganization();
      loadInvoices(0, /* append */ false);
      loadSellables();
    }
  }, [orgId]);

  const loadOrganization = async () => {
    try {
      const response = await garageAdminApi<{ data: Organization }>(
        `/garage-admin/organizations/${orgId}`,
        {
          method: "GET",
        }
      );
      setOrganization(response?.data || null);
    } catch (error) {
      console.error("Error loading organization:", error);
      toast.error("Failed to load organization details");
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async (offset: number, append: boolean) => {
    if (append) setInvoicesLoadingMore(true);
    else setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const response = await garageAdminApi<{
        data: { invoices: InvoiceRow[]; total: number };
      }>(
        `/garage-admin/organizations/${orgId}/invoices?limit=${INVOICES_PAGE_SIZE}&offset=${offset}`,
        { method: "GET" }
      );
      const nextRows = response?.data?.invoices || [];
      setInvoicesTotal(response?.data?.total || 0);
      setInvoices((prev) => (append ? [...prev, ...nextRows] : nextRows));
    } catch (error) {
      console.error("Error loading org invoices:", error);
      setInvoicesError("Failed to load invoice history");
    } finally {
      setInvoicesLoading(false);
      setInvoicesLoadingMore(false);
    }
  };

  const loadSellables = async () => {
    setSellablesLoading(true);
    setSellablesError(null);
    try {
      const response = await garageAdminApi<{
        data: {
          items: SellableItem[];
          total: number;
          countsByKind: Record<SellableKind, number>;
        };
      }>(
        `/garage-admin/organizations/${orgId}/sellable-items`,
        { method: "GET" }
      );
      setSellables(response?.data?.items || []);
      setSellablesCounts(response?.data?.countsByKind || null);
    } catch (error) {
      console.error("Error loading sellable items:", error);
      setSellablesError("Failed to load sellable items");
    } finally {
      setSellablesLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field} copied to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toLocaleString(),
    };
  };

  // Format cents/paise to a display currency string. Uses Intl for correct
  // symbol per currency (₹ for INR, $ for USD, etc). Amounts on the
  // Invoice model are stored in the smallest unit — hence /100.
  const formatMoney = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: currency || "USD",
        minimumFractionDigits: 2,
      }).format((amount || 0) / 100);
    } catch {
      return `${((amount || 0) / 100).toFixed(2)} ${currency || ""}`.trim();
    }
  };

  // Status → badge className. Matches the app-wide color convention used
  // by the customer Orders page and other admin tables.
  const statusBadgeClass = (status: InvoiceRow["status"]) => {
    switch (status) {
      case "paid":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "pending":
      case "draft":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "cancelled":
        return "bg-gray-500/15 text-gray-300 border-gray-500/30";
      case "failed":
      case "expired":
        return "bg-rose-500/15 text-rose-300 border-rose-500/30";
      case "refunded":
        return "bg-blue-500/15 text-blue-300 border-blue-500/30";
      default:
        return "bg-gray-500/15 text-gray-300 border-gray-500/30";
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Organization Details...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <Building2 className="h-12 w-12 text-gray-400" />
          <h3 className="text-lg font-semibold">Organization Not Found</h3>
          <p className="text-gray-400">
            The organization you're looking for doesn't exist.
          </p>
          <Button
            onClick={() => router.push("/garage-admin/organizations")}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Organizations
          </Button>
        </div>
      </div>
    );
  }

  const dateInfo = formatDate(organization.createdAt);
  const updatedInfo = formatDate(organization.updatedAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/garage-admin/organizations")}
            className="border-none text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {organization.name}
            </h1>
            <p className="text-gray-400">Organization Details</p>
          </div>
        </div>
        <Badge
          variant={organization.parent ? "default" : "secondary"}
          className={
            organization.parent
              ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
              : "bg-blue-500/20 text-blue-300 border-blue-500/30"
          }
        >
          {organization.parent ? "Parent Organization" : "Regular Organization"}
        </Badge>
      </div>

      {/* Organization Overview */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            Organization Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">
                  Name
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-white">{organization.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopyToClipboard(organization.name, "Name")
                    }
                    className="h-6 w-6 p-0"
                  >
                    {copiedField === "Name" ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300">
                  Size
                </label>
                <p className="text-white mt-1">
                  {organization.size || "Not specified"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300">
                  Description
                </label>
                <p className="text-white mt-1">
                  {organization.description || "No description provided"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300">
                  Location
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <div className="text-white">
                    {organization.city &&
                    organization.state &&
                    organization.country ? (
                      <div>
                        <div>
                          {organization.city}, {organization.state}
                        </div>
                        <div className="text-sm text-gray-400">
                          {organization.country}
                        </div>
                      </div>
                    ) : organization.location ? (
                      <div>{organization.location}</div>
                    ) : (
                      <span className="text-gray-400">
                        No location specified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Assets */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">
                  Icon
                </label>
                <div className="mt-1">
                  {organization.icon ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={organization.icon}
                        alt="Organization Icon"
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyToClipboard(organization.icon!, "Icon URL")
                        }
                        className="h-6 w-6 p-0"
                      >
                        {copiedField === "Icon URL" ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                      <Image className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300">
                  Cover Photo
                </label>
                <div className="mt-1">
                  {organization.coverPhoto ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={organization.coverPhoto}
                        alt="Cover Photo"
                        className="w-16 h-12 rounded-lg object-cover"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyToClipboard(
                            organization.coverPhoto!,
                            "Cover Photo URL"
                          )
                        }
                        className="h-6 w-6 p-0"
                      >
                        {copiedField === "Cover Photo URL" ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="w-16 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                      <Image className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300">
                  Promo Video
                </label>
                <div className="mt-1">
                  {organization.promoVideoLink ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={organization.promoVideoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                      >
                        <Video className="w-4 h-4" />
                        <span className="text-sm">Watch Video</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyToClipboard(
                            organization.promoVideoLink!,
                            "Video URL"
                          )
                        }
                        className="h-6 w-6 p-0"
                      >
                        {copiedField === "Video URL" ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-gray-400">No promo video</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Marketing Content */}
      {(organization.headingText || organization.subHeadingText) && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-400" />
              Marketing Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {organization.headingText && (
              <div>
                <label className="text-sm font-medium text-gray-300">
                  Heading Text
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-white">{organization.headingText}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopyToClipboard(
                        organization.headingText!,
                        "Heading Text"
                      )
                    }
                    className="h-6 w-6 p-0"
                  >
                    {copiedField === "Heading Text" ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {organization.subHeadingText && (
              <div>
                <label className="text-sm font-medium text-gray-300">
                  Sub Heading Text
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-white">{organization.subHeadingText}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopyToClipboard(
                        organization.subHeadingText!,
                        "Sub Heading Text"
                      )
                    }
                    className="h-6 w-6 p-0"
                  >
                    {copiedField === "Sub Heading Text" ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* EarnGPT Integration */}
      {organization.earngpt_data && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-orange-400" />
              EarnGPT Store Integration
            </CardTitle>
            <CardDescription className="text-gray-400">
              Store details and communication channels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Store Details */}
            {organization.earngpt_data.store && (
              <div>
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Store className="h-5 w-5 text-blue-400" />
                  Store Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300">
                      Store Name
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-white">
                        {organization.earngpt_data.store.name}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyToClipboard(
                            organization.earngpt_data!.store!.name,
                            "Store Name"
                          )
                        }
                        className="h-6 w-6 p-0"
                      >
                        {copiedField === "Store Name" ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">
                      Store Slug
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-white">
                        {organization.earngpt_data.store.slug}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyToClipboard(
                            organization.earngpt_data!.store!.slug,
                            "Store Slug"
                          )
                        }
                        className="h-6 w-6 p-0"
                      >
                        {copiedField === "Store Slug" ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">
                      Store ID
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-white font-mono text-sm">
                        {organization.earngpt_data.store.storeId}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyToClipboard(
                            organization.earngpt_data!.store!.storeId,
                            "Store ID"
                          )
                        }
                        className="h-6 w-6 p-0"
                      >
                        {copiedField === "Store ID" ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">
                      Seller ID
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-white font-mono text-sm">
                        {organization.earngpt_data.store.sellerId}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyToClipboard(
                            organization.earngpt_data!.store!.sellerId,
                            "Seller ID"
                          )
                        }
                        className="h-6 w-6 p-0"
                      >
                        {copiedField === "Seller ID" ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Channels */}
            {organization.earngpt_data.channels &&
              organization.earngpt_data.channels.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Hash className="h-5 w-5 text-purple-400" />
                    Communication Channels
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {organization.earngpt_data.channels.map(
                      (channel, index) => (
                        <div
                          key={channel.channelId}
                          className="bg-gray-800/50 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-white">
                                {channel.title}
                              </h5>
                              <p className="text-sm text-gray-400 font-mono">
                                {channel.channelId}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleCopyToClipboard(
                                  channel.channelId,
                                  `Channel ${index + 1} ID`
                                )
                              }
                              className="h-6 w-6 p-0"
                            >
                              {copiedField === `Channel ${index + 1} ID` ? (
                                <CheckCircle className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Floors */}
      {organization.floors && organization.floors.length > 0 && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-green-400" />
              Floors ({organization.floors.length})
            </CardTitle>
            <CardDescription className="text-gray-400">
              Building floors and departments for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {organization.floors.map((floor) => (
                <div key={floor.id} className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-white">{floor.name}</h4>
                      <p className="text-sm text-gray-400">
                        Level {floor.level}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-gray-300 border-gray-600"
                    >
                      {floor.departments.length} departments
                    </Badge>
                  </div>
                  {floor.departments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {floor.departments.map((dept, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-blue-500/20 text-blue-300 border-blue-500/30"
                        >
                          {dept.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users */}
      {organization.users && organization.users.length > 0 && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Users ({organization.users.length})
            </CardTitle>
            <CardDescription className="text-gray-400">
              Members of this organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {organization.users.map((user) => (
                <div key={user.id} className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-white">
                          {user.name || "Unnamed User"}
                        </h4>
                        <p className="text-sm text-gray-400">{user.email}</p>
                        {user.department && (
                          <p className="text-xs text-gray-500">
                            {user.department}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          user.role === "founder" ? "default" : "secondary"
                        }
                        className={
                          user.role === "founder"
                            ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        }
                      >
                        {user.role}
                      </Badge>
                      {user.isVerified ? (
                        <UserCheck className="w-4 h-4 text-green-400" />
                      ) : (
                        <UserX className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sellable items — everything this office publishes across all six
          catalog kinds. Sits between Users and Invoice history so admins
          see what's for sale before seeing what's been billed. */}
      <SellableItemsCard
        loading={sellablesLoading}
        error={sellablesError}
        items={sellables}
        counts={sellablesCounts}
        filter={sellablesFilter}
        onFilterChange={setSellablesFilter}
        onRetry={loadSellables}
      />

      {/* Invoice history — paid + upcoming, links to the public invoice page */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-400" />
            Invoice history{invoicesTotal > 0 ? ` (${invoicesTotal})` : ""}
          </CardTitle>
          <CardDescription className="text-gray-400">
            All invoices billed to this organization — paid and upcoming.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading invoices…
            </div>
          ) : invoicesError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-rose-300 mb-3">{invoicesError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadInvoices(0, false)}
              >
                Try again
              </Button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-10 text-center">
              <Receipt className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                No invoices yet for this company.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-white/[0.06]">
                      <th className="py-2 pr-4 font-medium">Invoice #</th>
                      <th className="py-2 pr-4 font-medium">Item</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Created</th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const created = formatDate(inv.createdAt);
                      const invoiceHref = invoiceUrl(inv.id);
                      return (
                        <tr
                          key={inv.id}
                          className="border-b border-white/[0.06] hover:bg-gray-800/20 transition-colors"
                        >
                          <td className="py-3 pr-4 align-top">
                            <a
                              href={invoiceHref}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-xs text-white hover:text-amber-300 hover:underline"
                            >
                              {inv.invoiceNumber}
                            </a>
                            {inv.isRecurring && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-purple-300">
                                <Repeat className="w-3 h-3" />
                                {inv.recurringPaymentNumber
                                  ? `Cycle ${inv.recurringPaymentNumber}`
                                  : "Recurring"}
                                {inv.recurringPeriod
                                  ? ` · ${inv.recurringPeriod}`
                                  : ""}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <div className="text-white truncate max-w-[240px]">
                              {inv.itemName || "—"}
                            </div>
                            {inv.itemType && (
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                                {inv.itemType.replace(/_/g, " ")}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <span className="text-white font-medium tabular-nums">
                              {formatMoney(inv.totalAmount, inv.itemCurrency)}
                            </span>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <Badge
                              className={`${statusBadgeClass(
                                inv.status
                              )} border capitalize text-[10px]`}
                              variant="outline"
                            >
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <div className="text-gray-300">{created.date}</div>
                            <div className="text-[10px] text-gray-500">
                              {created.time}
                            </div>
                          </td>
                          <td className="py-3 pr-4 align-top text-right">
                            <a
                              href={invoiceHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              View
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {invoices.length < invoicesTotal && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadInvoices(invoices.length, true)}
                    disabled={invoicesLoadingMore}
                    className="bg-gray-900/60 border-gray-700 text-gray-200 hover:bg-gray-800"
                  >
                    {invoicesLoadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Loading…
                      </>
                    ) : (
                      <>Load {Math.min(INVOICES_PAGE_SIZE, invoicesTotal - invoices.length)} more</>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Timestamps */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-400" />
            Timestamps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300">
                Created At
              </label>
              <div className="mt-1">
                <div className="text-white">{dateInfo.full}</div>
                <div className="text-sm text-gray-400">
                  {dateInfo.date} at {dateInfo.time}
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300">
                Last Updated
              </label>
              <div className="mt-1">
                <div className="text-white">{updatedInfo.full}</div>
                <div className="text-sm text-gray-400">
                  {updatedInfo.date} at {updatedInfo.time}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ Sellable items ============ */

const KIND_META: Record<
  SellableKind,
  { label: string; pluralLabel: string; Icon: React.ComponentType<{ className?: string }>; iconColor: string }
> = {
  channel: {
    label: "Channel",
    pluralLabel: "Channels",
    Icon: Radio,
    iconColor: "text-purple-400",
  },
  workshop: {
    label: "Workshop",
    pluralLabel: "Workshops",
    Icon: CalendarDays,
    iconColor: "text-orange-400",
  },
  course: {
    label: "Course",
    pluralLabel: "Courses",
    Icon: GraduationCap,
    iconColor: "text-blue-400",
  },
  product: {
    label: "Product",
    pluralLabel: "Products",
    Icon: Package,
    iconColor: "text-emerald-400",
  },
  call: {
    label: "Call",
    pluralLabel: "Calls",
    Icon: Phone,
    iconColor: "text-cyan-400",
  },
  service: {
    label: "Service",
    pluralLabel: "Services",
    Icon: Wrench,
    iconColor: "text-yellow-400",
  },
};

// Status → badge color. Both "active" / "published" and the various
// draft/archived states show up across the six kinds; normalize here so
// the badge doesn't lie about draft-vs-live for one kind.
function sellableStatusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "active" || s === "published") {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  }
  if (s === "draft") {
    return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  }
  if (s === "archived" || s === "inactive") {
    return "bg-gray-500/15 text-gray-300 border-gray-500/30";
  }
  return "bg-gray-500/15 text-gray-300 border-gray-500/30";
}

// Prices live on each model in the shop's native units (not cents).
// `Intl.NumberFormat` with `currency` style handles the symbol + decimals
// per currency without us hard-coding `$` / `₹`.
function formatSellablePrice(amount: number, currency: string) {
  if (!amount || amount <= 0) return "Free";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
}

function SellableItemsCard({
  loading,
  error,
  items,
  counts,
  filter,
  onFilterChange,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  items: SellableItem[];
  counts: Record<SellableKind, number> | null;
  filter: SellableKind | "all";
  onFilterChange: (f: SellableKind | "all") => void;
  onRetry: () => void;
}) {
  const total = counts
    ? Object.values(counts).reduce((sum, n) => sum + n, 0)
    : items.length;
  const filtered = filter === "all" ? items : items.filter((i) => i.kind === filter);

  const filterButton = (k: SellableKind | "all", label: string, count: number) => {
    const active = filter === k;
    return (
      <button
        key={k}
        onClick={() => onFilterChange(k)}
        className={[
          "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
          active
            ? "bg-[#FBD10D]/15 text-[#FBD10D] border-[#FBD10D]/30"
            : "bg-[#1a1a22] text-[#c7c7da] border-[#2a2a35] hover:bg-[#15151b] hover:text-white",
        ].join(" ")}
      >
        {label}
        <span className={active ? "ml-1.5 text-[#FBD10D]/70" : "ml-1.5 text-[#5a5a72]"}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <Card className="bg-[#111116] border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-pink-400" />
          Sellable items{total > 0 ? ` (${total})` : ""}
        </CardTitle>
        <CardDescription className="text-gray-400">
          Every channel, workshop, course, product, call, and service this
          office publishes for sale.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading catalog…
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-rose-300 mb-3">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Retry
            </Button>
          </div>
        ) : total === 0 ? (
          <div className="border border-dashed border-gray-800 rounded-lg py-10 text-center">
            <ShoppingBag className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">This office hasn't listed any items yet.</p>
          </div>
        ) : (
          <>
            {/* Kind filter chips */}
            {counts && (
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                {filterButton("all", "All", total)}
                {(Object.keys(KIND_META) as SellableKind[]).map((k) =>
                  counts[k] > 0
                    ? filterButton(k, KIND_META[k].pluralLabel, counts[k])
                    : null
                )}
              </div>
            )}

            {/* Rows */}
            <div className="space-y-2">
              {filtered.map((item) => {
                const meta = KIND_META[item.kind];
                const Icon = meta.Icon;
                const created = new Date(item.createdAt);
                const subLabel =
                  item.kind === "channel" && item.isSubscription
                    ? ` / ${item.subscriptionPeriod || "recurring"}`
                    : item.kind === "call" && item.durationMinutes
                      ? ` · ${item.durationMinutes} min`
                      : "";
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/40 border border-gray-800 hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center shrink-0">
                      <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {item.title || "Untitled"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                        <span className="uppercase tracking-wide font-semibold text-gray-400">
                          {meta.label}
                        </span>
                        <span>·</span>
                        <span>{created.toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-semibold text-white">
                        {formatSellablePrice(item.price, item.currency)}
                        {subLabel && (
                          <span className="text-[11px] text-gray-500 font-normal">
                            {subLabel}
                          </span>
                        )}
                      </p>
                      <Badge
                        variant="outline"
                        className={`mt-1 text-[10px] px-1.5 py-0 ${sellableStatusBadgeClass(item.status)}`}
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
