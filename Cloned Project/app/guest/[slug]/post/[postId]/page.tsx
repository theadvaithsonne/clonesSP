import { Metadata } from "next";
import PostPageClient from "./PostPageClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Build the canonical site URL for constructing absolute proxy URLs.
 * Uses Vercel env vars → NEXT_PUBLIC_APP_URL → hardcoded fallback.
 */
function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://my.garage.app";
}

/**
 * Route ALL external images through our /api/og-image proxy so social-media
 * crawlers (especially WhatsApp) can reliably load them.
 *
 * Many CDN hosts set restrictive headers (x-robots-tag: noindex, strict CORS,
 * or bot-blocking) that prevent crawlers from fetching images directly.
 * Proxying through our own domain guarantees the image is always accessible.
 */
function proxyImageIfNeeded(imageUrl: string): string {
  // Only proxy external http(s) URLs — skip data URIs, relative paths, etc.
  if (imageUrl.startsWith("http")) {
    return `${getSiteUrl()}/api/og-image?url=${encodeURIComponent(imageUrl)}`;
  }
  return imageUrl;
}

interface Props {
  params: Promise<{ slug: string; postId: string }>;
  searchParams: Promise<{ referCode?: string }>;
}

/**
 * Server-side metadata generation for OG tags on shared post links.
 *
 * Image strategy:
 *  – ALL external images are routed through /api/og-image proxy
 *  – This bypasses restrictive CDN headers that block social crawlers
 *  – Only ONE og:image tag (WhatsApp ignores all but the first)
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug, postId } = await params;
  const { referCode } = await searchParams;

  const canonicalUrl = `${getSiteUrl()}/guest/${slug}/post/${postId}${referCode ? `?referCode=${referCode}` : ""}`;

  const fallback: Metadata = {
    title: "View Post | Garage",
    description: "View this post on Garage.",
  };

  try {
    const postRes = await fetch(`${API_BASE}/public/posts/${postId}`, {
      next: { revalidate: 60 },
    });
    if (!postRes.ok) return fallback;

    const postJson = await postRes.json();
    if (!postJson.success || !postJson.post) return fallback;

    const postData = postJson.post;
    const orgData = postData.organization;
    const authorName = postData.author?.name || "Someone";
    const isArticle = postData.postType === "article";

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
      } catch {
        // non-critical
      }
    }

    // Build text snippet (first 160 chars), strip HTML for articles
    const rawContent = postData.content || "";
    const cleanContent = rawContent
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const snippet =
      cleanContent.length > 160
        ? cleanContent.slice(0, 157) + "..."
        : cleanContent;

    // Determine post title: explicit title → first portion of content → generic label
    const postTitle = postData.title
      || (cleanContent.length > 0
        ? (cleanContent.length > 80 ? cleanContent.slice(0, 77) + "..." : cleanContent)
        : "a post");

    const ogTitle = referrerName
      ? `${referrerName} shared ${postTitle} with you`
      : `${authorName} posted on ${orgData?.name || "Garage"}`;

    const ogDescription =
      snippet ||
      (orgData?.name
        ? `View this post on ${orgData.name}`
        : "View this post on Garage");

    // Resolve image: coverImage → first image attachment → link preview → org icon
    let ogImage: string | null = postData.coverImage || null;
    if (!ogImage && postData.attachments?.length > 0) {
      const firstImage = postData.attachments.find(
        (a: any) => a.type === "image"
      );
      if (firstImage?.url) ogImage = firstImage.url;
    }
    if (!ogImage && postData.linkPreviews?.length > 0) {
      const firstLP = postData.linkPreviews.find(
        (lp: any) => lp.image && lp.showThumbnail !== false
      );
      if (firstLP?.image) ogImage = firstLP.image;
    }
    if (!ogImage && orgData?.icon) {
      ogImage = orgData.icon;
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
        // Canonical URL — critical for WhatsApp link preview association
        url: canonicalUrl,
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
    console.error("Error generating post metadata:", error);
    return fallback;
  }
}

export default async function Page() {
  return <PostPageClient />;
}

