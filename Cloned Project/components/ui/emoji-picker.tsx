"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
  /**
   * Which edge of the trigger button the popover anchors to. Default
   * "right" matches the original behaviour (popup grows leftward —
   * correct when the trigger is on the right side of a row). Use
   * "left" when the trigger is on the left side, otherwise the popup
   * goes offscreen (e.g. inside a right-rail chat input).
   */
  align?: "left" | "right";
  width?: string | number;
  height?: string | number;
  /**
   * Controlled mode: the parent owns whether the popover is open (its own
   * "+" menu opens it) and hides the built-in smiley button. The popover
   * still anchors to this component's wrapper, so place it where the
   * popover should appear. Leave both unset for the self-contained button.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function EmojiPickerComponent({
  onEmojiSelect,
  className,
  align = "right",
  width = 320,
  height = 320,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: EmojiPickerProps) {
  const [isOpenState, setIsOpenState] = useState(false);
  const isOpen = openProp ?? isOpenState;
  const setIsOpen = (next: boolean) => {
    setIsOpenState(next);
    onOpenChange?.(next);
  };
  const pickerRef = useRef<HTMLDivElement>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        // Check if the click is on the emoji picker portal content
        const portal = document.getElementById("emoji-picker-portal-content");
        if (portal && portal.contains(event.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (isOpen && pickerRef.current) {
      setTriggerRect(pickerRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setIsOpen(false);
  };

  const pickerWidthNum = typeof width === "number" ? width : parseInt(String(width)) || 320;
  const pickerHeightNum = typeof height === "number" ? height : parseInt(String(height)) || 400;

  return (
    <div className={`relative ${className ?? ""}`} ref={pickerRef}>
      {!hideTrigger && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 w-8 p-0 text-[#c7c7da] hover:text-white hover:bg-[#1a1a22] border border-transparent hover:border-[#363649] rounded-md"
          title="Add emoji"
        >
          <Smile className="h-4 w-4" />
        </Button>
      )}

      {isOpen && triggerRect && typeof document !== "undefined" && (
        createPortal(
          <div
            id="emoji-picker-portal-content"
            style={{
              position: "fixed",
              top: Math.max(8, triggerRect.top - pickerHeightNum - 8),
              left: align === "left"
                ? Math.min(window.innerWidth - pickerWidthNum - 8, Math.max(8, triggerRect.left))
                : Math.min(window.innerWidth - pickerWidthNum - 8, Math.max(8, triggerRect.right - pickerWidthNum)),
              zIndex: 99999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] overflow-hidden">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme="dark"
                width={width}
                height={height}
                searchDisabled={false}
                skinTonesDisabled={false}
                previewConfig={{
                  showPreview: false,
                }}
              />
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
}
