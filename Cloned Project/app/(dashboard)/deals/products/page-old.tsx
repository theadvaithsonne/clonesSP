"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  Edit,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  // SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createActivity } from "@/lib/activity";
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
import { productsApi, type Product as ApiProduct, type CreateProductData } from "@/app/lib/crm/api-client";
import { IconSelector } from "@/components/ui/icon-selector";
import * as Icons from "lucide-react";

// Use the Product type from the API client
type Product = ApiProduct;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: "",
    description: "",
    price: undefined,
    sku: "",
    category: "",
    commissionPercentage: undefined,
    icon: "",
  });

  // Fetch products from the API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        // const data = await productsApi.getAll(selectedCategory || undefined);
        const data = await productsApi.getAll();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
        toast.error("Failed to load products. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory]);

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description &&
        product.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Get unique categories from products
  const categories = Array.from(
    new Set(
      products
        .filter((p) => p.category)
        .map((product) => product.category as string)
    )
  );

  // Handle product deletion
  const handleDeleteProduct = async (product: Product) => {
    try {
      await productsApi.delete(product._id);

      // Remove the deleted product from the state
      setProducts(products.filter((p) => p._id !== product._id));

      // Create activity record for product deletion
      await createActivity({
        type: "delete",
        entityType: "product",
        entityId: product._id,
        entityName: product.name,
        description: `Deleted product: ${product.name}`,
      });

      toast.success("Product deleted successfully");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    } finally {
      setProductToDelete(null);
    }
  };

  // Handle edit product
  const handleEditProduct = (product: Product) => {
    setCurrentProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description,
      price: product.price,
      sku: product.sku,
      category: product.category,
      commissionPercentage: product.commissionPercentage,
      icon: product.icon,
    });
    setIsEditDialogOpen(true);
  };

  // Handle product update
  const handleUpdateProduct = async () => {
    if (!currentProduct?._id || !newProduct.name) {
      toast.error("Product name is required");
      return;
    }

    try {
      const updatedProduct = await productsApi.update(currentProduct._id, newProduct);

      // Update the product in the state
      setProducts(
        products.map((p) => (p._id === currentProduct._id ? updatedProduct : p))
      );

      // Reset form and close dialog
      setNewProduct({
        name: "",
        description: "",
        price: undefined,
        sku: "",
        category: "",
        commissionPercentage: undefined,
        icon: "",
      });
      setCurrentProduct(null);
      setIsEditDialogOpen(false);

      // Create activity record for product update
      await createActivity({
        type: "update",
        entityType: "product",
        entityId: currentProduct._id,
        entityName: updatedProduct.name,
        description: `Updated product: ${updatedProduct.name}`,
      });

      toast.success("Product updated successfully");
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
    }
  };

  // Get icon component from icon name
  const getProductIcon = (iconName?: string, fallbackCategory?: string) => {
    if (iconName) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IconComponent = (Icons as any)[iconName];
        if (IconComponent) {
          return <IconComponent className="h-8 w-8" />;
        }
      } catch {
        // Fallback if icon not found
      }
    }

    // Fallback to category-based emoji
    if (!fallbackCategory) return "📦";

    const categoryMap: Record<string, string> = {
      Software: "💻",
      Service: "🔧",
      Hardware: "🖥️",
      Subscription: "🔄",
      Training: "📚",
      Consulting: "🧠",
    };

    return categoryMap[fallbackCategory] || "📦";
  };

  // Handle form input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "price" || name === "commissionPercentage") {
      // Handle price and commission as numbers
      setNewProduct((prev) => ({
        ...prev,
        [name]: value === "" ? undefined : parseFloat(value),
      }));
    } else {
      setNewProduct((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Handle category selection
  const handleCategorySelect = (value: string) => {
    setNewProduct((prev) => ({ ...prev, category: value }));
  };

  // Handle icon selection
  const handleIconSelect = (icon: string) => {
    setNewProduct((prev) => ({ ...prev, icon }));
  };

  // Handle product creation
  const handleCreateProduct = async () => {
    if (!newProduct.name) {
      toast.error("Product name is required");
      return;
    }

    if (!newProduct.category) {
      toast.error("Category is required");
      return;
    }

    if (newProduct.price === undefined || newProduct.price <= 0) {
      toast.error("Price is required and must be greater than 0");
      return;
    }

    if (newProduct.commissionPercentage === undefined || newProduct.commissionPercentage < 0 || newProduct.commissionPercentage > 100) {
      toast.error("Commission percentage is required and must be between 0 and 100");
      return;
    }

    setIsCreating(true);

    try {
      const createdProduct = await productsApi.create(newProduct as CreateProductData);

      // Add the new product to the state
      setProducts((prev) => [...prev, createdProduct]);

      // Reset form and close dialog
      setNewProduct({
        name: "",
        description: "",
        price: undefined,
        sku: "",
        category: "",
        commissionPercentage: undefined,
        icon: "",
      });
      setIsAddDialogOpen(false);

      // Create activity record for product creation
      await createActivity({
        type: "create",
        entityType: "product",
        entityId: createdProduct._id?.toString() || "",
        entityName: createdProduct.name,
        description: `Created new product: ${createdProduct.name}`,
      });

      toast.success("Product created successfully");
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Failed to create product");
    } finally {
      setIsCreating(false);
    }
  };

  // Default category options if none exists yet
  const categoryOptions =
    // categories.length > 0
    //   ? categories
    //   :
    [
      "Software",
      "Service",
      "Hardware",
      "Subscription",
      "Training",
      "Consulting",
    ];

  // Check if create form is valid
  const isCreateFormValid =
    newProduct.name?.trim() !== "" &&
    newProduct.category !== "" &&
    newProduct.category !== undefined &&
    newProduct.price !== undefined &&
    newProduct.price > 0 &&
    newProduct.commissionPercentage !== undefined &&
    newProduct.commissionPercentage >= 0 &&
    newProduct.commissionPercentage <= 100;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Products & Services</h1>
        <div className="flex gap-2">
          {/* <Button variant="outline">
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Filter
          </Button> */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={newProduct.name}
                    onChange={handleInputChange}
                    placeholder="Enter product name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={newProduct.category}
                      onValueChange={handleCategorySelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      name="sku"
                      value={newProduct.sku}
                      onChange={handleInputChange}
                      placeholder="Stock keeping unit"
                    />
                  </div> */}
                  <div className="space-y-2">
                    <Label htmlFor="price">Price *</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={
                        newProduct.price === undefined ? "" : newProduct.price
                      }
                      onChange={handleInputChange}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commissionPercentage">Commission Percentage *</Label>
                  <Input
                    id="commissionPercentage"
                    name="commissionPercentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={
                      newProduct.commissionPercentage === undefined ? "" : newProduct.commissionPercentage
                    }
                    onChange={handleInputChange}
                    placeholder="0.00"
                  />
                </div>



                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={newProduct.description}
                    onChange={handleInputChange}
                    placeholder="Product description"
                    className="min-h-[100px]"
                  />
                </div>

                <IconSelector
                  value={newProduct.icon}
                  onSelect={handleIconSelect}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProduct}
                  disabled={!isCreateFormValid || isCreating}
                >
                  {isCreating ? "Creating..." : "Create Product"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex gap-2 w-full max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {selectedCategory || "All Categories"}{" "}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedCategory(null)}>
                All Categories
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuItem
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product._id} className="overflow-hidden">
              <CardHeader className="p-4 pb-0">
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-2">
                    <div className="text-3xl flex items-center justify-center">
                      {getProductIcon(product.icon, product.category)}
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {product.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {product.category || "Uncategorized"}
                      </p>
                    </div>
                  </div>
                  {product.sku && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-800"
                    >
                      {product.sku}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description || "No description available"}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-lg font-bold">
                    {formatCurrency(product.price)}
                  </p>
                  {product.commissionPercentage !== undefined && (
                    <p className="text-sm text-green-600 font-medium">
                      Commission: {product.commissionPercentage}%
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex justify-between">
                {/* <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add to Deal
                </Button> */}
                <div></div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleEditProduct(product)}
                    >
                      <Edit className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    {/* <DropdownMenuItem>
                      <Package className="h-4 w-4 mr-2" /> View Details
                    </DropdownMenuItem> */}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => setProductToDelete(product)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Product Name *</Label>
              <Input
                id="edit-name"
                name="name"
                value={newProduct.name}
                onChange={handleInputChange}
                placeholder="Enter product name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={newProduct.category}
                  onValueChange={handleCategorySelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU</Label>
                <Input
                  id="edit-sku"
                  name="sku"
                  value={newProduct.sku}
                  onChange={handleInputChange}
                  placeholder="Stock keeping unit"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-price">Price</Label>
                <Input
                  id="edit-price"
                  name="price"
                  type="number"
                  step="0.01"
                  value={newProduct.price === undefined ? "" : newProduct.price}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-commissionPercentage">Commission %</Label>
                <Input
                  id="edit-commissionPercentage"
                  name="commissionPercentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={newProduct.commissionPercentage === undefined ? "" : newProduct.commissionPercentage}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                name="description"
                value={newProduct.description}
                onChange={handleInputChange}
                placeholder="Product description"
                className="min-h-[100px]"
              />
            </div>

            <IconSelector
              value={newProduct.icon}
              onSelect={handleIconSelect}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateProduct}
              disabled={!newProduct.name || newProduct.name.trim() === ""}
              variant={!newProduct.name || newProduct.name.trim() === "" ? "ghost" : "default"}
            >Update Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!productToDelete}
        onOpenChange={() => setProductToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              product &quot;{productToDelete?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                productToDelete && handleDeleteProduct(productToDelete)
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
