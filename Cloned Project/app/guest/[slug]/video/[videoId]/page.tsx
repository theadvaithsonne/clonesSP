import { Metadata } from "next";
import VideoPageClient from "./VideoPageClient";

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
  params: Promise<{ slug: string; videoId: string }>;
  searchParams: Promise<{ referCode?: string }>;
}

/**
 * Extract a YouTube thumbnail from a video URL (fallback when no thumbnail is stored).
 */
function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]+)/
  );
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

/**
 * Server-side metadata generation for OG tags on shared video links.
 *
 * When a video share link includes a referCode (affiliate ID), the OG title becomes:
 *   "{Affiliate name} sharing {Video title} with you"
 * Otherwise it falls back to the video title.
 *
 * The OG image uses the video thumbnail — works for both uploaded videos and
 * link-type videos (YouTube/Vimeo) whose thumbnails were fetched during upload.
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { videoId } = await params;
  const { referCode } = await searchParams;

  // Default fallback metadata
  const fallback: Metadata = {
    title: "Watch Video | Garage",
    description: "Watch this video on Garage.",
  };

  try {
    // Fetch video data — try standalone first, then workshop
    let videoData: any = null;
    let orgData: any = null;

    const standaloneRes = await fetch(
      `${API_BASE}/public/videos/${videoId}?videoType=standalone`,
      { next: { revalidate: 60 } }
    );
    if (standaloneRes.ok) {
      const json = await standaloneRes.json();
      if (json.success && json.video) {
        videoData = json.video;
        orgData = json.organization;
      }
    }

    if (!videoData) {
      const workshopRes = await fetch(
        `${API_BASE}/public/videos/${videoId}?videoType=workshop`,
        { next: { revalidate: 60 } }
      );
      if (workshopRes.ok) {
        const json = await workshopRes.json();
        if (json.success && json.video) {
          videoData = json.video;
          orgData = json.organization;
        }
      }
    }

    if (!videoData) return fallback;

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
      ? `${referrerName} sharing "${videoData.title}" with you`
      : videoData.title;

    // Build OG description — strip HTML tags for a clean text preview
    const rawDescription = videoData.description || "";
    const cleanDescription = rawDescription
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    const ogDescription =
      cleanDescription ||
      (orgData?.name
        ? `Watch this video on ${orgData.name}`
        : "Watch this video on Garage");

    // Resolve thumbnail — prefer stored thumbnail, then try YouTube extraction from videoUrl
    let ogImage = videoData.thumbnail || null;
    if (!ogImage && videoData.videoUrl) {
      ogImage = getYouTubeThumbnail(videoData.videoUrl);
    }

    // Route UploadThing images through proxy (strips x-robots-tag: noindex)
    if (ogImage) {
      ogImage = proxyImageIfNeeded(ogImage);
    }

    const metadata: Metadata = {
      title: ogTitle,
      description: ogDescription,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        type: "video.other",
        ...(ogImage ? { images: [{ url: ogImage, width: 1280, height: 720 }] } : {}),
        ...(orgData?.name ? { siteName: orgData.name } : {}),
      },
      twitter: {
        card: ogImage ? "summary_large_image" : "summary",
        title: ogTitle,
        description: ogDescription,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };

    return metadata;
  } catch (error) {
    console.error("Error generating video metadata:", error);
    return fallback;
  }
}

export default async function Page() {
  return <VideoPageClient />;
}
