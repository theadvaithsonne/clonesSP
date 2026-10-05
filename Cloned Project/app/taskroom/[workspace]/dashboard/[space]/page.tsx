"use client";
import React, { useEffect, useMemo, useState, use } from "react";
import { useListViewDetailStore } from "@/store/taskroom/listViewDetailStore";
import { ListView, Task, TaskGroup, sortNewestFirst } from "../../../components/ListView";

// Accepts both the API shape (title, assignedToId, assigneeData) and ListView's
// own Task shape, which handleUpdateStages writes back into the store. Every
// ListView edit round-trips through here, so the second case must be lossless:
// dropping subtasks/members here made new subtasks vanish and wiped assignees.
const mapRawTask = (t: any): Task => ({
  ...t,
  _id: t?._id,
  id: t?._id ?? t?.id,
  name: t?.title || t?.name || "Untitled",
  assignedToIds: Array.isArray(t?.assignedToIds) ? t.assignedToIds : [t?.assignedToId],
  members: Array.isArray(t?.members) ? t.members : (t?.assigneeData || []),
  subtasks: sortNewestFirst<any>(Array.isArray(t?.subtasks) ? t.subtasks : []).map(mapRawTask),
});

// Inverse of mapRawTask: keep `title` in step with `name` at every depth so a
// rename survives the next mapRawTask pass.
const toRawTask = (t: Task): any => ({
  ...t,
  title: t.name,
  subtasks: (t.subtasks || []).map(toRawTask),
});

const mapStageDetailToTaskGroup = (stage: any): TaskGroup => {
  const stageId = stage?._id || stage?.id || `stage-${Math.random().toString(36).slice(2)}`;
  const stageName = stage?.name || stage?.status || "Stage";
  const stageColor = stage?.color || "#64748b";
  const stageType = stage?.stageType || stage?.type;

  const rawTasks: any[] = Array.isArray(stage?.cardData) ? stage.cardData : [];
  const tasks: Task[] = sortNewestFirst<any>(rawTasks).map(mapRawTask);

  return {
    id: String(stageId),
    status: String(stageName),
    color: stageColor,
    type: stageType,
    tasks,
  };
};

export default function TaskroomsPage({
  searchParams,
}: {
  searchParams?: Promise<{ roomId?: string }> | { roomId?: string };
}) {
  // Unwrap searchParams correctly for Next.js 15
  const resolvedSearchParams = searchParams instanceof Promise ? use(searchParams) : searchParams;
  const roomId = resolvedSearchParams?.roomId;
  const {
    stageDetail: rawStageDetail,
    setStageDetail: setRawStageDetail,
    fetchstageDetail,
    isLoadingRoom: isLoading,
    error: storeError
  } = useListViewDetailStore();
  console.log("cxjcnzxjczxczxc", rawStageDetail)
  const stageDetail = useMemo(() => {
    if (rawStageDetail && Array.isArray(rawStageDetail)) {
      return rawStageDetail.map(mapStageDetailToTaskGroup);
    }
    return [];
  }, [rawStageDetail]);

  const handleUpdateStages = (newGroups: TaskGroup[]) => {
    const updatedRaw = (rawStageDetail || []).map(stage => {
      const matchingGroup = newGroups.find(g => g.id === String(stage._id));
      if (matchingGroup) {
        return {
          ...stage,
          cardData: matchingGroup.tasks.map(toRawTask),
        };
      }
      return stage;
    });
    setRawStageDetail(updatedRaw);
  };

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleOpenTask = (task: Task) => {
    setSelectedTask(task);
    console.log("Open task", task.id);
  };



  useEffect(() => {
    alert()
    if (roomId) {
      fetchstageDetail(roomId);
    }
  }, [roomId]);

  const emptyStateText = useMemo(() => {
    if (!roomId) return "Missing roomId in URL.";
    if (isLoading) return "Loading stage detail…";
    if (storeError) return storeError;
    return "No stages found.";
  }, [storeError, isLoading, roomId]);

  return (
    <div className="flex h-full flex-col ">


      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* <TaskroomSidebar /> */}

        <div className="flex min-w-0 flex-1 flex-col lg:flex-row  border-[0.5px]  border-[#e5e7eb29] border-l-0 rounded-tr rounded-br ">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden ">
            {/* {stageDetail.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center p-8 text-sm text-slate-400">
                {emptyStateText}
              </div>
            ) : (
              <ListView
                tasks={stageDetail}
                onChangeTasks={setStageDetail}
                onOpenTask={handleOpenTask}
              />
            )} */}
            <ListView
              tasks={stageDetail}
              roomId={roomId}
              onChangeTasks={handleUpdateStages}
              onOpenTask={handleOpenTask}
            />
          </div>

          {/* <TaskDetailModal
            task={selectedTask}
            open={!!selectedTask}
            onClose={() => setSelectedTask(null)}
          /> */}
        </div>
      </div>
    </div>
  );
}
