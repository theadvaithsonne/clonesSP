"use client";

/**
 * Read-only render of the Section 6 board as Taskroom itself draws it.
 *
 * The editor above this component optimises for editing — flat rows, inline
 * inputs, no colour. That makes it hard to tell what a client will actually
 * open. This mirrors the real board instead: coloured column headers, the card
 * layout from `componentsSymbol/task-card.tsx` (priority chip top-right, title,
 * subtask checklist, footer), and the "No tasks yet" empty state.
 *
 * It is a simulator over local wizard state — it never calls Taskroom.
 */

import { CheckCircle2, Circle, Eye, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ServiceStageTemplate,
  ServiceTaskTemplate,
} from "@/lib/feed-api";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
};

const KIND_LABELS: Record<ServiceTaskTemplate["kind"], string> = {
  required: "Required",
  task: "Task",
  internal: "Internal",
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

/** A column header in Taskroom is filled with the stage colour, text in black. */
function columnBackground(stage: ServiceStageTemplate) {
  return stage.color || "#008080";
}

function PreviewCard({
  task,
  done,
}: {
  task: ServiceTaskTemplate;
  /** Cards sitting in a done column render as completed, like the real board. */
  done: boolean;
}) {
  const subtasks = task.subtasks || [];
  const priority = task.priority || "medium";

  return (
    <div className="relative rounded-xl border border-[#e5e7eb29] bg-[#141418] p-3">
      <span
        className={cn(
          "absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[9px] font-medium capitalize",
          PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium,
        )}
      >
        {priority}
      </span>

      <h4
        className={cn(
          "pr-14 text-[12px] font-medium leading-tight [word-break:break-word]",
          done ? "text-zinc-400 line-through" : "text-white",
        )}
      >
        {task.title || "Untitled task"}
      </h4>

      {task.description && (
        <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
          {task.description}
        </p>
      )}

      {subtasks.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[9px] text-zinc-500">
            <span>Subtasks</span>
            <span>
              {done ? subtasks.length : 0}/{subtasks.length}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-[#10b981]"
              style={{ width: done ? "100%" : "0%" }}
            />
          </div>
          {subtasks.map((subtask, index) => (
            <div key={index} className="flex items-start gap-1.5">
              {done ? (
                <CheckCircle2 className="mt-[1px] h-3 w-3 shrink-0 text-[#10b981]" />
              ) : (
                <Circle className="mt-[1px] h-3 w-3 shrink-0 text-zinc-600" />
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 text-[10px]",
                  done ? "text-zinc-500 line-through" : "text-zinc-300",
                )}
              >
                {subtask}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[9px] font-medium",
            task.kind === "required"
              ? "border-brand/20 bg-brand/10 text-brand"
              : task.kind === "internal"
                ? "border-zinc-600/40 bg-zinc-700/40 text-zinc-400"
                : "border-white/10 bg-white/5 text-zinc-400",
          )}
        >
          {KIND_LABELS[task.kind]}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-[#e5e7eb29] pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {task.assignee?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={task.assignee.image}
              alt={task.assignee.name}
              className="h-5 w-5 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[9px] text-gray-300">
              {task.assignee ? initials(task.assignee.name) : "—"}
            </span>
          )}
          <span className="truncate text-[10px] text-gray-400">
            {task.assignee?.name || "Unassigned"}
          </span>
        </div>
        <span
          className={cn(
            "text-[10px]",
            done ? "text-[#10b981]" : "text-zinc-500",
          )}
        >
          {done ? "Completed" : "On Time"}
        </span>
      </div>
    </div>
  );
}

export function TaskroomBoardPreview({
  stages,
}: {
  stages: ServiceStageTemplate[];
}) {
  if (stages.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#262626] py-8 text-center text-xs text-zinc-500">
        Nothing to preview yet — add a column first.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[#262626] bg-[#0e0e12] p-3">
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {stages.map((stage, stageIndex) => {
          const done = stage.stageType === "done";
          return (
            <div key={stageIndex} className="w-[250px] shrink-0">
              <div
                className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{ background: columnBackground(stage) }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-[13px] font-medium text-black">
                    {stage.name}
                  </h3>
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] text-white/90">
                    {stage.tasks.length}
                  </span>
                </div>
                <Plus className="h-3.5 w-3.5 shrink-0 text-black/70" />
              </div>

              <div className="mt-1.5 flex items-center gap-1.5 px-1">
                {stage.isInternal ? (
                  <>
                    <Lock className="h-3 w-3 shrink-0 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">
                      Internal — the client never sees this column
                    </span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 shrink-0 text-brand" />
                    <span className="text-[10px] text-zinc-500">
                      {done
                        ? "Shared — clients move finished tasks here"
                        : "Shared with the client"}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-2 space-y-2.5">
                {stage.tasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#262626] py-8 text-center text-[11px] text-zinc-600">
                    {done ? "Drop here when done" : "No tasks yet"}
                  </div>
                ) : (
                  stage.tasks.map((task, taskIndex) => (
                    <PreviewCard key={taskIndex} task={task} done={done} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
