"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Upload, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const ProfileSetupPage = () => {
  const [formData, setFormData] = useState({
    name: "Saroj Kumar",
    companyName: "",
    website: "",
    jobTitle: "",
    postalCode: "",
    city: "",
    state: "",
    country: "",
  });
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [postalCodeLoading, setPostalCodeLoading] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState("");
  const postalCodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resolvePostalCode = async (pincode: string) => {
    if (pincode.length < 3) {
      setPostalCodeError("");
      return;
    }
    setPostalCodeLoading(true);
    setPostalCodeError("");
    try {
      const res = await api<{
        city: string;
        state: string;
        country: string;
        latitude: number;
        longitude: number;
      }>(`/org/resolve-pincode?pincode=${encodeURIComponent(pincode)}`, {
        method: "GET",
      });
      setFormData((prev) => ({
        ...prev,
        city: res.city || "",
        state: res.state || "",
        country: res.country || "",
      }));
    } catch {
      setPostalCodeError("Could not resolve postal code. Please fill manually.");
    } finally {
      setPostalCodeLoading(false);
    }
  };

  const handlePostalCodeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, postalCode: value }));
    if (postalCodeTimerRef.current) clearTimeout(postalCodeTimerRef.current);
    if (value.length >= 3) {
      postalCodeTimerRef.current = setTimeout(() => {
        resolvePostalCode(value);
      }, 800);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Profile data:", formData);
  };

  return (
    <div className="min-h-screen bg-[#0C0C0E] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        {/* Profile Setup Form Card */}
        <div className="glass-max my-8 sm:my-20 bg-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-2xl shadow-[#FBD10D]/20">
          {/* Form Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Let&apos;s set up your badge
            </h2>
          </div>

          {/* Avatar Upload */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-[#FBD10D]/50">
                {avatarImage ? (
                  <Image
                    src={avatarImage}
                    alt="Profile"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-600 flex items-center justify-center">
                    <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-[#FBD10D] rounded-full border-2 border-gray-800 flex items-center justify-center cursor-pointer transition-transform hover:scale-110">
                <Camera className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Name and Company Name - Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-white text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                  Name
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-white text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                  Company Name
                </label>
                <Input
                  type="text"
                  placeholder="Company Name"
                  value={formData.companyName}
                  onChange={(e) =>
                    handleInputChange("companyName", e.target.value)
                  }
                  className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Website - Full Width */}
            <div>
              <label className="block text-white text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                Website
              </label>
              <Input
                type="url"
                placeholder="Website"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
                className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
              />
            </div>

            {/* Job Title and Pin Code - Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-white text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                  Job Title
                </label>
                <Input
                  type="text"
                  placeholder="Job Title"
                  value={formData.jobTitle}
                  onChange={(e) =>
                    handleInputChange("jobTitle", e.target.value)
                  }
                  className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-white text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                  Postal Code
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Enter postal code"
                    value={formData.postalCode}
                    onChange={(e) => handlePostalCodeChange(e.target.value)}
                    className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                  />
                  {postalCodeLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#FBD10D]" />
                  )}
                </div>
                {postalCodeError && (
                  <p className="text-xs text-red-400 mt-1">{postalCodeError}</p>
                )}
              </div>
            </div>

            {/* City, State, Country - Three Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <label className="block text-white text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                  City
                </label>
                <Input
                  type="text"
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-white text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                  State
                </label>
                <Input
                  type="text"
                  placeholder="State"
                  value={formData.state}
                  onChange={(e) => handleInputChange("state", e.target.value)}
                  className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-white text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                  Country
                </label>
                <Input
                  type="text"
                  placeholder="Country"
                  value={formData.country}
                  onChange={(e) => handleInputChange("country", e.target.value)}
                  className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                />
              </div>
            </div>

            <Button className="w-full rounded-lg bg-gradient-to-r from-[#FBD10D] to-[#FBA70A] hover:from-[#5D1A8B] hover:to-[#7B68EE] border border-[#FBD10D]/50 shadow-lg shadow-[#FBD10D]/30 text-sm sm:text-base py-2.5 sm:py-3">
              Continue
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
