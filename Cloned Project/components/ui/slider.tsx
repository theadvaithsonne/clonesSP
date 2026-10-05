"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value = [0], onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      className={cn(
        "w-full h-1.5 rounded-full appearance-none bg-[#1a1a25] cursor-pointer accent-brand",
        className
      )}
      {...props}
    />
  )
);
Slider.displayName = "Slider";

export { Slider };
