"use client";

import { useCallback, useEffect, useState } from "react";
import { getOrgId, getToken } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Circle,
  Loader2,
  ClipboardList,
  RefreshCw,
  Bug,
  X,
  FileText,
  Plug,
} from "lucide-react";

interface SubTask {
  text: string;
  done: boolean;
}

interface TaskIssue {
  description: string;
  resolved: boolean;
}

interface ContextPage {
  context_name: string;
  context_id: string;
}

interface Task {
  id: string;
  agent_id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "completed" | "error" | "assigned";
  difficulty?: "low" | "medium" | "high";
  issues?: TaskIssue[];
  sub_tasks?: SubTask[];
  context_pages?: ContextPage[];
  integrations?: string[];
  created_at?: string;
}

function timeAgo(val?: string | number) {
  if (!val) return "";
  const ts = typeof val === "number" ? val : new Date(val).getTime();
  if (isNaN(ts)) return "";
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

const TASK_COLS = [
  { key: "open" as const, label: "Open", Icon: Circle, color: "text-amber-400", ring: "border-amber-500/20", bg: "bg-amber-500/5" },
  { key: "assigned" as const, label: "Assigned", Icon: Circle, color: "text-blue-300", ring: "border-blue-300/20", bg: "bg-blue-300/5" },
  { key: "in_progress" as const, label: "In Progress", Icon: Clock, color: "text-blue-400", ring: "border-blue-500/20", bg: "bg-blue-500/5" },
  { key: "completed" as const, label: "Completed", Icon: CheckCircle2, color: "text-emerald-400", ring: "border-emerald-500/20", bg: "bg-emerald-500/5" },
  { key: "error" as const, label: "Needs Human", Icon: AlertTriangle, color: "text-red-400", ring: "border-red-500/20", bg: "bg-red-500/5" },
];

const DIFFICULTY_STYLES: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-[#1a1a25] text-[#9fa0b8] border-[#2a2a35]",
};

function OpenClawTasksPageInternal() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgentId, setFilterAgentId] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const authHeaders = { Authorization: `Bearer ${getToken()}` };

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAgentId.trim()) params.set("agent_id", filterAgentId.trim());
      const orgId = getOrgId();
      if (orgId) params.set("org_id", orgId);
      
      const qs = params.toString();
      const res = await fetch(`/api/openclaw/tasks${qs ? `?${qs}` : ""}`, { headers: authHeaders });
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : data.tasks || []);
    } catch {
      toast.error("Failed to load AI tasks");
    } finally {
      setLoading(false);
    }
  }, [filterAgentId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const unresolvedCount = (task: Task) =>
    (task.issues ?? []).filter((i) => !i.resolved).length;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-10 w-10 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">AI Tasks</h2>
          <p className="text-xs text-[#9fa0b8]">Monitor tasks raised by your Ai Employees</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Input
            placeholder="Filter by agent ID…"
            value={filterAgentId}
            onChange={(e) => setFilterAgentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadTasks()}
            className="h-7 text-xs bg-[#15151b] border-[#2a2a35] text-white placeholder:text-[#9fa0b8] w-44"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={loadTasks}
            className="h-7 w-7 p-0 text-[#9fa0b8] hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : (
        <div className="flex gap-3 flex-1 overflow-x-auto min-h-0 pb-1">
          {TASK_COLS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            const { Icon } = col;
            return (
              <div key={col.key} className="flex flex-col min-w-[220px] flex-1 max-w-[300px]">
                {/* Column header */}
                <div className="flex items-center gap-1.5 mb-2 px-1 shrink-0">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${col.color}`} />
                  <span className="text-xs font-medium text-[#9fa0b8]">{col.label}</span>
                  <span className="ml-auto text-[10px] font-mono text-[#5a5a72] bg-[#1a1a25] border border-[#2a2a35] rounded px-1.5 py-0.5">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                  {colTasks.length === 0 ? (
                    <div className="text-[10px] text-[#5a5a72] text-center py-6 border border-dashed border-[#2a2a35] rounded-lg">
                      No tasks
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const unresolved = unresolvedCount(task);
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all group ${col.key === "error"
                            ? `${col.bg} ${col.ring} hover:border-red-500/40`
                            : col.key === "completed"
                              ? `${col.bg} ${col.ring} hover:border-emerald-500/40`
                              : col.key === "open"
                                ? `${col.bg} ${col.ring} hover:border-amber-500/40`
                                : "bg-[#0e0e12] border-[#2a2a35] hover:border-blue-500/30"
                            }`}
                        >
                          <p className="text-xs font-semibold text-white line-clamp-2 mb-2 group-hover:text-brand transition-colors">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            {task.difficulty && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${DIFFICULTY_STYLES[task.difficulty] ?? DIFFICULTY_STYLES.low}`}>
                                {task.difficulty}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-[#5a5a72] truncate max-w-[100px]">
                              {task.agent_id}
                            </span>
                            {task.created_at && (
                              <span className="text-[10px] text-[#5a5a72]">
                                · {timeAgo(task.created_at)}
                              </span>
                            )}
                            {unresolved > 0 && (
                              <Badge
                                variant="outline"
                                className="ml-auto text-[9px] h-4 px-1.5 text-amber-400 border-amber-400/30 gap-0.5"
                              >
                                <AlertCircle className="h-2.5 w-2.5" />
                                {unresolved}
                              </Badge>
                            )}
                          </div>
                          {(task.sub_tasks ?? []).length > 0 && (() => {
                            const subTasks = task.sub_tasks!;
                            const done = subTasks.filter((s) => s.done).length;
                            return (
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1 rounded-full bg-[#1a1a25] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-brand/60"
                                    style={{ width: `${(done / subTasks.length) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-[#5a5a72]">{done}/{subTasks.length}</span>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail panel */}
      {selectedTask && (() => {
        const col = TASK_COLS.find((c) => c.key === selectedTask.status) ?? TASK_COLS[0];
        const { Icon } = col;
        const subTasks = selectedTask.sub_tasks ?? [];
        const issues = selectedTask.issues ?? [];
        const contextPages = selectedTask.context_pages ?? [];
        const integrations = selectedTask.integrations ?? [];
        const doneCount = subTasks.filter((s) => s.done).length;
        return (
          <div className="fixed inset-0 z-[9999]">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedTask(null)}
            />
            {/* Panel */}
            <div className="absolute top-0 right-0 h-full w-full sm:max-w-md bg-[#0a0a0f] border-l border-[#2a2a35] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Header */}
              <div className="shrink-0 p-5 border-b border-[#2a2a35]">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${col.color}`} />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium ${col.color} border-current/40`}>
                      {col.label}
                    </span>
                    {selectedTask.difficulty && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${DIFFICULTY_STYLES[selectedTask.difficulty] ?? DIFFICULTY_STYLES.low}`}>
                        {selectedTask.difficulty}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-[#1a1a25] hover:bg-[#252530] transition-colors text-[#9fa0b8] hover:text-white border border-[#2a2a35]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-white leading-snug mb-2">
                  {selectedTask.title}
                </h3>
                <div className="flex items-center gap-2 text-[10px] text-[#5a5a72]">
                  <span className="font-mono truncate max-w-[160px]">{selectedTask.agent_id}</span>
                  {selectedTask.created_at && <><span>·</span><span>{timeAgo(selectedTask.created_at)}</span></>}
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                {/* Description */}
                {selectedTask.description && (
                  <div className="px-5 py-4 border-b border-[#1e1e28]">
                    <p className="text-xs text-[#9fa0b8] leading-relaxed">{selectedTask.description}</p>
                  </div>
                )}

                {/* Sub-tasks */}
                {subTasks.length > 0 && (
                  <div className="px-5 py-4 border-b border-[#1e1e28]">
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardList className="h-3.5 w-3.5 text-[#9fa0b8]" />
                      <span className="text-xs font-medium text-white">Sub-tasks</span>
                      <span className="text-[10px] text-[#5a5a72] ml-auto">{doneCount}/{subTasks.length}</span>
                    </div>
                    {subTasks.length > 1 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 h-1 rounded-full bg-[#1a1a25] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand/70 transition-all"
                            style={{ width: `${(doneCount / subTasks.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#5a5a72]">{Math.round((doneCount / subTasks.length) * 100)}%</span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {subTasks.map((st, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          {st.done
                            ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
                            : <Circle className="h-3.5 w-3.5 mt-0.5 text-[#3a3a4a] shrink-0" />}
                          <span className={`text-xs leading-relaxed ${st.done ? "text-[#4a4a60] line-through" : "text-[#c7c7da]"}`}>
                            {st.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Context Pages */}
                {contextPages.length > 0 && (
                  <div className="px-5 py-4 border-b border-[#1e1e28]">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-3.5 w-3.5 text-[#9fa0b8]" />
                      <span className="text-xs font-medium text-white">Context Used</span>
                      <span className="text-[10px] text-[#5a5a72] ml-auto">{contextPages.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {contextPages.map((p) => (
                        <span key={p.context_id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                          <FileText className="h-2.5 w-2.5" />
                          {p.context_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Integrations */}
                {integrations.length > 0 && (
                  <div className="px-5 py-4 border-b border-[#1e1e28]">
                    <div className="flex items-center gap-2 mb-3">
                      <Plug className="h-3.5 w-3.5 text-[#9fa0b8]" />
                      <span className="text-xs font-medium text-white">Integrations Used</span>
                      <span className="text-[10px] text-[#5a5a72] ml-auto">{integrations.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {integrations.map((integ, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium capitalize">
                          <Plug className="h-2.5 w-2.5" />
                          {integ}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issues */}
                {issues.length > 0 && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bug className="h-3.5 w-3.5 text-[#9fa0b8]" />
                      <span className="text-xs font-medium text-white">Issues</span>
                      <span className="text-[10px] text-[#5a5a72] ml-auto">
                        {issues.filter((i) => i.resolved).length}/{issues.length} resolved
                      </span>
                    </div>
                    <div className="space-y-2">
                      {issues.map((issue, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                            issue.resolved
                              ? "bg-emerald-500/5 border-emerald-500/15"
                              : "bg-amber-500/5 border-amber-500/20"
                          }`}
                        >
                          <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${issue.resolved ? "text-emerald-400" : "text-amber-400"}`} />
                          <p className={`text-xs leading-relaxed ${issue.resolved ? "text-[#4a4a60] line-through" : "text-[#c7c7da]"}`}>
                            {issue.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function OpenClawTasksPage() {
  return (
    <OpenClawTasksPageInternal />
  );
}
