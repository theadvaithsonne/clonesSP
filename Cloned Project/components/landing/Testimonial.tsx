"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

const ClientTestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const testimonials = [
    {
      id: 1,
      name: "Michael Arrington",
      username: "@arrington",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      review:
        "My two most recommended productivity hacks: 1. Use @Garage 2.0 instead of traditional tools. Thank me later. 2. If you have a startup, use @Garage 2.0 for your OfficeStream.",
      platform: "𝕏",
      verified: true,
    },
    {
      id: 2,
      name: "Sarah Chen",
      username: "@sarahbuilds",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      review:
        "Use @Garage 2.0 for seamless collaboration. The AI-powered meeting summaries alone have saved our team 10+ hours per week. Best investment we've made for remote work.",
      platform: "𝕏",
      verified: true,
    },
    {
      id: 3,
      name: "Alex Rodriguez",
      username: "@alextech",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      review:
        "@Garage 2.0 lets you set custom entrance sounds so I set mine to epic battle music. Now every meeting feels like I'm entering a boss fight. 10/10 would recommend.",
      platform: "𝕏",
      verified: false,
    },
    {
      id: 4,
      name: "Emily Watson",
      username: "@emilywatson",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      review:
        "Switched our entire company to @Garage 2.0 last month. The theater mode for all-hands meetings is incredible. Feels like we're all in the same room again.",
      platform: "𝕏",
      verified: true,
    },
    {
      id: 5,
      name: "David Kim",
      username: "@davidkimtech",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
      review:
        "The drop-in meetings feature is genius. No more 'quick sync' calls that turn into hour-long discussions. Just knock and chat when needed. Revolutionary.",
      platform: "𝕏",
      verified: true,
    },
    {
      id: 6,
      name: "Lisa Thompson",
      username: "@lisadesigns",
      avatar:
        "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop&crop=face",
      review:
        "Love how @Garage 2.0 makes remote work feel human again. The OfficeStream map showing everyone's presence is exactly what distributed teams needed.",
      platform: "𝕏",
      verified: false,
    },
  ];

  // Auto-slide with pause on hover
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === testimonials.length - 3 ? 0 : prevIndex + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [testimonials.length, isPaused]);

  const getVisibleTestimonials = () => {
    const visible = [];
    for (let i = 0; i < 3; i++) {
      const index = (currentIndex + i) % testimonials.length;
      visible.push(testimonials[index]);
    }
    return visible;
  };

  return (
    <section className="relative py-20 bg-[#0C0C0E] overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-block text-xs font-bold text-[#FBD10D] bg-transparent border-2 border-[#FBD10D] px-4 py-2 rounded-full backdrop-blur-lg shadow-lg shadow-[#FBD10D]/20 hover:bg-[#FBD10D]/10 transition-colors mb-6">
            CLIENT TESTIMONIALS
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            What Our Users Say
          </h2>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            See how Garage 2.0 is transforming the way teams collaborate and
            work together.
          </p>
        </div>

        {/* Testimonials Slider */}
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getVisibleTestimonials().map((testimonial, index) => (
              <div
                key={`${testimonial.id}-${currentIndex}`}
                className="relative group"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.2}s both`,
                }}
              >
                {/* Glow Effect */}
                {/* <div className="absolute -inset-2 bg-gradient-to-r from-[#FBD10D]/20 via-[#FBA70A]/30 to-[#FBD10D]/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" /> */}

                {/* Card */}
                <div className="relative glass-max border border-[#FBD10D]/20 rounded-2xl p-6 hover:border-[#FBD10D]/40 transition-all duration-300 transform group-hover:scale-105 min-h-[300px] flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-white text-lg opacity-50">
                      {testimonial.platform}
                    </div>
                    {testimonial.verified && (
                      <div className="text-blue-400 text-sm">✓</div>
                    )}
                  </div>

                  {/* Review Text */}
                  <div className="flex-1 mb-6">
                    <p className="text-gray-300 leading-relaxed text-sm">
                      {testimonial.review}
                    </p>
                  </div>

                  {/* User Info */}
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Image
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        width={48}
                        height={48}
                        className="rounded-full border-2 border-[#FBD10D]/30"
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1">
                        <h4 className="text-white font-semibold text-sm">
                          {testimonial.name}
                        </h4>
                        {testimonial.verified && (
                          <div className="text-blue-400 text-xs">✓</div>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs">
                        {testimonial.username}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-center items-center mt-8 space-x-4">
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  prev === 0 ? testimonials.length - 3 : prev - 1
                )
              }
              className="w-10 h-10 rounded-full bg-white/10 border border-[#FBD10D]/30 text-white hover:bg-[#FBD10D]/20 transition-colors flex items-center justify-center"
            >
              ←
            </button>

            {/* Indicators */}
            <div className="flex space-x-2">
              {Array.from({ length: testimonials.length - 2 }).map(
                (_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentIndex
                        ? "bg-[#FBD10D] w-6"
                        : "bg-gray-600 hover:bg-gray-500"
                    }`}
                  />
                )
              )}
            </div>

            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  prev === testimonials.length - 3 ? 0 : prev + 1
                )
              }
              className="w-10 h-10 rounded-full bg-white/10 border border-[#FBD10D]/30 text-white hover:bg-[#FBD10D]/20 transition-colors flex items-center justify-center"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
};

export default ClientTestimonialsSection;
