"use client";

import React, { useState, useCallback, useRef } from "react";
import { Settings2, Plus, X, Trash2 } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

interface ChartEntry {
  id: string;
  label: string;
  value: number;
  category: "revenue" | "users" | "growth";
}

let entryIdCounter = 9;

function generateId() {
  return `chart-entry-${entryIdCounter++}`;
}

const CATEGORY_META: Record<string, { color: string; bg: string }> = {
  revenue: { color: "bg-emerald-500", bg: "bg-emerald-500/10" },
  users: { color: "bg-sky-400", bg: "bg-sky-400/10" },
  growth: { color: "bg-violet-400", bg: "bg-violet-400/10" },
};

const INITIAL_ENTRIES: ChartEntry[] = [
  { id: "chart-entry-1", label: "Jan", value: 40, category: "revenue" },
  { id: "chart-entry-2", label: "Feb", value: 24, category: "users" },
  { id: "chart-entry-3", label: "Mar", value: 48, category: "growth" },
  { id: "chart-entry-4", label: "Apr", value: 18, category: "revenue" },
  { id: "chart-entry-5", label: "May", value: 32, category: "users" },
  { id: "chart-entry-6", label: "Jun", value: 56, category: "growth" },
  { id: "chart-entry-7", label: "Jul", value: 28, category: "revenue" },
  { id: "chart-entry-8", label: "Aug", value: 36, category: "users" },
];

function ChartBlock({ block, editor }: { block: any; editor: any }) {
  const loadedEntries = block.props?.entries ? JSON.parse(block.props.entries) : INITIAL_ENTRIES;
  const [entries, setEntries] = useState(loadedEntries);
  const [showModal, setShowModal] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState<ChartEntry["category"]>("revenue");
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const persistEntries = useCallback((newEntries: ChartEntry[]) => {
    setEntries(newEntries);
    editor.updateBlock(block, { props: { entries: JSON.stringify(newEntries) } });
  }, [editor, block]);

  const maxValue = Math.max(...entries.map((e) => e.value), 1);

  const addEntry = useCallback(() => {
    const val = parseInt(newValue, 10);
    if (!newLabel.trim() || isNaN(val) || val < 0) return;
    const entry: ChartEntry = {
      id: generateId(),
      label: newLabel.trim(),
      value: val,
      category: newCategory,
    };
    const next = [...entriesRef.current, entry];
    persistEntries(next);
    setNewLabel("");
    setNewValue("");
  }, [newLabel, newValue, newCategory, persistEntries]);

  const removeEntry = useCallback((id: string) => {
    const next = entriesRef.current.filter((e) => e.id !== id);
    persistEntries(next);
  }, [persistEntries]);

  const updateEntry = useCallback(
    (id: string, patch: Partial<ChartEntry>) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
      );
    },
    []
  );

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 p-4 relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">
          Analytics Overview
        </span>
        <div className="flex items-center gap-2">
          {[
            { label: "Revenue", color: "bg-emerald-500" },
            { label: "Users", color: "bg-sky-400" },
            { label: "Growth", color: "bg-violet-400" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
              <span className="text-[8px] text-zinc-600">{s.label}</span>
            </div>
          ))}
          <button
            onClick={() => setShowModal(true)}
            className="ml-2 w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Edit Data"
          >
            <Settings2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Bar chart with Y-axis */}
      <div className="flex gap-2">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between h-[180px] w-8 shrink-0">
          {[maxValue, Math.round(maxValue * 0.75), Math.round(maxValue * 0.5), Math.round(maxValue * 0.25), 0].map((val) => (
            <span key={val} className="text-[8px] text-zinc-500 text-right leading-none">
              {val}
            </span>
          ))}
        </div>
        {/* Chart area */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-end gap-1.5 h-[160px] border-b border-zinc-800/60">
            {entries.map((entry) => {
              const meta = CATEGORY_META[entry.category];
              const barH = maxValue > 0 ? (entry.value / maxValue) * 140 : 0;
              return (
                <div key={entry.id} className="flex-1 flex flex-col items-center gap-0.5 group justify-end">
                  <span className="text-[9px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {entry.value}
                  </span>
                  <div
                    className={`w-full rounded-t ${meta.color} opacity-80 hover:opacity-100 transition-all cursor-pointer`}
                    style={{ height: `${Math.max(barH, 4)}px` }}
                    title={`${entry.label}: ${entry.value}`}
                  />
                </div>
              );
            })}
          </div>
          {/* X-axis labels */}
          <div className="flex justify-between mt-1">
            {entries.map((entry) => (
              <span
                key={entry.id}
                className="text-[8px] text-zinc-600 font-medium text-center flex-1 truncate"
              >
                {entry.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Data Modal */}
      {showModal && (
        <div className="absolute inset-0 bg-zinc-900/95 rounded-lg border border-zinc-700 z-50 flex flex-col" style={{ minHeight: '400px' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-zinc-200 font-semibold">Edit Data</span>
              <span className="text-[10px] text-zinc-500">{entries.length} entries</span>
            </div>
            <button
              onClick={() => { persistEntries(entriesRef.current); setShowModal(false); }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 relative" style={{ scrollbarWidth: 'thin' }}>
            {entries.map((entry) => {
              const meta = CATEGORY_META[entry.category];
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 bg-zinc-800/50 rounded px-2 py-2"
                >
                  <div className={`w-2 h-2 rounded-full ${meta.color} shrink-0`} />
                  <input
                    value={entry.label}
                    onChange={(e) => updateEntry(entry.id, { label: e.target.value })}
                    className="w-20 bg-transparent text-[11px] text-zinc-200 font-medium focus:outline-none placeholder-zinc-600"
                    placeholder="Label"
                  />
                  <input
                    type="number"
                    value={entry.value}
                    onChange={(e) =>
                      updateEntry(entry.id, { value: parseInt(e.target.value) || 0 })
                    }
                    className="w-16 bg-zinc-800 text-[11px] text-zinc-200 text-center rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/50 px-1 py-0.5"
                    min={0}
                  />
                  <select
                    value={entry.category}
                    onChange={(e) =>
                      updateEntry(entry.id, {
                        category: e.target.value as ChartEntry["category"],
                      })
                    }
                    className="bg-zinc-800 text-[10px] text-zinc-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="revenue">Revenue</option>
                    <option value="users">Users</option>
                    <option value="growth">Growth</option>
                  </select>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="ml-auto w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            {/* Scroll indicator */}
            {entries.length > 5 && (
              <div className="sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-zinc-900/95 to-transparent pointer-events-none flex items-end justify-center pb-1">
                <span className="text-[9px] text-zinc-500">Scroll for more</span>
              </div>
            )}
          </div>

          {/* Add new entry form */}
          <div className="border-t border-zinc-700/60 p-3 flex items-center gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label"
              className="flex-1 bg-zinc-800 text-[11px] text-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-zinc-600"
              onKeyDown={(e) => e.key === "Enter" && addEntry()}
            />
            <input
              type="number"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
              className="w-16 bg-zinc-800 text-[11px] text-zinc-200 text-center rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-zinc-600"
              min={0}
              onKeyDown={(e) => e.key === "Enter" && addEntry()}
            />
            <select
              value={newCategory}
              onChange={(e) =>
                setNewCategory(e.target.value as ChartEntry["category"])
              }
              className="bg-zinc-800 text-[10px] text-zinc-300 rounded px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value="revenue">Revenue</option>
              <option value="users">Users</option>
              <option value="growth">Growth</option>
            </select>
            <button
              onClick={addEntry}
              className="w-7 h-7 flex items-center justify-center rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const chartViewBlock = createReactBlockSpec(
  {
    type: "chartView" as const,
    propSchema: {
      entries: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => <ChartBlock block={block} editor={editor} />,
  }
);
