import { Metadata } from "next";
import WebinarDetailPageClient from "./WebinarDetailPageClient";

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
  params: Promise<{ slug: string; webinarId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Server-side metadata generation for OG tags on shared guest webinar links.
 *
 * When a link includes an affiliate code (e.g. ?referCode= or ?ref=), the OG title becomes:
 *   "{Affiliate name}" is inviting you to "{Live stream title}"
 * Otherwise it falls back to the live stream title.
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { webinarId } = await params;
  const sp = await searchParams;
  const referCode =
    (typeof sp.referCode === "string" ? sp.referCode : undefined) ||
    (typeof sp.ref === "string" ? sp.ref : undefined) ||
    (typeof sp.affiliateId === "string" ? sp.affiliateId : undefined);

  // Default fallback metadata
  const fallback: Metadata = {
    title: "Live Webinar | Garage",
    description: "Join this live stream webinar on Garage.",
  };

  try {
    // Fetch workshop data from the public endpoint
    const res = await fetch(
      `${API_BASE}/public/workshops/${webinarId}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) return fallback;

    const json = await res.json();
    if (!json.success || !json.workshop) return fallback;

    const workshop = json.workshop;
    const orgData = workshop.organization;

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

    // Build OG title. A nameless affiliate hands the invite to the office
    // rather than naming nobody — see the /webinar/[id] twin.
    const orgNameForTitle: string | undefined = orgData?.name;
    const possessive = orgNameForTitle
      ? `${orgNameForTitle}${orgNameForTitle.endsWith('s') ? "'" : "'s"}`
      : '';
    const ogTitle = referrerName
      ? `${referrerName} is inviting you to ${workshop.title}`
      : referCode && possessive
        ? `You're invited to ${possessive} webinar`
        : workshop.title || "Live Webinar | Garage";

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
        : "Join this live stream webinar on Garage.");

    // Resolve thumbnail
    let ogImage = workshop.thumbnail || null;
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
    console.error("Error generating webinar metadata:", error);
    return fallback;
  }
}

export default async function Page() {
  return <WebinarDetailPageClient />;
}
