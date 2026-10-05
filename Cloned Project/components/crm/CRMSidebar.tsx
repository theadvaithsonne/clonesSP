"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { getUserData, authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { useTheme } from "next-themes";
import {
  Gauge,
  Users,
  Filter,
  Contact,
  Building2,
  Package,
  LayoutTemplate,
  Mail,
  ChevronDown,
  LogOut,
  HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/store/uiStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { requestCmsAccess } from "@/lib/cms/accessGate";

export default function CRMSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const [userData, setUserData] = useState<any>(null);
  const [leadsCount, setLeadsCount] = useState<number | null>(null);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  useEffect(() => {
    const currentUserData = getUserData();
    if (currentUserData) {
      setUserData(currentUserData);
    }
  }, []);

  useEffect(() => {
    const fetchLeadsCount = async () => {
      try {
        const response = await authenticatedFetch(
          buildExternalUrl("crm/leads/count")
        );
        if (response.ok) {
          const data = await response.json();
          const leadsCountResponse = data.data || data;
          const count = leadsCountResponse?.count || 0;
          setLeadsCount(count);
        }
      } catch (error) {
        console.error("Error fetching leads count:", error);
        setLeadsCount(0);
      }
    };

    fetchLeadsCount();
  }, []);

  const handleSignOut = () => {
    try {
      // Clear all cookies
      const allCookies = Cookies.get();
      Object.keys(allCookies).forEach((cookieName) => {
        Cookies.remove(cookieName);
        Cookies.remove(cookieName, { path: "/" });
        Cookies.remove(cookieName, { path: "/", domain: window.location.hostname });
        Cookies.remove(cookieName, { path: "/", domain: `.${window.location.hostname}` });
      });

      // Clear localStorage and sessionStorage while preserving Facebook Leads connection cache
      if (typeof window !== "undefined") {
        const facebookLeadsSession = localStorage.getItem("facebook_leads_integration");
        localStorage.clear();
        if (facebookLeadsSession) {
          localStorage.setItem("facebook_leads_integration", facebookLeadsSession);
        }
        sessionStorage.clear();
      }
    } catch (error) {
      console.error("Error clearing cookies during sign out:", error);
    } finally {
      // Redirect to login page
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  return (
    <div className={`${sidebarCollapsed ? "w-16" : "w-64"} border-r flex flex-col transition-all duration-300 ${theme === "color"
      ? "bg-[#0A0A1E] border-[rgba(0,255,255,0.2)] text-white"
      : "border-border bg-background text-foreground dark:border-gray-800"
      }`}>
      {/* Header */}
      <div
        className={`p-4 border-b cursor-pointer ${theme === "color"
          ? "border-[rgba(0,255,255,0.2)] hover:bg-[rgba(0,255,255,0.05)]"
          : "border-border/80 dark:border-gray-800 hover:bg-muted/50"
          }`}
        onClick={toggleSidebar}
      >
        <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-[10px]"}`}>
          {/* Logo Container */}
          <div className="w-8 h-8 rounded-[8px] bg-gradient-to-b from-[#7b68ee] to-[#a78bfa] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] flex items-center justify-center shrink-0">
            <div className="w-5 h-5 relative">
              <Image
                src="https://nela-app.s3.us-east-1.amazonaws.com/uploads/1761135676122-dealsimg.avif"
                alt="Deals Logo"
                width={20}
                height={20}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          {/* Text */}
          {!sidebarCollapsed && (
            <h2 className={`text-[16px] leading-[24px] font-bold ${theme === "dark" ? "text-[#9ca3af]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#4b5563]"
              }`}>Deals</h2>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 pt-3 pl-[8px] pr-0 pb-0">
        <div className="flex flex-col gap-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/">
                  <div className={`h-9 flex items-center ${sidebarCollapsed ? "justify-center pl-0" : "gap-2 pl-[10px]"} ${(pathname === "/" || pathname === "/deals") ? "pr-[10px] mr-[8px]" : "pr-0"} py-0 rounded-[6px] cursor-pointer transition-colors ${pathname === "/" || pathname === "/deals"
                    ? theme === "dark"
                      ? "bg-[#2a2a2a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                      : theme === "color"
                        ? "bg-[rgba(0,255,255,0.1)] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                        : "bg-[#f3f4f6] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                    : theme === "color" ? "hover:bg-[rgba(0,255,255,0.05)]" : "hover:bg-muted/50"
                    }`}>
                    <Gauge className={`h-4 w-4 shrink-0 ${pathname === "/" || pathname === "/deals"
                      ? theme === "dark" ? "text-[#e5e5e5]" : theme === "color" ? "text-[#0ff]" : "text-[#1f1f1f]"
                      : theme === "dark" ? "text-[#9ca3af]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#4b5563]"
                      }`} />
                    {!sidebarCollapsed && (
                      <span className={`text-[13px] leading-[19.5px] ${pathname === "/" || pathname === "/deals"
                        ? theme === "dark"
                          ? "font-bold text-[#e5e5e5]"
                          : theme === "color"
                            ? "font-bold text-[#0ff]"
                            : "font-bold text-[#1f1f1f]"
                        : theme === "dark"
                          ? "font-normal text-[#9ca3af]"
                          : theme === "color"
                            ? "font-normal text-[rgba(0,255,255,0.9)]"
                            : "font-normal text-[#4b5563]"
                        }`}>
                        Dashboard
                      </span>
                    )}
                  </div>
                </Link>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" align="start">
                  Dashboard
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/leads">
                  <div className={`h-9 flex items-center ${sidebarCollapsed ? "justify-center pl-0 relative" : "gap-2 pl-[10px]"} ${(pathname === "/leads" || pathname.startsWith("/leads/")) ? "pr-[10px] mr-[8px]" : "pr-0"} py-0 rounded-[6px] cursor-pointer transition-colors ${pathname === "/leads" || pathname.startsWith("/leads/")
                    ? theme === "dark"
                      ? "bg-[#2a2a2a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                      : theme === "color"
                        ? "bg-[rgba(0,255,255,0.1)] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                        : "bg-[#f3f4f6] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                    : theme === "color" ? "hover:bg-[rgba(0,255,255,0.05)]" : "hover:bg-muted/50"
                    }`}>
                    <Users className={`h-4 w-4 shrink-0 ${pathname === "/leads" || pathname.startsWith("/leads/")
                      ? theme === "dark" ? "text-[#e5e5e5]" : theme === "color" ? "text-[#0ff]" : "text-[#1f1f1f]"
                      : theme === "dark" ? "text-[#9ca3af]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#4b5563]"
                      }`} />
                    {!sidebarCollapsed && (
                      <>
                        <span className={`text-[13px] leading-[19.5px] ${pathname === "/leads" || pathname.startsWith("/leads/")
                          ? theme === "dark"
                            ? "font-bold text-[#e5e5e5]"
                            : theme === "color"
                              ? "font-bold text-[#0ff]"
                              : "font-bold text-[#1f1f1f]"
                          : theme === "dark"
                            ? "font-normal text-[#9ca3af]"
                            : theme === "color"
                              ? "font-normal text-[rgba(0,255,255,0.9)]"
                              : "font-normal text-[#4b5563]"
                          }`}>
                          Leads
                        </span>
                        {leadsCount !== null && (
                          <div className={`${theme === "dark" ? "bg-[#8b7aff]" : theme === "color" ? "bg-[#0ff]" : "bg-[#7b68ee]"
                            } h-5 rounded-[6px] px-[6px] py-[2px] flex items-center justify-center ml-auto mr-[8px] shrink-0`}>
                            <span className={`text-[11px] font-bold leading-[16.5px] ${theme === "color" ? "text-[#0a0e27]" : "text-white"
                              }`}>
                              {leadsCount}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {sidebarCollapsed && leadsCount !== null && (
                      <div className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-white">{leadsCount > 99 ? '99+' : leadsCount}</span>
                      </div>
                    )}
                  </div>
                </Link>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" align="start">
                  Leads {leadsCount !== null && `(${leadsCount})`}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/funnel">
                  <div className={`h-9 flex items-center ${sidebarCollapsed ? "justify-center pl-0" : "gap-2 pl-[10px]"} ${(pathname === "/funnel" || pathname.startsWith("/funnel/")) ? "pr-[10px] mr-[8px]" : "pr-0"} py-0 rounded-[6px] cursor-pointer transition-colors ${pathname === "/funnel" || pathname.startsWith("/funnel/")
                    ? theme === "dark"
                      ? "bg-[#2a2a2a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                      : theme === "color"
                        ? "bg-[rgba(0,255,255,0.1)] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                        : "bg-[#f3f4f6] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                    : theme === "color" ? "hover:bg-[rgba(0,255,255,0.05)]" : "hover:bg-muted/50"
                    }`}>
                    <Filter className={`h-4 w-4 shrink-0 ${pathname === "/funnel" || pathname.startsWith("/funnel/")
                      ? theme === "dark" ? "text-[#e5e5e5]" : theme === "color" ? "text-[#0ff]" : "text-[#1f1f1f]"
                      : theme === "dark" ? "text-[#9ca3af]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#4b5563]"
                      }`} />
                    {!sidebarCollapsed && (
                      <span className={`text-[13px] leading-[19.5px] ${pathname === "/funnel" || pathname.startsWith("/funnel/")
                        ? theme === "dark"
                          ? "font-bold text-[#e5e5e5]"
                          : theme === "color"
                            ? "font-bold text-[#0ff]"
                            : "font-bold text-[#1f1f1f]"
                        : theme === "dark"
                          ? "font-normal text-[#9ca3af]"
                          : theme === "color"
                            ? "font-normal text-[rgba(0,255,255,0.9)]"
                            : "font-normal text-[#4b5563]"
                        }`}>
                        Funnels
                      </span>
                    )}
                  </div>
                </Link>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" align="start">
                  Funnels
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/products">
                  <div className={`h-9 flex items-center ${sidebarCollapsed ? "justify-center pl-0" : "gap-2 pl-[10px]"} ${(pathname === "/products" || pathname.startsWith("/products/")) ? "pr-[10px] mr-[8px]" : "pr-0"} py-0 rounded-[6px] cursor-pointer transition-colors ${pathname === "/products" || pathname.startsWith("/products/")
                    ? theme === "dark"
                      ? "bg-[#2a2a2a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                      : theme === "color"
                        ? "bg-[rgba(0,255,255,0.1)] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                        : "bg-[#f3f4f6] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                    : theme === "color" ? "hover:bg-[rgba(0,255,255,0.05)]" : "hover:bg-muted/50"
                    }`}>
                    <Package className={`h-4 w-4 shrink-0 ${pathname === "/products" || pathname.startsWith("/products/")
                      ? theme === "dark" ? "text-[#e5e5e5]" : theme === "color" ? "text-[#0ff]" : "text-[#1f1f1f]"
                      : theme === "dark" ? "text-[#9ca3af]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#4b5563]"
                      }`} />
                    {!sidebarCollapsed && (
                      <span className={`text-[13px] leading-[19.5px] ${pathname === "/products" || pathname.startsWith("/products/")
                        ? theme === "dark"
                          ? "font-bold text-[#e5e5e5]"
                          : theme === "color"
                            ? "font-bold text-[#0ff]"
                            : "font-bold text-[#1f1f1f]"
                        : theme === "dark"
                          ? "font-normal text-[#9ca3af]"
                          : theme === "color"
                            ? "font-normal text-[rgba(0,255,255,0.9)]"
                            : "font-normal text-[#4b5563]"
                        }`}>
                        Products & Services
                      </span>
                    )}
                  </div>
                </Link>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" align="start">
                  Products & Services
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => requestCmsAccess(() => router.push("/deals/cms"))}
                  className="w-full text-left"
                >
                  <div className={`h-9 flex items-center ${sidebarCollapsed ? "justify-center pl-0" : "gap-2 pl-[10px]"} ${(pathname === "/deals/cms" || pathname.startsWith("/deals/cms/")) ? "pr-[10px] mr-[8px]" : "pr-0"} py-0 rounded-[6px] cursor-pointer transition-colors ${pathname === "/deals/cms" || pathname.startsWith("/deals/cms/")
                    ? theme === "dark"
                      ? "bg-[#2a2a2a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                      : theme === "color"
                        ? "bg-[rgba(0,255,255,0.1)] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                        : "bg-[#f3f4f6] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                    : theme === "color" ? "hover:bg-[rgba(0,255,255,0.05)]" : "hover:bg-muted/50"
                    }`}>
                    <LayoutTemplate className={`h-4 w-4 shrink-0 ${pathname === "/deals/cms" || pathname.startsWith("/deals/cms/")
                      ? theme === "dark" ? "text-[#e5e5e5]" : theme === "color" ? "text-[#0ff]" : "text-[#1f1f1f]"
                      : theme === "dark" ? "text-[#9ca3af]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#4b5563]"
                      }`} />
                    {!sidebarCollapsed && (
                      <span className={`text-[13px] leading-[19.5px] ${pathname === "/deals/cms" || pathname.startsWith("/deals/cms/")
                        ? theme === "dark"
                          ? "font-bold text-[#e5e5e5]"
                          : theme === "color"
                            ? "font-bold text-[#0ff]"
                            : "font-bold text-[#1f1f1f]"
                        : theme === "dark"
                          ? "font-normal text-[#9ca3af]"
                          : theme === "color"
                            ? "font-normal text-[rgba(0,255,255,0.9)]"
                            : "font-normal text-[#4b5563]"
                        }`}>
                        CMS
                      </span>
                    )}
                  </div>
                </button>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" align="start">
                  CMS
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/contacts">
                  <div className={`h-9 flex items-center ${sidebarCollapsed ? "justify-center pl-0" : "gap-2 pl-[10px]"} ${(pathname === "/contacts" || pathname.startsWith("/contacts/")) ? "pr-[10px] mr-[8px]" : "pr-0"} py-0 rounded-[6px] cursor-pointer transition-colors ${pathname === "/contacts" || pathname.startsWith("/contacts/")
                    ? theme === "dark"
                      ? "bg-[#2a2a2a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                      : theme === "color"
                        ? "bg-[rgba(0,255,255,0.1)] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                        : "bg-[#f3f4f6] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                    : theme === "color" ? "hover:bg-[rgba(0,255,255,0.05)]" : "hover:bg-muted/50"
                    }`}>
                    <Contact className={`h-4 w-4 shrink-0 ${pathname === "/contacts" || pathname.startsWith("/contacts/")
                      ? theme === "dark" ? "text-[#e5e5e5]" : theme === "color" ? "text-[#0ff]" : "text-[#1f1f1f]"
                      : theme === "dark" ? "text-[#9ca3af]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#4b5563]"
                      }`} />
                    {!sidebarCollapsed && (
                      <span className={`text-[13px] leading-[19.5px] ${pathname === "/contacts" || pathname.startsWith("/contacts/")
                        ? theme === "dark"
                          ? "font-bold text-[#e5e5e5]"
                          : theme === "color"
                            ? "font-bold text-[#0ff]"
                            : "font-bold text-[#1f1f1f]"
                        : theme === "dark"
                          ? "font-normal text-[#9ca3af]"
                          : theme === "color"
                            ? "font-normal text-[rgba(0,255,255,0.9)]"
                            : "font-normal text-[#4b5563]"
                        }`}>
                        Contacts
                      </span>
                    )}
                  </div>
                </Link>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" align="start">
                  Contacts
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/companies">
                  <div className={`h-9 flex items-center ${sidebarCollapsed ? "justify-center pl-0" : "gap-2 pl-[10px]"} ${(pathname === "/companies" || pathname.startsWith("/companies/")) ? "pr-[10px] mr-[8px]" : "pr-0"} py-0 rounded-[6px] cursor-pointer transition-colors ${pathname === "/companies" || pathname.startsWith("/companies/")
                    ? theme === "dark"
                      ? "bg-[#2a2a2a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                      : theme === "color"
                        ? "bg-[rgba(0,255,255,0.1)] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                        : "bg-[#f3f4f6] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                    : theme === "color" ? "hover:bg-[rgba(0,255,255,0.05)]" : "hover:bg-muted/50"
                    }`}>
                    <Building2 className={`h-4 w-4 shrink-0 ${pathname === "/companies" || pathname.startsWith("/companies/")
                      ? theme === "dark" ? "text-[#e5e5e5]" : theme === "color" ? "text-[#0ff]" : "text-[#1f1f1f]"
                      : theme === "dark" ? "text-[#9ca3af]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#4b5563]"
                      }`} />
                    {!sidebarCollapsed && (
                      <span className={`text-[13px] leading-[19.5px] ${pathname === "/companies" || pathname.startsWith("/companies/")
                        ? theme === "dark"
                          ? "font-bold text-[#e5e5e5]"
                          : theme === "color"
                            ? "font-bold text-[#0ff]"
                            : "font-bold text-[#1f1f1f]"
                        : theme === "dark"
                          ? "font-normal text-[#9ca3af]"
                          : theme === "color"
                            ? "font-normal text-[rgba(0,255,255,0.9)]"
                            : "font-normal text-[#4b5563]"
                        }`}>
                        Companies
                      </span>
                    )}
                  </div>
                </Link>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" align="start">
                  Companies
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* <Link href="/messages">
            <div className={`h-9 flex items-center gap-2 pl-[10px] pr-0 py-0 rounded-[6px] cursor-pointer transition-colors ${
              pathname === "/messages" || pathname.startsWith("/messages/")
                ? theme === "dark"
                  ? "bg-[#2a2a2a] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                  : theme === "color"
                  ? "bg-[rgba(0,255,255,0.1)] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                  : "bg-[#f3f4f6] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
                : theme === "color" ? "hover:bg-[rgba(0,255,255,0.05)]" : "hover:bg-muted/50"
            }`}>
              <Mail className={`h-4 w-4 shrink-0 ${
                pathname === "/messages" || pathname.startsWith("/messages/")
                  ? theme === "dark" ? "text-[#e5e5e5]" : theme === "color" ? "text-[#0ff]" : "text-[#1f1f1f]"
                  : theme === "dark" ? "text-[#9ca3af]" : theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-[#4b5563]"
              }`} />
              <span className={`text-[13px] leading-[19.5px] ${
                pathname === "/messages" || pathname.startsWith("/messages/")
                  ? theme === "dark"
                    ? "font-bold text-[#e5e5e5]"
                    : theme === "color"
                    ? "font-bold text-[#0ff]"
                    : "font-bold text-[#1f1f1f]"
                  : theme === "dark"
                    ? "font-normal text-[#9ca3af]"
                    : theme === "color"
                    ? "font-normal text-[rgba(0,255,255,0.9)]"
                    : "font-normal text-[#4b5563]"
              }`}>
                Communication
              </span>
              </div>
            </Link> */}
        </div>
      </div>

      {/* User Profile */}
      <div className={`p-2 border-t-0 ${theme === "color" ? "" : "border-t border-border dark:border-gray-800"
        }`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} cursor-pointer p-2 rounded-[6px] transition-colors ${theme === "color" ? "hover:bg-[rgba(0,255,255,0.05)]" : "hover:bg-muted"
              }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${theme === "color"
                ? "bg-[#0ff] text-[#0a0e27]"
                : "bg-muted text-foreground"
                }`}>
                {(() => {
                  if (!userData) return 'U';
                  const name = userData.name || '';
                  const firstName = userData.firstName || '';
                  const lastName = userData.lastName || '';

                  if (name) {
                    const parts = name.trim().split(' ');
                    if (parts.length >= 2) {
                      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
                    }
                    return name.charAt(0).toUpperCase();
                  }

                  if (firstName && lastName) {
                    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
                  }

                  return (firstName || lastName || 'U').charAt(0).toUpperCase();
                })()}
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold leading-[18.571px] truncate ${theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-foreground"
                      }`}>
                      {userData ? (userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User') : 'User'}
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 ${theme === "color" ? "text-[rgba(0,255,255,0.9)]" : "text-muted-foreground"
                    }`} />
                </>
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="text-red-600"
              onSelect={(event) => {
                event.preventDefault();
                handleSignOut();
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
