import { Metadata } from "next";
import WebinarRoomClient from "./WebinarRoomClient";

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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Server-side metadata generation for OG tags on shared webinar / live-stream
 * affiliate links.
 *
 * When a link includes an affiliate code (e.g. ?ref= or ?referCode=) the OG title becomes:
 *   "{Affiliate name}" is inviting you to "{Live stream title}"
 *
 * The OG description uses the webinar's own description (HTML stripped),
 * and the OG image uses the webinar thumbnail.
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { id: webinarId } = await params;
  const sp = await searchParams;
  const referCode =
    (typeof sp.ref === "string" ? sp.ref : undefined) ||
    (typeof sp.referCode === "string" ? sp.referCode : undefined) ||
    (typeof sp.affiliateId === "string" ? sp.affiliateId : undefined);

  // Default fallback metadata
  const fallback: Metadata = {
    title: "Join Live Stream | Garage",
    description: "You've been invited to join a live stream on Garage.",
  };

  try {
    // Fetch webinar / workshop data from the public endpoint
    const res = await fetch(
      `${API_BASE}/public/workshops/${webinarId}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) return fallback;

    const json = await res.json();
    if (!json.success || !json.workshop) return fallback;

    const workshop = json.workshop;
    const orgData = workshop.organization;

    // Resolve the referrer (affiliate) name if a ref code is present
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
    // With a named affiliate: "{Name} is inviting you to {title}"
    // Shared by an affiliate who hasn't set a name: the office does the
    //   inviting — "Unknown is inviting you to …" read as a real person
    //   called Unknown, which is worse than not naming anyone.
    // No ref at all: the workshop title.
    const orgName: string | undefined = orgData?.name;
    const possessive = orgName
      ? `${orgName}${orgName.endsWith('s') ? "'" : "'s"}`
      : '';
    const ogTitle = referrerName
      ? `${referrerName} is inviting you to ${workshop.title}`
      : referCode && possessive
        ? `You're invited to ${possessive} webinar`
        : workshop.title || "Join Live Stream | Garage";

    // Build OG description — strip HTML tags for a clean text preview
    const rawDescription = workshop.description || "";
    const cleanDescription = rawDescription
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    const ogDescription =
      cleanDescription ||
      (orgData?.name
        ? `Join this live stream on ${orgData.name}`
        : "You've been invited to join a live stream on Garage.");

    // Resolve thumbnail
    let ogImage: string | null = workshop.thumbnail || null;
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
    console.error("[webinar/[id]] Error generating metadata:", error);
    return fallback;
  }
}

export default function Page() {
  return <WebinarRoomClient />;
}
