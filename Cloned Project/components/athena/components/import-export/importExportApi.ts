import type { ImportTaskRow, RoomStage, UploadResult } from "./types";
import { normalizePriority, parseDateToTimestamp } from "./parseSpreadsheet";
import type { RoomCustomFieldDef } from "./roomCustomFields";

const TASKROOM_BASE = (
  process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/"
).replace(/\/+$/, "") + "/";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("garage_tok") || "" : "";
}

function authHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type WorkspaceOption = { _id: string; name?: string };
export type SpaceOption = { _id: string; name?: string; workspaceId?: string };
export type RoomOption = { _id: string; name?: string; spaceId?: string };

export type ListMetadata = {
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
  count?: number;
};

export const TARGET_LIST_PAGE_SIZE = 25;

export function hasMorePages(metadata: ListMetadata | null): boolean {
  if (!metadata) return false;
  if (metadata.nextPage != null) return true;
  return metadata.currentPage < metadata.totalPages;
}

function parseListMetadata(
  metadata: Record<string, unknown> | undefined,
  page: number,
  dataLength: number
): ListMetadata {
  return {
    count: typeof metadata?.count === "number" ? metadata.count : undefined,
    totalPages: (metadata?.totalPages as number) ?? 1,
    currentPage: (metadata?.currentPage as number) ?? page,
    nextPage: (metadata?.nextPage as number | null) ?? null,
  };
}

function dedupeById<T extends { _id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?._id || seen.has(item._id)) return false;
    seen.add(item._id);
    return true;
  });
}

export async function fetchWorkspacesPage(
  page = 1,
  size = TARGET_LIST_PAGE_SIZE
): Promise<{ data: WorkspaceOption[]; metadata: ListMetadata }> {
  const res = await fetch(
    `${TASKROOM_BASE}workspaces/me?size=${size}&page=${page}`,
    { headers: authHeaders() }
  );
  const json = await res.json();
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || "Failed to fetch workspaces");
  }
  return {
    data: json?.data || [],
    metadata: parseListMetadata(json?.metadata, page, (json?.data || []).length),
  };
}

export async function fetchSpacesPage(
  workspaceId: string,
  page = 1,
  size = TARGET_LIST_PAGE_SIZE
): Promise<{ data: SpaceOption[]; metadata: ListMetadata }> {
  const res = await fetch(
    `${TASKROOM_BASE}spaces/me?workspaceId=${workspaceId}&page=${page}&size=${size}`,
    { headers: authHeaders() }
  );
  const json = await res.json();
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || "Failed to fetch spaces");
  }
  return {
    data: json?.data || [],
    metadata: parseListMetadata(json?.metadata, page, (json?.data || []).length),
  };
}

export async function fetchRoomsPage(
  spaceId: string,
  page = 1,
  size = TARGET_LIST_PAGE_SIZE
): Promise<{ data: RoomOption[]; metadata: ListMetadata }> {
  const res = await fetch(
    `${TASKROOM_BASE}rooms/me?spaceId=${spaceId}&page=${page}&size=${size}`,
    { headers: authHeaders() }
  );
  const json = await res.json();
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || "Failed to fetch rooms");
  }
  return {
    data: json?.data || [],
    metadata: parseListMetadata(json?.metadata, page, (json?.data || []).length),
  };
}

export { dedupeById };

/** @deprecated Use fetchWorkspacesPage for pagination */
export async function fetchWorkspacesList(): Promise<WorkspaceOption[]> {
  const { data } = await fetchWorkspacesPage(1, 100);
  return data;
}

/** @deprecated Use fetchSpacesPage for pagination */
export async function fetchSpacesList(workspaceId: string): Promise<SpaceOption[]> {
  const { data } = await fetchSpacesPage(workspaceId, 1, 100);
  return data;
}

/** @deprecated Use fetchRoomsPage for pagination */
export async function fetchRoomsList(spaceId: string): Promise<RoomOption[]> {
  const { data } = await fetchRoomsPage(spaceId, 1, 100);
  return data;
}

export async function fetchRoomStages(roomId: string): Promise<RoomStage[]> {
  const res = await fetch(`${TASKROOM_BASE}stages/room/${roomId}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || "Failed to fetch room stages");
  }
  const stages = json?.data || [];
  return stages.map((s: { _id: string; name: string; stageType?: string }) => ({
    _id: s._id,
    name: s.name,
    stageType: s.stageType,
  }));
}

export async function fetchRoomCustomFields(
  roomId: string
): Promise<RoomCustomFieldDef[]> {
  const res = await fetch(`${TASKROOM_BASE}rooms/${roomId}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || "Failed to fetch room custom fields");
  }
  const room = json?.data?.data ?? json?.data;
  return Array.isArray(room?.customFields) ? room.customFields : [];
}

function resolveStageId(stageName: string | undefined, stages: RoomStage[]): string {
  if (!stages.length) return "";
  if (!stageName?.trim()) return stages[0]._id;
  const normalized = stageName.trim().toLowerCase();
  const match = stages.find((s) => s.name.trim().toLowerCase() === normalized);
  return match?._id || stages[0]._id;
}

type BulkTaskPayload = {
  title: string;
  description?: string;
  stageId: string;
  roomId: string;
  priority?: string;
  startDate?: number | null;
  dueDate?: number | null;
  tags?: string[];
  assignedToIds?: string[];
  customFields?: Record<string, string | number | null>;
};

function buildTaskPayload(
  row: ImportTaskRow,
  roomId: string,
  stages: RoomStage[]
): BulkTaskPayload {
  const tags = row.tags
    ? row.tags.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
    : [];

  return {
    title: row.title.trim().slice(0, 500),
    description: row.description?.trim().slice(0, 5000) || "",
    stageId: resolveStageId(row.stage, stages),
    roomId,
    priority: normalizePriority(row.priority),
    startDate: parseDateToTimestamp(row.startDate),
    dueDate: parseDateToTimestamp(row.dueDate),
    tags,
    assignedToIds: [],
    ...(row.customFields && Object.keys(row.customFields).length > 0
      ? { customFields: row.customFields }
      : {}),
  };
}

function parseBulkUploadResult(
  json: Record<string, unknown>,
  total: number
): UploadResult {
  const result: UploadResult = {
    total,
    successful: 0,
    failed: 0,
    errors: [],
  };

  const data = json.data as Record<string, unknown> | unknown[] | undefined;
  const nested =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;

  const successful =
    Number(nested?.successful ?? nested?.successCount ?? json.successful) || 0;
  const failed =
    Number(nested?.failed ?? nested?.failedCount ?? json.failed) || 0;

  if (successful > 0 || failed > 0) {
    result.successful = successful;
    result.failed = failed;
  } else if (Array.isArray(data)) {
    result.successful = data.length;
  } else {
    result.successful = total;
  }

  const failedItems =
    (nested?.failedTasks as Array<{ row?: number; error?: string; message?: string }>) ||
    (nested?.errors as Array<{ row?: number; error?: string; message?: string }>) ||
    (json.failedTasks as Array<{ row?: number; error?: string; message?: string }>) ||
    [];

  failedItems.forEach((item, index) => {
    result.errors.push({
      row: item.row ?? index + 1,
      message: item.error || item.message || "Import failed",
    });
  });

  if (result.successful + result.failed < total && result.failed === 0) {
    result.successful = total;
  }

  return result;
}

/** Single POST to tasks/bulk — no per-row fallback requests. */
export async function importTasksToRoom(
  roomId: string,
  rows: ImportTaskRow[],
  stages: RoomStage[],
  onProgress?: (done: number, total: number) => void
): Promise<UploadResult> {
  const payloads = rows.map((row) => buildTaskPayload(row, roomId, stages));
  const result: UploadResult = {
    total: payloads.length,
    successful: 0,
    failed: 0,
    errors: [],
  };

  if (payloads.length === 0) return result;

  onProgress?.(0, payloads.length);

  const res = await fetch(`${TASKROOM_BASE}tasks/bulk`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ roomId, tasks: payloads }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok || json?.status === false || json?.success === false) {
    throw new Error(
      (json?.message as string) ||
        (json?.error as string) ||
        `Bulk import failed (${res.status})`
    );
  }

  const parsed = parseBulkUploadResult(json, payloads.length);
  onProgress?.(payloads.length, payloads.length);
  return parsed;
}

export type ExportTaskRow = {
  title: string;
  description: string;
  stage: string;
  priority: string;
  startDate: string;
  dueDate: string;
  assignees: string;
  tags: string;
};

export async function fetchRoomTasksForExport(roomId: string): Promise<ExportTaskRow[]> {
  const res = await fetch(
    `${TASKROOM_BASE}rooms/detail/${roomId}?page=1&size=50&cardSize=500`,
    { headers: authHeaders() }
  );
  const json = await res.json();
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || "Failed to fetch room tasks");
  }

  const stages = json?.data || [];
  const rows: ExportTaskRow[] = [];

  stages.forEach((stage: { name?: string; cardData?: Array<Record<string, unknown>> }) => {
    (stage.cardData || []).forEach((card) => {
      const assignees = Array.isArray(card.assigneeData)
        ? (card.assigneeData as Array<{ name?: string; email?: string }>)
            .map((a) => a.name || a.email || "")
            .filter(Boolean)
            .join(", ")
        : "";
      const tagNames = Array.isArray(card.tagData)
        ? (card.tagData as Array<{ name?: string }>)
            .map((t) => t.name || "")
            .filter(Boolean)
            .join(", ")
        : "";

      rows.push({
        title: String(card.title || card.name || ""),
        description: String(card.description || ""),
        stage: String(stage.name || ""),
        priority: String(card.priority || ""),
        startDate: card.startDate ? new Date(Number(card.startDate)).toLocaleDateString() : "",
        dueDate: card.dueDate ? new Date(Number(card.dueDate)).toLocaleDateString() : "",
        assignees,
        tags: tagNames,
      });
    });
  });

  return rows;
}
