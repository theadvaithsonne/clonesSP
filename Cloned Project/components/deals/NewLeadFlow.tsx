"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Phone,
  UploadCloud,
  Download,
  ArrowRight,
  Plus,
  X,
  Search,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import { useUploadThing } from "@/utils/uploadthing";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { cn } from "@/lib/utils";

export default function NewLeadFlow({
  setIsAdd,
  editLead,
}: {
  setIsAdd: (value: boolean) => void;
  editLead?: any;
}) {
  // Upload functionality
  const { startUpload: startImageUpload } = useUploadThing("postImages");
  const { startUpload: startDocumentUpload } = useUploadThing("postDocuments");

  const [activeTab, setActiveTab] = useState("contact"); // Default to the first tab: Contact
  // const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [createNewContact, setCreateNewContact] = useState(false);
  const [contacts, setContacts] = useState<
    Array<{
      _id: string;
      firstName: string;
      lastName: string;
      email?: string;
      dateOfBirth?: string;
      phoneNumber?: string;
    }>
  >([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    dateOfBirth: "",
    phoneNumber: "",
  });
  const [duration, setDuration] = useState("");
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    type: "success" as "success" | "error",
  });
  const [products, setProducts] = useState<
    Array<{ _id: string; name: string; type: string }>
  >([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [salesFunnels, setSalesFunnels] = useState<
    Array<{ _id: string; funnelName: string; stages?: string[] }>
  >([]);
  const [isLoadingSalesFunnels, setIsLoadingSalesFunnels] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedSalesFunnelId, setSelectedSalesFunnelId] =
    useState<string>("");
  const [categories, setCategories] = useState<
    Array<{ _id: string; category: string; id?: string; organizationId?: string; createdAt?: string; updatedAt?: string }>
  >([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [createNewCompany, setCreateNewCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedCompanyProductId, setSelectedCompanyProductId] =
    useState<string>("");
  const [companies, setCompanies] = useState<
    Array<{ _id: string; companyName: string; industry?: string }>
  >([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [companyFormData, setCompanyFormData] = useState({
    companyName: "",
    industry: "",
    revenue: "",
    website: "",
    address: "",
    pinCode: "",
    country: "",
    state: "",
    city: "",
  });
  const [isAddCompanyDialogOpen, setIsAddCompanyDialogOpen] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    companyName: "",
    industry: "",
    revenue: "",
    website: "",
    address: "",
    pinCode: "",
    country: "",
    state: "",
    city: "",
  });
  const [documents, setDocuments] = useState<
    Array<{ docName: string; docLink: string }>
  >([]);
  const [documentName, setDocumentName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [pricing, setPricing] = useState("");
  const [negotiatedPricing, setNegotiatedPricing] = useState("");
  const [maxDiscPrice, setMaxDiscPrice] = useState("");

  // Field change handlers with validation
  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    if (validationErrors.quantity) {
      const error = validateNumericField('Quantity', value);
      setValidationErrors(prev => ({ ...prev, quantity: error }));
    }
  };

  const handlePricingChange = (value: string) => {
    setPricing(value);
    if (validationErrors.pricing) {
      const error = validateNumericField('Pricing', value);
      setValidationErrors(prev => ({ ...prev, pricing: error }));
    }
  };

  const handleNegotiatedPricingChange = (value: string) => {
    setNegotiatedPricing(value);
    if (validationErrors.negotiatedPricing) {
      const error = value ? validateNumericField('Negotiated Pricing', value) : '';
      setValidationErrors(prev => ({ ...prev, negotiatedPricing: error }));
    }
  };

  const handleMaxDiscPriceChange = (value: string) => {
    setMaxDiscPrice(value);
    if (validationErrors.maxDiscPrice) {
      const error = validateNumericField('Max Discounted Price', value);
      setValidationErrors(prev => ({ ...prev, maxDiscPrice: error }));
    }
  };
  const [stage, setStage] = useState("discovery");
  const [selectedFunnelStages, setSelectedFunnelStages] = useState<{
    funnelStage: string[];
  } | null>(null);
  const [images, setImages] = useState<
    Array<{ imageName: string; imageLink: string }>
  >([]);
  const [imageName, setImageName] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    // Contact fields
    selectedContactId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    duration?: string;
    // Company fields
    selectedCompanyId?: string;
    companyName?: string;
    industry?: string;
    website?: string;
    address?: string;
    pinCode?: string;
    country?: string;
    state?: string;
    city?: string;
    revenue?: string;
    // Product fields
    selectedProductId?: string;
    selectedCategoryId?: string;
    selectedSalesFunnelId?: string;
    quantity?: string;
    pricing?: string;
    negotiatedPricing?: string;
    maxDiscPrice?: string;
  }>({});

  // const availableTeamMembers = [
  //   "Abhishek Sawant",
  //   "Philip Thomas",
  //   "Jane Doe",
  //   "John Smith",
  //   "Emily White",
  //   "David Green",
  // ];

  const tabsOrder = [
    "contact",
    "product-services",
    "company",
    "documents",
    // "assigned-to",
  ]; // Updated tabs order

  // Pre-fill form data when editing a lead
  useEffect(() => {
    if (editLead) {
      // Pre-fill contact data
      if (editLead.contact) {
        setFormData({
          firstName: editLead.contact.firstName || editLead.firstName || "",
          lastName: editLead.contact.lastName || editLead.lastName || "",
          email: editLead.contact.email || editLead.email || "",
          dateOfBirth: editLead.contact.dateOfBirth || editLead.dob || "",
          phoneNumber: editLead.contact.phoneNumber || editLead.phoneNumber || "",
        });
        setSelectedContactId(editLead.contactId || "");
      }

      // Pre-fill product data
      if (editLead.productId) {
        setSelectedProductId(editLead.productId);
      }

      // Pre-fill company data
      // Check if companyId exists but company is null (invalid state)
      if (editLead.companyId && editLead.company === null) {
        // This is an invalid state - companyId exists but company is null
        // Don't set selectedCompanyId, keeping it empty to trigger validation
        setSelectedCompanyId("");
      } else if (editLead.companyId && editLead.company) {
        // Normal case: both companyId and company exist
        setSelectedCompanyId(editLead.companyId);
      } else {
        // No company data at all
        setSelectedCompanyId("");
      }

      // Pre-fill sales funnel and stage
      if (editLead.salesFunnel) {
        setSelectedSalesFunnelId(editLead.salesFunnel);
        // Fetch stages for the selected funnel when editing
        const fetchFunnelStages = async () => {
          try {
            const response = await authenticatedFetch(
              buildExternalUrl(`/crm/funnels/${editLead.salesFunnel}`),
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            if (response.ok) {
              const funnelData = await response.json();
              if (funnelData.funnelStage && funnelData.funnelStage.length > 0) {
                setSelectedFunnelStages(funnelData);
                // Set the existing stage only if one exists, don't override
                if (editLead.stage) {
                  setStage(editLead.stage);
                }
              }
            }
          } catch (error) {
            console.error("Error fetching funnel stages for edit:", error);
          }
        };

        fetchFunnelStages();
      } else if (editLead.stage) {
        // Set stage even if there's no salesFunnel
        setStage(editLead.stage);
      }

      // Pre-fill other fields
      if (editLead.quantity) {
        setQuantity(editLead.quantity);
      }
      if (editLead.pricing) {
        setPricing(editLead.pricing);
      }
      if (editLead.negotiatedPricing) {
        setNegotiatedPricing(editLead.negotiatedPricing);
      }
      if (editLead.MaxDiscPrice) {
        setMaxDiscPrice(editLead.MaxDiscPrice);
      }
      if (editLead.duration) {
        setDuration(editLead.duration);
      }
      if (editLead.documents) {
        setDocuments(editLead.documents);
      }
      if (editLead.productBrochure) {
        setImages([editLead.productBrochure]);
      }

      // Set create new contact/company to false since we're editing existing
      setCreateNewContact(false);
      setCreateNewCompany(false);
    }
  }, [editLead]);

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      setIsLoadingContacts(true);
      try {
        const response = await authenticatedFetch(
          buildExternalUrl("/crm/contacts?limit=1000"),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setContacts(data.contacts || data || []);
          // Only set first contact as default if not in edit mode
          if (data.contacts && data.contacts.length > 0 && !editLead) {
            setSelectedContactId(data.contacts[0]._id);
          }
        } else {
          console.error("Failed to fetch contacts");
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
      } finally {
        setIsLoadingContacts(false);
      }
    };

    fetchContacts();
  }, [editLead]);

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const response = await authenticatedFetch(
          buildExternalUrl("/crm/products"),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const productsData = data.products || data || [];
          setProducts(productsData);
          // Set first product as default if available
          if (productsData.length > 0) {
            setSelectedProductId(productsData[0]._id);
            setSelectedCompanyProductId(productsData[0]._id);
          }
        } else {
          console.error("Failed to fetch products");
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  // Fetch sales funnels from API
  useEffect(() => {
    const fetchSalesFunnels = async () => {
      setIsLoadingSalesFunnels(true);
      try {
        const response = await authenticatedFetch(
          buildExternalUrl("/crm/funnels"),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const funnelsData = data.funnels || data || [];
          setSalesFunnels(funnelsData);
          // Set first funnel as default if available (only when not editing)
          if (funnelsData.length > 0 && !editLead) {
            const firstFunnel = funnelsData[0];
            setSelectedSalesFunnelId(firstFunnel._id);

            // Fetch stages for the first funnel
            try {
              const funnelResponse = await authenticatedFetch(
                buildExternalUrl(`/crm/funnels/${firstFunnel._id}`),
                {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

              if (funnelResponse.ok) {
                const funnelData = await funnelResponse.json();
                console.log(funnelData, "funnelData");
                console.log(funnelData.funnelStage, "funnelData.funnelStage");
                if (funnelData.funnelStage && funnelData.funnelStage.length > 0) {
                  setSelectedFunnelStages(funnelData);
                  // Handle both string and object formats for default stage
                  const firstStage = funnelData.funnelStage[0];
                  const defaultStage = typeof firstStage === 'string' ? firstStage : firstStage.name || firstStage.id || firstStage;
                  setStage(defaultStage);
                }
              }
            } catch (error) {
              console.error("Error fetching initial funnel stages:", error);
            }
          }
        } else {
          console.error("Failed to fetch sales funnels");
        }
      } catch (error) {
        console.error("Error fetching sales funnels:", error);
      } finally {
        setIsLoadingSalesFunnels(false);
      }
    };

    fetchSalesFunnels();
  }, []);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const response = await authenticatedFetch(
          buildExternalUrl("/crm/categories"),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log("Categories fetch response:", data);
          const categoriesData = data.categories || data || [];
          console.log("Categories data:", categoriesData);
          setCategories(categoriesData);
          // Set first category as default if available
          if (categoriesData.length > 0) {
            setSelectedCategoryId(categoriesData[0]._id);
          }
        } else {
          console.error("Failed to fetch categories");
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // Fetch companies from API
  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoadingCompanies(true);
      try {
        const response = await authenticatedFetch(
          buildExternalUrl("/crm/companies"),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const companiesData = data.companies || data || [];
          setCompanies(companiesData);
          // Set first company as default if available
          if (companiesData.length > 0) {
            setSelectedCompanyProductId(companiesData[0]._id);
          }
        } else {
          console.error("Failed to fetch companies");
        }
      } catch (error) {
        console.error("Error fetching companies:", error);
      } finally {
        setIsLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, []);

  // Fetch stages when sales funnel changes (only for new leads, not edit mode)
  useEffect(() => {
    if (selectedSalesFunnelId && !editLead) {
      handleSalesFunnelChange(selectedSalesFunnelId);
    }
  }, [selectedSalesFunnelId]);

  // Get selected contact details
  const selectedContact = contacts.find(
    (contact) => contact._id === selectedContactId
  );

  // Update form data when contact is selected
  useEffect(() => {
    if (selectedContact && !createNewContact) {
      setFormData({
        firstName: selectedContact.firstName || "",
        lastName: selectedContact.lastName || "",
        email: selectedContact.email || "",
        dateOfBirth: selectedContact.dateOfBirth || "",
        phoneNumber: selectedContact.phoneNumber || "",
      });
    }
  }, [selectedContact, createNewContact]);

  // Handle form field changes
  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle company form field changes
  const handleCompanyFormChange = (field: string, value: string) => {
    setCompanyFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Validation functions
  const validateRequiredField = (field: string, value: string) => {
    const stringValue = String(value || '').trim();
    if (!stringValue) {
      return `${field} is required`;
    }
    return '';
  };

  const validateEmail = (email: string, hasPhone: boolean) => {
    const stringValue = String(email || '').trim();
    if (!stringValue) {
      return hasPhone ? '' : 'Either Email or Phone Number is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(stringValue)) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const validatePhoneNumber = (phone: string, hasEmail: boolean) => {
    const stringValue = String(phone || '').trim();
    if (!stringValue) {
      return hasEmail ? '' : 'Either Email or Phone Number is required';
    }
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(stringValue.replace(/\s/g, ''))) {
      return 'Please enter a valid phone number';
    }
    return '';
  };

  const validateNumericField = (field: string, value: string) => {
    const stringValue = String(value || '').trim();
    if (!stringValue) {
      return `${field} is required`;
    }
    const numValue = parseFloat(stringValue);
    if (isNaN(numValue) || numValue <= 0) {
      return `${field} must be greater than 0`;
    }
    return '';
  };

  const validateWebsite = (website: string) => {
    const stringValue = String(website || '').trim();
    if (!stringValue) {
      return 'Website is required';
    }
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlRegex.test(stringValue)) {
      return 'Please enter a valid website URL';
    }
    return '';
  };

  const validateAllFields = () => {
    const errors: typeof validationErrors = {};

    // Contact validation
    if (activeTab === "contact") {
      if (!createNewContact && !selectedContactId) {
        errors.selectedContactId = 'Please select a contact or create a new one';
      }

      if (createNewContact) {
        errors.firstName = validateRequiredField('First Name', formData.firstName);
        errors.lastName = validateRequiredField('Last Name', formData.lastName);
        const hasEmail = !!formData.email?.trim();
        const hasPhone = !!formData.phoneNumber?.trim();
        errors.email = validateEmail(formData.email, hasPhone);
        errors.phoneNumber = validatePhoneNumber(formData.phoneNumber, hasEmail);
        errors.dateOfBirth = validateRequiredField('Date of Birth', formData.dateOfBirth);
      }

      // Duration is always required in contact tab
      errors.duration = validateNumericField('Duration', duration);
    }

    // Company validation
    if (activeTab === "company") {
      if (!createNewCompany && !selectedCompanyId) {
        errors.selectedCompanyId = 'Please select a company or create a new one';
      }

      if (createNewCompany) {
        errors.companyName = validateRequiredField('Company Name', companyFormData.companyName);
        errors.industry = validateRequiredField('Industry', companyFormData.industry);
        errors.revenue = validateRequiredField('Revenue', companyFormData.revenue);
        errors.website = validateWebsite(companyFormData.website);
        errors.address = validateRequiredField('Address', companyFormData.address);
        errors.pinCode = validateRequiredField('Pin Code', companyFormData.pinCode);
        errors.country = validateRequiredField('Country', companyFormData.country);
        errors.state = validateRequiredField('State', companyFormData.state);
        errors.city = validateRequiredField('City', companyFormData.city);
      }
    }

    // Product validation
    if (activeTab === "product-services") {
      errors.selectedProductId = validateRequiredField('Product', selectedProductId);
      errors.selectedCategoryId = validateRequiredField('Category', selectedCategoryId);
      errors.selectedSalesFunnelId = validateRequiredField('Sales Funnel', selectedSalesFunnelId);
      errors.quantity = validateNumericField('Quantity', quantity);
      errors.pricing = validateNumericField('Pricing', pricing);
      errors.maxDiscPrice = validateNumericField('Max Discounted Price', maxDiscPrice);

      // Negotiated pricing is optional, but if provided, should be valid
      if (negotiatedPricing) {
        errors.negotiatedPricing = validateNumericField('Negotiated Pricing', negotiatedPricing);
      }
    }

    setValidationErrors(errors);

    // Return true if no errors
    return !Object.values(errors).some(error => error !== '');
  };

  // Handle sales funnel selection and update stages
  const handleSalesFunnelChange = async (funnelId: string) => {
    try {
      // Fetch funnel details from API to get stages
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
        if (funnelData.funnelStage && funnelData.funnelStage.length > 0) {
          setSelectedFunnelStages(funnelData);
          // Only set default stage if editing and no stage is already set
          // Or if creating a new lead
          if (!editLead || !stage) {
            const firstStage = funnelData.funnelStage[0];
            const defaultStage = typeof firstStage === 'string' ? firstStage : firstStage.name || firstStage.id || firstStage;
            setStage(defaultStage);
          }
        } else {
          setSelectedFunnelStages(null);
          if (!editLead || !stage) {
            setStage("discovery");
          }
        }
      } else {
        console.error("Failed to fetch funnel details");
        setSelectedFunnelStages(null);
        if (!editLead || !stage) {
          setStage("discovery");
        }
      }
    } catch (error) {
      console.error("Error fetching funnel details:", error);
      setSelectedFunnelStages(null);
      if (!editLead || !stage) {
        setStage("discovery");
      }
    }
  };

  // Handle create new category
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    setIsCreatingCategory(true);
    try {
      const response = await authenticatedFetch(
        buildExternalUrl("/crm/categories"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category: newCategoryName.trim(),
          }),
        }
      );

      if (response.ok) {
        const responseData = await response.json();
        console.log("Category creation response:", responseData);
        // Handle different response formats
        const newCategory = responseData.category || responseData;
        console.log("New category object:", newCategory);
        // Add the new category to the list
        setCategories(prev => [...prev, newCategory]);
        // Select the newly created category
        setSelectedCategoryId(newCategory._id);
        // Close modal and reset form
        setShowCategoryModal(false);
        setNewCategoryName("");
        toast.success("Category created successfully");
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.message || "Failed to create category";
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Error creating category: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Handle document upload
  const handleDocumentUpload = async (file: File) => {
    if (!documentName.trim()) {
      toast.error("Please enter a document name first");
      return;
    }

    setIsUploading(true);
    try {
      const res = await startDocumentUpload([file]);
      if (res && res[0]?.url) {
        const newDocument = {
          docName: documentName,
          docLink: res[0].url,
        };

        setDocuments((prev) => [...prev, newDocument]);
        setDocumentName(""); // Clear document name after successful upload

        toast.success("Document uploaded successfully");
      } else {
        toast.error("Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file input change
  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleDocumentUpload(file);
    }
  };

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!imageName.trim()) {
      toast.error("Please enter an image name first");
      return;
    }

    setIsUploadingImage(true);
    try {
      const res = await startImageUpload([file]);
      if (res && res[0]?.url) {
        const newImage = {
          imageName: imageName,
          imageLink: res[0].url,
        };

        setImages((prev) => [...prev, newImage]);
        setImageName(""); // Clear image name after successful upload

        toast.success("Image uploaded successfully");
      } else {
        toast.error("Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Handle file input change for images
  const handleImageInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleSaveAndNext = async () => {
    // Validate all fields based on current tab
    if (!validateAllFields()) {
      toast.error("Please fix the validation errors before proceeding");
      return;
    }

    // If creating new contact, save it first
    if (createNewContact && activeTab === "contact") {
      try {
        // Use manual fetch to handle errors properly
        const authToken = localStorage.getItem("auth-token") || Cookies.get("auth-token");
        const response = await fetch(buildExternalUrl("/crm/contacts"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken && { "Authorization": `Bearer ${authToken}` })
          },
          credentials: "include",
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            dateOfBirth: formData.dateOfBirth,
            phoneNumber: formData.phoneNumber,
          }),
        });
        console.log(response, "response");

        if (response.ok) {
          const savedContact = await response.json();
          // Save the _id from API response
          setSelectedContactId(savedContact.contact._id);
          console.log("Contact saved with ID:", savedContact);
          // Clear form fields after successful save
          setFormData({
            firstName: "",
            lastName: "",
            email: "",
            dateOfBirth: "",
            phoneNumber: "",
          });

          toast.success("Contact saved successfully");

        } else {
          const errorData = await response.json();
          const errorMessage = errorData.error || errorData.message || "Failed to save contact";
          console.error("Contact API Error:", errorData);
          toast.error(errorMessage);
          return; // Don't proceed if save fails
        }
      } catch (error) {
        console.error("Error saving contact:", error);
        // Try to extract error message from API response
        let errorMessage = "Error saving contact";
        if (error instanceof Error) {
          // Check if error message contains JSON
          if (error.message.includes('{') && error.message.includes('}')) {
            try {
              const errorData = JSON.parse(error.message);
              errorMessage = errorData.error || errorData.message || error.message;
            } catch {
              errorMessage = error.message;
            }
          } else {
            errorMessage = error.message;
          }
        }
        toast.error(errorMessage);
        return; // Don't proceed if save fails
      }
    }

    // If creating new company, save it first
    if (createNewCompany && activeTab === "company") {
      try {
        // Use manual fetch to handle errors properly
        const authToken = localStorage.getItem("auth-token") || Cookies.get("auth-token");
        const response = await fetch(buildExternalUrl("/crm/companies"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken && { "Authorization": `Bearer ${authToken}` })
          },
          credentials: "include",
          body: JSON.stringify({
            companyName: companyFormData.companyName,
            industry: companyFormData.industry,
            revenue: companyFormData.revenue,
            website: companyFormData.website,
            address: companyFormData.address,
            pinCode: companyFormData.pinCode,
            country: companyFormData.country,
            state: companyFormData.state,
            city: companyFormData.city,
          }),
        });
        console.log(response, "company response");

        if (response.ok) {
          const savedCompany = await response.json();
          // Save the _id from API response
          setSelectedCompanyId(savedCompany._id);
          console.log("Company saved with ID:", savedCompany._id);
          // Clear form fields after successful save
          setCompanyFormData({
            companyName: "",
            industry: "",
            revenue: "",
            website: "",
            address: "",
            pinCode: "",
            country: "",
            state: "",
            city: "",
          });
          toast.success("Company saved successfully");
        } else {
          const errorData = await response.json();
          const errorMessage = errorData.error || errorData.message || "Failed to save company";
          console.error("Company API Error:", errorData);
          toast.error(errorMessage);
          return; // Don't proceed if save fails
        }
      } catch (error) {
        console.error("Error saving company:", error);
        // Try to extract error message from API response
        let errorMessage = "Error saving company";
        if (error instanceof Error) {
          // Check if error message contains JSON
          if (error.message.includes('{') && error.message.includes('}')) {
            try {
              const errorData = JSON.parse(error.message);
              errorMessage = errorData.error || errorData.message || error.message;
            } catch {
              errorMessage = error.message;
            }
          } else {
            errorMessage = error.message;
          }
        }
        toast.error(errorMessage);
        return; // Don't proceed if save fails
      }
    }

    // If on documents tab, create or update the lead
    if (activeTab === "documents") {
      setIsSaving(true);
      try {
        // Get category name from selected category ID
        const selectedCategory = categories.find(cat => cat._id === selectedCategoryId);
        const categoryName = selectedCategory ? selectedCategory.category : "";

        const leadData = {
          contactId: selectedContactId,
          productId: selectedProductId,
          category: categoryName,
          quantity: quantity,
          pricing: pricing,
          negotiatedPricing: !negotiatedPricing ? pricing : negotiatedPricing,
          MaxDiscPrice: maxDiscPrice,
          salesFunnel: selectedSalesFunnelId,
          stage: stage,
          companyId: selectedCompanyId,
          documents: documents,
          duration: duration,
          productBrochure: images.length > 0 ? images[0] : null,
        };

        console.log(editLead ? "Updating lead with data:" : "Creating lead with data:", leadData);
        console.log("Selected Contact ID:", selectedContactId);
        console.log("Selected Contact Details:", contacts.find(c => c._id === selectedContactId));
        console.log("Selected Company ID:", selectedCompanyId);
        console.log("Selected Company Product ID:", selectedCompanyProductId);
        console.log("Selected Company Details:", companies.find(c => c._id === selectedCompanyId));

        // Use manual fetch to handle errors properly
        const authToken = localStorage.getItem("auth-token") || Cookies.get("auth-token");
        const response = await fetch(
          buildExternalUrl(editLead ? `/crm/leads/${editLead._id}` : "/crm/leads"),
          {
            method: editLead ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
              ...(authToken && { "Authorization": `Bearer ${authToken}` })
            },
            credentials: "include",
            body: JSON.stringify(leadData),
          }
        );

        if (response.ok) {
          const savedLead = await response.json();
          console.log(editLead ? "Lead updated successfully:" : "Lead created successfully:", savedLead);
          toast.success(editLead ? "Lead updated successfully" : "Lead created successfully");

          // If creating a new lead, reset all fields
          if (!editLead) {
            // Reset contact fields
            setSelectedContactId("");
            setCreateNewContact(false);
            setFormData({
              firstName: "",
              lastName: "",
              email: "",
              dateOfBirth: "",
              phoneNumber: "",
            });
            setContactSearchQuery("");

            // Reset duration
            setDuration("");

            // Reset company fields
            setSelectedCompanyId("");
            setSelectedCompanyProductId("");
            setCreateNewCompany(false);
            setCompanyFormData({
              companyName: "",
              industry: "",
              revenue: "",
              website: "",
              address: "",
              pinCode: "",
              country: "",
              state: "",
              city: "",
            });
            setCompanySearchQuery("");

            // Reset product fields
            setSelectedProductId("");
            setSelectedCategoryId("");
            setSelectedSalesFunnelId("");
            setQuantity("");
            setPricing("");
            setNegotiatedPricing("");
            setMaxDiscPrice("");
            setStage("discovery");
            setSelectedFunnelStages(null);

            // Reset documents and images
            setDocuments([]);
            setDocumentName("");
            setImages([]);
            setImageName("");

            // Reset validation errors
            setValidationErrors({});

            // Reset to first tab
            setActiveTab("contact");
          }

          // Return to list view after successful creation/update
          setTimeout(() => {
            setIsAdd(false);
          }, 2000);
        } else {
          const errorData = await response.json();
          const errorMessage = errorData.error || errorData.message || (editLead ? "Failed to update lead" : "Failed to create lead");
          console.error("API Error:", errorData);
          toast.error(errorMessage);
          return; // Don't proceed if save fails
        }
      } catch (error) {
        console.error(editLead ? "Error updating lead:" : "Error creating lead:", error);
        // Try to extract error message from API response
        let errorMessage = editLead ? "Error updating lead" : "Error creating lead";
        if (error instanceof Error) {
          // Check if error message contains JSON
          if (error.message.includes('{') && error.message.includes('}')) {
            try {
              const errorData = JSON.parse(error.message);
              errorMessage = errorData.error || errorData.message || error.message;
            } catch {
              errorMessage = error.message;
            }
          } else {
            errorMessage = error.message;
          }
        }
        toast.error(errorMessage);
        return; // Don't proceed if save fails
      } finally {
        setIsSaving(false);
      }
    } else {
      // Continue with normal flow for other tabs
      const currentIndex = tabsOrder.indexOf(activeTab);
      if (currentIndex < tabsOrder.length - 1) {
        const nextTab = tabsOrder[currentIndex + 1];
        // Clear validation errors and move to next tab
        setValidationErrors({});
        setActiveTab(nextTab);
      }
    }
  };

  const handleTabChange = (newTab: string) => {
    // If trying to move to a different tab, validate current tab first
    if (newTab !== activeTab) {
      if (!validateAllFields()) {
        toast.error("Please fix all errors in the current tab before proceeding");
        return; // Don't allow tab change
      }
    }

    // Clear validation errors when moving to a new tab
    setValidationErrors({});
    setActiveTab(newTab);
  };

  // Handle creating a new company from dialog
  const handleCreateCompanyFromDialog = async () => {
    if (!newCompanyForm.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!newCompanyForm.industry.trim()) {
      toast.error("Industry is required");
      return;
    }

    setIsCreatingCompany(true);
    try {
      const authToken = localStorage.getItem("auth-token") || Cookies.get("auth-token");
      const response = await fetch(buildExternalUrl("/crm/companies"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { "Authorization": `Bearer ${authToken}` })
        },
        credentials: "include",
        body: JSON.stringify({
          companyName: newCompanyForm.companyName,
          industry: newCompanyForm.industry,
          revenue: newCompanyForm.revenue,
          website: newCompanyForm.website,
          address: newCompanyForm.address,
          pinCode: newCompanyForm.pinCode,
          country: newCompanyForm.country,
          state: newCompanyForm.state,
          city: newCompanyForm.city,
        }),
      });

      if (response.ok) {
        const savedCompany = await response.json();
        const companyId = savedCompany._id || savedCompany.company?._id;

        // Add to companies list
        const newCompany = {
          _id: companyId,
          companyName: newCompanyForm.companyName,
          industry: newCompanyForm.industry,
        };
        setCompanies((prev) => [...prev, newCompany]);

        // Select the newly created company
        setSelectedCompanyId(companyId);

        // Reset form and close dialog
        setNewCompanyForm({
          companyName: "",
          industry: "",
          revenue: "",
          website: "",
          address: "",
          pinCode: "",
          country: "",
          state: "",
          city: "",
        });
        setIsAddCompanyDialogOpen(false);

        toast.success("Company created and selected successfully");
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.message || "Failed to create company";
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Error creating company:", error);
      toast.error("Failed to create company. Please try again.");
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    if (companyId === "add-company") {
      setIsAddCompanyDialogOpen(true);
      return;
    }
    setSelectedCompanyId(companyId);

    // Fetch and log company details
    const selectedCompany = companies.find((company) => company._id === companyId);
    if (selectedCompany) {
      console.log("Selected Company Details:", selectedCompany);
      console.log("Company ID:", selectedCompany._id);
      console.log("Company Name:", selectedCompany.companyName);
      console.log("Industry:", selectedCompany.industry);
    }
  };

  const handleFilePreview = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="p-6">
      {/* Back button */}
      <div className="flex items-center mb-6">
        <Button
          onClick={() => setIsAdd(false)}
          variant="ghost"
          className="text-lg font-semibold px-2 py-1 h-auto"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {editLead ? "Back to Lead Details" : "Back"}
        </Button>
      </div>
      {/* Main Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Main Tabs List */}
          <TabsList className="inline-flex h-auto p-0 bg-transparent rounded-none mb-6 w-full justify-start">
            <TabsTrigger
              value="contact"
              className="px-6 py-2 text-base font-normal rounded-full data-[state=active]:bg-blue-100 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600"
            >
              Contact
            </TabsTrigger>
            <TabsTrigger
              value="product-services"
              className="px-6 py-2 text-base font-normal rounded-full data-[state=active]:bg-blue-100 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600"
            >
              Product & Services
            </TabsTrigger>
            <TabsTrigger
              value="company"
              className="px-6 py-2 text-base font-normal rounded-full data-[state=active]:bg-blue-100 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600"
            >
              Company
            </TabsTrigger>

            <TabsTrigger
              value="documents"
              className="px-6 py-2 text-sm font-normal rounded-full data-[state=active]:bg-blue-100 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600"
            >
              Documents
            </TabsTrigger>
            {/* <TabsTrigger
              value="assigned-to"
              className="px-6 py-2 text-sm font-normal rounded-full data-[state=active]:bg-blue-100 data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-600"
            >
              Assigned to
            </TabsTrigger> */}
          </TabsList>
          <div className="border-b w-[520px] border-gray-200 mb-4" />

          {/* Contact Tab Content */}
          <TabsContent value="contact">
            <div className="space-y-6 w-96">
              <div className="space-y-2">
                <Label htmlFor="contact-select">
                  Contact <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedContactId || undefined}
                  onValueChange={setSelectedContactId}
                  disabled={isLoadingContacts || createNewContact}
                >
                  <SelectTrigger className={`w-full ${validationErrors.selectedContactId ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Search input inside dropdown */}
                    <div className="sticky top-0 bg-white border-b p-2 z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          placeholder="Search contacts..."
                          value={contactSearchQuery}
                          onChange={(e) => setContactSearchQuery(e.target.value)}
                          className="pl-8 h-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {/* Dropdown items */}
                    <div className="max-h-[200px] overflow-y-auto">
                      {isLoadingContacts ? (
                        <SelectItem value="loading" disabled>
                          Loading contacts...
                        </SelectItem>
                      ) : contacts.filter((contact) =>
                        `${contact.firstName} ${contact.lastName}`
                          .toLowerCase()
                          .includes(contactSearchQuery.toLowerCase())
                      ).length > 0 ? (
                        contacts
                          .filter((contact) =>
                            `${contact.firstName} ${contact.lastName}`
                              .toLowerCase()
                              .includes(contactSearchQuery.toLowerCase())
                          )
                          .map((contact) => (
                            <SelectItem key={contact._id} value={contact._id}>
                              {contact.firstName} {contact.lastName}
                            </SelectItem>
                          ))
                      ) : (
                        <SelectItem value="no-contacts" disabled>
                          No contacts found
                        </SelectItem>
                      )}
                    </div>
                  </SelectContent>
                </Select>
                {validationErrors.selectedContactId && (
                  <p className="text-red-500 text-sm">{validationErrors.selectedContactId}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  className="border-2 border-black"
                  id="create-new-contact"
                  checked={createNewContact}
                  onCheckedChange={(checked) => {
                    setCreateNewContact(checked as boolean);
                    if (checked) {
                      setSelectedContactId(""); // Clear selected contact
                      setFormData({
                        // Clear form fields
                        firstName: "",
                        lastName: "",
                        email: "",
                        dateOfBirth: "",
                        phoneNumber: "",
                      });
                    }
                  }}
                />
                <Label htmlFor="create-new-contact">
                  Create new contact <span className="text-red-500">*</span>
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-name">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first-name"
                  placeholder="Enter your First Name"
                  value={formData.firstName}
                  onChange={(e) =>
                    handleFormChange("firstName", e.target.value)
                  }
                  disabled={!createNewContact}
                  className={`${!createNewContact ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.firstName ? "border-red-500" : ""}`}
                />
                {validationErrors.firstName && (
                  <p className="text-red-500 text-sm">{validationErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last-name"
                  placeholder="Enter your Last Name"
                  value={formData.lastName}
                  onChange={(e) => handleFormChange("lastName", e.target.value)}
                  disabled={!createNewContact}
                  className={`${!createNewContact ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.lastName ? "border-red-500" : ""}`}
                />
                {validationErrors.lastName && (
                  <p className="text-red-500 text-sm">{validationErrors.lastName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="email"
                    placeholder="Enter your Email"
                    value={formData.email}
                    onChange={(e) => handleFormChange("email", e.target.value)}
                    className={`pl-10 ${!createNewContact ? "bg-gray-100 cursor-not-allowed" : ""} ${validationErrors.email ? "border-red-500" : ""}`}
                    disabled={!createNewContact}
                  />
                </div>
                {validationErrors.email && (
                  <p className="text-red-500 text-sm">{validationErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">
                  Date of Birth <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="dob"
                    type="date"
                    placeholder="Pick a Date"
                    value={formData.dateOfBirth}
                    onChange={(e) =>
                      handleFormChange("dateOfBirth", e.target.value)
                    }
                    className={`pl-10 ${!createNewContact ? "bg-gray-100 cursor-not-allowed" : ""} ${validationErrors.dateOfBirth ? "border-red-500" : ""}`}
                    disabled={!createNewContact}
                  />
                </div>
                {validationErrors.dateOfBirth && (
                  <p className="text-red-500 text-sm">{validationErrors.dateOfBirth}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone-number">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="phone-number"
                    type="number"
                    placeholder="Enter your Phone Number"
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      handleFormChange("phoneNumber", e.target.value)
                    }
                    className={`pl-10 ${!createNewContact ? "bg-gray-100 cursor-not-allowed" : ""} ${validationErrors.phoneNumber ? "border-red-500" : ""}`}
                    disabled={!createNewContact}
                  />
                </div>
                {validationErrors.phoneNumber && (
                  <p className="text-red-500 text-sm">{validationErrors.phoneNumber}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">
                  Duration (days) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="Enter duration in days"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={`w-full ${validationErrors.duration ? "border-red-500" : ""}`}
                />
                {validationErrors.duration && (
                  <p className="text-red-500 text-sm">{validationErrors.duration}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveAndNext}
                  className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300"
                >
                  Save & Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Product & Services Tab Content */}
          <TabsContent value="product-services">
            <div className="space-y-6 w-96">
              <div className="space-y-2">
                <Label htmlFor="product-services-select">
                  Product/Services <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedProductId || undefined}
                  onValueChange={setSelectedProductId}
                  disabled={isLoadingProducts}
                >
                  <SelectTrigger className={`w-full ${validationErrors.selectedProductId ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Product Name" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingProducts ? (
                      <SelectItem value="loading" disabled>
                        Loading products...
                      </SelectItem>
                    ) : products.length > 0 ? (
                      products.map((product) => (
                        <SelectItem key={product._id} value={product._id}>
                          {product.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-products" disabled>
                        No products available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {validationErrors.selectedProductId && (
                  <p className="text-red-500 text-sm">{validationErrors.selectedProductId}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-select">
                  Category <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedCategoryId || undefined}
                    onValueChange={setSelectedCategoryId}
                    disabled={isLoadingCategories}
                  >
                    <SelectTrigger className={`w-full flex-1 ${validationErrors.selectedCategoryId ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingCategories ? (
                        <SelectItem value="loading" disabled>
                          Loading categories...
                        </SelectItem>
                      ) : categories.length > 0 ? (
                        categories.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.category}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-categories" disabled>
                          No categories available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCategoryModal(true)}
                    className="px-3"
                  >
                    Add new
                  </Button>
                </div>
                {validationErrors.selectedCategoryId && (
                  <p className="text-red-500 text-sm">{validationErrors.selectedCategoryId}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  value={quantity}
                  type="number"
                  placeholder="Enter Quantity"
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className={validationErrors.quantity ? "border-red-500" : ""}
                />
                {validationErrors.quantity && (
                  <p className="text-red-500 text-sm">{validationErrors.quantity}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricing">
                  Pricing <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pricing"
                  type="number"
                  value={pricing}
                  placeholder="Enter Pricing"
                  onChange={(e) => handlePricingChange(e.target.value)}
                  className={validationErrors.pricing ? "border-red-500" : ""}
                />
                {validationErrors.pricing && (
                  <p className="text-red-500 text-sm">{validationErrors.pricing}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="negotiated-pricing">
                  Negotiated Pricing <span className="text-red-500"></span>
                </Label>
                <Input
                  id="negotiated-pricing"
                  type="number"
                  value={negotiatedPricing}
                  placeholder="Enter Negotiated Pricing"
                  onChange={(e) => handleNegotiatedPricingChange(e.target.value)}
                  className={validationErrors.negotiatedPricing ? "border-red-500" : ""}
                />
                {validationErrors.negotiatedPricing && (
                  <p className="text-red-500 text-sm">{validationErrors.negotiatedPricing}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-discounted-price">
                  Max. Discounted Price <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="max-discounted-price"
                  type="number"
                  value={maxDiscPrice}
                  placeholder="Enter Max. Discounted Price"
                  onChange={(e) => handleMaxDiscPriceChange(e.target.value)}
                  className={validationErrors.maxDiscPrice ? "border-red-500" : ""}
                />
                {validationErrors.maxDiscPrice && (
                  <p className="text-red-500 text-sm">{validationErrors.maxDiscPrice}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sales-funnel">
                  Sales Funnel <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedSalesFunnelId || undefined}
                  onValueChange={setSelectedSalesFunnelId}
                  disabled={isLoadingSalesFunnels}
                >
                  <SelectTrigger className={`w-full ${validationErrors.selectedSalesFunnelId ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select Sales Funnel" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingSalesFunnels ? (
                      <SelectItem value="loading" disabled>
                        Loading sales funnels...
                      </SelectItem>
                    ) : salesFunnels.length > 0 ? (
                      salesFunnels.map((funnel) => (
                        <SelectItem key={funnel._id} value={funnel._id}>
                          {funnel.funnelName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-funnels" disabled>
                        No sales funnels available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {validationErrors.selectedSalesFunnelId && (
                  <p className="text-red-500 text-sm">{validationErrors.selectedSalesFunnelId}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage">
                  Stage <span className="text-red-500">*</span>
                </Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFunnelStages?.funnelStage &&
                      selectedFunnelStages.funnelStage.length > 0 ? (
                      selectedFunnelStages.funnelStage.map(
                        (stageOption: any) => {
                          // Handle both string and object formats
                          const stageValue = typeof stageOption === 'string' ? stageOption : stageOption.name || stageOption.id || stageOption;
                          const stageDisplay = typeof stageOption === 'string' ? stageOption : stageOption.name || stageOption.id || stageOption;
                          return (
                            <SelectItem key={stageValue} value={stageValue}>
                              {stageDisplay}
                            </SelectItem>
                          );
                        }
                      )
                    ) : (
                      <>
                        <SelectItem value="discovery">Discovery</SelectItem>
                        <SelectItem value="qualification">
                          Qualification
                        </SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="negotiation">Negotiation</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveAndNext}
                  className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300"
                >
                  Save & Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Company Tab Content */}
          <TabsContent value="company">
            <div className="space-y-6 w-96">
              <div className="space-y-2">
                <Label htmlFor="company-select">
                  Company <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedCompanyId || undefined}
                  onValueChange={handleCompanySelect}
                  disabled={isLoadingCompanies || createNewCompany}
                >
                  <SelectTrigger className={`w-full ${validationErrors.selectedCompanyId ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Search input inside dropdown */}
                    <div className="sticky top-0 bg-white border-b p-2 z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          placeholder="Search companies..."
                          value={companySearchQuery}
                          onChange={(e) => setCompanySearchQuery(e.target.value)}
                          className="pl-8 h-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {/* Add Company Option - At the top */}
                    <div className="p-2 border-b border-gray-200">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border-2 border-red-500 rounded-md hover:bg-red-50 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsAddCompanyDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Add New Company
                      </button>
                    </div>
                    {/* Dropdown items */}
                    <div className="max-h-[200px] overflow-y-auto">
                      {isLoadingCompanies ? (
                        <SelectItem value="loading" disabled>
                          Loading companies...
                        </SelectItem>
                      ) : (
                        <>
                          {companies.filter((company) =>
                            company.companyName
                              ?.toLowerCase()
                              .includes(companySearchQuery?.toLowerCase() || "")
                          ).length > 0 ? (
                            companies
                              .filter((company) =>
                                company.companyName
                                  ?.toLowerCase()
                                  .includes(companySearchQuery?.toLowerCase() || "")
                              )
                              .map((company) => (
                                <SelectItem key={company._id} value={company._id}>
                                  {company.companyName}
                                </SelectItem>
                              ))
                          ) : (
                            <SelectItem value="no-companies" disabled>
                              No companies found
                            </SelectItem>
                          )}
                        </>
                      )}
                    </div>
                  </SelectContent>
                </Select>
                {validationErrors.selectedCompanyId && (
                  <p className="text-red-500 text-sm">{validationErrors.selectedCompanyId}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  className="border-2 border-black"
                  id="create-new-company"
                  checked={createNewCompany}
                  onCheckedChange={(checked) => {
                    setCreateNewCompany(checked as boolean);
                    if (checked) {
                      setSelectedCompanyId(""); // Clear selected company
                      setCompanyFormData({
                        // Clear form fields
                        companyName: "",
                        industry: "",
                        revenue: "",
                        website: "",
                        address: "",
                        pinCode: "",
                        country: "",
                        state: "",
                        city: "",
                      });
                    }
                  }}
                />
                <Label htmlFor="create-new-company">
                  Create new Company <span className="text-red-500">*</span>
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-name">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="company-name"
                  placeholder="Enter Company Name"
                  value={companyFormData.companyName}
                  onChange={(e) =>
                    handleCompanyFormChange("companyName", e.target.value)
                  }
                  disabled={!createNewCompany}
                  className={`${!createNewCompany ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.companyName ? "border-red-500" : ""}`}
                />
                {validationErrors.companyName && (
                  <p className="text-red-500 text-sm">{validationErrors.companyName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">
                  Industry <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="industry"
                  placeholder="Enter Industry"
                  value={companyFormData.industry}
                  onChange={(e) =>
                    handleCompanyFormChange("industry", e.target.value)
                  }
                  disabled={!createNewCompany}
                  className={`${!createNewCompany ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.industry ? "border-red-500" : ""}`}
                />
                {validationErrors.industry && (
                  <p className="text-red-500 text-sm">{validationErrors.industry}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue">
                  Revenue <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="revenue"
                  placeholder="Enter Revenue"
                  value={companyFormData.revenue}
                  onChange={(e) =>
                    handleCompanyFormChange("revenue", e.target.value)
                  }
                  disabled={!createNewCompany}
                  className={`${!createNewCompany ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.revenue ? "border-red-500" : ""}`}
                />
                {validationErrors.revenue && (
                  <p className="text-red-500 text-sm">{validationErrors.revenue}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">
                  Website <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="website"
                  placeholder="Enter Website"
                  value={companyFormData.website}
                  onChange={(e) =>
                    handleCompanyFormChange("website", e.target.value)
                  }
                  disabled={!createNewCompany}
                  className={`${!createNewCompany ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.website ? "border-red-500" : ""}`}
                />
                {validationErrors.website && (
                  <p className="text-red-500 text-sm">{validationErrors.website}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">
                  Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  placeholder="Enter Address"
                  value={companyFormData.address}
                  onChange={(e) =>
                    handleCompanyFormChange("address", e.target.value)
                  }
                  disabled={!createNewCompany}
                  className={`${!createNewCompany ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.address ? "border-red-500" : ""}`}
                />
                {validationErrors.address && (
                  <p className="text-red-500 text-sm">{validationErrors.address}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin-code">
                  Pin code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pin-code"
                  type="number"
                  placeholder="Enter Pin Code"
                  value={companyFormData.pinCode}
                  onChange={(e) =>
                    handleCompanyFormChange("pinCode", e.target.value)
                  }
                  disabled={!createNewCompany}
                  className={`${!createNewCompany ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.pinCode ? "border-red-500" : ""}`}
                />
                {validationErrors.pinCode && (
                  <p className="text-red-500 text-sm">{validationErrors.pinCode}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="country"
                  placeholder="Enter Country"
                  value={companyFormData.country}
                  onChange={(e) =>
                    handleCompanyFormChange("country", e.target.value)
                  }
                  disabled={!createNewCompany}
                  className={`${!createNewCompany ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.country ? "border-red-500" : ""}`}
                />
                {validationErrors.country && (
                  <p className="text-red-500 text-sm">{validationErrors.country}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">
                  State <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="state"
                  placeholder="Enter State"
                  value={companyFormData.state}
                  onChange={(e) =>
                    handleCompanyFormChange("state", e.target.value)
                  }
                  disabled={!createNewCompany}
                  className={`${!createNewCompany ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.state ? "border-red-500" : ""}`}
                />
                {validationErrors.state && (
                  <p className="text-red-500 text-sm">{validationErrors.state}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">
                  City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="Enter City"
                  value={companyFormData.city}
                  onChange={(e) =>
                    handleCompanyFormChange("city", e.target.value)
                  }
                  disabled={!createNewCompany}
                  className={`${!createNewCompany ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${validationErrors.city ? "border-red-500" : ""}`}
                />
                {validationErrors.city && (
                  <p className="text-red-500 text-sm">{validationErrors.city}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveAndNext}
                  className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300"
                >
                  Save & Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Images Tab Content */}
          <TabsContent value="images">
            <div className="space-y-6 w-96">
              <div className="space-y-2">
                <Label htmlFor="image-name-input">
                  Image Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="image-name-input"
                  placeholder="Enter Image Name"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value)}
                />
              </div>

              {/* Image Upload Area */}
              <div className="space-y-2">
                <Label htmlFor="image-upload">
                  Image Upload <span className="text-red-500">*</span>
                </Label>
                <div
                  className="flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() =>
                    document.getElementById("image-upload")?.click()
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
                    Jpeg, Png, Gif (max. 10 mb)
                  </p>
                  <Input
                    id="image-upload"
                    type="file"
                    className="sr-only"
                    accept=".jpeg,.jpg,.png,.gif"
                    onChange={handleImageInputChange}
                    disabled={isUploadingImage}
                  />
                </div>
              </div>

              {/* Uploaded Images List */}
              {images.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Images</Label>
                  <div className="space-y-2">
                    {images.map((img, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm text-black p-2 border rounded"
                      >
                        <Download className="w-4 h-4" />
                        <button
                          onClick={() => handleFilePreview(img.imageLink)}
                          className="text-blue-600 hover:text-blue-800 underline cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                          title="Click to preview in new tab"
                        >
                          {img.imageName}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setImages((prev) =>
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
                    if (!imageName.trim()) {
                      toast.error("Please enter an image name first");
                      return;
                    }
                    // Trigger file input click
                    document.getElementById("image-upload")?.click();
                  }}
                  disabled={isUploadingImage}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isUploadingImage ? "Uploading..." : "Add Other Product Image"}
                </Button>
                <Button
                  onClick={handleSaveAndNext}
                  className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300"
                >
                  Save & Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Documents Tab Content */}
          <TabsContent value="documents">
            <div className="space-y-6 w-96">
              <div className="space-y-2">
                <Label htmlFor="document-name-input">
                  Document Name
                </Label>
                <Input
                  id="document-name-input"
                  placeholder="Enter Document Name"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                />
              </div>

              {/* Document Upload Area */}
              <div className="space-y-2">
                <Label htmlFor="document-upload">
                  Document Upload
                </Label>
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
                        className="flex items-center gap-2 text-sm text-black p-2 border rounded"
                      >
                        <Download className="w-4 h-4" />
                        <button
                          onClick={() => handleFilePreview(doc.docLink)}
                          className="text-blue-600 hover:text-blue-800 underline cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                          title="Click to preview in new tab"
                        >
                          {doc.docName}
                        </button>
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
                  disabled={isSaving}
                  className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editLead ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      Save & Next <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Assigned to Tab Content - Commented Out
          <TabsContent value="assigned-to">
            <div className="space-y-6 w-96">
              <div className="space-y-2">
                <Label htmlFor="stage-select">Stage</Label>
                <div className="relative">
                  <Select defaultValue="discovery">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Discovery" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discovery">Discovery</SelectItem>
                      <SelectItem value="qualification">
                        Qualification
                      </SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-member-select">Team Member</Label>
                <div className="relative">
                  <Select
                    onValueChange={(value) => {
                      if (value && !selectedTeamMembers.includes(value)) {
                        setSelectedTeamMembers([...selectedTeamMembers, value]);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Team Member" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeamMembers.map((member) => (
                        <SelectItem key={member} value={member}>
                          {member}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedTeamMembers.map((member, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="rounded-full transition-all duration-300 bg-[#3DB69A] hover:bg-[#3DB69A]/80 text-sm text-white flex items-center gap-1"
                    onClick={() =>
                      setSelectedTeamMembers(
                        selectedTeamMembers.filter((m) => m !== member)
                      )
                    }
                  >
                    {member} <X className="h-3 w-3" />
                  </Button>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveAndNext}
                  className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300"
                >
                  Save <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </TabsContent>
          */}
        </Tabs>
      </div>

      {/* Alert Dialog */}
      <AlertDialog
        open={alertDialog.isOpen}
        onOpenChange={(open) =>
          setAlertDialog((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() =>
                setAlertDialog((prev) => ({ ...prev, isOpen: false }))
              }
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new category for products and services.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category-name" className="text-right">
                Name
              </Label>
              <Input
                id="category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateCategory();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCategoryModal(false);
                setNewCategoryName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={isCreatingCategory || !newCategoryName.trim()}
            >
              {isCreatingCategory ? "Creating..." : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Company Dialog */}
      <Dialog open={isAddCompanyDialogOpen} onOpenChange={setIsAddCompanyDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
            <DialogDescription>
              Create a new company to add to this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-company-name">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="new-company-name"
                  placeholder="Enter company name"
                  value={newCompanyForm.companyName}
                  onChange={(e) =>
                    setNewCompanyForm({ ...newCompanyForm, companyName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company-industry">
                  Industry <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="new-company-industry"
                  placeholder="Enter industry"
                  value={newCompanyForm.industry}
                  onChange={(e) =>
                    setNewCompanyForm({ ...newCompanyForm, industry: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company-revenue">
                  Revenue <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="new-company-revenue"
                  placeholder="Enter revenue"
                  value={newCompanyForm.revenue}
                  onChange={(e) =>
                    setNewCompanyForm({ ...newCompanyForm, revenue: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company-website">Website</Label>
              <Input
                id="new-company-website"
                placeholder="Enter website"
                value={newCompanyForm.website}
                onChange={(e) =>
                  setNewCompanyForm({ ...newCompanyForm, website: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company-address">Address</Label>
              <Input
                id="new-company-address"
                placeholder="Enter address"
                value={newCompanyForm.address}
                onChange={(e) =>
                  setNewCompanyForm({ ...newCompanyForm, address: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-company-city">City</Label>
                <Input
                  id="new-company-city"
                  placeholder="Enter city"
                  value={newCompanyForm.city}
                  onChange={(e) =>
                    setNewCompanyForm({ ...newCompanyForm, city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company-state">State</Label>
                <Input
                  id="new-company-state"
                  placeholder="Enter state"
                  value={newCompanyForm.state}
                  onChange={(e) =>
                    setNewCompanyForm({ ...newCompanyForm, state: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-company-country">Country</Label>
                <Input
                  id="new-company-country"
                  placeholder="Enter country"
                  value={newCompanyForm.country}
                  onChange={(e) =>
                    setNewCompanyForm({ ...newCompanyForm, country: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company-pincode">Pin Code</Label>
                <Input
                  id="new-company-pincode"
                  placeholder="Enter pin code"
                  value={newCompanyForm.pinCode}
                  onChange={(e) =>
                    setNewCompanyForm({ ...newCompanyForm, pinCode: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddCompanyDialogOpen(false);
                setNewCompanyForm({
                  companyName: "",
                  industry: "",
                  revenue: "",
                  website: "",
                  address: "",
                  pinCode: "",
                  country: "",
                  state: "",
                  city: "",
                });
              }}
              disabled={isCreatingCompany}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCompanyFromDialog}
              disabled={isCreatingCompany}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {isCreatingCompany ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
