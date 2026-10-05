"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { toast } from "sonner";

const extractErrorMessage = (error: any, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    return extractErrorMessage(error[0], fallback);
  }
  if (typeof error === "object") {
    return (
      error.message ||
      error.error ||
      error.description ||
      (typeof error.details === "string" ? error.details : null) ||
      (Array.isArray(error.details) ? extractErrorMessage(error.details[0], fallback) : null) ||
      (Array.isArray(error.errors) ? extractErrorMessage(error.errors[0], fallback) : null) ||
      (typeof error.errors === "string" ? error.errors : null) ||
      fallback
    );
  }
  return fallback;
};

interface Company {
  _id: string;
  name: string;
  industry?: string;
  website?: string;
}

export default function ContactFlow({
  setIsAdd,
}: {
  setIsAdd: (value: boolean) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dob, setDob] = useState("");
  const [company, setCompany] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Validation error states
  const [firstNameError, setFirstNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneNumberError, setPhoneNumberError] = useState("");

  // Fetch companies from API
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoadingCompanies(true);
        const response = await authenticatedFetch(buildExternalUrl("crm/companies"), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch companies: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Companies fetch response:", data);
        
        // Handle different response structures
        let companiesData: Company[] = [];
        if (Array.isArray(data)) {
          companiesData = data;
        } else if (data.companies && Array.isArray(data.companies)) {
          companiesData = data.companies;
        } else if (data.data && Array.isArray(data.data)) {
          companiesData = data.data;
        }
        
        console.log("Processed companies data:", companiesData);
        setCompanies(companiesData);
      } catch (error) {
        console.error("Error fetching companies:", error);
        toast.error("Failed to load companies. Please try again.");
        setCompanies([]);
      } finally {
        setLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, []);

  // Validation functions
  const validateFirstName = (name: string): boolean => {
    if (!name.trim()) {
      setFirstNameError("First name is required");
      return false;
    }
    setFirstNameError("");
    return true;
  };

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) {
      setEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone.trim()) {
      setPhoneNumberError("Phone number is required");
      return false;
    }
    // Basic phone number validation (allows various formats)
    const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)]{7,15}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      setPhoneNumberError("Please enter a valid phone number");
      return false;
    }
    setPhoneNumberError("");
    return true;
  };

  const handleSave = async () => {
    // Validate required fields
    const isFirstNameValid = validateFirstName(firstName);
    const isEmailValid = validateEmail(email);
    const isPhoneNumberValid = validatePhoneNumber(phoneNumber);

    if (!isFirstNameValid || !isEmailValid || !isPhoneNumberValid) {
      toast.error("Please fill in all required fields correctly");
      return;
    }

    try {
      const contactData = {
        firstName,
        lastName,
        email,
        phone: phoneNumber,
        dob,
        companyId: company,
      };

      console.log("Saving contact:", contactData);
      
      const response = await authenticatedFetch(buildExternalUrl("crm/contacts"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create contact";
        try {
          const errorData = await response.json();
          errorMessage = extractErrorMessage(errorData, errorMessage);
        } catch (parseError) {
          const text = await response.text().catch(() => "");
          if (text) {
            errorMessage = text;
          }
        }
        throw new Error(errorMessage);
      }

      await response.json().catch(() => undefined);
      toast.success("Contact created successfully!");
      setIsAdd(false);
    } catch (error) {
      console.error("Error saving contact:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to create contact. Please try again.";
      toast.error(message);
    }
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
          Back
        </Button>
      </div>
      
      {/* Main Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <div className="space-y-6 w-96">
          <div className="space-y-2">
            <Label htmlFor="first-name">First Name *</Label>
            <Input
              id="first-name"
              placeholder="Enter your First Name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (firstNameError) setFirstNameError("");
              }}
              className={firstNameError ? "border-red-500" : ""}
            />
            {firstNameError && (
              <p className="text-sm text-red-500">{firstNameError}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="last-name">Last Name</Label>
            <Input
              id="last-name"
              placeholder="Enter your Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              className={emailError ? "border-red-500" : ""}
            />
            {emailError && (
              <p className="text-sm text-red-500">{emailError}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone-number">Phone Number *</Label>
            <Input
              id="phone-number"
              type="tel"
              placeholder="Enter your Phone Number"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (phoneNumberError) setPhoneNumberError("");
              }}
              className={phoneNumberError ? "border-red-500" : ""}
            />
            {phoneNumberError && (
              <p className="text-sm text-red-500">{phoneNumberError}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              placeholder="Enter your Date of Birth"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger>
                <SelectValue placeholder={loadingCompanies ? "Loading companies..." : "Select a company"} />
              </SelectTrigger>
              <SelectContent>
                {loadingCompanies ? (
                  <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                    Loading companies...
                  </div>
                ) : companies.length > 0 ? (
                  companies.map((companyItem) => (
                    <SelectItem key={companyItem._id} value={companyItem._id}>
                      {companyItem.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                    No companies available
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              className="rounded-full px-6 py-2 bg-black text-white hover:bg-black/80 transition-all duration-300"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
