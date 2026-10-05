import { useCallback, useState, type CSSProperties } from "react";
import type { DsField } from "@/lib/docusign/types";

// US Letter, used until a page reports its real size.
const DEFAULT_PAGE_SIZE_PT = { w: 612, h: 792 };

// The size a field is drawn at when the sender has not chosen one of its own — every field created
// before sizes were configurable, and any value the backend rejected. Must match DEFAULT_FONT_SIZE
// in the docusign backend (utils/fieldStyle.util.js): the editor preview, the signer's view and the
// final flattened PDF all resolve a field's size the same way, so all three agree.
export const DEFAULT_FONT_SIZE = 13;

// The range the sender can choose from, in PDF points. Must match FONT_SIZE_MIN/MAX in the backend's
// utils/fieldStyle.util.js, which in turn match the `fontSize` validators on ds_field/esign_field —
// a value outside this range is dropped server-side and the field silently falls back to the default.
export const FONT_SIZE_MIN = 6;
export const FONT_SIZE_MAX = 72;

// Sizes offered as one-click presets in the style panel, alongside the exact-value stepper.
export const FONT_SIZE_PRESETS = [10, 13, 16, 20, 24, 32];

export const clampFontSize = (pt: number) => Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(pt)));

// The single place a field's effective size is resolved. Everything that draws a field — the two
// editors, the internal signer, the external filler and the public signer — goes through this (via
// fieldTextStyle / signatureStyleOf), which is what keeps the sender's choice and what the recipient
// sees from ever drifting apart.
export const fontSizeOf = (f: { fontSize?: number }) => f.fontSize || DEFAULT_FONT_SIZE;

export const COLOR_PRESETS = ["#000000", "#ffffff", "#1d4ed8", "#dc2626", "#16a34a", "#6b7280"];

// Text-like fields (text, date, name, email, ...) are drawn as text with a font size and colour.
// Signature, initials and stamp are images; a checkbox is a tick mark.
export const supportsTextStyle = (type: DsField["type"]) =>
  type !== "signature" && type !== "initials" && type !== "stamp" && type !== "checkbox";

// Signature and initials are captured images, but the sender still chooses a colour and a size: both
// apply to the typed and drawn options when the signer signs (the size sets how large a typed
// signature is rendered). An uploaded image is kept as is.
export const isSignatureLike = (type: DsField["type"]) => type === "signature" || type === "initials";

// Fields that show the colour and text-size controls.
export const supportsFontControls = (type: DsField["type"]) => supportsTextStyle(type) || isSignatureLike(type);

// Font sizes are stored in PDF points (what the backend draws with). A page is always rendered
// at a fixed CSS width, so px = pt * renderedWidth / pageWidthPt.
export const ptToPx = (pt: number, pageWidthPt: number, renderedWidthPx: number) => (pt * renderedWidthPx) / pageWidthPt;

// Relative luminance test, so a white pen / text can be shown on a dark backdrop.
export const isLightColor = (hex: string | undefined) => {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.8;
};

// The text style to draw a field with: the sender's colour (if set) and the field's own font size,
// for text-like fields and signature/initials alike. Used by the editors AND both signer views, so
// a size set by the sender shows identically to whoever is signing.
export const fieldTextStyle = (
  f: { type: DsField["type"]; color?: string; fontSize?: number },
  pageWidthPt: number,
  renderedWidthPx: number
): CSSProperties => {
  if (supportsTextStyle(f.type) || isSignatureLike(f.type)) {
    return {
      ...(f.color ? { color: f.color } : {}),
      fontSize: ptToPx(fontSizeOf(f), pageWidthPt, renderedWidthPx),
      lineHeight: 1,
    };
  }
  return {};
};

// What the signature dialog needs to render a signature at the fixed size, exactly filling its box.
export interface SignatureStyle {
  fontSize: number;
  color?: string;
  boxWidthPt: number;
  boxHeightPt: number;
}

// Every signature/initials field renders at a concrete size — never "auto" — so this always returns
// a style for one, and undefined only for a field type that isn't signature-like at all.
export const signatureStyleOf = (
  f: { type: DsField["type"]; width: number; height: number; color?: string; fontSize?: number },
  pageSize: { w: number; h: number }
): SignatureStyle | undefined => {
  if (!isSignatureLike(f.type)) return undefined;
  return { fontSize: fontSizeOf(f), color: f.color, boxWidthPt: f.width * pageSize.w, boxHeightPt: f.height * pageSize.h };
};

// Fields that ask for the same style can share one captured signature; different styles need their
// own. fontSize is part of the key: two same-sized boxes asking for different type sizes are two
// different renderings, and without it the first capture would be reused at the wrong size.
export const signatureStyleKey = (style: SignatureStyle | undefined) => {
  if (!style) return "";
  return `${Math.round(style.boxWidthPt)}x${Math.round(style.boxHeightPt)}|${style.color ?? "default"}|${style.fontSize}`;
};

// Tracks each page's real size in PDF points, reported by <LazyPdfPage onPageSize>.
export function usePageSizes() {
  const [sizes, setSizes] = useState<Record<number, { w: number; h: number }>>({});
  const onPageSize = useCallback((page: number, w: number, h: number) => {
    setSizes((prev) => (prev[page]?.w === w && prev[page]?.h === h ? prev : { ...prev, [page]: { w, h } }));
  }, []);
  const sizeOf = (page: number) => sizes[page] ?? DEFAULT_PAGE_SIZE_PT;
  return { onPageSize, sizeOf };
}
