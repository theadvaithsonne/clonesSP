"use client";

import { useState, useEffect, useMemo } from "react";

import { getOrgId, getToken, getUserIdFromToken } from "@/lib/auth";
import {
  Search, Plus, Loader2, Globe, User, Clock,
  CheckCircle2, Settings2, Trash,
  ArrowRight, Sparkles, Layers, Save,
  Zap, Hash, SlidersHorizontal,
  X, Package, TerminalSquare, Boxes
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import cronstrue from "cronstrue";
import Cron, {quartzToUnix, unixToQuartz} from "react-cron-generator";
import "react-cron-generator/build/cron-builder.css";

interface TemplateVariable {
  key: string;
  label: string;
  required: boolean;
  default?: string;
}

interface CronTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  is_public: boolean;
  required_integrations: string[];
  variables: TemplateVariable[];
  schedule_human?: string;
  schedule_kind: string;
  schedule_expr: string;
  schedule_tz?: string;
  payload_message: string;
  pipeline_template?: any;
  created_by_user_id: string;
  session_target: string;
  delivery_mode: string;
}

interface AgentData {
  agent_id: string;
  name: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "General",
  is_public: false,
  required_integrations: [],
  variables: [],
  schedule_kind: "every",
  schedule_expr: "1h",
  schedule_human: "Every hour",
  session_target: "isolated",
  delivery_mode: "webhook",
  payload_message: "",
  pipeline_template: { tasks: [] }
};

const CATEGORIES = ["General", "Productivity", "Social Media", "Analytics", "Development", "Marketing"];

const CATEGORY_COLORS: Record<string, string> = {
  General: "#9fa0b8",
  Productivity: "#4ade80",
  "Social Media": "#60a5fa",
  Analytics: "#f472b6",
  Development: "#fb923c",
  Marketing: "#a78bfa",
};

/* ─── Section label ──────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black tracking-[0.12em] uppercase text-[#5a5a72] mb-2">
      {children}
    </p>
  );
}

/* ─── Step pill ──────────────────────────────────────────────── */
function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-6 h-6 rounded-full bg-brand text-brand-foreground text-[10px] font-black flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="text-[11px] font-black uppercase tracking-widest text-[#9fa0b8]">{label}</span>
    </div>
  );
}

/* ─── Field wrapper ──────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}

function OpenClawMarketplacePageInternal() {
  const [templates, setTemplates] = useState<CronTemplate[]>([]);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all");

  const userId = getUserIdFromToken() || "";
  const authHeaders = useMemo(() => {
    return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
  }, []);

  const [selectedTemplate, setSelectedTemplate] = useState<CronTemplate | null>(null);
  const [deployAgentId, setDeployAgentId] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<1 | 2>(1);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState<Partial<CronTemplate>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState("general");

  const [scheduleMode, setScheduleMode] = useState<"interval" | "advanced">("interval");
  const [intervalValue, setIntervalValue] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState("h");
  const orgId = getOrgId();

  useEffect(() => {
    if (newTemplate.schedule_kind === "every" || (newTemplate.schedule_expr && newTemplate.schedule_expr.match(/^(\d+)([mhd])$/))) {
      setScheduleMode("interval");
      const match = newTemplate.schedule_expr?.match(/^(\d+)([mhd])$/);
      if (match) { setIntervalValue(match[1]); setIntervalUnit(match[2]); }
    } else { setScheduleMode("advanced"); }
  }, [newTemplate.schedule_kind, newTemplate.schedule_expr, isCreateOpen, isEditOpen]);

  const handleIntervalChange = (val: string, unit: string) => {
    setIntervalValue(val); setIntervalUnit(unit);
    let human = `Every ${val} ${unit === "m" ? "minute" : unit === "h" ? "hour" : "day"}${val !== "1" ? "s" : ""}`;
    setNewTemplate(p => ({ ...p, schedule_kind: "every", schedule_expr: `${val}${unit}`, schedule_human: human }));
  };

  function safeUnixToQuartz(expr: string | undefined): string {
    if (!expr) return "0 * * * * ? *";
    // If it's already Quartz format (6-7 fields), return as-is
    const parts = expr.trim().split(/\s+/);
    if (parts.length >= 6) return expr;
    // If it's an interval expression like "1h", return default
    if (/^\d+[mhd]$/.test(expr)) return "0 * * * * ? *";
    try {
      return unixToQuartz(expr);
    } catch {
      return "0 * * * * ? *";
    }
  }

  const handleCronChange = (cronExpr: string) => {
    const unixExpr = quartzToUnix(cronExpr);
    let human = "";
    try { human = cronstrue.toString(unixExpr); }
    catch (e) { human = "Custom schedule"; }
    setNewTemplate(p => ({
      ...p,
      schedule_kind: "cron",
      schedule_expr: unixExpr,
      schedule_human: human,
    }));
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const urlAg = new URL("/api/openclaw/agent", window.location.origin);
      if (orgId) urlAg.searchParams.set("org_id", orgId);

      const urlTpl = new URL("/api/openclaw/templates", window.location.origin);
      urlTpl.searchParams.set("user_id", userId);
      if (orgId) urlTpl.searchParams.set("org_id", orgId);

      const [tplRes, agRes] = await Promise.all([
        fetch(urlTpl.toString(), { headers: authHeaders }),
        fetch(urlAg.toString(), { headers: authHeaders })
      ]);
      const tplData = await tplRes.json();
      const agData = await agRes.json();
      setTemplates(Array.isArray(tplData) ? tplData : []);
      setAgents(agData.agents || []);
    } catch (err) { toast.error("Failed to load marketplace data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [authHeaders]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterTab === "all" || (filterTab === "public" && t.is_public) || (filterTab === "mine" && t.created_by_user_id === userId);
      return matchesSearch && matchesFilter;
    });
  }, [templates, searchQuery, filterTab, userId]);

  const openDeploy = (tpl: CronTemplate) => {
    setSelectedTemplate(tpl);
    setDeployAgentId("");
    setVariableValues(Object.fromEntries(tpl.variables.map(v => [v.key, v.default || ""])));
    setDeployStep(1);
  };

  const handleDeploy = async () => {
    if (!selectedTemplate || !deployAgentId) return;
    setIsDeploying(true);
    try {
      const url = new URL(`/api/openclaw/templates/${selectedTemplate.id}/instantiate`, window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      
      const res = await fetch(url.toString(), {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ agent_id: deployAgentId, user_id: userId, session_id: `market-${Date.now()}`, variable_values: variableValues, ...(orgId ? { org_id: orgId } : {}) })
      });
      if (!res.ok) throw new Error();
      toast.success(`Workflow "${selectedTemplate.name}" is live!`);
      setSelectedTemplate(null);
    } catch (err) { toast.error("Failed to deploy"); }
    finally { setIsDeploying(false); }
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      const method = isEditOpen ? "PATCH" : "POST";
      const url = new URL(isEditOpen
        ? `/api/openclaw/templates/${editingTemplateId}`
        : `/api/openclaw/templates`, window.location.origin);
      url.searchParams.set("user_id", userId);
      if (orgId) url.searchParams.set("org_id", orgId);
      
      const res = await fetch(url.toString(), { 
        method, 
        headers: authHeaders, 
        body: JSON.stringify({ ...newTemplate, ...(orgId ? { org_id: orgId } : {}) }) 
      });
      if (!res.ok) throw new Error();
      toast.success("Template saved!");
      setIsCreateOpen(false); setIsEditOpen(false); loadData();
    } catch (err) { toast.error("Failed to save template"); }
    finally { setSaving(false); }
  };

  const hasVariables = (selectedTemplate?.variables?.length ?? 0) > 0;
  const canDeploy = deployAgentId && (!hasVariables || deployStep === 2);

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#08080d]">

      {/* ── Topbar ── */}
      <header className="shrink-0 flex items-center justify-between px-8 py-5 border-b border-[#161620]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand flex items-center justify-center">
            <Package className="h-4.5 w-4.5 text-brand-foreground" size={18} />
          </div>
          <div>
            <h1 className="text-[15px] font-black text-white leading-tight tracking-tight">AI Marketplace</h1>
            <p className="text-[11px] text-[#3a3a50] leading-none mt-0.5">Automation workflow library</p>
          </div>
        </div>
        <Button
          onClick={() => { setNewTemplate(EMPTY_FORM); setActiveEditorTab("general"); setIsCreateOpen(true); }}
          className="h-9 px-4 bg-brand text-brand-foreground text-[12px] font-black rounded-xl hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Template
        </Button>
      </header>

      {/* ── Filter Bar ── */}
      <div className="shrink-0 flex items-center gap-3 px-8 py-4 border-b border-[#161620]">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#3a3a50]" />
          <Input
            placeholder="Search workflows..."
            className="pl-9 h-9 bg-[#0e0e14] border-[#1e1e2a] text-[13px] text-white rounded-xl placeholder:text-[#3a3a50] focus-visible:ring-0 focus-visible:border-brand/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a3a50] hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#0e0e14] border border-[#1e1e2a] rounded-xl p-1">
          {[
            { value: "all", label: "All", icon: null },
            { value: "public", label: "Public", icon: <Globe className="h-3 w-3" /> },
            { value: "mine", label: "Mine", icon: <User className="h-3 w-3" /> },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilterTab(tab.value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filterTab === tab.value ? "bg-brand text-brand-foreground" : "text-[#5a5a72] hover:text-white"}`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-[#3a3a50] ml-auto">
          {filteredTemplates.length} workflow{filteredTemplates.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
        {loading && templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-brand" />
            <p className="text-[12px] text-[#3a3a50]">Loading templates…</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-[#0e0e14] border border-[#1e1e2a] flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-[#2a2a38]" />
            </div>
            <p className="text-[13px] text-[#3a3a50]">No templates found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-10">
            {filteredTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                userId={userId}
                onDeploy={() => openDeploy(tpl)}
                onEdit={() => {
                  setEditingTemplateId(tpl.id);
                  setNewTemplate({ ...tpl });
                  setActiveEditorTab("general");
                  setIsEditOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══ DEPLOY SHEET ══════════════════════════════════════════ */}
      <Sheet open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <SheetContent className="sm:max-w-[480px] flex flex-col p-0 bg-[#09090f] border-l border-[#161620] h-full">
          {selectedTemplate && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="shrink-0 p-7 border-b border-[#161620]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand mb-1.5">Deploy Workflow</p>
                    <h2 className="text-xl font-black text-white leading-tight">{selectedTemplate.name}</h2>
                    {selectedTemplate.description && (
                      <p className="text-[12px] text-[#5a5a72] mt-1.5 leading-relaxed">{selectedTemplate.description}</p>
                    )}
                  </div>
                  <button onClick={() => setSelectedTemplate(null)} className="shrink-0 mt-0.5 text-[#3a3a50] hover:text-white transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Quick stats */}
                <div className="flex gap-3 mt-5">
                  <StatChip icon={<Clock className="h-3 w-3" />} label={selectedTemplate.schedule_human || selectedTemplate.schedule_expr} />
                  <StatChip icon={<Layers className="h-3 w-3" />} label={`${selectedTemplate.pipeline_template?.tasks?.length || 0} tasks`} />
                  {selectedTemplate.variables?.length > 0 && (
                    <StatChip icon={<Hash className="h-3 w-3" />} label={`${selectedTemplate.variables.length} inputs`} />
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-7 space-y-7">
                  {/* Step 1 — Agent */}
                  <div>
                    <StepBadge n={1} label="Select Agent" />
                    <div className="space-y-2">
                      {agents.map((a) => (
                        <button
                          key={a.agent_id}
                          onClick={() => setDeployAgentId(a.agent_id)}
                          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all ${deployAgentId === a.agent_id ? "border-brand bg-brand/5 text-white" : "border-[#1e1e2a] bg-[#0e0e14] text-[#9fa0b8] hover:border-[#2a2a38]"}`}
                        >
                          <span className="text-[13px] font-semibold">{a.name}</span>
                          {deployAgentId === a.agent_id && <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />}
                        </button>
                      ))}
                      {agents.length === 0 && (
                        <p className="text-[12px] text-[#3a3a50] italic">No agents available.</p>
                      )}
                    </div>
                  </div>

                  {/* Step 2 — Variables */}
                  {hasVariables && (
                    <div>
                      <StepBadge n={2} label="Configure Inputs" />
                      <div className="space-y-4">
                        {selectedTemplate.variables.map((v) => (
                          <Field key={v.key} label={`${v.label}${v.required ? " *" : ""}`}>
                            <Input
                              placeholder={v.default || `Enter ${v.label.toLowerCase()}…`}
                              value={variableValues[v.key] || ""}
                              onChange={(e) => setVariableValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                              className="h-10 bg-[#0e0e14] border-[#1e1e2a] text-white text-[13px] rounded-xl focus-visible:ring-0 focus-visible:border-brand/50"
                            />
                          </Field>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="shrink-0 p-7 border-t border-[#161620]">
                <Button
                  onClick={handleDeploy}
                  disabled={isDeploying || !deployAgentId}
                  className="w-full h-12 bg-brand text-brand-foreground text-[13px] font-black uppercase rounded-xl hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-40 transition-all active:scale-[0.98]"
                >
                  {isDeploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Deploy Workflow <ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ══ CREATE / EDIT SHEET ════════════════════════════════════ */}
      <Sheet open={isCreateOpen || isEditOpen} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setIsEditOpen(false); } }}>
        <SheetContent className="sm:max-w-[680px] flex flex-col p-0 bg-[#09090f] border-l border-[#161620] h-full">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="shrink-0 px-8 pt-7 pb-0 border-b border-[#161620]">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand mb-1">
                    {isEditOpen ? "Edit Template" : "New Template"}
                  </p>
                  <h2 className="text-xl font-black text-white">
                    {newTemplate.name || (isEditOpen ? "Edit Blueprint" : "Create Workflow")}
                  </h2>
                </div>
                <button
                  onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}
                  className="text-[#3a3a50] hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Tab Nav */}
              <div className="flex gap-0">
                {[
                  { value: "general", label: "General", icon: <SlidersHorizontal size={13} /> },
                  { value: "schedule", label: "Schedule", icon: <Clock size={13} /> },
                  { value: "variables", label: "Variables", icon: <Hash size={13} /> },
                  { value: "pipeline", label: "Pipeline", icon: <Boxes size={13} /> },
                  { value: "prompt", label: "Prompt", icon: <TerminalSquare size={13} /> },
                ].map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveEditorTab(tab.value)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-bold border-b-2 transition-all ${activeEditorTab === tab.value ? "border-brand text-white" : "border-transparent text-[#3a3a50] hover:text-[#9fa0b8]"}`}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-8">

                {/* ── GENERAL ── */}
                {activeEditorTab === "general" && (
                  <div className="space-y-6">
                    <Field label="Workflow Name *">
                      <Input
                        className="h-11 bg-[#0e0e14] border-[#1e1e2a] text-white text-[13px] rounded-xl focus-visible:ring-0 focus-visible:border-brand/50"
                        placeholder="e.g. Daily Analytics Report"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate(p => ({ ...p, name: e.target.value }))}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        className="w-full h-24 bg-[#0e0e14] border border-[#1e1e2a] rounded-xl p-3.5 text-[13px] text-white placeholder:text-[#3a3a50] focus:outline-none focus:border-brand/50 resize-none"
                        placeholder="What does this workflow do?"
                        value={newTemplate.description || ""}
                        onChange={(e) => setNewTemplate(p => ({ ...p, description: e.target.value }))}
                      />
                    </Field>
                    <Field label="Category">
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewTemplate(p => ({ ...p, category: c }))}
                            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${newTemplate.category === c ? "border-brand bg-brand/10 text-brand" : "border-[#1e1e2a] bg-[#0e0e14] text-[#5a5a72] hover:border-[#2a2a38] hover:text-white"}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Visibility">
                      <div className="flex gap-3">
                        {[{ label: "Private", value: false, icon: <User size={13} /> }, { label: "Public", value: true, icon: <Globe size={13} /> }].map(opt => (
                          <button
                            key={String(opt.value)}
                            onClick={() => setNewTemplate(p => ({ ...p, is_public: opt.value }))}
                            className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[12px] font-bold border transition-all ${newTemplate.is_public === opt.value ? "border-brand bg-brand/10 text-brand" : "border-[#1e1e2a] bg-[#0e0e14] text-[#5a5a72] hover:text-white"}`}
                          >
                            {opt.icon}{opt.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}

                {/* ── SCHEDULE ── */}
                {activeEditorTab === "schedule" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 bg-[#0e0e14] border border-[#1e1e2a] rounded-xl p-1 w-fit">
                      <button
                        onClick={() => setScheduleMode("interval")}
                        className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${scheduleMode === "interval" ? "bg-brand text-brand-foreground" : "text-[#5a5a72] hover:text-white"}`}
                      >
                        Interval
                      </button>
                      <button
                        onClick={() => setScheduleMode("advanced")}
                        className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${scheduleMode === "advanced" ? "bg-brand text-brand-foreground" : "text-[#5a5a72] hover:text-white"}`}
                      >
                        Cron
                      </button>
                    </div>

                    {scheduleMode === "interval" ? (
                      <div className="space-y-3">
                        <SectionLabel>Repeat every…</SectionLabel>
                        <div className="flex gap-3">
                          <Input
                            type="number"
                            min="1"
                            value={intervalValue}
                            onChange={(e) => handleIntervalChange(e.target.value, intervalUnit)}
                            className="h-11 w-28 bg-[#0e0e14] border-[#1e1e2a] text-white text-[13px] rounded-xl focus-visible:ring-0 focus-visible:border-brand/50"
                          />
                          <div className="flex gap-2">
                            {[{ v: "m", l: "Minutes" }, { v: "h", l: "Hours" }, { v: "d", l: "Days" }].map(u => (
                              <button
                                key={u.v}
                                onClick={() => handleIntervalChange(intervalValue, u.v)}
                                className={`px-4 h-11 rounded-xl text-[12px] font-bold border transition-all ${intervalUnit === u.v ? "border-brand bg-brand/10 text-brand" : "border-[#1e1e2a] bg-[#0e0e14] text-[#5a5a72] hover:text-white"}`}
                              >
                                {u.l}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#0e0e14] border border-[#1e1e2a] rounded-2xl p-5 cron-builder-container overflow-x-auto">
                        <Cron
                          onChange={handleCronChange}
                          value={safeUnixToQuartz(newTemplate.schedule_expr)}
                          showResultText={false}
                          showResultCron={true}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-brand/5 border border-brand/20">
                      <Zap className="h-3.5 w-3.5 text-brand shrink-0" />
                      <p className="text-[12px] font-semibold text-brand italic">"{newTemplate.schedule_human}"</p>
                    </div>
                  </div>
                )}

                {/* ── VARIABLES ── */}
                {activeEditorTab === "variables" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-bold text-white">Input Variables</p>
                        <p className="text-[11px] text-[#3a3a50] mt-0.5">Define configurable tokens for this workflow</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setNewTemplate(p => ({ ...p, variables: [...(p.variables || []), { key: "", label: "", required: false }] }))}
                        className="h-8 px-3 bg-[#0e0e14] border border-[#1e1e2a] text-white text-[11px] font-bold rounded-xl hover:border-brand/50"
                      >
                        <Plus className="h-3 w-3 mr-1.5" /> Add Variable
                      </Button>
                    </div>

                    {(newTemplate.variables || []).length === 0 && (
                      <div className="py-12 flex flex-col items-center gap-2 border border-dashed border-[#1e1e2a] rounded-2xl">
                        <Hash className="h-6 w-6 text-[#2a2a38]" />
                        <p className="text-[12px] text-[#3a3a50]">No variables defined yet</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {(newTemplate.variables || []).map((v, i) => (
                        <div key={i} className="bg-[#0e0e14] border border-[#1e1e2a] rounded-2xl p-5 group relative">
                          <button
                            onClick={() => setNewTemplate(p => ({ ...p, variables: (p.variables || []).filter((_, idx) => idx !== i) }))}
                            className="absolute top-4 right-4 text-[#2a2a38] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <Field label="Key">
                              <Input value={v.key} placeholder="project_id" onChange={(e) => setNewTemplate(p => ({ ...p, variables: (p.variables || []).map((x, idx) => idx === i ? { ...x, key: e.target.value } : x) }))} className="h-9 bg-[#15151e] border-[#1e1e2a] text-white text-[12px] rounded-lg focus-visible:ring-0 focus-visible:border-brand/50" />
                            </Field>
                            <Field label="Display Label">
                              <Input value={v.label} placeholder="Project" onChange={(e) => setNewTemplate(p => ({ ...p, variables: (p.variables || []).map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) }))} className="h-9 bg-[#15151e] border-[#1e1e2a] text-white text-[12px] rounded-lg focus-visible:ring-0 focus-visible:border-brand/50" />
                            </Field>
                          </div>
                          <Field label="Default Value">
                            <Input value={v.default || ""} placeholder="optional default…" onChange={(e) => setNewTemplate(p => ({ ...p, variables: (p.variables || []).map((x, idx) => idx === i ? { ...x, default: e.target.value } : x) }))} className="h-9 bg-[#15151e] border-[#1e1e2a] text-white text-[12px] rounded-lg focus-visible:ring-0 focus-visible:border-brand/50" />
                          </Field>
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => setNewTemplate(p => ({ ...p, variables: (p.variables || []).map((x, idx) => idx === i ? { ...x, required: !x.required } : x) }))}
                              className={`w-8 h-4 rounded-full transition-colors relative ${v.required ? "bg-brand" : "bg-[#1e1e2a]"}`}
                            >
                              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${v.required ? "left-4.5 left-[18px]" : "left-0.5"}`} />
                            </button>
                            <span className="text-[11px] text-[#5a5a72]">Required</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── PIPELINE ── */}
                {activeEditorTab === "pipeline" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-bold text-white">Pipeline Tasks</p>
                        <p className="text-[11px] text-[#3a3a50] mt-0.5">Define the sequential steps of this workflow</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setNewTemplate(p => ({ ...p, pipeline_template: { tasks: [...(p.pipeline_template?.tasks || []), { name: "", description: "" }] } }))}
                        className="h-8 px-3 bg-[#0e0e14] border border-[#1e1e2a] text-white text-[11px] font-bold rounded-xl hover:border-brand/50"
                      >
                        <Plus className="h-3 w-3 mr-1.5" /> Add Task
                      </Button>
                    </div>

                    {(newTemplate.pipeline_template?.tasks || []).length === 0 && (
                      <div className="py-12 flex flex-col items-center gap-2 border border-dashed border-[#1e1e2a] rounded-2xl">
                        <Boxes className="h-6 w-6 text-[#2a2a38]" />
                        <p className="text-[12px] text-[#3a3a50]">No tasks defined yet</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {(newTemplate.pipeline_template?.tasks || []).map((t: any, i: number) => (
                        <div key={i} className="bg-[#0e0e14] border border-[#1e1e2a] rounded-2xl p-5 group relative">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="w-5 h-5 rounded-md bg-[#1e1e2a] text-[#5a5a72] text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                            <button
                              onClick={() => setNewTemplate(p => ({ ...p, pipeline_template: { tasks: (p.pipeline_template?.tasks || []).filter((_: any, idx: number) => idx !== i) } }))}
                              className="ml-auto text-[#2a2a38] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <Field label="Task Name">
                            <Input
                              value={t.name}
                              placeholder="e.g. Fetch Analytics Data"
                              onChange={(e) => setNewTemplate(p => ({ ...p, pipeline_template: { tasks: (p.pipeline_template?.tasks || []).map((x: any, idx: number) => idx === i ? { ...x, name: e.target.value } : x) } }))}
                              className="h-9 bg-[#15151e] border-[#1e1e2a] text-white text-[12px] rounded-lg focus-visible:ring-0 focus-visible:border-brand/50 mb-3"
                            />
                          </Field>
                          <Field label="Instructions">
                            <textarea
                              className="w-full h-20 bg-[#15151e] border border-[#1e1e2a] rounded-lg p-3 text-[12px] text-white placeholder:text-[#3a3a50] focus:outline-none focus:border-brand/50 resize-none"
                              value={t.description}
                              onChange={(e) => setNewTemplate(p => ({ ...p, pipeline_template: { tasks: (p.pipeline_template?.tasks || []).map((x: any, idx: number) => idx === i ? { ...x, description: e.target.value } : x) } }))}
                              placeholder="What should this task do?"
                            />
                          </Field>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── PROMPT ── */}
                {activeEditorTab === "prompt" && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[14px] font-bold text-white">Orchestration Prompt</p>
                      <p className="text-[11px] text-[#3a3a50] mt-0.5">The main payload message sent to the agent on each run</p>
                    </div>
                    <textarea
                      className="w-full h-[420px] bg-[#0e0e14] border border-[#1e1e2a] rounded-2xl p-5 text-[12px] font-mono text-white placeholder:text-[#3a3a50] focus:outline-none focus:border-brand/50 resize-none"
                      value={newTemplate.payload_message}
                      onChange={(e) => setNewTemplate(p => ({ ...p, payload_message: e.target.value }))}
                      placeholder="You are an automation agent. Your task is to…

Use {{variable_key}} to reference input variables."
                    />
                    <p className="text-[10px] text-[#3a3a50]">
                      Reference variables with <code className="bg-[#1e1e2a] px-1 py-0.5 rounded text-[#9fa0b8]">{"{{variable_key}}"}</code>
                    </p>
                  </div>
                )}

              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 p-7 border-t border-[#161620] flex gap-3">
              <Button
                onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}
                variant="ghost"
                className="h-11 px-5 text-[#5a5a72] text-[12px] font-bold hover:text-white hover:bg-[#0e0e14] rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={saving || !newTemplate.name}
                className="flex-1 h-11 bg-brand text-brand-foreground text-[13px] font-black uppercase rounded-xl hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-40 transition-all active:scale-[0.98]"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />{isEditOpen ? "Save Changes" : "Create Template"}</>}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a25; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2a2a35; }

        .cron-builder-container {
          color-scheme: dark;
        }

        .cron-builder-container .cron_builder { 
          background: transparent; border: none; font-family: inherit; width: 100%; 
        }
        .cron-builder-container .cron_builder_bordering { 
          background: transparent; border: none; padding: 0; 
        }
        .cron-builder-container .well { 
          background: transparent; border: none; box-shadow: none; 
          color: #9fa0b8; padding: 0; margin-bottom: 16px; 
        }
        .cron-builder-container .cron-builder-bg { 
          background: #15151e; border-radius: 8px; color: white; 
          border: 1px solid #1e1e2a; 
        }
        .cron-builder-container .nav-tabs { 
          display: flex; border-bottom: 1px solid #1e1e2a; 
          margin-bottom: 16px; gap: 8px; 
        }
        .cron-builder-container .nav-link { 
          color: #5a5a72; font-size: 10px; font-weight: 800; padding: 8px 4px; 
          text-transform: uppercase; border: none; background: none !important; cursor: pointer; 
        }
        .cron-builder-container .nav-link.active { 
          color: var(--brand) !important; border-bottom: 2px solid var(--brand); 
        }
        .cron-builder-container .nav-link:hover { 
          background: transparent !important; color: white !important; 
        }

        /* ── Dropdowns ── */
        .cron-builder-container select {
          background-color: #1a1a25 !important;
          border: 1px solid #2a2a38 !important;
          color: #e0e0f0 !important;
          padding: 5px 28px 5px 10px !important;
          border-radius: 8px !important;
          margin: 3px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          outline: none !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235a5a72' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 9px center !important;
          cursor: pointer !important;
          vertical-align: middle !important;
        }
        .cron-builder-container select:focus {
          border-color: color-mix(in srgb, var(--brand) 50%, transparent) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 9%, transparent) !important;
        }
        .cron-builder-container select option {
          background-color: #1a1a25 !important;
          color: #e0e0f0 !important;
        }

        /* ── Text inputs & number inputs ── */
        .cron-builder-container input[type="text"],
        .cron-builder-container input[type="number"] {
          background-color: #1a1a25 !important;
          border: 1px solid #2a2a38 !important;
          color: #e0e0f0 !important;
          padding: 5px 10px !important;
          border-radius: 8px !important;
          margin: 3px !important;
          font-size: 12px !important;
          outline: none !important;
          width: 60px !important;
          vertical-align: middle !important;
        }
        .cron-builder-container input[type="text"]:focus,
        .cron-builder-container input[type="number"]:focus {
          border-color: color-mix(in srgb, var(--brand) 50%, transparent) !important;
        }

        /* ── Radio buttons ── */
        .cron-builder-container input[type="radio"] {
          accent-color: var(--brand) !important;
          margin-right: 6px !important;
          vertical-align: middle !important;
          cursor: pointer !important;
        }

        /* ── Labels / inline text ── */
        .cron-builder-container label,
        .cron-builder-container span,
        .cron-builder-container p {
          color: #9fa0b8 !important;
          font-size: 12px !important;
          vertical-align: middle !important;
        }

        /* ── Result cron text ── */
        .cron-builder-container .cron_builder_result {
          font-family: monospace !important;
          font-size: 11px !important;
          color: var(--brand) !important;
          background: color-mix(in srgb, var(--brand) 7%, transparent) !important;
          border: 1px solid color-mix(in srgb, var(--brand) 19%, transparent) !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          margin-top: 12px !important;
        }

        .cron-builder-container .text_align_left { text-align: left; }

        /* ── Dropdowns ── */
        .cron-builder-container select {
          background-color: #1a1a25 !important;
          border: 1px solid #2a2a38 !important;
          color: #e0e0f0 !important;
          padding: 5px 28px 5px 10px !important;
          border-radius: 8px !important;
          margin: 3px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          outline: none !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          color-scheme: dark !important;                /* ← tells browser to use dark native UI */
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235a5a72' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 9px center !important;
          cursor: pointer !important;
          vertical-align: middle !important;
        }
        .cron-builder-container select:focus {
          border-color: color-mix(in srgb, var(--brand) 50%, transparent) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 9%, transparent) !important;
        }
        .cron-builder-container select option {
          background-color: #1a1a25 !important;
          color: #e0e0f0 !important;
        }

        .cron-builder-container select:hover {
          background-color: #22222f !important;
          border-color: #3a3a50 !important;
        }
      `}</style>
    </div>
  );
}

/* ── Template Card ─────────────────────────────────────────── */
function TemplateCard({ tpl, userId, onDeploy, onEdit }: {
  tpl: CronTemplate; userId: string; onDeploy: () => void; onEdit: () => void;
}) {
  const catColor = CATEGORY_COLORS[tpl.category || "General"] || "#9fa0b8";
  const isOwner = tpl.created_by_user_id === userId;

  return (
    <div className="bg-[#0c0c12] border border-[#161620] rounded-2xl p-5 flex flex-col hover:border-[#2a2a3a] transition-all group">
      {/* Top row */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
          style={{ color: catColor, background: `${catColor}18` }}
        >
          {tpl.category || "General"}
        </span>
        <div className="flex items-center gap-1">
          {tpl.is_public && <Globe className="h-3 w-3 text-[#3a3a50]" />}
          {isOwner && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-lg text-[#3a3a50] hover:text-white hover:bg-[#1a1a25] transition-all opacity-0 group-hover:opacity-100"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Name & description */}
      <h3 className="text-[14px] font-bold text-white leading-snug mb-1.5">{tpl.name}</h3>
      <p className="text-[11px] text-[#3a3a50] line-clamp-2 leading-relaxed mb-5 flex-1">
        {tpl.description || "Automation blueprint."}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-3 mb-5">
        <StatChip icon={<Clock className="h-3 w-3" />} label={tpl.schedule_human || tpl.schedule_expr} />
        <StatChip icon={<Layers className="h-3 w-3" />} label={`${tpl.pipeline_template?.tasks?.length || 0} tasks`} />
      </div>

      {/* Deploy button */}
      <button
        onClick={onDeploy}
        className="w-full flex items-center justify-between px-4 h-10 rounded-xl bg-[#0e0e14] border border-[#1e1e2a] text-[12px] font-bold text-[#5a5a72] hover:border-brand/60 hover:text-white transition-all group/btn"
      >
        <span>Deploy</span>
        <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}

/* ── Stat chip ─────────────────────────────────────────────── */
function StatChip({ icon, label }: { icon: React.ReactNode; label?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[#5a5a72] font-semibold">
      <span className="text-brand">{icon}</span>
      <span className="truncate max-w-[100px]">{label}</span>
    </div>
  );
}

/* ── Default export with gate ──────────────────────────────── */
export default function OpenClawMarketplacePage() {
  return (
    <OpenClawMarketplacePageInternal />
  );
}