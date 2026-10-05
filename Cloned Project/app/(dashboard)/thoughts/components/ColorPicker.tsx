"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOTE_COLORS, NoteColor } from "../types";
import { Check } from "lucide-react";

interface ColorPickerProps {
  selectedColor?: string;
  onColorSelect: (color: string) => void;
  onClose?: () => void;
  className?: string;
}

export default function ColorPicker({
  selectedColor = "#ffffff",
  onColorSelect,
  onClose,
  className,
}: ColorPickerProps) {
  const handleColorClick = (color: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onColorSelect(color);
    onClose?.();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-foreground">Choose color</p>
      <div className="flex flex-wrap gap-2">
        {NOTE_COLORS.map((color: NoteColor) => (
          <Button
            key={color.value}
            variant="ghost"
            size="sm"
            onClick={(e) => handleColorClick(color.value, e)}
            className={cn(
              "h-8 w-8 p-0 rounded-full border-2 transition-all hover:scale-110 relative",
              color.value === "#ffffff"
                ? "border-gray-300 bg-white"
                : `border-transparent`,
              selectedColor === color.value && "ring-2 ring-primary ring-offset-2"
            )}
            style={{
              backgroundColor: color.value,
              borderColor: color.value === "#ffffff" ? "#d1d5db" : color.value,
            }}
            title={color.name}
          >
            {selectedColor === color.value && (
              <Check className="h-3 w-3 text-gray-700" />
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}