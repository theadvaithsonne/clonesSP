import React, { Suspense } from "react";
import AthenaDeepLink from "./AthenaDeepLink";
import { Metadata } from "next";
import { Loader2 } from "lucide-react";
const HOST_URL = process.env.NEXT_PUBLIC_APP_URL || "https://garage.app";

interface OgPayload {
  title?: string;
  description?: string;
  assignedBy?: string;
  assignedTo?: string[];
}

interface Props {
  searchParams?: Record<string, string | string[] | undefined>;
}

function parseOgPayload(value?: string | string[]): OgPayload | null {
  if (!value || Array.isArray(value)) return null;
  try {
    // The OG payload may be encoded twice: first with encodeURIComponent(JSON.stringify(...))
    // and then passed through URLSearchParams which encodes percent signs again. Try
    // decoding up to two times to recover the original JSON string.
    let decoded = value as string;
    for (let i = 0; i < 3; i++) {
      try {
        const parsed = JSON.parse(decoded) as OgPayload;
        return parsed;
      } catch (err) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch (e) {
          break;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const ogPayload = parseOgPayload(searchParams?.og);
console.log("ogPayload",ogPayload)
  
  // Build a friendly title when OG payload is present. Format requested:
  // "Person Who Assigned The Task assigned \"Name of task\" to Assignees"
  let title = "";
  if (ogPayload) {
    const taskName = ogPayload.title || "";
    const assignedBy = ogPayload.assignedBy || "Someone";
    const assignees = (ogPayload.assignedTo || []).join(", ") || "someone";
    title = `${assignedBy} assigned \"${taskName}\" to ${assignees}`;
  } else {
    title = (typeof searchParams?.title === "string" ? searchParams.title : "") || "";
  }

  const description = ogPayload?.description || (typeof searchParams?.description === "string" ? searchParams.description : "");
  const url = `${HOST_URL}/taskroom/backOffice/athena`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "Garage.App",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function Page({ searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AthenaDeepLink />
    </Suspense>
  );
}
