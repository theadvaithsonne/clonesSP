"use client";

import { RefreshCw, CheckCircle, Clock, AlertTriangle, XCircle, Pause, AlertCircle } from "lucide-react";
import { SubscriptionStatus } from "@/lib/feed-api";

interface SubscriptionStatusBadgeProps {
  status: SubscriptionStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  expiresAt?: string;
}

const STATUS_CONFIG: Record<
  SubscriptionStatus,
  {
    bg: string;
    text: string;
    border: string;
    label: string;
    icon: React.ReactNode;
  }
> = {
  created: {
    bg: "bg-gray-500/20",
    text: "text-gray-400",
    border: "border-gray-500/30",
    label: "Created",
    icon: <Clock className="w-3 h-3" />,
  },
  authenticated: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    border: "border-blue-500/30",
    label: "Authenticated",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  active: {
    bg: "bg-green-500/20",
    text: "text-green-400",
    border: "border-green-500/30",
    label: "Active",
    icon: <RefreshCw className="w-3 h-3" />,
  },
  pending: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    label: "Pending",
    icon: <Clock className="w-3 h-3" />,
  },
  halted: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    border: "border-red-500/30",
    label: "Halted",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  cancelled: {
    bg: "bg-orange-500/20",
    text: "text-orange-400",
    border: "border-orange-500/30",
    label: "Cancelled",
    icon: <XCircle className="w-3 h-3" />,
  },
  completed: {
    bg: "bg-purple-500/20",
    text: "text-purple-400",
    border: "border-purple-500/30",
    label: "Completed",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  paused: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    border: "border-blue-500/30",
    label: "Paused",
    icon: <Pause className="w-3 h-3" />,
  },
  expired: {
    bg: "bg-gray-500/20",
    text: "text-gray-400",
    border: "border-gray-500/30",
    label: "Expired",
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

const SIZE_CLASSES = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export function SubscriptionStatusBadge({
  status,
  size = "md",
  showIcon = true,
  expiresAt,
}: SubscriptionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  if (!config) {
    return null;
  }

  const isExpiringSoon = () => {
    if (!expiresAt || status !== "active") return false;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 3 && daysUntilExpiry > 0;
  };

  const expiringSoon = isExpiringSoon();

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium border
        ${config.bg} ${config.text} ${config.border} ${SIZE_CLASSES[size]}
        ${expiringSoon ? "animate-pulse" : ""}
      `}
    >
      {showIcon && config.icon}
      <span>{config.label}</span>
      {expiringSoon && (
        <span className="ml-1 text-yellow-400">(Renewing soon)</span>
      )}
    </span>
  );
}

// Simple access badge for showing if user has access
interface AccessBadgeProps {
  hasAccess: boolean;
  isSubscription?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AccessBadge({ hasAccess, isSubscription = true, size = "md" }: AccessBadgeProps) {
  if (hasAccess) {
    return (
      <span
        className={`
          inline-flex items-center gap-1 rounded-full font-medium border
          bg-green-500/20 text-green-400 border-green-500/30
          ${SIZE_CLASSES[size]}
        `}
      >
        {isSubscription ? (
          <>
            <RefreshCw className="w-3 h-3" />
            <span>Subscribed</span>
          </>
        ) : (
          <>
            <CheckCircle className="w-3 h-3" />
            <span>Purchased</span>
          </>
        )}
      </span>
    );
  }

  return null;
}

// Period badge for showing subscription billing period
interface PeriodBadgeProps {
  period: "weekly" | "monthly" | "quarterly" | "yearly";
  size?: "sm" | "md" | "lg";
}

const PERIOD_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function PeriodBadge({ period, size = "sm" }: PeriodBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium border
        bg-blue-500/20 text-blue-400 border-blue-500/30
        ${SIZE_CLASSES[size]}
      `}
    >
      <RefreshCw className="w-3 h-3" />
      <span>{PERIOD_LABELS[period] || period}</span>
    </span>
  );
}
