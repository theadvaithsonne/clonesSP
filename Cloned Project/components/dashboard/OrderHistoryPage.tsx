"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Search,
  Grid,
  List,
  Filter,
  X,
  User,
  Calendar,
  ShoppingBag,
  BookOpen,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Truck,
  RefreshCcw,
  Link2,
} from "lucide-react";
import {
  getPurchaseHistory,
  type PurchaseItem,
} from "@/lib/feed-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function OrderHistoryPage() {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "course" | "product">("all");
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const limit = 20;

  // Fetch purchase history — accepts explicit offset so pagination buttons
  // don't read stale React state from the closure.
  const fetchPurchases = async (explicitOffset?: number) => {
    setLoading(true);
    try {
      const offset = explicitOffset !== undefined ? explicitOffset : currentOffset;
      const data = await getPurchaseHistory({
        limit,
        offset,
        type: typeFilter,
      });
      setPurchases(data.purchases);
      setTotal(data.total);
    } catch (err) {
      console.error("Error fetching purchases:", err);
      toast.error("Failed to load order history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentOffset(0);
    fetchPurchases(0);
  }, [typeFilter]);

  // Filtered purchases for search
  const filteredPurchases = searchQuery
    ? purchases.filter(
        (p) =>
          p.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : purchases;

  const formatPrice = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case "completed":
      case "delivered":
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
      case "processing":
      case "confirmed":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "shipped":
        return <Truck className="h-4 w-4 text-blue-500" />;
      case "failed":
      case "cancelled":
      case "refunded":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-[#9fa0b8]" />;
    }
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case "completed":
      case "delivered":
      case "paid":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pending":
      case "processing":
      case "confirmed":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "shipped":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "failed":
      case "cancelled":
      case "refunded":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-[#2a2a35] text-[#9fa0b8] border-[#2a2a35]";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "product":
        return <ShoppingBag className="h-4 w-4" />;
      case "course":
        return <BookOpen className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const clearFilters = () => {
    setTypeFilter("all");
  };

  const hasActiveFilters = typeFilter !== "all";
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(currentOffset / limit) + 1;

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
      {/* Header */}
      <div className="border-b border-[#2a2a35] bg-[#0e0e12] px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-brand" />
            <h1 className="text-xl font-semibold text-white">Order History</h1>
            {total > 0 && (
              <span className="text-sm text-[#9fa0b8]">
                ({total} total)
              </span>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-[#9fa0b8]"
            />
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentOffset(0);
                fetchPurchases(0);
              }}
              className="gap-2 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilterDrawer(true)}
              className={cn(
                "gap-2 hover:bg-[#1a1a22]",
                hasActiveFilters
                  ? "text-brand hover:text-brand"
                  : "text-[#9fa0b8] hover:text-white"
              )}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-brand" />
              )}
            </Button>
            <div className="h-6 w-px bg-[#2a2a35]" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2",
                viewMode === "grid"
                  ? "bg-[#1a1a22] text-brand"
                  : "text-[#9fa0b8]"
              )}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2",
                viewMode === "list"
                  ? "bg-[#1a1a22] text-brand"
                  : "text-[#9fa0b8]"
              )}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Orders Grid/List */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-[#9fa0b8] mb-4" />
              <p className="text-[#9fa0b8]">
                {searchQuery || hasActiveFilters
                  ? "No orders found"
                  : "No purchases yet"}
              </p>
              <p className="text-sm text-[#9fa0b8] mt-1">
                {searchQuery || hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Your course and product purchases will appear here"}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-2 text-brand hover:text-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPurchases.map((purchase) => (
                <PurchaseCard
                  key={purchase._id}
                  purchase={purchase}
                  formatPrice={formatPrice}
                  formatDate={formatDate}
                  getStatusColor={getStatusColor}
                  getTypeIcon={getTypeIcon}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPurchases.map((purchase) => (
                <PurchaseListItem
                  key={purchase._id}
                  purchase={purchase}
                  formatPrice={formatPrice}
                  formatDate={formatDate}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  getTypeIcon={getTypeIcon}
                  isExpanded={expandedOrderId === purchase._id}
                  onToggle={() =>
                    setExpandedOrderId(
                      expandedOrderId === purchase._id ? null : purchase._id
                    )
                  }
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-[#2a2a35]">
              <p className="text-xs sm:text-sm text-[#8a8a9e] font-medium">
                Showing <span className="text-white font-semibold">{currentOffset + 1}</span> to{" "}
                <span className="text-white font-semibold">{Math.min(currentOffset + limit, total)}</span> of{" "}
                <span className="text-white font-semibold">{total}</span> purchases
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOffset = Math.max(0, currentOffset - limit);
                    setCurrentOffset(newOffset);
                    fetchPurchases(newOffset);
                  }}
                  disabled={currentOffset === 0}
                  className="h-9 px-3 border-[#2a2a35] bg-[#0d0d11]/80 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] hover:border-[#3a3a4c] disabled:opacity-45 disabled:pointer-events-none transition-all rounded-lg flex items-center gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: Math.min(5, totalPages) },
                    (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      const isActive = currentPage === pageNum;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            const newOffset = (pageNum - 1) * limit;
                            setCurrentOffset(newOffset);
                            fetchPurchases(newOffset);
                          }}
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
                  onClick={() => {
                    const newOffset = currentOffset + limit;
                    setCurrentOffset(newOffset);
                    fetchPurchases(newOffset);
                  }}
                  disabled={currentOffset + limit >= total}
                  className="h-9 px-3 border-[#2a2a35] bg-[#0d0d11]/80 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] hover:border-[#3a3a4c] disabled:opacity-45 disabled:pointer-events-none transition-all rounded-lg flex items-center gap-1.5"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Drawer */}
      {showFilterDrawer && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowFilterDrawer(false)}
          />

          {/* Drawer */}
          <div className="relative ml-auto w-80 h-full bg-[#0e0e12] border-l border-[#2a2a35] flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a35]">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-brand" />
                <h2 className="text-lg font-semibold text-white">Filters</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilterDrawer(false)}
                className="p-2 text-[#9fa0b8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Type Filter */}
              <div>
                <h3 className="text-sm font-medium text-white mb-3">Type</h3>
                <div className="space-y-2">
                  {(["all", "product", "course"] as const).map((type) => (
                    <Button
                      key={type}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTypeFilter(type);
                        setShowFilterDrawer(false);
                      }}
                      className={cn(
                        "w-full justify-start text-sm gap-2",
                        typeFilter === type
                          ? "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
                          : "text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white"
                      )}
                    >
                      {type === "all" ? (
                        "All Types"
                      ) : (
                        <>
                          {type === "product" ? (
                            <ShoppingBag className="h-4 w-4" />
                          ) : (
                            <BookOpen className="h-4 w-4" />
                          )}
                          {type.charAt(0).toUpperCase() + type.slice(1)}s
                        </>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearFilters();
                    setShowFilterDrawer(false);
                  }}
                  className="w-full border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PurchaseCard({
  purchase,
  formatPrice,
  formatDate,
  getStatusColor,
  getTypeIcon,
}: {
  purchase: PurchaseItem;
  formatPrice: (amount: number, currency?: string) => string;
  formatDate: (date: string | Date) => string;
  getStatusColor: (status: string) => string;
  getTypeIcon: (type: string) => React.ReactNode;
}) {
  return (
    <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg overflow-hidden hover:border-brand transition-colors flex flex-col">
      {/* Order Image */}
      <div className="aspect-video bg-[#1a1a22] relative">
        {purchase.itemImage ? (
          <img
            src={purchase.itemImage}
            alt={purchase.itemName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#9fa0b8]">
            {getTypeIcon(purchase.type)}
          </div>
        )}
        <div
          className={cn(
            "absolute top-2 right-2 text-xs px-2 py-1 rounded-full font-medium border",
            getStatusColor(purchase.status)
          )}
        >
          {purchase.status}
        </div>
        <div className="absolute top-2 left-2 bg-[#1a1a22]/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
          {getTypeIcon(purchase.type)}
          {purchase.type}
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {/* Order Number */}
        <div className="flex items-center justify-between">
          {purchase.orderNumber && (
            <span className="text-xs text-brand font-mono">
              {purchase.orderNumber}
            </span>
          )}
          <span className="text-xs text-[#9fa0b8]">
            {formatDate(purchase.createdAt)}
          </span>
        </div>

        {/* Item Name */}
        <h3 className="text-white font-medium line-clamp-2">
          {purchase.itemName}
        </h3>

        {/* Seller (for courses) */}
        {purchase.seller && (
          <div className="flex items-center gap-2 text-sm text-[#9fa0b8]">
            <User className="h-4 w-4" />
            <span className="truncate">by {purchase.seller.name}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-brand">
            {formatPrice(purchase.amount, purchase.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

function PurchaseListItem({
  purchase,
  formatPrice,
  formatDate,
  getStatusColor,
  getStatusIcon,
  getTypeIcon,
  isExpanded,
  onToggle,
}: {
  purchase: PurchaseItem;
  formatPrice: (amount: number, currency?: string) => string;
  formatDate: (date: string | Date) => string;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getTypeIcon: (type: string) => React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg hover:border-brand transition-colors overflow-hidden">
      {/* Main Row */}
      <div
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex gap-4">
          {/* Order Image */}
          <div className="w-16 h-16 bg-[#1a1a22] rounded-lg flex-shrink-0 relative overflow-hidden">
            {purchase.itemImage ? (
              <img
                src={purchase.itemImage}
                alt={purchase.itemName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#9fa0b8]">
                {getTypeIcon(purchase.type)}
              </div>
            )}
          </div>

          {/* Order Info */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {purchase.orderNumber && (
                    <span className="text-sm text-brand font-mono">
                      {purchase.orderNumber}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium border",
                      getStatusColor(purchase.status)
                    )}
                  >
                    {purchase.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a22] text-[#9fa0b8] flex items-center gap-1">
                    {getTypeIcon(purchase.type)}
                    {purchase.type}
                  </span>
                </div>
                <h3 className="text-white font-medium mt-1 truncate">
                  {purchase.itemName}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-xs text-[#9fa0b8]">
                  {purchase.seller && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      by {purchase.seller.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(purchase.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-lg font-semibold text-brand">
                  {formatPrice(purchase.amount, purchase.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Expand Icon */}
          <button className="p-1 text-[#9fa0b8] hover:text-white transition-colors flex-shrink-0 self-center">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-[#2a2a35] bg-[#0a0a0c] p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Order Details */}
            <div>
              <h5 className="text-xs font-medium text-[#9fa0b8] uppercase tracking-wider mb-2">
                Order Details
              </h5>
              <div className="space-y-1 text-sm">
                <p className="text-[#9fa0b8]">
                  <span className="text-white">Type:</span>{" "}
                  <span className="capitalize">{purchase.type}</span>
                </p>
                {purchase.paymentId && (
                  <p className="text-[#9fa0b8]">
                    <span className="text-white">Payment ID:</span>{" "}
                    <span className="font-mono text-xs">{purchase.paymentId}</span>
                  </p>
                )}
                {purchase.paymentStatus && (
                  <p className="text-[#9fa0b8]">
                    <span className="text-white">Payment Status:</span>{" "}
                    <span className="capitalize">{purchase.paymentStatus}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Course Progress (for courses) */}
            {purchase.type === "course" && purchase.metadata && (
              <div>
                <h5 className="text-xs font-medium text-[#9fa0b8] uppercase tracking-wider mb-2">
                  Course Progress
                </h5>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#9fa0b8]">Progress</span>
                    <span className="text-white">{purchase.metadata.progressPercentage || 0}%</span>
                  </div>
                  <div className="w-full bg-[#1a1a22] rounded-full h-2">
                    <div
                      className="bg-brand h-2 rounded-full transition-all"
                      style={{ width: `${purchase.metadata.progressPercentage || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Shipping Info (for products) */}
            {purchase.type === "product" && purchase.metadata?.requiresShipping && (
              <div>
                <h5 className="text-xs font-medium text-[#9fa0b8] uppercase tracking-wider mb-2">
                  Shipping
                </h5>
                <div className="space-y-1 text-sm">
                  {purchase.metadata.trackingNumber ? (
                    <>
                      <p className="text-[#9fa0b8]">
                        <span className="text-white">Tracking:</span>{" "}
                        {purchase.metadata.trackingNumber}
                      </p>
                      {purchase.metadata.trackingUrl && (
                        <a
                          href={purchase.metadata.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand hover:underline flex items-center gap-1"
                        >
                          Track Package <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-[#9fa0b8]">Shipping information will be available soon</p>
                  )}
                </div>
              </div>
            )}

            {/* Product Items (for multi-item orders) */}
            {purchase.type === "product" && purchase.items && purchase.items.length > 1 && (
              <div className="md:col-span-2 lg:col-span-3">
                <h5 className="text-xs font-medium text-[#9fa0b8] uppercase tracking-wider mb-2">
                  Items ({purchase.items.length})
                </h5>
                <div className="space-y-2">
                  {purchase.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2 bg-[#0e0e12] rounded-lg"
                    >
                      {item.productImage && (
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-[#9fa0b8]">
                          Qty: {item.quantity} x {formatPrice(item.unitPrice, purchase.currency)}
                        </p>
                      </div>
                      <span className="text-sm text-brand">
                        {formatPrice(item.totalPrice, purchase.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Digital Downloads */}
            {purchase.type === "product" && purchase.items && purchase.items.some(item => item.digitalAssets && item.digitalAssets.length > 0) && (
              <div className="md:col-span-2 lg:col-span-3">
                <h5 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Download className="w-4 h-4 text-brand" />
                  Digital Downloads
                </h5>
                <div className="space-y-2">
                  {purchase.items.flatMap(item =>
                    (item.digitalAssets || []).map((asset, index) => (
                      <a
                        key={`${item.productId}-${index}`}
                        href={asset.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-[#0e0e12] border border-[#2a2a35] rounded-lg hover:border-brand hover:bg-[#1a1a22] transition-colors group"
                      >
                        <div className="w-10 h-10 bg-[#1a1a22] rounded-lg flex items-center justify-center group-hover:bg-brand/20 transition-colors">
                          <Download className="w-5 h-5 text-[#9fa0b8] group-hover:text-brand" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{asset.name}</p>
                          <p className="text-xs text-[#9fa0b8] uppercase">{asset.fileType}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-[#9fa0b8] group-hover:text-brand" />
                      </a>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Digital Links */}
            {purchase.type === "product" && purchase.items && purchase.items.some(item => item.digitalLinks && item.digitalLinks.length > 0) && (
              <div className="md:col-span-2 lg:col-span-3">
                <h5 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-purple-400" />
                  Access Links
                </h5>
                <div className="space-y-2">
                  {purchase.items.flatMap(item =>
                    (item.digitalLinks || []).map((link, index) => (
                      <a
                        key={`${item.productId}-link-${index}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-[#0e0e12] border border-[#2a2a35] rounded-lg hover:border-purple-400 hover:bg-[#1a1a22] transition-colors group"
                        title={link.description}
                      >
                        <div className="w-10 h-10 bg-[#1a1a22] rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                          <Link2 className="w-5 h-5 text-[#9fa0b8] group-hover:text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">{link.label}</p>
                            {(link as any).isCustomLink && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">via referral</span>
                            )}
                          </div>
                          {link.description && <p className="text-xs text-[#9fa0b8]">{link.description}</p>}
                        </div>
                        <ExternalLink className="w-4 h-4 text-[#9fa0b8] group-hover:text-purple-400" />
                      </a>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
