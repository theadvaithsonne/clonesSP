"use client";

import { cn } from "@/lib/utils";

type DealsPageToolbarProps = {
  search: React.ReactNode;
  actions: React.ReactNode;
  className?: string;
};

/** Responsive wrapper for Deals list-page toolbars (search + action buttons). */
export function DealsPageToolbar({
  search,
  actions,
  className,
}: DealsPageToolbarProps) {
  return (
    <div
      className={cn(
        "border-b min-h-[64.667px] relative shrink-0 w-full max-w-full",
        className
      )}
    >
      <div className="flex flex-col gap-2 px-3 sm:px-6 py-3 sm:py-0 sm:h-[64.667px] sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0 sm:flex-1">
          <div className="hidden sm:block shrink-0">{search}</div>
          <div className="flex items-center gap-1 ml-auto shrink-0 overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {actions}
          </div>
        </div>
        <div className="w-full sm:hidden">{search}</div>
      </div>
    </div>
  );
}

type DealsSearchFieldProps = {
  children: React.ReactNode;
  className?: string;
};

/** Search input container - full width on mobile, fixed width on sm+. */
export function DealsSearchField({ children, className }: DealsSearchFieldProps) {
  return (
    <div className={cn("relative w-full h-[32px] sm:w-[384px]", className)}>
      {children}
    </div>
  );
}

/** Icon-only on mobile, label on sm+ for toolbar action buttons. */
export const dealsToolbarActionBtn =
  "h-8 w-8 p-0 sm:h-[32px] sm:w-auto sm:px-[10px] shrink-0 flex items-center justify-center";
