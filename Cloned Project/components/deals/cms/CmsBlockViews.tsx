"use client";

import type { CmsModule } from "@/lib/cms/types";

const SOCIAL_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  twitter: "#000000",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  pinterest: "#E60023",
  tiktok: "#000000",
  whatsapp: "#25D366",
  email: "#6B7280",
  website: "#F5C518",
};

function alignClass(align?: string) {
  if (align === "center") return "justify-center text-center";
  if (align === "right") return "justify-end text-right";
  return "justify-start text-left";
}

export function LogoBlockView({ module }: { module: CmsModule }) {
  const p = module.props;
  const img = p.src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={p.src}
      alt={p.alt || "Logo"}
      style={{ width: p.width || 150, maxWidth: "100%" }}
      className="h-auto"
    />
  ) : (
    <div
      className="flex items-center justify-center rounded bg-[#f0f0f0] text-sm text-[#888]"
      style={{ width: p.width || 150, height: 60 }}
    >
      Logo
    </div>
  );

  const content = p.link ? (
    <a href={p.link} className="inline-block">
      {img}
    </a>
  ) : (
    img
  );

  return <div className={`flex ${alignClass(p.align)}`}>{content}</div>;
}

export function SocialIconsBlockView({ module }: { module: CmsModule }) {
  const p = module.props;
  const icons = (p.icons || []).filter((i: any) => i.visible !== false);
  const size = p.size || 32;
  const spacing = p.spacing || 12;

  return (
    <div className={`flex flex-wrap ${alignClass(p.align)}`} style={{ gap: spacing }}>
      {icons.map((icon: any) => (
        <a
          key={icon.id}
          href={icon.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full text-xs font-bold text-white"
          style={{
            width: size,
            height: size,
            backgroundColor: SOCIAL_COLORS[icon.platform] || "#6B7280",
            fontSize: size * 0.35,
          }}
          title={icon.platform}
        >
          {(icon.platform || "?")[0].toUpperCase()}
        </a>
      ))}
    </div>
  );
}

export function FooterBlockView({ module }: { module: CmsModule }) {
  const p = module.props;
  const links = (p.links || []).filter((l: any) => l.visible !== false);
  const address = [p.street, [p.city, p.state].filter(Boolean).join(", "), p.zip, p.country]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className="rounded-lg px-4 py-6 text-sm"
      style={{
        backgroundColor: p.backgroundColor || "#111111",
        color: p.textColor || "#888888",
      }}
    >
      {p.companyName ? <p className="mb-1 font-semibold text-white">{p.companyName}</p> : null}
      {address ? <p className="mb-2 whitespace-pre-line">{address}</p> : null}
      {p.contactEmail ? <p className="mb-2">{p.contactEmail}</p> : null}
      {links.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-3">
          {links.map((link: any) => (
            <a
              key={link.id}
              href={link.url || "#"}
              style={{ color: p.linkColor || "#F5C518" }}
            >
              {link.text}
            </a>
          ))}
        </div>
      ) : null}
      {p.copyrightText ? <p className="text-xs opacity-80">{p.copyrightText}</p> : null}
    </div>
  );
}
