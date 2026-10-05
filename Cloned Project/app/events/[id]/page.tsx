import type { Metadata } from "next";
import EventLandingClient from "./EventLandingClient";

// Public event landing page, rendered from the organizer's Web Builder config.
//
// `/events/:id` is the canonical customer URL — what "Preview" and "Copy link"
// in the founder console point at, and what a connected custom domain serves
// at its root. `:id` accepts the slug or the raw event id, so links shared
// before the rename keep resolving.

interface PageProps {
  params: Promise<{ id: string }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.my.garage.app";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://my.garage.app";

/**
 * Crawlers do not resolve relative URLs against the page they scraped — an
 * `og:image` of `/uploads/x.png` is simply dropped, which is the usual reason
 * a link unfurls with the right title and no picture. Anything that isn't
 * already absolute is resolved against the app's own origin here.
 */
function absoluteUrl(value?: string | null): string | undefined {
  const raw = (value || "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  try {
    return new URL(raw, APP_URL).toString();
  } catch {
    return undefined;
  }
}

/**
 * Link-preview metadata. Fetched server-side because Slack/WhatsApp/X never
 * run the client bundle — without this an event link unfurls as a blank card.
 * Failures fall back to a generic title rather than breaking the page.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${API_URL}/public/event-management/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    const event = data?.event;
    if (!event) throw new Error("not found");

    // The organizer's own SEO and sharing settings win over the derived
    // defaults — that is the whole point of the Website settings page. Each
    // field falls back independently, so filling in one doesn't blank another.
    const seo = data?.website?.seo || {};
    const social = data?.website?.social || {};
    const branding = data?.website?.branding || {};

    const fallbackTitle = event.name as string;
    const fallbackDescription =
      event.shortDescription ||
      `${new Date(event.startsAt).toDateString()}${
        event.venue?.city ? ` · ${event.venue.city}` : ""
      }`;

    const title = seo.title || fallbackTitle;
    const description = seo.description || fallbackDescription;
    const shareImage = absoluteUrl(social.ogImageUrl || event.bannerUrl);
    // The canonical URL is derived, never typed: a connected custom domain is
    // the canonical home of the page, otherwise the Garage URL is.
    const canonical = data?.website?.customDomain
      ? `https://${data.website.customDomain}`
      : `${APP_URL}/events/${event.slug || id}`;

    return {
      title,
      description,
      keywords: seo.keywords?.length ? seo.keywords : undefined,
      alternates: { canonical },
      // A draft run-through or an invite-only event should not be indexed.
      // Stated either way rather than left off, so a page that was once
      // noIndex is not left to a crawler's memory of the old header.
      robots: seo.noIndex
        ? { index: false, follow: false }
        : { index: true, follow: true },
      icons: absoluteUrl(branding.faviconUrl)
        ? { icon: absoluteUrl(branding.faviconUrl)! }
        : undefined,
      openGraph: {
        title: social.ogTitle || title,
        description: social.ogDescription || description,
        type: "website",
        url: canonical,
        siteName: branding.siteName || data?.organization?.name || title,
        // Dimensions matter: WhatsApp and LinkedIn skip an image they can't
        // size up front, which reads as "the banner never shows".
        images: shareImage
          ? [{ url: shareImage, width: 1200, height: 630, alt: title }]
          : undefined,
      },
      twitter: {
        card:
          social.twitterCard || (shareImage ? "summary_large_image" : "summary"),
        site: social.twitterHandle || undefined,
        title: social.ogTitle || title,
        description: social.ogDescription || description,
        images: shareImage ? [shareImage] : undefined,
      },
    };
  } catch (err) {
    // Swallowing this made every failure look like "sharing is broken" with
    // nothing to go on. The fallback stays, the reason now reaches the logs.
    console.error(`[events] link metadata failed for "${id}":`, err);
    return { title: "Event" };
  }
}

export default async function PublicEventPage({ params }: PageProps) {
  const { id } = await params;
  return <EventLandingClient slug={id} />;
}
