"use client";

import { Suspense } from "react";
import { Welcome } from "@/components/welcome";

function WelcomeLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#1a1a22] animate-pulse" />
        <div className="h-6 w-32 rounded bg-[#1a1a22] animate-pulse" />
      </div>
    </div>
  );
}

export function WelcomeRootClient() {
  return (
    <Suspense fallback={<WelcomeLoadingFallback />}>
      <Welcome />
    </Suspense>
  );
}
