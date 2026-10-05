"use client";

/**
 * Shared agent controller tab components.
 * Used by OpenClawChatPage (Management tab) and DMPage (agent DM view).
 */

import { useEffect, useState, useCallback, useRef, type ComponentType, type ReactNode } from "react";
import Script from "next/script";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, ChevronRight, ChevronDown,
  FileText, Plug, Bug, Bell, Zap, TrendingUp, TrendingDown,
  Plus, X, Play, Pause, RefreshCw, Loader2, Check, Unplug,
  ArrowLeft, BarChart3, DollarSign, Monitor, AlertCircle, Bot,
  Briefcase, Timer, ArrowUpCircle, ArrowDownCircle, Coins, HardDrive, Cpu, Users, Calculator,
} from "lucide-react";
import { getOrgId, getToken, getUserIdFromToken } from "@/lib/auth";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import cronstrue from "cronstrue";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentData {
  agent_id: string;
  name: string;
  role?: string;
  emoji?: string;
  status?: string;
  llm_model?: string | null;
}

export interface SubTask { text: string; done: boolean; }
export interface TaskIssue { description: string; resolved: boolean; }

export interface Task {
  id: string;
  agent_id: string;
  title: string;
  description?: string;
  status: "assigned" | "in_progress" | "completed" | "error";
  difficulty: "low" | "medium" | "high";
  sub_tasks: SubTask[];
  context_pages: { context_name: string; context_id: string }[];
  integrations: string[];
  issues: TaskIssue[];
  created_at: string;
}

export interface Job {
  job_id: string;
  agent_id?: string;
  name: string;
  last_run_status?: string;
  schedule?: any;
  last_run_at?: number | string;
  enabled?: boolean;
}

export interface ContextItem {
  id: string;
  name: string;
  description?: string;
  page_count?: number;
}

interface ThirdPartyContextItem {
  id: string;
  integration_name?: string;
  integration_display_name?: string;
  integration_metadata?: any;
}

interface DisplayContextItem extends ContextItem {
  source: "manual" | "third_party";
  picture?: string;
}

export interface AuthFieldSchema {
  name: string;
  label: string;
  required: boolean;
}

export interface EndpointSchema {
  method: string;
  path: string;
  description: string;
}

export interface DisplayMetadataItem {
  key: string;
  value: string;
  type: "string" | "image_url";
}

export interface ConnectedAgent {
  agent_id: string;
  name: string;
  display_metadata?: DisplayMetadataItem[] | null;
}

export interface Integration {
  name: string;           // slug identifier e.g. "notion"
  display_name: string;   // human-readable e.g. "Notion"
  api_type: string;       // e.g. "rest", "oauth2_google"
  base_url: string;
  auth_fields: AuthFieldSchema[];
  endpoints?: EndpointSchema[];
  usage_instructions?: string;
  auth_scheme?: { type: string };
}

export interface ConnectedIntegration extends Integration {
  id: string;
  integration_name: string;
  display_metadata?: DisplayMetadataItem[] | null;
}

// ── Tab config ────────────────────────────────────────────────────────────────

export const AGENT_TABS = [
  { id: "controller", label: "Controller", icon: Monitor },
  { id: "tasks", label: "Tasks", icon: CheckCircle2 },
  { id: "jobs", label: "Jobs", icon: Zap },
  { id: "contexts", label: "Contexts", icon: FileText },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "savings", label: "Savings", icon: DollarSign },
] as const;

export type AgentTabId = (typeof AGENT_TABS)[number]["id"];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function timeAgo(val?: string | number) {
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

function formatSchedule(schedule?: any): string {
  if (!schedule) return "Manual";
  if (typeof schedule === "string") return schedule;
  if (schedule.kind === "cron") {
    if (!schedule.expr) return "cron";
    try {
      return cronstrue.toString(schedule.expr);
    } catch {
      return schedule.expr;
    }
  }
  if (schedule.kind === "at") {
    return schedule.at ? new Date(schedule.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "once";
  }
  if (schedule.kind === "every") {
    const ms = schedule.everyMs || 0;
    const mins = Math.round(ms / 60000);
    return mins < 60 ? `every ${mins}m` : `every ${Math.round(mins / 60)}h`;
  }
  return "Scheduled";
}

// ── WebSocket Hook ────────────────────────────────────────────────────────────

// Realtime for tasks / crons / activity. Connects to roam-backend's
// /openclaw-ws/:channel proxy with the user's JWT in the query string —
// the proxy verifies the token, resolves accessible agent_ids, and
// only forwards events for agents the current user can see (founders =
// whole org, employees = their assigned agents).
//
// `path` is the legacy OpenClawApi WS path (e.g. "/api/tasks/ws"). We
// translate it to the new channel name for backward-compat with existing
// call sites.
export function useOpenClawWs(path: string, onMessage: (event: string, data: any) => void) {
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;

    // "/api/tasks/ws" → "tasks"
    const channelMatch = path.match(/\/api\/(tasks|crons|activity)\/ws/);
    if (!channelMatch) {
      console.warn("[useOpenClawWs] unknown path", path);
      return;
    }
    const channel = channelMatch[1];

    const protocol = apiUrl.startsWith("https") ? "wss" : "ws";
    const host = apiUrl.replace(/^https?:\/\//, "");
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const connect = () => {
      if (!alive) return;
      // Grab a fresh token each attempt so a rotation recovers without
      // a manual reload.
      const token = getToken() || "";
      if (!token) return; // Not logged in yet — try again on next tick.

      const url = `${protocol}://${host}/openclaw-ws/${channel}?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(url);

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event && msg.data) {
            callbackRef.current(msg.event, msg.data);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (alive) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => { ws?.close(); };
    };

    connect();

    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [path]);
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

const TASK_COLS = [
  { key: "assigned" as const, label: "Assigned", icon: Circle, color: "text-blue-400" },
  { key: "in_progress" as const, label: "In Progress", icon: Clock, color: "text-amber-400" },
  { key: "completed" as const, label: "Completed", icon: CheckCircle2, color: "text-emerald-400" },
  { key: "error" as const, label: "Needs Human", icon: AlertTriangle, color: "text-red-400" },
];

const TASK_DIFFICULTY_STYLES: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-[#1a1a25] text-[#9fa0b8] border-[#2a2a35]",
};

export function TasksTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Record<string, string> }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orgId = getOrgId();
      const qs = `?agent_id=${agent.agent_id}${orgId ? `&org_id=${orgId}` : ""}`;
      const res = await fetch(`/api/openclaw/tasks${qs}`, { headers: authHeaders });
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : data.tasks || []);
    } catch { toast.error("Failed to load tasks"); }
    finally { setLoading(false); }
  }, [agent.agent_id]);

  useEffect(() => { load(); }, [load]);

  // Real-time task updates via WebSocket
  useOpenClawWs("/api/tasks/ws", (event, data) => {
    if (data.agent_id && data.agent_id !== agent.agent_id) return;

    if (event === "task_created") {
      setTasks((prev) => {
        if (prev.some((t) => t.id === data.id)) return prev;
        return [...prev, data];
      });
    } else if (event === "task_updated" || event === "issue_resolved") {
      setTasks((prev) => prev.map((t) => t.id === (data.id || data.task_id) ? { ...t, ...data } : t));
      setSelectedTask((prev) => prev && prev.id === (data.id || data.task_id) ? { ...prev, ...data } : prev);
    } else if (event === "task_deleted") {
      setTasks((prev) => prev.filter((t) => t.id !== data.id));
      setSelectedTask((prev) => prev && prev.id === data.id ? null : prev);
    }
  });

  const resolveIssue = async (taskId: string, issueIndex: number) => {
    setResolving(`${taskId}-${issueIndex}`);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      await fetch(`/api/openclaw/tasks/${taskId}/issues/${issueIndex}/resolve${qs}`, {
        method: "PATCH", headers: authHeaders,
      });
      const patch = (t: Task) =>
        t.id === taskId
          ? { ...t, issues: t.issues.map((iss, i) => i === issueIndex ? { ...iss, resolved: true } : iss) }
          : t;
      setTasks((prev) => prev.map(patch));
      if (selectedTask?.id === taskId) setSelectedTask((prev) => prev ? patch(prev) : null);
      toast.success("Issue resolved");
    } catch { toast.error("Failed to resolve issue"); }
    finally { setResolving(null); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-white">Tasks</h3>
        <button onClick={load} className="text-[#9fa0b8] hover:text-white transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-3 flex-1 overflow-x-auto min-h-0">
        {TASK_COLS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          const Icon = col.icon;
          return (
            <div key={col.key} className="flex flex-col min-w-40 flex-1">
              <div className="flex items-center gap-1.5 mb-2 shrink-0">
                <Icon className={`h-3.5 w-3.5 ${col.color}`} />
                <span className="text-xs text-[#9fa0b8]">{col.label}</span>
                <span className="text-[10px] text-[#5a5a72] ml-auto">{colTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {colTasks.length === 0 ? (
                  <div className="text-[10px] text-[#5a5a72] text-center py-4 border border-dashed border-[#2a2a35] rounded-lg">
                    Empty
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all group ${col.key === "error"
                          ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
                          : col.key === "completed"
                            ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                            : "bg-[#0e0e12] border-[#2a2a35] hover:border-brand/30"
                        }`}
                    >
                      <p className="text-xs font-medium text-white line-clamp-2 mb-2 group-hover:text-brand transition-colors">{task.title}</p>
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TASK_DIFFICULTY_STYLES[task.difficulty] ?? TASK_DIFFICULTY_STYLES.low}`}>
                          {task.difficulty}
                        </span>
                        <span className="text-[10px] text-[#5a5a72]">{timeAgo(task.created_at)}</span>
                        {task.issues.filter((i) => !i.resolved).length > 0 && (
                          <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] text-amber-400 border border-amber-400/30 rounded px-1.5 py-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {task.issues.filter((i) => !i.resolved).length}
                          </span>
                        )}
                      </div>
                      {task.sub_tasks.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 rounded-full bg-[#1a1a25] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand/60"
                              style={{ width: `${(task.sub_tasks.filter((s) => s.done).length / task.sub_tasks.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#5a5a72]">
                            {task.sub_tasks.filter((s) => s.done).length}/{task.sub_tasks.length}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail panel */}
      {selectedTask && (() => {
        const col = TASK_COLS.find((c) => c.key === selectedTask.status) ?? TASK_COLS[0];
        const Icon = col.icon;
        const doneCount = selectedTask.sub_tasks.filter((s) => s.done).length;
        const totalCount = selectedTask.sub_tasks.length;
        return (
          <div className="fixed inset-0 z-[9999]">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
            <div className="absolute top-0 right-0 h-full w-full sm:max-w-md bg-[#0a0a0f] border-l border-[#2a2a35] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Header */}
              <div className="shrink-0 p-5 border-b border-[#2a2a35]">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${col.color}`} />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium ${col.color} border-current/40`}>
                      {col.label}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${TASK_DIFFICULTY_STYLES[selectedTask.difficulty] ?? TASK_DIFFICULTY_STYLES.low}`}>
                      {selectedTask.difficulty}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-[#1a1a25] hover:bg-[#252530] transition-colors text-[#9fa0b8] hover:text-white border border-[#2a2a35]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-white leading-snug mb-2">{selectedTask.title}</h3>
                <div className="flex items-center gap-2 text-[10px] text-[#5a5a72]">
                  <span className="font-mono truncate max-w-[160px]">{selectedTask.agent_id}</span>
                  <span>·</span>
                  <span>{timeAgo(selectedTask.created_at)}</span>
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
                {totalCount > 0 && (
                  <div className="px-5 py-4 border-b border-[#1e1e28]">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#9fa0b8]" />
                      <span className="text-xs font-medium text-white">Sub-tasks</span>
                      <span className="text-[10px] text-[#5a5a72] ml-auto">{doneCount}/{totalCount}</span>
                    </div>
                    {totalCount > 1 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 h-1 rounded-full bg-[#1a1a25] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand/70 transition-all"
                            style={{ width: `${(doneCount / totalCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#5a5a72]">{Math.round((doneCount / totalCount) * 100)}%</span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {selectedTask.sub_tasks.map((st, i) => (
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
                {selectedTask.context_pages.length > 0 && (
                  <div className="px-5 py-4 border-b border-[#1e1e28]">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-3.5 w-3.5 text-[#9fa0b8]" />
                      <span className="text-xs font-medium text-white">Context Used</span>
                      <span className="text-[10px] text-[#5a5a72] ml-auto">{selectedTask.context_pages.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTask.context_pages.map((p) => (
                        <span key={p.context_id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                          <FileText className="h-2.5 w-2.5" />
                          {p.context_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Integrations */}
                {selectedTask.integrations.length > 0 && (
                  <div className="px-5 py-4 border-b border-[#1e1e28]">
                    <div className="flex items-center gap-2 mb-3">
                      <Plug className="h-3.5 w-3.5 text-[#9fa0b8]" />
                      <span className="text-xs font-medium text-white">Integrations Used</span>
                      <span className="text-[10px] text-[#5a5a72] ml-auto">{selectedTask.integrations.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTask.integrations.map((integ, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium capitalize">
                          <Plug className="h-2.5 w-2.5" />
                          {integ}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issues */}
                {selectedTask.issues.length > 0 && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bug className="h-3.5 w-3.5 text-[#9fa0b8]" />
                      <span className="text-xs font-medium text-white">Issues</span>
                      <span className="text-[10px] text-[#5a5a72] ml-auto">
                        {selectedTask.issues.filter((i) => i.resolved).length}/{selectedTask.issues.length} resolved
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selectedTask.issues.map((issue, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-2.5 p-3 rounded-lg border ${issue.resolved
                            ? "bg-emerald-500/5 border-emerald-500/15"
                            : "bg-amber-500/5 border-amber-500/20"
                          }`}
                        >
                          <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${issue.resolved ? "text-emerald-400" : "text-amber-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-relaxed ${issue.resolved ? "text-[#4a4a60] line-through" : "text-[#c7c7da]"}`}>
                              {issue.description}
                            </p>
                            {!issue.resolved && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 h-6 text-[10px] px-2.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/50"
                                disabled={resolving === `${selectedTask.id}-${i}`}
                                onClick={() => resolveIssue(selectedTask.id, i)}
                              >
                                {resolving === `${selectedTask.id}-${i}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Resolved"}
                              </Button>
                            )}
                          </div>
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

// ── Jobs Tab helpers ─────────────────────────────────────────────────────────

interface PipelineTask {
  name: string;
  status: "success" | "error" | "pending" | "running";
  error?: string;
  integrations?: string[];
}

interface RunDetail {
  id?: string;
  status: string;
  started_at?: number;
  duration_ms?: number;
  tasks?: PipelineTask[];
  raw_summary?: string;
  summary?: string | null;
  error?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
}

function runGetTasks(run: RunDetail): PipelineTask[] | null {
  if (run.tasks && run.tasks.length > 0) return run.tasks;
  const raw = run.raw_summary;
  if (!raw) return null;
  const fenced = raw.match(/```pipeline_result\s*\n?([\s\S]*?)```/);
  if (fenced) {
    try {
      const p = JSON.parse(fenced[1].trim());
      if (p?.tasks?.length) return p.tasks;
    } catch { /* skip */ }
  }
  return null;
}

function runGetSummary(run: RunDetail): string {
  if (run.summary) return run.summary;
  if (!run.raw_summary) return "";
  return run.raw_summary
    .replace(/```pipeline_result[\s\S]*?```/g, "")
    .replace(/```[a-z]*\n/g, "")
    .replace(/```/g, "")
    .trim();
}

function runEffectiveStatus(run: RunDetail): { label: string; color: string; bg: string } {
  const tasks = runGetTasks(run);
  const hasErrors = tasks?.some((t) => t.status === "error");
  const allSuccess = tasks?.every((t) => t.status === "success");
  if (run.status === "error" || run.error) return { label: "FAILED", color: "text-red-400", bg: "bg-red-500/5 border-red-500/20" };
  if (run.status === "partial" || (hasErrors && !allSuccess)) return { label: "PARTIAL", color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/20" };
  if (run.status === "success" || run.status === "ok" || allSuccess) return { label: "SUCCESS", color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/20" };
  return { label: (run.status || "unknown").toUpperCase(), color: "text-[#9fa0b8]", bg: "bg-[#0e0e12] border-[#2a2a35]" };
}

// ── Jobs Tab ──────────────────────────────────────────────────────────────────

export function JobsTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Record<string, string> }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detail, setDetail] = useState<{ job?: Job; runs: RunDetail[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const res = await fetch(`/api/openclaw/jobs${qs}`, { headers: authHeaders });
      const data = await res.json();
      const all: Job[] = Array.isArray(data) ? data : data.jobs || [];
      setJobs(all.filter((j) => !j.agent_id || j.agent_id === agent.agent_id));
    } catch { toast.error("Failed to load jobs"); }
    finally { setLoading(false); }
  }, [agent.agent_id]);

  useEffect(() => { load(); }, [load]);

  // Real-time job updates via WebSocket
  useOpenClawWs("/api/crons/ws", (event, data) => {
    if (data.agent_id && data.agent_id !== agent.agent_id) return;

    if (event === "cron_created") {
      setJobs((prev) => {
        if (prev.some((j) => j.job_id === data.job_id)) return prev;
        return [...prev, data];
      });
    } else if (event === "cron_updated") {
      setJobs((prev) => prev.map((j) => j.job_id === data.job_id ? { ...j, ...data } : j));
    } else if (event === "cron_deleted") {
      setJobs((prev) => prev.filter((j) => j.job_id !== data.job_id));
      if (selectedJob?.job_id === data.job_id) setSelectedJob(null);
    } else if (event === "cron_triggered") {
      // Refresh detail if viewing the triggered job
      if (detail?.job?.job_id === data.job_id || selectedJob?.job_id === data.job_id) {
        loadDetail(data.job_id);
      }
      load(); // Refresh list to update last_run_at
    }
  });

  const loadDetail = async (jobId: string) => {
    setLoadingDetail(true);
    setExpandedRunId(null);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const res = await fetch(`/api/openclaw/jobs/${jobId}/detail${qs}`, { headers: authHeaders });
      const data = await res.json();
      const runs: RunDetail[] = Array.isArray(data.runs) ? data.runs : Array.isArray(data) ? data : [];
      setDetail({ job: data.job, runs });
    } catch { setDetail(null); }
    finally { setLoadingDetail(false); }
  };

  const trigger = async (jobId: string) => {
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      await fetch(`/api/openclaw/jobs/${jobId}/trigger${qs}`, { method: "POST", headers: authHeaders });
      toast.success("Job triggered");
      load();
    } catch { toast.error("Failed to trigger job"); }
  };

  const toggleJob = async (job: Job) => {
    setToggling(job.job_id);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      await fetch(`/api/openclaw/jobs/${job.job_id}${qs}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ enabled: !job.enabled }),
      });
      setJobs((prev) => prev.map((j) => j.job_id === job.job_id ? { ...j, enabled: !j.enabled } : j));
    } catch { toast.error("Failed to update job"); }
    finally { setToggling(null); }
  };

  const statusColor = (s: string) =>
    s === "active" || s === "success" || s === "ok" ? "text-emerald-400"
      : s === "running" ? "text-blue-400"
        : s === "failed" || s === "error" ? "text-red-400"
          : "text-[#9fa0b8]";

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>;

  if (selectedJob) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedJob(null); setDetail(null); }}
          className="flex items-center gap-1.5 text-xs text-[#9fa0b8] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Jobs
        </button>
        <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">{selectedJob.name}</h3>
              <p className="text-[10px] text-[#9fa0b8] font-mono">{selectedJob.job_id}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] px-2 border-[#2a2a35] text-[#9fa0b8] hover:text-white"
                onClick={() => toggleJob(selectedJob)}
                disabled={toggling === selectedJob.job_id}
              >
                {selectedJob.enabled ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                {selectedJob.enabled ? "Disable" : "Enable"}
              </Button>
              <Button
                size="sm"
                className="h-7 text-[10px] px-2 bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20"
                onClick={() => trigger(selectedJob.job_id)}
              >
                <Play className="h-3 w-3 mr-1" /> Run Now
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Status", val: selectedJob.last_run_status || "—" },
              { label: "Schedule", val: formatSchedule(selectedJob.schedule) },
              { label: "Last Run", val: timeAgo(selectedJob.last_run_at) || "Never" },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-md bg-[#15151b] border border-[#2a2a35] p-2.5">
                <p className="text-[10px] text-[#5a5a72] mb-0.5">{label}</p>
                <p className={`text-xs font-medium ${label === "Status" ? statusColor(val) : "text-white"}`}>{val}</p>
              </div>
            ))}
          </div>
        </div>
        {loadingDetail ? (
          <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-brand" /></div>
        ) : detail && detail.runs.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-white">Execution History</p>
            {detail.runs.map((run: RunDetail, i: number) => {
              const runKey = run.id || String(i);
              const isExpanded = expandedRunId === runKey;
              const tasks = runGetTasks(run);
              const summaryText = runGetSummary(run);
              const eff = runEffectiveStatus(run);
              const startDate = run.started_at
                ? new Date(run.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—";
              return (
                <div
                  key={runKey}
                  className={`rounded-lg border overflow-hidden transition-colors ${eff.bg} ${!isExpanded ? "cursor-pointer hover:border-brand/20" : ""}`}
                  onClick={() => !isExpanded && setExpandedRunId(runKey)}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold uppercase tracking-wider ${eff.color}`}>{eff.label}</span>
                        {tasks && tasks.length > 0 && (
                          <span className="text-[10px] text-[#5a5a72]">
                            {tasks.filter((t) => t.status === "success").length}/{tasks.length} tasks
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[#5a5a72]">
                        <span className="text-[10px]">{startDate}</span>
                        {isExpanded ? (
                          <ChevronDown
                            className="h-3 w-3 cursor-pointer hover:text-white"
                            onClick={(e) => { e.stopPropagation(); setExpandedRunId(null); }}
                          />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </div>
                    </div>
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
                    <div className="flex items-center gap-3 text-[10px] text-[#5a5a72] mt-1.5">
                      {run.duration_ms != null && <span>{(run.duration_ms / 1000).toFixed(1)}s</span>}
                      {run.model && <span>{run.model}</span>}
                      {(run.input_tokens || run.output_tokens) && (
                        <span>{((run.input_tokens || 0) + (run.output_tokens || 0)).toLocaleString()} tok</span>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-[#2a2a35] bg-[#0e0e12] p-3 space-y-3">
                      {run.error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                          <p className="text-[10px] text-red-400 font-semibold mb-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Run Error
                          </p>
                          <pre className="text-[9px] text-red-400/80 font-mono whitespace-pre-wrap break-all">{run.error}</pre>
                        </div>
                      )}
                      {tasks && tasks.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-bold text-[#5a5a72] tracking-widest">Pipeline Tasks</span>
                            <button
                              className="text-[9px] text-[#9fa0b8] hover:text-white px-2"
                              onClick={(e) => { e.stopPropagation(); setExpandedRunId(null); }}
                            >Close</button>
                          </div>
                          <div className="space-y-1.5">
                            {tasks.map((task, ti) => (
                              <div
                                key={ti}
                                className={`rounded border p-2 ${
                                  task.status === "success" ? "bg-emerald-500/5 border-emerald-500/20"
                                    : task.status === "error" ? "bg-red-500/5 border-red-500/20"
                                      : "bg-[#15151b] border-[#2a2a35]"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                    task.status === "success" ? "bg-emerald-400"
                                      : task.status === "error" ? "bg-red-400"
                                        : task.status === "running" ? "bg-blue-400 animate-pulse"
                                          : "bg-[#5a5a72]"
                                  }`} />
                                  <span className="text-[11px] font-medium text-white flex-1 truncate">{task.name}</span>
                                  {task.integrations && task.integrations.length > 0 && (
                                    <div className="flex gap-1">
                                      {task.integrations.map((int) => (
                                        <span key={int} className="text-[7px] px-1 py-0 border border-[#2a2a35] rounded text-[#5a5a72]">{int}</span>
                                      ))}
                                    </div>
                                  )}
                                  <span className={`text-[8px] uppercase font-semibold ${
                                    task.status === "success" ? "text-emerald-400"
                                      : task.status === "error" ? "text-red-400" : "text-[#5a5a72]"
                                  }`}>{task.status}</span>
                                </div>
                                {task.status === "error" && task.error && (
                                  <div className="mt-1.5 bg-red-500/10 border border-red-500/20 rounded p-1.5">
                                    <pre className="text-[9px] text-red-400/80 font-mono whitespace-pre-wrap break-all">{task.error}</pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {summaryText && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#5a5a72] tracking-widest mb-1 block">Summary</span>
                          <pre className="text-[10px] text-[#c7c7da] font-mono bg-[#15151b] border border-[#2a2a35] rounded-md p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {summaryText}
                          </pre>
                        </div>
                      )}
                      {(!tasks || tasks.length === 0) && (
                        <div className="flex justify-end">
                          <button
                            className="text-[9px] text-[#9fa0b8] hover:text-white px-2"
                            onClick={(e) => { e.stopPropagation(); setExpandedRunId(null); }}
                          >Close</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : detail && !loadingDetail ? (
          <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0e0e12] p-6 text-center">
            <p className="text-xs text-[#9fa0b8]">No run history yet.</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Jobs</h3>
        <button onClick={load} className="text-[#9fa0b8] hover:text-white transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0e0e12] p-8 text-center">
          <p className="text-sm text-[#9fa0b8]">No jobs found for this agent.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.job_id} className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3 flex items-center gap-3 hover:border-brand/20 transition-all">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedJob(job); loadDetail(job.job_id); }}>
                <p className="text-sm font-medium text-white truncate">{job.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-[#9fa0b8]">
                    <Bot className="h-2.5 w-2.5 text-brand/60" />
                    {agent.name}
                  </span>
                  <span className={`text-[10px] ${statusColor(job.last_run_status || "")}`}>· {job.last_run_status || "idle"}</span>
                  {job.schedule && <span className="text-[10px] text-[#5a5a72]">· {formatSchedule(job.schedule)}</span>}
                  {job.last_run_at && <span className="text-[10px] text-[#5a5a72]">· {timeAgo(job.last_run_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => trigger(job.job_id)}
                  className="h-7 w-7 rounded-md bg-brand/10 text-brand border border-brand/30 flex items-center justify-center hover:bg-brand/20 transition-colors"
                >
                  <Play className="h-3 w-3" />
                </button>
                <ChevronRight
                  className="h-4 w-4 text-[#5a5a72] cursor-pointer hover:text-white transition-colors"
                  onClick={() => { setSelectedJob(job); loadDetail(job.job_id); }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contexts Tab ──────────────────────────────────────────────────────────────

export function ContextsTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Record<string, string> }) {
  const [manualConnected, setManualConnected] = useState<ContextItem[]>([]);
  const [manualLibrary, setManualLibrary] = useState<ContextItem[]>([]);
  const [thirdPartyLibrary, setThirdPartyLibrary] = useState<ThirdPartyContextItem[]>([]);
  const [thirdPartyAssignedIds, setThirdPartyAssignedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [unassigning, setUnassigning] = useState<string | null>(null);

  // Human-readable labels for known integration slugs. Falls back to
  // title-casing the slug if we don't have an explicit entry, so new
  // integrations still render sensibly without touching this code.
  const INTEGRATION_DISPLAY_LABELS: Record<string, string> = {
    gmail: "Gmail",
    google_gmail: "Gmail",
    google_docs: "Google Docs",
    google_drive: "Google Drive",
    google_calendar: "Google Calendar",
    google_sheets: "Google Sheets",
    google_slides: "Google Slides",
    outlook: "Outlook",
    microsoft_outlook: "Outlook",
    onedrive: "OneDrive",
    notion: "Notion",
    slack: "Slack",
    discord: "Discord",
    github: "GitHub",
    gitlab: "GitLab",
    linear: "Linear",
    jira: "Jira",
    confluence: "Confluence",
    hubspot: "HubSpot",
    salesforce: "Salesforce",
  };

  const getIntegrationTypeLabel = (ctx: ThirdPartyContextItem): string => {
    // Prefer the explicit display_name the backend sets, fall back to
    // the slug-based mapping, then title-case the slug as a last resort.
    if (ctx.integration_display_name && ctx.integration_display_name.trim()) {
      return ctx.integration_display_name.trim();
    }
    const slug = (ctx.integration_name || "").toLowerCase();
    if (!slug) return "Integration";
    return INTEGRATION_DISPLAY_LABELS[slug] || slug
      .split("_")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  };

  const normalizeThirdPartyName = (ctx: ThirdPartyContextItem) => {
    // Prefix the account display name with the integration type so
    // the user can distinguish between multiple contexts that share
    // the same account (e.g., Gmail + Calendar both connected with
    // the same Google login would otherwise both show as just the
    // account name, with no way to tell which is which in the picker).
    const meta = ctx.integration_metadata || {};
    const accountName: string | undefined = meta.name || meta.screen_name;
    const typeLabel = getIntegrationTypeLabel(ctx);

    if (accountName && accountName.trim()) {
      return `${typeLabel} · ${accountName.trim()}`;
    }
    // No account name available — use the type label alone. Keeps the
    // pre-fix behavior for integrations with no per-account metadata.
    return typeLabel;
  };

  const getThirdPartyMetadataSummary = (ctx: ThirdPartyContextItem): string | undefined => {
    const meta = ctx.integration_metadata || {};
    if (meta.email) return meta.email;
    
    const values: string[] = [];
    const items = Array.isArray(meta) ? meta : [meta];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      for (const [k, v] of Object.entries(item)) {
        if (typeof v !== "string" || v.startsWith("http") || k === "name" || k === "picture") continue;
        const trimmed = v.trim();
        if (trimmed) values.push(trimmed);
      }
    }
    return values.length > 0 ? values.slice(0, 2).join(" · ") : undefined;
  };

  const getThirdPartyPicture = (ctx: ThirdPartyContextItem): string | undefined => {
    const meta = ctx.integration_metadata || {};
    return meta.picture || meta.profile_image_url || undefined;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const agentQs = `?agent_id=${agent.agent_id}${orgId ? `&org_id=${orgId}` : ""}`;

      const [agentRes, libRes, tpAllRes, tpAssignedRes] = await Promise.all([
        fetch(`/api/openclaw/contexts/agent/${agent.agent_id}${qs}`, { headers: authHeaders }),
        fetch(`/api/openclaw/contexts${qs}`, { headers: authHeaders }),
        fetch(`/api/openclaw/contexts/third-party/completed${qs}`, { headers: authHeaders }),
        fetch(`/api/openclaw/contexts/third-party${agentQs}`, { headers: authHeaders }),
      ]);
      
      const agentData = await agentRes.json();
      const libData = await libRes.json();
      const tpAllData = await tpAllRes.json();
      const tpAssignedData = await tpAssignedRes.json();

      const connectedManual = Array.isArray(agentData) ? agentData : agentData.contexts || [];
      const allManual = Array.isArray(libData) ? libData : libData.contexts || [];
      
      const allThirdParty: ThirdPartyContextItem[] = Array.isArray(tpAllData) ? tpAllData : tpAllData?.contexts || [];
      const assignedThirdParty: ThirdPartyContextItem[] = Array.isArray(tpAssignedData) ? tpAssignedData : tpAssignedData?.contexts || [];

      setManualConnected(connectedManual);
      setManualLibrary(allManual);
      setThirdPartyLibrary(allThirdParty);
      setThirdPartyAssignedIds(assignedThirdParty.map(c => c.id));
    } catch { toast.error("Failed to load contexts"); }
    finally { setLoading(false); }
  }, [agent.agent_id, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const assign = async (ctx: DisplayContextItem) => {
    const key = `${ctx.source}:${ctx.id}`;
    setAssigning(key);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const res = ctx.source === "third_party"
        ? await fetch(`/api/openclaw/contexts/third-party/${ctx.id}/assign${qs}`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ agent_id: agent.agent_id, ...(orgId ? { org_id: orgId } : {}) }),
          })
        : await fetch(`/api/openclaw/contexts/assign${qs}`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ agent_id: agent.agent_id, context_id: ctx.id, ...(orgId ? { org_id: orgId } : {}) }),
          });
      if (!res.ok) throw new Error();
      if (ctx.source === "third_party") {
        setThirdPartyAssignedIds((prev) => prev.includes(ctx.id) ? prev : [...prev, ctx.id]);
      } else {
        const manualCtx: ContextItem = { id: ctx.id, name: ctx.name, description: ctx.description };
        setManualConnected((prev) => prev.some((c) => c.id === ctx.id) ? prev : [...prev, manualCtx]);
      }
      toast.success(`Assigned "${ctx.name}"`);
    } catch { toast.error("Failed to assign context"); }
    finally { setAssigning(null); }
  };

  const unassign = async (ctx: DisplayContextItem) => {
    const key = `${ctx.source}:${ctx.id}`;
    setUnassigning(key);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const res = ctx.source === "third_party"
        ? await fetch(`/api/openclaw/contexts/third-party/${ctx.id}/assign/${agent.agent_id}${qs}`, {
            method: "DELETE",
            headers: authHeaders,
          })
        : await fetch(`/api/openclaw/contexts/unassign/${agent.agent_id}/${ctx.id}${qs}`, {
            method: "DELETE",
            headers: authHeaders,
          });
      if (!res.ok) throw new Error();
      if (ctx.source === "third_party") {
        setThirdPartyAssignedIds((prev) => prev.filter((id) => id !== ctx.id));
      } else {
        setManualConnected((prev) => prev.filter((c) => c.id !== ctx.id));
      }
      toast.success(`Removed "${ctx.name}"`);
    } catch { toast.error("Failed to remove context"); }
    finally { setUnassigning(null); }
  };

  const connectedManualIds = new Set(manualConnected.map((c) => c.id));
  const connectedThirdPartyIds = new Set(thirdPartyAssignedIds);

  const connected: DisplayContextItem[] = [
    ...manualConnected.map((ctx) => ({ ...ctx, source: "manual" as const })),
    ...thirdPartyLibrary
      .filter((ctx) => connectedThirdPartyIds.has(ctx.id))
      .map((ctx) => ({
        id: ctx.id,
        name: normalizeThirdPartyName(ctx),
        description: getThirdPartyMetadataSummary(ctx) || "Third-party integration context",
        source: "third_party" as const,
        picture: getThirdPartyPicture(ctx),
      })),
  ];

  const available: DisplayContextItem[] = [
    ...manualLibrary
      .filter((ctx) => !connectedManualIds.has(ctx.id))
      .map((ctx) => ({ ...ctx, source: "manual" as const })),
    ...thirdPartyLibrary
      .filter((ctx) => !connectedThirdPartyIds.has(ctx.id))
      .map((ctx) => ({
        id: ctx.id,
        name: normalizeThirdPartyName(ctx),
        description: getThirdPartyMetadataSummary(ctx) || "Third-party integration context",
        source: "third_party" as const,
        picture: getThirdPartyPicture(ctx),
      })),
  ];

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Assigned Contexts</h3>
          <p className="text-[10px] text-[#9fa0b8] mt-0.5">{connected.length} context{connected.length !== 1 ? "s" : ""} assigned</p>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Context
        </Button>
      </div>
      {connected.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0e0e12] p-6 text-center">
          <FileText className="h-8 w-8 text-[#2a2a35] mx-auto mb-2" />
          <p className="text-xs text-[#9fa0b8]">No contexts assigned</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connected.map((ctx) => (
            <div key={`${ctx.source}-${ctx.id}`} className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center shrink-0 overflow-hidden">
                {ctx.picture ? (
                  <img src={ctx.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : ctx.source === "third_party" ? (
                  <Plug className="h-4 w-4 text-brand" />
                ) : (
                  <FileText className="h-4 w-4 text-brand" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-white truncate">{ctx.name}</p>
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#2a2a35] text-[#9fa0b8]">
                    {ctx.source === "third_party" ? "Third-party" : "Manual"}
                  </span>
                </div>
                {ctx.description && <p className="text-[10px] text-[#9fa0b8] truncate">{ctx.description}</p>}
              </div>
              <button
                onClick={() => unassign(ctx)}
                disabled={unassigning === `${ctx.source}:${ctx.id}`}
                className="text-[#5a5a72] hover:text-red-400 transition-colors"
              >
                {unassigning === `${ctx.source}:${ctx.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#2a2a35] flex items-center justify-between">
            <p className="text-xs font-medium text-white">Available Contexts</p>
            <button onClick={() => setShowAdd(false)} className="text-[#5a5a72] hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {available.length === 0 ? (
            <p className="text-xs text-[#9fa0b8] p-4 text-center">All contexts assigned</p>
          ) : (
            <div className="divide-y divide-[#1a1a25] max-h-48 overflow-y-auto">
              {available.map((ctx) => (
                <div key={`${ctx.source}-${ctx.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#15151b] transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {ctx.picture ? (
                      <img src={ctx.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : ctx.source === "third_party" ? (
                      <Plug className="h-4 w-4 text-brand" />
                    ) : (
                      <FileText className="h-4 w-4 text-brand" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-white truncate">{ctx.name}</p>
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#2a2a35] text-[#9fa0b8]">
                        {ctx.source === "third_party" ? "Third-party" : "Manual"}
                      </span>
                    </div>
                    {ctx.description && <p className="text-[10px] text-[#9fa0b8] truncate">{ctx.description}</p>}
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-[10px] px-2 bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 shrink-0"
                    disabled={assigning === `${ctx.source}:${ctx.id}`}
                    onClick={() => assign(ctx)}
                  >
                    {assigning === `${ctx.source}:${ctx.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Assign"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Integrations Tab ──────────────────────────────────────────────────────────

export function IntegrationsTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Record<string, string> }) {
  const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
  const [available, setAvailable] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailName, setDetailName] = useState<string | null>(null);
  const [configuringName, setConfiguringName] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<{ name: string; data: any[] } | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [unassigning, setUnassigning] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const res = await fetch(`/api/openclaw/integrations/agent/${agent.agent_id}${qs}`, { headers: authHeaders });
      const data = await res.json();
      setConnected(Array.isArray(data.connected) ? data.connected : []);
      setAvailable(Array.isArray(data.available) ? data.available : []);
    } catch { toast.error("Failed to load integrations"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [agent.agent_id]);

  useEffect(() => { load(); }, [load]);

  const handleAssign = async (integ: Integration) => {
    setSubmitting(true);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const hasCredentials = Object.keys(credentials).length > 0;
      const body: Record<string, unknown> = {
        agent_id: agent.agent_id,
        integration_name: integ.name,
        ...(hasCredentials ? { credentials } : {}),
        ...(orgId ? { org_id: orgId } : {}),
      };
      const res = await fetch(`/api/openclaw/integrations${qs}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.status === "oauth_required" && data.auth_url) {
        const popup = window.open(data.auth_url, "_blank", "width=600,height=800");
        toast.success("OAuth window opened — complete authorization then close the window.");
        setConfiguringName(null);
        setCredentials({});

        const onMessage = (event: MessageEvent) => {
          if (event.data?.type === "OAUTH_SUCCESS") {
            window.removeEventListener("message", onMessage);
            clearInterval(pollTimer);
            load(true);
            toast.success(`${integ.display_name} connected successfully`);
          }
        };
        window.addEventListener("message", onMessage);

        const pollTimer = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(pollTimer);
            window.removeEventListener("message", onMessage);
            load(true);
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(pollTimer);
          window.removeEventListener("message", onMessage);
        }, 300_000);

        return;
      }
      toast.success(`Connected "${integ.display_name}" to ${agent.name}`);
      setConfiguringName(null);
      setCredentials({});
      await load(true);
    } catch { toast.error("Failed to connect integration"); }
    finally { setSubmitting(false); }
  };

  const viewLogs = async (integ: Integration) => {
    setLoadingLogs(true);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const res = await fetch(`/api/openclaw/integrations/${integ.name}/logs${qs}`, { headers: authHeaders });
      const data = await res.json();
      setLogs({ name: integ.name, data: Array.isArray(data) ? data : data.logs || [] });
    } catch { toast.error("Failed to load logs"); }
    finally { setLoadingLogs(false); }
  };

  const handleUnassign = async (integ: Integration) => {
    setUnassigning(integ.name);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `&org_id=${orgId}` : "";
      const res = await fetch(
        `/api/openclaw/integrations/unassign?agent_id=${encodeURIComponent(agent.agent_id)}&integration_name=${encodeURIComponent(integ.name)}${qs}`,
        { method: "DELETE", headers: authHeaders }
      );
      if (!res.ok) throw new Error();
      setConnected((prev) => prev.filter((i) => i.integration_name !== integ.name));
      if (logs?.name === integ.name) setLogs(null);
      toast.success(`Disconnected "${integ.display_name}" from ${agent.name}`);
    } catch { toast.error("Failed to unassign integration"); }
    finally { setUnassigning(null); }
  };

  const handleTestConnection = async (integ: Integration) => {
    setTestingConnection(integ.name);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `&org_id=${orgId}` : "";
      const res = await fetch(
        `/api/openclaw/integrations/${encodeURIComponent(integ.name)}/test?agent_id=${encodeURIComponent(agent.agent_id)}${qs}`,
        { method: "POST", headers: authHeaders }
      );
      const data = await res.json();
      if (data.status === "ok") {
        toast.success(`${integ.display_name}: Connection verified`);
      } else if (data.status === "unsupported") {
        toast.info(`Test not available for ${integ.display_name}`);
      } else {
        toast.error(`${integ.display_name}: ${data.message || "Connection failed"}`);
      }
    } catch {
      toast.error("Failed to test connection");
    } finally {
      setTestingConnection(null);
    }
  };

  const methodColor = (method: string) => {
    if (method === "GET") return "text-emerald-400";
    if (method === "POST") return "text-blue-400";
    if (method === "PATCH" || method === "PUT") return "text-amber-400";
    if (method === "DELETE") return "text-red-400";
    return "text-[#9fa0b8]";
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>;

  const renderIntegCard = (integ: Integration | ConnectedIntegration, showAssign: boolean) => {
    const isExpanded = detailName === integ.name;
    const isConfiguring = configuringName === integ.name;
    const isOauth = integ.api_type?.startsWith("oauth2");
    const displayMetadata = !showAssign ? ((integ as ConnectedIntegration).display_metadata ?? []) : [];
    const metaImages = displayMetadata.filter((m) => m.type === "image_url");
    const metaStrings = displayMetadata.filter((m) => m.type === "string");

    return (
      <div key={integ.name} className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] overflow-hidden">
        {/* Header — click to expand */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#15151b] transition-colors select-none"
          onClick={() => {
            setDetailName(isExpanded ? null : integ.name);
            if (isExpanded) { setConfiguringName(null); setCredentials({}); }
          }}
        >
          <div className="h-7 w-7 rounded-md bg-brand/10 border border-brand/30 flex items-center justify-center shrink-0">
            <Plug className="h-3.5 w-3.5 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-medium text-white">{integ.display_name}</p>
              <Badge variant="outline" className="text-[9px] border-[#2a2a35] text-[#9fa0b8] uppercase px-1.5 py-0">
                {integ.api_type}
              </Badge>
              {!showAssign && (
                <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 px-1.5 py-0">
                  connected
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-[#5a5a72] font-mono truncate">{integ.base_url}</p>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-[#5a5a72] shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
        </div>

        {/* Expanded body */}
        {isExpanded && (
          <div className="border-t border-[#2a2a35] px-3 py-3 space-y-3">
            {/* Usage instructions */}
            {integ.usage_instructions && (
              <p className="text-[11px] text-[#9fa0b8] bg-[#15151b] rounded-md p-2 border border-[#2a2a35] leading-relaxed">
                {integ.usage_instructions}
              </p>
            )}

            {/* Endpoints */}
            {integ.endpoints?.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] text-[#5a5a72] uppercase tracking-wider mb-1.5">Endpoints</p>
                {integ.endpoints.map((ep, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[10px] py-0.5">
                    <span className={`font-mono font-bold w-12 text-right shrink-0 ${methodColor(ep.method)}`}>
                      {ep.method}
                    </span>
                    <span className="font-mono text-[#c7c7da] shrink-0">{ep.path}</span>
                    <span className="text-[#5a5a72]">{ep.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Connected account metadata */}
            {!showAssign && (
              <div className="flex items-center gap-2.5 rounded-md bg-[#15151b] border border-[#2a2a35] px-2.5 py-2">
                {metaImages.map((img) => (
                  <img
                    key={img.key}
                    src={img.value}
                    alt={img.key}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-[#2a2a35]"
                  />
                ))}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-white truncate">
                    Connected as {metaStrings.find((m) => m.key === "name")?.value || metaStrings.find((m) => m.key === "email")?.value || integ.display_name}
                  </p>
                  {metaStrings.filter((m) => m.key !== "name").map((item) => (
                    <p key={item.key} className="text-[10px] text-[#9fa0b8] font-mono truncate">{item.value}</p>
                  ))}
                  {metaStrings.length === 0 && (
                    <p className="text-[10px] text-[#5a5a72] italic">No account details available</p>
                  )}
                </div>
              </div>
            )}

            {/* Assign to this agent (available only) */}
            {showAssign && !isConfiguring && (
              <Button
                size="sm"
                className="h-7 text-[10px] px-3 bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 w-full"
                onClick={(e) => { e.stopPropagation(); setConfiguringName(integ.name); setCredentials({}); }}
              >
                <Plus className="h-3 w-3 mr-1" /> Connect to {agent.name}
              </Button>
            )}

            {/* Credential / assign form */}
            {showAssign && isConfiguring && (
              <div
                className="space-y-2.5 rounded-md border border-brand/20 bg-[#0a0a0e] p-3"
                onClick={(e) => e.stopPropagation()}
              >
                {isOauth ? (
                  <p className="text-[11px] text-[#9fa0b8] text-center py-1">
                    Auth is handled via OAuth — no credentials required.
                  </p>
                ) : (integ.auth_fields || []).length > 0 ? (
                  (integ.auth_fields || []).map((field) => (
                    <div key={field.name} className="space-y-1">
                      <label className="text-[10px] font-medium text-[#c7c7da]">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                      </label>
                      <input
                        type={field.name.toLowerCase().includes("token") || field.name.toLowerCase().includes("key") || field.name.toLowerCase().includes("secret") ? "password" : "text"}
                        placeholder={`Enter ${field.label}...`}
                        className="w-full h-8 rounded-md bg-[#15151b] border border-[#2a2a35] text-white placeholder:text-[#5a5a72] text-xs px-3 focus:outline-none focus:border-brand/50"
                        value={credentials[field.name] || ""}
                        onChange={(e) => setCredentials((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-[#9fa0b8] text-center py-1">No credentials required.</p>
                )}
                <div className="flex gap-2 pt-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-7 text-[10px] text-[#9fa0b8] hover:text-white border border-[#2a2a35]"
                    onClick={() => { setConfiguringName(null); setCredentials({}); }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-[10px] bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20"
                    onClick={() => handleAssign(integ)}
                    disabled={
                      submitting ||
                      (!isOauth && (integ.auth_fields || []).some((f) => f.required && !credentials[f.name]))
                    }
                  >
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Connect
                  </Button>
                </div>
              </div>
            )}

            {/* Test + View logs + Unassign (connected integrations) */}
            {!showAssign && (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleTestConnection(integ); }}
                  disabled={testingConnection === integ.name}
                  className="text-[10px] text-[#9fa0b8] hover:text-emerald-400 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {testingConnection === integ.name
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Zap className="h-3 w-3" />}
                  Test
                </button>
                <span className="text-[#2a2a35]">·</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (logs?.name === integ.name) setLogs(null);
                    else viewLogs(integ);
                  }}
                  className="text-[10px] text-[#9fa0b8] hover:text-brand transition-colors flex items-center gap-1"
                >
                  <FileText className="h-3 w-3" />
                  {logs?.name === integ.name ? "Hide" : "View"} logs
                </button>
                <span className="text-[#2a2a35]">·</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnassign(integ); }}
                  disabled={unassigning === integ.name}
                  className="text-[10px] text-[#9fa0b8] hover:text-red-400 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {unassigning === integ.name
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Unplug className="h-3 w-3" />}
                  Unassign
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Integrations</h3>
          <p className="text-[10px] text-[#9fa0b8] mt-0.5">
            {connected.length} service{connected.length !== 1 && "s"} connected to {agent.name}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-[10px] text-[#9fa0b8] hover:text-white transition-colors disabled:opacity-50 rounded-md border border-[#2a2a35] bg-[#0e0e12] px-2 py-1"
          title="Refresh integrations"
        >
          {refreshing
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <RefreshCw className="h-3 w-3" />}
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Connected integrations */}
      {connected.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0e0e12] p-6 text-center">
          <Plug className="h-8 w-8 text-[#2a2a35] mx-auto mb-2" />
          <p className="text-xs text-[#9fa0b8]">No integrations connected yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connected.map((integ) => renderIntegCard(integ, false))}
        </div>
      )}

      {/* Logs panel */}
      {logs && (
        <div className="rounded-lg border border-[#2a2a35] bg-[#080810] overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[#2a2a35] flex items-center justify-between bg-[#0e0e12]">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-brand" />
              <p className="text-xs font-medium text-white">Activity Logs</p>
              <span className="text-[9px] text-[#5a5a72]">{logs.name}</span>
            </div>
            <button onClick={() => setLogs(null)} className="text-[#5a5a72] hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {loadingLogs ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-brand" /></div>
          ) : logs.data.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <FileText className="h-7 w-7 text-[#2a2a35] mx-auto" />
              <p className="text-xs text-[#9fa0b8]">No activity recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#12121a]">
              {/* Table header */}
              <div className="grid grid-cols-[52px_1fr_64px_72px] gap-2 px-3 py-1.5 bg-[#0e0e12]">
                {["Method", "Endpoint", "Status", "Time"].map((h) => (
                  <span key={h} className="text-[9px] uppercase tracking-wider text-[#5a5a72] font-medium">{h}</span>
                ))}
              </div>
              <div className="overflow-y-auto max-h-48 divide-y divide-[#12121a]">
                {logs.data.map((log: any, i: number) => {
                  const isErr = (log.status_code ?? 0) >= 400;
                  const mbg = () => {
                    if (log.method === "GET") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                    if (log.method === "POST") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
                    if (log.method === "PATCH" || log.method === "PUT") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
                    if (log.method === "DELETE") return "bg-red-500/10 text-red-400 border-red-500/20";
                    return "bg-[#1a1a25] text-[#9fa0b8] border-[#2a2a35]";
                  };
                  return (
                    <div key={i} className="grid grid-cols-[52px_1fr_64px_72px] gap-2 items-center px-3 py-2 hover:bg-[#15151b] transition-colors">
                      <span className={`inline-flex items-center justify-center font-mono font-bold text-[9px] rounded px-1 py-0.5 border ${mbg()}`}>
                        {log.method}
                      </span>
                      <span className="font-mono text-[10px] text-[#c7c7da] truncate" title={log.endpoint}>
                        {log.endpoint}
                      </span>
                      <div className="flex items-center gap-1">
                        {isErr
                          ? <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />
                          : <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                        <span className={`font-mono text-[10px] ${isErr ? "text-red-400" : "text-emerald-400"}`}>
                          {log.status_code || "—"}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        {log.created_at && (
                          <span className="text-[9px] text-[#5a5a72]">
                            {(() => { const d = Date.now() - new Date(log.created_at).getTime(); const m = Math.floor(d/60000); if (m<1) return "just now"; if (m<60) return `${m}m ago`; const h = Math.floor(m/60); return h<24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`; })()}
                          </span>
                        )}
                        {log.duration_ms != null && (
                          <span className="text-[9px] text-[#3a3a50] font-mono">{log.duration_ms}ms</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Available to connect */}
      {available.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] text-[#5a5a72] uppercase tracking-wider">Available to connect</p>
          {available.map((integ) => renderIntegCard(integ, true))}
        </div>
      )}
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────

const MOCK_ACTIVITY = [
  { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", msg: "Completed task: Analyze customer feedback", time: "2m ago" },
  { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", msg: "Issue flagged on task — human review needed", time: "15m ago" },
  { icon: Zap, color: "text-brand", bg: "bg-brand/10", msg: "Integration executed successfully", time: "1h ago" },
  { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10", msg: "Context library accessed for task", time: "2h ago" },
  { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", msg: "Job 'Daily Report' completed", time: "5h ago" },
];

const MOCK_ACTIONS = [
  { title: "Review flagged output", desc: "Agent produced unexpected results on task #38", priority: "high" },
  { title: "Approve integration request", desc: "GitHub access requested for repository sync", priority: "medium" },
];

export function NotificationsTab() {
  const [tab, setTab] = useState<"activity" | "actions">("activity");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Notifications</h3>
        <div className="flex rounded-lg border border-[#2a2a35] overflow-hidden">
          {(["activity", "actions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[11px] transition-colors ${tab === t ? "bg-brand/10 text-brand" : "text-[#9fa0b8] hover:text-white"
                }`}
            >
              {t === "actions" ? "Action Required" : "Activity"}
            </button>
          ))}
        </div>
      </div>
      {tab === "activity" ? (
        <div className="space-y-2">
          {MOCK_ACTIVITY.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-[#2a2a35] bg-[#0e0e12]">
                <div className={`h-7 w-7 rounded-full ${item.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#c7c7da]">{item.msg}</p>
                  <p className="text-[10px] text-[#5a5a72] mt-0.5">{item.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {MOCK_ACTIONS.map((action, i) => (
            <div key={i} className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-white">{action.title}</p>
                  <p className="text-[10px] text-[#9fa0b8] mt-0.5">{action.desc}</p>
                  <span className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded border ${action.priority === "high"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>{action.priority}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

// --- Analytics API response type ---

interface AnalyticsResponse {
  agent_id: string;
  tasks: {
    completed: number;
    pending: number;
    failed: number;
    weekly_trend: Array<{ day: string; tasks: number }>;
  };
  jobs: {
    total_runs: number;
    jobs: Array<{ name: string; runs: number }>;
  };
  work_time: {
    total_hours: number;
    this_week: number;
    avg_per_day: number;
    daily: Array<{ day: string; hours: number }>;
  };
  uptime: {
    uptime_percent: number;
    downtime_hours: number;
    last_downtime: string | null;
    online: boolean;
    monthly: Array<{ month: string; uptime: number }>;
  };
  tokens: {
    total_consumed: number;
    this_month: number;
    avg_per_task: number;
    breakdown: Array<{ type: string; value: number }>;
  };
  compute: {
    cpu_usage: number;
  };
  interactions: {
    total_interactions: number;
    unique_people: number;
    this_week: number;
    top_contacts: Array<{ name: string; count: number }>;
  };
}

// TODO: replace with API data once the interactions endpoint is plumbed through
const analyticsInteractionData = {
  totalInteractions: 89, uniquePeople: 6, thisWeek: 14,
  topContacts: [
    { name: "Atlas", count: 24 }, { name: "Orion", count: 19 }, { name: "Sage", count: 16 },
    { name: "Nova", count: 14 }, { name: "Vega", count: 10 }, { name: "You", count: 6 },
  ],
};

// --- Analytics chart configs (dark theme colors) ---

const analyticsTaskCfg: ChartConfig = { tasks: { label: "Tasks", color: "var(--brand)" } };
const analyticsJobCfg: ChartConfig = { runs: { label: "Runs", color: "hsl(265 80% 65%)" } };
const analyticsWorkCfg: ChartConfig = { hours: { label: "Hours", color: "var(--brand)" } };
const analyticsUptimeCfg: ChartConfig = { uptime: { label: "Uptime %", color: "hsl(142 71% 45%)" } };
const ANALYTICS_PIE_COLORS = ["#FBD10D", "hsl(265 80% 65%)"];
const TICK = { fill: "#9fa0b8", fontSize: 10 };

function afmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function AStatCard({ icon: Icon, label, value, sub }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3">
      <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-brand" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#9fa0b8] truncate">{label}</p>
        <p className="font-semibold text-sm text-white">{value}</p>
        {sub && <p className="text-xs text-[#9fa0b8]">{sub}</p>}
      </div>
    </div>
  );
}

function ASection({ title, children, delay = 0 }: { title: string; children: ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay }}>
      <div className="rounded-lg border border-[#2a2a35] bg-[#0a0a10]">
        <div className="px-4 pt-4 pb-3"><p className="text-sm font-semibold text-white">{title}</p></div>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </motion.div>
  );
}

export function AnalyticsTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Record<string, string> }) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = getUserIdFromToken() || "";

  useEffect(() => {
    setLoading(true);
    const orgId = getOrgId();
    const qs = `?user_id=${encodeURIComponent(userId)}${orgId ? `&org_id=${encodeURIComponent(orgId)}` : ""}`;
    fetch(`/api/openclaw/analytics/agent/${agent.agent_id}${qs}`, { headers: authHeaders })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [agent.agent_id]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-brand" />
    </div>
  );

  if (!data) return (
    <div className="p-4 text-center text-sm text-[#9fa0b8]">Failed to load analytics.</div>
  );

  const n = agent.name;
  const totalTasks = data.tasks.completed + data.tasks.failed;
  const successRate = totalTasks > 0 ? Math.round((data.tasks.completed / totalTasks) * 100) : 0;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">

        {/* 1. Tasks */}
        <ASection title={`Tasks — ${n}`} delay={0}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <AStatCard icon={CheckCircle2} label="Completed" value={data.tasks.completed} />
            <AStatCard icon={Loader2} label="Pending" value={data.tasks.pending} />
            <AStatCard icon={TrendingUp} label="Success Rate" value={`${successRate}%`} />
          </div>
          <ChartContainer config={analyticsTaskCfg} className="h-[160px] w-full">
            <BarChart data={data.tasks.weekly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "#2a2a35", opacity: 0.5 }} />
              <Bar dataKey="tasks" fill="var(--color-tasks)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ASection>

        {/* 2. Jobs */}
        <ASection title={`Jobs — ${n}`} delay={0.05}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <AStatCard icon={Briefcase} label="Total Job Runs" value={data.jobs.total_runs} />
            <AStatCard icon={CheckCircle2} label="Unique Jobs" value={data.jobs.jobs.length} />
          </div>
          <ChartContainer config={analyticsJobCfg} className="h-[160px] w-full">
            <BarChart data={data.jobs.jobs} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={TICK} axisLine={false} tickLine={false} width={72} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "#2a2a35", opacity: 0.5 }} />
              <Bar dataKey="runs" fill="var(--color-runs)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </ASection>

        {/* 3. Work Time */}
        <ASection title={`Work Time — ${n}`} delay={0.1}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <AStatCard icon={Clock} label="Total Hours" value={`${data.work_time.total_hours}h`} />
            <AStatCard icon={Timer} label="This Week" value={`${data.work_time.this_week}h`} />
            <AStatCard icon={TrendingUp} label="Avg / Day" value={`${data.work_time.avg_per_day}h`} />
          </div>
          <ChartContainer config={analyticsWorkCfg} className="h-[160px] w-full">
            <AreaChart data={data.work_time.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "#2a2a35", opacity: 0.5 }} />
              <Area type="monotone" dataKey="hours" fill="var(--color-hours)" fillOpacity={0.15} stroke="var(--color-hours)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </ASection>

        {/* 4. Uptime */}
        <ASection title={`Uptime & Downtime — ${n}`} delay={0.15}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <AStatCard icon={ArrowUpCircle} label="Uptime" value={`${data.uptime.uptime_percent}%`} />
            <AStatCard
              icon={ArrowDownCircle}
              label="Downtime"
              value={`${data.uptime.downtime_hours}h`}
              sub={data.uptime.last_downtime ? `Last: ${data.uptime.last_downtime}` : undefined}
            />
            <div className="flex flex-col justify-center rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3">
              <p className="text-xs text-[#9fa0b8] mb-1">Status</p>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${data.uptime.online ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                <span className="text-sm font-semibold text-white">{data.uptime.online ? "Online" : "Offline"}</span>
              </div>
            </div>
          </div>
          <ChartContainer config={analyticsUptimeCfg} className="h-[160px] w-full">
            <AreaChart data={data.uptime.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis domain={[90, 100]} tick={TICK} axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "#2a2a35", opacity: 0.5 }} />
              <Area type="monotone" dataKey="uptime" fill="var(--color-uptime)" fillOpacity={0.15} stroke="var(--color-uptime)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </ASection>

        {/* 5. Token Consumption */}
        <ASection title={`Token Consumption — ${n}`} delay={0.2}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <AStatCard icon={Coins} label="Total" value={afmt(data.tokens.total_consumed)} />
            <AStatCard icon={TrendingUp} label="This Month" value={afmt(data.tokens.this_month)} />
            <AStatCard icon={Coins} label="Avg / Task" value={afmt(data.tokens.avg_per_task)} />
          </div>
          <div className="flex items-center gap-6">
            <div className="h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.tokens.breakdown} dataKey="value" nameKey="type" cx="50%" cy="50%" innerRadius={38} outerRadius={58} strokeWidth={0}>
                    {data.tokens.breakdown.map((_, i) => <Cell key={i} fill={ANALYTICS_PIE_COLORS[i % ANALYTICS_PIE_COLORS.length]} />)}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {data.tokens.breakdown.map((item, i) => (
                <div key={item.type} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: ANALYTICS_PIE_COLORS[i % ANALYTICS_PIE_COLORS.length] }} />
                  <span className="text-xs text-[#9fa0b8]">{item.type}</span>
                  <span className="text-xs font-semibold text-white ml-auto">{afmt(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </ASection>

        {/* 6. Compute & Storage */}
        <ASection title={`Compute & Storage — ${n}`} delay={0.25}>
          <div className="space-y-4">
            {[
              { label: "CPU Usage", icon: Cpu, value: `${data.compute.cpu_usage}%`, pct: data.compute.cpu_usage },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[#9fa0b8] flex items-center gap-1.5"><row.icon className="h-3.5 w-3.5" /> {row.label}</span>
                  <span className="font-semibold text-white">{row.value}</span>
                </div>
                <Progress value={row.pct} className="h-2" />
              </div>
            ))}
          </div>
        </ASection>

        {/* 7. Office Interactions — TODO: replace static data with data.interactions from the API */}
        <ASection title={`Office Interactions — ${n}`} delay={0.3}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <AStatCard icon={Users} label="Total" value={analyticsInteractionData.totalInteractions} />
            <AStatCard icon={Users} label="Unique" value={analyticsInteractionData.uniquePeople} />
            <AStatCard icon={TrendingUp} label="This Week" value={analyticsInteractionData.thisWeek} />
          </div>
          <div className="space-y-2">
            {analyticsInteractionData.topContacts.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-brand/10 flex items-center justify-center text-xs font-bold text-brand shrink-0">{c.name[0]}</div>
                <span className="text-xs text-white flex-1">{c.name}</span>
                <div className="flex-1 max-w-[180px]">
                  <Progress value={(c.count / analyticsInteractionData.topContacts[0].count) * 100} className="h-1.5" />
                </div>
                <span className="text-xs text-[#9fa0b8] w-8 text-right">{c.count}</span>
              </div>
            ))}
          </div>
        </ASection>

      </div>
    </ScrollArea>
  );
}

// ── Savings Tab ───────────────────────────────────────────────────────────────

// NOTE: the $24/mo "VPC Base Rate" line-item was removed from this tab.
// We now run pay-as-you-go only — users are charged for actual token
// consumption, no flat monthly infrastructure fee. Everything that used
// to reference `sVpc.baseRate` below has been stripped.
const sModels = [
  { name: "GPT-4o", inputTokens: 1_240_000, outputTokens: 680_000, inputRate: 2.50, outputRate: 10.00, color: "var(--brand)" },
  { name: "GPT-4o-mini", inputTokens: 3_100_000, outputTokens: 1_450_000, inputRate: 0.15, outputRate: 0.60, color: "hsl(265 80% 65%)" },
  { name: "Claude 3.5", inputTokens: 820_000, outputTokens: 390_000, inputRate: 3.00, outputRate: 15.00, color: "hsl(142 71% 45%)" },
  { name: "Whisper", inputTokens: 540_000, outputTokens: 0, inputRate: 0.006, outputRate: 0, color: "hsl(200 80% 55%)" },
];
const sTokenCostTotal = sModels.reduce((acc, m) => acc + (m.inputTokens / 1_000_000) * m.inputRate + (m.outputTokens / 1_000_000) * m.outputRate, 0);
const sDailyTokens = [
  { day: "Mon", tokens: 420_000 }, { day: "Tue", tokens: 580_000 }, { day: "Wed", tokens: 310_000 },
  { day: "Thu", tokens: 640_000 }, { day: "Fri", tokens: 490_000 }, { day: "Sat", tokens: 180_000 }, { day: "Sun", tokens: 95_000 },
];
const sMonthlyTokens = [
  { month: "Oct", cost: 18.40 }, { month: "Nov", cost: 21.20 },
  { month: "Dec", cost: 23.80 }, { month: "Jan", cost: 27.50 }, { month: "Feb", cost: 29.40 },
];
const sBillingHistory = [
  { month: "Oct", tokens: 18.40 }, { month: "Nov", tokens: 21.20 },
  { month: "Dec", tokens: 23.80 }, { month: "Jan", tokens: 27.50 },
  { month: "Feb", tokens: 29.40 },
];
const sTotalMonthly = sTokenCostTotal;
const sTokenDailyCfg: ChartConfig = { tokens: { label: "Tokens", color: "var(--brand)" } };
const sTokenMonthlyCfg: ChartConfig = { cost: { label: "Cost ($)", color: "hsl(265 80% 65%)" } };
const sBillingCfg: ChartConfig = {
  tokens: { label: "Tokens", color: "var(--brand)" },
};

function sfmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function SStatCard({ icon: Icon, label, value, sub, accent }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${accent ? "border-brand/20 bg-brand/5" : "border-[#2a2a35] bg-[#0e0e12]"}`}>
      <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-brand" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#9fa0b8] truncate">{label}</p>
        <p className="font-semibold text-sm text-white">{value}</p>
        {sub && <p className="text-xs text-[#9fa0b8]">{sub}</p>}
      </div>
    </div>
  );
}

function SSection({ title, children, delay = 0 }: { title: string; children: ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay }}>
      <div className="rounded-lg border border-[#2a2a35] bg-[#0a0a10]">
        <div className="px-4 pt-4 pb-3"><p className="text-sm font-semibold text-white">{title}</p></div>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </motion.div>
  );
}

interface BillingCurrentMonth {
  total_cost: number;
  total_tokens: number;
  // Anthropic prompt-cache accounting. Absent on rows written before
  // the cache columns were added — treat undefined as 0 at render time.
  total_cache_read_tokens?: number;
  total_cache_write_tokens?: number;
  total_models_used: number;
  models: {
    name: string;
    cost: number;
    tokens: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
  }[];
}

interface BillingDailyItem {
  date: string;
  total_cost: number;
  total_tokens: number;
}

interface BillingMonthlyItem {
  month: string;
  total_cost: number;
  total_tokens: number;
}

interface BillingModelUsage {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  total_cost: number;
}

export function SavingsTab({ agent }: { agent: AgentData }) {
  const userId = getUserIdFromToken() || "";
  const authHeaders = {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };

  // ── Wallet state ──
  const [walletBalance, setWalletBalance] = useState<string>("0.00");
  const [walletDebt, setWalletDebt] = useState<string>("0.00");
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [addAmount, setAddAmount] = useState(10);
  const [addingCredits, setAddingCredits] = useState(false);

  // Invoice-based payment state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [paymentOrderData, setPaymentOrderData] = useState<{ key?: string; currency?: string; amount?: number } | null>(null);

  const fetchWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const res = await fetch("/api/openclaw/wallet", { headers: authHeaders });
      if (res.ok) {
        const json = await res.json();
        // roam-backend's GET /wallet returns balanceDollars / debtDollars
        // at the top level (no `data` envelope), so read them directly.
        // The nested `json.data` form is only used by some other roam
        // endpoints — don't assume it here.
        const d = (json && typeof json === "object" && json.data) ? json.data : json;
        setWalletBalance(d.balanceDollars || "0.00");
        setWalletDebt(d.debtDollars || "0.00");
        setWalletTransactions(d.transactions || []);
      }
    } catch { /* ignore */ }
    setWalletLoading(false);
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  // Helper: load Razorpay SDK
  const loadRazorpayScript = async (): Promise<boolean> => {
    if ((window as any).Razorpay) return true;
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if ((window as any).Razorpay) resolve(true);
        else if (attempts >= 50) resolve(false);
        else { attempts++; setTimeout(check, 100); }
      };
      check();
    });
  };

  // Helper: open Razorpay checkout
  const openRazorpayCheckout = async (opts: {
    key: string; amount: number; currency: string; orderId: string;
    name: string; description: string; subscriptionId?: string;
    onVerify: (response: any) => Promise<void>;
  }) => {
    const loaded = await loadRazorpayScript();
    if (!loaded || !(window as any).Razorpay) throw new Error("Payment gateway not available");
    const { getRazorpayContactForCurrentUser } = await import("@/lib/razorpayPrefill");
    const rzpOptions: any = {
      key: opts.key, amount: opts.amount, currency: opts.currency,
      order_id: opts.orderId, name: opts.name, description: opts.description,
      handler: opts.onVerify,
      modal: { ondismiss: () => setAddingCredits(false) },
      theme: { color: "var(--brand)" },
      prefill: { contact: await getRazorpayContactForCurrentUser() },
    };
    if (opts.subscriptionId) rzpOptions.subscription_id = opts.subscriptionId;
    const razorpay = new (window as any).Razorpay(rzpOptions);
    razorpay.open();
  };

  // Called by PaymentMethodSelector after user selects currency + method
  const handlePaymentInitiated = async (data: {
    razorpayOrderId?: string; razorpayKeyId?: string; razorpaySubscriptionId?: string;
    shortUrl?: string; cryptoPaymentUrl?: string;
    walletPaid?: boolean; stripePaid?: boolean;
    amount: number; currency: string; invoiceId: string;
  }) => {
    if (data.walletPaid || data.stripePaid) {
      toast.success("Payment complete!");
      setAddingCredits(false);
      return;
    }
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      toast.info("Complete your crypto payment in the new tab. The invoice will update automatically once confirmed.");
      setAddingCredits(false);
      return;
    }
    try {
      if (data.shortUrl) { window.open(data.shortUrl, "_blank"); return; }
      const key = data.razorpayKeyId || paymentOrderData?.key || "";
      if (!key) throw new Error("Missing Razorpay key");
      await openRazorpayCheckout({
        key, amount: data.amount, currency: data.currency,
        orderId: data.razorpayOrderId || "",
        name: "Garage", description: `Add $${addAmount} credits`,
        subscriptionId: data.razorpaySubscriptionId,
        onVerify: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/openclaw/wallet/verify-payment", {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amountCents: addAmount * 100,
              }),
            });
            const verifyJson = await verifyRes.json();
            if (verifyJson.ok || verifyRes.ok) {
              toast.success(`$${addAmount} added to wallet!`);
              setShowPaymentSelector(false);
              setInvoiceId(null);
              setPaymentOrderData(null);
              fetchWallet();
            } else {
              toast.error("Payment verification failed");
            }
          } catch {
            toast.error("Payment verification failed");
          }
          setAddingCredits(false);
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Payment initiation failed");
      setAddingCredits(false);
    }
  };

  const handleAddCredits = async () => {
    setAddingCredits(true);
    try {
      // 1. Create order
      const orderRes = await fetch("/api/openclaw/wallet/create-order", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ amountDollars: addAmount }),
      });
      const orderJson = await orderRes.json();
      if (!orderJson.orderId) throw new Error(orderJson.error || "Failed to create order");

      // If backend returns an invoiceId, show payment method selector
      if (orderJson.invoiceId) {
        setInvoiceId(orderJson.invoiceId);
        setPaymentOrderData({ key: orderJson.keyId, currency: orderJson.currency || "USD", amount: orderJson.amount });
        setShowPaymentSelector(true);
        setAddingCredits(false);
        return;
      }

      // 2. Fallback: direct Razorpay checkout
      await openRazorpayCheckout({
        key: orderJson.keyId,
        amount: orderJson.amount,
        currency: orderJson.currency || "USD",
        orderId: orderJson.orderId,
        name: "Garage",
        description: `Add $${addAmount} credits`,
        onVerify: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/openclaw/wallet/verify-payment", {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amountCents: addAmount * 100,
              }),
            });
            const verifyJson = await verifyRes.json();
            if (verifyJson.ok || verifyRes.ok) {
              toast.success(`$${addAmount} added to wallet!`);
              fetchWallet();
            } else {
              toast.error("Payment verification failed");
            }
          } catch {
            toast.error("Payment verification failed");
          }
          setAddingCredits(false);
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to add credits");
      setAddingCredits(false);
    }
  };

  const [humanRate, setHumanRate] = useState(35);
  const [humanHours, setHumanHours] = useState(160);
  const [currentMonth, setCurrentMonth] = useState<BillingCurrentMonth | null>(null);
  const [daily7d, setDaily7d] = useState<BillingDailyItem[]>([]);
  const [monthly12m, setMonthly12m] = useState<BillingMonthlyItem[]>([]);
  const [modelsUsage, setModelsUsage] = useState<BillingModelUsage[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !agent?.agent_id) return;
    const loadBilling = async () => {
      setBillingLoading(true);
      setBillingError(null);
      try {
        const orgId = getOrgId();
        const qs = `?user_id=${encodeURIComponent(userId)}&agent_id=${encodeURIComponent(agent.agent_id)}${orgId ? `&org_id=${encodeURIComponent(orgId)}` : ""}`;
        const [cmRes, d7Res, m12Res, modelsRes] = await Promise.all([
          fetch(`/api/billing/usage/current-month${qs}`, { headers: authHeaders }),
          fetch(`/api/billing/usage/daily-7d${qs}`, { headers: authHeaders }),
          fetch(`/api/billing/usage/monthly-12m${qs}`, { headers: authHeaders }),
          fetch(`/api/billing/usage/models${qs}`, { headers: authHeaders }),
        ]);

        if (!cmRes.ok || !d7Res.ok || !m12Res.ok || !modelsRes.ok) {
          throw new Error("Failed to load billing usage");
        }

        const cmJson = await cmRes.json();
        const d7Json = await d7Res.json();
        const m12Json = await m12Res.json();
        const modelsJson = await modelsRes.json();

        setCurrentMonth(cmJson as BillingCurrentMonth);
        setDaily7d(Array.isArray(d7Json) ? d7Json as BillingDailyItem[] : []);
        setMonthly12m(Array.isArray(m12Json) ? m12Json as BillingMonthlyItem[] : []);
        setModelsUsage(Array.isArray(modelsJson) ? modelsJson as BillingModelUsage[] : []);
      } catch {
        setBillingError("Unable to load savings data right now.");
      } finally {
        setBillingLoading(false);
      }
    };
    loadBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.agent_id, userId]);

  const calcHumanCost = humanRate * humanHours;
  const aiMonthlyCost = currentMonth?.total_cost ?? 0;
  const savingsAmount = calcHumanCost - aiMonthlyCost;
  const savingsPct = Math.round((savingsAmount / calcHumanCost) * 100);

  const modelPalette = ["#FBD10D", "hsl(265 80% 65%)", "hsl(142 71% 45%)", "hsl(200 80% 55%)"];
  const effectiveModels = modelsUsage.length
  ? modelsUsage.map((m, idx) => ({
      name: m.model,
      inputTokens: m.prompt_tokens,
      outputTokens: m.completion_tokens,
      cacheReadTokens: m.cache_read_tokens ?? 0,
      cacheWriteTokens: m.cache_write_tokens ?? 0,
      color: modelPalette[idx % modelPalette.length],
      cost: m.total_cost,
    }))
  : [];

const dailyTokenData = daily7d.length
  ? daily7d.map((d) => ({
      day: new Date(d.date).toLocaleDateString(undefined, { weekday: "short" }),
      tokens: d.total_tokens,
    }))
  : [
      { day: "Mon", tokens: 0 }, { day: "Tue", tokens: 0 }, { day: "Wed", tokens: 0 },
      { day: "Thu", tokens: 0 }, { day: "Fri", tokens: 0 }, { day: "Sat", tokens: 0 }, { day: "Sun", tokens: 0 },
    ];

const monthlyTokenCostData = monthly12m.length
  ? monthly12m.map((m) => ({
      month: m.month.slice(5),
      cost: m.total_cost,
    }))
  : [
      { month: "10", cost: 0 }, { month: "11", cost: 0 }, { month: "12", cost: 0 },
      { month: "01", cost: 0 }, { month: "02", cost: 0 },
    ];

  const billingHistoryData = monthly12m.length
    ? monthly12m.map((m) => ({
        month: m.month.slice(5),
        tokens: m.total_cost,
      }))
    : sBillingHistory;

  // Pay-as-you-go only — total bill is just token usage now.
  const totalMonthlyBill = aiMonthlyCost;

  return (
    <>
    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* LEFT COLUMN */}
          <div className="space-y-4">

            {/* 0. Wallet Balance */}
            <SSection title="Agent Wallet" delay={0}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-[#9fa0b8]">Available Balance</p>
                  <p className="text-3xl font-bold text-white">${walletBalance}</p>
                  {parseFloat(walletDebt) > 0 && (
                    <p className="text-xs text-red-400 mt-1">Debt: ${walletDebt}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={addAmount}
                    onChange={(e) => setAddAmount(Number(e.target.value))}
                    className="bg-[#0e0e12] border border-[#2a2a35] rounded-md px-2 py-1.5 text-xs text-white"
                  >
                    {[5, 10, 25, 50, 100].map((v) => (
                      <option key={v} value={v}>${v}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={handleAddCredits}
                    disabled={addingCredits || walletLoading}
                    className="bg-brand text-brand-foreground hover:bg-brand/80 text-xs"
                  >
                    {addingCredits ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                    Add Credits
                  </Button>
                </div>
              </div>
              {walletTransactions.length > 0 && (
                <div className="border-t border-[#2a2a35] pt-3 max-h-[160px] overflow-y-auto space-y-2">
                  <p className="text-xs text-[#9fa0b8] font-medium mb-1">Recent Transactions</p>
                  {walletTransactions.slice(0, 10).map((tx: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {tx.type === "credit" ? (
                          <ArrowUpCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                        ) : (
                          <ArrowDownCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="text-[#9fa0b8] truncate">{tx.description}</span>
                      </div>
                      <span className={`shrink-0 font-medium ${tx.type === "credit" ? "text-green-400" : "text-red-400"}`}>
                        {tx.type === "credit" ? "+" : "-"}${tx.amountDollars}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment Method Selector */}
              {showPaymentSelector && invoiceId && (
                <div className="mt-3 pt-3 border-t border-[#2a2a35]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#9fa0b8]">Select Payment Method</span>
                    <button
                      onClick={() => { setShowPaymentSelector(false); setInvoiceId(null); setPaymentOrderData(null); }}
                      className="text-xs text-[#9fa0b8] hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                  <PaymentMethodSelector
                    invoiceId={invoiceId}
                    itemCurrency={paymentOrderData?.currency || "USD"}
                    totalAmount={paymentOrderData?.amount || 0}
                    onPaymentInitiated={handlePaymentInitiated}
                    onError={(errMsg) => toast.error(errMsg)}
                    disabled={addingCredits}
                  />
                </div>
              )}
            </SSection>

            {/* 2. Token by Model */}
            <SSection title="Token Consumption — By Model" delay={0.1}>
              <div className="space-y-3 mb-4">
                {effectiveModels.map((m) => {
                  // "Total" shown next to the model name includes
                  // cache-read + cache-write tokens so the number matches
                  // what the agent was actually billed for. Input/output
                  // alone understate the real token volume on anthropic
                  // models by ~10–100× on cold turns.
                  const totalTokens =
                    m.inputTokens + m.outputTokens + m.cacheReadTokens + m.cacheWriteTokens;
                  const maxTok = Math.max(
                    ...effectiveModels.map(
                      (x) => x.inputTokens + x.outputTokens + x.cacheReadTokens + x.cacheWriteTokens,
                    ),
                  );
                  return (
                    <div key={m.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: m.color }} />
                          <span className="text-xs font-medium text-white">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[#9fa0b8]">{sfmt(totalTokens)}</span>
                          <span className="text-xs font-semibold text-brand">${(m.cost ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                      <Progress value={(totalTokens / maxTok) * 100} className="h-1.5" />
                      <div className="flex gap-4 text-xs text-[#9fa0b8] pl-4 flex-wrap">
                        <span>In: {sfmt(m.inputTokens)}</span>
                        {m.outputTokens > 0 && <span>Out: {sfmt(m.outputTokens)}</span>}
                        {m.cacheReadTokens > 0 && <span>Cache R: {sfmt(m.cacheReadTokens)}</span>}
                        {m.cacheWriteTokens > 0 && <span>Cache W: {sfmt(m.cacheWriteTokens)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-[#9fa0b8] mb-2 font-medium">Daily Token Volume</p>
              <ChartContainer config={sTokenDailyCfg} className="h-[130px] w-full mb-4">
                <BarChart data={dailyTokenData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
                  <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => sfmt(v)} tick={TICK} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "#2a2a35", opacity: 0.5 }} />
                  <Bar dataKey="tokens" fill="var(--color-tokens)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
              <p className="text-xs text-[#9fa0b8] mb-2 font-medium">Monthly Token Spend</p>
              <ChartContainer config={sTokenMonthlyCfg} className="h-[130px] w-full">
                <AreaChart data={monthlyTokenCostData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
                  <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={TICK} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "#2a2a35", opacity: 0.5 }} />
                  <Area type="monotone" dataKey="cost" fill="var(--color-cost)" fillOpacity={0.15} stroke="var(--color-cost)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </SSection>

            {/* 4. Total Billing */}
            <SSection title="Total Monthly Bill" delay={0.15}>
              <div className="rounded-lg border border-brand/20 bg-brand/5 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-brand" />
                    <span className="font-semibold text-white">
                      {currentMonth
                        ? `${new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}`
                        : "Estimated Monthly Bill"}
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-white">
                    ${totalMonthlyBill.toFixed(2)}
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    {
                      label: `Token Usage (${currentMonth?.total_models_used ?? effectiveModels.length} models)`,
                      value: `$${aiMonthlyCost.toFixed(2)}`,
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span className="text-[#9fa0b8]">{row.label}</span>
                      <span className="text-white font-medium">{row.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-[#2a2a35] pt-2 flex justify-between text-xs font-semibold">
                    <span className="text-white">Total</span>
                    <span className="text-brand">${totalMonthlyBill.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#9fa0b8] mb-2 font-medium">Billing History</p>
              <ChartContainer config={sBillingCfg} className="h-[160px] w-full">
                <BarChart data={billingHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
                  <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={TICK} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "#2a2a35", opacity: 0.5 }} />
                  <Bar dataKey="tokens" fill="var(--color-tokens)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </SSection>

          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">

            {/* Savings Summary */}
            <SSection title="Savings Overview" delay={0.05}>
              <div className="rounded-lg border border-brand/20 bg-brand/5 p-5 text-center mb-4">
                <p className="text-xs text-[#9fa0b8] mb-1">You&apos;re saving</p>
                <p className="text-4xl font-bold text-brand">${savingsAmount.toFixed(0)}</p>
                <p className="text-xs text-[#9fa0b8] mt-1">per month vs. a human employee</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <TrendingDown className="h-4 w-4 text-brand" />
                  <span className="text-sm font-semibold text-brand">{savingsPct}% cost reduction</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4 text-center">
                  <Zap className="h-5 w-5 text-brand mx-auto mb-2" />
                  <p className="text-lg font-bold text-white">${aiMonthlyCost.toFixed(2)}</p>
                  <p className="text-xs text-[#9fa0b8]">Ai Employee Monthly LLM Cost</p>
                </div>
                <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4 text-center">
                  <Users className="h-5 w-5 text-red-400 mx-auto mb-2" />
                  <p className="text-lg font-bold text-white">${calcHumanCost.toLocaleString()}</p>
                  <p className="text-xs text-[#9fa0b8]">Human Cost</p>
                </div>
              </div>
            </SSection>

            {/* Human Cost Breakdown */}
            <SSection title="Human Equivalent Cost" delay={0.1}>
              <div className="space-y-3 mb-4">
                {[
                  { label: "Estimated Role", value: "Virtual Assistant / Jr. Analyst" },
                  { label: "Avg. Hourly Rate", value: `$${humanRate}/hr` },
                  { label: "Estimated Hours/Month", value: `${humanHours}h` },
                  { label: "Benefits & Overhead (est. 30%)", value: `$${Math.round(calcHumanCost * 0.3).toLocaleString()}` },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-xs">
                    <span className="text-[#9fa0b8]">{row.label}</span>
                    <span className="text-white font-medium">{row.value}</span>
                  </div>
                ))}
                <div className="border-t border-[#2a2a35] pt-2 flex justify-between text-xs font-semibold">
                  <span className="text-white">Total Human Cost</span>
                  <span className="text-red-400">${Math.round(calcHumanCost * 1.3).toLocaleString()}/mo</span>
                </div>
              </div>
              <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e18] p-3">
                <p className="text-xs text-[#9fa0b8]">
                  <span className="text-white font-semibold">Note:</span> Excludes recruiting, training, PTO, and turnover risk — all $0 with an Ai Employee.
                </p>
              </div>
            </SSection>

            {/* Savings Calculator */}
            <SSection title="Savings Calculator" delay={0.15}>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#9fa0b8]">Hourly Rate</span>
                    <span className="font-semibold text-white">${humanRate}/hr</span>
                  </div>
                  <Slider value={[humanRate]} onValueChange={([v]) => setHumanRate(v)} min={15} max={150} step={5} />
                  <div className="flex justify-between text-xs text-[#5a5a72] mt-1"><span>$15</span><span>$150</span></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#9fa0b8]">Hours per Month</span>
                    <span className="font-semibold text-white">{humanHours}h</span>
                  </div>
                  <Slider value={[humanHours]} onValueChange={([v]) => setHumanHours(v)} min={20} max={320} step={10} />
                  <div className="flex justify-between text-xs text-[#5a5a72] mt-1"><span>20h</span><span>320h</span></div>
                </div>
                <div className="rounded-lg border border-brand/20 bg-brand/5 p-4 space-y-3">
                  {[
                    { label: "Human Cost", value: `$${calcHumanCost.toLocaleString()}/mo` },
                    { label: "Ai Employee Cost", value: `$${sTotalMonthly.toFixed(2)}/mo` },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span className="text-[#9fa0b8]">{row.label}</span>
                      <span className="text-white font-medium">{row.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-[#2a2a35] pt-2 flex justify-between">
                    <span className="text-sm font-semibold text-white">Monthly Savings</span>
                    <span className="text-lg font-bold text-brand">${savingsAmount > 0 ? savingsAmount.toFixed(0) : "0"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#9fa0b8]">Annual Savings</span>
                    <span className="font-semibold text-brand">
                      ${savingsAmount > 0 ? (savingsAmount * 12).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}/yr
                    </span>
                  </div>
                </div>
              </div>
            </SSection>

            {/* ROI Projection */}
            <SSection title="ROI Projection (12 Months)" delay={0.2}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <SStatCard icon={TrendingUp} label="Annual Savings" value={`$${(savingsAmount * 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <SStatCard icon={BarChart3} label="ROI" value={`${Math.round((savingsAmount * 12) / (sTotalMonthly * 12) * 100)}%`} />
                <SStatCard icon={Calculator} label="Payback" value="< 1 day" sub="vs. hiring" />
              </div>
              <div className="space-y-2">
                {[1, 3, 6, 12].map((months) => {
                  const humanTotal = calcHumanCost * months;
                  const avatarTotal = sTotalMonthly * months;
                  const saved = humanTotal - avatarTotal;
                  return (
                    <div key={months} className="flex items-center gap-3 text-xs">
                      <span className="text-[#9fa0b8] w-16 shrink-0">{months} {months === 1 ? "month" : "months"}</span>
                      <div className="flex-1">
                        <Progress value={Math.min((saved / humanTotal) * 100, 100)} className="h-1.5" />
                      </div>
                      <span className="text-white font-medium w-24 text-right shrink-0">
                        ${saved > 0 ? saved.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"} saved
                      </span>
                    </div>
                  );
                })}
              </div>
            </SSection>

          </div>
        </div>
      </div>
    </ScrollArea>
    </>
  );
}

// ── Tab bar UI (reusable) ─────────────────────────────────────────────────────

// Tabs employees should never see. Analytics + Savings surface
// org-level financial data; they belong to the founder view only.
const FOUNDER_ONLY_TABS: Set<AgentTabId> = new Set(["analytics", "savings"]);

export function AgentTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: AgentTabId;
  onTabChange: (id: AgentTabId) => void;
}) {
  const { amIFounder } = useAmIFounder();
  const visibleTabs = amIFounder
    ? AGENT_TABS
    : AGENT_TABS.filter((t) => !FOUNDER_ONLY_TABS.has(t.id));
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-[#2a2a35] bg-[#0a0a10] overflow-x-auto shrink-0">
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] whitespace-nowrap transition-all shrink-0 ${activeTab === tab.id
                ? "bg-brand/10 text-brand border border-brand/30"
                : "text-[#9fa0b8] hover:text-white hover:bg-[#15151b]"
              }`}
          >
            <Icon className="h-3 w-3" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
