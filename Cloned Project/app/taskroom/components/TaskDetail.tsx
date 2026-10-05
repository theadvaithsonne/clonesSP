import React from "react";
import type { Task } from "./ListView";

interface TaskDetailProps {
  task: Task | null;
  onClose: () => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({ task, onClose }) => {
  if (!task) return null;

  return (
    <aside
      className="pointer-events-auto flex w-full max-w-md flex-col border-l border-slate-200 bg-white/95 shadow-xl backdrop-blur transition-transform duration-200"
      aria-label="Task details"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="flex-1 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Task
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            {task.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          aria-label="Close task details"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-3">
        <section aria-label="Task info" className="space-y-3">
          {task.status != null && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </h3>
              <p className="mt-1 text-sm text-slate-900">{task.status}</p>
            </div>
          )}
          {task.assignee && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assignee
              </h3>
              <p className="mt-1 text-sm text-slate-900">{task.assignee}</p>
            </div>
          )}
          {task.dueDate && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Due date
              </h3>
              <p className="mt-1 text-sm text-slate-900">{task.dueDate}</p>
            </div>
          )}
          {task.priority && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Priority
              </h3>
              <p className="mt-1 text-sm capitalize text-slate-900">{task.priority}</p>
            </div>
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Subtasks
              </h3>
              <ul className="mt-1 space-y-1">
                {task.subtasks.map((st) => (
                  <li key={st.id} className="text-sm text-slate-700">
                    {st.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
