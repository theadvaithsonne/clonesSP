"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  IMPORT_STEPS,
  MAPPABLE_TASK_FIELDS,
  type ColumnMapping,
  type ImportExportStep,
  type ImportTaskRow,
  type ParsedSheet,
  type RoomStage,
  type UploadResult,
} from "./types";
import {
  applyColumnMapping,
  buildInitialColumnMapping,
  getTopUniqueValues,
  parseSpreadsheetFile,
} from "./parseSpreadsheet";
import {
  customFieldIdFromMappingKey,
  isCustomFieldMappingKey,
  mapRoomCustomFieldsToMappable,
  type MappableField,
  type RoomCustomFieldDef,
} from "./roomCustomFields";
import { PaginatedSelectColumn } from "./PaginatedSelectColumn";
import {
  dedupeById,
  fetchRoomCustomFields,
  fetchRoomStages,
  fetchRoomTasksForExport,
  fetchRoomsPage,
  fetchSpacesPage,
  fetchWorkspacesPage,
  hasMorePages,
  importTasksToRoom,
  type ListMetadata,
  type RoomOption,
  type SpaceOption,
  type WorkspaceOption,
} from "./importExportApi";
import { ie } from "./importExportStyles";

type Mode = "import" | "export";

function capitalize(value?: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function StepIndicator({
  current,
  mode,
}: {
  current: ImportExportStep;
  mode: Mode;
}) {
  if (mode === "export") return null;

  const currentIndex = IMPORT_STEPS.findIndex((s) => s.id === current);

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      {IMPORT_STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = step.id === current;
        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                  ie.stepBadge,
                  isDone && "border-emerald-500/60 bg-emerald-500/15 text-emerald-400",
                  isActive && "border-brand bg-brand/20 text-brand",
                  !isDone && !isActive && "border-white/10 bg-white/5 text-white/40"
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span
                className={cn(
                  "hidden sm:inline",
                  ie.stepLabel,
                  isActive ? "text-white" : "text-white/40"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < IMPORT_STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-6 sm:w-10",
                  index < currentIndex ? "bg-emerald-500/40" : "bg-white/10"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ImportExportDashboard() {
  const [mode, setMode] = useState<Mode>("import");
  const [step, setStep] = useState<ImportExportStep>("target");

  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);

  const [workspaceId, setWorkspaceId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [roomId, setRoomId] = useState("");

  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingMoreWorkspaces, setLoadingMoreWorkspaces] = useState(false);
  const [workspacesMetadata, setWorkspacesMetadata] = useState<ListMetadata | null>(null);

  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingMoreSpaces, setLoadingMoreSpaces] = useState(false);
  const [spacesMetadata, setSpacesMetadata] = useState<ListMetadata | null>(null);

  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMoreRooms, setLoadingMoreRooms] = useState(false);
  const [roomsMetadata, setRoomsMetadata] = useState<ListMetadata | null>(null);

  const workspacesFetchRef = useRef(false);
  const spacesFetchRef = useRef(false);
  const roomsFetchRef = useRef(false);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [mappedRows, setMappedRows] = useState<ImportTaskRow[]>([]);
  const [roomCustomFields, setRoomCustomFields] = useState<RoomCustomFieldDef[]>([]);
  const [loadingCustomFields, setLoadingCustomFields] = useState(false);
  const [roomStages, setRoomStages] = useState<RoomStage[]>([]);

  const [parsingFile, setParsingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInFlightRef = useRef(false);

  const selectedSheet = useMemo(
    () => parsedSheets.find((s) => s.name === selectedSheetName) || null,
    [parsedSheets, selectedSheetName]
  );

  const selectedWorkspace = workspaces.find((w) => w._id === workspaceId);
  const selectedSpace = spaces.find((s) => s._id === spaceId);
  const selectedRoom = rooms.find((r) => r._id === roomId);

  const loadWorkspaces = useCallback(async (page = 1, append = false) => {
    if (workspacesFetchRef.current) return;
    workspacesFetchRef.current = true;
    if (append) setLoadingMoreWorkspaces(true);
    else setLoadingWorkspaces(true);

    try {
      const { data, metadata } = await fetchWorkspacesPage(page);
      setWorkspacesMetadata(metadata);
      setWorkspaces((prev) =>
        append ? dedupeById([...prev, ...data]) : data
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load workspaces");
      if (!append) setWorkspaces([]);
    } finally {
      setLoadingWorkspaces(false);
      setLoadingMoreWorkspaces(false);
      workspacesFetchRef.current = false;
    }
  }, []);

  const loadMoreWorkspaces = useCallback(() => {
    if (!hasMorePages(workspacesMetadata) || loadingWorkspaces || loadingMoreWorkspaces) {
      return;
    }
    const nextPage = workspacesMetadata!.nextPage ?? workspacesMetadata!.currentPage + 1;
    loadWorkspaces(nextPage, true);
  }, [workspacesMetadata, loadingWorkspaces, loadingMoreWorkspaces, loadWorkspaces]);

  const loadSpaces = useCallback(async (wsId: string, page = 1, append = false) => {
    if (spacesFetchRef.current) return;
    spacesFetchRef.current = true;
    if (append) setLoadingMoreSpaces(true);
    else setLoadingSpaces(true);

    try {
      const { data, metadata } = await fetchSpacesPage(wsId, page);
      setSpacesMetadata(metadata);
      setSpaces((prev) => (append ? dedupeById([...prev, ...data]) : data));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load spaces");
      if (!append) setSpaces([]);
    } finally {
      setLoadingSpaces(false);
      setLoadingMoreSpaces(false);
      spacesFetchRef.current = false;
    }
  }, []);

  const loadMoreSpaces = useCallback(() => {
    if (!workspaceId || !hasMorePages(spacesMetadata) || loadingSpaces || loadingMoreSpaces) {
      return;
    }
    const nextPage = spacesMetadata!.nextPage ?? spacesMetadata!.currentPage + 1;
    loadSpaces(workspaceId, nextPage, true);
  }, [workspaceId, spacesMetadata, loadingSpaces, loadingMoreSpaces, loadSpaces]);

  const loadRooms = useCallback(async (spId: string, page = 1, append = false) => {
    if (roomsFetchRef.current) return;
    roomsFetchRef.current = true;
    if (append) setLoadingMoreRooms(true);
    else setLoadingRooms(true);

    try {
      const { data, metadata } = await fetchRoomsPage(spId, page);
      setRoomsMetadata(metadata);
      setRooms((prev) => (append ? dedupeById([...prev, ...data]) : data));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load rooms");
      if (!append) setRooms([]);
    } finally {
      setLoadingRooms(false);
      setLoadingMoreRooms(false);
      roomsFetchRef.current = false;
    }
  }, []);

  const loadMoreRooms = useCallback(() => {
    if (!spaceId || !hasMorePages(roomsMetadata) || loadingRooms || loadingMoreRooms) {
      return;
    }
    const nextPage = roomsMetadata!.nextPage ?? roomsMetadata!.currentPage + 1;
    loadRooms(spaceId, nextPage, true);
  }, [spaceId, roomsMetadata, loadingRooms, loadingMoreRooms, loadRooms]);

  useEffect(() => {
    loadWorkspaces(1, false);
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!workspaceId) {
      setSpaces([]);
      setSpacesMetadata(null);
      setSpaceId("");
      setRooms([]);
      setRoomsMetadata(null);
      setRoomId("");
      return;
    }
    setSpaces([]);
    setSpacesMetadata(null);
    setSpaceId("");
    setRooms([]);
    setRoomsMetadata(null);
    setRoomId("");
    loadSpaces(workspaceId, 1, false);
  }, [workspaceId, loadSpaces]);

  useEffect(() => {
    if (!spaceId) {
      setRooms([]);
      setRoomsMetadata(null);
      setRoomId("");
      return;
    }
    setRooms([]);
    setRoomsMetadata(null);
    setRoomId("");
    loadRooms(spaceId, 1, false);
  }, [spaceId, loadRooms]);

  useEffect(() => {
    if (!roomId) {
      setRoomCustomFields([]);
      setRoomStages([]);
      return;
    }

    let cancelled = false;
    setLoadingCustomFields(true);

    Promise.all([
      fetchRoomCustomFields(roomId),
      fetchRoomStages(roomId).catch(() => [] as RoomStage[]),
    ])
      .then(([fields, stages]) => {
        if (!cancelled) {
          setRoomCustomFields(fields);
          setRoomStages(stages);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoomCustomFields([]);
          setRoomStages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCustomFields(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const mappableFields = useMemo<MappableField[]>(
    () => [
      ...MAPPABLE_TASK_FIELDS.map((field) => ({
        key: field.key,
        label: field.label,
        required: field.required,
      })),
      ...mapRoomCustomFieldsToMappable(roomCustomFields),
    ],
    [roomCustomFields]
  );

  const mappedCustomFieldColumns = useMemo(() => {
    return Object.entries(columnMapping)
      .filter(([key, column]) => isCustomFieldMappingKey(key) && column)
      .map(([key]) => {
        const fieldId = customFieldIdFromMappingKey(key);
        const field = roomCustomFields.find((f) => f._id === fieldId);
        return { fieldId, label: field?.name ?? fieldId };
      });
  }, [columnMapping, roomCustomFields]);

  const customMappableFields = useMemo(
    () => mapRoomCustomFieldsToMappable(roomCustomFields),
    [roomCustomFields]
  );

  useEffect(() => {
    if (!selectedSheet || customMappableFields.length === 0) return;
    if (step !== "mapping" && step !== "sheet") return;

    setColumnMapping((prev) => {
      const autoMapped = buildInitialColumnMapping(
        selectedSheet.headers,
        selectedSheet.headerColumnIndex,
        roomCustomFields
      );
      let changed = false;
      const next = { ...prev };

      customMappableFields.forEach((field) => {
        if (!next[field.key] && autoMapped[field.key]) {
          next[field.key] = autoMapped[field.key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [customMappableFields, roomCustomFields, selectedSheet, step]);

  const resetImportFlow = () => {
    setStep("target");
    setUploadedFile(null);
    setParsedSheets([]);
    setSelectedSheetName("");
    setColumnMapping({});
    setMappedRows([]);
    setUploadResult(null);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (file: File) => {
    const valid =
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls") ||
      file.name.endsWith(".csv");
    if (!valid) {
      toast.error("Please upload an Excel (.xlsx, .xls) or CSV file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    setParsingFile(true);
    try {
      const sheets = await parseSpreadsheetFile(file);
      setUploadedFile(file);
      setParsedSheets(sheets);
      setSelectedSheetName(sheets[0]?.name || "");
      if (sheets.length === 1) {
        const mapping = buildInitialColumnMapping(
          sheets[0].headers,
          sheets[0].headerColumnIndex,
          roomCustomFields
        );
        setColumnMapping(mapping);
        setStep("mapping");
      } else {
        setStep("sheet");
      }
      toast.success("File loaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to parse file");
    } finally {
      setParsingFile(false);
    }
  };

  const handleContinueFromSheet = () => {
    if (!selectedSheet) {
      toast.error("Select a sheet to continue");
      return;
    }
    setColumnMapping(
      buildInitialColumnMapping(
        selectedSheet.headers,
        selectedSheet.headerColumnIndex,
        roomCustomFields
      )
    );
    setStep("mapping");
  };

  const handleMappingChange = (fieldKey: string, column: string) => {
    setColumnMapping((prev) => {
      const next: ColumnMapping = { ...prev, [fieldKey]: column || undefined };
      if (column) {
        Object.keys(next).forEach((key) => {
          if (key !== fieldKey && next[key] === column) {
            delete next[key];
          }
        });
      }
      return next;
    });
  };

  const handlePrepareMappedData = () => {
    if (!selectedSheet) return;
    if (!columnMapping.title) {
      toast.error("Task Name column mapping is required");
      return;
    }
    const rows = applyColumnMapping(selectedSheet, columnMapping, roomCustomFields);
    if (rows.length === 0) {
      toast.error("No valid rows found after mapping");
      return;
    }
    setMappedRows(rows);
    setStep("review");
  };

  const handleImport = async () => {
    if (!roomId || mappedRows.length === 0 || importing || importInFlightRef.current) {
      return;
    }
    importInFlightRef.current = true;
    setImporting(true);
    setImportProgress(0);
    setUploadResult(null);
    try {
      const stages =
        roomStages.length > 0 ? roomStages : await fetchRoomStages(roomId);
      const result = await importTasksToRoom(
        roomId,
        mappedRows,
        stages,
        (done, total) => setImportProgress(Math.round((done / total) * 100))
      );
      setUploadResult(result);
      if (result.failed === 0) {
        toast.success(`Imported ${result.successful} tasks successfully`);
      } else {
        toast.warning(`Imported ${result.successful} of ${result.total} tasks`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      importInFlightRef.current = false;
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (!roomId) {
      toast.error("Select a room to export");
      return;
    }
    setExporting(true);
    try {
      const rows = await fetchRoomTasksForExport(roomId);
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedRoom?.name || "room"}_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} tasks`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const canProceedFromTarget = Boolean(workspaceId && spaceId && roomId);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0a0a0d] text-sm font-normal text-white/80">
      <div className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className={ie.pageTitle}>Import / Export</h1>
            <p className={cn(ie.pageSubtitle, "mt-0.5")}>
              Import tasks from spreadsheets or export room data to Excel
            </p>
          </div>
          <div className="flex rounded-lg border border-white/10 bg-[#161616] p-0.5">
            <button
              type="button"
              onClick={() => {
                setMode("import");
                resetImportFlow();
              }}
              className={cn(
                "rounded-md px-4 py-1.5 transition-colors",
                ie.tab,
                mode === "import"
                  ? "bg-brand text-[#111213]"
                  : "text-white/50 hover:text-white"
              )}
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("export");
                setStep("target");
              }}
              className={cn(
                "rounded-md px-4 py-1.5 transition-colors",
                ie.tab,
                mode === "export"
                  ? "bg-brand text-[#111213]"
                  : "text-white/50 hover:text-white"
              )}
            >
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <StepIndicator current={step} mode={mode} />

          {/* Step 1: Destination */}
          {(mode === "export" || step === "target") && (
            <div className="rounded-2xl border border-white/10 bg-[#111116] p-5 sm:p-6">
              <h2 className={cn(ie.sectionTitle, "mb-1")}>
                {mode === "import" ? "Step 1: Select destination" : "Select room to export"}
              </h2>
              <p className={cn(ie.sectionDesc, "mb-5")}>
                Choose the workspace, space, and room where tasks will be{" "}
                {mode === "import" ? "imported" : "exported from"}.
              </p>

              <div className="grid gap-5 lg:grid-cols-3">
                <PaginatedSelectColumn<WorkspaceOption>
                  title="Workspace"
                  items={workspaces}
                  selectedId={workspaceId}
                  onSelect={(ws) => {
                    setWorkspaceId(ws._id);
                    setSpaceId("");
                    setRoomId("");
                  }}
                  getLabel={(ws) => capitalize(ws.name) || "Untitled"}
                  emptyMessage="No workspaces"
                  loading={loadingWorkspaces}
                  loadingMore={loadingMoreWorkspaces}
                  metadata={workspacesMetadata}
                  onLoadMore={loadMoreWorkspaces}
                />

                <PaginatedSelectColumn<SpaceOption>
                  title="Space"
                  items={spaces}
                  selectedId={spaceId}
                  onSelect={(sp) => {
                    setSpaceId(sp._id);
                    setRoomId("");
                  }}
                  getLabel={(sp) => capitalize(sp.name) || "Untitled"}
                  emptyMessage="No spaces"
                  placeholderMessage="Select a workspace"
                  showPlaceholder={!workspaceId}
                  loading={loadingSpaces}
                  loadingMore={loadingMoreSpaces}
                  metadata={spacesMetadata}
                  onLoadMore={loadMoreSpaces}
                />

                <PaginatedSelectColumn<RoomOption>
                  title="Room"
                  items={rooms}
                  selectedId={roomId}
                  onSelect={(room) => setRoomId(room._id)}
                  getLabel={(room) => capitalize(room.name) || "Untitled"}
                  emptyMessage="No rooms"
                  placeholderMessage="Select a space"
                  showPlaceholder={!spaceId}
                  loading={loadingRooms}
                  loadingMore={loadingMoreRooms}
                  metadata={roomsMetadata}
                  onLoadMore={loadMoreRooms}
                />
              </div>

              {canProceedFromTarget && (
                <div className="mt-5 rounded-xl border border-brand/35 bg-brand/8 px-4 py-3">
                  <p className={cn(ie.summaryLabel, "mb-1")}>Summary</p>
                  <p className={ie.summaryValue}>
                    {capitalize(selectedWorkspace?.name)} → {capitalize(selectedSpace?.name)} →{" "}
                    {capitalize(selectedRoom?.name)}
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                {mode === "import" ? (
                  <Button
                    disabled={!canProceedFromTarget}
                    onClick={() => setStep("upload")}
                    className={cn("bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_80%,black)] text-[#111213] gap-1.5", ie.actionBtn)}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    disabled={!canProceedFromTarget || exporting}
                    onClick={handleExport}
                    className={cn("bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_80%,black)] text-[#111213] gap-1.5", ie.actionBtn)}
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Exporting…
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Export to Excel
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Upload */}
          {mode === "import" && step === "upload" && (
            <div className="rounded-2xl border border-white/10 bg-[#111116] p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={ie.sectionTitle}>Step 2: Upload file</h2>
                  <p className={cn(ie.sectionDesc, "mt-0.5")}>
                    Upload an Excel or CSV file with your tasks
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("target")}
                  className={cn(ie.backBtn, "gap-1")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              </div>

              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 transition-colors",
                  parsingFile
                    ? "border-brand/40 bg-brand/5"
                    : "border-white/15 hover:border-brand/40 hover:bg-white/[0.02]"
                )}
              >
                {parsingFile ? (
                  <Loader2 className="h-10 w-10 animate-spin text-brand mb-3" />
                ) : (
                  <Upload className="h-10 w-10 text-white/25 mb-3" />
                )}
                <p className={cn(ie.cardLabel, "text-white")}>
                  {parsingFile ? "Reading file…" : "Drop your file here or click to browse"}
                </p>
                <p className={cn(ie.hint, "mt-1")}>
                  Supports .xlsx, .xls, .csv — max 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={parsingFile}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </label>

              {uploadedFile && !parsingFile && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-[#161616] px-3 py-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className={cn(ie.tableCellStrong, "truncate")}>{uploadedFile.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Sheet selection */}
          {mode === "import" && step === "sheet" && (
            <div className="rounded-2xl border border-white/10 bg-[#111116] p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={ie.sectionTitle}>Step 3: Select sheet</h2>
                  <p className={cn(ie.sectionDesc, "mt-0.5")}>
                    File: <span className="text-white/70 font-medium">{uploadedFile?.name}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("upload")}
                  className={cn(ie.backBtn, "gap-1")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className={cn("w-full", ie.table)}>
                  <thead className={cn("bg-[#161616] text-left", ie.tableHead)}>
                    <tr>
                      <th className="w-10 px-3 py-2.5" />
                      <th className="px-3 py-2.5">Sheet</th>
                      <th className="px-3 py-2.5 text-right">Rows</th>
                      <th className="px-3 py-2.5 text-right">Columns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedSheets.map((sheet) => (
                      <tr
                        key={sheet.name}
                        className={cn(
                          "border-t border-white/8 cursor-pointer transition-colors",
                          selectedSheetName === sheet.name
                            ? "bg-brand/15 border-l-2 border-l-brand"
                            : "hover:bg-brand/5"
                        )}
                        onClick={() => setSelectedSheetName(sheet.name)}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="radio"
                            checked={selectedSheetName === sheet.name}
                            onChange={() => setSelectedSheetName(sheet.name)}
                            className="accent-brand"
                          />
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2.5",
                            selectedSheetName === sheet.name ? ie.cardLabelSelected : ie.tableCellStrong
                          )}
                        >
                          {sheet.name}
                        </td>
                        <td className={cn("px-3 py-2.5 text-right", ie.tableCellMuted)}>
                          {sheet.rows.length}
                        </td>
                        <td className={cn("px-3 py-2.5 text-right", ie.tableCellMuted)}>
                          {sheet.headers.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  onClick={handleContinueFromSheet}
                  className={cn("bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_80%,black)] text-[#111213] gap-1.5", ie.actionBtn)}
                >
                  Continue to mapping
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Column mapping */}
          {mode === "import" && step === "mapping" && selectedSheet && (
            <div className="rounded-2xl border border-white/10 bg-[#111116] p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={ie.sectionTitle}>Step 4: Map columns</h2>
                  <p className={cn(ie.sectionDesc, "mt-0.5")}>
                    Sheet: <span className="text-white/70 font-medium">{selectedSheetName}</span> — match file
                    columns to task fields
                    {roomCustomFields.length > 0 && (
                      <span className="text-white/50">
                        {" "}
                        · {roomCustomFields.length} custom field
                        {roomCustomFields.length === 1 ? "" : "s"} from room
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setStep(parsedSheets.length > 1 ? "sheet" : "upload")
                  }
                  className={cn(ie.backBtn, "gap-1")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              </div>

              <div className="overflow-auto max-h-[480px] rounded-xl border border-white/10">
                <table className={cn("w-full min-w-[720px]", ie.table)}>
                  <thead className={cn("sticky top-0 z-10 bg-[#161616] text-left", ie.tableHead)}>
                    <tr>
                      <th className="px-3 py-2.5 min-w-[140px]">Task field</th>
                      <th className="px-3 py-2.5 min-w-[160px]">File column</th>
                      <th className="px-3 py-2.5 min-w-[280px]">Preview (top 10 unique)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappableFields
                      .filter((field) => !field.isCustomField)
                      .map((field) => {
                        const selectedColumn = columnMapping[field.key] || "";
                        const previewValues = getTopUniqueValues(selectedSheet, selectedColumn);

                        return (
                          <tr key={field.key} className="border-t border-white/8">
                            <td className={cn("px-3 py-3 align-top", ie.tableCellStrong)}>
                              {field.label}
                              {field.required ? (
                                <span className="text-red-400 ml-0.5">*</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 align-top">
                              <select
                                value={selectedColumn}
                                onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                className={cn(
                                  ie.select,
                                  !selectedColumn && ie.selectPlaceholder
                                )}
                              >
                                <option value="" className={ie.selectPlaceholder}>
                                  — Skip —
                                </option>
                                {selectedSheet.headers.map((header) => (
                                  <option
                                    key={`${field.key}-${header}`}
                                    value={header}
                                    className="text-sm font-normal text-white"
                                  >
                                    {header}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3 align-top">
                              {previewValues.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {previewValues.map((value, idx) => (
                                    <span
                                      key={`${field.key}-${idx}`}
                                      className={cn(
                                        "inline-block max-w-[200px] truncate rounded-md bg-white/8 border border-white/10 px-2 py-0.5",
                                        ie.chip
                                      )}
                                      title={value}
                                    >
                                      {value}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className={ie.placeholder}>No preview</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                    {customMappableFields.length > 0 ? (
                      <tr className="border-t border-white/8 bg-white/[0.02]">
                        <td colSpan={3} className={cn("px-3 py-2", ie.sectionDivider)}>
                          Custom fields
                          {loadingCustomFields ? (
                            <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin" />
                          ) : null}
                        </td>
                      </tr>
                    ) : null}

                    {customMappableFields.map((field) => {
                      const selectedColumn = columnMapping[field.key] || "";
                      const previewValues = getTopUniqueValues(selectedSheet, selectedColumn);

                      return (
                        <tr key={field.key} className="border-t border-white/8">
                          <td className={cn("px-3 py-3 align-top", ie.tableCellStrong)}>
                            {field.label}
                            {field.fieldType ? (
                              <span
                                className={cn(
                                  "ml-1.5 inline-block rounded bg-white/8 px-1.5 py-0.5",
                                  ie.badge
                                )}
                              >
                                {field.fieldType}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <select
                              value={selectedColumn}
                              onChange={(e) => handleMappingChange(field.key, e.target.value)}
                              className={cn(
                                ie.select,
                                !selectedColumn && ie.selectPlaceholder
                              )}
                            >
                              <option value="" className={ie.selectPlaceholder}>
                                — Skip —
                              </option>
                              {selectedSheet.headers.map((header) => (
                                <option
                                  key={`${field.key}-${header}`}
                                  value={header}
                                  className="text-sm font-normal text-white"
                                >
                                  {header}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3 align-top">
                            {previewValues.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {previewValues.map((value, idx) => (
                                  <span
                                    key={`${field.key}-${idx}`}
                                    className={cn(
                                      "inline-block max-w-[200px] truncate rounded-md bg-white/8 border border-white/10 px-2 py-0.5",
                                      ie.chip
                                    )}
                                    title={value}
                                  >
                                    {value}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={ie.placeholder}>No preview</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  onClick={handlePrepareMappedData}
                  className={cn("bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_80%,black)] text-[#111213] gap-1.5", ie.actionBtn)}
                >
                  Review & import
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Review & upload */}
          {mode === "import" && step === "review" && (
            <div className="rounded-2xl border border-white/10 bg-[#111116] p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={ie.sectionTitle}>Step 5: Import tasks</h2>
                  <p className={cn(ie.sectionDesc, "mt-0.5")}>
                    {mappedRows.length} tasks ready to import into{" "}
                    <span className="text-white/70 font-medium">{capitalize(selectedRoom?.name)}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("mapping")}
                  disabled={importing}
                  className={cn(ie.backBtn, "gap-1")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              </div>

              {!uploadResult && !importing && (
                <div className="overflow-auto max-h-72 rounded-xl border border-white/10 mb-5">
                  <table className={cn("w-full min-w-[600px]", ie.table)}>
                    <thead className={cn("sticky top-0 bg-[#161616] text-left", ie.tableHead)}>
                      <tr>
                        <th className="px-3 py-2 w-10">#</th>
                        <th className="px-3 py-2">Task Name</th>
                        <th className="px-3 py-2">Stage</th>
                        <th className="px-3 py-2">Priority</th>
                        <th className="px-3 py-2">Due Date</th>
                        {mappedCustomFieldColumns.map((col) => (
                          <th key={col.fieldId} className="px-3 py-2">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappedRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-t border-white/8">
                          <td className={cn("px-3 py-2", ie.tableCellMuted)}>{i + 1}</td>
                          <td className={cn("px-3 py-2 max-w-[200px] truncate", ie.tableCellStrong)}>
                            {row.title}
                          </td>
                          <td className={cn("px-3 py-2", ie.tableCell)}>
                            {row.stage || "—"}
                          </td>
                          <td className={cn("px-3 py-2", ie.tableCell)}>
                            {row.priority || "—"}
                          </td>
                          <td className={cn("px-3 py-2", ie.tableCell)}>
                            {row.dueDate || "—"}
                          </td>
                          {mappedCustomFieldColumns.map((col) => (
                            <td
                              key={col.fieldId}
                              className={cn("px-3 py-2 max-w-[140px] truncate", ie.tableCell)}
                            >
                              {row.customFields?.[col.fieldId] != null &&
                              row.customFields[col.fieldId] !== ""
                                ? String(row.customFields[col.fieldId])
                                : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mappedRows.length > 50 && (
                    <p className={cn(ie.hint, "py-2 text-center")}>
                      + {mappedRows.length - 50} more rows
                    </p>
                  )}
                </div>
              )}

              {importing && (
                <div className="mb-5 space-y-2">
                  <div className={cn("flex items-center justify-between", ie.sectionDesc)}>
                    <span>Uploading tasks…</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              {uploadResult && (
                <div className="mb-5 rounded-xl border border-white/10 bg-[#161616] p-4">
                  <div className="flex items-start gap-3">
                    {uploadResult.failed === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={ie.sectionTitle}>Import complete</p>
                      <p className={cn(ie.sectionDesc, "mt-0.5")}>
                        {uploadResult.successful} of {uploadResult.total} tasks imported
                        {uploadResult.failed > 0 ? ` · ${uploadResult.failed} failed` : ""}
                      </p>
                      {uploadResult.errors.length > 0 && (
                        <ul className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                          {uploadResult.errors.slice(0, 5).map((err) => (
                            <li key={err.row} className="text-sm font-normal text-red-300/80">
                              Row {err.row}: {err.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {uploadResult ? (
                  <Button
                    variant="outline"
                    onClick={resetImportFlow}
                    className={cn("border-white/15 hover:bg-white/5", ie.ghostBtn)}
                  >
                    Import another file
                  </Button>
                ) : (
                  <Button
                    disabled={importing || mappedRows.length === 0}
                    onClick={handleImport}
                    className={cn(
                      "bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 min-w-[140px]",
                      ie.actionBtn
                    )}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Import {mappedRows.length} tasks
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
