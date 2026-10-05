import { Metadata } from "next";

// Prevent caching of meet pages to ensure fresh Daily SDK and meeting state
export const metadata: Metadata = {
  title: "Join Meeting",
};

// Force dynamic rendering - no caching at all for meet pages
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MeetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
