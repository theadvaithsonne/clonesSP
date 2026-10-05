"use client";

import React, { useState, useEffect } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// import { Badge } from "@/components/ui/badge";
import {
  // ChevronDown,
  // Download,
  MoreHorizontal,
  Plus,
  Search,
  // SlidersHorizontal,
  // Star,
  UserCircle,
} from "lucide-react";
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
import { createActivity } from "@/lib/activity";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";

// Interface for contact data structure
interface Contact {
  _id: string;
  userId: string;
  companyId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  convertedToClient?: boolean;
  convertedAt?: string;
  convertedEmployeeId?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyId: "",
    jobTitle: "",
    notes: "",
  });

  // Add validation state
  const [validationErrors, setValidationErrors] = useState({
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
    companyId: "",
    jobTitle: "",
  });

  // Email validation function
  const validateEmail = (email: string) => {
    if (!email) return ""; // Empty email is allowed
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? "" : "Please enter a valid email address";
  };

  // Phone validation function
  const validatePhone = (phone: string) => {
    if (!phone) return ""; // Empty phone is allowed
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone) ? "" : "Phone number must be exactly 10 digits";
  };

  // Fetch contacts from the API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch contacts from new CRM backend (SSO-aware)
        const contactsResponse = await authenticatedFetch(
          buildExternalUrl("crm/contacts"),
          { method: "GET" }
        );
        if (!contactsResponse.ok) {
          throw new Error("Failed to fetch contacts");
        }
        const contactsJson = await contactsResponse.json();
        const contactsData = contactsJson?.contacts || contactsJson?.data || contactsJson || [];
        setContacts(Array.isArray(contactsData) ? contactsData : []);

        // Fetch companies to map companyId to company name
        const companiesResponse = await authenticatedFetch(
          buildExternalUrl("crm/companies"),
          { method: "GET" }
        );
        if (companiesResponse.ok) {
          const companiesData = await companiesResponse.json();
          const companyMap: Record<string, string> = {};
          companiesData.forEach((company: { _id: string; name: string }) => {
            companyMap[company._id] = company.name;
          });
          setCompanies(companyMap);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load contacts. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const filteredContacts = contacts.filter(
    (contact) =>
      // Filter out converted contacts

      `${contact.firstName} ${contact.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (contact.email &&
        contact.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.companyId &&
        companies[contact.companyId] &&
        companies[contact.companyId]
          .toLowerCase()
          .includes(searchTerm.toLowerCase()))

  );

  // Handle contact deletion with alert dialog
  const handleDeleteContact = async (id: string) => {
    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`crm/contacts/${id}`),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete contact");
      }

      // Get contact details before deletion for activity record
      const contactToDelete = contacts.find((c) => c._id === id);
      if (contactToDelete) {
        await createActivity({
          type: "delete",
          entityType: "contact",
          entityId: id,
          entityName: `${contactToDelete.firstName} ${contactToDelete.lastName}`,
          description: `Deleted contact: ${contactToDelete.firstName} ${contactToDelete.lastName}`,
        });
      }

      // Remove the deleted contact from the state
      setContacts(contacts.filter((contact) => contact._id !== id));
      setContactToDelete(null);

      toast.success("Contact deleted successfully");
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
    }
  };

  // Open delete alert
  const openDeleteAlert = (id: string) => {
    setContactToDelete(id);
    setIsDeleteAlertOpen(true);
  };

  // Open view dialog
  const openViewDialog = (contact: Contact) => {
    setCurrentContact(contact);
    setIsViewDialogOpen(true);
    // Create activity record for viewing
    createActivity({
      type: "view",
      entityType: "contact",
      entityId: contact._id,
      entityName: `${contact.firstName} ${contact.lastName}`,
      description: `Viewed contact details: ${contact.firstName} ${contact.lastName}`,
    });
  };

  // Open edit dialog
  const openEditDialog = (contact: Contact) => {
    // Populate the form with the contact data
    setNewContact({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || "",
      phone: contact.phone || "",
      companyId: contact.companyId || "none",
      jobTitle: contact.jobTitle || "",
      notes: contact.notes || "",
    });
    setCurrentContact(contact);
    setIsEditDialogOpen(true);
  };

  // Handle contact update
  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContact?._id) return;

    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`crm/contacts/${currentContact._id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newContact),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update contact");
      }

      const updatedContact = await response.json();
      setContacts(
        contacts.map((contact) =>
          contact._id === currentContact._id ? updatedContact : contact
        )
      );
      setIsEditDialogOpen(false);
      setCurrentContact(null);
      setNewContact({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        companyId: "",
        jobTitle: "",
        notes: "",
      });

      // Create activity record for contact update
      await createActivity({
        type: "update",
        entityType: "contact",
        entityId: currentContact._id,
        entityName: `${updatedContact.firstName} ${updatedContact.lastName}`,
        description: `Updated contact: ${updatedContact.firstName} ${updatedContact.lastName}`,
      });

      toast.success("Contact updated successfully");
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Failed to update contact");
    }
  };

  // Handle form input changes with validation
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setNewContact((prev) => ({ ...prev, [name]: value }));

    // Validate email and phone
    if (name === "email") {
      setValidationErrors(prev => ({
        ...prev,
        email: validateEmail(value)
      }));
    } else if (name === "phone") {
      // Remove any non-digit characters from phone input
      const cleanedValue = value.replace(/\D/g, '');
      setNewContact((prev) => ({ ...prev, phone: cleanedValue }));
      setValidationErrors(prev => ({
        ...prev,
        phone: validatePhone(cleanedValue)
      }));
    }
  };

  // Handle company selection
  const handleCompanySelect = (value: string) => {
    setNewContact((prev) => ({ ...prev, companyId: value }));
  };

  // Handle contact creation with validation
  const handleCreateContact = async () => {


    // Validate required fields before submission
    const errors = {
      firstName: !newContact.firstName || newContact.firstName.trim() === "" ? "First name is required" : "",
      lastName: !newContact.lastName || newContact.lastName.trim() === "" ? "Last name is required" : "",
      email: validateEmail(newContact.email || ""),
      phone: validatePhone(newContact.phone || ""),
      companyId: !newContact.companyId || newContact.companyId === "none" || newContact.companyId.trim() === "" ? "Company is required" : "",
      jobTitle: !newContact.jobTitle || newContact.jobTitle.trim() === "" ? "Job title is required" : "",
    };

    setValidationErrors(errors);

    // If there are any validation errors, don't submit
    if (errors.firstName || errors.lastName || errors.email || errors.phone || errors.companyId || errors.jobTitle) {
      return;
    }

    try {
      const response = await authenticatedFetch(
        buildExternalUrl("crm/contacts"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newContact),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create lead");
      }

      const createdContact = await response.json();
      setContacts([...contacts, createdContact]);
      setIsAddDialogOpen(false);
      setNewContact({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        companyId: "",
        jobTitle: "",
        notes: "",
      });

      // Create activity record for contact creation
      await createActivity({
        type: "create",
        entityType: "contact",
        entityId: createdContact._id?.toString() || "",
        entityName: `${createdContact.firstName} ${createdContact.lastName}`,
        description: `Created new lead: ${createdContact.firstName} ${createdContact.lastName}`,
      });

      toast.success("Lead created successfully");
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error("Failed to create lead");
    }
  };
  // Add this function inside the ContactsPage component
  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(
        buildExternalUrl("crm/contacts"),
        { method: "GET" }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }
      const data = await response.json();
      setContacts(data);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  };

  // Update the handleConvertToClient function to use "update" instead of "convert"
  const handleConvertToClient = async (contact: Contact) => {
    try {
      const response = await authenticatedFetch(
        buildExternalUrl("crm/contacts/convert-to-client"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contactId: contact._id }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to convert lead to client");
      }

      // Create activity record for client conversion
      await createActivity({
        type: "update",
        entityType: "contact",
        entityId: contact._id?.toString() || "",
        entityName: `${contact.firstName} ${contact.lastName}`,
        description: `Converted lead to client: ${contact.firstName} ${contact.lastName}`,
      });

      toast.success("Lead successfully converted to client");

      // Refresh the contacts list
      fetchContacts();
    } catch (error) {
      console.error("Error converting lead to client:", error);
      toast.error(error instanceof Error ? error.message : "Failed to convert lead to client");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex gap-2">
          {/* <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button> */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary">
                <Plus className="mr-2 h-4 w-4" /> Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name <span style={{ color: "red" }}>*</span></Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={newContact.firstName}
                      onChange={handleInputChange}
                      placeholder="First name"
                      className={validationErrors.firstName ? "border-red-500" : ""}
                    />
                    {validationErrors.firstName && (
                      <p className="text-sm text-red-500">{validationErrors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name <span style={{ color: "red" }}>*</span></Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={newContact.lastName}
                      onChange={handleInputChange}
                      placeholder="Last name"
                      className={validationErrors.lastName ? "border-red-500" : ""}
                    />
                    {validationErrors.lastName && (
                      <p className="text-sm text-red-500">{validationErrors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email <span style={{ color: "red" }}>*</span></Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={newContact.email}
                      onChange={handleInputChange}
                      placeholder="Email address"
                      className={validationErrors.email ? "border-red-500" : ""}
                    />
                    {validationErrors.email && (
                      <p className="text-sm text-red-500">{validationErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone <span style={{ color: "red" }}>*</span></Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={newContact.phone}
                      onChange={handleInputChange}
                      placeholder="Phone number"
                      maxLength={10}
                      className={validationErrors.phone ? "border-red-500" : ""}
                    />
                    {validationErrors.phone && (
                      <p className="text-sm text-red-500">{validationErrors.phone}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyId">Company <span style={{ color: "red" }}>*</span></Label>
                    <Select
                      value={newContact.companyId}
                      onValueChange={handleCompanySelect}
                    >
                      <SelectTrigger className={validationErrors.companyId ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Company</SelectItem>
                        {Object.entries(companies).map(([id, name]) => (
                          <SelectItem key={id} value={id}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.companyId && (
                      <p className="text-sm text-red-500">{validationErrors.companyId}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title <span style={{ color: "red" }}>*</span></Label>
                    <Input
                      id="jobTitle"
                      name="jobTitle"
                      value={newContact.jobTitle}
                      onChange={handleInputChange}
                      placeholder="Job title or position"
                      className={validationErrors.jobTitle ? "border-red-500" : ""}
                    />
                    {validationErrors.jobTitle && (
                      <p className="text-sm text-red-500">{validationErrors.jobTitle}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={newContact.notes}
                    onChange={handleInputChange}
                    placeholder="Additional notes about this contact"
                    className="min-h-[100px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateContact}
                  disabled={
                    !newContact.firstName ||
                    newContact.firstName.trim() === "" ||
                    !newContact.lastName ||
                    newContact.lastName.trim() === "" ||
                    !newContact.email ||
                    newContact.email.trim() === "" ||
                    !newContact.phone ||
                    newContact.phone.trim() === "" ||
                    !newContact.companyId ||
                    newContact.companyId === "none" ||
                    newContact.companyId.trim() === "" ||
                    !newContact.jobTitle ||
                    newContact.jobTitle.trim() === ""
                  }
                  variant={
                    !newContact.firstName ||
                      newContact.firstName.trim() === "" ||
                      !newContact.lastName ||
                      newContact.lastName.trim() === "" ||
                      !newContact.email ||
                      newContact.email.trim() === "" ||
                      !newContact.phone ||
                      newContact.phone.trim() === "" ||
                      !newContact.companyId ||
                      newContact.companyId === "none" ||
                      newContact.companyId.trim() === "" ||
                      !newContact.jobTitle ||
                      newContact.jobTitle.trim() === ""
                      ? "ghost"
                      : "default"
                  }
                >
                  Create Lead
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex justify-between">
        <div className="flex gap-2 w-full max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search leads..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* <Button variant="outline">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
          </Button> */}
        </div>
        {/* <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              All Leads <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>All Leads</DropdownMenuItem>
            <DropdownMenuItem>By Company</DropdownMenuItem>
            <DropdownMenuItem>Recent Leads</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> */}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading leads...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64">
          <UserCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No leads found</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <span className="sr-only">Favorite</span>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden md:table-cell">
                  Job Title
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  Converted to Client
                </TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact._id} className="hover:bg-muted/50">
                  <TableCell>
                    {/* <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Star className="h-4 w-4 text-muted-foreground" />
                    </Button> */}
                  </TableCell>
                  <TableCell className="font-medium">
                    {`${contact.firstName} ${contact.lastName}`}
                  </TableCell>
                  <TableCell>{contact.email || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {contact.phone || "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {contact.companyId && companies[contact.companyId]
                      ? companies[contact.companyId]
                      : "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {contact.jobTitle || "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {contact.convertedToClient ? "Yes" : "No"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openViewDialog(contact)}
                        >
                          View Lead
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openEditDialog(contact)}
                        >
                          Edit Lead
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={contact.convertedToClient}
                          onClick={() => handleConvertToClient(contact)}
                        >
                          Convert to Client
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => openDeleteAlert(contact._id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredContacts.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No leads found</p>
            </div>
          )}
        </div>
      )}

      {/* Add the View Contact Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
          </DialogHeader>
          {currentContact && (
            <div className="py-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Full Name
                    </h3>
                    <p className="text-base">{`${currentContact.firstName} ${currentContact.lastName}`}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Company
                    </h3>
                    <p className="text-base">
                      {currentContact.companyId &&
                        companies[currentContact.companyId]
                        ? companies[currentContact.companyId]
                        : "No Company"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Email
                    </h3>
                    <p className="text-base">
                      {currentContact.email || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Phone
                    </h3>
                    <p className="text-base">
                      {currentContact.phone || "Not provided"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Job Title
                  </h3>
                  <p className="text-base">
                    {currentContact.jobTitle || "Not provided"}
                  </p>
                </div>

                {currentContact.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Notes
                    </h3>
                    <p className="text-base">{currentContact.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Created
                    </h3>
                    <p className="text-base">
                      {new Date(currentContact.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Last Updated
                    </h3>
                    <p className="text-base">
                      {new Date(currentContact.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setIsViewDialogOpen(false);
                if (currentContact) openEditDialog(currentContact);
              }}
            >
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add the Edit Contact Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={newContact.firstName}
                  onChange={handleInputChange}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={newContact.lastName}
                  onChange={handleInputChange}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={newContact.email}
                  onChange={handleInputChange}
                  placeholder="Email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={newContact.phone}
                  onChange={handleInputChange}
                  placeholder="Phone number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyId">Company</Label>
                <Select
                  value={newContact.companyId}
                  onValueChange={handleCompanySelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Company</SelectItem>
                    {Object.entries(companies).map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  value={newContact.jobTitle}
                  onChange={handleInputChange}
                  placeholder="Job title or position"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={newContact.notes}
                onChange={handleInputChange}
                placeholder="Additional notes about this contact"
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setCurrentContact(null);
                setNewContact({
                  firstName: "",
                  lastName: "",
                  email: "",
                  phone: "",
                  companyId: "",
                  jobTitle: "",
                  notes: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateContact}>Update Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add the Delete Alert Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              contact from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setContactToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (contactToDelete) {
                  handleDeleteContact(contactToDelete);
                }
              }}
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
