"use client";

// Garage Jobs is allow-listed while it rolls out (lib/jobsConfig). The sidebar
// hides the Jobs groups from everyone else; this gate covers the pages too, so
// a deep link (?openApp=jobs, an alert email) can't open them either.

import React from "react";
import { Lock } from "lucide-react";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { isJobsAllowed } from "@/lib/jobsConfig";
import { EmptyState, LoadingBlock } from "./ui";

export default function JobsAccessGate({ children }: { children: React.ReactNode }) {
  const { userData, loading } = useAmIFounder();
  if (loading && !userData?.email) return <LoadingBlock />;
  if (!isJobsAllowed(userData?.email)) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<Lock className="h-8 w-8" />}
          title="Jobs isn't available on your account yet"
          description="Garage Jobs is rolling out gradually and will appear in your sidebar once it's turned on for you."
        />
      </div>
    );
  }
  return <>{children}</>;
}
