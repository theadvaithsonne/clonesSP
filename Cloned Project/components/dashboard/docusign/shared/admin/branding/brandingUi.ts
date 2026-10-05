// Small shared pieces of the Branding editor: its larger form styling (the design's inputs are roomier
// than the module's compact INPUT token), colour helpers, and draft normalisation for dirty-checking.

import type { DsBranding, DsBrandingEditor, DsBrandingFieldError, DsEmailContent, DsEmailKind } from "@/lib/docusign/types";

export const FIELD_LABEL = "text-[13px] text-white/70";
export const FIELD_HINT = "text-[11px] text-[#7a7a90]";
export const FIELD_ERROR = "text-[11px] text-red-400";
export const TEXT_INPUT =
  "h-11 w-full rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-3.5 text-sm text-white/90 placeholder:text-[#5a5a72] focus:border-[#3b3b4a] focus:outline-none";
export const TEXT_AREA =
  "w-full resize-y rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-3.5 py-3 text-sm leading-relaxed text-white/90 placeholder:text-[#5a5a72] focus:border-[#3b3b4a] focus:outline-none";
export const SECTION = "space-y-4 rounded-2xl border border-[#2a2a35] bg-[#111116] p-5";
export const SECTION_TITLE = "text-sm font-semibold text-white/90";
export const SECTION_SUBTITLE = "text-xs text-[#7a7a90]";

export const ACCENT_SWATCHES = ["#fbd10d", "#111111", "#4f46e5", "#2563eb", "#16a34a", "#dc2626", "#ea580c", "#db2777"];

export const HEX_RE = /^#[0-9a-f]{6}$/i;

// Black or white text, whichever reads better on `hex` — the same rule the backend uses for the email button.
export const readableTextOn = (hex: string) => {
  const m = HEX_RE.test(hex) ? hex.slice(1) : "fbd10d";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance + 0.05) / 0.057 >= 1.05 / (luminance + 0.05) ? "#141414" : "#ffffff";
};

export const errorFor = (errors: DsBrandingFieldError[], field: string) => errors.find((e) => e.field === field)?.message;

// The form holds the full wording of every email (so it can be edited in place); text equal to the default,
// or left empty, both mean "use the default". Normalising that away makes the dirty check compare meaning,
// not representation.
export const normalizeBranding = (b: DsBranding, defaults: DsBrandingEditor["defaults"]): DsBranding => {
  const content = {} as Record<DsEmailKind, DsEmailContent>;
  for (const kind of Object.keys(b.content) as DsEmailKind[]) {
    const given = b.content[kind];
    const def = defaults.content[kind];
    content[kind] = {
      subject: given.subject.trim() === def.subject ? "" : given.subject.trim(),
      heading: given.heading.trim() === def.heading ? "" : given.heading.trim(),
      body: given.body.trim() === def.body ? "" : given.body.trim(),
      buttonLabel: given.buttonLabel.trim() === def.buttonLabel ? "" : given.buttonLabel.trim(),
    };
  }
  return {
    ...b,
    replyToEmail: b.replyToEmail.trim(),
    footerText: b.footerText.trim(),
    accentColor: b.accentColor.toLowerCase(),
    content,
  };
};

// What the editor starts from: the saved overrides with every empty field filled with its default wording,
// so each field shows (and can be edited from) the text that actually goes out.
export const withDefaultsFilled = (b: DsBranding, defaults: DsBrandingEditor["defaults"]): DsBranding => {
  const content = {} as Record<DsEmailKind, DsEmailContent>;
  for (const kind of Object.keys(defaults.content) as DsEmailKind[]) {
    const given = b.content?.[kind] || { subject: "", heading: "", body: "", buttonLabel: "" };
    const def = defaults.content[kind];
    content[kind] = {
      subject: given.subject || def.subject,
      heading: given.heading || def.heading,
      body: given.body || def.body,
      buttonLabel: given.buttonLabel || def.buttonLabel,
    };
  }
  return { ...b, content };
};
