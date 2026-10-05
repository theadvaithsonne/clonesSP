"use client";

// Garage Jobs — founder console. The dashboard renders this for every
// `Founder:Jobs*` popover and it picks the page. The dashboard hides its
// floating bottom bar on these pages: the sidebar carries the Jobs
// sub-navigation and the wizard, pipeline and drawers have their own action
// bars where it would sit.

import React from "react";
import { JOB_PAGES } from "../constants";
import { JobsNavProvider } from "../nav";
import JobsAccessGate from "../JobsAccessGate";
import OverviewPage from "./OverviewPage";
import PostingsPage from "./PostingsPage";
import JobWizard from "./wizard/JobWizard";
import JobWorkspace from "./workspace/JobWorkspace";
import ScorecardPage from "./candidate/ScorecardPage";
import ApplicationsPage from "./ApplicationsPage";
import TalentPoolPage from "./TalentPoolPage";
import PayoutsPage from "./PayoutsPage";
import SettingsPage from "./settings/SettingsPage";

export default function FounderJobsApp({
  page,
  onNavigate,
}: {
  page: string;
  onNavigate: (page: string | null) => void;
}) {
  const go = React.useCallback((p: string) => onNavigate(p), [onNavigate]);

  let content: React.ReactNode;
  switch (page) {
    case JOB_PAGES.postings:
      content = <PostingsPage />;
      break;
    case JOB_PAGES.wizard:
      content = <JobWizard />;
      break;
    case JOB_PAGES.job:
      content = <JobWorkspace />;
      break;
    case JOB_PAGES.scorecard:
      content = <ScorecardPage />;
      break;
    case JOB_PAGES.applications:
      content = <ApplicationsPage />;
      break;
    case JOB_PAGES.talentPool:
      content = <TalentPoolPage />;
      break;
    case JOB_PAGES.payouts:
      content = <PayoutsPage />;
      break;
    case JOB_PAGES.settings:
      content = <SettingsPage />;
      break;
    default:
      content = <OverviewPage />;
  }

  return (
    <JobsAccessGate>
      <JobsNavProvider onNavigate={go}>
        <div className="flex h-full min-h-0 flex-col bg-[#0c0c0e]">{content}</div>
      </JobsNavProvider>
    </JobsAccessGate>
  );
}
