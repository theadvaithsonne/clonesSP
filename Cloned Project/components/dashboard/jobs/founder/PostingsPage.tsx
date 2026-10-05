"use client";

// A2 · Postings — every role the office has created, by status, with the row
// actions (pipeline, edit, duplicate, pause, copy link, close, delete).

import React from "react";
import {
  Briefcase,
  Building2,
  Copy,
  Globe,
  GraduationCap,
  Kanban,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../api";
import { JOB_PAGES } from "../constants";
import { useJobsNav } from "../nav";
import { useReferralLink } from "../useReferralLink";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterMenu,
  GOLD,
  Modal,
  PageHeader,
  RowMenu,
  SearchInput,
  SkeletonRows,
  StageBar,
  StatusPill,
  UnderlineTabs,
  formatDate,
  formatMoney,
  useConfirm,
  useLoad,
  errorMessage,
} from "../ui";
import type { PostingRow } from "../types";

type Tab = "all" | "live" | "draft" | "paused" | "closed";

export default function PostingsPage() {
  const nav = useJobsNav();
  const [tab, setTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [postedBy, setPostedBy] = React.useState("");
  const [sort, setSort] = React.useState("updated");
  const [page, setPage] = React.useState(1);
  const [deleting, setDeleting] = React.useState<PostingRow | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const withRef = useReferralLink();

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, error, reload } = useLoad(
    () => jobsApi.getPostings({ status: tab, q, department, location, postedBy, sort, page }),
    [tab, q, department, location, postedBy, sort, page]
  );

  const org = data?.org;
  const run = async (label: string, fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      reload(true);
    } catch (err) {
      toast.error(err?.message || `Couldn't ${label}.`);
    }
  };

  const openRow = (row: PostingRow) => {
    if (row.status === "draft") nav.openWizard(row._id, Math.min(6, (row.completedStep || 0) + 1));
    else nav.openJob(row._id);
  };

  const menuFor = (row: PostingRow) => {
    const open = ["live", "paused", "scheduled"].includes(row.status);
    return [
      row.status === "draft"
        ? { label: "Continue editing", icon: <Pencil className="h-4 w-4" />, onClick: () => openRow(row) }
        : { label: "View pipeline", icon: <Kanban className="h-4 w-4" />, onClick: () => nav.openJob(row._id) },
      ...(row.status !== "draft"
        ? [{ label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: () => nav.openWizard(row._id, 1) }]
        : []),
      {
        label: "Duplicate",
        icon: <Copy className="h-4 w-4" />,
        onClick: () =>
          run("duplicate", async () => {
            const res = await jobsApi.duplicateJob(row._id);
            nav.openWizard(res.job._id, 1);
          }, "Job duplicated as a draft"),
      },
      ...(row.status === "live"
        ? [{ label: "Pause", icon: <Pause className="h-4 w-4" />, onClick: () => run("pause", () => jobsApi.pauseJob(row._id), "Job paused") }]
        : row.status === "paused"
          ? [{ label: "Resume", icon: <Play className="h-4 w-4" />, onClick: () => run("resume", () => jobsApi.resumeJob(row._id), "Job is live again") }]
          : []),
      {
        label: "Copy public link",
        icon: <Globe className="h-4 w-4" />,
        disabled: !row.channels?.publicLink || !row.publicUrl,
        hint: "Turn on the public link in the Publish step first.",
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(withRef(row.publicUrl));
            toast.success("Public link copied");
          } catch {
            toast.error("Couldn't copy the link.");
          }
        },
      },
      ...(open
        ? [
            {
              label: "Close job",
              icon: <XCircle className="h-4 w-4" />,
              onClick: async () => {
                const ok = await confirm({
                  title: `Close ${row.title}?`,
                  message:
                    "Applications stop immediately. Candidates already in the pipeline stay there, and any referral rewards still held are released back to your GaragePay wallet.",
                  confirmLabel: "Close job",
                });
                if (ok) run("close the job", () => jobsApi.closeJob(row._id), "Job closed");
              },
            },
          ]
        : []),
      {
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        disabled: open,
        hint: "Live jobs can be closed, not deleted.",
        onClick: () => setDeleting(row),
      },
    ];
  };

  const counts = data?.counts;
  return (
    <>
      <PageHeader
        title="Postings"
        subtitle={`Create, publish, and manage every ${org?.name || "office"} role.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => nav.go(JOB_PAGES.settings)}>
              Careers page
            </Button>
            <Button onClick={() => nav.openWizard(null)}>
              <Plus className="h-4 w-4" /> Post a job
            </Button>
          </>
        }
      >
        <UnderlineTabs<Tab>
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          tabs={[
            { value: "all", label: "All", count: counts?.all },
            { value: "live", label: "Live", count: counts?.live },
            { value: "draft", label: "Draft", count: counts?.draft },
            { value: "paused", label: "Paused", count: counts?.paused },
            { value: "closed", label: "Closed", count: counts?.closed },
          ]}
        />
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search jobs" />
          <FilterMenu
            label="Department"
            value={department}
            options={(data?.filters.departments || []).map((d) => ({ value: d, label: d }))}
            onChange={(v) => {
              setDepartment(v);
              setPage(1);
            }}
          />
          <FilterMenu
            label="Location"
            value={location}
            options={(data?.filters.locations || []).map((d) => ({ value: d, label: d }))}
            onChange={(v) => {
              setLocation(v);
              setPage(1);
            }}
          />
          <FilterMenu
            label="Posted by"
            value={postedBy}
            options={(data?.filters.posters || []).map((p) => ({ value: p._id, label: p.name }))}
            onChange={(v) => {
              setPostedBy(v);
              setPage(1);
            }}
          />
          <div className="ml-auto">
            <FilterMenu
              label="Sort"
              value={sort === "updated" ? "" : sort}
              allLabel="Last updated"
              options={[
                { value: "created", label: "Newest" },
                { value: "closes", label: "Closing soonest" },
                { value: "title", label: "Title" },
              ]}
              onChange={(v) => setSort(v || "updated")}
            />
          </div>
        </div>

        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : data && data.postings.length === 0 ? (
          counts?.all === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-10 w-10" />}
              title="No jobs yet"
              description={`Create your first ${org?.name || ""} role. It takes six short steps, and you can save a draft at any point.`}
              action={
                <Button onClick={() => nav.openWizard(null)}>
                  <Plus className="h-4 w-4" /> Post your first job
                </Button>
              }
            />
          ) : (
            <Card className="px-5 py-10 text-center text-sm text-[#7c7d94]">No jobs match these filters.</Card>
          )
        ) : data ? (
          <>
            <Card className="overflow-visible">
              <div className="grid grid-cols-[1.8fr_90px_1.1fr_110px_90px_110px_36px] gap-4 border-b border-[#1f1f24] px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-[#7c7d94]">
                <span>Job</span>
                <span>Status</span>
                <span>Applicants</span>
                <span>Referral reward</span>
                <span>Listed on</span>
                <span>Closes</span>
                <span />
              </div>
              {data.postings.map((row) => (
                <div
                  key={row._id}
                  onClick={() => openRow(row)}
                  className="grid cursor-pointer grid-cols-[1.8fr_90px_1.1fr_110px_90px_110px_36px] items-center gap-4 border-t border-[#1f1f24] px-5 py-3.5 transition-colors first:border-t-0 hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{row.title}</div>
                    <div className="truncate text-xs text-[#7c7d94]">
                      {[row.department, row.createdBy?.name].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div>
                    <StatusPill status={row.status} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm text-white">
                      {row.status === "draft" && !row.applicants ? "—" : row.applicants}
                      {row.newApplicants > 0 && (
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ color: GOLD, background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
                        >
                          {row.newApplicants} new
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <StageBar counts={row.stageCounts} />
                    </div>
                  </div>
                  <div className="text-sm" style={{ color: row.reward.enabled ? GOLD : "#61627a" }}>
                    {row.reward.enabled ? `${formatMoney(row.reward.amount)} / hire` : "—"}
                  </div>
                  <div className="flex items-center gap-1.5 text-[#7c7d94]">
                    {row.channels?.garageHq && <span title="Garage HQ Jobs"><Building2 className="h-3.5 w-3.5" /></span>}
                    {row.channels?.university && <span title="Garage University"><GraduationCap className="h-3.5 w-3.5" /></span>}
                    {row.channels?.publicLink && <span title="Public link"><Globe className="h-3.5 w-3.5" /></span>}
                  </div>
                  <div className="text-sm text-[#c7c7da]">
                    {row.status === "paused"
                      ? "Paused"
                      : row.closesAt
                        ? formatDate(row.closesAt)
                        : "Not set"}
                  </div>
                  <RowMenu items={menuFor(row)} />
                </div>
              ))}
            </Card>
            <div className="mt-4 flex items-center justify-between text-xs text-[#7c7d94]">
              <span>
                Showing {data.postings.length} of {data.total} posting{data.total === 1 ? "" : "s"} · {data.applicantsTotal} applicants total
              </span>
              {data.pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    ← Previous
                  </Button>
                  <span className="text-white">
                    {page} / {data.pages}
                  </span>
                  <Button variant="ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                    Next →
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      <DeleteModal
        job={deleting}
        onClose={() => setDeleting(null)}
        orgName={org?.name}
        onDeleted={() => {
          setDeleting(null);
          reload(true);
        }}
      />
      {confirmDialog}
    </>
  );
}

function DeleteModal({
  job,
  orgName,
  onClose,
  onDeleted,
}: {
  job: PostingRow | null;
  orgName?: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setText(""), [job]);
  return (
    <Modal
      open={!!job}
      onClose={onClose}
      title="Delete job posting?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={text !== "DELETE"}
            loading={busy}
            onClick={async () => {
              if (!job) return;
              setBusy(true);
              try {
                await jobsApi.deleteJob(job._id);
                toast.success("Job deleted");
                onDeleted();
              } catch (err) {
                toast.error(errorMessage(err, "Couldn't delete the job."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete posting
          </Button>
        </>
      }
    >
      <p className="text-sm leading-6 text-zinc-400">
        <span className="text-white">{job?.title}</span> will be removed from {orgName || "your office"}.
        {job && job.applicants > 0 ? " Candidate records stay in your Talent Pool." : ""}
      </p>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Type DELETE to confirm
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white outline-none focus:border-[#f87171]"
          placeholder="DELETE"
        />
      </div>
    </Modal>
  );
}
