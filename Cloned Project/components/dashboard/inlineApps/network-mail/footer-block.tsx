"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  parseSocialIcons,
  getVisibleIcons,
  SocialIconGlyph,
  BRAND_COLORS,
  makeDefaultSocialIcons,
  serializeSocialIcons,
  renderSocialIconsInlineHtml,
} from "./social-icons";

type EmailBlock = {
  id: string;
  type: string;
  content: Record<string, string>;
  styles: Record<string, string>;
};

export type FooterLinkType = "unsubscribe" | "privacy" | "terms" | "preferences" | "custom";

export interface FooterLink {
  id: string;
  text: string;
  url: string;
  type: FooterLinkType;
  visible: boolean;
}

function makeLinkId() {
  return Math.random().toString(36).slice(2, 10);
}

export function makeDefaultFooterLinks(): FooterLink[] {
  return [
    { id: makeLinkId(), text: "Unsubscribe", url: "{{unsubscribe_url}}", type: "unsubscribe", visible: true },
    { id: makeLinkId(), text: "Privacy Policy", url: "", type: "privacy", visible: true },
  ];
}

export function parseFooterLinks(json: string): FooterLink[] {
  try {
    return JSON.parse(json) as FooterLink[];
  } catch {
    return makeDefaultFooterLinks();
  }
}

export function serializeFooterLinks(links: FooterLink[]): string {
  return JSON.stringify(links);
}

export function formatAddress(c: Record<string, string>): string {
  const line1 = c.street?.trim();
  const line2 = [c.city, c.state].filter(Boolean).join(", ");
  const line3 = [line2, c.zip].filter(Boolean).join(" ").trim();
  const country = c.country?.trim();
  return [line1, line3, country].filter(Boolean).join("\n");
}

/** Inverse of formatAddress — used by sidebar textarea and preview editor. */
export function parseAddressFromEditor(text: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
} {
  const lines = text.split("\n").map((l) => l.replace(/\r/g, ""));
  const street = (lines[0] || "").trim();
  let city = "";
  let state = "";
  let zip = "";
  let country = "";

  const cityStateZipLine = (lines[1] || "").trim();
  if (cityStateZipLine) {
    const commaIdx = cityStateZipLine.indexOf(",");
    if (commaIdx >= 0) {
      city = cityStateZipLine.slice(0, commaIdx).trim();
      const afterComma = cityStateZipLine.slice(commaIdx + 1).trim();
      const tokens = afterComma.split(/\s+/).filter(Boolean);
      state = tokens[0] || "";
      zip = tokens.slice(1).join(" ") || "";
    } else {
      const tokens = cityStateZipLine.split(/\s+/).filter(Boolean);
      if (tokens.length >= 3) {
        city = tokens[0] || "";
        state = tokens[1] || "";
        zip = tokens.slice(2).join(" ") || "";
      } else if (tokens.length === 2) {
        city = tokens[0] || "";
        state = tokens[1] || "";
      } else {
        city = cityStateZipLine;
      }
    }
  }

  country = (lines[2] || "").trim();
  return { street, city, state, zip, country };
}

export function applyAddressFields(
  content: Record<string, string>,
  text: string,
): Record<string, string> {
  const parsed = parseAddressFromEditor(text);
  return {
    ...content,
    street: parsed.street,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
    country: parsed.country,
  };
}

/** Phone + contact email row for email HTML (escape each field; do not esc the separator entity). */
export function renderFooterPhoneEmailHtml(
  content: Record<string, string>,
  esc: (str: string) => string,
  textColor: string,
  linkColor: string,
): string {
  const parts: string[] = [];
  const phone = (content.phone || "").trim();
  const email = (content.contactEmail || "").trim();

  if (phone) {
    const telDigits = phone.replace(/[^\d+]/g, "");
    const href = telDigits ? `tel:${telDigits}` : "#";
    parts.push(
      `<a href="${esc(href)}" style="color:${textColor};text-decoration:none;">${esc(phone)}</a>`,
    );
  }
  if (email) {
    parts.push(
      `<a href="mailto:${esc(email)}" style="color:${linkColor};text-decoration:underline;">${esc(email)}</a>`,
    );
  }
  if (parts.length === 0) return "";
  return `<p style="margin:0 0 8px 0;color:${textColor};">${parts.join(" &#183; ")}</p>`;
}

export function createFooterBlockContent(): Record<string, string> {
  return {
    companyName: "Your Company",
    street: "123 Main Street",
    city: "City",
    state: "ST",
    zip: "12345",
    country: "USA",
    phone: "",
    contactEmail: "",
    copyrightText: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
    disclosureText: "You're receiving this email because you signed up for updates from our website.",
    links: serializeFooterLinks(makeDefaultFooterLinks()),
    includeSocialIcons: "false",
    socialIcons: serializeSocialIcons(makeDefaultSocialIcons()),
    showPhysicalAddress: "true",
    showUnsubscribe: "true",
  };
}

export function createFooterBlockStyles(): Record<string, string> {
  return {
    layout: "centered",
    backgroundColor: "#F3F4F6",
    textColor: "#6B7280",
    linkColor: "#f5c518",
    fontSize: "12",
    lineHeight: "1.6",
    borderTopEnabled: "true",
    borderTopWidth: "1",
    borderTopColor: "#E5E7EB",
    paddingTop: "40",
    paddingRight: "20",
    paddingBottom: "40",
    paddingLeft: "20",
  };
}

export const FOOTER_PRESETS = {
  minimal: {
    label: "Minimal",
    content: {
      companyName: "Company Name",
      street: "123 Main St",
      city: "City",
      state: "ST",
      zip: "12345",
      country: "",
      phone: "",
      contactEmail: "",
      copyrightText: `© ${new Date().getFullYear()} Company Name`,
      disclosureText: "",
      links: serializeFooterLinks([
        { id: makeLinkId(), text: "Unsubscribe", url: "{{unsubscribe_url}}", type: "unsubscribe", visible: true },
      ]),
      includeSocialIcons: "false",
      showPhysicalAddress: "true",
      showUnsubscribe: "true",
    },
    styles: { layout: "centered" },
  },
  standard: {
    label: "Standard",
    content: {
      companyName: "Company Name",
      street: "123 Main St",
      city: "City",
      state: "ST",
      zip: "12345",
      country: "USA",
      phone: "(555) 123-4567",
      contactEmail: "contact@company.com",
      copyrightText: `© ${new Date().getFullYear()} Company Name. All rights reserved.`,
      disclosureText: "You're receiving this email because you signed up for updates.",
      links: serializeFooterLinks([
        { id: makeLinkId(), text: "Unsubscribe from these emails", url: "{{unsubscribe_url}}", type: "unsubscribe", visible: true },
        { id: makeLinkId(), text: "Privacy Policy", url: "https://company.com/privacy", type: "privacy", visible: true },
        { id: makeLinkId(), text: "Update Preferences", url: "https://company.com/preferences", type: "preferences", visible: true },
      ]),
      includeSocialIcons: "false",
      showPhysicalAddress: "true",
      showUnsubscribe: "true",
    },
    styles: { layout: "centered" },
  },
  comprehensive: {
    label: "Comprehensive",
    content: {
      companyName: "Your Company Name",
      street: "123 Main Street",
      city: "San Francisco",
      state: "CA",
      zip: "94102",
      country: "United States",
      phone: "(555) 123-4567",
      contactEmail: "hello@yourcompany.com",
      copyrightText: `© ${new Date().getFullYear()} Your Company Name. All rights reserved.`,
      disclosureText: "You're receiving this email because you signed up for updates.",
      links: serializeFooterLinks(makeDefaultFooterLinks().map((l) => ({ ...l, visible: true }))),
      includeSocialIcons: "true",
      showPhysicalAddress: "true",
      showUnsubscribe: "true",
    },
    styles: { layout: "three-column", backgroundColor: "#1F2937", textColor: "#D1D5DB", linkColor: "#F5C518" },
  },
} as const;

function getVisibleLinks(links: FooterLink[], showUnsubscribe: boolean): FooterLink[] {
  return links.filter((l) => {
    if (l.type === "unsubscribe") return showUnsubscribe;
    return l.visible && Boolean(l.url?.trim());
  });
}

function footerBaseStyle(s: Record<string, string>): React.CSSProperties {
  return {
    backgroundColor: s.backgroundColor || "#F3F4F6",
    color: s.textColor || "#6B7280",
    fontSize: `${s.fontSize || 12}px`,
    lineHeight: s.lineHeight || "1.5",
    paddingTop: `${s.paddingTop || 40}px`,
    paddingBottom: `${s.paddingBottom || 40}px`,
    paddingLeft: `${s.paddingLeft || 20}px`,
    paddingRight: `${s.paddingRight || 20}px`,
    borderTop:
      s.borderTopEnabled === "true"
        ? `${s.borderTopWidth || 1}px solid ${s.borderTopColor || "#E5E7EB"}`
        : undefined,
    fontFamily: "Arial, Helvetica, sans-serif",
  };
}

function EditableLine({
  value,
  onChange,
  className,
  style,
  tag: Tag = "p",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  tag?: "p" | "div" | "span";
}) {
  const ref = useRef<HTMLElement>(null);
  const focusedRef = useRef(false);

  // Do not render {value} as children — React re-applies it every render and fights backspace.
  useEffect(() => {
    const el = ref.current;
    if (!el || focusedRef.current) return;
    if (el.innerText !== value) {
      el.innerText = value;
    }
  }, [value]);

  return (
    <Tag
      ref={ref as React.RefObject<HTMLParagraphElement>}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (ref.current) onChange(ref.current.innerText);
      }}
      className={`outline-none ${className || ""}`}
      style={style}
    />
  );
}

export function FooterBlockRenderer({
  block,
  onUpdate,
}: {
  block: EmailBlock;
  onUpdate: (b: EmailBlock) => void;
}) {
  const s = block.styles;
  const c = block.content;
  const links = parseFooterLinks(c.links || "[]");
  const showUnsubscribe = c.showUnsubscribe !== "false";
  const visibleLinks = getVisibleLinks(links, showUnsubscribe);
  const showAddress = c.showPhysicalAddress !== "false";
  const address = formatAddress(c);
  const layout = s.layout || "centered";
  const linkStyle: React.CSSProperties = { color: s.linkColor || "#f5c518", textDecoration: "underline" };

  const setContent = (key: string, val: string) => onUpdate({ ...block, content: { ...c, [key]: val } });

  const updateLinks = (next: FooterLink[]) => setContent("links", serializeFooterLinks(next));

  const upsertLink = (type: FooterLinkType, patch: Partial<FooterLink>) => {
    const existing = links.find((l) => l.type === type);
    if (existing) {
      updateLinks(links.map((l) => (l.type === type ? { ...l, ...patch } : l)));
    } else {
      updateLinks([...links, { id: makeLinkId(), text: type, url: "", type, visible: true, ...patch }]);
    }
  };

  const textAlign =
    layout === "left" ? "left" : layout === "centered" ? "center" : "left";

  const socialIcons = parseSocialIcons(c.socialIcons || "[]");
  const visibleSocial = c.includeSocialIcons === "true" ? getVisibleIcons(socialIcons) : [];

  const infoBlock = (
    <div className="space-y-1.5 min-w-0" style={{ textAlign }}>
      <EditableLine
        value={c.companyName || "Your Company Name"}
        onChange={(v) => setContent("companyName", v)}
        className="font-semibold text-[inherit]"
        style={{ color: "inherit" }}
      />
      {showAddress && (
        <EditableLine
          value={address}
          onChange={(v) => onUpdate({ ...block, content: applyAddressFields(c, v) })}
          className="whitespace-pre-line opacity-90"
          style={{ color: "inherit" }}
        />
      )}
      {(c.phone || c.contactEmail) && (
        <p className="opacity-90" style={{ margin: 0 }}>
          {[c.phone, c.contactEmail].filter(Boolean).join(" · ")}
        </p>
      )}
      {c.disclosureText && (
        <EditableLine
          value={c.disclosureText}
          onChange={(v) => setContent("disclosureText", v)}
          className="opacity-80 text-[11px] mt-2"
          style={{ color: "inherit" }}
        />
      )}
    </div>
  );

  const linksBlock = (
    <div className="space-y-1" style={{ textAlign: layout === "centered" ? "center" : "left" }}>
      <div className={`flex flex-wrap gap-x-3 gap-y-1 ${layout === "centered" ? "justify-center" : ""}`}>
        {visibleLinks.map((link) => (
          <a
            key={link.id}
            href={link.url}
            onClick={(e) => e.preventDefault()}
            style={linkStyle}
            className="text-[inherit] hover:opacity-80"
          >
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const nextText = e.currentTarget.innerText.trim();
                if (nextText === "") {
                  if (link.type === "unsubscribe") {
                    setContent("showUnsubscribe", "false");
                  } else {
                    updateLinks(links.map((l) => (l.id === link.id ? { ...l, visible: false } : l)));
                  }
                } else {
                  if (link.type === "unsubscribe") {
                    upsertLink("unsubscribe", { text: nextText });
                  } else {
                    updateLinks(links.map((l) => (l.id === link.id ? { ...l, text: nextText } : l)));
                  }
                }
              }}
              className="outline-none min-w-[20px] inline-block"
            >
              {link.text}
            </span>
          </a>
        ))}
      </div>
      <EditableLine
        value={c.copyrightText || ""}
        onChange={(v) => setContent("copyrightText", v)}
        className="opacity-70 text-[11px] mt-2"
        style={{ color: "inherit" }}
      />
    </div>
  );

  const socialBlock =
    visibleSocial.length > 0 ? (
      <div className={`flex gap-2 ${layout === "centered" ? "justify-center" : ""}`}>
        {visibleSocial.map((icon) => (
          <div
            key={icon.id}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: BRAND_COLORS[icon.platform],
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SocialIconGlyph platform={icon.platform} iconStyle="colored" monoColor="#333" size={28} customIcon={icon.customIcon} />
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div style={footerBaseStyle(s)}>
      {layout === "two-column" && (
        <div className="flex flex-wrap justify-between gap-6 items-start px-2">
          {infoBlock}
          <div className="space-y-3">{socialBlock}{linksBlock}</div>
        </div>
      )}
      {layout === "three-column" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 px-2">
          {infoBlock}
          <div className="space-y-3 sm:text-center">
            {socialBlock}
            {linksBlock}
          </div>
        </div>
      )}
      {(layout === "centered" || layout === "left") && (
        <div className="space-y-3 px-2" style={{ textAlign }}>
          {infoBlock}
          {socialBlock}
          {linksBlock}
        </div>
      )}
    </div>
  );
}

export function renderFooterEmail(
  s: Record<string, string>,
  content: Record<string, string>,
  esc: (str: string) => string,
): string {
  const links = parseFooterLinks(content.links || "[]");
  const showUnsubscribe = content.showUnsubscribe !== "false";
  const visibleLinks = getVisibleLinks(links, showUnsubscribe);
  const showAddress = content.showPhysicalAddress !== "false";
  const address = formatAddress(content);
  const layout = s.layout || "centered";
  const align = layout === "left" ? "left" : "center";
  const borderTop =
    s.borderTopEnabled === "true"
      ? `border-top:${s.borderTopWidth || 1}px solid ${s.borderTopColor || "#E5E7EB"};`
      : "";
  const textColor = s.textColor || "#6B7280";
  const linkColor = s.linkColor || "#f5c518";
  const fontSize = s.fontSize || "12";
  const smallSize = Math.max(Number(fontSize) - 1, 10);
  const cellBase = `font-size:${fontSize}px;line-height:${s.lineHeight || "1.6"};color:${textColor};font-family:Arial,Helvetica,sans-serif;`;

  const linkHtml = visibleLinks
    .map((l) => {
      const rawUrl = l.url || "#";
      const href =
        rawUrl.includes("@") && !rawUrl.startsWith("mailto:")
          ? `mailto:${rawUrl}`
          : rawUrl;
      return `<a href="${esc(href)}" style="color:${linkColor};text-decoration:underline;">${esc(l.text)}</a>`;
    })
    .join(" &nbsp;|&nbsp; ");

  const phoneEmailHtml = renderFooterPhoneEmailHtml(content, esc, textColor, linkColor);
  const addressHtml =
    showAddress && address
      ? `<p style="margin:0 0 8px 0;color:${textColor};">${esc(address).replace(/\n/g, "<br/>")}</p>`
      : "";

  const infoHtml = `
    <p style="margin:0 0 8px 0;font-weight:600;color:${textColor};">${esc(content.companyName || "Company")}</p>
    ${addressHtml}
    ${phoneEmailHtml}
  `;

  const disclosureHtml = content.disclosureText
    ? `<p style="margin:12px 0 0 0;color:${textColor};font-size:${smallSize}px;opacity:0.9;">${esc(content.disclosureText)}</p>`
    : "";

  const linksHtml = `
    ${linkHtml ? `<p style="margin:0 0 8px 0;color:${textColor};">${linkHtml}</p>` : ""}
    ${content.copyrightText ? `<p style="margin:0;color:${textColor};font-size:${smallSize}px;opacity:0.8;">${esc(content.copyrightText)}</p>` : ""}
  `;

  const socialHtml =
    content.includeSocialIcons === "true"
      ? renderSocialIconsInlineHtml(
          {
            iconStyle: "colored",
            size: "28",
            spacing: "8",
            align: layout === "left" ? "left" : "center",
          },
          content.socialIcons || "[]",
          esc,
        )
      : "";

  const pad = `${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px`;
  const outerTd = `padding:${pad};background-color:${s.backgroundColor || "#F3F4F6"};${borderTop}font-family:Arial,Helvetica,sans-serif;`;

  if (layout === "two-column") {
    return `<tr><td style="${outerTd}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
      <td valign="top" align="left" width="50%" style="${cellBase}padding-right:16px;">${infoHtml}${disclosureHtml}</td>
      <td valign="top" align="right" width="50%" style="${cellBase}">${socialHtml}${linksHtml}</td>
    </tr></table></td></tr>`;
  }

  if (layout === "three-column") {
    return `<tr><td style="${outerTd}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
      <td valign="top" align="left" width="33%" style="${cellBase}padding-right:12px;">${infoHtml}</td>
      <td valign="top" align="center" width="67%" style="${cellBase}">${socialHtml}${linksHtml}</td>
    </tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td align="center" style="${cellBase}padding-top:12px;">${disclosureHtml}</td></tr></table></td></tr>`;
  }

  const stacked = `${infoHtml}${socialHtml}${linksHtml}${disclosureHtml}`;
  return `<tr><td style="${outerTd}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td align="${align}" style="${cellBase}">${stacked}</td></tr></table></td></tr>`;
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
      className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-brand/50"
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
        <input type="range" min={min} max={max} step={step} value={numVal} onChange={(e) => onChange(e.target.value)} className="flex-1 accent-brand cursor-pointer" />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} className="w-14 h-8 px-2 rounded-lg border border-white/10 bg-white/[0.04] text-[12px] text-white text-center tabular-nums" />
        {unit && <span className="text-[11px] text-[#7a7a7a]">{unit}</span>}
      </div>
    </PropertyField>
  );
}

export function FooterPropertiesPanel({
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
  const c = block.content;
  const s = block.styles;
  const links = parseFooterLinks(c.links || "[]");

  const setContent = (key: string, val: string) => onUpdate({ ...block, content: { ...c, [key]: val } });
  const setStyle = (key: string, val: string) => onUpdate({ ...block, styles: { ...s, [key]: val } });
  const setPadding = (top: string, right: string, bottom: string, left: string) =>
    onUpdate({ ...block, styles: { ...s, paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left } });

  const updateLinks = (next: FooterLink[]) => setContent("links", serializeFooterLinks(next));

  const getLink = (type: FooterLinkType) => links.find((l) => l.type === type);
  const upsertLink = (type: FooterLinkType, patch: Partial<FooterLink>) => {
    const existing = links.find((l) => l.type === type);
    if (existing) {
      updateLinks(links.map((l) => (l.type === type ? { ...l, ...patch } : l)));
    } else {
      updateLinks([...links, { id: makeLinkId(), text: type, url: "", type, visible: true, ...patch }]);
    }
  };

  const applyPreset = (key: keyof typeof FOOTER_PRESETS) => {
    const preset = FOOTER_PRESETS[key];
    onUpdate({
      ...block,
      content: { ...c, ...preset.content, socialIcons: c.socialIcons || serializeSocialIcons(makeDefaultSocialIcons()) },
      styles: { ...s, ...preset.styles },
    });
  };

  const customLinks = links.filter((l) => l.type === "custom");

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-1">
        <h4 className="text-[13px] font-semibold text-white">Footer Block</h4>
        <button type="button" onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 cursor-pointer group">
          <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a] group-hover:text-red-400" />
        </button>
      </div>

      <CollapsibleSection title="Quick templates">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FOOTER_PRESETS) as Array<keyof typeof FOOTER_PRESETS>).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="px-3 h-8 rounded-lg text-[11px] font-medium bg-white/[0.04] text-[#a8a8a8] border border-white/8 hover:text-white hover:border-brand/40 cursor-pointer capitalize"
            >
              {FOOTER_PRESETS[key].label}
            </button>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Content">
        <PropertyField label="Company name">
          <PropInput value={c.companyName || ""} onChange={(v) => setContent("companyName", v)} />
        </PropertyField>
        <PropertyField label="Address">
          <textarea
            value={formatAddress(c)}
            onChange={(e) =>
              onUpdate({ ...block, content: applyAddressFields(c, e.target.value) })
            }
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white outline-none focus:border-brand/50 resize-y overflow-y-auto custom-scrollbar"
            placeholder="Street&#10;City, State&#10;ZIP Country"
          />
        </PropertyField>
        <PropertyField label="Phone number (optional)">
          <PropInput
            value={c.phone || ""}
            onChange={(v) => {
              const truncated = v.slice(0, 20);
              const cleaned = truncated.replace(/[^0-9\s\-()+]/g, "");
              setContent("phone", cleaned);
            }}
            placeholder="(555) 123-4567"
          />
        </PropertyField>
        <PropertyField label="Email (optional)">
          <PropInput
            value={c.contactEmail || ""}
            onChange={(v) => setContent("contactEmail", v.slice(0, 50).trim())}
            placeholder="hello@company.com"
          />
          {c.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contactEmail) && (
            <p className="text-[11px] text-red-400 mt-1">Please enter a valid email address.</p>
          )}
        </PropertyField>
      </CollapsibleSection>

      <CollapsibleSection title="Links">
        <PropertyField label="Unsubscribe link">
          <PropInput
            value={getLink("unsubscribe")?.text || "Unsubscribe from these emails"}
            onChange={(v) => upsertLink("unsubscribe", { text: v, visible: true })}
            placeholder="Link text"
          />
          <PropInput
            value={getLink("unsubscribe")?.url || ""}
            onChange={(v) => upsertLink("unsubscribe", { url: v, visible: true })}
            placeholder="Unsubscribe URL (required)"
          />
        </PropertyField>

        {(["privacy", "terms", "preferences"] as const).map((type) => {
          const link = getLink(type);
          const labels = { privacy: "Privacy policy", terms: "Terms of service", preferences: "Preferences center" };
          return (
            <div key={type} className="space-y-2 rounded-lg border border-white/8 p-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => upsertLink(type, { visible: !(link?.visible ?? false), text: link?.text || labels[type], url: link?.url || "" })}
                  className={`h-4 w-4 rounded border flex items-center justify-center cursor-pointer ${link?.visible ? "bg-brand border-brand" : "border-white/20"}`}
                >
                  {link?.visible && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className="text-[12px] text-[#a8a8a8]">{labels[type]}</span>
              </label>
              {link?.visible && (
                <PropInput value={link.url || ""} onChange={(v) => upsertLink(type, { url: v })} placeholder="https://" />
              )}
            </div>
          );
        })}

        <PropertyField label="Custom links">
          {customLinks.map((link) => (
            <div key={link.id} className="flex gap-2 items-start mb-2">
              <div className="flex-1 space-y-1.5">
                <PropInput value={link.text} onChange={(v) => updateLinks(links.map((l) => (l.id === link.id ? { ...l, text: v } : l)))} placeholder="Link text" />
                <PropInput value={link.url} onChange={(v) => updateLinks(links.map((l) => (l.id === link.id ? { ...l, url: v } : l)))} placeholder="URL" />
              </div>
              <button
                type="button"
                onClick={() => updateLinks(links.filter((l) => l.id !== link.id))}
                className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center hover:bg-red-500/10 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 text-[#7a7a7a]" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              updateLinks([
                ...links,
                { id: makeLinkId(), text: "Custom link", url: "https://", type: "custom", visible: true },
              ])
            }
            className="w-full h-8 rounded-lg border border-dashed border-white/15 text-[12px] text-[#a8a8a8] hover:text-white cursor-pointer flex items-center justify-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add custom link
          </button>
        </PropertyField>
      </CollapsibleSection>

      <CollapsibleSection title="Layout">
        <PropertyField label="Footer layout">
          <select
            value={s.layout || "centered"}
            onChange={(e) => setStyle("layout", e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white outline-none cursor-pointer"
          >
            <option value="centered" className="bg-[#1a1a1a]">Centered</option>
            <option value="left" className="bg-[#1a1a1a]">Left-aligned</option>
            <option value="two-column" className="bg-[#1a1a1a]">Two-column</option>
            <option value="three-column" className="bg-[#1a1a1a]">Three-column</option>
          </select>
        </PropertyField>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div
            onClick={() => setContent("includeSocialIcons", c.includeSocialIcons === "true" ? "false" : "true")}
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center cursor-pointer ${c.includeSocialIcons === "true" ? "bg-brand border-brand" : "border-white/20"}`}
          >
            {c.includeSocialIcons === "true" && <Check className="h-3 w-3 text-black" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8]">Include social icons</span>
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Style">
        <ColorPicker label="Background color" value={s.backgroundColor || "#F3F4F6"} onChange={(v) => setStyle("backgroundColor", v)} />
        <ColorPicker label="Text color" value={s.textColor || "#6B7280"} onChange={(v) => setStyle("textColor", v)} />
        <ColorPicker label="Link color" value={s.linkColor || "#f5c518"} onChange={(v) => setStyle("linkColor", v)} />
        <SliderInput label="Font size" min={10} max={16} value={s.fontSize || "12"} onChange={(v) => setStyle("fontSize", v)} />
        <SliderInput label="Line height" min={1.2} max={2} step={0.1} value={s.lineHeight || "1.5"} onChange={(v) => setStyle("lineHeight", v)} unit="" />
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div
            onClick={() => setStyle("borderTopEnabled", s.borderTopEnabled === "true" ? "false" : "true")}
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center cursor-pointer ${s.borderTopEnabled === "true" ? "bg-brand border-brand" : "border-white/20"}`}
          >
            {s.borderTopEnabled === "true" && <Check className="h-3 w-3 text-black" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8]">Border top</span>
        </label>
        {s.borderTopEnabled === "true" && (
          <>
            <SliderInput label="Border width" min={1} max={4} value={s.borderTopWidth || "1"} onChange={(v) => setStyle("borderTopWidth", v)} />
            <ColorPicker label="Border color" value={s.borderTopColor || "#E5E7EB"} onChange={(v) => setStyle("borderTopColor", v)} />
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Spacing">
        <PropertyField label="Padding">
          <div className="grid grid-cols-4 gap-1.5">
            {(["top", "right", "bottom", "left"] as const).map((side) => {
              const key = `padding${side.charAt(0).toUpperCase()}${side.slice(1)}` as keyof typeof s;
              const val = s[key] || "0";
              return (
                <div key={side} className="flex flex-col items-center gap-0.5">
                  <input
                    type="number"
                    min={0}
                    value={val}
                    onChange={(e) => {
                      const t = s.paddingTop || "40";
                      const r = s.paddingRight || "20";
                      const b = s.paddingBottom || "40";
                      const l = s.paddingLeft || "20";
                      if (side === "top") setPadding(e.target.value, r, b, l);
                      if (side === "right") setPadding(t, e.target.value, b, l);
                      if (side === "bottom") setPadding(t, r, e.target.value, l);
                      if (side === "left") setPadding(t, r, b, e.target.value);
                    }}
                    className="w-full h-8 px-1 rounded-lg border border-white/10 bg-white/[0.04] text-[11px] text-white text-center tabular-nums"
                  />
                  <span className="text-[9px] text-[#7a7a7a] uppercase">{side[0]}</span>
                </div>
              );
            })}
          </div>
        </PropertyField>
      </CollapsibleSection>

      <CollapsibleSection title="Compliance">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div
            onClick={() => setContent("showPhysicalAddress", c.showPhysicalAddress === "true" ? "false" : "true")}
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center cursor-pointer ${c.showPhysicalAddress !== "false" ? "bg-brand border-brand" : "border-white/20"}`}
          >
            {c.showPhysicalAddress !== "false" && <Check className="h-3 w-3 text-black" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8]">Show physical address (CAN-SPAM)</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div
            onClick={() => setContent("showUnsubscribe", c.showUnsubscribe === "true" ? "false" : "true")}
            className={`h-[18px] w-[18px] rounded border flex items-center justify-center cursor-pointer ${c.showUnsubscribe !== "false" ? "bg-brand border-brand" : "border-white/20"}`}
          >
            {c.showUnsubscribe !== "false" && <Check className="h-3 w-3 text-black" />}
          </div>
          <span className="text-[12px] text-[#a8a8a8]">Show unsubscribe link</span>
        </label>
        <PropertyField label="Required disclosure text">
          <textarea
            value={c.disclosureText || ""}
            onChange={(e) => setContent("disclosureText", e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-white outline-none focus:border-brand/50 resize-y overflow-y-auto custom-scrollbar"
          />
        </PropertyField>
      </CollapsibleSection>
    </div>
  );
}
