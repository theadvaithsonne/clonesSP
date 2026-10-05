import type { Metadata } from "next";
import MyTicketsClient from "./MyTicketsClient";

// "My tickets" — the way back to a pass when the attendee no longer has the
// link. Linked from the public event site's nav and footer.

export const metadata: Metadata = {
  title: "My tickets",
  // Nothing here is worth indexing, and the page only ever renders someone's
  // own booking.
  robots: { index: false, follow: false },
};

export default async function MyTicketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MyTicketsClient slug={id} />;
}
