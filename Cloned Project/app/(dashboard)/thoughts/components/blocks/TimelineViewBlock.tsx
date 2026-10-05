"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Plus, GripHorizontal, X, Calendar, User, Trash2 } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

interface TimelineItem {
  id: string;
  label: string;
  left: number;
  width: number;
  color: string;
  assignee: string;
  startDate: string;
  endDate: string;
}

function formatShortDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function formatShortDateRange(startStr: string, endStr: string): string {
  if (!startStr && !endStr) return "";
  const s = startStr ? formatShortDate(new Date(startStr)) : "?";
  const e = endStr ? formatShortDate(new Date(endStr)) : "?";
  return `${s} – ${e}`;
}

let itemIdCounter = 1;

function generateId() {
  return `tl-item-${itemIdCounter++}`;
}

const BAR_COLORS = [
  "bg-emerald-500",
  "bg-sky-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-teal-400",
];

const TEAM_MEMBERS = [
  "Unassigned",
  "Ram Mahender",
  "Alex Chen",
  "Sarah Kim",
  "Mike Johnson",
];

function TimelineBlock({ block, editor }: { block: any; editor: any }) {
  let loadedItems: TimelineItem[] = [];
  try {
    loadedItems = block.props?.items ? JSON.parse(block.props.items) : [];
  } catch {
    loadedItems = [];
  }
  const [items, setItems] = useState<TimelineItem[]>(loadedItems);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const persistItems = useCallback((newItems: TimelineItem[]) => {
    setItems(newItems);
    editor.updateBlock(block, { props: { items: JSON.stringify(newItems) } });
  }, [editor, block]);

  const timelineRange = useMemo(() => {
    const datedItems = items.filter((i) => i.startDate && i.endDate);
    if (datedItems.length === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start, end, ms: end.getTime() - start.getTime() };
    }
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const item of datedItems) {
      const s = new Date(item.startDate).getTime();
      const e = new Date(item.endDate).getTime();
      if (!isNaN(s) && s < minTime) minTime = s;
      if (!isNaN(e) && e > maxTime) maxTime = e;
    }
    if (!isFinite(minTime) || !isFinite(maxTime)) {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start, end, ms: end.getTime() - start.getTime() };
    }
    const pad = (maxTime - minTime) * 0.05 || 86400000;
    const start = new Date(minTime - pad);
    const end = new Date(maxTime + pad);
    return { start, end, ms: end.getTime() - start.getTime() };
  }, [items]);

  const checkpoints = useMemo(() => {
    const { start, end, ms } = timelineRange;
    const count = 6;
    const points: { label: string; date: Date }[] = [];
    for (let i = 0; i < count; i++) {
      const t = start.getTime() + (ms * i) / (count - 1);
      const d = new Date(t);
      points.push({ label: formatShortDate(d), date: d });
    }
    return points;
  }, [timelineRange]);

  const tr = timelineRange;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize-left" | "resize-right";
    startX: number;
    startLeft: number;
    startWidth: number;
  } | null>(null);

  const addItem = useCallback(() => {
    const newItem: TimelineItem = {
      id: generateId(),
      label: "",
      left: 0,
      width: 20,
      color: BAR_COLORS[itemsRef.current.length % BAR_COLORS.length],
      assignee: "Unassigned",
      startDate: "",
      endDate: "",
    };
    persistItems([...itemsRef.current, newItem]);
    setEditingItem(newItem);
    setShowEditModal(true);
  }, [persistItems]);

  const getDatePosition = useCallback((dateStr: string): number => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const time = d.getTime();
    if (isNaN(time)) return 0;
    return Math.max(0, Math.min(100, ((time - tr.start.getTime()) / tr.ms) * 100));
  }, [tr]);

  const getDateWidth = useCallback((startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 20;
    const start = getDatePosition(startStr);
    const end = getDatePosition(endStr);
    return Math.max(5, Math.min(100, end - start));
  }, [getDatePosition]);

  const updateItem = useCallback(
    (id: string, patch: Partial<TimelineItem>) => {
      const next = itemsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item));
      persistItems(next);
    },
    [persistItems]
  );

  const deleteItem = useCallback((id: string) => {
    persistItems(itemsRef.current.filter((item) => item.id !== id));
  }, [persistItems]);

  const openEditModal = useCallback((item: TimelineItem) => {
    setEditingItem({ ...item });
    setShowEditModal(true);
  }, []);

  const saveEditModal = useCallback(() => {
    if (editingItem) {
      let left = editingItem.left;
      let width = editingItem.width;
      if (editingItem.startDate && editingItem.endDate) {
        left = getDatePosition(editingItem.startDate);
        const endPct = getDatePosition(editingItem.endDate);
        width = Math.max(5, Math.min(100, endPct - left));
      }
      const next = itemsRef.current.map((item) => (item.id === editingItem.id ? { ...editingItem, left, width } : item));
      persistItems(next);
    }
    setShowEditModal(false);
    setEditingItem(null);
  }, [editingItem, persistItems, getDatePosition]);

  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      id: string,
      mode: "move" | "resize-left" | "resize-right"
    ) => {
      e.preventDefault();
      const item = items.find((i) => i.id === id);
      if (!item) return;
      dragRef.current = {
        id,
        mode,
        startX: e.clientX,
        startLeft: item.left,
        startWidth: item.width,
      };
    },
    [items]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      const track = trackRef.current;
      if (!drag || !track) return;

      const trackWidth = track.getBoundingClientRect().width;
      const dx = ((e.clientX - drag.startX) / trackWidth) * 100;

      const item = items.find((i) => i.id === drag.id);
      if (!item) return;

      if (drag.mode === "move") {
        let newLeft = drag.startLeft + dx;
        newLeft = Math.max(0, Math.min(100 - item.width, newLeft));
        updateItem(drag.id, { left: newLeft });
      } else if (drag.mode === "resize-right") {
        let newWidth = drag.startWidth + dx;
        newWidth = Math.max(5, Math.min(100 - item.left, newWidth));
        updateItem(drag.id, { width: newWidth });
      } else if (drag.mode === "resize-left") {
        let newLeft = drag.startLeft + dx;
        let newWidth = drag.startWidth - dx;
        if (newWidth < 5) {
          newWidth = 5;
          newLeft = item.left + item.width - 5;
        }
        if (newLeft < 0) {
          newLeft = 0;
          newWidth = item.left + item.width;
        }
        updateItem(drag.id, { left: newLeft, width: newWidth });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    if (dragRef.current) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [items, updateItem]);

  const totalProgress = items.length > 0
    ? Math.round(
        items.reduce((sum, item) => sum + item.left + item.width / 2, 0) /
          items.length
      )
    : 0;

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 p-4 select-none">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">
          Project Timeline
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {items.length > 0 ? `${totalProgress}% complete` : "No items"}
        </span>
      </div>

      {/* Timeline track grid - scrollable */}
      <div ref={scrollContainerRef} className="overflow-x-auto mb-2" style={{ scrollbarWidth: 'thin' }}>
        <div className="relative mb-1" style={{ minWidth: '600px' }}>
          {/* Date checkpoints header */}
          <div className="flex justify-between px-1 pt-1 mb-1">
            {checkpoints.map((point) => (
              <span key={point.label} className="text-[8px] text-zinc-500 font-medium">
                {point.label}
              </span>
            ))}
          </div>

          {/* Per-item rows */}
          <div
            ref={trackRef}
            className="flex flex-col bg-zinc-900/40 rounded-lg overflow-hidden"
          >
            {items.length === 0 && (
              <div className="relative h-10 flex items-center justify-center">
                <span className="text-[11px] text-zinc-600">
                  Click &quot;+ Add item&quot; to start
                </span>
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="relative h-10 border-b border-zinc-800/30 last:border-b-0"
              >
                {/* Background grid lines */}
                <div className="absolute inset-0 flex">
                  {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} className="flex-1 border-l border-zinc-800/20 last:border-r" />
                  ))}
                </div>
                {/* Bar */}
                <div
                  className={`absolute top-1.5 h-7 ${item.color} rounded-lg opacity-90 hover:opacity-100 transition-all cursor-grab active:cursor-grabbing flex items-center group shadow-lg hover:shadow-xl hover:scale-[1.02]`}
                  style={{ left: `${item.left}%`, width: `${item.width}%` }}
                  onMouseDown={(e) => handleMouseDown(e, item.id, "move")}
                  onDoubleClick={() => openEditModal(item)}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize opacity-0 group-hover:opacity-100 bg-black/30 rounded-l-lg"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(e, item.id, "resize-left");
                    }}
                  />
                  {/* Label */}
                  <span className="text-[10px] text-white font-bold px-2 truncate w-full text-center drop-shadow-md">
                    {item.label || "Untitled"}
                  </span>
                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize opacity-0 group-hover:opacity-100 bg-black/30 rounded-r-lg"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(e, item.id, "resize-right");
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Item labels row — stacked for readability */}
      {items.length > 0 && (
        <div className="flex flex-col gap-1 mt-1 mb-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/30 rounded-md px-2 py-1 group/item hover:border-zinc-600/50 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
              <input
                value={item.label}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
                placeholder="Label"
                className="w-24 bg-transparent text-[10px] text-zinc-200 font-medium focus:outline-none placeholder-zinc-500"
              />
              {(item.startDate || item.endDate) && (
                <span className="text-[8px] text-zinc-600 ml-auto">{formatShortDateRange(item.startDate, item.endDate)}</span>
              )}
              {item.assignee && item.assignee !== "Unassigned" && (
                <span className="text-[8px] text-zinc-500">{item.assignee.split(" ")[0]}</span>
              )}
              <button
                onClick={() => openEditModal(item)}
                className="w-3 h-3 flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:text-emerald-400 text-zinc-500 transition-all"
                title="Edit"
              >
                <GripHorizontal className="h-2 w-2" />
              </button>
              <button
                onClick={() => deleteItem(item.id)}
                className="w-3 h-3 flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:text-red-400 text-zinc-500 transition-all"
              >
                <X className="h-2 w-2" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors rounded px-2 py-1"
        >
          <Plus className="h-3 w-3" />
          Add item
        </button>
        {items.length > 0 && (
          <button
            onClick={() => setShowFullView(true)}
            className="flex items-center gap-1.5 text-[11px] text-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors rounded px-2 py-1"
          >
            View All ({items.length})
          </button>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999]" onClick={() => setShowEditModal(false)}>
          <div
            className="bg-[#1c1c1c] border border-zinc-700 rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60">
              <span className="text-[13px] text-zinc-200 font-semibold">Edit Timeline Item</span>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Label */}
              <div>
                <label className="text-[11px] text-zinc-400 font-medium mb-1.5 block">Task Name</label>
                <input
                  value={editingItem.label}
                  onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                  placeholder="Enter task name"
                  className="w-full bg-zinc-800 text-[13px] text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-zinc-500"
                  autoFocus
                />
              </div>

              {/* Assignee */}
              <div>
                <label className="text-[11px] text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Assignee
                </label>
                <select
                  value={editingItem.assignee}
                  onChange={(e) => setEditingItem({ ...editingItem, assignee: e.target.value })}
                  className="w-full bg-zinc-800 text-[13px] text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  {TEAM_MEMBERS.map((member) => (
                    <option key={member} value={member} className="bg-zinc-800">
                      {member}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editingItem.startDate}
                    onChange={(e) => setEditingItem({ ...editingItem, startDate: e.target.value })}
                    className="w-full bg-zinc-800 text-[13px] text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editingItem.endDate}
                    onChange={(e) => setEditingItem({ ...editingItem, endDate: e.target.value })}
                    className="w-full bg-zinc-800 text-[13px] text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-[11px] text-zinc-400 font-medium mb-1.5 block">Color</label>
                <div className="flex gap-2">
                  {BAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingItem({ ...editingItem, color })}
                      className={`w-6 h-6 rounded-full ${color} transition-all ${
                        editingItem.color === color
                          ? "ring-2 ring-white ring-offset-2 ring-offset-[#1c1c1c]"
                          : "opacity-60 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-700/60">
              <button
                onClick={() => setShowEditModal(false)}
                className="text-[12px] text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEditModal}
                className="text-[12px] text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 rounded-lg transition-colors font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full View Modal */}
      {showFullView && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[99999]" onClick={() => setShowFullView(false)}>
          <div
            className="bg-[#1c1c1c] border border-zinc-700 rounded-xl shadow-2xl w-[90vw] max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700/60">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[14px] text-zinc-200 font-semibold">Project Timeline</span>
                <span className="text-[11px] text-zinc-500">{items.length} items · {totalProgress}% complete</span>
              </div>
              <button
                onClick={() => setShowFullView(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {/* Full timeline track - stacked rows for readability */}
              <div className="mb-6">
                <div className="relative mb-2" style={{ minWidth: '800px' }}>
                  <div className="bg-zinc-900/40 rounded-lg overflow-hidden">
                    {/* Checkpoints header */}
                    <div className="flex justify-between px-2 pt-1.5 pb-1 border-b border-zinc-800/30">
                      {checkpoints.map((point) => (
                        <span key={point.label} className="text-[8px] text-zinc-500 font-medium">{point.label}</span>
                      ))}
                    </div>
                    {/* Per-item rows */}
                    {items.length === 0 && (
                      <div className="relative h-10 flex items-center justify-center">
                        <span className="text-[11px] text-zinc-600">No items</span>
                      </div>
                    )}
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="relative h-8 border-b border-zinc-800/30 last:border-b-0 cursor-pointer group"
                        onClick={() => { setShowFullView(false); openEditModal(item); }}
                      >
                        {/* Background grid lines */}
                        <div className="absolute inset-0 flex">
                          {Array.from({ length: 12 }, (_, i) => (
                            <div key={i} className="flex-1 border-l border-zinc-800/20 last:border-r" />
                          ))}
                        </div>
                        {/* Bar */}
                        <div
                          className={`absolute top-1 h-6 ${item.color} rounded opacity-80 group-hover:opacity-100 transition-all flex items-center shadow-sm`}
                          style={{ left: `${item.left}%`, width: `${Math.max(item.width, 3)}%` }}
                          title={item.label || "Untitled"}
                        >
                          <span className="text-[9px] text-white font-bold px-1.5 truncate drop-shadow-md">
                            {item.label || "Untitled"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Items table — stacked layout for readability */}
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">All Items</div>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-zinc-800/40 border border-zinc-700/30 rounded-lg px-3 py-2.5 hover:border-zinc-600/50 transition-colors cursor-pointer group"
                    onClick={() => { setShowFullView(false); openEditModal(item); }}
                  >
                    <div className={`w-3 h-3 rounded-full ${item.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-zinc-200 font-medium truncate">{item.label || "Untitled"}</div>
                      <div className="text-[9px] text-zinc-500">
                        {item.startDate || item.endDate ? formatShortDateRange(item.startDate, item.endDate) : `${Math.round(item.left)}%–${Math.round(item.left + item.width)}%`}
                        {item.assignee && item.assignee !== "Unassigned" && ` · ${item.assignee}`}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                      className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-700/60">
              <button
                onClick={() => { setShowFullView(false); addItem(); }}
                className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </button>
              <button
                onClick={() => setShowFullView(false)}
                className="text-[12px] text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const timelineViewBlock = createReactBlockSpec(
  {
    type: "timelineView" as const,
    propSchema: {
      items: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => <TimelineBlock block={block} editor={editor} />,
  }
);
