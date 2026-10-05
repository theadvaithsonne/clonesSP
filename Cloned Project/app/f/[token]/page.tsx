import { Suspense } from "react";
import type { Metadata } from "next";

import ShareableLinkViewer from "./ShareableLinkViewer";

/**
 * Share-link page. A server component for one reason: the title.
 *
 * WhatsApp, Slack, iMessage, Telegram, X and LinkedIn all render their preview
 * card from the HTML they get on the first request — they run no JavaScript, so
 * a `document.title` set in an effect is invisible to every one of them. The
 * title has to be in the markup Next.js serves, which means `generateMetadata`.
 *
 * Everything interactive lives in `ShareableLinkViewer`.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const FALLBACK_TITLE = "Shared File | Garage Cabinet";
const FALLBACK_DESCRIPTION = "A file shared with you on Garage.";

interface LinkMeta {
  sharedBy?: string | null;
  fileName?: string | null;
  fileDescription?: string | null;
  mimeType?: string | null;
  size?: number | null;
  organizationName?: string | null;
  access?: "public" | "office";
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
}

/**
 * Reads `/meta`, not `/public/f/:token` itself: resolving the link increments
 * its access count, and a link pasted in a group chat is fetched by a crawler
 * per participant. A preview must not spend the link's 100 opens.
 *
 * Answers for restricted links too, so a private file still previews with a
 * title instead of a bare URL.
 */
async function fetchLinkMeta(token: string): Promise<LinkMeta | null> {
  try {
    const res = await fetch(`${API_URL}/public/f/${token}/meta`, {
      // The link can be revoked or expire at any time; a cached title would
      // outlive it.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data || null;
  } catch {
    // A metadata fetch must never take the page down with it — the viewer
    // still renders and reports the real failure itself.
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const meta = await fetchLinkMeta(token);

  const fileName = meta?.fileName?.trim();
  const sharedBy = meta?.sharedBy?.trim();

  const title =
    sharedBy && fileName
      ? `${sharedBy} is sharing ${fileName}`
      : fileName
        ? `${fileName} | Garage Cabinet`
        : FALLBACK_TITLE;

  const parts = [
    meta?.fileDescription?.trim(),
    meta?.size ? formatFileSize(meta.size) : "",
    meta?.organizationName ? `Shared from ${meta.organizationName}` : "",
  ].filter(Boolean);

  const description = parts.length > 0 ? parts.join(" · ") : FALLBACK_DESCRIPTION;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Garage",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    // The file is view-only and the link is meant for whoever was sent it —
    // it has no business in a search index.
    robots: { index: false, follow: false },
  };
}

export default async function ShareableLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Suspense because the viewer reads `?ref=` through useSearchParams.
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-black" aria-hidden />}
    >
      <ShareableLinkViewer token={token} />
    </Suspense>
  );
}
