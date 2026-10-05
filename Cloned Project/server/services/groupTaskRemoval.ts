// src/services/groupTaskRemoval.ts
//
// Taking AI-filed Taskroom tasks back out (services/groupTaskAuto.ts files them).
//
// Two entry points:
//
//   • removeAiTasksForDeletedMessage — "delete the message, delete the task".
//     Called only by the explicit user delete
//     (DELETE /groups/:groupId/message/:messageId). Retention sweeps and
//     account cleanup also blank messages, but nobody asked for the work to be
//     cancelled there, so their tasks are left alone. Only the message that
//     TRIGGERED a task takes it down: deleting a reply that merely assigned the
//     task, or a screenshot that was attached to it, leaves the task standing.
//
//   • removeAiTasksFromMessage — the "Remove from Taskroom" menu action
//     (DELETE /groups/:groupId/message/:messageId/taskroom). The message stays;
//     every task it is marked with goes, whether it triggered the task or was a
//     follow-up that got the same mark.
//
// Either way the task's mark is pulled from every message that carries it (the
// trigger, attached screenshots, assignment replies) and a
// "Task removed from Taskroom" pill is written.
//
// Taskroom's own delete is a soft delete (`status: "inactive"`), so a task
// removed by mistake is still recoverable on that side.

import { Types } from "mongoose";
import { Group } from "../models/group.model";
import { GroupMessage } from "../models/groupMessage.model";
import { GroupAiTask } from "../models/groupAiTask.model";
import { taskroomRequest, mintUserToken } from "./taskroomProvision";
import { withTaskroomActor } from "./groupTaskroomActor";
import { writeGroupSystemMessage } from "./groupSystemMessage";
import { getSocketInstance } from "./socket";

/** Taskroom's answer when the task is already gone — the job is done. */
function isAlreadyGone(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /couldn'?t find|not found|no record/i.test(message);
}

async function deleteTaskroomTask(
  group: any,
  taskroomTaskId: string,
  actorId: string
): Promise<void> {
  const remove = (token: string) =>
    taskroomRequest(`tasks/${taskroomTaskId}`, { method: "DELETE", token }).catch(
      (error) => {
        if (isAlreadyGone(error)) return null;
        throw error;
      }
    );

  // Still linked: act through the usual candidates, the actor first.
  if (group.taskroom?.roomId) {
    await withTaskroomActor(group, (token) => remove(token), actorId);
    return;
  }

  // Unlinked since the task was filed: the actor's own token is the best
  // remaining option (the reporter or an admin of the group).
  await remove(await mintUserToken(actorId, group.orgId));
}

/**
 * Delete each task in Taskroom, forget it, strip its mark from every message
 * that carries it, and leave a pill. Returns how many were removed and how
 * many Taskroom refused.
 */
async function removeTasks(
  groupId: string,
  group: any,
  tasks: any[],
  actorId: string
): Promise<{ removed: number; failed: number }> {
  let removed = 0;
  let failed = 0;

  for (const task of tasks) {
    const taskId = String(task.taskroomTaskId);
    try {
      await deleteTaskroomTask(group, taskId, actorId);
    } catch (error) {
      // Keep the record so the task is still traceable to its message.
      failed++;
      console.warn(
        `[group-task-removal] could not delete task ${taskId} group=${groupId}:`,
        error instanceof Error ? error.message : error
      );
      continue;
    }

    await GroupAiTask.deleteOne({ _id: task._id });

    // Every message marked with this task — found by the mark itself rather
    // than the record's source list, so assignment replies are covered too.
    const groupObjectId = new Types.ObjectId(groupId);
    await GroupMessage.updateMany(
      { groupId: groupObjectId, "aiTasks.taskId": taskId },
      { $pull: { aiTasks: { taskId } } }
    );
    const touched: any[] = await GroupMessage.find({
      _id: {
        $in: [task.messageId, ...(task.sourceMessageIds || [])].filter(Boolean),
      },
    })
      .select("aiTasks")
      .lean();
    const io = getSocketInstance();
    if (io) {
      for (const m of touched) {
        io.to(`group:${groupId}`).emit("group:message-task", {
          groupId,
          messageId: String(m._id),
          aiTasks: m.aiTasks || [],
        });
      }
    }

    void writeGroupSystemMessage({
      groupId,
      event: "ai_task_removed",
      actorId,
      meta: { taskTitle: task.title },
    });

    removed++;
    console.log(
      `[group-task-removal] removed task ${taskId} group=${groupId} msg=${String(task.messageId)}`
    );
  }

  return { removed, failed };
}

/**
 * Remove specific tasks by their GroupAiTask rows, from the same code path the
 * message-level removals use — Taskroom soft-delete, mark pull from every
 * message that carries them, and an `ai_task_removed` pill each. The by-id
 * route (services/groupTaskManual.ts) uses this so a manual task comes out the
 * same way an AI one does.
 */
export async function removeGroupTasks(
  groupId: string,
  group: any,
  tasks: any[],
  actorId: string
): Promise<{ removed: number; failed: number }> {
  return removeTasks(groupId, group, tasks, actorId);
}

async function loadGroup(groupId: string): Promise<any | null> {
  const group: any = await Group.findById(groupId)
    .select("orgId members createdBy taskroom")
    .lean();
  return group?.orgId ? group : null;
}

/**
 * The deleted message's own tasks go with it. Best-effort and never throws:
 * the message is already deleted by the time this runs, and a Taskroom hiccup
 * must not turn that into an error.
 */
export async function removeAiTasksForDeletedMessage(
  groupId: string,
  messageId: string,
  actorId: string
): Promise<void> {
  try {
    if (!Types.ObjectId.isValid(groupId) || !Types.ObjectId.isValid(messageId)) {
      return;
    }

    const tasks: any[] = await GroupAiTask.find({
      groupId: new Types.ObjectId(groupId),
      messageId: new Types.ObjectId(messageId),
    }).lean();
    if (!tasks.length) return;

    const group = await loadGroup(groupId);
    if (!group) return;

    await removeTasks(groupId, group, tasks, actorId);
  } catch (error) {
    console.warn(
      "[group-task-removal] failed:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * "Remove from Taskroom": remove every task the message is marked with (or
 * triggered) and keep the message. The caller has already checked the actor
 * is the message's sender or a group admin. `found: 0` means the message has
 * no task; `forbidden` means it only carries tasks somebody else reported.
 */
export async function removeAiTasksFromMessage(
  groupId: string,
  message: any,
  actorId: string,
  opts: { isAdmin: boolean }
): Promise<{ found: number; removed: number; failed: number; forbidden?: boolean }> {
  const markedTaskIds: string[] = (message?.aiTasks || [])
    .map((t: any) => t?.taskId)
    .filter(Boolean)
    .map(String);

  const tasks: any[] = await GroupAiTask.find({
    groupId: new Types.ObjectId(groupId),
    $or: [
      { messageId: message._id },
      ...(markedTaskIds.length ? [{ taskroomTaskId: { $in: markedTaskIds } }] : []),
    ],
  }).lean();
  if (!tasks.length) return { found: 0, removed: 0, failed: 0 };

  // A reply that assigned a task, or a screenshot attached to one, carries
  // that task's mark — but its sender did not report it. Non-admins may only
  // remove tasks they reported or that this very message produced.
  const allowed = opts.isAdmin
    ? tasks
    : tasks.filter(
        (t) =>
          String(t.fromUserId) === actorId ||
          String(t.messageId) === String(message._id)
      );
  if (!allowed.length) {
    return { found: tasks.length, removed: 0, failed: 0, forbidden: true };
  }

  const group = await loadGroup(groupId);
  if (!group) return { found: allowed.length, removed: 0, failed: allowed.length };

  const { removed, failed } = await removeTasks(groupId, group, allowed, actorId);
  return { found: allowed.length, removed, failed };
}
