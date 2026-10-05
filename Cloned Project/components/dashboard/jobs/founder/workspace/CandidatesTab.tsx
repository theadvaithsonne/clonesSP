"use client";

// Job workspace · Candidates — every application to this job as a list, by
// status. The pipeline shows the active ones by stage; this is where hired,
// rejected and withdrawn candidates stay findable.

import React from "react";
import * as jobsApi from "../../api";
import { SOURCE_LABELS } from "../../constants";
import {
  Avatar,
  Card,
  ErrorState,
  MatchScore,
  SearchInput,
  SkeletonRows,
  StagePill,
  UnderlineTabs,
  formatDate,
  timeAgo,
  useLoad,
} from "../../ui";

type Status = "active" | "hired" | "rejected" | "withdrawn" | "all";

export default function CandidatesTab({
  jobId,
  initialStatus = "active",
  refreshKey,
  onOpen,
}: {
  jobId: string;
  initialStatus?: Status;
  refreshKey: number;
  onOpen: (applicationId: string, ordered: string[]) => void;
}) {
  const [status, setStatus] = React.useState<Status>(initialStatus);
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => setStatus(initialStatus), [initialStatus]);
  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, error, reload } = useLoad(
    () => jobsApi.getApplications({ jobId, status, q: q || undefined, page, limit: 50 }),
    [jobId, status, q, page, refreshKey]
  );
  const ids = data?.applications.map((a) => a._id) || [];

  return (
    <div className="px-8 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <UnderlineTabs<Status>
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          tabs={[
            { value: "active", label: "In process" },
            { value: "hired", label: "Hired" },
            { value: "rejected", label: "Rejected" },
            { value: "withdrawn", label: "Withdrawn" },
            { value: "all", label: "All" },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Name, email or skill" />
      </div>
      {loading && !data ? (
        <SkeletonRows />
      ) : error ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : data && data.applications.length ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1fr_70px_1fr_110px_1.2fr] gap-4 border-b border-[#1f1f24] px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-[#7c7d94]">
            <span>Candidate</span>
            <span>Stage</span>
            <span>Match</span>
            <span>Source</span>
            <span>Applied</span>
            <span>Last activity</span>
          </div>
          {data.applications.map((a) => (
            <button
              key={a._id}
              type="button"
              onClick={() => onOpen(a._id, ids)}
              className="grid w-full grid-cols-[1.6fr_1fr_70px_1fr_110px_1.2fr] items-center gap-4 border-t border-[#1f1f24] px-5 py-3 text-left transition-colors first:border-t-0 hover:bg-white/[0.02]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={a.candidate.name} src={a.candidate.avatar} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white">{a.candidate.name}</span>
                  <span className="block truncate text-xs text-[#7c7d94]">{a.candidate.email}</span>
                </span>
              </span>
              <span>
                <StagePill category={a.stage.category} name={a.status === "active" ? a.stage.name : a.status[0].toUpperCase() + a.status.slice(1)} />
              </span>
              <span>
                <MatchScore score={a.matchScore} />
              </span>
              <span className="truncate text-xs text-[#c7c7da]">
                {a.referral ? `Referral · ${a.referral.affiliateId}` : SOURCE_LABELS[a.source]}
              </span>
              <span className="text-xs text-[#c7c7da]">{formatDate(a.appliedAt)}</span>
              <span className="min-w-0 truncate text-xs text-[#7c7d94]">
                {a.lastActivity} {a.lastActivityAt ? `· ${timeAgo(a.lastActivityAt)}` : ""}
              </span>
            </button>
          ))}
          {data.pages > 1 && (
            <div className="flex items-center justify-end gap-3 border-t border-[#1f1f24] px-5 py-3 text-xs text-[#7c7d94]">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30">
                ← Previous
              </button>
              <span className="text-white">
                {page} / {data.pages}
              </span>
              <button type="button" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30">
                Next →
              </button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="px-5 py-10 text-center text-sm text-[#7c7d94]">
          {status === "active" ? "No candidates in process for this job yet." : `No ${status === "all" ? "" : status} candidates.`}
        </Card>
      )}
    </div>
  );
}
