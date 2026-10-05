import { Metadata } from "next";
import DropPageClient from "./DropPageClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://my.garage.app";
}



interface Props {
  params: Promise<{ slug: string; dropId: string }>;
  searchParams: Promise<{ referCode?: string }>;
}

/**
 * Extract a YouTube thumbnail from a video URL.
 */
function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

/**
 * Server-side metadata generation for OG tags on shared drop links.
 *
 * Title format: "{Affiliate name} Shared A Drop: {Title} : With you"
 *
 * Image: Generates a vertical 9:16 OG image via /api/drop-og-image
 * to display as a portrait thumbnail when shared on WhatsApp/Telegram.
 *
 * Video tags: Includes og:video to signal video content to social
 * crawlers, enabling vertical preview rendering on platforms that
 * support it (similar to YouTube Shorts / Instagram Reels).
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug, dropId } = await params;
  const { referCode } = await searchParams;

  const fallback: Metadata = {
    title: "Watch Drop | Garage",
    description: "Watch this short video on Garage.",
  };

  try {
    const res = await fetch(`${API_BASE}/drops/public/${dropId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return fallback;

    const json = await res.json();
    if (!json.success || !json.drop) return fallback;

    const drop = json.drop;
    const org = json.organization;

    // Resolve referrer name
    let referrerName: string | null = null;
    if (referCode) {
      try {
        const refRes = await fetch(
          `${API_BASE}/affiliate/referrer-info?affiliateId=${referCode}`,
          { next: { revalidate: 300 } }
        );
        if (refRes.ok) {
          const refJson = await refRes.json();
          if (refJson.success && refJson.referrer?.name) {
            referrerName = refJson.referrer.name;
          }
        }
      } catch {}
    }

    // Build OG title — format: "{Affiliate name} Shared A Drop: {Title} : With you"
    const caption = drop.caption || "Short Video";
    const ogTitle = referrerName
      ? `${referrerName} Shared A Drop: ${caption} : With you`
      : caption;

    const ogDescription = drop.caption
      ? drop.caption
      : org?.name
        ? `Watch this short video on ${org.name}`
        : "Watch this short video on Garage";

    // Build vertical OG image via drop-og-image route (actual 9:16 image).
    // Social platforms ignore OG width/height hints and use the image's
    // real dimensions, so we MUST generate a real vertical image.
    let ogImage: string | null = null;
    const rawThumb = drop.thumbnailUrl || (drop.videoUrl ? getYouTubeThumbnail(drop.videoUrl) : null);
    if (rawThumb && rawThumb.startsWith("http")) {
      const thumbParam = encodeURIComponent(rawThumb);
      const captionParam = encodeURIComponent(caption);
      ogImage = `${getSiteUrl()}/api/drop-og-image?thumbnailUrl=${thumbParam}&caption=${captionParam}`;
    }

    // Build the canonical URL for this drop
    const dropUrl = `${getSiteUrl()}/guest/${slug}/drop/${dropId}${referCode ? `?referCode=${referCode}` : ""}`;

    return {
      title: ogTitle,
      description: ogDescription,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        type: "article",
        url: dropUrl,
        // Vertical OG image — generated server-side as a 9:16 portrait image
        ...(ogImage ? { images: [{ url: ogImage, width: 405, height: 720 }] } : {}),
        ...(org?.name ? { siteName: org.name } : {}),
      },
      twitter: {
        card: ogImage ? "summary_large_image" : "summary",
        title: ogTitle,
        description: ogDescription,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };
  } catch (error) {
    console.error("Error generating drop metadata:", error);
    return fallback;
  }
}

export default async function Page() {
  return <DropPageClient />;
}
