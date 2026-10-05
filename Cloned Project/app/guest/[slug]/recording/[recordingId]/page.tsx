import { Metadata } from "next";
import RecordingPageClient from "./RecordingPageClient";

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
  params: Promise<{ slug: string; recordingId: string }>;
  searchParams: Promise<{ referCode?: string }>;
}

/**
 * Server-side metadata generation for OG tags on shared recording links.
 *
 * When a recording share link includes a referCode (affiliate ID), the OG title becomes:
 *   "{Affiliate name} sharing {Recording title} with you"
 * Otherwise it falls back to the recording title.
 *
 * The OG image uses the recording thumbnail — works for both uploaded
 * thumbnails and workshop-level thumbnails.
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { recordingId } = await params;
  const { referCode } = await searchParams;

  // Default fallback metadata
  const fallback: Metadata = {
    title: "Watch Recording | Garage",
    description: "Watch this live stream recording on Garage.",
  };

  try {
    // Fetch recording data from the public endpoint
    const res = await fetch(
      `${API_BASE}/public/recordings/${recordingId}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) return fallback;

    const json = await res.json();
    if (!json.success || !json.recording) return fallback;

    const recordingData = json.recording;
    const orgData = json.organization;

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
      ? `${referrerName} sharing "${recordingData.title}" with you`
      : recordingData.title;

    // Build OG description — strip HTML tags for a clean text preview
    const rawDescription = recordingData.description || "";
    const cleanDescription = rawDescription
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    const ogDescription =
      cleanDescription ||
      (orgData?.name
        ? `Watch this live stream recording on ${orgData.name}`
        : "Watch this live stream recording on Garage");

    // Resolve thumbnail
    let ogImage = recordingData.thumbnail || null;

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
    console.error("Error generating recording metadata:", error);
    return fallback;
  }
}

export default async function Page() {
  return <RecordingPageClient />;
}
