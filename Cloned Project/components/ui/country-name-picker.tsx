"use client";

/**
 * A searchable country **name** select.
 *
 * Distinct from `country-code-picker.tsx`, which selects a dial code for a
 * phone field. This one is for address forms: the value is the plain country
 * name string ("India"), because that is what `/org/resolve-pincode` returns
 * and what the org record stores — swapping to ISO codes would strand every
 * address already saved.
 *
 * A free-typed country that is not in the list is preserved rather than
 * blanked: existing records hold hand-entered spellings, and silently
 * dropping one on open would lose it the next time the form is saved.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Country } from "country-state-city";
import { ChevronDown, Globe, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CountryNamePickerProps {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Applied to the trigger button, so callers can match their field height. */
  className?: string;
  /** Hide the leading globe glyph (the compact mobile rows draw their own). */
  hideIcon?: boolean;
}

export function CountryNamePicker({
  value,
  onChange,
  placeholder = "Select country",
  disabled,
  id,
  className = "",
  hideIcon = false,
}: CountryNamePickerProps) {
  const countries = useMemo(() => Country.getAllCountries(), []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Ref containment on mousedown — same click-outside as the dial-code
  // picker. A full-screen overlay would swallow the first click back into
  // the field.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = useMemo(
    () =>
      countries.find(
        (c) => c.name.toLowerCase() === value.trim().toLowerCase()
      ) || null,
    [countries, value]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.isoCode.toLowerCase().includes(q)
    );
  }, [countries, search]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-md border border-[#2a2a35] bg-[#1a1a22] px-3 text-left text-sm transition-all duration-200 hover:border-brand-2/50 focus:border-brand-2/50 focus:outline-none disabled:opacity-50",
          className
        )}
      >
        {selected ? (
          <span className="text-base leading-none">{selected.flag}</span>
        ) : (
          !hideIcon && <Globe className="h-4 w-4 flex-shrink-0 text-[#6a6a7a]" />
        )}
        <span
          className={cn(
            "flex-1 truncate",
            value ? "text-white" : "text-[#6a6a7a]"
          )}
        >
          {value || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#6a6a7a]" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#2a2a35] bg-[#1a1a22] shadow-lg">
          <div className="sticky top-0 z-10 border-b border-[#2a2a35] bg-[#1a1a22] p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6a6a7a]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="h-8 w-full rounded-md border border-[#2a2a35] bg-[#13131a] pl-8 pr-2 text-xs text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="p-1">
            {filtered.map((c) => (
              <button
                key={c.isoCode}
                type="button"
                onClick={() => {
                  onChange(c.name);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[#2a2a35]",
                  selected?.isoCode === c.isoCode
                    ? "bg-[#2a2a35]/50 text-brand-2"
                    : "text-[#c7c7da]"
                )}
              >
                <span className="text-sm">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-4 text-center text-xs text-[#6a6a7a]">
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CountryNamePicker;
