"use client";
import { useEffect, useRef, useState } from "react";
import { getToken, getOrgId, getUserIdFromToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Bot,
  Trash2,
  Loader2,
  PlusCircle,
  Pencil,
  X,
  ChevronUp,
  MessageSquare,
  Lock,
  Unlock,
  Link2,
  Users,
  Check,
  Search,
} from "lucide-react";
import OpenClawChatPage from "./OpenClawChatPage";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/featureFlags";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getTeamMembers, TeamMember } from "@/lib/feed-api";


type AgentType = "default" | "qa" | "voice";

interface AgentData {
  agent_id: string;
  name: string;
  role?: string;
  emoji?: string;
  orgId?: string;
  subscription_status?: "active" | "locked" | "deleted";
  agent_type?: AgentType;
  qa_welcome_message?: string | null;
  qa_persona_instructions?: string | null;
  qa_page_title?: string | null;
  qa_page_subtitle?: string | null;
  llm_model?: string | null;
  assigned_user_ids?: string[];
}

// Concrete model identifiers sent to OpenClawApi → openclaw gateway.
export type LlmModel =
  | "openai/gpt-5.1"
  | "openai/gpt-4.1"
  | "openai/gpt-4o"
  | "openai/gpt-4o-mini"
  | "anthropic/claude-opus-4-5"
  | "anthropic/claude-sonnet-4-5"
  | "anthropic/claude-haiku-4-5";

export type LlmProvider = "openai" | "anthropic";

export const LLM_PROVIDER_LABEL: Record<LlmProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

// Display labels. The provider prefix lets the picker UI group options
// without parsing the id string.
export const LLM_MODEL_LABEL: Record<LlmModel, string> = {
  "openai/gpt-5.1": "OpenAI · GPT-5.1",
  "openai/gpt-4.1": "OpenAI · GPT-4.1",
  "openai/gpt-4o": "OpenAI · GPT-4o",
  "openai/gpt-4o-mini": "OpenAI · GPT-4o mini",
  "anthropic/claude-opus-4-5": "Anthropic · Claude Opus 4.5",
  "anthropic/claude-sonnet-4-5": "Anthropic · Claude Sonnet 4.5",
  "anthropic/claude-haiku-4-5": "Anthropic · Claude Haiku 4.5",
};

// Stable order for rendering (create-form dropdown + chat picker).
export const LLM_MODELS_ORDERED: LlmModel[] = [
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/gpt-5.1",
  "openai/gpt-4.1",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4-5",
  "anthropic/claude-haiku-4-5",
];

// Default model per provider — what the backend stores in
// ``agent_registry.llm_model`` when the user picks a provider at create
// time. The chat picker lets them switch to any other model within the
// same provider per-turn.
export const DEFAULT_MODEL_FOR: Record<LlmProvider, LlmModel> = {
  openai: "openai/gpt-5.1",
  anthropic: "anthropic/claude-sonnet-4-5",
};

export const providerOf = (m?: string | null): LlmProvider | "" => {
  if (m?.startsWith("openai/")) return "openai";
  if (m?.startsWith("anthropic/")) return "anthropic";
  return "";
};

type AgentFormData = {
  name: string;
  emoji: string;
  agent_type: AgentType;
  qa_welcome_message: string;
  qa_persona_instructions: string;
  qa_page_title: string;
  qa_page_subtitle: string;
  // Provider picked at create time.
  llm_provider: LlmProvider | "";
};

// Display + backend-role label derived from the selected type. The
// backend still expects a non-empty `role` string on CreateAgentRequest,
// so we send one of these rather than making role a separate field.
const ROLE_FOR_TYPE: Record<AgentType, string> = {
  default: "AI Assistant",
  qa: "Public Q&A Assistant",
  voice: "Voice Assistant",
};

const EMPTY_FORM: AgentFormData = {
  name: "",
  emoji: "",
  agent_type: "default",
  qa_welcome_message: "",
  qa_persona_instructions: "",
  qa_page_title: "",
  qa_page_subtitle: "",
  llm_provider: "",
};

// Professional emojis suitable for AI employees in an organization
const AGENT_EMOJIS = [
  "👨‍💼", "👩‍💼", "🧑‍💼", "👨‍💻", "👩‍💻", "🧑‍💻",
  "👨‍🔬", "👩‍🔬", "👨‍🎓", "👩‍🎓", "👨‍⚕️", "👩‍⚕️",
  "👨‍🏫", "👩‍🏫", "🧑‍🏫", "👨‍🔧", "👩‍🔧", "🧑‍🔧",
  "🤖", "🧠", "📊", "📈", "🎯", "⚡",
  "🛡️", "🔍", "📝", "💡", "🗂️", "📋",
];

// ── Agent create / edit form ─────────────────────────────────────────────────
function AgentForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
  mode,
}: {
  form: AgentFormData;
  setForm: (f: AgentFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
  // "create" renders the LLM provider picker; "edit" omits it because
  // the provider (stored as llm_model) is locked once an agent exists.
  mode: "create" | "edit";
}) {
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);

  // Close tray on outside click
  useEffect(() => {
    if (!showEmojiTray) return;
    const handler = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setShowEmojiTray(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiTray]);

  return (
    <div className="space-y-3">
      {/* Avatar + Name row */}
      <div className="flex items-end gap-3">
        {/* Avatar picker */}
        <div className="relative" ref={trayRef}>
          <label className="block text-xs font-medium text-[#c7c7da] mb-1">Avatar</label>
          <button
            type="button"
            onClick={() => setShowEmojiTray((v) => !v)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all border ${
              form.emoji
                ? "bg-brand/10 border-brand/40 text-xl"
                : "bg-[#15151b] border-[#2a2a35] hover:border-[#3a3a45] text-[#9fa0b8] text-xs"
            }`}
          >
            {form.emoji || <Bot className="h-4 w-4" />}
          </button>

          {showEmojiTray && (
            <div className="absolute top-full left-0 mt-1.5 z-50 w-[240px] rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-2.5 shadow-xl shadow-black/40">
              <p className="text-[10px] text-[#5a5a72] font-medium mb-2 uppercase tracking-wider">Pick an avatar</p>
              <div className="grid grid-cols-6 gap-1">
                {AGENT_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setForm({ ...form, emoji: e }); setShowEmojiTray(false); }}
                    className={`w-8 h-8 rounded-md text-lg flex items-center justify-center transition-all ${
                      form.emoji === e
                        ? "bg-brand/20 ring-2 ring-brand"
                        : "hover:bg-[#1a1a22]"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              {form.emoji && (
                <button
                  type="button"
                  onClick={() => { setForm({ ...form, emoji: "" }); setShowEmojiTray(false); }}
                  className="mt-2 w-full text-[10px] text-[#9fa0b8] hover:text-white py-1 rounded border border-[#2a2a35] hover:border-[#3a3a45] transition-colors"
                >
                  Remove avatar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Name */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-[#c7c7da] mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <Input
            placeholder="e.g. Alex"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-[#15151b] border-[#2a2a35] text-white placeholder:text-[#9fa0b8] text-sm h-10"
          />
        </div>
      </div>

      {/* Role (dropdown) — replaces the old free-text role input */}
      <div>
        <label className="block text-xs font-medium text-[#c7c7da] mb-1">
          Role <span className="text-red-400">*</span>
        </label>
        <select
          value={form.agent_type}
          onChange={(e) => setForm({ ...form, agent_type: e.target.value as AgentType })}
          className="w-full h-9 rounded-md bg-[#15151b] border border-[#2a2a35] text-white text-sm px-3 outline-none focus:border-brand/50"
        >
          <option value="default">Default — full-featured Ai Employee</option>
          <option value="qa">Q&A — public answer-only assistant</option>
          <option value="voice">Voice — voice-call assistant</option>
        </select>
        {form.agent_type === "qa" && (
          <p className="text-[10px] text-[#9fa0b8] mt-1">
            Q&A agents get a shareable public page. Visitors chat without logging in, billed to you.
          </p>
        )}
        {form.agent_type === "voice" && (
          <p className="text-[10px] text-[#9fa0b8] mt-1">
            Voice agents are still in preview — set the label now, configure calling later.
          </p>
        )}
      </div>

      {/* LLM provider picker — shown in both create and edit modes. */}
      <div>
        <label className="block text-xs font-medium text-[#c7c7da] mb-1">
          Ai Provider <span className="text-red-400">*</span>
        </label>
        <select
          value={form.llm_provider}
          onChange={(e) =>
            setForm({ ...form, llm_provider: e.target.value as LlmProvider | "" })
          }
          className="w-full h-9 rounded-md bg-[#15151b] border border-[#2a2a35] text-white text-sm px-3 outline-none focus:border-brand/50"
        >
          <option value="">Select a provider…</option>
          <option value="openai">OpenAI (default: GPT-5.1)</option>
          <option value="anthropic">Anthropic (default: Claude Sonnet 4.5)</option>
        </select>
        <p className="text-[10px] text-[#9fa0b8] mt-1">
          {mode === "create"
            ? "The underlying AI brain. You can switch specific models later in the chat."
            : "Change the underlying AI brain. Existing chat history is preserved."}
        </p>
      </div>

      {/* Q&A-specific fields — only shown when Q&A is selected */}
      {form.agent_type === "qa" && (
        <div className="space-y-3 rounded-md border border-brand/20 bg-brand/5 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand">
            Q&A Settings
          </div>
          <div>
            <label className="block text-xs font-medium text-[#c7c7da] mb-1">Page title</label>
            <Input
              placeholder="e.g. Acme Support"
              value={form.qa_page_title}
              onChange={(e) => setForm({ ...form, qa_page_title: e.target.value })}
              className="bg-[#15151b] border-[#2a2a35] text-white placeholder:text-[#9fa0b8] text-sm h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#c7c7da] mb-1">Page subtitle</label>
            <Input
              placeholder="e.g. Ask me anything about our products"
              value={form.qa_page_subtitle}
              onChange={(e) => setForm({ ...form, qa_page_subtitle: e.target.value })}
              className="bg-[#15151b] border-[#2a2a35] text-white placeholder:text-[#9fa0b8] text-sm h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#c7c7da] mb-1">Welcome message</label>
            <textarea
              placeholder="Hi! I'm Acme's assistant. How can I help?"
              value={form.qa_welcome_message}
              onChange={(e) => setForm({ ...form, qa_welcome_message: e.target.value })}
              rows={2}
              className="w-full rounded-md bg-[#15151b] border border-[#2a2a35] text-white placeholder:text-[#9fa0b8] text-sm px-3 py-2 outline-none focus:border-brand/50 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#c7c7da] mb-1">
              Persona instructions
            </label>
            <textarea
              placeholder="e.g. Be formal. Never discuss pricing. If asked about financials, say 'I don't have that information.'"
              value={form.qa_persona_instructions}
              onChange={(e) =>
                setForm({ ...form, qa_persona_instructions: e.target.value })
              }
              rows={3}
              className="w-full rounded-md bg-[#15151b] border border-[#2a2a35] text-white placeholder:text-[#9fa0b8] text-sm px-3 py-2 outline-none focus:border-brand/50 resize-none"
            />
            <p className="text-[10px] text-[#9fa0b8] mt-1">
              Applied on top of built-in safety rules. Visitors never see this text.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          onClick={onSubmit}
          disabled={saving}
          className="flex-1 h-9 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground text-sm font-semibold border-0"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
          {submitLabel}
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
          className="h-9 px-3 text-[#9fa0b8] hover:text-white border border-[#2a2a35]"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Assignments panel (founder-only) ─────────────────────────────────────────
const MAX_RENDERED_AVAILABLE = 50;

function MemberRow({
  member,
  checked,
  onToggle,
}: {
  member: TeamMember;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(member._id)}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#1a1a22] transition-colors ${
        checked ? "bg-brand/5" : ""
      }`}
    >
      <div
        className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
          checked ? "bg-brand border-brand" : "border-[#2a2a35]"
        }`}
      >
        {checked && <Check className="h-3 w-3 text-black" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white truncate">{member.name}</div>
        <div className="text-[10px] text-[#9fa0b8] truncate">{member.email}</div>
      </div>
    </button>
  );
}

function AssignmentsPanel({
  currentIds,
  members,
  loading,
  saving,
  currentUserId,
  onSave,
  onClose,
}: {
  currentIds: string[];
  members: TeamMember[];
  loading: boolean;
  saving: boolean;
  currentUserId: string;
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds));
  const [query, setQuery] = useState("");

  useEffect(() => {
    setSelected(new Set(currentIds));
  }, [currentIds]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const assignable = members.filter(
    (m) => m.role !== "founder" && m._id !== currentUserId,
  );

  const assignedMembers = assignable.filter((m) => selected.has(m._id));
  const availableMembers = assignable.filter((m) => !selected.has(m._id));

  const q = query.trim().toLowerCase();
  const matchesQuery = (m: TeamMember) =>
    !q ||
    m.name.toLowerCase().includes(q) ||
    m.email.toLowerCase().includes(q);

  const filteredAssigned = assignedMembers.filter(matchesQuery);
  const filteredAvailable = availableMembers.filter(matchesQuery);
  const availableShown = filteredAvailable.slice(0, MAX_RENDERED_AVAILABLE);
  const availableHidden = filteredAvailable.length - availableShown.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-brand">
          <Users className="h-4 w-4" />
          Manage access
          <span className="text-[10px] text-[#9fa0b8] font-normal">
            · {selected.size} assigned
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6 p-0 text-[#9fa0b8] hover:text-white"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-xs text-[#9fa0b8]">
        Pick the team members who should see and chat with this Ai Employee. Founders of
        this org always have access.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
        </div>
      ) : assignable.length === 0 ? (
        <p className="text-xs text-[#9fa0b8] italic">No other employees in this org.</p>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9fa0b8]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${assignable.length} employees by name or email`}
              className="h-8 pl-8 text-xs bg-[#0a0a0e] border-[#2a2a35] text-white placeholder:text-[#9fa0b8]"
            />
          </div>

          {filteredAssigned.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9fa0b8] mb-1.5">
                Assigned ({filteredAssigned.length})
              </div>
              <div className="max-h-40 overflow-y-auto rounded border border-brand/30 divide-y divide-[#2a2a35]">
                {filteredAssigned.map((m) => (
                  <MemberRow
                    key={m._id}
                    member={m}
                    checked
                    onToggle={toggle}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9fa0b8] mb-1.5">
              Available ({filteredAvailable.length})
            </div>
            {filteredAvailable.length === 0 ? (
              <p className="text-xs text-[#9fa0b8] italic px-1 py-2">
                {q ? "No matches." : "Everyone is already assigned."}
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded border border-[#2a2a35] divide-y divide-[#2a2a35]">
                {availableShown.map((m) => (
                  <MemberRow
                    key={m._id}
                    member={m}
                    checked={false}
                    onToggle={toggle}
                  />
                ))}
                {availableHidden > 0 && (
                  <div className="px-3 py-2 text-[10px] text-[#9fa0b8] italic bg-[#0a0a0e]">
                    {availableHidden} more match{availableHidden === 1 ? "" : "es"} hidden — refine search to narrow down.
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          disabled={saving}
          className="h-7 px-3 text-xs text-[#9fa0b8] hover:text-white"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(Array.from(selected))}
          disabled={saving}
          className="h-7 px-3 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground text-xs font-semibold"
        >
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              Saving
            </>
          ) : (
            "Save access"
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
function OpenClawAgentPageInternal() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<AgentFormData>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AgentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [chatAgent, setChatAgent] = useState<AgentData | null>(null);
  const { amIFounder } = useAmIFounder();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  const authHeaders = {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };

  const orgId = getOrgId();

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/openclaw/agent", window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);

      const res = await fetch(url.toString(), { headers: authHeaders });
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      toast.error("Failed to load Ai Employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  if (chatAgent) {
    return <OpenClawChatPage initialAgent={chatAgent} onBack={() => setChatAgent(null)} />;
  }

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!createForm.llm_provider) {
      toast.error("Pick an AI provider before creating");
      return;
    }
    setCreating(true);
    try {
      const url = new URL("/api/openclaw/agent", window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);

      const { llm_provider, ...rest } = createForm;
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          ...rest,
          role: ROLE_FOR_TYPE[createForm.agent_type],
          llm_model: DEFAULT_MODEL_FOR[llm_provider as LlmProvider],
          ...(orgId ? { org_id: orgId, orgId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          const msg =
            typeof data.detail === "string"
              ? data.detail
              : data.detail?.message ||
                "Add credits to your wallet to create Ai Employees.";
          toast.error(msg);
        } else {
          toast.error(data.error || data.detail || "Failed to create Ai Employee");
        }
        return;
      }
      const newAgent: AgentData = data.agent;
      const updated = [...agents, newAgent];
      setAgents(updated);
      setShowCreateForm(false);
      setCreateForm(EMPTY_FORM);
      setExpandedSkills((prev) => new Set([...prev, newAgent.agent_id]));
      window.dispatchEvent(
        new CustomEvent("openclaw:agents-updated", { detail: { agents: updated } })
      );
      toast.success(`Ai Employee "${newAgent.name}" created!`);
    } catch {
      toast.error("Failed to create Ai Employee");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (agentId: string) => {
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const { llm_provider, ...editPayload } = editForm;
      const res = await fetch(`/api/openclaw/agent/${agentId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          ...editPayload,
          role: ROLE_FOR_TYPE[editForm.agent_type],
          ...(llm_provider
            ? { llm_model: DEFAULT_MODEL_FOR[llm_provider as LlmProvider] }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update Ai Employee");
        return;
      }
      const updated = agents.map((a) =>
        a.agent_id === agentId
          ? {
              ...a,
              name: editForm.name,
              role: ROLE_FOR_TYPE[editForm.agent_type],
              emoji: editForm.emoji,
              agent_type: editForm.agent_type,
              qa_welcome_message: editForm.qa_welcome_message,
              qa_persona_instructions: editForm.qa_persona_instructions,
              qa_page_title: editForm.qa_page_title,
              qa_page_subtitle: editForm.qa_page_subtitle,
              ...(editForm.llm_provider
                ? { llm_model: DEFAULT_MODEL_FOR[editForm.llm_provider as LlmProvider] }
                : {}),
            }
          : a
      );
      setAgents(updated);
      setEditingId(null);
      window.dispatchEvent(
        new CustomEvent("openclaw:agents-updated", { detail: { agents: updated } })
      );
      toast.success("Ai Employee updated!");
    } catch {
      toast.error("Failed to update Ai Employee");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (agentId: string, name: string) => {
    if (!confirm(`Delete Ai Employee "${name}"? The agent will be deactivated and can be recovered by an admin.`)) return;
    setDeletingId(agentId);
    try {
      const url = new URL(`/api/openclaw/agent/${agentId}`, window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);

      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete Ai Employee");
        return;
      }
      const updated = agents.filter((a) => a.agent_id !== agentId);
      setAgents(updated);
      setExpandedSkills((prev) => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
      window.dispatchEvent(
        new CustomEvent("openclaw:agents-updated", { detail: { agents: updated } })
      );
      toast.success(`Ai Employee "${name}" deleted`);
    } catch {
      toast.error("Failed to delete Ai Employee");
    } finally {
      setDeletingId(null);
    }
  };

  const openAssignments = async (agentId: string) => {
    if (assigningId === agentId) {
      setAssigningId(null);
      return;
    }
    setAssigningId(agentId);
    if (teamMembers.length === 0 && orgId) {
      setLoadingTeam(true);
      try {
        const members = await getTeamMembers(orgId);
        setTeamMembers(members);
      } catch {
        toast.error("Failed to load team members");
      } finally {
        setLoadingTeam(false);
      }
    }
  };

  const saveAssignments = async (agentId: string, userIds: string[]) => {
    setSavingAssign(true);
    try {
      const res = await fetch(`/api/openclaw/agent/${agentId}/assignments`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ user_ids: userIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save assignments");
        return;
      }
      setAgents((prev) =>
        prev.map((a) =>
          a.agent_id === agentId ? { ...a, assigned_user_ids: data.assigned_user_ids } : a,
        ),
      );
      toast.success("Access updated");
    } catch {
      toast.error("Failed to save assignments");
    } finally {
      setSavingAssign(false);
    }
  };

  const handleUnlock = async (agentId: string, name: string) => {
    if (!confirm(`Unlock Ai Employee "${name}"? $24.00 will be charged to your wallet.`)) return;
    setUnlockingId(agentId);
    try {
      const userId = getUserIdFromToken();
      const res = await fetch(
        `/api/billing/subscriptions/${agentId}/unlock?user_id=${userId}`,
        { method: "POST", headers: authHeaders }
      );
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          toast.error(data.detail || "Insufficient balance. $24.00 required to unlock.");
        } else {
          toast.error(data.detail || data.error || "Failed to unlock Ai Employee");
        }
        return;
      }
      await fetchAgents();
      toast.success(`Ai Employee "${name}" unlocked!`);
    } catch {
      toast.error("Failed to unlock Ai Employee");
    } finally {
      setUnlockingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center">
            <Bot className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">My Ai Employees</h2>
            <p className="text-xs text-[#9fa0b8]">
              Each Ai Employee appears as a separate contact in your DMs.
            </p>
          </div>
        </div>
        {amIFounder && (
          <Button
            onClick={() => {
              setShowCreateForm((v) => !v);
              setCreateForm(EMPTY_FORM);
            }}
            className="h-8 px-3 bg-brand/10 hover:bg-brand/20 text-brand text-xs border border-brand/30"
          >
            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
            New Ai Employee
          </Button>
        )}
      </div>

      {showCreateForm && (
        <div className="rounded-lg border border-brand/30 bg-[#0e0e12] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-brand">
            <PlusCircle className="h-4 w-4" />
            Create New Ai Employee
          </div>
          <div className="border-t border-[#2a2a35]" />
          <AgentForm
            form={createForm}
            setForm={setCreateForm}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
            saving={creating}
            submitLabel="Create Ai Employee"
            mode="create"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : agents.length === 0 && !showCreateForm ? (
        <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-8 text-center space-y-3">
          <Bot className="h-10 w-10 text-[#9fa0b8] mx-auto" />
          <p className="text-sm text-[#9fa0b8]">
            {amIFounder
              ? "No Ai Employees yet."
              : "No Ai Employees have been assigned to you yet. Ask your founder for access."}
          </p>
          {amIFounder && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="h-8 px-4 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground text-sm font-semibold border-0"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Create your first Ai Employee
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const isLocked =
              SUBSCRIPTIONS_ENABLED && agent.subscription_status === "locked";
            return (
            <div
              key={agent.agent_id}
              className={`rounded-lg border ${isLocked ? "border-red-500/30" : "border-[#2a2a35]"} bg-[#0e0e12] p-4 space-y-3`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${isLocked ? "bg-red-500/20 border-red-500/40" : "bg-brand/20 border-brand/40"} flex items-center justify-center border flex-shrink-0 ${isLocked ? "" : agent.emoji ? "text-lg" : "text-brand text-sm font-bold"}`}>
                  {isLocked ? <Lock className="h-4 w-4 text-red-400" /> : (agent.emoji || agent.name?.charAt(0)?.toUpperCase() || "A")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                    {agent.agent_type === "qa" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand border border-brand/30 font-medium uppercase tracking-wider">
                        Q&A
                      </span>
                    )}
                    {agent.agent_type === "voice" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-300 border border-blue-400/30 font-medium uppercase tracking-wider">
                        Voice
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                        Locked
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#9fa0b8] truncate">{agent.role || "AI Employee"}</div>
                </div>
                <div className="flex items-center gap-1">
                  {isLocked ? (
                    <Button
                      size="sm"
                      onClick={() => handleUnlock(agent.agent_id, agent.name)}
                      disabled={unlockingId === agent.agent_id}
                      className="h-7 px-2 bg-brand/10 hover:bg-brand/20 text-brand text-xs border border-brand/30"
                      title="Unlock ($24)"
                    >
                      {unlockingId === agent.agent_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5 mr-1" />
                      )}
                      Unlock
                    </Button>
                  ) : (
                    <>
                      {agent.agent_type === "qa" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const link = `${window.location.origin}/qa/${agent.agent_id}`;
                            try {
                              await navigator.clipboard.writeText(link);
                              toast.success("Public link copied");
                            } catch {
                              toast.error("Copy failed — link: " + link);
                            }
                          }}
                          className="h-7 w-7 p-0 text-[#9fa0b8] hover:text-brand hover:bg-[#1a1a22]"
                          title="Copy public link"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setChatAgent(agent)}
                        className="h-7 w-7 p-0 text-[#9fa0b8] hover:text-brand hover:bg-[#1a1a22]"
                        title="Chat"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                      {amIFounder && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAssignments(agent.agent_id)}
                            className="h-7 w-7 p-0 text-[#9fa0b8] hover:text-brand hover:bg-[#1a1a22]"
                            title="Manage access"
                          >
                            <Users className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (editingId === agent.agent_id) {
                                setEditingId(null);
                              } else {
                                setEditingId(agent.agent_id);
                                setEditForm({
                                  name: agent.name,
                                  emoji: agent.emoji || "",
                                  agent_type: agent.agent_type || "default",
                                  qa_welcome_message: agent.qa_welcome_message || "",
                                  qa_persona_instructions: agent.qa_persona_instructions || "",
                                  qa_page_title: agent.qa_page_title || "",
                                  qa_page_subtitle: agent.qa_page_subtitle || "",
                                  llm_provider: providerOf(agent.llm_model),
                                });
                              }
                            }}
                            className="h-7 w-7 p-0 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                            title="Edit"
                          >
                            {editingId === agent.agent_id ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  {amIFounder && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(agent.agent_id, agent.name)}
                      disabled={deletingId === agent.agent_id}
                      className="h-7 w-7 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                      title="Delete"
                    >
                      {deletingId === agent.agent_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {editingId === agent.agent_id && (
                <>
                  <div className="border-t border-[#2a2a35]" />
                  <AgentForm
                    form={editForm}
                    setForm={setEditForm}
                    onSubmit={() => handleUpdate(agent.agent_id)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                    submitLabel="Save Changes"
                    mode="edit"
                  />
                </>
              )}

              {assigningId === agent.agent_id && amIFounder && (
                <>
                  <div className="border-t border-[#2a2a35]" />
                  <AssignmentsPanel
                    currentIds={agent.assigned_user_ids || []}
                    members={teamMembers}
                    loading={loadingTeam}
                    saving={savingAssign}
                    currentUserId={getUserIdFromToken() || ""}
                    onSave={(ids) => saveAssignments(agent.agent_id, ids)}
                    onClose={() => setAssigningId(null)}
                  />
                </>
              )}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

export default function OpenClawAgentPage() {
  return (
    <OpenClawAgentPageInternal />
  );
}
