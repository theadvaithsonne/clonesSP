"use client";

import { motion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "default" | "accent" | "success";
  disabled?: boolean;
  index?: number;
  /** "lg" is 25% up on every dimension — the lone Login card on bat246.com. */
  size?: "default" | "lg";
}

const variantStyles = {
  primary: {
    iconBg: "bg-gradient-to-br from-primary/20 to-primary/10",
    iconColor: "text-primary",
    hoverBorder: "hover:border-primary/40",
    hoverGlow: "hover:shadow-[0_0_30px_color-mix(in_srgb,_var(--brand)_15%,_transparent)]",
  },
  secondary: {
    iconBg: "bg-gradient-to-br from-secondary/20 to-secondary/10",
    iconColor: "text-secondary",
    hoverBorder: "hover:border-secondary/40",
    hoverGlow: "hover:shadow-[0_0_30px_color-mix(in_srgb,_var(--brand-2)_15%,_transparent)]",
  },
  default: {
    iconBg: "bg-gradient-to-br from-white/10 to-white/5",
    iconColor: "text-white",
    hoverBorder: "hover:border-white/30",
    hoverGlow: "hover:shadow-[0_0_30px_rgba(255,255,255,0.08)]",
  },
  accent: {
    iconBg: "bg-gradient-to-br from-blue-500/20 to-blue-600/10",
    iconColor: "text-blue-400",
    hoverBorder: "hover:border-blue-500/40",
    hoverGlow: "hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]",
  },
  success: {
    iconBg: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10",
    iconColor: "text-emerald-400",
    hoverBorder: "hover:border-emerald-500/40",
    hoverGlow: "hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
  },
};

export function WelcomeCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
  variant = "default",
  disabled = false,
  index = 0,
  size = "default",
}: WelcomeCardProps) {
  const styles = variantStyles[variant];
  const lg = size === "lg";

  return (
    <motion.button
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.4,
        delay: 0.3 + index * 0.08,
        ease: "easeOut",
      }}
      whileHover={{ scale: disabled ? 1 : 1.02, x: disabled ? 0 : 4 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group w-full flex items-center",
        lg
          ? "gap-3 sm:gap-4 p-3 sm:p-4 lg:p-5"
          : "gap-2.5 sm:gap-3 p-2.5 sm:p-3 lg:p-4",
        "bg-[#12121a]/80 backdrop-blur-xl",
        "border border-[#2a2a35]/60 rounded-lg",
        "transition-all duration-300 ease-out",
        "text-left",
        styles.hoverBorder,
        styles.hoverGlow,
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Icon container */}
      <div
        className={cn(
          "flex-shrink-0 rounded-lg",
          lg
            ? "w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14"
            : "w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11",
          "flex items-center justify-center",
          "border border-white/5",
          "transition-all duration-300",
          styles.iconBg,
          "group-hover:scale-105"
        )}
      >
        <Icon
          className={cn(
            lg ? "w-5 h-5 lg:w-6 lg:h-6" : "w-4 h-4 sm:w-4 sm:h-4 lg:w-5 lg:h-5",
            styles.iconColor
          )}
        />
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <h3
          className={cn(
            "font-semibold text-white mb-0 sm:mb-0.5 truncate",
            lg ? "text-base sm:text-lg lg:text-xl" : "text-[13px] sm:text-sm lg:text-base"
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "text-[#9fa0b8] truncate",
            lg
              ? "text-[12.5px] sm:text-sm lg:text-[15px]"
              : "text-[10px] sm:text-[11px] lg:text-xs"
          )}
        >
          {subtitle}
        </p>
      </div>

      {/* Chevron */}
      <ChevronRight
        className={cn(
          "flex-shrink-0 text-[#6a6a7a]",
          lg ? "w-5 h-5" : "w-4 h-4",
          "transition-all duration-300",
          "group-hover:text-white group-hover:translate-x-1"
        )}
      />
    </motion.button>
  );
}
