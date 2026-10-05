import React, { useState, useEffect, useRef, useMemo } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeSelectorProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  relativeTo?: string; // "HH:MM" (optional start time to calculate duration labels)
  className?: string;
}

// Generate time options in 15-minute intervals
const TIME_OPTIONS = (() => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = h.toString().padStart(2, "0");
      const mm = m.toString().padStart(2, "0");
      options.push(`${hh}:${mm}`);
    }
  }
  return options;
})();

function parseTimeString(str: string): string | null {
  const clean = str.trim().toLowerCase();
  if (!clean) return null;

  // Regex matches:
  // 1. One or two digits (hours)
  // 2. Optional colon and two digits (minutes)
  // 3. Optional whitespace and meridiem abbreviation (am/pm/a/p)
  const regex = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/;
  const match = clean.match(regex);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3];

  if (minutes < 0 || minutes > 59) return null;

  if (ampm) {
    const isPm = ampm.startsWith("p");
    if (isPm && hours < 12) {
      hours += 12;
    } else if (!isPm && hours === 12) {
      hours = 0;
    }
  }

  if (hours < 0 || hours > 23) return null;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function formatDisplayTime(timeStr: string): string {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  let hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minsStr = minutes.toString().padStart(2, "0");
  return `${hours}:${minsStr} ${ampm}`;
}

function getRelativeDuration(startTimeStr: string, endTimeStr: string): string {
  const [sh, sm] = startTimeStr.split(":").map(Number);
  const [eh, em] = endTimeStr.split(":").map(Number);
  
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60; // Crosses midnight
  }
  
  const diff = endMinutes - startMinutes;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  
  if (hours === 0) {
    return `${mins} min`;
  }
  if (mins === 0) {
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }
  if (mins === 30) {
    const half = hours + 0.5;
    return `${half} hr${half > 1 ? "s" : ""}`;
  }
  return `${hours} hr ${mins} min`;
}

export function TimeSelector({ value, onChange, relativeTo, className }: TimeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync state with value prop
  useEffect(() => {
    setInputValue(formatDisplayTime(value));
  }, [value]);

  // Handle outside click to close dropdown and parse input
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen) {
          handleBlur();
          setIsOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, inputValue, value]);

  // Scroll active item into view when dropdown is opened
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector("[data-selected='true']") as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [isOpen]);

  const handleBlur = () => {
    const parsed = parseTimeString(inputValue);
    if (parsed) {
      onChange(parsed);
      setInputValue(formatDisplayTime(parsed));
    } else {
      // Revert to current formatted value
      setInputValue(formatDisplayTime(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && focusedIndex >= 0 && filteredOptions[focusedIndex]) {
        selectOption(filteredOptions[focusedIndex]);
      } else {
        handleBlur();
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setInputValue(formatDisplayTime(value));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setFocusedIndex(0);
      } else {
        setFocusedIndex((prev) => (prev + 1) % filteredOptions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setFocusedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
      }
    }
  };

  // Scroll focused option into view when navigating via keyboard keys
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index='${focusedIndex}']`) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [focusedIndex, isOpen]);

  const selectOption = (opt: string) => {
    onChange(opt);
    setInputValue(formatDisplayTime(opt));
    setIsOpen(false);
  };

  // Filter options based on typed text
  const filteredOptions = useMemo(() => {
    if (!inputValue || inputValue === formatDisplayTime(value)) {
      return TIME_OPTIONS;
    }
    const cleanInput = inputValue.toLowerCase().replace(/\s/g, "");
    return TIME_OPTIONS.filter((opt) => {
      const display = formatDisplayTime(opt).toLowerCase().replace(/\s/g, "");
      return display.includes(cleanInput) || opt.includes(cleanInput);
    });
  }, [inputValue, value]);

  // Adjust focused index if filtered options list changes
  useEffect(() => {
    setFocusedIndex((prev) => {
      if (prev >= filteredOptions.length) {
        return filteredOptions.length - 1;
      }
      return prev;
    });
  }, [filteredOptions]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            const idx = filteredOptions.indexOf(value);
            if (idx >= 0) setFocusedIndex(idx);
          }}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 7:00 PM"
          className="w-full bg-[#1a1a22] border border-[#2a2a35] text-white text-sm rounded-xl pl-3 pr-10 py-2.5 outline-none focus:border-brand/60 transition-colors"
        />
        <Clock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]/40 pointer-events-none" />
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 mt-1.5 max-h-[220px] overflow-y-auto bg-[#1a1a22] border border-[#2a2a35] rounded-xl shadow-2xl z-50 py-1 scrollbar-thin scrollbar-thumb-[#2a2a35] scrollbar-track-transparent"
        >
          {filteredOptions.map((opt, idx) => {
            const isSelected = opt === value;
            const isFocused = idx === focusedIndex;
            return (
              <button
                key={opt}
                type="button"
                data-index={idx}
                data-selected={isSelected}
                onClick={() => selectOption(opt)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm flex justify-between items-center transition-colors focus:outline-none",
                  isSelected
                    ? "bg-brand/10 text-brand font-medium"
                    : isFocused
                    ? "bg-[#2a2a35] text-white"
                    : "text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35]/50"
                )}
              >
                <span>{formatDisplayTime(opt)}</span>
                {relativeTo && (
                  <span
                    className={cn(
                      "text-xs font-normal ml-2",
                      isSelected
                        ? "text-brand/70"
                        : isFocused
                        ? "text-[#9fa0b8]"
                        : "text-[#9fa0b8]/50"
                    )}
                  >
                    ({getRelativeDuration(relativeTo, opt)})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
