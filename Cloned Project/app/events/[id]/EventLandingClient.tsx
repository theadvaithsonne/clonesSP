"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import EventSiteRenderer, {
  type PublicTier,
} from "@/components/events/site/EventSiteRenderer";
import {
  getPublicEvent,
  type PublicEventPayload,
} from "@/components/dashboard/inlineApps/events/api";
import ShareEventModal from "@/components/events/ShareEventModal";

/**
 * The customer-facing event page.
 *
 * Fetched client-side rather than in the server component: the API is on a
 * separate host behind the browser's session, and the page is fully public
 * so there is nothing to gain from SSR-ing the body.
 */
export default function EventLandingClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [data, setData] = useState<PublicEventPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicEvent(slug)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Event not found");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-[#15151a]">Event not found</h1>
          <p className="mt-3 text-sm text-[#8c8d9c]">
            This event may have been unpublished or the link is incorrect.
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-7 w-7 animate-spin text-[#c9cad4]" />
      </main>
    );
  }

  return (
    <>
      <EventSiteRenderer
        event={data.event}
        blocks={data.website.blocks}
        theme={data.website.theme}
        tiers={data.tiers as unknown as PublicTier[]}
        speakers={data.speakers}
        sessions={data.sessions}
        sponsors={data.sponsors}
        organizationName={data.organization?.name}
        organizationIcon={data.organization?.icon}
        // Checkout is its own page, not a slide-over: the buyer gets a URL they
        // can reload, share and come back to after paying.
        onGetTickets={(tierId) =>
          router.push(
            `/events/${slug}/checkout${tierId ? `?tier=${tierId}` : ""}`,
          )
        }
        onShare={() => setShareOpen(true)}
      />
      <ShareEventModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        event={data.event}
        theme={data.website.theme}
      />
    </>
  );
}
