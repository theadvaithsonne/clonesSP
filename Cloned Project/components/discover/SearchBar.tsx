"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSearch?: () => void;
  debounceMs?: number;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search HQs...",
  onSearch,
  debounceMs = 300,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange, value]);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && onSearch) {
        onSearch();
      }
    },
    [onSearch]
  );

  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
      <Input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-white/20 focus:ring-0"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
