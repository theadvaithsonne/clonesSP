"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export default function LoadingSpinner({
  size = "md",
  className,
  text,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
      {text && (
        <p className={cn("text-muted-foreground", textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  );
}

// Grid skeleton for loading states
export function NotesGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="mb-4 break-inside-avoid animate-pulse"
          style={{ height: `${Math.random() * 100 + 150}px` }}
        >
          <div className="rounded-lg bg-gray-200 h-full p-4">
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-3 bg-gray-300 rounded w-full"></div>
              <div className="h-3 bg-gray-300 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}