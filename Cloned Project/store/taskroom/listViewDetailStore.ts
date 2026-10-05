import { create } from "zustand";
import axios from "axios";

type ApiStatusResponse<T> = {
  status?: boolean;
  success?: boolean;
  message?: string;
  data?: T;
};

export type TaskroomTaskDetail = any;
export type TaskroomSubtaskDetail = any;
export type TaskroomstageDetail = any;

interface ListViewDetailState {
  isLoadingRoom: boolean;
  isLoadingTask: boolean;
  isLoadingSubtask: boolean;
  error: string | null;

  stageDetail: TaskroomstageDetail | [];
  taskDetailsById: Record<string, TaskroomTaskDetail | undefined>;
  subtaskDetailsById: Record<string, TaskroomSubtaskDetail | undefined>;

  setStageDetail: (detail: TaskroomstageDetail) => void;
  fetchstageDetail: (roomId: string) => Promise<TaskroomstageDetail | null>;
  fetchTaskDetail: (taskId: string) => Promise<TaskroomTaskDetail | null>;
  fetchSubtaskDetail: (subtaskId: string) => Promise<TaskroomSubtaskDetail | null>;

  clearError: () => void;
  reset: () => void;
}

const getTaskroomBaseUrl = () => {
  // Existing code in this repo uses hardcoded `https://uatapi.garage.app/taskroom/v1/...` in a few places.
  // Prefer env if you add one later, but keep a safe default.
  const fromEnv =
    process.env.NEXT_PUBLIC_TASKROOM_API_BASE_URL ||
    process.env.NEXT_PUBLIC_TASKROOM_BASE_URL;
  const base = (fromEnv || "https://uatapi.garage.app/taskroom/v1/").trim();
  return base.endsWith("/") ? base : `${base}/`;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("garage_tok");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const isOk = (res: ApiStatusResponse<unknown>) => Boolean(res?.status || res?.success);

export const useListViewDetailStore = create<ListViewDetailState>((set, get) => ({
  isLoadingRoom: true,
  isLoadingTask: false,
  isLoadingSubtask: false,
  error: null,

  stageDetail: [],
  taskDetailsById: {},
  subtaskDetailsById: {},

  setStageDetail: (detail) => set({ stageDetail: detail }),
  clearError: () => set({ error: null }),
  reset: () =>
    set({
      isLoadingRoom: false,
      isLoadingTask: false,
      isLoadingSubtask: false,
      error: null,
      stageDetail: [],
      taskDetailsById: {},
      subtaskDetailsById: {},
    }),

  fetchstageDetail: async (roomId: string) => {
    if (!roomId) return null;
    set({ isLoadingRoom: true, error: null });
    try {
      const base = getTaskroomBaseUrl();
      const res = await axios.get<ApiStatusResponse<any>>(`${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/detail/${roomId}`, {
        headers: getAuthHeaders(),
      });
      const payload = res.data;
      if (!isOk(payload)) {
        const msg = payload?.message || "Failed to load room detail";
        set({ error: msg, isLoadingRoom: false });
        return null;
      }
      console.log("payload", payload?.data)
      set({ stageDetail: payload?.data ?? null, isLoadingRoom: false });
      return payload?.data ?? null;
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to load room detail";
      set({ error: msg, isLoadingRoom: false });
      return null;
    }
  },

  fetchTaskDetail: async (taskId: string) => {
    if (!taskId) return null;
    if (get().taskDetailsById[taskId]) return get().taskDetailsById[taskId] ?? null;
    set({ isLoadingTask: true, error: null });
    try {
      const base = getTaskroomBaseUrl();
      const res = await axios.get<ApiStatusResponse<any>>(`${base}tasks/detail/${taskId}`, {
        headers: getAuthHeaders(),
      });
      const payload = res.data;
      if (!isOk(payload)) {
        const msg = payload?.message || "Failed to load task detail";
        set({ error: msg, isLoadingTask: false });
        return null;
      }
      const detail = payload?.data ?? null;
      set((s) => ({
        taskDetailsById: { ...s.taskDetailsById, [taskId]: detail ?? undefined },
        isLoadingTask: false,
      }));
      return detail;
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to load task detail";
      set({ error: msg, isLoadingTask: false });
      return null;
    }
  },

  fetchSubtaskDetail: async (subtaskId: string) => {
    if (!subtaskId) return null;
    if (get().subtaskDetailsById[subtaskId]) return get().subtaskDetailsById[subtaskId] ?? null;
    set({ isLoadingSubtask: true, error: null });
    try {
      const base = getTaskroomBaseUrl();
      const res = await axios.get<ApiStatusResponse<any>>(`${base}subtask/detail/${subtaskId}`, {
        headers: getAuthHeaders(),
      });
      const payload = res.data;
      if (!isOk(payload)) {
        const msg = payload?.message || "Failed to load subtask detail";
        set({ error: msg, isLoadingSubtask: false });
        return null;
      }
      const detail = payload?.data ?? null;
      set((s) => ({
        subtaskDetailsById: { ...s.subtaskDetailsById, [subtaskId]: detail ?? undefined },
        isLoadingSubtask: false,
      }));
      return detail;
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to load subtask detail";
      set({ error: msg, isLoadingSubtask: false });
      return null;
    }
  },
}));

