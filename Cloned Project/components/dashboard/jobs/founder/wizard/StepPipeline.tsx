"use client";

// A7 · Step 4 — Pipeline & team: the hiring stages (Applied first and Hired
// last stay fixed), each stage's owner and auto-actions, the hiring team
// (office members only) and which candidate emails go out automatically.

import React from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Lock, Plus, Trash2, UserPlus, X, Zap } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { CATEGORY_META, JOB_PAGES, STAGE_CATEGORIES, TEAM_ROLE_META, newId } from "../../constants";
import { useJobsNav } from "../../nav";
import {
  Avatar,
  Button,
  Card,
  GOLD,
  SwitchControl,
  useLoad,
} from "../../ui";
import type { AutoAction, OfficeMember, Stage, StageCategory, TeamRole } from "../../types";
import type { StepProps } from "./JobWizard";
import { StepHeading } from "./StepBasics";

export default function StepPipeline({ job, detail, update }: StepProps) {
  const nav = useJobsNav();
  const members = useLoad(() => jobsApi.getOfficeMembers(), []);
  const settings = useLoad(() => jobsApi.getSettings(), []);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState(false);
  const [memberQuery, setMemberQuery] = React.useState("");

  const stages = job.stages;
  const setStages = (next: Stage[]) => update({ stages: next });
  const memberById = new Map((members.data || []).map((m) => [m._id, m]));
  const person = (id?: string | null) => (id ? memberById.get(id) || detail.people[id] : undefined);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const movable = stages.slice(1, -1);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = movable.findIndex((s) => s.id === active.id);
    const to = movable.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    setStages([stages[0], ...arrayMove(movable, from, to), stages[stages.length - 1]]);
  };

  const patchStage = (id: string, patch: Partial<Stage>) => setStages(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addStage = () => {
    const stage: Stage = { id: newId("stg_"), name: "New stage", category: "interview", autoActions: [] };
    setStages([...stages.slice(0, -1), stage, stages[stages.length - 1]]);
    setExpanded(stage.id);
  };

  const resetToDefault = () => {
    const saved = settings.data?.settings.defaultPipeline.stages || [];
    const base: Array<{ name: string; category: StageCategory; ownerId?: string | null }> = saved.length
      ? saved
      : [
          { name: "Applied", category: "applied" },
          { name: "Screening", category: "screening" },
          { name: "Assessment", category: "assessment" },
          { name: "Interview", category: "interview" },
          { name: "Offer", category: "offer" },
          { name: "Hired", category: "hired" },
        ];
    setStages(base.map((s) => ({ id: newId("stg_"), name: s.name, category: s.category, ownerId: s.ownerId || null, autoActions: [] })));
    toast.success(saved.length ? "Office default pipeline applied" : "Built-in pipeline applied");
  };

  const team = job.team;
  const addMember = (m: OfficeMember) => {
    if (team.some((t) => t.userId === m._id)) return;
    update({ team: [...team, { userId: m._id, role: "interviewer" }] });
    setPicking(false);
    setMemberQuery("");
  };

  const templates = settings.data?.settings.emailTemplates || [];
  const filteredMembers = (members.data || []).filter(
    (m) =>
      !team.some((t) => t.userId === m._id) &&
      (!memberQuery || `${m.name} ${m.email}`.toLowerCase().includes(memberQuery.toLowerCase()))
  );

  return (
    <div className="grid gap-6 px-8 py-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <StepHeading
          step={4}
          title="Pipeline & team"
          subtitle="The stages candidates move through, who owns them, and who's hiring."
          right={
            <Button variant="secondary" onClick={resetToDefault} disabled={settings.loading}>
              Use office default
            </Button>
          }
        />
        <Card className="p-5">
          <div className="mb-4">
            <div className="text-sm font-semibold text-white">Hiring stages</div>
            <div className="text-xs text-[#7c7d94]">Drag to reorder. Applied and Hired stay fixed.</div>
          </div>
          <div className="space-y-2">
            <StageRow
              stage={stages[0]}
              fixed
              owner={person(stages[0]?.ownerId)}
              team={team.map((t) => person(t.userId)).filter(Boolean) as Array<OfficeMember | { _id: string; name: string }>}
              expanded={expanded === stages[0]?.id}
              onToggle={() => setExpanded((e) => (e === stages[0]?.id ? null : stages[0]?.id))}
              onChange={(p) => patchStage(stages[0].id, p)}
              stages={stages}
              templates={templates}
            />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={movable.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {movable.map((s) => (
                  <SortableStage key={s.id} id={s.id}>
                    {(handle) => (
                      <StageRow
                        stage={s}
                        handle={handle}
                        owner={person(s.ownerId)}
                        team={team.map((t) => person(t.userId)).filter(Boolean) as Array<OfficeMember | { _id: string; name: string }>}
                        expanded={expanded === s.id}
                        onToggle={() => setExpanded((e) => (e === s.id ? null : s.id))}
                        onChange={(p) => patchStage(s.id, p)}
                        onRemove={() => setStages(stages.filter((x) => x.id !== s.id))}
                        stages={stages}
                        templates={templates}
                      />
                    )}
                  </SortableStage>
                ))}
              </SortableContext>
            </DndContext>
            {stages.length > 1 && (
              <StageRow
                stage={stages[stages.length - 1]}
                fixed
                owner={person(stages[stages.length - 1]?.ownerId)}
                team={team.map((t) => person(t.userId)).filter(Boolean) as Array<OfficeMember | { _id: string; name: string }>}
                expanded={expanded === stages[stages.length - 1]?.id}
                onToggle={() => setExpanded((e) => (e === stages[stages.length - 1]?.id ? null : stages[stages.length - 1]?.id))}
                onChange={(p) => patchStage(stages[stages.length - 1].id, p)}
                stages={stages}
                templates={templates}
              />
            )}
          </div>
          <button
            type="button"
            onClick={addStage}
            disabled={stages.length >= 15}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-40"
            style={{ color: GOLD }}
          >
            <Plus className="h-4 w-4" /> Add stage
          </button>
          <div className="mt-4 flex items-center justify-between border-t border-[#1f1f24] pt-3 text-xs text-[#7c7d94]">
            <span className="font-bold uppercase tracking-wider">Fixed outcomes</span>
            <div className="flex gap-2">
              <span className="rounded-md border border-[#262626] px-2 py-0.5">Rejected</span>
              <span className="rounded-md border border-[#262626] px-2 py-0.5">Withdrawn</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Hiring team</div>
              <div className="text-xs text-[#7c7d94]">Office members only</div>
            </div>
            <button type="button" onClick={() => setPicking((p) => !p)} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: GOLD }}>
              <UserPlus className="h-3.5 w-3.5" /> Add from office members
            </button>
          </div>
          {picking && (
            <div className="mb-3 rounded-xl border border-[#262626] bg-[#1A1A1A] p-2">
              <input
                autoFocus
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Search members"
                className="mb-2 w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand"
              />
              <div className="max-h-48 overflow-y-auto">
                {members.loading ? (
                  <p className="px-2 py-2 text-xs text-[#7c7d94]">Loading members…</p>
                ) : filteredMembers.length ? (
                  filteredMembers.map((m) => (
                    <button
                      key={m._id}
                      type="button"
                      onClick={() => addMember(m)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#262626]"
                    >
                      <Avatar name={m.name} src={m.profilePicture} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white">{m.name}</span>
                        <span className="block truncate text-[11px] text-[#7c7d94]">{m.email}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-xs text-[#7c7d94]">No other members to add.</p>
                )}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {team.map((t) => {
              const p = person(t.userId);
              return (
                <div key={t.userId} className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] px-3 py-2">
                  <Avatar name={p?.name} src={p && "profilePicture" in p ? p.profilePicture : p && "avatar" in p ? p.avatar : undefined} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{p?.name || "Member"}</div>
                    <div className="text-[11px] text-[#7c7d94]">{TEAM_ROLE_META[t.role].access}</div>
                  </div>
                  <select
                    value={t.role}
                    onChange={(e) => update({ team: team.map((x) => (x.userId === t.userId ? { ...x, role: e.target.value as TeamRole } : x)) })}
                    className="rounded-lg border border-[#262626] bg-[#141414] px-2 py-1 text-xs text-[#c7c7da] outline-none [&>option]:bg-[#141414]"
                  >
                    {(Object.keys(TEAM_ROLE_META) as TeamRole[]).map((r) => (
                      <option key={r} value={r}>
                        {TEAM_ROLE_META[r].label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => update({ team: team.filter((x) => x.userId !== t.userId) })}
                    className="text-[#61627a] hover:text-[#f87171]"
                    aria-label="Remove from team"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {!team.length && <p className="text-xs text-[#7c7d94]">Add at least one person who&apos;ll review candidates.</p>}
          </div>
          <p className="mt-3 text-[11px] text-[#61627a]">People outside {detail.org.name} can&apos;t be added.</p>
        </Card>

        <Card className="p-5">
          <div className="mb-1 text-sm font-semibold text-white">Candidate emails</div>
          <div className="mb-4 text-xs text-[#7c7d94]">Sent from {detail.org.name}&apos;s email sender.</div>
          <div className="space-y-4">
            <EmailToggle
              title="Application received"
              sub="Sent immediately"
              checked={job.candidateEmails.applicationReceived}
              onChange={(v) => update({ candidateEmails: { applicationReceived: v } })}
            />
            <EmailToggle
              title="Moved to interview"
              sub="When a candidate enters an interview stage"
              checked={job.candidateEmails.movedToInterview}
              onChange={(v) => update({ candidateEmails: { movedToInterview: v } })}
            />
            <div>
              <EmailToggle
                title="Rejection"
                sub={`Sent ${job.candidateEmails.rejectionDelayHours || 0}h after the decision`}
                checked={job.candidateEmails.rejection}
                onChange={(v) => update({ candidateEmails: { rejection: v } })}
              />
              {job.candidateEmails.rejection && (
                <div className="mt-2 flex items-center gap-2 pl-0 text-xs text-[#c7c7da]">
                  Delay
                  <select
                    value={job.candidateEmails.rejectionDelayHours}
                    onChange={(e) => update({ candidateEmails: { rejectionDelayHours: Number(e.target.value) } })}
                    className="rounded-lg border border-[#262626] bg-[#141414] px-2 py-1 text-xs text-[#c7c7da] outline-none [&>option]:bg-[#141414]"
                  >
                    {[0, 2, 12, 24, 48, 72].map((h) => (
                      <option key={h} value={h}>
                        {h === 0 ? "Send immediately" : `${h} hours`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-white">Offer</div>
                <div className="text-xs text-[#7c7d94]">Manual — sent when you send an offer</div>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => nav.go(JOB_PAGES.settings)} className="mt-4 text-xs font-medium" style={{ color: GOLD }}>
            Edit email templates →
          </button>
        </Card>
      </div>
    </div>
  );
}

function EmailToggle({ title, sub, checked, onChange }: { title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm text-white">{title}</div>
        <div className="text-xs text-[#7c7d94]">{sub}</div>
      </div>
      <SwitchControl checked={checked} onChange={onChange} aria-label={title} />
    </div>
  );
}

function SortableStage({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}>
      {children(
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-[#4f5065] hover:text-[#c7c7da]" aria-label="Drag to reorder">
          <GripVertical className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function StageRow({
  stage,
  fixed,
  handle,
  owner,
  team,
  expanded,
  onToggle,
  onChange,
  onRemove,
  stages,
  templates,
}: {
  stage?: Stage;
  fixed?: boolean;
  handle?: React.ReactNode;
  owner?: { _id: string; name: string } | OfficeMember;
  team: Array<{ _id: string; name: string } | OfficeMember>;
  expanded: boolean;
  onToggle: () => void;
  onChange: (p: Partial<Stage>) => void;
  onRemove?: () => void;
  stages: Stage[];
  templates: Array<{ id: string; name: string; kind: string }>;
}) {
  if (!stage) return null;
  const meta = CATEGORY_META[stage.category];
  const actions = stage.autoActions || [];
  const setActions = (next: AutoAction[]) => onChange({ autoActions: next });
  return (
    <div
      className="rounded-xl border bg-[#1A1A1A]"
      style={{ borderColor: expanded ? "color-mix(in srgb, var(--brand) 55%, #262626)" : "#262626" }}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {fixed ? <Lock className="h-4 w-4 text-[#4f5065]" /> : handle}
        {fixed ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#262626] px-2 py-0.5 text-[11px] text-[#c7c7da]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
            {meta.label}
          </span>
        ) : (
          <select
            value={stage.category}
            onChange={(e) => onChange({ category: e.target.value as StageCategory })}
            className="rounded-md border border-[#262626] bg-[#141414] px-2 py-1 text-[11px] text-[#c7c7da] outline-none [&>option]:bg-[#141414]"
            title="Stage type — what candidates see"
          >
            {STAGE_CATEGORIES.filter((c) => c !== "applied" && c !== "hired").map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        )}
        <input
          value={stage.name}
          maxLength={80}
          onChange={(e) => onChange({ name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
        />
        <select
          value={stage.ownerId || ""}
          onChange={(e) => onChange({ ownerId: e.target.value || null })}
          className="max-w-[140px] rounded-md border border-[#262626] bg-[#141414] px-2 py-1 text-[11px] text-[#c7c7da] outline-none [&>option]:bg-[#141414]"
          title="Stage owner"
        >
          <option value="">No owner</option>
          {team.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 rounded-md border border-[#262626] px-2 py-1 text-[11px] text-[#c7c7da] hover:text-white">
          <Zap className="h-3 w-3" style={{ color: actions.length ? GOLD : undefined }} />
          {actions.length} auto-action{actions.length === 1 ? "" : "s"}
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-[#61627a] hover:text-[#f87171]" aria-label="Remove stage">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {owner && !expanded && <div className="-mt-1 px-10 pb-2 text-[11px] text-[#61627a]">Owner: {owner.name}</div>}
      {expanded && (
        <div className="space-y-2 border-t border-[#262626] px-3 py-3">
          {actions.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[#141414] px-3 py-2 text-xs text-[#c7c7da]">
              <select
                value={a.trigger}
                onChange={(e) => {
                  const trigger = e.target.value as AutoAction["trigger"];
                  setActions(
                    actions.map((x) =>
                      x.id === a.id
                        ? {
                            ...x,
                            trigger,
                            action: trigger === "quiz_score_gte" ? "move_to_stage" : trigger === "idle_days" ? "remind_owner" : x.action === "move_to_stage" ? "send_email" : x.action,
                            value: trigger === "on_enter" ? undefined : x.value ?? (trigger === "idle_days" ? 7 : 3),
                          }
                        : x
                    )
                  );
                }}
                className="rounded-md border border-[#262626] bg-[#1A1A1A] px-2 py-1 outline-none [&>option]:bg-[#1A1A1A]"
              >
                <option value="on_enter">When a candidate enters</option>
                <option value="quiz_score_gte">When quiz score is at least</option>
                <option value="idle_days">When there&apos;s no action for</option>
              </select>
              {a.trigger !== "on_enter" && (
                <input
                  type="number"
                  min={0}
                  value={a.value ?? ""}
                  onChange={(e) => setActions(actions.map((x) => (x.id === a.id ? { ...x, value: Number(e.target.value) } : x)))}
                  className="w-16 rounded-md border border-[#262626] bg-[#1A1A1A] px-2 py-1 outline-none"
                />
              )}
              {a.trigger === "idle_days" && <span>days</span>}
              <span>→</span>
              {a.trigger === "on_enter" ? (
                <select
                  value={a.action}
                  onChange={(e) => setActions(actions.map((x) => (x.id === a.id ? { ...x, action: e.target.value as AutoAction["action"] } : x)))}
                  className="rounded-md border border-[#262626] bg-[#1A1A1A] px-2 py-1 outline-none [&>option]:bg-[#1A1A1A]"
                >
                  <option value="send_email">Email the candidate</option>
                  <option value="remind_owner">Notify the stage owner</option>
                </select>
              ) : a.trigger === "quiz_score_gte" ? (
                <select
                  value={a.targetStageId || ""}
                  onChange={(e) => setActions(actions.map((x) => (x.id === a.id ? { ...x, targetStageId: e.target.value } : x)))}
                  className="rounded-md border border-[#262626] bg-[#1A1A1A] px-2 py-1 outline-none [&>option]:bg-[#1A1A1A]"
                >
                  <option value="">Move to…</option>
                  {stages
                    .filter((s) => s.category !== "hired" && s.category !== "applied")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Move to {s.name}
                      </option>
                    ))}
                </select>
              ) : (
                <span>Remind the stage owner</span>
              )}
              {a.trigger === "on_enter" && a.action === "send_email" && (
                <select
                  value={a.emailTemplateId || ""}
                  onChange={(e) => setActions(actions.map((x) => (x.id === a.id ? { ...x, emailTemplateId: e.target.value } : x)))}
                  className="rounded-md border border-[#262626] bg-[#1A1A1A] px-2 py-1 outline-none [&>option]:bg-[#1A1A1A]"
                >
                  <option value="">Choose template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" onClick={() => setActions(actions.filter((x) => x.id !== a.id))} className="ml-auto text-[#61627a] hover:text-[#f87171]" aria-label="Remove action">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {actions.length < 10 && (
            <button
              type="button"
              onClick={() => setActions([...actions, { id: newId("act_"), trigger: "on_enter", action: "send_email" }])}
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: GOLD }}
            >
              <Plus className="h-3.5 w-3.5" /> Add auto-action
            </button>
          )}
          {actions.some((a) => a.trigger === "on_enter" && a.action === "remind_owner") && !stage.ownerId && (
            <p className="text-[11px] text-[#fbbf24]">Set a stage owner so the reminder has someone to go to.</p>
          )}
        </div>
      )}
    </div>
  );
}
