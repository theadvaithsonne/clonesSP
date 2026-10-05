"use client";

import { useCallback, useEffect, useState } from "react";
import { getOrgId, getToken } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Activity,
  Calendar,
  Hash,
  AlertCircle,
  Loader2,
  Trash2,
  Bot,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PipelineTask {
  name: string;
  status: "success" | "error" | "pending" | "running";
  description?: string;
  error?: string;
  integrations?: string[];
  context_sources?: string[];
}

interface RunEntry {
  id?: string;
  status: string;
  started_at?: number;
  finished_at?: number;
  duration_ms?: number;
  tasks?: PipelineTask[];
  raw_summary?: string;
  summary?: string | null;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;
  error?: string;
  integrations?: string[];
  context_sources?: string[];
  global_integrations?: string[];
  global_context_sources?: string[];
  description?: string;
}

interface Job {
  job_id: string;
  name: string;
  agent_id: string;
  enabled: boolean;
  schedule_human?: string;
  payload_message: string;
  last_run_at?: string | number;
  next_run_at?: string | number;
  total_runs?: number;
  success_rate?: number;
  description?: string;
  last_run_status?: string;
  last_run_summary?: string;
  avg_duration_ms?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(val?: string | number | null) {
  if (!val) return "Never";
  const ts = typeof val === "number" ? val : new Date(val).getTime();
  if (isNaN(ts)) return "\u2014";
  const diff = Date.now() - ts;
  const mins = Math.floor(Math.abs(diff) / 60000);
  const prefix = diff < 0 ? "in " : "";
  const suffix = diff < 0 ? "" : " ago";
  if (mins < 1) return "just now";
  if (mins < 60) return `${prefix}${mins}m${suffix}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${prefix}${hrs}h${suffix}`;
  return `${prefix}${Math.floor(hrs / 24)}d${suffix}`;
}

function formatDate(val?: string | number | null) {
  if (!val) return "\u2014";
  const d = new Date(typeof val === "number" ? val : val);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Get tasks from a run - directly from run.tasks field, or parse from raw_summary as fallback */
function getRunTasks(run: RunEntry): PipelineTask[] | null {
  if (run.tasks && run.tasks.length > 0) return run.tasks;
  // Fallback: try to parse from raw_summary
  const raw = run.raw_summary;
  if (!raw) return null;
  const fenced = raw.match(/```pipeline_result\s*\n?([\s\S]*?)```/);
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      if (parsed?.tasks?.length) return parsed.tasks;
    } catch { /* skip */ }
  }
  return null;
}

/** Get human-readable summary text from a run */
function getRunSummary(run: RunEntry): string {
  // Prefer the pre-extracted summary field
  if (run.summary) return run.summary;
  // Fallback: strip pipeline_result blocks from raw_summary
  if (!run.raw_summary) return "";
  return run.raw_summary
    .replace(/```pipeline_result[\s\S]*?```/g, "")
    .replace(/```[a-z]*\n/g, "")
    .replace(/```/g, "")
    .trim();
}

/** Derive effective status label + color from run + pipeline data */
function getEffectiveStatus(run: RunEntry): { label: string; color: string; bg: string } {
  const tasks = getRunTasks(run);
  const hasErrors = tasks?.some((t) => t.status === "error");
  const allSuccess = tasks?.every((t) => t.status === "success");

  if (run.status === "error" || run.error) {
    return { label: "FAILED", color: "text-red-400", bg: "bg-red-500/5 border-red-500/20" };
  }
  if (run.status === "partial" || (hasErrors && !allSuccess)) {
    return { label: "PARTIAL", color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/20" };
  }
  if (run.status === "success" || run.status === "ok" || allSuccess) {
    return { label: "SUCCESS", color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/20" };
  }
  return { label: run.status?.toUpperCase() || "UNKNOWN", color: "text-[#9fa0b8]", bg: "bg-[#0e0e12] border-[#2a2a35]" };
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

function OpenClawJobsPageInternal() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<{
    job?: Job;
    runs: RunEntry[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${getToken()}` };

  const orgId = getOrgId();

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/openclaw/jobs", window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      const res = await fetch(url.toString(), { headers: authHeaders });
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load AI jobs");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const url = new URL("/api/openclaw/agent", window.location.origin);
    if (orgId) url.searchParams.set("org_id", orgId);

    fetch(url.toString(), { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => {
        const agents: { agent_id: string; name: string }[] = d.agents || [];
        const map: Record<string, string> = {};
        agents.forEach((a) => { map[a.agent_id] = a.name; });
        setAgentMap(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedJob) {
      setJobDetail(null);
      return;
    }
    const load = async () => {
      setLoadingDetail(true);
      try {
        const url = new URL(`/api/openclaw/jobs/${selectedJob.job_id}/detail`, window.location.origin);
        if (orgId) url.searchParams.set("org_id", orgId);
        const res = await fetch(url.toString(), { headers: authHeaders });
        const data = await res.json();
        const runs: RunEntry[] = Array.isArray(data.runs)
          ? data.runs
          : Array.isArray(data)
            ? data
            : [];
        const jobFromDetail: Job | undefined = data.job;
        setJobDetail({ job: jobFromDetail, runs });
        if (jobFromDetail) {
          setSelectedJob((prev) =>
            prev ? { ...prev, ...jobFromDetail } : prev
          );
        }
      } catch {
        toast.error("Failed to load job history");
      } finally {
        setLoadingDetail(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob?.job_id]);

  useEffect(() => {
    setExpandedRunId(null);
  }, [selectedJob?.job_id]);

  const handleTrigger = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    try {
      const url = new URL(`/api/openclaw/jobs/${jobId}/trigger`, window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      await fetch(url.toString(), {
        method: "POST",
        headers: authHeaders,
      });
      toast.success("Job triggered successfully");
      loadJobs();
    } catch {
      toast.error("Failed to trigger job");
    }
  };

  const handleToggle = async (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    try {
      const url = new URL(`/api/openclaw/jobs/${job.job_id}`, window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      await fetch(url.toString(), {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !job.enabled }),
      });
      toast.success(job.enabled ? "Job paused" : "Job enabled");
      setJobs((prev) =>
        prev.map((j) =>
          j.job_id === job.job_id ? { ...j, enabled: !j.enabled } : j
        )
      );
      if (selectedJob?.job_id === job.job_id) {
        setSelectedJob((prev) =>
          prev ? { ...prev, enabled: !prev.enabled } : prev
        );
      }
    } catch {
      toast.error("Failed to update job status");
    }
  };

  const handleDelete = async (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return;
    try {
      const url = new URL(`/api/openclaw/jobs/${job.job_id}`, window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      await fetch(url.toString(), {
        method: "DELETE",
        headers: authHeaders,
      });
      toast.success("Job deleted");
      setJobs((prev) => prev.filter((j) => j.job_id !== job.job_id));
      if (selectedJob?.job_id === job.job_id) setSelectedJob(null);
    } catch {
      toast.error("Failed to delete job");
    }
  };

  const detailRuns = jobDetail?.runs ?? [];

  /* ---- Job List View ---- */
  if (!selectedJob) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center">
              <Activity className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Jobs</h2>
              <p className="text-xs text-[#9fa0b8]">
                Recurring scheduled tasks for your Ai Employees
              </p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : jobs.length === 0 ? (
          /* Empty State */
          <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0e0e12] p-8 text-center space-y-2">
            <Calendar className="h-10 w-10 text-[#9fa0b8] mx-auto" />
            <p className="text-sm text-[#9fa0b8]">No recurring jobs yet.</p>
            <p className="text-xs text-[#5a5a72]">
              Jobs are created when you use the Marketplace to schedule tasks for
              an Ai Employee.
            </p>
          </div>
        ) : (
          /* Job List */
          <div className="space-y-3">
            {jobs.map((job) => (
              <button
                key={job.job_id}
                onClick={() => setSelectedJob(job)}
                className="w-full text-left rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4 hover:border-brand/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Bot className="h-3.5 w-3.5 text-[#9fa0b8] shrink-0" />
                      <h3 className="text-sm font-medium text-white truncate group-hover:text-brand transition-colors">
                        {job.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          job.enabled
                            ? "text-emerald-400 border-emerald-400/30"
                            : "text-[#9fa0b8] border-[#2a2a35]"
                        }`}
                      >
                        {job.enabled ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-[#9fa0b8] line-clamp-1 mb-2">
                      {job.description || job.payload_message}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] text-[#5a5a72]">
                      <span className="flex items-center gap-1 text-[#9fa0b8]">
                        <Bot className="h-3 w-3 text-brand/60" />
                        {agentMap[job.agent_id] || job.agent_id}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {job.schedule_human || "Scheduled"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {job.total_runs || 0} runs
                      </span>
                      {job.success_rate !== undefined &&
                        job.success_rate !== null && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            {Math.round(job.success_rate * 100)}%
                          </span>
                        )}
                      {job.last_run_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(job.last_run_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5a5a72] group-hover:text-brand transition-colors shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ---- Job Detail View ---- */
  // Find the latest run that has pipeline tasks
  const latestRunWithTasks = (() => {
    for (let i = 0; i < detailRuns.length; i++) {
      const tasks = getRunTasks(detailRuns[i]);
      if (tasks && tasks.length > 0) return { run: detailRuns[i], tasks };
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-[#9fa0b8] hover:text-white -ml-2"
          onClick={() => setSelectedJob(null)}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
        </Button>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className="h-7 px-3 text-[10px] bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30"
            onClick={(e) => handleTrigger(e, selectedJob.job_id)}
          >
            <Play className="h-3 w-3 mr-1" /> Trigger
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 text-[10px] bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30"
            onClick={(e) => handleToggle(e, selectedJob)}
          >
            {selectedJob.enabled ? (
              <Pause className="h-3 w-3 mr-1" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            {selectedJob.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            size="sm"
            className="h-7 w-7 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
            onClick={(e) => handleDelete(e, selectedJob)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Job Info */}
      <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-white">{selectedJob.name}</h3>
          <Badge
            variant="outline"
            className="text-[10px] text-[#9fa0b8] border-[#2a2a35] flex items-center gap-1"
          >
            <Bot className="h-2.5 w-2.5" />
            {agentMap[selectedJob.agent_id] || selectedJob.agent_id}
          </Badge>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              selectedJob.enabled
                ? "text-emerald-400 border-emerald-400/30"
                : "text-[#9fa0b8] border-[#2a2a35]"
            }`}
          >
            {selectedJob.enabled ? "Active" : "Paused"}
          </Badge>
        </div>
        <p
          className="text-xs text-[#9fa0b8] line-clamp-3"
          title={selectedJob.payload_message}
        >
          {selectedJob.description || selectedJob.payload_message}
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#2a2a35]">
          {[
            {
              label: "TOTAL RUNS",
              value: selectedJob.total_runs || detailRuns.length || 0,
              icon: Hash,
            },
            {
              label: "SUCCESS RATE",
              value: (() => {
                if (selectedJob.success_rate !== undefined && selectedJob.success_rate !== null) {
                  return `${Math.round(selectedJob.success_rate * 100)}%`;
                }
                if (detailRuns.length > 0) {
                  const okCount = detailRuns.filter(
                    (r) => r.status === "ok" || r.status === "success"
                  ).length;
                  return `${Math.round((okCount / detailRuns.length) * 100)}%`;
                }
                return "\u2014";
              })(),
              icon: CheckCircle2,
            },
            {
              label: "LAST RUN",
              value: timeAgo(selectedJob.last_run_at),
              icon: Clock,
            },
            {
              label: "NEXT RUN",
              value: timeAgo(selectedJob.next_run_at),
              icon: Calendar,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-[#2a2a35] bg-[#15151b] p-3"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className="h-3 w-3 text-[#5a5a72]" />
                <span className="text-[10px] text-[#5a5a72] uppercase tracking-wider font-medium">
                  {stat.label}
                </span>
              </div>
              <span className="text-sm font-semibold text-white block">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Pipeline */}
      {latestRunWithTasks && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Activity className="h-3.5 w-3.5 text-brand" />
            <h4 className="text-xs font-semibold text-white">Latest Pipeline</h4>
            <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1.5 text-[#9fa0b8] border-[#2a2a35]">
              {latestRunWithTasks.tasks.filter((t) => t.status === "success").length}/{latestRunWithTasks.tasks.length} passed
            </Badge>
          </div>
          <div className="space-y-2">
            {latestRunWithTasks.tasks.map((task, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${
                  task.status === "success"
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : task.status === "error"
                      ? "bg-red-500/5 border-red-500/20"
                      : task.status === "running"
                        ? "bg-blue-500/5 border-blue-500/20"
                        : "bg-[#0e0e12] border-[#2a2a35]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      task.status === "success"
                        ? "bg-emerald-400"
                        : task.status === "error"
                          ? "bg-red-400"
                          : task.status === "running"
                            ? "bg-blue-400 animate-pulse"
                            : "bg-[#5a5a72]"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {task.name}
                    </p>
                    {task.integrations && task.integrations.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {task.integrations.map((int) => (
                          <Badge
                            key={int}
                            variant="outline"
                            className="text-[8px] py-0 h-3.5 text-[#5a5a72] border-[#2a2a35]"
                          >
                            {int}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[9px] uppercase font-semibold tracking-wider ${
                      task.status === "success"
                        ? "text-emerald-400"
                        : task.status === "error"
                          ? "text-red-400"
                          : task.status === "running"
                            ? "text-blue-400"
                            : "text-[#5a5a72]"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
                {task.status === "error" && task.error && (
                  <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded p-2">
                    <p className="text-[10px] text-red-400 font-semibold mb-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Error
                    </p>
                    <pre className="text-[9px] text-red-400/80 font-mono whitespace-pre-wrap break-all leading-relaxed">
                      {task.error}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution History */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <RotateCcw className="h-3.5 w-3.5 text-brand" />
          <h4 className="text-xs font-semibold text-white">Execution History</h4>
        </div>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : detailRuns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0e0e12] p-6 text-center">
            <p className="text-xs text-[#9fa0b8]">No run history found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {detailRuns.map((run, i) => {
              const runKey = run.id || String(i);
              const isExpanded = expandedRunId === runKey;
              const tasks = getRunTasks(run);
              const summaryText = getRunSummary(run);
              const effectiveStatus = getEffectiveStatus(run);

              return (
                <div
                  key={runKey}
                  className={`rounded-lg border overflow-hidden transition-colors ${
                    effectiveStatus.bg
                  } ${!isExpanded ? "cursor-pointer hover:border-brand/20" : ""}`}
                  onClick={() => !isExpanded && setExpandedRunId(runKey)}
                >
                  {/* Run Header */}
                  <div className="p-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold uppercase tracking-wider ${effectiveStatus.color}`}>
                          {effectiveStatus.label}
                        </span>
                        {tasks && tasks.length > 0 && (
                          <span className="text-[10px] text-[#5a5a72]">
                            {tasks.filter((t) => t.status === "success").length}/{tasks.length} tasks
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[#5a5a72]">
                        <span className="text-[10px]">{formatDate(run.started_at)}</span>
                        {isExpanded ? (
                          <ChevronDown
                            className="h-3 w-3 cursor-pointer hover:text-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRunId(null);
                            }}
                          />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </div>
                    </div>

                    {/* Collapsed preview */}
                    {!isExpanded && summaryText && (
                      <p className="text-[10px] text-[#c7c7da] line-clamp-1 font-mono bg-[#15151b] border border-[#2a2a35] p-1.5 rounded mt-1">
                        {summaryText}
                      </p>
                    )}
                    {!isExpanded && !summaryText && run.error && (
                      <p className="text-[10px] text-red-400/80 line-clamp-1 font-mono bg-[#15151b] border border-[#2a2a35] p-1.5 rounded mt-1">
                        {run.error}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-[10px] text-[#5a5a72] mt-1.5">
                      {run.duration_ms != null && (
                        <span>{(run.duration_ms / 1000).toFixed(1)}s</span>
                      )}
                      {run.model && <span>{run.model}</span>}
                      {(run.input_tokens || run.output_tokens) && (
                        <span>
                          {((run.input_tokens || 0) + (run.output_tokens || 0)).toLocaleString()} tokens
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded View */}
                  {isExpanded && (
                    <div className="border-t border-[#2a2a35] bg-[#0e0e12] p-3 space-y-3">
                      {/* Run error */}
                      {run.error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                          <p className="text-[10px] text-red-400 font-semibold mb-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Run Error
                          </p>
                          <pre className="text-[9px] text-red-400/80 font-mono whitespace-pre-wrap break-all leading-relaxed">
                            {run.error}
                          </pre>
                        </div>
                      )}

                      {/* Pipeline tasks */}
                      {tasks && tasks.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-bold text-[#5a5a72] tracking-widest">
                              Pipeline Tasks
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-[9px] px-2 text-[#9fa0b8] hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRunId(null);
                              }}
                            >
                              Close
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            {tasks.map((task, ti) => (
                              <div
                                key={ti}
                                className={`rounded border p-2 ${
                                  task.status === "success"
                                    ? "bg-emerald-500/5 border-emerald-500/20"
                                    : task.status === "error"
                                      ? "bg-red-500/5 border-red-500/20"
                                      : "bg-[#15151b] border-[#2a2a35]"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                      task.status === "success"
                                        ? "bg-emerald-400"
                                        : task.status === "error"
                                          ? "bg-red-400"
                                          : task.status === "running"
                                            ? "bg-blue-400 animate-pulse"
                                            : "bg-[#5a5a72]"
                                    }`}
                                  />
                                  <span className="text-[11px] font-medium text-white flex-1 truncate">
                                    {task.name}
                                  </span>
                                  {task.integrations && task.integrations.length > 0 && (
                                    <div className="flex gap-1">
                                      {task.integrations.map((int) => (
                                        <Badge
                                          key={int}
                                          variant="outline"
                                          className="text-[7px] py-0 h-3 text-[#5a5a72] border-[#2a2a35]"
                                        >
                                          {int}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  <span
                                    className={`text-[8px] uppercase font-semibold ${
                                      task.status === "success"
                                        ? "text-emerald-400"
                                        : task.status === "error"
                                          ? "text-red-400"
                                          : "text-[#5a5a72]"
                                    }`}
                                  >
                                    {task.status}
                                  </span>
                                </div>
                                {task.status === "error" && task.error && (
                                  <div className="mt-1.5 bg-red-500/10 border border-red-500/20 rounded p-1.5">
                                    <pre className="text-[9px] text-red-400/80 font-mono whitespace-pre-wrap break-all leading-relaxed">
                                      {task.error}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Summary */}
                      {summaryText && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#5a5a72] tracking-widest mb-1 block">
                            Summary
                          </span>
                          <pre className="text-[10px] text-[#c7c7da] font-mono bg-[#15151b] border border-[#2a2a35] rounded-md p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {summaryText}
                          </pre>
                        </div>
                      )}

                      {/* Close button if no tasks header shown */}
                      {(!tasks || tasks.length === 0) && (
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[9px] px-2 text-[#9fa0b8] hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRunId(null);
                            }}
                          >
                            Close
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpenClawJobsPage() {
  return (
    <OpenClawJobsPageInternal />
  );
}
