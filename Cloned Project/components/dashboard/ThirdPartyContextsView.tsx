"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Zap,
  Users,
  Trash2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserPlus,
  UserMinus,
  ChevronDown,
  X,
  Database,
  Activity,
  Plug,
} from "lucide-react";
import { getOrgId } from "@/lib/auth";
import { useOpenClawWs } from "@/components/dashboard/OpenClawAgentTabs";

interface AgentData {
  agent_id: string;
  name: string;
}

interface MappedAgent {
  agent_id: string;
  name: string;
}

interface CompletedContext {
  id: string;
  agent_id: string;
  integration_name: string;
  integration_display_name?: string;
  status: string;
  integration_metadata: any;
  mapped_agents: MappedAgent[];
  created_at: string;
}

/* ─── Shared primitives ───────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black tracking-[0.12em] uppercase text-[#5a5a72] mb-2">
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}

function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-5 h-5 rounded-full bg-brand text-brand-foreground text-[9px] font-black flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="text-[10px] font-black uppercase tracking-widest text-[#5a5a72]">{label}</span>
    </div>
  );
}

/* ─── Delete Task Row ─────────────────────────────────────────── */

function DeleteTaskRow({ task, onDone }: { task: any; onDone: (taskId: string) => void }) {
  const [progress, setProgress] = useState<any>({
    status: task.status || "STARTED",
    stage: task.stage || "initializing",
    message: task.message || "Initializing purge...",
    percentage: 0,
  });

  useOpenClawWs("/api/tasks/ws", (event, data) => {
    if (event !== "task_progress") return;
    if (data?.task_id !== task.task_id) return;
    setProgress((prev: any) => ({ ...prev, ...data }));
    const status = (data.status || "").toUpperCase();
    if (status === "SUCCESS" || data.stage === "complete") {
      setTimeout(() => onDone(task.task_id), 3000);
    }
  });

  const isDone = progress.stage === "complete" || progress.status === "SUCCESS";
  const isErr = progress.status === "FAILED" || progress.status === "FAILURE";
  const pct = progress.percentage ?? 0;

  return (
    <div className={`rounded-xl p-4 border transition-all ${isErr ? "bg-red-500/5 border-red-500/20" : isDone ? "bg-green-500/5 border-green-500/20" : "bg-[#0c0c12] border-[#161620]"}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${isErr ? "bg-red-500/10" : isDone ? "bg-green-500/10" : "bg-red-500/5"}`}>
          {isErr ? <AlertCircle className="h-3.5 w-3.5 text-red-400" /> : isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Trash2 className="h-3.5 w-3.5 text-red-400 animate-pulse" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-white">Purging <span className="text-red-400">{task.integration}</span></p>
          <p className="text-[10px] text-[#5a5a72] truncate mt-0.5">{progress.message}</p>
        </div>
        {isDone && <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">Done</span>}
      </div>
      <div className="h-1 bg-[#1e1e2a] rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-700 ${isErr ? "bg-red-500" : isDone ? "bg-green-500" : "bg-red-500 animate-pulse"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[9px] text-[#3a3a50] font-medium uppercase tracking-wider">
        <span>{progress.stage}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

/* ─── Sync Task Row ───────────────────────────────────────────── */

function SyncTaskRow({ task, agents, authCurrent, onCancel, onComplete }: {
  task: any; agents: AgentData[]; authCurrent: any;
  onCancel: (taskId: string) => void; onComplete: () => void;
}) {
  const [progress, setProgress] = useState<any>(task);
  const [canceling, setCanceling] = useState(false);

  const agent = useMemo(() => agents.find((a) => a.agent_id === task.agent_id), [agents, task.agent_id]);

  useOpenClawWs("/api/tasks/ws", (event, data) => {
    if (event !== "task_progress") return;
    if (data?.task_id !== task.task_id) return;
    setProgress((prev: any) => ({ ...prev, ...data }));
    if (["SUCCESS", "FAILED", "REVOKED"].includes(data.status)) {
      if (data.status === "SUCCESS") onComplete();
    }
  });

  const handleCancel = async () => {
    setCanceling(true);
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      await fetch(`/api/openclaw/contexts/ram/task/${task.task_id}${qs}`, { method: "DELETE", headers: authCurrent });
      onCancel(task.task_id);
      toast.success("Task stopped");
    } catch { toast.error("Failed to cancel"); }
    finally { setCanceling(false); }
  };

  const pct = progress.percentage ?? 0;
  const current = progress.current ?? 0;
  const total = progress.total ?? 0;
  const isActive = !["SUCCESS", "FAILED", "REVOKED"].includes(progress.status);

  return (
    <div className="bg-[#0c0c12] border border-[#161620] rounded-xl p-4 hover:border-brand/20 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/5 border border-brand/10 shrink-0">
            <RefreshCw className="h-3.5 w-3.5 text-brand animate-spin" style={{ animationDuration: "3s" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white">{progress.integration || "Syncing"}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-brand/10 text-brand border border-brand/15 font-black uppercase tracking-wider animate-pulse">
                {progress.status || "RUNNING"}
              </span>
            </div>
            <p className="text-[10px] text-[#5a5a72] mt-0.5 flex items-center gap-1">
              <Users className="h-2.5 w-2.5" /> {agent?.name || "Unknown Agent"}
            </p>
          </div>
        </div>
        {isActive && (
          <button onClick={handleCancel} disabled={canceling} className="p-1.5 rounded-lg text-[#3a3a50] hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/15 transition-all disabled:opacity-50">
            {canceling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[9px]">
          <span className="text-[#5a5a72]">
            {progress.stage === "fetching" ? "Collecting" : "Indexing"} ·{" "}
            <span className="text-white">{current.toLocaleString()} / {total.toLocaleString()}</span>
          </span>
          <span className="text-brand font-bold">{pct}%</span>
        </div>
        <div className="h-1 bg-[#1e1e2a] rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all duration-500 relative" style={{ width: `${pct}%` }}>
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
        <p className="text-[9px] text-[#3a3a50] italic truncate">{progress.message}</p>
      </div>
    </div>
  );
}

/* ─── Agent Assignment Panel ─────────────────────────────────── */

function AgentAssignmentPanel({ contextId, authCurrent, onDone, onClose }: {
  contextId: string; authCurrent: any; onDone: () => void; onClose: () => void;
}) {
  const [available, setAvailable] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const orgId = getOrgId();
    const url = new URL(`/api/openclaw/contexts/third-party/${contextId}/available-agents`, window.location.origin);
    if (orgId) url.searchParams.set("org_id", orgId);
    
    fetch(url.toString(), { headers: authCurrent })
      .then((r) => r.json())
      .then((d) => { setAvailable(d.agents || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [contextId, authCurrent]);
const handleAssign = async () => {
  if (!selectedAgentId) return;
  setAssigning(true);
  try {
    const orgId = getOrgId();
    const url = new URL(`/api/openclaw/contexts/third-party/${contextId}/assign`, window.location.origin);
    if (orgId) url.searchParams.set("org_id", orgId);

    const res = await fetch(url.toString(), {
      method: "POST", headers: authCurrent,
      body: JSON.stringify({ agent_id: selectedAgentId, ...(orgId ? { org_id: orgId } : {}) }),
    });
    if (!res.ok) throw new Error();
    onDone();
    toast.success("Agent assigned");
  } catch { toast.error("Failed to assign agent"); }
  finally { setAssigning(false); }
};

  return (
    <div className="mt-3 p-3.5 rounded-xl bg-[#08080d] border border-[#1e1e2a] space-y-2.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Assign to agent</SectionLabel>
        <button onClick={onClose} className="text-[#3a3a50] hover:text-white transition-colors"><X className="h-3 w-3" /></button>
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-[#5a5a72]" />
      ) : available.length === 0 ? (
        <p className="text-[10px] text-[#3a3a50] italic">All agents already assigned.</p>
      ) : (
        <>
          <div className="relative">
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full bg-[#0e0e14] border border-[#1e1e2a] text-white text-[11px] rounded-lg px-3 py-2 focus:outline-none focus:border-brand/40 appearance-none"
            >
              <option value="">Select agent…</option>
              {available.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-[#5a5a72] pointer-events-none" />
          </div>
          <button
            disabled={assigning || !selectedAgentId}
            onClick={handleAssign}
            className="w-full h-8 rounded-lg bg-brand text-brand-foreground text-[10px] font-black disabled:opacity-50 flex items-center justify-center"
          >
            {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Assignment"}
          </button>
        </>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */

export function ThirdPartyContextsView({ agents, authCurrent }: { agents: AgentData[]; authCurrent: any }) {
  const [completed, setCompleted] = useState<CompletedContext[]>([]);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [deletingTasks, setDeletingTasks] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [contextProviders, setContextProviders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [selectedIntegrationName, setSelectedIntegrationName] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [assigningContextId, setAssigningContextId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const orgId = getOrgId();
      const qs = orgId ? `?org_id=${orgId}` : "";
      const [compRes, actRes, intRes, provRes] = await Promise.all([
        fetch(`/api/openclaw/contexts/third-party/completed${qs}`, { headers: authCurrent }),
        fetch(`/api/openclaw/contexts/ram/context/active${qs}`, { headers: authCurrent }),
        fetch(`/api/openclaw/integrations${qs}`, { headers: authCurrent }),
        fetch(`/api/openclaw/contexts/third-party/providers${qs}`, { headers: authCurrent }),
      ]);
      if (compRes.ok) setCompleted((await compRes.json()).contexts || []);
      if (provRes.ok) {
        const providers: { name: string }[] = await provRes.json();
        setContextProviders(new Set(providers.map((p) => p.name)));
      }
      if (intRes.ok) setIntegrations(await intRes.json());
      if (actRes.ok) {
        const tasks = await actRes.json();
        setActiveTasks(tasks.filter((t: any) => t.task_type === "ingest"));
        setDeletingTasks(tasks.filter((t: any) => t.task_type === "delete"));
      }
    } catch { toast.error("Failed to refresh state"); }
    finally { setLoading(false); }
  }, [authCurrent]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!selectedIntegrationName || !selectedAgentId) return;
    setCreating(true);
    try {
      const orgId = getOrgId();
      const url = new URL("/api/openclaw/contexts/third-party", window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      
      const res = await fetch(url.toString(), {
        method: "POST", headers: authCurrent,
        body: JSON.stringify({ integration_name: selectedIntegrationName, agent_id: selectedAgentId, ...(orgId ? { org_id: orgId } : {}) }),
      });
      if (!res.ok) throw new Error();
      await load();
      setShowAdd(false);
      setSelectedIntegrationName("");
      setSelectedAgentId("");
      toast.success("Intelligence sync started");
    } catch { toast.error("Failed to start sync"); }
    finally { setCreating(false); }
  };

  const handleDelete = async (contextId: string) => {
    if (!confirm("Permanently purge this intelligence source and all vector embeddings?")) return;
    try {
      const orgId = getOrgId();
      const url = new URL(`/api/openclaw/contexts/third-party/${contextId}`, window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      
      const res = await fetch(url.toString(), { method: "DELETE", headers: authCurrent });
      if (!res.ok) throw new Error();
      await load();
      toast.success("Purge task initialized");
    } catch { toast.error("Failed to delete source"); }
  };

  const handleUnassignAgent = async (contextId: string, agentId: string) => {
    try {
      const orgId = getOrgId();
      const url = new URL(`/api/openclaw/contexts/third-party/${contextId}/assign/${agentId}`, window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      
      const res = await fetch(url.toString(), { method: "DELETE", headers: authCurrent });
      if (!res.ok) throw new Error();
      await load();
      toast.success("Assignment removed");
    } catch { toast.error("Failed to unassign agent"); }
  };

  const filteredAgents = useMemo(() => {
    if (!selectedIntegrationName) return [];
    const integ = integrations.find((i) => i.name === selectedIntegrationName);
    if (!integ?.connected_agents) return [];
    const connectedIds = integ.connected_agents.map((ca: any) => typeof ca === "string" ? ca : ca.agent_id || ca.id);
    return agents.filter((a) => connectedIds.includes(a.agent_id));
  }, [selectedIntegrationName, integrations, agents]);

  const hasActiveTasks = activeTasks.length > 0 || deletingTasks.length > 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#08080d]">
        <Loader2 className="h-5 w-5 animate-spin text-[#5a5a72]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#08080d] overflow-hidden">

      {/* ── Topbar ── */}
      <header className="shrink-0 flex items-center justify-between px-8 py-5 border-b border-[#161620]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand flex items-center justify-center">
            <Database className="h-4 w-4 text-brand-foreground" />
          </div>
          <div>
            <h1 className="text-[15px] font-black text-white leading-tight tracking-tight">Third-Party Contexts</h1>
            <p className="text-[11px] text-[#3a3a50] leading-none mt-0.5">Shared intelligence · Multi-agent assignment</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasActiveTasks && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand/5 border border-brand/15">
              <Activity className="h-3 w-3 text-brand animate-pulse" />
              <span className="text-[10px] font-bold text-brand">{activeTasks.length + deletingTasks.length} active</span>
            </div>
          )}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={`h-9 px-4 text-[12px] font-black rounded-xl transition-colors flex items-center gap-1.5 ${showAdd ? "bg-[#0e0e14] border border-[#1e1e2a] text-[#5a5a72]" : "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"}`}
          >
            {showAdd ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Plus className="h-3.5 w-3.5" /> New Context</>}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-8 py-6 space-y-8 pb-16">

          {/* ── Create Panel ── */}
          {showAdd && (
            <div className="bg-[#0c0c12] border border-[#1e1e2a] rounded-2xl p-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand mb-1">Initialize Source</p>
                <p className="text-[12px] text-[#5a5a72] leading-relaxed max-w-lg">
                  Connect an authenticated agent to ingest a new intelligence source. Once indexed, the data can be assigned to any agent in your workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <StepBadge n={1} label="Select Plugin" />
                  <div className="relative">
                    <select
                      value={selectedIntegrationName}
                      onChange={(e) => { setSelectedIntegrationName(e.target.value); setSelectedAgentId(""); }}
                      className="w-full bg-[#08080d] border border-[#1e1e2a] text-white text-[12px] rounded-xl px-4 py-3 focus:outline-none focus:border-brand/40 appearance-none cursor-pointer"
                    >
                      <option value="">Choose a plugin…</option>
                      {integrations.filter((it) => contextProviders.has(it.name)).map((it) => <option key={it.name} value={it.name}>{it.display_name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a5a72] pointer-events-none" />
                  </div>
                </div>

                <div>
                  <StepBadge n={2} label="Select Agent" />
                  <div className="relative">
                    <select
                      disabled={!selectedIntegrationName}
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full bg-[#08080d] border border-[#1e1e2a] text-white text-[12px] rounded-xl px-4 py-3 focus:outline-none focus:border-brand/40 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!selectedIntegrationName ? "Select plugin first" : filteredAgents.length === 0 ? "No authenticated agents" : "Choose an agent…"}
                      </option>
                      {filteredAgents.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a5a72] pointer-events-none" />
                  </div>
                  {selectedIntegrationName && filteredAgents.length === 0 && (
                    <p className="text-[10px] text-amber-500/80 mt-1.5 px-0.5">No agents have this plugin connected. Go to Integrations to connect it.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  disabled={creating || !selectedIntegrationName || !selectedAgentId}
                  onClick={handleCreate}
                  className="h-10 px-6 rounded-xl bg-brand text-brand-foreground font-black text-[12px] disabled:opacity-40 hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-colors flex items-center gap-2 active:scale-[0.98]"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                  Start Discovery
                </button>
                <button onClick={() => setShowAdd(false)} className="h-10 px-5 rounded-xl border border-[#1e1e2a] text-[#5a5a72] text-[12px] font-bold hover:text-white hover:border-[#2a2a3a] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Active Operations ── */}
          {hasActiveTasks && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-brand" />
                <SectionLabel>Active Operations</SectionLabel>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeTasks.map((t) => (
                  <SyncTaskRow key={t.task_id} task={t} agents={agents} authCurrent={authCurrent}
                    onCancel={(id) => setActiveTasks(p => p.filter(x => x.task_id !== id))}
                    onComplete={load}
                  />
                ))}
                {deletingTasks.map((t) => (
                  <DeleteTaskRow key={t.task_id} task={t} onDone={(id) => setDeletingTasks(p => p.filter(x => x.task_id !== id))} />
                ))}
              </div>
            </section>
          )}

          {/* ── Intelligence Vault ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-brand" />
                <SectionLabel>Intelligence Vault</SectionLabel>
              </div>
              <span className="text-[10px] text-[#3a3a50]">{completed.length} source{completed.length !== 1 ? "s" : ""}</span>
            </div>

            {completed.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-3 border border-dashed border-[#161620] rounded-2xl">
                <div className="h-12 w-12 rounded-2xl bg-[#0c0c12] border border-[#161620] flex items-center justify-center">
                  <Database className="h-5 w-5 text-[#1e1e2a]" />
                </div>
                <p className="text-[12px] font-bold text-[#2a2a38]">No sources indexed yet</p>
                <p className="text-[11px] text-[#1e1e28]">Create a context to begin building shared knowledge</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completed.map((ctx) => (
                  <ContextCard
                    key={ctx.id}
                    ctx={ctx}
                    isAssigning={assigningContextId === ctx.id}
                    authCurrent={authCurrent}
                    onAssignToggle={() => setAssigningContextId(assigningContextId === ctx.id ? null : ctx.id)}
                    onAssignDone={() => { setAssigningContextId(null); load(); }}
                    onUnassign={(agentId) => handleUnassignAgent(ctx.id, agentId)}
                    onDelete={() => handleDelete(ctx.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a25; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2a2a35; }
      `}</style>
    </div>
  );
}

/* ─── Context Card ────────────────────────────────────────────── */

function ContextCard({ ctx, isAssigning, authCurrent, onAssignToggle, onAssignDone, onUnassign, onDelete }: {
  ctx: CompletedContext;
  isAssigning: boolean;
  authCurrent: any;
  onAssignToggle: () => void;
  onAssignDone: () => void;
  onUnassign: (agentId: string) => void;
  onDelete: () => void;
}) {
  const metadata = ctx.integration_metadata || {};
  const name = metadata.name || metadata.screen_name || ctx.integration_display_name || ctx.integration_name;
  const email = metadata.email;
  const pic = metadata.picture || metadata.profile_image_url;

  return (
    <div className="bg-[#0c0c12] border border-[#161620] rounded-2xl p-5 hover:border-[#2a2a3a] transition-all group">
      <div className="flex items-start gap-4">

        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-11 w-11 rounded-xl bg-brand/5 border border-brand/10 flex items-center justify-center overflow-hidden">
            {pic
              ? <img src={pic} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              : <Zap className="h-5 w-5 text-brand" />
            }
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 h-2.5 w-2.5 rounded-full border-2 border-[#0c0c12]" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-[14px] font-bold text-white leading-tight">{name}</h4>
            <span className="text-[9px] font-black text-brand uppercase tracking-wider bg-brand/5 px-2 py-0.5 rounded-lg border border-brand/10">
              {ctx.integration_name}
            </span>
          </div>
          {email && <p className="text-[11px] text-[#5a5a72]">{email}</p>}
          <p className="text-[9px] text-[#2a2a38] font-mono mt-1 uppercase tracking-widest">
            {ctx.id}
          </p>

          {/* Agent pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            {ctx.mapped_agents.map((ma) => (
              <div key={ma.agent_id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e0e14] border border-[#1e1e2a] group/pill hover:border-[#2a2a3a] transition-colors">
                <Users className="h-2.5 w-2.5 text-[#5a5a72]" />
                <span className="text-[10px] font-semibold text-[#9fa0b8]">{ma.name}</span>
                <button
                  onClick={() => onUnassign(ma.agent_id)}
                  className="opacity-0 group-hover/pill:opacity-100 transition-opacity text-[#3a3a50] hover:text-red-400"
                >
                  <UserMinus className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}

            {ctx.mapped_agents.length === 0 && (
              <span className="text-[10px] text-[#3a3a50] italic">No agents assigned</span>
            )}

            <button
              onClick={onAssignToggle}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all ${isAssigning ? "border-brand/40 text-brand bg-brand/5" : "border-dashed border-[#1e1e2a] text-[#3a3a50] hover:border-[#2a2a3a] hover:text-white"}`}
            >
              <UserPlus className="h-2.5 w-2.5" />
              Assign
            </button>
          </div>

          {isAssigning && (
            <AgentAssignmentPanel
              contextId={ctx.id}
              authCurrent={authCurrent}
              onDone={onAssignDone}
              onClose={onAssignToggle}
            />
          )}
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="shrink-0 p-2 rounded-xl text-[#2a2a38] hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all opacity-0 group-hover:opacity-100"
          title="Purge source"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}