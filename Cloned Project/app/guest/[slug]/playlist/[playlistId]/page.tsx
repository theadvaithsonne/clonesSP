import { Metadata } from "next";
import PlaylistPageClient from "./PlaylistPageClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://my.garage.app";
}

function proxyImageIfNeeded(imageUrl: string): string {
  if (imageUrl.includes("utfs.io") || imageUrl.includes("uploadthing.com")) {
    return `${getSiteUrl()}/api/og-image?url=${encodeURIComponent(imageUrl)}`;
  }
  return imageUrl;
}

interface Props {
  params: Promise<{ slug: string; playlistId: string }>;
  searchParams: Promise<{ referCode?: string }>;
}

/**
 * Server-side metadata generation for OG tags on shared playlist links.
 *
 * Mirrors the video page pattern (which works on WhatsApp):
 *  – Single direct CDN image URL (no proxy — avoids latency/timeout)
 *  – Only ONE og:image tag (WhatsApp ignores all but the first)
 *  – No headers() call (keeps page ISR-cacheable, faster response)
 *
 * When a referCode is present, the title becomes:
 *   "{Affiliate name} shared {Playlist name} with you"
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { playlistId } = await params;
  const { referCode } = await searchParams;

  // Default fallback metadata
  const fallback: Metadata = {
    title: "Watch Playlist | Garage",
    description: "Watch this playlist on Garage.",
  };

  try {
    // Fetch playlist data from public endpoint
    const playlistRes = await fetch(
      `${API_BASE}/public/playlists/${playlistId}`,
      { next: { revalidate: 60 } }
    );

    if (!playlistRes.ok) return fallback;

    const playlistJson = await playlistRes.json();
    if (!playlistJson.success || !playlistJson.playlist) return fallback;

    const playlistData = playlistJson.playlist;
    const orgData = playlistJson.organization;

    // Resolve the referrer name if a referCode is present
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
      } catch {
        // non-critical — continue without referrer name
      }
    }

    // Build OG title
    const ogTitle = referrerName
      ? `${referrerName} shared "${playlistData.title}" with you`
      : playlistData.title;

    // Build OG description
    const ogDescription =
      playlistData.description ||
      (orgData?.name
        ? `Watch this playlist on ${orgData.name}`
        : "Watch this playlist on Garage");

    // Resolve image — prefer playlist cover, then first video's thumbnail, then org icon
    // Use direct CDN URL (same pattern as video page which works on WhatsApp)
    let ogImage: string | null = playlistData.coverImage || null;
    if (!ogImage && playlistData.videos?.length > 0) {
      ogImage = playlistData.videos[0].thumbnail || null;
    }
    if (!ogImage && orgData?.icon) {
      ogImage = orgData.icon;
    }

    // Ensure absolute URL — WhatsApp requires https://
    if (ogImage && !ogImage.startsWith("http")) {
      ogImage = null;
    }

    // Route UploadThing images through proxy (strips x-robots-tag: noindex)
    if (ogImage) {
      ogImage = proxyImageIfNeeded(ogImage);
    }

    return {
      title: ogTitle,
      description: ogDescription,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        type: "website",
        // Single image — WhatsApp only reads the first og:image tag
        ...(ogImage
          ? { images: [{ url: ogImage, width: 1200, height: 630 }] }
          : {}),
        ...(orgData?.name ? { siteName: orgData.name } : {}),
      },
      twitter: {
        card: ogImage ? "summary_large_image" : "summary",
        title: ogTitle,
        description: ogDescription,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };
  } catch (error) {
    console.error("Error generating playlist metadata:", error);
    return fallback;
  }
}

export default async function Page() {
  return <PlaylistPageClient />;
}
