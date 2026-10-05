"use client";

import { useEffect, useRef, useState } from "react";
import { getOrgId, getToken, getUserIdFromToken } from "@/lib/auth";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { toast } from "sonner";
import { MessageSquare, Send, Loader2, Bot, ArrowLeft, Monitor, Paperclip, X, ImageIcon } from "lucide-react";

import {
  AgentData,
  AgentTabId,
  AGENT_TABS,
  AgentTabBar,
  TasksTab,
  JobsTab,
  ContextsTab,
  IntegrationsTab,
  NotificationsTab,
  AnalyticsTab,
  SavingsTab,
  useOpenClawWs,
} from "./OpenClawAgentTabs";
import {
  LlmModel,
  LLM_MODEL_LABEL,
  LLM_MODELS_ORDERED,
} from "./OpenClawAgentPage";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachmentPreviews?: string[]; // object URLs for optimistic image display
  _createdAt?: string; // raw ISO timestamp for cursor-based pagination
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Smart date-relative timestamp: "2:30 PM", "Yesterday, 2:30 PM", "Mar 3, 2:30 PM" */
function formatTimestamp(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const resetTime = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
  const msgDay = resetTime(date).getTime();
  const todayDay = resetTime(now).getTime();
  const yesterdayDay = todayDay - 86_400_000;

  if (msgDay === todayDay) return time;
  if (msgDay === yesterdayDay) return `Yesterday, ${time}`;

  const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) dateOpts.year = "numeric";
  return `${date.toLocaleDateString("en-US", dateOpts)}, ${time}`;
}

// ── Activity Feed (real-time agent activity stream) ──────────────────────────

interface ActivityEntry {
  id: string;
  agent_id: string;
  activity_type: string;
  summary: string;
  metadata?: Record<string, any>;
  status: string;
  created_at: string;
}

const ACTIVITY_TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  integration_call:        { color: "text-blue-400",    icon: "API" },
  task_created:            { color: "text-emerald-400", icon: "TSK" },
  task_updated:            { color: "text-amber-400",   icon: "TSK" },
  cron_triggered:          { color: "text-violet-400",  icon: "JOB" },
  cron_run_completed:      { color: "text-violet-300",  icon: "JOB" },
  integration_connected:   { color: "text-emerald-400", icon: "CON" },
  integration_disconnected:{ color: "text-red-400",     icon: "DIS" },
  context_sync_complete:   { color: "text-emerald-400", icon: "CTX" },
  context_sync_failed:     { color: "text-red-400",     icon: "CTX" },
  chat_message_received:   { color: "text-cyan-400",    icon: "MSG" },
  chat_response_sent:      { color: "text-cyan-300",    icon: "RPL" },
  heartbeat:               { color: "text-[#2a2a3a]",   icon: "HB " },
};

function fmtUptime(secs: number) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${secs % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

interface HeartbeatData {
  status: string;
  cpu_percent: number;
  mem_used_mb: number;
  mem_percent: number;
  uptime_seconds: number;
  timestamp: string;
}

function ActivityFeed({ agent, authHeaders }: { agent: AgentData; authHeaders: Record<string, string> }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<"online" | "offline">("online");
  const [heartbeat, setHeartbeat] = useState<HeartbeatData | null>(null);
  // Date range filter (YYYY-MM-DD). Empty strings mean "no bound on
  // that end" — both empty is the default "live feed" behavior.
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  // When a date filter is active the feed is a historical view: WS
  // updates get ignored because new events (by definition "now") are
  // outside the selected past window. Computed from the filter state so
  // we don't have to remember to flip a flag.
  const isHistoricalView = Boolean(fromDate || toDate);

  // Load activity history — filter out heartbeats (they go to the sticky bar)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEntries([]);

    const params = new URLSearchParams({ limit: "200" });
    // Date inputs give us YYYY-MM-DD; expand to full-day bounds so the
    // user sees every event on the selected days inclusive.
    if (fromDate) params.set("from", `${fromDate}T00:00:00Z`);
    if (toDate) params.set("to", `${toDate}T23:59:59Z`);

    fetch(`/api/openclaw/agents/${agent.agent_id}/activity?${params}`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          const reversed = data.reverse();
          // Separate heartbeats from real events
          const realEvents = reversed.filter((e: ActivityEntry) => e.activity_type !== "heartbeat");
          setEntries(realEvents);
          // Derive status from last heartbeat — only meaningful in live
          // view, but no harm in updating it from a historical fetch if
          // the selected range happens to include recent data.
          const lastHb = [...reversed].reverse().find((e: ActivityEntry) => e.activity_type === "heartbeat");
          if (lastHb) {
            setAgentStatus(lastHb.status === "offline" ? "offline" : "online");
            setHeartbeat({
              status: lastHb.status,
              cpu_percent: lastHb.metadata?.cpu_percent ?? 0,
              mem_used_mb: lastHb.metadata?.mem_used_mb ?? 0,
              mem_percent: lastHb.metadata?.mem_percent ?? 0,
              uptime_seconds: lastHb.metadata?.uptime_seconds ?? 0,
              timestamp: lastHb.created_at,
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agent.agent_id, fromDate, toDate]);

  // WebSocket — heartbeats update sticky bar, real events go to feed.
  // In historical view we still let heartbeats through (agent-status dot
  // should stay live even when the user is looking at old logs), but we
  // drop real-time events so they don't mix into the historical feed.
  useOpenClawWs("/api/activity/ws", (event, data) => {
    if (event !== "agent_activity" || data?.agent_id !== agent.agent_id) return;
    const entry = data as ActivityEntry;

    if (entry.activity_type === "heartbeat") {
      setAgentStatus(entry.status === "offline" ? "offline" : "online");
      setHeartbeat({
        status: entry.status,
        cpu_percent: entry.metadata?.cpu_percent ?? 0,
        mem_used_mb: entry.metadata?.mem_used_mb ?? 0,
        mem_percent: entry.metadata?.mem_percent ?? 0,
        uptime_seconds: entry.metadata?.uptime_seconds ?? 0,
        timestamp: entry.created_at,
      });
    } else if (!isHistoricalView) {
      setEntries((prev) => [...prev.slice(-199), entry]);
    }
  });

  // Auto-scroll
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch { return ""; }
  };

  const statusDot = agentStatus === "online" ? "bg-emerald-400" : "bg-red-400";

  // Shared styling for the two native date inputs. The `color-scheme:
  // dark` hint makes Chrome/Safari render the calendar popup + the
  // year-spinner/clear-icon against a dark background, so they stop
  // looking like a white pill in the middle of a terminal theme.
  const dateInputClass =
    "bg-transparent text-[10px] text-[#8a8aa2] font-mono border-none outline-none px-0 py-0 cursor-pointer hover:text-[#c8c8d8] [color-scheme:dark]";

  return (
    <div className="flex flex-col h-full bg-[#080810]">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1a1a25] bg-[#0e0e18]">
        {/* Window dots + title */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block" />
          </div>
          <span className="text-xs text-[#5a5a72] font-mono ml-2">
            {agent.name.toLowerCase().replace(/\s+/g, "-")}.activity
          </span>
        </div>

        {/* Inline date-range filter, styled as a terminal argument list */}
        <div className="flex items-center gap-1.5 text-[10px] text-[#5a5a72] font-mono ml-2">
          <span className="text-[#3a3a4a]">--from</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            max={toDate || undefined}
            className={dateInputClass}
          />
          <span className="text-[#3a3a4a]">--to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            min={fromDate || undefined}
            className={dateInputClass}
          />
          {isHistoricalView && (
            <button
              type="button"
              onClick={() => { setFromDate(""); setToDate(""); }}
              className="ml-1 text-[#5a5a72] hover:text-violet-300 transition-colors"
              title="Clear filter"
            >
              [clear]
            </button>
          )}
        </div>

        {/* Live / Historical / Offline indicator */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot} inline-block ${isHistoricalView ? "" : "animate-pulse"}`} />
          <span className="text-[10px] text-[#5a5a72] font-mono">
            {isHistoricalView ? "historical" : agentStatus === "online" ? "live" : "offline"}
          </span>
        </div>
      </div>
      {isHistoricalView && entries.length >= 200 && (
        <div className="px-4 py-1 border-b border-[#1a1a25] bg-[#0a0a12] text-[10px] text-amber-400/70 font-mono">
          showing 200 most-recent in range — narrow the window to see older rows
        </div>
      )}
      {/* Scrollable activity feed — real events only, no heartbeats */}
      <div
        ref={ref}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed space-y-0.5"
        style={{ background: "hsl(220,25%,4%)" }}
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-[#5a5a72] text-center py-8">Waiting for activity...</div>
        ) : (
          entries.map((entry, i) => {
            const cfg = ACTIVITY_TYPE_CONFIG[entry.activity_type] || { color: "text-[#5a5a72]", icon: "---" };
            const isError = entry.status === "error";
            const meta = entry.metadata || {};

            return (
              <div key={entry.id || i} className={`flex gap-2 py-0.5 ${isError ? "bg-red-500/5" : ""}`}>
                <span className="text-[#3a3a4a] shrink-0">{fmtTime(entry.created_at)}</span>
                <span className={`shrink-0 font-bold ${isError ? "text-red-400" : cfg.color}`}>
                  [{cfg.icon}]
                </span>
                <span className={isError ? "text-red-300" : "text-[#c8c8d8]"}>
                  {entry.summary}
                  {meta.status_code != null && (
                    <span className={`ml-1 ${meta.status_code >= 400 ? "text-red-400" : "text-emerald-500"}`}>
                      {meta.status_code}
                    </span>
                  )}
                  {meta.duration_ms != null && (
                    <span className="text-[#5a5a72] ml-1">{meta.duration_ms}ms</span>
                  )}
                </span>
              </div>
            );
          })
        )}
        <div className="text-[#5a5a72]">
          <span className="inline-block w-2 h-3.5 bg-violet-400 ml-0.5 align-middle animate-pulse" style={{ animationDuration: "800ms" }} />
        </div>
      </div>
      {/* Sticky heartbeat bar — always visible at bottom, never scrolls */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-[#1a1a25] bg-[#0e0e18] text-[10px] font-mono">
        <div className="flex items-center gap-3 text-[#5a5a72]">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot} inline-block animate-pulse`} />
            <span className={agentStatus === "online" ? "text-emerald-500" : "text-red-400"}>
              {agentStatus.toUpperCase()}
            </span>
          </div>
          {heartbeat && (
            <>
              <span>cpu {heartbeat.cpu_percent}%</span>
              <span>mem {heartbeat.mem_used_mb}MB ({heartbeat.mem_percent}%)</span>
              <span>up {fmtUptime(heartbeat.uptime_seconds)}</span>
            </>
          )}
        </div>
        <span className="text-[#5a5a72]">{entries.length} events</span>
      </div>
    </div>
  );
}

// ── Controller tab (chat + live activity) ────────────────────────────────────

function ControllerTab({
  agent,
  messages,
  loadingHistory,
  loadingOlder,
  loadOlderMessages,
  sending,
  input,
  setInput,
  handleSend,
  scrollRef,
  attachments,
  setAttachments,
  fileInputRef,
  authHeaders,
  chatModelOverride,
  setChatModelOverride,
}: {
  agent: AgentData;
  messages: ChatMessage[];
  loadingHistory: boolean;
  loadingOlder: boolean;
  loadOlderMessages: () => void;
  sending: boolean;
  input: string;
  setInput: (v: string) => void;
  handleSend: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  attachments: File[];
  setAttachments: React.Dispatch<React.SetStateAction<File[]>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  authHeaders: Record<string, string>;
  chatModelOverride: LlmModel | "";
  setChatModelOverride: (m: LlmModel | "") => void;
}) {
  // Object URLs for previewing selected images
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = attachments.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [attachments]);
  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* Chat panel */}
      <div className="flex flex-col w-[42%] border-r border-[#2a2a35] bg-[#0a0a10]">
        <div className="px-4 py-2.5 border-b border-[#1a1a22]">
          <p className="text-[10px] font-semibold text-[#9fa0b8] uppercase tracking-wider">
            Chat with {agent.name.toUpperCase()}
          </p>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={(e) => {
            // Trigger lazy-load when the user scrolls within 60px of the top.
            const el = e.currentTarget;
            if (el.scrollTop < 60) {
              loadOlderMessages();
            }
          }}
        >
          {/* "Loading older…" spinner at the very top of the scroll area */}
          {loadingOlder && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#9fa0b8]" />
            </div>
          )}
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2 py-8">
              <Bot className="h-8 w-8 text-[#2a2a35]" />
              <p className="text-xs text-[#9fa0b8] text-center">Start a conversation</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : "bg-[#15151b] border border-[#2a2a35] text-[#c7c7da] rounded-bl-sm"
                    }`}
                >
                  {msg.attachmentPreviews && msg.attachmentPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.attachmentPreviews.map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt={`attachment-${i}`}
                          className="h-20 w-20 object-cover rounded-lg border border-violet-500/30"
                        />
                      ))}
                    </div>
                  )}
                  {msg.content ? (
                    <p className="whitespace-pre-wrap wrap-break-word">{msg.content}</p>
                  ) : msg.role === "assistant" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#9fa0b8]" />
                  ) : null}
                  {msg.timestamp && (
                    <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-violet-200/60" : "text-[#9fa0b8]"}`}>
                      {msg.timestamp}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-[#1a1a22] bg-[#0a0a10]">
          {/* Image previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-2.5">
              {attachments.map((file, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrls[i]}
                    alt={file.name}
                    className="h-16 w-16 object-cover rounded-lg border border-[#2a2a35]"
                  />
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5 text-[#9fa0b8]" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/60 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[8px] text-[#9fa0b8] truncate">{file.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="p-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length) setAttachments((prev) => [...prev, ...files]);
                e.target.value = "";
              }}
            />
            {/* Per-turn model override. Defaults to the agent's locked model;
                empty = use agent default. Shown above the input so users can
                see their choice before sending. Only models matching the
                agent's provider (derived from llm_model's prefix) are listed. */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-[#9fa0b8] font-medium uppercase tracking-wider">Model</span>
              <select
                value={chatModelOverride}
                onChange={(e) => setChatModelOverride(e.target.value as LlmModel | "")}
                className="flex-1 h-7 rounded-md bg-[#15151b] border border-[#2a2a35] text-[#c7c7da] text-[11px] px-2 outline-none focus:border-violet-500/50"
                title="Override the model for your next message. Empty = use this agent's default."
              >
                <option value="">
                  Default{agent.llm_model ? ` (${LLM_MODEL_LABEL[agent.llm_model as LlmModel] ?? agent.llm_model})` : ""}
                </option>
                {LLM_MODELS_ORDERED.filter((m) => {
                  const provider = agent.llm_model?.split("/")[0] ?? "openai";
                  return m.startsWith(`${provider}/`);
                }).map((m) => (
                  <option key={m} value={m}>{LLM_MODEL_LABEL[m]}</option>
                ))}
              </select>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 h-9 w-9 p-0 text-[#9fa0b8] hover:text-violet-400 hover:bg-[#15151b]"
                title="Attach images"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={attachments.length > 0 ? `Add a message (optional)...` : `Message ${agent.name}...`}
                className="bg-[#15151b] border-[#2a2a35] text-white placeholder:text-[#9fa0b8] text-sm h-9"
              />
              <Button
                type="submit"
                disabled={sending || (!input.trim() && attachments.length === 0)}
                className="shrink-0 h-9 w-9 p-0 bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
      {/* Live Activity Feed */}
      <div className="flex-1 overflow-hidden">
        <ActivityFeed agent={agent} authHeaders={authHeaders} />
      </div>
    </div>
  );
}

// ── Agent-switch chat cache ──────────────────────────────────────────────────
// Keep each agent's currently-loaded message list + hasMore flag in
// memory so hopping between agents (or opening the Controller tab after
// a side trip to Contexts / Tasks) doesn't re-fetch the first page every
// time. Module-level so the cache persists across component unmounts
// within the same browser session; cleared automatically on page reload,
// which is fine — first fetch after reload repopulates it.
//
// Cache is KEY'D BY agentId alone. Multi-user scoping is fine because
// the backend already filters by req.user.userId — each user sees their
// own slice; another user's cache can't leak across a logout because
// this is module state scoped to the running JS context.
const _agentChatCache = new Map<string, { messages: ChatMessage[]; hasMore: boolean }>();

// ── Main page ─────────────────────────────────────────────────────────────────

function OpenClawChatPageInternal({
  initialAgent,
  onBack,
}: {
  initialAgent?: AgentData;
  onBack?: () => void;
} = {}) {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(initialAgent ?? null);
  const [activeTab, setActiveTab] = useState<AgentTabId>("controller");
  const { amIFounder } = useAmIFounder();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  // Per-turn model override. ``""`` = use the agent's locked default
  // (``selectedAgent.llm_model``). Reset on agent switch so the picker
  // doesn't leak a previous agent's choice.
  const [chatModelOverride, setChatModelOverride] = useState<LlmModel | "">("");
  useEffect(() => { setChatModelOverride(""); }, [selectedAgent?.agent_id]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orgId = getOrgId();

  const authHeaders = {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
  const userId = getUserIdFromToken() || "default-user";

  /** Number of messages per page. Keep in sync with backend default. */
  const PAGE_SIZE = 30;

  // Load agents
  useEffect(() => {
    const load = async () => {
      try {
        const url = new URL("/api/openclaw/agent", window.location.origin);
        if (orgId) url.searchParams.set("org_id", orgId);
        const res = await fetch(url.toString(), { headers: authHeaders });
        const data = await res.json();
        setAgents(data.agents || []);
      } catch { toast.error("Failed to load Ai Employees"); }
      finally { setLoading(false); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parse one raw message from the backend into our ChatMessage shape.
  const parseMsg = (m: any): ChatMessage => ({
    id: m.id || m._id || String(Math.random()),
    role: m.role === "assistant" || m.role === "avatar" ? "assistant" : "user",
    content: m.content || "",
    timestamp: m.createdAt ? formatTimestamp(m.createdAt) : "",
    _createdAt: m.createdAt, // keep raw ISO for the cursor
  });

  // Fetch a page of messages. Returns { msgs, hasMore }.
  const fetchPage = async (agentId: string, before?: string) => {
    const url = new URL("/api/openclaw/messages", window.location.origin);
    url.searchParams.set("agentId", agentId);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (orgId) url.searchParams.set("org_id", orgId);
    if (before) url.searchParams.set("before", before);
    const res = await fetch(url.toString(), { headers: authHeaders });
    const data = await res.json();
    const raw: any[] = Array.isArray(data) ? data : data.messages || [];
    return {
      msgs: raw.map(parseMsg),
      hasMore: data.hasMore === true,
    };
  };

  // Derive a sortable timestamp. Prefers the explicit _createdAt;
  // falls back to decoding the unix-seconds prefix of a Mongo ObjectId
  // (first 4 bytes = creation time). Rows that somehow lost their
  // createdAt still sort into a sensible position instead of getting
  // pinned to the top at epoch 0.
  const getCreatedAtMs = (m: ChatMessage): number => {
    if (m._createdAt) {
      const t = new Date(m._createdAt).getTime();
      if (!Number.isNaN(t)) return t;
    }
    if (typeof m.id === "string" && /^[0-9a-f]{24}$/i.test(m.id)) {
      return parseInt(m.id.substring(0, 8), 16) * 1000;
    }
    return 0;
  };

  // Sort ascending (oldest first). Pagination's cursor depends on
  // messages[0] being the true oldest row, so we re-sort on every
  // mutation that touches the array.
  const sortByCreatedAt = (arr: ChatMessage[]): ChatMessage[] =>
    [...arr].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b));

  // Initial load — hydrate from cache instantly if we've seen this agent
  // before this session, then fetch fresh only when cache is empty.
  // A cache hit means switching agents feels instant; new sockets.io
  // messages will flow in anyway via the live subscription below so we
  // don't risk showing stale data for long.
  useEffect(() => {
    if (!selectedAgent) { setMessages([]); setHasMore(false); return; }

    const cached = _agentChatCache.get(selectedAgent.agent_id);
    if (cached) {
      // Re-sort on hydration — defensive against any stale state that
      // slipped in before the sort invariant was enforced.
      setMessages(sortByCreatedAt(cached.messages));
      setHasMore(cached.hasMore);
      setLoadingHistory(false);
      return;
    }

    const load = async () => {
      setLoadingHistory(true);
      try {
        const { msgs, hasMore: more } = await fetchPage(selectedAgent.agent_id);
        const sorted = sortByCreatedAt(msgs);
        setMessages(sorted);
        setHasMore(more);
        _agentChatCache.set(selectedAgent.agent_id, { messages: sorted, hasMore: more });
      } catch { /* history optional */ }
      finally { setLoadingHistory(false); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent]);

  // Sync any in-place updates (pagination, live socket, optimistic send)
  // back to the cache so a subsequent agent-switch shows the exact state
  // the user left. Runs after every render that changes messages.
  useEffect(() => {
    if (!selectedAgent) return;
    _agentChatCache.set(selectedAgent.agent_id, { messages, hasMore });
  }, [selectedAgent, messages, hasMore]);

  // Load older messages when user scrolls to the top.
  // Ref to hold the scroll height before a prepend, so we can restore
  // scroll position after React flushes the DOM update.
  const prePrependScrollHeightRef = useRef<number | null>(null);

  // After a prepend (older messages inserted at top), restore scroll
  // position so the user stays where they were reading. This runs as a
  // useEffect (after DOM flush) rather than requestAnimationFrame
  // (which fires before React commits), so the new messages are already
  // rendered when we adjust scrollTop.
  useEffect(() => {
    const saved = prePrependScrollHeightRef.current;
    if (saved !== null && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight - saved;
      prePrependScrollHeightRef.current = null;
    }
  });

  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore || !selectedAgent || messages.length === 0) return;
    // The cursor must be the oldest message's timestamp — scan the whole
    // array for the min createdAt rather than trusting messages[0]. Live
    // appends / optimistic inserts can leave the array briefly unsorted;
    // computing min() defensively prevents the pagination from stalling
    // when messages[0] happens to be a newer row.
    let beforeMs = Infinity;
    for (const m of messages) {
      if (!m._createdAt) continue;
      const t = new Date(m._createdAt).getTime();
      if (t < beforeMs) beforeMs = t;
    }
    if (!isFinite(beforeMs)) return;
    const before = new Date(beforeMs).toISOString();

    setLoadingOlder(true);
    // Snapshot scroll height BEFORE the state update so the post-render
    // effect can compute the correct delta.
    prePrependScrollHeightRef.current = scrollRef.current?.scrollHeight || 0;
    try {
      const { msgs, hasMore: more } = await fetchPage(selectedAgent.agent_id, before);
      setHasMore(more);
      // Merge + sort so the array stays monotonically ordered regardless
      // of any timestamp ties between the page and what's already loaded.
      setMessages((prev) => sortByCreatedAt([...msgs, ...prev]));
      // Scroll restoration happens in the useEffect above (after DOM flush).
    } catch {
      prePrependScrollHeightRef.current = null;
    }
    finally { setLoadingOlder(false); }
  };

  // Listen for real-time messages from the backend via Socket.IO
  useEffect(() => {
    if (!selectedAgent) return;
    const socket = connectSocket();

    const handleNewMessage = (data: {
      agentId: string;
      role: string;
      content: string;
      createdAt?: string;
      _id?: string;
    }) => {
      // Only append messages for the currently selected agent
      if (data.agentId !== selectedAgent.agent_id) return;
      // Only handle assistant messages (user messages are added optimistically)
      if (data.role !== "assistant") return;

      const createdAt = data.createdAt || new Date().toISOString();
      setMessages((prev) => sortByCreatedAt([
        ...prev,
        {
          id: data._id || `rt-${Date.now()}`,
          role: "assistant",
          content: data.content,
          timestamp: formatTimestamp(createdAt),
          _createdAt: createdAt, // needed as pagination cursor source
        },
      ]));
    };

    socket.on("openclaw:new-message", handleNewMessage);
    return () => { socket.off("openclaw:new-message", handleNewMessage); };
  }, [selectedAgent]);

  // Auto-scroll to bottom ONLY when the newest (last) message changes —
  // i.e., user sends, assistant replies, or initial load. When older
  // messages are prepended at the top (lazy-load scroll-up), the last
  // message stays the same so we DON'T scroll.
  const prevLastMsgIdRef = useRef<string | number | null>(null);
  useEffect(() => {
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : null;
    const prevLastId = prevLastMsgIdRef.current;
    prevLastMsgIdRef.current = lastId;

    // Scroll to bottom when:
    // - Initial load (prevLastId was null, now we have messages)
    // - New message appended at the end (lastId changed)
    // Do NOT scroll when:
    // - Older messages prepended at the top (lastId stays the same)
    if (lastId !== prevLastId) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 0);
    }
  }, [messages]);

  // Also scroll to bottom when switching tabs back to the chat
  useEffect(() => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 0);
  }, [activeTab]);

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || sending || !selectedAgent) return;
    const text = input.trim();
    const now = new Date();
    const ts = formatTimestamp(now);
    const userMsgId = Date.now();
    const replyId = userMsgId + 1;

    // Snapshot attachment previews for the message bubble before clearing
    const pendingFiles = [...attachments];
    const attachmentPreviews = pendingFiles.map((f) => URL.createObjectURL(f));

    const nowIso = now.toISOString();
    // Give the placeholder reply a slightly-later timestamp so both
    // optimistic rows stay in send-order after any future sort pass.
    const replyIso = new Date(now.getTime() + 1).toISOString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text, timestamp: ts, attachmentPreviews, _createdAt: nowIso },
      { id: replyId, role: "assistant", content: "", timestamp: ts, _createdAt: replyIso },
    ]);
    setInput("");
    setAttachments([]);
    setSending(true);

    try {
      // Always use multipart — the route handles files-optional naturally
      const formData = new FormData();
      formData.append("message", text || "Please describe the attached image(s).");
      formData.append("userId", userId);
      if (orgId) formData.append("orgId", orgId);
      formData.append("personalAgentId", selectedAgent.agent_id);
      // use userId as sessionId so that each user has only one sessionId for chat
      formData.append("sessionId", userId);
      // Per-turn model override. When empty, OpenClawApi falls back to
      // the agent's locked default (or the gateway primary if unset).
      if (chatModelOverride) {
        formData.append("model", chatModelOverride);
      }
      for (const file of pendingFiles) {
        formData.append("files", file, file.name);
      }

      const url = new URL("/api/openclaw/chat", window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data?.error || `Error ${res.status}`;
        if (res.status === 402) {
          toast.error("Insufficient credits — please top up your balance to continue.");
        } else if (res.status === 403) {
          toast.error("Agent subscription is locked. Please renew to continue.");
        } else {
          toast.error(errMsg);
        }
        setMessages((prev) => prev.filter((m) => m.id !== replyId));
        return;
      }

      const replyContent = data.response || "(no response)";
      const replyTs = formatTimestamp(new Date());
      setMessages((prev) => prev.map((m) => m.id === replyId ? { ...m, content: replyContent, timestamp: replyTs } : m));

      // Persist both messages to backend (fire-and-forget)
      api("/openclaw-messages", {
        method: "POST",
        body: JSON.stringify({
          agentId: selectedAgent.agent_id,
          sessionId: userId,
          messages: [
            { role: "user", content: text || "[Image attachment]" },
            { role: "assistant", content: replyContent },
          ],
        }),
      }).catch(() => { });
    } catch {
      toast.error("Failed to send message — please check your connection.");
      setMessages((prev) => prev.filter((m) => m.id !== replyId));
    } finally { setSending(false); }
  };

  // ── Agent selection ──────────────────────────────────────────────────────────
  if (!selectedAgent) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Chat with Ai Employee</h2>
            <p className="text-xs text-[#9fa0b8]">Select an Ai Employee to open the controller</p>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0e0e12] p-8 text-center space-y-2">
            <Bot className="h-10 w-10 text-[#9fa0b8] mx-auto" />
            <p className="text-sm text-[#9fa0b8]">No Ai Employees found. Create one in the Ai Employees tab first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => (
              <button
                key={agent.agent_id}
                onClick={() => { setSelectedAgent(agent); setActiveTab("controller"); }}
                className="w-full text-left p-4 rounded-lg border border-[#2a2a35] bg-[#0e0e12] hover:border-violet-500/30 hover:bg-[#15151b] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center border border-brand/40 shrink-0 ${agent.emoji ? "text-lg" : "text-brand text-sm font-bold"}`}>
                    {agent.emoji || agent.name?.charAt(0)?.toUpperCase() || "A"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{agent.name}</div>
                    <div className="text-[10px] text-[#9fa0b8] truncate">{agent.role || "AI Employee"}</div>
                  </div>
                  <MessageSquare className="h-4 w-4 text-[#9fa0b8] group-hover:text-violet-400 transition-colors shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Agent controller (tabbed) ────────────────────────────────────────────────
  return (
    <div className="flex flex-col rounded-lg border border-[#2a2a35] overflow-hidden" style={{ height: "calc(100vh - 140px)", minHeight: "600px" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#2a2a35] bg-[#0e0e12] shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (onBack) {
              onBack();
            } else {
              setSelectedAgent(null);
            }
          }}
          className="text-xs text-[#9fa0b8] hover:text-white h-7 px-2 gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className={`w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center border border-brand/40 shrink-0 ${selectedAgent.emoji ? "text-sm" : "text-brand text-[10px] font-bold"}`}>
          {selectedAgent.emoji || selectedAgent.name?.charAt(0)?.toUpperCase() || "A"}
        </div>
        <span className="text-xs font-semibold text-white uppercase tracking-wide">{selectedAgent.name}</span>
        <span className="text-[10px] text-[#9fa0b8]">— {selectedAgent.role || "AI Employee"}</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
          <span className="text-[10px] text-[#9fa0b8]">Active</span>
        </div>
      </div>

      {/* Tab navigation */}
      <AgentTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "controller" ? (
        <ControllerTab
          agent={selectedAgent}
          messages={messages}
          loadingHistory={loadingHistory}
          loadingOlder={loadingOlder}
          loadOlderMessages={loadOlderMessages}
          sending={sending}
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          scrollRef={scrollRef as React.RefObject<HTMLDivElement>}
          attachments={attachments}
          setAttachments={setAttachments}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
          authHeaders={authHeaders}
          chatModelOverride={chatModelOverride}
          setChatModelOverride={setChatModelOverride}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "tasks" && <TasksTab agent={selectedAgent} authHeaders={authHeaders} />}
          {activeTab === "jobs" && <JobsTab agent={selectedAgent} authHeaders={authHeaders} />}
          {activeTab === "contexts" && <ContextsTab agent={selectedAgent} authHeaders={authHeaders} />}
          {activeTab === "integrations" && <IntegrationsTab agent={selectedAgent} authHeaders={authHeaders} />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "analytics" && amIFounder && (
            <AnalyticsTab agent={selectedAgent} authHeaders={authHeaders} />
          )}
          {activeTab === "savings" && amIFounder && <SavingsTab agent={selectedAgent} />}
        </div>
      )}
    </div>
  );
}

export default function OpenClawChatPage(props?: { initialAgent?: AgentData; onBack?: () => void }) {
  return (
    <OpenClawChatPageInternal {...props} />
  );
}
