"use client";

/**
 * Section 6 of the Create Digital Service wizard: "Taskroom & Customer
 * Visibility".
 *
 * Two halves:
 *  - a board layout editor, seeded from the milestones entered in Section 3,
 *    that defines the Kanban columns and default tasks cloned into every
 *    client's engagement room;
 *  - the five Client Access Permission switches.
 *
 * The `isInternal` flag on a column, and the `internal` task kind, decide what
 * the client never sees. Both are advisory here — the actual boundary is
 * enforced by the board proxy on the server, because a browser-side filter
 * would still ship internal cards over the wire.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Eye,
  Folder,
  GaugeCircle,
  Info,
  KanbanSquare,
  Lock,
  Pencil,
  Plus,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TaskroomDestinationPicker } from "./TaskroomDestinationPicker";
import { TaskroomBoardPreview } from "./TaskroomBoardPreview";
import { cn } from "@/lib/utils";
import type {
  ServiceClientAccess,
  ServiceStageTemplate,
  ServiceTaskAssignee,
  ServiceTaskTemplate,
  ServiceTaskroomConfig,
} from "@/lib/feed-api";
import { DEFAULT_CLIENT_ACCESS } from "@/lib/feed-api";

const INTERNAL_STAGE_NAME = "Internal Notes";
const COMPLETED_STAGE_NAME = "Completed";
// Taskroom's own colour for `done` stages, so the column reads the same there.
const COMPLETED_STAGE_COLOR = "#10b981";

/** Minimal shape this section needs from the wizard's milestone state. */
export interface MilestoneLike {
  title: string;
  deliverables?: string[];
}

/**
 * The terminal column. Every board gets one: without it a client can tick a
 * card's subtasks but has nowhere to drag the card itself once the work is
 * done, so nothing on the board ever reads as finished.
 */
function completedStage(): ServiceStageTemplate {
  return {
    name: COMPLETED_STAGE_NAME,
    color: COMPLETED_STAGE_COLOR,
    stageType: "done",
    isInternal: false,
    tasks: [],
  };
}

/** A column is the pinned Completed one when it is the board's `done` stage. */
export function isCompletedStage(stage: ServiceStageTemplate) {
  return !stage.isInternal && stage.stageType === "done";
}

/**
 * Guarantee a client-visible Completed column, and keep the column order
 * meaningful: working columns, then Completed, then the internal ones.
 *
 * Run on every structural change (seed, milestone sync, add column) so a board
 * saved before Completed existed picks one up the next time it is opened.
 */
export function ensureCompletedStage(
  stages: ServiceStageTemplate[],
): ServiceStageTemplate[] {
  const withCompleted = stages.some(isCompletedStage)
    ? stages
    : [...stages, completedStage()];

  return [
    ...withCompleted.filter((s) => !s.isInternal && !isCompletedStage(s)),
    ...withCompleted.filter(isCompletedStage),
    ...withCompleted.filter((s) => s.isInternal),
  ];
}

/**
 * A billable (hourly / retainer) service carries no milestones, so there is
 * nothing to derive columns from — seed the plain flow instead. Tasks are added
 * to the room as the hours are worked; the founder still gets a Completed
 * column for the client to move them into.
 */
function billableStages(): ServiceStageTemplate[] {
  return [
    { name: "To Do", color: "#64748b", stageType: "tostart", isInternal: false, tasks: [] },
    { name: "In Progress", color: "#008080", stageType: "active", isInternal: false, tasks: [] },
  ];
}

/**
 * The card a milestone column is seeded with: the milestone itself, with its
 * deliverables as subtasks. This is the shape provisioning clones into
 * Taskroom, so what the founder sees here is what the room gets.
 */
function milestoneCard(milestone: MilestoneLike): ServiceTaskTemplate {
  return {
    title: milestone.title.trim(),
    kind: "required",
    priority: "medium",
    subtasks: (milestone.deliverables || [])
      .map((deliverable) => deliverable.trim())
      .filter((deliverable) => deliverable.length > 0),
  };
}

/**
 * Derive the default board from the milestones in Section 3: one column per
 * milestone holding that milestone's card, a Completed column, plus an internal
 * column the client never sees. Billable services have no milestones, so they
 * get the plain To Do / In Progress flow instead.
 */
export function buildDefaultStages(
  milestones: MilestoneLike[],
  billable = false,
): ServiceStageTemplate[] {
  const named = milestones.filter(
    (milestone) => milestone.title.trim().length > 0,
  );

  const stages: ServiceStageTemplate[] =
    billable || named.length === 0
      ? billableStages()
      : named.map((milestone, index) => ({
          name: `M${index + 1}: ${milestone.title.trim()}`,
          color: "#008080",
          stageType: index === 0 ? "tostart" : "active",
          isInternal: false,
          milestoneIndex: index,
          tasks: [milestoneCard(milestone)],
        }));

  stages.push({
    name: INTERNAL_STAGE_NAME,
    color: "#64748b",
    stageType: "tostart",
    isInternal: true,
    tasks: [{ title: "Margin Model", kind: "internal", priority: "medium" }],
  });

  return ensureCompletedStage(stages);
}

/**
 * Re-seed milestone columns from the current milestone list while preserving
 * every edit the founder has already made.
 *
 * Columns are matched by `milestoneIndex`, so renaming a milestone in Section 3
 * updates the column heading, adding one appends a column, and removing one
 * drops its column — but custom columns and hand-added tasks all survive.
 */
export function syncStagesWithMilestones(
  stages: ServiceStageTemplate[],
  milestones: MilestoneLike[],
): ServiceStageTemplate[] {
  const named = milestones.filter((m) => m.title.trim().length > 0);
  const standalone = stages.filter(
    (stage) => typeof stage.milestoneIndex !== "number",
  );

  const milestoneStages: ServiceStageTemplate[] = named.map(
    (milestone, index) => {
      const existing = stages.find((stage) => stage.milestoneIndex === index);
      const name = `M${index + 1}: ${milestone.title.trim()}`;

      if (existing) {
        // Keep the founder's tasks and flags; only the heading tracks Section 3.
        return { ...existing, name };
      }

      return {
        name,
        color: "#008080",
        stageType: index === 0 ? "tostart" : "active",
        isInternal: false,
        milestoneIndex: index,
        tasks: [milestoneCard(milestone)],
      };
    },
  );

  return ensureCompletedStage([...milestoneStages, ...standalone]);
}

const TASK_KIND_STYLES: Record<
  ServiceTaskTemplate["kind"],
  { label: string; className: string }
> = {
  required: {
    label: "Required",
    className: "bg-brand/10 text-brand border-brand/20",
  },
  task: {
    label: "Task",
    className: "bg-white/5 text-zinc-400 border-white/10",
  },
  internal: {
    label: "Internal",
    className: "bg-zinc-700/40 text-zinc-400 border-zinc-600/40",
  },
};

const KIND_CYCLE: ServiceTaskTemplate["kind"][] = [
  "required",
  "task",
  "internal",
];

const PERMISSIONS: {
  key: keyof ServiceClientAccess;
  label: string;
  hint: string;
  icon: typeof Eye;
}[] = [
  {
    key: "showTaskroomBoard",
    label: "Show Taskroom Board",
    hint: "Clients see the Kanban board inside their engagement.",
    icon: KanbanSquare,
  },
  {
    key: "showActivityLogs",
    label: "Show Engagement Activity Logs",
    hint: "Comment and status history on shared cards.",
    icon: Activity,
  },
  {
    key: "enableFilesTab",
    label: "Enable Dedicated Files Tab",
    hint: "A files area for briefs, assets and deliverables.",
    icon: Folder,
  },
  {
    key: "revealTimelogSheet",
    label: "Reveal Timelog Tracking Sheet",
    hint: "Off by default — exposes hours logged against each task.",
    icon: Timer,
  },
  {
    key: "showProgressStatusGauge",
    label: "Show Progress Status Gauge",
    hint: "Milestone completion percentage on the engagement summary.",
    icon: GaugeCircle,
  },
];

export function TaskroomVisibilitySection({
  config,
  onChange,
  milestones,
  serviceTitle,
  billable = false,
  assignableMembers = [],
}: {
  config: ServiceTaskroomConfig;
  onChange: (next: ServiceTaskroomConfig) => void;
  milestones: MilestoneLike[];
  /** Suggests the name when a master room is created inline. */
  serviceTitle?: string;
  /** Hourly / retainer pricing — no milestones, so the board is seeded flat. */
  billable?: boolean;
  /**
   * Who a card can be given to. Whoever ends up on a card is added to the
   * client's engagement room when it is provisioned.
   */
  assignableMembers?: ServiceTaskAssignee[];
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [draftTask, setDraftTask] = useState<Record<number, string>>({});
  // Keyed by `${stageIndex}:${taskIndex}` — one open subtask input per card.
  const [draftSubtask, setDraftSubtask] = useState<Record<string, string>>({});

  // Milestone edits in Section 3 flow forward into the board headings.
  const milestoneSignature = useMemo(
    () =>
      milestones
        .filter((m) => m.title.trim().length > 0)
        .map((m) => m.title.trim())
        .join("|"),
    [milestones],
  );

  useEffect(() => {
    if (!config.enabled) return;
    // An enabled board with no columns predates this section (or is a billable
    // service that never had milestones) — seed it rather than syncing nothing.
    const synced =
      config.stages.length === 0
        ? buildDefaultStages(milestones, billable)
        : syncStagesWithMilestones(config.stages, milestones);
    const changed =
      synced.length !== config.stages.length ||
      synced.some((stage, index) => stage.name !== config.stages[index]?.name);
    if (changed) {
      onChange({ ...config, stages: synced });
    }
    // Deliberately keyed on the milestone titles rather than the config, so
    // editing the board here does not re-trigger a sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneSignature, config.enabled, billable]);

  const setStages = (stages: ServiceStageTemplate[]) =>
    onChange({ ...config, stages });

  const updateStage = (index: number, patch: Partial<ServiceStageTemplate>) =>
    setStages(
      config.stages.map((stage, i) =>
        i === index ? { ...stage, ...patch } : stage,
      ),
    );

  // Routed through `ensureCompletedStage` so a new column lands before the
  // Completed one rather than after it.
  const addStage = () =>
    setStages(
      ensureCompletedStage([
        ...config.stages,
        {
          name: "New Column",
          color: "#008080",
          stageType: "active",
          isInternal: false,
          tasks: [],
        },
      ]),
    );

  const removeStage = (index: number) =>
    setStages(config.stages.filter((_, i) => i !== index));

  const addTask = (stageIndex: number) => {
    const title = (draftTask[stageIndex] || "").trim();
    if (!title) return;
    const stage = config.stages[stageIndex];
    updateStage(stageIndex, {
      tasks: [
        ...stage.tasks,
        {
          title,
          // A task added to an internal column is internal by definition.
          kind: stage.isInternal ? "internal" : "task",
          priority: "medium",
        },
      ],
    });
    setDraftTask((prev) => ({ ...prev, [stageIndex]: "" }));
  };

  const updateTask = (
    stageIndex: number,
    taskIndex: number,
    patch: Partial<ServiceTaskTemplate>,
  ) =>
    updateStage(stageIndex, {
      tasks: config.stages[stageIndex].tasks.map((task, i) =>
        i === taskIndex ? { ...task, ...patch } : task,
      ),
    });

  const removeTask = (stageIndex: number, taskIndex: number) =>
    updateStage(stageIndex, {
      tasks: config.stages[stageIndex].tasks.filter((_, i) => i !== taskIndex),
    });

  // Subtasks become Taskroom subtasks of the card — the shape a milestone's
  // deliverables take inside the provisioned room.
  const addSubtask = (stageIndex: number, taskIndex: number) => {
    const key = `${stageIndex}:${taskIndex}`;
    const title = (draftSubtask[key] || "").trim();
    if (!title) return;
    const task = config.stages[stageIndex].tasks[taskIndex];
    updateTask(stageIndex, taskIndex, {
      subtasks: [...(task.subtasks || []), title],
    });
    setDraftSubtask((prev) => ({ ...prev, [key]: "" }));
  };

  const removeSubtask = (
    stageIndex: number,
    taskIndex: number,
    subtaskIndex: number,
  ) =>
    updateTask(stageIndex, taskIndex, {
      subtasks: (config.stages[stageIndex].tasks[taskIndex].subtasks || []).filter(
        (_, i) => i !== subtaskIndex,
      ),
    });

  const setAccess = (key: keyof ServiceClientAccess, value: boolean) =>
    onChange({
      ...config,
      clientAccess: { ...config.clientAccess, [key]: value },
    });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold text-white">
                Provision a Taskroom for every client
              </p>
              <p className="text-[11px] text-zinc-500">
                Taskrooms give clients a shared workspace to track milestones,
                tasks, files and progress interactively. Each purchase gets its
                own private room.
              </p>
            </div>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => {
              onChange({
                ...config,
                enabled: checked,
                // First enable seeds the board from the milestones already
                // entered, so the founder starts from something real.
                stages:
                  checked && config.stages.length === 0
                    ? buildDefaultStages(milestones, billable)
                    : config.stages,
              });
            }}
            className="data-[state=checked]:bg-brand"
          />
        </div>
      </div>

      {!config.enabled ? null : (
        <>
          <TaskroomDestinationPicker
            workspaceId={config.workspaceId}
            spaceId={config.spaceId}
            roomId={config.roomId}
            serviceTitle={serviceTitle}
            // The picker clears the levels below whatever changed, so a stale
            // space or room from another workspace never survives the move.
            onChange={(destination) => onChange({ ...config, ...destination })}
          />

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Preview default taskroom board layout
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 rounded-lg border border-[#262626] p-0.5">
                  {(
                    [
                      { key: "edit", label: "Edit", icon: Pencil },
                      { key: "preview", label: "Preview", icon: Eye },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMode(key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] transition-colors",
                        mode === key
                          ? "bg-brand font-semibold text-brand-foreground"
                          : "text-zinc-400 hover:text-white",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>
                {mode === "edit" && (
                  <button
                    type="button"
                    onClick={addStage}
                    className="flex items-center gap-1.5 rounded-lg border border-[#262626] px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-[#3A3A3A] hover:text-white"
                  >
                    <Plus className="h-3 w-3" />
                    Add column
                  </button>
                )}
              </div>
            </div>

            <p className="mb-2 text-[11px] text-zinc-600">
              {mode === "preview"
                ? "Exactly how these columns and cards render inside the client's taskroom. Tasks in Completed show as finished."
                : billable
                  ? "Hours are logged against the cards in this room. Clients drag a card into Completed once the work is done."
                  : "Columns come from the milestones in step 3. Clients drag a card into Completed once the work is done."}
            </p>

            {config.stages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#262626] py-8 text-center text-xs text-zinc-500">
                {billable
                  ? "No columns yet — add one to seed the room."
                  : "Add milestones in step 3 — columns are generated from them."}
              </p>
            ) : mode === "preview" ? (
              <TaskroomBoardPreview stages={config.stages} />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {config.stages.map((stage, stageIndex) => {
                  // The terminal column is pinned: it is where the client marks
                  // work done, so it can be renamed but not hidden or deleted.
                  const pinned = isCompletedStage(stage);
                  return (
                  <div
                    key={stageIndex}
                    className={cn(
                      "w-[230px] shrink-0 rounded-xl border p-3",
                      stage.isInternal
                        ? "border-[#2A2A2A] bg-[#141414]"
                        : pinned
                          ? "border-[#10b981]/30 bg-[#10b981]/[0.06]"
                          : "border-[#262626] bg-[#1A1A1A]",
                    )}
                  >
                    <div className="mb-2.5 flex items-center gap-1.5">
                      <input
                        value={stage.name}
                        onChange={(e) =>
                          updateStage(stageIndex, { name: e.target.value })
                        }
                        className="min-w-0 flex-1 truncate border-none bg-transparent text-xs font-semibold text-white outline-none"
                      />
                      <span className="rounded bg-white/5 px-1.5 text-[10px] text-zinc-500">
                        {stage.tasks.length}
                      </span>
                      {pinned ? (
                        <span
                          title="Always shared — clients move finished tasks here"
                          className="text-[#10b981]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          title={
                            stage.isInternal
                              ? "Internal — hidden from the client"
                              : "Shared with the client"
                          }
                          onClick={() =>
                            updateStage(stageIndex, {
                              isInternal: !stage.isInternal,
                              tasks: stage.tasks.map((task) => ({
                                ...task,
                                kind: !stage.isInternal ? "internal" : "task",
                              })),
                            })
                          }
                          className={cn(
                            "transition-colors",
                            stage.isInternal
                              ? "text-zinc-500 hover:text-zinc-300"
                              : "text-brand hover:text-brand/80",
                          )}
                        >
                          {stage.isInternal ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      {typeof stage.milestoneIndex !== "number" && !pinned && (
                        <button
                          type="button"
                          onClick={() => removeStage(stageIndex)}
                          className="text-zinc-600 transition-colors hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {stage.tasks.map((task, taskIndex) => {
                        const badge = TASK_KIND_STYLES[task.kind];
                        return (
                          <div
                            key={taskIndex}
                            className="rounded-lg border border-[#262626] bg-[#0F0F0F] p-2"
                          >
                            <div className="flex items-start gap-1.5">
                              <input
                                value={task.title}
                                onChange={(e) =>
                                  updateTask(stageIndex, taskIndex, {
                                    title: e.target.value,
                                  })
                                }
                                className="min-w-0 flex-1 border-none bg-transparent text-[11px] font-medium text-white outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => removeTask(stageIndex, taskIndex)}
                                className="text-zinc-600 transition-colors hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            {(task.subtasks || []).length > 0 && (
                              <div className="mt-1.5 space-y-1 border-l border-[#262626] pl-2">
                                {(task.subtasks || []).map(
                                  (subtask, subtaskIndex) => (
                                    <div
                                      key={subtaskIndex}
                                      className="flex items-center gap-1.5"
                                    >
                                      <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                                      <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">
                                        {subtask}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeSubtask(
                                            stageIndex,
                                            taskIndex,
                                            subtaskIndex,
                                          )
                                        }
                                        className="text-zinc-600 transition-colors hover:text-red-400"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}

                            <input
                              value={draftSubtask[`${stageIndex}:${taskIndex}`] || ""}
                              onChange={(e) =>
                                setDraftSubtask((prev) => ({
                                  ...prev,
                                  [`${stageIndex}:${taskIndex}`]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addSubtask(stageIndex, taskIndex);
                                }
                              }}
                              placeholder="+ Add subtask"
                              className="mt-1.5 w-full border-none bg-transparent text-[10px] text-zinc-300 placeholder:text-zinc-600 outline-none"
                            />

                            <div className="mt-1.5 flex items-center gap-1.5">
                              <button
                                type="button"
                                title="Change task type"
                                onClick={() =>
                                  updateTask(stageIndex, taskIndex, {
                                    kind: KIND_CYCLE[
                                      (KIND_CYCLE.indexOf(task.kind) + 1) %
                                        KIND_CYCLE.length
                                    ],
                                  })
                                }
                                className={cn(
                                  "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium transition-opacity hover:opacity-80",
                                  badge.className,
                                )}
                              >
                                {badge.label}
                              </button>

                              {/* Whoever is picked here is added to the client's
                                  room when it is provisioned, and the card
                                  arrives already in their name. */}
                              <select
                                title="Assign this task"
                                value={task.assignee?.userId || ""}
                                onChange={(e) => {
                                  const picked = assignableMembers.find(
                                    (member) => member.userId === e.target.value,
                                  );
                                  updateTask(stageIndex, taskIndex, {
                                    assignee: picked ? { ...picked } : undefined,
                                  });
                                }}
                                className={cn(
                                  "min-w-0 flex-1 truncate rounded border bg-transparent px-1 py-0.5 text-[9px] outline-none",
                                  task.assignee
                                    ? "border-brand/20 bg-brand/5 text-brand"
                                    : "border-white/10 text-zinc-500",
                                )}
                              >
                                <option value="" className="bg-[#0F0F0F]">
                                  {assignableMembers.length === 0
                                    ? "No members loaded"
                                    : "Unassigned"}
                                </option>
                                {/* Keeps a saved assignee visible even before
                                    the org roster finishes loading. */}
                                {task.assignee &&
                                  !assignableMembers.some(
                                    (member) =>
                                      member.userId === task.assignee?.userId,
                                  ) && (
                                    <option
                                      value={task.assignee.userId}
                                      className="bg-[#0F0F0F]"
                                    >
                                      {task.assignee.name}
                                    </option>
                                  )}
                                {assignableMembers.map((member) => (
                                  <option
                                    key={member.userId}
                                    value={member.userId}
                                    className="bg-[#0F0F0F]"
                                  >
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}

                      <div className="flex items-center gap-1">
                        <input
                          value={draftTask[stageIndex] || ""}
                          onChange={(e) =>
                            setDraftTask((prev) => ({
                              ...prev,
                              [stageIndex]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addTask(stageIndex);
                            }
                          }}
                          placeholder="+ Add task"
                          className="w-full rounded-lg border border-dashed border-[#2A2A2A] bg-transparent px-2 py-1.5 text-[11px] text-white placeholder:text-zinc-600 outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Client access permissions
            </p>
            <div className="rounded-xl border border-[#262626] bg-[#1A1A1A]">
              {PERMISSIONS.map(({ key, label, hint, icon: Icon }, index) => {
                const enabled = config.clientAccess[key];
                // Everything else is moot when the board itself is hidden.
                const disabled = key !== "showTaskroomBoard" &&
                  !config.clientAccess.showTaskroomBoard;

                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center justify-between gap-4 px-3.5 py-3",
                      index > 0 && "border-t border-[#262626]",
                      disabled && "opacity-40",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          enabled && !disabled
                            ? "text-brand"
                            : "text-zinc-600",
                        )}
                      />
                      <div>
                        <p
                          className={cn(
                            "text-xs font-semibold",
                            enabled && !disabled
                              ? "text-white"
                              : "text-zinc-500",
                          )}
                        >
                          {label}
                        </p>
                        <p className="text-[11px] text-zinc-500">{hint}</p>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      disabled={disabled}
                      onCheckedChange={(checked) => setAccess(key, checked)}
                      className="data-[state=checked]:bg-brand"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Config used for services that have never been through Section 6. */
export function emptyTaskroomConfig(): ServiceTaskroomConfig {
  return {
    enabled: false,
    stages: [],
    clientAccess: { ...DEFAULT_CLIENT_ACCESS },
  };
}
