"use client";

// A11 · One job's workspace: header (status, place, reward, actions) and the
// Pipeline · Candidates · Job details · Application form · Analytics tabs.
// The candidate drawer opens over any tab.

import React from "react";
import { Copy, Pause, Pencil, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { JOB_PAGES, WORKPLACE_LABELS } from "../../constants";
import { useJobsNav, useJobsNavStore, type JobTab } from "../../nav";
import { useReferralLink } from "../../useReferralLink";
import {
  Button,
  ErrorState,
  LoadingBlock,
  RewardBadge,
  RowMenu,
  StatusPill,
  UnderlineTabs,
  errorMessage,
  useConfirm,
  useLoad,
} from "../../ui";
import CandidateDrawer from "../candidate/CandidateDrawer";
import PipelineBoard from "./PipelineBoard";
import CandidatesTab from "./CandidatesTab";
import JobDetailsTab from "./JobDetailsTab";
import FormTab from "./FormTab";
import AnalyticsTab from "./AnalyticsTab";

export default function JobWorkspace() {
  const nav = useJobsNav();
  const jobId = useJobsNavStore((s) => s.jobId);
  const tab = useJobsNavStore((s) => s.jobTab);
  const pendingApp = useJobsNavStore((s) => s.pendingApplicationId);
  const setNav = useJobsNavStore((s) => s.set);
  const { confirm, confirmDialog } = useConfirm();
  const withRef = useReferralLink();

  const detail = useLoad(
    () => (jobId ? jobsApi.getJob(jobId) : Promise.reject(new Error("Pick a job from Postings."))),
    [jobId]
  );
  const [openApp, setOpenApp] = React.useState<string | null>(null);
  const [siblings, setSiblings] = React.useState<string[]>([]);
  const [initialAction, setInitialAction] = React.useState<"hire" | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [outcome, setOutcome] = React.useState<"active" | "rejected" | "withdrawn">("active");

  React.useEffect(() => {
    if (pendingApp) {
      setOpenApp(pendingApp);
      setSiblings([]);
      setNav({ pendingApplicationId: null });
    }
  }, [pendingApp, setNav]);

  const setTab = (t: JobTab) => setNav({ jobTab: t });
  const open = (id: string, ordered: string[], action: "hire" | null = null) => {
    setInitialAction(action);
    setSiblings(ordered);
    setOpenApp(id);
  };

  const act = async (label: string, fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.success(done);
      detail.reload(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(errorMessage(err, `Couldn't ${label}.`));
    }
  };

  if (detail.loading && !detail.data) return <LoadingBlock label="Loading the job…" />;
  if (detail.error || !detail.data) {
    return (
      <div className="p-8">
        <ErrorState message={detail.error || "Job not found."} onRetry={() => nav.go(JOB_PAGES.postings)} />
      </div>
    );
  }

  const { job, org, publicUrl } = detail.data;
  const place = [job.locations.join(", "), WORKPLACE_LABELS[job.workplace], `${job.openings} opening${job.openings === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-[#1c1c24] px-8 pt-5">
        <div className="text-xs text-[#7c7d94]">
          <button type="button" onClick={() => nav.go(JOB_PAGES.postings)} className="hover:text-white">
            {org.name} / Jobs
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4 pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="truncate text-xl font-semibold text-white">{job.title || "Untitled job"}</h1>
            <StatusPill status={job.status} />
            <span className="text-sm text-[#7c7d94]">{place}</span>
            {job.reward.enabled && <RewardBadge amount={job.reward.amount} />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => nav.openWizard(job._id, job.status === "draft" ? Math.min(6, (job.completedStep || 0) + 1) : 1)}>
              <Pencil className="h-4 w-4" /> Edit job
            </Button>
            {job.channels.publicLink && job.status !== "draft" && (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(withRef(publicUrl));
                    toast.success("Public link copied");
                  } catch {
                    toast.error("Couldn't copy the link.");
                  }
                }}
              >
                <Copy className="h-4 w-4" /> Copy link
              </Button>
            )}
            <RowMenu
              items={[
                ...(job.status === "live"
                  ? [{ label: "Pause job", icon: <Pause className="h-4 w-4" />, onClick: () => act("pause", () => jobsApi.pauseJob(job._id), "Job paused") }]
                  : job.status === "paused"
                    ? [{ label: "Resume job", icon: <Play className="h-4 w-4" />, onClick: () => act("resume", () => jobsApi.resumeJob(job._id), "Job is live again") }]
                    : []),
                ...(["live", "paused", "scheduled"].includes(job.status)
                  ? [
                      {
                        label: "Close job",
                        icon: <XCircle className="h-4 w-4" />,
                        onClick: async () => {
                          const ok = await confirm({
                            title: `Close ${job.title}?`,
                            message:
                              "Applications stop now. Candidates stay in the pipeline, and any referral rewards still held go back to your GaragePay wallet.",
                            confirmLabel: "Close job",
                          });
                          if (ok) act("close the job", () => jobsApi.closeJob(job._id), "Job closed");
                        },
                      },
                    ]
                  : []),
                {
                  label: "Duplicate",
                  icon: <Copy className="h-4 w-4" />,
                  onClick: () =>
                    act(
                      "duplicate",
                      async () => {
                        const res = await jobsApi.duplicateJob(job._id);
                        nav.openWizard(res.job._id, 1);
                      },
                      "Duplicated as a draft"
                    ),
                },
              ]}
            />
          </div>
        </div>
        <UnderlineTabs<JobTab>
          value={tab}
          onChange={(t) => {
            if (t === "candidates") setOutcome("active");
            setTab(t);
          }}
          tabs={[
            { value: "pipeline", label: "Pipeline" },
            { value: "candidates", label: "Candidates", count: detail.data.stats.total || undefined },
            { value: "details", label: "Job details" },
            { value: "form", label: "Application form" },
            { value: "analytics", label: "Analytics" },
          ]}
        />
      </header>

      {tab === "pipeline" ? (
        <PipelineBoard
          jobId={job._id}
          refreshKey={refreshKey}
          onOpen={(id, ordered) => open(id, ordered)}
          onHireDrop={(id, ordered) => open(id, ordered, "hire")}
          onShowOutcome={(s) => {
            setOutcome(s);
            setTab("candidates");
          }}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "candidates" && (
            <CandidatesTab jobId={job._id} initialStatus={outcome} refreshKey={refreshKey} onOpen={(id, ordered) => open(id, ordered)} />
          )}
          {tab === "details" && <JobDetailsTab detail={detail.data} onEdit={(step) => nav.openWizard(job._id, step)} />}
          {tab === "form" && <FormTab job={job} onEdit={() => nav.openWizard(job._id, 3)} />}
          {tab === "analytics" && (
            <div className="px-8 py-5">
              <AnalyticsTab jobId={job._id} />
            </div>
          )}
        </div>
      )}

      <CandidateDrawer
        applicationId={openApp}
        siblings={siblings}
        initialAction={initialAction}
        onSelect={(id) => {
          setInitialAction(null);
          setOpenApp(id);
        }}
        onClose={() => {
          setOpenApp(null);
          setInitialAction(null);
        }}
        onChanged={() => {
          setRefreshKey((k) => k + 1);
          detail.reload(true);
        }}
      />
      {confirmDialog}
    </div>
  );
}
