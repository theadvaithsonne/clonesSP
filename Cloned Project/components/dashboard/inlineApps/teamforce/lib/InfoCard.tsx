"use client";

import {
  Lightbulb,
  AlertTriangle,
  CircleCheck,
  Info,
  type LucideIcon,
} from "lucide-react";

export type InfoCardVariant = "info" | "warning" | "success" | "neutral";

interface VariantStyle {
  border: string;
  bg: string;
  iconColor: string;
  titleColor: string;
  bodyColor: string;
  defaultIcon: LucideIcon;
}

const VARIANTS: Record<InfoCardVariant, VariantStyle> = {
  info: {
    border: "border-brand/25",
    bg: "bg-brand/[0.04]",
    iconColor: "text-brand",
    titleColor: "text-brand/90",
    bodyColor: "text-[#d4d4d4]",
    defaultIcon: Lightbulb,
  },
  warning: {
    border: "border-amber-500/25",
    bg: "bg-amber-500/[0.04]",
    iconColor: "text-amber-300",
    titleColor: "text-amber-300/90",
    bodyColor: "text-amber-200/80",
    defaultIcon: AlertTriangle,
  },
  success: {
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/[0.04]",
    iconColor: "text-emerald-300",
    titleColor: "text-emerald-300/90",
    bodyColor: "text-emerald-200/80",
    defaultIcon: CircleCheck,
  },
  neutral: {
    border: "border-white/8",
    bg: "bg-[#0a0a0a]",
    iconColor: "text-[#a8a8a8]",
    titleColor: "text-white/80",
    bodyColor: "text-[#a8a8a8]",
    defaultIcon: Info,
  },
};

interface InfoCardProps {
  variant?: InfoCardVariant;
  icon?: LucideIcon;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Compact contextual banner used throughout the Payroll module.
 * Designed to explain a non-obvious thing in 1–2 sentences without
 * intruding on the main flow. Pure neutral / semantic palette only.
 */
export default function InfoCard({
  variant = "info",
  icon,
  title,
  children,
  className = "",
}: InfoCardProps) {
  const v = VARIANTS[variant];
  const Icon = icon || v.defaultIcon;
  return (
    <div
      className={`rounded-xl border ${v.border} ${v.bg} px-3.5 py-2.5 flex items-start gap-2.5 ${className}`}
    >
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${v.iconColor}`} />
      <div className="min-w-0">
        {title && (
          <div
            className={`text-[11px] font-semibold uppercase tracking-wider mb-0.5 ${v.titleColor}`}
          >
            {title}
          </div>
        )}
        <div className={`text-[11.5px] leading-relaxed ${v.bodyColor}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
