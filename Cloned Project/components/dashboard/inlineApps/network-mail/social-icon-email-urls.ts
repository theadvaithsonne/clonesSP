import type { SocialPlatform } from "./social-icons";

/**
 * Hosted PNG URLs for email HTML. Email clients (Gmail, Outlook, etc.) block
 * `data:image/svg+xml` and most inline data URIs — only absolute https:// img src works reliably.
 */
const EMAIL_SOCIAL_PNG: Partial<
  Record<SocialPlatform, { colored: string; mono: string; white: string }>
> = {
  /** 96px assets scale down crisply in Gmail / Outlook; 48px looked soft at ~16px display. */
  facebook: {
    colored: "https://img.icons8.com/color/96/facebook-new.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/facebook-new.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/facebook-new.png",
  },
  twitter: {
    colored: "https://img.icons8.com/color/96/twitterx--v1.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/twitterx--v1.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/twitterx--v1.png",
  },
  instagram: {
    colored: "https://img.icons8.com/color/96/instagram-new.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/instagram-new.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/instagram-new.png",
  },
  linkedin: {
    colored: "https://img.icons8.com/color/96/linkedin.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/linkedin.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/linkedin.png",
  },
  youtube: {
    colored: "https://img.icons8.com/color/96/youtube-play.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/youtube-play.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/youtube-play.png",
  },
  pinterest: {
    colored: "https://img.icons8.com/color/96/pinterest.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/pinterest.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/pinterest.png",
  },
  tiktok: {
    colored: "https://img.icons8.com/color/96/tiktok.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/tiktok.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/tiktok.png",
  },
  whatsapp: {
    colored: "https://img.icons8.com/color/96/whatsapp.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/whatsapp.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/whatsapp.png",
  },
  email: {
    colored: "https://img.icons8.com/color/96/gmail-new.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/gmail-new.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/gmail-new.png",
  },
  website: {
    colored: "https://img.icons8.com/color/96/domain.png",
    mono: "https://img.icons8.com/ios-filled/96/6B7280/domain.png",
    white: "https://img.icons8.com/ios-filled/96/ffffff/domain.png",
  },
};

/** Resolve an email-safe absolute image URL for a social icon (never data: URIs for standard platforms). */
export function getSocialIconEmailImageSrc(
  platform: SocialPlatform,
  iconStyle: string,
  customIcon?: string,
): string {
  if (customIcon && /^https?:\/\//i.test(customIcon)) return customIcon;

  if (platform === "custom" && customIcon) {
    return customIcon;
  }

  const entry = EMAIL_SOCIAL_PNG[platform];
  if (!entry) return "";

  if (iconStyle === "solid-circle" || iconStyle === "solid-rounded") {
    return entry.white;
  }

  /** Match editor "Colored (brand)": brand tile + white glyph — not a tiny full-color PNG. */
  if (iconStyle === "colored") {
    return entry.white;
  }

  const useMono =
    iconStyle === "monochrome" ||
    iconStyle === "icon-only" ||
    iconStyle === "outlined";
  return useMono ? entry.mono : entry.colored;
}
