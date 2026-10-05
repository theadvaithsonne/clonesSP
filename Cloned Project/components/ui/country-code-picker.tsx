"use client";

/**
 * The dial-code selector that sits at the left of a phone input.
 *
 * Modelled on the picker in components/shared/ProfilePopover.tsx, which is the
 * established pattern in this app: the dropdown spans the FULL field width
 * (`left-0 right-0`) rather than a fixed box, click-outside is a ref check on
 * `mousedown`, and the current selection is highlighted in the list.
 *
 * Extracted because that markup existed in four near-identical copies —
 * ProfilePopover (mobile AND desktop), PhoneVerifyBanner and
 * PlanPhoneVerifySheet — which had drifted: two defaulted to +91, one to +1,
 * and each had its own search predicate. A login field that guesses the wrong
 * country sends someone's OTP to a stranger, so there is now one of these.
 *
 * ── Positioning contract ─────────────────────────────────────────────────
 * This renders the dropdown against the NEAREST POSITIONED ANCESTOR, not
 * against itself, so the list can span the whole field the way ProfilePopover's
 * does. The caller must therefore mark the field wrapper `relative`, and must
 * NOT put `overflow-hidden` on it — that clips the dropdown to the input's
 * height, which is exactly how this shipped broken the first time.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { type ICountry } from "country-state-city";
import { phoneCountries } from "@/lib/dialCodes";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dial code without the "+", e.g. "91".
 *
 * Reads the CORRECTED phonecode from `phoneCountries()`. Never call this with
 * a raw `country-state-city` record — its `phonecode` is a human note, not a
 * dial code ("+1-809 and 1-829" for the Dominican Republic). See lib/dialCodes.
 */
export function dialOf(country: ICountry | null, fallback = "91"): string {
  return country?.phonecode?.replace(/^\+/, "") || fallback;
}

export function useCountries(): ICountry[] {
  return useMemo(() => phoneCountries(), []);
}

/** Every dial code in the picker — feed this to `splitE164`. */
export function allDialCodes(): string[] {
  return phoneCountries().map((c) => c.phonecode.replace(/^\+/, ""));
}

export function findCountryByIso(iso: string): ICountry | null {
  return phoneCountries().find((c) => c.isoCode === iso) || null;
}

export interface CountryCodePickerProps {
  value: ICountry | null;
  onChange: (c: ICountry) => void;
  /** Shown before a country is chosen. */
  fallbackDial?: string;
  fallbackFlag?: string;
  disabled?: boolean;
  /** Applied to the trigger button — the caller supplies the matching radius. */
  buttonClassName?: string;
}

export function CountryCodePicker({
  value,
  onChange,
  fallbackDial = "91",
  fallbackFlag = "🇮🇳",
  disabled,
  buttonClassName = "",
}: CountryCodePickerProps) {
  const countries = useCountries();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Same click-outside as ProfilePopover: a ref containment check on
  // mousedown. A full-screen overlay div would sit between the dropdown and
  // the field and swallow the first click back into the input.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    const bare = q.replace(/^\+/, "");
    // Name, dial code, and ISO — the union of what the copies matched.
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phonecode.replace(/^\+/, "").startsWith(bare) ||
        c.isoCode.toLowerCase().includes(q)
    );
  }, [countries, search]);

  return (
    // NOT `relative` — the dropdown below is positioned against the field
    // wrapper so it can span its full width. See the contract above.
    <div ref={rootRef} className="contents">
      <button
        type="button"
        disabled={disabled}
        aria-label="Select country calling code"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex flex-shrink-0 items-center gap-1.5 border-r border-[#2a2a35] px-3 text-sm text-white transition-colors hover:bg-[#2a2a35]/30 disabled:opacity-50",
          buttonClassName
        )}
      >
        <span className="text-base leading-none">
          {value?.flag || fallbackFlag}
        </span>
        <span className="font-semibold text-white">
          +{dialOf(value, fallbackDial)}
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[#6a6a7a]" />
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
                placeholder="Search country or code..."
                className="h-8 w-full rounded-md border border-[#2a2a35] bg-[#13131a] pl-8 pr-2 text-xs text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="p-1">
            {filtered.map((c) => (
              <button
                key={`${c.isoCode}-${c.phonecode}`}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[#2a2a35]",
                  value?.isoCode === c.isoCode
                    ? "bg-[#2a2a35]/50 text-brand-2"
                    : "text-[#c7c7da]"
                )}
              >
                <span className="text-sm">{c.flag}</span>
                <span className="font-semibold text-white">
                  +{c.phonecode.replace(/^\+/, "")}
                </span>
                <span className="flex-1 truncate text-right text-[#8f90a8]">
                  {c.name}
                </span>
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

export default CountryCodePicker;
