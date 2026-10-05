import { permanentRedirect } from "next/navigation";

// Ticket links live in confirmation emails and on people's phones. They must
// not break because the route was renamed.

export default async function LegacyTicketRedirect({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  permanentRedirect(`/events/${slug}/ticket/${token}`);
}
