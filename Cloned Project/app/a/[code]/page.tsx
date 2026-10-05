import type { Metadata } from "next";
import IrlHandoff from "@/components/garage-irl/IrlHandoff";

// A counter bill's "attach to bill" QR. Hands off to GarageIRL.

export const metadata: Metadata = {
  title: "GarageIRL",
  robots: { index: false, follow: false },
};

export default async function BillQrPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <IrlHandoff kind="bill" id={code} />;
}
