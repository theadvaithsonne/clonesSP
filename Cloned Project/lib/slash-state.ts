"use client";

// Client-side store for slash card runtime state. Mirrors the messageExtras
// pattern (localStorage + useSyncExternalStore) so reads stay snapshot-stable
// and the store costs nothing on the backend per render.
//
// Two categories live here:
//   1. Per-user-only state — poll votes, my RSVP. Other clients never see it.
//   2. Cross-user state — approval decisions, deal stage. The card embeds
//      a snapshot at send time, then slash-state overrides it as socket
//      events arrive (see lib/hooks/useSlashCardSync.ts).
//
// Cards always prefer slash-state over the marker payload, so the moment a
// PATCH/POST returns and the socket fires, every card visible across every
// chat tab re-renders without polling.

import { useSyncExternalStore } from "react";
import type { DealStage } from "@/lib/chat-markers";

export type Rsvp = "accepted" | "declined" | "pending";
export type ApprovalDecision = "pending" | "approved" | "rejected";
export type ApprovalStatusMap = Record<string, ApprovalDecision>;

// Assignee override stored as { id, name } so the card can render the new
// person's display name without re-fetching members.
export type TaskAssigneeOverride = { id: string; name?: string };

type State = {
  pollVotes: Record<string, string[]>;
  rsvps: Record<string, Rsvp>;
  approvalStatuses: Record<string, ApprovalStatusMap>;
  approvalOverall: Record<string, ApprovalDecision>;
  dealStages: Record<string, DealStage>;
  taskStages: Record<string, string>;
  taskAssignees: Record<string, TaskAssigneeOverride>;
};

const KEY = "garage_slash_state_v1";

function emptyState(): State {
  return {
    pollVotes: {},
    rsvps: {},
    approvalStatuses: {},
    approvalOverall: {},
    dealStages: {},
    taskStages: {},
    taskAssignees: {},
  };
}

function load(): State {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      pollVotes: parsed.pollVotes ?? {},
      rsvps: parsed.rsvps ?? {},
      approvalStatuses: parsed.approvalStatuses ?? {},
      approvalOverall: parsed.approvalOverall ?? {},
      dealStages: parsed.dealStages ?? {},
      taskStages: parsed.taskStages ?? {},
      taskAssignees: parsed.taskAssignees ?? {},
    };
  } catch {
    return emptyState();
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = load();
    emit();
  });
}

const EMPTY_VOTE: string[] = Object.freeze([]) as string[];
const EMPTY_STATUS_MAP: ApprovalStatusMap = Object.freeze({}) as ApprovalStatusMap;

export const slashState = {
  subscribe,

  // ── Polls (local only) ────────────────────────────────────────────
  getPollVote(pollId: string): string[] {
    return state.pollVotes[pollId] ?? EMPTY_VOTE;
  },
  togglePollVote(pollId: string, optionId: string, multi: boolean) {
    const current = state.pollVotes[pollId] ?? [];
    let next: string[];
    if (multi) {
      next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
    } else {
      next = current[0] === optionId ? [] : [optionId];
    }
    const map = { ...state.pollVotes };
    if (next.length === 0) delete map[pollId];
    else map[pollId] = next;
    state = { ...state, pollVotes: map };
    persist();
    emit();
  },

  // ── RSVPs (local only) ────────────────────────────────────────────
  getRsvp(eventId: string): Rsvp {
    return state.rsvps[eventId] ?? "pending";
  },
  setRsvp(eventId: string, response: Rsvp) {
    const map = { ...state.rsvps };
    if (response === "pending") delete map[eventId];
    else map[eventId] = response;
    state = { ...state, rsvps: map };
    persist();
    emit();
  },

  // ── Approvals (live, socket-driven) ───────────────────────────────
  getApprovalStatuses(approvalId: string): ApprovalStatusMap {
    return state.approvalStatuses[approvalId] ?? EMPTY_STATUS_MAP;
  },
  getApprovalOverall(approvalId: string): ApprovalDecision | undefined {
    return state.approvalOverall[approvalId];
  },
  // Merge a single approver's decision in. Called from useSlashCardSync on
  // "slash:approval-decided" and also after the local POST succeeds so the
  // card flips instantly without waiting for the round-trip echo.
  applyApprovalDecision(
    approvalId: string,
    userId: string,
    decision: ApprovalDecision,
    overall?: ApprovalDecision
  ) {
    const statusMap = { ...(state.approvalStatuses[approvalId] || {}) };
    statusMap[userId] = decision;
    const nextStatuses = { ...state.approvalStatuses, [approvalId]: statusMap };
    const nextOverall = { ...state.approvalOverall };
    if (overall) nextOverall[approvalId] = overall;
    state = { ...state, approvalStatuses: nextStatuses, approvalOverall: nextOverall };
    persist();
    emit();
  },

  // ── Deals (live, socket-driven) ───────────────────────────────────
  getDealStage(dealId: string): DealStage | undefined {
    return state.dealStages[dealId];
  },
  setDealStage(dealId: string, stage: DealStage) {
    state = { ...state, dealStages: { ...state.dealStages, [dealId]: stage } };
    persist();
    emit();
  },

  // ── Tasks (stage + assignee overrides — Taskrooms PUT + optional echo) ─
  getTaskStage(taskId: string): string | undefined {
    return state.taskStages[taskId];
  },
  setTaskStage(taskId: string, stageId: string) {
    state = { ...state, taskStages: { ...state.taskStages, [taskId]: stageId } };
    persist();
    emit();
  },
  getTaskAssignee(taskId: string): TaskAssigneeOverride | undefined {
    return state.taskAssignees[taskId];
  },
  setTaskAssignee(taskId: string, assignee: TaskAssigneeOverride) {
    state = {
      ...state,
      taskAssignees: { ...state.taskAssignees, [taskId]: assignee },
    };
    persist();
    emit();
  },
};

export function usePollVote(pollId: string): string[] {
  return useSyncExternalStore<string[]>(
    slashState.subscribe,
    () => slashState.getPollVote(pollId),
    () => EMPTY_VOTE
  );
}

export function useRsvp(eventId: string): Rsvp {
  return useSyncExternalStore<Rsvp>(
    slashState.subscribe,
    () => slashState.getRsvp(eventId),
    () => "pending"
  );
}

export function useApprovalStatuses(approvalId: string): ApprovalStatusMap {
  return useSyncExternalStore<ApprovalStatusMap>(
    slashState.subscribe,
    () => slashState.getApprovalStatuses(approvalId),
    () => EMPTY_STATUS_MAP
  );
}

export function useApprovalOverall(approvalId: string): ApprovalDecision | undefined {
  return useSyncExternalStore<ApprovalDecision | undefined>(
    slashState.subscribe,
    () => slashState.getApprovalOverall(approvalId),
    () => undefined
  );
}

export function useDealStage(dealId: string): DealStage | undefined {
  return useSyncExternalStore<DealStage | undefined>(
    slashState.subscribe,
    () => slashState.getDealStage(dealId),
    () => undefined
  );
}

export function useTaskStage(taskId: string): string | undefined {
  return useSyncExternalStore<string | undefined>(
    slashState.subscribe,
    () => slashState.getTaskStage(taskId),
    () => undefined
  );
}

export function useTaskAssignee(taskId: string): TaskAssigneeOverride | undefined {
  return useSyncExternalStore<TaskAssigneeOverride | undefined>(
    slashState.subscribe,
    () => slashState.getTaskAssignee(taskId),
    () => undefined
  );
}
