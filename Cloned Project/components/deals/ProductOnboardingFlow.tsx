"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, UploadCloud, Download, Plus, X } from "lucide-react";
import { uploadFiles } from "@/utils/uploadthing";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";

// Reusable File Upload Component
// function FileUploadArea({
//   label,
//   fileTypes,
//   maxSize,
//   onFileSelect,
//   uploadedFiles,
//   isLoading,
//   onRemoveFile,
// }: {
//   label: string;
//   fileTypes: string;
//   maxSize: string;
//   onFileSelect?: (file: File) => void;
//   uploadedFiles?: Array<{ name: string; url: string }>;
//   isLoading?: boolean;
//   onRemoveFile?: (index: number) => void;
// }) {
//   const fileInputRef = React.useRef<HTMLInputElement>(null);

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = e.target.files;
//     if (files && onFileSelect) {
//       // Process each selected file
//       Array.from(files).forEach(file => {
//         onFileSelect(file);
//       });
//     }
//   };

//   const handleClick = () => {
//     if (fileInputRef.current && !isLoading) {
//       fileInputRef.current.click();
//     }
//   };

//   return (
//     <div className="space-y-2">
//       <Label htmlFor={`file-upload-${label.replace(/\s/g, "-").toLowerCase()}`}>
//         {label}
//       </Label>
//       <div
//         className="flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
//         onClick={handleClick}
//       >
//         <UploadCloud className="h-8 w-8 text-gray-400 mb-2" />
//         <p className="text-sm text-gray-500">
//           <span className="font-medium text-blue-600">
//             Click to upload multiple files
//           </span>{" "}
//           or Drag and Drop
//         </p>
//         <p className="text-xs text-gray-400">
//           {fileTypes} (max. {maxSize})
//         </p>
//         <Input
//           ref={fileInputRef}
//           id={`file-upload-${label.replace(/\s/g, "-").toLowerCase()}`}
//           type="file"
//           multiple
//           className="sr-only"
//           onChange={handleFileChange}
//           disabled={isLoading}
//           accept=".pdf,.docx,.pptx,.xlsx,.xls"
//         />
//         {isLoading && (
//           <p className="text-sm text-blue-600 mt-2">Uploading...</p>
//         )}
//         {uploadedFiles && uploadedFiles.length > 0 && (
//           <div className="mt-2 space-y-2">
//             {uploadedFiles.map((file, index) => (
//               <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded-md">
//                 <div className="flex items-center gap-2 text-sm text-green-700">
//                   <span>✓</span>
//                   <span className="truncate max-w-[200px]">{file.name}</span>
//                 </div>
//                 {onRemoveFile && (
//                   <button
//                     onClick={() => onRemoveFile(index)}
//                     className="text-red-500 hover:text-red-700 text-sm font-medium"
//                   >
//                     Remove
//                   </button>
//                 )}
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

export default function ProductOnboardingFlow({
  setIsAddProductOpen,
  onProductCreated,
  editProduct,
  isEditMode = false,
}: {
  setIsAddProductOpen?: (isOpen: boolean) => void; // Made optional as it's not used in this component's logic
  onProductCreated?: () => void; // Callback to refresh products list
  editProduct?: any; // Product data for editing
  isEditMode?: boolean; // Whether we're in edit mode
}) {
  const { userId } = useUser();
  const [mainTab, setMainTab] = useState("overview");
  const [overviewSubTab, setOverviewSubTab] = useState("products"); // This state will now just store 'products' or 'services'

  // Form state variables
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [pricing, setPricing] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [commissionType, setCommissionType] = useState("");
  const [commissionValue, setCommissionValue] = useState("");
  const [documentName, setDocumentName] = useState("");

  // File upload state variables
  const [productBrochure, setProductBrochure] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [documents, setDocuments] = useState<
    Array<{ docName: string; docLink: string }>
  >([]);
  const [isUploadingBrochure, setIsUploadingBrochure] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Validation error states
  const [pricingError, setPricingError] = useState("");
  const [maxDiscountError, setMaxDiscountError] = useState("");
  const [productIdError, setProductIdError] = useState("");
  const [productNameError, setProductNameError] = useState("");

  // Category options
  const categoryOptions = [
    "Software",
    "Service",
    "Hardware",
    "Subscription",
    "Training",
    "Consulting",
  ];

  // Initialize form data when in edit mode
  useEffect(() => {
    if (isEditMode && editProduct) {
      setProductId(editProduct.productId || editProduct.serviceId || "");
      setProductName(editProduct.name || "");
      setPricing(editProduct.pricing || "");
      setMaxDiscount(editProduct.maxDiscount || "");
      setDescription(editProduct.description || "");
      setCategory(editProduct.category || "");
      setCommissionType(editProduct.commissionType || "");
      setCommissionValue(editProduct.commissionPercentage || "");
      
      // Set the tab based on whether it's a product or service
      if (editProduct.serviceId) {
        setOverviewSubTab("services");
      } else {
        setOverviewSubTab("products");
      }
      
      // Set existing documents and brochure
      if (editProduct.productBrochure) {
        setProductBrochure(editProduct.productBrochure);
      }
      if (editProduct.documents) {
        setDocuments(editProduct.documents);
      }
    }
  }, [isEditMode, editProduct]);

  // Remove individual documents
  const removeDocument = (index: number, type: "brochure" | "document") => {
    if (type === "brochure") {
      setProductBrochure(null);
    } else {
      setDocuments((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Handle file uploads
  const handleFileUpload = async (
    file: File,
    type: "brochure" | "document"
  ) => {
    console.log(file, "file");
    console.log(type, "type");
    if (type === "brochure") {
      setIsUploadingBrochure(true);
      try {
        console.log("uploading brochure");
        const uploadedFiles = await uploadFiles("postDocuments", {
          files: [file],
        });
        console.log(uploadedFiles, "uploadedFiles");
        // check json response

        if (uploadedFiles && uploadedFiles.length > 0) {
          const uploadedFile = uploadedFiles[0];
          const fileData = {
            name: file.name,
            url: uploadedFile.url,
          };
          setProductBrochure(fileData);
          
        // Show success toast
        toast.success("Brochure uploaded successfully!");
        }
    } catch (error) {
      console.error("Error uploading brochure:", error);
      toast.error("Failed to upload brochure. Please try again.");
    } finally {
        setIsUploadingBrochure(false);
      }
    }
  };

  // Handle document upload (same as NewLeadFlow)
  const handleDocumentUpload = async (file: File) => {
    if (!documentName.trim()) {
      toast.error("Please enter a document name first");
      return;
    }

    setIsUploading(true);
    try {
      const uploadedFiles = await uploadFiles("postDocuments", {
        files: [file],
      });

      if (uploadedFiles && uploadedFiles.length > 0) {
        const uploadedFile = uploadedFiles[0];
        const newDocument = {
          docName: documentName,
          docLink: uploadedFile.url,
        };

        setDocuments((prev) => [...prev, newDocument]);
        setDocumentName(""); // Clear document name after successful upload
        
        // Show success toast
        toast.success("Document uploaded successfully!");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file input change for documents
  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleDocumentUpload(file);
    }
  };

  // Handle keydown for numeric inputs
  const handleNumericKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    const allowedKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      ".",
      "NumpadDecimal",
    ];

    if (!allowedKeys.includes(event.key)) {
      event.preventDefault();
    }

    // Prevent multiple decimal points
    if (event.key === "." && event.currentTarget.value.includes(".")) {
      event.preventDefault();
    }
  };

  // Handle form field changes
  const handleFormChange = (field: string, value: string) => {
    switch (field) {
      case "productId":
        setProductId(value);
        // Clear error when user starts typing
        if (productIdError) {
          setProductIdError("");
        }
        break;
      case "productName":
        setProductName(value);
        // Clear error when user starts typing
        if (productNameError) {
          setProductNameError("");
        }
        break;
      case "pricing":
        // Only allow numbers, decimal points, and backspace
        if (value === "" || /^\d*\.?\d*$/.test(value)) {
          setPricing(value);
          // Clear max discount error when pricing changes
          if (maxDiscountError) {
            setMaxDiscountError("");
          }
        }
        break;
      case "maxDiscount":
        // Only allow numbers, decimal points, and backspace
        if (value === "" || /^\d*\.?\d*$/.test(value)) {
          setMaxDiscount(value);
        }
        break;
      case "description":
        setDescription(value);
        break;
      case "category":
        setCategory(value);
        break;
      case "commissionType":
        setCommissionType(value);
        break;
      case "commissionValue":
        setCommissionValue(value);
        break;
      case "documentName":
        setDocumentName(value);
        break;
    }
  };

  // Validation functions
  const validatePricing = (price: string): boolean => {
    // Check for more than 2 decimal places
    if (price.includes(".") && price.split(".")[1]?.length > 2) {
      setPricingError("Pricing cannot have more than 2 decimal places");
      return false;
    }

    const numPrice = parseFloat(price);
    const isValid = !isNaN(numPrice) && numPrice >= 0;

    if (!isValid) {
      setPricingError(
        "Please enter a valid pricing amount (must be a positive number)"
      );
    } else {
      setPricingError("");
    }

    return isValid;
  };

  const validateMaxDiscount = (discount: string, price: string): boolean => {
    if (!discount.trim()) {
      setMaxDiscountError(""); // Clear error if no discount entered
      return true;
    }

    // Check for more than 2 decimal places
    if (discount.includes(".") && discount.split(".")[1]?.length > 2) {
      setMaxDiscountError(
        "Max discount cannot have more than 2 decimal places"
      );
      return false;
    }

    const numDiscount = parseFloat(discount);
    const numPrice = parseFloat(price);
    const isValid =
      !isNaN(numDiscount) && numDiscount >= 0 && numDiscount <= numPrice;

    if (!isValid) {
      setMaxDiscountError(
        "Max discount must be a positive number and cannot exceed the 100"
      );
    } else {
      setMaxDiscountError("");
    }

    return isValid;
  };

  const validateProductId = (id: string): boolean => {
    if (!id.trim()) {
      setProductIdError(`${overviewSubTab === "services" ? "Service" : "Product"} ID is required`);
      return false;
    }
    setProductIdError("");
    return true;
  };

  const validateProductName = (name: string): boolean => {
    if (!name.trim()) {
      setProductNameError(`${overviewSubTab === "products" ? "Product" : "Service"} name is required`);
      return false;
    }
    setProductNameError("");
    return true;
  };

  const handleSaveAndNext = async () => {
    console.log("mainTab", mainTab);
    // console.log("user id", (user as any)?.userId);
    const tabsOrder = ["overview", "commissions", "documents"];
    const currentIndex = tabsOrder.indexOf(mainTab);

    if (currentIndex < tabsOrder.length - 1) {
      // Validate pricing and max discount before proceeding
      if (mainTab === "overview") {
        // Validate required fields first
        if (!validateProductId(productId)) {
          toast.error(`${overviewSubTab === "services" ? "Service" : "Product"} ID is required`);
          return;
        }

        if (!validateProductName(productName)) {
          toast.error(`${overviewSubTab === "products" ? "Product" : "Service"} name is required`);
          return;
        }

        if (!validatePricing(pricing)) {
          toast.error("Please enter a valid pricing amount (must be a positive number)");
          return;
        }

        if (maxDiscount && !validateMaxDiscount(maxDiscount, pricing)) {
          toast.error("Max discount must be a positive number and cannot exceed the pricing amount");
          return;
        }
      }

      setMainTab(tabsOrder[currentIndex + 1]);
    } else if (mainTab === "documents") {
      // Final validation before creating product/service
      if (!validatePricing(pricing)) {
        toast.error("Please enter a valid pricing amount (must be a positive number)");
        return;
      }

      if (maxDiscount && !validateMaxDiscount(maxDiscount, pricing)) {
        toast.error("Max discount must be a positive number and cannot exceed the pricing amount");
        return;
      }

      // Create or update product/service API call when on documents tab
      try {
        const isService = overviewSubTab === "services";
        const productData = {
          [isService ? "serviceId" : "productId"]: productId,
          name: productName,
          pricing: pricing,
          maxDiscount: maxDiscount,
          description: description,
          category: category,
          commissionType: commissionType,
          commissionPercentage: commissionValue,
          productBrochure: productBrochure,
          documents: documents,
          userId: userId || "",
          type: isService ? "service" : "product",
        };

        const url = isEditMode 
          ? buildExternalUrl(`/crm/products/${editProduct._id}`)
          : buildExternalUrl("/crm/products");
        const method = isEditMode ? "PUT" : "POST";

        const response = await authenticatedFetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(productData),
        });

        if (response.ok) {
          // Show toast notification for success
          toast.success(`${overviewSubTab === "services" ? "Service" : "Product"} ${isEditMode ? "updated" : "created"} successfully!`);
          // Refresh products list and close modal
          onProductCreated?.();
          setIsAddProductOpen?.(false);
        } else {
          const errorData = await response.json();
          const errorMessage = errorData.message || `Failed to ${isEditMode ? "update" : "create"} product`;
          toast.error(`Error: ${errorMessage}`);
        }
      } catch (error) {
        console.error(`Error ${isEditMode ? "updating" : "creating"} product:`, error);
        toast.error(`Error ${isEditMode ? "updating" : "creating"} product: ` + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  return (
    <div className="p-6">
      {/* Back button */}
      <div className="flex items-center mb-4 px-2">
        <Button
          variant="ghost"
          onClick={() => setIsAddProductOpen?.(false)} // Use optional chaining to avoid errors if not provided
          className="text-lg font-semibold px-2 py-1 h-auto"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Products & Services
        </Button>
      </div>
      {/* Main Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          {/* Main Tabs List */}
          <TabsList className="inline-flex h-auto p-0 bg-transparent rounded-none mb-6 w-full justify-start">
            <TabsTrigger
              value="overview"
              className="px-6 py-2 text-base font-normal rounded-full data-[state=active]:bg-blue-100 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="commissions"
              className="px-6 py-2 text-base font-normal rounded-full data-[state=active]:bg-blue-100 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600"
            >
              Commissions
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="px-6 py-2 text-base font-normal rounded-full data-[state=active]:bg-blue-100 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600"
            >
              Documents
            </TabsTrigger>
          </TabsList>
          {/* Overview Tab Content */}
          <TabsContent value="overview">
            <div className="space-y-6">
              {/* Nested Tabs for Products/Services - Hide in edit mode */}
              {!isEditMode && (
                <Tabs value={overviewSubTab} onValueChange={setOverviewSubTab}>
                  <TabsList className="inline-flex h-auto p-1 bg-transparent rounded-full border border-[#3DB69A] mb-6">
                    <TabsTrigger
                      value="products"
                      className="px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-[#3DB69A] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-black"
                    >
                      Products
                    </TabsTrigger>
                    <TabsTrigger
                      value="services"
                      className="px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-[#3DB69A] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-black"
                    >
                      Services
                    </TabsTrigger>
                  </TabsList>
                  <div className="border-b border-gray-200 mb-4" />
                </Tabs>
              )}
              
              {/* Edit mode title */}
              {isEditMode && (
                <div className="mb-6">
                  <h2 className="text-xl font-semibold">
                    Edit {overviewSubTab === "services" ? "Service" : "Product"}
                  </h2>
                  <div className="border-b border-gray-200 mb-4 mt-2" />
                </div>
              )}
              
              {/* Unified content for Products/Services */}
              <div className="space-y-6 w-96">
                  <div className="space-y-2">
                    <Label htmlFor="product-id">
                      {overviewSubTab === "services"
                        ? "Service ID"
                        : "Product ID"} *
                    </Label>
                    <Input
                      id="product-id"
                      value={productId}
                      onChange={(e) =>
                        handleFormChange("productId", e.target.value)
                      }
                      placeholder={`Enter ${overviewSubTab === "services" ? "Service" : "Product"} ID`}
                      className={productIdError ? "border-red-500" : ""}
                    />
                    {productIdError && (
                      <p className="text-sm text-red-500">{productIdError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-name">Name *</Label>
                    <Input
                      id="product-name"
                      value={productName}
                      onChange={(e) =>
                        handleFormChange("productName", e.target.value)
                      }
                      placeholder={`Enter ${overviewSubTab === "products" ? "Product" : "Service"} Name`}
                      className={productNameError ? "border-red-500" : ""}
                    />
                    {productNameError && (
                      <p className="text-sm text-red-500">{productNameError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-pricing">Pricing *</Label>
                    <Input
                      id="product-pricing"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricing}
                      placeholder="Enter Pricing"
                      onChange={(e) =>
                        handleFormChange("pricing", e.target.value)
                      }
                      onKeyDown={handleNumericKeyDown}
                      onBlur={() => validatePricing(pricing)}
                      className={pricingError ? "border-red-500" : ""}
                    />
                    {pricingError && (
                      <p className="text-sm text-red-500">{pricingError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-max-discount">Max Discount</Label>
                    <Input
                      id="product-max-discount"
                      type="number"
                      min="0"
                      step="0.01"
                      max="100"
                      value={maxDiscount}
                      placeholder="Enter Max. Discounted Price"
                      onChange={(e) =>
                        handleFormChange("maxDiscount", e.target.value)
                      }
                      onBlur={() => validateMaxDiscount(maxDiscount, pricing)}
                      className={maxDiscountError ? "border-red-500" : ""}
                      onKeyDown={handleNumericKeyDown}
                    />
                    {maxDiscountError && (
                      <p className="text-sm text-red-500">{maxDiscountError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-description">Description</Label>
                    <Textarea
                      id="product-description"
                      value={description}
                      onChange={(e) =>
                        handleFormChange("description", e.target.value)
                      }
                      placeholder={`Enter ${overviewSubTab === "products" ? "Product" : "Service"} Description`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-category">Category</Label>
                    <Select
                      value={category}
                      onValueChange={(value) =>
                        handleFormChange("category", value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((cat) => (
                          <SelectItem key={cat} value={cat.toLowerCase()}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              <div className="flex">
                <Button
                  onClick={handleSaveAndNext}
                  className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300"
                >
                  Save & Next <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Commissions Tab Content */}
          <TabsContent value="commissions">
            <div className="space-y-6 w-96">
              <div className="space-y-2">
                <Label htmlFor="commissions-type">Commissions Type</Label>
                <Select
                  value={commissionType}
                  onValueChange={(value) =>
                    handleFormChange("commissionType", value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Fixed or Variable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission-value">Commission</Label>
                <Input
                  id="commission-value"
                  type="number"
                  value={commissionValue}
                  onChange={(e) =>
                    handleFormChange("commissionValue", e.target.value)
                  }
                  placeholder="Enter Commission Value"
                />
              </div>
              <div className="flex ">
                <Button
                  onClick={handleSaveAndNext}
                  className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300"
                >
                  Save & Next <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Documents Tab Content */}
          <TabsContent value="documents">
            <div className="space-y-6 w-96">
              <div className="space-y-2">
                <Label htmlFor="brochure-upload">Product Brochure</Label>
                <div
                  className="flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() =>
                    document.getElementById("brochure-file-input")?.click()
                  }
                >
                  <UploadCloud className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-blue-600">
                      Click to upload file
                    </span>{" "}
                    or Drag and Drop
                  </p>
                  <p className="text-xs text-gray-400">
                    Pdf, Docx, pptx, excel (max. 10 mb)
                  </p>
                  <Input
                    id="brochure-file-input"
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "brochure");
                    }}
                    disabled={isUploadingBrochure}
                    accept=".pdf,.docx,.pptx,.xlsx,.xls"
                  />
                  {isUploadingBrochure && (
                    <p className="text-sm text-blue-600 mt-2">Uploading...</p>
                  )}
                </div>
              </div>
              {productBrochure && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-green-50 p-2 rounded-md">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <span>✓</span>
                      <span className="truncate max-w-[200px]">
                        {productBrochure.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeDocument(0, "brochure")}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="document-name-input">Document Name</Label>
                <Input
                  id="document-name-input"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Enter Document Name"
                />
              </div>

              {/* Document Upload Area */}
              <div className="space-y-2">
                <Label htmlFor="document-upload">Document Upload</Label>
                <div
                  className="flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() =>
                    document.getElementById("document-upload")?.click()
                  }
                >
                  <UploadCloud className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-blue-600">
                      Click to upload
                    </span>{" "}
                    or Drag and Drop
                  </p>
                  <p className="text-xs text-gray-400">
                    Pdf, Docx, pptx, excel (max. 10 mb)
                  </p>
                  <Input
                    id="document-upload"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.docx,.pptx,.xlsx,.xls"
                    onChange={handleFileInputChange}
                    disabled={isUploading}
                  />
                </div>
              </div>

              {/* Uploaded Documents List */}
              {documents.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Documents</Label>
                  <div className="space-y-2">
                    {documents.map((doc, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm text-black underline p-2 border rounded"
                      >
                        <Download className="w-4 h-4" />
                        <span>{doc.docName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDocuments((prev) =>
                              prev.filter((_, i) => i !== index)
                            );
                          }}
                          className="ml-auto text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <Button
                  className="rounded-full px-6 py-2 bg-[#3DB69A] hover:bg-[#3DB69A]/80 transition-all duration-300 text-white"
                      onClick={() => {
                        if (!documentName.trim()) {
                          toast.error("Please enter a document name first");
                          return;
                        }
                    // Trigger file input click
                    document.getElementById("document-upload")?.click();
                  }}
                  disabled={isUploading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Add Other Product Document"}
                </Button>
                <Button
                  onClick={handleSaveAndNext}
                  className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300"
                >
                  Save & Next <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
