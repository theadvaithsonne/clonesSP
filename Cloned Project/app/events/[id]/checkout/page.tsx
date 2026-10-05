import type { Metadata } from "next";
import CheckoutClient from "./CheckoutClient";

// Full-page ticket checkout for a public event.
//
// `/events/:id/checkout` replaces the slide-over drawer the landing page used
// to open. `?tier=` preselects the pass the buyer clicked on the landing page.

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string; ref?: string; referCode?: string }>;
}

export const metadata: Metadata = {
  title: "Checkout",
  // A checkout URL carries a buyer's selection, not content worth indexing.
  robots: { index: false, follow: false },
};

export default async function EventCheckoutPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { tier, ref, referCode } = await searchParams;
  // Read on the server rather than with `useSearchParams`, so the client
  // component never needs a Suspense boundary to stay prerenderable.
  return (
    <CheckoutClient
      slug={id}
      initialTierId={tier}
      initialRef={ref || referCode}
    />
  );
}
