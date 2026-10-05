"use client";

// B2 / F5 · A job's full page for signed-in members: the description, the
// apply card, sharing and — for affiliates — the referral card. A closed role
// says so and offers similar roles instead of an apply button.

import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button, ErrorState, LoadingBlock, errorMessage } from "../ui";
import { BOARD_PAGES, referralFor, useBoardNav, useBoardStore } from "./boardNav";
import * as candidateApi from "./candidateApi";
import type { JobViewResponse } from "./candidateTypes";
import JobDetailView from "./JobDetailView";

export default function JobPage() {
  const nav = useBoardNav();
  const jobId = useBoardStore((s) => s.jobId);
  const [data, setData] = React.useState<JobViewResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await candidateApi.getJobView(jobId));
    } catch (err) {
      setError(errorMessage(err, "Couldn't load this job."));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    load();
    if (jobId) candidateApi.recordJobView(jobId, referralFor(jobId).source || "garage_hq");
  }, [jobId, load]);

  if (!jobId) {
    return (
      <div className="p-8">
        <ErrorState message="No job selected." onRetry={() => nav.go(BOARD_PAGES.discover)} />
      </div>
    );
  }

  return (
    <>
      <header className="flex items-center gap-4 border-b border-[#1c1c24] px-8 py-4">
        <button
          type="button"
          onClick={() => nav.go(BOARD_PAGES.discover)}
          className="inline-flex items-center gap-1.5 text-sm text-[#7c7d94] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to jobs
        </button>
        {data && !data.job.isOpen && (
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={() => nav.go(BOARD_PAGES.discover)}
          >
            See similar roles
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data ? (
          <div className="mx-auto max-w-6xl">
            <JobDetailView
              data={data}
              variant="full"
              onApply={() => nav.openApply(data.job._id)}
              onViewApplication={() => nav.openApplications(data.myApplication?.status === "active" ? "active" : "closed")}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
