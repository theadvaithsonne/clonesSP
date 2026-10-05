"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import {
  openLeadEmail,
  openLeadWhatsApp,
} from "@/lib/crm/leadContactActions";
import {
  hasLeadEmailOrPhone,
  resolveLeadEmail,
  resolveLeadPhone,
} from "@/lib/crm/resolveLeadContactInfo";
import { cn } from "@/lib/utils";

type LeadContactQuickActionsProps = {
  lead: Record<string, unknown> | null | undefined;
  /** Use when lead object omits id (e.g. dashboard activity cards). */
  leadId?: string;
  theme?: "light" | "dark" | "color";
  className?: string;
  /** When false, buttons stay visible (default). When true, only show on group-hover. */
  showOnRowHover?: boolean;
  /** Figma Deals inline table: 15px icons, mail then WhatsApp. */
  variant?: "default" | "figma";
};

export default function LeadContactQuickActions({
  lead,
  leadId,
  theme = "light",
  className,
  showOnRowHover = false,
  variant = "default",
}: LeadContactQuickActionsProps) {
  const email = resolveLeadEmail(lead);
  const phone = resolveLeadPhone(lead);

  if (!hasLeadEmailOrPhone(lead)) {
    return null;
  }

  const isFigmaVariant = variant === "figma";

  const iconBtnClass = cn(
    isFigmaVariant
      ? "h-[15px] w-[15px] shrink-0 p-0 hover:bg-transparent"
      : "h-7 w-7 shrink-0",
    showOnRowHover && "opacity-0 group-hover:opacity-100 transition-opacity",
    !isFigmaVariant &&
      (theme === "color"
        ? "text-[rgba(0,255,255,0.85)] hover:bg-[rgba(0,255,255,0.1)]"
        : theme === "dark"
          ? "text-[#9ca3af] hover:bg-[#3a3a3a] hover:text-[#e5e5e5]"
          : "text-[#6b7280] hover:bg-gray-100 hover:text-[#1f1f1f]")
  );

  return (
    <div
      className={cn(
        "flex items-center",
        isFigmaVariant ? "gap-[6px]" : "gap-0.5",
        className
      )}
      data-lead-contact-action
      onClick={(e) => e.stopPropagation()}
    >
      {email ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconBtnClass}
          title="Send email"
          aria-label="Send email"
          onClick={() => openLeadEmail(lead)}
        >
          {isFigmaVariant ? (
            <img
              alt=""
              src="/figma/deals/leads/mail.svg"
              className="h-[15px] w-[15px]"
            />
          ) : (
            <Mail className="h-4 w-4" />
          )}
        </Button>
      ) : null}
      {phone ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            iconBtnClass,
            !isFigmaVariant &&
              "text-[#25d366] hover:text-[#20bd5a] hover:bg-[rgba(37,211,102,0.12)]"
          )}
          title="Send WhatsApp"
          aria-label="Send WhatsApp"
          onClick={() => openLeadWhatsApp(lead, { leadId })}
        >
          {isFigmaVariant ? (
            <img
              alt=""
              src="/figma/deals/leads/whatsapp.svg"
              className="h-[15px] w-[15px]"
            />
          ) : (
            <WhatsAppIcon className="h-4 w-4" />
          )}
        </Button>
      ) : null}
    </div>
  );
}
