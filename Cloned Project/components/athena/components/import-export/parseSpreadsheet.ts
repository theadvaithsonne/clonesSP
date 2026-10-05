import * as XLSX from "xlsx";
import type { ColumnMapping, ImportTaskRow, ParsedSheet, TaskFieldKey } from "./types";
import { MAPPABLE_TASK_FIELDS } from "./types";
import {
  customFieldIdFromMappingKey,
  customFieldMappingKey,
  customFieldTypeById,
  isCustomFieldMappingKey,
  parseCustomFieldValue,
  type RoomCustomFieldDef,
} from "./roomCustomFields";

const HEADER_ALIASES: Record<string, TaskFieldKey> = {
  title: "title",
  name: "title",
  "task name": "title",
  taskname: "title",
  "task title": "title",
  summary: "title",
  description: "description",
  details: "description",
  notes: "description",
  body: "description",
  stage: "stage",
  status: "stage",
  list: "stage",
  column: "stage",
  priority: "priority",
  "start date": "startDate",
  startdate: "startDate",
  start: "startDate",
  "due date": "dueDate",
  duedate: "dueDate",
  due: "dueDate",
  deadline: "dueDate",
  assignee: "assignees",
  assignees: "assignees",
  "assigned to": "assignees",
  owner: "assignees",
  tags: "tags",
  labels: "tags",
  tag: "tags",
};

export function normalizeHeader(header: string): string {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Convert raw xlsx cell values to display/import strings */
export function formatCellValue(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) {
    return raw.toLocaleDateString();
  }
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return String(raw);
  }
  if (typeof raw === "boolean") {
    return raw ? "true" : "false";
  }
  if (Array.isArray(raw)) {
    return raw.map(formatCellValue).filter(Boolean).join(", ");
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part: { t?: string }) => String(part?.t ?? ""))
        .join("")
        .trim();
    }
    if (typeof obj.text === "string") return obj.text.trim();
    if (obj.result !== undefined) return formatCellValue(obj.result);
    if (typeof obj.h === "string") return obj.h.trim();
    return "";
  }
  return String(raw).trim();
}

function buildHeaderColumnIndex(headerRow: unknown[]): {
  headers: string[];
  headerColumnIndex: Record<string, number>;
} {
  const headers: string[] = [];
  const headerColumnIndex: Record<string, number> = {};
  const usedNames = new Set<string>();

  headerRow.forEach((cell, colIdx) => {
    let label = formatCellValue(cell);
    if (!label) {
      label = `Column ${colIdx + 1}`;
    }

    let uniqueLabel = label;
    let suffix = 2;
    while (usedNames.has(uniqueLabel)) {
      uniqueLabel = `${label} (${suffix})`;
      suffix += 1;
    }

    usedNames.add(uniqueLabel);
    headers.push(uniqueLabel);
    headerColumnIndex[uniqueLabel] = colIdx;
  });

  return { headers, headerColumnIndex };
}

export function buildInitialColumnMapping(
  headers: string[],
  headerColumnIndex: Record<string, number>,
  roomCustomFields?: RoomCustomFieldDef[]
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();
  const canonicalToHeader = new Map<string, string>();

  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    if (!canonicalToHeader.has(normalized)) {
      canonicalToHeader.set(normalized, header);
    }
  });

  MAPPABLE_TASK_FIELDS.forEach((field) => {
    let matched: string | undefined;

    const direct = canonicalToHeader.get(field.key);
    if (direct && !usedHeaders.has(direct) && headerColumnIndex[direct] !== undefined) {
      matched = direct;
    }

    if (!matched) {
      const aliasEntry = Object.entries(HEADER_ALIASES).find(
        ([alias, key]) => key === field.key && canonicalToHeader.has(alias)
      );
      if (aliasEntry) {
        const header = canonicalToHeader.get(aliasEntry[0])!;
        if (!usedHeaders.has(header) && headerColumnIndex[header] !== undefined) {
          matched = header;
        }
      }
    }

    if (matched) {
      mapping[field.key] = matched;
      usedHeaders.add(matched);
    }
  });

  (roomCustomFields ?? []).forEach((field) => {
    const normalizedName = normalizeHeader(field.name);
    const header = canonicalToHeader.get(normalizedName);
    if (
      header &&
      !usedHeaders.has(header) &&
      headerColumnIndex[header] !== undefined
    ) {
      mapping[customFieldMappingKey(field._id)] = header;
      usedHeaders.add(header);
    }
  });

  return mapping;
}

export function getTopUniqueValues(
  sheet: ParsedSheet | null,
  columnName: string,
  limit = 10
): string[] {
  if (!sheet || !columnName) return [];
  const columnIndex = sheet.headerColumnIndex[columnName];
  if (columnIndex === undefined) return [];

  const unique = new Set<string>();
  for (const row of sheet.rows) {
    const value = formatCellValue(row[columnIndex]);
    if (!value) continue;
    unique.add(value);
    if (unique.size >= limit) break;
  }
  return Array.from(unique);
}

export function parseSpreadsheetFile(file: File): Promise<ParsedSheet[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const extractedSheets: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
            raw: false,
          }) as unknown[][];

          const rows = jsonData.filter(
            (row) => Array.isArray(row) && row.some((cell) => formatCellValue(cell) !== "")
          );
          const headerRow = rows[0] || [];
          const { headers, headerColumnIndex } = buildHeaderColumnIndex(headerRow);

          return {
            name: sheetName,
            headers,
            headerColumnIndex,
            rows: rows.slice(1),
          };
        }).filter((sheet) => sheet.headers.length > 0);

        if (extractedSheets.length === 0) {
          reject(new Error("File is empty or missing column headers"));
          return;
        }
        resolve(extractedSheets);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export function applyColumnMapping(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  roomCustomFields?: RoomCustomFieldDef[]
): ImportTaskRow[] {
  const typeById = customFieldTypeById(roomCustomFields);

  return sheet.rows
    .map((row) => {
      const mapped: ImportTaskRow = { title: "" };
      const customFields: Record<string, string | number | null> = {};

      Object.entries(mapping).forEach(([key, header]) => {
        if (!header) return;
        const colIdx = sheet.headerColumnIndex[header];
        if (colIdx === undefined) return;
        const value = formatCellValue(row[colIdx]);
        if (!value) return;

        if (isCustomFieldMappingKey(key)) {
          const fieldId = customFieldIdFromMappingKey(key);
          const fieldType = typeById.get(fieldId) ?? "text";
          const parsed = parseCustomFieldValue(fieldType, value);
          if (parsed !== null && parsed !== "") {
            customFields[fieldId] = parsed;
          }
          return;
        }

        (mapped as Record<string, string>)[key] = value;
      });

      if (Object.keys(customFields).length > 0) {
        mapped.customFields = customFields;
      }

      return mapped;
    })
    .filter((row) => row.title.trim().length > 0);
}

export function parseDateToTimestamp(value?: string): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && asNumber > 0) {
    if (asNumber < 100000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      excelEpoch.setUTCDate(excelEpoch.getUTCDate() + asNumber);
      return excelEpoch.getTime();
    }
    return asNumber;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function normalizePriority(value?: string): string {
  const v = (value || "").trim().toLowerCase();
  if (["urgent", "high", "h"].includes(v)) return "high";
  if (["low", "l"].includes(v)) return "low";
  if (["normal", "medium", "med", "m"].includes(v)) return "normal";
  return v || "normal";
}
