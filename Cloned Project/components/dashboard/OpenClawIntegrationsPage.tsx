"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getOrgId, getToken } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Plug,
  Loader2,
  X,
  ChevronDown,
  Users,
  Bot,
  Check,
  FileText,
  Clock,
  AlertCircle,
  Unplug,
  RefreshCw,
  Globe,
  Activity,
  ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuthFieldSchema { name: string; label: string; required: boolean; }
interface Endpoint { method: string; path: string; description: string; }

interface DisplayMetadataItem {
  key: string;
  value: string;
  type: "string" | "image_url";
}

interface ConnectedAgent {
  agent_id: string;
  name: string;
  display_metadata?: DisplayMetadataItem[] | null;
}

interface Integration {
  name: string;
  display_name: string;
  api_type: string;
  base_url: string;
  auth_fields: AuthFieldSchema[];
  endpoints: Endpoint[];
  usage_instructions: string;
  connected_agents: ConnectedAgent[];
}

interface AgentOption { agent_id: string; name: string; }

interface LogEntry {
  id: string;
  integration_name: string;
  agent_id: string;
  method: string;
  endpoint: string;
  status_code: number;
  duration_ms: number;
  request_id: string;
  error_message: string | null;
  created_at: string;
}

interface LogState { loading: boolean; data: LogEntry[]; }

type SectionKey = "overview" | "logs" | "assign";

// ── Helpers ────────────────────────────────────────────────────────────────────

function methodBg(method: string) {
  if (method === "GET") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (method === "POST") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (method === "PATCH" || method === "PUT") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (method === "DELETE") return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-[#1a1a25] text-[#9fa0b8] border-[#2a2a35]";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ApiTypePill({ type }: { type: string }) {
  const isOAuth = type?.toLowerCase().startsWith("oauth2");
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${
        isOAuth
          ? "bg-violet-500/10 text-violet-400 border-violet-500/25"
          : "bg-[#1a1a25] text-[#9fa0b8] border-[#2a2a35]"
      }`}
    >
      {isOAuth ? <Globe className="h-2.5 w-2.5" /> : <Plug className="h-2.5 w-2.5" />}
      {type}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

function OpenClawIntegrationsPageInternal() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // per-card UI state
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Record<string, SectionKey>>({});
  const [logStates, setLogStates] = useState<Record<string, LogState>>({});

  // assign state
  const [assignAgentId, setAssignAgentId] = useState("");
  const [assignCreds, setAssignCreds] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState<string | null>(null);
  const [unconnectedAgents, setUnconnectedAgents] = useState<Record<string, { loading: boolean; data: AgentOption[] }>>({});
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const authRef = useRef({ Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" });
  const orgId = getOrgId();

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const urlAg = new URL("/api/openclaw/agent", window.location.origin);
      if (orgId) urlAg.searchParams.set("org_id", orgId);

      const [intRes, agRes] = await Promise.all([
        fetch(`/api/openclaw/integrations${qs}`, { headers: authRef.current }),
        fetch(urlAg.toString(), { headers: authRef.current }),
      ]);
      const intData = await intRes.json();
      const agData = await agRes.json();
      setIntegrations(Array.isArray(intData) ? intData : []);
      setAgents(agData.agents || []);
    } catch {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fetchLogs = useCallback(async (integName: string) => {
    setLogStates((prev) => ({
      ...prev,
      [integName]: { loading: true, data: prev[integName]?.data || [] },
    }));
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const res = await fetch(`/api/openclaw/integrations/${integName}/logs${qs}`, { headers: authRef.current });
      const data = await res.json();
      const logs: LogEntry[] = Array.isArray(data) ? data : data.logs || [];
      setLogStates((prev) => ({ ...prev, [integName]: { loading: false, data: logs } }));
    } catch {
      toast.error("Failed to load logs");
      setLogStates((prev) => ({
        ...prev,
        [integName]: { loading: false, data: prev[integName]?.data || [] },
      }));
    }
  }, []);

  // ── Card interaction ────────────────────────────────────────────────────────

  const toggleExpand = (integName: string) => {
    const willExpand = expandedName !== integName;
    setExpandedName(willExpand ? integName : null);
    if (willExpand) {
      setActiveSection((prev) => ({ ...prev, [integName]: prev[integName] || "overview" }));
    } else {
      resetAssign();
    }
  };

  const fetchUnconnectedAgents = useCallback(async (integName: string) => {
    setUnconnectedAgents((prev) => ({
      ...prev,
      [integName]: { loading: true, data: prev[integName]?.data || [] },
    }));
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const res = await fetch(`/api/openclaw/integrations/${encodeURIComponent(integName)}/unconnected-agents${qs}`, {
        headers: authRef.current,
      });
      const data = await res.json();
      const agents: AgentOption[] = Array.isArray(data)
        ? data.map((a: any) => ({ agent_id: a.agent_id || a.id, name: a.name }))
        : [];
      setUnconnectedAgents((prev) => ({ ...prev, [integName]: { loading: false, data: agents } }));
    } catch {
      setUnconnectedAgents((prev) => ({ ...prev, [integName]: { loading: false, data: [] } }));
    }
  }, []);

  const switchSection = (integName: string, section: SectionKey) => {
    setActiveSection((prev) => ({ ...prev, [integName]: section }));
    if (section === "logs" && !logStates[integName]) {
      fetchLogs(integName);
    }
    if (section === "assign") {
      fetchUnconnectedAgents(integName);
    } else {
      resetAssign();
    }
  };

  const resetAssign = () => {
    setAssignAgentId("");
    setAssignCreds({});
  };

  // ── Test Connection ─────────────────────────────────────────────────────────

  const handleTestConnection = async (integName: string, agentId: string) => {
    const key = `${integName}::${agentId}`;
    setTestingConnection(key);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `&org_id=${orgId}` : "";
      const res = await fetch(
        `/api/openclaw/integrations/${encodeURIComponent(integName)}/test?agent_id=${encodeURIComponent(agentId)}${qs}`,
        { method: "POST", headers: authRef.current }
      );
      const data = await res.json();
      if (data.status === "ok") {
        toast.success(`${integName}: Connection verified`);
      } else if (data.status === "unsupported") {
        toast.info(`Test not available for ${integName}`);
      } else {
        toast.error(`${integName}: ${data.message || "Connection failed"}`);
      }
    } catch {
      toast.error("Failed to test connection");
    } finally {
      setTestingConnection(null);
    }
  };

  // ── Assign / Unassign ───────────────────────────────────────────────────────

  const handleAssign = async (integ: Integration) => {
    if (!assignAgentId) return;
    setAssigning(true);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const isOauth = integ.api_type?.startsWith("oauth2");
      const hasCredentials = !isOauth && Object.keys(assignCreds).some((k) => assignCreds[k]);
      const body: Record<string, unknown> = {
        agent_id: assignAgentId,
        integration_name: integ.name,
        ...(hasCredentials ? { credentials: assignCreds } : {}),
        ...(orgId ? { org_id: orgId } : {}),
      };
      const res = await fetch(`/api/openclaw/integrations${qs}`, {
        method: "POST",
        headers: authRef.current,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.status === "oauth_required" && data.auth_url) {
        const popup = window.open(data.auth_url, "_blank", "width=600,height=800");
        toast.success("OAuth window opened — complete authorization then close the window.");
        switchSection(integ.name, "overview");

        // Listen for the postMessage from the OAuth callback page
        const onMessage = (event: MessageEvent) => {
          if (event.data?.type === "OAUTH_SUCCESS") {
            window.removeEventListener("message", onMessage);
            clearInterval(pollTimer);
            load(true);
            toast.success(`${integ.display_name} connected successfully`);
          }
        };
        window.addEventListener("message", onMessage);

        // Fallback: poll for popup close (in case postMessage doesn't fire)
        const pollTimer = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(pollTimer);
            window.removeEventListener("message", onMessage);
            load(true);
          }
        }, 1000);

        // Safety cleanup after 5 minutes
        setTimeout(() => {
          clearInterval(pollTimer);
          window.removeEventListener("message", onMessage);
        }, 300_000);

        return;
      }
      toast.success("Integration assigned to agent");
      resetAssign();
      await load(true);
      switchSection(integ.name, "overview");
    } catch {
      toast.error("Failed to assign integration");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (integName: string, agentId: string, agentName: string) => {
    const key = `${integName}::${agentId}`;
    setUnassigning(key);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `&org_id=${orgId}` : "";
      const res = await fetch(
        `/api/openclaw/integrations/unassign?agent_id=${encodeURIComponent(agentId)}&integration_name=${encodeURIComponent(integName)}${qs}`,
        { method: "DELETE", headers: authRef.current }
      );
      if (!res.ok) throw new Error();
      setIntegrations((prev) =>
        prev.map((i) =>
          i.name === integName
            ? { ...i, connected_agents: i.connected_agents.filter((a) => a.agent_id !== agentId) }
            : i
        )
      );
      toast.success(`Unassigned "${agentName}" from this integration`);
    } catch {
      toast.error("Failed to unassign integration");
    } finally {
      setUnassigning(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center">
            <Plug className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">AI Integrations</h2>
            <p className="text-xs text-[#9fa0b8]">
              API integrations and external services for your Ai Employees
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-[11px] text-[#9fa0b8] hover:text-white border border-[#2a2a35] rounded-md px-2.5 py-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : integrations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2a2a35] bg-[#0e0e12] p-10 text-center space-y-2">
          <Plug className="h-10 w-10 text-[#9fa0b8] mx-auto" />
          <p className="text-sm text-[#9fa0b8]">No integrations available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((intg) => {
            const isExpanded = expandedName === intg.name;
            const section = activeSection[intg.name] || "overview";
            const isOauth = intg.api_type?.startsWith("oauth2");
            const logState = logStates[intg.name];
            const connectedCount = intg.connected_agents?.length || 0;

            return (
              <div
                key={intg.name}
                className={`rounded-xl border transition-colors duration-200 ${
                  isExpanded
                    ? "border-brand/25 bg-[#0c0c10]"
                    : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a4a]"
                }`}
              >
                {/* ── Card header ────────────────────────────────────────────── */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                  onClick={() => toggleExpand(intg.name)}
                >
                  <div className="h-9 w-9 rounded-lg bg-brand/10 border border-brand/25 flex items-center justify-center shrink-0">
                    <Plug className="h-4 w-4 text-brand" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{intg.display_name}</h3>
                      <ApiTypePill type={intg.api_type} />
                      {connectedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          <Bot className="h-2.5 w-2.5" />
                          {connectedCount} agent{connectedCount !== 1 && "s"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-[#5a5a72] font-mono truncate">{intg.base_url}</span>
                      {intg.endpoints?.length > 0 && (
                        <span className="text-[9px] text-[#5a5a72]">
                          {intg.endpoints.length} endpoint{intg.endpoints.length !== 1 && "s"}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight
                    className={`h-4 w-4 text-[#5a5a72] shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  />
                </div>

                {/* ── Expanded content ────────────────────────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-brand/15">
                    {/* Tab bar */}
                    <div className="flex border-b border-[#2a2a35] px-5">
                      {(["overview", "logs", "assign"] as SectionKey[]).map((tab) => {
                        const labels: Record<SectionKey, React.ReactNode> = {
                          overview: (
                            <span className="flex items-center gap-1.5">
                              <Plug className="h-3 w-3" /> Overview
                            </span>
                          ),
                          logs: (
                            <span className="flex items-center gap-1.5">
                              <Activity className="h-3 w-3" /> Activity Logs
                              {logState && !logState.loading && logState.data.length > 0 && (
                                <span className="ml-0.5 inline-flex items-center justify-center h-3.5 min-w-4 rounded-full bg-[#2a2a35] text-[#9fa0b8] text-[8px] px-1">
                                  {logState.data.length}
                                </span>
                              )}
                            </span>
                          ),
                          assign: (
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3 w-3" /> Assign to Agent
                            </span>
                          ),
                        };
                        return (
                          <button
                            key={tab}
                            onClick={() => switchSection(intg.name, tab)}
                            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                              section === tab
                                ? "border-brand text-brand"
                                : "border-transparent text-[#9fa0b8] hover:text-white"
                            }`}
                          >
                            {labels[tab]}
                          </button>
                        );
                      })}
                    </div>

                    {/* ── Overview tab ─────────────────────────────────────────── */}
                    {section === "overview" && (
                      <div className="px-5 py-4 space-y-5">
                        {/* Usage instructions */}
                        {intg.usage_instructions && (
                          <div className="space-y-1.5">
                            <p className="text-[9px] text-[#5a5a72] uppercase tracking-wider font-medium">Usage Instructions</p>
                            <p className="text-[11px] text-[#9fa0b8] bg-[#13131a] rounded-lg p-3 border border-[#2a2a35] leading-relaxed">
                              {intg.usage_instructions}
                            </p>
                          </div>
                        )}

                        {/* Endpoints */}
                        {intg.endpoints?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[9px] text-[#5a5a72] uppercase tracking-wider font-medium">Endpoints</p>
                            <div className="rounded-lg border border-[#2a2a35] overflow-hidden">
                              {intg.endpoints.map((ep, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-start gap-3 px-3 py-2.5 text-[10px] ${
                                    idx < intg.endpoints.length - 1 ? "border-b border-[#1e1e28]" : ""
                                  } hover:bg-[#13131a] transition-colors`}
                                >
                                  <span className={`font-mono font-bold shrink-0 w-12 text-right ${methodBg(ep.method).split(" ")[1]}`}>
                                    {ep.method}
                                  </span>
                                  <span className="font-mono text-[#c7c7da] shrink-0">{ep.path}</span>
                                  <span className="text-[#5a5a72] ml-auto text-right">{ep.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Connected agents */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-[#5a5a72] uppercase tracking-wider font-medium">
                              Connected Agents ({connectedCount})
                            </p>
                            <button
                              onClick={() => switchSection(intg.name, "assign")}
                              className="flex items-center gap-1 text-[10px] text-brand/70 hover:text-brand transition-colors"
                            >
                              <Users className="h-3 w-3" />
                              + Assign agent
                            </button>
                          </div>
                          {connectedCount === 0 ? (
                            <p className="text-[11px] text-[#5a5a72] italic">No agents connected yet.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {intg.connected_agents.map((a) => {
                                const uKey = `${intg.name}::${a.agent_id}`;
                                const isUnassigning = unassigning === uKey;
                                const metaImages = (a.display_metadata ?? []).filter((m) => m.type === "image_url");
                                const metaStrings = (a.display_metadata ?? []).filter((m) => m.type === "string");
                                const hasMeta = (a.display_metadata ?? []).length > 0;
                                return (
                                  <div
                                    key={a.agent_id}
                                    className="group rounded-lg bg-[#13131a] border border-[#2a2a35] hover:border-[#3a3a4a] transition-colors overflow-hidden"
                                  >
                                    {/* Agent identity row */}
                                    <div className="flex items-center gap-2.5 px-3 py-2">
                                      <Bot className="h-3.5 w-3.5 text-[#9fa0b8] shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-[#c7c7da] truncate">{a.name}</p>
                                        <p className="text-[9px] text-[#3a3a50] font-mono truncate">{a.agent_id}</p>
                                      </div>
                                      <button
                                        onClick={() => handleTestConnection(intg.name, a.agent_id)}
                                        disabled={testingConnection === `${intg.name}::${a.agent_id}`}
                                        title="Test connection"
                                        className="flex items-center gap-1 text-[10px] text-[#5a5a72] hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 shrink-0"
                                      >
                                        {testingConnection === `${intg.name}::${a.agent_id}` ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Activity className="h-3 w-3" />
                                        )}
                                        <span>Test</span>
                                      </button>
                                      <button
                                        onClick={() => handleUnassign(intg.name, a.agent_id, a.name)}
                                        disabled={isUnassigning}
                                        title="Unassign this agent"
                                        className="flex items-center gap-1 text-[10px] text-[#5a5a72] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 shrink-0"
                                      >
                                        {isUnassigning ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Unplug className="h-3 w-3" />
                                        )}
                                        <span>Unassign</span>
                                      </button>
                                    </div>
                                    {/* Connected account metadata */}
                                    {hasMeta && (
                                      <div className="flex items-center gap-2 mx-3 mb-2 px-2.5 py-1.5 rounded-md bg-[#0e0e12] border border-[#2a2a35]">
                                        {metaImages.length > 0 && (
                                          <img
                                            src={metaImages[0].value}
                                            alt={metaImages[0].key}
                                            referrerPolicy="no-referrer"
                                            className="h-5 w-5 rounded-full object-cover shrink-0 ring-1 ring-[#2a2a35]"
                                          />
                                        )}
                                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                          {metaStrings.map((item, i) => (
                                            <span
                                              key={item.key}
                                              className={`truncate ${i === 0 ? "text-[10px] text-[#c7c7da] font-medium" : "text-[9px] text-[#5a5a72] font-mono"}`}
                                            >
                                              {item.value}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Activity Logs tab ────────────────────────────────────── */}
                    {section === "logs" && (
                      <div className="px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] text-[#5a5a72] uppercase tracking-wider font-medium">Activity Logs</p>
                          <button
                            onClick={() => fetchLogs(intg.name)}
                            disabled={logState?.loading}
                            className="flex items-center gap-1 text-[10px] text-[#9fa0b8] hover:text-white border border-[#2a2a35] rounded px-2 py-1 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3 w-3 ${logState?.loading ? "animate-spin" : ""}`} />
                            Reload
                          </button>
                        </div>

                        {!logState || logState.loading ? (
                          <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-brand" />
                          </div>
                        ) : logState.data.length === 0 ? (
                          <div className="py-10 text-center space-y-2">
                            <Activity className="h-8 w-8 text-[#2a2a35] mx-auto" />
                            <p className="text-[11px] text-[#5a5a72]">No activity recorded yet</p>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-[#2a2a35] overflow-hidden">
                            {/* Table header */}
                            <div className="grid grid-cols-[60px_1fr_96px_68px_80px] gap-2 px-3 py-2 bg-[#0e0e12] border-b border-[#2a2a35]">
                              {["Method", "Endpoint", "Agent", "Status", "Time"].map((h) => (
                                <span key={h} className="text-[9px] uppercase tracking-wider text-[#5a5a72] font-medium">{h}</span>
                              ))}
                            </div>
                            {/* Rows */}
                            <div className="divide-y divide-[#1a1a20]">
                              {logState.data.map((log) => {
                                const agentLabel =
                                  intg.connected_agents?.find((a) => a.agent_id === log.agent_id)?.name ??
                                  log.agent_id.slice(-8);
                                const isErr = log.status_code >= 400;
                                return (
                                  <div
                                    key={log.id}
                                    className="grid grid-cols-[60px_1fr_96px_68px_80px] gap-2 items-center px-3 py-2.5 hover:bg-[#13131a] transition-colors"
                                  >
                                    <span className={`inline-flex items-center justify-center font-mono font-bold text-[9px] rounded px-1.5 py-0.5 border ${methodBg(log.method)}`}>
                                      {log.method}
                                    </span>
                                    <span className="font-mono text-[10px] text-[#c7c7da] truncate" title={log.endpoint}>
                                      {log.endpoint}
                                    </span>
                                    <div className="flex items-center gap-1 min-w-0">
                                      <Bot className="h-3 w-3 text-[#5a5a72] shrink-0" />
                                      <span className="text-[10px] text-[#9fa0b8] truncate" title={agentLabel}>{agentLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {isErr
                                        ? <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />
                                        : <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                                      <span className={`font-mono text-[10px] ${isErr ? "text-red-400" : "text-emerald-400"}`}>
                                        {log.status_code}
                                      </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <div className="flex items-center gap-0.5">
                                        <Clock className="h-2.5 w-2.5 text-[#5a5a72] shrink-0" />
                                        <span className="text-[9px] text-[#5a5a72]">{timeAgo(log.created_at)}</span>
                                      </div>
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

                    {/* ── Assign tab ───────────────────────────────────────────── */}
                    {section === "assign" && (
                      <div className="px-5 py-4 space-y-4">
                        <p className="text-[9px] text-[#5a5a72] uppercase tracking-wider font-medium">
                          Assign &ldquo;{intg.display_name}&rdquo; to an agent
                        </p>

                        {/* Agent selector */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-[#c7c7da]">Agent</label>
                          {(() => {
                            const state = unconnectedAgents[intg.name];
                            if (state?.loading) {
                              return (
                                <div className="flex items-center gap-2 rounded-lg bg-[#13131a] border border-[#2a2a35] px-3 py-2.5">
                                  <Loader2 className="h-3.5 w-3.5 text-[#5a5a72] animate-spin shrink-0" />
                                  <p className="text-[11px] text-[#5a5a72]">Loading agents…</p>
                                </div>
                              );
                            }
                            const available = state?.data || [];
                            if (available.length === 0) {
                              return (
                                <div className="flex items-center gap-2 rounded-lg bg-[#13131a] border border-[#2a2a35] px-3 py-2.5">
                                  <Bot className="h-3.5 w-3.5 text-[#5a5a72] shrink-0" />
                                  <p className="text-[11px] text-[#5a5a72] italic">
                                    All agents are already assigned to this integration.
                                  </p>
                                </div>
                              );
                            }
                            return (
                              <select
                                value={assignAgentId}
                                onChange={(e) => setAssignAgentId(e.target.value)}
                                className="w-full rounded-lg bg-[#13131a] border border-[#2a2a35] text-white text-xs p-2.5 focus:outline-none focus:border-brand/40 transition-colors"
                              >
                                <option value="">Select agent…</option>
                                {available.map((a) => (
                                  <option key={a.agent_id} value={a.agent_id}>{a.name}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>

                        {/* OAuth notice or credential fields */}
                        {isOauth ? (
                          <div className="flex items-start gap-3 rounded-lg bg-violet-500/10 border border-violet-500/25 px-3 py-2.5">
                            <Globe className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-violet-300 leading-relaxed">
                              This integration uses OAuth — no credentials required. Clicking &ldquo;Authorize&rdquo; will open an OAuth window.
                            </p>
                          </div>
                        ) : (intg.auth_fields || []).length === 0 ? (
                          <p className="text-[11px] text-[#5a5a72] italic">No credentials required for this integration.</p>
                        ) : (
                          <div className="space-y-3">
                            {(intg.auth_fields || []).map((field) => (
                              <div key={field.name} className="space-y-1.5">
                                <label className="text-[10px] font-medium text-[#c7c7da]">
                                  {field.label}
                                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                                </label>
                                <Input
                                  placeholder={`Enter ${field.label}…`}
                                  value={assignCreds[field.name] || ""}
                                  onChange={(e) => setAssignCreds({ ...assignCreds, [field.name]: e.target.value })}
                                  type={
                                    field.name.toLowerCase().includes("token") ||
                                    field.name.toLowerCase().includes("key") ||
                                    field.name.toLowerCase().includes("secret")
                                      ? "password"
                                      : "text"
                                  }
                                  className="bg-[#13131a] border-[#2a2a35] text-white placeholder:text-[#5a5a72] text-xs h-9 focus:border-brand/40"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => handleAssign(intg)}
                            disabled={
                              assigning ||
                              !assignAgentId ||
                              (!isOauth && intg.auth_fields?.some((f) => f.required && !assignCreds[f.name]))
                            }
                            className="flex-1 h-9 text-xs bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 disabled:opacity-50"
                          >
                            {assigning ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : isOauth ? (
                              <Globe className="h-3.5 w-3.5 mr-1.5" />
                            ) : (
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {isOauth ? "Authorize via OAuth" : "Assign Integration"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => switchSection(intg.name, "overview")}
                            disabled={assigning}
                            className="h-9 px-4 text-xs text-[#9fa0b8] hover:text-white border border-[#2a2a35] hover:border-[#3a3a4a]"
                          >
                            Cancel
                          </Button>
                        </div>
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
  );
}

export default function OpenClawIntegrationsPage() {
  return (
    <OpenClawIntegrationsPageInternal />
  );
}


