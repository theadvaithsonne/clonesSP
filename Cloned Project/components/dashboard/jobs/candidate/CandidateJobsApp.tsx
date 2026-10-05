"use client";

// Garage Jobs — the member side (Job Board). The dashboard renders this for
// every "Job Board" popover and it picks the screen: Discover, a job, the
// apply flow, My Applications or Saved.
//
// Deep link: /workspace?openApp=jobs&jobId=…[&ref=…][&source=…][&apply=1]
// opens that job (or straight into its application) and remembers the
// referral so the application is credited to whoever shared the link. The
// params are then stripped so a reload doesn't replay them.

import React from "react";
import ApplyFlow from "./ApplyFlow";
import JobsAccessGate from "../JobsAccessGate";
import { BOARD_PAGES, BoardNavProvider, rememberReferral, useBoardStore } from "./boardNav";
import DiscoverPage from "./DiscoverPage";
import JobPage from "./JobPage";
import MyApplicationsPage from "./MyApplicationsPage";
import SavedPage from "./SavedPage";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export default function CandidateJobsApp({
  page,
  onNavigate,
}: {
  page: string;
  onNavigate: (page: string | null) => void;
}) {
  const go = React.useCallback((p: string) => onNavigate(p), [onNavigate]);
  const setStore = useBoardStore((s) => s.set);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("jobId");
    if (!jobId || !OBJECT_ID.test(jobId)) return;
    rememberReferral(jobId, { ref: params.get("ref"), source: params.get("source") });
    const apply = params.get("apply") === "1";
    if (apply) {
      setStore({ jobId, applyJobId: jobId });
      onNavigate(BOARD_PAGES.apply);
    } else {
      setStore({ jobId });
      onNavigate(BOARD_PAGES.job);
    }
    for (const key of ["jobId", "ref", "source", "apply", "openApp"]) params.delete(key);
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    // Mount-only: the link is consumed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let content: React.ReactNode;
  switch (page) {
    case BOARD_PAGES.job:
      content = <JobPage />;
      break;
    case BOARD_PAGES.apply:
      content = <ApplyFlow />;
      break;
    case BOARD_PAGES.applications:
      content = <MyApplicationsPage />;
      break;
    case BOARD_PAGES.saved:
      content = <SavedPage />;
      break;
    default:
      content = <DiscoverPage />;
  }

  return (
    <JobsAccessGate>
      <BoardNavProvider onNavigate={go}>
        <div className="flex h-full min-h-0 flex-col bg-[#0c0c0e]">{content}</div>
      </BoardNavProvider>
    </JobsAccessGate>
  );
}
