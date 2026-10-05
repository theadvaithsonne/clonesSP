export type ImportExportStep =
  | "target"
  | "upload"
  | "sheet"
  | "mapping"
  | "review";

export type ParsedSheet = {
  name: string;
  headers: string[];
  /** Maps header label → original column index in each row */
  headerColumnIndex: Record<string, number>;
  rows: unknown[][];
};

export type ImportTaskRow = {
  title: string;
  description?: string;
  stage?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  assignees?: string;
  tags?: string;
  customFields?: Record<string, string | number | null>;
};

export type TaskFieldKey = keyof Omit<ImportTaskRow, "customFields">;

/** Maps task field key (standard or cf:fieldId) → spreadsheet column header */
export type ColumnMapping = Partial<Record<string, string>>;

export type RoomStage = {
  _id: string;
  name: string;
  stageType?: string;
};

export type UploadResult = {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

export const MAPPABLE_TASK_FIELDS: Array<{
  key: TaskFieldKey;
  label: string;
  required?: boolean;
}> = [
  { key: "title", label: "Task Name", required: true },
  { key: "description", label: "Description" },
  { key: "stage", label: "Status / Stage" },
  { key: "priority", label: "Priority" },
  { key: "startDate", label: "Start Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "assignees", label: "Assignees" },
  { key: "tags", label: "Tags" },
];

export const IMPORT_STEPS: Array<{ id: ImportExportStep; label: string }> = [
  { id: "target", label: "Destination" },
  { id: "upload", label: "Upload" },
  { id: "sheet", label: "Sheet" },
  { id: "mapping", label: "Map fields" },
  { id: "review", label: "Import" },
];
