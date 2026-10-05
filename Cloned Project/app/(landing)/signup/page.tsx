"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SignupPage = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Email submitted:", email);
  };

  return (
    <div className="min-h-screen bg-[#0C0C0E] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-md">
        {/* Signup Form Card */}
        <div className="glass-max mt-6 sm:mt-10 bg-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-2xl shadow-[#FBD10D]/20">
          {/* Form Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Start Your 60 Day Free Trial
            </h2>
            <p className="text-sm sm:text-base text-gray-400">No Credit Card Required</p>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <Input
                type="email"
                placeholder="Work Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-[#FBD10D] focus:border-transparent"
                required
              />
            </div>

            <Button className="w-full rounded-lg bg-gradient-to-r from-[#FBD10D] to-[#FBA70A] hover:from-[#5D1A8B] hover:to-[#7B68EE] border border-[#FBD10D]/50 shadow-lg shadow-[#FBD10D]/30 text-sm sm:text-base py-2.5 sm:py-3">
              Continue
            </Button>
          </form>

          {/* Divider */}
          <div className="my-4 sm:my-6 flex items-center">
            <div className="flex-1 border-t border-gray-600"></div>
            <div className="px-3 sm:px-4 text-gray-400 text-xs sm:text-sm">Or</div>
            <div className="flex-1 border-t border-gray-600"></div>
          </div>

          {/* Social Login Options */}
          <div className="space-y-2.5 sm:space-y-3">
            <Button
              variant="outline"
              className="w-full bg-white/5 text-white hover:bg-gray-600 font-medium py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 sm:space-x-3 text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>

            <Button
              variant="outline"
              className="w-full bg-white/5 text-white hover:bg-gray-600 font-medium py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 sm:space-x-3 text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#F25022" d="M0 0h11.377v11.372H0z" />
                <path fill="#00A4EF" d="M12.623 0H24v11.372H12.623z" />
                <path fill="#7FBA00" d="M0 12.628h11.377V24H0z" />
                <path fill="#FFB900" d="M12.623 12.628H24V24H12.623z" />
              </svg>
              <span>Continue with Microsoft</span>
            </Button>

            <Button
              variant="outline"
              className="w-full bg-white/5 text-white hover:bg-gray-600 font-medium py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 sm:space-x-3 text-sm sm:text-base"
            >
              <div className="w-4 h-4 sm:w-5 sm:h-5 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] sm:text-xs font-bold">R</span>
              </div>
              <span>Continue with Rippling</span>
            </Button>
          </div>

          {/* Terms and Privacy */}
          <div className="mt-4 sm:mt-6 text-center text-[10px] sm:text-xs text-gray-500 px-2">
            By proceeding, you are agreeing to the{" "}
            <a
              href="/terms"
              className="text-gray-400 underline hover:text-white"
            >
              Terms of Use
            </a>
            ,{" "}
            <a
              href="/privacy"
              className="text-gray-400 underline hover:text-white"
            >
              Privacy Policy
            </a>
            , and{" "}
            <a
              href="/enterprise"
              className="text-gray-400 underline hover:text-white"
            >
              Enterprise SaaS Agreement
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
