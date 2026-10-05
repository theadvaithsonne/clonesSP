import { permanentRedirect } from "next/navigation";

// The public event page moved to /events/:id. Links to /e/:slug were already
// shared — in confirmation emails, QR tickets and anything a founder pasted —
// so this stays forever as a 308 rather than becoming a 404.

export default async function LegacyEventRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/events/${slug}`);
}
