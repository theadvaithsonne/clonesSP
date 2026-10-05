"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import CoverfiPasswordGate from "@/components/coverfi/CoverfiPasswordGate";

export default function CoverfiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { amIFounder, loading } = useAmIFounder();
  const router = useRouter();

  // Toggle `coverfi-skin` on <body> so the scoped CSS in globals.css
  // applies — including to dialogs rendered into the React portal.
  useEffect(() => {
    document.body.classList.add("coverfi-skin");
    return () => {
      document.body.classList.remove("coverfi-skin");
    };
  }, []);

  useEffect(() => {
    if (!loading && !amIFounder) {
      router.replace("/");
    }
  }, [loading, amIFounder, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[#9fa0b8] gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
        Loading Coverfi…
      </div>
    );
  }

  if (!amIFounder) return null;

  return (
    <div className="coverfi-skin h-full min-h-[calc(100vh-3.5rem)] bg-[#0a0a0d] text-white animate-in fade-in duration-200">
      <CoverfiPasswordGate>{children}</CoverfiPasswordGate>
    </div>
  );
}
