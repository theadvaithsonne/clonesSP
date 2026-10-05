import { Metadata } from "next";
import { Suspense } from "react";
import { Welcome } from "@/components/welcome";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://my.garage.app";
}

/**
 * The Garage mark on its dark tile — 1024×1024, and the same asset the app
 * ships as its icon. Chosen over public/garage-logo.png, which is a white
 * wordmark on transparency: chat apps composite that onto white and it
 * disappears.
 *
 * Only the fallback now: when the referrer has a profile picture the card
 * shows their face instead, because the card is an invitation from a person.
 */
const OG_IMAGE = "/icon.png";

/**
 * Chat apps fetch the OG image out of band, with no page context, so a
 * relative or protocol-less URL is dropped. Profile pictures come back from
 * the API in every shape a user can upload one in — absolute CDN URL,
 * app-relative path, or a `data:` blob that no crawler will follow — so
 * anything that isn't an absolute http(s) URL after normalising is rejected
 * back to the Garage mark.
 */
function toAbsoluteImageUrl(src: string | undefined | null): string | null {
  const raw = src?.trim();
  if (!raw) return null;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${getSiteUrl()}${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

interface Props {
  searchParams: Promise<{ referCode?: string; ref?: string }>;
}

/**
 * OG tags for shared invite links.
 *
 * A referral link is pasted into WhatsApp far more often than it is typed, so
 * the preview card is the first thing most people see of Garage. Naming the
 * sender there — "Rehan is inviting you to join Garage" — is what makes it read
 * as an invitation from a person rather than a link to a login form.
 *
 * The name and profile picture are resolved server-side from the affiliate
 * code on the URL. Anything that fails (no code, dead code, nameless referrer,
 * unreachable API) falls back to the generic card: a preview that says
 * "undefined is inviting you" is worse than one that never mentions a person
 * at all.
 *
 * The image is the referrer's profile picture, not the Garage mark: the card
 * is an invitation from a person, and a face is what makes it read as one.
 * The mark is still used for referrers with no picture set.
 */
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  // Same two param names /login itself accepts: `ref` on storefront share
  // links, `referCode` on the app's own invite links.
  const sp = await searchParams;
  const referCode = sp.referCode || sp.ref;

  // No title either when there's no code to name anyone: the root layout's
  // card is already correct for a plain visit to /login.
  const fallback: Metadata = {};

  if (!referCode) return fallback;

  try {
    const res = await fetch(
      // `light=1` — name + picture only. The full response runs a 50-deep
      // $graphLookup over the referrer's whole downline to build stats this
      // card never shows, and crawlers hit these links in bursts.
      `${API_BASE}/affiliate/referrer-info?light=1&affiliateId=${encodeURIComponent(
        referCode
      )}`,
      // Cached for 5 minutes, matching the guest pages: a referrer's name
      // changes about never.
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return fallback;

    const json = await res.json();
    // The backend returns "" rather than "Unknown" for a nameless user, so an
    // empty name has to fall back too — see getSponsorCardByAffiliateId.
    const referrer = json?.success ? json?.referrer : undefined;
    const name: string | undefined = referrer?.name?.trim() || undefined;
    if (!name) return fallback;

    const title = `${name} is inviting you to join Garage`;
    const description = `${name} is inviting you into their office on Garage — the virtual office where teams meet, work and grow their network in one place. Open the link to join.`;

    const avatar = toAbsoluteImageUrl(referrer?.profilePicture);
    const image = avatar
      ? { url: avatar, alt: name }
      : { url: OG_IMAGE, width: 1024, height: 1024, alt: "Garage" };

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${getSiteUrl()}/login?referCode=${encodeURIComponent(referCode)}`,
        siteName: "Garage",
        type: "website",
        images: [image],
      },
      // `summary` keeps a square image square. `summary_large_image` would
      // crop a 1:1 avatar to a 1.91:1 banner, cutting the face in half.
      twitter: {
        card: "summary",
        title,
        description,
        images: [image.url],
      },
    };
  } catch {
    // Non-critical — the login page still works without a personalised card.
    return fallback;
  }
}

function WelcomeLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#1a1a22] animate-pulse" />
        <div className="h-6 w-32 rounded bg-[#1a1a22] animate-pulse" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<WelcomeLoadingFallback />}>
      <Welcome />
    </Suspense>
  );
}
