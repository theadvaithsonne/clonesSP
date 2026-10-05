"use client";

/**
 * "Preview customer view" — shows the founder exactly what a client will and
 * will not see for the current Section 6 configuration.
 *
 * This applies the same rules the server-side board proxy applies: internal
 * columns and internal tasks are dropped entirely, and each disabled module is
 * shown as withheld. It is a simulator over local wizard state, so it never
 * calls Taskroom — but the rules it mirrors are the ones actually enforced.
 */

import { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  CreditCard,
  EyeOff,
  FileText,
  Folder,
  FolderOpen,
  GaugeCircle,
  KanbanSquare,
  ListChecks,
  MessageCircle,
  Paperclip,
  PlayCircle,
  Timer,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ServiceClientAccess,
  ServiceTaskroomConfig,
} from "@/lib/feed-api";

export function CustomerViewPreviewModal({
  open,
  onClose,
  config,
  serviceTitle,
}: {
  open: boolean;
  onClose: () => void;
  config: ServiceTaskroomConfig;
  serviceTitle: string;
}) {
  // Same filtering the proxy performs: internal columns vanish, and any task
  // flagged internal is dropped even from a shared column.
  const visibleStages = useMemo(
    () =>
      config.stages
        .filter((stage) => !stage.isInternal)
        .map((stage) => ({
          ...stage,
          tasks: stage.tasks.filter((task) => task.kind !== "internal"),
        })),
    [config.stages],
  );

  const hiddenStageCount = config.stages.filter(
    (stage) => stage.isInternal,
  ).length;
  const hiddenTaskCount = config.stages.reduce(
    (sum, stage) =>
      sum +
      (stage.isInternal
        ? stage.tasks.length
        : stage.tasks.filter((task) => task.kind === "internal").length),
    0,
  );

  // The timelog sheet and the progress gauge are drawn inside the board, so
  // they go dark with it. The files tab and the activity drawer are their own
  // surfaces with their own endpoints — the server does not gate either on
  // `showTaskroomBoard`, and neither does this preview.
  const modules: {
    key: keyof ServiceClientAccess;
    label: string;
    icon: typeof KanbanSquare;
    needsBoard?: boolean;
  }[] = [
    { key: "showTaskroomBoard", label: "Taskroom Board", icon: KanbanSquare },
    { key: "showActivityLogs", label: "Activity Logs", icon: Activity },
    { key: "enableFilesTab", label: "Files Tab", icon: Folder },
    {
      key: "revealTimelogSheet",
      label: "Timelog Sheet",
      icon: Timer,
      needsBoard: true,
    },
    {
      key: "showProgressStatusGauge",
      label: "Progress Gauge",
      icon: GaugeCircle,
      needsBoard: true,
    },
  ];

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#262626] bg-[#0F0F0F]">
        <div className="flex items-start justify-between border-b border-[#262626] px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-white">
              Customer view preview
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              What a client sees in {serviceTitle || "this service"}. Internal
              columns and tasks are removed on the server before they reach the
              browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Modules
            </p>
            <div className="flex flex-wrap gap-2">
              {modules.map(({ key, label, icon: Icon, needsBoard }) => {
                const on =
                  config.clientAccess[key] &&
                  (!needsBoard || config.clientAccess.showTaskroomBoard);
                return (
                  <span
                    key={key}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium",
                      on
                        ? "border-brand/20 bg-brand/10 text-brand"
                        : "border-[#262626] bg-[#1A1A1A] text-zinc-600 line-through",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Tabs in the engagement
            </p>
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[#262626] bg-[#1A1A1A] p-1">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[11px] font-medium text-brand-foreground">
                <ListChecks className="h-3 w-3" />
                Milestones
              </span>
              {config.clientAccess.showTaskroomBoard && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-400">
                  <KanbanSquare className="h-3 w-3" />
                  Taskroom Board
                </span>
              )}
              {config.clientAccess.enableFilesTab && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-400">
                  <Folder className="h-3 w-3" />
                  Files
                </span>
              )}
              {config.clientAccess.showActivityLogs && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#262626] px-2.5 py-1.5 text-[11px] font-medium text-zinc-400">
                  <Activity className="h-3 w-3" />
                  Activity
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-600">
              Milestones, deliverables and the message thread are always part of
              an engagement — the switches above only add tabs to it.
            </p>
          </div>

          {!config.clientAccess.showTaskroomBoard ? (
            <div className="rounded-xl border border-dashed border-[#262626] py-10 text-center">
              <EyeOff className="mx-auto mb-2 h-5 w-5 text-zinc-600" />
              <p className="text-xs text-zinc-400">
                The board is hidden from clients.
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                They still see milestones, deliverables and messages in their
                engagement.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Board as the client sees it
              </p>
              {visibleStages.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#262626] py-8 text-center text-xs text-zinc-500">
                  No client-visible columns configured.
                </p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {visibleStages.map((stage, index) => (
                    <div
                      key={index}
                      className="w-[210px] shrink-0 rounded-xl border border-[#262626] bg-[#1A1A1A] p-3"
                    >
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="truncate text-xs font-semibold text-white">
                          {stage.name}
                        </span>
                        <span className="rounded bg-white/5 px-1.5 text-[10px] text-zinc-500">
                          {stage.tasks.length}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {stage.tasks.length === 0 ? (
                          <p className="py-3 text-center text-[11px] text-zinc-600">
                            No tasks yet
                          </p>
                        ) : (
                          stage.tasks.map((task, taskIndex) => (
                            <div
                              key={taskIndex}
                              className="rounded-lg border border-[#262626] bg-[#0F0F0F] p-2"
                            >
                              <p className="text-[11px] font-medium text-white">
                                {task.title}
                              </p>
                              {(task.subtasks || []).length > 0 && (
                                <div className="mt-1 space-y-0.5 border-l border-[#262626] pl-2">
                                  {(task.subtasks || []).map(
                                    (subtask, subtaskIndex) => (
                                      <p
                                        key={subtaskIndex}
                                        className="truncate text-[10px] text-zinc-500"
                                      >
                                        • {subtask}
                                      </p>
                                    ),
                                  )}
                                </div>
                              )}
                              {task.kind === "required" && (
                                <span className="mt-1.5 inline-block rounded border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[9px] font-medium text-brand">
                                  Required
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {config.clientAccess.enableFilesTab ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Files tab as the client sees it
              </p>
              <div className="space-y-2">
                {[
                  {
                    icon: FolderOpen,
                    label: "Shared with you",
                    body: "Milestone briefs and the work delivered against each milestone.",
                  },
                  {
                    icon: UserRound,
                    label: "Your uploads",
                    body: "What the client attaches to a milestone, up to 10 files of 25MB each.",
                  },
                  {
                    icon: Paperclip,
                    label: "From the taskroom",
                    body: config.clientAccess.showTaskroomBoard
                      ? "Files attached to cards on the shared board."
                      : "Files attached to cards in the engagement room — listed even with the board hidden.",
                  },
                ].map(({ icon: Icon, label, body }) => (
                  <div
                    key={label}
                    className="flex items-start gap-2.5 rounded-xl border border-[#262626] bg-[#1A1A1A] px-3.5 py-3"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <div>
                      <p className="text-xs font-semibold text-white">{label}</p>
                      <p className="text-[11px] text-zinc-500">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-600">
                Files on milestones the client has not unlocked are dropped
                server-side and never reach the browser.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#262626] py-10 text-center">
              <EyeOff className="mx-auto mb-2 h-5 w-5 text-zinc-600" />
              <p className="text-xs text-zinc-400">
                No files tab for clients.
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Deliverables still appear on the milestone they belong to.
              </p>
            </div>
          )}

          {config.clientAccess.showActivityLogs ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Activity the client can open
              </p>
              <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] px-3.5 py-3">
                <ol className="space-y-2.5">
                  {[
                    { icon: PlayCircle, label: "Milestone started and delivered" },
                    { icon: CreditCard, label: "Payments received" },
                    { icon: FileText, label: "Files shared and uploaded" },
                    { icon: MessageCircle, label: "Comments on the engagement" },
                    {
                      icon: KanbanSquare,
                      label: config.clientAccess.showTaskroomBoard
                        ? "Tasks added and completed on the shared columns"
                        : "Tasks added and completed on the client-visible columns",
                    },
                  ].map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-2.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span className="text-[11px] text-zinc-400">{label}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-600">
                Internal columns and locked milestones contribute nothing to the
                timeline.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#262626] py-10 text-center">
              <EyeOff className="mx-auto mb-2 h-5 w-5 text-zinc-600" />
              <p className="text-xs text-zinc-400">
                No activity log for clients.
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Card comments and edit history are stripped from the board
                payload as well, not just hidden.
              </p>
            </div>
          )}

          {(hiddenStageCount > 0 || hiddenTaskCount > 0) && (
            <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <div>
                  <p className="text-xs font-semibold text-white">
                    Withheld from the client
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {hiddenStageCount} internal{" "}
                    {hiddenStageCount === 1 ? "column" : "columns"} and{" "}
                    {hiddenTaskCount}{" "}
                    {hiddenTaskCount === 1 ? "task" : "tasks"} are stripped
                    server-side and never sent to the browser.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-[#262626] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
