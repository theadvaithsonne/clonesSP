"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Play, Volume2, Star, Users, ArrowRight } from "lucide-react";

const HeroSection = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-orange-50/30 to-yellow-50/40">
      {/* Subtle gradient orbs for depth */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-200/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-20">
        <div
          className={`text-center max-w-4xl mx-auto transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Member Count Badge */}
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm">
              <div className="flex -space-x-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 border-2 border-white" />
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-yellow-500 border-2 border-white" />
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-500 to-orange-400 border-2 border-white" />
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-yellow-400 border-2 border-white" />
              </div>
              <span className="text-sm text-gray-600">
                Join <span className="font-semibold text-orange-500">500+</span> teams
              </span>
            </div>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
            Transform Your Workspace with{" "}
            <span className="bg-gradient-to-r from-[#FBD10D] via-[#FBA70A] to-[#F97316] bg-clip-text text-transparent">
              Garage 2.0
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Experience the future of remote work with AI-powered virtual offices,
            seamless video collaboration, and a thriving community of innovators.
          </p>

          {/* 3D Device Mockup */}
          <div className="relative mx-auto max-w-3xl mb-8">
            {/* Device Shadow */}
            <div className="absolute inset-x-8 bottom-0 h-8 bg-gray-900/20 blur-2xl rounded-full" />

            {/* Device Container */}
            <div className="relative bg-gradient-to-b from-gray-700 via-gray-800 to-gray-900 rounded-3xl p-1 shadow-2xl">
              {/* Device Bezel */}
              <div className="bg-gradient-to-br from-[#8B4513] via-[#A0522D] to-[#6B3410] rounded-2xl overflow-hidden">
                {/* Screen Area */}
                <div className="relative aspect-video bg-gradient-to-br from-[#722F37] via-[#5C2428] to-[#4A1C20] m-2 rounded-xl overflow-hidden">
                  {/* Subtle screen reflection */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />

                  {/* Notch/Camera */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-2 bg-gray-900/80 rounded-b-lg" />

                  {/* Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="group relative">
                      {/* Outer ring */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#FBD10D] to-[#FBA70A] rounded-full scale-125 opacity-30 group-hover:scale-150 group-hover:opacity-40 transition-all duration-300" />
                      {/* Play button */}
                      <div className="relative w-20 h-20 bg-gradient-to-br from-[#FBD10D] to-[#FBA70A] rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 group-hover:scale-110 transition-all duration-300">
                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-gray-800 ml-1 fill-gray-800" />
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Bottom Info Bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-white/70 text-xs mb-1">Watch our workspace tour</p>
                        <p className="text-white font-medium text-sm">See What You'll Get Inside</p>
                      </div>
                      <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
                        <Volume2 className="w-4 h-4 text-white/80" />
                        <span className="text-white/90 text-sm font-medium">2:30</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats below video */}
          <div className="flex items-center justify-center gap-6 mb-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>1.2K active this week</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span>Rated 5/5 by users</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link href="/login">
              <Button
                size="lg"
                className="w-full sm:w-auto cursor-pointer bg-gradient-to-r from-[#FBD10D] to-[#FBA70A] hover:from-[#FBA70A] hover:to-[#F97316] text-gray-900 font-semibold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 transform hover:scale-105 px-8 py-6 text-base rounded-full min-w-[200px] group"
              >
                Start Your Journey
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="https://maps.garage.app/" target="_blank">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto cursor-pointer bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 hover:shadow-lg px-8 py-6 text-base font-semibold rounded-full min-w-[200px]"
              >
                Explore Garage Maps
              </Button>
            </Link>
          </div>

          {/* Bottom Stats */}
          <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span>4.9/5 from 500+ reviews</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span>Active community support</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
