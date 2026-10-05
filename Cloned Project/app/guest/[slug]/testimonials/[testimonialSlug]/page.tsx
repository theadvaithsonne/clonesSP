import { Metadata } from "next";
import TestimonialDetailClient from "./TestimonialDetailClient";

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
  params: Promise<{ slug: string; testimonialSlug: string }>;
  searchParams: Promise<{ referCode?: string }>;
}

/**
 * Server-side metadata generation for OG tags on shared testimonial links.
 *
 * Mirrors the video page pattern (which works on WhatsApp):
 *  – Single direct CDN image URL (no proxy — avoids latency/timeout)
 *  – Only ONE og:image tag (WhatsApp ignores all but the first)
 *  – No headers() call (keeps page ISR-cacheable, faster response)
 *
 * OG title: "See how {Office Name} helped {Client Name}"
 * When a referCode is present: "{Referrer name} shared a testimonial with you"
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug, testimonialSlug } = await params;
  const { referCode } = await searchParams;

  const fallback: Metadata = {
    title: "Client Testimonial | Garage",
    description: "See this client success story on Garage.",
  };

  try {
    // Fetch testimonial data
    const testimonialRes = await fetch(
      `${API_BASE}/public/testimonials/${slug}/${testimonialSlug}`,
      { next: { revalidate: 60 } }
    );

    if (!testimonialRes.ok) return fallback;

    const json = await testimonialRes.json();
    if (!json.success || !json.testimonial) return fallback;

    const testimonial = json.testimonial;
    const org = json.organization;
    const orgName = org?.name || "Garage";

    // Resolve referrer name if referCode present
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
        // non-critical
      }
    }

    // Build OG title
    const ogTitle = referrerName
      ? `${referrerName} shared a testimonial with you`
      : `See how ${orgName} helped ${testimonial.clientName}`;

    // Build OG description — use shortDescription
    const ogDescription =
      testimonial.shortDescription ||
      `Read how ${orgName} helped ${testimonial.clientName} achieve great results.`;

    // OG image — use direct CDN URL (same pattern as video page which works on WhatsApp)
    let ogImage: string | null = null;

    if (testimonial.coverImage) {
      ogImage = testimonial.coverImage;
    } else if (testimonial.featuredImage) {
      ogImage = testimonial.featuredImage;
    } else if (org?.icon) {
      ogImage = org.icon;
    }

    // Ensure absolute URL — WhatsApp requires https://
    if (ogImage && !ogImage.startsWith("http")) {
      ogImage = null; // discard relative URLs
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
        type: "article",
        // Single image — WhatsApp only reads the first og:image tag
        ...(ogImage
          ? { images: [{ url: ogImage, width: 1200, height: 630 }] }
          : {}),
        ...(orgName ? { siteName: orgName } : {}),
      },
      twitter: {
        card: ogImage ? "summary_large_image" : "summary",
        title: ogTitle,
        description: ogDescription,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };
  } catch (error) {
    console.error("Error generating testimonial metadata:", error);
    return fallback;
  }
}

export default async function Page() {
  return <TestimonialDetailClient />;
}
