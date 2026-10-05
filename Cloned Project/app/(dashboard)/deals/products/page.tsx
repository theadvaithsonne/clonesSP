"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Download, Plus, ArrowLeft, ChevronLeft, ChevronRight, Search, Package, Briefcase, MoreHorizontal, Filter, ChevronDown, X, Check } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { ProductsDataTable } from "@/components/deals/products/ProductsDataTable";
import type { SortState } from "@/components/ui/data-table/types";
import CRMSidebar from "@/components/crm/CRMSidebar";
import DealsNavbar from "@/components/crm/DealsNavbar";
import { useTheme } from "next-themes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import ProductOnboardingFlow from "@/components/deals/ProductOnboardingFlow";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { useDealsInlineRefresh } from "@/lib/deals-events";
import { toast } from "sonner";
import { uploadFiles } from "@/utils/uploadthing";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

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
import { Label } from "@/components/ui/label";
import ViewFunnelDialog from "@/components/crm/ViewFunnelDialog";
import DeleteLeadsDialog from "@/components/crm/leads/DeleteLeadsDialog";
import { UploadCloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

export default function ProductPage() {
  const { theme } = useTheme();
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
  const isFigma = isInlineDealsMode;
  const resolvedTheme =
    theme === "color" ? "color" : theme === "dark" || isInlineDealsMode ? "dark" : "light";
  const [showListView, setShowListView] = useState(true); // Changed to true to show list view by default
  const [activeTab, setActiveTab] = useState("products"); // This state is for the nested Products/Services tabs
  const [isAdd, setIsAdd] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editProductData, setEditProductData] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // Track selected product for viewing
  const [isProductEditMode, setIsProductEditMode] = useState(false); // Track edit mode for product view
  const [editableProduct, setEditableProduct] = useState<Product | null>(null); // Track editable product data
  const [isSaving, setIsSaving] = useState(false); // State for saving loading
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false); // State for delete confirmation dialog
  const [productToDelete, setProductToDelete] = useState<Product | null>(null); // State for product to delete from list view
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // View funnel states
  const [isViewFunnelOpen, setIsViewFunnelOpen] = useState(false);
  const [viewingFunnel, setViewingFunnel] = useState<any>(null);
  const [isLoadingFunnelDetails, setIsLoadingFunnelDetails] = useState(false);

  // View product states
  const [isViewProductOpen, setIsViewProductOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isLoadingProductDetails, setIsLoadingProductDetails] = useState(false);

  // Document management states
  const [documentName, setDocumentName] = useState("");
  const [productBrochure, setProductBrochure] = useState<{ name: string; url: string } | null>(null);
  const [documents, setDocuments] = useState<Array<{ docName: string; docLink: string }>>([]);
  const [showUploadForm, setShowUploadForm] = useState(false); // State to control document upload form visibility
  const [originalDocuments, setOriginalDocuments] = useState<Array<{ docName: string; docLink: string }>>([]); // Track original documents for comparison
  const [removedDocuments, setRemovedDocuments] = useState<Array<{ docName: string; docLink: string }>>([]); // Track removed documents
  const [isUploadingBrochure, setIsUploadingBrochure] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  // New modal & filter states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formType, setFormType] = useState<"product" | "service">("product");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formUnit, setFormUnit] = useState<"hourly" | "monthly" | "yearly" | "daily" | "weekly" | "one-time" | "per-unit" | "">("monthly");
  const [formStatus, setFormStatus] = useState<"Active" | "Pause" | "Inactive">("Active");
  const [formDescription, setFormDescription] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "products" | "services">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pause" | "inactive">("all");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempTypeFilter, setTempTypeFilter] = useState<"all" | "products" | "services">("all");
  const [tempStatusFilter, setTempStatusFilter] = useState<"all" | "active" | "pause" | "inactive">("all");
  const [activeFilterCategory, setActiveFilterCategory] = useState<"type" | "status">("type");
  const [formErrors, setFormErrors] = useState({
    name: "",
    category: "",
    price: "",
  });

  const resetModalForm = () => {
    setFormType("product");
    setFormName("");
    setFormCode("");
    setFormCategory("");
    setFormPrice("");
    setFormUnit("monthly");
    setFormStatus("Active");
    setFormDescription("");
    setEditingProductId(null);
    setFormErrors({ name: "", category: "", price: "" });
  };

  const openAddProductModal = () => {
    resetModalForm();
    setModalMode("add");
    setIsProductModalOpen(true);
  };

  useEffect(() => {
    const onOpenAdd = () => openAddProductModal();
    window.addEventListener("deals:open-add-product", onOpenAdd);
    return () => window.removeEventListener("deals:open-add-product", onOpenAdd);
  }, []);

  const openEditProductModal = (product: Product) => {
    setModalMode("edit");
    const isService = Boolean(product.serviceId);
    setFormType(isService ? "service" : "product");
    setFormName(product.name || "");
    setFormCode((product.productId || product.serviceId || "").toString());
    setFormCategory(product.category || "");

    // Handle pricing - if unit exists, use it; otherwise try to parse from pricing string
    if (product.unit) {
      // If unit is separate, use pricing as number and unit as string
      const price = typeof product.pricing === 'number'
        ? product.pricing
        : parseFloat(product.pricing?.toString() || "0") || 0;
      setFormPrice(price.toString());
      setFormUnit((product.unit?.toLowerCase() as any) || "monthly");
    } else {
      // Fallback: try to parse from pricing string if it's in "price/unit" format
      const pricingStr = (product.pricing ?? "").toString();
      if (pricingStr.includes("/")) {
        const [amount, unit] = pricingStr.split("/");
        setFormPrice(amount);
        setFormUnit((unit?.toLowerCase() as any) || "");
      } else {
        setFormPrice(pricingStr);
        setFormUnit("monthly");
      }
    }
    const statusStr = (product.status || "Active").toString();
    const normalized = statusStr.toLowerCase();
    const titleCase = normalized === "active" ? "Active" : normalized === "pause" ? "Pause" : normalized === "inactive" ? "Inactive" : "Active";
    setFormStatus(titleCase);
    setFormDescription(product.description || "");
    setEditingProductId(product._id);
    setFormErrors({ name: "", category: "", price: "" });
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProductId(null);
  };

  const handleSubmitProductModal = async () => {
    try {
      const trimmedName = formName.trim();
      const trimmedCategory = formCategory.trim();
      const parsedPrice = formPrice === "" ? NaN : parseFloat(formPrice);

      const nextErrors = {
        name: trimmedName ? "" : "Product name is required",
        category: trimmedCategory ? "" : "Category is required",
        price:
          !Number.isFinite(parsedPrice) || parsedPrice <= 0
            ? "Price must be greater than 0"
            : "",
      };

      setFormErrors(nextErrors);

      const firstErrorMessage = Object.values(nextErrors).find((msg) => msg);
      if (firstErrorMessage) {
        toast.error(firstErrorMessage);
        return;
      }

      const isService = formType === "service";
      const payload: any = {
        type: formType,
        name: trimmedName,
        pricing: parsedPrice,
        unit: formUnit || "",
        category: trimmedCategory,
        status: formStatus.toLowerCase(),
        description: formDescription,
      };
      if (isService) payload.serviceId = formCode;
      else payload.productId = formCode;

      if (modalMode === "add") {
        const res = await authenticatedFetch(buildExternalUrl("/crm/products"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Failed to create: ${res.status}`);
        toast.success("Product created successfully!");
      } else {
        if (!editingProductId) throw new Error("No product selected for edit");
        const res = await authenticatedFetch(buildExternalUrl(`/crm/products/${editingProductId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Failed to update: ${res.status}`);
        toast.success("Product updated successfully!");
      }

      closeProductModal();
      await fetchProducts();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Operation failed. Please try again.");
    }
  };


  // Define the type for your product/service data
  type Product = {
    updatedAt: any;
    _id: string;
    productId?: string;
    serviceId?: string;
    name: string;
    status?: "Active" | "Pause" | "Inactive";
    category: string;
    pricing: string | number;
    unit?: string;
    maxDiscount: string;
    description: string;
    commissionType: string;
    commissionPercentage: string;
    productBrochure?: { name: string; url: string } | null;
    documents?: Array<{ docName: string; docLink: string }>;
    userId: string;
  };

  // State for products
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [limit, setLimit] = useState(50);

  // Column sort for the BackOffice DataTable — the catalogue is paginated
  // client-side, so this orders the full filtered list.
  const [productsSort, setProductsSort] = useState<SortState | null>(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Filter products and services based on active tab
  const filteredProducts = products.filter((product) => {
    if (activeTab === "products") {
      return product.productId; // Only show products with productId
    } else {
      return product.serviceId; // Only show services with serviceId
    }
  });

  const totalFilteredProducts = filteredProducts.length;

  // Client-side pagination for filtered results
  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedFilteredProducts = filteredProducts.slice(startIndex, endIndex);

  // Fetch products from API with pagination
  const fetchProducts = async (page: number = currentPage) => {
    setIsLoadingProducts(true);
    try {
      // Fetch all products without pagination to get accurate filtering
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/products?skip=0&limit=1000`) // Get all products
      );
      if (response.ok) {
        const data = await response.json();
        const allProducts = data.products || data || [];
        setProducts(allProducts);

        // Update total products count
        if (data.total !== undefined) {
          setTotalProducts(data.total);
        } else if (data.pagination && data.pagination.total !== undefined) {
          setTotalProducts(data.pagination.total);
        } else {
          setTotalProducts(allProducts.length);
        }
      } else {
        console.error("Failed to fetch products");
        setProducts([]);
        setTotalProducts(0);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setIsLoadingProducts(false);
    }
  };


  // Fetch products on component mount and when isAdd changes
  useEffect(() => {
    fetchProducts();
  }, [isAdd]);

  useDealsInlineRefresh("products", () => {
    fetchProducts(currentPage);
  });

  // Update pagination when filtered products change
  useEffect(() => {
    setTotalPages(Math.ceil(filteredProducts.length / limit));
    // Reset to first page if current page is beyond available pages
    if (currentPage > Math.ceil(filteredProducts.length / limit) && filteredProducts.length > 0) {
      setCurrentPage(1);
    }
  }, [filteredProducts.length, currentPage, limit]);

  console.log("Total Products:", totalProducts);

  // Pagination functions
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Search functionality
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching

    if (term.trim()) {
      // Use search API when there's a search term
      await searchProducts(term);
    } else {
      // Fetch normal paginated products when search is cleared
      await fetchProducts(1);
    }
  };

  // Search products using the search API
  const searchProducts = async (searchTerm: string) => {
    setIsLoadingProducts(true);
    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/searchproduct?q=${encodeURIComponent(searchTerm)}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const searchResults = data.products || data || [];
        setProducts(searchResults);

        // For search results, we don't have pagination info, so we'll show all results
        setTotalProducts(searchResults.length);
        setTotalPages(1);
      } else {
        console.error("Failed to search products");
        // Fallback to normal fetch if search fails
        await fetchProducts(1);
      }
    } catch (error) {
      console.error("Error searching products:", error);
      // Fallback to normal fetch if search fails
      await fetchProducts(1);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Function to handle product selection for viewing
  // Handle view product
  const handleViewProduct = async (productId: string) => {
    if (!productId) return;

    setIsLoadingProductDetails(true);
    setIsViewProductOpen(true);

    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/products/${productId}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const productData = await response.json();
        setViewingProduct(productData);
      } else {
        toast.error("Failed to load product details");
        setIsViewProductOpen(false);
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
      toast.error("Failed to load product details");
      setIsViewProductOpen(false);
    } finally {
      setIsLoadingProductDetails(false);
    }
  };

  // Handle view funnel
  const handleViewFunnel = async (funnelId: string) => {
    if (!funnelId) return;

    setIsLoadingFunnelDetails(true);
    setIsViewFunnelOpen(true);

    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/funnels/${funnelId}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const funnelData = await response.json();
        setViewingFunnel(funnelData);
      } else {
        toast.error("Failed to load funnel details");
        setIsViewFunnelOpen(false);
      }
    } catch (error) {
      console.error("Error fetching funnel details:", error);
      toast.error("Failed to load funnel details");
      setIsViewFunnelOpen(false);
    } finally {
      setIsLoadingFunnelDetails(false);
    }
  };

  const handleProductView = async (product: Product) => {
    // Fetch fresh product data first
    const freshProductData = await fetchProductData(product._id);

    if (freshProductData) {
      setSelectedProduct(freshProductData);
      setOriginalDocuments(freshProductData.documents || []); // Track original documents
      setProductBrochure(null); // Reset brochure state
      setDocuments([]); // Reset documents state
      setRemovedDocuments([]); // Reset removed documents state
    } else {
      // Fallback to the product data from the list if fetch fails
      setSelectedProduct(product);
      setOriginalDocuments(product.documents || []); // Track original documents
      setProductBrochure(null); // Reset brochure state
      setDocuments([]); // Reset documents state
      setRemovedDocuments([]); // Reset removed documents state
    }
  };

  // Function to fetch individual product data
  const fetchProductData = async (productId: string) => {
    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`/crm/products/${productId}`)
      );
      if (response.ok) {
        const productData = await response.json();
        return productData;
      } else {
        console.error("Failed to fetch product data");
        return null;
      }
    } catch (error) {
      console.error("Error fetching product data:", error);
      return null;
    }
  };

  // Function to go back to list view
  const handleBackToList = () => {
    setSelectedProduct(null);
    setIsProductEditMode(false);
    setEditableProduct(null);
    setOriginalDocuments([]); // Reset original documents
    setProductBrochure(null); // Reset brochure state
    setDocuments([]); // Reset documents state
    setRemovedDocuments([]); // Reset removed documents state
  };

  // Check if user is admin (you can replace this with your actual auth logic)
  const isAdmin = true; // TODO: Replace with actual admin check from your auth system

  // Function to handle edit mode toggle
  const handleEditModeToggle = () => {
    if (isProductEditMode) {
      // Cancel edit mode
      setIsProductEditMode(false);
      setEditableProduct(null);
    } else {
      // Enter edit mode
      setIsProductEditMode(true);
      // Ensure we create a deep copy and handle all fields properly
      const editableData = {
        _id: selectedProduct!._id,
        productId: selectedProduct!.productId,
        serviceId: selectedProduct!.serviceId,
        name: selectedProduct!.name || "",
        status: selectedProduct!.status || "Active",
        category: selectedProduct!.category || "",
        pricing: selectedProduct!.pricing || "",
        maxDiscount: selectedProduct!.maxDiscount || "",
        description: selectedProduct!.description || "",
        commissionType: selectedProduct!.commissionType || "",
        commissionPercentage: selectedProduct!.commissionPercentage || "",
        productBrochure: selectedProduct!.productBrochure,
        documents: selectedProduct!.documents,
        userId: selectedProduct!.userId,
      };
      console.log("Setting editable product:", editableData);
      console.log("Original category:", selectedProduct!.category);
      setEditableProduct({
        ...editableData,
        updatedAt: selectedProduct?.updatedAt,
      });
    }
  };

  // Function to handle field updates
  const handleFieldUpdate = (field: keyof Product, value: string) => {
    if (editableProduct) {
      setEditableProduct({
        ...editableProduct,
        [field]: value,
      });
    }
  };

  // Function to save changes
  const handleSaveChanges = async () => {
    if (editableProduct && selectedProduct) {
      setIsSaving(true);
      try {
        // Make API call to update product
        const response = await authenticatedFetch(
          buildExternalUrl(`/crm/products/${editableProduct._id}`),
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: editableProduct.name,
              status: editableProduct.status?.toLowerCase(),
              category: editableProduct.category,
              pricing: editableProduct.pricing,
              maxDiscount: editableProduct.maxDiscount,
              description: editableProduct.description,
              commissionType: editableProduct.commissionType,
              commissionPercentage: editableProduct.commissionPercentage,
            }),
          }
        );

        if (response.ok) {
          // Update the selected product with new data
          setSelectedProduct(editableProduct);
          setIsProductEditMode(false);
          setEditableProduct(null);

          // Show success message (you can add a toast notification here)
          console.log("Product updated successfully");
          toast.success("Product updated successfully!"); // Temporary success message

          // Refresh the products list
          await fetchProducts();
        } else {
          const errorData = await response.json();
          console.error("Failed to update product:", errorData);
          // Show error message to user
          toast.error(
            `Failed to update product: ${errorData.message || "Unknown error"}`
          );
        }
      } catch (error) {
        console.error("Error updating product:", error);
        toast.error("Error updating product. Please try again.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Function to handle product deletion
  const handleDeleteProduct = async () => {
    const productToDeleteFromList = selectedProduct || productToDelete;
    if (productToDeleteFromList) {
      setIsSaving(true);
      try {
        const response = await authenticatedFetch(
          buildExternalUrl(`/crm/products/${productToDeleteFromList._id}`),
          {
            method: "DELETE",
          }
        );

        if (response.ok) {
          toast.success("Product deleted successfully!");
          setIsDeleteConfirmOpen(false);

          // Clear states based on where deletion was initiated
          if (selectedProduct) {
            // Deleted from overview view
            setSelectedProduct(null);
            setIsProductEditMode(false);
            setEditableProduct(null);
          }

          // Clear list view deletion state
          setSelectedProductIds((prev) =>
            prev.filter((id) => id !== productToDeleteFromList._id)
          );
          setProductToDelete(null);

          // Refresh the products list
          await fetchProducts();
        } else {
          const errorData = await response.json();
          console.error("Failed to delete product:", errorData);
          toast.error(
            `Failed to delete product: ${errorData.message || "Unknown error"}`
          );
        }
      } catch (error) {
        console.error("Error deleting product:", error);
        toast.error("Error deleting product. Please try again.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Function to handle delete from list view
  const handleDeleteFromList = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };

  // Function to handle edit from list view
  const handleEditFromList = (product: Product) => {
    openEditProductModal(product);
  };

  const handleToggleProductSelection = (productId: string, checked: boolean) => {
    setSelectedProductIds((prev) =>
      checked ? (prev.includes(productId) ? prev : [...prev, productId]) : prev.filter((id) => id !== productId)
    );
  };

  const formatProductPrice = (product: Product) => {
    if (product.pricing === null || product.pricing === undefined) return "";
    const price =
      typeof product.pricing === "number"
        ? product.pricing
        : parseFloat(product.pricing.toString()) || 0;
    return product.unit
      ? `₹${price.toLocaleString()}/${product.unit}`
      : `₹${price.toLocaleString()}`;
  };

  const getProductCode = (product: Product) =>
    String(product.productId || product.serviceId || "");

  const getProductUpdated = (product: Product) =>
    product.updatedAt ? new Date(product.updatedAt as any).toISOString().split("T")[0] : "";

  const sortProducts = (rows: Product[]) => {
    if (!productsSort) return rows;
    const direction = productsSort.order === "asc" ? 1 : -1;

    const keyOf = (product: Product): string | number => {
      switch (productsSort.by) {
        case "name":
          return (product.name || "").toLowerCase();
        case "type":
          return product.serviceId ? "service" : "product";
        case "code":
          return getProductCode(product).toLowerCase();
        case "category":
          return (product.category || "").toLowerCase();
        case "price": {
          if (product.pricing === null || product.pricing === undefined) return -Infinity;
          return typeof product.pricing === "number"
            ? product.pricing
            : parseFloat(product.pricing.toString()) || 0;
        }
        case "status":
          return (product.status || "active").toLowerCase();
        case "updated": {
          const time = product.updatedAt ? new Date(product.updatedAt as any).getTime() : NaN;
          // Undated rows sink to the bottom in both directions rather than
          // scattering through the list on an NaN comparison.
          return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
        }
        default:
          return "";
      }
    };

    return [...rows].sort((a, b) => {
      const left = keyOf(a);
      const right = keyOf(b);
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right)) * direction;
    });
  };

  const renderProductRowActions = (product: Product) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-[15px] w-[15px] p-0 text-[#9ca3af] hover:bg-transparent hover:text-[#e5e7eb]"
          aria-label="Product actions"
        >
          <MoreHorizontal className="h-[15px] w-[15px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="bg-[#181818] border border-[#2a2d3a] text-white"
      >
        <DropdownMenuItem
          className="text-white hover:bg-white/5"
          onClick={() => handleEditFromList(product)}
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-400 hover:bg-red-500/10"
          onClick={() => handleDeleteFromList(product)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const confirmBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      let failed = 0;
      for (const id of selectedProductIds) {
        const response = await authenticatedFetch(buildExternalUrl(`/crm/products/${id}`), {
          method: "DELETE",
        });
        if (!response.ok) failed++;
      }
      if (failed === 0) {
        toast.success(
          selectedProductIds.length === 1
            ? "Product deleted successfully!"
            : `${selectedProductIds.length} products deleted successfully!`
        );
      } else {
        toast.error(`Failed to delete ${failed} product${failed === 1 ? "" : "s"}`);
      }
      setSelectedProductIds([]);
      setIsBulkDeleteOpen(false);
      await fetchProducts();
    } catch (error) {
      console.error("Error bulk deleting products:", error);
      toast.error("Failed to delete products. Please try again.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const figmaCheckboxClass =
    "h-[14px] w-[14px] rounded-full border-[1.5px] border-[#8c8c9e] data-[state=checked]:bg-[#8c8c9e] data-[state=checked]:text-[#181818]";
  const figmaLabelClass = "text-[12px] font-medium text-[#9a9a9a]";
  const figmaInputClass =
    "h-9 rounded-[8px] border-[#3a3a3a] bg-[#1e1e1e] px-2.5 text-[13px] text-[#efefef] placeholder:text-[#5a5a5a] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";
  const figmaTextareaClass =
    "min-h-[64px] rounded-[8px] border-[#3a3a3a] bg-[#1e1e1e] px-2.5 py-2.5 text-[13px] text-[#efefef] placeholder:text-[#5a5a5a] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";
  const figmaSelectTriggerClass =
    "h-9 w-full rounded-[8px] border border-[#3a3a3a] bg-[#1e1e1e] px-2.5 text-[13px] text-[#efefef] shadow-none focus:ring-0";

  const handleExport = () => {
    try {
      // Filter products the same way as displayed
      const byType = (p: Product) => typeFilter === "all" ? true : typeFilter === "products" ? Boolean(p.productId) : Boolean(p.serviceId);
      const byStatus = (p: Product) => statusFilter === "all" ? true : (p.status || "").toLowerCase() === statusFilter;
      const displayProducts = products.filter(p => byType(p) && byStatus(p));

      // Prepare data for export
      const exportData = displayProducts.map((product) => {
        const isService = Boolean(product.serviceId);

        // Format pricing display
        let pricingDisplay = "-";
        if (product.pricing !== null && product.pricing !== undefined) {
          const price = typeof product.pricing === 'number'
            ? product.pricing
            : parseFloat(product.pricing.toString()) || 0;
          if (product.unit) {
            pricingDisplay = `₹${price.toLocaleString()}/${product.unit}`;
          } else {
            pricingDisplay = `₹${price.toLocaleString()}`;
          }
        }

        return {
          "Type": isService ? "Service" : "Product",
          "Name": product.name || "--",
          "Code": (product.productId || product.serviceId) ?? "--",
          "Category": product.category || "--",
          "Price": pricingDisplay,
          "Status": product.status || "Active",
          "Updated": product.updatedAt ? new Date(product.updatedAt as any).toISOString().split('T')[0] : "--",
        };
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Products & Services");

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      // Save file
      const fileName = `products_services_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      saveAs(data, fileName);

      toast.success("Products & Services exported successfully!");
    } catch (error) {
      console.error("Error exporting products:", error);
      toast.error("Failed to export products. Please try again.");
    }
  };

  // Function to handle back from edit mode
  const handleBackFromEdit = () => {
    setIsEditMode(false);
    setEditProductData(null);
  };

  // Document management functions
  // const handleBrochureUpload = async (file: File) => {
  //   setIsUploadingBrochure(true);
  //   try {
  //     const uploadedFiles = await uploadFiles("imageUploader", {
  //       files: [file],
  //     });

  //     if (uploadedFiles && uploadedFiles.length > 0) {
  //       const uploadedFile = uploadedFiles[0];
  //       const newBrochure = {
  //         name: file.name,
  //         url: uploadedFile.url
  //       };

  //       // Update the selectedProduct with the new brochure
  //       if (selectedProduct) {
  //         const updatedProduct = {
  //           ...selectedProduct,
  //           productBrochure: newBrochure
  //         };
  //         setSelectedProduct(updatedProduct);
  //       }

  //       // Also update the local state for save functionality
  //       setProductBrochure(newBrochure);

  //       toast.success('Brochure uploaded successfully!');
  //     }
  //   } catch (error) {
  //     console.error("Error uploading brochure:", error);
  //     toast.error('Failed to upload brochure. Please try again.');
  //   } finally {
  //     setIsUploadingBrochure(false);
  //   }
  // };

  // const handleDocumentUpload = async (file: File) => {
  //   setIsUploadingDocument(true);
  //   if (!documentName.trim()) {
  //     toast.error('Please enter a document name first');
  //     setIsUploadingDocument(false);
  //     return;
  //   }

  //   try {
  //     const uploadedFiles = await uploadFiles("imageUploader", {
  //       files: [file],
  //     });

  //     if (uploadedFiles && uploadedFiles.length > 0) {
  //       const uploadedFile = uploadedFiles[0];
  //       const newDocument = {
  //         docName: documentName,
  //         docLink: uploadedFile.url
  //       };

  //       // Only update the local documents state for save functionality
  //       setDocuments(prev => [...prev, newDocument]);

  //       setDocumentName('');
  //       setShowUploadForm(false); // Hide the upload form after successful upload
  //       toast.success('Document uploaded successfully!');
  //     }
  //   } catch (error) {
  //     console.error("Error uploading document:", error);
  //     toast.error('Failed to upload document. Please try again.');
  //   } finally {
  //     setIsUploadingDocument(false);
  //   }
  // };



  // Removed unused removeDocument and removeBrochure functions

  const handleShowUploadForm = () => {
    setShowUploadForm(true);
    setDocumentName(''); // Clear document name when showing upload form
  };

  const handleCancelUpload = () => {
    setShowUploadForm(false);
    setDocumentName(''); // Clear document name when cancelling upload
  };

  const handleSaveDocuments = async () => {
    console.log("Original documents:", originalDocuments);
    console.log("Removed documents:", removedDocuments);
    console.log("New documents:", documents);

    if (selectedProduct) {
      setIsSaving(true);

      try {
        // Combine all documents: existing + new
        const allDocuments = [
          ...originalDocuments, // Existing documents
          ...documents // New documents
        ];

        // Filter out removed documents from the combined array
        const documentsToSave = allDocuments.filter(doc =>
          !removedDocuments.some(removed =>
            removed.docName === doc.docName && removed.docLink === doc.docLink
          )
        );

        console.log("All documents combined:", allDocuments);
        console.log("Final documents to save (after filtering removed):", documentsToSave);

        const response = await authenticatedFetch(
          buildExternalUrl(`/crm/products/${selectedProduct._id}`),
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productBrochure: productBrochure || selectedProduct.productBrochure,
              documents: documentsToSave,
            }),
          }
        );

        if (response.ok) {
          // Update selectedProduct with new data
          const updatedProduct = {
            ...selectedProduct,
            productBrochure: productBrochure || selectedProduct.productBrochure,
            documents: documentsToSave
          };
          setSelectedProduct(updatedProduct);

          // Update original documents to reflect the new saved state
          setOriginalDocuments(documentsToSave);

          // Clear removed documents since they've been saved
          setRemovedDocuments([]);

          setIsProductEditMode(false);
          setEditableProduct(null);
          setProductBrochure(null); // Clear brochure state after saving
          setDocuments([]); // Clear documents state after saving
          toast.success("Documents saved successfully!");
        } else {
          const errorData = await response.json();
          console.error("Failed to save documents:", errorData);
          toast.error(
            `Failed to save documents: ${errorData.message || "Unknown error"}`
          );
        }
      } catch (error) {
        console.error("Error saving documents:", error);
        toast.error("Error saving documents. Please try again.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden min-w-0 ${isFigma ? "bg-[#0e0e0e]" : "bg-background"}`}>
      {/* CRM Sidebar (New Sidebar) */}
      {/* <CRMSidebar /> */}

      {/* Main Content */}
      <div className={`flex-1 overflow-hidden flex flex-col min-w-0 ${isFigma ? "bg-[#0e0e0e] text-white" : "bg-background text-foreground"}`}>
        {/* Global Navbar */}
        {!isInlineDealsMode && <DealsNavbar />}
        {/* BackOffice list view renders the shared DataTable, which owns its own
            vertical scroll (sticky header + pinned footer). Give it a bounded
            flex column there; every other view keeps page scroll. */}
        <main className={`min-w-0 pb-24 md:pb-0 ${isFigma && !selectedProduct
          ? "flex h-full min-h-0 flex-col overflow-hidden"
          : "flex-1 overflow-y-auto overflow-x-hidden"
          } ${isFigma ? "bg-[#0e0e0e]" : resolvedTheme === "color" ? "bg-[#0A0E27]" : "bg-background"
          }`}>
          {selectedProduct ? (
            // Product Overview UI - shown when a product is selected
            <div className="p-6">
              {/* Back button section */}
              <div className="flex items-center mb-4 px-2">
                <Button
                  variant="ghost"
                  className="text-lg font-semibold px-2 py-1 h-auto"
                  onClick={handleBackToList}
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Products
                </Button>
              </div>
              {/* Main card section */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 pl-10">
                {/* Main Tabs for Overview, Activities, Documents */}
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-96 grid-cols-3 h-auto p-0 rounded-none bg-transparent">
                    <TabsTrigger
                      value="overview"
                      className="relative bg-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-foreground data-[state=active]:shadow-none rounded-none text-sm py-3 px-0 data-[state=inactive]:bg-transparent"
                    >
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="documents"
                      className="relative bg-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-foreground data-[state=active]:shadow-none rounded-none text-sm py-3 px-0 data-[state=inactive]:bg-transparent"
                    >
                      Documents
                    </TabsTrigger>
                  </TabsList>
                  <div className="border-b border-border/70 dark:border-border/40 mb-4" />

                  {/* Overview Tab Content */}
                  <TabsContent value="overview" className="pt-6">
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                        <span className="text-sm">Status</span>

                        {isProductEditMode ? (
                          <Select
                            value={editableProduct?.status || selectedProduct?.status || "active"}
                            onValueChange={(value) => {
                              handleFieldUpdate("status", value);
                            }}
                            defaultValue={editableProduct?.status || selectedProduct?.status || "active"}
                          >
                            <SelectTrigger className="w-[120px] h-8 rounded-md bg-[#34C75980] border-[#34C75980]">
                              <SelectValue>
                                {editableProduct?.status || selectedProduct?.status || "Active"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Pause">Pause</SelectItem>
                              <SelectItem value="Inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="w-[120px] h-8 rounded-md bg-[#34C75980] border-[#34C75980] flex items-center px-3 text-sm text-black font-medium">
                            {selectedProduct.status || "Active"}
                          </div>
                        )}
                      </div>
                      <div className="h-[1px] bg-border/70 dark:bg-border/40 w-full" />
                      <div className="grid grid-cols-6 gap-x-1 gap-y-5 text-xs">
                        {/* Table header */}
                        <div>Product Name</div>
                        <div>Description</div>
                        <div>Category</div>
                        <div>Pricing</div>
                        <div>Commission Type</div>
                        <div>Comissions</div>
                        {/* Table row - using selectedProduct/editableProduct data */}
                        <div className="text-sm">
                          {isProductEditMode && isAdmin ? (
                            <Input
                              value={editableProduct?.name || ""}
                              onChange={(e) =>
                                handleFieldUpdate("name", e.target.value)
                              }
                              className="w-full h-6 text-xs"
                            />
                          ) : (
                            selectedProduct.name
                          )}
                        </div>
                        <div className="text-sm">
                          {isProductEditMode && isAdmin ? (
                            <textarea
                              value={editableProduct?.description || ""}
                              onChange={(e) =>
                                handleFieldUpdate("description", e.target.value)
                              }
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={2}
                            />
                          ) : (
                            selectedProduct.description ||
                            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor"
                          )}
                        </div>
                        <div className="text-sm">
                          {isProductEditMode && isAdmin ? (
                            <Select
                              key={editableProduct?.category || "default"}
                              defaultValue={editableProduct?.category || ""}
                              onValueChange={(value) =>
                                handleFieldUpdate("category", value)
                              }
                            >
                              <SelectTrigger className="w-full h-6 text-xs">
                                <SelectValue placeholder="Select Category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Software">Software</SelectItem>
                                <SelectItem value="Service">Service</SelectItem>
                                <SelectItem value="Hardware">Hardware</SelectItem>
                                <SelectItem value="Subscription">
                                  Subscription
                                </SelectItem>
                                <SelectItem value="Training">Training</SelectItem>
                                <SelectItem value="Consulting">
                                  Consulting
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            selectedProduct.category
                          )}
                        </div>
                        <div className="text-sm">
                          {isProductEditMode && isAdmin ? (
                            <Input
                              type="number"
                              value={editableProduct?.pricing || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Only allow numbers and decimal points
                                if (/^\d*\.?\d*$/.test(value) || value === "") {
                                  handleFieldUpdate("pricing", value);
                                }
                              }}
                              onKeyDown={(e) => {
                                // Prevent multiple decimal points and non-numeric characters
                                const pricingValue = editableProduct?.pricing;
                                const pricingStr = pricingValue ? String(pricingValue) : "";
                                if (e.key === '.' && pricingStr.includes('.')) {
                                  e.preventDefault();
                                }
                                if (!/[\d.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              className="w-full h-6 text-xs"
                              placeholder="Enter price"
                              min="0"
                              step="0.01"
                            />
                          ) : (
                            selectedProduct.pricing
                          )}
                        </div>
                        <div className="text-sm">
                          {isProductEditMode && isAdmin ? (
                            <Select
                              value={editableProduct?.commissionType || ""}
                              onValueChange={(value) =>
                                handleFieldUpdate("commissionType", value)
                              }
                            >
                              <SelectTrigger className="w-full h-6 text-xs">
                                <SelectValue placeholder="Select Commission Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fixed">Fixed</SelectItem>
                                <SelectItem value="Variable">Variable</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            selectedProduct.commissionType
                          )}
                        </div>
                        <div className="text-sm">
                          {isProductEditMode && isAdmin ? (
                            <Input
                              type="number"
                              value={editableProduct?.commissionPercentage || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Only allow numbers and decimal points
                                if (/^\d*\.?\d*$/.test(value) || value === "") {
                                  handleFieldUpdate("commissionPercentage", value);
                                }
                              }}
                              onKeyDown={(e) => {
                                // Prevent multiple decimal points and non-numeric characters
                                if (e.key === '.' && editableProduct?.commissionPercentage?.includes('.')) {
                                  e.preventDefault();
                                }
                                if (!/[\d.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              className="w-full h-6 text-xs"
                              placeholder="Enter commission"
                              min="0"
                              step="0.01"
                            />
                          ) : (
                            selectedProduct.commissionPercentage
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Documents Tab Content */}
                  <TabsContent value="documents">
                    <div className="space-y-6 w-96">
                      {/* Product Brochure Section */}
                      <div className="space-y-2">
                        <Label>Product Brochure</Label>

                        {selectedProduct.productBrochure ? (
                          <div className="flex items-center justify-between bg-green-50 p-2 rounded-md">
                            <div className="flex items-center gap-2 text-sm text-green-700">
                              <span>✓</span>
                              <span className="truncate max-w-[200px]">
                                {selectedProduct.productBrochure.name}
                              </span>
                            </div>
                            <a
                              href={selectedProduct.productBrochure.url}
                              download={selectedProduct.productBrochure.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Download
                            </a>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No brochure available.</p>
                        )}
                      </div>

                      {/* Documents Section */}
                      <div className="space-y-2">
                        <Label>Documents</Label>
                        {originalDocuments.length > 0 ? (
                          <div className="space-y-2">
                            {originalDocuments.map((doc, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between bg-muted/70 dark:bg-white/10 p-2 rounded-md"
                              >
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Download className="w-4 h-4" />
                                  <span className="truncate max-w-[200px]">
                                    {doc.docName}
                                  </span>
                                </div>
                                <a
                                  href={doc.docLink}
                                  download={doc.docName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  Download
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No documents available.</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : !showListView ? (
            <div className="p-6">
              {/* Back button section */}
              <div className="flex items-center mb-4 px-2">
                <Button
                  variant="ghost"
                  className="text-lg font-semibold px-2 py-1 h-auto"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back
                </Button>
              </div>
              {/* Main card section */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 pl-10">
                {/* Main Tabs for Overview, Activities, Documents */}
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-96 grid-cols-3 h-auto p-0 rounded-none bg-transparent">
                    <TabsTrigger
                      value="overview"
                      className="relative bg-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-foreground data-[state=active]:shadow-none rounded-none text-sm py-3 px-0 data-[state=inactive]:bg-transparent"
                    >
                      Overview
                    </TabsTrigger>
                    {/* <TabsTrigger
                  value="activities"
                  className="relative bg-transparent text-gray-500 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-black data-[state=active]:shadow-none rounded-none text-sm py-3 px-0 data-[state=inactive]:bg-transparent"
                >
                  Activities
                </TabsTrigger> */}
                    <TabsTrigger
                      value="documents"
                      className="relative bg-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-foreground data-[state=active]:shadow-none rounded-none text-sm py-3 px-0 data-[state=inactive]:bg-transparent"
                    >
                      Documents
                    </TabsTrigger>
                  </TabsList>
                  <div className="border-b border-border/70 dark:border-border/40 mb-4" />

                  {/* Overview Tab Content */}
                  <TabsContent value="overview" className="pt-6">
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                        <span className="text-sm">Status</span>
                        <Select defaultValue="active">
                          <SelectTrigger className="w-[120px] h-8 rounded-md bg-[#34C75980] border-[#34C75980]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="h-[1px] bg-border/70 dark:bg-border/40 w-full" />
                      <div className="grid grid-cols-6 gap-x-1 gap-y-5 text-xs">
                        {/* Table header */}
                        <div>Product Name</div>
                        <div>Description</div>
                        <div>Category</div>
                        <div>Pricing</div>
                        <div>Commission Type</div>
                        <div>Comissions</div>
                        {/* Table row */}
                        <div className="text-sm">Lamborghini</div>
                        <div className="text-sm">
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit,
                          sed do eiusmod tempor
                        </div>
                        <div className="text-sm">Automobile</div>
                        <div className="text-sm">₹4,50,000</div>
                        <div className="text-sm">Fixed</div>
                        <div className="text-sm">₹2000</div>
                      </div>
                    </div>
                    <div className="flex justify-end mt-6">
                      <Button
                        onClick={() => setShowListView(true)}
                        className="rounded-full bg-black text-white px-6 py-2 hover:bg-black/80 duration-300 transition-all"
                      >
                        Edit
                        <Pencil className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Activities Tab Content */}
                  <TabsContent value="activities" className="pt-6">
                    <div className="space-y-6">
                      {/* Sales Funnel */}
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Sales Funnel
                        </span>
                        <Select defaultValue="discovery">
                          <SelectTrigger className="w-[120px] h-8 rounded-md bg-[#34C75980] border-[#34C75980]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="discovery">Discovery</SelectItem>
                            <SelectItem value="qualification">
                              Qualification
                            </SelectItem>
                            <SelectItem value="proposal">Proposal</SelectItem>
                            <SelectItem value="negotiation">Negotiation</SelectItem>
                            <SelectItem value="closed-won">Closed Won</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Personal Information */}
                      <div className="inline-grid grid-cols-2 md:grid-cols-5">
                        <div className="space-y-3">
                          <p className="text-xs">First Name</p>
                          <p className="text-sm ">Abhishek</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Last Name</p>
                          <p className="text-sm ">Sawant</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Email</p>

                          <p className="text-sm">abhishek.sawant@google.com</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Phone Number</p>
                          <p className="text-sm ">+91 7200948999</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">DOB</p>
                          <p className="text-sm">09/09/1994</p>
                        </div>
                      </div>

                      <div className="h-[1px] bg-border/70 dark:bg-border/40 w-full " />

                      {/* Product Information */}
                      <div className="inline-grid grid-cols-2 md:grid-cols-3 gap-8">
                        <div className="space-y-3">
                          <p className="text-xs">Product Name</p>
                          <p className="text-sm">Lamborghini</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Est Revenue</p>
                          <p className="text-sm">₹4,50,000</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Quantity</p>
                          <p className="text-sm">4</p>
                        </div>
                      </div>

                      <div className="h-[1px] bg-border/70 dark:bg-border/40 w-full " />

                      {/* Company Information */}
                      <div className="inline-grid grid-cols-2 md:grid-cols-7 gap-y-6">
                        <div className="space-y-3">
                          <p className="text-xs">Company Name</p>
                          <p className="text-sm">Google Inc</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Industry</p>
                          <p className="text-sm">Software</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Website</p>
                          <p className="text-sm">www.google.com</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Pin Code</p>
                          <p className="text-sm">400300</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Address</p>
                          <p className="text-sm">ABS, Google Lane, ...</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">Country</p>
                          <p className="text-sm">USA</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">City</p>
                          <p className="text-base">California</p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs">State</p>
                          <p className="text-sm">Nevada</p>
                        </div>
                      </div>

                      {/* Assigned To */}
                      <div className="space-y-4">
                        <p className="text-sm">Assigned to</p>
                        <div className="flex gap-4 ">
                          <Button
                            variant="outline"
                            className="rounded-md bg-blue-100 text-black hover:bg-blue-200"
                          >
                            Abhishek Sawant
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-md bg-blue-100 text-black hover:bg-blue-200"
                          >
                            Abhay Shah
                          </Button>
                        </div>
                      </div>

                    </div>
                  </TabsContent>

                  {/* Documents Tab Content */}
                  <TabsContent value="documents">
                    <div className="space-y-10 mt-8">
                      <div>
                        <h3 className="text-sm mb-2">Product Brochure</h3>
                        <a
                          href="#"
                          download="Lorem_ipsum.pdf"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer p-2 rounded-md hover:bg-blue-50 transition-colors"
                          onClick={(e) => {
                            // Example download functionality
                            e.preventDefault();
                            // In a real scenario, this would download the actual file
                            alert(
                              "Download functionality - File would be downloaded here"
                            );
                          }}
                        >
                          <Download className="w-4 h-4" />
                          <span className="font-medium">Lorem_ipsum.pdf</span>
                        </a>
                      </div>
                      <div>
                        <h3 className="text-sm mb-2">Product Product & Services</h3>
                        <a
                          href="#"
                          download="Lorem_ipsum.pdf"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer p-2 rounded-md hover:bg-blue-50 transition-colors"
                          onClick={(e) => {
                            // Example download functionality
                            e.preventDefault();
                            // In a real scenario, this would download the actual file
                            alert(
                              "Download functionality - File would be downloaded here"
                            );
                          }}
                        >
                          <Download className="w-4 h-4" />
                          <span className="font-medium">Lorem_ipsum.pdf</span>
                        </a>
                      </div>
                    </div>
                    <div className="flex justify-end mt-6">
                      <Button className="rounded-full px-6 py-2 bg-[#3DB69A] hover:bg-[#3DB69A]/80 text-white transition-all duration-300">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Other Product Document
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : (
            <>
              {isAdd ? (
                <ProductOnboardingFlow
                  setIsAddProductOpen={setIsAdd}
                  onProductCreated={fetchProducts}
                />
              ) : isEditMode ? (
                <ProductOnboardingFlow
                  setIsAddProductOpen={handleBackFromEdit}
                  onProductCreated={fetchProducts}
                  editProduct={editProductData}
                  isEditMode={true}
                />
              ) : (
                <div className={isFigma ? "flex min-h-0 flex-1 flex-col" : "space-y-0"}>
                  {/* Header Section with Title and Description */}
                  {/* <div className={`${theme === "color"
                    ? "bg-[#0A0E27] border-[rgba(0,255,255,0.2)]"
                    : theme === "dark"
                      ? "bg-[#1a1a1a] border-[#3a3a3a]"
                      : "bg-[rgba(255,255,255,0.6)] border-[#e5e7eb]"
                    } border-b border-b-[0.667px] pt-3 pb-[0.53rem] px-6`}>
                    <h1 className={`text-[24px] font-bold ${theme === "color"
                      ? "text-white"
                      : theme === "dark"
                        ? "text-[#e5e5e5]"
                        : "text-[#1f1f1f]"
                      }`}>
                      Products & Services
                    </h1>
                    <p className={`text-[14px] ${theme === "color"
                      ? "text-[rgba(0,255,255,0.6)]"
                      : theme === "dark"
                        ? "text-[#9ca3af]"
                        : "text-[#6b7280]"
                      }`}>
                      Manage products and services
                    </p>
                  </div> */}
                  {/* Header Bar */}
                  {isFigma ? (
                    <div className="w-full max-w-full shrink-0">
                      <div className="bg-black px-[20px] pt-[20px] pb-[15px]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between overflow-clip">
                          <div className="relative h-[32px] w-full sm:w-[420px] min-w-0 rounded-[6px] border border-[#2a2d3a] bg-black px-[12px] py-[6px] flex items-center gap-[8px]">
                            <img
                              alt=""
                              src="/figma/deals/leads/search.svg"
                              className="h-[16px] w-[16px] shrink-0"
                            />
                            <Input
                              type="text"
                              placeholder="Search products and services..."
                              /* !bg-transparent: the inline Deals shell styles bare
                                 `input` with a #16161f fill, which outranks a plain
                                 bg utility and tinted this field navy. */
                              className="h-[20px] border-0 !bg-transparent p-0 text-[12px] text-[#e5e7eb] placeholder:text-[#9ca3af] focus-visible:ring-0 focus-visible:ring-offset-0"
                              value={searchTerm}
                              onChange={(e) => handleSearch(e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-[8px] shrink-0">
                            {selectedProductIds.length > 0 && (
                              <Button
                                variant="destructive"
                                className="flex items-center gap-2 h-[32px] px-[12px] py-[6px] rounded-[6px] text-[12px] font-semibold shrink-0"
                                onClick={() => setIsBulkDeleteOpen(true)}
                                disabled={isBulkDeleting}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Selected
                                <span className="text-xs font-medium text-white/80">
                                  ({selectedProductIds.length})
                                </span>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              className="h-[32px] px-[12px] py-[6px] rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] text-[12px] font-semibold shadow-none hover:bg-[#181818]"
                              onClick={() => {
                                setTempTypeFilter(typeFilter);
                                setTempStatusFilter(statusFilter);
                                setActiveFilterCategory("type");
                                setIsFilterDialogOpen(true);
                              }}
                            >
                              <img
                                alt=""
                                src="/figma/deals/leads/filter.svg"
                                className="h-[15px] w-[15px] mr-[8px]"
                              />
                              Filters
                              {(typeFilter !== "all" || statusFilter !== "all") && (
                                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] shadow-none hover:bg-[#181818]"
                              onClick={handleExport}
                              aria-label="Export products"
                            >
                              <img
                                alt=""
                                src="/figma/deals/leads/export.svg"
                                className="h-[15px] w-[15px]"
                              />
                            </Button>
                            <Button
                              variant="outline"
                              className="h-[32px] w-[32px] p-0 rounded-[6px] border border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] shadow-none hover:bg-[#181818]"
                              onClick={openAddProductModal}
                              aria-label="Add product"
                            >
                              <Plus className="h-[15px] w-[15px]" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div
                    className={
                      resolvedTheme === "color"
                        ? "border-b-[0.667px] border-[rgba(0,255,255,0.2)] pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-4 max-w-full overflow-hidden"
                        : resolvedTheme === "dark"
                          ? "border-b-[0.667px] border-[#3a3a3a] pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-4 max-w-full overflow-hidden"
                          : "border-b-[0.667px] border-[#e5e7eb] pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-4 max-w-full overflow-hidden"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-h-8">
                      {/* Search Input */}
                      <div className="relative flex-1 min-w-0 sm:w-[384px] sm:flex-none">
                        <Search className={
                          resolvedTheme === "color"
                            ? "absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[rgba(0,255,255,0.6)]"
                            : resolvedTheme === "dark"
                              ? "absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[#9ca3af]"
                              : "absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[#6b7280]"
                        } />
                        <Input
                          type="text"
                          placeholder="Search products and services..."
                          className={
                            resolvedTheme === "color"
                              ? "pl-[32px] pr-3 py-1 h-8 rounded-[6px] bg-[rgba(255,255,255,0.03)] text-white placeholder:text-[rgba(0,255,255,0.6)] border-0 focus-visible:ring-0 focus-visible:outline-none text-[14px]"
                              : resolvedTheme === "dark"
                                ? "pl-[32px] pr-3 py-1 h-8 rounded-[6px] bg-[rgba(42,42,42,0.5)] text-[#e5e5e5] placeholder:text-[#9ca3af] border-0 focus-visible:ring-0 focus-visible:outline-none text-[14px]"
                                : "pl-[32px] pr-3 py-1 h-8 rounded-[6px] bg-[rgba(244,245,247,0.5)] text-[#1f1f1f] placeholder:text-[#6b7280] border-0 focus-visible:ring-0 focus-visible:outline-none text-[14px]"
                          }
                          value={searchTerm}
                          onChange={(e) => handleSearch(e.target.value)}
                        />
                      </div>

                      {/* Filters Button */}
                      <Button
                        variant="outline"
                        className={
                          resolvedTheme === "color"
                            ? "h-8 px-3 shrink-0 rounded-[6px] bg-transparent border-[rgba(0,255,255,0.2)] text-white hover:bg-[rgba(0,255,255,0.05)]"
                            : resolvedTheme === "dark"
                              ? "h-8 px-3 shrink-0 rounded-[6px] bg-[rgba(42,42,42,0.5)] border-[#3a3a3a] text-[#e5e5e5] hover:bg-[rgba(58,58,58,0.3)]"
                              : "h-8 px-3 shrink-0 rounded-[6px] bg-white border-[#e5e7eb] text-[#1f1f1f] hover:bg-gray-50"
                        }
                        onClick={() => {
                          setTempTypeFilter(typeFilter);
                          setTempStatusFilter(statusFilter);
                          setActiveFilterCategory("type");
                          setIsFilterDialogOpen(true);
                        }}
                      >
                        <Filter className="h-4 w-4 sm:mr-1.5" />
                        <span className="text-[12px] font-bold hidden sm:inline">Filters</span>
                      </Button>

                      {/* Separator */}
                      <div className={
                        resolvedTheme === "color"
                          ? "hidden sm:block h-5 w-px shrink-0 bg-[rgba(0,255,255,0.2)]"
                          : resolvedTheme === "dark"
                            ? "hidden sm:block h-5 w-px shrink-0 bg-[#3a3a3a]"
                            : "hidden sm:block h-5 w-px shrink-0 bg-[#e5e7eb]"
                      } />

                      {/* Export Button */}
                      <Button
                        variant="outline"
                        className={
                          resolvedTheme === "color"
                            ? "h-8 px-3 shrink-0 rounded-[6px] bg-transparent border-[rgba(0,255,255,0.2)] text-white hover:bg-[rgba(0,255,255,0.05)]"
                            : resolvedTheme === "dark"
                              ? "h-8 px-3 shrink-0 rounded-[6px] bg-[rgba(42,42,42,0.5)] border-[#3a3a3a] text-[#9ca3af] hover:bg-[rgba(58,58,58,0.3)]"
                              : "h-8 px-3 shrink-0 rounded-[6px] bg-white border-[#e5e7eb] text-[#1f1f1f] hover:bg-gray-50"
                        }
                        onClick={handleExport}
                      >
                        <Download className="h-4 w-4 sm:mr-1.5" />
                        <span className="text-[12px] font-bold hidden sm:inline">Export</span>
                      </Button>

                      {/* Add Product/Service Button */}
                      <Button
                        onClick={openAddProductModal}
                        className={
                          resolvedTheme === "color"
                            ? "h-8 px-3 shrink-0 rounded-[6px] bg-[#0ff] text-[#0a0e27] hover:bg-[#0ff]/80 font-bold text-[12px]"
                            : "!h-8 !px-3 shrink-0 rounded-[6px] !bg-[#8b7aff] !hover:bg-[#7b6aee] text-white font-bold text-[12px]"
                        }
                      >
                        <Plus className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Add Product/Service</span>
                      </Button>
                    </div>
                  </div>
                  )}

                  {/* Count Section */}
                  {!isFigma && (() => {
                    const byType = (p: Product) => typeFilter === "all" ? true : typeFilter === "products" ? Boolean(p.productId) : Boolean(p.serviceId);
                    const byStatus = (p: Product) => statusFilter === "all" ? true : (p.status || "").toLowerCase() === statusFilter;
                    const displayProducts = products.filter(p => byType(p) && byStatus(p));
                    return (
                      <div
                        className={
                          resolvedTheme === "color"
                            ? "bg-[rgba(255,255,255,0.02)] border-b-[0.667px] border-[rgba(0,255,255,0.2)] pt-2 px-3 sm:px-6 pb-2"
                            : resolvedTheme === "dark"
                              ? "bg-[rgba(42,42,42,0.5)] border-b-[0.667px] border-[#3a3a3a] pt-2 px-3 sm:px-6 pb-2"
                              : "bg-[rgba(244,245,247,0.3)] border-b-[0.667px] border-[#e5e7eb] pt-2 px-3 sm:px-6 pb-2"
                        }
                      >
                        <p className={
                          resolvedTheme === "color"
                            ? "font-bold text-[12px] text-[rgba(0,255,255,0.6)]"
                            : resolvedTheme === "dark"
                              ? "font-bold text-[12px] text-[#9ca3af]"
                              : "font-bold text-[12px] text-[#6b7280]"
                        }>
                          {displayProducts.length} Products/Services
                        </p>
                      </div>
                    );
                  })()}

                  {/* Combined List */}
                  {(() => {
                    const byType = (p: Product) => typeFilter === "all" ? true : typeFilter === "products" ? Boolean(p.productId) : Boolean(p.serviceId);
                    const byStatus = (p: Product) => statusFilter === "all" ? true : (p.status || "").toLowerCase() === statusFilter;
                    const displayProducts = products.filter(p => byType(p) && byStatus(p));
                    const listTotalPages = Math.ceil(displayProducts.length / limit);
                    // Sort the whole filtered list before slicing, so ordering
                    // spans pages rather than shuffling the current page only.
                    const paginatedDisplayProducts = sortProducts(displayProducts).slice(startIndex, endIndex);
                    const displayedProductIds = paginatedDisplayProducts.map((p) => p._id).filter(Boolean);
                    const allDisplayedSelected =
                      displayedProductIds.length > 0 &&
                      displayedProductIds.every((id) => selectedProductIds.includes(id));
                    const someDisplayedSelected =
                      displayedProductIds.some((id) => selectedProductIds.includes(id)) && !allDisplayedSelected;
                    const handleToggleSelectAll = (checked: boolean) => {
                      if (checked) {
                        setSelectedProductIds((prev) => Array.from(new Set([...prev, ...displayedProductIds])));
                      } else {
                        setSelectedProductIds((prev) => prev.filter((id) => !displayedProductIds.includes(id)));
                      }
                    };
                    const headClass = isFigma
                      ? "h-[26px] px-2 py-0 text-[10px] leading-[14px] font-bold text-[#9ca3af]"
                      : resolvedTheme === "color"
                        ? "font-bold text-[12px] text-[rgba(0,255,255,0.6)]"
                        : resolvedTheme === "dark"
                          ? "font-bold text-[12px] text-[#9ca3af]"
                          : "font-bold text-[12px] text-[#6b7280]";
                    if (isFigma) {
                      return (
                        <div className="relative flex min-h-0 w-full flex-1 flex-col bg-[#161616]">
                          <ProductsDataTable
                            rows={paginatedDisplayProducts}
                            loading={isLoadingProducts}
                            emptyLabel="No products or services found."
                            sort={productsSort}
                            onSortChange={setProductsSort}
                            getRowId={(product) => String(product?._id || "")}
                            onRowClick={(product) => handleViewProduct(product._id)}
                            selectedIds={new Set(selectedProductIds)}
                            allSelected={allDisplayedSelected}
                            someSelected={someDisplayedSelected}
                            onToggleRow={(id) =>
                              handleToggleProductSelection(id, !selectedProductIds.includes(id))
                            }
                            onToggleAll={() => handleToggleSelectAll(!allDisplayedSelected)}
                            getProductName={(product) => product.name || ""}
                            isService={(product) => Boolean(product.serviceId)}
                            getCode={getProductCode}
                            getCategory={(product) => product.category || ""}
                            getPrice={formatProductPrice}
                            getStatus={(product) => product.status || "active"}
                            getUpdated={getProductUpdated}
                            renderActions={renderProductRowActions}
                            footerTotals={[
                              {
                                label: "Products/Services",
                                value: displayProducts.length.toLocaleString(),
                              },
                              ...(selectedProductIds.length > 0
                                ? [
                                  {
                                    label: "Selected",
                                    value: selectedProductIds.length.toLocaleString(),
                                  },
                                ]
                                : []),
                            ]}
                            pagination={{
                              page: currentPage,
                              totalPages: Math.max(1, listTotalPages),
                              rangeLabel: `${displayProducts.length === 0 ? 0 : startIndex + 1
                                } to ${Math.min(endIndex, displayProducts.length)}`,
                              recordsPerPage: limit,
                              recordsPerPageOptions: [25, 50, 100, 200],
                              onPrev: () => {
                                if (currentPage > 1) handlePageChange(currentPage - 1);
                              },
                              onNext: () => {
                                if (currentPage < listTotalPages) handlePageChange(currentPage + 1);
                              },
                              onRecordsPerPageChange: (next) => {
                                setLimit(next);
                                setCurrentPage(1);
                              },
                            }}
                          />
                        </div>
                      );
                    }

                    return (
                      <div className={isFigma
                        ? "bg-[#121215] px-[20px]"
                        : `rounded-xl border shadow-sm ${resolvedTheme === "color"
                        ? "border-[rgba(0,255,255,0.2)] bg-transparent"
                        : resolvedTheme === "dark"
                          ? "border-[#3a3a3a] bg-card"
                          : "border-border/70 bg-card"
                        } text-card-foreground`}>
                        <div>
                          <Table>
                            <TableHeader className={
                              isFigma
                                ? "bg-[#2e2e2e] border-b border-[#2a2d3a]"
                                : resolvedTheme === "color"
                                ? "bg-[rgba(255,255,255,0.03)] border-b-[0.667px] border-[rgba(0,255,255,0.2)]"
                                : resolvedTheme === "dark"
                                  ? "bg-[rgba(42,42,42,0.5)] border-b-[0.667px] border-[#3a3a3a]"
                                  : "bg-[rgba(244,245,247,0.5)] border-b-[0.667px] border-[#e5e7eb]"
                            }>
                              <TableRow className="hover:bg-transparent">
                                {isFigma && (
                                  <TableHead className="w-[32px] h-[26px] px-2 py-0 text-[#9ca3af]">
                                    <Checkbox
                                      checked={
                                        allDisplayedSelected
                                          ? true
                                          : someDisplayedSelected
                                            ? "indeterminate"
                                            : false
                                      }
                                      onCheckedChange={(checked) => handleToggleSelectAll(checked === true)}
                                      aria-label="Select all visible products"
                                      className={figmaCheckboxClass}
                                    />
                                  </TableHead>
                                )}
                                <TableHead className={headClass}>Type</TableHead>
                                <TableHead className={headClass}>Name</TableHead>
                                <TableHead className={headClass}>Code</TableHead>
                                <TableHead className={headClass}>Category</TableHead>
                                <TableHead className={headClass}>Price</TableHead>
                                <TableHead className={headClass}>Status</TableHead>
                                <TableHead className={headClass}>Updated</TableHead>
                                <TableHead
                                  className={
                                    isFigma
                                      ? `${headClass} w-[1%] whitespace-nowrap text-center`
                                      : "text-right w-[80px]"
                                  }
                                >
                                  {isFigma ? "Actions" : ""}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isLoadingProducts ? (
                                <TableRow>
                                  <TableCell colSpan={isFigma ? 9 : 8} className={`text-center py-8 ${isFigma ? "text-[#9ca3af]" : ""}`}>Loading products...</TableCell>
                                </TableRow>
                              ) : paginatedDisplayProducts.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={isFigma ? 9 : 8} className={`text-center py-8 ${isFigma ? "text-[#9ca3af]" : ""}`}>No products found</TableCell>
                                </TableRow>
                              ) : (
                                paginatedDisplayProducts.map((product) => {
                                  const isService = Boolean(product.serviceId);

                                  // Format pricing display: ₹price/unit or just ₹price
                                  let pricingDisplay = "-";
                                  if (product.pricing !== null && product.pricing !== undefined) {
                                    const price = typeof product.pricing === 'number'
                                      ? product.pricing
                                      : parseFloat(product.pricing.toString()) || 0;
                                    if (product.unit) {
                                      pricingDisplay = `₹${price.toLocaleString()}/${product.unit}`;
                                    } else {
                                      pricingDisplay = `₹${price.toLocaleString()}`;
                                    }
                                  }

                                  return (
                                    <TableRow
                                      key={product._id}
                                      className={
                                        isFigma
                                          ? "group border-b border-[#2a2d3a] bg-[#181818] hover:bg-[#181818]"
                                          : resolvedTheme === "color"
                                          ? "group border-b-[0.667px] border-[rgba(0,255,255,0.2)] hover:bg-transparent"
                                          : resolvedTheme === "dark"
                                            ? "group border-b-[0.667px] border-[#3a3a3a] hover:bg-transparent"
                                            : "group border-b-[0.667px] border-[#e5e7eb] hover:bg-transparent"
                                      }
                                    >
                                      {isFigma && (
                                        <TableCell
                                          className="px-2 py-3"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Checkbox
                                            checked={selectedProductIds.includes(product._id)}
                                            onCheckedChange={(checked) =>
                                              handleToggleProductSelection(product._id, checked === true)
                                            }
                                            aria-label={`Select ${product.name}`}
                                            className={figmaCheckboxClass}
                                          />
                                        </TableCell>
                                      )}
                                      <TableCell className={isFigma ? "px-2 py-3" : undefined}>
                                        <div className="flex items-center gap-2">
                                          <div className={
                                            isService
                                              ? theme === "color"
                                                ? "bg-[rgba(16,185,129,0.1)] rounded-[4px] size-[26px] flex items-center justify-center"
                                                : theme === "dark"
                                                  ? "bg-[rgba(16,185,129,0.1)] rounded-[4px] size-[26px] flex items-center justify-center"
                                                  : "bg-[rgba(16,185,129,0.1)] rounded-[4px] size-[26px] flex items-center justify-center"
                                              : theme === "color"
                                                ? "bg-[rgba(123,104,238,0.1)] rounded-[4px] size-[26px] flex items-center justify-center"
                                                : theme === "dark"
                                                  ? "bg-[rgba(139,122,255,0.1)] rounded-[4px] size-[26px] flex items-center justify-center"
                                                  : "bg-[rgba(123,104,238,0.1)] rounded-[4px] size-[26px] flex items-center justify-center"
                                          }>
                                            {isService ? (
                                              <Briefcase className="h-[14px] w-[14px] text-green-600" />
                                            ) : (
                                              <Package className="h-[14px] w-[14px] text-[#7b68ee]" />
                                            )}
                                          </div>
                                          <span className={
                                            isFigma
                                              ? "font-bold text-[12px] text-white"
                                              : theme === "color"
                                              ? "font-bold text-[12px] text-white"
                                              : theme === "dark"
                                                ? "font-bold text-[12px] text-[#e5e5e5]"
                                                : "font-bold text-[12px] text-[#1f1f1f]"
                                          }>{isService ? "Service" : "Product"}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className={
                                        isFigma
                                          ? "px-2 py-3 font-bold text-[12px] text-white"
                                          : theme === "color"
                                          ? "font-bold text-[14px] text-white"
                                          : theme === "dark"
                                            ? "font-bold text-[14px] text-[#e5e5e5]"
                                            : "font-bold text-[14px] text-[#1f1f1f]"
                                      }>
                                        <span
                                          className={`cursor-pointer hover:underline ${
                                            isFigma
                                              ? "text-white"
                                              : theme === "color"
                                            ? "text-[rgba(0,255,255,0.9)]"
                                            : "text-blue-600 dark:text-blue-400"
                                            }`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewProduct(product._id);
                                          }}
                                        >
                                          {product.name}
                                        </span>
                                      </TableCell>
                                      <TableCell className={isFigma ? "px-2 py-3" : undefined}>
                                        <div className={
                                          isFigma
                                            ? "bg-[#2a2a2a] px-[8px] py-[2px] rounded-[4px] inline-block"
                                            : resolvedTheme === "color"
                                            ? "bg-[rgba(255,255,255,0.05)] px-[8px] py-[2px] rounded-[4px] inline-block"
                                            : resolvedTheme === "dark"
                                              ? "bg-[rgba(42,42,42,0.5)] px-[8px] py-[2px] rounded-[4px] inline-block"
                                              : "bg-[#f4f5f7] px-[8px] py-[2px] rounded-[4px] inline-block"
                                        }>
                                          <span className={
                                            isFigma
                                              ? "font-mono text-[12px] text-white"
                                              : resolvedTheme === "color"
                                              ? "font-mono text-[12px] text-white"
                                              : resolvedTheme === "dark"
                                                ? "font-mono text-[12px] text-[#e5e5e5]"
                                                : "font-mono text-[12px] text-[#1f1f1f]"
                                          }>{(product.productId || product.serviceId) ?? "-"}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className={
                                        isFigma
                                          ? "px-2 py-3 text-[12px] text-[#9ca3af]"
                                          : theme === "color"
                                          ? "text-[14px] text-[rgba(0,255,255,0.6)]"
                                          : theme === "dark"
                                            ? "text-[14px] text-[#9ca3af]"
                                            : "text-[14px] text-[#6b7280]"
                                      }>{product.category || "-"}</TableCell>
                                      <TableCell className={
                                        isFigma
                                          ? "px-2 py-3 font-bold text-[12px] text-white"
                                          : theme === "color"
                                          ? "font-bold text-[14px] text-white"
                                          : theme === "dark"
                                            ? "font-bold text-[14px] text-[#e5e5e5]"
                                            : "font-bold text-[14px] text-[#1f1f1f]"
                                      }>{pricingDisplay}</TableCell>
                                      <TableCell className={isFigma ? "px-2 py-3" : undefined}>
                                        {(product.status || "active").toLowerCase() === "active" ? (
                                          <Badge className={
                                            theme === "color"
                                              ? "bg-[rgba(16,185,129,0.1)] border-[0.667px] border-[rgba(16,185,129,0.2)] text-[#10b981] text-[11px] font-bold h-[21.833px] px-[8px] rounded-[6px]"
                                              : theme === "dark"
                                                ? "bg-[rgba(16,185,129,0.1)] border-[0.667px] border-[rgba(16,185,129,0.2)] text-[#10b981] text-[11px] font-bold h-[21.833px] px-[8px] rounded-[6px]"
                                                : "bg-[rgba(16,185,129,0.1)] border-[0.667px] border-[rgba(16,185,129,0.2)] text-[#10b981] text-[11px] font-bold h-[21.833px] px-[8px] rounded-[6px]"
                                          }>
                                            Active
                                          </Badge>
                                        ) : (product.status || "").toLowerCase() === "pause" ? (
                                          <Badge className={
                                            theme === "color"
                                              ? "bg-[rgba(255,255,255,0.05)] border-[0.667px] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.6)] text-[11px] font-bold h-[21.833px] px-[8px] rounded-[6px]"
                                              : theme === "dark"
                                                ? "bg-[#2a2a2a] border-[0.667px] border-[#3a3a3a] text-[#9ca3af] text-[11px] font-bold h-[21.833px] px-[8px] rounded-[6px]"
                                                : "bg-[#f4f5f7] border-[0.667px] border-[#e5e7eb] text-[#6b7280] text-[11px] font-bold h-[21.833px] px-[8px] rounded-[6px]"
                                          }>
                                            Pause
                                          </Badge>
                                        ) : (
                                          <Badge className={
                                            theme === "color"
                                              ? "bg-[rgba(255,255,255,0.05)] border-[0.667px] border-[rgba(0,255,255,0.2)] text-[rgba(0,255,255,0.6)] text-[11px] font-bold h-[21.833px] px-[8px] rounded-[6px]"
                                              : theme === "dark"
                                                ? "bg-[#2a2a2a] border-[0.667px] border-[#3a3a3a] text-[#9ca3af] text-[11px] font-bold h-[21.833px] px-[8px] rounded-[6px]"
                                                : "bg-[#f4f5f7] border-[0.667px] border-[#e5e7eb] text-[#6b7280] text-[11px] font-bold h-[21.833px] px-[8px] rounded-[6px]"
                                          }>
                                            Inactive
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className={
                                        isFigma
                                          ? "px-2 py-3 text-[12px] text-[#9ca3af]"
                                          : theme === "color"
                                          ? "text-[14px] text-[rgba(0,255,255,0.6)]"
                                          : theme === "dark"
                                            ? "text-[14px] text-[#9ca3af]"
                                            : "text-[14px] text-[#6b7280]"
                                      }>{product.updatedAt ? new Date(product.updatedAt as any).toISOString().split('T')[0] : "-"}</TableCell>
                                      <TableCell
                                        className={
                                          isFigma
                                            ? "w-[1%] whitespace-nowrap px-2 py-3 text-center"
                                            : "text-right"
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={(e) => e.stopPropagation()}
                                              className={
                                                isFigma
                                                  ? "h-[15px] w-[15px] p-0 text-[#9ca3af] hover:bg-transparent hover:text-[#e5e7eb]"
                                                  : `h-7 w-7 opacity-100 ${theme === "color"
                                                      ? "hover:bg-[rgba(0,255,255,0.1)]"
                                                      : "hover:bg-muted/50"
                                                    }`
                                              }
                                            >
                                              <MoreHorizontal
                                                className={
                                                  isFigma
                                                    ? "h-[15px] w-[15px] text-[#9ca3af]"
                                                    : `h-4 w-4 ${theme === "color"
                                                        ? "text-white"
                                                        : theme === "dark"
                                                          ? "text-white group-hover:text-white"
                                                          : "text-black group-hover:text-black"
                                                      }`
                                                }
                                              />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent
                                            align="end"
                                            sideOffset={4}
                                            className={
                                              isFigma
                                                ? "bg-[#181818] border border-[#2a2d3a] text-white"
                                                : theme === "color"
                                                  ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)]"
                                                  : ""
                                            }
                                          >
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditFromList(product);
                                              }}
                                              className={
                                                isFigma
                                                  ? "text-white hover:bg-white/5"
                                                  : theme === "color"
                                                    ? "text-[rgba(0,255,255,0.9)] hover:bg-[rgba(0,255,255,0.1)]"
                                                    : ""
                                              }
                                            >
                                              <Pencil className="h-4 w-4 mr-2" />
                                              Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteFromList(product);
                                              }}
                                              className={
                                                isFigma
                                                  ? "text-red-400 hover:bg-red-500/10"
                                                  : theme === "color"
                                                    ? "text-[rgba(255,100,100,0.9)] hover:bg-[rgba(255,0,0,0.1)]"
                                                    : ""
                                              }
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Pagination */}
                        {!searchTerm && listTotalPages > 1 && (
                          <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 mb-6 pb-16 px-6 ${isFigma ? "text-[#9ca3af]" : ""}`}>
                            <div className={`text-sm ${isFigma ? "text-[#9ca3af]" : "text-muted-foreground"}`}>Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, displayProducts.length)} of {displayProducts.length}</div>
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={`flex items-center gap-1 ${isFigma ? "border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] hover:bg-[#181818]" : ""}`}>
                                <ChevronLeft className="h-4 w-4" />
                                <span className="hidden sm:inline">Previous</span>
                              </Button>
                              <div className="hidden sm:flex items-center space-x-1">
                                {Array.from({ length: Math.min(5, listTotalPages) }, (_, i) => {
                                  let pageNum;
                                  if (listTotalPages <= 5) pageNum = i + 1;
                                  else if (currentPage <= 3) pageNum = i + 1;
                                  else if (currentPage >= listTotalPages - 2) pageNum = listTotalPages - 4 + i;
                                  else pageNum = currentPage - 2 + i;
                                  return (
                                    <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="sm" onClick={() => handlePageChange(pageNum)} className={`w-8 h-8 p-0 ${
                                      currentPage === pageNum
                                        ? isFigma
                                          ? "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)]"
                                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                                        : isFigma
                                          ? "border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] hover:bg-[#181818]"
                                          : "hover:bg-muted/60 dark:hover:bg-white/10"
                                    }`}>
                                      {pageNum}
                                    </Button>
                                  );
                                })}
                              </div>
                              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === listTotalPages} className={`flex items-center gap-1 ${isFigma ? "border-[#2a2d3a] bg-[#181818] text-[#e5e7eb] hover:bg-[#181818]" : ""}`}>
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* Delete Confirmation Dialog */}
          {isFigma ? (
            <DeleteLeadsDialog
              open={isDeleteConfirmOpen}
              onOpenChange={(open) => {
                setIsDeleteConfirmOpen(open);
                if (!open) setProductToDelete(null);
              }}
              leads={
                (selectedProduct || productToDelete)
                  ? [{
                      id: (selectedProduct || productToDelete)!._id,
                      name: (selectedProduct || productToDelete)!.name || "Untitled",
                    }]
                  : []
              }
              title={
                (selectedProduct?.serviceId || productToDelete?.serviceId)
                  ? "Delete Service (1)"
                  : "Delete Product (1)"
              }
              description="This action is permanent. The product/service will be deleted and cannot be recovered."
              selectedLabel={
                (selectedProduct?.serviceId || productToDelete?.serviceId)
                  ? "Selected service"
                  : "Selected product"
              }
              onConfirm={handleDeleteProduct}
              isDeleting={isSaving}
            />
          ) : (
          <AlertDialog
            open={isDeleteConfirmOpen}
            onOpenChange={setIsDeleteConfirmOpen}
          >
            <AlertDialogContent className={
              resolvedTheme === "color"
                ? "sm:max-w-[420px] bg-[rgba(20,20,40,0.85)] backdrop-blur-md text-white border border-[rgba(0,255,255,0.2)] shadow-[0_8px_30px_rgba(0,255,255,0.15)]"
                : resolvedTheme === "dark"
                  ? "sm:max-w-[420px] bg-[#262626] text-[#e5e5e5] border border-[#3a3a3a] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                  : "sm:max-w-[420px] bg-white text-[#111827] border border-[#e5e7eb] shadow-xl"
            }>
              <AlertDialogHeader>
                <AlertDialogTitle className={
                  resolvedTheme === "color"
                    ? "text-[16px] font-semibold text-white"
                    : resolvedTheme === "dark"
                      ? "text-[16px] font-semibold text-[#e5e5e5]"
                      : "text-[16px] font-semibold text-[#111827]"
                }>
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription className={
                  resolvedTheme === "color"
                    ? "text-[13px] text-[rgba(0,255,255,0.6)]"
                    : resolvedTheme === "dark"
                      ? "text-[13px] text-[#9ca3af]"
                      : "text-[13px] text-[#4b5563]"
                }>
                  This action cannot be undone. This will permanently delete the{" "}
                  {(selectedProduct?.serviceId || productToDelete?.serviceId) ? "service" : "product"} &quot;
                  {selectedProduct?.name || productToDelete?.name}
                  &quot; and remove it from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel className={
                  resolvedTheme === "color"
                    ? "px-4 py-2 text-[13px] font-medium bg-transparent border border-[rgba(0,255,255,0.2)] text-white cursor-pointer transition-all duration-200 hover:bg-[rgba(0,255,255,0.1)] hover:border-[rgba(0,255,255,0.4)] hover:scale-[1.02] active:scale-[0.98]"
                    : resolvedTheme === "dark"
                      ? "px-4 py-2 text-[13px] font-medium bg-[rgba(58,58,58,0.3)] border border-[#3a3a3a] text-[#e5e5e5] cursor-pointer transition-all duration-200 hover:bg-[rgba(58,58,58,0.6)] hover:border-[#525252] hover:scale-[1.02] active:scale-[0.98]"
                      : "px-4 py-2 text-[13px] font-medium bg-transparent border border-[#e5e7eb] text-[#111827] cursor-pointer transition-all duration-200 hover:bg-gray-100 hover:border-[#d1d5db] hover:scale-[1.02] active:scale-[0.98]"
                }>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProduct}
                  className="px-4 py-2 text-[13px] font-semibold !bg-red-600 text-white cursor-pointer transition-all duration-200 hover:!bg-red-700 hover:shadow-[0_4px_12px_rgba(220,38,38,0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Deleting..."
                    : (selectedProduct?.serviceId || productToDelete?.serviceId)
                      ? "Delete Service"
                      : "Delete Product"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}

          {isFigma && (
            <DeleteLeadsDialog
              open={isBulkDeleteOpen}
              onOpenChange={setIsBulkDeleteOpen}
              leads={products
                .filter((p) => selectedProductIds.includes(p._id))
                .map((p) => ({ id: p._id, name: p.name || "Untitled" }))}
              totalCount={selectedProductIds.length}
              title={
                selectedProductIds.length === 1
                  ? "Delete Product (1)"
                  : `Delete Products (${selectedProductIds.length})`
              }
              description="This action is permanent. The selected products/services will be deleted and cannot be recovered."
              selectedLabel="Selected products"
              onConfirm={confirmBulkDelete}
              isDeleting={isBulkDeleting}
            />
          )}

          {/* Add/Edit Product Modal */}
          <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
            <DialogContent
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
              className={
              isFigma
                ? "sm:max-w-[510px] max-h-[90vh] overflow-y-auto rounded-[20px] border-0 bg-[#0f0f0f] p-6 text-white shadow-[2px_2px_2px_black]"
                : resolvedTheme === "color"
                ? "sm:max-w-[510px] max-h-[90vh] overflow-y-auto bg-[rgba(20,20,40,0.6)] border-[rgba(0,255,255,0.2)]"
                : resolvedTheme === "dark"
                  ? "sm:max-w-[510px] max-h-[90vh] overflow-y-auto bg-[#262626] border-[#3a3a3a]"
                  : "sm:max-w-[510px] max-h-[90vh] overflow-y-auto bg-white border-[#e5e7eb]"
            }>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className={
                  isFigma
                    ? "absolute right-4 top-4 rounded-sm text-[#9a9a9a] opacity-70 transition-opacity hover:opacity-100 hover:text-white"
                    : resolvedTheme === "color"
                    ? "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-white"
                    : resolvedTheme === "dark"
                      ? "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-[#e5e5e5]"
                      : "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-[#1f1f1f]"
                }
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
              <DialogHeader className="gap-2">
                <DialogTitle className={
                  isFigma
                    ? "text-[18px] font-bold text-white"
                    : resolvedTheme === "color"
                    ? "text-[18px] font-bold text-white"
                    : resolvedTheme === "dark"
                      ? "text-[18px] font-bold text-[#e5e5e5]"
                      : "text-[18px] font-bold text-[#1f1f1f]"
                }>
                  {modalMode === "add" ? "Add New Product" : "Edit Product"}
                </DialogTitle>
                <DialogDescription className={
                  isFigma
                    ? "text-[14px] text-[#9a9a9a]"
                    : resolvedTheme === "color"
                    ? "text-[14px] text-[rgba(0,255,255,0.6)]"
                    : resolvedTheme === "dark"
                      ? "text-[14px] text-[#9ca3af]"
                      : "text-[14px] text-[#6b7280]"
                }>
                  Fill in the details below to add a new product to your catalog.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-6 pt-4">
                <div className="flex flex-col gap-2">
                  <Label className={
                    isFigma
                      ? figmaLabelClass
                      : resolvedTheme === "color"
                      ? "text-[14px] font-bold text-white"
                      : resolvedTheme === "dark"
                        ? "text-[14px] font-bold text-[#e5e5e5]"
                        : "text-[14px] font-bold text-[#1f1f1f]"
                  }>Type</Label>
                  <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                    <SelectTrigger className={
                      isFigma
                        ? figmaSelectTriggerClass
                        : resolvedTheme === "color"
                        ? "h-9 bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.2)] text-white"
                        : resolvedTheme === "dark"
                          ? "h-9 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                          : "h-9 bg-white border-[#e5e7eb] text-[#1f1f1f]"
                    }>
                      <div className="flex items-center gap-2">
                        {formType === "product" ? (
                          <Package className="h-4 w-4 text-[#7b68ee]" />
                        ) : (
                          <Briefcase className="h-4 w-4 text-green-600" />
                        )}
                        <span>{formType === "product" ? "Product" : "Service"}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-[#7b68ee]" />
                          <span>Product</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="service">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-green-600" />
                          <span>Service</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className={
                    isFigma
                      ? figmaLabelClass
                      : resolvedTheme === "color"
                      ? "text-[14px] font-bold text-white"
                      : resolvedTheme === "dark"
                        ? "text-[14px] font-bold text-[#e5e5e5]"
                        : "text-[14px] font-bold text-[#1f1f1f]"
                  }>Name *</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., CRM Enterprise"
                    className={
                      formErrors.name
                        ? "h-9 border-red-500 focus-visible:ring-red-500"
                        : isFigma
                          ? figmaInputClass
                          : resolvedTheme === "color"
                          ? "h-9 bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.2)] text-white placeholder:text-[rgba(0,255,255,0.6)]"
                          : resolvedTheme === "dark"
                            ? "h-9 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5] placeholder:text-[#9ca3af]"
                            : "h-9 bg-white border-[#e5e7eb] text-[#1f1f1f] placeholder:text-[#6b7280]"
                    }
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-500">{formErrors.name}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label className={
                    isFigma
                      ? figmaLabelClass
                      : resolvedTheme === "color"
                      ? "text-[14px] font-bold text-white"
                      : resolvedTheme === "dark"
                        ? "text-[14px] font-bold text-[#e5e5e5]"
                        : "text-[14px] font-bold text-[#1f1f1f]"
                  }>Code *</Label>
                  <Input
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g., CRM-ENT"
                    className={
                      isFigma
                        ? figmaInputClass
                        : resolvedTheme === "color"
                        ? "h-9 bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.2)] text-white placeholder:text-[rgba(0,255,255,0.6)]"
                        : resolvedTheme === "dark"
                          ? "h-9 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5] placeholder:text-[#9ca3af]"
                          : "h-9 bg-white border-[#e5e7eb] text-[#1f1f1f] placeholder:text-[#6b7280]"
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className={
                    isFigma
                      ? figmaLabelClass
                      : resolvedTheme === "color"
                      ? "text-[14px] font-bold text-white"
                      : resolvedTheme === "dark"
                        ? "text-[14px] font-bold text-[#e5e5e5]"
                        : "text-[14px] font-bold text-[#1f1f1f]"
                  }>Category *</Label>
                  <Input
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g., Software"
                    className={
                      formErrors.category
                        ? "h-9 border-red-500 focus-visible:ring-red-500"
                        : isFigma
                          ? figmaInputClass
                          : resolvedTheme === "color"
                          ? "h-9 bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.2)] text-white placeholder:text-[rgba(0,255,255,0.6)]"
                          : resolvedTheme === "dark"
                            ? "h-9 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5] placeholder:text-[#9ca3af]"
                            : "h-9 bg-white border-[#e5e7eb] text-[#1f1f1f] placeholder:text-[#6b7280]"
                    }
                  />
                  {formErrors.category && (
                    <p className="text-xs text-red-500">{formErrors.category}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label className={
                      isFigma
                        ? figmaLabelClass
                        : resolvedTheme === "color"
                        ? "text-[14px] font-bold text-white"
                        : resolvedTheme === "dark"
                          ? "text-[14px] font-bold text-[#e5e5e5]"
                          : "text-[14px] font-bold text-[#1f1f1f]"
                    }>Price *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formPrice}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || !isNaN(parseFloat(value))) {
                          setFormPrice(value);
                        }
                      }}
                      placeholder="0.00"
                      className={
                        formErrors.price
                          ? "h-9 border-red-500 focus-visible:ring-red-500"
                          : isFigma
                            ? figmaInputClass
                            : resolvedTheme === "color"
                            ? "h-9 bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.2)] text-white placeholder:text-[rgba(0,255,255,0.6)]"
                            : resolvedTheme === "dark"
                              ? "h-9 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5] placeholder:text-[#9ca3af]"
                              : "h-9 bg-white border-[#e5e7eb] text-[#1f1f1f] placeholder:text-[#6b7280]"
                      }
                    />
                    {formErrors.price && (
                      <p className="text-xs text-red-500">{formErrors.price}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className={
                      isFigma
                        ? figmaLabelClass
                        : resolvedTheme === "color"
                        ? "text-[14px] font-bold text-white"
                        : resolvedTheme === "dark"
                          ? "text-[14px] font-bold text-[#e5e5e5]"
                          : "text-[14px] font-bold text-[#1f1f1f]"
                    }>Unit</Label>
                    <Select value={formUnit} onValueChange={(v: any) => setFormUnit(v)}>
                      <SelectTrigger className={
                        isFigma
                          ? figmaSelectTriggerClass
                          : resolvedTheme === "color"
                          ? "h-9 bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.2)] text-white"
                          : resolvedTheme === "dark"
                            ? "h-9 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                            : "h-9 bg-white border-[#e5e7eb] text-[#1f1f1f]"
                      }>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="one-time">One-time</SelectItem>
                        <SelectItem value="per-unit">Per Unit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className={
                    isFigma
                      ? figmaLabelClass
                      : resolvedTheme === "color"
                      ? "text-[14px] font-bold text-white"
                      : resolvedTheme === "dark"
                        ? "text-[14px] font-bold text-[#e5e5e5]"
                        : "text-[14px] font-bold text-[#1f1f1f]"
                  }>Status</Label>
                  <Select value={formStatus} onValueChange={(v: any) => setFormStatus(v)}>
                    <SelectTrigger className={
                      isFigma
                        ? figmaSelectTriggerClass
                        : resolvedTheme === "color"
                        ? "h-9 bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.2)] text-white"
                        : resolvedTheme === "dark"
                          ? "h-9 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                          : "h-9 bg-white border-[#e5e7eb] text-[#1f1f1f]"
                    }>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Pause">Pause</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className={
                    isFigma
                      ? figmaLabelClass
                      : resolvedTheme === "color"
                      ? "text-[14px] font-bold text-white"
                      : resolvedTheme === "dark"
                        ? "text-[14px] font-bold text-[#e5e5e5]"
                        : "text-[14px] font-bold text-[#1f1f1f]"
                  }>Description</Label>
                  <Textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Enter a detailed description..."
                    className={
                      isFigma
                        ? figmaTextareaClass
                        : resolvedTheme === "color"
                        ? "min-h-[64px] bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.2)] text-white placeholder:text-[rgba(0,255,255,0.6)]"
                        : resolvedTheme === "dark"
                          ? "min-h-[64px] bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5] placeholder:text-[#9ca3af]"
                          : "min-h-[64px] bg-white border-[#e5e7eb] text-[#1f1f1f] placeholder:text-[#6b7280]"
                    }
                  />
                </div>
              </div>
              <DialogFooter className="gap-3 pt-4">
                <Button
                  onClick={handleSubmitProductModal}
                  className={
                    isFigma
                      ? "flex-1 h-9 rounded-[8px] bg-brand text-brand-foreground font-bold text-[14px] shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand)_95%,black)]"
                      : resolvedTheme === "color"
                      ? "flex-1 h-9 bg-[#0ff] text-[#0a0e27] font-bold text-[14px] cursor-pointer transition-all duration-200 hover:bg-[#0ff]/80 hover:shadow-[0_4px_12px_rgba(0,255,255,0.4)] hover:scale-[1.02] active:scale-[0.98]"
                      : "flex-1 !h-9 !bg-[#8b7aff] text-white font-bold text-[14px] cursor-pointer transition-all duration-200 hover:!bg-[#7b6aee] hover:shadow-[0_4px_12px_rgba(139,122,255,0.4)] hover:scale-[1.02] active:scale-[0.98]"
                  }
                >
                  {modalMode === "add" ? "Add Product" : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={closeProductModal}
                  className={
                    isFigma
                      ? "flex-1 h-9 rounded-[8px] border-[#3a3a3a] bg-transparent text-white font-bold text-[14px] shadow-none hover:bg-white/5"
                      : resolvedTheme === "color"
                      ? "flex-1 h-9 bg-transparent border-[rgba(0,255,255,0.2)] text-white font-bold text-[14px] cursor-pointer transition-all duration-200 hover:bg-[rgba(0,255,255,0.1)] hover:border-[rgba(0,255,255,0.4)] hover:scale-[1.02] active:scale-[0.98]"
                      : resolvedTheme === "dark"
                        ? "flex-1 h-9 bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5] font-bold text-[14px] cursor-pointer transition-all duration-200 hover:bg-[rgba(58,58,58,0.6)] hover:border-[#525252] hover:scale-[1.02] active:scale-[0.98]"
                        : "flex-1 h-9 bg-white border-[#e5e7eb] text-[#1f1f1f] font-bold text-[14px] cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:border-[#d1d5db] hover:scale-[1.02] active:scale-[0.98]"
                  }
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Filters Dialog */}
          {isFigma ? (
        <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
          <DialogContent
            showCloseButton={false}
            className="!max-w-[min(494px,calc(100vw-2rem))] w-full p-0 rounded-[12px] border border-[#334155] bg-[#2e2e2e] shadow-[0px_24px_48px_0px_rgba(0,0,0,0.5)] gap-0 overflow-hidden"
          >
            <div className="flex w-full min-w-0 overflow-hidden h-[280px]">
              <div className="flex w-[210px] shrink-0 flex-col border-r border-[#2e2e48]">
                <div className="px-4 pb-3 pt-5 flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-white">Filters</h3>
                  <button type="button" onClick={() => setIsFilterDialogOpen(false)} className="text-[#94a3b8] hover:text-white" aria-label="Close">
                    <X className="size-4" />
                  </button>
                </div>
                {([
                  { id: "type" as const, label: "Type" },
                  { id: "status" as const, label: "Status" },
                ]).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveFilterCategory(cat.id)}
                    className={`flex h-10 w-full items-center justify-between pl-4 pr-3 text-left ${
                      activeFilterCategory === cat.id ? "bg-[#181818]" : "hover:bg-[#181818]/60"
                    }`}
                  >
                    <span className="text-[12px] font-semibold text-white">{cat.label}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-white" />
                  </button>
                ))}
              </div>
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-5 gap-4">
                <h4 className="text-[14px] font-bold text-white">
                  {activeFilterCategory === "type" ? "Type" : "Status"}
                </h4>
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                  {activeFilterCategory === "type" ? (
                    <>
                      {([
                        { id: "all" as const, label: "All Types" },
                        { id: "products" as const, label: "Products" },
                        { id: "services" as const, label: "Services" },
                      ]).map((opt) => {
                        const checked = tempTypeFilter === opt.id;
                        return (
                          <button key={opt.id} type="button" onClick={() => setTempTypeFilter(opt.id)} className="flex h-9 items-center gap-2.5 rounded-[6px] px-2 text-left hover:bg-white/5">
                            <span className={`flex size-4 items-center justify-center rounded-[4px] border ${checked ? "border-brand bg-brand" : "border-[#64748b] bg-transparent"}`}>
                              {checked ? <span className="text-[10px] font-bold text-brand-foreground">✓</span> : null}
                            </span>
                            <span className="text-[14px] text-white">{opt.label}</span>
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {([
                        { id: "all" as const, label: "All Status" },
                        { id: "active" as const, label: "Active" },
                        { id: "pause" as const, label: "Pause" },
                        { id: "inactive" as const, label: "Inactive" },
                      ]).map((opt) => {
                        const checked = tempStatusFilter === opt.id;
                        return (
                          <button key={opt.id} type="button" onClick={() => setTempStatusFilter(opt.id)} className="flex h-9 items-center gap-2.5 rounded-[6px] px-2 text-left hover:bg-white/5">
                            <span className={`flex size-4 items-center justify-center rounded-[4px] border ${checked ? "border-brand bg-brand" : "border-[#64748b] bg-transparent"}`}>
                              {checked ? <span className="text-[10px] font-bold text-brand-foreground">✓</span> : null}
                            </span>
                            <span className="text-[14px] text-white">{opt.label}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex h-16 shrink-0 items-center justify-between border-t border-[#181818] px-4">
              <button
                type="button"
                onClick={() => setIsFilterDialogOpen(false)}
                className="text-[14px] font-semibold text-[#94a3b8] hover:text-white"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTempTypeFilter("all");
                    setTempStatusFilter("all");
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setIsFilterDialogOpen(false);
                  }}
                  className="h-[35px] rounded-[6px] border-[#334155] bg-transparent px-3 text-[13px] font-semibold text-white shadow-none hover:bg-white/5"
                >
                  Reset Filter
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setTypeFilter(tempTypeFilter);
                    setStatusFilter(tempStatusFilter);
                    setIsFilterDialogOpen(false);
                  }}
                  className="h-[35px] rounded-[6px] bg-brand px-4 text-[13px] font-bold text-brand-foreground shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)]"
                >
                  Apply Filter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
          ) : (
          <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
            <DialogContent
              className={
                isFigma
                  ? "sm:max-w-[286.667px] p-0 rounded-[12px] border border-[#334155] bg-[#0f0f0f] shadow-[0_8px_30px_rgba(0,0,0,0.5)] gap-0 overflow-hidden"
                  : resolvedTheme === "color"
                  ? "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[rgba(0,255,255,0.2)] bg-[rgba(20,20,40,0.85)] backdrop-blur-md shadow-[0_8px_30px_rgba(0,255,255,0.15)]"
                  : resolvedTheme === "dark"
                    ? "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[#27272f] bg-[#020617] shadow-[0_8px_30px_rgba(0,0,0,0.5)] dark"
                    : "sm:max-w-[286.667px] p-0 rounded-[6px] border-[0.667px] border-[#e5e7eb] bg-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
              }
            >
              <div className={isFigma ? "" : resolvedTheme === "dark" ? "dark" : ""}>
                {/* Header */}
                <div className={`border-b-[0.667px] h-[52.667px] px-4 py-4 flex items-center ${isFigma ? "border-[#2e2e2e]" : "border-[#e5e7eb] dark:border-[#27272f]"}`}>
                  <h3 className={`font-['Arial',sans-serif] font-bold text-[14px] leading-[20px] ${isFigma ? "text-white" : "text-[#1f1f1f] dark:text-gray-100"}`}>
                    Filters
                  </h3>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-4 p-4 max-h-[472px] overflow-y-auto">
                  {/* Type Section */}
                  <div className="flex flex-col gap-2">
                    <label className={`font-['Arial',sans-serif] font-bold text-[12px] leading-[16px] ${isFigma ? "text-[#9a9a9a]" : "text-[#1f1f1f] dark:text-gray-200"}`}>
                      Type
                    </label>
                    <div className="flex flex-col gap-1">
                      {/* All Types */}
                      <div
                        onClick={() => setTempTypeFilter("all")}
                        className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${tempTypeFilter === "all"
                            ? isFigma ? "bg-white/5" : "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.25)]"
                            : isFigma ? "hover:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                          }`}
                      >
                        <div
                          className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${tempTypeFilter === "all"
                              ? isFigma ? "bg-brand border-brand" : "bg-[#7b68ee] border-[#7b68ee]"
                              : isFigma ? "border-[#64748b]" : "border-[#e5e7eb] dark:border-[#3f3f46]"
                            }`}
                        >
                          {tempTypeFilter === "all" && (
                            <Check className={`h-3 w-3 ${isFigma ? "text-black" : "text-white"}`} />
                          )}
                        </div>
                        <span
                          className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${tempTypeFilter === "all"
                              ? isFigma ? "font-bold text-brand" : "font-bold text-[#7b68ee]"
                              : isFigma ? "font-normal text-white" : "font-normal text-[#1f1f1f] dark:text-gray-300"
                            }`}
                        >
                          All Types
                        </span>
                      </div>

                      {/* Products */}
                      <div
                        onClick={() => setTempTypeFilter("products")}
                        className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${tempTypeFilter === "products"
                            ? isFigma ? "bg-white/5" : "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.25)]"
                            : isFigma ? "hover:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                          }`}
                      >
                        <div
                          className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${tempTypeFilter === "products"
                              ? isFigma ? "bg-brand border-brand" : "bg-[#7b68ee] border-[#7b68ee]"
                              : isFigma ? "border-[#64748b]" : "border-[#e5e7eb] dark:border-[#3f3f46]"
                            }`}
                        >
                          {tempTypeFilter === "products" && (
                            <Check className={`h-3 w-3 ${isFigma ? "text-black" : "text-white"}`} />
                          )}
                        </div>
                        <span
                          className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${tempTypeFilter === "products"
                              ? isFigma ? "font-bold text-brand" : "font-bold text-[#7b68ee]"
                              : isFigma ? "font-normal text-white" : "font-normal text-[#1f1f1f] dark:text-gray-300"
                            }`}
                        >
                          Products
                        </span>
                      </div>

                      {/* Services */}
                      <div
                        onClick={() => setTempTypeFilter("services")}
                        className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${tempTypeFilter === "services"
                            ? isFigma ? "bg-white/5" : "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.25)]"
                            : isFigma ? "hover:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                          }`}
                      >
                        <div
                          className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${tempTypeFilter === "services"
                              ? isFigma ? "bg-brand border-brand" : "bg-[#7b68ee] border-[#7b68ee]"
                              : isFigma ? "border-[#64748b]" : "border-[#e5e7eb] dark:border-[#3f3f46]"
                            }`}
                        >
                          {tempTypeFilter === "services" && (
                            <Check className={`h-3 w-3 ${isFigma ? "text-black" : "text-white"}`} />
                          )}
                        </div>
                        <span
                          className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${tempTypeFilter === "services"
                              ? isFigma ? "font-bold text-brand" : "font-bold text-[#7b68ee]"
                              : isFigma ? "font-normal text-white" : "font-normal text-[#1f1f1f] dark:text-gray-300"
                            }`}
                        >
                          Services
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Section */}
                  <div className="flex flex-col gap-2">
                    <label className={`font-['Arial',sans-serif] font-bold text-[12px] leading-[16px] ${isFigma ? "text-[#9a9a9a]" : "text-[#1f1f1f] dark:text-gray-200"}`}>
                      Status
                    </label>
                    <div className="flex flex-col gap-1">
                      {/* All Status */}
                      <div
                        onClick={() => setTempStatusFilter("all")}
                        className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${tempStatusFilter === "all"
                            ? isFigma ? "bg-white/5" : "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.25)]"
                            : isFigma ? "hover:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                          }`}
                      >
                        <div
                          className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${tempStatusFilter === "all"
                              ? isFigma ? "bg-brand border-brand" : "bg-[#7b68ee] border-[#7b68ee]"
                              : isFigma ? "border-[#64748b]" : "border-[#e5e7eb] dark:border-[#3f3f46]"
                            }`}
                        >
                          {tempStatusFilter === "all" && (
                            <Check className={`h-3 w-3 ${isFigma ? "text-black" : "text-white"}`} />
                          )}
                        </div>
                        <span
                          className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${tempStatusFilter === "all"
                              ? isFigma ? "font-bold text-brand" : "font-bold text-[#7b68ee]"
                              : isFigma ? "font-normal text-white" : "font-normal text-[#1f1f1f] dark:text-gray-300"
                            }`}
                        >
                          All Status
                        </span>
                      </div>

                      {/* Active */}
                      <div
                        onClick={() => setTempStatusFilter("active")}
                        className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${tempStatusFilter === "active"
                            ? isFigma ? "bg-white/5" : "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.25)]"
                            : isFigma ? "hover:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                          }`}
                      >
                        <div
                          className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${tempStatusFilter === "active"
                              ? isFigma ? "bg-brand border-brand" : "bg-[#7b68ee] border-[#7b68ee]"
                              : isFigma ? "border-[#64748b]" : "border-[#e5e7eb] dark:border-[#3f3f46]"
                            }`}
                        >
                          {tempStatusFilter === "active" && (
                            <Check className={`h-3 w-3 ${isFigma ? "text-black" : "text-white"}`} />
                          )}
                        </div>
                        <span
                          className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${tempStatusFilter === "active"
                              ? isFigma ? "font-bold text-brand" : "font-bold text-[#7b68ee]"
                              : isFigma ? "font-normal text-white" : "font-normal text-[#1f1f1f] dark:text-gray-300"
                            }`}
                        >
                          Active
                        </span>
                      </div>

                      {/* Inactive */}
                      <div
                        onClick={() => setTempStatusFilter("inactive")}
                        className={`flex gap-2 h-[28px] items-center pl-2 pr-0 py-0 rounded-[6px] cursor-pointer ${tempStatusFilter === "inactive"
                            ? isFigma ? "bg-white/5" : "bg-[rgba(123,104,238,0.1)] dark:bg-[rgba(139,122,255,0.25)]"
                            : isFigma ? "hover:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-[#111827]"
                          }`}
                      >
                        <div
                          className={`shrink-0 size-[14px] rounded-[4px] border-[0.667px] flex items-center justify-center ${tempStatusFilter === "inactive"
                              ? isFigma ? "bg-brand border-brand" : "bg-[#7b68ee] border-[#7b68ee]"
                              : isFigma ? "border-[#64748b]" : "border-[#e5e7eb] dark:border-[#3f3f46]"
                            }`}
                        >
                          {tempStatusFilter === "inactive" && (
                            <Check className={`h-3 w-3 ${isFigma ? "text-black" : "text-white"}`} />
                          )}
                        </div>
                        <span
                          className={`font-['Arial',sans-serif] text-[12px] leading-[16px] ${tempStatusFilter === "inactive"
                              ? isFigma ? "font-bold text-brand" : "font-bold text-[#7b68ee]"
                              : isFigma ? "font-normal text-white" : "font-normal text-[#1f1f1f] dark:text-gray-300"
                            }`}
                        >
                          Inactive
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className={`border-t-[0.667px] h-[52.667px] px-3 py-3 flex items-center justify-between ${isFigma ? "border-[#2e2e2e]" : "border-[#e5e7eb] dark:border-[#27272f]"}`}>
                  <Button
                    variant="outline"
                    onClick={() => setIsFilterDialogOpen(false)}
                    className={`h-[28px] px-3 rounded-[6px] text-[12px] font-['Arial',sans-serif] font-bold border-0 bg-transparent shadow-none cursor-pointer transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] ${
                      isFigma
                        ? "text-[#94a3b8] hover:bg-white/5 hover:text-white"
                        : "text-[#1f1f1f] hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#1f2937]"
                    }`}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setTypeFilter(tempTypeFilter);
                      setStatusFilter(tempStatusFilter);
                      setIsFilterDialogOpen(false);
                    }}
                    className={`h-[28px] px-3 rounded-[6px] text-[12px] font-['Arial',sans-serif] font-bold cursor-pointer transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] ${
                      isFigma
                        ? "bg-brand text-brand-foreground shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)]"
                        : "bg-[#7b68ee] text-white hover:bg-[#6b58dd] hover:shadow-[0_4px_12px_rgba(123,104,238,0.4)]"
                    }`}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}

          <ViewFunnelDialog
            open={isViewFunnelOpen}
            onOpenChange={setIsViewFunnelOpen}
            viewingFunnel={viewingFunnel}
            isLoading={isLoadingFunnelDetails}
          />

          {/* View Product Dialog */}
          <Dialog open={isViewProductOpen} onOpenChange={setIsViewProductOpen}>
            <DialogContent className={`sm:max-w-[800px] max-h-[90vh] overflow-y-auto ${resolvedTheme === "color"
              ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)] text-white"
              : resolvedTheme === "dark"
                ? "bg-[#14141b] border-[#3a3a3a] text-[#e5e5e5]"
                : "bg-white border-[#e5e7eb]"
              }`}>
              <DialogHeader>
                <DialogTitle className={resolvedTheme === "dark" ? "text-[#f3f4f6]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.9)]" : ""}>Product Details</DialogTitle>
                <DialogDescription className={resolvedTheme === "dark" ? "text-[#9ca3af]" : resolvedTheme === "color" ? "text-[rgba(0,255,255,0.7)]" : ""}>
                  View product information
                </DialogDescription>
              </DialogHeader>

              {isLoadingProductDetails ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : viewingProduct ? (
                <div className="space-y-6 py-4">
                  <div className={`border border-[0.667px] rounded-[12px] p-6 flex flex-col gap-6 ${resolvedTheme === "dark"
                    ? "bg-[#262626] border-[#3a3a3a]"
                    : resolvedTheme === "color"
                      ? "bg-[rgba(20,20,40,0.6)] border-[rgba(0,255,255,0.2)]"
                      : "bg-white border-[#e5e7eb]"
                    }`}>
                    <h4 className={`text-[14px] font-bold leading-[20px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                      }`}>Product Information</h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-[8px]">
                        <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                          }`}>Name</Label>
                        <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                          ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                          : resolvedTheme === "color"
                            ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                            : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                          }`}>
                          {viewingProduct.name || "--"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-[8px]">
                        <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                          }`}>Type</Label>
                        <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                          ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                          : resolvedTheme === "color"
                            ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                            : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                          }`}>
                          {viewingProduct.serviceId ? "Service" : "Product"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-[8px]">
                        <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                          }`}>Category</Label>
                        <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                          ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                          : resolvedTheme === "color"
                            ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                            : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                          }`}>
                          {viewingProduct.category || "--"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-[8px]">
                        <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                          }`}>Price</Label>
                        <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                          ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                          : resolvedTheme === "color"
                            ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                            : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                          }`}>
                          {viewingProduct.pricing ? `₹${typeof viewingProduct.pricing === 'number' ? viewingProduct.pricing.toLocaleString() : viewingProduct.pricing}${viewingProduct.unit ? `/${viewingProduct.unit}` : ''}` : "--"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-[8px]">
                        <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                          }`}>Status</Label>
                        <div className={`border border-[0.667px] rounded-[6px] h-8 px-3 py-1 text-[14px] flex items-center ${resolvedTheme === "dark"
                          ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                          : resolvedTheme === "color"
                            ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                            : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                          }`}>
                          {viewingProduct.status || "--"}
                        </div>
                      </div>

                      {viewingProduct.description && (
                        <div className="flex flex-col gap-[8px] col-span-2">
                          <Label className={`text-[12px] font-bold leading-[16px] ${resolvedTheme === "dark" ? "text-[#e5e5e5]" : resolvedTheme === "color" ? "text-white" : "text-[#1f1f1f]"
                            }`}>Description</Label>
                          <div className={`border border-[0.667px] rounded-[6px] min-h-[80px] px-3 py-2 text-[14px] ${resolvedTheme === "dark"
                            ? "bg-[rgba(58,58,58,0.3)] border-[#3a3a3a] text-[#e5e5e5]"
                            : resolvedTheme === "color"
                              ? "bg-[rgba(0,0,0,0.3)] border-[rgba(0,255,255,0.1)] text-[rgba(0,255,255,0.9)]"
                              : "bg-gray-50 border-[#e5e7eb] text-[#1f1f1f]"
                            }`}>
                            {viewingProduct.description}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  No product data available
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsViewProductOpen(false)}
                  className={resolvedTheme === "dark"
                    ? "border-[#3a3a3a] bg-[#1f1f1f] text-[#ececf4] hover:bg-[#2a2a2a]"
                    : resolvedTheme === "color"
                      ? "border-[rgba(0,255,255,0.2)] bg-[rgba(255,255,255,0.03)] text-white hover:bg-[rgba(0,255,255,0.08)]"
                      : ""}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
