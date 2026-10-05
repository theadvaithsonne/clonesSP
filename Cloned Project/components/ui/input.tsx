import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // sizing
        "h-11 w-full min-w-0 rounded-md px-3 py-2 text-base md:text-sm",
        "placeholder:text-sm",

        // base look
        "bg-transparent border border-input/60 dark:bg-input/20",
        "placeholder:text-muted-foreground/50 file:text-foreground",

        // keep file input styles minimal
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",

        // calm focus (less glow/brightness)
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/40",
        "shadow-none transition-colors",

        // states
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 disabled:overflow-hidden disabled:[text-overflow:ellipsis]",
        "aria-invalid:border-destructive/60 aria-invalid:ring-destructive/15",

        className
      )}
      {...props}
    />
  );
}

export { Input };
