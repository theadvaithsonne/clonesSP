"use client";

// Step 2 of the whitelabel setup wizard: brand colours.
//
// Reads and writes the same GET/PUT /org/:orgId/branding that the Office
// Settings → Branding page uses, so whichever surface the founder touches
// last wins and both stay in sync.
//
// The right-hand panel is a miniature of the workspace chrome — top bar,
// sidebar, a card and a primary button — repainted live as the colours
// change, so the founder sees the result before saving.

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { notifyBrandingChanged } from "@/lib/brand-color-context";
import { cn } from "@/lib/utils";
import { WizardCard } from "./WhitelabelWizardShell";

const GARAGE_PRIMARY = "#FBD10D";
const GARAGE_SECONDARY = "#6366F1";

// Same eight swatches under both fields, matching the design.
const SWATCHES = [
  "#3B82F6",
  "#A855F7",
  "#22C55E",
  "#EF4444",
  "#F97316",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
];

const HEX_RE = /^#?[0-9a-f]{6}$/i;

function normalizeHex(value: string): string | null {
  const raw = value.trim();
  if (!HEX_RE.test(raw)) return null;
  return `#${raw.replace(/^#/, "").toUpperCase()}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace(/^#/, "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(hex: string, against: number): number {
  const l = luminance(hex);
  const [hi, lo] = l > against ? [l, against] : [against, l];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Which text colour sits on a button painted in `hex`, and whether white
 * text would have failed WCAG AA (4.5:1). Yellow-ish brand colours are the
 * common case — they need black text, and the founder should be told.
 */
function readability(hex: string): { onColor: string; lowContrast: boolean } {
  if (!HEX_RE.test(hex)) return { onColor: "#000000", lowContrast: false };
  const whiteContrast = contrast(hex, 1); // luminance of white === 1
  return {
    onColor: whiteContrast >= 4.5 ? "#FFFFFF" : "#000000",
    lowContrast: whiteContrast < 4.5,
  };
}

function ColorField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  invalid: boolean;
}) {
  const swatchColor = HEX_RE.test(value) ? value : "#2a2a35";
  return (
    <div>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#8b8ba3]">
        {label}
      </span>
      <div className="flex items-center gap-3">
        {/* Native picker, styled as the big rounded swatch from the design. */}
        <label
          className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/10"
          style={{ backgroundColor: swatchColor }}
          title="Pick a colour"
        >
          <input
            type="color"
            value={HEX_RE.test(value) ? value : "#000000"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} colour picker`}
          />
        </label>

        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          className={cn(
            "h-11 w-[116px] shrink-0 rounded-xl border bg-[#15151b] px-3 font-mono text-[13px] uppercase text-white outline-none transition-colors",
            invalid
              ? "border-red-500/50 focus:border-red-500"
              : "border-[#2a2a35] focus:border-brand/40",
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              aria-label={`Use ${hex}`}
              title={hex}
              style={{ backgroundColor: hex }}
              className={cn(
                "h-[18px] w-[18px] rounded-full transition-transform hover:scale-110",
                value.toUpperCase() === hex &&
                  "ring-2 ring-white/70 ring-offset-2 ring-offset-[#0e0e12]",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandPreview({
  primary,
  secondary,
  onColor,
}: {
  primary: string;
  secondary: string;
  onColor: string;
}) {
  const safePrimary = HEX_RE.test(primary) ? primary : GARAGE_PRIMARY;
  const safeSecondary = HEX_RE.test(secondary) ? secondary : GARAGE_SECONDARY;

  return (
    <div className="rounded-2xl border border-[#2a2a35] bg-[#101015] p-4">
      <span className="mb-3 block text-[10px] font-semibold uppercase tracking-wider text-[#6a6a7a]">
        Preview
      </span>

      <div className="overflow-hidden rounded-xl border border-[#23232d] bg-[#0b0b0f]">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[#23232d] px-3 py-2.5">
          <span
            className="h-5 w-5 rounded-md"
            style={{ backgroundColor: safePrimary }}
          />
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: safeSecondary, opacity: 0.85 }}
          />
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="w-[68px] shrink-0 space-y-2 border-r border-[#23232d] p-2.5">
            <span
              className="block h-4 w-4 rounded"
              style={{ backgroundColor: safePrimary }}
            />
            <span className="block h-4 w-4 rounded bg-[#23232d]" />
            <span className="block h-1.5 w-9 rounded-full bg-[#1c1c24]" />
            <span className="block h-1.5 w-7 rounded-full bg-[#1c1c24]" />
          </div>

          {/* Body card */}
          <div className="flex-1 p-3">
            <div className="rounded-lg border border-[#23232d] bg-[#131319] p-2.5">
              <div className="text-[10px] font-semibold text-white">
                Project overview
              </div>
              <div className="mt-2 space-y-1.5">
                <span className="block h-1.5 w-full rounded-full bg-[#22222b]" />
                <span className="block h-1.5 w-4/5 rounded-full bg-[#22222b]" />
                <span className="block h-1.5 w-3/5 rounded-full bg-[#22222b]" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className="inline-flex items-center rounded-md px-2.5 py-1 text-[9px] font-semibold"
                  style={{ backgroundColor: safePrimary, color: onColor }}
                >
                  Continue
                </span>
                <span
                  className="inline-flex items-center rounded-md px-2.5 py-1 text-[9px] font-medium"
                  style={{
                    border: `1px solid ${safeSecondary}`,
                    color: safeSecondary,
                  }}
                >
                  Invite
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: safeSecondary }}
              />
              <span className="text-[8.5px] text-[#6a6a7a]">
                Login page and system emails use these too
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WhitelabelBrandingStep({
  onNext,
  onSkip,
}: {
  onNext?: () => void;
  onSkip?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [primary, setPrimary] = useState(GARAGE_PRIMARY);
  const [secondary, setSecondary] = useState(GARAGE_SECONDARY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgId =
        typeof window !== "undefined"
          ? localStorage.getItem("garage_org_id")
          : null;
      if (!orgId) {
        setLoading(false);
        return;
      }
      try {
        const res = await api<{
          branding?: { primaryColor?: string; secondaryColor?: string };
        }>(`/org/${orgId}/branding`);
        if (cancelled) return;
        const p = res.branding?.primaryColor || GARAGE_PRIMARY;
        setPrimary(p.toUpperCase());
        setSecondary(
          (res.branding?.secondaryColor || p || GARAGE_SECONDARY).toUpperCase(),
        );
      } catch {
        // Branding is optional — fall back to Garage defaults rather than
        // blocking the wizard on a read failure.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const primaryHex = normalizeHex(primary);
  const secondaryHex = normalizeHex(secondary);
  const { onColor, lowContrast } = useMemo(
    () => readability(primaryHex || GARAGE_PRIMARY),
    [primaryHex],
  );

  const save = async (): Promise<boolean> => {
    if (!primaryHex || !secondaryHex) {
      toast.error("Enter both colours as 6-digit hex, like #FFB020.");
      return false;
    }
    const orgId =
      typeof window !== "undefined"
        ? localStorage.getItem("garage_org_id")
        : null;
    if (!orgId) {
      toast.error("No office selected");
      return false;
    }
    setSaving(true);
    try {
      await api(`/org/${orgId}/branding`, {
        method: "PUT",
        body: JSON.stringify({
          primaryColor: primaryHex,
          secondaryColor: secondaryHex,
        }),
      });
      // The app chrome is painted from these colours — repaint now rather
      // than leaving the old accent until the next reload.
      notifyBrandingChanged(orgId);
      toast.success("Branding saved");
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to save branding");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const body = loading ? (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
    </div>
  ) : (
    <>
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        {/* Controls */}
        <div className="space-y-5">
          <ColorField
            label="Primary"
            value={primary}
            onChange={setPrimary}
            invalid={!primaryHex}
          />

          <div>
            <ColorField
              label="Secondary"
              value={secondary}
              onChange={setSecondary}
              invalid={!secondaryHex}
            />
            <button
              type="button"
              onClick={() => setSecondary(primary)}
              className="mt-2 text-xs text-[#8b8ba3] transition-colors hover:text-white"
            >
              Match primary
            </button>
          </div>

          {lowContrast && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3">
              <span className="mt-[1px] text-[11px] text-amber-400">▲</span>
              <p className="text-xs leading-relaxed text-amber-300/90">
                Low contrast — button text may be hard to read. We&apos;ll use
                dark text on this colour.
              </p>
            </div>
          )}
        </div>

        {/* Live preview */}
        <BrandPreview
          primary={primaryHex || GARAGE_PRIMARY}
          secondary={secondaryHex || GARAGE_SECONDARY}
          onColor={onColor}
        />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-medium text-[#8b8ba3] transition-colors hover:text-white"
        >
          Skip — use Garage defaults
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            if (await save()) onNext?.();
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Next: email
        </button>
      </div>
    </>
  );

  return (
    <WizardCard
      step={2}
      title="Make it yours"
      subtitle="Applied across the web app, login page and system emails."
      wide
    >
      {body}
    </WizardCard>
  );
}
