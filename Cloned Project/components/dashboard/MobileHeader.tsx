"use client";

import { useEffect, useState } from "react";
import { Menu, MoreVertical, User } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useMobileSidebar } from "@/lib/mobile-sidebar-context";
import { api } from "@/lib/api";
import { useWhitelabelContext } from "@/lib/whitelabel-context";
import {
  BAT246_DISPLAY_NAME,
  BAT246_LOGO_SRC,
  useIsBat246Office,
} from "@/lib/bat246Office";

interface MobileHeaderProps {
  className?: string;
  me?: {
    id?: string;
    _id?: string;
    profilePicture?: string;
    name?: string;
    email?: string;
  } | null;
}

export default function MobileHeader({ className, me }: MobileHeaderProps) {
  const { toggleMobileSidebar, toggleMobileActionSidebar } = useMobileSidebar();
  const {
    isWhitelabel,
    orgIcon: whitelabelOrgIcon,
    orgName: whitelabelOrgName,
    isLoading: whitelabelLoading,
  } = useWhitelabelContext();
  const isBat246Office = useIsBat246Office();

  const [orgWhiteLogo, setOrgWhiteLogo] = useState<string>("");

  useEffect(() => {
    if (isWhitelabel) return; // whitelabel orgs already have their logo

    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    api<{ org: { white_logo?: string } }>(`/org/${orgId}`)
      .then((res) => {
        if (res.org?.white_logo) setOrgWhiteLogo(res.org.white_logo);
      })
      .catch(() => {});
  }, [isWhitelabel]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[900] h-14 bg-[#0e0e12] border-b border-[#2a2a35] flex items-center justify-between px-4 ${className || ""}`}
    >
      {/* Hamburger menu button */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={toggleMobileSidebar}
        className="h-10 w-10 text-[#c7c7da] hover:text-white hover:bg-[#15151b]"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Logo */}
      <div className="absolute left-1/2 transform -translate-x-1/2">
        {isBat246Office ? (
          <img
            src={BAT246_LOGO_SRC}
            alt={BAT246_DISPLAY_NAME}
            style={{ height: "36px", width: "36px", objectFit: "contain" }}
          />
        ) : whitelabelLoading ? (
          <div className="w-[100px] h-[36px] bg-[#1b1b24] animate-pulse rounded" />
        ) : isWhitelabel && whitelabelOrgIcon ? (
          <Image
            src={whitelabelOrgIcon}
            alt={whitelabelOrgName || "Organization Logo"}
            width={110}
            height={55}
            style={{
              height: "auto",
              maxHeight: "36px",
              objectFit: "contain",
            }}
          />
        ) : orgWhiteLogo ? (
          <img
            src={orgWhiteLogo}
            alt="Organization Logo"
            style={{
              height: "auto",
              maxHeight: "36px",
              maxWidth: "130px",
              objectFit: "contain",
            }}
          />
        ) : (
          <Image
            src="/logo.svg"
            alt="Garage 2.0 Logo"
            width={110}
            height={55}
            style={{ height: "auto" }}
          />
        )}
      </div>

      {/* Action Buttons Group */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            const userId = me?.id || me?._id;
            if (userId) {
              window.dispatchEvent(
                new CustomEvent("affiliate-profile:open", {
                  detail: { userId },
                })
              );
            }
          }}
          className="h-10 w-10 text-[#c7c7da] hover:text-white hover:bg-[#15151b]"
          aria-label="View network profile"
        >
          <User className="h-5 w-5" />
        </Button>

        {/* Action menu button */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={toggleMobileActionSidebar}
          className="h-10 w-10 text-[#c7c7da] hover:text-white hover:bg-[#15151b]"
          aria-label="Open actions"
        >
          <MoreVertical className="h-6 w-6" />
        </Button>
      </div>
    </header>
  );
}
