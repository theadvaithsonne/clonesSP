import type { Metadata } from "next";
import ConfirmationClient from "./ConfirmationClient";

export const metadata: Metadata = {
  title: "Registration confirmed",
  robots: { index: false, follow: false },
};

export default async function EventConfirmationPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>;
}) {
  const { id, token } = await params;
  return <ConfirmationClient slug={id} token={token} />;
}
