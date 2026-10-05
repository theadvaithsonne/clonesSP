import type { Metadata } from "next";
import IrlHandoff from "@/components/garage-irl/IrlHandoff";

// A store's printed counter QR. Belongs to GarageIRL, not HQ — `?ref=` here is
// the table label, read client-side by IrlHandoff.

export const metadata: Metadata = {
  title: "GarageIRL",
  robots: { index: false, follow: false },
};

export default async function CounterQrPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <IrlHandoff kind="store" id={slug} />;
}
