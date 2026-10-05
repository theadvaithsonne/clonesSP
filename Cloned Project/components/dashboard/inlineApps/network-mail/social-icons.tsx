"use client";

import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useNetworkMailEditor } from "./network-mail-editor-context";
import { resolveEditorImageSrc } from "./template-image-upload";
import { getSocialIconEmailImageSrc } from "./social-icon-email-urls";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Check,
  GripVertical,
  Link,
  Mail,
  Globe,
  Plus,
  Trash2,
  Upload,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
type EmailBlock = {
  id: string;
  type: string;
  content: Record<string, string>;
  styles: Record<string, string>;
};

export type SocialPlatform =
  | "facebook"
  | "twitter"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "pinterest"
  | "tiktok"
  | "whatsapp"
  | "email"
  | "website"
  | "custom";

export interface SocialIcon {
  id: string;
  platform: SocialPlatform;
  url: string;
  customIcon?: string;
  visible: boolean;
  order: number;
}

export const BRAND_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  twitter: "#000000",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  pinterest: "#E60023",
  tiktok: "#000000",
  whatsapp: "#25D366",
  email: "#6B7280",
  website: "#f5c518",
  custom: "#6B7280",
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  twitter: "Twitter / X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  email: "Email",
  website: "Website",
  custom: "Custom",
};

const DEFAULT_URLS: Partial<Record<SocialPlatform, string>> = {
  facebook: "https://facebook.com/",
  twitter: "https://twitter.com/",
  instagram: "https://instagram.com/",
  linkedin: "https://linkedin.com/",
  youtube: "https://youtube.com/",
  pinterest: "https://pinterest.com/",
  tiktok: "https://tiktok.com/",
  whatsapp: "https://wa.me/",
  email: "mailto:hello@yourcompany.com",
  website: "https://yourcompany.com",
};

const ALL_PLATFORMS: SocialPlatform[] = [
  "facebook", "twitter", "instagram", "linkedin", "youtube",
  "pinterest", "tiktok", "whatsapp", "email", "website",
];

function makeIconId() {
  return Math.random().toString(36).slice(2, 10);
}

export function makeDefaultSocialIcons(): SocialIcon[] {
  const defaults: SocialPlatform[] = ["facebook", "twitter", "instagram", "linkedin"];
  return ALL_PLATFORMS.map((platform, i) => ({
    id: makeIconId(),
    platform,
    url: DEFAULT_URLS[platform] || "",
    visible: defaults.includes(platform),
    order: i,
  }));
}

export function parseSocialIcons(json: string): SocialIcon[] {
  try {
    const parsed = JSON.parse(json) as SocialIcon[];
    return [...parsed].sort((a, b) => a.order - b.order);
  } catch {
    return makeDefaultSocialIcons();
  }
}

export function serializeSocialIcons(icons: SocialIcon[]): string {
  return JSON.stringify(icons);
}

export function getVisibleIcons(icons: SocialIcon[]): SocialIcon[] {
  return icons.filter((i) => i.visible).sort((a, b) => a.order - b.order);
}

/* ─── SVG paths (24x24 viewBox) ─── */

const ICON_PATHS: Record<SocialPlatform, string> = {
  facebook: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  instagram: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 24.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  youtube: "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  pinterest: "M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.403.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z",
  tiktok: "M12.525.02c1.31-.02 2.61-.01 3.919-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 3.97.01 7.94-.02 11.91-.14 3.45-2.94 6.41-6.35 6.89-1.83.27-3.67-.09-5.26-1.03-2.17-1.25-3.56-3.74-3.65-6.24-.13-3.16 1.73-6.01 4.61-7.44 1.49-.75 3.12-1.01 4.73-.86.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  whatsapp: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
  email: "",
  website: "",
  custom: "",
};

export function getIconFillColor(platform: SocialPlatform, iconStyle: string, monoColor: string): string {
  if (iconStyle === "colored") return BRAND_COLORS[platform] || monoColor;
  return monoColor || "#333333";
}

export function getIconContainerStyle(
  s: Record<string, string>,
  fillColor: string,
): React.CSSProperties {
  const size = Number(s.size) || 36;
  const radius = s.borderRadius === "999" ? size / 2 : Number(s.borderRadius) || 0;
  const base: React.CSSProperties = {
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "transform 150ms ease, background-color 150ms ease",
  };

  switch (s.iconStyle) {
    case "solid-circle":
      return { ...base, borderRadius: size / 2, backgroundColor: s.backgroundColor || fillColor, border: "none" };
    case "solid-rounded":
      return { ...base, borderRadius: radius, backgroundColor: s.backgroundColor || fillColor, border: "none" };
    case "outlined":
      return {
        ...base,
        borderRadius: radius,
        backgroundColor: "transparent",
        border: `${s.borderWidth || "1"}px solid ${s.borderColor || fillColor}`,
      };
    case "icon-only":
      return { ...base, backgroundColor: "transparent", border: "none" };
    case "monochrome":
    default:
      return {
        ...base,
        borderRadius: radius,
        backgroundColor: s.backgroundColor && s.backgroundColor !== "transparent" ? s.backgroundColor : "transparent",
        border: Number(s.borderWidth) > 0 ? `${s.borderWidth}px solid ${s.borderColor || fillColor}` : "none",
      };
  }
}

function iconGlyphColor(platform: SocialPlatform, iconStyle: string, fillColor: string): string {
  if (iconStyle === "colored") return "#ffffff";
  if (iconStyle === "solid-circle" || iconStyle === "solid-rounded") return "#ffffff";
  return fillColor;
}

export function SocialIconGlyph({
  platform,
  iconStyle,
  monoColor,
  customIcon,
  size,
}: {
  platform: SocialPlatform;
  iconStyle: string;
  monoColor: string;
  customIcon?: string;
  size: number;
}) {
  const fillColor = getIconFillColor(platform, iconStyle, monoColor);
  const glyphColor = iconGlyphColor(platform, iconStyle, fillColor);
  const glyphSize = Math.round(size * 0.5);

  if (platform === "custom" && customIcon) {
    return <img src={customIcon} alt="" className="object-contain" style={{ width: glyphSize, height: glyphSize }} />;
  }

  if (platform === "email") {
    return <Mail style={{ width: glyphSize, height: glyphSize, color: glyphColor }} />;
  }
  if (platform === "website") {
    return <Globe style={{ width: glyphSize, height: glyphSize, color: glyphColor }} />;
  }

  const path = ICON_PATHS[platform];
  if (!path) return null;

  return (
    <svg width={glyphSize} height={glyphSize} viewBox="0 0 24 24" fill={glyphColor} aria-hidden>
      <path d={path} />
    </svg>
  );
}

/** Escape for HTML attribute values (preserves data: URIs; does not encode &lt; &gt;). */
export function escAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function getEmailIconStyles(s: Record<string, string>, platform: string): string {
  const iconStyle = s.iconStyle || "colored";
  const size = Number(s.size) || 36;
  const radius = s.borderRadius === "999" ? size / 2 : Number(s.borderRadius) || 0;
  const fill = getIconFillColor(platform as any, iconStyle, s.color || "#333");

  const baseStyles = [
    `width:${size}px`,
    `height:${size}px`,
    `display:inline-block`,
    `text-align:center`,
    `vertical-align:middle`,
    `box-sizing:border-box`,
    `line-height:0`,
    `overflow:hidden`,
    `outline:none`,
    `border:0`,
  ];

  if (iconStyle === "colored") {
    const brand = BRAND_COLORS[platform as SocialPlatform] || fill;
    baseStyles.push(`border-radius:${radius || 8}px`);
    baseStyles.push(`background-color:${brand}`);
  } else if (iconStyle === "solid-circle") {
    baseStyles.push(`border-radius:${size / 2}px`);
    baseStyles.push(`background-color:${s.backgroundColor || fill}`);
    baseStyles.push(`border:none`);
  } else if (iconStyle === "solid-rounded") {
    baseStyles.push(`border-radius:${radius}px`);
    baseStyles.push(`background-color:${s.backgroundColor || fill}`);
    baseStyles.push(`border:none`);
  } else if (iconStyle === "outlined") {
    baseStyles.push(`border-radius:${radius}px`);
    baseStyles.push(`background-color:transparent`);
    baseStyles.push(`border:${s.borderWidth || "1"}px solid ${s.borderColor || fill}`);
  } else if (iconStyle === "icon-only") {
    baseStyles.push(`background-color:transparent`);
    baseStyles.push(`border:none`);
  } else {
    // monochrome / default
    baseStyles.push(`border-radius:${radius}px`);
    const bg = s.backgroundColor && s.backgroundColor !== "transparent" ? s.backgroundColor : "transparent";
    baseStyles.push(`background-color:${bg}`);
    if (Number(s.borderWidth) > 0) {
      baseStyles.push(`border:${s.borderWidth}px solid ${s.borderColor || fill}`);
    } else {
      baseStyles.push(`border:none`);
    }
  }

  return baseStyles.join(";");
}

/** ~62% of tile — matches editor proportions; 96px sources stay sharp when scaled down. */
function emailSocialGlyphMetrics(size: number, iconStyle: string): { glyphSize: number; pad: number } {
  if (iconStyle === "icon-only") return { glyphSize: size, pad: 0 };
  const glyphSize = Math.max(16, Math.round(size * 0.62));
  const pad = Math.max(0, Math.round((size - glyphSize) / 2));
  return { glyphSize, pad };
}

/** Inline social icon row (no outer <tr>) for nesting in footer cells. */
export function renderSocialIconsInlineHtml(
  s: Record<string, string>,
  iconsJson: string,
  esc: (str: string) => string,
): string {
  const icons = getVisibleIcons(parseSocialIcons(iconsJson || "[]"));
  if (icons.length === 0) return "";

  const align = s.align === "left" ? "left" : s.align === "right" ? "right" : "center";
  const size = Number(s.size) || 32;
  const gap = Number(s.spacing) || 8;
  const iconStyle = s.iconStyle || "colored";

  const cells = icons
    .map((icon) => {
      const href =
        icon.platform === "email" && icon.url && !icon.url.startsWith("mailto:")
          ? `mailto:${icon.url}`
          : icon.url || "#";
      const src = getSocialIconEmailImageSrc(icon.platform, iconStyle, icon.customIcon);
      if (!src) return "";

      const { glyphSize, pad } = emailSocialGlyphMetrics(size, iconStyle);
      const inlineStyle = getEmailIconStyles(s, icon.platform);

      const img = `<img src="${escAttr(src)}" alt="${esc(PLATFORM_LABELS[icon.platform])}" width="${glyphSize}" height="${glyphSize}" style="display:block;width:${glyphSize}px;height:${glyphSize}px;margin:${pad}px auto;border:0;outline:none;-ms-interpolation-mode:bicubic;" />`;
      const linked = `<a href="${escAttr(href)}" target="_blank" class="social-link" style="text-decoration:none;display:inline-block;transition:all 150ms ease;${inlineStyle}">${img}</a>`;
      return `<td style="padding:0 ${gap / 2}px;" align="center" valign="middle">${linked}</td>`;
    })
    .filter(Boolean);

  if (cells.length === 0) return "";

  const marginStyle = align === "left" ? "margin:0 auto 0 0;" : align === "right" ? "margin:0 0 0 auto;" : "margin:0 auto;";
  const innerTable = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="border-collapse:collapse;${marginStyle}"><tr>${cells.join("")}</tr></table>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td align="${align}" style="padding:0 0 16px 0;line-height:0;font-size:0;">${innerTable}</td></tr></table>`;
}

export function renderSocialIconsEmail(
  s: Record<string, string>,
  content: Record<string, string>,
  esc: (str: string) => string,
): string {
  const icons = getVisibleIcons(parseSocialIcons(content.icons || "[]"));
  if (icons.length === 0) return "";

  const align = s.align === "left" ? "left" : s.align === "right" ? "right" : "center";
  const size = Number(s.size) || 36;
  const gap = Number(s.spacing) || 12;
  const perRow = Number(s.iconsPerRow) || icons.length;
  const iconStyle = s.iconStyle || "colored";
  const cells = icons
    .map((icon) => {
      const href =
        icon.platform === "email" && icon.url && !icon.url.startsWith("mailto:")
          ? `mailto:${icon.url}`
          : icon.url || "#";
      const src = getSocialIconEmailImageSrc(icon.platform, iconStyle, icon.customIcon);
      if (!src) return "";

      const { glyphSize, pad } = emailSocialGlyphMetrics(size, iconStyle);
      const inlineStyle = getEmailIconStyles(s, icon.platform);

      const img = `<img src="${escAttr(src)}" alt="${esc(PLATFORM_LABELS[icon.platform])}" width="${glyphSize}" height="${glyphSize}" style="display:block;width:${glyphSize}px;height:${glyphSize}px;margin:${pad}px auto;border:0;outline:none;-ms-interpolation-mode:bicubic;" />`;
      const linked = `<a href="${escAttr(href)}" target="_blank" class="social-link" style="text-decoration:none;display:inline-block;transition:all 150ms ease;${inlineStyle}">${img}</a>`;
      return `<td style="padding:0 ${gap / 2}px;" align="center" valign="middle">${linked}</td>`;
    })
    .filter(Boolean);

  if (cells.length === 0) return "";

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += perRow) {
    rows.push(`<tr>${cells.slice(i, i + perRow).join("")}</tr>`);
  }

  const wrapClass = s.wrapOnMobile === "true" ? "stack-on-mobile" : "";
  const marginStyle = align === "left" ? "margin:0 auto 0 0;" : align === "right" ? "margin:0 0 0 auto;" : "margin:0 auto;";
  return `<tr><td style="padding:${s.paddingTop}px 24px ${s.paddingBottom}px 24px;margin:${s.marginTop}px 0 ${s.marginBottom}px 0;text-align:${align};"><table role="presentation" align="${align}" class="${wrapClass}" style="border-collapse:collapse;${marginStyle}display:inline-table;"><tbody>${rows.join("")}</tbody></table></td></tr>`;
}

export function createSocialIconsBlockContent(): Record<string, string> {
  return { icons: serializeSocialIcons(makeDefaultSocialIcons()) };
}

export function createSocialIconsBlockStyles(): Record<string, string> {
  return {
    iconStyle: "colored",
    size: "32",
    color: "#333333",
    backgroundColor: "#f3f4f6",
    borderRadius: "4",
    borderWidth: "0",
    borderColor: "#e5e7eb",
    align: "center",
    spacing: "12",
    iconsPerRow: "4",
    wrapOnMobile: "false",
    paddingTop: "24",
    paddingBottom: "24",
    marginTop: "0",
    marginBottom: "0",
    hoverEffect: "grow",
    hoverColor: "#f5c518",
  };
}

const ICON_STYLE_OPTIONS = [
  { value: "colored", label: "Colored (brand)" },
  { value: "monochrome", label: "Monochrome" },
  { value: "outlined", label: "Outlined" },
  { value: "solid-circle", label: "Solid circles" },
  { value: "solid-rounded", label: "Rounded squares" },
  { value: "icon-only", label: "Just icons" },
];

const HOVER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "grow", label: "Grow" },
  { value: "lift", label: "Lift" },
  { value: "color-change", label: "Color change" },
];

function PropertyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-[#7a7a7a] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function PropInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-brand/50 transition-colors"
    />
  );
}

function SliderInput({
  label, min, max, value, onChange, unit = "px", step = 1,
}: {
  label: string; min: number; max: number; value: string; onChange: (v: string) => void; unit?: string; step?: number;
}) {
  const numVal = Number(value) || min;
  return (
    <PropertyField label={label}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={numVal} onChange={(e) => onChange(e.target.value)} className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-brand cursor-pointer" />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} className="w-14 h-8 px-2 rounded-lg border border-white/10 bg-white/[0.04] text-[12px] text-white text-center outline-none tabular-nums" />
        {unit && <span className="text-[11px] text-[#7a7a7a] w-5">{unit}</span>}
      </div>
    </PropertyField>
  );
}

function PropSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white outline-none focus:border-brand/50 appearance-none cursor-pointer">
      {options.map((o) => <option key={o.value} value={o.value} className="bg-[#1a1a1a]">{o.label}</option>)}
    </select>
  );
}

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-3 cursor-pointer">
        <span className="text-[12px] font-semibold text-[#a8a8a8] uppercase tracking-wider">{title}</span>
        <span className="text-[#7a7a7a] text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="pb-4 space-y-3.5">{children}</div>}
    </div>
  );
}

export function SocialIconsBlockRenderer({
  block,
  onSelect,
  onUpdate,
}: {
  block: EmailBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (b: EmailBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const s = block.styles;
  const icons = useMemo(() => parseSocialIcons(block.content.icons || "[]"), [block.content.icons]);
  const visible = getVisibleIcons(icons);
  const [focusedIconId, setFocusedIconId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const updateIcons = (next: SocialIcon[]) => {
    onUpdate({ ...block, content: { ...block.content, icons: serializeSocialIcons(next) } });
  };

  const alignStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: s.wrapOnMobile === "true" ? "wrap" : "nowrap",
    justifyContent: s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center",
    gap: `${s.spacing}px`,
    paddingTop: `${s.paddingTop}px`,
    paddingBottom: `${s.paddingBottom}px`,
    paddingLeft: 24,
    paddingRight: 24,
    marginTop: `${s.marginTop}px`,
    marginBottom: `${s.marginBottom}px`,
  };

  const perRow = Number(s.iconsPerRow) || visible.length;
  const maxWidth = perRow > 0 ? perRow * (Number(s.size) + Number(s.spacing)) : undefined;

  const getHoverClass = (id: string) => {
    if (hoveredId !== id || s.hoverEffect === "none") return "";
    if (s.hoverEffect === "grow") return "scale-110";
    if (s.hoverEffect === "lift") return "-translate-y-0.5";
    return "";
  };

  return (
    <div style={alignStyle}>
      <div
        className="flex flex-wrap items-center"
        style={{ gap: `${s.spacing}px`, maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
      >
        {visible.length === 0 ? (
          <p className="text-[13px] text-[#9ca3af] py-4">Enable platforms in the properties panel</p>
        ) : (
          visible.map((icon) => {
            const iconStyle = s.iconStyle || "colored";
            const fill = getIconFillColor(icon.platform, iconStyle, s.color || "#333");
            const size = Number(s.size) || 36;
            const radius = s.borderRadius === "999" ? size / 2 : Number(s.borderRadius) || 0;
            const container: React.CSSProperties =
              iconStyle === "colored"
                ? {
                    width: size,
                    height: size,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    borderRadius: radius || 8,
                    backgroundColor: BRAND_COLORS[icon.platform] || fill,
                    border: "none",
                    transition: "transform 150ms ease, background-color 150ms ease",
                  }
                : getIconContainerStyle(s, fill);
            const isFocused = focusedIconId === icon.id;
            return (
              <button
                key={icon.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(); setFocusedIconId(icon.id); }}
                onMouseEnter={() => setHoveredId(icon.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`cursor-pointer transition-all ${getHoverClass(icon.id)} ${isFocused ? "ring-2 ring-brand ring-offset-2 rounded-lg" : ""}`}
                style={{
                  ...container,
                  ...(s.hoverEffect === "color-change" && hoveredId === icon.id
                    ? { backgroundColor: s.hoverColor || "#f5c518" }
                    : {}),
                }}
                title={icon.url || PLATFORM_LABELS[icon.platform]}
              >
                <SocialIconGlyph
                  platform={icon.platform}
                  iconStyle={s.iconStyle || "colored"}
                  monoColor={s.color || "#333"}
                  customIcon={icon.customIcon}
                  size={Number(s.size) || 36}
                />
              </button>
            );
          })
        )}
      </div>
      {focusedIconId && (
        <div
          className="mx-6 mt-2 p-3 rounded-lg border border-brand/30 bg-[#141414]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] font-medium text-[#a8a8a8] mb-1.5 flex items-center gap-1">
            <Link className="h-3 w-3 text-brand" />
            Edit link — {PLATFORM_LABELS[icons.find((i) => i.id === focusedIconId)?.platform || "facebook"]}
          </p>
          <PropInput
            value={icons.find((i) => i.id === focusedIconId)?.url || ""}
            onChange={(v) => {
              updateIcons(icons.map((i) => (i.id === focusedIconId ? { ...i, url: v } : i)));
            }}
            placeholder="https://..."
          />
        </div>
      )}
    </div>
  );
}

export function SocialIconsPropertiesPanel({
  block,
  onUpdate,
  onDelete,
  ColorPicker,
}: {
  block: EmailBlock;
  onUpdate: (b: EmailBlock) => void;
  onDelete: () => void;
  ColorPicker: React.ComponentType<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    allowTransparent?: boolean;
  }>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const s = block.styles;
  const icons = parseSocialIcons(block.content.icons || "[]");

  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...block.styles, [key]: val } });
  const updateIcons = (next: SocialIcon[]) => {
    onUpdate({ ...block, content: { ...block.content, icons: serializeSocialIcons(next) } });
  };

  const toggleVisible = (id: string) => {
    updateIcons(icons.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)));
  };

  const setIconUrl = (id: string, url: string) => {
    updateIcons(icons.map((i) => (i.id === id ? { ...i, url } : i)));
  };

  const moveIcon = (id: string, dir: -1 | 1) => {
    const sorted = [...icons].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((i) => i.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swap];
    updateIcons(
      icons.map((i) => {
        if (i.id === a.id) return { ...i, order: b.order };
        if (i.id === b.id) return { ...i, order: a.order };
        return i;
      }),
    );
  };

  const addCustomIcon = () => {
    const maxOrder = Math.max(...icons.map((i) => i.order), 0);
    updateIcons([
      ...icons,
      { id: makeIconId(), platform: "custom", url: "https://", customIcon: "", visible: true, order: maxOrder + 1 },
    ]);
  };

  const editor = useNetworkMailEditor();

  const handleCustomUpload = async (file: File, iconId: string) => {
    if (file.size > 512 * 1024) { alert("Icon must be under 512KB"); return; }
    try {
      const url = await resolveEditorImageSrc(file, "social-icon", editor);
      updateIcons(icons.map((i) => (i.id === iconId ? { ...i, customIcon: url } : i)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Social Icons</h4>
        <button type="button" onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400" />
        </button>
      </div>

      <CollapsibleSection title="Icons">
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {[...icons].sort((a, b) => a.order - b.order).map((icon, idx, arr) => (
            <div key={icon.id} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 text-[#7a7a7a] shrink-0" />
                <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                  <div
                    onClick={() => toggleVisible(icon.id)}
                    className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${icon.visible ? "bg-brand border-brand" : "border-white/20"}`}
                  >
                    {icon.visible && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <span className="text-[12px] text-white truncate">{PLATFORM_LABELS[icon.platform]}</span>
                </label>
                <div className="flex shrink-0">
                  <button type="button" disabled={idx === 0} onClick={() => moveIcon(icon.id, -1)} className="h-6 w-6 flex items-center justify-center text-[#7a7a7a] hover:text-white disabled:opacity-30 cursor-pointer">
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button type="button" disabled={idx === arr.length - 1} onClick={() => moveIcon(icon.id, 1)} className="h-6 w-6 flex items-center justify-center text-[#7a7a7a] hover:text-white disabled:opacity-30 cursor-pointer">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {icon.visible && (
                <PropInput
                  value={icon.url}
                  onChange={(v) => setIconUrl(icon.id, v)}
                  placeholder={icon.platform === "email" ? "mailto:hello@company.com" : DEFAULT_URLS[icon.platform] || "https://"}
                />
              )}
              {icon.platform === "custom" && (
                <>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCustomUpload(f, icon.id); }} />
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-full h-8 rounded-lg bg-white/[0.04] text-[11px] text-[#a8a8a8] hover:text-white border border-white/8 cursor-pointer flex items-center justify-center gap-1">
                    <Upload className="h-3 w-3" /> Upload icon
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addCustomIcon} className="w-full h-8 mt-2 rounded-lg border border-dashed border-white/15 text-[12px] text-[#a8a8a8] hover:text-white hover:border-brand/40 cursor-pointer flex items-center justify-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Add custom icon
        </button>
      </CollapsibleSection>

      <CollapsibleSection title="Style">
        <PropertyField label="Icon style">
          <PropSelect value={s.iconStyle || "colored"} onChange={(v) => setStyle("iconStyle", v)} options={ICON_STYLE_OPTIONS} />
        </PropertyField>
        <SliderInput label="Icon size" min={24} max={64} value={s.size || "36"} onChange={(v) => setStyle("size", v)} />
        {(s.iconStyle === "monochrome" || s.iconStyle === "icon-only" || s.iconStyle === "outlined") && (
          <ColorPicker label="Icon color" value={s.color || "#333333"} onChange={(v) => setStyle("color", v)} />
        )}
        {(s.iconStyle === "solid-circle" || s.iconStyle === "solid-rounded" || s.iconStyle === "monochrome") && (
          <ColorPicker label="Background color" value={s.backgroundColor || "#f3f4f6"} onChange={(v) => setStyle("backgroundColor", v)} allowTransparent />
        )}
        <SliderInput label="Border radius" min={0} max={50} value={s.borderRadius === "999" ? "50" : (s.borderRadius || "0")} onChange={(v) => setStyle("borderRadius", v)} />
        <button type="button" onClick={() => setStyle("borderRadius", s.borderRadius === "999" ? "8" : "999")} className={`w-full h-8 rounded-lg text-[11px] font-medium cursor-pointer ${s.borderRadius === "999" ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8"}`}>
          Circle preset
        </button>
        {s.iconStyle === "outlined" && (
          <>
            <SliderInput label="Border width" min={0} max={5} value={s.borderWidth || "1"} onChange={(v) => setStyle("borderWidth", v)} />
            <ColorPicker label="Border color" value={s.borderColor || "#e5e7eb"} onChange={(v) => setStyle("borderColor", v)} />
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Layout">
        <div className="grid grid-cols-3 gap-1.5">
          {([{ value: "left", Icon: AlignLeft }, { value: "center", Icon: AlignCenter }, { value: "right", Icon: AlignRight }] as const).map(({ value, Icon }) => (
            <button key={value} type="button" onClick={() => setStyle("align", value)} className={`h-9 rounded-lg flex items-center justify-center cursor-pointer ${s.align === value ? "bg-brand/15 text-brand border border-brand/30" : "bg-white/[0.04] text-[#7a7a7a] border border-white/8"}`}>
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <SliderInput label="Spacing between icons" min={4} max={40} value={s.spacing || "12"} onChange={(v) => setStyle("spacing", v)} />
        <PropertyField label="Icons per row">
          <PropInput value={s.iconsPerRow || String(icons.filter((i) => i.visible).length)} onChange={(v) => setStyle("iconsPerRow", v)} placeholder="4" type="number" />
        </PropertyField>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div onClick={() => setStyle("wrapOnMobile", s.wrapOnMobile === "true" ? "false" : "true")} className={`h-[18px] w-[18px] rounded border flex items-center justify-center cursor-pointer ${s.wrapOnMobile === "true" ? "bg-brand border-brand" : "border-white/20"}`}>
            {s.wrapOnMobile === "true" && <Check className="h-3 w-3 text-brand-foreground" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8]">Wrap on mobile</span>
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Spacing">
        <SliderInput label="Padding top" min={8} max={80} value={s.paddingTop || "16"} onChange={(v) => setStyle("paddingTop", v)} />
        <SliderInput label="Padding bottom" min={8} max={80} value={s.paddingBottom || "16"} onChange={(v) => setStyle("paddingBottom", v)} />
        <SliderInput label="Margin top" min={0} max={60} value={s.marginTop || "0"} onChange={(v) => setStyle("marginTop", v)} />
        <SliderInput label="Margin bottom" min={0} max={60} value={s.marginBottom || "16"} onChange={(v) => setStyle("marginBottom", v)} />
      </CollapsibleSection>

      <CollapsibleSection title="Hover effects" defaultOpen={false}>
        <PropertyField label="Hover style">
          <PropSelect value={s.hoverEffect || "none"} onChange={(v) => setStyle("hoverEffect", v)} options={HOVER_OPTIONS} />
        </PropertyField>
        {s.hoverEffect === "color-change" && (
          <ColorPicker label="Hover color" value={s.hoverColor || "#f5c518"} onChange={(v) => setStyle("hoverColor", v)} />
        )}
      </CollapsibleSection>
    </div>
  );
}
