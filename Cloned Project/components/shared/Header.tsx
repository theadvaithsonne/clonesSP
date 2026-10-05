"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navigationItems = [
    {
      title: "About Us",
      href: "/about",
    },
    {
      title: "Pricing",
      href: "/pricing",
    },
    {
      title: "Solutions",
      href: "/solutions",
      hasDropdown: true,
      items: [
        { title: "For Teams", href: "/solutions/teams" },
        { title: "For Enterprise", href: "/solutions/enterprise" },
        { title: "For Startups", href: "/solutions/startups" },
      ],
    },
    {
      title: "Partner",
      href: "/partner",
    },
  ];

  const handleDropdownToggle = (itemTitle: string) => {
    setActiveDropdown(activeDropdown === itemTitle ? null : itemTitle);
  };

  const handleMouseLeave = () => {
    setActiveDropdown(null);
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all glass-pro duration-300 ease-in-out",
        isScrolled
          ? "backdrop-blur-xl bg-[#0C0C0E]/80 border-b border-white/10 shadow-2xl shadow-brand/20"
          : "backdrop-blur-lg bg-[#0C0C0E]/60"
      )}
    >
      {/* Custom gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-brand/5 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0C0C0E]/10 to-[#0C0C0E]/30 pointer-events-none" />

      <nav className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center space-x-2">
            <Image
              src="logo.svg"
              alt="Garage 2.0 Logo"
              width={140}
              height={82}
              style={{ height: "auto" }}
            />
          </Link>

          {/* Desktop Navigation */}
          {/* <div className="hidden lg:flex items-center space-x-1">
            {navigationItems.map((item) => (
              <div
                key={item.title}
                className="relative"
                onMouseEnter={() =>
                  item.hasDropdown && setActiveDropdown(item.title)
                }
                onMouseLeave={handleMouseLeave}
              >
                {item.hasDropdown ? (
                  <>
                    <button
                      className="flex items-center h-10 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-transparent hover:bg-white/5 rounded-lg border border-transparent hover:border-brand/30 transition-all duration-200 backdrop-blur-sm hover:shadow-lg hover:shadow-brand/10"
                      onClick={() => handleDropdownToggle(item.title)}
                    >
                      {item.title}
                      <ChevronDown
                        className={cn(
                          "ml-1 h-3 w-3 transition duration-200",
                          activeDropdown === item.title && "rotate-180"
                        )}
                      />
                    </button>

                    {activeDropdown === item.title && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-[#0C0C0E]/95 backdrop-blur-xl border border-brand/20 shadow-2xl shadow-brand/30 rounded-lg py-2 z-50">
                        {item.items?.map((subItem) => (
                          <Link
                            key={subItem.title}
                            href={subItem.href}
                            className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-brand/10 transition-colors duration-200"
                            onClick={() => setActiveDropdown(null)}
                          >
                            {subItem.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className="h-10 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-transparent hover:bg-white/5 rounded-lg border border-transparent hover:border-brand/30 transition-all duration-200 backdrop-blur-sm inline-flex items-center justify-center whitespace-nowrap hover:shadow-lg hover:shadow-brand/10"
                  >
                    {item.title}
                  </Link>
                )}
              </div>
            ))}
          </div> */}

          {/* Right side buttons */}
          <div className="flex items-center space-x-3">
            {/* Existing Members Dropdown - Desktop */}
            {/* <div
              className="hidden sm:block relative"
              onMouseEnter={() => setActiveDropdown("members")}
              onMouseLeave={handleMouseLeave}
            >
              <button
                className="flex items-center h-10 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-brand/40 transition-all duration-200 backdrop-blur-sm hover:shadow-lg hover:shadow-brand/20"
                onClick={() => handleDropdownToggle("members")}
              >
                Existing Members
                <ChevronDown
                  className={cn(
                    "ml-1 h-3 w-3 transition duration-200",
                    activeDropdown === "members" && "rotate-180"
                  )}
                />
              </button>

              {activeDropdown === "members" && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-[#0C0C0E]/95 backdrop-blur-xl border border-brand/20 shadow-2xl shadow-brand/30 rounded-lg py-2 z-50">
                  <Link
                    href="/login"
                    className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-brand/10 transition-colors duration-200"
                    onClick={() => setActiveDropdown(null)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-brand/10 transition-colors duration-200"
                    onClick={() => setActiveDropdown(null)}
                  >
                    Dashboard
                  </Link>
                </div>
              )}
            </div> */}
            <Link href="/login">
              <Button
                variant="outline"
                size="sm"
                className="hidden cursor-pointer sm:inline-flex bg-transparent border-brand/40 text-gray-300 hover:bg-brand/10 hover:border-brand/60 hover:text-white backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:shadow-brand/20"
              >
                Login
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className="bg-gradient-to-r from-brand to-brand-2  text-white shadow-xl shadow-brand/40 hover:shadow-brand/60 transition-all duration-200 transform hover:scale-105 border border-brand/50 hover:border-brand/70"
              >
                Get Started
              </Button>
            </Link>
            {/* Book Demo Button */}
            <Link href="https://maps.garage.app/" target="_blank">
              <Button
                variant="outline"
                size="sm"
                className="hidden cursor-pointer sm:inline-flex bg-transparent border-brand/40 text-gray-300 hover:bg-brand/10 hover:border-brand/60 hover:text-white backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:shadow-brand/20"
              >
                Garage Maps
              </Button>
            </Link>
            {/* Free Trial Button */}
            {/* Mobile Menu Toggle */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-brand/30 hover:border-brand/50 text-gray-300 hover:text-white"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[300px] bg-[#0C0C0E]/95 backdrop-blur-xl border-l border-brand/20 text-white"
              >
                <div className="flex flex-col space-y-4 mt-8">
                  {navigationItems.map((item) => (
                    <div key={item.title}>
                      <Link
                        href={item.href}
                        className="block px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-brand/10 rounded-lg transition-all duration-200 border border-transparent hover:border-brand/30"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.title}
                      </Link>
                      {item.items && (
                        <div className="ml-4 space-y-1 mt-2">
                          {item.items.map((subItem) => (
                            <Link
                              key={subItem.title}
                              href={subItem.href}
                              className="block px-4 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-brand/5 rounded-md transition-all duration-200 border border-transparent hover:border-brand/20"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              {subItem.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="border-t border-brand/20 pt-4 space-y-3">
                    <Link href="/login">
                      <Button
                        variant="outline"
                        className="w-full bg-transparent border-brand/40 text-gray-300 hover:bg-brand/10 hover:text-white hover:border-brand/60"
                      >
                        Login
                      </Button>
                    </Link>
                    <Link href="/book-demo">
                      <Button
                        variant="outline"
                        className="w-full bg-transparent border-brand/40 text-gray-300 hover:bg-brand/10 hover:text-white hover:border-brand/60"
                      >
                        Book Demo
                      </Button>
                    </Link>
                    <Button className="w-full bg-gradient-to-r from-brand to-brand-2  border border-brand/50 shadow-lg shadow-brand/30">
                      Free Trial
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
