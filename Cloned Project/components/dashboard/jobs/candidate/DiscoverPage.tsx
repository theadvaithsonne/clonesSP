"use client";

// B1 / F4 · Discover — every live role Garage members can apply to, with
// search and filters, a list on the left and the selected job on the right.
// An empty search offers to turn itself into a job alert.

import React from "react";
import { Bell, Briefcase, Loader2, MapPin, Search } from "lucide-react";
import { EMPLOYMENT_LABELS, WORKPLACE_LABELS } from "../constants";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterMenu,
  GOLD,
  LoadingBlock,
  OrgLogo,
  RewardBadge,
  errorMessage,
} from "../ui";
import type { EmploymentType, WorkplaceType } from "../types";
import AlertModal from "./AlertModal";
import { BOARD_PAGES, useBoardNav, useSavedStore } from "./boardNav";
import * as candidateApi from "./candidateApi";
import type { AlertCriteria, JobViewResponse, PublicJob } from "./candidateTypes";
import JobDetailView from "./JobDetailView";
import { ApplicationBadge, SaveButton, placeText, postedText, salaryText } from "./shared";

const EXPERIENCE_OPTIONS = [0, 1, 2, 3, 5, 8, 10].map((n) => ({
  value: String(n),
  label: n === 0 ? "Fresher" : `${n}${n === 10 ? "+" : ""} year${n === 1 ? "" : "s"}`,
}));
const SALARY_OPTIONS = [50_000, 100_000, 500_000, 1_000_000, 2_000_000, 3_000_000].map((n) => ({
  value: String(n),
  label: `${n.toLocaleString()}+`,
}));
const POSTED_OPTIONS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

export default function DiscoverPage() {
  const nav = useBoardNav();
  const absorb = useSavedStore((s) => s.absorb);

  const [qInput, setQInput] = React.useState("");
  const [locationInput, setLocationInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [workplace, setWorkplace] = React.useState("");
  const [employmentType, setEmploymentType] = React.useState("");
  const [experience, setExperience] = React.useState("");
  const [salaryMin, setSalaryMin] = React.useState("");
  const [postedWithin, setPostedWithin] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [sort, setSort] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [jobs, setJobs] = React.useState<PublicJob[]>([]);
  const [meta, setMeta] = React.useState<{ total: number; pages: number; departments: string[] }>({ total: 0, pages: 1, departments: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [alertOpen, setAlertOpen] = React.useState(false);
  const seq = React.useRef(0);

  const filtersKey = [q, location, workplace, employmentType, experience, salaryMin, postedWithin, department, sort].join("|");
  const anyFilter = !!(q || location || workplace || employmentType || experience || salaryMin || postedWithin || department);

  const fetchPage = React.useCallback(
    async (p: number) => {
      const id = ++seq.current;
      setLoading(true);
      setError(null);
      try {
        const res = await candidateApi.discoverJobs({
          q: q || undefined,
          location: location || undefined,
          workplace: workplace || undefined,
          employmentType: employmentType || undefined,
          experience: experience === "" ? undefined : Number(experience),
          salaryMin: salaryMin ? Number(salaryMin) : undefined,
          postedWithin: postedWithin ? Number(postedWithin) : undefined,
          department: department || undefined,
          sort: sort === "reward" ? "reward" : undefined,
          page: p,
          limit: 20,
        });
        if (id !== seq.current) return;
        absorb(res.jobs);
        setJobs((prev) => (p === 1 ? res.jobs : [...prev, ...res.jobs.filter((j) => !prev.some((x) => x._id === j._id))]));
        setMeta({ total: res.total, pages: res.pages, departments: res.departments });
        if (p === 1) setSelectedId((cur) => (cur && res.jobs.some((j) => j._id === cur) ? cur : res.jobs[0]?._id || null));
      } catch (err) {
        if (id === seq.current) setError(errorMessage(err, "Couldn't load jobs."));
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey, absorb]
  );

  React.useEffect(() => {
    setPage(1);
    fetchPage(1);
  }, [fetchPage]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  const runSearch = () => {
    setQ(qInput.trim());
    setLocation(locationInput.trim());
  };

  const clearAll = () => {
    setQInput("");
    setLocationInput("");
    setQ("");
    setLocation("");
    setWorkplace("");
    setEmploymentType("");
    setExperience("");
    setSalaryMin("");
    setPostedWithin("");
    setDepartment("");
  };

  const alertCriteria: AlertCriteria = {
    q: q || undefined,
    location: location || undefined,
    workplace: workplace ? [workplace as WorkplaceType] : undefined,
    employmentType: employmentType ? [employmentType as EmploymentType] : undefined,
    experience: experience === "" ? undefined : Number(experience),
    salaryMin: salaryMin ? Number(salaryMin) : undefined,
    department: department || undefined,
  };

  const select = (job: PublicJob) => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) nav.openJob(job._id);
    else setSelectedId(job._id);
  };

  return (
    <>
      <header className="border-b border-[#1c1c24] px-8 pb-4 pt-6">
        <h1 className="text-xl font-semibold text-white">Find your next role</h1>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <div className="relative min-w-[240px] flex-[2]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4f5065]" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Title, skill, or company"
              className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand"
            />
          </div>
          <div className="relative min-w-[180px] flex-1">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4f5065]" />
            <input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Location"
              className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterMenu
            label="Workplace"
            value={workplace}
            onChange={setWorkplace}
            options={(Object.keys(WORKPLACE_LABELS) as WorkplaceType[]).map((w) => ({ value: w, label: WORKPLACE_LABELS[w] }))}
          />
          <FilterMenu label="Experience" value={experience} onChange={setExperience} options={EXPERIENCE_OPTIONS} allLabel="Any experience" />
          <FilterMenu label="Salary" value={salaryMin} onChange={setSalaryMin} options={SALARY_OPTIONS} allLabel="Any salary" />
          <FilterMenu
            label="Job type"
            value={employmentType}
            onChange={setEmploymentType}
            options={(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((t) => ({ value: t, label: EMPLOYMENT_LABELS[t] }))}
          />
          <FilterMenu label="Posted" value={postedWithin} onChange={setPostedWithin} options={POSTED_OPTIONS} allLabel="Any time" />
          {meta.departments.length > 0 && (
            <FilterMenu
              label="Department"
              value={department}
              onChange={setDepartment}
              options={meta.departments.map((d) => ({ value: d, label: d }))}
            />
          )}
          {anyFilter && (
            <button type="button" onClick={clearAll} className="text-xs font-medium" style={{ color: GOLD }}>
              Clear all
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {loading && page === 1 && !jobs.length ? (
          <LoadingBlock label="Finding roles…" />
        ) : error && !jobs.length ? (
          <ErrorState message={error} onRetry={() => fetchPage(1)} />
        ) : !jobs.length ? (
          anyFilter ? (
            <EmptyState
              icon={<Search className="h-10 w-10" />}
              title={`No jobs match ${q ? `‘${q}’` : "these filters"}${location ? ` in ${location}` : ""}`}
              description="Try removing a filter or broadening your location. We can notify you when a matching role is posted."
              action={
                <Button onClick={() => setAlertOpen(true)}>
                  <Bell className="h-4 w-4" /> Create alert for this search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Briefcase className="h-10 w-10" />}
              title="No open roles yet"
              description="Offices on Garage haven't published any roles yet. Create an alert to hear as soon as one goes live."
              action={
                <Button onClick={() => setAlertOpen(true)}>
                  <Bell className="h-4 w-4" /> Create a job alert
                </Button>
              }
            />
          )
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-white">
                  {meta.total} job{meta.total === 1 ? "" : "s"}
                </span>
                <FilterMenu
                  label="Sort"
                  value={sort}
                  onChange={setSort}
                  allLabel="Most recent"
                  options={[{ value: "reward", label: "Highest referral reward" }]}
                />
              </div>
              <Card className="overflow-hidden">
                {jobs.map((job) => (
                  <JobRow key={job._id} job={job} selected={job._id === selectedId} onSelect={() => select(job)} />
                ))}
              </Card>
              {page < meta.pages && (
                <div className="mt-3 flex justify-center">
                  <Button variant="secondary" onClick={loadMore} loading={loading}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
            <div className="hidden min-w-0 lg:block">
              {selectedId ? (
                <DetailPane
                  jobId={selectedId}
                  onApply={() => nav.openApply(selectedId)}
                  onOpenFull={() => nav.openJob(selectedId)}
                  onViewApplication={() => nav.go(BOARD_PAGES.applications)}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>

      <AlertModal open={alertOpen} onClose={() => setAlertOpen(false)} initial={alertCriteria} onSaved={() => undefined} />
    </>
  );
}

function JobRow({ job, selected, onSelect }: { job: PublicJob; selected: boolean; onSelect: () => void }) {
  const salary = salaryText(job);
  return (
    <div
      onClick={onSelect}
      className="flex cursor-pointer gap-3 border-t border-[#1f1f24] px-4 py-3.5 transition-colors first:border-t-0 hover:bg-white/[0.02]"
      style={selected ? { boxShadow: `inset 3px 0 0 ${GOLD}`, background: "rgba(255,255,255,0.02)" } : undefined}
    >
      <OrgLogo name={job.org?.name} src={job.org?.icon} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{job.title}</div>
            <div className="truncate text-xs text-[#7c7d94]">{[job.org?.name, placeText(job)].filter(Boolean).join(" · ")}</div>
          </div>
          <SaveButton jobId={job._id} compact />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#61627a]">
          {salary && <span className="text-[#c7c7da]">{salary}</span>}
          {job.skills.length > 0 && <span>{job.skills.slice(0, 2).join(" · ")}</span>}
          <span>{postedText(job)}</span>
          <ApplicationBadge job={job} />
          {job.reward && <RewardBadge amount={job.reward.amount} size="sm" />}
        </div>
      </div>
    </div>
  );
}

function DetailPane({
  jobId,
  onApply,
  onOpenFull,
  onViewApplication,
}: {
  jobId: string;
  onApply: () => void;
  onOpenFull: () => void;
  onViewApplication: () => void;
}) {
  const cache = React.useRef(new Map<string, JobViewResponse>());
  const [data, setData] = React.useState<JobViewResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    const hit = cache.current.get(jobId);
    setData(hit || null);
    candidateApi
      .getJobView(jobId)
      .then((res) => {
        if (cancelled) return;
        cache.current.set(jobId, res);
        setData(res);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load this job.")));
    // Count a view only once the job has been on screen for a moment.
    const t = setTimeout(() => candidateApi.recordJobView(jobId, "garage_hq"), 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [jobId]);

  return (
    <Card className="p-6 lg:sticky lg:top-0">
      {error ? (
        <p className="text-sm text-[#f87171]">{error}</p>
      ) : !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#7c7d94]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <JobDetailView data={data} variant="pane" onApply={onApply} onOpenFull={onOpenFull} onViewApplication={onViewApplication} />
      )}
    </Card>
  );
}
