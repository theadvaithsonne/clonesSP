"use client";

/**
 * The "Taskroom Board" tab inside a service engagement.
 *
 * Everything rendered here arrives pre-filtered from
 * `GET /services/opt-ins/:optInId/board`: internal columns and internal cards
 * are removed server-side, and the timelog fields are only present when the
 * founder switched that permission on. The client is never handed a roomId, so
 * this view cannot be used to reach Taskroom directly.
 *
 * Read-only by design. Clients are `observer` on the underlying room; drag and
 * edit stay in the full Taskroom workspace, which the founder reaches through
 * "Take to Taskroom".
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  ListChecks,
  Loader2,
  RefreshCw,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getEngagementBoard,
  provisionEngagementTaskroom,
  type EngagementBoard as EngagementBoardData,
  type EngagementTeamMember,
} from "@/lib/feed-api";
import { EngagementActivityPanel } from "./EngagementActivityPanel";

/** Avatar for a delivery-team member, falling back to their initials. */
function TeamAvatar({
  member,
  size = "md",
}: {
  member: EngagementTeamMember;
  size?: "sm" | "md";
}) {
  const dimensions = size === "sm" ? "h-4 w-4 text-[8px]" : "h-7 w-7 text-[10px]";

  if (member.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={member.image}
        alt={member.name}
        className={cn("shrink-0 rounded-full object-cover", dimensions)}
      />
    );
  }

  const initials =
    member.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[#262626] font-semibold text-zinc-300",
        dimensions,
      )}
    >
      {initials}
    </span>
  );
}

type BoardReason =
  | "not_configured"
  | "hidden"
  | "pending"
  | "provisioning"
  | "failed"
  | "skipped";

const STATE_COPY: Record<BoardReason, { title: string; body: string }> = {
  not_configured: {
    title: "No taskroom for this service",
    body: "This service was published without a taskroom board.",
  },
  hidden: {
    title: "Board not shared",
    body: "The board is not part of what this service shares with clients.",
  },
  pending: {
    title: "Setting up your workspace",
    body: "The engagement room is being created. This usually takes a moment.",
  },
  provisioning: {
    title: "Setting up your workspace",
    body: "The engagement room is being created. This usually takes a moment.",
  },
  failed: {
    title: "Workspace setup did not finish",
    body: "The engagement room could not be created. Retrying usually fixes it.",
  },
  skipped: {
    title: "No taskroom for this engagement",
    body: "This engagement runs without a shared board.",
  },
};

export function EngagementBoard({
  optInId,
  /** Founders get the retry control and the room deep link. */
  isFounder = false,
  onOpenTaskroom,
}: {
  optInId: string;
  isFounder?: boolean;
  onOpenTaskroom?: (handles: {
    roomId?: string;
    spaceId?: string;
    workspaceId?: string;
  }) => void;
}) {
  const [board, setBoard] = useState<EngagementBoardData | null>(null);
  const [reason, setReason] = useState<BoardReason | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getEngagementBoard(optInId);
      setBoard(result.board);
      setReason(result.board ? null : (result.reason as BoardReason) || "pending");
    } catch (error) {
      console.error("[EngagementBoard] load failed:", error);
      setBoard(null);
      setReason("failed");
    } finally {
      setLoading(false);
    }
  }, [optInId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Provisioning runs out of band after opt-in, so poll briefly while it is in
  // flight rather than leaving the client on a dead "setting up" screen.
  useEffect(() => {
    if (reason !== "pending" && reason !== "provisioning") return;
    const timer = setTimeout(load, 5000);
    return () => clearTimeout(timer);
  }, [reason, load]);

  const retry = async () => {
    setRetrying(true);
    try {
      await provisionEngagementTaskroom(optInId);
      await load();
      toast.success("Workspace setup retried");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not set up the workspace",
      );
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (!board) {
    const copy = STATE_COPY[reason || "pending"];
    const inFlight = reason === "pending" || reason === "provisioning";

    return (
      <div className="rounded-2xl border border-dashed border-[#262626] px-6 py-14 text-center">
        {inFlight ? (
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-zinc-600" />
        ) : (
          <AlertCircle className="mx-auto mb-3 h-5 w-5 text-zinc-600" />
        )}
        <p className="text-sm font-semibold text-white">{copy.title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">
          {copy.body}
        </p>
        {isFounder && (reason === "failed" || reason === "skipped") && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#262626] px-4 py-2 text-xs font-medium text-white transition-colors hover:border-[#3A3A3A] disabled:opacity-50"
          >
            {retrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Set up workspace
          </button>
        )}
      </div>
    );
  }

  const { progress, access } = board;
  const team = board.team || [];

  // Founders reading their own engagement keep the drawer even with activity
  // switched off for clients — the endpoint lets them through for the same
  // reason the board does: seeing the client's view is the point of looking.
  const activityShared = access.showActivityLogs || isFounder;

  return (
    <div className="space-y-4">
      {access.showProgressStatusGauge && (
        <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Milestone progress
              </p>
              <p className="mt-1 text-2xl font-bold text-brand">
                {progress.milestonePercentage}%
              </p>
              <p className="text-[11px] text-zinc-500">
                {progress.completedMilestones} of {progress.totalMilestones}{" "}
                milestones approved
              </p>
            </div>
            {/* Secondary, and labelled as such: task completion moves ahead of
                milestone approval and the two will not agree. */}
            <div className="text-right">
              <p className="text-[11px] text-zinc-500">Tasks</p>
              <p className="text-sm font-semibold text-white">
                {progress.completedTasks}/{progress.totalTasks}
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#0F0F0F]">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${progress.milestonePercentage}%` }}
            />
          </div>
        </div>
      )}

      {team.length > 0 && (
        <div className="rounded-2xl border border-[#262626] bg-[#1A1A1A] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Working on this
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {team.map((member, index) => (
              <span
                key={`${member.name}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#0F0F0F] px-2.5 py-1.5"
              >
                <TeamAvatar member={member} />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-white">
                    {member.name}
                  </span>
                  {member.role && (
                    <span className="block truncate text-[10px] text-zinc-500">
                      {member.role}
                    </span>
                  )}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(activityShared || (isFounder && onOpenTaskroom)) && (
        <div className="flex items-center justify-end gap-3">
          {activityShared && (
            <button
              type="button"
              onClick={() => setShowActivity(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#262626] px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-[#3A3A3A] hover:text-white"
            >
              <Activity className="h-3.5 w-3.5" />
              Activity
            </button>
          )}
          {isFounder && onOpenTaskroom && (
            <button
              type="button"
              onClick={() => onOpenTaskroom({ roomId: board.roomId })}
              className="text-xs font-medium text-brand transition-opacity hover:opacity-80"
            >
              Open full workspace →
            </button>
          )}
        </div>
      )}

      <EngagementActivityPanel
        optInId={optInId}
        open={showActivity}
        onClose={() => setShowActivity(false)}
      />

      {board.stages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#262626] py-12 text-center text-xs text-zinc-500">
          No shared columns on this board yet.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {board.stages.map((stage) => (
            <div
              key={stage._id}
              className="w-[260px] shrink-0 rounded-2xl border border-[#262626] bg-[#1A1A1A] p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color || "#008080" }}
                  />
                  <span className="truncate text-xs font-semibold text-white">
                    {stage.name}
                  </span>
                </div>
                <span className="rounded bg-white/5 px-1.5 text-[10px] text-zinc-500">
                  {stage.cards.length}
                </span>
              </div>

              <div className="space-y-2">
                {stage.cards.length === 0 ? (
                  <p className="py-6 text-center text-[11px] text-zinc-600">
                    Nothing here yet
                  </p>
                ) : (
                  stage.cards.map((card) => {
                    const label = card.name || card.title || "Untitled task";
                    const due = card.dueDate
                      ? new Date(card.dueDate).toLocaleDateString()
                      : null;

                    return (
                      <div
                        key={card._id}
                        className="rounded-xl border border-[#262626] bg-[#0F0F0F] p-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <CheckCircle2
                            className={cn(
                              "mt-0.5 h-3.5 w-3.5 shrink-0",
                              card.isCompleted
                                ? "text-emerald-400"
                                : "text-zinc-700",
                            )}
                          />
                          <p
                            className={cn(
                              "min-w-0 flex-1 text-[11px] font-medium",
                              card.isCompleted
                                ? "text-zinc-500 line-through"
                                : "text-white",
                            )}
                          >
                            {label}
                          </p>
                        </div>

                        {(card.assignees || []).length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 pl-5.5">
                            {(card.assignees || []).map((member, index) => (
                              <span
                                key={`${member.name}-${index}`}
                                title={
                                  member.role
                                    ? `${member.name} · ${member.role}`
                                    : member.name
                                }
                                className="flex items-center gap-1.5"
                              >
                                <TeamAvatar member={member} size="sm" />
                                <span className="text-[10px] text-zinc-400">
                                  {member.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}

                        {(due ||
                          access.revealTimelogSheet ||
                          !!card.subTaskCount) && (
                          <div className="mt-2 flex items-center gap-3 pl-5.5 text-[10px] text-zinc-500">
                            {!!card.subTaskCount && (
                              <span className="inline-flex items-center gap-1">
                                <ListChecks className="h-3 w-3" />
                                {card.subTaskCount}
                              </span>
                            )}
                            {due && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {due}
                              </span>
                            )}
                            {access.revealTimelogSheet &&
                              typeof card.timeLogged === "number" && (
                                <span className="inline-flex items-center gap-1">
                                  <Timer className="h-3 w-3" />
                                  {card.timeLogged}h
                                </span>
                              )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
