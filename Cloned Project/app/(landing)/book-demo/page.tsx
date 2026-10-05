"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react";

const BookDemoPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companySize: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Demo booking data:", formData);
  };

  const companySizes = [
    "1-10 employees",
    "11-50 employees",
    "51-200 employees",
    "201-500 employees",
    "500+ employees",
  ];

  return (
    <div className="min-h-screen bg-[#0C0C0E] flex items-center justify-center px-4">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FBD10D]/10 via-transparent to-[#FBA70A]/10" />
        <div className="absolute top-20 left-20 w-6 h-6 bg-[#FBD10D]/20 rounded-full animate-pulse blur-sm" />
        <div className="absolute bottom-40 right-32 w-8 h-8 bg-[#FBA70A]/15 rounded-full animate-bounce blur-md" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Demo Booking Form Card */}
        <div className="glass-max bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl shadow-[#FBD10D]/30">
          {/* Form Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-3">
              Book Your Live Demo
            </h2>
          </div>

          {/* Demo Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div className="relative">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                  required
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
              </div>
            </div>

            {/* Work Email Field */}
            <div className="relative">
              <div className="relative">
                <Input
                  type="email"
                  placeholder="Work Email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                  required
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
              </div>
            </div>

            {/* Company Size Dropdown */}
            <div className="relative">
              <div className="relative">
                <Select
                  onValueChange={(value) =>
                    handleInputChange("companySize", value)
                  }
                >
                  <SelectTrigger className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent">
                    <SelectValue
                      placeholder="Company Size"
                      className="text-gray-400"
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl">
                    {companySizes.map((size) => (
                      <SelectItem
                        key={size}
                        value={size}
                        className="text-white hover:bg-white/10 focus:bg-white/10 rounded-lg"
                      >
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
              </div>
            </div>

            <Button className="w-full rounded-lg bg-gradient-to-r from-[#FBD10D] to-[#FBA70A] hover:from-[#5D1A8B] hover:to-[#7B68EE] border border-[#FBD10D]/50 shadow-lg shadow-[#FBD10D]/30">
              Continue
            </Button>
          </form>

          {/* Terms and Privacy */}
          <div className="mt-6 text-center text-xs text-gray-500 leading-relaxed">
            By proceeding, you are agreeing to the{" "}
            <a
              href="/terms"
              className="text-gray-400 underline hover:text-white transition-colors"
            >
              Terms of Use
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="text-gray-400 underline hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDemoPage;
