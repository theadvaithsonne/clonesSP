"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

const SchedulingSection = () => {
  return (
    <section className="relative min-h-screen bg-[#0C0C0E] overflow-hidden">
      <div className="grid grid-cols-10 min-h-screen">
        {/* Left Side - 40% Content */}
        <div className="col-span-10 lg:col-span-4 relative flex items-center justify-center py-20 px-6 lg:px-8">
          <div className="relative z-10 space-y-5 w-full max-w-md">
            {/* Badge */}
            <div className="inline-block text-xs font-bold text-[#FBD10D] bg-transparent border-2 border-[#FBD10D] px-4 py-2 rounded-full backdrop-blur-lg shadow-lg shadow-[#FBD10D]/20 hover:bg-[#FBD10D]/10 transition-colors">
              LOBBY MANAGEMENT
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-white leading-tight">
              Scheduling
            </h2>

            <p className="text-sm lg:text-base text-gray-400 leading-relaxed">
              Send your Lobby link to guests to book time with you on your
              calendar. Configure different links with custom time and
              availability settings depending on context. Tailor your Lobby to
              look like your company. Best of all, you can allow your guests to
              Drop-In which appears automatically if you&apos;re available.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/login">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#FBD10D] to-[#FBA70A] text-white px-5 py-2 text-sm"
                >
                  Get Started
                </Button>
              </Link>
              <Link href="https://maps.garage.app/" target="_blank">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/5 hover:bg-white/40 border-white/20 text-white px-5 py-2 text-sm"
                >
                  Garage Maps
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Side - 60% Image */}
        <div className="col-span-10 lg:col-span-6 relative py-20 px-6 lg:px-8">
          <div className="h-full relative flex items-center justify-center">
            {/* Image Container with Glass Effect */}
            <div className="relative w-full max-w-4xl">
              {/* Subtle glow around image */}
              <div className="absolute -inset-4 bg-gradient-to-r from-[#FBD10D]/20 via-[#FBA70A]/30 to-[#FBD10D]/20 rounded-2xl blur-lg opacity-50" />

              <div className="relative rounded-2xl overflow-hidden border border-[#FBD10D]/20 shadow-2xl shadow-[#FBD10D]/20">
                <Image
                  src="https://roamstatic.com/website/hero-lobby-settings@2x-GZ3ROBHE.png"
                  alt="Scheduling Lobby Settings Interface"
                  width={800}
                  height={600}
                  className="w-full h-auto object-contain"
                  priority
                />

                {/* Subtle overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#FBD10D]/5 via-transparent to-[#FBA70A]/5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SchedulingSection;
