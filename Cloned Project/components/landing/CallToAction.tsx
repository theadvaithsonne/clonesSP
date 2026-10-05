import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const CallToActionSection = () => {
  return (
    <section className="relative py-24 bg-[#0C0C0E] overflow-hidden">
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-block text-xs font-bold text-[#FBD10D] bg-transparent border-2 border-[#FBD10D] px-4 py-2 rounded-full backdrop-blur-lg shadow-lg shadow-[#FBD10D]/20 hover:bg-[#FBD10D]/10 transition-colors mb-8">
          GET STARTED TODAY
        </div>

        {/* Main Heading */}
        <h2
          className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight"
          style={{
            textShadow:
              "0 0 30px rgba(75, 0, 130, 0.3), 0 0 60px rgba(75, 0, 130, 0.1)",
          }}
        >
          Ready to Grow Your{" "}
          <span className="bg-gradient-to-r from-[#FBD10D] via-[#FBA70A] to-[#FBD10D] bg-clip-text text-transparent">
            Business?
          </span>
        </h2>

        {/* Subtitle */}
        <p className="text-xl lg:text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
          Join thousands of teams already using Garage 2.0 to transform their
          collaboration and productivity.
        </p>

        {/* Hero-Style Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Link href="/login">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#FBD10D] to-[#FBA70A] hover:from-[#5D1A8B] hover:to-[#7B68EE] text-white shadow-2xl shadow-[#FBD10D]/50 hover:shadow-[#FBD10D]/70 transition-all duration-300 transform hover:scale-105 border border-[#FBD10D]/50 hover:border-[#FBD10D]/70 px-12 py-4 text-lg font-bold min-w-[200px] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              Get Started
            </Button>
          </Link>
          <Link href="https://maps.garage.app/" target="_blank">
            <Button
              variant="outline"
              size="lg"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-white/20 px-12 py-4 text-lg font-bold min-w-[200px]"
            >
              Garage Maps
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CallToActionSection;
