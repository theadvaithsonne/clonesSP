"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const MapSection = () => {
  return (
    <section className="relative min-h-screen bg-[#0C0C0E] overflow-hidden">
      <div className="grid grid-cols-10 min-h-screen">
        {/* Left Side - 40% Content */}
        <div className="col-span-10 lg:col-span-4 relative flex items-center justify-center py-20 px-6 lg:px-8">
          <div className="relative z-10 space-y-5 w-full max-w-md">
            {/* Updated Badge - Option 5 Outlined Style */}
            <div className="inline-block text-xs font-bold text-[#FBD10D] bg-transparent border-2 border-[#FBD10D] px-4 py-2 rounded-full backdrop-blur-lg shadow-lg shadow-[#FBD10D]/20 hover:bg-[#FBD10D]/10 transition-colors">
              LIVE COLLABORATION
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-white leading-tight">
              Map
            </h2>

            <p className="text-sm lg:text-base text-gray-400 leading-relaxed">
              Company Visualization with Live Presence on the Map. A live view
              of who&apos;s in the office, who&apos;s meeting with who,
              who&apos;s talking, 3D chats as they happen, music people are
              listening to.
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

        {/* Right Side - 60% Full Coverage Video */}
        <div className="col-span-10 lg:col-span-6 relative py-20">
          <div className="h-full relative overflow-hidden">
            <video
              className="w-full h-full object-cover"
              style={{
                marginTop: "-40px",
                height: "calc(100% + 40px)",
              }}
              autoPlay
              muted
              loop
              playsInline
            >
              <source src="/first.mp4" type="video/mp4" />
            </video>

            {/* Simple Brand Badge */}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MapSection;
