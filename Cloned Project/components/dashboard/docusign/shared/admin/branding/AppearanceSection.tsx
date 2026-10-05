"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DsBrandingLayout, DsBrandingLogoSize } from "@/lib/docusign/types";
import { ACCENT_SWATCHES, FIELD_ERROR, FIELD_LABEL, HEX_RE, SECTION, SECTION_SUBTITLE, SECTION_TITLE, readableTextOn } from "./brandingUi";

interface AppearanceSectionProps {
  accentColor: string;
  layout: DsBrandingLayout;
  logoSize: DsBrandingLogoSize;
  onChange: (patch: Partial<{ accentColor: string; layout: DsBrandingLayout; logoSize: DsBrandingLogoSize }>) => void;
  accentError?: string;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a35] bg-[#0c0c10] p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-brand text-[#141414]" : "text-[#8a8a9b] hover:text-white/80"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AppearanceSection({ accentColor, layout, logoSize, onChange, accentError }: AppearanceSectionProps) {
  // The hex box is edited as free text and only pushed up once it's a complete colour, so typing
  // "#fb" never flashes a broken colour into the preview.
  const [hexText, setHexText] = useState(accentColor);
  useEffect(() => setHexText(accentColor), [accentColor]);
  const current = accentColor.toLowerCase();

  return (
    <div className={SECTION}>
      <div>
        <h3 className={SECTION_TITLE}>Appearance</h3>
        <p className={SECTION_SUBTITLE}>Colour of the buttons and highlights, and how the email is laid out.</p>
      </div>

      <div className="space-y-2">
        <p className={FIELD_LABEL}>Accent colour</p>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Accent colour ${c}`}
              onClick={() => onChange({ accentColor: c })}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full border transition-transform hover:scale-105",
                current === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#111116]" : "border-white/15"
              )}
              style={{ background: c }}
            >
              {current === c && <Check className="h-4 w-4" style={{ color: readableTextOn(c) }} />}
            </button>
          ))}
          <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-white/20" title="Custom colour">
            <span className="absolute inset-0" style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} />
            <input
              type="color"
              value={HEX_RE.test(accentColor) ? accentColor : "#fbd10d"}
              onChange={(e) => onChange({ accentColor: e.target.value.toLowerCase() })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Custom accent colour"
            />
          </label>
          <input
            value={hexText}
            onChange={(e) => {
              const next = e.target.value.trim();
              setHexText(next);
              if (HEX_RE.test(next)) onChange({ accentColor: next.toLowerCase() });
            }}
            onBlur={() => setHexText(accentColor)}
            maxLength={7}
            aria-label="Accent colour hex code"
            className="h-8 w-24 rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2.5 font-mono text-xs uppercase text-white/85 focus:border-[#3b3b4a] focus:outline-none"
          />
        </div>
        {accentError && <p className={FIELD_ERROR}>{accentError}</p>}
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="space-y-2">
          <p className={FIELD_LABEL}>Layout</p>
          <Segmented
            label="Layout"
            value={layout}
            onChange={(v) => onChange({ layout: v })}
            options={[
              { value: "centered", label: "Centered" },
              { value: "left", label: "Left-aligned" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <p className={FIELD_LABEL}>Logo size</p>
          <Segmented
            label="Logo size"
            value={logoSize}
            onChange={(v) => onChange({ logoSize: v })}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
