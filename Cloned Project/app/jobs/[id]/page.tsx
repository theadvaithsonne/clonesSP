import { Suspense } from "react";
import type { Metadata } from "next";
import JobLandingClient from "./JobLandingClient";
import CareersPageClient from "@/components/jobs-public/CareersPageClient";
import { fetchCareersPage } from "@/components/jobs-public/api";

// `/jobs/:id` serves two things:
//   • a 24-hex id → the Teamforce recruitment landing page, exactly as before
//     (links shared from Teamforce keep working);
//   • anything else → an office slug → that office's Garage Jobs careers page.
// Office slugs are generated from names, so they never look like an ObjectId.

interface PageProps {
  params: Promise<{ id: string }>;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  // The legacy page never had its own metadata; keep it that way.
  if (OBJECT_ID.test(id)) return {};
  try {
    const data = await fetchCareersPage(id, { next: { revalidate: 60 } });
    const name = data.org.name;
    const title = `Careers at ${name}`;
    const description =
      data.careersPage.headline ||
      (data.careersPage.about || data.org.description || "").slice(0, 180) ||
      `${data.jobs.length} open role${data.jobs.length === 1 ? "" : "s"} at ${name}.`;
    const image = absoluteUrl(data.careersPage.coverImage || data.org.icon);
    const url = `${APP_URL}/jobs/${encodeURIComponent(data.org.slug)}`;
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        type: "website",
        url,
        siteName: name,
        images: image ? [{ url: image, alt: title }] : undefined,
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch (err) {
    console.error(`[jobs] careers page metadata failed for "${id}":`, err);
    return { title: "Careers" };
  }
}

export default async function JobsRootPage({ params }: PageProps) {
  const { id } = await params;
  if (OBJECT_ID.test(id)) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-black flex items-center justify-center text-[#7a7a7a] text-sm">
            Loading…
          </div>
        }
      >
        <JobLandingClient />
      </Suspense>
    );
  }
  return <CareersPageClient orgSlug={id} />;
}
