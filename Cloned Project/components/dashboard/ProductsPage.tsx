"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  ShoppingBag,
  Search,
  Grid,
  List,
  ShoppingCart,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  FileText,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Upload,
  Loader2,
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Tag,
  Boxes,
  DollarSign,
  Download,
  ClipboardList,
  User,
  MapPin,
  Phone,
  Link2,
  Star,
  HelpCircle,
  MessageSquare,
  Layers,
  CheckCircle,
  Sparkles,
  Table,
  GripVertical,
  Image,
  ImageIcon,
  Play,
  CreditCard,
  Briefcase,
  Compass,
  Info,
  Lock,
  Folder,
  FolderOpen,
  File,
  ExternalLink,
  Video,
  Apple,
  Smartphone,
  Shield,
  Check,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getMyProductOrders,
  getAllProductOrders,
  getProductOrderStats,
  updateProductOrderStatus,
  getOrgChannels,
  type Channel,
  type Product,
  type ProductOrder,
  type ProductOrderStats,
  type ProductKeyFeature,
  type ProductWhatsInsideGroup,
  type ProductReview,
  type ProductFaq,
  type ProductDetailEntry,
  type DynamicLinkInfo,
  getMyProductLinks,
  setMyProductLink,
  deleteMyProductLink,
  getCombPlanForItem,
  getCombPlanForItemPublic,
  getChannelSubscribers,
} from "@/lib/feed-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, stripHtml } from "@/lib/utils";
import { ChannelMultiSelect } from "@/components/shared/ChannelMultiSelect";
import DescriptionEditor from "./DescriptionEditor";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import { CurrencyDropdown } from "./WorkshopsPage";
import { getToken } from "@/lib/auth";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import { toast } from "sonner";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { ReservesPanel } from "@/components/dashboard/ReservesPanel";
import ProductThankYouPageEditor from "@/components/dashboard/ProductThankYouPageEditor";
import { CommissionPlanSection, saveCommissionPlan, CompPlanDisplay, CompPlanBadge } from "./CommissionPlanSection";
import { api, API_URL } from "@/lib/api";
import { getPageCache, setPageCache, invalidatePageCache } from "@/lib/revenue-network-cache";
import { CardRatingRow, RatingsReviewsCard } from "@/components/reviews";
import { useRatingSummaries } from "@/lib/hooks/useRatingSummaries";
import type { RatingSummary } from "@/lib/reviews-api";
import { ProductEmailAlertsSection } from "@/components/dashboard/products/ProductEmailAlertsSection";
import { FounderAlertsSection } from "@/components/dashboard/products/FounderAlertsSection";
import { useFounderAlerts } from "@/components/dashboard/products/useFounderAlerts";
import { useEmailAlerts } from "@/components/dashboard/products/useEmailAlerts";
import { MAX_FAQS, MAX_KEY_FEATURES, limitReachedLabel } from "@/lib/form-limits";
import { getBrandHex } from "@/lib/brand-color-context";
import {
  formatSellablePrice,
  garageStorefrontUrl,
  showSellablePublished,
  subscriptionUnit,
} from "@/components/shared/SellablePublishedModal";

interface ProductsPageProps {
  initialTab?: "products" | "orders" | "reserves";
  viewRole?: "customer" | "founder";
}

export function ProductsPage({ initialTab = "products", viewRole }: ProductsPageProps = {}) {
  const { amIFounder, loading: founderLoading } = useAmIFounder();
  const isFounderMode = viewRole === "founder";
  const [products, setProducts] = useState<Product[]>([]);
  // One batched request for every visible product card's rating.
  const ratingSummaries = useRatingSummaries(
    "product",
    products.map((p) => p._id)
  );
  const [loading, setLoading] = useState(true);
  const [affiliateId, setAffiliateId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "active" | "draft" | "archived" | "digital" | "physical">("all");
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "reserves">(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Product detail/edit view state
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Order state
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderStats, setOrderStats] = useState<ProductOrderStats | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  // Right-side drawer: founder designs the buyer's post-payment page.
  const [thankYouTarget, setThankYouTarget] = useState<Product | null>(null);

  useEffect(() => {
    if (showCreateModal || !!editingProduct || !!viewingProduct) {
      window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    } else {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [showCreateModal, editingProduct, viewingProduct]);

  // Synchronize path changes with global dashboard breadcrumbs
  useEffect(() => {
    const items: { label: string; key: string }[] = [];

    if (editingProduct) {
      items.push({
        label: editingProduct.name || "Edit Product",
        key: "edit-product",
      });
    } else if (viewingProduct) {
      items.push({
        label: viewingProduct.name || "Product Details",
        key: "view-product",
      });
    }

    window.dispatchEvent(
      new CustomEvent("workspace:set-breadcrumbs", {
        detail: { items },
      })
    );
  }, [editingProduct, viewingProduct]);

  // Handle breadcrumb clicks from the dashboard layout header
  useEffect(() => {
    const handleBreadcrumbClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ label: string; key: string; index: number }>;
      const { key } = customEvent.detail;

      if (key === "root") {
        setEditingProduct(null);
        setViewingProduct(null);
      }
    };

    window.addEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    return () => {
      window.removeEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleOpenCreateModal = () => {
      setShowCreateModal(true);
    };
    window.addEventListener("products:open-create-modal", handleOpenCreateModal);
    return () => {
      window.removeEventListener("products:open-create-modal", handleOpenCreateModal);
    };
  }, []);


  // Fetch products
  useEffect(() => {
    const fetchData = async () => {
      if (founderLoading) return;

      const cacheKey = `products:${isFounderMode ? "founder" : "stakeholder"}`;
      const cached = getPageCache<{ products: typeof products }>(cacheKey);
      if (cached) {
        setProducts(cached.products);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const data = await getProducts({ status: isFounderMode ? "all" : "active" });
        setProducts(data.products);
        setPageCache(cacheKey, { products: data.products });
      } catch (error) {
        console.error("Error fetching products:", error);
        if (!cached) toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isFounderMode, founderLoading]);

  // Fetch orders when tab changes
  useEffect(() => {
    if (activeTab !== "orders") return;

    const fetchOrders = async () => {
      setLoadingOrders(true);
      try {
        if (isFounderMode) {
          const [ordersData, statsData] = await Promise.all([
            getAllProductOrders(),
            getProductOrderStats(),
          ]);
          setOrders(ordersData.orders);
          setOrderStats(statsData);
        } else {
          const data = await getMyProductOrders();
          setOrders(data.orders || []);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        toast.error("Failed to load orders");
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [activeTab, isFounderMode]);

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

  // Filter products
  const filteredProducts = products.filter((product) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        product.name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.tags?.some((tag) => tag?.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Status/type filter
    if (selectedFilter === "active" && product.status !== "active") return false;
    if (selectedFilter === "draft" && product.status !== "draft") return false;
    if (selectedFilter === "archived" && product.status !== "archived") return false;
    if (selectedFilter === "digital" && !product.isDigital) return false;
    if (selectedFilter === "physical" && product.isDigital) return false;

    return true;
  });

  // Open product edit view (founder)
  const openProductEdit = async (product: Product) => {
    try {
      const data = await getProduct(product._id);
      setEditingProduct(data.product);
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Failed to load product details");
    }
  };

  // Open product detail view (stakeholder)
  const openProductDetail = async (product: Product) => {
    try {
      const data = await getProduct(product._id);
      setViewingProduct(data.product);
      setActiveImageIndex(0);
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Failed to load product details");
    }
  };

  // Handle product card action
  const handleProductAction = (product: Product) => {
    if (isFounderMode) {
      openProductEdit(product);
    } else {
      openProductDetail(product);
    }
  };

  // Handle delete product
  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p._id !== productId));
      invalidatePageCache("products:");
      toast.success("Product deleted successfully");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    }
  };

  // Refresh products
  const refreshProducts = async () => {
    try {
      invalidatePageCache("products:");
      const data = await getProducts({ status: isFounderMode ? "all" : "active" });
      setProducts(data.products);
      setPageCache(`products:${isFounderMode ? "founder" : "stakeholder"}`, { products: data.products });
    } catch (error) {
      console.error("Error refreshing products:", error);
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
          <div className="h-6 w-36 bg-[#1a1a22] rounded mb-2" />
          <div className="h-4 w-56 bg-[#1a1a22] rounded" />
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#0e0e12] border border-[#2a2a35] p-4 animate-pulse space-y-3">
              <div className="h-36 bg-[#1a1a22] rounded-lg" />
              <div className="h-4 bg-[#1a1a22] rounded w-3/4" />
              <div className="h-3 bg-[#1a1a22] rounded w-1/2" />
              <div className="flex justify-between items-center">
                <div className="h-5 bg-[#1a1a22] rounded w-16" />
                <div className="h-8 bg-[#1a1a22] rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }



  // Product Detail View (Stakeholder)
  if (viewingProduct && !isFounderMode) {
    return (
      <ProductDetailView
        product={viewingProduct}
        products={products}
        affiliateId={affiliateId}
        onBack={() => setViewingProduct(null)}
        formatCurrency={formatCurrency}
      />
    );
  }

  // Main List View
  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d]">

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === "reserves" ? (
            // Reserves Tab — product units bought "to assign", redeemable to others.
            <ReservesPanel itemType="product" />
          ) : activeTab === "products" ? (
            // Products Tab
            <>
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4">
                  <ShoppingBag className="h-10 w-10 sm:h-12 sm:w-12 text-[#9fa0b8] mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-[#9fa0b8]">
                    {searchQuery || selectedFilter !== "all" ? "No products found" : "No products available"}
                  </p>
                  {isFounderMode && !searchQuery && selectedFilter === "all" && (
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-3 sm:mt-4 bg-brand hover:opacity-90 text-brand-foreground text-sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Product
                    </Button>
                  )}
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      ratingSummary={ratingSummaries[product._id]}
                      isFounder={isFounderMode}
                      affiliateId={affiliateId}
                      onAction={() => handleProductAction(product)}
                      onEdit={() => openProductEdit(product)}
                      onDelete={() => setShowDeleteConfirm(product._id)}
                      onDesignThankYouPage={setThankYouTarget}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      ratingSummary={ratingSummaries[product._id]}
                      isFounder={isFounderMode}
                      affiliateId={affiliateId}
                      onAction={() => handleProductAction(product)}
                      onEdit={() => openProductEdit(product)}
                      onDelete={() => setShowDeleteConfirm(product._id)}
                      onDesignThankYouPage={setThankYouTarget}
                      formatCurrency={formatCurrency}
                      isListView
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            // Orders Tab
            <OrdersView
              orders={orders}
              loading={loadingOrders}
              isFounder={isFounderMode}
              stats={orderStats}
              formatCurrency={formatCurrency}
              products={products}
              onRefresh={async () => {
                setLoadingOrders(true);
                try {
                  if (isFounderMode) {
                    const [ordersData, statsData] = await Promise.all([
                      getAllProductOrders(),
                      getProductOrderStats(),
                    ]);
                    setOrders(ordersData.orders);
                    setOrderStats(statsData);
                  } else {
                    const data = await getMyProductOrders();
                    setOrders(data.orders);
                  }
                } finally {
                  setLoadingOrders(false);
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Filter Drawer */}
      {showFilterDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFilterDrawer(false)} />
          <div className="relative ml-auto w-80 h-full bg-[#0e0e12] border-l border-[#2a2a35] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a35]">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-brand" />
                <h2 className="text-lg font-semibold text-white">Filters</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowFilterDrawer(false)} className="p-2 text-[#9fa0b8] hover:text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-white mb-3">Status</h3>
                <div className="space-y-2">
                  {(isFounderMode ? ["all", "active", "draft", "archived"] : ["all", "digital", "physical"]).map((filter) => (
                    <Button
                      key={filter}
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFilter(filter as typeof selectedFilter)}
                      className={cn(
                        "w-full justify-start text-sm capitalize",
                        selectedFilter === filter
                          ? "bg-brand text-brand-foreground hover:opacity-90"
                          : "text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white"
                      )}
                    >
                      {filter === "all" ? "All Products" : filter}
                    </Button>
                  ))}
                </div>
              </div>

              {selectedFilter !== "all" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFilter("all")}
                  className="w-full border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thank You Page Editor drawer (founder-only) */}
      <ProductThankYouPageEditor
        item={thankYouTarget}
        itemType="product"
        open={!!thankYouTarget}
        onClose={() => setThankYouTarget(null)}
        onSaved={(updated) => {
          // itemType="product" always returns a Product from the editor.
          const p = updated as typeof thankYouTarget;
          if (!p) return;
          setProducts((prev) =>
            prev.map((it) => (it._id === p._id ? p : it)),
          );
        }}
      />

      {/* Product Form Modal (Create / Edit) */}
      <CreateProductModal
        isOpen={showCreateModal || !!editingProduct}
        product={editingProduct}
        onDelete={() => editingProduct && setShowDeleteConfirm(editingProduct._id)}
        onClose={() => {
          setShowCreateModal(false);
          if (editingProduct) {
            setEditingProduct(null);
            refreshProducts();
          }
        }}
        onSuccess={(prod) => {
          invalidatePageCache("products:");
          if (editingProduct) {
            setProducts((prev) => prev.map((p) => (p._id === prod._id ? prod : p)));
            setEditingProduct(null);
          } else {
            setProducts((prev) => [prod, ...prev]);
            setShowCreateModal(false);
          }
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <AlertDialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[600]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Product</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8]">
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#2a2a35]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteConfirm && handleDeleteProduct(showDeleteConfirm)}
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

// Product Card Component
function ProductCard({
  product,
  isFounder,
  affiliateId,
  onAction,
  onEdit,
  onDelete,
  onDesignThankYouPage,
  formatCurrency,
  isListView = false,
  ratingSummary,
}: {
  product: Product;
  isFounder: boolean;
  affiliateId: string;
  onAction: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDesignThankYouPage?: (product: Product) => void;
  formatCurrency: (value: number, currency?: string) => string;
  isListView?: boolean;
  /** Undefined while the batched rating summaries are still loading. */
  ratingSummary?: RatingSummary;
}) {
  // No discount concept in this app: a product is either free or paid; `price` is
  // the single source of truth (0 = free).
  const displayPrice = product.price;
  const isLowStock =
    product.trackQuantity &&
    product.quantity !== undefined &&
    product.lowStockThreshold &&
    product.quantity <= product.lowStockThreshold &&
    product.quantity > 0;
  const isOutOfStock = product.trackQuantity && product.quantity === 0;

  const getButtonText = () => {
    if (isFounder) return "Edit Product";
    if (isOutOfStock) return "Out of Stock";
    return "View Details";
  };

  if (isListView) {
    return (
      <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-4 hover:border-brand transition-colors">
        <div className="flex gap-4">
          <div className="w-32 h-32 bg-[#1a1a22] rounded-lg flex-shrink-0 relative">
            {product.images && product.images.length > 0 ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="h-8 w-8 text-[#9fa0b8]" />
              </div>
            )}
            {isFounder && (
              <div className={cn(
                "absolute top-2 left-2 text-xs px-2 py-1 rounded-full",
                product.status === "active" ? "bg-green-500/20 text-green-400" :
                  product.status === "draft" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-500/20 text-gray-400"
              )}>
                {product.status}
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {product.categoryName && (
                  <span className="text-xs text-brand">{product.categoryName}</span>
                )}
                <h3 className="text-white font-medium mt-1">{product.name}</h3>
                {product.description && (
                  <div
                    dangerouslySetInnerHTML={{ __html: sanitizeDescription(product.description) }}
                    className="text-sm text-[#9fa0b8] mt-2 line-clamp-2 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4 [&_a]:text-brand [&_a]:underline [&_a]:pointer-events-none"
                  />
                )}
                <div className="flex items-center gap-2 mt-2">
                  {product.isDigital && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">Digital</span>
                  )}
                  {product.digitalLinks?.some(l => l.linkType === "dynamic") && (
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">Dynamic Links</span>
                  )}
                  {product.requiresShipping && (
                    <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">Physical</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-xl font-semibold text-brand">
                    {displayPrice === 0 ? "Free" : formatCurrency(displayPrice, product.currency)}
                  </span>
                </div>
                {isOutOfStock && <div className="text-sm text-red-400">Out of Stock</div>}
                {isLowStock && <div className="text-sm text-orange-400">Only {product.quantity} left!</div>}
                <div className="flex items-center gap-2">
                  <Button onClick={onAction} className="bg-brand hover:opacity-90 text-brand-foreground">
                    {isFounder ? <Edit className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {getButtonText()}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 text-[#9fa0b8] hover:text-brand"
                    onClick={() => {
                      const isDigital = product.isDigital || product.deliveryMethod === "digital";
                      const baseUrl = isDigital
                        ? `https://www.garage.app/digital/product/${product._id}`
                        : `${window.location.origin}/checkout/product/${product._id}`;
                      const link = affiliateId ? `${baseUrl}?ref=${affiliateId}` : baseUrl;
                      navigator.clipboard.writeText(link);
                      toast.success("Checkout link copied!");
                    }}
                    title="Copy Checkout Link"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  {isFounder && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-2 text-[#9fa0b8] hover:text-white">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1a22] border-[#2a2a35]">
                        <DropdownMenuItem onClick={onEdit} className="text-white hover:bg-[#2a2a35]">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onDelete} className="text-red-400 hover:bg-[#2a2a35]">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [hasPlan, setHasPlan] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPlan = async () => {
      try {
        const result = await getCombPlanForItem("product", product._id);
        console.log("[DEBUG] ProductCard checkPlan:", {
          name: product.name,
          id: product._id,
          price: product.price,
          result
        });
        if (result?.plan && result.plan.levels && result.plan.levels.length > 0) {
          setHasPlan(true);
        } else {
          setHasPlan(false);
        }
      } catch (err) {
        console.error("[DEBUG] ProductCard checkPlan error:", product.name, err);
        setHasPlan(false);
      }
    };
    checkPlan();
  }, [product._id]);

  const getBoughtCount = () => {
    const count = product.downloadCount || 0;
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace(".0", "")}k`;
    }
    return count.toString();
  };

  const getBannerText = () => {
    if (hasPlan && product.price > 0) {
      return "Find out how much you can Earn";
    }
    return "No commissions paid for this product";
  };

  const handleAffiliateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("right-panel:open-information", {
        detail: {
          type: "affiliate",
          product,
          itemType: "product",
          affiliateId,
        },
      })
    );
  };

  const handleCommissionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("right-panel:open-information", {
        detail: {
          type: "commission",
          product,
          itemType: "product",
          affiliateId,
        },
      })
    );
  };

  if (isListView) {
    return (
      <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-4 hover:border-brand transition-colors">
        <div className="flex gap-4">
          <div className="w-32 h-32 bg-[#1a1a22] rounded-lg flex-shrink-0 relative">
            {product.images && product.images.length > 0 ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="h-8 w-8 text-[#9fa0b8]" />
              </div>
            )}
            {isFounder && (
              <div className={cn(
                "absolute top-2 left-2 text-xs px-2 py-1 rounded-full",
                product.status === "active" ? "bg-green-500/20 text-green-400" :
                  product.status === "draft" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-500/20 text-gray-400"
              )}>
                {product.status}
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {product.categoryName && (
                  <span className="text-xs text-brand">{product.categoryName}</span>
                )}
                <h3 className="text-white font-medium mt-1">{product.name}</h3>
                {product.description && (
                  <div
                    dangerouslySetInnerHTML={{ __html: sanitizeDescription(product.description) }}
                    className="text-sm text-[#9fa0b8] mt-2 line-clamp-2 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4 [&_a]:text-brand [&_a]:underline [&_a]:pointer-events-none"
                  />
                )}
                <div className="flex items-center gap-2 mt-2">
                  {product.isDigital && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">Digital</span>
                  )}
                  {product.digitalLinks?.some(l => l.linkType === "dynamic") && (
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">Dynamic Links</span>
                  )}
                  {product.requiresShipping && (
                    <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">Physical</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-xl font-semibold text-brand">
                    {displayPrice === 0 ? "Free" : formatCurrency(displayPrice, product.currency)}
                  </span>
                </div>
                {isOutOfStock && <div className="text-sm text-red-400">Out of Stock</div>}
                {isLowStock && <div className="text-sm text-orange-400">Only {product.quantity} left!</div>}
                <div className="flex items-center gap-2">
                  <Button onClick={onAction} className="bg-brand hover:opacity-90 text-brand-foreground">
                    {isFounder ? <Edit className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {getButtonText()}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 text-[#9fa0b8] hover:text-brand"
                    onClick={handleAffiliateClick}
                    title="Affiliate Link"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  {isFounder && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-2 text-[#9fa0b8] hover:text-white">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1a22] border-[#2a2a35]">
                        <DropdownMenuItem onClick={onEdit} className="text-white hover:bg-[#2a2a35]">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onDelete} className="text-red-400 hover:bg-[#2a2a35]">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onAction}
      className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl overflow-hidden hover:border-brand transition-all flex flex-col h-full shadow-lg relative group cursor-pointer"
    >
      {/* Product Image (Widescreen) */}
      <div className="relative aspect-[16/10] bg-[#1a1a22] overflow-hidden shrink-0">
        {product.images && product.images.length > 0 ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-[#9fa0b8]" />
          </div>
        )}
        {product.isDigital && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span className="bg-blue-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              Digital
            </span>
          </div>
        )}
        {isFounder && (
          <div className={cn(
            "absolute bottom-3 left-3 text-[9px] font-bold px-2 py-0.5 rounded-full",
            product.status === "active" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
              product.status === "draft" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                "bg-gray-500/20 text-gray-400 border border-gray-500/30"
          )}>
            {product.status.toUpperCase()}
          </div>
        )}
      </div>

      {/* Product Card Content */}
      <div className="p-4 flex-1 flex flex-col gap-3.5 select-none">
        <div className="space-y-1.5">
          <h3 className="text-white font-bold text-[15px] leading-tight line-clamp-1">{product.name}</h3>
          <div className="h-[36px] overflow-hidden">
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(product.description || "") }}
              className="text-[#9fa0b8] text-xs font-normal leading-relaxed line-clamp-2 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4 [&_a]:text-brand [&_a]:underline [&_a]:pointer-events-none"
            />
          </div>
        </div>

        {/* Social Proof (Customers Bought) */}
        {!isFounder && (
          <div className="flex items-center gap-2 mt-0.5 min-h-[20px]">
            {product.downloadCount && product.downloadCount > 0 ? (
              <>
                <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                  <img 
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${product.name}&backgroundColor=ff7b72`} 
                    alt="avatar" 
                    className="h-5 w-5 rounded-full border border-[#0e0e12] shadow-sm select-none"
                  />
                  <img 
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${product._id}&backgroundColor=79c0ff`} 
                    alt="avatar" 
                    className="h-5 w-5 rounded-full border border-[#0e0e12] shadow-sm select-none"
                  />
                </div>
                <span className="text-[10px] text-[#9fa0b8] font-normal leading-none">
                  {getBoughtCount()} Customers bought this product
                </span>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-brand shrink-0" />
                <span className="text-[10px] text-[#9fa0b8] font-semibold leading-none">
                  {displayPrice === 0 ? "Be the first to join!" : product.isSubscription ? "Be the first to sign up!" : "Be the first to buy!"}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Founder-only: subtle text link into the post-purchase page editor.
            Digital-delivery products ONLY — physical goods rely on shipping
            for the post-purchase touchpoint, and the buyer-side card is
            gated the same way, so offering configuration here for a
            physical product would silently do nothing. */}
        {isFounder &&
          onDesignThankYouPage &&
          (product.isDigital ||
            product.deliveryMethod === "digital" ||
            product.deliveryMethod === "both") && (
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDesignThankYouPage(product);
              }}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-[#9fa0b8] hover:text-brand transition-colors group"
            >
              <Sparkles className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
              <span className="underline underline-offset-2 decoration-dotted decoration-[#4a4a55] group-hover:decoration-brand">
                Edit post-purchase page
              </span>
              {product.thankYouPage && (
                <span className="ml-1 text-[9px] uppercase tracking-wider text-brand/80">
                  · configured
                </span>
              )}
            </button>
          </div>
        )}

        {/* Price & Primary Action Button Row */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#2a2a35]/50">
          <div className="flex flex-col">
            {displayPrice === 0 ? (
              <span className={cn("text-[13px] font-bold leading-tight", !isFounder ? "text-white" : "text-brand")}>Free to join</span>
            ) : (
              <div className="flex flex-col">
                {!isFounder ? (
                  <span className="text-[15px] font-bold text-white leading-tight">
                    {formatCurrency(displayPrice, product.currency)}
                    {product.isSubscription && <span className="text-[11px] font-normal">/Month</span>}
                  </span>
                ) : (
                  <span className="text-[14px] font-bold text-white leading-tight">
                    {formatCurrency(displayPrice, product.currency)}
                    {product.isSubscription && <span className="text-[9px] text-[#9fa0b8] font-normal">/Month</span>}
                  </span>
                )}
              </div>
            )}
          </div>

          {!isFounder ? (
            <button 
              onClick={handleAffiliateClick}
              className="py-1.5 px-4 border border-white/20 hover:border-white hover:bg-[#1a1a22] text-white text-[11px] font-semibold rounded-full flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span>Affiliate Link</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
              disabled={isOutOfStock}
              className="py-2 px-4 text-black text-[11px] font-bold rounded-full transition-all shrink-0 cursor-pointer shadow-md bg-white hover:bg-gray-100"
            >
              Edit Details
            </button>
          )}
        </div>

        {/* Ratings row */}
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <CardRatingRow
            targetType="product"
            targetId={product._id}
            targetName={product.name}
            summary={ratingSummary}
          />
        </div>
      </div>

      {/* Card Bottom Banner (Earnings Info) */}
      <div className="w-full mt-auto border-t border-[#2a2a35]/50 overflow-hidden shrink-0">
        {hasPlan === null ? (
          <div className="bg-[#2a2a35]/40 text-white/40 text-[11px] sm:text-xs font-medium h-[36px] flex items-center justify-center text-center animate-pulse whitespace-nowrap overflow-hidden text-ellipsis">
            Checking commission structure...
          </div>
        ) : (hasPlan && product.price > 0) ? (
          <div className="bg-brand text-brand-foreground text-[11px] sm:text-xs font-bold h-[36px] flex items-center justify-center text-center px-2">
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
              id={`my-find-out-earn-btn-${product._id}`}
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("right-panel:open-information", {
                    detail: {
                      type: "commission",
                      product: product,
                      itemType: "product",
                      affiliateId: affiliateId,
                    },
                  })
                );
              }}
              className="earn-btn-my cursor-pointer font-bold transition-all duration-200 active:scale-[0.98] hover:opacity-80 inline-flex items-center justify-center bg-transparent border-none p-0 text-[11px] sm:text-xs whitespace-nowrap"
            >
              Find out how much you can earn <span className="animate-slide-arrow-my ml-1">→</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#5E5E5E] text-white/95 text-[11px] sm:text-xs font-bold h-[36px] flex items-center justify-center text-center px-2 whitespace-nowrap overflow-hidden text-ellipsis">
            No commissions paid for this product
          </div>
        )}
      </div>
    </div>
  );
}

// Create Product Modal - Full Screen Side Panel
// Create Product Modal - Redesigned Scrollable Dialog
function CreateProductModal({
  isOpen,
  onClose,
  onSuccess,
  onDelete,
  product,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: Product) => void;
  onDelete?: () => void;
  product?: Product | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [youtubeLink, setYoutubeLink] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [isDigital, setIsDigital] = useState(true);
  const [deliveryType, setDeliveryType] = useState<"file" | "link">("file");
  const [digitalAssets, setDigitalAssets] = useState<Array<{ name: string; fileUrl: string; fileType: string; fileSize?: number }>>([]);
  const [digitalLinks, setDigitalLinks] = useState<Array<{ label: string; url: string; description?: string; linkType?: "static" | "dynamic" }>>([]);
  const [price, setPrice] = useState<number>(0);
  const [currency, setCurrency] = useState("USD");
  // Tax + iOS surcharges. Default to inclusive so INR sellers don't
  // accidentally add 18% on top without their consent.
  const [gstInclusive, setGstInclusive] = useState<boolean>(true);
  const [requireIosPayment, setRequireIosPayment] = useState<boolean>(false);
  const [appleFeeInclusive, setAppleFeeInclusive] = useState<boolean>(false);
  const [isSubscription, setIsSubscription] = useState(false);
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [trackQuantity, setTrackQuantity] = useState(false);
  const [quantity, setQuantity] = useState<number>(0);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingDigitalAsset, setUploadingDigitalAsset] = useState(false);
  const [error, setError] = useState("");
  const [showPriceBreakdownModal, setShowPriceBreakdownModal] = useState(false);
  // Post-purchase order email — state, payload and validation live in the
  // shared hook so the course and community forms behave identically.
  const emailAlertsForm = useEmailAlerts();
  const founderAlertsForm = useFounderAlerts();

  const getAffiliateInfo = () => {
    if (typeof window !== "undefined" && (window as any).__commissionPlanInfo) {
      return (window as any).__commissionPlanInfo;
    }
    return { enabled: false, levels: [], totalCommission: 0 };
  };

  const getPriceDetails = () => {
    const p = price || 0;
    const symbol = currency === "INR" ? "₹" : "$";
    let baseWeb = p;
    let gstWeb = 0;
    let totalWeb = p;
    if (p > 0) {
      if (gstInclusive) {
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
    if (requireIosPayment && p > 0) {
      if (appleFeeInclusive) {
        totalIos = totalWeb;
        appleCut = totalWeb * 0.3;
      } else {
        totalIos = totalWeb / 0.7;
        appleCut = totalIos * 0.3;
      }
    }
    return { currency: symbol, baseWeb, gstWeb, totalWeb, totalIos, appleCut };
  };

  const getDetailedPriceBreakdown = () => {
    const priceVal = price || 0;
    const isInclusive = gstInclusive;
    const affInfo = getAffiliateInfo();
    const affPercent = affInfo.enabled ? affInfo.totalCommission : 0;
    
    const basePrice = isInclusive ? priceVal / 1.18 : priceVal;
    
    const nonIosAppleFee = 0;
    const nonIosGst = basePrice * 0.18;
    const nonIosCustomerPays = isInclusive ? priceVal : basePrice + nonIosGst;
    
    const nonIosGovGst = nonIosGst;
    const nonIosAppleDist = 0;
    const nonIosPlatformFee = basePrice * 0.05;
    const nonIosAffiliateCut = basePrice * (affPercent / 100);
    const nonIosYouReceive = basePrice - nonIosPlatformFee - nonIosAffiliateCut;
    
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
  const [whatsIncludedError, setWhatsIncludedError] = useState<string | null>(null);
  const [keyFeaturesError, setKeyFeaturesError] = useState<string | null>(null);
  const [faqsError, setFaqsError] = useState<string | null>(null);
  const [isFree, setIsFree] = useState(true);
  // Product detail page fields
  const [rating, setRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [downloadCount, setDownloadCount] = useState<number>(0);
  const [whatsIncluded, setWhatsIncluded] = useState<string[]>([""]);
  const [keyFeatures, setKeyFeatures] = useState<ProductKeyFeature[]>([
    { icon: "", title: "", description: "" }
  ]);
  const [whatsInside, setWhatsInside] = useState<ProductWhatsInsideGroup[]>([
    { icon: "", title: "", items: [""] }
  ]);
  const [reviews, setReviews] = useState<ProductReviewEntry[]>([]);
  const [faqs, setFaqs] = useState<FaqEntry[]>([
    { question: "", answer: "" }
  ]);
  const [productDetails, setProductDetails] = useState<ProductDetailEntry[]>([]);
  // Audience gating — product visible only to members of these channels
  // (empty = visible to every stakeholder). Enforced BE-side in
  // services/product.ts::getAvailableProducts + single-item access check.
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  // Private one-time offer picker — when `restrictToUsers` is on, only the
  // selected users see the product and each can buy it once. Candidate pool =
  // union of members of the currently-selected channels (fetched via
  // getChannelSubscribers per channel, deduped client-side). Cross-validates
  // with isSubscription on the backend (rejects the combo).
  const [restrictToUsers, setRestrictToUsers] = useState(false);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [channelMembers, setChannelMembers] = useState<
    Array<{ _id: string; name: string; email: string; profilePicture?: string }>
  >([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [createExpandedSections, setCreateExpandedSections] = useState<Record<string, boolean>>({});
  const [createUploadingReviewAvatar, setCreateUploadingReviewAvatar] = useState<number | null>(null);
  const [uploadingGroupIcon, setUploadingGroupIcon] = useState<number | null>(null);
  const [showEmojiPickerIdx, setShowEmojiPickerIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const digitalAssetInputRef = useRef<HTMLInputElement>(null);
  const createReviewAvatarInputRef = useRef<HTMLInputElement>(null);
  const groupIconInputRef = useRef<HTMLInputElement>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const popularEmojis = ["⭐", "🚀", "💡", "🔥", "💻", "🎨", "🛠️", "📈", "📦", "🔒", "⚡", "🎯", "💎", "📣"];

  const isPaid = price > 0;
  useEffect(() => {
    if (!isFree) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 150);
    }
  }, [isFree, isPaid]);

  useEffect(() => {
    if (!isOpen) return;

    if (product) {
      setName(product.name || "");
      setDescription(product.description || "");
      setImages(product.images || []);
      setVideos(product.videos || []);
      setYoutubeLink(product.youtubeLink || "");
      setYoutubeInput("");
      setIsDigital(product.isDigital !== undefined ? product.isDigital : true);
      
      if (product.digitalAssets && product.digitalAssets.length > 0) {
        setDeliveryType("file");
        setDigitalAssets(product.digitalAssets);
        setDigitalLinks([]);
      } else if (product.digitalLinks && product.digitalLinks.length > 0) {
        setDeliveryType("link");
        setDigitalLinks(product.digitalLinks);
        setDigitalAssets([]);
      } else {
        setDeliveryType("file");
        setDigitalAssets([]);
        setDigitalLinks([]);
      }

      setPrice(product.price || 0);
      setIsFree(!product.price);
      setCurrency(product.currency || "USD");
      setGstInclusive(
        (product as any).gstInclusive !== undefined
          ? !!(product as any).gstInclusive
          : true
      );
      setRequireIosPayment(!!(product as any).requireIosPayment);
      setAppleFeeInclusive(!!(product as any).appleFeeInclusive);
      setIsSubscription(product.isSubscription || false);
      setSubscriptionPeriod(product.subscriptionPeriod || "monthly");
      setTrackQuantity(product.trackQuantity || false);
      setQuantity(product.quantity || 0);
      setCategoryName(product.categoryName || "");
      setRating(product.rating || 0);
      setRatingCount(product.ratingCount || 0);
      setDownloadCount(product.downloadCount || 0);
      setWhatsIncluded(product.whatsIncluded && product.whatsIncluded.length > 0 ? product.whatsIncluded : [""]);
      setKeyFeatures(product.keyFeatures && product.keyFeatures.length > 0 ? product.keyFeatures : [{ icon: "", title: "", description: "" }]);
      setWhatsInside(product.whatsInside || []);
      setReviews(product.reviews || []);
      setFaqs(product.faqs && product.faqs.length > 0 ? product.faqs : [{ question: "", answer: "" }]);
      setProductDetails(product.productDetails || []);
      emailAlertsForm.hydrate(product.emailAlerts);
      founderAlertsForm.hydrate((product as any).founderAlerts);
      setChannelIds(
        ((product as any).channelIds || []).map((c: any) =>
          typeof c === "object" && c?._id ? c._id : String(c),
        ),
      );
      const existingAllowed = ((product as any).allowedUserIds || []).map(
        (u: any) => (typeof u === "object" && u?._id ? String(u._id) : String(u)),
      );
      setAllowedUserIds(existingAllowed);
      setRestrictToUsers(existingAllowed.length > 0);
    } else {
      resetForm();
    }
  }, [isOpen, product]);

  // Fetch the union of members across selected channels when the picker is
  // toggled on. Refetches when channelIds changes so removing a channel drops
  // its exclusive members from the pool. Backend: GET /feed/channels/:id/
  // subscribers (existing endpoint, one call per channel, dedupe here).
  useEffect(() => {
    if (!isOpen || !restrictToUsers) return;
    if (channelIds.length === 0) {
      setChannelMembers([]);
      return;
    }
    const orgId = typeof window !== "undefined"
      ? localStorage.getItem("garage_org_id")
      : null;
    if (!orgId) return;
    let cancelled = false;
    setLoadingMembers(true);
    Promise.all(
      channelIds.map((cid) =>
        getChannelSubscribers(cid, orgId, {
          limit: 100,
          membershipFilter: "active",
        }).catch(() => null),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const byId = new Map<string, { _id: string; name: string; email: string; profilePicture?: string }>();
        for (const r of results) {
          if (!r) continue;
          for (const s of r.subscribers || []) {
            if (!s.user?._id) continue;
            const uid = String(s.user._id);
            if (!byId.has(uid)) {
              byId.set(uid, {
                _id: uid,
                name: s.user.name || "",
                email: s.user.email || "",
                profilePicture: s.user.profilePicture,
              });
            }
          }
        }
        setChannelMembers(Array.from(byId.values()));
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load channel members");
      })
      .finally(() => {
        if (!cancelled) setLoadingMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, restrictToUsers, channelIds]);

  // Fetch the org's channels when the modal opens so the audience picker
  // has options. Not fetched at ProductsPage root because the modal is
  // conditionally mounted.
  useEffect(() => {
    if (!isOpen) return;
    const orgId = typeof window !== "undefined"
      ? localStorage.getItem("garage_org_id")
      : null;
    if (!orgId) return;
    let cancelled = false;
    getOrgChannels(orgId)
      .then((res) => {
        if (!cancelled) setChannels(res.channels || []);
      })
      .catch((err) => {
        console.error("Failed to fetch channels for product picker:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    // Find and lock all scrollable ancestor containers to prevent double scrollbar
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
  }, [isOpen]);

  const toggleCreateSection = (section: string) => {
    setCreateExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleIconUpload = async (file: File, type: "group", idx: number) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Icon must be less than 2MB");
      return;
    }
    setUploadingGroupIcon(idx);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const token = getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formDataUpload,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      const updated = [...whatsInside];
      updated[idx] = { ...updated[idx], icon: data.url };
      setWhatsInside(updated);
      toast.success("Icon uploaded");
    } catch {
      toast.error("Failed to upload icon");
    } finally {
      setUploadingGroupIcon(null);
      if (groupIconInputRef.current) groupIconInputRef.current.value = "";
    }
  };

  function resetForm() {
    setName("");
    setDescription("");
    setImages([]);
    setVideos([]);
    setYoutubeLink("");
    setYoutubeInput("");
    setIsDigital(true);
    setDeliveryType("file");
    setDigitalAssets([]);
    setDigitalLinks([]);
    setPrice(0);
    setCurrency("USD");
    setIsSubscription(false);
    setSubscriptionPeriod("monthly");
    setTrackQuantity(false);
    setQuantity(0);
    setCategoryName("");
    setError("");
    setWhatsIncludedError(null);
    setKeyFeaturesError(null);
    setFaqsError(null);
    setIsFree(true);
    setRating(0);
    setRatingCount(0);
    setDownloadCount(0);
    setWhatsIncluded([""]);
    setKeyFeatures([{ icon: "", title: "", description: "" }]);
    setWhatsInside([]);
    setReviews([]);
    setFaqs([{ question: "", answer: "" }]);
    setProductDetails([]);
    setChannelIds([]);
    setRestrictToUsers(false);
    setAllowedUserIds([]);
    setChannelMembers([]);
    setMemberSearchQuery("");
    setCreateExpandedSections({});
    setCreateUploadingReviewAvatar(null);
    setUploadingGroupIcon(null);
    emailAlertsForm.reset();
    founderAlertsForm.reset();
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const token = getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formDataUpload,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setImages((prev) => {
        const next = [...prev];
        next[0] = data.url;
        return next;
      });
      toast.success("Cover image uploaded successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentCount = images.length - 1; // index 0 is cover
    if (currentCount >= 3) {
      toast.error("You can upload a maximum of 3 gallery images");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingGallery(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const token = getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formDataUpload,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setImages((prev) => [...prev, data.url]);
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataUpload,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setVideos([data.url]);
      setYoutubeLink("");
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
    setVideos([]);
  };

  const handleAddYoutubeLink = () => {
    if (!youtubeInput.trim()) return;
    setYoutubeLink(youtubeInput.trim());
    setYoutubeInput("");
    toast.success("YouTube link added");
  };

  const handleDigitalAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error("File must be less than 100MB");
      return;
    }

    setUploadingDigitalAsset(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const token = getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formDataUpload,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setDigitalAssets((prev) => [...prev, {
        name: file.name,
        fileUrl: data.url,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
      }]);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploadingDigitalAsset(false);
      if (digitalAssetInputRef.current) {
        digitalAssetInputRef.current.value = "";
      }
    }
  };

  // The share popup, for a product that was just created or published.
  const announce = (saved: Product) => {
    showSellablePublished({
      kind: "digital-product",
      title: saved.name,
      image: saved.images?.[0] || null,
      url:
        saved.isDigital || saved.deliveryMethod === "digital"
          ? garageStorefrontUrl("product", saved._id)
          : `/checkout/product/${saved._id}`,
      price: formatSellablePrice(
        isFree ? 0 : price,
        currency,
        isSubscription ? subscriptionUnit(subscriptionPeriod) : null,
      ),
      facts: [
        deliveryType === "file" ? "Instant download" : "Access link",
        categoryName.trim(),
      ],
      draft: saved.status === "draft",
    });
  };

  const handleCreate = async () => {
    setError("");
    setWhatsIncludedError(null);
    setKeyFeaturesError(null);
    setFaqsError(null);

    if (!name.trim()) {
      const msg = "Please enter a product name";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!isFree && price <= 0) {
      const msg = "Please enter a valid price for paid product";
      setError(msg);
      toast.error(msg);
      return;
    }

    let hasError = false;

    // Whats Included validation
    const activeWhatsIncluded = whatsIncluded.filter((s) => s.trim());
    if (activeWhatsIncluded.length === 0) {
      const msg = "Please enter at least one What's Included item";
      setWhatsIncludedError(msg);
      toast.error(msg);
      hasError = true;
    }

    // Key Features validation
    const activeKeyFeatures = keyFeatures
      .filter((f) => f.title.trim())
      .map((f) => ({
        title: f.title.trim(),
        icon: f.icon.trim() || "😊",
        description: f.description.trim() || f.title.trim(),
      }));
    if (activeKeyFeatures.length === 0) {
      const msg = "Please enter at least one Key Feature";
      setKeyFeaturesError(msg);
      if (!hasError) toast.error(msg);
      hasError = true;
    }

    // FAQs validation
    const activeFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    if (activeFaqs.length === 0) {
      const msg = "Please enter at least one FAQ (with question and answer)";
      setFaqsError(msg);
      if (!hasError) toast.error(msg);
      hasError = true;
    }

    // Delivery method / digital assets validation
    if (deliveryType === "file" && digitalAssets.length === 0) {
      const msg = "Please upload at least one digital file";
      setError(msg);
      if (!hasError) toast.error(msg);
      hasError = true;
    }

    if (deliveryType === "link") {
      const activeLinks = digitalLinks.filter((l) => l.label.trim() && l.url.trim());
      if (activeLinks.length === 0) {
        const msg = "Please enter at least one digital link (with label and URL)";
        setError(msg);
        if (!hasError) toast.error(msg);
        hasError = true;
      }
    }

    const emailAlertsMsg = emailAlertsForm.validate();
    if (emailAlertsMsg) {
      if (!hasError) toast.error(emailAlertsMsg);
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    try {
      const sanitizedData = {
        name: name.trim(),
        description: description.trim() || undefined,
        images,
        videos,
        youtubeLink: youtubeLink.trim() || undefined,
        isDigital: true,
        requiresShipping: false,
        deliveryMethod: "digital",
        digitalAssets: deliveryType === "file" ? digitalAssets : undefined,
        digitalLinks: deliveryType === "link" ? digitalLinks.filter(l => l.label.trim() && l.url.trim()) : undefined,
        price: isFree ? 0 : price,
        currency,
        gstInclusive,
        requireIosPayment,
        appleFeeInclusive,
        isSubscription,
        subscriptionPeriod: isSubscription ? subscriptionPeriod : undefined,
        trackQuantity,
        quantity: trackQuantity ? quantity : undefined,
        categoryName: categoryName.trim() || undefined,
        status: (product ? product.status : "active") || "active",
        rating: rating > 0 ? rating : undefined,
        ratingCount: ratingCount > 0 ? ratingCount : undefined,
        downloadCount: downloadCount > 0 ? downloadCount : undefined,
        whatsIncluded: activeWhatsIncluded,
        keyFeatures: activeKeyFeatures,
        whatsInside: whatsInside.filter((g) => g.title.trim() && g.icon.trim()).length > 0 ? whatsInside.filter((g) => g.title.trim() && g.icon.trim()) : undefined,
        reviews: reviews.filter((r) => r.reviewerName.trim() && r.text.trim()).length > 0 ? reviews.filter((r) => r.reviewerName.trim() && r.text.trim()) : undefined,
        faqs: activeFaqs,
        productDetails: productDetails.filter((d) => d.label.trim() && d.value.trim()).length > 0 ? productDetails.filter((d) => d.label.trim() && d.value.trim()) : undefined,
        channelIds,
        // Send [] to explicitly clear (edit-mode toggle-off) or the list
        // when on. Backend rejects allowlist + isSubscription combo.
        allowedUserIds: restrictToUsers ? allowedUserIds : [],
        emailAlerts: emailAlertsForm.buildPayload(),
        founderAlerts: founderAlertsForm.buildPayload(),
      };

      if (product) {
        // Edit Mode
        const { product: updated } = await updateProduct(product._id, sanitizedData);
        // Save commission plan if product is paid
        if (!isFree && price > 0 && product._id) {
          await saveCommissionPlan(product._id);
        }
        emailAlertsForm.noteTemplateUse();
        toast.success("Product updated successfully");
        onSuccess(updated);
      } else {
        // Create Mode
        const { product: newProduct } = await createProduct(sanitizedData);
        // Save commission plan if product is paid
        if (!isFree && price > 0 && newProduct._id) {
          await saveCommissionPlan(newProduct._id);
        }
        emailAlertsForm.noteTemplateUse();
        announce(newProduct);
        onSuccess(newProduct);
        resetForm();
      }
    } catch (error) {
      console.error("Error saving product:", error);
      setError(product ? "Failed to update product" : "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!product) return;
    setError("");
    setWhatsIncludedError(null);
    setKeyFeaturesError(null);
    setFaqsError(null);

    if (!name.trim()) {
      const msg = "Please enter a product name";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!isFree && price <= 0) {
      const msg = "Please enter a valid price for paid product";
      setError(msg);
      toast.error(msg);
      return;
    }

    let hasError = false;

    // Whats Included validation
    const activeWhatsIncluded = whatsIncluded.filter((s) => s.trim());
    if (activeWhatsIncluded.length === 0) {
      const msg = "Please enter at least one What's Included item";
      setWhatsIncludedError(msg);
      toast.error(msg);
      hasError = true;
    }

    // Key Features validation
    const activeKeyFeatures = keyFeatures
      .filter((f) => f.title.trim())
      .map((f) => ({
        title: f.title.trim(),
        icon: f.icon.trim() || "😊",
        description: f.description.trim() || f.title.trim(),
      }));
    if (activeKeyFeatures.length === 0) {
      const msg = "Please enter at least one Key Feature";
      setKeyFeaturesError(msg);
      if (!hasError) toast.error(msg);
      hasError = true;
    }

    // FAQs validation
    const activeFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    if (activeFaqs.length === 0) {
      const msg = "Please enter at least one FAQ (with question and answer)";
      setFaqsError(msg);
      if (!hasError) toast.error(msg);
      hasError = true;
    }

    // Delivery method / digital assets validation
    if (deliveryType === "file" && digitalAssets.length === 0) {
      const msg = "Please upload at least one digital file";
      setError(msg);
      if (!hasError) toast.error(msg);
      hasError = true;
    }

    if (deliveryType === "link") {
      const activeLinks = digitalLinks.filter((l) => l.label.trim() && l.url.trim());
      if (activeLinks.length === 0) {
        const msg = "Please enter at least one digital link (with label and URL)";
        setError(msg);
        if (!hasError) toast.error(msg);
        hasError = true;
      }
    }

    const emailAlertsMsg = emailAlertsForm.validate();
    if (emailAlertsMsg) {
      if (!hasError) toast.error(emailAlertsMsg);
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    try {
      const sanitizedData = {
        name: name.trim(),
        description: description.trim() || undefined,
        images,
        videos,
        youtubeLink: youtubeLink.trim() || undefined,
        isDigital: true,
        requiresShipping: false,
        deliveryMethod: "digital",
        digitalAssets: deliveryType === "file" ? digitalAssets : undefined,
        digitalLinks: deliveryType === "link" ? digitalLinks.filter(l => l.label.trim() && l.url.trim()) : undefined,
        price: isFree ? 0 : price,
        currency,
        gstInclusive,
        requireIosPayment,
        appleFeeInclusive,
        isSubscription,
        subscriptionPeriod: isSubscription ? subscriptionPeriod : undefined,
        trackQuantity,
        quantity: trackQuantity ? quantity : undefined,
        categoryName: categoryName.trim() || undefined,
        status: "active" as const,
        rating: rating > 0 ? rating : undefined,
        ratingCount: ratingCount > 0 ? ratingCount : undefined,
        downloadCount: downloadCount > 0 ? downloadCount : undefined,
        whatsIncluded: activeWhatsIncluded,
        keyFeatures: activeKeyFeatures,
        whatsInside: whatsInside.filter((g) => g.title.trim() && g.icon.trim()).length > 0 ? whatsInside.filter((g) => g.title.trim() && g.icon.trim()) : undefined,
        reviews: reviews.filter((r) => r.reviewerName.trim() && r.text.trim()).length > 0 ? reviews.filter((r) => r.reviewerName.trim() && r.text.trim()) : undefined,
        faqs: activeFaqs,
        productDetails: productDetails.filter((d) => d.label.trim() && d.value.trim()).length > 0 ? productDetails.filter((d) => d.label.trim() && d.value.trim()) : undefined,
        channelIds,
        // Send [] to explicitly clear (edit-mode toggle-off) or the list
        // when on. Backend rejects allowlist + isSubscription combo.
        allowedUserIds: restrictToUsers ? allowedUserIds : [],
        emailAlerts: emailAlertsForm.buildPayload(),
        founderAlerts: founderAlertsForm.buildPayload(),
      };

      const { product: updated } = await updateProduct(product._id, sanitizedData);

      // Save commission plan if product is paid
      if (!isFree && price > 0 && product._id) {
        await saveCommissionPlan(product._id);
      }
      emailAlertsForm.noteTemplateUse();

      announce(updated);
      onSuccess(updated);
    } catch (error) {
      console.error("Error publishing product:", error);
      setError("Failed to publish product");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div ref={modalRef} className="relative w-full max-w-[640px] max-h-[92vh] flex flex-col bg-[#111114] border border-[#2a2a35] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35] shrink-0 bg-[#111114]">
          <h2 className="text-base font-semibold text-white">
            {product ? "Edit Product" : "Create New Product"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <div className="w-full px-5 py-4 space-y-6">


            {/* Basic Details Section */}
            <div className="space-y-4">

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="create-name"
                    placeholder="e.g., Design System Kit"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 100))}
                    maxLength={100}
                    required
                    className="bg-[#1E1E1E] border-[#2a2a35] text-white text-sm h-10 rounded-lg focus:ring-brand/50 focus:border-brand/50 w-full"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                  Description
                </label>
                <div className="mt-2">
                  <DescriptionEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Write a short description of your product..."
                  />
                </div>
              </div>

              {/* Audience — restrict to members of selected communities */}
              <div>
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                  Audience
                </label>
                <ChannelMultiSelect
                  channels={channels}
                  selectedIds={channelIds}
                  onChange={setChannelIds}
                  hint="Leave empty to make this product visible to every stakeholder in the org. Select one or more communities to restrict access to their members only."
                />
              </div>

              {/* Private one-time offer — restrict to specific users from
                  the selected communities. Once each buys, the product
                  disappears from their catalog. Rejected for subscription
                  products. */}
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Shield className="h-5 w-5 text-brand shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        Private one-time offer
                      </div>
                      <div className="text-xs text-[#9fa0b8]">
                        Restrict to specific users — each user can buy it once,
                        then it disappears from their view.
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={restrictToUsers}
                      disabled={isSubscription}
                      onCheckedChange={(checked) => {
                        setRestrictToUsers(checked);
                        if (!checked) {
                          setAllowedUserIds([]);
                          setMemberSearchQuery("");
                        }
                      }}
                    />
                  </div>
                </div>
                {isSubscription && (
                  <p className="text-xs text-amber-400/80">
                    Subscription products already gate re-purchase — private
                    one-time offer is not applicable.
                  </p>
                )}

                {restrictToUsers && !isSubscription && (
                  <div className="space-y-3">
                    {channelIds.length === 0 && (
                      <p className="text-xs text-[#9fa0b8]">
                        Select at least one channel above to invite users from.
                      </p>
                    )}

                    {allowedUserIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {allowedUserIds.map((uid) => {
                          const member = channelMembers.find(
                            (m) => m._id === uid,
                          );
                          return (
                            <span
                              key={uid}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-sm"
                            >
                              {member?.name || member?.email || "Selected user"}
                              <button
                                type="button"
                                onClick={() =>
                                  setAllowedUserIds((prev) =>
                                    prev.filter((id) => id !== uid),
                                  )
                                }
                                className="hover:bg-brand/20 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {channelIds.length > 0 && (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                          <Input
                            value={memberSearchQuery}
                            onChange={(e) =>
                              setMemberSearchQuery(e.target.value)
                            }
                            placeholder="Search members by name or email..."
                            className="bg-[#1a1a22] border-[#2a2a35] text-white pl-10 placeholder:text-[#9fa0b8]"
                          />
                        </div>

                        <div className="max-h-[200px] overflow-y-auto rounded-lg border border-[#2a2a35] bg-[#1a1a22]">
                          {loadingMembers ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-5 w-5 animate-spin text-[#9fa0b8]" />
                            </div>
                          ) : (() => {
                              const q = memberSearchQuery.toLowerCase();
                              const filtered = channelMembers.filter(
                                (m) =>
                                  m.name.toLowerCase().includes(q) ||
                                  m.email.toLowerCase().includes(q),
                              );
                              if (filtered.length === 0) {
                                return (
                                  <div className="text-center text-[#9fa0b8] text-sm py-8">
                                    No members found
                                  </div>
                                );
                              }
                              return (
                                <div className="p-1">
                                  {filtered.map((member) => {
                                    const isSelected = allowedUserIds.includes(
                                      member._id,
                                    );
                                    return (
                                      <div
                                        key={member._id}
                                        onClick={() => {
                                          setAllowedUserIds((prev) =>
                                            isSelected
                                              ? prev.filter(
                                                  (id) => id !== member._id,
                                                )
                                              : [...prev, member._id],
                                          );
                                        }}
                                        className={cn(
                                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                                          isSelected
                                            ? "bg-brand/10 border border-brand/20"
                                            : "hover:bg-white/5",
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                            isSelected
                                              ? "bg-brand border-brand"
                                              : "border-[#9fa0b8]",
                                          )}
                                        >
                                          {isSelected && (
                                            <Check className="h-3 w-3 text-brand-foreground" />
                                          )}
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-orange-500 flex items-center justify-center text-brand-foreground font-semibold text-sm overflow-hidden shrink-0">
                                          {member.profilePicture ? (
                                            <img
                                              src={member.profilePicture}
                                              alt={member.name}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            member.name
                                              ?.charAt(0)
                                              .toUpperCase() || "?"
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-white truncate">
                                            {member.name || "Unnamed"}
                                          </div>
                                          <div className="text-xs text-[#9fa0b8] truncate">
                                            {member.email}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                        </div>

                        {allowedUserIds.length > 0 && (
                          <p className="text-xs text-[#9fa0b8]">
                            {allowedUserIds.length} user
                            {allowedUserIds.length !== 1 ? "s" : ""} selected —
                            only these users will see this product, one-time
                            purchase each.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Product Images */}
              <div>
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                  Upload Images
                </label>
                <div className="space-y-3">
                  {/* Main Cover Box */}
                  {images[0] ? (
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316]">
                      <img src={images[0]} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => {
                          const next = [...prev];
                          next[0] = "";
                          return next.filter(Boolean);
                        })}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="border border-dashed border-[#2a2a35] rounded-xl w-full flex items-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingImage ? (
                        <div className="w-full py-8 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-brand animate-spin" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 p-5 w-full">
                          <div className="w-12 h-12 rounded-xl bg-[#131316] flex items-center justify-center border border-[#2a2a35] shrink-0">
                            <ImageIcon className="w-5 h-5 text-[#9fa0b8]" />
                          </div>
                          <div className="text-left">
                            <span className="text-sm font-semibold text-white block">Upload cover image</span>
                            <p className="text-xs text-[#6b6b7b] mt-0.5">
                              Images should be horizontal, at least 1280×720px. PNG or JPG, up to 5mb
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
                      const imgUrl = images[index + 1];
                      return (
                        <div key={index} className="aspect-video w-full">
                          {imgUrl ? (
                            <div className="relative w-full h-full rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316]">
                              <img src={imgUrl} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setImages(prev => prev.filter((_, i) => i !== (index + 1)))}
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
                              {uploadingGallery && index === (images.length - 1) ? (
                                <Loader2 className="w-5 h-5 text-brand animate-spin" />
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

              {/* Product Videos */}
              <div>
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                  Product Videos
                </label>
                <div className="space-y-4">
                  {/* YouTube Paste Input */}
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-[#9fa0b8]/60">
                      <Video className="w-4 h-4" />
                    </span>
                    <input
                      value={youtubeLink}
                      onChange={(e) => {
                        setYoutubeLink(e.target.value);
                        setVideos([]); // clear uploaded file if link is provided
                      }}
                      placeholder="Paste YouTube link..."
                      className="bg-[#131316] border border-[#2a2a35] text-white pl-10 h-10 text-sm rounded-lg focus:ring-brand/50 focus:border-brand/50 w-full"
                    />
                  </div>

                  {youtubeLink && (() => {
                    const getYouTubeEmbedUrl = (url: string) => {
                      if (url.includes("youtu.be/")) {
                        const parts = url.split("youtu.be/");
                        if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                      } else if (url.includes("youtube.com/watch?v=")) {
                        const parts = url.split("v=");
                        if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
                      } else if (url.includes("youtube.com/embed/")) {
                        const parts = url.split("embed/");
                        if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                      }
                      return "";
                    };
                    const embedUrl = getYouTubeEmbedUrl(youtubeLink);
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
                    {videos[0] ? (
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
            </div>

            {/* Product Details Section */}
            <div className="space-y-4">

              {/* Delivery Type */}
              <div>
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                  Delivery Type
                </label>
                <div className="w-full flex bg-[#1E1E1E] border border-[#2a2a35] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDeliveryType("file")}
                    className={cn(
                      "flex-1 py-2 text-sm font-semibold rounded-lg text-center transition-colors",
                      deliveryType === "file" ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                    )}
                  >
                    File
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType("link")}
                    className={cn(
                      "flex-1 py-2 text-sm font-semibold rounded-lg text-center transition-colors",
                      deliveryType === "link" ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                    )}
                  >
                    Link
                  </button>
                </div>
              </div>

              {/* Digital Files Upload */}
              {deliveryType === "file" && (
                <div>
                  <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                    Digital Files <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3">
                    <div
                      onClick={() => digitalAssetInputRef.current?.click()}
                      className="border border-dashed border-[#2a2a35] rounded-xl w-full flex items-center hover:border-brand/50 transition-colors cursor-pointer bg-[#13131a]/60 hover:bg-[#1a1a22]/40"
                    >
                      {uploadingDigitalAsset ? (
                        <div className="w-full py-8 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-brand animate-spin" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 p-4 w-full">
                          <div className="w-10 h-10 rounded-lg bg-[#1a1a22] flex items-center justify-center border border-[#2a2a35] shrink-0">
                            <ImageIcon className="w-5 h-5 text-[#9fa0b8]" />
                          </div>
                          <div className="text-left">
                            <span className="text-sm font-semibold text-white block">Upload digital files</span>
                            <p className="text-xs text-[#6b6b7b] mt-0.5">
                              Max 100MB • ZIP, PDF, MP4, etc.
                            </p>
                          </div>
                        </div>
                      )}
                      <input
                        ref={digitalAssetInputRef}
                        type="file"
                        onChange={handleDigitalAssetUpload}
                        className="hidden"
                      />
                    </div>

                    {digitalAssets.length > 0 && (
                      <div className="space-y-2">
                        {digitalAssets.map((asset, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-[#1E1E1E] border border-[#2a2a35] rounded-xl">
                            <FileText className="w-6 h-6 text-brand" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate font-medium">{asset.name}</p>
                              <p className="text-xs text-[#9fa0b8]">
                                {asset.fileSize ? `${(asset.fileSize / 1024 / 1024).toFixed(2)} MB` : "Unknown size"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDigitalAssets((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-[#2a2a35]"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Digital Links */}
              {deliveryType === "link" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                      Digital Links <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-3">
                      {digitalLinks.map((link, idx) => (
                        <div key={idx} className="p-4 bg-[#1E1E1E] border border-[#2a2a35] rounded-xl space-y-3">
                          <div className="flex items-center gap-2">
                            <Link2 className="w-5 h-5 text-brand flex-shrink-0" />
                            <Input
                              placeholder="Link label (e.g., Course Access)"
                              value={link.label}
                              onChange={(e) => {
                                const updated = [...digitalLinks];
                                updated[idx] = { ...updated[idx], label: e.target.value };
                                setDigitalLinks(updated);
                              }}
                              className="flex-1 bg-[#16161a] border-[#2a2a35] text-white"
                            />
                            <button
                              type="button"
                              onClick={() => setDigitalLinks(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-[#2a2a35]"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <Input
                            placeholder="URL (e.g., https://drive.google.com/...)"
                            value={link.url}
                            onChange={(e) => {
                              const updated = [...digitalLinks];
                              updated[idx] = { ...updated[idx], url: e.target.value };
                              setDigitalLinks(updated);
                            }}
                            className="bg-[#16161a] border-[#2a2a35] text-white"
                          />
                          {/* Static / Dynamic Toggle */}
                          <div className="flex items-center gap-2 pt-1">
                            <div className="flex rounded-lg overflow-hidden border border-[#2a2a35]">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...digitalLinks];
                                  updated[idx] = { ...updated[idx], linkType: "static" };
                                  setDigitalLinks(updated);
                                }}
                                className={`px-3 py-1 text-xs font-medium transition-colors ${
                                  (!link.linkType || link.linkType === "static")
                                    ? "bg-brand text-brand-foreground"
                                    : "bg-[#16161a] text-[#9fa0b8] hover:text-white"
                                }`}
                              >
                                Static
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...digitalLinks];
                                  updated[idx] = { ...updated[idx], linkType: "dynamic" };
                                  setDigitalLinks(updated);
                                }}
                                className={`px-3 py-1 text-xs font-medium transition-colors ${
                                  link.linkType === "dynamic"
                                    ? "bg-purple-500 text-white"
                                    : "bg-[#16161a] text-[#9fa0b8] hover:text-white"
                                }`}
                              >
                                Dynamic
                              </button>
                            </div>
                            <span className="text-[10px] text-[#9fa0b8]">
                              {link.linkType === "dynamic"
                                ? "Stakeholders can set their own URL for referrals"
                                : "Same link shown to all buyers"}
                            </span>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDigitalLinks(prev => [...prev, { label: "", url: "", linkType: "static" }])}
                        className="flex items-center justify-center gap-2 p-3 bg-[#1E1E1E] border border-[#2a2a35] rounded-xl cursor-pointer hover:border-brand transition-colors w-full text-sm text-[#9fa0b8]"
                      >
                        <Plus className="w-4 h-4" />
                        Add digital link
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* What's Included */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-1 uppercase tracking-wide">
                  What's Included <span className="text-red-500">*</span>
                </label>
                {whatsIncluded.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const updated = [...whatsIncluded];
                        updated[idx] = e.target.value;
                        setWhatsIncluded(updated);
                        if (whatsIncludedError) setWhatsIncludedError(null);
                      }}
                      placeholder="e.g., Source files"
                      className={cn(
                        "bg-[#1E1E1E] text-white text-sm h-10 rounded-lg focus:ring-brand/50 focus:border-brand/50 flex-1",
                        whatsIncludedError && idx === 0 ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-[#2a2a35]"
                      )}
                    />
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setWhatsIncluded((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-[#8b8c9d] hover:text-white bg-[#1E1E1E] border border-[#2a2a35] rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setWhatsIncluded((prev) => [...prev, ""])}
                  className="text-xs text-brand font-bold hover:underline flex items-center gap-1 pt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {/* Key Features */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-1 uppercase tracking-wide">
                  Key Features <span className="text-red-500">*</span>
                </label>
                {keyFeatures.map((feature, idx) => (
                  <div key={idx} className="p-4 bg-[#1E1E1E] border border-[#2a2a35] rounded-xl space-y-3 relative">
                    <div className="flex gap-2 items-center">
                      {/* Emoji Selector Trigger */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPickerIdx(showEmojiPickerIdx === idx ? null : idx)}
                          className="w-16 h-10 text-xs font-semibold text-white bg-[#16161a] border border-[#2a2a35] rounded-lg flex items-center justify-center hover:border-brand transition-colors gap-1 px-2"
                        >
                          {feature.icon ? (
                            <span className="text-base">{feature.icon}</span>
                          ) : (
                            <>🙂 Emoji</>
                          )}
                        </button>

                        {showEmojiPickerIdx === idx && (
                          <div className="absolute left-0 mt-2 z-[200] grid grid-cols-4 gap-1 p-2 bg-[#16161a] border border-[#2a2a35] rounded-lg shadow-xl w-36">
                            {popularEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  const updated = [...keyFeatures];
                                  updated[idx] = { ...updated[idx], icon: emoji };
                                  setKeyFeatures(updated);
                                  setShowEmojiPickerIdx(null);
                                  if (keyFeaturesError) setKeyFeaturesError(null);
                                }}
                                className="w-7 h-7 text-base hover:bg-[#222] rounded flex items-center justify-center"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <Input
                        value={feature.title}
                        onChange={(e) => {
                          const updated = [...keyFeatures];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setKeyFeatures(updated);
                          if (keyFeaturesError) setKeyFeaturesError(null);
                        }}
                        placeholder="e.g., Feature title"
                        className="bg-[#16161a] border-[#2a2a35] text-white text-sm h-10 rounded-lg focus:ring-brand/50 focus:border-brand/50 flex-1"
                      />

                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => setKeyFeatures((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-[#8b8c9d] hover:text-white bg-[#16161a] border border-[#2a2a35] rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <Textarea
                      value={feature.description}
                      onChange={(e) => {
                        const updated = [...keyFeatures];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setKeyFeatures(updated);
                      }}
                      placeholder="Brief description..."
                      rows={2}
                      className="bg-[#16161a] border-[#2a2a35] text-white text-sm rounded-lg focus:ring-brand/50 focus:border-brand/50 w-full"
                    />
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setKeyFeatures((prev) => [...prev, { icon: "", title: "", description: "" }])}
                    disabled={keyFeatures.length >= MAX_KEY_FEATURES}
                    className="text-xs text-brand font-bold hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline disabled:pointer-events-none"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Feature
                  </button>
                  {keyFeatures.length >= MAX_KEY_FEATURES && (
                    <span className="text-[11px] text-[#6b6b7b]">
                      {limitReachedLabel(MAX_KEY_FEATURES, "features")}
                    </span>
                  )}
                </div>
              </div>

              {/* FAQs */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-1 uppercase tracking-wide">
                  Frequently Asked Questions <span className="text-red-500">*</span>
                </label>
                {faqs.map((faq, idx) => (
                  <div key={idx} className="p-4 bg-[#1E1E1E] border border-[#2a2a35] rounded-xl space-y-3">
                    <div className="flex gap-2 items-center">
                      <Input
                        value={faq.question}
                        onChange={(e) => {
                          const updated = [...faqs];
                          updated[idx] = { ...updated[idx], question: e.target.value };
                          setFaqs(updated);
                          if (faqsError) setFaqsError(null);
                        }}
                        placeholder="e.g., What is this product about?"
                        className="bg-[#16161a] border-[#2a2a35] text-white text-sm h-10 rounded-lg focus:ring-brand/50 focus:border-brand/50 flex-1"
                      />
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => setFaqs((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-[#8b8c9d] hover:text-white bg-[#16161a] border border-[#2a2a35] rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <Textarea
                      value={faq.answer}
                      onChange={(e) => {
                        const updated = [...faqs];
                        updated[idx] = { ...updated[idx], answer: e.target.value };
                        setFaqs(updated);
                        if (faqsError) setFaqsError(null);
                      }}
                      placeholder="Write a clear answer..."
                      rows={3}
                      className="bg-[#16161a] border-[#2a2a35] text-white text-sm rounded-lg focus:ring-brand/50 focus:border-brand/50 w-full"
                    />
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}
                    disabled={faqs.length >= MAX_FAQS}
                    className="text-xs text-brand font-bold hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline disabled:pointer-events-none"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add FAQ
                  </button>
                  {faqs.length >= MAX_FAQS && (
                    <span className="text-[11px] text-[#6b6b7b]">
                      {limitReachedLabel(MAX_FAQS, "FAQs")}
                    </span>
                  )}
                </div>
              </div>

              {/* Post-purchase order email */}
              <ProductEmailAlertsSection
                {...emailAlertsForm.sectionProps}
                product={{ productName: name, price, currency, isFree }}
              />

              {/* Founder's own "someone bought this" alert */}
              <FounderAlertsSection
                {...founderAlertsForm.sectionProps}
                context="product"
              />
            </div>

            {/* Pricing Section */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                  Product Type
                </label>
                <div className="flex rounded-lg border border-[#2a2a35] bg-[#1E1E1E] p-1 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFree(true);
                      setPrice(0);
                      setIsSubscription(false);
                    }}
                    className={cn(
                      "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all text-center",
                      isFree ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                    )}
                  >
                    Free
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFree(false)}
                    className={cn(
                      "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all text-center",
                      !isFree ? "bg-brand text-brand-foreground" : "text-[#9fa0b8] hover:text-white"
                    )}
                  >
                    Paid
                  </button>
                </div>
              </div>

              {!isFree && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Regular Price */}
                  <div>
                    <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
                      Regular Price <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="w-36 shrink-0">
                        <CurrencyDropdown value={currency} onChange={setCurrency} />
                      </div>
                      <Input
                        type="number"
                        value={price || ""}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        placeholder="0.00"
                        min={0}
                        className="flex-1 bg-[#1E1E1E] border-[#2a2a35] text-white text-sm h-10 rounded-lg focus:ring-brand/50 focus:border-brand/50"
                      />
                    </div>
                  </div>



                  {/* GST / Tax — affects invoices for INR sales only. */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                      GST / Tax
                    </label>
                    <p className="text-[11px] text-[#6b6b7b] leading-relaxed">
                      18.00% GST (Goods &amp; Services Tax) applies to buyers
                      in India, whatever currency you price in. Does the price
                      above already include it?
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGstInclusive(true)}
                        className={cn(
                          "text-left p-3 rounded-xl border transition-all",
                          gstInclusive
                            ? "bg-brand/5 border-brand"
                            : "bg-[#1E1E1E] border-[#2a2a35] hover:border-[#3a3a45]"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {gstInclusive && (
                            <span className="w-2 h-2 rounded-full bg-brand" />
                          )}
                          <span className="text-sm font-semibold text-white">
                            Yes, I&apos;ll cover it in the above price
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9fa0b8]">
                          Listed price already includes 18% GST.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGstInclusive(false)}
                        className={cn(
                          "text-left p-3 rounded-xl border transition-all",
                          !gstInclusive
                            ? "bg-brand/5 border-brand"
                            : "bg-[#1E1E1E] border-[#2a2a35] hover:border-[#3a3a45]"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {!gstInclusive && (
                            <span className="w-2 h-2 rounded-full bg-brand" />
                          )}
                          <span className="text-sm font-semibold text-white">
                            No, add it on top
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9fa0b8]">
                          18% GST added to the total at checkout.
                        </p>
                      </button>
                    </div>
                  </div>


                  {/* Commission Plan Section */}
                  <CommissionPlanSection
                    itemType="product"
                    itemName={name || "New Product"}
                    isPaid={price > 0}
                    className="mt-4"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-t border-[#2a2a35] bg-[#111114] shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
            {product && onDelete && (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onDelete();
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-semibold h-9 px-3 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Delete Product"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="text-[#9fa0b8] hover:text-white text-xs font-semibold h-9 px-3 transition-colors shrink-0"
            >
              Cancel
            </button>

            {!isFree && price > 0 && (() => {
              const priceDetails = getPriceDetails();
              return (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-5 w-px bg-[#2a2a35]" />
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-semibold text-[#8b8c9d] uppercase tracking-wide leading-none">iOS</span>
                        <span className="text-brand font-bold text-xs mt-0.5">
                          {priceDetails.currency}{priceDetails.totalIos.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-[#2a2a35]" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-semibold text-[#8b8c9d] uppercase tracking-wide leading-none">Web</span>
                        {/* Both figures: what the buyer is charged, and the
                            pre-tax base. Showing only one made it impossible
                            to tell whether GST was already inside the price. */}
                        <span className="text-brand font-bold text-xs mt-0.5 leading-none">
                          {priceDetails.currency}{priceDetails.totalWeb.toFixed(2)}
                          <span className="text-[9px] font-medium text-[#6b6b7b] ml-1">incl. GST</span>
                        </span>
                        <span className="text-[9px] text-[#8b8c9d] mt-0.5 leading-none">
                          {priceDetails.currency}{priceDetails.baseWeb.toFixed(2)} excl. GST
                          {priceDetails.gstWeb > 0 && (
                            <span className="text-[#6b6b7b]"> · GST {priceDetails.currency}{priceDetails.gstWeb.toFixed(2)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPriceBreakdownModal(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#131316] border border-[#2a2a35] text-[10px] font-semibold text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] transition-colors shrink-0"
                    >
                      <Info className="w-3 h-3" />
                      <span>Breakdown</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            {product && product.status === "draft" && (
              <>
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading}
                  variant="outline"
                  className="border-[#2a2a35] text-white hover:bg-[#1a1a22] h-9 px-4 font-bold rounded-lg transition-colors text-xs shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Save Draft"
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={handlePublish}
                  disabled={loading}
                  className="bg-brand hover:opacity-90 text-brand-foreground h-9 px-4 font-bold rounded-lg transition-colors text-xs shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Publish"
                  )}
                </Button>
              </>
            )}

            {(!product || product.status !== "draft") && (
              <Button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="bg-brand hover:opacity-90 text-brand-foreground h-9 px-4 sm:px-5 font-bold rounded-lg transition-colors text-xs shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : product ? (
                  "Save Changes"
                ) : (
                  "Create Product"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={groupIconInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && uploadingGroupIcon !== null) {
              handleIconUpload(file, "group", uploadingGroupIcon);
            }
          }}
          className="hidden"
        />
      </div>

      {showPriceBreakdownModal && (() => {
        const breakdown = getDetailedPriceBreakdown();
        const formatTablePrice = (amount: number, isMinusOrPlus?: "minus" | "plus" | "none") => {
          const symbol = currency === "INR" ? "₹" : "$";
          if (amount === 0 && isMinusOrPlus === "none") return "-";
          const prefix = isMinusOrPlus === "plus" ? "+" : isMinusOrPlus === "minus" ? "-" : "";
          return `${prefix}${symbol}${amount.toFixed(2)}`;
        };
        const formatCardPrice = (amount: number, curr: string) => {
          const symbol = curr === "INR" ? "₹" : "$";
          return `${symbol}${amount.toFixed(2)}`;
        };

        return (
          <Dialog open={showPriceBreakdownModal} onOpenChange={setShowPriceBreakdownModal}>
            <DialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[1200] max-w-2xl text-white p-6 rounded-2xl" showCloseButton={false}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-white">Price Preview</DialogTitle>
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
                <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2">
                  <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                    <Apple className="w-3 h-3 text-[#9fa0b8]" />
                    iOS Customers
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {formatCardPrice(breakdown.ios.customerPays, currency)}
                  </div>
                  <div className="text-xs text-[#6b6b7b]">
                    one-time payment
                  </div>
                </div>

                {/* Non-iOS Customers Card */}
                <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2">
                  <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                    <Smartphone className="w-3 h-3 text-[#9fa0b8]" />
                    Non-iOS Customers
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {formatCardPrice(breakdown.nonIos.customerPays, currency)}
                  </div>
                  <div className="text-xs text-[#6b6b7b]">
                    one-time payment
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white mb-2">Price Breakdown</h3>
                
                <div className="grid grid-cols-2 gap-8">
                  {/* iOS Column */}
                  <div className="space-y-2">
                    <div className="text-xs text-[#9fa0b8] font-semibold mb-3">iOS Customers</div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>Base price</span>
                      <span className="text-white">{formatTablePrice(breakdown.basePrice)}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>Apple fee (30%)</span>
                      <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.ios.appleFee, "plus")}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>GST (18%)</span>
                      <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.ios.gst, "plus")}</span>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 my-1 pt-1.5 flex justify-between text-xs font-semibold text-white">
                      <span>Customer pays</span>
                      <span>{formatTablePrice(breakdown.ios.customerPays)}</span>
                    </div>
                    
                    {/* Distribution */}
                    <div className="pt-2">
                      <div className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-semibold mb-2">DISTRIBUTION</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Government (GST)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.govGst)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Apple</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.appleDist)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Platform (5%)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.platformFee)}</span>
                        </div>
                        {breakdown.affPercent > 0 && (
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Affiliate ({breakdown.affPercent}%)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.affiliateCut)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 mt-2 pt-2 flex justify-between text-xs font-bold">
                      <span className="text-brand">You receive</span>
                      <span className="text-brand">{formatTablePrice(breakdown.ios.youReceive)}</span>
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
    </div>
  );
}


// Razorpay types
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  image?: string;
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
  prefill?: { name?: string; email?: string; contact?: string };
}

interface RazorpayClass {
  new(options: RazorpayOptions): { open: () => void };
}

// Shipping Address type
interface ShippingAddressForm {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// User profile type for shipping
interface UserProfile {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
}

// Product Detail View (Stakeholder)
function ProductDetailView({
  product,
  products,
  affiliateId,
  onBack,
  formatCurrency,
}: {
  product: Product;
  products: Product[];
  affiliateId: string;
  onBack: () => void;
  formatCurrency: (value: number, currency?: string) => string;
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const mediaItems = useMemo(() => {
    const items: Array<{ type: "image" | "video"; url: string; isYoutube?: boolean }> = [];
    
    // Add images
    if (product.images && product.images.length > 0) {
      product.images.forEach(img => {
        if (img) items.push({ type: "image", url: img });
      });
    }

    // Add youtubeLink if present
    if (product.youtubeLink) {
      items.push({ type: "video", url: product.youtubeLink, isYoutube: true });
    }

    // Add direct videos if present
    if (product.videos && product.videos.length > 0) {
      product.videos.forEach(v => {
        if (v) items.push({ type: "video", url: v, isYoutube: false });
      });
    }

    return items;
  }, [product.images, product.videos, product.youtubeLink]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [product._id]);

  const [purchasing, setPurchasing] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // "Buy to assign" — purchase N units as reserves to hand out to others.
  const [buyToAssign, setBuyToAssign] = useState(false);
  const [reserveQty, setReserveQty] = useState(1);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Inline checkout state. `showPaymentSelector` toggles the right-side
  // slide-in drawer that hosts <CheckoutPaymentStep> inline (coupon /
  // wallet / GST / cashback / Razorpay / Stripe / crypto all inside).
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [hasDetailPlan, setHasDetailPlan] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPlan = async () => {
      try {
        const result = await getCombPlanForItem("product", product._id);
        if (result?.plan && result.plan.levels && result.plan.levels.length > 0) {
          setHasDetailPlan(true);
        } else {
          setHasDetailPlan(false);
        }
      } catch (err) {
        setHasDetailPlan(false);
      }
    };
    checkPlan();
  }, [product._id]);

  // Dynamic link management state
  const hasDynamicLinks = product.digitalLinks?.some(l => l.linkType === "dynamic") ?? false;
  const [dynamicLinkData, setDynamicLinkData] = useState<DynamicLinkInfo[]>([]);
  const [customLinkInputs, setCustomLinkInputs] = useState<Record<string, string>>({});
  const [savingLink, setSavingLink] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // Fetch custom links if product has dynamic links
  useEffect(() => {
    if (!hasDynamicLinks) return;
    const fetchMyLinks = async () => {
      setLoadingLinks(true);
      try {
        const data = await getMyProductLinks(product._id);
        setDynamicLinkData(data.dynamicLinks);
        // Pre-populate inputs with existing custom links
        const inputs: Record<string, string> = {};
        for (const dl of data.dynamicLinks) {
          inputs[dl.label] = dl.customLink?.url || "";
        }
        setCustomLinkInputs(inputs);
      } catch {
        // silently fail
      } finally {
        setLoadingLinks(false);
      }
    };
    fetchMyLinks();
  }, [hasDynamicLinks, product._id]);

  const handleSaveCustomLink = async (digitalLinkLabel: string) => {
    const url = customLinkInputs[digitalLinkLabel]?.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid URL (e.g., https://example.com)");
      return;
    }
    setSavingLink(digitalLinkLabel);
    try {
      await setMyProductLink(product._id, { digitalLinkLabel, url });
      // Refresh links
      const data = await getMyProductLinks(product._id);
      setDynamicLinkData(data.dynamicLinks);
      const inputs: Record<string, string> = {};
      for (const dl of data.dynamicLinks) {
        inputs[dl.label] = dl.customLink?.url || "";
      }
      setCustomLinkInputs(inputs);
      toast.success("Custom link saved!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save custom link");
    } finally {
      setSavingLink(null);
    }
  };

  const handleDeleteCustomLink = async (digitalLinkLabel: string) => {
    setSavingLink(digitalLinkLabel);
    try {
      await deleteMyProductLink(product._id, digitalLinkLabel);
      const data = await getMyProductLinks(product._id);
      setDynamicLinkData(data.dynamicLinks);
      const inputs: Record<string, string> = {};
      for (const dl of data.dynamicLinks) {
        inputs[dl.label] = dl.customLink?.url || "";
      }
      setCustomLinkInputs(inputs);
      toast.success("Custom link removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove custom link");
    } finally {
      setSavingLink(null);
    }
  };

  const [shippingAddress, setShippingAddress] = useState<ShippingAddressForm>({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  });

  // City search state (similar to ProfilePopover)
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [filteredCities, setFilteredCities] = useState<any[]>([]);

  // No discount concept in this app: a product is either free or paid; `price` is
  // the single source of truth (0 = free).
  const displayPrice = product.price;

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { api } = await import("@/lib/api");
        const { getUserDataFromToken, getToken } = await import("@/lib/auth");
        const tokenData = getUserDataFromToken();
        const token = getToken();

        if (!tokenData.userId || !token) return;

        const response = await api<{
          name: string;
          email: string;
          phone: string;
          city: string;
          state: string;
          country: string;
        }>(`/profile?userId=${tokenData.userId}`, {}, token);

        setUserProfile({
          name: response.name || "",
          email: tokenData.email || "",
          phone: response.phone || "",
          city: response.city || "",
          state: response.state || "",
          country: response.country || "India",
        });

        // Pre-fill shipping address with user profile data
        setShippingAddress(prev => ({
          ...prev,
          fullName: response.name || "",
          phone: response.phone || "",
          city: response.city || "",
          state: response.state || "",
          country: response.country || "India",
        }));
        setCitySearch(response.city || "");
      } catch (error) {
        // Profile not found, use token data
        try {
          const { getUserDataFromToken } = await import("@/lib/auth");
          const tokenData = getUserDataFromToken();
          setUserProfile({
            name: tokenData.name || "",
            email: tokenData.email || "",
            phone: "",
            city: "",
            state: "",
            country: "India",
          });
          setShippingAddress(prev => ({
            ...prev,
            fullName: tokenData.name || "",
          }));
        } catch (e) {
          console.error("Failed to get user data:", e);
        }
      }
    };

    fetchProfile();
  }, []);

  // City search functionality (similar to ProfilePopover)
  useEffect(() => {
    const searchCities = async () => {
      if (citySearch.length > 2) {
        try {
          const { City } = await import("country-state-city");
          const cities = City.getAllCities();
          const filtered = cities
            .filter((city) =>
              city.name.toLowerCase().includes(citySearch.toLowerCase())
            )
            .slice(0, 10);
          setFilteredCities(filtered);
          setShowCityDropdown(true);
        } catch (e) {
          console.error("Failed to load cities:", e);
        }
      } else {
        setFilteredCities([]);
        setShowCityDropdown(false);
      }
    };

    searchCities();
  }, [citySearch]);

  const handleCitySelect = async (city: any) => {
    try {
      const { State, Country } = await import("country-state-city");
      const state = State.getStateByCodeAndCountry(city.stateCode, city.countryCode);
      const country = Country.getCountryByCode(city.countryCode);

      setShippingAddress(prev => ({
        ...prev,
        city: city.name,
        state: state?.name || "",
        country: country?.name || "",
      }));

      setCitySearch(city.name);
      setShowCityDropdown(false);
    } catch (e) {
      console.error("Failed to process city selection:", e);
    }
  };

  // Load Razorpay SDK
  const loadRazorpayScript = async (): Promise<boolean> => {
    const windowWithRazorpay = window as { Razorpay?: unknown };
    if (windowWithRazorpay.Razorpay) return true;

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
        if (windowWithRazorpay.Razorpay) resolve(true);
        else if (attempts >= 50) resolve(false);
        else { attempts++; setTimeout(check, 100); }
      };
      check();
    });
  };

  // Open Razorpay with given options
  const openRazorpayCheckout = async (options: {
    key: string;
    amount: number;
    currency: string;
    orderId: string;
    subscriptionId?: string;
    addressData?: ShippingAddressForm;
  }) => {
    const razorpayLoaded = await loadRazorpayScript();
    if (!razorpayLoaded) throw new Error("Failed to load payment gateway");

    const windowWithRazorpay = window as { Razorpay?: RazorpayClass };
    if (!windowWithRazorpay.Razorpay) throw new Error("Payment gateway not available");

    const { verifyProductPayment } = await import("@/lib/feed-api");

    const rzpOptions: RazorpayOptions & { image?: string; subscription_id?: string } = {
      key: options.key,
      amount: options.amount,
      currency: options.currency,
      order_id: options.orderId,
      name: "Product Purchase",
      description: `Purchase: ${product.name}`,
      image: product.images?.[0],
      prefill: {
        name: userProfile?.name || options.addressData?.fullName || "",
        email: userProfile?.email || "",
        contact: userProfile?.phone || options.addressData?.phone || "",
      },
      handler: async (response) => {
        try {
          const result = await verifyProductPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            items: [{ productId: product._id, quantity: 1 }],
            shippingAddress: product.requiresShipping && options.addressData ? {
              fullName: options.addressData.fullName,
              phone: options.addressData.phone,
              addressLine1: options.addressData.addressLine1,
              addressLine2: options.addressData.addressLine2 || undefined,
              city: options.addressData.city,
              state: options.addressData.state,
              postalCode: options.addressData.postalCode,
              country: options.addressData.country,
            } : undefined,
          });

          if (result.success) {
            toast.success("Purchase successful! Check your orders for details.");
            onBack();
          } else {
            toast.error(result.message || "Payment verification failed");
          }
        } catch (error) {
          console.error("Payment verification error:", error);
          toast.error("Payment verification failed. Please contact support.");
        } finally {
          setPurchasing(false);
        }
      },
      modal: { ondismiss: () => setPurchasing(false) },
      theme: { color: getBrandHex() },
    };

    if (options.subscriptionId) {
      rzpOptions.subscription_id = options.subscriptionId;
    }

    const rzp = new windowWithRazorpay.Razorpay(rzpOptions);
    rzp.open();
  };

  // Handle purchase with Razorpay
  const handleBuyNow = async (addressData?: ShippingAddressForm) => {
    // Reserves are assigned to others later (recipient provides their own
    // address on redemption), so a "buy to assign" purchase skips shipping.
    if (product.requiresShipping && !buyToAssign && !addressData) {
      setShowShippingModal(true);
      return;
    }

    setPurchasing(true);
    try {
      // Import the API functions dynamically to avoid circular deps
      const { createProductRazorpayOrder } = await import("@/lib/feed-api");

      // 1. Create Razorpay order (or free order)
      const orderData = await createProductRazorpayOrder({
        items: [{ productId: product._id, quantity: buyToAssign ? Math.max(1, reserveQty) : 1 }],
        forReserve: buyToAssign,
      }) as any;

      // Handle free products - order already created, no payment needed
      if (orderData.isFree) {
        toast.success("Product acquired successfully!");
        setPurchasing(false);
        onBack();
        return;
      }

      // Preferred path — BE returned an invoiceId → open the inline
      // checkout drawer. <CheckoutPaymentStep> owns the full surface
      // (coupon-or-cashback code, GST breakdown, wallet, Razorpay, crypto,
      // Stripe). Quantity + `forReserve` are already baked into the invoice
      // at create-order time above.
      if (orderData.invoiceId) {
        setInvoiceId(orderData.invoiceId);
        setShowPaymentSelector(true);
        setPurchasing(false);
        return;
      }

      // Fallback (defensive): direct Razorpay flow if BE didn't return
      // an invoiceId. Every one-time product purchase reaches the branch
      // above today.
      await openRazorpayCheckout({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        orderId: orderData.order.id,
        addressData,
      });
    } catch (error) {
      console.error("Purchase failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process purchase");
      setPurchasing(false);
    }
  };

  // Direct callbacks for the inline <CheckoutPaymentStep> in the drawer
  // below. Replaces the old cross-frame postMessage listener now that
  // payment renders inline. Semantics preserved:
  //   onSuccess → close drawer + call onBack() (matches razorpay handler
  //   + free-product branches which both do the same).
  //   onCancel  → close drawer without navigating (matches invoice:closed).
  const handleInvoicePaidInline = () => {
    setShowPaymentSelector(false);
    setInvoiceId(null);
    setPurchasing(false);
    toast.success("Order placed successfully!");
    onBack();
  };

  const handleInvoiceCancelledInline = () => {
    setShowPaymentSelector(false);
    setInvoiceId(null);
    setPurchasing(false);
  };

  // Handle shipping form submit
  const handleShippingSubmit = () => {
    // Use profile data for name and phone
    const fullName = userProfile?.name || shippingAddress.fullName;
    const phone = userProfile?.phone || shippingAddress.phone;

    // Validate required fields
    if (!fullName?.trim()) {
      toast.error("Please complete your profile with your name first");
      return;
    }
    if (!shippingAddress.addressLine1.trim()) {
      toast.error("Please enter your address");
      return;
    }
    if (!shippingAddress.city.trim()) {
      toast.error("Please enter your city");
      return;
    }
    if (!shippingAddress.state.trim()) {
      toast.error("Please enter your state");
      return;
    }
    if (!shippingAddress.postalCode.trim()) {
      toast.error("Please enter your postal code");
      return;
    }

    // Merge profile data into shipping address before submitting
    const finalShippingAddress = {
      ...shippingAddress,
      fullName: fullName,
      phone: phone || "",
    };

    setShowShippingModal(false);
    handleBuyNow(finalShippingAddress);
  };

  const orgName = typeof window !== 'undefined' ? (localStorage.getItem("garage_org_name") || "Garage Inc") : "Garage Inc";
  const orgSlug = typeof window !== 'undefined' ? (localStorage.getItem("garage_org_slug") || "garage-inc") : "garage-inc";
  const creatorObj = product.createdBy && typeof product.createdBy === "object" ? product.createdBy : null;
  const creatorName = creatorObj?.name || orgName;

  const includedList = product.whatsIncluded && product.whatsIncluded.length > 0
    ? product.whatsIncluded
    : [];

  const featuresList = product.keyFeatures && product.keyFeatures.length > 0
    ? product.keyFeatures
    : [];

  const faqList = product.faqs && product.faqs.length > 0
    ? product.faqs
    : [];

  // More from this seller other products
  const sellerProducts = products
    .filter((p) => p.organizationId === product.organizationId && p._id !== product._id)
    .slice(0, 4);

  // Ratings for the "more from this seller" row — batched like the main grid,
  // so these cards show a real star row rather than a stuck placeholder.
  const sellerRatingSummaries = useRatingSummaries(
    "product",
    sellerProducts.map((p) => p._id)
  );

  const displayDescription = product.description || "No description available for this product.";
  const strippedDescription = stripHtml(displayDescription);
  const isDescTooLong = strippedDescription.length > 250;
  const descriptionText = isDescTooLong && !isDescExpanded 
    ? `${strippedDescription.slice(0, 250)}...` 
    : displayDescription;

  const handleOpenAffiliateLink = () => {
    window.dispatchEvent(
      new CustomEvent("right-panel:open-information", {
        detail: {
          type: "affiliate",
          product,
          itemType: "product",
          affiliateId,
        },
      })
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0b0d] select-text">
      {/* Header Bar */}
      <div className="border-b border-[#2a2a35] bg-[#0e0e12] px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center text-[#9fa0b8] hover:text-white transition-colors cursor-pointer text-sm font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shop
          </button>
          <div className="h-6 w-px bg-[#2a2a35]" />
          <h1 className="text-sm font-semibold text-white">Product Details</h1>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column - Details */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-8 min-w-0">
              
              {/* Product Gallery Showcase */}
              <div className="space-y-4">
                <div className="aspect-[16/10] bg-black rounded-2xl relative overflow-hidden border border-[#2a2a35] flex items-center justify-center shadow-lg">
                  {mediaItems.length > 0 ? (
                    (() => {
                      const activeMedia = mediaItems[activeImageIndex];
                      if (!activeMedia) return null;
                      if (activeMedia.type === "video") {
                        if (activeMedia.isYoutube) {
                          const getYouTubeEmbedUrl = (url: string) => {
                            if (url.includes("youtu.be/")) {
                              const parts = url.split("youtu.be/");
                              if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                            } else if (url.includes("youtube.com/watch?v=")) {
                              const parts = url.split("v=");
                              if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
                            } else if (url.includes("youtube.com/embed/")) {
                              const parts = url.split("embed/");
                              if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                            }
                            return url;
                          };
                          return (
                            <iframe
                              src={getYouTubeEmbedUrl(activeMedia.url)}
                              className="w-full h-full border-none"
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                          );
                        } else {
                          return (
                            <video
                              src={activeMedia.url}
                              controls
                              className="w-full h-full object-contain"
                            />
                          );
                        }
                      }
                      return (
                        <img
                          src={activeMedia.url}
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      );
                    })()
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="h-16 w-16 text-[#9fa0b8]" />
                    </div>
                  )}
                  
                  {mediaItems.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveImageIndex((prev) => prev === 0 ? mediaItems.length - 1 : prev - 1)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer z-10"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setActiveImageIndex((prev) => prev === mediaItems.length - 1 ? 0 : prev + 1)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer z-10"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails Row */}
                {mediaItems.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {mediaItems.map((item, idx) => {
                      const isVideo = item.type === "video";
                      let thumbUrl = item.url;
                      if (isVideo && item.isYoutube) {
                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                        const match = item.url.match(regExp);
                        if (match && match[2].length === 11) {
                          thumbUrl = `https://img.youtube.com/vi/${match[2]}/mqdefault.jpg`;
                        }
                      }
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={cn(
                            "w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer shadow-md relative bg-[#131316] flex items-center justify-center",
                            activeImageIndex === idx ? "border-brand scale-102" : "border-[#2a2a35] opacity-70 hover:opacity-100"
                          )}
                        >
                          {isVideo ? (
                            <>
                              {item.isYoutube ? (
                                <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-black/40">
                                  <Video className="w-5 h-5 text-white/80" />
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Play className="w-4 h-4 text-white fill-white" />
                              </div>
                            </>
                          ) : (
                            <img src={thumbUrl} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Title Header */}
              <div className="space-y-3 pt-2">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  {product.categoryName && (
                    <span className="text-xs font-bold text-brand uppercase tracking-wider">{product.categoryName}</span>
                  )}
                  {product.isDigital && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">Digital</span>
                  )}
                  {product.requiresShipping && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">Physical</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3 border-t border-[#2a2a35]/50 pt-6">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">About This Product</h2>
                <div className="text-sm text-[#9fa0b8] leading-relaxed space-y-4">
                  {isDescTooLong && !isDescExpanded ? (
                    <p>{descriptionText}</p>
                  ) : (
                    <div 
                      dangerouslySetInnerHTML={{ __html: sanitizeDescription(displayDescription) }} 
                      className="space-y-2 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_a]:text-brand [&_a]:underline"
                    />
                  )}
                  {isDescTooLong && (
                    <button
                      onClick={() => setIsDescExpanded(!isDescExpanded)}
                      className="text-xs text-brand font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {isDescExpanded ? "Read less" : "Read more →"}
                    </button>
                  )}
                </div>
              </div>

              {/* What's Included Section */}
              {includedList.length > 0 && (
                <div className="space-y-4 border-t border-[#2a2a35]/50 pt-6">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">What's Included</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {includedList.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-[#9fa0b8]">
                        <CheckCircle className="h-4.5 w-4.5 text-[#00E676] shrink-0 stroke-[2.5]" />
                        <span className="leading-tight">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Features List (Bullet Points) */}
              {featuresList.length > 0 && (
                <div className="space-y-4 border-t border-[#2a2a35]/50 pt-6">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Key Features</h2>
                  <div className="space-y-3.5">
                    {featuresList.map((feat, idx) => {
                      const isImg = feat.icon && (feat.icon.startsWith("http") || feat.icon.includes("/") || feat.icon.includes(".") || feat.icon.length > 5);
                      const resolveIconUrl = (iconStr: string) => {
                        if (!iconStr) return "";
                        if (iconStr.startsWith("http://") || iconStr.startsWith("https://") || iconStr.startsWith("data:")) {
                          return iconStr;
                        }
                        return `https://nela-app.s3.us-east-1.amazonaws.com/${iconStr}`;
                      };
                      return (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-xs shrink-0 select-none overflow-hidden mt-0.5 p-0.5">
                            {isImg ? (
                              <img src={resolveIconUrl(feat.icon)} alt="" className="w-full h-full object-contain rounded-sm" />
                            ) : (
                              feat.icon
                            )}
                          </div>
                          <div className="leading-relaxed">
                            <span className="text-xs font-bold text-white mr-1.5">{feat.title}:</span>
                            <span className="text-xs text-[#9fa0b8] font-normal">{feat.description}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FAQs Accordion */}
              {faqList.length > 0 && (
                <div className="space-y-4 border-t border-[#2a2a35]/50 pt-6">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Frequently Asked Questions</h2>
                  <div className="space-y-3">
                    {faqList.map((faq, idx) => {
                      const isExpanded = expandedFaq === idx;
                      return (
                        <div 
                          key={idx} 
                          className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl overflow-hidden transition-all shadow-sm"
                        >
                          <button
                            onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                            className="w-full px-5 py-4 flex items-center justify-between text-left text-xs font-bold text-white hover:bg-white/[0.01] transition-colors cursor-pointer"
                          >
                            <span>{faq.question}</span>
                            <ChevronDown 
                              className={cn(
                                "w-4 h-4 text-[#9fa0b8] transition-transform duration-200 shrink-0 ml-2",
                                isExpanded ? "transform rotate-180 text-white" : ""
                              )} 
                            />
                          </button>
                          {isExpanded && (
                            <div className="px-5 pb-4 text-[10px] text-[#8888a0] leading-relaxed border-t border-[#2a2a35]/30 pt-3.5">
                              {faq.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic Links - Custom Link Section for Stakeholders */}
              {hasDynamicLinks && !loadingLinks && (
                <div className="space-y-4 border-t border-[#2a2a35]/50 pt-6">
                  <div className="p-3.5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-purple-300">Customize your dynamic link!</p>
                        <p className="text-[10px] text-purple-400/80 mt-1 leading-relaxed">
                          Set your own destination URL below. Referrals clicking your link will be redirected to your custom page.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Your Referral Destinations</p>
                    {dynamicLinkData.map((dl) => (
                      <div key={dl.label} className="p-4 bg-[#0e0e12] border border-[#2a2a35] rounded-xl space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-white font-bold">{dl.label}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold border border-purple-500/30">Dynamic</span>
                          </div>
                          {dl.customLink && (
                            <button
                              onClick={() => handleDeleteCustomLink(dl.label)}
                              disabled={savingLink === dl.label}
                              className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <p className="text-[9px] text-[#6a6a7a] break-all">
                          Default: {dl.originalUrl}
                        </p>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Enter your custom URL..."
                            value={customLinkInputs[dl.label] || ""}
                            onChange={(e) =>
                              setCustomLinkInputs(prev => ({ ...prev, [dl.label]: e.target.value }))
                            }
                            className="flex-1 bg-[#14141a] border-[#2a2a35] text-white text-xs h-9"
                          />
                          <Button
                            onClick={() => handleSaveCustomLink(dl.label)}
                            disabled={savingLink === dl.label || !customLinkInputs[dl.label]?.trim()}
                            className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                          >
                            {savingLink === dl.label ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : dl.customLink ? (
                              "Update"
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                        {dl.customLink && (
                          <p className="text-[9px] text-green-400 flex items-center gap-1 font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            Custom link routing active
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasDynamicLinks && loadingLinks && (
                <div className="space-y-4 border-t border-[#2a2a35]/50 pt-6 flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                </div>
              )}

              {/* Ratings & Reviews — read-only here. Buyers write their
                  review from the order page (Purchases → a purchase), so the
                  entry point sits where ownership is unambiguous. */}
              <div className="border-t border-[#2a2a35]/50 pt-6">
                <RatingsReviewsCard
                  targetType="product"
                  targetId={product._id}
                  targetName={product.name}
                  showWriteButton={false}
                />
              </div>

              {/* More From This Seller */}
              {sellerProducts.length > 0 && (
                <div className="space-y-4 border-t border-[#2a2a35]/50 pt-6">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">More From This Seller</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {sellerProducts.map((sellerProduct) => (
                      <ProductCard
                        key={sellerProduct._id}
                        product={sellerProduct}
                        ratingSummary={sellerRatingSummaries[sellerProduct._id]}
                        isFounder={false}
                        affiliateId={affiliateId}
                        onAction={() => {
                          setViewingProduct(sellerProduct);
                          setActiveImageIndex(0);
                        }}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Sticky Sidebar Panel */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-8 min-w-0">
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl shadow-xl relative overflow-hidden select-none flex flex-col">
                
                <div className="p-6 flex flex-col gap-6 flex-1">
                  {/* Price Display */}
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white tracking-tight">
                        {formatCurrency(displayPrice, product.currency)}
                      </span>
                      <span className="text-[10px] font-bold text-[#8888a0] bg-[#1a1a22] border border-[#2a2a35] px-1.5 py-0.5 rounded uppercase">
                        {product.currency}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8888a0] font-normal leading-none">including GST</p>
                  </div>

                  {/* Subscriptions Pill */}
                  {product.isSubscription && (
                    <div className="inline-flex self-start py-1 px-3 border border-brand bg-brand/5 text-brand text-[9px] font-bold rounded-full uppercase tracking-wider">
                      Billed {product.subscriptionPeriod || "weekly"}
                    </div>
                  )}

                  {/* Checkout section */}
                  <div className="space-y-4 pt-1 border-t border-[#2a2a35]/30">
                    {/* Buy to assign reserves toggle */}
                    <div className="rounded-xl border border-[#2a2a35] bg-[#1a1a22]/30 p-3.5 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white leading-none">Buy to assign</p>
                          <p className="text-[9px] text-[#8888a0] mt-1 leading-normal">Purchase units as reserves to assign later.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBuyToAssign((v) => !v)}
                          className="relative shrink-0 rounded-full transition-colors duration-200 cursor-pointer"
                          style={{
                            width: "44px",
                            height: "24px",
                            backgroundColor: buyToAssign ? "var(--brand)" : "#2a2a35"
                          }}
                          aria-pressed={buyToAssign}
                        >
                          <span 
                            className="absolute rounded-full bg-white transition-transform duration-200"
                            style={{
                              top: "2px",
                              left: "2px",
                              width: "20px",
                              height: "20px",
                              transform: buyToAssign ? "translateX(20px)" : "translateX(0px)"
                            }}
                          />
                        </button>
                      </div>
                      {buyToAssign && (
                        <div className="flex items-center justify-between border-t border-[#2a2a35]/30 pt-3">
                          <span className="text-[10px] font-bold text-[#8888a0] uppercase tracking-wider">Quantity</span>
                          <div className="flex items-center gap-2 bg-[#0e0e12] rounded-lg border border-[#2a2a35] p-1 select-none">
                            <button type="button" onClick={() => setReserveQty((q) => Math.max(1, q - 1))}
                              className="h-6 w-6 rounded flex items-center justify-center text-white hover:bg-[#1a1a22] transition-colors text-xs cursor-pointer font-bold">−</button>
                            <span className="w-8 text-center text-xs font-bold text-white tabular-nums">{reserveQty}</span>
                            <button type="button" onClick={() => setReserveQty((q) => Math.min(99, q + 1))}
                              className="h-6 w-6 rounded flex items-center justify-center text-white hover:bg-[#1a1a22] transition-colors text-xs cursor-pointer font-bold">+</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2.5">
                      <Button
                        onClick={() => handleBuyNow()}
                        disabled={purchasing || (product.trackQuantity && product.quantity === 0)}
                        className="w-full py-3.5 bg-brand hover:opacity-90 text-brand-foreground text-xs font-bold rounded-full transition-all shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                      >
                        {purchasing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4 shrink-0" />
                            <span>
                              {product.trackQuantity && product.quantity === 0
                                ? "Out of Stock"
                                : buyToAssign
                                ? `Buy ${reserveQty} to assign`
                                : displayPrice === 0
                                ? "Join Today"
                                : product.isSubscription
                                ? "Sign Up Now"
                                : "Buy Now"}
                            </span>
                          </>
                        )}
                      </Button>

                      <button
                        onClick={handleOpenAffiliateLink}
                        className="w-full py-3.5 border border-[#2a2a35] hover:border-white bg-[#1a1a22] hover:bg-[#1a1a22]/80 text-white text-xs font-bold rounded-full transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Link2 className="h-4 w-4 shrink-0" />
                        <span>Affiliate Link</span>
                      </button>
                    </div>
                  </div>

                  {/* Delivery details box */}
                  <div className="bg-[#1a1a22]/30 border border-[#2a2a35] rounded-xl p-4 flex flex-col gap-3 text-[10px] text-[#8888a0] leading-relaxed">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-4.5 h-4.5 text-brand shrink-0 mt-0.5" />
                      <span>Instant delivery of credentials to your email address and dashboard upon purchase.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Lock className="w-4.5 h-4.5 text-brand shrink-0 mt-0.5" />
                      <span>Secure payment verification and checkout guaranteed via GaragePay gateway networks.</span>
                    </div>
                  </div>

                  {/* Seller info card */}
                  <div className="border-t border-[#2a2a35]/30 pt-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {creatorObj?.profilePicture ? (
                        <img 
                          src={creatorObj.profilePicture} 
                          alt={creatorName} 
                          className="w-9 h-9 rounded-xl object-cover shadow-inner shrink-0 select-none border border-[#2a2a35]"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-[#ffaa00] text-brand-foreground font-extrabold flex items-center justify-center text-xs shadow-inner shrink-0 select-none">
                          {creatorName.charAt(0).toUpperCase() || "🏢"}
                        </div>
                      )}
                      <div className="min-w-0 leading-tight">
                        <h4 className="text-xs font-bold text-white truncate font-inter">{creatorName}</h4>
                      </div>
                    </div>
                    <button 
                      onClick={onBack}
                      className="text-[10px] font-bold text-brand hover:underline shrink-0 cursor-pointer"
                    >
                      View all Products
                    </button>
                  </div>
                </div>

                {/* Earn Commission Footer Banner - Stretches 100% end-to-end */}
                {hasDetailPlan && product.price > 0 && (
                  <div 
                    onClick={handleOpenAffiliateLink}
                    className="w-full text-center py-3 bg-brand hover:opacity-90 text-brand-foreground text-[10px] font-bold uppercase tracking-wider cursor-pointer border-t border-[#2a2a35]/30 select-none shadow-inner transition-colors mt-auto"
                  >
                    Find out how much you can Earn
                  </div>
                )}
              </div>
            </div>

            {/* Inline invoice payment — right-side slide-in drawer */}
            {showPaymentSelector && invoiceId && (
              <div
                className="fixed inset-0 z-[9999] flex"
                role="dialog"
                aria-modal="true"
              >
                {/* Backdrop — clicking cancels the payment. */}
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                  onClick={handleInvoiceCancelledInline}
                />

                {/* Slide-in drawer panel */}
                <div className="relative ml-auto h-full w-full sm:max-w-[500px] md:max-w-[540px] bg-[#0b0b0d] border-l border-[#2a2a35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#2a2a35] bg-[#0e0e12]">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-white truncate">Complete Payment</h2>
                      <p className="text-xs text-[#9fa0b8] truncate">{product.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleInvoiceCancelledInline}
                      aria-label="Close payment"
                      className="p-1.5 rounded-full hover:bg-[#1a1a22] text-white transition-colors cursor-pointer shrink-0 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                    <CheckoutPaymentStep
                      invoiceId={invoiceId}
                      organizationName={product?.name || "Complete payment"}
                      userEmail={userProfile?.email || ""}
                      userName={userProfile?.name || undefined}
                      userPhone={userProfile?.phone || undefined}
                      onSuccess={handleInvoicePaidInline}
                      onCancel={handleInvoiceCancelledInline}
                    />
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Shipping Address Modal */}
      {showShippingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Shipping Details</h2>
                  <p className="text-sm text-[#6a6a7a]">Enter your delivery address</p>
                </div>
              </div>
              <button
                onClick={() => setShowShippingModal(false)}
                className="w-8 h-8 rounded-full bg-[#1a1a22] hover:bg-[#2a2a35] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-[#6a6a7a]" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-brand/20 flex items-center justify-center">
                    <span className="text-brand font-bold text-[10px]">1</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">Shipping Address</h3>
                </div>

                <div className="space-y-4 pl-7">
                  <div className="space-y-1.5">
                    <Label htmlFor="addressLine1" className="text-sm text-[#9fa0b8]">
                      Street Address <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="addressLine1"
                      value={shippingAddress.addressLine1}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, addressLine1: e.target.value }))}
                      placeholder="Street address, P.O. box, company name"
                      className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand/50 focus:ring-brand/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="addressLine2" className="text-sm text-[#9fa0b8]">
                      Apartment, suite, unit, etc.
                    </Label>
                    <Input
                      id="addressLine2"
                      value={shippingAddress.addressLine2 || ""}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, addressLine2: e.target.value }))}
                      placeholder="Apartment, suite, unit, building, floor"
                      className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand/50 focus:ring-brand/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-sm text-[#9fa0b8]">
                      City <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="city"
                        value={citySearch}
                        onChange={(e) => {
                          setCitySearch(e.target.value);
                          if (e.target.value !== shippingAddress.city) {
                            setShippingAddress(prev => ({ ...prev, city: e.target.value }));
                          }
                        }}
                        placeholder="Search and select city"
                        className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand/50 focus:ring-brand/20"
                      />
                      {showCityDropdown && filteredCities.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a22] border border-[#2a2a35] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                          {filteredCities.map((city, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleCitySelect(city)}
                              className="w-full px-4 py-2.5 text-left hover:bg-[#2a2a35] transition-colors border-b border-[#2a2a35] last:border-b-0 cursor-pointer"
                            >
                              <div className="font-medium text-sm text-white">{city.name}</div>
                              <div className="text-xs text-[#6a6a7a]">
                                {city.stateCode}, {city.countryCode}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-[#6a6a7a]">Type 3+ characters to search. State & country will auto-fill.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="state" className="text-sm text-[#9fa0b8]">
                        State <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="state"
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                        placeholder="State"
                        className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand/50 focus:ring-brand/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="postalCode" className="text-sm text-[#9fa0b8]">
                      Postal Code <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="postalCode"
                      value={shippingAddress.postalCode}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                      placeholder="PIN code"
                      className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand/50 focus:ring-brand/20 w-1/2"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowShippingModal(false)}
                  className="flex-1 h-11 border-[#2a2a35] text-white hover:bg-[#1a1a22] cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleShippingSubmit}
                  className="flex-1 h-11 bg-brand hover:opacity-90 text-brand-foreground font-medium cursor-pointer"
                >
                  Continue to Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Orders View Component
function OrdersView({
  orders,
  loading,
  isFounder,
  stats,
  formatCurrency,
  onRefresh,
  products,
}: {
  orders: ProductOrder[];
  loading: boolean;
  isFounder: boolean;
  stats: ProductOrderStats | null;
  formatCurrency: (value: number, currency?: string) => string;
  onRefresh: () => void;
  products: Product[];
}) {
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const orgName = typeof window !== 'undefined' ? (localStorage.getItem("garage_org_name") || "Garage Inc") : "Garage Inc";

  const handleUpdateStatus = async (orderId: string, status: ProductOrder["status"]) => {
    setUpdatingOrderId(orderId);
    try {
      await updateProductOrderStatus(orderId, status);
      toast.success("Order status updated");
      onRefresh();
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Customer view states
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);

  // Flatten orders into individual items for customer view
  const flattenedPurchases = useMemo(() => {
    if (isFounder) return [];
    return orders.flatMap(order => 
      order.items.map((item, idx) => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        invoiceShortUrl: order.invoiceShortUrl,
        currency: order.currency,
        total: order.total,
        item,
        uniqueId: `${order._id}-${idx}`
      }))
    );
  }, [orders, isFounder]);

  const totalSpent = useMemo(() => {
    if (isFounder) return 0;
    // Calculate total of unique orders
    const uniqueOrders = new Set(orders.map(o => o._id));
    return Array.from(uniqueOrders).reduce((sum, id) => {
      const order = orders.find(o => o._id === id);
      return sum + (order?.total || 0);
    }, 0);
  }, [orders, isFounder]);

  // Deep-link target from the "View Order" CTA in the order-confirmation email
  // (/workspace?open=product-orders&order=<id>). The dashboard layout stashes
  // the id in sessionStorage rather than passing a prop, because this component
  // mounts after that effect runs — the same handoff DealsApp uses for
  // `deals:inline-pending-lead-id`. Read once on mount and clear immediately so
  // a back-navigation later in the session can't re-trigger it.
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const id = sessionStorage.getItem("products:pending-order-id");
      if (id) {
        setPendingOrderId(id);
        sessionStorage.removeItem("products:pending-order-id");
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Resolve against the list rather than on mount — the orders fetch is async,
  // so on the first pass `orders` is still empty.
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingOrderId || loading || orders.length === 0) return;

    // Buyer: jump straight into the purchase detail. That view is where the
    // digital download links live, which is the whole point of the email CTA.
    if (!isFounder) {
      const match = flattenedPurchases.find((p) => p.orderId === pendingOrderId);
      if (match) {
        setSelectedPurchase(match);
        setPendingOrderId(null);
        return;
      }
    }

    // Founder view (one flat card per order), or a buyer whose order didn't
    // flatten into a row: scroll it into view and flash it instead.
    if (orders.some((o) => o._id === pendingOrderId)) {
      setHighlightOrderId(pendingOrderId);
    }
    setPendingOrderId(null);
  }, [pendingOrderId, loading, orders, flattenedPurchases, isFounder]);

  const highlightRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!highlightOrderId) return;
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlightOrderId(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightOrderId]);

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'fig') return { icon: Image, color: 'text-purple-400', bg: 'bg-purple-400/10' };
    if (ext === 'pdf') return { icon: FileText, color: 'text-red-400', bg: 'bg-red-400/10' };
    if (ext === 'zip' || ext === 'rar' || ext === 'tar' || ext === 'gz') return { icon: FolderOpen, color: 'text-amber-400', bg: 'bg-amber-400/10' };
    if (ext === 'mp4' || ext === 'mov' || ext === 'avi' || ext === 'mkv') return { icon: Video, color: 'text-blue-400', bg: 'bg-blue-400/10' };
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return { icon: Table, color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
    return { icon: File, color: 'text-gray-400', bg: 'bg-gray-400/10' };
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return "N/A";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getRealTotalSize = (assets: any[]) => {
    if (!assets || assets.length === 0) return "0 Bytes";
    let totalBytes = 0;
    let hasValidSizes = false;
    assets.forEach((asset) => {
      if (asset.fileSize !== undefined && asset.fileSize !== null) {
        totalBytes += asset.fileSize;
        hasValidSizes = true;
      }
    });
    if (!hasValidSizes) return "N/A";
    return formatSize(totalBytes);
  };

  const getCustomerStatusBadge = (paymentStatus: string, status: string) => {
    if (paymentStatus === "paid") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
          Complete
        </span>
      );
    }
    if (paymentStatus === "failed" || status === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
        Pending
      </span>
    );
  };

  const handleDownloadAll = (assets: any[]) => {
    toast.success("Starting download of all files...");
    assets.forEach((asset) => {
      window.open(asset.fileUrl, "_blank");
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  // --- 1. Customer Detailed View Mode ---
  if (!isFounder && selectedPurchase) {
    const { item, createdAt, orderNumber, paymentMethod, total, currency, invoiceShortUrl } = selectedPurchase;
    const assets = item.digitalAssets || [];
    const links = item.digitalLinks || [];
    const totalFilesCount = assets.length;
    const formattedTotalSize = getRealTotalSize(assets);

    const matchedProduct = products.find(p => p._id === item.productId);
    const sellerObj = matchedProduct?.createdBy && typeof matchedProduct.createdBy === "object" ? matchedProduct.createdBy : null;
    const sellerName = sellerObj?.name || orgName;

    return (
      <div className="space-y-6">
        {/* Back Link / Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPurchase(null)}
            className="flex items-center gap-2 text-sm text-[#9fa0b8] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Purchases</span>
          </button>
        </div>

        {/* Product Details Header */}
        <div className="flex items-center gap-4 bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6">
          <div className="w-16 h-16 rounded-xl bg-[#1a1a22] flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#2a2a35]">
            {item.productImage ? (
              <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-brand font-bold text-2xl">
                {item.productName?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{item.productName}</h2>
            <p className="text-sm text-[#6b6b80] mt-1">Sold by {sellerName}</p>
            <p className="text-xs text-[#9fa0b8] mt-0.5">
              Purchased on {new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (Files + Digital Links) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Files Card */}
            {totalFilesCount > 0 && (
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4 border-b border-[#2a2a35] pb-4">
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-brand" />
                    <h3 className="text-lg font-semibold text-white">Files</h3>
                  </div>
                  <Button
                    onClick={() => handleDownloadAll(assets)}
                    className="bg-brand hover:opacity-90 text-brand-foreground text-xs font-semibold px-4 py-1.5 h-auto rounded-lg"
                  >
                    Download All
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#1a1a22] text-[#6b6b80] font-medium text-xs">
                        <th className="pb-3">FILE NAME</th>
                        <th className="pb-3">TYPE</th>
                        <th className="pb-3">SIZE</th>
                        <th className="pb-3 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a22]">
                      {assets.map((asset: any, idx: number) => {
                        const fileMeta = getFileIcon(asset.name);
                        const FileIcon = fileMeta.icon;
                        const sizeStr = formatSize(asset.fileSize);
                        const fileTypeLabel = asset.name.split('.').pop()?.toUpperCase() || "FILE";

                        return (
                          <tr key={idx} className="hover:bg-[#14141a]/30 transition-colors">
                            <td className="py-3.5 pr-3">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", fileMeta.bg)}>
                                  <FileIcon className={cn("w-4 h-4", fileMeta.color)} />
                                </div>
                                <span className="font-medium text-white max-w-[240px] truncate" title={asset.name}>
                                  {asset.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 text-[#9fa0b8] font-medium">{fileTypeLabel}</td>
                            <td className="py-3.5 text-[#9fa0b8] font-mono">{sizeStr}</td>
                            <td className="py-3.5 text-right">
                              <a
                                href={asset.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-brand hover:underline font-semibold"
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#1a1a22] pt-4 mt-4 text-xs font-semibold text-[#6b6b80]">
                  <span>{totalFilesCount} files{formattedTotalSize !== "N/A" ? ` - ${formattedTotalSize} total` : ""}</span>
                  <button
                    onClick={() => handleDownloadAll(assets)}
                    className="text-brand hover:underline inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download All{formattedTotalSize !== "N/A" ? ` (${formattedTotalSize})` : ""}
                  </button>
                </div>
              </div>
            )}

            {/* Digital Links Card */}
            {links.length > 0 && (
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4 border-b border-[#2a2a35] pb-4">
                  <Link2 className="h-5 w-5 text-brand" />
                  <h3 className="text-lg font-semibold text-white">Digital Links</h3>
                </div>

                <div className="space-y-3">
                  {links.map((link: any, idx: number) => {
                    const hostname = new URL(link.url).hostname || "external-resource";
                    return (
                      <div
                        key={idx}
                        className="bg-[#13131a] border border-[#1a1a22] p-4 rounded-xl flex items-center justify-between gap-4 hover:border-[#2a2a35] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                            <Link2 className="w-4 h-4 text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-white text-sm truncate" title={link.label}>
                              {link.label}
                            </h4>
                            <p className="text-xs text-[#6b6b80] truncate">{hostname}</p>
                          </div>
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand hover:underline text-xs font-semibold flex-shrink-0 inline-flex items-center gap-1"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column (Order Summary) */}
          <div className="space-y-6">
            {/* Order Summary Card */}
            <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Order Summary</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6b6b80]">Order ID</span>
                  <span className="font-mono text-white">#{orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b6b80]">Purchase Date</span>
                  <span className="text-white">
                    {new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b6b80]">Payment Method</span>
                  <span className="text-white">{paymentMethod || "GaragePay"}</span>
                </div>

                <div className="h-px bg-[#1a1a22] my-4" />

                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">Total Paid</span>
                  <span className="text-lg font-bold text-brand">
                    {formatCurrency(total, currency)}
                  </span>
                </div>
              </div>

              <Button
                onClick={() => {
                  if (invoiceShortUrl) {
                    window.open(invoiceShortUrl, "_blank");
                  } else {
                    toast.info("Invoice receipt download started.");
                  }
                }}
                className="w-full bg-[#1c1c24] hover:bg-[#252530] text-white border border-[#2a2a35] py-2.5 rounded-lg mt-5 flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Download Receipt
              </Button>
            </div>

            {/* Ratings & Reviews — the write entry point for a product lives
                here, on the order the buyer owns, not on the Discover side.
                Keyed by product rather than by order, so buying the same
                product again edits that one review instead of adding another. */}
            {item.productId && selectedPurchase.paymentStatus === "paid" && (
              <RatingsReviewsCard
                targetType="product"
                targetId={item.productId}
                targetName={item.productName}
                className="bg-[#0e0e12] rounded-xl p-6 shadow-none"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- 2. Customer Tabular List View Mode ---
  if (!isFounder) {
    return (
      <div className="space-y-6">
        {flattenedPurchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0e0e12] border border-[#2a2a35] rounded-xl">
            <Package className="h-12 w-12 text-[#9fa0b8] mb-4" />
            <p className="text-[#9fa0b8] font-medium">No purchases yet</p>
            <p className="text-sm text-[#6b6b80] mt-2">
              Products you buy will appear here
            </p>
          </div>
        ) : (
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#1a1a22] text-[#6b6b80] font-medium text-xs tracking-wider">
                    <th className="py-4 px-6">PRODUCT</th>
                    <th className="py-4 px-6">TYPE</th>
                    <th className="py-4 px-6">DATE</th>
                    <th className="py-4 px-6">AMOUNT</th>
                    <th className="py-4 px-6">STATUS</th>
                    <th className="py-4 px-6">TOTAL FILES</th>
                    <th className="py-4 px-6 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a22]">
                  {flattenedPurchases.map((purchase) => {
                    const totalFiles = purchase.item.digitalAssets?.length || 0;
                    const isHighlighted = purchase.orderId === highlightOrderId;
                    return (
                      <tr
                        key={purchase.uniqueId}
                        ref={isHighlighted ? (highlightRef as React.RefObject<HTMLTableRowElement>) : undefined}
                        onClick={() => setSelectedPurchase(purchase)}
                        className={cn(
                          "hover:bg-[#14141a]/50 cursor-pointer transition-colors group",
                          isHighlighted && "bg-brand/10 ring-1 ring-inset ring-brand/50"
                        )}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#1a1a22] flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#2a2a35]">
                              {purchase.item.productImage ? (
                                <img src={purchase.item.productImage} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-brand font-bold text-lg">
                                  {purchase.item.productName?.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="font-semibold text-white group-hover:text-brand transition-colors">
                              {purchase.item.productName}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs">
                            {purchase.item.isDigital ? "Digital Product" : "Physical Product"}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-[#9fa0b8]">
                          {new Date(purchase.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="py-4 px-6 text-white font-medium">
                          {formatCurrency(purchase.item.totalPrice, purchase.currency)}
                        </td>
                        <td className="py-4 px-6">
                          {getCustomerStatusBadge(purchase.paymentStatus, purchase.status)}
                        </td>
                        <td className="py-4 px-6 text-[#9fa0b8]">
                          {totalFiles} {totalFiles === 1 ? "file" : "files"}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPurchase(purchase);
                            }}
                            className="text-brand hover:underline text-xs font-semibold inline-flex items-center gap-1"
                          >
                            View &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Summary Bar */}
            <div className="bg-[#0b0b0d]/60 border-t border-[#1a1a22] px-6 py-4 flex items-center justify-between text-sm">
              <span className="text-[#6b6b80]">
                Showing {flattenedPurchases.length} of {flattenedPurchases.length} purchases
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[#6b6b80]">Total Spent:</span>
                <span className="text-brand font-bold text-lg">
                  {formatCurrency(totalSpent, orders[0]?.currency)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 3. Founder Mode View ---
  return (
    <div className="space-y-6">
      {/* Stats for founder */}
      {isFounder && stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-brand" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
                <p className="text-sm text-[#9fa0b8]">Total Orders</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-sm text-[#9fa0b8]">Total Revenue</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-orange-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.pendingOrders}</p>
                <p className="text-sm text-[#9fa0b8]">Pending Orders</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Boxes className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.completedOrders}</p>
                <p className="text-sm text-[#9fa0b8]">Completed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders list */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-[#9fa0b8] mb-4" />
          <p className="text-[#9fa0b8]">
            {isFounder ? "No orders yet" : "No purchases yet"}
          </p>
          <p className="text-sm text-[#9fa0b8] mt-2">
            {isFounder ? "Orders will appear here when customers make purchases" : "Products you buy will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order._id}
              ref={order._id === highlightOrderId ? (highlightRef as React.RefObject<HTMLDivElement>) : undefined}
              className={cn(
                "bg-[#0e0e12] border rounded-lg p-4 transition-colors",
                order._id === highlightOrderId
                  ? "border-brand/50 ring-1 ring-brand/30"
                  : "border-[#2a2a35]"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white font-medium">Order #{order.orderNumber}</p>
                  <p className="text-sm text-[#9fa0b8]">
                    {new Date(order.createdAt).toLocaleDateString()} at{" "}
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </p>
                  {isFounder && typeof order.userId === "object" && (
                    <p className="text-sm text-[#9fa0b8] mt-1">
                      Customer: {order.userId.name} ({order.userId.email})
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    order.status === "delivered" ? "bg-green-500/20 text-green-400" :
                      order.status === "shipped" ? "bg-blue-500/20 text-blue-400" :
                        order.status === "processing" ? "bg-purple-500/20 text-purple-400" :
                          order.status === "confirmed" ? "bg-cyan-500/20 text-cyan-400" :
                            order.status === "cancelled" ? "bg-red-500/20 text-red-400" :
                              order.status === "refunded" ? "bg-gray-500/20 text-gray-400" :
                                "bg-yellow-500/20 text-yellow-400"
                  )}>
                    {order.status}
                  </span>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    order.paymentStatus === "paid" ? "bg-green-500/20 text-green-400" :
                      order.paymentStatus === "failed" ? "bg-red-500/20 text-red-400" :
                        order.paymentStatus === "refunded" ? "bg-gray-500/20 text-gray-400" :
                          "bg-yellow-500/20 text-yellow-400"
                  )}>
                    {order.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Order items */}
              <div className="space-y-2 mb-4">
                {order.items.map((item, idx) => (
                  <div key={idx} className="bg-[#1a1a22] rounded-lg">
                    <div className="flex items-center gap-3 p-2">
                      <div className="w-12 h-12 bg-[#2a2a35] rounded-lg flex-shrink-0">
                        {item.productImage ? (
                          <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-[#9fa0b8]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm">{item.productName}</p>
                          {item.isDigital && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              Digital
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#9fa0b8]">
                          Qty: {item.quantity} × {formatCurrency(item.unitPrice, order.currency)}
                        </p>
                      </div>
                      <p className="text-sm text-brand">
                        {formatCurrency(item.totalPrice, order.currency)}
                      </p>
                    </div>
                    {/* Digital assets download - show only for paid orders and non-founders (customers) */}
                    {item.isDigital && item.digitalAssets && item.digitalAssets.length > 0 && order.paymentStatus === "paid" && !isFounder && (
                      <div className="px-2 pb-2">
                        <div className="border-t border-[#2a2a35] pt-2 mt-1">
                          <p className="text-xs text-[#9fa0b8] mb-2">Download your files:</p>
                          <div className="flex flex-wrap gap-2">
                            {item.digitalAssets.map((asset, assetIdx) => (
                              <a
                                key={assetIdx}
                                href={asset.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand rounded-lg hover:bg-brand/20 transition-colors text-sm"
                              >
                                <Download className="w-3.5 h-3.5" />
                                {asset.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Digital assets - show for founders viewing orders */}
                    {item.isDigital && item.digitalAssets && item.digitalAssets.length > 0 && isFounder && (
                      <div className="px-2 pb-2">
                        <div className="border-t border-[#2a2a35] pt-2 mt-1">
                          <p className="text-xs text-[#9fa0b8]">
                            <FileText className="w-3 h-3 inline mr-1" />
                            {item.digitalAssets.length} digital file{item.digitalAssets.length > 1 ? "s" : ""} included
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Digital links - show only for paid orders and non-founders (customers) */}
                    {item.isDigital && item.digitalLinks && item.digitalLinks.length > 0 && order.paymentStatus === "paid" && !isFounder && (
                      <div className="px-2 pb-2">
                        <div className="border-t border-[#2a2a35] pt-2 mt-1">
                          <p className="text-xs text-[#9fa0b8] mb-2">Access your content:</p>
                          <div className="flex flex-wrap gap-2">
                            {item.digitalLinks.map((link, linkIdx) => (
                              <a
                                key={linkIdx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors text-sm"
                                title={link.description}
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                {link.label}
                                {link.isCustomLink && (
                                  <span className="text-[10px] text-purple-300/70 ml-1">(via referral)</span>
                                )}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Digital links - show for founders viewing orders */}
                    {item.isDigital && item.digitalLinks && item.digitalLinks.length > 0 && isFounder && (
                      <div className="px-2 pb-2">
                        <div className="border-t border-[#2a2a35] pt-2 mt-1">
                          <p className="text-xs text-[#9fa0b8]">
                            <Link2 className="w-3 h-3 inline mr-1" />
                            {item.digitalLinks.length} digital link{item.digitalLinks.length > 1 ? "s" : ""} included
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#2a2a35]">
                <div>
                  <p className="text-lg font-semibold text-brand">
                    Total: {formatCurrency(order.total, order.currency)}
                  </p>
                  {order.requiresShipping && order.trackingNumber && (
                    <p className="text-sm text-[#9fa0b8] mt-1">
                      <Truck className="h-4 w-4 inline mr-1" />
                      Tracking: {order.trackingNumber}
                    </p>
                  )}
                </div>
                {isFounder && order.status !== "delivered" && order.status !== "cancelled" && order.status !== "refunded" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingOrderId === order._id}
                        className="border-[#2a2a35] text-white hover:bg-[#1a1a22]"
                      >
                        {updatingOrderId === order._id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Edit className="h-4 w-4 mr-2" />
                        )}
                        Update Status
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1a1a22] border-[#2a2a35]">
                      {order.status === "pending" && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(order._id, "confirmed")} className="text-white hover:bg-[#2a2a35]">
                          Confirm Order
                        </DropdownMenuItem>
                      )}
                      {(order.status === "pending" || order.status === "confirmed") && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(order._id, "processing")} className="text-white hover:bg-[#2a2a35]">
                          Mark as Processing
                        </DropdownMenuItem>
                      )}
                      {(order.status === "processing" || order.status === "confirmed") && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(order._id, "shipped")} className="text-white hover:bg-[#2a2a35]">
                          Mark as Shipped
                        </DropdownMenuItem>
                      )}
                      {order.status === "shipped" && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(order._id, "delivered")} className="text-white hover:bg-[#2a2a35]">
                          Mark as Delivered
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleUpdateStatus(order._id, "cancelled")} className="text-red-400 hover:bg-[#2a2a35]">
                        Cancel Order
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
