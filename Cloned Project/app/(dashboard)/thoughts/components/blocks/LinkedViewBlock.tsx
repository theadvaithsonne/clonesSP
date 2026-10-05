"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link2, ChevronRight, Settings2, ExternalLink, Table, BarChart3, CalendarDays, LayoutGrid, Plus, X, Trash2, GripHorizontal } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

const VIEW_TYPES = [
  { id: "table", label: "Table View", icon: Table, color: "text-blue-400" },
  { id: "board", label: "Board View", icon: LayoutGrid, color: "text-amber-400" },
  { id: "gallery", label: "Gallery View", icon: LayoutGrid, color: "text-emerald-400" },
  { id: "calendar", label: "Calendar View", icon: CalendarDays, color: "text-violet-400" },
  { id: "chart", label: "Chart View", icon: BarChart3, color: "text-rose-400" },
];

interface LinkedRecord {
  id: string;
  label: string;
  status: string;
}

let recordIdCounter = 10;
function generateId() {
  return `lv-record-${recordIdCounter++}`;
}

const INITIAL_RECORDS: LinkedRecord[] = [
  { id: "lv-record-1", label: "Q1 Revenue Report", status: "Published" },
  { id: "lv-record-2", label: "User Growth Analysis", status: "Draft" },
  { id: "lv-record-3", label: "Feature Roadmap", status: "In Review" },
  { id: "lv-record-4", label: "Sprint Retrospective", status: "Published" },
  { id: "lv-record-5", label: "API Performance Metrics", status: "Draft" },
];

function LinkedViewRenderer({ block, editor }: { block: any; editor: any }) {
  const [viewType, setViewType] = useState(block.props?.viewType || "table");
  const [dbName, setDbName] = useState(block.props?.dbName || "Project Tracker Database");
  const [showConfig, setShowConfig] = useState(false);
  const [records, setRecords] = useState<LinkedRecord[]>(() => {
    try {
      const stored = block.props?.records;
      if (stored) {
        const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_RECORDS;
  });
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state when block props change externally
  useEffect(() => {
    setViewType(block.props?.viewType || "table");
    setDbName(block.props?.dbName || "Project Tracker Database");
    try {
      const stored = block.props?.records;
      if (stored) {
        const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
        if (Array.isArray(parsed) && parsed.length > 0) setRecords(parsed);
      }
    } catch {}
  }, [block.props?.viewType, block.props?.dbName, block.props?.records]);

  useEffect(() => {
    if (!showConfig) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowConfig(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showConfig]);

  useEffect(() => {
    if (editingRecordId !== null) {
      requestAnimationFrame(() => editInputRef.current?.focus());
    }
  }, [editingRecordId]);

  const persistRecords = useCallback(
    (newRecords: LinkedRecord[]) => {
      editor.updateBlock(block, { props: { records: JSON.stringify(newRecords) } });
    },
    [editor, block]
  );

  const persistSettings = useCallback(
    (patch: Record<string, string>) => {
      editor.updateBlock(block, { props: patch });
    },
    [editor, block]
  );

  const addRecord = useCallback(() => {
    const newRecord: LinkedRecord = { id: generateId(), label: "New record", status: "Draft" };
    const newRecords = [...records, newRecord];
    setRecords(newRecords);
    persistRecords(newRecords);
    setEditingRecordId(newRecord.id);
    setEditValue("New record");
  }, [records, persistRecords]);

  const updateRecordLabel = useCallback(
    (id: string, label: string) => {
      const newRecords = records.map((r) => (r.id === id ? { ...r, label } : r));
      setRecords(newRecords);
      persistRecords(newRecords);
    },
    [records, persistRecords]
  );

  const updateRecordStatus = useCallback(
    (id: string, status: string) => {
      const newRecords = records.map((r) => (r.id === id ? { ...r, status } : r));
      setRecords(newRecords);
      persistRecords(newRecords);
    },
    [records, persistRecords]
  );

  const deleteRecord = useCallback(
    (id: string) => {
      const newRecords = records.filter((r) => r.id !== id);
      setRecords(newRecords);
      persistRecords(newRecords);
    },
    [records, persistRecords]
  );

  const commitEdit = useCallback(() => {
    if (editingRecordId !== null) {
      updateRecordLabel(editingRecordId, editValue.trim() || "Untitled");
      setEditingRecordId(null);
      setEditValue("");
    }
  }, [editingRecordId, editValue, updateRecordLabel]);

  const currentView = VIEW_TYPES.find((v) => v.id === viewType) || VIEW_TYPES[0];
  const ViewIcon = currentView.icon;

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden group">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Link2 className="h-2.5 w-2.5 text-emerald-400" />
          </div>
          <span className="text-[10px] text-zinc-400 font-medium tracking-wide">LINKED VIEW</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => addRecord()}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
            title="Add record"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              showConfig ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300"
            }`}
            title="Configure"
          >
            <Settings2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div ref={popoverRef} className="px-3 py-2.5 border-b border-zinc-800/40 space-y-2.5 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div>
            <label className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">Database</label>
            <input
              value={dbName}
              onChange={(e) => {
                setDbName(e.target.value);
                persistSettings({ dbName: e.target.value });
              }}
              className="w-full bg-zinc-800 text-[11px] text-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-zinc-500"
              placeholder="Database name"
            />
          </div>
          <div>
            <label className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">View Type</label>
            <div className="flex gap-1.5 flex-wrap">
              {VIEW_TYPES.map((vt) => {
                const Icon = vt.icon;
                return (
                  <button
                    key={vt.id}
                    onClick={() => {
                      setViewType(vt.id);
                      persistSettings({ viewType: vt.id });
                    }}
                    className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded border transition-colors ${
                      viewType === vt.id
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-zinc-900/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Icon className={`h-2.5 w-2.5 ${vt.color}`} />
                    {vt.label.replace(" View", "")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Linked view content */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <ViewIcon className={`h-3.5 w-3.5 ${currentView.color}`} />
          <span className="text-[12px] text-zinc-200 font-medium">{dbName}</span>
          <ChevronRight className="h-3 w-3 text-zinc-600" />
          <span className="text-[11px] text-zinc-500">{currentView.label}</span>
        </div>

        {/* Records — rendered differently per view type */}
        {viewType === "table" && (
          <div className="bg-zinc-800/30 rounded-lg border border-zinc-700/30 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-700/20">
              <span className="text-[10px] text-zinc-500 font-medium">{records.length} records</span>
              <button
                onClick={() => addRecord()}
                className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                <Plus className="h-2.5 w-2.5" />
                Add
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700/10 last:border-b-0 hover:bg-zinc-700/20 transition-colors group/row"
                >
                  <GripHorizontal className="h-2.5 w-2.5 text-zinc-700 group-hover/row:text-zinc-500 shrink-0 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    {editingRecordId === record.id ? (
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") {
                            setEditingRecordId(null);
                            setEditValue("");
                          }
                        }}
                        className="w-full bg-zinc-800 text-[11px] text-zinc-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    ) : (
                      <span
                        className="text-[11px] text-zinc-200 font-medium truncate block cursor-text hover:text-emerald-300 transition-colors"
                        onClick={() => {
                          setEditingRecordId(record.id);
                          setEditValue(record.label);
                        }}
                      >
                        {record.label}
                      </span>
                    )}
                  </div>
                  <select
                    value={record.status}
                    onChange={(e) => updateRecordStatus(record.id, e.target.value)}
                    className={`text-[9px] rounded px-1.5 py-0.5 border focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${
                      record.status === "Published"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : record.status === "Draft"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : "bg-sky-500/10 border-sky-500/30 text-sky-400"
                    }`}
                  >
                    <option value="Published" className="bg-zinc-800">Published</option>
                    <option value="Draft" className="bg-zinc-800">Draft</option>
                    <option value="In Review" className="bg-zinc-800">In Review</option>
                  </select>
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover/row:opacity-100 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {records.length === 0 && (
                <div className="text-center py-4">
                  <span className="text-[10px] text-zinc-600">No records yet. Click + to add one.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {viewType === "board" && (
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
            {["Todo", "In Progress", "Done"].map((col) => (
              <div key={col} className="flex-1 min-w-[120px] bg-zinc-800/20 rounded-lg border border-zinc-700/20 p-2">
                <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">{col}</div>
                {records
                  .filter((r) => col === "Todo" ? r.status === "Draft" : col === "In Progress" ? r.status === "In Review" : r.status === "Published")
                  .map((record) => (
                    <div key={record.id} className="bg-zinc-800/60 rounded px-2 py-1.5 mb-1 border border-zinc-700/20">
                      <div className="text-[10px] text-zinc-200 font-medium truncate">{record.label}</div>
                    </div>
                  ))}
                {records.filter((r) => col === "Todo" ? r.status === "Draft" : col === "In Progress" ? r.status === "In Review" : r.status === "Published").length === 0 && (
                  <div className="text-[9px] text-zinc-600 text-center py-2">No items</div>
                )}
              </div>
            ))}
          </div>
        )}

        {viewType === "gallery" && (
          <div className="grid grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {records.map((record) => (
              <div
                key={record.id}
                className="aspect-[4/3] bg-zinc-800/40 rounded-lg border border-zinc-700/20 relative overflow-hidden group/card cursor-pointer"
                onClick={() => { setEditingRecordId(record.id); setEditValue(record.label); }}
              >
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <div className="text-[10px] text-zinc-200 font-medium truncate">{record.label}</div>
                  <span className={`text-[8px] ${
                    record.status === "Published" ? "text-emerald-400" : record.status === "Draft" ? "text-amber-400" : "text-sky-400"
                  }`}>{record.status}</span>
                </div>
              </div>
            ))}
            {records.length === 0 && (
              <div className="col-span-2 text-center py-4">
                <span className="text-[10px] text-zinc-600">No records yet</span>
              </div>
            )}
          </div>
        )}

        {viewType === "calendar" && (
          <div className="max-h-[300px] overflow-y-auto space-y-1.5" style={{ scrollbarWidth: 'thin' }}>
            {records.map((record) => (
              <div
                key={record.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800/40 rounded border border-zinc-700/20 hover:bg-zinc-700/30 transition-colors cursor-pointer"
                onClick={() => { setEditingRecordId(record.id); setEditValue(record.label); }}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  record.status === "Published" ? "bg-emerald-400" : record.status === "Draft" ? "bg-amber-400" : "bg-sky-400"
                }`} />
                <span className="text-[10px] text-zinc-200 truncate flex-1">{record.label}</span>
                <span className={`text-[8px] shrink-0 ${
                  record.status === "Published" ? "text-emerald-400" : record.status === "Draft" ? "text-amber-400" : "text-sky-400"
                }`}>{record.status}</span>
              </div>
            ))}
            {records.length === 0 && (
              <div className="text-center py-4">
                <span className="text-[10px] text-zinc-600">No records yet</span>
              </div>
            )}
          </div>
        )}

        {viewType === "chart" && (
          <div className="bg-zinc-800/20 rounded-lg border border-zinc-700/20 p-3">
            <div className="flex items-end gap-1 h-20 mb-2">
              {records.slice(0, 10).map((record, i) => {
                const height = 20 + Math.abs(record.label.length * 5) % 60;
                return (
                  <div key={record.id} className="flex-1 flex flex-col items-center gap-0.5 group/chart">
                    <div
                      className={`w-full rounded-t ${
                        record.status === "Published" ? "bg-emerald-500" : record.status === "Draft" ? "bg-amber-400" : "bg-sky-400"
                      } opacity-80 hover:opacity-100 transition-opacity`}
                      style={{ height: `${height}%` }}
                      title={`${record.label}: ${record.status}`}
                    />
                    <span className="text-[6px] text-zinc-500 truncate w-full text-center">{record.label.slice(0, 6)}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-[9px] text-zinc-500 text-center">{records.length} records</div>
          </div>
        )}
      </div>
    </div>
  );
}

export const linkedViewBlock = createReactBlockSpec(
  {
    type: "linkedView" as const,
    propSchema: {
      viewType: { default: "table", type: "string" },
      dbName: { default: "Project Tracker Database", type: "string" },
      records: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => <LinkedViewRenderer block={block} editor={editor} />,
  }
);
