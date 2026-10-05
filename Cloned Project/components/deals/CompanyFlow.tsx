"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocationStore } from "@/store/locationStore";

export default function CompanyFlow({
  setIsAdd,
}: {
  setIsAdd: (value: boolean) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Validation error states
  const [companyNameError, setCompanyNameError] = useState("");
  const [industryError, setIndustryError] = useState("");
  const [pinCodeError, setPinCodeError] = useState("");
  const [countryError, setCountryError] = useState("");
  const [cityError, setCityError] = useState("");
  const [stateError, setStateError] = useState("");

  // Location store
  const {
    countries,
    states,
    cities,
    selectedCountry,
    selectedState,
    selectedCity,
    isLoadingCountries,
    loadCountries,
    loadStates,
    loadCities,
    setSelectedCountry,
    setSelectedState,
    setSelectedCity,
    resetStates,
    resetCities,
  } = useLocationStore();

  // Load countries on component mount
  useEffect(() => {
    if (countries.length === 0) {
      loadCountries();
    }
  }, [countries.length, loadCountries]);

  // Function to clear all form fields
  const clearAllFields = () => {
    setCompanyName("");
    setIndustry("");
    setWebsite("");
    setPinCode("");
    setAddress("");
    setCountry("");
    setCity("");
    setState("");
    setSelectedCountry(null);
    setSelectedState(null);
    setSelectedCity(null);
    resetStates();
    resetCities();
    // Clear all error states
    setCompanyNameError("");
    setIndustryError("");
    setPinCodeError("");
    setCountryError("");
    setCityError("");
    setStateError("");
  };

  // Validation functions
  const validateCompanyName = (name: string): boolean => {
    if (!name.trim()) {
      setCompanyNameError("Company name is required");
      return false;
    }
    setCompanyNameError("");
    return true;
  };

  const validateIndustry = (industry: string): boolean => {
    if (!industry.trim()) {
      setIndustryError("Industry is required");
      return false;
    }
    setIndustryError("");
    return true;
  };

  const validatePinCode = (pinCode: string): boolean => {
    if (!pinCode.trim()) {
      setPinCodeError("Pin code is required");
      return false;
    }
    setPinCodeError("");
    return true;
  };

  const validateCountry = (): boolean => {
    if (!selectedCountry) {
      setCountryError("Country is required");
      return false;
    }
    setCountryError("");
    return true;
  };

  const validateState = (): boolean => {
    if (!selectedState) {
      setStateError("State is required");
      return false;
    }
    setStateError("");
    return true;
  };

  const validateCity = (): boolean => {
    if (!selectedCity) {
      setCityError("City is required");
      return false;
    }
    setCityError("");
    return true;
  };

  const handleSave = async () => {
    // Validate required fields
    const isCompanyNameValid = validateCompanyName(companyName);
    const isIndustryValid = validateIndustry(industry);
    const isPinCodeValid = validatePinCode(pinCode);
    const isCountryValid = validateCountry();
    const isStateValid = validateState();
    const isCityValid = validateCity();

    if (!isCompanyNameValid || !isIndustryValid || !isPinCodeValid || !isCountryValid || !isStateValid || !isCityValid) {
      toast.error("Please fill in all required fields correctly");
      return;
    }
    try {
      const companyData = {
        companyName,
        industry,
        website,
        pinCode,
        address,
        country: selectedCountry?.name || "",
        city: selectedCity?.name || "",
        state: selectedState?.name || "",
      };

      console.log("Saving company:", companyData);
      
      const response = await authenticatedFetch(buildExternalUrl("crm/companies"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyData),
      });

      if (!response.ok) {
        throw new Error("Failed to save company");
      }

      const result = await response.json();
      console.log("Company saved successfully:", result);
      toast.success("Company created successfully!");
      clearAllFields();
      setIsAdd(false);
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error("Failed to create company");
    }
  };

  return (
    <div className="p-6">
      {/* Back button */}
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          onClick={() => setIsAdd(false)}
          className="mr-4 p-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold">Add New Company</h2>
      </div>

      {/* Company form */}
      <div className="max-w-2xl space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name *</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (companyNameError) setCompanyNameError("");
              }}
              placeholder="Enter company name"
              className={companyNameError ? "border-red-500" : ""}
            />
            {companyNameError && (
              <p className="text-sm text-red-500">{companyNameError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry *</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                if (industryError) setIndustryError("");
              }}
              placeholder="e.g., Software, Manufacturing"
              className={industryError ? "border-red-500" : ""}
            />
            {industryError && (
              <p className="text-sm text-red-500">{industryError}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="www.example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter full address"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="country">Country *</Label>
            <Select
              value={selectedCountry?.isoCode || ""}
              onValueChange={(countryCode) => {
                const country = countries.find(c => c.isoCode === countryCode);
                setSelectedCountry(country || null);
                resetStates();
                resetCities();
                if (country) {
                  loadStates(country.isoCode);
                }
                if (countryError) setCountryError("");
              }}
            >
              <SelectTrigger className={countryError ? "border-red-500" : ""}>
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.isoCode} value={country.isoCode}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {countryError && (
              <p className="text-sm text-red-500">{countryError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Select
              value={selectedState?.isoCode || ""}
              onValueChange={(stateCode) => {
                const state = states.find(s => s.isoCode === stateCode);
                setSelectedState(state || null);
                resetCities();
                if (state && selectedCountry) {
                  loadCities(selectedCountry.isoCode, state.isoCode);
                }
                if (stateError) setStateError("");
              }}
              disabled={!selectedCountry || states.length === 0}
            >
              <SelectTrigger className={stateError ? "border-red-500" : ""}>
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state.isoCode} value={state.isoCode}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stateError && (
              <p className="text-sm text-red-500">{stateError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City *</Label>
            <Select
              value={selectedCity?.name || ""}
              onValueChange={(cityName) => {
                const city = cities.find(c => c.name === cityName);
                setSelectedCity(city || null);
                if (cityError) setCityError("");
              }}
              disabled={!selectedState || cities.length === 0}
            >
              <SelectTrigger className={cityError ? "border-red-500" : ""}>
                <SelectValue placeholder="Select City" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.name} value={city.name}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cityError && (
              <p className="text-sm text-red-500">{cityError}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pin-code">Pin Code *</Label>
          <Input
            id="pin-code"
            value={pinCode}
            onChange={(e) => {
              setPinCode(e.target.value);
              if (pinCodeError) setPinCodeError("");
            }}
            placeholder="Enter pin code"
            className={pinCodeError ? "border-red-500" : ""}
          />
          {pinCodeError && (
            <p className="text-sm text-red-500">{pinCodeError}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <Button
            variant="outline"
            onClick={() => setIsAdd(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!companyName.trim()}
            className="bg-black text-white hover:bg-black/80"
          >
            Create Company
          </Button>
        </div>
      </div>
    </div>
  );
}
