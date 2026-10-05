"use client";

// Navigation between the Jobs founder pages.
//
// Each page is a dashboard popover key (`Founder:Jobs:*`) so the sidebar,
// top-bar tab and back/forward history treat it like every other founder page.
// Which job / draft / interview a page shows lives in this small store, kept in
// sessionStorage so a reload lands back on the same record.

import React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { JOB_PAGES } from "./constants";

export type JobTab = "pipeline" | "candidates" | "details" | "form" | "analytics";

interface JobsNavState {
  jobId: string | null;
  jobTab: JobTab;
  wizardJobId: string | null;
  wizardStep: number;
  interviewId: string | null;
  /** Candidate drawer to open when a page mounts (e.g. from the overview). */
  pendingApplicationId: string | null;
  /** Filters the Applications page should start with (from overview links). */
  applicationsPreset: { view?: string; stage?: string; jobId?: string } | null;
  set: (patch: Partial<Omit<JobsNavState, "set">>) => void;
}

export const useJobsNavStore = create<JobsNavState>()(
  persist(
    (set) => ({
      jobId: null,
      jobTab: "pipeline",
      wizardJobId: null,
      wizardStep: 1,
      interviewId: null,
      pendingApplicationId: null,
      applicationsPreset: null,
      set: (patch) => set(patch),
    }),
    {
      name: "garage-jobs-nav",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        jobId: s.jobId,
        jobTab: s.jobTab,
        wizardJobId: s.wizardJobId,
        wizardStep: s.wizardStep,
        interviewId: s.interviewId,
      }),
    }
  )
);

export interface JobsNav {
  go: (page: string) => void;
  openJob: (jobId: string, tab?: JobTab, applicationId?: string) => void;
  /** Open the wizard on an existing draft, or with no id to start a new job. */
  openWizard: (jobId?: string | null, step?: number) => void;
  openScorecard: (interviewId: string) => void;
}

const JobsNavContext = React.createContext<JobsNav | null>(null);

export function JobsNavProvider({
  onNavigate,
  children,
}: {
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}) {
  const set = useJobsNavStore((s) => s.set);
  const value = React.useMemo<JobsNav>(
    () => ({
      go: onNavigate,
      openJob: (jobId, tab = "pipeline", applicationId) => {
        set({ jobId, jobTab: tab, pendingApplicationId: applicationId || null });
        onNavigate(JOB_PAGES.job);
      },
      openWizard: (jobId = null, step = 1) => {
        set({ wizardJobId: jobId, wizardStep: step });
        onNavigate(JOB_PAGES.wizard);
      },
      openScorecard: (interviewId) => {
        set({ interviewId });
        onNavigate(JOB_PAGES.scorecard);
      },
    }),
    [onNavigate, set]
  );
  return <JobsNavContext.Provider value={value}>{children}</JobsNavContext.Provider>;
}

export function useJobsNav(): JobsNav {
  const ctx = React.useContext(JobsNavContext);
  if (!ctx) throw new Error("useJobsNav must be used inside JobsNavProvider");
  return ctx;
}
