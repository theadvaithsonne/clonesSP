"use client";

// Single global subscription that pipes server-side slash card events into
// the slash-state store. Designed to be called from each chat page that
// renders cards (DM, GlobalDM, Group) — calls are idempotent because the
// listeners are tracked by a module-level ref-count, so mounting on three
// pages still attaches exactly one socket listener per event.
//
// This lets cards read live state via useSyncExternalStore without each card
// owning its own socket subscription.

import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { slashState } from "@/lib/slash-state";
import type { DealStage } from "@/lib/chat-markers";
import type { ApprovalDecision } from "@/lib/slash-state";

let refCount = 0;
let attached = false;

function onApprovalDecided(payload: {
  approvalId: string;
  userId: string;
  decision: ApprovalDecision;
  overallStatus?: ApprovalDecision;
}) {
  if (!payload?.approvalId || !payload?.userId) return;
  slashState.applyApprovalDecision(
    payload.approvalId,
    payload.userId,
    payload.decision,
    payload.overallStatus
  );
}

function onDealUpdated(payload: { dealId: string; stage: DealStage }) {
  if (!payload?.dealId || !payload?.stage) return;
  slashState.setDealStage(payload.dealId, payload.stage);
}

function onTaskUpdated(payload: { taskId: string; stageId: string }) {
  if (!payload?.taskId || !payload?.stageId) return;
  slashState.setTaskStage(payload.taskId, payload.stageId);
}

function attach() {
  if (attached) return;
  const s = getSocket();
  s.on("slash:approval-decided", onApprovalDecided);
  s.on("slash:deal-updated", onDealUpdated);
  s.on("slash:task-updated", onTaskUpdated);
  attached = true;
}

function detach() {
  if (!attached) return;
  const s = getSocket();
  s.off("slash:approval-decided", onApprovalDecided);
  s.off("slash:deal-updated", onDealUpdated);
  s.off("slash:task-updated", onTaskUpdated);
  attached = false;
}

export function useSlashCardSync() {
  useEffect(() => {
    refCount += 1;
    if (refCount === 1) attach();
    return () => {
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0) detach();
    };
  }, []);
}
