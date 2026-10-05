import { Suspense } from "react";
import type { Metadata } from "next";
import PublicJobClient from "@/components/jobs-public/PublicJobClient";
import { fetchPublicJob } from "@/components/jobs-public/api";

// Public Garage Jobs posting — `/jobs/<office slug>/<job slug>?ref=<affiliateId>`.
// The segment is named `id` only because `/jobs/[id]` already exists for the
// Teamforce landing page; here it is always the office slug.

interface PageProps {
  params: Promise<{ id: string; jobSlug: string }>;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://my.garage.app";

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

function plainText(html?: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, jobSlug } = await params;
  try {
    const { job } = await fetchPublicJob(id, jobSlug, null, { next: { revalidate: 60 } });
    const orgName = job.org?.name;
    const title = orgName ? `${job.title} at ${orgName}` : job.title;
    const where = [job.locations[0], job.workplace === "remote" ? "Remote" : null].filter(Boolean).join(" · ");
    const summary = plainText(job.description?.aboutRole).slice(0, 180);
    const description = [where, summary].filter(Boolean).join(" — ") || `Apply to ${title} on Garage.`;
    const image = absoluteUrl(job.org?.icon);
    const url = `${APP_URL}/jobs/${encodeURIComponent(job.org?.slug || id)}/${encodeURIComponent(job.slug)}`;
    return {
      title,
      description,
      alternates: { canonical: url },
      robots: job.isOpen ? { index: true, follow: true } : { index: false, follow: true },
      openGraph: {
        title,
        description,
        type: "website",
        url,
        siteName: orgName || "Garage Jobs",
        images: image ? [{ url: image, alt: orgName || title }] : undefined,
      },
      twitter: {
        card: "summary",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch (err) {
    console.error(`[jobs] job page metadata failed for "${id}/${jobSlug}":`, err);
    return { title: "Job" };
  }
}

export default async function PublicJobPage({ params }: PageProps) {
  const { id, jobSlug } = await params;
  // useSearchParams (for ?ref / ?source) needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0c0c0e]" />}>
      <PublicJobClient orgSlug={id} jobSlug={jobSlug} />
    </Suspense>
  );
}
