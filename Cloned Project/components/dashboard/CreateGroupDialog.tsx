"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getOrgId, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Bot, Users, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { toast } from "sonner";
import TaskroomLinkPicker, {
  ensureTaskroomAccount,
  type LinkChoice,
} from "@/components/chat/TaskroomLinkPicker";

type Member = {
  id: string;
  name?: string;
  email: string;
  profilePicture?: string;
};

type AgentItem = {
  agentId: string;
  name: string;
};

export default function CreateGroupDialog({
  onCreated,
  triggerType = "button",
  children,
}: {
  /** Receives the new group id and the name it was created with. */
  onCreated?: (id: string, name: string) => void;
  triggerType?: "button" | "icon" | "fab" | "list-item" | "custom";
  children?: React.ReactNode;
}) {
  const { userData } = useAmIFounder();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [personalAgents, setPersonalAgents] = useState<AgentItem[]>([]);
  const [taskroomOn, setTaskroomOn] = useState(false);
  const [taskroomChoice, setTaskroomChoice] = useState<LinkChoice | null>(null);
  // Second phase of a submit, after the group itself exists.
  const [linkingTaskroom, setLinkingTaskroom] = useState(false);

  const orgId = getOrgId();

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setTaskroomOn(false);
      setTaskroomChoice(null);
      return;
    }
    (async () => {
      const orgId = localStorage.getItem("garage_org_id");
      const tok = getToken()!;
      const res = await api<{
        members: {
          id?: string;
          email: string;
          name?: string;
          profilePicture?: string;
        }[];
      }>("/team/list?orgId=" + orgId, {}, tok);
      setMembers(
        (res.members || []).map((m) => ({
          id: m.id || (m as any)._id,
          name: m.name,
          email: m.email,
          profilePicture: m.profilePicture,
        }))
      );
      try {
        const url = new URL("/api/openclaw/agent", window.location.origin);
        if (orgId) url.searchParams.set("org_id", orgId);

        const agentRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          setPersonalAgents(
            (agentData.agents || []).map((a: any) => ({
              agentId: a.agent_id,
              name: a.name,
            }))
          );
        }
      } catch {}
    })();
  }, [open, orgId]);

  const count = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const filteredMembers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return members.filter((m) => m.id !== userData?.userId);
    }
    return members.filter(
      (m) =>
        m.id !== userData?.userId &&
        (m.name?.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query))
    );
  }, [members, searchQuery, userData?.userId]);

  const filteredAgents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return personalAgents;
    return personalAgents.filter((a) =>
      a.name.toLowerCase().includes(query)
    );
  }, [personalAgents, searchQuery]);

  const allFilteredSelected = useMemo(() => {
    if (filteredMembers.length === 0) return false;
    return filteredMembers.every((m) => selected[m.id]);
  }, [filteredMembers, selected]);

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered members
      const newSelected = { ...selected };
      filteredMembers.forEach((m) => {
        delete newSelected[m.id];
      });
      setSelected(newSelected);
    } else {
      // Select all filtered members
      const newSelected = { ...selected };
      filteredMembers.forEach((m) => {
        newSelected[m.id] = true;
      });
      setSelected(newSelected);
    }
  };

  async function submit() {
    if (!name.trim()) return;
    // Read up front: closing the dialog mid-submit resets the switch.
    const taskroomLink: LinkChoice | null = taskroomOn
      ? taskroomChoice ?? { mode: "new-workspace" }
      : null;
    setLoading(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const memberIds = Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => k);
      // A group with no org is invisible to every org-scoped list query,
      // so don't create one — the API rejects it anyway.
      if (!orgId) {
        toast.error("No workspace selected — reload and try again");
        return;
      }
      const url = `/groups?orgId=${orgId}`;
      const groupName = name.trim();
      const res = await api<{ ok: boolean; group: { id: string } }>(
        url,
        {
          method: "POST",
          body: JSON.stringify({
            name: groupName,
            description: description.trim() || undefined,
            memberIds
          }),
        },
        getToken()!
      );
      // Linking is its own step on purpose: the group is what was asked for,
      // so a Taskroom failure is reported but never undoes it — the admin can
      // link it again from Admin Controls.
      if (taskroomLink) {
        setLinkingTaskroom(true);
        try {
          // Taskroom needs to know the linker before the backend can act as them.
          await ensureTaskroomAccount();
          await api(
            `/groups/${res.group.id}/taskroom`,
            { method: "PUT", body: JSON.stringify(taskroomLink) },
            getToken()!
          );
          toast.success("Group linked to Taskroom");
        } catch (e) {
          const msg = (
            e instanceof Error && e.message ? e.message : "unknown error"
          ).replace(/[.\s]+$/, "");
          toast.error(
            `Group created, but Taskroom linking failed: ${msg}. You can link it from Admin Controls.`
          );
        }
      }
      setOpen(false);
      setName("");
      setDescription("");
      setSelected({});
      setSearchQuery("");
      setTaskroomOn(false);
      setTaskroomChoice(null);
      onCreated?.(res.group.id, groupName);
      window.dispatchEvent(new CustomEvent("groups:reload"));
    } finally {
      setLoading(false);
      setLinkingTaskroom(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ? (
          children
        ) : triggerType === "fab" ? (
          <button
            type="button"
            className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary hover:bg-primary/95 text-black flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:scale-105 active:scale-95 transition-all z-50 cursor-pointer animate-in fade-in zoom-in-50 duration-250"
            title="Create group"
          >
            <Plus className="h-6 w-6 stroke-[3]" />
          </button>
        ) : triggerType === "icon" ? (
          <button
            type="button"
            className="h-5 w-5 flex items-center justify-center text-[#8888a0] hover:text-white rounded transition-colors cursor-pointer"
            title="Create group"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : triggerType === "list-item" ? (
          <button
            type="button"
            className="w-full flex items-center gap-4 px-2 py-1.5 rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-black flex-shrink-0">
              <Users className="h-5 w-5 stroke-[2]" />
            </div>
            <span className="text-sm font-semibold text-white">New Group</span>
          </button>
        ) : (
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 border border-primary/40 text-black text-xs h-6"
          >
            <Plus className="h-2 w-2" />
            New group
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg border border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur-xl overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto min-h-0 flex-1">
          <Input
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]"
          />
          <textarea
            placeholder="Group description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8] rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-2/50"
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8] pl-9"
            />
          </div>
          {filteredMembers.length > 0 && (
            <div className="flex items-center gap-3 px-2 py-2 border-b border-[#2a2a35]">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-[#c7c7da] font-medium">
                Select All ({filteredMembers.length})
              </span>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto rounded-md border border-[#2a2a35] p-2">
            {filteredMembers.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#15151b] cursor-pointer"
              >
                <Checkbox
                  checked={!!selected[m.id]}
                  onCheckedChange={(v) =>
                    setSelected((s) => ({ ...s, [m.id]: !!v }))
                  }
                />
                <Avatar className="w-8 h-8 border border-[#2f2f3b]">
                  <AvatarImage src={m.profilePicture} />
                  <AvatarFallback className="text-xs text-brand-foreground font-semibold bg-gradient-to-br from-brand to-brand-2">
                    {m.name?.charAt(0) || m.email?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm flex-1 min-w-0">
                  <div className="truncate">{m.name || m.email}</div>
                  <div className="text-[11px] text-[#9fa0b8] truncate">
                    {m.email}
                  </div>
                </div>
              </label>
            ))}
            {filteredMembers.length === 0 && (
              <div className="text-xs text-[#9fa0b8] px-2 py-2">
                {searchQuery ? "No members found." : "No teammates yet."}
              </div>
            )}
            {filteredAgents.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-2 pt-3 pb-1">
                  <div className="h-px flex-1 bg-[#2a2a35]" />
                  <span className="text-[10px] uppercase tracking-wider text-[#7c8aff] font-semibold">
                    Ai Employees
                  </span>
                  <div className="h-px flex-1 bg-[#2a2a35]" />
                </div>
                {filteredAgents.map((agent) => {
                  const virtualId = `openclaw_agent_${agent.agentId}`;
                  return (
                    <label
                      key={virtualId}
                      className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#15151b] cursor-pointer"
                    >
                      <Checkbox
                        checked={!!selected[virtualId]}
                        onCheckedChange={(v) =>
                          setSelected((s) => ({ ...s, [virtualId]: !!v }))
                        }
                      />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-xs font-bold border border-violet-500/30 flex-shrink-0">
                        {agent.name?.charAt(0)?.toUpperCase() || <Bot className="h-4 w-4" />}
                      </div>
                      <div className="text-sm flex-1 min-w-0 flex items-center justify-between gap-2">
                        <div className="truncate">{agent.name}</div>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 border-[#3d3d51] text-[#c9c9ee] bg-transparent shrink-0"
                        >
                          STK
                        </Badge>
                      </div>
                    </label>
                  );
                })}
              </>
            )}
          </div>
          <div className="rounded-md border border-[#2a2a35] px-3 py-2.5 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-white">
                  <ListChecks className="h-4 w-4 text-brand-2 shrink-0" />
                  Add tasks to Taskroom automatically
                </div>
                <div className="text-[11px] text-[#9fa0b8] mt-0.5">
                  AI picks up tasks and issues from this chat and adds them to
                  a Taskroom board. Group members get access to the board.
                </div>
              </div>
              <Switch
                checked={taskroomOn}
                disabled={loading}
                onCheckedChange={setTaskroomOn}
                className="data-[state=checked]:bg-brand-2"
              />
            </label>
            {taskroomOn && (
              <TaskroomLinkPicker
                groupName={name.trim()}
                value={taskroomChoice}
                onChange={setTaskroomChoice}
                disabled={loading}
              />
            )}
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="text-[12px] text-[#9fa0b8]">{count} selected</div>
            <Button
              onClick={submit}
              disabled={!name.trim() || loading}
              className="bg-brand-2 hover:bg-[#5c0c9a]"
            >
              {loading
                ? linkingTaskroom
                  ? "Linking Taskroom…"
                  : "Creating…"
                : "Create group"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
